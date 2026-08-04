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
  "/brokers": {
    label: "Brokers",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "For business brokers & advisory firms" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Run your whole book of listings from ==one broker login.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "EXIT360 gives brokers a single account to build, manage and market every client's business for sale — each with its own **immersive 360° tour, NDA-gated IM report and live buyer analytics**. Then send each client a private link so they can watch their own listing's performance without ever having to ask you for an update." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Start as a broker" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "See how it works" },
          { key: "hero.cardTitle", label: "Image card title", default: "12 active listings" },
          { key: "hero.cardSub", label: "Image card subtitle", default: "Managed under one broker account" },
        ],
        lists: [{ key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "Unlimited listings, one dashboard" }, { text: "Build on app & web" }, { text: "White-glove reporting" }] }],
      },
      {
        key: "why", label: "Why brokers win",
        fields: [
          { key: "why.heading", label: "Heading", type: "textarea", default: "Why brokers win with EXIT360" },
          { key: "why.body", label: "Intro paragraph", type: "textarea", default: "You're not selling one business — you're running a portfolio. EXIT360 is built for the way brokers actually work: many listings, many clients, and the constant demand for updates. Everything sits in one place, presents like a premium advisory firm, and keeps your clients informed automatically." },
        ],
        lists: [{ key: "why.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "Every listing, one login", body: "Manage your entire book from a single broker account. Add a new client business, switch between listings and update details without juggling logins, spreadsheets or duplicate profiles." },
          { title: "Build on app or web, always synced", body: "Capture a listing on-site with the mobile app, then finish the write-up on your desktop. Every listing is keyed to a phone number, so your work stays in sync across every device." },
          { title: "A 360° tour for each business", body: "Give every client a standout listing. Capture panoramic scenes on location and link them into a guided walkthrough buyers can explore like Street View — before they ever request an inspection." },
          { title: "Data-room-grade IM reports", body: "Each listing generates a polished, NDA-gated information memorandum — financials, add-backs, divisions and equipment — that presents your client's business with the professionalism it deserves." },
          { title: "You manage buyer access", body: "Gate financials behind NDAs and turn access on or off per buyer. Only phone-verified, genuinely interested buyers reach your clients — no anonymous tyre-kickers wasting your time." },
          { title: "White-glove positioning", body: "Present as the premium advisor you are. Immersive tours, professional reports and live analytics make every mandate look like a well-run process, helping you win and retain listings." },
        ] }],
      },
      {
        key: "showcase", label: "Shareable client analytics",
        fields: [
          { key: "showcase.eyebrow", label: "Eyebrow", default: "The broker's secret weapon" },
          { key: "showcase.heading", label: "Heading", type: "textarea", default: "A shareable analytics page ==your client can check themselves.==" },
          { key: "showcase.body", label: "Paragraph 1", type: "textarea", default: "Every broker knows the routine: the client rings to ask how their sale is tracking, and you stop what you're doing to pull numbers together. EXIT360 ends that. Send your client a private link, they log in, and they see their own listing's performance in real time — no chasing, no status emails, no interruptions to the rest of your book." },
          { key: "showcase.body2", label: "Paragraph 2", type: "textarea", default: "Your client sees exactly what matters and nothing they shouldn't: live view counts, NDAs signed and buyer requests broken down by type — requests for information, calls and site visits. They get the transparency they crave, you get your time back, and every listing feels like a first-class, professionally managed campaign." },
          { key: "showcase.ctaLabel", label: "Button label", default: "Give clients their own view" },
          { key: "showcase.cardTitle", label: "Demo card title", default: "Client analytics — Cafe & Roastery" },
          { key: "showcase.cardSub", label: "Demo card subtitle", default: "Shared by your broker · live now" },
        ],
        lists: [
          { key: "showcase.bigstats", label: "Headline stats", itemNoun: "stat", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
            { value: "1,284", label: "Listing views" }, { value: "37", label: "NDAs signed" },
          ] },
          { key: "showcase.requests", label: "Request rows", itemNoun: "row", fields: [{ key: "label", label: "Label" }, { key: "value", label: "Value" }], default: [
            { label: "Requests for information", value: "24" }, { label: "Call requests", value: "11" }, { label: "Site-visit requests", value: "8" },
          ] },
        ],
      },
      {
        key: "steps", label: "How brokers work",
        fields: [
          { key: "steps.heading", label: "Heading", type: "textarea", default: "How brokers work on EXIT360" },
          { key: "steps.body", label: "Intro paragraph", type: "textarea", default: "From onboarding a new mandate to keeping your client in the loop — a four-step process built for a busy book." },
        ],
        lists: [{ key: "steps.items", label: "Steps", itemNoun: "step", fields: [{ key: "n", label: "Number" }, { key: "title", label: "Title" }, { key: "body", label: "Body", type: "textarea" }], default: [
          { n: "01", title: "Open your broker account", body: "Sign up once and get a dashboard built to hold many listings. Every business you take on lives under the same login, keyed to your verified number." },
          { n: "02", title: "Build each client listing", body: "Capture the 360° tour and details on-site with the app, or write it up on the web. Add financials, divisions and the equipment register — it all syncs automatically." },
          { n: "03", title: "Publish with NDA gating", body: "Set the NDA and per-buyer access, then go live. Verified buyers explore the tour, sign to unlock financials, and lodge requests for info, calls or site visits." },
          { n: "04", title: "Share the client link", body: "Send each client their private analytics page. They log in and track views, NDAs and requests themselves — while you focus on progressing the deals." },
        ] }],
      },
      {
        key: "stats", label: "Stats band",
        lists: [{ key: "stats.items", label: "Stats", itemNoun: "stat", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
          { value: "Unlimited", label: "Listings per broker account" },
          { value: "Live reporting", label: "Shared straight to clients" },
          { value: "100% verified", label: "Every buyer, phone-checked" },
          { value: "NDA-gated", label: "Financials protected by default" },
        ] }],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "Broker questions, answered" }],
        lists: [{ key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
          { q: "Can I manage multiple client listings under one account?", a: "Yes — that's exactly what a broker account is built for. Every business you take on lives under a single login, so you can add, switch between and update as many listings as you're managing without ever creating separate profiles." },
          { q: "How does the shareable client analytics page work?", a: "Each listing has its own analytics view you can share with the client. You send them a private link, they log in, and they see their own listing's performance — views, NDAs signed and requests by type — in real time. They stay informed without having to ring you for an update." },
          { q: "What exactly can my client see?", a: "Only their own listing's numbers: live view counts, how many buyers have signed an NDA, and buyer requests broken down into information requests, call requests and site-visit requests. They never see other clients' data, and sensitive buyer details stay with you." },
          { q: "Can I build a listing on the app and finish it on my computer?", a: "Absolutely. Capture the 360° tour and details on-site with the mobile app, then finish the write-up on the web. Because everything is keyed to your phone number, your listings stay in sync across every device." },
          { q: "Do I control which buyers see financials?", a: "Yes. Financials sit behind an NDA gate by default, and you can turn per-buyer access on or off. Only phone-verified buyers can enquire, and you decide who progresses to your client's numbers." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Bring your whole book to EXIT360" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "One login for every listing, a 360° tour and IM report for each client, and a shareable analytics page that keeps them informed for you. Start managing your listings the modern way." },
          { key: "cta.primary", label: "Primary button", default: "Start as a broker" },
          { key: "cta.secondary", label: "Secondary button", default: "For sellers" },
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
  "/list-your-business": {
    label: "List your business",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "List your business ==where buyers can walk through it.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "Publish a listing that does the selling for you: an immersive 360° walkthrough, a professional information memorandum, NDA-gated financials and live buyer analytics — all keyed to your phone number so you can build on the app or the web and edit either." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Create your seller account" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "See how it works" },
        ],
        lists: [{ key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "Verify with your phone — no passwords" }, { text: "Free to build" }, { text: "App & web, always in sync" }] }],
      },
      {
        key: "features", label: "Feature cards",
        lists: [{ key: "features.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "Build a 360° walkthrough", body: "Add panoramic scenes and link them into a guided, Street-View-style tour buyers can explore from anywhere, day or night." },
          { title: "Generate a pro IM report", body: "Your financials, business divisions and equipment register become a polished, data-room-grade information memorandum buyers trust." },
          { title: "Protect your numbers", body: "Financials sit behind an NDA gate. Buyers verify their phone and sign before a single figure is revealed — and you see who signed." },
          { title: "Watch it work in real time", body: "Track views, tour engagement, NDAs signed and enquiry types live, so you always know which buyers are worth your time." },
        ] }],
      },
      {
        key: "sync", label: "Build anywhere",
        fields: [
          { key: "sync.heading", label: "Heading", default: "Build anywhere. Edit everywhere." },
          { key: "sync.body", label: "Paragraph", type: "textarea", default: "Your account lives on your phone number, so your listing, tour, report and messages are the same whether you're on the couch with the app or at your desk on the website. Start on one, finish on the other — nothing to re-enter." },
        ],
        lists: [{ key: "sync.steps", label: "Numbered steps", itemNoun: "step", fields: [{ key: "text", label: "Text" }], default: [
          { text: "Verify your mobile number" }, { text: "Add your business, price & divisions" }, { text: "Capture the 360° tour & upload financials" }, { text: "Publish and start receiving verified enquiries" },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Your business deserves better than a photo and a phone number." },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Create your seller account and publish a listing buyers can actually walk through." },
          { key: "cta.primary", label: "Primary button", default: "Create your seller account" },
          { key: "cta.secondary", label: "Secondary button", default: "I'm a broker" },
        ],
      },
    ],
  },
  "/photographers": {
    label: "Photographers",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "Partner program" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Get paid to capture businesses in ==immersive 360°.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "EXIT360 needs skilled local photographers to build stunning 360° walkthroughs for businesses going to market. Own an Insta360, pass our short training, and get referred paid shoots in your area — with the tools, templates and support to make every listing look world-class." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Apply to join" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "Find a partner near me" },
        ],
      },
      {
        key: "qualify", label: "How to become a partner",
        fields: [
          { key: "qualify.heading", label: "Heading", default: "How to become a partner" },
          { key: "qualify.body", label: "Intro paragraph", type: "textarea", default: "A simple, quality-first path — because every EXIT360 walkthrough carries our name." },
        ],
        lists: [{ key: "qualify.steps", label: "Steps", itemNoun: "step", fields: CARD, default: [
          { title: "Own an Insta360", body: "You supply your own Insta360 camera (X4 or similar). It's the gear we build our capture workflow around — compact, fast and stunning quality." },
          { title: "Complete training listings", body: "Shoot a small number of sample listings to our spec so we can check quality, scene linking and narration placement before you go live." },
          { title: "Get approved", body: "Pass the review and you're an approved EXIT360 partner, listed in our directory for buyers, sellers and brokers to find." },
          { title: "Receive local referrals", body: "We refer paid walkthrough work in your region straight to you, with templates and support for every shoot." },
        ] }],
      },
      {
        key: "why", label: "Why partner",
        lists: [{ key: "why.cards", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "Paid shoots", body: "Earn from referred walkthrough jobs — a growing pipeline as more businesses list with 360° tours." },
          { title: "Own your region", body: "Be the go-to EXIT360 partner locally, discoverable in our find-a-partner directory." },
          { title: "Do great work", body: "Immersive 360° storytelling with AI narration — the most impressive listings in the market." },
        ] }],
      },
      {
        key: "apply", label: "Apply form heading",
        fields: [
          { key: "apply.heading", label: "Heading", default: "Apply to join" },
          { key: "apply.sub", label: "Subtext", default: "We'll be in touch about training listings and next steps." },
        ],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Looking for a walkthrough, not a job?" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Find an approved EXIT360 partner in your area to capture your business — or book our Canberra shoot service." },
          { key: "cta.primary", label: "Primary button", default: "Find a partner" },
          { key: "cta.secondary", label: "Secondary button", default: "About 360° tours" },
        ],
      },
    ],
  },
  "/find-a-partner": {
    label: "Find a partner",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "Find a local ==walkthrough partner.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "Approved EXIT360 partners capture your business in immersive 360° so it sells faster. Search your area to find one — or book our own shoot service in Canberra." },
        ],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "Are you a photographer?" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Own an Insta360 and want paid walkthrough work in your area? Join the EXIT360 partner network." },
          { key: "cta.primary", label: "Primary button", default: "Become a partner" },
          { key: "cta.secondary", label: "Secondary button", default: "About 360° tours" },
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
  "/how-it-works": {
    label: "How it works",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "The complete platform guide" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "How EXIT360 works — and ==everything it can do.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "EXIT360 is Australia's 360° business-for-sale marketplace. It's far more than a classified ad: it's a **tour builder, an information memorandum generator, an NDA-gated data room and a live analytics dashboard** — all synced across app and web from one phone-verified account. This guide walks you through the whole platform, whether you're buying, selling or broking." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "Start a listing" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "Browse businesses" },
          { key: "hero.cardTitle", label: "Image card title", default: "One platform, end to end" },
          { key: "hero.cardSub", label: "Image card subtitle", default: "Tour → IM report → NDA → enquiry → sold" },
        ],
        lists: [{ key: "hero.chips", label: "Trust chips", itemNoun: "chip", fields: [{ key: "text", label: "Text" }], default: [{ text: "App & web, always in sync" }, { text: "Verified buyers only" }, { text: "You control the financials" }] }],
      },
      {
        key: "tracks", label: "Three ways to use EXIT360",
        fields: [
          { key: "tracks.heading", label: "Heading", default: "Three ways to use EXIT360" },
          { key: "tracks.body", label: "Intro paragraph", type: "textarea", default: "The same platform works three ways. Buyers explore and enquire, sellers build and control the sale, and brokers run entire portfolios for their clients. Here's the short version of each track." },
        ],
        lists: [{ key: "tracks.items", label: "Tracks", itemNoun: "track", fields: [
          { key: "tag", label: "Tag" }, { key: "title", label: "Title" },
          { key: "steps", label: "Steps (one per line)", type: "textarea" }, { key: "cta", label: "Button label" },
        ], default: [
          { tag: "Explore, verify, enquire", title: "For Buyers", cta: "Explore for buyers", steps: "Create a free account with your mobile number — one verified profile across app and web.\nBrowse listings and take the immersive 360° walkthrough of each business, room by room.\nSign the seller's NDA to unlock verified financials, divisions and the equipment register.\nSend a one-tap enquiry — request info, a call or a site visit — and message the seller securely.\nTrack everything you've unlocked and every conversation in your buyer portal." },
          { tag: "Build, gate, sell", title: "For Sellers", cta: "Explore for sellers", steps: "Create your listing with details, asking price and business divisions on app or web.\nCapture panoramic scenes and link them into a guided 360° walkthrough of your premises.\nGenerate your information memorandum from your financials, equipment and tour in a few taps.\nSwitch on the NDA gate and set per-buyer financial access so only serious buyers see the numbers.\nField verified enquiries, watch live analytics and reveal your details only when you're ready." },
          { tag: "Manage, share, scale", title: "For Brokers", cta: "Explore for brokers", steps: "Set up your broker profile and add every client business under one dashboard.\nBuild 360° tours and IM reports for each listing, or invite clients to help capture scenes.\nShare a polished, NDA-gated listing link with your buyer database in a single click.\nManage NDAs, enquiries and messages across your whole portfolio from one inbox.\nReport back to each vendor with live analytics — views, NDAs signed and requests by type." },
        ] }],
      },
      {
        key: "features", label: "Feature deep-dives",
        fields: [
          { key: "features.heading", label: "Heading", default: "A closer look at what the platform does" },
          { key: "features.body", label: "Intro paragraph", type: "textarea", default: "Every EXIT360 listing is built from four connected tools. Together they turn a business for sale into something a buyer can genuinely understand and trust before they ever pick up the phone." },
        ],
        lists: [{ key: "features.items", label: "Features", itemNoun: "feature", fields: [
          { key: "kicker", label: "Kicker" }, { key: "title", label: "Title" },
          { key: "body", label: "Body", type: "textarea" }, { key: "points", label: "Points (one per line)", type: "textarea" },
        ], default: [
          { kicker: "The walkthrough builder", title: "Capture a Street-View-style 360° tour of your business", body: "Shoot panoramic scenes of your storefront, floor, kitchen, plant room, workshop or warehouse straight from the app. Link scenes together with navigation hotspots so buyers move naturally from space to space, exactly like Google Street View. Add captions to highlight equipment, fit-out or capacity. The finished walkthrough embeds directly in your listing and your IM report — so buyers arrive at inspection already sold on the space instead of deciding whether it's worth the drive.", points: "Panoramic scene capture\nLinked, guided navigation\nScene captions & hotspots" },
          { kicker: "The report builder", title: "Generate a data-room-grade information memorandum", body: "Turn your financials, business divisions, equipment register and 360° tour into a professional information memorandum in minutes — no accountant's template or design software required. The builder structures your P&L, add-backs, revenue by division and asset list into a clean, credible document buyers and their advisers can rely on. It's the difference between a one-page teaser and a genuine data room, and it's generated automatically as you complete your listing.", points: "Financials & add-backs\nDivisions & equipment register\nTour embedded in the IM" },
          { kicker: "The NDA gate", title: "Protect your numbers with NDAs and per-buyer access", body: "Sensitive information stays hidden until a buyer earns it. Buyers must verify their mobile number and electronically sign your NDA before a single financial figure, division breakdown or IM report is revealed. You see exactly who signed and when, and you can grant or revoke financial access per buyer at any time. Run the whole sale confidentially — message-only, with your identity and phone number hidden until you choose to share them.", points: "e-Signed NDA required\nPer-buyer access toggles\nFully confidential mode" },
          { kicker: "Live analytics & sharing", title: "Know exactly how your sale is tracking", body: "Your dashboard shows listing views, tour engagement, NDAs signed and enquiries broken down by type — request for information, call-back or site visit — updating in real time. You'll know which buyers are hot before you spend a minute on the phone, and which parts of the tour draw the most attention. Brokers can share these same live analytics with each vendor client, so every party sees genuine, verifiable progress rather than a monthly guess.", points: "Views & tour engagement\nNDAs & requests by type\nBroker client-sharing" },
        ] }],
      },
      {
        key: "enquiries", label: "Enquiries & messaging",
        fields: [
          { key: "enquiries.heading", label: "Heading", default: "Verified buyers, one-tap enquiries and secure messaging" },
          { key: "enquiries.body", label: "Intro paragraph", type: "textarea", default: "Once a buyer is verified and past the NDA gate, everything runs through the platform — no anonymous time-wasters, no lost email threads, no leaked numbers." },
          { key: "enquiries.info1Title", label: "Info card 1 title", default: "Buyer portal & seller dashboard" },
          { key: "enquiries.info1Body", label: "Info card 1 body", type: "textarea", default: "Buyers track saved listings, signed NDAs and open conversations in the buyer portal. Sellers manage listings, financial access, enquiries and analytics from the seller dashboard. Each side sees exactly what it needs — and nothing it shouldn't." },
          { key: "enquiries.info2Title", label: "Info card 2 title", default: "One account, app and web" },
          { key: "enquiries.info2Body", label: "Info card 2 body", type: "textarea", default: "Your account is keyed to your phone number, so everything syncs instantly between the EXIT360 app and the website. Start a listing on your phone at the premises, finish the IM on your laptop, and reply to a buyer from whichever is closest." },
        ],
        lists: [{ key: "enquiries.cards", label: "Request cards", itemNoun: "card", fields: CARD, default: [
          { title: "Request information", body: "One tap sends a request for the full information memorandum. You approve it, and the buyer gets access — with a record of who has what." },
          { title: "Request a call", body: "Buyers can ask for a call-back without ever seeing your number. Reveal your phone only once you're comfortable and they've verified theirs." },
          { title: "Request a site visit", body: "Serious buyers who've explored the 360° tour can request an in-person inspection, so every visit is qualified rather than exploratory." },
        ] }],
      },
      {
        key: "highlights", label: "Highlights strip",
        fields: [{ key: "highlights.heading", label: "Heading", default: "Powerful because it does the whole job" }],
        lists: [{ key: "highlights.stats", label: "Highlights", itemNoun: "highlight", fields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], default: [
          { value: "Guided 360° tours", label: "Street-View-style walkthroughs" },
          { value: "Auto IM reports", label: "Data-room-grade documents" },
          { value: "NDA + access control", label: "Per-buyer financial gating" },
          { value: "Live analytics", label: "Views, NDAs, requests by type" },
        ] }],
      },
      {
        key: "control", label: "Control callout",
        fields: [
          { key: "control.heading", label: "Heading", default: "You stay in control the whole way" },
          { key: "control.body", label: "Body", type: "textarea", default: "Stay anonymous, run message-only, or reveal your number once a buyer verifies theirs. Turn financial access on and off per buyer, and pause or edit your listing whenever you like. There are no lock-in contracts — it's your sale, run on your terms, across app and web." },
        ],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "How EXIT360 works — your questions" }],
        lists: [{ key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
          { q: "Do I need special equipment to build a 360° walkthrough?", a: "No. You can capture panoramic scenes with the EXIT360 app on your phone, then link them into a guided tour. If you already have professional 360° imagery, you can use that too — the builder handles both." },
          { q: "What exactly goes into the information memorandum?", a: "Your IM report pulls together your financials and add-backs, business divisions, the equipment register and your 360° walkthrough into one professional, data-room-grade document. It's generated automatically as you complete your listing, so buyers and their advisers get a credible package from day one." },
          { q: "How are buyers stopped from seeing my financials?", a: "Financials sit behind an NDA gate. A buyer must verify their mobile number and electronically sign your NDA before any numbers are revealed, and you can grant or revoke access per buyer at any time. You always see who signed and when." },
          { q: "Can I use EXIT360 on both my phone and my computer?", a: "Yes. Your account is keyed to your phone number, so the app and the website stay in sync automatically. Start a listing at the premises on your phone and finish it on your laptop — it's all one account." },
          { q: "How does it work for brokers with multiple listings?", a: "Brokers manage every client business from one dashboard, build tours and IM reports for each, share NDA-gated listing links with their buyer database, and report live analytics — views, NDAs signed and requests by type — back to each vendor." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "See the whole platform in action" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "Build your 360° listing and information memorandum today, or browse verified businesses for sale across Australia. No lock-in, full control." },
          { key: "cta.primary", label: "Primary button", default: "List your business" },
          { key: "cta.secondary", label: "Secondary button", default: "Browse listings" },
        ],
      },
    ],
  },
  "/compare": {
    label: "Compare",
    sections: [
      {
        key: "hero", label: "Hero",
        fields: [
          { key: "hero.eyebrow", label: "Eyebrow", default: "EXIT360 vs traditional listing sites" },
          { key: "hero.title", label: "Headline (H1)", type: "textarea", default: "The best way to buy and sell a business, ==side by side.==" },
          { key: "hero.subtitle", label: "Subheadline", type: "textarea", default: "Most Australian businesses are still advertised on classified-style listing portals — the same channels people use to sell a car or rent a shopfront. EXIT360 was built specifically for business sales, so here's an honest, feature-by-feature look at everything we do that a traditional listing site can't." },
          { key: "hero.ctaPrimary", label: "Primary button", default: "List your business" },
          { key: "hero.ctaSecondary", label: "Secondary button", default: "See how it works" },
        ],
      },
      {
        key: "intro", label: "Intro copy",
        lists: [{ key: "intro.paras", label: "Paragraphs", itemNoun: "paragraph", fields: [{ key: "text", label: "Paragraph", type: "textarea" }], default: [
          { text: "Selling a business is one of the biggest financial decisions an owner will ever make, yet most listings still get the same treatment as a used-car ad: a handful of photos, an asking price and a contact form. Buyers are left guessing, sellers are buried in unqualified enquiries, and good deals stall because there's no easy way to build trust before a meeting." },
          { text: "Australia's main selling channels are classified-style listing sites — think **Seek Business, Bsale and the commercial listing portals**. They're great at putting a listing in front of a large audience, and for a small, simple sale that can be enough. But they were designed as directories, not as a place to actually run a confidential, high-value transaction. That's the gap EXIT360 closes." },
          { text: "The table below compares **EXIT360** against a generic **traditional listing site**. We're not naming names or claiming any single competitor lacks a particular tick — these are the structural differences between a classified directory and a purpose-built business-sale platform." },
        ] }],
      },
      {
        key: "table", label: "Comparison table",
        fields: [
          { key: "table.colA", label: "Column A header", default: "EXIT360" },
          { key: "table.colB", label: "Column B header", default: "Traditional listing sites" },
          { key: "table.footnote", label: "Footnote", type: "textarea", default: "Comparison reflects the typical feature set of classified-style business-for-sale listing portals. Individual sites vary; EXIT360 combines all of the above in one platform." },
        ],
        lists: [{ key: "table.rows", label: "Rows", itemNoun: "row", fields: [{ key: "feature", label: "Capability" }, { key: "detail", label: "Detail", type: "textarea" }], default: [
          { feature: "Immersive 360° guided walkthroughs", detail: "Navigable, room-to-room virtual tours of the actual premises." },
          { feature: "Verified (phone-checked) buyers", detail: "Every enquiry comes from a buyer who verified their mobile number." },
          { feature: "NDA-gated financials with per-buyer control", detail: "Numbers stay hidden until a buyer signs your NDA — and you can revoke access." },
          { feature: "Data-room-grade IM report builder", detail: "Your listing becomes a polished information memorandum automatically." },
          { feature: "Live analytics (views, NDAs, requests by type)", detail: "Real-time engagement data, not a monthly view count." },
          { feature: "Native app AND web, synced by phone number", detail: "Build and manage a listing on either — everything stays in sync." },
          { feature: "In-platform secure messaging", detail: "Talk to buyers without handing out your personal contact details." },
          { feature: "Broker multi-listing management + shareable client analytics", detail: "One dashboard for every mandate, with reports you can send to vendors." },
          { feature: "One-tap enquiries (info / call / site visit)", detail: "Buyers signal exactly what they want, so you triage in seconds." },
          { feature: "Anonymous / confidential selling", detail: "Run a discreet sale and reveal your identity only when you choose." },
        ] }],
      },
      {
        key: "deepdive", label: "Category deep-dives",
        fields: [
          { key: "deepdive.heading", label: "Heading", default: "Where the biggest differences show up" },
          { key: "deepdive.body", label: "Intro paragraph", type: "textarea", default: "A tick in a table is one thing — knowing why it changes your sale is another. These are the four capabilities that most reliably separate a fast, clean sale from a listing that drifts." },
        ],
        lists: [{ key: "deepdive.items", label: "Cards", itemNoun: "card", fields: CARD, default: [
          { title: "360° guided walkthroughs vs a photo gallery", body: "A traditional listing gives buyers a few staged photos and a floor-area figure, then asks them to book an inspection to fill in the blanks. Most won't — they self-select out, or they turn up unconvinced. An EXIT360 walkthrough lets a buyer move through the premises room by room, understand the layout, condition and fit-out, and arrive at inspection already sold on the space. Fewer wasted visits, more committed buyers." },
          { title: "Verified buyers and NDA-gated financials vs an open contact form", body: "On a classified site, anyone can fire off an enquiry, and your financials are either public or emailed out on trust. EXIT360 flips that: every enquiry comes from a phone-verified buyer, and your P&L, add-backs and equipment register sit behind an NDA gate you control per buyer. You see exactly who signed and when — and you can switch access off. That's the difference between advertising a business and running a data room." },
          { title: "Live analytics vs a monthly view count", body: "Traditional portals might tell you how many times a listing was viewed last month. EXIT360 shows you engagement as it happens: tour views, NDAs signed, and enquiries broken down by type — request for information, phone call or site visit. You know which buyers are hot before you spend a minute on the phone, and brokers can share those reports straight with their vendors." },
          { title: "App-and-web, synced by phone number vs a single web form", body: "Most listing sites are a web form and nothing more. EXIT360 is a native app and a full website that share one account keyed to your phone number. Start a listing on your phone at the premises, finish it on your laptop, and manage enquiries from whichever is closest — everything stays in sync, so nothing lives on a single device or in one inbox." },
        ] }],
      },
      {
        key: "honest", label: "When traditional is enough",
        fields: [
          { key: "honest.heading", label: "Heading", default: "When a traditional listing site might be enough" },
          { key: "honest.body", label: "Body", type: "textarea", default: "We'll be straight with you: EXIT360 isn't the only sensible choice for every sale. If you're selling a very small, low-value business — a home-based side venture, a simple online store with nothing physical to inspect, or an asset sale where the premises don't matter — a classified-style listing on a high-traffic portal may do the job at low cost, and there's no shame in that. Where EXIT360 earns its place is the moment your sale involves a real location worth walking through, financials worth protecting, or enough buyer interest that you need to qualify and track it. That's most genuine business sales — but not quite all of them." },
        ],
      },
      {
        key: "faq", label: "FAQ",
        fields: [{ key: "faq.heading", label: "Heading", default: "Comparison questions, answered" }],
        lists: [{ key: "faq.items", label: "Questions", itemNoun: "question", fields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }], default: [
          { q: "How is EXIT360 different from a traditional business-for-sale website?", a: "Traditional listing sites are classified-style directories: photos, a price and a contact form. EXIT360 adds immersive 360° walkthroughs, phone-verified buyers, NDA-gated financials, a built-in information memorandum and live analytics — all in one app-and-web platform built specifically for business sales." },
          { q: "Is EXIT360 an alternative to Seek Business or Bsale?", a: "Yes. Australia's main channels are classified-style listing portals such as Seek Business, Bsale and the commercial listing sites. EXIT360 is a modern alternative that treats a business sale like the high-value, confidential transaction it is — with virtual tours, verified buyers and a secure data room rather than a directory ad." },
          { q: "Do 360° virtual tours actually help sell a business?", a: "They do. A navigable walkthrough lets buyers understand the premises, layout and fit-out before they enquire, which filters out tyre-kickers, cuts wasted inspections and brings more committed buyers to the table. It's the closest thing to being there without booking a visit." },
          { q: "Can brokers manage multiple listings and share reports?", a: "Yes. Brokers get one dashboard to manage every mandate, plus shareable analytics — views, tour engagement, NDAs and enquiry types — that they can send straight to their vendor clients as a professional progress report." },
          { q: "Does switching to EXIT360 mean giving up reach?", a: "No. You can run EXIT360 as your primary, purpose-built sale platform while still advertising elsewhere. The difference is that every EXIT360 enquiry lands from a verified buyer into a controlled data room, so the reach you do get converts far better." },
        ] }],
      },
      {
        key: "cta", label: "Bottom call-to-action",
        fields: [
          { key: "cta.heading", label: "Heading", default: "See the difference for your own sale" },
          { key: "cta.sub", label: "Subtext", type: "textarea", default: "List on the platform built for business sales — 360° tours, verified buyers and a secure data room, with no lock-in and full control." },
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
