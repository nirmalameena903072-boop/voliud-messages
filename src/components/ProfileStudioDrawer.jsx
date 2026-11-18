import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Clock,
  Copy,
  LogOut,
  QrCode,
  Shield,
  X,
} from 'lucide-react';
import { MAX_BIO_LENGTH, MAX_NICKNAME_LENGTH, sanitizePlainText } from '../utils/security';
import { AvatarRing3D, StatusDot, Tilt3DCard } from './Spatial3D';

const STATUS_OPTIONS = ['Online', 'Studying', 'Busy'];

export function ProfileStudioDrawer({
  open,
  onClose,
  profile,
  isOwnerAdmin,
  onSaveProfile,
  onOpenOwnerConsole,
  onSignOut,
}) {
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [status, setStatus] = useState(profile?.status || 'Online');
  const [statusNote, setStatusNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showQrCard, setShowQrCard] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setNickname(profile.nickname || '');
      setStatus(profile.status || 'Online');
      const activeNote =
        profile.statusExpiresAt && profile.statusExpiresAt > Date.now()
          ? profile.statusNote || ''
          : '';
      setStatusNote(activeNote);
    }
  }, [open, profile]);

  if (!open || !profile) return null;

  const inviteUrl = `${window.location.origin}/?add=${encodeURIComponent(profile.usernameLower || '')}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanNickname = sanitizePlainText(nickname, MAX_NICKNAME_LENGTH, false);
    if (!cleanNickname) return;
    setSaving(true);
    try {
      const cleanNote = sanitizePlainText(statusNote, MAX_BIO_LENGTH, false);
      await onSaveProfile({
        nickname: cleanNickname,
        status,
        statusNote: cleanNote,
        statusExpiresAt: cleanNote ? Date.now() + 24 * 60 * 60 * 1000 : null,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="scene-3d animate-drawer-3d w-full max-w-[480px] max-h-[92dvh] overflow-y-auto mono-scroll rounded-t-[30px] border-t border-x border-white/18 bg-[#0D0D0D] px-5 pt-4 pb-7 shadow-spatial-card"
      >
        {/* Drag Handle & Header */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Profile Studio
            </p>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">@{profile.usernameLower}</h2>
              {profile.badge && (
                <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white">
                  {profile.badge}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/75 hover:text-white transition"
            aria-label="Close Profile Studio"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar & Quick Share Row */}
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/14 bg-[#161616] p-3.5">
          <AvatarRing3D
            src={profile.photoURL}
            name={profile.nickname}
            status={status}
            size={50}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">
              {nickname || profile.nickname}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
              <StatusDot status={status} />
              <span>{status}</span>
            </div>
            {statusNote.trim() && (
              <p className="mt-1 truncate text-[11px] text-white/50">
                “{statusNote.trim()}”
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowQrCard((v) => !v)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              showQrCard
                ? 'border-white bg-white text-black'
                : 'border-white/20 bg-black text-white hover:border-white/50'
            }`}
            aria-label="Toggle QR Profile Card"
          >
            <QrCode className="h-4 w-4" />
          </button>
        </div>

        {/* 3D Crisp Black & White QR Profile Card */}
        {showQrCard && (
          <div className="mt-4">
            <Tilt3DCard
              intensity={10}
              className="animate-card-3d-in rounded-3xl border border-white/25 bg-white p-5 text-black shadow-spatial-white"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/55">
                  Voliud Spatial Pass
                </span>
                <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
                  <QRCodeSVG
                    value={inviteUrl}
                    size={164}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                <div className="mt-3 text-base font-bold tracking-tight text-black">
                  {profile.nickname}
                </div>
                <div className="font-mono text-xs text-black/65">
                  @{profile.usernameLower}
                </div>
                <p className="mt-1.5 text-[10.5px] text-black/50">
                  Scan to pop up instant 1-tap contact card
                </p>
              </div>
            </Tilt3DCard>
          </div>
        )}

        {/* 1-Tap Invite Link Copy */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-white/14 bg-black px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              1-Tap Invite Link
            </div>
            <div className="truncate font-mono text-xs text-white/80">{inviteUrl}</div>
          </div>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition active:scale-95"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Edit Profile & 24h Status Note Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/75">
              Display Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 32))}
              className="mt-1.5 w-full rounded-2xl border border-white/15 bg-black px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/75">
              Presence Ring Status
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatus(opt)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition ${
                      active
                        ? 'border-white bg-white text-black shadow-spatial-white'
                        : 'border-white/15 bg-[#161616] text-white/75 hover:border-white/35'
                    }`}
                  >
                    <StatusDot status={opt} />
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-white/75">
                24-Hour Floating Status Note
              </label>
              <span className="flex items-center gap-1 text-[10.5px] text-white/45">
                <Clock className="h-3 w-3" />
                Auto-expires in 24h
              </span>
            </div>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value.slice(0, 72))}
              placeholder="Share a quick 24h note..."
              className="mt-1.5 w-full rounded-2xl border border-white/15 bg-black px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-black shadow-spatial-white transition hover:bg-white/90 active:scale-[0.98]"
          >
            {savedFeedback ? (
              <>
                <Check className="h-4 w-4" />
                <span>Studio Updated</span>
              </>
            ) : saving ? (
              <span>Saving...</span>
            ) : (
              <span>Save Studio Changes</span>
            )}
          </button>
        </form>

        {/* Footer Actions: Owner Console (UID or admins/{uid} locked) & Sign Out */}
        <div className="mt-5 flex flex-col gap-2.5 border-t border-white/12 pt-4">
          {isOwnerAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOwnerConsole?.();
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-white/25 bg-[#161616] px-4 py-3 text-xs font-semibold text-white hover:bg-white hover:text-black transition"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Owner / Admin Console
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                Admin Role
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/14 bg-black py-3 text-xs font-medium text-white/65 hover:border-white/35 hover:text-white transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
