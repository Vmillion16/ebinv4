import React, { useState } from 'react';
import './Settings.css';

// ─── Initial state ─────────────────────────────────────────────────────────
const DEFAULTS = {
  // Bin thresholds
  fullThreshold:     90,
  nearFullThreshold: 75,
  overflowThreshold: 95,

  // Collection schedule
  collectionDays:    ['Tuesday', 'Saturday'],
  collectionTime:    '14:00',
  municipalPickup:   ['Tuesday', 'Saturday'],

  // Odor & ventilation
  odorEnabled:       true,
  fanTriggerLevel:   60,
  fanDuration:       10,

  // Solar & power
  lowBatteryAlert:   20,
  reducedModeLevel:  10,

  // Reward system
  rewardEnabled:     true,
  chargingDuration:  20,
  rewardWasteType:   'Recyclable',

  // Notifications
  emailEnabled:      true,
  emailAddress:      'admin@pdm.edu.ph',
  smsEnabled:        false,
  smsNumber:         '',
  notifyOnFull:      true,
  notifyOnOverflow:  true,
  notifyOnLowPower:  true,

  // Account
  adminName:         'Eriza Enriquez-Santos',
  currentPassword:   '',
  newPassword:       '',
  confirmPassword:   '',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SECTIONS = [
  { key: 'bins',         label: 'Bin thresholds' },
  { key: 'collection',   label: 'Collection schedule' },
  { key: 'odor',         label: 'Odor & ventilation' },
  { key: 'power',        label: 'Solar & power' },
  { key: 'reward',       label: 'Reward system' },
  { key: 'notif',        label: 'Notifications' },
  { key: 'account',      label: 'Account' },
];

// ─── Sub-components ─────────────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div className="st-field">
    <div className="st-field-label-wrap">
      <label className="st-label">{label}</label>
      {hint && <span className="st-hint">{hint}</span>}
    </div>
    {children}
  </div>
);

const NumberInput = ({ value, onChange, min = 0, max = 100, unit = '' }) => (
  <div className="st-number-wrap">
    <input
      type="number"
      className="st-input st-input-sm"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
    />
    {unit && <span className="st-unit">{unit}</span>}
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="st-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="st-toggle-track">
      <span className="st-toggle-thumb" />
    </span>
    {label && <span className="st-toggle-label">{label}</span>}
  </label>
);

const DaySelector = ({ selected, onChange }) => {
  const toggle = (day) => {
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day]
    );
  };
  return (
    <div className="st-days">
      {DAYS.map((day) => (
        <button
          key={day}
          className={`st-day-btn ${selected.includes(day) ? 'st-day-active' : ''}`}
          onClick={() => toggle(day)}
          type="button"
        >
          {day.slice(0, 3)}
        </button>
      ))}
    </div>
  );
};

const SaveBar = ({ dirty, onSave, onReset }) => (
  <div className={`st-save-bar ${dirty ? 'st-save-bar-visible' : ''}`}>
    <p className="st-save-msg">You have unsaved changes</p>
    <div className="st-save-actions">
      <button className="st-btn-ghost" onClick={onReset} type="button">Discard</button>
      <button className="st-btn-primary" onClick={onSave} type="button">Save settings</button>
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
const Settings = () => {
  const [s, setS] = useState(DEFAULTS);
  const [saved, setSaved] = useState({ ...DEFAULTS });
  const [active, setActive] = useState('bins');
  const [toast, setToast]   = useState(null);
  const [pwError, setPwError] = useState('');

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const update = (key, value) => setS((prev) => ({ ...prev, [key]: value }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    // Password validation
    if (s.newPassword) {
      if (s.newPassword.length < 6) {
        setPwError('Password must be at least 6 characters.');
        setActive('account');
        return;
      }
      if (s.newPassword !== s.confirmPassword) {
        setPwError('Passwords do not match.');
        setActive('account');
        return;
      }
    }
    setPwError('');
    setSaved({ ...s });
    showToast('Settings saved successfully.');
  };

  const handleReset = () => {
    setS({ ...saved });
    setPwError('');
  };

  const handleRestoreDefaults = () => {
    setS({ ...DEFAULTS });
    showToast('Restored to default settings.', 'info');
  };

  return (
    <div className="st-page">

      {/* Toast */}
      {toast && (
        <div className={`st-toast st-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="st-header">
        <div>
          <h2 className="st-title">System Settings</h2>
          <p className="st-sub">Configure E-Bin operational parameters</p>
        </div>
        <button className="st-btn-ghost" onClick={handleRestoreDefaults} type="button">
          Restore defaults
        </button>
      </div>

      <div className="st-layout">
        {/* Sidebar nav */}
        <nav className="st-nav">
          {SECTIONS.map((sec) => (
            <button
              key={sec.key}
              className={`st-nav-item ${active === sec.key ? 'st-nav-active' : ''}`}
              onClick={() => setActive(sec.key)}
              type="button"
            >
              {sec.label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div className="st-panel">

          {/* ── Bin thresholds ── */}
          {active === 'bins' && (
            <div className="st-section">
              <p className="st-section-title">Bin thresholds</p>
              <p className="st-section-desc">
                Define fill-level percentages that trigger status changes and notifications.
                Based on ultrasonic sensor readings from E-Bin hardware.
              </p>
              <div className="st-fields">
                <Field label="Near-full threshold" hint="Bin status changes to 'Near Full'">
                  <NumberInput value={s.nearFullThreshold} onChange={(v) => update('nearFullThreshold', v)} unit="%" />
                </Field>
                <Field label="Full threshold" hint="Bin status changes to 'Full'">
                  <NumberInput value={s.fullThreshold} onChange={(v) => update('fullThreshold', v)} unit="%" />
                </Field>
                <Field label="Overflow threshold" hint="Critical level — immediate action needed">
                  <NumberInput value={s.overflowThreshold} onChange={(v) => update('overflowThreshold', v)} unit="%" />
                </Field>
              </div>
              <div className="st-preview">
                <p className="st-preview-label">Threshold preview</p>
                <div className="st-bar-preview-bg">
                  <div className="st-bar-seg st-seg-ok"    style={{ width: `${s.nearFullThreshold}%` }} />
                  <div className="st-bar-seg st-seg-warn"  style={{ width: `${s.fullThreshold - s.nearFullThreshold}%` }} />
                  <div className="st-bar-seg st-seg-full"  style={{ width: `${s.overflowThreshold - s.fullThreshold}%` }} />
                  <div className="st-bar-seg st-seg-crit"  style={{ width: `${100 - s.overflowThreshold}%` }} />
                </div>
                <div className="st-bar-legend">
                  <span className="st-leg st-leg-ok">Normal (0–{s.nearFullThreshold}%)</span>
                  <span className="st-leg st-leg-warn">Near full ({s.nearFullThreshold}–{s.fullThreshold}%)</span>
                  <span className="st-leg st-leg-full">Full ({s.fullThreshold}–{s.overflowThreshold}%)</span>
                  <span className="st-leg st-leg-crit">Overflow ({s.overflowThreshold}–100%)</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Collection schedule ── */}
          {active === 'collection' && (
            <div className="st-section">
              <p className="st-section-title">Collection schedule</p>
              <p className="st-section-desc">
                Set internal collection days for utility staff and align with the
                municipal garbage truck schedule (currently Tuesdays and Saturdays).
              </p>
              <div className="st-fields">
                <Field label="Staff collection days" hint="Days when utility staff collect from bins">
                  <DaySelector selected={s.collectionDays} onChange={(v) => update('collectionDays', v)} />
                </Field>
                <Field label="Collection time" hint="Scheduled collection start time">
                  <input
                    type="time"
                    className="st-input st-input-sm"
                    value={s.collectionTime}
                    onChange={(e) => update('collectionTime', e.target.value)}
                  />
                </Field>
                <Field label="Municipal pickup days" hint="Days when the municipal garbage truck collects from PDM">
                  <DaySelector selected={s.municipalPickup} onChange={(v) => update('municipalPickup', v)} />
                </Field>
              </div>
              <div className="st-info-box">
                Based on interviews with PDM utility staff, municipal collection operates on
                Tuesdays and Saturdays. Internal collection should occur before these days
                to transfer waste from bins to the temporary storage area on time.
              </div>
            </div>
          )}

          {/* ── Odor & ventilation ── */}
          {active === 'odor' && (
            <div className="st-section">
              <p className="st-section-title">Odor & ventilation control</p>
              <p className="st-section-desc">
                Configure the exhaust fan behavior for ventilation-based odor control.
                The fan activates automatically when fill levels exceed the set threshold.
              </p>
              <div className="st-fields">
                <Field label="Ventilation control">
                  <Toggle
                    checked={s.odorEnabled}
                    onChange={(v) => update('odorEnabled', v)}
                    label="Enable automatic exhaust fan"
                  />
                </Field>
                <Field label="Fan trigger level" hint="Fill % at which the exhaust fan activates">
                  <NumberInput
                    value={s.fanTriggerLevel}
                    onChange={(v) => update('fanTriggerLevel', v)}
                    unit="%"
                    min={10}
                    max={100}
                  />
                </Field>
                <Field label="Fan run duration" hint="How long the fan runs per cycle">
                  <NumberInput
                    value={s.fanDuration}
                    onChange={(v) => update('fanDuration', v)}
                    unit="min"
                    min={1}
                    max={60}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Solar & power ── */}
          {active === 'power' && (
            <div className="st-section">
              <p className="st-section-title">Solar & power management</p>
              <p className="st-section-desc">
                Configure battery thresholds for the 100W solar panel and OD Gel
                rechargeable battery system. The system enters reduced-function mode
                to conserve energy during low power conditions.
              </p>
              <div className="st-fields">
                <Field label="Low battery alert" hint="Notify staff when battery drops below this level">
                  <NumberInput
                    value={s.lowBatteryAlert}
                    onChange={(v) => update('lowBatteryAlert', v)}
                    unit="%"
                    min={5}
                    max={50}
                  />
                </Field>
                <Field label="Reduced-function mode" hint="System conserves energy below this level (disables non-essential functions)">
                  <NumberInput
                    value={s.reducedModeLevel}
                    onChange={(v) => update('reducedModeLevel', v)}
                    unit="%"
                    min={1}
                    max={30}
                  />
                </Field>
              </div>
              <div className="st-info-box">
                In reduced-function mode, the web dashboard remains active but
                the exhaust fan, reward system, and non-critical sensors are paused
                to preserve battery for core fill-level monitoring and data transmission.
              </div>
            </div>
          )}

          {/* ── Reward system ── */}
          {active === 'reward' && (
            <div className="st-section">
              <p className="st-section-title">Reward system</p>
              <p className="st-section-desc">
                Configure the phone charging incentive granted to users who dispose
                of waste correctly. Described in DFD Process 6 of the system design.
              </p>
              <div className="st-fields">
                <Field label="Reward system">
                  <Toggle
                    checked={s.rewardEnabled}
                    onChange={(v) => update('rewardEnabled', v)}
                    label="Enable charging access reward"
                  />
                </Field>
                <Field label="Charging duration" hint="Minutes of charging access granted per correct disposal">
                  <NumberInput
                    value={s.chargingDuration}
                    onChange={(v) => update('chargingDuration', v)}
                    unit="min"
                    min={5}
                    max={60}
                  />
                </Field>
                <Field label="Qualifying waste type" hint="Waste type that earns the reward">
                  <select
                    className="st-input st-input-sm"
                    value={s.rewardWasteType}
                    onChange={(e) => update('rewardWasteType', e.target.value)}
                  >
                    <option value="Recyclable">Recyclable only</option>
                    <option value="Any">Any correctly classified waste</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {active === 'notif' && (
            <div className="st-section">
              <p className="st-section-title">Notifications</p>
              <p className="st-section-desc">
                Configure how and when the system sends notifications to administrators
                and utility staff about bin status and system events.
              </p>
              <div className="st-fields">
                <Field label="Email notifications">
                  <Toggle
                    checked={s.emailEnabled}
                    onChange={(v) => update('emailEnabled', v)}
                    label="Send email notifications"
                  />
                </Field>
                {s.emailEnabled && (
                  <Field label="Admin email address">
                    <input
                      type="email"
                      className="st-input"
                      value={s.emailAddress}
                      placeholder="admin@pdm.edu.ph"
                      onChange={(e) => update('emailAddress', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="SMS notifications">
                  <Toggle
                    checked={s.smsEnabled}
                    onChange={(v) => update('smsEnabled', v)}
                    label="Send SMS notifications"
                  />
                </Field>
                {s.smsEnabled && (
                  <Field label="Phone number">
                    <input
                      type="tel"
                      className="st-input"
                      value={s.smsNumber}
                      placeholder="+63 9XX XXX XXXX"
                      onChange={(e) => update('smsNumber', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Notify when" hint="Select events that trigger notifications">
                  <div className="st-checks">
                    <label className="st-check">
                      <input type="checkbox" checked={s.notifyOnFull} onChange={(e) => update('notifyOnFull', e.target.checked)} />
                      <span>Bin reaches full threshold</span>
                    </label>
                    <label className="st-check">
                      <input type="checkbox" checked={s.notifyOnOverflow} onChange={(e) => update('notifyOnOverflow', e.target.checked)} />
                      <span>Bin overflow detected</span>
                    </label>
                    <label className="st-check">
                      <input type="checkbox" checked={s.notifyOnLowPower} onChange={(e) => update('notifyOnLowPower', e.target.checked)} />
                      <span>Solar battery low</span>
                    </label>
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {active === 'account' && (
            <div className="st-section">
              <p className="st-section-title">Account</p>
              <p className="st-section-desc">
                Update your administrator profile and change your login password.
              </p>
              <div className="st-fields">
                <Field label="Full name">
                  <input
                    type="text"
                    className="st-input"
                    value={s.adminName}
                    onChange={(e) => update('adminName', e.target.value)}
                  />
                </Field>
                <div className="st-divider" />
                <p className="st-sub-section">Change password</p>
                <Field label="Current password">
                  <input
                    type="password"
                    className="st-input"
                    value={s.currentPassword}
                    placeholder="Enter current password"
                    onChange={(e) => update('currentPassword', e.target.value)}
                  />
                </Field>
                <Field label="New password">
                  <input
                    type="password"
                    className="st-input"
                    value={s.newPassword}
                    placeholder="Min. 6 characters"
                    onChange={(e) => update('newPassword', e.target.value)}
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type="password"
                    className="st-input"
                    value={s.confirmPassword}
                    placeholder="Repeat new password"
                    onChange={(e) => update('confirmPassword', e.target.value)}
                  />
                </Field>
                {pwError && <p className="st-error">{pwError}</p>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating save bar */}
      <SaveBar dirty={dirty} onSave={handleSave} onReset={handleReset} />

    </div>
  );
};

export default Settings;