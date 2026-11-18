const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDlijarDABFRtan-cWh_yUPs6kVvlhg1ZU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'voliud-messages.firebaseapp.com',
  databaseURL:
    env.VITE_FIREBASE_DATABASE_URL ||
    'https://voliud-messages-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'voliud-messages',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'voliud-messages.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1009055198345',
  appId: env.VITE_FIREBASE_APP_ID || '1:1009055198345:web:2536e2658268315dd82a58',
};

export const REQUIRED_FIREBASE_KEYS = [
  { key: 'apiKey', placeholder: 'PASTE_API_KEY' },
  { key: 'authDomain', placeholder: 'PASTE_AUTH_DOMAIN' },
  { key: 'databaseURL', placeholder: 'PASTE_DATABASE_URL' },
  { key: 'projectId', placeholder: 'PASTE_PROJECT_ID' },
  { key: 'storageBucket', placeholder: 'PASTE_STORAGE_BUCKET' },
  { key: 'messagingSenderId', placeholder: 'PASTE_MESSAGING_SENDER_ID' },
  { key: 'appId', placeholder: 'PASTE_APP_ID' },
];

export const missingFirebaseKeys = REQUIRED_FIREBASE_KEYS.filter(({ key }) => {
  const value = firebaseConfig[key];
  return !value || typeof value !== 'string' || value.startsWith('PASTE_') || value.trim() === '';
});

export const isFirebaseConfigured = missingFirebaseKeys.length === 0;
export const DEMO_MODE = !isFirebaseConfigured;
export const resolvedOwnerUid = env.VITE_OWNER_UID || 'Y63ZCswFUsZbdBtbi1O4RLRV3ii2';
