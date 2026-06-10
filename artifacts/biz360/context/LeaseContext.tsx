import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clause, DraftLease, Lease } from './leaseTypes';
import { LEASE_SEED_CLAUSES } from '@/data/leaseSeedClauses';

const LEASES_KEY  = 'biz360_lease_leases';
const CLAUSES_KEY = 'biz360_lease_clauses';
const DRAFTS_KEY  = 'biz360_lease_drafts';

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
  deleteDraft:  (id: string) => Promise<void>;
}

const LeaseContext = createContext<LeaseContextValue | null>(null);

export function LeaseProvider({ children }: { children: React.ReactNode }) {
  const [leases,      setLeases]      = useState<Lease[]>([]);
  const [userClauses, setUserClauses] = useState<Clause[]>([]);
  const [drafts,      setDrafts]      = useState<DraftLease[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [lRaw, cRaw, dRaw] = await Promise.all([
          AsyncStorage.getItem(LEASES_KEY),
          AsyncStorage.getItem(CLAUSES_KEY),
          AsyncStorage.getItem(DRAFTS_KEY),
        ]);
        if (lRaw) setLeases(JSON.parse(lRaw));
        if (cRaw) setUserClauses(JSON.parse(cRaw));
        if (dRaw) setDrafts(JSON.parse(dRaw));
      } catch { /* non-critical */ }
    })();
  }, []);

  const clauses: Clause[] = [
    ...LEASE_SEED_CLAUSES,
    ...userClauses.filter(c => !LEASE_SEED_CLAUSES.some(s => s.id === c.id)),
  ];

  async function addLease(lease: Lease) {
    let saved: Lease[] = [];
    setLeases(prev => {
      saved = [lease, ...prev];
      return saved;
    });
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(saved));
  }

  async function updateLease(id: string, updates: Partial<Lease>) {
    let saved: Lease[] = [];
    setLeases(prev => {
      saved = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      return saved;
    });
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(saved));
  }

  async function deleteLease(id: string) {
    let savedLeases: Lease[]  = [];
    let savedClauses: Clause[] = [];

    setLeases(prev => {
      savedLeases = prev.filter(l => l.id !== id);
      return savedLeases;
    });
    // Also remove any clauses that were extracted from this lease
    setUserClauses(prev => {
      savedClauses = prev.filter(c => c.sourceLeaseId !== id);
      return savedClauses;
    });

    await Promise.all([
      AsyncStorage.setItem(LEASES_KEY,  JSON.stringify(savedLeases)),
      AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(savedClauses)),
    ]);
  }

  async function addClause(clause: Clause) {
    let saved: Clause[] = [];
    setUserClauses(prev => {
      saved = [clause, ...prev.filter(c => c.id !== clause.id)];
      return saved;
    });
    await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(saved));
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
  }

  async function addDraft(draft: DraftLease) {
    let saved: DraftLease[] = [];
    setDrafts(prev => {
      saved = [draft, ...prev];
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

  return (
    <LeaseContext.Provider value={{
      leases, clauses, drafts,
      addLease, updateLease, deleteLease,
      addClause, addClauses,
      addDraft, deleteDraft,
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
