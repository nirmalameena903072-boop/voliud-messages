import React, { useRef, useState } from 'react';
import { sanitizeImageUrl } from '../utils/security';

/**
 * Interactive 3D tilt card using pure CSS perspective + pointer/touch tilt.
 */
export function Tilt3DCard({
  children,
  className = '',
  intensity = 8,
  as = 'div',
  onClick,
  style = {},
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, tz: 0, gx: 50, gy: 50, active: false });

  const updateTilt = (clientX, clientY) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const ry = (px - 0.5) * intensity * 2;
    const rx = (0.5 - py) * intensity * 2;
    setTilt({
      rx,
      ry,
      tz: 10,
      gx: Math.round(px * 100),
      gy: Math.round(py * 100),
      active: true,
    });
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0, tz: 0, gx: 50, gy: 50, active: false });
  };

  const Component = as;

  return (
    <div className="scene-3d">
      <Component
        ref={cardRef}
        onClick={onClick}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons > 0) {
            updateTilt(e.clientX, e.clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches && e.touches[0]) {
            updateTilt(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onPointerLeave={resetTilt}
        onTouchEnd={resetTilt}
        className={`relative preserve-3d transition-transform duration-200 ease-out will-change-transform ${className}`}
        style={{
          ...style,
          transform: `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg) translateZ(${tilt.tz}px)`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)`,
          }}
        />
        {children}
      </Component>
    </div>
  );
}

/**
 * 3D animated monochrome architectural "V" emblem.
 */
export function VEmblem3D({ size = 84 }) {
  return (
    <div className="scene-3d flex items-center justify-center py-2">
      <div
        className="relative animate-v-emblem flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Back depth halo */}
        <div
          className="absolute inset-1 rounded-3xl border border-white/15 bg-[#0D0D0D] shadow-spatial-card"
          style={{ transform: 'translateZ(-18px)' }}
        />
        {/* Mid depth plate */}
        <div
          className="absolute inset-0 rounded-3xl border border-white/25 bg-gradient-to-br from-[#1A1A1A] via-[#0B0B0B] to-black"
          style={{ transform: 'translateZ(0px)' }}
        />
        {/* Foreground crisp V geometry */}
        <svg
          viewBox="0 0 100 100"
          className="relative z-10 w-[56%] h-[56%] drop-shadow-[0_6px_14px_rgba(255,255,255,0.22)]"
          style={{ transform: 'translateZ(22px)' }}
          fill="none"
        >
          <path
            d="M16 20L50 84L84 20H67L50 54L33 20H16Z"
            fill="#FFFFFF"
          />
          <path
            d="M36 20L50 48L64 20H54L50 28L46 20H36Z"
            fill="rgba(255,255,255,0.28)"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Monochrome status dot styles (Zero color — pure white/gray states).
 */
export function StatusDot({ status = 'Online', size = 'sm' }) {
  const dim = size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  if (status === 'Studying') {
    return (
      <span
        title="Studying"
        className={`${dim} inline-block rounded-full border-[1.5px] border-white bg-[#525252] shadow-[0_0_8px_rgba(255,255,255,0.45)]`}
      />
    );
  }
  if (status === 'Busy') {
    return (
      <span
        title="Busy"
        className={`${dim} inline-block rounded-full border-[2px] border-white/60 bg-black shadow-[0_0_4px_rgba(255,255,255,0.2)]`}
      />
    );
  }
  return (
    <span
      title="Online"
      className={`${dim} inline-block rounded-full bg-white ring-1 ring-white/50 shadow-[0_0_10px_rgba(255,255,255,0.85)]`}
    />
  );
}

/**
 * Circular avatar inside an animated 3D monochrome motion ring + status dot.
 */
export function AvatarRing3D({
  src,
  name = 'V',
  status = 'Online',
  size = 40,
  animated = true,
  onClick,
}) {
  const initials = (name || 'V').trim().slice(0, 2).toUpperCase();
  const safeSrc = sanitizeImageUrl(src);

  return (
    <button
      type="button"
      onClick={onClick}
      className="scene-3d relative inline-flex items-center justify-center rounded-full focus:outline-none group"
      style={{ width: size + 8, height: size + 8 }}
      aria-label="Open profile studio"
    >
      {/* Animated 3D monochrome orbit ring */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-full border border-white/35 border-t-white border-b-white/10 ${
          animated ? 'animate-avatar-ring' : ''
        }`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10"
      />
      {/* Avatar circle */}
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-full bg-[#161616] border border-white/20 text-xs font-semibold tracking-wider text-white transition-transform duration-200 group-hover:scale-95"
        style={{ width: size, height: size }}
      >
        {safeSrc ? (
          <img
            src={safeSrc}
            alt={name}
            className="h-full w-full object-cover grayscale contrast-125"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      {/* Monochrome Status Dot */}
      <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-black p-[2px] border border-white/20">
        <StatusDot status={status} size="sm" />
      </span>
    </button>
  );
}

/**
 * 3-sphere 3D monochrome sine-wave typing indicator bubble.
 */
export function TypingWave3D({ label }) {
  return (
    <div className="flex items-end gap-2 animate-msg-other">
      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/15 bg-[#121212] px-4 py-3 shadow-spatial-bubble-other">
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="typing-sphere-3d typing-sphere-1" />
          <span className="typing-sphere-3d typing-sphere-2" />
          <span className="typing-sphere-3d typing-sphere-3" />
        </div>
        {label ? (
          <span className="ml-1 text-[11px] font-medium tracking-wide text-white/55">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
