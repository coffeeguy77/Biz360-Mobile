import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, X, Send, Loader2, LifeBuoy, ArrowUpRight } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

const GREETING =
  "Hi! I'm the EXIT360 assistant 👋 I can explain any part of the platform, walk you through selling your business, and take you straight to the right page. What would you like to do?";

const SUGGESTIONS = [
  "How do I create a listing?",
  "How do I build the 360° tour?",
  "How do I connect Xero & Square?",
  "What is the NDA / buyer access?",
  "How does the valuation work?",
];

// Minimal markdown → React (bold, links, bullets). Internal links navigate in-app.
function RichText({ text, onNavigate }: { text: string; onNavigate: (href: string) => void }) {
  const lines = text.split("\n");
  const out: any[] = [];
  let bullets: any[] = [];
  const flush = () => { if (bullets.length) { out.push(<ul key={out.length} className="list-disc pl-5 space-y-1 my-1.5">{bullets}</ul>); bullets = []; } };
  const renderInline = (line: string) => {
    const nodes: any[] = [];
    const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
    let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) nodes.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
      else {
        const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (lm) {
          const [, label, href] = lm;
          const internal = href.startsWith("/");
          nodes.push(internal
            ? <button key={i++} onClick={() => onNavigate(href)} className="inline-flex items-center gap-0.5 text-primary font-semibold hover:underline">{label}<ArrowUpRight size={12} /></button>
            : <a key={i++} href={href} target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">{label}</a>);
        } else nodes.push(tok);
      }
      last = m.index + tok.length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    return nodes;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) { bullets.push(<li key={bullets.length}>{renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>); continue; }
    flush();
    if (line.trim() === "") { out.push(<div key={out.length} className="h-1.5" />); continue; }
    out.push(<p key={out.length} className="leading-relaxed">{renderInline(line)}</p>);
  }
  flush();
  return <div className="text-sm space-y-0.5">{out}</div>;
}

export function HelpAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading, open]);
  useEffect(() => {
    const openHandler = (e: any) => { setOpen(true); const q = e?.detail?.ask; if (q) setTimeout(() => send(q), 60); };
    window.addEventListener("exit360:openHelp", openHandler as any);
    return () => window.removeEventListener("exit360:openHelp", openHandler as any);
    // eslint-disable-next-line
  }, [msgs]);

  function goTo(href: string) { setOpen(false); navigate(href); }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next); setLoading(true);
    try {
      const r = await fetch("/api/support/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: d.reply || d.error || "Sorry, something went wrong." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please try again, or [contact our team](/help#contact)." }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {/* Launcher (bottom-left to avoid the theme picker) */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open help assistant"
          className="fixed z-[80] bottom-5 left-5 h-12 pl-3 pr-4 rounded-full grid grid-flow-col items-center gap-2 text-primary-foreground shadow-xl theme-btn-gradient hover:scale-105 active:scale-95 transition-transform">
          <LifeBuoy size={18} /> <span className="text-sm font-semibold">Help</span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-label="Help assistant" className="fixed z-[81] bottom-5 left-5 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-6rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          <header className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <div className="w-8 h-8 rounded-xl grid place-items-center theme-btn-gradient"><Sparkles size={16} className="text-primary-foreground" /></div>
            <div className="flex-1 min-w-0"><div className="font-bold text-sm leading-none">EXIT360 Assistant</div><div className="text-[11px] text-muted-foreground mt-0.5">Answers anything about the platform</div></div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto themed-scroll px-3.5 py-3 space-y-3">
            {/* Greeting */}
            {msgs.length === 0 && (
              <>
                <div className="rounded-2xl rounded-tl-sm bg-muted/50 border border-border px-3.5 py-2.5"><RichText text={GREETING} onNavigate={goTo} /></div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="text-[12px] px-2.5 py-1.5 rounded-full border border-border bg-background hover:border-primary/50 hover:text-primary transition text-left">{s}</button>
                  ))}
                </div>
              </>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-tr-sm theme-btn-gradient text-primary-foreground px-3.5 py-2 text-sm"
                  : "max-w-[92%] rounded-2xl rounded-tl-sm bg-muted/50 border border-border px-3.5 py-2.5"}>
                  {m.role === "user" ? <span className="whitespace-pre-wrap">{m.content}</span> : <RichText text={m.content} onNavigate={goTo} />}
                </div>
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm px-1"><Loader2 size={14} className="animate-spin" /> thinking…</div>}
          </div>

          <div className="border-t border-border p-2.5">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about EXIT360…" aria-label="Message"
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
              <button type="submit" disabled={loading || !input.trim()} aria-label="Send" className="w-9 h-9 grid place-items-center rounded-xl theme-btn-gradient text-primary-foreground disabled:opacity-50"><Send size={16} /></button>
            </form>
            <div className="text-[10px] text-muted-foreground text-center mt-1.5">Need a person? <button onClick={() => goTo("/help#contact")} className="text-primary hover:underline">Contact our team</button></div>
          </div>
        </div>
      )}
    </>
  );
}
