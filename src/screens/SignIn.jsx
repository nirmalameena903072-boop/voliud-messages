import { useState } from 'react'
import { MessageCircle, ShieldCheck, Users, Video, Wifi } from 'lucide-react'
import { DEMO_MODE } from '../firebase.js'

export default function SignIn({ onSignIn }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    setBusy(true)
    setError('')
    try {
      await onSignIn()
    } catch (e) {
      setError(e?.message || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col justify-between px-6 py-10 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-400 to-cyan-300 grid place-items-center shadow-lg shadow-sky-500/30">
          <MessageCircle size={30} className="text-slate-900" strokeWidth={2.4} />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          Voliud<span className="text-sky-400"> Messages</span>
        </h1>
        <p className="mt-2 text-slate-400 leading-relaxed">
          A private, zero-cost messenger for your family. Built on a phone, runs in the
          browser, installs like an app.
        </p>

        <div className="mt-7 space-y-3 text-sm text-slate-300">
          <Feature icon={<Wifi size={16} />} text="Real-time chats with typing indicators" />
          <Feature icon={<Video size={16} />} text="45-second video calls that auto-expire" />
          <Feature icon={<Users size={16} />} text="Groups, polls and 24-hour status notes" />
          <Feature icon={<ShieldCheck size={16} />} text="No ads. No tracking. No bills." />
        </div>
      </div>

      <div className="space-y-3">
        {DEMO_MODE && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-200 text-xs leading-relaxed">
            <span className="font-semibold">Preview mode.</span> No Firebase keys yet, so this
            is a local demo with a sample family. Add your config to{' '}
            <code className="text-amber-100">src/firebase-config.js</code> to go live.
          </div>
        )}

        <button
          onClick={handle}
          disabled={busy || DEMO_MODE}
          className="w-full rounded-2xl bg-white text-slate-900 font-semibold py-4 flex items-center justify-center gap-3 active:scale-[0.99] transition disabled:opacity-40"
        >
          <GoogleMark />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {DEMO_MODE && (
          <p className="text-center text-xs text-slate-500">
            Explore the demo — anything you send stays in this tab.
          </p>
        )}
        {error && <p className="text-center text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  )
}

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-7 rounded-lg bg-slate-800 grid place-items-center text-sky-400 shrink-0">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.7 5.2-4.9 7.3l7.6 5.9c4.5-4.2 6.9-10.3 6.9-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.6-5.9c-2 1.4-4.8 2.4-7.7 2.4-6.4 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}
