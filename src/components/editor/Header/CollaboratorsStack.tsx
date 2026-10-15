import React from 'react';
import { useAppSelector } from '../../../store';

export const CollaboratorsStack: React.FC = () => {
  const collaboratorsMap = useAppSelector(state => state.collaboration.collaborators);
  const collaborators = Object.values(collaboratorsMap);

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
