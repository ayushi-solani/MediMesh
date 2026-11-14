import test from 'node:test';
import assert from 'node:assert/strict';
import { integer, isoDate, availableMedicine, canReserve, buildNotifications, csvText } from '../lib/domain.mjs';

test('integer rejects fractional, negative, and invalid amounts', () => {
  assert.equal(integer('12', 'Quantity', 1), 12);
  for (const value of [-1, '1.2', 'abc', '']) assert.throws(() => integer(value));
});
test('dates must be valid calendar dates', () => {
  assert.equal(isoDate('2026-11-13'), '2026-11-13');
  assert.throws(() => isoDate('2026-02-30'));
});
test('medicine quantity holds prevent oversubscription', () => {
  const med = { quantity: 30, reservedQuantity: 20, expiryDate:'2035-12-31' };
  assert.equal(availableMedicine(med), 10);
  assert.equal(canReserve('medicine', med, 10, new Date('2030-01-01')),10);
  assert.throws(() => canReserve('medicine', med, 11, new Date('2030-01-01')));
});
test('unavailable and overdue equipment cannot be reserved', () => {
  assert.throws(() => canReserve('equipment', {status:'reserved',nextMaintenance:'2035-12-31'}, 1, new Date('2030-01-01')));
  assert.throws(() => canReserve('equipment', {status:'available',nextMaintenance:'2020-01-01'}, 1, new Date('2030-01-01')));
});
test('alerts filter by facility and role', () => {
  const data={medicines:[{id:'a',name:'Med',batchNumber:'B1',quantity:1,reservedQuantity:0,minStock:3,expiryDate:'2020-01-01',facilityId:'north'}],equipment:[],requests:[]};
  assert.equal(buildNotifications(data,{role:'pharmacist',facilityId:'south'}).length,0);
  assert.equal(buildNotifications(data,{role:'regional_admin'}).length,2);
});
test('CSV export quotes fields and neutralizes spreadsheet formulas', () => {
  const result=csvText([{key:'name',label:'Name'}],[{name:'=IMPORTXML("unsafe")'}]);
  assert.match(result,/"'=IMPORTXML/);
  assert.match(result,/""unsafe""/);
});
