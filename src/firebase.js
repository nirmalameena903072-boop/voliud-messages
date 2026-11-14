import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import {
  resolvedConfig,
  resolvedCloudinary,
  resolvedOwnerUid,
  DEMO_MODE,
} from './firebase-config.js'

export { resolvedCloudinary, DEMO_MODE }
export const OWNER_UID = resolvedOwnerUid

let app = null
let auth = null
let db = null
let rtdb = null

if (!DEMO_MODE) {
  app = initializeApp(resolvedConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  // Realtime Database is optional — typing indicators just go quiet without it.
  try {
    rtdb = resolvedConfig.databaseURL ? getDatabase(app) : null
  } catch {
    rtdb = null
  }
}

export { app, auth, db, rtdb }
export const googleProvider = !DEMO_MODE ? new GoogleAuthProvider() : null
