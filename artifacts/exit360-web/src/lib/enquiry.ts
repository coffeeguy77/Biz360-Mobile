// Shared buyer-enquiry helper used by both the sign-in flow (after OTP) and the
// listing detail page (for an already-verified buyer, no sign-in screen).
// Single source of truth for the message wording + thread creation so the two
// entry points never drift.

const API = "/api/biz360";

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/kv/${key}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.value ?? null) as T;
  } catch { return null; }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const res = await fetch(`${API}/kv/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`kv save failed (${res.status})`);
}

function toLocalFormat(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("61")) {
    const local = "0" + digits.slice(2);
    return [local.slice(0, 4), local.slice(4, 7), local.slice(7, 10)].filter(Boolean).join(" ");
  }
  if (digits.startsWith("0")) {
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(" ");
  }
  return e164;
}

export type EnquiryIntent = "info" | "call" | "visit" | "enquiry" | string;

/** Human label for the button / confirmation copy. */
export function enquiryLabel(intent: EnquiryIntent): string {
  switch (intent) {
    case "call":  return "call";
    case "visit": return "site visit";
    case "info":  return "information";
    default:      return "enquiry";
  }
}

/**
 * The message the seller receives — leads with exactly what the buyer wants,
 * then the business, then their callback number and name.
 */
export function enquiryMessage(
  intent: EnquiryIntent,
  listingName: string,
  localPhone: string,
  name: string,
): string {
  switch (intent) {
    case "call":
      return `Requesting a call — could you please give me a call about ${listingName}? You can reach me on ${localPhone}. — ${name}`;
    case "visit":
      return `Requesting a site visit — I'd like to arrange an inspection of ${listingName} at a time that suits you. My number is ${localPhone}. — ${name}`;
    case "info":
      return `Requesting more information — I'm interested in ${listingName} and would like the full details. You can reach me on ${localPhone}. — ${name}`;
    default:
      return `I'm interested in ${listingName} and would like to get in touch. You can reach me on ${localPhone}. — ${name}`;
  }
}

/**
 * Create or append to the buyer's single conversation for this listing and
 * notify the seller. Thread id MUST match the app's canonical
 * `${listingId}_${userId}` so web + app share one conversation.
 */
export async function sendEnquiry(opts: {
  userId: string;
  name: string;
  phone: string;       // any format; normalised for display
  listingId: string;
  listingName: string;
  intent: EnquiryIntent;
}): Promise<void> {
  const { userId, name, phone, listingId, listingName, intent } = opts;
  if (!listingId || !userId) return;

  const threads: Record<string, any> =
    (await kvGet<Record<string, any>>("biz360_threads_v3")) ?? {};
  const threadId = `${listingId}_${userId}`;
  const localPhone = toLocalFormat(phone);
  const text = enquiryMessage(intent, listingName, localPhone, name);

  if (!threads[threadId]) {
    threads[threadId] = {
      id: threadId,
      listingId,
      listingName,
      sellerName: "Seller",
      buyerName: name,
      buyerId: userId,
      messages: [],
      updatedAt: Date.now(),
      unreadBuyer: 0,
      unreadSeller: 0,
    };
  } else {
    threads[threadId] = { ...threads[threadId], buyerName: name, buyerId: userId };
  }

  threads[threadId].messages = [
    ...(threads[threadId].messages ?? []),
    { id: `msg-${Date.now()}-web`, from: "buyer", text, timestamp: Date.now() },
  ];
  threads[threadId].updatedAt = Date.now();
  threads[threadId].unreadSeller = (threads[threadId].unreadSeller ?? 0) + 1;

  await kvSet("biz360_threads_v3", threads);
  // Email the seller (best-effort).
  fetch(`${API}/notify-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, from: "buyer" }),
  }).catch(() => {});
}
