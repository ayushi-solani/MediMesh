import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityFor, freeStock, canSupplierAct, canRequesterAct, validateQuantity } from '../lib/request-policy.js';
const medicine = { kind:'medicine', fromFacilityId:'north-clinic', toFacilityId:'city-hospital', requestedBy:'user-city' };
const equipment = { ...medicine, kind:'equipment' };
test('critical and pediatric both produce high priority',()=>{
  assert.equal(priorityFor('critical'),'high');
  assert.equal(priorityFor('pediatric'),'high');
  assert.equal(priorityFor('restock'),'low');
  assert.equal(priorityFor('treatment'),'medium');
  assert.throws(()=>priorityFor('fake'));
});
test('available stock excludes already reserved batches',()=>{
  assert.equal(freeStock({quantity:20,reservedQuantity:7}),13);
  assert.equal(freeStock({quantity:0,reservedQuantity:0}),0);
});
test('pharmacist approval is medicine-only at supplying facility',()=>{
  const pharmacist={uid:'p',role:'pharmacist',facilityId:'north-clinic'};
  assert.equal(canSupplierAct(pharmacist,medicine),true);
  assert.equal(canSupplierAct(pharmacist,equipment),false);
  assert.equal(canSupplierAct({...pharmacist,facilityId:'city-hospital'},medicine),false);
});
test('engineer approval is equipment-only at supplying facility',()=>{
  const engineer={uid:'e',role:'engineer',facilityId:'north-clinic'};
  assert.equal(canSupplierAct(engineer,equipment),true);
  assert.equal(canSupplierAct(engineer,medicine),false);
  assert.equal(canSupplierAct({ ...engineer, role:'hospital_admin' },medicine),true);
});
test('only the original requesting user can accept a counteroffer',()=>{
  assert.equal(canRequesterAct({uid:'user-city',facilityId:'city-hospital'},medicine),true);
  assert.equal(canRequesterAct({uid:'other',facilityId:'city-hospital'},medicine),false);
  assert.equal(canRequesterAct({uid:'user-city',facilityId:'north-clinic'},medicine),false);
});
test('equipment quantity must be one and medicine quantity positive',()=>{
  assert.equal(validateQuantity(1,'equipment'),1);
  assert.equal(validateQuantity(250,'medicine'),250);
  assert.throws(()=>validateQuantity(2,'equipment'));
  assert.throws(()=>validateQuantity(0,'medicine'));
  assert.throws(()=>validateQuantity(1.5,'medicine'));
});
