var tu=Object.defineProperty;var nu=(i,e,t)=>e in i?tu(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var W=(i,e,t)=>nu(i,typeof e!="symbol"?e+"":e,t);import{r as pe,j as O,L as Sa}from"./index-DrkPkHpk.js";import{m as iu,d as su}from"./mixtapes-L2Z2MssK.js";import{i as Yc,A as ru,u as au}from"./AudioPlayerContext-Cxwgd4W_.js";import{a as ou,B as lu,S as cu}from"./contacts-B4B1Alye.js";const hu=su,$c=iu,uu=$c.profileUrl,ya=i=>i.releaseDate||`${i.year}-01-01`,os=[...hu.tracks].sort((i,e)=>ya(i).localeCompare(ya(e))||(i.trackNo??0)-(e.trackNo??0)||i.id.localeCompare(e.id)),cl=864e5,hl=Date.UTC(2012,4,15),du=Date.UTC(2026,1,11),fu=i=>{const e=ya(i).split("-").map(Number),t=Date.UTC(e[0],(e[1]||1)-1,e[2]||1);return Math.max(0,Math.min(1,(t-hl)/cl/((du-hl)/cl)))},pu={originals:"Original",remixes:"Remix",vrstl:"Original"},mu=i=>{const e=i.split(":").map(Number);return e.length===3?e[0]*60+e[1]+e[2]/60:e.length===2?e[0]+e[1]/60:0},gu=i=>({id:`mixtape-${i.number}`,title:i.title,project:`Mixtape ${i.number}`,artist:"Maudite Machine",role:"DJ",year:i.year,category:"originals",link:i.soundcloudUrl,soundcloudUrl:i.soundcloudUrl,featured:i.featured,releaseDate:`${i.year}-01-01`,trackNo:0}),_u=[...$c.mixtapes].sort((i,e)=>i.number-e.number),vu=i=>Yc(i)?i.featured?.42:.28:.22,Ut=[...os.map((i,e)=>({index:e,id:i.id,track:i,kind:"track",t:.1+.8*(.4*fu(i)+.6*(e/Math.max(1,os.length-1))),radius:vu(i),playable:Yc(i),featured:!!i.featured,year:i.year,categoryLabel:pu[i.category]||"Original"})),..._u.map((i,e)=>{const t=gu(i);return{index:os.length+e,id:t.id,track:t,kind:"mixtape",t:.925+.018*e,radius:.24,playable:!0,featured:i.featured,year:i.year,categoryLabel:"Mixtape",mixtape:{number:i.number,duration:i.duration,durationMinutes:mu(i.duration),artwork:i.artwork,title:i.title}}})],xu=os.length,Pt=Ut.length,qt=Object.fromEntries(Ut.map(i=>[i.id,i])),Mu=Object.fromEntries(Ut.map(i=>[i.track.title,i])),Wi=Ut[os.length-1],ul={1:"FEATURED",2:"ORIGINALS",3:"REMIXES",4:"MIXTAPES"},fr={1:"I",2:"II",3:"III",4:"IV"},Ea=[1,2,3,4],$t={1:Ut.filter(i=>i.kind==="track"&&i.featured),2:Ut.filter(i=>i.kind==="track"&&i.track.category!=="remixes"),3:Ut.filter(i=>i.kind==="track"&&i.track.category==="remixes"),4:Ut.filter(i=>i.kind==="mixtape")},Su={1:$t[1].map(i=>i.track),2:$t[2].map(i=>i.track),3:$t[3].map(i=>i.track),4:$t[4].map(i=>i.track)},ls=(i,e)=>$t[e].includes(i);function Ir(i,e){return ls(i,e)?e:i.kind==="mixtape"?4:i.track.category==="remixes"?3:2}function yu(i,e,t){const n=$t[e];if(!i)return t>0?n[0]:n[n.length-1];const s=n.findIndex(r=>r.id===i);if(s<0){const r=qt[i];return(t>0?n.find(o=>o.t>r.t):[...n].reverse().find(o=>o.t<r.t))||(t>0?n[n.length-1]:n[0])}return n[Math.max(0,Math.min(n.length-1,s+t))]}const Eu=[2012,2014,2017,2020,2023,2025],Dr=[...Eu.map(i=>{const e=Ut.find(t=>t.kind==="track"&&t.year>=i)||Ut[0];return{label:String(i),t:e.t,year:i}}),{label:"MIX",t:$t[4][0].t,year:null}];function bu(i){return i.mixtape?`Mixtape ${i.mixtape.number}, ${i.year}, ${i.mixtape.duration}`:`${i.track.project}, ${i.year}, ${i.categoryLabel}`}const dl=i=>{if(!Number.isFinite(i)||i<=0)return"0:00";const e=Math.floor(i/3600),t=Math.floor(i%3600/60),n=Math.floor(i%60);return e>0?`${e}:${t.toString().padStart(2,"0")}:${n.toString().padStart(2,"0")}`:`${t}:${n.toString().padStart(2,"0")}`};pe.createContext(null);const Tu=ru,Au=au;/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const To="186",wu=0,fl=1,Ru=2,ar=1,Cu=2,ss=3,si=0,Ot=1,fn=2,wn=0,cs=1,_s=2,pl=3,ml=4,Pu=5,Li=100,Lu=101,Nu=102,Iu=103,Du=104,Uu=200,Fu=201,Ou=202,Bu=203,Kc=204,Zc=205,ku=206,zu=207,Gu=208,Vu=209,Hu=210,Wu=211,Xu=212,qu=213,Yu=214,ba=0,Ta=1,Aa=2,vs=3,wa=4,Ra=5,Ca=6,Pa=7,Ao=0,$u=1,Ku=2,mn=0,Jc=1,Qc=2,jc=3,wo=4,eh=5,th=6,nh=7,ih=300,ri=301,Oi=302,Ur=303,Fr=304,Tr=306,La=1e3,An=1001,Na=1002,At=1003,Zu=1004,Ns=1005,Lt=1006,Or=1007,ei=1008,Yt=1009,sh=1010,rh=1011,xs=1012,Ro=1013,_n=1014,rn=1015,vn=1016,Co=1017,Po=1018,Ms=1020,ah=35902,oh=35899,lh=1021,ch=1022,an=1023,Cn=1026,ti=1027,Lo=1028,No=1029,ai=1030,Io=1031,Do=1033,or=33776,lr=33777,cr=33778,hr=33779,Ia=35840,Da=35841,Ua=35842,Fa=35843,Oa=36196,Ba=37492,ka=37496,za=37488,Ga=37489,pr=37490,Va=37491,Ha=37808,Wa=37809,Xa=37810,qa=37811,Ya=37812,$a=37813,Ka=37814,Za=37815,Ja=37816,Qa=37817,ja=37818,eo=37819,to=37820,no=37821,io=36492,so=36494,ro=36495,ao=36283,oo=36284,mr=36285,lo=36286,Ju=3200,gr=0,Qu=1,Xn="",Xt="srgb",_r="srgb-linear",vr="linear",ct="srgb",Br=7680,ju=519,ed=512,td=513,nd=514,Uo=515,id=516,sd=517,Fo=518,rd=519,ad=35044,gl="300 es",pn=2e3,Ss=2001;function od(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function xr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function ld(){const i=xr("canvas");return i.style.display="block",i}const _l={};function vl(...i){const e="THREE."+i.shift();console.log(e,...i)}function hh(i){const e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Xe(...i){i=hh(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function rt(...i){i=hh(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Ui(...i){const e=i.join(" ");e in _l||(_l[e]=!0,Xe(...i))}function cd(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const hd={[ba]:Ta,[Aa]:Ca,[wa]:Pa,[vs]:Ra,[Ta]:ba,[Ca]:Aa,[Pa]:wa,[Ra]:vs};class li{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Rt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],kr=Math.PI/180,co=180/Math.PI;function Gi(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Rt[i&255]+Rt[i>>8&255]+Rt[i>>16&255]+Rt[i>>24&255]+"-"+Rt[e&255]+Rt[e>>8&255]+"-"+Rt[e>>16&15|64]+Rt[e>>24&255]+"-"+Rt[t&63|128]+Rt[t>>8&255]+"-"+Rt[t>>16&255]+Rt[t>>24&255]+Rt[n&255]+Rt[n>>8&255]+Rt[n>>16&255]+Rt[n>>24&255]).toLowerCase()}function je(i,e,t){return Math.max(e,Math.min(t,i))}function ud(i,e){return(i%e+e)%e}function zr(i,e,t){return(1-t)*i+t*e}function Xi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function zt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}const $o=class $o{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(je(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(je(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};$o.prototype.isVector2=!0;let ge=$o;class Ln{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let c=n[s+0],l=n[s+1],h=n[s+2],d=n[s+3],u=r[a+0],f=r[a+1],g=r[a+2],S=r[a+3];if(d!==S||c!==u||l!==f||h!==g){let m=c*u+l*f+h*g+d*S;m<0&&(u=-u,f=-f,g=-g,S=-S,m=-m);let p=1-o;if(m<.9995){const E=Math.acos(m),w=Math.sin(E);p=Math.sin(p*E)/w,o=Math.sin(o*E)/w,c=c*p+u*o,l=l*p+f*o,h=h*p+g*o,d=d*p+S*o}else{c=c*p+u*o,l=l*p+f*o,h=h*p+g*o,d=d*p+S*o;const E=1/Math.sqrt(c*c+l*l+h*h+d*d);c*=E,l*=E,h*=E,d*=E}}e[t]=c,e[t+1]=l,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],c=n[s+1],l=n[s+2],h=n[s+3],d=r[a],u=r[a+1],f=r[a+2],g=r[a+3];return e[t]=o*g+h*d+c*f-l*u,e[t+1]=c*g+h*u+l*d-o*f,e[t+2]=l*g+h*f+o*u-c*d,e[t+3]=h*g-o*d-c*u-l*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,c=Math.sin,l=o(n/2),h=o(s/2),d=o(r/2),u=c(n/2),f=c(s/2),g=c(r/2);switch(a){case"XYZ":this._x=u*h*d+l*f*g,this._y=l*f*d-u*h*g,this._z=l*h*g+u*f*d,this._w=l*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+l*f*g,this._y=l*f*d-u*h*g,this._z=l*h*g-u*f*d,this._w=l*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-l*f*g,this._y=l*f*d+u*h*g,this._z=l*h*g+u*f*d,this._w=l*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-l*f*g,this._y=l*f*d+u*h*g,this._z=l*h*g-u*f*d,this._w=l*h*d+u*f*g;break;case"YZX":this._x=u*h*d+l*f*g,this._y=l*f*d+u*h*g,this._z=l*h*g-u*f*d,this._w=l*h*d-u*f*g;break;case"XZY":this._x=u*h*d-l*f*g,this._y=l*f*d-u*h*g,this._z=l*h*g+u*f*d,this._w=l*h*d+u*f*g;break;default:Xe("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],c=t[9],l=t[2],h=t[6],d=t[10],u=n+o+d;if(u>0){const f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-c)*f,this._y=(r-l)*f,this._z=(a-s)*f}else if(n>o&&n>d){const f=2*Math.sqrt(1+n-o-d);this._w=(h-c)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+l)/f}else if(o>d){const f=2*Math.sqrt(1+o-n-d);this._w=(r-l)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(c+h)/f}else{const f=2*Math.sqrt(1+d-n-o);this._w=(a-s)/f,this._x=(r+l)/f,this._y=(c+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(je(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,c=t._y,l=t._z,h=t._w;return this._x=n*h+a*o+s*l-r*c,this._y=s*h+a*c+r*o-n*l,this._z=r*h+a*l+n*c-s*o,this._w=a*h-n*o-s*c-r*l,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let c=1-t;if(o<.9995){const l=Math.acos(o),h=Math.sin(l);c=Math.sin(c*l)/h,t=Math.sin(t*l)/h,this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+a*t,this._onChangeCallback()}else this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}const Ko=class Ko{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(xl.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(xl.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,c=e.w,l=2*(a*s-o*n),h=2*(o*t-r*s),d=2*(r*n-a*t);return this.x=t+c*l+a*d-o*h,this.y=n+c*h+o*l-r*d,this.z=s+c*d+r*h-a*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(je(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,c=t.z;return this.x=s*c-r*o,this.y=r*a-n*c,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Gr.copy(this).projectOnVector(e),this.sub(Gr)}reflect(e){return this.sub(Gr.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(je(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Ko.prototype.isVector3=!0;let L=Ko;const Gr=new L,xl=new Ln,Zo=class Zo{constructor(e,t,n,s,r,a,o,c,l){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,c,l)}set(e,t,n,s,r,a,o,c,l){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=c,h[6]=n,h[7]=a,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],c=n[6],l=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],S=s[0],m=s[3],p=s[6],E=s[1],w=s[4],x=s[7],T=s[2],b=s[5],R=s[8];return r[0]=a*S+o*E+c*T,r[3]=a*m+o*w+c*b,r[6]=a*p+o*x+c*R,r[1]=l*S+h*E+d*T,r[4]=l*m+h*w+d*b,r[7]=l*p+h*x+d*R,r[2]=u*S+f*E+g*T,r[5]=u*m+f*w+g*b,r[8]=u*p+f*x+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8];return t*a*h-t*o*l-n*r*h+n*o*c+s*r*l-s*a*c}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8],d=h*a-o*l,u=o*c-h*r,f=l*r-a*c,g=t*d+n*u+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const S=1/g;return e[0]=d*S,e[1]=(s*l-h*n)*S,e[2]=(o*n-s*a)*S,e[3]=u*S,e[4]=(h*t-s*c)*S,e[5]=(s*r-o*t)*S,e[6]=f*S,e[7]=(n*c-l*t)*S,e[8]=(a*t-n*r)*S,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*a+l*o)+a+e,-s*l,s*c,-s*(-l*a+c*o)+o+t,0,0,1),this}scale(e,t){return Ui("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Vr.makeScale(e,t)),this}rotate(e){return Ui("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Vr.makeRotation(-e)),this}translate(e,t){return Ui("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Vr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Zo.prototype.isMatrix3=!0;let Ye=Zo;const Vr=new Ye,Ml=new Ye().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Sl=new Ye().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function dd(){const i={enabled:!0,workingColorSpace:_r,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ct&&(s.r=Rn(s.r),s.g=Rn(s.g),s.b=Rn(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ct&&(s.r=Fi(s.r),s.g=Fi(s.g),s.b=Fi(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Xn?vr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Ui("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Ui("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[_r]:{primaries:e,whitePoint:n,transfer:vr,toXYZ:Ml,fromXYZ:Sl,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Xt},outputColorSpaceConfig:{drawingBufferColorSpace:Xt}},[Xt]:{primaries:e,whitePoint:n,transfer:ct,toXYZ:Ml,fromXYZ:Sl,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Xt}}}),i}const nt=dd();function Rn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Fi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let di;class fd{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{di===void 0&&(di=xr("canvas")),di.width=e.width,di.height=e.height;const s=di.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=di}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=xr("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Rn(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Rn(t[n]/255)*255):t[n]=Rn(t[n]);return{data:t,width:e.width,height:e.height}}else return Xe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let pd=0;class Oo{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:pd++}),this.uuid=Gi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Hr(s[a].image)):r.push(Hr(s[a]))}else r=Hr(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Hr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?fd.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Xe("Texture: Unable to serialize Texture."),{})}let md=0;const Wr=new L;class Nt extends li{constructor(e=Nt.DEFAULT_IMAGE,t=Nt.DEFAULT_MAPPING,n=An,s=An,r=Lt,a=ei,o=an,c=Yt,l=Nt.DEFAULT_ANISOTROPY,h=Xn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:md++}),this.uuid=Gi(),this.name="",this.source=new Oo(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new ge(0,0),this.repeat=new ge(1,1),this.center=new ge(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ye,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Wr).x}get height(){return this.source.getSize(Wr).y}get depth(){return this.source.getSize(Wr).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Xe(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Xe(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ih)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case La:e.x=e.x-Math.floor(e.x);break;case An:e.x=e.x<0?0:1;break;case Na:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case La:e.y=e.y-Math.floor(e.y);break;case An:e.y=e.y<0?0:1;break;case Na:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Nt.DEFAULT_IMAGE=null;Nt.DEFAULT_MAPPING=ih;Nt.DEFAULT_ANISOTROPY=1;const Jo=class Jo{constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const c=e.elements,l=c[0],h=c[4],d=c[8],u=c[1],f=c[5],g=c[9],S=c[2],m=c[6],p=c[10];if(Math.abs(h-u)<.01&&Math.abs(d-S)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+S)<.1&&Math.abs(g+m)<.1&&Math.abs(l+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const w=(l+1)/2,x=(f+1)/2,T=(p+1)/2,b=(h+u)/4,R=(d+S)/4,v=(g+m)/4;return w>x&&w>T?w<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(w),s=b/n,r=R/n):x>T?x<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(x),n=b/s,r=v/s):T<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(T),n=R/r,s=v/r),this.set(n,s,r,t),this}let E=Math.sqrt((m-g)*(m-g)+(d-S)*(d-S)+(u-h)*(u-h));return Math.abs(E)<.001&&(E=1),this.x=(m-g)/E,this.y=(d-S)/E,this.z=(u-h)/E,this.w=Math.acos((l+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this.w=je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this.w=je(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(je(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Jo.prototype.isVector4=!0;let gt=Jo;class gd extends li{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Lt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new gt(0,0,e,t),this.scissorTest=!1,this.viewport=new gt(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:n.depth},r=new Nt(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Lt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Oo(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){const t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class on extends gd{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class uh extends Nt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=At,this.minFilter=At,this.wrapR=An,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class _d extends Nt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=At,this.minFilter=At,this.wrapR=An,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}const yr=class yr{constructor(e,t,n,s,r,a,o,c,l,h,d,u,f,g,S,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,c,l,h,d,u,f,g,S,m)}set(e,t,n,s,r,a,o,c,l,h,d,u,f,g,S,m){const p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=s,p[1]=r,p[5]=a,p[9]=o,p[13]=c,p[2]=l,p[6]=h,p[10]=d,p[14]=u,p[3]=f,p[7]=g,p[11]=S,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new yr().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,n=e.elements,s=1/fi.setFromMatrixColumn(e,0).length(),r=1/fi.setFromMatrixColumn(e,1).length(),a=1/fi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),c=Math.cos(s),l=Math.sin(s),h=Math.cos(r),d=Math.sin(r);if(e.order==="XYZ"){const u=a*h,f=a*d,g=o*h,S=o*d;t[0]=c*h,t[4]=-c*d,t[8]=l,t[1]=f+g*l,t[5]=u-S*l,t[9]=-o*c,t[2]=S-u*l,t[6]=g+f*l,t[10]=a*c}else if(e.order==="YXZ"){const u=c*h,f=c*d,g=l*h,S=l*d;t[0]=u+S*o,t[4]=g*o-f,t[8]=a*l,t[1]=a*d,t[5]=a*h,t[9]=-o,t[2]=f*o-g,t[6]=S+u*o,t[10]=a*c}else if(e.order==="ZXY"){const u=c*h,f=c*d,g=l*h,S=l*d;t[0]=u-S*o,t[4]=-a*d,t[8]=g+f*o,t[1]=f+g*o,t[5]=a*h,t[9]=S-u*o,t[2]=-a*l,t[6]=o,t[10]=a*c}else if(e.order==="ZYX"){const u=a*h,f=a*d,g=o*h,S=o*d;t[0]=c*h,t[4]=g*l-f,t[8]=u*l+S,t[1]=c*d,t[5]=S*l+u,t[9]=f*l-g,t[2]=-l,t[6]=o*c,t[10]=a*c}else if(e.order==="YZX"){const u=a*c,f=a*l,g=o*c,S=o*l;t[0]=c*h,t[4]=S-u*d,t[8]=g*d+f,t[1]=d,t[5]=a*h,t[9]=-o*h,t[2]=-l*h,t[6]=f*d+g,t[10]=u-S*d}else if(e.order==="XZY"){const u=a*c,f=a*l,g=o*c,S=o*l;t[0]=c*h,t[4]=-d,t[8]=l*h,t[1]=u*d+S,t[5]=a*h,t[9]=f*d-g,t[2]=g*d-f,t[6]=o*h,t[10]=S*d+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(vd,e,xd)}lookAt(e,t,n){const s=this.elements;return Ht.subVectors(e,t),Ht.lengthSq()===0&&(Ht.z=1),Ht.normalize(),Un.crossVectors(n,Ht),Un.lengthSq()===0&&(Math.abs(n.z)===1?Ht.x+=1e-4:Ht.z+=1e-4,Ht.normalize(),Un.crossVectors(n,Ht)),Un.normalize(),Is.crossVectors(Ht,Un),s[0]=Un.x,s[4]=Is.x,s[8]=Ht.x,s[1]=Un.y,s[5]=Is.y,s[9]=Ht.y,s[2]=Un.z,s[6]=Is.z,s[10]=Ht.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],c=n[8],l=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],S=n[6],m=n[10],p=n[14],E=n[3],w=n[7],x=n[11],T=n[15],b=s[0],R=s[4],v=s[8],y=s[12],N=s[1],C=s[5],F=s[9],z=s[13],D=s[2],B=s[6],Y=s[10],X=s[14],re=s[3],$=s[7],te=s[11],ie=s[15];return r[0]=a*b+o*N+c*D+l*re,r[4]=a*R+o*C+c*B+l*$,r[8]=a*v+o*F+c*Y+l*te,r[12]=a*y+o*z+c*X+l*ie,r[1]=h*b+d*N+u*D+f*re,r[5]=h*R+d*C+u*B+f*$,r[9]=h*v+d*F+u*Y+f*te,r[13]=h*y+d*z+u*X+f*ie,r[2]=g*b+S*N+m*D+p*re,r[6]=g*R+S*C+m*B+p*$,r[10]=g*v+S*F+m*Y+p*te,r[14]=g*y+S*z+m*X+p*ie,r[3]=E*b+w*N+x*D+T*re,r[7]=E*R+w*C+x*B+T*$,r[11]=E*v+w*F+x*Y+T*te,r[15]=E*y+w*z+x*X+T*ie,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],c=e[9],l=e[13],h=e[2],d=e[6],u=e[10],f=e[14],g=e[3],S=e[7],m=e[11],p=e[15],E=c*f-l*u,w=o*f-l*d,x=o*u-c*d,T=a*f-l*h,b=a*u-c*h,R=a*d-o*h;return t*(S*E-m*w+p*x)-n*(g*E-m*T+p*b)+s*(g*w-S*T+p*R)-r*(g*x-S*b+m*R)}determinantAffine(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],a=e[5],o=e[9],c=e[2],l=e[6],h=e[10];return t*(a*h-o*l)-n*(r*h-o*c)+s*(r*l-a*c)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8],d=e[9],u=e[10],f=e[11],g=e[12],S=e[13],m=e[14],p=e[15],E=t*o-n*a,w=t*c-s*a,x=t*l-r*a,T=n*c-s*o,b=n*l-r*o,R=s*l-r*c,v=h*S-d*g,y=h*m-u*g,N=h*p-f*g,C=d*m-u*S,F=d*p-f*S,z=u*p-f*m,D=E*z-w*F+x*C+T*N-b*y+R*v;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const B=1/D;return e[0]=(o*z-c*F+l*C)*B,e[1]=(s*F-n*z-r*C)*B,e[2]=(S*R-m*b+p*T)*B,e[3]=(u*b-d*R-f*T)*B,e[4]=(c*N-a*z-l*y)*B,e[5]=(t*z-s*N+r*y)*B,e[6]=(m*x-g*R-p*w)*B,e[7]=(h*R-u*x+f*w)*B,e[8]=(a*F-o*N+l*v)*B,e[9]=(n*N-t*F-r*v)*B,e[10]=(g*b-S*x+p*E)*B,e[11]=(d*x-h*b-f*E)*B,e[12]=(o*y-a*C-c*v)*B,e[13]=(t*C-n*y+s*v)*B,e[14]=(S*w-g*T-m*E)*B,e[15]=(h*T-d*w+u*E)*B,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,c=e.z,l=r*a,h=r*o;return this.set(l*a+n,l*o-s*c,l*c+s*o,0,l*o+s*c,h*o+n,h*c-s*a,0,l*c-s*o,h*c+s*a,r*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,c=t._w,l=r+r,h=a+a,d=o+o,u=r*l,f=r*h,g=r*d,S=a*h,m=a*d,p=o*d,E=c*l,w=c*h,x=c*d,T=n.x,b=n.y,R=n.z;return s[0]=(1-(S+p))*T,s[1]=(f+x)*T,s[2]=(g-w)*T,s[3]=0,s[4]=(f-x)*b,s[5]=(1-(u+p))*b,s[6]=(m+E)*b,s[7]=0,s[8]=(g+w)*R,s[9]=(m-E)*R,s[10]=(1-(u+S))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let a=fi.set(s[0],s[1],s[2]).length();const o=fi.set(s[4],s[5],s[6]).length(),c=fi.set(s[8],s[9],s[10]).length();r<0&&(a=-a),jt.copy(this);const l=1/a,h=1/o,d=1/c;return jt.elements[0]*=l,jt.elements[1]*=l,jt.elements[2]*=l,jt.elements[4]*=h,jt.elements[5]*=h,jt.elements[6]*=h,jt.elements[8]*=d,jt.elements[9]*=d,jt.elements[10]*=d,t.setFromRotationMatrix(jt),n.x=a,n.y=o,n.z=c,this}makePerspective(e,t,n,s,r,a,o=pn,c=!1){const l=this.elements,h=2*r/(t-e),d=2*r/(n-s),u=(t+e)/(t-e),f=(n+s)/(n-s);let g,S;if(c)g=r/(a-r),S=a*r/(a-r);else if(o===pn)g=-(a+r)/(a-r),S=-2*a*r/(a-r);else if(o===Ss)g=-a/(a-r),S=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=d,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=g,l[14]=S,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=pn,c=!1){const l=this.elements,h=2/(t-e),d=2/(n-s),u=-(t+e)/(t-e),f=-(n+s)/(n-s);let g,S;if(c)g=1/(a-r),S=a/(a-r);else if(o===pn)g=-2/(a-r),S=-(a+r)/(a-r);else if(o===Ss)g=-1/(a-r),S=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=0,l[12]=u,l[1]=0,l[5]=d,l[9]=0,l[13]=f,l[2]=0,l[6]=0,l[10]=g,l[14]=S,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};yr.prototype.isMatrix4=!0;let ht=yr;const fi=new L,jt=new ht,vd=new L(0,0,0),xd=new L(1,1,1),Un=new L,Is=new L,Ht=new L,yl=new ht,El=new Ln;class Pn{constructor(e=0,t=0,n=0,s=Pn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],c=s[1],l=s[5],h=s[9],d=s[2],u=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,l),this._z=0);break;case"YXZ":this._x=Math.asin(-je(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(je(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-je(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-a,l));break;case"YZX":this._z=Math.asin(je(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Xe("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return yl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(yl,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return El.setFromEuler(this),this.setFromQuaternion(El,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Pn.DEFAULT_ORDER="XYZ";class dh{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Md=0;const bl=new L,pi=new Ln,Mn=new ht,Ds=new L,qi=new L,Sd=new L,yd=new Ln,Tl=new L(1,0,0),Al=new L(0,1,0),wl=new L(0,0,1),Rl={type:"added"},Ed={type:"removed"},mi={type:"childadded",child:null},Xr={type:"childremoved",child:null};class Bt extends li{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Md++}),this.uuid=Gi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Bt.DEFAULT_UP.clone();const e=new L,t=new Pn,n=new Ln,s=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ht},normalMatrix:{value:new Ye}}),this.matrix=new ht,this.matrixWorld=new ht,this.matrixAutoUpdate=Bt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new dh,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return pi.setFromAxisAngle(e,t),this.quaternion.multiply(pi),this}rotateOnWorldAxis(e,t){return pi.setFromAxisAngle(e,t),this.quaternion.premultiply(pi),this}rotateX(e){return this.rotateOnAxis(Tl,e)}rotateY(e){return this.rotateOnAxis(Al,e)}rotateZ(e){return this.rotateOnAxis(wl,e)}translateOnAxis(e,t){return bl.copy(e).applyQuaternion(this.quaternion),this.position.add(bl.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Tl,e)}translateY(e){return this.translateOnAxis(Al,e)}translateZ(e){return this.translateOnAxis(wl,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Mn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Ds.copy(e):Ds.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),qi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Mn.lookAt(qi,Ds,this.up):Mn.lookAt(Ds,qi,this.up),this.quaternion.setFromRotationMatrix(Mn),s&&(Mn.extractRotation(s.matrixWorld),pi.setFromRotationMatrix(Mn),this.quaternion.premultiply(pi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(rt("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Rl),mi.child=e,this.dispatchEvent(mi),mi.child=null):rt("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Ed),Xr.child=e,this.dispatchEvent(Xr),Xr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Mn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Mn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Mn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Rl),mi.child=e,this.dispatchEvent(mi),mi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qi,e,Sd),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qi,yd,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){const r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){const d=c[l];r(e.shapes,d)}else r(e.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(r(e.materials,this.material[c]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const c=this.animations[o];s.animations.push(r(e.animations,c))}}if(t){const o=a(e.geometries),c=a(e.materials),l=a(e.textures),h=a(e.images),d=a(e.shapes),u=a(e.skeletons),f=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){const c=[];for(const l in o){const h=o[l];delete h.metadata,c.push(h)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Bt.DEFAULT_UP=new L(0,1,0);Bt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Bt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class ni extends Bt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const bd={type:"move"};class qr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ni,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ni,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ni,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){a=!0;for(const S of e.hand.values()){const m=t.getJointPose(S,n),p=this._getHandJoint(l,S);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=l.joints["index-finger-tip"],d=l.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;l.inputState.pinching&&u>f+g?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&u<=f-g&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(bd)))}return o!==null&&(o.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new ni;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const fh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Fn={h:0,s:0,l:0},Us={h:0,s:0,l:0};function Yr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class We{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Xt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,nt.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=nt.workingColorSpace){return this.r=e,this.g=t,this.b=n,nt.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=nt.workingColorSpace){if(e=ud(e,1),t=je(t,0,1),n=je(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Yr(a,r,e+1/3),this.g=Yr(a,r,e),this.b=Yr(a,r,e-1/3)}return nt.colorSpaceToWorking(this,s),this}setStyle(e,t=Xt){function n(r){r!==void 0&&parseFloat(r)<1&&Xe("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Xe("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Xe("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Xt){const n=fh[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Xe("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Rn(e.r),this.g=Rn(e.g),this.b=Rn(e.b),this}copyLinearToSRGB(e){return this.r=Fi(e.r),this.g=Fi(e.g),this.b=Fi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Xt){return nt.workingToColorSpace(Ct.copy(this),e),Math.round(je(Ct.r*255,0,255))*65536+Math.round(je(Ct.g*255,0,255))*256+Math.round(je(Ct.b*255,0,255))}getHexString(e=Xt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=nt.workingColorSpace){nt.workingToColorSpace(Ct.copy(this),t);const n=Ct.r,s=Ct.g,r=Ct.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let c,l;const h=(o+a)/2;if(o===a)c=0,l=0;else{const d=a-o;switch(l=h<=.5?d/(a+o):d/(2-a-o),a){case n:c=(s-r)/d+(s<r?6:0);break;case s:c=(r-n)/d+2;break;case r:c=(n-s)/d+4;break}c/=6}return e.h=c,e.s=l,e.l=h,e}getRGB(e,t=nt.workingColorSpace){return nt.workingToColorSpace(Ct.copy(this),t),e.r=Ct.r,e.g=Ct.g,e.b=Ct.b,e}getStyle(e=Xt){nt.workingToColorSpace(Ct.copy(this),e);const t=Ct.r,n=Ct.g,s=Ct.b;return e!==Xt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(Fn),this.setHSL(Fn.h+e,Fn.s+t,Fn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Fn),e.getHSL(Us);const n=zr(Fn.h,Us.h,t),s=zr(Fn.s,Us.s,t),r=zr(Fn.l,Us.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ct=new We;We.NAMES=fh;class ph extends Bt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pn,this.environmentIntensity=1,this.environmentRotation=new Pn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}const en=new L,Sn=new L,$r=new L,yn=new L,gi=new L,_i=new L,Cl=new L,Kr=new L,Zr=new L,Jr=new L,Qr=new gt,jr=new gt,ea=new gt;class nn{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),en.subVectors(e,t),s.cross(en);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){en.subVectors(s,t),Sn.subVectors(n,t),$r.subVectors(e,t);const a=en.dot(en),o=en.dot(Sn),c=en.dot($r),l=Sn.dot(Sn),h=Sn.dot($r),d=a*l-o*o;if(d===0)return r.set(0,0,0),null;const u=1/d,f=(l*c-o*h)*u,g=(a*h-o*c)*u;return r.set(1-f-g,g,f)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,yn)===null?!1:yn.x>=0&&yn.y>=0&&yn.x+yn.y<=1}static getInterpolation(e,t,n,s,r,a,o,c){return this.getBarycoord(e,t,n,s,yn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,yn.x),c.addScaledVector(a,yn.y),c.addScaledVector(o,yn.z),c)}static getInterpolatedAttribute(e,t,n,s,r,a){return Qr.setScalar(0),jr.setScalar(0),ea.setScalar(0),Qr.fromBufferAttribute(e,t),jr.fromBufferAttribute(e,n),ea.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Qr,r.x),a.addScaledVector(jr,r.y),a.addScaledVector(ea,r.z),a}static isFrontFacing(e,t,n,s){return en.subVectors(n,t),Sn.subVectors(e,t),en.cross(Sn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return en.subVectors(this.c,this.b),Sn.subVectors(this.a,this.b),en.cross(Sn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return nn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return nn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return nn.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return nn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return nn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;gi.subVectors(s,n),_i.subVectors(r,n),Kr.subVectors(e,n);const c=gi.dot(Kr),l=_i.dot(Kr);if(c<=0&&l<=0)return t.copy(n);Zr.subVectors(e,s);const h=gi.dot(Zr),d=_i.dot(Zr);if(h>=0&&d<=h)return t.copy(s);const u=c*d-h*l;if(u<=0&&c>=0&&h<=0)return a=c/(c-h),t.copy(n).addScaledVector(gi,a);Jr.subVectors(e,r);const f=gi.dot(Jr),g=_i.dot(Jr);if(g>=0&&f<=g)return t.copy(r);const S=f*l-c*g;if(S<=0&&l>=0&&g<=0)return o=l/(l-g),t.copy(n).addScaledVector(_i,o);const m=h*g-f*d;if(m<=0&&d-h>=0&&f-g>=0)return Cl.subVectors(r,s),o=(d-h)/(d-h+(f-g)),t.copy(s).addScaledVector(Cl,o);const p=1/(m+S+u);return a=S*p,o=u*p,t.copy(n).addScaledVector(gi,a).addScaledVector(_i,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class ci{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(tn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(tn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=tn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,tn):tn.fromBufferAttribute(r,a),tn.applyMatrix4(e.matrixWorld),this.expandByPoint(tn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Fs.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Fs.copy(n.boundingBox)),Fs.applyMatrix4(e.matrixWorld),this.union(Fs)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,tn),tn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Yi),Os.subVectors(this.max,Yi),vi.subVectors(e.a,Yi),xi.subVectors(e.b,Yi),Mi.subVectors(e.c,Yi),On.subVectors(xi,vi),Bn.subVectors(Mi,xi),$n.subVectors(vi,Mi);let t=[0,-On.z,On.y,0,-Bn.z,Bn.y,0,-$n.z,$n.y,On.z,0,-On.x,Bn.z,0,-Bn.x,$n.z,0,-$n.x,-On.y,On.x,0,-Bn.y,Bn.x,0,-$n.y,$n.x,0];return!ta(t,vi,xi,Mi,Os)||(t=[1,0,0,0,1,0,0,0,1],!ta(t,vi,xi,Mi,Os))?!1:(Bs.crossVectors(On,Bn),t=[Bs.x,Bs.y,Bs.z],ta(t,vi,xi,Mi,Os))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,tn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(tn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(En[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),En[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),En[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),En[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),En[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),En[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),En[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),En[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(En),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const En=[new L,new L,new L,new L,new L,new L,new L,new L],tn=new L,Fs=new ci,vi=new L,xi=new L,Mi=new L,On=new L,Bn=new L,$n=new L,Yi=new L,Os=new L,Bs=new L,Kn=new L;function ta(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Kn.fromArray(i,r);const o=s.x*Math.abs(Kn.x)+s.y*Math.abs(Kn.y)+s.z*Math.abs(Kn.z),c=e.dot(Kn),l=t.dot(Kn),h=n.dot(Kn);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}const St=new L,ks=new ge;let Td=0;class Ft extends li{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Td++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=ad,this.updateRanges=[],this.gpuType=rn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ks.fromBufferAttribute(this,t),ks.applyMatrix3(e),this.setXY(t,ks.x,ks.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix3(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix4(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyNormalMatrix(e),this.setXYZ(t,St.x,St.y,St.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.transformDirection(e),this.setXYZ(t,St.x,St.y,St.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Xi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=zt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Xi(t,this.array)),t}setX(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Xi(t,this.array)),t}setY(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Xi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Xi(t,this.array)),t}setW(e,t){return this.normalized&&(t=zt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array),s=zt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=zt(t,this.array),n=zt(n,this.array),s=zt(s,this.array),r=zt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class mh extends Ft{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class gh extends Ft{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class yt extends Ft{constructor(e,t,n){super(new Float32Array(e),t,n)}}const Ad=new ci,$i=new L,na=new L;class Rs{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Ad.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;$i.subVectors(e,this.center);const t=$i.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector($i,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(na.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint($i.copy(e.center).add(na)),this.expandByPoint($i.copy(e.center).sub(na))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let wd=0;const Jt=new ht,ia=new Bt,Si=new L,Wt=new ci,Ki=new ci,Tt=new L;class kt extends li{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:wd++}),this.uuid=Gi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(od(e)?gh:mh)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ye().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Jt.makeRotationFromQuaternion(e),this.applyMatrix4(Jt),this}rotateX(e){return Jt.makeRotationX(e),this.applyMatrix4(Jt),this}rotateY(e){return Jt.makeRotationY(e),this.applyMatrix4(Jt),this}rotateZ(e){return Jt.makeRotationZ(e),this.applyMatrix4(Jt),this}translate(e,t,n){return Jt.makeTranslation(e,t,n),this.applyMatrix4(Jt),this}scale(e,t,n){return Jt.makeScale(e,t,n),this.applyMatrix4(Jt),this}lookAt(e){return ia.lookAt(e),ia.updateMatrix(),this.applyMatrix4(ia.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Si).negate(),this.translate(Si.x,Si.y,Si.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new yt(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Xe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ci);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){rt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];Wt.setFromBufferAttribute(r),this.morphTargetsRelative?(Tt.addVectors(this.boundingBox.min,Wt.min),this.boundingBox.expandByPoint(Tt),Tt.addVectors(this.boundingBox.max,Wt.max),this.boundingBox.expandByPoint(Tt)):(this.boundingBox.expandByPoint(Wt.min),this.boundingBox.expandByPoint(Wt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&rt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Rs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){rt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){const n=this.boundingSphere.center;if(Wt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Ki.setFromBufferAttribute(o),this.morphTargetsRelative?(Tt.addVectors(Wt.min,Ki.min),Wt.expandByPoint(Tt),Tt.addVectors(Wt.max,Ki.max),Wt.expandByPoint(Tt)):(Wt.expandByPoint(Ki.min),Wt.expandByPoint(Ki.max))}Wt.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)Tt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(Tt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)Tt.fromBufferAttribute(o,l),c&&(Si.fromBufferAttribute(e,l),Tt.add(Si)),s=Math.max(s,n.distanceToSquared(Tt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&rt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){rt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;let a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Ft(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));const o=[],c=[];for(let v=0;v<n.count;v++)o[v]=new L,c[v]=new L;const l=new L,h=new L,d=new L,u=new ge,f=new ge,g=new ge,S=new L,m=new L;function p(v,y,N){l.fromBufferAttribute(n,v),h.fromBufferAttribute(n,y),d.fromBufferAttribute(n,N),u.fromBufferAttribute(r,v),f.fromBufferAttribute(r,y),g.fromBufferAttribute(r,N),h.sub(l),d.sub(l),f.sub(u),g.sub(u);const C=1/(f.x*g.y-g.x*f.y);isFinite(C)&&(S.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(C),m.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(C),o[v].add(S),o[y].add(S),o[N].add(S),c[v].add(m),c[y].add(m),c[N].add(m))}let E=this.groups;E.length===0&&(E=[{start:0,count:e.count}]);for(let v=0,y=E.length;v<y;++v){const N=E[v],C=N.start,F=N.count;for(let z=C,D=C+F;z<D;z+=3)p(e.getX(z+0),e.getX(z+1),e.getX(z+2))}const w=new L,x=new L,T=new L,b=new L;function R(v){T.fromBufferAttribute(s,v),b.copy(T);const y=o[v];w.copy(y),w.sub(T.multiplyScalar(T.dot(y))).normalize(),x.crossVectors(b,y);const C=x.dot(c[v])<0?-1:1;a.setXYZW(v,w.x,w.y,w.z,C)}for(let v=0,y=E.length;v<y;++v){const N=E[v],C=N.start,F=N.count;for(let z=C,D=C+F;z<D;z+=3)R(e.getX(z+0)),R(e.getX(z+1)),R(e.getX(z+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Ft(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);const s=new L,r=new L,a=new L,o=new L,c=new L,l=new L,h=new L,d=new L;if(e)for(let u=0,f=e.count;u<f;u+=3){const g=e.getX(u+0),S=e.getX(u+1),m=e.getX(u+2);s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,S),a.fromBufferAttribute(t,m),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),o.fromBufferAttribute(n,g),c.fromBufferAttribute(n,S),l.fromBufferAttribute(n,m),o.add(h),c.add(h),l.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(S,c.x,c.y,c.z),n.setXYZ(m,l.x,l.y,l.z)}else for(let u=0,f=t.count;u<f;u+=3)s.fromBufferAttribute(t,u+0),r.fromBufferAttribute(t,u+1),a.fromBufferAttribute(t,u+2),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Tt.fromBufferAttribute(e,t),Tt.normalize(),e.setXYZ(t,Tt.x,Tt.y,Tt.z)}toNonIndexed(){function e(o,c){const l=o.array,h=o.itemSize,d=o.normalized,u=new l.constructor(c.length*h);let f=0,g=0;for(let S=0,m=c.length;S<m;S++){o.isInterleavedBufferAttribute?f=c[S]*o.data.stride+o.offset:f=c[S]*h;for(let p=0;p<h;p++)u[g++]=l[f++]}return new Ft(u,h,d)}if(this.index===null)return Xe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new kt,n=this.index.array,s=this.attributes;for(const o in s){const c=s[o],l=e(c,n);t.setAttribute(o,l)}const r=this.morphAttributes;for(const o in r){const c=[],l=r[o];for(let h=0,d=l.length;h<d;h++){const u=l[h],f=e(u,n);c.push(f)}t.morphAttributes[o]=c}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,c=a.length;o<c;o++){const l=a[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const c in n){const l=n[c];e.data.attributes[c]=l.toJSON(e.data)}const s={};let r=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],h=[];for(let d=0,u=l.length;d<u;d++){const f=l[d];h.push(f.toJSON(e.data))}h.length>0&&(s[c]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const l in s){const h=s[l];this.setAttribute(l,h.clone(t))}const r=e.morphAttributes;for(const l in r){const h=[],d=r[l];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(t));this.morphAttributes[l]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let l=0,h=a.length;l<h;l++){const d=a[l];this.addGroup(d.start,d.count,d.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}const sa=new L,Rd=new L,Cd=new Ye;class Wn{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=sa.subVectors(n,t).cross(Rd.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const s=e.delta(sa),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Cd.getNormalMatrix(e),s=this.coplanarPoint(sa).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}let Pd=0;class Vi extends li{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pd++}),this.uuid=Gi(),this.name="",this.type="Material",this.blending=cs,this.side=si,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Kc,this.blendDst=Zc,this.blendEquation=Li,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new We(0,0,0),this.blendAlpha=0,this.depthFunc=vs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ju,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Br,this.stencilZFail=Br,this.stencilZPass=Br,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Xe(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Xe(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const c=r[o];delete c.metadata,a.push(c)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new We().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new Wn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ge().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ge().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const bn=new L,ra=new L,zs=new L,Gs=new L;class Ld{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,bn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=bn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(bn.copy(this.origin).addScaledVector(this.direction,t),bn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){ra.copy(e).add(t).multiplyScalar(.5),zs.copy(t).sub(e).normalize(),Gs.copy(this.origin).sub(ra);const r=e.distanceTo(t)*.5,a=-this.direction.dot(zs),o=Gs.dot(this.direction),c=-Gs.dot(zs),l=Gs.lengthSq(),h=Math.abs(1-a*a);let d,u,f,g;if(h>0)if(d=a*c-o,u=a*o-c,g=r*h,d>=0)if(u>=-g)if(u<=g){const S=1/h;d*=S,u*=S,f=d*(d+a*u+2*o)+u*(a*d+u+2*c)+l}else u=r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*c)+l;else u=-r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*c)+l;else u<=-g?(d=Math.max(0,-(-a*r+o)),u=d>0?-r:Math.min(Math.max(-r,-c),r),f=-d*d+u*(u+2*c)+l):u<=g?(d=0,u=Math.min(Math.max(-r,-c),r),f=u*(u+2*c)+l):(d=Math.max(0,-(a*r+o)),u=d>0?r:Math.min(Math.max(-r,-c),r),f=-d*d+u*(u+2*c)+l);else u=a>0?-r:r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(ra).addScaledVector(zs,u),f}intersectSphere(e,t){if(e.radius<0)return null;bn.subVectors(e.center,this.origin);const n=bn.dot(this.direction),s=bn.dot(bn)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,c=n+a;return c<0?null:o<0?this.at(c,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,c;const l=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return l>=0?(n=(e.min.x-u.x)*l,s=(e.max.x-u.x)*l):(n=(e.max.x-u.x)*l,s=(e.min.x-u.x)*l),h>=0?(r=(e.min.y-u.y)*h,a=(e.max.y-u.y)*h):(r=(e.max.y-u.y)*h,a=(e.min.y-u.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),d>=0?(o=(e.min.z-u.z)*d,c=(e.max.z-u.z)*d):(o=(e.max.z-u.z)*d,c=(e.min.z-u.z)*d),n>c||o>s)||((o>n||n!==n)&&(n=o),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,bn)!==null}intersectTriangle(e,t,n,s,r){const a=this.origin,o=this.direction,c=o.x,l=o.y,h=o.z,d=e.x-a.x,u=e.y-a.y,f=e.z-a.z,g=t.x-a.x,S=t.y-a.y,m=t.z-a.z,p=n.x-a.x,E=n.y-a.y,w=n.z-a.z,x=Math.abs(c),T=Math.abs(l),b=Math.abs(h);let R,v,y,N,C,F,z,D,B,Y,X,re;if(x>=T&&x>=b?(y=c,F=d,B=g,re=p,c>=0?(R=l,v=h,N=u,C=f,z=S,D=m,Y=E,X=w):(R=h,v=l,N=f,C=u,z=m,D=S,Y=w,X=E)):T>=b?(y=l,F=u,B=S,re=E,l>=0?(R=h,v=c,N=f,C=d,z=m,D=g,Y=w,X=p):(R=c,v=h,N=d,C=f,z=g,D=m,Y=p,X=w)):(y=h,F=f,B=m,re=w,h>=0?(R=c,v=l,N=d,C=u,z=g,D=S,Y=p,X=E):(R=l,v=c,N=u,C=d,z=S,D=g,Y=E,X=p)),y===0)return null;const $=R/y,te=v/y,ie=1/y,Ne=N-$*F,we=C-te*F,Qe=z-$*B,Ze=D-te*B,tt=Y-$*re,Q=X-te*re,ne=tt*Ze-Q*Qe,Me=Ne*Q-we*tt,Ce=Qe*we-Ze*Ne;if(s){if(ne<0||Me<0||Ce<0)return null}else if((ne<0||Me<0||Ce<0)&&(ne>0||Me>0||Ce>0))return null;const be=ne+Me+Ce;if(be===0)return null;const He=ie*(ne*F+Me*B+Ce*re);return(be>0?He<0:He>0)?null:this.at(He/be,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class hs extends Vi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new We(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=Ao,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Pl=new ht,Zn=new Ld,Vs=new Rs,Ll=new L,Hs=new L,Ws=new L,Xs=new L,aa=new L,qs=new L,Nl=new L,Ys=new L;class vt extends Bt{constructor(e=new kt,t=new hs){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){qs.set(0,0,0);for(let c=0,l=r.length;c<l;c++){const h=o[c],d=r[c];h!==0&&(aa.fromBufferAttribute(d,e),a?qs.addScaledVector(aa,h):qs.addScaledVector(aa.sub(t),h))}t.add(qs)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Vs.copy(n.boundingSphere),Vs.applyMatrix4(r),Zn.copy(e.ray).recast(e.near),!(Vs.containsPoint(Zn.origin)===!1&&(Zn.intersectSphere(Vs,Ll)===null||Zn.origin.distanceToSquared(Ll)>(e.far-e.near)**2))&&(Pl.copy(r).invert(),Zn.copy(e.ray).applyMatrix4(Pl),!(n.boundingBox!==null&&Zn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Zn)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,S=u.length;g<S;g++){const m=u[g],p=a[m.materialIndex],E=Math.max(m.start,f.start),w=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let x=E,T=w;x<T;x+=3){const b=o.getX(x),R=o.getX(x+1),v=o.getX(x+2);s=$s(this,p,e,n,l,h,d,b,R,v),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,f.start),S=Math.min(o.count,f.start+f.count);for(let m=g,p=S;m<p;m+=3){const E=o.getX(m),w=o.getX(m+1),x=o.getX(m+2);s=$s(this,a,e,n,l,h,d,E,w,x),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(c!==void 0)if(Array.isArray(a))for(let g=0,S=u.length;g<S;g++){const m=u[g],p=a[m.materialIndex],E=Math.max(m.start,f.start),w=Math.min(c.count,Math.min(m.start+m.count,f.start+f.count));for(let x=E,T=w;x<T;x+=3){const b=x,R=x+1,v=x+2;s=$s(this,p,e,n,l,h,d,b,R,v),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,f.start),S=Math.min(c.count,f.start+f.count);for(let m=g,p=S;m<p;m+=3){const E=m,w=m+1,x=m+2;s=$s(this,a,e,n,l,h,d,E,w,x),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Nd(i,e,t,n,s,r,a,o){let c;if(e.side===Ot?c=n.intersectTriangle(a,r,s,!0,o):c=n.intersectTriangle(s,r,a,e.side===si,o),c===null)return null;Ys.copy(o),Ys.applyMatrix4(i.matrixWorld);const l=t.ray.origin.distanceTo(Ys);return l<t.near||l>t.far?null:{distance:l,point:Ys.clone(),object:i}}function $s(i,e,t,n,s,r,a,o,c,l){i.getVertexPosition(o,Hs),i.getVertexPosition(c,Ws),i.getVertexPosition(l,Xs);const h=Nd(i,e,t,n,Hs,Ws,Xs,Nl);if(h){const d=new L;nn.getBarycoord(Nl,Hs,Ws,Xs,d),s&&(h.uv=nn.getInterpolatedAttribute(s,o,c,l,d,new ge)),r&&(h.uv1=nn.getInterpolatedAttribute(r,o,c,l,d,new ge)),a&&(h.normal=nn.getInterpolatedAttribute(a,o,c,l,d,new L),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:c,c:l,normal:new L,materialIndex:0};nn.getNormal(Hs,Ws,Xs,u.normal),h.face=u,h.barycoord=d}return h}class _h extends Nt{constructor(e=null,t=1,n=1,s,r,a,o,c,l=At,h=At,d,u){super(null,a,o,c,l,h,s,r,d,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ys extends Ft{constructor(e,t,n,s=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const yi=new ht,Il=new ht,Ks=[],Dl=new ci,Id=new ht,Zi=new vt,Ji=new Rs;class ii extends vt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ys(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Id)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new ci),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,yi),Dl.copy(e.boundingBox).applyMatrix4(yi),this.boundingBox.union(Dl)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Rs),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,yi),Ji.copy(e.boundingSphere).applyMatrix4(yi),this.boundingSphere.union(Ji)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(e,t){const n=this.matrixWorld,s=this.count;if(Zi.geometry=this.geometry,Zi.material=this.material,Zi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ji.copy(this.boundingSphere),Ji.applyMatrix4(n),e.ray.intersectsSphere(Ji)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,yi),Il.multiplyMatrices(n,yi),Zi.matrixWorld=Il,Zi.raycast(e,Ks);for(let a=0,o=Ks.length;a<o;a++){const c=Ks[a];c.instanceId=r,c.object=this,t.push(c)}Ks.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ys(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){const n=t.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new _h(new Float32Array(s*this.count),s,this.count,Lo,rn));const r=this.morphTexture.source.data.data;let a=0;for(let l=0;l<n.length;l++)a+=n[l];const o=this.geometry.morphTargetsRelative?1:1-a,c=s*e;return r[c]=o,r.set(n,c+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Jn=new Rs,Dd=new ge(.5,.5),Zs=new L;class Bo{constructor(e=new Wn,t=new Wn,n=new Wn,s=new Wn,r=new Wn,a=new Wn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=pn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],c=r[2],l=r[3],h=r[4],d=r[5],u=r[6],f=r[7],g=r[8],S=r[9],m=r[10],p=r[11],E=r[12],w=r[13],x=r[14],T=r[15];if(s[0].setComponents(l-a,f-h,p-g,T-E).normalize(),s[1].setComponents(l+a,f+h,p+g,T+E).normalize(),s[2].setComponents(l+o,f+d,p+S,T+w).normalize(),s[3].setComponents(l-o,f-d,p-S,T-w).normalize(),n)s[4].setComponents(c,u,m,x).normalize(),s[5].setComponents(l-c,f-u,p-m,T-x).normalize();else if(s[4].setComponents(l-c,f-u,p-m,T-x).normalize(),t===pn)s[5].setComponents(l+c,f+u,p+m,T+x).normalize();else if(t===Ss)s[5].setComponents(c,u,m,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Jn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Jn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Jn)}intersectsSprite(e){Jn.center.set(0,0,0);const t=Dd.distanceTo(e.center);return Jn.radius=.7071067811865476+t,Jn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Jn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Zs.x=s.normal.x>0?e.max.x:e.min.x,Zs.y=s.normal.y>0?e.max.y:e.min.y,Zs.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Zs)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class vh extends Nt{constructor(e=[],t=ri,n,s,r,a,o,c,l,h){super(e,t,n,s,r,a,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Ud extends Nt{constructor(e,t,n,s,r,a,o,c,l){super(e,t,n,s,r,a,o,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Es extends Nt{constructor(e,t,n=_n,s,r,a,o=At,c=At,l,h=Cn,d=1){if(h!==Cn&&h!==ti)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const u={width:e,height:t,depth:d};super(u,s,r,a,o,c,h,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Oo(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class Fd extends Es{constructor(e,t=_n,n=ri,s,r,a=At,o=At,c,l=Cn){const h={width:e,height:e,depth:1},d=[h,h,h,h,h,h];super(e,e,t,n,s,r,a,o,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class xh extends Nt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class qn extends kt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const c=[],l=[],h=[],d=[];let u=0,f=0;g("z","y","x",-1,-1,n,t,e,a,r,0),g("z","y","x",1,-1,n,t,-e,a,r,1),g("x","z","y",1,1,e,n,t,s,a,2),g("x","z","y",1,-1,e,n,-t,s,a,3),g("x","y","z",1,-1,e,t,n,s,r,4),g("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new yt(l,3)),this.setAttribute("normal",new yt(h,3)),this.setAttribute("uv",new yt(d,2));function g(S,m,p,E,w,x,T,b,R,v,y){const N=x/R,C=T/v,F=x/2,z=T/2,D=b/2,B=R+1,Y=v+1;let X=0,re=0;const $=new L;for(let te=0;te<Y;te++){const ie=te*C-z;for(let Ne=0;Ne<B;Ne++){const we=Ne*N-F;$[S]=we*E,$[m]=ie*w,$[p]=D,l.push($.x,$.y,$.z),$[S]=0,$[m]=0,$[p]=b>0?1:-1,h.push($.x,$.y,$.z),d.push(Ne/R),d.push(1-te/v),X+=1}}for(let te=0;te<v;te++)for(let ie=0;ie<R;ie++){const Ne=u+ie+B*te,we=u+ie+B*(te+1),Qe=u+(ie+1)+B*(te+1),Ze=u+(ie+1)+B*te;c.push(Ne,we,Ze),c.push(we,Qe,Ze),re+=6}o.addGroup(f,re,y),f+=re,u+=X}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class ko extends kt{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:c};const l=this;s=Math.floor(s),r=Math.floor(r);const h=[],d=[],u=[],f=[];let g=0;const S=[],m=n/2;let p=0;E(),a===!1&&(e>0&&w(!0),t>0&&w(!1)),this.setIndex(h),this.setAttribute("position",new yt(d,3)),this.setAttribute("normal",new yt(u,3)),this.setAttribute("uv",new yt(f,2));function E(){const x=new L,T=new L;let b=0;const R=(t-e)/n;for(let v=0;v<=r;v++){const y=[],N=v/r,C=N*(t-e)+e;for(let F=0;F<=s;F++){const z=F/s,D=z*c+o,B=Math.sin(D),Y=Math.cos(D);T.x=C*B,T.y=-N*n+m,T.z=C*Y,d.push(T.x,T.y,T.z),x.set(B,R,Y).normalize(),u.push(x.x,x.y,x.z),f.push(z,1-N),y.push(g++)}S.push(y)}for(let v=0;v<s;v++)for(let y=0;y<r;y++){const N=S[y][v],C=S[y+1][v],F=S[y+1][v+1],z=S[y][v+1];(e>0||y!==0)&&(h.push(N,C,z),b+=3),(t>0||y!==r-1)&&(h.push(C,F,z),b+=3)}l.addGroup(p,b,0),p+=b}function w(x){const T=g,b=new ge,R=new L;let v=0;const y=x===!0?e:t,N=x===!0?1:-1;for(let F=1;F<=s;F++)d.push(0,m*N,0),u.push(0,N,0),f.push(.5,.5),g++;const C=g;for(let F=0;F<=s;F++){const D=F/s*c+o,B=Math.cos(D),Y=Math.sin(D);R.x=y*Y,R.y=m*N,R.z=y*B,d.push(R.x,R.y,R.z),u.push(0,N,0),b.x=B*.5+.5,b.y=Y*.5*N+.5,f.push(b.x,b.y),g++}for(let F=0;F<s;F++){const z=T+F,D=C+F;x===!0?h.push(D,D+1,z):h.push(D+1,D,z),v+=3}l.addGroup(p,v,x===!0?1:2),p+=v}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ko(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class zo extends kt{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const r=[],a=[];o(s),l(n),h(),this.setAttribute("position",new yt(r,3)),this.setAttribute("normal",new yt(r.slice(),3)),this.setAttribute("uv",new yt(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(E){const w=new L,x=new L,T=new L;for(let b=0;b<t.length;b+=3)f(t[b+0],w),f(t[b+1],x),f(t[b+2],T),c(w,x,T,E)}function c(E,w,x,T){const b=T+1,R=[];for(let v=0;v<=b;v++){R[v]=[];const y=E.clone().lerp(x,v/b),N=w.clone().lerp(x,v/b),C=b-v;for(let F=0;F<=C;F++)F===0&&v===b?R[v][F]=y:R[v][F]=y.clone().lerp(N,F/C)}for(let v=0;v<b;v++)for(let y=0;y<2*(b-v)-1;y++){const N=Math.floor(y/2);y%2===0?(u(R[v][N+1]),u(R[v+1][N]),u(R[v][N])):(u(R[v][N+1]),u(R[v+1][N+1]),u(R[v+1][N]))}}function l(E){const w=new L;for(let x=0;x<r.length;x+=3)w.x=r[x+0],w.y=r[x+1],w.z=r[x+2],w.normalize().multiplyScalar(E),r[x+0]=w.x,r[x+1]=w.y,r[x+2]=w.z}function h(){const E=new L;for(let w=0;w<r.length;w+=3){E.x=r[w+0],E.y=r[w+1],E.z=r[w+2];const x=m(E)/2/Math.PI+.5,T=p(E)/Math.PI+.5;a.push(x,1-T)}g(),d()}function d(){for(let E=0;E<a.length;E+=6){const w=a[E+0],x=a[E+2],T=a[E+4],b=Math.max(w,x,T),R=Math.min(w,x,T);b>.9&&R<.1&&(w<.2&&(a[E+0]+=1),x<.2&&(a[E+2]+=1),T<.2&&(a[E+4]+=1))}}function u(E){r.push(E.x,E.y,E.z)}function f(E,w){const x=E*3;w.x=e[x+0],w.y=e[x+1],w.z=e[x+2]}function g(){const E=new L,w=new L,x=new L,T=new L,b=new ge,R=new ge,v=new ge;for(let y=0,N=0;y<r.length;y+=9,N+=6){E.set(r[y+0],r[y+1],r[y+2]),w.set(r[y+3],r[y+4],r[y+5]),x.set(r[y+6],r[y+7],r[y+8]),b.set(a[N+0],a[N+1]),R.set(a[N+2],a[N+3]),v.set(a[N+4],a[N+5]),T.copy(E).add(w).add(x).divideScalar(3);const C=m(T);S(b,N+0,E,C),S(R,N+2,w,C),S(v,N+4,x,C)}}function S(E,w,x,T){T<0&&E.x===1&&(a[w]=E.x-1),x.x===0&&x.z===0&&(a[w]=T/2/Math.PI+.5)}function m(E){return Math.atan2(E.z,-E.x)}function p(E){return Math.atan2(-E.y,Math.sqrt(E.x*E.x+E.z*E.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new zo(e.vertices,e.indices,e.radius,e.detail)}}class xn{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Xe("Curve: .getPoint() not implemented.")}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,s=this.getPoint(0),r=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){const n=this.getLengths();let s=0;const r=n.length;let a;t?a=t:a=e*n[r-1];let o=0,c=r-1,l;for(;o<=c;)if(s=Math.floor(o+(c-o)/2),l=n[s]-a,l<0)o=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,n[s]===a)return s/(r-1);const h=n[s],u=n[s+1]-h,f=(a-h)/u;return(s+f)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);const a=this.getPoint(s),o=this.getPoint(r),c=t||(a.isVector2?new ge:new L);return c.copy(o).sub(a).normalize(),c}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){const n=new L,s=[],r=[],a=[],o=new L,c=new ht;for(let f=0;f<=e;f++){const g=f/e;s[f]=this.getTangentAt(g,new L)}r[0]=new L,a[0]=new L;let l=Number.MAX_VALUE;const h=Math.abs(s[0].x),d=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=l&&(l=h,n.set(1,0,0)),d<=l&&(l=d,n.set(0,1,0)),u<=l&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=e;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(je(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(c.makeRotationAxis(o,g))}a[f].crossVectors(s[f],r[f])}if(t===!0){let f=Math.acos(je(r[0].dot(r[e]),-1,1));f/=e,s[0].dot(o.crossVectors(r[0],r[e]))>0&&(f=-f);for(let g=1;g<=e;g++)r[g].applyMatrix4(c.makeRotationAxis(s[g],f*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class Go extends xn{constructor(e=0,t=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=c}getPoint(e,t=new ge){const n=t,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);const o=this.aStartAngle+e*r;let c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=c-this.aX,f=l-this.aY;c=u*h-f*d+this.aX,l=u*d+f*h+this.aY}return n.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class Od extends Go{constructor(e,t,n,s,r,a){super(e,t,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Vo(){let i=0,e=0,t=0,n=0;function s(r,a,o,c){i=r,e=o,t=-3*r+3*a-2*o-c,n=2*r-2*a+o+c}return{initCatmullRom:function(r,a,o,c,l){s(a,o,l*(o-r),l*(c-a))},initNonuniformCatmullRom:function(r,a,o,c,l,h,d){let u=(a-r)/l-(o-r)/(l+h)+(o-a)/h,f=(o-a)/h-(c-a)/(h+d)+(c-o)/d;u*=h,f*=h,s(a,o,u,f)},calc:function(r){const a=r*r,o=a*r;return i+e*r+t*a+n*o}}}const Ul=new L,Fl=new L,oa=new Vo,la=new Vo,ca=new Vo;class Bd extends xn{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new L){const n=t,s=this.points,r=s.length,a=(r-(this.closed?0:1))*e;let o=Math.floor(a),c=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:c===0&&o===r-1&&(o=r-2,c=1);let l,h;this.closed||o>0?l=s[(o-1)%r]:(Fl.subVectors(s[0],s[1]).add(s[0]),l=Fl);const d=s[o%r],u=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(Ul.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Ul),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let g=Math.pow(l.distanceToSquared(d),f),S=Math.pow(d.distanceToSquared(u),f),m=Math.pow(u.distanceToSquared(h),f);S<1e-4&&(S=1),g<1e-4&&(g=S),m<1e-4&&(m=S),oa.initNonuniformCatmullRom(l.x,d.x,u.x,h.x,g,S,m),la.initNonuniformCatmullRom(l.y,d.y,u.y,h.y,g,S,m),ca.initNonuniformCatmullRom(l.z,d.z,u.z,h.z,g,S,m)}else this.curveType==="catmullrom"&&(oa.initCatmullRom(l.x,d.x,u.x,h.x,this.tension),la.initCatmullRom(l.y,d.y,u.y,h.y,this.tension),ca.initCatmullRom(l.z,d.z,u.z,h.z,this.tension));return n.set(oa.calc(c),la.calc(c),ca.calc(c)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new L().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function Ol(i,e,t,n,s){const r=(n-e)*.5,a=(s-t)*.5,o=i*i,c=i*o;return(2*t-2*n+r+a)*c+(-3*t+3*n-2*r-a)*o+r*i+t}function kd(i,e){const t=1-i;return t*t*e}function zd(i,e){return 2*(1-i)*i*e}function Gd(i,e){return i*i*e}function us(i,e,t,n){return kd(i,e)+zd(i,t)+Gd(i,n)}function Vd(i,e){const t=1-i;return t*t*t*e}function Hd(i,e){const t=1-i;return 3*t*t*i*e}function Wd(i,e){return 3*(1-i)*i*i*e}function Xd(i,e){return i*i*i*e}function ds(i,e,t,n,s){return Vd(i,e)+Hd(i,t)+Wd(i,n)+Xd(i,s)}class Mh extends xn{constructor(e=new ge,t=new ge,n=new ge,s=new ge){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new ge){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ds(e,s.x,r.x,a.x,o.x),ds(e,s.y,r.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class qd extends xn{constructor(e=new L,t=new L,n=new L,s=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new L){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ds(e,s.x,r.x,a.x,o.x),ds(e,s.y,r.y,a.y,o.y),ds(e,s.z,r.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Sh extends xn{constructor(e=new ge,t=new ge){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ge){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ge){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Yd extends xn{constructor(e=new L,t=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class yh extends xn{constructor(e=new ge,t=new ge,n=new ge){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ge){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(us(e,s.x,r.x,a.x),us(e,s.y,r.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class $d extends xn{constructor(e=new L,t=new L,n=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(us(e,s.x,r.x,a.x),us(e,s.y,r.y,a.y),us(e,s.z,r.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Eh extends xn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ge){const n=t,s=this.points,r=(s.length-1)*e,a=Math.floor(r),o=r-a,c=s[a===0?a:a-1],l=s[a],h=s[a>s.length-2?s.length-1:a+1],d=s[a>s.length-3?s.length-1:a+2];return n.set(Ol(o,c.x,l.x,h.x,d.x),Ol(o,c.y,l.y,h.y,d.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new ge().fromArray(s))}return this}}var ho=Object.freeze({__proto__:null,ArcCurve:Od,CatmullRomCurve3:Bd,CubicBezierCurve:Mh,CubicBezierCurve3:qd,EllipseCurve:Go,LineCurve:Sh,LineCurve3:Yd,QuadraticBezierCurve:yh,QuadraticBezierCurve3:$d,SplineCurve:Eh});class Kd extends xn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new ho[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const a=s[r]-n,o=this.curves[r],c=o.getLength(),l=c===0?0:1-a/c;return o.getPointAt(l,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const a=r[s],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,c=a.getPoints(o);for(let l=0;l<c.length;l++){const h=c[l];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(new ho[s.type]().fromJSON(s))}return this}}class Bl extends Kd{constructor(e){super(),this.type="Path",this.currentPoint=new ge,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new Sh(this.currentPoint.clone(),new ge(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){const r=new yh(this.currentPoint.clone(),new ge(e,t),new ge(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,a){const o=new Mh(this.currentPoint.clone(),new ge(e,t),new ge(n,s),new ge(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),n=new Eh(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,a){const o=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(e+o,t+c,n,s,r,a),this}absarc(e,t,n,s,r,a){return this.absellipse(e,t,n,n,s,r,a),this}ellipse(e,t,n,s,r,a,o,c){const l=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+l,t+h,n,s,r,a,o,c),this}absellipse(e,t,n,s,r,a,o,c){const l=new Go(e,t,n,s,r,a,o,c);if(this.curves.length>0){const d=l.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(l);const h=l.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class bh extends Bl{constructor(e){super(e),this.uuid=Gi(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(new Bl().fromJSON(s))}return this}}function Zd(i,e,t=2){const n=e&&e.length,s=n?e[0]*t:i.length;let r=Th(i,0,s,t,!0);const a=[];if(!r||r.next===r.prev)return a;let o,c,l;if(n&&(r=tf(i,e,r,t)),i.length>80*t){o=i[0],c=i[1];let h=o,d=c;for(let u=t;u<s;u+=t){const f=i[u],g=i[u+1];f<o&&(o=f),g<c&&(c=g),f>h&&(h=f),g>d&&(d=g)}l=Math.max(h-o,d-c),l=l!==0?32767/l:0}return bs(r,a,t,o,c,l,0),a}function Th(i,e,t,n,s){let r;if(s===ff(i,e,t,n)>0)for(let a=e;a<t;a+=n)r=kl(a/n|0,i[a],i[a+1],r);else for(let a=t-n;a>=e;a-=n)r=kl(a/n|0,i[a],i[a+1],r);return r&&Bi(r,r.next)&&(As(r),r=r.next),r}function oi(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(Bi(t,t.next)||_t(t.prev,t,t.next)===0)){if(As(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function bs(i,e,t,n,s,r,a){if(!i)return;!a&&r&&of(i,n,s,r);let o=i;for(;i.prev!==i.next;){const c=i.prev,l=i.next;if(r?Qd(i,n,s,r):Jd(i)){e.push(c.i,i.i,l.i),As(i),i=l.next,o=l.next;continue}if(i=l,i===o){a?a===1?(i=jd(oi(i),e),bs(i,e,t,n,s,r,2)):a===2&&ef(i,e,t,n,s,r):bs(oi(i),e,t,n,s,r,1);break}}}function Jd(i){const e=i.prev,t=i,n=i.next;if(_t(e,t,n)>=0)return!1;const s=e.x,r=t.x,a=n.x,o=e.y,c=t.y,l=n.y,h=Math.min(s,r,a),d=Math.min(o,c,l),u=Math.max(s,r,a),f=Math.max(o,c,l);let g=n.next;for(;g!==e;){if(g.x>=h&&g.x<=u&&g.y>=d&&g.y<=f&&rs(s,o,r,c,a,l,g.x,g.y)&&_t(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Qd(i,e,t,n){const s=i.prev,r=i,a=i.next;if(_t(s,r,a)>=0)return!1;const o=s.x,c=r.x,l=a.x,h=s.y,d=r.y,u=a.y,f=Math.min(o,c,l),g=Math.min(h,d,u),S=Math.max(o,c,l),m=Math.max(h,d,u),p=uo(f,g,e,t,n),E=uo(S,m,e,t,n);let w=i.prevZ,x=i.nextZ;for(;w&&w.z>=p&&x&&x.z<=E;){if(w.x>=f&&w.x<=S&&w.y>=g&&w.y<=m&&w!==s&&w!==a&&rs(o,h,c,d,l,u,w.x,w.y)&&_t(w.prev,w,w.next)>=0||(w=w.prevZ,x.x>=f&&x.x<=S&&x.y>=g&&x.y<=m&&x!==s&&x!==a&&rs(o,h,c,d,l,u,x.x,x.y)&&_t(x.prev,x,x.next)>=0))return!1;x=x.nextZ}for(;w&&w.z>=p;){if(w.x>=f&&w.x<=S&&w.y>=g&&w.y<=m&&w!==s&&w!==a&&rs(o,h,c,d,l,u,w.x,w.y)&&_t(w.prev,w,w.next)>=0)return!1;w=w.prevZ}for(;x&&x.z<=E;){if(x.x>=f&&x.x<=S&&x.y>=g&&x.y<=m&&x!==s&&x!==a&&rs(o,h,c,d,l,u,x.x,x.y)&&_t(x.prev,x,x.next)>=0)return!1;x=x.nextZ}return!0}function jd(i,e){let t=i;do{const n=t.prev,s=t.next.next;!Bi(n,s)&&wh(n,t,t.next,s)&&Ts(n,s)&&Ts(s,n)&&(e.push(n.i,t.i,s.i),As(t),As(t.next),t=i=s),t=t.next}while(t!==i);return oi(t)}function ef(i,e,t,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&hf(a,o)){let c=Rh(a,o);a=oi(a,a.next),c=oi(c,c.next),bs(a,e,t,n,s,r,0),bs(c,e,t,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function tf(i,e,t,n){const s=[];for(let r=0,a=e.length;r<a;r++){const o=e[r]*n,c=r<a-1?e[r+1]*n:i.length,l=Th(i,o,c,n,!1);l===l.next&&(l.steiner=!0),s.push(cf(l))}s.sort(nf);for(let r=0;r<s.length;r++)t=sf(s[r],t);return t}function nf(i,e){let t=i.x-e.x;if(t===0&&(t=i.y-e.y,t===0)){const n=(i.next.y-i.y)/(i.next.x-i.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=n-s}return t}function sf(i,e){const t=rf(i,e);if(!t)return e;const n=Rh(t,i);return oi(n,n.next),oi(t,t.next)}function rf(i,e){let t=e;const n=i.x,s=i.y;let r=-1/0,a;if(Bi(i,t))return t;do{if(Bi(i,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){const d=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=n&&d>r&&(r=d,a=t.x<t.next.x?t:t.next,d===n))return a}t=t.next}while(t!==e);if(!a)return null;const o=a,c=a.x,l=a.y;let h=1/0;t=a;do{if(n>=t.x&&t.x>=c&&n!==t.x&&Ah(s<l?n:r,s,c,l,s<l?r:n,s,t.x,t.y)){const d=Math.abs(s-t.y)/(n-t.x);Ts(t,i)&&(d<h||d===h&&(t.x>a.x||t.x===a.x&&af(a,t)))&&(a=t,h=d)}t=t.next}while(t!==o);return a}function af(i,e){return _t(i.prev,i,e.prev)<0&&_t(e.next,i,i.next)<0}function of(i,e,t,n){let s=i;do s.z===0&&(s.z=uo(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,lf(s)}function lf(i){let e,t=1;do{let n=i,s;i=null;let r=null;for(e=0;n;){e++;let a=n,o=0;for(let l=0;l<t&&(o++,a=a.nextZ,!!a);l++);let c=t;for(;o>0||c>0&&a;)o!==0&&(c===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,c--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,t*=2}while(e>1);return i}function uo(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function cf(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Ah(i,e,t,n,s,r,a,o){return(s-a)*(e-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(n-o)}function rs(i,e,t,n,s,r,a,o){return!(i===a&&e===o)&&Ah(i,e,t,n,s,r,a,o)}function hf(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!uf(i,e)&&(Ts(i,e)&&Ts(e,i)&&df(i,e)&&(_t(i.prev,i,e.prev)||_t(i,e.prev,e))||Bi(i,e)&&_t(i.prev,i,i.next)>0&&_t(e.prev,e,e.next)>0)}function _t(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Bi(i,e){return i.x===e.x&&i.y===e.y}function wh(i,e,t,n){const s=Qs(_t(i,e,t)),r=Qs(_t(i,e,n)),a=Qs(_t(t,n,i)),o=Qs(_t(t,n,e));return!!(s!==r&&a!==o||s===0&&Js(i,t,e)||r===0&&Js(i,n,e)||a===0&&Js(t,i,n)||o===0&&Js(t,e,n))}function Js(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function Qs(i){return i>0?1:i<0?-1:0}function uf(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&wh(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function Ts(i,e){return _t(i.prev,i,i.next)<0?_t(i,e,i.next)>=0&&_t(i,i.prev,e)>=0:_t(i,e,i.prev)<0||_t(i,i.next,e)<0}function df(i,e){let t=i,n=!1;const s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function Rh(i,e){const t=fo(i.i,i.x,i.y),n=fo(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function kl(i,e,t,n){const s=fo(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function As(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function fo(i,e,t){return{i,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function ff(i,e,t,n){let s=0;for(let r=e,a=t-n;r<t;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}class pf{static triangulate(e,t,n=2){return Zd(e,t,n)}}class Ii{static area(e){const t=e.length;let n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return Ii.area(e)<0}static triangulateShape(e,t){const n=[],s=[],r=[];zl(e),Gl(n,e);let a=e.length;t.forEach(zl);for(let c=0;c<t.length;c++)s.push(a),a+=t[c].length,Gl(n,t[c]);const o=pf.triangulate(n,s);for(let c=0;c<o.length;c+=3)r.push(o.slice(c,c+3));return r}}function zl(i){const e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function Gl(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}class Ho extends kt{constructor(e=new bh([new ge(.5,.5),new ge(-.5,.5),new ge(-.5,-.5),new ge(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const n=this,s=[],r=[];for(let o=0,c=e.length;o<c;o++){const l=e[o];a(l)}this.setAttribute("position",new yt(s,3)),this.setAttribute("uv",new yt(r,2)),this.computeVertexNormals();function a(o){const c=[],l=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,d=t.depth!==void 0?t.depth:1;let u=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:.2,g=t.bevelSize!==void 0?t.bevelSize:f-.1,S=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3;const p=t.extrudePath,E=t.UVGenerator!==void 0?t.UVGenerator:mf;let w,x=!1,T,b,R,v;if(p){w=p.getSpacedPoints(h),x=!0,u=!1;const j=p.isCatmullRomCurve3?p.closed:!1;T=p.computeFrenetFrames(h,j),b=new L,R=new L,v=new L}u||(m=0,f=0,g=0,S=0);const y=o.extractPoints(l);let N=y.shape;const C=y.holes;if(!Ii.isClockWise(N)){N=N.reverse();for(let j=0,oe=C.length;j<oe;j++){const ce=C[j];Ii.isClockWise(ce)&&(C[j]=ce.reverse())}}function z(j){const ce=10000000000000001e-36;let he=j[0];for(let de=1;de<=j.length;de++){const ze=de%j.length,Oe=j[ze],ke=Oe.x-he.x,qe=Oe.y-he.y,I=ke*ke+qe*qe,it=Math.max(Math.abs(Oe.x),Math.abs(Oe.y),Math.abs(he.x),Math.abs(he.y)),Je=ce*it*it;if(I<=Je){j.splice(ze,1),de--;continue}he=Oe}}z(N),C.forEach(z);const D=C.length,B=N;for(let j=0;j<D;j++){const oe=C[j];N=N.concat(oe)}function Y(j,oe,ce){return oe||rt("ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(oe,ce)}const X=N.length;function re(j,oe,ce){let he,de,ze;const Oe=j.x-oe.x,ke=j.y-oe.y,qe=ce.x-j.x,I=ce.y-j.y,it=Oe*Oe+ke*ke,Je=Oe*I-ke*qe;if(Math.abs(Je)>Number.EPSILON){const A=Math.sqrt(it),_=Math.sqrt(qe*qe+I*I),k=oe.x-ke/A,H=oe.y+Oe/A,K=ce.x-I/_,ue=ce.y+qe/_,me=((K-k)*I-(ue-H)*qe)/(Oe*I-ke*qe);he=k+Oe*me-j.x,de=H+ke*me-j.y;const J=he*he+de*de;if(J<=2)return new ge(he,de);ze=Math.sqrt(J/2)}else{let A=!1;Oe>Number.EPSILON?qe>Number.EPSILON&&(A=!0):Oe<-Number.EPSILON?qe<-Number.EPSILON&&(A=!0):Math.sign(ke)===Math.sign(I)&&(A=!0),A?(he=-ke,de=Oe,ze=Math.sqrt(it)):(he=Oe,de=ke,ze=Math.sqrt(it/2))}return new ge(he/ze,de/ze)}const $=[];for(let j=0,oe=B.length,ce=oe-1,he=j+1;j<oe;j++,ce++,he++)ce===oe&&(ce=0),he===oe&&(he=0),$[j]=re(B[j],B[ce],B[he]);const te=[];let ie,Ne=$.concat();for(let j=0,oe=D;j<oe;j++){const ce=C[j];ie=[];for(let he=0,de=ce.length,ze=de-1,Oe=he+1;he<de;he++,ze++,Oe++)ze===de&&(ze=0),Oe===de&&(Oe=0),ie[he]=re(ce[he],ce[ze],ce[Oe]);te.push(ie),Ne=Ne.concat(ie)}let we;if(m===0)we=Ii.triangulateShape(B,C);else{const j=[],oe=[];for(let ce=0;ce<m;ce++){const he=ce/m,de=f*Math.cos(he*Math.PI/2),ze=g*Math.sin(he*Math.PI/2)+S;for(let Oe=0,ke=B.length;Oe<ke;Oe++){const qe=Y(B[Oe],$[Oe],ze);Me(qe.x,qe.y,-de),he===0&&j.push(qe)}for(let Oe=0,ke=D;Oe<ke;Oe++){const qe=C[Oe];ie=te[Oe];const I=[];for(let it=0,Je=qe.length;it<Je;it++){const A=Y(qe[it],ie[it],ze);Me(A.x,A.y,-de),he===0&&I.push(A)}he===0&&oe.push(I)}}we=Ii.triangulateShape(j,oe)}const Qe=we.length,Ze=g+S;for(let j=0;j<X;j++){const oe=u?Y(N[j],Ne[j],Ze):N[j];x?(R.copy(T.normals[0]).multiplyScalar(oe.x),b.copy(T.binormals[0]).multiplyScalar(oe.y),v.copy(w[0]).add(R).add(b),Me(v.x,v.y,v.z)):Me(oe.x,oe.y,0)}for(let j=1;j<=h;j++)for(let oe=0;oe<X;oe++){const ce=u?Y(N[oe],Ne[oe],Ze):N[oe];x?(R.copy(T.normals[j]).multiplyScalar(ce.x),b.copy(T.binormals[j]).multiplyScalar(ce.y),v.copy(w[j]).add(R).add(b),Me(v.x,v.y,v.z)):Me(ce.x,ce.y,d/h*j)}for(let j=m-1;j>=0;j--){const oe=j/m,ce=f*Math.cos(oe*Math.PI/2),he=g*Math.sin(oe*Math.PI/2)+S;for(let de=0,ze=B.length;de<ze;de++){const Oe=Y(B[de],$[de],he);Me(Oe.x,Oe.y,d+ce)}for(let de=0,ze=C.length;de<ze;de++){const Oe=C[de];ie=te[de];for(let ke=0,qe=Oe.length;ke<qe;ke++){const I=Y(Oe[ke],ie[ke],he);x?Me(I.x,I.y+w[h-1].y,w[h-1].x+ce):Me(I.x,I.y,d+ce)}}}tt(),Q();function tt(){const j=s.length/3;if(u){let oe=0,ce=X*oe;for(let he=0;he<Qe;he++){const de=we[he];Ce(de[2]+ce,de[1]+ce,de[0]+ce)}oe=h+m*2,ce=X*oe;for(let he=0;he<Qe;he++){const de=we[he];Ce(de[0]+ce,de[1]+ce,de[2]+ce)}}else{for(let oe=0;oe<Qe;oe++){const ce=we[oe];Ce(ce[2],ce[1],ce[0])}for(let oe=0;oe<Qe;oe++){const ce=we[oe];Ce(ce[0]+X*h,ce[1]+X*h,ce[2]+X*h)}}n.addGroup(j,s.length/3-j,0)}function Q(){const j=s.length/3;let oe=0;ne(B,oe),oe+=B.length;for(let ce=0,he=C.length;ce<he;ce++){const de=C[ce];ne(de,oe),oe+=de.length}n.addGroup(j,s.length/3-j,1)}function ne(j,oe){let ce=j.length;for(;--ce>=0;){const he=ce;let de=ce-1;de<0&&(de=j.length-1);for(let ze=0,Oe=h+m*2;ze<Oe;ze++){const ke=X*ze,qe=X*(ze+1),I=oe+he+ke,it=oe+de+ke,Je=oe+de+qe,A=oe+he+qe;be(I,it,Je,A)}}}function Me(j,oe,ce){c.push(j),c.push(oe),c.push(ce)}function Ce(j,oe,ce){He(j),He(oe),He(ce);const he=s.length/3,de=E.generateTopUV(n,s,he-3,he-2,he-1);at(de[0]),at(de[1]),at(de[2])}function be(j,oe,ce,he){He(j),He(oe),He(he),He(oe),He(ce),He(he);const de=s.length/3,ze=E.generateSideWallUV(n,s,de-6,de-3,de-2,de-1);at(ze[0]),at(ze[1]),at(ze[3]),at(ze[1]),at(ze[2]),at(ze[3])}function He(j){s.push(c[j*3+0]),s.push(c[j*3+1]),s.push(c[j*3+2])}function at(j){r.push(j.x),r.push(j.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return gf(t,n,e)}static fromJSON(e,t){const n=[];for(let r=0,a=e.shapes.length;r<a;r++){const o=t[e.shapes[r]];n.push(o)}const s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new ho[s.type]().fromJSON(s)),new Ho(n,e.options)}}const mf={generateTopUV:function(i,e,t,n,s){const r=e[t*3],a=e[t*3+1],o=e[n*3],c=e[n*3+1],l=e[s*3],h=e[s*3+1];return[new ge(r,a),new ge(o,c),new ge(l,h)]},generateSideWallUV:function(i,e,t,n,s,r){const a=e[t*3],o=e[t*3+1],c=e[t*3+2],l=e[n*3],h=e[n*3+1],d=e[n*3+2],u=e[s*3],f=e[s*3+1],g=e[s*3+2],S=e[r*3],m=e[r*3+1],p=e[r*3+2];return Math.abs(o-h)<Math.abs(a-l)?[new ge(a,1-c),new ge(l,1-d),new ge(u,1-g),new ge(S,1-p)]:[new ge(o,1-c),new ge(h,1-d),new ge(f,1-g),new ge(m,1-p)]}};function gf(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class Wo extends zo{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Wo(e.radius,e.detail)}}class Cs extends kt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),c=Math.floor(s),l=o+1,h=c+1,d=e/o,u=t/c,f=[],g=[],S=[],m=[];for(let p=0;p<h;p++){const E=p*u-a;for(let w=0;w<l;w++){const x=w*d-r;g.push(x,-E,0),S.push(0,0,1),m.push(w/o),m.push(1-p/c)}}for(let p=0;p<c;p++)for(let E=0;E<o;E++){const w=E+l*p,x=E+l*(p+1),T=E+1+l*(p+1),b=E+1+l*p;f.push(w,x,b),f.push(x,T,b)}this.setIndex(f),this.setAttribute("position",new yt(g,3)),this.setAttribute("normal",new yt(S,3)),this.setAttribute("uv",new yt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Cs(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ar extends kt{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),s=Math.floor(s);const c=[],l=[],h=[],d=[],u=new L,f=new L,g=new L;for(let S=0;S<=n;S++){const m=a+S/n*o;for(let p=0;p<=s;p++){const E=p/s*r;f.x=(e+t*Math.cos(m))*Math.cos(E),f.y=(e+t*Math.cos(m))*Math.sin(E),f.z=t*Math.sin(m),l.push(f.x,f.y,f.z),u.x=e*Math.cos(E),u.y=e*Math.sin(E),g.subVectors(f,u).normalize(),h.push(g.x,g.y,g.z),d.push(p/s),d.push(S/n)}}for(let S=1;S<=n;S++)for(let m=1;m<=s;m++){const p=(s+1)*S+m-1,E=(s+1)*(S-1)+m-1,w=(s+1)*(S-1)+m,x=(s+1)*S+m;c.push(p,E,x),c.push(E,w,x)}this.setIndex(c),this.setAttribute("position",new yt(l,3)),this.setAttribute("normal",new yt(h,3)),this.setAttribute("uv",new yt(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ar(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc,e.thetaStart,e.thetaLength)}}function ki(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];if(Vl(s))s.isRenderTargetTexture?(Xe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(Vl(s[0])){const r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function Dt(i){const e={};for(let t=0;t<i.length;t++){const n=ki(i[t]);for(const s in n)e[s]=n[s]}return e}function Vl(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function _f(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Ch(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:nt.workingColorSpace}const vf={clone:ki,merge:Dt};var xf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Mf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Kt extends Vi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=xf,this.fragmentShader=Mf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ki(e.uniforms),this.uniformsGroups=_f(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const n in e.uniforms){const s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new We().setHex(s.value);break;case"v2":this.uniforms[n].value=new ge().fromArray(s.value);break;case"v3":this.uniforms[n].value=new L().fromArray(s.value);break;case"v4":this.uniforms[n].value=new gt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Ye().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ht().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class Sf extends Kt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class ws extends Vi{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new We(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new We(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=gr,this.normalScale=new ge(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class yf extends ws{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ge(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return je(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new We(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new We(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new We(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Ef extends Vi{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new We(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new We(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=gr,this.normalScale=new ge(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=Ao,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class bf extends Vi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ju,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Tf extends Vi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class Af extends Bt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new We(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}const ha=new ht,Hl=new L,Wl=new L;class wf{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ge(512,512),this.mapType=Yt,this.map=null,this.mapPass=null,this.matrix=new ht,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Bo,this._frameExtents=new ge(1,1),this._viewportCount=1,this._viewports=[new gt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera;Hl.setFromMatrixPosition(e.matrixWorld),t.position.copy(Hl),Wl.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Wl),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,s){ha.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(ha,e.coordinateSystem,e.reversedDepth);const r=this._frameExtents,a=s?s.z/r.x:1,o=s?s.w/r.y:1,c=s?s.x/r.x:0,l=s?s.y/r.y:0;e.coordinateSystem===Ss||e.reversedDepth?t.set(.5*a,0,0,.5*a+c,0,.5*o,0,.5*o+l,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+c,0,.5*o,0,.5*o+l,0,0,.5,.5,0,0,0,1),t.multiply(ha)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const js=new L,er=new Ln,hn=new L;class Ph extends Bt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ht,this.projectionMatrix=new ht,this.projectionMatrixInverse=new ht,this.coordinateSystem=pn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(js,er,hn),hn.x===1&&hn.y===1&&hn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(js,er,hn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(js,er,hn),hn.x===1&&hn.y===1&&hn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(js,er,hn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const kn=new L,Xl=new ge,ql=new ge;class Gt extends Ph{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=co*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(kr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return co*2*Math.atan(Math.tan(kr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){kn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(kn.x,kn.y).multiplyScalar(-e/kn.z),kn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(kn.x,kn.y).multiplyScalar(-e/kn.z)}getViewSize(e,t){return this.getViewBounds(e,Xl,ql),t.subVectors(ql,Xl)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(kr*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const c=a.fullWidth,l=a.fullHeight;r+=a.offsetX*s/c,t-=a.offsetY*n/l,s*=a.width/c,n*=a.height/l}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Rf extends wf{constructor(){super(new Gt(90,1,.5,500)),this.isPointLightShadow=!0}}class Xo extends Af{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new Rf}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class Lh extends Ph{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,c=s-t;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,a=r+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Ei=-90,bi=1;class Cf extends Bt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Gt(Ei,bi,e,t);s.layers=this.layers,this.add(s);const r=new Gt(Ei,bi,e,t);r.layers=this.layers,this.add(r);const a=new Gt(Ei,bi,e,t);a.layers=this.layers,this.add(a);const o=new Gt(Ei,bi,e,t);o.layers=this.layers,this.add(o);const c=new Gt(Ei,bi,e,t);c.layers=this.layers,this.add(c);const l=new Gt(Ei,bi,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,c]=t;for(const l of t)this.remove(l);if(e===pn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===Ss)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,c,l,h]=this.children,d=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const S=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),e.setRenderTarget(n,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),n.texture.generateMipmaps=S,e.setRenderTarget(n,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(d,u,f),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Pf extends Gt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const Qo=class Qo{constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}};Qo.prototype.isMatrix2=!0;let Yl=Qo;function $l(i,e,t,n){const s=Lf(n);switch(t){case lh:return i*e;case Lo:return i*e/s.components*s.byteLength;case No:return i*e/s.components*s.byteLength;case ai:return i*e*2/s.components*s.byteLength;case Io:return i*e*2/s.components*s.byteLength;case ch:return i*e*3/s.components*s.byteLength;case an:return i*e*4/s.components*s.byteLength;case Do:return i*e*4/s.components*s.byteLength;case or:case lr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case cr:case hr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Da:case Fa:return Math.max(i,16)*Math.max(e,8)/4;case Ia:case Ua:return Math.max(i,8)*Math.max(e,8)/2;case Oa:case Ba:case za:case Ga:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ka:case pr:case Va:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Ha:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Wa:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Xa:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case qa:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Ya:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case $a:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Ka:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Za:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Ja:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Qa:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case ja:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case eo:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case to:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case no:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case io:case so:case ro:return Math.ceil(i/4)*Math.ceil(e/4)*16;case ao:case oo:return Math.ceil(i/4)*Math.ceil(e/4)*8;case mr:case lo:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Lf(i){switch(i){case Yt:case sh:return{byteLength:1,components:1};case xs:case rh:case vn:return{byteLength:2,components:1};case Co:case Po:return{byteLength:2,components:4};case _n:case Ro:case rn:return{byteLength:4,components:1};case ah:case oh:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:To}}));typeof window<"u"&&(window.__THREE__?Xe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=To);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function Nh(){let i=null,e=!1,t=null,n=null;function s(r,a){n=i.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Nf(i){const e=new WeakMap;function t(o,c){const l=o.array,h=o.usage,d=l.byteLength,u=i.createBuffer();i.bindBuffer(c,u),i.bufferData(c,l,h),o.onUploadCallback();let f;if(l instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&l instanceof Float16Array)f=i.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)f=i.SHORT;else if(l instanceof Uint32Array)f=i.UNSIGNED_INT;else if(l instanceof Int32Array)f=i.INT;else if(l instanceof Int8Array)f=i.BYTE;else if(l instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:u,type:f,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,c,l){const h=c.array,d=c.updateRanges;if(i.bindBuffer(l,o),d.length===0)i.bufferSubData(l,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){const g=d[u],S=d[f];S.start<=g.start+g.count+1?g.count=Math.max(g.count,S.start+S.count-g.start):(++u,d[u]=S)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){const S=d[f];i.bufferSubData(l,S.start*h.BYTES_PER_ELEMENT,h,S.start,S.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const c=e.get(o);c&&(i.deleteBuffer(c.buffer),e.delete(o))}function a(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const l=e.get(o);if(l===void 0)e.set(o,t(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,o,c),l.version=o.version}}return{get:s,remove:r,update:a}}var If=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Df=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Uf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Ff=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Of=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Bf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,kf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,zf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Gf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Vf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Hf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Wf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Xf=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,qf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Yf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,$f=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Kf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Zf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Jf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Qf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,jf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,ep=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,tp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,np=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,ip=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,sp=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,rp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ap=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,op=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,lp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,cp="gl_FragColor = linearToOutputTexel( gl_FragColor );",hp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,up=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,dp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,fp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,pp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,mp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,gp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,_p=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,vp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,xp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Mp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Sp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,yp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Ep=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,bp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Tp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Ap=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,wp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Rp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Cp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Pp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Lp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Np=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ip=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Dp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Up=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Fp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Op=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Bp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,kp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,zp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Gp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Vp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Hp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Wp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Xp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,qp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Yp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,$p=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Zp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Jp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Qp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,jp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,em=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,tm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,nm=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,im=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,sm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,rm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,am=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,om=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,lm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,cm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,hm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,um=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,fm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,pm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,mm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,gm=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,_m=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,vm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,xm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Mm=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Sm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,ym=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Em=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,bm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Tm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Am=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,wm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Rm=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Cm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Pm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Lm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Nm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Im=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Dm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Um=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Fm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Om=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Bm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,km=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,zm=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Gm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Vm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Hm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Wm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Xm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,qm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ym=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,$m=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Km=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jm=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Qm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jm=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,eg=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,tg=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ng=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ig=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,sg=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,rg=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ag=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,og=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,lg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,cg=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,hg=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ug=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,dg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ke={alphahash_fragment:If,alphahash_pars_fragment:Df,alphamap_fragment:Uf,alphamap_pars_fragment:Ff,alphatest_fragment:Of,alphatest_pars_fragment:Bf,aomap_fragment:kf,aomap_pars_fragment:zf,batching_pars_vertex:Gf,batching_vertex:Vf,begin_vertex:Hf,beginnormal_vertex:Wf,bsdfs:Xf,iridescence_fragment:qf,bumpmap_pars_fragment:Yf,clipping_planes_fragment:$f,clipping_planes_pars_fragment:Kf,clipping_planes_pars_vertex:Zf,clipping_planes_vertex:Jf,color_fragment:Qf,color_pars_fragment:jf,color_pars_vertex:ep,color_vertex:tp,common:np,cube_uv_reflection_fragment:ip,defaultnormal_vertex:sp,displacementmap_pars_vertex:rp,displacementmap_vertex:ap,emissivemap_fragment:op,emissivemap_pars_fragment:lp,colorspace_fragment:cp,colorspace_pars_fragment:hp,envmap_fragment:up,envmap_common_pars_fragment:dp,envmap_pars_fragment:fp,envmap_pars_vertex:pp,envmap_physical_pars_fragment:Tp,envmap_vertex:mp,fog_vertex:gp,fog_pars_vertex:_p,fog_fragment:vp,fog_pars_fragment:xp,gradientmap_pars_fragment:Mp,lightmap_pars_fragment:Sp,lights_lambert_fragment:yp,lights_lambert_pars_fragment:Ep,lights_pars_begin:bp,lights_toon_fragment:Ap,lights_toon_pars_fragment:wp,lights_phong_fragment:Rp,lights_phong_pars_fragment:Cp,lights_physical_fragment:Pp,lights_physical_pars_fragment:Lp,lights_fragment_begin:Np,lights_fragment_maps:Ip,lights_fragment_end:Dp,lightprobes_pars_fragment:Up,logdepthbuf_fragment:Fp,logdepthbuf_pars_fragment:Op,logdepthbuf_pars_vertex:Bp,logdepthbuf_vertex:kp,map_fragment:zp,map_pars_fragment:Gp,map_particle_fragment:Vp,map_particle_pars_fragment:Hp,metalnessmap_fragment:Wp,metalnessmap_pars_fragment:Xp,morphinstance_vertex:qp,morphcolor_vertex:Yp,morphnormal_vertex:$p,morphtarget_pars_vertex:Kp,morphtarget_vertex:Zp,normal_fragment_begin:Jp,normal_fragment_maps:Qp,normal_pars_fragment:jp,normal_pars_vertex:em,normal_vertex:tm,normalmap_pars_fragment:nm,clearcoat_normal_fragment_begin:im,clearcoat_normal_fragment_maps:sm,clearcoat_pars_fragment:rm,iridescence_pars_fragment:am,opaque_fragment:om,packing:lm,premultiplied_alpha_fragment:cm,project_vertex:hm,dithering_fragment:um,dithering_pars_fragment:dm,roughnessmap_fragment:fm,roughnessmap_pars_fragment:pm,shadowmap_pars_fragment:mm,shadowmap_pars_vertex:gm,shadowmap_vertex:_m,shadowmask_pars_fragment:vm,skinbase_vertex:xm,skinning_pars_vertex:Mm,skinning_vertex:Sm,skinnormal_vertex:ym,specularmap_fragment:Em,specularmap_pars_fragment:bm,tonemapping_fragment:Tm,tonemapping_pars_fragment:Am,transmission_fragment:wm,transmission_pars_fragment:Rm,uv_pars_fragment:Cm,uv_pars_vertex:Pm,uv_vertex:Lm,worldpos_vertex:Nm,background_vert:Im,background_frag:Dm,backgroundCube_vert:Um,backgroundCube_frag:Fm,cube_vert:Om,cube_frag:Bm,depth_vert:km,depth_frag:zm,distance_vert:Gm,distance_frag:Vm,equirect_vert:Hm,equirect_frag:Wm,linedashed_vert:Xm,linedashed_frag:qm,meshbasic_vert:Ym,meshbasic_frag:$m,meshlambert_vert:Km,meshlambert_frag:Zm,meshmatcap_vert:Jm,meshmatcap_frag:Qm,meshnormal_vert:jm,meshnormal_frag:eg,meshphong_vert:tg,meshphong_frag:ng,meshphysical_vert:ig,meshphysical_frag:sg,meshtoon_vert:rg,meshtoon_frag:ag,points_vert:og,points_frag:lg,shadow_vert:cg,shadow_frag:hg,sprite_vert:ug,sprite_frag:dg},Se={common:{diffuse:{value:new We(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ye},alphaMap:{value:null},alphaMapTransform:{value:new Ye},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ye}},envmap:{envMap:{value:null},envMapRotation:{value:new Ye},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ye}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ye}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ye},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ye},normalScale:{value:new ge(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ye},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ye}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ye}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ye}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new We(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new We(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ye},alphaTest:{value:0},uvTransform:{value:new Ye}},sprite:{diffuse:{value:new We(16777215)},opacity:{value:1},center:{value:new ge(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ye},alphaMap:{value:null},alphaMapTransform:{value:new Ye},alphaTest:{value:0}}},dn={basic:{uniforms:Dt([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.fog]),vertexShader:Ke.meshbasic_vert,fragmentShader:Ke.meshbasic_frag},lambert:{uniforms:Dt([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new We(0)},envMapIntensity:{value:1}}]),vertexShader:Ke.meshlambert_vert,fragmentShader:Ke.meshlambert_frag},phong:{uniforms:Dt([Se.common,Se.specularmap,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,Se.lights,{emissive:{value:new We(0)},specular:{value:new We(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ke.meshphong_vert,fragmentShader:Ke.meshphong_frag},standard:{uniforms:Dt([Se.common,Se.envmap,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.roughnessmap,Se.metalnessmap,Se.fog,Se.lights,{emissive:{value:new We(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ke.meshphysical_vert,fragmentShader:Ke.meshphysical_frag},toon:{uniforms:Dt([Se.common,Se.aomap,Se.lightmap,Se.emissivemap,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.gradientmap,Se.fog,Se.lights,{emissive:{value:new We(0)}}]),vertexShader:Ke.meshtoon_vert,fragmentShader:Ke.meshtoon_frag},matcap:{uniforms:Dt([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,Se.fog,{matcap:{value:null}}]),vertexShader:Ke.meshmatcap_vert,fragmentShader:Ke.meshmatcap_frag},points:{uniforms:Dt([Se.points,Se.fog]),vertexShader:Ke.points_vert,fragmentShader:Ke.points_frag},dashed:{uniforms:Dt([Se.common,Se.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ke.linedashed_vert,fragmentShader:Ke.linedashed_frag},depth:{uniforms:Dt([Se.common,Se.displacementmap]),vertexShader:Ke.depth_vert,fragmentShader:Ke.depth_frag},normal:{uniforms:Dt([Se.common,Se.bumpmap,Se.normalmap,Se.displacementmap,{opacity:{value:1}}]),vertexShader:Ke.meshnormal_vert,fragmentShader:Ke.meshnormal_frag},sprite:{uniforms:Dt([Se.sprite,Se.fog]),vertexShader:Ke.sprite_vert,fragmentShader:Ke.sprite_frag},background:{uniforms:{uvTransform:{value:new Ye},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ke.background_vert,fragmentShader:Ke.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ye}},vertexShader:Ke.backgroundCube_vert,fragmentShader:Ke.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ke.cube_vert,fragmentShader:Ke.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ke.equirect_vert,fragmentShader:Ke.equirect_frag},distance:{uniforms:Dt([Se.common,Se.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ke.distance_vert,fragmentShader:Ke.distance_frag},shadow:{uniforms:Dt([Se.lights,Se.fog,{color:{value:new We(0)},opacity:{value:1}}]),vertexShader:Ke.shadow_vert,fragmentShader:Ke.shadow_frag}};dn.physical={uniforms:Dt([dn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ye},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ye},clearcoatNormalScale:{value:new ge(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ye},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ye},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ye},sheen:{value:0},sheenColor:{value:new We(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ye},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ye},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ye},transmissionSamplerSize:{value:new ge},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ye},attenuationDistance:{value:0},attenuationColor:{value:new We(0)},specularColor:{value:new We(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ye},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ye},anisotropyVector:{value:new ge},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ye}}]),vertexShader:Ke.meshphysical_vert,fragmentShader:Ke.meshphysical_frag};const tr={r:0,b:0,g:0},fg=new ht,Ih=new Ye;Ih.set(-1,0,0,0,1,0,0,0,1);function pg(i,e,t,n,s,r){const a=new We(0);let o=s===!0?0:1,c,l,h=null,d=0,u=null;function f(E){let w=E.isScene===!0?E.background:null;if(w&&w.isTexture){const x=E.backgroundBlurriness>0;w=e.get(w,x)}return w}function g(E){let w=!1;const x=f(E);x===null?m(a,o):x&&x.isColor&&(m(x,1),w=!0);const T=i.xr.getEnvironmentBlendMode();T==="additive"?t.buffers.color.setClear(0,0,0,1,r):T==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||w)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function S(E,w){const x=f(w);x&&(x.isCubeTexture||x.mapping===Tr)?(l===void 0&&(l=new vt(new qn(1,1,1),new Kt({name:"BackgroundCubeMaterial",uniforms:ki(dn.backgroundCube.uniforms),vertexShader:dn.backgroundCube.vertexShader,fragmentShader:dn.backgroundCube.fragmentShader,side:Ot,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(T,b,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=x,l.material.uniforms.backgroundBlurriness.value=w.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(fg.makeRotationFromEuler(w.backgroundRotation)).transpose(),x.isCubeTexture&&x.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(Ih),l.material.toneMapped=nt.getTransfer(x.colorSpace)!==ct,(h!==x||d!==x.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=x,d=x.version,u=i.toneMapping),l.layers.enableAll(),E.unshift(l,l.geometry,l.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new vt(new Cs(2,2),new Kt({name:"BackgroundMaterial",uniforms:ki(dn.background.uniforms),vertexShader:dn.background.vertexShader,fragmentShader:dn.background.fragmentShader,side:si,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,c.material.toneMapped=nt.getTransfer(x.colorSpace)!==ct,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||d!==x.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=x,d=x.version,u=i.toneMapping),c.layers.enableAll(),E.unshift(c,c.geometry,c.material,0,0,null))}function m(E,w){E.getRGB(tr,Ch(i)),t.buffers.color.setClear(tr.r,tr.g,tr.b,w,r)}function p(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(E,w=1){a.set(E),o=w,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(E){o=E,m(a,o)},render:g,addToRenderList:S,dispose:p}}function mg(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null);let r=s,a=!1;function o(C,F,z,D,B){let Y=!1;const X=d(C,D,z,F);r!==X&&(r=X,l(r.object)),Y=f(C,D,z,B),Y&&g(C,D,z,B),B!==null&&e.update(B,i.ELEMENT_ARRAY_BUFFER),(Y||a)&&(a=!1,x(C,F,z,D),B!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(B).buffer))}function c(){return i.createVertexArray()}function l(C){return i.bindVertexArray(C)}function h(C){return i.deleteVertexArray(C)}function d(C,F,z,D){const B=D.wireframe===!0;let Y=n[F.id];Y===void 0&&(Y={},n[F.id]=Y);const X=C.isInstancedMesh===!0?C.id:0;let re=Y[X];re===void 0&&(re={},Y[X]=re);let $=re[z.id];$===void 0&&($={},re[z.id]=$);let te=$[B];return te===void 0&&(te=u(c()),$[B]=te),te}function u(C){const F=[],z=[],D=[];for(let B=0;B<t;B++)F[B]=0,z[B]=0,D[B]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:z,attributeDivisors:D,object:C,attributes:{},index:null}}function f(C,F,z,D){const B=r.attributes,Y=F.attributes;let X=0;const re=z.getAttributes();for(const $ in re)if(re[$].location>=0){const ie=B[$];let Ne=Y[$];if(Ne===void 0&&($==="instanceMatrix"&&C.instanceMatrix&&(Ne=C.instanceMatrix),$==="instanceColor"&&C.instanceColor&&(Ne=C.instanceColor)),ie===void 0||ie.attribute!==Ne||Ne&&ie.data!==Ne.data)return!0;X++}return r.attributesNum!==X||r.index!==D}function g(C,F,z,D){const B={},Y=F.attributes;let X=0;const re=z.getAttributes();for(const $ in re)if(re[$].location>=0){let ie=Y[$];ie===void 0&&($==="instanceMatrix"&&C.instanceMatrix&&(ie=C.instanceMatrix),$==="instanceColor"&&C.instanceColor&&(ie=C.instanceColor));const Ne={};Ne.attribute=ie,ie&&ie.data&&(Ne.data=ie.data),B[$]=Ne,X++}r.attributes=B,r.attributesNum=X,r.index=D}function S(){const C=r.newAttributes;for(let F=0,z=C.length;F<z;F++)C[F]=0}function m(C){p(C,0)}function p(C,F){const z=r.newAttributes,D=r.enabledAttributes,B=r.attributeDivisors;z[C]=1,D[C]===0&&(i.enableVertexAttribArray(C),D[C]=1),B[C]!==F&&(i.vertexAttribDivisor(C,F),B[C]=F)}function E(){const C=r.newAttributes,F=r.enabledAttributes;for(let z=0,D=F.length;z<D;z++)F[z]!==C[z]&&(i.disableVertexAttribArray(z),F[z]=0)}function w(C,F,z,D,B,Y,X){X===!0?i.vertexAttribIPointer(C,F,z,B,Y):i.vertexAttribPointer(C,F,z,D,B,Y)}function x(C,F,z,D){S();const B=D.attributes,Y=z.getAttributes(),X=F.defaultAttributeValues;for(const re in Y){const $=Y[re];if($.location>=0){let te=B[re];if(te===void 0&&(re==="instanceMatrix"&&C.instanceMatrix&&(te=C.instanceMatrix),re==="instanceColor"&&C.instanceColor&&(te=C.instanceColor)),te!==void 0){const ie=te.normalized,Ne=te.itemSize,we=e.get(te);if(we===void 0)continue;const Qe=we.buffer,Ze=we.type,tt=we.bytesPerElement,Q=Ze===i.INT||Ze===i.UNSIGNED_INT||te.gpuType===Ro;if(te.isInterleavedBufferAttribute){const ne=te.data,Me=ne.stride,Ce=te.offset;if(ne.isInstancedInterleavedBuffer){for(let be=0;be<$.locationSize;be++)p($.location+be,ne.meshPerAttribute);C.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let be=0;be<$.locationSize;be++)m($.location+be);i.bindBuffer(i.ARRAY_BUFFER,Qe);for(let be=0;be<$.locationSize;be++)w($.location+be,Ne/$.locationSize,Ze,ie,Me*tt,(Ce+Ne/$.locationSize*be)*tt,Q)}else{if(te.isInstancedBufferAttribute){for(let ne=0;ne<$.locationSize;ne++)p($.location+ne,te.meshPerAttribute);C.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=te.meshPerAttribute*te.count)}else for(let ne=0;ne<$.locationSize;ne++)m($.location+ne);i.bindBuffer(i.ARRAY_BUFFER,Qe);for(let ne=0;ne<$.locationSize;ne++)w($.location+ne,Ne/$.locationSize,Ze,ie,Ne*tt,Ne/$.locationSize*ne*tt,Q)}}else if(X!==void 0){const ie=X[re];if(ie!==void 0)switch(ie.length){case 2:i.vertexAttrib2fv($.location,ie);break;case 3:i.vertexAttrib3fv($.location,ie);break;case 4:i.vertexAttrib4fv($.location,ie);break;default:i.vertexAttrib1fv($.location,ie)}}}}E()}function T(){y();for(const C in n){const F=n[C];for(const z in F){const D=F[z];for(const B in D){const Y=D[B];for(const X in Y)h(Y[X].object),delete Y[X];delete D[B]}}delete n[C]}}function b(C){if(n[C.id]===void 0)return;const F=n[C.id];for(const z in F){const D=F[z];for(const B in D){const Y=D[B];for(const X in Y)h(Y[X].object),delete Y[X];delete D[B]}}delete n[C.id]}function R(C){for(const F in n){const z=n[F];for(const D in z){const B=z[D];if(B[C.id]===void 0)continue;const Y=B[C.id];for(const X in Y)h(Y[X].object),delete Y[X];delete B[C.id]}}}function v(C){for(const F in n){const z=n[F],D=C.isInstancedMesh===!0?C.id:0,B=z[D];if(B!==void 0){for(const Y in B){const X=B[Y];for(const re in X)h(X[re].object),delete X[re];delete B[Y]}delete z[D],Object.keys(z).length===0&&delete n[F]}}}function y(){N(),a=!0,r!==s&&(r=s,l(r.object))}function N(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:y,resetDefaultState:N,dispose:T,releaseStatesOfGeometry:b,releaseStatesOfObject:v,releaseStatesOfProgram:R,initAttributes:S,enableAttribute:m,disableUnusedAttributes:E}}function gg(i,e,t){let n;function s(c){n=c}function r(c,l){i.drawArrays(n,c,l),t.update(l,n,1)}function a(c,l,h){h!==0&&(i.drawArraysInstanced(n,c,l,h),t.update(l,n,h))}function o(c,l,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,l,0,h);let u=0;for(let f=0;f<h;f++)u+=l[f];t.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function _g(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==an&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const v=R===vn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==Yt&&R!==rn&&!v&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function c(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp";const h=c(l);h!==l&&(Xe("WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);const d=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&Xe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),E=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),w=i.getParameter(i.MAX_VARYING_VECTORS),x=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),T=i.getParameter(i.MAX_SAMPLES),b=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:a,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:S,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:E,maxVaryings:w,maxFragmentUniforms:x,maxSamples:T,samples:b}}function vg(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Wn,o=new Ye,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){const f=d.length!==0||u||n!==0||s;return s=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){t=h(d,u,0)},this.setState=function(d,u,f){const g=d.clippingPlanes,S=d.clipIntersection,m=d.clipShadows,p=i.get(d);if(!s||g===null||g.length===0||r&&!m)r?h(null):l();else{const E=r?0:n,w=E*4;let x=p.clippingState||null;c.value=x,x=h(g,u,w,f);for(let T=0;T!==w;++T)x[T]=t[T];p.clippingState=x,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=E}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,u,f,g){const S=d!==null?d.length:0;let m=null;if(S!==0){if(m=c.value,g!==!0||m===null){const p=f+S*4,E=u.matrixWorldInverse;o.getNormalMatrix(E),(m===null||m.length<p)&&(m=new Float32Array(p));for(let w=0,x=f;w!==S;++w,x+=4)a.copy(d[w]).applyMatrix4(E,o),a.normal.toArray(m,x),m[x+3]=a.constant}c.value=m,c.needsUpdate=!0}return e.numPlanes=S,e.numIntersection=0,m}}const Di=4,xg=6,Mg=20,Sg=256,Qi=new Lh,Kl=new We;let ua=null,da=0,fa=0,pa=!1;const yg=new L,Qn=new L;class po{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=yg}=r;ua=this._renderer.getRenderTarget(),da=this._renderer.getActiveCubeFace(),fa=this._renderer.getActiveMipmapLevel(),pa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(e,n,s,c,o),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ql(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Jl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ua,da,fa),this._renderer.xr.enabled=pa,e.scissorTest=!1,Ti(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ri||e.mapping===Oi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ua=this._renderer.getRenderTarget(),da=this._renderer.getActiveCubeFace(),fa=this._renderer.getActiveMipmapLevel(),pa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Lt,minFilter:Lt,generateMipmaps:!1,type:vn,format:an,colorSpace:_r,depthBuffer:!1},s=Zl(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Zl(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Eg(r)),this._blurMaterial=Tg(r,e,t),this._ggxMaterial=bg(r,e,t)}return s}_compileMaterial(e){const t=new vt(new kt,e);this._renderer.compile(t,Qi)}_sceneToCubeUV(e,t,n,s,r){const c=new Gt(90,1,t,n),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(Kl),d.toneMapping=mn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new vt(new qn,new hs({name:"PMREM.Background",side:Ot,depthWrite:!1,depthTest:!1})));const S=this._backgroundBox,m=S.material;let p=!1;const E=e.background;E?E.isColor&&(m.color.copy(E),e.background=null,p=!0):(m.color.copy(Kl),p=!0);for(let w=0;w<6;w++){const x=w%3;x===0?(c.up.set(0,l[w],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x+h[w],r.y,r.z)):x===1?(c.up.set(0,0,l[w]),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y+h[w],r.z)):(c.up.set(0,l[w],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y,r.z+h[w]));const T=this._cubeSize;Ti(s,x*T,w>2?T:0,T,T),d.setRenderTarget(s),p&&d.render(S,c),d.render(e,c)}d.toneMapping=f,d.autoClear=u,e.background=E}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===ri||e.mapping===Oi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ql()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Jl());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const c=this._cubeSize;Ti(t,0,0,3*c,2*c),n.setRenderTarget(t),n.render(a,Qi)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const c=a.uniforms,l=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),d=Math.sqrt(l*l-h*h),u=l*1.25,f=d*u,{_lodMax:g}=this,S=this._sizeLods[n],m=3*S*(n>g-Di?n-g+Di:0),p=4*(this._cubeSize-S);c.envMap.value=e.texture,c.roughness.value=f,c.mipInt.value=g-t,Ti(r,m,p,3*S,2*S),s.setRenderTarget(r),s.render(o,Qi),c.envMap.value=r.texture,c.roughness.value=0,c.mipInt.value=g-n,Ti(e,m,p,3*S,2*S),s.setRenderTarget(e),s.render(o,Qi)}_blur(e,t,n,s){const r=this._pingPongRenderTarget,a=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,a),this._blurPass(r,e,n,n,a)}_blurPass(e,t,n,s,r){const a=this._renderer,o=this._blurMaterial,c=this._lodMeshes[s];c.material=o;const l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=r,l.mipInt.value=this._lodMax-n;const h=this._sizeLods[s],d=3*h*(s>this._lodMax-Di?s-this._lodMax+Di:0),u=4*(this._cubeSize-h);Ti(t,d,u,3*h,2*h),a.setRenderTarget(t),a.render(c,Qi)}}function Eg(i){const e=[],t=[];let n=i;const s=i-Di+1+xg;for(let r=0;r<s;r++){const a=Math.pow(2,n);e.push(a);const o=1/(a-2),c=-o,l=1+o,h=[c,c,l,c,l,l,c,c,l,l,c,l],d=6,u=6,f=3,g=new Float32Array(f*u*d),S=new Float32Array(f*u*d);for(let p=0;p<d;p++){const E=p%3*2/3-1,w=p>2?0:-1,x=[E,w,0,E+2/3,w,0,E+2/3,w+1,0,E,w,0,E+2/3,w+1,0,E,w+1,0];g.set(x,f*u*p);for(let T=0;T<u;T++){const b=h[T*2]*2-1,R=h[T*2+1]*2-1;p===0?Qn.set(1,R,b):p===1?Qn.set(-b,1,-R):p===2?Qn.set(-b,R,1):p===3?Qn.set(-1,R,-b):p===4?Qn.set(-b,-1,R):Qn.set(b,R,-1),Qn.toArray(S,(p*u+T)*f)}}const m=new kt;m.setAttribute("position",new Ft(g,f)),m.setAttribute("outputDirection",new Ft(S,f)),t.push(new vt(m,null)),n>Di&&n--}return{lodMeshes:t,sizeLods:e}}function Zl(i,e,t){const n=new on(i,e,t);return n.texture.mapping=Tr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ti(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function bg(i,e,t){return new Kt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Sg,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:wr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:wn,depthTest:!1,depthWrite:!1})}function Tg(i,e,t){return new Kt({name:"SphericalGaussianBlur",defines:{SAMPLES:Mg,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:wr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:wn,depthTest:!1,depthWrite:!1})}function Jl(){return new Kt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:wr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:wn,depthTest:!1,depthWrite:!1})}function Ql(){return new Kt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:wr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:wn,depthTest:!1,depthWrite:!1})}function wr(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class Dh extends on{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new vh(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new qn(5,5,5),r=new Kt({name:"CubemapFromEquirect",uniforms:ki(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ot,blending:wn});r.uniforms.tEquirect.value=t;const a=new vt(s,r),o=t.minFilter;return t.minFilter===ei&&(t.minFilter=Lt),new Cf(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}function Ag(i){let e=new WeakMap,t=new WeakMap,n=null;function s(u,f=!1){return u==null?null:f?a(u):r(u)}function r(u){if(u&&u.isTexture){const f=u.mapping;if(f===Ur||f===Fr)if(e.has(u)){const g=e.get(u).texture;return o(g,u.mapping)}else{const g=u.image;if(g&&g.height>0){const S=new Dh(g.height);return S.fromEquirectangularTexture(i,u),e.set(u,S),u.addEventListener("dispose",l),o(S.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){const f=u.mapping,g=f===Ur||f===Fr,S=f===ri||f===Oi;if(g||S){let m=t.get(u);const p=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==p)return n===null&&(n=new po(i)),m=g?n.fromEquirectangular(u,m):n.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),m.texture;if(m!==void 0)return m.texture;{const E=u.image;return g&&E&&E.height>0||S&&E&&c(E)?(n===null&&(n=new po(i)),m=g?n.fromEquirectangular(u):n.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function o(u,f){return f===Ur?u.mapping=ri:f===Fr&&(u.mapping=Oi),u}function c(u){let f=0;const g=6;for(let S=0;S<g;S++)u[S]!==void 0&&f++;return f===g}function l(u){const f=u.target;f.removeEventListener("dispose",l);const g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function h(u){const f=u.target;f.removeEventListener("dispose",h);const g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:d}}function wg(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Ui("WebGLRenderer: "+n+" extension not supported."),s}}}function Rg(i,e,t,n){const s={},r=new WeakMap;function a(d){const u=d.target;u.index!==null&&e.remove(u.index);for(const g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",a),delete s[u.id];const f=r.get(u);f&&(e.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function o(d,u){return s[u.id]===!0||(u.addEventListener("dispose",a),s[u.id]=!0,t.memory.geometries++),u}function c(d){const u=d.attributes;for(const f in u)e.update(u[f],i.ARRAY_BUFFER)}function l(d){const u=[],f=d.index,g=d.attributes.position;let S=0;if(g===void 0)return;if(f!==null){const E=f.array;S=f.version;for(let w=0,x=E.length;w<x;w+=3){const T=E[w+0],b=E[w+1],R=E[w+2];u.push(T,b,b,R,R,T)}}else{const E=g.array;S=g.version;for(let w=0,x=E.length/3-1;w<x;w+=3){const T=w+0,b=w+1,R=w+2;u.push(T,b,b,R,R,T)}}const m=new(g.count>=65535?gh:mh)(u,1);m.version=S;const p=r.get(d);p&&e.remove(p),r.set(d,m)}function h(d){const u=r.get(d);if(u){const f=d.index;f!==null&&u.version<f.version&&l(d)}else l(d);return r.get(d)}return{get:o,update:c,getWireframeAttribute:h}}function Cg(i,e,t){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function c(d,u){i.drawElements(n,u,r,d*a),t.update(u,n,1)}function l(d,u,f){f!==0&&(i.drawElementsInstanced(n,u,r,d*a,f),t.update(u,n,f))}function h(d,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let S=0;for(let m=0;m<f;m++)S+=u[m];t.update(S,n,1)}this.setMode=s,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=h}function Pg(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:rt("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function Lg(i,e,t){const n=new WeakMap,s=new gt;function r(a,o,c){const l=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0;let u=n.get(o);if(u===void 0||u.count!==d){let y=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",y)};u!==void 0&&u.texture.dispose();const f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,S=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],E=o.morphAttributes.color||[];let w=0;f===!0&&(w=1),g===!0&&(w=2),S===!0&&(w=3);let x=o.attributes.position.count*w,T=1;x>e.maxTextureSize&&(T=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);const b=new Float32Array(x*T*4*d),R=new uh(b,x,T,d);R.type=rn,R.needsUpdate=!0;const v=w*4;for(let N=0;N<d;N++){const C=m[N],F=p[N],z=E[N],D=x*T*4*N;for(let B=0;B<C.count;B++){const Y=B*v;f===!0&&(s.fromBufferAttribute(C,B),b[D+Y+0]=s.x,b[D+Y+1]=s.y,b[D+Y+2]=s.z,b[D+Y+3]=0),g===!0&&(s.fromBufferAttribute(F,B),b[D+Y+4]=s.x,b[D+Y+5]=s.y,b[D+Y+6]=s.z,b[D+Y+7]=0),S===!0&&(s.fromBufferAttribute(z,B),b[D+Y+8]=s.x,b[D+Y+9]=s.y,b[D+Y+10]=s.z,b[D+Y+11]=z.itemSize===4?s.w:1)}}u={count:d,texture:R,size:new ge(x,T)},n.set(o,u),o.addEventListener("dispose",y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let f=0;for(let S=0;S<l.length;S++)f+=l[S];const g=o.morphTargetsRelative?1:1-f;c.getUniforms().setValue(i,"morphTargetBaseInfluence",g),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",u.texture,t),c.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function Ng(i,e,t,n,s){let r=new WeakMap;function a(l){const h=s.render.frame,d=l.geometry,u=e.get(l,d);if(r.get(u)!==h&&(e.update(u),r.set(u,h)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),r.get(l)!==h&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),r.set(l,h))),l.isSkinnedMesh){const f=l.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function o(){r=new WeakMap}function c(l){const h=l.target;h.removeEventListener("dispose",c),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}const Ig={[Jc]:"LINEAR_TONE_MAPPING",[Qc]:"REINHARD_TONE_MAPPING",[jc]:"CINEON_TONE_MAPPING",[wo]:"ACES_FILMIC_TONE_MAPPING",[th]:"AGX_TONE_MAPPING",[nh]:"NEUTRAL_TONE_MAPPING",[eh]:"CUSTOM_TONE_MAPPING"};function Dg(i,e,t,n,s,r){const a=new on(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1});let o=null,c=null;const l=new kt;l.setAttribute("position",new yt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new yt([0,2,0,0,2,0],2));const h=new Sf({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new vt(l,h),u=new Lh(-1,1,1,-1,0,1);let f=null,g=null,S=!1,m,p=null,E=[],w=!1;this.setSize=function(x,T){a.setSize(x,T),o!==null&&o.setSize(x,T),c!==null&&c.setSize(x,T);for(let b=0;b<E.length;b++){const R=E[b];R.setSize&&R.setSize(x,T)}},this.setEffects=function(x){E=x,w=E.length>0&&E[0].isRenderPass===!0;const T=a.width,b=a.height;E.length>0&&o===null&&(o=new on(T,b,{type:vn,depthBuffer:!1,stencilBuffer:!1}),c=new on(T,b,{type:vn,depthBuffer:!1,stencilBuffer:!1}));for(let R=0;R<E.length;R++){const v=E[R];v.setSize&&v.setSize(T,b)}},this.begin=function(x,T){if(S||x.toneMapping===mn&&E.length===0)return!1;if(p=T,T!==null){const b=T.width,R=T.height;(a.width!==b||a.height!==R)&&this.setSize(b,R)}return w===!1&&x.setRenderTarget(a),m=x.toneMapping,x.toneMapping=mn,!0},this.hasRenderPass=function(){return w},this.end=function(x,T){x.toneMapping=m,S=!0;let b=a,R=o;for(let v=0;v<E.length;v++){const y=E[v];y.enabled!==!1&&(y.render(x,R,b,T),y.needsSwap!==!1&&(b=R,R=R===o?c:o))}if(f!==x.outputColorSpace||g!==x.toneMapping){f=x.outputColorSpace,g=x.toneMapping,h.defines={},nt.getTransfer(f)===ct&&(h.defines.SRGB_TRANSFER="");const v=Ig[g];v&&(h.defines[v]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=b.texture,x.setRenderTarget(p),x.render(d,u),p=null,S=!1},this.isCompositing=function(){return S},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),c!==null&&c.dispose(),l.dispose(),h.dispose()}}const Uh=new Nt,mo=new Es(1,1),Fh=new uh,Oh=new _d,Bh=new vh,jl=[],ec=[],tc=new Float32Array(16),nc=new Float32Array(9),ic=new Float32Array(4);function Hi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=jl[s];if(r===void 0&&(r=new Float32Array(s),jl[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function Et(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function bt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Rr(i,e){let t=ec[e];t===void 0&&(t=new Int32Array(e),ec[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Ug(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Fg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;i.uniform2fv(this.addr,e),bt(t,e)}}function Og(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Et(t,e))return;i.uniform3fv(this.addr,e),bt(t,e)}}function Bg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;i.uniform4fv(this.addr,e),bt(t,e)}}function kg(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Et(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),bt(t,e)}else{if(Et(t,n))return;ic.set(n),i.uniformMatrix2fv(this.addr,!1,ic),bt(t,n)}}function zg(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Et(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),bt(t,e)}else{if(Et(t,n))return;nc.set(n),i.uniformMatrix3fv(this.addr,!1,nc),bt(t,n)}}function Gg(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Et(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),bt(t,e)}else{if(Et(t,n))return;tc.set(n),i.uniformMatrix4fv(this.addr,!1,tc),bt(t,n)}}function Vg(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Hg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;i.uniform2iv(this.addr,e),bt(t,e)}}function Wg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Et(t,e))return;i.uniform3iv(this.addr,e),bt(t,e)}}function Xg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;i.uniform4iv(this.addr,e),bt(t,e)}}function qg(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Yg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Et(t,e))return;i.uniform2uiv(this.addr,e),bt(t,e)}}function $g(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Et(t,e))return;i.uniform3uiv(this.addr,e),bt(t,e)}}function Kg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Et(t,e))return;i.uniform4uiv(this.addr,e),bt(t,e)}}function Zg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(mo.compareFunction=t.isReversedDepthBuffer()?Fo:Uo,r=mo):r=Uh,t.setTexture2D(e||r,s)}function Jg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Oh,s)}function Qg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Bh,s)}function jg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||Fh,s)}function e0(i){switch(i){case 5126:return Ug;case 35664:return Fg;case 35665:return Og;case 35666:return Bg;case 35674:return kg;case 35675:return zg;case 35676:return Gg;case 5124:case 35670:return Vg;case 35667:case 35671:return Hg;case 35668:case 35672:return Wg;case 35669:case 35673:return Xg;case 5125:return qg;case 36294:return Yg;case 36295:return $g;case 36296:return Kg;case 35678:case 36198:case 36298:case 36306:case 35682:return Zg;case 35679:case 36299:case 36307:return Jg;case 35680:case 36300:case 36308:case 36293:return Qg;case 36289:case 36303:case 36311:case 36292:return jg}}function t0(i,e){i.uniform1fv(this.addr,e)}function n0(i,e){const t=Hi(e,this.size,2);i.uniform2fv(this.addr,t)}function i0(i,e){const t=Hi(e,this.size,3);i.uniform3fv(this.addr,t)}function s0(i,e){const t=Hi(e,this.size,4);i.uniform4fv(this.addr,t)}function r0(i,e){const t=Hi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function a0(i,e){const t=Hi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function o0(i,e){const t=Hi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function l0(i,e){i.uniform1iv(this.addr,e)}function c0(i,e){i.uniform2iv(this.addr,e)}function h0(i,e){i.uniform3iv(this.addr,e)}function u0(i,e){i.uniform4iv(this.addr,e)}function d0(i,e){i.uniform1uiv(this.addr,e)}function f0(i,e){i.uniform2uiv(this.addr,e)}function p0(i,e){i.uniform3uiv(this.addr,e)}function m0(i,e){i.uniform4uiv(this.addr,e)}function g0(i,e,t){const n=this.cache,s=e.length,r=Rr(t,s);Et(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=mo:a=Uh;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function _0(i,e,t){const n=this.cache,s=e.length,r=Rr(t,s);Et(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Oh,r[a])}function v0(i,e,t){const n=this.cache,s=e.length,r=Rr(t,s);Et(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||Bh,r[a])}function x0(i,e,t){const n=this.cache,s=e.length,r=Rr(t,s);Et(n,r)||(i.uniform1iv(this.addr,r),bt(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Fh,r[a])}function M0(i){switch(i){case 5126:return t0;case 35664:return n0;case 35665:return i0;case 35666:return s0;case 35674:return r0;case 35675:return a0;case 35676:return o0;case 5124:case 35670:return l0;case 35667:case 35671:return c0;case 35668:case 35672:return h0;case 35669:case 35673:return u0;case 5125:return d0;case 36294:return f0;case 36295:return p0;case 36296:return m0;case 35678:case 36198:case 36298:case 36306:case 35682:return g0;case 35679:case 36299:case 36307:return _0;case 35680:case 36300:case 36308:case 36293:return v0;case 36289:case 36303:case 36311:case 36292:return x0}}class S0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=e0(t.type)}}class y0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=M0(t.type)}}class E0{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const ma=/(\w+)(\])?(\[|\.)?/g;function sc(i,e){i.seq.push(e),i.map[e.id]=e}function b0(i,e,t){const n=i.name,s=n.length;for(ma.lastIndex=0;;){const r=ma.exec(n),a=ma.lastIndex;let o=r[1];const c=r[2]==="]",l=r[3];if(c&&(o=o|0),l===void 0||l==="["&&a+2===s){sc(t,l===void 0?new S0(o,i,e):new y0(o,i,e));break}else{let d=t.map[o];d===void 0&&(d=new E0(o),sc(t,d)),t=d}}}class ur{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),c=e.getUniformLocation(t,o.name);b0(o,c,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],c=n[o.id];c.needsUpdate!==!1&&o.setValue(e,c.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function rc(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const T0=37297;let A0=0;function w0(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const ac=new Ye;function R0(i){nt._getMatrix(ac,nt.workingColorSpace,i);const e=`mat3( ${ac.elements.map(t=>t.toFixed(4))} )`;switch(nt.getTransfer(i)){case vr:return[e,"LinearTransferOETF"];case ct:return[e,"sRGBTransferOETF"];default:return Xe("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function oc(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+w0(i.getShaderSource(e),o)}else return r}function C0(i,e){const t=R0(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const P0={[Jc]:"Linear",[Qc]:"Reinhard",[jc]:"Cineon",[wo]:"ACESFilmic",[th]:"AgX",[nh]:"Neutral",[eh]:"Custom"};function L0(i,e){const t=P0[e];return t===void 0?(Xe("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const nr=new L;function N0(){nt.getLuminanceCoefficients(nr);const i=nr.x.toFixed(4),e=nr.y.toFixed(4),t=nr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function I0(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(as).join(`
`)}function D0(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function U0(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function as(i){return i!==""}function lc(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function cc(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const F0=/^[ \t]*#include +<([\w\d./]+)>/gm;function go(i){return i.replace(F0,B0)}const O0=new Map;function B0(i,e){let t=Ke[e];if(t===void 0){const n=O0.get(e);if(n!==void 0)t=Ke[n],Xe('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return go(t)}const k0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function hc(i){return i.replace(k0,z0)}function z0(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function uc(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const G0={[ar]:"SHADOWMAP_TYPE_PCF",[ss]:"SHADOWMAP_TYPE_VSM"};function V0(i){return G0[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const H0={[ri]:"ENVMAP_TYPE_CUBE",[Oi]:"ENVMAP_TYPE_CUBE",[Tr]:"ENVMAP_TYPE_CUBE_UV"};function W0(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":H0[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const X0={[Oi]:"ENVMAP_MODE_REFRACTION"};function q0(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":X0[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Y0={[Ao]:"ENVMAP_BLENDING_MULTIPLY",[$u]:"ENVMAP_BLENDING_MIX",[Ku]:"ENVMAP_BLENDING_ADD"};function $0(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Y0[i.combine]||"ENVMAP_BLENDING_NONE"}function K0(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function Z0(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const c=V0(t),l=W0(t),h=q0(t),d=$0(t),u=K0(t),f=I0(t),g=D0(r),S=s.createProgram();let m,p,E=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(as).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(as).join(`
`),p.length>0&&(p+=`
`)):(m=[uc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(as).join(`
`),p=[uc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mn?"#define TONE_MAPPING":"",t.toneMapping!==mn?Ke.tonemapping_pars_fragment:"",t.toneMapping!==mn?L0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ke.colorspace_pars_fragment,C0("linearToOutputTexel",t.outputColorSpace),N0(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(as).join(`
`)),a=go(a),a=lc(a,t),a=cc(a,t),o=go(o),o=lc(o,t),o=cc(o,t),a=hc(a),o=hc(o),t.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===gl?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===gl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const w=E+m+a,x=E+p+o,T=rc(s,s.VERTEX_SHADER,w),b=rc(s,s.FRAGMENT_SHADER,x);s.attachShader(S,T),s.attachShader(S,b),t.index0AttributeName!==void 0?s.bindAttribLocation(S,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function R(C){if(i.debug.checkShaderErrors){const F=s.getProgramInfoLog(S)||"",z=s.getShaderInfoLog(T)||"",D=s.getShaderInfoLog(b)||"",B=F.trim(),Y=z.trim(),X=D.trim();let re=!0,$=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(re=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,S,T,b);else{const te=oc(s,T,"vertex"),ie=oc(s,b,"fragment");rt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+B+`
`+te+`
`+ie)}else B!==""?Xe("WebGLProgram: Program Info Log:",B):(Y===""||X==="")&&($=!1);$&&(C.diagnostics={runnable:re,programLog:B,vertexShader:{log:Y,prefix:m},fragmentShader:{log:X,prefix:p}})}s.deleteShader(T),s.deleteShader(b),v=new ur(s,S),y=U0(s,S)}let v;this.getUniforms=function(){return v===void 0&&R(this),v};let y;this.getAttributes=function(){return y===void 0&&R(this),y};let N=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return N===!1&&(N=s.getProgramParameter(S,T0)),N},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=A0++,this.cacheKey=e,this.usedTimes=1,this.program=S,this.vertexShader=T,this.fragmentShader=b,this}let J0=0;class Q0{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new j0(e),t.set(e,n)),n}}class j0{constructor(e){this.id=J0++,this.code=e,this.usedTimes=0}}function e_(i){return i===ai||i===pr||i===mr}function t_(i,e,t,n,s,r){const a=new dh,o=new Q0,c=new Set,l=[],h=new Map,d=n.logarithmicDepthBuffer;let u=n.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){return c.add(v),v===0?"uv":`uv${v}`}function S(v,y,N,C,F,z){const D=C.fog,B=F.geometry,Y=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?C.environment:null,X=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,re=e.get(v.envMap||Y,X),$=re&&re.mapping===Tr?re.image.height:null,te=f[v.type];v.precision!==null&&(u=n.getMaxPrecision(v.precision),u!==v.precision&&Xe("WebGLProgram.getParameters:",v.precision,"not supported, using",u,"instead."));const ie=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,Ne=ie!==void 0?ie.length:0;let we=0;B.morphAttributes.position!==void 0&&(we=1),B.morphAttributes.normal!==void 0&&(we=2),B.morphAttributes.color!==void 0&&(we=3);let Qe,Ze,tt,Q;if(te){const ft=dn[te];Qe=ft.vertexShader,Ze=ft.fragmentShader}else{Qe=v.vertexShader,Ze=v.fragmentShader;const ft=o.getVertexShaderStage(v),ot=o.getFragmentShaderStage(v);o.update(v,ft,ot),tt=ft.id,Q=ot.id}const ne=i.getRenderTarget(),Me=i.state.buffers.depth.getReversed(),Ce=F.isInstancedMesh===!0,be=F.isBatchedMesh===!0,He=!!v.map,at=!!v.matcap,j=!!re,oe=!!v.aoMap,ce=!!v.lightMap,he=!!v.bumpMap&&v.wireframe===!1,de=!!v.normalMap,ze=!!v.displacementMap,Oe=!!v.emissiveMap,ke=!!v.metalnessMap,qe=!!v.roughnessMap,I=v.anisotropy>0,it=v.clearcoat>0,Je=v.dispersion>0,A=v.retroreflectivity>0,_=v.iridescence>0,k=v.sheen>0,H=v.transmission>0,K=I&&!!v.anisotropyMap,ue=it&&!!v.clearcoatMap,me=it&&!!v.clearcoatNormalMap,J=it&&!!v.clearcoatRoughnessMap,ee=_&&!!v.iridescenceMap,ve=_&&!!v.iridescenceThicknessMap,De=k&&!!v.sheenColorMap,xe=k&&!!v.sheenRoughnessMap,_e=!!v.specularMap,Ue=!!v.specularColorMap,Ge=!!v.specularIntensityMap,ae=H&&!!v.transmissionMap,P=H&&!!v.thicknessMap,le=!!v.gradientMap,Z=!!v.alphaMap,fe=v.alphaTest>0,ye=!!v.alphaHash,se=!!v.extensions;let Be=mn;v.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(Be=i.toneMapping);const Ie={shaderID:te,shaderType:v.type,shaderName:v.name,vertexShader:Qe,fragmentShader:Ze,defines:v.defines,customVertexShaderID:tt,customFragmentShaderID:Q,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:u,batching:be,batchingColor:be&&F._colorsTexture!==null,instancing:Ce,instancingColor:Ce&&F.instanceColor!==null,instancingMorph:Ce&&F.morphTexture!==null,outputColorSpace:ne===null?i.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:nt.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:He,matcap:at,envMap:j,envMapMode:j&&re.mapping,envMapCubeUVHeight:$,aoMap:oe,lightMap:ce,bumpMap:he,normalMap:de,displacementMap:ze,emissiveMap:Oe,normalMapObjectSpace:de&&v.normalMapType===Qu,normalMapTangentSpace:de&&v.normalMapType===gr,packedNormalMap:de&&v.normalMapType===gr&&e_(v.normalMap.format),metalnessMap:ke,roughnessMap:qe,anisotropy:I,anisotropyMap:K,clearcoat:it,clearcoatMap:ue,clearcoatNormalMap:me,clearcoatRoughnessMap:J,dispersion:Je,retroreflection:A,iridescence:_,iridescenceMap:ee,iridescenceThicknessMap:ve,sheen:k,sheenColorMap:De,sheenRoughnessMap:xe,specularMap:_e,specularColorMap:Ue,specularIntensityMap:Ge,transmission:H,transmissionMap:ae,thicknessMap:P,gradientMap:le,opaque:v.transparent===!1&&v.blending===cs&&v.alphaToCoverage===!1,alphaMap:Z,alphaTest:fe,alphaHash:ye,combine:v.combine,mapUv:He&&g(v.map.channel),aoMapUv:oe&&g(v.aoMap.channel),lightMapUv:ce&&g(v.lightMap.channel),bumpMapUv:he&&g(v.bumpMap.channel),normalMapUv:de&&g(v.normalMap.channel),displacementMapUv:ze&&g(v.displacementMap.channel),emissiveMapUv:Oe&&g(v.emissiveMap.channel),metalnessMapUv:ke&&g(v.metalnessMap.channel),roughnessMapUv:qe&&g(v.roughnessMap.channel),anisotropyMapUv:K&&g(v.anisotropyMap.channel),clearcoatMapUv:ue&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:me&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:J&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:ee&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:De&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:xe&&g(v.sheenRoughnessMap.channel),specularMapUv:_e&&g(v.specularMap.channel),specularColorMapUv:Ue&&g(v.specularColorMap.channel),specularIntensityMapUv:Ge&&g(v.specularIntensityMap.channel),transmissionMapUv:ae&&g(v.transmissionMap.channel),thicknessMapUv:P&&g(v.thicknessMap.channel),alphaMapUv:Z&&g(v.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(de||I),vertexNormals:!!B.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,pointsUvs:F.isPoints===!0&&!!B.attributes.uv&&(He||Z),fog:!!D,useFog:v.fog===!0,fogExp2:!!D&&D.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||B.attributes.normal===void 0&&de===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:Me,skinning:F.isSkinnedMesh===!0,hasPositionAttribute:B.attributes.position!==void 0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:Ne,morphTextureStride:we,numSunLights:y.sun.length,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numSunLightShadows:y.sunShadowMap.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numLightProbeGrids:z.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:v.dithering,shadowMapEnabled:i.shadowMap.enabled&&N.length>0,shadowMapType:i.shadowMap.type,toneMapping:Be,decodeVideoTexture:He&&v.map.isVideoTexture===!0&&nt.getTransfer(v.map.colorSpace)===ct,decodeVideoTextureEmissive:Oe&&v.emissiveMap.isVideoTexture===!0&&nt.getTransfer(v.emissiveMap.colorSpace)===ct,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===fn,flipSided:v.side===Ot,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:se&&v.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(se&&v.extensions.multiDraw===!0||be)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return Ie.vertexUv1s=c.has(1),Ie.vertexUv2s=c.has(2),Ie.vertexUv3s=c.has(3),c.clear(),Ie}function m(v){const y=[];if(v.shaderID?y.push(v.shaderID):(y.push(v.customVertexShaderID),y.push(v.customFragmentShaderID)),v.defines!==void 0)for(const N in v.defines)y.push(N),y.push(v.defines[N]);return v.isRawShaderMaterial===!1&&(p(y,v),E(y,v),y.push(i.outputColorSpace)),y.push(v.customProgramCacheKey),y.join()}function p(v,y){v.push(y.precision),v.push(y.outputColorSpace),v.push(y.envMapMode),v.push(y.envMapCubeUVHeight),v.push(y.mapUv),v.push(y.alphaMapUv),v.push(y.lightMapUv),v.push(y.aoMapUv),v.push(y.bumpMapUv),v.push(y.normalMapUv),v.push(y.displacementMapUv),v.push(y.emissiveMapUv),v.push(y.metalnessMapUv),v.push(y.roughnessMapUv),v.push(y.anisotropyMapUv),v.push(y.clearcoatMapUv),v.push(y.clearcoatNormalMapUv),v.push(y.clearcoatRoughnessMapUv),v.push(y.iridescenceMapUv),v.push(y.iridescenceThicknessMapUv),v.push(y.sheenColorMapUv),v.push(y.sheenRoughnessMapUv),v.push(y.specularMapUv),v.push(y.specularColorMapUv),v.push(y.specularIntensityMapUv),v.push(y.transmissionMapUv),v.push(y.thicknessMapUv),v.push(y.combine),v.push(y.fogExp2),v.push(y.sizeAttenuation),v.push(y.morphTargetsCount),v.push(y.morphAttributeCount),v.push(y.numSunLights),v.push(y.numDirLights),v.push(y.numPointLights),v.push(y.numSpotLights),v.push(y.numSpotLightMaps),v.push(y.numHemiLights),v.push(y.numRectAreaLights),v.push(y.numSunLightShadows),v.push(y.numDirLightShadows),v.push(y.numPointLightShadows),v.push(y.numSpotLightShadows),v.push(y.numSpotLightShadowsWithMaps),v.push(y.numLightProbes),v.push(y.shadowMapType),v.push(y.toneMapping),v.push(y.numClippingPlanes),v.push(y.numClipIntersection),v.push(y.depthPacking)}function E(v,y){a.disableAll(),y.instancing&&a.enable(0),y.instancingColor&&a.enable(1),y.instancingMorph&&a.enable(2),y.matcap&&a.enable(3),y.envMap&&a.enable(4),y.normalMapObjectSpace&&a.enable(5),y.normalMapTangentSpace&&a.enable(6),y.clearcoat&&a.enable(7),y.iridescence&&a.enable(8),y.alphaTest&&a.enable(9),y.vertexColors&&a.enable(10),y.vertexAlphas&&a.enable(11),y.vertexUv1s&&a.enable(12),y.vertexUv2s&&a.enable(13),y.vertexUv3s&&a.enable(14),y.vertexTangents&&a.enable(15),y.anisotropy&&a.enable(16),y.alphaHash&&a.enable(17),y.batching&&a.enable(18),y.dispersion&&a.enable(19),y.retroreflection&&a.enable(24),y.batchingColor&&a.enable(20),y.gradientMap&&a.enable(21),y.packedNormalMap&&a.enable(22),y.vertexNormals&&a.enable(23),v.push(a.mask),a.disableAll(),y.fog&&a.enable(0),y.useFog&&a.enable(1),y.flatShading&&a.enable(2),y.logarithmicDepthBuffer&&a.enable(3),y.reversedDepthBuffer&&a.enable(4),y.skinning&&a.enable(5),y.morphTargets&&a.enable(6),y.morphNormals&&a.enable(7),y.morphColors&&a.enable(8),y.premultipliedAlpha&&a.enable(9),y.shadowMapEnabled&&a.enable(10),y.doubleSided&&a.enable(11),y.flipSided&&a.enable(12),y.useDepthPacking&&a.enable(13),y.dithering&&a.enable(14),y.transmission&&a.enable(15),y.sheen&&a.enable(16),y.opaque&&a.enable(17),y.pointsUvs&&a.enable(18),y.decodeVideoTexture&&a.enable(19),y.decodeVideoTextureEmissive&&a.enable(20),y.alphaToCoverage&&a.enable(21),y.numLightProbeGrids>0&&a.enable(22),y.hasPositionAttribute&&a.enable(23),v.push(a.mask)}function w(v){const y=f[v.type];let N;if(y){const C=dn[y];N=vf.clone(C.uniforms)}else N=v.uniforms;return N}function x(v,y){let N=h.get(y);return N!==void 0?++N.usedTimes:(N=new Z0(i,y,v,s),l.push(N),h.set(y,N)),N}function T(v){if(--v.usedTimes===0){const y=l.indexOf(v);l[y]=l[l.length-1],l.pop(),h.delete(v.cacheKey),v.destroy()}}function b(v){o.remove(v)}function R(){o.dispose()}return{getParameters:S,getProgramCacheKey:m,getUniforms:w,acquireProgram:x,releaseProgram:T,releaseShaderCache:b,programs:l,dispose:R}}function n_(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,c){i.get(a)[o]=c}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function i_(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function dc(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function fc(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function o(u,f,g,S,m,p){let E=i[e];return E===void 0?(E={id:u.id,object:u,geometry:f,material:g,materialVariant:a(u),groupOrder:S,renderOrder:u.renderOrder,z:m,group:p},i[e]=E):(E.id=u.id,E.object=u,E.geometry=f,E.material=g,E.materialVariant=a(u),E.groupOrder=S,E.renderOrder=u.renderOrder,E.z=m,E.group=p),e++,E}function c(u,f,g,S,m,p,E){E.reversedDepth===!0&&(m=-m);const w=o(u,f,g,S,m,p);g.transmission>0?n.push(w):g.transparent===!0?s.push(w):t.push(w)}function l(u,f,g,S,m,p){const E=o(u,f,g,S,m,p);g.transmission>0?n.unshift(E):g.transparent===!0?s.unshift(E):t.unshift(E)}function h(u,f){t.length>1&&t.sort(u||i_),n.length>1&&n.sort(f||dc),s.length>1&&s.sort(f||dc)}function d(){for(let u=e,f=i.length;u<f;u++){const g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:c,unshift:l,finish:d,sort:h}}function s_(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new fc,i.set(n,[a])):s>=r.length?(a=new fc,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function r_(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new L,color:new We};break;case"SpotLight":t={position:new L,direction:new L,color:new We,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new L,color:new We,distance:0,decay:0};break;case"HemisphereLight":t={direction:new L,skyColor:new We,groundColor:new We};break;case"RectAreaLight":t={color:new We,position:new L,halfWidth:new L,halfHeight:new L};break}return i[e.id]=t,t}}}function a_(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ge};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ge};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ge,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let o_=0;function l_(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function c_(i){const e=new r_,t=a_(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new L);const s=new L,r=new ht,a=new ht;function o(l){let h=0,d=0,u=0;for(let F=0;F<9;F++)n.probe[F].set(0,0,0);let f=0,g=0,S=0,m=0,p=0,E=0,w=0,x=0,T=0,b=0,R=0,v=0,y=0,N=0;l.sort(l_);for(let F=0,z=l.length;F<z;F++){const D=l[F],B=D.color,Y=D.intensity,X=D.distance;let re=null;if(D.shadow&&D.shadow.map&&(D.shadow.map.texture.format===ai?re=D.shadow.map.texture:re=D.shadow.map.depthTexture||D.shadow.map.texture),D.isAmbientLight)h+=B.r*Y,d+=B.g*Y,u+=B.b*Y;else if(D.isLightProbe){for(let $=0;$<9;$++)n.probe[$].addScaledVector(D.sh.coefficients[$],Y);N++}else if(D.isSunLight){const $=e.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const te=D.shadow,ie=t.get(D);ie.shadowIntensity=te.intensity,ie.shadowBias=te.bias,ie.shadowNormalBias=te.normalBias,ie.shadowRadius=te.radius,ie.shadowMapSize.copy(te.mapSize).multiply(te.getFrameExtents()),n.sunShadow[g]=ie,n.sunShadowMap[g]=re;const Ne=te.getViewportCount();for(let we=0;we<Ne;we++)n.sunShadowMatrix[S+we]=te.getMatrix(we),n.sunShadowCascade[S+we]=te._cascadeData[we];S+=Ne,g++}n.sun[f]=$,f++}else if(D.isDirectionalLight){const $=e.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),D.castShadow){const te=D.shadow,ie=t.get(D);ie.shadowIntensity=te.intensity,ie.shadowBias=te.bias,ie.shadowNormalBias=te.normalBias,ie.shadowRadius=te.radius,ie.shadowMapSize=te.mapSize,n.directionalShadow[m]=ie,n.directionalShadowMap[m]=re,n.directionalShadowMatrix[m]=D.shadow.matrix,T++}n.directional[m]=$,m++}else if(D.isSpotLight){const $=e.get(D);$.position.setFromMatrixPosition(D.matrixWorld),$.color.copy(B).multiplyScalar(Y),$.distance=X,$.coneCos=Math.cos(D.angle),$.penumbraCos=Math.cos(D.angle*(1-D.penumbra)),$.decay=D.decay,n.spot[E]=$;const te=D.shadow;if(D.map&&(n.spotLightMap[v]=D.map,v++,te.updateMatrices(D),D.castShadow&&y++),n.spotLightMatrix[E]=te.matrix,D.castShadow){const ie=t.get(D);ie.shadowIntensity=te.intensity,ie.shadowBias=te.bias,ie.shadowNormalBias=te.normalBias,ie.shadowRadius=te.radius,ie.shadowMapSize=te.mapSize,n.spotShadow[E]=ie,n.spotShadowMap[E]=re,R++}E++}else if(D.isRectAreaLight){const $=e.get(D);$.color.copy(B).multiplyScalar(Y),$.halfWidth.set(D.width*.5,0,0),$.halfHeight.set(0,D.height*.5,0),n.rectArea[w]=$,w++}else if(D.isPointLight){const $=e.get(D);if($.color.copy(D.color).multiplyScalar(D.intensity),$.distance=D.distance,$.decay=D.decay,D.castShadow){const te=D.shadow,ie=t.get(D);ie.shadowIntensity=te.intensity,ie.shadowBias=te.bias,ie.shadowNormalBias=te.normalBias,ie.shadowRadius=te.radius,ie.shadowMapSize=te.mapSize,ie.shadowCameraNear=te.camera.near,ie.shadowCameraFar=te.camera.far,n.pointShadow[p]=ie,n.pointShadowMap[p]=re,n.pointShadowMatrix[p]=D.shadow.matrix,b++}n.point[p]=$,p++}else if(D.isHemisphereLight){const $=e.get(D);$.skyColor.copy(D.color).multiplyScalar(Y),$.groundColor.copy(D.groundColor).multiplyScalar(Y),n.hemi[x]=$,x++}}w>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Se.LTC_FLOAT_1,n.rectAreaLTC2=Se.LTC_FLOAT_2):(n.rectAreaLTC1=Se.LTC_HALF_1,n.rectAreaLTC2=Se.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;const C=n.hash;(C.sunLength!==f||C.directionalLength!==m||C.pointLength!==p||C.spotLength!==E||C.rectAreaLength!==w||C.hemiLength!==x||C.numSunShadows!==g||C.numDirectionalShadows!==T||C.numPointShadows!==b||C.numSpotShadows!==R||C.numSpotMaps!==v||C.numLightProbes!==N)&&(n.sun.length=f,n.directional.length=m,n.spot.length=E,n.rectArea.length=w,n.point.length=p,n.hemi.length=x,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=S,n.sunShadowCascade.length=S,n.directionalShadow.length=T,n.directionalShadowMap.length=T,n.directionalShadowMatrix.length=T,n.pointShadow.length=b,n.pointShadowMap.length=b,n.pointShadowMatrix.length=b,n.spotShadow.length=R,n.spotShadowMap.length=R,n.spotLightMatrix.length=R+v-y,n.spotLightMap.length=v,n.numSpotLightShadowsWithMaps=y,n.numLightProbes=N,C.sunLength=f,C.directionalLength=m,C.pointLength=p,C.spotLength=E,C.rectAreaLength=w,C.hemiLength=x,C.numSunShadows=g,C.numDirectionalShadows=T,C.numPointShadows=b,C.numSpotShadows=R,C.numSpotMaps=v,C.numLightProbes=N,n.version=o_++)}function c(l,h){let d=0,u=0,f=0,g=0,S=0,m=0;const p=h.matrixWorldInverse;for(let E=0,w=l.length;E<w;E++){const x=l[E];if(x.isSunLight){const T=n.sun[d];T.direction.setFromMatrixPosition(x.matrixWorld),T.direction.transformDirection(p),d++}else if(x.isDirectionalLight){const T=n.directional[u];T.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(p),u++}else if(x.isSpotLight){const T=n.spot[g];T.position.setFromMatrixPosition(x.matrixWorld),T.position.applyMatrix4(p),T.direction.setFromMatrixPosition(x.matrixWorld),s.setFromMatrixPosition(x.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(p),g++}else if(x.isRectAreaLight){const T=n.rectArea[S];T.position.setFromMatrixPosition(x.matrixWorld),T.position.applyMatrix4(p),a.identity(),r.copy(x.matrixWorld),r.premultiply(p),a.extractRotation(r),T.halfWidth.set(x.width*.5,0,0),T.halfHeight.set(0,x.height*.5,0),T.halfWidth.applyMatrix4(a),T.halfHeight.applyMatrix4(a),S++}else if(x.isPointLight){const T=n.point[f];T.position.setFromMatrixPosition(x.matrixWorld),T.position.applyMatrix4(p),f++}else if(x.isHemisphereLight){const T=n.hemi[m];T.direction.setFromMatrixPosition(x.matrixWorld),T.direction.transformDirection(p),m++}}}return{setup:o,setupView:c,state:n}}function pc(i){const e=new c_(i),t=[],n=[],s=[];function r(u){d.camera=u,t.length=0,n.length=0,s.length=0}function a(u){t.push(u)}function o(u){n.push(u)}function c(u){s.push(u)}function l(){e.setup(t)}function h(u){e.setupView(t,u)}const d={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:l,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:c}}function h_(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new pc(i),e.set(s,[o])):r>=a.length?(o=new pc(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const u_=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,d_=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,f_=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],p_=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],mc=new ht,ji=new L,ga=new L;function m_(i,e,t){let n=new Bo;const s=new ge,r=new ge,a=new gt,o=new bf,c=new Tf,l={},h=t.maxTextureSize,d={[si]:Ot,[Ot]:si,[fn]:fn},u=new Kt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ge},radius:{value:4}},vertexShader:u_,fragmentShader:d_}),f=u.clone();f.defines.HORIZONTAL_PASS=1;const g=new kt;g.setAttribute("position",new Ft(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const S=new vt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ar;let p=this.type;this.render=function(b,R,v){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||b.length===0)return;this.type===Cu&&(Xe("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ar);const y=i.getRenderTarget(),N=i.getActiveCubeFace(),C=i.getActiveMipmapLevel(),F=i.state;F.setBlending(wn),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const z=p!==this.type;z&&R.traverse(function(D){D.material&&(Array.isArray(D.material)?D.material.forEach(B=>B.needsUpdate=!0):D.material.needsUpdate=!0)});for(let D=0,B=b.length;D<B;D++){const Y=b[D],X=Y.shadow;if(X===void 0){Xe("WebGLShadowMap:",Y,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;s.copy(X.mapSize);const re=X.getFrameExtents();s.multiply(re),r.copy(X.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/re.x),s.x=r.x*re.x,X.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/re.y),s.y=r.y*re.y,X.mapSize.y=r.y));const $=i.state.buffers.depth.getReversed();if(X.camera._reversedDepth=$,X.map===null||z===!0){if(X.map!==null&&(X.map.depthTexture!==null&&(X.map.depthTexture.dispose(),X.map.depthTexture=null),X.map.dispose()),this.type===ss){if(Y.isPointLight){Xe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}X.map=new on(s.x,s.y,{format:ai,type:vn,minFilter:Lt,magFilter:Lt,generateMipmaps:!1}),X.map.texture.name=Y.name+".shadowMap",X.map.depthTexture=new Es(s.x,s.y,rn),X.map.depthTexture.name=Y.name+".shadowMapDepth",X.map.depthTexture.format=Cn,X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=At,X.map.depthTexture.magFilter=At}else Y.isPointLight?(X.map=new Dh(s.x),X.map.depthTexture=new Fd(s.x,_n)):(X.map=new on(s.x,s.y),X.map.depthTexture=new Es(s.x,s.y,_n)),X.map.depthTexture.name=Y.name+".shadowMap",X.map.depthTexture.format=Cn,this.type===ar?(X.map.depthTexture.compareFunction=$?Fo:Uo,X.map.depthTexture.minFilter=Lt,X.map.depthTexture.magFilter=Lt):(X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=At,X.map.depthTexture.magFilter=At);X.camera.updateProjectionMatrix()}X.map.isWebGLCubeRenderTarget!==!0&&(X.map.width!==s.x||X.map.height!==s.y)&&X.map.setSize(s.x,s.y);const te=X.map.isWebGLCubeRenderTarget?6:X.getViewportCount();Y.isPointLight!==!0&&X.updateMatrices(Y,v);for(let ie=0;ie<te;ie++){const Ne=X.getCamera(ie);if(Y.isPointLight){const we=X.camera,Qe=X.matrix,Ze=Y.distance||we.far;Ze!==we.far&&(we.far=Ze,we.updateProjectionMatrix()),ji.setFromMatrixPosition(Y.matrixWorld),we.position.copy(ji),ga.copy(we.position),ga.add(f_[ie]),we.up.copy(p_[ie]),we.lookAt(ga),we.updateMatrixWorld(),Qe.makeTranslation(-ji.x,-ji.y,-ji.z),mc.multiplyMatrices(we.projectionMatrix,we.matrixWorldInverse),X._frustum.setFromProjectionMatrix(mc,we.coordinateSystem,we.reversedDepth)}if(X.map.isWebGLCubeRenderTarget)i.setRenderTarget(X.map,ie),i.clear();else{ie===0&&(i.setRenderTarget(X.map),i.clear());const we=X.getViewport(ie);a.set(r.x*we.x,r.y*we.y,r.x*we.z,r.y*we.w),F.viewport(a)}n=X.getFrustum(ie),x(R,v,Ne,Y,this.type)}X.isPointLightShadow!==!0&&this.type===ss&&E(X,v),X.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(y,N,C)};function E(b,R){const v=e.update(S);u.defines.VSM_SAMPLES!==b.blurSamples&&(u.defines.VSM_SAMPLES=b.blurSamples,f.defines.VSM_SAMPLES=b.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),b.mapPass===null?b.mapPass=new on(s.x,s.y,{format:ai,type:vn}):(b.mapPass.width!==b.map.width||b.mapPass.height!==b.map.height)&&b.mapPass.setSize(b.map.width,b.map.height),u.uniforms.shadow_pass.value=b.map.depthTexture,u.uniforms.resolution.value.set(b.map.width,b.map.height),u.uniforms.radius.value=b.radius,i.setRenderTarget(b.mapPass),i.clear(),i.renderBufferDirect(R,null,v,u,S,null),f.uniforms.shadow_pass.value=b.mapPass.texture,f.uniforms.resolution.value.set(b.map.width,b.map.height),f.uniforms.radius.value=b.radius,i.setRenderTarget(b.map),i.clear(),i.renderBufferDirect(R,null,v,f,S,null)}function w(b,R,v,y){let N=null;const C=v.isPointLight===!0?b.customDistanceMaterial:b.customDepthMaterial;if(C!==void 0)N=C;else if(N=v.isPointLight===!0?c:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const F=N.uuid,z=R.uuid;let D=l[F];D===void 0&&(D={},l[F]=D);let B=D[z];B===void 0&&(B=N.clone(),D[z]=B,R.addEventListener("dispose",T)),N=B}if(N.visible=R.visible,N.wireframe=R.wireframe,y===ss?N.side=R.shadowSide!==null?R.shadowSide:R.side:N.side=R.shadowSide!==null?R.shadowSide:d[R.side],N.alphaMap=R.alphaMap,N.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,N.map=R.map,N.clipShadows=R.clipShadows,N.clippingPlanes=R.clippingPlanes,N.clipIntersection=R.clipIntersection,N.displacementMap=R.displacementMap,N.displacementScale=R.displacementScale,N.displacementBias=R.displacementBias,N.wireframeLinewidth=R.wireframeLinewidth,N.linewidth=R.linewidth,v.isPointLight===!0&&N.isMeshDistanceMaterial===!0){const F=i.properties.get(N);F.light=v}return N}function x(b,R,v,y,N){if(b.visible===!1)return;if(b.layers.test(R.layers)&&(b.isMesh||b.isLine||b.isPoints)&&(b.castShadow||b.receiveShadow&&N===ss)&&(!b.frustumCulled||b.intersectsFrustum(n))){b.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,b.matrixWorld);const z=e.update(b),D=b.material;if(Array.isArray(D)){const B=z.groups;for(let Y=0,X=B.length;Y<X;Y++){const re=B[Y],$=D[re.materialIndex];if($&&$.visible){const te=w(b,$,y,N);b.onBeforeShadow(i,b,R,v,z,te,re),i.renderBufferDirect(v,null,z,te,b,re),b.onAfterShadow(i,b,R,v,z,te,re)}}}else if(D.visible){const B=w(b,D,y,N);b.onBeforeShadow(i,b,R,v,z,B,null),i.renderBufferDirect(v,null,z,B,b,null),b.onAfterShadow(i,b,R,v,z,B,null)}}const F=b.children;for(let z=0,D=F.length;z<D;z++)x(F[z],R,v,y,N)}function T(b){b.target.removeEventListener("dispose",T);for(const v in l){const y=l[v],N=b.target.uuid;N in y&&(y[N].dispose(),delete y[N])}}}function g_(i,e){function t(){let P=!1;const le=new gt;let Z=null;const fe=new gt(0,0,0,0);return{setMask:function(ye){Z!==ye&&!P&&(i.colorMask(ye,ye,ye,ye),Z=ye)},setLocked:function(ye){P=ye},setClear:function(ye,se,Be,Ie,ft){ft===!0&&(ye*=Ie,se*=Ie,Be*=Ie),le.set(ye,se,Be,Ie),fe.equals(le)===!1&&(i.clearColor(ye,se,Be,Ie),fe.copy(le))},reset:function(){P=!1,Z=null,fe.set(-1,0,0,0)}}}function n(){let P=!1,le=!1,Z=null,fe=null,ye=null;return{setReversed:function(se){if(le!==se){const Be=e.get("EXT_clip_control");se?Be.clipControlEXT(Be.LOWER_LEFT_EXT,Be.ZERO_TO_ONE_EXT):Be.clipControlEXT(Be.LOWER_LEFT_EXT,Be.NEGATIVE_ONE_TO_ONE_EXT),le=se;const Ie=ye;ye=null,this.setClear(Ie)}},getReversed:function(){return le},setTest:function(se){se?ne(i.DEPTH_TEST):Me(i.DEPTH_TEST)},setMask:function(se){Z!==se&&!P&&(i.depthMask(se),Z=se)},setFunc:function(se){if(le&&(se=hd[se]),fe!==se){switch(se){case ba:i.depthFunc(i.NEVER);break;case Ta:i.depthFunc(i.ALWAYS);break;case Aa:i.depthFunc(i.LESS);break;case vs:i.depthFunc(i.LEQUAL);break;case wa:i.depthFunc(i.EQUAL);break;case Ra:i.depthFunc(i.GEQUAL);break;case Ca:i.depthFunc(i.GREATER);break;case Pa:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}fe=se}},setLocked:function(se){P=se},setClear:function(se){ye!==se&&(ye=se,le&&(se=1-se),i.clearDepth(se))},reset:function(){P=!1,Z=null,fe=null,ye=null,le=!1}}}function s(){let P=!1,le=null,Z=null,fe=null,ye=null,se=null,Be=null,Ie=null,ft=null;return{setTest:function(ot){P||(ot?ne(i.STENCIL_TEST):Me(i.STENCIL_TEST))},setMask:function(ot){le!==ot&&!P&&(i.stencilMask(ot),le=ot)},setFunc:function(ot,Qt,ln){(Z!==ot||fe!==Qt||ye!==ln)&&(i.stencilFunc(ot,Qt,ln),Z=ot,fe=Qt,ye=ln)},setOp:function(ot,Qt,ln){(se!==ot||Be!==Qt||Ie!==ln)&&(i.stencilOp(ot,Qt,ln),se=ot,Be=Qt,Ie=ln)},setLocked:function(ot){P=ot},setClear:function(ot){ft!==ot&&(i.clearStencil(ot),ft=ot)},reset:function(){P=!1,le=null,Z=null,fe=null,ye=null,se=null,Be=null,Ie=null,ft=null}}}const r=new t,a=new n,o=new s,c=new WeakMap,l=new WeakMap;let h={},d={},u={},f=new WeakMap,g=[],S=null,m=!1,p=null,E=null,w=null,x=null,T=null,b=null,R=null,v=new We(0,0,0),y=0,N=!1,C=null,F=null,z=null,D=null,B=null;const Y=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,re=0;const $=i.getParameter(i.VERSION);$.indexOf("WebGL")!==-1?(re=parseFloat(/^WebGL (\d)/.exec($)[1]),X=re>=1):$.indexOf("OpenGL ES")!==-1&&(re=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),X=re>=2);let te=null,ie={};const Ne=i.getParameter(i.SCISSOR_BOX),we=i.getParameter(i.VIEWPORT),Qe=new gt().fromArray(Ne),Ze=new gt().fromArray(we);function tt(P,le,Z,fe){const ye=new Uint8Array(4),se=i.createTexture();i.bindTexture(P,se),i.texParameteri(P,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(P,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Be=0;Be<Z;Be++)P===i.TEXTURE_3D||P===i.TEXTURE_2D_ARRAY?i.texImage3D(le,0,i.RGBA,1,1,fe,0,i.RGBA,i.UNSIGNED_BYTE,ye):i.texImage2D(le+Be,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ye);return se}const Q={};Q[i.TEXTURE_2D]=tt(i.TEXTURE_2D,i.TEXTURE_2D,1),Q[i.TEXTURE_CUBE_MAP]=tt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Q[i.TEXTURE_2D_ARRAY]=tt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Q[i.TEXTURE_3D]=tt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ne(i.DEPTH_TEST),a.setFunc(vs),he(!1),de(fl),ne(i.CULL_FACE),oe(wn);function ne(P){h[P]!==!0&&(i.enable(P),h[P]=!0)}function Me(P){h[P]!==!1&&(i.disable(P),h[P]=!1)}function Ce(P,le){return u[P]!==le?(i.bindFramebuffer(P,le),u[P]=le,P===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=le),P===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=le),!0):!1}function be(P,le){let Z=g,fe=!1;if(P){Z=f.get(le),Z===void 0&&(Z=[],f.set(le,Z));const ye=P.textures;if(Z.length!==ye.length||Z[0]!==i.COLOR_ATTACHMENT0){for(let se=0,Be=ye.length;se<Be;se++)Z[se]=i.COLOR_ATTACHMENT0+se;Z.length=ye.length,fe=!0}}else Z[0]!==i.BACK&&(Z[0]=i.BACK,fe=!0);fe&&i.drawBuffers(Z)}function He(P){return S!==P?(i.useProgram(P),S=P,!0):!1}const at={[Li]:i.FUNC_ADD,[Lu]:i.FUNC_SUBTRACT,[Nu]:i.FUNC_REVERSE_SUBTRACT};at[Iu]=i.MIN,at[Du]=i.MAX;const j={[Uu]:i.ZERO,[Fu]:i.ONE,[Ou]:i.SRC_COLOR,[Kc]:i.SRC_ALPHA,[Hu]:i.SRC_ALPHA_SATURATE,[Gu]:i.DST_COLOR,[ku]:i.DST_ALPHA,[Bu]:i.ONE_MINUS_SRC_COLOR,[Zc]:i.ONE_MINUS_SRC_ALPHA,[Vu]:i.ONE_MINUS_DST_COLOR,[zu]:i.ONE_MINUS_DST_ALPHA,[Wu]:i.CONSTANT_COLOR,[Xu]:i.ONE_MINUS_CONSTANT_COLOR,[qu]:i.CONSTANT_ALPHA,[Yu]:i.ONE_MINUS_CONSTANT_ALPHA};function oe(P,le,Z,fe,ye,se,Be,Ie,ft,ot){if(P===wn){m===!0&&(Me(i.BLEND),m=!1);return}if(m===!1&&(ne(i.BLEND),m=!0),P!==Pu){if(P!==p||ot!==N){if((E!==Li||T!==Li)&&(i.blendEquation(i.FUNC_ADD),E=Li,T=Li),ot)switch(P){case cs:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case _s:i.blendFunc(i.ONE,i.ONE);break;case pl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ml:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:rt("WebGLState: Invalid blending: ",P);break}else switch(P){case cs:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case _s:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case pl:rt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ml:rt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:rt("WebGLState: Invalid blending: ",P);break}w=null,x=null,b=null,R=null,v.set(0,0,0),y=0,p=P,N=ot}return}ye=ye||le,se=se||Z,Be=Be||fe,(le!==E||ye!==T)&&(i.blendEquationSeparate(at[le],at[ye]),E=le,T=ye),(Z!==w||fe!==x||se!==b||Be!==R)&&(i.blendFuncSeparate(j[Z],j[fe],j[se],j[Be]),w=Z,x=fe,b=se,R=Be),(Ie.equals(v)===!1||ft!==y)&&(i.blendColor(Ie.r,Ie.g,Ie.b,ft),v.copy(Ie),y=ft),p=P,N=!1}function ce(P,le){P.side===fn?Me(i.CULL_FACE):ne(i.CULL_FACE);let Z=P.side===Ot;le&&(Z=!Z),he(Z),P.blending===cs&&P.transparent===!1?oe(wn):oe(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),a.setFunc(P.depthFunc),a.setTest(P.depthTest),a.setMask(P.depthWrite),r.setMask(P.colorWrite);const fe=P.stencilWrite;o.setTest(fe),fe&&(o.setMask(P.stencilWriteMask),o.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),o.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),Oe(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?ne(i.SAMPLE_ALPHA_TO_COVERAGE):Me(i.SAMPLE_ALPHA_TO_COVERAGE)}function he(P){C!==P&&(P?i.frontFace(i.CW):i.frontFace(i.CCW),C=P)}function de(P){P!==wu?(ne(i.CULL_FACE),P!==F&&(P===fl?i.cullFace(i.BACK):P===Ru?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Me(i.CULL_FACE),F=P}function ze(P){P!==z&&(X&&i.lineWidth(P),z=P)}function Oe(P,le,Z){P?(ne(i.POLYGON_OFFSET_FILL),(D!==le||B!==Z)&&(D=le,B=Z,a.getReversed()&&(le=-le),i.polygonOffset(le,Z))):Me(i.POLYGON_OFFSET_FILL)}function ke(P){P?ne(i.SCISSOR_TEST):Me(i.SCISSOR_TEST)}function qe(P){P===void 0&&(P=i.TEXTURE0+Y-1),te!==P&&(i.activeTexture(P),te=P)}function I(P,le,Z){Z===void 0&&(te===null?Z=i.TEXTURE0+Y-1:Z=te);let fe=ie[Z];fe===void 0&&(fe={type:void 0,texture:void 0},ie[Z]=fe),(fe.type!==P||fe.texture!==le)&&(te!==Z&&(i.activeTexture(Z),te=Z),i.bindTexture(P,le||Q[P]),fe.type=P,fe.texture=le)}function it(){const P=ie[te];P!==void 0&&P.type!==void 0&&(i.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function Je(){try{i.compressedTexImage2D(...arguments)}catch(P){rt("WebGLState:",P)}}function A(){try{i.compressedTexImage3D(...arguments)}catch(P){rt("WebGLState:",P)}}function _(){try{i.texSubImage2D(...arguments)}catch(P){rt("WebGLState:",P)}}function k(){try{i.texSubImage3D(...arguments)}catch(P){rt("WebGLState:",P)}}function H(){try{i.compressedTexSubImage2D(...arguments)}catch(P){rt("WebGLState:",P)}}function K(){try{i.compressedTexSubImage3D(...arguments)}catch(P){rt("WebGLState:",P)}}function ue(){try{i.texStorage2D(...arguments)}catch(P){rt("WebGLState:",P)}}function me(){try{i.texStorage3D(...arguments)}catch(P){rt("WebGLState:",P)}}function J(){try{i.texImage2D(...arguments)}catch(P){rt("WebGLState:",P)}}function ee(){try{i.texImage3D(...arguments)}catch(P){rt("WebGLState:",P)}}function ve(P){return d[P]!==void 0?d[P]:i.getParameter(P)}function De(P,le){d[P]!==le&&(i.pixelStorei(P,le),d[P]=le)}function xe(P){Qe.equals(P)===!1&&(i.scissor(P.x,P.y,P.z,P.w),Qe.copy(P))}function _e(P){Ze.equals(P)===!1&&(i.viewport(P.x,P.y,P.z,P.w),Ze.copy(P))}function Ue(P,le){let Z=l.get(le);Z===void 0&&(Z=new WeakMap,l.set(le,Z));let fe=Z.get(P);fe===void 0&&(fe=i.getUniformBlockIndex(le,P.name),Z.set(P,fe))}function Ge(P,le){const fe=l.get(le).get(P);c.get(le)!==fe&&(i.uniformBlockBinding(le,fe,P.__bindingPointIndex),c.set(le,fe))}function ae(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},d={},te=null,ie={},u={},f=new WeakMap,g=[],S=null,m=!1,p=null,E=null,w=null,x=null,T=null,b=null,R=null,v=new We(0,0,0),y=0,N=!1,C=null,F=null,z=null,D=null,B=null,Qe.set(0,0,i.canvas.width,i.canvas.height),Ze.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ne,disable:Me,bindFramebuffer:Ce,drawBuffers:be,useProgram:He,setBlending:oe,setMaterial:ce,setFlipSided:he,setCullFace:de,setLineWidth:ze,setPolygonOffset:Oe,setScissorTest:ke,activeTexture:qe,bindTexture:I,unbindTexture:it,compressedTexImage2D:Je,compressedTexImage3D:A,texImage2D:J,texImage3D:ee,pixelStorei:De,getParameter:ve,updateUBOMapping:Ue,uniformBlockBinding:Ge,texStorage2D:ue,texStorage3D:me,texSubImage2D:_,texSubImage3D:k,compressedTexSubImage2D:H,compressedTexSubImage3D:K,scissor:xe,viewport:_e,reset:ae}}function __(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new ge,h=new WeakMap,d=new Set;let u;const f=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(A,_){return g?new OffscreenCanvas(A,_):xr("canvas")}function m(A,_,k){let H=1;const K=Je(A);if((K.width>k||K.height>k)&&(H=k/Math.max(K.width,K.height)),H<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){const ue=Math.floor(H*K.width),me=Math.floor(H*K.height);u===void 0&&(u=S(ue,me));const J=_?S(ue,me):u;return J.width=ue,J.height=me,J.getContext("2d").drawImage(A,0,0,ue,me),Xe("WebGLRenderer: Texture has been resized from ("+K.width+"x"+K.height+") to ("+ue+"x"+me+")."),J}else return"data"in A&&Xe("WebGLRenderer: Image in DataTexture is too big ("+K.width+"x"+K.height+")."),A;return A}function p(A){return A.generateMipmaps}function E(A){i.generateMipmap(A)}function w(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function x(A,_,k,H,K,ue=!1){if(A!==null){if(i[A]!==void 0)return i[A];Xe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let me;H&&(me=e.get("EXT_texture_norm16"),me||Xe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let J=_;if(_===i.RED&&(k===i.FLOAT&&(J=i.R32F),k===i.HALF_FLOAT&&(J=i.R16F),k===i.UNSIGNED_BYTE&&(J=i.R8),k===i.UNSIGNED_SHORT&&me&&(J=me.R16_EXT),k===i.SHORT&&me&&(J=me.R16_SNORM_EXT)),_===i.RED_INTEGER&&(k===i.UNSIGNED_BYTE&&(J=i.R8UI),k===i.UNSIGNED_SHORT&&(J=i.R16UI),k===i.UNSIGNED_INT&&(J=i.R32UI),k===i.BYTE&&(J=i.R8I),k===i.SHORT&&(J=i.R16I),k===i.INT&&(J=i.R32I)),_===i.RG&&(k===i.FLOAT&&(J=i.RG32F),k===i.HALF_FLOAT&&(J=i.RG16F),k===i.UNSIGNED_BYTE&&(J=i.RG8),k===i.UNSIGNED_SHORT&&me&&(J=me.RG16_EXT),k===i.SHORT&&me&&(J=me.RG16_SNORM_EXT)),_===i.RG_INTEGER&&(k===i.UNSIGNED_BYTE&&(J=i.RG8UI),k===i.UNSIGNED_SHORT&&(J=i.RG16UI),k===i.UNSIGNED_INT&&(J=i.RG32UI),k===i.BYTE&&(J=i.RG8I),k===i.SHORT&&(J=i.RG16I),k===i.INT&&(J=i.RG32I)),_===i.RGB_INTEGER&&(k===i.UNSIGNED_BYTE&&(J=i.RGB8UI),k===i.UNSIGNED_SHORT&&(J=i.RGB16UI),k===i.UNSIGNED_INT&&(J=i.RGB32UI),k===i.BYTE&&(J=i.RGB8I),k===i.SHORT&&(J=i.RGB16I),k===i.INT&&(J=i.RGB32I)),_===i.RGBA_INTEGER&&(k===i.UNSIGNED_BYTE&&(J=i.RGBA8UI),k===i.UNSIGNED_SHORT&&(J=i.RGBA16UI),k===i.UNSIGNED_INT&&(J=i.RGBA32UI),k===i.BYTE&&(J=i.RGBA8I),k===i.SHORT&&(J=i.RGBA16I),k===i.INT&&(J=i.RGBA32I)),_===i.RGB&&(k===i.UNSIGNED_SHORT&&me&&(J=me.RGB16_EXT),k===i.SHORT&&me&&(J=me.RGB16_SNORM_EXT),k===i.UNSIGNED_INT_5_9_9_9_REV&&(J=i.RGB9_E5),k===i.UNSIGNED_INT_10F_11F_11F_REV&&(J=i.R11F_G11F_B10F)),_===i.RGBA){const ee=ue?vr:nt.getTransfer(K);k===i.FLOAT&&(J=i.RGBA32F),k===i.HALF_FLOAT&&(J=i.RGBA16F),k===i.UNSIGNED_BYTE&&(J=ee===ct?i.SRGB8_ALPHA8:i.RGBA8),k===i.UNSIGNED_SHORT&&me&&(J=me.RGBA16_EXT),k===i.SHORT&&me&&(J=me.RGBA16_SNORM_EXT),k===i.UNSIGNED_SHORT_4_4_4_4&&(J=i.RGBA4),k===i.UNSIGNED_SHORT_5_5_5_1&&(J=i.RGB5_A1)}return(J===i.R16F||J===i.R32F||J===i.RG16F||J===i.RG32F||J===i.RGBA16F||J===i.RGBA32F)&&e.get("EXT_color_buffer_float"),J}function T(A,_){let k;return A?_===null||_===_n||_===Ms?k=i.DEPTH24_STENCIL8:_===rn?k=i.DEPTH32F_STENCIL8:_===xs&&(k=i.DEPTH24_STENCIL8,Xe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===_n||_===Ms?k=i.DEPTH_COMPONENT24:_===rn?k=i.DEPTH_COMPONENT32F:_===xs&&(k=i.DEPTH_COMPONENT16),k}function b(A,_){return p(A)===!0||A.isFramebufferTexture&&A.minFilter!==At&&A.minFilter!==Lt?Math.log2(Math.max(_.width,_.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?_.mipmaps.length:1}function R(A){const _=A.target;_.removeEventListener("dispose",R),y(_),_.isVideoTexture&&h.delete(_),_.isHTMLTexture&&d.delete(_)}function v(A){const _=A.target;_.removeEventListener("dispose",v),C(_)}function y(A){const _=n.get(A);if(_.__webglInit===void 0)return;const k=A.source,H=f.get(k);if(H){const K=H[_.__cacheKey];K.usedTimes--,K.usedTimes===0&&N(A),Object.keys(H).length===0&&f.delete(k)}n.remove(A)}function N(A){const _=n.get(A);i.deleteTexture(_.__webglTexture);const k=A.source,H=f.get(k);delete H[_.__cacheKey],a.memory.textures--}function C(A){const _=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let H=0;H<6;H++){if(Array.isArray(_.__webglFramebuffer[H]))for(let K=0;K<_.__webglFramebuffer[H].length;K++)i.deleteFramebuffer(_.__webglFramebuffer[H][K]);else i.deleteFramebuffer(_.__webglFramebuffer[H]);_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer[H])}else{if(Array.isArray(_.__webglFramebuffer))for(let H=0;H<_.__webglFramebuffer.length;H++)i.deleteFramebuffer(_.__webglFramebuffer[H]);else i.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&i.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let H=0;H<_.__webglColorRenderbuffer.length;H++)_.__webglColorRenderbuffer[H]&&i.deleteRenderbuffer(_.__webglColorRenderbuffer[H]);_.__webglDepthRenderbuffer&&i.deleteRenderbuffer(_.__webglDepthRenderbuffer)}const k=A.textures;for(let H=0,K=k.length;H<K;H++){const ue=n.get(k[H]);ue.__webglTexture&&(i.deleteTexture(ue.__webglTexture),a.memory.textures--),n.remove(k[H])}n.remove(A)}let F=0;function z(){F=0}function D(){return F}function B(A){F=A}function Y(){const A=F;return A>=s.maxTextures&&Xe("WebGLTextures: Trying to use "+(A+1)+" texture units while this GPU supports only "+s.maxTextures),F+=1,A}function X(A){const _=[];return _.push(A.wrapS),_.push(A.wrapT),_.push(A.wrapR||0),_.push(A.magFilter),_.push(A.minFilter),_.push(A.anisotropy),_.push(A.internalFormat),_.push(A.format),_.push(A.type),_.push(A.generateMipmaps),_.push(A.premultiplyAlpha),_.push(A.flipY),_.push(A.unpackAlignment),_.push(A.colorSpace),_.join()}function re(A,_){const k=n.get(A);if(A.isVideoTexture&&I(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&k.__version!==A.version){const H=A.image;if(H===null)Xe("WebGLRenderer: Texture marked for update but no image data found.");else if(H.complete===!1)Xe("WebGLRenderer: Texture marked for update but image is incomplete");else{Me(k,A,_);return}}else A.isExternalTexture&&(k.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,k.__webglTexture,i.TEXTURE0+_)}function $(A,_){const k=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&k.__version!==A.version){Me(k,A,_);return}else A.isExternalTexture&&(k.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,k.__webglTexture,i.TEXTURE0+_)}function te(A,_){const k=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&k.__version!==A.version){Me(k,A,_);return}t.bindTexture(i.TEXTURE_3D,k.__webglTexture,i.TEXTURE0+_)}function ie(A,_){const k=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&k.__version!==A.version){Ce(k,A,_);return}t.bindTexture(i.TEXTURE_CUBE_MAP,k.__webglTexture,i.TEXTURE0+_)}const Ne={[La]:i.REPEAT,[An]:i.CLAMP_TO_EDGE,[Na]:i.MIRRORED_REPEAT},we={[At]:i.NEAREST,[Zu]:i.NEAREST_MIPMAP_NEAREST,[Ns]:i.NEAREST_MIPMAP_LINEAR,[Lt]:i.LINEAR,[Or]:i.LINEAR_MIPMAP_NEAREST,[ei]:i.LINEAR_MIPMAP_LINEAR},Qe={[ed]:i.NEVER,[rd]:i.ALWAYS,[td]:i.LESS,[Uo]:i.LEQUAL,[nd]:i.EQUAL,[Fo]:i.GEQUAL,[id]:i.GREATER,[sd]:i.NOTEQUAL};function Ze(A,_){if(_.type===rn&&e.has("OES_texture_float_linear")===!1&&(_.magFilter===Lt||_.magFilter===Or||_.magFilter===Ns||_.magFilter===ei||_.minFilter===Lt||_.minFilter===Or||_.minFilter===Ns||_.minFilter===ei)&&Xe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,Ne[_.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,Ne[_.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,Ne[_.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,we[_.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,we[_.minFilter]),_.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,Qe[_.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===At||_.minFilter!==Ns&&_.minFilter!==ei||_.type===rn&&e.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||n.get(_).__currentAnisotropy){const k=e.get("EXT_texture_filter_anisotropic");i.texParameterf(A,k.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,s.getMaxAnisotropy())),n.get(_).__currentAnisotropy=_.anisotropy}}}function tt(A,_){let k=!1;A.__webglInit===void 0&&(A.__webglInit=!0,_.addEventListener("dispose",R));const H=_.source;let K=f.get(H);K===void 0&&(K={},f.set(H,K));const ue=X(_);if(ue!==A.__cacheKey){K[ue]===void 0&&(K[ue]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,k=!0),K[ue].usedTimes++;const me=K[A.__cacheKey];me!==void 0&&(K[A.__cacheKey].usedTimes--,me.usedTimes===0&&N(_)),A.__cacheKey=ue,A.__webglTexture=K[ue].texture}return k}function Q(A,_,k){return Math.floor(Math.floor(A/k)/_)}function ne(A,_,k,H){const ue=A.updateRanges;if(ue.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,_.width,_.height,k,H,_.data);else{ue.sort((De,xe)=>De.start-xe.start);let me=0;for(let De=1;De<ue.length;De++){const xe=ue[me],_e=ue[De],Ue=xe.start+xe.count,Ge=Q(_e.start,_.width,4),ae=Q(xe.start,_.width,4);_e.start<=Ue+1&&Ge===ae&&Q(_e.start+_e.count-1,_.width,4)===Ge?xe.count=Math.max(xe.count,_e.start+_e.count-xe.start):(++me,ue[me]=_e)}ue.length=me+1;const J=t.getParameter(i.UNPACK_ROW_LENGTH),ee=t.getParameter(i.UNPACK_SKIP_PIXELS),ve=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,_.width);for(let De=0,xe=ue.length;De<xe;De++){const _e=ue[De],Ue=Math.floor(_e.start/4),Ge=Math.ceil(_e.count/4),ae=Ue%_.width,P=Math.floor(Ue/_.width),le=Ge,Z=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,ae),t.pixelStorei(i.UNPACK_SKIP_ROWS,P),t.texSubImage2D(i.TEXTURE_2D,0,ae,P,le,Z,k,H,_.data)}A.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,J),t.pixelStorei(i.UNPACK_SKIP_PIXELS,ee),t.pixelStorei(i.UNPACK_SKIP_ROWS,ve)}}function Me(A,_,k){let H=i.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(H=i.TEXTURE_2D_ARRAY),_.isData3DTexture&&(H=i.TEXTURE_3D);const K=tt(A,_),ue=_.source;t.bindTexture(H,A.__webglTexture,i.TEXTURE0+k);const me=n.get(ue);if(ue.version!==me.__version||K===!0){if(t.activeTexture(i.TEXTURE0+k),(typeof ImageBitmap<"u"&&_.image instanceof ImageBitmap)===!1){const Z=nt.getPrimaries(nt.workingColorSpace),fe=_.colorSpace===Xn?null:nt.getPrimaries(_.colorSpace),ye=_.colorSpace===Xn||Z===fe?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ye)}t.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment);let ee=m(_.image,!1,s.maxTextureSize);ee=it(_,ee);const ve=r.convert(_.format,_.colorSpace),De=r.convert(_.type);let xe=x(_.internalFormat,ve,De,_.normalized,_.colorSpace,_.isVideoTexture);Ze(H,_);let _e;const Ue=_.mipmaps,Ge=_.isVideoTexture!==!0,ae=me.__version===void 0||K===!0,P=ue.dataReady,le=b(_,ee);if(_.isDepthTexture)xe=T(_.format===ti,_.type),ae&&(Ge?t.texStorage2D(i.TEXTURE_2D,1,xe,ee.width,ee.height):t.texImage2D(i.TEXTURE_2D,0,xe,ee.width,ee.height,0,ve,De,null));else if(_.isDataTexture)if(Ue.length>0){Ge&&ae&&t.texStorage2D(i.TEXTURE_2D,le,xe,Ue[0].width,Ue[0].height);for(let Z=0,fe=Ue.length;Z<fe;Z++)_e=Ue[Z],Ge?P&&t.texSubImage2D(i.TEXTURE_2D,Z,0,0,_e.width,_e.height,ve,De,_e.data):t.texImage2D(i.TEXTURE_2D,Z,xe,_e.width,_e.height,0,ve,De,_e.data);_.generateMipmaps=!1}else Ge?(ae&&t.texStorage2D(i.TEXTURE_2D,le,xe,ee.width,ee.height),P&&ne(_,ee,ve,De)):t.texImage2D(i.TEXTURE_2D,0,xe,ee.width,ee.height,0,ve,De,ee.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Ge&&ae&&t.texStorage3D(i.TEXTURE_2D_ARRAY,le,xe,Ue[0].width,Ue[0].height,ee.depth);for(let Z=0,fe=Ue.length;Z<fe;Z++)if(_e=Ue[Z],_.format!==an)if(ve!==null)if(Ge){if(P)if(_.layerUpdates.size>0){const ye=$l(_e.width,_e.height,_.format,_.type);for(const se of _.layerUpdates){const Be=_e.data.subarray(se*ye/_e.data.BYTES_PER_ELEMENT,(se+1)*ye/_e.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,se,_e.width,_e.height,1,ve,Be)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,0,_e.width,_e.height,ee.depth,ve,_e.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Z,xe,_e.width,_e.height,ee.depth,0,_e.data,0,0);else Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ge?P&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,Z,0,0,0,_e.width,_e.height,ee.depth,ve,De,_e.data):t.texImage3D(i.TEXTURE_2D_ARRAY,Z,xe,_e.width,_e.height,ee.depth,0,ve,De,_e.data);_.layerUpdates.size>0&&_.clearLayerUpdates()}else{Ge&&ae&&t.texStorage2D(i.TEXTURE_2D,le,xe,Ue[0].width,Ue[0].height);for(let Z=0,fe=Ue.length;Z<fe;Z++)_e=Ue[Z],_.format!==an?ve!==null?Ge?P&&t.compressedTexSubImage2D(i.TEXTURE_2D,Z,0,0,_e.width,_e.height,ve,_e.data):t.compressedTexImage2D(i.TEXTURE_2D,Z,xe,_e.width,_e.height,0,_e.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ge?P&&t.texSubImage2D(i.TEXTURE_2D,Z,0,0,_e.width,_e.height,ve,De,_e.data):t.texImage2D(i.TEXTURE_2D,Z,xe,_e.width,_e.height,0,ve,De,_e.data)}else if(_.isDataArrayTexture)if(Ge){if(ae&&t.texStorage3D(i.TEXTURE_2D_ARRAY,le,xe,ee.width,ee.height,ee.depth),P)if(_.layerUpdates.size>0){const Z=$l(ee.width,ee.height,_.format,_.type);for(const fe of _.layerUpdates){const ye=ee.data.subarray(fe*Z/ee.data.BYTES_PER_ELEMENT,(fe+1)*Z/ee.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,fe,ee.width,ee.height,1,ve,De,ye)}_.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ee.width,ee.height,ee.depth,ve,De,ee.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,xe,ee.width,ee.height,ee.depth,0,ve,De,ee.data);else if(_.isData3DTexture)Ge?(ae&&t.texStorage3D(i.TEXTURE_3D,le,xe,ee.width,ee.height,ee.depth),P&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ee.width,ee.height,ee.depth,ve,De,ee.data)):t.texImage3D(i.TEXTURE_3D,0,xe,ee.width,ee.height,ee.depth,0,ve,De,ee.data);else if(_.isFramebufferTexture){if(ae)if(Ge)t.texStorage2D(i.TEXTURE_2D,le,xe,ee.width,ee.height);else{let Z=ee.width,fe=ee.height;for(let ye=0;ye<le;ye++)t.texImage2D(i.TEXTURE_2D,ye,xe,Z,fe,0,ve,De,null),Z>>=1,fe>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in i){const Z=i.canvas;if(Z.hasAttribute("layoutsubtree")||Z.setAttribute("layoutsubtree","true"),ee.parentNode!==Z){Z.appendChild(ee),d.add(_),Z.onpaint=fe=>{const ye=fe.changedElements;for(const se of d)ye.includes(se.image)&&(se.needsUpdate=!0)},Z.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,ee);else{const ye=i.RGBA,se=i.RGBA,Be=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,ye,se,Be,ee)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Ue.length>0){if(Ge&&ae){const Z=Je(Ue[0]);t.texStorage2D(i.TEXTURE_2D,le,xe,Z.width,Z.height)}for(let Z=0,fe=Ue.length;Z<fe;Z++)_e=Ue[Z],Ge?P&&t.texSubImage2D(i.TEXTURE_2D,Z,0,0,ve,De,_e):t.texImage2D(i.TEXTURE_2D,Z,xe,ve,De,_e);_.generateMipmaps=!1}else if(Ge){if(ae){const Z=Je(ee);t.texStorage2D(i.TEXTURE_2D,le,xe,Z.width,Z.height)}P&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,ve,De,ee)}else t.texImage2D(i.TEXTURE_2D,0,xe,ve,De,ee);p(_)&&E(H),me.__version=ue.version,_.onUpdate&&_.onUpdate(_)}A.__version=_.version}function Ce(A,_,k){if(_.image.length!==6)return;const H=tt(A,_),K=_.source;t.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+k);const ue=n.get(K);if(K.version!==ue.__version||H===!0){t.activeTexture(i.TEXTURE0+k);const me=nt.getPrimaries(nt.workingColorSpace),J=_.colorSpace===Xn?null:nt.getPrimaries(_.colorSpace),ee=_.colorSpace===Xn||me===J?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ee);const ve=_.isCompressedTexture||_.image[0].isCompressedTexture,De=_.image[0]&&_.image[0].isDataTexture,xe=[];for(let se=0;se<6;se++)!ve&&!De?xe[se]=m(_.image[se],!0,s.maxCubemapSize):xe[se]=De?_.image[se].image:_.image[se],xe[se]=it(_,xe[se]);const _e=xe[0],Ue=r.convert(_.format,_.colorSpace),Ge=r.convert(_.type),ae=x(_.internalFormat,Ue,Ge,_.normalized,_.colorSpace),P=_.isVideoTexture!==!0,le=ue.__version===void 0||H===!0,Z=K.dataReady;let fe=b(_,_e);Ze(i.TEXTURE_CUBE_MAP,_);let ye;if(ve){P&&le&&t.texStorage2D(i.TEXTURE_CUBE_MAP,fe,ae,_e.width,_e.height);for(let se=0;se<6;se++){ye=xe[se].mipmaps;for(let Be=0;Be<ye.length;Be++){const Ie=ye[Be];_.format!==an?Ue!==null?P?Z&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be,0,0,Ie.width,Ie.height,Ue,Ie.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be,ae,Ie.width,Ie.height,0,Ie.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):P?Z&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be,0,0,Ie.width,Ie.height,Ue,Ge,Ie.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be,ae,Ie.width,Ie.height,0,Ue,Ge,Ie.data)}}}else{if(ye=_.mipmaps,P&&le){ye.length>0&&fe++;const se=Je(xe[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,fe,ae,se.width,se.height)}for(let se=0;se<6;se++)if(De){P?Z&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,xe[se].width,xe[se].height,Ue,Ge,xe[se].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ae,xe[se].width,xe[se].height,0,Ue,Ge,xe[se].data);for(let Be=0;Be<ye.length;Be++){const ft=ye[Be].image[se].image;P?Z&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be+1,0,0,ft.width,ft.height,Ue,Ge,ft.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be+1,ae,ft.width,ft.height,0,Ue,Ge,ft.data)}}else{P?Z&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,0,0,Ue,Ge,xe[se]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,0,ae,Ue,Ge,xe[se]);for(let Be=0;Be<ye.length;Be++){const Ie=ye[Be];P?Z&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be+1,0,0,Ue,Ge,Ie.image[se]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+se,Be+1,ae,Ue,Ge,Ie.image[se])}}}p(_)&&E(i.TEXTURE_CUBE_MAP),ue.__version=K.version,_.onUpdate&&_.onUpdate(_)}A.__version=_.version}function be(A,_,k,H,K,ue){const me=r.convert(k.format,k.colorSpace),J=r.convert(k.type),ee=x(k.internalFormat,me,J,k.normalized,k.colorSpace),ve=n.get(_),De=n.get(k);if(De.__renderTarget=_,!ve.__hasExternalTextures){const xe=Math.max(1,_.width>>ue),_e=Math.max(1,_.height>>ue);K===i.TEXTURE_3D||K===i.TEXTURE_2D_ARRAY?t.texImage3D(K,ue,ee,xe,_e,_.depth,0,me,J,null):t.texImage2D(K,ue,ee,xe,_e,0,me,J,null)}t.bindFramebuffer(i.FRAMEBUFFER,A),qe(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,H,K,De.__webglTexture,0,ke(_)):(K===i.TEXTURE_2D||K>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&K<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,H,K,De.__webglTexture,ue),t.bindFramebuffer(i.FRAMEBUFFER,null)}function He(A,_,k){if(i.bindRenderbuffer(i.RENDERBUFFER,A),_.depthBuffer){const H=_.depthTexture,K=H&&H.isDepthTexture?H.type:null,ue=T(_.stencilBuffer,K),me=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;qe(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ke(_),ue,_.width,_.height):k?i.renderbufferStorageMultisample(i.RENDERBUFFER,ke(_),ue,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,ue,_.width,_.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,me,i.RENDERBUFFER,A)}else{const H=_.textures;for(let K=0;K<H.length;K++){const ue=H[K],me=r.convert(ue.format,ue.colorSpace),J=r.convert(ue.type),ee=x(ue.internalFormat,me,J,ue.normalized,ue.colorSpace);qe(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ke(_),ee,_.width,_.height):k?i.renderbufferStorageMultisample(i.RENDERBUFFER,ke(_),ee,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,ee,_.width,_.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function at(A,_,k){const H=_.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,A),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const K=n.get(_.depthTexture);if(K.__renderTarget=_,(!K.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),H){if(K.__webglInit===void 0&&(K.__webglInit=!0,_.depthTexture.addEventListener("dispose",R)),K.__webglTexture===void 0){K.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),Ze(i.TEXTURE_CUBE_MAP,_.depthTexture);const ve=r.convert(_.depthTexture.format),De=r.convert(_.depthTexture.type);let xe;_.depthTexture.format===Cn?xe=i.DEPTH_COMPONENT24:_.depthTexture.format===ti&&(xe=i.DEPTH24_STENCIL8);for(let _e=0;_e<6;_e++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+_e,0,xe,_.width,_.height,0,ve,De,null)}}else re(_.depthTexture,0);const ue=K.__webglTexture,me=ke(_),J=H?i.TEXTURE_CUBE_MAP_POSITIVE_X+k:i.TEXTURE_2D,ee=_.depthTexture.format===ti?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(_.depthTexture.format===Cn)qe(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ee,J,ue,0,me):i.framebufferTexture2D(i.FRAMEBUFFER,ee,J,ue,0);else if(_.depthTexture.format===ti)qe(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ee,J,ue,0,me):i.framebufferTexture2D(i.FRAMEBUFFER,ee,J,ue,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function j(A){const _=n.get(A),k=A.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==A.depthTexture){const H=A.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),H){const K=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,H.removeEventListener("dispose",K)};H.addEventListener("dispose",K),_.__depthDisposeCallback=K}_.__boundDepthTexture=H}if(A.depthTexture&&!_.__autoAllocateDepthBuffer)if(k)for(let H=0;H<6;H++)at(_.__webglFramebuffer[H],A,H);else{const H=A.texture.mipmaps;H&&H.length>0?at(_.__webglFramebuffer[0],A,0):at(_.__webglFramebuffer,A,0)}else if(k){_.__webglDepthbuffer=[];for(let H=0;H<6;H++)if(t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[H]),_.__webglDepthbuffer[H]===void 0)_.__webglDepthbuffer[H]=i.createRenderbuffer(),He(_.__webglDepthbuffer[H],A,!1);else{const K=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ue=_.__webglDepthbuffer[H];i.bindRenderbuffer(i.RENDERBUFFER,ue),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,ue)}}else{const H=A.texture.mipmaps;if(H&&H.length>0?t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=i.createRenderbuffer(),He(_.__webglDepthbuffer,A,!1);else{const K=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ue=_.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ue),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,ue)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function oe(A,_,k){const H=n.get(A);_!==void 0&&be(H.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),k!==void 0&&j(A)}function ce(A){const _=A.texture,k=n.get(A),H=n.get(_);A.addEventListener("dispose",v);const K=A.textures,ue=A.isWebGLCubeRenderTarget===!0,me=K.length>1;if(me||(H.__webglTexture===void 0&&(H.__webglTexture=i.createTexture()),H.__version=_.version,a.memory.textures++),ue){k.__webglFramebuffer=[];for(let J=0;J<6;J++)if(_.mipmaps&&_.mipmaps.length>0){k.__webglFramebuffer[J]=[];for(let ee=0;ee<_.mipmaps.length;ee++)k.__webglFramebuffer[J][ee]=i.createFramebuffer()}else k.__webglFramebuffer[J]=i.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){k.__webglFramebuffer=[];for(let J=0;J<_.mipmaps.length;J++)k.__webglFramebuffer[J]=i.createFramebuffer()}else k.__webglFramebuffer=i.createFramebuffer();if(me)for(let J=0,ee=K.length;J<ee;J++){const ve=n.get(K[J]);ve.__webglTexture===void 0&&(ve.__webglTexture=i.createTexture(),a.memory.textures++)}if(A.samples>0&&qe(A)===!1){k.__webglMultisampledFramebuffer=i.createFramebuffer(),k.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,k.__webglMultisampledFramebuffer);for(let J=0;J<K.length;J++){const ee=K[J];k.__webglColorRenderbuffer[J]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,k.__webglColorRenderbuffer[J]);const ve=r.convert(ee.format,ee.colorSpace),De=r.convert(ee.type),xe=x(ee.internalFormat,ve,De,ee.normalized,ee.colorSpace,A.isXRRenderTarget===!0),_e=ke(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,_e,xe,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+J,i.RENDERBUFFER,k.__webglColorRenderbuffer[J])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(k.__webglDepthRenderbuffer=i.createRenderbuffer(),He(k.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ue){t.bindTexture(i.TEXTURE_CUBE_MAP,H.__webglTexture),Ze(i.TEXTURE_CUBE_MAP,_);for(let J=0;J<6;J++)if(_.mipmaps&&_.mipmaps.length>0)for(let ee=0;ee<_.mipmaps.length;ee++)be(k.__webglFramebuffer[J][ee],A,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+J,ee);else be(k.__webglFramebuffer[J],A,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0);p(_)&&E(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(me){for(let J=0,ee=K.length;J<ee;J++){const ve=K[J],De=n.get(ve);let xe=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(xe=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(xe,De.__webglTexture),Ze(xe,ve),be(k.__webglFramebuffer,A,ve,i.COLOR_ATTACHMENT0+J,xe,0),p(ve)&&E(xe)}t.unbindTexture()}else{let J=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(J=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(J,H.__webglTexture),Ze(J,_),_.mipmaps&&_.mipmaps.length>0)for(let ee=0;ee<_.mipmaps.length;ee++)be(k.__webglFramebuffer[ee],A,_,i.COLOR_ATTACHMENT0,J,ee);else be(k.__webglFramebuffer,A,_,i.COLOR_ATTACHMENT0,J,0);p(_)&&E(J),t.unbindTexture()}A.depthBuffer&&j(A)}function he(A){const _=A.textures;for(let k=0,H=_.length;k<H;k++){const K=_[k];if(p(K)){const ue=w(A),me=n.get(K).__webglTexture;t.bindTexture(ue,me),E(ue),t.unbindTexture()}}}const de=[],ze=[];function Oe(A){if(A.samples>0){if(qe(A)===!1){const _=A.textures,k=A.width,H=A.height;let K=i.COLOR_BUFFER_BIT;const ue=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,me=n.get(A),J=_.length>1;if(J)for(let ve=0;ve<_.length;ve++)t.bindFramebuffer(i.FRAMEBUFFER,me.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,me.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,me.__webglMultisampledFramebuffer);const ee=A.texture.mipmaps;ee&&ee.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,me.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,me.__webglFramebuffer);for(let ve=0;ve<_.length;ve++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(K|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(K|=i.STENCIL_BUFFER_BIT)),J){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,me.__webglColorRenderbuffer[ve]);const De=n.get(_[ve]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,De,0)}i.blitFramebuffer(0,0,k,H,0,0,k,H,K,i.NEAREST),c===!0&&(de.length=0,ze.length=0,de.push(i.COLOR_ATTACHMENT0+ve),A.depthBuffer&&A.storeMultisampledDepthBuffer===!1&&(de.push(ue),ze.push(ue),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,ze)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,de))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),J)for(let ve=0;ve<_.length;ve++){t.bindFramebuffer(i.FRAMEBUFFER,me.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.RENDERBUFFER,me.__webglColorRenderbuffer[ve]);const De=n.get(_[ve]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,me.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ve,i.TEXTURE_2D,De,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,me.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.storeMultisampledDepthBuffer===!1&&c){const _=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[_])}}}function ke(A){return Math.min(s.maxSamples,A.samples)}function qe(A){const _=n.get(A);return A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function I(A){const _=a.render.frame;h.get(A)!==_&&(h.set(A,_),A.update())}function it(A,_){const k=A.colorSpace,H=A.format,K=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||k!==_r&&k!==Xn&&(nt.getTransfer(k)===ct?(H!==an||K!==Yt)&&Xe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):rt("WebGLTextures: Unsupported texture color space:",k)),_}function Je(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(l.width=A.naturalWidth||A.width,l.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(l.width=A.displayWidth,l.height=A.displayHeight):(l.width=A.width,l.height=A.height),l}this.allocateTextureUnit=Y,this.resetTextureUnits=z,this.getTextureUnits=D,this.setTextureUnits=B,this.setTexture2D=re,this.setTexture2DArray=$,this.setTexture3D=te,this.setTextureCube=ie,this.rebindTextures=oe,this.setupRenderTarget=ce,this.updateRenderTargetMipmap=he,this.updateMultisampleRenderTarget=Oe,this.setupDepthRenderbuffer=j,this.setupFrameBufferTexture=be,this.useMultisampledRTT=qe,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function v_(i,e){function t(n,s=Xn){let r;const a=nt.getTransfer(s);if(n===Yt)return i.UNSIGNED_BYTE;if(n===Co)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Po)return i.UNSIGNED_SHORT_5_5_5_1;if(n===ah)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===oh)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===sh)return i.BYTE;if(n===rh)return i.SHORT;if(n===xs)return i.UNSIGNED_SHORT;if(n===Ro)return i.INT;if(n===_n)return i.UNSIGNED_INT;if(n===rn)return i.FLOAT;if(n===vn)return i.HALF_FLOAT;if(n===lh)return i.ALPHA;if(n===ch)return i.RGB;if(n===an)return i.RGBA;if(n===Cn)return i.DEPTH_COMPONENT;if(n===ti)return i.DEPTH_STENCIL;if(n===Lo)return i.RED;if(n===No)return i.RED_INTEGER;if(n===ai)return i.RG;if(n===Io)return i.RG_INTEGER;if(n===Do)return i.RGBA_INTEGER;if(n===or||n===lr||n===cr||n===hr)if(a===ct)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===or)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===lr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===cr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===hr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===or)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===lr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===cr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===hr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ia||n===Da||n===Ua||n===Fa)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Ia)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Da)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ua)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Fa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Oa||n===Ba||n===ka||n===za||n===Ga||n===pr||n===Va)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Oa||n===Ba)return a===ct?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===ka)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===za)return r.COMPRESSED_R11_EAC;if(n===Ga)return r.COMPRESSED_SIGNED_R11_EAC;if(n===pr)return r.COMPRESSED_RG11_EAC;if(n===Va)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Ha||n===Wa||n===Xa||n===qa||n===Ya||n===$a||n===Ka||n===Za||n===Ja||n===Qa||n===ja||n===eo||n===to||n===no)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ha)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Wa)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Xa)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===qa)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ya)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===$a)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Ka)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Za)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ja)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Qa)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ja)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===eo)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===to)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===no)return a===ct?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===io||n===so||n===ro)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===io)return a===ct?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===so)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ro)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ao||n===oo||n===mr||n===lo)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===ao)return r.COMPRESSED_RED_RGTC1_EXT;if(n===oo)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===mr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===lo)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ms?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const x_=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,M_=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class S_{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new xh(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Kt({vertexShader:x_,fragmentShader:M_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new vt(new Cs(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class y_ extends li{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",c=1,l=null,h=null,d=null,u=null,f=null,g=null;const S=typeof XRWebGLBinding<"u",m=new S_,p={},E=t.getContextAttributes();let w=null,x=null;const T=[],b=[],R=new ge;let v=null,y=null;const N=new Gt;N.viewport=new gt;const C=new Gt;C.viewport=new gt;const F=[N,C],z=new Pf;let D=null,B=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Q){let ne=T[Q];return ne===void 0&&(ne=new qr,T[Q]=ne),ne.getTargetRaySpace()},this.getControllerGrip=function(Q){let ne=T[Q];return ne===void 0&&(ne=new qr,T[Q]=ne),ne.getGripSpace()},this.getHand=function(Q){let ne=T[Q];return ne===void 0&&(ne=new qr,T[Q]=ne),ne.getHandSpace()};function Y(Q){const ne=b.indexOf(Q.inputSource);if(ne===-1)return;const Me=T[ne];Me!==void 0&&(Me.update(Q.inputSource,Q.frame,l||a),Me.dispatchEvent({type:Q.type,data:Q.inputSource}))}function X(){s.removeEventListener("select",Y),s.removeEventListener("selectstart",Y),s.removeEventListener("selectend",Y),s.removeEventListener("squeeze",Y),s.removeEventListener("squeezestart",Y),s.removeEventListener("squeezeend",Y),s.removeEventListener("end",X),s.removeEventListener("inputsourceschange",re);for(let Q=0;Q<T.length;Q++){const ne=b[Q];ne!==null&&(b[Q]=null,T[Q].disconnect(ne))}D=null,B=null,m.reset();for(const Q in p)delete p[Q];if(e.setRenderTarget(w),f=null,u=null,d=null,s=null,x=null,tt.stop(),n.isPresenting=!1,e.setPixelRatio(v),e.setSize(R.width,R.height,!1),y!==null){const Q=y.camera;Q.fov=y.fov,Q.zoom=y.zoom,Q.updateProjectionMatrix(),y=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Q){r=Q,n.isPresenting===!0&&Xe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Q){o=Q,n.isPresenting===!0&&Xe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||a},this.setReferenceSpace=function(Q){l=Q},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&S&&(d=new XRWebGLBinding(s,t)),d},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Q){if(s=Q,s!==null){if(w=e.getRenderTarget(),s.addEventListener("select",Y),s.addEventListener("selectstart",Y),s.addEventListener("selectend",Y),s.addEventListener("squeeze",Y),s.addEventListener("squeezestart",Y),s.addEventListener("squeezeend",Y),s.addEventListener("end",X),s.addEventListener("inputsourceschange",re),E.xrCompatible!==!0&&await t.makeXRCompatible(),v=e.getPixelRatio(),e.getSize(R),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let Me=null,Ce=null,be=null;E.depth&&(be=E.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Me=E.stencil?ti:Cn,Ce=E.stencil?Ms:_n);const He={colorFormat:t.RGBA8,depthFormat:be,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(He),s.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),x=new on(u.textureWidth,u.textureHeight,{format:an,type:Yt,depthTexture:new Es(u.textureWidth,u.textureHeight,Ce,void 0,void 0,void 0,void 0,void 0,void 0,Me),stencilBuffer:E.stencil,colorSpace:e.outputColorSpace,samples:E.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{const Me={antialias:E.antialias,alpha:!0,depth:E.depth,stencil:E.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,Me),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new on(f.framebufferWidth,f.framebufferHeight,{format:an,type:Yt,colorSpace:e.outputColorSpace,stencilBuffer:E.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(c),l=null,a=await s.requestReferenceSpace(o),tt.setContext(s),tt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function re(Q){for(let ne=0;ne<Q.removed.length;ne++){const Me=Q.removed[ne],Ce=b.indexOf(Me);Ce>=0&&(b[Ce]=null,T[Ce].disconnect(Me))}for(let ne=0;ne<Q.added.length;ne++){const Me=Q.added[ne];let Ce=b.indexOf(Me);if(Ce===-1){for(let He=0;He<T.length;He++)if(He>=b.length){b.push(Me),Ce=He;break}else if(b[He]===null){b[He]=Me,Ce=He;break}if(Ce===-1)break}const be=T[Ce];be&&be.connect(Me)}}const $=new L,te=new L;function ie(Q,ne,Me){$.setFromMatrixPosition(ne.matrixWorld),te.setFromMatrixPosition(Me.matrixWorld);const Ce=$.distanceTo(te),be=ne.projectionMatrix.elements,He=Me.projectionMatrix.elements,at=be[14]/(be[10]-1),j=be[14]/(be[10]+1),oe=(be[9]+1)/be[5],ce=(be[9]-1)/be[5],he=(be[8]-1)/be[0],de=(He[8]+1)/He[0],ze=at*he,Oe=at*de,ke=Ce/(-he+de),qe=ke*-he;if(ne.matrixWorld.decompose(Q.position,Q.quaternion,Q.scale),Q.translateX(qe),Q.translateZ(ke),Q.matrixWorld.compose(Q.position,Q.quaternion,Q.scale),Q.matrixWorldInverse.copy(Q.matrixWorld).invert(),be[10]===-1)Q.projectionMatrix.copy(ne.projectionMatrix),Q.projectionMatrixInverse.copy(ne.projectionMatrixInverse);else{const I=at+ke,it=j+ke,Je=ze-qe,A=Oe+(Ce-qe),_=oe*j/it*I,k=ce*j/it*I;Q.projectionMatrix.makePerspective(Je,A,_,k,I,it),Q.projectionMatrixInverse.copy(Q.projectionMatrix).invert()}}function Ne(Q,ne){ne===null?Q.matrixWorld.copy(Q.matrix):Q.matrixWorld.multiplyMatrices(ne.matrixWorld,Q.matrix),Q.matrixWorldInverse.copy(Q.matrixWorld).invert()}this.updateCamera=function(Q){if(s===null)return;let ne=Q.near,Me=Q.far;m.texture!==null&&(m.depthNear>0&&(ne=m.depthNear),m.depthFar>0&&(Me=m.depthFar)),z.near=C.near=N.near=ne,z.far=C.far=N.far=Me,(D!==z.near||B!==z.far)&&(s.updateRenderState({depthNear:z.near,depthFar:z.far}),D=z.near,B=z.far),z.layers.mask=Q.layers.mask|6,N.layers.mask=z.layers.mask&-5,C.layers.mask=z.layers.mask&-3;const Ce=Q.parent,be=z.cameras;Ne(z,Ce);for(let He=0;He<be.length;He++)Ne(be[He],Ce);be.length===2?ie(z,N,C):z.projectionMatrix.copy(N.projectionMatrix),y===null&&Q.isPerspectiveCamera&&(y={camera:Q,fov:Q.fov,zoom:Q.zoom}),we(Q,z,Ce)};function we(Q,ne,Me){Me===null?Q.matrix.copy(ne.matrixWorld):(Q.matrix.copy(Me.matrixWorld),Q.matrix.invert(),Q.matrix.multiply(ne.matrixWorld)),Q.matrix.decompose(Q.position,Q.quaternion,Q.scale),Q.updateMatrixWorld(!0),Q.projectionMatrix.copy(ne.projectionMatrix),Q.projectionMatrixInverse.copy(ne.projectionMatrixInverse),Q.isPerspectiveCamera&&(Q.fov=co*2*Math.atan(1/Q.projectionMatrix.elements[5]),Q.zoom=1)}this.getCamera=function(){return z},this.getFoveation=function(){if(!(u===null&&f===null))return c},this.setFoveation=function(Q){c=Q,u!==null&&(u.fixedFoveation=Q),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Q)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(z)},this.getCameraTexture=function(Q){return p[Q]};let Qe=null;function Ze(Q,ne){if(h=ne.getViewerPose(l||a),g=ne,h!==null){const Me=h.views;f!==null&&(e.setRenderTargetFramebuffer(x,f.framebuffer),e.setRenderTarget(x));let Ce=!1;Me.length!==z.cameras.length&&(z.cameras.length=0,Ce=!0);for(let j=0;j<Me.length;j++){const oe=Me[j];let ce=null;if(f!==null)ce=f.getViewport(oe);else{const de=d.getViewSubImage(u,oe);ce=de.viewport,j===0&&(e.setRenderTargetTextures(x,de.colorTexture,de.depthStencilTexture),e.setRenderTarget(x))}let he=F[j];he===void 0&&(he=new Gt,he.layers.enable(j),he.viewport=new gt,F[j]=he),he.matrix.fromArray(oe.transform.matrix),he.matrix.decompose(he.position,he.quaternion,he.scale),he.projectionMatrix.fromArray(oe.projectionMatrix),he.projectionMatrixInverse.copy(he.projectionMatrix).invert(),he.viewport.set(ce.x,ce.y,ce.width,ce.height),j===0&&(z.matrix.copy(he.matrix),z.matrix.decompose(z.position,z.quaternion,z.scale)),Ce===!0&&z.cameras.push(he)}const be=s.enabledFeatures;if(be&&be.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){d=n.getBinding();const j=d.getDepthInformation(Me[0]);j&&j.isValid&&j.texture&&m.init(j,s.renderState)}if(be&&be.includes("camera-access")&&S){e.state.unbindTexture(),d=n.getBinding();for(let j=0;j<Me.length;j++){const oe=Me[j].camera;if(oe){let ce=p[oe];ce||(ce=new xh,p[oe]=ce);const he=d.getCameraImage(oe);ce.sourceTexture=he}}}}for(let Me=0;Me<T.length;Me++){const Ce=b[Me],be=T[Me];Ce!==null&&be!==void 0&&be.update(Ce,ne,l||a)}Qe&&Qe(Q,ne),ne.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ne}),g=null}const tt=new Nh;tt.setAnimationLoop(Ze),this.setAnimationLoop=function(Q){Qe=Q},this.dispose=function(){}}}const E_=new ht,kh=new Ye;kh.set(-1,0,0,0,1,0,0,0,1);function b_(i,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Ch(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,E,w,x){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(m,p):p.isMeshLambertMaterial?(r(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(m,p),d(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(m,p),u(m,p),p.isMeshPhysicalMaterial&&f(m,p,x)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),S(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?c(m,p,E,w):p.isSpriteMaterial?l(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const E=e.get(p),w=E.envMap,x=E.envMapRotation;w&&(m.envMap.value=w,m.envMapRotation.value.setFromMatrix4(E_.makeRotationFromEuler(x)).transpose(),w.isCubeTexture&&w.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(kh),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function c(m,p,E,w){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*E,m.scale.value=w*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function l(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function d(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function u(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,E){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Ot&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.retroreflectivity>0&&(m.retroreflectivity.value=p.retroreflectivity),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=E.texture,m.transmissionSamplerSize.value.set(E.width,E.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function S(m,p){const E=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(E.matrixWorld),m.nearDistance.value=E.shadow.camera.near,m.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function T_(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(x,T){const b=T.program;n.uniformBlockBinding(x,b)}function l(x,T){let b=s[x.id];b===void 0&&(m(x),b=h(x),s[x.id]=b,x.addEventListener("dispose",E));const R=T.program;n.updateUBOMapping(x,R);const v=e.render.frame;r[x.id]!==v&&(u(x),r[x.id]=v)}function h(x){const T=d();x.__bindingPointIndex=T;const b=i.createBuffer(),R=x.__size,v=x.usage;return i.bindBuffer(i.UNIFORM_BUFFER,b),i.bufferData(i.UNIFORM_BUFFER,R,v),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,T,b),b}function d(){for(let x=0;x<o;x++)if(a.indexOf(x)===-1)return a.push(x),x;return rt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(x){const T=s[x.id],b=x.uniforms,R=x.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let v=0,y=b.length;v<y;v++){const N=b[v];if(Array.isArray(N))for(let C=0,F=N.length;C<F;C++)f(N[C],v,C,R);else f(N,v,0,R)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(x,T,b,R){if(S(x,T,b,R)===!0){const v=x.__offset,y=x.value;if(Array.isArray(y)){let N=0;for(let C=0;C<y.length;C++){const F=y[C],z=p(F);g(F,x.__data,N),typeof F!="number"&&typeof F!="boolean"&&!F.isMatrix3&&!ArrayBuffer.isView(F)&&(N+=z.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(y,x.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,v,x.__data)}}function g(x,T,b){typeof x=="number"||typeof x=="boolean"?T[0]=x:x.isMatrix3?(T[0]=x.elements[0],T[1]=x.elements[1],T[2]=x.elements[2],T[3]=0,T[4]=x.elements[3],T[5]=x.elements[4],T[6]=x.elements[5],T[7]=0,T[8]=x.elements[6],T[9]=x.elements[7],T[10]=x.elements[8],T[11]=0):ArrayBuffer.isView(x)?T.set(new x.constructor(x.buffer,x.byteOffset,T.length)):x.toArray(T,b)}function S(x,T,b,R){const v=x.value,y=T+"_"+b;if(R[y]===void 0)return typeof v=="number"||typeof v=="boolean"?R[y]=v:ArrayBuffer.isView(v)?R[y]=v.slice():R[y]=v.clone(),!0;{const N=R[y];if(typeof v=="number"||typeof v=="boolean"){if(N!==v)return R[y]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(N.equals(v)===!1)return N.copy(v),!0}}return!1}function m(x){const T=x.uniforms;let b=0;const R=16;for(let y=0,N=T.length;y<N;y++){const C=Array.isArray(T[y])?T[y]:[T[y]];for(let F=0,z=C.length;F<z;F++){const D=C[F],B=Array.isArray(D.value)?D.value:[D.value];for(let Y=0,X=B.length;Y<X;Y++){const re=B[Y],$=p(re),te=b%R,ie=te%$.boundary,Ne=te+ie;b+=ie,Ne!==0&&R-Ne<$.storage&&(b+=R-Ne),D.__data=new Float32Array($.storage/Float32Array.BYTES_PER_ELEMENT),D.__offset=b,b+=$.storage}}}const v=b%R;return v>0&&(b+=R-v),x.__size=b,x.__cache={},this}function p(x){const T={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(T.boundary=4,T.storage=4):x.isVector2?(T.boundary=8,T.storage=8):x.isVector3||x.isColor?(T.boundary=16,T.storage=12):x.isVector4?(T.boundary=16,T.storage=16):x.isMatrix3?(T.boundary=48,T.storage=48):x.isMatrix4?(T.boundary=64,T.storage=64):x.isTexture?Xe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(x)?(T.boundary=16,T.storage=x.byteLength):Xe("WebGLRenderer: Unsupported uniform value type.",x),T}function E(x){const T=x.target;T.removeEventListener("dispose",E);const b=a.indexOf(T.__bindingPointIndex);a.splice(b,1),i.deleteBuffer(s[T.id]),delete s[T.id],delete r[T.id]}function w(){for(const x in s)i.deleteBuffer(s[x]);a=[],s={},r={}}return{bind:c,update:l,dispose:w}}const A_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let un=null;function w_(){return un===null&&(un=new _h(A_,16,16,ai,vn),un.name="DFG_LUT",un.minFilter=Lt,un.magFilter=Lt,un.wrapS=An,un.wrapT=An,un.generateMipmaps=!1,un.needsUpdate=!0),un}class R_{constructor(e={}){const{canvas:t=ld(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=Yt}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=a;const S=f,m=new Set([Do,Io,No]),p=new Set([Yt,_n,xs,Ms,Co,Po]),E=new Uint32Array(4),w=new Int32Array(4),x=new L;let T=null,b=null;const R=[],v=[];let y=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=mn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const N=this;let C=!1,F=null,z=null,D=null,B=null;this._outputColorSpace=Xt;let Y=0,X=0,re=null,$=-1,te=null;const ie=new gt,Ne=new gt;let we=null;const Qe=new We(0);let Ze=0,tt=t.width,Q=t.height,ne=1,Me=null,Ce=null;const be=new gt(0,0,tt,Q),He=new gt(0,0,tt,Q);let at=!1;const j=new Bo;let oe=!1,ce=!1;const he=new ht,de=new L,ze=new gt,Oe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ke=!1;function qe(){return re===null?ne:1}let I=n;function it(M,U){return t.getContext(M,U)}let Je,A,_,k,H,K,ue,me,J,ee,ve,De,xe,_e,Ue,Ge,ae,P,le,Z,fe,ye,se;try{const M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${To}`),t.addEventListener("webglcontextlost",ft,!1),t.addEventListener("webglcontextrestored",ot,!1),t.addEventListener("webglcontextcreationerror",Qt,!1),I===null){const U="webgl2";if(I=it(U,M),I===null)throw it(U)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Be()}catch(M){throw t.removeEventListener("webglcontextlost",ft,!1),t.removeEventListener("webglcontextrestored",ot,!1),t.removeEventListener("webglcontextcreationerror",Qt,!1),rt("WebGLRenderer: "+M.message),M}function Be(){Je=new wg(I),Je.init(),fe=new v_(I,Je),A=new _g(I,Je,e,fe),_=new g_(I,Je),A.reversedDepthBuffer&&u&&_.buffers.depth.setReversed(!0),z=I.createFramebuffer(),D=I.createFramebuffer(),B=I.createFramebuffer(),k=new Pg(I),H=new n_,K=new __(I,Je,_,H,A,fe,k),ue=new Ag(N),me=new Nf(I),ye=new mg(I,me),J=new Rg(I,me,k,ye),ee=new Ng(I,J,me,ye,k),P=new Lg(I,A,K),Ue=new vg(H),ve=new t_(N,ue,Je,A,ye,Ue),De=new b_(N,H),xe=new s_,_e=new h_(Je),ae=new pg(N,ue,_,ee,g,c),Ge=new m_(N,ee,A),se=new T_(I,k,A,_),le=new gg(I,Je,k),Z=new Cg(I,Je,k),k.programs=ve.programs,N.capabilities=A,N.extensions=Je,N.properties=H,N.renderLists=xe,N.shadowMap=Ge,N.state=_,N.info=k}S!==Yt&&(y=new Dg(S,t.width,t.height,o,s,r));const Ie=new y_(N,I);this.xr=Ie,this.getContext=function(){return I},this.getContextAttributes=function(){return I.getContextAttributes()},this.forceContextLoss=function(){const M=Je.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){const M=Je.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return ne},this.setPixelRatio=function(M){M!==void 0&&(ne=M,this.setSize(tt,Q,!1))},this.getSize=function(M){return M.set(tt,Q)},this.setSize=function(M,U,q=!0){if(Ie.isPresenting){Xe("WebGLRenderer: Can't change size while VR device is presenting.");return}tt=M,Q=U,t.width=Math.floor(M*ne),t.height=Math.floor(U*ne),q===!0&&(t.style.width=M+"px",t.style.height=U+"px"),y!==null&&y.setSize(t.width,t.height),this.setViewport(0,0,M,U)},this.getDrawingBufferSize=function(M){return M.set(tt*ne,Q*ne).floor()},this.setDrawingBufferSize=function(M,U,q){tt=M,Q=U,ne=q,t.width=Math.floor(M*q),t.height=Math.floor(U*q),this.setViewport(0,0,M,U)},this.setEffects=function(M){if(S===Yt){rt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let U=0;U<M.length;U++)if(M[U].isOutputPass===!0){Xe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}y.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(ie)},this.getViewport=function(M){return M.copy(be)},this.setViewport=function(M,U,q,G){M.isVector4?be.set(M.x,M.y,M.z,M.w):be.set(M,U,q,G),_.viewport(ie.copy(be).multiplyScalar(ne).round())},this.getScissor=function(M){return M.copy(He)},this.setScissor=function(M,U,q,G){M.isVector4?He.set(M.x,M.y,M.z,M.w):He.set(M,U,q,G),_.scissor(Ne.copy(He).multiplyScalar(ne).round())},this.getScissorTest=function(){return at},this.setScissorTest=function(M){_.setScissorTest(at=M)},this.setOpaqueSort=function(M){Me=M},this.setTransparentSort=function(M){Ce=M},this.getClearColor=function(M){return M.copy(ae.getClearColor())},this.setClearColor=function(){ae.setClearColor(...arguments)},this.getClearAlpha=function(){return ae.getClearAlpha()},this.setClearAlpha=function(){ae.setClearAlpha(...arguments)},this.clear=function(M=!0,U=!0,q=!0){let G=0;if(M){let V=!1;if(re!==null){const Te=re.texture.format;V=m.has(Te)}if(V){const Te=re.texture.type,Re=p.has(Te),Ee=ae.getClearColor(),Pe=ae.getClearAlpha(),Fe=Ee.r,$e=Ee.g,et=Ee.b;Re?(E[0]=Fe,E[1]=$e,E[2]=et,E[3]=Pe,I.clearBufferuiv(I.COLOR,0,E)):(w[0]=Fe,w[1]=$e,w[2]=et,w[3]=Pe,I.clearBufferiv(I.COLOR,0,w))}else G|=I.COLOR_BUFFER_BIT}U&&(G|=I.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),q&&(G|=I.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),G!==0&&I.clear(G)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),F=M},this.dispose=function(){t.removeEventListener("webglcontextlost",ft,!1),t.removeEventListener("webglcontextrestored",ot,!1),t.removeEventListener("webglcontextcreationerror",Qt,!1),ae.dispose(),xe.dispose(),_e.dispose(),H.dispose(),ue.dispose(),ee.dispose(),ye.dispose(),se.dispose(),ve.dispose(),Ie.dispose(),Ie.removeEventListener("sessionstart",el),Ie.removeEventListener("sessionend",tl),Yn.stop()};function ft(M){M.preventDefault(),vl("WebGLRenderer: Context Lost."),C=!0}function ot(){vl("WebGLRenderer: Context Restored."),C=!1;const M=k.autoReset,U=Ge.enabled,q=Ge.autoUpdate,G=Ge.needsUpdate,V=Ge.type;Be(),k.autoReset=M,Ge.enabled=U,Ge.autoUpdate=q,Ge.needsUpdate=G,Ge.type=V}function Qt(M){rt("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function ln(M){const U=M.target;U.removeEventListener("dispose",ln),$h(U)}function $h(M){Kh(M),H.remove(M)}function Kh(M){const U=H.get(M).programs;U!==void 0&&(U.forEach(function(q){ve.releaseProgram(q)}),M.isShaderMaterial&&ve.releaseShaderCache(M))}this.renderBufferDirect=function(M,U,q,G,V,Te){U===null&&(U=Oe);const Re=V.isMesh&&V.matrixWorld.determinantAffine()<0,Ee=Qh(M,U,q,G,V);_.setMaterial(G,Re);let Pe=q.index,Fe=1;if(G.wireframe===!0){if(Pe=J.getWireframeAttribute(q),Pe===void 0)return;Fe=2}const $e=q.drawRange,et=q.attributes.position;let Le=$e.start*Fe,lt=($e.start+$e.count)*Fe;Te!==null&&(Le=Math.max(Le,Te.start*Fe),lt=Math.min(lt,(Te.start+Te.count)*Fe)),Pe!==null?(Le=Math.max(Le,0),lt=Math.min(lt,Pe.count)):et!=null&&(Le=Math.max(Le,0),lt=Math.min(lt,et.count));const Mt=lt-Le;if(Mt<0||Mt===1/0)return;ye.setup(V,G,Ee,q,Pe);let mt,dt=le;if(Pe!==null&&(mt=me.get(Pe),dt=Z,dt.setIndex(mt)),V.isMesh)G.wireframe===!0?(_.setLineWidth(G.wireframeLinewidth*qe()),dt.setMode(I.LINES)):dt.setMode(I.TRIANGLES);else if(V.isLine){let wt=G.linewidth;wt===void 0&&(wt=1),_.setLineWidth(wt*qe()),V.isLineSegments?dt.setMode(I.LINES):V.isLineLoop?dt.setMode(I.LINE_LOOP):dt.setMode(I.LINE_STRIP)}else V.isPoints?dt.setMode(I.POINTS):V.isSprite&&dt.setMode(I.TRIANGLES);if(V.isBatchedMesh)if(Je.get("WEBGL_multi_draw"))dt.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else{const wt=V._multiDrawStarts,Ae=V._multiDrawCounts,It=V._multiDrawCount,st=Pe?me.get(Pe).bytesPerElement:1,Zt=H.get(G).currentProgram.getUniforms();for(let cn=0;cn<It;cn++)Zt.setValue(I,"_gl_DrawID",cn),dt.render(wt[cn]/st,Ae[cn])}else if(V.isInstancedMesh)dt.renderInstances(Le,Mt,V.count);else if(q.isInstancedBufferGeometry){const wt=q._maxInstanceCount!==void 0?q._maxInstanceCount:1/0,Ae=Math.min(q.instanceCount,wt);dt.renderInstances(Le,Mt,Ae)}else dt.render(Le,Mt)};function jo(M,U,q,G){F!==null&&M.isNodeMaterial&&F.setObject(G,M),oe===!0&&Ue.setState(M,q,!1),M.transparent===!0&&M.side===fn&&M.forceSinglePass===!1?(M.side=Ot,M.needsUpdate=!0,Ls(M,U,G),M.side=si,M.needsUpdate=!0,Ls(M,U,G),M.side=fn):Ls(M,U,G)}this.compile=function(M,U,q=null){q===null&&(q=M),F!==null&&F.renderStart(M,U,q),b=_e.get(q),b.init(U),v.push(b),q.traverseVisible(function(V){V.isLight&&V.layers.test(U.layers)&&(b.pushLight(V),V.castShadow&&b.pushShadow(V))}),M!==q&&M.traverseVisible(function(V){V.isLight&&V.layers.test(U.layers)&&(b.pushLight(V),V.castShadow&&b.pushShadow(V))}),b.setupLights(),F!==null&&F.updateLights(b.state.lightsArray),ce=this.localClippingEnabled,oe=Ue.init(this.clippingPlanes,ce),oe===!0&&Ue.setGlobalState(this.clippingPlanes,U),F!==null&&Ge.render(b.state.shadowsArray,q,U);const G=new Set;return M.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;const Te=V.material;if(Te)if(Array.isArray(Te))for(let Re=0;Re<Te.length;Re++){const Ee=Te[Re];jo(Ee,q,U,V),G.add(Ee)}else jo(Te,q,U,V),G.add(Te)}),b=v.pop(),F!==null&&F.renderEnd(),G},this.compileAsync=function(M,U,q=null){const G=this.compile(M,U,q);return new Promise(V=>{function Te(){if(G.forEach(function(Re){const Pe=H.get(Re).currentProgram;(Pe===void 0||Pe.isReady())&&G.delete(Re)}),G.size===0){V(M);return}setTimeout(Te,10)}Je.get("KHR_parallel_shader_compile")!==null?Te():setTimeout(Te,10)})};let Lr=null;function Zh(M){Lr&&Lr(M)}function el(){Yn.stop()}function tl(){Yn.start()}const Yn=new Nh;Yn.setAnimationLoop(Zh),typeof self<"u"&&Yn.setContext(self),this.setAnimationLoop=function(M){Lr=M,Ie.setAnimationLoop(M),M===null?Yn.stop():Yn.start()},Ie.addEventListener("sessionstart",el),Ie.addEventListener("sessionend",tl),this.render=function(M,U){if(U!==void 0&&U.isCamera!==!0){rt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;F!==null&&F.renderStart(M,U);const q=Ie.enabled===!0&&Ie.isPresenting===!0,G=y!==null&&(re===null||q)&&y.begin(N,re);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),Ie.enabled===!0&&Ie.isPresenting===!0&&(y===null||y.isCompositing()===!1)&&(Ie.cameraAutoUpdate===!0&&Ie.updateCamera(U),U=Ie.getCamera()),M.isScene===!0&&M.onBeforeRender(N,M,U,re),b=_e.get(M,v.length),b.init(U),b.state.textureUnits=K.getTextureUnits(),v.push(b),he.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),j.setFromProjectionMatrix(he,pn,U.reversedDepth),ce=this.localClippingEnabled,oe=Ue.init(this.clippingPlanes,ce),T=xe.get(M,R.length),T.init(),R.push(T),Ie.enabled===!0&&Ie.isPresenting===!0){const Re=N.xr.getDepthSensingMesh();Re!==null&&Nr(Re,U,-1/0,N.sortObjects)}Nr(M,U,0,N.sortObjects),T.finish(),F!==null&&F.updateLights(b.state.lightsArray),N.sortObjects===!0&&T.sort(Me,Ce),ke=Ie.enabled===!1||Ie.isPresenting===!1||Ie.hasDepthSensing()===!1,ke&&ae.addToRenderList(T,M),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),oe===!0&&Ue.beginShadows();const V=b.state.shadowsArray;if(Ge.render(V,M,U),oe===!0&&Ue.endShadows(),(G&&y.hasRenderPass())===!1){const Re=T.opaque,Ee=T.transmissive;if(b.setupLights(),U.isArrayCamera){const Pe=U.cameras;if(Ee.length>0)for(let Fe=0,$e=Pe.length;Fe<$e;Fe++){const et=Pe[Fe];il(Re,Ee,M,et)}ke&&ae.render(M);for(let Fe=0,$e=Pe.length;Fe<$e;Fe++){const et=Pe[Fe];nl(T,M,et,et.viewport)}}else Ee.length>0&&il(Re,Ee,M,U),ke&&ae.render(M),nl(T,M,U)}re!==null&&X===0&&(K.updateMultisampleRenderTarget(re),K.updateRenderTargetMipmap(re)),G&&y.end(N),M.isScene===!0&&M.onAfterRender(N,M,U),ye.resetDefaultState(),$=-1,te=null,v.pop(),v.length>0?(b=v[v.length-1],K.setTextureUnits(b.state.textureUnits),oe===!0&&Ue.setGlobalState(N.clippingPlanes,b.state.camera)):b=null,R.pop(),R.length>0?T=R[R.length-1]:T=null,F!==null&&F.renderEnd()};function Nr(M,U,q,G){if(M.visible===!1)return;if(M.layers.test(U.layers)){if(M.isGroup)q=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(U);else if(M.isLightProbeGrid)b.pushLightProbeGrid(M);else if(M.isLight)b.pushLight(M),M.castShadow&&b.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||M.intersectsFrustum(j)){G&&ze.setFromMatrixPosition(M.matrixWorld).applyMatrix4(he);const Re=ee.update(M),Ee=M.material;Ee.visible&&T.push(M,Re,Ee,q,ze.z,null,U)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||M.intersectsFrustum(j))){const Re=ee.update(M),Ee=M.material;if(G&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),ze.copy(M.boundingSphere.center)):(Re.boundingSphere===null&&Re.computeBoundingSphere(),ze.copy(Re.boundingSphere.center)),ze.applyMatrix4(M.matrixWorld).applyMatrix4(he)),Array.isArray(Ee)){const Pe=Re.groups;for(let Fe=0,$e=Pe.length;Fe<$e;Fe++){const et=Pe[Fe],Le=Ee[et.materialIndex];Le&&Le.visible&&T.push(M,Re,Le,q,ze.z,et,U)}}else Ee.visible&&T.push(M,Re,Ee,q,ze.z,null,U)}}const Te=M.children;for(let Re=0,Ee=Te.length;Re<Ee;Re++)Nr(Te[Re],U,q,G)}function nl(M,U,q,G){const{opaque:V,transmissive:Te,transparent:Re}=M;b.setupLightsView(q),oe===!0&&Ue.setGlobalState(N.clippingPlanes,q),G&&_.viewport(ie.copy(G)),V.length>0&&Ps(V,U,q),Te.length>0&&Ps(Te,U,q),Re.length>0&&Ps(Re,U,q),_.buffers.depth.setTest(!0),_.buffers.depth.setMask(!0),_.buffers.color.setMask(!0),_.setPolygonOffset(!1)}function il(M,U,q,G){if((q.isScene===!0?q.overrideMaterial:null)!==null)return;if(b.state.transmissionRenderTarget[G.id]===void 0){const Le=Je.has("EXT_color_buffer_half_float")||Je.has("EXT_color_buffer_float");b.state.transmissionRenderTarget[G.id]=new on(1,1,{generateMipmaps:!0,type:Le?vn:Yt,minFilter:ei,samples:Math.max(4,A.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:nt.workingColorSpace})}const Te=b.state.transmissionRenderTarget[G.id],Re=G.viewport||ie;Te.setSize(Re.z*N.transmissionResolutionScale,Re.w*N.transmissionResolutionScale);const Ee=N.getRenderTarget(),Pe=N.getActiveCubeFace(),Fe=N.getActiveMipmapLevel();N.setRenderTarget(Te),N.getClearColor(Qe),Ze=N.getClearAlpha(),Ze<1&&N.setClearColor(16777215,.5),N.clear(),ke&&ae.render(q);const $e=N.toneMapping;N.toneMapping=mn;const et=G.viewport;if(G.viewport!==void 0&&(G.viewport=void 0),b.setupLightsView(G),oe===!0&&Ue.setGlobalState(N.clippingPlanes,G),Ps(M,q,G),K.updateMultisampleRenderTarget(Te),K.updateRenderTargetMipmap(Te),Je.has("WEBGL_multisampled_render_to_texture")===!1){let Le=!1;for(let lt=0,Mt=U.length;lt<Mt;lt++){const mt=U[lt],{object:dt,geometry:wt,material:Ae,group:It}=mt;if(Ae.side===fn&&dt.layers.test(G.layers)){const st=Ae.side;Ae.side=Ot,Ae.needsUpdate=!0,sl(dt,q,G,wt,Ae,It),Ae.side=st,Ae.needsUpdate=!0,Le=!0}}Le===!0&&(K.updateMultisampleRenderTarget(Te),K.updateRenderTargetMipmap(Te))}N.setRenderTarget(Ee,Pe,Fe),N.setClearColor(Qe,Ze),et!==void 0&&(G.viewport=et),N.toneMapping=$e}function Ps(M,U,q){const G=U.isScene===!0?U.overrideMaterial:null;for(let V=0,Te=M.length;V<Te;V++){const Re=M[V],{object:Ee,geometry:Pe,group:Fe}=Re;let $e=Re.material;$e.allowOverride===!0&&G!==null&&($e=G),Ee.layers.test(q.layers)&&sl(Ee,U,q,Pe,$e,Fe)}}function sl(M,U,q,G,V,Te){F!==null&&V.isNodeMaterial&&F.setObject(M,V),M.onBeforeRender(N,U,q,G,V,Te),M.modelViewMatrix.multiplyMatrices(q.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),V.onBeforeRender(N,U,q,G,M,Te),V.transparent===!0&&V.side===fn&&V.forceSinglePass===!1?(V.side=Ot,V.needsUpdate=!0,N.renderBufferDirect(q,U,G,V,M,Te),V.side=si,V.needsUpdate=!0,N.renderBufferDirect(q,U,G,V,M,Te),V.side=fn):N.renderBufferDirect(q,U,G,V,M,Te),M.onAfterRender(N,U,q,G,V,Te)}function Ls(M,U,q){U.isScene!==!0&&(U=Oe);const G=H.get(M),V=b.state.lights,Te=b.state.shadowsArray,Re=V.state.version,Ee=ve.getParameters(M,V.state,Te,U,q,b.state.lightProbeGridArray),Pe=ve.getProgramCacheKey(Ee);let Fe=G.programs;G.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?U.environment:null,G.fog=U.fog;const $e=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;G.envMap=ue.get(M.envMap||G.environment,$e),G.envMapRotation=G.environment!==null&&M.envMap===null?U.environmentRotation:M.envMapRotation,Fe===void 0&&(M.addEventListener("dispose",ln),Fe=new Map,G.programs=Fe);let et=Fe.get(Pe);if(et!==void 0){if(G.currentProgram===et&&G.lightsStateVersion===Re)return al(M,Ee),et}else Ee.uniforms=ve.getUniforms(M),F!==null&&M.isNodeMaterial&&F.build(M,q,Ee),M.onBeforeCompile(Ee,N),et=ve.acquireProgram(Ee,Pe),Fe.set(Pe,et),G.uniforms=Ee.uniforms;const Le=G.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Le.clippingPlanes=Ue.uniform),al(M,Ee),G.needsLights=eu(M),G.lightsStateVersion=Re,G.needsLights&&(Le.ambientLightColor.value=V.state.ambient,Le.lightProbe.value=V.state.probe,Le.sunLights.value=V.state.sun,Le.sunLightShadows.value=V.state.sunShadow,Le.directionalLights.value=V.state.directional,Le.directionalLightShadows.value=V.state.directionalShadow,Le.spotLights.value=V.state.spot,Le.spotLightShadows.value=V.state.spotShadow,Le.rectAreaLights.value=V.state.rectArea,Le.ltc_1.value=V.state.rectAreaLTC1,Le.ltc_2.value=V.state.rectAreaLTC2,Le.pointLights.value=V.state.point,Le.pointLightShadows.value=V.state.pointShadow,Le.hemisphereLights.value=V.state.hemi,Le.sunShadowMatrix.value=V.state.sunShadowMatrix,Le.sunShadowCascade.value=V.state.sunShadowCascade,Le.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Le.spotLightMatrix.value=V.state.spotLightMatrix,Le.spotLightMap.value=V.state.spotLightMap,Le.pointShadowMatrix.value=V.state.pointShadowMatrix),G.lightProbeGrid=b.state.lightProbeGridArray.length>0,G.currentProgram=et,G.uniformsList=null,et}function rl(M){if(M.uniformsList===null){const U=M.currentProgram.getUniforms();M.uniformsList=ur.seqWithValue(U.seq,M.uniforms)}return M.uniformsList}function al(M,U){const q=H.get(M);q.outputColorSpace=U.outputColorSpace,q.batching=U.batching,q.batchingColor=U.batchingColor,q.instancing=U.instancing,q.instancingColor=U.instancingColor,q.instancingMorph=U.instancingMorph,q.skinning=U.skinning,q.morphTargets=U.morphTargets,q.morphNormals=U.morphNormals,q.morphColors=U.morphColors,q.morphTargetsCount=U.morphTargetsCount,q.numClippingPlanes=U.numClippingPlanes,q.numIntersection=U.numClipIntersection,q.vertexAlphas=U.vertexAlphas,q.vertexTangents=U.vertexTangents,q.toneMapping=U.toneMapping}function Jh(M,U){if(M.length===0)return null;if(M.length===1)return M[0].texture!==null?M[0]:null;x.setFromMatrixPosition(U.matrixWorld);for(let q=0,G=M.length;q<G;q++){const V=M[q];if(V.texture!==null&&V.boundingBox.containsPoint(x))return V}return null}function Qh(M,U,q,G,V){U.isScene!==!0&&(U=Oe),K.resetTextureUnits();const Te=U.fog,Re=G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial?U.environment:null,Ee=re===null?N.outputColorSpace:re.isXRRenderTarget===!0?re.texture.colorSpace:nt.workingColorSpace,Pe=G.isMeshStandardMaterial||G.isMeshLambertMaterial&&!G.envMap||G.isMeshPhongMaterial&&!G.envMap,Fe=ue.get(G.envMap||Re,Pe),$e=G.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,et=!!q.attributes.tangent&&(!!G.normalMap||G.anisotropy>0),Le=!!q.morphAttributes.position,lt=!!q.morphAttributes.normal,Mt=!!q.morphAttributes.color;let mt=mn;G.toneMapped&&(re===null||re.isXRRenderTarget===!0)&&(mt=N.toneMapping);const dt=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,wt=dt!==void 0?dt.length:0,Ae=H.get(G),It=b.state.lights;if(oe===!0&&(ce===!0||M!==te)){const pt=M===te&&G.id===$;Ue.setState(G,M,pt)}let st=!1;G.version===Ae.__version?(Ae.needsLights&&Ae.lightsStateVersion!==It.state.version||Ae.outputColorSpace!==Ee||V.isBatchedMesh&&Ae.batching===!1||!V.isBatchedMesh&&Ae.batching===!0||V.isBatchedMesh&&Ae.batchingColor===!0&&V._colorsTexture===null||V.isBatchedMesh&&Ae.batchingColor===!1&&V._colorsTexture!==null||V.isInstancedMesh&&Ae.instancing===!1||!V.isInstancedMesh&&Ae.instancing===!0||V.isSkinnedMesh&&Ae.skinning===!1||!V.isSkinnedMesh&&Ae.skinning===!0||V.isInstancedMesh&&Ae.instancingColor===!0&&V.instanceColor===null||V.isInstancedMesh&&Ae.instancingColor===!1&&V.instanceColor!==null||V.isInstancedMesh&&Ae.instancingMorph===!0&&V.morphTexture===null||V.isInstancedMesh&&Ae.instancingMorph===!1&&V.morphTexture!==null||Ae.envMap!==Fe||G.fog===!0&&Ae.fog!==Te||Ae.numClippingPlanes!==void 0&&(Ae.numClippingPlanes!==Ue.numPlanes||Ae.numIntersection!==Ue.numIntersection)||Ae.vertexAlphas!==$e||Ae.vertexTangents!==et||Ae.morphTargets!==Le||Ae.morphNormals!==lt||Ae.morphColors!==Mt||Ae.toneMapping!==mt||Ae.morphTargetsCount!==wt||!!Ae.lightProbeGrid!=b.state.lightProbeGridArray.length>0)&&(st=!0):(st=!0,Ae.__version=G.version);let Zt=Ae.currentProgram;st===!0&&(Zt=Ls(G,U,V),F&&G.isNodeMaterial&&F.onUpdateProgram(G,Zt,Ae));let cn=!1,Nn=!1,hi=!1;const ut=Zt.getUniforms(),xt=Ae.uniforms;if(_.useProgram(Zt.program)&&(cn=!0,Nn=!0,hi=!0),G.id!==$&&($=G.id,Nn=!0),Ae.needsLights){const pt=Jh(b.state.lightProbeGridArray,V);Ae.lightProbeGrid!==pt&&(Ae.lightProbeGrid=pt,Nn=!0)}if(cn||te!==M){_.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),ut.setValue(I,"projectionMatrix",M.projectionMatrix),ut.setValue(I,"viewMatrix",M.matrixWorldInverse);const Dn=ut.map.cameraPosition;Dn!==void 0&&Dn.setValue(I,de.setFromMatrixPosition(M.matrixWorld)),A.logarithmicDepthBuffer&&ut.setValue(I,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(G.isMeshPhongMaterial||G.isMeshToonMaterial||G.isMeshLambertMaterial||G.isMeshBasicMaterial||G.isMeshStandardMaterial||G.isShaderMaterial)&&ut.setValue(I,"isOrthographic",M.isOrthographicCamera===!0),te!==M&&(te=M,Nn=!0,hi=!0)}if(Ae.needsLights&&(It.state.sunShadowMap.length>0&&ut.setValue(I,"sunShadowMap",It.state.sunShadowMap,K),It.state.directionalShadowMap.length>0&&ut.setValue(I,"directionalShadowMap",It.state.directionalShadowMap,K),It.state.spotShadowMap.length>0&&ut.setValue(I,"spotShadowMap",It.state.spotShadowMap,K),It.state.pointShadowMap.length>0&&ut.setValue(I,"pointShadowMap",It.state.pointShadowMap,K)),V.isSkinnedMesh){ut.setOptional(I,V,"bindMatrix"),ut.setOptional(I,V,"bindMatrixInverse");const pt=V.skeleton;pt&&(pt.boneTexture===null&&pt.computeBoneTexture(),ut.setValue(I,"boneTexture",pt.boneTexture,K))}V.isBatchedMesh&&(ut.setOptional(I,V,"batchingTexture"),ut.setValue(I,"batchingTexture",V._matricesTexture,K),ut.setOptional(I,V,"batchingIdTexture"),ut.setValue(I,"batchingIdTexture",V._indirectTexture,K),ut.setOptional(I,V,"batchingColorTexture"),V._colorsTexture!==null&&ut.setValue(I,"batchingColorTexture",V._colorsTexture,K));const In=q.morphAttributes;if((In.position!==void 0||In.normal!==void 0||In.color!==void 0)&&P.update(V,q,Zt),(Nn||Ae.receiveShadow!==V.receiveShadow)&&(Ae.receiveShadow=V.receiveShadow,ut.setValue(I,"receiveShadow",V.receiveShadow)),(G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial)&&G.envMap===null&&U.environment!==null&&(xt.envMapIntensity.value=U.environmentIntensity),xt.dfgLUT!==void 0&&(xt.dfgLUT.value=w_()),Nn){if(ut.setValue(I,"toneMappingExposure",N.toneMappingExposure),Ae.needsLights&&jh(xt,hi),Te&&G.fog===!0&&De.refreshFogUniforms(xt,Te),De.refreshMaterialUniforms(xt,G,ne,Q,b.state.transmissionRenderTarget[M.id]),Ae.needsLights&&Ae.lightProbeGrid){const pt=Ae.lightProbeGrid;xt.probesSH.value=pt.texture,xt.probesMin.value.copy(pt.boundingBox.min),xt.probesMax.value.copy(pt.boundingBox.max),xt.probesResolution.value.copy(pt.resolution)}ur.upload(I,rl(Ae),xt,K)}if(G.isShaderMaterial&&G.uniformsNeedUpdate===!0&&(ur.upload(I,rl(Ae),xt,K),G.uniformsNeedUpdate=!1),G.isSpriteMaterial&&ut.setValue(I,"center",V.center),ut.setValue(I,"modelViewMatrix",V.modelViewMatrix),ut.setValue(I,"normalMatrix",V.normalMatrix),ut.setValue(I,"modelMatrix",V.matrixWorld),G.uniformsGroups!==void 0){const pt=G.uniformsGroups;for(let Dn=0,ui=pt.length;Dn<ui;Dn++){const ll=pt[Dn];se.update(ll,Zt),se.bind(ll,Zt)}}return Zt}function jh(M,U){M.ambientLightColor.needsUpdate=U,M.lightProbe.needsUpdate=U,M.sunLights.needsUpdate=U,M.sunLightShadows.needsUpdate=U,M.directionalLights.needsUpdate=U,M.directionalLightShadows.needsUpdate=U,M.pointLights.needsUpdate=U,M.pointLightShadows.needsUpdate=U,M.spotLights.needsUpdate=U,M.spotLightShadows.needsUpdate=U,M.rectAreaLights.needsUpdate=U,M.hemisphereLights.needsUpdate=U}function eu(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return Y},this.getActiveMipmapLevel=function(){return X},this.getRenderTarget=function(){return re},this.setRenderTargetTextures=function(M,U,q){const G=H.get(M);G.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,G.__autoAllocateDepthBuffer===!1&&(G.__useRenderToTexture=!1),H.get(M.texture).__webglTexture=U,H.get(M.depthTexture).__webglTexture=G.__autoAllocateDepthBuffer?void 0:q,G.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,U){const q=H.get(M);q.__webglFramebuffer=U,q.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(M,U=0,q=0){re=M,Y=U,X=q;let G=null,V=!1,Te=!1;if(M){const Ee=H.get(M);if(Ee.__useDefaultFramebuffer!==void 0){_.bindFramebuffer(I.FRAMEBUFFER,Ee.__webglFramebuffer),ie.copy(M.viewport),Ne.copy(M.scissor),we=M.scissorTest,_.viewport(ie),_.scissor(Ne),_.setScissorTest(we),$=-1;return}else if(Ee.__webglFramebuffer===void 0)K.setupRenderTarget(M);else if(Ee.__hasExternalTextures)K.rebindTextures(M,H.get(M.texture).__webglTexture,H.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){const $e=M.depthTexture;if(Ee.__boundDepthTexture!==$e){if($e!==null&&H.has($e)&&(M.width!==$e.image.width||M.height!==$e.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");K.setupDepthRenderbuffer(M)}}const Pe=M.texture;(Pe.isData3DTexture||Pe.isDataArrayTexture||Pe.isCompressedArrayTexture)&&(Te=!0);const Fe=H.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(Fe[U])?G=Fe[U][q]:G=Fe[U],V=!0):M.samples>0&&K.useMultisampledRTT(M)===!1?G=H.get(M).__webglMultisampledFramebuffer:Array.isArray(Fe)?G=Fe[q]:G=Fe,ie.copy(M.viewport),Ne.copy(M.scissor),we=M.scissorTest}else ie.copy(be).multiplyScalar(ne).floor(),Ne.copy(He).multiplyScalar(ne).floor(),we=at;if(q!==0&&(G=z),_.bindFramebuffer(I.FRAMEBUFFER,G)&&_.drawBuffers(M,G),_.viewport(ie),_.scissor(Ne),_.setScissorTest(we),V){const Ee=H.get(M.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_CUBE_MAP_POSITIVE_X+U,Ee.__webglTexture,q)}else if(Te){const Ee=U;for(let Pe=0;Pe<M.textures.length;Pe++){const Fe=H.get(M.textures[Pe]);I.framebufferTextureLayer(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0+Pe,Fe.__webglTexture,q,Ee)}}else if(M!==null&&q!==0){const Ee=H.get(M.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,Ee.__webglTexture,q)}$=-1};function ol(M){const U=H.get(M);return(U.__readFormat!==M.format||U.__readType!==M.type)&&(U.__readFormat=M.format,U.__readType=M.type,U.__formatReadable=A.textureFormatReadable(M.format),U.__typeReadable=A.textureTypeReadable(M.type)),U}this.readRenderTargetPixels=function(M,U,q,G,V,Te,Re,Ee=0){if(!(M&&M.isWebGLRenderTarget)){rt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Pe=H.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Re!==void 0&&(Pe=Pe[Re]),Pe){_.bindFramebuffer(I.FRAMEBUFFER,Pe);try{const Fe=M.textures[Ee],$e=Fe.format,et=Fe.type;M.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+Ee);const Le=ol(Fe);if(Le.__formatReadable===!1){rt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Le.__typeReadable===!1){rt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=M.width-G&&q>=0&&q<=M.height-V&&I.readPixels(U,q,G,V,fe.convert($e),fe.convert(et),Te)}finally{const Fe=re!==null?H.get(re).__webglFramebuffer:null;_.bindFramebuffer(I.FRAMEBUFFER,Fe)}}},this.readRenderTargetPixelsAsync=async function(M,U,q,G,V,Te,Re,Ee=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Pe=H.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Re!==void 0&&(Pe=Pe[Re]),Pe)if(U>=0&&U<=M.width-G&&q>=0&&q<=M.height-V){_.bindFramebuffer(I.FRAMEBUFFER,Pe);const Fe=M.textures[Ee],$e=Fe.format,et=Fe.type;M.textures.length>1&&I.readBuffer(I.COLOR_ATTACHMENT0+Ee);const Le=ol(Fe);if(Le.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Le.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const lt=I.createBuffer();I.bindBuffer(I.PIXEL_PACK_BUFFER,lt),I.bufferData(I.PIXEL_PACK_BUFFER,Te.byteLength,I.STREAM_READ),I.readPixels(U,q,G,V,fe.convert($e),fe.convert(et),0),I.bindBuffer(I.PIXEL_PACK_BUFFER,null);const Mt=re!==null?H.get(re).__webglFramebuffer:null;_.bindFramebuffer(I.FRAMEBUFFER,Mt);const mt=I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE,0);return I.flush(),await cd(I,mt,4),I.bindBuffer(I.PIXEL_PACK_BUFFER,lt),I.getBufferSubData(I.PIXEL_PACK_BUFFER,0,Te),I.bindBuffer(I.PIXEL_PACK_BUFFER,null),I.deleteBuffer(lt),I.deleteSync(mt),Te}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,U=null,q=0){const G=Math.pow(2,-q),V=Math.floor(M.image.width*G),Te=Math.floor(M.image.height*G),Re=U!==null?U.x:0,Ee=U!==null?U.y:0;K.setTexture2D(M,0),I.copyTexSubImage2D(I.TEXTURE_2D,q,0,0,Re,Ee,V,Te),_.unbindTexture()},this.copyTextureToTexture=function(M,U,q=null,G=null,V=0,Te=0){let Re,Ee,Pe,Fe,$e,et,Le,lt,Mt;const mt=M.isCompressedTexture?M.mipmaps[Te]:M.image;if(q!==null)Re=q.max.x-q.min.x,Ee=q.max.y-q.min.y,Pe=q.isBox3?q.max.z-q.min.z:1,Fe=q.min.x,$e=q.min.y,et=q.isBox3?q.min.z:0;else{const xt=Math.pow(2,-V);Re=Math.floor(mt.width*xt),Ee=Math.floor(mt.height*xt),M.isDataArrayTexture?Pe=mt.depth:M.isData3DTexture?Pe=Math.floor(mt.depth*xt):Pe=1,Fe=0,$e=0,et=0}G!==null?(Le=G.x,lt=G.y,Mt=G.z):(Le=0,lt=0,Mt=0);const dt=fe.convert(U.format),wt=fe.convert(U.type);let Ae;U.isData3DTexture?(K.setTexture3D(U,0),Ae=I.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(K.setTexture2DArray(U,0),Ae=I.TEXTURE_2D_ARRAY):(K.setTexture2D(U,0),Ae=I.TEXTURE_2D),_.activeTexture(I.TEXTURE0),_.pixelStorei(I.UNPACK_FLIP_Y_WEBGL,U.flipY),_.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),_.pixelStorei(I.UNPACK_ALIGNMENT,U.unpackAlignment);const It=_.getParameter(I.UNPACK_ROW_LENGTH),st=_.getParameter(I.UNPACK_IMAGE_HEIGHT),Zt=_.getParameter(I.UNPACK_SKIP_PIXELS),cn=_.getParameter(I.UNPACK_SKIP_ROWS),Nn=_.getParameter(I.UNPACK_SKIP_IMAGES);_.pixelStorei(I.UNPACK_ROW_LENGTH,mt.width),_.pixelStorei(I.UNPACK_IMAGE_HEIGHT,mt.height),_.pixelStorei(I.UNPACK_SKIP_PIXELS,Fe),_.pixelStorei(I.UNPACK_SKIP_ROWS,$e),_.pixelStorei(I.UNPACK_SKIP_IMAGES,et);const hi=M.isDataArrayTexture||M.isData3DTexture,ut=U.isDataArrayTexture||U.isData3DTexture;if(M.isDepthTexture){const xt=H.get(M),In=H.get(U),pt=H.get(xt.__renderTarget),Dn=H.get(In.__renderTarget);_.bindFramebuffer(I.READ_FRAMEBUFFER,pt.__webglFramebuffer),_.bindFramebuffer(I.DRAW_FRAMEBUFFER,Dn.__webglFramebuffer);for(let ui=0;ui<Pe;ui++)hi&&(I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,H.get(M).__webglTexture,V,et+ui),I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,H.get(U).__webglTexture,Te,Mt+ui)),I.blitFramebuffer(Fe,$e,Re,Ee,Le,lt,Re,Ee,I.DEPTH_BUFFER_BIT,I.NEAREST);_.bindFramebuffer(I.READ_FRAMEBUFFER,null),_.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else if(V!==0||M.isRenderTargetTexture||H.has(M)){const xt=H.get(M),In=H.get(U);_.bindFramebuffer(I.READ_FRAMEBUFFER,D),_.bindFramebuffer(I.DRAW_FRAMEBUFFER,B);for(let pt=0;pt<Pe;pt++)hi?I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,xt.__webglTexture,V,et+pt):I.framebufferTexture2D(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,xt.__webglTexture,V),ut?I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,In.__webglTexture,Te,Mt+pt):I.framebufferTexture2D(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_2D,In.__webglTexture,Te),V!==0?I.blitFramebuffer(Fe,$e,Re,Ee,Le,lt,Re,Ee,I.COLOR_BUFFER_BIT,I.NEAREST):ut?I.copyTexSubImage3D(Ae,Te,Le,lt,Mt+pt,Fe,$e,Re,Ee):I.copyTexSubImage2D(Ae,Te,Le,lt,Fe,$e,Re,Ee);_.bindFramebuffer(I.READ_FRAMEBUFFER,null),_.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else ut?M.isDataTexture||M.isData3DTexture?I.texSubImage3D(Ae,Te,Le,lt,Mt,Re,Ee,Pe,dt,wt,mt.data):U.isCompressedArrayTexture?I.compressedTexSubImage3D(Ae,Te,Le,lt,Mt,Re,Ee,Pe,dt,mt.data):I.texSubImage3D(Ae,Te,Le,lt,Mt,Re,Ee,Pe,dt,wt,mt):M.isDataTexture?I.texSubImage2D(I.TEXTURE_2D,Te,Le,lt,Re,Ee,dt,wt,mt.data):M.isCompressedTexture?I.compressedTexSubImage2D(I.TEXTURE_2D,Te,Le,lt,mt.width,mt.height,dt,mt.data):I.texSubImage2D(I.TEXTURE_2D,Te,Le,lt,Re,Ee,dt,wt,mt);_.pixelStorei(I.UNPACK_ROW_LENGTH,It),_.pixelStorei(I.UNPACK_IMAGE_HEIGHT,st),_.pixelStorei(I.UNPACK_SKIP_PIXELS,Zt),_.pixelStorei(I.UNPACK_SKIP_ROWS,cn),_.pixelStorei(I.UNPACK_SKIP_IMAGES,Nn),Te===0&&U.generateMipmaps&&I.generateMipmap(Ae),_.unbindTexture()},this.initRenderTarget=function(M){H.get(M).__webglFramebuffer===void 0&&K.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?K.setTextureCube(M,0):M.isData3DTexture?K.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?K.setTexture2DArray(M,0):K.setTexture2D(M,0),_.unbindTexture()},this.resetState=function(){Y=0,X=0,re=null,_.reset(),ye.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return pn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=nt._getDrawingBufferColorSpace(e),t.unpackColorSpace=nt._getUnpackColorSpace()}}const gn=Math.PI*2,Cr=()=>({T:new L,n1:new L,n2:new L}),C_=new L(0,1,0),P_=new L(1,0,0),gc=new L,_c=new L,_a=Cr();function Mr(i,e,t){return t.set(4.2*Math.sin(i*gn*e+.7),2.6*Math.cos(i*gn*e*.5),-70+70*i)}function fs(i,e,t){return t.set(2.1*Math.sin(i*gn*e+.7),1.3*Math.cos(i*gn*e*.5),-70+70*i)}function Pr(i,e,t){return Mr(i+.002,e,gc),Mr(i-.002,e,_c),t.T.subVectors(gc,_c).normalize(),t.n1.crossVectors(t.T,C_),t.n1.lengthSq()<.0025&&t.n1.crossVectors(t.T,P_),t.n1.normalize(),t.n2.crossVectors(t.n1,t.T),t}function vc(i,e,t){return .5*Math.sin(i*97.3+e*.15+t*1.7)+.3*Math.sin(i*211.7-e*.11+t*.9)+.2*Math.sin(i*389.1+e*.07+t*2.3)}function ps(i,e,t,n){Mr(i,e.tuning,n),Pr(i,e.tuning,_a);const s=i*gn*38,r=e.resonance*.9,a=e.cutoff*.6;return n.addScaledVector(_a.n1,r*Math.cos(s)+a*vc(i,t,0)),n.addScaledVector(_a.n2,r*Math.sin(s)+a*vc(i,t,1)),n}const xc=i=>i<0?0:i>1?1:i,jn=(i,e,t)=>i<e?e:i>t?t:i,sn=(i,e,t,n)=>i+(e-i)*(1-Math.exp(-t*n)),zh=["tuning","cutoff","resonance","envmod","decay","accent"],zi={tuning:.5,cutoff:.5,resonance:.18,envmod:.5,decay:.4,accent:.6},L_={tuning:"TUNING",cutoff:"CUT OFF FREQ",resonance:"RESONANCE",envmod:"ENV MOD",decay:"DECAY",accent:"ACCENT"},N_={tuning:"TUNING: bends the wave of the line",cutoff:"CUT OFF: detail and glow",resonance:"RESONANCE: winds the coil",envmod:"ENV MOD: how much the current swells the line",decay:"DECAY: tail length of the current",accent:"ACCENT: brightness of the current and the flashes"},Gh="mm_v3_knobs",Vh=i=>i<0?0:i>1?1:i;function I_(){const i={...zi};try{const e=localStorage.getItem(Gh);if(!e)return i;const t=JSON.parse(e);for(const n of zh){const s=t[n];typeof s=="number"&&Number.isFinite(s)&&(i[n]=Vh(s))}}catch{}return i}function Mc(i){try{localStorage.setItem(Gh,JSON.stringify(i))}catch{}}let zn=typeof window>"u"?{...zi}:I_();const _o=new Set,Sc=()=>_o.forEach(i=>i()),Tn={get:()=>zn,set(i,e){const t=Vh(e);zn[i]!==t&&(zn={...zn,[i]:t},Mc(zn),Sc())},reset(i){zn=i?{...zn,[i]:zi[i]}:{...zi},Mc(zn),Sc()},subscribe(i){return _o.add(i),()=>_o.delete(i)}},D_=()=>pe.useSyncExternalStore(Tn.subscribe,Tn.get,Tn.get),Hh=i=>({tuning:.25+1.5*i.tuning,cutoff:i.cutoff,resonance:i.resonance,envmod:i.envmod,decay:.01+.14*i.decay,accent:.2+1.3*i.accent}),vo=1e3,xo=600;function va(i,e){const t=e.clone().project(i);return t.z>1||t.z<-1?null:[(t.x+1)/2*vo,(1-t.y)/2*xo,t.z]}const U_=()=>{const i=pe.useMemo(()=>{const e=Hh(zi),t=new Gt(38,vo/xo,.1,200),n=fs(1.14,e.tuning,new L).add(new L(5.5,2.2,0)),s=fs(1.14-.114,e.tuning,new L);s.y-=.35,t.position.copy(n),t.lookAt(s),t.updateMatrixWorld();const r=[],a=new L;for(let l=0;l<=512;l+=1){ps(l/512,e,0,a);const h=va(t,a);h&&r.push(`${h[0].toFixed(1)},${h[1].toFixed(1)}`)}const o=Ut.map(l=>{ps(l.t,e,0,a);const h=va(t,a);if(!h)return null;const d=t.position.distanceTo(a);return{id:l.id,x:h[0],y:h[1],r:Math.max(1.5,l.radius*520/d),hub:l.kind==="mixtape"}}),c=$t[4].map(l=>{ps(l.t,e,0,a);const h=va(t,a);if(!h)return null;const d=t.position.distanceTo(a),u=l.mixtape?l.mixtape.durationMinutes:90,f=.95+.55*Math.min(1,u/121);return{id:l.id,x:h[0],y:h[1],r:f*520/d}});return{line:r.join(" "),beads:o,gates:c}},[]);return O.jsxs("svg",{className:"v3-static",viewBox:`0 0 ${vo} ${xo}`,preserveAspectRatio:"xMidYMid slice","aria-hidden":"true",children:[O.jsx("polyline",{className:"v3-static-halo",points:i.line}),O.jsx("polyline",{className:"v3-static-line",points:i.line}),i.gates.map(e=>e&&O.jsx("circle",{className:"v3-static-gate",cx:e.x,cy:e.y,r:e.r},e.id)),i.beads.map(e=>e&&O.jsx("circle",{className:"v3-static-bead",cx:e.x,cy:e.y,r:e.r},e.id))]})},F_=i=>{if(!(i instanceof HTMLElement))return!1;const e=i.tagName;return e==="INPUT"||e==="TEXTAREA"||e==="SELECT"||i.isContentEditable};function O_(i){const e=pe.useRef(i);e.current=i,pe.useEffect(()=>{const t=n=>{const s=e.current;if(n.key==="Escape"){s.onEscape();return}if(s.drawerOpen||F_(n.target))return;const r=n.target;if(!(r&&r.tagName==="BUTTON")&&!(n.altKey||n.ctrlKey||n.metaKey))switch(n.key){case" ":case"Spacebar":s.hasCurrent&&s.hasGesture.current&&(n.preventDefault(),s.onToggle());return;case"ArrowLeft":n.preventDefault(),s.hasCurrent?s.onPrev():s.onMoveSelection(-1);return;case"ArrowRight":n.preventDefault(),s.hasCurrent?s.onNext():s.onMoveSelection(1);return;case"ArrowUp":n.preventDefault(),s.onMoveSelection(-1);return;case"ArrowDown":n.preventDefault(),s.onMoveSelection(1);return;case"Enter":r&&r===s.stageRef.current&&(n.preventDefault(),s.onEnter());return;case"1":case"2":case"3":case"4":s.onGroup(Number(n.key));return}};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[])}const yc=10;function B_(i,e,t){const{enabled:n,onSelect:s,onHover:r,onGesture:a}=t;pe.useEffect(()=>{const o=i.current;if(!o||!n)return;let c=!1,l=!1,h=!1,d=0,u=0,f=0,g=0,S=0;const m=[];let p=0,E=0,w=null;const x=C=>{((C==null?void 0:C.id)??null)===w&&!C||(w=(C==null?void 0:C.id)??null,o.classList.toggle("is-over",!!C),r(C))},T=C=>{if(!(C.button!==0&&C.pointerType==="mouse")){c=!0,l=!1,h=C.pointerType!=="mouse",d=f=C.clientX,u=g=C.clientY,C.timeStamp,S=0,p=0,m.length=0,m.push({t:C.timeStamp,s:0});try{o.setPointerCapture(C.pointerId)}catch{}}},b=C=>{const F=e();if(!F)return;const z=o.getBoundingClientRect();if(c){const B=C.clientX-f,Y=C.clientY-g;if(f=C.clientX,g=C.clientY,C.timeStamp,!l){const X=C.clientX-d,re=C.clientY-u;X*X+re*re>yc*yc&&(l=!0,F.dragStart(),o.classList.add("is-dragging"),x(null))}if(l){const X=(B+(h?Y:0))*.0012;for(F.drag(X),p+=X,m.push({t:C.timeStamp,s:p});m.length>2&&C.timeStamp-m[0].t>120;)m.shift();const re=m[0],$=Math.max(16,C.timeStamp-re.t)/1e3;S=Math.max(-1.2,Math.min(1.2,(p-re.s)/$))}return}if(C.pointerType!=="mouse"||(F.setPointer((C.clientX-z.left)/z.width*2-1,(C.clientY-z.top)/z.height*2-1),C.timeStamp-E<16))return;E=C.timeStamp;const D=F.pick(C.clientX-z.left,C.clientY-z.top,28);D?D.id!==w&&x({id:D.id,alt:D.alt,x:D.x,y:D.y}):x(null)},R=C=>{if(!c)return;c=!1;const F=e();try{o.releasePointerCapture(C.pointerId)}catch{}if(a(),l){l=!1,o.classList.remove("is-dragging");const B=m[m.length-1];F==null||F.dragEnd(B&&C.timeStamp-B.t>100?0:S);return}if(!F)return;const z=o.getBoundingClientRect(),D=F.pick(C.clientX-z.left,C.clientY-z.top,C.pointerType==="mouse"?28:36);D&&s(D.id,D.alt)},v=()=>{var C;l&&((C=e())==null||C.dragEnd(0)),c=!1,l=!1,o.classList.remove("is-dragging")},y=()=>{var C;x(null),(C=e())==null||C.setPointer(0,0)},N=C=>{var F;C.preventDefault(),(F=e())==null||F.wheel(-C.deltaY*6e-4)};return o.addEventListener("pointerdown",T),o.addEventListener("pointermove",b),o.addEventListener("pointerup",R),o.addEventListener("pointercancel",v),o.addEventListener("pointerleave",y),o.addEventListener("wheel",N,{passive:!1}),()=>{o.removeEventListener("pointerdown",T),o.removeEventListener("pointermove",b),o.removeEventListener("pointerup",R),o.removeEventListener("pointercancel",v),o.removeEventListener("pointerleave",y),o.removeEventListener("wheel",N),o.classList.remove("is-over","is-dragging")}},[i,e,n,s,r,a])}const k_=({bead:i,state:e,isCurrent:t,notice:n,progress:s,duration:r,timedOut:a,isMobile:o})=>{var u;const c=pe.useRef(null),[l,h]=pe.useState(!1);pe.useEffect(()=>{const f=c.current;if(!f||!o){h(!1);return}h(f.scrollWidth>f.clientWidth+2)},[i,o]);let d=null;return i&&!i.playable?d=O.jsxs(O.Fragment,{children:["Not on SoundCloud."," ",O.jsx("a",{href:i.track.link,target:"_blank",rel:"noopener",className:"v3-display-link",children:"Listen on Bandcamp"})]}):a?d="Tap RUN again.":e==="loading"?d="LOADING":e==="paused"&&t&&(d="PAUSED"),O.jsxs("div",{className:"v3-display","aria-live":"off",children:[i?O.jsxs("div",{className:"v3-display-track",children:[((u=i.mixtape)==null?void 0:u.artwork)&&O.jsx("img",{className:"v3-display-art",src:i.mixtape.artwork,alt:"",width:48,height:48,loading:"lazy",decoding:"async"}),O.jsxs("div",{className:"v3-display-text",children:[O.jsx("span",{className:`v3-display-title${l?" is-marquee":""}`,children:O.jsx("span",{ref:c,className:"v3-display-title-inner",children:i.track.title})}),O.jsx("span",{className:"v3-display-meta",children:bu(i)})]})]},i.id):O.jsx("p",{className:"v3-display-idle",children:o?"Tap a bead, then RUN.":"Pick a track on the line, then RUN."}),O.jsxs("div",{className:"v3-display-status",children:[n?O.jsxs("span",{className:"v3-display-notice",role:"status",children:["Skipped: ",n]}):O.jsx("span",{className:`v3-display-word${e==="loading"&&!a?" is-loading":""}`,role:"status",children:d}),t&&O.jsxs("span",{className:"v3-display-time",children:[dl(s*r)," / ",dl(r)]})]})]})},z_=Array.from({length:11},(i,e)=>-135+270*e/10),G_=({id:i,reduced:e,isTouch:t})=>{const s=D_()[i],[r,a]=pe.useState(!1),o=pe.useRef(void 0),c=pe.useRef(null),l=pe.useRef(0),h=pe.useRef(null),d=L_[i],u=e&&(i==="envmod"||i==="decay"),f=N_[i]+(u?" (inert in calm mode)":""),g=Math.round(s*100),S=pe.useCallback(R=>Tn.set(i,R),[i]);pe.useEffect(()=>{const R=h.current;if(!R)return;const v=y=>{y.preventDefault(),y.stopPropagation(),Tn.set(i,Tn.get()[i]+(y.deltaY<0?.01:-.01))};return R.addEventListener("wheel",v,{passive:!1}),()=>R.removeEventListener("wheel",v)},[i]),pe.useEffect(()=>()=>window.clearTimeout(o.current),[]);const m=R=>{window.clearTimeout(o.current),o.current=window.setTimeout(()=>a(!0),R)},p=(R=0)=>{window.clearTimeout(o.current),R?o.current=window.setTimeout(()=>a(!1),R):a(!1)},E=R=>{if(R.preventDefault(),R.currentTarget.setPointerCapture(R.pointerId),c.current={y0:R.clientY,v0:s},R.pointerType!=="mouse"){const v=R.timeStamp;v-l.current<300&&Tn.reset(i),l.current=v}m(0)},w=R=>{c.current&&S(c.current.v0+(c.current.y0-R.clientY)*.006)},x=R=>{if(c.current){c.current=null;try{R.currentTarget.releasePointerCapture(R.pointerId)}catch{}R.pointerType==="mouse"?p(250):p(600)}},T=R=>{const v=R.shiftKey?.1:.01;let y=!0;switch(R.key){case"ArrowUp":case"ArrowRight":S(s+v);break;case"ArrowDown":case"ArrowLeft":S(s-v);break;case"Home":S(0);break;case"End":S(1);break;case"PageUp":S(s+.1);break;case"PageDown":S(s-.1);break;default:y=!1}y&&(R.preventDefault(),R.stopPropagation())},b=-135+270*s;return O.jsxs("div",{className:"v3-knob","data-knob":i,children:[O.jsx("div",{ref:h,className:"v3-knob-dial",role:"slider",tabIndex:0,"aria-label":d,"aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":g,"aria-valuetext":`${g} percent`,"aria-describedby":`v3-knob-tip-${i}`,onPointerDown:E,onPointerMove:w,onPointerUp:x,onPointerCancel:x,onDoubleClick:()=>Tn.reset(i),onKeyDown:T,onMouseEnter:()=>!t&&m(250),onMouseLeave:()=>!c.current&&p(),onFocus:()=>m(250),onBlur:()=>p(),children:O.jsxs("svg",{viewBox:"0 0 64 64","aria-hidden":"true",focusable:"false",children:[z_.map(R=>O.jsx("line",{x1:"32",y1:"2.5",x2:"32",y2:R===-135||R===135?"6.5":"5",transform:`rotate(${R} 32 32)`,className:"v3-knob-tick"},R)),O.jsx("circle",{cx:"32",cy:"32",r:"22",className:"v3-knob-cap"}),O.jsx("circle",{cx:"32",cy:"32",r:"18",className:"v3-knob-cap-inner"}),O.jsx("line",{x1:"32",y1:"13",x2:"32",y2:"22",className:"v3-knob-index",transform:`rotate(${b} 32 32)`})]})}),O.jsx("span",{className:"v3-label v3-knob-label",children:d}),O.jsxs("span",{id:`v3-knob-tip-${i}`,className:`v3-knob-tip${r?" is-on":""}`,role:"tooltip",children:[f,O.jsx("em",{children:s===zi[i]?" (default)":""})]})]})},Ec={1:-54,2:-18,3:18,4:54},V_=({value:i,onChange:e})=>O.jsxs("fieldset",{className:"v3-rotary",role:"radiogroup","aria-label":"Pattern group","aria-describedby":"v3-rotary-legend",children:[O.jsx("legend",{className:"v3-label v3-rotary-title",children:"PATTERN GROUP"}),O.jsx("div",{className:"v3-rotary-dial","aria-hidden":"true",children:O.jsxs("svg",{viewBox:"0 0 64 64",focusable:"false",children:[Ea.map(t=>O.jsx("line",{x1:"32",y1:"4",x2:"32",y2:"9",className:"v3-knob-tick",transform:`rotate(${Ec[t]} 32 32)`},t)),O.jsx("circle",{cx:"32",cy:"32",r:"19",className:"v3-knob-cap"}),O.jsx("circle",{cx:"32",cy:"32",r:"15",className:"v3-knob-cap-inner"}),O.jsx("line",{x1:"32",y1:"16",x2:"32",y2:"25",className:"v3-knob-index v3-rotary-pointer",style:{transform:`rotate(${Ec[i]}deg)`}})]})}),O.jsx("div",{className:"v3-rotary-ticks",children:Ea.map(t=>O.jsxs("label",{className:`v3-rotary-tick${i===t?" is-active":""}`,children:[O.jsx("input",{type:"radio",name:"v3-group",value:t,checked:i===t,onChange:()=>e(t),"aria-label":`Pattern group ${fr[t]}`}),O.jsx("span",{children:fr[t]})]},t))}),O.jsx("span",{id:"v3-rotary-legend",className:"v3-rotary-legend",children:"I featured, II originals, III remixes, IV mixtapes"})]}),H_=Array.from({length:16},(i,e)=>e),W_=({progress:i,hasCurrent:e,playing:t,loading:n,noticeKey:s,onSeek:r})=>{const a=pe.useRef(null),o=Math.floor(i*16+1e-6),c=h=>{const d=a.current;if(!d||!e)return;const u=d.getBoundingClientRect(),f=Math.max(0,Math.min(15,Math.floor((h-u.left)/u.width*16)));r(f/16)},l=h=>{if(!e)return;let d=null;const u=Math.round(i*16);switch(h.key){case"ArrowRight":case"ArrowUp":d=Math.min(16,u+1);break;case"ArrowLeft":case"ArrowDown":d=Math.max(0,u-1);break;case"Home":d=0;break;case"End":d=15;break}d!==null&&(h.preventDefault(),h.stopPropagation(),r(d/16))};return O.jsx("div",{ref:a,className:`v3-steps${n?" is-loading":""}${t?" is-playing":""}`,role:"slider",tabIndex:0,"aria-label":"Position","aria-valuemin":0,"aria-valuemax":16,"aria-valuenow":Math.round(i*16),"aria-valuetext":`${Math.round(i*100)} percent`,"aria-disabled":!e,"data-notice":s,onPointerDown:h=>c(h.clientX),onKeyDown:l,children:H_.map(h=>O.jsxs("span",{className:`v3-step${h<o?" is-lit":""}${e&&h===o&&h<16?" is-current":""}`,style:{animationDelay:n?`${h*300}ms`:void 0},"aria-hidden":"true",children:[O.jsx("i",{className:"v3-led"}),O.jsx("b",{className:"v3-step-cell"})]},h))})},X_=({runRef:i,playing:e,hasCurrent:t,runEnabled:n,breathing:s,onRun:r,onBack:a,onFwd:o})=>O.jsxs("div",{className:"v3-transport",role:"group","aria-label":"Transport",children:[O.jsxs("button",{type:"button",className:"v3-tbtn v3-tbtn-back","aria-label":"Previous track","aria-disabled":!t,onClick:a,children:[O.jsx("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:O.jsx("path",{d:"M13 2v12L5 8zM3 2h2v12H3z",fill:"currentColor"})}),O.jsx("span",{className:"v3-tbtn-label",children:"BACK"})]}),O.jsxs("button",{ref:i,type:"button",className:`v3-tbtn v3-tbtn-run${s?" is-breathing":""}${e?" is-on":""}`,"aria-label":e?"Pause":"Play","aria-pressed":e,"aria-disabled":!n,onClick:r,children:[e?O.jsxs("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:[O.jsx("rect",{x:"2.5",y:"2",width:"4",height:"12",fill:"currentColor"}),O.jsx("rect",{x:"9.5",y:"2",width:"4",height:"12",fill:"currentColor"})]}):O.jsx("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:O.jsx("path",{d:"M3 2l11 6-11 6z",fill:"currentColor"})}),O.jsx("span",{className:"v3-tbtn-label",children:"RUN/STOP"})]}),O.jsxs("button",{type:"button",className:"v3-tbtn v3-tbtn-fwd","aria-label":"Next track","aria-disabled":!t,onClick:o,children:[O.jsx("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:O.jsx("path",{d:"M3 2v12l8-6zM11 2h2v12h-2z",fill:"currentColor"})}),O.jsx("span",{className:"v3-tbtn-label",children:"FWD"})]})]}),q_=i=>{const e=!!i.bead&&i.bead.playable,t=e&&!i.isCurrent;return O.jsxs("section",{className:`v3-panel${i.knobsOpen?" is-knobs-open":""}`,"aria-label":"Acid Line panel",children:[O.jsxs("div",{className:"v3-silk","aria-hidden":"true",children:[O.jsx("span",{className:"v3-silk-name",children:"MAUDITE MACHINE"}),O.jsx("span",{className:"v3-silk-sub",children:"ACID LINE"}),O.jsx("span",{className:"v3-silk-tiny",children:"COMPUTER CONTROLLED"})]}),O.jsx(V_,{value:i.group,onChange:i.onGroup}),O.jsxs("div",{className:"v3-knobs",children:[O.jsx("button",{type:"button",className:"v3-knobs-toggle","aria-expanded":i.knobsOpen,"aria-controls":"v3-knobs-row",onClick:i.onKnobsToggle,children:"KNOBS"}),O.jsx("div",{id:"v3-knobs-row",className:"v3-knobs-row",children:zh.map(n=>O.jsx(G_,{id:n,reduced:i.reduced,isTouch:i.isTouch},n))})]}),O.jsxs("div",{className:"v3-display-col",children:[O.jsx(k_,{bead:i.bead,state:i.state,isCurrent:i.isCurrent,notice:i.notice,progress:i.progress,duration:i.duration,timedOut:i.timedOut,isMobile:i.isMobile}),O.jsx(W_,{progress:i.hasCurrent?i.progress:0,hasCurrent:i.hasCurrent,playing:i.playing,loading:i.state==="loading"&&!i.timedOut,noticeKey:i.noticeKey,onSeek:i.onSeek})]}),O.jsxs("div",{className:"v3-transport-wrap",children:[O.jsx(X_,{runRef:i.runRef,playing:i.playing,hasCurrent:i.hasCurrent,runEnabled:e,breathing:t,onRun:i.onRun,onBack:i.onBack,onFwd:i.onFwd}),O.jsxs("button",{type:"button",className:"v3-tbtn v3-clear","aria-label":"Stop and clear",onClick:i.onClear,children:[O.jsx("svg",{viewBox:"0 0 16 16",width:"12",height:"12","aria-hidden":"true",children:O.jsx("path",{d:"M3 3l10 10M13 3L3 13",stroke:"currentColor",strokeWidth:"1.6"})}),O.jsx("span",{className:"v3-tbtn-label",children:"CLEAR"})]})]})]})};class Y_ extends ph{constructor(){super(),this.name="RoomEnvironment",this.position.y=-3.5;const e=new qn;e.deleteAttribute("uv");const t=new ws({side:Ot}),n=new ws,s=new Xo(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);const r=new vt(e,t);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const a=new ii(e,n,6),o=new Bt;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),a.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),a.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),a.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),a.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),a.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),a.setMatrixAt(5,o.matrix),this.add(a);const c=new vt(e,Ai(50));c.position.set(-16.116,14.37,8.208),c.scale.set(.1,2.428,2.739),this.add(c);const l=new vt(e,Ai(50));l.position.set(-16.109,18.021,-8.207),l.scale.set(.1,2.425,2.751),this.add(l);const h=new vt(e,Ai(17));h.position.set(14.904,12.198,-1.832),h.scale.set(.15,4.265,6.331),this.add(h);const d=new vt(e,Ai(43));d.position.set(-.462,8.89,14.52),d.scale.set(4.38,5.441,.088),this.add(d);const u=new vt(e,Ai(20));u.position.set(3.235,11.486,-12.541),u.scale.set(2.5,2,.1),this.add(u);const f=new vt(e,Ai(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){const e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(const t of e)t.dispose()}}function Ai(i){return new Ef({color:0,emissive:16777215,emissiveIntensity:i})}const Ve={currentId:null,selectedId:null,hoverId:null,playing:!1,progress:0,duration:0,pending:!1,noticeAt:0,noticeId:null,group:1,drawer:"none",state:"boot",isTouch:!1,codaSeq:0},Mo="mm_v3_calm",So=new Set,Wh=()=>So.forEach(i=>i());let ms=null,gs=!1,Xh=!1;if(typeof window<"u"){ms=window.matchMedia("(prefers-reduced-motion: reduce)"),ms.addEventListener("change",Wh);try{gs=localStorage.getItem(Mo)==="1"}catch{gs=!1}Xh=new URLSearchParams(window.location.search).get("motion")==="reduce"}const Vt={get:()=>!!(ms!=null&&ms.matches||gs||Xh),getCalm:()=>gs,setCalm(i){gs=i;try{i?localStorage.setItem(Mo,"1"):localStorage.removeItem(Mo)}catch{}Wh()},subscribe(i){return So.add(i),()=>So.delete(i)}},$_=()=>pe.useSyncExternalStore(Vt.subscribe,Vt.get,Vt.get),K_=()=>pe.useSyncExternalStore(Vt.subscribe,Vt.getCalm,Vt.getCalm),Z_=6e4/130/4;class J_{constructor(){W(this,"startAt",-1)}start(e){this.startAt=e}stop(){this.startAt=-1}get running(){return this.startAt>=0}step(e){return this.startAt<0?-1:Math.floor((e-this.startAt)/Z_)%16}}const bc=i=>i,Q_=i=>1-Math.pow(1-i,5),Ni=i=>1-Math.pow(1-i,3),j_=i=>i*i*i,dr=i=>i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2,qh=(i=1.70158)=>e=>1+(i+1)*Math.pow(e-1,3)+i*Math.pow(e-1,2);class ev{constructor(){W(this,"list",[])}get alive(){return this.list.length}run(e,t,n,s,r,a,o={}){var c;if(o.tag&&this.cancel(o.tag),s<=0&&!o.delay){e(n),(c=o.onDone)==null||c.call(o);return}this.list.push({from:t,to:n,start:a+(o.delay??0),dur:Math.max(s,1e-4),ease:r,set:e,onDone:o.onDone,tag:o.tag,started:!1})}cancel(e){this.list=this.list.filter(t=>t.tag!==e)}update(e){var n;if(!this.list.length)return;const t=[];for(const s of this.list){if(e<s.start)continue;s.started=!0;const r=Math.min(1,(e-s.start)/s.dur);s.set(s.from+(s.to-s.from)*s.ease(r)),r>=1&&t.push(s)}if(t.length){this.list=this.list.filter(s=>!t.includes(s));for(const s of t)(n=s.onDone)==null||n.call(s)}}finishAll(){var t;const e=this.list;this.list=[];for(const n of e)n.set(n.to),(t=n.onDone)==null||t.call(n)}clear(){this.list=[]}}const qo=new We(.93,.91,.87),ir=qo.clone(),tv=qo.clone().multiplyScalar(.45),nv=qo.clone().multiplyScalar(1.6),iv=new We(.93*1.2,.91*1.12,.87).multiplyScalar(1.15),sv=new We(1,.22,.12).multiplyScalar(1.6),rv=new We(.3,.3,.3),av=new We(2,.2,.1),Gn=new L,es=new Ln,sr=new L,wi=new ht,Ri=new L,Tc=Cr(),ov=new L(0,0,1),lv=qh(1.4),cv=i=>{const e=i<0?0:i>1?1:i;return e*e*(3-2*e)},hv=i=>()=>{i=i+1831565813|0;let e=Math.imul(i^i>>>15,1|i);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296},Er=class Er{constructor(e,t){W(this,"mesh");W(this,"gates");W(this,"material");W(this,"gateMaterial");W(this,"positions",new Float32Array(Pt*3));W(this,"colors");W(this,"axes");W(this,"hoverAmt",new Float32Array(Pt));W(this,"gateVis",new Float32Array(8).fill(1));W(this,"popStart",new Float64Array(Pt).fill(-1));W(this,"geom");W(this,"gateGeom");W(this,"hubs");this.material=e,this.gateMaterial=e.clone(),this.geom=new Wo(1,t),this.mesh=new ii(this.geom,this.material,Pt),this.mesh.frustumCulled=!1,this.mesh.renderOrder=0,this.colors=new Float32Array(Pt*3);for(let s=0;s<Pt;s+=1)this.colors[s*3]=ir.r,this.colors[s*3+1]=ir.g,this.colors[s*3+2]=ir.b;this.mesh.instanceColor=new ys(this.colors,3);const n=hv(20120515);this.axes=new Float32Array(Pt*3);for(let s=0;s<Pt;s+=1)Ri.set(n()-.5,n()-.5,n()-.5).normalize(),this.axes[s*3]=Ri.x,this.axes[s*3+1]=Ri.y,this.axes[s*3+2]=Ri.z;this.hubs=$t[4],this.gateGeom=new Ar(1,.03,12,64),this.gates=new ii(this.gateGeom,this.gateMaterial,this.hubs.length),this.gates.frustumCulled=!1,this.gates.renderOrder=0;for(let s=0;s<Pt;s+=1)wi.makeScale(0,0,0),this.mesh.setMatrixAt(s,wi)}popAll(){for(let e=0;e<Pt;e+=1)this.popStart[e]=-1e9}targetColor(e,t,n,s){return e.playable?t.noticeId===e.id&&n-t.noticeAt<800&&Math.floor((n-t.noticeAt)/200)%2===0?s.copy(av):t.currentId===e.id?s.copy(sv):t.hoverId===e.id?s.copy(nv):t.selectedId===e.id?s.copy(iv):ls(e,t.group)?s.copy(ir):s.copy(tv):s.copy(rv)}update(e,t,n,s,r){const a=Er.tmpColor,o=n/1e3;let c=!1;for(let l=0;l<Pt;l+=1){const h=Ut[l];ps(h.t,s,t,Gn),this.positions[l*3]=Gn.x,this.positions[l*3+1]=Gn.y,this.positions[l*3+2]=Gn.z;let d=1;if(this.popStart[l]<0&&(r.reveal>=h.t||r.reduced?this.popStart[l]=r.reduced?-1e9:o:d=0),this.popStart[l]>=0){const x=Math.min(1,(o-this.popStart[l])/.32);d=x>=1?1:Math.max(0,lv(x))}const u=r.hoverId===h.id?1:0;this.hoverAmt[l]=sn(this.hoverAmt[l],u,u?20:12,e);let f=h.radius*d*(1+.08*this.hoverAmt[l]);r.currentId===h.id&&r.playing&&!r.reduced&&(f*=1+.03+.03*Math.sin(t*Math.PI*2)),sr.set(f,f,f),r.reduced?es.identity():(Ri.set(this.axes[l*3],this.axes[l*3+1],this.axes[l*3+2]),es.setFromAxisAngle(Ri,t*.2+l)),wi.compose(Gn,es,sr),this.mesh.setMatrixAt(l,wi),this.targetColor(h,r,n,a);const g=l*3,S=a.r+a.g+a.b>this.colors[g]+this.colors[g+1]+this.colors[g+2],m=r.reduced?60:S?20:8,p=sn(this.colors[g],a.r,m,e),E=sn(this.colors[g+1],a.g,m,e),w=sn(this.colors[g+2],a.b,m,e);Math.abs(p-this.colors[g])+Math.abs(E-this.colors[g+1])+Math.abs(w-this.colors[g+2])>1e-4&&(this.colors[g]=p,this.colors[g+1]=E,this.colors[g+2]=w,c=!0)}this.mesh.instanceMatrix.needsUpdate=!0,c&&this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0);for(let l=0;l<this.hubs.length;l+=1){const h=this.hubs[l],d=h.index;Gn.set(this.positions[d*3],this.positions[d*3+1],this.positions[d*3+2]),Pr(h.t,s.tuning,Tc),es.setFromUnitVectors(ov,Tc.T);const u=h.mixtape?h.mixtape.durationMinutes:90,f=cv((r.camPos.distanceTo(Gn)-3.2)/3);this.gateVis[l]=r.reduced?f:sn(this.gateVis[l],f,8,e);const g=(.85+.5*Math.min(1,u/121))*this.gateVis[l]*(r.reveal>=h.t||r.reduced?1:0);sr.set(g,g,g),wi.compose(Gn,es,sr),this.gates.setMatrixAt(l,wi)}this.gates.instanceMatrix.needsUpdate=!0}positionOf(e,t){return t.set(this.positions[e*3],this.positions[e*3+1],this.positions[e*3+2])}get trackCount(){return xu}dispose(){this.geom.dispose(),this.gateGeom.dispose(),this.material.dispose(),this.gateMaterial.dispose(),this.mesh.dispose(),this.gates.dispose()}};W(Er,"tmpColor",new We);let yo=Er;const Ac=new L,wc=new Ln,Rc=new L,Cc=new ht,Eo=new L(0,2.2,-66),uv="700 44px Larsseit, sans-serif",dv="700 44px Larsseit",Pc=i=>new Promise(e=>window.setTimeout(()=>e(!1),i));function Lc(){if(typeof document>"u"||!("fonts"in document))return Promise.resolve(!1);try{return document.fonts.load(dv).then(i=>i.length>0,()=>!1)}catch{return Promise.resolve(!1)}}class fv{constructor(e,t,n){W(this,"mesh");W(this,"lamp");W(this,"geom");W(this,"material");W(this,"cells",[]);W(this,"cols",128);W(this,"rows",56);W(this,"stride");W(this,"capacity");W(this,"portrait",!1);W(this,"halved",!1);W(this,"disposed",!1);W(this,"rasteredWithFont",!1);W(this,"seed",[]);this.capacity=t,this.stride=n,this.material=e,this.geom=new qn(1,1,3),this.mesh=new ii(this.geom,this.material,t),this.mesh.frustumCulled=!1,this.mesh.count=0,this.lamp=new Xo(16183783,0,40,2),this.lamp.position.set(0,5,-58)}raster(e){Promise.race([Lc(),Pc(3e3)]).then(t=>{this.disposed||(this.draw(t),e==null||e(),t||Promise.race([Lc(),Pc(1e4)]).then(n=>{n&&!this.disposed&&!this.rasteredWithFont&&(this.draw(!0),e==null||e())}))})}draw(e){const t=document.createElement("canvas");t.width=256,t.height=112;const n=t.getContext("2d",{willReadFrequently:!0});if(!n)return;n.clearRect(0,0,256,112),n.fillStyle="#fff",n.font=uv,n.textAlign="center",n.textBaseline="alphabetic","letterSpacing"in n&&(n.letterSpacing="2px"),n.fillText("MAUDITE",128,46),n.fillText("MACHINE",128,100);const s=n.getImageData(0,0,256,112).data,r=this.stride;this.cols=Math.ceil(256/r),this.rows=Math.ceil(112/r);const a=[];for(let c=0;c<112;c+=r)for(let l=0;l<256;l+=r)s[(c*256+l)*4+3]>128&&a.push(l/r,c/r);this.cells=a,this.rasteredWithFont=e;let o=20260211;this.seed=[];for(let c=0;c<a.length/2;c+=1)o=o*1664525+1013904223>>>0,this.seed.push(o/4294967296-.5);this.layout(this.portrait,this.halved)}layout(e,t){if(this.portrait=e,this.halved=t,!this.cells.length)return;const s=(e?7:14)/this.cols;wc.identity(),Rc.set(s,s,s);let r=0;const a=this.cells.length/2;for(let o=0;o<a&&r<this.capacity;o+=1){if(t&&o%2===1)continue;const c=this.cells[o*2],l=this.cells[o*2+1];Ac.set((c-this.cols/2+.5)*s,Eo.y+(this.rows/2-l-.5)*s,Eo.z+this.seed[o]*.12*s*3),Cc.compose(Ac,wc,Rc),this.mesh.setMatrixAt(r,Cc),r+=1}this.mesh.count=r,this.mesh.instanceMatrix.needsUpdate=!0}get cellCount(){return this.cells.length/2}dispose(){this.disposed=!0,this.geom.dispose(),this.material.dispose(),this.mesh.dispose()}}const pv=new L(5.5,2.2,0),mv=new L(3.2,2.6,0),gv=new L(4.5,1.8,6),_v=new L(3.6,1.6,7.4),Nc=new L,rr=new L,ts=new L,vv=(i,e,t)=>{const n=jn((t-i)/(e-i),0,1);return n*n*(3-2*n)};class xv{constructor(e){W(this,"camera");W(this,"s",1.14);W(this,"v",0);W(this,"sMin",.24);W(this,"sMax",1.14);W(this,"mode","free");W(this,"portrait",!1);W(this,"touch",!1);W(this,"reduced",!1);W(this,"dragging",!1);W(this,"pull",0);W(this,"pos",new L);W(this,"look",new L);W(this,"goalPos",new L);W(this,"goalLook",new L);W(this,"fromPos",new L);W(this,"fromLook",new L);W(this,"holdPos",new L);W(this,"holdLook",new L);W(this,"focusPos",new L);W(this,"codaLook",new L);W(this,"poseTween",null);W(this,"sTween",null);W(this,"px",0);W(this,"py",0);W(this,"pxT",0);W(this,"pyT",0);this.camera=new Gt(38,e,.1,200),this.setViewport(e),this.solveGoal(1),this.pos.copy(this.goalPos),this.look.copy(this.goalLook),this.camera.position.copy(this.pos),this.camera.lookAt(this.look)}setViewport(e){this.camera.aspect=e,this.camera.updateProjectionMatrix(),this.portrait=e<1,this.sMin=this.portrait?.36:.24,this.sMax=this.portrait?1.24:1.14,this.mode==="free"&&this.s>this.sMax&&!this.sTween&&(this.s=this.sMax)}get camOffset(){return this.portrait?mv:pv}get lookAhead(){return this.portrait?.25:.114}get bias(){return this.portrait?-1:-.35}startPose(e,t,n){if(this.reduced){this.poseTween=null;return}this.fromPos.copy(this.pos),this.fromLook.copy(this.look),this.poseTween={start:e,dur:t,ease:n}}intro(e){if(this.mode="free",this.reduced){this.s=this.sMax,this.sTween=null;return}this.s=this.sMax+.04,this.sTween={from:this.s,to:this.sMax,start:e,dur:2.2,ease:Q_}}focusOn(e){this.mode="focus",this.sTween=null,this.v=0,this.startPose(e,.9,dr)}coda(e){this.mode="coda",this.sTween=null,this.v=0,this.s=this.sMax,this.startPose(e,1.1,dr)}hold(){this.mode!=="free"&&(this.holdPos.copy(this.pos),this.holdLook.copy(this.look),this.mode="hold",this.poseTween=null)}leaveToFree(e){this.mode!=="free"&&(this.s=jn((this.pos.z+70)/70,this.sMin,this.sMax),this.mode="free",this.v=0,this.startPose(e,.6,Ni))}dolly(e,t){this.leaveToFree(t),this.sTween=null,this.s=jn(this.s+e,this.sMin,this.sMax)}fling(e){this.v=e}jumpTo(e,t){this.leaveToFree(t),this.v=0;const n=jn(e,this.sMin,this.sMax);if(this.reduced){this.s=n,this.sTween=null;return}this.sTween={from:this.s,to:n,start:t,dur:1.1,ease:dr}}finishAll(){this.sTween&&(this.s=this.sTween.to,this.sTween=null),this.poseTween=null}get busy(){return!!(this.sTween||this.poseTween)||Math.abs(this.v)>1e-4}setPointer(e,t){this.pxT=e*.3,this.pyT=-t*.15}solveGoal(e){switch(this.mode){case"focus":this.goalPos.copy(this.focusPos).add(this.portrait?_v:gv),this.goalLook.copy(this.focusPos),this.goalLook.y+=this.bias;break;case"coda":fs(this.sMax,e,this.goalPos).add(this.camOffset),this.goalLook.copy(this.codaLook);break;case"hold":this.goalPos.copy(this.holdPos),this.goalLook.copy(this.holdLook);break;default:{fs(this.s,e,this.goalPos).add(this.camOffset),Mr(this.s-this.lookAhead,e,this.goalLook),fs(this.s-this.lookAhead,e,ts),this.goalLook.x+=this.portrait?0:1.5,this.goalLook.y=ts.y+(this.portrait?-1:.55);const t=1-vv(this.sMin,this.sMin+.08,this.s);t>0&&(ts.copy(Eo),ts.y+=this.bias*2.2,this.goalLook.lerp(ts,t))}}this.pull>0&&(Nc.subVectors(this.goalPos,this.goalLook).normalize(),this.goalPos.addScaledVector(Nc,3*this.pull))}update(e,t,n,s){if(this.sTween){const r=jn((t-this.sTween.start)/this.sTween.dur,0,1);this.s=this.sTween.from+(this.sTween.to-this.sTween.from)*this.sTween.ease(r),r>=1&&(this.sTween=null)}else this.mode==="free"&&(!this.dragging&&Math.abs(this.v)>1e-4&&(this.s+=this.v*e,this.v*=Math.exp(-e*5)),this.s=jn(this.s,this.sMin,this.sMax));if(this.solveGoal(s),this.poseTween&&!this.reduced){const r=jn((t-this.poseTween.start)/this.poseTween.dur,0,1),a=this.poseTween.ease(r);this.pos.lerpVectors(this.fromPos,this.goalPos,a),this.look.lerpVectors(this.fromLook,this.goalLook,a),r>=1&&(this.poseTween=null)}else this.pos.copy(this.goalPos),this.look.copy(this.goalLook);rr.copy(this.look),!this.touch&&!this.reduced&&(this.px=sn(this.px,this.pxT,4,e),this.py=sn(this.py,this.pyT,4,e),rr.x+=.08*Math.sin(n*gn/11)+this.px,rr.y+=this.py),this.camera.position.copy(this.pos),this.camera.lookAt(rr)}}const ns=new L;class Mv{constructor(){W(this,"sx",new Float32Array(Pt));W(this,"sy",new Float32Array(Pt));W(this,"ok",new Uint8Array(Pt));W(this,"lastAt",-1e9)}refresh(e,t,n,s,r,a=!1){if(!(!a&&r-this.lastAt<16)){this.lastAt=r;for(let o=0;o<Pt;o+=1){if(ns.set(t[o*3],t[o*3+1],t[o*3+2]).project(e),ns.z>1||ns.z<-1){this.ok[o]=0;continue}this.ok[o]=1,this.sx[o]=(ns.x+1)/2*n,this.sy[o]=(1-ns.y)/2*s}}}nearest(e,t,n){let s=-1,r=n*n,a=-1,o=1/0;for(let l=0;l<Pt;l+=1){if(!this.ok[l])continue;const h=this.sx[l]-e,d=this.sy[l]-t,u=h*h+d*d;u<r?(a=s,o=r,s=l,r=u):u<o&&(a=l,o=u)}if(s<0)return null;let c=null;if(a>=0&&o<=n*n){const l=this.sx[a]-this.sx[s],h=this.sy[a]-this.sy[s];l*l+h*h<=400&&(c=Ut[a].id)}return{id:Ut[s].id,index:s,alt:c,x:this.sx[s],y:this.sy[s]}}screenOf(e){return this.ok[e]?{x:this.sx[e],y:this.sy[e]}:null}}const Sv=`
#define PI 3.14159265359
#define TAU 6.28318530718
uniform float uTime;
uniform float uTuning;
uniform float uResonance;
uniform float uCutoff;

vec3 basePos(float t) {
  return vec3(
    4.2 * sin(t * TAU * uTuning + 0.7),
    2.6 * cos(t * TAU * uTuning * 0.5),
    mix(-70.0, 0.0, t)
  );
}

void frameAt(float t, out vec3 T, out vec3 n1, out vec3 n2) {
  T = normalize(basePos(t + 0.002) - basePos(t - 0.002));
  n1 = cross(T, vec3(0.0, 1.0, 0.0));
  if (dot(n1, n1) < 0.0025) n1 = cross(T, vec3(1.0, 0.0, 0.0));
  n1 = normalize(n1);
  n2 = cross(n1, T);
}

float wob(float t, float k) {
  return 0.5 * sin(t * 97.3 + uTime * 0.15 + k * 1.7)
       + 0.3 * sin(t * 211.7 - uTime * 0.11 + k * 0.9)
       + 0.2 * sin(t * 389.1 + uTime * 0.07 + k * 2.3);
}

vec3 fullPos(float t) {
  vec3 T; vec3 n1; vec3 n2;
  frameAt(t, T, n1, n2);
  float c = t * TAU * 38.0;
  float r = uResonance * 0.9;
  float w = uCutoff * 0.6;
  return basePos(t)
    + n1 * (r * cos(c) + w * wob(t, 0.0))
    + n2 * (r * sin(c) + w * wob(t, 1.0));
}
`,yv=`
precision highp float;
${Sv}
attribute float aT;
attribute float aSide;
uniform float uEnvMod;
uniform float uDecay;
uniform float uFlow;
uniform float uWidthMul;
uniform float uWrapA;
uniform float uTurnsA;
uniform float uFocusTA;
uniform vec3 uFocusPosA;
uniform vec3 uFocusN1A;
uniform vec3 uFocusN2A;
uniform vec3 uFocusTanA;
uniform float uWrapB;
uniform float uTurnsB;
uniform float uFocusTB;
uniform vec3 uFocusPosB;
uniform vec3 uFocusN1B;
uniform vec3 uFocusN2B;
uniform vec3 uFocusTanB;
varying float vT;
varying float vSide;
varying float vDash;
varying float vE;

// Enroulement autour d'une perle : remplace le chemin sur +-0.03 en t.
vec3 wrapSlot(vec3 p, float t, float focusT, float wrap, float turns, vec3 fp, vec3 n1, vec3 n2, vec3 tan, inout float eAcc) {
  float u = (t - focusT) / 0.03;
  float e = (1.0 - smoothstep(0.55, 1.0, abs(u))) * wrap;
  float a = u * turns * PI;
  vec3 w = fp + 0.5 * (cos(a) * n1 + sin(a) * n2) + tan * u * 0.35;
  eAcc = max(eAcc, e);
  return mix(p, w, e);
}

vec3 wrapped(float t, out float e) {
  e = 0.0;
  vec3 p = fullPos(t);
  p = wrapSlot(p, t, uFocusTB, uWrapB, uTurnsB, uFocusPosB, uFocusN1B, uFocusN2B, uFocusTanB, e);
  p = wrapSlot(p, t, uFocusTA, uWrapA, uTurnsA, uFocusPosA, uFocusN1A, uFocusN2A, uFocusTanA, e);
  return p;
}

// Le courant : tirets espaces de 0.16 en t, partant de la perle en lecture
// dans les deux sens a 0.25 t/s ; uDecay = longueur de la queue.
float dashAt(float t) {
  float d = abs(t - uFocusTA);
  float ph = fract(d * 6.25 - uTime * 1.5625);
  return (1.0 - smoothstep(0.0, uDecay, ph * 0.16)) * uFlow;
}

void main() {
  float e; float ea; float eb;
  vec3 P = wrapped(aT, e);
  vec3 Pa = wrapped(aT + 0.002, ea);
  vec3 Pb = wrapped(aT - 0.002, eb);
  vec3 tangent = normalize(Pa - Pb);
  vec3 viewDir = normalize(cameraPosition - P);
  vec3 side = cross(tangent, viewDir);
  float sl = length(side);
  if (sl < 0.05) side = mix(vec3(0.0, 1.0, 0.0), side, sl / 0.05);
  side = normalize(side);
  float dash = dashAt(aT);
  float hw = 0.07 * uWidthMul
    * (1.0 + 0.08 * sin(uTime * 3.77 + aT * 20.0))
    * (1.0 + 1.5 * uEnvMod * dash);
  vec3 pos = P + side * hw * aSide;
  vT = aT;
  vSide = aSide;
  vDash = dash;
  vE = e;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`,Ev=`
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uBright;
uniform float uReveal;
uniform float uDim;
uniform float uFlow;
uniform float uAccent;
uniform float uGhostOn;
uniform float uGhostT;
uniform float uSoft;
uniform float uHaloE;
uniform float uWrapGlow;
varying float vT;
varying float vSide;
varying float vDash;
varying float vE;

void main() {
  float s = abs(vSide);
  float fw = fwidth(vSide) * 1.5;
  float a = 1.0 - smoothstep(1.0 - fw, 1.0, s);
  // Halo : profil doux (carre de la distance au centre) au lieu d'une bande
  a *= mix(1.0, (1.0 - s) * (1.0 - s), uSoft);
  // Reveal : la ligne se dessine du nom (t = 0) vers maintenant (t = 1)
  a *= 1.0 - smoothstep(uReveal, uReveal + 0.02, vT);
  a *= uDim * uAlpha * (1.0 - 0.3 * vE * uHaloE);
  float ghost = 0.3 * uGhostOn * (1.0 - smoothstep(0.0, 0.08, abs(vT - uGhostT))) * step(vT, uGhostT);
  vec3 col = uColor * (uBright + 1.2 * vDash * uFlow * uAccent + ghost + 0.2 * vE * uWrapGlow);
  gl_FragColor = vec4(col, a);
}
`,bv=`
precision highp float;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,Tv=`
precision highp float;
varying vec2 vUv;
void main() {
  vec3 top = vec3(0.098);
  vec3 bot = vec3(0.047);
  vec3 c = mix(bot, top, vUv.y);
  float v = 1.0 - 0.25 * smoothstep(0.35, 1.0, length(vUv - 0.5) * 1.35);
  gl_FragColor = vec4(c * v, 1.0);
}
`,Av=`
precision highp float;
uniform vec2 uRes;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float g = hash(vUv * uRes + uTime);
  gl_FragColor = vec4(vec3(g * 0.045), 1.0);
}
`,wv=`
precision highp float;
varying float vAngle;
void main() {
  vAngle = atan(position.y, position.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,Rv=`
precision highp float;
uniform float uProgress;
varying float vAngle;
void main() {
  float a = fract((1.5707963 - vAngle) / 6.28318530718);
  vec3 red = vec3(1.0, 0.23, 0.12);
  vec3 c = mix(vec3(0.16), red, 1.0 - smoothstep(uProgress - 0.004, uProgress + 0.004, a));
  float notch = clamp(step(a, 0.008) + step(0.992, a), 0.0, 1.0);
  c = mix(c, vec3(0.965, 0.945, 0.906), notch);
  gl_FragColor = vec4(c, 1.0);
}
`,Ic=new We(.965,.945,.906),Cv=new We(1,.992,.973),Dc=(i,e)=>({[`uWrap${i}`]:{value:0},[`uTurns${i}`]:{value:2},[`uFocusT${i}`]:{value:e},[`uFocusPos${i}`]:{value:new L},[`uFocusN1${i}`]:{value:new L(1,0,0)},[`uFocusN2${i}`]:{value:new L(0,1,0)},[`uFocusTan${i}`]:{value:new L(0,0,1)}});class Sr{constructor(e,t){W(this,"group",new ni);W(this,"u");W(this,"halo");W(this,"body");W(this,"core");W(this,"haloMat");W(this,"bodyMat");W(this,"coreMat");W(this,"geom");W(this,"segments");this.segments=e,this.u={uTime:{value:0},uTuning:{value:1},uResonance:{value:.25},uCutoff:{value:.5},uEnvMod:{value:.5},uDecay:{value:.066},uAccent:{value:1},uFlow:{value:0},uReveal:{value:0},uDim:{value:1},uGhostOn:{value:0},uGhostT:{value:0},uWrapGlow:{value:0},...Dc("A",.94),...Dc("B",.94)},this.geom=Sr.buildGeometry(e);const n=r=>new Kt({vertexShader:yv,fragmentShader:Ev,uniforms:{...this.u,...r},transparent:!0,depthWrite:!1,depthTest:!0,blending:_s,side:fn,toneMapped:!1});this.haloMat=n({uWidthMul:{value:3.75},uAlpha:{value:.14},uBright:{value:1},uColor:{value:Ic.clone()},uSoft:{value:1},uHaloE:{value:1}}),this.bodyMat=n({uWidthMul:{value:1},uAlpha:{value:.9},uBright:{value:.95},uColor:{value:Ic.clone()},uSoft:{value:0},uHaloE:{value:0}}),this.coreMat=t?n({uWidthMul:{value:.3},uAlpha:{value:1},uBright:{value:1},uColor:{value:Cv.clone()},uSoft:{value:0},uHaloE:{value:0}}):null;const s=(r,a)=>{const o=new vt(this.geom,r);return o.frustumCulled=!1,o.renderOrder=a,this.group.add(o),o};this.halo=s(this.haloMat,10),this.body=s(this.bodyMat,11),this.core=this.coreMat?s(this.coreMat,12):null}static buildGeometry(e){const t=(e+1)*2,n=new Float32Array(t),s=new Float32Array(t);for(let o=0;o<=e;o+=1){const c=o/e;n[2*o]=c,s[2*o]=-1,n[2*o+1]=c,s[2*o+1]=1}const r=new Uint32Array(e*6);for(let o=0;o<e;o+=1){const c=2*o,l=6*o;r[l]=c,r[l+1]=c+1,r[l+2]=c+2,r[l+3]=c+1,r[l+4]=c+3,r[l+5]=c+2}const a=new kt;return a.setAttribute("position",new Ft(new Float32Array(t*3),3)),a.setAttribute("aT",new Ft(n,1)),a.setAttribute("aSide",new Ft(s,1)),a.setIndex(new Ft(r,1)),a}rebuild(e){if(e===this.segments)return;const t=Sr.buildGeometry(e);this.halo.geometry=t,this.body.geometry=t,this.core&&(this.core.geometry=t),this.geom.dispose(),this.geom=t,this.segments=e}setHaloVisible(e){this.halo.visible=e}dispose(){var e;this.geom.dispose(),this.haloMat.dispose(),this.bodyMat.dispose(),(e=this.coreMat)==null||e.dispose()}}const Uc=new L(0,1,0),Fc=new We(.965,.945,.906),Pv=new We(1,.23,.12),Vn=new L,Oc=new L,Ci=new L,Pi=new L,Hn=new ht,is=new Ln,xa=new L(1,1,1),Ma=Cr(),Bc=i=>Math.PI/2-(i+.5)*(gn/16);function Lv(){const i=document.createElement("canvas");i.width=64,i.height=64;const e=i.getContext("2d");if(e){const n=e.createRadialGradient(32,32,0,32,32,32);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.35,"rgba(255,255,255,0.45)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,64,64)}const t=new Ud(i);return t.needsUpdate=!0,t}const br=class br{constructor(e,t,n){W(this,"group",new ni);W(this,"rotor",new ni);W(this,"segments");W(this,"leds");W(this,"halos");W(this,"groove");W(this,"playhead");W(this,"lamp");W(this,"t");W(this,"travel",null);W(this,"off",new Float32Array(16));W(this,"springStart",new Float64Array(16));W(this,"popUntil",new Float64Array(16));W(this,"intensity",new Float32Array(16).fill(.06));W(this,"ledBase",new Float32Array(16*3));W(this,"ledColors");W(this,"haloColors");W(this,"rotorAngle",0);W(this,"lastStep",-1);W(this,"heldStep",-1);W(this,"grooveMat");W(this,"disposables",[]);W(this,"lacquer");this.t=e;const s=gn/16-.05,r=-s/2,a=s/2,o=new bh;o.absarc(0,0,.8,r,a,!1),o.lineTo(.66*Math.cos(a),.66*Math.sin(a)),o.absarc(0,0,.66,a,r,!0),o.closePath();const c=new Ho(o,{depth:.14,bevelEnabled:!0,bevelSize:.01,bevelThickness:.01,bevelSegments:2,curveSegments:6});c.translate(0,0,-.07),this.lacquer=t?new ws({color:2500134,roughness:.32,metalness:.3,envMapIntensity:.8}):new yf({color:2302755,roughness:.4,metalness:.15,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.8}),this.segments=new ii(c,this.lacquer,16),this.segments.frustumCulled=!1,this.rotor.add(this.segments),this.disposables.push(c,this.lacquer);const l=new ko(.035,.035,.03,16);l.rotateX(Math.PI/2);const h=new hs({toneMapped:!1});this.leds=new ii(l,h,16),this.leds.frustumCulled=!1,this.ledColors=new Float32Array(16*3),this.leds.instanceColor=new ys(this.ledColors,3),this.rotor.add(this.leds),this.disposables.push(l,h);const d=new Cs(.14,.14),u=Lv(),f=new hs({map:u,transparent:!0,blending:_s,depthWrite:!1,toneMapped:!1});this.halos=new ii(d,f,16),this.halos.frustumCulled=!1,this.halos.renderOrder=5,this.haloColors=new Float32Array(16*3),this.halos.instanceColor=new ys(this.haloColors,3),this.halos.visible=n,this.rotor.add(this.halos),this.disposables.push(d,f,u);for(let p=0;p<16;p+=1){const E=p%4===0?Pv:Fc;this.ledBase[p*3]=E.r,this.ledBase[p*3+1]=E.g,this.ledBase[p*3+2]=E.b;const w=Bc(p);Vn.set(.73*Math.cos(w),.73*Math.sin(w),.085),is.identity(),Hn.compose(Vn,is,xa),this.leds.setMatrixAt(p,Hn),Vn.z=.1,Hn.compose(Vn,is,xa),this.halos.setMatrixAt(p,Hn)}this.leds.instanceMatrix.needsUpdate=!0,this.halos.instanceMatrix.needsUpdate=!0;const g=new Ar(.83,.02,8,128);this.grooveMat=new Kt({vertexShader:wv,fragmentShader:Rv,uniforms:{uProgress:{value:0}},toneMapped:!1}),this.groove=new vt(g,this.grooveMat),this.groove.frustumCulled=!1,this.disposables.push(g,this.grooveMat);const S=new qn(.05,.1,.05),m=new hs({color:Fc,toneMapped:!1});this.playhead=new vt(S,m),this.playhead.position.set(0,.93,.02),this.playhead.frustumCulled=!1,this.disposables.push(S,m),this.lamp=new Xo(16183783,8,10,2),this.lamp.position.set(0,.25,.9),this.group.add(this.rotor,this.groove,this.playhead,this.lamp),this.writeSegments()}setHalosVisible(e){this.halos.visible=e}travelTo(e,t,n,s=.9){if(!(Math.abs(e-this.t)<1e-5)){if(n){this.t=e,this.travel=null;return}this.travel={from:this.t,to:e,start:t,dur:s}}}finish(){this.travel&&(this.t=this.travel.to,this.travel=null)}clamp(e){for(let t=0;t<16;t+=1)this.off[t]=.5,this.springStart[t]=e+t*.02}writeSegments(){for(let e=0;e<16;e+=1){const t=Bc(e);Vn.set(Math.cos(t)*this.off[e],Math.sin(t)*this.off[e],0),is.setFromAxisAngle(Pi.set(0,0,1),t),Hn.compose(Vn,is,xa),this.segments.setMatrixAt(e,Hn)}this.segments.instanceMatrix.needsUpdate=!0}computeIntensity(e,t,n){if(n.fill(.06),!e.ledsOff){if(e.mode==="boot"&&!e.reduced){const s=(e.bootT-.2)/.04;if(s<0)return;if(s<16)for(let r=0;r<16;r+=1)r<=s&&s-r<3&&(n[r]=1-(s-r)/3);else if(s<32){const r=31-s;for(let a=0;a<16;a+=1)a>=r&&a-r<3&&(n[a]=1-(a-r)/3)}return}if(e.reduced){if(e.mode==="playing"||e.mode==="paused"){const s=e.mode==="playing"?1:.4;for(let r=0;r<16;r+=1)e.progress>r/16&&(n[r]=s)}else e.mode==="loading"&&n.fill(.25);return}switch(e.mode){case"loading":{const s=Math.floor(t/.3)%16;n[s]=.6,n[(s+15)%16]=.3;return}case"playing":{const s=e.step;if(s<0)return;n[s]=1,n[(s+15)%16]=.45,n[(s+14)%16]=.2;return}case"paused":{const s=this.heldStep;if(s<0)return;n[s]=.4,n[(s+15)%16]=.4,n[(s+14)%16]=.4;return}default:{const s=t%4;s<.4?n[0]=.06+.34*(s/.4):s<1.6&&(n[0]=.4-.34*((s-.4)/1.2))}}}}update(e,t,n,s,r){if(this.travel){const h=xc((n-this.travel.start)/this.travel.dur);this.t=this.travel.from+(this.travel.to-this.travel.from)*dr(h),h>=1&&(this.travel=null,r.reduced||this.clamp(n))}ps(this.t,s,t,Vn),Pr(this.t,s.tuning,Ma),Pi.copy(Ma.T),Ci.copy(Uc).addScaledVector(Pi,-Uc.dot(Pi)),Ci.lengthSq()<1e-4&&Ci.copy(Ma.n2),Ci.normalize(),Oc.crossVectors(Ci,Pi),Hn.makeBasis(Oc,Ci,Pi),this.group.quaternion.setFromRotationMatrix(Hn),this.group.position.copy(Vn),r.mode==="playing"&&r.step>=0&&r.step!==this.lastStep&&(r.reduced||(this.popUntil[r.step]=n+.08),this.lastStep=r.step,this.heldStep=r.step),r.mode!=="playing"&&r.mode!=="paused"&&(this.lastStep=-1,this.heldStep=-1);let a=!1;for(let h=0;h<16;h+=1){if(n<this.springStart[h])continue;const d=n<this.popUntil[h],u=d?.06:0,f=r.reduced?u:sn(this.off[h],u,d?30:12,e);Math.abs(f-this.off[h])>1e-5&&(this.off[h]=Math.abs(f-u)<1e-4?u:f,a=!0)}a&&this.writeSegments();const o=-r.progress*gn;this.rotorAngle=r.reduced?o:sn(this.rotorAngle,o,6,e),this.rotor.rotation.z=this.rotorAngle,this.grooveMat.uniforms.uProgress.value=xc(-this.rotorAngle/gn);const c=br.target;this.computeIntensity(r,n,c);let l=!1;for(let h=0;h<16;h+=1){const d=this.intensity[h],u=r.reduced||c[h]>d?c[h]:sn(d,c[h],40,e);Math.abs(u-d)>1e-4&&(this.intensity[h]=u,l=!0)}if(l){for(let h=0;h<16;h+=1){const d=this.intensity[h],u=h*3;this.ledColors[u]=this.ledBase[u]*d,this.ledColors[u+1]=this.ledBase[u+1]*d,this.ledColors[u+2]=this.ledBase[u+2]*d,this.haloColors[u]=this.ledColors[u]*.8,this.haloColors[u+1]=this.ledColors[u+1]*.8,this.haloColors[u+2]=this.ledColors[u+2]*.8}this.leds.instanceColor&&(this.leds.instanceColor.needsUpdate=!0),this.halos.instanceColor&&(this.halos.instanceColor.needsUpdate=!0)}}worldPosition(e){return e.copy(this.group.position)}dispose(){for(const e of this.disposables)e.dispose();this.segments.dispose(),this.leds.dispose(),this.halos.dispose()}};W(br,"target",new Float32Array(16));let bo=br;const kc=()=>({id:null,t:.94,wrap:0,turns:2,pos:new L,frame:Cr()}),Nv=2.4;function zc(i,e,t,n){const s=new kt;s.setAttribute("position",new Ft(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));const r=new Kt({vertexShader:bv,fragmentShader:i,uniforms:e,depthTest:!1,depthWrite:!1,transparent:n,blending:n?_s:void 0,toneMapped:!1}),a=new vt(s,r);return a.frustumCulled=!1,a.renderOrder=t,a}class Yo{constructor(e){W(this,"renderer");W(this,"scene",new ph);W(this,"rig");W(this,"ribbon");W(this,"beads");W(this,"seq");W(this,"monolith");W(this,"stats",{frames:0,calls:0,triangles:0,tier:"full",avgMs:0});W(this,"tier");W(this,"canvas");W(this,"opts");W(this,"env");W(this,"envRT");W(this,"bg");W(this,"grain");W(this,"picker",new Mv);W(this,"tweens",new ev);W(this,"clock",new J_);W(this,"raf",0);W(this,"running",!1);W(this,"disposed",!1);W(this,"dirty",!0);W(this,"time",0);W(this,"lastNow",-1);W(this,"bootStart");W(this,"introDone",!1);W(this,"reveal",0);W(this,"lampI",0);W(this,"flow",0);W(this,"dim",1);W(this,"idleSince",-1);W(this,"focusId",null);W(this,"slotA",kc());W(this,"slotB",kc());W(this,"prevSelected",null);W(this,"prevCurrent",null);W(this,"prevPlaying",!1);W(this,"prevGroup",Ve.group);W(this,"prevDrawer",Ve.drawer);W(this,"prevStep",-1);W(this,"ku",{tuning:1,cutoff:.5,resonance:.25,envmod:.5,decay:.066,accent:1});W(this,"knobsMoving",!1);W(this,"probeFrames",-1);W(this,"probeSum",0);W(this,"probeCount",0);W(this,"lastCallsWrite",0);W(this,"width",1);W(this,"height",1);W(this,"unsubMotion");W(this,"onVis");W(this,"onLost");W(this,"onRestored");W(this,"tick",()=>{if(!this.running||this.disposed)return;const e=performance.now(),t=this.lastNow<0?1/60:Math.min(.05,(e-this.lastNow)/1e3);this.lastNow=e;try{this.frame(t,e)}catch(s){this.opts.onError("frame",s instanceof Error?s.message:String(s)),this.stopLoop();return}if(Vt.get()&&!this.hasWork()){this.running=!1,this.lastNow=-1;return}this.raf=requestAnimationFrame(this.tick)});this.opts=e,this.tier=e.tier,this.stats.tier=e.tier;const t=Vt.get(),n=e.tier==="low",s=e.isMobile;this.canvas=document.createElement("canvas"),this.canvas.className="v3-canvas",this.canvas.setAttribute("aria-hidden","true"),e.host.appendChild(this.canvas),this.width=Math.max(1,e.host.clientWidth),this.height=Math.max(1,e.host.clientHeight),this.renderer=new R_({canvas:this.canvas,antialias:!s,alpha:!1,powerPreference:"high-performance"}),this.renderer.setPixelRatio(n?1:Math.min(window.devicePixelRatio||1,1.5)),this.renderer.setSize(this.width,this.height,!1),this.renderer.setClearColor(789516,1),this.renderer.toneMapping=wo,this.renderer.toneMappingExposure=1,this.renderer.outputColorSpace=Xt,this.onLost=h=>{h.preventDefault(),this.stopLoop(),e.onContextLost()},this.onRestored=()=>{e.onContextRestored(),this.dirty=!0,this.startLoop()},this.canvas.addEventListener("webglcontextlost",this.onLost,!1),this.canvas.addEventListener("webglcontextrestored",this.onRestored,!1);const r=new po(this.renderer),a=new Y_;this.envRT=r.fromScene(a,.04),this.env=this.envRT.texture,r.dispose(),this.scene.environment=this.env;const o=new ws({color:16777215,metalness:1,roughness:.32,envMapIntensity:.55}),c=n?512:s?1024:2048;this.ribbon=new Sr(c,!s),this.ribbon.setHaloVisible(!n),this.scene.add(this.ribbon.group),this.beads=new yo(o,s?1:2),this.scene.add(this.beads.mesh,this.beads.gates),this.seq=new bo(Wi.t,s,!n),this.scene.add(this.seq.group),this.monolith=new fv(o.clone(),s||n?1500:3e3,s||n?3:2),this.scene.add(this.monolith.mesh,this.monolith.lamp),this.bg=zc(Tv,{},-10,!1),this.grain=zc(Av,{uRes:{value:new ge(this.width,this.height)},uTime:{value:0}},100,!0),this.grain.visible=!n,this.scene.add(this.bg,this.grain),this.rig=new xv(this.width/this.height),this.rig.touch=e.isTouch,this.rig.reduced=t,this.monolith.layout(this.rig.portrait,n),this.monolith.raster(()=>this.requestRender());const l=performance.now()/1e3;this.bootStart=l,this.rig.intro(l),t?this.finishIntro():(this.tweens.run(h=>this.reveal=h,0,1,1.4,bc,l,{delay:.9,tag:"reveal"}),this.tweens.run(h=>this.lampI=h,0,40,.6,Ni,l,{delay:.5,tag:"lamp"}),this.tweens.run(()=>{},0,1,Nv,bc,l,{tag:"intro",onDone:()=>this.finishIntro()})),this.syncKnobs(!0),this.slotA.t=Wi.t,this.slotB.t=Wi.t;try{this.renderer.compile(this.scene,this.rig.camera)}catch(h){e.onError("compile",h instanceof Error?h.message:String(h))}this.unsubMotion=Vt.subscribe(()=>{const h=Vt.get();this.rig.reduced=h,h&&(this.tweens.finishAll(),this.rig.finishAll(),this.seq.finish(),this.beads.popAll(),this.introDone||this.finishIntro()),this.requestRender()}),this.onVis=()=>{document.visibilityState==="hidden"?this.stopLoop():(this.lastNow=-1,this.startLoop())},document.addEventListener("visibilitychange",this.onVis),e.dev&&(window.__v3={renderer:this.renderer,scene:this.scene,state:{bridge:Ve,engine:null},stats:this.stats,line:this}),this.startLoop()}static create(e){var t;try{return new Yo(e)}catch(n){return e.onError("create",n instanceof Error?n.message:String(n)),(t=e.host.querySelector("canvas.v3-canvas"))==null||t.remove(),null}}requestRender(){this.dirty=!0,this.startLoop()}resize(e,t){if(e<1||t<1)return;const n=this.rig.portrait;this.width=e,this.height=t,this.renderer.setSize(e,t,!1),this.rig.setViewport(e/t),this.grain.material.uniforms.uRes.value.set(e,t),n!==this.rig.portrait&&this.monolith.layout(this.rig.portrait,this.tier==="low"),this.requestRender()}skipIntro(){this.introDone||(this.tweens.finishAll(),this.rig.finishAll(),this.seq.finish(),this.beads.popAll(),this.finishIntro())}finishIntro(){this.introDone||(this.introDone=!0,this.reveal=1,this.lampI=40,this.tweens.cancel("reveal"),this.tweens.cancel("lamp"),this.tweens.cancel("intro"),this.beads.popAll(),this.tier==="full"&&!Vt.get()&&(this.probeFrames=0),this.idleSince=performance.now()/1e3,this.opts.onIntroDone(),this.requestRender())}pick(e,t,n){return this.picker.refresh(this.rig.camera,this.beads.positions,this.width,this.height,performance.now(),!0),this.picker.nearest(e,t,n)}screenOf(e){const t=qt[e];return t?(this.picker.refresh(this.rig.camera,this.beads.positions,this.width,this.height,performance.now()),this.picker.screenOf(t.index)):null}dragStart(){this.rig.dragging=!0,this.rig.fling(0)}drag(e){this.rig.dolly(e,performance.now()/1e3),this.requestRender()}dragEnd(e){this.rig.dragging=!1,this.rig.fling(e),this.requestRender()}wheel(e){this.rig.dolly(e,performance.now()/1e3),this.rig.fling(0),this.requestRender()}jumpToT(e){this.rig.jumpTo(e+this.rig.lookAhead,performance.now()/1e3),this.requestRender()}setPointer(e,t){this.rig.setPointer(e,t)}setTier(e){if(e===this.tier)return;this.tier=e,this.stats.tier=e;const t=e==="low";this.renderer.setPixelRatio(t?1:Math.min(window.devicePixelRatio||1,1.5)),this.renderer.setSize(this.width,this.height,!1),this.ribbon.rebuild(t?512:this.opts.isMobile?1024:2048),this.ribbon.setHaloVisible(!t),this.seq.setHalosVisible(!t),this.monolith.layout(this.rig.portrait,t),this.grain.visible=!t;try{sessionStorage.setItem("mm_v3_tier",e)}catch{}this.opts.onTier(e),this.requestRender()}startLoop(){this.running||this.disposed||(this.running=!0,this.raf=requestAnimationFrame(this.tick))}stopLoop(){this.running=!1,cancelAnimationFrame(this.raf)}hasWork(){return this.dirty||this.tweens.alive>0||this.rig.busy||this.knobsMoving}syncKnobs(e,t=1/60){const n=Hh(Tn.get());let s=!1;for(const a of Object.keys(this.ku)){const o=n[a],c=this.ku[a],l=e?o:sn(c,o,12,t);Math.abs(o-l)>1e-4&&(s=!0),this.ku[a]=Math.abs(o-l)<=1e-4?o:l}this.knobsMoving=s;const r=this.ribbon.u;r.uTuning.value=this.ku.tuning,r.uCutoff.value=this.ku.cutoff,r.uResonance.value=this.ku.resonance,r.uEnvMod.value=this.ku.envmod,r.uDecay.value=this.ku.decay,r.uAccent.value=this.ku.accent,this.ribbon.haloMat.uniforms.uWidthMul.value=2.5+2.5*this.ku.cutoff,this.ribbon.haloMat.uniforms.uAlpha.value=.08+.12*this.ku.cutoff,this.ribbon.bodyMat.uniforms.uBright.value=.7+.5*this.ku.cutoff}setSlot(e,t){e.id=t?t.id:null,e.t=t?t.t:Wi.t}writeSlot(e,t){const n=this.ribbon.u,s=e.id?qt[e.id]:null;s&&this.beads.positionOf(s.index,e.pos),Pr(e.t,this.ku.tuning,e.frame),n[`uWrap${t}`].value=e.wrap,n[`uTurns${t}`].value=e.turns,n[`uFocusT${t}`].value=e.t,n[`uFocusPos${t}`].value.copy(e.pos),n[`uFocusN1${t}`].value.copy(e.frame.n1),n[`uFocusN2${t}`].value.copy(e.frame.n2),n[`uFocusTan${t}`].value.copy(e.frame.T)}diffBridge(e,t){const n=Ve.currentId??Ve.selectedId;if(n!==this.focusId){const s=n?qt[n]:null;this.slotB.id=this.slotA.id,this.slotB.t=this.slotA.t,this.slotB.turns=this.slotA.turns,this.slotB.wrap=this.slotA.wrap,this.slotB.pos.copy(this.slotA.pos),this.slotB.wrap>0&&this.tweens.run(r=>this.slotB.wrap=r,this.slotB.wrap,0,t?0:.4,j_,e,{tag:"wrapB"}),this.tweens.cancel("wrapA"),this.setSlot(this.slotA,s),this.slotA.wrap=0,s&&s.playable&&this.tweens.run(r=>this.slotA.wrap=r,0,1,t?0:.7,qh(1.2),e,{delay:t?0:.15,tag:"wrapA"}),this.seq.travelTo(s?s.t:Wi.t,e,t),this.focusId=n}if(Ve.selectedId!==this.prevSelected&&(Ve.selectedId?this.rig.focusOn(e):this.rig.hold(),this.prevSelected=Ve.selectedId),Ve.currentId!==this.prevCurrent&&(this.prevCurrent=Ve.currentId,Ve.currentId||(this.clock.stop(),this.tweens.run(s=>this.flow=s,this.flow,0,t?0:.4,Ni,e,{tag:"flow"}))),Ve.playing!==this.prevPlaying&&(this.prevPlaying=Ve.playing,Ve.playing?this.clock.start(performance.now()):this.clock.stop(),this.tweens.run(s=>this.flow=s,this.flow,Ve.playing?1:0,t?0:.4,Ni,e,{tag:"flow"})),Ve.group!==this.prevGroup){this.prevGroup=Ve.group;const s=Ve.selectedId?qt[Ve.selectedId]:null;if(Ve.group===4&&(!s||s.kind!=="mixtape")){const r=$t[4].find(a=>{var o;return((o=a.mixtape)==null?void 0:o.number)===37})||$t[4][0];this.beads.positionOf(r.index,this.rig.codaLook),this.rig.coda(e)}}if(Ve.drawer!==this.prevDrawer){const s=Ve.drawer==="info",r=Ve.drawer!=="none";this.tweens.run(a=>this.rig.pull=a,this.rig.pull,s&&!this.opts.isMobile?1:0,t?0:.6,Ni,e,{tag:"pull"}),this.tweens.run(a=>this.dim=a,this.dim,r?.6:1,t?.15:.35,Ni,e,{tag:"dim"}),this.prevDrawer=Ve.drawer}}seqMode(){if(!this.introDone)return"boot";switch(Ve.state){case"loading":return"loading";case"playing":return"playing";case"paused":return"paused";default:return"idle"}}frame(e,t){const n=Vt.get(),s=t/1e3;n||(this.time+=e),this.tweens.update(s),this.syncKnobs(!1,e),this.diffBridge(s,n);const r=s-this.bootStart,a=this.introDone?1:this.reveal;this.beads.update(e,this.time,t,this.ku,{hoverId:Ve.hoverId,selectedId:Ve.selectedId,currentId:Ve.currentId,playing:Ve.playing,group:Ve.group,noticeAt:Ve.noticeAt,noticeId:Ve.noticeId,reveal:a,reduced:n,camPos:this.rig.camera.position});const o=this.slotA.id?qt[this.slotA.id]:null;this.slotA.turns=o&&Ve.currentId===o.id?2+6*Ve.progress:2,this.writeSlot(this.slotA,"A"),this.writeSlot(this.slotB,"B");const c=this.clock.step(t),l=this.seqMode();this.seq.update(e,this.time,s,this.ku,{mode:l,progress:Ve.currentId?Ve.progress:0,step:c,reduced:n,bootT:r,ledsOff:!!o&&!o.playable});const h=l==="playing"?c:-1;h!==this.prevStep&&(this.prevStep=h,this.opts.root&&(this.opts.root.dataset.v3Step=String(h)));const d=Ve.selectedId?qt[Ve.selectedId]:null;d&&this.beads.positionOf(d.index,this.rig.focusPos),this.rig.update(e,s,this.time,this.ku.tuning),this.monolith.lamp.intensity=this.introDone?40:this.lampI;let u=0,f=0;if(Ve.currentId||!this.introDone?this.idleSince=-1:this.idleSince<0&&(this.idleSince=s),this.idleSince>=0&&!n){const S=s-this.idleSince;S>12&&(u=1,f=(S-12)%6/6)}const g=this.ribbon.u;if(g.uTime.value=this.time,g.uFlow.value=this.flow,g.uReveal.value=a,g.uDim.value=this.dim,g.uGhostOn.value=u,g.uGhostT.value=f,g.uWrapGlow.value=n&&Ve.playing?1:0,this.grain.material.uniforms.uTime.value=n?0:this.time,this.renderer.render(this.scene,this.rig.camera),this.dirty=!1,this.stats.frames+=1,this.stats.calls=this.renderer.info.render.calls,this.stats.triangles=this.renderer.info.render.triangles,this.opts.dev&&this.opts.root&&t-this.lastCallsWrite>1e3&&(this.lastCallsWrite=t,this.opts.root.dataset.v3Calls=String(this.stats.calls)),this.probeFrames>=0){if(this.probeFrames+=1,this.probeFrames>=30&&this.probeFrames<90)this.probeSum+=e*1e3,this.probeCount+=1;else if(this.probeFrames>=90){const S=this.probeCount?this.probeSum/this.probeCount:0;this.stats.avgMs=S,this.probeFrames=-1,S>24&&this.setTier("low")}}}dispose(){if(!this.disposed){this.disposed=!0,this.stopLoop(),this.tweens.clear(),this.unsubMotion(),document.removeEventListener("visibilitychange",this.onVis),this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.scene.environment=null,this.ribbon.dispose(),this.beads.dispose(),this.seq.dispose(),this.monolith.dispose();for(const e of[this.bg,this.grain])e.geometry.dispose(),e.material.dispose();this.env.dispose(),this.envRT.dispose(),this.scene.clear(),this.opts.dev&&(window.__v3LastDispose=this.memory(),delete window.__v3),this.renderer.dispose(),this.renderer.forceContextLoss(),this.canvas.remove()}}memory(){return{geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures}}get beadList(){return Ut}}const Iv='a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',Gc=({open:i,kind:e,label:t,onClose:n,returnTo:s,children:r})=>{const a=pe.useRef(null),o=pe.useRef(null),c=pe.useRef(!1);pe.useEffect(()=>{var g;if(i){c.current=!0;const S=window.setTimeout(()=>{var m;return(m=o.current)==null?void 0:m.focus()},30);return()=>window.clearTimeout(S)}c.current&&(c.current=!1,(g=s.current)==null||g.focus())},[i,s]);const l=g=>{if(g.key==="Escape"){g.stopPropagation(),n();return}if(g.key!=="Tab"||!a.current)return;const S=Array.from(a.current.querySelectorAll(Iv)).filter(E=>E.offsetParent!==null);if(!S.length)return;const m=S[0],p=S[S.length-1];g.shiftKey&&document.activeElement===m?(g.preventDefault(),p.focus()):!g.shiftKey&&document.activeElement===p&&(g.preventDefault(),m.focus())},h=pe.useRef(null),d=g=>{h.current=g.clientY},u=g=>{h.current!==null&&g.clientY-h.current>60&&(h.current=null,n())},f=()=>{h.current=null};return O.jsxs(O.Fragment,{children:[O.jsx("div",{className:`v3-scrim${i?" is-open":""}`,"aria-hidden":"true",onClick:n}),O.jsxs("div",{ref:a,className:`v3-drawer is-${e}${i?" is-open":""}`,role:"dialog","aria-modal":"true","aria-label":t,onKeyDown:l,children:[O.jsx("div",{className:"v3-drawer-handle","aria-hidden":"true",onPointerDown:d,onPointerMove:u,onPointerUp:f,onPointerCancel:f,children:O.jsx("i",{})}),O.jsxs("div",{className:"v3-drawer-head",children:[O.jsx("h2",{className:"v3-drawer-title",children:t.toUpperCase()}),O.jsx("button",{ref:o,type:"button",className:"v3-drawer-close","aria-label":"Close",onClick:n,children:O.jsx("svg",{viewBox:"0 0 16 16",width:"14",height:"14","aria-hidden":"true",children:O.jsx("path",{d:"M3 3l10 10M13 3L3 13",stroke:"currentColor",strokeWidth:"1.6"})})})]}),O.jsx("div",{className:"v3-drawer-body",children:r})]})]})},Dv=({icon:i,label:e})=>{const t=i?ou[i]:void 0;return t?O.jsx("svg",{viewBox:t.vb,width:"18",height:"18","aria-hidden":"true",focusable:"false",children:O.jsx("path",{d:t.d,fill:"currentColor"})}):O.jsx("span",{className:"v3-social-initial","aria-hidden":"true",children:e.charAt(0)})},Vc=({inline:i=!1})=>{const e=K_();return O.jsxs("div",{className:`v3-info${i?" is-inline":""}`,children:[i&&O.jsx("h2",{className:"v3-drawer-title",children:"INFO"}),O.jsx("p",{className:"v3-info-brand",children:"MAUDITE MACHINE"}),O.jsx("p",{className:"v3-info-line",children:"raw machine grooves with a human pulse"}),O.jsx("p",{className:"v3-info-line v3-info-sub",children:"Hypnotic techno. VRSTL Records. 8day."}),O.jsxs("section",{className:"v3-info-section","aria-labelledby":"v3-info-booking",children:[O.jsx("h3",{id:"v3-info-booking",className:"v3-info-head",children:"BOOKING"}),O.jsx("ul",{className:"v3-info-list",children:lu.map(t=>O.jsxs("li",{children:[O.jsx("span",{className:"v3-info-label",children:t.label.en+(t.name?`, ${t.name}`:"")}),O.jsx("a",{className:"v3-info-link",href:`mailto:${t.email}`,children:t.email})]},t.id))})]}),O.jsxs("section",{className:"v3-info-section","aria-labelledby":"v3-info-press",children:[O.jsx("h3",{id:"v3-info-press",className:"v3-info-head",children:"PRESS"}),O.jsxs("ul",{className:"v3-info-list",children:[O.jsx("li",{children:O.jsx("a",{className:"v3-info-link",href:"/Presskit_Maudite_Machine_2026-27.pdf",target:"_blank",rel:"noopener",children:"Press kit (PDF)"})}),O.jsx("li",{children:O.jsx(Sa,{className:"v3-info-link",to:"/techrider",children:"Tech rider"})}),O.jsx("li",{children:O.jsx("a",{className:"v3-info-link",href:"/press/",children:"Press assets"})})]})]}),O.jsxs("section",{className:"v3-info-section","aria-labelledby":"v3-info-listen",children:[O.jsx("h3",{id:"v3-info-listen",className:"v3-info-head",children:"LISTEN"}),O.jsx("ul",{className:"v3-info-list",children:O.jsx("li",{children:O.jsx("a",{className:"v3-info-link",href:uu,target:"_blank",rel:"noopener",children:"SoundCloud profile"})})})]}),O.jsxs("section",{className:"v3-info-section","aria-labelledby":"v3-info-socials",children:[O.jsx("h3",{id:"v3-info-socials",className:"v3-info-head",children:"SOCIALS"}),O.jsx("ul",{className:"v3-socials",children:cu.map(t=>O.jsx("li",{children:O.jsx("a",{className:"v3-social",href:t.href,target:"_blank",rel:"noopener","aria-label":t.label,title:t.label,children:O.jsx(Dv,{icon:t.icon,label:t.label})})},t.label))})]}),O.jsxs("section",{className:"v3-info-section","aria-labelledby":"v3-info-calm",children:[O.jsx("h3",{id:"v3-info-calm",className:"v3-info-head",children:"MOTION"}),O.jsxs("label",{className:"v3-calm",children:[O.jsx("input",{type:"checkbox",checked:e,onChange:t=>Vt.setCalm(t.target.checked)}),O.jsx("span",{children:"Calm mode"}),O.jsx("span",{className:"v3-calm-note",children:"No intro, no continuous animation."})]})]}),O.jsx("p",{className:"v3-info-foot",children:O.jsx(Sa,{className:"v3-info-link",to:"/",children:"Main site"})})]})},Uv=({activeT:i,onJump:e})=>{let t=-1;if(i!==null)for(let n=0;n<Dr.length;n+=1)Dr[n].t<=i+1e-6&&(t=n);return O.jsx("nav",{className:"v3-ruler","aria-label":"Years",children:Dr.map((n,s)=>O.jsx("button",{type:"button",className:`v3-ruler-btn${s===t?" is-active":""}`,"aria-current":s===t?"true":void 0,onClick:()=>e(n.t),children:n.label},n.label))})},Fv=({x:i,y:e,text:t})=>O.jsx("div",{className:`v3-tooltip${t?" is-on":""}`,role:"tooltip","aria-hidden":!t,style:{transform:`translate(${Math.round(i)+14}px, ${Math.round(e)-10}px)`},children:t}),Yh=pe.forwardRef(({drawer:i,onTracklist:e,onInfo:t,tracklistRef:n,infoRef:s},r)=>O.jsxs("header",{className:"v3-top",ref:r,children:[O.jsxs("div",{className:"v3-brand",children:[O.jsx(Sa,{to:"/",className:"v3-wordmark","aria-label":"Maudite Machine, main site",children:"MAUDITE MACHINE"}),O.jsx("span",{className:"v3-tagline",children:"raw machine grooves with a human pulse"})]}),O.jsxs("nav",{className:"v3-top-nav","aria-label":"Menu",children:[O.jsx("button",{ref:n,type:"button",className:`v3-top-btn${i==="tracklist"?" is-active":""}`,"aria-expanded":i==="tracklist",onClick:e,children:"TRACKLIST"}),O.jsx("button",{ref:s,type:"button",className:`v3-top-btn${i==="info"?" is-active":""}`,"aria-expanded":i==="info",onClick:t,children:"INFO"})]})]}));Yh.displayName="TopBar";const Ov=({bead:i,n:e,current:t,playing:n,onPlay:s})=>{var o;const r=String(e).padStart(2,"0"),a=i.mixtape?i.mixtape.duration:String(i.year);return i.playable?O.jsx("li",{className:`v3-row${t?" is-current":""}`,children:O.jsxs("button",{type:"button",className:"v3-row-btn","aria-label":`${t&&n?"Pause":"Play"} ${i.track.title}, ${i.year}, ${i.categoryLabel}`,"aria-current":t?"true":void 0,onClick:()=>s(i),children:[(o=i.mixtape)!=null&&o.artwork?O.jsx("img",{className:"v3-row-art",src:i.mixtape.artwork,alt:"",width:40,height:40,loading:"lazy",decoding:"async"}):O.jsx("span",{className:"v3-row-num",children:r}),O.jsxs("span",{className:"v3-row-title",children:[O.jsx("i",{className:"v3-row-dot","aria-hidden":"true"}),i.track.title]}),O.jsx("span",{className:"v3-row-year",children:a})]})}):O.jsxs("li",{className:"v3-row is-unplayable",children:[O.jsx("span",{className:"v3-row-num",children:r}),O.jsx("span",{className:"v3-row-title",children:i.track.title}),O.jsx("span",{className:"v3-row-meta",children:"not on SoundCloud"}),O.jsx("a",{className:"v3-row-link",href:i.track.link,target:"_blank",rel:"noopener",children:"Bandcamp"})]})},Hc=({currentId:i,playing:e,onPlay:t,inline:n=!1})=>O.jsxs("div",{className:`v3-tracklist${n?" is-inline":""}`,children:[n&&O.jsx("h2",{className:"v3-drawer-title",children:"TRACKLIST"}),Ea.map(s=>O.jsxs("section",{className:"v3-tl-section","aria-label":`${fr[s]} ${ul[s]}`,children:[O.jsxs("h3",{className:"v3-tl-head",children:[O.jsx("span",{className:"v3-tl-roman",children:fr[s]}),O.jsx("span",{children:ul[s]}),O.jsx("span",{className:"v3-tl-count",children:$t[s].length})]}),O.jsx("ul",{className:"v3-tl-list",children:$t[s].map((r,a)=>O.jsx(Ov,{bead:r,n:a+1,current:i===r.id,playing:e,onPlay:t},r.id))})]},s))]}),Wc=!1,Xc=()=>{try{return sessionStorage.getItem("mm_v3_tier")==="low"?"low":"full"}catch{return"full"}};function qc(i){const e=pe.useMemo(()=>window.matchMedia(i),[i]);return pe.useSyncExternalStore(t=>(e.addEventListener("change",t),()=>e.removeEventListener("change",t)),()=>e.matches,()=>!1)}class Bv extends pe.Component{constructor(){super(...arguments);W(this,"state",{failed:!1})}static getDerivedStateFromError(){return{failed:!0}}componentDidCatch(t,n){var s;this.props.onError("stage",`${t.message} ${((s=n.componentStack)==null?void 0:s.split(`
`)[1])??""}`.trim())}render(){return this.state.failed?null:this.props.children}}const kv=()=>{const i=Au(),{current:e,playing:t,progress:n,duration:s,notice:r}=i,a=$_(),o=qc("(max-width: 767px)"),c=qc("(hover: none) and (pointer: coarse)"),l=pe.useRef(null),h=pe.useRef(null),d=pe.useRef(null),u=pe.useRef(null),f=pe.useRef(null),g=pe.useRef(null),S=pe.useRef(null),m=pe.useRef(!1),p=pe.useRef(void 0),E=pe.useRef(null),[w,x]=pe.useState("webgl"),[T,b]=pe.useState(Xc),[R,v]=pe.useState(()=>Vt.get()),[y,N]=pe.useState(null),[C,F]=pe.useState(1),[z,D]=pe.useState("none"),[B,Y]=pe.useState(null),[X,re]=pe.useState(!1),[$,te]=pe.useState(!1),[ie,Ne]=pe.useState(!1),[we,Qe]=pe.useState(""),[Ze,tt]=pe.useState(0),[Q,ne]=pe.useState([]),Me=pe.useCallback((ae,P)=>{},[]),Ce=pe.useCallback(ae=>{window.clearTimeout(p.current),re(ae),te(!1),ae&&(p.current=window.setTimeout(()=>{re(!1),te(!0)},8e3))},[]);pe.useEffect(()=>()=>window.clearTimeout(p.current),[]),pe.useEffect(()=>{X&&t&&n>0&&Ce(!1)},[X,t,n,Ce]),pe.useEffect(()=>{const ae=(e==null?void 0:e.id)??null;if(ae===E.current||(E.current=ae,!ae))return;const P=qt[ae];N(ae),P&&(F(le=>ls(P,le)?le:Ir(P,le)),Qe(`Playing: ${P.track.title}`)),Ce(!0)},[e,Ce]),pe.useEffect(()=>{e&&Qe(t?`Playing: ${e.title}`:"Paused")},[t,e]),pe.useEffect(()=>{var P;if(!r)return;const ae=Mu[r];Ve.noticeAt=performance.now(),Ve.noticeId=ae?ae.id:null,tt(le=>le+1),Qe(`Skipped: ${r}`),(P=S.current)==null||P.requestRender()},[r]);const be=R?X?"loading":e?t?"playing":"paused":y?"selected":"idle":"boot",He=y?qt[y]??null:null,at=e?qt[e.id]??null:null,j=He??at,oe=!!j&&!!e&&j.id===e.id;pe.useEffect(()=>{var ae;Ve.currentId=(e==null?void 0:e.id)??null,Ve.selectedId=y,Ve.playing=t,Ve.duration=s,Ve.pending=X,Ve.group=C,Ve.drawer=z,Ve.state=be,Ve.hoverId=(B==null?void 0:B.id)??null,Ve.isTouch=c,(ae=S.current)==null||ae.requestRender()},[e,y,t,s,X,C,z,be,B,c]);const ce=pe.useRef(-1);pe.useEffect(()=>{var P;Ve.progress=n;const ae=Math.floor(n*s);ae!==ce.current&&(ce.current=ae,(P=S.current)==null||P.requestRender())},[n,s]),pe.useLayoutEffect(()=>{document.body.classList.add("v3-active");const ae=document.title;document.title="Maudite Machine | Acid Line";const P=document.querySelector('meta[name="theme-color"]'),le=(P==null?void 0:P.getAttribute("content"))??null;let Z=null;P?P.setAttribute("content","#0C0C0C"):(Z=document.createElement("meta"),Z.name="theme-color",Z.content="#0C0C0C",document.head.appendChild(Z));const fe=document.querySelector('meta[name="robots"]'),ye=(fe==null?void 0:fe.getAttribute("content"))??null;let se=null;return fe?fe.setAttribute("content","noindex, nofollow"):(se=document.createElement("meta"),se.name="robots",se.content="noindex, nofollow",document.head.appendChild(se)),()=>{document.body.classList.remove("v3-active"),document.title=ae,P&&le!==null&&P.setAttribute("content",le),Z==null||Z.remove(),fe&&ye!==null&&fe.setAttribute("content",ye),se==null||se.remove()}},[]),pe.useEffect(()=>{const ae=h.current;if(!ae)return;const P=Yo.create({host:ae,root:l.current,isMobile:window.matchMedia("(max-width: 767px)").matches,isTouch:window.matchMedia("(hover: none) and (pointer: coarse)").matches,tier:Xc(),dev:Wc,onTier:b,onIntroDone:()=>v(!0),onContextLost:()=>x("fallback"),onContextRestored:()=>x("webgl"),onError:Me});if(!P){x("fallback"),v(!0);return}S.current=P;let le=0;const Z=new ResizeObserver(()=>{window.clearTimeout(le),le=window.setTimeout(()=>P.resize(ae.clientWidth,ae.clientHeight),100)});return Z.observe(ae),()=>{window.clearTimeout(le),Z.disconnect(),P.dispose(),S.current=null}},[Me]),pe.useEffect(()=>{},[i]);const he=pe.useCallback(()=>S.current,[]),de=pe.useCallback(ae=>{if(N(ae),te(!1),!ae)return;const P=qt[ae];P&&(F(le=>ls(P,le)?le:Ir(P,le)),Qe(`Selected: ${P.track.title}, ${P.year}, ${P.categoryLabel}`))},[]),ze=pe.useCallback((ae,P)=>{Y(null),N(le=>{const Z=le===ae&&P?P:ae;return window.setTimeout(()=>de(Z),0),le})},[de]),Oe=pe.useCallback(()=>{m.current=!0},[]);B_(d,he,{enabled:w==="webgl",onSelect:ze,onHover:Y,onGesture:Oe});const ke=pe.useCallback(ae=>{if(m.current=!0,!ae.playable)return;const P=ls(ae,C)?C:Ir(ae,C);if(F(P),N(ae.id),te(!1),D("none"),window.setTimeout(()=>{var le;return(le=g.current)==null?void 0:le.focus({preventScroll:!0})},60),(e==null?void 0:e.id)===ae.id){t||Ce(!0),i.toggle();return}Ce(!0),i.play(ae.track,Su[P])},[i,e,t,C,Ce]),qe=pe.useCallback(()=>{m.current=!0,!(!j||!j.playable)&&ke(j)},[j,ke]),I=pe.useCallback(()=>{e&&(m.current=!0,Ce(!0),i.prev())},[i,e,Ce]),it=pe.useCallback(()=>{e&&(m.current=!0,Ce(!0),i.next())},[i,e,Ce]),Je=pe.useCallback(()=>{i.close(),N(null),Ce(!1),te(!1),Qe("Cleared")},[i,Ce]),A=pe.useCallback(()=>{e&&(t||Ce(!0),i.toggle())},[i,e,t,Ce]),_=pe.useCallback(ae=>{e&&i.seek(ae)},[i,e]),k=pe.useCallback(ae=>{F(ae),Qe(`Pattern group ${ae}`)},[]),H=pe.useCallback(ae=>D(P=>P===ae?"none":ae),[]),K=pe.useCallback(()=>D("none"),[]),ue=pe.useCallback(ae=>{const P=yu(y,C,ae);P&&de(P.id)},[y,C,de]),me=pe.useCallback(()=>{m.current=!0,j&&ke(j)},[j,ke]);O_({hasGesture:m,hasCurrent:!!e,drawerOpen:z!=="none",stageRef:d,onToggle:A,onPrev:I,onNext:it,onMoveSelection:ue,onEnter:me,onGroup:k,onEscape:()=>{z!=="none"?K():Y(null)}});const J=pe.useCallback(ae=>{var P;return(P=S.current)==null?void 0:P.jumpToT(ae)},[]),ee=pe.useCallback(()=>{var ae;R||((ae=S.current)==null||ae.skipIntro(),v(!0))},[R]),ve=pe.useCallback(()=>{m.current=!0,ee()},[ee]),De=pe.useCallback(ae=>{ae.key==="Enter"&&(m.current=!0),ae.key!=="Tab"&&ee()},[ee]),xe=B?qt[B.id]:null,_e=B!=null&&B.alt?qt[B.alt]:null,Ue=xe?`${xe.track.title}, ${xe.year}${_e?` / ${_e.track.title}, ${_e.year}`:""}`:null,Ge=!R&&!a&&w==="webgl";return O.jsxs("div",{ref:l,className:"v3-root",style:{position:"fixed"},"data-v3-state":be,"data-v3-selected":y??"","data-v3-current":(e==null?void 0:e.id)??"","data-v3-group":C,"data-v3-notice":r?"1":"0","data-v3-motion":a?"reduced":"full","data-v3-tier":T,"data-v3-gl":w,"data-v3-drawer":z,"data-v3-intro":Ge?"1":"0","data-v3-mock":"0",onPointerUpCapture:ve,onKeyDownCapture:De,children:[O.jsx(Yh,{drawer:z,onTracklist:()=>H("tracklist"),onInfo:()=>H("info"),tracklistRef:u,infoRef:f}),!o&&w==="webgl"&&O.jsx(Uv,{activeT:j?j.t:null,onJump:J}),O.jsxs("div",{ref:d,className:"v3-stage",role:"group",tabIndex:0,"aria-label":"Discography line","aria-describedby":"v3-stage-help",children:[O.jsx("span",{id:"v3-stage-help",className:"v3-sr",children:"Arrow keys move between tracks. Enter plays the selected track. Digits 1 to 4 choose a pattern group."}),O.jsx(Bv,{onError:Me,children:O.jsx("div",{ref:h,className:"v3-canvas-host","aria-hidden":"true"})}),w==="fallback"&&O.jsx(U_,{}),!c&&B&&O.jsx(Fv,{x:B.x,y:B.y,text:Ue})]}),O.jsx(q_,{runRef:g,bead:j,state:be,isCurrent:oe,hasCurrent:!!e,playing:t,progress:n,duration:s,notice:r,noticeKey:Ze,timedOut:$,group:C,isMobile:o,isTouch:c,reduced:a,knobsOpen:ie,onKnobsToggle:()=>Ne(ae=>!ae),onGroup:k,onRun:qe,onBack:I,onFwd:it,onClear:Je,onSeek:_}),w==="fallback"&&O.jsxs("div",{className:"v3-fallback-body",children:[O.jsx(Hc,{currentId:(e==null?void 0:e.id)??null,playing:t,onPlay:ke,inline:!0}),O.jsx(Vc,{inline:!0})]}),O.jsx(Gc,{open:z==="tracklist",kind:"tracklist",label:"Tracklist",onClose:K,returnTo:u,children:O.jsx(Hc,{currentId:(e==null?void 0:e.id)??null,playing:t,onPlay:ke})}),O.jsx(Gc,{open:z==="info",kind:"info",label:"Info",onClose:K,returnTo:f,children:O.jsx(Vc,{})}),O.jsx("div",{className:"v3-sr","aria-live":"polite",role:"status",children:we}),Wc]})},Xv=()=>O.jsx(Tu,{children:O.jsx(kv,{})});export{Xv as default};
