import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Link2,
  Loader2,
  QrCode,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Sheet from '../components/Sheet.jsx'
import { displayName, normalizeUsername, timeAgo } from '../lib/utils.js'
import { QRCodeSVG } from 'qrcode.react'

export default function ContactsScreen({ api, me, onBack }) {
  const [contacts, setContacts] = useState({ accepted: [], incoming: [], outgoing: [], all: [] })
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => api.subscribeContacts(setContacts), [api])

  useEffect(() => {
    const q = normalizeUsername(text)
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const found = await api.searchUsers(q)
        if (!cancelled) setResults(found)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, api])

  const people = useMemo(
    () =>
      contacts.accepted.map((r) => {
        const otherUid = r.uids.find((u) => u !== me.uid)
        const card = r.people?.[otherUid] || {}
        return {
          uid: otherUid,
          username: card.username || 'unknown',
          nickname: card.nickname || '',
          photoURL: card.photoURL || '',
        }
      }),
    [contacts.accepted, me.uid]
  )

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const add = async (person) => {
    await api.sendContactRequest(person.uid, person.username)
    flash(`Request sent to @${person.username}`)
    setText('')
    setResults([])
  }

  const inviteLink = `${window.location.origin}/?add=${me.username}`

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      flash('Invite link copied')
    } catch {
      flash('Long-press the link to copy')
    }
  }

  const share = async () => {
    const data = {
      title: 'Voliud Messages',
      text: `Message me on Voliud — @${me.username}`,
      url: inviteLink,
    }
    if (navigator.share) {
      try {
        await navigator.share(data)
      } catch {
        /* user cancelled */
      }
    } else {
      copyInvite()
    }
  }

  const searchState = (uid) => {
    if (people.some((p) => p.uid === uid)) return 'added'
    if (contacts.outgoing.some((r) => r.uids.includes(uid))) return 'pending'
    if (contacts.incoming.some((r) => r.uids.includes(uid))) return 'incoming'
    return 'none'
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
        <h1 className="font-semibold text-slate-100">Contacts</h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="ml-auto p-2 rounded-xl text-sky-400 hover:bg-slate-900"
          aria-label="Invite"
        >
          <QrCode size={19} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-8">
        {/* search */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 px-3 focus-within:border-slate-600">
          <Search size={16} className="text-slate-500" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Find family by @username"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
          />
          {searching && <Loader2 size={15} className="animate-spin text-slate-500" />}
          {!!text && !searching && (
            <button onClick={() => setText('')} className="text-slate-500">
              <X size={15} />
            </button>
          )}
        </div>

        {/* live search preview cards */}
        {results.length > 0 && (
          <section className="mt-3">
            <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Search results</h2>
            <div className="space-y-1.5">
              {results.map((person) => {
                const state = searchState(person.uid)
                return (
                  <div
                    key={person.uid}
                    className="flex items-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 px-3 py-2.5"
                  >
                    <Avatar src={person.photoURL} name={displayName(person)} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {person.nickname || '@' + person.username}
                      </p>
                      <p className="text-xs text-slate-500 truncate">@{person.username}</p>
                    </div>
                    {state === 'added' && <Pill tone="muted">Added</Pill>}
                    {state === 'pending' && <Pill tone="muted">Requested</Pill>}
                    {state === 'incoming' ? (
                      <Pill tone="sky">Wants to add you</Pill>
                    ) : state === 'none' ? (
                      <button
                        onClick={() => add(person)}
                        className="shrink-0 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 flex items-center gap-1"
                      >
                        <UserPlus size={13} /> Add
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* incoming */}
        {contacts.incoming.length > 0 && (
          <section className="mt-4">
            <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Requests · {contacts.incoming.length}
            </h2>
            <div className="space-y-1.5">
              {contacts.incoming.map((req) => {
                const otherUid = req.uids.find((u) => u !== me.uid)
                const person = { uid: otherUid, ...(req.people?.[otherUid] || {}) }
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 px-3 py-2.5"
                  >
                    <Avatar src={person?.photoURL} name={displayName(person)} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {person ? displayName(person) : 'Family member'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{timeAgo(req.createdAt)} ago</p>
                    </div>
                    <button
                      onClick={() => api.respondToRequest(req.id, true)}
                      className="rounded-xl bg-emerald-500 p-2 text-slate-950"
                      aria-label="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => api.respondToRequest(req.id, false)}
                      className="rounded-xl bg-slate-800 p-2 text-slate-400"
                      aria-label="Decline"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* outgoing */}
        {contacts.outgoing.length > 0 && (
          <section className="mt-4">
            <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Waiting for reply</h2>
            <div className="space-y-1.5">
              {contacts.outgoing.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-2xl bg-slate-900/60 border border-slate-800 px-3 py-2.5">
                  <span className="w-9 h-9 rounded-full bg-slate-800 grid place-items-center text-slate-500">
                    <Clock size={15} />
                  </span>
                  <p className="flex-1 text-sm text-slate-400">
                    Request pending · {timeAgo(req.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* accepted */}
        <section className="mt-4">
          <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
            Your family · {people.length}
          </h2>
          {people.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No contacts yet.</p>
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950"
              >
                Invite with a link
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {people.map((p) => (
                <div key={p.uid} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-slate-900">
                  <Avatar src={p.photoURL} name={displayName(p)} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{displayName(p)}</p>
                    <p className="text-xs text-slate-500 truncate">@{p.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={share}
          className="mt-6 w-full rounded-2xl border border-sky-500/30 bg-sky-500/10 py-3 text-sm font-semibold text-sky-200 flex items-center justify-center gap-2"
        >
          <Link2 size={16} /> Share invite link
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-800 text-slate-100 text-xs px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}

      <Sheet open={inviteOpen} title="Your invite" onClose={() => setInviteOpen(false)}>
        <div className="flex flex-col items-center">
          <div className="rounded-3xl bg-white p-3">
            <QRCodeSVG value={inviteLink} size={168} level="M" />
          </div>
          <p className="mt-3 text-sm text-slate-300">
            @{me.username} · {me.nickname || 'Voliud member'}
          </p>
          <div className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2.5 text-xs text-sky-300 break-all text-center">
            {inviteLink}
          </div>
          <button
            onClick={copyInvite}
            className="mt-3 w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-slate-950 flex items-center justify-center gap-2"
          >
            <Copy size={15} /> Copy link
          </button>
          <p className="mt-2 text-[11px] text-slate-500 text-center leading-relaxed">
            Anyone opening this link sends you a contact request in one tap.
          </p>
        </div>
      </Sheet>
    </div>
  )
}

function Pill({ children, tone = 'muted' }) {
  const cls =
    tone === 'sky'
      ? 'bg-sky-500/15 text-sky-300'
      : 'bg-slate-800 text-slate-400'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>{children}</span>
}
