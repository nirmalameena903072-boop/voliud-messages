import { useState } from 'react'
import { AtSign, Check, Loader2, User, X } from 'lucide-react'
import { isValidUsername, normalizeUsername } from '../lib/utils.js'
import Avatar from '../components/Avatar.jsx'

// First-run: pick a permanent lowercase @username + a free-text nickname.
export default function ProfileSetup({ api, me, onDone }) {
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState(me?.nickname || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const clean = normalizeUsername(username)
  const valid = isValidUsername(clean)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!valid) {
      setError('3–12 characters. Lowercase letters, numbers and underscores only.')
      return
    }
    setBusy(true)
    try {
      const profile = await api.claimUsername(clean, {
        nickname: nickname.trim(),
        photoURL: me?.photoURL || '',
        email: me?.email || '',
      })
      onDone(profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col justify-center px-6 max-w-md mx-auto">
      <div className="mb-6 flex justify-center">
        <Avatar src={me?.photoURL} name={nickname || clean || 'You'} size={76} />
      </div>

      <h1 className="text-2xl font-bold text-white text-center">Claim your name</h1>
      <p className="text-slate-400 text-sm text-center mt-1 mb-6">
        Your username is how family finds you. It stays lowercase and unique.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Username
          </span>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-slate-800/80 border border-slate-700 px-3 focus-within:border-sky-500">
            <AtSign size={16} className="text-slate-500" />
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="aarav"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-transparent py-3 outline-none text-white placeholder:text-slate-500"
            />
            <span className="text-xs text-slate-500 tabular-nums">{clean.length}/12</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Nickname
          </span>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-slate-800/80 border border-slate-700 px-3 focus-within:border-sky-500">
            <User size={16} className="text-slate-500" />
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What family calls you"
              maxLength={24}
              className="flex-1 bg-transparent py-3 outline-none text-white placeholder:text-slate-500"
            />
          </div>
        </label>

        {error && (
          <p className="text-sm text-rose-400 flex items-start gap-2">
            <X size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold py-3.5 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {busy ? 'Saving…' : 'Start messaging'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 mt-5 leading-relaxed">
        Your internal id stays hidden. Invite link:{' '}
        <span className="text-sky-400 break-all">
          {(typeof window !== 'undefined' ? window.location.host : '') + '/?add='}
          {clean || 'yourname'}
        </span>
      </p>
    </div>
  )
}
