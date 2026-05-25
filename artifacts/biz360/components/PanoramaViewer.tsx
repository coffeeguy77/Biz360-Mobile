import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { TourPin, TourSpace } from "@/data/listings";

// Approximate horizontal/vertical field of view for a typical iPhone landscape photo
const HAOV = 80;
const VAOV = 50;

const DIR_8 = ["Front","Front-Right","Right","Back-Right","Back","Back-Left","Left","Front-Left"];
const DIR_4 = ["Front","Right","Back","Left"];

const PIN_COLORS: Record<string, string> = {
  equipment:"#F59E0B", revenue:"#16A34A", cogs:"#EF4444",
  workflow:"#8B5CF6",  staffing:"#3B82F6", lease:"#F97316",
  risk:"#EF4444",      opportunity:"#16A34A", narration:"#EC4899",
  inspection:"#06B6D4",highlight:"#F59E0B",   document:"#6366F1",
};
const PIN_ICONS: Record<string, string> = {
  equipment:"&#128296;", revenue:"&#128200;",  cogs:"&#128230;",
  workflow:"&#128256;",  staffing:"&#128101;", lease:"&#127968;",
  risk:"&#9888;&#65039;",opportunity:"&#11088;",narration:"&#127908;",
  inspection:"&#128203;",highlight:"&#9889;",   document:"&#128196;",
};

// ─── Single equirectangular panorama (demo spaces with panoramaUrl) ────────────
function buildSinglePanoHtml(panoramaUrl: string, startYaw: number, pins: TourPin[]): string {
  const hotspots = pins.map((p) => ({
    id: p.id,
    pitch: (0.5 - p.position.y) * 60,
    yaw: p.position.x * 360 - 180,
    title: p.title.split(" ").slice(0, 4).join(" "),
    color: PIN_COLORS[p.type] ?? "#3B82F6",
    icon: PIN_ICONS[p.type] ?? "&#8505;",
    locked: !!p.requiresNDA,
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
    function createPin(container, args) {
      container.style.cssText = 'background:'+args.color+';border-radius:20px;padding:6px 12px;color:#fff;font-size:12px;font-weight:700;font-family:-apple-system,system-ui,sans-serif;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:1.5px solid rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none;transform:translateY(-50%)';
      container.innerHTML = (args.locked?'<span style="font-size:10px">&#128274;</span> ':'')+args.icon+' '+args.label;
      ['touchend','click'].forEach(function(ev){container.addEventListener(ev,function(e){e.stopPropagation();e.preventDefault();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:args.id}));});});
    }
    pannellum.viewer('pano',{
      type:'equirectangular', panorama:'${panoramaUrl}',
      autoLoad:true, showControls:false, compass:false,
      yaw:${startYaw}, pitch:0, hfov:100, minHfov:40, maxHfov:150,
      mouseZoom:true, touchPanSpeedCoeffFactor:1.5, showFullscreenCtrl:false,
      hotSpots:PINS.map(function(p){return{id:p.id,pitch:p.pitch,yaw:p.yaw,type:'custom',cssClass:'',createTooltipFunc:createPin,createTooltipArgs:{id:p.id,label:p.title,icon:p.icon,color:p.color,locked:p.locked}};})
    });
  </script>
</body></html>`;
}

// ─── Multi-scene tour from separate directional photos ─────────────────────────
function buildMultiSceneHtml(photos: string[], pins: TourPin[]): string {
  const N = photos.length;
  const dirLabels = N >= 8 ? DIR_8 : DIR_4;

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
    var HAOV = ${HAOV};
    var VAOV = ${VAOV};
    var N = ${N};
    var PHOTOS = ${JSON.stringify(photos)};
    var PINS_RAW = ${JSON.stringify(pins.map((p) => ({
      id: p.id,
      type: p.type,
      posX: p.position.x,
      posY: p.position.y,
      title: p.title.split(" ").slice(0, 4).join(" "),
      color: PIN_COLORS[p.type] ?? "#3B82F6",
      icon: PIN_ICONS[p.type] ?? "&#8505;",
      locked: !!p.requiresNDA,
    })))};
    var DIR_LABELS = ${JSON.stringify(dirLabels)};

    var viewer = null;

    function createPin(container, args) {
      container.style.cssText = 'background:'+args.color+';border-radius:20px;padding:6px 12px;color:#fff;font-size:12px;font-weight:700;font-family:-apple-system,system-ui,sans-serif;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:1.5px solid rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none;-webkit-user-select:none;transform:translateY(-50%)';
      container.innerHTML = (args.locked?'<span style="font-size:10px">&#128274;</span> ':'')+args.icon+' '+args.label;
      ['touchend','click'].forEach(function(ev){
        container.addEventListener(ev,function(e){
          e.stopPropagation();e.preventDefault();
          if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:args.id}));
        });
      });
    }

    function createNav(container, args) {
      container.style.cssText = 'background:rgba(0,0,0,0.7);border-radius:24px;padding:8px 16px;color:#fff;font-size:13px;font-weight:700;font-family:-apple-system,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.5);border:1.5px solid rgba(255,255,255,0.3);cursor:pointer;user-select:none;-webkit-user-select:none;transform:translateY(-50%)';
      container.innerHTML = args.label;
      ['touchend','click'].forEach(function(ev){
        container.addEventListener(ev,function(e){
          e.stopPropagation();e.preventDefault();
          if(viewer) viewer.loadScene(args.sceneId);
        });
      });
    }

    var scenes = {};
    for(var i=0;i<N;i++){
      (function(idx){
        var sceneId = 's'+idx;
        var prevId  = 's'+((idx-1+N)%N);
        var nextId  = 's'+((idx+1)%N);
        var nextLbl = DIR_LABELS[(idx+1)%N];
        var prevLbl = DIR_LABELS[(idx-1+N)%N];

        var hotSpots = [
          { pitch:0, yaw: HAOV*0.46, type:'custom', cssClass:'',
            createTooltipFunc:createNav,
            createTooltipArgs:{label:nextLbl+' \u2192', sceneId:nextId} },
          { pitch:0, yaw:-HAOV*0.46, type:'custom', cssClass:'',
            createTooltipFunc:createNav,
            createTooltipArgs:{label:'\u2190 '+prevLbl, sceneId:prevId} },
        ];

        PINS_RAW.forEach(function(p){
          if(Math.floor(p.posX * N) === idx){
            var relX = p.posX * N - idx;
            hotSpots.push({
              pitch: (0.5-p.posY)*VAOV,
              yaw:   (relX-0.5)*HAOV,
              type:'custom', cssClass:'',
              createTooltipFunc:createPin,
              createTooltipArgs:{id:p.id,label:p.title,icon:p.icon,color:p.color,locked:p.locked}
            });
          }
        });

        scenes[sceneId] = {
          type:'equirectangular',
          panorama: PHOTOS[idx],
          haov: HAOV,
          vaov: VAOV,
          hotSpots: hotSpots
        };
      })(i);
    }

    viewer = pannellum.viewer('pano', {
      default: {
        firstScene:'s0',
        sceneFadeDuration:400,
        autoLoad:true,
        showControls:false,
        compass:false,
        pitch:0,
        hfov: HAOV,
        minHfov:40,
        maxHfov: HAOV,
        mouseZoom:false,
        touchPanSpeedCoeffFactor:1.8,
        showFullscreenCtrl:false,
        keyboardZoom:false
      },
      scenes: scenes
    });

    viewer.on('scenechange', function(sceneId){
      var idx = parseInt(sceneId.replace('s',''), 10);
      if(window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'sceneChange',idx:idx,label:DIR_LABELS[idx]||sceneId}));
    });
  </script>
</body></html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  space: TourSpace;
  onPinPress: (pin: TourPin) => void;
}

export function PanoramaViewer({ space, onPinPress }: Props) {
  const webRef = useRef<WebView>(null);

  // For multi-scene: convert local file:// photos to base64 data URIs
  const [photoDataUris, setPhotoDataUris] = useState<string[] | null>(
    space.panoramaUrl ? [] : null
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (space.panoramaUrl) return; // single panorama — no conversion needed
    if (!space.photos.length) { setPhotoDataUris([]); return; }

    let cancelled = false;
    (async () => {
      const results: (string | null)[] = await Promise.all(
        space.photos.map(async (photo) => {
          // Already a data URI or remote URL — use as-is
          if (photo.startsWith("data:") || photo.startsWith("http")) return photo;
          // Local file:// URI — read as base64
          try {
            const base64 = await FileSystem.readAsStringAsync(photo, {
              encoding: "base64",
            });
            return `data:image/jpeg;base64,${base64}`;
          } catch {
            // File may have been cleared from cache; try via fetch as fallback
            try {
              const resp = await fetch(photo);
              if (!resp.ok) return null;
              const blob = await resp.blob();
              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } catch {
              return null; // skip this photo
            }
          }
        })
      );

      if (cancelled) return;

      const valid = results.filter((r): r is string => r !== null);
      if (valid.length === 0) {
        setLoadError(
          "Photos for this space are no longer available.\n\nThis can happen when iOS clears the app cache. Please delete this space and re-create it — photos will now be saved permanently."
        );
      } else {
        setPhotoDataUris(valid);
      }
    })();
    return () => { cancelled = true; };
  }, [space.id]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pinTap") {
        const pin = space.pins.find((p) => p.id === data.id);
        if (pin) onPinPress(pin);
      }
    } catch { /* ignore */ }
  };

  // ── Error state ──
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  // ── Loading base64 conversion ──
  if (photoDataUris === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Preparing tour…</Text>
        <Text style={styles.loadingHint}>Converting {space.photos.length} photos</Text>
      </View>
    );
  }

  // ── Build HTML ──
  const html = space.panoramaUrl
    ? buildSinglePanoHtml(space.panoramaUrl, space.panoramaStartYaw ?? 0, space.pins)
    : buildMultiSceneHtml(photoDataUris, space.pins);

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
  container: { flex: 1, backgroundColor: "#071221" },
  webView: { flex: 1, backgroundColor: "#071221" },
  center: {
    flex: 1, backgroundColor: "#071221",
    alignItems: "center", justifyContent: "center", gap: 12, padding: 24,
  },
  loadingText: {
    color: "#fff", fontSize: 16,
    fontFamily: Platform.OS === "web" ? "system-ui" : "Inter_600SemiBold",
  },
  loadingHint: {
    color: "#8B9CB8", fontSize: 13,
    fontFamily: Platform.OS === "web" ? "system-ui" : "Inter_400Regular",
  },
  errorText: {
    color: "#EF4444", fontSize: 14, textAlign: "center",
    fontFamily: Platform.OS === "web" ? "system-ui" : "Inter_400Regular",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", backgroundColor: "#071221",
  },
});
