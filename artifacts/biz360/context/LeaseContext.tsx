import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clause, DraftLease, Lease } from './leaseTypes';
import { LEASE_SEED_CLAUSES } from '@/data/leaseSeedClauses';

const LEASES_KEY = 'biz360_lease_leases';
const CLAUSES_KEY = 'biz360_lease_clauses';
const DRAFTS_KEY = 'biz360_lease_drafts';

interface LeaseContextValue {
  leases: Lease[];
  clauses: Clause[];
  drafts: DraftLease[];
  addLease: (lease: Lease) => Promise<void>;
  updateLease: (id: string, updates: Partial<Lease>) => Promise<void>;
  deleteLease: (id: string) => Promise<void>;
  addClause: (clause: Clause) => Promise<void>;
  addDraft: (draft: DraftLease) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
}

const LeaseContext = createContext<LeaseContextValue | null>(null);

export function LeaseProvider({ children }: { children: React.ReactNode }) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [userClauses, setUserClauses] = useState<Clause[]>([]);
  const [drafts, setDrafts] = useState<DraftLease[]>([]);

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
    const next = [lease, ...leases];
    setLeases(next);
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(next));
  }

  async function updateLease(id: string, updates: Partial<Lease>) {
    const next = leases.map(l => l.id === id ? { ...l, ...updates } : l);
    setLeases(next);
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(next));
  }

  async function deleteLease(id: string) {
    const next = leases.filter(l => l.id !== id);
    setLeases(next);
    await AsyncStorage.setItem(LEASES_KEY, JSON.stringify(next));
  }

  async function addClause(clause: Clause) {
    const next = [clause, ...userClauses.filter(c => c.id !== clause.id)];
    setUserClauses(next);
    await AsyncStorage.setItem(CLAUSES_KEY, JSON.stringify(next));
  }

  async function addDraft(draft: DraftLease) {
    const next = [draft, ...drafts];
    setDrafts(next);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  }

  async function deleteDraft(id: string) {
    const next = drafts.filter(d => d.id !== id);
    setDrafts(next);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  }

  return (
    <LeaseContext.Provider value={{ leases, clauses, drafts, addLease, updateLease, deleteLease, addClause, addDraft, deleteDraft }}>
      {children}
    </LeaseContext.Provider>
  );
}

export function useLease() {
  const ctx = useContext(LeaseContext);
  if (!ctx) throw new Error('useLease must be used within LeaseProvider');
  return ctx;
}
