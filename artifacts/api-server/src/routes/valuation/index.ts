import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, cafesTable, valuationSnapshotsTable, businessUnitsTable, reportAccessSettingsTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import cafesRouter from "./cafes";
import unitsRouter from "./units";
import equipmentRouter from "./equipment";
import adjustmentsRouter from "./adjustments";
import snapshotsRouter from "./snapshots";
import squareRouter from "./square";
import xeroRouter from "./xero";
import oauthRouter from "./oauth";
import reportAccessRouter, { verifyReportAccessToken, checkPwd, signReportAccessToken } from "./report-access";
import ndaRouter from "./nda";
import customReportsRouter from "./custom-reports";

const router: IRouter = Router();

// PUBLIC: OAuth start, callbacks, and done page MUST come before requireAuth
router.use("/valuation", oauthRouter);

// PUBLIC: Snapshot for a listing — enforces report access settings
router.get("/valuation/listing/:listingId/snapshot", async (req, res) => {
  const { listingId } = req.params as { listingId: string };
  const [cafe] = await db.select().from(cafesTable).where(eq(cafesTable.listingId, listingId));
  if (!cafe) return res.json({ combined: null, units: [] });

  // Check access settings before returning any financial data
  const [accessSettings] = await db.select().from(reportAccessSettingsTable)
    .where(eq(reportAccessSettingsTable.listingId, listingId));
  const accessMode = accessSettings?.accessMode ?? "public";

  if (accessMode !== "public") {
    const rawToken = req.headers["x-report-token"];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const valid = token ? await verifyReportAccessToken(token, listingId) : false;
    if (!valid) {
      return res.json({
        requiresAccess: true,
        accessMode,
        smsUnlockEnabled: accessSettings?.smsUnlockEnabled ?? false,
      });
    }
  }

  const [combined] = await db.select().from(valuationSnapshotsTable).where(
    and(eq(valuationSnapshotsTable.cafeId, cafe.id), isNull(valuationSnapshotsTable.unitId), eq(valuationSnapshotsTable.isPublished, true))
  ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
  if (!combined) return res.json({ combined: null, units: [] });
  const units = await db.select().from(businessUnitsTable).where(eq(businessUnitsTable.cafeId, cafe.id));
  const unitSnapshots = await Promise.all(units.map(async (unit) => {
    const [snap] = await db.select().from(valuationSnapshotsTable).where(
      and(eq(valuationSnapshotsTable.cafeId, cafe.id), eq(valuationSnapshotsTable.unitId, unit.id), eq(valuationSnapshotsTable.isPublished, true))
    ).orderBy(desc(valuationSnapshotsTable.createdAt)).limit(1);
    return { unit, snapshot: snap ?? null };
  }));
  return res.json({ combined, units: unitSnapshots });
});

// PUBLIC: Password unlock — verifies password and returns a short-lived access token
router.post("/valuation/listing/:listingId/unlock", async (req, res) => {
  const { listingId } = req.params as { listingId: string };
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ error: "password is required" });

  const [settings] = await db.select().from(reportAccessSettingsTable)
    .where(eq(reportAccessSettingsTable.listingId, listingId));
  if (!settings) return res.status(404).json({ error: "Access settings not found for this listing" });
  if (!settings.passwordHash) return res.status(400).json({ error: "This report does not have a password set" });

  const valid = await checkPwd(password, settings.passwordHash);
  if (!valid) return res.status(403).json({ error: "Incorrect password" });

  const token = await signReportAccessToken(listingId);
  return res.json({ token });
});

// AUTH GUARD for all remaining /valuation/* routes
router.use("/valuation", requireAuth);

// AUTHENTICATED routes
router.use("/valuation/cafes/:cafeId/units", unitsRouter);
router.use("/valuation/cafes/:cafeId/equipment", equipmentRouter);
router.use("/valuation/cafes/:cafeId/adjustments", adjustmentsRouter);
router.use("/valuation/cafes/:cafeId/snapshots", snapshotsRouter);
router.use("/valuation/cafes/:cafeId/report-access", reportAccessRouter);
router.use("/valuation/cafes/:cafeId/nda-settings", ndaRouter);
router.use("/valuation/cafes", cafesRouter);
router.use("/valuation", squareRouter);
router.use("/valuation", xeroRouter);
router.use("/valuation", customReportsRouter);

export default router;
