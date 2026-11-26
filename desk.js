/* Viewport overlay for a single trip from the orbit to a chart and back. */
(() => {
  'use strict';
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=t=>t*t*t*(10+t*(-15+6*t));
  // Where each role stands relative to its sampling window, in sprite radii.
  const profiles={
    spotter:['right',5.1,2.65], taker:['above',3.45,1.8], prior:['left',4.65,2.5],
    edge:['left',4.45,2.15], kelly:['left',3.35,1.6], closer:['right',5.15,2.05]
  };
  const hold=2.12;

  function windowAt(job,tx,ty,r,dt){
    const stage=job.target.parentElement,b=stage.getBoundingClientRect();
    const zone=stage.deskScanZones?.[job.id]||[0,0,b.width,b.height];
    const l=b.left+zone[0]+1,t=b.top+zone[1]+1;
    const right=b.left+zone[2]-1,bottom=b.top+zone[3]-1;
    if(right-l<8||bottom-t<8)return null;
    // Filter incoming data coordinates in chart space so scrolling stays attached to the plot.
    const localX=tx-b.left,localY=ty-b.top,prev=job.anchor;
    const a=1-Math.exp(-dt*13);
    if(prev&&prev.w===b.width&&prev.h===b.height){prev.x=mix(prev.x,localX,a);prev.y=mix(prev.y,localY,a);}
    else job.anchor={x:localX,y:localY,w:b.width,h:b.height};
    tx=b.left+job.anchor.x;ty=b.top+job.anchor.y;
    const [preferred,width,height]=profiles[job.id];
    const w=Math.min(r*width,right-l),h=Math.min(r*height,bottom-t);
    const x=clamp(tx-w/2,l,right-w),y=clamp(ty-h/2,t,bottom-h);
    const cx=x+w/2,cy=y+h/2,gap=r*.92;
    let dock=preferred;
    if(dock==='right'&&x+w+gap+r>b.right&&x-gap-r>=b.left)dock='left';
    if(dock==='left'&&x-gap-r<b.left&&x+w+gap+r<=b.right)dock='right';
    const ex=clamp(dock==='above'?cx:dock==='right'?x+w+gap:x-gap,b.left+r,b.right-r);
    const ey=dock==='above'?y-r*.9:cy-r*.33;
    return {x,y,w,h,cx,cy,ex,ey,dock};
  }

  function curve(src,dock,progress,back){
    const u=ease(clamp(progress,0,1)),v=1-u;
    const a=back?dock:src,b=back?src:dock,dx=b.x-a.x,dy=b.y-a.y;
    const len=Math.hypot(dx,dy)||1,bow=clamp(len*.16,12,90)*(back?.72:1);
    const nx=-dy/len,ny=dx/len;
    const x1=a.x+dx*.24+nx*bow,y1=a.y+dy*.24+ny*bow-16;
    const x2=a.x+dx*.71+nx*bow*.60,y2=a.y+dy*.71+ny*bow*.60-8;
    return {x:v*v*v*a.x+3*v*v*u*x1+3*v*u*u*x2+u*u*u*b.x,
      y:v*v*v*a.y+3*v*v*u*y1+3*v*u*u*y2+u*u*u*b.y,r:mix(a.r,b.r,u)};
  }

  function scan(c,f,a,color,id,age,still){
    const {x,y,w,h,cx,cy}=f,endX=x+w,endY=y+h;
    const strength=still?1:clamp(Math.min(age/.12,(hold-age)/.13),0,1);
    c.save();c.globalAlpha=strength;c.lineJoin='round';c.lineCap='round';
    c.fillStyle=color+'0c';c.fillRect(x,y,w,h);
    const leg=Math.min(6.3,h*.25,w*.15);
    c.beginPath();
    for(const [xx,yy,dx,dy] of [[x,y,1,1],[endX,y,-1,1],[endX,endY,-1,-1],[x,endY,1,-1]]){
      c.moveTo(xx+dx*leg,yy);c.lineTo(xx,yy);c.lineTo(xx,yy+dy*leg);
    }
    c.strokeStyle=color+'cb';c.lineWidth=1.15;c.stroke();
    const pulseRole=id==='taker'||id==='kelly',angle=age*2*Math.PI/1.72;
    const sweep=still?cx:x+3+(w-6)*(.5-.5*Math.cos(angle));
    const pulse=still?.33:(age/.85)%1;
    if(!still){
      const end=pulseRole?cx:sweep;
      const beam=c.createLinearGradient(a.x,a.y,end,cy);
      beam.addColorStop(0,color+'32');beam.addColorStop(1,color+'0a');
      c.fillStyle=beam;c.beginPath();c.moveTo(a.x,a.y);
      if(f.dock==='above'){c.lineTo(x+2,cy);c.lineTo(endX-2,cy);}
      else{c.lineTo(end,y+2);c.lineTo(end,endY-2);}
      c.closePath();c.fill();
    }
    c.beginPath();c.rect(x,y,w,h);c.clip();
    if(!still){
      if(!pulseRole){
        const tail=x+3+(w-6)*(.5-.5*Math.cos(angle-.45));
        if(Math.abs(tail-sweep)>.1){
          const band=c.createLinearGradient(tail,0,sweep,0);
          band.addColorStop(0,color+'00');band.addColorStop(1,color+'4c');
          c.fillStyle=band;c.fillRect(Math.min(tail,sweep),y+2,Math.abs(sweep-tail),h-4);
        }
        c.strokeStyle=color+'df';c.shadowColor=color;c.shadowBlur=2.4;c.lineWidth=1.45;
        c.beginPath();c.moveTo(sweep,y+2);c.lineTo(sweep,endY-2);c.stroke();c.shadowBlur=0;
      }else{
        c.setLineDash([2,2.5]);c.strokeStyle=color+'78';c.lineWidth=.85;
        c.beginPath();c.moveTo(a.x,a.y);c.lineTo(cx,cy);c.stroke();c.setLineDash([]);
      }
    }
    const rx=a.r*(.15+pulse*(pulseRole?.70:.43));
    c.globalAlpha=strength*(still?.76:(1-pulse)*.72);
    c.strokeStyle=color;c.lineWidth=.95;c.beginPath();c.ellipse(cx,cy,rx,rx*.50,0,0,Math.PI*2);c.stroke();
    c.restore();
  }

  window.createDeskFlight=function(canvas){
    const c=canvas.getContext('2d');let W=0,H=0,D=0,previousTarget=null;
    function mark(target,id){
      if(previousTarget===target)return;
      previousTarget?.classList.remove('is-scanning');previousTarget=target;
      if(target){target.classList.add('is-scanning');canvas.dataset.scan=id;}
      else delete canvas.dataset.scan;
    }
    function clear(){mark(null);c.clearRect(0,0,W,H);}
    function travelTime(from,to){
      if(!from||!to)return .95;
      const b=to.getBoundingClientRect();
      return clamp(.68+Math.hypot(from.x-b.left,from.y-b.top)/1100,.78,1.25);
    }
    function draw(job,actor,src,time,dt,still,action){
      const d=Math.min(2,devicePixelRatio||1);
      if(W!==innerWidth||H!==innerHeight||D!==d){W=innerWidth;H=innerHeight;D=d;canvas.width=Math.round(W*d);canvas.height=Math.round(H*d);c.setTransform(d,0,0,d,0,0);}
      c.clearRect(0,0,W,H);
      const target=job.target,rect=target?.getBoundingClientRect();
      if(!src||!rect?.width||!rect.height){mark(null);return;}
      const r=clamp(src.size*.43,10,21);
      const f=windowAt(job,rect.left+rect.width/2,rect.top+rect.height/2,r,dt);
      if(!f){mark(null);return;}
      const t=time-job.start,age=t-job.travel,working=age>=0&&age<hold,back=age>=hold;
      const progress=(back?age-hold:t)/job.travel;
      const from={x:src.x,y:src.y,r:src.size*.5},dock={x:f.ex,y:f.ey,r};
      const p=working?{...dock}:curve(from,dock,still?+(progress>=.5):progress,back);
      mark(working?target:null,job.id);
      if(working){
        if(!still)p.y+=Math.sin(age*4.2)*Math.sin(Math.PI*age/hold)**2*.95;
        scan(c,f,p,actor.color,job.id,age,still);
      }
      c.save();c.translate(p.x,p.y);
      if(!working&&!still){
        const past=curve(from,dock,progress-.045/job.travel,back);
        const dx=p.x-past.x,dy=p.y-past.y,speed=Math.hypot(dx,dy);
        if(speed>1){
          const angle=Math.atan2(dy,dx),trail=Math.min(speed,p.r*2.8);
          c.rotate(angle);
          const streak=c.createLinearGradient(-trail-p.r,0,0,0);
          streak.addColorStop(0,actor.color+'00');streak.addColorStop(1,actor.color+'55');
          c.fillStyle=streak;c.beginPath();c.ellipse(-trail*.55,0,trail*.55+p.r*.72,p.r*.7,0,0,Math.PI*2);c.fill();
          const stretch=Math.min(.16,speed*.0025);
          c.scale(1+stretch,1/(1+stretch));c.rotate(-angle);
        }
      }
      window.paintDeskAgent(c,actor.id,actor.color,0,0,p.r,still?0:time);c.restore();
      if(!working)return;
      const result=age>hold*.73&&job.result;
      let text=result||action;
      c.save();c.font='bold 9px Menlo, sans-serif';
      const maxWidth=Math.max(62,Math.min(178,target.parentElement.clientWidth-8));
      if(c.measureText(text).width>maxWidth){
        let n=text.length;while(n&&c.measureText(text.slice(0,n)+'…').width>maxWidth)n--;
        text=text.slice(0,n)+'…';
      }
      const w=c.measureText(text).width+12,h=16,left=clamp(p.x-w/2,3,W-w-3),top=p.y-p.r-h-4;
      c.fillStyle='#fffffff2';c.strokeStyle=result?'#218d72':actor.color;c.lineWidth=.95;
      c.beginPath();c.roundRect(left,top,w,h,6);c.fill();c.stroke();
      c.fillStyle=result?'#176b57':'#27364b';c.textBaseline='middle';c.fillText(text,left+6,top+h/2);c.restore();
    }
    return {draw,clear,travelTime,hold};
  };
})();

;
/* The reactor is drawn in ring-radius units and projected onto a tilted plane. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const stations = {taker:0, closer:1, spotter:2, prior:3, edge:4, kelly:5};
  const palette = ['#12b978','#6fcc34','#edaf04','#f4550a','#f30853','#e80a8b','#b20cb8','#5d40ce','#4c62cf','#ac56c7','#ed5788','#afba47'];
  const sectorCount = 24;
  const groups = [
    {count:17, alpha:.50, width:.0062, steps:2, spiral:false},
    {count:10, alpha:.78, width:.0074, steps:2, spiral:false},
    {count:8, alpha:.49, width:.0048, steps:6, spiral:true}
  ];
  const strands = groups.map((group,g) => Array.from({length:group.count},(_,j) => {
    const phase = TAU * j / group.count + g*.67;
    const wave = group.spiral ? 12+(j%4)*3 : 2+(j+g)%4;
    const phase2 = j*2.157+g;
    const count = sectorCount*group.steps;
    // Cache the spatial part of each harmonic; only the time-dependent phases change per frame.
    const samples = Array.from({length:count},(_,k)=>{
      const a=TAU*k/count,p=wave*a+phase,w=(group.spiral?3:2)*a+phase2,z=7*a-phase;
      return {x:Math.cos(a),depth:Math.sin(a),pc:Math.cos(p),ps:Math.sin(p),
        wc:Math.cos(w),ws:Math.sin(w),zc:Math.cos(z),zs:Math.sin(z)};
    });
    return {
      samples,
      speed:(j%3===0 ? -.22 : .23) + .08*Math.sin(j*2+g),
      wide:.93+.15*Math.sin(j*1.764+g)
    };
  }));

  function roundBody(context, aspect) {
    context.beginPath();
    context.moveTo(0,-.91);
    context.bezierCurveTo(.70*aspect,-.97,1.05*aspect,-.65,1.01*aspect,.02);
    context.bezierCurveTo(.99*aspect,.68,.67*aspect,.96,0,.92);
    context.bezierCurveTo(-.68*aspect,.97,-1.02*aspect,.66,-1.01*aspect,.02);
    context.bezierCurveTo(-1.04*aspect,-.62,-.70*aspect,-.96,0,-.91);
    context.closePath();
  }
  function body(context,id) {
    if (id==='edge' || id==='kelly') {
      context.beginPath();
      if (id==='edge') {
        context.moveTo(-.20,-.97);
        context.quadraticCurveTo(0,-1.24,.22,-.97);
        context.lineTo(.95,.44);
        context.quadraticCurveTo(1.17,.88,.65,.91);
        context.quadraticCurveTo(0,1.03,-.70,.90);
        context.quadraticCurveTo(-1.13,.86,-.96,.46);
        context.closePath();
      } else {
        context.moveTo(.02,-1.2);
        context.quadraticCurveTo(.95,-.07,.87,.40);
        context.bezierCurveTo(.74,1.10,-.43,1.19,-.77,.66);
        context.bezierCurveTo(-1.14,.18,-.70,-.31,.02,-1.2);
        context.closePath();
      }
    } else if (id==='prior') {
      context.beginPath();
      context.moveTo(-.22,-.92);
      context.quadraticCurveTo(.04,-1.08,.32,-.85);
      context.lineTo(.84,-.37);
      context.quadraticCurveTo(1.16,-.03,.85,.38);
      context.lineTo(.36,.82);
      context.quadraticCurveTo(-.04,1.04,-.41,.80);
      context.lineTo(-.85,.29);
      context.quadraticCurveTo(-1.12,-.10,-.79,-.47);
      context.closePath();
    } else {
      roundBody(context,id==='taker'?1.10:1);
    }
  }
  function eyePair(context,t,offset,large) {
    const beat=(t+offset)%4.9;
    const blink=beat<.16 ? .15+.85*Math.abs(beat-.08)/.08 : 1;
    context.lineCap='round';
    context.lineWidth=large?.22:.19;
    context.beginPath();
    const top=-.15*blink, bottom=.19*blink;
    context.moveTo(-.28,top);
    context.lineTo(-.22,bottom);
    context.moveTo(.28,top);
    context.lineTo(.22,bottom);
    context.stroke();
  }
  function paintDeskAgent(ctx,id,color,x,y,r,t=0) {
    if (!Number.isFinite(r) || r<=0) return;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(r,r);
    body(ctx,id);
    ctx.fillStyle=color;
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.63)';
    ctx.lineWidth=.047;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const shade=ctx.createLinearGradient(-.6,-.9,.6,.95);
    shade.addColorStop(0,'rgba(255,255,255,.15)');
    shade.addColorStop(.45,'rgba(255,255,255,0)');
    shade.addColorStop(1,'rgba(36,19,123,.12)');
    ctx.fillStyle=shade;
    ctx.fillRect(-1.3,-1.3,2.6,2.6);
    ctx.restore();
    ctx.strokeStyle='#fffdf8';
    eyePair(ctx,t,(stations[id]??0)*.81,false);
    ctx.restore();
  }

  function ellipse(ctx,x,y,rx,ry,color,lineWidth) {
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,TAU);
    if (lineWidth) {
      ctx.strokeStyle=color; ctx.lineWidth=lineWidth; ctx.stroke();
    } else {ctx.fillStyle=color;ctx.fill();}
  }
  function softLight(ctx,x,y,rx,ry,from,to) {
    ctx.save();
    ctx.translate(x,y);ctx.scale(rx,ry);
    const grad=ctx.createRadialGradient(0,0,0,0,0,1);
    grad.addColorStop(0,from);grad.addColorStop(1,to);
    ctx.fillStyle=grad;ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  }
  function project(x,depth,z) {
    const perspective=1+.063*depth;
    return {x:x*perspective,y:(.672*depth-.831*z)*perspective};
  }
  function sectorColor(i) {
    const n=i/2, a=palette[Math.floor(n)%palette.length], b=palette[(Math.floor(n)+1)%palette.length];
    if (Number.isInteger(n)) return a;
    const ch=k=>(parseInt(a.slice(k,k+2),16)+parseInt(b.slice(k,k+2),16))>>1;
    return 'rgb('+ch(1)+','+ch(3)+','+ch(5)+')';
  }

  function createReactor(canvas,wrapper,agents,onSelect) {
    const ctx=canvas.getContext('2d');
    const wires=strands.map(lines=>lines.map(line=>({...line,
      points:new Float64Array(line.samples.length*2),tangents:new Float64Array(line.samples.length*2)})));
    const agentsById=new Map(agents.map(a=>[a.id,a]));
    const locations=new Map();
    let hovered=null, focusJob=null, width=0, height=0, radius=1, cx=0, cy=0, density=1;
    let lastDraw=-10,lastJob='', background=null,gradients=[];
    let needResize=true,visible=true;
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{needResize=true;});
    if(observer) observer.observe(canvas);
    if(typeof IntersectionObserver!=='undefined'){
      const visibility=new IntersectionObserver(([entry])=>{
        visible=entry.isIntersecting;
        if(visible)lastDraw=-10;
      });
      visibility.observe(canvas);
    }
    function resize() {
      const w=canvas.clientWidth || wrapper.clientWidth, h=canvas.clientHeight || wrapper.clientHeight;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      if(w===width && h===height && dpr===density && background) return;
      if(!w || !h) return;
      width=w;height=h;density=dpr;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      cx=w*.50;cy=h*.532;
      radius=Math.max(1,Math.min(w*.316,h*.50));
      background=document.createElement('canvas');background.width=canvas.width;background.height=canvas.height;
      const bg=background.getContext('2d');
      bg.setTransform(dpr*radius,0,0,dpr*radius,dpr*cx,dpr*cy);
      softLight(bg,0,-.03,1.65,1.05,'rgba(178,165,241,.29)','rgba(201,203,248,0)');
      softLight(bg,-.08,-.15,.85,.68,'rgba(251,254,255,.91)','rgba(249,253,255,0)');
      softLight(bg,.03,.57,1.03,.22,'rgba(119,113,206,.16)','rgba(134,118,211,0)');
      // Light construction lines and registration points under the magnetic field.
      const corners=[];
      for(let i=0;i<8;i++) {
        const a=(i+.5)*TAU/8;
        corners.push(project(1.25*Math.cos(a),1.27*Math.sin(a),-.075));
      }
      bg.beginPath();corners.forEach((p,i)=>i?bg.lineTo(p.x,p.y):bg.moveTo(p.x,p.y));bg.closePath();
      bg.strokeStyle='rgba(104,118,171,.20)';bg.lineWidth=.0055;bg.stroke();
      for(let i=0;i<corners.length;i+=2) ellipse(bg,corners[i].x,corners[i].y,.012,.012,'rgba(100,104,155,.42)');
      for(let i=0;i<38;i++) {
        const a=i*2.399963,r=1.08+.32*(.5+.5*Math.sin(i*8.27));
        const p=project(Math.cos(a)*r,Math.sin(a)*r,Math.sin(i*4.5)*.12);
        ellipse(bg,p.x,p.y,.0025+(i%4)*.0012,.0025+(i%4)*.0012,'rgba(96,120,175,.32)');
      }
      ctx.setTransform(dpr*radius,0,0,dpr*radius,dpr*cx,dpr*cy);
      gradients=Array.from({length:sectorCount},(_,i)=>{
        const a=TAU*i/sectorCount, b=TAU*(i+1)/sectorCount;
        const p=project(Math.cos(a),Math.sin(a),0),q=project(Math.cos(b),Math.sin(b),0);
        const g=ctx.createLinearGradient(p.x,p.y,q.x,q.y);
        g.addColorStop(0,sectorColor(i));g.addColorStop(1,sectorColor(i+1));
        return g;
      });
    }

    function projectWires(t) {
      const zc=Math.cos(t*.43),zs=Math.sin(t*.43);
      for(let g=0;g<groups.length;g++) {
        const spiral=groups[g].spiral, weave=spiral?.026:.044, lift=spiral?.178:.132;
        const wa=t*(spiral?.44:.29),wc=Math.cos(wa),ws=Math.sin(wa);
        for(const {speed,wide,samples,points,tangents} of wires[g]){
          const pc=Math.cos(t*speed),ps=Math.sin(t*speed);
          for(let j=0;j<samples.length;j++){
            const s=samples[j],i=j*2;
            const r=1+wide*(.128*(s.pc*pc-s.ps*ps)+weave*(s.ws*wc+s.wc*ws));
            const z=lift*wide*(s.ps*pc+s.pc*ps)+.030*(s.zs*zc+s.zc*zs);
            const depth=r*s.depth,perspective=1+.063*depth;
            points[i]=r*s.x*perspective;
            points[i+1]=(.672*depth-.831*z)*perspective;
          }
          // Periodic Catmull–Rom tangents keep the wire smooth across colour sectors and the closing seam.
          for(let i=0;i<points.length;i+=2){
            const prev=i===0?points.length-2:i-2,next=i+2===points.length?0:i+2;
            tangents[i]=(points[next]-points[prev])/6;
            tangents[i+1]=(points[next+1]-points[prev+1])/6;
          }
        }
      }
    }
    function fieldRange(first,last) {
      for(let i=first;i<last;i++) {
        for(let g=0;g<groups.length;g++) {
          const group=groups[g];
          ctx.beginPath();
          for (const {points,tangents} of wires[g]) {
            let j=2*i*group.steps;
            ctx.moveTo(points[j],points[j+1]);
            for(let k=0;k<group.steps;k++){
              const next=j+2===points.length?0:j+2;
              ctx.bezierCurveTo(points[j]+tangents[j],points[j+1]+tangents[j+1],
                points[next]-tangents[next],points[next+1]-tangents[next+1],points[next],points[next+1]);
              j=next;
            }
          }
          ctx.strokeStyle=gradients[i];
          ctx.globalAlpha=group.alpha*(i<sectorCount/2?1:.84);
          ctx.lineWidth=group.width; ctx.stroke();
        }
      }
      ctx.globalAlpha=1;
    }

    function innerFlux(t,front) {
      ctx.save();
      for(let j=0;j<9;j++){
        ctx.beginPath();
        const offset=j*.69, begin=front?0:Math.PI, range=Math.PI;
        for(let k=0;k<=50;k++) {
          const a=begin+range*k/50;
          const r=.545+.044*Math.sin(a*3+offset+t*.33)+.035*Math.cos(a*5-offset*.6-t*.24);
          const x=r*Math.cos(a);
          const y=.69*r*Math.sin(a) + .036*Math.sin(2*a+offset+t*.30) -.028;
          if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);
        }
        ctx.strokeStyle=j%3===0?'rgba(47,142,152,.40)':'rgba(88,177,177,.24)';
        ctx.lineWidth=j%3===0?.007:.0045;ctx.stroke();
      }
      ctx.restore();
    }

    function gate(loc,agent,t,active) {
      const a=loc.angle,cs=Math.cos(a),sn=Math.sin(a),color=agent.color;
      const wall=(phase,side)=>{
        const rad=1+.202*Math.cos(phase);
        return project(rad*cs-side*sn,rad*sn+side*cs,.205*Math.sin(phase));
      };
      ctx.save();ctx.strokeStyle=color;
      const sections=36, edge=.030;
      // Two rims with a transparent body read as a coiled aperture, even edge-on.
      ctx.beginPath();
      for(let k=0;k<=sections;k++) {
        const p=wall(k*TAU/sections,-edge);
        if(k)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
      }
      for(let k=sections;k>=0;k--) {
        const p=wall(k*TAU/sections,edge);ctx.lineTo(p.x,p.y);
      }
      ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=.12;ctx.fill();
      for(const side of [-edge,0,edge]) {
        ctx.beginPath();
        for(let k=0;k<=sections;k++){
          const p=wall(k*TAU/sections,side);
          if(k)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
        }
        ctx.globalAlpha=side===0?.48:.90;
        ctx.lineWidth=side===0?.008:(active?.016:.011);
        ctx.stroke();
      }
      ctx.beginPath();
      for(let k=0;k<18;k++) {
        const phase=TAU*k/18+.12*t;
        const p=wall(phase,-edge),q=wall(phase+.10,edge);
        ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
      }
      ctx.globalAlpha=.56;ctx.lineWidth=.005;ctx.stroke();
      if(active) {
        ctx.beginPath();
        const phase=(t*.9)%TAU;
        for(let k=0;k<=10;k++){
          const p=wall(phase+k*.09,edge);
          if(k)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
        }
        ctx.lineCap='round';ctx.strokeStyle='#fffef5';ctx.lineWidth=.014;ctx.globalAlpha=.9;ctx.stroke();
      }
      ctx.restore();
    }

    function core(t) {
      const lift=.203+.013*Math.sin(t*1.5);
      const r=.305, x=0, y=-lift;
      // The offset contact shadow and the lighter return glow anchor the hovering sphere.
      softLight(ctx,.015,.100,.43,.117,'rgba(68,84,167,.46)','rgba(95,119,183,0)');
      ellipse(ctx,.012,.084,.246,.072,'rgba(75,96,179,.29)');
      ellipse(ctx,-.014,.095,.337,.098,'rgba(98,152,189,.34)',.005);
      ctx.save();
      ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
      const porcelain=ctx.createRadialGradient(-.091,y-.117,.002,.022,y+.006,.355);
      porcelain.addColorStop(0,'#ffffff');porcelain.addColorStop(.37,'#f9f9ff');
      porcelain.addColorStop(.64,'#e8eafb');porcelain.addColorStop(.83,'#c9cde7');
      porcelain.addColorStop(.96,'#a6afcf');porcelain.addColorStop(1,'#929cbf');
      ctx.fillStyle=porcelain;ctx.fillRect(-r,y-r,r*2,r*2);
      softLight(ctx,-.165,y+.074,.159,.122,'rgba(191,238,235,.39)','rgba(181,231,239,0)');
      softLight(ctx,.147,y+.14,.198,.125,'rgba(173,163,235,.32)','rgba(178,170,234,0)');
      ctx.beginPath();ctx.ellipse(-.006,y+.005,r*1.05,.093,-.025,.08,Math.PI-.03);
      ctx.strokeStyle='rgba(88,116,161,.30)';ctx.lineWidth=.006;ctx.stroke();
      ctx.restore();
      ellipse(ctx,x,y,r,r,'rgba(90,99,151,.39)',.0065);
      ctx.save();ctx.translate(x,y+.001);ctx.scale(r,r);ctx.strokeStyle='#0a0a16';
      eyePair(ctx,t,.2,true);
      ctx.restore();
    }

    function updateLocations(t) {
      const rotation=-.077*t + .035*Math.sin(.51*t);
      for(const agent of agents) {
        const a=.46+stations[agent.id]*TAU/6 + rotation;
        const depth=Math.sin(a);
        const p=project(Math.cos(a),depth,.322+.019*Math.sin(t*2.05+stations[agent.id]*1.2));
        const r=.132*(1+.213*depth);
        locations.set(agent.id,{angle:a,depth,x:p.x,y:p.y,r});
      }
    }
    function renderStation(agent,t,job) {
      const loc=locations.get(agent.id);
      const active=hovered===agent.id || (job && job.id===agent.id);
      gate(loc,agent,t,active);
      const away=job && job.id===agent.id ? Math.min(1,Math.max(0,job.away||0)) : 0;
      // The DOM flight sprite assumes full opacity between the gate and its chart.
      if(away>=.99) return;
      ctx.save();
      ctx.globalAlpha=1-away;
      if(hovered===agent.id){
        ellipse(ctx,loc.x,loc.y,loc.r*1.22,loc.r*1.18,'rgba(255,255,255,.8)',.011);
      }
      paintDeskAgent(ctx,agent.id,agent.color,loc.x,loc.y,loc.r,t);
      ctx.restore();
    }

    function draw(t,job=null) {
      if (needResize || !width || !height) {
        resize();needResize=false;lastDraw=-10;
      }
      if(!width || !height)return;
      focusJob=job;
      const jobKey=(job?.id||'')+'/'+Math.round((job?.away||0)*20)+'/'+(hovered||'');
      if(t===lastDraw && jobKey===lastJob) return;
      lastDraw=t;lastJob=jobKey;
      updateLocations(t);
      if(!visible)return;
      const order=agents.slice().sort((a,b)=>locations.get(a.id).depth-locations.get(b.id).depth);
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(background,0,0);
      ctx.setTransform(density*radius,0,0,density*radius,density*cx,density*cy);
      ctx.lineCap='round';ctx.lineJoin='round';
      projectWires(t);
      fieldRange(sectorCount/2,sectorCount);
      for(const a of order)if(locations.get(a.id).depth<0)renderStation(a,t,job);
      innerFlux(t,false);core(t);innerFlux(t,true);
      fieldRange(0,sectorCount/2);
      for(const a of order)if(locations.get(a.id).depth>=0)renderStation(a,t,job);
      ctx.setTransform(1,0,0,1,0,0);
    }
    function position(id) {
      const p=locations.get(id);
      if(!p)return null;
      const rect=canvas.getBoundingClientRect(),sx=rect.width/width||1,sy=rect.height/height||1;
      return {x:rect.left+(cx+p.x*radius)*sx,y:rect.top+(cy+p.y*radius)*sy,size:p.r*radius*2*Math.min(sx,sy)};
    }
    function hit(e) {
      const rect=canvas.getBoundingClientRect();
      const x=((e.clientX-rect.left)*width/rect.width-cx)/radius;
      const y=((e.clientY-rect.top)*height/rect.height-cy)/radius;
      for(const [id,p] of locations) {
        if(focusJob?.id===id && focusJob.away>.35)continue;
        if(Math.hypot(x-p.x,y-p.y)<p.r*1.33)return id;
      }
      return null;
    }
    function setHover(id){hovered=agentsById.has(id)?id:null;}
    canvas.addEventListener('pointermove',e=>{
      const id=hit(e);setHover(id);canvas.style.cursor=id?'pointer':'';
    });
    canvas.addEventListener('pointerleave',()=>setHover(null));
    canvas.addEventListener('click',e=>{const id=hit(e);if(id && onSelect)onSelect(id);});
    if(!observer)window.addEventListener('resize',()=>{needResize=true;});
    draw(0,null);
    return {draw,position,setHover};
  }
  window.paintDeskAgent=paintDeskAgent;
  window.createReactor=createReactor;
})();

;
/* Public Polymarket snapshots. Publish metadata, each book and each history independently. */
(() => {
  'use strict';
  const gamma = 'https://gamma-api.polymarket.com';
  const clob = 'https://clob.polymarket.com';
  const periods = new Map([['5m', 300], ['15m', 900]]);
  const cache = new Map();
  const list = value => typeof value === 'string' ? JSON.parse(value) : value;
  const number = value => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const price = value => {
    const n = number(value);
    return n !== null && n >= 0 && n <= 1 ? n : null;
  };

  function json(url, ttl, priority = 'auto') {
    const now = performance.now(), previous = cache.get(url);
    if (previous && now < previous.expires) return previous.promise;
    const entry = {expires: Infinity};
    entry.promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(url, {cache:'no-store', credentials:'omit', signal:controller.signal, priority});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        entry.expires = performance.now() + ttl;
        if (cache.size > 128) for (const [key, item] of cache) {
          if (item.expires <= performance.now()) cache.delete(key);
        }
        return data;
      } catch (error) {
        cache.delete(url);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    })();
    cache.set(url, entry);
    return entry.promise;
  }

  function levels(rows, bids) {
    if (!Array.isArray(rows)) throw new Error('Missing book side');
    return rows.map(row => {
      const p = price(row.price), qty = number(row.size);
      if (p === null || qty === null || qty < 0) throw new Error('Invalid book level');
      return [p, qty];
    }).filter(level=>level[1]>0).sort((a, b) => bids ? b[0] - a[0] : a[0] - b[0]);
  }

  async function book(tokenId, condition, name, startTime, endTime) {
    const raw = await json(clob + '/book?token_id=' + tokenId, 700, 'high');
    const at = number(raw.timestamp);
    if (raw.asset_id !== tokenId || raw.market?.toLowerCase() !== condition.toLowerCase() || at === null || at < startTime || at >= endTime || at > Date.now()+3000) {
      throw new Error('Book identity or timestamp mismatch');
    }
    return {name, tokenId, bookAvailable: true, bids: levels(raw.bids, true), asks: levels(raw.asks, false), at,
      tickSize: number(raw.tick_size), minSize: number(raw.min_order_size),
      negRisk: typeof raw.neg_risk === 'boolean' ? raw.neg_risk : null, lastTradePrice: price(raw.last_trade_price)};
  }

  async function readHistory(token, startTime, endTime) {
    const now = Date.now(), end = Math.min(endTime / 1000, (Math.floor(now / 15000) + 1) * 15);
    if (end <= startTime / 1000) return [];
    const args = new URLSearchParams({market: token, startTs: String(startTime / 1000), endTs: String(end), fidelity: '1'});
    const raw = await json(clob + '/prices-history?' + args, 15000, 'low');
    if (!Array.isArray(raw.history)) throw new Error('Missing price history');
    const points = new Map();
    for (const row of raw.history) {
      const stamp = number(row.t), p = price(row.p);
      if (stamp === null || p === null) continue;
      const t = stamp * 1000;
      if (t >= startTime && t <= Math.min(endTime, now)) points.set(t, p);
    }
    return [...points].sort((a,b) => a[0] - b[0]).map(([t,p]) => ({t,p}));
  }

  async function load(interval, seconds, isActive, onSnapshot) {
    const origin = performance.now(), spans = [];
    const slug = 'btc-updown-' + interval + '-' + seconds;
    const data = await json(gamma + '/markets/slug/' + slug, 6000);
    if (!isActive()) throw new DOMException('Market request expired', 'AbortError');
    const cfg = data.cryptoMarketConfig;
    const startTime = Date.parse(data.eventStartTime), endTime = Date.parse(data.endDate);
    if (data.slug !== slug || !/^Bitcoin Up or Down\b/i.test(data.question) || (cfg?.asset && cfg.asset.toLowerCase() !== 'btc')
      || (cfg?.duration && cfg.duration !== interval) || startTime !== seconds * 1000 || endTime - startTime !== periods.get(interval) * 1000
      || !/^0x[0-9a-f]{64}$/i.test(data.conditionId) || !['v1','v2'].includes(data.version)) throw new Error('BTC market identity mismatch');
    const labels = list(data.outcomes), ids = list(data.version === 'v2' ? data.positionIds : data.clobTokenIds);
    if (!Array.isArray(labels) || labels.length !== 2 || !Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2
      || !ids.every(t => typeof t === 'string' && /^[0-9]{1,78}$/.test(t))) throw new Error('Invalid official outcome tokens');
    const sides = ['up','down'], tokenIds = {}, names = {}, outcomeIndexes = {};
    for (const side of sides) {
      const i = labels.findIndex(label => typeof label === 'string' && label.toLowerCase() === side);
      if (i < 0) throw new Error('Missing Up/Down outcome');
      tokenIds[side] = ids[i]; names[side] = labels[i]; outcomeIndexes[side] = i;
    }
    spans.push({name:'gamma.lookup', start:0, duration:performance.now()-origin});
    const outcomes = {}, histories = {up:[], down:[]}, warnings = [];
    for (const side of sides) {
      outcomes[side] = {name:names[side], tokenId:tokenIds[side], bookAvailable:false, bids:[], asks:[], at:null,
        tickSize:null, minSize:null, negRisk:null, lastTradePrice:null, orderReady:false};
    }
    const active = data.acceptingOrders === true && data.active === true && data.closed === false
      && data.enableOrderBook === true && data.archived !== true && data.tradingEligible !== false;
    const meta = {slug, title:data.question, url:'https://polymarket.com/event/' + slug,
      startTime, endTime, interval, conditionId:data.conditionId, version:data.version, tokenIds, outcomeIndexes,
      resolutionSource:data.resolutionSource ?? null, description:data.description ?? null};

    function snapshot() {
      const receivedAt = Date.now();
      const stamps = sides.map(side => outcomes[side].at).filter(Number.isFinite);
      return {...meta, outcomes:{...outcomes}, histories:{...histories}, history:histories.up,
        warnings:[...warnings], asOf:stamps.length ? Math.min(...stamps) : null, receivedAt,
        acceptingOrders:active && startTime <= receivedAt && receivedAt < endTime,
        publicTrace:{spans:spans.slice(), total:performance.now()-origin}};
    }
    function publish() {
      if (onSnapshot && isActive()) onSnapshot(snapshot());
    }
    async function readPart(side, kind) {
      const began = performance.now();
      try {
        if (kind === 'book') {
          const o = await book(tokenIds[side], data.conditionId, names[side], startTime, endTime);
          if (!isActive()) return;
          const age = Date.now() - o.at;
          const fresh = age >= -3000 && age <= 10000;
          const validRules = o.tickSize > 0 && o.tickSize < 1 && o.minSize > 0 && typeof o.negRisk === 'boolean';
          outcomes[side] = {...o, orderReady:fresh && validRules};
          if (!fresh) warnings.push(side + ' order book timestamp is not fresh');
          if (!validRules) warnings.push(side + ' order rules unavailable');
        } else {
          const series = await readHistory(tokenIds[side], startTime, endTime);
          if (!isActive()) return;
          histories[side] = series;
        }
      } catch (error) {
        if (!isActive()) return;
        warnings.push(side + ' ' + kind + ' unavailable: ' + String(error));
      }
      spans.push({name:kind + '.' + side, start:began-origin, duration:performance.now()-began});
      publish();
    }

    // Token IDs are sufficient for the WebSocket subscription.
    publish();
    await Promise.all([readPart('up','book'), readPart('down','book'),
      readPart('up','history'), readPart('down','history')]);
    return snapshot();
  }

  // Each consumer can stop waiting immediately. Shared HTTP reads in json() can still
  // serve another consumer; none of their continuations may publish an obsolete window.
  function readWindow(interval, seconds, step, signal, onSnapshot) {
    return new Promise((resolve, reject) => {
      let active = true;
      const end = (seconds + step) * 1000;
      const isActive = () => active && !signal?.aborted && Date.now() < end;
      const abort = () => finish(reject, new DOMException('Market request ended', 'AbortError'));
      const timer = setTimeout(abort, Math.max(0, end - Date.now()) + 1);
      function finish(callback, value) {
        if (!active) return;
        active = false;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        callback(value);
      }
      signal?.addEventListener('abort', abort, {once:true});
      if (signal?.aborted) return abort();
      load(interval, seconds, isActive, onSnapshot).then(value => finish(resolve, value), error => finish(reject, error));
    });
  }

  window.readPMMarket = async function readPMMarket(interval, {signal, onSnapshot} = {}) {
    const step = periods.get(interval);
    if (!step) throw new Error('interval must be 5m or 15m');
    const current = () => Math.floor(Date.now() / (step * 1000)) * step;
    while (!signal?.aborted) {
      const start = current();
      try {
        const result = await readWindow(interval, start, step, signal, onSnapshot);
        if (current() === start) return result;
      } catch (error) {
        if (signal?.aborted || current() === start) throw error;
      }
    }
    throw new DOMException('Market request aborted', 'AbortError');
  };
})();

;
/* Public CLOB updates. Every new connection waits for its own complete book before applying deltas. */
(() => {
  'use strict';
  const endpoint='wss://ws-subscriptions-clob.polymarket.com/ws/market';
  const sides=['up','down'];
  const numeric=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(+v);
  const price=v=>numeric(v)&&+v>=0&&+v<=1;
  const size=v=>numeric(v)&&+v>=0;
  const blank=()=>({book:null,lastBook:null,samples:new Map(),recentTrades:[],seenTrades:new Set(),volumes:new Map(),lastPrice:null,tradeAt:0,tick:null});
  function createPMStream(onUpdate,{bookOnly=false}={}){
    let base=null,states={up:blank(),down:blank()},ws=null,retry=0,heartbeat=0,flush=0,epoch=0;
    let lastFrame=0,backoff=800,lastEventReceived=0,opening=0;
    function close(){
      ++epoch;clearTimeout(retry);clearTimeout(opening);clearInterval(heartbeat);clearTimeout(flush);flush=0;
      if(ws){ws.onclose=null;ws.onmessage=null;ws.onerror=null;ws.onopen=null;ws.close();ws=null;}
    }
    function stop(){close();base=null;states={up:blank(),down:blank()};backoff=800;lastEventReceived=0;}
    const mid=(bids,asks)=>bids.length&&asks.length&&bids[0][0]<=asks[0][0]?(bids[0][0]+asks[0][0])/2:null;
    function sample(state,t,p){
      if(p==null||!Number.isFinite(t)||t<base.startTime||t>=base.endTime||t>Date.now()+3000)return;
      const bucket=Math.floor(t/1000);
      if(!state.samples.has(bucket)||t>=state.samples.get(bucket).t)state.samples.set(bucket,{t,p});
    }
    function sorted(map,bids){return [...map].sort((a,b)=>bids?b[0]-a[0]:a[0]-b[0]);}
    function snapshot(){
      if(!base)return null;
      const outcomes={},histories={},marketTrades={},tradeVolumes={},now=Date.now();
      let streaming=false;
      for(const side of sides){
        const state=states[side],o=base.outcomes[side];
        // Keep the last full visible quote across a reconnect, without applying deltas to it.
        const b=state.lastBook&&(!state.book||state.lastBook.at>state.book.at)?state.lastBook:state.book;
        const connected=!!b&&b===state.book&&ws?.readyState===1;
        const use=!!b&&(!o.bookAvailable||b.at>o.at||(connected&&b.at===o.at));
        outcomes[side]={...o,bookSource:o.bookAvailable?'rest':null};
        if(use){
          const bids=sorted(b.bids,true),asks=sorted(b.asks,false);
          Object.assign(outcomes[side],{bids,asks,at:b.at,bookAvailable:true,bookSource:connected?'websocket':'last-websocket',tickSize:state.tick??o.tickSize});
          if(connected&&now-b.at<=10000)streaming=true;
          if(!bookOnly)sample(state,b.at,mid(bids,asks));
        }
        if(state.tradeAt>=(o.at||0))outcomes[side].lastTradePrice=state.lastPrice??o.lastTradePrice;
        if(bookOnly)continue;
        const history=new Map((base.histories?.[side]||[]).map(row=>[row.t,row.p]));
        for(const {t,p} of state.samples.values())history.set(t,p);
        histories[side]=[...history].sort((a,b)=>a[0]-b[0]).map(([t,p])=>({t,p}));
        marketTrades[side]=state.recentTrades.slice().sort((a,b)=>a.t-b.t);
        tradeVolumes[side]=Array.from(state.volumes,([t,totals])=>({t,...totals}));
      }
      const stamps=sides.map(side=>outcomes[side].at).filter(Number.isFinite);
      return {...base,outcomes,histories,history:histories.up,marketTrades,tradeVolumes,streaming,asOf:stamps.length?Math.min(...stamps):null,
        receivedAt:Math.max(base.receivedAt||0,lastEventReceived)};
    }
    function queue(){if(!flush)flush=setTimeout(()=>{flush=0;const s=snapshot();if(s)onUpdate(s);},180);}
    function identity(asset){return sides.find(side=>base.tokenIds[side]===asset);}
    function rows(levels){
      if(!Array.isArray(levels))return null;
      const map=new Map();
      for(const v of levels){if(!price(v.price)||!size(v.size))return null;if(+v.size>0)map.set(+v.price,+v.size);}
      return map;
    }
    function event(e){
      if(!base||!e||typeof e.market!=='string'||e.market.toLowerCase()!==base.conditionId.toLowerCase())return false;
      const t=Number(e.timestamp);
      if(!Number.isFinite(t)||t<base.startTime||t>=base.endTime||t>Date.now()+3000)return false;
      const side=identity(e.asset_id),state=side&&states[side];
      if(e.event_type==='book'&&state){
        if(state.book?.at>t)return false;
        const bids=rows(e.bids),asks=rows(e.asks);
        if(!bids||!asks)return false;
        state.book={at:t,bids,asks};
        if(price(e.tick_size)&&+e.tick_size>0)state.tick=+e.tick_size;
        if(t>=state.tradeAt&&price(e.last_trade_price)){state.tradeAt=t;state.lastPrice=+e.last_trade_price;}
        return true;
      }
      if(e.event_type==='price_change'&&Array.isArray(e.price_changes)){
        let any=false;
        for(const item of e.price_changes){
          const s=identity(item.asset_id),b=s&&states[s].book;
          if(!b||t<b.at||!price(item.price)||!size(item.size)||!['BUY','SELL'].includes(item.side))continue;
          const map=item.side==='BUY'?b.bids:b.asks;
          if(+item.size>0)map.set(+item.price,+item.size);else map.delete(+item.price);
          b.at=t;any=true;
        }
        return any;
      }
      if(!bookOnly&&e.event_type==='last_trade_price'&&state&&price(e.price)&&size(e.size)&&+e.size>0){
        const entry={t,p:+e.price,size:+e.size,side:e.side};
        const id=[e.transaction_hash||'',t,e.asset_id,e.price,e.size,e.side].join('|');
        if(state.seenTrades.has(id))return false;
        state.seenTrades.add(id);
        // Keep the tape short. Each contract retains its observed minute totals
        // and event identities until rollover, even across a socket reconnect.
        state.recentTrades.push({id,...entry});
        if(state.recentTrades.length>128)state.recentTrades.shift();
        const bucket=Math.floor(t/60000)*60000;
        const totals=state.volumes.get(bucket)||{size:0,notional:0};
        totals.size+=entry.size;
        totals.notional+=entry.size*entry.p;
        state.volumes.set(bucket,totals);
        if(t>=state.tradeAt){state.tradeAt=t;state.lastPrice=entry.p;}
        return true;
      }
      if(e.event_type==='tick_size_change'&&state&&price(e.new_tick_size)&&+e.new_tick_size>0){
        state.tick=+e.new_tick_size;return true;
      }
      return false;
    }
    function connect(){
      if(!base||Date.now()>=base.endTime||typeof WebSocket==='undefined')return;
      const gen=epoch;
      let socket;
      try{socket=new WebSocket(endpoint);}catch{reconnect();return;}
      ws=socket;lastFrame=Date.now();
      opening=setTimeout(()=>{if(gen===epoch&&socket.readyState===WebSocket.CONNECTING)socket.close();},12000);
      socket.onopen=()=>{
        if(gen!==epoch)return;
        clearTimeout(opening);
        socket.send(JSON.stringify({assets_ids:sides.map(k=>base.tokenIds[k]),type:'market'}));
        heartbeat=setInterval(()=>{
          if(Date.now()-lastFrame>26000){socket.close();return;}
          if(socket.readyState===WebSocket.OPEN)socket.send('PING');
        },9000);
      };
      socket.onmessage=message=>{
        if(gen!==epoch||!base||base.endTime<=Date.now())return;
        lastFrame=Date.now();if(message.data==='PONG')return;
        let data;try{data=JSON.parse(message.data);}catch{return;}
        let didUpdate=false;
        for(const e of Array.isArray(data)?data:[data])if(event(e)){
          didUpdate=true;lastEventReceived=Date.now();backoff=800;
          // Research consumes the first observed book, including an empty top
          // level. Chart rendering can still coalesce a burst into one frame.
          if(bookOnly)onUpdate(snapshot());
        }
        if(didUpdate&&!bookOnly)queue();
      };
      socket.onclose=()=>{
        if(gen!==epoch)return;
        clearTimeout(opening);clearInterval(heartbeat);ws=null;
        for(const side of sides){
          const state=states[side];
          if(state.book&&(!state.lastBook||state.book.at>=state.lastBook.at))state.lastBook=state.book;
          state.book=null;
        }
        queue();reconnect();
      };
      socket.onerror=()=>socket.close();
    }
    function reconnect(){retry=setTimeout(connect,backoff);backoff=Math.min(12000,2*backoff);}
    function combineHistory(previous=[],incoming=[]){
      if(!incoming.length||incoming===previous)return previous;
      if(!previous.length)return incoming;
      const byTime=new Map(previous.map(point=>[point.t,point]));
      for(const point of incoming)byTime.set(point.t,point);
      return Array.from(byTime.values()).sort((a,b)=>a.t-b.t);
    }
    function accept(next){
      if(!next || Date.now()<next.startTime || Date.now()>=next.endTime)return snapshot();
      const changed=base?.conditionId!==next.conditionId||sides.some(s=>base?.tokenIds?.[s]!==next.tokenIds[s]);
      if(changed)stop();
      const outcomes={},histories={};
      for(const side of sides){
        const incoming=next.outcomes[side],previous=base?.outcomes[side];
        const valid=incoming.tokenId===next.tokenIds[side]&&incoming.bookAvailable
          &&Number.isFinite(incoming.at)&&incoming.at>=next.startTime&&incoming.at<next.endTime;
        if(valid&&(!previous?.bookAvailable||incoming.at>=previous.at))outcomes[side]=incoming;
        else if(previous)outcomes[side]=previous;
        else outcomes[side]={...incoming,bookAvailable:false,orderReady:false,bids:[],asks:[],at:null,lastTradePrice:null};
        histories[side]=combineHistory(base?.histories?.[side],next.histories?.[side]);
      }
      base={...next,outcomes,histories,history:histories.up};
      for(const side of sides){
        const o=outcomes[side];
        if(!bookOnly&&o.bookAvailable)sample(states[side],o.at,mid(o.bids,o.asks));
      }
      if(changed)connect();
      return snapshot();
    }
    return {accept,stop,latest:snapshot};
  }
  if(typeof module==='object'&&module.exports)module.exports={createPMStream};
  else window.createPMStream=createPMStream;
})();

;
/* BTC-USD is an independent Coinbase Exchange reference, not Polymarket's resolution feed. */
(() => {
  'use strict';
  const REST = 'https://api.exchange.coinbase.com/products/BTC-USD/';
  const SOCKET = 'wss://ws-feed.exchange.coinbase.com';
  const SOURCE = 'Coinbase Exchange · BTC/USD';
  const MINUTE = 60000, COUNT = 120;
  const numeric = x => (typeof x === 'number' || (typeof x === 'string' && x.trim())) && Number.isFinite(+x) ? +x : null;

  function parseCandles(data, start, now) {
    if (!Array.isArray(data)) throw Error('分钟 K 线返回格式异常');
    const buckets = new Map();
    for (const row of data) {
      if (!Array.isArray(row) || row.length < 6) throw Error('分钟 K 线字段缺失');
      const [sec,l,h,o,c,v] = row.slice(0,6).map(numeric);
      if (sec === null || !Number.isInteger(sec) || sec % 60 || !(l > 0 && h >= l && o >= l && o <= h && c >= l && c <= h) || v === null || v < 0) {
        throw Error('分钟 K 线字段异常');
      }
      const t = sec * 1000;
      if (t >= start && t <= now) buckets.set(t,{t,o,h,l,c,v,confirmed:t+MINUTE<=now});
    }
    const candles = [...buckets.values()].sort((a,b) => a.t-b.t).slice(-COUNT);
    if (!candles.length) throw Error('交易所暂未返回分钟 K 线');
    return candles;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {parseCandles};
    return;
  }
  window.createBTCSpot = function createBTCSpot(onChange) {
    let state = {candles:[],price:null,at:null,source:SOURCE,status:'idle',error:'',transport:null};
    let wanted = false, active = false, disposed = false, generation = 0;
    let timer = null, socket = null, socketSince = 0, lastWire = 0, lastSocketPrice = 0, reconnectAt = 0, attempts = 0, connectedBefore = false;
    let candleAt = 0, tickerAt = 0, firstRead = true, candleError = '', tickerError = '', tradeId = null;
    let revision = 0, emittedRevision = -1;
    const requests = new Map();

    function publish() {
      const now = Date.now();
      const latest = state.candles.at(-1)?.t ?? null;
      const warnings = [];
      let status = 'idle';
      if (active) {
        if (candleError) warnings.push(candleError);
        if (latest !== null && now - latest > 2 * MINUTE) warnings.push('分钟 K 线已过期');
        if (latest !== null && state.candles.length < 80) warnings.push('交易所仅返回 '+state.candles.length+' 根有效分钟 K 线');
        if (state.at !== null && now - state.at > 20000) warnings.push('最新成交价超过 20 秒');
        if (tickerError && (!state.at || now-state.at>20000)) warnings.push(tickerError);
        if (firstRead) status = 'loading';
        else if (!latest || state.at === null) status = latest || state.at !== null ? 'stale' : 'error';
        else status = warnings.length ? 'stale' : 'live';
      }
      const error = warnings.join('；');
      if (revision === emittedRevision && status === state.status && error === state.error) return;
      emittedRevision = revision;
      state = {...state,status,error};
      if (typeof onChange === 'function') onChange(state);
    }

    function quote(data,transport) {
      const p = numeric(data?.price), t = Date.parse(data?.time), id = numeric(data?.trade_id);
      if (!(p > 0) || !Number.isFinite(t) || t <= 0 || t > Date.now()+5000) return false;
      if (state.at !== null && (t < state.at || (t === state.at && id !== null && tradeId !== null && id < tradeId))) return true;
      if (p !== state.price || t !== state.at || state.transport !== transport) {
        state = {...state,price:p,at:t,transport};
        revision++;
      }
      tradeId = id;
      tickerError = '';
      return true;
    }

    function request(kind,url,onData) {
      if (requests.has(kind) || !active) return;
      const gen = generation, ctl = new AbortController();
      const alarm = setTimeout(()=>ctl.abort(),8500);
      requests.set(kind,{ctl,alarm});
      (async () => {
        try {
          const res = await fetch(url,{cache:'no-store',credentials:'omit',signal:ctl.signal});
          if (!res.ok) throw Error('HTTP '+res.status);
          const data = await res.json();
          if (active && gen===generation) onData(data);
        } catch (err) {
          if (!active || gen!==generation) return;
          const reason = ctl.signal.aborted ? '请求超时' : /^HTTP \d+$/.test(err.message) ? err.message : '网络或交易所数据不可用';
          if (kind==='candles') {candleError='分钟 K 线刷新失败：'+reason;candleAt=Date.now()+9000;}
          else {tickerError='成交价读取失败：'+reason;tickerAt=Date.now()+5000;}
        } finally {
          clearTimeout(alarm);
          if (requests.get(kind)?.ctl===ctl) requests.delete(kind);
          if (active && gen===generation) {
            if (!requests.size) firstRead=false;
            publish();
          }
        }
      })();
    }

    function candles(now) {
      const start = Math.floor(now/MINUTE)*MINUTE - (COUNT-1)*MINUTE;
      const latest = state.candles.at(-1)?.t;
      // Refresh the forming candle and the preceding close without repeatedly
      // requesting the entire chart. After a gap, fetch the full time range.
      const readFrom = latest && now-latest < 2*MINUTE ? Math.max(start,latest-MINUTE) : start;
      const params = new URLSearchParams({granularity:'60',start:new Date(readFrom).toISOString(),end:new Date(now).toISOString()});
      candleAt = now + 10000;
      request('candles',REST+'candles?'+params,data=>{
        const fresh = parseCandles(data,readFrom,now);
        const byTime = new Map(state.candles.filter(row=>row.t>=start).map(row=>[row.t,row]));
        for (const row of fresh) byTime.set(row.t,row);
        state={...state,candles:[...byTime.values()].sort((a,b)=>a.t-b.t).slice(-COUNT)};
        candleError='';revision++;
      });
    }
    function ticker(now) {
      tickerAt=now+5000;
      request('ticker',REST+'ticker',data=>{if(!quote(data,'REST'))throw Error('成交价返回格式异常');});
    }
    function dropSocket() {
      const old = socket;
      socket=null;
      if (!old) return;
      old.onmessage=null;old.onopen=null;old.onerror=null;old.onclose=null;
      try { old.close(); } catch {}
    }
    function scheduleReconnect(now) {
      dropSocket();
      reconnectAt=now+Math.min(30000,1000*2**Math.min(attempts,5));
      attempts++;
    }
    function connect(now) {
      const gen=generation;
      let ws;
      try { ws=new WebSocket(SOCKET); }
      catch { scheduleReconnect(now);return; }
      socket=ws;socketSince=now;lastWire=now;lastSocketPrice=0;
      const current=()=>active && generation===gen && socket===ws;
      ws.onopen=()=>{
        if (!current()) return;
        if (connectedBefore) candleAt=0;
        connectedBefore=true;
        ws.send(JSON.stringify({type:'subscribe',product_ids:['BTC-USD'],channels:['ticker','heartbeat']}));
      };
      ws.onmessage=e=>{
        if (!current()) return;
        let data;
        try { data=JSON.parse(e.data); } catch { return; }
        if (data.type==='error') {scheduleReconnect(Date.now());return;}
        if (data.product_id!=='BTC-USD') return;
        if (data.type==='heartbeat' || data.type==='ticker') {lastWire=Date.now();attempts=0;}
        if (data.type==='ticker' && quote(data,'WebSocket')) lastSocketPrice=Date.now();
      };
      ws.onerror=()=>{if(current())scheduleReconnect(Date.now());};
      ws.onclose=()=>{if(current())scheduleReconnect(Date.now());};
    }

    function step() {
      if (!active) return;
      const now=Date.now();
      if (socket && (now-lastWire>14000 || now-(lastSocketPrice||socketSince)>25000)) scheduleReconnect(now);
      if (!socket && now>=reconnectAt) connect(now);
      if (now>=candleAt && !requests.has('candles')) candles(now);
      if (now>=tickerAt && !requests.has('ticker') && (!lastSocketPrice || now-lastSocketPrice>9000)) ticker(now);
      publish();
    }
    function sync() {
      const next=wanted && !disposed && !document.hidden;
      if (active===next) return;
      active=next;generation++;
      clearInterval(timer);timer=null;dropSocket();
      for (const {ctl,alarm} of requests.values()){clearTimeout(alarm);ctl.abort();}
      requests.clear();
      if (!active) {publish();return;}
      reconnectAt=0;attempts=0;connectedBefore=false;lastSocketPrice=0;
      candleAt=0;tickerAt=0;firstRead=true;candleError='';tickerError='';
      timer=setInterval(step,700);step();
    }
    function online() {
      if (!active) return;
      dropSocket();lastSocketPrice=0;reconnectAt=0;candleAt=0;tickerAt=0;step();
    }
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('online',online);
    return {
      setVisible(value){wanted=Boolean(value);sync();},
      getState(){return state;},
      destroy(){disposed=true;wanted=false;sync();document.removeEventListener('visibilitychange',sync);window.removeEventListener('online',online);}
    };
  };
})();

;
/* Keep the phone depth table on the same quote and scan target as the original tape. */
(() => {
  'use strict';
  const narrow = matchMedia('(max-width: 900px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const cents = price => Number.isFinite(price) ? number.format(price * 100) + '¢' : '—';
  let layout = null;
  let selection = null;

  function buildTable(chart, target) {
    const region = document.createElement('div');
    region.className = 'mobile-depth';
    region.id = 'live-depth';
    region.tabIndex = -1;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', '所选合约买卖五档');
    const table = document.createElement('table');
    const caption = table.createCaption();
    const head = table.createTHead().insertRow();
    for (const label of ['买价 (¢)', '数量 (份)', '卖价 (¢)', '数量 (份)']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      head.append(cell);
    }
    const body = table.createTBody();
    const rows = Array.from({length: 5}, () => {
      const row = body.insertRow();
      return Array.from({length: 4}, () => row.insertCell());
    });
    const refresh = document.getElementById('refresh');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'depth-retry';
    retry.textContent = '刷新盘口';
    retry.addEventListener('click', () => refresh.click());
    region.append(table, retry, target);
    target.style.left = '73%';
    target.style.top = '32%';
    chart.after(region);
    const visibility = new IntersectionObserver(([entry]) => {
      if (layout?.region === region) layout.visible = entry.isIntersecting;
    });
    visibility.observe(region);
    return {region, caption, rows, retry, refresh, chart, target, visibility, visible: false};
  }

  function syncTable() {
    if (!narrow.matches) {
      if (layout) {
        layout.visibility.disconnect();
        layout.chart.append(layout.target);
        layout.region.remove();
        layout = null;
      }
      return;
    }
    if (!selection) return;
    if (!layout) {
      const chart = document.querySelector('#live-tape .pmd-plot');
      const target = chart?.querySelector('[data-target="taker"]');
      if (!target) return;
      layout = buildTable(chart, target);
    }
    const {snapshot, interval, side, stale} = selection;
    const now = Date.now();
    const book = snapshot?.interval === interval && now >= snapshot.startTime && now < snapshot.endTime
      ? snapshot.outcomes?.[side] : null;
    const available = book?.bookAvailable && Number.isFinite(book.at);
    const bids = available ? book.bids.slice(0, 5) : [];
    const asks = available ? book.asks.slice(0, 5) : [];
    const mid = bids.length && asks.length && asks[0][0] >= bids[0][0] ? (bids[0][0] + asks[0][0]) / 2 : null;
    const status = !available ? '等待本期五档盘口' : stale ? '上次盘口' : '五档盘口';
    const caption = interval + ' · ' + side.toUpperCase() + ' · ' + status + (available ? '　中间价 ' + cents(mid) : '');
    if (layout.caption.textContent !== caption) layout.caption.textContent = caption;
    layout.retry.hidden = Boolean(available && !stale);
    layout.retry.disabled = layout.refresh.disabled;
    const peak = Math.max(1, ...bids.map(level => level[1]), ...asks.map(level => level[1]));
    for (const [index, cells] of layout.rows.entries()) {
      for (const [side, level] of [bids[index], asks[index]].entries()) {
        const price = level ? cents(level[0]) : '—';
        const size = level ? number.format(level[1]) : '—';
        const priceCell = cells[side * 2], sizeCell = cells[side * 2 + 1];
        if (priceCell.textContent !== price) priceCell.textContent = price;
        if (sizeCell.textContent !== size) {
          if (sizeCell.textContent && !reducedMotion.matches && layout.visible) {
            sizeCell.animate([{opacity: .52}, {opacity: 1}], {duration: 170});
          }
          sizeCell.textContent = size;
        }
        const depth = (level ? (100 * level[1] / peak).toFixed(1) : '0') + '%';
        if (sizeCell.style.getPropertyValue('--depth') !== depth) sizeCell.style.setProperty('--depth', depth);
      }
    }
  }
  function updateBook(snapshot, interval, side, stale) {
    selection = {snapshot, interval, side, stale};
    syncTable();
  }
  narrow.addEventListener('change', syncTable);
  window.GrokMobilePanels = {narrow, updateBook};
})();

;
(() => {
  'use strict';
  const mono = '"SFMono-Regular",Menlo,Consolas,"Liberation Mono",monospace';
  const green='#008b70',red='#d82960',purple='#7d58ac',navy='#232f42',muted='#647285',grid='#dde1e8';
  const colors=['#2584b0','#06877a','#72ad6a','#d3a335','#e47540','#cf3e73','#9349ab'];
  const style = `
    [data-pm-panel].pmd-panel { position:relative; display:flex; flex-direction:column; min-width:0; overflow:hidden; background:#fff; color:#171924; container-type:inline-size; border:1px solid #d6dae2; border-radius:5px; box-sizing:border-box; }
    .pmd-panel *, .pmd-panel *::after { box-sizing:border-box; }
    .pmd-title { display:flex; align-items:center; gap:7px; flex:none; min-height:23px; padding:4px 9px; font:700 9px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:.115em; color:#171924; background:linear-gradient(100deg,#f3f8f7,#f6f6fa 68%,#f0f5f2); border-bottom:1px solid #e1e5e8; white-space:nowrap; }
    .pmd-title b { font:inherit; }
    .pmd-diamond { width:5px;height:5px;flex:none;transform:rotate(45deg);background:#181b25; }
    .pmd-subtitle,.pmd-id,.pmd-micro,.pmd-kpis,.pmd-quote small,.pmd-foot,.pmd-note,.pmd-pulse,.pmd-breakdown { font-family:${mono}; }
    .pmd-subtitle,.pmd-id { font-size:8px;font-weight:500;letter-spacing:.045em; overflow:hidden; text-overflow:ellipsis; }
    .pmd-subtitle { color:#69717d; }
    .pmd-id { color:#666f78; margin-left:auto;flex:none; }
    .pmd-panel[data-active="true"] .pmd-diamond {background:var(--dc-signal,#008d77);box-shadow:0 0 7px var(--dc-signal,#008d77);}
    .pmd-main { position:relative; display:flex; flex-direction:column; min-height:0; flex:1; gap:0; }
    .pmd-main > :not(.pmd-plot) { flex:none; }
    .pmd-micro { display:flex; align-items:center; gap:5px; margin:7px 10px 0; font-size:8px; letter-spacing:.045em; color:#6e7882; height:11px; }
    .pmd-micro i { width:4px;height:4px;border-radius:50%;background:#039b82; }
    .pmd-micro b { color:#28353d; font-weight:700; }
    .pmd-quote { padding:5px 10px 4px; display:flex; gap:9px; align-items:center; min-width:0; }
    .pmd-quote strong { font:740 clamp(19px,5.7cqw,35px)/1.03 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.06em;white-space:nowrap;font-variant-numeric:tabular-nums; }
    .pmd-quote small { color:#596770; display:block; margin-top:3px; line-height:1.22;font-size:8px; letter-spacing:.025em; }
    .pmd-pulse { display:inline-block; font-size:9px;line-height:1.15;font-weight:700;background:#e4f3ec;color:#047d65;border:1px solid #bfdfd4; padding:2px 5px;border-radius:3px; white-space:nowrap; }
    .pmd-pulse.loss {color:#b72541;background:#fff0f1;border-color:#f4c1c9;}
    .pmd-kpis { display:flex; align-items:stretch; margin:2px 9px 0;border-top:1px solid #ecedf1;border-bottom:1px solid #ecedf1; padding:4px 0; }
    .pmd-kpis > div { flex:1 1 0;min-width:0;border-left:1px solid #e4e8eb;padding-left:7px; }
    .pmd-kpis > div:first-child {padding-left:0;border-left:0;}
    .pmd-kpis span,.pmd-breakdown span { display:block; color:#737c87; font-size:7px;letter-spacing:.055em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .pmd-kpis b { display:block; margin-top:2px; font:700 11px/1.1 ${mono}; font-variant-numeric:tabular-nums;white-space:nowrap; }
    .pmd-plot { position:relative; flex:1 1 auto; min-height:38px; overflow:hidden; }
    .pmd-plot canvas {display:block; width:100%;height:100%;position:absolute;inset:0;}
    .pmd-hit { position:absolute; width:2px;height:2px; transform:translate(-50%,-50%); pointer-events:none; z-index:1; }
    .pmd-hit.is-targeted::after { content:""; position:absolute;width:17px;height:17px;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid var(--dc-signal,#008d77);border-radius:50%;box-shadow:0 0 0 4px color-mix(in srgb,var(--dc-signal,#008d77) 13%,transparent); }
    .pmd-foot { display:flex; flex:none; align-items:center; justify-content:space-between; min-height:18px;border-top:1px solid #ecedf1;padding:4px 9px; gap:6px; font-size:7.5px;letter-spacing:.025em;color:#56616d;white-space:nowrap;overflow:hidden; }
    .pmd-foot span {overflow:hidden;text-overflow:ellipsis;} .pmd-foot b {color:#26323c;font-weight:700;}
    .pmd-tape .pmd-quote { justify-content:space-between;gap:5px; align-items:flex-start; padding:7px 10px 2px; }
    .pmd-tape .pmd-quote strong {font-size:clamp(20px,4.5cqw,31px);}
    .pmd-tape .pmd-quote strong em {font-size:.47em; letter-spacing:0;font-style:normal;}
    .pmd-tape .pmd-quote small {margin-top:2px;font-size:7px;}
    .pmd-tape .pmd-quote .pmd-pulse {vertical-align:middle;margin-left:8px;}
    .pmd-breakdown { display:flex; gap:12px; text-align:right; font-size:11px; font-weight:bold; padding-top:1px; }
    .pmd-breakdown span {font-size:7px; font-weight:500; margin-top:2px;}
    .pmd-breakdown div:nth-child(2) {color:#7650bb;}
    .pmd-prior .pmd-kpis,.pmd-latency .pmd-kpis {margin:4px 8px 1px;padding:3px 0;border-top:0;}
    .pmd-prior .pmd-kpis b,.pmd-latency .pmd-kpis b {font-size:11px;}
    .pmd-prior .pmd-kpis > div,.pmd-latency .pmd-kpis > div {border-left:0; border-bottom:2px solid var(--dc-kpi-color,#b3d5db);padding:2px 3px; margin:0 2px 0 0;background:linear-gradient(180deg,transparent,#f4f6f8);border-radius:2px;}
    .pmd-prior .pmd-kpis > div:nth-child(2),.pmd-latency .pmd-kpis > div:nth-child(2) {--dc-kpi-color:#f8c680;}
    .pmd-prior .pmd-kpis > div:nth-child(3),.pmd-latency .pmd-kpis > div:nth-child(3) {--dc-kpi-color:#c6b1e6;}
    .pmd-prior .pmd-kpis > div:nth-child(4),.pmd-latency .pmd-kpis > div:nth-child(4) {--dc-kpi-color:#89baa8;}
    @container (max-width: 350px) {
      .pmd-title { padding:4px 6px; gap:5px; letter-spacing:.075em; font-size:8px;min-height:19px;}
      .pmd-subtitle,.pmd-id { font-size:7px; }
      .pmd-id { max-width:35%; }
      .pmd-kpis {margin-inline:6px;} .pmd-kpis b,.pmd-prior .pmd-kpis b,.pmd-latency .pmd-kpis b {font-size:9px;}
      .pmd-quote {padding-inline:7px;} .pmd-micro {margin-inline:7px;}
      .pmd-breakdown {gap:4px;font-size:9px;}
      .pmd-kpis span,.pmd-breakdown span {letter-spacing:0;font-size:6.8px;}
      .pmd-tape .pmd-quote .pmd-pulse {margin-left:3px;} .pmd-tape .pmd-quote {padding-inline:6px;}
      .pmd-foot {padding-inline:6px; font-size:7px; }
    }
    @container (max-width: 245px) {
      .pmd-subtitle {display:none;} .pmd-breakdown div:last-child,.pmd-kpis div:nth-child(4) {display:none;}
      .pmd-quote {gap:4px;} .pmd-quote small {font-size:7px;} .pmd-pulse {font-size:7px;padding:2px 3px;}
    }
  
    .pmd-plot canvas[data-overlay]{pointer-events:none;z-index:1;}
    .pmd-help{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:6px 12px;font:500 10px/1.42 -apple-system,system-ui,sans-serif;color:#687484;pointer-events:none;z-index:1}
    .pmd-help:empty{display:none}
    .pmd-hit{z-index:2}
    .pmd-panel[data-stale="true"] .pmd-id{color:#a7672b}
    .pmd-panel[data-focus="true"] .pmd-diamond{background:var(--pmd-agent,#148c76)}
    .pmd-panel .pmd-foot span{white-space:nowrap}
    .pmd-classic-note{padding:2px 7px 0;min-height:11px;font:500 7px/1.2 ${mono};color:#72788a}
  `;
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const price=v=>finite(v)&&v>=0&&v<=1;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const fmt=(n,k=0)=>finite(n)?Number(n).toLocaleString('en-US',{maximumFractionDigits:k}):'—';
  const cents=v=>price(v)?fmt(v*100,2)+'¢':'—';
  const dollars=v=>finite(v)?(v<0?'−':'')+'$'+fmt(Math.abs(v),2):'—';
  const signed=(v,k=2)=>finite(v)?(v>0?'+':v<0?'−':'')+fmt(Math.abs(v),k):'—';
  const compact=n=>!finite(n)?'—':Math.abs(n)>=1e6?fmt(n/1e6,1)+'M':Math.abs(n)>=1e3?fmt(n/1e3,1)+'K':fmt(n,2);
  const time=(t,sec=false)=>finite(t)&&t>0?new Date(+t).toISOString().slice(11,sec?19:16):'—';
  const ms=v=>finite(v)?(+v>=1000?fmt(v/1000,2)+'s':fmt(v,1)+'ms'):'—';
  const font='"SFMono-Regular",Menlo,Consolas,monospace';
  const roles={pnl:['kelly'],tape:['spotter','taker'],prior:['prior','edge'],latency:['closer']};
  const accent={kelly:'#8249d5',taker:'#287fe0',spotter:green,prior:'#d89325',edge:'#d93c86',closer:'#e55732'};
  const h=(tag,k,cls='')=>'<'+tag+' class="'+cls+'" data-key="'+k+'">—</'+tag+'>';
  function heading(title,subtitle,action){
    const badge=action==='timing'?'<button type="button" class="pmd-id" data-key="badge" aria-label="切换实测耗时记录来源">TRACE</button>':h('span','badge','pmd-id');
    return '<div class="pmd-title"><i class="pmd-diamond"></i><b>'+title+'</b><span class="pmd-subtitle">'+subtitle+'</span>'+badge+'</div>';
  }
  const kpis=names=>'<div class="pmd-kpis">'+names.map((s,i)=>'<div><span>'+s+'</span>'+h('b','k'+i)+'</div>').join('')+'</div>';
  const plot=(key,label)=>'<div class="pmd-plot"><canvas role="img" aria-label="'+label+'"></canvas><canvas data-overlay aria-hidden="true"></canvas><span class="pmd-help"></span>'+roles[key].map(id=>'<i class="pmd-hit" data-target="'+id+'" aria-hidden="true"></i>').join('')+'</div>';
  const foot='<div class="pmd-foot">'+h('span','footL')+h('span','footR')+'</div>';
  const templates={
    pnl:heading('P&L ATTRIBUTION','MARKET DEPTH · SIX BANDS')+'<div class="pmd-main"><div class="pmd-micro"><i></i><b>GROK DESK</b> / BOOK DEPTH · SHARES</div><div class="pmd-quote"><div style="display:flex;align-items:baseline;gap:3px">'+h('strong','quote')+'<small>份</small></div><div>'+h('span','delta','pmd-pulse')+'<small>WINDOW CHANGE</small></div></div>'+kpis(['SAMPLES','TAPE VOLUME','AVG. MOVE','MAX. MOVE'])+plot('pnl','本页观测的双边前五档挂单份额，按买一、买二、买三至五与对应卖档叠加。')+foot+'</div>',
    tape:heading('THE TAPE','1M · CANDLESTICKS · VWAP')+'<div class="pmd-main"><div class="pmd-quote"><div>'+h('strong','quote')+h('span','delta','pmd-pulse')+h('small','source')+'</div><div class="pmd-breakdown"><div title="最近分钟收盘价的 14 期 Wilder RSI，至少需要 15 个收盘价">'+h('b','rsi')+'<span>RSI 14</span></div><div>'+h('b','vwap')+h('span','vwapLabel')+'</div><div title="图内实际有报价的分钟数">'+h('b','bars')+'<span>BARS</span></div></div></div>'+plot('tape','分钟蜡烛、14 期指数均线、成交量加权价格及所选合约的真实买卖盘')+foot+'</div>',
    prior:heading('THE PRIOR','FAN OF HISTORICAL PATHS')+'<div class="pmd-main">'+kpis(['CURRENT','MEDIAN Δ','VOL / STEP','HORIZON'])+plot('prior','实际历史价格、从当前点对齐回放的历史价差路径及其终点密度')+foot+'</div>',
    latency:heading('TICK-TO-TRADE','EVERY TURN AS A SPAN','timing')+'<div class="pmd-main">'+kpis(['LATENCY','P95','SPANS','ERRORS'])+plot('latency','本次请求实际采集的执行时间瀑布图')+foot+'</div>'
  };

  function pen(canvas,w,h){
    const c=canvas.getContext('2d');if(!c)return null;
    const minText=window.GrokMobilePanels.narrow.matches?10:0;
    const dx=canvas.width/w,dy=canvas.height/h;c.setTransform(dx,0,0,dy,0,0);c.clearRect(0,0,w,h);
    const line=(pts,color,width=1,dash=[])=>{if(!pts.length)return;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);};
    const fill=(pts,color)=>{if(!pts.length)return;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
    const dot=(x,y,col,r=2)=>{c.beginPath();c.fillStyle=col;c.arc(x,y,r,0,Math.PI*2);c.fill();};
    const txt=(s,x,y,col=muted,size=7,align='left',weight=500)=>{c.font=weight+' '+Math.max(size,minText)+'px '+font;c.fillStyle=col;c.textAlign=align;c.textBaseline='middle';c.fillText(String(s),x,y);};
    const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
    const gr=(y0,y1,a,b)=>{const g=c.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g;};
    return {c,w,h,line,fill,dot,txt,rect,gr};
  }
  function hist(s,id){
    const a=s?.histories?.[id]??(id==='up'?s?.history:[]);
    return Array.isArray(a)?a.filter(q=>finite(q?.t)&&q.t>0&&price(q.p)).map(q=>({t:+q.t,p:+q.p})).sort((a,b)=>a.t-b.t):[];
  }
  function levels(rows,buy){
    return Array.isArray(rows)?rows.filter(q=>Array.isArray(q)&&price(q[0])&&finite(q[1])&&q[1]>0)
      .map(q=>[+q[0],+q[1]]).sort((a,b)=>buy?b[0]-a[0]:a[0]-b[0]):[];
  }
  function agg(points){
    const rows=[];for(const v of points){const t=Math.floor(v.t/60000)*60000,q=rows.at(-1);
      if(q?.t===t){q.h=Math.max(q.h,v.p);q.l=Math.min(q.l,v.p);q.c=v.p;q.n++;}
      else rows.push({t,o:v.p,h:v.p,l:v.p,c:v.p,n:1});}
    return rows;
  }
  function range(values,margin=.10,floor=.009) {
    let lo=Infinity,hi=-Infinity;for(const v of values){lo=Math.min(lo,v);hi=Math.max(hi,v);}
    const pad=Math.max(floor,(hi-lo)*margin);return [lo-pad,hi+pad];
  }
  function set(p,k,val){if(p.values[k]&&p.values[k].textContent!==String(val))p.values[k].textContent=String(val);}
  function mark(p,id,x,y){const a=p.targets[id];if(!a)return;a.style.left=clamp(x,1,Math.max(1,p.w-1))+'px';a.style.top=clamp(y,1,Math.max(1,p.h-1))+'px';}
  function four(p,v){v.forEach((t,i)=>set(p,'k'+i,t));}
  function empty(p,text){p.help.textContent=text;}
  function pulse(p,v){p.values.delta.classList.toggle('loss',finite(v)&&v<0);}
  function gridY(g,x0,x1,y0,y1,count,fn){for(let i=0;i<count;i++){const t=i/(count-1),y=y0+(y1-y0)*t;g.line([[x0,y],[x1,y]],grid,.65,[2,3]);if(fn)fn(t,y);}}

  function spotData(context){
    const q=context?.spot||{},raw=Array.isArray(q.candles)?q.candles:[];
    const validOhlc=x=>x&&finite(x.t)&&x.t>0&&['o','h','l','c'].every(k=>finite(x[k])&&x[k]>0)&&x.h>=Math.max(x.o,x.c)&&x.l<=Math.min(x.o,x.c);
    const map=new Map();for(const v of raw)if(validOhlc(v))map.set(+v.t,{t:+v.t,o:+v.o,h:+v.h,l:+v.l,c:+v.c,v:finite(v.v)&&v.v>=0?+v.v:null});
    const rows=[...map.values()].sort((a,b)=>a.t-b.t);const at=finite(q.at)&&q.at>0?+q.at:null;
    return {rows,price:finite(q.price)&&q.price>0?+q.price:null,at,source:String(q.source||'BTC/USD'),stale:['stale','offline','error'].includes(q.status),status:q.status,error:q.error};
  }
  // Feed adapters supply positive resting levels in best-price order.
  const depthBands=[
    ['BID 1','#679fea'],['BID 2','#56bba9'],['BID 3–5','#9c7ad4'],
    ['ASK 1','#df5c9c'],['ASK 2','#f67c52'],['ASK 3–5','#efb250']
  ];
  function depthSample(book){
    const values=[];
    for(const rows of [book.bids,book.asks]){
      const qty=i=>rows[i]?.[1]??0;
      values.push(qty(0),qty(1),qty(2)+qty(3)+qty(4));
    }
    return {t:book.at,values,total:values.reduce((sum,n)=>sum+n,0)};
  }
  function observeBookDepth(samples,s){
    if(!s)return;
    for(const side of ['up','down']){
      const book=s.outcomes?.[side],t=book?.at,rows=samples[side],last=rows.at(-1);
      if(!book?.bookAvailable||!Array.isArray(book.bids)||!Array.isArray(book.asks)||!Number.isFinite(t)||
        t<s.startTime||t>=s.endTime||t<(s.receivedAt-10000)||t>s.receivedAt+3000||last&&t<last.t)continue;
      const next=depthSample(book);
      if(last&&(t===last.t||Math.floor(t/1000)===Math.floor(last.t/1000))){
        rows[rows.length-1]=next;
      }else{
        rows.push(next);
        if(rows.length>100)rows.shift();
      }
    }
  }
  function publicDepth(p,g,m,book,reading,samples){
    const {w,h,txt,line,fill,rect}=g,dir=m.side.toUpperCase();
    set(p,'badge','PUBLIC BOOK');
    p.values.badge.title='所选方向的公开盘口深度';
    const current=book.available?depthSample(book):null,last=samples.at(-1);
    const change=last&&current&&samples.length>1&&last.t===book.at?current.total-samples[0].total:null;
    set(p,'quote',current?fmt(current.total,2):'—');p.values.quote.style.color=green;
    p.values.quote.title='当前 '+dir+' 买卖各前五档合计挂单份数';
    set(p,'delta',change===null?'—':signed(change,2)+' SH');pulse(p,change);
    const changes=[];
    for(let i=1;i<samples.length;i++){
      if(samples[i].t-samples[i-1].t<=10000)changes.push(Math.abs(samples[i].total-samples[i-1].total));
    }
    const volume=m.s?.tradeVolumes?.[m.side];
    const observed=volume?.length?volume.reduce((sum,minute)=>sum+minute.size,0):null;
    const avg=changes.length?changes.reduce((sum,n)=>sum+n,0)/changes.length:null;
    const max=changes.length?Math.max(...changes):null;
    four(p,[fmt(samples.length),compact(observed),compact(avg),compact(max)]);
    p.values.k0.title='最多显示最近 100 个盘口采样秒，每秒取最后一次观测';
    p.values.k1.title='本页本期收到的 '+dir+' 公开成交份数';
    p.values.k2.title='相邻盘口样本总挂单份数变化的绝对值均值';
    p.values.k3.title='相邻盘口样本总挂单份数变化的最大绝对值';
    set(p,'footL','OPEN BOOK · '+dir+' · 6 BANDS');
    set(p,'footR',m.stale?'LAST QUOTE · '+time(book.at,true)+' UTC':'MARKET DEPTH · SHARES');
    const why='等待所选合约的公开盘口';
    empty(p,samples.length?'':why);
    if(current){
      const bid=current.values[0]+current.values[1]+current.values[2],ask=current.total-bid;
      reading.kelly=dir+(m.stale?' 上次盘口':' 盘口')+' '+time(book.at,true)+' UTC，买卖各前五档合计 '+fmt(current.total,2)+' 份，买盘 '+fmt(bid,2)+' 份，卖盘 '+fmt(ask,2)+' 份。';
    }else reading.kelly=why+'。';

    const right=w<275?46:55,left=8,end=w-right,top=h<60?7:15,bottom=h-(h<56?7:16);
    gridY(g,left,end,top,bottom,4);
    if(h>=60)txt('DEPTH / SHARES',left,top-6,muted,7);
    for(let i=0;i<6;i++){
      const [label,color]=depthBands[5-i],yy=top+(bottom-top)*(i+.5)/6;
      rect(end+4,yy-1.8,3.6,3.6,color);txt(label,end+10,yy,muted,w<275?6.3:7);
    }
    if(!samples.length){mark(p,'kelly',end*.7,(top+bottom)/2);return;}
    const first=samples[0].t,totalMax=Math.max(1,...samples.map(row=>row.total));
    const x=t=>last.t===first?end:left+(end-left)*(t-first)/(last.t-first);
    const y=sum=>bottom-(bottom-top)*.94*sum/totalMax;
    function paintSegment(rows){
      let floor=rows.map(row=>[x(row.t),bottom]),sums=rows.map(()=>0);
      for(let band=0;band<depthBands.length;band++){
        const ceiling=rows.map((row,i)=>[x(row.t),y(sums[i]+=row.values[band])]);
        if(rows.length>1)fill([...ceiling,...floor.slice().reverse()],depthBands[band][1]);
        else rect(ceiling[0][0]-1,ceiling[0][1],2,floor[0][1]-ceiling[0][1],depthBands[band][1]);
        floor=ceiling;
      }
      line(floor,'#1a202a',1.5);
    }
    let start=0;
    for(let i=1;i<=samples.length;i++){
      if(i<samples.length&&samples[i].t-samples[i-1].t<=10000)continue;
      paintSegment(samples.slice(start,i));start=i;
    }
    if(h>=56){
      txt(time(first,true),left,h-6,muted,6.6);
      txt(m.stale?'LAST QUOTE':'NOW',end,h-6,muted,6.6,'right');
    }
    const target=samples[Math.floor((samples.length-1)*.72)];
    mark(p,'kelly',x(target.t),y(target.total*.60));
  }
  function tapeIndicators(rows,tradeBuckets,isBTC){
    const ema=[],vw=[],volumes=[];
    let mean=null,gains=0,losses=0,notional=0,size=0,rsi=null;
    const first=rows[0]?.t??-Infinity;
    const trades=tradeBuckets.filter(q=>q.t>=first&&q.size>0&&finite(q.notional)).sort((a,b)=>a.t-b.t);
    const volumeByTime=new Map(tradeBuckets.map(q=>[q.t,q.size]));
    let nextTrade=0;
    rows.forEach((row,i)=>{
      mean=mean===null?row.c:mean+(2/15)*(row.c-mean);
      ema.push(mean);
      if(i){
        const move=row.c-rows[i-1].c,up=Math.max(0,move),down=Math.max(0,-move);
        if(i<=14){gains+=up/14;losses+=down/14;}
        else{gains=(13*gains+up)/14;losses=(13*losses+down)/14;}
        if(i>=14)rsi=gains+losses?100*gains/(gains+losses):50;
      }
      if(isBTC){
        const volume=row.v??0;
        size+=volume;notional+=(row.h+row.l+row.c)*volume/3;
        volumes.push(volume);
      }else{
        while(nextTrade<trades.length&&trades[nextTrade].t<=row.t){
          const trade=trades[nextTrade++];size+=trade.size;notional+=trade.notional;
        }
        volumes.push(volumeByTime.get(row.t)??0);
      }
      vw.push(size>0?notional/size:null);
    });
    while(nextTrade<trades.length&&!isBTC){
      const trade=trades[nextTrade++];size+=trade.size;notional+=trade.notional;
    }
    return {ema,vw,rsi,volumes,vwap:size>0?notional/size:null};
  }
  function tape(p,g,m,b,previous,now,reading){
    const {s,side,history}=m,dir=side.toUpperCase(),isBTC=m.unit==='btc',spot=m.spot;
    const pack=isBTC?spot.rows:agg(history),last=pack.at(-1);
    const latest=isBTC?(last?{t:last.t,p:last.c}:null):history.at(-1);
    const display=isBTC?dollars:cents;
    const rows=pack.slice(-81),firstOpen=rows[0]?.o;
    const metrics=tapeIndicators(rows,s?.tradeVolumes?.[side]||[],isBTC);
    const headline=isBTC?(spot.price??latest?.p):(b.mid??latest?.p);
    const change=finite(headline)&&firstOpen>0?100*(headline-firstOpen)/firstOpen:null;
    const quote=display(headline),quoteEl=p.values.quote;
    if(quoteEl.dataset.formatted!==quote){
      const parts=quote.split('.');
      quoteEl.textContent=parts[0];
      if(parts.length===2){
        const decimals=document.createElement('em');decimals.textContent='.'+parts[1];quoteEl.append(decimals);
      }
      quoteEl.dataset.formatted=quote;
    }
    set(p,'delta',finite(change)?(change>=0?'+':'−')+Math.abs(change).toFixed(2)+'%':'—');
    p.values.delta.title='相对图内首根分钟开盘价的涨跌幅';pulse(p,change);
    set(p,'badge',m.stale?'LAST BOOK':b.available?'LIVE BOOK':'WAITING BOOK');
    p.host.querySelector('.pmd-subtitle').textContent=(isBTC?'BTC 1M':'CONTRACT 1M')+' · CANDLESTICKS · '+(isBTC?'VWAP≈':'VWAP');
    set(p,'source',isBTC?'BTC / USD · COINBASE '+(spot.stale?'· 上次观测':spot.price===null?'· 最近分钟价':'· CANDLESTICKS')+' · '+dir+' BOOK IN ¢':dir+' / ¢ · CLOB QUOTE CANDLES · DEPTH MATRIX');
    set(p,'rsi',finite(metrics.rsi)?fmt(metrics.rsi):'—');
    set(p,'vwap',isBTC?fmt(metrics.vwap):cents(metrics.vwap));
    set(p,'vwapLabel',isBTC?'VWAP≈':'VWAP');set(p,'bars',rows.length||'—');
    p.values.vwap.parentElement.title=isBTC?'图内分钟典型价（高、低、收均值）按 Coinbase 实际分钟成交量加权。':'本页收到的该合约逐笔成交金额除以成交份数。';
    set(p,'footL',isBTC?'BTC/USD  1M':'BTC '+dir+' / ¢  1M');
    set(p,'footR',m.stale?'● LAST BOOK':b.available?'● DEPTH STREAM':'○ WAITING BOOK');
    p.values.footR.title=isBTC?'右侧为选中合约的买卖盘口，量柱为 Coinbase 分钟成交量（BTC）。':'右侧为选中合约的买卖盘口，量柱为本页实际收到的成交份数。';
    empty(p,'');
    reading.spotter=isBTC?(latest?'BTC/USD 最近分钟报价 '+dollars(latest.p)+' · '+time(latest.t)+' UTC'+(spot.stale?'（上次观测）。':'。'):'等待真实 BTC/USD 分钟 K 线。'):(latest?dir+' 最新报价样本 '+cents(latest.p)+' · '+time(latest.t,true)+' UTC。':'暂无 '+dir+' 历史报价。');
    reading.taker=b.asks.length?dir+(m.stale?' 上次盘口卖一 ':' 卖一 ')+cents(b.asks[0][0])+'，挂单 '+fmt(b.asks[0][1],4)+' 份。':'当前方向暂无有效卖单。';
    const {w,h,c,txt,dot,rect,fill,line,gr}=g;
    const stackedBook=window.GrokMobilePanels.narrow.matches;
    const bookW=stackedBook?0:Math.max(67,w*.24),bookX=w-bookW,axisW=stackedBook?(isBTC?75:46):(isBTC?(w>400?55:44):(w>400?32:25)),x0=4,x1=bookX-axisW-3,top=h>75?13:6,base=h-10,volH=Math.max(6,(base-top)*.15),bottom=Math.max(top+10,base-volH-4);
    p.chart.deskScanZones={spotter:[x0,top,x1,bottom],taker:[bookX+2,9,w-2,h-2]};
    if(rows.length){
      const [a,z]=range([...rows.map(v=>v.l),...rows.map(v=>v.h),...metrics.vw.filter(finite),...(finite(headline)?[headline]:[])],.10,isBTC?.01:.005);
      const lo=isBTC?Math.max(0,a):clamp(a,0,.99999),hi=isBTC?z:Math.max(lo+.00001,clamp(z,.00001,1));
      const y=v=>top+(hi-v)/(hi-lo)*(bottom-top),first=rows[0].t,last=rows.at(-1).t;
      const slots=(last-first)/60000+1,spacing=(x1-x0)/Math.max(1,slots),x=t=>x0+spacing*(.5+(t-first)/60000),cw=clamp(spacing*.56,1,11);
      rect(x0,top,x1-x0,bottom-top,gr(top,bottom,'#f3edf9','#fcfffd'));
      gridY(g,x0,x1,top,bottom,4,(t,yy)=>txt(isBTC?fmt(hi-(hi-lo)*t,0):cents(hi-(hi-lo)*t),bookX-4,yy,muted,6.5,'right'));
      for(let i=0;i<5;i++){const xx=x0+(x1-x0)*i/4;line([[xx,top],[xx,base]],'#e0e0ea',.6,[2,3]);}
      const means=rows.map((v,i)=>[x(v.t),y(metrics.ema[i])]);
      const upper=[],lower=[];
      rows.forEach((v,i)=>{
        const recent=rows.slice(Math.max(0,i-13),i+1);
        upper.push([x(v.t),y(Math.max(...recent.map(bar=>bar.h)))]);
        lower.push([x(v.t),y(Math.min(...recent.map(bar=>bar.l)))]);
      });
      fill([...upper,...lower.slice().reverse()],'#bface632');
      line(upper,'#ad97c8',.67,[2,2]);line(lower,'#ad97c8',.67,[2,2]);
      line(means,'#774cb4',1.25);
      const heights=metrics.volumes,peak=Math.max(1e-8,...heights);
      rows.forEach((v,i)=>{const xx=x(v.t),col=v.c===v.o?(i&&v.c<rows[i-1].c?red:green):v.c>v.o?green:red;
        line([[xx,y(v.h)],[xx,y(v.l)]],col,.85);rect(xx-cw/2,Math.min(y(v.o),y(v.c)),cw,Math.max(1.5,Math.abs(y(v.c)-y(v.o))),col);
        if(heights[i]>0){c.globalAlpha=.66;rect(xx-cw/2,base-volH*heights[i]/peak,cw,Math.max(.7,volH*heights[i]/peak),col);c.globalAlpha=1;}
      });
      const weighted=rows.flatMap((v,i)=>finite(metrics.vw[i])?[[x(v.t),y(metrics.vw[i])]]:[]);
      line(weighted,'#539aa9',.95,[3,2]);
      const ref=headline??latest.p,py=clamp(y(ref),top+2,bottom-2),px=x(rows.at(-1).t),sampleY=y(rows.at(-1).c);
      line([[x0,py],[bookX-2,py]],green,.65,[2,3]);rect(x1+1,py-4.6,axisW+1,9.2,green);txt(display(ref),bookX-3,py,'#fff',6.8,'right',700);
      if(h>75)txt('● PRICE    ━ EMA 14    ┄ '+(isBTC?'VWAP≈':'VWAP'),x0+2,5,purple,6.8);
      if(h>50){txt(time(first),x0,base+5,muted,6.5);if(last-first>=120000)txt(time((first+last)/2),(x0+x1)/2,base+5,muted,6.5,'center');if(first!==last)txt(time(last),x1,base+5,muted,6.5,'right');}
      mark(p,'spotter',px,sampleY);
      if(previous&&m.changedTick) p.particle={t:now,x:px,y:sampleY,fromX:Math.min(bookX-2,px+22),color:ref>=previous.headline?green:red};
    }else{
      gridY(g,x0,x1,top,bottom,4);txt(isBTC?'等待 BTC/USD 分钟 K 线':'等待 '+dir+' 历史价格点',(x0+x1)/2,(top+bottom)/2,muted,8,'center');mark(p,'spotter',x1*.72,h*.5);
    }
    if(stackedBook){p.flashes=[];return;}
    rect(bookX,0,1,h,'#d6dce4');txt('ORDER BOOK',bookX+4,5,navy,7,'left',700);if(bookW>96)txt(dir+' ¢ · 份',w-3,5,muted,6.5,'right');
    if(m.stale)txt('过期',w-3,h-3,'#aa7729',6,'right');
    const n=h>=72?5:3,bids=b.bids.slice(0,n),asks=b.asks.slice(0,n).reverse(),rowH=Math.max(4,(h-15)/(n*2+1)),midY=10+(n+.5)*rowH;
    rect(bookX+2,midY-rowH*.43,bookW-4,rowH*.86,'#edf1f5');txt('MID',bookX+4,midY,muted,6.5);txt(cents(b.mid),w-3,midY,navy,7,'right',700);
    const maxQ=Math.max(.01,...bids.concat(asks).map(q=>q[1]));p.flashes=[];
    function row(q,yy,sell){
      const [pr,size]=q,col=sell?red:green,key=(sell?'a':'b')+pr;
      const label=fmt(size,2),available=Math.max(2,bookW-35-label.length*4.1);
      const bw=Math.max(1,available*size/maxQ),end=w-3,beg=end-bw;
      c.globalAlpha=.2;rect(beg,yy-rowH*.34,bw,rowH*.68,col);c.globalAlpha=1;
      for(let j=1;j<bw;j+=3)rect(end-j,yy-rowH*.28,.85,rowH*.56,col);
      txt(cents(pr),bookX+4,yy,col,bookW<86?6.8:7.6,'left',650);txt(label,beg-2,yy,navy,bookW<86?6.4:7,'right',600);
      if(previous&&previous.depth.get(key)!==size&&m.changedBook)p.flashes.push({x:bookX+2,y:yy-rowH*.4,w:bookW-4,h:rowH*.8,col,t:now});
    }
    asks.forEach((q,i)=>row(q,midY-(asks.length-i)*rowH,true));bids.forEach((q,i)=>row(q,midY+(i+1)*rowH,false));
    if(!b.available||(!bids.length&&!asks.length))txt(b.available?'暂无挂单':'暂无盘口',bookX+bookW/2,midY+12,muted,7,'center');
    mark(p,'taker',bookX+bookW*.67,asks.length?midY-rowH:midY);
  }
  const fanColors=['#f79745','#f17b58','#e05791','#a05ab2','#4caaad','#39a395','#3b8db9'];
  function empiricalQuantile(sorted,fraction){
    const index=(sorted.length-1)*fraction,low=Math.floor(index);
    return sorted[low]+(sorted[Math.ceil(index)]-sorted[low])*(index-low);
  }
  function replaySegments(quotes,cadence,maxSteps){
    const buckets=new Map();
    for(const quote of quotes)buckets.set(Math.floor(quote.t/cadence),quote);
    const series=[...buckets.values()],runs=[];
    let lastSlot=null,run;
    for(const [slot,quote] of buckets){
      if(slot!==lastSlot+1||!run){run=[];runs.push(run);}
      run.push(quote);lastSlot=slot;
    }
    const longest=runs.reduce((n,r)=>Math.max(n,r.length),0);
    const steps=Math.min(maxSteps,Math.max(1,Math.floor((longest-1)/3)));
    const starts=[],moves=[];
    for(const r of runs){
      for(let i=0;i<r.length-1;i++)moves.push(r[i+1].p-r[i].p);
      for(let i=0;i+steps<r.length;i++)starts.push({r,i});
    }
    const count=Math.min(40,starts.length);
    const paths=Array.from({length:count},(_,j)=>{
      const {r,i}=starts[count===1?0:Math.round(j*(starts.length-1)/(count-1))];
      return r.slice(i,i+steps+1).map(quote=>quote.p-r[i].p);
    });
    const mean=moves.reduce((sum,d)=>sum+d,0)/moves.length;
    const vol=moves.length>1?Math.sqrt(moves.reduce((sum,d)=>sum+(d-mean)**2,0)/(moves.length-1)):null;
    return {cadence,steps,series,paths,vol,score:count*Math.min(steps,8)};
  }
  function priceDistribution(m){
    const isBTC=m.unit==='btc',now=Date.now();
    const quotes=isBTC?m.spot.rows.filter(q=>q.t+60000<=now).map(q=>({t:q.t+60000,p:q.c})):
      m.history.filter(q=>q.t>=m.s?.startTime&&q.t<m.s?.endTime&&q.t<=now);
    const limit=m.s?.interval==='5m'?5:15;
    let replay=replaySegments(quotes,60000,limit);
    if(!isBTC){
      for(const cadence of [5000,1000]){
        const next=replaySegments(quotes,cadence,15);
        if(next.score>replay.score)replay=next;
      }
    }
    return replay;
  }
  const spanLabel=ms=>ms>=60000?fmt(ms/60000,1)+'m':fmt(ms/1000,1)+'s';
  function distributionGeometry(p,model,anchor,isBTC){
    const {w,h}=p,left=7,split=w*.31,end=w*.78,right=w-7,top=h>75?10:6,bottom=h-15;
    const {cadence,steps,paths,series}=model,last=series.at(-1);
    const history=series.slice(-Math.max(10,steps+1)).map(q=>({t:q.t,d:q.p-anchor.p}));
    if(!last||anchor.t>last.t)history.push({t:anchor.t,d:0});
    else history[history.length-1]={t:anchor.t,d:0};
    const terminals=paths.map(path=>path.at(-1)).sort((a,b)=>a-b);
    const [low,high]=range([...history.map(q=>q.d),...paths.flat()],.06,isBTC?.03:.0005);
    const y=d=>top+(high-d)/(high-low)*(bottom-top),first=history[0].t;
    const observations=history.map(q=>[anchor.t===first?split:left+(split-left)*(q.t-first)/(anchor.t-first),y(q.d)]);
    const pathColor=paths.map(path=>{
      const rank=terminals.indexOf(path.at(-1));
      return fanColors[Math.round((terminals.length<2?.5:rank/(terminals.length-1))*(fanColors.length-1))];
    });
    const xyPaths=paths.map(row=>row.map((d,i)=>[split+(end-split)*i/steps,y(d)]));
    const upper=[],lower=[],median=[];
    if(paths.length)for(let j=0;j<=steps;j++){
      const values=paths.map(row=>row[j]).sort((a,b)=>a-b),xx=split+(end-split)*j/steps;
      upper.push([xx,y(empiricalQuantile(values,.9))]);lower.push([xx,y(empiricalQuantile(values,.1))]);median.push([xx,y(empiricalQuantile(values,.5))]);
    }
    // Smooth the density of the observed end changes on the same vertical scale as the paths.
    const endsY=terminals.map(y);
    const bandwidth=endsY.length?Math.max(2,(bottom-top)*.018,
      (endsY[0]-endsY.at(-1))*Math.pow(endsY.length,-.2)/3):1;
    const edge=Array.from({length:65},(_,i)=>{
      const yy=top+(bottom-top)*i/64;
      return [endsY.reduce((sum,v)=>sum+Math.exp(-.5*((yy-v)/bandwidth)**2),0),yy];
    });
    const peak=Math.max(...edge.map(q=>q[0]));
    for(const q of edge)q[0]=end+(peak?(right-end)*q[0]/peak:0);
    return {left,split,end,right,top,bottom,cadence,horizon:cadence*steps,observations,paths:xyPaths,pathColor,upper,lower,median,edge,
      historyBreaks:history.map((q,i)=>i>0&&q.t-history[i-1].t>cadence*2.1),curves:[...xyPaths,observations,upper,lower,median,edge]};
  }
  function paintDistribution(p){
    const f=p.fan,{left,split,end,right,top,bottom,paths,observations,edge}=f,g=pen(p.base,p.w,p.h);
    const {c,line,fill,txt,gr,dot}=g,fs=p.w<300?6.2:7;
    gridY(g,left,right,top,bottom,p.h>70?5:3);
    for(const x of [split,(split+end)/2,end])line([[x,top],[x,bottom]],x===split?'#9daab5':grid,.7,[2,3]);
    let part=[];
    for(let j=0;j<observations.length;j++){
      if(f.historyBreaks[j]){if(part.length>1)line(part,'#2486aa',1.7);else if(part.length)dot(...part[0],'#2486aa',1);part=[];}
      part.push(observations[j]);
    }
    line(part,'#2486aa',1.7);dot(...observations.at(-1),'#2486aa',1.45);
    if(paths.length){
      fill([...f.upper,...f.lower.slice().reverse()],gr(top,bottom,'#c4dfe96a','#f6c5d766'));
      c.globalAlpha=.66;
      paths.forEach((pts,i)=>line(pts,f.pathColor[i],i%5===0?1.05:.74));
      c.globalAlpha=1;
      line(f.median,'#69457f',1.05,[3,2]);
      const shade=c.createLinearGradient(0,top,0,bottom);
      for(const [stop,color] of [[0,'#bedfe9'],[.42,'#16a09d'],[.52,'#686b9f'],[.67,'#de578f'],[1,'#deb0cb']])shade.addColorStop(stop,color);
      if(paths.length>1){
        fill([[end,top],...edge,[end,bottom]],shade);line(edge,'#687690',.85);
      }else dot(end,paths[0].at(-1)[1],f.pathColor[0],1.7);
      line([[end,top],[end,bottom]],'#8094a4',.8);
      if(p.h>66&&paths.length>=2){
        txt('P90',end-4,Math.max(top+2,f.upper.at(-1)[1]-5),'#32849a',fs,'right');
        txt('P10',end-4,Math.min(bottom-2,f.lower.at(-1)[1]+6),'#c64e7d',fs,'right');
      }
      txt('+'+spanLabel(f.horizon/2),(split+end)/2,bottom+8,muted,fs,'center');
      txt('+'+spanLabel(f.horizon),end,bottom+8,muted,fs,'center');
    }else txt('等待连续报价',(split+end)/2,(top+bottom)/2,muted,fs,'center');
    txt('HIST.',left,bottom+8,muted,fs);txt('NOW',split,bottom+8,navy,fs,'center',700);
    mark(p,'prior',...(f.median[Math.floor(f.median.length/2)]||observations.at(-1)));
    mark(p,'edge',...edge.reduce((a,b)=>a[0]>b[0]?a:b));
  }
  function advanceFan(p,now){
    if(!p.fanGoal)return;
    const blend=-Math.expm1(-clamp(now-p.lastFanPaint,0,64)/68);
    if(!blend)return;
    p.lastFanPaint=now;
    let distance=0;
    for(let i=0;i<p.fan.curves.length;i++){
      const from=p.fan.curves[i],to=p.fanGoal.curves[i];
      for(let j=0;j<from.length;j++){
        const a=from[j],b=to[j],dx=b[0]-a[0],dy=b[1]-a[1];
        a[0]+=dx*blend;a[1]+=dy*blend;
        distance=Math.max(distance,Math.abs(dx),Math.abs(dy));
      }
    }
    if(distance<.08){p.fan=p.fanGoal;p.fanGoal=null;}
    paintDistribution(p);
  }
  function prior(p,m,b,reading,key,reduced,now){
    const {w,h}=p,isBTC=m.unit==='btc',dir=isBTC?'BTC/USD':m.side.toUpperCase(),view=isBTC?dollars:cents;
    const change=d=>finite(d)?signed(d*(isBTC?1:100),2)+(isBTC?' USD':'¢'):'—';
    const model=priceDistribution(m),{paths,series,cadence,steps}=model,last=series.at(-1);
    let anchor=last;
    const price=isBTC?m.spot.price:b.mid,stamp=isBTC?m.spot.at:b.at;
    if(finite(price)&&finite(stamp)&&(!last||stamp>=last.t))anchor={p:price,t:stamp};
    const stale=isBTC?m.spot.stale:m.stale,prev=p.fanInput;
    if(stale&&!p.stopMotion)pen(p.overlay,w,h);p.stopMotion=stale;
    set(p,'badge',stale?'STALE':'SPECTRAL');
    const sorted=paths.map(row=>row.at(-1)).sort((a,b)=>a-b),count=paths.length;
    const mid=count?empiricalQuantile(sorted,.5):null;
    four(p,[view(anchor?.p),change(mid),finite(model.vol)?(isBTC?dollars(model.vol):fmt(100*model.vol,2)+'¢'):'—',count?spanLabel(cadence*steps):'—']);
    set(p,'footL','历史回放 · '+(isBTC?'COINBASE':'CLOB')+(count?' / '+spanLabel(cadence):''));
    set(p,'footR',count?count+' 历史路径':'等待连续样本');
    p.chart.title='左侧为实测价格。右侧叠加连续历史片段相对起点的价差，横轴为回放经过时长。P10 和 P90 取这些片段的经验分位。';
    if(!anchor){
      p.fan=p.fanGoal=p.fanInput=null;pen(p.overlay,w,h);
      const g=pen(p.base,w,h);gridY(g,5,w-5,10,h-14,4);
      const why=isBTC?'等待 Coinbase BTC/USD 报价':'等待本期公开报价';
      empty(p,why);mark(p,'prior',w*.57,h*.48);mark(p,'edge',w*.785,h*.48);reading.prior=why+'。';reading.edge='盘口点差 '+cents(b.gap)+'。';return;
    }
    reading.prior=count?dir+' '+count+' 条历史路径，回放 '+spanLabel(cadence*steps)+' 的价差中位数 '+change(mid)+'。':'已有 '+dir+' 报价，等待连续观测以回放路径。';
    reading.edge=count?dir+' 回放终点价差 P10 '+change(empiricalQuantile(sorted,.1))+'、P90 '+change(empiricalQuantile(sorted,.9))+'，盘口点差 '+cents(b.gap)+'。':'路径样本待更新，盘口点差 '+cents(b.gap)+'。';
    empty(p,'');
    const sameView=prev&&prev.key===key&&prev.w===w&&prev.h===h&&prev.pixels===p.base.width;
    const staticView=reduced||stale||!p.visible||document.hidden;
    if(sameView&&prev.cadence===cadence&&prev.anchor.p===anchor.p&&prev.anchor.t===anchor.t&&series.length===prev.series.length&&series.every((v,i)=>v.t===prev.series[i].t&&v.p===prev.series[i].p)){
      if(staticView&&p.fanGoal){p.fan=p.fanGoal;p.fanGoal=null;paintDistribution(p);}return;
    }
    p.fanInput={key,w,h,pixels:p.base.width,cadence,series,anchor};
    const next=distributionGeometry(p,model,anchor,isBTC);
    const compatible=sameView&&p.fan.cadence===cadence&&p.fan.horizon===next.horizon&&p.fan.curves.length===next.curves.length&&
      p.fan.curves.every((row,i)=>row.length===next.curves[i].length);
    if(!compatible||staticView){p.fan=next;p.fanGoal=null;paintDistribution(p);}
    else{if(!p.fanGoal)p.lastFanPaint=now;p.fan.pathColor=next.pathColor;p.fan.historyBreaks=next.historyBreaks;p.fanGoal=next;}
  }

  function waterfall(p,g,data,reading){
    const t=data||{};
    const spans=(t.spans||[]).filter(row=>finite(row.start)&&row.start>=0&&finite(row.duration)&&row.duration>=0)
      .slice().sort((a,b)=>a.start-b.start);
    const end=spans.length?Math.max(...spans.map(row=>row.start+row.duration)):null;
    const total=finite(t.total)?t.total:end;
    const millis=value=>finite(value)?fmt(value)+'ms':'—';
    four(p,[millis(total),millis(t.p95),spans.length||'—',finite(t.errors)?fmt(t.errors):'—']);
    set(p,'badge','TRACE');
    p.values.badge.title=(t.source==='角色巡检'?'六个角色从派出到返回的本机用时，包含移动和扫描。':'本次请求的实际处理耗时。')+'点此切换已完成的记录。';
    set(p,'footL',t.id!=null?'RECENT TRACE #'+t.id:'WAITING FOR TRACE');
    set(p,'footR',t.source==='角色巡检'?'AGENT HANDOFFS':t.source==='行情'?'PUBLIC FEED':t.source==='委托'?'ORDER REQUEST':'REQUEST TIMING');
    const {w,h,c,txt,rect,line}=g;
    if(!spans.length){empty(p,'等待本次请求的实际计时记录');mark(p,'closer',w*.7,h*.55);reading.closer='暂未收到本次请求的实测耗时。';return;}
    empty(p,'');reading.closer=(t.source||'请求')+'共 '+spans.length+' 段，实测耗时 '+ms(total)+'，P95 '+ms(t.p95)+'。';
    const colors=['#00ad88','#ed9516','#8050dc','#df167e','#2679df','#ef401b'];
    const x0=clamp(w*.31,60,115),x1=w-8,top=h>70?16:8,bottom=h-7;
    const rows=spans.slice(0,Math.max(3,Math.floor((bottom-top)/8)));
    const rowHeight=(bottom-top)/rows.length,spanEnd=Math.max(1,end,total);
    const x=ms=>x0+(x1-x0)*ms/spanEnd;
    for(let i=0;i<=4;i++){
      const xx=x0+(x1-x0)*i/4;
      line([[xx,top-3],[xx,bottom]],grid,.7,[2,3]);
      if(h>70)txt(i===4?'ms':fmt(spanEnd*i/4),xx,top-8,muted,7,i===4?'right':'center');
    }
    let previousEnd=null;
    rows.forEach((row,i)=>{
      const y=top+(i+.5)*rowHeight,color=colors[i%colors.length];
      const left=x(row.start),right=x(row.start+row.duration),width=Math.max(.8,right-left),barHeight=clamp(rowHeight*.43,2.7,8);
      if(i%2)rect(3,y-rowHeight/2,w-6,rowHeight,'#f7f8fa');
      rect(5,y-2,3,4,color);
      c.save();c.beginPath();c.rect(11,y-rowHeight/2,x0-15,rowHeight);c.clip();
      txt(row.name,12,y,navy,7.1,'left',650);c.restore();
      if(t.source==='角色巡检'&&previousEnd)line([previousEnd,[previousEnd[0],y],[left,y]],'#b6bdc8',.65,[2,2]);
      previousEnd=[right,y];
      rect(left,y-barHeight/2,width,barHeight,color+'32');
      const solid=finite(row.readAfter)&&row.duration>0?clamp(row.readAfter/row.duration,0,1):1;
      rect(left,y-barHeight/2,width*solid,barHeight,color);
      line([[right,y-barHeight/2-1],[right,y+barHeight/2+1]],color,.8);
      if(i===rows.length-1)mark(p,'closer',right,y);
    });
    if(rows.length<spans.length)set(p,'footR','显示前 '+rows.length+' / '+spans.length+' 段');

  }
  window.createPMPanels=function(root){
    if(!document.querySelector('style[data-live-desk-design]')){
      const css=document.createElement('style');css.dataset.liveDeskDesign='';css.textContent=style;
      document.head.append(css);
    }
    const panels={},reading={},reduce=matchMedia('(prefers-reduced-motion: reduce)');
    let model={s:null,side:'up',active:null,stale:false,t:null},dirty=true,paintFrame=0,anim=0;
    let previous=null, modelKey='',prevData=null, observedDepth=new Map(),memoryMarket='';
    let depthSamples={up:[],down:[]},lastDepthSnapshot=null;
    for(const [name,html] of Object.entries(templates)){
      const host=root.querySelector('[data-pm-panel="'+name+'"]');if(!host)continue;
      host.classList.add('pmd-panel','pmd-'+name);host.innerHTML=html;
      const chart=host.querySelector('.pmd-plot'),base=chart.querySelector('canvas'),overlay=chart.querySelector('[data-overlay]');
      panels[name]={host,chart,base,overlay,visible:false,w:0,h:0,help:chart.querySelector('.pmd-help'),values:Object.fromEntries([...host.querySelectorAll('[data-key]')].map(el=>[el.dataset.key,el])),
        targets:Object.fromEntries([...chart.querySelectorAll('[data-target]')].map(el=>[el.dataset.target,el])),flashes:[],fan:null,particle:null};
    }
    function applyActive(){
      for(const p of Object.values(panels)){
        const focus=Boolean(model.active&&p.targets[model.active]);p.host.dataset.focus=String(focus);if(focus){p.host.style.setProperty('--pmd-agent',accent[model.active]);p.host.style.setProperty('--dc-signal',accent[model.active]);}
        Object.entries(p.targets).forEach(([id,e])=>e.classList.toggle('is-targeted',id===model.active));p.host.dataset.stale=String(model.stale);
      }
    }
    function size(p){
      const w=p.chart.clientWidth,h=p.chart.clientHeight;if(w<30||h<16)return null;
      p.w=w;p.h=h;const d=clamp(window.devicePixelRatio||1,1,2);const iw=Math.round(w*d),ih=Math.round(h*d);
      for(const cv of [p.base,p.overlay]){if(cv.width!==iw||cv.height!==ih){cv.width=iw;cv.height=ih;}}
      return true;
    }
    const visible=()=>!document.hidden&&Object.values(panels).some(p=>p.visible);
    function draw(force){
      paintFrame=0;if(force!==true&&!visible())return;
      dirty=false;const now=performance.now(),{s,side}=model, o=s?.outcomes?.[side]||{};
      const history=hist(s,side),bids=levels(o.bids,true),asks=levels(o.asks,false),at=finite(o.at)?Number(o.at):null;
      const validBook=Boolean(o.bookAvailable&&Array.isArray(o.bids)&&Array.isArray(o.asks)&&at!==null),mid=validBook&&bids.length&&asks.length&&asks[0][0]>=bids[0][0]?(bids[0][0]+asks[0][0])*.5:null;
      const b={bids,asks,at,available:validBook,mid,gap:mid!==null?asks[0][0]-bids[0][0]:null};
      const spot=spotData(model.context),btc=model.unit==='btc',headline=btc?spot.price??spot.rows.at(-1)?.c:b.mid??history.at(-1)?.p,old=previous&&previous.key===modelKey?previous:null;
      const changedTick=Boolean(old&&finite(headline)&&old.headline!==headline),changedBook=Boolean(old&&(old.at!==at||old.bids!==o.bids||old.asks!==o.asks));
      const m={...model,spot,history,changedTick,changedBook},depth=new Map(bids.map(q=>['b'+q[0],q[1]]));
      for(const r of asks)depth.set('a'+r[0],r[1]);
      if(validBook&&mid!==null&&at>=s.startTime&&at<s.endTime){
        const seen=observedDepth.get(side)||[];
        const prev=seen.at(-1);if(!prev||at>prev.t){seen.push({t:at,p:mid});if(seen.length>300)seen.shift();}
        else if(at===prev.t)prev.p=mid;
        observedDepth.set(side,seen);
      }
      // A feed may supply venue history and locally observed midpoint updates together.
      // Merge exact timestamps so the same observation is not used twice.
      const merged=new Map(history.map(v=>[v.t,v.p]));for(const v of observedDepth.get(side)||[])merged.set(v.t,v.p);
      const series=[...merged].sort((a,b)=>a[0]-b[0]).map(([t,p])=>({t,p}));
      m.history=series;
      for(const [kind,p] of Object.entries(panels)){
        if(!size(p))continue;
        if(kind==='prior'){prior(p,m,b,reading,modelKey,reduce.matches,now);continue;}
        const g=pen(p.base,p.w,p.h);if(!g)continue;
        if(kind==='pnl'){
          publicDepth(p,g,m,b,reading,depthSamples[side]);
        }else if(kind==='tape'){
          const existingFlares=p.flashes.filter(f=>now-f.t<760);
          tape(p,g,m,b,old,now,reading);
          if(!changedBook&&!m.stale)p.flashes=existingFlares;
        }else waterfall(p,g,model.t,reading);
      }
      previous={key:modelKey,headline,at,bids:o.bids,asks:o.asks,depth};
      applyActive();scheduleAnimation();
    }
    function overlayFrame(now){
      anim=0;if(document.hidden)return;
      for(const [kind,p] of Object.entries(panels)){
        if(!p.visible||!p.w||!p.h||!['tape','prior'].includes(kind))continue;
        if(kind==='tape'&&!p.tapeInk&&!p.flashes.length&&!p.particle)continue;
        const c=p.overlay.getContext('2d');c.setTransform(p.overlay.width/p.w,0,0,p.overlay.height/p.h,0,0);c.clearRect(0,0,p.w,p.h);
        if(reduce.matches||model.stale||p.stopMotion)continue;
        if(kind==='tape'){
          p.flashes=p.flashes.filter(v=>now-v.t<760);
          for(const f of p.flashes){c.fillStyle=f.col;c.globalAlpha=Math.max(0,1-(now-f.t)/760)*.46;c.fillRect(f.x,f.y,f.w,f.h);}c.globalAlpha=1;
          const d=p.particle;if(d&&now-d.t>=0&&now-d.t<760){
            const u=(now-d.t)/760,xx=d.fromX+(d.x-d.fromX)*u,yy=d.y-10*Math.sin(Math.PI*u);
            c.fillStyle=d.color;c.globalAlpha=.8*(1-u*.6);c.beginPath();c.arc(xx,yy,2.1,0,Math.PI*2);c.fill();c.globalAlpha=1;
          }else p.particle=null;
          p.tapeInk=Boolean(p.particle||p.flashes.length);
        }else if(p.fan){
          advanceFan(p,now);
          p.fanTime=(p.fanTime||0)+clamp(now-(p.particleFrame??now),0,64);p.particleFrame=now;
          const f=p.fan;
          const count=Math.min(12,f.paths.length);
          for(let i=0;i<count;i++){
            const k=Math.floor(i*f.paths.length/count),pts=f.paths[k];
            const phase=(p.fanTime*.00021+i/count)%1,u=Math.min(1,phase/.83)*(pts.length-1),j=Math.floor(u);
            const a=pts[j],b=pts[Math.min(pts.length-1,j+1)];
            let x=a[0]+(b[0]-a[0])*(u-j),y=a[1]+(b[1]-a[1])*(u-j);
            if(phase>.83&&f.paths.length>1){
              const row=clamp((y-f.top)/(f.bottom-f.top)*(f.edge.length-1),0,f.edge.length-1),lo=Math.floor(row);
              const limit=f.edge[lo][0]+(f.edge[Math.ceil(row)][0]-f.edge[lo][0])*(row-lo);
              x=f.end+(limit-f.end)*(phase-.83)/.17;
            }
            c.globalAlpha=.64*Math.min(1,phase/.06,(1-phase)/.12);c.fillStyle=f.pathColor[k];
            c.beginPath();c.arc(x,y,1.45,0,Math.PI*2);c.fill();
          }
          c.globalAlpha=1;
        }
      }
      scheduleAnimation();
    }
    function scheduleAnimation(){
      if(anim||reduce.matches||document.hidden||model.stale)return;
      const now=performance.now(),p=panels.tape;
      if(panels.prior?.visible&&panels.prior.fan?.paths.length&&!panels.prior.stopMotion||p?.visible&&(p.tapeInk||p.flashes.some(v=>now-v.t<800)||p.particle&&now-p.particle.t<800))anim=requestAnimationFrame(overlayFrame);
    }
    function clearOverlays(){for(const p of Object.values(panels)){const c=p.overlay.getContext('2d');c?.setTransform(1,0,0,1,0,0);c?.clearRect(0,0,p.overlay.width,p.overlay.height);p.tapeInk=false;}}
    function queue(){dirty=true;if(!paintFrame&&visible())paintFrame=requestAnimationFrame(draw);}
    const io=new IntersectionObserver(entries=>{for(const entry of entries){const p=panels[entry.target.dataset.pmPanel];if(p)p.visible=entry.isIntersecting;}if(visible())queue();else if(anim){cancelAnimationFrame(anim);anim=0;}});
    const ro=new ResizeObserver(queue);for(const p of Object.values(panels)){io.observe(p.host);ro.observe(p.chart);}
    reduce.addEventListener('change',()=>{clearOverlays();queue();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){queue();scheduleAnimation();}});
    function readingFor(id){
      if(dirty){if(paintFrame)cancelAnimationFrame(paintFrame);draw(true);}
      const defaults={prior:'等待已观测分钟价格。',edge:'等待历史价格范围与盘口价差。',kelly:'等待当前合约的公开盘口。',spotter:'等待所选方向的报价采样。',taker:'等待所选方向的卖一挂单。',closer:'等待本次请求的实测耗时。'};
      return reading[id]||defaults[id]||'';
    }
    return {update(s,side,id,stale,account,telemetry,chartContext){
      const sel=String(side||'up').toLowerCase()==='down'?'down':'up',sKey=String(s?.conditionId||s?.slug||''),unit=chartContext?.unit==='btc'?'btc':'contract',key=sKey+'|'+sel+'|'+unit;
      const signature=[s,s?.asOf,s?.receivedAt,s?.histories?.[sel]?.length,s?.histories?.[sel]?.at(-1)?.p,s?.outcomes?.[sel]?.at,
        s?.outcomes?.[sel]?.bids?.[0]?.[0],s?.outcomes?.[sel]?.asks?.[0]?.[0],s?.outcomes?.[sel]?.bids?.[0]?.[1],s?.outcomes?.[sel]?.asks?.[0]?.[1],
        s?.marketTrades?.[sel]?.length,s?.marketTrades?.[sel]?.at(-1)?.t,account,account?.asOf,account?.status,telemetry,telemetry?.id,telemetry?.spans?.length,telemetry?.total,chartContext?.spot?.at,chartContext?.spot?.price,chartContext?.spot?.status,chartContext?.spot?.candles,chartContext?.spot?.candles?.at(-1)?.c,key,Boolean(stale)];
      const paint=!prevData||signature.some((v,i)=>v!==prevData[i]),activeChanged=id!==model.active;
      if(memoryMarket!==sKey){observedDepth=new Map();depthSamples={up:[],down:[]};lastDepthSnapshot=null;memoryMarket=sKey;}
      if(s!==lastDepthSnapshot){observeBookDepth(depthSamples,s);lastDepthSnapshot=s;}
      if(modelKey!==key||stale!==model.stale){clearOverlays();if(panels.tape){panels.tape.flashes=[];panels.tape.particle=null;}if(modelKey!==key){previous=null;const p=panels.prior;if(p){p.fan=p.fanGoal=p.fanInput=null;p.particleFrame=null;if(p.w&&p.h)pen(p.base,p.w,p.h);}for(const r of Object.keys(reading))delete reading[r];}}
      modelKey=key;model={s:s||null,side:sel,active:id||null,stale:Boolean(stale),account:account||null,t:telemetry||null,unit,context:chartContext||null};prevData=signature;
      if(paint)queue();if(activeChanged)applyActive();
    },reading:readingFor};
  };
})();

;
/* Render each observed event once in the timeline and reuse it for the terminal. */
(() => {
  'use strict';
  function element(tag, className, text) {
    const el=document.createElement(tag);
    el.className=className;
    if(text!=null)el.textContent=text;
    return el;
  }
  window.createDeskTrace=function(panel,log,{limit=16}={}){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const terminal=element('div','trace-terminal');
    terminal.dataset.traceTerminal='';
    const detail=panel.querySelector('#trace-detail');
    if(detail){
      terminal.id='live-terminal';
      terminal.hidden=true;
      detail.addEventListener('click',()=>{
        terminal.hidden=!terminal.hidden;
        detail.setAttribute('aria-expanded',String(!terminal.hidden));
        detail.title=terminal.hidden?'展开逐字命令终端':'收起逐字命令终端';
        if(!terminal.hidden)show(latest);
      });
    }
    const prompt=element('span','trace-prompt','grok@desk:~$');
    const output=element('span','trace-output'),text=element('span','trace-text');
    text.dataset.traceText='';
    const cursor=element('i','trace-cursor');cursor.setAttribute('aria-hidden','true');
    output.append(text,cursor);terminal.append(prompt,output);panel.append(terminal);
    log.classList.add('trace-list');
    let frame=0,latest=null;
    function show(row,instant=false){
      cancelAnimationFrame(frame);frame=0;latest=row;
      const full=row?row.dataset.commandLabel+' → '+row.dataset.result:'';
      const chars=Array.from(full);
      terminal.title=full;
      terminal.style.setProperty('--agent',row?.style.getPropertyValue('--agent')||'#668581');
      output.scrollLeft=0;
      text.textContent='';
      // A row always exposes the complete result immediately, including during typing.
      if(!full||instant||reduced.matches||document.hidden||!terminal.getClientRects().length){
        text.textContent=full;return;
      }
      const start=performance.now(),duration=Math.min(820,Math.max(280,chars.length*18));
      let previous=0;
      function type(now){
        const n=Math.min(chars.length,Math.max(1,Math.floor(chars.length*(now-start)/duration)));
        if(n!==previous){
          text.textContent=chars.slice(0,n).join('');previous=n;
          output.scrollLeft=output.scrollWidth;
        }
        frame=n<chars.length?requestAnimationFrame(type):0;
      }
      frame=requestAnimationFrame(type);
    }
    function add({time,actor,color,command,commandLabel=command,result,message,account=false,instant=false}){
      if(!command||result==null)return;
      const row=element('div','event');
      row.dataset.command=command;row.dataset.commandLabel=commandLabel;row.dataset.result=String(result);
      if(account)row.dataset.account='true';
      row.style.setProperty('--agent',color||'#647c8a');
      const badge=element('strong','trace-badge',actor);
      const description=element('span','trace-description',result);
      const stamp=element('time','trace-at',time);
      row.append(stamp,badge,description);
      row.title=[time,actor,message,commandLabel+' → '+result].filter(Boolean).join(' · ');
      log.prepend(row);
      while(log.children.length>limit)log.lastElementChild.remove();
      show(row,instant);
    }
    function clearAccount(){
      for(const row of log.querySelectorAll('[data-account="true"]'))row.remove();
      if(latest&&!log.contains(latest))show(log.firstElementChild,true);
    }
    reduced.addEventListener('change',()=>{if(reduced.matches&&frame)show(latest,true);});
    return {add,clearAccount,clear(){log.replaceChildren();show(null,true);}};
  };
})();

;
/* React to observed public book updates on the reactor manifold and event stream. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg', TAU=Math.PI*2;
  const tones=['#16a58b','#d99720','#d72a87','#9063ce','#447fcb','#db6038'];
  const finite=Number.isFinite, mix=(a,b,f)=>a+(b-a)*f;
  const smooth=t=>t*t*(3-2*t);
  const num=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
  const clock=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'UTC'});
  const cents=n=>finite(n)?num.format(100*n)+'¢':'—';
  const shares=n=>finite(n)?num.format(n)+' sh':'—';
  function element(tag,klass,text){
    const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=text;return e;
  }
  function circle(color){
    const e=document.createElementNS(NS,'circle');e.setAttribute('fill',color);e.setAttribute('class','motion-tip');return e;
  }
  function fit(canvas,w,h){
    const d=Math.min(2,window.devicePixelRatio||1),iw=Math.max(1,Math.round(w*d)),ih=Math.max(1,Math.round(h*d));
    if(canvas.width!==iw||canvas.height!==ih){canvas.width=iw;canvas.height=ih;}
    const c=canvas.getContext('2d');c.setTransform(iw/Math.max(1,w),0,0,ih/Math.max(1,h),0,0);return c;
  }
  function relative(r,b){return {x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height};}
  function route(ray,t){
    const q=1-t;
    return [q*q*q*ray[0]+3*q*q*t*ray[2]+3*q*t*t*ray[4]+t*t*t*ray[6],
      q*q*q*ray[1]+3*q*q*t*ray[3]+3*q*t*t*ray[5]+t*t*t*ray[7]];
  }
  function createDeskMotion({field,agents}){
    const q=s=>document.querySelector(s),station=q('.reactor-panel .station'),art=q('#art');
    const feedList=[...q('#feeds').children],tags=agents.map(a=>q('[data-station="'+a.id+'"]'));
    const leaders=agents.map(a=>q('[data-lead="'+a.id+'"]'));
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const overlay=element('canvas','desk-packets');overlay.setAttribute('aria-hidden','true');station.append(overlay);
    const command=station.querySelector('.command'),stream=element('div','module motion-stream');
    const header=element('div','module-title','EVENT STREAM '),status=element('span','','WAIT');
    const list=element('div','motion-events');header.append(status);stream.append(header,list);command.append(stream);
    stream.title='所选方向官方盘口更新 · UTC 时间。每行记录一次观察到的值变化。';
    const lines=new Map(),packets=[],flashes=new WeakMap();
    let streamKey='',previous=null,lastPacketTime=-1000,lastFrame=-1000,lastGeo=-1000,seq=0;
    let geo=null,isStale=true,shouldClear=true,tableCycle=0;
    function flash(node,color){
      if(!node||reduced.matches||!node.animate)return;
      flashes.get(node)?.cancel();
      flashes.set(node,node.animate([{backgroundColor:color,transform:'translateY(-1px)'},{backgroundColor:'transparent',transform:'translateY(0)'}],{duration:660,easing:'ease-out'}));
    }
    const narrowEvents=matchMedia('(max-width:900px)');
    function enqueueRow(label,text,color,at){
      const row=element('div','motion-row'),t=element('time','',clock.format(at));
      row.dataset.update=label;t.dateTime=new Date(at).toISOString();
      const n=element('span','',text);n.style.color=color;row.append(t,element('b','',label),n);
      row.title=clock.format(at)+' UTC · '+label+' · '+text;
      const moving=[...list.children].slice(0,2),step=moving[0]?.getBoundingClientRect().height||9;
      list.prepend(row);while(list.children.length>3)list.lastElementChild.remove();
      if(!reduced.matches && row.animate && narrowEvents.matches){
        // Prices can change multiple times within one frame. Keep wrapped rows in their own cells.
        row.animate([{opacity:.72},{opacity:1}],{duration:170,easing:'ease-out'});
      }else if(!reduced.matches && row.animate){
        row.animate([{opacity:.2,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:370,easing:'ease-out'});
        for(const e of moving)e.animate([{transform:'translateY(-'+step+'px)'},{transform:'translateY(0)'}],{duration:370,easing:'ease-out'});
      }
    }
    function snapshot(s,side,stale,availableFeeds){
      const key=s?.slug?s.slug+'/'+side:'';
      if(key!==streamKey){
        streamKey=key;previous=null;packets.length=0;list.replaceChildren();tableCycle=0;shouldClear=true;
        for(const trace of lines.values()){trace.key=null;trace.from=null;trace.current=null;trace.running=false;}
      }
      isStale=!!stale||!s;
      const o=s?.outcomes?.[side],at=o?.at;
      status.textContent=isStale?'HOLD':o?.bookAvailable?'BOOK':'WAIT';
      if(isStale || !o?.bookAvailable || !finite(at) || at<=0){packets.length=0;shouldClear=true;return;}
      if(previous && at<previous.at)return;
      const bid=o.bids?.[0],ask=o.asks?.[0],spread=finite(ask?.[0])&&finite(bid?.[0])&&ask[0]>=bid[0]?ask[0]-bid[0]:null;
      const raw={bid:bid?.[0]??null,ask:ask?.[0]??null,bs:bid?.[1]??null,as:ask?.[1]??null,tick:o.tickSize??null,min:o.minSize??null,spread,at};
      if(previous && at===previous.at && Object.keys(raw).every(k=>previous[k]===raw[k]))return;
      const rows=[
        ['bid','BID','#cmd-bid',cents],['ask','ASK','#cmd-ask',cents],['bs','BID QTY','',shares],
        ['as','ASK QTY','',shares],['tick','TICK','#cmd-tick',cents],['min','MIN','#cmd-min',shares],['spread','SPREAD','#spread',cents]
      ];
      if(!previous)enqueueRow(side.toUpperCase(),cents(raw.bid)+' / '+cents(raw.ask),'#287fa1',at);
      else {
        const changed=rows.filter(([key])=>raw[key]!==previous[key]);
        for(const [field,name,selector,fmt] of changed){
          const up=finite(raw[field])&&finite(previous[field])&&raw[field]>previous[field];
          const color=up?'#067e76':'#ad4862',wash=up?'#bce9d9':'#f7d0d8';
          if(selector)flash(q(selector)?.parentElement,wash);
          if(field==='bid'||field==='ask'){
            flash(q('.quote-pick[data-side="'+side+'"] strong'),wash);
            flash(q('#core-level'),'#ddd4f4');
          }
        }
        // Two entries per observation leave time to read adjacent rows.
        const start=changed.length?tableCycle%changed.length:0;
        for(let i=Math.min(changed.length,2)-1;i>=0;i--){
          const [k,name,,fmt]=changed[(start+i)%changed.length],up=finite(raw[k])&&finite(previous[k])&&raw[k]>previous[k];
          enqueueRow(name,fmt(previous[k])+' → '+fmt(raw[k]),up?'#087f77':'#ab465f',at);
        }
        if(changed.length)tableCycle++;
      }
      previous=raw;
      const now=performance.now();
      if(!reduced.matches && now-lastPacketTime>240){
        lastPacketTime=now;
        for(let i=0;i<6;i++){
          if(!availableFeeds[i])continue;
          for(let j=0;j<3;j++){
            const n=++seq,noise=Math.sin(n*2.39996);
            packets.push({row:i,start:now+i*87+j*890+(noise+1)*75,duration:870+((n*71)%362),bend:noise,bright:(n%5)/5});
          }
        }
        if(packets.length>75)packets.splice(0,packets.length-75);
      }
    }

    // Sparkline interpolation has a stable horizontal sample grid. Missing spans remain broken.
    function samples(data){
      const good=data.filter(finite);if(!good.length)return [];
      const lo=Math.min(...good),hi=Math.max(...good),y=v=>hi===lo?10:18-(v-lo)*16/(hi-lo);
      if(data.length===1)return [[96,y(data[0])]];
      const n=data.length,points=[];
      for(let k=0;k<=40;k++){
        const u=k*(n-1)/40,i=Math.floor(u),j=Math.min(n-1,i+1),f=u-i;
        const v=finite(data[i])&&(f<1e-6||finite(data[j]))?mix(data[i],f<1e-6?data[i]:data[j],smooth(f)):null;
        points.push(finite(v)?[2+94*k/40,y(v)]:null);
      }
      return points;
    }
    function renderTrace(state,progress){
      const {line,area,tip,glow,to,from}=state;let d='',start=true;
      const pts=progress<1 && from?.length===to.length?to.map((v,i)=>v&&from[i]?[v[0],mix(from[i][1],v[1],smooth(progress))]:v):to;
      for(const p of pts){
        if(!p){start=true;continue;}
        d+=(start?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(2)+' ';start=false;
      }
      line.setAttribute('d',d);
      if(area)area.setAttribute('d',pts.length>1&&pts.every(Boolean)?d+' L96 20 L2 20 Z':'');
      const end=pts.at(-1);
      for(const dot of [glow,tip]){
        dot.style.visibility=end?'visible':'hidden';
        if(end){dot.setAttribute('cx',end[0]);dot.setAttribute('cy',end[1].toFixed(2));}
      }
      state.current=pts;
    }
    function trace(line,area,data,color){
      let state=lines.get(line);
      if(!state){
        const tip=circle(color),glow=circle(color);
        glow.setAttribute('r','3.2');glow.setAttribute('opacity','.15');tip.setAttribute('r','1.6');
        line.parentElement.append(glow,tip);line.style.strokeLinejoin='round';line.style.strokeLinecap='round';
        state={line,area,tip,glow,key:null,current:null,from:null,start:0,to:[],running:false};lines.set(line,state);
      }
      const key=data.join('|');if(key===state.key)return;state.key=key;
      state.to=samples(data);state.from=state.current;state.start=performance.now();
      state.running=!reduced.matches&&!isStale&&state.from?.length>1&&state.from.length===state.to.length;
      renderTrace(state,state.running?0:1);
    }
    function updateGeometry(now){
      if(geo && now-lastGeo<125)return;
      lastGeo=now;
      const root=station.getBoundingClientRect(),a=relative(art.getBoundingClientRect(),root);
      const r=Math.min(a.w*.316,a.h*.5),cx=a.x+a.w*.5,cy=a.y+a.h*.532;
      const feedRects=feedList.map(el=>relative(el.getBoundingClientRect(),root));
      const mobile=feedRects[0].y >= a.y + a.h - 1;
      const routes=feedRects.map((f,i)=>{
        const left=mobile?Math.max(a.x+11,Math.min(cx-r*.25,f.x+f.w*.72)):f.x+f.w+4;
        const y=mobile?f.y-1:f.y+f.h*.5;
        const angle=mobile?Math.PI*(.54+.24*i/5):Math.PI*(1.18-.36*i/5);
        const ex=cx+r*.90*Math.cos(angle),ey=cy+r*.67*Math.sin(angle);
        const dx=ex-left,dy=ey-y;
        return mobile?[left,y,left+dx*.03,y+dy*.52,ex+dx*.14,ey-dy*.05,ex,ey]:
          [left,y,left+dx*.23,y,ex-dx*.32,ey-dy*.35,ex,ey];
      });
      const layout=tags.map(tag=>relative(tag.getBoundingClientRect(),root));
      geo={root,a,r,w:station.clientWidth,h:station.clientHeight,routes,layout,feedRects,
        rightColumn:relative(command.getBoundingClientRect(),root),mobile};
    }
    function packetLayer(now,t){
      updateGeometry(now);
      const g=geo;
      if(!g||!g.w||!g.h)return;
      const c=fit(overlay,g.w,g.h);c.clearRect(0,0,g.w,g.h);
      if(reduced.matches||g.root.bottom<0||g.root.top>innerHeight)return;
      const bounds=station.getBoundingClientRect();
      c.save();c.beginPath();c.rect(0,0,g.w,g.h);
      for(const r of g.layout)c.rect(r.x-1,r.y-1,r.w+2,r.h+2);
      if(g.mobile)for(const r of [...g.feedRects,g.rightColumn])c.rect(r.x,r.y,r.w,r.h);
      c.clip('evenodd');
      if(!isStale && previous){
        for(let i=0;i<g.routes.length;i++){
          const v=g.routes[i];
          c.beginPath();c.moveTo(v[0],v[1]);c.bezierCurveTo(v[2],v[3],v[4],v[5],v[6],v[7]);
          c.strokeStyle=tones[i];c.globalAlpha=.105;c.lineWidth=.72;c.stroke();
        }
      }
      for(let i=packets.length-1;i>=0;i--){
        const p=packets[i],f=(now-p.start)/p.duration;
        if(f>1){packets.splice(i,1);continue;}if(f<0)continue;
        const h=f*(.62+.38*f),beam=g.routes[p.row],head=route(beam,h),tail=route(beam,Math.max(0,h-.035));
        const wobble=Math.sin(Math.PI*f)*p.bend*5;head[1]+=wobble;tail[1]+=wobble;
        const alpha=Math.min(1,f*9,(1-f)*7)*(.65+.35*p.bright);
        c.strokeStyle=c.fillStyle=tones[p.row];c.globalAlpha=.55*alpha;
        c.lineWidth=1.45;c.beginPath();c.moveTo(tail[0],tail[1]);c.lineTo(head[0],head[1]);c.stroke();
        c.globalAlpha=alpha;c.beginPath();c.arc(head[0],head[1],1.12+p.bright*.43,0,TAU);c.fill();
      }
      for(let i=0;i<agents.length;i++){
        const agent=agents[i],pos=field.position(agent.id),tag=g.layout[i];
        if(!pos||!tag||!tag.w||!leaders[i]?.classList.contains('is-on'))continue;
        const px=pos.x-bounds.left,py=pos.y-bounds.top,side=tag.x>g.a.x+g.a.w*.5?-1:1;
        const ex=side<0?tag.x:tag.x+tag.w,ey=tag.y+tag.h*.5;
        const bend=ex+side*Math.min(20,Math.abs(ex-px)*.25),l1=Math.hypot(bend-px,ey-py),l2=Math.abs(ex-bend);
        const progress=(t*.77)%1,step=progress*(l1+l2),first=step<=l1,f=first?step/(l1||1):(step-l1)/(l2||1);
        const x=first?mix(px,bend,f):mix(bend,ex,f),y=first?mix(py,ey,f):ey;
        c.fillStyle=agent.color;c.globalAlpha=.18;c.beginPath();c.arc(x,y,4.3,0,TAU);c.fill();
        c.globalAlpha=.92;c.beginPath();c.arc(x,y,1.75,0,TAU);c.fill();
      }
      c.restore();
      overlay.dataset.packets=String(packets.length);
    }
    function frame(now,animationSeconds){
      if(now>=lastFrame&&now-lastFrame<30)return;
      lastFrame=now;
      for(const state of lines.values())if(state.running){
        const f=Math.max(0,Math.min(1,(now-state.start)/360));renderTrace(state,reduced.matches?1:f);
        if(f>=1||reduced.matches)state.running=false;
      }
      const t=finite(animationSeconds)?animationSeconds:now/1000;
      if(!reduced.matches){packetLayer(now,t);shouldClear=true;}
      else if(shouldClear){
        shouldClear=false;packets.length=0;
        overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
      }
    }
    return {snapshot,trace,frame};
  }
  window.createDeskMotion=createDeskMotion;
})();

;
/* Classic reactor HUD. All market readings come from the current Polymarket window. */
(() => {
  'use strict';
  const roles = [
    {id:'taker',role:'ORDER BOOK',place:'ORDER BOOK',feed:'book'},
    {id:'spotter',role:'TAPE',place:'THE TAPE',feed:'tape'},
    {id:'kelly',role:'DEPTH',place:'P&L ATTRIBUTION',feed:'depth'},
    {id:'edge',role:'SPREAD',place:'THE PRIOR',feed:'spread'},
    {id:'closer',role:'STATUS',place:'TICK-TO-TRADE',feed:'lag'},
    {id:'prior',role:'RANGE',place:'THE PRIOR',feed:'median'}
  ];
  const feedDefs = [
    {id:'tape',name:'TAPE',color:'#179979',hint:'所选合约的官方历史报价与页面观察到的盘口中价。'},
    {id:'book',name:'ASK BOOK',color:'#ca862a',hint:'所选合约的最低卖价；曲线按收到的盘口时间排列。'},
    {id:'spread',name:'SPREAD',color:'#c62779',hint:'最低卖价减最高买价。曲线为本页依次收到的盘口快照。'},
    {id:'depth',name:'DEPTH 5',color:'#8057ba',hint:'所选方向买、卖各前五档的挂单份额合计。'},
    {id:'median',name:'MEDIAN',color:'#426cb0',hint:'取所选合约本期每分钟最后一个可用报价，曲线表示截至各分钟的观测中位数。'},
    {id:'lag',name:'BOOK AGE',color:'#c05237',hint:'本机收到快照与官方订单簿时间戳之差。负值表示两台时钟有偏差。'}
  ];
  const find=id=>document.getElementById(id);
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const num=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
  const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const cents=n=>finite(n)?num.format(n*100)+'¢':'—';
  const fmtAge=n=>finite(n)?(Math.abs(n)<1000?Math.round(n)+' ms':num.format(n/1000)+' s'):'—';
  const svgNS='http://www.w3.org/2000/svg';

  function node(tag,cls,txt){
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!=null)e.textContent=txt;
    return e;
  }
  function svg(tag,attrs){
    const e=document.createElementNS(svgNS,tag);
    for(const [key,value] of Object.entries(attrs))e.setAttribute(key,value);
    return e;
  }
  function svgChart(h,title){
    return svg('svg',{viewBox:'0 0 100 '+h,preserveAspectRatio:'none',role:'img','aria-label':title});
  }
  function priceRows(raw) {
    if(!Array.isArray(raw))return [];
    // Upstream normalises both source shapes to sorted [price, shares] pairs.
    return raw.filter(r=>Array.isArray(r)&&finite(r[0])&&r[0]>=0&&r[0]<=1&&finite(r[1])&&r[1]>0);
  }
  function observedMedians(history){
    const minutes=new Map();
    for(const point of history)minutes.set(Math.floor(point.t/60000),point.p);
    const sorted=[],result=[];
    for(const value of minutes.values()){
      const index=sorted.findIndex(p=>p>value);
      sorted.splice(index===-1?sorted.length:index,0,value);
      const end=sorted.length-1;
      result.push((sorted[Math.floor(end/2)]+sorted[Math.ceil(end/2)])/2);
    }
    return result;
  }
  function chart(values,h=20){
    const numbers=values.filter(finite);
    if(!numbers.length)return '';
    if(numbers.length===1)return 'M98 '+(h/2)+' L100 '+(h/2);
    const lo=Math.min(...numbers),hi=Math.max(...numbers),space=h-2.2;
    let d='',pen=false;
    for(let i=0;i<values.length;i++){
      const v=values[i];
      if(!finite(v)){pen=false;continue;}
      const x=100*i/(values.length-1),y=hi===lo?h/2:1.1+space*(1-(v-lo)/(hi-lo));
      d+=(pen?' L':' M')+x.toFixed(1)+' '+y.toFixed(1);pen=true;
    }
    return d.trim();
  }
  function createClassicHUD({agents,field,inspect}){
    const actors=roles.map(r=>Object.assign({},r,agents.find(a=>a.id===r.id))).filter(a=>a.name&&a.color);
    const actorById=new Map(actors.map(a=>[a.id,a]));
    const roster=find('roster'),stations=find('stations'),leads=find('leads'),art=find('art');
    const feeds=find('feeds'),coils=find('coils'),core=find('core-level'),coreLine=find('core-line');
    const stage=find('stage-text'),events=find('events'),tracePhase=find('trace-phase'),traceCount=find('log-count'),traceTicket=find('trace-ticket'),ribbon=find('ribbon');
    const cards=new Map(),labels=new Map(),leaders=new Map(),feedBoxes=new Map();
    const levelLabels=['B3','B2','B1','A1','A2','A3'];
    const liveTrace=window.createDeskTrace(events.parentElement,events,{limit:16});
    const stateBySide=new Map(),quotes=[];
    let market=null,marketSlug='',direction='up',selected=null,isStale=false,sequence=0;
    let lastLayout=-1000,lastTick=-1000,tickerWidth=0,tickerOffset=0,measureRibbon=true;
    let scatterKey='',previousMark='';
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    function describeDispatch(button,a){
      button.type='button';
      button.style.setProperty('--agent',a.color);
      button.addEventListener('click',()=>inspect(a.id));
      button.addEventListener('pointerenter',()=>field.setHover?.(a.id));
      button.addEventListener('pointerleave',()=>field.setHover?.(null));
    }
    for(const [i,a] of actors.entries()){
      const card=node('button','agent-card'),face=node('i','agent-glyph'),info=node('span');
      card.dataset.dispatch=a.id;card.dataset.actor=a.id;
      describeDispatch(card,a);face.dataset.shape=a.id;face.setAttribute('aria-hidden','true');
      const roleName=node('small','role-id');
      info.append(roleName,node('strong','card-name',a.name));
      const badge=node('span','card-state'),flag=node('span','','IDLE');
      badge.append(node('b'),flag);
      const line=svgChart(12,'Polymarket · '+feedDefs.find(f=>f.id===a.feed).hint),path=svg('path',{fill:'none',stroke:'currentColor','stroke-width':1,'vector-effect':'non-scaling-stroke'});
      line.classList.add('card-spark');line.append(path);card.append(face,info,badge,line);roster.append(card);
      const ringRole=node('small');
      cards.set(a.id,{card,flag,path,roleName,ringRole,index:i});
      const label=node('button','ring-tag'),txt=node('span');label.dataset.station=a.id;describeDispatch(label,a);
      txt.append(node('strong','',a.name),ringRole);label.append(node('i'),txt);stations.append(label);labels.set(a.id,label);
      const leader=svg('path',{stroke:a.color,'data-lead':a.id});leads.append(leader);leaders.set(a.id,leader);
    }
    for(const f of feedDefs){
      const box=node('div','feed-box'),header=node('span','feed-label'),val=node('b','','—');
      box.dataset.feed=f.id;box.style.setProperty('--tint',f.color);box.title=f.hint;
      header.append(node('i'),document.createTextNode(f.name),val);
      const graphic=svgChart(20,f.hint);
      const area=svg('path',{fill:f.color,opacity:'.08'}),line=svg('path',{fill:'none',stroke:f.color,'stroke-width':'1.2','vector-effect':'non-scaling-stroke'});
      graphic.append(area,line);box.append(header,graphic);feeds.append(box);feedBoxes.set(f.id,{box,val,line,area});
    }
    const coilHeader=coils.closest('.module')?.querySelector('.module-title');
    if(coilHeader)coilHeader.replaceChildren(document.createTextNode('COIL DEPTH'),node('span','','SHARES'));
    const coreHeader=core.closest('.module')?.querySelector('.module-title');
    if(coreHeader)coreHeader.replaceChildren(document.createTextNode('CORE MID'),node('span','','BBO'));
    const depthColors=actors.map(a=>a.color);
    const bars=levelLabels.map((name,i)=>{
      const coil=node('span','coil'),bar=node('i','coil-bar');
      coil.style.setProperty('--agent',depthColors[i]||'#4774a2');
      coil.title=name;coil.append(bar,node('small','',name));coils.append(coil);
      return {coil,bar};
    });
    // Duplicate the ticker text for a seamless scroll. Keep one accessible copy.
    for (let copy=0;copy<2;copy++){
      for (let i=0;i<6;i++){
        const cell=node('span'),dot=node('i','wire-dot'),name=node('b'),val=node('span'),clock=node('small');
        dot.style.background=feedDefs[i].color;cell.append(dot,name,val,clock);ribbon.append(cell);
        if(copy)cell.setAttribute('aria-hidden','true');
        quotes.push({cell,name,val,clock});
      }
    }
    const motion=window.createDeskMotion?.({field,agents:actors});
    function paintsRibbon(rows){
      const next=JSON.stringify(rows);
      if(next===scatterKey)return;
      scatterKey=next;measureRibbon=true;
      quotes.forEach(({cell,name,val,clock},i)=>{
        const row=rows[i%6];cell.style.display=row?'':'none';
        name.textContent=row?.[0]||'';val.textContent=row?.[1]||'';clock.textContent=row?.[2]||'';
      });
    }
    function localNote(id,message,options={}){
      if(!message)return;
      const a=actorById.get(typeof id==='object'?id?.id:id);
      const at=finite(options.at) && !Number.isNaN(new Date(options.at).getTime())?options.at:Date.now();
      const text=String(message),name=String(options.label||a?.name||'SYSTEM');
      const color=a?.color||(name==='FILL'?'#178569':name==='ORDER'?'#8350b9':'#65798b');
      const command=options.command||'desk.status()';
      const commandLabel=a&&command.startsWith(a.id+'.')?a.name.toLowerCase()+command.slice(a.id.length):command;
      liveTrace.add({time:time.format(at),actor:name,color,command,commandLabel,
        result:text,message:options.summary,account:options.account});
      sequence++;traceCount.textContent=String(sequence).padStart(3,'0');
      traceTicket.textContent='#'+String(sequence).padStart(4,'0');traceTicket.title='本机巡检日志序号';
    }
    function clearAccountNotes(){
      liveTrace.clearAccount();
    }
    function describeRoles(){
      for(const a of actors){
        const item=cards.get(a.id),feed=feedDefs.find(f=>f.id===a.feed);
        item.roleName.textContent='0'+(item.index+1)+' · '+a.role;
        item.ringRole.textContent=a.role;
        for(const button of [item.card,labels.get(a.id)]){
          button.title=a.name+' · '+a.place+'。卡片曲线：'+feed.hint;
          button.setAttribute('aria-label',button.title);
        }
      }
    }
    function mark(active){
      const id=typeof active==='string'?active:active?.id;
      selected=actorById.has(id)?id:null;
      const agent=actorById.get(selected);
      const arrived=!!(active?.didRead||active?.arrived);
      const mode=active?.returning?'RETURNING':arrived?'READING':'INSPECT';
      const markKey=[id||'',mode,!!market,isStale].join('|');
      if(previousMark===markKey)return;
      previousMark=markKey;
      for(const a of actors){
        const on=a.id===selected,item=cards.get(a.id);
        item.card.classList.toggle('is-on',on);item.card.setAttribute('aria-pressed',String(on));
        const working=on&&arrived&&!active?.returning;
        item.card.classList.toggle('is-working',working);
        if(!working&&item.progressStep!=null){
          item.card.style.removeProperty('--work-progress');
          item.card.removeAttribute('aria-description');
          item.progressStep=null;
        }
        item.flag.textContent=on?mode:'IDLE';labels.get(a.id).classList.toggle('is-on',on);
        leaders.get(a.id).classList.toggle('is-on',on);
        feedBoxes.get(a.feed).box.classList.toggle('is-on',on);
      }
      stage.textContent=isStale?'MARKET FEED STALE':!market?'AWAITING FEED':agent?agent.name+' / '+mode:'FIELD STABLE';
      tracePhase.textContent=isStale?'LAST OBSERVATION':!market?'WAITING FOR MARKET':agent?agent.name+' → '+agent.place:'MARKET MONITOR';
    }
    function workProgress(id,fraction){
      const item=cards.get(id);
      const progress=Math.min(1,Math.max(0,fraction));
      const stepSize=reduced.matches?25:10;
      const step=Math.floor(progress*100/stepSize)*stepSize;
      if(!reduced.matches||step!==item.progressStep){
        const percent=reduced.matches?step:progress*100;
        item.card.style.setProperty('--work-progress',percent.toFixed(2)+'%');
      }
      if(step!==item.progressStep){
        item.progressStep=step;
        item.card.setAttribute('aria-description','本次巡检进度 '+step+'%');
      }
    }
    function newBucket(){return {samples:[],lastStamp:null};}
    function render(s,side='up',active=null,stale=false){
      const previousSlug=marketSlug,previousStale=isStale;
      direction=side==='down'?'down':'up';market=s||null;isStale=!!stale;
      marketSlug=s?.slug||'';
      if(marketSlug!==previousSlug){
        stateBySide.clear();
        if(marketSlug)localNote(null,'BTC '+String(s.interval).toUpperCase()+' · '+time.format(s.startTime)+'–'+time.format(s.endTime)+' UTC');
      }
      if(s && isStale!==previousStale)localNote(null,isStale?'Market feed stale · readings held':'Market feed resumed');
      mark(active);
      const o=s?.outcomes?.[direction],bids=priceRows(o?.bids),asks=priceRows(o?.asks);
      const bid=bids[0]?.[0]??null,ask=asks[0]?.[0]??null;
      const received=finite(s?.receivedAt)?s.receivedAt:null;
      const age=finite(received)&&finite(o?.at)?received-o.at:null;
      const end=finite(s?.endTime)?s.endTime:null;
      const crossed=finite(bid)&&finite(ask)&&bid>ask;
      const gap=finite(bid)&&finite(ask)&&!crossed?ask-bid:null;
      const mid=finite(gap)?(bid+ask)/2:null;
      const history=(s?.histories?.[direction]||(direction==='up'?s?.history:[])||[])
        .filter(p=>finite(p?.p)&&finite(p?.t)&&p.t>=s.startTime&&p.t<s.endTime);
      const medians=observedMedians(history);
      const depth=o?.bookAvailable
        ? [...bids.slice(0,5),...asks.slice(0,5)].reduce((sum,level)=>sum+level[1],0)
        : null;
      let bucket=stateBySide.get(direction);
      if(!bucket){bucket=newBucket();stateBySide.set(direction,bucket);}
      const stamp=o?.at??null;
      if(s && !isStale && o?.bookAvailable && finite(received) && finite(stamp) && (bucket.lastStamp===null || stamp>=bucket.lastStamp)){
        const sample={ask,spread:gap,depth,lag:age,mid};
        if(stamp===bucket.lastStamp)bucket.samples[bucket.samples.length-1]=sample;
        else{
          if(bucket.lastStamp!==null && (stamp-bucket.lastStamp>15000 || previousStale))bucket.samples.push({});
          bucket.samples.push(sample);
        }
        if(bucket.samples.length>48)bucket.samples.splice(0,bucket.samples.length-48);
        bucket.lastStamp=stamp;
      }
      const series={
        tape:history.slice(-45).map(p=>p.p),book:bucket.samples.map(p=>p.ask),
        spread:bucket.samples.map(p=>p.spread),depth:bucket.samples.map(p=>p.depth),
        median:medians,lag:bucket.samples.map(p=>p.lag)
      };
      const readings={tape:history.at(-1)?.p,book:ask,spread:gap,depth,median:medians.at(-1),lag:age};
      const values={tape:cents(readings.tape),book:cents(ask),spread:cents(gap),depth:finite(depth)?compact.format(depth)+' sh':'—',
        median:cents(readings.median),lag:fmtAge(age)};
      motion?.snapshot(s,direction,isStale,feedDefs.map(f=>finite(readings[f.id])));
      for(const f of feedDefs){
        const {box,line,area,val}=feedBoxes.get(f.id),d=chart(series[f.id]);
        val.textContent=values[f.id];
        if(motion)motion.trace(line,area,series[f.id],f.color);
        else {
          line.setAttribute('d',d);
          area.setAttribute('d',d && series[f.id].filter(finite).length>1 && series[f.id].every(finite)?d+' L100 20 L0 20 Z':'');
        }
        box.title=f.hint+(isStale?' 当前显示上次读数。':'');
      }
      for(const a of actors)cards.get(a.id).path.setAttribute('d',chart(series[a.feed],12));
      const levels=[bids[2],bids[1],bids[0],asks[0],asks[1],asks[2]];
      const largest=Math.max(0,...levels.map(l=>l?.[1]||0));
      bars.forEach(({bar,coil},i)=>{
        const level=levels[i],v=level?.[1]||0;
        bar.style.minHeight=v?'2px':'0';bar.style.height=largest?Math.round(84*v/largest)+'%':'0';
        coil.title=level?levelLabels[i]+' · '+cents(level[0])+' · '+num.format(v)+' shares':levelLabels[i]+' · 无该档挂单';
      });
      core.textContent=cents(mid);core.title='所选方向买一和卖一的中点；曲线为本页收到的真实快照。'+(isStale?' 上次读数。':'');
      if(motion)motion.trace(coreLine,null,bucket.samples.map(v=>v.mid),'#7754a6');
      else coreLine.setAttribute('d',chart(bucket.samples.map(v=>v.mid)));
      coreLine.parentElement?.setAttribute('aria-label',core.title);
      const clockFor=x=>finite(x)?time.format(x)+' UTC':'';
      if(!s){
        paintsRibbon([['POLYMARKET','AWAITING MARKET','']]);
      }else{
        const bbo=side=>{const b=s.outcomes?.[side];const bid=priceRows(b?.bids)[0]?.[0],ask=priceRows(b?.asks)[0]?.[0];return [side.toUpperCase()+' BBO',cents(bid)+' / '+cents(ask),clockFor(b?.at)];};
        paintsRibbon([bbo('up'),bbo('down'),['SPREAD',direction.toUpperCase()+' '+cents(gap),clockFor(o?.at)],
          ['ASK DEPTH',asks.length?compact.format(asks[0][1])+' sh @ '+cents(ask):'—',clockFor(o?.at)],
          ['HISTORY',direction.toUpperCase()+' '+cents(history.at(-1)?.p),clockFor(history.at(-1)?.t)],
          ['WINDOW',String(s.interval).toUpperCase()+' · '+(isStale?'STALE':s.acceptingOrders?'OPEN':'CLOSED'),clockFor(end)]]);
      }
    }
    function layout(){
      const now=performance.now();if(now-lastLayout<90)return;lastLayout=now;
      const rect=art.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const pts=actors.map(a=>({id:a.id,p:field.position(a.id)})).filter(o=>o.p);
      if(pts.length!==actors.length)return;
      pts.sort((a,b)=>a.p.x-b.p.x);
      // Read the common tag width before any style writes.
      const tagWidth=labels.get(actors[0].id).offsetWidth;
      for(const [index,group] of [pts.slice(0,3),pts.slice(3)].entries()){
        group.sort((a,b)=>a.p.y-b.p.y).forEach(({p,id},row)=>{
          const tag=labels.get(id),relY=[.105,.505,.89][row],dock=index+'-'+row;
          if(tag.dataset.dock!==dock){
            tag.dataset.dock=dock;tag.style.left=index?'auto':'2px';tag.style.right=index?'2px':'auto';tag.style.top=100*relY+'%';
          }
          const x=index?rect.width-tagWidth-2:tagWidth+2,y=rect.height*relY;
          const px=p.x-rect.left,py=p.y-rect.top,bend=Math.min(20,Math.abs(x-px)*.25);
          leaders.get(id).setAttribute('d','M'+x.toFixed(1)+' '+y.toFixed(1)+' H'+(x+(index?-1:1)*bend).toFixed(1)+' L'+px.toFixed(1)+' '+py.toFixed(1));
        });
      }
    }
    function tick(nowMs,animationSeconds){
      const now=Number.isFinite(nowMs)?nowMs:performance.now();
      motion?.frame(now,animationSeconds);
      if(now>=lastTick && now-lastTick<32)return;
      const delta=Math.max(0,Math.min(100,now-lastTick));lastTick=now;
      if(measureRibbon){
        tickerWidth=quotes[6].cell.offsetLeft-quotes[0].cell.offsetLeft;
        measureRibbon=false;
      }
      if(tickerWidth>0 && market && !reduced.matches && !isStale){
        tickerOffset=(tickerOffset+delta*.024)%tickerWidth;
        ribbon.style.transform='translateX(-'+tickerOffset.toFixed(2)+'px)';
      }else if(tickerOffset){
        tickerOffset=0;ribbon.style.transform='';
      }
    }
    function clear(){
      liveTrace.clear();sequence=0;traceCount.textContent='000';traceTicket.textContent='—';
      stateBySide.clear();marketSlug='';tickerOffset=0;ribbon.style.transform='';render(null,'up');
    }
    window.addEventListener('resize',()=>{lastLayout=-1000;measureRibbon=true;});
    describeRoles();clear();
    return {render,layout,note:localNote,clearAccountNotes,clear,tick,workProgress};
  }
  window.createClassicHUD=createClassicHUD;
})();

;
(() => {
  'use strict';
  window.createDeskDisplay = function () {
    const doc = document.documentElement;
    const compact = document.getElementById('desk-compact');
    const fit = document.getElementById('desk-fit');
    const theme = document.getElementById('desk-theme');
    function read(key) {
      try { return localStorage.getItem('pm-desk:' + key); } catch { return null; }
    }
    function save(key, value) {
      try { localStorage.setItem('pm-desk:' + key, value); } catch {}
    }
    function layout(isCompact) {
      doc.dataset.deskDensity = isCompact ? 'compact' : 'fit';
      compact.disabled = isCompact;
      compact.title = isCompact ? '当前为紧凑布局' : '缩小面板间距和高度';
      compact.setAttribute('aria-label', compact.title);
      fit.title = '恢复自动适配布局';
      fit.setAttribute('aria-label', fit.title);
      fit.setAttribute('aria-pressed', String(!isCompact));
    }
    function palette(isDark) {
      doc.dataset.deskTheme = isDark ? 'dark' : 'light';
      theme.textContent = isDark ? 'DARK' : 'LIGHT';
      theme.title = isDark ? '切换到浅色主题' : '切换到深色主题';
      theme.setAttribute('aria-label', '深色主题');
      theme.setAttribute('aria-pressed', String(isDark));
    }
    compact.addEventListener('click', () => { layout(true); save('layout-density', 'compact'); });
    fit.addEventListener('click', () => { layout(false); save('layout-density', 'fit'); });
    theme.addEventListener('click', () => {
      palette(doc.dataset.deskTheme !== 'dark');
      save('color-theme', doc.dataset.deskTheme);
    });
    layout(read('layout-density') === 'compact');
    palette(read('color-theme') === 'dark');
  };
})();

;
/* One observation is one completed Coinbase BTC-USD minute, timestamped at its close. */
(() => {
  'use strict';

  const minute = 60000;
  const historySize = 30;
  const threshold = 2;
  const emaGain = 2 / (14 + 1);
  // Constant velocity with independent acceleration each minute. Covariances
  // are expressed relative to the measurement variance R = 1.
  const accelerationVariance = 0.01;

  function zScore(innovation, history) {
    let z = null;
    if (history.length === historySize) {
      const mean = history.reduce((sum, value) => sum + value, 0) / historySize;
      const squares = history.reduce((sum, value) => sum + (value - mean) ** 2, 0);
      const sigma = Math.sqrt(squares / (historySize - 1));
      // BTC-USD's one-cent quote quantum is the minimum meaningful dispersion.
      if (sigma >= 0.01) z = innovation / sigma;
      history.shift();
    }
    history.push(innovation);
    return z;
  }

  function crossing(model, previous, current, change) {
    if (previous === null || current === null || Math.abs(current) > threshold) return null;
    if (previous > threshold && change < 0) return {model, side:'down', z:current};
    if (previous < -threshold && change > 0) return {model, side:'up', z:current};
    return null;
  }

  function create() {
    let level, velocity, levelVariance, covariance, velocityVariance, ema;
    let kalmanErrors, emaErrors, last;

    function reset() {
      level = null;
      velocity = 0;
      levelVariance = 1;
      covariance = 0;
      velocityVariance = 1;
      ema = null;
      kalmanErrors = [];
      emaErrors = [];
      last = {
        at:null, price:null, bars:0, ready:false,
        kalman:{estimate:null, predicted:null, z:null},
        ema:{estimate:null, predicted:null, z:null}
      };
    }

    function step(observation) {
      const {at, price} = observation || {};
      if (!Number.isSafeInteger(at) || at < 0 || at % minute !== 0 ||
          !Number.isFinite(price) || price <= 0 || (last.at !== null && at <= last.at)) {
        return {...last, accepted:false, signals:[]};
      }
      if (last.at !== null && at - last.at !== minute) reset();
      if (last.at === null) {
        level = ema = price;
        last = {
          at, price, bars:1, ready:false,
          kalman:{estimate:price, predicted:null, z:null},
          ema:{estimate:price, predicted:null, z:null}
        };
        return {...last, accepted:true, signals:[]};
      }

      const predicted = level + velocity;
      const innovation = price - predicted;
      const kalmanZ = zScore(innovation, kalmanErrors);
      // P_prior = F P F' + Q, with F = [[1, 1], [0, 1]] and
      // Q = accelerationVariance * [[1/4, 1/2], [1/2, 1]].
      const predictedLevelVariance = levelVariance + 2 * covariance + velocityVariance + accelerationVariance / 4;
      const predictedCovariance = covariance + velocityVariance + accelerationVariance / 2;
      const predictedVelocityVariance = velocityVariance + accelerationVariance;
      const observationVariance = predictedLevelVariance + 1;
      const levelGain = predictedLevelVariance / observationVariance;
      const velocityGain = predictedCovariance / observationVariance;
      level = predicted + levelGain * innovation;
      velocity += velocityGain * innovation;
      levelVariance = (1 - levelGain) * predictedLevelVariance;
      covariance = (1 - levelGain) * predictedCovariance;
      velocityVariance = predictedVelocityVariance - velocityGain * predictedCovariance;

      const predictedEma = ema;
      const emaInnovation = price - predictedEma;
      const emaZ = zScore(emaInnovation, emaErrors);
      ema += emaGain * emaInnovation;

      const change = price - last.price;
      const signals = [
        crossing('Kalman', last.kalman.z, kalmanZ, change),
        crossing('EMA', last.ema.z, emaZ, change)
      ].filter(Boolean);
      last = {
        at, price, bars:last.bars + 1, ready:kalmanZ !== null && emaZ !== null,
        kalman:{estimate:level, predicted, z:kalmanZ},
        ema:{estimate:ema, predicted:predictedEma, z:emaZ}
      };
      return {...last, accepted:true, signals};
    }

    reset();
    return {step, reset};
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {create};
  if (typeof window !== "undefined") window.ReversalEngine = {create};
})();

;
/* Foreground, read-only view over confirmed candles and the current contract's book. */
(() => {
  'use strict';
  const minute = 60000;
  const finite = Number.isFinite;
  const time = new Intl.DateTimeFormat('zh-CN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
  const hm = new Intl.DateTimeFormat('zh-CN', {hour:'2-digit', minute:'2-digit', hour12:false});
  const money = new Intl.NumberFormat('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const cents = new Intl.NumberFormat('zh-CN', {maximumFractionDigits:3});
  const sideName = side => side === 'up' ? '买涨（Up）' : '买跌（Down）';
  const zText = z => finite(z) ? (z > 0 ? '+' : '') + z.toFixed(2) : '—';

  function createMinuteReader() {
    let engine = window.ReversalEngine.create();
    let processed = [], previous = null, latest = null;
    let sourceRows, lastMinute;
    return (rows, cutoff) => {
      if (rows === sourceRows && cutoff === lastMinute) return {previous,latest};
      sourceRows = rows;
      lastMinute = cutoff;
      const confirmed = (rows || []).filter(bar => bar.confirmed === true && Number.isSafeInteger(bar.t) &&
        bar.t % minute === 0 && bar.t + minute <= cutoff && finite(bar.c) && bar.c > 0);
      // A rolling REST window can drop leading rows. Preserve the running filter if
      // the overlap is identical; replay if a close was corrected or a gap backfilled.
      const priorTail = processed.filter(bar => confirmed.length && bar.t >= confirmed[0].t);
      const overlapIsUnchanged = priorTail.length > 0 && priorTail.every((bar, i) =>
        confirmed[i]?.t === bar.t && confirmed[i].c === bar.c);
      if (!overlapIsUnchanged) {
        engine.reset();
        latest = previous = null;
      }
      for (let i = overlapIsUnchanged ? priorTail.length : 0; i < confirmed.length; ++i) {
        const bar = confirmed[i];
        const step = engine.step({at:bar.t + minute, price:bar.c});
        if (!step.accepted) continue;
        previous = latest?.at === step.at - minute ? latest : null;
        latest = step;
      }
      processed = confirmed;
      return {previous,latest};
    };
  }

  function usableOffer(market, side, close, now) {
    const book = market.outcomes?.[side];
    if (!book?.bookAvailable || book.bookSource === 'last-websocket' ||
        (market.tokenIds && book.tokenId !== market.tokenIds[side]) || !finite(book.at) ||
        book.at < close || book.at < now - 10000 || book.at >= market.endTime || book.at > now + 3000) return null;
    const [price, size] = book.asks?.[0] || [];
    const bid = book.bids?.[0]?.[0];
    if (!finite(price) || price <= 0 || price >= 1 || !finite(size) || size <= 0 || (finite(bid) && bid > price)) return null;
    return {ask:price, bookAt:book.at};
  }

  function createEvaluator() {
    const read = createMinuteReader();
    return (context, now) => {
      const {market, interval, spot, blockedReason} = context;
      const result = {reason:'', window:null, previous:null, latest:null, intent:null};
      if (interval !== '5m' && interval !== '15m') {
        result.reason = '请选择 BTC 5m 或 15m 合约。';
        return result;
      }
      const windowMs = (interval === '15m' ? 15 : 5) * minute;
      const start = Math.floor(now / windowMs) * windowMs;
      if (!market || market.interval !== interval || !market.conditionId || market.startTime !== start || market.endTime !== start + windowMs) {
        result.reason = '正在等待当期合约资料。';
        return result;
      }
      result.window = [market.startTime, market.endTime];
      const close = Math.floor(now / minute) * minute;
      if (close <= start) {
        result.reason = '等待本期第一根 1 分钟 K 线收盘。';
        return result;
      }
      const {previous, latest} = read(spot?.candles, close);
      if (!latest || latest.at !== close) {
        result.reason = '等待 Coinbase 确认 '+time.format(close)+' 的分钟收盘价。';
        return result;
      }
      result.previous = previous;
      result.latest = latest;
      if (!previous || !latest.ready || !finite(previous.kalman.z) || !finite(previous.ema.z)) {
        result.reason = latest.bars < 33 ? '模型预热中，已有 '+latest.bars+' 根连续收盘 K 线，需要至少 33 根。' : '近期价格波动不足，尚无可比较的两组 Z 值。';
        return result;
      }
      const k = latest.signals.find(s => s.model === 'Kalman');
      const e = latest.signals.find(s => s.model === 'EMA');
      if (!k || !e || k.side !== e.side) {
        if (k && e) result.reason = '两个模型方向相反，等待同一根收盘 K 线出现同向信号。';
        else if (k || e) {
          const only = k || e;
          result.reason = '只有 '+only.model+' 触发'+(only.side === 'up' ? '看涨' : '看跌')+'回撤信号，等待两个模型同向确认。';
        } else result.reason = '这根收盘 K 线没有触发回撤。规则要求 Z 从 ±2 之外回到区间内，且收盘价向相反方向移动。';
        return result;
      }
      if (blockedReason || !market.acceptingOrders) {
        result.reason = blockedReason || '当前合约尚未开放委托。';
        return result;
      }
      const offer = usableOffer(market, k.side, close, now);
      if (!offer) {
        result.reason = '两个模型均触发'+(k.side === 'up' ? '看涨' : '看跌')+'，等待信号后 '+k.side.toUpperCase()+' 方向的有效卖一（10 秒内）。';
        return result;
      }
      result.intent = {side:k.side, interval, conditionId:market.conditionId, signalAt:close, ...offer};
      result.reason = k.side === 'up'
        ? '两个模型的 Z 均从 −2 以下回到区间内，BTC 收盘价回升。'
        : '两个模型的 Z 均从 +2 以上回到区间内，BTC 收盘价回落。';
      return result;
    };
  }

  function element(tag, cls, text) {
    const node = document.createElement(tag);
    node.className = cls;
    if (text) node.textContent = text;
    return node;
  }
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }
  const modelText = (model, previous, latest) => {
    const signal = latest.signals.find(s => s.model.toLowerCase() === model);
    return 'Z '+zText(previous?.[model]?.z)+' → '+zText(latest[model].z)+' · '+(signal ? (signal.side === 'up' ? '看涨' : '看跌') : '未触发');
  };

  window.createDeskAdvice = function createDeskAdvice({host, onReview, getContext, actionLabel = '核对建议'}) {
    const evaluate = createEvaluator();
    let lastContext = {}, displayed = null;
    host.classList.add('desk-advice');
    const row = element('div','advice-top');
    const title = element('h2','advice-title','本期建议');
    const direction = element('strong','advice-direction','观望');
    direction.dataset.advice = 'direction';
    const contract = element('span','advice-contract');
    row.append(title,direction,contract);
    const reason = element('p','advice-reason');
    reason.dataset.advice = 'reason';
    const readings = element('div','advice-readings');
    const fields = {};
    for (const [key,label] of [['kalman','Kalman'],['ema','EMA 14']]) {
      const cell = element('div','advice-model');
      fields[key] = element('span','advice-z');
      cell.append(element('b','advice-model-name',label),fields[key]);
      readings.append(cell);
    }
    const footer = element('div','advice-foot');
    const evidence = element('span','advice-evidence');
    const button = element('button','advice-review',typeof actionLabel === 'string' ? actionLabel : '');
    button.type = 'button';
    button.dataset.advice = 'review';
    footer.append(evidence, button);
    const periodNote = element('p','advice-period-note','15m 沿用 1 分钟回撤信号，暂无单独验证。');
    host.replaceChildren(row,reason,readings,footer,periodNote);

    function update(context) {
      lastContext = context;
      const result = evaluate(context, context.now ?? Date.now());
      const {intent, latest, previous} = result;
      displayed = intent;
      host.dataset.side = intent?.side || 'wait';
      setText(direction, intent ? '建议'+sideName(intent.side) : '观望');
      const period = result.window ? ' · '+hm.format(result.window[0])+'–'+hm.format(result.window[1]) : '';
      setText(contract, 'BTC · '+(context.interval || '5m').toUpperCase()+period);
      periodNote.hidden = context.interval !== '15m';
      setText(reason, result.reason);
      readings.hidden = !latest;
      if (latest) {
        for (const key of ['kalman','ema']) setText(fields[key],modelText(key,previous,latest));
      }
      const source = 'Coinbase BTC/USD · 1 分钟收盘';
      let details = source;
      if (latest) {
        const prices = (previous ? '$'+money.format(previous.price)+' → ' : '')+'$'+money.format(latest.price);
        details = source+' '+time.format(latest.at)+' · '+prices;
      }
      if (intent) details += ' ｜ '+intent.side.toUpperCase()+' 卖一 '+cents.format(intent.ask*100)+'¢ · '+time.format(intent.bookAt);
      setText(evidence,details);
      if (intent && typeof actionLabel === 'function') setText(button,actionLabel(intent.side));
      button.hidden = !intent || typeof onReview !== 'function';
      button.disabled = button.hidden;
    }
    const latestContext = () => getContext ? getContext() : lastContext;
    function current() {
      const context = latestContext();
      return evaluate(context, context.now ?? Date.now()).intent;
    }
    button.addEventListener('click', () => {
      const old = displayed;
      const context = latestContext();
      update(context);
      if (old && displayed && old.side === displayed.side && old.conditionId === displayed.conditionId &&
          old.signalAt === displayed.signalAt && !button.disabled) onReview({...displayed});
    });
    return {update,current};
  };
})();

;
/* Read the published research snapshot once. All quotes are handled separately. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', signDisplay: 'exceptZero', minimumFractionDigits: 2
  });
  function node(tag, text, cls) {
    const result = document.createElement(tag);
    if (text != null) result.textContent = text;
    if (cls) result.className = cls;
    return result;
  }
  function stamp(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? dateFormat.format(t) : '—';
  }
  function amount(value) {
    return node('b', Number.isFinite(value) ? money.format(value) : '—',
      value > 0 ? 'gain' : value < 0 ? 'loss' : '');
  }
  function outcome(side) {
    return side === 'up' ? '看涨' : side === 'down' ? '看跌' : '—';
  }
  function card(model) {
    const box = node('article', null, 'model-card');
    const title = node('div', null, 'model-title');
    title.append(node('h3', model.name), node('small', model.signals + ' 个信号'));
    box.append(title);
    const signal = model.latestSignal;
    const signalGroup = node('div', null, 'model-signal-group');
    const line = node('div', null, 'model-signal');
    line.append(node('small', '最近信号'), node('b', signal ? outcome(signal.side) : '尚无信号'),
      node('time', signal ? stamp(signal.at) : ''));
    signalGroup.append(line);
    if (signal) signalGroup.append(node('p', signal.entered ? '已记录模拟入场' : signal.entryStatus, 'model-reason'));
    const result = model.latestResult;
    const resultGroup = node('div', null, 'model-result-group');
    const settled = node('div', null, 'model-settled');
    settled.append(node('small', '最近模拟结算'), amount(result?.settlementNetUsd));
    if (Number.isFinite(result?.exit1mNetUsd)) {
      settled.title = '同一信号按 1 分钟退出的模拟净盈亏 ' + money.format(result.exit1mNetUsd);
    }
    resultGroup.append(settled, node('p', result ? stamp(result.at) + ' · ' + outcome(result.side) + '信号' : '暂无已结算样本', 'model-event-time'));
    if (Number.isFinite(result?.exit1mNetUsd)) {
      const exit = node('p', '同笔 1 分钟退出 ', 'model-exit');
      exit.append(amount(result.exit1mNetUsd));
      resultGroup.append(exit);
    }
    box.append(signalGroup, resultGroup);
    return box;
  }
  function totals(snapshot) {
    const table = node('table');
    const head = table.createTHead().insertRow();
    for (const label of ['模型', '退出方式', '有效样本', '估算净盈亏']) {
      const th = node('th', label);
      th.scope = 'col';
      head.append(th);
    }
    const body = table.createTBody();
    for (const model of snapshot.models) {
      for (const [key, label] of [['exit1m', '1 分钟退出'], ['settlement', '持有至到期']]) {
        const metric = model[key];
        const row = body.insertRow();
        const th = node('th', model.name);
        th.scope = 'row';
        row.append(th, node('td', label), node('td', metric.samples));
        const cell = row.insertCell();
        cell.append(amount(metric.netUsd));
      }
    }
    byId('strategy-totals').replaceChildren(table, node('p',
      '每次按 ' + snapshot.sharesPerEntry + ' 份估算。表内为各组模拟净盈亏之和，两种退出方式独立统计。'));
    byId('strategy-details').hidden = false;
  }
  async function load() {
    const list = byId('strategy-models');
    list.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch('./strategy-snapshot.json', {cache: 'no-cache', credentials: 'omit'});
      if (!res.ok) throw new Error('snapshot HTTP ' + res.status);
      const data = await res.json();
      if (data.version !== 1 || !Array.isArray(data.models) || data.models.length !== 2) {
        throw new Error('Unsupported snapshot');
      }
      const time = byId('strategy-time');
      time.dateTime = data.asOf || '';
      time.textContent = '截至 ' + stamp(data.asOf) + ' · 本地时间';
      time.title = Number.isFinite(Date.parse(data.asOf)) ? new Date(data.asOf).toLocaleString() : '';
      list.replaceChildren(...data.models.map(card));
      totals(data);
    } catch {
      const retry = node('button', '重试', 'retry-snapshot');
      retry.type = 'button';
      retry.onclick = () => { retry.disabled = true; load(); };
      const message = node('p', '策略快照暂未载入。');
      message.append(retry);
      list.replaceChildren(message);
    } finally {
      list.removeAttribute('aria-busy');
    }
  }
  load();
})();

;
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const saved=key=>{try{return localStorage.getItem('pm-desk:'+key);}catch{return null;}};
  const save=(key,value)=>{try{localStorage.setItem('pm-desk:'+key,value);}catch{}};
  window.createDeskDisplay();
  const agents=[
    {id:'taker',name:'SCOUT',color:'#2679df',action:'查看卖一深度'},
    {id:'spotter',name:'PULSE',color:'#05aa81',action:'读取行情图'},
    {id:'kelly',name:'SONAR',color:'#8050d4',action:'读取前五档挂单量'},
    {id:'edge',name:'PRISM',color:'#df167e',action:'读取已观测区间与盘口价差'},
    {id:'closer',name:'TEMPO',color:'#ef401b',action:'查看实测耗时'},
    {id:'prior',name:'ECHO',color:'#e99317',action:'回放已观测价格路径'}
  ];
  const byId=Object.fromEntries(agents.map(a=>[a.id,a]));
  const reads={taker:'readBook',spotter:'readTape',kelly:'readDepth',edge:'readRange',closer:'readLatency',prior:'replayHistory'};
  const liveRoot=el('live-lower');
  const panels=window.createPMPanels(liveRoot);
  const requestedUnit=new URLSearchParams(location.search).get('unit');
  let chartUnit=['contract','btc'].includes(requestedUnit)?requestedUnit:(saved('chart-unit')==='contract'?'contract':'btc');
  const clock=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const utcClock=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const windowTime=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  const nf=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
  const cents=p=>Number.isFinite(p)?nf.format(p*100)+'¢':'—';
  const compactShares=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
  const size=n=>Number.isFinite(n)?nf.format(n)+' 份':'—';
  const isCurrent=s=>s&&s.startTime<=Date.now()&&s.endTime>Date.now();
  const fresh=o=>o?.bookAvailable&&o.bookSource!=='last-websocket'&&Number.isFinite(o.at)&&o.at<=Date.now()+3000&&o.at>=Date.now()-10000;
  const periodMs=value=>(value==='15m'?15:5)*60000;
  const windowStart=value=>Math.floor(Date.now()/periodMs(value))*periodMs(value);
  let interval=saved('interval')==='15m'?'15m':'5m',side=saved('side')==='down'?'down':'up';
  let snapshot=null, fetching=false, err='',generation=0,timer=null,controller=null, lastPull=0;
  let activeStart=windowStart(interval),expiryTimer=null,previousWindow=null;
  let tour=saved('tour')!=='off',job=null,inspectIndex=0,nextInspection=0,animT=0,lastRAF=0;
  let lastCompletedLiveRole=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const flight=window.createDeskFlight(el('transit'));
  const field=window.createReactor(el('field'),el('art'),agents,id=>inspect(id,true));
  const hud=window.createClassicHUD({agents,field,inspect});
  const tabs=[...document.querySelectorAll('button[data-interval]')],sides=[...document.querySelectorAll('button[data-side]')];
  let spotData=null,feedTrace=null,traceNumber=0;
  let publicPrintAt=0,lastPublicNote=0;
  const durations=new Map();
  let round=null,patrolTrace=null,traceChoice='auto';
  function displayedTrace(){
    if(traceChoice==='feed'&&feedTrace)return feedTrace;
    if(traceChoice==='patrol'&&patrolTrace)return patrolTrace;
    return patrolTrace||feedTrace;
  }
  function clearPatrol(){
    round=null;patrolTrace=null;durations.delete('角色巡检');inspectIndex=0;
  }
  liveRoot.querySelector('[data-pm-panel="latency"] [data-key="badge"]').addEventListener('click',()=>{
    const options=[['patrol',patrolTrace],['feed',feedTrace]].filter(([,trace])=>trace);
    if(options.length<2)return;
    const current=options.findIndex(([,trace])=>trace===displayedTrace());
    traceChoice=options[(current+1)%options.length][0];updatePanels();
  });
  function adviceContext(){
    return {market:snapshot, interval, spot:spotData, blockedReason:err?'合约资料刷新失败，等待最新行情。':''};
  }
  const advice=window.createDeskAdvice({
    host:el('desk-advice'),
    actionLabel:direction=>'到 Polymarket 核对'+(direction==='up'?'买涨':'买跌'),
    getContext:adviceContext,
    onReview(intent){
      const market=snapshot;
      const index=market?.outcomeIndexes?.[intent.side];
      if(!isCurrent(market)||market.conditionId!==intent.conditionId||market.interval!==intent.interval||
          ![0,1].includes(index)||!['up','down'].includes(intent.side))return;
      setSide(intent.side);
      const url=new URL('/event/'+market.slug,'https://polymarket.com');
      url.searchParams.set('outcomeIndex',String(index));
      window.location.assign(url.href);
    }
  });
  const spot=window.createBTCSpot(state=>{
    spotData=state;
    advice.update(adviceContext());
    if(chartUnit==='btc')updatePanels();
  });
  const stream=window.createPMStream(s=>{
    if(!snapshot||s.conditionId!==snapshot.conditionId||!isCurrent(s))return;
    snapshot=s;render();
    const latest=s.marketTrades?.[side]?.at(-1);
    if(!latest||latest.t<=publicPrintAt)return;
    publicPrintAt=latest.t;
    const now=Date.now();
    if(now-latest.t>10000||now-lastPublicNote<3500)return;
    lastPublicNote=now;
    hud.note(null,side.toUpperCase()+' · '+cents(latest.p)+' × '+size(latest.size),
      {at:latest.t,label:'MARKET',command:'market.trade()',summary:'公开成交节选'});
  });
  function updatePanels(){
    const st=statusText()[0],stale=st==='stale'||st==='offline';
    const current=isCurrent(snapshot)?snapshot:null;
    window.GrokMobilePanels.updateBook(current,interval,side,stale);
    panels.update(current,side,job?.id||null,stale,null,displayedTrace(),{unit:chartUnit,spot:spotData});
    const src=chartUnit==='btc'?(spotData?.source||'BTC/USD 现货')+' · 现货参考价':'Polymarket · '+side.toUpperCase()+' 合约';
    const label=src+(chartUnit==='btc'&&spotData?.status!=='live'?' · '+(spotData?.status==='stale'?'上次观测':'等待最新数据'):'')+' ｜ 盘口单位 ¢';
    if(el('chart-source').textContent!==label)el('chart-source').textContent=label;
  }
  function track(run){
    const samples=durations.get(run.source)||[];
    if(!run.errors){samples.push(run.total);if(samples.length>50)samples.shift();}
    durations.set(run.source,samples);
    const sorted=[...samples].sort((a,b)=>a-b);
    const trace={...run,id:++traceNumber,p95:sorted.length?sorted[Math.ceil(.95*sorted.length)-1]:null};
    if(run.source==='角色巡检')patrolTrace=trace;
    else feedTrace=trace;
    updatePanels();
  }
  function setChartUnit(unit,remember=true){
    if(chartUnit!==unit)round=null;
    chartUnit=unit;if(remember)save('chart-unit',unit);
    for(const b of document.querySelectorAll('[data-chart-unit]'))b.setAttribute('aria-pressed',String(b.dataset.chartUnit===unit));
    spot.setVisible(!document.hidden);
    updatePanels();
  }
  for(const b of document.querySelectorAll('[data-chart-unit]'))b.addEventListener('click',()=>setChartUnit(b.dataset.chartUnit));
  const speeds=[1,2,.5];let speedIndex=0;
  el('speed').addEventListener('click',()=>{
    speedIndex=(speedIndex+1)%speeds.length;el('speed').textContent=speeds[speedIndex]+'×';
  });
  function setSide(next){
    if(!['up','down'].includes(next)||next===side)return;
    clearPatrol();side=next;publicPrintAt=snapshot?.marketTrades?.[side]?.at(-1)?.t||0;
    save('side',side);stopJob();render();hud.note(null,'读取 '+side.toUpperCase()+' 盘口');
  }
  function setIntervalChoice(value){
    if(!['5m','15m'].includes(value)||value===interval)return;
    interval=value;save('interval',value);
    previousWindow=null;
    resetWindow(windowStart(interval),'切换至 '+value+' 合约');
  }
  function scheduleExpiry(){
    clearTimeout(expiryTimer);
    expiryTimer=setTimeout(checkWindow,Math.max(1,activeStart+periodMs(interval)-Date.now()));
  }
  function checkWindow(){
    const start=windowStart(interval);
    if(start===activeStart){scheduleExpiry();return false;}
    // Only the immediately preceding window can supply a closing reference.
    // The last WebSocket frame can be received just before expiry, between two UI paints.
    const outgoing=stream.latest();
    previousWindow=outgoing?.interval===interval&&outgoing.endTime===start?outgoing:null;
    resetWindow(start,'本期已结束，等待新一期盘口');
    return true;
  }
  function resetWindow(start,note){
    activeStart=start;generation++;
    controller?.abort();controller=null;fetching=false;clearTimeout(timer);
    stream.stop();snapshot=null;err='';lastPull=0;
    clearPatrol();feedTrace=null;durations.clear();publicPrintAt=0;lastPublicNote=0;
    stopJob();nextInspection=animT+.8;hud.clear();hud.note(null,note);
    render();scheduleExpiry();pull();
  }
  function setTour(){
    const button=el('tour');
    button.querySelector('span').textContent=tour?'暂停巡检':'继续巡检';button.setAttribute('aria-pressed',String(!tour));
    button.title=tour?'暂停角色巡检，行情继续刷新':'继续角色巡检';
    button.setAttribute('aria-label',button.title);
  }
  el('tour').addEventListener('click',()=>{
    tour=!tour;save('tour',tour?'on':'off');
    if(!tour){round=null;stopJob();hud.note(null,'自动巡检已暂停');}else{nextInspection=animT;hud.note(null,'恢复自动巡检');}
    setTour();
  });
  for(const b of tabs)b.addEventListener('click',()=>setIntervalChoice(b.dataset.interval));
  for(const b of sides)b.addEventListener('click',()=>setSide(b.dataset.side));
  el('refresh').addEventListener('click',()=>{if(!fetching){clearTimeout(timer);pull();}});
  function setBanner(message){const n=el('status-note');n.textContent=message;n.hidden=!message;}
  function quoteFor(market,direction){
    const book=market?.outcomes[direction];
    if(!book?.bookAvailable||!Number.isFinite(book.at)||book.at<market.startTime||book.at>=market.endTime)return null;
    return book.bids.length||book.asks.length?book:null;
  }
  function statusText(){
    if(!snapshot)return err?['offline','连接失败']:['loading','正在连接'];
    if(!isCurrent(snapshot))return ['stale','正在换期'];
    const quote=quoteFor(snapshot,side);
    if(!quote)return err?['offline','报价不可用']:['loading','等待本期报价'];
    if(!fresh(quote)||(err&&quote.bookSource!=='websocket'))return ['stale','报价待更新'];
    if(err)return ['live','盘口推送在线'];
    return ['live','行情在线'];
  }
  function windowRange(market){
    return clock.format(market.startTime).slice(0,5)+'–'+clock.format(market.endTime).slice(0,5);
  }
  function renderHeadline(current,status){
    const quote=quoteFor(current,side);
    const prior=quoteFor(previousWindow,side);
    const shown=quote||prior;
    const bid=shown?.bids[0],ask=shown?.asks[0];
    el('mast-side').textContent=side.toUpperCase();
    el('mast-bid').textContent=cents(bid?.[0]);el('mast-ask').textContent=cents(ask?.[0]);
    const qty=bid&&ask?bid[1]+ask[1]:null;
    el('mast-size').textContent=Number.isFinite(qty)?compactShares.format(qty):'—';
    el('mast-size').title=Number.isFinite(qty)?'买一与卖一合计 '+size(qty):'等待双边盘口';
    const origin=el('quote-origin'),previous=el('quote-previous');
    const contract=interval+' '+side.toUpperCase();
    const secondsBeforeClose=prior?Math.ceil((previousWindow.endTime-prior.at)/1000):0;
    const priorLabel=prior?'上期收盘参考 · '+contract+' '+windowRange(previousWindow)+' · 最后观测 '+clock.format(prior.at)
      +(secondsBeforeClose>10?'（收盘前 '+secondsBeforeClose+' 秒）':''):'';
    if(quote){
      origin.dataset.state=status;
      origin.textContent=(status==='live'?'本期实时':'本期上次报价')+' · '+contract+' '+windowRange(current)+' · '+clock.format(quote.at)+' 更新';
    }else{
      origin.dataset.state=prior?'previous':'waiting';
      origin.textContent=prior?priorLabel+' · 等待本期报价':'等待本期报价 · '+contract;
    }
    origin.title=prior&&!quote?'上期收盘前本页最后观测的买一和卖一，单位为每份合约美分。':'合约时段与观测时刻均为本地时间';
    previous.hidden=!(quote&&prior);
    previous.textContent=quote&&prior?priorLabel+' · 买一 '+cents(prior.bids[0]?.[0])+' / 卖一 '+cents(prior.asks[0]?.[0]):'';
  }
  function render(){
    advice.update(adviceContext());
    const [status,label]=statusText();const s=isCurrent(snapshot)?snapshot:null;
    if(status!=='live')round=null;
    el('source-state').dataset.state=status;
    el('swarm-state').textContent={live:'ONLINE',loading:'SYNCING',stale:'STALE',offline:'OFFLINE'}[status];
    el('refresh').title=label+' · 刷新 Polymarket 行情';
    el('refresh').setAttribute('aria-label',el('refresh').title);
    const windowId=el('mast-window');
    windowId.textContent=s?'#'+utcClock.format(s.startTime).slice(0,5).replace(':',''):'—';
    windowId.parentElement.title=s?'窗口号取开盘 UTC 时分 · '+new Date(s.startTime).toISOString().slice(0,10)+' '+utcClock.format(s.startTime).slice(0,5)+'–'+utcClock.format(s.endTime).slice(0,5)+' UTC · '+s.interval:'等待当前合约窗口';
    tabs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.interval===interval)));
    sides.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.side===side)));
    el('refresh').disabled=fetching;
    const official=el('official-market');official.hidden=!s;if(s)official.href=s.url;else official.removeAttribute('href');
    const contractLine=s?'本地 '+windowTime.format(s.startTime)+' – '+clock.format(s.endTime).slice(0,5):'正在查询本期合约';
    el('contract-line').textContent=contractLine;
    for(const k of ['up','down']){
      const o=s?.outcomes[k],ask=o?.asks?.[0],bid=o?.bids?.[0];
      el('quote-'+k).textContent=cents(ask?.[0]);
      const lagging=o?.bookAvailable&&(!isCurrent(s)||!fresh(o));
      el('quote-'+k+'-meta').textContent=o?.bookAvailable?(lagging?'上次盘口 · ':'')+'买一 '+cents(bid?.[0])+' · 卖量 '+(ask?size(ask[1]):'—'):'等待盘口';
    }
    const o=quoteFor(s,side),ask=o?.asks?.[0]?.[0],bid=o?.bids?.[0]?.[0];
    const hasBid=Number.isFinite(bid),hasAsk=Number.isFinite(ask);
    renderHeadline(s,status);
    const spread=hasAsk&&hasBid&&ask>=bid?cents(ask-bid):'—';
    const marketName='BTC '+side.toUpperCase()+' · '+interval.toUpperCase();
    el('contract-name').textContent=marketName;
    el('last-print').textContent=cents(o?.lastTradePrice);
    el('mast-spread').textContent=el('spread').textContent=spread;
    el('cmd-bid').textContent=cents(bid);el('cmd-ask').textContent=cents(ask);el('cmd-tick').textContent=cents(o?.tickSize);
    el('cmd-min').textContent=el('min-size').textContent=size(o?.minSize);
    el('last-book').textContent=o?.at?clock.format(o.at):'—';
    el('selected-outcome').textContent=side.toUpperCase();
    el('field-status').textContent=o?side.toUpperCase()+' / '+(s.acceptingOrders?'接单中':'暂停接单'):'等待本期盘口';
    let message='';
    if(err)message=(o?.bookSource==='websocket'&&fresh(o)?'盘口推送在线，正在重试合约资料。':s?'行情刷新失败，保留上次快照。':'暂时无法取得本期行情。')+' '+err;
    else if(!o&&previousWindow)message='已换期，等待 '+side.toUpperCase()+' 的本期报价。';
    else if(s&&!fresh(s.outcomes[side]))message='所选方向的盘口缺失或已超过 10 秒。等待最新报价。';
    else if(s&&!s.acceptingOrders)message='本期合约当前未开放委托，可以继续查看公开行情。';
    else if(s?.warnings?.length)message='部分数据暂未返回，缺失项目以空值显示。';
    setBanner(message);updateCountdown();
    const stale=status==='offline'||status==='stale';
    const transport=o?.bookAvailable?(o.bookSource?.includes('websocket')?'CLOB WEBSOCKET':'REST 快照'):'等待盘口';
    el('stream-source').textContent=stale?'上次观测 · '+transport:transport;
    updatePanels();
    hud.render(s,side,job,stale);
  }
  function updateCountdown(){
    const now=Date.now(),stamp=utcClock.format(now),timeEl=el('clock');
    if(timeEl.textContent!==stamp){timeEl.textContent=stamp;timeEl.dateTime=new Date(now).toISOString();}
    const end=activeStart+periodMs(interval);
    const sec=Math.max(0,Math.ceil((end-now)/1000));
    el('deadline').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
    el('deadline').title=interval+' 当前窗口到期 '+clock.format(end)+' · 本地时间';
  }
  async function pull(){
    if(fetching)return;
    const gen=generation,which=interval,expectedStart=activeStart;
    const ctl=new AbortController();controller=ctl;fetching=true;render();
    const timeout=setTimeout(()=>ctl.abort(),18000);
    const start=performance.now(),spans=[];let cursor=start,publicTrace=null,publicErrors=0;
    function mark(name){const t=performance.now();spans.push({name,start:cursor-start,duration:t-cursor});cursor=t;}
    function acceptStage(data){
      if(gen!==generation||ctl.signal.aborted||!isCurrent(data)||data.startTime!==expectedStart)return;
      if(data.interval!==which||!data.conditionId||!data.outcomes?.up||!data.outcomes?.down)throw Error('返回的合约不匹配');
      const changed=snapshot?.conditionId!==data.conditionId;
      snapshot=stream.accept(data);
      if(changed){
        clearPatrol();stopJob();nextInspection=animT+.35;hud.clear();
        publicPrintAt=0;lastPublicNote=0;feedTrace=null;durations.clear();
        hud.note(null,'已载入 BTC '+which+' 合约');
      }else if(err)hud.note(null,'行情连接已恢复');
      err='';lastPull=Date.now();render();
    }
    try{
      const data=await window.readPMMarket(which,{signal:ctl.signal,onSnapshot:acceptStage});
      if(gen!==generation||!isCurrent(data)||data.startTime!==expectedStart)return;
      mark('gamma+clob');
      if(data.publicTrace?.spans?.length && Number.isFinite(data.publicTrace.total)){
        publicTrace=data.publicTrace;
        publicErrors=(data.warnings||[]).filter(x=>/unavailable/i.test(x)).length;
      }
      acceptStage(data);mark('book.sync');
    }catch(e){
      if(gen!==generation)return;
      if(!err)hud.note(null,'行情连接中断，等待重试');
      mark('feed.error');
      err=e.name==='AbortError'?'请求超时，可点「刷新行情」重试。':(e.message?.includes('HTTP')?e.message:'请检查网络或点击「刷新行情」重试。');
    }finally{
      clearTimeout(timeout);if(gen===generation){controller=null;fetching=false;render();mark('ui.update');
        track(err||!publicTrace?{source:'行情',spans,total:cursor-start,errors:err?1:0}:
          {source:'行情',spans:publicTrace.spans,total:publicTrace.total,errors:publicErrors});
        const wait=err?7000:document.hidden?13000:4000;
        timer=setTimeout(pull,wait);
      }
    }
  }
  document.addEventListener('visibilitychange',()=>{
    lastRAF=0;if(document.hidden)round=null;
    spot.setVisible(!document.hidden);
    if(!document.hidden&&!checkWindow()&&Date.now()-lastPull>4000&&!fetching){clearTimeout(timer);pull();}
  });
  function inspectResult(id){
    if(statusText()[0]!=='live')return '报价待更新，本次没有新的盘口读数。';
    return panels.reading(id)||'该项公开数据尚未返回。';
  }
  function highlightActor(id){
    el('mast-holder').textContent=byId[id]?.name||'IDLE';
    const st=statusText()[0],stale=st==='stale'||st==='offline';
    updatePanels();
    hud.render(isCurrent(snapshot)?snapshot:null,side,job,stale);
  }
  const inspectionOrder=['spotter','prior','edge','kelly','taker','closer'];
  function inspect(id,manual=true){
    if(!byId[id])return;
    if(statusText()[0]!=='live'){if(manual)hud.note(null,'正在等待当前方向的最新盘口');return;}
    if(job?.id===id && !job.returning)return;
    if(job)stopJob();
    if(manual)inspectIndex=inspectionOrder.indexOf(id)+1;
    const a=byId[id];
    const target=liveRoot.querySelector('[data-target="'+id+'"]');
    const travel=flight.travelTime(field.position(id),target);
    const dispatchedAt=performance.now();
    if(manual)round=null;
    else if(id==='spotter')round={start:dispatchedAt,spans:[]};
    job={id,target,travel,start:animT,didRead:false,dispatchedAt};
    nextInspection=animT+travel*2+flight.hold+.85;
    const previous=lastCompletedLiveRole;
    lastCompletedLiveRole=null;
    if(previous&&previous!==id)hud.note(id,byId[previous].name+' → '+a.name,{command:'desk.handoff()',summary:'巡检交接 · '+a.action});
    else hud.note(id,a.action,{command:id+'.dispatch()',summary:manual?'手动派遣':'巡检派遣'});
    highlightActor(id);
  }
  function stopJob(cancelled=true){
    if(cancelled)lastCompletedLiveRole=null;
    if(!job)return;
    const id=job.id;
    if(cancelled)round=null;
    if(!cancelled)lastCompletedLiveRole=id;
    if(round&&job.didRead&&inspectionOrder[round.spans.length]===id){
      const end=performance.now();
      const tasks={spotter:'tape',prior:'replay',edge:'range',kelly:'depth',taker:'book',closer:'trace'};
      round.spans.push({name:byId[id].name.toLowerCase()+'.'+tasks[id],start:job.dispatchedAt-round.start,duration:end-job.dispatchedAt,readAfter:job.readAt-job.dispatchedAt});
      if(round.spans.length===inspectionOrder.length){
        track({source:'角色巡检',spans:round.spans,total:end-round.start,errors:0});
        round=null;
      }
    }
    hud.note(id,cancelled?'本次巡检已中止':'已返回线环',{command:id+(cancelled?'.cancel()':'.return()'),summary:cancelled?'巡检中止':'巡检结束'});
    flight.clear();job=null;highlightActor(null);
  }
  let lastPanelFrame=-100,lastLayout=-100;
  function animate(now){
    requestAnimationFrame(animate);
    const elapsed=lastRAF?Math.min((now-lastRAF)/1000,.12):0;
    if(tour||job){
      animT+=elapsed*speeds[speedIndex];
    }
    lastRAF=now;
    if(tour&&!job&&animT>=nextInspection&&statusText()[0]==='live'){
      inspect(inspectionOrder[inspectIndex++%6],false);
    }
    if(job){
      const phase=animT-job.start;
      if(!job.didRead&&phase>=job.travel){
        job.didRead=true;job.readAt=performance.now();
        const result=inspectResult(job.id);
        job.result=result.split(/[，。]/u)[0];
        hud.note(job.id,result,{command:job.id+'.'+reads[job.id]+'()',summary:byId[job.id].action});
        highlightActor(job.id);
      }
      if(!job.returning&&phase>=job.travel+flight.hold){job.returning=true;highlightActor(job.id);}
      if(job.didRead&&!job.returning)hud.workProgress(job.id,(phase-job.travel)/flight.hold);
      if(phase>=2*job.travel+flight.hold)stopJob(false);
    }
    // Update the orbit before drawing a flying sprite so its departure and landing share this frame's gate.
    field.draw(reduced.matches?0:animT,job?{id:job.id,away:1}:null);
    if(now-lastPanelFrame>=24){
      lastPanelFrame=now;
      if(now-lastLayout>=80){hud.layout();lastLayout=now;}
      hud.tick(now,animT);
    }
    if(job){
      const a=byId[job.id];
      flight.draw(job,a,field.position(job.id),animT,elapsed,reduced.matches,a.action);
    }
  }
  window.setInterval(()=>{
    if(windowStart(interval)!==activeStart){checkWindow();return;}
    advice.update(adviceContext());
    updateCountdown();
    const st=statusText()[0];
    if(st!==el('source-state').dataset.state)render();
  },500);
  setChartUnit(chartUnit,false);setTour();render();scheduleExpiry();pull();requestAnimationFrame(animate);
})();
