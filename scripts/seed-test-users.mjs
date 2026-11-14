
import { EXTRA_TEST_USERS } from "./test-account-config.mjs";

const apply = process.argv.includes("--apply");

console.table(EXTRA_TEST_USERS);

if (!apply) {
  console.log("Preview only. No accounts created.");
  console.log(
    "Run with --apply to create the accounts."
  );
  process.exit(0);
}

const required = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "MEDIMESH_SEED_PASSWORD"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

if (process.env.MEDIMESH_SEED_PASSWORD.length < 12) {
  throw new Error("Seed password must contain at least 12 characters.");
}

if (process.env.NEXT_PUBLIC_APP_MODE !== "firebase") {
  throw new Error("Set NEXT_PUBLIC_APP_MODE=firebase in .env.local");
}

const { cert, getApps, initializeApp } =
  await import("firebase-admin/app");

const { getAuth } = await import("firebase-admin/auth");
const { getFirestore } = await import("firebase-admin/firestore");

const app = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const auth = getAuth(app);
const db = getFirestore(app);

for (const user of EXTRA_TEST_USERS) {
  let record;
  let newlyCreated = false;

  try {
    record = await auth.getUserByEmail(user.email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    record = await auth.createUser({
      email: user.email,
      password: process.env.MEDIMESH_SEED_PASSWORD,
      displayName: user.name,
      emailVerified: true
    });

    newlyCreated = true;
  }

  const profileRef = db.collection("users").doc(record.uid);

  try {
    const existing = await profileRef.get();

    if (existing.exists) {
      const data = existing.data();

      if (
        data.email !== user.email ||
        data.role !== user.role ||
        data.facilityId !== user.facilityId ||
        data.active !== true
      ) {
        throw new Error(`Conflicting profile: ${user.email}`);
      }

      console.log(`Already exists: ${user.email}`);
      continue;
    }

    if (!newlyCreated) {
      throw new Error(
        `Auth account exists without a profile: ${user.email}`
      );
    }

    await profileRef.create({
      name: user.name,
      email: user.email,
      role: user.role,
      facilityId: user.facilityId,
      active: true
    });

    console.log(`Created: ${user.email}`);
  } catch (error) {
    if (newlyCreated) {
      try {
        await auth.deleteUser(record.uid);
      } catch (rollbackError) {
        console.error(
          "Could not roll back account:",
          rollbackError.message
        );
      }
    }

    throw error;
  }
}

console.log("Additional test accounts provisioning complete.");
