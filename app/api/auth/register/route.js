import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getAdminServices } from '@/lib/firebase-admin';
import { validateInvitation } from '@/lib/registration-policy';

const hashToken = token => createHash('sha256').update(token).digest();
const compareToken = (expected,secret) => {
  if(typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))return false;
  return timingSafeEqual(Buffer.from(expected,'hex'),hashToken(secret));
};
export async function POST(request){
 let invitationRef=null,createdUid=null,claimed=false;
 try {
  const {email,name,password,inviteToken}=validateInvitation(await request.json());
  const [id,secret]=inviteToken.split('.');
  const {db,auth}=getAdminServices();invitationRef=db.collection('invitations').doc(id);
  const invitation=await db.runTransaction(async tx=>{
    const snap=await tx.get(invitationRef);
    if(!snap.exists)throw new Error('Invitation is invalid or expired.');
    const item=snap.data();
    if(!compareToken(item.secretHash,secret)||item.email!==email||Date.parse(item.expiresAt)<Date.now()||item.status!=='pending')throw new Error('Invitation is invalid, expired or already used.');
    const facility=await tx.get(db.collection('facilities').doc(item.facilityId));
    if(!facility.exists||facility.data().active===false)throw new Error('Invited facility is unavailable.');
    tx.update(invitationRef,{status:'processing',claimedAt:new Date().toISOString()});
    return item;
  });
  claimed=true;
  const account=await auth.createUser({email,password,displayName:name,emailVerified:false,disabled:false});
  createdUid=account.uid;
  const at=new Date().toISOString();
  await db.runTransaction(async tx=>{
    const invitation=await tx.get(invitationRef);
    if(invitation.data()?.status!=='processing')throw new Error('Invitation has changed.');
    tx.create(db.collection('users').doc(createdUid),{name,email,role:invitation.data().role,facilityId:invitation.data().facilityId,active:true,createdAt:at});
    tx.update(invitationRef,{status:'used',usedAt:at,usedBy:createdUid,secretHash:null});
    tx.set(db.collection('auditLogs').doc(),{actorUid:createdUid,action:'user.registered',facilityId:invitation.data().facilityId,at});
    tx.set(db.collection('notifications').doc(),{recipientUid:invitation.data().invitedBy,facilityId:invitation.data().facilityId,createdAt:at,isRead:false,type:'user.registered',title:'Team member registered',message:`${name} (${email}) has joined the facility network.`});
  });
  return NextResponse.json({ok:true,email},{status:201});
 }catch(e){
  const {db,auth}=getAdminServices();
  if(createdUid)try{await auth.deleteUser(createdUid);}catch{}
  if(claimed && invitationRef)try{
    await db.runTransaction(async tx=>{const snap=await tx.get(invitationRef);if(snap.exists&&snap.data().status==='processing')tx.update(invitationRef,{status:'pending',claimedAt:null});});
  }catch{}
  return NextResponse.json({error:e.code==='auth/email-already-exists'?'This email already has an account.':e.message||'Registration failed.'},{status:400});
 }
}
