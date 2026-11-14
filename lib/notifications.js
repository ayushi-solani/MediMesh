// Trusted-server helper. Firestore transactions must read users BEFORE any writes.
export function stakeholders(users, item, actorUid) {
  const specialist=item.kind==='medicine'?'pharmacist':'engineer';
  return users.filter(u=>u.active!==false && u.uid!==actorUid && (
    [item.fromFacilityId,item.toFacilityId].includes(u.facilityId) && [specialist,'hospital_admin'].includes(u.role)
    || u.role==='regional_admin' && item.priority==='high'
  ));
}
export function eventText(item, action) {
  const labels={submitted:'New request',approve:'Request approved',reject:'Request rejected',counter_offer:'Partial quantity offered',accept_offer:'Partial offer accepted',decline_offer:'Partial offer declined',cancel:'Request cancelled',resolve_issue:'Delivery issue resolved',dispatch:'Resource dispatched',receive:'Delivery confirmed',initiate_return:'Equipment return started',confirm_return:'Equipment returned for inspection',report_issue:'Delivery discrepancy'};
  return {title:labels[action]||action,message:`${item.resourceName} · ${item.quantity} requested · ${item.id.slice(0,8)}`,type:action,requestId:item.id,kind:item.kind};
}
export function notificationRecords(users,item,actorUid,action,time) {
  const content=eventText(item,action);
  return stakeholders(users,item,actorUid).map(u=>({recipientUid:u.uid,facilityId:u.facilityId||null,createdAt:time,isRead:false,...content}));
}
// Query only stakeholders involved in this action. Avoid scanning the entire users
// collection for each request; all reads happen before transaction writes.
export async function usersForTransaction(tx,db,context={}) {
  const facilities=[...new Set([context.facilityId,context.fromFacilityId,context.toFacilityId].filter(Boolean))];
  const queries=facilities.map(id=>db.collection('users').where('facilityId','==',id));
  if(context.priority==='high')queries.push(db.collection('users').where('role','==','regional_admin'));
  const snaps=await Promise.all(queries.map(q=>tx.get(q)));
  const unique=new Map();
  for(const snap of snaps)for(const doc of snap.docs)unique.set(doc.id,{uid:doc.id,...doc.data()});
  return [...unique.values()];
}
export function writeEvents(tx,db,users,item,actorUid,action,time,movement,extra={}) {
  tx.set(db.collection('auditLogs').doc(),{actorUid,action:`request.${action}`,requestId:item.id,facilityId:item.fromFacilityId,toFacilityId:item.toFacilityId,at:time,...extra});
  if(movement)tx.set(db.collection('inventoryMovements').doc(),{actorUid,requestId:item.id,resourceId:item.resourceId,kind:item.kind,facilityId:item.fromFacilityId,at:time,...movement});
  for(const notification of notificationRecords(users,item,actorUid,action,time))tx.set(db.collection('notifications').doc(),notification);
}

// Inventory activity is routed to relevant members of the same facility.
export function inventoryNotificationRecords(users,facilityId,actorUid,kind,action,resourceLabel,time) {
  const role=kind==='medicine'?'pharmacist':'engineer';
  return users.filter(u=>u.uid!==actorUid && u.active!==false && u.facilityId===facilityId && ['hospital_admin',role].includes(u.role))
    .map(u=>({recipientUid:u.uid,facilityId,createdAt:time,isRead:false,type:`inventory.${action}`,title:`${kind==='medicine'?'Medicine':'Equipment'} inventory updated`,message:`${resourceLabel}: ${action.replaceAll('_',' ')} recorded by facility staff.`}));
}
