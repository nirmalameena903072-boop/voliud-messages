import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, DEMO_MODE } from './firebase.js'
import { createDemoApi, createFirestoreApi, DEMO_ME } from './lib/api.js'
import { normalizeUsername } from './lib/utils.js'
import SignIn from './screens/SignIn.jsx'
import ProfileSetup from './screens/ProfileSetup.jsx'
import ChatsScreen from './screens/ChatsScreen.jsx'
import ChatScreen from './screens/ChatScreen.jsx'
import ContactsScreen from './screens/ContactsScreen.jsx'
import StatusScreen from './screens/StatusScreen.jsx'
import ProfileScreen from './screens/ProfileScreen.jsx'
import GroupInfo from './screens/GroupInfo.jsx'
import OwnerConsole from './screens/OwnerConsole.jsx'

export default function App() {
  const [ready, setReady] = useState(false)
  const [uid, setUid] = useState(null)
  const [me, setMe] = useState(null)
  const [profileMissing, setProfileMissing] = useState(false)
  const [screen, setScreen] = useState('chats')
  const [activeChat, setActiveChat] = useState(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteResult, setInviteResult] = useState('')
  const inviteHandled = useRef(false)

  // ── auth ────────────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) {
      setUid(DEMO_ME.uid)
      setReady(true)
      return
    }
    return onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null)
      setMe((prev) => (user ? prev : null))
      setReady(true)
    })
  }, [])

  // ── api instance (one per signed-in user) ───────────────
  const api = useMemo(() => {
    if (DEMO_MODE) return createDemoApi()
    if (!uid) return null
    return createFirestoreApi(uid)
  }, [uid])

  // ── my profile ──────────────────────────────────────────
  useEffect(() => {
    if (!api) return
    return api.subscribeMe((profile) => {
      setMe(profile)
      setProfileMissing(!profile)
    })
  }, [api])

  // ── presence heartbeat ──────────────────────────────────
  useEffect(() => {
    if (!api) return
    api.setPresence(true)
    const onHide = () => api.setPresence(false)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      api.setPresence(false)
    }
  }, [api])

  // ── 1-tap invite links: /?add=username ──────────────────
  useEffect(() => {
    const add = normalizeUsername(new URLSearchParams(window.location.search).get('add') || '')
    if (!add) return
    if (inviteHandled.current) return
    setInviteName(add)
    if (!api || !me) return
    inviteHandled.current = true
    if (add === me.username) {
      setScreen('profile')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const person = await api.userByUsername(add)
        if (cancelled) return
        if (!person) {
          setInviteResult(`No Voliud user called @${add}.`)
          return
        }
        await api.sendContactRequest(person.uid)
        if (cancelled) return
        setInviteResult(`Request sent to @${add}.`)
        setScreen('contacts')
      } catch {
        if (!cancelled) setInviteResult('Could not send the request. Open Contacts to retry.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, me?.uid])

  // Clean the ?add= param once the request has been handled.
  useEffect(() => {
    if (!inviteResult) return
    const t = setTimeout(() => {
      window.history.replaceState({}, '', window.location.pathname)
      setInviteResult('')
      setInviteName('')
    }, 8000)
    return () => clearTimeout(t)
  }, [inviteResult])

  const clearInvite = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setInviteName('')
    setInviteResult('')
  }

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        throw err
      }
    }
  }

  const handleSignOut = async () => {
    if (!DEMO_MODE) await signOut(auth)
    setActiveChat(null)
    setScreen('chats')
  }

  if (!ready) {
    return <div className="h-full grid place-items-center text-sm text-slate-500">Loading…</div>
  }

  if (!uid) return <SignIn onSignIn={handleSignIn} />

  if (!me) {
    if (profileMissing) {
      return (
        <ProfileSetup
          api={api}
          me={{ nickname: auth.currentUser?.displayName || '', photoURL: auth.currentUser?.photoURL || '', email: auth.currentUser?.email || '' }}
          onDone={(profile) => {
            setMe(profile)
            setProfileMissing(false)
          }}
        />
      )
    }
    return <div className="h-full grid place-items-center text-sm text-slate-500">Loading profile…</div>
  }

  const openChat = (chat) => {
    if (api.markRead) api.markRead(chat.id)
    setActiveChat(chat)
    setScreen('chat')
  }

  return (
    <div className="h-full">
      {screen === 'chat' && activeChat ? (
        <ChatScreen
          api={api}
          me={me}
          chat={activeChat}
          onBack={() => {
            setActiveChat(null)
            setScreen('chats')
          }}
          onOpenGroupInfo={activeChat.type === 'group' ? () => setScreen('groupinfo') : undefined}
        />
      ) : screen === 'groupinfo' && activeChat ? (
        <GroupInfo
          api={api}
          me={me}
          chat={activeChat}
          onBack={() => setScreen('chat')}
          onExited={() => {
            setActiveChat(null)
            setScreen('chats')
          }}
        />
      ) : screen === 'contacts' ? (
        <ContactsScreen api={api} me={me} onBack={() => setScreen('chats')} />
      ) : screen === 'status' ? (
        <StatusScreen api={api} me={me} onBack={() => setScreen('chats')} />
      ) : screen === 'profile' ? (
        <ProfileScreen api={api} me={me} onBack={() => setScreen('chats')} onSignOut={handleSignOut} />
      ) : screen === 'owner' ? (
        <OwnerConsole me={me} onBack={() => setScreen('chats')} />
      ) : (
        <ChatsScreen api={api} me={me} onOpenChat={openChat} onNavigate={setScreen} />
      )}

      {inviteName && inviteResult && screen !== 'contacts' && (
        <button
          onClick={clearInvite}
          className="fixed left-3 right-3 bottom-4 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-left text-xs text-slate-200 shadow-xl"
        >
          {inviteResult} <span className="text-sky-400">Tap to dismiss</span>
        </button>
      )}
    </div>
  )
}
