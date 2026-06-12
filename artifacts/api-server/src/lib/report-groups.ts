export interface ReportGroup {
  key: string;
  title: string;
  sectionKeys: string[];
}

// 13-chapter map — single source of truth for PDF and HTML chapter grouping.
// All 40 section keys are assigned to exactly one chapter.
export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: "executive_summary",
    title: "Executive Summary",
    sectionKeys: ["executive_summary", "key_selling_points", "reason_for_sale"],
  },
  {
    key: "business_overview",
    title: "Business Overview",
    sectionKeys: ["business_overview", "buyer_suitability", "training_handover"],
  },
  {
    key: "financial_performance",
    title: "Financial Performance",
    sectionKeys: [
      "financial_performance_summary",
      "verified_revenue_sources",
      "division_breakdown",
      "revenue_stream_breakdown",
    ],
  },
  {
    key: "valuation",
    title: "Valuation & Pricing",
    sectionKeys: [
      "app_valuation_summary",
      "valuation_methodology",
      "valuation_range_explanation",
      "business_health_score",
    ],
  },
  {
    key: "earnings_adjustments",
    title: "Earnings & Adjustments",
    sectionKeys: ["cogs_mapping_summary", "addbacks_adjusted_ebitda"],
  },
  {
    key: "assets_equipment",
    title: "Assets & Equipment",
    sectionKeys: [
      "plant_equipment_summary",
      "sale_inclusions",
      "sale_exclusions",
      "stock_working_capital",
    ],
  },
  {
    key: "lease_premises",
    title: "Lease & Premises",
    sectionKeys: [
      "lease_premises_summary",
      "lease_risk_valuation_impact",
      "business_location_market_context",
      "canberra_location_explainer",
    ],
  },
  {
    key: "staff_operations",
    title: "Staff & Operations",
    sectionKeys: ["staff_owner_involvement", "operations_systems"],
  },
  {
    key: "brand_customers",
    title: "Brand, Customers & Suppliers",
    sectionKeys: ["supplier_summary", "customer_base", "brand_digital_assets", "reviews_reputation"],
  },
  {
    key: "growth_risk",
    title: "Growth & Risk",
    sectionKeys: ["growth_opportunities", "risks_mitigations", "swot_analysis"],
  },
  {
    key: "virtual_tour",
    title: "Virtual Tour & Property",
    sectionKeys: ["360_business_walkthrough", "key_tour_highlights"],
  },
  {
    key: "due_diligence",
    title: "Due Diligence",
    sectionKeys: [
      "due_diligence_documents_available",
      "verified_information",
      "buyer_access_confidentiality",
    ],
  },
  {
    key: "buyer_pack",
    title: "Buyer Pack & Next Steps",
    sectionKeys: ["next_steps", "disclaimer"],
  },
];

export const PLACEHOLDER_PHRASES = [
  "seller should",
  "to be confirmed",
  "insert ",
  "placeholder",
  "example only",
  "not yet provided",
  "replace this",
  "add details",
  "update this",
  "enter details",
  "pending",
  " tbc",
  "lorem ipsum",
  "add the genuine",
  "before publishing",
];

export type PdfStyle = "compact" | "detailed" | "buyer_summary" | "data_room";

export const PDF_STYLE_CONFIG: Record<PdfStyle, { label: string; description: string; estimatedPages: string }> = {
  compact:       { label: "Compact Broker IM",    description: "Groups related sections into a polished broker-style report.", estimatedPages: "14–22 pages" },
  detailed:      { label: "Detailed Full Report", description: "Full content with each section clearly separated.",            estimatedPages: "25–40 pages" },
  buyer_summary: { label: "Buyer Summary",         description: "Shorter buyer-facing version with public content only.",      estimatedPages: "8–12 pages" },
  data_room:     { label: "Data Room Appendix",    description: "Equipment, due diligence, lease, and financial tables.",      estimatedPages: "6–10 pages" },
};

export const DATA_ROOM_SECTION_KEYS = [
  "plant_equipment_summary",
  "addbacks_adjusted_ebitda",
  "lease_premises_summary",
  "lease_risk_valuation_impact",
  "due_diligence_documents_available",
  "cogs_mapping_summary",
  "division_breakdown",
];

// Chapters that receive metric card grids on their opener page.
// Must match REPORT_GROUPS keys — Valuation, Equipment, Lease, Tour (per spec).
export const METRIC_CARD_CHAPTER_KEYS = new Set([
  "valuation",
  "assets_equipment",
  "lease_premises",
  "virtual_tour",
]);

// Deterministic cover-metric targets: the label shown, ordered search terms to match
// row labels, and which sectionKey to look in first. This ensures the cover always
// shows estimated value, range, revenue, EBITDA, and equipment value when available.
export const COVER_METRIC_TARGETS: {
  label: string;
  search: string[];
  sectionKey: string;
}[] = [
  { label: "Asking Price",    search: ["asking price", "estimated value", "sale price", "business value"], sectionKey: "app_valuation_summary" },
  { label: "Valuation Range", search: ["valuation range", "range", "value range"],                        sectionKey: "app_valuation_summary" },
  { label: "Annual Revenue",  search: ["revenue", "annual revenue", "total revenue", "turnover"],         sectionKey: "financial_performance_summary" },
  { label: "EBITDA",          search: ["ebitda", "adjusted ebitda", "net profit", "profit"],              sectionKey: "addbacks_adjusted_ebitda" },
  { label: "Equipment Value", search: ["equipment", "plant", "total value", "equipment value"],           sectionKey: "plant_equipment_summary" },
  { label: "Lease Term",      search: ["lease term", "term", "lease remaining", "years remaining"],       sectionKey: "lease_premises_summary" },
];

export function containsPlaceholder(text: string): boolean {
  const lower = text.toLowerCase();
  return PLACEHOLDER_PHRASES.some((p) => lower.includes(p));
}

export function sectionHasContent(s: { body?: string | null; bulletPoints?: unknown; tableData?: unknown; chartData?: unknown }): boolean {
  if (s.body && s.body.trim().length > 10) return true;
  if (Array.isArray(s.bulletPoints) && (s.bulletPoints as string[]).filter(Boolean).length > 0) return true;
  if (s.tableData && (Array.isArray(s.tableData) ? (s.tableData as unknown[]).length > 0 : true)) return true;
  if (s.chartData && (Array.isArray(s.chartData) ? (s.chartData as unknown[]).length > 0 : true)) return true;
  return false;
}

export function sectionIsPlaceholder(s: { body?: string | null; bulletPoints?: unknown }): boolean {
  if (!sectionHasContent(s as any)) return false;
  const text = [
    s.body ?? "",
    ...(Array.isArray(s.bulletPoints) ? (s.bulletPoints as string[]) : []),
  ].join(" ");
  return containsPlaceholder(text);
}
