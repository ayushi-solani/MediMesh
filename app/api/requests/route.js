import { NextResponse } from 'next/server';
import { authenticatedProfile,getAdminServices } from '@/lib/firebase-admin';
import { makeRequest } from '@/lib/workflow';
import { usersForTransaction,writeEvents } from '@/lib/notifications';
export async function POST(request){
 try {
  const user=await authenticatedProfile(request), body=await request.json();
  const {db}=getAdminServices();
  const collectionName=body.kind==='medicine'?'medicines':body.kind==='equipment'?'equipment':null;
  if(!collectionName||typeof body.resourceId!=='string')throw new Error('Invalid resource type.');
  const ref=db.collection(collectionName).doc(body.resourceId), reqRef=db.collection('resourceRequests').doc();
  const created=await db.runTransaction(async tx=>{
   const asset=await tx.get(ref);
   if(!asset.exists)throw new Error('Resource not found.');
   const at=new Date().toISOString();
   const item=makeRequest(user,body,asset.data(),reqRef.id,at);
   const users=await usersForTransaction(tx,db,item);
   tx.set(reqRef,Object.fromEntries(Object.entries(item).filter(([key])=>key!=='id')));
   writeEvents(tx,db,users,item,user.uid,'submitted',at);
   return item;
  });
  return NextResponse.json({request:created},{status:201});
 }catch(e){return NextResponse.json({error:e.message||'Unable to create request.'},{status:/sign in|profile|disabled/i.test(e.message)?401:400});}
}
