import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminServices() {
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    throw new Error('Firebase Admin credentials not configured.');
  }
  const app = getApps()[0] || initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
  return { auth: getAuth(app), db: getFirestore(app) };
}

export async function authenticatedProfile(request) {
  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) throw new Error('Please sign in again.');
  const { auth, db } = getAdminServices();
  const token = await auth.verifyIdToken(bearer.substring(7), true);
  const user = await db.collection('users').doc(token.uid).get();
  if (!user.exists || user.data()?.active !== true) throw new Error('User profile missing or disabled.');
  return { uid: token.uid, ...user.data() };
}
