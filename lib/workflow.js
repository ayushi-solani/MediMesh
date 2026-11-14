import { canSupplierAct, freeStock, priorityFor, validateQuantity, canRequestKind } from './request-policy.js';

export const isDatePast = value => Boolean(value) && new Date(`${value}T23:59:59Z`).getTime() < Date.now();
export const mayReceive = (user, item) => Boolean(user?.facilityId && user.facilityId === item.toFacilityId && (user.role === 'hospital_admin' || item.kind === 'medicine' && user.role === 'pharmacist' || item.kind === 'equipment' && user.role === 'engineer'));
export function makeRequest(user, payload, resource, id, time) {
  const {kind,resourceId,fromFacilityId,quantity=1,reason='restock',note='',loanDueDate=''}=payload;
  if (!canRequestKind(user,kind)) throw new Error('Your role cannot request this resource type.');
  if (!resource || resource.facilityId === user.facilityId || typeof resourceId!=='string' || !resourceId) throw new Error('Choose an external hospital resource.');
  if (fromFacilityId !== undefined && fromFacilityId !== resource.facilityId) throw new Error('Selected supplying facility does not match the resource.');
  const amount=validateQuantity(quantity,kind),priority=priorityFor(reason);
  if (typeof note!=='string' || note.length>500) throw new Error('Notes must be at most 500 characters.');
  if (kind==='medicine' && isDatePast(resource.expiryDate)) throw new Error('Expired medicine cannot be requested.');
  if (kind==='equipment') {
    if (resource.status!=='available') throw new Error('Equipment is not available.');
    if (!/^\d{4}-\d\d-\d\d$/.test(loanDueDate) || isDatePast(loanDueDate)) throw new Error('A future return date is required for equipment loans.');
  }
  const availableAtRequest=kind==='medicine'?freeStock(resource):1;
  const status=kind==='medicine' && availableAtRequest<amount?'shortage_review':'pending';
  return {id,workflowVersion:9,kind,resourceId,resourceName:resource.name,quantity:amount,reason,priority,fromFacilityId:resource.facilityId,toFacilityId:user.facilityId,requestedBy:user.uid,availableAtRequest,status,note:note.trim(),loanDueDate:kind==='equipment'?loanDueDate:null,createdAt:time,updatedAt:time};
}

// Shared pure transition engine used by both demo and Firestore server transactions.
// Inventory changes are PATCHES, so all changes can commit atomically.
export function transition(item, asset, user, action, options={}, time=new Date().toISOString()) {
  if (!item || !asset) throw new Error('Missing request or resource.');
  const supplier=canSupplierAct(user,item),receiver=mayReceive(user,item);
  const requester=Boolean(user?.facilityId===item.toFacilityId && (user?.uid===item.requestedBy || user?.role==='hospital_admin'));
  const legacy=!item.workflowVersion || item.workflowVersion<8;
  const changes={updatedAt:time,lastActionBy:user.uid},resource={};
  const qty=Number(item.approvedQuantity||item.quantity),current=item.status;
  let destinationMedicine=null,movement=null,maintenanceRecord=null;
  function requireState(states,auth=true) {if(!auth)throw new Error('Your role or facility cannot perform this action.');if(!states.includes(current))throw new Error(`Cannot ${action} request in state ${current}.`);}
  function requireValidMedicine() {if(isDatePast(asset.expiryDate))throw new Error('Medicine is expired.');}
  if(action==='approve') {
    requireState(['pending','shortage_review'],supplier);
    if(item.kind==='medicine') {
      requireValidMedicine();
      const alreadyHeld=legacy&&current==='pending';
      if(!alreadyHeld && freeStock(asset)<item.quantity)throw new Error(`Only ${freeStock(asset)} available. Offer a smaller quantity.`);
      if(alreadyHeld && Number(asset.reservedQuantity||0)<item.quantity) throw new Error('Legacy reservation is inconsistent.');
      if(!alreadyHeld)resource.reservedQuantity=Number(asset.reservedQuantity||0)+item.quantity;
    } else {
      if(isDatePast(asset.nextMaintenance))throw new Error('Equipment maintenance is overdue.');
      if(asset.status!==(legacy?'reserved':'available'))throw new Error('Equipment not available for approval.');
      resource.status='reserved';resource.reservedForRequest=item.id;
    }
    changes.status='approved';changes.approvedAt=time;changes.approvedQuantity=item.quantity;movement={type:'reserved',quantity:item.quantity};
  } else if(action==='counter_offer') {
    requireState(['pending','shortage_review'],supplier && item.kind==='medicine');requireValidMedicine();
    if(legacy && current==='pending')throw new Error('Legacy full request is reserved. Approve or reject it.');
    const offered=validateQuantity(options.offeredQuantity,'medicine');
    if(offered>=item.quantity || offered>freeStock(asset))throw new Error(`Offer less than ${item.quantity}, up to ${freeStock(asset)} free units.`);
    resource.reservedQuantity=Number(asset.reservedQuantity||0)+offered;
    changes.offeredQuantity=offered;changes.offerMessage=`We can supply ${offered} of ${item.quantity} units. Is this acceptable?`;
    changes.status='counter_offered';movement={type:'offer_held',quantity:offered};
  } else if(action==='accept_offer') {
    requireState(['counter_offered'],requester);requireValidMedicine();
    const offered=Number(item.offeredQuantity);
    if(!Number.isSafeInteger(offered)||offered<1||Number(asset.reservedQuantity||0)<offered)throw new Error('Offered stock is unavailable.');
    changes.approvedQuantity=offered;changes.approvedAt=time;changes.status='approved';
    if(legacy){resource.quantity=Number(asset.quantity)-offered;resource.reservedQuantity=Number(asset.reservedQuantity||0)-offered;changes.legacyAlreadyDeducted=true;}
    movement={type:'offer_accepted',quantity:offered};
  } else if(['reject','cancel','decline_offer'].includes(action)) {
    const auth=action==='reject'?supplier:requester;
    requireState(action==='decline_offer'?['counter_offered']:action==='cancel'?['pending','shortage_review','counter_offered','approved']:['pending','shortage_review','counter_offered'],auth);
    if(item.kind==='medicine'){
      const held=current==='counter_offered'?Number(item.offeredQuantity||0):current==='approved'&&!(legacy||item.legacyAlreadyDeducted)?qty:legacy&&current==='pending'?Number(item.quantity):0;
      if(held){if(Number(asset.reservedQuantity||0)<held)throw new Error('Reservation mismatch.');resource.reservedQuantity=Number(asset.reservedQuantity||0)-held;}
      if(current==='approved'&&(legacy||item.legacyAlreadyDeducted))resource.quantity=Number(asset.quantity)+qty;
    } else if(current==='approved'||legacy&&asset.status==='reserved'){resource.status='available';resource.reservedForRequest=null;}
    changes.status={reject:'rejected',cancel:'cancelled',decline_offer:'declined'}[action];movement={type:'released',quantity:item.quantity};
  } else if(action==='dispatch') {
    requireState(['approved'],supplier);
    if(item.kind==='medicine') {
      requireValidMedicine();
      if(!legacy && !item.legacyAlreadyDeducted){if(Number(asset.reservedQuantity||0)<qty||Number(asset.quantity)<qty)throw new Error('Stock reservation mismatch.');resource.quantity=Number(asset.quantity)-qty;resource.reservedQuantity=Number(asset.reservedQuantity||0)-qty;}
    } else {if(asset.status!=='reserved'||asset.reservedForRequest&&asset.reservedForRequest!==item.id)throw new Error('Asset not reserved for this request.');resource.status='in_transit';}
    changes.status='dispatched';changes.dispatchedAt=time;movement={type:'dispatched',quantity:qty};
  } else if(action==='receive') {
    requireState(['dispatched'],receiver);
    if(item.kind==='medicine') {
      destinationMedicine={name:asset.name,category:asset.category||'Medicine',batchNumber:asset.batchNumber,quantity:qty,reservedQuantity:0,minStock:0,expiryDate:asset.expiryDate,facilityId:item.toFacilityId,transferredFromRequest:item.id,createdAt:time,updatedAt:time};
      changes.status='completed';
    } else {
      if(asset.status!=='in_transit')throw new Error('Equipment is not in transit.');
      resource.status='loaned';resource.currentFacilityId=item.toFacilityId;resource.reservedForRequest=item.id;
      changes.status='on_loan';
    }
    changes.receivedAt=time;movement={type:'received',quantity:qty};
  } else if(action==='initiate_return') {
    requireState(['on_loan'],receiver && item.kind==='equipment');
    if(asset.status!=='loaned'||asset.reservedForRequest!==item.id)throw new Error('Loan asset mismatch.');
    changes.status='return_in_transit';changes.returnDispatchedAt=time;resource.status='return_in_transit';movement={type:'return_dispatched',quantity:1};
  } else if(action==='confirm_return') {
    requireState(['return_in_transit'],supplier);
    if(asset.status!=='return_in_transit'||asset.reservedForRequest!==item.id)throw new Error('Return asset mismatch.');
    changes.status='returned';changes.returnedAt=time;
    resource.status='maintenance';resource.currentFacilityId=null;resource.reservedForRequest=null;
    maintenanceRecord={equipmentId:item.resourceId,facilityId:item.fromFacilityId,type:'return_inspection',notes:'Returned; inspection required before reuse.',at:time,actorUid:user.uid,requestId:item.id};
    movement={type:'returned',quantity:1};
  } else if(action==='resolve_issue') {
    requireState(['disputed'],supplier && user.role==='hospital_admin');
    if(!String(options.note||'').trim())throw new Error('Record the resolution outcome.');
    changes.status='dispatched';changes.resolutionNote=String(options.note).trim().slice(0,500);
  } else if(action==='report_issue') {
    requireState(['dispatched'],receiver);
    if(!String(options.note||'').trim())throw new Error('Describe the delivery issue.');
    changes.status='disputed';changes.disputeNote=String(options.note).trim().slice(0,500);
  } else throw new Error('Unsupported workflow action.');
  return {changes,resource,destinationMedicine,movement,maintenanceRecord};
}
