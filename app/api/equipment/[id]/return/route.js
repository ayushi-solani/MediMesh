import { NextResponse } from 'next/server';
import { authenticatedProfile, getAdminServices } from '@/lib/firebase-admin';

export async function POST(request, {params}) {
  try {
    const user=await authenticatedProfile(request);
    if (!['engineer','hospital_admin'].includes(user.role)) throw new Error('This role cannot return equipment.');
    const {id}=await params;
    const {db}=getAdminServices();
    const ref=db.collection('equipment').doc(id);
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(ref);
      if (!snap.exists) throw new Error('Equipment not found.');
      const asset=snap.data();
      if (asset.facilityId!==user.facilityId || !asset.loanOriginFacilityId) throw new Error('This equipment is not a returnable loan to your facility.');
      if (asset.status==='reserved' || asset.status==='maintenance') throw new Error('Equipment cannot be returned while reserved or under maintenance.');
      tx.update(ref,{facilityId:asset.loanOriginFacilityId,loanOriginFacilityId:null,status:'available',updatedAt:new Date().toISOString()});
      tx.set(db.collection('auditLogs').doc(),{actorUid:user.uid,facilityId:user.facilityId,action:'equipment.returned',equipmentId:id,at:new Date().toISOString()});
    });
    return NextResponse.json({ok:true});
  } catch(e){return NextResponse.json({error:e.message||'Return failed.'},{status:/sign in|disabled|profile/i.test(e.message)?401:400});}
}
