export interface ReportGroup {
  key: string;
  title: string;
  sectionKeys: string[];
}

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
    key: "valuation_financials",
    title: "Valuation and Financials",
    sectionKeys: [
      "app_valuation_summary",
      "valuation_methodology",
      "valuation_range_explanation",
      "business_health_score",
      "verified_revenue_sources",
      "financial_performance_summary",
    ],
  },
  {
    key: "divisions_earnings",
    title: "Divisions and Earnings",
    sectionKeys: [
      "division_breakdown",
      "revenue_stream_breakdown",
      "cogs_mapping_summary",
      "addbacks_adjusted_ebitda",
    ],
  },
  {
    key: "assets_equipment",
    title: "Assets and Equipment",
    sectionKeys: [
      "plant_equipment_summary",
      "sale_inclusions",
      "sale_exclusions",
      "stock_working_capital",
    ],
  },
  {
    key: "lease_premises",
    title: "Lease and Premises",
    sectionKeys: [
      "lease_premises_summary",
      "lease_risk_valuation_impact",
      "business_location_market_context",
      "canberra_location_explainer",
    ],
  },
  {
    key: "tour_operations",
    title: "Tour and Operations",
    sectionKeys: [
      "360_business_walkthrough",
      "key_tour_highlights",
      "operations_systems",
      "staff_owner_involvement",
    ],
  },
  {
    key: "brand_customers",
    title: "Brand, Customers and Suppliers",
    sectionKeys: [
      "supplier_summary",
      "customer_base",
      "brand_digital_assets",
      "reviews_reputation",
    ],
  },
  {
    key: "growth_risk",
    title: "Growth and Risk",
    sectionKeys: ["growth_opportunities", "risks_mitigations", "swot_analysis"],
  },
  {
    key: "buyer_pack",
    title: "Buyer Pack",
    sectionKeys: [
      "verified_information",
      "buyer_access_confidentiality",
      "due_diligence_documents_available",
      "next_steps",
      "disclaimer",
    ],
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
