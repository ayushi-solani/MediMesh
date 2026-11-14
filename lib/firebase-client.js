'use client';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE === 'firebase' ? 'firebase' : 'demo';

const configuration = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function getFirebaseClient() {
  if (APP_MODE !== 'firebase') return null;
  if (!configuration.apiKey || !configuration.projectId) throw new Error('Firebase client environment variables are missing.');
  const app = getApps().length ? getApp() : initializeApp(configuration);
  return { auth: getAuth(app), db: getFirestore(app) };
}
