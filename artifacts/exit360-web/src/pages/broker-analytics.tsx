import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Eye, Users, ShieldCheck, Mail, Phone, CalendarCheck, FileDown, Compass, RefreshCw, Lock } from "lucide-react";
import { Seo } from "@/components/Seo";
import { SiteShell } from "@/components/SiteShell";
import { PhoneGate } from "@/components/PhoneGate";

interface Analytics {
  listingId: string;
  businessName: string;
  city: string | null;
  role: string;
  stats: {
    reportViews: number; tourClicks: number; pdfDownloads: number;
    requestInfo: number; requestCall: number; requestVisit: number;
    showPhone: number; ndaSigned: number; uniqueBuyers: number; totalEvents: number;
  };
  timeline: { date: string; count: number }[];
  generatedAt: string;
}

const TOKEN_KEY = "biz360_web_auth_token";

export function BrokerAnalytics() {
  const [, params] = useRoute("/broker/analytics/:listingId");
  const listingId = params?.listingId ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "forbidden" | "error">("idle");

  useEffect(() => { try { setToken(localStorage.getItem(TOKEN_KEY)); } catch { /* ignore */ } }, []);

  async function load(t: string) {
    setStatus("loading");
    try {
      const r = await fetch(`/api/public/listing/${listingId}/analytics`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.status === 403) { setStatus("forbidden"); return; }
      if (!r.ok) { setStatus("error"); return; }
      setData(await r.json());
      setStatus("idle");
    } catch { setStatus("error"); }
  }

  useEffect(() => { if (token && listingId) load(token); /* eslint-disable-next-line */ }, [token, listingId]);

  function onVerified(t: string) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
    setToken(t);
  }

  const maxDay = data ? Math.max(1, ...data.timeline.map((d) => d.count)) : 1;

  return (
    <SiteShell>
      <Seo title="Listing Analytics | EXIT360" description="Live performance analytics for your business listing on EXIT360." path={`/broker/analytics/${listingId}`} />
      <div className="max-w-5xl mx-auto px-6 py-12">
        {!token || status === "forbidden" ? (
          <div className="pt-8">
            {status === "forbidden" && (
              <div className="max-w-sm mx-auto mb-5 rounded-xl border border-border bg-card/60 p-4 flex items-start gap-2.5">
                <Lock size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">This phone number isn't authorised for this listing yet. Ask your broker to add your mobile number, then verify again.</p>
              </div>
            )}
            <PhoneGate
              title="View your listing analytics"
              subtitle="Verify your mobile number to see live stats for your business listing."
              cta="Send my code"
              onVerified={onVerified}
            />
          </div>
        ) : status === "loading" ? (
          <div className="text-center py-24 text-muted-foreground">Loading your analytics…</div>
        ) : status === "error" ? (
          <div className="text-center py-24 text-muted-foreground">Couldn't load analytics. Please refresh.</div>
        ) : data ? (
          <>
            <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Listing performance</p>
                <h1 className="text-3xl font-extrabold tracking-tight">{data.businessName}</h1>
                {data.city && <p className="text-muted-foreground">{data.city}</p>}
              </div>
              <button onClick={() => token && load(token)} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border bg-card/50 hover:border-primary/50">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Headline stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Eye, label: "Report views", value: data.stats.reportViews },
                { icon: Users, label: "Unique buyers", value: data.stats.uniqueBuyers },
                { icon: ShieldCheck, label: "NDAs signed", value: data.stats.ndaSigned },
                { icon: Compass, label: "360° tour opens", value: data.stats.tourClicks },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-card/50 p-5 theme-ring-card">
                  <s.icon className="text-primary mb-2" size={20} />
                  <div className="text-3xl font-extrabold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Requests breakdown */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <h2 className="text-lg font-bold mb-4">Buyer requests</h2>
                <div className="space-y-3">
                  {[
                    { icon: Mail, label: "Information requests", value: data.stats.requestInfo },
                    { icon: Phone, label: "Call requests", value: data.stats.requestCall },
                    { icon: CalendarCheck, label: "Site visit requests", value: data.stats.requestVisit },
                    { icon: Phone, label: "Phone number reveals", value: data.stats.showPhone },
                    { icon: FileDown, label: "Report PDF downloads", value: data.stats.pdfDownloads },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg grid place-items-center bg-primary/10 text-primary flex-shrink-0"><r.icon size={16} /></div>
                      <span className="text-sm text-muted-foreground flex-1">{r.label}</span>
                      <span className="text-lg font-bold tabular-nums">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 14-day activity */}
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <h2 className="text-lg font-bold mb-4">Activity — last 14 days</h2>
                <div className="flex items-end gap-1.5 h-40">
                  {data.timeline.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end group">
                      <div className="w-full rounded-t theme-btn-gradient transition-all" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} title={`${d.date}: ${d.count}`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                  <span>{data.timeline[0]?.date.slice(5)}</span>
                  <span>{data.timeline[data.timeline.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Live data · generated {new Date(data.generatedAt).toLocaleString("en-AU")} · shared securely by your EXIT360 broker.
            </p>
          </>
        ) : null}
      </div>
    </SiteShell>
  );
}
