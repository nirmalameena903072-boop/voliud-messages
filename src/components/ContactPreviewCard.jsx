import React from 'react';
import { Check, Clock, MessageSquare, UserCheck, UserPlus, X } from 'lucide-react';
import { AvatarRing3D, StatusDot, Tilt3DCard } from './Spatial3D';

export function ContactPreviewCard({
  user,
  relationship, // 'self' | 'accepted' | 'outgoing' | 'incoming' | 'none'
  loading,
  isModal = false,
  onAddContact,
  onAcceptRequest,
  onOpenChat,
  onClose,
}) {
  if (!user) return null;

  const hasActiveNote =
    user.statusNote && user.statusExpiresAt && user.statusExpiresAt > Date.now();

  const card = (
    <Tilt3DCard
      intensity={8}
      className="animate-card-3d-in rounded-3xl border border-white/20 bg-[#0D0D0D] p-4 shadow-spatial-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <AvatarRing3D
            src={user.photoURL}
            name={user.nickname || user.usernameLower}
            status={user.status || 'Online'}
            size={48}
            animated={false}
          />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">
              {user.nickname || `@${user.usernameLower}`}
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-white/55">
              <span>@{user.usernameLower}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-sans">
                <StatusDot status={user.status || 'Online'} />
                {user.status || 'Online'}
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/60 hover:text-white transition"
            aria-label="Dismiss preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {hasActiveNote && (
        <div className="mt-3 rounded-2xl border border-white/12 bg-black/70 px-3.5 py-2 text-xs text-white/80">
          “{user.statusNote}”
        </div>
      )}

      <div className="mt-4">
        {relationship === 'self' ? (
          <div className="w-full rounded-2xl border border-white/15 bg-[#161616] py-2.5 text-center text-xs font-medium text-white/60">
            Your Own Profile
          </div>
        ) : relationship === 'accepted' ? (
          <button
            type="button"
            onClick={() => onOpenChat(user)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98]"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message @{user.usernameLower}
          </button>
        ) : relationship === 'outgoing' ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-[#161616] py-2.5 text-xs font-medium text-white/75">
            <Clock className="h-3.5 w-3.5" />
            Request Pending
          </div>
        ) : relationship === 'incoming' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onAcceptRequest(user)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98] disabled:opacity-50"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {loading ? 'Accepting...' : 'Accept Contact Request'}
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => onAddContact(user)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98] disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {loading ? 'Sending...' : 'Add Contact'}
          </button>
        )}
      </div>

      {isModal && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10.5px] text-white/40">
          <Check className="h-3 w-3" />
          <span>Detected via invite link</span>
        </div>
      )}
    </Tilt3DCard>
  );

  if (!isModal) return card;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px]">
        {card}
      </div>
    </div>
  );
}
