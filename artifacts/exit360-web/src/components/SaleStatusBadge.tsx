const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  hot: { label: "Hot", cls: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  price_reduced: { label: "Price reduced", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  under_offer: { label: "Under offer", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  under_contract: { label: "Under contract", cls: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
  sold: { label: "Sold", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  coming_soon: { label: "Coming soon", cls: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
};
export function SaleStatusBadge({ status, className = "" }: { status?: string | null; className?: string }) {
  if (!status || status === "available" || !STATUS[status]) return null;
  const s = STATUS[status];
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls} ${className}`}>{s.label}</span>;
}
