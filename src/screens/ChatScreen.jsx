import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Info,
  Loader2,
  Plus,
  Send,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import TypingDots from '../components/TypingDots.jsx'
import { clockTime, dayLabel, nameOf, secondsLabel } from '../lib/utils.js'

export default function ChatScreen({ api, me, chat: initialChat, onBack, onOpenGroupInfo }) {
  const [chat, setChat] = useState(initialChat)
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState([])
  const [draft, setDraft] = useState('')
  const [pollOpen, setPollOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const chatId = initialChat.id

  useEffect(() => api.subscribeChat(chatId, (c) => c && setChat(c)), [api, chatId])
  useEffect(() => api.subscribeMessages(chatId, setMessages), [api, chatId])
  useEffect(() => api.subscribeTyping(chatId, setTyping), [api, chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typing.length])

  const peerCard = useMemo(() => {
    if (chat?.type !== 'direct') return null
    return chat.people?.[chat.peerUid] || null
  }, [chat])

  const title = chat?.title || (chat?.type === 'group' ? chat.name || 'Group' : nameOf(peerCard) || 'Chat')

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    api.setTyping(chatId, false)
    try {
      await api.sendMessage(chatId, {
        type: 'text',
        text,
        senderName: me.nickname || me.username,
      })
      await api.touchChat(chatId, `${me.nickname || 'You'}: ${text.slice(0, 70)}`)
    } finally {
      setSending(false)
    }
  }

  const startCall = async () => {
    const room = `voliud-${chatId.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random()
      .toString(36)
      .slice(2, 7)}`
    await api.sendMessage(chatId, {
      type: 'call',
      jitsiRoom: room,
      expiresAt: Date.now() + 45000,
      senderName: me.nickname || me.username,
    })
    await api.touchChat(chatId, '📹 Video call started — 45s')
  }

  const onDraftChange = (value) => {
    setDraft(value)
    api.setTyping(chatId, value.trim().length > 0)
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* header */}
      <header className="shrink-0 flex items-center gap-2 px-2 py-2.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-900 text-slate-300" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={onOpenGroupInfo}
          disabled={!onOpenGroupInfo}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:cursor-default"
        >
          <Avatar src={chat?.photoURL} name={title} size={38} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-100 truncate">{title}</span>
            <span className="block text-[11px] text-slate-500 truncate">
              {typing.length > 0
                ? 'typing…'
                : chat?.type === 'group'
                ? (chat.members || []).length + ' members'
                : 'Direct message'}
            </span>
          </span>
        </button>
        <button
          onClick={startCall}
          className="p-2.5 rounded-xl text-sky-400 hover:bg-slate-900"
          aria-label="Start 45-second video call"
        >
          <Video size={19} />
        </button>
        {chat?.type === 'group' && (
          <button onClick={onOpenGroupInfo} className="p-2.5 rounded-xl text-slate-300 hover:bg-slate-900" aria-label="Group info">
            <Info size={19} />
          </button>
        )}
      </header>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {messages.length === 0 && (
          <div className="mt-16 text-center px-10">
            <p className="text-sm text-slate-400">
              No messages yet. Say hi to {chat?.type === 'group' ? 'the group' : nameOf(peerCard)} 👋
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const showDay =
            !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt)
          const mine = m.senderUid === me.uid
          const sameSender =
            prev && prev.senderUid === m.senderUid && !showDay && m.type === 'text' && prev.type === 'text'
          return (
            <div key={m.id}>
              {showDay && m.createdAt && (
                <div className="my-3 text-center">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900 px-2.5 py-1 rounded-full">
                    {dayLabel(m.createdAt)}
                  </span>
                </div>
              )}
              {m.type === 'poll' ? (
                <PollBubble message={m} mine={mine} api={api} chatId={chatId} me={me} />
              ) : m.type === 'call' ? (
                <CallBubble message={m} mine={mine} me={me} />
              ) : (
                <TextBubble message={m} mine={mine} grouped={sameSender} chat={chat} me={me} />
              )}
            </div>
          )
        })}

        {typing.length > 0 && (
          <div className="flex items-center gap-2 pl-1 pt-1">
            <span className="rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2">
              <TypingDots />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        {pollOpen && (
          <PollComposer
            api={api}
            chatId={chatId}
            me={me}
            onClose={() => setPollOpen(false)}
          />
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => setPollOpen((v) => !v)}
            className={`p-2.5 rounded-xl shrink-0 ${pollOpen ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900'}`}
            aria-label="Create poll"
          >
            <BarChart3 size={19} />
          </button>
          <div className="flex-1 flex items-end rounded-2xl bg-slate-900 border border-slate-800 px-3 focus-within:border-slate-600">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Message"
              className="w-full resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500 max-h-28"
            />
          </div>
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="p-2.5 rounded-xl bg-sky-500 text-slate-950 disabled:opacity-40 shrink-0 active:scale-95 transition"
            aria-label="Send"
          >
            {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextBubble({ message, mine, grouped, chat, me }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'pt-1.5'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          mine
            ? 'bg-sky-500 text-slate-950 rounded-br-md'
            : 'bg-slate-800 text-slate-100 rounded-bl-md'
        }`}
      >
        {!mine && chat?.type === 'group' && !grouped && (
          <span className="block text-[11px] font-semibold text-sky-300 mb-0.5">
            {message.senderName || 'Family'}
          </span>
        )}
        {message.text}
        <span className={`block text-[10px] mt-1 text-right ${mine ? 'text-slate-900/60' : 'text-slate-500'}`}>
          {clockTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

// 45-second Jitsi Meet card. Everyone derives the countdown from the
// stored expiresAt, so the card dies on every phone at the same moment.
function CallBubble({ message, mine, me }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const remaining = Math.max(0, Math.ceil(((message.expiresAt || 0) - now) / 1000))
  const expired = remaining <= 0
  const progress = Math.min(100, Math.max(0, (remaining / 45) * 100))

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} pt-2`}>
      <div
        className={`w-64 rounded-2xl border overflow-hidden ${
          expired ? 'border-slate-800 bg-slate-900/60' : 'border-sky-500/40 bg-slate-900'
        }`}
      >
        <div className="relative h-24 bg-gradient-to-br from-sky-600/30 to-indigo-600/20 grid place-items-center">
          <Video size={26} className={expired ? 'text-slate-600' : 'text-sky-300'} />
          {!expired && (
            <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-sky-200 bg-slate-950/70 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {secondsLabel(remaining)}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-slate-100">Jitsi video call</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {expired ? 'This call has expired.' : `${message.senderName || 'Someone'} started a 45-second call.`}
          </p>
          <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <a
            href={expired ? undefined : `https://meet.jit.si/${message.jitsiRoom}`}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 block text-center rounded-xl py-2 text-sm font-semibold ${
              expired
                ? 'bg-slate-800 text-slate-500 pointer-events-none'
                : 'bg-sky-500 text-slate-950 active:scale-95 transition'
            }`}
          >
            {expired ? 'Expired' : 'Join now'}
          </a>
        </div>
      </div>
    </div>
  )
}

function PollBubble({ message, mine, api, chatId, me }) {
  const votes = message.votes || {}
  const counts = message.options.map((_, i) => (votes[String(i)] || []).length)
  const total = counts.reduce((a, b) => a + b, 0)
  const myVote = message.options.findIndex((_, i) =>
    (votes[String(i)] || []).includes(me.uid)
  )

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} pt-2`}>
      <div className="w-72 rounded-2xl bg-slate-900 border border-slate-800 p-3">
        <p className="text-[10px] uppercase tracking-wide text-sky-400 font-semibold mb-1">
          Poll · {total} vote{total === 1 ? '' : 's'}
        </p>
        <p className="text-sm font-semibold text-slate-100 mb-2.5">{message.question}</p>
        <div className="space-y-1.5">
          {message.options.map((opt, i) => {
            const pct = total ? Math.round((counts[i] / total) * 100) : 0
            const chosen = myVote === i
            return (
              <button
                key={i}
                onClick={() => api.votePoll(chatId, message.id, i)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs transition ${
                  chosen
                    ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                    : 'border-slate-700 text-slate-200 active:bg-slate-800'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-slate-700/60"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="truncate">{opt}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">{pct}%</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PollComposer({ api, chatId, me, onClose }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [busy, setBusy] = useState(false)

  const canPost =
    question.trim().length > 2 && options.filter((o) => o.trim()).length >= 2

  const post = async () => {
    if (!canPost) return
    setBusy(true)
    try {
      await api.sendMessage(chatId, {
        type: 'poll',
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
        votes: {},
        senderName: me.nickname || me.username,
      })
      await api.touchChat(chatId, `📊 ${question.trim().slice(0, 60)}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-300">Quick poll</p>
        <button onClick={onClose} className="text-slate-500 p-1">
          <X size={15} />
        </button>
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask your family something…"
        className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 mb-1.5"
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1.5">
          <input
            value={opt}
            onChange={(e) =>
              setOptions((cur) => cur.map((o, j) => (j === i ? e.target.value : o)))
            }
            placeholder={`Option ${i + 1}`}
            className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
          />
          {options.length > 2 && (
            <button
              onClick={() => setOptions((cur) => cur.filter((_, j) => j !== i))}
              className="p-1.5 text-slate-500"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        {options.length < 5 && (
          <button
            onClick={() => setOptions((cur) => [...cur, ''])}
            className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300 flex items-center gap-1"
          >
            <Plus size={13} /> Option
          </button>
        )}
        <button
          onClick={post}
          disabled={!canPost || busy}
          className="ml-auto rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40"
        >
          Post poll
        </button>
      </div>
    </div>
  )
}
