import React, { useState } from 'react';
import { ArrowRight, Check, KeyRound, ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import { REQUIRED_FIREBASE_KEYS, isFirebaseConfigured } from '../firebase';
import { Tilt3DCard, VEmblem3D } from './Spatial3D';

export function FirebaseSetupBanner({ onEnterDemo }) {
  return (
    <Tilt3DCard
      intensity={5}
      className="animate-card-3d-in rounded-2xl border border-white/20 bg-[#0D0D0D] p-4 shadow-spatial-card"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-[#161616]">
          <KeyRound className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
              Firebase Setup Required
            </h2>
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/80">
              src/firebase.js
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/65">
            Replace the placeholder strings in <code className="font-mono text-white">src/firebase.js</code> with your Firebase Web App credentials to enable Google Sign-In, Firestore, and Realtime Database:
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-1 rounded-xl border border-white/10 bg-black/80 p-2.5 font-mono text-[10.5px] text-white/75">
            {REQUIRED_FIREBASE_KEYS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 truncate">
                <span className="text-white/45">{item.key}:</span>
                <span className="truncate text-white">{item.placeholder}</span>
              </div>
            ))}
          </div>
          {onEnterDemo && (
            <button
              type="button"
              onClick={onEnterDemo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-[#161616] px-3 py-2 text-xs font-medium text-white transition hover:bg-white hover:text-black active:scale-[0.99]"
            >
              <Terminal className="h-3.5 w-3.5" />
              Explore Spatial UI in Local Preview Mode
            </button>
          )}
        </div>
      </div>
    </Tilt3DCard>
  );
}

export function LoginScreen({ onGoogleSignIn, loading, error, onEnterDemo }) {
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto px-5 py-6">
      <div className="space-y-4">
        {!isFirebaseConfigured && <FirebaseSetupBanner onEnterDemo={onEnterDemo} />}
      </div>

      <div className="my-auto py-6">
        <Tilt3DCard
          intensity={7}
          className="animate-card-3d-in rounded-[28px] border border-white/15 bg-[#0D0D0D] p-7 shadow-spatial-card"
        >
          <div className="flex flex-col items-center text-center">
            <VEmblem3D size={88} />

            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#161616] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
              <Sparkles className="h-3 w-3 text-white" />
              Monochrome 3D Spatial
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Voliud Messages
            </h1>
            <p className="mt-2 max-w-[270px] text-xs leading-relaxed text-white/55">
              Zero-noise private &amp; family messaging. Claim a 12-character handle and connect only with mutual contacts.
            </p>

            {error && (
              <div className="mt-4 w-full rounded-xl border border-white/25 bg-[#161616] px-3.5 py-2.5 text-left text-xs text-white/85">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={loading || !isFirebaseConfigured}
              onClick={onGoogleSignIn}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-spatial-white transition duration-200 hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v2.98h5.35c-.46 2.4-2.55 3.97-5.35 3.97a6.05 6.05 0 1 1 0-12.1c1.55 0 2.94.58 4.01 1.54l2.24-2.24A9.18 9.18 0 0 0 12 2.8a9.2 9.2 0 1 0 0 18.4c5.31 0 8.84-3.73 8.84-8.98 0-.6-.06-1.08-.14-1.52Z"
                />
              </svg>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Mobile redirect fallback &amp; mutual-only chats</span>
            </div>
          </div>
        </Tilt3DCard>
      </div>

      <div className="text-center text-[10px] uppercase tracking-[0.22em] text-white/30">
        Voliud Spatial Protocol
      </div>
    </div>
  );
}

export function OnboardingCard({
  initialNickname = '',
  allowNewSignups = true,
  onComplete,
  loading,
  error,
  onSignOut,
}) {
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState(initialNickname);
  const [localError, setLocalError] = useState('');

  const handleUsernameChange = (e) => {
    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 12);
    setUsername(cleaned);
    if (localError) setLocalError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!allowNewSignups) {
      setLocalError('New sign-ups are currently paused by the administrator.');
      return;
    }
    if (!username || username.length < 2) {
      setLocalError('Choose a handle between 2 and 12 characters ([a-z0-9_]).');
      return;
    }
    if (!nickname.trim()) {
      setLocalError('Enter a display nickname.');
      return;
    }
    onComplete({ usernameLower: username, nickname: nickname.trim() });
  };

  const displayErr = localError || error;

  return (
    <div className="flex h-full w-full flex-col justify-center px-5 py-6">
      <Tilt3DCard
        intensity={6}
        className="animate-card-3d-in rounded-[28px] border border-white/18 bg-[#0D0D0D] p-6 shadow-spatial-card"
      >
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-white/15 bg-[#161616] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Step 1 of 1
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-white/45 hover:text-white transition"
          >
            Switch Account
          </button>
        </div>

        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Claim Your Identity
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-white/55">
          Your <span className="font-mono text-white/85">@username</span> is permanently reserved and uniquely yours. Internal IDs remain private.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="onboard-username" className="font-medium text-white/80">
                Unique @username
              </label>
              <span
                className={`font-mono text-[11px] ${
                  username.length === 12 ? 'text-white' : 'text-white/45'
                }`}
              >
                {username.length}/12
              </span>
            </div>
            <div className="mt-1.5 flex items-center rounded-2xl border border-white/18 bg-black px-3.5 py-3 focus-within:border-white transition">
              <span className="mr-1 font-mono text-sm text-white/45">@</span>
              <input
                id="onboard-username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                maxLength={12}
                placeholder="your_handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-transparent font-mono text-sm text-white placeholder:text-white/25 focus:outline-none"
              />
              {username.length >= 2 && (
                <Check className="ml-2 h-4 w-4 shrink-0 text-white/70" />
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-white/40">
              Lowercase letters, numbers, and underscores only (`a-z`, `0-9`, `_`).
            </p>
          </div>

          <div>
            <label htmlFor="onboard-nickname" className="block text-xs font-medium text-white/80">
              Display Nickname
            </label>
            <input
              id="onboard-nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value.slice(0, 32));
                if (localError) setLocalError('');
              }}
              placeholder="e.g. Aarav / Mom / Alex"
              className="mt-1.5 w-full rounded-2xl border border-white/18 bg-black px-3.5 py-3 text-sm text-white placeholder:text-white/25 focus:border-white focus:outline-none transition"
            />
          </div>

          {!allowNewSignups && (
            <div className="rounded-xl border border-white/25 bg-[#161616] px-3.5 py-2.5 text-xs text-white/85">
              New sign-ups are currently disabled by the owner. Please check back later.
            </div>
          )}

          {displayErr && (
            <div className="rounded-xl border border-white/25 bg-[#161616] px-3.5 py-2.5 text-xs text-white/90">
              {displayErr}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !allowNewSignups}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-spatial-white transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
          >
            <span>{loading ? 'Reserving handle...' : 'Enter Voliud'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </Tilt3DCard>
    </div>
  );
}
