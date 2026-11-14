# MediMesh — Regional Healthcare Asset & Expiry Grid
## Domain: Healthcare | Full-stack cloud computing academic project

### Abstract
MediMesh is a proof-of-concept web application that coordinates batch-level medicine inventory, expiry alerts, shared equipment, maintenance records, and inter-facility transfer requests. It enables authorized staff at fictional facilities to view shared resource availability and coordinate requests, using cloud-managed identity and a centralized real-time data store.

### Problem statement
Small healthcare facilities may record medicine batches and equipment in disconnected systems. This can cause inefficient stock utilization, limited visibility into impending expiries, equipment idle time, and manual coordination between organizations. MediMesh demonstrates a unified cloud-based coordination network for resource discovery and controlled transfers.

### Target users and roles
- **Pharmacist:** updates own facility's medicine batches and requests medicine transfers.
- **Biomedical engineer:** updates own facility's equipment and service history and requests equipment loans.
- **Hospital administrator:** approves outgoing transfers, registers stock/assets, manages requests and returns.
- **Regional administrator:** monitors aggregate facility resources and audit information, without changing local inventory.

### Objectives
1. Register medicine batches with expiry dates and stock thresholds.
2. Maintain equipment registry with status and service logs.
3. Show low-stock, expiry and maintenance alerts.
4. Reserve resources atomically to avoid concurrent double-booking.
5. Coordinate request, approval, handover, cancellation and loan return states.
6. Demonstrate scoped access control, real-time cloud data updates and a public deployment path.

### Architecture
- **Presentation:** Next.js App Router and React, written in JavaScript with responsive CSS.
- **Hosting & APIs:** Vercel for Next.js serverless Route Handlers.
- **Identity:** Firebase Authentication (email/password).
- **Data:** Firebase Cloud Firestore collections for users, facilities, medicines, equipment, maintenanceLogs, resourceRequests and auditLogs.
- **Synchronization:** Firestore onSnapshot listeners for authenticated users.
- **Authorization:** Firestore security rules for direct client access; authenticated Next.js API endpoints using Firebase Admin SDK for privileged transactions.

### System workflow
A requesting hospital discovers an available resource owned by another facility and submits a request. The API verifies role/facility membership and atomically updates availability plus a request record. The source hospital can approve/reject. Approval keeps the reservation until confirmation of physical handover in the demonstration workflow. Rejection or cancellation releases held inventory. Completed equipment loans can be returned to the source; medicine handover records a new batch at the destination and decrements source stock.

### Main collections
`users`, `facilities`, `medicines`, `equipment`, `resourceRequests`, `maintenanceLogs`, `auditLogs`. See README and implementation for fields.

### Testing approach
- Unit tests: numeric quantity/date checks, stock availability, overdue equipment constraints, notification scoping and CSV export safety.
- Manual functional tests: request creation, rejection, approval, cancellation, completion, equipment return, maintenance records and demo-role visibility.
- Firebase acceptance tests (after credentials): simultaneous users and transactions, Firestore rule enforcement, role isolation, authenticated API failures and deployment smoke test.

### Security considerations
Only fictional test accounts and synthetic data are supported. Client-side role selectors exist **only in demo mode** and offer no actual security. In Firebase mode, signed-in profiles and Firestore Rules control permitted reads/writes. Route Handlers verify Firebase ID tokens before privileged operations. Service credentials are server-only environment variables; they must never appear in browser bundles or Git history. Rule and access testing should be completed using the Firebase Emulator Suite before any real use.

### Scalability, real-time synchronization, and availability
Firestore managed services support a scale-out architecture and live snapshot listeners. Vercel hosts the application without provisioning a dedicated web server. These characteristics support scalability and availability as design goals, but no capacity or uptime guarantees have been measured for this student project.

### Limitations
The solution cannot validate drug quality, regulatory redistribution approval, storage temperature, courier chain-of-custody or accuracy of physical inventory. Service logs rely on manual entry. No automated scheduled pushes, certification uploads, offline mode, production user self-service onboarding, AI forecasts, or IoT sensors are included. No patient information should be entered. Firestore and Vercel may incur costs outside their respective limits.

### Future enhancements
Temperature logging and RFID/QR inventory scanning, certified handover evidence, controlled facility invitation workflows, audit integrity safeguards, demand prediction, mobile PWA, scheduled notification delivery, storage-backed maintenance certificates, automated end-to-end tests and formal cloud-load testing.

### Deployment and deliverables
1. Configure Firebase Auth + Firestore and the repository's Firestore rules.
2. Provision synthetic users via the development seed script, not on a real project.
3. Deploy GitHub project to Vercel with server and client environment variables.
4. Provide live site link, repository URL, this report and a recorded demonstration.

**Classification:** academic educational prototype; not suitable for clinical decision-making or actual medicine redistribution.
