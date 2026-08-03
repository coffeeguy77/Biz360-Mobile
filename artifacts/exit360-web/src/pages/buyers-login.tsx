/**
 * EXIT360 Buyer Portal — Login
 * Route: /buyers
 *
 * Phone OTP flow dedicated to buyers. On success issues a buyer JWT
 * (exit360_buyer_token) and redirects to /buyers/portal.
 */
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Eye, Phone, ShieldCheck, ChevronRight,
  Loader2, CheckCircle2, Building2, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

type Step = "phone" | "otp" | "done";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("61")) return "+" + digits;
  if (digits.startsWith("0")) return "+61" + digits.slice(1);
  return "+61" + digits;
}

function formatDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)]
      .filter(Boolean).join(" ").trim();
  }
  return (digits.match(/.{1,3}/g) ?? []).join(" ").trim();
}

function OtpBoxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[i]) { const n = [...value]; n[i] = ""; onChange(n); }
      else if (i > 0) refs.current[i - 1]?.focus();
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (!char) return;
    const n = [...value]; n[i] = char; onChange(n);
    if (i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const n = Array(6).fill("");
    text.split("").forEach((c, i) => { n[i] = c; });
    onChange(n);
    refs.current[Math.min(text.length, 5)]?.focus();
  }

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-card text-foreground outline-none transition-all ${
            digit ? "border-primary" : "border-border focus:border-primary/60"
          }`}
        />
      ))}
    </div>
  );
}

export function BuyersLogin() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const e164 = toE164(phone);
  const phoneValid = e164.replace(/\D/g, "").length >= 11;
  const otpFull = otp.every(Boolean);

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (step === "otp" && otpFull) handleVerify();
  }, [otp]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // Already signed in on this browser → straight to the portal.
  useEffect(() => {
    try { if (localStorage.getItem("exit360_buyer_token")) navigate("/buyers/portal"); } catch { /* ignore */ }
  }, []);

  function startCooldown() {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => { if (n <= 1) { clearInterval(cooldownRef.current!); return 0; } return n - 1; });
    }, 1000);
  }

  async function handleSendOtp() {
    if (!phoneValid) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/biz360/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to send code"); }
      setStep("otp"); startCooldown();
    } catch (err: any) { setError(err.message ?? "Something went wrong. Try again."); }
    finally { setLoading(false); }
  }

  async function handleVerify() {
    if (!otpFull) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/buyer-portal/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, code: otp.join("") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid code — please try again");
      // Store buyer JWT — and the seller token too, so one sign-in unlocks both
      // the buyer portal and the seller dashboard (unified phone identity).
      try {
        localStorage.setItem("exit360_buyer_token", data.token);
        if (data.sellerToken) localStorage.setItem("biz360_web_auth_token", data.sellerToken);
      } catch {}
      setStep("done");
      // Brief success flash then redirect
      setTimeout(() => navigate("/buyers/portal"), 900);
    } catch (err: any) {
      setError(err.message ?? "Verification failed. Try again.");
      setOtp(Array(6).fill(""));
    } finally { setLoading(false); }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtp(Array(6).fill("")); setError(""); setLoading(true);
    try {
      await fetch("/api/biz360/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      startCooldown();
    } catch { setError("Failed to resend. Try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft size={16} /> Back
            </button>
          </Link>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2 text-foreground">
            <Logo height={24} />
            <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase">Buyer Portal</span>
          </div>
        </div>
      </nav>

      {/* Hero strip */}
      <div className="bg-gradient-to-r from-[#02060E] to-[#0A1A30] border-b border-[#1E3A5C] py-8 px-6">
        <div className="max-w-lg mx-auto flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={26} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Secure Buyer Portal</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Access confidential business information shared by the seller.
              Verify your number to continue.
            </p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* ── Step: Phone ── */}
          {step === "phone" && (
            <div className="flex flex-col gap-7">
              <div className="text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Phone size={24} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Enter your mobile</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The seller has granted you access using this number.<br />
                  We'll send a 6-digit verification code.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                <Lock size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-muted-foreground">End-to-end secure — your information is never shared</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Mobile Number</label>
                <div className="flex items-center bg-card border-2 border-border rounded-xl overflow-hidden focus-within:border-primary/60 transition-colors">
                  <div className="flex items-center gap-1.5 px-3 py-3 border-r border-border bg-muted/30 flex-shrink-0">
                    <span className="text-base">🇦🇺</span>
                    <span className="text-sm font-medium text-muted-foreground">+61</span>
                  </div>
                  <input
                    type="tel"
                    autoFocus
                    placeholder="0412 XXX XXX"
                    value={formatDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter" && phoneValid) handleSendOtp(); }}
                    className="flex-1 px-3 py-3 bg-transparent text-foreground text-base placeholder:text-muted-foreground/40 outline-none"
                  />
                </div>
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              </div>

              <Button onClick={handleSendOtp} disabled={!phoneValid || loading} className="w-full h-12 text-base font-semibold gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <>Send Verification Code <ChevronRight size={16} /></>}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                A 6-digit code will be sent via SMS. Standard rates apply.
              </p>
            </div>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <div className="flex flex-col gap-7">
              <div className="text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={24} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Enter your code</h2>
                <p className="text-muted-foreground text-sm">
                  Sent to <span className="text-foreground font-medium">{formatDisplay(phone)}</span>
                </p>
              </div>

              <OtpBoxes value={otp} onChange={setOtp} />
              {error && <p className="text-center text-sm text-red-400">{error}</p>}

              <Button onClick={handleVerify} disabled={!otpFull || loading} className="w-full h-12 text-base font-semibold gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <>Confirm <ChevronRight size={16} /></>}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button onClick={() => { setStep("phone"); setOtp(Array(6).fill("")); setError(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  Change number
                </button>
                <button
                  onClick={handleResend} disabled={resendCooldown > 0 || loading}
                  className={`transition-colors ${resendCooldown > 0 ? "text-muted-foreground/40 cursor-not-allowed" : "text-primary hover:text-primary/80"}`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="flex flex-col gap-6 text-center">
              <div>
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Verified!</h2>
                <p className="text-muted-foreground text-sm">Taking you to your portal…</p>
              </div>
              <div className="flex justify-center">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-6 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          EXIT360 Buyer Portal — Access is granted by the seller and subject to NDA.{" "}
          <Link href="/listings">
            <span className="text-primary hover:underline cursor-pointer">Browse public listings</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
