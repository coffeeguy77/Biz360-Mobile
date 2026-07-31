import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

export interface TourPin {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  targetSpaceId?: string;
  targetYaw?: number;
  audioUrl?: string;
  audioName?: string;
}

export interface TourSpace {
  id: string;
  name: string;
  panoramaUrl: string;
  isStartScene?: boolean;
  autoPan?: boolean;
  audioUrl?: string;
  audioName?: string;
  groundPitch?: number;
  panoramaStartYaw?: number;
  defaultYaw?: number;
  pins: TourPin[];
}

/** Build the Pannellum multi-scene srcDoc with nav-pin + audio hotspots baked in. */
export function buildMultiSceneSrcdoc(spaces: TourSpace[], autoPanAll = false): string {
  const spacesJson = JSON.stringify(spaces);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<script>(function(){var _I=window.Image;window.Image=function(w,h){var i=typeof w!='undefined'?new _I(w,h):new _I();i.crossOrigin='anonymous';return i};window.Image.prototype=_I.prototype;Object.defineProperty(window.Image,'prototype',{value:_I.prototype})})();<\/script>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\/script>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
  #pano{position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none;background:#000}
  @keyframes kfNavFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  .nav-pin-label{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.82);color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;white-space:nowrap;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;max-width:130px;overflow:hidden;text-overflow:ellipsis}
  .pnlm-hotspot.pnlm-nav-pin-wrap{background:transparent!important;border:none!important;box-shadow:none!important;width:44px!important;height:44px!important;overflow:visible!important;margin-left:-22px!important;margin-top:-22px!important}
  .pnlm-hotspot.pnlm-nav-pin-wrap::before{display:none!important}
  .pnlm-audio-hs{width:32px;height:32px;background:rgba(16,163,74,0.85);border:2px solid rgba(255,255,255,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;box-shadow:0 0 0 4px rgba(16,163,74,0.2);transition:background .2s;user-select:none}
  .pnlm-audio-hs:hover{background:rgba(16,163,74,1)}
  .pnlm-audio-hs.active{background:#ea580c;box-shadow:0 0 0 6px rgba(234,88,12,0.3)}
  .pnlm-audio-hs-tooltip{position:absolute;bottom:38px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;font-size:11px;font-weight:500;padding:4px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}
  .pnlm-audio-hs:hover .pnlm-audio-hs-tooltip{opacity:1}
</style>
</head>
<body>
<div id="pano"></div>
<script>
var SPACES=${spacesJson};
function xToYaw(x){return(x-0.5)*360}
function yToPitch(y){return(0.5-y)*180}
function createNavPin(container,args){
  container.style.cssText='width:44px;height:44px;overflow:visible;position:relative;cursor:pointer';
  container.innerHTML=
    '<svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="display:block;animation:kfNavFloat 2.5s ease-in-out infinite">'+
      '<circle cx="22" cy="22" r="20" fill="white" stroke="#94a3b8" stroke-width="1.5"/>'+
      '<path d="M22 29V17M15 24l7-8 7 8" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
    '</svg>';
  var label=document.createElement('span');
  label.className='nav-pin-label';
  label.textContent=args.label;
  container.appendChild(label);
  container.addEventListener('click',function(e){
    e.stopPropagation();
    try{
      var resolvedYaw=typeof args.targetYaw==='number'?args.targetYaw:null;
      viewer.loadScene(args.sceneId,null,resolvedYaw,null);
    }catch(err){}
  });
}
function createAudioHotspot(div,args){
  div.classList.add('pnlm-audio-hs');
  div.innerHTML='🔊<span class="pnlm-audio-hs-tooltip">'+args.name+'</span>';
  var audio=null,playing=false;
  div.addEventListener('click',function(e){
    e.stopPropagation();
    if(!audio)audio=new Audio(args.url);
    if(playing){audio.pause();playing=false;div.classList.remove('active')}
    else{audio.play().catch(function(){});playing=true;div.classList.add('active');audio.onended=function(){playing=false;div.classList.remove('active')}}
  });
}
var AUTOPAN_ALL=${autoPanAll ? "true" : "false"};
var validIds=new Set(SPACES.filter(function(s){return s.panoramaUrl&&s.panoramaUrl.indexOf('file://')!==0}).map(function(s){return s.id}));
var firstScene=null,scenesConfig={};
SPACES.forEach(function(s){
  if(!validIds.has(s.id))return;
  if(!firstScene)firstScene=s.id;
  if(s.isStartScene)firstScene=s.id;
  var hotSpots=[];
  (s.pins||[]).forEach(function(pin){
    if(pin.type==='navigation'&&validIds.has(pin.targetSpaceId)){
      hotSpots.push({pitch:40,yaw:xToYaw(pin.position.x),type:'custom',cssClass:'pnlm-nav-pin-wrap',createTooltipFunc:createNavPin,createTooltipArgs:{sceneId:pin.targetSpaceId,label:pin.title,targetYaw:typeof pin.targetYaw==='number'?pin.targetYaw:null}});
    } else if(pin.type==='audio'&&pin.audioUrl){
      hotSpots.push({pitch:Math.max(10,yToPitch(pin.position.y)),yaw:xToYaw(pin.position.x),type:'custom',text:pin.title,cssClass:'pnlm-audio-hs-wrap',createTooltipFunc:createAudioHotspot,createTooltipArgs:{url:pin.audioUrl,name:pin.audioName||pin.title}});
    }
  });
  var sc={type:'equirectangular',panorama:s.panoramaUrl,title:s.name,hotSpots:hotSpots,pitch:0,yaw:typeof s.defaultYaw==='number'?s.defaultYaw:(typeof s.panoramaStartYaw==='number'?s.panoramaStartYaw:0)};
  if(typeof s.groundPitch==='number')sc.groundPitch=s.groundPitch;
  scenesConfig[s.id]=sc;
});
var userInteracted=false;
var viewer=pannellum.viewer('pano',{default:{firstScene:firstScene,sceneFadeDuration:800,autoLoad:true,showFullscreenCtrl:false,showZoomCtrl:true,compass:false,friction:0.15,hfov:100,pitch:0,yaw:0,minHfov:50,maxHfov:150},scenes:scenesConfig});
(function(){
  var panoEl=document.getElementById('pano');
  function markInteracted(){userInteracted=true;}
  if(panoEl){
    panoEl.addEventListener('mousedown',markInteracted,{once:true,capture:true});
    panoEl.addEventListener('touchstart',markInteracted,{once:true,capture:true,passive:true});
  }
  var sp0=SPACES.find(function(s){return s.id===firstScene});
  if(AUTOPAN_ALL||(sp0&&sp0.autoPan)){try{viewer.startAutoRotate(-2)}catch(e){}}
})();
function doResize(){try{viewer.resize()}catch(e){}}
window.addEventListener('load',function(){setTimeout(doResize,50);setTimeout(doResize,300)});
window.addEventListener('resize',doResize);
viewer.on('scenechange',function(id){
  try{window.parent.postMessage({type:'pano_sceneChange',sceneId:id},'*')}catch(e){}
  if(userInteracted)return;
  var scSp=SPACES.find(function(s){return s.id===id});
  if(AUTOPAN_ALL||(scSp&&scSp.autoPan)){try{viewer.startAutoRotate(-2)}catch(e){}}
  else{try{viewer.stopAutoRotate()}catch(e){}}
});
window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='pano_goto'&&e.data.sceneId)try{
    var gotoSp=SPACES.find(function(s){return s.id===e.data.sceneId});
    var gotoYaw=typeof e.data.yaw==='number'?e.data.yaw:(gotoSp&&typeof gotoSp.defaultYaw==='number'?gotoSp.defaultYaw:(gotoSp&&typeof gotoSp.panoramaStartYaw==='number'?gotoSp.panoramaStartYaw:0));
    viewer.loadScene(e.data.sceneId,0,gotoYaw,100);
  }catch(e2){}
});
<\/script>
</body>
</html>`;
}

/**
 * Self-contained interactive 360° tour: Pannellum panorama with clickable
 * nav-pin + audio hotspots, plus a thumbnail strip to jump between spaces.
 */
export function InteractiveTour({ spaces, autoPanAll = false }: { spaces: TourSpace[]; autoPanAll?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const valid = spaces.filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"));

  useEffect(() => {
    const start = valid.find((s) => s.isStartScene) ?? valid[0];
    if (start) setActiveId(start.id);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "pano_sceneChange" && e.data.sceneId) setActiveId(e.data.sceneId);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces]);

  if (!valid.length) return null;
  const srcdoc = buildMultiSceneSrcdoc(spaces, autoPanAll);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-black border border-[#1E3A5C]" style={{ height: "clamp(360px, 58vw, 580px)", touchAction: "none" }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          className="w-full h-full border-0"
          title="360° Business Walkthrough"
          allow="fullscreen"
        />
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 pointer-events-none">
          <Camera size={11} className="text-blue-400" />
          {valid.length} spaces
        </div>
      </div>

      {/* Thumbnail strip — click to jump to a space */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {valid.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveId(s.id);
              iframeRef.current?.contentWindow?.postMessage({ type: "pano_goto", sceneId: s.id }, "*");
            }}
            className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
              s.id === activeId
                ? "border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.45)] scale-[1.03]"
                : "border-transparent opacity-55 hover:opacity-85"
            }`}
            style={{ width: 96, height: 60 }}
            title={s.name}
          >
            <img src={s.panoramaUrl} alt={s.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-1">
              <span className="text-white text-[9px] font-medium leading-tight line-clamp-2">{s.name}</span>
            </div>
            {s.audioUrl && (
              <div className="absolute top-1 right-1 bg-green-500/80 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">🔊</div>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-blue-500/80" />Navigate to space</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-green-500/80" />Audio narration</span>
      </div>
    </div>
  );
}
