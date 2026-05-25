import React, { useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { TourPin, TourSpace } from "@/data/listings";

const PIN_COLORS: Record<string, string> = {
  equipment:   "#F59E0B",
  revenue:     "#16A34A",
  cogs:        "#EF4444",
  workflow:    "#8B5CF6",
  staffing:    "#3B82F6",
  lease:       "#F97316",
  risk:        "#EF4444",
  opportunity: "#16A34A",
  narration:   "#EC4899",
  inspection:  "#06B6D4",
  highlight:   "#F59E0B",
  document:    "#6366F1",
};

const PIN_ICONS: Record<string, string> = {
  equipment:   "&#128296;",
  revenue:     "&#128200;",
  cogs:        "&#128230;",
  workflow:    "&#128256;",
  staffing:    "&#128101;",
  lease:       "&#127968;",
  risk:        "&#9888;&#65039;",
  opportunity: "&#11088;",
  narration:   "&#127908;",
  inspection:  "&#128203;",
  highlight:   "&#9889;",
  document:    "&#128196;",
};

interface PinHotspot {
  id: string;
  pitch: number;
  yaw: number;
  title: string;
  color: string;
  icon: string;
  locked: boolean;
}

function buildPanoHtml(
  panoramaUrl: string,
  startYaw: number,
  pins: PinHotspot[]
): string {
  const pinsJson = JSON.stringify(pins);

  return `<!DOCTYPE html>
<html>
<head>
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
    .pin-bubble{
      display:inline-flex;align-items:center;gap:5px;
      padding:6px 12px;border-radius:20px;
      font:-apple-system-body;font-size:12px;font-weight:700;
      color:#fff;cursor:pointer;white-space:nowrap;
      box-shadow:0 3px 10px rgba(0,0,0,0.6);
      border:1.5px solid rgba(255,255,255,0.25);
      transform:translateY(-50%);
      transition:transform 0.1s,opacity 0.1s;
      user-select:none;-webkit-user-select:none
    }
    .pin-bubble:active{transform:translateY(-50%) scale(0.93);opacity:0.85}
    .pin-lock{font-size:10px;opacity:0.8}
  </style>
</head>
<body>
  <div id="pano"></div>
  <script>
    var PINS = ${pinsJson};

    function createPin(container, args) {
      container.style.background = args.color;
      container.style.borderRadius = '20px';
      container.style.padding = '6px 12px';
      container.style.color = '#fff';
      container.style.fontSize = '12px';
      container.style.fontWeight = '700';
      container.style.fontFamily = '-apple-system, system-ui, sans-serif';
      container.style.whiteSpace = 'nowrap';
      container.style.boxShadow = '0 3px 10px rgba(0,0,0,0.6)';
      container.style.border = '1.5px solid rgba(255,255,255,0.25)';
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';
      container.style.gap = '5px';
      container.style.cursor = 'pointer';
      container.style.userSelect = 'none';
      container.style.transform = 'translateY(-50%)';
      container.innerHTML = (args.locked ? '<span style="font-size:10px">&#128274;</span> ' : '') + args.icon + ' ' + args.label;
      container.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        container.style.opacity = '0.8';
        container.style.transform = 'translateY(-50%) scale(0.93)';
      });
      container.addEventListener('touchend', function(e) {
        e.stopPropagation();
        e.preventDefault();
        container.style.opacity = '1';
        container.style.transform = 'translateY(-50%)';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:args.id}));
        }
      });
      container.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:args.id}));
        }
      });
    }

    pannellum.viewer('pano', {
      type: 'equirectangular',
      panorama: '${panoramaUrl}',
      autoLoad: true,
      showControls: false,
      compass: false,
      yaw: ${startYaw},
      pitch: 0,
      hfov: 100,
      minHfov: 40,
      maxHfov: 150,
      mouseZoom: true,
      touchPanSpeedCoeffFactor: 1.5,
      showFullscreenCtrl: false,
      hotSpots: PINS.map(function(p) {
        return {
          id: p.id,
          pitch: p.pitch,
          yaw: p.yaw,
          type: 'custom',
          cssClass: '',
          createTooltipFunc: createPin,
          createTooltipArgs: {id:p.id, label:p.title, icon:p.icon, color:p.color, locked:p.locked}
        };
      })
    });
  </script>
</body>
</html>`;
}

interface Props {
  space: TourSpace;
  onPinPress: (pin: TourPin) => void;
}

export function PanoramaViewer({ space, onPinPress }: Props) {
  const webRef = useRef<WebView>(null);

  const pinHotspots: PinHotspot[] = space.pins.map((pin) => ({
    id: pin.id,
    pitch: (0.5 - pin.position.y) * 60,
    yaw: pin.position.x * 360 - 180,
    title: pin.title.split(" ").slice(0, 4).join(" "),
    color: PIN_COLORS[pin.type] ?? "#3B82F6",
    icon: PIN_ICONS[pin.type] ?? "&#8505;",
    locked: !!pin.requiresNDA,
  }));

  const html = buildPanoHtml(
    space.panoramaUrl!,
    space.panoramaStartYaw ?? 0,
    pinHotspots
  );

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pinTap") {
        const pin = space.pins.find((p) => p.id === data.id);
        if (pin) onPinPress(pin);
      }
    } catch {
      // ignore malformed messages
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <WebView
          source={{ html }}
          style={styles.webView}
          javaScriptEnabled
          onMessage={handleMessage}
          scrollEnabled={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.webView}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071221",
  },
  webView: {
    flex: 1,
    backgroundColor: "#071221",
  },
  webFallback: {
    flex: 1,
    backgroundColor: "#071221",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071221",
  },
});
