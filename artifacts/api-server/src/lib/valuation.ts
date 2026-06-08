export function computeGrossRevenue(squareRevenue: number, xeroRevenue: number): number {
  return squareRevenue + xeroRevenue;
}

export function computeGrossProfit(revenue: number, cogsFromSuppliers: number, hasSupplierMappings: boolean): number {
  return hasSupplierMappings ? Math.max(revenue - cogsFromSuppliers, 0) : revenue * 0.63;
}

export function computeEbitda(revenue: number, xeroTotalExpenses: number, xeroTotalRevenue: number, hasXero: boolean): number {
  if (!hasXero || xeroTotalRevenue <= 0) return revenue * 0.14;
  const cafeFraction = Math.min(revenue / xeroTotalRevenue, 1);
  return revenue - xeroTotalExpenses * cafeFraction;
}

export function computeAdjustedEbitda(ebitda: number, adjustments: { annualAmount: number | string }[], periodMonths: number): number {
  const annualTotal = adjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);
  return ebitda + (annualTotal / 12) * periodMonths;
}

export function computeValuationMidpoint(adjEbitda: number, totalEquipmentValue: number): number {
  return Math.max(adjEbitda, 0) * 2.5 + totalEquipmentValue;
}

export function computeUnitValuation(
  unit: { revenueSharePct: string | number },
  totalRevenue: number,
  xeroTotalExpenses: number,
  periodMonths: number,
  unitCOGS: number,
  hasSupplierMappings: boolean,
  unitAdjustments: { annualAmount: number | string }[],
  unitEquipmentValue: number,
): {
  unitRevenue: number;
  unitCOGS: number;
  unitGrossProfit: number;
  unitEBITDA: number;
  unitAddbacksTotal: number;
  unitAdjEBITDA: number;
  unitEquipmentValue: number;
  unitValuation: number;
} {
  const sharePct = Number(unit.revenueSharePct) / 100;
  const unitRevenue = totalRevenue * sharePct;
  const unitGrossProfit = hasSupplierMappings ? Math.max(unitRevenue - unitCOGS, 0) : unitRevenue * 0.63;
  const sharedExpenseFrac = sharePct;
  const unitEBITDA = unitRevenue - (xeroTotalExpenses * sharedExpenseFrac);
  const annualTotal = unitAdjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);
  const unitAddbacksTotal = (annualTotal / 12) * periodMonths;
  const unitAdjEBITDA = unitEBITDA + unitAddbacksTotal;
  const valuation = Math.max(unitAdjEBITDA, 0) * 2.5 + unitEquipmentValue;
  return { unitRevenue, unitCOGS, unitGrossProfit, unitEBITDA, unitAddbacksTotal, unitAdjEBITDA, unitEquipmentValue, unitValuation: valuation };
}
