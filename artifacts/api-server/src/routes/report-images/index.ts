import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { eq, and, asc } from "drizzle-orm";
import { db, reportImagesTable, cafesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
  secure:      true,
});

const router = Router();

// Valid roles a report image can have.
const VALID_ROLES = [
  "cover_primary", "cover_secondary", "exterior", "interior",
  "equipment", "team", "product", "other",
] as const;
type ImageRole = typeof VALID_ROLES[number];

// Panoramic images (aspect_ratio > 2.2) may not hold cover/listing roles.
const COVER_BLOCKED_ROLES: ImageRole[] = ["cover_primary", "cover_secondary", "exterior", "interior"];

async function assertListingOwner(listingId: string, userId: string) {
  const [cafe] = await db
    .select()
    .from(cafesTable)
    .where(and(eq(cafesTable.listingId, listingId), eq(cafesTable.ownerId, userId)));
  if (!cafe) {
    const err: Error & { status?: number } = new Error("Listing not found or access denied");
    err.status = 403;
    throw err;
  }
  return cafe;
}

// ── GET /api/report-images/:listingId ─────────────────────────────────────────
router.get("/report-images/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingOwner(listingId, userId);
    const images = await db
      .select()
      .from(reportImagesTable)
      .where(eq(reportImagesTable.listingId, listingId))
      .orderBy(asc(reportImagesTable.sortOrder), asc(reportImagesTable.createdAt));
    res.json({ images });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load images" });
  }
});

// ── POST /api/report-images/:listingId/upload ──────────────────────────────────
// Body: { base64: string; mimeType?: string; originalFilename?: string; role?: ImageRole; caption?: string; }
router.post("/report-images/:listingId/upload", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const {
    base64, mimeType = "image/jpeg", originalFilename,
    role = "other", caption,
  } = req.body as {
    base64?: string; mimeType?: string; originalFilename?: string;
    role?: string; caption?: string;
  };

  if (!base64) { res.status(400).json({ error: "base64 image data required" }); return; }
  if (!VALID_ROLES.includes(role as ImageRole)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  try {
    await assertListingOwner(listingId, userId);

    const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLid  = listingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const folder   = `exit360/users/${safeUser}/listings/${safeLid}/report-images`;
    const dataUri  = `data:${mimeType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    const aspectRatio = result.height > 0 ? result.width / result.height : 1;
    const isPanoramic = aspectRatio > 2.2;

    // Block panoramic images from cover roles
    if (isPanoramic && COVER_BLOCKED_ROLES.includes(role as ImageRole)) {
      await cloudinary.uploader.destroy(result.public_id).catch(() => {});
      res.status(400).json({
        error: "Panoramic images (aspect ratio > 2.2) cannot be used as cover or listing-view images. Please use a standard photo for this role.",
      });
      return;
    }

    // Generate thumbnail URL (300px wide)
    const thumbnailUrl = cloudinary.url(result.public_id, {
      width: 300, crop: "fill", quality: "auto", fetch_format: "auto",
    });

    // Count existing images for sort_order
    const existing = await db
      .select({ id: reportImagesTable.id })
      .from(reportImagesTable)
      .where(eq(reportImagesTable.listingId, listingId));
    const sortOrder = existing.length;

    const [image] = await db
      .insert(reportImagesTable)
      .values({
        listingId,
        ownerId:           userId,
        cloudinaryPublicId: result.public_id,
        url:               result.secure_url,
        thumbnailUrl,
        originalFilename:  originalFilename ?? null,
        role:              role as ImageRole,
        caption:           caption ?? null,
        isPrimaryCover:    false,
        includeInPdf:      true,
        includeInHtml:     true,
        sortOrder,
        width:             result.width ?? null,
        height:            result.height ?? null,
        aspectRatio:       String(aspectRatio.toFixed(4)),
        fileSizeBytes:     result.bytes ?? null,
        format:            result.format ?? null,
        isPanoramic,
      })
      .returning();

    logger.info({ imageId: image.id, listingId, role }, "Report image uploaded");
    res.status(201).json({ image });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    logger.error({ err: e, listingId }, "Report image upload failed");
    res.status(e.status ?? 500).json({ error: e.message ?? "Upload failed" });
  }
});

// ── PATCH /api/report-images/:listingId/:imageId ───────────────────────────────
// Update role, caption, isPrimaryCover, sortOrder, includeInPdf, includeInHtml.
router.patch("/report-images/:listingId/:imageId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, imageId } = req.params as { listingId: string; imageId: string };
  const {
    role, caption, isPrimaryCover, sortOrder, includeInPdf, includeInHtml,
  } = req.body as {
    role?: string; caption?: string; isPrimaryCover?: boolean;
    sortOrder?: number; includeInPdf?: boolean; includeInHtml?: boolean;
  };

  try {
    await assertListingOwner(listingId, userId);

    const [existing] = await db
      .select()
      .from(reportImagesTable)
      .where(and(eq(reportImagesTable.id, imageId), eq(reportImagesTable.listingId, listingId)));
    if (!existing) { res.status(404).json({ error: "Image not found" }); return; }

    // Role validation
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as ImageRole)) {
        res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
        return;
      }
      if (existing.isPanoramic && COVER_BLOCKED_ROLES.includes(role as ImageRole)) {
        res.status(400).json({ error: "Panoramic images cannot be assigned cover or listing-view roles." });
        return;
      }
    }

    // If setting isPrimaryCover = true, clear it on all other images first
    if (isPrimaryCover === true) {
      await db
        .update(reportImagesTable)
        .set({ isPrimaryCover: false })
        .where(and(eq(reportImagesTable.listingId, listingId), eq(reportImagesTable.isPanoramic, false)));
    }

    const updates: Partial<typeof reportImagesTable.$inferInsert> = {
      ...(role !== undefined && { role: role as ImageRole }),
      ...(caption !== undefined && { caption }),
      ...(isPrimaryCover !== undefined && { isPrimaryCover }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(includeInPdf !== undefined && { includeInPdf }),
      ...(includeInHtml !== undefined && { includeInHtml }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(reportImagesTable)
      .set(updates)
      .where(and(eq(reportImagesTable.id, imageId), eq(reportImagesTable.listingId, listingId)))
      .returning();

    res.json({ image: updated });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Update failed" });
  }
});

// ── DELETE /api/report-images/:listingId/:imageId ─────────────────────────────
router.delete("/report-images/:listingId/:imageId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, imageId } = req.params as { listingId: string; imageId: string };
  try {
    await assertListingOwner(listingId, userId);

    const [existing] = await db
      .select()
      .from(reportImagesTable)
      .where(and(eq(reportImagesTable.id, imageId), eq(reportImagesTable.listingId, listingId)));
    if (!existing) { res.status(404).json({ error: "Image not found" }); return; }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(existing.cloudinaryPublicId).catch((e) => {
      logger.warn({ err: e, publicId: existing.cloudinaryPublicId }, "Cloudinary delete failed");
    });

    await db
      .delete(reportImagesTable)
      .where(and(eq(reportImagesTable.id, imageId), eq(reportImagesTable.listingId, listingId)));

    logger.info({ imageId, listingId }, "Report image deleted");
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Delete failed" });
  }
});

// ── GET /api/report-images/:listingId/primary-cover ───────────────────────────
// Public endpoint — returns the primary cover image URL for a listing.
// Used by the HTML report and PDF to resolve the cover hero.
router.get("/report-images/:listingId/primary-cover", async (req, res): Promise<void> => {
  const { listingId } = req.params as { listingId: string };
  try {
    const [primary] = await db
      .select()
      .from(reportImagesTable)
      .where(
        and(
          eq(reportImagesTable.listingId, listingId),
          eq(reportImagesTable.isPrimaryCover, true),
          eq(reportImagesTable.isPanoramic, false),
          eq(reportImagesTable.includeInHtml, true),
        ),
      )
      .limit(1);

    if (primary) {
      res.json({ url: primary.url, thumbnailUrl: primary.thumbnailUrl, imageId: primary.id });
      return;
    }

    // Fallback: first non-panoramic cover_primary role image
    const [fallback] = await db
      .select()
      .from(reportImagesTable)
      .where(
        and(
          eq(reportImagesTable.listingId, listingId),
          eq(reportImagesTable.role, "cover_primary"),
          eq(reportImagesTable.isPanoramic, false),
          eq(reportImagesTable.includeInHtml, true),
        ),
      )
      .orderBy(asc(reportImagesTable.sortOrder))
      .limit(1);

    if (fallback) {
      res.json({ url: fallback.url, thumbnailUrl: fallback.thumbnailUrl, imageId: fallback.id });
      return;
    }

    res.json({ url: null });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to resolve cover image" });
  }
});

export default router;
