import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@workspace/db";
import { listingDocumentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../middlewares/auth";

const router = Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

function authUser(req: any): string | null {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return typeof payload === "object" && payload !== null && "userId" in payload
      ? (payload as any).userId
      : null;
  } catch {
    return null;
  }
}

// ─── POST /api/listing-documents/upload ──────────────────────────────────────
// Seller uploads a document (base64) → Cloudinary raw → DB record

router.post("/listing-documents/upload", async (req, res): Promise<void> => {
  const userId = authUser(req);
  if (!userId) { res.status(401).json({ error: "Unauthorised" }); return; }

  const { listingId, title, docType, data, mimeType, fileSize } = req.body as {
    listingId?: string;
    title?: string;
    docType?: string;
    data?: string;       // base64
    mimeType?: string;
    fileSize?: number;
  };

  if (!listingId || !title || !data || !mimeType) {
    res.status(400).json({ error: "listingId, title, data, and mimeType are required" });
    return;
  }

  try {
    const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLid  = listingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const folder   = `biz360/${safeUser}/${safeLid}/documents`;
    const publicId = `${safeTitle}_${Date.now()}`;

    const dataUri = `data:${mimeType};base64,${data}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      resource_type: "raw",
      overwrite: false,
    });

    const [doc] = await db
      .insert(listingDocumentsTable)
      .values({
        listingId,
        ownerId: userId,
        title,
        docType: docType ?? "other",
        url: result.secure_url,
        cloudinaryPublicId: result.public_id,
        mimeType,
        fileSize: fileSize ?? null,
      })
      .returning();

    res.json({ doc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[listing-documents/upload]", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/listing-documents/:listingId ───────────────────────────────────
// Seller: list their own documents for a listing

router.get("/listing-documents/:listingId", async (req, res): Promise<void> => {
  const userId = authUser(req);
  if (!userId) { res.status(401).json({ error: "Unauthorised" }); return; }

  const { listingId } = req.params as { listingId: string };
  try {
    const docs = await db
      .select()
      .from(listingDocumentsTable)
      .where(and(
        eq(listingDocumentsTable.listingId, listingId),
        eq(listingDocumentsTable.ownerId, userId),
      ))
      .orderBy(listingDocumentsTable.createdAt);
    res.json({ docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// ─── DELETE /api/listing-documents/:documentId ───────────────────────────────

router.delete("/listing-documents/:documentId", async (req, res): Promise<void> => {
  const userId = authUser(req);
  if (!userId) { res.status(401).json({ error: "Unauthorised" }); return; }

  const { documentId } = req.params as { documentId: string };
  try {
    const [doc] = await db
      .select()
      .from(listingDocumentsTable)
      .where(eq(listingDocumentsTable.id, documentId));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    if (doc.ownerId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

    if (doc.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(doc.cloudinaryPublicId, { resource_type: "raw" }).catch(() => {});
    }

    await db.delete(listingDocumentsTable).where(eq(listingDocumentsTable.id, documentId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ─── GET /api/public/listing-documents/:listingId ────────────────────────────
// Public: buyers can see documents attached to a listing

router.get("/public/listing-documents/:listingId", async (req, res): Promise<void> => {
  const { listingId } = req.params as { listingId: string };
  try {
    const docs = await db
      .select({
        id: listingDocumentsTable.id,
        title: listingDocumentsTable.title,
        docType: listingDocumentsTable.docType,
        url: listingDocumentsTable.url,
        mimeType: listingDocumentsTable.mimeType,
        fileSize: listingDocumentsTable.fileSize,
        createdAt: listingDocumentsTable.createdAt,
      })
      .from(listingDocumentsTable)
      .where(eq(listingDocumentsTable.listingId, listingId))
      .orderBy(listingDocumentsTable.createdAt);
    res.json({ docs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

export default router;
