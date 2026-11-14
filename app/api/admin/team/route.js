import { NextResponse } from 'next/server';
import { authenticatedProfile, getAdminServices } from '@/lib/firebase-admin';
import { canManageAccount } from '@/lib/registration-policy';
export async function GET(request){
 try {
  const current=await authenticatedProfile(request);
  if (!['regional_admin','hospital_admin'].includes(current.role)) throw new Error('Not authorized.');
  const {db}=getAdminServices();
  const query=current.role==='regional_admin'?db.collection('users'):db.collection('users').where('facilityId','==',current.facilityId);
  const snap=await query.get();
  return NextResponse.json({users:snap.docs.map(d=>({uid:d.id,name:d.data().name,email:d.data().email,role:d.data().role,facilityId:d.data().facilityId,active:d.data().active}))});
 }catch(e){return NextResponse.json({error:e.message||'Could not load staff.'},{status:400});}
}

export async function POST(request){
 try{
  const actor=await authenticatedProfile(request),body=await request.json();
  if(typeof body.targetUid!=='string'||typeof body.active!=='boolean')throw new Error('Invalid account update.');
  const {db}=getAdminServices(),ref=db.collection('users').doc(body.targetUid);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new Error('Account not found.');
   if(!canManageAccount(actor,{uid:snap.id,...snap.data()}))throw new Error('You cannot manage this account.');
   const at=new Date().toISOString();
   tx.update(ref,{active:body.active,updatedAt:at});
   tx.set(db.collection('auditLogs').doc(),{actorUid:actor.uid,action:body.active?'user.activated':'user.deactivated',targetUid:snap.id,facilityId:snap.data().facilityId,at});
  });
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e.message||'Could not update account.'},{status:400});}
}
