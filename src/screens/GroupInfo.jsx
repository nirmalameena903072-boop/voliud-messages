import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  Crown,
  Loader2,
  LogOut,
  Pencil,
  Shield,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Sheet from '../components/Sheet.jsx'
import { displayName } from '../lib/utils.js'
import { uploadMedia } from '../lib/media.js'
import { resolvedCloudinary } from '../firebase.js'

// Group drawer: rename, change photo, promote/demote, remove members,
// add contacts, and exit safely (crown passes on if you're the last admin).
export default function GroupInfo({ api, me, chat: initialChat, onBack, onExited }) {
  const [chat, setChat] = useState(initialChat)
  const [name, setName] = useState(initialChat.name || '')
  const [editName, setEditName] = useState(false)
  const [members, setMembers] = useState([])
  const [contacts, setContacts] = useState({ accepted: [] })
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = (chat.admins || []).includes(me.uid)

  useEffect(() => {
    return api.subscribeChat(chat.id, (updated) => {
      if (updated) setChat(updated)
    })
  }, [api, chat.id])

  useEffect(() => api.subscribeContacts(setContacts), [api])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const list = []
      for (const uid of chat.members || []) {
        if (uid === me.uid) {
          list.push({ uid, username: me.username, nickname: me.nickname, photoURL: me.photoURL })
          continue
        }
        const person = api.demo
          ? api.person(uid)
          : await api.getProfile(uid).catch(() => null)
        list.push(
          person
            ? { uid, username: person.username, nickname: person.nickname, photoURL: person.photoURL }
            : { uid, username: '', nickname: 'Member', photoURL: '' }
        )
      }
      if (alive) setMembers(list)
    })()
    return () => {
      alive = false
    }
  }, [chat, api, me])

  const contactOptions = useMemo(() => {
    const inGroup = new Set(chat.members || [])
    return contacts.accepted
      .map((r) => {
        const otherUid = r.uids.find((u) => u !== me.uid)
        const card = r.people?.[otherUid] || {}
        return {
          uid: otherUid,
          username: card.username || '',
          nickname: card.nickname || 'Contact',
          photoURL: card.photoURL || '',
        }
      })
      .filter((p) => !inGroup.has(p.uid))
  }, [contacts.accepted, chat.members, api, me.uid])

  const saveName = async () => {
    const clean = name.trim()
    if (!clean) return
    await api.updateChat(chat.id, { name: clean })
    setEditName(false)
  }

  const savePhoto = async () => {
    setError('')
    if (!resolvedCloudinary.cloudName) {
      setError('Add Cloudinary details to enable group photos.')
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        const url = await uploadMedia(file)
        await api.updateChat(chat.id, { photoURL: url })
      } catch (e) {
        setError(e.message)
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  const exitGroup = async () => {
    const others = (chat.members || []).filter((m) => m !== me.uid)
    const leaving = isAdmin && others.length > 0
    const message = leaving
      ? 'You are an admin. Admin rights will pass to another member. Exit anyway?'
      : 'Leave this group?'
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      await api.exitGroup(chat.id, { admins: chat.admins || [], members: chat.members || [] })
      onExited?.()
    } finally {
      setBusy(false)
    }
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
        <h1 className="font-semibold text-slate-100">Group info</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="mt-6 flex flex-col items-center">
          <button onClick={isAdmin ? savePhoto : undefined} className="relative" aria-label="Group photo">
            <Avatar src={chat.photoURL} name={chat.name} size={88} />
            {isAdmin && (
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-500 text-slate-950 grid place-items-center ring-4 ring-slate-950">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </span>
            )}
          </button>

          {editName ? (
            <div className="mt-3 flex items-center gap-2 w-full max-w-xs">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-center outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button onClick={saveName} className="p-2 rounded-xl bg-sky-500 text-slate-950">
                <Check size={15} />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-100">{chat.name || 'Group'}</h2>
              {isAdmin && (
                <button onClick={() => setEditName(true)} className="text-slate-500 p-1">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {(chat.members || []).length} members · {(chat.admins || []).length} admin
            {(chat.admins || []).length === 1 ? '' : 's'}
          </p>
          {error && <p className="mt-2 text-xs text-amber-400 text-center">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wide text-slate-500">Members</h3>
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-[11px] font-semibold text-sky-400 flex items-center gap-1"
            >
              <UserPlus size={13} /> Add
            </button>
          )}
        </div>

        <div className="mt-2 space-y-1">
          {members.map((m) => {
            const admin = (chat.admins || []).includes(m.uid)
            const isMe = m.uid === me.uid
            return (
              <div key={m.uid} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-slate-900">
                <Avatar src={m.photoURL} name={displayName(m)} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {displayName(m)} {isMe && <span className="text-slate-500 font-normal">(you)</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">@{m.username || 'private'}</p>
                </div>
                {admin ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/10 text-amber-300 px-2 py-1 text-[10px] font-semibold">
                    <Crown size={11} /> Admin
                  </span>
                ) : null}
                {isAdmin && !isMe && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => (admin ? api.demote(chat.id, m.uid) : api.promote(chat.id, m.uid))}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
                      aria-label={admin ? 'Remove admin' : 'Make admin'}
                    >
                      <Shield size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${displayName(m)} from the group?`)) {
                          api.removeMember(chat.id, m.uid)
                        }
                      }}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      aria-label="Remove member"
                    >
                      <UserMinus size={15} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!isAdmin && (
          <p className="mt-4 text-[11px] text-slate-500 text-center leading-relaxed">
            Only admins can rename the group, change the photo or manage members.
          </p>
        )}

        <button
          onClick={exitGroup}
          disabled={busy}
          className="mt-7 w-full rounded-2xl bg-rose-500/10 border border-rose-500/25 py-3.5 text-sm font-semibold text-rose-300 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <LogOut size={16} /> Exit group
        </button>
      </div>

      <Sheet open={addOpen} title="Add members" onClose={() => setAddOpen(false)}>
        {contactOptions.length === 0 ? (
          <p className="text-sm text-slate-400">
            Everyone in your contacts is already here. Add more contacts first.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contactOptions.map((p) => (
              <button
                key={p.uid}
                onClick={async () => {
                  await api.addMember(chat.id, p.uid)
                  setAddOpen(false)
                }}
                className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-800"
              >
                <Avatar src={p.photoURL} name={displayName(p)} size={38} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-100 truncate">{displayName(p)}</span>
                  <span className="block text-xs text-slate-500 truncate">@{p.username}</span>
                </span>
                <Plus />
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Plus() {
  return <UserPlus size={16} className="text-sky-400" />
}
