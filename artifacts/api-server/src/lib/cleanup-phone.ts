import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * ONE-SHOT destructive cleanup — removes ALL data for a single phone number so
 * that person can be re-tested as a brand-new user.
 *
 * Runs ONLY when the CLEANUP_PHONE env var is set (deliberately opt-in so it can
 * never fire by accident). Matches on the trailing 9 digits, so every stored
 * format is caught (+61…, +0…, "0412 708 337", "61412708337", …). Wrapped so it
 * can never block the server booting, and it logs a full "[CLEANUP]" summary of
 * exactly what it removed.
 *
 * After a run, unset CLEANUP_PHONE (and this hook is removed from the codebase
 * once the cleanup is confirmed).
 */
export async function runPhoneCleanup(): Promise<void> {
  const raw = process.env.CLEANUP_PHONE;
  if (!raw) return;

  const digits = raw.replace(/\D/g, "");
  const tail = digits.slice(-9);
  if (tail.length < 9) {
    logger.warn({ raw }, "[CLEANUP] CLEANUP_PHONE has fewer than 9 digits — refusing to run");
    return;
  }
  const like = `%${tail}`; // matches values/keys ENDING in the phone's 9 digits
  const summary: Record<string, number> = {};

  const del = async (label: string, q: ReturnType<typeof sql>): Promise<void> => {
    try {
      const r: any = await db.execute(q);
      summary[label] = typeof r?.rowCount === "number" ? r.rowCount : (r?.rows?.length ?? 0);
    } catch (e: any) {
      logger.error({ err: e?.message, label }, "[CLEANUP] delete failed (table may not exist)");
      summary[label] = -1;
    }
  };

  // ── Relational tables that carry a phone column ──────────────────────────────
  await del("nda_signatures", sql`DELETE FROM nda_signatures WHERE regexp_replace(buyer_phone, '\\D', '', 'g') LIKE ${like}`);
  await del("report_access_grants", sql`DELETE FROM report_access_grants WHERE regexp_replace(phone, '\\D', '', 'g') LIKE ${like}`);
  await del("report_view_events", sql`DELETE FROM report_view_events WHERE regexp_replace(viewer_phone, '\\D', '', 'g') LIKE ${like}`);
  await del("report_access_logs", sql`DELETE FROM report_access_logs WHERE regexp_replace(buyer_phone, '\\D', '', 'g') LIKE ${like}`);
  await del("buyer_portal_group_members", sql`DELETE FROM buyer_portal_group_members WHERE regexp_replace(phone, '\\D', '', 'g') LIKE ${like}`);
  await del("buyers", sql`DELETE FROM buyers WHERE regexp_replace(phone, '\\D', '', 'g') LIKE ${like}`);

  // ── KV: phone-keyed single rows (last login, seller profile) ─────────────────
  await del("kv_last_login", sql`DELETE FROM kv_store WHERE key LIKE 'biz360_last_login_%' AND regexp_replace(key, '\\D', '', 'g') LIKE ${like}`);
  await del("kv_seller_profile", sql`DELETE FROM kv_store WHERE key LIKE 'biz360_seller_profile_v1_%' AND regexp_replace(key, '\\D', '', 'g') LIKE ${like}`);

  // ── KV: message threads (drop any thread involving this buyer) ───────────────
  try {
    const r: any = await db.execute(sql`SELECT value FROM kv_store WHERE key = 'biz360_threads_v3'`);
    const val = r?.rows?.[0]?.value;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const threads = val as Record<string, any>;
      let removed = 0;
      for (const [tid, t] of Object.entries(threads)) {
        const bd = String((t as any)?.buyerId ?? (t as any)?.buyerPhone ?? "").replace(/\D/g, "");
        if (bd.length >= 9 && bd.endsWith(tail)) {
          delete threads[tid];
          removed++;
        }
      }
      if (removed) {
        await db.execute(sql`UPDATE kv_store SET value = ${JSON.stringify(threads)}::jsonb, updated_at = now() WHERE key = 'biz360_threads_v3'`);
      }
      summary["threads"] = removed;
    } else {
      summary["threads"] = 0;
    }
  } catch (e: any) {
    logger.error({ err: e?.message }, "[CLEANUP] threads failed");
    summary["threads"] = -1;
  }

  // ── KV: seller listings array (remove listings owned by this phone) ──────────
  try {
    const r: any = await db.execute(sql`SELECT value FROM kv_store WHERE key = 'biz360_admin_pending_v2'`);
    const val = r?.rows?.[0]?.value;
    if (Array.isArray(val)) {
      const before = val.length;
      const kept = val.filter((l: any) => {
        const cands = [l?.submittedBy, l?.ownerPhone, l?.sellerPhone, l?.phone, l?.contactPhone]
          .map((x) => String(x ?? "").replace(/\D/g, ""));
        return !cands.some((d) => d.length >= 9 && d.endsWith(tail));
      });
      const removed = before - kept.length;
      if (removed) {
        await db.execute(sql`UPDATE kv_store SET value = ${JSON.stringify(kept)}::jsonb, updated_at = now() WHERE key = 'biz360_admin_pending_v2'`);
      }
      summary["listings"] = removed;
    } else {
      summary["listings"] = 0;
    }
  } catch (e: any) {
    logger.error({ err: e?.message }, "[CLEANUP] listings failed");
    summary["listings"] = -1;
  }

  // ── KV: admin users list (remove this person's account entry) ────────────────
  try {
    const r: any = await db.execute(sql`SELECT value FROM kv_store WHERE key = 'biz360_admin_users'`);
    const val = r?.rows?.[0]?.value;
    if (Array.isArray(val)) {
      const before = val.length;
      const kept = val.filter((u: any) => {
        const cands = [u?.id, u?.email, u?.phone].map((x) => String(x ?? "").replace(/\D/g, ""));
        return !cands.some((d) => d.length >= 9 && d.endsWith(tail));
      });
      const removed = before - kept.length;
      if (removed) {
        await db.execute(sql`UPDATE kv_store SET value = ${JSON.stringify(kept)}::jsonb, updated_at = now() WHERE key = 'biz360_admin_users'`);
      }
      summary["admin_users"] = removed;
    } else {
      summary["admin_users"] = 0;
    }
  } catch (e: any) {
    logger.error({ err: e?.message }, "[CLEANUP] admin_users failed");
    summary["admin_users"] = -1;
  }

  // ── KV: analytics blobs (strip this buyer from uniqueBuyerIds) ───────────────
  try {
    const r: any = await db.execute(sql`SELECT key, value FROM kv_store WHERE key LIKE 'biz360_analytics_v1_%'`);
    let touched = 0;
    for (const row of r?.rows ?? []) {
      const v = row.value;
      if (v && Array.isArray(v.uniqueBuyerIds)) {
        const before = v.uniqueBuyerIds.length;
        v.uniqueBuyerIds = v.uniqueBuyerIds.filter((id: any) => {
          const d = String(id ?? "").replace(/\D/g, "");
          return !(d.length >= 9 && d.endsWith(tail));
        });
        if (v.uniqueBuyerIds.length !== before) {
          await db.execute(sql`UPDATE kv_store SET value = ${JSON.stringify(v)}::jsonb, updated_at = now() WHERE key = ${row.key}`);
          touched++;
        }
      }
    }
    summary["analytics_scrubbed"] = touched;
  } catch (e: any) {
    logger.error({ err: e?.message }, "[CLEANUP] analytics failed");
    summary["analytics_scrubbed"] = -1;
  }

  // ── Report-only: surface any other KV row that still references the number ───
  try {
    const contains = `%${tail}%`;
    const r: any = await db.execute(sql`SELECT key FROM kv_store WHERE value::text LIKE ${contains}`);
    const keys = (r?.rows ?? []).map((row: any) => row.key);
    if (keys.length) {
      logger.warn({ keys }, "[CLEANUP] number still referenced in these KV rows (not auto-removed — review if needed)");
    }
  } catch {
    /* best effort */
  }

  logger.info({ phoneTail: tail, summary }, "[CLEANUP] finished — data removed for phone");
}
