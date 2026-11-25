# v39 : remplace par knob-shots.mjs (npm run plugin:arp:knobs, les trois couches rendues par three.js en 1024 px) ; garde pour memoire.
# v37 : decoupe retro/knob.png en knob-base.png (fixe) et knob-grip.png (la prise qui tourne, sans liseré clair). python3 knob-split.py <dossier de knob-orig.png> <sortie>
import sys
from PIL import Image
import numpy as np
S=sys.argv[1]; OUT=sys.argv[2]
a=np.asarray(Image.open(f'{S}/knob-orig.png').convert('RGBA')).astype(float)
H,W,_=a.shape; c=(W-1)/2; R=W/2/1.04
yy,xx=np.mgrid[0:H,0:W]; dx=xx-c; dy=yy-c; r=np.hypot(dx,dy)/R
L=a[...,:3].mean(2)
LOBE,NOTCH=0.85,0.74
grip=lambda t: LOBE-(LOBE-NOTCH)*(0.5-0.5*np.cos(t*6))**3
best=None
for ph in np.radians(np.arange(0,60,0.5)):
    t=np.arctan2(dx,-dy)-ph
    g=grip(t); band_in=(r>g-0.05)&(r<g-0.01); band_out=(r>g+0.01)&(r<g+0.05)
    s=abs(L[band_in].mean()-L[band_out].mean())
    if best is None or s>best[0]: best=(s,ph)
ph=best[1]; print('phase %.1f deg, contraste %.1f'%(np.degrees(ph),best[0]))
t=np.arctan2(dx,-dy)-ph; g=grip(t)
px=1/R  # un pixel en unites de R
m=np.clip((g-r)/(1.2*px)+0.5,0,1)  # 1 dans la prise, bord antialiase
# la prise : sans le liseré clair (Mika : "le relief lumineux sur le bord, j'en veux pas") : on ecrase les hautes lumieres pres du bord
edge=np.clip(1-(g-r)/0.06,0,1)*m
rgb=a[...,:3].copy()
lum=rgb.mean(2,keepdims=True)
cap=np.minimum(lum, 34+ (lum-34)*0.25)
rgb_g=np.where(edge[...,None]>0, rgb*(1-edge[...,None])+ (rgb*np.where(lum>0,cap/np.maximum(lum,1e-3),1))*edge[...,None], rgb)
gp=np.dstack([rgb_g, (m*a[...,3])]).clip(0,255).astype('uint8')
Image.fromarray(gp,'RGBA').save(f'{OUT}/knob-grip.png')
# la base : sous la prise, le gris de la base au meme rayon, interpole sur l'angle depuis les creux visibles
base=a.copy()
ang=np.arctan2(dx,-dy)
vis=(r>g+2*px)
nb=180
for k in range(int(0.66*R),int(0.87*R)+2):
    ring=(r*R>=k)&(r*R<k+1)
    if not ring.any(): continue
    v=ring&vis; hid=ring&~vis
    if not hid.any(): continue
    if v.sum()<6:
        base[hid,:3]=np.array([16,16,16]); continue
    th=ang[v]; order=np.argsort(th); th=th[order]; vals=a[...,:3][v][order]
    th2=np.concatenate([th-2*np.pi,th,th+2*np.pi]); vals2=np.concatenate([vals,vals,vals])
    q=ang[hid]
    for ch in range(3): base[...,ch][hid]=np.interp(q,th2,vals2[:,ch])
base[r<0.66]=[16,16,16,255]
Image.fromarray(base.clip(0,255).astype('uint8'),'RGBA').save(f'{OUT}/knob-base.png')
print('ok')
