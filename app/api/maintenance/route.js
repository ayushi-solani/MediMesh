import { NextResponse } from 'next/server';
import { authenticatedProfile, getAdminServices } from '@/lib/firebase-admin';
import { isoDate, nonEmpty } from '@/lib/domain.mjs';

export async function POST(request) {
  try {
    const user = await authenticatedProfile(request);
    if (!['engineer','hospital_admin'].includes(user.role)) throw new Error('Only technical staff or hospital administrators can record maintenance.');
    const body = await request.json();
    const equipmentId = nonEmpty(body.equipmentId, 'Equipment ID', 150);
    const note = nonEmpty(body.note, 'Maintenance notes', 500);
    const nextMaintenance = isoDate(body.nextMaintenance, 'Next maintenance date');
    const performedAt = isoDate(body.performedAt, 'Service date');
    if (performedAt > nextMaintenance) throw new Error('Next maintenance must not precede service date.');
    const { db } = getAdminServices();
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const recordRef = db.collection('maintenanceLogs').doc();
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(equipmentRef);
      if (!snapshot.exists) throw new Error('Equipment not found.');
      const device = snapshot.data();
      if (device.facilityId !== user.facilityId) throw new Error('Only your facility equipment may be serviced.');
      if (device.status === 'reserved') throw new Error('Reserved equipment cannot be serviced.');
      tx.set(recordRef, { equipmentId, facilityId: user.facilityId, equipmentName: device.name, performedAt, nextMaintenance, note, performedBy: user.uid, createdAt: new Date().toISOString() });
      tx.update(equipmentRef, { nextMaintenance, status:'available', updatedAt:new Date().toISOString() });
      tx.set(db.collection('auditLogs').doc(), { actorUid:user.uid, facilityId:user.facilityId, action:'equipment.maintenance', equipmentId, at:new Date().toISOString() });
    });
    return NextResponse.json({ ok:true, id:recordRef.id }, {status:201});
  } catch(e) { return NextResponse.json({error:e.message||'Failed to log maintenance.'}, {status:/sign in|disabled|profile/i.test(e.message)?401:400}); }
}
