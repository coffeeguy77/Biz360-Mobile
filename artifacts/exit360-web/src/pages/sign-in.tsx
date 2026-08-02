import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Eye, Phone, ShieldCheck, ChevronRight, Loader2, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendEnquiry } from "@/lib/enquiry";
import { Logo } from "@/components/Logo";

type Step = "phone" | "otp" | "name" | "signedin" | "done";

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
  const chunks = digits.match(/.{1,3}/g) ?? [];
  return chunks.join(" ").trim();
}

function toLocalFormat(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("61")) {
    const local = "0" + digits.slice(2);
    return [local.slice(0, 4), local.slice(4, 7), local.slice(7, 10)]
      .filter(Boolean).join(" ");
  }
  return e164;
}

const API = "/api/biz360";

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/kv/${key}`);
    if (!res.ok) return null;
    // API responds { value: <data> } — unwrap it.
    const json = await res.json();
    return (json?.value ?? null) as T;
  } catch { return null; }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  // API expects { value: <data> } on PUT.
  const res = await fetch(`${API}/kv/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`kv save failed (${res.status})`);
}

async function registerBuyer(userId: string, name: string, phone: string): Promise<void> {
  const users: any[] = (await kvGet<any[]>("biz360_admin_users")) ?? [];
  const exists = users.some((u) => u.id === userId || u.email === phone);
  if (!exists) {
    const newUser = {
      id: userId,
      name,
      email: phone,
      role: "buyer",
      status: "active",
      joined: new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
    };
    await kvSet("biz360_admin_users", [newUser, ...users]);
  } else {
    const updated = users.map((u) =>
      (u.id === userId || u.email === phone) && (!u.name || u.name === "User")
        ? { ...u, name }
        : u
    );
    await kvSet("biz360_admin_users", updated);
  }
  try {
    localStorage.setItem("biz360_web_user", JSON.stringify({ userId, name, phone }));
  } catch {}
}

function OtpBoxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[i]) {
        const next = [...value];
        next[i] = "";
        onChange(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (!char) return;
    const next = [...value];
    next[i] = char;
    onChange(next);
    if (i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill("");
    text.split("").forEach((c, i) => { next[i] = c; });
    onChange(next);
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

export function SignIn() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const intent = params.get("intent") ?? "enquiry";
  const listingId = params.get("listingId") ?? "";
  const listingName = params.get("listingName") ?? "this listing";
  const returnPath = params.get("return") ?? `/listings/${listingId}`;

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [userId, setUserId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const e164 = toE164(phone);
  const phoneValid = e164.replace(/\D/g, "").length >= 11;
  const otpFull = otp.every(Boolean);
  const nameValid = name.trim().length >= 2;

  useEffect(() => {
    if (step === "otp" && otpFull) handleVerify();
  }, [otp]);

  useEffect(() => {
    if (step === "name") setTimeout(() => nameInputRef.current?.focus(), 150);
  }, [step]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // Returning buyer — already verified this browser. Skip phone/OTP/name.
  useEffect(() => {
    if (intent === "signup") return;
    try {
      // Only recognise them if they STILL hold a login token. A signed-out
      // buyer (token cleared) must re-verify — a lingering biz360_web_user
      // profile alone must NOT count as being signed in.
      // The buyer-portal token is THE signed-in-buyer signal. (biz360_web_auth_token
      // can linger from an old listing-detail verify, so it is deliberately not
      // trusted here.)
      const hasToken = !!localStorage.getItem("exit360_buyer_token");
      if (!hasToken) {
        // Stale profile with no token — clear it so nothing else trusts it.
        localStorage.removeItem("biz360_web_user");
        return;
      }
      const raw = localStorage.getItem("biz360_web_user");
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u?.userId && u?.phone && (u?.name?.trim?.().length ?? 0) >= 2) {
        setUserId(u.userId);
        setName(u.name);
        setPhone(String(u.phone).replace(/^\+/, ""));
        setStep("signedin");
      }
    } catch { /* ignore */ }
  }, []);

  function startCooldown() {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    if (!phoneValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/biz360/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Failed to send code");
      }
      setStep("otp");
      startCooldown();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!otpFull) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/biz360/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, code: otp.join("") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Invalid code — please try again");
      setUserId(data.userId ?? "");
      setAuthToken(data.token ?? "");

      // Do we already know this buyer's name? Check the server (canonical buyer
      // record) first, then this browser's cache. If we do, skip the name step
      // entirely — we already have their phone AND name, no need to ask again.
      let knownName = "";
      if (data.token) {
        try {
          const r = await fetch("/api/buyer-portal/link", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({}),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d.token) { try { localStorage.setItem("exit360_buyer_token", d.token); } catch {} }
          if (r.ok && typeof d.name === "string" && d.name.trim().length >= 2) knownName = d.name.trim();
        } catch { /* fall back to cache / manual entry */ }
      }
      if (!knownName) {
        try {
          const stored = localStorage.getItem("biz360_web_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.name && parsed.name !== "User" && String(parsed.name).trim().length >= 2) {
              knownName = String(parsed.name).trim();
            }
          }
        } catch {}
      }
      if (knownName) {
        setName(knownName);
        setStep("signedin");   // recognised — go straight to the one-tap confirm
      } else {
        setStep("name");       // genuinely new buyer — ask once
      }
    } catch (err: any) {
      setError(err.message ?? "Verification failed. Try again.");
      setOtp(Array(6).fill(""));
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!nameValid) return;
    setLoading(true);
    setError("");
    try {
      const trimmed = name.trim();
      await registerBuyer(userId, trimmed, e164);
      await sendEnquiry({ userId, name: trimmed, phone: e164, listingId, listingName, intent });
      // Unify identities: link this phone-verified enquirer to the canonical
      // buyer record and mint a portal token, so they're recognised in the
      // buyer portal (and for any document access a seller grants) — no 2nd SMS.
      if (authToken) {
        try {
          const linkRes = await fetch("/api/buyer-portal/link", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ name: trimmed }),
          });
          const linkData = await linkRes.json().catch(() => ({}));
          if (linkRes.ok && linkData.token) {
            localStorage.setItem("exit360_buyer_token", linkData.token);
          }
        } catch { /* non-fatal — enquiry already succeeded */ }
      }
      setStep("done");
    } catch {
      setError("Something went wrong saving your details. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtp(Array(6).fill(""));
    setError("");
    setLoading(true);
    try {
      await fetch("/api/biz360/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      startCooldown();
    } catch {
      setError("Failed to resend. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const intentLabel =
    intent === "call" ? "Request a Call" :
    intent === "visit" ? "Request a Site Visit" :
    intent === "signup" ? "Create Buyer Profile" :
    intent === "info" ? "Request Info" :
    "Send Enquiry";
  const intentDesc =
    intent === "call"
      ? "We'll pass your number to the seller so they can call you directly."
      : intent === "visit"
      ? "We'll ask the seller to arrange a site visit / inspection with you."
      : intent === "signup"
      ? "Verify your number to create your free buyer profile and get access to exclusive listings."
      : intent === "info"
      ? "Verify your number and we'll ask the seller to share more information with you."
      : "We'll send your enquiry to the seller on your behalf.";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center gap-4">
          <Link href={returnPath}>
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft size={16} /> Back
            </button>
          </Link>
          <span className="text-border">|</span>
          <div className="flex items-center text-foreground">
            <Logo height={24} />
          </div>
        </div>
      </nav>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">

          {/* ── Step: Phone ── */}
          {step === "phone" && (
            <div className="flex flex-col gap-7">
              <div className="text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Phone size={24} className="text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">{intentLabel}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {intentDesc}
                  <br />
                  Verify your number to continue.
                </p>
              </div>

              {listingName && intent !== "signup" && (
                <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-400 flex-shrink-0" />
                  <span className="truncate">{listingName}</span>
                </div>
              )}

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
                <p className="mt-1.5 text-xs text-muted-foreground/60">Enter your number starting with 0 — e.g. 0412 708 337</p>
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              </div>

              <Button
                onClick={handleSendOtp}
                disabled={!phoneValid || loading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending…</>
                ) : (
                  <>Send Verification Code <ChevronRight size={16} /></>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                A 6-digit code will be sent via SMS to your mobile.
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
                <h1 className="text-2xl font-bold mb-2">Enter your code</h1>
                <p className="text-muted-foreground text-sm">
                  Sent to <span className="text-foreground font-medium">{toLocalFormat(e164)}</span>
                </p>
              </div>

              <OtpBoxes value={otp} onChange={setOtp} />

              {error && <p className="text-center text-sm text-red-400">{error}</p>}

              <Button
                onClick={handleVerify}
                disabled={!otpFull || loading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  <>Confirm <ChevronRight size={16} /></>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => { setStep("phone"); setOtp(Array(6).fill("")); setError(""); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change number
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className={`transition-colors ${
                    resendCooldown > 0 ? "text-muted-foreground/40 cursor-not-allowed" : "text-primary hover:text-primary/80"
                  }`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Name ── */}
          {step === "name" && (
            <div className="flex flex-col gap-7">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={24} className="text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-2">What's your name?</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  So the seller knows who's getting in touch.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <ShieldCheck size={14} className="text-green-400 flex-shrink-0" />
                <span className="text-muted-foreground">Verified:</span>
                <span className="font-medium">{toLocalFormat(e164)}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Your Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Sarah Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nameValid) handleComplete(); }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground text-base placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 transition-colors"
                />
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              </div>

              <Button
                onClick={handleComplete}
                disabled={!nameValid || loading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> {intent === "call" ? "Requesting call…" : intent === "info" ? "Sending request…" : "Sending enquiry…"}</>
                ) : (
                  <>{intent === "call" ? "Request Call" : intent === "info" ? "Send Request" : "Send Enquiry"} <ChevronRight size={16} /></>
                )}
              </Button>
            </div>
          )}

          {/* ── Step: Signed-in (returning buyer) ── */}
          {step === "signedin" && (
            <div className="flex flex-col gap-7">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={24} className="text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome back{name ? `, ${name.trim().split(" ")[0]}` : ""}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  You're verified as <span className="text-foreground font-medium">{toLocalFormat(e164)}</span>.<br />
                  {intent === "call" ? "Request a call about" : "Request info for"} {listingName}?
                </p>
              </div>
              {error && <p className="text-center text-sm text-red-400">{error}</p>}
              <Button onClick={handleComplete} disabled={loading} className="w-full h-12 text-base font-semibold gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <>{intent === "call" ? "Request Call" : "Send Request"} <ChevronRight size={16} /></>}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <Link href="/buyers/portal">
                  <button className="text-primary hover:text-primary/80 transition-colors">Go to my portal</button>
                </Link>
                <button
                  onClick={() => {
                    try { localStorage.removeItem("biz360_web_user"); localStorage.removeItem("exit360_buyer_token"); localStorage.removeItem("biz360_web_auth_token"); } catch { /* ignore */ }
                    setStep("phone"); setPhone(""); setOtp(Array(6).fill("")); setName(""); setUserId(""); setAuthToken(""); setError("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different number
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="flex flex-col gap-7 text-center">
              <div>
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-3">
                  {intent === "call" ? "Call Requested!" : intent === "signup" ? "Profile Created!" : intent === "info" ? "Request Sent!" : "Enquiry Sent!"}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {intent === "call"
                    ? `The seller will call you at ${toLocalFormat(e164)} within 1–2 business days.`
                    : intent === "signup"
                    ? `Your buyer profile is live. You can now enquire on any listing and the seller will see your verified number.`
                    : `Your message about ${listingName} has been sent to the seller. They'll be in touch soon.`}
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-primary" />
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{name.trim()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck size={14} className="text-green-400" />
                  <span className="text-muted-foreground">Verified number:</span>
                  <span className="font-medium">{toLocalFormat(e164)}</span>
                </div>
                {listingName && intent !== "signup" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Eye size={14} className="text-primary" />
                    <span className="text-muted-foreground">Listing:</span>
                    <span className="font-medium truncate">{listingName}</span>
                  </div>
                )}
              </div>

              <Link href="/buyers/portal">
                <Button className="w-full h-12 gap-2">
                  <User size={16} /> Go to My Portal
                </Button>
              </Link>
              <Link href={intent === "signup" ? "/listings" : returnPath}>
                <Button variant="outline" className="w-full h-12">
                  {intent === "signup" ? "Browse Listings" : "Back to Listing"}
                </Button>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
