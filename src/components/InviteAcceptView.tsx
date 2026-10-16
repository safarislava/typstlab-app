import React, { useEffect, useState } from 'react';
import { RotateCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { invitesApi } from '../services';

interface InviteAcceptViewProps {
  inviteCode: string;
}

export const InviteAcceptView: React.FC<InviteAcceptViewProps> = ({ inviteCode }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function accept() {
      if (!inviteCode) {
        setStatus('error');
        setErrorMessage('Invalid invite code');
        return;
      }

      try {
        const project = await invitesApi.acceptInvite(inviteCode);
        if (!isMounted) return;
        setStatus('success');
        setProjectName(project.name || 'Project');
        setProjectId(project.id);

        setTimeout(() => {
          window.location.hash = `#/project/${project.id}`;
        }, 1500);
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        const codeStatus = err?.status;
        const msg = (err?.message || '').toLowerCase();
        if (codeStatus === 410 || msg.includes('expired')) {
          setErrorMessage('This invite link has expired. Please request a new invite from the project owner.');
        } else if (codeStatus === 404 || msg.includes('not found')) {
          setErrorMessage('Invite link was not found or has already been revoked.');
        } else if (codeStatus === 401) {
          setErrorMessage('You need to be logged in to accept this invitation.');
        } else {
          setErrorMessage(err?.message || 'Failed to accept invitation. Please try again.');
        }
      }
    }

    void accept();

    return () => {
      isMounted = false;
    };
  }, [inviteCode]);

  return (
    <div className="auth-container">
      <div 
        className="invite-accept-card" 
        style={{ 
          width: '100%', 
          maxWidth: '440px', 
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          padding: '40px 32px', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          animation: 'authFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <RotateCw size={40} className="spin-animation" style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '8px 0 0 0' }}>Joining Project...</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Validating your invite and setting up workspace access.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <CheckCircle2 size={44} style={{ color: '#4ade80' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '8px 0 0 0' }}>Joined Successfully!</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              You now have access to <strong>{projectName}</strong>. Redirecting you to the editor...
            </p>
            {projectId && (
              <button
                className="auth-submit-btn"
                onClick={() => { window.location.hash = `#/project/${projectId}`; }}
                style={{ width: '100%', marginTop: '12px' }}
              >
                <span>Open Project</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                backgroundColor: 'rgba(244, 63, 94, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#f87171'
              }}
            >
              <AlertCircle size={36} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '4px 0 0 0' }}>Invitation Error</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 8px 0' }}>
              {errorMessage}
            </p>
            <button
              className="auth-submit-btn"
              onClick={() => { window.location.hash = '#/'; }}
              style={{ width: '100%' }}
            >
              <span>Back to Projects</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
