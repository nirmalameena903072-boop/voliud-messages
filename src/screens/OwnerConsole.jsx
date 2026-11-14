import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { ArrowLeft, Crown, Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { db, OWNER_UID } from '../firebase.js'
import { displayName, timeAgo } from '../lib/utils.js'

// App-Owner Console. Locked to the Firebase uid in firebase-config.js —
// there is no admin password here, so there is nothing to leak.
export default function OwnerConsole({ me, onBack }) {
  const [users, setUsers] = useState([])
  const [chats, setChats] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  const allowed = Boolean(OWNER_UID) && me.uid === OWNER_UID

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const [u, c] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(100))),
          getDocs(query(collection(db, 'chats'), limit(100))),
        ])
        setUsers(u.docs.map((d) => ({ uid: d.id, ...d.data() })))
        setChats(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      } finally {
        setLoading(false)
      }
    })()
  }, [allowed])

  const stats = useMemo(
    () => [
      { label: 'Members', value: users.length, icon: <Users size={15} /> },
      { label: 'Chats', value: chats.length, icon: <ShieldCheck size={15} /> },
      {
        label: 'Group chats',
        value: chats.filter((c) => c.type === 'group').length,
        icon: <Crown size={15} />,
      },
    ],
    [users, chats]
  )

  const filtered = users.filter((u) => {
    const q = text.trim().toLowerCase()
    if (!q) return true
    return (u.username || '').includes(q) || (u.nickname || '').toLowerCase().includes(q)
  })

  if (!allowed) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center gap-3 bg-slate-950">
        <ShieldAlert size={30} className="text-rose-400" />
        <p className="text-sm text-slate-300 font-semibold">Owner console locked</p>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
          This page only unlocks for the Firebase uid set as <code>OWNER_UID</code> in{' '}
          <code>src/firebase-config.js</code>. No admin password exists anywhere.
        </p>
        <button onClick={onBack} className="mt-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <header className="shrink-0 flex items-center gap-2 px-2 py-2.5 border-b border-slate-800">
        <button
          onClick={onBack}
          aria-label="Back"
          className="p-2 rounded-xl hover:bg-slate-900 text-slate-300"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-slate-100">Owner console</h1>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-emerald-400">Verified</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
              <span className="text-sky-400">{s.icon}</span>
              <p className="mt-1.5 text-xl font-bold text-slate-100 tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 px-3">
          <Search size={15} className="text-slate-500" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search members"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
          />
        </div>

        <h2 className="mt-4 text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
          Members · {filtered.length}
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">No members found.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((u) => (
              <div key={u.uid} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-slate-900">
                <Avatar src={u.photoURL} name={displayName(u)} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{displayName(u)}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    @{u.username || 'unclaimed'} · joined {timeAgo(u.createdAt) || '—'}
                  </p>
                </div>
                {u.uid === OWNER_UID && (
                  <span className="rounded-full bg-amber-400/10 text-amber-300 px-2 py-1 text-[10px] font-semibold">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-[11px] text-slate-600 leading-relaxed">
          Owner-only by uid. To change the owner, edit OWNER_UID in src/firebase-config.js and
          redeploy.
        </p>
      </div>
    </div>
  )
}
