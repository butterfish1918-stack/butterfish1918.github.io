(()=>{
  'use strict';
  const BUILD='0.6.4';
  const bust='?wr064=20260913b';
  const bootBadge=document.createElement('div');
  bootBadge.id='wr-build-badge';
  bootBadge.textContent='0.6.4 · PERSISTENT VILLAGE BUILD';
  bootBadge.style.cssText='position:fixed;right:10px;bottom:10px;z-index:99999;background:#1b1d18;color:#ddd9c9;border:1px solid #8d8060;padding:6px 8px;font:10px monospace;letter-spacing:.08em;pointer-events:none;opacity:.88';
  document.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById('wr-build-badge'))document.body.appendChild(bootBadge)});
  if(document.body)document.body.appendChild(bootBadge);

  Promise.all([
    fetch('../winter-registry/v03.js'+bust,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('v03 '+r.status);return r.text()}),
    fetch('../winter-registry/v05-render.txt'+bust,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('render '+r.status);return r.text()})
  ]).then(([src,render])=>{
    src=src
      .replace("const SAVE_KEY='winterRegistrySave_v03';","const SAVE_KEY='winterRegistrySave_v062';")
      .replace("const TUTORIAL_KEY='winterRegistryTutorial_v03';","const TUTORIAL_KEY='winterRegistryTutorial_v062';")
      .replace('return{version:3,seed','return{version:62,seed')
      .replace('if(state.version!==3)return false','if(state.version!==62)return false')
      .replace('No compatible 0.3 save found','No compatible 0.6.x save found')
      .replace("navigator.serviceWorker.register('./sw.js')","Promise.resolve(null)");

    render=render
      .replace(/Math\.PI\/2\.95/g,'Math.PI/2.0')
      .replace("{type:'car',x:6.25,y:12.9}","{type:'car',x:7.5,y:14.18}")
      .replace("const fog=clamp((dist-4.5)/10,0,.72),fogC=[143,151,145]","const fog=clamp((dist-24)/42,0,.06),fogC=[143,151,145]")
      .replace("const fog=clamp((corrected-4.8)/8.5,0,.86)","const fog=clamp((corrected-24)/42,0,.06)")
      .replace("if(!p||p.dist>11.5)continue","if(!p||p.dist>30)continue")
      .replace("const H=clamp(110/p.dist,8,64);","const H=clamp((s.type==='car'?175:110)/p.dist,s.type==='car'?13:8,s.type==='car'?90:64);")
      .replace("function resize(){","function canMove(x,y){const r=.22;const blocked=(px,py)=>{const xi=Math.floor(px),yi=Math.floor(py);if(yi===15&&(xi===7||xi===8))return false;return !!isWall(px,py)};if(blocked(x-r,y-r)||blocked(x+r,y-r)||blocked(x-r,y+r)||blocked(x+r,y+r))return false;const cx=7.5,cy=14.18;const ex=(x-cx)/.82,ey=(y-cy)/.52;if(ex*ex+ey*ey<1)return false;return true}\nfunction resize(){");

    render=render.replace(/function drawBoundaryColumn[\s\S]*?\nfunction drawWallColumn/,
      "function drawBoundaryColumn(x,hit,bob,corrected,time){return}\nfunction drawWallColumn");

    const helpers=`
function projectWorldPoint(wx,wy,z,fov,bob){
  const dx=wx-state.player.x,dy=wy-state.player.y;
  const ca=Math.cos(state.player.a),sa=Math.sin(state.player.a);
  const forward=dx*ca+dy*sa,right=-dx*sa+dy*ca;
  if(forward<=.28)return null;
  const focal=(w*.5)/Math.tan(fov*.5);
  const sx=w*.5+(right/forward)*focal;
  const scale=h/forward*.78;
  const sy=h*.52+bob+scale*.5-z*scale;
  return{x:sx,y:sy,d:forward,scale};
}
function drawFenceSection(x1,y1,x2,y2,fov,bob){
  const len=Math.hypot(x2-x1,y2-y1),parts=Math.max(1,Math.ceil(len/.65));
  for(let i=0;i<parts;i++){
    const t1=i/parts,t2=(i+1)/parts;
    const ax=x1+(x2-x1)*t1,ay=y1+(y2-y1)*t1,bx=x1+(x2-x1)*t2,by=y1+(y2-y1)*t2;
    const a0=projectWorldPoint(ax,ay,0,fov,bob),a1=projectWorldPoint(ax,ay,.42,fov,bob);
    const b0=projectWorldPoint(bx,by,0,fov,bob),b1=projectWorldPoint(bx,by,.42,fov,bob);
    if(!a0||!a1||!b0||!b1)continue;
    if((a0.x<-30&&b0.x<-30)||(a0.x>w+30&&b0.x>w+30))continue;
    ctx.strokeStyle='rgba(72,70,61,.72)';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(a1.x,a1.y);ctx.moveTo(b0.x,b0.y);ctx.lineTo(b1.x,b1.y);ctx.stroke();
    for(const z of [.16,.32]){
      const ar=projectWorldPoint(ax,ay,z,fov,bob),br=projectWorldPoint(bx,by,z,fov,bob);
      if(ar&&br){ctx.beginPath();ctx.moveTo(ar.x,ar.y);ctx.lineTo(br.x,br.y);ctx.stroke()}
    }
  }
}
function drawPerimeterFence(fov,bob){
  drawFenceSection(1,1,15,1,fov,bob);
  drawFenceSection(1,1,1,15,fov,bob);
  drawFenceSection(15,1,15,15,fov,bob);
  drawFenceSection(1,15,7,15,fov,bob);
  drawFenceSection(9,15,15,15,fov,bob);
}
function landmarkColor(b){
  if(b.id==='clinic')return[121,137,131];
  if(b.id==='apartments')return[105,102,96];
  if(b.id==='workshop')return[115,73,55];
  if(b.id==='chapel')return[78,61,46];
  if(b.id==='warehouse')return[88,79,68];
  if(b.id==='fuel')return[99,86,60];
  return[108,114,102];
}
function drawVillageLandmarks(fov,bob,time){
  const items=BUILDINGS.map(b=>{
    const cx=(b.x0+b.x1+1)*.5,cy=(b.y0+b.y1+1)*.5;
    const p=projectWorldPoint(cx,cy,0,fov,bob);
    return{b,cx,cy,p,dist:Math.hypot(cx-state.player.x,cy-state.player.y)};
  }).filter(o=>o.p&&o.p.x>-w*.35&&o.p.x<w*1.35).sort((a,b)=>b.dist-a.dist);
  for(const o of items){
    const b=o.b,p=o.p;
    const worldWidth=Math.max(1.4,Math.max(b.x1-b.x0+1,b.y1-b.y0+1)*.78);
    const bh=Math.max(11,p.scale*b.height),bw=Math.max(12,Math.min(w*.46,p.scale*worldWidth));
    const bottom=p.y,top=bottom-bh,left=p.x-bw*.5,c=landmarkColor(b);
    const haze=clamp((o.dist-18)/26,0,.08);
    ctx.save();ctx.globalAlpha=.98;
    const rr=Math.round(c[0]*(1-haze)+143*haze),gg=Math.round(c[1]*(1-haze)+151*haze),bb=Math.round(c[2]*(1-haze)+145*haze);
    ctx.fillStyle='rgb('+rr+','+gg+','+bb+')';
    ctx.fillRect(Math.round(left),Math.round(top),Math.ceil(bw),Math.ceil(bh));
    ctx.fillStyle='rgba(31,34,31,.62)';
    const roofH=Math.max(1,Math.round(bh*.06));
    if(b.id==='chapel'){
      ctx.beginPath();ctx.moveTo(p.x,top-bh*.24);ctx.lineTo(left-bw*.05,top+roofH);ctx.lineTo(left+bw*1.05,top+roofH);ctx.closePath();ctx.fill();
    }else ctx.fillRect(Math.round(left-bw*.03),Math.round(top-roofH),Math.ceil(bw*1.06),roofH+1);
    const floors=Math.max(1,b.floors),cols=(b.id==='warehouse'||b.id==='workshop')?4:3;
    ctx.fillStyle='rgba(31,42,42,.76)';
    for(let fy=0;fy<floors;fy++){
      const wy=top+bh*(.2+(fy/floors)*.56);
      for(let wx=0;wx<cols;wx++){
        const ww=Math.max(1,bw*.10),wh=Math.max(1,bh*.055),xx=left+bw*(.16+wx*(.68/Math.max(1,cols-1)))-ww*.5;
        ctx.fillRect(Math.round(xx),Math.round(wy),Math.ceil(ww),Math.ceil(wh));
      }
    }
    if(b.id==='clinic'){ctx.fillStyle='rgba(133,50,45,.88)';ctx.fillRect(Math.round(p.x-1),Math.round(top+bh*.18),2,Math.max(2,Math.round(bh*.13)))}
    ctx.restore();
  }
}
`;
    render=render.replace('function renderWorld(time){',helpers+'\nfunction renderWorld(time){');

    const before="function renderWorld(time){ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;const bob=Math.round(Math.sin(state.player.bob)*1.5);drawSkyGround(bob,time);const fov=Math.PI/2.0,cols=w;";
    const after="function renderWorld(time){ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;const bob=Math.round(Math.sin(state.player.bob)*1.5);drawSkyGround(bob,time);const fov=Math.PI/2.0;drawPerimeterFence(fov,bob);drawVillageLandmarks(fov,bob,time);const cols=w;";
    if(!render.includes(before))throw new Error('0.6.4 renderWorld patch anchor missing');
    render=render.replace(before,after);

    render=render.replace("if(b.id==='edge'){if((x+y)%2===0){mapCtx.fillStyle='#687267';mapCtx.fillRect(x*ts+ts*.35,y*ts+ts*.35,ts*.3,ts*.3)}continue}","if(b.id==='edge')continue");
    render=render.replace("mapCtx.fillStyle='#231f1a';mapCtx.fillRect(Math.round(state.player.x*ts)-2,Math.round(state.player.y*ts)-2,4,4);","mapCtx.strokeStyle='#5d5b50';mapCtx.lineWidth=1;mapCtx.beginPath();mapCtx.moveTo(ts,ts);mapCtx.lineTo(15*ts,ts);mapCtx.lineTo(15*ts,15*ts);mapCtx.moveTo(ts,ts);mapCtx.lineTo(ts,15*ts);mapCtx.moveTo(ts,15*ts);mapCtx.lineTo(7*ts,15*ts);mapCtx.moveTo(9*ts,15*ts);mapCtx.lineTo(15*ts,15*ts);mapCtx.stroke();mapCtx.fillStyle='#343833';mapCtx.fillRect(7.0*ts,13.95*ts,1.0*ts,.32*ts);mapCtx.fillStyle='#231f1a';mapCtx.fillRect(Math.round(state.player.x*ts)-2,Math.round(state.player.y*ts)-2,4,4);");

    const a=src.indexOf('function resize(){'),marker=String.fromCharCode(10,10)+'function interact(){',b=src.indexOf(marker,a);
    if(a<0||b<0)throw new Error('render patch anchors missing');
    src=src.slice(0,a)+render+src.slice(b);
    src=src.replace("document.addEventListener('DOMContentLoaded',bind);","if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();");
    document.title='The Winter Registry — 0.6.4 Persistent Village Build';
    const note=document.querySelector('.small-note');
    if(note)note.textContent='BUILD 0.6.4 · persistent distant buildings · stable perimeter fence · fixed startup';
    (0,eval)(src);
  }).catch(err=>{
    console.error(err);
    const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;padding:20px;background:#111;color:#f0c7b0;position:fixed;inset:0;z-index:999999;overflow:auto';pre.textContent='Winter Registry 0.6.4 failed to initialise\n\n'+String(err&&err.stack||err);document.body.appendChild(pre);
  });
})();
