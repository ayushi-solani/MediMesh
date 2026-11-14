# MediMesh instructor demonstration (synthetic data only)

## Launch
Run `npm.cmd install`, `Copy-Item .env.example .env.local`, then `npm.cmd run dev` in PowerShell. Visit http://localhost:3000.

## Recommended demonstration (8–12 minutes)
1. **Regional overview (1 min)** — Switch to the Regional Coordinator account; demonstrate live counts, facility directory, alerts, and analytics.
2. **Medicine batch management (1 min)** — Switch to the Northside Pharmacist; add a batch and adjust stock. Show expiry status and low-stock alerts.
3. **Equipment registry (1 min)** — Switch to Northside Biomedical Engineer; register equipment, set maintenance status and add a maintenance service record.
4. **Cross-facility reservation (2 min)** — Switch to Northside Hospital Admin. Open Transfers > New request and select City General Hospital's Portable ECG Monitor. The equipment becomes reserved immediately.
5. **Source approval (1 min)** — Switch to City Hospital Admin. Approve the incoming request and confirm the simulated handover. The ECG device moves to Northside and remembers the original facility.
6. **Equipment return (1 min)** — Switch to Northside Hospital Admin. Find the loaned ECG device in Equipment and click Return loan. It returns to City General Hospital.
7. **Reservation cancellation (1 min)** — Create a second request and cancel it from the requesting hospital; the hold is released.
8. **Cloud explanation (2 min)** — In Firebase mode, repeat reservation with two different signed-in browsers. Firestore snapshots synchronize; server transactions prevent two simultaneous equipment reservations.

## What the demo does NOT prove
- In local **demo mode** the app uses browser localStorage, not Firebase. Do not represent tab updates as cloud-based synchronization.
- Scheduled email or push alerts, certificate uploads, AI, real IoT integration, real patient data, and verified real-world shipping are not included.
- A high-availability claim requires independent testing and operational configuration; deploying to Vercel does not establish a numerical availability guarantee.

## Questions to expect
- **Why two clouds?** Vercel runs the web application/backend; Firebase provides managed Auth and Firestore state shared by hospitals.
- **Why transactions?** Two hospitals can try to reserve the same asset concurrently; a transaction atomically checks availability and writes the reservation.
- **How is access controlled?** Firebase Auth identifies users; Firestore Rules constrain direct writes; API routes verify JWT + server-side role and facility before privileged changes.
- **What is the main limitation?** Digital state is not proof of physical stock, safe storage, medicine legality, or equipment handover.
