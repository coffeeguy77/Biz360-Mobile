import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clause, DraftLease, Lease } from './leaseTypes';
import { LEASE_SEED_CLAUSES } from '@/data/leaseSeedClauses';

const LEASES_KEY  = 'biz360_lease_leases';
const CLAUSES_KEY = 'biz360_lease_clauses';
const DRAFTS_KEY  = 'biz360_lease_drafts';

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : '';

interface LeaseContextValue {
  leases:       Lease[];
  clauses:      Clause[];
  drafts:       DraftLease[];
  addLease:     (lease: Lease) => Promise<void>;
  updateLease:  (id: string, updates: Partial<Lease>) => Promise<void>;
  deleteLease:  (id: string) => Promise<void>;
  addClause:    (clause: Clause) => Promise<void>;
  addClauses:   (clauses: Clause[]) => Promise<void>;
  addDraft:     (draft: DraftLease) => Promise<void>;
  updateDraft:  (id: string, updates: Partial<DraftLease>) => Promise<void>;
  deleteDraft:  (id: string) => Promise<void>;
}

const LeaseContext = createContext<LeaseContextValue | null>(null);

export function LeaseProvider({ children }: { children: React.ReactNode }) {
  const [leases,      setLeases]      = useState<Lease[]>([]);
  const [userClauses, setUserClauses] = useState<Clause[]>([]);
  const [drafts,      setDrafts]      = useState<DraftLease[]>([]);

  // Auth token ref — kept in sync but never causes re-renders
  const tokenRef = useRef<string | null>(null);

  // ─── Startup: load from AsyncStorage, clean orphans, then sync from server ──

  useEffect(() => {
    (async () => {
      try {
        const [lRaw, cRaw, dRaw, token] = await Promise.all([
          AsyncStorage.getItem(LEASES_KEY),
          AsyncStorage.getItem(CLAUSES_KEY),
          AsyncStorage.getItem(DRAFTS_KEY),
          AsyncStorage.getItem('biz360_auth_token'),
        ]);

        tokenRef.current = token;

        const loadedLeases: Lease[]   = lRaw ? JSON.parse(lRaw) : [];
        const loadedClauses: Clause[] = cRaw ? JSON.parse(cRaw) : [];

        setLeases(loadedLeases);
        if (dRaw) setDrafts(JSON.parse(dRaw));

        // Clean up orphaned clauses: remove any extracted clause whose parent lease
        // no longer exists (e.g. Expo Go cache cleared between sessions).
        const leaseIds = new Set(loadedLeases.map(l => l.id));
        const cleaned  = loadedClauses.filter(
          c => !c.sourceLeaseId || leaseIds.has(c.sourceLeaseId),
        );
        setUserClauses(cleaned);
        if (cleaned.length !== loadedClauses.length) {
          await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(cleaned));
        }

        // Background server sync — must not block the UI
        if (token && API_BASE) {
          syncFromServer(loadedLeases, cleaned, token).catch(() => {});
        }
      } catch { /* non-critical */ }
    })();
  }, []);

  // ─── Server sync helpers ─────────────────────────────────────────────────────

  async function syncFromServer(
    localLeases: Lease[],
    localClauses: Clause[],
    token: string,
  ) {
    try {
      const res = await fetch(`${API_BASE}/api/seller/leases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const body: { leases: Lease[]; clauses: Clause[] } = await res.json();
      const { leases: serverLeases, clauses: serverClauses } = body;

      // First-launch migration: server is empty but local has data → push everything up
      if (serverLeases.length === 0 && localLeases.length > 0) {
        for (const lease of localLeases) {
          fetch(`${API_BASE}/api/seller/leases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lease }),
          }).catch(() => {});
          const leaseClauses = localClauses.filter(c => c.sourceLeaseId === lease.id);
          if (leaseClauses.length) {
            fetch(`${API_BASE}/api/seller/leases/${lease.id}/clauses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ clauses: leaseClauses }),
            }).catch(() => {});
          }
        }
        return;
      }

      // Merge: server is authoritative; include any local leases the server doesn't have
      const serverLeaseIds  = new Set(serverLeases.map(l => l.id));
      const serverClauseIds = new Set(serverClauses.map(c => c.id));

      const mergedLeases = [
        ...serverLeases,
        ...localLeases.filter(l => !serverLeaseIds.has(l.id)),
      ];
      const mergedClauses = [
        ...serverClauses,
        ...localClauses.filter(c => !serverClauseIds.has(c.id)),
      ];

      setLeases(mergedLeases);
      setUserClauses(mergedClauses);
      await Promise.all([
        AsyncStorage.setItem(LEASES_KEY,  JSON.stringify(mergedLeases)),
        AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(mergedClauses)),
      ]);
    } catch { /* offline or server unavailable — local data stays */ }
  }

  function serverSaveLease(lease: Lease) {
    const token = tokenRef.current;
    if (!token || !API_BASE) return;
    fetch(`${API_BASE}/api/seller/leases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lease }),
    }).catch(() => {});
  }

  function serverSaveClauses(leaseId: string, clauses: Clause[]) {
    const token = tokenRef.current;
    if (!token || !API_BASE || !clauses.length) return;
    fetch(`${API_BASE}/api/seller/leases/${leaseId}/clauses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clauses }),
    }).catch(() => {});
  }

  function serverDeleteLease(id: string) {
    const token = tokenRef.current;
    if (!token || !API_BASE) return;
    fetch(`${API_BASE}/api/seller/leases/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────

  async function addLease(lease: Lease) {
    let saved: Lease[] = [];
    setLeases(prev => {
      saved = [lease, ...prev];
      return saved;
    });
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(saved));
    serverSaveLease(lease);
  }

  async function updateLease(id: string, updates: Partial<Lease>) {
    let saved: Lease[] = [];
    setLeases(prev => {
      saved = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      return saved;
    });
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(saved));
    const updated = saved.find(l => l.id === id);
    if (updated) serverSaveLease(updated);
  }

  async function deleteLease(id: string) {
    let savedLeases: Lease[]   = [];
    let savedClauses: Clause[] = [];

    setLeases(prev => {
      savedLeases = prev.filter(l => l.id !== id);
      return savedLeases;
    });
    setUserClauses(prev => {
      savedClauses = prev.filter(c => c.sourceLeaseId !== id);
      return savedClauses;
    });

    await Promise.all([
      AsyncStorage.setItem(LEASES_KEY,  JSON.stringify(savedLeases)),
      AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(savedClauses)),
    ]);
    serverDeleteLease(id);
  }

  async function addClause(clause: Clause) {
    let saved: Clause[] = [];
    setUserClauses(prev => {
      saved = [clause, ...prev.filter(c => c.id !== clause.id)];
      return saved;
    });
    await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(saved));
    if (clause.sourceLeaseId) serverSaveClauses(clause.sourceLeaseId, [clause]);
  }

  /** Atomically insert multiple clauses in one state update + one AsyncStorage write. */
  async function addClauses(incoming: Clause[]) {
    if (!incoming.length) return;
    let saved: Clause[] = [];
    setUserClauses(prev => {
      const incomingIds = new Set(incoming.map(c => c.id));
      saved = [...incoming, ...prev.filter(c => !incomingIds.has(c.id))];
      return saved;
    });
    await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(saved));
    // Group by sourceLeaseId and sync each group
    const byLease = new Map<string, Clause[]>();
    for (const c of incoming) {
      if (c.sourceLeaseId) {
        const group = byLease.get(c.sourceLeaseId) ?? [];
        group.push(c);
        byLease.set(c.sourceLeaseId, group);
      }
    }
    byLease.forEach((group, leaseId) => serverSaveClauses(leaseId, group));
  }

  async function addDraft(draft: DraftLease) {
    let saved: DraftLease[] = [];
    setDrafts(prev => {
      saved = [draft, ...prev];
      return saved;
    });
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(saved));
  }

  async function updateDraft(id: string, updates: Partial<DraftLease>) {
    let saved: DraftLease[] = [];
    setDrafts(prev => {
      saved = prev.map(d => d.id === id ? { ...d, ...updates } : d);
      return saved;
    });
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(saved));
  }

  async function deleteDraft(id: string) {
    let saved: DraftLease[] = [];
    setDrafts(prev => {
      saved = prev.filter(d => d.id !== id);
      return saved;
    });
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(saved));
  }

  const clauses: Clause[] = [
    ...LEASE_SEED_CLAUSES,
    ...userClauses.filter(c => !LEASE_SEED_CLAUSES.some(s => s.id === c.id)),
  ];

  return (
    <LeaseContext.Provider value={{
      leases, clauses, drafts,
      addLease, updateLease, deleteLease,
      addClause, addClauses,
      addDraft, updateDraft, deleteDraft,
    }}>
      {children}
    </LeaseContext.Provider>
  );
}

export function useLease() {
  const ctx = useContext(LeaseContext);
  if (!ctx) throw new Error('useLease must be used within LeaseProvider');
  return ctx;
}
