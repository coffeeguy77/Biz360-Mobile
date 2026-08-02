import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, MapPin, Radio, Sparkles, Headphones } from "lucide-react";
import { fetchListings } from "@/lib/listingsApi";

interface Sample {
  id: string;
  name: string;
  space: string;
  url: string;
  kind: "overview" | "pin";
}

const fade = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };

/**
 * AI audio narration showcase. Pulls the real ElevenLabs voice samples from a
 * live tour (prefers Bean Culture) so visitors can actually listen, and explains
 * the two modes: an auto-play arrival overview and tap-to-hear object pins.
 */
export function AudioNarrationShowcase() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const listings = await fetchListings();
        const featured =
          listings.find((l) => /bean culture/i.test(l.businessName ?? "") && l.hasTour) ??
          listings.find((l) => /bean culture/i.test(l.businessName ?? "")) ??
          listings.find((l) => l.hasTour) ?? null;
        if (!featured?.id) { if (active) setLoading(false); return; }
        const r = await fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${featured.id}`);
        const j = await r.json().catch(() => ({}));
        const spaces: any[] = Array.isArray(j?.value) ? j.value : [];
        const out: Sample[] = [];
        for (const s of spaces) {
          if (s?.audioUrl) out.push({ id: `space-${s.id}`, name: s.audioName || `${s.name} — arrival overview`, space: s.name, url: s.audioUrl, kind: "overview" });
          (s?.pins || []).filter((p: any) => p?.type === "audio" && p?.audioUrl).forEach((p: any) => {
            out.push({ id: `pin-${p.id}`, name: p.audioName || p.title || "Object narration", space: s.name, url: p.audioUrl, kind: "pin" });
          });
        }
        if (active) { setSamples(out.slice(0, 8)); setLoading(false); }
      } catch { if (active) setLoading(false); }
    })();
    return () => { active = false; if (audioRef.current) { audioRef.current.pause(); } };
  }, []);

  function toggle(s: Sample) {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (playingId === s.id) { a.pause(); setPlayingId(null); return; }
    a.src = s.url;
    a.play().then(() => setPlayingId(s.id)).catch(() => setPlayingId(null));
    a.onended = () => setPlayingId(null);
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <motion.div {...fade} className="max-w-3xl mb-12">
        <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
          <Sparkles size={13} /> Premium AI voice — a genuine edge
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Your business, <span className="theme-text-gradient">narrated by a premium AI voice.</span>
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Every EXIT360 walkthrough can talk. Using ElevenLabs' studio-grade AI narration, buyers don't
          just look at your business — they're <strong className="text-foreground">guided through it</strong>,
          room by room, with a warm human-sounding voice explaining what makes it special. No other
          business-for-sale platform does this. Press play below and hear it for yourself.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Modes */}
        <motion.div {...fade} className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Radio size={20} /></div>
              <h3 className="text-lg font-bold">Auto-play arrival overview</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The moment a buyer enters a space, an opening overview plays automatically — setting the scene,
              highlighting the fit-out, the flow, the opportunity. It's the welcome a great agent would give
              in person, delivered every single time, day or night.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><MapPin size={20} /></div>
              <h3 className="text-lg font-bold">Tap an object, hear its story</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Drop an audio pin on any object — the espresso machine, the roaster, the plant, the lease
              signage — and buyers tap it to hear exactly what it is, what it's worth and why it matters.
              You turn a silent photo into a guided, narrated sales walkthrough.
            </p>
          </div>
          <div className="rounded-2xl border border-border theme-aurora-bg overflow-hidden">
            <div className="relative z-10 p-6 flex items-center gap-4">
              <Headphones className="text-primary flex-shrink-0" size={26} />
              <p className="text-sm text-foreground/90 leading-relaxed">
                Buyers who <em>hear</em> the story stay longer, understand more and arrive at inspection
                already sold. Narration is the difference between a listing and an experience.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Live player */}
        <motion.div {...fade} className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 size={18} className="text-primary" />
            <h3 className="text-lg font-bold">Listen to real samples</h3>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading live narration samples…</p>
          ) : samples.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Samples are being prepared — check back shortly.</p>
          ) : (
            <div className="space-y-2.5">
              {samples.map((s) => {
                const active = playingId === s.id;
                return (
                  <button key={s.id} onClick={() => toggle(s)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/50"}`}>
                    <span className={`w-10 h-10 rounded-full grid place-items-center flex-shrink-0 ${active ? "theme-btn-gradient text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {active ? <Pause size={16} /> : <Play size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{s.name}</span>
                      <span className="block text-xs text-muted-foreground truncate flex items-center gap-1.5">
                        {s.kind === "overview" ? <Radio size={11} /> : <MapPin size={11} />}
                        {s.space} · {s.kind === "overview" ? "arrival overview" : "object pin"}
                      </span>
                    </span>
                    {active && <span className="flex gap-0.5 items-end h-4">
                      <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "60%" }} />
                      <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "100%", animationDelay: "0.15s" }} />
                      <span className="w-1 bg-primary rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0.3s" }} />
                    </span>}
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-primary" /> Real ElevenLabs narration from a live EXIT360 walkthrough.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
