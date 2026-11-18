import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { onDisconnect, onValue, ref as rtdbRef, remove as rtdbRemove, set as rtdbSet } from 'firebase/database';
import {
  AlertTriangle,
  Ban,
  Bell,
  Check,
  FileText,
  Home,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { OWNER_UID, auth, db, googleProvider, isFirebaseConfigured, rtdb } from './firebase';
import {
  MAX_BIO_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NICKNAME_LENGTH,
  createRateLimiter,
  hasAdminAccess,
  isValidUsername,
  sanitizePlainText,
} from './utils/security';
import { AvatarRing3D, StatusDot, Tilt3DCard } from './components/Spatial3D';
import { LoginScreen, OnboardingCard } from './components/AuthOnboarding';
import { ProfileStudioDrawer } from './components/ProfileStudioDrawer';
import { ContactPreviewCard } from './components/ContactPreviewCard';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { GroupInfoDrawer, NewGroupModal } from './components/GroupModals';
import { ChatRoom } from './components/ChatRoom';

function getPairId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function normalizeHandle(raw) {
  return (raw || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 12);
}

function normalizeUserDoc(docId, data = {}) {
  const safeData = data && typeof data === 'object' ? data : {};
  const resolvedUid = String(safeData.uid || docId || '');
  return {
    ...safeData,
    id: String(docId || resolvedUid),
    uid: resolvedUid,
  };
}

function formatFirestoreError(err, fallback = 'Firestore operation failed.') {
  if (!err) return fallback;
  if (err.code && err.message) return `${err.code}: ${err.message}`;
  if (err.code) return `${err.code}: ${fallback}`;
  return err.message || (typeof err === 'string' ? err : fallback);
}

function getMillis(ts, fallback = 0) {
  if (!ts) return fallback;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return fallback;
}

export default function App() {
  // Demo / Preview state (only used if Firebase placeholders are present & user enters Preview Mode)
  const [demoMode, setDemoMode] = useState(false);

  // Auth & Profile
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [onboardError, setOnboardError] = useState('');
  const [isOwnerAdmin, setIsOwnerAdmin] = useState(false);
  const [adminVerified, setAdminVerified] = useState(!isFirebaseConfigured);
  const [rateLimitNotice, setRateLimitNotice] = useState('');
  const [appError, setAppError] = useState('');
  const [appStatus, setAppStatus] = useState('');

  // ?add=username URL detection
  const [pendingAddUsername, setPendingAddUsername] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('add');
    return param ? normalizeHandle(param) : '';
  });
  const [inviteModalUser, setInviteModalUser] = useState(null);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [contactStatusMessage, setContactStatusMessage] = useState('');
  const [searching, setSearching] = useState(false);

  // Social Graph & Chats
  const [incomingPendingReqs, setIncomingPendingReqs] = useState([]);
  const [outgoingPendingReqs, setOutgoingPendingReqs] = useState([]);
  const [acceptedFromReqs, setAcceptedFromReqs] = useState([]);
  const [acceptedToReqs, setAcceptedToReqs] = useState([]);
  const [userContactsDocs, setUserContactsDocs] = useState([]);
  const [userProfilesMap, setUserProfilesMap] = useState({});
  const [directChatsMap, setDirectChatsMap] = useState({});
  const [groups, setGroups] = useState([]);

  // Active Chat
  const [activeChat, setActiveChat] = useState(null); // { type: 'direct' | 'group', id, peerUid? }
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Drawers & Modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [busyActionId, setBusyActionId] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'direct' | 'groups'

  // Global App Config (config/appState) & Dismissible Banner (persisted in localStorage)
  const [appState, setAppState] = useState({
    announcement: { id: '', active: false, text: '' },
    allowNewSignups: true,
    allowVideoCalls: true,
  });
  const [dismissedBannerId, setDismissedBannerId] = useState(() => {
    try {
      return window.localStorage.getItem('voliud_dismissed_announcement_id') || '';
    } catch {
      return '';
    }
  });

  // Owner / Admin Console (Spark-plan friendly on-demand queries + real-time reports)
  const [ownerConsoleOpen, setOwnerConsoleOpen] = useState(false);
  const [ownerTab, setOwnerTab] = useState('users'); // 'users' | 'reports' | 'logs'
  const [ownerStats, setOwnerStats] = useState({ users: null, groups: null });
  const [ownerDirectory, setOwnerDirectory] = useState([]);
  const [ownerLastDoc, setOwnerLastDoc] = useState(null);
  const [ownerHasMore, setOwnerHasMore] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerNotice, setOwnerNotice] = useState('');
  const [ownerReports, setOwnerReports] = useState([]);
  const [ownerLogs, setOwnerLogs] = useState([]);
  const [announcementActiveDraft, setAnnouncementActiveDraft] = useState(false);
  const [announcementTextDraft, setAnnouncementTextDraft] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [badgeDrafts, setBadgeDrafts] = useState({});
  const [ownerActionUid, setOwnerActionUid] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState('');
  const [modalPopup, setModalPopup] = useState(null); // { title, message, tone }

  // Demo sandbox data store
  const [demoMessagesByChat, setDemoMessagesByChat] = useState({});
  const typingTimerRef = useRef(null);
  const rateNoticeTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const syncedLoginUidRef = useRef('');

  // Client-side rate limiters (anti-spam / cooldown defense in depth)
  const messageLimiterRef = useRef(
    createRateLimiter({ minIntervalMs: 600, maxHits: 8, windowMs: 10000, label: 'Messaging' })
  );
  const contactRequestLimiterRef = useRef(
    createRateLimiter({ minIntervalMs: 3000, maxHits: 5, windowMs: 60000, label: 'Contact requests' })
  );
  const groupCreateLimiterRef = useRef(
    createRateLimiter({ minIntervalMs: 5000, maxHits: 3, windowMs: 60000, label: 'Group creation' })
  );

  const showRateNotice = (msg) => {
    setRateLimitNotice(msg);
    if (rateNoticeTimerRef.current) clearTimeout(rateNoticeTimerRef.current);
    rateNoticeTimerRef.current = setTimeout(() => setRateLimitNotice(''), 3200);
  };

  const showAppError = useCallback((context, err) => {
    const formatted = formatFirestoreError(err, 'Unexpected error.');
    setAppError(context ? `${context}: ${formatted}` : formatted);
  }, []);

  const showAppStatus = useCallback((msg) => {
    setAppStatus(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setAppStatus(''), 3500);
  }, []);

  const reportOwnerError = useCallback((err, fallback = 'Admin action failed.') => {
    const exact = formatFirestoreError(err, fallback);
    setOwnerError(exact);
    setAppError(exact);
  }, []);

  const reportOwnerSuccess = useCallback(
    (msg) => {
      setOwnerNotice(msg);
      showAppStatus(msg);
    },
    [showAppStatus]
  );

  const openModalPopup = useCallback((title, message, tone = 'info') => {
    setModalPopup({ title, message, tone });
  }, []);

  const syncUserProfileOnLogin = useCallback(async (user) => {
    if (!isFirebaseConfigured || !db || !user?.uid) return null;
    const userRef = doc(db, 'users', user.uid);
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const displayName = user.displayName || '';
    const photoURL = user.photoURL || '';

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: normalizedEmail,
          displayName,
          photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          userRef,
          {
            uid: user.uid,
            email: normalizedEmail,
            displayName,
            photoURL,
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      return snap.exists() ? normalizeUserDoc(snap.id, snap.data()) : null;
    } catch (err) {
      showAppError('Profile login sync failed', err);
      return null;
    }
  }, [showAppError]);

  // ---------------------------------------------------------------------------
  // 0. Global App State Listener (config/appState - single doc, Spark friendly)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const appStateRef = doc(db, 'config', 'appState');
    const unsub = onSnapshot(
      appStateRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const isActive = Boolean(data.announcement?.active);
          const annText = data.announcement?.text || '';
          const annId = data.announcement?.id || (annText.trim() ? `ann_${annText.trim()}` : '');
          setAppState({
            announcement: {
              id: annId,
              active: isActive,
              text: annText,
            },
            allowNewSignups: data.allowNewSignups !== false,
            allowVideoCalls: data.allowVideoCalls !== false,
          });
        }
      },
      (err) => showAppError('Global config listener failed', err)
    );

    return () => unsub();
  }, [showAppError]);

  // ---------------------------------------------------------------------------
  // 1. Firebase Auth Listener & Login Profile Sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        syncedLoginUidRef.current = '';
        setMyProfile(null);
        setIsOwnerAdmin(false);
        setAdminVerified(false);
        setActiveChat(null);
        setOwnerConsoleOpen(false);
        setProfileOpen(false);
        setNotifOpen(false);
        setNewGroupOpen(false);
        setGroupInfoOpen(false);
        setOwnerDirectory([]);
        setOwnerStats({ users: null, groups: null });
        setOwnerReports([]);
        setOwnerLogs([]);
        return;
      }

      if (syncedLoginUidRef.current !== user.uid) {
        syncedLoginUidRef.current = user.uid;
        await syncUserProfileOnLogin(user);
      }
    });

    return () => unsub();
  }, [syncUserProfileOnLogin]);

  // Subscribe to live users/{uid} document; grant admin/owner access for role === 'owner'|'admin'|'superadmin', isAdmin, isOwner, OWNER_UID, or admins/{uid}
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !authUser) return;

    let cancelled = false;
    let hasAdminDoc = false;
    let latestUserData = null;

    setProfileLoading(true);
    setAdminVerified(false);
    setIsOwnerAdmin(false);

    const evaluateAdmin = () => {
      if (cancelled) return;
      const verifiedAdmin = hasAdminAccess(
        latestUserData || { uid: authUser.uid },
        OWNER_UID,
        hasAdminDoc
      );
      setIsOwnerAdmin(verifiedAdmin);
      setAdminVerified(true);
      if (!verifiedAdmin) setOwnerConsoleOpen(false);
    };

    getDoc(doc(db, 'admins', authUser.uid))
      .then((snap) => {
        hasAdminDoc = snap.exists();
        evaluateAdmin();
      })
      .catch(() => {
        evaluateAdmin();
      });

    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubUser = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = normalizeUserDoc(snap.id, snap.data());
          latestUserData = data;
          setMyProfile(data);
        } else {
          latestUserData = null;
          setMyProfile(null);
        }
        evaluateAdmin();
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        evaluateAdmin();
        showAppError('User profile listener failed', err);
      }
    );

    return () => {
      cancelled = true;
      unsubUser();
    };
  }, [authUser, showAppError]);

  // ---------------------------------------------------------------------------
  // 2. Social Graph Listeners (Unified contactRequests, Contacts, Direct Chats, Groups)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !myProfile?.uid) return;
    const myUid = myProfile.uid;

    // Receiver real-time listener: strictly where('to', '==', uid) + where('status', '==', 'pending'), sorted in JS
    const incomingQuery = query(
      collection(db, 'contactRequests'),
      where('to', '==', myUid),
      where('status', '==', 'pending')
    );
    const unsubIncoming = onSnapshot(
      incomingQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt, b.createdAtMs) - getMillis(a.createdAt, a.createdAtMs));
        setIncomingPendingReqs(list);
      },
      (err) => showAppError('Incoming contact requests listener failed', err)
    );

    const outgoingQuery = query(
      collection(db, 'contactRequests'),
      where('from', '==', myUid),
      where('status', '==', 'pending')
    );
    const unsubOutgoing = onSnapshot(
      outgoingQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt, b.createdAtMs) - getMillis(a.createdAt, a.createdAtMs));
        setOutgoingPendingReqs(list);
      },
      (err) => showAppError('Outgoing contact requests listener failed', err)
    );

    const acceptedToQuery = query(
      collection(db, 'contactRequests'),
      where('to', '==', myUid),
      where('status', '==', 'accepted')
    );
    const unsubAcceptedTo = onSnapshot(
      acceptedToQuery,
      (snap) => {
        setAcceptedToReqs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => showAppError('Accepted requests (incoming) listener failed', err)
    );

    const acceptedFromQuery = query(
      collection(db, 'contactRequests'),
      where('from', '==', myUid),
      where('status', '==', 'accepted')
    );
    const unsubAcceptedFrom = onSnapshot(
      acceptedFromQuery,
      (snap) => {
        setAcceptedFromReqs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => showAppError('Accepted requests (outgoing) listener failed', err)
    );

    const contactsSubRef = collection(db, 'users', myUid, 'contacts');
    const unsubContacts = onSnapshot(
      contactsSubRef,
      (snap) => {
        setUserContactsDocs(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      },
      (err) => showAppError('Contacts listener failed', err)
    );

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', myUid)
    );
    const unsubChats = onSnapshot(
      chatsQuery,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setDirectChatsMap(map);
      },
      (err) => showAppError('Chats listener failed', err)
    );

    const groupsQuery = query(
      collection(db, 'groups'),
      where('members', 'array-contains', myUid)
    );
    const unsubGroups = onSnapshot(
      groupsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = getMillis(a.updatedAt, a.updatedAtMs);
          const tb = getMillis(b.updatedAt, b.updatedAtMs);
          return tb - ta;
        });
        setGroups(list);
      },
      (err) => showAppError('Groups listener failed', err)
    );

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubAcceptedTo();
      unsubAcceptedFrom();
      unsubContacts();
      unsubChats();
      unsubGroups();
    };
  }, [myProfile?.uid, showAppError]);

  // Real-time Admin Reports listener when Owner/Admin Console is open
  useEffect(() => {
    if (!isFirebaseConfigured || !db || demoMode || !ownerConsoleOpen || !adminVerified || !isOwnerAdmin) {
      return;
    }

    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setOwnerReports(list);
      },
      (err) => {
        reportOwnerError(err, 'Reports real-time listener failed.');
      }
    );

    return () => unsubReports();
  }, [demoMode, ownerConsoleOpen, adminVerified, isOwnerAdmin, reportOwnerError]);

  // Unified view of contactRequests collection
  const contactRequests = useMemo(() => {
    const byId = new Map();
    [
      ...incomingPendingReqs,
      ...outgoingPendingReqs,
      ...acceptedToReqs,
      ...acceptedFromReqs,
    ].forEach((r) => {
      if (r?.id) byId.set(r.id, r);
    });
    return Array.from(byId.values());
  }, [incomingPendingReqs, outgoingPendingReqs, acceptedToReqs, acceptedFromReqs]);

  // Keep live user profiles synced for accepted contacts + group members
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !myProfile) return;

    const uidsToWatch = new Set([myProfile.uid]);
    contactRequests.forEach((r) => {
      if (r.status === 'accepted') {
        if (r.from) uidsToWatch.add(r.from);
        if (r.to) uidsToWatch.add(r.to);
        (r.participants || []).forEach((id) => uidsToWatch.add(id));
      }
    });
    userContactsDocs.forEach((c) => {
      if (c.uid) uidsToWatch.add(c.uid);
    });
    groups.forEach((g) => {
      (g.members || []).forEach((id) => uidsToWatch.add(id));
    });

    const unsubs = [];
    uidsToWatch.forEach((uid) => {
      const unsub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            setUserProfilesMap((prev) => ({
              ...prev,
              [uid]: normalizeUserDoc(snap.id, snap.data()),
            }));
          }
        },
        (err) => showAppError(`User profile sync (${uid}) failed`, err)
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [myProfile?.uid, contactRequests, userContactsDocs, groups, showAppError]);

  // ---------------------------------------------------------------------------
  // 3. Read-Optimized Active Chat Listener (orderBy createdAt desc, limit(30))
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    if (demoMode) {
      setMessages(demoMessagesByChat[activeChat.id] || []);
      return;
    }

    if (!isFirebaseConfigured || !db) return;

    const colName = activeChat.type === 'group' ? 'groups' : 'chats';
    const msgRef = collection(db, colName, activeChat.id, 'messages');
    const q = query(msgRef, orderBy('createdAt', 'desc'), limit(30));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => {
            const data = d.data();
            const createdAtMs =
              data.createdAt?.toMillis?.() || data.createdAtMs || Date.now();
            return { id: d.id, ...data, createdAtMs };
          })
          .reverse();
        setMessages(docs);
      },
      (err) => showAppError('Messages listener failed', err)
    );

    return () => unsub();
  }, [activeChat?.id, activeChat?.type, demoMode, demoMessagesByChat, showAppError]);

  // ---------------------------------------------------------------------------
  // 4. RTDB Typing Listener + Cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeChat || !myProfile) {
      setTypingUsers([]);
      return;
    }

    if (demoMode || !isFirebaseConfigured || !rtdb) {
      setTypingUsers([]);
      return;
    }

    const chatTypingRef = rtdbRef(rtdb, `typing/${activeChat.id}`);
    const unsub = onValue(
      chatTypingRef,
      (snap) => {
        const val = snap.val();
        if (!val) {
          setTypingUsers([]);
          return;
        }
        const now = Date.now();
        const others = Object.entries(val)
          .filter(([uid, info]) => uid !== myProfile.uid && info && now - (info.updatedAt || 0) < 5500)
          .map(([uid, info]) => ({ uid, username: info.username || 'user' }));
        setTypingUsers(others);
      },
      (err) => showAppError('Typing indicator listener failed', err)
    );

    const myTypingRef = rtdbRef(rtdb, `typing/${activeChat.id}/${myProfile.uid}`);
    onDisconnect(myTypingRef).remove();

    return () => {
      unsub();
      clearTimeout(typingTimerRef.current);
      rtdbRemove(myTypingRef).catch(() => {});
    };
  }, [activeChat?.id, myProfile?.uid, demoMode, showAppError]);

  // ---------------------------------------------------------------------------
  // 5. ?add=username Auto-Popup Lookup
  // ---------------------------------------------------------------------------
  const lookupUserByHandle = useCallback(
    async (rawHandle) => {
      const handle = normalizeHandle(rawHandle);
      if (!handle) return null;

      if (demoMode) {
        const found = Object.values(userProfilesMap).find((u) => u.usernameLower === handle);
        return found || null;
      }

      if (!isFirebaseConfigured || !db) return null;

      const unameSnap = await getDoc(doc(db, 'usernames', handle));
      if (unameSnap.exists()) {
        const unameData = unameSnap.data() || {};
        const targetUid = String(unameData.uid || '');
        if (targetUid) {
          const userSnap = await getDoc(doc(db, 'users', targetUid));
          if (userSnap.exists()) {
            return normalizeUserDoc(userSnap.id, userSnap.data());
          }
          return normalizeUserDoc(targetUid, {
            usernameLower: unameData.usernameLower || handle,
            nickname: unameData.nickname || `@${unameData.usernameLower || handle}`,
            photoURL: unameData.photoURL || '',
            status: unameData.status || 'Online',
          });
        }
      }

      // Fallback for older user docs that may not have a usernames/{handle} index doc
      const byLowerSnap = await getDocs(
        query(collection(db, 'users'), where('usernameLower', '==', handle), limit(1))
      );
      if (!byLowerSnap.empty) {
        const d = byLowerSnap.docs[0];
        return normalizeUserDoc(d.id, d.data());
      }

      const byUsernameSnap = await getDocs(
        query(collection(db, 'users'), where('username', '==', handle), limit(1))
      );
      if (!byUsernameSnap.empty) {
        const d = byUsernameSnap.docs[0];
        return normalizeUserDoc(d.id, d.data());
      }

      return null;
    },
    [demoMode, userProfilesMap]
  );

  const lookupUserByEmail = useCallback(
    async (rawEmail) => {
      const normalizedEmail = (rawEmail || '').trim().toLowerCase();
      if (!normalizedEmail) return null;

      if (demoMode) {
        const found = Object.values(userProfilesMap).find(
          (u) => (u.email || '').trim().toLowerCase() === normalizedEmail
        );
        return found || null;
      }

      if (!isFirebaseConfigured || !db) return null;

      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail),
        limit(1)
      );
      const snap = await getDocs(emailQuery);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return normalizeUserDoc(d.id, d.data());
    },
    [demoMode, userProfilesMap]
  );

  useEffect(() => {
    if (!pendingAddUsername || !myProfile) return;

    let cancelled = false;
    lookupUserByHandle(pendingAddUsername)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setInviteModalUser(found);
        }
        setPendingAddUsername('');
        if (window.location.search.includes('add=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch((err) => {
        if (!cancelled) showAppError('Invite lookup failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [pendingAddUsername, myProfile, lookupUserByHandle, showAppError]);

  // ---------------------------------------------------------------------------
  // Derived Lists
  // ---------------------------------------------------------------------------
  const incomingRequests = useMemo(
    () =>
      contactRequests
        .filter((r) => r.status === 'pending' && (r.to === myProfile?.uid || r.toUid === myProfile?.uid))
        .sort((a, b) => getMillis(b.createdAt, b.createdAtMs) - getMillis(a.createdAt, a.createdAtMs)),
    [contactRequests, myProfile?.uid]
  );

  const outgoingRequests = useMemo(
    () =>
      contactRequests
        .filter((r) => r.status === 'pending' && (r.from === myProfile?.uid || r.fromUid === myProfile?.uid))
        .sort((a, b) => getMillis(b.createdAt, b.createdAtMs) - getMillis(a.createdAt, a.createdAtMs)),
    [contactRequests, myProfile?.uid]
  );

  const acceptedContacts = useMemo(() => {
    if (!myProfile) return [];
    const byUid = new Map();

    userContactsDocs.forEach((c) => {
      if (!c.uid || c.uid === myProfile.uid) return;
      const liveProfile = userProfilesMap[c.uid];
      byUid.set(c.uid, liveProfile || c);
    });

    contactRequests
      .filter((r) => r.status === 'accepted')
      .forEach((r) => {
        const peerUid =
          r.from && r.to
            ? r.from === myProfile.uid
              ? r.to
              : r.from
            : (r.participants || []).find((id) => id !== myProfile.uid);
        if (!peerUid || peerUid === myProfile.uid) return;
        const liveProfile = userProfilesMap[peerUid];
        if (liveProfile) {
          byUid.set(peerUid, liveProfile);
          return;
        }
        if (!byUid.has(peerUid)) {
          const isPeerFrom = (r.from || r.fromUid) === peerUid;
          byUid.set(peerUid, {
            uid: peerUid,
            usernameLower: isPeerFrom ? r.fromUsername || '' : r.toUsername || '',
            email: isPeerFrom ? r.fromEmail || '' : r.toEmail || '',
            displayName: isPeerFrom ? r.fromName || '' : r.toName || '',
            nickname: isPeerFrom
              ? r.fromName || r.fromNickname || r.fromEmail || ''
              : r.toName || r.toNickname || r.toEmail || '',
            photoURL: isPeerFrom ? r.fromPhotoURL || '' : r.toPhotoURL || '',
            status: 'Online',
          });
        }
      });

    return Array.from(byUid.values()).filter((c) => c.uid);
  }, [contactRequests, userContactsDocs, myProfile, userProfilesMap]);

  const getRelationship = useCallback(
    (targetUid) => {
      if (!myProfile || !targetUid) return 'none';
      if (targetUid === myProfile.uid) return 'self';

      if (acceptedContacts.some((c) => c.uid === targetUid)) {
        return 'accepted';
      }

      const pairId = getPairId(myProfile.uid, targetUid);
      const matching = contactRequests.filter((r) => {
        if (r.id === pairId) return true;
        const fromUid = r.from || r.fromUid;
        const toUid = r.to || r.toUid;
        return (
          (fromUid === myProfile.uid && toUid === targetUid) ||
          (fromUid === targetUid && toUid === myProfile.uid)
        );
      });

      const acceptedReq = matching.find((r) => r.status === 'accepted');
      if (acceptedReq) return 'accepted';

      const pendingReq = matching.find((r) => r.status === 'pending');
      if (pendingReq) {
        const fromUid = pendingReq.from || pendingReq.fromUid;
        return fromUid === myProfile.uid ? 'outgoing' : 'incoming';
      }
      return 'none';
    },
    [myProfile, contactRequests, acceptedContacts]
  );

  // ---------------------------------------------------------------------------
  // Handlers: Auth & Onboarding
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred?.user) {
        syncedLoginUidRef.current = cred.user.uid;
        await syncUserProfileOnLogin(cred.user);
      }
    } catch (err) {
      const code = err?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        const msg = formatFirestoreError(err, 'Google sign-in failed.');
        setAuthError(msg);
        showAppError('Google Sign-In failed', err);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteOnboarding = async ({ usernameLower, nickname }) => {
    setAuthLoading(true);
    setOnboardError('');
    try {
      if (!appState.allowNewSignups) {
        throw new Error('New sign-ups are currently disabled by the administrator.');
      }
      const cleanUsername = normalizeHandle(usernameLower);
      const cleanNickname = sanitizePlainText(nickname, MAX_NICKNAME_LENGTH, false);
      if (!isValidUsername(cleanUsername)) {
        throw new Error('Username must be 3 to 12 lowercase letters, numbers, or underscores.');
      }
      if (!cleanNickname) {
        throw new Error('Display nickname is required.');
      }
      if (demoMode) {
        const profile = {
          uid: 'demo_me',
          usernameLower: cleanUsername,
          nickname: cleanNickname,
          displayName: cleanNickname,
          email: 'alex@example.com',
          role: 'user',
          photoURL: '',
          status: 'Online',
          statusNote: '',
          statusExpiresAt: null,
          isBanned: false,
          badge: '',
        };
        setMyProfile(profile);
        setUserProfilesMap((prev) => ({ ...prev, demo_me: profile }));
        return;
      }

      if (!db || !authUser) return;

      const normalizedEmail = (authUser.email || '').trim().toLowerCase();
      const displayName = authUser.displayName || cleanNickname;

      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, 'usernames', cleanUsername);
        const unameSnap = await tx.get(unameRef);
        if (unameSnap.exists()) {
          throw new Error(`@${cleanUsername} is already claimed. Pick another.`);
        }

        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (userSnap.exists() && userSnap.data()?.usernameLower) {
          throw new Error('Account profile already exists.');
        }

        const nowTs = serverTimestamp();
        tx.set(unameRef, {
          uid: authUser.uid,
          usernameLower: cleanUsername,
          nickname: cleanNickname,
          photoURL: authUser.photoURL || '',
          status: 'Online',
          createdAt: nowTs,
        });

        if (userSnap.exists()) {
          // Preserve existing role / isAdmin while finishing @username setup
          tx.set(
            userRef,
            {
              uid: authUser.uid,
              email: normalizedEmail,
              displayName,
              usernameLower: cleanUsername,
              nickname: cleanNickname,
              photoURL: authUser.photoURL || '',
              status: 'Online',
              statusNote: '',
              statusExpiresAt: null,
              updatedAt: nowTs,
            },
            { merge: true }
          );
        } else {
          tx.set(userRef, {
            uid: authUser.uid,
            email: normalizedEmail,
            displayName,
            usernameLower: cleanUsername,
            nickname: cleanNickname,
            photoURL: authUser.photoURL || '',
            role: 'user',
            status: 'Online',
            statusNote: '',
            statusExpiresAt: null,
            isBanned: false,
            badge: '',
            createdAt: nowTs,
            updatedAt: nowTs,
          });
        }
      });
    } catch (err) {
      const msg = formatFirestoreError(err, 'Unable to claim @username.');
      setOnboardError(msg);
      showAppError('Onboarding failed', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (demoMode) {
        setDemoMode(false);
        setMyProfile(null);
        setAuthUser(null);
        setActiveChat(null);
        setProfileOpen(false);
        return;
      }
      if (auth) {
        await signOut(auth);
        setProfileOpen(false);
      }
    } catch (err) {
      showAppError('Sign-out failed', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Profile Studio & Owner Console
  // ---------------------------------------------------------------------------
  const handleSaveProfile = async (updates) => {
    if (!myProfile) return;
    const cleanUpdates = {
      ...updates,
      nickname: sanitizePlainText(updates.nickname, MAX_NICKNAME_LENGTH, false) || myProfile.nickname,
      statusNote: sanitizePlainText(updates.statusNote, MAX_BIO_LENGTH, false),
    };
    try {
      if (demoMode) {
        const updated = { ...myProfile, ...cleanUpdates };
        setMyProfile(updated);
        setUserProfilesMap((prev) => ({ ...prev, [myProfile.uid]: updated }));
        return;
      }

      await updateDoc(doc(db, 'users', myProfile.uid), {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
      if (myProfile.usernameLower) {
        await setDoc(
          doc(db, 'usernames', myProfile.usernameLower),
          {
            uid: myProfile.uid,
            usernameLower: myProfile.usernameLower,
            nickname: cleanUpdates.nickname,
            status: cleanUpdates.status || 'Online',
          },
          { merge: true }
        );
      }
    } catch (err) {
      showAppError('Profile update failed', err);
      throw err;
    }
  };

  const appendAdminLog = async (action, targetUid = '', details = '') => {
    if (demoMode || !db || !myProfile?.uid) return;
    try {
      await addDoc(collection(db, 'adminLogs'), {
        actorUid: myProfile.uid,
        actorEmail: (myProfile.email || authUser?.email || '').trim().toLowerCase(),
        action: String(action || ''),
        targetUid: String(targetUid || ''),
        details: String(details || ''),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      setOwnerError((prev) => prev || `Audit log write failed: ${formatFirestoreError(err)}`);
    }
  };

  const loadOwnerConsoleData = async () => {
    setOwnerLoading(true);
    setOwnerError('');
    try {
      if (demoMode) {
        setOwnerStats({
          users: Object.keys(userProfilesMap).length,
          groups: groups.length,
        });
        const list = Object.values(userProfilesMap);
        setOwnerDirectory(list);
        setOwnerHasMore(false);
        const drafts = {};
        list.forEach((u) => {
          drafts[u.uid] = u.badge || '';
        });
        setBadgeDrafts(drafts);
        return;
      }

      const [uRes, gRes, dirRes, logsRes, reportsRes] = await Promise.allSettled([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'groups')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'adminLogs'), limit(50))),
        getDocs(collection(db, 'reports')),
      ]);

      setOwnerStats({
        users: uRes.status === 'fulfilled' ? uRes.value.data().count : null,
        groups: gRes.status === 'fulfilled' ? gRes.value.data().count : null,
      });

      const errors = [];
      if (uRes.status === 'rejected') errors.push(`Users count: ${formatFirestoreError(uRes.reason)}`);
      if (gRes.status === 'rejected') errors.push(`Groups count: ${formatFirestoreError(gRes.reason)}`);

      if (dirRes.status === 'fulfilled') {
        const snap = dirRes.value;
        const usersList = snap.docs
          .map((d) => normalizeUserDoc(d.id, d.data()))
          .sort((a, b) =>
            (a.usernameLower || a.email || a.uid).localeCompare(b.usernameLower || b.email || b.uid)
          );
        setOwnerDirectory(usersList);
        setOwnerLastDoc(null);
        setOwnerHasMore(false);
        const drafts = {};
        usersList.forEach((u) => {
          drafts[u.uid] = u.badge || '';
        });
        setBadgeDrafts(drafts);
      } else {
        errors.push(`Directory: ${formatFirestoreError(dirRes.reason)}`);
      }

      if (logsRes.status === 'fulfilled') {
        const logsList = logsRes.value.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setOwnerLogs(logsList);
      } else {
        errors.push(`Audit logs: ${formatFirestoreError(logsRes.reason)}`);
      }

      if (reportsRes.status === 'fulfilled') {
        const reportsList = reportsRes.value.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setOwnerReports(reportsList);
      } else {
        errors.push(`Reports: ${formatFirestoreError(reportsRes.reason)}`);
      }

      if (errors.length > 0) {
        const joined = errors.join(' • ');
        setOwnerError(joined);
        setAppError(joined);
      }
    } catch (err) {
      reportOwnerError(err, 'Unable to load Owner Console data.');
    } finally {
      setOwnerLoading(false);
    }
  };

  const loadMoreDirectoryUsers = async () => {
    if (demoMode || !db || !ownerLastDoc || ownerLoading) return;
    setOwnerLoading(true);
    setOwnerError('');
    try {
      const nextQuery = query(
        collection(db, 'users'),
        startAfter(ownerLastDoc),
        limit(25)
      );
      const snap = await getDocs(nextQuery);
      const more = snap.docs.map((d) => normalizeUserDoc(d.id, d.data()));
      setOwnerDirectory((prev) => [...prev, ...more]);
      setOwnerLastDoc(snap.docs[snap.docs.length - 1] || null);
      setOwnerHasMore(snap.docs.length === 25);
      setBadgeDrafts((prev) => {
        const next = { ...prev };
        more.forEach((u) => {
          next[u.uid] = u.badge || '';
        });
        return next;
      });
    } catch (err) {
      reportOwnerError(err, 'Failed to load more users.');
    } finally {
      setOwnerLoading(false);
    }
  };

  const openOwnerConsole = () => {
    if (!authReady || (!authUser && !demoMode) || !adminVerified || !isOwnerAdmin) return;
    setOwnerError('');
    setOwnerNotice('');
    setConfirmDeleteUid('');
    setAnnouncementActiveDraft(Boolean(appState.announcement?.active));
    setAnnouncementTextDraft(appState.announcement?.text || '');
    setOwnerConsoleOpen(true);
    loadOwnerConsoleData();
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    if (!isOwnerAdmin) return;
    setAnnouncementSaving(true);
    setOwnerError('');
    setOwnerNotice('');
    const cleanText = String(announcementTextDraft || '').trim().slice(0, 180);
    const nextAnnouncement = {
      id: cleanText ? `ann_${Date.now()}` : '',
      active: Boolean(announcementActiveDraft && cleanText),
      text: cleanText,
      updatedBy: String(myProfile?.uid || authUser?.uid || ''),
    };
    try {
      if (demoMode) {
        setAppState((prev) => ({ ...prev, announcement: nextAnnouncement }));
        reportOwnerSuccess('Saved announcement to config/appState (preview).');
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await setDoc(
        doc(db, 'config', 'appState'),
        {
          announcement: { ...nextAnnouncement, updatedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await appendAdminLog(
        'announcement_update',
        'config/appState',
        `${nextAnnouncement.active ? 'Published' : 'Hidden'}: ${nextAnnouncement.text}`
      );
      reportOwnerSuccess('Saved Global Announcement to config/appState.');
    } catch (err) {
      reportOwnerError(err, 'Save announcement failed.');
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleClearAnnouncement = async () => {
    if (!isOwnerAdmin) return;
    setAnnouncementSaving(true);
    setOwnerError('');
    setOwnerNotice('');
    const cleared = {
      id: '',
      active: false,
      text: '',
      updatedBy: String(myProfile?.uid || authUser?.uid || ''),
    };
    try {
      setAnnouncementActiveDraft(false);
      setAnnouncementTextDraft('');
      if (demoMode) {
        setAppState((prev) => ({ ...prev, announcement: cleared }));
        reportOwnerSuccess('Cleared active announcement (preview).');
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await setDoc(
        doc(db, 'config', 'appState'),
        {
          announcement: { ...cleared, updatedAt: serverTimestamp() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await appendAdminLog('announcement_clear', 'config/appState', 'Cleared active announcement');
      reportOwnerSuccess('Deleted / cleared active announcement.');
    } catch (err) {
      reportOwnerError(err, 'Clear announcement failed.');
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleToggleAppFeature = async (key, nextValue) => {
    if (!isOwnerAdmin || !key) return;
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setAppState((prev) => ({ ...prev, [key]: Boolean(nextValue) }));
        reportOwnerSuccess(`Updated ${key} in config/appState (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await setDoc(
        doc(db, 'config', 'appState'),
        {
          [key]: Boolean(nextValue),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await appendAdminLog('feature_toggle', 'config/appState', `${key}=${Boolean(nextValue)}`);
      reportOwnerSuccess(`Updated ${key} (${nextValue ? 'enabled' : 'disabled'}) in config/appState.`);
    } catch (err) {
      reportOwnerError(err, `Feature toggle (${key}) failed.`);
    }
  };

  const handleAssignBadge = async (targetUserOrUid, rawBadge) => {
    const targetUid = String(
      typeof targetUserOrUid === 'string'
        ? targetUserOrUid
        : targetUserOrUid?.uid || targetUserOrUid?.id || ''
    );
    if (!isOwnerAdmin) return;
    if (!targetUid) {
      reportOwnerError(new Error('Missing target user ID for badge update.'));
      return;
    }
    const cleanBadge = String(rawBadge || '').trim().slice(0, 16);
    setOwnerActionUid(targetUid);
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerDirectory((prev) =>
          prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, badge: cleanBadge } : u))
        );
        setUserProfilesMap((prev) =>
          prev[targetUid] ? { ...prev, [targetUid]: { ...prev[targetUid], badge: cleanBadge } } : prev
        );
        if (myProfile?.uid === targetUid) {
          setMyProfile((p) => (p ? { ...p, badge: cleanBadge } : p));
        }
        reportOwnerSuccess(`Updated badge on users/${targetUid} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await updateDoc(doc(db, 'users', targetUid), {
        badge: cleanBadge,
        updatedAt: serverTimestamp(),
      });
      await appendAdminLog('badge_update', targetUid, `badge="${cleanBadge}"`);
      setOwnerDirectory((prev) =>
        prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, badge: cleanBadge } : u))
      );
      reportOwnerSuccess(`Updated badge on users/${targetUid}.`);
    } catch (err) {
      reportOwnerError(err, `Badge update failed (users/${targetUid}).`);
    } finally {
      setOwnerActionUid('');
    }
  };

  const handleUpdateUserRole = async (targetUser, nextRole) => {
    if (!isOwnerAdmin) return;
    const targetUid = String(targetUser?.uid || targetUser?.id || '');
    if (!targetUid) {
      reportOwnerError(new Error('Missing target user ID for role update.'));
      return;
    }
    const cleanRole =
      nextRole === 'owner'
        ? 'owner'
        : nextRole === 'superadmin'
        ? 'superadmin'
        : nextRole === 'admin'
        ? 'admin'
        : 'user';
    if (targetUid === myProfile?.uid && cleanRole === 'user') {
      reportOwnerError(new Error('You cannot remove admin/owner role from your own active session.'));
      return;
    }
    const nextIsAdmin = cleanRole === 'admin' || cleanRole === 'owner' || cleanRole === 'superadmin';
    const nextIsOwner = cleanRole === 'owner';
    setOwnerActionUid(targetUid);
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerDirectory((prev) =>
          prev.map((u) =>
            (u.uid || u.id) === targetUid
              ? { ...u, role: cleanRole, isAdmin: nextIsAdmin, isOwner: nextIsOwner }
              : u
          )
        );
        reportOwnerSuccess(`Updated role=${cleanRole} on users/${targetUid} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await updateDoc(doc(db, 'users', targetUid), {
        role: cleanRole,
        isAdmin: nextIsAdmin,
        isOwner: nextIsOwner,
        updatedAt: serverTimestamp(),
      });
      await appendAdminLog('role_update', targetUid, `role=${cleanRole}`);
      setOwnerDirectory((prev) =>
        prev.map((u) =>
          (u.uid || u.id) === targetUid
            ? { ...u, role: cleanRole, isAdmin: nextIsAdmin, isOwner: nextIsOwner }
            : u
        )
      );
      reportOwnerSuccess(`Updated role to ${cleanRole} on users/${targetUid}.`);
    } catch (err) {
      reportOwnerError(err, `Role update failed (users/${targetUid}).`);
    } finally {
      setOwnerActionUid('');
    }
  };

  const handleToggleBan = async (targetUser) => {
    if (!isOwnerAdmin) return;
    const targetUid = String(targetUser?.uid || targetUser?.id || '');
    if (!targetUid) {
      reportOwnerError(new Error('Missing target user ID for ban toggle.'));
      return;
    }
    if (targetUid === myProfile?.uid) {
      reportOwnerError(new Error('You cannot ban your own active admin account.'));
      return;
    }
    const nextBanned = !Boolean(targetUser?.isBanned);
    setOwnerActionUid(targetUid);
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerDirectory((prev) =>
          prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, isBanned: nextBanned } : u))
        );
        setUserProfilesMap((prev) =>
          prev[targetUid]
            ? { ...prev, [targetUid]: { ...prev[targetUid], isBanned: nextBanned } }
            : prev
        );
        reportOwnerSuccess(`Updated isBanned on users/${targetUid} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await updateDoc(doc(db, 'users', targetUid), {
        isBanned: nextBanned,
        updatedAt: serverTimestamp(),
      });
      await appendAdminLog('ban_toggle', targetUid, `isBanned=${nextBanned}`);
      setOwnerDirectory((prev) =>
        prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, isBanned: nextBanned } : u))
      );
      reportOwnerSuccess(`${nextBanned ? 'Banned' : 'Unbanned'} user on users/${targetUid}.`);
    } catch (err) {
      reportOwnerError(err, `Ban toggle failed (users/${targetUid}).`);
    } finally {
      setOwnerActionUid('');
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!isOwnerAdmin) return;
    const targetUid = String(targetUser?.uid || targetUser?.id || '');
    if (!targetUid) {
      reportOwnerError(new Error('Missing target user ID for delete.'));
      return;
    }
    if (targetUid === myProfile?.uid) {
      reportOwnerError(new Error('You cannot delete your own active admin account.'));
      return;
    }
    setOwnerActionUid(targetUid);
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerDirectory((prev) => prev.filter((u) => (u.uid || u.id) !== targetUid));
        setConfirmDeleteUid('');
        reportOwnerSuccess(`Deleted user ${targetUid} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await deleteDoc(doc(db, 'users', targetUid));
      if (targetUser?.usernameLower) {
        await deleteDoc(doc(db, 'usernames', String(targetUser.usernameLower))).catch(() => {});
      }
      await appendAdminLog(
        'user_delete',
        targetUid,
        String(targetUser?.email || targetUser?.usernameLower || targetUid)
      );
      setOwnerDirectory((prev) => prev.filter((u) => (u.uid || u.id) !== targetUid));
      setConfirmDeleteUid('');
      reportOwnerSuccess(`Deleted user users/${targetUid}.`);
    } catch (err) {
      reportOwnerError(err, `Delete user failed (users/${targetUid}).`);
    } finally {
      setOwnerActionUid('');
    }
  };

  const handleResolveReport = async (reportId, nextStatus) => {
    if (!isOwnerAdmin || !reportId) return;
    const cleanStatus = nextStatus === 'dismissed' ? 'dismissed' : 'resolved';
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: cleanStatus } : r))
        );
        reportOwnerSuccess(`Marked report ${reportId} as ${cleanStatus} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await updateDoc(doc(db, 'reports', String(reportId)), {
        status: cleanStatus,
        reviewedBy: String(myProfile?.uid || authUser?.uid || ''),
        updatedAt: serverTimestamp(),
      });
      await appendAdminLog('report_update', String(reportId), `status=${cleanStatus}`);
      setOwnerReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: cleanStatus } : r))
      );
      reportOwnerSuccess(`Marked report ${reportId} as ${cleanStatus}.`);
    } catch (err) {
      reportOwnerError(err, 'Report update failed.');
    }
  };

  const handleBanReportedUser = async (report) => {
    if (!isOwnerAdmin || !report) return;
    const targetUid = String(report.reportedUserId || report.reportedUid || '');
    if (!targetUid) {
      reportOwnerError(new Error('Missing reported user ID on this report.'));
      return;
    }
    if (targetUid === myProfile?.uid) {
      reportOwnerError(new Error('You cannot ban your own active admin account.'));
      return;
    }
    setOwnerActionUid(targetUid);
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerDirectory((prev) =>
          prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, isBanned: true } : u))
        );
        reportOwnerSuccess(`Banned reported user ${targetUid} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await updateDoc(doc(db, 'users', targetUid), {
        isBanned: true,
        updatedAt: serverTimestamp(),
      });
      if (report.id) {
        await updateDoc(doc(db, 'reports', String(report.id)), {
          status: 'resolved',
          reviewedBy: String(myProfile?.uid || authUser?.uid || ''),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      await appendAdminLog('ban_reported_user', targetUid, `reportId=${String(report.id || '')}`);
      setOwnerDirectory((prev) =>
        prev.map((u) => ((u.uid || u.id) === targetUid ? { ...u, isBanned: true } : u))
      );
      reportOwnerSuccess(`Banned reported user users/${targetUid}.`);
    } catch (err) {
      reportOwnerError(err, `Failed to ban reported user (users/${targetUid}).`);
    } finally {
      setOwnerActionUid('');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!isOwnerAdmin || !reportId) return;
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerReports((prev) => prev.filter((r) => r.id !== reportId));
        reportOwnerSuccess(`Deleted report ${reportId} (preview).`);
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      await deleteDoc(doc(db, 'reports', String(reportId)));
      await appendAdminLog('report_delete', String(reportId), 'Deleted report');
      setOwnerReports((prev) => prev.filter((r) => r.id !== reportId));
      reportOwnerSuccess(`Deleted report ${reportId}.`);
    } catch (err) {
      reportOwnerError(err, 'Delete report failed.');
    }
  };

  const handleClearAdminLogs = async () => {
    if (!isOwnerAdmin) return;
    setOwnerError('');
    setOwnerNotice('');
    try {
      if (demoMode) {
        setOwnerLogs([]);
        reportOwnerSuccess('Cleared admin audit logs (preview).');
        return;
      }
      if (!db) throw new Error('Firestore is not initialized.');
      const logsSnap = await getDocs(collection(db, 'adminLogs'));
      await Promise.all(logsSnap.docs.map((d) => deleteDoc(d.ref)));
      setOwnerLogs([]);
      reportOwnerSuccess(`Cleared ${logsSnap.size} admin audit log${logsSnap.size === 1 ? '' : 's'}.`);
    } catch (err) {
      reportOwnerError(err, 'Clear admin logs failed.');
    }
  };

  const handleReportContact = async ({ contactUser, reason, details }) => {
    const currentUid = String(authUser?.uid || myProfile?.uid || '');
    const reportedUid = String(contactUser?.uid || contactUser?.id || '');
    if (!currentUid || !reportedUid) {
      openModalPopup('Report Failed', 'Unable to identify contact user.', 'error');
      return false;
    }
    try {
      if (demoMode) {
        setOwnerReports((prev) => [
          {
            id: `rep_${Date.now()}`,
            reporterId: currentUid,
            reporterUid: currentUid,
            reporterName: String(myProfile?.displayName || myProfile?.nickname || ''),
            reporterUsername: String(myProfile?.usernameLower || myProfile?.username || ''),
            reportedUserId: reportedUid,
            reportedUserName: String(contactUser?.displayName || contactUser?.nickname || ''),
            reportedUsername: String(contactUser?.usernameLower || contactUser?.username || ''),
            chatId: String(activeChat?.id || ''),
            reason: String(reason || 'Other'),
            details: String(details || '').trim(),
            status: 'open',
            createdAtMs: Date.now(),
          },
          ...prev,
        ]);
        openModalPopup('Report Submitted', 'Your report has been sent to the Admin.', 'success');
        return true;
      }

      if (!db) throw new Error('Firestore is not initialized.');
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUid,
        reporterUid: currentUid,
        reporterName: String(
          authUser?.displayName || myProfile?.displayName || myProfile?.nickname || ''
        ),
        reporterUsername: String(myProfile?.usernameLower || myProfile?.username || ''),
        reportedUserId: reportedUid,
        reportedUserName: String(contactUser?.displayName || contactUser?.nickname || ''),
        reportedUsername: String(contactUser?.usernameLower || contactUser?.username || ''),
        chatId: String(activeChat?.id || ''),
        reason: String(reason || 'Other'),
        details: String(details || '').trim(),
        status: 'open',
        createdAt: serverTimestamp(),
      });

      openModalPopup('Report Submitted', 'Your report has been sent to the Admin.', 'success');
      return true;
    } catch (err) {
      const exactErr = formatFirestoreError(err, 'Unable to submit report.');
      openModalPopup('Report Failed', exactErr, 'error');
      setAppError(exactErr);
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Search & Contact Requests
  // ---------------------------------------------------------------------------
  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setContactStatusMessage('');
    if (!trimmed) {
      setSearchResult(null);
      setSearchError('');
      return;
    }

    const isEmailQuery = trimmed.includes('@') && !trimmed.startsWith('@');
    setSearching(true);
    setSearchError('');
    try {
      let found = null;
      if (isEmailQuery) {
        const normalizedEmail = trimmed.toLowerCase();
        found = await lookupUserByEmail(normalizedEmail);
      } else {
        const clean = normalizeHandle(trimmed);
        if (!isValidUsername(clean)) {
          setSearchResult(null);
          setSearchError('Enter a valid email address or 3–12 character @username.');
          setSearching(false);
          return;
        }
        found = await lookupUserByHandle(clean);
      }

      if (!found) {
        setSearchResult(null);
        setSearchError('User not found');
      } else {
        setSearchResult(normalizeUserDoc(found.id || found.uid, found));
      }
    } catch (err) {
      setSearchResult(null);
      const msg = formatFirestoreError(err, 'Search failed.');
      setSearchError(msg);
      showAppError('User search failed', err);
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (targetUser) => {
    const currentUid = authUser?.uid || myProfile?.uid;
    const targetUid = targetUser?.uid || targetUser?.id;

    // Immediately open visible custom modal popup so it never fails silently
    openModalPopup('Contact Request', 'Verifying user details...', 'loading');

    // Step 1: Verify sender and target UIDs exist
    if (!currentUid || !targetUid) {
      const missingMsg = 'Error: Missing sender or target UID';
      setSearchError(missingMsg);
      setContactStatusMessage(missingMsg);
      openModalPopup('Request Failed', missingMsg, 'error');
      return;
    }

    if (targetUid === currentUid) {
      const selfMsg = 'You cannot send a contact request to yourself.';
      setSearchError(selfMsg);
      setContactStatusMessage(selfMsg);
      openModalPopup('Action Not Allowed', selfMsg, 'error');
      return;
    }

    const gate = contactRequestLimiterRef.current.check();
    if (!gate.allowed) {
      setSearchError(gate.message);
      setContactStatusMessage(gate.message);
      openModalPopup('Please Wait', gate.message, 'error');
      return;
    }

    const pairId = getPairId(currentUid, targetUid);
    setBusyActionId(pairId);
    setSearchError('');
    setContactStatusMessage('');

    try {
      if (demoMode) {
        openModalPopup('Contact Request', 'Checking pending requests...', 'loading');
        const existingPending = contactRequests.some(
          (r) =>
            r.status === 'pending' &&
            ((r.from === currentUid && r.to === targetUid) ||
              (r.from === targetUid && r.to === currentUid) ||
              r.id === pairId)
        );
        if (existingPending) {
          setContactStatusMessage('Request already pending');
          openModalPopup('Request Pending', 'A request is already pending for this user.', 'info');
          return;
        }
        setContactRequests((prev) => [
          ...prev,
          {
            id: `req_${Date.now()}`,
            from: currentUid,
            fromName: String(myProfile?.displayName || myProfile?.nickname || ''),
            fromUsername: String(myProfile?.username || myProfile?.usernameLower || ''),
            fromEmail: String(myProfile?.email || 'alex@example.com').trim().toLowerCase(),
            to: targetUid,
            toName: String(targetUser?.displayName || targetUser?.nickname || ''),
            toUsername: String(targetUser?.username || targetUser?.usernameLower || ''),
            toEmail: String(targetUser?.email || '').trim().toLowerCase(),
            status: 'pending',
            createdAtMs: Date.now(),
          },
        ]);
        setContactStatusMessage('Contact request sent!');
        openModalPopup(
          'Request Sent',
          'You have successfully sent the request. Please wait for them to accept or decline. Please be patient.',
          'success'
        );
        return;
      }

      if (!db) {
        openModalPopup('Send Failed', 'Send failed (unavailable): Firestore is not initialized.', 'error');
        return;
      }

      // Step 2: Check contactRequests for existing "pending" request (own try/catch)
      openModalPopup('Contact Request', 'Checking for existing pending requests...', 'loading');
      let hasPending = false;
      try {
        const [fromSnap, toSnap] = await Promise.all([
          getDocs(query(collection(db, 'contactRequests'), where('from', '==', currentUid))),
          getDocs(query(collection(db, 'contactRequests'), where('to', '==', currentUid))),
        ]);

        const outgoingPending = fromSnap.docs.some((d) => {
          const data = d.data() || {};
          return data.to === targetUid && data.status === 'pending';
        });
        const incomingPending = toSnap.docs.some((d) => {
          const data = d.data() || {};
          return data.from === targetUid && data.status === 'pending';
        });
        hasPending = outgoingPending || incomingPending;
      } catch (err) {
        const dupMsg = `Duplicate check failed: ${err?.message || 'Unknown error'}`;
        setSearchError(dupMsg);
        setContactStatusMessage(dupMsg);
        setAppError(dupMsg);
        openModalPopup('Duplicate Check Failed', dupMsg, 'error');
        return;
      }

      if (hasPending) {
        setContactStatusMessage('Request already pending');
        openModalPopup('Request Pending', 'A request is already pending for this user.', 'info');
        return;
      }

      // Step 3: Write the new request (own try/catch)
      openModalPopup('Contact Request', 'Sending contact request...', 'loading');
      try {
        const fromEmail = String(authUser?.email || myProfile?.email || '').trim().toLowerCase();
        const fromName = String(
          authUser?.displayName || myProfile?.displayName || myProfile?.nickname || ''
        );
        const fromUsername = String(
          myProfile?.username || myProfile?.usernameLower || ''
        );
        const toEmail = String(targetUser?.email || '').trim().toLowerCase();
        const toName = String(targetUser?.displayName || targetUser?.nickname || '');
        const toUsername = String(
          targetUser?.username || targetUser?.usernameLower || ''
        );

        await addDoc(collection(db, 'contactRequests'), {
          from: currentUid,
          fromName,
          fromUsername,
          fromEmail,
          to: targetUid,
          toName,
          toUsername,
          toEmail,
          status: 'pending',
          createdAt: serverTimestamp(),
        });

        setContactStatusMessage('Contact request sent!');
        openModalPopup(
          'Request Sent',
          'You have successfully sent the request. Please wait for them to accept or decline. Please be patient.',
          'success'
        );
      } catch (err) {
        const sendMsg = `Send failed (${err?.code || 'unknown'}): ${err?.message || 'Unable to send contact request.'}`;
        setSearchError(sendMsg);
        setContactStatusMessage(sendMsg);
        setAppError(sendMsg);
        openModalPopup('Send Failed', sendMsg, 'error');
      }
    } finally {
      setBusyActionId('');
    }
  };

  const handleAcceptRequest = async (reqOrUser) => {
    const myUid = authUser?.uid || myProfile?.uid;
    if (!myUid || !reqOrUser) return;

    const req =
      reqOrUser.from || reqOrUser.fromUid
        ? reqOrUser
        : contactRequests.find(
            (r) =>
              r.status === 'pending' &&
              ((r.from === reqOrUser.uid && r.to === myUid) ||
                (r.fromUid === reqOrUser.uid && r.toUid === myUid) ||
                r.id === getPairId(myUid, reqOrUser.uid))
          );
    if (!req) return;

    const peerUid =
      req.from && req.to
        ? req.from === myUid
          ? req.to
          : req.from
        : (req.participants || []).find((id) => id !== myUid) || req.fromUid;
    if (!peerUid) return;

    const pairId = getPairId(myUid, peerUid);
    setBusyActionId(req.id);
    try {
      if (demoMode) {
        setContactRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: 'accepted' } : r))
        );
        setDirectChatsMap((prev) => ({
          ...prev,
          [pairId]: prev[pairId] || {
            id: pairId,
            participants: [myUid, peerUid].sort(),
            updatedAtMs: Date.now(),
          },
        }));
        setNotifOpen(false);
        setSearchResult(null);
        setInviteModalUser(null);
        setActiveChat({ type: 'direct', id: pairId, peerUid });
        showAppStatus('Contact request accepted');
        return;
      }

      if (!db) throw new Error('Firestore is not initialized.');

      // 1. Update request status to "accepted"
      await updateDoc(doc(db, 'contactRequests', req.id), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });

      // 2. Add both users to each other's contacts subcollection
      const peerProfile = userProfilesMap[peerUid] || {};
      const myEntry = {
        uid: myUid,
        email: (authUser?.email || myProfile?.email || '').trim().toLowerCase(),
        displayName: authUser?.displayName || myProfile?.displayName || myProfile?.nickname || '',
        usernameLower: myProfile?.usernameLower || '',
        nickname: myProfile?.nickname || myProfile?.displayName || '',
        photoURL: myProfile?.photoURL || authUser?.photoURL || '',
        chatId: pairId,
        addedAt: serverTimestamp(),
      };
      const peerEntry = {
        uid: peerUid,
        email: (peerProfile.email || req.fromEmail || '').trim().toLowerCase(),
        displayName: peerProfile.displayName || req.fromName || '',
        usernameLower: peerProfile.usernameLower || req.fromUsername || '',
        nickname: peerProfile.nickname || req.fromName || req.fromNickname || req.fromEmail || '',
        photoURL: peerProfile.photoURL || req.fromPhotoURL || '',
        chatId: pairId,
        addedAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(doc(db, 'users', myUid, 'contacts', peerUid), peerEntry, { merge: true }),
        setDoc(doc(db, 'users', peerUid, 'contacts', myUid), myEntry, { merge: true }),
      ]);

      // 3. Create / ensure direct chat document and open it cleanly
      await setDoc(
        doc(db, 'chats', pairId),
        {
          participants: [myUid, peerUid].sort(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNotifOpen(false);
      setSearchResult(null);
      setInviteModalUser(null);
      setActiveChat({ type: 'direct', id: pairId, peerUid });
      showAppStatus('Contact request accepted');
    } catch (err) {
      showAppError('Accept contact request failed', err);
    } finally {
      setBusyActionId('');
    }
  };

  const handleDeclineRequest = async (req) => {
    setBusyActionId(req.id);
    try {
      if (demoMode) {
        setContactRequests((prev) => prev.filter((r) => r.id !== req.id));
        return;
      }
      await updateDoc(doc(db, 'contactRequests', req.id), {
        status: 'declined',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Decline contact request failed', err);
    } finally {
      setBusyActionId('');
    }
  };

  const handleCancelOutgoing = async (req) => {
    setBusyActionId(req.id);
    try {
      if (demoMode) {
        setContactRequests((prev) => prev.filter((r) => r.id !== req.id));
        return;
      }
      await deleteDoc(doc(db, 'contactRequests', req.id));
    } catch (err) {
      showAppError('Cancel outgoing request failed', err);
    } finally {
      setBusyActionId('');
    }
  };

  const openDirectChat = async (peerUser) => {
    if (!myProfile || !peerUser) return;
    const chatId = getPairId(myProfile.uid, peerUser.uid);
    try {
      if (!demoMode && isFirebaseConfigured && db && !directChatsMap[chatId]) {
        await setDoc(
          doc(db, 'chats', chatId),
          {
            participants: [myProfile.uid, peerUser.uid].sort(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      setSearchResult(null);
      setSearchInput('');
      setContactStatusMessage('');
      setInviteModalUser(null);
      setActiveChat({ type: 'direct', id: chatId, peerUid: peerUser.uid });
    } catch (err) {
      showAppError('Open direct chat failed', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: Messaging, Typing, Calls, Polls, Groups
  // ---------------------------------------------------------------------------
  const sendMessagePayload = async (payload) => {
    if (!activeChat || !myProfile || myProfile.isBanned) return false;

    const gate = messageLimiterRef.current.check();
    if (!gate.allowed) {
      showRateNotice(gate.message);
      return false;
    }

    const sanitizedText = sanitizePlainText(payload.text, MAX_MESSAGE_LENGTH, true);
    if (payload.type === 'text' && !sanitizedText) return false;

    const sanitizedPayload = {
      ...payload,
      text: sanitizedText || payload.text,
    };

    const baseMsg = {
      senderUid: myProfile.uid,
      senderUsername: myProfile.usernameLower || '',
      senderNickname: myProfile.nickname || myProfile.displayName || '',
      createdAtMs: Date.now(),
      ...sanitizedPayload,
    };

    const previewText =
      sanitizedPayload.type === 'call_invite'
        ? 'Video Call Invite'
        : sanitizedPayload.type === 'poll'
        ? `Poll: ${sanitizedPayload.poll?.question || ''}`
        : sanitizedPayload.text;

    if (demoMode) {
      const msgWithId = { ...baseMsg, id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
      setDemoMessagesByChat((prev) => ({
        ...prev,
        [activeChat.id]: [...(prev[activeChat.id] || []), msgWithId].slice(-30),
      }));
      if (activeChat.type === 'direct') {
        setDirectChatsMap((prev) => ({
          ...prev,
          [activeChat.id]: {
            ...(prev[activeChat.id] || { id: activeChat.id, participants: [myProfile.uid, activeChat.peerUid] }),
            lastMessage: previewText.slice(0, 140),
            updatedAtMs: Date.now(),
          },
        }));
      } else {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === activeChat.id
              ? { ...g, lastMessage: previewText.slice(0, 140), updatedAtMs: Date.now() }
              : g
          )
        );
      }
      return true;
    }

    try {
      const colName = activeChat.type === 'group' ? 'groups' : 'chats';
      await addDoc(collection(db, colName, activeChat.id, 'messages'), {
        ...baseMsg,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, colName, activeChat.id),
        {
          lastMessage: previewText.slice(0, 140),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    } catch (err) {
      showAppError('Send message failed', err);
      return false;
    }
  };

  const handleSendMessage = async (text, replyTo) => {
    return sendMessagePayload({
      type: 'text',
      text,
      ...(replyTo ? { replyTo } : {}),
    });
  };

  const handleSendCallInvite = async () => {
    if (!appState.allowVideoCalls || myProfile?.isBanned) return;
    const now = Date.now();
    await sendMessagePayload({
      type: 'call_invite',
      text: 'Jitsi Video Call',
      call: {
        roomUrl: `https://meet.jit.si/voliud-${now}`,
        expiresAt: now + 45000,
        status: 'ringing',
      },
    });
  };

  const handleRespondCall = async (messageId, nextStatus) => {
    if (!activeChat) return;
    if (demoMode) {
      setDemoMessagesByChat((prev) => ({
        ...prev,
        [activeChat.id]: (prev[activeChat.id] || []).map((m) =>
          m.id === messageId ? { ...m, call: { ...m.call, status: nextStatus } } : m
        ),
      }));
      return;
    }
    try {
      const colName = activeChat.type === 'group' ? 'groups' : 'chats';
      await updateDoc(doc(db, colName, activeChat.id, 'messages', messageId), {
        'call.status': nextStatus,
      });
    } catch (err) {
      showAppError('Call status update failed', err);
    }
  };

  const handleSendPoll = async (question, optionTexts) => {
    const cleanQ = sanitizePlainText(question, 160, false);
    const cleanOpts = optionTexts
      .map((o) => sanitizePlainText(o, 80, false))
      .filter(Boolean)
      .slice(0, 6);
    if (!cleanQ || cleanOpts.length < 2) return false;
    return sendMessagePayload({
      type: 'poll',
      text: cleanQ,
      poll: {
        question: cleanQ,
        options: cleanOpts.map((opt, idx) => ({
          id: `opt_${idx}_${Date.now()}`,
          text: opt,
          votes: [],
        })),
      },
    });
  };

  const handleVotePoll = async (messageId, optionId) => {
    if (!activeChat || !myProfile) return;
    const myUid = myProfile.uid;

    if (demoMode) {
      setDemoMessagesByChat((prev) => ({
        ...prev,
        [activeChat.id]: (prev[activeChat.id] || []).map((m) => {
          if (m.id !== messageId || !m.poll) return m;
          const alreadySelected = m.poll.options.find((o) => o.id === optionId)?.votes?.includes(myUid);
          return {
            ...m,
            poll: {
              ...m.poll,
              options: m.poll.options.map((o) => {
                const cleaned = (o.votes || []).filter((u) => u !== myUid);
                if (o.id === optionId && !alreadySelected) {
                  return { ...o, votes: [...cleaned, myUid] };
                }
                return { ...o, votes: cleaned };
              }),
            },
          };
        }),
      }));
      return;
    }

    try {
      const colName = activeChat.type === 'group' ? 'groups' : 'chats';
      const msgDocRef = doc(db, colName, activeChat.id, 'messages', messageId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(msgDocRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const poll = data.poll;
        if (!poll?.options) return;

        const alreadySelected = poll.options
          .find((o) => o.id === optionId)
          ?.votes?.includes(myUid);

        const nextOptions = poll.options.map((o) => {
          const cleaned = (o.votes || []).filter((u) => u !== myUid);
          if (o.id === optionId && !alreadySelected) {
            return { ...o, votes: [...cleaned, myUid] };
          }
          return { ...o, votes: cleaned };
        });

        tx.update(msgDocRef, { 'poll.options': nextOptions });
      });
    } catch (err) {
      showAppError('Poll vote failed', err);
    }
  };

  const handleTypingChange = useCallback(
    (isTyping) => {
      if (!activeChat || !myProfile || demoMode || !isFirebaseConfigured || !rtdb) return;
      const myTypingRef = rtdbRef(rtdb, `typing/${activeChat.id}/${myProfile.uid}`);
      clearTimeout(typingTimerRef.current);

      if (!isTyping) {
        rtdbRemove(myTypingRef).catch(() => {});
        return;
      }

      rtdbSet(myTypingRef, {
        username: myProfile.usernameLower,
        updatedAt: Date.now(),
      }).catch(() => {});

      onDisconnect(myTypingRef).remove();

      typingTimerRef.current = setTimeout(() => {
        rtdbRemove(myTypingRef).catch(() => {});
      }, 3000);
    },
    [activeChat?.id, myProfile?.uid, myProfile?.usernameLower, demoMode]
  );

  // ---------------------------------------------------------------------------
  // Handlers: Groups & Family Mode
  // ---------------------------------------------------------------------------
  const handleCreateGroup = async ({ name, memberUids, familyMode }) => {
    if (!myProfile) return;
    const gate = groupCreateLimiterRef.current.check();
    if (!gate.allowed) {
      throw new Error(gate.message);
    }
    const cleanName = sanitizePlainText(name, MAX_GROUP_NAME_LENGTH, false);
    if (cleanName.length < 2) {
      throw new Error('Group name must be at least 2 characters.');
    }
    const allMembers = Array.from(new Set([myProfile.uid, ...memberUids]));
    const newGroup = {
      name: cleanName,
      members: allMembers,
      admins: [myProfile.uid],
      familyMode: Boolean(familyMode),
      familyChecklist: [],
      familyNote: '',
      permissions: {
        onlyAdminsEditInfo: false,
        onlyAdminsSendMessages: false,
        onlyAdminsAddMembers: false,
      },
      lastMessage: familyMode ? 'Family Mode enabled' : 'Group created',
      updatedAtMs: Date.now(),
    };

    if (demoMode) {
      const id = `grp_${Date.now()}`;
      setGroups((prev) => [{ id, ...newGroup }, ...prev]);
      setActiveChat({ type: 'group', id });
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'groups'), {
        ...newGroup,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveChat({ type: 'group', id: docRef.id });
    } catch (err) {
      showAppError('Create group failed', err);
      throw err;
    }
  };

  const handleUpdateGroupName = async (groupId, nextName) => {
    const cleanName = sanitizePlainText(nextName, MAX_GROUP_NAME_LENGTH, false);
    if (cleanName.length < 2) return;
    if (demoMode) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: cleanName } : g)));
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: cleanName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Update group name failed', err);
    }
  };

  const handleTogglePermission = async (groupId, key, value) => {
    if (demoMode) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, permissions: { ...g.permissions, [key]: value } } : g
        )
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        [`permissions.${key}`]: value,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Update group permissions failed', err);
    }
  };

  const handleAddGroupMember = async (groupId, newUid) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup || targetGroup.members.includes(newUid)) return;
    const nextMembers = [...targetGroup.members, newUid];
    if (demoMode) {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, members: nextMembers } : g))
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: nextMembers,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Add group member failed', err);
    }
  };

  const handlePromoteAdmin = async (groupId, targetUid) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup || targetGroup.admins.includes(targetUid)) return;
    const nextAdmins = [...targetGroup.admins, targetUid];
    if (demoMode) {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, admins: nextAdmins } : g))
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        admins: nextAdmins,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Promote group admin failed', err);
    }
  };

  const handleExitGroup = async (group) => {
    if (!myProfile || !group) return;
    const remainingMembers = (group.members || []).filter((id) => id !== myProfile.uid);
    let remainingAdmins = (group.admins || []).filter((id) => id !== myProfile.uid);

    if (remainingMembers.length === 0) {
      if (demoMode) {
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        setActiveChat(null);
        return;
      }
      try {
        await deleteDoc(doc(db, 'groups', group.id));
        setActiveChat(null);
      } catch (err) {
        showAppError('Delete group failed', err);
      }
      return;
    }

    if (remainingAdmins.length === 0) {
      remainingAdmins = [remainingMembers[0]];
    }

    if (demoMode) {
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setActiveChat(null);
      return;
    }

    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: remainingMembers,
        admins: remainingAdmins,
        updatedAt: serverTimestamp(),
      });
      setActiveChat(null);
    } catch (err) {
      showAppError('Exit group failed', err);
    }
  };

  const handleUpdateFamilyData = async (groupId, patch) => {
    if (demoMode) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showAppError('Update family panel failed', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Enter Local Preview Mode (only offered when Firebase keys are placeholders)
  // ---------------------------------------------------------------------------
  const enterDemoMode = () => {
    const me = {
      uid: 'demo_me',
      usernameLower: 'alex_v',
      nickname: 'Alex',
      photoURL: '',
      status: 'Online',
      statusNote: 'Testing Voliud 3D Spatial UI',
      statusExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    const maya = {
      uid: 'demo_maya',
      usernameLower: 'maya',
      nickname: 'Maya',
      photoURL: '',
      status: 'Studying',
      statusNote: 'Library till 7pm',
      statusExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    const arjun = {
      uid: 'demo_arjun',
      usernameLower: 'arjun',
      nickname: 'Arjun',
      photoURL: '',
      status: 'Online',
      statusNote: '',
      statusExpiresAt: null,
    };
    const rhea = {
      uid: 'demo_rhea',
      usernameLower: 'rhea_k',
      nickname: 'Rhea',
      photoURL: '',
      status: 'Busy',
      statusNote: 'In lab',
      statusExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    const pairMaya = getPairId(me.uid, maya.uid);
    const pairArjun = getPairId(me.uid, arjun.uid);
    const pairRhea = getPairId(me.uid, rhea.uid);

    setDemoMode(true);
    setAuthUser({ uid: me.uid, displayName: me.nickname });
    setMyProfile(me);
    setIsOwnerAdmin(true);
    setUserProfilesMap({
      [me.uid]: me,
      [maya.uid]: maya,
      [arjun.uid]: arjun,
      [rhea.uid]: rhea,
    });
    setContactRequests([
      {
        id: pairMaya,
        participants: [me.uid, maya.uid].sort(),
        fromUid: maya.uid,
        toUid: me.uid,
        fromUsername: maya.usernameLower,
        fromNickname: maya.nickname,
        fromPhotoURL: '',
        toUsername: me.usernameLower,
        toNickname: me.nickname,
        toPhotoURL: '',
        status: 'accepted',
      },
      {
        id: pairArjun,
        participants: [me.uid, arjun.uid].sort(),
        fromUid: me.uid,
        toUid: arjun.uid,
        fromUsername: me.usernameLower,
        fromNickname: me.nickname,
        fromPhotoURL: '',
        toUsername: arjun.usernameLower,
        toNickname: arjun.nickname,
        toPhotoURL: '',
        status: 'accepted',
      },
      {
        id: pairRhea,
        participants: [me.uid, rhea.uid].sort(),
        fromUid: rhea.uid,
        toUid: me.uid,
        fromUsername: rhea.usernameLower,
        fromNickname: rhea.nickname,
        fromPhotoURL: '',
        toUsername: me.usernameLower,
        toNickname: me.nickname,
        toPhotoURL: '',
        status: 'pending',
      },
    ]);
    setDirectChatsMap({
      [pairMaya]: {
        id: pairMaya,
        participants: [me.uid, maya.uid].sort(),
        lastMessage: 'Swipe or tap any message to quote reply.',
        updatedAtMs: Date.now() - 120000,
      },
      [pairArjun]: {
        id: pairArjun,
        participants: [me.uid, arjun.uid].sort(),
        lastMessage: 'Dinner poll is live!',
        updatedAtMs: Date.now() - 360000,
      },
    });
    setGroups([
      {
        id: 'grp_family_demo',
        name: 'Home Base',
        members: [me.uid, maya.uid, arjun.uid],
        admins: [me.uid],
        familyMode: true,
        familyChecklist: [
          { id: 'c1', text: 'Oat milk & espresso beans', done: false },
          { id: 'c2', text: 'Pick up parcel at reception', done: true },
        ],
        familyNote: 'Gate code updated to 4820# for the weekend.',
        permissions: {
          onlyAdminsEditInfo: false,
          onlyAdminsSendMessages: false,
          onlyAdminsAddMembers: false,
        },
        lastMessage: 'Checklist updated',
        updatedAtMs: Date.now() - 60000,
      },
    ]);
    setDemoMessagesByChat({
      [pairMaya]: [
        {
          id: 'dm1',
          type: 'text',
          senderUid: maya.uid,
          senderUsername: maya.usernameLower,
          senderNickname: maya.nickname,
          text: 'Welcome to Voliud Messages. Everything is pure monochrome 3D spatial.',
          createdAtMs: Date.now() - 180000,
        },
        {
          id: 'dm2',
          type: 'text',
          senderUid: me.uid,
          senderUsername: me.usernameLower,
          senderNickname: me.nickname,
          text: 'Swipe or tap any message to quote reply.',
          createdAtMs: Date.now() - 120000,
        },
      ],
      [pairArjun]: [
        {
          id: 'da1',
          type: 'poll',
          senderUid: arjun.uid,
          senderUsername: arjun.usernameLower,
          senderNickname: arjun.nickname,
          text: 'Dinner tonight?',
          poll: {
            question: 'Dinner tonight?',
            options: [
              { id: 'o1', text: 'Homemade Ramen', votes: [arjun.uid] },
              { id: 'o2', text: 'Wood-fired Pizza', votes: [] },
            ],
          },
          createdAtMs: Date.now() - 360000,
        },
      ],
      grp_family_demo: [
        {
          id: 'gf1',
          type: 'text',
          senderUid: maya.uid,
          senderUsername: maya.usernameLower,
          senderNickname: maya.nickname,
          text: 'Added groceries to the pinned Family Hub checklist above!',
          createdAtMs: Date.now() - 60000,
        },
      ],
    });
  };

  // ---------------------------------------------------------------------------
  // Render Shell
  // ---------------------------------------------------------------------------
  const activeGroup = useMemo(
    () => (activeChat?.type === 'group' ? groups.find((g) => g.id === activeChat.id) : null),
    [activeChat, groups]
  );

  const activePeer = useMemo(
    () => (activeChat?.type === 'direct' ? userProfilesMap[activeChat.peerUid] || acceptedContacts.find((c) => c.uid === activeChat.peerUid) : null),
    [activeChat, userProfilesMap, acceptedContacts]
  );

  const renderContent = () => {
    if (!authReady || profileLoading) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">
            Voliud Initializing
          </span>
        </div>
      );
    }

    if (!authUser && !demoMode) {
      return (
        <LoginScreen
          onGoogleSignIn={handleGoogleSignIn}
          loading={authLoading}
          error={authError}
          onEnterDemo={!isFirebaseConfigured ? enterDemoMode : undefined}
        />
      );
    }

    if (!myProfile || !myProfile.usernameLower) {
      return (
        <OnboardingCard
          initialNickname={authUser?.displayName || myProfile?.displayName || ''}
          allowNewSignups={appState.allowNewSignups}
          onComplete={handleCompleteOnboarding}
          loading={authLoading}
          error={onboardError}
          onSignOut={handleSignOut}
        />
      );
    }

    if (activeChat) {
      return (
        <ChatRoom
          chatType={activeChat.type}
          peer={activePeer}
          group={activeGroup}
          myProfile={myProfile}
          messages={messages}
          typingUsers={typingUsers}
          allowVideoCalls={appState.allowVideoCalls}
          rateLimitNotice={rateLimitNotice}
          onBack={() => setActiveChat(null)}
          onOpenGroupInfo={() => setGroupInfoOpen(true)}
          onSendMessage={handleSendMessage}
          onSendCallInvite={handleSendCallInvite}
          onRespondCall={handleRespondCall}
          onSendPoll={handleSendPoll}
          onVotePoll={handleVotePoll}
          onTypingChange={handleTypingChange}
          onUpdateFamilyData={handleUpdateFamilyData}
          onReportContact={handleReportContact}
        />
      );
    }

    // Combined sorted feed of direct contacts & groups
    const filteredContacts = acceptedContacts;
    const filteredGroups = groups;

    return (
      <div className="flex h-full w-full flex-col bg-black">
        {/* Top Spatial Header */}
        <header className="shrink-0 border-b border-white/14 bg-[#080808]/95 px-4 pt-4 pb-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-[#121212] shadow-spatial-card">
                <svg viewBox="0 0 100 100" className="h-5 w-5" fill="none">
                  <path d="M16 20L50 84L84 20H67L50 54L33 20H16Z" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-base font-semibold tracking-tight text-white">
                    Voliud
                  </h1>
                  {myProfile.badge && (
                    <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white">
                      {myProfile.badge}
                    </span>
                  )}
                  {demoMode && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/75">
                      Preview
                    </span>
                  )}
                </div>
                <p className="truncate font-mono text-[11px] text-white/45">
                  @{myProfile.usernameLower}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isVerifiedAdmin && (
                <button
                  type="button"
                  onClick={openOwnerConsole}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white text-black shadow-spatial-white transition hover:bg-white/90"
                  title="Owner / Admin Control Panel"
                  aria-label="Open Owner / Admin Control Panel"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setNewGroupOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-[#141414] text-white/80 hover:border-white/40 hover:text-white transition"
                title="New Group"
                aria-label="New Group"
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-[#141414] text-white/80 hover:border-white/40 hover:text-white transition"
                title="Contact Requests"
                aria-label="Contact Requests"
              >
                <Bell className="h-4 w-4" />
                {incomingRequests.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 font-mono text-[10px] font-bold text-black shadow-spatial-white">
                    {incomingRequests.length}
                  </span>
                )}
              </button>

              <AvatarRing3D
                src={myProfile.photoURL}
                name={myProfile.nickname}
                status={myProfile.status || 'Online'}
                size={36}
                onClick={() => setProfileOpen(true)}
              />
            </div>
          </div>

          {/* Email or @username Search Bar */}
          <form onSubmit={handleSearch} className="mt-3.5 relative">
            <div className="flex items-center rounded-2xl border border-white/16 bg-[#121212] px-3.5 py-2.5 focus-within:border-white transition">
              <Search className="mr-2.5 h-4 w-4 shrink-0 text-white/45" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setContactStatusMessage('');
                  if (!e.target.value.trim()) {
                    setSearchResult(null);
                    setSearchError('');
                  }
                }}
                placeholder="Search Gmail address or @username..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchResult(null);
                    setSearchError('');
                    setContactStatusMessage('');
                  }}
                  className="mr-1.5 text-white/40 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={searching || !searchInput.trim()}
                className="shrink-0 rounded-xl bg-white px-3 py-1 text-[11px] font-semibold text-black transition disabled:opacity-35"
              >
                {searching ? '...' : 'Find'}
              </button>
            </div>
          </form>

          {/* Inline Floating 3D Profile Preview Card directly beneath search input */}
          {searchError && (
            <div className="mt-3 rounded-2xl border border-white/16 bg-[#121212] px-4 py-3 text-xs text-white/80">
              {searchError}
            </div>
          )}

          {searchResult && (() => {
            const currentUid = String(authUser?.uid || myProfile?.uid || '');
            const targetUid = String(searchResult.uid || searchResult.id || '');
            return (
              <div className="mt-3">
                <ContactPreviewCard
                  user={searchResult}
                  relationship={getRelationship(targetUid)}
                  loading={Boolean(targetUid) && busyActionId === getPairId(currentUid, targetUid)}
                  statusMessage={contactStatusMessage}
                  onAddContact={handleAddContact}
                  onAcceptRequest={handleAcceptRequest}
                  onOpenChat={openDirectChat}
                  onClose={() => {
                    setSearchResult(null);
                    setContactStatusMessage('');
                  }}
                />
              </div>
            );
          })()}

          {/* Filter Tabs */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/12 bg-[#0D0D0D] p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'direct', label: `Contacts (${filteredContacts.length})` },
              { id: 'groups', label: `Groups (${filteredGroups.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-xl py-1.5 text-[11px] font-semibold transition ${
                  activeTab === t.id
                    ? 'bg-white text-black shadow-spatial-white'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* Scrollable Chats & Contacts List */}
        <main className="scene-3d flex-1 overflow-y-auto mono-scroll px-4 py-4 space-y-3">
          {/* Active 24h Note Chip */}
          {myProfile.statusNote && myProfile.statusExpiresAt > Date.now() && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/14 bg-[#0D0D0D] px-3.5 py-2.5 text-left hover:border-white/30 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-white/70" />
                <span className="truncate text-xs text-white/80">
                  Your 24h note: “{myProfile.statusNote}”
                </span>
              </div>
              <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-white/40">
                Edit
              </span>
            </button>
          )}

          {/* Groups Section */}
          {(activeTab === 'all' || activeTab === 'groups') &&
            filteredGroups.map((g) => (
              <Tilt3DCard
                key={g.id}
                intensity={4}
                onClick={() => setActiveChat({ type: 'group', id: g.id })}
                className="cursor-pointer rounded-2xl border border-white/14 bg-[#0D0D0D] p-3.5 shadow-spatial-card hover:border-white/30 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-[#161616] text-white">
                      {g.familyMode ? <Home className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {g.name}
                        </span>
                        {g.familyMode && (
                          <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                            Family
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-white/50">
                        {g.lastMessage || `${(g.members || []).length} members`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-white/35">
                    {(g.members || []).length}p
                  </span>
                </div>
              </Tilt3DCard>
            ))}

          {/* Direct Mutual Contacts Section */}
          {(activeTab === 'all' || activeTab === 'direct') &&
            filteredContacts.map((contact) => {
              const pairId = getPairId(myProfile.uid, contact.uid);
              const chatDoc = directChatsMap[pairId];
              const hasNote =
                contact.statusNote &&
                contact.statusExpiresAt &&
                contact.statusExpiresAt > Date.now();

              return (
                <Tilt3DCard
                  key={contact.uid}
                  intensity={4}
                  onClick={() => openDirectChat(contact)}
                  className="cursor-pointer rounded-2xl border border-white/14 bg-[#0D0D0D] p-3.5 shadow-spatial-card hover:border-white/30 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarRing3D
                        src={contact.photoURL}
                        name={contact.nickname || contact.displayName || contact.usernameLower || contact.email}
                        status={contact.status || 'Online'}
                        size={42}
                        animated={false}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-white">
                            {contact.nickname || contact.displayName || (contact.usernameLower ? `@${contact.usernameLower}` : contact.email)}
                          </span>
                          {contact.badge && (
                            <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wider text-white">
                              {contact.badge}
                            </span>
                          )}
                          <span className="truncate font-mono text-[11px] text-white/40">
                            {contact.usernameLower ? `@${contact.usernameLower}` : contact.email || ''}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-white/55">
                          {chatDoc?.lastMessage
                            ? chatDoc.lastMessage
                            : hasNote
                            ? `“${contact.statusNote}”`
                            : contact.status || 'Online'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusDot status={contact.status || 'Online'} />
                    </div>
                  </div>
                </Tilt3DCard>
              );
            })}

          {filteredContacts.length === 0 && filteredGroups.length === 0 && (
            <Tilt3DCard
              intensity={4}
              className="mt-4 rounded-3xl border border-white/14 bg-[#0D0D0D] p-6 text-center shadow-spatial-card"
            >
              <MessageSquare className="mx-auto h-7 w-7 text-white/50" />
              <h3 className="mt-3 text-sm font-semibold text-white">
                No Mutual Contacts Yet
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                Search an exact <span className="font-mono text-white/80">@username</span> above or open your Profile Studio to copy &amp; share your 1-tap QR invite card.
              </p>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="mt-4 rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-black shadow-spatial-white"
              >
                Open QR Invite Pass
              </button>
            </Tilt3DCard>
          )}
        </main>
      </div>
    );
  };

  const isProtectedSessionReady =
    authReady && !profileLoading && Boolean(authUser || demoMode) && Boolean(myProfile);
  const isVerifiedAdmin = isProtectedSessionReady && adminVerified && isOwnerAdmin;

  const currentAnnouncementId =
    appState.announcement?.id ||
    (appState.announcement?.text?.trim() ? `ann_${appState.announcement.text.trim()}` : '');

  const showGlobalBanner =
    Boolean(appState.announcement?.active) &&
    Boolean(appState.announcement?.text?.trim()) &&
    dismissedBannerId !== currentAnnouncementId;

  const handleDismissAnnouncementBanner = () => {
    if (!currentAnnouncementId) return;
    setDismissedBannerId(currentAnnouncementId);
    try {
      window.localStorage.setItem('voliud_dismissed_announcement_id', currentAnnouncementId);
    } catch {
      // Ignore storage quota / private-mode restrictions
    }
  };

  const filteredDirectory = ownerDirectory.filter((u) => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.usernameLower || '').toLowerCase().includes(q) ||
      (u.nickname || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.uid || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-[100dvh] w-full bg-black flex justify-center">
      <div className="relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-black sm:border-x sm:border-white/14 sm:shadow-[0_0_90px_rgba(255,255,255,0.05)]">
        {/* Visible Global Firebase / Action Error Alert (always above modals) */}
        {appError && (
          <div
            role="alert"
            className="fixed top-2 left-1/2 z-[70] flex w-[calc(100%-1.5rem)] max-w-[456px] -translate-x-1/2 items-start justify-between gap-2.5 rounded-2xl border border-white/40 bg-[#181818]/95 px-3.5 py-2.5 text-white shadow-spatial-card backdrop-blur-md"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
              <p className="font-mono text-[11px] leading-snug break-words">{appError}</p>
            </div>
            <button
              type="button"
              onClick={() => setAppError('')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black text-white/75 hover:text-white transition"
              aria-label="Dismiss error alert"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Visible Status Toast (always above modals) */}
        {appStatus && !appError && (
          <div className="fixed top-2 left-1/2 z-[70] flex w-[calc(100%-1.5rem)] max-w-[456px] -translate-x-1/2 items-center justify-between gap-2.5 rounded-2xl border border-white/30 bg-[#121212]/95 px-3.5 py-2 text-white shadow-spatial-card backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="h-3.5 w-3.5 shrink-0 text-white" />
              <p className="text-xs font-medium truncate">{appStatus}</p>
            </div>
            <button
              type="button"
              onClick={() => setAppStatus('')}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
              aria-label="Dismiss status"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Live Dismissible Global Announcement Banner (config/appState) */}
        {showGlobalBanner && (
          <div className="shrink-0 flex items-center justify-between gap-2.5 border-b border-white/25 bg-white px-3.5 py-2 text-black shadow-spatial-white z-30">
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-black" />
              <p className="text-xs font-semibold leading-snug break-words">
                {appState.announcement.text.trim()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissAnnouncementBanner}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/15 bg-black/5 text-black hover:bg-black/15 transition"
              aria-label="Dismiss announcement"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {renderContent()}
        </div>

        {/* ?add=username Auto-Popup 3D Profile Preview Card */}
        {isProtectedSessionReady && inviteModalUser && (() => {
          const currentUid = String(authUser?.uid || myProfile?.uid || '');
          const inviteUid = String(inviteModalUser.uid || inviteModalUser.id || '');
          return (
            <ContactPreviewCard
              isModal
              user={inviteModalUser}
              relationship={getRelationship(inviteUid)}
              loading={Boolean(inviteUid) && busyActionId === getPairId(currentUid, inviteUid)}
              statusMessage={contactStatusMessage}
              onAddContact={handleAddContact}
              onAcceptRequest={handleAcceptRequest}
              onOpenChat={openDirectChat}
              onClose={() => {
                setInviteModalUser(null);
                setContactStatusMessage('');
              }}
            />
          );
        })()}

        {/* Profile Studio 3D Slide-up Drawer */}
        {isProtectedSessionReady && (
          <ProfileStudioDrawer
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            profile={myProfile}
            isOwnerAdmin={isVerifiedAdmin}
            onSaveProfile={handleSaveProfile}
            onOpenOwnerConsole={openOwnerConsole}
            onSignOut={handleSignOut}
          />
        )}

        {/* Owner / Admin Console (Spark-plan friendly) */}
        {ownerConsoleOpen && isVerifiedAdmin && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md"
            onClick={() => setOwnerConsoleOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="scene-3d animate-drawer-3d w-full max-w-[480px] max-h-[92dvh] overflow-y-auto mono-scroll rounded-t-[30px] border-t border-x border-white/20 bg-[#0D0D0D] px-5 pt-4 pb-8 shadow-spatial-card"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                    <Shield className="h-3.5 w-3.5 text-white" />
                    <span>UID-Locked Telemetry</span>
                  </div>
                  <h2 className="mt-0.5 text-lg font-semibold text-white">
                    Owner / Admin Console
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadOwnerConsoleData}
                    disabled={ownerLoading}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-white/18 bg-[#161616] px-3 text-xs text-white/85 hover:border-white/40 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${ownerLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerConsoleOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/75 hover:text-white transition"
                    aria-label="Close Owner Console"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {ownerError && (
                <div
                  role="alert"
                  className="sticky top-2 z-20 mt-3 flex items-start justify-between gap-2 rounded-2xl border border-white/40 bg-[#1A1A1A] px-3.5 py-2.5 text-xs text-white shadow-spatial-card"
                >
                  <span className="font-mono text-[11px] leading-relaxed break-words">
                    {ownerError}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOwnerError('')}
                    className="shrink-0 text-white/60 hover:text-white"
                    aria-label="Clear error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {ownerNotice && !ownerError && (
                <div className="sticky top-2 z-20 mt-3 flex items-center justify-between gap-2 rounded-2xl border border-white/25 bg-white px-3.5 py-2 text-xs font-medium text-black shadow-spatial-white">
                  <span className="truncate">{ownerNotice}</span>
                  <button
                    type="button"
                    onClick={() => setOwnerNotice('')}
                    className="shrink-0 text-black/60 hover:text-black"
                    aria-label="Clear notice"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* 4. App Stats via getCountFromServer() */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Tilt3DCard
                  intensity={5}
                  className="rounded-2xl border border-white/16 bg-black p-3.5 shadow-spatial-card"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-white/55">
                    <Users className="h-3.5 w-3.5" />
                    <span>Total Users</span>
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-white">
                    {ownerLoading && ownerStats.users === null ? '...' : ownerStats.users ?? ownerDirectory.length}
                  </div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-white/35">
                    getCountFromServer()
                  </div>
                </Tilt3DCard>

                <Tilt3DCard
                  intensity={5}
                  className="rounded-2xl border border-white/16 bg-black p-3.5 shadow-spatial-card"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-white/55">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Total Groups</span>
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-white">
                    {ownerLoading && ownerStats.groups === null ? '...' : ownerStats.groups ?? '—'}
                  </div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-white/35">
                    getCountFromServer()
                  </div>
                </Tilt3DCard>
              </div>

              {/* Admin Panel Navigation Tabs */}
              <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/14 bg-black p-1">
                {[
                  { id: 'users', label: `Controls & Users (${ownerDirectory.length})` },
                  { id: 'reports', label: `Reports (${ownerReports.length})` },
                  { id: 'logs', label: `Logs (${ownerLogs.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOwnerTab(tab.id)}
                    className={`rounded-xl py-2 px-1 text-[11px] font-semibold transition ${
                      ownerTab === tab.id
                        ? 'bg-white text-black shadow-spatial-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {ownerTab === 'users' && (
                <>
                  {/* 1. Global Announcement Banner Editor (config/appState) */}
                  <form
                    onSubmit={handleSaveAnnouncement}
                    className="mt-4 rounded-2xl border border-white/16 bg-black p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-white" />
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white">
                          Global Announcement
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnnouncementActiveDraft((v) => !v)}
                        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                          announcementActiveDraft ? 'bg-white justify-end' : 'bg-white/20 justify-start'
                        }`}
                        aria-label="Toggle Global Announcement Active"
                      >
                        <span
                          className={`h-5 w-5 rounded-full transition ${
                            announcementActiveDraft ? 'bg-black' : 'bg-white/80'
                          }`}
                        />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={announcementTextDraft}
                      onChange={(e) => setAnnouncementTextDraft(e.target.value.slice(0, 180))}
                      placeholder="Broadcast a live banner to all users..."
                      className="w-full rounded-xl border border-white/16 bg-[#121212] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-white/40">
                        config/appState • {announcementActiveDraft ? 'Active' : 'Hidden'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={announcementSaving}
                          onClick={handleClearAnnouncement}
                          className="flex items-center gap-1 rounded-xl border border-white/25 bg-[#121212] px-3 py-1.5 text-xs font-medium text-white/85 hover:border-white hover:text-white transition active:scale-95 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete / Clear Active Announcement</span>
                        </button>
                        <button
                          type="submit"
                          disabled={announcementSaving}
                          className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-95 disabled:opacity-50"
                        >
                          {announcementSaving ? 'Saving...' : 'Publish Banner'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* 2. Live Feature Toggles (config/appState) */}
                  <div className="mt-4 rounded-2xl border border-white/16 bg-black p-4 space-y-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      Live Feature Toggles (config/appState)
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleAppFeature('allowNewSignups', !appState.allowNewSignups)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/14 bg-[#121212] px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2.5 pr-3">
                        <UserPlus className="h-4 w-4 text-white/80 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-white">New Sign-ups</div>
                          <div className="text-[10.5px] text-white/45">
                            Allow new users to claim @username handles
                          </div>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                          appState.allowNewSignups ? 'bg-white justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full ${
                            appState.allowNewSignups ? 'bg-black' : 'bg-white/80'
                          }`}
                        />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleAppFeature('allowVideoCalls', !appState.allowVideoCalls)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/14 bg-[#121212] px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2.5 pr-3">
                        <Video className="h-4 w-4 text-white/80 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-white">45s Video Calls</div>
                          <div className="text-[10.5px] text-white/45">
                            Enable Jitsi 45-second expiring call invites
                          </div>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                          appState.allowVideoCalls ? 'bg-white justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full ${
                            appState.allowVideoCalls ? 'bg-black' : 'bg-white/80'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* 3. Full User Directory */}
                  <div className="mt-4 rounded-2xl border border-white/16 bg-black p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        User Directory ({filteredDirectory.length})
                      </div>
                      <span className="font-mono text-[9.5px] text-white/35">
                        All Registered Users
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center rounded-xl border border-white/14 bg-[#121212] px-3 py-2">
                      <Search className="mr-2 h-3.5 w-3.5 text-white/40" />
                      <input
                        type="text"
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        placeholder="Filter users by @username, email, name, or UID..."
                        className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
                      />
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {filteredDirectory.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-[#121212] py-4 text-center text-xs text-white/45">
                          {ownerLoading ? 'Loading directory...' : 'No users matched.'}
                        </div>
                      ) : (
                        filteredDirectory.map((u) => {
                          const targetUid = String(u.uid || u.id || '');
                          const isSelf = targetUid === myProfile?.uid;
                          const isBusy = ownerActionUid === targetUid;
                          const draftVal = badgeDrafts[targetUid] ?? u.badge ?? '';
                          const isTargetAdmin = hasAdminAccess(u, OWNER_UID);
                          const currentRole =
                            u.role === 'owner' || u.role === 'superadmin' || u.role === 'admin'
                              ? u.role
                              : isTargetAdmin
                              ? 'admin'
                              : 'user';
                          const roleLabel = currentRole.toUpperCase();
                          const isConfirmingDelete = confirmDeleteUid === targetUid;

                          return (
                            <div
                              key={targetUid}
                              className="rounded-xl border border-white/14 bg-[#121212] p-3 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-white">
                                      {u.nickname || u.displayName || (u.usernameLower ? `@${u.usernameLower}` : u.email || 'User')}
                                    </span>
                                    {(u.usernameLower || u.username) && (
                                      <span className="font-mono text-[11px] text-white/55">
                                        @{String(u.usernameLower || u.username).replace(/^@+/, '')}
                                      </span>
                                    )}
                                    <span className="rounded-full border border-white/25 bg-black px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white/80">
                                      {roleLabel}
                                    </span>
                                    {u.badge && (
                                      <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white">
                                        {u.badge}
                                      </span>
                                    )}
                                    {u.isBanned && (
                                      <span className="rounded-full border border-white/40 bg-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-black">
                                        BANNED
                                      </span>
                                    )}
                                  </div>
                                  {u.email && (
                                    <div className="mt-0.5 truncate font-mono text-[10px] text-white/50">
                                      {u.email}
                                    </div>
                                  )}
                                  <div className="mt-0.5 truncate font-mono text-[10px] text-white/35">
                                    UID: {targetUid}
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                  <select
                                    aria-label={`Change role for ${u.usernameLower || targetUid}`}
                                    disabled={isBusy}
                                    value={currentRole}
                                    onChange={(e) => handleUpdateUserRole(u, e.target.value)}
                                    className="rounded-lg border border-white/25 bg-black px-2 py-1.5 font-mono text-[10.5px] font-semibold text-white focus:border-white focus:outline-none disabled:opacity-40"
                                  >
                                    <option value="user" disabled={isSelf && isTargetAdmin}>
                                      user
                                    </option>
                                    <option value="admin">admin</option>
                                    <option value="superadmin">superadmin</option>
                                    <option value="owner">owner</option>
                                  </select>

                                  <button
                                    type="button"
                                    disabled={isSelf || isBusy}
                                    onClick={() => handleToggleBan(u)}
                                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold transition disabled:opacity-35 ${
                                      u.isBanned
                                        ? 'border-white bg-white text-black'
                                        : 'border-white/25 bg-black text-white hover:bg-white hover:text-black'
                                    }`}
                                    title={isSelf ? 'Cannot ban yourself' : u.isBanned ? 'Unban user' : 'Ban user'}
                                  >
                                    <Ban className="h-3 w-3" />
                                    <span>{u.isBanned ? 'Unban' : 'Ban'}</span>
                                  </button>

                                  {!isSelf && (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => {
                                        if (isConfirmingDelete) {
                                          handleDeleteUser(u);
                                        } else {
                                          setConfirmDeleteUid(targetUid);
                                        }
                                      }}
                                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold transition disabled:opacity-35 ${
                                        isConfirmingDelete
                                          ? 'border-white bg-white text-black'
                                          : 'border-white/25 bg-black text-white/80 hover:border-white hover:text-white'
                                      }`}
                                      title="Delete user document"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>{isConfirmingDelete ? 'Confirm' : 'Delete'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Custom Badge Editor */}
                              <div className="flex items-center gap-1.5">
                                <div className="flex flex-1 items-center rounded-lg border border-white/14 bg-black px-2.5 py-1.5">
                                  <Tag className="mr-1.5 h-3 w-3 text-white/40 shrink-0" />
                                  <input
                                    type="text"
                                    value={draftVal}
                                    onChange={(e) =>
                                      setBadgeDrafts((prev) => ({
                                        ...prev,
                                        [targetUid]: e.target.value.slice(0, 16),
                                      }))
                                    }
                                    placeholder="Badge (e.g. OWNER, FAMILY)"
                                    className="w-full bg-transparent font-mono text-[11px] text-white placeholder:text-white/25 focus:outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleAssignBadge(targetUid, draftVal)}
                                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-black transition active:scale-95 disabled:opacity-40"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Set</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {['OWNER', 'FAMILY', 'VIP', ''].map((preset) => (
                                  <button
                                    key={preset || 'clear'}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setBadgeDrafts((prev) => ({ ...prev, [targetUid]: preset }));
                                      handleAssignBadge(targetUid, preset);
                                    }}
                                    className="rounded-md border border-white/14 bg-black px-2 py-0.5 font-mono text-[9.5px] text-white/65 hover:border-white/40 hover:text-white transition"
                                  >
                                    {preset || 'Clear'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {ownerHasMore && (
                      <button
                        type="button"
                        disabled={ownerLoading}
                        onClick={loadMoreDirectoryUsers}
                        className="mt-3 w-full rounded-xl border border-white/18 bg-[#121212] py-2 text-xs font-medium text-white hover:border-white/40 transition disabled:opacity-45"
                      >
                        {ownerLoading ? 'Loading...' : 'Load Next 25 Users'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Dedicated Real-Time Reports Tab */}
              {ownerTab === 'reports' && (
                <div className="mt-4 rounded-2xl border border-white/16 bg-black p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                        User Reports ({ownerReports.length}) • Live
                      </span>
                    </div>
                  </div>

                  {ownerReports.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#121212] py-6 text-center text-xs text-white/45">
                      No user reports submitted yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {ownerReports.map((rep) => {
                        const reporterLabel =
                          rep.reporterName ||
                          (rep.reporterUsername ? `@${rep.reporterUsername}` : rep.reporterId || rep.reporterUid || 'Unknown');
                        const reportedLabel =
                          rep.reportedUserName ||
                          (rep.reportedUsername ? `@${rep.reportedUsername}` : rep.reportedUserId || rep.reportedUid || 'Unknown');
                        const reportedUid = String(rep.reportedUserId || rep.reportedUid || '');
                        const tsMs = getMillis(rep.createdAt, rep.createdAtMs);
                        const isResolved = rep.status === 'resolved';

                        return (
                          <div
                            key={rep.id}
                            className="rounded-xl border border-white/14 bg-[#121212] p-3 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-white">
                                  {rep.reason || 'Report'}
                                </div>
                                <div className="mt-0.5 text-[11px] text-white/70">
                                  <span className="text-white/45">From:</span>{' '}
                                  <span className="font-medium text-white">{reporterLabel}</span>
                                  {rep.reporterUsername && (
                                    <span className="ml-1 font-mono text-[10px] text-white/50">
                                      @{rep.reporterUsername}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-white/70">
                                  <span className="text-white/45">Reported:</span>{' '}
                                  <span className="font-medium text-red-300">{reportedLabel}</span>
                                  {rep.reportedUsername && (
                                    <span className="ml-1 font-mono text-[10px] text-white/50">
                                      @{rep.reportedUsername}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase ${
                                  isResolved
                                    ? 'border-white/25 bg-white text-black font-bold'
                                    : 'border-red-400/40 bg-red-500/15 text-red-200'
                                }`}
                              >
                                {rep.status || 'open'}
                              </span>
                            </div>

                            {rep.details && (
                              <p className="rounded-lg border border-white/10 bg-black/60 px-2.5 py-2 text-[11px] text-white/75 break-words">
                                {rep.details}
                              </p>
                            )}

                            <div className="font-mono text-[9.5px] text-white/40">
                              {tsMs ? new Date(tsMs).toLocaleString() : 'Just now'}
                              {reportedUid ? ` • Target UID: ${reportedUid}` : ''}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {!isResolved && (
                                <button
                                  type="button"
                                  onClick={() => handleResolveReport(rep.id, 'resolved')}
                                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-black transition active:scale-95"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Mark Resolved</span>
                                </button>
                              )}

                              {reportedUid && reportedUid !== myProfile?.uid && (
                                <button
                                  type="button"
                                  disabled={ownerActionUid === reportedUid}
                                  onClick={() => handleBanReportedUser(rep)}
                                  className="flex items-center gap-1 rounded-lg border border-red-500/50 bg-red-600 px-2.5 py-1.5 text-[10.5px] font-semibold text-white hover:bg-red-500 transition disabled:opacity-45"
                                >
                                  <Ban className="h-3 w-3" />
                                  <span>Ban Reported User</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteReport(rep.id)}
                                className="flex items-center gap-1 rounded-lg border border-white/20 bg-black px-2.5 py-1.5 text-[10.5px] font-medium text-white/80 hover:border-white hover:text-white transition"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Delete Report</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Audit Logs Tab */}
              {ownerTab === 'logs' && (
                <div className="mt-4 rounded-2xl border border-white/16 bg-black p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-white" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                        Recent Admin Audit Logs ({ownerLogs.length})
                      </span>
                    </div>
                    {ownerLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAdminLogs}
                        className="flex items-center gap-1 rounded-lg border border-white/20 bg-[#121212] px-2.5 py-1 text-[10px] font-medium text-white/80 hover:border-white hover:text-white transition"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear Logs</span>
                      </button>
                    )}
                  </div>
                  {ownerLogs.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#121212] py-4 text-center text-[11px] text-white/40">
                      No audit logs recorded yet.
                    </div>
                  ) : (
                    ownerLogs.slice(0, 25).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-white/12 bg-[#121212] px-3 py-2 font-mono text-[10.5px] text-white/75"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{log.action}</span>
                          <span className="text-[9.5px] text-white/40">
                            {log.createdAt ? new Date(getMillis(log.createdAt)).toLocaleString() : 'pending'}
                          </span>
                        </div>
                        {(log.targetUid || log.details) && (
                          <div className="mt-0.5 truncate text-[10px] text-white/55">
                            {log.targetUid ? `${log.targetUid} • ` : ''}
                            {log.details || ''}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Dark-Themed Popup Modal (replaces browser native alert) */}
        {modalPopup && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
            onClick={() => {
              if (modalPopup.tone !== 'loading') setModalPopup(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="animate-card-3d-in w-full max-w-[380px] rounded-3xl border border-white/25 bg-[#0D0D0D] p-5 shadow-spatial-card"
            >
              <div className="flex items-center gap-2.5">
                {modalPopup.tone === 'loading' ? (
                  <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-white" />
                ) : modalPopup.tone === 'error' ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                ) : modalPopup.tone === 'success' ? (
                  <Check className="h-5 w-5 shrink-0 text-white" />
                ) : (
                  <Bell className="h-5 w-5 shrink-0 text-white" />
                )}
                <h3 className="text-base font-semibold text-white">{modalPopup.title}</h3>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-white/80 break-words">
                {modalPopup.message}
              </p>

              {modalPopup.tone !== 'loading' && (
                <button
                  type="button"
                  onClick={() => setModalPopup(null)}
                  className="mt-5 w-full rounded-2xl bg-white py-2.5 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98]"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notification Bell Drawer */}
        {isProtectedSessionReady && (
          <NotificationsDrawer
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            onAccept={handleAcceptRequest}
            onDecline={handleDeclineRequest}
            onCancelOutgoing={handleCancelOutgoing}
            busyPairId={busyActionId}
          />
        )}

        {/* New Group Modal */}
        {isProtectedSessionReady && (
          <NewGroupModal
            open={newGroupOpen}
            onClose={() => setNewGroupOpen(false)}
            contacts={acceptedContacts}
            onCreateGroup={handleCreateGroup}
          />
        )}

        {/* Group Info Drawer */}
        {isProtectedSessionReady && (
          <GroupInfoDrawer
            open={groupInfoOpen}
            onClose={() => setGroupInfoOpen(false)}
            group={activeGroup}
            myUid={myProfile?.uid}
            memberProfiles={userProfilesMap}
            acceptedContacts={acceptedContacts}
            onUpdateGroupName={handleUpdateGroupName}
            onTogglePermission={handleTogglePermission}
            onAddMember={handleAddGroupMember}
            onPromoteAdmin={handlePromoteAdmin}
            onExitGroup={handleExitGroup}
          />
        )}
      </div>
    </div>
  );
}
