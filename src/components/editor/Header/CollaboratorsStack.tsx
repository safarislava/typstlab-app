import React from 'react';
import { useAppSelector } from '../../../store';
import type { WSUserPresence } from '../../../core/types';

export const CollaboratorsStack: React.FC = () => {
  const collaboratorsMap = useAppSelector(state => state.collaboration.collaborators);
  const showSelfCursor = useAppSelector(state => state.collaboration.showSelfCursor);
  const localPresence = useAppSelector(state => state.collaboration.localPresence);
  const currentUser = useAppSelector(state => state.auth.currentUser);
  const currentEmail = currentUser?.email?.toLowerCase();

  // Filter out the current user from remote presences
  const otherCollaborators = Object.values(collaboratorsMap).filter(c => {
    if (currentEmail && c.email?.toLowerCase() === currentEmail) {
      return false;
    }
    return true;
  });

  // Only include self if showSelfCursor is turned on
  const collaborators: WSUserPresence[] = [...otherCollaborators];
  if (showSelfCursor) {
    const selfFromServer = Object.values(collaboratorsMap).find(
      c => currentEmail && c.email?.toLowerCase() === currentEmail
    );
    if (localPresence) {
      collaborators.unshift(localPresence);
    } else if (selfFromServer) {
      collaborators.unshift(selfFromServer);
    } else if (currentUser) {
      collaborators.unshift({
        user_id: 'self',
        email: currentUser.email || currentUser.username || 'You',
        color: '#239DAD',
        file_id: '',
        cursor: { anchor: 0, head: 0 }
      });
    }
  }

  if (collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, 4);
  const extraCount = collaborators.length - visibleCollaborators.length;

  return (
    <div className="collaborators-stack" title={`${collaborators.length} соавтор(ов) в проекте`}>
      {visibleCollaborators.map(c => {
        const initial = (c.email || '?')[0].toUpperCase();
        return (
          <div
            key={c.user_id}
            className="collaborator-avatar"
            style={{
              borderColor: c.color || '#3B82F6',
              boxShadow: `0 0 0 1px #1b1c1e, 0 2px 6px ${c.color}40`
            }}
            title={c.email}
          >
            <span style={{ color: c.color || '#3B82F6' }}>{initial}</span>
          </div>
        );
      })}

      {extraCount > 0 && (
        <div className="collaborator-avatar extra-count" title={`+${extraCount} соавторов`}>
          +{extraCount}
        </div>
      )}
    </div>
  );
};
