/**
 * One-time DEVELOPMENT seed for a brand-new Firebase project.
 * Sets up three example facilities, demo inventory, and 5 Firebase Auth accounts.
 * Run only after the Firestore database and Email/Password sign-in are enabled.
 * IMPORTANT: Changes permanent cloud records. Do NOT use real healthcare data.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const required = ['FIREBASE_ADMIN_PROJECT_ID','FIREBASE_ADMIN_CLIENT_EMAIL','FIREBASE_ADMIN_PRIVATE_KEY','MEDIMESH_SEED_PASSWORD'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}. See README.md.`);
if (process.env.MEDIMESH_SEED_PASSWORD.length < 12) throw new Error('Use a seed password with at least 12 characters.');

const { FACILITIES, DEMO_USERS } = await import('../lib/seed-config.mjs');
const app = getApps()[0] || initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g,'\n')
}) });
const auth = getAuth(app); const db = getFirestore(app);
const ago = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10); };
const medicines = [
  { id:'med-1', name:'Paracetamol 500 mg',batchNumber:'PCM-2408',category:'Tablet',quantity:420,reservedQuantity:0,minStock:100,expiryDate:ago(27),facilityId:'north-clinic'},
  { id:'med-2', name:'Amoxicillin 250 mg',batchNumber:'AMX-1182',category:'Capsule',quantity:52,reservedQuantity:0,minStock:80,expiryDate:ago(49),facilityId:'north-clinic'},
  { id:'med-3', name:'ORS Sachets',batchNumber:'ORS-4401',category:'Oral rehydration',quantity:280,reservedQuantity:0,minStock:75,expiryDate:ago(180),facilityId:'city-hospital'},
  { id:'med-4', name:'Metformin 500 mg',batchNumber:'MET-9021',category:'Tablet',quantity:75,reservedQuantity:0,minStock:110,expiryDate:ago(95),facilityId:'city-hospital'},
  { id:'med-5', name:'Saline 500 mL',batchNumber:'SAL-1124',category:'IV Fluid',quantity:120,reservedQuantity:0,minStock:50,expiryDate:ago(240),facilityId:'hope-center'}
];
const equipment = [
  {id:'eq-1',name:'Portable ECG Monitor',assetTag:'ECG-001',category:'Diagnostics',status:'available',facilityId:'city-hospital',nextMaintenance:ago(90)},
  {id:'eq-2',name:'Oxygen Concentrator',assetTag:'OXY-004',category:'Respiratory',status:'available',facilityId:'north-clinic',nextMaintenance:ago(32)},
  {id:'eq-3',name:'Portable Ultrasound',assetTag:'ULT-009',category:'Imaging',status:'in_use',facilityId:'hope-center',nextMaintenance:ago(45)},
  {id:'eq-4',name:'Patient Monitor',assetTag:'MON-007',category:'Monitoring',status:'maintenance',facilityId:'north-clinic',nextMaintenance:ago(-3)}
];

for (const f of FACILITIES) await db.collection('facilities').doc(f.id).set(f);
for (const u of DEMO_USERS) {
  let record;
  try { record = await auth.getUserByEmail(u.email); }
  catch(e) { if (e.code !== 'auth/user-not-found') throw e; record = await auth.createUser({ email:u.email,password:process.env.MEDIMESH_SEED_PASSWORD,displayName:u.name }); }
  await db.collection('users').doc(record.uid).set({name:u.name,email:u.email,role:u.role,facilityId:u.facilityId,active:true});
  process.stdout.write(`Seeded ${u.email}\n`);
}
for (const m of medicines) await db.collection('medicines').doc(m.id).set(Object.fromEntries(Object.entries(m).filter(([key])=>key!=='id')));
for (const e of equipment) await db.collection('equipment').doc(e.id).set(Object.fromEntries(Object.entries(e).filter(([key])=>key!=='id')));
console.log('Seed complete. Use seeded emails and MEDIMESH_SEED_PASSWORD to sign in.');
