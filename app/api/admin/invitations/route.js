import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { authenticatedProfile, getAdminServices } from '@/lib/firebase-admin';
import { canInvite, isValidEmail } from '@/lib/registration-policy';

export async function POST(request) {
  try {
    const inviter = await authenticatedProfile(request);
    const {email,role,facilityId} = await request.json();
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!isValidEmail(normalized)) throw new Error('Enter a valid email address.');
    if (!canInvite(inviter,role,facilityId)) throw new Error('You cannot invite this role to this facility.');
    const {db,auth} = getAdminServices();
    const facility = await db.collection('facilities').doc(facilityId).get();
    if (!facility.exists || facility.data().active === false) throw new Error('Facility is not active.');
    try { await auth.getUserByEmail(normalized); throw new Error('An account with this email already exists.'); }
    catch(e) { if (e.code !== 'auth/user-not-found') throw e; }
    const secret=randomBytes(32).toString('base64url');
    const doc=db.collection('invitations').doc();
    const at=new Date(),expiresAt=new Date(at.getTime()+7*86400000).toISOString();
    await doc.set({email:normalized,role,facilityId,invitedBy:inviter.uid,createdAt:at.toISOString(),expiresAt,status:'pending',secretHash:createHash('sha256').update(secret).digest('hex')});
    await db.collection('auditLogs').add({actorUid:inviter.uid,action:'user.invited',facilityId,role,email:normalized,at:at.toISOString()});
    return NextResponse.json({inviteToken:`${doc.id}.${secret}`,email:normalized,role,facilityId,expiresAt},{status:201});
  } catch(e) {return NextResponse.json({error:e.message||'Could not create invitation.'},{status:400});}
}
