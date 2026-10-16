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
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '440px', padding: '32px', textAlign: 'center' }}>
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <RotateCw size={36} className="spin-animation" style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Joining Project...</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Validating your invite and setting up workspace access.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <CheckCircle2 size={40} style={{ color: '#4ade80' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Joined Successfully!</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              You now have access to <strong>{projectName}</strong>. Redirecting you to the editor...
            </p>
            {projectId && (
              <button
                className="btn-submit-primary"
                onClick={() => { window.location.hash = `#/project/${projectId}`; }}
                style={{ marginTop: '8px' }}
              >
                <span>Open Project</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <AlertCircle size={40} style={{ color: '#f87171' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Invitation Error</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {errorMessage}
            </p>
            <button
              className="btn-submit-primary"
              onClick={() => { window.location.hash = '#/'; }}
              style={{ marginTop: '8px' }}
            >
              <span>Back to Projects</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
