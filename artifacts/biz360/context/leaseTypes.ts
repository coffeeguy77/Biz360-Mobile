export type Jurisdiction = 'ACT' | 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT';
export type LeaseType = 'commercial' | 'retail' | 'licence' | 'mixed';
export type PremisesType = 'cafe' | 'kiosk' | 'restaurant' | 'office-foyer-cafe' | 'shopping-centre-cafe' | 'street-front-cafe' | 'outdoor-seating-cafe';
export type LeasePosition = 'tenant-friendly' | 'balanced' | 'landlord-friendly';
export type ClauseRating = 'tenant-friendly' | 'landlord-friendly' | 'balanced';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AnalysisStatus = 'pending' | 'analysing' | 'complete' | 'failed';

export interface Clause {
  id: string;
  title: string;
  category: string;
  rating: ClauseRating;
  riskLevel: RiskLevel;
  plainEnglish: string;
  originalText: string;
  suggestedText?: string;
  jurisdictions: Jurisdiction[];
  cafeRelevanceScore: number;
  negotiationScore: number;
  sourceLeaseId?: string;
  isSeed?: boolean;
}

export interface Lease {
  id: string;
  name: string;
  uploadDate: string;
  status: AnalysisStatus;
  fileType: 'pdf' | 'docx';
  jurisdiction?: Jurisdiction;
  leaseType?: LeaseType;
  parties?: { tenant?: string; landlord?: string };
  premises?: string;
  term?: string;
  rentAmount?: string;
  clauseCount?: number;
  extractedClauseIds?: string[];
}

export interface DraftSection {
  id: string;
  title: string;
  content: string;
  type: 'schedule' | 'special-conditions' | 'licence-clauses' | 'tenant-protections' | 'summary' | 'checklist' | 'red-flags';
}

export interface DraftLease {
  id: string;
  name: string;
  createdAt: string;
  jurisdiction: Jurisdiction;
  leaseType: LeaseType;
  premisesType: PremisesType;
  position: LeasePosition;
  rentStructure: string;
  outgoingsStructure: string;
  licenceAreas: string[];
  selectedProtections: string[];
  sections: DraftSection[];
}

export interface BuilderState {
  jurisdiction: Jurisdiction;
  leaseType: LeaseType;
  premisesType: PremisesType;
  position: LeasePosition;
  rentStructure: string;
  outgoingsStructure: string;
  licenceAreas: string[];
  selectedProtections: string[];
  occupancyThreshold: number;
}
