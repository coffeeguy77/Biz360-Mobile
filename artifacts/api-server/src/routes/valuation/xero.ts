import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, cafeIntegrationsTable, xeroPLMappingsTable, xeroSupplierMappingsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { assertCafeOwner } from "./cafes";

const router: IRouter = Router();
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;

export async function getValidXeroToken(integration: any, cafeId: string): Promise<string | null> {
  const expiresAt = integration.tokenExpiresAt ? new Date(integration.tokenExpiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 5 * 60 * 1000) return integration.accessToken;
  if (!integration.refreshToken) return null;
  const credentials = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: integration.refreshToken }),
  });
  if (!r.ok) { logger.warn({ status: r.status, cafeId }, "Xero token refresh failed"); return null; }
  const tokens = await r.json() as any;
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db.update(cafeIntegrationsTable).set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: newExpiry }).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero")));
  return tokens.access_token;
}

export async function getXeroFinancials(accessToken: string, tenantId: string, months: number) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const r = await fetch(`https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${fmt(fromDate)}&toDate=${fmt(toDate)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "xero-tenant-id": tenantId, Accept: "application/json" },
  });
  if (!r.ok) return null;
  const data = await r.json() as any;
  const report = data.Reports?.[0];
  if (!report) return null;
  const incomeRows: { name: string; amount: number }[] = [];
  let totalRevenue = 0, totalExpenses = 0;
  for (const row of report.Rows ?? []) {
    if (row.RowType !== "Section") continue;
    const title = (row.Title ?? "").toLowerCase();
    const isIncome = title.includes("income") || title.includes("revenue") || title.includes("trading") || title.includes("sales");
    for (const r2 of row.Rows ?? []) {
      if (r2.RowType === "Row" && isIncome) {
        const name = r2.Cells?.[0]?.Value ?? "";
        const val = parseFloat(r2.Cells?.[1]?.Value ?? "0") || 0;
        if (name && val > 0) incomeRows.push({ name, amount: val });
      } else if (r2.RowType === "SummaryRow") {
        const val = parseFloat(r2.Cells?.[1]?.Value ?? "0") || 0;
        if (isIncome) totalRevenue += val;
        else if (val !== 0) totalExpenses += Math.abs(val);
      }
    }
  }
  return { incomeRows, totalRevenue, totalExpenses };
}

export async function getXeroSupplierSpend(accessToken: string, tenantId: string, months: number) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);
  const xdf = (d: Date) => `DateTime(${d.getFullYear()},${d.getMonth()+1},${d.getDate()})`;
  const contactTotals: Record<string, { name: string; contactId: string; total: number }> = {};
  const headers = { Authorization: `Bearer ${accessToken}`, "xero-tenant-id": tenantId, Accept: "application/json" };
  let page = 1;
  while (true) {
    const where = `Type=="SPEND"&&Date>=${xdf(fromDate)}&&Date<=${xdf(toDate)}`;
    const r = await fetch(`https://api.xero.com/api.xro/2.0/BankTransactions?where=${encodeURIComponent(where)}&page=${page}`, { headers });
    if (!r.ok) break;
    const data = await r.json() as any;
    const txns: any[] = data.BankTransactions ?? [];
    if (txns.length === 0) break;
    for (const t of txns) {
      const contactId = t.Contact?.ContactID ?? t.Contact?.Name ?? "unknown";
      const name = t.Contact?.Name ?? "Unknown";
      const amount = Math.abs(t.Total ?? 0);
      if (!contactTotals[contactId]) contactTotals[contactId] = { name, contactId, total: 0 };
      contactTotals[contactId].total += amount;
    }
    if (txns.length < 100) break;
    page++;
  }
  return Object.values(contactTotals);
}

function xeroDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

router.get("/xero/reports", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, months = "12" } = req.query as Record<string, string>;
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const [integration] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero")));
  if (!integration) return res.status(404).json({ error: "Xero not connected" });
  const accessToken = await getValidXeroToken(integration, cafeId).catch(() => null);
  if (!accessToken) return res.status(401).json({ error: "Xero token expired — please reconnect" });
  const tenantId = integration.metadata && typeof integration.metadata === "object" ? (integration.metadata as any).tenant_id : null;
  if (!tenantId) return res.status(500).json({ error: "No Xero tenant ID found" });
  const m = parseInt(months, 10) || 12;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - m);
  const plMappings = await db.select().from(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId));
  const mapping: Record<string, boolean> = {};
  for (const row of plMappings) { if (row.accountName) mapping[row.accountName] = row.isIncluded ?? true; }
  const url = `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${xeroDateStr(fromDate)}&toDate=${xeroDateStr(toDate)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, "xero-tenant-id": tenantId, Accept: "application/json" } });
  if (!r.ok) { const err = await r.text(); return res.status(502).json({ error: "Xero API error", detail: err.slice(0, 300) }); }
  const data = await r.json() as any;
  const report = data.Reports?.[0];
  if (!report) return res.json({ sections: [] });
  const sections: { title: string; rows: { name: string; amount: number; included: boolean }[]; total: number }[] = [];
  for (const row of report.Rows ?? []) {
    if (row.RowType !== "Section" && row.RowType !== "SummaryRow") continue;
    const title = row.Title ?? (row.RowType === "SummaryRow" ? "Summary" : "");
    const sectionRows: { name: string; amount: number; included: boolean }[] = [];
    let sectionTotal = 0;
    const isIncomeSection = title.toLowerCase().includes("income") || title.toLowerCase().includes("revenue") || title.toLowerCase().includes("trading") || title.toLowerCase().includes("sales");
    for (const r2 of row.Rows ?? []) {
      if (r2.RowType === "Row") {
        const name = r2.Cells?.[0]?.Value ?? "";
        const amount = parseFloat(r2.Cells?.[1]?.Value ?? "0") || 0;
        const included = isIncomeSection ? mapping[name] === true : mapping[name] !== false;
        sectionRows.push({ name, amount, included });
      } else if (r2.RowType === "SummaryRow") {
        sectionTotal = parseFloat(r2.Cells?.[1]?.Value ?? "0") || 0;
      }
    }
    if (row.RowType === "SummaryRow") {
      sections.push({ title: row.Cells?.[0]?.Value ?? "Total", rows: [], total: parseFloat(row.Cells?.[1]?.Value ?? "0") || 0 });
    } else if (title || sectionRows.length) {
      sections.push({ title, rows: sectionRows, total: sectionTotal });
    }
  }
  return res.json({ sections, period: { fromDate: xeroDateStr(fromDate), toDate: xeroDateStr(toDate), months: m } });
});

router.get("/xero/suppliers", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, months = "6", unit_id } = req.query as Record<string, string>;
  if (!cafeId) return res.status(400).json({ error: "cafeId required" });
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  const [integration] = await db.select().from(cafeIntegrationsTable).where(and(eq(cafeIntegrationsTable.cafeId, cafeId), eq(cafeIntegrationsTable.type, "xero")));
  if (!integration) return res.status(404).json({ error: "Xero not connected" });
  const accessToken = await getValidXeroToken(integration, cafeId).catch(() => null);
  if (!accessToken) return res.status(401).json({ error: "Xero token expired — please reconnect" });
  const tenantId = integration.metadata && typeof integration.metadata === "object" ? (integration.metadata as any).tenant_id : null;
  if (!tenantId) return res.status(500).json({ error: "No Xero tenant ID found" });
  const m = parseInt(months, 10) || 6;
  // Scope to exact unit_id match, or to null-unit (whole-business) rows only — never mix
  const supplierMappings = await db.select().from(xeroSupplierMappingsTable).where(
    unit_id
      ? and(eq(xeroSupplierMappingsTable.cafeId, cafeId), eq(xeroSupplierMappingsTable.unitId, unit_id))
      : and(eq(xeroSupplierMappingsTable.cafeId, cafeId), isNull(xeroSupplierMappingsTable.unitId))
  );
  const cogsMap: Record<string, boolean> = {};
  for (const row of supplierMappings) { if (row.contactName) cogsMap[row.contactName] = row.isCogs ?? false; }
  const supplierSpend = await getXeroSupplierSpend(accessToken, tenantId, m);
  const suppliers = supplierSpend.sort((a, b) => b.total - a.total).map((s) => ({ ...s, total: Math.round(s.total * 100) / 100, isCogs: cogsMap[s.name] === true }));
  return res.json({ suppliers, period: { months: m } });
});

router.patch("/xero/pl-mappings", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, mappings } = req.body as { cafeId?: string; mappings?: Array<{ name: string; included: boolean; section?: string }> };
  if (!cafeId || !mappings) return res.status(400).json({ error: "cafeId and mappings required" });
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  await db.delete(xeroPLMappingsTable).where(eq(xeroPLMappingsTable.cafeId, cafeId));
  if (mappings.length > 0) await db.insert(xeroPLMappingsTable).values(mappings.map((m) => ({ cafeId, ownerId: userId, accountName: m.name, isIncluded: m.included, section: m.section ?? null })));
  return res.json({ ok: true });
});

router.patch("/xero/supplier-mappings", async (req, res) => {
  const userId = req.user!.id;
  const { cafeId, mappings, unit_id } = req.body as { cafeId?: string; mappings?: Array<{ name: string; contactId?: string; isCogs: boolean }>; unit_id?: string };
  if (!cafeId || !mappings) return res.status(400).json({ error: "cafeId and mappings required" });
  await assertCafeOwner(cafeId, userId).catch((e) => { res.status(e.status ?? 403).json({ error: e.message }); return null; });
  if (res.headersSent) return;
  // Scope delete precisely: if unit_id provided, delete only that unit's rows;
  // if absent (whole-business), delete only null-unit rows — never touch per-unit rows.
  if (unit_id) {
    await db.delete(xeroSupplierMappingsTable).where(
      and(eq(xeroSupplierMappingsTable.cafeId, cafeId), eq(xeroSupplierMappingsTable.unitId, unit_id))
    );
  } else {
    await db.delete(xeroSupplierMappingsTable).where(
      and(eq(xeroSupplierMappingsTable.cafeId, cafeId), isNull(xeroSupplierMappingsTable.unitId))
    );
  }
  if (mappings.length > 0) await db.insert(xeroSupplierMappingsTable).values(mappings.map((m) => ({ cafeId, ownerId: userId, unitId: unit_id || null, contactName: m.name, contactId: m.contactId ?? null, isCogs: m.isCogs })));
  return res.json({ ok: true });
});

export default router;
