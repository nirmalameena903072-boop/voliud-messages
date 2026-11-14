// ─────────────────────────────────────────────────────────────
// VOLIUD MESSAGES — FIREBASE CONFIG
//
// Edit THIS file on GitHub (pencil icon on your phone) and paste
// the values from Firebase Console → Project settings → Your apps
// → SDK setup and configuration → Config.
//
// Nothing here is secret: the apiKey is a public project identifier.
// Real protection comes from firestore.rules / database.rules.json.
// ─────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: '',
  authDomain: '', // e.g. voliud-messages.firebaseapp.com
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  // Required for the typing indicator (Realtime Database).
  // e.g. https://voliud-messages-default-rtdb.asia-southeast1.firebasedatabase.app
  databaseURL: '',
}

// Your own Firebase uid — unlocks the App-Owner Console.
// Find it in Firebase Console → Authentication → Users (the User UID column).
// Leave blank to hide the console entirely.
export const OWNER_UID = ''

// Optional: Cloudinary unsigned upload preset for avatars/photos.
// Dashboard → Settings → Upload → Add upload preset → Signing mode: Unsigned.
export const CLOUDINARY_CLOUD_NAME = ''
export const CLOUDINARY_UPLOAD_PRESET = ''

// Env vars win if you set them in Vercel (keeps keys out of the repo).
// A local src/firebase-config.js is fine for a family app.
export const resolvedConfig = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || firebaseConfig.databaseURL,
}

export const resolvedOwnerUid = import.meta.env.VITE_OWNER_UID || OWNER_UID

export const resolvedCloudinary = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME,
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || CLOUDINARY_UPLOAD_PRESET,
}

// Demo mode = no Firebase project wired up yet. The app then runs a
// fully clickable local preview instead of a blank/angry screen.
export const DEMO_MODE = !resolvedConfig.apiKey || !resolvedConfig.projectId
