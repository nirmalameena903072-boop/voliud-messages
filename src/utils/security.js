export const USERNAME_REGEX = /^[a-z0-9_]{3,12}$/;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_NICKNAME_LENGTH = 32;
export const MAX_BIO_LENGTH = 160;
export const MAX_GROUP_NAME_LENGTH = 40;
export const MAX_FAMILY_NOTE_LENGTH = 240;
export const MAX_CHECKLIST_ITEM_LENGTH = 100;

/**
 * Strip unsafe control characters while preserving printable text and newlines.
 */
export function sanitizePlainText(input, maxLength = MAX_MESSAGE_LENGTH, allowNewlines = true) {
  if (typeof input !== 'string') return '';
  // Remove null bytes and non-printable C0/C1 control chars (keep \n and \t if allowNewlines)
  const cleaned = allowNewlines
    ? input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    : input.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Validate external link URLs to block javascript:, data:, vbscript:, file:, etc.
 */
export function sanitizeExternalUrl(rawUrl, allowedHosts = null) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return '';
    if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const matched = allowedHosts.some(
        (allowed) => host === allowed.toLowerCase() || host.endsWith(`.${allowed.toLowerCase()}`)
      );
      if (!matched) return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Validate avatar/photo URLs strictly to https:// origins.
 */
export function sanitizeImageUrl(rawUrl) {
  return sanitizeExternalUrl(rawUrl, null);
}

/**
 * Strictly enforce 3-12 lowercase alphanumeric + underscore usernames.
 */
export function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_REGEX.test(username);
}

export const PRIVILEGED_ROLES = new Set(['owner', 'admin', 'superadmin']);

export function hasAdminAccess(userDoc, ownerUid = '', hasAdminDoc = false) {
  if (hasAdminDoc) return true;
  if (!userDoc) return false;
  const role = typeof userDoc.role === 'string' ? userDoc.role.trim().toLowerCase() : '';
  const usernameNorm = String(userDoc.usernameLower || userDoc.username || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  return (
    PRIVILEGED_ROLES.has(role) ||
    userDoc.isAdmin === true ||
    userDoc.isOwner === true ||
    usernameNorm === 'anlossagroup' ||
    Boolean(ownerUid && userDoc.uid === ownerUid)
  );
}

/**
 * Create an in-memory sliding-window + minimum-cooldown rate limiter.
 */
export function createRateLimiter({ minIntervalMs, maxHits, windowMs, label = 'Action' }) {
  let timestamps = [];

  return function checkLimit() {
    const now = Date.now();
    timestamps = timestamps.filter((t) => now - t < windowMs);

    const last = timestamps[timestamps.length - 1];
    if (last && now - last < minIntervalMs) {
      const waitSec = ((minIntervalMs - (now - last)) / 1000).toFixed(1);
      return {
        allowed: false,
        message: `${label} cooldown active. Please wait ${waitSec}s.`,
      };
    }

    if (timestamps.length >= maxHits) {
      const oldest = timestamps[0];
      const waitSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      return {
        allowed: false,
        message: `Rate limit reached for ${label.toLowerCase()}. Try again in ${waitSec}s.`,
      };
    }

    timestamps.push(now);
    return { allowed: true };
  };
}
