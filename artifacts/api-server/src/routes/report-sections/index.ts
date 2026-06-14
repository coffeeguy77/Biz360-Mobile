import { Router } from "express";
import { and, asc, desc, eq, isNull, max, or, sql } from "drizzle-orm";
import { jwtVerify } from "jose";
import {
  db,
  cafesTable,
  valuationSnapshotsTable,
  businessUnitsTable,
  cafeEquipmentTable,
  ownerAdjustmentsTable,
  sellerLeasesTable,
  sellerLeaseClausesTable,
  reportSectionsTable,
  reportVersionsTable,
  reportCsvImportsTable,
  reportExportsTable,
  reportAccessLogsTable,
  reportAccessGrantsTable,
  reportImagesTable,
  reportVisualsTable,
  kvStore,
} from "@workspace/db";
import multer from "multer";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { buildDefaultSections, SECTION_DEFAULTS } from "../../lib/report-section-defaults";

// ─── Buyer access token verification ─────────────────────────────────────────
// Buyer JWTs are issued by POST /api/biz360/report-access-tokens/issue after
// Twilio OTP verification. They carry { listingId, phone, type }.
async function verifyBuyerAccessToken(
  token: string,
  listingId: string,
): Promise<string | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const p = payload as Record<string, unknown>;
    if (p["type"] !== "buyer-report-access") return null;
    if (p["listingId"] !== listingId) return null;
    return typeof p["phone"] === "string" ? p["phone"] : null;
  } catch {
    return null;
  }
}

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// ─── Ownership helpers ────────────────────────────────────────────────────────

/**
 * Verify a listing belongs to the authenticated user by checking val_cafes.
 * Returns the cafe row or throws a 403-tagged error.
 */
async function assertListingOwner(listingId: string, ownerId: string) {
  const [cafe] = await db
    .select()
    .from(cafesTable)
    .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, ownerId)));
  if (!cafe) {
    const err: Error & { status?: number } = new Error("Listing not found or access denied");
    err.status = 403;
    throw err;
  }
  return cafe;
}

/**
 * Build a Pannellum srcdoc HTML string from tour spaces for embedding in an iframe.
 * Ported from listing-detail.tsx buildMultiSceneSrcdoc — no external dependencies.
 */
function buildTourSrcDoc(spaces: Array<Record<string, unknown>>): string {
  // Escape </script> sequences so they cannot break out of the script block.
  const spacesJson = JSON.stringify(spaces).replace(/<\/script/gi, "<\\/script");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
  #pano{position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none;background:#000}
  @keyframes kfNavFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  .nav-pin-label{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.82);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;white-space:nowrap;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;max-width:130px;overflow:hidden;text-overflow:ellipsis}
  .pnlm-hotspot.pnlm-nav-pin-wrap{background:transparent!important;border:none!important;box-shadow:none!important;width:44px!important;height:44px!important;overflow:visible!important;margin-left:-22px!important;margin-top:-22px!important}
  .pnlm-hotspot.pnlm-nav-pin-wrap::before{display:none!important}
</style>
</head>
<body>
<div id="pano"></div>
<script>
var SPACES=${spacesJson};
function xToYaw(x){return(x-0.5)*360}
function createNavPin(container,args){
  container.style.cssText='width:44px;height:44px;overflow:visible;position:relative;cursor:pointer';
  container.innerHTML='<svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="display:block;animation:kfNavFloat 2.5s ease-in-out infinite"><circle cx="22" cy="22" r="20" fill="white" stroke="#94a3b8" stroke-width="1.5"/><path d="M22 29V17M15 24l7-8 7 8" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var label=document.createElement('span');
  label.className='nav-pin-label';
  label.textContent=args.label;
  container.appendChild(label);
  container.addEventListener('click',function(e){
    e.stopPropagation();
    try{
      var resolvedYaw=typeof args.targetYaw==='number'?args.targetYaw:null;
      var hfov=DEFAULT_HFOV;try{hfov=viewer.getHfov()}catch(e2){}
      viewer.loadScene(args.sceneId,null,resolvedYaw,hfov);
    }catch(err){}
  });
}
var validIds=new Set(SPACES.filter(function(s){return s.panoramaUrl&&String(s.panoramaUrl).indexOf('file://')!==0}).map(function(s){return s.id}));
var firstScene=null,scenesConfig={};
SPACES.forEach(function(s){
  if(!validIds.has(s.id))return;
  if(!firstScene)firstScene=s.id;
  if(s.isStartScene)firstScene=s.id;
  var hotSpots=[];
  (s.pins||[]).forEach(function(pin){
    if(pin.type==='navigation'&&validIds.has(pin.targetSpaceId)){
      hotSpots.push({pitch:40,yaw:xToYaw(pin.position.x),type:'custom',cssClass:'pnlm-nav-pin-wrap',createTooltipFunc:createNavPin,createTooltipArgs:{sceneId:pin.targetSpaceId,label:pin.title,targetYaw:typeof pin.targetYaw==='number'?pin.targetYaw:null}});
    }
  });
  var sc={type:'equirectangular',panorama:s.panoramaUrl,title:s.name,hotSpots:hotSpots,pitch:0,yaw:typeof s.defaultYaw==='number'?s.defaultYaw:(typeof s.panoramaStartYaw==='number'?s.panoramaStartYaw:0)};
  if(typeof s.groundPitch==='number')sc.groundPitch=s.groundPitch;
  scenesConfig[s.id]=sc;
});
var DEFAULT_HFOV=120;
var viewer=pannellum.viewer('pano',{default:{firstScene:firstScene,sceneFadeDuration:800,autoLoad:true,showFullscreenCtrl:false,showZoomCtrl:true,compass:false,friction:0.15,hfov:DEFAULT_HFOV,pitch:0,yaw:0,minHfov:60,maxHfov:150},scenes:scenesConfig});
function doResize(){try{viewer.resize()}catch(e){}}
// Aggressive early resize so WebGL canvas fills the iframe before user touches it
// (prevents the brownish/blank frame that shows until the first drag event).
if(typeof requestAnimationFrame!=='undefined'){
  requestAnimationFrame(function(){doResize();requestAnimationFrame(doResize);});
}
window.addEventListener('load',function(){doResize();setTimeout(doResize,100);setTimeout(doResize,400)});
window.addEventListener('resize',doResize);
viewer.on('scenechange',function(id){
  try{window.parent.postMessage({type:'pano_sceneChange',sceneId:id},'*')}catch(e){}
});
window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='pano_goto'&&e.data.sceneId)try{
    var gotoSp=SPACES.find(function(s){return s.id===e.data.sceneId});
    var gotoYaw=typeof e.data.yaw==='number'?e.data.yaw:(gotoSp&&typeof gotoSp.defaultYaw==='number'?gotoSp.defaultYaw:(gotoSp&&typeof gotoSp.panoramaStartYaw==='number'?gotoSp.panoramaStartYaw:0));
    var currentHfov=DEFAULT_HFOV;try{currentHfov=viewer.getHfov()}catch(e3){}
    viewer.loadScene(e.data.sceneId,0,gotoYaw,currentHfov);
  }catch(e2){}
});
</script>
</body>
</html>`;
}

/**
 * Verify a report section belongs to the authenticated user.
 */
async function assertSectionOwner(sectionId: string, ownerId: string) {
  const [section] = await db
    .select()
    .from(reportSectionsTable)
    .where(and(eq(reportSectionsTable.id, sectionId), eq(reportSectionsTable.ownerId, ownerId)));
  if (!section) {
    const err: Error & { status?: number } = new Error("Report section not found or access denied");
    err.status = 403;
    throw err;
  }
  return section;
}

// ─── GET /api/report-sections/listing/:listingId ─────────────────────────────
// Returns all sections for a listing, ordered by sort_order.
router.get("/report-sections/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);
    const sections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));
    res.json({ sections });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load report sections" });
  }
});

// ─── POST /api/report-sections/defaults/:listingId ───────────────────────────
// Seeds the 40 default section rows for a listing (skips any that already exist).
router.post("/report-sections/defaults/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);
    const defaults = buildDefaultSections(listingId, userId);
    // Insert each default, skip if section_key already exists for this listing
    const inserted = await db
      .insert(reportSectionsTable)
      .values(defaults)
      .onConflictDoNothing()
      .returning({ id: reportSectionsTable.id, sectionKey: reportSectionsTable.sectionKey });
    res.json({ seeded: inserted.length, total: defaults.length });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to seed defaults" });
  }
});

// ─── GET /api/report-sections/auto-fill/:listingId ───────────────────────────
// Returns suggested content for each section key, pulled from live app data.
// Does NOT write to the database — the mobile app confirms before saving.
router.get("/report-sections/auto-fill/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    const cafe = await assertListingOwner(listingId, userId);

    // ── Fetch all data sources in parallel ──────────────────────────────────
    const [latestSnapshot, units, equipment, adjustments, leaseRows, clauseRows] = await Promise.all([
      db
        .select()
        .from(valuationSnapshotsTable)
        .where(and(eq(valuationSnapshotsTable.cafeId, cafe.id), eq(valuationSnapshotsTable.isPublished, true), sql`${valuationSnapshotsTable.unitId} IS NULL`))
        .orderBy(desc(valuationSnapshotsTable.createdAt))
        .limit(1),
      db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafe.id)),
      db.select().from(cafeEquipmentTable).where(and(eq(cafeEquipmentTable.cafeId, cafe.id), eq(cafeEquipmentTable.suspended, false))),
      db.select().from(ownerAdjustmentsTable).where(eq(ownerAdjustmentsTable.cafeId, cafe.id)),
      db.select().from(sellerLeasesTable).where(eq(sellerLeasesTable.userId, userId)),
      db.select().from(sellerLeaseClausesTable).where(eq(sellerLeaseClausesTable.userId, userId)),
    ]);

    const snap = latestSnapshot[0] ?? null;
    const includedUnits = units.filter((u) => u.isIncludedInSale);

    // ── Format helpers ───────────────────────────────────────────────────────
    const fmt = (n: string | null | undefined) =>
      n ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "Not available";

    const suggestions: Record<string, {
      suggestedBody: string;
      suggestedBullets: string[];
      tableData: Record<string, unknown> | null;
      sourceLabel: string;
    }> = {};

    // ── app_valuation_summary ────────────────────────────────────────────────
    if (snap) {
      const low  = snap.adjustedEbitda ? Number(snap.adjustedEbitda) * 2.0 + Number(snap.totalEquipmentValue ?? 0) : null;
      const high = snap.adjustedEbitda ? Number(snap.adjustedEbitda) * 2.5 + Number(snap.totalEquipmentValue ?? 0) : null;
      suggestions["app_valuation_summary"] = {
        suggestedBody: [
          `Business Name: ${cafe.name}`,
          `Estimated Value: ${fmt(snap.valuationMidpoint?.toString())}`,
          snap.grossRevenue    ? `Revenue: ${fmt(snap.grossRevenue.toString())}`          : null,
          snap.adjustedEbitda  ? `Adjusted EBITDA: ${fmt(snap.adjustedEbitda.toString())}` : null,
          snap.totalEquipmentValue ? `Equipment Value: ${fmt(snap.totalEquipmentValue.toString())}` : null,
          low && high ? `Valuation Range: ${fmt(low.toString())} – ${fmt(high.toString())}` : null,
        ].filter(Boolean).join("\n"),
        suggestedBullets: [],
        tableData: {
          rows: [
            { label: "Gross Revenue",    value: fmt(snap.grossRevenue?.toString()) },
            { label: "COGS",             value: fmt(snap.cogs?.toString()) },
            { label: "Gross Profit",     value: fmt(snap.grossProfit?.toString()) },
            { label: "EBITDA",           value: fmt(snap.ebitda?.toString()) },
            { label: "Adjusted EBITDA",  value: fmt(snap.adjustedEbitda?.toString()) },
            { label: "Equipment Value",  value: fmt(snap.totalEquipmentValue?.toString()) },
            { label: "Indicative Value", value: fmt(snap.valuationMidpoint?.toString()) },
          ],
        },
        sourceLabel: "app_generated",
      };
    }

    // ── financial_performance_summary ────────────────────────────────────────
    if (snap) {
      suggestions["financial_performance_summary"] = {
        suggestedBody: [
          snap.grossRevenue   ? `Gross Revenue: ${fmt(snap.grossRevenue.toString())}` : null,
          snap.cogs           ? `COGS: ${fmt(snap.cogs.toString())}` : null,
          snap.grossProfit    ? `Gross Profit: ${fmt(snap.grossProfit.toString())}` : null,
          snap.ebitda         ? `EBITDA: ${fmt(snap.ebitda.toString())}` : null,
          snap.adjustedEbitda ? `Adjusted EBITDA: ${fmt(snap.adjustedEbitda.toString())}` : null,
        ].filter(Boolean).join("\n"),
        suggestedBullets: [],
        tableData: null,
        sourceLabel: "app_generated",
      };
    }

    // ── addbacks_adjusted_ebitda ─────────────────────────────────────────────
    if (adjustments.length > 0) {
      const bullets = adjustments.map(
        (a) => `${a.label}: ${fmt(a.annualAmount.toString())} per year`,
      );
      const totalAddbacks = adjustments.reduce((s, a) => s + Number(a.annualAmount), 0);
      suggestions["addbacks_adjusted_ebitda"] = {
        suggestedBody: `Total addbacks: ${fmt(totalAddbacks.toString())} per year across ${adjustments.length} item${adjustments.length !== 1 ? "s" : ""}.`,
        suggestedBullets: bullets,
        tableData: null,
        sourceLabel: "app_generated",
      };
    }

    // ── division_breakdown ───────────────────────────────────────────────────
    if (units.length > 0) {
      const bullets = includedUnits.map(
        (u) => `${u.name} — ${u.revenueSharePct}% of revenue`,
      );
      suggestions["division_breakdown"] = {
        suggestedBody: `This business has ${includedUnits.length} division${includedUnits.length !== 1 ? "s" : ""} included in the sale.`,
        suggestedBullets: bullets,
        tableData: null,
        sourceLabel: "app_generated",
      };
    }

    // ── plant_equipment_summary ──────────────────────────────────────────────
    if (equipment.length > 0) {
      const totalSecondhand = equipment.reduce((s, e) => s + Number(e.secondhandValue ?? e.currentValue ?? 0), 0);
      const categories: Record<string, number> = {};
      for (const e of equipment) {
        const cat = e.category ?? "Other";
        categories[cat] = (categories[cat] ?? 0) + 1;
      }
      const catSummary = Object.entries(categories)
        .map(([cat, count]) => `${cat} (${count} item${count !== 1 ? "s" : ""})`)
        .join(", ");
      suggestions["plant_equipment_summary"] = {
        suggestedBody: `${equipment.length} items in the equipment register with a total estimated second-hand value of ${fmt(totalSecondhand.toString())}. Categories: ${catSummary}.`,
        suggestedBullets: equipment
          .sort((a, b) => Number(b.secondhandValue ?? b.currentValue ?? 0) - Number(a.secondhandValue ?? a.currentValue ?? 0))
          .slice(0, 10)
          .map((e) => `${e.name}${e.category ? ` (${e.category})` : ""} — ${fmt((e.secondhandValue ?? e.currentValue)?.toString())}`),
        tableData: { totalItems: equipment.length, totalSecondhandValue: totalSecondhand, categories },
        sourceLabel: "app_generated",
      };
    }

    // ── lease_premises_summary ───────────────────────────────────────────────
    if (leaseRows.length > 0) {
      const leaseData = leaseRows.map((r) => r.data as Record<string, unknown>);
      const leaseCount = leaseData.length;
      const clauseCount = clauseRows.length;

      const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const cr of clauseRows) {
        const d = cr.data as Record<string, unknown>;
        const risk = (d.riskLevel as string)?.toLowerCase();
        if (risk === "critical") riskCounts.critical++;
        else if (risk === "high") riskCounts.high++;
        else if (risk === "medium") riskCounts.medium++;
        else if (risk === "low") riskCounts.low++;
      }

      suggestions["lease_premises_summary"] = {
        suggestedBody: `${leaseCount} lease document${leaseCount !== 1 ? "s" : ""} have been uploaded and analysed. ${clauseCount} clause${clauseCount !== 1 ? "s" : ""} identified.`,
        suggestedBullets: [],
        tableData: { leaseCount, clauseCount, riskCounts },
        sourceLabel: "app_generated",
      };

      // ── lease_risk_valuation_impact ────────────────────────────────────────
      suggestions["lease_risk_valuation_impact"] = {
        suggestedBody: `Lease risk profile: ${riskCounts.critical} critical, ${riskCounts.high} high, ${riskCounts.medium} medium, ${riskCounts.low} low risk clauses.`,
        suggestedBullets: [],
        tableData: { riskCounts },
        sourceLabel: "app_generated",
      };
    }

    // ── 360_business_walkthrough ─────────────────────────────────────────────
    // Pull live tour spaces from the KV store. Spaces migrated v1 → v2; read v2 first.
    const [tourRowV2] = await db
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(eq(kvStore.key, `biz360_tour_spaces_v2_${listingId}`))
      .limit(1);
    let tourSpaces: Record<string, unknown>[] = Array.isArray(tourRowV2?.value) ? (tourRowV2.value as Record<string, unknown>[]) : [];
    if (tourSpaces.length === 0) {
      const [tourRowV1] = await db
        .select({ value: kvStore.value })
        .from(kvStore)
        .where(eq(kvStore.key, `biz360_tour_spaces_v1_${listingId}`))
        .limit(1);
      tourSpaces = Array.isArray(tourRowV1?.value) ? (tourRowV1.value as Record<string, unknown>[]) : [];
    }
    const spaceCount = tourSpaces.length;
    const spaceNames = tourSpaces
      .map((s) => s.name as string | undefined)
      .filter(Boolean)
      .slice(0, 8) as string[];

    suggestions["360_business_walkthrough"] = {
      suggestedBody: spaceCount > 0
        ? `A virtual 360° walkthrough of the business premises is available with ${spaceCount} space${spaceCount !== 1 ? "s" : ""} captured. Buyers can explore each area, view equipment in context, and experience the layout before visiting in person.`
        : "A virtual 360° walkthrough of the business premises can be added via the Tour section of the app. Buyers can explore each space, view equipment in context, and listen to audio narrations for key areas.",
      suggestedBullets: spaceNames.map((name) => `360° view: ${name}`),
      tableData: spaceCount > 0 ? { spaceCount, spaceNames } : null,
      sourceLabel: "app_generated",
    };

    res.json({ suggestions, cafeId: cafe.id });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Auto-fill failed" });
  }
});

// ─── RFC 4180 CSV helpers ─────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRowStr(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      row.push(cell); cell = '';
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      i++; continue;
    }
    cell += ch; i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

const CSV_HEADER = [
  'listing_id', 'section_key', 'section_title', 'section_subtitle',
  'main_body', 'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4',
  'bullet_5', 'bullet_6', 'bullet_7', 'bullet_8',
  'table_json', 'chart_json',
  'visibility', 'include_in_pdf', 'include_in_html', 'include_in_app',
  'ai_instruction', 'seller_notes', 'status',
];

const VALID_VISIBILITY = new Set([
  'public', 'approved_buyers', 'verified_buyer', 'nda_signed', 'seller_only', 'hidden',
]);

// ─── GET /api/report-sections/csv-template/:listingId ────────────────────────
// Generates a pre-filled CSV template with all 40 sections and AI instructions.
router.get("/report-sections/csv-template/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);

    // Load existing sections (ordered by sort_order)
    const existingSections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));

    // Build a map from SECTION_DEFAULTS for AI instruction fallback
    const defaultAiMap: Record<string, string> = {};
    for (const def of SECTION_DEFAULTS) defaultAiMap[def.sectionKey] = def.aiInstruction;

    // Always output all 40 canonical sections in SECTION_DEFAULTS order.
    // Overlay any existing section content by sectionKey so partial listings
    // still produce a complete 40-row template.
    const existingByKey = new Map(existingSections.map((s) => [s.sectionKey, s]));
    const rows = SECTION_DEFAULTS.map((def) => {
      const existing = existingByKey.get(def.sectionKey);
      if (existing) return existing;
      return {
        id: '' as string,
        listingId,
        ownerId: userId,
        sectionKey: def.sectionKey,
        title: def.title,
        subtitle: def.subtitle as string | null,
        body: null as string | null,
        bulletPoints: [] as string[],
        tableData: null as unknown,
        chartData: null as unknown,
        aiInstruction: def.aiInstruction as string | null,
        sellerNotes: null as string | null,
        visibility: def.visibility,
        includeInPdf: def.includeInPdf,
        includeInHtml: def.includeInHtml,
        includeInApp: def.includeInApp,
        sortOrder: def.sortOrder,
        isRequired: def.isRequired,
        isAutoGenerated: def.isAutoGenerated,
        isAiEditable: true,
        status: 'empty' as string,
        dataSource: 'seller_supplied',
        lastUpdatedAt: null as Date | null,
        createdAt: null as Date | null,
      };
    });

    const lines: string[] = [csvRowStr(CSV_HEADER)];

    for (const s of rows) {
      const bullets = Array.isArray(s.bulletPoints) ? (s.bulletPoints as string[]) : [];
      lines.push(csvRowStr([
        listingId,
        s.sectionKey,
        s.title,
        s.subtitle ?? '',
        s.body ?? '',
        bullets[0] ?? '', bullets[1] ?? '', bullets[2] ?? '',
        bullets[3] ?? '', bullets[4] ?? '', bullets[5] ?? '',
        bullets[6] ?? '', bullets[7] ?? '',
        s.tableData ? JSON.stringify(s.tableData) : '',
        s.chartData ? JSON.stringify(s.chartData) : '',
        s.visibility ?? 'public',
        (s.includeInPdf ?? true) ? '1' : '0',
        (s.includeInHtml ?? true) ? '1' : '0',
        (s.includeInApp ?? true) ? '1' : '0',
        s.aiInstruction ?? defaultAiMap[s.sectionKey] ?? '',
        s.sellerNotes ?? '',
        s.status ?? 'empty',
      ]));
    }

    const csv = lines.join('\r\n') + '\r\n';
    const filename = `im-report-${listingId}-template.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to generate CSV template" });
  }
});

// ─── POST /api/report-sections/csv-import/:listingId?preview=true|false ───────
// preview=true  → dry-run diff (no DB writes); preview=false → write to DB.
// Body: multipart/form-data with a field named "file" containing the CSV.
router.post("/report-sections/csv-import/:listingId", requireAuth, csvUpload.single("file"), async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const isPreview = req.query['preview'] !== 'false';
  try {
    await assertListingOwner(listingId, userId);

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with a "file" field.' });
      return;
    }
    const csvText = req.file.buffer.toString("utf-8");
    if (!csvText.trim()) {
      res.status(400).json({ error: 'Uploaded file is empty' });
      return;
    }

    const allRows = parseCsvRows(csvText);
    if (allRows.length < 2) {
      res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
      return;
    }

    const header = allRows[0].map((h) => h.trim().toLowerCase());
    const dataRows = allRows.slice(1);

    // Validate required columns
    const missingCols = ['section_key', 'main_body'].filter((c) => !header.includes(c));
    if (missingCols.length > 0) {
      res.status(400).json({ error: `Missing required columns: ${missingCols.join(', ')}` });
      return;
    }

    const col = (row: string[], name: string): string => {
      const idx = header.indexOf(name);
      return idx >= 0 ? (row[idx] ?? '') : '';
    };

    // Load existing sections with full content for true diff computation
    const existingSections = await db
      .select({
        id:           reportSectionsTable.id,
        sectionKey:   reportSectionsTable.sectionKey,
        dataSource:   reportSectionsTable.dataSource,
        body:         reportSectionsTable.body,
        bulletPoints: reportSectionsTable.bulletPoints,
        tableData:    reportSectionsTable.tableData,
        subtitle:     reportSectionsTable.subtitle,
        title:        reportSectionsTable.title,
        sellerNotes:  reportSectionsTable.sellerNotes,
        visibility:   reportSectionsTable.visibility,
        status:       reportSectionsTable.status,
        includeInPdf:  reportSectionsTable.includeInPdf,
        includeInHtml: reportSectionsTable.includeInHtml,
        includeInApp:  reportSectionsTable.includeInApp,
      })
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId));
    const sectionMap = new Map(existingSections.map((s) => [s.sectionKey, s]));
    const knownKeys = new Set(SECTION_DEFAULTS.map((d) => d.sectionKey));

    // Returns true only when incoming string differs from stored value
    const wouldChange = (current: unknown, incoming: string): boolean => {
      if (!incoming) return false;
      const stored = current === null || current === undefined ? '' : String(current);
      return stored !== incoming;
    };

    const unknownKeysSet = new Set<string>();
    const invalidVisSet = new Set<string>();
    let validRowCount = 0;
    let matchedCount = 0;
    let changedFields = 0;
    const previewRows: Record<string, string>[] = [];

    type UpdateOp = {
      id: string;
      sectionKey: string;
      fields: Partial<typeof reportSectionsTable.$inferInsert>;
    };
    const updateOperations: UpdateOp[] = [];

    for (const row of dataRows) {
      const sectionKey = col(row, 'section_key').trim();
      if (!sectionKey) continue;

      if (!knownKeys.has(sectionKey)) {
        unknownKeysSet.add(sectionKey);
        continue;
      }

      validRowCount++;

      const existing = sectionMap.get(sectionKey);
      if (!existing) continue;

      matchedCount++;

      const visRaw = col(row, 'visibility').trim();
      if (visRaw && !VALID_VISIBILITY.has(visRaw)) {
        invalidVisSet.add(`${sectionKey}: "${visRaw}"`);
      }

      const bullets: string[] = [];
      for (let bi = 1; bi <= 8; bi++) {
        const b = col(row, `bullet_${bi}`).trim();
        if (b) bullets.push(b);
      }

      const tableJsonRaw = col(row, 'table_json').trim();
      let tableData: Record<string, unknown> | null = null;
      if (tableJsonRaw) {
        try { tableData = JSON.parse(tableJsonRaw); } catch { /* ignore malformed JSON */ }
      }

      const isAppGenerated = existing.dataSource === 'app_generated';

      const fields: Partial<typeof reportSectionsTable.$inferInsert> = {};
      const body      = col(row, 'main_body').trim();
      const subtitle  = col(row, 'section_subtitle').trim();
      const title     = col(row, 'section_title').trim();
      const selNotes  = col(row, 'seller_notes').trim();
      const statusRaw = col(row, 'status').trim();
      const inclPdf   = col(row, 'include_in_pdf').trim();
      const inclHtml  = col(row, 'include_in_html').trim();
      const inclApp   = col(row, 'include_in_app').trim();

      // Financial content fields: only write for non-app-generated sections (true diff)
      if (!isAppGenerated) {
        if (body && wouldChange(existing.body, body)) {
          fields.body = body; changedFields++;
        }
        if (bullets.length) {
          const storedBullets = JSON.stringify(Array.isArray(existing.bulletPoints) ? existing.bulletPoints : []);
          if (storedBullets !== JSON.stringify(bullets)) { fields.bulletPoints = bullets; changedFields++; }
        }
        if (tableData) { fields.tableData = tableData as any; changedFields++; }
      }

      // Metadata fields: true diff, safe to update regardless of data source
      if (wouldChange(existing.subtitle, subtitle))    { fields.subtitle = subtitle;   changedFields++; }
      if (wouldChange(existing.title, title))          { fields.title = title;          changedFields++; }
      if (wouldChange(existing.sellerNotes, selNotes)) { fields.sellerNotes = selNotes; changedFields++; }
      if (visRaw && VALID_VISIBILITY.has(visRaw) && wouldChange(existing.visibility, visRaw)) {
        fields.visibility = visRaw; changedFields++;
      }
      if (statusRaw && ['empty', 'draft', 'complete', 'needs_review'].includes(statusRaw) && wouldChange(existing.status, statusRaw)) {
        fields.status = statusRaw; changedFields++;
      }
      if (inclPdf !== '') {
        const newVal = ['1', 'true', 'yes'].includes(inclPdf.toLowerCase());
        if (newVal !== existing.includeInPdf) { fields.includeInPdf = newVal; changedFields++; }
      }
      if (inclHtml !== '') {
        const newVal = ['1', 'true', 'yes'].includes(inclHtml.toLowerCase());
        if (newVal !== existing.includeInHtml) { fields.includeInHtml = newVal; changedFields++; }
      }
      if (inclApp !== '') {
        const newVal = ['1', 'true', 'yes'].includes(inclApp.toLowerCase());
        if (newVal !== existing.includeInApp) { fields.includeInApp = newVal; changedFields++; }
      }

      // Preserve app-generated data source label; mark others as csv_imported
      if (!isAppGenerated) { fields.dataSource = 'csv_imported'; }

      updateOperations.push({ id: existing.id, sectionKey, fields });

      if (previewRows.length < 5) {
        previewRows.push({
          section_key:   sectionKey,
          section_title: title || col(row, 'section_title'),
          main_body:     body.slice(0, 100) + (body.length > 100 ? '…' : ''),
          visibility:    visRaw || 'unchanged',
          status:        statusRaw || 'unchanged',
          bullets:       bullets.length ? `${bullets.length} bullet${bullets.length !== 1 ? 's' : ''}` : '—',
        });
      }
    }

    if (isPreview) {
      res.json({
        rowCount:          dataRows.length,
        validRowCount,
        matchedCount,
        unknownKeys:       [...unknownKeysSet],
        invalidVisibility: [...invalidVisSet],
        changedFields,
        previewRows,
      });
      return;
    }

    // ── Write to DB ──────────────────────────────────────────────────────────
    for (const op of updateOperations) {
      await db
        .update(reportSectionsTable)
        .set({ ...op.fields, lastUpdatedAt: new Date() })
        .where(and(eq(reportSectionsTable.id, op.id), eq(reportSectionsTable.ownerId, userId)));
    }

    // ── Audit log ────────────────────────────────────────────────────────────
    const fileName = req.file?.originalname ?? 'imported.csv';
    await db.insert(reportCsvImportsTable).values({
      listingId,
      ownerId:       userId,
      fileName,
      rowCount:      dataRows.length,
      matchedCount,
      unknownKeys:   [...unknownKeysSet],
      status:        'complete',
      importSummary: { changedFields, invalidVisibility: [...invalidVisSet] } as any,
    });

    res.json({ ok: true, updated: matchedCount, changedFields });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'CSV import failed' });
  }
});

// ─── GET /api/report-sections/:id/detail ─────────────────────────────────────
// Returns a single report section by ID (ownership verified).
// Note: this route must be defined before /:listingId to avoid prefix conflicts,
// but since /:id/detail has 2 path segments and /:listingId has 1, Express
// resolves them correctly regardless of order.
router.get("/report-sections/:id/detail", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  try {
    const section = await assertSectionOwner(id, userId);
    res.json({ section });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load section" });
  }
});

// ─── POST /api/report-sections ────────────────────────────────────────────────
// Create a single report section. Used when the mobile app saves a new custom section.
router.post("/report-sections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const body = req.body as Partial<typeof reportSectionsTable.$inferInsert>;
  if (!body.listingId || !body.sectionKey || !body.title) {
    res.status(400).json({ error: "listingId, sectionKey, and title are required" });
    return;
  }
  try {
    await assertListingOwner(body.listingId, userId);
    const [created] = await db
      .insert(reportSectionsTable)
      .values({ ...body, listingId: body.listingId!, sectionKey: body.sectionKey!, title: body.title!, ownerId: userId, lastUpdatedAt: new Date() })
      .returning();
    res.status(201).json({ section: created });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to create section" });
  }
});

// ─── PUT /api/report-sections/:id ────────────────────────────────────────────
// Full replace of an existing section (ownership verified).
router.put("/report-sections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  try {
    await assertSectionOwner(id, userId);
    const updates = req.body as Partial<typeof reportSectionsTable.$inferInsert>;
    const [updated] = await db
      .update(reportSectionsTable)
      .set({ ...updates, ownerId: userId, lastUpdatedAt: new Date() })
      .where(and(eq(reportSectionsTable.id, id), eq(reportSectionsTable.ownerId, userId)))
      .returning();
    res.json({ section: updated });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to update section" });
  }
});

// ─── PATCH /api/report-sections/:id ──────────────────────────────────────────
// Partial update — used for toggling visibility, sort order, include flags, status.
router.patch("/report-sections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  try {
    await assertSectionOwner(id, userId);
    const updates = req.body as Partial<typeof reportSectionsTable.$inferInsert>;
    // Strip fields that should never be patched this way
    const { listingId: _l, ownerId: _o, id: _i, createdAt: _c, ...safe } = updates as Record<string, unknown>;
    void _l; void _o; void _i; void _c;
    const [updated] = await db
      .update(reportSectionsTable)
      .set({ ...(safe as Partial<typeof reportSectionsTable.$inferInsert>), lastUpdatedAt: new Date() })
      .where(and(eq(reportSectionsTable.id, id), eq(reportSectionsTable.ownerId, userId)))
      .returning();
    res.json({ section: updated });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to patch section" });
  }
});

// ─── DELETE /api/report-sections/:id ─────────────────────────────────────────
router.delete("/report-sections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  try {
    const section = await assertSectionOwner(id, userId);
    if (section.isRequired) {
      res.status(400).json({ error: "Required sections cannot be deleted" });
      return;
    }
    await db
      .delete(reportSectionsTable)
      .where(and(eq(reportSectionsTable.id, id), eq(reportSectionsTable.ownerId, userId)));
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to delete section" });
  }
});

// ─── POST /api/report-sections/bulk-update ────────────────────────────────────
// Bulk-update multiple sections at once (used by CSV import and sort reorder).
// Body: { listingId, updates: Array<{ id?, sectionKey, ...fields }> }
router.post("/report-sections/bulk-update", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, updates } = req.body as {
    listingId: string;
    updates: Array<Partial<typeof reportSectionsTable.$inferInsert> & { sectionKey: string }>;
  };
  if (!listingId || !Array.isArray(updates)) {
    res.status(400).json({ error: "listingId and updates array required" });
    return;
  }
  try {
    await assertListingOwner(listingId, userId);
    const results: unknown[] = [];
    for (const u of updates) {
      const { sectionKey, id, listingId: _l, ownerId: _o, createdAt: _c, ...fields } = u as Record<string, unknown>;
      void _l; void _o; void _c;
      const [updated] = await db
        .update(reportSectionsTable)
        .set({ ...(fields as Partial<typeof reportSectionsTable.$inferInsert>), lastUpdatedAt: new Date() })
        .where(
          and(
            eq(reportSectionsTable.listingId, listingId),
            eq(reportSectionsTable.ownerId, userId),
            sectionKey ? eq(reportSectionsTable.sectionKey, sectionKey as string) : eq(reportSectionsTable.id, id as string),
          ),
        )
        .returning();
      if (updated) results.push(updated);
    }
    res.json({ updated: results.length });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Bulk update failed" });
  }
});

// ─── GET /api/report-versions/listing/:listingId ─────────────────────────────
router.get("/report-versions/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);
    const versions = await db
      .select()
      .from(reportVersionsTable)
      .where(and(eq(reportVersionsTable.listingId, listingId), eq(reportVersionsTable.ownerId, userId)))
      .orderBy(desc(reportVersionsTable.versionNumber));
    res.json({ versions });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load versions" });
  }
});

// ─── POST /api/report-versions ───────────────────────────────────────────────
// Creates a new version snapshot from all current section content.
router.post("/report-versions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, title, status } = req.body as {
    listingId: string;
    title?: string;
    status?: string;
  };
  if (!listingId) {
    res.status(400).json({ error: "listingId required" });
    return;
  }
  try {
    await assertListingOwner(listingId, userId);

    // Get current max version number
    const [maxRow] = await db
      .select({ maxVer: max(reportVersionsTable.versionNumber) })
      .from(reportVersionsTable)
      .where(eq(reportVersionsTable.listingId, listingId));
    const nextVersion = (maxRow?.maxVer ?? 0) + 1;

    // Snapshot all current sections
    const sections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));

    const [version] = await db
      .insert(reportVersionsTable)
      .values({
        listingId,
        ownerId: userId,
        versionNumber: nextVersion,
        title: title ?? `Version ${nextVersion}`,
        status: "draft",
        snapshotJson: sections as unknown as Record<string, unknown>,
        createdBy: userId,
      })
      .returning();

    // Log the export
    await db.insert(reportExportsTable).values({
      listingId,
      ownerId: userId,
      versionId: version.id,
      exportType: "version_snapshot",
    });

    res.status(201).json({ version });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to create version" });
  }
});

// ─── PATCH /api/report-versions/:id ──────────────────────────────────────────
// Update version status (e.g. draft → published) and store HTML/PDF URLs.
router.patch("/report-versions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  const { status, generatedHtmlUrl, generatedPdfUrl, title } = req.body as {
    status?: string;
    generatedHtmlUrl?: string;
    generatedPdfUrl?: string;
    title?: string;
  };
  try {
    const [version] = await db
      .select()
      .from(reportVersionsTable)
      .where(and(eq(reportVersionsTable.id, id), eq(reportVersionsTable.ownerId, userId)));
    if (!version) {
      res.status(403).json({ error: "Version not found or access denied" });
      return;
    }
    // Auto-generate shareable HTML URL when publishing for the first time
    let computedHtmlUrl = generatedHtmlUrl;
    if (status === "published" && !version.generatedHtmlUrl && !generatedHtmlUrl) {
      const domain = process.env.REPLIT_DEV_DOMAIN;
      if (domain) {
        computedHtmlUrl = `https://${domain}/exit360-web/reports/${version.listingId}/${id}`;
      }
    }

    const [updated] = await db
      .update(reportVersionsTable)
      .set({
        ...(status !== undefined && { status }),
        ...(computedHtmlUrl !== undefined && { generatedHtmlUrl: computedHtmlUrl }),
        ...(generatedPdfUrl !== undefined && { generatedPdfUrl }),
        ...(title !== undefined && { title }),
      })
      .where(and(eq(reportVersionsTable.id, id), eq(reportVersionsTable.ownerId, userId)))
      .returning();
    res.json({ version: updated });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to update version" });
  }
});

// ─── GET /api/report-sections/html/:listingId ────────────────────────────────
// Access tiers:
//   - No auth / public: public sections shown; approved_buyers sections locked
//     (content stripped, isLocked: true). seller_only sections excluded.
//   - Seller JWT (ownership verified): all non-hidden sections unlocked.
// Buyer OTP-based unlocking is handled by the buyer access task (Task #78).
// Raw phone params are intentionally absent — no proof-of-possession bypass.
router.get("/report-sections/html/:listingId", async (req, res): Promise<void> => {
  const { listingId } = req.params as { listingId: string };
  try {
    const allSections = await db
      .select()
      .from(reportSectionsTable)
      .where(eq(reportSectionsTable.listingId, listingId))
      .orderBy(asc(reportSectionsTable.sortOrder));

    if (!allSections.length) {
      res.json({ sections: [], accessLevel: "public", meta: { businessName: "Confidential Business", listingId } });
      return;
    }

    // Fetch business cover metadata from the KV store / cafes table
    const [cafeRow] = await db
      .select({ id: cafesTable.id, name: cafesTable.name })
      .from(cafesTable)
      .where(eq(cafesTable.listingId, listingId))
      .limit(1);

    // Supplement with richer listing data from the KV store
    const kvRows = await db.select().from(kvStore).where(eq(kvStore.key, "biz360_admin_pending_v2")).limit(1);
    const allListings = Array.isArray(kvRows[0]?.value) ? (kvRows[0].value as any[]) : [];
    const listing = allListings.find((l: any) => l.listingId === listingId);

    // Business name priority: cafes table (if real) → KV listing aliases → fallback
    // Placeholder names like "My Business" are treated as absent.
    const PLACEHOLDER_NAMES = new Set([
      "my business", "my business name", "business name", "business",
      "test", "test business", "n/a", "na", "",
    ]);
    const isCafeNameReal = cafeRow?.name && !PLACEHOLDER_NAMES.has(cafeRow.name.toLowerCase().trim());
    const kvName = listing
      ? (listing.businessName ?? listing.business_name ?? listing.name ??
         listing.tradingName ?? listing.trading_name ?? listing.title ?? null)
      : null;
    const isKvNameReal = kvName && !PLACEHOLDER_NAMES.has(String(kvName).toLowerCase().trim());

    let coverMeta: Record<string, unknown> = {
      businessName: (isCafeNameReal ? cafeRow!.name : null) ?? (isKvNameReal ? kvName : null) ?? "Confidential Business",
      listingId,
    };

    if (listing) {
      coverMeta = {
        ...coverMeta,
        location:      listing.location ?? listing.suburb ?? listing.state ?? null,
        category:      listing.category ?? listing.businessType ?? listing.industry ?? null,
        askingPrice:   listing.askingPrice ?? listing.asking_price ?? null,
        badges:        listing.badges ?? (listing.verified ? ["Exit360 Verified"] : []),
        heroImageUrl:  listing.heroImage ?? listing.hero_image ?? listing.imageUrl ?? null,
      };
    }

    // Determine who is asking — only a verified seller JWT elevates above public.
    const authHeader = req.headers.authorization;
    let accessLevel: "public" | "seller" = "public";

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyToken } = await import("../../middlewares/auth");
        const userId = await verifyToken(authHeader.slice(7));
        if (userId) {
          const [ownerRow] = await db
            .select({ id: cafesTable.id })
            .from(cafesTable)
            .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)))
            .limit(1);
          if (ownerRow) accessLevel = "seller";
        }
      } catch { /* fall through to public */ }
    }

    // Check buyer access token (issued by /api/biz360/report-access-tokens/issue
    // after Twilio OTP verification). Token carries phone + listingId claim.
    let buyerGranted = false;
    if (accessLevel === "public") {
      const accessToken = req.query["accessToken"] as string | undefined;
      if (accessToken) {
        const phone = await verifyBuyerAccessToken(accessToken, listingId);
        if (phone) {
          const [grant] = await db
            .select({ id: reportAccessGrantsTable.id })
            .from(reportAccessGrantsTable)
            .where(
              and(
                eq(reportAccessGrantsTable.listingId, listingId),
                eq(reportAccessGrantsTable.phone, phone.replace(/\s/g, "")),
              ),
            )
            .limit(1);
          buyerGranted = !!grant;
        }
      }
    }

    // Sanitise fields that must never reach non-seller viewers regardless of section visibility.
    // sellerNotes and aiInstruction are seller-internal and must be stripped at the API layer.
    function sanitiseForNonSeller<T extends Record<string, unknown>>(s: T): T {
      return { ...s, sellerNotes: null, aiInstruction: null };
    }

    // Filter and gate sections based on access level
    const filtered = allSections
      .filter((s) => {
        if (!s.includeInHtml) return false;
        if (s.visibility === "hidden") return false;
        if (s.visibility === "seller_only") return accessLevel === "seller";
        return true;
      })
      .map((s) => {
        // approved_buyers: unlocked for sellers and OTP-verified approved buyers.
        if (s.visibility === "approved_buyers" && accessLevel !== "seller" && !buyerGranted) {
          const locked = {
            ...s,
            body:         null,
            bulletPoints: [] as string[],
            tableData:    null,
            chartData:    null,
            isLocked:     true,
          };
          return sanitiseForNonSeller(locked);
        }
        const withLock = { ...s, isLocked: false };
        return accessLevel === "seller" ? withLock : sanitiseForNonSeller(withLock);
      });

    // ── Fetch report images (HTML-visible) ────────────────────────────────────
    // Includes non-panoramic images + 360_preview panoramics (for section cards
    // and diagnostics). Cover-hero chain only picks non-panoramic images.
    // Ordered: isPrimary=true first, then sortOrder ASC.
    const reportImages = await db
      .select({
        id:                   reportImagesTable.id,
        url:                  reportImagesTable.cloudinarySecureUrl,
        thumbnailUrl:         reportImagesTable.cloudinarySecureUrl,
        cloudinaryPublicId:   reportImagesTable.cloudinaryPublicId,
        imageRole:            reportImagesTable.imageRole,
        displayName:          reportImagesTable.displayName,
        caption:              reportImagesTable.caption,
        altText:              reportImagesTable.altText,
        isPrimary:            reportImagesTable.isPrimary,
        includeInPdf:         reportImagesTable.includeInPdf,
        includeInHtml:        reportImagesTable.includeInHtml,
        includeInBuyerReport: reportImagesTable.includeInBuyerReport,
        includeInSellerReport:reportImagesTable.includeInSellerReport,
        sectionKey:           reportImagesTable.sectionKey,
        sortOrder:            reportImagesTable.sortOrder,
        isPanoramic:          reportImagesTable.isPanoramic,
        sourceType:           reportImagesTable.sourceType,
      })
      .from(reportImagesTable)
      .where(
        and(
          eq(reportImagesTable.listingId, listingId),
          // Allow non-panoramic images AND 360_preview panoramics (for section rendering
          // and diagnostics); panoramics with other roles are excluded from all surfaces.
          or(
            eq(reportImagesTable.isPanoramic, false),
            eq(reportImagesTable.imageRole, "360_preview"),
          ),
          eq(reportImagesTable.includeInHtml, true),
          isNull(reportImagesTable.deletedAt),
          // Seller: respect includeInSellerReport; buyers/public: respect includeInBuyerReport.
          ...(accessLevel === "seller"
            ? [eq(reportImagesTable.includeInSellerReport, true)]
            : [eq(reportImagesTable.includeInBuyerReport, true)]),
        ),
      )
      .orderBy(
        desc(reportImagesTable.isPrimary),
        asc(reportImagesTable.sortOrder),
      );

    // Best cover image for the HTML report cover banner.
    // Panoramic images are NEVER used as cover — they look distorted on flat surfaces.
    // Priority: isPrimary && !isPanoramic → listing_hero && !isPanoramic → first !isPanoramic
    const nonPanoCover = reportImages.filter((i) => !i.isPanoramic);
    const primaryCoverImage = nonPanoCover.find((i) => i.isPrimary)
      ?? nonPanoCover.find((i) => i.imageRole === "listing_hero")
      ?? nonPanoCover[0]
      ?? null;

    if (primaryCoverImage) {
      // Override heroImageUrl so both old web consumers (heroImageUrl) and
      // new consumers (reportHeroImageUrl) get the report_images priority chain.
      coverMeta = {
        ...coverMeta,
        heroImageUrl: primaryCoverImage.url,
        reportHeroImageUrl: primaryCoverImage.url,
      };
    }

    // ── Build 360 tour srcdoc for embedding in the HTML report ─────────────────
    // Only include tourSrcDoc when the 360_business_walkthrough section is
    // present and UNLOCKED for the current caller — mirrors section visibility.
    // Omitting it for locked/absent 360 sections prevents data leaks to
    // callers who cannot see the section content.
    let tourSrcDoc: string | null = null;
    const tour360Unlocked = filtered.some(
      (s) => s.sectionKey === "360_business_walkthrough" && !s.isLocked,
    );
    if (tour360Unlocked) {
      // Tour spaces migrated v1 → v2; read v2 first, fall back to v1.
      const [tourKvV2] = await db
        .select({ value: kvStore.value })
        .from(kvStore)
        .where(eq(kvStore.key, `biz360_tour_spaces_v2_${listingId}`))
        .limit(1);
      let tourKvSpaces: Array<Record<string, unknown>> = Array.isArray(tourKvV2?.value) ? (tourKvV2.value as Array<Record<string, unknown>>) : [];
      if (tourKvSpaces.length === 0) {
        const [tourKvV1] = await db
          .select({ value: kvStore.value })
          .from(kvStore)
          .where(eq(kvStore.key, `biz360_tour_spaces_v1_${listingId}`))
          .limit(1);
        tourKvSpaces = Array.isArray(tourKvV1?.value) ? (tourKvV1.value as Array<Record<string, unknown>>) : [];
      }
      if (tourKvSpaces.length > 0) {
        tourSrcDoc = buildTourSrcDoc(tourKvSpaces);
      }
    }

    // ── Dynamically build division_breakdown table with included-only units ──────
    let divisionTableRows: Array<Record<string, string>> | null = null;
    if (cafeRow?.id) {
      const includedUnits = await db.select().from(businessUnitsTable).where(
        and(
          eq(businessUnitsTable.cafeId, cafeRow.id),
          eq(businessUnitsTable.isIncludedInSale, true),
        ),
      );
      if (includedUnits.length > 0) {
        const fmtDiv = (n: string | null | undefined) =>
          n && Number(n) > 0 ? `$${Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : "—";
        const snapByUnit = new Map<string, typeof valuationSnapshotsTable.$inferSelect>();
        await Promise.all(includedUnits.map(async (u) => {
          const [snap] = await db.select().from(valuationSnapshotsTable).where(
            and(
              eq(valuationSnapshotsTable.cafeId, cafeRow!.id),
              eq(valuationSnapshotsTable.unitId, u.id),
            ),
          ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
          if (snap) snapByUnit.set(u.id, snap);
        }));
        divisionTableRows = includedUnits.map((u) => {
          const snap = snapByUnit.get(u.id);
          return {
            Division: u.name,
            Revenue: fmtDiv(snap?.grossRevenue?.toString()),
            EBITDA: fmtDiv(snap?.ebitda?.toString()),
            Value: fmtDiv(snap?.valuationMidpoint?.toString()),
          };
        });
      }
    }

    // Override tableData and bulletPoints on division_breakdown with live included-only data.
    // This ensures excluded units (not part of the sale) are never surfaced in the HTML report.
    const enrichedFiltered = filtered.map((s) => {
      if (s.sectionKey === "division_breakdown" && divisionTableRows) {
        const includedBullets = divisionTableRows.map(
          (r) => `${r.Division}${r.Revenue && r.Revenue !== "—" ? ` — Revenue: ${r.Revenue}` : ""}${r.Value && r.Value !== "—" ? `, Value: ${r.Value}` : ""}`,
        );
        return { ...s, tableData: divisionTableRows, bulletPoints: includedBullets };
      }
      return s;
    });

    // ── Fetch report_visuals (HTML-included; all statuses so UI can show placeholders) ─
    const reportVisuals = await db
      .select({
        id:           reportVisualsTable.id,
        sectionKey:   reportVisualsTable.sectionKey,
        title:        reportVisualsTable.title,
        subtitle:     reportVisualsTable.subtitle,
        visualType:   reportVisualsTable.visualType,
        status:       reportVisualsTable.status,
        chartData:    reportVisualsTable.chartData,
        sourceLabel:  reportVisualsTable.sourceLabel,
        sourceConfidence: reportVisualsTable.sourceConfidence,
        visualConfig: reportVisualsTable.visualConfig,
        includeInHtml:        reportVisualsTable.includeInHtml,
        includeInBuyerReport: reportVisualsTable.includeInBuyerReport,
        visibility:   reportVisualsTable.visibility,
        sortOrder:         reportVisualsTable.sortOrder,
        sectionPlacement:  reportVisualsTable.sectionPlacement,
      })
      .from(reportVisualsTable)
      .where(
        and(
          eq(reportVisualsTable.listingId, listingId),
          eq(reportVisualsTable.includeInHtml, true),
          isNull(reportVisualsTable.deletedAt),
          accessLevel === "seller"
            ? eq(reportVisualsTable.includeInSellerReport, true)
            : eq(reportVisualsTable.includeInBuyerReport, true),
        ),
      )
      .orderBy(asc(reportVisualsTable.sortOrder));

    res.json({ sections: enrichedFiltered, accessLevel, buyerGranted, meta: { ...coverMeta, reportImages, reportVisuals, tourSrcDoc } });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load HTML sections" });
  }
});

// ─── GET /api/report-versions/public-snapshot/:versionId ─────────────────────
// Public (no auth) — returns snapshot only for published versions.
// Buyers use this to view a shared version link (/reports/:listingId/:versionId).
// Optional ?accessToken=<jwt> (buyer-report-access token) unlocks approved_buyers
// sections; without it those sections are returned as locked placeholders.
router.get("/report-versions/public-snapshot/:versionId", async (req, res): Promise<void> => {
  const { versionId } = req.params as { versionId: string };
  try {
    const [version] = await db
      .select()
      .from(reportVersionsTable)
      .where(and(eq(reportVersionsTable.id, versionId), eq(reportVersionsTable.status, "published")))
      .limit(1);

    if (!version) {
      res.status(404).json({ error: "Version not found or not yet published" });
      return;
    }

    // Check optional buyer access token to unlock approved_buyers sections
    let buyerGranted = false;
    const accessToken = req.query["accessToken"] as string | undefined;
    if (accessToken) {
      const phone = await verifyBuyerAccessToken(accessToken, version.listingId);
      if (phone) {
        const [grant] = await db
          .select({ id: reportAccessGrantsTable.id })
          .from(reportAccessGrantsTable)
          .where(
            and(
              eq(reportAccessGrantsTable.listingId, version.listingId),
              eq(reportAccessGrantsTable.phone, phone.replace(/\s/g, "")),
            ),
          )
          .limit(1);
        buyerGranted = !!grant;
      }
    }

    // Strip fields that must never leave the server in non-seller contexts
    function stripSellerFields(s: Record<string, unknown>): Record<string, unknown> {
      return { ...s, sellerNotes: null, aiInstruction: null };
    }

    const snapshot = (version.snapshotJson ?? []) as any[];
    const publicSections = snapshot
      .map((s: any) => {
        // Always hide seller-only and hidden sections from public view
        if (s.visibility === "seller_only" || s.visibility === "hidden") return null;
        if (!s.includeInHtml) return null;
        // Gate approved_buyers sections: return locked placeholder without content
        if (s.visibility === "approved_buyers" && !buyerGranted) {
          return stripSellerFields({
            ...s,
            body:         null,
            bulletPoints: [] as string[],
            tableData:    null,
            chartData:    null,
            isLocked:     true,
          });
        }
        return stripSellerFields({ ...s, isLocked: false });
      })
      .filter(Boolean);

    res.json({
      sections:      publicSections,
      versionNumber: version.versionNumber,
      title:         version.title,
      status:        version.status,
      createdAt:     version.createdAt,
      buyerGranted,
    });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load public snapshot" });
  }
});

// ─── GET /api/report-versions/snapshot/:versionId ────────────────────────────
// Returns the section snapshot stored when a version was published.
// Requires seller JWT ownership of the version.
router.get("/report-versions/snapshot/:versionId", requireAuth, async (req, res): Promise<void> => {
  const userId    = req.user!.id;
  const { versionId } = req.params as { versionId: string };
  try {
    const [version] = await db
      .select()
      .from(reportVersionsTable)
      .where(and(eq(reportVersionsTable.id, versionId), eq(reportVersionsTable.ownerId, userId)))
      .limit(1);

    if (!version) {
      res.status(404).json({ error: "Version not found or access denied" });
      return;
    }

    const snapshot = (version.snapshotJson ?? []) as unknown[];
    res.json({
      sections:      snapshot,
      versionNumber: version.versionNumber,
      title:         version.title,
      status:        version.status,
      createdAt:     version.createdAt,
    });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load version snapshot" });
  }
});

// ─── POST /api/report-access-logs ────────────────────────────────────────────
// Records a buyer-side event (section viewed, PDF downloaded, tour clicked, etc.).
// Public endpoint — no auth required (buyers may not be logged in).
router.post("/report-access-logs", async (req, res): Promise<void> => {
  const {
    listingId,
    eventType,
    sectionKey,
    buyerId,
    buyerPhone,
    metadata,
  } = req.body as {
    listingId: string;
    eventType: string;
    sectionKey?: string;
    buyerId?: string;
    buyerPhone?: string;
    metadata?: Record<string, unknown>;
  };
  if (!listingId || !eventType) {
    res.status(400).json({ error: "listingId and eventType required" });
    return;
  }
  try {
    const buyerIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ?? null;
    await db.insert(reportAccessLogsTable).values({
      listingId,
      eventType,
      sectionKey: sectionKey ?? null,
      buyerId: buyerId ?? null,
      buyerPhone: buyerPhone ?? null,
      buyerIp,
      userAgent: req.headers["user-agent"] ?? null,
      metadata: metadata ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.warn({ err }, "Failed to log report access event");
    res.json({ ok: false }); // non-fatal — don't block the buyer
  }
});

// ─── GET /api/report-access-logs/listing/:listingId ──────────────────────────
// Returns access log events for the seller's listing.
router.get("/report-access-logs/listing/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);
    const events = await db
      .select()
      .from(reportAccessLogsTable)
      .where(eq(reportAccessLogsTable.listingId, listingId))
      .orderBy(desc(reportAccessLogsTable.createdAt))
      .limit(200);
    res.json({ events });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load access logs" });
  }
});

export default router;
