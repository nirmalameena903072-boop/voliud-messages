import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  ExternalLink,
  Flag,
  Home,
  Info,
  Lock,
  PhoneOff,
  Plus,
  Send,
  StickyNote,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_FAMILY_NOTE_LENGTH,
  MAX_MESSAGE_LENGTH,
  sanitizeExternalUrl,
  sanitizePlainText,
} from '../utils/security';
import { AvatarRing3D, StatusDot, Tilt3DCard, TypingWave3D } from './Spatial3D';

function CallInviteCard({ msg, isMine, now, onRespondCall }) {
  const call = msg.call || {};
  const safeRoomUrl = sanitizeExternalUrl(call.roomUrl, ['meet.jit.si']);
  const expiresAt = call.expiresAt || 0;
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const isExpired = now > expiresAt && call.status === 'ringing';
  const effectiveStatus = isExpired ? 'expired' : call.status || 'ringing';

  const handleAccept = () => {
    if (safeRoomUrl) {
      window.open(safeRoomUrl, '_blank', 'noopener,noreferrer');
    }
    onRespondCall(msg.id, 'accepted');
  };

  return (
    <Tilt3DCard
      intensity={7}
      key={`${msg.id}-${effectiveStatus}`}
      className={`animate-call-flip w-[265px] max-w-full rounded-3xl border p-4 ${
        effectiveStatus === 'expired' || effectiveStatus === 'declined'
          ? 'border-white/14 bg-[#0D0D0D] text-white/70 shadow-spatial-card'
          : isMine
          ? 'border-white/30 bg-white text-black shadow-spatial-white'
          : 'border-white/25 bg-[#121212] text-white shadow-spatial-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
            effectiveStatus === 'expired' || effectiveStatus === 'declined'
              ? 'text-white/45'
              : isMine
              ? 'text-black/60'
              : 'text-white/60'
          }`}
        >
          {effectiveStatus === 'expired' || effectiveStatus === 'declined' ? (
            <PhoneOff className="h-3.5 w-3.5" />
          ) : (
            <Video className="h-3.5 w-3.5" />
          )}
          Jitsi Video Call
        </span>

        {effectiveStatus === 'ringing' && (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
              isMine ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            {remainingSec}s
          </span>
        )}
      </div>

      <div className="mt-2.5 text-sm font-semibold leading-snug">
        {effectiveStatus === 'expired'
          ? 'Call Cancelled — No response'
          : effectiveStatus === 'declined'
          ? 'Call Declined'
          : effectiveStatus === 'accepted'
          ? 'Call Connected'
          : isMine
          ? 'Ringing recipient...'
          : `${msg.senderNickname || `@${msg.senderUsername}`} invites you`}
      </div>

      {effectiveStatus === 'ringing' && (
        <>
          <div
            className={`mt-2 h-1 w-full overflow-hidden rounded-full ${
              isMine ? 'bg-black/15' : 'bg-white/15'
            }`}
          >
            <div
              className={`h-full transition-all duration-200 ${
                isMine ? 'bg-black' : 'bg-white'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (remainingMs / 45000) * 100))}%` }}
            />
          </div>

          {!isMine ? (
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onRespondCall(msg.id, 'declined')}
                className="rounded-xl border border-white/25 bg-black py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="flex items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-semibold text-black shadow-spatial-white transition active:scale-95"
              >
                <Video className="h-3.5 w-3.5" />
                Accept
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] opacity-65">Expires automatically at 0s</span>
              <button
                type="button"
                onClick={() => onRespondCall(msg.id, 'declined')}
                className="rounded-lg border border-black/20 px-2.5 py-1 text-[11px] font-medium hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {effectiveStatus === 'accepted' && safeRoomUrl && (
        <a
          href={safeRoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
            isMine
              ? 'bg-black text-white hover:bg-black/85'
              : 'bg-white text-black hover:bg-white/90'
          }`}
        >
          <span>Join Jitsi Room</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </Tilt3DCard>
  );
}

function PollMessageCard({ msg, isMine, myUid, onVotePoll }) {
  const poll = msg.poll || { question: '', options: [] };
  const totalVotes = (poll.options || []).reduce(
    (sum, opt) => sum + (opt.votes?.length || 0),
    0
  );

  return (
    <Tilt3DCard
      intensity={5}
      className={`w-[268px] max-w-full rounded-3xl border p-4 ${
        isMine
          ? 'border-white/30 bg-white text-black shadow-spatial-white'
          : 'border-white/20 bg-[#121212] text-white shadow-spatial-card'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
          isMine ? 'text-black/55' : 'text-white/50'
        }`}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        <span>Quick Poll</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-snug">{poll.question}</div>

      <div className="mt-3 space-y-2">
        {(poll.options || []).map((opt) => {
          const votes = opt.votes || [];
          const count = votes.length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const votedByMe = votes.includes(myUid);

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onVotePoll(msg.id, opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                isMine
                  ? votedByMe
                    ? 'border-black bg-black/5'
                    : 'border-black/15 hover:border-black/40'
                  : votedByMe
                  ? 'border-white bg-white/10'
                  : 'border-white/15 hover:border-white/35'
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${
                  isMine ? 'bg-black/10' : 'bg-white/14'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium truncate">
                  {votedByMe && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{opt.text}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] opacity-75">
                  {pct}% ({count})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className={`mt-2.5 text-[10.5px] ${
          isMine ? 'text-black/50' : 'text-white/45'
        }`}
      >
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} • Tap to vote
      </div>
    </Tilt3DCard>
  );
}

function MessageBubble({
  msg,
  index,
  isMine,
  isGroup,
  myUid,
  now,
  onReply,
  onRespondCall,
  onVotePoll,
}) {
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx > 0 && dx < 72) {
      setSwipeOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 44) {
      onReply(msg);
    }
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  const staggerDelay = Math.min(index * 28, 220);
  const timeStr = msg.createdAtMs
    ? new Date(msg.createdAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
        animationDelay: `${staggerDelay}ms`,
      }}
      className={`group flex flex-col transition-transform duration-150 ${
        isMine ? 'items-end animate-msg-mine' : 'items-start animate-msg-other'
      }`}
    >
      {isGroup && !isMine && (
        <span className="mb-1 ml-1 font-mono text-[10px] text-white/50">
          {msg.senderNickname || `@${msg.senderUsername}`}
        </span>
      )}

      <div className={`flex items-end gap-1.5 max-w-[85%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {msg.type === 'call_invite' ? (
          <CallInviteCard
            msg={msg}
            isMine={isMine}
            now={now}
            onRespondCall={onRespondCall}
          />
        ) : msg.type === 'poll' ? (
          <PollMessageCard
            msg={msg}
            isMine={isMine}
            myUid={myUid}
            onVotePoll={onVotePoll}
          />
        ) : (
          <div
            onDoubleClick={() => onReply(msg)}
            className={`rounded-[22px] px-4 py-2.5 text-sm leading-relaxed ${
              isMine
                ? 'rounded-br-sm bg-white text-black shadow-spatial-bubble-mine'
                : 'rounded-bl-sm border border-white/14 bg-[#141414] text-white shadow-spatial-bubble-other'
            }`}
          >
            {msg.replyTo && (
              <div
                className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-[11px] ${
                  isMine
                    ? 'border-black/45 bg-black/5 text-black/75'
                    : 'border-white/45 bg-black/55 text-white/70'
                }`}
              >
                <div className="font-semibold">
                  {msg.replyTo.senderNickname || `@${msg.replyTo.senderUsername}`}
                </div>
                <div className="truncate opacity-80">{msg.replyTo.text}</div>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
        )}

        {/* Tap-to-Reply icon */}
        <button
          type="button"
          onClick={() => onReply(msg)}
          className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#121212] text-white/45 opacity-70 hover:border-white/30 hover:text-white hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
          title="Reply"
          aria-label="Reply to message"
        >
          <CornerUpLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {timeStr && (
        <span className="mt-1 px-1 font-mono text-[9.5px] text-white/35">
          {timeStr}
        </span>
      )}
    </div>
  );
}

export function ChatRoom({
  chatType, // 'direct' | 'group'
  peer,
  group,
  myProfile,
  messages,
  typingUsers,
  allowVideoCalls = true,
  rateLimitNotice = '',
  onBack,
  onOpenGroupInfo,
  onSendMessage,
  onSendCallInvite,
  onRespondCall,
  onSendPoll,
  onVotePoll,
  onTypingChange,
  onUpdateFamilyData,
  onReportContact,
}) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [familyOpen, setFamilyOpen] = useState(true);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isGroup = chatType === 'group';
  const myUid = myProfile.uid;
  const isBanned = Boolean(myProfile?.isBanned);
  const isAdmin = isGroup ? (group?.admins || []).includes(myUid) : false;
  const groupSendLocked = isGroup && group?.permissions?.onlyAdminsSendMessages && !isAdmin;
  const sendLocked = isBanned || groupSendLocked;

  // Live clock tick when any ringing call invite exists
  const hasRingingCall = messages.some(
    (m) => m.type === 'call_invite' && m.call?.status === 'ringing' && m.call?.expiresAt >= now - 1500
  );

  useEffect(() => {
    if (!hasRingingCall) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [hasRingingCall]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  useEffect(() => {
    if (group) {
      setNoteDraft(group.familyNote || '');
    }
  }, [group?.familyNote]);

  const handleInputChange = (e) => {
    const val = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setText(val);
    onTypingChange(val.trim().length > 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sendLocked) return;
    const body = sanitizePlainText(text, MAX_MESSAGE_LENGTH, true);
    if (!body) return;
    const quote = replyTo
      ? {
          id: replyTo.id,
          senderUsername: replyTo.senderUsername,
          senderNickname: replyTo.senderNickname,
          text: sanitizePlainText(
            replyTo.type === 'poll'
              ? `Poll: ${replyTo.poll?.question || ''}`
              : replyTo.type === 'call_invite'
              ? 'Jitsi Video Call'
              : replyTo.text,
            200,
            false
          ),
        }
      : null;

    const sent = await onSendMessage(body, quote);
    if (sent !== false) {
      setText('');
      setReplyTo(null);
      onTypingChange(false);
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const cleanQ = sanitizePlainText(pollQuestion, 160, false);
    const cleanOpts = pollOptions
      .map((o) => sanitizePlainText(o, 80, false))
      .filter(Boolean);
    if (!cleanQ || cleanOpts.length < 2) return;
    const sent = await onSendPoll(cleanQ, cleanOpts);
    if (sent !== false) {
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollModal(false);
    }
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    const cleanTask = sanitizePlainText(newTaskText, MAX_CHECKLIST_ITEM_LENGTH, false);
    if (!group || !cleanTask) return;
    const list = group.familyChecklist || [];
    const next = [
      ...list,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: cleanTask, done: false },
    ];
    setNewTaskText('');
    await onUpdateFamilyData(group.id, { familyChecklist: next });
  };

  const toggleChecklistItem = async (itemId) => {
    if (!group) return;
    const next = (group.familyChecklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    await onUpdateFamilyData(group.id, { familyChecklist: next });
  };

  const deleteChecklistItem = async (itemId) => {
    if (!group) return;
    const next = (group.familyChecklist || []).filter((item) => item.id !== itemId);
    await onUpdateFamilyData(group.id, { familyChecklist: next });
  };

  const saveFamilyNote = async () => {
    if (!group) return;
    setEditingNote(false);
    await onUpdateFamilyData(group.id, {
      familyNote: sanitizePlainText(noteDraft, MAX_FAMILY_NOTE_LENGTH, false),
    });
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!peer || !onReportContact || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const ok = await onReportContact({
        contactUser: peer,
        reason: reportReason,
        details: reportDetails,
      });
      if (ok !== false) {
        setReportModalOpen(false);
        setReportDetails('');
        setReportReason('Spam');
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const title = isGroup
    ? group?.name || 'Group'
    : peer?.nickname || peer?.displayName || (peer?.usernameLower ? `@${peer.usernameLower}` : peer?.email || 'Contact');

  const subtitle = isGroup
    ? `${(group?.members || []).length} members${group?.familyMode ? ' • Family Mode' : ''}`
    : peer?.statusNote && peer?.statusExpiresAt > Date.now()
    ? `“${peer.statusNote}”`
    : peer?.status || 'Online';

  return (
    <div className="flex h-full w-full flex-col bg-black">
      {/* Sticky Spatial Chat Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/14 bg-[#080808]/95 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/14 bg-[#141414] text-white/80 hover:text-white transition"
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={isGroup ? onOpenGroupInfo : () => setContactInfoOpen(true)}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:opacity-90 transition"
            title={isGroup ? 'Open Group Info' : 'View Contact Info & Report'}
          >
            {isGroup ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[#161616] text-xs font-bold text-white">
                {group?.familyMode ? (
                  <Home className="h-4 w-4" />
                ) : (
                  (group?.name || 'G').slice(0, 2).toUpperCase()
                )}
              </div>
            ) : (
              <AvatarRing3D
                src={peer?.photoURL}
                name={peer?.nickname || peer?.usernameLower}
                status={peer?.status || 'Online'}
                size={36}
                animated={false}
              />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-sm font-semibold text-white">{title}</span>
                {!isGroup && peer?.badge && (
                  <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wider text-white">
                    {peer.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 truncate text-[11px] text-white/55">
                {!isGroup && <StatusDot status={peer?.status || 'Online'} />}
                <span className="truncate">{subtitle}</span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={sendLocked || !allowVideoCalls}
            onClick={onSendCallInvite}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#161616] text-white hover:bg-white hover:text-black transition disabled:opacity-30"
            title={
              !allowVideoCalls
                ? '45s Video Calls are disabled by administrator'
                : 'Start 45s Jitsi Video Call'
            }
            aria-label="Start Jitsi Video Call"
          >
            <Video className="h-4 w-4" />
          </button>

          {isGroup && (
            <button
              type="button"
              onClick={onOpenGroupInfo}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#161616] text-white hover:bg-white hover:text-black transition"
              title="Group Info"
              aria-label="Group Info"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Family Mode Pinned Live Checklist & Important Notes Bar */}
      {isGroup && group?.familyMode && (
        <div className="shrink-0 border-b border-white/14 bg-[#0D0D0D] px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
              <Home className="h-3.5 w-3.5" />
              <span>Family Hub • Checklist &amp; Notes</span>
            </div>
            <button
              type="button"
              onClick={() => setFamilyOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-white/55 hover:text-white"
            >
              <span>{familyOpen ? 'Hide' : 'Show'}</span>
              {familyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {familyOpen && (
            <div className="mt-2.5 space-y-2.5">
              {/* Important Notes Bar */}
              <div className="rounded-xl border border-white/14 bg-black/80 px-3 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/45">
                  <span className="flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Important Note
                  </span>
                  {!editingNote && (
                    <button
                      type="button"
                      onClick={() => setEditingNote(true)}
                      className="text-white/70 hover:text-white"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingNote ? (
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      type="text"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value.slice(0, 120))}
                      placeholder="Pin an important family note..."
                      className="flex-1 rounded-lg border border-white/20 bg-[#121212] px-2.5 py-1 text-xs text-white focus:border-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={saveFamilyNote}
                      className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-white/85">
                    {group.familyNote ? group.familyNote : 'No pinned note yet — tap Edit to add one.'}
                  </p>
                )}
              </div>

              {/* Shared Grocery/Task Checklist */}
              <div className="rounded-xl border border-white/14 bg-black/80 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-white/45">
                  Shared Grocery / Task Checklist ({(group.familyChecklist || []).length})
                </div>
                {(group.familyChecklist || []).length > 0 && (
                  <div className="mt-1.5 max-h-24 space-y-1 overflow-y-auto mono-scroll">
                    {(group.familyChecklist || []).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => toggleChecklistItem(item.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              item.done
                                ? 'border-white bg-white text-black'
                                : 'border-white/30 bg-transparent'
                            }`}
                          >
                            {item.done && <Check className="h-3 w-3" />}
                          </span>
                          <span
                            className={`truncate ${
                              item.done ? 'line-through text-white/40' : 'text-white/90'
                            }`}
                          >
                            {item.text}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChecklistItem(item.id)}
                          className="text-white/35 hover:text-white"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddChecklistItem} className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value.slice(0, 60))}
                    placeholder="Add grocery or task item..."
                    className="flex-1 rounded-lg border border-white/15 bg-[#121212] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center rounded-lg bg-white px-2.5 text-black transition active:scale-95"
                    aria-label="Add checklist item"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Viewport */}
      <div className="scene-3d flex-1 overflow-y-auto mono-scroll px-3.5 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="rounded-2xl border border-white/12 bg-[#0D0D0D] px-5 py-4 text-xs text-white/50">
              End-to-end mutual channel ready. Send a message, launch a 45s Jitsi call, or drop a quick poll.
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              index={idx}
              isMine={msg.senderUid === myUid}
              isGroup={isGroup}
              myUid={myUid}
              now={now}
              onReply={(m) => {
                setReplyTo(m);
                inputRef.current?.focus();
              }}
              onRespondCall={onRespondCall}
              onVotePoll={onVotePoll}
            />
          ))
        )}

        {/* Real-time 3-Sphere 3D Sine-Wave Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingWave3D
            label={
              isGroup
                ? `${typingUsers.map((u) => `@${u.username}`).join(', ')}`
                : undefined
            }
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Poll Creator Sheet */}
      {showPollModal && (
        <div className="shrink-0 border-t border-white/18 bg-[#0D0D0D] px-4 py-3.5 animate-drawer-3d">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <BarChart2 className="h-3.5 w-3.5" />
              Create Quick Poll
            </span>
            <button
              type="button"
              onClick={() => setShowPollModal(false)}
              className="text-white/55 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreatePoll} className="mt-2.5 space-y-2">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value.slice(0, 90))}
              placeholder="Ask a question..."
              className="w-full rounded-xl border border-white/18 bg-black px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none"
            />
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-1.5">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value.slice(0, 48);
                    setPollOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 rounded-xl border border-white/14 bg-black px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:border-white focus:outline-none"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    className="px-2 text-white/40 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              {pollOptions.length < 4 ? (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
                >
                  <Plus className="h-3 w-3" /> Add Option
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black shadow-spatial-white"
              >
                Post Poll
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reply Quote Bar */}
      {replyTo && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/12 bg-[#0D0D0D] px-4 py-2">
          <div className="min-w-0 border-l-2 border-white pl-2.5">
            <div className="text-[10.5px] font-semibold text-white">
              Replying to {replyTo.senderNickname || `@${replyTo.senderUsername}`}
            </div>
            <div className="truncate text-[11px] text-white/55">
              {replyTo.type === 'poll'
                ? `Poll: ${replyTo.poll?.question}`
                : replyTo.type === 'call_invite'
                ? 'Jitsi Video Call'
                : replyTo.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Rate Limit / Validation Notice */}
      {rateLimitNotice && (
        <div className="shrink-0 border-t border-white/15 bg-[#121212] px-4 py-1.5 text-center font-mono text-[11px] text-white/85">
          {rateLimitNotice}
        </div>
      )}

      {/* Composer */}
      <footer className="shrink-0 border-t border-white/14 bg-[#080808] px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {sendLocked ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/14 bg-[#121212] py-3 text-xs text-white/55">
            <Lock className="h-3.5 w-3.5" />
            <span>
              {isBanned
                ? 'Your account is restricted from sending messages.'
                : 'Only group admins can send messages.'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPollModal((v) => !v)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                showPollModal
                  ? 'border-white bg-white text-black'
                  : 'border-white/15 bg-[#141414] text-white/75 hover:text-white'
              }`}
              title="Quick Poll"
              aria-label="Create quick poll"
            >
              <BarChart2 className="h-4 w-4" />
            </button>

            <input
              ref={inputRef}
              type="text"
              maxLength={MAX_MESSAGE_LENGTH}
              value={text}
              onChange={handleInputChange}
              placeholder="Message..."
              className="h-10 flex-1 rounded-full border border-white/16 bg-[#121212] px-4 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none transition"
            />

            {text.length > 3500 && (
              <span className="shrink-0 font-mono text-[10px] text-white/55">
                {text.length}/{MAX_MESSAGE_LENGTH}
              </span>
            )}

            <button
              type="submit"
              disabled={!text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-spatial-white transition active:scale-95 disabled:opacity-30"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </footer>

      {/* Contact Info / Actions Modal */}
      {!isGroup && contactInfoOpen && peer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
          onClick={() => setContactInfoOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-card-3d-in w-full max-w-[400px] rounded-3xl border border-white/20 bg-[#0D0D0D] p-5 shadow-spatial-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarRing3D
                  src={peer.photoURL}
                  name={peer.nickname || peer.displayName || peer.usernameLower || peer.email}
                  status={peer.status || 'Online'}
                  size={52}
                  animated={false}
                />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-white">
                    {peer.nickname || peer.displayName || (peer.usernameLower ? `@${peer.usernameLower}` : 'Voliud User')}
                  </h3>
                  {(peer.usernameLower || peer.username) && (
                    <div className="truncate font-mono text-xs text-white/60">
                      @{peer.usernameLower || peer.username}
                    </div>
                  )}
                  {peer.email && (
                    <div className="mt-0.5 truncate font-mono text-[11px] text-white/45">
                      {peer.email}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactInfoOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/70 hover:text-white transition"
                aria-label="Close contact info"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/12 bg-black/70 px-3.5 py-2.5 text-xs text-white/75 space-y-1">
              <div className="flex items-center gap-1.5">
                <StatusDot status={peer.status || 'Online'} />
                <span>Status: {peer.status || 'Online'}</span>
              </div>
              {peer.statusNote && peer.statusExpiresAt > Date.now() && (
                <p className="text-white/60 italic">“{peer.statusNote}”</p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setContactInfoOpen(false);
                  setReportModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/50 bg-red-600 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-red-500 active:scale-[0.98]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Report to Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setContactInfoOpen(false)}
                className="w-full rounded-2xl border border-white/15 bg-[#161616] py-2.5 text-xs font-medium text-white/80 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report to Admin Form Modal */}
      {!isGroup && reportModalOpen && peer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-5 backdrop-blur-md"
          onClick={() => !reportSubmitting && setReportModalOpen(false)}
        >
          <form
            onSubmit={handleSubmitReport}
            onClick={(e) => e.stopPropagation()}
            className="animate-card-3d-in w-full max-w-[420px] rounded-3xl border border-white/20 bg-[#0D0D0D] p-5 shadow-spatial-card space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-400" />
                <h3 className="text-base font-semibold text-white">Report to Admin</h3>
              </div>
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={() => setReportModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/70 hover:text-white transition"
                aria-label="Close report modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/12 bg-black/65 px-3.5 py-2.5 text-xs text-white/75">
              Reporting:{' '}
              <span className="font-semibold text-white">
                {peer.nickname || peer.displayName || (peer.usernameLower ? `@${peer.usernameLower}` : peer.email || 'User')}
              </span>
              {(peer.usernameLower || peer.username) && (
                <span className="ml-1.5 font-mono text-white/50">
                  @{peer.usernameLower || peer.username}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Reason
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                disabled={reportSubmitting}
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-3 py-2.5 text-xs text-white focus:border-white focus:outline-none"
              >
                <option value="Spam">Spam</option>
                <option value="Harassment">Harassment</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Fake Account">Fake Account</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Details (optional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                disabled={reportSubmitting}
                placeholder="Describe what happened..."
                className="w-full rounded-xl border border-white/18 bg-[#141414] px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={() => setReportModalOpen(false)}
                className="rounded-xl border border-white/18 bg-[#161616] px-4 py-2 text-xs font-medium text-white/80 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportSubmitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition active:scale-95 disabled:opacity-50"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
