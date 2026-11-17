import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

import {
  firebaseConfig,
  REQUIRED_FIREBASE_KEYS,
  missingFirebaseKeys,
  isFirebaseConfigured,
  DEMO_MODE,
  resolvedOwnerUid,
} from './firebase-config.js';

export const OWNER_UID = resolvedOwnerUid;

export {
  firebaseConfig,
  REQUIRED_FIREBASE_KEYS,
  missingFirebaseKeys,
  isFirebaseConfigured,
  DEMO_MODE,
  resolvedOwnerUid,
};

let app = null;
let auth = null;
let googleProvider = null;
let db = null;
let rtdb = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  db = getFirestore(app);
  rtdb = getDatabase(app);
}

export { app, auth, googleProvider, db, rtdb };
