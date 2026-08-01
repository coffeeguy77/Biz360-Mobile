import { useState, useRef, useEffect } from "react";
import { Phone, ShieldCheck, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function toE164(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("61")) return "+" + d;
  if (d.startsWith("0")) return "+61" + d.slice(1);
  return "+61" + d;
}
function fmt(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 10)].filter(Boolean).join(" ");
  return d;
}

/**
 * Reusable phone → OTP → token gate. Calls onVerified with the biz360 auth token
 * (sub = u-<phone>), the userId and the E.164 phone. Used by the seller
 * dashboard and the broker→client analytics page.
 */
export function PhoneGate({
  title, subtitle, cta = "Continue", onVerified,
}: {
  title: string;
  subtitle: string;
  cta?: string;
  onVerified: (token: string, userId: string, phone: string) => void;
}) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const e164 = toE164(phone);
  const phoneValid = e164.replace(/\D/g, "").length >= 11;

  async function sendOtp() {
    if (!phoneValid) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/biz360/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: e164 }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "Failed to send code"); }
      setStep("otp");
    } catch (e: any) { setError(e.message ?? "Something went wrong."); } finally { setLoading(false); }
  }

  async function verify(code: string) {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/biz360/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: e164, code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.message || d.error || "Invalid code");
      onVerified(d.token, d.userId ?? `u-${e164.replace(/\D/g, "")}`, e164);
    } catch (e: any) { setError(e.message ?? "Verification failed."); setOtp(Array(6).fill("")); refs.current[0]?.focus(); } finally { setLoading(false); }
  }

  useEffect(() => { if (otp.every(Boolean)) verify(otp.join("")); /* eslint-disable-next-line */ }, [otp]);

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl border border-border bg-card/60 backdrop-blur p-7">
      <div className="w-14 h-14 rounded-2xl grid place-items-center bg-primary/10 mx-auto mb-4">
        {step === "phone" ? <Phone className="text-primary" size={24} /> : <ShieldCheck className="text-primary" size={24} />}
      </div>
      <h1 className="text-2xl font-bold text-center mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">{subtitle}</p>

      {step === "phone" ? (
        <>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Mobile number</label>
          <div className="flex items-center bg-background border-2 border-border rounded-xl overflow-hidden focus-within:border-primary/60 transition-colors mb-4">
            <span className="px-3 py-3 border-r border-border bg-muted/30 text-sm text-muted-foreground">🇦🇺 +61</span>
            <input type="tel" autoFocus placeholder="0412 XXX XXX" value={fmt(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && phoneValid) sendOtp(); }}
              className="flex-1 px-3 py-3 bg-transparent text-foreground outline-none" />
          </div>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Button onClick={sendOtp} disabled={!phoneValid || loading} className="w-full h-12 theme-btn-gradient border-0">
            {loading ? <><Loader2 size={16} className="animate-spin mr-1" /> Sending…</> : <>{cta} <ChevronRight size={16} /></>}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground text-center mb-4">Enter the 6-digit code sent to {fmt(phone)}</p>
          <div className="flex gap-2 justify-center mb-4">
            {otp.map((digit, i) => (
              <input key={i} ref={(el) => { refs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                onChange={(e) => { const c = e.target.value.replace(/\D/g, "").slice(-1); if (!c) return; const n = [...otp]; n[i] = c; setOtp(n); if (i < 5) refs.current[i + 1]?.focus(); }}
                onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus(); }}
                className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-border bg-background text-foreground outline-none focus:border-primary/60" />
            ))}
          </div>
          {error && <p className="text-sm text-destructive text-center mb-3">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Verifying…</p>}
          <button onClick={() => { setStep("phone"); setOtp(Array(6).fill("")); setError(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-2">Change number</button>
        </>
      )}
    </div>
  );
}
