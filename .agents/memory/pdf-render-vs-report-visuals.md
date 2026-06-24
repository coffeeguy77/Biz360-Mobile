---
name: PDF renderer vs report-visuals
description: Why fixing report-visuals/index.ts does NOT fix PDF output, and where actual PDF fixes go
---

# Two separate rendering paths

`report-visuals/index.ts` — generates/transforms chart data served to the mobile app and web HTML report.
`report-exports/index.ts` (buildPdf / renderSingleVisual) — reads pre-stored chartData from reportVisualsTable and renders charts itself. Does NOT call transformChartData.

**Why stale data bites**: reportVisualsTable stores chartData when charts are first generated. If unit-level snapshots were missing at generation time, raw values get stored as 0 or 1 (minimum). These stale values persist even after source data is fixed.

**The pattern to fix PDF bugs**:
1. Fix the PDF renderer functions directly (renderPdfBarsVisual, renderDivisionChart, etc.)
2. OR filter out the stale stored visual and let a live-data renderer handle it

## Division bar chart fix
Stored bar_chart visuals for division_breakdown have raw:1 for all bars when unit snapshots were missing.
Fix: at the start of buildPdf(), strip bar_chart/horizontal_bar_chart visuals for division_breakdown.
renderDivisionChart() handles this section using live unit-snapshot data.

## Equipment Keeping filter
Equipment queries in PDF (both seller ~line 2052 and buyer ~line 2574) must LEFT JOIN businessUnitsTable
and filter: or(isNull(unitId), eq(businessUnitsTable.isIncludedInSale, true))
Also filter: sql`lower(category) != 'keeping'`

**Why:** cafeEquipmentTable.unitId links to businessUnitsTable. Items in "Keeping" division have isIncludedInSale=false. Simple suspended=false filter was insufficient.
