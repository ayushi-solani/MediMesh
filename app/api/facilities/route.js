import { NextResponse } from 'next/server';
import { authenticatedProfile,getAdminServices } from '@/lib/firebase-admin';
import { canManageFacilities, validateFacility } from '@/lib/registration-policy';
export async function POST(request){
 try {
  const current=await authenticatedProfile(request);
  if(!canManageFacilities(current))throw new Error('Only regional administrators can register facilities.');
  const input=await request.json(),{name,city}=validateFacility(input.name,input.city);
  const {db}=getAdminServices(),normalizedName=name.toLowerCase().replace(/\s+/g,' ');
  // Check legacy seed facilities too (they may not have normalizedName).
  const existing=await db.collection('facilities').get();
  if(existing.docs.some(d => String(d.data().name||'').toLowerCase().replace(/\s+/g,' ').trim()===normalizedName && String(d.data().city||'').toLowerCase()===city.toLowerCase()))throw new Error('A facility with that name is already registered in this city.');
  const doc=db.collection('facilities').doc();
  const facility={name,city,short:name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),normalizedName,active:true,createdAt:new Date().toISOString(),createdBy:current.uid};
  const batch=db.batch();batch.set(doc,facility);batch.set(db.collection('auditLogs').doc(),{actorUid:current.uid,action:'facility.created',facilityId:doc.id,at:facility.createdAt});await batch.commit();
  return NextResponse.json({facility:{id:doc.id,...facility}},{status:201});
 }catch(e){return NextResponse.json({error:e.message||'Facility creation failed.'},{status:400});}
}
