import { NextResponse } from 'next/server';
import { authenticatedProfile,getAdminServices } from '@/lib/firebase-admin';
import { transition } from '@/lib/workflow';
import { usersForTransaction,writeEvents } from '@/lib/notifications';
export async function POST(request,{params}){
 try {
  const user=await authenticatedProfile(request), {action,...options}=await request.json(),{id}=await params;
  const {db}=getAdminServices(),ref=db.collection('resourceRequests').doc(id);
  const result=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new Error('Request not found.');
   const item={id,...snap.data()};
   const assetRef=db.collection(item.kind==='medicine'?'medicines':'equipment').doc(item.resourceId);
   const assetSnap=await tx.get(assetRef);
   const users=await usersForTransaction(tx,db,item);
   if(!assetSnap.exists)throw new Error('Resource not found.');
   const at=new Date().toISOString();
   const {changes,resource,destinationMedicine,movement,maintenanceRecord}=transition(item,assetSnap.data(),user,action,options,at);
   tx.update(ref,changes);
   if(Object.keys(resource).length)tx.update(assetRef,{...resource,updatedAt:at});
   if(destinationMedicine)tx.set(db.collection('medicines').doc(),destinationMedicine);
   if(maintenanceRecord)tx.set(db.collection('maintenanceRecords').doc(),maintenanceRecord);
   writeEvents(tx,db,users,item,user.uid,action,at,movement);
   return {status:changes.status,approvedQuantity:changes.approvedQuantity??item.approvedQuantity??null};
  });
  return NextResponse.json({ok:true,...result});
 }catch(e){return NextResponse.json({error:e.message||'Unable to update request.'},{status:/sign in|profile|disabled/i.test(e.message)?401:400});}
}
