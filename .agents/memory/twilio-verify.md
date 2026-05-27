---
name: Twilio Verify setup
description: Phone OTP auth via Twilio Verify — how the server routes work and the mobile OTP screen pattern.
---

## Rule
Use Twilio Verify Service (not raw SMS) for OTP. Two endpoints live in `artifacts/api-server/src/routes/biz360.ts`:
- `POST /api/biz360/auth/send-otp` — body `{ phone: string }` (E.164). Calls `verifications.create({ to, channel: "sms" })`.
- `POST /api/biz360/auth/verify-otp` — body `{ phone, code }`. Calls `verificationChecks.create({ to, code })`. Returns 400 if status ≠ "approved".

## Mobile flow
1. `register.tsx` — name + phone (+61 prefix shown, normalised to E.164 via `toE164()`) + role → "Send Verification Code" → navigates to `/(auth)/verify-phone` passing `{ phone, name, role }` as params.
2. `verify-phone.tsx` — 6 individual `TextInput` boxes, auto-advance on digit, auto-submit on 6th digit, 30 s resend cooldown, haptics on success/error. On approval calls `login()` then `router.replace("/")`.

**Why:** Twilio Verify handles rate limiting, expiry, and retry logic server-side; raw SMS would need all of that ourselves.

**How to apply:** Any future phone-change or re-auth flow should reuse these two endpoints. Phone must always be E.164 before hitting the API.
