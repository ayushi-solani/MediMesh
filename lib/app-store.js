'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { APP_MODE, getFirebaseClient } from './firebase-client';
import { DEMO_USERS } from './constants';
import { createDemoData } from './seed';
import { makeRequest, transition } from './workflow';
import { notificationRecords, inventoryNotificationRecords } from './notifications';

const KEY = 'medimesh-starter-demo-v1'; // Keep existing demo data when upgrading.
const SESSION = 'medimesh-demo-user-v1';
const AppContext = createContext(null);
const initial = createDemoData();
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
const now = () => new Date().toISOString();

function loadDemo() {
  try { const json = localStorage.getItem(KEY); return json ? { ...createDemoData(), ...JSON.parse(json), notifications:JSON.parse(json).notifications||[], maintenanceRecords:JSON.parse(json).maintenanceRecords||[], inventoryMovements:JSON.parse(json).inventoryMovements||[] } : createDemoData(); }
  catch { return createDemoData(); }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (APP_MODE === 'demo') {
      setData(loadDemo());
      setUser(DEMO_USERS.find((u) => u.uid === localStorage.getItem(SESSION)) || DEMO_USERS[2]);
      setReady(true);
      const change = (event) => { if (event.key === KEY) setData(loadDemo()); };
      window.addEventListener('storage', change);
      return () => window.removeEventListener('storage', change);
    }
    let services;
    try { services = getFirebaseClient(); }
    catch (e) { setError(e.message); setReady(true); return; }
    const { auth, db } = services;
    let unsubCollections = [];
    const stop = onAuthStateChanged(auth, (loggedUser) => {
      unsubCollections.forEach((u) => u());
      unsubCollections = [];
      if (!loggedUser) { setUser(null); setData(createDemoData()); setReady(true); return; }
      setReady(false);
      let loadedUser = false;
      const unsubProfile = onSnapshot(doc(db, 'users', loggedUser.uid), (snap) => {
        if (snap.exists() && snap.data().active !== false) {
          setUser({ uid: loggedUser.uid, ...snap.data() });
          if (!loadedUser) {
            loadedUser = true;
            for (const [key, collectionName] of [['facilities','facilities'],['medicines','medicines'],['equipment','equipment']]) {
              unsubCollections.push(onSnapshot(collection(db, collectionName), (result) => {
                setData((current) => ({ ...current, [key]: result.docs.map((item) => ({ id: item.id, ...item.data() })) }));
              }, (err) => setError(err.message)));
            }
            unsubCollections.push(onSnapshot(query(collection(db,'notifications'),where('recipientUid','==',loggedUser.uid)),result=>{
              setData(current=>({...current,notifications:result.docs.map(d=>({id:d.id,...d.data()}))}));
            },err=>setError(err.message)));
            for (const name of ['maintenanceRecords','inventoryMovements']) {
              const scoped=snap.data().role==='regional_admin'?collection(db,name):query(collection(db,name),where('facilityId','==',snap.data().facilityId));
              unsubCollections.push(onSnapshot(scoped,result=>setData(current=>({...current,[name]:result.docs.map(d=>({id:d.id,...d.data()}))})),err=>setError(err.message)));
            }
            if (snap.data().role === 'regional_admin') {
              unsubCollections.push(onSnapshot(collection(db, 'resourceRequests'), (result) => {
                setData((current) => ({...current, requests:result.docs.map((x)=>({id:x.id,...x.data()}))}));
              }, (err)=>setError(err.message)));
              unsubCollections.push(onSnapshot(collection(db, 'auditLogs'), (result) => {
                setData((current) => ({...current, auditLogs:result.docs.map((x)=>({id:x.id,...x.data()}))}));
              }, (err)=>setError(err.message)));
            } else {
              const requestMaps = { source: [], destination: [] };
              const combine = () => {
                const merged = new Map([...requestMaps.source,...requestMaps.destination].map((r)=>[r.id,r]));
                setData((current)=>({...current,requests:Array.from(merged.values())}));
              };
              for (const [side,field] of [['source','fromFacilityId'],['destination','toFacilityId']]) {
                unsubCollections.push(onSnapshot(query(collection(db,'resourceRequests'), where(field,'==',snap.data().facilityId)), (result)=>{
                  requestMaps[side] = result.docs.map((r)=>({id:r.id,...r.data()}));
                  combine();
                }, (err)=>setError(err.message)));
              }
            }
          }
        } else { setUser(null); setError('Your account has no active MediMesh profile. Ask the administrator to provision one.'); }
        setReady(true);
      }, (err) => { setError(err.message); setReady(true); });
      unsubCollections.push(unsubProfile);
    });
    return () => { stop(); unsubCollections.forEach((u) => u()); };
  }, []);

  const demoMutate = useCallback((handler) => {
    const previous = loadDemo();
    const next = structuredClone(previous);
    const result = handler(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    setData(next);
    return result;
  }, []);

  const logIn = useCallback(async (email, password) => {
    setError('');
    if (APP_MODE === 'demo') return;
    await signInWithEmailAndPassword(getFirebaseClient().auth, email, password);
  }, []);
  const logOut = useCallback(async () => {
    if (APP_MODE === 'firebase') await signOut(getFirebaseClient().auth);
  }, []);
  const selectDemoUser = useCallback((uid) => {
    if (APP_MODE !== 'demo') return;
    const selected = DEMO_USERS.find((u) => u.uid === uid);
    if (selected) { localStorage.setItem(SESSION, uid); setUser(selected); }
  }, []);
  const resetDemo = useCallback(() => {
    if (APP_MODE === 'demo') { localStorage.removeItem(KEY); setData(createDemoData()); }
  }, []);

  const apiGet = useCallback(async (path) => {
    if (APP_MODE !== 'firebase') throw new Error('Account administration requires Firebase mode.');
    const token = await getFirebaseClient().auth.currentUser?.getIdToken();
    if (!token) throw new Error('You must sign in.');
    const response = await fetch(path, {headers:{authorization:`Bearer ${token}`},cache:'no-store'});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  }, []);
  const apiCall = useCallback(async (path, payload) => {
    const token = await getFirebaseClient().auth.currentUser?.getIdToken();
    if (!token) throw new Error('You must sign in.');
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  }, []);

  const registerAccount = useCallback(async ({inviteToken,email,name,password}) => {
    if (APP_MODE !== 'firebase') throw new Error('Registration requires Firebase mode.');
    const response = await fetch('/api/auth/register', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inviteToken,email,name,password})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Registration failed.');
    await signInWithEmailAndPassword(getFirebaseClient().auth,email.trim().toLowerCase(),password);
    return body;
  }, []);
  const getTeam = useCallback(() => apiGet('/api/admin/team'),[apiGet]);
  const sendInvite = useCallback(payload => apiCall('/api/admin/invitations',payload),[apiCall]);
  const createFacility = useCallback(payload => apiCall('/api/facilities',payload),[apiCall]);
  const setTeamStatus = useCallback((targetUid,active) => apiCall('/api/admin/team',{targetUid,active}),[apiCall]);

  const addMedicine = useCallback(async payload => {
    if (APP_MODE==='firebase') return apiCall('/api/inventory',{action:'create',kind:'medicine',...payload});
    if (user.role!=='pharmacist') throw new Error('Only pharmacy staff can edit medicine stock.');
    return demoMutate(next=>{const id=newId();next.medicines.unshift({id,...payload,facilityId:user.facilityId,reservedQuantity:0,createdAt:now()});next.auditLogs.unshift({id:newId(),actorUid:user.uid,facilityId:user.facilityId,action:'inventory.create',resourceId:id,at:now()});for(const n of inventoryNotificationRecords(DEMO_USERS,user.facilityId,user.uid,'medicine','create',payload.name,now()))next.notifications.unshift({id:newId(),...n});});
  },[apiCall,demoMutate,user]);
  const addEquipment = useCallback(async payload => {
    if (APP_MODE==='firebase') return apiCall('/api/inventory',{action:'create',kind:'equipment',...payload});
    if (user.role!=='engineer') throw new Error('Only equipment staff can register devices.');
    return demoMutate(next=>{const id=newId();next.equipment.unshift({id,...payload,facilityId:user.facilityId,status:'available',createdAt:now()});next.auditLogs.unshift({id:newId(),actorUid:user.uid,facilityId:user.facilityId,action:'inventory.create',resourceId:id,at:now()});for(const n of inventoryNotificationRecords(DEMO_USERS,user.facilityId,user.uid,'equipment','create',payload.name,now()))next.notifications.unshift({id:newId(),...n});});
  },[apiCall,demoMutate,user]);
  const updateEquipmentStatus = useCallback(async (id,status,note='')=>{
    if(APP_MODE==='firebase')return apiCall('/api/inventory',{action:'set_status',kind:'equipment',id,status,note});
    if(user.role!=='engineer')throw new Error('Not authorized.');
    return demoMutate(next=>{const a=next.equipment.find(x=>x.id===id);if(!a||a.facilityId!==user.facilityId||!['available','in_use','maintenance'].includes(a.status))throw new Error('Asset is not editable.');if(a.status==='maintenance'&&status==='available'&&!note.trim())throw new Error('Maintenance completion note required.');const before=a.status;a.status=status;a.updatedAt=now();next.auditLogs.unshift({id:newId(),actorUid:user.uid,facilityId:user.facilityId,action:'inventory.set_status',resourceId:id,at:now()});for(const n of inventoryNotificationRecords(DEMO_USERS,user.facilityId,user.uid,'equipment','set_status',a.name,now()))next.notifications.unshift({id:newId(),...n});if(status==='maintenance'||before==='maintenance')next.maintenanceRecords.unshift({id:newId(),equipmentId:id,facilityId:user.facilityId,actorUid:user.uid,at:now(),type:status==='maintenance'?'maintenance_started':'maintenance_finished',notes:note});});
  },[apiCall,demoMutate,user]);
  const serviceEquipment=useCallback(async (id,nextMaintenance,note)=>{
    if(APP_MODE==='firebase')return apiCall('/api/inventory',{action:'service_equipment',kind:'equipment',id,nextMaintenance,note});
    if(user.role!=='engineer')throw new Error('Only the engineer can complete service.');
    return demoMutate(next=>{const a=next.equipment.find(x=>x.id===id);
      if(!a||a.facilityId!==user.facilityId||a.status!=='maintenance'||!note?.trim()||!nextMaintenance||new Date(`${nextMaintenance}T23:59:59Z`).getTime()<Date.now())throw new Error('Complete service with notes and a future maintenance date.');
      a.status='available';a.nextMaintenance=nextMaintenance;
      next.maintenanceRecords.unshift({id:newId(),equipmentId:id,facilityId:user.facilityId,actorUid:user.uid,at:now(),type:'maintenance_finished',notes:note});
      next.auditLogs.unshift({id:newId(),actorUid:user.uid,action:'inventory.service_equipment',resourceId:id,facilityId:user.facilityId,at:now()});for(const n of inventoryNotificationRecords(DEMO_USERS,user.facilityId,user.uid,'equipment','service_equipment',a.name,now()))next.notifications.unshift({id:newId(),...n});
    });
  },[apiCall,demoMutate,user]);
  const updateMedicineQuantity=useCallback(async (id,quantity)=>{
    if(APP_MODE==='firebase')return apiCall('/api/inventory',{action:'set_quantity',kind:'medicine',id,quantity});
    if(user.role!=='pharmacist')throw new Error('Not authorized.');
    return demoMutate(next=>{const m=next.medicines.find(x=>x.id===id);if(!m||m.facilityId!==user.facilityId||!Number.isSafeInteger(quantity)||quantity<Number(m.reservedQuantity||0))throw new Error('Invalid stock adjustment.');const before=m.quantity;m.quantity=quantity;next.inventoryMovements.unshift({id:newId(),resourceId:id,kind:'medicine',quantity:quantity-before,facilityId:user.facilityId,type:'manual_adjustment',actorUid:user.uid,at:now()});next.auditLogs.unshift({id:newId(),actorUid:user.uid,facilityId:user.facilityId,action:'inventory.set_quantity',resourceId:id,at:now()});for(const n of inventoryNotificationRecords(DEMO_USERS,user.facilityId,user.uid,'medicine','set_quantity',m.name,now()))next.notifications.unshift({id:newId(),...n});});
  },[apiCall,demoMutate,user]);

  const createRequest=useCallback(async payload=>{
    if(APP_MODE==='firebase')return apiCall('/api/requests',payload);
    return demoMutate(next=>{
      const source=(payload.kind==='medicine'?next.medicines:next.equipment).find(x=>x.id===payload.resourceId);
      const id=newId(),at=now(),item=makeRequest(user,payload,source,id,at);
      next.requests.unshift(item);
      next.auditLogs.unshift({id:newId(),actorUid:user.uid,action:'request.submitted',requestId:id,facilityId:item.fromFacilityId,at});
      for(const n of notificationRecords(DEMO_USERS,item,user.uid,'submitted',at))next.notifications.unshift({id:newId(),...n});
      return {request:item};
    });
  },[apiCall,demoMutate,user]);
  const decideRequest=useCallback(async (id,action,options={})=>{
    if(APP_MODE==='firebase')return apiCall(`/api/requests/${encodeURIComponent(id)}/decision`,{action,...options});
    return demoMutate(next=>{
      const item=next.requests.find(x=>x.id===id);
      if(!item)throw new Error('Request not found.');
      const asset=(item.kind==='medicine'?next.medicines:next.equipment).find(x=>x.id===item.resourceId);
      const at=now(),change=transition(item,asset,user,action,options,at);
      Object.assign(item,change.changes);Object.assign(asset,change.resource);
      if(change.destinationMedicine)next.medicines.unshift({id:newId(),...change.destinationMedicine});
      if(change.maintenanceRecord)next.maintenanceRecords.unshift({id:newId(),...change.maintenanceRecord});
      if(change.movement)next.inventoryMovements.unshift({id:newId(),actorUid:user.uid,requestId:item.id,resourceId:item.resourceId,kind:item.kind,facilityId:item.fromFacilityId,at,...change.movement});
      next.auditLogs.unshift({id:newId(),actorUid:user.uid,action:`request.${action}`,requestId:id,facilityId:item.fromFacilityId,at});
      for(const n of notificationRecords(DEMO_USERS,item,user.uid,action,at))next.notifications.unshift({id:newId(),...n});
      return {status:item.status};
    });
  },[apiCall,demoMutate,user]);
  const markNotificationRead=useCallback(async id=>{
    if(APP_MODE==='firebase')return updateDoc(doc(getFirebaseClient().db,'notifications',id),{isRead:true,readAt:now()});
    return demoMutate(next=>{const n=next.notifications.find(x=>x.id===id&&x.recipientUid===user.uid);if(!n)throw new Error('Notification not found.');n.isRead=true;n.readAt=now();});
  },[demoMutate,user]);

  const value = useMemo(() => ({ mode: APP_MODE, user, data, ready, error, setError, logIn, logOut, registerAccount, getTeam, sendInvite, createFacility, setTeamStatus, selectDemoUser, resetDemo, addMedicine, addEquipment, updateEquipmentStatus, serviceEquipment, updateMedicineQuantity, createRequest, decideRequest, markNotificationRead }), [user, data, ready, error, logIn, logOut, registerAccount, getTeam, sendInvite, createFacility, setTeamStatus, selectDemoUser, resetDemo, addMedicine, addEquipment, updateEquipmentStatus, serviceEquipment, updateMedicineQuantity, createRequest, decideRequest, markNotificationRead]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('Wrap in AppProvider'); return context; }
