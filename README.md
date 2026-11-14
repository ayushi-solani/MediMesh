# MediMesh v0.9 — Healthcare Resource Coordination

MediMesh connects participating hospitals and clinics in a shared cloud inventory network. Authorized staff can browse stock and equipment at another facility, submit a targeted request, approve or counteroffer quantities, record dispatch, confirm receipt and follow equipment loans through inspection and return.

## Stack

- Next.js 15, React 19, JavaScript, responsive CSS and Lucide icons
- Firebase Authentication (email/password) and Cloud Firestore
- Firebase Admin SDK in protected Next.js API routes
- Vercel-compatible Next.js app (deployment must be verified separately)
- **No Firebase Storage or paid file-upload dependency**

## Roles

| Role | Scope |
|---|---|
| Pharmacist | Manage medicine batches at assigned facility; request medicine; approve/dispatch incoming medicine |
| Biomedical engineer | Register/maintain assigned equipment; request equipment; approve/dispatch equipment and inspect returns |
| Hospital administrator | Request either resource type, coordinate receipt, invite/deactivate own specialist staff |
| Regional administrator | View regional inventory and activity, register facilities, invite facility administrators/staff, manage non-regional accounts |

## Run locally

Node.js >=20.9.0.

```powershell
npm.cmd install
npm.cmd run dev
```

Visit http://localhost:3000. Run tests with `npm.cmd test`.

Firebase mode requires your existing `.env.local` with `NEXT_PUBLIC_APP_MODE=firebase`, Firebase client settings and server-only `FIREBASE_ADMIN_*` credentials. Configure **Email/Password** in Firebase Authentication and deploy the included Firestore rules:

```powershell
firebase deploy --only firestore:rules
```

Keep credentials outside version control. Do not rerun the original seed script against an existing working database.

## v0.9 features

### Facility-first requests

Open **Facility resources** to select a hospital and inspect its actual medicine batches and devices, including stock availability. Use **Request** beside an eligible item to preselect the supplier and resource. Or open **Transfer requests → New request**, choose the supplying facility first, then choose an eligible resource. Backend validation rejects a request if its selected supplier does not match the resource owner.

### Controlled account registration

There is **no open self-assignment of privileges**. Hospital administrators invite pharmacists and engineers *at their own facility*. Regional administrators can register facilities and invite facility administrators or other staff. Open **Team & access → Invite staff**, choose email, role and facility, then copy the one-time invitation code and share it securely. The recipient opens MediMesh → **Create account** and enters the exact invited email, code, name and a password of at least 12 characters.

Invitation codes expire in 7 days and can be used only once. Admins can activate/deactivate permitted staff accounts from the team directory. Region-admin access cannot be self-registered.

### Transfer workflow

- Request submission records the origin, destination, resource, quantity, priority, reason and actor.
- Supplier specialist/administrator approves, rejects or proposes partial medicine quantity.
- Medicine is reserved on approval, deducted from source on dispatch, and credited to recipient on independent receipt.
- Equipment is approved/held, dispatched, checked in as a loan, returned and quarantined for inspection.
- Transactions create audit entries and persistent targeted notifications.
- Request history remains visible to the participating facilities.

### Removed from v0.9

The optional PDF/image supporting-document upload and verification system was dropped. `app/api/requests/[id]/document/route.js` is **not included** and should be deleted from older installations. Existing metadata on historical records is not automatically deleted; it no longer gates approval.

## Demo mode

Use `NEXT_PUBLIC_APP_MODE=demo` for local sample data and role switching. Account registration, facility creation and staff administration require Firebase mode. Demo data is synthetic, not for real patient or medical operations.

## Tests and limitations

`npm.cmd test` covers the pure request engine, role restrictions, recipient targeting, facility selection validation, invitations and registration input. A live Firebase test is still required for the new admin endpoints, invite redemption, account deactivation and responsive UI. A full production build has not been completed in the packaging environment because installing dependencies timed out. Do not use this prototype for real clinical decisions or sensitive patient records.

See `UPGRADE_V09.md` for upgrading an existing v0.8 installation and `TEST_V09.md` for the acceptance checklist.
