import React, { useEffect, useState } from 'react';
import { 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Link2Off, 
  FolderGit2, 
  Sparkles 
} from 'lucide-react';
import { useAppSelector } from '../store';
import { invitesApi } from '../services';

interface InviteAcceptViewProps {
  inviteCode: string;
}

export const InviteAcceptView: React.FC<InviteAcceptViewProps> = ({ inviteCode }) => {
  const currentUser = useAppSelector(state => state.auth.currentUser);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorType, setErrorType] = useState<'expired' | 'not_found' | 'unauthorized' | 'generic'>('generic');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    let isMounted = true;

    async function accept() {
      if (!inviteCode) {
        setStatus('error');
        setErrorType('not_found');
        setErrorMessage('Invite code is missing or malformed.');
        return;
      }

      try {
        const project = await invitesApi.acceptInvite(inviteCode);
        if (!isMounted) return;
        setStatus('success');
        setProjectName(project.name || 'Untitled Project');
        setProjectId(project.id);
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        const codeStatus = err?.status;
        const msg = (err?.message || '').toLowerCase();

        if (codeStatus === 410 || msg.includes('expired')) {
          setErrorType('expired');
          setErrorMessage('This invitation link has expired. Please ask the project owner to generate a fresh link.');
        } else if (codeStatus === 404 || msg.includes('not found')) {
          setErrorType('not_found');
          setErrorMessage('This invitation link was not found or has been revoked by the project owner.');
        } else if (codeStatus === 401) {
          setErrorType('unauthorized');
          setErrorMessage('You need to be logged in to accept this invitation.');
        } else {
          setErrorType('generic');
          setErrorMessage(err?.message || 'Unable to join the project. Please try again later.');
        }
      }
    }

    void accept();

    return () => {
      isMounted = false;
    };
  }, [inviteCode]);

  // Countdown timer for automatic redirect on success
  useEffect(() => {
    if (status !== 'success' || !projectId) return;

    if (countdown <= 0) {
      window.location.hash = `#/project/${projectId}`;
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, projectId, countdown]);

  return (
    <div className="auth-container">
      <div 
        className="invite-accept-card" 
        style={{ 
          width: '100%', 
          maxWidth: '480px', 
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
        {/* Top Brand Badge */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: 'rgba(35, 157, 173, 0.12)',
            color: 'var(--accent-color)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '20px'
          }}
        >
          <Sparkles size={13} />
          <span>TypstLab Collaboration</span>
        </div>

        {/* LOADING STATE */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div 
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(35, 157, 173, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCw size={36} className="spin-animation" style={{ color: 'var(--accent-color)' }} />
            </div>
            
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '4px 0 0 0' }}>
              Accepting Project Invitation
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              Validating token and setting up real-time collaboration access...
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%' }}>
            <div 
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ade80'
              }}
            >
              <CheckCircle2 size={40} />
            </div>

            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                You're in!
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                You have successfully joined the project.
              </p>
            </div>

            {/* Project info card */}
            <div 
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left'
              }}
            >
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(35, 157, 173, 0.15)',
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <FolderGit2 size={20} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {projectName}
                </div>
                {currentUser?.email && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Collaborating as {currentUser.email}
                  </div>
                )}
              </div>
            </div>

            <button
              className="auth-submit-btn"
              onClick={() => { window.location.hash = `#/project/${projectId}`; }}
              style={{ width: '100%', marginTop: '4px' }}
            >
              <span>Open Project ({countdown}s)</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div 
              style={{ 
                width: '72px', 
                height: '72px', 
                borderRadius: '50%', 
                backgroundColor: errorType === 'expired' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(244, 63, 94, 0.12)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: errorType === 'expired' ? '#facc15' : '#f87171'
              }}
            >
              {errorType === 'expired' ? (
                <Clock size={36} />
              ) : errorType === 'not_found' ? (
                <Link2Off size={36} />
              ) : (
                <AlertCircle size={36} />
              )}
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                {errorType === 'expired' 
                  ? 'Invitation Link Expired' 
                  : errorType === 'not_found' 
                  ? 'Invitation Link Invalid' 
                  : 'Invitation Error'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                {errorMessage}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '8px' }}>
              <button
                className="auth-submit-btn"
                onClick={() => { window.location.hash = '#/'; }}
                style={{ width: '100%' }}
              >
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
