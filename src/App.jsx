import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { onDisconnect, onValue, ref as rtdbRef, remove as rtdbRemove, set as rtdbSet } from 'firebase/database';
import {
  Bell,
  Home,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { OWNER_UID, auth, db, googleProvider, isFirebaseConfigured, rtdb } from './firebase';
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
  const [searching, setSearching] = useState(false);

  // Social Graph & Chats
  const [contactRequests, setContactRequests] = useState([]);
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

  // Demo sandbox data store
  const [demoMessagesByChat, setDemoMessagesByChat] = useState({});
  const typingTimerRef = useRef(null);

  // ---------------------------------------------------------------------------
  // 1. Firebase Auth Listener & Redirect Handling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    getRedirectResult(auth).catch((err) => {
      if (err?.message) setAuthError(err.message);
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setMyProfile(null);
        setIsOwnerAdmin(false);
        setActiveChat(null);
      }
    });

    return () => unsub();
  }, []);

  // Subscribe to myProfile & check admins/{uid}
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !authUser) return;

    setProfileLoading(true);
    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubUser = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          setMyProfile({ uid: snap.id, ...snap.data() });
        } else {
          setMyProfile(null);
        }
        setProfileLoading(false);
      },
      () => {
        setProfileLoading(false);
      }
    );

    const matchesOwnerUid = Boolean(OWNER_UID && authUser.uid === OWNER_UID);
    if (matchesOwnerUid) {
      setIsOwnerAdmin(true);
    }

    const adminRef = doc(db, 'admins', authUser.uid);
    getDoc(adminRef)
      .then((snap) => setIsOwnerAdmin(matchesOwnerUid || snap.exists()))
      .catch(() => setIsOwnerAdmin(matchesOwnerUid));

    return () => unsubUser();
  }, [authUser]);

  // ---------------------------------------------------------------------------
  // 2. Social Graph Listeners (Contact Requests, Direct Chats, Groups)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !myProfile) return;

    const reqQuery = query(
      collection(db, 'contactRequests'),
      where('participants', 'array-contains', myProfile.uid)
    );
    const unsubReqs = onSnapshot(reqQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setContactRequests(list);
    });

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', myProfile.uid)
    );
    const unsubChats = onSnapshot(chatsQuery, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setDirectChatsMap(map);
    });

    const groupsQuery = query(
      collection(db, 'groups'),
      where('members', 'array-contains', myProfile.uid)
    );
    const unsubGroups = onSnapshot(groupsQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || a.updatedAtMs || 0;
        const tb = b.updatedAt?.toMillis?.() || b.updatedAtMs || 0;
        return tb - ta;
      });
      setGroups(list);
    });

    return () => {
      unsubReqs();
      unsubChats();
      unsubGroups();
    };
  }, [myProfile?.uid]);

  // Keep live user profiles synced for accepted contacts + group members
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !myProfile) return;

    const uidsToWatch = new Set([myProfile.uid]);
    contactRequests.forEach((r) => {
      if (r.status === 'accepted') {
        (r.participants || []).forEach((id) => uidsToWatch.add(id));
      }
    });
    groups.forEach((g) => {
      (g.members || []).forEach((id) => uidsToWatch.add(id));
    });

    const unsubs = [];
    uidsToWatch.forEach((uid) => {
      const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          setUserProfilesMap((prev) => ({ ...prev, [uid]: { uid: snap.id, ...snap.data() } }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [myProfile?.uid, contactRequests, groups]);

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

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => {
          const data = d.data();
          const createdAtMs =
            data.createdAt?.toMillis?.() || data.createdAtMs || Date.now();
          return { id: d.id, ...data, createdAtMs };
        })
        .reverse();
      setMessages(docs);
    });

    return () => unsub();
  }, [activeChat?.id, activeChat?.type, demoMode, demoMessagesByChat]);

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
    const unsub = onValue(chatTypingRef, (snap) => {
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
    });

    const myTypingRef = rtdbRef(rtdb, `typing/${activeChat.id}/${myProfile.uid}`);
    onDisconnect(myTypingRef).remove();

    return () => {
      unsub();
      clearTimeout(typingTimerRef.current);
      rtdbRemove(myTypingRef).catch(() => {});
    };
  }, [activeChat?.id, myProfile?.uid, demoMode]);

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
      if (!unameSnap.exists()) return null;
      const unameData = unameSnap.data();
      const userSnap = await getDoc(doc(db, 'users', unameData.uid));
      if (userSnap.exists()) {
        return { uid: userSnap.id, ...userSnap.data() };
      }
      return {
        uid: unameData.uid,
        usernameLower: unameData.usernameLower,
        nickname: unameData.nickname || `@${unameData.usernameLower}`,
        photoURL: unameData.photoURL || '',
        status: unameData.status || 'Online',
      };
    },
    [demoMode, userProfilesMap]
  );

  useEffect(() => {
    if (!pendingAddUsername || !myProfile) return;

    let cancelled = false;
    lookupUserByHandle(pendingAddUsername).then((found) => {
      if (cancelled) return;
      if (found) {
        setInviteModalUser(found);
      }
      setPendingAddUsername('');
      if (window.location.search.includes('add=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pendingAddUsername, myProfile, lookupUserByHandle]);

  // ---------------------------------------------------------------------------
  // Derived Lists
  // ---------------------------------------------------------------------------
  const incomingRequests = useMemo(
    () => contactRequests.filter((r) => r.status === 'pending' && r.toUid === myProfile?.uid),
    [contactRequests, myProfile?.uid]
  );

  const outgoingRequests = useMemo(
    () => contactRequests.filter((r) => r.status === 'pending' && r.fromUid === myProfile?.uid),
    [contactRequests, myProfile?.uid]
  );

  const acceptedContacts = useMemo(() => {
    if (!myProfile) return [];
    return contactRequests
      .filter((r) => r.status === 'accepted')
      .map((r) => {
        const peerUid = (r.participants || []).find((id) => id !== myProfile.uid);
        const liveProfile = userProfilesMap[peerUid];
        if (liveProfile) return liveProfile;
        const isPeerFrom = r.fromUid === peerUid;
        return {
          uid: peerUid,
          usernameLower: isPeerFrom ? r.fromUsername : r.toUsername,
          nickname: isPeerFrom ? r.fromNickname : r.toNickname,
          photoURL: isPeerFrom ? r.fromPhotoURL : r.toPhotoURL,
          status: 'Online',
        };
      })
      .filter((c) => c.uid);
  }, [contactRequests, myProfile, userProfilesMap]);

  const getRelationship = useCallback(
    (targetUid) => {
      if (!myProfile || !targetUid) return 'none';
      if (targetUid === myProfile.uid) return 'self';
      const pairId = getPairId(myProfile.uid, targetUid);
      const req = contactRequests.find((r) => r.id === pairId);
      if (!req) return 'none';
      if (req.status === 'accepted') return 'accepted';
      if (req.status === 'pending') {
        return req.fromUid === myProfile.uid ? 'outgoing' : 'incoming';
      }
      return 'none';
    },
    [myProfile, contactRequests]
  );

  // ---------------------------------------------------------------------------
  // Handlers: Auth & Onboarding
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = err?.code || '';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (
        isMobile ||
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-browser' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setAuthError(redirectErr?.message || 'Google sign-in redirect failed.');
        }
      } else if (code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Google sign-in failed.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteOnboarding = async ({ usernameLower, nickname }) => {
    setAuthLoading(true);
    setOnboardError('');
    try {
      if (demoMode) {
        const profile = {
          uid: 'demo_me',
          usernameLower,
          nickname,
          photoURL: '',
          status: 'Online',
          statusNote: '',
          statusExpiresAt: null,
        };
        setMyProfile(profile);
        setUserProfilesMap((prev) => ({ ...prev, demo_me: profile }));
        return;
      }

      if (!db || !authUser) return;

      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, 'usernames', usernameLower);
        const unameSnap = await tx.get(unameRef);
        if (unameSnap.exists()) {
          throw new Error(`@${usernameLower} is already claimed. Pick another.`);
        }

        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (userSnap.exists()) {
          throw new Error('Account profile already exists.');
        }

        const nowTs = serverTimestamp();
        tx.set(unameRef, {
          uid: authUser.uid,
          usernameLower,
          nickname,
          photoURL: authUser.photoURL || '',
          status: 'Online',
          createdAt: nowTs,
        });

        tx.set(userRef, {
          uid: authUser.uid,
          usernameLower,
          nickname,
          photoURL: authUser.photoURL || '',
          status: 'Online',
          statusNote: '',
          statusExpiresAt: null,
          createdAt: nowTs,
          updatedAt: nowTs,
        });
      });
    } catch (err) {
      setOnboardError(err?.message || 'Unable to claim @username.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
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
  };

  // ---------------------------------------------------------------------------
  // Handlers: Profile Studio & Owner Console
  // ---------------------------------------------------------------------------
  const handleSaveProfile = async (updates) => {
    if (!myProfile) return;
    if (demoMode) {
      const updated = { ...myProfile, ...updates };
      setMyProfile(updated);
      setUserProfilesMap((prev) => ({ ...prev, [myProfile.uid]: updated }));
      return;
    }

    await updateDoc(doc(db, 'users', myProfile.uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'usernames', myProfile.usernameLower), {
      nickname: updates.nickname,
      status: updates.status,
    });
  };

  const handleFetchOwnerCounts = async () => {
    if (demoMode) {
      return {
        users: Object.keys(userProfilesMap).length,
        groups: groups.length,
      };
    }
    const [uSnap, gSnap] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'groups')),
    ]);
    return {
      users: uSnap.data().count,
      groups: gSnap.data().count,
    };
  };

  // ---------------------------------------------------------------------------
  // Handlers: Search & Contact Requests
  // ---------------------------------------------------------------------------
  const handleSearch = async (e) => {
    e.preventDefault();
    const clean = normalizeHandle(searchInput);
    if (!clean) {
      setSearchResult(null);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const found = await lookupUserByHandle(clean);
      if (!found) {
        setSearchResult(null);
        setSearchError(`No Voliud user found for @${clean}`);
      } else {
        setSearchResult(found);
      }
    } catch (err) {
      setSearchError(err?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (targetUser) => {
    if (!myProfile || !targetUser || targetUser.uid === myProfile.uid) return;
    const pairId = getPairId(myProfile.uid, targetUser.uid);
    setBusyActionId(pairId);

    try {
      if (demoMode) {
        setContactRequests((prev) => [
          ...prev.filter((r) => r.id !== pairId),
          {
            id: pairId,
            participants: [myProfile.uid, targetUser.uid].sort(),
            fromUid: myProfile.uid,
            toUid: targetUser.uid,
            fromUsername: myProfile.usernameLower,
            fromNickname: myProfile.nickname,
            fromPhotoURL: myProfile.photoURL || '',
            toUsername: targetUser.usernameLower,
            toNickname: targetUser.nickname,
            toPhotoURL: targetUser.photoURL || '',
            status: 'pending',
            createdAtMs: Date.now(),
          },
        ]);
        return;
      }

      await setDoc(doc(db, 'contactRequests', pairId), {
        participants: [myProfile.uid, targetUser.uid].sort(),
        fromUid: myProfile.uid,
        toUid: targetUser.uid,
        fromUsername: myProfile.usernameLower,
        fromNickname: myProfile.nickname,
        fromPhotoURL: myProfile.photoURL || '',
        toUsername: targetUser.usernameLower,
        toNickname: targetUser.nickname || `@${targetUser.usernameLower}`,
        toPhotoURL: targetUser.photoURL || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusyActionId('');
    }
  };

  const handleAcceptRequest = async (reqOrUser) => {
    if (!myProfile) return;
    const req =
      reqOrUser.fromUid && reqOrUser.toUid
        ? reqOrUser
        : contactRequests.find((r) => r.id === getPairId(myProfile.uid, reqOrUser.uid));
    if (!req) return;

    setBusyActionId(req.id);
    try {
      if (demoMode) {
        setContactRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: 'accepted' } : r))
        );
        return;
      }

      await updateDoc(doc(db, 'contactRequests', req.id), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'chats', req.id),
        {
          participants: req.participants,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
    } finally {
      setBusyActionId('');
    }
  };

  const openDirectChat = async (peerUser) => {
    if (!myProfile || !peerUser) return;
    const chatId = getPairId(myProfile.uid, peerUser.uid);
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
    setInviteModalUser(null);
    setActiveChat({ type: 'direct', id: chatId, peerUid: peerUser.uid });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Messaging, Typing, Calls, Polls, Groups
  // ---------------------------------------------------------------------------
  const sendMessagePayload = async (payload) => {
    if (!activeChat || !myProfile) return;

    const baseMsg = {
      senderUid: myProfile.uid,
      senderUsername: myProfile.usernameLower,
      senderNickname: myProfile.nickname,
      createdAtMs: Date.now(),
      ...payload,
    };

    const previewText =
      payload.type === 'call_invite'
        ? 'Video Call Invite'
        : payload.type === 'poll'
        ? `Poll: ${payload.poll?.question || ''}`
        : payload.text;

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
            lastMessage: previewText,
            updatedAtMs: Date.now(),
          },
        }));
      } else {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === activeChat.id ? { ...g, lastMessage: previewText, updatedAtMs: Date.now() } : g
          )
        );
      }
      return;
    }

    const colName = activeChat.type === 'group' ? 'groups' : 'chats';
    await addDoc(collection(db, colName, activeChat.id, 'messages'), {
      ...baseMsg,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, colName, activeChat.id),
      {
        lastMessage: previewText,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSendMessage = async (text, replyTo) => {
    await sendMessagePayload({
      type: 'text',
      text,
      ...(replyTo ? { replyTo } : {}),
    });
  };

  const handleSendCallInvite = async () => {
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
    const colName = activeChat.type === 'group' ? 'groups' : 'chats';
    await updateDoc(doc(db, colName, activeChat.id, 'messages', messageId), {
      'call.status': nextStatus,
    });
  };

  const handleSendPoll = async (question, optionTexts) => {
    await sendMessagePayload({
      type: 'poll',
      text: question,
      poll: {
        question,
        options: optionTexts.map((opt, idx) => ({
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
    const allMembers = Array.from(new Set([myProfile.uid, ...memberUids]));
    const newGroup = {
      name,
      members: allMembers,
      admins: [myProfile.uid],
      familyMode,
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

    const docRef = await addDoc(collection(db, 'groups'), {
      ...newGroup,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActiveChat({ type: 'group', id: docRef.id });
  };

  const handleUpdateGroupName = async (groupId, nextName) => {
    if (demoMode) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: nextName } : g)));
      return;
    }
    await updateDoc(doc(db, 'groups', groupId), {
      name: nextName,
      updatedAt: serverTimestamp(),
    });
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
    await updateDoc(doc(db, 'groups', groupId), {
      [`permissions.${key}`]: value,
      updatedAt: serverTimestamp(),
    });
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
    await updateDoc(doc(db, 'groups', groupId), {
      members: nextMembers,
      updatedAt: serverTimestamp(),
    });
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
    await updateDoc(doc(db, 'groups', groupId), {
      admins: nextAdmins,
      updatedAt: serverTimestamp(),
    });
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
      await deleteDoc(doc(db, 'groups', group.id));
      setActiveChat(null);
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

    await updateDoc(doc(db, 'groups', group.id), {
      members: remainingMembers,
      admins: remainingAdmins,
      updatedAt: serverTimestamp(),
    });
    setActiveChat(null);
  };

  const handleUpdateFamilyData = async (groupId, patch) => {
    if (demoMode) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
      return;
    }
    await updateDoc(doc(db, 'groups', groupId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
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
        <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black">
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

    if (!myProfile) {
      return (
        <OnboardingCard
          initialNickname={authUser?.displayName || ''}
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
          onBack={() => setActiveChat(null)}
          onOpenGroupInfo={() => setGroupInfoOpen(true)}
          onSendMessage={handleSendMessage}
          onSendCallInvite={handleSendCallInvite}
          onRespondCall={handleRespondCall}
          onSendPoll={handleSendPoll}
          onVotePoll={handleVotePoll}
          onTypingChange={handleTypingChange}
          onUpdateFamilyData={handleUpdateFamilyData}
        />
      );
    }

    // Combined sorted feed of direct contacts & groups
    const filteredContacts = acceptedContacts;
    const filteredGroups = groups;

    return (
      <div className="flex h-[100dvh] w-full flex-col bg-black">
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

          {/* @username Search Bar */}
          <form onSubmit={handleSearch} className="mt-3.5 relative">
            <div className="flex items-center rounded-2xl border border-white/16 bg-[#121212] px-3.5 py-2.5 focus-within:border-white transition">
              <Search className="mr-2.5 h-4 w-4 shrink-0 text-white/45" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim()) {
                    setSearchResult(null);
                    setSearchError('');
                  }
                }}
                placeholder="Search exact @username (max 12)..."
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
            <div className="mt-3 rounded-2xl border border-white/16 bg-[#121212] px-4 py-3 text-xs text-white/70">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="mt-3">
              <ContactPreviewCard
                user={searchResult}
                relationship={getRelationship(searchResult.uid)}
                loading={busyActionId === getPairId(myProfile.uid, searchResult.uid)}
                onAddContact={handleAddContact}
                onAcceptRequest={handleAcceptRequest}
                onOpenChat={openDirectChat}
                onClose={() => setSearchResult(null)}
              />
            </div>
          )}

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
                        name={contact.nickname || contact.usernameLower}
                        status={contact.status || 'Online'}
                        size={42}
                        animated={false}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {contact.nickname || `@${contact.usernameLower}`}
                          </span>
                          <span className="truncate font-mono text-[11px] text-white/40">
                            @{contact.usernameLower}
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

  return (
    <div className="min-h-[100dvh] w-full bg-black flex justify-center">
      <div className="relative h-[100dvh] w-full max-w-[480px] overflow-hidden bg-black sm:border-x sm:border-white/14 sm:shadow-[0_0_90px_rgba(255,255,255,0.05)]">
        {renderContent()}

        {/* ?add=username Auto-Popup 3D Profile Preview Card */}
        {inviteModalUser && myProfile && (
          <ContactPreviewCard
            isModal
            user={inviteModalUser}
            relationship={getRelationship(inviteModalUser.uid)}
            loading={busyActionId === getPairId(myProfile.uid, inviteModalUser.uid)}
            onAddContact={handleAddContact}
            onAcceptRequest={handleAcceptRequest}
            onOpenChat={openDirectChat}
            onClose={() => setInviteModalUser(null)}
          />
        )}

        {/* Profile Studio 3D Slide-up Drawer */}
        <ProfileStudioDrawer
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={myProfile}
          isOwnerAdmin={isOwnerAdmin}
          onSaveProfile={handleSaveProfile}
          onFetchOwnerCounts={handleFetchOwnerCounts}
          onSignOut={handleSignOut}
        />

        {/* Notification Bell Drawer */}
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

        {/* New Group Modal */}
        <NewGroupModal
          open={newGroupOpen}
          onClose={() => setNewGroupOpen(false)}
          contacts={acceptedContacts}
          onCreateGroup={handleCreateGroup}
        />

        {/* Group Info Drawer */}
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
      </div>
    </div>
  );
}
