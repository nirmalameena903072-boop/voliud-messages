import { useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Loader2,
  LogOut,
  Pencil,
  QrCode,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Avatar from '../components/Avatar.jsx'
import Sheet from '../components/Sheet.jsx'
import { uploadMedia } from '../lib/media.js'
import { resolvedCloudinary, DEMO_MODE } from '../firebase.js'

export default function ProfileScreen({ api, me, onBack, onSignOut }) {
  const [nickname, setNickname] = useState(me.nickname || '')
  const [editing, setEditing] = useState(false)
  const [photoURL, setPhotoURL] = useState(me.photoURL || '')
  const [uploading, setUploading] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const inviteLink = `${window.location.origin}/?add=${me.username}`
  const canUpload = Boolean(resolvedCloudinary.cloudName && resolvedCloudinary.uploadPreset)

  const saveNickname = async () => {
    await api.updateProfile({ nickname: nickname.trim() })
    setEditing(false)
    flashSaved()
  }

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const changePhoto = async () => {
    setError('')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (!canUpload) {
        setError('Add Cloudinary details in src/firebase-config.js to upload photos.')
        return
      }
      setUploading(true)
      try {
        const url = await uploadMedia(file)
        await api.updateProfile({ photoURL: url })
        setPhotoURL(url)
        flashSaved()
      } catch (e) {
        setError(e.message)
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      flashSaved()
    } catch {
      /* ignore */
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
        <h1 className="font-semibold text-slate-100">Profile</h1>
        {saved && (
          <span className="ml-auto text-[11px] text-emerald-400 flex items-center gap-1">
            <Check size={13} /> Saved
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <div className="mt-6 flex flex-col items-center">
          <button onClick={changePhoto} className="relative group" aria-label="Change photo">
            <Avatar src={photoURL} name={me.nickname || me.username} size={96} />
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-sky-500 text-slate-950 grid place-items-center ring-4 ring-slate-950">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            </span>
          </button>
          <h2 className="mt-3 text-lg font-semibold text-slate-100">{me.nickname || 'No nickname yet'}</h2>
          <p className="text-sm text-sky-400">@{me.username}</p>
          {error && <p className="mt-2 text-xs text-amber-400 text-center max-w-xs">{error}</p>}
        </div>

        <div className="mt-7 space-y-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Nickname</p>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-slate-400 p-1">
                  <Pencil size={14} />
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                  className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button onClick={saveNickname} className="p-2 rounded-xl bg-sky-500 text-slate-950">
                  <Check size={15} />
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setNickname(me.nickname || '')
                  }}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-slate-200">{me.nickname || '—'}</p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Username</p>
            <p className="mt-1.5 text-sm text-slate-200">@{me.username}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Permanent — family finds you with this. Your internal id stays private.
            </p>
          </div>

          <button
            onClick={() => setQrOpen(true)}
            className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-3 text-left"
          >
            <span className="w-9 h-9 rounded-xl bg-sky-500/15 grid place-items-center text-sky-400">
              <QrCode size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-sm text-slate-200">Your QR profile card</span>
              <span className="block text-[11px] text-slate-500">Let family scan to add you</span>
            </span>
          </button>

          <button
            onClick={copyLink}
            className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-3 text-left"
          >
            <span className="w-9 h-9 rounded-xl bg-slate-800 grid place-items-center text-slate-300">
              <Copy size={16} />
            </span>
            <span className="flex-1">
              <span className="block text-sm text-slate-200">Copy invite link</span>
              <span className="block text-[11px] text-slate-500 truncate">{inviteLink}</span>
            </span>
          </button>

          {DEMO_MODE && (
            <p className="text-[11px] text-amber-300/80 text-center leading-relaxed">
              Demo profile — sign in with Firebase to make this yours.
            </p>
          )}

          <button
            onClick={onSignOut}
            className="w-full rounded-2xl bg-rose-500/10 border border-rose-500/25 py-3.5 text-sm font-semibold text-rose-300 flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> {DEMO_MODE ? 'Leave demo' : 'Sign out'}
          </button>
        </div>
      </div>

      <Sheet open={qrOpen} title="QR profile card" onClose={() => setQrOpen(false)}>
        <div className="flex flex-col items-center">
          <div className="rounded-3xl bg-white p-3">
            <QRCodeSVG value={inviteLink} size={180} level="M" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">{me.nickname || '@' + me.username}</p>
          <p className="text-xs text-slate-500">@{me.username}</p>
          <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed max-w-xs">
            Scanning opens Voliud with a one-tap contact request already filled in.
          </p>
        </div>
      </Sheet>
    </div>
  )
}
