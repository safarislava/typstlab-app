import React from 'react';

export const SettingsTab: React.FC = () => {
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
      </div>
    </div>
  );
};
