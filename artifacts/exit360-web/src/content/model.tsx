// ─── Rich, section-based editable page model ─────────────────────────────────
// A page = ordered sections. Each section has text fields and/or repeatable
// item-lists (cards, steps, FAQs…) that admins can edit AND add to. Defaults
// below are the current live copy, so nothing changes until edited.

export interface MField { key: string; label: string; type?: "text" | "textarea"; default: string }
export interface MList {
  key: string; label: string; itemNoun: string;
  fields: { key: string; label: string; type?: "text" | "textarea" }[];
  default: Record<string, string>[];
}
export interface MSection { key: string; label: string; fields?: MField[]; lists?: MList[] }
export interface MPage { label: string; sections: MSection[] }

const CARD = [
  { key: "title", label: "Title" },
  { key: "body", label: "Body", type: "textarea" as const },
];

export const PAGE_MODEL: Record<string, MPage> = {
  "/": {
    label: "Home",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow badge", default: "Now live in Australia" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Walk through before you sign." },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "The premium marketplace for verified businesses. Experience immersive 360° tours enriched with financial data, equipment specs, and lease details. Due diligence starts here." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Browse Listings" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "Watch Video" },
        ],
      },
      {
        key: "stats", label: "Stats bar",
        fields: [
          { key: "stats.l1", label: "Stat 1 label (value is live count)", default: "Verified Listings" },
          { key: "stats.v2", label: "Stat 2 value", default: "$4.2B+" }, { key: "stats.l2", label: "Stat 2 label", default: "Listed Value" },
          { key: "stats.v3", label: "Stat 3 value", default: "12,000+" }, { key: "stats.l3", label: "Stat 3 label", default: "Qualified Buyers" },
          { key: "stats.v4", label: "Stat 4 value", default: "89" }, { key: "stats.l4", label: "Stat 4 label", default: "Avg Tours per Listing" },
        ],
      },
      { key: "featured", label: "Featured listing", fields: [{ key: "featured.eyebrow", label: "Eyebrow badge", default: "Featured Listing" }] },
      {
        key: "buyers", label: "For buyers",
        fields: [{ key: "buyers.heading", label: "Heading", default: "For Serious Buyers" }],
        lists: [{ key: "buyers.items", label: "Points", itemNoun: "point", fields: CARD, default: [
          { title: "Eliminate Wasted Trips", body: "Tour the premises and inspect the equipment before committing to an in-person site visit." },
          { title: "Verified Financials", body: "Listings require ABN and identity verification. Key financial metrics are tied directly to the physical space." },
        ] }],
      },
      {
        key: "sellers", label: "For sellers",
        fields: [{ key: "sellers.heading", label: "Heading", default: "For Premium Sellers" }],
        lists: [{ key: "sellers.items", label: "Points", itemNoun: "point", fields: CARD, default: [
          { title: "Filter Tire-Kickers", body: "Let buyers experience the business digitally. Only engage with highly qualified leads who already understand your operation." },
          { title: "Defend Your Valuation", body: "Justify your asking price by showcasing your premium fit-out, high-value equipment, and operational efficiency in 360°." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Ready to acquire your next asset?" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Join 12,000+ buyers already using EXIT360 to find premium businesses." },
          { key: "cta.primary", label: "Primary button", default: "Create Buyer Profile" },
          { key: "cta.secondary", label: "Secondary button", default: "List a Business" },
        ],
      },
    ],
  },
  "/buying": {
    label: "Buying",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "For buyers hunting the right business" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Buy a business you've ==already walked through.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "Stop booking flights and Saturdays around blurry photos. EXIT360 lets you **explore businesses for sale in immersive 360°**, review real financials under NDA, and send a verified enquiry in one tap — so you shortlist faster, travel only for the deals worth chasing, and buy with genuine confidence." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Browse listings" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "See how it works" },
          { key: "hero.cardTitle", label: "Image card title", default: "Touring: Fitzroy café + roastery" },
          { key: "hero.cardSub", label: "Image card subtitle", default: "Walk the floor before you enquire" },
        ],
        lists: [{ key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "Free to browse" }, { text: "Verified sellers" }, { text: "App & web" }] }],
      },
      {
        key: "why", label: "Why buyers start here",
        fields: [
          { key: "why.heading", label: "Heading", type: "textarea", default: "Why buyers start their search on EXIT360" },
          { key: "why.body", label: "Intro paragraph", type: "textarea", default: "Buying a business is one of the biggest decisions you'll make — yet most marketplaces still ask you to judge it from a handful of photos and a vague teaser. EXIT360 gives you the context, the numbers and the direct line you actually need to move with confidence." },
        ],
        lists: [{ key: "why.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "Walk through in 360° first", body: "Explore the shopfront, kitchen, workshop or plant room from your couch. You'll know whether a business is worth a trip before you ever book one — and arrive at inspection already knowing the space." },
          { title: "Verified listings & sellers", body: "Every seller is phone-verified and every listing is reviewed, so you spend your time on genuine opportunities instead of chasing dead ends and anonymous ghost ads." },
          { title: "Financials under NDA", body: "Request access, sign the seller's NDA in-app, and unlock the P&L, add-backs and equipment register. Do real due diligence on real numbers — not a rounded 'from' figure." },
          { title: "One-tap verified enquiries", body: "Send an enquiry, request more information or book an inspection in a single tap. Sellers see you're a verified buyer, so your message goes to the top of the pile." },
          { title: "Your buyer portal", body: "Save listings, track NDAs, follow your enquiries and revisit every tour from one dashboard. Never lose the thread on a business you're seriously considering." },
          { title: "Seamless app & web", body: "Start a search on your laptop at work, keep exploring tours on your phone on the train. Your account is keyed to your number, so everything stays perfectly in sync." },
        ] }],
      },
      {
        key: "steps", label: "How buying works",
        fields: [
          { key: "steps.heading", label: "Heading", type: "textarea", default: "How buying works, in four steps" },
          { key: "steps.body", label: "Intro paragraph", type: "textarea", default: "From first browse to booked inspection — a clearer, faster path to the right business." },
        ],
        lists: [{ key: "steps.items", label: "Steps", itemNoun: "step", fields: [{ key: "n", label: "Number" }, { key: "title", label: "Title" }, { key: "body", label: "Body", type: "textarea" }], default: [
          { n: "01", title: "Browse & shortlist", body: "Filter businesses for sale by industry, location, price and cash flow. Save the ones that fit to your buyer portal to compare side by side." },
          { n: "02", title: "Take the 360° walkthrough", body: "Move through the premises room to room like Google Street View. Get a real feel for size, layout, fit-out and foot traffic before you commit any time." },
          { n: "03", title: "Request info & sign the NDA", body: "Ask the seller for the detail that matters, sign their NDA in-app, and unlock verified financials and the full information memorandum." },
          { n: "04", title: "Enquire & inspect", body: "Send a one-tap verified enquiry, message the seller directly, and book your on-site inspection knowing the numbers already stack up." },
        ] }],
      },
      {
        key: "trust", label: "Buy with confidence",
        fields: [
          { key: "trust.eyebrow", label: "Eyebrow", default: "Buy with confidence" },
          { key: "trust.heading", label: "Heading", type: "textarea", default: "Serious buyers deserve real information" },
          { key: "trust.body", label: "Paragraph", type: "textarea", default: "A business is only worth what its numbers and its premises can prove. EXIT360 is built so you can verify both — privately, respectfully and on your terms. You stay in control of your details until you decide a business is worth pursuing." },
        ],
        lists: [
          { key: "trust.checklist", label: "Reassurance points", itemNoun: "point", fields: [{ key: "text", label: "Text" }], default: [
            { text: "Financials stay confidential until you request access and sign the NDA" },
            { text: "Your contact details are only shared with sellers you choose to enquire with" },
            { text: "Every enquiry is logged in your buyer portal so nothing slips through the cracks" },
            { text: "Message sellers securely in-app before revealing your phone number" },
          ] },
          { key: "trust.cards", label: "Stat cards", itemNoun: "card", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
            { value: "Tour before you travel", label: "See it in 360° from anywhere" },
            { value: "100% verified sellers", label: "Every listing phone-checked" },
            { value: "Direct to the owner", label: "No broker gatekeeping" },
            { value: "Shortlist in minutes", label: "Not weeks of phone tag" },
          ] },
        ],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "Buyer questions, answered" }],
        lists: [{ key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
          { q: "Does it cost anything to browse and enquire?", a: "No. Browsing listings, exploring 360° walkthroughs and sending verified enquiries is free for buyers. You only ever deal directly with sellers — there's no buyer's fee to use EXIT360." },
          { q: "How do I see a business's financials?", a: "Open the listing, request financial access and sign the seller's NDA in-app. Once you're verified and the NDA is signed, the P&L, add-backs, equipment register and full information memorandum unlock for you." },
          { q: "What exactly is the 360° walkthrough?", a: "It's an immersive, navigable tour of the premises built from panoramic scenes. You move from room to room like Google Street View, so you can judge the space, layout and fit-out properly before spending a day travelling to inspect." },
          { q: "Are the listings and sellers verified?", a: "Yes. Every seller is phone-verified and each listing is reviewed before it goes live, so you're dealing with genuine businesses and real owners — not anonymous or duplicate ads." },
          { q: "Can I keep track of everything I'm interested in?", a: "Your buyer portal saves shortlisted listings, tracks the NDAs you've signed and follows every enquiry you've sent. Start on the web, continue on the app — your account and history stay in sync across both." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Find the business that's right for you" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Browse verified listings, walk through in 360° and enquire in one tap. It's free to start your search on EXIT360." },
          { key: "cta.primary", label: "Primary button", default: "Browse listings" },
          { key: "cta.secondary", label: "Secondary button", default: "Open your buyer portal" },
        ],
      },
    ],
  },
  "/selling": {
    label: "Selling",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "For business owners ready to exit" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Sell your business the way ==buyers actually want to buy it.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "Static photos and a one-page teaser don't sell a business. EXIT360 lets serious, verified buyers **walk through your premises in immersive 360°**, read your real financials under NDA, and enquire in one tap — so you sell faster, for a stronger price, with far less tyre-kicking." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "List your business" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "See how it works" },
          { key: "hero.cardTitle", label: "Image card title", default: "360° walkthrough live" },
          { key: "hero.cardSub", label: "Image card subtitle", default: "Buyers explored 43 times this week" },
        ],
        lists: [{ key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "No lock-in contracts" }, { text: "You control who sees financials" }, { text: "App & web" }] }],
      },
      {
        key: "why", label: "Why sellers get better outcomes",
        fields: [
          { key: "why.heading", label: "Heading", type: "textarea", default: "Why EXIT360 sellers get better outcomes" },
          { key: "why.body", label: "Intro paragraph", type: "textarea", default: "The businesses that sell fastest are the ones buyers can understand and trust before they ever pick up the phone. EXIT360 is built to remove doubt at every step — the two things that kill deals. Here's how we do it." },
        ],
        lists: [{ key: "why.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "Immersive 360° tours", body: "Buyers walk your floor, kitchen, plant room and storefront from anywhere. They arrive at inspection already sold on the space — not deciding whether it's worth the drive." },
          { title: "Verified financials, gated by NDA", body: "Upload your P&L, add-backs and equipment register. Buyers must sign an NDA before a single figure is revealed, and you see exactly who signed and when." },
          { title: "Live buyer analytics", body: "See views, tour engagement, NDAs signed and enquiry types in real time. Know which buyers are hot before you spend a minute on the phone." },
          { title: "Only verified buyers", body: "Every enquiry comes from a phone-verified buyer. No anonymous time-wasters — just real people who've raised their hand for your business." },
          { title: "Automatic information memorandum", body: "Your listing becomes a polished, data-room-grade IM report — financials, divisions, equipment and tour in one professional document buyers can trust." },
          { title: "You stay in control", body: "Stay anonymous, message-only, or reveal your number after a buyer verifies theirs. Turn financial access on and off per buyer. It's your sale, your rules." },
        ] }],
      },
      {
        key: "steps", label: "Four steps",
        fields: [
          { key: "steps.heading", label: "Heading", type: "textarea", default: "From listing to sold in four steps" },
          { key: "steps.body", label: "Intro paragraph", type: "textarea", default: "Most sellers are live within an afternoon. Build it on the app or on the web — your listing syncs across both." },
        ],
        lists: [{ key: "steps.items", label: "Steps", itemNoun: "step", fields: [{ key: "n", label: "Number" }, { key: "title", label: "Title" }, { key: "body", label: "Body", type: "textarea" }], default: [
          { n: "01", title: "Create your listing", body: "Add your business details, asking price and divisions on the app or website. Everything is saved to your phone-verified account and stays in sync." },
          { n: "02", title: "Capture the 360° tour", body: "Add panoramic scenes and link them into a guided walkthrough. Buyers move through your business like Street View." },
          { n: "03", title: "Add financials & set NDA", body: "Upload your numbers and equipment register, then require an NDA so only serious, committed buyers can see them." },
          { n: "04", title: "Field verified enquiries", body: "Requests for info, calls and site visits land in one inbox. Track engagement and reveal your number only when you're ready." },
        ] }],
      },
      {
        key: "stats", label: "Stats band",
        lists: [{ key: "stats.items", label: "Stats", itemNoun: "stat", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
          { value: "Live in an afternoon", label: "Typical time to publish" },
          { value: "Higher engagement", label: "Tours vs. photos-only listings" },
          { value: "100% verified", label: "Every buyer, phone-checked" },
          { value: "NDA-gated", label: "Financials protected by default" },
        ] }],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "Selling questions, answered" }],
        lists: [{ key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
          { q: "How much does it cost to list?", a: "You can build your listing and 360° tour with no lock-in contract. Talk to us about a plan that suits a private sale or a broker managing multiple listings." },
          { q: "Do I have to show my financials to everyone?", a: "No. Financials sit behind an NDA gate and per-buyer access controls. A buyer must verify their phone and sign your NDA before any numbers are revealed — and you can see exactly who has." },
          { q: "Can I stay anonymous?", a: "Yes. You can run a fully confidential sale where buyers only reach you through secure in-platform messages, and reveal your phone number only once a buyer has verified theirs." },
          { q: "Can I build my listing on my computer and my phone?", a: "Absolutely. Your account is keyed to your phone number, so you can start on the app, keep going on the website, and edit either — everything stays in sync." },
          { q: "What is the 360° walkthrough?", a: "It's an immersive, navigable tour of your premises built from panoramic scenes. Buyers explore room to room like Google Street View, which dramatically reduces wasted inspections." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Ready to sell your business?" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Create your 360° listing today. No lock-in, full control, and buyers who've already proven they're serious." },
          { key: "cta.primary", label: "Primary button", default: "List your business" },
          { key: "cta.secondary", label: "Secondary button", default: "Talk to our team" },
        ],
      },
    ],
  },
  "/walkthroughs": {
    label: "Walkthroughs",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "The 360° walkthrough system" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Walk through a business ==before you ever step inside.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "EXIT360 turns a listing into an immersive, navigable tour. Buyers **move from room to room like Google Street View** — the storefront, the kitchen, the plant room, the office — exploring every corner in 360°, day or night, from anywhere in Australia." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Explore live tours" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "Build a tour to sell" },
          { key: "hero.cardTitle", label: "Image card title", default: "Guided walkthrough active" },
          { key: "hero.cardSub", label: "Image card subtitle", default: "Tap a doorway to move to the next room" },
        ],
        lists: [
          { key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "Explore 24/7" }, { text: "App & web" }, { text: "No download" }] },
        ],
      },
      {
        key: "whatis", label: "Not photos. An actual walkthrough.",
        fields: [
          { key: "whatis.heading", label: "Heading", type: "textarea", default: "Not photos. An actual walkthrough." },
          { key: "whatis.body", label: "Intro paragraph", type: "textarea", default: "A gallery of flat photos tells a buyer almost nothing about how a business really feels — its size, its flow, the condition of the fit-out, how the space works. The EXIT360 walkthrough is different. Each location is captured as a full **panoramic 360° scene** you can look around in every direction. Those scenes are then linked together into a single guided tour, so a buyer can step through a doorway, turn a corner and keep moving — exactly the way they would on a real inspection, but from their couch. It runs right in the browser and in the EXIT360 app, with nothing to install and no special headset required." },
        ],
        lists: [
          { key: "whatis.cards", label: "Feature cards", itemNoun: "card", fields: CARD, default: [
            { title: "Panoramic scenes", body: "Every room is a full 360° panorama. Look up at the ceiling height, down at the flooring, and all the way around — the same view you'd get standing in the middle of the space." },
            { title: "Linked navigation", body: "Scenes are joined into a guided path. Buyers click a doorway or a marker on the floor to glide into the next room, building a true mental map of the premises." },
            { title: "Interactive hotspots", body: "Tap a hotspot to read about a piece of equipment, a division of the business, or a recent upgrade — context delivered exactly where it matters, in the space itself." },
          ] },
        ],
      },
      {
        key: "benefits", label: "Why a walkthrough sells faster",
        fields: [
          { key: "benefits.heading", label: "Heading", type: "textarea", default: "Why a walkthrough sells businesses faster" },
          { key: "benefits.body", label: "Intro paragraph", type: "textarea", default: "The tours do real work for both sides of the deal. Buyers qualify themselves before they ever make contact, and sellers stop losing weekends to inspections that were never going to end in an offer." },
        ],
        lists: [
          { key: "benefits.cards", label: "Benefit cards", itemNoun: "card", fields: CARD, default: [
            { title: "Buyers qualify themselves", body: "By the time someone enquires, they've already walked the whole premises and decided it fits. Every conversation you have starts with a genuinely interested buyer." },
            { title: "Buy with confidence", body: "Seeing the real condition and layout — not a flattering wide-angle photo — removes doubt. Buyers move forward knowing what they're actually purchasing." },
            { title: "Fewer wasted inspections", body: "A tour filters out the tyre-kickers before they book a visit. Sellers reclaim their time and only meet buyers who've already fallen for the space." },
            { title: "Explore 24/7 from anywhere", body: "Interstate and overseas buyers can inspect at midnight in their own time zone. Your market is no longer limited to who can drive across town on a Tuesday." },
            { title: "Listings that stand out", body: "An immersive tour reads as a serious, well-run business. It signals transparency and lifts engagement far above a listing with photos alone." },
            { title: "One tour, everywhere", body: "The same walkthrough powers your public listing and your information memorandum, so buyers get a consistent, professional experience end to end." },
          ] },
        ],
      },
      {
        key: "howto", label: "How sellers build a walkthrough",
        fields: [
          { key: "howto.heading", label: "Heading", type: "textarea", default: "How sellers build a walkthrough" },
          { key: "howto.body", label: "Intro paragraph", type: "textarea", default: "Capturing a full tour takes an afternoon, not a production crew. Three simple steps, all on the app or the web." },
        ],
        lists: [
          { key: "howto.steps", label: "Steps", itemNoun: "step", fields: [{ key: "n", label: "Number" }, { key: "title", label: "Title" }, { key: "body", label: "Body", type: "textarea" }], default: [
            { n: "01", title: "Capture your panoramas", body: "Stand in the centre of each room and capture a 360° panorama using a compatible camera or your phone. Grab every space a buyer would want to see — front of house, back of house and everything between." },
            { n: "02", title: "Link the scenes together", body: "Drop navigation markers so each scene connects to the next, building a guided path through the premises. Add hotspots to call out equipment, upgrades and key selling points where they sit." },
            { n: "03", title: "Publish and share", body: "Publish the walkthrough to your listing with one tap. It goes live on the web and the app instantly, and embeds straight into your information memorandum for verified buyers." },
          ] },
        ],
      },
      {
        key: "different", label: "What makes the EXIT360 tour different",
        fields: [
          { key: "different.heading", label: "Heading", type: "textarea", default: "What makes the EXIT360 tour different" },
          { key: "different.body", label: "Intro paragraph", type: "textarea", default: "Plenty of listings bolt on a single spinning photo and call it a virtual tour. Ours is a proper navigable system, built specifically for selling a business rather than a house." },
        ],
        lists: [
          { key: "different.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
            { title: "Genuinely guided navigation", body: "Buyers don't just spin on the spot. They travel a deliberate route through the business, room to room, so they understand how the operation actually flows and fits together." },
            { title: "Contextual hotspots", body: "Interactive markers layer the business story into the space — highlighting plant and equipment, recent fit-outs, seating capacity or storage — so the tour informs as well as impresses." },
            { title: "Works on app and web", body: "The exact same immersive experience runs in the EXIT360 mobile app and any modern browser. No headset, no plugin, no download — buyers just tap and explore." },
            { title: "Embedded in reports and listings", body: "The walkthrough lives inside both your public listing and your data-room-grade information memorandum, giving serious buyers one seamless, trustworthy view of the business." },
          ] },
        ],
      },
      {
        key: "stats", label: "Stats band",
        lists: [
          { key: "stats.items", label: "Stats", itemNoun: "stat", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
            { value: "24/7", label: "Explore from anywhere" },
            { value: "Live in an afternoon", label: "Typical time to publish a tour" },
            { value: "App & web", label: "No headset, no download" },
            { value: "In every report", label: "Embedded in the IM & listing" },
          ] },
        ],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "360° walkthrough questions, answered" }],
        lists: [
          { key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
            { q: "What exactly is a 360° virtual walkthrough?", a: "It's an immersive, navigable tour of a business built from panoramic 360° scenes that are linked together. Buyers explore room to room like Google Street View, looking in every direction and moving through the premises at their own pace." },
            { q: "Do I need a special camera or headset to view a tour?", a: "No. Tours run in any modern web browser and in the EXIT360 app with nothing to install. There's no VR headset required — you simply drag, tap and swipe to look around and move between rooms." },
            { q: "How does a walkthrough help me sell faster?", a: "Buyers qualify themselves before they enquire, so you waste far fewer weekends on inspections that were never going to convert. The ones who do reach out have already walked the space and are ready to move with confidence." },
            { q: "What do I need to capture my own tour?", a: "A compatible 360° camera or a phone will capture the panoramas. Stand in the middle of each space, capture a scene, then link the scenes and add hotspots in the app or on the web. Most sellers have a full tour live within an afternoon." },
            { q: "Where does the walkthrough appear once it's published?", a: "It goes live instantly on your public listing across the app and website, and it embeds directly into your information memorandum, so verified buyers get the immersive tour alongside your financials and equipment register." },
          ] },
        ],
      },
      {
        key: "camera", label: "Recommended camera",
        fields: [
          { key: "camera.eyebrow", label: "Eyebrow", default: "Recommended camera" },
          { key: "camera.heading", label: "Heading", type: "textarea", default: "Shot on the ==Insta360==." },
          { key: "camera.body", label: "Paragraph", type: "textarea", default: "We build EXIT360 walkthroughs around the Insta360 — and for good reason. It captures a full, razor-sharp 360° sphere of a room in a single tap, so a whole business can be shot in well under an hour. It's pocket-sized, quick to move between scenes, and its high resolution means buyers can look closely at fit-out, equipment and finishes without the image falling apart. One walkthrough, stitched and scene-linked, and your business is explorable like Street View." },
          { key: "camera.partnerHeading", label: "Partner card heading", default: "Find a local partner" },
          { key: "camera.partnerBody", label: "Partner card body", type: "textarea", default: "Outside Canberra? Find an approved EXIT360 walkthrough partner near you — or become one." },
        ],
        lists: [
          { key: "camera.checklist", label: "Checklist", itemNoun: "point", fields: [{ key: "text", label: "Text" }], default: [
            { text: "One-tap full 360° capture — a room in seconds" },
            { text: "High resolution buyers can zoom into" },
            { text: "Compact and fast to move scene to scene" },
            { text: "Feeds straight into our scene-linking + AI narration workflow" },
          ] },
          { key: "camera.offers", label: "Offer cards", itemNoun: "offer", fields: [{ key: "title", label: "Title" }, { key: "meta", label: "Sub-label" }, { key: "body", label: "Body", type: "textarea" }], default: [
            { title: "Rent a camera — $330", meta: "Prefer to shoot it yourself", body: "Don't want to buy one? Rent an Insta360 from us for **$330** and capture your own walkthrough with our step-by-step guide." },
            { title: "We shoot it for you — $990", meta: "Canberra only (for now)", body: "Want it done professionally? Our team captures a full 360° walkthrough of your business for **$990** — currently available in **Canberra**, with more regions coming as our partner network grows." },
          ] },
        ],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Bring your business to life in 360°" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Build an immersive walkthrough that lets serious buyers explore every corner — and sell faster with fewer wasted inspections." },
          { key: "cta.primary", label: "Primary button", default: "List your business" },
          { key: "cta.secondary", label: "Secondary button", default: "See how it works" },
        ],
      },
    ],
  },
};

/** Read a rich page's content: t(key)=text override|default, list(key)=array override|default. */
export function usePageContent(path: string) {
  const ov: any = (() => { try { return (window as any).__EXIT360_CONTENT__?.[path] ?? {}; } catch { return {}; } })();
  const model = PAGE_MODEL[path];
  const textDef: Record<string, string> = {};
  const listDef: Record<string, Record<string, string>[]> = {};
  if (model) for (const s of model.sections) {
    for (const f of s.fields ?? []) textDef[f.key] = f.default;
    for (const l of s.lists ?? []) listDef[l.key] = l.default;
  }
  return {
    t: (key: string) => (ov.text?.[key] ?? textDef[key] ?? ""),
    list: (key: string): Record<string, string>[] => (Array.isArray(ov.lists?.[key]) ? ov.lists[key] : (listDef[key] ?? [])),
  };
}
