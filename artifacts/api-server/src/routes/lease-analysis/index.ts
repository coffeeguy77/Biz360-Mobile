import { Router } from "express";
import multer from "multer";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth } from "../../middlewares/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_PROMPT = `You are an expert commercial lease lawyer in Australia, specialising in café and food business tenancies. 
Analyse the provided lease document and return a JSON object. 
The JSON must be valid and parseable. Return ONLY the JSON object, no markdown, no explanation.

Return this exact structure:
{
  "jurisdiction": "<ACT|NSW|VIC|QLD|SA|WA|TAS|NT or null>",
  "leaseType": "<commercial|retail|licence|mixed or null>",
  "parties": { "tenant": "<string or null>", "landlord": "<string or null>" },
  "premises": "<description or null>",
  "term": "<e.g. 5 years + 5 year option or null>",
  "rentAmount": "<e.g. $2,500/week + outgoings or null>",
  "clauses": [
    {
      "title": "<short descriptive title>",
      "category": "<one of: Rent & Outgoings|Lease Term & Options|Use & Exclusivity|Assignment & Subletting|Make-Good|Services & Infrastructure|Signage & Marketing|Rent Review|Termination & Security|Licence Areas|Incentives|Rent Commencement|Insurance|Other>",
      "rating": "<tenant-friendly|landlord-friendly|balanced>",
      "riskLevel": "<low|medium|high|critical>",
      "plainEnglish": "<1-3 sentence plain English explanation>",
      "originalText": "<verbatim clause text from document, max 400 chars>",
      "suggestedText": "<improved version favouring the tenant, max 400 chars>",
      "cafeRelevanceScore": <1-5 integer>,
      "negotiationScore": <1-5 integer>
    }
  ],
  "overallRating": "<tenant-friendly|landlord-friendly|balanced>",
  "summary": "<2-3 sentence plain English lease summary>",
  "redFlags": ["<string>"],
  "positives": ["<string>"]
}

Focus on clauses that significantly affect café operators: rent terms, options, exclusivity, assignment, make-good, outgoings, services, disruption, and exit rights. Extract 8-20 key clauses.`;

router.post("/lease-analysis", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const mime = file.mimetype;
    const isPdf = mime === "application/pdf" || file.originalname.endsWith(".pdf");
    const isDocx = mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.originalname.endsWith(".docx");

    if (!isPdf && !isDocx) {
      return res.status(400).json({ error: "Only PDF and DOCX files are supported" });
    }

    let text = "";
    if (isPdf) {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text ?? "";
    } else {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      text = parsed.value ?? "";
    }

    if (!text.trim()) {
      return res.status(422).json({ error: "Could not extract text from document. The file may be scanned or image-based." });
    }

    const truncated = text.slice(0, 60000);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Please analyse the following commercial lease document:\n\n${truncated}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      return res.status(500).json({ error: "Unexpected response from AI" });
    }

    let parsed: unknown;
    try {
      const cleaned = raw.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw: raw.text.slice(0, 500) });
    }

    return res.json(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
