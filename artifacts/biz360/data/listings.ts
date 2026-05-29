export type VerificationBadge =
  | "identity"
  | "abn"
  | "financials"
  | "lease"
  | "equipment"
  | "tour"
  | "broker"
  | "accountant"
  | "seller_supplied";

// ─── Rich popup content ────────────────────────────────────────────────────────

export interface PopupSection {
  label: string;
  value: string;
}

export interface PopupDocLink {
  label: string;
  url: string;
}

export interface PopupContent {
  heading?: string;
  body?: string;
  sections?: PopupSection[];
  images?: string[];
  docLinks?: PopupDocLink[];
}

export type AudioTrigger = "auto_prompt" | "button" | "hotspot";

// ─── Tour settings (global defaults per tour) ─────────────────────────────────

export type PinAnimation = "none" | "pulse" | "glow" | "bounce" | "ripple" | "breathing";

export interface TourSettings {
  defaultAnimation: PinAnimation;
  defaultPinSize: number;       // 0.5 – 2.0 scale
  defaultPinOpacity: number;    // 0.3 – 1.0
  showNarrationBar: boolean;
  defaultHeightMetres: number;  // 0 = floor … 2.8 = ceiling
  defaultHotspotBehaviour: "tap" | "always";
}

export const DEFAULT_TOUR_SETTINGS: TourSettings = {
  defaultAnimation: "pulse",
  defaultPinSize: 1.0,
  defaultPinOpacity: 1.0,
  showNarrationBar: true,
  defaultHeightMetres: 1.6,
  defaultHotspotBehaviour: "tap",
};

// ─── Tour pin ─────────────────────────────────────────────────────────────────

export interface TourPin {
  id: string;
  type:
    | "equipment"
    | "revenue"
    | "cogs"
    | "workflow"
    | "staffing"
    | "lease"
    | "risk"
    | "opportunity"
    | "narration"
    | "inspection"
    | "highlight"
    | "document"
    | "navigation"
    | "look"
    | "external_link"
    | "audio";
  title: string;
  description: string;
  position: { x: number; y: number };
  requiresNDA?: boolean;
  // Navigation hotspot
  targetSpaceId?: string;
  // Look pin — dedicated feature photo
  imageUrl?: string;
  // Ground-mounted pin (deprecated — use heightMetres instead)
  groundMounted?: boolean;
  // Height from ground in metres (overrides y-position pitch when set)
  heightMetres?: number;
  // Per-pin appearance overrides
  pinAnimation?: PinAnimation;
  pinIconKey?: string;    // system icon key; undefined = use type default
  pinSize?: number;       // scale 0.5–2.0; undefined = default
  pinOpacity?: number;    // 0.3–1.0; undefined = default
  pinColor?: string;      // hex override; undefined = type default
  // Audio / Listen hotspot
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  // Document / external link
  documentUrl?: string;
  externalUrl?: string;
  // Rich popup content (for info-type pins)
  popupContent?: PopupContent;
}

// ─── Tour space ───────────────────────────────────────────────────────────────

export interface TourSpace {
  id: string;
  name: string;
  photos: string[];
  panoramaUrl?: string;
  panoramaStartYaw?: number;
  pins: TourPin[];
  dirMode?: 4 | 8 | "panorama" | "single";
  // Scene-level audio narration
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  audioTranscript?: string;
  // Start scene designation
  isStartScene?: boolean;
}

// ─── Tour request (from buyer "Request More Info") ────────────────────────────

export interface TourRequest {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  category: string;
  message: string;
  timestamp: number;
  status: "new" | "seen" | "replied";
}

export type StatSlotOption =
  | "sde"
  | "staffCount"
  | "weeklyRevenue"
  | "rent"
  | "ownerHours"
  | "leaseExpiry"
  | "none";

export interface Listing {
  id: string;
  businessName: string;
  category: string;
  subcategory: string;
  state: string;
  suburb: string;
  askingPrice: number;
  weeklyRevenue: number;
  priceDisplay?: "askingPrice" | "weeklyRevenue" | "poa";
  stat2Display?: StatSlotOption;
  stat3Display?: StatSlotOption;
  adjustedProfit: number;
  rent: number;
  leaseExpiry: string;
  leaseOptions: string;
  staffCount: number;
  ownerHours: number;
  reasonForSale: string;
  franchiseStatus: string;
  trainingPeriod: string;
  growthOpportunities: string;
  risks: string;
  verified: boolean;
  badges: VerificationBadge[];
  hasTour: boolean;
  tourSpaces?: TourSpace[];
  confidential: boolean;
  contactPreference: "message" | "call" | "broker_only";
  sellerPhone?: string;
  brokerId?: string;
  heroColor: string;
  description: string;
  imageUrl?: string;
  savedCount: number;
  viewCount: number;
  tourStarts: number;
}

export const DEMO_LISTINGS: Listing[] = [
  {
    id: "listing-cafe-001",
    businessName: "The Daily Press Espresso Bar",
    category: "Food & Beverage",
    subcategory: "Cafe",
    state: "VIC",
    suburb: "Fitzroy",
    askingPrice: 185000,
    weeklyRevenue: 18500,
    adjustedProfit: 72000,
    rent: 4200,
    leaseExpiry: "2027-06-30",
    leaseOptions: "2 × 3 year options",
    staffCount: 4,
    ownerHours: 45,
    reasonForSale: "Relocating interstate for family reasons",
    franchiseStatus: "Independent",
    trainingPeriod: "4 weeks",
    growthOpportunities:
      "Catering arm not yet activated, online orders, corporate accounts in nearby precinct",
    risks: "New cafe opening 200m away in 6 months",
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "tour", "seller_supplied"],
    hasTour: true,
    confidential: false,
    contactPreference: "message",
    heroColor: "#7C4A1E",
    imageUrl: "https://picsum.photos/seed/cafe-biz360/800/500",
    description:
      "Established espresso bar in the heart of Fitzroy. Strong loyal customer base, premium equipment, and a proven revenue model. Turnkey operation with trained staff in place.",
    savedCount: 47,
    viewCount: 312,
    tourStarts: 89,
    tourSpaces: [
      {
        id: "space-001",
        name: "Main Floor",
        panoramaUrl: "https://pannellum.org/images/alma.jpg",
        panoramaStartYaw: 0,
        isStartScene: true,
        photos: [
          "https://picsum.photos/seed/cafe-main-0/1200/800",
          "https://picsum.photos/seed/cafe-main-1/1200/800",
          "https://picsum.photos/seed/cafe-main-2/1200/800",
          "https://picsum.photos/seed/cafe-main-3/1200/800",
          "https://picsum.photos/seed/cafe-main-4/1200/800",
          "https://picsum.photos/seed/cafe-main-5/1200/800",
          "https://picsum.photos/seed/cafe-main-6/1200/800",
          "https://picsum.photos/seed/cafe-main-7/1200/800",
        ],
        pins: [
          {
            id: "pin-001",
            type: "equipment",
            title: "La Marzocco Espresso Machine",
            description:
              "2022 La Marzocco Linea PB 3-group. Valued at $28,000 new. Fully serviced 3 months ago. Produces 250-300 coffees per day at peak. Included in sale price.",
            position: { x: 0.25, y: 0.45 },
            popupContent: {
              heading: "La Marzocco Linea PB 3-Group",
              body: "2022 model, fully serviced 3 months ago. Produces 250-300 coffees per day at peak. Included in sale price.",
              sections: [
                { label: "Purchase Year", value: "2022" },
                { label: "Replacement Value", value: "$28,000" },
                { label: "Last Service", value: "3 months ago" },
                { label: "Daily Output", value: "250–300 coffees" },
              ],
            },
          },
          {
            id: "pin-002",
            type: "revenue",
            title: "POS Counter — $18.5K/wk Revenue",
            description:
              "Weekly revenue consistently $17,000–$20,000 over 12 months. 65% coffee, 25% food, 10% merchandise. Peak hours: 7am–10am Mon–Fri. Saturday trade equal to a weekday.",
            position: { x: 0.55, y: 0.5 },
            popupContent: {
              sections: [
                { label: "Weekly Revenue", value: "$17,000–$20,000" },
                { label: "Coffee Revenue", value: "65%" },
                { label: "Food Revenue", value: "25%" },
                { label: "Merchandise", value: "10%" },
                { label: "Peak Hours", value: "7am–10am Mon–Fri" },
              ],
            },
          },
          {
            id: "pin-003",
            type: "staffing",
            title: "Staffing — 4 FTE",
            description:
              "2 baristas (full-time), 1 kitchen hand (full-time), 1 floor staff (part-time). All staff willing to remain post-sale. Owner works 45hrs/week including roaster relationship management.",
            position: { x: 0.7, y: 0.55 },
          },
          {
            id: "pin-004",
            type: "lease",
            title: "Lease — $4,200/mo Until June 2027",
            description:
              "Current rent $4,200/month gross. Two 3-year options to renew at CPI+1%. Landlord cooperative and open to assignment. 98sqm footprint including kitchen and storage.",
            position: { x: 0.15, y: 0.6 },
            requiresNDA: true,
          },
          {
            id: "pin-005",
            type: "cogs",
            title: "COGS — 28% of Revenue",
            description:
              "Cost of goods running at 28% of revenue. Coffee beans sourced from Genovese ($320/week). Food COGS at 32%. Strong supplier relationships with 30-day terms negotiated.",
            position: { x: 0.4, y: 0.4 },
          },
          {
            id: "pin-006",
            type: "opportunity",
            title: "Catering Opportunity — Not Yet Activated",
            description:
              "3 corporate offices within 200m have expressed interest in regular catering. Equipment and kitchen capacity supports this. Could add $1,500–$3,000/week in high-margin revenue.",
            position: { x: 0.85, y: 0.45 },
          },
          {
            id: "pin-nav-001",
            type: "navigation",
            title: "Go to Kitchen",
            description: "See the full commercial kitchen setup",
            position: { x: 0.92, y: 0.55 },
            targetSpaceId: "space-002",
          },
        ],
      },
      {
        id: "space-002",
        name: "Kitchen",
        panoramaUrl: "https://pannellum.org/images/alma.jpg",
        panoramaStartYaw: 180,
        photos: [
          "https://picsum.photos/seed/cafe-kitchen-0/1200/800",
          "https://picsum.photos/seed/cafe-kitchen-1/1200/800",
          "https://picsum.photos/seed/cafe-kitchen-2/1200/800",
          "https://picsum.photos/seed/cafe-kitchen-3/1200/800",
        ],
        pins: [
          {
            id: "pin-007",
            type: "equipment",
            title: "Commercial Kitchen — Full Setup",
            description:
              "6-burner commercial range, double-door fridge, commercial dishwasher, prep benches. Health inspection rating: Excellent. Last inspection Jan 2024.",
            position: { x: 0.3, y: 0.5 },
          },
          {
            id: "pin-008",
            type: "workflow",
            title: "Food Prep Workflow",
            description:
              "All food prepared fresh daily 6am–8am. Menu designed for speed and consistency. SOPs documented for all items. New owner can operate with minimal culinary background.",
            position: { x: 0.65, y: 0.55 },
          },
          {
            id: "pin-nav-002",
            type: "navigation",
            title: "Back to Main Floor",
            description: "Return to the main seating area",
            position: { x: 0.08, y: 0.55 },
            targetSpaceId: "space-001",
          },
          {
            id: "pin-nav-003",
            type: "navigation",
            title: "Go to Outdoor Area",
            description: "See the outdoor dining space",
            position: { x: 0.92, y: 0.55 },
            targetSpaceId: "space-003",
          },
        ],
      },
      {
        id: "space-003",
        name: "Outdoor Seating",
        panoramaUrl: "https://pannellum.org/images/cerro-toco-0.jpg",
        panoramaStartYaw: 0,
        photos: [
          "https://picsum.photos/seed/cafe-outdoor-0/1200/800",
          "https://picsum.photos/seed/cafe-outdoor-1/1200/800",
          "https://picsum.photos/seed/cafe-outdoor-2/1200/800",
          "https://picsum.photos/seed/cafe-outdoor-3/1200/800",
        ],
        pins: [
          {
            id: "pin-009",
            type: "lease",
            title: "Outdoor Licence — 12 Seats",
            description:
              "Council-approved footpath trading licence. 12 outdoor seats generating ~$2,400/week in fine weather. Licence transferable to new owner. Annual fee $1,800.",
            position: { x: 0.4, y: 0.5 },
          },
          {
            id: "pin-nav-004",
            type: "navigation",
            title: "Back to Kitchen",
            description: "Return to the kitchen",
            position: { x: 0.08, y: 0.55 },
            targetSpaceId: "space-002",
          },
        ],
      },
    ],
  },
  {
    id: "listing-salon-001",
    businessName: "Luxe & Co Hair Studio",
    category: "Health & Beauty",
    subcategory: "Hair Salon",
    state: "NSW",
    suburb: "Surry Hills",
    askingPrice: 95000,
    weeklyRevenue: 9800,
    adjustedProfit: 52000,
    rent: 3100,
    leaseExpiry: "2026-12-31",
    leaseOptions: "1 × 3 year option",
    staffCount: 3,
    ownerHours: 40,
    reasonForSale: "Pursuing new venture in wellness industry",
    franchiseStatus: "Independent",
    trainingPeriod: "2 weeks",
    growthOpportunities: "Add beauty services, launch loyalty app, expand retail product range",
    risks: "Lease renewal negotiation due Dec 2026",
    verified: true,
    badges: ["identity", "abn", "financials", "tour", "seller_supplied"],
    hasTour: true,
    confidential: false,
    contactPreference: "call",
    heroColor: "#8B5CF6",
    imageUrl: "https://picsum.photos/seed/salon-biz360/800/500",
    description:
      "Premium hair studio with 3 styling chairs and a loyal client base of 400+ regulars. Designer fit-out with $40K investment. Turnkey including all products and software.",
    savedCount: 28,
    viewCount: 187,
    tourStarts: 45,
    tourSpaces: [
      {
        id: "salon-space-001",
        name: "Main Studio",
        panoramaUrl: "https://pannellum.org/images/alma.jpg",
        panoramaStartYaw: 90,
        isStartScene: true,
        photos: [
          "https://picsum.photos/seed/salon-main-0/1200/800",
          "https://picsum.photos/seed/salon-main-1/1200/800",
          "https://picsum.photos/seed/salon-main-2/1200/800",
          "https://picsum.photos/seed/salon-main-3/1200/800",
        ],
        pins: [
          {
            id: "salon-pin-001",
            type: "equipment",
            title: "3 Styling Stations — Fully Equipped",
            description:
              "3 Takara Belmont styling chairs ($3,200 each), Dyson Airwrap stations, colour trolleys. All equipment included. Fit-out cost $40K, 2 years old.",
            position: { x: 0.35, y: 0.5 },
          },
          {
            id: "salon-pin-002",
            type: "revenue",
            title: "Revenue — $9,800/wk",
            description:
              "Services: 70% colour/cut, 15% treatments, 15% retail product sales. Booking system (Kitomba) has 400+ active clients. Average client spend $185.",
            position: { x: 0.6, y: 0.45 },
          },
        ],
      },
    ],
  },
  {
    id: "listing-laundromat-001",
    businessName: "SpinCity Laundromat",
    category: "Services",
    subcategory: "Laundromat",
    state: "QLD",
    suburb: "West End",
    askingPrice: 145000,
    weeklyRevenue: 6200,
    adjustedProfit: 68000,
    rent: 2800,
    leaseExpiry: "2028-03-31",
    leaseOptions: "2 × 5 year options",
    staffCount: 1,
    ownerHours: 15,
    reasonForSale: "Semi-retirement. Owner wishes to reduce portfolio.",
    franchiseStatus: "Independent",
    trainingPeriod: "1 week",
    growthOpportunities: "Add wash-dry-fold service, vending machines, online booking",
    risks: "Washer maintenance costs rising",
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "equipment", "seller_supplied"],
    hasTour: false,
    confidential: false,
    contactPreference: "message",
    heroColor: "#0EA5E9",
    imageUrl: "https://picsum.photos/seed/laundry-biz360/800/500",
    description:
      "Highly automated coin-operated laundromat running with 15 owner hours per week. Strong passive income with 5-year lease secured. 22 washers, 16 dryers — all commercial grade.",
    savedCount: 61,
    viewCount: 445,
    tourStarts: 12,
  },
  {
    id: "listing-gym-001",
    businessName: "Iron Republic Gym",
    category: "Health & Fitness",
    subcategory: "Gym",
    state: "VIC",
    suburb: "Richmond",
    askingPrice: 320000,
    weeklyRevenue: 22000,
    adjustedProfit: 98000,
    rent: 7500,
    leaseExpiry: "2029-01-31",
    leaseOptions: "1 × 5 year option",
    staffCount: 8,
    ownerHours: 50,
    reasonForSale: "Owner expanding to new national brand, selling flagship",
    franchiseStatus: "Independent",
    trainingPeriod: "6 weeks",
    growthOpportunities: "Personal training expansion, corporate memberships, online programming",
    risks: "Competitive market — 2 budget gyms within 1km",
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "equipment", "tour", "accountant"],
    hasTour: true,
    confidential: true,
    contactPreference: "broker_only",
    brokerId: "broker-001",
    heroColor: "#1E3A5C",
    imageUrl: "https://picsum.photos/seed/gym-biz360/800/500",
    description:
      "Established premium gym with 800+ active members. 450sqm state-of-the-art facility with $180K equipment. Strong PT revenue stream and growing corporate accounts.",
    savedCount: 93,
    viewCount: 678,
    tourStarts: 201,
    tourSpaces: [
      {
        id: "gym-space-001",
        name: "Weights Floor",
        panoramaUrl: "https://pannellum.org/images/alma.jpg",
        panoramaStartYaw: 270,
        isStartScene: true,
        photos: [
          "https://picsum.photos/seed/gym-floor-0/1200/800",
          "https://picsum.photos/seed/gym-floor-1/1200/800",
          "https://picsum.photos/seed/gym-floor-2/1200/800",
          "https://picsum.photos/seed/gym-floor-3/1200/800",
        ],
        pins: [
          {
            id: "gym-pin-001",
            type: "equipment",
            title: "Equipment — $180K Value",
            description:
              "Full set of commercial Technogym and Life Fitness equipment. 3 squat racks, 2 platforms, cable machines, cardio suite. All maintained under service contract.",
            position: { x: 0.4, y: 0.5 },
          },
          {
            id: "gym-pin-002",
            type: "revenue",
            title: "800+ Members — $22K/wk Revenue",
            description:
              "823 active members at $49.95/month. 12 PTs generating $4,200/week in split revenue. Corporate accounts: 3 local businesses, $1,800/month.",
            position: { x: 0.65, y: 0.45 },
          },
        ],
      },
    ],
  },
  {
    id: "listing-restaurant-001",
    businessName: "Ember & Stone Restaurant",
    category: "Food & Beverage",
    subcategory: "Restaurant",
    state: "NSW",
    suburb: "Newtown",
    askingPrice: 250000,
    weeklyRevenue: 28000,
    adjustedProfit: 115000,
    rent: 9500,
    leaseExpiry: "2027-09-30",
    leaseOptions: "1 × 5 year option",
    staffCount: 12,
    ownerHours: 60,
    reasonForSale: "Owner health reasons",
    franchiseStatus: "Independent",
    trainingPeriod: "8 weeks",
    growthOpportunities: "Private dining events, cooking classes, liquor licence upgrade",
    risks: "Key chef dependency. Head chef has 6 months left on contract.",
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "seller_supplied"],
    hasTour: false,
    confidential: true,
    contactPreference: "broker_only",
    brokerId: "broker-001",
    heroColor: "#92400E",
    imageUrl: "https://picsum.photos/seed/restaurant-biz360/800/500",
    description:
      "Award-winning contemporary Australian restaurant. 80-cover dining room, full commercial kitchen, liquor licence. Rated in The Age Good Food Guide 2023.",
    savedCount: 54,
    viewCount: 389,
    tourStarts: 28,
  },
];

export function getListingById(id: string): Listing | undefined {
  return DEMO_LISTINGS.find((l) => l.id === id);
}

export function formatPrice(price: number): string {
  return `$${(price / 1000).toFixed(0)}K`;
}

export function formatRevenue(weekly: number): string {
  const annual = weekly * 52;
  if (annual >= 1000000) return `$${(annual / 1000000).toFixed(1)}M p.a.`;
  return `$${(annual / 1000).toFixed(0)}K p.a.`;
}

export const BADGE_LABELS: Record<string, string> = {
  identity: "ID Verified",
  abn: "ABN Verified",
  financials: "Financials",
  lease: "Lease Docs",
  equipment: "Equipment List",
  tour: "360 Tour",
  broker: "Broker Listed",
  accountant: "Accountant Verified",
  seller_supplied: "Seller Supplied",
};
