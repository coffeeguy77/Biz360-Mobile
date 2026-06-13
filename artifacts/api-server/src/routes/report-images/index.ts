import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import { db, reportImagesTable, cafesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

// Roles that non-panoramic images may hold
const NON_PANORAMIC_ROLES = [
  "listing_hero", "cover_secondary", "exterior", "interior",
  "equipment", "team", "product", "other",
] as const;

// Roles that panoramic images (aspect_ratio > 2.2) may NOT hold
const PANORAMIC_BLOCKED_ROLES = [
  "listing_hero", "cover_secondary", "exterior", "interior", "equipment",
] as const;

const ALL_ROLES = [...NON_PANORAMIC_ROLES, "360_preview"] as const;
type ImageRole = typeof ALL_ROLES[number];

const PANORAMIC_THRESHOLD = 2.2;

/** Returns true if userId is an admin (comma-separated ADMIN_USER_IDS env var). */
function isAdminUser(userId: string): boolean {
  const list = process.env.ADMIN_USER_IDS ?? "";
  if (!list.trim()) return false;
  return list.split(",").map((s) => s.trim()).includes(userId);
}

/**
 * Verify the requesting user owns the listing, OR is an admin.
 * Returns the cafe row on success; throws 403 on failure.
 */
async function assertListingAccess(listingId: string, userId: string) {
  if (isAdminUser(userId)) {
    // Admin: still fetch the cafe row so callers get name / id etc.
    const [cafe] = await db
      .select()
      .from(cafesTable)
      .where(eq(cafesTable.listingId, listingId));
    if (!cafe) {
      const err: Error & { status?: number } = new Error("Listing not found");
      err.status = 404;
      throw err;
    }
    return cafe;
  }
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

/** Returns image usage summary (which surfaces it appears on). */
function buildUsageSummary(img: typeof reportImagesTable.$inferSelect) {
  const surfaces: string[] = [];
  if (img.isPrimary)           surfaces.push("primary cover image");
  if (img.imageRole !== "other") surfaces.push(`role: ${img.imageRole}`);
  if (img.sectionKey)          surfaces.push(`section: ${img.sectionKey}`);
  if (img.includeInPdf)        surfaces.push("PDF export");
  if (img.includeInHtml)       surfaces.push("HTML report");
  if (!img.includeInBuyerReport) surfaces.push("hidden from buyer");
  return surfaces;
}

/** Build a Cloudinary cover-size URL (1600w, crop/fill, q_auto, f_auto). */
function buildCoverUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    width: 1600, crop: "fill", quality: "auto", fetch_format: "auto", secure: true,
  });
}

/** Build a Cloudinary section-image URL (1000w, q_auto, f_auto). */
function buildSectionUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    width: 1000, quality: "auto", fetch_format: "auto", secure: true,
  });
}

/** Build a Cloudinary thumbnail URL (400w, crop/fill, q_auto, f_auto). */
function buildThumbnailUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    width: 400, crop: "fill", quality: "auto", fetch_format: "auto", secure: true,
  });
}

// ─── GET /api/report-images/:listingId ────────────────────────────────────────
router.get("/report-images/:listingId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingAccess(listingId, userId);
    const rows = await db
      .select()
      .from(reportImagesTable)
      .where(
        and(
          eq(reportImagesTable.listingId, listingId),
          isNull(reportImagesTable.deletedAt),
        ),
      )
      .orderBy(desc(reportImagesTable.isPrimary), asc(reportImagesTable.sortOrder), asc(reportImagesTable.createdAt));
    // Compute Cloudinary transform URLs — these are not DB columns.
    const images = rows.map((img) => ({
      ...img,
      thumbnailUrl: buildThumbnailUrl(img.cloudinaryPublicId),
      coverUrl:     buildCoverUrl(img.cloudinaryPublicId),
    }));
    res.json({ images });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load images" });
  }
});

// ─── POST /api/report-images/:listingId/upload ────────────────────────────────
// Body (JSON): { base64, mimeType?, originalFilename?, imageRole?, caption?, displayName?, sectionKey?, altText? }
router.post("/report-images/:listingId/upload", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const {
    base64, mimeType = "image/jpeg", originalFilename,
    imageRole = "other", caption, displayName, sectionKey, altText,
  } = req.body as {
    base64?: string; mimeType?: string; originalFilename?: string;
    imageRole?: string; caption?: string; displayName?: string;
    sectionKey?: string; altText?: string;
  };

  if (!base64) { res.status(400).json({ error: "base64 image data required" }); return; }

  // ── Mime-type whitelist ────────────────────────────────────────────────────
  const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED_MIMES.includes(mimeType)) {
    res.status(400).json({ error: `Unsupported file type. Please upload a JPG, PNG, or WebP image. Got: ${mimeType}` });
    return;
  }

  // ── Size cap: 10 MB decoded ────────────────────────────────────────────────
  // base64 encodes 3 bytes as 4 chars → raw byte estimate = base64.length * 0.75
  const estimatedBytes = Math.ceil(base64.length * 0.75);
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (estimatedBytes > MAX_BYTES) {
    res.status(400).json({
      error: `Image is too large (${(estimatedBytes / 1_048_576).toFixed(1)} MB). Please resize the image to under 10 MB before uploading.`,
    });
    return;
  }

  if (!ALL_ROLES.includes(imageRole as ImageRole)) {
    res.status(400).json({ error: `Invalid imageRole. Must be one of: ${ALL_ROLES.join(", ")}` });
    return;
  }

  try {
    await assertListingAccess(listingId, userId);

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
    const isPanoramic = aspectRatio > PANORAMIC_THRESHOLD;

    // Block panoramic images from non-360 roles
    if (isPanoramic && PANORAMIC_BLOCKED_ROLES.includes(imageRole as typeof PANORAMIC_BLOCKED_ROLES[number])) {
      await cloudinary.uploader.destroy(result.public_id).catch(() => {});
      res.status(400).json({
        error: "360° panoramic images can look distorted in reports. Please upload a normal photo or choose a cropped thumbnail.",
        isPanoramic: true,
      });
      return;
    }
    // Force panoramic images to 360_preview role
    const effectiveRole: ImageRole = isPanoramic ? "360_preview" : (imageRole as ImageRole);

    const coverUrl     = buildCoverUrl(result.public_id);
    const sectionUrl   = buildSectionUrl(result.public_id);
    const thumbnailUrl = buildThumbnailUrl(result.public_id);

    // Count existing non-deleted images for sort_order
    const existing = await db
      .select({ id: reportImagesTable.id })
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        isNull(reportImagesTable.deletedAt),
      ));
    const sortOrder = existing.length;

    const [image] = await db
      .insert(reportImagesTable)
      .values({
        listingId,
        userId,
        cloudinaryPublicId:  result.public_id,
        cloudinaryUrl:       result.url ?? result.secure_url,
        cloudinarySecureUrl: result.secure_url,
        originalFilename:    originalFilename ?? null,
        displayName:         displayName ?? originalFilename ?? null,
        imageRole:           effectiveRole,
        caption:             caption ?? null,
        altText:             altText ?? null,
        sectionKey:          sectionKey ?? null,
        isPrimary:           false,
        includeInPdf:        true,
        includeInHtml:       true,
        includeInBuyerReport:  true,
        includeInSellerReport: true,
        sortOrder,
        width:               result.width ?? null,
        height:              result.height ?? null,
        aspectRatio:         String(aspectRatio.toFixed(4)),
        fileSize:            result.bytes ?? null,
        mimeType:            mimeType,
        sourceType:          "uploaded",
        sourceRefId:         null,
        isPanoramic,
      })
      .returning();

    // Attach computed transformation URLs for the client
    const imageWithUrls = {
      ...image,
      coverUrl,
      sectionUrl,
      thumbnailUrl,
    };

    logger.info({ imageId: image.id, listingId, imageRole: effectiveRole }, "Report image uploaded");
    res.status(201).json({ image: imageWithUrls });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    logger.error({ err: e, listingId }, "Report image upload failed");
    res.status(e.status ?? 500).json({ error: e.message ?? "Upload failed" });
  }
});

/**
 * Fetch authoritative dimensions from Cloudinary for a given public_id.
 * NEVER trust client-supplied dimensions for panorama classification.
 * Falls back to aspect_ratio=1 (non-panoramic) only on API error, with a warning log.
 */
async function fetchCloudinaryDimensions(publicId: string): Promise<{
  width: number | null; height: number | null;
  aspectRatio: number; isPanoramic: boolean;
}> {
  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: "image" });
    const width:  number | null = resource.width  ?? null;
    const height: number | null = resource.height ?? null;
    const ratio = width && height && height > 0 ? width / height : 1;
    return { width, height, aspectRatio: ratio, isPanoramic: ratio > PANORAMIC_THRESHOLD };
  } catch (err) {
    logger.warn({ err, publicId }, "Cloudinary resource fetch failed — defaulting to aspect_ratio=1 (non-panoramic)");
    return { width: null, height: null, aspectRatio: 1, isPanoramic: false };
  }
}

// ─── POST /api/report-images/:listingId/from-listing-photo ────────────────────
// Creates a report_image row referencing an existing Cloudinary listing asset.
// Panorama classification is derived server-side from Cloudinary metadata —
// client-supplied dimensions are NEVER used for role/cover enforcement.
// Body: { cloudinaryPublicId, cloudinarySecureUrl, imageRole?, caption?, displayName?, sectionKey? }
router.post("/report-images/:listingId/from-listing-photo", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const {
    cloudinaryPublicId, cloudinarySecureUrl, cloudinaryUrl,
    imageRole = "listing_hero", caption, displayName, sectionKey, altText,
  } = req.body as {
    cloudinaryPublicId?: string; cloudinarySecureUrl?: string; cloudinaryUrl?: string;
    imageRole?: string; caption?: string; displayName?: string; sectionKey?: string; altText?: string;
  };

  if (!cloudinaryPublicId || !cloudinarySecureUrl) {
    res.status(400).json({ error: "cloudinaryPublicId and cloudinarySecureUrl are required" });
    return;
  }
  if (!ALL_ROLES.includes(imageRole as ImageRole)) {
    res.status(400).json({ error: `Invalid imageRole. Must be one of: ${ALL_ROLES.join(", ")}` });
    return;
  }

  try {
    await assertListingAccess(listingId, userId);

    // Server-side panorama detection — Cloudinary is the source of truth
    const { width, height, aspectRatio, isPanoramic } = await fetchCloudinaryDimensions(cloudinaryPublicId);

    // Block panoramic images from protected cover/listing roles
    if (isPanoramic && PANORAMIC_BLOCKED_ROLES.includes(imageRole as typeof PANORAMIC_BLOCKED_ROLES[number])) {
      res.status(400).json({
        error: "360° panoramic images can look distorted in reports. Please upload a normal photo or choose a cropped thumbnail.",
        isPanoramic: true,
      });
      return;
    }
    // Force role to 360_preview for any panoramic image regardless of client request
    const effectiveRole: ImageRole = isPanoramic ? "360_preview" : (imageRole as ImageRole);

    // Idempotency: if this publicId is already in the list, return existing record without creating a duplicate.
    const [duplicate] = await db
      .select()
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.cloudinaryPublicId, cloudinaryPublicId),
        isNull(reportImagesTable.deletedAt),
      ))
      .limit(1);

    if (duplicate) {
      const thumbnailUrl = buildThumbnailUrl(duplicate.cloudinaryPublicId);
      const coverUrl     = buildCoverUrl(duplicate.cloudinaryPublicId);
      return void res.status(200).json({ image: { ...duplicate, thumbnailUrl, coverUrl }, isPanoramic, alreadyExists: true });
    }

    const allExisting = await db
      .select({ id: reportImagesTable.id })
      .from(reportImagesTable)
      .where(and(eq(reportImagesTable.listingId, listingId), isNull(reportImagesTable.deletedAt)));

    const thumbnailUrl = buildThumbnailUrl(cloudinaryPublicId);
    const coverUrl     = buildCoverUrl(cloudinaryPublicId);

    const [image] = await db
      .insert(reportImagesTable)
      .values({
        listingId,
        userId,
        cloudinaryPublicId,
        cloudinaryUrl:       cloudinaryUrl ?? cloudinarySecureUrl,
        cloudinarySecureUrl,
        displayName:         displayName ?? null,
        imageRole:           effectiveRole,
        caption:             caption ?? null,
        altText:             altText ?? null,
        sectionKey:          sectionKey ?? null,
        isPrimary:           false,
        includeInPdf:        !isPanoramic,
        includeInHtml:       true,
        includeInBuyerReport:  !isPanoramic,
        includeInSellerReport: true,
        sortOrder:           allExisting.length,
        width,
        height,
        aspectRatio:         String(aspectRatio.toFixed(4)),
        sourceType:          "listing_photo",
        sourceRefId:         cloudinaryPublicId,
        isPanoramic,
      })
      .returning();

    res.status(201).json({ image: { ...image, thumbnailUrl, coverUrl }, isPanoramic });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to add listing photo" });
  }
});

// ─── POST /api/report-images/:listingId/from-tour-thumbnail ───────────────────
// Creates a report_image row referencing a tour scene thumbnail (Cloudinary asset).
// Panorama classification is derived server-side from Cloudinary metadata —
// client-supplied aspectRatio / width / height are NEVER trusted for enforcement.
// Body: { cloudinaryPublicId, cloudinarySecureUrl, sceneLabel? }
router.post("/report-images/:listingId/from-tour-thumbnail", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  const {
    cloudinaryPublicId, cloudinarySecureUrl, cloudinaryUrl, sceneLabel,
  } = req.body as {
    cloudinaryPublicId?: string; cloudinarySecureUrl?: string; cloudinaryUrl?: string;
    sceneLabel?: string;
  };

  if (!cloudinaryPublicId || !cloudinarySecureUrl) {
    res.status(400).json({ error: "cloudinaryPublicId and cloudinarySecureUrl are required" });
    return;
  }

  try {
    await assertListingAccess(listingId, userId);

    // Server-side panorama detection — never trust client-supplied dimensions
    const { width, height, aspectRatio, isPanoramic } = await fetchCloudinaryDimensions(cloudinaryPublicId);
    const effectiveRole: ImageRole = isPanoramic ? "360_preview" : "other";

    // Idempotency: if this publicId is already in the list, return existing record without creating a duplicate.
    const [duplicate] = await db
      .select()
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.cloudinaryPublicId, cloudinaryPublicId),
        isNull(reportImagesTable.deletedAt),
      ))
      .limit(1);

    if (duplicate) {
      const thumbnailUrl = buildThumbnailUrl(duplicate.cloudinaryPublicId);
      return void res.status(200).json({ image: { ...duplicate, thumbnailUrl }, isPanoramic, alreadyExists: true });
    }

    const allExisting = await db
      .select({ id: reportImagesTable.id })
      .from(reportImagesTable)
      .where(and(eq(reportImagesTable.listingId, listingId), isNull(reportImagesTable.deletedAt)));

    const thumbnailUrl = buildThumbnailUrl(cloudinaryPublicId);

    const [image] = await db
      .insert(reportImagesTable)
      .values({
        listingId,
        userId,
        cloudinaryPublicId,
        cloudinaryUrl:       cloudinaryUrl ?? cloudinarySecureUrl,
        cloudinarySecureUrl,
        displayName:         sceneLabel ?? "Tour Thumbnail",
        imageRole:           effectiveRole,
        isPrimary:           false,
        // Panoramic tour thumbnails are excluded from PDF and buyer report by default
        includeInPdf:        !isPanoramic,
        includeInHtml:       true,
        includeInBuyerReport:  !isPanoramic,
        includeInSellerReport: true,
        sortOrder:           allExisting.length,
        width,
        height,
        aspectRatio:         String(aspectRatio.toFixed(4)),
        sourceType:          "tour_thumbnail",
        sourceRefId:         cloudinaryPublicId,
        isPanoramic,
      })
      .returning();

    logger.info({ imageId: image.id, listingId, isPanoramic }, "Tour thumbnail added to report images");

    if (isPanoramic) {
      return void res.status(201).json({
        image: { ...image, thumbnailUrl }, isPanoramic,
        warning: "360° panoramic images can look distorted in reports. This thumbnail has been assigned the 360° Preview role and excluded from the PDF cover.",
      });
    }

    res.status(201).json({ image: { ...image, thumbnailUrl }, isPanoramic });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to add tour thumbnail" });
  }
});

// ─── PATCH /api/report-images/:listingId/:imageId ─────────────────────────────
router.patch("/report-images/:listingId/:imageId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, imageId } = req.params as { listingId: string; imageId: string };
  const {
    imageRole, caption, displayName, altText, sectionKey,
    isPrimary, sortOrder,
    includeInPdf, includeInHtml, includeInBuyerReport, includeInSellerReport,
  } = req.body as {
    imageRole?: string; caption?: string; displayName?: string; altText?: string;
    sectionKey?: string; isPrimary?: boolean; sortOrder?: number;
    includeInPdf?: boolean; includeInHtml?: boolean;
    includeInBuyerReport?: boolean; includeInSellerReport?: boolean;
  };

  try {
    await assertListingAccess(listingId, userId);

    const [existing] = await db
      .select()
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.id, imageId),
        eq(reportImagesTable.listingId, listingId),
        isNull(reportImagesTable.deletedAt),
      ));
    if (!existing) { res.status(404).json({ error: "Image not found" }); return; }

    // Validate role change.
    // Panoramic images may ONLY use 360_preview — reject any other role explicitly.
    // (Upload path also enforces this; PATCH must be consistent so clients can rely on errors.)
    let resolvedImageRole = imageRole;
    if (imageRole !== undefined) {
      if (!ALL_ROLES.includes(imageRole as ImageRole)) {
        res.status(400).json({ error: `Invalid imageRole. Must be one of: ${ALL_ROLES.join(", ")}` });
        return;
      }
      if (existing.isPanoramic && imageRole !== "360_preview") {
        res.status(400).json({
          error: "360° panoramic images can only use the '360_preview' role — they look distorted in reports. Upload a cropped flat photo and assign it a different role.",
          isPanoramic: true,
        });
        return;
      }
    }

    // Setting isPrimary = true clears all other non-panoramic rows for this listing
    if (isPrimary === true) {
      if (existing.isPanoramic) {
        res.status(400).json({
          error: "360° panoramic images can look distorted in reports. Please upload a normal photo or choose a cropped thumbnail.",
          isPanoramic: true,
        });
        return;
      }
      await db
        .update(reportImagesTable)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(reportImagesTable.listingId, listingId),
          eq(reportImagesTable.isPanoramic, false),
          isNull(reportImagesTable.deletedAt),
        ));
    }

    const updates: Partial<typeof reportImagesTable.$inferInsert> = {
      ...(resolvedImageRole !== undefined && { imageRole: resolvedImageRole as ImageRole }),
      ...(caption !== undefined          && { caption }),
      ...(displayName !== undefined      && { displayName }),
      ...(altText !== undefined          && { altText }),
      ...(sectionKey !== undefined       && { sectionKey }),
      ...(isPrimary !== undefined        && { isPrimary }),
      ...(sortOrder !== undefined        && { sortOrder }),
      ...(includeInPdf !== undefined     && { includeInPdf }),
      ...(includeInHtml !== undefined    && { includeInHtml }),
      ...(includeInBuyerReport !== undefined  && { includeInBuyerReport }),
      ...(includeInSellerReport !== undefined && { includeInSellerReport }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(reportImagesTable)
      .set(updates)
      .where(and(
        eq(reportImagesTable.id, imageId),
        eq(reportImagesTable.listingId, listingId),
        isNull(reportImagesTable.deletedAt),
      ))
      .returning();

    res.json({ image: updated });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Update failed" });
  }
});

// ─── DELETE /api/report-images/:listingId/:imageId ────────────────────────────
// Returns usage summary first (for client warnings), then soft-deletes the row.
// Cloudinary asset is only purged when source_type = 'uploaded'.
router.delete("/report-images/:listingId/:imageId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId, imageId } = req.params as { listingId: string; imageId: string };
  try {
    await assertListingAccess(listingId, userId);

    const [existing] = await db
      .select()
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.id, imageId),
        eq(reportImagesTable.listingId, listingId),
        isNull(reportImagesTable.deletedAt),
      ));
    if (!existing) { res.status(404).json({ error: "Image not found" }); return; }

    const usageSummary = buildUsageSummary(existing);
    const wasPrimary = existing.isPrimary;

    // Soft-delete
    await db
      .update(reportImagesTable)
      .set({ deletedAt: new Date(), isPrimary: false, updatedAt: new Date() })
      .where(and(
        eq(reportImagesTable.id, imageId),
        eq(reportImagesTable.listingId, listingId),
      ));

    // Purge Cloudinary only for seller-uploaded assets (not listing_photo or tour_thumbnail
    // which are shared assets owned by the listing — those are not in the report-images folder)
    if (existing.sourceType === "uploaded") {
      cloudinary.uploader.destroy(existing.cloudinaryPublicId).catch((e) => {
        logger.warn({ err: e, publicId: existing.cloudinaryPublicId }, "Cloudinary soft-delete purge failed");
      });
    }

    logger.info({ imageId, listingId, wasPrimary }, "Report image soft-deleted");
    res.json({ ok: true, usageSummary, wasPrimary });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Delete failed" });
  }
});

// ─── GET /api/report-images/:listingId/primary-cover (public) ─────────────────
// Returns the best available cover image URL (non-panoramic, not soft-deleted).
// Public endpoint: must only return images the buyer is allowed to see.
// Priority: isPrimary=true → imageRole=listing_hero → first non-panoramic.
router.get("/report-images/:listingId/primary-cover", async (req, res): Promise<void> => {
  const { listingId } = req.params as { listingId: string };
  try {
    const candidates = await db
      .select()
      .from(reportImagesTable)
      .where(and(
        eq(reportImagesTable.listingId, listingId),
        eq(reportImagesTable.isPanoramic, false),
        eq(reportImagesTable.includeInHtml, true),
        eq(reportImagesTable.includeInBuyerReport, true),
        isNull(reportImagesTable.deletedAt),
      ))
      .orderBy(
        desc(reportImagesTable.isPrimary),
        sql`CASE ${reportImagesTable.imageRole}
          WHEN 'listing_hero'    THEN 0
          WHEN 'cover_secondary' THEN 1
          WHEN 'exterior'        THEN 2
          ELSE 3
        END`,
        asc(reportImagesTable.sortOrder),
      )
      .limit(3);

    if (!candidates.length) { res.json({ url: null }); return; }

    const primary = candidates.find((c) => c.isPrimary) ?? candidates[0];
    const coverUrl = buildCoverUrl(primary.cloudinaryPublicId);
    const thumbnailUrl = buildThumbnailUrl(primary.cloudinaryPublicId);

    res.json({
      url: primary.cloudinarySecureUrl,
      coverUrl,
      thumbnailUrl,
      imageId: primary.id,
      imageRole: primary.imageRole,
    });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to resolve cover image" });
  }
});

// ─── GET /api/report-images/:listingId/tour-scenes ───────────────────────────
// Returns tour spaces from KV with Cloudinary URLs extracted, ready for the
// "Use Tour Thumbnail" mobile picker. Each scene includes name, panoramaUrl,
// and a photos array. The mobile uses these to call /from-tour-thumbnail.
router.get("/report-images/:listingId/tour-scenes", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingAccess(listingId, userId);

    const { db: dbKv, kvStore } = await import("@workspace/db");
    const { eq: eqKv } = await import("drizzle-orm");
    const [tourRow] = await dbKv
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(eqKv(kvStore.key, `biz360_tour_spaces_v1_${listingId}`))
      .limit(1);

    const rawSpaces: Record<string, unknown>[] = Array.isArray(tourRow?.value) ? tourRow.value as Record<string, unknown>[] : [];

    const scenes = rawSpaces.map((space, idx) => {
      const panoramaUrl = space.panoramaUrl as string | null ?? null;
      const photos = Array.isArray(space.photos) ? (space.photos as string[]) : [];
      // Use the first non-panoramic photo as thumbnail, fallback to panoramaUrl
      const thumbnailUrl = photos[0] ?? panoramaUrl ?? null;
      const publicId = thumbnailUrl ? extractCloudinaryPublicId(thumbnailUrl) : null;
      return {
        index:        idx,
        name:         (space.name as string | null) ?? `Scene ${idx + 1}`,
        panoramaUrl,
        thumbnailUrl,
        cloudinaryPublicId: publicId,
        cloudinarySecureUrl: thumbnailUrl,
        photoCount:   photos.length,
        hasPanorama:  !!panoramaUrl,
      };
    }).filter((s) => s.cloudinaryPublicId);

    res.json({ scenes });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load tour scenes" });
  }
});

// ─── GET /api/report-images/:listingId/listing-assets ────────────────────────
// Returns existing Cloudinary photos from tour spaces (non-panoramic) that can
// be used as listing photos via the "Use Listing Photo" picker. These are already
// in Cloudinary — they do not need to be re-uploaded.
router.get("/report-images/:listingId/listing-assets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { listingId } = req.params as { listingId: string };
  try {
    await assertListingAccess(listingId, userId);

    const { db: dbKv, kvStore } = await import("@workspace/db");
    const { eq: eqKv } = await import("drizzle-orm");
    const [tourRow] = await dbKv
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(eqKv(kvStore.key, `biz360_tour_spaces_v1_${listingId}`))
      .limit(1);

    const rawSpaces: Record<string, unknown>[] = Array.isArray(tourRow?.value) ? tourRow.value as Record<string, unknown>[] : [];

    const assets: Array<{
      url: string; cloudinaryPublicId: string; thumbnailUrl: string;
      label: string; sourceScene: string;
    }> = [];

    for (const space of rawSpaces) {
      const photos = Array.isArray(space.photos) ? (space.photos as string[]) : [];
      const spaceName = (space.name as string | null) ?? "Unnamed Scene";
      for (const photoUrl of photos) {
        const publicId = extractCloudinaryPublicId(photoUrl);
        if (!publicId) continue;
        const thumbnailUrl = buildThumbnailUrl(publicId);
        assets.push({ url: photoUrl, cloudinaryPublicId: publicId, thumbnailUrl, label: spaceName, sourceScene: spaceName });
      }
    }

    res.json({ assets });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? "Failed to load listing assets" });
  }
});

/** Parse a Cloudinary secure URL to extract the public_id (including folder path). */
function extractCloudinaryPublicId(url: string): string | null {
  try {
    // Handles: https://res.cloudinary.com/{cloud}/image/upload/v{n}/{public_id}.ext
    //          https://res.cloudinary.com/{cloud}/image/upload/{public_id}.ext
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
    return match ? match[1] : null;
  } catch { return null; }
}

export default router;
