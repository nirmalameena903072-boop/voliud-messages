export const firebaseConfig = {
  apiKey: 'AIzaSyDlijarDABFRtan-cWh_yUPs6kVvlhg1ZU',
  authDomain: 'voliud-messages.firebaseapp.com',
  databaseURL: 'https://voliud-messages-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'voliud-messages',
  storageBucket: 'voliud-messages.firebasestorage.app',
  messagingSenderId: '1009055198345',
  appId: '1:1009055198345:web:2536e2658268315dd82a58',
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
