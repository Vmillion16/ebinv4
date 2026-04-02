import React, { useState } from 'react';

const Settings = () => {
  const [settings, setSettings] = useState({
    fullThreshold: 90,
    overflowThreshold: 80,
    notifications: true
  });

  const handleSave = () => {
    alert('⚙️ Settings saved! (Demo)');
  };

  return (
    <div className="settings">
      <h2>⚙️ System Settings</h2>
      <div className="settings-form">
        <div className="form-group">
          <label>Full Bin Threshold (%)</label>
          <input 
            type="number" 
            value={settings.fullThreshold}
            onChange={(e) => setSettings({...settings, fullThreshold: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Overflow Alert (%)</label>
          <input 
            type="number" 
            value={settings.overflowThreshold}
            onChange={(e) => setSettings({...settings, overflowThreshold: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>
            <input 
              type="checkbox" 
              checked={settings.notifications}
              onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
            />
            Email Notifications
          </label>
        </div>
        <button className="save-btn" onClick={handleSave}>
          💾 Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;