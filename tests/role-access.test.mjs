import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequestKinds, canRequestKind, priorityFor } from '../lib/request-policy.js';
const profile = role => ({ role, facilityId:'north' });
test('pharmacist cannot request equipment', () => {
  assert.deepEqual(allowedRequestKinds('pharmacist'), ['medicine']);
  assert.equal(canRequestKind(profile('pharmacist'), 'medicine'), true);
  assert.equal(canRequestKind(profile('pharmacist'), 'equipment'), false);
});
test('engineer cannot request medicine', () => {
  assert.deepEqual(allowedRequestKinds('engineer'), ['equipment']);
  assert.equal(canRequestKind(profile('engineer'), 'equipment'), true);
  assert.equal(canRequestKind(profile('engineer'), 'medicine'), false);
});
test('hospital admin can request either; regional admin neither', () => {
  assert.equal(canRequestKind(profile('hospital_admin'), 'equipment'), true);
  assert.equal(canRequestKind(profile('hospital_admin'), 'medicine'), true);
  assert.equal(canRequestKind(profile('regional_admin'), 'medicine'), false);
});
test('priority is derived from reason', () => {
  assert.equal(priorityFor('critical'),'high');
  assert.equal(priorityFor('pediatric'),'high');
  assert.equal(priorityFor('treatment'),'medium');
  assert.equal(priorityFor('restock'),'low');
});
