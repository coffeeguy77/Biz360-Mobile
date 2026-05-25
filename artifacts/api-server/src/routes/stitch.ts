import { Router } from "express";
import multer from "multer";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import os from "os";

const stitchRouter = Router();

const UPLOAD_DIR = path.join(os.tmpdir(), "biz360-stitch");

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024, files: 8 },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built output is dist/index.mjs → __dirname = dist/ → one level up = artifacts/api-server/
const SCRIPT_PATH = path.join(__dirname, "..", "stitch.py");
const PYTHON = process.env.PYTHON_BIN ?? "python3";

function runStitch(imagePaths: string[]): Promise<{
  panorama: string;
  haov: number;
  vaov: number;
  stitched: boolean;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SCRIPT_PATH, JSON.stringify(imagePaths)], {
      timeout: 120_000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      if (stderr) process.stderr.write(`[stitch.py] ${stderr}\n`);
      if (code !== 0) {
        return reject(new Error(`stitch.py exited ${code}: ${stderr.slice(0, 300)}`));
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`stitch.py bad output: ${stdout.slice(0, 200)}`));
      }
    });

    child.on("error", reject);
  });
}

stitchRouter.post(
  "/stitch",
  upload.array("photos", 8),
  async (req, res): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No photos uploaded" });
      return;
    }

    const paths = files.map((f) => f.path);

    try {
      const result = await runStitch(paths);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    } finally {
      await Promise.allSettled(paths.map((p) => fs.unlink(p)));
    }
  }
);

export default stitchRouter;
