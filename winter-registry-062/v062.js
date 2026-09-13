(()=>{
  const bust='?wr062=20260913-0931';
  Promise.all([
    fetch('../winter-registry/v03.js'+bust,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('v03 '+r.status);return r.text()}),
    fetch('../winter-registry/v05-render.txt'+bust,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('render '+r.status);return r.text()})
  ]).then(([src,render])=>{
    src=src
      .replace("const SAVE_KEY='winterRegistrySave_v03';","const SAVE_KEY='winterRegistrySave_v062';")
      .replace("const TUTORIAL_KEY='winterRegistryTutorial_v03';","const TUTORIAL_KEY='winterRegistryTutorial_v062';")
      .replace('return{version:3,seed','return{version:62,seed')
      .replace('if(state.version!==3)return false','if(state.version!==62)return false')
      .replace('No compatible 0.3 save found','No compatible 0.6.2 save found')
      .replace("navigator.serviceWorker.register('./sw.js')","Promise.resolve(null)");

    render=render
      .replace(/Math\.PI\/2\.95/g,'Math.PI/2.05')
      .replace("{type:'car',x:6.25,y:12.9}","{type:'car',x:7.5,y:14.18}")
      .replace("const fog=clamp((dist-4.5)/10,0,.72),fogC=[143,151,145]","const fog=clamp((dist-16)/28,0,.16),fogC=[143,151,145]")
      .replace("const fog=clamp((corrected-4.8)/8.5,0,.86)","const fog=clamp((corrected-16)/28,0,.16)")
      .replace("if(!p||p.dist>11.5)continue","if(!p||p.dist>24)continue")
      .replace("function resize(){","function canMove(x,y){const r=.22;const blocked=(px,py)=>{const xi=Math.floor(px),yi=Math.floor(py);if(yi===15&&(xi===7||xi===8))return false;return !!isWall(px,py)};if(blocked(x-r,y-r)||blocked(x+r,y-r)||blocked(x-r,y+r)||blocked(x+r,y+r))return false;const cx=7.5,cy=14.18;const ex=(x-cx)/.78,ey=(y-cy)/.48;if(ex*ex+ey*ey<1)return false;return true}\nfunction resize(){");

    render=render.replace(/function drawBoundaryColumn[\s\S]*?\nfunction drawWallColumn/,
`function drawBoundaryColumn(x,hit,bob,corrected,time){
  const horizon=h*.52+bob,baseH=h/Math.max(.08,corrected)*.78,bottom=horizon+baseH*.5;
  const mainGate=hit.my>=15&&hit.mx>=7&&hit.mx<=8;
  if(mainGate)return;
  const fenceH=Math.max(4,Math.round(baseH*.25)),top=Math.round(bottom-fenceH);
  const post=hit.wx<.06||hit.wx>.94;
  if(post){
    ctx.fillStyle='rgba(70,65,54,.96)';
    ctx.fillRect(x,top-2,1,fenceH+3);
    if(((hit.mx+hit.my)&1)===0){ctx.fillStyle='rgba(185,184,166,.55)';ctx.fillRect(x,top-2,1,1)}
  }else{
    ctx.fillStyle='rgba(74,75,66,.92)';
    ctx.fillRect(x,Math.round(top+fenceH*.38),1,1);
    ctx.fillRect(x,Math.round(top+fenceH*.72),1,1);
  }
  const fog=clamp((corrected-18)/30,0,.12);
  if(fog){ctx.fillStyle=\`rgba(143,151,145,\${fog})\`;ctx.fillRect(x,top-2,1,fenceH+4)}
}
function drawWallColumn`);

    render=render.replace(
      "if(b.id==='edge'){if((x+y)%2===0){mapCtx.fillStyle='#687267';mapCtx.fillRect(x*ts+ts*.35,y*ts+ts*.35,ts*.3,ts*.3)}continue}",
      "if(b.id==='edge'){const gate=(y===15&&x>=7&&x<=8);if(!gate){mapCtx.fillStyle='#5d5b50';if(y===0||y===15)mapCtx.fillRect(x*ts,y*ts+ts*.46,ts,Math.max(1,ts*.08));else mapCtx.fillRect(x*ts+ts*.46,y*ts,Math.max(1,ts*.08),ts)}continue}"
    );
    render=render.replace(
      "mapCtx.fillStyle='#231f1a';mapCtx.fillRect(Math.round(state.player.x*ts)-2,Math.round(state.player.y*ts)-2,4,4);",
      "mapCtx.fillStyle='#343833';mapCtx.fillRect(7.0*ts,13.95*ts,1.0*ts,.32*ts);mapCtx.fillStyle='#231f1a';mapCtx.fillRect(Math.round(state.player.x*ts)-2,Math.round(state.player.y*ts)-2,4,4);"
    );

    const a=src.indexOf('function resize(){'),marker=String.fromCharCode(10,10)+'function interact(){',b=src.indexOf(marker,a);
    if(a<0||b<0)throw new Error('render patch anchors missing');
    src=src.slice(0,a)+render+src.slice(b);
    src=src.replace("document.addEventListener('DOMContentLoaded',bind);","if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();");
    document.title='The Winter Registry — 0.6.2 Fence Gate Build';
    const note=document.querySelector('.small-note');
    if(note)note.textContent='BUILD 0.6.2 · EXTENDED SIGHT · LOW FENCE · PHYSICAL CAR-BLOCKED GATE · NO PWA CACHE';
    const badge=document.createElement('div');
    badge.textContent='0.6.2 · FENCE / GATE BUILD';
    badge.style.cssText='position:fixed;right:10px;bottom:10px;z-index:99999;background:#1b1d18;color:#ddd9c9;border:1px solid #8d8060;padding:6px 8px;font:10px monospace;letter-spacing:.08em;pointer-events:none;opacity:.82';
    document.body.appendChild(badge);
    (0,eval)(src);
  }).catch(err=>{
    console.error(err);
    document.body.innerHTML='<main style="padding:32px;background:#111;color:#ddd;font-family:monospace"><h1>Winter Registry 0.6.2 failed to initialise</h1><pre>'+String(err)+'</pre></main>';
  });
})();
