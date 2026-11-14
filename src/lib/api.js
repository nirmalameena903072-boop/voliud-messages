// ─────────────────────────────────────────────────────────────
// ONE DATA LAYER, TWO BACKENDS
//
//   createFirestoreApi(uid) → real Firebase (Firestore + RTDB)
//   createDemoApi()         → in-memory fake family for the preview
//
// Screens only ever call `api.*`, so the UI is identical in both.
// ─────────────────────────────────────────────────────────────
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import {
  ref,
  set,
  onValue,
  remove,
  onDisconnect,
  serverTimestamp as rtdbTs,
} from 'firebase/database'
import { db, rtdb } from '../firebase.js'
import { dmChatId, pairId, normalizeUsername } from './utils.js'

const MESSAGE_LIMIT = 50

const chatTitleFor = (chat, uid) => {
  if (chat.type === 'group') return chat.name || 'Group'
  const peerUid = (chat.members || []).find((m) => m !== uid)
  const person = chat.people?.[peerUid]
  return person?.nickname || (person?.username ? '@' + person.username : 'Chat')
}

const slimProfile = (u) =>
  u
    ? {
        username: u.username || '',
        nickname: u.nickname || '',
        photoURL: u.photoURL || '',
      }
    : { username: '', nickname: '', photoURL: '' }

// ═════════════════════════════════════════════════════════════
// REAL BACKEND
// ═════════════════════════════════════════════════════════════
export function createFirestoreApi(uid) {
  const api = {
    demo: false,
    uid,

    // ── profile ──────────────────────────────────────────
    async getProfile(userUid = uid) {
      const snap = await getDoc(doc(db, 'users', userUid))
      return snap.exists() ? { uid: userUid, ...snap.data() } : null
    },

    subscribeMe(cb) {
      return onSnapshot(doc(db, 'users', uid), (snap) => {
        cb(snap.exists() ? { uid, ...snap.data() } : null)
      })
    },

    // Username claim is guarded by firestore.rules: the usernames/{name}
    // doc is write-once, so a name can never be stolen later.
    async claimUsername(username, { nickname, photoURL, email }) {
      const clean = normalizeUsername(username)
      const claim = doc(db, 'usernames', clean)
      const existing = await getDoc(claim)
      if (existing.exists() && existing.data().uid !== uid) {
        throw new Error('That username is already taken.')
      }
      await setDoc(claim, { uid })
      await setDoc(
        doc(db, 'users', uid),
        {
          username: clean,
          nickname: nickname || '',
          photoURL: photoURL || '',
          email: email || '',
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
      return api.getProfile()
    },

    async updateProfile(patch) {
      await updateDoc(doc(db, 'users', uid), patch)
    },

    // ── people search ────────────────────────────────────
    async searchUsers(text) {
      const q = normalizeUsername(text)
      if (q.length < 2) return []
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('username', '>=', q),
          where('username', '<=', q + '\uf8ff'),
          orderBy('username'),
          limit(12)
        )
      )
      return snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.uid !== uid)
    },

    async userByUsername(text) {
      const clean = normalizeUsername(text)
      if (!clean) return null
      const snap = await getDocs(
        query(collection(db, 'users'), where('username', '==', clean), limit(1))
      )
      if (snap.empty) return null
      const d = snap.docs[0]
      return { uid: d.id, ...d.data() }
    },

    // ── contacts: ONE shared request doc per pair ────────
    // Two people writing into each other's private subcollection can never
    // pass security rules safely. A single `contactRequests/{pairId}` doc is
    // the model that actually works on the Spark plan.
    subscribeContacts(cb) {
      const q = query(
        collection(db, 'contactRequests'),
        where('uids', 'array-contains', uid),
        limit(60)
      )
      return onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        cb({
          accepted: rows.filter((r) => r.status === 'accepted'),
          incoming: rows.filter((r) => r.status === 'pending' && r.requestedBy !== uid),
          outgoing: rows.filter((r) => r.status === 'pending' && r.requestedBy === uid),
          all: rows,
        })
      })
    },

    async sendContactRequest(otherUid) {
      if (!otherUid || otherUid === uid) return
      const id = 'req_' + pairId(uid, otherUid)
      const existing = await getDoc(doc(db, 'contactRequests', id))
      const current = existing.exists() ? existing.data() : null
      if (current && current.status !== 'declined') return

      const [mine, theirs] = await Promise.all([
        api.getProfile(uid),
        api.getProfile(otherUid),
      ])
      await setDoc(doc(db, 'contactRequests', id), {
        uids: [uid, otherUid].sort(),
        requestedBy: uid,
        status: 'pending',
        createdAt: serverTimestamp(),
        people: {
          [uid]: slimProfile(mine),
          [otherUid]: slimProfile(theirs),
        },
      })
    },

    // Accept/decline attaches a tiny cached profile card so the contact list
    // renders without extra reads (Spark = 50k reads/day).
    async respondToRequest(requestId, accept) {
      const requestRef = doc(db, 'contactRequests', requestId)
      const snap = await getDoc(requestRef)
      if (!snap.exists()) return
      const data = snap.data()
      if (!data.uids?.includes(uid)) throw new Error('Not your request.')

      const patch = {
        status: accept ? 'accepted' : 'declined',
        respondedAt: serverTimestamp(),
      }
      if (accept) {
        const people = {}
        for (const memberUid of data.uids) {
          const profile = await api.getProfile(memberUid)
          if (profile) people[memberUid] = slimProfile(profile)
        }
        patch.people = people
      }
      await updateDoc(requestRef, patch)
    },

    // ── chats ────────────────────────────────────────────
    subscribeChats(cb) {
      const q = query(
        collection(db, 'chats'),
        where('members', 'array-contains', uid),
        orderBy('lastMessageAt', 'desc'),
        limit(30)
      )
      return onSnapshot(q, (snap) => {
        cb(
          snap.docs.map((d) => {
            const chat = { id: d.id, ...d.data() }
            const peerUid =
              chat.type === 'direct' ? (chat.members || []).find((m) => m !== uid) : null
            return {
              ...chat,
              peerUid,
              title: chatTitleFor(chat, uid),
              photoURL: chat.type === 'group' ? chat.photoURL : chat.people?.[peerUid]?.photoURL || '',
            }
          })
        )
      })
    },

    subscribeChat(chatId, cb) {
      return onSnapshot(doc(db, 'chats', chatId), (snap) => {
        if (!snap.exists()) return cb(null)
        const chat = { id: snap.id, ...snap.data() }
        const peerUid =
          chat.type === 'direct' ? (chat.members || []).find((m) => m !== uid) : null
        cb({ ...chat, peerUid, title: chatTitleFor(chat, uid) })
      })
    },

    async openDirectChat(otherUid) {
      const id = dmChatId(uid, otherUid)
      const existing = await getDoc(doc(db, 'chats', id))
      if (!existing.exists()) {
        const [mine, theirs] = await Promise.all([
          api.getProfile(uid),
          api.getProfile(otherUid),
        ])
        await setDoc(doc(db, 'chats', id), {
          type: 'direct',
          name: '',
          photoURL: '',
          members: [uid, otherUid],
          admins: [],
          createdBy: uid,
          people: {
            [uid]: slimProfile(mine),
            [otherUid]: slimProfile(theirs),
          },
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
      }
      return id
    },

    async createGroup(name, memberUids, photoURL = '') {
      const members = Array.from(new Set([uid, ...memberUids]))
      const created = await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: name || 'New group',
        photoURL,
        members,
        admins: [uid],
        createdBy: uid,
        lastMessage: 'Group created',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      })
      return created.id
    },

    async updateChat(chatId, patch) {
      await updateDoc(doc(db, 'chats', chatId), patch)
    },

    async touchChat(chatId, preview) {
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: preview,
        lastMessageAt: serverTimestamp(),
      })
    },

    // Exiting: if I'm the only admin, hand the crown to another member
    // instead of leaving the group unmanageable.
    async exitGroup(chatId, { admins = [], members = [] } = {}) {
      const others = members.filter((m) => m !== uid)
      const iAmAdmin = admins.includes(uid)
      const patch = {
        members: arrayRemove(uid),
        admins: arrayRemove(uid),
        lastMessageAt: serverTimestamp(),
      }
      if (iAmAdmin && others.length > 0) {
        patch.admins = arrayUnion(others[0])
      }
      await updateDoc(doc(db, 'chats', chatId), patch)
    },

    async addMember(chatId, memberUid) {
      await updateDoc(doc(db, 'chats', chatId), { members: arrayUnion(memberUid) })
    },

    async removeMember(chatId, memberUid) {
      await updateDoc(doc(db, 'chats', chatId), {
        members: arrayRemove(memberUid),
        admins: arrayRemove(memberUid),
      })
    },

    async promote(chatId, memberUid) {
      await updateDoc(doc(db, 'chats', chatId), { admins: arrayUnion(memberUid) })
    },

    async demote(chatId, memberUid) {
      await updateDoc(doc(db, 'chats', chatId), { admins: arrayRemove(memberUid) })
    },

    // ── messages ─────────────────────────────────────────
    subscribeMessages(chatId, cb) {
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(MESSAGE_LIMIT)
      )
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
    },

    async sendMessage(chatId, message) {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        ...message,
        senderUid: uid,
        createdAt: serverTimestamp(),
      })
    },

    async votePoll(chatId, messageId, optionIndex) {
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId)
      const snap = await getDoc(messageRef)
      if (!snap.exists()) return
      const votes = snap.data().votes || {}
      const next = {}
      for (const [idx, uids] of Object.entries(votes)) {
        next[idx] = (uids || []).filter((u) => u !== uid)
      }
      const key = String(optionIndex)
      next[key] = [...(next[key] || []), uid]
      await updateDoc(messageRef, { votes: next })
    },

    // ── typing + presence (Realtime Database = zero Firestore reads) ──
    subscribeTyping(chatId, cb) {
      if (!rtdb) return () => {}
      return onValue(ref(rtdb, `typing/${chatId}`), (snap) => {
        const value = snap.val() || {}
        cb(Object.keys(value).filter((u) => u !== uid && value[u]))
      })
    },

    setTyping(chatId, isTyping) {
      if (!rtdb) return
      const typingRef = ref(rtdb, `typing/${chatId}/${uid}`)
      if (isTyping) {
        set(typingRef, true)
        onDisconnect(typingRef).remove()
      } else {
        remove(typingRef)
      }
    },

    subscribePresence(userUid, cb) {
      if (!rtdb) return () => {}
      return onValue(ref(rtdb, `presence/${userUid}`), (snap) => {
        cb(Boolean(snap.val()?.online))
      })
    },

    setPresence(online) {
      if (!rtdb) return
      const presenceRef = ref(rtdb, `presence/${uid}`)
      set(presenceRef, { online, lastSeen: rtdbTs() })
      if (online) onDisconnect(presenceRef).set({ online: false, lastSeen: rtdbTs() })
    },

    // ── 24-hour status notes ─────────────────────────────
    subscribeStatuses(cb) {
      const q = query(collection(db, 'statuses'), limit(40))
      return onSnapshot(q, (snap) => {
        const nowMs = Date.now()
        cb(
          snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((s) => (s.expiresAt || 0) > nowMs)
        )
      })
    },

    async postStatus(text, authorName = '') {
      await setDoc(doc(db, 'statuses', uid), {
        text,
        authorName,
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
    },

    async clearStatus() {
      await deleteDoc(doc(db, 'statuses', uid))
    },
  }
  return api
}

// ═════════════════════════════════════════════════════════════
// DEMO BACKEND — a believable family, all in memory
// ═════════════════════════════════════════════════════════════
export const DEMO_ME = {
  uid: 'demo-me',
  username: 'aarav',
  nickname: 'Aarav',
  photoURL: '',
  email: 'aarav@example.com',
}

export function createDemoApi() {
  const T = Date.now()
  const min = (n) => T - n * 60000

  const PEOPLE = {
    me: { ...DEMO_ME },
    mom: { uid: 'demo-mom', username: 'mummy', nickname: 'Mummy', photoURL: '' },
    dad: { uid: 'demo-dad', username: 'papa', nickname: 'Papa', photoURL: '' },
    diya: { uid: 'demo-diya', username: 'diya', nickname: 'Diya', photoURL: '' },
    rohan: { uid: 'demo-rohan', username: 'rohan', nickname: 'Rohan (cousin)', photoURL: '' },
    nani: { uid: 'demo-nani', username: 'nani', nickname: 'Nani', photoURL: '' },
  }

  const card = (p) => (p ? slimProfile(p) : { username: '', nickname: 'Family', photoURL: '' })

  const store = {
    me: { ...PEOPLE.me },
    people: PEOPLE,
    chats: [
      {
        id: 'demo-group',
        type: 'group',
        name: 'Ghar Parivar 🏠',
        photoURL: '',
        members: ['demo-me', 'demo-mom', 'demo-dad', 'demo-diya', 'demo-nani'],
        admins: ['demo-mom', 'demo-me'],
        lastMessage: 'Mummy: Dinner at 8, don’t be late 😄',
        lastMessageAt: min(3),
        unread: 3,
      },
      {
        id: 'demo-dm-mom',
        type: 'direct',
        name: '',
        photoURL: '',
        members: ['demo-me', 'demo-mom'],
        admins: [],
        lastMessage: 'Mummy: Did you finish the app?',
        lastMessageAt: min(12),
        unread: 2,
      },
      {
        id: 'demo-dm-diya',
        type: 'direct',
        name: '',
        photoURL: '',
        members: ['demo-me', 'demo-diya'],
        admins: [],
        lastMessage: 'Diya: sent the new sticker pack 😂',
        lastMessageAt: min(48),
      },
      {
        id: 'demo-dm-dad',
        type: 'direct',
        name: '',
        photoURL: '',
        members: ['demo-me', 'demo-dad'],
        admins: [],
        lastMessage: 'Papa: 👍',
        lastMessageAt: min(140),
      },
    ],
    messages: {
      'demo-group': [
        {
          id: 'g1',
          senderUid: 'demo-mom',
          senderName: 'Mummy',
          type: 'text',
          text: 'Good morning everyone! Tea is ready ☕',
          createdAt: min(300),
        },
        {
          id: 'g2',
          senderUid: 'demo-dad',
          senderName: 'Papa',
          type: 'text',
          text: 'Coming in 5 minutes.',
          createdAt: min(295),
        },
        {
          id: 'g3',
          senderUid: 'demo-diya',
          senderName: 'Diya',
          type: 'text',
          text: 'Aarav is building an app on his phone 😳',
          createdAt: min(240),
        },
        {
          id: 'g4',
          senderUid: 'demo-me',
          senderName: 'Aarav',
          type: 'text',
          text: 'Voliud Messages! Zero rupees, whole family 😎',
          createdAt: min(236),
        },
        {
          id: 'g5',
          senderUid: 'demo-me',
          senderName: 'Aarav',
          type: 'poll',
          question: 'What should we order on Sunday?',
          options: ['Chole bhature', 'Pizza', 'Biryani'],
          votes: { 0: ['demo-dad', 'demo-nani'], 2: ['demo-diya'] },
          createdAt: min(120),
        },
        {
          id: 'g6',
          senderUid: 'demo-mom',
          senderName: 'Mummy',
          type: 'call',
          jitsiRoom: 'VoliudDemoFamilyCallRoom',
          expiresAt: T + 45000,
          createdAt: min(1),
        },
        {
          id: 'g7',
          senderUid: 'demo-mom',
          senderName: 'Mummy',
          type: 'text',
          text: 'Dinner at 8, don’t be late 😄',
          createdAt: min(3),
        },
      ],
      'demo-dm-mom': [
        {
          id: 'm1',
          senderUid: 'demo-mom',
          senderName: 'Mummy',
          type: 'text',
          text: 'Beta, show me the app when you are free.',
          createdAt: min(30),
        },
        {
          id: 'm2',
          senderUid: 'demo-me',
          senderName: 'Aarav',
          type: 'text',
          text: 'It is ready! Send this to Papa and Nani too.',
          createdAt: min(20),
        },
        {
          id: 'm3',
          senderUid: 'demo-mom',
          senderName: 'Mummy',
          type: 'text',
          text: 'Did you finish the app?',
          createdAt: min(12),
        },
      ],
      'demo-dm-diya': [
        {
          id: 'd1',
          senderUid: 'demo-diya',
          senderName: 'Diya',
          type: 'text',
          text: 'Bro this looks like WhatsApp but yours 😭',
          createdAt: min(60),
        },
        {
          id: 'd2',
          senderUid: 'demo-diya',
          senderName: 'Diya',
          type: 'text',
          text: 'sent the new sticker pack 😂',
          createdAt: min(48),
        },
      ],
      'demo-dm-dad': [
        {
          id: 'p1',
          senderUid: 'demo-me',
          senderName: 'Aarav',
          type: 'text',
          text: 'Papa, video call for 45 seconds only. Test it?',
          createdAt: min(150),
        },
        {
          id: 'p2',
          senderUid: 'demo-dad',
          senderName: 'Papa',
          type: 'text',
          text: '👍',
          createdAt: min(140),
        },
      ],
    },
    requests: [
      {
        id: 'req_demo-me_demo-mom',
        uids: ['demo-me', 'demo-mom'],
        requestedBy: 'demo-mom',
        status: 'accepted',
        createdAt: min(9000),
        people: { 'demo-me': card(PEOPLE.me), 'demo-mom': card(PEOPLE.mom) },
      },
      {
        id: 'req_demo-dad_demo-me',
        uids: ['demo-dad', 'demo-me'],
        requestedBy: 'demo-me',
        status: 'accepted',
        createdAt: min(9000),
        people: { 'demo-me': card(PEOPLE.me), 'demo-dad': card(PEOPLE.dad) },
      },
      {
        id: 'req_demo-diya_demo-me',
        uids: ['demo-diya', 'demo-me'],
        requestedBy: 'demo-diya',
        status: 'accepted',
        createdAt: min(8000),
        people: { 'demo-me': card(PEOPLE.me), 'demo-diya': card(PEOPLE.diya) },
      },
      {
        id: 'req_demo-me_demo-nani',
        uids: ['demo-me', 'demo-nani'],
        requestedBy: 'demo-nani',
        status: 'accepted',
        createdAt: min(8000),
        people: { 'demo-me': card(PEOPLE.me), 'demo-nani': card(PEOPLE.nani) },
      },
      {
        id: 'req_demo-me_demo-rohan',
        uids: ['demo-me', 'demo-rohan'],
        requestedBy: 'demo-rohan',
        status: 'pending',
        createdAt: min(90),
        people: { 'demo-me': card(PEOPLE.me), 'demo-rohan': card(PEOPLE.rohan) },
      },
    ],
    statuses: [
      {
        uid: 'demo-mom',
        text: 'Making kheer tonight 🍚',
        authorName: 'Mummy',
        createdAt: min(180),
        expiresAt: T + 20 * 3600 * 1000,
      },
      {
        uid: 'demo-diya',
        text: 'Exam week, pray for me 🙏',
        authorName: 'Diya',
        createdAt: min(400),
        expiresAt: T + 12 * 3600 * 1000,
      },
      {
        uid: 'demo-dad',
        text: 'Morning walk ✔️ 6 km',
        authorName: 'Papa',
        createdAt: min(600),
        expiresAt: T + 6 * 3600 * 1000,
      },
    ],
    typing: {},
  }

  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn())
  const subscribe = (fn) => {
    listeners.add(fn)
    fn()
    return () => {
      listeners.delete(fn)
    }
  }
  const findPerson = (uid) =>
    Object.values(store.people).find((p) => p.uid === uid) || null
  const chatOf = (id) => store.chats.find((c) => c.id === id)
  const messagesOf = (id) => (store.messages[id] ||= [])
  const otherMember = (chat) => chat.members.find((m) => m !== 'demo-me') || 'demo-me'

  const decorate = (chat) => {
    if (chat.type === 'direct') {
      const peerUid = otherMember(chat)
      const person = findPerson(peerUid)
      const people = chat.people || { [peerUid]: card(person), 'demo-me': card(store.me) }
      return {
        ...chat,
        people,
        peerUid,
        title: people[peerUid]?.nickname || ('@' + (people[peerUid]?.username || 'chat')),
        photoURL: people[peerUid]?.photoURL || '',
      }
    }
    return { ...chat, title: chat.name || 'Group' }
  }

  const replyPool = {
    mom: ['Ok beta ❤️', 'Eat something, don’t skip lunch.', 'Very nice! Send it to Nani also.'],
    dad: ['Good 👍', 'Okay.', 'Show me on Sunday.'],
    diya: ['lol 😂', 'ok ok chill', 'this is actually cool bro'],
    rohan: ['nice bro 🔥', 'add me to the group too'],
    nani: ['Beta come home soon 🥰'],
  }

  function scheduleReply(chatId, fromUid) {
    const personKey =
      Object.keys(PEOPLE).find((k) => PEOPLE[k].uid === fromUid) || 'mom'
    const pool = replyPool[personKey] || replyPool.mom
    const line = pool[Math.floor(Math.random() * pool.length)]

    setTimeout(() => {
      store.typing[chatId] = { ...(store.typing[chatId] || {}), [fromUid]: true }
      emit()
    }, 900)

    setTimeout(() => {
      const typing = store.typing[chatId] || {}
      delete typing[fromUid]
      store.typing[chatId] = typing
      const nickname = findPerson(fromUid)?.nickname || 'Family'
      messagesOf(chatId).push({
        id: 'x' + Math.random().toString(36).slice(2, 9),
        senderUid: fromUid,
        senderName: nickname,
        type: 'text',
        text: line,
        createdAt: Date.now(),
      })
      const chat = chatOf(chatId)
      if (chat) {
        chat.lastMessage = `${nickname}: ${line}`
        chat.lastMessageAt = Date.now()
      }
      emit()
    }, 3400)
  }

  const api = {
    demo: true,
    uid: 'demo-me',

    async getProfile(userUid = 'demo-me') {
      if (userUid === 'demo-me') return { ...store.me }
      return findPerson(userUid) ? { ...findPerson(userUid) } : null
    },

    subscribeMe(cb) {
      // Stable identity: only hand back a new object when the profile changes.
      let last = store.me
      return subscribe(() => {
        if (last !== store.me) last = store.me
        cb(last)
      })
    },

    async claimUsername(username, extra = {}) {
      store.me = { ...store.me, username: normalizeUsername(username), ...extra }
      emit()
      return { ...store.me }
    },

    async updateProfile(patch) {
      store.me = { ...store.me, ...patch }
      const mine = Object.values(store.people).find((p) => p.uid === 'demo-me')
      if (mine) Object.assign(mine, patch)
      emit()
    },

    async searchUsers(text) {
      const q = normalizeUsername(text)
      if (q.length < 2) return []
      return Object.values(store.people)
        .filter((p) => p.uid !== 'demo-me' && p.username.includes(q))
        .map((p) => ({ ...p }))
    },

    async userByUsername(text) {
      const q = normalizeUsername(text)
      return findPerson('demo-' + q) || Object.values(store.people).find((p) => p.username === q) || null
    },

    subscribeContacts(cb) {
      return subscribe(() => {
        const rows = store.requests.map((r) => ({ ...r }))
        cb({
          accepted: rows.filter((r) => r.status === 'accepted'),
          incoming: rows.filter((r) => r.status === 'pending' && r.requestedBy !== 'demo-me'),
          outgoing: rows.filter((r) => r.status === 'pending' && r.requestedBy === 'demo-me'),
          all: rows,
        })
      })
    },

    async sendContactRequest(otherUid) {
      const id = 'req_' + pairId('demo-me', otherUid)
      const existing = store.requests.find((r) => r.id === id)
      if (existing) {
        if (existing.status === 'declined') existing.status = 'pending'
        if (existing.status === 'accepted') return
        existing.requestedBy = 'demo-me'
        emit()
        return
      }
      store.requests.push({
        id,
        uids: ['demo-me', otherUid].sort(),
        requestedBy: 'demo-me',
        status: 'pending',
        createdAt: Date.now(),
        people: { 'demo-me': card(store.me), [otherUid]: card(findPerson(otherUid)) },
      })
      emit()
    },

    async respondToRequest(requestId, accept) {
      const req = store.requests.find((r) => r.id === requestId)
      if (!req) return
      req.status = accept ? 'accepted' : 'declined'
      if (accept) {
        req.people = {
          'demo-me': card(store.me),
          ...Object.fromEntries(req.uids.map((u) => [u, card(findPerson(u))])),
        }
      }
      emit()
    },

    subscribeChats(cb) {
      return subscribe(() => {
        cb(
          [...store.chats]
            .map(decorate)
            .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
        )
      })
    },

    subscribeChat(chatId, cb) {
      return subscribe(() => {
        const chat = chatOf(chatId)
        cb(chat ? decorate(chat) : null)
      })
    },

    async openDirectChat(otherUid) {
      const id = dmChatId('demo-me', otherUid)
      if (!chatOf(id)) {
        store.chats.push({
          id,
          type: 'direct',
          name: '',
          photoURL: '',
          members: ['demo-me', otherUid],
          admins: [],
          lastMessage: '',
          lastMessageAt: Date.now(),
          people: { 'demo-me': card(store.me), [otherUid]: card(findPerson(otherUid)) },
        })
        store.messages[id] = []
        emit()
      }
      return id
    },

    async createGroup(name, memberUids) {
      const id = 'demo-g' + Math.random().toString(36).slice(2, 8)
      store.chats.push({
        id,
        type: 'group',
        name: name || 'New group',
        photoURL: '',
        members: ['demo-me', ...memberUids],
        admins: ['demo-me'],
        lastMessage: 'Group created',
        lastMessageAt: Date.now(),
      })
      store.messages[id] = []
      emit()
      return id
    },

    async updateChat(chatId, patch) {
      const chat = chatOf(chatId)
      if (chat) Object.assign(chat, patch)
      emit()
    },

    async touchChat(chatId, preview) {
      const chat = chatOf(chatId)
      if (chat) {
        chat.lastMessage = preview
        chat.lastMessageAt = Date.now()
      }
      emit()
    },

    async exitGroup(chatId) {
      const chat = chatOf(chatId)
      if (!chat) return
      const remaining = chat.members.filter((m) => m !== 'demo-me')
      const wasAdmin = chat.admins.includes('demo-me')
      chat.members = remaining
      chat.admins = chat.admins.filter((a) => a !== 'demo-me')
      if (wasAdmin && remaining.length && chat.admins.length === 0) {
        chat.admins = [remaining[0]]
      }
      store.chats = store.chats.filter((c) => c.id !== chatId)
      emit()
    },

    async addMember(chatId, memberUid) {
      const chat = chatOf(chatId)
      if (chat && !chat.members.includes(memberUid)) {
        chat.members.push(memberUid)
        emit()
      }
    },

    async removeMember(chatId, memberUid) {
      const chat = chatOf(chatId)
      if (!chat) return
      chat.members = chat.members.filter((m) => m !== memberUid)
      chat.admins = chat.admins.filter((a) => a !== memberUid)
      emit()
    },

    async promote(chatId, memberUid) {
      const chat = chatOf(chatId)
      if (chat && !chat.admins.includes(memberUid)) {
        chat.admins.push(memberUid)
        emit()
      }
    },

    async demote(chatId, memberUid) {
      const chat = chatOf(chatId)
      if (chat) {
        chat.admins = chat.admins.filter((a) => a !== memberUid)
        emit()
      }
    },

    subscribeMessages(chatId, cb) {
      return subscribe(() => cb([...(store.messages[chatId] || [])]))
    },

    async sendMessage(chatId, message) {
      messagesOf(chatId).push({
        ...message,
        id: 'x' + Math.random().toString(36).slice(2, 9),
        senderUid: 'demo-me',
        senderName: store.me.nickname || 'You',
        createdAt: Date.now(),
      })
      const chat = chatOf(chatId)
      if (chat) {
        chat.unread = 0
        chat.lastMessage = `You: ${message.text || message.question || '…'}`
        chat.lastMessageAt = Date.now()
        const candidates = chat.members.filter((m) => m !== 'demo-me')
        const responder =
          chat.type === 'direct'
            ? candidates[0]
            : candidates[Math.floor(Math.random() * candidates.length)]
        if (responder) scheduleReply(chatId, responder)
      }
      emit()
    },

    async votePoll(chatId, messageId, optionIndex) {
      const msg = messagesOf(chatId).find((m) => m.id === messageId)
      if (!msg) return
      const votes = msg.votes || {}
      for (const key of Object.keys(votes)) {
        votes[key] = (votes[key] || []).filter((u) => u !== 'demo-me')
      }
      const k = String(optionIndex)
      votes[k] = [...(votes[k] || []), 'demo-me']
      msg.votes = votes
      emit()
    },

    subscribeTyping(chatId, cb) {
      return subscribe(() => {
        cb(Object.keys(store.typing[chatId] || {}).filter((u) => u !== 'demo-me'))
      })
    },

    setTyping() {
      /* demo: replies fake their own typing */
    },

    subscribePresence(_userUid, cb) {
      cb(true)
      return () => {}
    },

    setPresence() {},

    subscribeStatuses(cb) {
      return subscribe(() => {
        cb(store.statuses.filter((s) => s.expiresAt > Date.now()))
      })
    },

    async postStatus(text, authorName) {
      store.statuses = store.statuses.filter((s) => s.uid !== 'demo-me')
      store.statuses.push({
        uid: 'demo-me',
        text,
        authorName: authorName || store.me.nickname,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 3600 * 1000,
      })
      emit()
    },

    async clearStatus() {
      store.statuses = store.statuses.filter((s) => s.uid !== 'demo-me')
      emit()
    },

    person: findPerson,
    markRead(chatId) {
      const chat = chatOf(chatId)
      if (chat) chat.unread = 0
      emit()
    },
    peopleList() {
      return Object.values(store.people)
    },
  }

  return api
}
