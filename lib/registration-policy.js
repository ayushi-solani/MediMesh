export const STAFF_ROLES = ['pharmacist', 'engineer', 'hospital_admin'];
export function canInvite(inviter,role,facilityId) {
  if (!inviter || !facilityId || !STAFF_ROLES.includes(role)) return false;
  if (inviter.role === 'regional_admin') return true;
  return inviter.role === 'hospital_admin' && inviter.facilityId === facilityId && ['pharmacist','engineer'].includes(role);
}
export function canManageAccount(actor,target) {
  if (!actor || !target || actor.uid===target.uid) return false;
  if(actor.role==='regional_admin')return target.role!=='regional_admin';
  return actor.role==='hospital_admin' && actor.facilityId===target.facilityId && ['pharmacist','engineer'].includes(target.role);
}
export function canManageFacilities(user) { return user?.role === 'regional_admin'; }
export function isValidEmail(value) { return typeof value==='string' && value.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validateFacility(name,city) {
  if (typeof name !== 'string' || name.trim().length<3 || name.trim().length>100) throw new Error('Facility name must be 3–100 characters.');
  if (typeof city !== 'string' || city.trim().length<2 || city.trim().length>70) throw new Error('City must be 2–70 characters.');
  return {name:name.trim(),city:city.trim()};
}
export function validateInvitation(input) {
  if (!isValidEmail(input?.email)) throw new Error('Enter a valid email address.');
  if (typeof input?.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length>80) throw new Error('Enter a name of 2–80 characters.');
  if (typeof input?.password !== 'string' || input.password.length<12 || input.password.length>128) throw new Error('Password must be 12–128 characters.');
  if (typeof input?.inviteToken !== 'string' || !/^[A-Za-z0-9]{16,32}\.[a-zA-Z0-9_-]{32,128}$/.test(input.inviteToken)) throw new Error('A valid invitation code is required.');
  return {email:input.email.trim().toLowerCase(),name:input.name.trim(),password:input.password,inviteToken:input.inviteToken};
}
