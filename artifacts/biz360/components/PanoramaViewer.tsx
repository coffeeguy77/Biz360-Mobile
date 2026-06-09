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
import { TourPin, TourSettings, TourSpace } from "@/data/listings";

const DIR_8 = ["Front","Front-Right","Right","Back-Right","Back","Back-Left","Left","Front-Left"];
const DIR_4 = ["Front","Right","Back","Left"];

const PIN_COLORS: Record<string, string> = {
  equipment:"#F59E0B", revenue:"#16A34A",  cogs:"#EF4444",
  workflow:"#8B5CF6",  staffing:"#3B82F6", lease:"#F97316",
  risk:"#EF4444",      opportunity:"#16A34A", narration:"#EC4899",
  inspection:"#06B6D4",highlight:"#F59E0B",   document:"#6366F1",
  navigation:"#2563EB",look:"#0EA5E9",         external_link:"#0891B2",audio:"#EC4899",
};

// Navigation pin uses an inline SVG 360° icon (base64) — used in flat viewers only.
// Pannellum hotspots cannot safely use <img> tags inside innerHTML inside a <script> block,
// so we keep a separate emoji-only icon map for pannellum.
const NAV_ICON_HTML = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgOTAiPjxwYXRoIGQ9Ik0gMTIgNjIgQSA0MCA0MCAwIDEgMSA4OCA2MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48dGV4dCB4PSI1MCIgeT0iNTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjMiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLC1hcHBsZS1zeXN0ZW0sc2Fucy1zZXJpZiI+MzYwwrA8L3RleHQ+PHBhdGggZD0iTSA4MiA1MiBMIDg4IDYyIEwgNzkgNjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+" style="width:22px;height:22px;display:block;pointer-events:none"/>';

// Flat-viewer icons (HTML allowed — used in buildFlatPanoHtml / buildFlatStripHtml)
const PIN_ICONS: Record<string, string> = {
  equipment:"&#128296;",  revenue:"&#128200;",    cogs:"&#128230;",
  workflow:"&#128256;",   staffing:"&#128101;",   lease:"&#127968;",
  risk:"&#9888;",         opportunity:"&#11088;", narration:"&#127908;",
  inspection:"&#128203;", highlight:"&#9889;",    document:"&#128196;",
  navigation:NAV_ICON_HTML, look:"&#128065;",     external_link:"&#128279;", audio:"&#127925;",
};

// Pannellum hotspot icons — emoji/text ONLY (no HTML tags; they'd break inside <script> JSON)
const PIN_ICONS_PANO: Record<string, string> = {
  equipment:"\u{1F527}",  revenue:"\u{1F4C8}",    cogs:"\u{1F4E6}",
  workflow:"\u{1F500}",   staffing:"\u{1F465}",   lease:"\u{1F3E0}",
  risk:"\u26A0",          opportunity:"\u2B50",    narration:"\u{1F3A4}",
  inspection:"\u{1F4CB}", highlight:"\u26A1",      document:"\u{1F4C4}",
  navigation:"\u21BA",    look:"\u{1F441}",        external_link:"\u{1F517}", audio:"\u{1F3B5}",
};

// Extended system icon set — used when pinIconKey is set
const SYSTEM_ICONS_PANO: Record<string, string> = {
  audio:       "\u{1F399}",  // 🎙
  info:        "\u2139",     // ℹ
  photos:      "\u{1F4F7}",  // 📷
  video:       "\u{1F3AC}",  // 🎬
  financials:  "\u{1F4C8}",  // 📈
  equipment:   "\u{1F527}",  // 🔧
  lease:       "\u{1F511}",  // 🔑
  staff:       "\u{1F465}",  // 👥
  menu:        "\u{1F4CB}",  // 📋
  outdoor:     "\u{1F33F}",  // 🌿
  entry:       "\u{1F6AA}",  // 🚪
  kitchen:     "\u{1F373}",  // 🍳
  storage:     "\u{1F4E6}",  // 📦
  pos:         "\u{1F4B3}",  // 💳
  roastery:    "\u2615",     // ☕
  fitout:      "\u{1F3D7}",  // 🏗
  seating:     "\u{1FA91}",  // 🪑
  utilities:   "\u26A1",     // ⚡
  foottraffic: "\u{1F6B6}",  // 🚶
  reviews:     "\u2B50",     // ⭐
};

// ─── Single equirectangular panorama (demo spaces or stitched panorama) ─────────
function buildSinglePanoHtml(
  panoramaUrl: string,
  startYaw: number,
  pins: TourPin[],
  tourSettings?: Pick<TourSettings, "defaultAnimation" | "defaultPinSize" | "defaultPinOpacity">,
  haov = 360,
  vaov = 120,
  groundPitch?: number,
  autoPan = false,
): string {
  const defAnim    = tourSettings?.defaultAnimation    ?? "none";
  const defSize    = tourSettings?.defaultPinSize      ?? 1.0;
  const defOpacity = tourSettings?.defaultPinOpacity   ?? 1.0;
  // groundPitch: pitch (degrees) where the floor (0 m) appears in this panorama.
  // Default -50°. Eye level (1.4 m) always maps to 0°.
  const gp = groundPitch ?? -50;

  // FLOOR_FORWARD_BIAS: shift height-based floor pins ~2 m ahead of the viewer
  // so they appear in the buyer's natural forward view rather than at nadir.
  // Full bias at 0 m, tapers to 0 at eye level (1.4 m).
  const FLOOR_FORWARD_BIAS = 18; // degrees

  const hotspots = pins.map((p) => {
    // Height-to-pitch: linear interpolation — 0 m → groundPitch, 1.4 m → 0°
    let pitch: number;
    if (p.heightMetres !== undefined) {
      const rawPitch = gp + (p.heightMetres / 1.4) * (-gp);
      const biasFraction = Math.max(0, 1 - p.heightMetres / 1.4);
      pitch = rawPitch + FLOOR_FORWARD_BIAS * biasFraction;
    } else if (p.groundMounted) {
      pitch = gp + FLOOR_FORWARD_BIAS;
    } else {
      // Tap-placed: split at eye level (y=0.5):
      //   upper half maps 0° → +90°
      //   lower half maps 0° → groundPitch (calibrated to actual floor)
      const relY = 0.5 - p.position.y;
      pitch = relY >= 0
        ? (relY / 0.5) * 90
        : (relY / 0.5) * (-gp);
    }

    // Resolve icon: system icon key > type default
    const icon =
      (p.pinIconKey ? SYSTEM_ICONS_PANO[p.pinIconKey] : undefined)
      ?? PIN_ICONS_PANO[p.type]
      ?? "\u2139";

    // Resolve animation: per-pin override > type default > global default
    const animation: string =
      p.pinAnimation
      ?? (p.type === "audio" ? "pulse" : p.type === "navigation" ? "ripple" : defAnim);

    return {
      id:        p.id,
      pitch,
      yaw:       p.position.x * 360 - 180,
      title:     p.type === 'navigation' ? p.title : p.title.split(" ").slice(0, 4).join(" "),
      color:     p.pinColor ?? PIN_COLORS[p.type] ?? "#3B82F6",
      icon,
      locked:    !!p.requiresNDA,
      isNav:     p.type === "navigation",
      isListen:  p.type === "audio",
      animation,
      size:      p.pinSize    ?? defSize,
      opacity:   p.pinOpacity ?? defOpacity,
    };
  });

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

    /* Inject a named keyframe block at most once per animation type */
    function injectKf(id, css) {
      if (!document.getElementById(id)) {
        var s = document.createElement('style');
        s.id = id; s.textContent = css;
        document.head.appendChild(s);
      }
    }

    function createPin(container, args) {
      /* IMPORTANT: never use cssText — it wipes pannellum's position:absolute.
         Set individual style properties so pannellum keeps control of left/top/position. */
      var sz   = Math.round(36 * (args.size   || 1));
      var half = sz >> 1;
      var col  = args.color;
      var anim = args.animation || 'none';
      var opac = (args.opacity != null) ? String(args.opacity) : '1';

      container.style.background   = 'transparent';
      container.style.border       = 'none';
      container.style.boxShadow    = 'none';
      container.style.borderRadius = '0';
      container.style.cursor       = 'pointer';
      container.style.overflow     = 'visible';
      container.style.opacity      = opac;

      if (anim === 'ripple') {
        if (args.isNav) {
          /* Navigation pin: arrow-in-circle with destination name label above */
          injectKf('kf-nav-float','@keyframes kfNavFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}');
          container.style.width      = '44px';
          container.style.height     = '44px';
          container.style.marginLeft = '-22px';
          container.style.marginTop  = '-22px';
          container.style.overflow   = 'visible';
          container.style.cursor     = 'pointer';
          container.innerHTML =
            '<svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="display:block;animation:kfNavFloat 2.5s ease-in-out infinite">' +
              '<circle cx="22" cy="22" r="20" fill="white" stroke="#94a3b8" stroke-width="1.5"/>' +
              '<path d="M22 29V17M15 24l7-8 7 8" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>' +
            '<div style="position:absolute;bottom:52px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.82);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;white-space:nowrap;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;max-width:120px;overflow:hidden;text-overflow:ellipsis">' + (args.label || '') + '</div>';
        } else {
          /* Non-nav ripple: 3 expanding concentric rings + small solid core */
          injectKf('kf-ripple','@keyframes kfRipple{0%{transform:scale(0.15);opacity:0.9}100%{transform:scale(4.5);opacity:0}}');
          var ringCol = col + 'cc';
          var coreCol = col;
          var W = sz + 24; var HW = W >> 1;
          container.style.width      = W + 'px';
          container.style.height     = W + 'px';
          container.style.marginLeft = '-' + HW + 'px';
          container.style.marginTop  = '-' + HW + 'px';
          var R = 'position:absolute;width:24px;height:24px;border-radius:50%;background:transparent;' +
                  'border:2.5px solid ' + ringCol + ';top:50%;left:50%;margin:-12px 0 0 -12px;' +
                  'animation-name:kfRipple;animation-duration:2s;animation-timing-function:ease-out;' +
                  'animation-iteration-count:infinite;pointer-events:none';
          var C = 'position:absolute;width:12px;height:12px;border-radius:50%;background:' + coreCol + ';' +
                  'top:50%;left:50%;margin:-6px 0 0 -6px;z-index:2;box-shadow:0 0 8px 3px ' + coreCol + '88';
          container.innerHTML =
            '<div style="' + R + ';animation-delay:0s"></div>' +
            '<div style="' + R + ';animation-delay:0.67s"></div>' +
            '<div style="' + R + ';animation-delay:1.33s"></div>' +
            '<div style="' + C + '"></div>';
        }

      } else if (anim === 'pulse') {
        /* Listen / pulse: 3 rings + icon core */
        injectKf('kf-pulse','@keyframes kfPulse{0%{transform:scale(0.15);opacity:0.9}100%{transform:scale(4.5);opacity:0}}');
        var listenRingCol = args.isListen ? 'rgba(236,72,153,0.9)' : col + 'cc';
        var listenCore    = args.isListen ? '#EC4899' : col;
        var W2 = sz + 24; var HW2 = W2 >> 1;
        container.style.width      = W2 + 'px';
        container.style.height     = W2 + 'px';
        container.style.marginLeft = '-' + HW2 + 'px';
        container.style.marginTop  = '-' + HW2 + 'px';
        var LR = 'position:absolute;width:24px;height:24px;border-radius:50%;background:transparent;' +
                 'border:2.5px solid ' + listenRingCol + ';top:50%;left:50%;margin:-12px 0 0 -12px;' +
                 'animation-name:kfPulse;animation-duration:2s;animation-timing-function:ease-out;' +
                 'animation-iteration-count:infinite;pointer-events:none';
        var micSz = Math.round(sz * 0.55);
        var LC = 'position:absolute;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + listenCore + ';' +
                 'top:50%;left:50%;margin:-' + half + 'px 0 0 -' + half + 'px;z-index:2;' +
                 'box-shadow:0 0 8px 3px ' + listenCore + '88;' +
                 'display:flex;align-items:center;justify-content:center;' +
                 'font-size:' + micSz + 'px;line-height:1;text-align:center';
        var micIcon = args.icon;
        container.innerHTML =
          '<div style="' + LR + ';animation-delay:0s"></div>' +
          '<div style="' + LR + ';animation-delay:0.67s"></div>' +
          '<div style="' + LR + ';animation-delay:1.33s"></div>' +
          '<div style="' + LC + '">' + micIcon + '</div>';

      } else {
        /* Standard solid-circle pin with optional named animation */
        var iconSz = Math.round(sz * 0.55);
        container.style.width          = sz + 'px';
        container.style.height         = sz + 'px';
        container.style.borderRadius   = '50%';
        container.style.display        = 'flex';
        container.style.alignItems     = 'center';
        container.style.justifyContent = 'center';
        container.style.fontSize       = iconSz + 'px';
        container.style.lineHeight     = '1';
        container.style.boxShadow      = '0 3px 12px rgba(0,0,0,0.7)';
        container.style.border         = '2px solid rgba(255,255,255,0.35)';
        container.style.background     = col;
        container.style.marginLeft     = '-' + half + 'px';
        container.style.marginTop      = '-' + half + 'px';
        container.innerHTML = args.icon;

        if (anim === 'glow') {
          injectKf('kf-glow','@keyframes kfGlow{0%,100%{filter:brightness(1) drop-shadow(0 0 3px rgba(255,255,255,0.25))}50%{filter:brightness(1.8) drop-shadow(0 0 10px rgba(255,255,255,0.65))}}');
          container.style.animation = 'kfGlow 2s ease-in-out infinite';
        } else if (anim === 'bounce') {
          injectKf('kf-bounce','@keyframes kfBounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.08)}}');
          container.style.animation = 'kfBounce 1.4s ease-in-out infinite';
        } else if (anim === 'breathing') {
          injectKf('kf-breathing','@keyframes kfBreathing{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:0.55}}');
          container.style.animation = 'kfBreathing 2.8s ease-in-out infinite';
        }
      }

      ['touchend','click'].forEach(function(ev) {
        container.addEventListener(ev, function(e) {
          e.stopPropagation(); e.preventDefault();
          if (window.ReactNativeWebView)
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pinTap', id: args.id }));
        });
      });
    }

    var viewer = pannellum.viewer('pano', {
      type: 'equirectangular', panorama: '${panoramaUrl}',
      haov: ${haov}, vaov: ${vaov},
      autoLoad: true, showControls: false, compass: false,
      yaw: ${startYaw}, pitch: 0, hfov: 100, minHfov: 40, maxHfov: 140,
      mouseZoom: true, touchPanSpeedCoeffFactor: 1.5, showFullscreenCtrl: false,
      autoRotate: ${autoPan ? -2 : 0},
      hotSpots: PINS.map(function(p) {
        return {
          id: p.id, pitch: p.pitch, yaw: p.yaw,
          type: 'custom', cssClass: '',
          createTooltipFunc: createPin,
          createTooltipArgs: {
            id: p.id, label: p.title, icon: p.icon, color: p.color,
            locked: p.locked, isNav: p.isNav, isListen: p.isListen,
            animation: p.animation, size: p.size, opacity: p.opacity
          }
        };
      })
    });
    setInterval(function() {
      if (window.ReactNativeWebView) {
        var raw = viewer.getYaw();
        var normalized = ((raw % 360) + 360) % 360;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'yaw', yaw: Math.round(normalized) }));
      }
    }, 200);
  </script>
</body></html>`;
}

// ─── Flat single-image panorama viewer — no spherical distortion ─────────────
// Used for stitched panoramas from phone photos (file:// URIs converted to data URIs).
// Renders image at full viewport height, allows horizontal pan + pinch-zoom.
function buildFlatPanoHtml(panoSrc: string, pins: TourPin[]): string {
  const pinsData = pins.map((p) => ({
    id: p.id,
    posX: p.position.x,
    posY: p.position.y,
    title: p.title.split(" ").slice(0, 3).join(" "),
    color: PIN_COLORS[p.type] ?? "#3B82F6",
    icon: PIN_ICONS[p.type] ?? "&#8505;",
    locked: !!p.requiresNDA,
  }));

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;background:#000;touch-action:none}
#outer{width:100vw;height:100vh;overflow:hidden;background-repeat:repeat-x;background-position:0 0;background-size:auto 100vh}
.pin{position:fixed;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;pointer-events:auto;user-select:none;-webkit-user-select:none;z-index:10}
#hint{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);color:rgba(255,255,255,0.7);padding:5px 16px;border-radius:20px;font:13px -apple-system,system-ui,sans-serif;pointer-events:none;z-index:10;opacity:1;transition:opacity 1s}
</style>
</head><body>
<div id="outer"></div>
<div id="hint">← Swipe to pan →</div>
<script>
var PINS=${JSON.stringify(pinsData)};
var VW=window.innerWidth,VH=window.innerHeight;
// bgX can be any value — CSS repeat-x handles the tiling seamlessly
var bgX=0,ty=0,sc=1,imgW=VW;
var raf=null,drag=null,pinch=null,lastTap=0;
var outer=document.getElementById('outer');

setTimeout(function(){document.getElementById('hint').style.opacity='0';},2500);

// Load image dimensions without re-fetching (browser caches data URIs by reference)
var _dim=new Image();
_dim.onload=function(){
  imgW=_dim.naturalWidth*(VH/_dim.naturalHeight);
  render();
};
_dim.src='${panoSrc}';

// Set background image once (separate from dimensions load)
outer.style.backgroundImage="url('${panoSrc}')";

function applyTransform(){
  var totalW=imgW*sc;
  outer.style.backgroundSize=totalW+'px '+(VH*sc*1.2)+'px';
  outer.style.backgroundPosition=bgX+'px '+(ty-VH*sc*0.1)+'px';
}

function clampTy(y,s){return Math.max(VH*(1-s*1.1),Math.min(VH*s*0.1,y));}

function updatePins(){
  var totalW=imgW*sc;
  PINS.forEach(function(p,j){
    // Wrap rawX into [0, totalW) so the pin always appears on the visible repeat
    var rawX=p.posX*totalW+bgX;
    var screenX=((rawX%totalW)+totalW)%totalW;
    var py=p.posY*VH*sc+ty;
    var vis=screenX<VW+160&&py>0&&py<VH;
    pinEls[j].style.display=vis?'flex':'none';
    if(vis){pinEls[j].style.left=screenX+'px';pinEls[j].style.top=py+'px';}
  });
}

function render(){applyTransform();updatePins();}

// Momentum — bgX is free (no X clamping), CSS repeat handles edges
function coast(vx){
  if(raf){cancelAnimationFrame(raf);raf=null;}
  var t0=performance.now();
  var decel=0.92;
  function step(now){
    var dt=Math.min(now-t0,64);t0=now;
    vx*=Math.pow(decel,dt/16.7);
    bgX+=vx*dt;
    render();
    if(Math.abs(vx)>0.01&&raf!==null)raf=requestAnimationFrame(step);
    else raf=null;
  }
  raf=requestAnimationFrame(step);
}

// Build pin elements (appended to body, not outer, so outer touches don't block them)
var pinEls=PINS.map(function(p){
  var el=document.createElement('div');
  el.className='pin';
  el.style.background=p.color;
  el.innerHTML=p.icon+(p.locked?'<span style="position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;font-size:8px">\uD83D\uDD12</span>':'');
  el.addEventListener('touchend',function(e){
    e.stopPropagation();e.preventDefault();
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:p.id}));
  });
  el.addEventListener('click',function(e){
    e.stopPropagation();
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:p.id}));
  });
  document.body.appendChild(el);
  return el;
});

function ptDist(a,b){var dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy);}

outer.addEventListener('touchstart',function(e){
  if(raf){cancelAnimationFrame(raf);raf=null;}
  var ts=Array.from(e.touches);
  if(ts.length===1){
    var now=Date.now();
    if(now-lastTap<280){
      e.preventDefault();lastTap=0;
      if(sc>1.1){sc=1;ty=0;}
      else{
        var nsc=2.5,px=ts[0].clientX,py=ts[0].clientY;
        bgX=px-(px-bgX)/sc*nsc;
        ty=py-(py-ty)/sc*nsc;
        sc=nsc;ty=clampTy(ty,sc);
      }
      render();drag=null;pinch=null;return;
    }
    lastTap=now;
    drag={stBgX:bgX,sty:ty,x0:ts[0].clientX,y0:ts[0].clientY,lx:ts[0].clientX,t:Date.now(),vx:0};
    pinch=null;
  } else if(ts.length>=2){
    drag=null;
    pinch={stBgX:bgX,sty:ty,ssc:sc,d0:ptDist(ts[0],ts[1]),mx0:(ts[0].clientX+ts[1].clientX)/2,my0:(ts[0].clientY+ts[1].clientY)/2};
  }
},{passive:false});

outer.addEventListener('touchmove',function(e){
  e.preventDefault();
  var ts=Array.from(e.touches);
  if(ts.length===1&&drag){
    var now=Date.now(),dt=Math.max(1,now-drag.t);
    drag.vx=(ts[0].clientX-drag.lx)/dt;
    drag.lx=ts[0].clientX;drag.t=now;
    bgX=drag.stBgX+(ts[0].clientX-drag.x0); // free — no X clamp
    if(sc>1.05)ty=clampTy(drag.sty+(ts[0].clientY-drag.y0),sc);
    render();
  } else if(ts.length>=2&&pinch){
    var d=ptDist(ts[0],ts[1]);
    var mx=(ts[0].clientX+ts[1].clientX)/2,my=(ts[0].clientY+ts[1].clientY)/2;
    var nsc=Math.max(1,Math.min(5,pinch.ssc*d/pinch.d0));
    bgX=pinch.mx0-(pinch.mx0-pinch.stBgX)/pinch.ssc*nsc+(mx-pinch.mx0);
    ty=pinch.my0-(pinch.my0-pinch.sty)/pinch.ssc*nsc+(my-pinch.my0);
    sc=nsc;ty=clampTy(ty,sc);render();
  }
},{passive:false});

outer.addEventListener('touchend',function(e){
  var ts=Array.from(e.touches);
  if(ts.length===0){
    if(drag)coast(drag.vx);
    drag=null;
  } else if(ts.length===1&&pinch){
    pinch=null;
    drag={stBgX:bgX,sty:ty,x0:ts[0].clientX,y0:ts[0].clientY,lx:ts[0].clientX,t:Date.now(),vx:0};
  }
},{passive:true});

render();
</script>
</body></html>`;
}

// ─── Flat strip viewer — no spherical projection, swipe/pinch/zoom ─────────────
function buildFlatStripHtml(photos: string[], pins: TourPin[]): string {
  const N = photos.length;
  const dirLabels = N >= 8 ? DIR_8 : DIR_4;

  const pinsData = pins.map((p) => ({
    id: p.id,
    posX: p.position.x,
    posY: p.position.y,
    title: p.title.split(" ").slice(0, 3).join(" "),
    color: PIN_COLORS[p.type] ?? "#3B82F6",
    icon: PIN_ICONS[p.type] ?? "&#8505;",
    locked: !!p.requiresNDA,
    sceneIdx: Math.floor(p.position.x * N),
    relX: p.position.x * N - Math.floor(p.position.x * N),
  }));

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;background:#000;touch-action:none}
#outer{position:relative;width:100vw;height:100vh;overflow:hidden}
#wrap{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}
#strip{display:flex;height:100vh}
.frame{flex-shrink:0;width:100vw;height:100vh;overflow:hidden;position:relative}
.photo{position:absolute;top:-10%;left:-5%;width:110%;height:120%;object-fit:cover;pointer-events:none;user-select:none;-webkit-user-select:none}
#lbl{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:6px 20px;border-radius:22px;font:700 14px -apple-system,system-ui,sans-serif;pointer-events:none;white-space:nowrap;z-index:10}
#dots{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);display:flex;gap:7px;pointer-events:none;z-index:10}
.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);transition:background .2s,transform .2s}
.dot.on{background:#3B82F6;transform:scale(1.5)}
.pin{position:fixed;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;pointer-events:auto;user-select:none;-webkit-user-select:none;z-index:10}
</style>
</head><body>
<div id="outer"><div id="wrap"><div id="strip"></div></div></div>
<div id="lbl">Front</div>
<div id="dots"></div>
<script>
var N=${N},PHOTOS=${JSON.stringify(photos)},PINS=${JSON.stringify(pinsData)},LABELS=${JSON.stringify(dirLabels)};
var VW=window.innerWidth,VH=window.innerHeight;

// Build strip: 3 sets for seamless wrap
var strip=document.getElementById('strip');
for(var r=0;r<3;r++) for(var i=0;i<N;i++){
  var fr=document.createElement('div');fr.className='frame';
  var img=document.createElement('img');
  img.className='photo'; img.src=PHOTOS[i]; img.draggable=false;
  fr.appendChild(img);strip.appendChild(fr);
}

// Dots
var dotRow=document.getElementById('dots');
for(var i=0;i<N;i++){var d=document.createElement('div');d.className='dot'+(i===0?' on':'');dotRow.appendChild(d);}
var dots=dotRow.children;

// Pin buttons
var pinEls=PINS.map(function(p){
  var el=document.createElement('div');
  el.className='pin';
  el.style.background=p.color;
  el.innerHTML=p.icon+(p.locked?'<span style="position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;font-size:8px">\uD83D\uDD12</span>':'');
  el.addEventListener('touchend',function(e){e.stopPropagation();e.preventDefault();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:p.id}));});
  el.addEventListener('click',function(e){e.stopPropagation();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:p.id}));});
  document.body.appendChild(el);
  return el;
});

var wrap=document.getElementById('wrap');
// tx: strip translate (negative = scrolled right into strip)
// starts at middle set, photo 0 visible
var tx=-(N*VW), ty=0, sc=1;
var raf=null;

function mod(a,b){return((a%b)+b)%b;}

function currentIdx(){return mod(Math.round(-tx/VW),N);}

function applyTransform(){
  wrap.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+sc+')';
}

function updateHud(){
  var idx=currentIdx();
  document.getElementById('lbl').textContent=LABELS[idx]||'';
  for(var i=0;i<dots.length;i++) dots[i].className='dot'+(i===idx?' on':'');
}

function updatePins(){
  PINS.forEach(function(p,j){
    // Check all 3 strip sets for visibility
    var found=false;
    [0,N,2*N].forEach(function(off){
      if(found) return;
      var sx=(off+p.sceneIdx+p.relX)*VW*sc+tx;
      var sy=p.posY*VH*sc+ty;
      if(sx>-150&&sx<VW+150&&sy>0&&sy<VH){
        found=true;
        pinEls[j].style.display='flex';
        pinEls[j].style.left=sx+'px';
        pinEls[j].style.top=sy+'px';
      }
    });
    if(!found) pinEls[j].style.display='none';
  });
}

function render(){
  applyTransform(); updateHud(); updatePins();
}

// Clamp tx so no black edges when sc>1
function clampPan(){
  if(sc<=1){ty=0;return;}
  var maxTy=0, minTy=VH*(1-sc);
  ty=Math.max(minTy,Math.min(maxTy,ty));
}

// Seamless wrap (instant, no animation)
function maybeWrap(){
  var rawX=-tx;
  if(rawX<N*VW) tx-=N*VW;
  else if(rawX>=2*N*VW) tx+=N*VW;
}

function animateTo(targetTx,ms,onDone){
  if(raf){cancelAnimationFrame(raf);raf=null;}
  var s0=tx,t0=performance.now();
  function step(now){
    var t=Math.min((now-t0)/ms,1);
    t=1-Math.pow(1-t,3); // ease-out cubic
    tx=s0+(targetTx-s0)*t;
    clampPan(); render();
    if(t<1){raf=requestAnimationFrame(step);}
    else{tx=targetTx;maybeWrap();clampPan();render();raf=null;if(onDone)onDone();}
  }
  raf=requestAnimationFrame(step);
}

function snapTo(velPxMs){
  // velPxMs: px/ms of finger velocity (positive = finger moved right)
  var rawX=-tx;
  // Momentum capped at 3 photos max to prevent wild spin on fast flick
  var momentum=Math.max(-3*VW,Math.min(3*VW,velPxMs*280));
  var projected=rawX-momentum;
  var targetRawX=Math.round(projected/VW)*VW;
  // Keep in middle set
  while(targetRawX<N*VW) targetRawX+=N*VW;
  while(targetRawX>=2*N*VW) targetRawX-=N*VW;
  var dist=Math.abs(targetRawX+tx);
  var ms=Math.min(420,Math.max(180,dist/VW*260));
  animateTo(-targetRawX,ms);
}

// ── Touch state ──
var drag=null, pinch=null, lastTap=0;

function touchList(e){return Array.from(e.touches);}
function ptDist(a,b){var dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy);}

document.getElementById('outer').addEventListener('touchstart',function(e){
  var ts=touchList(e);
  if(raf){cancelAnimationFrame(raf);raf=null;}

  if(ts.length===1){
    // Double-tap detection
    var now=Date.now();
    if(now-lastTap<280){
      e.preventDefault();
      lastTap=0;
      if(sc>1.1){
        // Reset zoom — snap to current photo
        var targetRawX=Math.round(-tx/VW)*VW;
        while(targetRawX<N*VW) targetRawX+=N*VW;
        while(targetRawX>=2*N*VW) targetRawX-=N*VW;
        sc=1;ty=0;tx=-targetRawX;render();
      } else {
        // Zoom 2.5x around tap point
        var px=ts[0].clientX,py=ts[0].clientY;
        var sx=(px-tx)/sc,sy=(py-ty)/sc;
        sc=2.5;tx=px-sx*sc;ty=py-sy*sc;
        clampPan();render();
      }
      drag=null;pinch=null;return;
    }
    lastTap=now;
    drag={stx:tx,sty:ty,x0:ts[0].clientX,y0:ts[0].clientY,lx:ts[0].clientX,ly:ts[0].clientY,vx:0,t:Date.now()};
    pinch=null;

  } else if(ts.length>=2){
    drag=null;
    pinch={stx:tx,sty:ty,ssc:sc,d0:ptDist(ts[0],ts[1]),mx0:(ts[0].clientX+ts[1].clientX)/2,my0:(ts[0].clientY+ts[1].clientY)/2};
  }
},{passive:false});

document.getElementById('outer').addEventListener('touchmove',function(e){
  e.preventDefault();
  var ts=touchList(e);

  if(ts.length===1&&drag){
    var now=Date.now(),dt=Math.max(1,now-drag.t);
    drag.vx=(ts[0].clientX-drag.lx)/dt;
    drag.lx=ts[0].clientX;drag.t=now;
    var dx=ts[0].clientX-drag.x0,dy=ts[0].clientY-drag.y0;
    tx=drag.stx+dx;
    if(sc>1.05) ty=drag.sty+dy;
    else ty=0;
    render();

  } else if(ts.length>=2&&pinch){
    var d=ptDist(ts[0],ts[1]);
    var mx=(ts[0].clientX+ts[1].clientX)/2,my=(ts[0].clientY+ts[1].clientY)/2;
    var newSc=Math.max(1,Math.min(5,pinch.ssc*d/pinch.d0));
    // Keep pinch pivot fixed + pan from mid movement
    var sx=(pinch.mx0-pinch.stx)/pinch.ssc,sy=(pinch.my0-pinch.sty)/pinch.ssc;
    tx=pinch.mx0-sx*newSc+(mx-pinch.mx0);
    ty=pinch.my0-sy*newSc+(my-pinch.my0);
    sc=newSc;clampPan();render();
  }
},{passive:false});

document.getElementById('outer').addEventListener('touchend',function(e){
  var ts=touchList(e);
  if(ts.length===0){
    if(sc<=1.05){sc=1;ty=0;if(drag)snapTo(drag.vx);drag=null;}
    else{drag=null;}
    pinch=null;
  } else if(ts.length===1&&pinch){
    pinch=null;
    drag={stx:tx,sty:ty,x0:ts[0].clientX,y0:ts[0].clientY,lx:ts[0].clientX,ly:ts[0].clientY,vx:0,t:Date.now()};
  }
},{passive:true});

render();
</script>
</body></html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  space: TourSpace;
  onPinPress: (pin: TourPin) => void;
  focusPin?: TourPin | null;
  onFocusPinHandled?: () => void;
  tourSettings?: TourSettings;
  onYawChange?: (deg: number) => void;
  startYaw?: number;
}

export function PanoramaViewer({ space, onPinPress, focusPin, onFocusPinHandled, tourSettings, onYawChange, startYaw }: Props) {
  const webRef = useRef<WebView>(null);

  const isLocalPano = !!space.panoramaUrl && space.panoramaUrl.startsWith("file://");

  // panoDataUri: null = still loading, string = ready (data URI or https:// URL)
  // Only used when space.panoramaUrl is set.
  const [panoDataUri, setPanoDataUri] = useState<string | null>(
    // Remote https:// URLs need no conversion — mark ready immediately
    space.panoramaUrl && !isLocalPano ? space.panoramaUrl : null
  );

  // For flat strip viewer: convert local file:// photos to base64 data URIs
  const [photoDataUris, setPhotoDataUris] = useState<string[] | null>(
    space.panoramaUrl ? [] : null
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load local panorama as base64 data URI ──────────────────────────────────
  // file:// URIs inside injected WebView HTML are blocked by iOS/Android sandbox
  // regardless of allowFileAccess / allowingReadAccessToURL — the only reliable
  // approach in Expo Go is a data URI. We guard on file size first.
  useEffect(() => {
    if (!isLocalPano || !space.panoramaUrl) return;

    let cancelled = false;
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(space.panoramaUrl!);
        if (!info.exists) {
          if (!cancelled) setLoadError("Panorama file not found.\n\nDelete this space and re-upload the photo.");
          return;
        }
        const sizeMb = ("size" in info && info.size) ? info.size / (1024 * 1024) : 0;
        if (sizeMb > 25) {
          if (!cancelled) setLoadError(
            `Panorama is ${sizeMb.toFixed(0)} MB — too large to preview.\n\n` +
            "Please export a compressed version (under 25 MB) from your camera app and re-upload."
          );
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(space.panoramaUrl!, {
          encoding: "base64",
        });
        if (!cancelled) setPanoDataUri(`data:image/jpeg;base64,${base64}`);
      } catch {
        // fetch() fallback — file:// URIs can go stale but fetch may still resolve them
        try {
          const resp = await fetch(space.panoramaUrl!);
          if (resp.ok) {
            const blob = await resp.blob();
            const dataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            if (!cancelled) setPanoDataUri(dataUri);
            return;
          }
        } catch { /* fall through to error */ }
        if (!cancelled) setLoadError("Could not load panorama file.\n\nTry deleting and re-uploading the photo.");
      }
    })();
    return () => { cancelled = true; };
  }, [space.id, space.panoramaUrl]);

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
      } else if (data.type === "yaw" && typeof data.yaw === "number") {
        onYawChange?.(data.yaw);
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

  // ── Loading: local panorama → base64 ──
  if (space.panoramaUrl && isLocalPano && panoDataUri === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading panorama…</Text>
        <Text style={styles.loadingHint}>This may take a moment for large files</Text>
      </View>
    );
  }

  // ── Loading: flat strip photos → base64 ──
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
  // Panoramas (single equirectangular) → pannellum spherical viewer.
  // Local files are converted to base64 data URIs (works in Expo Go sandbox).
  // Remote https:// URLs passed directly. vaov=180 for full Insta360 spheres.
  let html: string;
  const effectiveAutoPan = !!(tourSettings && (tourSettings as any).autoPanAll) || !!space.autoPan;
  if (space.panoramaUrl && panoDataUri) {
    html = buildSinglePanoHtml(panoDataUri, startYaw ?? space.defaultYaw ?? space.panoramaStartYaw ?? 0, space.pins, tourSettings, 360, 180, space.groundPitch, effectiveAutoPan);
  } else {
    html = buildFlatStripHtml(photoDataUris, space.pins);
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
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "#071221",
  },
});
