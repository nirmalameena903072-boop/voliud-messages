import { useEffect, useMemo, useState } from 'react'
import { Bell, CircleUser, MessageSquarePlus, Plus, Radio, Search, Settings2, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Sheet from '../components/Sheet.jsx'
import { displayName, timeAgo } from '../lib/utils.js'
import { OWNER_UID } from '../firebase.js'

export default function ChatsScreen({ api, me, onOpenChat, onNavigate }) {
  const [chats, setChats] = useState([])
  const [contacts, setContacts] = useState({ accepted: [], incoming: [], outgoing: [] })
  const [queryText, setQueryText] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [groupMode, setGroupMode] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => api.subscribeChats(setChats), [api])
  useEffect(() => api.subscribeContacts(setContacts), [api])

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((c) => (c.name || '').toLowerCase().includes(q))
  }, [chats, queryText])

  const people = useMemo(
    () =>
      contacts.accepted.map((r) => {
        const otherUid = r.uids.find((u) => u !== me.uid)
        const card = r.people?.[otherUid] || {}
        return {
          uid: otherUid,
          username: card.username || '',
          nickname: card.nickname || 'Family member',
          photoURL: card.photoURL || '',
        }
      }),
    [contacts.accepted, me.uid]
  )

  const startDirect = async (otherUid) => {
    setBusy(true)
    try {
      const chatId = await api.openDirectChat(otherUid)
      const chat = chats.find((c) => c.id === chatId) || { id: chatId, type: 'direct' }
      setNewChatOpen(false)
      setPicked([])
      onOpenChat(chat)
    } finally {
      setBusy(false)
    }
  }

  const createGroup = async () => {
    if (picked.length === 0) return
    setBusy(true)
    try {
      const chatId = await api.createGroup(groupName.trim() || 'New group', picked)
      setNewChatOpen(false)
      setGroupMode(false)
      setGroupName('')
      setPicked([])
      onOpenChat({ id: chatId, type: 'group', name: groupName.trim() || 'New group' })
    } finally {
      setBusy(false)
    }
  }

  const totalUnread = chats.reduce((n, c) => n + (c.unread || 0), 0)
  const pendingCount = contacts.incoming.length

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* header */}
      <header className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">{greeting()},</p>
            <h1 className="text-xl font-bold text-white -mt-0.5">
              {me.nickname || '@' + me.username}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Status" onClick={() => onNavigate('status')}>
              <Radio size={19} />
            </IconButton>
            <IconButton label="Contacts" badge={pendingCount} onClick={() => onNavigate('contacts')}>
              <Users size={19} />
            </IconButton>
            {OWNER_UID && me.uid === OWNER_UID && (
              <IconButton label="Owner console" onClick={() => onNavigate('owner')}>
                <Settings2 size={19} />
              </IconButton>
            )}
            <IconButton label="Profile" onClick={() => onNavigate('profile')}>
              <CircleUser size={19} />
            </IconButton>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 px-3">
          <Search size={16} className="text-slate-500" />
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search chats"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
          />
        </div>
      </header>

      {/* chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-28">
        {pendingCount > 0 && (
          <button
            onClick={() => onNavigate('contacts')}
            className="w-full mb-2 flex items-center gap-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 px-3 py-3 text-left"
          >
            <span className="w-9 h-9 rounded-full bg-sky-500/20 grid place-items-center text-sky-300">
              <Bell size={16} />
            </span>
            <span className="text-sm text-sky-200 flex-1">
              {pendingCount} contact request{pendingCount > 1 ? 's' : ''} waiting
            </span>
            <span className="text-xs text-sky-300">Review</span>
          </button>
        )}

        {filtered.length === 0 && (
          <div className="mt-16 text-center px-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 grid place-items-center text-slate-500">
              <MessageSquarePlus size={22} />
            </div>
            <p className="mt-4 text-sm text-slate-400">
              {queryText ? 'No chats match that search.' : 'No chats yet — add your family to get started.'}
            </p>
            {!queryText && (
              <button
                onClick={() => onNavigate('contacts')}
                className="mt-4 rounded-xl bg-sky-500 text-slate-950 text-sm font-semibold px-4 py-2"
              >
                Find family
              </button>
            )}
          </div>
        )}

        {filtered.map((chat) => (
          <ChatRow key={chat.id} chat={chat} onClick={() => onOpenChat(chat)} />
        ))}
      </div>

      {/* new chat FAB */}
      <button
        onClick={() => setNewChatOpen(true)}
        aria-label="New chat"
        className="fixed bottom-6 right-5 w-14 h-14 rounded-2xl bg-sky-500 text-slate-950 shadow-xl shadow-sky-500/30 grid place-items-center active:scale-95 transition"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <Sheet open={newChatOpen} title={groupMode ? 'New group' : 'New chat'} onClose={() => setNewChatOpen(false)}>
        <div className="flex gap-2 mb-3">
          <Toggle active={!groupMode} onClick={() => setGroupMode(false)}>
            Direct
          </Toggle>
          <Toggle active={groupMode} onClick={() => setGroupMode(true)}>
            Group
          </Toggle>
        </div>

        {groupMode && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            maxLength={30}
            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-sky-500 mb-3"
          />
        )}

        <p className="text-xs text-slate-500 mb-2">
          {people.length ? 'Pick from your contacts' : 'No accepted contacts yet — add someone first.'}
        </p>

        <div className="space-y-1.5">
          {people.map((p) => {
            const selected = picked.includes(p.uid)
            return (
              <button
                key={p.uid}
                onClick={() => {
                  if (!groupMode) return startDirect(p.uid)
                  setPicked((cur) =>
                    cur.includes(p.uid) ? cur.filter((x) => x !== p.uid) : [...cur, p.uid]
                  )
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                  selected ? 'bg-sky-500/15 ring-1 ring-sky-500/40' : 'hover:bg-slate-800'
                }`}
              >
                <Avatar src={p.photoURL} name={displayName(p)} size={38} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-100 truncate">{displayName(p)}</span>
                  <span className="block text-xs text-slate-500 truncate">@{p.username}</span>
                </span>
                {groupMode && (
                  <span
                    className={`w-5 h-5 rounded-full border grid place-items-center ${
                      selected ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {selected ? '✓' : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {groupMode && (
          <button
            onClick={createGroup}
            disabled={busy || picked.length === 0}
            className="mt-4 w-full rounded-xl bg-sky-500 text-slate-950 font-semibold py-3 disabled:opacity-40"
          >
            Create group {picked.length ? `(${picked.length})` : ''}
          </button>
        )}
      </Sheet>
    </div>
  )
}

function ChatRow({ chat, onClick }) {
  const label = chat.title || chat.name || 'Chat'
  const preview = chat.typing?.length
    ? 'typing…'
    : chat.lastMessage || (chat.type === 'group' ? 'Group created' : 'Say hello 👋')
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left active:bg-slate-900 transition"
    >
      <Avatar src={chat.photoURL} name={label} size={50} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-100 truncate">{label}</span>
          {chat.type === 'group' && (
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {chat.members?.length || 0} members
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500 shrink-0">
            {timeAgo(chat.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-sm truncate ${chat.unread ? 'text-slate-200' : 'text-slate-500'}`}>
            {preview}
          </span>
          {chat.unread > 0 && (
            <span className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-sky-500 text-slate-950 text-[11px] font-bold grid place-items-center">
              {chat.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function IconButton({ children, label, onClick, badge }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="relative p-2.5 rounded-xl text-slate-300 hover:bg-slate-900 active:scale-95 transition"
    >
      {children}
      {badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950" />
      )}
    </button>
  )
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
        active ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}
