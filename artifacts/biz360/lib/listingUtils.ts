import { Listing, VerificationBadge } from "@/data/listings";
import { PendingListing } from "@/lib/adminStore";

export function pendingToListing(p: PendingListing): Listing {
  return {
    id:                  p.listingId,
    businessName:        p.businessName        ?? "Unnamed Listing",
    category:            p.category            ?? "",
    subcategory:         "",
    state:               p.state               ?? "",
    suburb:              p.suburb              ?? "",
    askingPrice:         p.askingPrice         ?? 0,
    weeklyRevenue:       p.weeklyRevenue       ?? 0,
    adjustedProfit:      p.adjustedProfit      ?? 0,
    rent:                p.rent                ?? 0,
    leaseExpiry:         p.leaseExpiry         ?? "",
    leaseOptions:        p.leaseOptions        ?? "",
    staffCount:          p.staffCount          ?? 0,
    ownerHours:          p.ownerHours          ?? 0,
    reasonForSale:       p.reasonForSale       ?? "",
    franchiseStatus:     p.franchiseStatus     ?? "",
    trainingPeriod:      p.trainingPeriod      ?? "",
    growthOpportunities: p.growthOpportunities ?? "",
    risks:               p.risks               ?? "",
    verified:            false,
    badges:              (p.badges as VerificationBadge[]) ?? [],
    hasTour:             false,
    confidential:        p.confidential        ?? false,
    contactPreference:   "message",
    sellerPhone:         p.sellerPhone,
    heroColor:           p.heroColor           ?? "#2563EB",
    description:         p.description         ?? "",
    imageUrl:            p.photos?.[0],
    savedCount:          0,
    viewCount:           0,
    tourStarts:          0,
  };
}
