import { NextResponse } from 'next/server';
import { authenticatedProfile,getAdminServices } from '@/lib/firebase-admin';
import { isDatePast } from '@/lib/workflow';
import { usersForTransaction, inventoryNotificationRecords } from '@/lib/notifications';
function saneInt(value,label){const x=Number(value);if(!Number.isSafeInteger(x)||x<0||x>1e7)throw new Error(`${label} must be a non-negative whole number.`);return x;}
function roleAllowed(user,kind){return user.facilityId && (kind==='medicine'&&user.role==='pharmacist'||kind==='equipment'&&user.role==='engineer');}
export async function POST(request){
 try{
  const user=await authenticatedProfile(request),body=await request.json(),{action,kind}=body;
  if(!['medicine','equipment'].includes(kind)||!roleAllowed(user,kind))throw new Error('Your role cannot manage this inventory.');
  const {db}=getAdminServices(),name=kind==='medicine'?'medicines':'equipment';
  const ref=action==='create'?db.collection(name).doc():db.collection(name).doc(body.id||'INVALID');
  const at=new Date().toISOString();
  const result=await db.runTransaction(async tx=>{
   let changes={},previous=null,movement=null;
   const users=await usersForTransaction(tx,db,{facilityId:user.facilityId});
   if(action==='create'){
    const label=String(body.name||'').trim();if(!label||label.length>120)throw new Error('Enter a valid resource name.');
    if(kind==='medicine'){
     const batch=String(body.batchNumber||'').trim();if(!batch||batch.length>70)throw new Error('Batch number is required.');
     if(!/^\d{4}-\d\d-\d\d$/.test(body.expiryDate))throw new Error('Valid expiry date required.');
     changes={name:label,batchNumber:batch,category:String(body.category||'Other').slice(0,60),quantity:saneInt(body.quantity,'Quantity'),reservedQuantity:0,minStock:saneInt(body.minStock,'Threshold'),expiryDate:body.expiryDate,facilityId:user.facilityId,createdAt:at,updatedAt:at};
    }else{
     const tag=String(body.assetTag||'').trim();if(!tag||tag.length>60)throw new Error('Asset tag required.');
     if(!/^\d{4}-\d\d-\d\d$/.test(body.nextMaintenance))throw new Error('Valid maintenance date required.');
     changes={name:label,assetTag:tag,category:String(body.category||'Other').slice(0,60),nextMaintenance:body.nextMaintenance,status:'available',facilityId:user.facilityId,currentFacilityId:null,createdAt:at,updatedAt:at};
    }
    movement={type:'created',quantity:kind==='medicine'?changes.quantity:1};
   }else{
    if(typeof body.id!=='string'||!body.id)throw new Error('Resource ID required.');
    const snapshot=await tx.get(ref);if(!snapshot.exists)throw new Error('Resource not found.');
    previous=snapshot.data();if(previous.facilityId!==user.facilityId)throw new Error('You cannot edit another facility inventory.');
    if(action==='set_quantity' && kind==='medicine'){
     const quantity=saneInt(body.quantity,'Quantity');
     if(quantity<Number(previous.reservedQuantity||0))throw new Error('Stock cannot be below reserved quantity.');
     changes={quantity,updatedAt:at};movement={type:'manual_adjustment',before:previous.quantity,quantity:quantity-Number(previous.quantity)};
    }else if(action==='set_status' && kind==='equipment'){
     if(!['available','in_use','maintenance'].includes(body.status))throw new Error('Invalid equipment status.');
     if(!['available','in_use','maintenance'].includes(previous.status))throw new Error('Equipment is allocated to a transfer and cannot be edited.');
     if(body.status==='available' && isDatePast(previous.nextMaintenance))throw new Error('Complete overdue maintenance before marking available.');
     if(previous.status==='maintenance'&&body.status==='available'&&!String(body.note||'').trim())throw new Error('Enter a maintenance completion note.');
     changes={status:body.status,updatedAt:at};movement={type:'status_update',before:previous.status,after:body.status};
    }else if(action==='service_equipment' && kind==='equipment'){
     if(previous.status!=='maintenance')throw new Error('Only equipment under maintenance can be serviced.');
     if(!/^\d{4}-\d\d-\d\d$/.test(body.nextMaintenance)||isDatePast(body.nextMaintenance))throw new Error('Set a future maintenance date after service.');
     if(!String(body.note||'').trim())throw new Error('Provide an inspection note.');
     changes={nextMaintenance:body.nextMaintenance,status:'available',updatedAt:at};movement={type:'service_completed',before:'maintenance',after:'available'};
    }else throw new Error('Unsupported inventory operation.');
   }
   if(action==='create')tx.set(ref,changes);else tx.update(ref,changes);
   tx.set(db.collection('auditLogs').doc(),{actorUid:user.uid,action:`inventory.${action}`,kind,resourceId:ref.id,facilityId:user.facilityId,at,...movement});
   if(movement)tx.set(db.collection('inventoryMovements').doc(),{actorUid:user.uid,kind,resourceId:ref.id,facilityId:user.facilityId,at,...movement});
   for(const record of inventoryNotificationRecords(users,user.facilityId,user.uid,kind,action,changes.name||previous?.name||'Resource',at))tx.set(db.collection('notifications').doc(),record);
   if(kind==='equipment' && action==='set_status' && (changes.status==='maintenance'||previous?.status==='maintenance')){
    tx.set(db.collection('maintenanceRecords').doc(),{equipmentId:ref.id,facilityId:user.facilityId,actorUid:user.uid,at,type:changes.status==='maintenance'?'maintenance_started':'maintenance_finished',notes:String(body.note||'').trim().slice(0,300)});
   }
   return {id:ref.id};
  });
  return NextResponse.json({ok:true,...result});
 }catch(e){return NextResponse.json({error:e.message||'Inventory operation failed.'},{status:/sign in|profile|disabled/i.test(e.message)?401:400});}
}
