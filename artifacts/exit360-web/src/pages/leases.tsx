import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, UploadCloud, BookOpen, Edit3, FileText, Copy, Plus, Star, Cpu,
  CheckCircle2, AlertCircle, Loader2, Search, X, Trash2, FilePlus, Check,
  ChevronRight, Cloud, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { LEASE_SEED_CLAUSES, type Clause } from "@/lib/leaseSeed";

const TOKEN_KEY = "biz360_web_auth_token";

// ─── Types (mirrors app leaseTypes) ──────────────────────────────────────────
type AnalysisStatus = "pending" | "analysing" | "complete" | "failed";
interface Lease {
  id: string; name: string; uploadDate: string; status: AnalysisStatus;
  fileType: "pdf" | "docx"; jurisdiction?: string; leaseType?: string;
  parties?: { tenant?: string; landlord?: string }; premises?: string;
  term?: string; rentAmount?: string; clauseCount?: number; extractedClauseIds?: string[];
}
interface DraftSection { id: string; title: string; content: string; type: string; }
interface DraftLease {
  id: string; name: string; createdAt: string; jurisdiction: string; leaseType: string;
  premisesType: string; position: string; rentStructure: string; outgoingsStructure: string;
  licenceAreas: string[]; selectedProtections: string[]; sections: DraftSection[];
}

const LEASES_KEY = "biz360_web_lease_leases";
const CLAUSES_KEY = "biz360_web_lease_clauses";
const DRAFTS_KEY = "biz360_web_lease_drafts";

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const RISK_COLORS: Record<string, string> = {
  critical: "#FCA5A5", high: "#FCD34D", medium: "#93C5FD", low: "#86EFAC",
};
const RATING_LABEL: Record<string, string> = {
  "tenant-friendly": "Favourable", "landlord-friendly": "Unfavourable", balanced: "Balanced",
};
const RATING_COLORS: Record<string, string> = {
  "tenant-friendly": "#86EFAC", "landlord-friendly": "#FCA5A5", balanced: "#C4B5FD",
};

function genId() { return Date.now().toString() + Math.random().toString(36).substring(2, 9); }
function readLS<T>(k: string, fb: T): T { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

const CATEGORIES = [
  "All", "Rent & Outgoings", "Lease Term & Options", "Use & Exclusivity",
  "Assignment & Subletting", "Make-Good", "Services & Infrastructure",
  "Signage & Marketing", "Rent Review", "Termination & Security",
  "Licence Areas", "Incentives", "Rent Commencement",
];
const RISK_FILTERS = ["all", "critical", "high", "medium", "low"];
const RATING_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" }, { label: "Favourable", value: "tenant-friendly" },
  { label: "Balanced", value: "balanced" }, { label: "Unfav.", value: "landlord-friendly" },
];

// ─── Root ─────────────────────────────────────────────────────────────────────
export function Leases() {
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const authHeaders = useMemo(
    () => (token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : null),
    [token]
  );

  const [leases, setLeases] = useState<Lease[]>(() => readLS<Lease[]>(LEASES_KEY, []));
  const [userClauses, setUserClauses] = useState<Clause[]>(() => readLS<Clause[]>(CLAUSES_KEY, []));
  const [drafts, setDrafts] = useState<DraftLease[]>(() => readLS<DraftLease[]>(DRAFTS_KEY, []));
  const [serverClauses, setServerClauses] = useState<Clause[]>([]);
  const [view, setView] = useState<{ name: string; leaseId?: string; draftId?: string }>({ name: "hub" });

  // ── Server sync (leases + clauses are user-scoped on the server) ──
  const syncFromServer = useCallback(async () => {
    if (!authHeaders) return;
    try {
      const res = await fetch("/api/seller/leases", { headers: authHeaders });
      if (!res.ok) return;
      const body = await res.json() as { leases: Lease[]; clauses: Clause[] };
      const localLeases = readLS<Lease[]>(LEASES_KEY, []);
      const localClauses = readLS<Clause[]>(CLAUSES_KEY, []);
      // First-run migration: push local up if server empty
      if ((body.leases?.length ?? 0) === 0 && localLeases.length > 0) {
        for (const lease of localLeases) {
          try {
            await fetch("/api/seller/leases", { method: "POST", headers: authHeaders, body: JSON.stringify({ lease }) });
            const lc = localClauses.filter(c => c.sourceLeaseId === lease.id);
            if (lc.length) await fetch(`/api/seller/leases/${lease.id}/clauses`, { method: "POST", headers: authHeaders, body: JSON.stringify({ clauses: lc }) });
          } catch { /* next */ }
        }
        return;
      }
      const srvLeaseIds = new Set((body.leases ?? []).map(l => l.id));
      const srvClauseIds = new Set((body.clauses ?? []).map(c => c.id));
      const mergedLeases = [...(body.leases ?? []), ...localLeases.filter(l => !srvLeaseIds.has(l.id))];
      const mergedClauses = [...(body.clauses ?? []), ...localClauses.filter(c => !srvClauseIds.has(c.id))];
      setLeases(mergedLeases); writeLS(LEASES_KEY, mergedLeases);
      setUserClauses(mergedClauses); writeLS(CLAUSES_KEY, mergedClauses);
    } catch { /* offline */ }
  }, [authHeaders]);

  useEffect(() => { syncFromServer(); }, [syncFromServer]);

  // Community/master clause library (public endpoint)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/lease-clauses");
        if (!r.ok) return;
        const d = await r.json() as { clauses: Record<string, unknown>[] };
        if (Array.isArray(d.clauses)) setServerClauses(d.clauses.map(rowToClause));
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Mutations ──
  const saveLease = useCallback((lease: Lease) => {
    if (!authHeaders) return;
    fetch("/api/seller/leases", { method: "POST", headers: authHeaders, body: JSON.stringify({ lease }) }).catch(() => {});
  }, [authHeaders]);

  const saveClauses = useCallback((leaseId: string, clauses: Clause[], attempt = 0) => {
    if (!authHeaders || !clauses.length) return;
    fetch(`/api/seller/leases/${leaseId}/clauses`, { method: "POST", headers: authHeaders, body: JSON.stringify({ clauses }) })
      .then(res => { if (res.status === 409 && attempt < 3) setTimeout(() => saveClauses(leaseId, clauses, attempt + 1), 2000 * (attempt + 1)); })
      .catch(() => {});
  }, [authHeaders]);

  const addLease = useCallback((lease: Lease) => {
    setLeases(prev => { const next = [lease, ...prev]; writeLS(LEASES_KEY, next); return next; });
    saveLease(lease);
  }, [saveLease]);

  const updateLease = useCallback((id: string, updates: Partial<Lease>) => {
    setLeases(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      writeLS(LEASES_KEY, next);
      const u = next.find(l => l.id === id); if (u) saveLease(u);
      return next;
    });
  }, [saveLease]);

  const deleteLease = useCallback((id: string) => {
    setLeases(prev => { const next = prev.filter(l => l.id !== id); writeLS(LEASES_KEY, next); return next; });
    setUserClauses(prev => { const next = prev.filter(c => c.sourceLeaseId !== id); writeLS(CLAUSES_KEY, next); return next; });
    if (authHeaders) fetch(`/api/seller/leases/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => {});
  }, [authHeaders]);

  const addClauses = useCallback((incoming: Clause[]) => {
    if (!incoming.length) return;
    setUserClauses(prev => {
      const ids = new Set(incoming.map(c => c.id));
      const next = [...incoming, ...prev.filter(c => !ids.has(c.id))];
      writeLS(CLAUSES_KEY, next); return next;
    });
    const byLease = new Map<string, Clause[]>();
    for (const c of incoming) if (c.sourceLeaseId) { const g = byLease.get(c.sourceLeaseId) ?? []; g.push(c); byLease.set(c.sourceLeaseId, g); }
    byLease.forEach((g, lid) => saveClauses(lid, g));
  }, [saveClauses]);

  const addDraft = useCallback((d: DraftLease) => {
    setDrafts(prev => { const next = [d, ...prev]; writeLS(DRAFTS_KEY, next); return next; });
  }, []);
  const deleteDraft = useCallback((id: string) => {
    setDrafts(prev => { const next = prev.filter(d => d.id !== id); writeLS(DRAFTS_KEY, next); return next; });
  }, []);

  // Full clause list = seeds + community (unique by title) + user extracted
  const allClauses = useMemo(() => {
    const seedTitles = new Set(LEASE_SEED_CLAUSES.map(s => s.title.toLowerCase()));
    const seedIds = new Set(LEASE_SEED_CLAUSES.map(s => s.id));
    const community = serverClauses.filter(c => !seedTitles.has(c.title.toLowerCase()));
    const extracted = userClauses.filter(c => !seedIds.has(c.id) && !c.isSeed);
    return [...LEASE_SEED_CLAUSES, ...community, ...extracted];
  }, [serverClauses, userClauses]);

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-20 text-center">
        <Seo title="Leases · EXIT360" />
        <p className="mb-3 text-muted-foreground">Please sign in to access your lease workspace.</p>
        <Link href="/seller"><Button className="theme-btn-gradient border-0">Seller dashboard</Button></Link>
      </div>
    );
  }

  const shared = { leases, drafts, allClauses, userClauses, serverClauses, setView };

  return (
    <div className="min-h-screen">
      <Seo title="Leases · EXIT360" description="AI-powered commercial lease analysis, clause library, and lease builder." />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-24">
        {view.name === "hub" && (
          <Hub {...shared} deleteLease={deleteLease} />
        )}
        {view.name === "upload" && (
          <Upload authHeaders={authHeaders} addLease={addLease} updateLease={updateLease} addClauses={addClauses} setView={setView} />
        )}
        {view.name === "library" && (
          <Library allClauses={allClauses} serverClauses={serverClauses} scopedLeaseId={view.leaseId} leases={leases} setView={setView} />
        )}
        {view.name === "detail" && view.leaseId && (
          <Detail leaseId={view.leaseId} leases={leases} allClauses={allClauses} addDraft={addDraft} setView={setView} />
        )}
        {view.name === "builder" && (
          <Builder addDraft={addDraft} setView={setView} />
        )}
        {view.name === "drafts" && (
          <Drafts drafts={drafts} draftId={view.draftId} deleteDraft={deleteDraft} setView={setView} />
        )}
        {view.name === "templates" && (
          <Templates authHeaders={authHeaders} setView={setView} />
        )}
      </div>
    </div>
  );
}

function rowToClause(row: Record<string, unknown>): Clause {
  return {
    id: String(row.id ?? ""), title: String(row.title ?? ""), category: String(row.category ?? "Other"),
    rating: (row.rating as Clause["rating"]) ?? "balanced", riskLevel: (row.riskLevel as Clause["riskLevel"]) ?? "medium",
    plainEnglish: String(row.plainEnglish ?? ""), originalText: String(row.originalText ?? ""),
    suggestedText: row.suggestedText ? String(row.suggestedText) : undefined,
    jurisdictions: row.jurisdiction ? [String(row.jurisdiction)] : [],
    cafeRelevanceScore: Number(row.cafeRelevanceScore ?? 3), negotiationScore: Number(row.negotiationScore ?? 3),
    isSeed: Boolean(row.isSeed ?? false),
  };
}

// ─── Shared UI bits ───────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const c = RISK_COLORS[level] ?? "#93C5FD";
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize"
    style={{ color: c, borderColor: c + "66", background: c + "1a" }}>{level}</span>;
}
function RatingBadge({ rating }: { rating: string }) {
  const c = RATING_COLORS[rating] ?? "#C4B5FD";
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
    style={{ color: c, borderColor: c + "66", background: c + "1a" }}>{RATING_LABEL[rating] ?? rating}</span>;
}
function Stat({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
function BackHeader({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted/60 transition"><ArrowLeft size={20} /></button>
      <div className="min-w-0">
        <h1 className="text-xl font-bold truncate">{title}</h1>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
function ClauseCard({ clause, onClick }: { clause: Clause; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 transition p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="font-semibold text-sm leading-snug">{clause.title}</h3>
        <div className="flex gap-1.5 shrink-0"><RiskBadge level={clause.riskLevel} /></div>
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground">{clause.category}</span>
        <RatingBadge rating={clause.rating} />
        {clause.isSeed && <span className="text-[10px] text-amber-300 flex items-center gap-1"><Star size={9} /> Template</span>}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{clause.plainEnglish}</p>
    </button>
  );
}

// ─── Hub ────────────────────────────────────────────────────────────────────
const ACTIONS = [
  { icon: UploadCloud, label: "Upload & Analyse", view: "upload", color: "#3B82F6", bg: "#1E3A5C" },
  { icon: BookOpen, label: "Clause Library", view: "library", color: "#8B5CF6", bg: "#2D1B69" },
  { icon: Edit3, label: "Lease Builder", view: "builder", color: "#F59E0B", bg: "#431407" },
  { icon: FileText, label: "My Drafts", view: "drafts", color: "#16A34A", bg: "#052E16" },
  { icon: Copy, label: "Templates", view: "templates", color: "#EC4899", bg: "#4A0020" },
];

function Hub({ leases, drafts, allClauses, setView, deleteLease }: any) {
  const existingIds = new Set(leases.map((l: Lease) => l.id));
  const userClauseCount = allClauses.filter((c: Clause) => !c.isSeed && !!c.sourceLeaseId && existingIds.has(c.sourceLeaseId!)).length;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold theme-text-gradient">Leases</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered lease analysis &amp; negotiation tools</p>
        </div>
        <Button onClick={() => setView({ name: "upload" })} className="theme-btn-gradient border-0 gap-1.5"><Plus size={16} /> Upload</Button>
      </div>

      <div className="flex rounded-2xl border border-border bg-card p-4 mb-4">
        <Stat value={leases.length} label="Leases" />
        <div className="w-px bg-border" />
        <Stat value={userClauseCount} label="Clauses" color="#93C5FD" />
        <div className="w-px bg-border" />
        <Stat value={drafts.length} label="Drafts" color="#86EFAC" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {ACTIONS.map(a => (
          <button key={a.label} onClick={() => setView({ name: a.view })}
            className="rounded-2xl border p-4 text-left transition hover:brightness-110"
            style={{ background: a.bg, borderColor: a.color + "40" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5" style={{ background: a.color + "22" }}>
              <a.icon size={20} color={a.color} />
            </div>
            <div className="text-sm font-semibold text-white">{a.label}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border p-4 mb-5" style={{ background: "#0F1F35", borderColor: "#1E3A5C" }}>
        <div className="flex items-center gap-1.5 mb-1"><Star size={13} color="#F59E0B" /><span className="text-[11px] font-semibold" style={{ color: "#F59E0B" }}>Clause of the Day</span></div>
        <h3 className="font-bold text-white mb-1">Café Exclusivity Clause</h3>
        <p className="text-[13px] leading-relaxed" style={{ color: "#8B9CB8" }}>Prevents the landlord from leasing any other space to a competing café. Critical for protecting foot traffic in office buildings and shopping centres.</p>
        <button onClick={() => setView({ name: "library" })} className="text-[13px] font-semibold mt-2" style={{ color: "#3B82F6" }}>View in Library →</button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">My Leases</h2>
        {leases.length > 0 && <span className="text-sm text-muted-foreground">{leases.length}</span>}
      </div>

      {leases.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <UploadCloud size={30} className="mx-auto mb-3" color="#3B82F6" />
          <h3 className="font-semibold mb-1.5">No leases yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">Upload a PDF or Word lease document and our AI will analyse it for risks, tenant protections, and improvement suggestions.</p>
          <Button onClick={() => setView({ name: "upload" })} className="theme-btn-gradient border-0">Upload Lease</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {leases.map((lease: Lease) => (
            <div key={lease.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <button onClick={() => setView({ name: "detail", leaseId: lease.id })} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText size={15} className="text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{lease.name}</span>
                  <LeaseStatusPill status={lease.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {lease.fileType?.toUpperCase()}{lease.jurisdiction ? ` · ${lease.jurisdiction}` : ""}
                  {lease.leaseType ? ` · ${lease.leaseType}` : ""}
                  {typeof lease.clauseCount === "number" ? ` · ${lease.clauseCount} clauses` : ""}
                </p>
              </button>
              <button onClick={() => { if (confirm("Remove this lease and its analysis?")) deleteLease(lease.id); }}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 size={15} /></button>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="text-lg font-bold">Recent Drafts</h2>
            <button onClick={() => setView({ name: "drafts" })} className="text-sm text-primary">See all</button>
          </div>
          <div className="space-y-3">
            {drafts.slice(0, 3).map((d: DraftLease) => (
              <button key={d.id} onClick={() => setView({ name: "drafts", draftId: d.id })}
                className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 text-left hover:border-primary/50 transition">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#052E16" }}><Edit3 size={16} color="#16A34A" /></div>
                <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">{d.jurisdiction} · {new Date(d.createdAt).toLocaleDateString("en-AU")}</div></div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      )}

      <Disclaimer />
    </>
  );
}

function LeaseStatusPill({ status }: { status: AnalysisStatus }) {
  if (status === "complete") return null;
  const map: Record<string, { t: string; c: string }> = {
    analysing: { t: "Analysing", c: "#FCD34D" }, pending: { t: "Pending", c: "#93C5FD" }, failed: { t: "Failed", c: "#FCA5A5" },
  };
  const m = map[status]; if (!m) return null;
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: m.c, background: m.c + "1a" }}>{m.t}</span>;
}

// ─── Upload & Analyse ─────────────────────────────────────────────────────────
const POLL_INTERVAL = 4000;
const POLL_TIMEOUT = 5 * 60 * 1000;

function Upload({ authHeaders, addLease, updateLease, addClauses, setView }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analysing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStart = useRef(0);
  const leaseIdRef = useRef("");

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  const handleError = (msg: string) => {
    setErrorMsg(msg); setStatus("error");
    if (leaseIdRef.current) updateLease(leaseIdRef.current, { status: "failed" });
  };

  const pollStatus = useCallback(async (jobId: string) => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (Date.now() - pollStart.current > POLL_TIMEOUT) { handleError("Analysis is taking too long. Please try again."); return; }
    try {
      const resp = await fetch(`/api/lease-analysis/status/${jobId}`, { headers: authHeaders });
      if (!resp.ok) { handleError(`Server error (${resp.status})`); return; }
      const body = await resp.json() as { status: string; data?: any; error?: string };
      if (body.status === "pending") { pollTimer.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL); return; }
      if (body.status === "failed") { handleError(body.error ?? "Analysis failed"); return; }
      const data = body.data ?? {};
      const leaseId = leaseIdRef.current;
      const built: Clause[] = (data.clauses ?? []).map((c: any) => ({
        id: genId(), title: c.title ?? "Untitled Clause", category: c.category ?? "Other",
        rating: c.rating ?? "balanced", riskLevel: c.riskLevel ?? "medium", plainEnglish: c.plainEnglish ?? "",
        originalText: c.originalText ?? "", suggestedText: c.suggestedText,
        jurisdictions: data.jurisdiction ? [data.jurisdiction] : [],
        cafeRelevanceScore: c.cafeRelevanceScore ?? 3, negotiationScore: c.negotiationScore ?? 3,
        sourceLeaseId: leaseId, isSeed: false,
      }));
      const clauseIds = built.map(c => c.id);
      if (built.length) addClauses(built);
      updateLease(leaseId, {
        status: "complete", jurisdiction: data.jurisdiction, leaseType: data.leaseType,
        parties: data.parties, premises: data.premises, term: data.term, rentAmount: data.rentAmount,
        clauseCount: clauseIds.length, extractedClauseIds: clauseIds,
      });
      setStatus("done");
      setTimeout(() => setView({ name: "detail", leaseId }), 1000);
    } catch { pollTimer.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL); }
  }, [authHeaders, addClauses, updateLease, setView]);

  const analyse = async () => {
    if (!file) return;
    const leaseId = genId(); leaseIdRef.current = leaseId;
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    addLease({ id: leaseId, name: file.name.replace(/\.[^.]+$/, ""), uploadDate: new Date().toISOString(), status: "analysing", fileType: isPdf ? "pdf" : "docx" });
    setStatus("uploading");
    try {
      const fd = new FormData(); fd.append("file", file, file.name);
      setStatus("analysing");
      const resp = await fetch("/api/lease-analysis", { method: "POST", headers: { Authorization: authHeaders.Authorization }, body: fd });
      if (!resp.ok) { const e = await resp.json().catch(() => ({ error: "Upload failed" })); throw new Error(e?.error ?? `HTTP ${resp.status}`); }
      const { jobId } = await resp.json() as { jobId: string };
      if (!jobId) throw new Error("Server did not return a job ID");
      pollStart.current = Date.now();
      pollTimer.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL);
    } catch (err) { handleError(err instanceof Error ? err.message : "Upload failed"); }
  };

  const isLoading = status === "uploading" || status === "analysing";

  return (
    <>
      <BackHeader title="Upload Lease" sub="PDF or DOCX recommended · Max 20MB" onBack={() => setView({ name: "hub" })} />
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setStatus("idle"); setErrorMsg(""); } }} />

      <button onClick={() => !isLoading && fileInputRef.current?.click()} disabled={isLoading}
        className="w-full rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-2.5 transition"
        style={{ borderColor: file ? "#3B82F6" : "hsl(var(--border))", background: file ? "#1E3A5C" : "hsl(var(--card))" }}>
        {file ? <FileText size={40} color="#3B82F6" /> : <UploadCloud size={40} className="text-muted-foreground" />}
        {file ? (<><span className="text-sm font-semibold text-center" style={{ color: "#3B82F6" }}>{file.name}</span>
          <span className="text-xs text-muted-foreground">Click to change file</span></>)
          : (<><span className="font-semibold">Choose Lease Document</span><span className="text-xs text-muted-foreground">PDF or Word document</span></>)}
      </button>

      <div className="rounded-2xl border p-4 mt-4" style={{ background: "#0F1F35", borderColor: "#1E3A5C" }}>
        <h3 className="text-sm font-semibold text-white mb-2">What the AI analyses</h3>
        {["Rent, outgoings, CPI escalation terms", "Lease options and renewal rights", "Exclusivity and permitted use restrictions",
          "Make-good and handback obligations", "Assignment and subletting rights", "Landlord's works and disruption clauses",
          "Special conditions and red flags"].map(t => (
          <div key={t} className="flex items-center gap-2 py-0.5"><Check size={12} color="#16A34A" /><span className="text-xs" style={{ color: "#8B9CB8" }}>{t}</span></div>
        ))}
      </div>

      {status === "uploading" && <StatusCard bg="#1E3A5C" icon={<Loader2 className="animate-spin" size={20} color="#3B82F6" />} text="Uploading document…" tcolor="#93C5FD" />}
      {status === "analysing" && <StatusCard bg="#1E3A5C" icon={<Loader2 className="animate-spin" size={20} color="#F59E0B" />} text="AI is analysing your lease…" tcolor="#FCD34D" sub="Large documents can take 2–3 minutes" />}
      {status === "done" && <StatusCard bg="#052E16" icon={<CheckCircle2 size={22} color="#16A34A" />} text="Analysis complete! Opening results…" tcolor="#86EFAC" />}
      {status === "error" && <StatusCard bg="#7F1D1D" icon={<AlertCircle size={22} color="#FCA5A5" />} text="Analysis failed" tcolor="#FCA5A5" sub={errorMsg} />}

      <button onClick={analyse} disabled={!file || isLoading}
        className="w-full rounded-2xl p-4 mt-4 flex items-center justify-center gap-2.5 font-semibold transition disabled:opacity-60"
        style={{ background: file && !isLoading ? "#2563EB" : "#1E3A5C", color: file ? "#fff" : "#6B7280" }}>
        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Cpu size={18} /> Analyse with AI</>}
      </button>
      <Disclaimer text="Your lease is processed securely. Always seek independent legal advice before signing or negotiating." />
    </>
  );
}

function StatusCard({ bg, icon, text, tcolor, sub }: any) {
  return (
    <div className="rounded-2xl p-4 mt-4 flex flex-col items-center gap-2 text-center" style={{ background: bg }}>
      {icon}<span className="text-sm font-semibold" style={{ color: tcolor }}>{text}</span>
      {sub && <span className="text-xs" style={{ color: tcolor }}>{sub}</span>}
    </div>
  );
}

// ─── Lease Detail ─────────────────────────────────────────────────────────────
function Detail({ leaseId, leases, allClauses, addDraft, setView }: any) {
  const [building, setBuilding] = useState(false);
  const lease: Lease | undefined = leases.find((l: Lease) => l.id === leaseId);
  const leaseClauses = useMemo(() => {
    if (!lease?.extractedClauseIds?.length) return [] as Clause[];
    return allClauses.filter((c: Clause) => lease.extractedClauseIds!.includes(c.id))
      .sort((a: Clause, b: Clause) => (RISK_ORDER[a.riskLevel] ?? 3) - (RISK_ORDER[b.riskLevel] ?? 3));
  }, [allClauses, lease]);
  const [openClause, setOpenClause] = useState<Clause | null>(null);

  if (!lease) return (
    <div className="text-center py-20"><AlertCircle size={32} className="mx-auto text-muted-foreground mb-2" />
      <p className="text-muted-foreground">Lease not found</p>
      <button onClick={() => setView({ name: "hub" })} className="text-primary mt-3 font-semibold">Go back</button></div>
  );

  const critical = leaseClauses.filter((c: Clause) => c.riskLevel === "critical").length;
  const high = leaseClauses.filter((c: Clause) => c.riskLevel === "high").length;
  const tenantFav = leaseClauses.filter((c: Clause) => c.rating === "tenant-friendly");

  const buildDraft = () => {
    if (!tenantFav.length) { alert("This lease has no tenant-friendly clauses to add to a draft."); return; }
    setBuilding(true);
    try {
      const sections: DraftSection[] = [];
      const byCat = tenantFav.reduce<Record<string, Clause[]>>((acc, c) => { const k = c.category ?? "Other"; (acc[k] ??= []).push(c); return acc; }, {});
      for (const [cat, cs] of Object.entries(byCat)) {
        sections.push({ id: genId(), title: cat, type: "tenant-protections",
          content: cs.map(c => `${c.title.toUpperCase()}\n${c.suggestedText ?? c.originalText}\n\n[Risk: ${c.riskLevel} · Negotiation score: ${c.negotiationScore}/5]`).join("\n\n---\n\n") });
      }
      const redFlags = leaseClauses.filter((c: Clause) => c.rating === "landlord-friendly" && (c.riskLevel === "critical" || c.riskLevel === "high"));
      if (redFlags.length) sections.push({ id: genId(), title: "Red Flags — Landlord Clauses to Negotiate", type: "red-flags",
        content: redFlags.map((c: Clause) => `${c.title.toUpperCase()}\n${c.plainEnglish}${c.suggestedText ? `\n\nSuggested replacement:\n${c.suggestedText}` : ""}`).join("\n\n---\n\n") });
      sections.push({ id: genId(), title: "Lease Summary", type: "summary",
        content: [lease.parties?.tenant ? `Tenant:     ${lease.parties.tenant}` : null, lease.parties?.landlord ? `Landlord:   ${lease.parties.landlord}` : null,
          lease.premises ? `Premises:   ${lease.premises}` : null, lease.term ? `Term:       ${lease.term}` : null, lease.rentAmount ? `Rent:       ${lease.rentAmount}` : null,
          `\nExtracted ${tenantFav.length} favourable clause${tenantFav.length !== 1 ? "s" : ""} · ${redFlags.length} red flag${redFlags.length !== 1 ? "s" : ""}.`].filter(Boolean).join("\n") });
      const draftId = genId();
      addDraft({ id: draftId, name: `Draft from ${lease.name}`, createdAt: new Date().toISOString(),
        jurisdiction: lease.jurisdiction ?? "NSW", leaseType: lease.leaseType ?? "commercial", premisesType: "cafe",
        position: "tenant-friendly", rentStructure: lease.rentAmount ?? "", outgoingsStructure: "", licenceAreas: [], selectedProtections: [], sections });
      setView({ name: "drafts", draftId });
    } finally { setBuilding(false); }
  };

  return (
    <>
      <BackHeader title={lease.name} sub={`${lease.fileType?.toUpperCase()}${lease.jurisdiction ? ` · ${lease.jurisdiction}` : ""}${lease.leaseType ? ` · ${lease.leaseType}` : ""}`} onBack={() => setView({ name: "hub" })} />

      {(lease.parties?.tenant || lease.parties?.landlord || lease.premises || lease.term || lease.rentAmount) && (
        <div className="rounded-2xl border p-4 mb-3 space-y-2" style={{ background: "#0F1F35", borderColor: "#1E3A5C" }}>
          {lease.parties?.tenant && <SummaryRow k="Tenant" v={lease.parties.tenant} />}
          {lease.parties?.landlord && <SummaryRow k="Landlord" v={lease.parties.landlord} />}
          {lease.premises && <SummaryRow k="Premises" v={lease.premises} />}
          {lease.term && <SummaryRow k="Term" v={lease.term} />}
          {lease.rentAmount && <SummaryRow k="Rent" v={lease.rentAmount} vcolor="#93C5FD" />}
        </div>
      )}

      <div className="flex rounded-2xl border p-4 mb-3" style={{ background: "#0F1F35", borderColor: "#1E3A5C" }}>
        <Stat value={critical} label="Critical" color="#FCA5A5" /><div className="w-px" style={{ background: "#1E3A5C" }} />
        <Stat value={high} label="High Risk" color="#FCD34D" /><div className="w-px" style={{ background: "#1E3A5C" }} />
        <Stat value={tenantFav.length} label="Favourable" color="#86EFAC" /><div className="w-px" style={{ background: "#1E3A5C" }} />
        <Stat value={leaseClauses.length} label="Clauses" />
      </div>

      {tenantFav.length > 0 && (
        <button onClick={buildDraft} disabled={building}
          className="w-full rounded-2xl border p-3.5 mb-3 flex items-center justify-center gap-2.5 font-semibold transition"
          style={{ background: "#16A34A20", borderColor: "#16A34A", color: "#86EFAC" }}>
          {building ? <Loader2 className="animate-spin" size={16} /> : <FilePlus size={16} />}
          {building ? "Creating draft…" : `Build Draft from ${tenantFav.length} Favourable Clause${tenantFav.length !== 1 ? "s" : ""}`}
        </button>
      )}

      <button onClick={() => setView({ name: "library", leaseId })}
        className="w-full rounded-xl border p-3 mb-4 flex items-center justify-center gap-2 text-sm font-medium"
        style={{ background: "#1E3A5C", borderColor: "#3B82F6", color: "#93C5FD" }}>
        <BookOpen size={14} /> {leaseClauses.length > 0 ? `View ${leaseClauses.length} analysed clause${leaseClauses.length !== 1 ? "s" : ""} →` : "View analysed clauses →"}
      </button>

      <h2 className="text-base font-bold mb-3">Analysed Clauses ({leaseClauses.length})</h2>
      {leaseClauses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {lease.status === "analysing" ? "Analysis in progress…" : "No clauses extracted."}
        </div>
      ) : (
        <div className="space-y-3">{leaseClauses.map((c: Clause) => <ClauseCard key={c.id} clause={c} onClick={() => setOpenClause(c)} />)}</div>
      )}

      {openClause && <ClauseModal clause={openClause} onClose={() => setOpenClause(null)} />}
      <Disclaimer />
    </>
  );
}
function SummaryRow({ k, v, vcolor }: { k: string; v: string; vcolor?: string }) {
  return <div className="flex gap-3"><span className="w-20 text-xs font-medium shrink-0" style={{ color: "#8B9CB8" }}>{k}</span>
    <span className="flex-1 text-xs text-white" style={vcolor ? { color: vcolor } : undefined}>{v}</span></div>;
}

// ─── Clause detail modal ──────────────────────────────────────────────────────
function ClauseModal({ clause, onClose }: { clause: Clause; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold">{clause.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-muted-foreground">{clause.category}</span>
          <RiskBadge level={clause.riskLevel} /><RatingBadge rating={clause.rating} />
          <span className="text-[11px] text-muted-foreground">Café relevance {clause.cafeRelevanceScore}/5 · Negotiation {clause.negotiationScore}/5</span>
        </div>
        <Section title="Plain English">{clause.plainEnglish}</Section>
        <Section title="Original clause text">{clause.originalText}</Section>
        {clause.suggestedText && <Section title="Suggested (tenant-favouring) replacement" accent>{clause.suggestedText}</Section>}
      </div>
    </div>
  );
}
function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: accent ? "#86EFAC" : "#8B9CB8" }}>{title}</h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={accent ? { color: "#D1FAE5" } : undefined}>{children}</p>
    </div>
  );
}

// ─── Clause Library ───────────────────────────────────────────────────────────
function Library({ allClauses, serverClauses, scopedLeaseId, leases, setView }: any) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("all");
  const [rating, setRating] = useState("all");
  const [cat, setCat] = useState("All");
  const [onlySeed, setOnlySeed] = useState(false);
  const [open, setOpen] = useState<Clause | null>(null);

  const scopedLease = scopedLeaseId ? leases.find((l: Lease) => l.id === scopedLeaseId) : null;
  const scopedIds: Set<string> | null = scopedLeaseId ? new Set(scopedLease?.extractedClauseIds ?? []) : null;

  const base: Clause[] = scopedIds
    ? allClauses.filter((c: Clause) => !c.isSeed && scopedIds.has(c.id))
    : allClauses;

  const serverCount = serverClauses.filter((c: Clause) => !LEASE_SEED_CLAUSES.some(s => s.title.toLowerCase() === c.title.toLowerCase())).length;

  const filtered = base.filter((c: Clause) => {
    if (onlySeed && !c.isSeed) return false;
    if (risk !== "all" && c.riskLevel !== risk) return false;
    if (rating !== "all" && c.rating !== rating) return false;
    if (cat !== "All" && c.category !== cat) return false;
    if (search) { const q = search.toLowerCase(); if (!c.title.toLowerCase().includes(q) && !c.plainEnglish.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false; }
    return true;
  });

  const chip = (active: boolean, activeC: string, activeBg: string) =>
    ({ borderColor: active ? activeC : "hsl(var(--border))", background: active ? activeBg : "hsl(var(--card))",
       color: active ? activeC : "hsl(var(--muted-foreground))" });

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setView(scopedLeaseId ? { name: "detail", leaseId: scopedLeaseId } : { name: "hub" })} className="p-1.5 rounded-lg hover:bg-muted/60"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{scopedLeaseId ? "Analysed Clauses" : "Clause Library"}</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} of {base.length} clause{base.length !== 1 ? "s" : ""}{scopedLease ? ` from ${scopedLease.name}` : ""}</p>
        </div>
        {!scopedLeaseId && (
          <button onClick={() => setOnlySeed(s => !s)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold"
            style={chip(onlySeed, "#3B82F6", "#1E3A5C")}><Star size={11} /> Templates</button>
        )}
      </div>

      {!scopedLeaseId && serverCount > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 mb-3" style={{ background: "#052E16", borderColor: "#16A34A40" }}>
          <Cloud size={12} color="#16A34A" /><span className="text-[11px]" style={{ color: "#86EFAC" }}>{serverCount} community clause{serverCount !== 1 ? "s" : ""} loaded from shared library</span>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 mb-3">
        <Search size={16} className="text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clauses…" className="flex-1 bg-transparent text-sm outline-none" />
        {search && <button onClick={() => setSearch("")}><X size={14} className="text-muted-foreground" /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
        {RISK_FILTERS.map(f => <button key={f} onClick={() => setRisk(f)} className="px-3 py-1.5 rounded-full border text-xs font-medium capitalize whitespace-nowrap" style={chip(risk === f, "#3B82F6", "#1E3A5C")}>{f}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
        {RATING_FILTERS.map(f => <button key={f.value} onClick={() => setRating(f.value)} className="px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap" style={chip(rating === f.value, "#8B5CF6", "#2D1B69")}>{f.label}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className="px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap" style={chip(cat === c, "#F59E0B", "#431407")}>{c}</button>)}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center"><Search size={28} className="mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No clauses match your filters</p></div>
      ) : (
        <div className="space-y-3">{filtered.map((c: Clause) => <ClauseCard key={c.id} clause={c} onClick={() => setOpen(c)} />)}</div>
      )}
      {open && <ClauseModal clause={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Drafts ───────────────────────────────────────────────────────────────────
function Drafts({ drafts, draftId, deleteDraft, setView }: any) {
  const draft: DraftLease | undefined = draftId ? drafts.find((d: DraftLease) => d.id === draftId) : undefined;

  if (draftId && draft) {
    return (
      <>
        <BackHeader title={draft.name} sub={`${draft.jurisdiction} · ${draft.leaseType} · ${new Date(draft.createdAt).toLocaleDateString("en-AU")}`} onBack={() => setView({ name: "drafts" })} />
        <div className="flex justify-end mb-3">
          <button onClick={() => { if (confirm("Delete this draft?")) { deleteDraft(draft.id); setView({ name: "drafts" }); } }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400"><Trash2 size={14} /> Delete</button>
        </div>
        <div className="space-y-3">
          {draft.sections.map(s => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
              <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{s.content}</p>
            </div>
          ))}
        </div>
        <Disclaimer />
      </>
    );
  }

  return (
    <>
      <BackHeader title="My Drafts" sub={`${drafts.length} draft${drafts.length !== 1 ? "s" : ""}`} onBack={() => setView({ name: "hub" })} />
      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Edit3 size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">No drafts yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">Analyse a lease, then use “Build Draft from Favourable Clauses” to turn the tenant-friendly clauses into a negotiation draft.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d: DraftLease) => (
            <button key={d.id} onClick={() => setView({ name: "drafts", draftId: d.id })}
              className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 text-left hover:border-primary/50 transition">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#052E16" }}><Edit3 size={16} color="#16A34A" /></div>
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">{d.jurisdiction} · {d.sections.length} section{d.sections.length !== 1 ? "s" : ""} · {new Date(d.createdAt).toLocaleDateString("en-AU")}</div></div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────
interface Template { id: string; name: string; jurisdiction?: string | null; leaseType?: string | null; isMaster?: boolean; createdAt?: string; }
function Templates({ authHeaders, setView }: any) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const r = await fetch("/api/lease-templates", { headers: authHeaders }); if (r.ok) { const d = await r.json(); setTemplates(Array.isArray(d?.templates) ? d.templates : Array.isArray(d) ? d : []); } }
      catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [authHeaders]);

  return (
    <>
      <BackHeader title="Lease Templates" sub="Reusable clause templates generated from analysed leases" onBack={() => setView({ name: "hub" })} />
      {loading ? (
        <div className="py-16 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} /></div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Copy size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">No templates yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">When you analyse a lease, the AI extracts a reusable, anonymised template. Those templates appear here for future drafting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#4A0020" }}><Copy size={16} color="#EC4899" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-semibold text-sm truncate">{t.name}</span>
                  {t.isMaster && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: "#F59E0B", background: "#F59E0B1a" }}>Master</span>}</div>
                <div className="text-[11px] text-muted-foreground">{[t.jurisdiction, t.leaseType].filter(Boolean).join(" · ") || "General"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Lease Builder (guided draft generator, ported from app) ──────────────────
const B_JURISDICTIONS = ["ACT", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT"];
const B_LEASE_TYPES = [{ value: "commercial", label: "Commercial" }, { value: "retail", label: "Retail" }, { value: "licence", label: "Licence" }, { value: "mixed", label: "Mixed" }];
const B_PREMISES = [
  { value: "cafe", label: "Café (General)" }, { value: "kiosk", label: "Kiosk" }, { value: "restaurant", label: "Restaurant" },
  { value: "office-foyer-cafe", label: "Office Foyer Café" }, { value: "shopping-centre-cafe", label: "Shopping Centre Café" },
  { value: "street-front-cafe", label: "Street Front Café" }, { value: "outdoor-seating-cafe", label: "Outdoor Seating Café" },
];
const B_POSITIONS = [
  { value: "tenant-friendly", label: "Tenant Friendly", desc: "Maximum protections — best for negotiation" },
  { value: "balanced", label: "Balanced", desc: "Reasonable protections on both sides" },
  { value: "landlord-friendly", label: "Landlord Friendly", desc: "Use only as a reference" },
];
const B_LICENCE_AREAS = [
  { key: "outdoor-seating-licence", label: "Outdoor Seating Area" }, { key: "foyer-licence", label: "Building Foyer" },
  { key: "storage-licence", label: "Storage Area" }, { key: "peppercorn-common-areas", label: "Common Areas" },
];
const B_PROTECTIONS = [
  { key: "rent-reduction-occupancy", label: "Occupancy Rent Reduction", risk: "high" }, { key: "rent-abatement-works", label: "Rent Abatement During Works", risk: "high" },
  { key: "no-rent-approvals", label: "No Rent Until DA Approved", risk: "critical" }, { key: "no-rent-services", label: "No Rent — No Services", risk: "critical" },
  { key: "outgoings-cap", label: "Outgoings Cap", risk: "medium" }, { key: "exclude-vacant-outgoings", label: "Exclude Vacant Outgoings", risk: "medium" },
  { key: "cafe-exclusivity", label: "Café Exclusivity", risk: "high" }, { key: "assignment-purchaser", label: "Assignment to Buyer", risk: "medium" },
  { key: "limited-makegood", label: "Limited Make-Good", risk: "medium" }, { key: "option-to-renew", label: "Option to Renew", risk: "high" },
  { key: "market-rent-dispute", label: "Market Rent Dispute", risk: "medium" }, { key: "signage-rights", label: "Signage Rights", risk: "low" },
  { key: "delivery-access", label: "24-Hour Delivery Access", risk: "low" }, { key: "grease-trap", label: "Grease Trap — Landlord", risk: "high" },
  { key: "landlord-base-building", label: "Landlord Base Building", risk: "medium" }, { key: "landlord-maintenance", label: "Landlord Maintenance", risk: "medium" },
  { key: "disruption-compensation", label: "Disruption Compensation", risk: "high" }, { key: "termination-approvals", label: "No Termination — Approvals", risk: "high" },
];
const PROTECTION_LABELS: Record<string, string> = {
  "rent-reduction-occupancy": "Building Occupancy Rent Reduction", "rent-abatement-works": "Rent Abatement During Landlord Works",
  "peppercorn-common-areas": "Peppercorn Rent for Common Areas", "outdoor-seating-licence": "Outdoor Seating Licence",
  "foyer-licence": "Building Foyer Licence", "storage-licence": "Storage Area Licence", "no-rent-approvals": "No Rent Until DA/Licence Approval",
  "no-rent-services": "No Rent When Services Unavailable", "landlord-base-building": "Landlord Base Building Obligations",
  "outgoings-cap": "Outgoings Cap", "exclude-vacant-outgoings": "Exclude Vacant Tenancy Outgoings", "cafe-exclusivity": "Café Exclusivity",
  "assignment-purchaser": "Assignment to Business Purchaser", "limited-makegood": "Limited Make-Good Obligation",
  "termination-approvals": "No Termination While Approvals Pending", "landlord-maintenance": "Landlord Structural Maintenance",
  "disruption-compensation": "Disruption Compensation", "option-to-renew": "Option to Renew", "market-rent-dispute": "Market Rent Dispute Resolution",
  "signage-rights": "Signage Rights", "delivery-access": "24-Hour Delivery Access", "grease-trap": "Grease Trap & Exhaust Landlord Obligations",
};
const PROTECTION_CLAUSES: Record<string, string> = {
  "rent-reduction-occupancy": "If the overall occupancy of the Building falls below [threshold]% for a continuous period exceeding 30 days, the Base Rent shall be reduced by [percentage]% for the duration of the reduced occupancy. The Landlord must notify the Tenant in writing within 7 days of occupancy falling below the threshold.",
  "rent-abatement-works": "If the Landlord carries out any works that materially interfere with the Tenant's use and enjoyment of the Premises, Rent shall be abated by a fair and reasonable proportion for the period of interference, as agreed by the parties or determined by an independent valuer.",
  "peppercorn-common-areas": "Use of any common areas adjacent to the Premises for dining or display is licensed at a peppercorn rent of $1 per annum, irrevocable for the Term and any option periods.",
  "outdoor-seating-licence": "The Tenant is granted an exclusive licence to use the Outdoor Seating Area delineated on the Plan for outdoor dining for the full Term and any renewal at a peppercorn rent of $1 per annum. The licence cannot be terminated independently of the Lease.",
  "foyer-licence": "The Tenant is granted a non-exclusive licence to use the Building Foyer area shown on the Plan for coffee service and display during the Tenant's trading hours, at a peppercorn rent, not to be revoked without 90 days' written notice and compensation.",
  "storage-licence": "The Tenant is granted an exclusive licence to use the Storage Area shown on the Plan for the storage of goods used in connection with the Permitted Use, at a peppercorn rent of $1 per annum.",
  "no-rent-approvals": "Rent and Outgoings shall not commence until all Development Approvals, food business registrations and other statutory consents required to operate the Permitted Use have been granted and become unconditional. The Tenant must use reasonable endeavours to obtain approvals promptly.",
  "no-rent-services": "If electricity, gas, water, or sewerage services are unavailable for any period exceeding 4 hours (other than due to the Tenant's act or default), Rent and Outgoings shall be abated in full for the period of unavailability. If unavailability exceeds 5 business days, the Tenant may terminate the Lease without penalty.",
  "landlord-base-building": "The Landlord is responsible at its cost for the repair, maintenance and replacement of the base building structure, roof, external walls, and all base building services including hydraulic, electrical and mechanical systems serving the Premises.",
  "outgoings-cap": "The Tenant's total annual Outgoings liability is capped at $[amount] per annum (indexed by CPI). Outgoings shall not include capital expenditure, management fees exceeding 5% of gross income, or costs referable to vacant tenancies.",
  "exclude-vacant-outgoings": "All Outgoings calculations shall be based on the Building's actual occupation. Costs attributable to vacant tenancies or unoccupied floors shall be excluded from the Tenant's Outgoings contribution.",
  "cafe-exclusivity": "The Landlord will not lease, licence or permit any part of the Building to be used for the operation of a café, espresso bar, coffee shop, or any business deriving more than 30% of revenue from the retail sale of food or beverages. Breach entitles the Tenant to a rent abatement of [percentage]% per month.",
  "assignment-purchaser": "The Tenant may assign this Lease to a bona fide purchaser of the Tenant's business on 14 days' written notice, provided the assignee demonstrates sufficient financial capacity. The Landlord must not unreasonably withhold consent. The Tenant is released from all obligations upon completion of assignment.",
  "limited-makegood": "The Tenant's make-good obligation is limited to: (a) removing trade fixtures and equipment; (b) making good damage caused by such removal; and (c) leaving the Premises clean. The Tenant is not required to remove fixed joinery, structural items or improvements. The Landlord must advise disputed items within 14 days of vacancy.",
  "termination-approvals": "The Landlord may not terminate this Lease while any application for Development Approval, food business licence or liquor licence is pending before the relevant authority. The Lease continues until the outcome of such applications is determined.",
  "landlord-maintenance": "The Landlord shall maintain and repair the structure of the Building, roof, foundations, external walls, and all structural components. The Landlord shall complete all structural repairs within 30 days of written notice from the Tenant.",
  "disruption-compensation": "If any act, omission or works by the Landlord, other tenants or third parties causes material disruption to the Tenant's trading for any period, the Landlord shall compensate the Tenant for lost trading revenue as demonstrated by the Tenant's financial records, in addition to any rent abatement otherwise applicable.",
  "option-to-renew": "Subject to the Tenant not being in unremedied default, the Tenant has two options to renew for further 5-year terms on 3 months' prior written notice. Rent for each option period shall be at market review, not to exceed CPI + 2% per annum compounded. The Tenant is released from the obligation to pay any increased rent until market rent is formally determined.",
  "market-rent-dispute": "If the parties cannot agree on market rent within 30 days of the review date, either party may refer determination to an independent valuer appointed by the President of the Australian Property Institute. The valuer acts as expert. Costs are shared equally. Ratchet provisions do not apply — market rent cannot be set below the current rent.",
  "signage-rights": "The Tenant has the right to install external and internal signage of its choosing, subject to council and statutory approvals. The Tenant shall also be included in the Building's directory, entrance signage, and all wayfinding. The Landlord must not unreasonably withhold or delay consent.",
  "delivery-access": "The Tenant and its authorised suppliers have 24-hour, 7-day access to delivery areas and loading docks serving the Premises without restriction or additional charge. The Landlord must provide at least 48 hours' notice before restricting delivery access for any reason.",
  "grease-trap": "The Landlord shall, prior to the Commencement Date, install a grease arrestor of sufficient capacity and a mechanical exhaust system compliant with all statutory requirements. The Landlord is responsible for all maintenance, servicing (including quarterly pump-outs), repair and replacement of these systems throughout the Term.",
};
const B_PREMISES_LABELS: Record<string, string> = {
  cafe: "Café", kiosk: "Kiosk", restaurant: "Restaurant", "office-foyer-cafe": "Office Foyer Café",
  "shopping-centre-cafe": "Shopping Centre Café", "street-front-cafe": "Street Front Café", "outdoor-seating-cafe": "Outdoor Seating Café",
};
const B_POSITION_LABELS: Record<string, string> = { "tenant-friendly": "Tenant Friendly", balanced: "Balanced", "landlord-friendly": "Landlord Friendly" };
const CRITICAL_PROTECTIONS = ["no-rent-approvals", "no-rent-services", "option-to-renew", "limited-makegood", "assignment-purchaser"];

interface BState { jurisdiction: string; leaseType: string; premisesType: string; position: string; rentStructure: string; outgoingsStructure: string; licenceAreas: string[]; selectedProtections: string[]; occupancyThreshold: number; }

function generateDraft(state: BState, id: string): DraftLease {
  const sections: DraftSection[] = [];
  const SEP = "\n\n──────────────────────────────────────────\n\n";
  sections.push({ id: genId(), type: "schedule", title: "Lease Schedule",
    content: `LEASE SCHEDULE\n\nJurisdiction: ${state.jurisdiction}\nLease Type: ${state.leaseType.charAt(0).toUpperCase() + state.leaseType.slice(1)}\nPremises Type: ${B_PREMISES_LABELS[state.premisesType]}\nDrafting Position: ${B_POSITION_LABELS[state.position]}\n\nRent Structure: ${state.rentStructure}\nOutgoings Structure: ${state.outgoingsStructure}\nOccupancy Threshold: ${state.occupancyThreshold}%\n\nLicence Areas:\n${state.licenceAreas.length > 0 ? state.licenceAreas.map(a => `  • ${PROTECTION_LABELS[a] ?? a}`).join("\n") : "  None selected"}\n\nThis schedule forms part of the Lease and should be read in conjunction with the Special Conditions below.` });
  sections.push({ id: genId(), type: "special-conditions", title: "Special Conditions",
    content: state.selectedProtections.length > 0
      ? state.selectedProtections.map(k => `SPECIAL CONDITION: ${PROTECTION_LABELS[k] ?? k}\n\n${PROTECTION_CLAUSES[k] ?? `[Clause text for ${PROTECTION_LABELS[k] ?? k} — to be drafted by solicitor]`}`).join(SEP)
      : "No special conditions selected. Use the Lease Builder to add tenant protections." });
  sections.push({ id: genId(), type: "licence-clauses", title: "Licence Area Clauses",
    content: state.licenceAreas.length > 0
      ? state.licenceAreas.map(k => `LICENCE: ${PROTECTION_LABELS[k] ?? k}\n\n${PROTECTION_CLAUSES[k] ?? `[Licence clause for ${PROTECTION_LABELS[k] ?? k}]`}`).join(SEP)
      : "No licence areas selected." });
  const allSelected = [...state.selectedProtections, ...state.licenceAreas];
  sections.push({ id: genId(), type: "tenant-protections", title: "Tenant Protections Summary",
    content: allSelected.length > 0 ? `SELECTED PROTECTIONS (${allSelected.length} of 22)\n\n${allSelected.map(k => `✓ ${PROTECTION_LABELS[k] ?? k}`).join("\n")}` : "No protections selected." });
  sections.push({ id: genId(), type: "summary", title: "Plain English Summary",
    content: `PLAIN ENGLISH LEASE SUMMARY\n\nThis lease document has been prepared for a ${B_PREMISES_LABELS[state.premisesType]} in ${state.jurisdiction}, taking a ${B_POSITION_LABELS[state.position]} drafting position.\n\nRENT: ${state.rentStructure}\n\nOUTGOINGS: ${state.outgoingsStructure}\n\nKEY PROTECTIONS INCLUDED:\n${state.selectedProtections.slice(0, 8).map(k => `• ${PROTECTION_LABELS[k] ?? k}`).join("\n")}\n\nThis summary is a guide only. You should have a qualified solicitor review the full lease document before signing. Commercial leases are legally binding documents with significant financial consequences.` });
  sections.push({ id: genId(), type: "checklist", title: "Negotiation Checklist",
    content: `LEASE NEGOTIATION CHECKLIST\n\nUse this checklist when negotiating with your landlord or solicitor.\n\n${Object.keys(PROTECTION_LABELS).map(k => `${allSelected.includes(k) ? "[✓]" : "[ ]"} ${PROTECTION_LABELS[k]}`).join("\n")}` });
  const missing = CRITICAL_PROTECTIONS.filter(k => !allSelected.includes(k));
  sections.push({ id: genId(), type: "red-flags", title: "Red Flag Report",
    content: missing.length === 0 ? "No critical red flags identified. All recommended protections are included in this draft."
      : `RED FLAG WARNINGS\n\nThe following critical protections are MISSING from this draft. These are highly recommended for any café lease:\n\n${missing.map(k => `⚠️ MISSING: ${PROTECTION_LABELS[k] ?? k}\n   This is a high-risk omission that could significantly impact your business.`).join("\n\n")}` });
  return {
    id, name: `${B_PREMISES_LABELS[state.premisesType]} Lease — ${state.jurisdiction} (${new Date().toLocaleDateString("en-AU")})`,
    createdAt: new Date().toISOString(), jurisdiction: state.jurisdiction, leaseType: state.leaseType, premisesType: state.premisesType,
    position: state.position, rentStructure: state.rentStructure, outgoingsStructure: state.outgoingsStructure,
    licenceAreas: state.licenceAreas, selectedProtections: state.selectedProtections, sections,
  };
}

function BChip({ label, selected, onClick, color = "#3B82F6" }: { label: string; selected: boolean; onClick: () => void; color?: string }) {
  return <button onClick={onClick} className="px-3 py-1.5 rounded-full border text-[13px] font-medium transition"
    style={{ borderColor: selected ? color : "hsl(var(--border))", background: selected ? color + "20" : "hsl(var(--card))", color: selected ? color : "hsl(var(--muted-foreground))" }}>{label}</button>;
}
function BSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2.5 mb-6"><h3 className="text-[15px] font-bold">{title}</h3>{children}</div>;
}

function Builder({ addDraft, setView }: any) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<BState>({
    jurisdiction: "NSW", leaseType: "commercial", premisesType: "cafe", position: "tenant-friendly",
    rentStructure: "", outgoingsStructure: "",
    licenceAreas: [],
    selectedProtections: ["rent-reduction-occupancy", "no-rent-approvals", "option-to-renew", "limited-makegood", "assignment-purchaser", "cafe-exclusivity", "grease-trap"],
    occupancyThreshold: 70,
  });
  const toggle = (key: string, field: "licenceAreas" | "selectedProtections") =>
    setState(s => ({ ...s, [field]: s[field].includes(key) ? s[field].filter(k => k !== key) : [...s[field], key] }));

  const steps = ["Jurisdiction & Type", "Premises & Position", "Licence Areas", "Tenant Protections", "Rent & Outgoings"];

  const generate = () => {
    const id = genId();
    addDraft(generateDraft(state, id));
    setView({ name: "drafts", draftId: id });
  };

  const inp = "w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary/60 resize-none";

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { if (step > 0) setStep(s => s - 1); else setView({ name: "hub" }); }} className="p-1.5 rounded-lg hover:bg-muted/60"><ArrowLeft size={20} /></button>
        <div className="flex-1"><h1 className="text-xl font-bold">Lease Builder</h1><p className="text-xs text-muted-foreground">Step {step + 1} of {steps.length}: {steps[step]}</p></div>
      </div>
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => <button key={i} onClick={() => setStep(i)} className="flex-1 h-1 rounded-full transition" style={{ background: i <= step ? "#2563EB" : "#1E3A5C" }} />)}
      </div>

      {step === 0 && (<>
        <BSection title="Jurisdiction"><div className="flex flex-wrap gap-2">{B_JURISDICTIONS.map(j => <BChip key={j} label={j} selected={state.jurisdiction === j} onClick={() => setState(s => ({ ...s, jurisdiction: j }))} />)}</div></BSection>
        <BSection title="Lease Type"><div className="flex flex-wrap gap-2">{B_LEASE_TYPES.map(lt => <BChip key={lt.value} label={lt.label} selected={state.leaseType === lt.value} onClick={() => setState(s => ({ ...s, leaseType: lt.value }))} color="#8B5CF6" />)}</div></BSection>
      </>)}

      {step === 1 && (<>
        <BSection title="Premises Type"><div className="flex flex-wrap gap-2">{B_PREMISES.map(pt => <BChip key={pt.value} label={pt.label} selected={state.premisesType === pt.value} onClick={() => setState(s => ({ ...s, premisesType: pt.value }))} color="#F59E0B" />)}</div></BSection>
        <BSection title="Drafting Position">{B_POSITIONS.map(pos => (
          <button key={pos.value} onClick={() => setState(s => ({ ...s, position: pos.value }))}
            className="w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition"
            style={{ borderColor: state.position === pos.value ? "#3B82F6" : "hsl(var(--border))", background: state.position === pos.value ? "#1E3A5C" : "hsl(var(--card))" }}>
            <div className="flex-1"><div className="font-semibold text-sm" style={{ color: state.position === pos.value ? "#93C5FD" : undefined }}>{pos.label}</div>
              <div className="text-xs text-muted-foreground">{pos.desc}</div></div>
            {state.position === pos.value && <CheckCircle2 size={18} color="#3B82F6" />}
          </button>
        ))}</BSection>
      </>)}

      {step === 2 && (
        <BSection title="Licence Areas (peppercorn rent)">
          <p className="text-xs text-muted-foreground mb-1">Select any areas you need licenced. These will be added at peppercorn rent ($1/year).</p>
          {B_LICENCE_AREAS.map(la => <CheckRow key={la.key} label={la.label} checked={state.licenceAreas.includes(la.key)} color="#16A34A" onClick={() => toggle(la.key, "licenceAreas")} />)}
        </BSection>
      )}

      {step === 3 && (
        <BSection title={`Tenant Protections (${state.selectedProtections.length} selected)`}>
          <p className="text-xs text-muted-foreground mb-1">Select clauses to include. Recommended protections are pre-selected.</p>
          {B_PROTECTIONS.map(tp => (
            <CheckRow key={tp.key} label={tp.label} checked={state.selectedProtections.includes(tp.key)} color="#3B82F6" onClick={() => toggle(tp.key, "selectedProtections")}
              right={<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ color: RISK_COLORS[tp.risk], background: RISK_COLORS[tp.risk] + "30" }}>{tp.risk}</span>} />
          ))}
        </BSection>
      )}

      {step === 4 && (<>
        <BSection title="Rent Structure"><textarea rows={3} className={inp} placeholder="e.g. $2,500/week base + annual CPI review, market review at each option" value={state.rentStructure} onChange={e => setState(s => ({ ...s, rentStructure: e.target.value }))} /></BSection>
        <BSection title="Outgoings Structure"><textarea rows={3} className={inp} placeholder="e.g. Gross lease, all outgoings included. OR Net + proportionate share of building outgoings, capped at $15,000/year" value={state.outgoingsStructure} onChange={e => setState(s => ({ ...s, outgoingsStructure: e.target.value }))} /></BSection>
        <BSection title={`Occupancy Threshold: ${state.occupancyThreshold}%`}>
          <p className="text-xs text-muted-foreground mb-1">Rent reduction triggers if building occupancy falls below this level.</p>
          <div className="flex flex-wrap gap-2">{[50, 60, 70, 75, 80].map(t => <BChip key={t} label={`${t}%`} selected={state.occupancyThreshold === t} onClick={() => setState(s => ({ ...s, occupancyThreshold: t }))} color="#F59E0B" />)}</div>
        </BSection>
      </>)}

      <div className="mt-2">
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold text-white" style={{ background: "#2563EB" }}>
            Next: {steps[step + 1]} <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={generate} className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold text-white" style={{ background: "#16A34A" }}>
            <FileText size={16} /> Generate Draft
          </button>
        )}
      </div>
    </>
  );
}

function CheckRow({ label, checked, color, onClick, right }: { label: string; checked: boolean; color: string; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition"
      style={{ borderColor: checked ? color : "hsl(var(--border))", background: checked ? color + "1a" : "hsl(var(--card))" }}>
      <span className="w-5.5 h-5.5 rounded-md border-2 flex items-center justify-center shrink-0" style={{ width: 22, height: 22, borderColor: checked ? color : "#1E3A5C", background: checked ? color : "transparent" }}>
        {checked && <Check size={12} color="#fff" />}
      </span>
      <span className="flex-1 text-[13px] font-medium">{label}</span>
      {right}
    </button>
  );
}

// ─── Disclaimer ───────────────────────────────────────────────────────────────
function Disclaimer({ text }: { text?: string }) {
  return (
    <div className="flex items-start gap-2 mt-6 rounded-xl border border-border bg-muted/30 p-3">
      <ShieldCheck size={14} className="text-muted-foreground mt-0.5 shrink-0" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">{text ?? "Lease analysis is for informational purposes only. Always seek independent legal advice before signing or negotiating any commercial lease."}</p>
    </div>
  );
}
