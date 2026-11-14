import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, transition, mayReceive } from '../lib/workflow.js';
import { notificationRecords } from '../lib/notifications.js';
const dateIn=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const pharmacist={uid:'pharm',role:'pharmacist',facilityId:'north'};
const engineer={uid:'eng',role:'engineer',facilityId:'north'};
const cityAdmin={uid:'city',role:'hospital_admin',facilityId:'city'};
const northAdmin={uid:'northAdmin',role:'hospital_admin',facilityId:'north'};
const region={uid:'region',role:'regional_admin',facilityId:null};
const med=()=>({name:'Test tablets',facilityId:'north',quantity:80,reservedQuantity:0,expiryDate:dateIn(90),batchNumber:'T-123'});
const eq=()=>({name:'ECG',facilityId:'north',status:'available',nextMaintenance:dateIn(60)});
const create=(kind='medicine',amount=40,reason='critical',resource=kind==='medicine'?med():eq())=>makeRequest(cityAdmin,{kind,resourceId:'resource1',quantity:amount,reason,note:'Synthetic example',loanDueDate:dateIn(14)},resource,'req1',new Date().toISOString());
const apply=(r,a,actor,action,opts={})=>{const out=transition(r,a,actor,action,opts);Object.assign(r,out.changes);Object.assign(a,out.resource);return out;};
test('new requests do not pre-reserve medicine or equipment',()=>{
 const m=med(),e=eq();const r=create('medicine',40,'critical',m),q=create('equipment',1,'restock',e);
 assert.equal(r.status,'pending');assert.equal(r.priority,'high');assert.equal(m.reservedQuantity,0);assert.equal(e.status,'available');assert.equal(q.loanDueDate,dateIn(14));
});
test('medicine: approval holds available stock; dispatch decrements; receiver credits only on receipt',()=>{
 const a=med(),r=create('medicine',40,'pediatric',a);
 assert.throws(()=>transition(r,a,engineer,'approve'),/role or facility/i);
 apply(r,a,pharmacist,'approve');assert.equal(r.status,'approved');assert.equal(a.reservedQuantity,40);assert.equal(a.quantity,80);
 assert.throws(()=>transition(r,a,pharmacist,'receive'),/role or facility/i);
 apply(r,a,pharmacist,'dispatch');assert.equal(a.quantity,40);assert.equal(a.reservedQuantity,0);
 assert.throws(()=>transition(r,a,pharmacist,'receive'),/role or facility/i);
 const result=apply(r,a,cityAdmin,'receive');assert.equal(r.status,'completed');assert.equal(result.destinationMedicine.quantity,40);assert.equal(result.destinationMedicine.facilityId,'city');
 assert.throws(()=>transition(r,a,cityAdmin,'receive'),/Cannot receive/);
});
test('shortage: counteroffer is held, requester accepts, dispatch transfers reduced amount',()=>{
 const a={...med(),quantity:12},r=create('medicine',40,'restock',a);assert.equal(r.status,'shortage_review');
 assert.throws(()=>transition(r,a,pharmacist,'approve'),/Only 12/);
 apply(r,a,pharmacist,'counter_offer',{offeredQuantity:10});assert.equal(a.reservedQuantity,10);assert.equal(r.status,'counter_offered');
 assert.throws(()=>transition(r,a,engineer,'accept_offer'),/role or facility/i);
 apply(r,a,cityAdmin,'accept_offer');assert.equal(r.approvedQuantity,10);assert.equal(a.quantity,12);assert.equal(a.reservedQuantity,10);
 apply(r,a,pharmacist,'dispatch');assert.equal(a.quantity,2);assert.equal(a.reservedQuantity,0);
 assert.equal(apply(r,a,cityAdmin,'receive').destinationMedicine.quantity,10);
});
test('declining counteroffer releases the exact held amount',()=>{
 const a={...med(),quantity:15},r=create('medicine',50,'restock',a);
 apply(r,a,pharmacist,'counter_offer',{offeredQuantity:12});assert.equal(a.reservedQuantity,12);
 apply(r,a,cityAdmin,'decline_offer');assert.equal(a.reservedQuantity,0);assert.equal(r.status,'declined');
});
test('equipment: approval, dispatch, independent receipt, return and quarantine',()=>{
 const a=eq(),r=create('equipment',1,'treatment',a);
 apply(r,a,engineer,'approve');assert.equal(a.status,'reserved');
 assert.throws(()=>transition(r,a,engineer,'receive'),/role or facility/i);
 apply(r,a,engineer,'dispatch');assert.equal(a.status,'in_transit');
 apply(r,a,cityAdmin,'receive');assert.equal(r.status,'on_loan');assert.equal(a.facilityId,'north');assert.equal(a.currentFacilityId,'city');
 apply(r,a,cityAdmin,'initiate_return');assert.equal(a.status,'return_in_transit');
 const ret=apply(r,a,engineer,'confirm_return');assert.equal(r.status,'returned');assert.equal(a.facilityId,'north');assert.equal(a.status,'maintenance');assert.ok(ret.maintenanceRecord);
});
test('equipment maintenance due disallows approval',()=>{
 const a={...eq(),nextMaintenance:dateIn(-1)},r=create('equipment',1,'restock',a);
 assert.throws(()=>transition(r,a,engineer,'approve'),/maintenance is overdue/);
});
test('expired medicine is disallowed at new request and at approval',()=>{
 assert.throws(()=>create('medicine',5,'restock',{...med(),expiryDate:dateIn(-1)}),/Expired/);
 const a=med(),r=create('medicine',5,'restock',a);a.expiryDate=dateIn(-1);
 assert.throws(()=>transition(r,a,pharmacist,'approve'),/expired/i);
});
test('receipt discrepancy never credits destination stock',()=>{
 const a=med(),r=create('medicine',5,'restock',a);apply(r,a,pharmacist,'approve');apply(r,a,pharmacist,'dispatch');
 const issue=apply(r,a,cityAdmin,'report_issue',{note:'Shipment damaged'});
 assert.equal(r.status,'disputed');assert.equal(issue.destinationMedicine,null);
});
test('notification fanout sends to authorized stakeholders but not the actor',()=>{
 const users=[pharmacist,engineer,cityAdmin,northAdmin,region].map(x=>({...x,active:true}));
 const medRequest=create('medicine',1,'critical');
 const recipientIds=notificationRecords(users,medRequest,cityAdmin.uid,'submitted','2026-11-13').map(n=>n.recipientUid).sort();
 assert.deepEqual(recipientIds,['northAdmin','pharm','region']);
});
test('legacy v0.7 medicine approval is not double-deducted by v0.8 dispatch',()=>{
 const a={...med(),quantity:40,reservedQuantity:0},r=create('medicine',20,'restock',a);
 r.workflowVersion=undefined;r.status='approved';r.approvedQuantity=20;
 apply(r,a,pharmacist,'dispatch');assert.equal(a.quantity,40);assert.equal(a.reservedQuantity,0);
 assert.equal(apply(r,a,cityAdmin,'receive').destinationMedicine.quantity,20);
});
test('supplier may not complete their own handover or cancel another facility request',()=>{
 const a=med(),r=create('medicine',10,'restock',a);
 assert.throws(()=>transition(r,a,pharmacist,'receive'),/role or facility/i);
 assert.throws(()=>transition(r,a,pharmacist,'cancel'),/role or facility/i);
});
test('cancel an approved v0.8 allocation before dispatch releases reservation',()=>{
 const a=med(),r=create('medicine',30,'restock',a);
 apply(r,a,pharmacist,'approve');assert.equal(a.reservedQuantity,30);
 apply(r,a,cityAdmin,'cancel');assert.equal(a.quantity,80);assert.equal(a.reservedQuantity,0);assert.equal(r.status,'cancelled');
});
test('supplier facility administrator can record resolution for disputed delivery',()=>{
 const a=med(),r=create('medicine',10,'restock',a);
 apply(r,a,pharmacist,'approve');apply(r,a,pharmacist,'dispatch');apply(r,a,cityAdmin,'report_issue',{note:'Box damaged'});
 assert.throws(()=>transition(r,a,pharmacist,'resolve_issue',{note:'Repacked'}),/role or facility/i);
 apply(r,a,northAdmin,'resolve_issue',{note:'Replacement contents checked'});assert.equal(r.status,'dispatched');
 apply(r,a,cityAdmin,'receive');assert.equal(r.status,'completed');
});
test('only one of two equipment requests can be approved after the asset is reserved',()=>{
 const a=eq(),r=create('equipment',1,'restock',a),second=makeRequest(cityAdmin,{kind:'equipment',resourceId:'resource1',quantity:1,reason:'restock',loanDueDate:dateIn(14)},a,'req2',new Date().toISOString());
 apply(r,a,engineer,'approve');assert.throws(()=>transition(second,a,engineer,'approve'),/not available/);
});
