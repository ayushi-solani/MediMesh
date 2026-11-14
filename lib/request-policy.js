export const REASONS = {
  critical: 'Critical / emergency case',
  pediatric: 'Pediatric / child case',
  treatment: 'Scheduled patient treatment',
  restock: 'Routine restocking'
};
export function priorityFor(reason) {
  if (reason === 'critical' || reason === 'pediatric') return 'high';
  if (reason === 'treatment') return 'medium';
  if (reason === 'restock') return 'low';
  throw new Error('Choose a valid request purpose.');
}
export function freeStock(resource) {
  return Math.max(0, Number(resource?.quantity || 0) - Number(resource?.reservedQuantity || 0));
}
export function canSupplierAct(user, item) {
  return Boolean(user && item && user.facilityId === item.fromFacilityId &&
    (user.role === 'hospital_admin' || (item.kind === 'medicine' && user.role === 'pharmacist') || (item.kind === 'equipment' && user.role === 'engineer')));
}
export function canRequesterAct(user, item) {
  return Boolean(user && item && user.facilityId === item.toFacilityId && user.uid === item.requestedBy);
}
export function validateQuantity(quantity, kind) {
  const count = Number(quantity);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000) throw new Error('Quantity must be a whole number from 1 to 100000.');
  if (kind === 'equipment' && count !== 1) throw new Error('Equipment requests must have quantity 1.');
  return count;
}
export function canApproveQuantity(item, resource) {
  if (item.kind === 'equipment') return resource.status === 'reserved';
  return Number(resource.reservedQuantity || 0) >= Number(item.quantity) && Number(resource.quantity) >= Number(item.quantity);
}

// Resource types a user may request. The backend and demo store enforce this,
// independently of the controls shown on screen.
export function canRequestKind(user, kind) {
  if (!user || !user.facilityId) return false;
  return user.role === 'hospital_admin' && ['medicine','equipment'].includes(kind) ||
    user.role === 'pharmacist' && kind === 'medicine' ||
    user.role === 'engineer' && kind === 'equipment';
}
export function allowedRequestKinds(role) {
  if (role === 'pharmacist') return ['medicine'];
  if (role === 'engineer') return ['equipment'];
  if (role === 'hospital_admin') return ['medicine','equipment'];
  return [];
}
