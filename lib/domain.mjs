/** Pure domain calculations. Safe to reuse in browser, server, and Node tests. */
export function integer(value, label = 'Quantity', minimum = 0) {
  if (typeof value === 'boolean' || value === '' || value === null || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) {
    throw new Error(`${label} must be a whole number of at least ${minimum}.`);
  }
  return Number(value);
}
export function nonEmpty(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} must be 1–${max} characters.`);
  return value.trim();
}
export function isoDate(value, label = 'Date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return value;
}
export function daysRemaining(value, at = new Date()) {
  if (!value) return Infinity;
  const target = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(target)) return Infinity;
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.round((target - today) / 86400000);
}
export function availableMedicine(batch) {
  return Number(batch.quantity || 0) - Number(batch.reservedQuantity || 0);
}
export function canReserve(kind, resource, quantity, at = new Date()) {
  const amount = integer(quantity, 'Quantity', 1);
  if (kind === 'equipment') {
    if (amount !== 1) throw new Error('Only one equipment asset can be reserved at a time.');
    if (resource.status !== 'available') throw new Error('Equipment is not available.');
    if (daysRemaining(resource.nextMaintenance, at) < 0) throw new Error('Equipment has overdue maintenance.');
  } else if (kind === 'medicine') {
    if (daysRemaining(resource.expiryDate, at) < 0) throw new Error('Expired medicines cannot be requested.');
    if (availableMedicine(resource) < amount) throw new Error(`Only ${availableMedicine(resource)} units available.`);
  } else throw new Error('Invalid resource type.');
  return amount;
}
export function buildNotifications({ medicines = [], equipment = [], requests = [] }, user) {
  const own = (facilityId) => user?.role === 'regional_admin' || user?.facilityId === facilityId;
  const items = [];
  medicines.filter((x) => own(x.facilityId)).forEach((m) => {
    const d = daysRemaining(m.expiryDate);
    if (d < 0) items.push({ id:`expired-${m.id}`, level:'danger', title:`Expired: ${m.name}`, detail:`Batch ${m.batchNumber} must not be redistributed.`, facilityId:m.facilityId, category:'medicine' });
    else if (d <= 60) items.push({ id:`expiry-${m.id}`, level:d<=30?'danger':'warning', title:`Expiry alert: ${m.name}`, detail:`Batch ${m.batchNumber} expires in ${d} day(s).`, facilityId:m.facilityId, category:'medicine' });
    if (availableMedicine(m) < Number(m.minStock||0)) items.push({ id:`stock-${m.id}`, level:'warning', title:`Low stock: ${m.name}`, detail:`Only ${availableMedicine(m)} unit(s) available.`, facilityId:m.facilityId, category:'medicine' });
  });
  equipment.filter((x) => own(x.facilityId)).forEach((e) => {
    const d = daysRemaining(e.nextMaintenance);
    if (d <= 14) items.push({ id:`maintenance-${e.id}`, level:d<0?'danger':'warning', title:`Maintenance: ${e.name}`, detail:d<0?`Overdue by ${-d} day(s).`:`Due in ${d} day(s).`, facilityId:e.facilityId, category:'equipment' });
  });
  requests.filter((r) => r.status === 'pending' && (user?.role === 'regional_admin' || (user?.role === 'hospital_admin' && user?.facilityId === r.fromFacilityId))).forEach((r) => {
    items.push({ id:`request-${r.id}`, level:'info', title:`Incoming request: ${r.resourceName}`, detail:`${r.quantity} unit(s) awaiting source approval.`, facilityId:r.fromFacilityId, category:'request' });
  });
  return items;
}
export function csvText(columns, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'"+'$&').replace(/"/g, '""')}"`;
  return [columns.map((x)=>escape(x.label)).join(','), ...rows.map((r)=>columns.map((c)=>escape(r[c.key])).join(','))].join('\r\n');
}
