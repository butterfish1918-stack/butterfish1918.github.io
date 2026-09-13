(()=>{
  const bust='?v=0.6.0';
  Promise.all([
    fetch('./v03.js'+bust).then(r=>{if(!r.ok)throw new Error('v03 '+r.status);return r.text()}),
    fetch('./v05-render.txt'+bust).then(r=>{if(!r.ok)throw new Error('render '+r.status);return r.text()})
  ]).then(([src,render])=>{
    src=src
      .replace("const SAVE_KEY='winterRegistrySave_v03';","const SAVE_KEY='winterRegistrySave_v05';")
      .replace("const TUTORIAL_KEY='winterRegistryTutorial_v03';","const TUTORIAL_KEY='winterRegistryTutorial_v05';")
      .replace('return{version:3,seed','return{version:5,seed')
      .replace('if(state.version!==3)return false','if(state.version!==5)return false')
      .replace('No compatible 0.3 save found','No compatible 0.5 save found')
      .replace("navigator.serviceWorker.register('./sw.js')","navigator.serviceWorker.register('./sw.js?v=0.6.0')");

    // 0.6 village readability pass: wider sight, lighter distance fog,
    // a low perimeter fence, and a visibly blocked main road entrance.
    render=render
      .replace(/Math\.PI\/2\.95/g,'Math.PI/2.15')
      .replace("{type:'car',x:6.25,y:12.9}","{type:'car',x:7.5,y:14.25}")
      .replace("const fog=clamp((dist-4.5)/10,0,.72),fogC=[143,151,145]","const fog=clamp((dist-8)/18,0,.48),fogC=[143,151,145]")
      .replace("const fog=clamp((corrected-4.8)/8.5,0,.86)","const fog=clamp((corrected-8.5)/18,0,.48)")
      .replace("if(!p||p.dist>11.5)continue","if(!p||p.dist>18)continue");

    render=render.replace(/function drawBoundaryColumn[\s\S]*?\nfunction drawWallColumn/,
`function drawBoundaryColumn(x,hit,bob,corrected,time){
  const horizon=h*.52+bob,baseH=h/Math.max(.08,corrected)*.78,bottom=horizon+baseH*.5;
  const mainGate=hit.my>=15&&hit.mx>=7&&hit.mx<=8;
  if(mainGate)return;
  const fenceH=Math.max(5,Math.round(baseH*.34)),top=Math.round(bottom-fenceH);
  const post=hit.wx<.075||hit.wx>.925;
  if(post){
    ctx.fillStyle='rgba(58,57,50,.95)';
    ctx.fillRect(x,top-2,1,fenceH+3);
    ctx.fillStyle='rgba(196,196,181,.82)';
    ctx.fillRect(x,top-2,1,1);
  }else{
    ctx.fillStyle='rgba(67,68,61,.9)';
    ctx.fillRect(x,Math.round(top+fenceH*.34),1,1);
    ctx.fillRect(x,Math.round(top+fenceH*.68),1,1);
    if(((hit.mx+hit.my+Math.floor(hit.wx*20))%5)===0){
      ctx.fillStyle='rgba(118,119,108,.62)';
      ctx.fillRect(x,Math.round(top+fenceH*.49),1,1);
    }
  }
  const fog=clamp((corrected-10)/20,0,.35);
  if(fog){ctx.fillStyle=\`rgba(143,151,145,\${fog})\`;ctx.fillRect(x,top-2,1,fenceH+4)}
}
function drawWallColumn`);

    const a=src.indexOf('function resize(){'),marker=String.fromCharCode(10,10)+'function interact(){',b=src.indexOf(marker,a);
    if(a<0||b<0)throw new Error('render patch anchors missing');
    src=src.slice(0,a)+render+src.slice(b);
    src=src.replace("document.addEventListener('DOMContentLoaded',bind);","if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();");
    document.title='The Winter Registry — 0.6 Enclosed Village';
    const note=document.querySelector('.small-note');
    if(note)note.textContent='Build 0.6 · long village sightlines + low perimeter fence + car-blocked entrance road · touch + mouse · local save · offline capable';
    (0,eval)(src);
  }).catch(err=>{
    console.error(err);
    document.body.innerHTML='<main style="padding:32px;background:#111;color:#ddd;font-family:monospace"><h1>Winter Registry failed to initialise</h1><pre>'+String(err)+'</pre></main>';
  });
})();
