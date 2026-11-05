var _e=Object.defineProperty;var Be=(u,t,o)=>t in u?_e(u,t,{enumerable:!0,configurable:!0,writable:!0,value:o}):u[t]=o;var m=(u,t,o)=>Be(u,typeof t!="symbol"?t+"":t,o);import{dg as he,a as I,cO as Q,dX as re,di as Ie,dq as k,g as L,cF as ee,dp as Ce,z as S,cP as P,U as F,cN as We,A as te,cJ as N,eZ as Ne,e_ as K,e$ as Re,dt as Ue,du as Ge,cm as ae,f0 as de,d as W,e as Ye,bV as He,ar as Je,f1 as ue,f2 as Xe,dS as Ke,cR as qe,cQ as ze,cl as Ve,c2 as q,f3 as Ze,f4 as fe,h as Qe,f5 as et,cn as tt,f6 as pe,f7 as st,f8 as ot,f9 as at,fa as nt,cw as xe,cS as it,c3 as rt,cU as lt,fb as ct,dF as ht,eb as dt,eh as ut,fc as ft,L as pt}from"./index-B-RF8JY7.js";import{g as xt,i as mt,s as me,D as vt,b as g}from"./silk-BPcaVVph.js";import{a as ne,b as wt,f as ve,g as we}from"./layout-BUNgmQT4.js";import{knobText as yt}from"./gestures-ZgPC8JUX.js";import{x as ye,i as le,r as Ae,y as Le,a6 as bt,ad as gt,t as kt,K as z,an as De,ao as Ee,ap as Pe,aq as se,a2 as Mt,q as ie}from"./three.module-BirAeQyw.js";import{s as be}from"./sampler-BPS3sXSH.js";import"./index-Dql7TV1S.js";import"./samplelabel-zOOz2XTh.js";import"./seo-meta-ib4GgaqG.js";import"./scWidget-BWVPd-rx.js";import"./AudioPlayerContext-B4AHP7d4.js";import"./contacts-CXatB-NA.js";import"./goodies-6XHBnDLP.js";import"./emailjs-CojSp4fh.js";import"./mixtapes-5aCV_sRN.js";const $=1024,M=8,D="#F6F1E7",E="rgba(246, 241, 231, 0.45)",R="rgba(246, 241, 231, 0.16)",X=$/S.screen.w,b=ee,O=Math.round(b.text*S.screen.d*X),_=Math.round((b.zoom.u1-b.zoom.u0)*S.screen.w*X),G=Math.round((b.zoom.v1-b.zoom.v0)*S.screen.d*X),B=Math.round((b.wave.u1-b.wave.u0)*S.screen.w*X),Y=Math.round((b.wave.v1-b.wave.v0)*S.screen.d*X),$e=We?1024:640,je=Math.round($e*P.screen.d/P.screen.w),T=200,H=4*(O+M),Oe=H+G+M,J=Oe+je+M,oe=Math.ceil((J+Y+M)/8)*8,ce=4*T+3*M,V={a:{x:0,y:0,w:$,h:O},b:{x:0,y:O+M,w:$,h:O},c:{x:0,y:2*(O+M),w:$,h:O},d:{x:0,y:3*(O+M),w:$,h:O},fx:{x:0,y:Oe,w:$e,h:je}},ge={a:{x:0,y:H,w:_,h:G},b:{x:_+M,y:H,w:_,h:G},c:{x:2*(_+M),y:H,w:_,h:G},d:{x:3*(_+M),y:H,w:_,h:G}},ke={a:{x:0,y:J,w:B,h:Y},b:{x:B+M,y:J,w:B,h:Y},c:{x:2*(B+M),y:J,w:B,h:Y},d:{x:3*(B+M),y:J,w:B,h:Y}},St={x:$-16,y:oe-16,w:8,h:8},Me={a:{x:0,y:0,w:T,h:T},b:{x:T+M,y:0,w:T,h:T},c:{x:2*(T+M),y:0,w:T,h:T},d:{x:3*(T+M),y:0,w:T,h:T}};function Fe(u,t,o=$,s=oe){const a=u.getAttribute("uv"),n=t.x/o,e=(t.x+t.w)/o,h=1-(t.y+t.h)/s,d=1-t.y/s;for(let i=0;i<a.count;i+=1)a.setXY(i,n+a.getX(i)*(e-n),h+a.getY(i)*(d-h));return u}function U(u,t,o,s,a,n){const e=new Le(u,t);return Fe(e,n),e.rotateX(-Math.PI/2),e.translate(o,s,a),e}function Tt(u,t,o,s,a,n){const e=new bt(u,n);return Fe(e,a,ce,T),e.rotateX(-Math.PI/2),e.translate(t,o,s),e}const At=u=>`${u.loaded}|${u.title}|${u.artist}|${u.bpm}|${u.key}|${Math.floor(u.position*4)}|${Math.round(u.duration)}|${u.playing}|${u.pitch.toFixed(6)}|${u.zoom}|${u.wave}|${u.note}|${u.back}`,Lt=u=>{const t=Math.max(0,Math.floor(u));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`};class Dt{constructor(t,o){m(this,"mesh");m(this,"sheen");m(this,"texture");m(this,"jogMesh");m(this,"jogTexture");m(this,"canvas");m(this,"ctx");m(this,"jogCanvas");m(this,"jctx");m(this,"shown",{});m(this,"draws",0);this.canvas=document.createElement("canvas"),this.canvas.width=$,this.canvas.height=oe;const s=this.canvas.getContext("2d");if(!s)throw new Error("dj: no 2d context");this.ctx=s,this.ctx.fillStyle="#000",this.ctx.fillRect(0,0,$,oe),this.texture=he(this.canvas,t),this.jogCanvas=document.createElement("canvas"),this.jogCanvas.width=ce,this.jogCanvas.height=T;const a=this.jogCanvas.getContext("2d");if(!a)throw new Error("dj: no 2d context");this.jctx=a,this.jctx.fillStyle="#000",this.jctx.fillRect(0,0,ce,T),this.jogTexture=he(this.jogCanvas,t);const n=te.h+.003,e=[],h=[],d=[],i=S.screen;for(const p of I){const x=F[p]+i.x-i.w/2,y=i.z-i.d/2;d.push({w:i.w,d:i.d,x:x+i.w/2,y:n,z:i.z}),e.push(U(i.w,i.d,x+i.w/2,te.h+.0015,i.z,St)),e.push(U(i.w,b.text*i.d,x+i.w/2,n,y+b.text*i.d/2,V[p]));const w=(b.zoom.u1-b.zoom.u0)*i.w,v=(b.zoom.v1-b.zoom.v0)*i.d;e.push(U(w,v,x+b.zoom.u0*i.w+w/2,n,y+b.zoom.v0*i.d+v/2,ge[p]));const j=(b.wave.u1-b.wave.u0)*i.w,C=(b.wave.v1-b.wave.v0)*i.d;e.push(U(j,C,x+b.wave.u0*i.w+j/2,n,y+b.wave.v0*i.d+C/2,ke[p])),h.push(Tt(S.jog.center,F[p]+S.jog.x,S.jog.platterH+.004,S.jog.z,Me[p],o?40:64))}Q.includes("mix")&&(e.push(U(P.screen.w,P.screen.d,F.mix+P.screen.x,n,P.screen.z,V.fx)),d.push({w:P.screen.w,d:P.screen.d,x:F.mix+P.screen.x,y:n,z:P.screen.z}));const c=re(e,!1);for(const p of e)p.dispose();if(!c)throw new Error("dj: screens merge failed");const l=new ye({map:this.texture,toneMapped:!1});l.name="djScreens",this.mesh=new le(c,l),this.mesh.name="djScreens";const r=h.length>0?re(h,!1):new Ae;for(const p of h)p.dispose();if(!r)throw new Error("dj: jogs merge failed");const f=new ye({map:this.jogTexture,toneMapped:!1});f.name="djJogs",this.jogMesh=new le(r,f),this.jogMesh.name="djJogs",this.jogMesh.visible=r.getAttribute("position")!==void 0,this.mesh.add(this.jogMesh),this.sheen=Ie(0,0,8e-4,d),this.mesh.add(this.sheen)}invalidate(){this.shown={}}setDeck(t,o){const s=At(o);return this.shown[t]===s?!1:(this.shown[t]=s,this.drawDeck(V[t],ge[t],ke[t],t,o),this.done(),!0)}drawDeck(t,o,s,a,n){const e=this.ctx;e.save(),e.beginPath(),e.rect(t.x,t.y,t.w,t.h),e.clip(),e.fillStyle="#000",e.fillRect(t.x,t.y,t.w,t.h);const h=24,d=t.x+h,i=t.x+t.w-h,c=t.y+t.h*.44,l=t.y+t.h*.86;if(e.textBaseline="alphabetic",!n.loaded)e.textAlign="left",e.fillStyle=D,e.font=`700 54px ${k}`,e.fillText("NO TRACK",d,c),e.fillStyle=L.orange,e.font=`600 34px ${k}`,e.fillText(`TOUCH THE SCREEN TO BROWSE  DECK ${a.toUpperCase()}`,d,l);else{const p=i-360,x=this.drawBack(t,n.back);e.textAlign="left",e.fillStyle=D;const y=p-x-20;for(const C of[52,46,41,37])if(e.font=`700 ${C}px ${k}`,e.measureText(n.title).width<=y)break;e.fillText(this.fit(n.title,y),x,c),e.fillStyle=n.note?L.orange:E,e.font=`${n.note?700:500} 36px ${k}`,e.fillText(this.fit(n.note||n.artist,p-x-20),x,l),e.fillStyle=D,e.font=`600 64px ${k}`;const w=n.bpm?(n.bpm*(1+n.pitch)).toFixed(2):"--.--";this.tab(e,w,i,c,"right"),e.fillStyle=E,e.font=`500 30px ${k}`;const v=n.pitch*100,j=Math.abs(v)<.005?"0.00%":`${v>0?"+":"-"}${Math.abs(v).toFixed(2)}%`;this.tab(e,`${j}   ${n.key||"--"}`,i,l,"right"),e.fillStyle=n.playing?L.yellow:D,e.font=`600 38px ${k}`,this.tab(e,`-${Lt(n.duration-n.position)}`,i-230,l,"right")}e.restore(),e.save(),e.beginPath(),e.rect(o.x,o.y,o.w,o.h),e.clip(),e.fillStyle="#000",e.fillRect(o.x,o.y,o.w,o.h);const r=o.y+o.h/2;e.textAlign="center",e.textBaseline="middle",e.strokeStyle=n.loaded?D:E,e.lineWidth=4,e.lineCap="round";const f=9;e.beginPath(),e.moveTo(o.x+o.w*.17-f,r),e.lineTo(o.x+o.w*.17+f,r),e.moveTo(o.x+o.w*.83-f,r),e.lineTo(o.x+o.w*.83+f,r),e.moveTo(o.x+o.w*.83,r-f),e.lineTo(o.x+o.w*.83,r+f),e.stroke(),e.lineCap="butt",e.fillStyle=E,e.font=`600 24px ${k}`,this.tab(e,`${n.zoom>=10?Math.round(n.zoom):Math.round(n.zoom*10)/10}s`,o.x+o.w*.5,r+1,"center"),e.strokeStyle=R,e.lineWidth=2,e.strokeRect(o.x+1,o.y+1,o.w-2,o.h-2),e.textBaseline="alphabetic",e.restore(),e.save(),e.beginPath(),e.rect(s.x,s.y,s.w,s.h),e.clip(),e.fillStyle="#000",e.fillRect(s.x,s.y,s.w,s.h),e.textAlign="center",e.textBaseline="middle",e.fillStyle=E,e.font=`600 20px ${k}`,e.fillText("WAVE",s.x+s.w/2,s.y+s.h*.3),e.fillStyle=n.loaded?L.orange:E,e.font=`700 ${n.wave.length>4?25:30}px ${k}`,e.fillText(n.wave,s.x+s.w/2,s.y+s.h*.64),e.strokeStyle=R,e.lineWidth=2,e.strokeRect(s.x+1,s.y+1,s.w-2,s.h-2),e.textBaseline="alphabetic",e.restore()}drawBack(t,o){const s=this.ctx,a=t.x+Math.round(ee.back.u1*t.w),n=t.x+14,e=t.y+16,h=a-8-n,d=t.h-32,i=16;s.beginPath(),s.moveTo(n+i,e),s.arcTo(n+h,e,n+h,e+d,i),s.arcTo(n+h,e+d,n,e+d,i),s.arcTo(n,e+d,n,e,i),s.arcTo(n,e,n+h,e,i),s.closePath(),s.fillStyle=o?L.orange:"rgba(246, 241, 231, 0.07)",s.fill(),s.lineWidth=2,s.strokeStyle=o?L.orange:"rgba(246, 241, 231, 0.3)",s.stroke();const c=n+h/2,l=e+d*.38,r=d*.15;return s.lineWidth=8,s.lineCap="round",s.lineJoin="round",s.strokeStyle=o?"#000":L.orange,s.beginPath(),s.moveTo(c+r*.55,l-r),s.lineTo(c-r*.55,l),s.lineTo(c+r*.55,l+r),s.stroke(),s.lineCap="butt",s.lineJoin="miter",s.textAlign="center",s.fillStyle=o?"#000":D,s.font=`700 25px ${k}`,s.fillText("TRACKS",c,e+d*.83),a+14}tab(t,o,s,a,n){const e=t.measureText("0").width,h=l=>l>="0"&&l<="9"?e:t.measureText(l).width;let d=0;for(const l of o)d+=h(l);let i=n==="right"?s-d:n==="center"?s-d/2:s;const c=t.textAlign;t.textAlign="center";for(const l of o){const r=h(l);l!==" "&&t.fillText(l,i+r/2,a),i+=r}return t.textAlign=c,d}fit(t,o){const s=this.ctx;if(s.measureText(t).width<=o)return t;let a=t;for(;a.length>1&&s.measureText(`${a}...`).width>o;)a=a.slice(0,-1);return`${a.trimEnd()}...`}setFx(t){const o=`${t.label}|${t.time}|${t.bpm.toFixed(1)}|${t.warn===!0}`;if(this.shown.fx===o)return!1;this.shown.fx=o;const s=V.fx,a=this.ctx;a.fillStyle="#000",a.fillRect(s.x,s.y,s.w,s.h),a.textBaseline="middle";const n=s.y+s.h/2,e=s.w/640,h=20*e;let d=s.x+s.w-h;return a.textAlign="right",a.fillStyle=E,a.font=`600 ${Math.round(19*e)}px ${k}`,d-=a.measureText("BPM").width,a.fillText("BPM",d+a.measureText("BPM").width,n+1),a.fillStyle=D,a.font=`500 ${Math.round(30*e)}px ${k}`,d-=7*e+this.tab(a,t.bpm.toFixed(1),d-7*e,n,"right"),d-=24*e,a.fillStyle=L.orange,a.font=`600 ${Math.round(30*e)}px ${k}`,d-=this.tab(a,t.time,d,n,"right"),a.fillStyle=E,a.font=`600 ${Math.round(19*e)}px ${k}`,a.textAlign="right",a.fillText("TIME",d-7*e,n+1),d-=7*e+a.measureText("TIME").width,a.textAlign="left",a.fillStyle=t.warn?L.orange:D,a.font=`600 ${Math.round(34*e)}px ${k}`,a.fillText(this.fit(t.label,d-s.x-h-16*e),s.x+h,n),a.textBaseline="alphabetic",this.done(),!0}setJog(t,o,s,a,n,e=null){const h=`jog-${t}`,d=`${a}|${Math.round(o*200)}|${Math.round(s*40)}|${n}|${e===null?"-":Math.round(e*2)}`;if(this.shown[h]===d)return!1;this.shown[h]=d;const i=Me[t],c=this.jctx,l=i.x+i.w/2,r=i.y+i.h/2,f=i.w/2;c.fillStyle="#000",c.fillRect(i.x,i.y,i.w,i.h);const p=f-12;for(let x=0;x<60;x+=1){const y=x/60*Math.PI*2,w=x%15===0,v=p-(w?18:10);c.strokeStyle=w?E:R,c.lineWidth=w?3:1.5,c.beginPath(),c.moveTo(l+Math.sin(y)*v,r-Math.cos(y)*v),c.lineTo(l+Math.sin(y)*(p-3),r-Math.cos(y)*(p-3)),c.stroke()}return c.lineWidth=5,c.strokeStyle=R,c.beginPath(),c.arc(l,r,p+5,0,Math.PI*2),c.stroke(),a&&(c.strokeStyle=L.orange,c.lineCap="round",c.beginPath(),c.arc(l,r,p+5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.002,Math.min(1,o))),c.stroke(),c.strokeStyle=D,c.lineWidth=6,c.beginPath(),c.moveTo(l+Math.sin(s)*(p-6),r-Math.cos(s)*(p-6)),c.lineTo(l+Math.sin(s)*(f*.6),r-Math.cos(s)*(f*.6)),c.stroke(),c.lineCap="butt"),n==="on"&&(c.fillStyle=L.orange,c.beginPath(),c.arc(l,r,f*.44,0,Math.PI*2),c.fill()),c.textAlign="center",c.textBaseline="middle",c.font=`700 30px ${k}`,c.fillStyle=n==="on"?"#000":n==="ready"?D:R,c.fillText("SYNC",l,e===null?r+1:r-10),e!==null&&this.drawPhase(l,r+22,f*.34,e,n==="on"),c.textBaseline="alphabetic",this.draws+=1,this.jogTexture.needsUpdate=!0,!0}drawPhase(t,o,s,a,n){const e=this.jctx,h=n?"#000":D;e.strokeStyle=n?"rgba(0, 0, 0, 0.55)":E,e.lineWidth=4,e.lineCap="round",e.beginPath(),e.moveTo(t-s,o),e.lineTo(t+s,o),e.moveTo(t,o-8),e.lineTo(t,o+8),e.stroke(),e.lineCap="butt";const d=Math.max(-1,Math.min(1,a/12)),i=t+d*s;if(e.fillStyle=h,e.beginPath(),Math.abs(a)>12){const c=Math.sign(a);e.moveTo(i+c*9,o),e.lineTo(i-c*5,o-9),e.lineTo(i-c*5,o+9),e.closePath()}else e.arc(i,o,8,0,Math.PI*2);e.fill()}done(){this.draws+=1,this.texture.needsUpdate=!0}dispose(){Ce(this.sheen),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.texture.dispose(),this.canvas.width=0,this.canvas.height=0,this.jogMesh.geometry.dispose(),this.jogMesh.material.dispose(),this.jogTexture.dispose(),this.jogCanvas.width=0,this.jogCanvas.height=0}}const A=4096,Et=`
attribute float aSlot;
varying vec2 vUv;
varying float vSlot;
void main() {
  vUv = uv;
  vSlot = aSlot;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,Pt=`
uniform sampler2D uPeaks0;
uniform sampler2D uPeaks1;
uniform sampler2D uPeaks2;
uniform sampler2D uPeaks3;
uniform float uOvLen[4];
uniform float uDetLen[4];
uniform float uPos[4];
uniform float uDur[4];
uniform float uWin[4];
uniform float uCue[4];
uniform vec4 uHot[4];
uniform float uLoaded[4];
uniform float uBeat[4];
uniform float uSpb[4];
uniform vec2 uLoop[4];
uniform float uBands[4];
uniform float uMode;
varying vec2 vUv;
varying float vSlot;

const vec3 BONE = vec3(0.965, 0.945, 0.906);
const vec3 BONE_DIM = vec3(0.42, 0.41, 0.39);
const vec3 FAINT = vec3(0.10, 0.10, 0.10);
const vec3 ORANGE = vec3(1.0, 0.416, 0.075);
const vec3 YELLOW = vec3(1.0, 0.843, 0.369);
const vec3 HEAD = vec3(1.0);
const vec3 LOOP = vec3(1.0, 0.416, 0.075);
const vec3 INK = vec3(0.0);
// 3BAND : les basses en bleu, les mediums en ambre (plus jaune que l'orange des cues), les aigus en blanc
const vec3 LOW = vec3(0.13, 0.40, 1.0);
const vec3 MID = vec3(0.93, 0.66, 0.30);
const vec3 HIGH = vec3(0.98, 0.97, 0.94);
// WARM (2026-10-05) : basses orange profond, mediums or (#FFA600), aigus jaune pale ; deja joue : brun
const vec3 LOW_W = vec3(1.0, 0.33, 0.04);
const vec3 MID_W = vec3(1.0, 0.651, 0.0);
const vec3 HIGH_W = vec3(1.0, 0.93, 0.62);
const vec3 PLAYED_W = vec3(0.30, 0.19, 0.10);
// La hauteur de chaque bande a son maximum : les aigus restent fins, au coeur des autres
const vec3 BAND_H = vec3(0.92, 0.72, 0.48);
// La partie deja jouee
const float PLAYED = 0.42;
// Les barres fines (2026-10-04, Mika : "c'est pas beau, peut-etre juste mettre des barres fines") :
// combien par fenetre (la forme d'onde fine) et sur la piste entiere, la part pleine de chaque pas,
// et sous quelle taille (en pas par pixel) on revient a un trait continu
const float BARS = 150.0;
const float BARS_OV = 200.0;
const float BAR_FILL = 0.6;
const float BAR_MIN = 0.55;

vec4 fetchPeak(int deck, ivec2 p) {
  if (deck == 0) return texelFetch(uPeaks0, p, 0);
  if (deck == 1) return texelFetch(uPeaks1, p, 0);
  if (deck == 2) return texelFetch(uPeaks2, p, 0);
  return texelFetch(uPeaks3, p, 0);
}

vec4 peak(int deck, int row0, int i) {
  return fetchPeak(deck, ivec2(i % ${A}, row0 + i / ${A}));
}

vec4 ovPeak(int deck, int i) {
  return fetchPeak(deck, ivec2(i, 0));
}

/** Un trait vertical a x0 (en fraction), large de w pixels. */
float line(float x, float x0, float px, float w) {
  return 1.0 - smoothstep(px * w * 0.5, px * (w * 0.5 + 1.0), abs(x - x0));
}

/** Un repere (cue, tete de lecture) cerne de noir : il se lit sur toutes les couleurs de l'onde. */
vec3 mark(vec3 col, vec3 ink, float x, float x0, float px, float w) {
  col = mix(col, INK, line(x, x0, px, w + 2.5) * 0.85);
  return mix(col, ink, line(x, x0, px, w));
}

/**
 * La colonne de forme d'onde : e (r l'energie, g b a les bandes), y de 0
 * (centre) a 1 (bord) ; cov : la part du pixel couverte par la barre.
 */
vec3 wave(vec3 col, vec4 e, float y, float aa, bool bands, bool played, float cov) {
  bool warm = uMode < 0.5;
  if (!bands || uMode > 2.5) {
    // MONO (et toute vue tant que les bandes se calculent ; WARM en or)
    float on = 1.0 - smoothstep(e.r, e.r + aa, y);
    vec3 m = warm ? (played ? mix(MID_W, PLAYED_W, 0.6) : MID_W) : (played ? BONE_DIM : BONE);
    return mix(col, m, on * cov);
  }
  float dim = played ? PLAYED : 1.0;
  vec3 h = e.gba * BAND_H;
  if (warm) {
    // Le coeur plus lumineux que les bords ; la partie jouee tire vers le brun
    float core = 0.8 + 0.2 * (1.0 - y);
    float p = played ? 0.62 : 0.0;
    col = mix(col, mix(LOW_W, PLAYED_W, p) * core, (1.0 - smoothstep(h.x, h.x + aa, y)) * cov);
    col = mix(col, mix(MID_W, PLAYED_W, p) * core, (1.0 - smoothstep(h.y, h.y + aa, y)) * cov);
    return mix(col, mix(HIGH_W, PLAYED_W, p * 0.8) * core, (1.0 - smoothstep(h.z, h.z + aa, y)) * cov);
  }
  if (uMode < 1.5) {
    col = mix(col, LOW * dim, (1.0 - smoothstep(h.x, h.x + aa, y)) * cov);
    col = mix(col, MID * dim, (1.0 - smoothstep(h.y, h.y + aa, y)) * cov);
    return mix(col, HIGH * dim, (1.0 - smoothstep(h.z, h.z + aa, y)) * cov);
  }
  // RGB : rouge les basses, vert les mediums, bleu les aigus ; plus clair au coeur
  float top = max(h.x, max(h.y, h.z));
  vec3 tint = e.gba / max(max(e.g, max(e.b, e.a)), 0.004);
  vec3 c = mix(tint, vec3(1.0), 0.16) * (0.78 + 0.22 * (1.0 - y / max(top, 0.004)));
  return mix(col, c * dim, (1.0 - smoothstep(top, top + aa, y)) * cov);
}

/** La part d'un pixel (centre f, large w, en pas de barre) que couvre le corps de la barre qui part de b. */
float cover(float f, float w, float b) {
  return clamp((min(f + w * 0.5, b + BAR_FILL) - max(f - w * 0.5, b)) / max(w, 1e-6), 0.0, 1.0);
}

/** La crete d'une barre de la forme d'onde fine : les tranches de [i0, i0 + span). */
vec4 detailBar(int deck, float i0, float span, float len) {
  vec4 a = vec4(0.0);
  float maxFi = uDur[deck] * ${K.toFixed(1)};
  for (int k = 0; k < 16; k++) {
    float fi = i0 + span * (float(k) + 0.5) / 16.0;
    if (fi >= 0.0 && len > 0.0 && fi < maxFi) a = max(a, peak(deck, 1, int(mod(fi, len))));
  }
  return a;
}

/** La crete d'une barre de la piste entiere : les cretes de [i0, i0 + span). */
vec4 overviewBar(int deck, float i0, float span, float n) {
  vec4 a = vec4(0.0);
  for (int k = 0; k < 16; k++) {
    float fi = i0 + span * (float(k) + 0.5) / 16.0;
    if (fi >= 0.0 && fi < n) a = max(a, ovPeak(deck, int(fi)));
  }
  return a;
}

void main() {
  int slot = int(vSlot + 0.5);
  int deck = slot / 2;
  bool whole = slot - deck * 2 == 1;
  vec3 col = vec3(0.0);
  float pxX = fwidth(vUv.x);
  float pxY = fwidth(vUv.y);
  float y = abs(vUv.y - 0.5) * 2.0;
  float loaded = uLoaded[deck];
  float dur = max(uDur[deck], 0.001);
  float pos = uPos[deck];
  bool bands = uBands[deck] > 0.5;
  if (loaded < 0.5) {
    // Une ligne au repos
    col = FAINT * (1.0 - smoothstep(pxY, pxY * 2.0, abs(vUv.y - 0.5)));
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  if (whole) {
    // La piste entiere en BARS_OV barres fines, la partie jouee plus pale
    float n = uOvLen[deck];
    float head = pos / dur;
    // LOOP : la boucle en orange pale sous la piste
    vec2 lp = uLoop[deck];
    if (lp.y > lp.x && vUv.x >= lp.x / dur && vUv.x <= lp.y / dur) col = mix(col, LOOP, 0.35);
    float f = vUv.x * BARS_OV;
    float w = pxX * BARS_OV;
    float span = n / BARS_OV;
    bool played = vUv.x < head;
    if (w > BAR_MIN) {
      // Trop loin pour des barres : la crete sous le pixel
      col = wave(col, overviewBar(deck, (vUv.x - pxX * 0.5) * n, max(1.0, pxX * n), n), y, pxY * 2.0, bands, played, 1.0);
    } else {
      float bi = floor(f);
      float fr = f - bi;
      col = wave(col, overviewBar(deck, bi * span, span, n), y, pxY * 2.0, bands, played, cover(fr, w, 0.0));
      if (fr + w * 0.5 > 1.0) col = wave(col, overviewBar(deck, (bi + 1.0) * span, span, n), y, pxY * 2.0, bands, played, cover(fr, w, 1.0));
    }
    for (int c = 0; c < 4; c++) {
      float t = uHot[deck][c];
      if (t >= 0.0) col = mark(col, ORANGE, vUv.x, t / dur, pxX, 1.5);
    }
    col = mark(col, YELLOW, vUv.x, uCue[deck] / dur, pxX, 1.5);
    col = mark(col, HEAD, vUv.x, head, pxX, 2.0);
  } else {
    // La forme d'onde fine : uWin secondes, la tete au centre
    float win = uWin[deck];
    float t = pos + (vUv.x - 0.5) * win;
    float secPx = pxX * win;
    float len = uDetLen[deck];
    // LOOP : le fond de la boucle en orange sombre, ses bornes en trait orange
    vec2 lp = uLoop[deck];
    if (lp.y > lp.x && t >= lp.x && t < lp.y) col = LOOP * 0.22;
    // BARS barres fines par fenetre, calees sur le temps : elles defilent avec la musique
    float barDur = win / BARS;
    float f = t / barDur;
    float w = secPx / barDur;
    float span = barDur * ${K.toFixed(1)};
    bool played = t < pos;
    if (w > BAR_MIN) {
      col = wave(col, detailBar(deck, (t - secPx * 0.5) * ${K.toFixed(1)}, max(1.0, secPx * ${K.toFixed(1)}), len), y, pxY * 2.0, bands, played, 1.0);
    } else {
      float bi = floor(f);
      float fr = f - bi;
      col = wave(col, detailBar(deck, bi * span, span, len), y, pxY * 2.0, bands, played, cover(fr, w, 0.0));
      if (fr + w * 0.5 > 1.0) col = wave(col, detailBar(deck, (bi + 1.0) * span, span, len), y, pxY * 2.0, bands, played, cover(fr, w, 1.0));
    }
    if (lp.y > lp.x) {
      col = mark(col, LOOP, vUv.x, 0.5 + (lp.x - pos) / win, pxX, 2.0);
      col = mark(col, LOOP, vUv.x, 0.5 + (lp.y - pos) / win, pxX, 2.0);
    }
    // La grille des temps (SYNC) : un tic court en haut et en bas a chaque temps
    float spb = uSpb[deck];
    if (uBeat[deck] >= 0.0 && spb > 0.0) {
      float k = (t - uBeat[deck]) / spb;
      float dist = abs(k - floor(k + 0.5)) * spb / max(secPx, 1e-6);
      float tick = (1.0 - smoothstep(0.5, 1.5, dist)) * step(0.8, y);
      col = mix(col, BONE_DIM, tick * 0.9);
    }
    // Les cues : un trait et un petit drapeau en haut
    float flag = step(0.82, vUv.y);
    for (int c = 0; c < 4; c++) {
      float h = uHot[deck][c];
      if (h < 0.0) continue;
      float x0 = 0.5 + (h - pos) / win;
      col = mark(col, ORANGE, vUv.x, x0, pxX, 1.5);
      col = mix(col, ORANGE, flag * line(vUv.x, x0 + 3.0 * pxX, pxX, 7.0));
    }
    float xc = 0.5 + (uCue[deck] - pos) / win;
    col = mark(col, YELLOW, vUv.x, xc, pxX, 1.5);
    col = mix(col, YELLOW, flag * line(vUv.x, xc + 3.0 * pxX, pxX, 7.0));
    // La tete de lecture, au centre
    col = mark(col, HEAD, vUv.x, 0.5, pxX, 2.0);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;function Se(u,t,o){const s=S.screen,a=(t.u1-t.u0)*s.w,n=(t.v1-t.v0)*s.d,e=new Le(a,n);e.rotateX(-Math.PI/2);const h=F[u]+s.x-s.w/2+(t.u0+t.u1)/2*s.w,d=s.z-s.d/2+(t.v0+t.v1)/2*s.d;e.translate(h,te.h+.0045,d);const i=e.getAttribute("position").count;return e.setAttribute("aSlot",new Mt(new Float32Array(i).fill(o),1)),e}function Z(){const u=new De(new Uint8Array(A*2*4),A,2,Ee,Pe);return u.minFilter=se,u.magFilter=se,u.generateMipmaps=!1,u.needsUpdate=!0,u}class $t{constructor(){m(this,"mesh");m(this,"material");m(this,"tex",{a:Z(),b:Z(),c:Z(),d:Z()});m(this,"shown",{a:"",b:"",c:"",d:""});m(this,"hot",N.map(()=>new gt(-1,-1,-1,-1)));const t=[];for(const s of I){const a=N.indexOf(s);t.push(Se(s,ee.detail,a*2),Se(s,ee.overview,a*2+1))}const o=t.length?re(t,!1):new Ae;for(const s of t)s.dispose();if(!o)throw new Error("dj: waves merge failed");this.material=new kt({vertexShader:Et,fragmentShader:Pt,uniforms:{uPeaks0:{value:this.tex.a},uPeaks1:{value:this.tex.b},uPeaks2:{value:this.tex.c},uPeaks3:{value:this.tex.d},uOvLen:{value:[1,1,1,1]},uDetLen:{value:[0,0,0,0]},uPos:{value:[0,0,0,0]},uDur:{value:[1,1,1,1]},uWin:{value:[8,8,8,8]},uCue:{value:[-1,-1,-1,-1]},uHot:{value:this.hot},uLoaded:{value:[0,0,0,0]},uBeat:{value:[-1,-1,-1,-1]},uSpb:{value:[0,0,0,0]},uLoop:{value:[new z,new z,new z,new z]},uBands:{value:[0,0,0,0]},uMode:{value:0}}}),this.material.name="djWaves",this.mesh=new le(o,this.material),this.mesh.name="djWaves",this.mesh.frustumCulled=!1,this.mesh.visible=t.length>0}setPeaks(t,o,s,a,n){const e=`${o}|${n?1:0}`;if(this.shown[t]===e)return!1;this.shown[t]=e;const h=1+Math.max(1,Math.ceil(a.length/A)),d=new Uint8Array(A*h*4),i=x=>Math.round(Math.min(1,Math.max(0,x))*.92*255),c=x=>Math.round(Math.min(1,Math.max(0,x))*255),l=Math.min(A,s.length);for(let x=0;x<l;x+=1)d[x*4]=i(s[x]);for(let x=0;x<a.length;x+=1)d[(A+x)*4]=i(a[x]);if(n){const x=Math.min(A,Math.floor(n.overview.length/3));for(let w=0;w<x;w+=1)for(let v=0;v<3;v+=1)d[w*4+1+v]=c(n.overview[w*3+v]);const y=Math.min(a.length,Math.floor(n.detail.length/3));for(let w=0;w<y;w+=1)for(let v=0;v<3;v+=1)d[(A+w)*4+1+v]=c(n.detail[w*3+v])}this.tex[t].dispose();const r=new De(d,A,h,Ee,Pe);r.minFilter=se,r.magFilter=se,r.generateMipmaps=!1,r.needsUpdate=!0,this.tex[t]=r;const f=this.material.uniforms,p=N.indexOf(t);return f[`uPeaks${p}`].value=r,f.uOvLen.value[p]=Math.max(1,Math.min(A,s.length)),f.uDetLen.value[p]=a.length,f.uBands.value[p]=n?1:0,!0}setMode(t){const o=this.material.uniforms.uMode,s=Math.max(0,Ne.indexOf(t));return o.value===s?!1:(o.value=s,!0)}update(t,o){const s=this.material.uniforms,a=N.indexOf(t),n=s.uPos.value,e=s.uDur.value,h=s.uWin.value,d=s.uCue.value,i=s.uLoaded.value,c=s.uBeat.value,l=s.uSpb.value,r=s.uLoop.value[a],f=o.loop?o.loop.a:0,p=o.loop?o.loop.b:0;if(r.x!==f||r.y!==p)return r.set(f,p),this.update(t,{...o}),!0;const x=o.beat??-1;if(c[a]!==x||l[a]!==o.spb)return c[a]=x,l[a]=o.spb,this.update(t,o)||!0;const y=this.hot[a],w=[0,1,2,3].map(j=>o.cues[j]??-1),v=[o.loaded?1:0,Math.fround(o.position),Math.max(.001,o.duration),o.window,o.cue];return i[a]===v[0]&&n[a]===v[1]&&e[a]===v[2]&&h[a]===v[3]&&d[a]===v[4]&&y.x===w[0]&&y.y===w[1]&&y.z===w[2]&&y.w===w[3]?!1:(i[a]=v[0],n[a]=v[1],e[a]=v[2],h[a]=v[3],d[a]=v[4],y.set(w[0],w[1],w[2],w[3]),!0)}dispose(){this.mesh.geometry.dispose(),this.material.dispose();for(const t of N)this.tex[t].dispose()}}const jt=u=>u.source==="soundcloud"?`${u.artist} / SOUNDCLOUD ${pt[u.license??""]??""}`.trim():u.artist,Ot=u=>{var o;const t=u.loadStep==="decode"?"DECODING":u.loadStep==="analyse"?"ANALYSING":((o=u.track)==null?void 0:o.source)==="file"?"READING":`LOADING ${Math.round((u.loading??0)*100)}%`;return u.armed?`${t} / PLAY ARMED`:t},Te=3e3;class zt{constructor(t){m(this,"root",new ie);m(this,"socle",new ie);m(this,"top",new ie);m(this,"body");m(this,"controls");m(this,"screens");m(this,"waves");m(this,"silks");m(this,"defs");m(this,"unsubs",[]);m(this,"bassWatched",!1);m(this,"lastFx",null);m(this,"prevMachSync",null);m(this,"lastFxAt",0);m(this,"warnTimer",0);m(this,"prevCh",null);m(this,"prevFxTo",null);m(this,"prevFx",null);m(this,"prevMaster",null);m(this,"held",new Set);m(this,"vu",Array.from({length:de+2},()=>({db:-1/0,hold:-1/0,at:0})));m(this,"vuAt",0);m(this,"screenAt",0);m(this,"step",t=>{var c;if(!this.root.visible)return!1;const o=Qe.get()==="dj"?et():q();if(!o)return!1;let s=!1,a=!1;const n=W.get();this.waves.setMode(n.wave)&&(a=!0);for(const l of I){const r=o.decks[l];r.playing&&(s=!0);const f=r.position(),p=n.deck[l];this.waves.setPeaks(l,r.loadId,r.overview,r.detail,r.bands)&&(a=!0);const x=(c=p.track)!=null&&c.bpm?60/p.track.bpm:0;this.waves.update(l,{loaded:r.loaded&&p.loaded,position:f,duration:r.duration,window:p.zoom,cue:p.cue,cues:p.cues,beat:p.beat,spb:x,loop:r.loop})&&(a=!0);const y=f*2*Math.PI*(100/3/60);this.controls.setJog(l,y)&&(a=!0)}const e=this.vuAt>0?Math.min(.1,(t-this.vuAt)/1e3):0;this.vuAt=t;const h=ut[0]-6,d=[...tt.map(l=>o.mixer.ch[l].level()),...o.mixer.masterLevels()];return[...this.controls.ledMap.vu.map((l,r)=>({col:l,m:this.vu[r]})),...this.controls.ledMap.master.map((l,r)=>({col:l,m:this.vu[de+r]}))].forEach(({col:l,m:r},f)=>{const p=ft(d[f]??0);r.db=Math.max(p,r.db-20*e),r.db<h&&(r.db=-1/0),p>=r.hold?(r.hold=p,r.at=t):t-r.at>1e3&&(r.hold=Math.max(r.db,r.hold-20*e)),r.hold<h&&(r.hold=-1/0),(r.db>-1/0||r.hold>-1/0)&&(s=!0);const x=pe(r.db),y=pe(r.hold)-1;l.forEach((w,v)=>{this.controls.setLed(w,v<x||v===y?1:0)&&(a=!0)})}),(t-this.screenAt>=100||!s)&&(this.screenAt=t,this.syncScreens()&&(a=!0)),s||a?"paint":!1});this.opts=t,this.root.name="djRoot",this.root.position.x=Re,this.socle.name="djSocle",this.top.name="djTop",this.top.position.set(0,Ue,0),this.top.rotation.x=Ge,this.root.add(this.socle,this.top),this.body=new xt(t.mobile),this.socle.add(this.body.mesh),this.controls=new mt({mobile:t.mobile,castShadow:!t.mobile,anisotropy:t.anisotropy}),this.top.add(...this.controls.objects),this.screens=new Dt(t.anisotropy,t.mobile),this.top.add(this.screens.mesh),this.waves=new $t,this.top.add(this.waves.mesh),me(ae()),this.silks=Q.map(s=>new vt(s,t.anisotropy,t.mobile));for(const s of this.silks)this.top.add(s.mesh);const o=I.map(s=>({id:`dj-${s}-screen`,kind:"djscreen",layer:this.top,shape:"box",x:F[s]+S.screen.x,z:S.screen.z,hx:S.screen.w/2,hz:S.screen.d/2,y0:0,y1:te.h+.01,enabled:!0,dj:`dj-${s}-screen`}));this.defs=[...this.controls.hotspots(this.top),...o].map(s=>({...s,machine:"dj"})),this.syncState(!1),this.syncScreens()}get hotspots(){return this.defs}occluders(){const t=[],o=ht.d/2;for(const s of Q){const a=dt(s)/2;t.push({layer:this.top,min:[F[s]-a,-1.12,-o],max:[F[s]+a,0,o],tag:"dj"})}return t}listen(){this.unsubs.push(W.subscribe(()=>this.syncState(!0))),this.unsubs.push(Ye.subscribe(()=>{this.syncLights()&&this.opts.repaint()})),this.unsubs.push(He.subscribe(()=>{const o=this.syncScreens();(this.syncLights()||o)&&this.opts.repaint()})),this.unsubs.push(Je.subscribe(()=>{this.syncLights()&&this.opts.repaint()}));const t=()=>{const o=ue.get();if(!o||this.bassWatched)return;this.bassWatched=!0;let s=o.bassSeq.running;this.unsubs.push(o.bassState.subscribe(()=>{o.bassSeq.running!==s&&(s=o.bassSeq.running,this.syncLights()&&this.opts.repaint())}))};this.unsubs.push(ue.subscribe(t)),t();for(const o of I){const s=be(o),a=()=>{this.syncLights()&&this.opts.repaint()};this.unsubs.push(s.subscribe(a),s.subscribeLive(a),s.seq.subscribe(a))}this.unsubs.push(Xe.subscribe(()=>this.opts.repaint())),this.unsubs.push(Ke(()=>this.redrawText()))}syncState(t){var d;const o=W.get();let s=!1,a=this.prevFx!==null&&this.prevFx!==o.fx||this.prevCh!==null&&this.prevCh!==o.ch||this.prevMaster!==null&&this.prevMaster!==o.master;if(this.prevMaster=o.master,this.prevFx)for(const i of qe)o.fx[i]!==this.prevFx[i]&&(this.lastFx=i);this.prevFx=o.fx,this.prevCh&&this.prevCh!==o.ch&&o.ch.forEach((i,c)=>{var r;const l=(r=this.prevCh)==null?void 0:r[c];if(!(!l||l===i)){for(const f of ze)i[f.id]!==l[f.id]&&(this.lastFx=ne.find(p=>p.target.kind==="eq"&&p.target.ch===c&&p.target.eq===f.id)??this.lastFx);i.fader!==l.fader&&(this.lastFx=ne.find(f=>f.target.kind==="vol"&&f.target.ch===c)??this.lastFx)}}),this.prevCh=o.ch;const n=ae(o);this.prevFxTo!==null&&n!==this.prevFxTo&&(a=!0,this.lastFx="fxto",me(n),(d=this.silks[Q.indexOf("mix")])==null||d.draw()),this.prevFxTo=n,this.prevMachSync!==null&&this.prevMachSync!==o.machSync&&(a=!0,this.lastFx="machsync"),this.prevMachSync=o.machSync,a&&this.touched(),ne.forEach((i,c)=>{const l=i.target,r=l.kind==="eq"?o.ch[l.ch][l.eq]:l.kind==="vol"?o.ch[l.ch].fader:l.kind==="fx"?o.fx[l.fx]:l.kind==="fxto"?Ve(n):o.master;this.controls.setKnob(c,r)&&(s=!0)}),wt.forEach((i,c)=>{const l=i.target,r=l.kind==="channel"?o.ch[l.ch].fader:o.deck[l.deck].pitch;this.controls.setFader(c,r)&&(s=!0)});const e=this.syncScreens(),h=this.syncLights();t&&(s&&this.controls.knobs.castShadow?this.opts.invalidate():(s||e||h||q())&&this.opts.repaint())}touched(){this.lastFxAt=performance.now(),window.clearTimeout(this.warnTimer),this.warnTimer=window.setTimeout(()=>{this.syncScreens()&&this.opts.repaint()},Te+50)}syncLights(){const t=W.get();let o=!1;const s=[g.yellow[0]*.18,g.yellow[1]*.18,g.yellow[2]*.18];ve.forEach((a,n)=>{const e=a.target;let h=this.held.has(a.id);if(e.kind==="smpl"){const d=be(e.deck),i=d.get(),c=e.fn==="open"?h||i.open?g.orange:g.dim:e.fn==="play"?h||d.sounding()?g.yellow:i.sample?s:g.dim:h||i.flash===(e.fn==="recdeck"?"deck":"mix")||e.fn==="recmix"&&i.busy?g.orange:g.dim;this.controls.setKeyGlow(n,c)&&(o=!0);return}e.kind==="loop"?h=h||t.deck[e.deck].loop===e.beats:e.kind==="time"?h=h||t.time===e.d:e.kind==="removedeck"&&(h=h||t.deck[e.deck].remove),this.controls.setKeyGlow(n,h?g.orange:g.dim)&&(o=!0)}),we.forEach((a,n)=>{const e=a.target;if(e.kind==="machines"){this.controls.setKeyGlow(n,Ze()?g.yellow:s,!0)&&(o=!0);return}if(e.kind==="machsync"){const i=t.machSync?fe(t)?1:.42:.04;this.controls.setKeyGlow(n,[g.orange[0]*i,g.orange[1]*i,g.orange[2]*i],!0)&&(o=!0);return}if(e.kind!=="cue"&&e.kind!=="play")return;const h=t.deck[e.deck],d=e.kind==="play"?h.playing?g.yellow:h.armed?g.orange:h.loaded?s:g.off:h.loaded&&!h.playing?g.orange:this.held.has(a.id)?g.orange:g.off;this.controls.setKeyGlow(n,d,!0)&&(o=!0)});for(const a of I)this.controls.setLed(this.controls.ledMap.zero[a],t.deck[a].pitch===0?1:0)&&(o=!0);return o}pressKey(t,o){o?this.held.add(t):this.held.delete(t);let s=!1;const a=ve.findIndex(d=>d.id===t);a>=0&&(s=this.controls.setKeyPress(a,o?1:0));const n=we.findIndex(d=>d.id===t);n>=0&&(s=this.controls.setKeyPress(n,o?1:0,!0)||s);const e=t.endsWith("-back")&&this.syncScreens(),h=this.syncLights()||e;s&&this.controls.keys.castShadow?this.opts.invalidate():(s||h)&&this.opts.repaint()}syncScreens(){var i;const t=W.get(),o=q();let s=!1;for(const c of I){const l=t.deck[c],r=o==null?void 0:o.decks[c],f=l.track,p=r?r.position():0,x=(r==null?void 0:r.duration)??0,y=l.loading!==null;l.playing&&r&&l.loaded&&!r.playing&&W.setDeck(c,{playing:!1});const w={loaded:l.loaded||y||l.error!==null,title:f?f.title:"",artist:l.error?`ERROR: ${l.error}`:y?Ot(l):f?jt(f):"",bpm:(f==null?void 0:f.bpm)??null,key:(f==null?void 0:f.key)??"",position:p,duration:x,playing:l.playing,pitch:l.pitch*l.range/100,zoom:l.zoom,wave:st[t.wave],note:l.remove?"PLAYING: CLOSE AGAIN TO REMOVE THE DECK":"",back:this.held.has(`dj-${c}-back`)};this.screens.setDeck(c,w)&&(s=!0);const v=p*2*Math.PI*(100/3/60),j=!l.loaded||!(f!=null&&f.bpm)?"off":ot(c,t)?"on":at(c,t)===null?"off":"ready",C=l.playing&&l.sync?((i=q())==null?void 0:i.sync.errMs[c])??null:null;this.screens.setJog(c,x>0?p/x:0,v,l.loaded,j,C)&&(s=!0)}const a=this.lastFx,n=ae(t),e=!a||performance.now()-this.lastFxAt>=Te?nt(t):"",h=fe(t),d=e||(a==="machsync"?t.machSync?h?`MACHINES SYNC ${h.deck.toUpperCase()} ${(Math.round(h.bpm*100)/100).toFixed(1)}`:"MACHINES SYNC ON":"MACHINES SYNC OFF":a==="fxto"?`FX TO ${xe(n)}`:typeof a=="object"&&a&&(a.target.kind==="eq"||a.target.kind==="vol")?`${a.target.ch+1} ${a.label} ${yt(a)}`:typeof a=="string"?`${it[a]} ${Math.round(t.fx[a]*100)}%`:n<0?"EFFECTS":`EFFECTS ${xe(n)}`);return this.screens.setFx({label:d,time:lt(t.time),bpm:rt(t),warn:e!==""})&&(s=!0),s}setHover(t){return!1}redrawText(){for(const t of this.silks)t.draw();this.screens.invalidate(),this.syncScreens(),this.opts.repaint()}info(){return{x:this.root.position.x,visible:this.root.visible,width:ct,controls:this.controls.info(),silkDraws:this.silks.map(t=>t.draws),screenDraws:this.screens.draws}}dispose(){window.clearTimeout(this.warnTimer);for(const t of this.unsubs)t();this.unsubs.length=0,this.body.dispose(),this.controls.dispose(),this.screens.dispose(),this.waves.dispose();for(const t of this.silks)t.dispose()}}export{zt as DjRig};
