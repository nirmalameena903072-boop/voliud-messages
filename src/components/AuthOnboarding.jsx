import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
} from 'lucide-react';
import { REQUIRED_FIREBASE_KEYS, isFirebaseConfigured } from '../firebase';
import { MAX_NICKNAME_LENGTH, isValidUsername, sanitizePlainText } from '../utils/security';
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

export function LoginScreen({
  onGoogleSignIn,
  onEmailSignIn,
  onGuestSignIn,
  guestLoginEnabled = true,
  allowNewSignups = true,
  loading,
  guestLoading = false,
  error,
  onEnterDemo,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMode, setEmailMode] = useState('login'); // 'login' | 'signup'
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (emailMode === 'signup' && !allowNewSignups) {
      setLocalError('New sign-ups are currently closed by admin.');
      return;
    }
    setLocalError('');
    onEmailSignIn?.({ email: cleanEmail, password, isSignup: emailMode === 'signup' });
  };

  const displayError = localError || error;
  const anyBusy = loading || guestLoading;

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto mono-scroll px-5 py-6">
      <div className="space-y-4">
        {!isFirebaseConfigured && <FirebaseSetupBanner onEnterDemo={onEnterDemo} />}
      </div>

      <div className="my-auto py-4">
        <div className="animate-card-3d-in rounded-[28px] border border-white/15 bg-[#0D0D0D] p-6 sm:p-7 shadow-spatial-card">
          <div className="flex flex-col items-center text-center">
            <VEmblem3D size={84} />

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#161616] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
              <Sparkles className="h-3 w-3 text-white" />
              Monochrome 3D Spatial
            </div>

            <h1 className="mt-3.5 text-3xl font-semibold tracking-tight text-white">
              Voliud Messages
            </h1>
            <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-white/55">
              Zero-noise private &amp; family messaging. Claim a 12-character handle and connect only with mutual contacts.
            </p>

            {displayError && (
              <div className="mt-4 w-full rounded-xl border border-red-400/35 bg-red-950/40 px-3.5 py-2.5 text-left text-xs text-red-100">
                {displayError}
              </div>
            )}

            {/* 1. Primary Google Sign-In */}
            <button
              type="button"
              disabled={anyBusy || !isFirebaseConfigured}
              onClick={onGoogleSignIn}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-spatial-white transition duration-200 hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v2.98h5.35c-.46 2.4-2.55 3.97-5.35 3.97a6.05 6.05 0 1 1 0-12.1c1.55 0 2.94.58 4.01 1.54l2.24-2.24A9.18 9.18 0 0 0 12 2.8a9.2 9.2 0 1 0 0 18.4c5.31 0 8.84-3.73 8.84-8.98 0-.6-.06-1.08-.14-1.52Z"
                />
              </svg>
              {loading && !guestLoading ? 'Connecting...' : 'Continue with Google'}
            </button>

            {/* 2. Email / Password Auth */}
            {onEmailSignIn && (
              <div className="mt-3 w-full">
                {!showEmailForm ? (
                  <button
                    type="button"
                    disabled={anyBusy || !isFirebaseConfigured}
                    onClick={() => setShowEmailForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/18 bg-[#141414] px-4 py-3 text-xs font-semibold text-white/85 hover:border-white/35 hover:text-white transition disabled:opacity-40"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Sign in with Email &amp; Password</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleEmailSubmit}
                    className="mt-1 space-y-2.5 rounded-2xl border border-white/16 bg-black/80 p-3.5 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 rounded-xl border border-white/12 bg-[#121212] p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode('login');
                            setLocalError('');
                          }}
                          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                            emailMode === 'login' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode('signup');
                            setLocalError('');
                          }}
                          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                            emailMode === 'signup' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Create Account
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="text-[11px] text-white/45 hover:text-white"
                      >
                        Hide
                      </button>
                    </div>

                    <div className="flex items-center rounded-xl border border-white/15 bg-[#121212] px-3 py-2 focus-within:border-white">
                      <Mail className="mr-2 h-3.5 w-3.5 text-white/45 shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (localError) setLocalError('');
                        }}
                        placeholder="Email address"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center rounded-xl border border-white/15 bg-[#121212] px-3 py-2 focus-within:border-white">
                      <Lock className="mr-2 h-3.5 w-3.5 text-white/45 shrink-0" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (localError) setLocalError('');
                        }}
                        placeholder="Password (min 6 chars)"
                        className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={anyBusy || !isFirebaseConfigured}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98] disabled:opacity-40"
                    >
                      <span>
                        {loading && !guestLoading
                          ? 'Authenticating...'
                          : emailMode === 'signup'
                          ? 'Create Email Account'
                          : 'Sign In with Email'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 3. Shared-PC 24h Temporary Guest Mode */}
            <div className="mt-4 w-full border-t border-white/12 pt-4">
              <button
                type="button"
                disabled={anyBusy || !guestLoginEnabled || (!isFirebaseConfigured && !onEnterDemo)}
                onClick={onGuestSignIn}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-[#161616] px-4 py-3 text-xs font-semibold text-white transition hover:border-white/50 hover:bg-[#1e1e1e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Clock className="h-3.5 w-3.5 text-white/80 shrink-0" />
                <span>
                  {guestLoading ? 'Starting 24h Guest Session...' : 'Continue as Guest (24h Demo)'}
                </span>
              </button>

              {!guestLoginEnabled ? (
                <p className="mt-2 text-[11px] font-medium text-amber-300/90">
                  Guest demo mode is currently closed by admin.
                </p>
              ) : (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] text-white/45">
                  <UserCheck className="h-3 w-3 shrink-0" />
                  <span>Shared-PC safe: tab-only session &amp; auto-assigned temp @handle</span>
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Mobile redirect fallback &amp; mutual-only chats</span>
            </div>
          </div>
        </div>
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
    if (!isValidUsername(username)) {
      setLocalError('Choose a handle between 3 and 12 characters ([a-z0-9_]).');
      return;
    }
    const cleanNickname = sanitizePlainText(nickname, MAX_NICKNAME_LENGTH, false);
    if (!cleanNickname) {
      setLocalError('Enter a display nickname.');
      return;
    }
    onComplete({ usernameLower: username, nickname: cleanNickname });
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
              {username.length >= 3 && (
                <Check className="ml-2 h-4 w-4 shrink-0 text-white/70" />
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-white/40">
              3–12 characters: lowercase letters, numbers, and underscores only (`a-z`, `0-9`, `_`).
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
