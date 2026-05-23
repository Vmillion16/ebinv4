// EbinContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_URL from './config';

const EbinContext = createContext(null);

export const useEbin = () => {
  const ctx = useContext(EbinContext);
  if (!ctx) throw new Error('useEbin must be used inside <EbinProvider>');
  return ctx;
};

export const EbinProvider = ({ children }) => {
  const [bins, setBins]                   = useState([]);
  const [wasteEvents, setWasteEvents]     = useState([]);
  const [clearedTypes, setClearedTypes]   = useState(new Set()); // ← tracks emptied bin types
  const [loadingBins, setLoadingBins]     = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [errorBins, setErrorBins]         = useState(null);
  const [errorEvents, setErrorEvents]     = useState(null);
  const [lastSync, setLastSync]           = useState(null);

  // ── Fetch bins ─────────────────────────────────────────────
  const fetchBins = useCallback(async () => {
    try {
      setLoadingBins(true);
      setErrorBins(null);
      const res = await fetch(`${API_URL}/bins/public/dashboard`);
      if (!res.ok) throw new Error(`Bins fetch failed: ${res.status}`);
      const data = await res.json();

      const transformed = (data.bins || []).map(bin => ({
        _id:       bin._id,
        bin_name:  bin.bin_name  || 'Unknown Bin',
        bin_type:  bin.bin_type  || 'General',
        fillLevel: bin.fill_level ?? bin.fillLevel ?? 0,
        status:    bin.status    || 'Active',
        location:  bin.location  || '—',
        weight_kg: bin.weight_kg ?? 0,
      }));

      setBins(transformed);
      setLastSync(new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }));
    } catch (err) {
      console.error('EbinContext bins error:', err);
      setErrorBins(err.message);
    } finally {
      setLoadingBins(false);
    }
  }, []);

  // ── Fetch waste events ─────────────────────────────────────
  const fetchWasteEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      setErrorEvents(null);
      const res = await fetch(`${API_URL}/waste-events/public/latest`);
      if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
      const data = await res.json();

      const transformed = (data.events || []).map(e => ({
        id:        e.id,
        time:      e.time,
        bin:       e.bin,
        type:      e.type,
        item:      e.item  || '—',
        weight:    e.weight,
        result:    e.result,
        weight_kg: parseFloat((e.weight || '0').replace(/[^\d.]/g, '')) || 0,
      }));

      setWasteEvents(transformed);
      setLastSync(new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }));
    } catch (err) {
      console.error('EbinContext events error:', err);
      setErrorEvents(err.message);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // ── Clear events for a bin type (persists across re-fetches) ──
  const clearEventsForBin = useCallback((binType) => {
    setClearedTypes(prev => new Set([...prev, binType]));
  }, []);

  // ── Unblock events (e.g. manual refresh button) ────────────
  const resetClearedTypes = useCallback(() => {
    setClearedTypes(new Set());
  }, []);

  // ── Refresh both ───────────────────────────────────────────
  const refreshAll = useCallback(() => {
    fetchBins();
    fetchWasteEvents();
  }, [fetchBins, fetchWasteEvents]);

  // ── Initial load + polling ─────────────────────────────────
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 60000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ── Filter out cleared types so they stay hidden even after re-fetch ──
  const visibleWasteEvents = wasteEvents.filter(e => !clearedTypes.has(e.type));

  // ── Derived stats (based on visible events only) ───────────
  const stats = {
    totalBins:           bins.length,
    fullBins:            bins.filter(b => b.fillLevel >= 90).length,
    nearFullBins:        bins.filter(b => b.fillLevel >= 75 && b.fillLevel < 90).length,
    activeBins:          bins.filter(b => b.fillLevel < 75).length,
    totalBinWeight:      bins.reduce((s, b) => s + (b.weight_kg || 0), 0),
    avgFillLevel:        bins.length
                           ? bins.reduce((s, b) => s + b.fillLevel, 0) / bins.length
                           : 0,
    totalEvents:         visibleWasteEvents.length,
    recyclableEvents:    visibleWasteEvents.filter(e => e.type === 'Recyclable').length,
    biodegradableEvents: visibleWasteEvents.filter(e => e.type === 'Biodegradable').length,
    nonBioEvents:        visibleWasteEvents.filter(e => e.type === 'Non-Biodegradable').length,
    classifiedEvents:    visibleWasteEvents.filter(e => e.result === 'Classified').length,
    fallbackEvents:      visibleWasteEvents.filter(e => e.result === 'Fallback').length,
    totalEventsWeight:   visibleWasteEvents.reduce((s, e) => s + e.weight_kg, 0),
    priorityBins:        [...bins]
                           .filter(b => b.fillLevel >= 75)
                           .sort((a, b) => b.fillLevel - a.fillLevel)
                           .slice(0, 5),
  };

  return (
    <EbinContext.Provider value={{
      bins,
      wasteEvents:      visibleWasteEvents, // ← always filtered
      loadingBins,
      loadingEvents,
      errorBins,
      errorEvents,
      refreshAll,
      fetchBins,
      fetchWasteEvents,
      clearEventsForBin,
      resetClearedTypes,
      stats,
      lastSync,
    }}>
      {children}
    </EbinContext.Provider>
  );
};

export default EbinContext;