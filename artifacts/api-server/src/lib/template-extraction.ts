/**
 * Shared lease template extraction helper.
 *
 * Given a complete analysis result (produced by Claude's primary lease-analysis call)
 * and an optional raw document text, makes a second Claude call that replaces all
 * specific party names, addresses, dates, and amounts throughout every clause text
 * field with {{PLACEHOLDER}} tokens and returns structured template data.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

export interface TemplateExtractionResult {
  template_name:     string;
  variable_map:      Record<string, string>;
  template_clauses:  Array<Record<string, unknown>>;
}

export const TEMPLATE_SYSTEM_PROMPT = `You are creating a reusable master lease template from a commercial lease analysis.
Given the full lease analysis JSON (and optionally the raw document text), produce a template by replacing all specific party names, addresses, dates, and monetary amounts with {{PLACEHOLDER}} variables in EVERY clause text field.

Return ONLY valid JSON — no markdown, no explanation:
{
  "template_name": "<descriptive name e.g. 'VIC Retail Café Lease 5+5 Years'>",
  "variable_map": {
    "TENANT_NAME": "<actual tenant/lessee business name found in document, or omit>",
    "LANDLORD_NAME": "<actual landlord/lessor name, or omit>",
    "BUSINESS_NAME": "<trading/brand name if different from tenant entity name, or omit>",
    "PREMISES_ADDRESS": "<full street address of premises, or omit>",
    "LEASE_DATE": "<commencement date e.g. '1 July 2024', or omit>",
    "RENT_AMOUNT": "<weekly or monthly rent figure e.g. '$2,500/week', or omit>",
    "LEASE_TERM": "<full term description e.g. '5 years + 5 year option', or omit>"
  },
  "template_clauses": [
    {
      "title": "<clause title — unchanged from input>",
      "category": "<category — unchanged from input>",
      "rating": "<rating — unchanged from input>",
      "riskLevel": "<riskLevel — unchanged from input>",
      "plainEnglish": "<plain English, replacing party names with {{TENANT_NAME}}, {{LANDLORD_NAME}} etc.>",
      "originalText": "<original clause text with specific names/addresses/dates/amounts replaced by {{VARIABLE_NAME}}>",
      "suggestedText": "<suggested text with specific names/addresses/dates/amounts replaced by {{VARIABLE_NAME}}>",
      "cafeRelevanceScore": <number unchanged>,
      "negotiationScore": <number unchanged>
    }
  ]
}

Rules:
- Only include keys in variable_map where you found actual values; omit unknown/null values
- In template_clauses: replace ALL occurrences of each named entity in plainEnglish, originalText, and suggestedText
- Include ALL clauses from the input analysis — do not skip any
- Keep title, category, rating, riskLevel, cafeRelevanceScore, negotiationScore identical to input`;

/**
 * Call Claude to produce a templatised version of the provided analysis.
 *
 * @param analysisResult  The full analysis JSON returned by the primary lease-analysis call.
 * @param extractedText   Optional raw document text (for DOC/DOCX), included for richer entity
 *                        detection (party names, addresses) beyond what the analysis JSON captured.
 * @param base64Pdf       Optional base64-encoded PDF bytes for document-native context.
 */
export async function extractTemplateFromAnalysis(
  analysisResult: Record<string, unknown>,
  extractedText?: string,
  base64Pdf?: string,
): Promise<TemplateExtractionResult | null> {
  try {
    const userContent = extractedText
      ? `Here is the raw document text for additional entity context:\n\n${extractedText.slice(0, 20000)}\n\n---\n\nHere is the full lease analysis JSON — transform every clause into a reusable template:\n${JSON.stringify(analysisResult)}`
      : `Here is the full lease analysis JSON — transform every clause into a reusable template:\n${JSON.stringify(analysisResult)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let messageContent: any;
    if (base64Pdf) {
      messageContent = [
        {
          type:   "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
        },
        { type: "text", text: userContent },
      ];
    } else {
      messageContent = userContent;
    }

    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 8192,
      system:     TEMPLATE_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: messageContent }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return null;

    const cleaned = raw.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned) as TemplateExtractionResult;
  } catch (err) {
    logger.warn({ err }, "Template extraction Claude call failed");
    return null;
  }
}
