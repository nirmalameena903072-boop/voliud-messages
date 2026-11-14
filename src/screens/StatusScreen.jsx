import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Send, Trash2, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { timeAgo } from '../lib/utils.js'

export default function StatusScreen({ api, me, onBack }) {
  const [statuses, setStatuses] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => api.subscribeStatuses(setStatuses), [api])

  const mine = statuses.find((s) => s.uid === me.uid)
  const others = useMemo(() => statuses.filter((s) => s.uid !== me.uid), [statuses, me.uid])

  const post = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      await api.postStatus(body, me.nickname || me.username)
      setText('')
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
        <h1 className="font-semibold text-slate-100">Status</h1>
        <span className="ml-auto text-[11px] text-slate-500">Disappears after 24h</span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-8">
        {/* my status */}
        <section className="mt-4">
          <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">My status</h2>
          {mine ? (
            <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 to-slate-900 border border-sky-500/25 p-3.5 flex items-start gap-3">
              <Avatar src={me.photoURL} name={me.nickname} size={40} ring />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-100 leading-relaxed">{mine.text}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Live · expires in {Math.max(0, Math.ceil((mine.expiresAt - Date.now()) / 3600000))}h
                </p>
              </div>
              <button
                onClick={() => api.clearStatus()}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
                aria-label="Delete status"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && post()}
                  maxLength={120}
                  placeholder="Share a quick note…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={post}
                  disabled={!text.trim() || busy}
                  className="p-2 rounded-xl bg-sky-500 text-slate-950 disabled:opacity-40"
                  aria-label="Post status"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{text.length}/120 characters</p>
            </div>
          )}
        </section>

        {/* family statuses */}
        <section className="mt-5">
          <h2 className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
            Family updates · {others.length}
          </h2>
          {others.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
              Nothing here yet. Add contacts and their notes will show up here.
            </div>
          ) : (
            <div className="space-y-2">
              {others.map((s) => (
                <div key={s.uid} className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar src={s.photoURL} name={s.authorName} size={32} ring />
                    <p className="text-sm font-semibold text-slate-100">{s.authorName || 'Family'}</p>
                    <span className="ml-auto text-[11px] text-slate-500">{timeAgo(s.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
