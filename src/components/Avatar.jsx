import { initials } from '../lib/utils.js'

const GRADIENTS = [
  'from-sky-500 to-cyan-400',
  'from-violet-500 to-fuchsia-400',
  'from-emerald-500 to-teal-400',
  'from-orange-500 to-amber-400',
  'from-rose-500 to-pink-400',
  'from-indigo-500 to-blue-400',
]

function pickGradient(seed = '') {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return GRADIENTS[sum % GRADIENTS.length]
}

export default function Avatar({ src, name, size = 44, ring = false, status }) {
  const px = `${size}px`
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      {src ? (
        <img
          src={src}
          alt={name || 'avatar'}
          className={`w-full h-full rounded-full object-cover ${ring ? 'ring-2 ring-sky-400' : ''}`}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${pickGradient(
            name || ''
          )} flex items-center justify-center text-white font-semibold ${
            ring ? 'ring-2 ring-sky-400' : ''
          }`}
          style={{ fontSize: Math.max(12, size * 0.4) }}
        >
          {initials(name)}
        </div>
      )}
      {status === 'online' && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-emerald-400 ring-2 ring-slate-900"
          style={{ width: size * 0.26, height: size * 0.26 }}
        />
      )}
    </div>
  )
}
