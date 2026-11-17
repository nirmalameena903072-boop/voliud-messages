import React, { useEffect, useState } from 'react';
import {
  Check,
  Crown,
  Home,
  Lock,
  LogOut,
  Plus,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { AvatarRing3D, Tilt3DCard } from './Spatial3D';

export function NewGroupModal({ open, onClose, contacts, onCreateGroup }) {
  const [name, setName] = useState('');
  const [selectedUids, setSelectedUids] = useState([]);
  const [familyMode, setFamilyMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setSelectedUids([]);
      setFamilyMode(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const toggleContact = (uid) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a group name.');
      return;
    }
    if (selectedUids.length === 0) {
      setError('Select at least 1 accepted contact.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await onCreateGroup({
        name: name.trim(),
        memberUids: selectedUids,
        familyMode,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px]">
        <Tilt3DCard
          intensity={5}
          className="animate-card-3d-in max-h-[88dvh] overflow-y-auto mono-scroll rounded-[28px] border border-white/20 bg-[#0D0D0D] p-5 shadow-spatial-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white" />
              <h2 className="text-base font-semibold text-white">New Group</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/75">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="e.g. Home Base / Study Squad"
                className="mt-1.5 w-full rounded-2xl border border-white/15 bg-black px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-white focus:outline-none"
              />
            </div>

            {/* Family Mode Toggle */}
            <button
              type="button"
              onClick={() => setFamilyMode((v) => !v)}
              className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                familyMode
                  ? 'border-white bg-white text-black shadow-spatial-white'
                  : 'border-white/16 bg-[#161616] text-white hover:border-white/35'
              }`}
            >
              <div className="flex items-center gap-3 pr-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    familyMode
                      ? 'border-black/15 bg-black text-white'
                      : 'border-white/15 bg-black text-white'
                  }`}
                >
                  <Home className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Family Mode</div>
                  <div
                    className={`text-[11px] ${
                      familyMode ? 'text-black/65' : 'text-white/50'
                    }`}
                  >
                    Pins live Shared Grocery/Task Checklist &amp; Important Notes bar
                  </div>
                </div>
              </div>
              <div
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                  familyMode ? 'bg-black justify-end' : 'bg-white/20 justify-start'
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </div>
            </button>

            {/* Accepted Contacts List */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/75">
                  Select Accepted Contacts
                </span>
                <span className="font-mono text-[11px] text-white/45">
                  {selectedUids.length} selected
                </span>
              </div>

              {contacts.length === 0 ? (
                <div className="mt-2 rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-center text-xs text-white/45">
                  Add &amp; accept contacts first before creating a group.
                </div>
              ) : (
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto mono-scroll pr-0.5">
                  {contacts.map((c) => {
                    const selected = selectedUids.includes(c.uid);
                    return (
                      <button
                        key={c.uid}
                        type="button"
                        onClick={() => toggleContact(c.uid)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition ${
                          selected
                            ? 'border-white bg-[#1B1B1B]'
                            : 'border-white/12 bg-black/70 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarRing3D
                            src={c.photoURL}
                            name={c.nickname || c.usernameLower}
                            status={c.status}
                            size={34}
                            animated={false}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-white">
                              {c.nickname || `@${c.usernameLower}`}
                            </div>
                            <div className="truncate font-mono text-[10.5px] text-white/45">
                              @{c.usernameLower}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-white bg-white text-black'
                              : 'border-white/25 bg-transparent'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-white/25 bg-[#161616] px-3 py-2 text-xs text-white/90">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={creating || contacts.length === 0}
              className="w-full rounded-2xl bg-white py-3 text-xs font-semibold text-black shadow-spatial-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {creating ? 'Creating Group...' : 'Create Group'}
            </button>
          </form>
        </Tilt3DCard>
      </div>
    </div>
  );
}

export function GroupInfoDrawer({
  open,
  onClose,
  group,
  myUid,
  memberProfiles,
  acceptedContacts,
  onUpdateGroupName,
  onTogglePermission,
  onAddMember,
  onPromoteAdmin,
  onExitGroup,
}) {
  const [groupName, setGroupName] = useState(group?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open && group) {
      setGroupName(group.name || '');
    }
  }, [open, group]);

  if (!open || !group) return null;

  const admins = group.admins || [];
  const members = group.members || [];
  const isAdmin = admins.includes(myUid);
  const perms = group.permissions || {
    onlyAdminsEditInfo: false,
    onlyAdminsSendMessages: false,
    onlyAdminsAddMembers: false,
  };

  const canEditInfo = !perms.onlyAdminsEditInfo || isAdmin;
  const canAddMembers = !perms.onlyAdminsAddMembers || isAdmin;

  const eligibleToAdd = acceptedContacts.filter((c) => !members.includes(c.uid));

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!canEditInfo || !groupName.trim() || groupName.trim() === group.name) return;
    setSavingName(true);
    try {
      await onUpdateGroupName(group.id, groupName.trim());
    } finally {
      setSavingName(false);
    }
  };

  const handleExit = async () => {
    setExiting(true);
    try {
      await onExitGroup(group);
      onClose();
    } finally {
      setExiting(false);
    }
  };

  const permissionItems = [
    {
      key: 'onlyAdminsEditInfo',
      label: 'Only Admins Edit Info',
      desc: 'Locks group name edits to admins',
    },
    {
      key: 'onlyAdminsSendMessages',
      label: 'Only Admins Send Messages',
      desc: 'Disables message composer for non-admins',
    },
    {
      key: 'onlyAdminsAddMembers',
      label: 'Only Admins Add Members',
      desc: 'Restricts adding accepted contacts to admins',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="scene-3d animate-drawer-3d w-full max-w-[480px] max-h-[90dvh] overflow-y-auto mono-scroll rounded-t-[30px] border-t border-x border-white/18 bg-[#0D0D0D] px-5 pt-4 pb-7 shadow-spatial-card"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Group Info {group.familyMode ? '• Family Mode' : ''}
            </p>
            <h2 className="text-lg font-semibold text-white">{group.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161616] text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Group Name Edit */}
        <form onSubmit={handleSaveName} className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-white/75">Group Name</label>
            {!canEditInfo && (
              <span className="flex items-center gap-1 text-[10.5px] text-white/45">
                <Lock className="h-3 w-3" /> Admins only
              </span>
            )}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              disabled={!canEditInfo}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 40))}
              className="flex-1 rounded-2xl border border-white/15 bg-black px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none disabled:opacity-45"
            />
            {canEditInfo && (
              <button
                type="submit"
                disabled={savingName || !groupName.trim() || groupName.trim() === group.name}
                className="rounded-2xl bg-white px-4 text-xs font-semibold text-black transition disabled:opacity-35"
              >
                {savingName ? '...' : 'Save'}
              </button>
            )}
          </div>
        </form>

        {/* Admin Permission Switches */}
        <div className="mt-6">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin Permissions {isAdmin ? '' : '(View Only)'}</span>
          </div>
          <div className="mt-2 space-y-2">
            {permissionItems.map((item) => {
              const enabled = !!perms[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => onTogglePermission(group.id, item.key, !enabled)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/14 bg-[#161616] px-3.5 py-3 text-left transition disabled:opacity-60"
                >
                  <div className="pr-3">
                    <div className="text-xs font-medium text-white">{item.label}</div>
                    <div className="text-[11px] text-white/45">{item.desc}</div>
                  </div>
                  <div
                    className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                      enabled ? 'bg-white justify-end' : 'bg-white/15 justify-start'
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full transition ${
                        enabled ? 'bg-black' : 'bg-white/75'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Members List */}
        <div className="mt-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Members ({members.length})
          </div>
          <div className="mt-2 space-y-2">
            {members.map((uid) => {
              const p = memberProfiles[uid];
              const memberIsAdmin = admins.includes(uid);
              const isMe = uid === myUid;
              return (
                <div
                  key={uid}
                  className="flex items-center justify-between rounded-2xl border border-white/12 bg-black/70 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarRing3D
                      src={p?.photoURL}
                      name={p?.nickname || p?.usernameLower || 'V'}
                      status={p?.status || 'Online'}
                      size={34}
                      animated={false}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">
                        {p?.nickname || (p?.usernameLower ? `@${p.usernameLower}` : 'Member')}
                        {isMe ? ' (You)' : ''}
                      </div>
                      {p?.usernameLower && (
                        <div className="truncate font-mono text-[10.5px] text-white/45">
                          @{p.usernameLower}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {memberIsAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        <Crown className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      isAdmin && (
                        <button
                          type="button"
                          onClick={() => onPromoteAdmin(group.id, uid)}
                          className="rounded-full border border-white/18 bg-[#161616] px-2.5 py-1 text-[10px] text-white/75 hover:border-white hover:text-white transition"
                        >
                          Make Admin
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Members */}
        {canAddMembers && eligibleToAdd.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Add Accepted Contacts
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {eligibleToAdd.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => onAddMember(group.id, c.uid)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#161616] px-3 py-1.5 text-xs text-white hover:bg-white hover:text-black transition"
                >
                  <Plus className="h-3 w-3" />
                  <span>{c.nickname || `@${c.usernameLower}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Safe Exit Group */}
        <div className="mt-6 border-t border-white/12 pt-4">
          <button
            type="button"
            disabled={exiting}
            onClick={handleExit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-[#161616] py-3 text-xs font-semibold text-white hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>
              {exiting
                ? 'Exiting...'
                : members.length <= 1
                ? 'Exit & Delete Group'
                : 'Exit Group'}
            </span>
          </button>
          <p className="mt-2 text-center text-[10.5px] text-white/40">
            {members.length <= 1
              ? 'You are the last member — exiting deletes this group.'
              : isAdmin && admins.length === 1
              ? 'As sole admin, the next member will be automatically promoted.'
              : 'Removes you safely from members and admins.'}
          </p>
        </div>
      </div>
    </div>
  );
}
