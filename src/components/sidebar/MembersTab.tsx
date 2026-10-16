import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserPlus, 
  UserMinus, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  Trash2, 
  RotateCw, 
  AlertCircle,
  WifiOff,
  Clock
} from 'lucide-react';
import { useAppSelector } from '../../store';
import { membersApi, invitesApi } from '../../services';
import type { ProjectMember, ProjectInvite } from '../../core/types';

function formatExpiryDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays < 7) return `Expires in ${diffDays} days`;
    return `Expires ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return dateStr;
  }
}

function getErrorMessage(err: any): string {
  const status = err?.status;
  const msg = (err?.message || '').toLowerCase();

  if (status === 400) {
    if (msg.includes('last member')) return 'Cannot remove the last member of the project.';
    if (msg.includes('user not found')) return 'User with this email was not found.';
    if (msg.includes('email')) return 'Please enter a valid email address.';
  }
  if (status === 409) {
    return 'User is already a member of this project.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 404) {
    if (msg.includes('member')) return 'Member not found.';
    if (msg.includes('invite')) return 'Invite link not found or revoked.';
    return 'Resource not found.';
  }
  return err?.message || 'An error occurred. Please try again.';
}

export const MembersTab: React.FC = () => {
  const projectId = useAppSelector(state => state.projects.currentProjectId);
  const currentUser = useAppSelector(state => state.auth.currentUser);
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add Member state
  const [newEmail, setNewEmail] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  // Invite Links state
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Action confirmations
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const isOnline = connectionStatus === 'connected';

  const loadData = useCallback(async () => {
    if (!projectId || !isOnline) return;
    setIsLoading(true);
    setMemberError(null);
    setInviteError(null);

    try {
      const [membersData, invitesData] = await Promise.all([
        membersApi.listMembers(projectId).catch(err => {
          console.error('Failed to load members:', err);
          return null;
        }),
        invitesApi.listInvites(projectId).catch(err => {
          console.error('Failed to load invites:', err);
          return null;
        })
      ]);

      if (membersData) setMembers(membersData);
      if (invitesData) setInvites(invitesData);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, isOnline]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email || !projectId) return;

    setIsAddingMember(true);
    setMemberError(null);
    setMemberSuccess(null);

    try {
      const newMember = await membersApi.addMember(projectId, email);
      setMembers(prev => [...prev.filter(m => m.id !== newMember.id), newMember]);
      setNewEmail('');
      setMemberSuccess(`Added ${email}`);
      setTimeout(() => setMemberSuccess(null), 3000);
    } catch (err: any) {
      setMemberError(getErrorMessage(err));
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!projectId) return;

    setRemovingMemberId(memberId);
    setMemberError(null);

    try {
      await membersApi.removeMember(projectId, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setConfirmRemoveId(null);
    } catch (err: any) {
      setMemberError(getErrorMessage(err));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!projectId) return;

    setIsCreatingInvite(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const newInvite = await invitesApi.createInvite(projectId, expiresAt);
      setInvites(prev => [newInvite, ...prev]);
      setInviteSuccess('Invite link created');
      setTimeout(() => setInviteSuccess(null), 3000);
    } catch (err: any) {
      setInviteError(getErrorMessage(err));
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!projectId) return;

    setRevokingInviteId(inviteId);
    setInviteError(null);

    try {
      await invitesApi.revokeInvite(projectId, inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      setInviteError(getErrorMessage(err));
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleCopyLink = async (invite: ProjectInvite) => {
    const inviteUrl = `${window.location.origin}/#/invite/${invite.code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteId(invite.id);
      setTimeout(() => {
        setCopiedInviteId(prev => (prev === invite.id ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const isCurrentMember = (member: ProjectMember): boolean => {
    if (!currentUser) return false;
    if (currentUser.id && currentUser.id === member.id) return true;
    if (currentUser.email && currentUser.email.toLowerCase() === member.email.toLowerCase()) return true;
    return false;
  };

  if (!isOnline) {
    return (
      <div className="pane-content members-tab-content">
        <div className="pane-header">
          <span>Members</span>
        </div>
        <div className="tab-offline-banner">
          <WifiOff size={24} />
          <p className="banner-title">Offline Mode</p>
          <p className="banner-desc">
            Member management and invite links require an active server connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pane-content members-tab-content">
      <div className="pane-header">
        <span>Members & Sharing</span>
        <button 
          className="create-file-btn" 
          onClick={() => void loadData()} 
          title="Refresh"
          disabled={isLoading}
        >
          <RotateCw size={14} className={isLoading ? 'spin-animation' : ''} />
        </button>
      </div>

      {/* SECTION 1: MEMBERS */}
      <div className="members-section">
        <div className="section-title-row">
          <span className="section-title">Members</span>
          <span className="count-badge">{members.length}</span>
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="add-member-form">
          <div className="input-with-button">
            <input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              disabled={isAddingMember}
              required
            />
            <button 
              type="submit" 
              className="action-btn-primary" 
              disabled={!newEmail.trim() || isAddingMember}
              title="Add Member"
            >
              <UserPlus size={14} />
            </button>
          </div>
        </form>

        {memberError && (
          <div className="tab-message error">
            <AlertCircle size={13} />
            <span>{memberError}</span>
          </div>
        )}
        {memberSuccess && (
          <div className="tab-message success">
            <Check size={13} />
            <span>{memberSuccess}</span>
          </div>
        )}

        {/* Members List */}
        <div className="members-list">
          {members.length === 0 && !isLoading && (
            <div className="tab-empty-hint">No members found.</div>
          )}

          {members.map(member => {
            const isSelf = isCurrentMember(member);
            const isConfirming = confirmRemoveId === member.id;
            const isRemoving = removingMemberId === member.id;
            const initial = member.email ? member.email[0].toUpperCase() : '?';

            return (
              <div key={member.id} className="member-card">
                <div className="member-info">
                  <div className="member-avatar">{initial}</div>
                  <div className="member-details">
                    <span className="member-email" title={member.email}>
                      {member.email}
                    </span>
                    {isSelf && <span className="you-badge">You</span>}
                  </div>
                </div>

                <div className="member-actions">
                  {isConfirming ? (
                    <div className="inline-confirm">
                      <button
                        className="confirm-btn danger"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isRemoving}
                        title="Confirm removal"
                      >
                        Remove
                      </button>
                      <button
                        className="confirm-btn cancel"
                        onClick={() => setConfirmRemoveId(null)}
                        disabled={isRemoving}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="icon-action-btn delete-btn"
                      onClick={() => setConfirmRemoveId(member.id)}
                      disabled={isRemoving || members.length <= 1}
                      title={members.length <= 1 ? "Cannot remove last member" : "Remove member"}
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tab-divider" />

      {/* SECTION 2: INVITE LINKS */}
      <div className="invites-section">
        <div className="section-title-row">
          <span className="section-title">Invite Links</span>
          <span className="count-badge">{invites.length}</span>
        </div>

        {/* Create Invite Controls */}
        <div className="create-invite-panel">
          <div className="expiry-picker">
            <span className="expiry-label">Expires in:</span>
            <div className="expiry-pills">
              {[
                { label: '1 day', days: 1 },
                { label: '7 days', days: 7 },
                { label: '30 days', days: 30 }
              ].map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  className={`expiry-pill ${expiryDays === opt.days ? 'active' : ''}`}
                  onClick={() => setExpiryDays(opt.days)}
                  disabled={isCreatingInvite}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-create-invite"
            onClick={handleCreateInvite}
            disabled={isCreatingInvite}
          >
            <LinkIcon size={14} />
            <span>{isCreatingInvite ? 'Creating...' : 'Create Invite Link'}</span>
          </button>
        </div>

        {inviteError && (
          <div className="tab-message error">
            <AlertCircle size={13} />
            <span>{inviteError}</span>
          </div>
        )}
        {inviteSuccess && (
          <div className="tab-message success">
            <Check size={13} />
            <span>{inviteSuccess}</span>
          </div>
        )}

        {/* Invites List */}
        <div className="invites-list">
          {invites.length === 0 && !isLoading && (
            <div className="tab-empty-hint">No active invite links.</div>
          )}

          {invites.map(invite => {
            const isCopied = copiedInviteId === invite.id;
            const isRevoking = revokingInviteId === invite.id;
            const isConfirmingRevoke = confirmRevokeId === invite.id;
            const expiryText = formatExpiryDate(invite.expires_at);

            return (
              <div key={invite.id} className="invite-card">
                <div className="invite-meta">
                  <div className="invite-code-pill" title={`Click to copy: /#/invite/${invite.code}`}>
                    <span className="invite-status-dot" />
                    <span className="code-text">{invite.code.slice(0, 8)}...</span>
                  </div>
                  <div className="invite-expiry" title={invite.expires_at}>
                    <Clock size={11} />
                    <span>{expiryText}</span>
                  </div>
                </div>

                <div className="invite-actions">
                  <button
                    className={`btn-invite-action copy-btn ${isCopied ? 'copied' : ''}`}
                    onClick={() => handleCopyLink(invite)}
                    title="Copy full invite link to clipboard"
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{isCopied ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>

                  {isConfirmingRevoke ? (
                    <div className="inline-confirm">
                      <button
                        className="confirm-btn danger"
                        onClick={() => handleRevokeInvite(invite.id)}
                        disabled={isRevoking}
                        title="Confirm revocation"
                      >
                        Revoke
                      </button>
                      <button
                        className="confirm-btn cancel"
                        onClick={() => setConfirmRevokeId(null)}
                        disabled={isRevoking}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-invite-action revoke-btn"
                      onClick={() => setConfirmRevokeId(invite.id)}
                      disabled={isRevoking}
                      title="Revoke invite link"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
