// ─────────────────────────────────────────────────────────────────────────────
// Biz360 In-App Wiki
// Role hierarchy: admin > broker > seller > buyer
// - 'all'    → sellers, brokers, admins
// - 'seller' → sellers, brokers, admins
// - 'broker' → brokers + admins only
// - 'admin'  → admins only
// ─────────────────────────────────────────────────────────────────────────────

export type WikiRole = "all" | "seller" | "broker" | "admin";

export interface WikiSection {
  heading?: string;
  body: string;
}

export interface WikiArticle {
  id: string;
  categoryId: string;
  title: string;
  icon: string;
  summary: string;
  roles: WikiRole[];
  sections: WikiSection[];
  updatedDate?: string;
}

export interface WikiCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  roles: WikiRole[];
}

// ─── Role visibility helper ────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = { seller: 1, broker: 2, admin: 3 };

export function isArticleVisible(
  article: WikiArticle,
  userRole: string,
): boolean {
  const rank = ROLE_RANK[userRole] ?? 0;
  return article.roles.some((r) => {
    if (r === "all" || r === "seller") return rank >= 1;
    if (r === "broker") return rank >= 2;
    if (r === "admin") return rank >= 3;
    return false;
  });
}

export function isCategoryVisible(
  category: WikiCategory,
  userRole: string,
): boolean {
  const rank = ROLE_RANK[userRole] ?? 0;
  return category.roles.some((r) => {
    if (r === "all" || r === "seller") return rank >= 1;
    if (r === "broker") return rank >= 2;
    if (r === "admin") return rank >= 3;
    return false;
  });
}

// ─── Categories ────────────────────────────────────────────────────────────

export const WIKI_CATEGORIES: WikiCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    description: "Account setup, verification, and first steps",
    roles: ["all"],
  },
  {
    id: "listings",
    title: "Listings",
    icon: "🏢",
    description: "Creating and managing your business listings",
    roles: ["seller"],
  },
  {
    id: "virtual-tours",
    title: "Virtual Tours",
    icon: "🎭",
    description: "Building immersive 360° tours for buyers",
    roles: ["seller"],
  },
  {
    id: "pins-hotspots",
    title: "Pins & Hotspots",
    icon: "📍",
    description: "Deep dive into pin customisation and behaviour",
    roles: ["seller"],
  },
  {
    id: "leads-messages",
    title: "Leads & Messages",
    icon: "💬",
    description: "Managing buyer enquiries and conversations",
    roles: ["seller"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: "🔧",
    description: "Fixes for common issues with tours and pins",
    roles: ["seller"],
  },
  {
    id: "broker-features",
    title: "Broker Features",
    icon: "👔",
    description: "Dashboard, team management, analytics, and billing",
    roles: ["broker"],
  },
  {
    id: "platform-admin",
    title: "Platform Admin",
    icon: "⚙️",
    description: "User management, moderation, and platform settings",
    roles: ["admin"],
  },
];

// ─── Articles ──────────────────────────────────────────────────────────────

export const WIKI_ARTICLES: WikiArticle[] = [
  // ── Getting Started ──────────────────────────────────────────────────────

  {
    id: "gs-welcome",
    categoryId: "getting-started",
    title: "Welcome to Biz360",
    icon: "👋",
    summary: "An overview of what Biz360 is and how it helps you sell your business.",
    roles: ["all"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Biz360 is a business-for-sale marketplace with an emphasis on transparency. Unlike traditional listing platforms, Biz360 lets you create immersive 360° virtual tours so buyers can walk through your business before ever making contact — reducing tyre-kickers and speeding up due diligence.",
      },
      {
        heading: "Who is Biz360 for?",
        body: "• Sellers — business owners who want to list their business for sale and attract qualified buyers.\n• Buyers — individuals looking to purchase an existing business.\n• Brokers — professional business brokers who manage listings and buyer relationships on behalf of sellers.\n• Admins — Biz360 platform staff who moderate listings and manage the marketplace.",
      },
      {
        heading: "How it works",
        body: "1. Create your seller account and verify your identity.\n2. Build your listing with business details, financials, and photos.\n3. Create a virtual tour using the Tour Builder.\n4. Buyers discover your listing, request access, and explore the tour.\n5. Qualified buyers message you directly. You manage leads from the Leads tab.",
      },
    ],
  },

  {
    id: "gs-account-setup",
    categoryId: "getting-started",
    title: "Setting Up Your Seller Account",
    icon: "👤",
    summary: "Phone verification, display name, and account preferences.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Phone verification",
        body: "Biz360 uses phone number verification (via OTP SMS) to confirm your identity. This is required before you can publish a listing. Enter your mobile number → receive a 6-digit code → enter it to verify.",
      },
      {
        heading: "Display name",
        body: "Your display name is shown to buyers in messages. For privacy, we recommend using your first name only. You can change your display name at any time from the account menu (tap your avatar in the dashboard header).",
      },
      {
        heading: "Demo mode",
        body: "If you want to explore the buyer or broker interface without logging out, you can switch to Demo Mode from the account menu. Your real seller account is preserved — tap 'Back to my account' to return.",
      },
    ],
  },

  {
    id: "gs-verification-badges",
    categoryId: "getting-started",
    title: "Verification & Trust Badges",
    icon: "✅",
    summary: "What the verification badges mean and how to earn them.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Verification badges appear on your listing and signal to buyers that specific claims have been independently confirmed. Listings with more badges receive higher search ranking.",
      },
      {
        heading: "Available badges",
        body: "• Identity — Your identity has been verified via phone OTP.\n• ABN — Your Australian Business Number has been confirmed as active.\n• Financials — Financial statements have been reviewed (broker or accountant verified).\n• Lease — A copy of the current lease has been provided.\n• Equipment — An equipment asset list has been provided.\n• Tour — A virtual tour has been published for the listing.\n• Broker — A licensed business broker is managing this listing.\n• Accountant — An accountant has verified the financial figures.\n• Seller Supplied — Documents are self-supplied by the seller (not independently verified).",
      },
      {
        heading: "How to earn badges",
        body: "Most badges are added by your broker or by platform admins after reviewing documents. The Tour badge is awarded automatically when you publish a virtual tour for your listing.",
      },
    ],
  },

  // ── Listings ─────────────────────────────────────────────────────────────

  {
    id: "listings-create",
    categoryId: "listings",
    title: "Creating Your First Listing",
    icon: "📝",
    summary: "Step-by-step guide to creating and publishing a business listing.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Tap the Listings tab → tap the + button in the top right → fill in the listing form.",
      },
      {
        heading: "Required fields",
        body: "• Business name — the trading name of the business.\n• Category — select the industry (e.g. Café, Retail, Professional Services).\n• Asking price — your list price in AUD.\n• Location — suburb, state, and postcode.\n• Description — a clear summary of what the business does and why it's for sale.",
      },
      {
        heading: "Optional but recommended",
        body: "• Annual revenue and SDE (Seller's Discretionary Earnings) — buyers filter heavily on these.\n• Lease expiry and rent details.\n• Number of staff (full-time and part-time).\n• Reason for sale — honesty here builds trust.\n• Listing photos — at least 3 high-quality images.",
      },
      {
        heading: "After you submit",
        body: "New listings go into Pending Review. The Biz360 admin team typically approves listings within 1 business day. You will see the status change in your Listings tab.",
      },
    ],
  },

  {
    id: "listings-status",
    categoryId: "listings",
    title: "Listing Status & Approval",
    icon: "🔔",
    summary: "Understanding pending, approved, and rejected listing states.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Pending",
        body: "Your listing has been submitted and is awaiting review by the Biz360 team. Buyers cannot see the listing yet.",
      },
      {
        heading: "Approved / Active",
        body: "Your listing is live and discoverable by buyers. Make sure your tour is published and your photos are up to date.",
      },
      {
        heading: "Rejected",
        body: "The listing did not meet Biz360's content guidelines. Common reasons: inaccurate financial claims, copyrighted images, or missing required information. Edit the listing to address the issues and resubmit.",
      },
    ],
  },

  // ── Virtual Tours ─────────────────────────────────────────────────────────

  {
    id: "tours-overview",
    categoryId: "virtual-tours",
    title: "Tour Builder Overview",
    icon: "🏗️",
    summary: "A bird's eye view of how the Tour Builder works.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Tour Builder (Tours tab) lets you create multi-space 360° virtual tours that buyers can explore before requesting an inspection. Each listing can have one active tour made up of multiple spaces (rooms or areas).",
      },
      {
        heading: "Key concepts",
        body: "• Space — a single room or area (e.g. Main Dining, Kitchen, Outdoor Deck). Each space has its own photos or panorama and its own set of pins.\n• Pin — a clickable hotspot placed inside a space that reveals information, audio narration, photos, or navigation to another space.\n• Tour Settings — global defaults for pin animation, size, and opacity that apply across all spaces unless overridden per-pin.",
      },
      {
        heading: "Workflow",
        body: "1. Open the Tours tab and select (or create) your listing's tour.\n2. Tap + to add a new space.\n3. Choose a photo mode and upload your photos or panorama.\n4. Add and position pins.\n5. Customise each pin (type, height, icon, audio, popup content).\n6. Tap Save Space.\n7. Repeat for each room/area.\n8. Use the 🌐 NAV button to set navigation connections between spaces.",
      },
    ],
  },

  {
    id: "tours-spaces",
    categoryId: "virtual-tours",
    title: "Creating Spaces",
    icon: "🗂️",
    summary: "How to add, name, and configure spaces in your tour.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Adding a space",
        body: "In the Tour Builder tap the + Add Space button. Give the space a descriptive name (e.g. 'Front of House', 'Kitchen', 'Outdoor Dining'). This name appears in the tour navigation bar buyers see.",
      },
      {
        heading: "Start Scene",
        body: "One space should be designated as the Start Scene — this is where buyers land when they first open the tour. Toggle 'Start Scene: ON' in the space settings. Only one space can be the start scene at a time.",
      },
      {
        heading: "Reordering spaces",
        body: "Long-press a space card in the builder to drag it to a new position. The order determines how spaces appear in the buyer's navigation list.",
      },
      {
        heading: "Deleting a space",
        body: "Swipe left on a space card → tap Delete. This permanently removes the space and all its pins. This action cannot be undone.",
      },
    ],
  },

  {
    id: "tours-photo-modes",
    categoryId: "virtual-tours",
    title: "Photo Modes Explained",
    icon: "📸",
    summary: "360° panorama, single photo, 4-direction, and 8-direction modes.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "360° Photo (Panorama)",
        body: "Best choice. Upload a full equirectangular panorama exported from an Insta360, GoPro Max, or any 360° camera app. Buyers can look in any direction — up, down, left, right. Supports the full pin height and floor calibration system. Resolution should be at least 4096 × 2048 px.",
      },
      {
        heading: "Single Photo",
        body: "A single wide-angle or standard photo displayed as a flat image. Pins can be placed anywhere on the photo. Useful for close-up areas (e.g. an equipment panel, menu board) where a 360° shot is impractical.",
      },
      {
        heading: "4-Direction",
        body: "Four photos representing Front, Right, Back, and Left. Buyers swipe between directions. Good when you don't have a 360° camera but want to show all angles of a space.",
      },
      {
        heading: "8-Direction",
        body: "Eight photos: Front, Front-Right, Right, Back-Right, Back, Back-Left, Left, Front-Left. More comprehensive than 4-direction. Useful for larger open spaces.",
      },
      {
        heading: "Which mode should I use?",
        body: "Use 360° if you have the camera — it gives the best buyer experience and supports all pin features. Use 4 or 8 direction if you only have a standard smartphone. Avoid Single for entire rooms; reserve it for detail shots.",
      },
    ],
  },

  {
    id: "tours-audio-narration",
    categoryId: "virtual-tours",
    title: "Audio Narration",
    icon: "🎙️",
    summary: "Adding spoken narration to spaces and audio pins.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Space-level narration",
        body: "Each space can have a background audio narration — a recording of you (or your broker) talking about that area. Upload an MP3 or WAV file to Cloudinary and paste the URL into the Audio Narration section of the space settings.\n\nTrigger modes:\n• Auto Prompt — buyers are shown a Play button automatically when they enter the space.\n• Button — a Play button appears at the bottom of the screen (buyers choose when to listen).\n• Hotspot — narration only plays when the buyer taps a specific audio pin.",
      },
      {
        heading: "Audio pins",
        body: "Individual pins can also trigger audio. Set the pin type to 'Audio', then paste a Cloudinary audio URL into the pin settings. When a buyer taps the pin, the audio plays. Audio pins show a pulsing animation by default to draw the buyer's attention.",
      },
      {
        heading: "Tips for good narration",
        body: "• Keep clips under 90 seconds per space.\n• Speak conversationally — buyers trust a natural voice more than a scripted pitch.\n• Mention what makes this area valuable (e.g. 'This kitchen was fully fitted out in 2024 — all equipment is included in the sale').\n• Record in a quiet room with no background noise.",
      },
    ],
  },

  {
    id: "tours-settings",
    categoryId: "virtual-tours",
    title: "Tour Settings (Global Defaults)",
    icon: "⚙️",
    summary: "Setting global defaults for animation, pin size, opacity, and narration behaviour.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Tour Settings (tap the ⚙️ icon in the Tour Builder header) control the default appearance of all pins in your tour. Individual pins can override these defaults.",
      },
      {
        heading: "Default Animation",
        body: "The animation all new pins use unless overridden. Options: None, Pulse, Glow, Bounce, Ripple, Breathing. See Pin Animations in the Pins & Hotspots section for descriptions of each.",
      },
      {
        heading: "Default Pin Size",
        body: "A scale multiplier (0.5× to 2.0×) applied to all pins. 1.0 is standard size. Increase for easier tapping on smaller screens.",
      },
      {
        heading: "Default Opacity",
        body: "How transparent pins appear (0.3 = very faint, 1.0 = fully opaque). Reducing opacity can make pins feel less intrusive while still being visible.",
      },
      {
        heading: "Narration Bar",
        body: "Toggle whether the narration play bar appears at the bottom of the screen for buyers. Disable this if you prefer narration to be triggered via hotspots only.",
      },
      {
        heading: "Default Height",
        body: "The height from the ground (in metres) assigned to new pins by default. Presets: Floor (0m), Table (0.75m), Counter (0.9m), Eye Level (1.6m), Signage (2m), Ceiling (2.8m).",
      },
    ],
  },

  {
    id: "tours-tour-guide",
    categoryId: "virtual-tours",
    title: "Tour Guide (Buyer Help)",
    icon: "❓",
    summary: "The contextual help sheet buyers can access while viewing your tour.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Your tour automatically includes a Tour Guide — a help sheet buyers can open by tapping the ? button in the top-right corner of the tour viewer.",
      },
      {
        heading: "What the Tour Guide shows",
        body: "• Navigation hints (swipe, tap, drag to look around).\n• A legend of all pin types that appear in your tour (only shows icons actually used).\n• Instructions for triggering audio narration.",
      },
      {
        heading: "Pin legend",
        body: "The guide automatically generates a legend based on which pin types are present in the current space. For example, if you have navigation pins and audio pins, buyers see the 🔵 Navigation and 🎵 Audio icons with descriptions. You don't need to manage this manually.",
      },
    ],
  },

  // ── Pins & Hotspots ───────────────────────────────────────────────────────

  {
    id: "pins-overview",
    categoryId: "pins-hotspots",
    title: "Pin Types Reference",
    icon: "📌",
    summary: "All 16 pin types and what each one is designed for.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Pins are interactive hotspots placed inside a space. Each has a type that determines its default icon, colour, and behaviour.",
      },
      {
        heading: "Navigation & Interaction",
        body: "• 🔵 Navigation — takes buyers to another space. Default: ripple animation.\n• 👁️ Look — draws attention to a visual feature (view, decor, signage).\n• 🔗 External Link — opens a URL (menu, Google Maps, real estate portal).",
      },
      {
        heading: "Business Information",
        body: "• 💼 Revenue — highlight income streams (e.g. dine-in, takeaway, catering).\n• 📦 COGS — cost of goods / cost of sales information.\n• 🔧 Equipment — machinery, fixtures, or equipment included in the sale.\n• 📋 Workflow — describe operational processes.\n• 👥 Staffing — team structure, number of staff, roles.\n• 🏠 Lease — lease terms, expiry, rent, outgoings.\n• ⚠️ Risk — disclose known risks transparently.\n• 🌟 Opportunity — growth opportunities or untapped potential.",
      },
      {
        heading: "Documents & Media",
        body: "• 🎤 Narration — triggers audio narration when tapped.\n• 🎵 Audio — plays an audio clip (e.g. ambient sound, explanation).\n• ⚡ Highlight — draws attention to a standout feature.\n• 📄 Document — links to a PDF, lease, or other document.\n• 📋 Inspection — notes from an inspection or condition report.",
      },
    ],
  },

  {
    id: "pins-placing",
    categoryId: "pins-hotspots",
    title: "Adding & Placing Pins",
    icon: "✏️",
    summary: "How to create a pin, place it on your panorama, and save it.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Creating a pin",
        body: "In the space editor, scroll to the Pins section → tap + Add Pin. Choose a pin type, give it a title (shown when buyers tap it), and optionally add a description.",
      },
      {
        heading: "Placing on a panorama",
        body: "For 360° panorama spaces, tap 'Place on Panorama'. The panorama image opens in a flat view. Tap the spot where you want the pin to appear. The pin is anchored at that point in the 2D image — which maps to a yaw (horizontal angle) and a vertical position in the 3D panorama.\n\nTip: Aim for where the subject is in the image. The pin will appear there in the live tour.",
      },
      {
        heading: "Repositioning",
        body: "Tap the pin in the pin list → tap 'Reposition pin' to move it. The current position percentage is shown (e.g. '45%, 60%').",
      },
      {
        heading: "Vertical position vs. height",
        body: "When you place a pin by tapping the flat image, its vertical position is stored as a Y coordinate (0% = top, 100% = bottom of the image). You can override the vertical position in the 360° viewer by setting an explicit HEIGHT FROM GROUND in the pin settings. See the Height From Ground article for details.",
      },
    ],
  },

  {
    id: "pins-height",
    categoryId: "pins-hotspots",
    title: "Height From Ground",
    icon: "📏",
    summary: "Positioning pins at the correct vertical level in a 360° panorama.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "In 360° panorama spaces you can set an explicit height (in metres) for each pin. This overrides the tap-placement vertical position and uses a calibrated formula to place the pin at the correct pitch angle in the panorama.",
      },
      {
        heading: "Height presets",
        body: "• Floor — 0.0 m (ground level)\n• Table — 0.75 m (table top / low signage)\n• Counter — 0.9 m (bench / bar height)\n• Eye Level — 1.6 m (default for most pins)\n• Signage — 2.0 m (wall signs, high fixtures)\n• Ceiling — 2.8 m (ceiling features, overhead equipment)",
      },
      {
        heading: "Custom height",
        body: "You can type a custom height in metres using the input field below the presets. This is useful for features at unusual heights (e.g. an exhaust hood at 1.8 m, or a rooftop view at 5 m).",
      },
      {
        heading: "How the formula works",
        body: "The formula maps metres to a pitch angle:\n  pitch = groundPitch + (heightMetres ÷ 1.4) × (−groundPitch)\n\n• 0 m → groundPitch (floor of the panorama)\n• 1.4 m → 0° (horizontal / eye level)\n• 2.8 m → −groundPitch (same distance above eye level)\n\ngroundPitch is set via the Floor Level in Panorama calibration (see next article).",
      },
      {
        heading: "Important: height applies to 360° spaces only",
        body: "Height settings are only used in 360° panorama spaces. In Single photo, 4-Direction, and 8-Direction spaces, pin position is determined solely by where you tapped on the image.",
      },
    ],
  },

  {
    id: "pins-floor-calibration",
    categoryId: "pins-hotspots",
    title: "Floor Level Calibration (Panorama)",
    icon: "🎯",
    summary: "How to set the correct floor level so ground pins land on the actual floor.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Every panorama is different. The floor of your café might appear near the bottom of the image (camera mounted high) or closer to the middle (camera held at chest height). Biz360 lets you calibrate where the floor is so that pins set to 'Floor (0m)' actually land on the floor in your panorama.",
      },
      {
        heading: "How to calibrate",
        body: "1. Open the space in the Tour Builder.\n2. Scroll to FLOOR LEVEL IN PANORAMA (below the panorama photo).\n3. Choose the preset that best matches your panorama:\n   • −35° — floor appears close to the centre of the image (high camera / tilted up shot)\n   • −50° — typical shot from shoulder/tripod height (default)\n   • −65° — floor is in the lower third of the image\n   • −80° — floor is near the very bottom edge of the image\n4. Save the space.\n5. Open the live tour and look down — your floor-level pins should now be at the correct height.",
      },
      {
        heading: "Why this matters",
        body: "Without calibration, a pin set to Floor (0m) appears at −50° below the horizon by default. If your actual floor is at −65° (common for cameras at 1.6m height), the pin will appear to float above the floor tiles. Setting the correct floor level fixes this.",
      },
      {
        heading: "It also affects tap-placed pins",
        body: "Floor Level in Panorama affects ALL pins in the space — not just those with an explicit height. Any pin placed in the lower portion of the 2D image is stretched to match the calibrated floor. Pins near eye level (centre of the image) are unaffected.",
      },
      {
        heading: "Tips",
        body: "• Start with −65° if your camera was at shoulder or tripod height.\n• Start with −80° if your floor tiles appear at the very bottom of the flat image preview.\n• Recalibrate if you swap the panorama photo for a new one shot from a different height.",
      },
    ],
  },

  {
    id: "pins-icons",
    categoryId: "pins-hotspots",
    title: "Choosing Pin Icons",
    icon: "🔣",
    summary: "Customising pin icons from the 20-icon system library.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Each pin type has a default icon. You can override it with any icon from the system icon library (20 options) by tapping ICON in the pin editor.",
      },
      {
        heading: "System icons",
        body: "🎙 Audio · ℹ Info · 📷 Photos · 🎬 Video · 📈 Financials · 🔧 Equipment · 🔑 Lease · 👥 Staff · 📋 Menu · 🌿 Outdoor · 🚪 Entry · 🍳 Kitchen · 📦 Storage · 💳 POS · ☕ Roastery · 🏗️ Fit-Out · 🪑 Seating · ⚡ Utilities · 🚶 Foot Traffic · ⭐ Reviews",
      },
      {
        heading: "Icon vs. animation interaction",
        body: "• Navigation pins (ripple animation) show only the animated rings — no icon is displayed. To show an icon on a navigation pin, change its animation to something other than Ripple (e.g. Glow).\n• Audio pins (pulse animation) show the resolved icon in the centre of the pulsing ring. The default audio icon is 🎙 if you've set pinIconKey to 'audio', or 🎵 if no icon is set.",
      },
    ],
  },

  {
    id: "pins-animations",
    categoryId: "pins-hotspots",
    title: "Pin Animations",
    icon: "✨",
    summary: "What each animation looks like and when to use it.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Animations make pins more noticeable in a 360° viewer. You can set a default in Tour Settings and override per-pin in the pin editor.",
      },
      {
        heading: "None",
        body: "Static circle. Clean look for dense pin layouts where animated pins would distract. Best used when buyers already know to look for pins.",
      },
      {
        heading: "Pulse",
        body: "Three expanding concentric rings radiate outward from the pin. Default for audio pins. Draws attention to interactive audio content. Pink colour for audio pins, custom colour for others.",
      },
      {
        heading: "Ripple",
        body: "Similar to Pulse but styled for navigation. Three blue expanding rings. This is the default for navigation pins. Tells buyers 'tap me to go somewhere'.",
      },
      {
        heading: "Glow",
        body: "The pin gently brightens and dims in a slow breathing light effect. Subtle and professional. Good for document or financial pins.",
      },
      {
        heading: "Bounce",
        body: "The pin bobs up and down slightly. Playful and eye-catching. Good for highlighting standout features in a positive light (Opportunity, Highlight).",
      },
      {
        heading: "Breathing",
        body: "The pin scales up and down with a fade — like a gentle inhale/exhale. More subtle than Bounce. Works well for Risk pins where you want attention without alarm.",
      },
    ],
  },

  {
    id: "pins-size-opacity",
    categoryId: "pins-hotspots",
    title: "Pin Size & Opacity",
    icon: "🔲",
    summary: "Adjusting individual pin size and transparency.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Size",
        body: "Size is a scale multiplier. 1.0× is standard (36px diameter). You can scale from 0.5× (half size, subtle) to 2.0× (double size, very prominent). Larger pins are easier to tap on small screens. Smaller pins suit dense layouts where pins would otherwise overlap.",
      },
      {
        heading: "Opacity",
        body: "Opacity controls transparency. 1.0 = fully opaque. 0.3 = very faint. Reducing opacity to ~0.7 creates a more refined look while keeping pins discoverable. Very low opacity (< 0.4) is not recommended — buyers may miss the pin entirely.",
      },
      {
        heading: "Global vs. per-pin",
        body: "Global defaults are set in Tour Settings. Per-pin size and opacity in the pin editor override the global defaults for that pin only.",
      },
    ],
  },

  {
    id: "pins-popup-content",
    categoryId: "pins-hotspots",
    title: "Rich Popup Content",
    icon: "📋",
    summary: "Adding structured information panels that appear when buyers tap a pin.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "When a buyer taps a pin, a popup sheet appears. By default it shows the pin's title and description. You can add a Rich Popup with structured sections, images, and document links.",
      },
      {
        heading: "Enabling rich popup",
        body: "In the pin editor, scroll to RICH POPUP and toggle it on. A form appears for adding popup content.",
      },
      {
        heading: "Popup sections",
        body: "Sections are label-value pairs (e.g. Label: 'Weekly Revenue', Value: '$18,500 average'). Add as many sections as needed. These appear as a structured table in the popup.",
      },
      {
        heading: "Images",
        body: "Paste Cloudinary or publicly-hosted image URLs to show photos inside the popup. Useful for equipment specs, floor plans, or close-up product photos.",
      },
      {
        heading: "Document links",
        body: "Add links to PDFs or documents (e.g. Lease Agreement, Equipment List). Label them clearly. Buyers can tap to open the document.",
      },
      {
        heading: "NDA-locked pins",
        body: "Toggle 'Require NDA' on the pin to hide its popup content until the buyer has signed a non-disclosure agreement. The pin itself is still visible — buyers just see a lock icon when they tap it.",
      },
    ],
  },

  // ── Leads & Messages ─────────────────────────────────────────────────────

  {
    id: "leads-overview",
    categoryId: "leads-messages",
    title: "Managing Leads",
    icon: "🎯",
    summary: "Tracking and responding to buyer enquiries from the Leads tab.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Leads tab shows all buyers who have expressed interest in your listing — those who have called, messaged, or requested tour access.",
      },
      {
        heading: "Lead statuses",
        body: "• New — buyer has just made contact. Review promptly.\n• Seen — you have viewed the lead.\n• Replied — you have sent a message to the buyer.",
      },
      {
        heading: "Responding to leads",
        body: "Tap a lead to open the thread. Type a message and send. Response time matters — buyers who don't hear back within 24 hours often move on to other listings.",
      },
    ],
  },

  {
    id: "leads-messages",
    categoryId: "leads-messages",
    title: "Messages",
    icon: "💬",
    summary: "Direct messaging with buyers and privacy considerations.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Privacy",
        body: "Your full name, phone number, and email are never shared with buyers through the platform. All communication goes through Biz360's messaging system. Buyers see only your display name.",
      },
      {
        heading: "What to say first",
        body: "Acknowledge the enquiry, confirm you are the seller/broker, and ask a qualifying question (e.g. 'Are you looking for a business in the $500K–$800K range?'). Avoid sharing financials in the first message — direct buyers through the NDA process first.",
      },
    ],
  },

  // ── Troubleshooting ───────────────────────────────────────────────────────

  {
    id: "ts-floating-pins",
    categoryId: "troubleshooting",
    title: "Pins Floating Above the Floor",
    icon: "⚠️",
    summary: "Why floor-level pins appear to float and how to fix it.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "The problem",
        body: "You set a pin to Floor (0m) but in the live tour it appears to float at eye level or above the floor tiles.",
      },
      {
        heading: "Cause",
        body: "The Floor Level in Panorama calibration is set too shallow. Every panorama is photographed from a different height and angle, so 'floor level' maps to a different pitch angle in each image. The default −50° may not match your panorama.",
      },
      {
        heading: "Fix",
        body: "1. Open the space in the Tour Builder.\n2. Scroll down to FLOOR LEVEL IN PANORAMA.\n3. Select −65° (if your camera was at shoulder/tripod height) or −80° (if the floor tiles are at the very bottom of the image).\n4. Tap Save.\n5. Reopen the live tour and look down — the pin should now sit on the floor.\n\nIf it's still wrong, try −80°. If it's gone past the floor and is underground, go back to −65°.",
      },
      {
        heading: "Alternative fix",
        body: "If the pin was placed by tapping the 2D image (not using a height preset), it uses position.y for its vertical position, which is also affected by the Floor Level calibration. Try re-placing the pin lower on the 2D image (closer to the bottom edge).",
      },
    ],
  },

  {
    id: "ts-icon-not-changing",
    categoryId: "troubleshooting",
    title: "Pin Icon or Animation Not Changing",
    icon: "⚠️",
    summary: "Why some pins seem to ignore icon or animation settings.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Navigation pins and icons",
        body: "Navigation pins use the Ripple animation by default, which shows only animated rings (no icon). If you want to display an icon on a navigation pin, change its animation to something other than Ripple — e.g. set Animation to 'Glow'. The icon will then appear in the solid circle.",
      },
      {
        heading: "Audio pins and icons",
        body: "Audio pins use the Pulse animation by default. The icon you choose appears in the centre of the pulsing ring. If you set Animation to 'None', the pin becomes a standard circle with your chosen icon.",
      },
      {
        heading: "Animation not updating in the builder preview",
        body: "The builder shows pins as dots on a flat 2D image — it does NOT show animations or the live 3D view. You must open the live tour (or use the Preview option) to see animations in effect.",
      },
      {
        heading: "Settings not saving",
        body: "Make sure you tap Save in the pin editor and then Save Space in the space editor. Changes are only written to the server when Save Space is tapped.",
      },
    ],
  },

  {
    id: "ts-panorama-not-loading",
    categoryId: "troubleshooting",
    title: "Panorama Not Loading",
    icon: "⚠️",
    summary: "What to do if the 360° panorama shows a spinner or blank screen.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Common causes",
        body: "• The panorama image file is too large. Compress to under 15 MB.\n• The Cloudinary URL has expired or been deleted.\n• A slow internet connection caused a timeout.",
      },
      {
        heading: "Fix",
        body: "1. Check your internet connection.\n2. Re-upload the panorama: open the space → tap Change under the photo → select a new (compressed) file.\n3. Save the space.\n4. If using a remote URL, verify the URL is publicly accessible in a browser.",
      },
      {
        heading: "Image requirements",
        body: "• Format: JPEG or PNG.\n• Aspect ratio: 2:1 (e.g. 4096×2048, 6720×3360). Insta360 exports are already in this format.\n• Maximum file size: ~15 MB after compression.\n• Do not use fisheye or dual-fisheye (unstitched) images.",
      },
    ],
  },

  {
    id: "ts-audio-not-playing",
    categoryId: "troubleshooting",
    title: "Audio Narration Not Playing",
    icon: "⚠️",
    summary: "Troubleshooting issues with space or pin audio.",
    roles: ["seller"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Checklist",
        body: "• Is the audio URL a direct link to an MP3 or WAV file? It must end in .mp3 or .wav (not a web page).\n• Is the file hosted on Cloudinary or another public CDN? Private/signed URLs do not work.\n• Is the device volume turned up?\n• Has the buyer (or you in preview) granted microphone/media permissions to the app?",
      },
      {
        heading: "Trigger mode",
        body: "If the audio trigger is set to 'Hotspot', the narration only plays when the buyer taps the audio pin — it will not auto-play. Make sure there is a visible audio pin in the space.",
      },
    ],
  },

  // ── Broker Features ───────────────────────────────────────────────────────

  {
    id: "broker-dashboard",
    categoryId: "broker-features",
    title: "Broker Dashboard Overview",
    icon: "📊",
    summary: "Understanding the broker dashboard metrics and layout.",
    roles: ["broker"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Broker Dashboard is your central hub for managing listings, tracking leads, and monitoring performance across all your clients.",
      },
      {
        heading: "Key metrics",
        body: "• Active Listings — total live listings managed by your brokerage.\n• Leads This Month — total buyer enquiries across all listings.\n• Pipeline Value — sum of asking prices of your active listings.\n• Avg. Days on Market — how long listings have been active on average.",
      },
      {
        heading: "Quick actions",
        body: "Dashboard cards link directly to your most active listings. Tap any card to open that listing's detail view, manage pins, or respond to leads.",
      },
    ],
  },

  {
    id: "broker-listings",
    categoryId: "broker-features",
    title: "Managing Listings for Clients",
    icon: "🏢",
    summary: "Adding, editing, and publishing listings on behalf of sellers.",
    roles: ["broker"],
    updatedDate: "2026-05-29",
    sections: [
      {
        heading: "Creating a listing for a client",
        body: "Go to the Listings tab → tap + → complete the listing form. Where you see 'Seller ID' or 'Seller Name', enter the client's details. This links the listing to your brokerage and the individual seller.",
      },
      {
        heading: "Adding verification badges",
        body: "As a licensed broker you can add verified badges (Financials, Lease, Equipment, Broker) to listings you manage. These appear on the listing and in search results, significantly improving buyer confidence.",
      },
      {
        heading: "Tour builder access",
        body: "Brokers can build and manage tours for any listing in their portfolio. The Tour Builder works identically to the seller version. Consider building the tour on behalf of sellers who are unfamiliar with the technology.",
      },
    ],
  },

  {
    id: "broker-team",
    categoryId: "broker-features",
    title: "Team Management",
    icon: "👥",
    summary: "Adding team members and managing broker access.",
    roles: ["broker"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Team tab lets you manage who in your brokerage has access to Biz360. Add agents, assign them to listings, and control their permissions.",
      },
      {
        heading: "Adding a team member",
        body: "Team → tap + → enter the agent's name, phone number, and role (Agent or Manager). The agent receives an invite SMS with a verification code.",
      },
      {
        heading: "Permissions",
        body: "• Agent — can view and respond to leads, view listings and analytics. Cannot create or delete listings.\n• Manager — all agent permissions plus the ability to create and edit listings, manage tours, and add verification badges.",
      },
    ],
  },

  {
    id: "broker-analytics",
    categoryId: "broker-features",
    title: "Analytics & Reports",
    icon: "📈",
    summary: "Viewing performance data across your listing portfolio.",
    roles: ["broker"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Analytics tab shows aggregated performance data across all listings in your brokerage portfolio.",
      },
      {
        heading: "Available metrics",
        body: "• Views per listing (daily, weekly, monthly).\n• Lead conversion rate (views → enquiries).\n• Average response time (how quickly you reply to leads).\n• Tour engagement (how long buyers spend in the virtual tour).\n• Popular spaces (which rooms buyers spend most time in).",
      },
      {
        heading: "Export",
        body: "Tap the export button in the top right of the Analytics screen to download a CSV report for a selected date range.",
      },
    ],
  },

  {
    id: "broker-billing",
    categoryId: "broker-features",
    title: "Billing & Invoicing",
    icon: "💳",
    summary: "Managing your brokerage subscription and viewing invoices.",
    roles: ["broker"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Billing tab shows your current subscription plan, upcoming renewal date, and payment history.",
      },
      {
        heading: "Plans",
        body: "Biz360 offers tiered broker plans based on the number of active listings. Contact the Biz360 team to upgrade or change your plan.",
      },
      {
        heading: "Invoices",
        body: "Tap any invoice to view or download a PDF receipt. Invoices are generated automatically on each billing cycle.",
      },
    ],
  },

  // ── Platform Admin ────────────────────────────────────────────────────────

  {
    id: "admin-users",
    categoryId: "platform-admin",
    title: "User Management",
    icon: "👤",
    summary: "Viewing, searching, and managing seller, buyer, and broker accounts.",
    roles: ["admin"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Users screen lists all registered accounts. Search by name, phone, or role. Tap a user to view their profile, listing history, and account status.",
      },
      {
        heading: "Suspending an account",
        body: "Tap the user → tap Suspend. The user will be unable to log in. Their listings are hidden from buyer search but not deleted. Send the user a notification explaining the reason.",
      },
      {
        heading: "Role changes",
        body: "You can upgrade a user from buyer → seller or seller → broker from the user detail screen. Use this to onboard new brokers who have been vetted externally.",
      },
    ],
  },

  {
    id: "admin-listings",
    categoryId: "platform-admin",
    title: "Listing Moderation",
    icon: "📋",
    summary: "Reviewing, approving, and rejecting submitted listings.",
    roles: ["admin"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Admin Listings screen shows all listings sorted by status. The Pending queue is your primary moderation focus.",
      },
      {
        heading: "Approval checklist",
        body: "Before approving a listing:\n• Business name and description are accurate and not misleading.\n• Asking price is not absurdly inflated or missing.\n• Photos are genuine (reverse image search if in doubt).\n• Financial figures are plausible for the stated category and size.\n• No prohibited content (illegal businesses, gambling without licence, etc.).",
      },
      {
        heading: "Rejection",
        body: "Tap Reject → select a reason → the seller is notified. They can edit the listing and resubmit. Keep rejection reasons clear and actionable.",
      },
    ],
  },

  {
    id: "admin-categories",
    categoryId: "platform-admin",
    title: "Category Management",
    icon: "🏷️",
    summary: "Adding, editing, and reordering business listing categories.",
    roles: ["admin"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Categories are the industry types buyers use to filter listings (e.g. Café, Retail, Manufacturing). Manage them from the Categories tab.",
      },
      {
        heading: "Adding a category",
        body: "Categories → tap + → enter name, choose an emoji icon, and set a sort order (lower = appears first). Save.",
      },
      {
        heading: "Merging categories",
        body: "If duplicate categories exist (e.g. 'Café' and 'Coffee Shop'), contact the development team to run a migration script that re-assigns all listings from one to the other before deleting the duplicate.",
      },
    ],
  },

  {
    id: "admin-storage",
    categoryId: "platform-admin",
    title: "Storage Settings (Cloudinary)",
    icon: "☁️",
    summary: "Configuring asset retention and cleanup policies.",
    roles: ["admin"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "Biz360 uses Cloudinary to host all listing photos, panoramas, and audio files. The Storage Settings screen lets you configure automatic cleanup policies.",
      },
      {
        heading: "Sold listing retention",
        body: "After a listing is marked as Sold, its media assets are retained for a configurable period (default: 180 days) before being deleted. This allows buyers who signed NDAs to still access documents during due diligence.",
      },
      {
        heading: "Inactive user retention",
        body: "Assets belonging to accounts inactive for more than the configured period (default: 365 days) are flagged for cleanup. Review the whitelist before running the cleanup job.",
      },
      {
        heading: "Whitelist",
        body: "Add specific Cloudinary public IDs to the whitelist to exclude them from automated cleanup. Useful for demo assets and platform branding images.",
      },
    ],
  },

  {
    id: "admin-revenue",
    categoryId: "platform-admin",
    title: "Revenue Overview",
    icon: "💰",
    summary: "Viewing platform revenue from subscriptions and listing fees.",
    roles: ["admin"],
    updatedDate: "2026-05-29",
    sections: [
      {
        body: "The Revenue screen shows aggregate billing data across all broker and seller subscriptions.",
      },
      {
        heading: "Revenue breakdown",
        body: "• Subscription revenue — recurring monthly fees from broker plans.\n• Listing fees — one-time fees charged per listing (if enabled).\n• Total MRR (Monthly Recurring Revenue) — the most important metric for platform health.",
      },
      {
        heading: "Exporting",
        body: "Download a CSV of all transactions for a date range using the export button. This can be imported into accounting software (Xero, MYOB).",
      },
    ],
  },
];
