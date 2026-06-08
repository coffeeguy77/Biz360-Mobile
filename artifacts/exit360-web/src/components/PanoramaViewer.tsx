import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, MapPin, DollarSign, Package, Users, FileText, ArrowRight, Lightbulb } from "lucide-react";

interface DemoPin {
  id: string;
  type: "equipment"|"revenue"|"cogs"|"staffing"|"lease"|"opportunity"|"navigation"|"audio";
  title: string;
  description: string;
  pitch: number;
  yaw: number;
  pinColor?: string;
  targetSpaceId?: string;
  popupSections?: { label: string; value: string }[];
}

interface DemoSpace {
  id: string;
  name: string;
  panoramaUrl: string;
  startYaw: number;
  pins: DemoPin[];
}

const DEMO_SPACES: DemoSpace[] = [
  {
    id: "space-001",
    name: "Main Floor",
    panoramaUrl: "https://pannellum.org/images/alma.jpg",
    startYaw: 0,
    pins: [
      {
        id: "pin-001", type: "equipment",
        title: "La Marzocco Espresso Machine",
        description: "2022 La Marzocco Linea PB 3-group. Valued at $28,000 new. Included in sale.",
        pitch: -10, yaw: -60,
        popupSections: [
          { label: "Purchase Year", value: "2022" },
          { label: "Replacement Value", value: "$28,000" },
          { label: "Last Service", value: "3 months ago" },
          { label: "Daily Output", value: "250–300 coffees" },
        ]
      },
      {
        id: "pin-002", type: "revenue",
        title: "POS Counter — $18.5K/wk",
        description: "Weekly revenue $17K–$20K. 65% coffee, 25% food, 10% merch.",
        pitch: -5, yaw: 20,
        popupSections: [
          { label: "Weekly Revenue", value: "$17,000–$20,000" },
          { label: "Coffee Revenue", value: "65%" },
          { label: "Food Revenue", value: "25%" },
          { label: "Peak Hours", value: "7am–10am Mon–Fri" },
        ]
      },
      {
        id: "pin-003", type: "staffing",
        title: "Staff — 4 FTE",
        description: "2 baristas (FT), 1 kitchen (FT), 1 floor (PT). All willing to stay.",
        pitch: -15, yaw: 80,
      },
      {
        id: "pin-004", type: "opportunity",
        title: "Catering Opportunity",
        description: "3 nearby offices interested. Could add $1,500–$3,000/wk in high-margin revenue.",
        pitch: 5, yaw: 140,
      },
      {
        id: "pin-nav-001", type: "navigation",
        title: "Go to Kitchen",
        description: "See the full commercial kitchen",
        pitch: -20, yaw: -150,
        targetSpaceId: "space-002",
      },
    ],
  },
  {
    id: "space-002",
    name: "Kitchen",
    panoramaUrl: "https://pannellum.org/images/alma.jpg",
    startYaw: 180,
    pins: [
      {
        id: "pin-007", type: "equipment",
        title: "Commercial Kitchen — Full Setup",
        description: "6-burner range, double-door fridge, dishwasher. Health rating: Excellent.",
        pitch: -10, yaw: 30,
      },
      {
        id: "pin-008", type: "cogs",
        title: "COGS — 28% of Revenue",
        description: "Coffee beans from Genovese ($320/wk). Food COGS 32%. 30-day supplier terms.",
        pitch: 5, yaw: -50,
        popupSections: [
          { label: "Total COGS", value: "28% of revenue" },
          { label: "Coffee Supplier", value: "Genovese ($320/wk)" },
          { label: "Food COGS", value: "32%" },
          { label: "Payment Terms", value: "30 days" },
        ]
      },
      {
        id: "pin-nav-002", type: "navigation",
        title: "Back to Main Floor",
        description: "Return to the main seating area",
        pitch: -20, yaw: 120,
        targetSpaceId: "space-001",
      },
      {
        id: "pin-nav-003", type: "navigation",
        title: "Go to Outdoor Area",
        description: "See the outdoor dining space",
        pitch: -20, yaw: -120,
        targetSpaceId: "space-003",
      },
    ],
  },
  {
    id: "space-003",
    name: "Outdoor Seating",
    panoramaUrl: "https://pannellum.org/images/cerro-toco-0.jpg",
    startYaw: 0,
    pins: [
      {
        id: "pin-009", type: "lease",
        title: "Outdoor Licence — 12 Seats",
        description: "Council-approved footpath trading licence. 12 seats, ~$2,400/wk fine weather.",
        pitch: -30, yaw: 45,
        popupSections: [
          { label: "Seats", value: "12 outdoor" },
          { label: "Revenue", value: "~$2,400/wk (fine weather)" },
          { label: "Annual Licence", value: "$1,800" },
          { label: "Transferable", value: "Yes" },
        ]
      },
      {
        id: "pin-nav-004", type: "navigation",
        title: "Back to Kitchen",
        description: "Return to the kitchen",
        pitch: -20, yaw: -170,
        targetSpaceId: "space-002",
      },
    ],
  },
];

const PIN_COLORS: Record<string, string> = {
  equipment:"#F59E0B", revenue:"#16A34A",  cogs:"#EF4444",
  workflow:"#8B5CF6",  staffing:"#3B82F6", lease:"#F97316",
  risk:"#EF4444",      opportunity:"#16A34A", narration:"#EC4899",
  navigation:"#2563EB", audio:"#EC4899",
};

const PIN_ICONS: Record<string, string> = {
  equipment:"\u{1F527}", revenue:"\u{1F4C8}", cogs:"\u{1F4E6}",
  staffing:"\u{1F465}", lease:"\u{1F3E0}", opportunity:"\u2B50",
  navigation:"\u21BA", audio:"\u{1F3B5}",
};

function buildPanoHtml(panoramaUrl: string, startYaw: number, pins: DemoPin[]): string {
  const hotspots = pins.map((p) => ({
    id: p.id,
    pitch: p.pitch,
    yaw: p.yaw,
    color: p.pinColor ?? PIN_COLORS[p.type] ?? "#3B82F6",
    icon: PIN_ICONS[p.type] ?? "\u2139",
    animation: p.type === "navigation" ? "ripple" : p.type === "audio" ? "pulse" : "glow",
    label: p.title.split(" ").slice(0, 4).join(" "),
    isNav: p.type === "navigation",
  }));

  return `<!DOCTYPE html>
<html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#071221;overflow:hidden}
    #pano{width:100vw;height:100vh}
    .pnlm-about-msg,.pnlm-load-button,.pnlm-orientation-button{display:none!important}
    .pnlm-load-box{background:rgba(7,18,33,0.9)!important;border-radius:12px!important}
    .pnlm-load-box p{color:#fff!important}
    .pnlm-lbar{background:#3B82F6!important}
    .pnlm-lbar-fill{background:#60A5FA!important}
  </style>
</head><body>
  <div id="pano"></div>
  <script>
    var PINS = ${JSON.stringify(hotspots)};

    function injectKf(id, css) {
      if (!document.getElementById(id)) {
        var s = document.createElement('style');
        s.id = id; s.textContent = css;
        document.head.appendChild(s);
      }
    }

    function createPin(container, args) {
      var sz = Math.round(36 * (args.size || 1));
      var half = sz >> 1;
      var col = args.color;
      var anim = args.animation || 'none';

      container.style.background   = 'transparent';
      container.style.border       = 'none';
      container.style.boxShadow    = 'none';
      container.style.borderRadius = '0';
      container.style.cursor       = 'pointer';
      container.style.overflow     = 'visible';

      if (anim === 'ripple') {
        injectKf('kf-ripple','@keyframes kfRipple{0%{transform:scale(0.15);opacity:0.9}100%{transform:scale(4.5);opacity:0}}');
        var coreCol = args.isNav ? '#2563EB' : col;
        var W = sz + 24; var HW = W >> 1;
        container.style.width = W + 'px'; container.style.height = W + 'px';
        container.style.marginLeft = '-' + HW + 'px'; container.style.marginTop = '-' + HW + 'px';
        var R = 'position:absolute;width:24px;height:24px;border-radius:50%;background:transparent;border:2.5px solid rgba(59,130,246,0.9);top:50%;left:50%;margin:-12px 0 0 -12px;animation-name:kfRipple;animation-duration:2s;animation-timing-function:ease-out;animation-iteration-count:infinite;pointer-events:none';
        var C = 'position:absolute;width:12px;height:12px;border-radius:50%;background:' + coreCol + ';top:50%;left:50%;margin:-6px 0 0 -6px;z-index:2;box-shadow:0 0 8px 3px ' + coreCol + '88';
        container.innerHTML = '<div style="' + R + ';animation-delay:0s"></div><div style="' + R + ';animation-delay:0.67s"></div><div style="' + R + ';animation-delay:1.33s"></div><div style="' + C + '"></div>';
      } else if (anim === 'pulse') {
        injectKf('kf-pulse','@keyframes kfPulse{0%{transform:scale(0.15);opacity:0.9}100%{transform:scale(4.5);opacity:0}}');
        var W2 = sz + 24; var HW2 = W2 >> 1;
        container.style.width = W2 + 'px'; container.style.height = W2 + 'px';
        container.style.marginLeft = '-' + HW2 + 'px'; container.style.marginTop = '-' + HW2 + 'px';
        var LR = 'position:absolute;width:24px;height:24px;border-radius:50%;background:transparent;border:2.5px solid rgba(236,72,153,0.9);top:50%;left:50%;margin:-12px 0 0 -12px;animation-name:kfPulse;animation-duration:2s;animation-timing-function:ease-out;animation-iteration-count:infinite;pointer-events:none';
        var micSz = Math.round(sz * 0.55);
        var LC = 'position:absolute;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#EC4899;top:50%;left:50%;margin:-' + half + 'px 0 0 -' + half + 'px;z-index:2;box-shadow:0 0 8px 3px #EC489988;display:flex;align-items:center;justify-content:center;font-size:' + micSz + 'px;line-height:1';
        container.innerHTML = '<div style="' + LR + ';animation-delay:0s"></div><div style="' + LR + ';animation-delay:0.67s"></div><div style="' + LR + ';animation-delay:1.33s"></div><div style="' + LC + '">' + args.icon + '</div>';
      } else {
        var iconSz = Math.round(sz * 0.55);
        container.style.width = sz + 'px'; container.style.height = sz + 'px';
        container.style.borderRadius = '50%';
        container.style.display = 'flex'; container.style.alignItems = 'center'; container.style.justifyContent = 'center';
        container.style.fontSize = iconSz + 'px'; container.style.lineHeight = '1';
        container.style.boxShadow = '0 3px 12px rgba(0,0,0,0.7)';
        container.style.border = '2px solid rgba(255,255,255,0.35)';
        container.style.background = col;
        container.style.marginLeft = '-' + half + 'px'; container.style.marginTop = '-' + half + 'px';
        container.innerHTML = args.icon;
        if (anim === 'glow') {
          injectKf('kf-glow','@keyframes kfGlow{0%,100%{filter:brightness(1) drop-shadow(0 0 3px rgba(255,255,255,0.25))}50%{filter:brightness(1.8) drop-shadow(0 0 10px rgba(255,255,255,0.65))}}');
          container.style.animation = 'kfGlow 2s ease-in-out infinite';
        }
      }

      ['touchend','click'].forEach(function(ev) {
        container.addEventListener(ev, function(e) {
          e.stopPropagation(); e.preventDefault();
          window.parent.postMessage(JSON.stringify({ type: 'pinTap', id: args.id, label: args.label, color: args.color }), '*');
        });
      });
    }

    pannellum.viewer('pano', {
      type: 'equirectangular',
      panorama: '${panoramaUrl}',
      autoLoad: true, showControls: false, compass: false,
      yaw: ${startYaw}, pitch: 0, hfov: 100, minHfov: 40, maxHfov: 140,
      mouseZoom: true, showFullscreenCtrl: false,
      hotSpots: PINS.map(function(p) {
        return {
          id: p.id, pitch: p.pitch, yaw: p.yaw,
          type: 'custom', cssClass: '',
          createTooltipFunc: createPin,
          createTooltipArgs: { id: p.id, label: p.label, icon: p.icon, color: p.color, isNav: p.isNav, animation: p.animation, size: 1 }
        };
      })
    });
  </script>
</body></html>`;
}

export function PanoramaViewer() {
  const [currentSpaceId, setCurrentSpaceId] = useState("space-001");
  const [activePin, setActivePin] = useState<DemoPin | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentSpace = DEMO_SPACES.find(s => s.id === currentSpaceId)!;
  const htmlContent = buildPanoHtml(currentSpace.panoramaUrl, currentSpace.startYaw, currentSpace.pins);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pinTap') {
          const pin = currentSpace.pins.find(p => p.id === msg.id);
          if (pin) {
            if (pin.type === 'navigation' && pin.targetSpaceId) {
              setCurrentSpaceId(pin.targetSpaceId);
              setActivePin(null);
            } else {
              setActivePin(pin);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentSpaceId, currentSpace.pins]);

  return (
    <div className="w-full bg-card border border-border rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="p-4 border-b border-border bg-background/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">The Daily Press Espresso Bar</h3>
          <p className="text-sm text-muted-foreground">Fitzroy VIC</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-right">
            <div className="text-muted-foreground">Asking Price</div>
            <div className="font-semibold text-foreground">$185,000</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Weekly Rev</div>
            <div className="font-semibold text-green-400">$18.5K</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Staff</div>
            <div className="font-semibold text-foreground">4 FTE</div>
          </div>
        </div>
      </div>
      
      <div className="flex border-b border-border bg-card">
        {DEMO_SPACES.map((space) => (
          <button
            key={space.id}
            onClick={() => {
              setCurrentSpaceId(space.id);
              setActivePin(null);
            }}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              currentSpaceId === space.id 
                ? "border-b-2 border-primary text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {space.name}
          </button>
        ))}
      </div>

      <div className="relative w-full h-[500px] md:h-[600px] bg-background">
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Panorama Viewer"
        />

        {activePin && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border border-border shadow-2xl rounded-xl p-5 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                {activePin.title}
              </h4>
              <button 
                onClick={() => setActivePin(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{activePin.description}</p>
            
            {activePin.popupSections && activePin.popupSections.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                {activePin.popupSections.map((section, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{section.label}</span>
                    <span className="font-medium text-foreground text-right">{section.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-3 bg-background/50 border-t border-border flex flex-wrap gap-4 text-xs justify-center text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div> Equipment</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#16A34A]"></div> Revenue / Opp</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#EF4444]"></div> COGS</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div> Staffing</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F97316]"></div> Lease</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border border-[#2563EB]"></div> Navigation</div>
      </div>
    </div>
  );
}
