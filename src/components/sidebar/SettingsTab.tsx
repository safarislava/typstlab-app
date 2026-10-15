import React from 'react';
import { useAppDispatch, useAppSelector, setShowSelfCursor } from '../../store';

export const SettingsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const showSelfCursor = useAppSelector(state => state.collaboration.showSelfCursor);

  return (
    <div className="pane-content">
      <div className="pane-header">Settings</div>
      <div className="settings-list">
        <div className="setting-item">
          <label className="checkbox-label">
            <input type="checkbox" defaultChecked />
            <span>Enable Autocomplete</span>
          </label>
        </div>
        <div className="setting-item">
          <label className="checkbox-label">
            <input type="checkbox" defaultChecked />
            <span>Real-time Compile</span>
          </label>
        </div>
        <div className="setting-item">
          <label className="checkbox-label">
            <input type="checkbox" defaultChecked />
            <span>Show Line Numbers</span>
          </label>
        </div>
        <div className="setting-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showSelfCursor}
              onChange={(e) => dispatch(setShowSelfCursor(e.target.checked))}
            />
            <span>Show Own Remote Cursor</span>
          </label>
        </div>
      </div>
    </div>
  );
};
