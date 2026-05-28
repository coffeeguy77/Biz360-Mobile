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

// ─── Single equirectangular panorama (demo spaces or stitched panorama) ─────────
function buildSinglePanoHtml(
  panoramaUrl: string,
  startYaw: number,
  pins: TourPin[],
  haov = 360,
  vaov = 120,
): string {
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
      container.style.cssText = 'background:'+args.color+';width:38px;height:38px;border-radius:50%;position:relative;display:inline-flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.3);cursor:pointer;user-select:none;transform:translateY(-50%);flex-shrink:0';
      container.innerHTML = args.icon+(args.locked?'<span style="position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;font-size:8px">&#128274;</span>':'');
      ['touchend','click'].forEach(function(ev){container.addEventListener(ev,function(e){e.stopPropagation();e.preventDefault();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinTap',id:args.id}));});});
    }
    pannellum.viewer('pano',{
      type:'equirectangular', panorama:'${panoramaUrl}',
      haov:${haov}, vaov:${vaov},
      autoLoad:true, showControls:false, compass:false,
      yaw:${startYaw}, pitch:0, hfov:Math.min(80,${haov}*0.55), minHfov:30, maxHfov:Math.min(130,${haov}),
      mouseZoom:true, touchPanSpeedCoeffFactor:1.5, showFullscreenCtrl:false,
      hotSpots:PINS.map(function(p){return{id:p.id,pitch:p.pitch,yaw:p.yaw,type:'custom',cssClass:'',createTooltipFunc:createPin,createTooltipArgs:{id:p.id,label:p.title,icon:p.icon,color:p.color,locked:p.locked}};})
    });
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
}

export function PanoramaViewer({ space, onPinPress, focusPin, onFocusPinHandled }: Props) {
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
  // ALL panoramas use the flat pan viewer. Local files are passed as
  // base64 data URIs (the only approach that works in Expo Go's sandbox).
  // Remote https:// URLs are passed directly — no conversion needed.
  let html: string;
  if (space.panoramaUrl && panoDataUri) {
    html = buildFlatPanoHtml(panoDataUri, space.pins);
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
