import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clause, DraftLease, Lease } from './leaseTypes';
import { LEASE_SEED_CLAUSES } from '@/data/leaseSeedClauses';

const LEASES_KEY  = 'biz360_lease_leases';
const CLAUSES_KEY = 'biz360_lease_clauses';
const DRAFTS_KEY  = 'biz360_lease_drafts';
const TOKEN_KEY   = 'biz360_auth_token';

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

// ─── Server sync helpers ─────────────────────────────────────────────────────
// Token is read fresh from AsyncStorage on every call so these functions work
// correctly even if the user logs in after LeaseProvider first mounts.

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  if (!API_BASE) return null;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function serverSaveLease(lease: Lease) {
  (async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`${API_BASE}/api/seller/leases`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ lease }),
      });
    } catch { /* non-critical, best-effort */ }
  })();
}

/** Best-effort clause sync with bounded retry on 409 (parent lease not yet on server). */
function serverSaveClauses(leaseId: string, clauses: Clause[], attempt = 0) {
  if (!clauses.length) return;
  (async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE}/api/seller/leases/${leaseId}/clauses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clauses }),
      });
      if (res.status === 409 && attempt < 3) {
        // Parent lease save hasn't landed yet — back off and retry (max 3 times)
        await new Promise(r => setTimeout(r, 2_000 * (attempt + 1)));
        serverSaveClauses(leaseId, clauses, attempt + 1);
      }
    } catch { /* non-critical, best-effort */ }
  })();
}

function serverDeleteLease(id: string) {
  (async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token || !API_BASE) return;
      await fetch(`${API_BASE}/api/seller/leases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* non-critical, best-effort */ }
  })();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function LeaseProvider({ children }: { children: React.ReactNode }) {
  const [leases,      setLeases]      = useState<Lease[]>([]);
  const [userClauses, setUserClauses] = useState<Clause[]>([]);
  const [drafts,      setDrafts]      = useState<DraftLease[]>([]);

  // Startup: load from AsyncStorage, clean orphaned clauses, then sync from server
  useEffect(() => {
    (async () => {
      try {
        const [lRaw, cRaw, dRaw] = await Promise.all([
          AsyncStorage.getItem(LEASES_KEY),
          AsyncStorage.getItem(CLAUSES_KEY),
          AsyncStorage.getItem(DRAFTS_KEY),
        ]);

        const loadedLeases: Lease[]   = lRaw ? JSON.parse(lRaw) : [];
        const loadedClauses: Clause[] = cRaw ? JSON.parse(cRaw) : [];

        setLeases(loadedLeases);
        if (dRaw) setDrafts(JSON.parse(dRaw));

        // Remove orphaned clauses — any extracted clause whose parent lease is gone
        const leaseIds = new Set(loadedLeases.map(l => l.id));
        const cleaned  = loadedClauses.filter(
          c => !c.sourceLeaseId || leaseIds.has(c.sourceLeaseId),
        );
        setUserClauses(cleaned);
        if (cleaned.length !== loadedClauses.length) {
          await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(cleaned));
        }

        // Background server sync — does not block the UI
        syncFromServer(loadedLeases, cleaned).catch(() => {});
      } catch { /* non-critical */ }
    })();
  }, []);

  async function syncFromServer(localLeases: Lease[], localClauses: Clause[]) {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;

      const res = await fetch(`${API_BASE}/api/seller/leases`, { headers });
      if (!res.ok) return;

      const body: { leases: Lease[]; clauses: Clause[] } = await res.json();
      const { leases: serverLeases, clauses: serverClauses } = body;

      // First-launch migration: server is empty but local has data → push everything up.
      // Use sequential awaited calls so clause saves always land after their parent lease.
      if (serverLeases.length === 0 && localLeases.length > 0) {
        for (const lease of localLeases) {
          try {
            const migrateHeaders = await getAuthHeaders();
            if (!migrateHeaders) break;
            await fetch(`${API_BASE}/api/seller/leases`, {
              method: 'POST',
              headers: migrateHeaders,
              body: JSON.stringify({ lease }),
            });
            const leaseClauses = localClauses.filter(c => c.sourceLeaseId === lease.id);
            if (leaseClauses.length) {
              await fetch(`${API_BASE}/api/seller/leases/${lease.id}/clauses`, {
                method: 'POST',
                headers: migrateHeaders,
                body: JSON.stringify({ clauses: leaseClauses }),
              });
            }
          } catch { /* skip this lease, try next */ }
        }
        return;
      }

      // Normal merge: server is authoritative; keep any local leases server doesn't have
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

  // ─── Mutations ─────────────────────────────────────────────────────────────

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
