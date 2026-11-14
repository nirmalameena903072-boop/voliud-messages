// ─────────────────────────────────────────────────────────────
// vols — tiny formatting + identity helpers
// ─────────────────────────────────────────────────────────────

export function normalizeUsername(raw) {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 12)
}

export function isValidUsername(u) {
  return /^[a-z0-9_]{3,12}$/.test(u || '')
}

export function pairId(a, b) {
  return [a, b].sort().join('_')
}

export function dmChatId(a, b) {
  return 'dm_' + pairId(a, b)
}

export function nameOf(user) {
  if (!user) return 'Someone'
  return user.nickname?.trim() || (user.username ? '@' + user.username : 'Someone')
}

export const displayName = nameOf

export function initials(name) {
  return (name || '?').replace(/^@/, '').trim().charAt(0).toUpperCase() || '?'
}

export function secondsLabel(total) {
  const s = Math.max(0, Math.round(total))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

function toMs(ts) {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts.seconds) return ts.seconds * 1000
  return 0
}

export function timeAgo(ts) {
  const ms = toMs(ts)
  if (!ms) return ''
  const diff = Math.max(0, Date.now() - ms)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  return `${Math.floor(hr / 24)}d`
}

export function clockTime(ts) {
  const ms = toMs(ts)
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(ts) {
  const ms = toMs(ts)
  if (!ms) return ''
  const d = new Date(ms)
  const today = new Date()
  const yest = new Date(Date.now() - 86400000)
  const same = (x, y) => x.toDateString() === y.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function ms(ts) {
  return toMs(ts)
}

export const profileFromAuth = (user, extra = {}) => ({
  uid: user.uid,
  username: extra.username || '',
  nickname: extra.nickname || user.displayName || '',
  photoURL: extra.photoURL || user.photoURL || '',
  email: user.email || '',
})
