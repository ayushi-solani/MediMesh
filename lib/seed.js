import { FACILITIES } from './constants';

const later = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function createDemoData() {
  return {
    facilities: FACILITIES,
    medicines: [
      { id: 'med-1', name: 'Paracetamol 500 mg', batchNumber: 'PCM-2408', category: 'Tablet', quantity: 420, reservedQuantity: 0, minStock: 100, expiryDate: later(27), facilityId: 'north-clinic' },
      { id: 'med-2', name: 'Amoxicillin 250 mg', batchNumber: 'AMX-1182', category: 'Capsule', quantity: 52, reservedQuantity: 0, minStock: 80, expiryDate: later(49), facilityId: 'north-clinic' },
      { id: 'med-3', name: 'ORS Sachets', batchNumber: 'ORS-4401', category: 'Oral rehydration', quantity: 280, reservedQuantity: 0, minStock: 75, expiryDate: later(180), facilityId: 'city-hospital' },
      { id: 'med-4', name: 'Metformin 500 mg', batchNumber: 'MET-9021', category: 'Tablet', quantity: 75, reservedQuantity: 0, minStock: 110, expiryDate: later(95), facilityId: 'city-hospital' },
      { id: 'med-5', name: 'Saline 500 mL', batchNumber: 'SAL-1124', category: 'IV Fluid', quantity: 120, reservedQuantity: 0, minStock: 50, expiryDate: later(240), facilityId: 'hope-center' }
    ],
    equipment: [
      { id: 'eq-1', name: 'Portable ECG Monitor', assetTag: 'ECG-001', category: 'Diagnostics', status: 'available', facilityId: 'city-hospital', nextMaintenance: later(90) },
      { id: 'eq-2', name: 'Oxygen Concentrator', assetTag: 'OXY-004', category: 'Respiratory', status: 'available', facilityId: 'north-clinic', nextMaintenance: later(32) },
      { id: 'eq-3', name: 'Portable Ultrasound', assetTag: 'ULT-009', category: 'Imaging', status: 'in_use', facilityId: 'hope-center', nextMaintenance: later(45) },
      { id: 'eq-4', name: 'Patient Monitor', assetTag: 'MON-007', category: 'Monitoring', status: 'maintenance', facilityId: 'north-clinic', nextMaintenance: later(-3) }
    ],
    requests: [],
    auditLogs: [],
    notifications: [],
    maintenanceRecords: [],
    inventoryMovements: []
  };
}
