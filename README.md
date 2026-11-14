# Voliud Messages

A mobile-first, ₹0 family messenger. React 18 + Vite + Tailwind v4, Firebase Spark
(Auth + Firestore + Realtime Database), Cloudinary for media, installable as a PWA.
Built entirely from a phone.

**Live preview:** open the running dev server — with no Firebase keys it boots into a
fully clickable **demo family**, so you can show Mum exactly what she's getting before
you wire up anything.

---

## What's in the box

| Area | What it does |
| --- | --- |
| Identity | Google sign-in → permanent lowercase `@username` (max 12 chars, write-once) + free-text nickname. Internal uids never leave the backend. |
| Discovery | Live username search with preview cards, `?add=username` one-tap invite links, QR profile cards with share sheet. |
| Contacts | Mutual accept/decline. One shared request doc per pair — the only model that passes security rules cleanly. |
| Chat | Real-time direct + group threads, 3-dot sine-wave typing indicator (RTDB), day dividers, 50-message windows to stay inside the Spark quota. |
| Hook | 45-second **Jitsi Meet** call card, driven by a shared `expiresAt` so every phone's countdown dies at the same second. |
| Polls | 3–5 option quick polls with live percentage bars, one vote per person (re-voting moves your vote). |
| Status | 24-hour text notes, auto-filtered by `expiresAt` on every read. |
| Groups | Rename, group photo, promote/demote admins, remove members, add contacts. **Safe exit**: if the sole admin leaves, the crown is passed to another member automatically. |
| Owner | App-Owner Console locked to a hard-coded Firebase `OWNER_UID`. No admin password exists anywhere in the codebase. |
| PWA | `manifest.json`, icons, standalone display, safe-area padding. Drop in FCM later for push. |

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173  (demo mode, no keys needed)
npm run build    # production bundle in dist/
```

---

## Go live in 4 steps

### 1. Create the Firebase project (Spark, no card)

1. <https://console.firebase.google.com> → **Add project**.
2. **Authentication → Get started → Google** → enable, pick a support email.
3. **Firestore Database → Create database** → *Production mode* → pick your region.
4. **Realtime Database → Create database** → *Locked mode* (only used for typing/presence).
5. **Project settings → Your apps → Web (`</>`)** → register → copy the config object.

### 2. Paste the config

Open `src/firebase-config.js` (edit it straight in GitHub on your phone) and fill in:

```js
export const firebaseConfig = {
  apiKey: '…',
  authDomain: 'voliud-messages.firebaseapp.com',
  projectId: 'voliud-messages',
  storageBucket: 'voliud-messages.appspot.com',
  messagingSenderId: '…',
  appId: '…',
  databaseURL: 'https://voliud-messages-default-rtdb.asia-southeast1.firebasedatabase.app',
}
export const OWNER_UID = 'your-own-uid'   // Authentication → Users → User UID
```

These values are public by design — the apiKey is a project identifier, not a secret.
Protection lives in the rules. (Vercel env vars also work and win over the file:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
`VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`, `VITE_OWNER_UID`.)

> `databaseURL` is optional — without it everything works except the typing dots.

### 3. Publish the security rules

- **Firestore → Rules** → paste `firestore.rules` → **Publish**.
- **Realtime Database → Rules** → paste `database.rules.json` → **Publish**.

Also add your Vercel domain under **Authentication → Settings → Authorized domains**
(`localhost` is already there).

### 4. Deploy on Vercel

`vercel.com` → **Add New → Project** → import this repo → framework **Vite** →
build `npm run build`, output `dist` → **Deploy**. `vercel.json` already handles SPA
rewrites and the manifest headers.

Avatars/group photos need Cloudinary (free, no card):

1. <https://cloudinary.com> → free account → note your **cloud name**.
2. **Settings → Upload → Add upload preset** → *Signing mode: Unsigned* → save → copy the preset name.
3. Put both in `src/firebase-config.js` (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`).

---

## Test on two phones (the 15-minute checklist)

1. Phone A: open the Vercel URL → sign in → claim `@aarav` → copy invite link.
2. Phone B: open that link → sign in → the request is sent automatically → accept on Phone A.
3. Send a message from B → it appears on A instantly, with the typing dots first.
4. Send `hello` from A, watch B's three dots animate.
5. Tap the video icon → **Join now** on both → Jitsi opens → confirm the card shows the
   same countdown on both phones, then flips to **Expired** at 45 s.
6. Create a group with 3 contacts → post a poll → vote on both → open Group info →
   promote someone → exit as the last admin → confirm the crown passed on.

---

## Quota arithmetic (why this stays inside Spark)

- 1 KiB doc reads: chatting in a 50-message window ≈ 50 reads per open, cached after.
- Every list query is `.limit(30)` / `.limit(50)`.
- Typing + presence live in Realtime Database (1 GB free, no Firestore reads).
- 20k writes/day ≈ 40 messages per person for a 5-person family. Plenty.
- Cloudinary carries the pixels so Firestore stays text-only.

---

## Project layout

```
src/
  firebase-config.js   ← the only file you edit to go live
  firebase.js          app/auth/db bootstrap + DEMO_MODE switch
  lib/api.js           one data layer, two backends (Firestore | in-memory demo)
  lib/utils.js         username rules, id pairing, time formatting
  lib/media.js         Cloudinary unsigned upload
  components/          Avatar, Sheet (bottom sheet), TypingDots
  screens/             SignIn, ProfileSetup, Chats, Chat, Contacts, Status,
                       Profile, GroupInfo, OwnerConsole
firestore.rules        Firestore security rules
database.rules.json    RTDB rules (typing + presence)
firebase.json          rules + hosting config (optional path)
vercel.json            Vercel build settings
```

---

## The PC deal

Lock the number **before** Day 1: e.g. *"7 consecutive days where at least 4 family
members send messages, or 14 days with 3"* → PC target ₹45,000. Put the same sentence in
the README so it can't drift. Then screenshot Day 1 and Day 7 of this app's chat list.
The app is the evidence; the criteria are the contract.
