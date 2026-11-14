export const FACILITIES = [
  { id: 'north-clinic', name: 'Northside Community Clinic', city: 'Delhi', short: 'NC' },
  { id: 'city-hospital', name: 'City General Hospital', city: 'Delhi', short: 'CH' },
  { id: 'hope-center', name: 'Hope Medical Centre', city: 'Delhi', short: 'HM' }
];

export const DEMO_USERS = [
  { uid: 'demo-pharmacist', name: 'Aarav Sharma', email: 'pharmacist@medimesh.demo', role: 'pharmacist', facilityId: 'north-clinic' },
  { uid: 'demo-engineer', name: 'Riya Mehta', email: 'engineer@medimesh.demo', role: 'engineer', facilityId: 'north-clinic' },
  { uid: 'demo-hospital-admin', name: 'Neha Kapoor', email: 'admin.north@medimesh.demo', role: 'hospital_admin', facilityId: 'north-clinic' },
  { uid: 'demo-city-admin', name: 'Kabir Sethi', email: 'admin.city@medimesh.demo', role: 'hospital_admin', facilityId: 'city-hospital' },
  { uid: 'demo-regional', name: 'Regional Coordinator', email: 'regional@medimesh.demo', role: 'regional_admin', facilityId: null }
];

export const ROLES = {
  pharmacist: 'Pharmacist',
  engineer: 'Biomedical Engineer',
  hospital_admin: 'Hospital Administrator',
  regional_admin: 'Regional Administrator'
};

export function facilityName(id, facilities = FACILITIES) {
  return facilities.find((f) => f.id === id)?.name ?? id ?? '—';
}

export function daysUntil(dateString) {
  if (!dateString) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${dateString}T00:00:00`);
  return Math.ceil((expiry - today) / 86400000);
}

export function expiryStatus(batch) {
  const days = daysUntil(batch.expiryDate);
  if (days < 0) return { text: 'Expired', level: 'danger' };
  if (days <= 30) return { text: 'Critical', level: 'danger' };
  if (days <= 60) return { text: 'Expiring soon', level: 'warning' };
  return { text: 'Healthy', level: 'success' };
}

export function canEditMedicine(user, facilityId) {
  return Boolean(user && user.facilityId === facilityId && user.role === 'pharmacist');
}
export function canEditEquipment(user, facilityId) {
  return Boolean(user && user.facilityId === facilityId && user.role === 'engineer');
}
export function canApprove(user, request) {
  return Boolean(user && user.facilityId === request.fromFacilityId && (user.role === 'hospital_admin' || (request.kind === 'medicine' && user.role === 'pharmacist') || (request.kind === 'equipment' && user.role === 'engineer')));
}
