import { NextResponse } from 'next/server';
import { authenticatedProfile, getAdminServices } from '@/lib/firebase-admin';

export async function POST(request, { params }) {
  try {
    const user = await authenticatedProfile(request);
    const { id } = await params;
    const { db } = getAdminServices();
    const ref = db.collection('resourceRequests').doc(id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Request not found.');
      const req = snap.data();
      if (user.facilityId !== req.toFacilityId || !['pharmacist','engineer','hospital_admin'].includes(user.role)) throw new Error('Only the requesting facility can cancel.');
      if (!['pending','approved'].includes(req.status)) throw new Error('Only uncompleted requests can be cancelled.');
      const resourceRef = db.collection(req.kind === 'medicine' ? 'medicines' : 'equipment').doc(req.resourceId);
      const resourceSnap = await tx.get(resourceRef);
      if (!resourceSnap.exists) throw new Error('Original resource missing.');
      const resource = resourceSnap.data();
      if (req.kind === 'equipment') {
        if (resource.status !== 'reserved') throw new Error('Reservation state is inconsistent.');
        tx.update(resourceRef, { status:'available',updatedAt:new Date().toISOString() });
      } else {
        const held = Number(resource.reservedQuantity||0);
        if (held < req.quantity) throw new Error('Reservation state is inconsistent.');
        tx.update(resourceRef, { reservedQuantity:held-req.quantity,updatedAt:new Date().toISOString() });
      }
      tx.update(ref, {status:'cancelled',updatedAt:new Date().toISOString(),lastActionBy:user.uid});
      tx.set(db.collection('auditLogs').doc(), {actorUid:user.uid,facilityId:user.facilityId,action:'request.cancelled',requestId:id,at:new Date().toISOString()});
    });
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:e.message||'Cancellation failed.'},{status:/sign in|disabled|profile/i.test(e.message)?401:400}); }
}
