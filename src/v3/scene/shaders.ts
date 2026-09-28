/**
 * GLSL du ruban, du fond, du grain et de la rainure de l'anneau.
 * Le vertex shader du ruban reproduit path.ts a l'identique (base, repere,
 * tremblement, bobine) ; le "wrap" (la ligne qui s'enroule autour de la
 * perle) et le courant (les tirets) n'existent que cote GPU.
 */

const PATH_GLSL = /* glsl */ `
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

// La bobine s'efface a moins de 5.5 unites de la camera (meme formule que
// path.ts) : pas de boucle geante au premier plan
vec3 fullPos(float t) {
  vec3 T; vec3 n1; vec3 n2;
  frameAt(t, T, n1, n2);
  vec3 b = basePos(t);
  float c = t * TAU * 38.0;
  float taper = smoothstep(0.0, 1.0, (distance(b, cameraPosition) - 2.5) / 3.0);
  float r = uResonance * 0.9 * taper;
  float w = uCutoff * 0.6;
  return b
    + n1 * (r * cos(c) + w * wob(t, 0.0))
    + n2 * (r * sin(c) + w * wob(t, 1.0));
}
`;

export const RIBBON_VERT = /* glsl */ `
precision highp float;
${PATH_GLSL}
attribute float aT;
attribute float aSide;
uniform float uEnvMod;
uniform float uDecay;
uniform float uDashTime;
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
// dans les deux sens a 0.25 t/s ; uDecay = longueur de la queue. uDashTime
// est replie sur 64 s cote CPU (100 cycles exacts) : float32 reste precis.
float dashAt(float t) {
  float d = abs(t - uFocusTA);
  float ph = fract(d * 6.25 - uDashTime * 1.5625);
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
`;

export const RIBBON_FRAG = /* glsl */ `
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
`;

/** Triangle plein ecran en clip space (3 sommets, aucune matrice). */
export const SCREEN_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BACKGROUND_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vec3 top = vec3(0.098);
  vec3 bot = vec3(0.047);
  vec3 c = mix(bot, top, vUv.y);
  float v = 1.0 - 0.25 * smoothstep(0.35, 1.0, length(vUv - 0.5) * 1.35);
  gl_FragColor = vec4(c * v, 1.0);
}
`;

export const GRAIN_FRAG = /* glsl */ `
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
`;

export const GROOVE_VERT = /* glsl */ `
precision highp float;
varying float vAngle;
void main() {
  vAngle = atan(position.y, position.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** a = 0 a 12 h, croit dans le sens horaire vu de la camera. */
export const GROOVE_FRAG = /* glsl */ `
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
`;
