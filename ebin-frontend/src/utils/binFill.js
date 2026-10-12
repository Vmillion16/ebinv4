// Shared bin-fill logic: used by BOTH BinMonitoring.js and DashboardOverview.js
import { useState, useEffect } from 'react';

export const BASE_URL = 'https://ebinv4-1.onrender.com';
export const MAX_BIN_CAPACITY_KG = 10;
export const DEFAULT_THRESHOLDS = { nearFull: 75, full: 90, overflow: 95 };

export const getEventWeightKg = (event) => {
  const raw = event.weight_kg ?? event.weight ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Total weight per bin name, summed from waste events (same as Bin Monitoring).
// emptiedAt = { [binName]: ISO time }. Events at or before a bin's emptied time
// are skipped, so the fill level restarts at 0 while the history stays intact.
export const getWeightPerBin = (wasteEvents = [], emptiedAt = {}) => {
  const map = new Map();
  wasteEvents.forEach((event) => {
    const emptiedMs = emptiedAt[event.bin] ? new Date(emptiedAt[event.bin]).getTime() : null;
    if (emptiedMs !== null && !Number.isNaN(emptiedMs)) {
      const eventMs = new Date(event.time).getTime();
      if (!Number.isNaN(eventMs) && eventMs <= emptiedMs) return;
    }
    map.set(event.bin, (map.get(event.bin) || 0) + getEventWeightKg(event));
  });
  return map;
};

// Weight (kg) -> fill % against 10kg capacity, clamped 0-100
export const computeFillPct = (weightKg) => {
  const pct = (weightKg / MAX_BIN_CAPACITY_KG) * 100;
  return Math.min(Math.max(Math.round(pct), 0), 100);
};

// Same thresholds endpoint Bin Monitoring uses
export const useThresholds = () => {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${BASE_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setThresholds({
            nearFull: data.nearFullThreshold ?? DEFAULT_THRESHOLDS.nearFull,
            full:     data.fullThreshold     ?? DEFAULT_THRESHOLDS.full,
            overflow: data.overflowThreshold ?? DEFAULT_THRESHOLDS.overflow,
          });
        }
      } catch (err) {
        console.error('Failed to load thresholds', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return thresholds;
};