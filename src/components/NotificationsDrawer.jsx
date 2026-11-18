import React from 'react';
import { Bell, Check, Clock, X } from 'lucide-react';
import { AvatarRing3D } from './Spatial3D';

export function NotificationsDrawer({
  open,
  onClose,
  incomingRequests,
  outgoingRequests,
  onAccept,
  onDecline,
  onCancelOutgoing,
  busyPairId,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="scene-3d animate-drawer-3d w-full max-w-[480px] max-h-[85dvh] overflow-y-auto mono-scroll rounded-t-[30px] border-t border-x border-white/18 bg-[#0D0D0D] px-5 pt-4 pb-7 shadow-spatial-card"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-white" />
            <h2 className="text-base font-semibold text-white">Contact Requests</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/70 hover:text-white"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Incoming Requests */}
        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Incoming ({incomingRequests.length})
          </div>

          {incomingRequests.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-black/60 px-4 py-4 text-center text-xs text-white/40">
              No pending incoming requests.
            </div>
          ) : (
            <div className="mt-2 space-y-2.5">
              {incomingRequests.map((req) => {
                const isBusy = busyPairId === req.id;
                const senderName =
                  req.fromName ||
                  req.fromNickname ||
                  (req.fromUsername ? `@${req.fromUsername}` : req.fromEmail || 'Voliud User');
                const senderSub = req.fromUsername
                  ? `@${req.fromUsername}${req.fromEmail ? ` • ${req.fromEmail}` : ''}`
                  : req.fromEmail || req.from || '';

                return (
                  <div
                    key={req.id}
                    className="animate-card-3d-in flex items-center justify-between gap-3 rounded-2xl border border-white/16 bg-[#161616] p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarRing3D
                        src={req.fromPhotoURL}
                        name={senderName}
                        size={38}
                        animated={false}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {senderName}
                        </div>
                        <div className="truncate font-mono text-xs text-white/50">
                          {senderSub}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDecline(req)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/18 bg-black text-white/70 hover:border-white/40 hover:text-white transition disabled:opacity-40"
                        title="Decline"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onAccept(req)}
                        className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-black shadow-spatial-white transition active:scale-95 disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outgoing Requests */}
        <div className="mt-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Outgoing ({outgoingRequests.length})
          </div>

          {outgoingRequests.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-black/60 px-4 py-4 text-center text-xs text-white/40">
              No outgoing requests.
            </div>
          ) : (
            <div className="mt-2 space-y-2.5">
              {outgoingRequests.map((req) => {
                const isBusy = busyPairId === req.id;
                const receiverName =
                  req.toName ||
                  req.toNickname ||
                  (req.toUsername ? `@${req.toUsername}` : req.toEmail || 'Voliud User');
                const receiverSub = req.toUsername
                  ? `@${req.toUsername}`
                  : req.toEmail || req.to || '';

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/14 bg-black/70 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarRing3D
                        src={req.toPhotoURL}
                        name={receiverName}
                        size={36}
                        animated={false}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {receiverName}
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-white/45">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{receiverSub} • Waiting</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onCancelOutgoing(req)}
                      className="shrink-0 rounded-xl border border-white/15 bg-[#161616] px-3 py-1.5 text-[11px] text-white/70 hover:text-white transition disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
