import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

const SELECTED_CAFE_KEY = "valuation_selected_cafe";
const AUTH_TOKEN_KEY = "biz360_auth_token";
const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

export interface ValCafe {
  id: string; ownerId: string; name: string; city?: string | null;
  businessType?: string | null; currency: string; timezone?: string | null;
  listing_id?: string | null; listingId?: string | null;
  createdAt?: string | null; integrations?: ValIntegration[];
}
export interface ValIntegration {
  id: string; cafeId: string; type: string; status: string;
  merchantName?: string | null; merchantId?: string | null; metadata?: any;
}
export interface ValEquipment {
  id: string; cafeId: string; unitId?: string | null; name: string;
  category?: string | null; brand?: string | null;
  purchaseDate?: string | null; condition?: string | null;
  depreciationYears?: number | null;
  purchasePrice?: string | null; secondhandValue?: string | null;
  replacementCost?: string | null; currentValue?: string | null;
  valuationMode?: string | null; ownership?: string | null;
  notes?: string | null; isLeased?: boolean | null;
  suspended?: boolean | null; createdAt?: string | null;
}
export interface ValAdjustment {
  id: string; cafeId: string; unitId?: string | null; label: string;
  annualAmount: string; type: string; description?: any; createdAt?: string | null;
}
export interface ValSnapshot {
  id: string; cafeId: string; unitId?: string | null;
  snapshotDate?: string | null; periodMonths?: number | null;
  grossRevenue?: string | null; cogs?: string | null; grossProfit?: string | null;
  xeroTotalExpenses?: string | null; xeroTotalRevenue?: string | null;
  ebitda?: string | null; adjustedEbitda?: string | null;
  valuationMidpoint?: string | null; totalEquipmentValue?: string | null;
  squareRevenue?: string | null; xeroRevenue?: string | null;
  isPublished?: boolean | null; createdAt?: string | null;
}
export interface ValUnit {
  id: string; cafeId: string; ownerId: string; name: string;
  revenueSharePct: string; sortOrder: number; createdAt?: string | null;
}
export interface ValLatestSnapshot {
  combined: ValSnapshot | null;
  units: { unit: ValUnit; snapshot: ValSnapshot | null }[];
}

interface ValuationContextType {
  cafes: ValCafe[];
  selectedCafe: ValCafe | null;
  loadingCafes: boolean;
  fetchCafes: () => Promise<ValCafe[]>;
  selectCafe: (cafe: ValCafe) => Promise<void>;
  createCafe: (data: { name: string; city?: string; businessType?: string; listing_id?: string }) => Promise<string | null>;
  equipment: ValEquipment[];
  fetchEquipment: (unitId?: string) => Promise<void>;
  adjustments: ValAdjustment[];
  fetchAdjustments: (unitId?: string) => Promise<void>;
  latestSnapshot: ValLatestSnapshot;
  fetchSnapshot: () => Promise<void>;
  refresh: () => Promise<void>;
  businessUnits: ValUnit[];
  fetchUnits: () => Promise<void>;
  createUnit: (data: { name: string; revenue_share_pct?: number }) => Promise<ValUnit | null>;
  updateUnit: (unitId: string, data: { name?: string; revenue_share_pct?: number; sort_order?: number }) => Promise<void>;
  deleteUnit: (unitId: string) => Promise<void>;
  authToken: string | null;
}

const ValuationContext = createContext<ValuationContextType | null>(null);

export function ValuationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cafes, setCafes] = useState<ValCafe[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<ValCafe | null>(null);
  const [loadingCafes, setLoadingCafes] = useState(false);
  const [equipment, setEquipment] = useState<ValEquipment[]>([]);
  const [adjustments, setAdjustments] = useState<ValAdjustment[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<ValLatestSnapshot>({ combined: null, units: [] });
  const [businessUnits, setBusinessUnits] = useState<ValUnit[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_TOKEN_KEY).then((t) => { if (t) setAuthToken(t); });
  }, [user?.id]);

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };
  }

  const fetchCafes = useCallback(async (): Promise<ValCafe[]> => {
    if (!authToken) return [];
    setLoadingCafes(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes`, { headers: authHeaders() });
      if (res.ok) {
        const data: ValCafe[] = await res.json();
        setCafes(data);
        const savedId = await AsyncStorage.getItem(SELECTED_CAFE_KEY);
        const found = savedId ? data.find((c) => c.id === savedId) : null;
        if (found) { setSelectedCafe(found); }
        else if (data.length > 0) { setSelectedCafe(data[0]); await AsyncStorage.setItem(SELECTED_CAFE_KEY, data[0].id); }
        setLoadingCafes(false);
        return data;
      }
    } catch {}
    setLoadingCafes(false);
    return [];
  }, [authToken]);

  const selectCafe = useCallback(async (cafe: ValCafe) => {
    setSelectedCafe(cafe);
    await AsyncStorage.setItem(SELECTED_CAFE_KEY, cafe.id);
  }, []);

  const createCafe = useCallback(async (data: { name: string; city?: string; businessType?: string; listing_id?: string }): Promise<string | null> => {
    if (!authToken) return "Not authenticated";
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: data.name, city: data.city || "", businessType: data.businessType || "cafe", currency: "AUD", timezone: "Australia/Sydney", listing_id: data.listing_id || null }),
      });
      if (!res.ok) { const err = await res.json(); return err.error || "Failed to create"; }
      await fetchCafes(); return null;
    } catch (e: any) { return e.message || "Network error"; }
  }, [authToken, fetchCafes]);

  const fetchEquipment = useCallback(async (unitId?: string) => {
    if (!authToken || !selectedCafe) return;
    try {
      const url = unitId
        ? `${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment?unit_id=${unitId}`
        : `${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setEquipment(await res.json());
    } catch {}
  }, [authToken, selectedCafe]);

  const fetchAdjustments = useCallback(async (unitId?: string) => {
    if (!authToken || !selectedCafe) return;
    try {
      const url = unitId
        ? `${API_BASE}/api/valuation/cafes/${selectedCafe.id}/adjustments?unit_id=${unitId}`
        : `${API_BASE}/api/valuation/cafes/${selectedCafe.id}/adjustments`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setAdjustments(await res.json());
    } catch {}
  }, [authToken, selectedCafe]);

  const fetchSnapshot = useCallback(async () => {
    if (!authToken || !selectedCafe) return;
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/snapshots/latest`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLatestSnapshot({ combined: data.combined ?? null, units: data.units ?? [] });
      }
    } catch {}
  }, [authToken, selectedCafe]);

  const fetchUnits = useCallback(async () => {
    if (!authToken || !selectedCafe) return;
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/units`, { headers: authHeaders() });
      if (res.ok) setBusinessUnits(await res.json());
    } catch {}
  }, [authToken, selectedCafe]);

  const createUnit = useCallback(async (data: { name: string; revenue_share_pct?: number }): Promise<ValUnit | null> => {
    if (!authToken || !selectedCafe) return null;
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/units`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) { const unit = await res.json(); await fetchUnits(); return unit; }
      return null;
    } catch { return null; }
  }, [authToken, selectedCafe, fetchUnits]);

  const updateUnit = useCallback(async (unitId: string, data: { name?: string; revenue_share_pct?: number; sort_order?: number }) => {
    if (!authToken || !selectedCafe) return;
    try {
      await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/units/${unitId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      await fetchUnits();
    } catch {}
  }, [authToken, selectedCafe, fetchUnits]);

  const deleteUnit = useCallback(async (unitId: string) => {
    if (!authToken || !selectedCafe) return;
    try {
      await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/units/${unitId}`, { method: "DELETE", headers: authHeaders() });
      await fetchUnits();
    } catch {}
  }, [authToken, selectedCafe, fetchUnits]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchEquipment(), fetchAdjustments(), fetchSnapshot(), fetchUnits()]);
  }, [fetchEquipment, fetchAdjustments, fetchSnapshot, fetchUnits]);

  useEffect(() => {
    if (authToken) fetchCafes();
    else { setCafes([]); setSelectedCafe(null); }
  }, [authToken]);

  useEffect(() => {
    if (selectedCafe) { fetchEquipment(); fetchAdjustments(); fetchSnapshot(); fetchUnits(); }
  }, [selectedCafe?.id]);

  return (
    <ValuationContext.Provider value={{
      cafes, selectedCafe, loadingCafes, fetchCafes, selectCafe, createCafe,
      equipment, fetchEquipment, adjustments, fetchAdjustments,
      latestSnapshot, fetchSnapshot, refresh,
      businessUnits, fetchUnits, createUnit, updateUnit, deleteUnit,
      authToken,
    }}>
      {children}
    </ValuationContext.Provider>
  );
}

export function useValuation() {
  const ctx = useContext(ValuationContext);
  if (!ctx) throw new Error("useValuation must be used inside ValuationProvider");
  return ctx;
}
