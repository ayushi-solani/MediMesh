'use client';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeftRight, ArrowUpRight, Boxes, Building2, Check, ChevronDown, CircleAlert, ClipboardList, HeartPulse, LayoutDashboard, LogOut, Menu, PackagePlus, Pill, Plus, RefreshCw, Search, ShieldCheck, Stethoscope, Download, Sparkles, TrendingUp, Clock3, X, Bell, Wrench, History, Truck, CalendarClock, UsersRound, UserPlus, Copy, ListFilter } from 'lucide-react';
import { AppProvider, useApp } from '@/lib/app-store';
import { DEMO_USERS, ROLES, canApprove, canEditEquipment, canEditMedicine, daysUntil, expiryStatus, facilityName } from '@/lib/constants';
import { REASONS, allowedRequestKinds } from '@/lib/request-policy';
import { mayReceive } from '@/lib/workflow';

const money = (value) => new Intl.NumberFormat('en-IN').format(value);
const date = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const badge = (text, level = 'neutral') => <span className={`badge badge-${level}`}>{text}</span>;
const requestStatus = (status) => ({ pending: 'warning', shortage_review: 'danger', counter_offered: 'warning', approved: 'info', rejected: 'danger', declined: 'neutral', completed: 'success', dispatched:'info', on_loan:'info', return_in_transit:'warning', returned:'success', cancelled:'neutral', disputed:'danger' }[status] || 'neutral');
const equipmentStatus = (status) => ({ available: 'success', reserved: 'warning', maintenance: 'danger', in_use: 'info', loaned:'info', in_transit:'warning', return_in_transit:'warning' }[status] || 'neutral');
const titleCase = (v) => String(v || '').replaceAll('_',' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Toast({ text, onClose }) { return text ? <div className="toast" role="status"><Check size={17}/>{text}<button className="icon-button" onClick={onClose} aria-label="Dismiss"><X size={15}/></button></div> : null; }
function Modal({ title, children, onClose }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></header>{children}</section></div>; }
function Empty({ text }) { return <div className="empty"><Boxes size={26}/><p>{text}</p></div>; }

function SignIn() {
  const { logIn, registerAccount, error, mode } = useApp();
  const [register, setRegister] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite');
    if (invite) { setInviteToken(invite); setRegister(true); }
  }, []);
  const submit = async (event) => {
    event.preventDefault(); setWaiting(true); setLocalError('');
    try {
      if(register) await registerAccount({inviteToken,email,name,password});
      else await logIn(email,password);
    } catch(e) {setLocalError(e.message);} finally {setWaiting(false);}
  };
  return <main className="signin-shell"><div className="signin-layout"><div className="signin-story"><div className="signin-wordmark"><span className="brand-symbol"><HeartPulse size={23}/></span> MediMesh</div><div className="signin-story-content"><span className="story-eyebrow">CONNECTED HEALTHCARE OPERATIONS</span><h2>Resources in sync. <em>Care in motion.</em></h2><p>One secure workspace to coordinate medical inventory, device availability and transfers across your facility network.</p><div className="signin-story-points"><span><ShieldCheck size={17}/> Facility-based access</span><span><Activity size={17}/> Live resource visibility</span><span><ArrowLeftRight size={17}/> Traceable transfers</span></div></div><div className="story-footer">MEDIMESH / RESOURCE NETWORK</div></div><div className="signin-form-area"><form className="signin-card" onSubmit={submit}><span className="signin-kicker">YOUR WORKSPACE</span><h1>{register?'Create your account':'Welcome back'}</h1><p>{register?'Complete your invitation to join an approved facility.':'Sign in to coordinate resources across your connected hospitals.'}</p><div className="auth-switch"><button type="button" className={!register?'selected':''} onClick={()=>{setRegister(false);setLocalError('');}}>Sign in</button><button type="button" className={register?'selected':''} onClick={()=>{setRegister(true);setLocalError('');}}>Create account</button></div>{(localError||error) && <div className="form-error" role="alert">{localError||error}</div>}{register && <><label>Invitation code<input required value={inviteToken} onChange={e=>setInviteToken(e.target.value.trim())} placeholder="Paste your invitation code" autoComplete="off"/></label><label>Full name<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name"/></label></>}<label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email"/></label><label>Password<input required minLength={register?12:undefined} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={register?'At least 12 characters':'Your password'} autoComplete={register?'new-password':'current-password'}/></label><button disabled={waiting} className="primary full" type="submit">{waiting?(register?'Creating account…':'Signing in…'):(register?'Create account':'Sign in')} <ArrowUpRight size={16}/></button><small>{register?'Registration requires an invitation from a hospital or regional administrator. Your role and facility are assigned securely.':'Need an account? Ask your hospital administrator for an invitation.'}</small></form></div></div></main>;
}

function InviteForm({ onClose, notify, onInvited }) {
  const {user,data,sendInvite,mode} = useApp();
  const [email,setEmail] = useState('');
  const [role,setRole] = useState('pharmacist');
  const [facilityId,setFacilityId] = useState(user.facilityId || data.facilities[0]?.id || '');
  const [invitation,setInvitation] = useState(null);
  const [busy,setBusy] = useState(false);
  const roles=user.role==='regional_admin'?[['hospital_admin','Hospital administrator'],['pharmacist','Pharmacist'],['engineer','Biomedical engineer']]:[['pharmacist','Pharmacist'],['engineer','Biomedical engineer']];
  const submit=async e=>{e.preventDefault();setBusy(true);try{const result=await sendInvite({email,role,facilityId});setInvitation(result);onInvited?.();notify('Invitation created. Share the code securely with the intended recipient.');}catch(err){notify(err.message,true);}finally{setBusy(false);}};
  return <Modal title="Invite a team member" onClose={onClose}>{mode==='demo'?<div className="dialog-note">Invitations are available after connecting Firebase Authentication.</div>:invitation?<div className="invite-success"><div className="success-icon"><Check size={21}/></div><h3>Invitation ready</h3><p>For <strong>{invitation.email}</strong> · Expires in 7 days. Send this code privately to the recipient.</p><label>One-time invitation code<textarea rows={3} readOnly value={invitation.inviteToken}/></label><button type="button" className="primary" onClick={async()=>{try{await navigator.clipboard.writeText(invitation.inviteToken);notify('Invitation code copied.');}catch{notify('Select and copy the invitation code above.',true);}}}><Copy size={15}/> Copy invitation code</button><p className="hint">The new user opens MediMesh, chooses Create account and enters their invited email and this code. The code is not shown again after closing this window.</p></div>:<form className="form-grid" onSubmit={submit}><label className="field-wide">Team member email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="colleague@hospital.org"/></label><label>Assigned role<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Facility<select value={facilityId} disabled={user.role!=='regional_admin'} required onChange={e=>setFacilityId(e.target.value)}>{data.facilities.filter(f=>f.active!==false).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><p className="hint field-wide">Only authorized administrators can issue invitations. New accounts cannot choose their own role or hospital.</p><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!facilityId}>{busy?'Creating…':'Create invitation'}</button></div></form>}</Modal>;
}

function FacilityCreateForm({onClose,notify}) {
  const {createFacility}=useApp();
  const [name,setName]=useState('');const [city,setCity]=useState('Delhi');const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);try{await createFacility({name,city});notify('Facility added to the regional network.');onClose();}catch(err){notify(err.message,true);}finally{setBusy(false);}};
  return <Modal title="Register a facility" onClose={onClose}><form className="form-grid" onSubmit={submit}><label className="field-wide">Hospital or facility name<input required minLength={3} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Central District Hospital"/></label><label className="field-wide">City<input required minLength={2} maxLength={70} value={city} onChange={e=>setCity(e.target.value)}/></label><p className="hint field-wide">After adding a facility, invite its hospital administrator from Team & access. Staff can then register medicine batches and equipment.</p><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy?'Registering…':'Register facility'}</button></div></form></Modal>;
}

function StaffPanel({notify,onInvite}) {
  const {user,mode,getTeam,setTeamStatus,data}=useApp();
  const [people,setPeople]=useState([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  useEffect(()=>{let live=true;if(mode!=='firebase')return;setLoading(true);getTeam().then(result=>{if(live)setPeople(result.users||[]);}).catch(err=>{if(live)setError(err.message);}).finally(()=>{if(live)setLoading(false);});return ()=>{live=false;};},[getTeam,mode]);
  const visible=people.filter(u=>filter==='all'||u.facilityId===filter);
  const changeStatus=async target=>{if(!window.confirm(`${target.active?'Deactivate':'Activate'} ${target.email}?`))return;try{await setTeamStatus(target.uid,!target.active);setPeople(old=>old.map(p=>p.uid===target.uid?{...p,active:!p.active}:p));notify(`Account ${target.active?'deactivated':'activated'}.`);}catch(e){notify(e.message,true);}};
  return <section className="panel team-panel"><div className="panel-header"><div><h2>Team directory</h2><p>Authorized staff accounts assigned to participating facilities.</p></div><button className="primary" onClick={onInvite}><UserPlus size={16}/> Invite staff</button></div>{user.role==='regional_admin'&&<div className="facility-filter-bar"><ListFilter size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All facilities</option>{data.facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}{mode!=='firebase'?<Empty text="Team account management is available in Firebase mode."/>:loading?<Empty text="Loading team accounts…"/>:error?<div className="form-error">{error}</div>:<div className="table-wrap"><table><thead><tr><th>Team member</th><th>Role</th><th>Facility</th><th>Status</th><th>Manage</th></tr></thead><tbody>{visible.map(u=><tr key={u.uid}><td className="cell-main">{u.name||u.email}<small>{u.email}</small></td><td>{ROLES[u.role]||u.role}</td><td>{facilityName(u.facilityId,data.facilities)}</td><td>{badge(u.active?'Active':'Inactive',u.active?'success':'warning')}</td><td>{u.uid!==user.uid&&u.role!=='regional_admin'&&(user.role==='regional_admin'||(u.facilityId===user.facilityId&&['engineer','pharmacist'].includes(u.role)))?<button className={`tiny-action ${u.active?'reject':'accept'}`} onClick={()=>changeStatus(u)}>{u.active?'Deactivate':'Activate'}</button>:<span className="muted">—</span>}</td></tr>)}</tbody></table>{visible.length===0&&<Empty text="No team accounts found. Invite a team member to get started."/>}</div>}</section>;
}

function FacilityExplorer({data,user,onRequest}) {
  const [selectedId,setSelectedId]=useState('');
  const [kind,setKind]=useState('all');
  const [term,setTerm]=useState('');
  const active=data.facilities.filter(f=>f.active!==false);
  const current=active.find(f=>f.id===selectedId)||active[0];
  const canRequest=allowedRequestKinds(user.role);
  const medicines=data.medicines.filter(x=>x.facilityId===current?.id && `${x.name} ${x.batchNumber}`.toLowerCase().includes(term.toLowerCase()));
  const equipment=data.equipment.filter(x=>x.facilityId===current?.id && `${x.name} ${x.assetTag}`.toLowerCase().includes(term.toLowerCase()));
  return <div className="directory-layout"><section className="directory-intro"><div><span className="section-kicker">LIVE NETWORK DIRECTORY</span><h2>Find a facility. Explore its resources.</h2><p>Select a hospital to see the actual medicine batches and equipment it has registered. Submit a request directly to the selected supplier.</p></div><span className="directory-count"><Building2 size={17}/> {active.length} facilities connected</span></section><div className="directory-columns"><div className="facility-directory-list">{active.map(f=>{const meds=data.medicines.filter(x=>x.facilityId===f.id);const eq=data.equipment.filter(x=>x.facilityId===f.id);return <button type="button" key={f.id} className={`facility-directory-card ${current?.id===f.id?'selected':''}`} onClick={()=>{setSelectedId(f.id);setTerm('');setKind('all');}}><span className="facility-directory-icon"><Building2 size={22}/></span><span className="facility-directory-copy"><strong>{f.name}</strong><small>{f.city} {f.id===user.facilityId?'· Your facility':''}</small><span>{meds.length} medicine batches <i/> {eq.length} equipment assets</span></span><ArrowUpRight size={16}/></button>;})}{active.length===0&&<Empty text="No facilities are registered yet."/>}</div><section className="facility-resources-panel">{current?<><div className="facility-resources-heading"><div><span className="section-kicker">FACILITY INVENTORY</span><h3>{current.name}</h3><p>{current.city} · {current.id===user.facilityId?'Your assigned facility':'External supplier'}</p></div><span className="facility-status-dot">Live</span></div><div className="directory-toolbar"><div className="directory-pills">{[['all','All'],['medicine','Medicines'],['equipment','Equipment']].map(([key,label])=><button type="button" key={key} className={kind===key?'active':''} onClick={()=>setKind(key)}>{label}</button>)}</div><div className="search-wrap"><Search size={15}/><input aria-label="Search facility resources" placeholder="Search resources" value={term} onChange={e=>setTerm(e.target.value)}/></div></div><div className="directory-resource-list">{(kind==='all'||kind==='medicine')&&medicines.map(m=>{const available=Math.max(0,Number(m.quantity||0)-Number(m.reservedQuantity||0));const expired=daysUntil(m.expiryDate)<0;const requestable=current.id!==user.facilityId && canRequest.includes('medicine')&&!expired;return <div key={'m'+m.id} className="directory-resource-row"><span className="resource-type-icon medicine"><Pill size={18}/></span><div><strong>{m.name}</strong><small>Medicine · Batch {m.batchNumber} · {expired?'Expired':`${available} free / ${m.quantity} total`}</small></div><span className={`resource-availability ${expired?'blocked':available>0?'available':'limited'}`}>{expired?'Expired':available>0?'Available':'Low stock'}</span>{requestable&&<button className="tiny-action accept" onClick={()=>onRequest(current.id,'medicine',m.id)}>Request</button>}</div>;})}{(kind==='all'||kind==='equipment')&&equipment.map(e=>{const ready=e.status==='available'&&daysUntil(e.nextMaintenance)>=0;return <div key={'e'+e.id} className="directory-resource-row"><span className="resource-type-icon equipment"><Stethoscope size={18}/></span><div><strong>{e.name}</strong><small>Equipment · {e.assetTag} · {titleCase(e.status)}</small></div><span className={`resource-availability ${ready?'available':'blocked'}`}>{ready?'Available':'Unavailable'}</span>{current.id!==user.facilityId&&canRequest.includes('equipment')&&ready&&<button className="tiny-action accept" onClick={()=>onRequest(current.id,'equipment',e.id)}>Request</button>}</div>;})}{(kind==='all'?(medicines.length+equipment.length===0):kind==='medicine'?medicines.length===0:equipment.length===0)&&<Empty text="No matching resources registered at this facility."/>}</div></>:<Empty text="Select a facility to browse its resources."/>}</section></div></div>;
}

function MedicineForm({ onClose, notify }) {
  const { user, addMedicine } = useApp();
  const [form, setForm] = useState({ name: '', batchNumber: '', category: 'Tablet', quantity: '100', minStock: '20', expiryDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((v) => ({ ...v, [key]: value }));
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await addMedicine({ ...form, name: form.name.trim(), batchNumber: form.batchNumber.trim(), quantity: Number(form.quantity), minStock: Number(form.minStock), facilityId: user.facilityId }); notify('Medicine batch added.'); onClose(); } catch(e) { notify(e.message, true); } finally { setBusy(false); } };
  return <Modal title="Register medicine batch" onClose={onClose}><form onSubmit={submit} className="form-grid"><label className="field-wide">Medicine name<input required maxLength={120} value={form.name} onChange={(e) => set('name',e.target.value)} placeholder="e.g. Paracetamol 500 mg"/></label><label>Batch number<input required maxLength={70} value={form.batchNumber} onChange={(e) => set('batchNumber',e.target.value)} placeholder="BATCH-001"/></label><label>Category<select value={form.category} onChange={(e) => set('category',e.target.value)}>{['Tablet','Capsule','IV Fluid','Vaccine','Injection','Syrup','Other'].map((c) => <option key={c}>{c}</option>)}</select></label><label>Quantity<input required type="number" min="0" step="1" value={form.quantity} onChange={(e) => set('quantity',e.target.value)}/></label><label>Minimum stock alert<input required type="number" min="0" step="1" value={form.minStock} onChange={(e) => set('minStock',e.target.value)}/></label><label className="field-wide">Expiry date<input required type="date" value={form.expiryDate} onChange={(e) => set('expiryDate',e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy}>Save medicine</button></div></form></Modal>;
}
function EquipmentForm({ onClose, notify }) {
  const { user, addEquipment } = useApp();
  const [form, setForm] = useState({ name: '', assetTag: '', category: 'Diagnostics', nextMaintenance: '' });
  const [busy,setBusy] = useState(false);
  const set = (key, value) => setForm((v) => ({ ...v, [key]: value }));
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await addEquipment({ ...form, facilityId: user.facilityId }); notify('Equipment registered.'); onClose(); } catch(e) { notify(e.message, true); } finally { setBusy(false); } };
  return <Modal title="Register equipment" onClose={onClose}><form onSubmit={submit} className="form-grid"><label className="field-wide">Equipment name<input required maxLength={120} value={form.name} onChange={(e) => set('name',e.target.value)} placeholder="e.g. Oxygen Concentrator"/></label><label>Asset tag<input required maxLength={60} value={form.assetTag} onChange={(e) => set('assetTag',e.target.value)} placeholder="EQ-001"/></label><label>Category<select value={form.category} onChange={(e) => set('category',e.target.value)}>{['Diagnostics','Respiratory','Imaging','Monitoring','Other'].map((x) => <option key={x}>{x}</option>)}</select></label><label className="field-wide">Next maintenance date<input required type="date" value={form.nextMaintenance} onChange={(e) => set('nextMaintenance',e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className="primary">Save equipment</button></div></form></Modal>;
}
function RequestForm({ onClose, notify, onCreated, initialFacilityId='', initialKind='', initialResourceId='' }) {
  const { user, data, createRequest } = useApp();
  const permittedKinds = allowedRequestKinds(user.role);
  const availableFacilities = data.facilities.filter(f => f.id !== user.facilityId && f.active!==false);
  const [facilityId,setFacilityId] = useState(initialFacilityId || '');
  const [kind,setKind] = useState(() => permittedKinds.includes(initialKind)?initialKind:(permittedKinds[0]||'medicine'));
  const [resourceId,setResourceId] = useState(initialResourceId);
  const [quantity,setQuantity] = useState('1');
  const [reason,setReason] = useState('restock');
  const [note,setNote] = useState('');
  const [loanDueDate,setLoanDueDate] = useState('');
  const [busy,setBusy] = useState(false);
  const resources = !facilityId?[]:kind==='equipment'
    ?data.equipment.filter(e=>e.facilityId===facilityId&&e.status==='available'&&daysUntil(e.nextMaintenance)>=0)
    :data.medicines.filter(m=>m.facilityId===facilityId&&daysUntil(m.expiryDate)>=0);
  const selected = resources.find(x=>x.id===resourceId);
  const free = selected && kind==='medicine'?Math.max(0,Number(selected.quantity||0)-Number(selected.reservedQuantity||0)):0;
  const shortage=kind==='medicine'&&selected&&Number(quantity)>free;
  const priority=['critical','pediatric'].includes(reason)?'high':reason==='restock'?'low':'medium';
  const submit=async e=>{
    e.preventDefault();
    if(!facilityId||!resourceId||!selected||selected.facilityId!==facilityId){notify('Choose a valid supplier and resource.',true);return;}
    if(!permittedKinds.includes(kind)){notify('Your role cannot request this resource type.',true);return;}
    setBusy(true);
    try{
      await createRequest({kind,fromFacilityId:facilityId,resourceId,quantity:kind==='equipment'?1:Number(quantity),reason,note,loanDueDate});
      notify(shortage?'Request submitted. The supplier can propose a smaller quantity.':'Request sent to '+facilityName(facilityId,data.facilities)+'.');
      onClose();onCreated?.();
    }catch(err){notify(err.message,true);}finally{setBusy(false);}
  };
  return <Modal title="New resource request" onClose={onClose}><form onSubmit={submit} className="form-grid">
    <div className="field-wide form-section-label"><span>01</span> Select supplying facility</div>
    <label className="field-wide">Send request to<select required value={facilityId} onChange={e=>{setFacilityId(e.target.value);setResourceId('');}}><option value="">Choose a hospital</option>{availableFacilities.map(f=><option key={f.id} value={f.id}>{f.name} · {f.city}</option>)}</select><small>Only the selected facility can approve and dispatch this request.</small></label>
    <div className="field-wide form-section-label"><span>02</span> Choose available resource</div>
    <label className="field-wide">Resource type<select disabled={permittedKinds.length===1} value={kind} onChange={e=>{setKind(e.target.value);setResourceId('');}}>{permittedKinds.includes('medicine')&&<option value="medicine">Medicine batch</option>}{permittedKinds.includes('equipment')&&<option value="equipment">Medical equipment</option>}</select></label>
    <label className="field-wide">Resource at {facilityName(facilityId,data.facilities)}<select required disabled={!facilityId} value={resourceId} onChange={e=>setResourceId(e.target.value)}><option value="">{facilityId?'Choose a resource':'Select facility first'}</option>{resources.map(r=><option key={r.id} value={r.id}>{r.name}{kind==='medicine'?` · ${Math.max(0,r.quantity-(r.reservedQuantity||0))} free`:''}</option>)}</select>{facilityId&&resources.length===0&&<small>No eligible {kind} resources at this facility.</small>}</label>
    {kind==='medicine'&&<><label>Quantity requested<input required type="number" min="1" max="100000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><div className="stock-indicator"><strong>{selected?`${free} units available`:'Select a medicine batch'}</strong><small>{shortage?`Short by ${Number(quantity)-free} units · partial offer possible`:'Stock will be rechecked during approval'}</small></div></>}
    {kind==='equipment'&&<label className="field-wide">Expected return date<input required type="date" value={loanDueDate} onChange={e=>setLoanDueDate(e.target.value)}/><small>Equipment remains owned by the supplying hospital.</small></label>}
    <div className="field-wide form-section-label"><span>03</span> Set request urgency</div>
    <label className="field-wide">Request purpose<select value={reason} onChange={e=>setReason(e.target.value)}>{Object.entries(REASONS).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
    <div className="field-wide priority-preview"><span>Operational priority</span><span className={`priority-chip priority-${priority}`}>{priority.toUpperCase()}</span><div className={`priority-meter priority-${priority}`}><i/></div><small>High priority is suggested for critical or pediatric cases. Use an operational purpose without patient-identifiable details.</small></div>
    <label className="field-wide">Justification / coordination notes<textarea maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe the reason for your request; avoid patient details."/></label>
    <p className="hint field-wide">Approval reserves supply; dispatch updates source stock; the receiving facility confirms delivery. All decisions are recorded in request history.</p>
    <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={!facilityId||!resourceId||busy} className="primary">{busy?'Submitting…':'Send resource request'}</button></div>
  </form></Modal>;
}

const NAV = [
  {id:'overview',name:'Overview',icon:LayoutDashboard},
  {id:'medicines',name:'Medicines',icon:Pill},
  {id:'equipment',name:'Equipment',icon:Stethoscope},
  {id:'requests',name:'Transfer requests',icon:ArrowLeftRight},
  {id:'notifications',name:'Notifications',icon:Bell},
  {id:'activity',name:'Activity & audit',icon:History},
  {id:'maintenance',name:'Maintenance',icon:Wrench},
  {id:'facilities',name:'Facility resources',icon:Building2},
  {id:'staff',name:'Team & access',icon:UsersRound}
];
const ROLE_NAV={
 pharmacist:['overview','medicines','requests','notifications','activity','facilities'],
 engineer:['overview','equipment','requests','maintenance','notifications','activity','facilities'],
 hospital_admin:['overview','medicines','equipment','requests','notifications','activity','facilities','staff'],
 regional_admin:['overview','medicines','equipment','requests','notifications','activity','maintenance','facilities','staff']
};
function Dashboard() {
  const app = useApp();
  const { user, data, mode, selectDemoUser, resetDemo, logOut, error } = app;
  const [tab,setTab] = useState('overview');
  const [modal,setModal] = useState('');
  const [search,setSearch] = useState('');
  const [scope,setScope] = useState('all');
  const [requestFilter,setRequestFilter] = useState('all');
  const [toast,setToast] = useState('');
  const [toastIsError,setToastIsError] = useState(false);
  const [mobileNav,setMobileNav] = useState(false);
  const [navCollapsed,setNavCollapsed] = useState(false);
  const [busyRequest,setBusyRequest] = useState('');
  const [requestTarget,setRequestTarget] = useState({facilityId:'',kind:'',resourceId:''});
  const [teamRefresh,setTeamRefresh] = useState(0);
  const notify = (message, isError = false) => { setToast(message); setToastIsError(isError); };
  const own = (facilityId) => user.facilityId === facilityId;
  const admin = user.role === 'regional_admin';
  const canRequest = allowedRequestKinds(user.role).length > 0;
  const roleNav=NAV.filter(n=>ROLE_NAV[user.role]?.includes(n.id));
  useEffect(()=>{if(!ROLE_NAV[user.role]?.includes(tab))setTab('overview');},[user.role,tab]);
  const notifications=[...(data.notifications||[])].filter(n=>n.recipientUid===user.uid).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const unread=notifications.filter(n=>!n.isRead).length;
  const ownActivities=[...(data.inventoryMovements||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const maintenanceEvents=[...(data.maintenanceRecords||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const medicine = useMemo(() => data.medicines.filter((m) => (scope !== 'mine' || own(m.facilityId)) && `${m.name} ${m.batchNumber} ${facilityName(m.facilityId,data.facilities)}`.toLowerCase().includes(search.toLowerCase())), [data,search,scope,user]);
  const equipment = useMemo(() => data.equipment.filter((e) => (scope !== 'mine' || own(e.facilityId)) && `${e.name} ${e.assetTag} ${facilityName(e.facilityId,data.facilities)}`.toLowerCase().includes(search.toLowerCase())), [data,search,scope,user]);
  const allRequests = useMemo(() => data.requests.filter((r) => (admin || [r.toFacilityId,r.fromFacilityId].includes(user.facilityId)) && (user.role!=='pharmacist'||r.kind==='medicine') && (user.role!=='engineer'||r.kind==='equipment') && `${r.resourceName} ${r.status} ${facilityName(r.fromFacilityId,data.facilities)} ${facilityName(r.toFacilityId,data.facilities)}`.toLowerCase().includes(search.toLowerCase())), [data,search,user]);
  const requests = useMemo(() => allRequests.filter(r => admin || requestFilter === 'all' || (requestFilter === 'incoming' ? r.fromFacilityId === user.facilityId : r.toFacilityId === user.facilityId)).sort((a,b)=>({high:3,medium:2,low:1}[b.priority]||0)-({high:3,medium:2,low:1}[a.priority]||0) || String(b.createdAt||'').localeCompare(String(a.createdAt||''))), [allRequests,requestFilter,user,admin]);
  const expiring = data.medicines.filter((m) => daysUntil(m.expiryDate) <= 60);
  const lowStock = data.medicines.filter((m) => m.quantity - (m.reservedQuantity || 0) < (m.minStock || 0));
  const sentRequests = allRequests.filter(r => r.toFacilityId === user.facilityId);
  const receivedRequests = allRequests.filter(r => r.fromFacilityId === user.facilityId);
  const pending = allRequests.filter((r) => ['pending','shortage_review','counter_offered','approved','dispatched','on_loan','return_in_transit','disputed'].includes(r.status));
  const awaitingMyDecision = allRequests.filter((r) => ((['pending','shortage_review','approved','return_in_transit'].includes(r.status)) && canApprove(user,r)) || (['counter_offered'].includes(r.status) && (r.requestedBy===user.uid || user.role==='hospital_admin' && r.toFacilityId===user.facilityId)) || (['dispatched','on_loan'].includes(r.status) && mayReceive(user,r)));
  const myCounterOffers = allRequests.filter(r => r.status === 'counter_offered' && r.requestedBy === user.uid);
  const myShortages = allRequests.filter(r => r.status === 'shortage_review' && r.toFacilityId === user.facilityId);
  const overviewCards = [
    {label:'Medicine batches',value: data.medicines.length,icon:Pill,sub:`${expiring.length} expiring within 60 days`, tone:'purple'},
    {label:'Medical equipment',value:data.equipment.length,icon:Stethoscope,sub:`${data.equipment.filter((e)=>e.status==='available').length} available`,tone:'blue'},
    {label:'Pending transfers',value:pending.length,icon:ArrowLeftRight,sub:'Awaiting source facility action',tone:'orange'},
    {label:'Connected facilities',value:data.facilities.length,icon:Building2,sub:'In regional resource network',tone:'teal'}
  ];
  const act = async (id,action,options={}) => { setBusyRequest(id); try { await app.decideRequest(id,action,options); notify(action === 'counter_offer' ? 'Partial-stock offer sent to requesting facility.' : action === 'accept_offer' ? 'Offer accepted; stock reserved pending dispatch.' : `Request action completed: ${titleCase(action)}.`); } catch(e) { notify(e.message,true); } finally { setBusyRequest(''); } };
  const counterOffer = r => {
    const stock = data.medicines.find(m=>m.id===r.resourceId);
    const free = Math.max(0, Number(stock?.quantity || 0) - Number(stock?.reservedQuantity || 0));
    if (free < 1) { notify('No unreserved stock is available to offer.',true); return; }
    const reply = window.prompt(`Requested: ${r.quantity} units. Available: ${free}. How many units can you offer?`,String(Math.min(free,r.quantity-1)));
    if (reply === null) return;
    const amount = Number(reply);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount >= r.quantity || amount > free) { notify(`Enter a whole number between 1 and ${Math.min(free,r.quantity-1)}.`,true); return; }
    act(r.id,'counter_offer',{offeredQuantity:amount});
  };
  const qty = async (item) => { const raw = window.prompt(`Update quantity of ${item.name} (reserved: ${item.reservedQuantity || 0})`, String(item.quantity)); if (raw === null) return; const value = Number(raw); if (!Number.isSafeInteger(value) || value < 0) return notify('Please enter a non-negative whole number.',true); try { await app.updateMedicineQuantity(item.id,value); notify('Quantity updated.'); } catch(e) { notify(e.message,true); } };
  const completeService = async item => { const nextMaintenance=window.prompt('Next maintenance date (YYYY-MM-DD):');if(!nextMaintenance)return;const note=window.prompt('Inspection outcome and service notes:');if(!note?.trim())return;try{await app.serviceEquipment(item.id,nextMaintenance,note);notify('Service completed and device available.');}catch(e){notify(e.message,true);} };
  const changeStatus = async (item,event) => { const note=item.status==='maintenance'&&event.target.value==='available' ? window.prompt('Maintenance completion note:') : ''; if(note===null)return; try { await app.updateEquipmentStatus(item.id,event.target.value,note||''); notify('Asset status updated.'); } catch(e) { notify(e.message,true); } };
  const openRequest=(facilityId='',kind='',resourceId='')=>{setRequestTarget({facilityId,kind,resourceId});setModal('request');};
  const openTab = (id) => { if(!ROLE_NAV[user.role]?.includes(id))return; setTab(id); setSearch(''); setScope('all'); if(id==='requests') setRequestFilter('all'); setMobileNav(false); };
  const exportCSV = () => {
    const rows = tab === 'medicines'
      ? [['Medicine','Batch','Facility','Quantity','Reserved','Expiry'], ...medicine.map(m=>[m.name,m.batchNumber,facilityName(m.facilityId,data.facilities),m.quantity,m.reservedQuantity||0,m.expiryDate])]
      : tab === 'equipment'
      ? [['Equipment','Asset tag','Facility','Category','Status','Maintenance due'],...equipment.map(e=>[e.name,e.assetTag,facilityName(e.facilityId,data.facilities),e.category,e.status,e.nextMaintenance])]
      : [['Resource','Kind','From','To','Quantity','Status'], ...requests.map(r=>[r.resourceName,r.kind,facilityName(r.fromFacilityId,data.facilities),facilityName(r.toFacilityId,data.facilities),r.quantity,r.status])];
    const csv = rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download=`medimesh-${tab}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    notify('CSV report downloaded.');
  };
  const availableAssets = data.equipment.filter(e=>e.status==='available').length;
  const totalAssets = data.equipment.length;
  const totalUnits = data.medicines.reduce((sum,m)=>sum+Math.max(0,(m.quantity||0)-(m.reservedQuantity||0)),0);
  const inventoryByFacility = data.facilities.map(f=>({ ...f, medicines:data.medicines.filter(m=>m.facilityId===f.id).length, equipment:data.equipment.filter(e=>e.facilityId===f.id).length }));
  const maxResources = Math.max(1,...inventoryByFacility.map(f=>f.medicines+f.equipment));
  return <div className="app-shell">
    <aside id="medimesh-sidebar" className={`sidebar ${mobileNav ? 'sidebar-open' : ''} ${navCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand"><span className="brand-symbol"><HeartPulse size={23} strokeWidth={2.5}/></span><span className="brand-copy"><strong>MediMesh</strong><small>Healthcare Resource Grid</small></span><button type="button" className="icon-button sidebar-close" onClick={()=>setMobileNav(false)} title="Close navigation" aria-label="Close navigation"><X size={19}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav">{roleNav.map(({id,name,icon:Icon}) => <button key={id} className={`nav-link ${tab===id?'active':''}`} onClick={()=>openTab(id)} title={name} aria-current={tab===id ? 'page' : undefined}><Icon size={18}/><span className="nav-label">{name}</span>{id==='notifications' && unread>0 && <span className="nav-counter">{unread}</span>}{id==='requests' && allRequests.length>0 && <span className="nav-counter" title={`${allRequests.length} visible requests; ${awaitingMyDecision.length} awaiting your action`}>{allRequests.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-info"><ShieldCheck size={17}/><span className="sidebar-info-copy">Protected network<small>Access-controlled workspace</small></span></div><div className="sidebar-user"><span className="avatar">{user.name?.split(' ').slice(0,2).map(x=>x[0]).join('') || 'U'}</span><div className="sidebar-user-copy"><strong>{user.name}</strong><small>{ROLES[user.role]}</small></div>{mode==='firebase' && <button title="Sign out" className="icon-button" onClick={logOut}><LogOut size={17}/></button>}</div></div>
    </aside>
    {mobileNav && <button className="mobile-shade" aria-label="Close menu" onClick={()=>setMobileNav(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button type="button" className="icon-button nav-toggle" onClick={()=>{if(window.matchMedia('(max-width:760px)').matches){setMobileNav(v=>!v);}else{setNavCollapsed(v=>!v);}}} aria-controls="medimesh-sidebar" aria-label="Toggle navigation" title="Toggle navigation"><Menu size={21}/></button><span className="breadcrumb">Workspace</span><span className="slash">/</span><span>{roleNav.find((n)=>n.id===tab)?.name}</span></div><div className="topbar-right"><button type="button" className="notification-bell" title="Open notifications" aria-label={`Notifications: ${unread} unread`} onClick={()=>openTab('notifications')}><Bell size={18}/>{unread>0 && <span>{unread}</span>}</button><span className="live-dot"/> <span className="top-live">{mode==='firebase'?'Cloud connected':'Local demo'}</span>{mode === 'demo' && <select aria-label="Demo user" className="role-switch" value={user.uid} onChange={(e)=>selectDemoUser(e.target.value)}>{DEMO_USERS.map((u)=><option key={u.uid} value={u.uid}>{ROLES[u.role]} · {u.name}</option>)}</select>}</div></header>
      <div className="page-body">{error&&<div className="form-error" role="alert">Firebase synchronization error: {error}</div>}
        <div className="page-heading"><div><div className="eyebrow">REGIONAL HEALTHCARE NETWORK</div><h1>{({overview:'Resource overview',medicines:'Medicine inventory',equipment:'Equipment registry',requests:'Resource transfers',facilities:'Facility resource directory',staff:'Team & access',notifications:'Notification center',activity:'Stock & transfer activity',maintenance:'Maintenance records'})[tab]}</h1><p>{tab==='overview'?'A unified view of healthcare assets, stock health, and inter-facility coordination.':tab==='medicines'?'Track batch-level expiry, available quantities, and medicine stock across facilities.':tab==='equipment'?'Monitor available devices and maintenance schedules across the network.':tab==='requests'?'Coordinate inter-facility reservations and record transfer approvals.':tab==='notifications'?'Persistent updates from all relevant facility actions.':tab==='activity'?'Audit evidence for inventory and transfer actions.':tab==='maintenance'?'Equipment maintenance and return inspections.':tab==='staff'?'Manage approved team accounts and invite new colleagues.':'Explore live resources for each facility and send requests to the right supplier.'}</p></div><div className="page-actions">{tab==='medicines' && !admin && user.role==='pharmacist' && <button className="primary" onClick={()=>setModal('medicine')}><Plus size={16}/> Add batch</button>}{tab==='equipment' && !admin && user.role==='engineer' && <button className="primary" onClick={()=>setModal('equipment')}><Plus size={16}/> Add equipment</button>}{tab==='requests' && canRequest && <button className="primary" onClick={()=>openRequest()}><Plus size={16}/> New request</button>}{tab==='facilities' && admin && mode==='firebase' && <button className="primary" onClick={()=>setModal('facility')}><Plus size={16}/> Register facility</button>}{tab==='staff' && mode==='firebase' && <button className="primary" onClick={()=>setModal('invite')}><UserPlus size={16}/> Invite staff</button>}</div></div>
        {mode === 'demo' && <div className="demo-note"><CircleAlert size={17}/><span><strong>Demo mode:</strong> Sample healthcare resources are fictitious. Changes persist in this browser. Switch roles above to test approvals. Firebase mode supports actual cross-browser real-time updates.</span><button onClick={()=>{if(window.confirm('Reset the demo data?')){resetDemo();notify('Demo reset.');}}}><RefreshCw size={14}/> Reset</button></div>}
        {tab==='overview' && <>
          {myCounterOffers.length > 0 && <section className="offer-notice"><strong>Supplier response received</strong><p>{myCounterOffers.length} supplier offer(s) need your decision. A facility has less stock than requested and is offering a reduced quantity.</p><button type="button" className="primary" onClick={()=>{openTab('requests');setRequestFilter('outgoing');}}>Review offers</button></section>}
          {myShortages.length > 0 && <section className="offer-notice notice-muted"><strong>Stock shortage update</strong><p>{myShortages.length} request(s) cannot currently be fulfilled in full. The supplying facility can propose an alternative quantity.</p><button type="button" className="secondary" onClick={()=>{openTab('requests');setRequestFilter('outgoing');}}>View requests</button></section>}
          <section className="overview-hero">
            <div className="hero-copy"><span className="hero-kicker"><Sparkles size={14}/> MEDIMESH CONTROL CENTER</span><h2>Better care starts with <em>connected resources.</em></h2><p>Coordinate medicine availability, medical equipment and facility requests from a single secure workspace.</p><div className="hero-buttons"><button onClick={()=>openTab('requests')} className="hero-primary"><ArrowLeftRight size={16}/> View transfers <ArrowUpRight size={15}/></button><button onClick={()=>openTab('facilities')} className="hero-secondary"><Building2 size={16}/> Explore network</button></div></div>
            <div className="hero-visual" aria-label="Network health summary"><div className="hero-circle hero-circle-back"/><div className="hero-circle hero-circle-front"/><div className="hero-network-card"><span className="hero-network-icon"><Activity size={22}/></span><small>Network resources</small><strong>{money(data.medicines.length+totalAssets)}</strong><span className="hero-trend"><TrendingUp size={14}/> Across {data.facilities.length} facilities</span></div><div className="hero-orbit hero-orbit-one"><Pill size={19}/></div><div className="hero-orbit hero-orbit-two"><Stethoscope size={19}/></div></div>
          </section>
          <div className="metrics">{overviewCards.map(({label,value,icon:Icon,sub,tone})=><div className="metric" key={label}><div className={`metric-symbol metric-${tone}`}><Icon size={20}/></div><div className="metric-label">{label}</div><div className="metric-value">{money(value)}</div><div className="metric-sub">{sub}</div></div>)}</div>
          <section className="panel request-recent-panel"><div className="panel-header"><div><h2>My hospital request history</h2><p>Persistent records of outgoing and incoming resource requests</p></div><button type="button" className="text-action" onClick={()=>{openTab('requests');setRequestFilter('all');}}>Open request register <ArrowUpRight size={15}/></button></div><div className="recent-request-list">{allRequests.length===0?<Empty text="No requests have been recorded for your hospital yet."/>:[...allRequests].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,5).map(r=><div className="recent-request-row" key={r.id}><div><strong>{r.resourceName}</strong><small>{r.toFacilityId===user.facilityId?'Sent to':'Received from'} {facilityName(r.toFacilityId===user.facilityId?r.fromFacilityId:r.toFacilityId,data.facilities)} · {r.quantity} requested</small></div>{badge(titleCase(r.status),requestStatus(r.status))}</div>)}</div></section>
          <section className="insight-strip" aria-label="Network snapshot"><div><span className="insight-icon"><Activity size={17}/></span><span><strong>{money(totalUnits)} units</strong><small>Medicine stock available</small></span></div><div><span className="insight-icon"><Check size={17}/></span><span><strong>{availableAssets} of {totalAssets}</strong><small>Equipment ready to use</small></span></div><div><span className="insight-icon"><Clock3 size={17}/></span><span><strong>{pending.length} awaiting review</strong><small>Outstanding transfer requests</small></span></div></section>
          <div className="content-grid"><section className="panel"><div className="panel-header"><div><h2>Inventory attention required</h2><p>Stock and expiry signals across the network</p></div><button className="text-action" onClick={()=>openTab('medicines')}>View all <ArrowUpRight size={15}/></button></div><div className="alert-stack">{[...expiring.map((m)=>({id:`e-${m.id}`,name:m.name,desc:`${facilityName(m.facilityId,data.facilities)} · ${daysUntil(m.expiryDate)<0?'Expired':`${daysUntil(m.expiryDate)} days left`}`,level:daysUntil(m.expiryDate)<=30?'danger':'warning'})),...lowStock.map((m)=>({id:`s-${m.id}`,name:m.name,desc:`Low stock · ${m.quantity-(m.reservedQuantity||0)} available units`,level:'warning'}))].slice(0,5).map((a)=><div className="alert-row" key={a.id}><span className={`alert-bubble ${a.level}`}><CircleAlert size={17}/></span><span><strong>{a.name}</strong><small>{a.desc}</small></span>{badge(a.level==='danger'?'Critical':'Attention',a.level)}</div>)}{expiring.length===0 && lowStock.length===0 && <Empty text="No inventory alerts at the moment."/>}</div></section>
          <section className="panel"><div className="panel-header"><div><h2>Transfer pipeline</h2><p>Real-time request coordination</p></div><button className="text-action" onClick={()=>openTab('requests')}>View all <ArrowUpRight size={15}/></button></div><div className="pipeline">{['pending','shortage_review','counter_offered','approved','dispatched','on_loan','return_in_transit','completed','returned','rejected'].map((s)=><div className="pipeline-row" key={s}><span className={`pipeline-indicator ${s}`}/><span>{titleCase(s)}</span><strong>{requests.filter((r)=>r.status===s).length}</strong></div>)}</div><div className="quick-card"><div className="quick-symbol"><Activity size={18}/></div><div><strong>Cloud-ready architecture</strong><small>Firebase Auth · Firestore · Vercel</small></div></div></section></div>
          <section className="panel network-distribution"><div className="panel-header"><div><h2>Network resource distribution</h2><p>Medicine batches and equipment registered per facility</p></div><button className="text-action" onClick={()=>openTab('facilities')}>Facilities <ArrowUpRight size={15}/></button></div><div className="distribution-list">{inventoryByFacility.map(f=><div className="distribution-row" key={f.id}><div className="distribution-title"><strong>{f.name}</strong><span>{f.medicines+f.equipment} resources</span></div><div className="distribution-track"><div className="distribution-meds" style={{width:`${100*f.medicines/maxResources}%`}}/><div className="distribution-equipment" style={{width:`${100*f.equipment/maxResources}%`}}/></div></div>)}</div><div className="distribution-legend"><span><i className="legend-med"/> Medicine batches</span><span><i className="legend-equip"/> Equipment</span></div></section>
          <section className="panel panel-wide"><div className="panel-header"><div><h2>Recently registered resources</h2><p>Snapshot of shared equipment and inventory</p></div></div><div className="table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Facility</th><th>Availability</th></tr></thead><tbody>{[...data.equipment.slice(0,3).map((x)=>({...x,type:'Equipment'})),...data.medicines.slice(0,3).map((x)=>({...x,type:'Medicine'}))].map((r)=><tr key={r.id}><td className="cell-main">{r.name}<small>{r.assetTag || r.batchNumber}</small></td><td>{r.type}</td><td>{facilityName(r.facilityId,data.facilities)}</td><td>{r.type==='Equipment'?badge(titleCase(r.status),equipmentStatus(r.status)):badge(`${r.quantity-(r.reservedQuantity||0)} units`,'info')}</td></tr>)}</tbody></table></div></section>
        </>}
        {(tab==='medicines'||tab==='equipment'||tab==='requests') && <section className="panel panel-table"><div className="panel-toolbar"><div className="search-wrap"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={`Search ${tab}...`} aria-label={`Search ${tab}`}/></div><div className="table-tools">{tab==='requests' && !admin && <select className="filter-select" aria-label="Filter transfer requests" value={requestFilter} onChange={e=>setRequestFilter(e.target.value)}><option value="all">All my requests ({allRequests.length})</option><option value="incoming">Incoming ({receivedRequests.length})</option><option value="outgoing">Sent ({sentRequests.length})</option></select>}<button className="export-button" onClick={exportCSV}><Download size={15}/> Export CSV</button>{tab!=='requests' && <select className="filter-select" value={scope} onChange={(e)=>setScope(e.target.value)}><option value="all">All facilities</option>{!admin && <option value="mine">My facility</option>}</select>}</div></div><div className="table-wrap">
          {tab==='medicines' && <table><thead><tr><th>Medicine / Batch</th><th>Facility</th><th>Available / Total</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead><tbody>{medicine.map((m)=><tr key={m.id}><td className="cell-main">{m.name}<small>{m.batchNumber} · {m.category}</small></td><td>{facilityName(m.facilityId,data.facilities)}</td><td><strong>{m.quantity-(m.reservedQuantity||0)} / {m.quantity}</strong>{m.quantity-(m.reservedQuantity||0)<m.minStock && <small className="red-text">Low stock</small>}</td><td>{date(m.expiryDate)}</td><td>{badge(expiryStatus(m).text,expiryStatus(m).level)}</td><td>{canEditMedicine(user,m.facilityId) && <button className="link-button" onClick={()=>qty(m)}>Edit stock</button>}{!canEditMedicine(user,m.facilityId) && <span className="muted">—</span>}</td></tr>)}</tbody></table>}
          {tab==='equipment' && <table><thead><tr><th>Equipment / Asset</th><th>Facility</th><th>Category</th><th>Maintenance due</th><th>Status</th><th>Action</th></tr></thead><tbody>{equipment.map((e)=><tr key={e.id}><td className="cell-main">{e.name}<small>{e.assetTag}</small></td><td>{facilityName(e.facilityId,data.facilities)}</td><td>{e.category}</td><td>{date(e.nextMaintenance)}{daysUntil(e.nextMaintenance)<0 && <small className="red-text">Overdue</small>}</td><td>{badge(titleCase(e.status),equipmentStatus(e.status))}</td><td>{canEditEquipment(user,e.facilityId) && ['available','in_use','maintenance'].includes(e.status)?<select className="inline-select" value={e.status} onChange={(event)=>changeStatus(e,event)}><option value="available">Available</option><option value="in_use">In use</option><option value="maintenance">Maintenance</option></select>:<span className="muted">—</span>}{canEditEquipment(user,e.facilityId)&&e.status==='maintenance'&&<button className="link-button" onClick={()=>completeService(e)}>Complete service</button>}</td></tr>)}</tbody></table>}
          {tab==='requests' && <div className="request-history-summary"><div><strong>{allRequests.length}</strong><span>All requests</span></div><div><strong>{sentRequests.length}</strong><span>Sent by my hospital</span></div><div><strong>{receivedRequests.length}</strong><span>Received by my hospital</span></div><div><strong>{awaitingMyDecision.length}</strong><span>Awaiting my action</span></div></div>}
          {tab==='requests' && <table><thead><tr><th>Resource / Purpose</th><th>From → To</th><th>Requested / Stock</th><th>Priority</th><th>Status / Offer</th><th>Decision</th></tr></thead><tbody>{requests.map(r=>{
            const source = r.kind==='medicine' ? data.medicines.find(m=>m.id===r.resourceId) : data.equipment.find(e=>e.id===r.resourceId);
            const available = r.kind==='medicine' ? Math.max(0,Number(source?.quantity||0)-Number(source?.reservedQuantity||0)) : (source?.status==='reserved'?'Reserved':source?.status||'Unknown');
            const supplier = canApprove(user,r);
            const requester = r.toFacilityId === user.facilityId && (r.requestedBy === user.uid || user.role==='hospital_admin');
            return <tr key={r.id} className={r.priority==='high'?'high-priority-row':''}>
              <td className="cell-main">{r.resourceName}<small>Request ID: {r.id.slice(0,10)} · {r.createdAt ? new Date(r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt).toLocaleString('en-IN') : 'Date unavailable'}</small><small>{titleCase(r.kind)} · {REASONS[r.reason] || 'Purpose not recorded'}</small>{r.note && <small title={r.note}>Note: {r.note.slice(0,95)}</small>}</td>
              <td className="transfer-cell">{facilityName(r.fromFacilityId,data.facilities)}<small>→ {facilityName(r.toFacilityId,data.facilities)}</small></td>
              <td><strong>{r.quantity} requested</strong><small>{r.kind==='medicine' ? `${available} free · ${source?.reservedQuantity ?? 0} reserved · ${source?.quantity ?? 0} total` : `Asset: ${available}`}</small>{r.approvedQuantity && <small>{r.approvedQuantity} approved</small>}{r.loanDueDate && <small>Return due: {date(r.loanDueDate)}</small>}</td>
              <td><div className={`priority-chip priority-${r.priority||'low'}`}>{titleCase(r.priority||'low')}</div><div className={`priority-meter priority-${r.priority||'low'}`} aria-label={`${titleCase(r.priority||'low')} priority`}><i/></div></td>
              <td>{badge(titleCase(r.status),requestStatus(r.status))}{r.status==='counter_offered' && <small className="offer-text">Supplier offers {r.offeredQuantity} of {r.quantity} units. Accept?</small>}{r.status==='shortage_review' && <small className="red-text">Insufficient stock for full request</small>}</td>
              <td><div className="table-actions decision-actions">
                {supplier && ['pending','shortage_review'].includes(r.status) && <><button disabled={busyRequest===r.id} className="tiny-action accept" onClick={()=>act(r.id,'approve')}>Approve {r.kind==='medicine' ? r.quantity+' units':''}</button><button disabled={busyRequest===r.id} className="tiny-action reject" onClick={()=>act(r.id,'reject')}>Reject</button></>}
                {supplier && ['pending','shortage_review'].includes(r.status) && r.kind==='medicine' && <><button disabled={busyRequest===r.id} className="tiny-action accept" onClick={()=>counterOffer(r)}>Offer available stock</button></>}
                {requester && r.status==='counter_offered' && <><button disabled={busyRequest===r.id} className="tiny-action accept" onClick={()=>act(r.id,'accept_offer')}>Accept {r.offeredQuantity}</button><button disabled={busyRequest===r.id} className="tiny-action reject" onClick={()=>act(r.id,'decline_offer')}>Decline</button></>}
                {supplier && r.status==='approved' && <button disabled={busyRequest===r.id} className="tiny-action accept" onClick={()=>{if(window.confirm('Confirm the resource has physically left your facility?'))act(r.id,'dispatch');}}>Mark dispatched</button>}
                {mayReceive(user,r) && r.status==='dispatched' && <><button disabled={busyRequest===r.id} className="tiny-action accept" onClick={()=>{if(window.confirm('Confirm physical receipt at your hospital?'))act(r.id,'receive');}}>Confirm receipt</button><button className="tiny-action reject" onClick={()=>{const note=window.prompt('Describe missing or damaged items:');if(note?.trim())act(r.id,'report_issue',{note});}}>Report issue</button></>}
                {mayReceive(user,r) && r.status==='on_loan' && <button className="tiny-action accept" onClick={()=>act(r.id,'initiate_return')}>Return equipment</button>}
                {supplier && user.role==='hospital_admin' && r.status==='disputed' && <button className="tiny-action accept" onClick={()=>{const note=window.prompt('Describe how the delivery issue was resolved:');if(note?.trim())act(r.id,'resolve_issue',{note});}}>Resolve issue</button>}
                {supplier && r.status==='return_in_transit' && <button className="tiny-action accept" onClick={()=>{if(window.confirm('Confirm the returned asset has arrived? It will be marked for inspection.'))act(r.id,'confirm_return');}}>Confirm return</button>}
                {requester && ['pending','shortage_review','counter_offered','approved'].includes(r.status) && <button disabled={busyRequest===r.id} className="tiny-action reject" onClick={()=>act(r.id,'cancel')}>Cancel</button>}
                {!((supplier&&['pending','shortage_review','approved','return_in_transit'].includes(r.status))||(requester&&['pending','shortage_review','counter_offered','approved'].includes(r.status))||(mayReceive(user,r)&&['dispatched','on_loan'].includes(r.status)))&&<span className="muted">—</span>}
              </div></td></tr>;
          })}</tbody></table>}
          {((tab==='medicines'&&medicine.length===0)||(tab==='equipment'&&equipment.length===0)||(tab==='requests'&&requests.length===0)) && <Empty text={tab==='requests'?'No requests in this view. Try switching between Incoming and Sent requests.':'No matching resources found.'}/>}
        </div></section>}
        {tab==='notifications' && <section className="panel workflow-panel"><div className="panel-header"><div><h2>Stakeholder notifications</h2><p>Persistent, real-time alerts linked to request history</p></div>{badge(`${unread} unread`,unread?'warning':'success')}</div><div className="workflow-list">{notifications.length===0?<Empty text="No notifications yet. Create a request and switch to the supplying role to see incoming alerts."/>:notifications.map(n=><div className={`workflow-item ${!n.isRead?'workflow-unread':''}`} key={n.id}><div><strong>{n.title}</strong><p>{n.message}</p><small>{n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):'Recent'}</small></div><div className="workflow-actions"><button className="secondary" onClick={()=>{openTab('requests');setRequestFilter('all');}}>Open requests</button>{!n.isRead && <button className="tiny-action accept" onClick={async()=>{try{await app.markNotificationRead(n.id);}catch(e){notify(e.message,true);}}}>Mark read</button>}</div></div>)}</div></section>}
        {tab==='activity' && <section className="panel workflow-panel"><div className="panel-header"><div><h2>Inventory movement history</h2><p>Reservation, dispatch, receipt and manual adjustments</p></div></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Operation</th><th>Resource</th><th>Quantity / detail</th><th>Request</th></tr></thead><tbody>{ownActivities.map(m=><tr key={m.id}><td>{m.at?new Date(m.at).toLocaleString('en-IN'):'—'}</td><td>{titleCase(m.type)}</td><td>{m.resourceId?.slice(0,14)||'—'}</td><td>{m.quantity??m.after??'—'}</td><td>{m.requestId?.slice(0,10)||'Manual'}</td></tr>)}</tbody></table>{ownActivities.length===0 && <Empty text="No inventory movement records yet."/>}</div>{admin && <div className="workflow-list"><h3>Regional audit log</h3>{(data.auditLogs||[]).slice(0,35).map(a=><div className="workflow-item" key={a.id}><strong>{a.action}</strong><small>{a.at||'—'} · {a.requestId||a.resourceId||'—'}</small></div>)}</div>}</section>}
        {tab==='maintenance' && <section className="panel workflow-panel"><div className="panel-header"><div><h2>Maintenance and return inspection records</h2><p>Engineers update equipment condition from the Equipment registry.</p></div></div><div className="workflow-list">{maintenanceEvents.length===0?<Empty text="No maintenance records yet."/>:maintenanceEvents.map(m=><div className="workflow-item" key={m.id}><div><strong>{titleCase(m.type)}</strong><p>{m.notes||'No notes'}</p><small>Asset: {m.equipmentId} · {m.at?new Date(m.at).toLocaleString('en-IN'):'—'}</small></div></div>)}</div></section>}
        {tab==='facilities' && <FacilityExplorer data={data} user={user} onRequest={openRequest}/>}
        {tab==='staff' && <StaffPanel key={teamRefresh} notify={notify} onInvite={()=>setModal('invite')}/>}
        <footer className="footer">MediMesh v0.9 · Cloud resource coordination</footer>
      </div>
    </main>
    {modal==='medicine' && <MedicineForm onClose={()=>setModal('')} notify={notify}/>}
    {modal==='equipment' && <EquipmentForm onClose={()=>setModal('')} notify={notify}/>}
    {modal==='request' && <RequestForm key={`${requestTarget.facilityId}-${requestTarget.resourceId}`} initialFacilityId={requestTarget.facilityId} initialKind={requestTarget.kind} initialResourceId={requestTarget.resourceId} onClose={()=>setModal('')} notify={notify} onCreated={()=>{openTab('requests');setRequestFilter('outgoing');}}/>}
    {modal==='invite' && <InviteForm onClose={()=>setModal('')} notify={notify} onInvited={()=>setTeamRefresh(v=>v+1)}/>}
    {modal==='facility' && <FacilityCreateForm onClose={()=>setModal('')} notify={notify}/>}
    {toast && <div className={`toast ${toastIsError?'toast-error':''}`} role="status">{toastIsError?<CircleAlert size={17}/>:<Check size={17}/>}<span>{toast}</span><button onClick={()=>setToast('')} className="icon-button" aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}
function Content() {
  const { mode, ready, user, error } = useApp();
  if (!ready) return <div className="loading"><HeartPulse size={33}/><span>Loading MediMesh…</span></div>;
  if (mode==='firebase' && !user) return <SignIn/>;
  if (!user) return <div className="loading">{error || 'No active user'}</div>;
  return <Dashboard/>;
}
export default function Home() { return <AppProvider><Content/></AppProvider>; }
