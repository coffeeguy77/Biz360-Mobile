// chart-svg.ts (biz360 copy) — Pure TypeScript SVG string generators for all 8 IM report chart types.
// Kept in sync with artifacts/api-server/src/lib/chart-svg.ts.
// Consumed by ChartComponents.tsx via react-native-svg SvgXml.

const PALETTE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
const MUTED   = "#8B9CB8";
const TRACK   = "#1E3A5C";
const WHITE   = "#FFFFFF";

function fmtV(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgWrap(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

export function radarChartSvg(
  data: Array<{ subject?: string; name?: string; score?: number; value?: number }>,
  w: number, h: number,
): string {
  const rows   = data.slice(0, 8);
  const rowH   = Math.max(16, Math.floor(h / Math.max(rows.length, 1)));
  const labelW = Math.min(110, Math.floor(w * 0.34));
  const barW   = w - labelW - 44;
  const els = rows.map((row, i) => {
    const label  = esc(String(row.subject ?? row.name ?? "")).slice(0, 20);
    const score  = Math.min(100, Math.max(0, Number(row.score ?? row.value ?? 0)));
    const y      = i * rowH + Math.floor((rowH - 9) / 2);
    const filled = Math.max(2, Math.floor(barW * score / 100));
    const color  = score >= 75 ? "#10B981" : score >= 50 ? "#3B82F6" : "#F59E0B";
    return [
      `<text x="0" y="${y+9}" font-size="10" fill="${MUTED}" font-family="Helvetica">${label}</text>`,
      `<rect x="${labelW}" y="${y}" width="${barW}" height="9" rx="2" fill="${TRACK}"/>`,
      `<rect x="${labelW}" y="${y}" width="${filled}" height="9" rx="2" fill="${color}"/>`,
      `<text x="${labelW+barW+4}" y="${y+9}" font-size="9" fill="${WHITE}" font-family="Helvetica">${score}</text>`,
    ].join("");
  });
  return svgWrap(w, Math.max(h, rows.length * rowH), els.join(""));
}

export function pieChartSvg(
  data: Array<{ name?: string; value?: number }>,
  w: number, h: number,
): string {
  const rows   = data.slice(0, 8);
  const total  = rows.reduce((s, r) => s + Number(r.value ?? 0), 0) || 1;
  const rowH   = Math.max(16, Math.floor(h / Math.max(rows.length, 1)));
  const labelW = Math.min(130, Math.floor(w * 0.40));
  const barW   = w - labelW - 44;
  const els = rows.map((row, i) => {
    const label  = esc(String(row.name ?? "")).slice(0, 20);
    const pct    = Number(row.value ?? 0) / total;
    const filled = Math.max(2, Math.floor(barW * pct));
    const y      = i * rowH + Math.floor((rowH - 9) / 2);
    const color  = PALETTE[i % PALETTE.length];
    return [
      `<rect x="0" y="${y+1}" width="8" height="8" fill="${color}"/>`,
      `<text x="12" y="${y+9}" font-size="10" fill="${MUTED}" font-family="Helvetica">${label}</text>`,
      `<rect x="${labelW}" y="${y}" width="${barW}" height="9" rx="2" fill="${TRACK}"/>`,
      `<rect x="${labelW}" y="${y}" width="${filled}" height="9" rx="2" fill="${color}"/>`,
      `<text x="${labelW+barW+4}" y="${y+9}" font-size="9" fill="${MUTED}" font-family="Helvetica">${(pct*100).toFixed(0)}%</text>`,
    ].join("");
  });
  return svgWrap(w, Math.max(h, rows.length * rowH), els.join(""));
}

export function hBarChartSvg(
  data: Array<Record<string, unknown>>,
  w: number, h: number,
): string {
  const rows   = data.slice(0, 8);
  const valKey = (rows[0] && Object.keys(rows[0]).find(k => k !== "name" && k !== "stage")) ?? "value";
  const lblKey = (rows[0] && "stage" in rows[0]) ? "stage" : "name";
  const maxVal = Math.max(...rows.map(r => Number(r[valKey] ?? 0))) || 1;
  const rowH   = Math.max(16, Math.floor(h / Math.max(rows.length, 1)));
  const barW   = w - 120 - 60;
  const els = rows.map((row, i) => {
    const label  = esc(String(row[lblKey] ?? "")).slice(0, 18);
    const val    = Number(row[valKey] ?? 0);
    const filled = Math.max(2, Math.floor(barW * val / maxVal));
    const y      = i * rowH + Math.floor((rowH - 9) / 2);
    const color  = PALETTE[i % PALETTE.length];
    return [
      `<text x="0" y="${y+9}" font-size="10" fill="${MUTED}" font-family="Helvetica">${label}</text>`,
      `<rect x="120" y="${y}" width="${barW}" height="9" rx="2" fill="${TRACK}"/>`,
      `<rect x="120" y="${y}" width="${filled}" height="9" rx="2" fill="${color}"/>`,
      `<text x="${120+barW+4}" y="${y+9}" font-size="9" fill="${MUTED}" font-family="Helvetica">${esc(fmtV(val))}</text>`,
    ].join("");
  });
  return svgWrap(w, Math.max(h, rows.length * rowH), els.join(""));
}

export function vBarChartSvg(
  data: Array<Record<string, unknown>>,
  w: number, h: number,
): string {
  const rows   = data.slice(0, 8);
  const valKey = (rows[0] && Object.keys(rows[0]).find(k => k !== "name" && k !== "source" && k !== "type")) ?? "value";
  const lblKey = (rows[0] && "source" in rows[0]) ? "source" : "name";
  const maxVal = Math.max(...rows.map(r => Number(r[valKey] ?? 0))) || 1;
  const n      = rows.length;
  const pad    = 6;
  const barW   = Math.floor((w - pad * (n + 1)) / Math.max(n, 1));
  const chartH = h - 28;
  const els = rows.map((row, i) => {
    const val   = Number(row[valKey] ?? 0);
    const bh    = Math.max(4, Math.floor(chartH * val / maxVal));
    const bx    = pad + i * (barW + pad);
    const by    = chartH - bh;
    const color = PALETTE[i % PALETTE.length];
    const label = esc(String(row[lblKey] ?? "")).slice(0, 10);
    return [
      `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="2" fill="${color}"/>`,
      `<text x="${bx+Math.floor(barW/2)}" y="${Math.max(by-3,10)}" font-size="8" fill="${WHITE}" text-anchor="middle" font-family="Helvetica">${esc(fmtV(val))}</text>`,
      `<text x="${bx+Math.floor(barW/2)}" y="${h-4}" font-size="8" fill="${MUTED}" text-anchor="middle" font-family="Helvetica">${label}</text>`,
    ].join("");
  });
  return svgWrap(w, h, els.join(""));
}

export function generateChartSvg(
  sectionKey: string,
  data: Array<Record<string, unknown>>,
  w: number,
  h: number,
): string {
  if (sectionKey === "lease_premises_summary" || sectionKey === "business_health_score")
    return radarChartSvg(data as Parameters<typeof radarChartSvg>[0], w, h);
  if (sectionKey === "revenue_stream_breakdown" || sectionKey === "plant_equipment_summary")
    return pieChartSvg(data as Parameters<typeof pieChartSvg>[0], w, h);
  if (sectionKey === "division_breakdown" || sectionKey === "buyer_access_confidentiality")
    return hBarChartSvg(data, w, h);
  return vBarChartSvg(data, w, h);
}
