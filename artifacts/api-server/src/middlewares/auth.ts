import { jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const rawSecret = process.env.JWT_SECRET;

function getSecret(): Uint8Array {
  if (!rawSecret) throw new Error("JWT_SECRET environment variable is not set");
  return new TextEncoder().encode(rawSecret);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = payload.sub ?? (payload as any).id ?? (payload as any).user_id;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Missing authorization token" }); return; }
  const userId = await verifyToken(token).catch(() => null);
  if (!userId) { res.status(401).json({ error: "Invalid or expired token" }); return; }
  req.user = { id: userId };
  next();
}
