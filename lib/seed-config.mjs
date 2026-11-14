// Shared one-time seed config for the Node.js seed script.
export const FACILITIES = [
  {id:'north-clinic',name:'Northside Community Clinic',city:'Delhi',short:'NC'},
  {id:'city-hospital',name:'City General Hospital',city:'Delhi',short:'CH'},
  {id:'hope-center',name:'Hope Medical Centre',city:'Delhi',short:'HM'}
];
export const DEMO_USERS = [
  {name:'Aarav Sharma',email:'pharmacist@medimesh.demo',role:'pharmacist',facilityId:'north-clinic'},
  {name:'Riya Mehta',email:'engineer@medimesh.demo',role:'engineer',facilityId:'north-clinic'},
  {name:'Neha Kapoor',email:'admin.north@medimesh.demo',role:'hospital_admin',facilityId:'north-clinic'},
  {name:'Kabir Sethi',email:'admin.city@medimesh.demo',role:'hospital_admin',facilityId:'city-hospital'},
  {name:'Regional Coordinator',email:'regional@medimesh.demo',role:'regional_admin',facilityId:null}
];
