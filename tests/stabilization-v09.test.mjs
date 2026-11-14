import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, transition } from '../lib/workflow.js';
import { canInvite, canManageAccount, canManageFacilities, validateInvitation, validateFacility } from '../lib/registration-policy.js';
import { stakeholders } from '../lib/notifications.js';
const future = days => {const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const user={uid:'pharm-city',role:'pharmacist',facilityId:'city-hospital'};
const supplier={uid:'pharm-north',role:'pharmacist',facilityId:'north-clinic'};
const adminCity={uid:'admin-city',role:'hospital_admin',facilityId:'city-hospital'};
const adminNorth={uid:'admin-north',role:'hospital_admin',facilityId:'north-clinic'};
const regional={uid:'region',role:'regional_admin',facilityId:null};
const medicine={name:'ORS',facilityId:'north-clinic',quantity:50,reservedQuantity:0,expiryDate:future(60),batchNumber:'T-1'};
const payload={kind:'medicine',fromFacilityId:'north-clinic',resourceId:'m1',quantity:20,reason:'restock'};
test('selected facility must match the actual supplying resource',()=>{
 const request=makeRequest(user,payload,medicine,'req-1',new Date().toISOString());
 assert.equal(request.fromFacilityId,'north-clinic');assert.equal(request.toFacilityId,'city-hospital');
 assert.equal(request.workflowVersion,9);
 assert.throws(()=>makeRequest(user,{...payload,fromFacilityId:'hope-center'},medicine,'req-2',new Date().toISOString()),/facility does not match/i);
});
test('pharmacists cannot request assets owned by their own facility',()=>{
 assert.throws(()=>makeRequest(supplier,payload,medicine,'req-3',new Date().toISOString()),/external hospital/i);
});
test('unverified legacy documents no longer block resource approval',()=>{
 const item=makeRequest(user,payload,medicine,'req-4',new Date().toISOString());item.evidence={reviewStatus:'pending'};
 const result=transition(item,medicine,supplier,'approve');
 assert.equal(result.changes.status,'approved');assert.equal(result.resource.reservedQuantity,20);
});
test('document review actions are removed',()=>{
 const item=makeRequest(user,payload,medicine,'req-5',new Date().toISOString());
 assert.throws(()=>transition(item,medicine,supplier,'verify_document'),/Unsupported workflow action/);
});
test('hospital administrator can only invite specialist staff to own facility',()=>{
 assert.equal(canInvite(adminCity,'pharmacist','city-hospital'),true);
 assert.equal(canInvite(adminCity,'engineer','city-hospital'),true);
 assert.equal(canInvite(adminCity,'hospital_admin','city-hospital'),false);
 assert.equal(canInvite(adminCity,'engineer','north-clinic'),false);
});
test('regional administrator can invite admins but no account can invite a regional admin',()=>{
 assert.equal(canInvite(regional,'hospital_admin','hope-center'),true);
 assert.equal(canInvite(regional,'regional_admin','hope-center'),false);
 assert.equal(canInvite(supplier,'pharmacist','north-clinic'),false);
 assert.equal(canManageFacilities(regional),true);
 assert.equal(canManageFacilities(adminNorth),false);
});
test('registration validates invitation, email, and strong passwords',()=>{
 const inviteToken='ABCDEFGHIJKLMNOPQRSTUVWX.'+'a'.repeat(43);
 assert.equal(validateInvitation({email:'Test@Example.com',name:'Test User',password:'some-strong-password',inviteToken}).email,'test@example.com');
 assert.throws(()=>validateInvitation({email:'test@example.com',name:'Test User',password:'short',inviteToken}),/12/);
 assert.throws(()=>validateInvitation({email:'test@example.com',name:'Test User',password:'some-strong-password',inviteToken:'bad'}),/invitation/i);
});
test('facility registration validates input length',()=>{
 assert.deepEqual(validateFacility(' City General ',' Delhi '),{name:'City General',city:'Delhi'});
 assert.throws(()=>validateFacility('X','Delhi'),/3/);
});
test('regional notifications depend on priority and local supplier recipients are scoped',()=>{
 const users=[user,supplier,adminCity,adminNorth,regional].map(x=>({...x,active:true}));
 const item=makeRequest(user,payload,medicine,'req-10',new Date().toISOString());
 assert.deepEqual(stakeholders(users,item,user.uid).map(x=>x.uid).sort(),['admin-city','admin-north','pharm-north']);
 const emergency=makeRequest(user,{...payload,reason:'critical'},medicine,'req-11',new Date().toISOString());
 assert.deepEqual(stakeholders(users,emergency,user.uid).map(x=>x.uid).sort(),['admin-city','admin-north','pharm-north','region']);
});

test('hospital admin can deactivate own specialists but not other facilities or admins',()=>{
 assert.equal(canManageAccount(adminCity,{...user}),true);
 assert.equal(canManageAccount(adminCity,{...supplier}),false);
 assert.equal(canManageAccount(adminCity,{...adminNorth}),false);
 assert.equal(canManageAccount(regional,{...adminCity}),true);
 assert.equal(canManageAccount(regional,{...regional}),false);
});
