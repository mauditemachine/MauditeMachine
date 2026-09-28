# ACID LINE: build spec for mauditemachine.com/v3

Definitive build spec, written after the jury. One engineer, one session, one polished landing.

## Decision record (read once, then build)

Ranking, once the three judges' scores are summed under one name per concept:
ACID LINE 115 (40 + 38 + 37), BENCH 303 106, ORRERY 104, FOUR AM 94, MONOLITH HALL 91.
ACID LINE wins on points and is the only concept every judge called certain to ship polished.

Every judge named the same weakness: the TB-303 exists only as a flat HTML panel, and Mika asked for 3D. This spec fixes that by grafting, not by switching concept:

- From ORRERY (asked by the visitor judge): a real machine in the scene. A 16-segment sequencer ring in dark lacquer with 16 LEDs, a red progress groove and a fixed playhead at 12 o'clock. It lives on the line, travels to the track you pick, clamps around it, and turns under the playhead while the track plays. Accent LEDs on steps 1, 5, 9, 13.
- From MONOLITH HALL (visitor judge, engineer): MAUDITE MACHINE rasterized from the real Larsseit into one InstancedMesh of blocks (3,000 max) standing at the 2012 end of the line. The ribbon pierces it. Zero assets.
- From BENCH 303 (visitor judge): the power-on sequence (black, LED self-test, the line revealed like a light switched on), knob tooltips that say what each knob drives, knob values persisted in localStorage.
- From BENCH 303 and FOUR AM (Mika judge): the real 303 Pattern Group rotary I to IV (I featured, II originals, III remixes, IV mixtapes) instead of an abstract toggle, an HTML TRACKLIST drawer with 44 px rows for all 37 tracks and 5 mixtapes, the copy line "raw machine grooves with a human pulse", and the 4 am darkness (an ink void, one light on the playing track, one on the name).
- From ACID LINE itself (Mika judge, engineer): display honesty (LOADING with an LED chase while the SoundCloud widget spins up, the engine notice for 4 s, a ghost current after 12 s of idle), ref-driven uniform smoothing, on-demand rendering under reduced motion, the 60-frame adaptive tier, screen-space nearest-pick.
- From FOUR AM and MONOLITH (engineer): the beat clock is a plain 130 BPM metronome started when playback starts, explicitly a lighting cue, never a claim of sync; the tracklist bottom sheet is the guaranteed picking surface on mobile; pointerup with a 10 px move tolerance so a drag never selects; the HTML list of tracks, mixtapes, contacts and links exists in the DOM before the canvas does and becomes the no-WebGL page for free.

Cut for good, per the judges: fog, reflective floor, post-processing passes, a modelled 303 body, scroll rails, pistons, cartridges, the UI click sound (zero audio synthesis, period). The 303 is quoted through its panel language and its sequencer, not rebuilt as a product shot.

Owner's hard rules, verbatim and non-negotiable: never trigger real audio playback in any test (DOM and state only); no em dash (U+2014) and no en dash (U+2013) anywhere; zero emoji in the site; prefers-reduced-motion respected with a calm path that still looks finished; real mobile at 375 px, DPR capped at 1.5, no horizontal scroll; do not break existing routes or the build, never edit dist/; comments in French without accents or in English, site copy in English; the SoundCloud widget needs a real click gesture, and the UI must show the current track, play/pause, progress, next/prev, close, and the notice text when a track is skipped. One more owner rule found in the git log (commit "Plus aucune mention de lieu"): no place names in displayed copy (no Montreal, no France, no Montpellier). Contact labels come from the data file and are displayed as data.

---

## 1. The experience

One luminous cream ribbon runs through an ink void from 2012 to now. It is the acid line of the whole discography: every track is a brushed-silver bead threaded on it, the five mixtapes are silver gates at the near end, and MAUDITE MACHINE stands at the far end as a wall of metal blocks the line comes out of. A small dark sequencer ring, the only machine in the room, sits on the line. Pick a bead and the ring runs down the line to it and clamps around it while the line wraps the bead like tape on a reel. Press RUN: the ring turns under its playhead, sixteen LEDs chase at machine tempo, a current of light runs both ways along the whole discography, and the coil winds tighter as the track plays. Six knobs on a 303 panel at the bottom of the screen (TUNING, CUT OFF FREQ, RESONANCE, ENV MOD, DECAY, ACCENT) sculpt the line itself in real time. One page, no scroll, everything playable through the existing SoundCloud engine.

Emotional arc:

- First 3 seconds. Black. The wordmark fades in top left. Far down the void, sixteen tiny LEDs self-test left-right-left on a dark ring, then the name lights up at the end of the tunnel and a cream line draws itself from the name toward you, popping silver beads as it comes and passing through five silver gates in the foreground. The panel slides up. It is a light being switched on in a long room.
- First 10 seconds. The line breathes, the beads turn slowly and catch the light. A hover lights a bead and names it (title, year). Dragging or scrolling dollies you down the line into the past; the name gets bigger. A first click on a bead: the camera eases in, the ring slides down the line and clamps around the bead, the line wraps it, and the panel shows the title with RUN breathing red. Nothing plays until you press RUN. Turning a knob bends the whole line live; that is the acid feeling done honestly.
- When a track plays. The display says LOADING with an LED chase for the second or two the widget needs, then the timecode counts. The ring turns under the playhead, the groove fills red, LEDs chase at sixteenth notes, the current of light leaves the bead in both directions, the coil winds as progress grows, the bead pulses slowly. FWD walks the line to the next track: the ring runs to it, the camera follows. A dead link shows "Skipped: title" for 4 s and the bead flashes red twice.
- When navigating. There is no scroll. Horizontal drag, wheel or a year on the ruler dollies the camera along the line; the ribbon dims when the TRACKLIST or INFO drawer opens so text reads. Group IV on the rotary turns the camera to the five gates. At the end of the dolly into the past, the camera looks straight at the wall of blocks and reads the name.
- On mobile. Full-bleed canvas behind a top bar and a bottom panel. A tap selects, a drag dollies, the TRACKLIST sheet is one tap away and plays with real buttons. The ring and the wrap are framed in the top 60 percent of the screen above the panel. Knobs are 48 px dials behind a KNOBS toggle. Same engine, same states, same honesty.

---

## 2. Scene graph

Scene units are arbitrary; think 1 unit is roughly 1 m. World axes: +z points toward "now", the past is at negative z, +y is up. The camera always looks toward negative z (into the past), so every object's "front" faces +z.

### 2.1 Renderer and environment

- `WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' })`, `setPixelRatio(Math.min(devicePixelRatio, 1.5))`, clear colour `#0C0C0C`, `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.0`, `outputColorSpace = SRGBColorSpace` (default). WebGL2 is required (three r163 and later dropped WebGL1); if `canvas.getContext('webgl2')` returns null, render the fallback page (section 7).
- Environment: `new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture` at 256 px (both tiers), assigned to `scene.environment`; dispose the generator right after. No file download. Materials set their own `envMapIntensity` (0.55 on the metal, 0.8 on the ring) rather than relying on `scene.environmentIntensity`, so the numbers work on any three release from r160 up.
- No fog, no shadows, no post-processing composer. Depth from the ribbon's own halo and the vignette.
- Two fullscreen triangles (one BufferGeometry of 3 vertices in clip space, `frustumCulled = false`, `depthTest = false`, `depthWrite = false`):
  - Background quad, `renderOrder = -10`, opaque: vertical gradient `#191919` at the top to `#0C0C0C` at the bottom, multiplied by a vignette `1.0 - 0.25 * smoothstep(0.35, 1.0, length(vUv - 0.5) * 1.35)`.
  - Grain quad, `renderOrder = 100`, `AdditiveBlending`, `toneMapped = false`: `color = vec3(hash(vUv * uRes + uTime) * 0.045)`. Additive brightening speckle only (no custom blending, no milky blacks). `uTime` is frozen under reduced motion.

### 2.2 The path (the single source of truth)

Everything sits on one analytic path, evaluated identically in GLSL (ribbon vertex shader) and in TypeScript (`scene/path.ts`) for beads, gates, the ring, the camera rail and the SVG fallback. No noise texture, no simplex: the wobble is a sum of three sines so both sides match exactly and beads never float off the line.

```
TAU = 6.28318530718
base(t):   x = 4.2 * sin(t * TAU * uTuning + 0.7)
           y = 2.6 * cos(t * TAU * uTuning * 0.5)
           z = mix(-70.0, 0.0, t)
frame(t):  T  = normalize(base(t + h) - base(t - h)), h = 0.002
           n1 = normalize(cross(T, vec3(0, 1, 0)))  (if length < 0.05 use cross(T, vec3(1, 0, 0)))
           n2 = cross(n1, T)
wob(t, k): 0.5 * sin(t * 97.3 + uTime * 0.15 + k * 1.7)
         + 0.3 * sin(t * 211.7 - uTime * 0.11 + k * 0.9)
         + 0.2 * sin(t * 389.1 + uTime * 0.07 + k * 2.3)
full(t):   base(t)
         + uResonance * 0.9 * (cos(t * TAU * 38.0) * n1 + sin(t * TAU * 38.0) * n2)   (the coil)
         + uCutoff * 0.6 * (wob(t, 0.0) * n1 + wob(t, 1.0) * n2)                       (the wobble)
```

`uTime` is the shared scene clock (seconds, frozen under reduced motion). `path.ts` exports `basePos(t, tuning)`, `frameAt(t, tuning)`, `fullPos(t, knobs, time)` and `smoothPos(s, tuning)` (the camera rail: same as base with x amplitude 2.1 and y amplitude 1.3, no coil, no wobble; the formula is analytic so s may exceed 1).

The wrap, applied in the vertex shader only, replaces the path near the focus bead:

```
u = (aT - uFocusT) / 0.03
e = smoothstep(1.0, 0.55, abs(u)) * uWrap
a = u * uTurns * PI
wrapPos = uFocusPos + 0.5 * (cos(a) * uFocusN1 + sin(a) * uFocusN2) + uFocusTan * u * 0.35
P = mix(full(aT), wrapPos, e)
```

`uFocusPos`, `uFocusN1`, `uFocusN2`, `uFocusTan` are computed on the CPU from `path.ts` each frame for the focus bead (so the wrap follows TUNING). Coil radius 0.5 is a constant: every bead radius is 0.42 or less, the ring's inner radius is 0.66, so the coil always clears both.

### 2.3 The ribbon (3 draw calls, 1 geometry)

- Geometry: indexed triangle strip, N = 2048 segments desktop, 1024 under 768 px, 512 in the low tier. Vertices 2 * (N + 1), two float attributes: `aT` (0..1) and `aSide` (-1 or +1). Built once, rebuilt only on a tier change.
- Vertex shader: `P = wrapped full(aT)` as above; `tangent = normalize(full(aT + 0.002) - full(aT - 0.002))` (wrapped too); `viewDir = normalize(uCamPos - P)`; `side = cross(tangent, viewDir)`; if `length(side) < 0.05` blend toward `vec3(0, 1, 0)`; `side = normalize(side)`. Half width: `hw = 0.07 * uWidthMul * (1.0 + 0.08 * sin(uTime * 3.77 + aT * 20.0)) * (1.0 + 1.5 * uEnvMod * dash(aT))`; `position = P + side * hw * aSide`. Varyings: `vT`, `vSide`, `vDash`.
- Fragment shader: edge feather `alpha = 1.0 - smoothstep(1.0 - fwidth(vSide) * 1.5, 1.0, abs(vSide))`; reveal mask `alpha *= step(vT, uReveal)` softened over 0.02; drawer dim `alpha *= uDim`; inside the wrap envelope scale halo alpha by `(1.0 - 0.3 * e)`; colour `cream * uBright + cream * 1.2 * vDash * uFlow * uAccent + ghost`, where `ghost = cream * 0.3 * uGhostOn * smoothstep(0.08, 0.0, abs(vT - uGhostT)) * step(vT, uGhostT)`.
- The current (dash) function, evaluated in the vertex shader and passed as `vDash`: `d = abs(aT - uFocusT)`; `ph = fract(d * 6.25 - uTime * 1.5625)`, i.e. dashes 0.16 apart in t travelling away from the focus bead at 0.25 t per second in both directions (about 11 units apart, a dash crosses the whole line in 4 s); `dash = smoothstep(uDecay, 0.0, ph * 0.16) * uFlow`. `uDecay` is the tail length in t (0.01 to 0.15), always shorter than the 0.16 period so the line never turns into a continuous glow.
- Three passes of the same geometry, three ShaderMaterials sharing one uniforms object, all `transparent`, `depthWrite: false`, `depthTest: true`, `AdditiveBlending`, `toneMapped: false`, `side: DoubleSide`:
  - halo: `uWidthMul = 2.5 + 2.5 * uCutoff`, alpha `0.08 + 0.12 * uCutoff`, colour cream.
  - body: `uWidthMul = 1.0`, alpha 0.9, colour cream at `uBright = 0.7 + 0.5 * uCutoff`.
  - core: `uWidthMul = 0.3`, alpha 1.0, colour `#FFFDF8`. Desktop only.
  - Render order (`mesh.renderOrder`): background -10, opaque objects 0 (beads, gates, ring, monolith), halo 10, body 11, core 12, grain 100.
- Cream is `#F6F1E7` = `vec3(0.965, 0.945, 0.906)`.

### 2.4 Beads (1 draw call)

- One `InstancedMesh(IcosahedronGeometry(1, 2), metal, 42)`; detail 1 under 768 px. Instances 0..36 are the 37 tracks sorted by releaseDate ascending (ties by trackNo then id), 37..41 are the five mixtape hubs (numbers 35 to 39 ascending).
- `metal = new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.32, envMapIntensity: 0.55 })`. Shared with the gates and the monolith. It is brushed silver from the room environment, no texture.
- Radii: featured 0.42, standard 0.28, unplayable 0.22, mixtape hub 0.24. Per-instance `instanceColor` carries the state (values above 1 are allowed and brighten a metal's reflections):
  - idle silver `(0.93, 0.91, 0.87)`
  - dimmed (outside the current pattern group) silver * 0.45
  - hover silver * 1.6
  - selected silver * 1.3 with a warm tint `(1.2, 1.12, 1.0)`
  - current (loaded in the engine) `(1.0, 0.32, 0.20) * 1.5`
  - unplayable `(0.30, 0.30, 0.30)` regardless of group
- Positions from `fullPos(t_i)` every frame (42 matrix composes, well under 0.2 ms). Rotation 0.2 rad/s about a per-bead random axis (seeded), off under reduced motion. Scale tweens: pop-in 0 to 1 easeOutBack(1.4) 320 ms during the reveal, hover 1.0 to 1.08 in 150 ms and back in 250 ms, playing pulse 1.00 to 1.06 at 1 Hz (sine), red flash on notice (colour to `(2.0, 0.2, 0.1)` twice, 200 ms each).
- Bead placement (`data/beads.ts`): with `yearLin = daysSince(2012-05-15) / daysBetween(2012-05-15, 2026-02-11)` and `rank = index / 36`, `t = 0.10 + 0.84 * (0.4 * yearLin + 0.6 * rank)`. The year term keeps 2012 to 2020 sparse and far; the rank term spreads the nineteen 2025 tracks (about 0.98 units apart, the nine Limbos LP tracks included) so each stays pickable. Mixtape hubs at `t = 0.955 + 0.011 * k` (k = 0 for 35 to 4 for 39): z from -3.15 to -0.07.

### 2.5 Mixtape gates (1 draw call)

- `InstancedMesh(TorusGeometry(1, 0.05, 12, 64), metal, 5)`. Each instance is scaled uniformly to its radius `r = 0.95 + 0.55 * (durationMinutes / 121)` (76 min gives 1.30, 90 gives 1.36, 117 gives 1.48, 121 gives 1.50) and oriented so its axis is the path tangent at its t (quaternion from `(0, 0, 1)` to `T`). The torus lies in the XY plane by construction, which is what we want: the line threads its centre, the hub bead sits at the centre, and the sequencer ring (outer radius 0.8) docks concentrically inside it with at least 0.45 clearance.

### 2.6 The sequencer ring (5 draw calls): the machine

A Group `seq` positioned at its dock point on the line and oriented by the frame at that t: local +Z = tangent T (facing the camera side), local +Y = world up projected into the ring plane, local +X = cross(Y, Z). Children: a `rotor` Group that rotates about local Z, plus static parts.

- Segments (in rotor): one `Shape`: `absarc(0, 0, 0.80, a0, a1, false)`, `lineTo` inner, `absarc(0, 0, 0.66, a1, a0, true)`, with `a1 - a0 = TAU / 16 - 0.05` centred on angle 0. `ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 6 })`, translated by -0.07 on z so it is centred. `InstancedMesh(segGeom, lacquer, 16)`; instance k rotated by `k * TAU / 16` about Z and pushed radially by `off_k` (0 at rest). Material desktop: `MeshPhysicalMaterial({ color: 0x232323, roughness: 0.4, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.8 })`; under 768 px `MeshStandardMaterial({ color: 0x262626, roughness: 0.32, metalness: 0.3, envMapIntensity: 0.8 })`. The ring reads as piano-black lacquer; its inner faces are lit cream by the bead lamp at its centre. If it ever disappears against the void on a given screen, raise the base colour to `#2C2C2C`, never add a light.
- LEDs (in rotor): `InstancedMesh(CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(PI / 2), ledMat, 16)` at radius 0.73, angle `(k + 0.5) * TAU / 16`, z = 0.085. `ledMat = MeshBasicMaterial({ toneMapped: false })`, colour per instance through `instanceColor = ledColor_k * intensity_k`. `ledColor` is cream for all steps except 0, 4, 8, 12 which are red `(1.0, 0.23, 0.12)` (the 303 accent steps). Off intensity 0.06 (a dark ember, the LED stays visible as a disc).
- LED halos (in rotor): `InstancedMesh(PlaneGeometry(0.14, 0.14), haloMat, 16)` at z = 0.10, `haloMat = MeshBasicMaterial({ map: radialTex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false })`, `radialTex` a 64 x 64 CanvasTexture radial gradient white to transparent generated once. `instanceColor = ledColor_k * intensity_k * 0.8`. Dropped in the low tier.
- Groove (static): `TorusGeometry(0.83, 0.02, 8, 128)` with a ShaderMaterial (`toneMapped: false`): vertex passes `vAngle = atan(position.y, position.x)`; fragment maps it to `a` in 0..1 with 0 at 12 o'clock growing clockwise as seen by the camera, colour `mix(vec3(0.16), red, 1.0 - smoothstep(uProgress - 0.004, uProgress + 0.004, a))`, plus a cream notch where `a < 0.008 || a > 0.992`. The engineer checks the direction once by eye and flips the sign if the arc grows the wrong way.
- Playhead (static): `BoxGeometry(0.05, 0.10, 0.05)` at `(0, 0.93, 0.02)`, `MeshBasicMaterial` cream, `toneMapped: false`.
- Bead lamp: `PointLight(0xF6F1E7, 8, 10, 2)` as a child of `seq` at the origin. It is the only light that moves: it lights the bead the ring clamps, the ring's inner faces, and the neighbours.
- Behaviour (all in `scene/Sequencer.ts`, one update per frame, no allocations):
  - `seq.t` is the dock parameter. Idle: the newest track's t (Voodoo, t about 0.94). On selection or on a current change: tween `seq.t` to the target t over 900 ms easeInOutCubic; position and quaternion are evaluated from `path.ts` every frame during the tween, so the ring slides along the ribbon like a bead on a wire, passing over beads (inner radius 0.66 clears every bead).
  - Dock clamp: on arrival, set every `off_k = 0.5` and spring back with `off += (0 - off) * (1 - exp(-dt * 12))`, staggered 20 ms per segment. The ring visibly clamps onto the bead.
  - Rotor rotation: `rotor.rotation.z = -progress * TAU` (damped, `lambda 6`, so seeks slide instead of snapping). Under reduced motion it updates once per second as a discrete step.
  - Chase: while playing, `step = floor((now - clockStart) / 115.38) mod 16` (130 BPM sixteenths). LED intensity: current step 1.0, step - 1 at 0.45, step - 2 at 0.2, others 0.06. The active segment pops radially: `off_step` target 0.06 for 80 ms then 0 (same spring, lambda 30). Paused: chase frozen, all lit LEDs held at 0.4. Not playing: all 0.06 except the standby pulse on step 0 (0.06 to 0.4 to 0.06, 400 ms up, 1.2 s down, every 4 s). Under reduced motion the chase is replaced by the progress fill: LED k lit at 1.0 when `progress > k / 16`, no pop, no pulse.
  - Loading (engine pending, see section 4): LED chase at 300 ms per step, intensity 0.6, no pop.
  - Self-test at boot: 16 LEDs light left to right then right to left, 40 ms per step with a 3 LED trail, from t = 0.2 s to 1.5 s, then settle to idle.

### 2.7 The monolith (1 draw call): the name

- After `Promise.race([document.fonts.load('700 44px Larsseit'), timeout(3000)])`, draw on a 256 x 112 canvas (OffscreenCanvas when available, else a detached HTMLCanvasElement): `font = '700 44px Larsseit, sans-serif'`, `textAlign = 'center'`, `textBaseline = 'alphabetic'`, `letterSpacing = '2px'` when supported, `fillText('MAUDITE', 128, 46)` and `fillText('MACHINE', 128, 100)`. Read `getImageData`, sample every 2 px (128 x 56 grid), keep cells with alpha above 128. Expect roughly 2,000 to 2,600 cells; allocate the InstancedMesh at 3,000 and hide extras with a zero-scale matrix. If the font resolves after the timeout (within 10 s), re-raster silently in place.
- `InstancedMesh(BoxGeometry(1, 1, 3), metal, 3000)`, `frustumCulled = false`. World width W = 14 (aspect at or above 1) or 7 (portrait), cell = W / 128; block size cell x cell x 3 cell; centre (0, 2.2, -66), front faces toward +z, rows from the top of the canvas at the top. Each block gets a seeded z jitter of plus or minus 0.06 cell * 3 so the wall is not a perfect plane and catches the lamp unevenly. Rebuild the matrices when the aspect crosses 1 on resize (cheap).
- Name lamp: `PointLight(0xF6F1E7, 40, 40, 2)` at `(0, 5, -58)`, static. Fades from 0 to 40 over 600 ms at boot.
- The ribbon's base path at t in 0.03..0.06 crosses z = -66, so the line pierces the wall of blocks between or through the letters depending on TUNING. Beads start at t = 0.10 (z = -63), three units in front of the wall.
- Under 768 px and in the low tier the sampling stride is 3 (about 1,000 cells), the mesh is allocated at 1,500.

### 2.8 Lights, summary

Room environment for reflections, one bead lamp on the ring, one name lamp on the monolith. No ambient, no directional. The only saturated colour on screen is the 303 red: LEDs, the groove, the current bead, the RUN outline in HTML.

### 2.9 Draw calls

Background 1, ribbon 3 (2 on mobile), beads 1, gates 1, segments 1, LEDs 1, halos 1 (0 in low tier), groove 1, playhead 1, monolith 1, grain 1 (0 in low tier): 13 desktop, 12 mobile, 10 low tier.

---

## 3. Camera choreography

`PerspectiveCamera(38, aspect, 0.1, 200)`. Portrait phones keep fov 38; framing is handled by the lookAt bias, not by widening the lens.

### 3.1 The rail (free mode)

- Dolly parameter s. Camera position `C(s) = smoothPos(s) + (5.5, 2.2, 0)`. LookAt `L(s) = smoothPos(s - 0.114)` (8 units further into the past) plus a vertical bias of -0.35 (landscape) or -1.0 (portrait) so the line sits above the panel.
- Range: `sMin = 0.24` (aspect at or above 1) or `0.36` (portrait) to `sMax = 1.14`. At sMax the camera is at z = +9.8 looking through the five gates at the newest beads: that is the rest shot. At sMin on desktop the camera is 12.8 units from the wall of blocks, which then fills 90 percent of the frame width.
- The Name blend: for `s < sMin + 0.08` the lookAt blends from `L(s)` to the monolith centre `(0, 2.2, -66)` with weight `smoothstep(sMin + 0.08, sMin, s)`, so the end of the dolly always ends on the name, straight and centred.
- Input to s: horizontal drag, vertical drag on touch, wheel, ruler. Convention: into the past means s decreases. While a drag is held, `s += (dx + dy * isTouch) * 0.0012` per pointer event (dragging left or up goes into the past) and the release velocity is kept as `v` in s per second; after release `s += v * dt; v *= exp(-dt * 5)` each frame. Wheel: `s -= deltaY * 0.0006` (wheel down goes into the past), same inertia. Always `s = clamp(s, sMin, sMax)`. A drag is any pointer travel above 10 px since pointerdown: it sets `dragging = true`, which cancels the tap-to-select on pointerup.
- Poses are always reached by tweens of position and lookAt together; the only hard sets are under reduced motion, which cuts.

### 3.2 Named shots

| Shot | Trigger | Position | LookAt | Duration, easing |
|---|---|---|---|---|
| Gates (boot, rest) | mount | `C(1.18)` to `C(1.14)` | `L(s)` | 2.2 s easeOutQuint during the intro; static under reduced motion |
| Focus | a bead or hub selected, or the engine's current changes | `beadPos + (4.5, 1.8, 6.0)` | `beadPos + bias` | 900 ms easeInOutCubic, in sync with the ring's travel |
| Coda | Pattern Group IV chosen with no mixtape selected | `C(1.14)` | hub of mixtape 37 (t = 0.977) | 1.1 s easeInOutCubic |
| Year jump | ruler click | `C(t_first + 0.114)` clamped | `L(s)` | 1.1 s easeInOutCubic |
| The Name | s reaches sMin | `C(sMin)` | monolith centre via the blend | continuous |
| Drawer | INFO opens on desktop | current position pulled back 3 units along the view axis | unchanged | 600 ms easeOutCubic; the ribbon dims to 60 percent (`uDim`) in 350 ms; TRACKLIST dims only |

Focus is left as soon as the user dollies (drag, wheel, ruler): the camera tweens from its focus pose to `C(s)` with `s = clamp((camera.z + 70) / 70)` over 600 ms, and the selection stays. In focus the ring is about 30 percent of the frame height (diameter 1.6 at 7.7 units), the LEDs 11 to 14 px with 22 to 28 px halos, on a phone as on a laptop.

### 3.3 Idle and parallax

- No camera drift along the line, ever (it would fight the user). A lookAt sway of plus or minus 0.08 units with an 11 s period, and pointer parallax that nudges the lookAt by plus or minus 0.3 on x and 0.15 on y, damped with `1 - exp(-dt * 4)`. Both off on touch and under reduced motion.
- The life of the idle scene is the line itself: `uTime` flows, the wobble drifts, the width breathes 8 percent at 0.6 Hz, beads rotate, and after 12 s without playback a ghost current at 30 percent brightness travels the whole line from the name to now in 6 s, once every 6 s, as a hint of what RUN does. It stops the moment a track is loaded.

---

## 4. Music mapping and player UX

### 4.1 Data (`src/v3/data/beads.ts`, read-only imports from `src/v2/data`)

- `discography.json`: 37 tracks, 35 with `soundcloudUrl` (32 originals of which 31 playable, 5 remixes of which 4 playable, no `vrstl` entries today; the adapter handles the category if it ever appears by folding it into ORIGINALS). 10 featured, all playable. Years 2012 to 2026. Unplayable: `north-river` (original, 2023) and `electrochimie-remix` (remix, 2023), both with a Bandcamp `link`.
- `mixtapes.json`: 5 mixtapes (numbers 35 to 39), `profileUrl` for the SoundCloud profile link.
- Mixtape adapter: `toTrack(m) => ({ id: 'mixtape-' + m.number, title: m.title, project: 'Mixtape ' + m.number, artist: 'Maudite Machine', role: 'DJ', year: m.year, category: 'originals', link: m.soundcloudUrl, soundcloudUrl: m.soundcloudUrl, featured: m.featured, releaseDate: m.year + '-01-01', trackNo: 0 })`, plus a v3 side map `id -> { number, duration, artwork }` for the display. `isPlayable` is true for all five.
- Pattern groups (the 303 rotary): I FEATURED = the 10 featured tracks; II ORIGINALS = all 32 originals; III REMIXES = the 5 remixes; IV MIXTAPES = the 5 mixtapes. Every group is ordered chronologically ascending (oldest first) so FWD walks toward now and BACK into the past, matching the ruler. The queue passed to `play(track, queue)` is always the selected track's group; unplayable tracks stay in the list (the engine skips them and sets `notice`).
- Ruler years: 2012, 2014, 2017, 2020, 2023, 2025, MIX (the years present are 2012, 2013, 2014, 2015, 2017, 2020, 2023, 2024, 2025, 2026).

### 4.2 Engine binding

- `V3App` wraps everything in `<AudioPlayerProvider>` from `src/v2/context/AudioPlayerContext.tsx`; nothing else touches `scWidget`. All reads go through `src/v3/engine/useEngine.ts`, which is `useAudioPlayer` re-exported, except in DEV with `?v3mock=1` where it is a mock provider with the same shape (section 9). The choice is made once at module load so the rules of hooks hold.
- `play()`, `toggle()`, `next()`, `prev()`, `seek()` and `close()` are called only inside `click` handlers of real buttons and `keydown` handlers; never on mount, on scroll, on hover, on dolly, in a timer or from a promise. The first play on iOS is therefore always a native tap on RUN or on a tracklist row.
- The engine's `play(track)` on the track that is already current toggles it; RUN uses that: if `selected.id === current?.id` call `toggle()`, else `play(selected, group)`.
- `notice` is the title of the skipped track; the UI shows "Skipped: {notice}" for the 4 s the engine keeps it.
- A `pending` flag (v3 side) is set when v3 calls `play`, `next`, `prev`, `toggle` (resume) or when `current.id` changes for any reason (auto-next at track end, engine skip). It clears when `playing` is true and `progress > 0`, or 8 s later. `loading = pending`.
- Selection follows the engine: whenever `current.id` changes, `selectedId = current.id` and the pattern group switches to the group that contains it.
- Scene bridge: React writes engine state into a plain object of refs (`state/bridge.ts`: `currentId`, `selectedId`, `playing`, `progress`, `duration`, `pending`, `noticeAt`, `group`, `hoverId`) inside one `useEffect`; the render loop reads the refs. No React render per frame.

### 4.3 Selection versus playback

- Bead or hub tap on the canvas: selects. Arrow keys on the canvas: select. A tracklist row: selects and plays (a list plays; a sculpture selects). RUN: plays the selection. Selecting never calls the engine.
- Visuals that follow `focusId = currentId ?? selectedId`: the ring's dock, the wrap (`uFocusT`), the bead lamp. Visuals that follow `selectedId` alone: the bead's selected colour, the RUN breathing outline, the panel display when nothing is loaded. If a track plays and the visitor selects another bead, the ring stays on the playing track, the camera and the display go to the selection, RUN breathes: pressing it plays the selection and the ring runs to it.

### 4.4 What changes when

- Select: camera Focus shot (900 ms); ring travels (900 ms) and clamps; wrap `uWrap` 0 to 1 over 700 ms easeOutBack(1.2) starting 150 ms after the tap, the previous wrap unwinds in 400 ms easeInCubic; the panel crossfades to the title in 120 ms; RUN outline breathes (1.6 s loop); aria-live says "Selected: {title}, {year}, {category}". Selecting a dimmed bead switches the rotary to its group (260 ms easeOutBack pointer turn).
- RUN pressed on a playable selection: `play()`; state loading: display LOADING, HTML LEDs chase at 300 ms per step, ring LEDs chase at 300 ms; the bead colour goes red immediately (current), the wrap holds.
- Playing (engine `playing` true and progress flowing): `uFlow` eases 0 to 1 in 400 ms; `uTurns = 2 + 6 * progress`; the rotor turns with progress; the groove fills; the chase runs at 130 BPM; the bead pulses at 1 Hz; the HTML steps fill left to right with the current step blinking at 1 Hz; the timecode counts; aria-pressed on RUN is true; aria-live says "Playing: {title}". The beat clock starts at the moment `playing` becomes true and restarts on every false-to-true transition.
- Pause: `uFlow` eases to 0 in 400 ms; the chase freezes; the display shows PAUSED with the timecode; aria-live "Paused".
- Track change (FWD, BACK, row click, auto-next at the end): the current bead's red decays to silver in 350 ms while the new one turns red; the ring travels to the new bead (900 ms); the camera follows; the coil re-originates at the new bead (old wrap unwinds 400 ms, new wrap 700 ms); the display crossfades; the rotary turns if the group changed.
- Notice (engine skipped a dead or private URL): display "Skipped: {title}" for 4 s in red text; the skipped bead flashes red twice (200 ms each); the 16 HTML LEDs flash twice; the aria-live region announces it. The engine already moves on to the next playable track.
- CLEAR (close): `close()`; current and selection cleared; the wrap unwinds; the ring travels back to its idle dock (the newest bead); the display returns to the idle line; the camera stays where it is.
- Loading timeout (8 s without `playing`): display "Tap RUN again.", LEDs reset, pending cleared.
- Unplayable selection: display "Not on SoundCloud." with an anchor "Listen on Bandcamp" (`track.link`); RUN is `aria-disabled` and does nothing; the bead has no wrap (the ring still docks, LEDs off).

### 4.5 Transport UI (HTML, always present)

Current track (title, project, year, category or mixtape number and duration, artwork thumb 48 px for mixtapes), BACK (`prev`), RUN/STOP (`toggle` or `play`, `aria-pressed = playing`, aria-label "Play" or "Pause"), FWD (`next`), CLEAR (`close`, aria-label "Stop and clear"), progress as the 16 step LEDs (fill) plus the timecode "mm:ss / mm:ss" (h:mm:ss above one hour), seek by clicking or tapping a step (`seek(k / 16)`), the notice line, and the state words LOADING, PAUSED, "Tap RUN again.", "Not on SoundCloud." Only one element in the row is focusable for the steps: the row is a `role="slider"` (0..16, arrow keys seek by one sixteenth); the 16 cells are pointer targets, and on mobile the whole row is one 44 px high target quantized to the nearest sixteenth.

### 4.6 State machine

`data-v3-state` on `.v3-root` is the review surface. Orthogonal flags: `data-v3-selected` (id or empty), `data-v3-current` (id or empty), `data-v3-group` (1 to 4), `data-v3-notice` ("1" while shown), `data-v3-step` (0 to 15 while playing, else -1), `data-v3-motion` (full or reduced), `data-v3-tier` (full or low), `data-v3-gl` (webgl or fallback), `data-v3-drawer` (none, tracklist, info).

| State | Definition | Enters from | Leaves to |
|---|---|---|---|
| boot | intro running | mount | idle at 2.4 s, or on the first click, tap or key (all tweens jump to their end) |
| idle | no selection, no current | boot, CLEAR | selected (tap, arrows, row), loading (row) |
| selected | selection set, current null | idle (tap, arrows) | loading (RUN, Enter, row), idle (CLEAR) |
| loading | `pending` true | selected (RUN), playing or paused (FWD, BACK, row, auto-next, skip) | playing (engine playing and progress > 0), paused (8 s timeout), idle (CLEAR) |
| playing | engine `playing` true and not pending | loading, paused | paused (RUN, Space), loading (track change), idle (CLEAR) |
| paused | current set, engine `playing` false, not pending | playing, loading timeout | loading (RUN resume sets pending, cleared within a beat), idle (CLEAR) |

`notice` is a 4 s overlay flag on any state with a current track. Hover and drawer are not states.

---

## 5. HTML overlay: content, layout, copy, typography

### 5.1 Structure (top to bottom in the DOM; the DOM order is the tab order)

1. Top bar (`.v3-top`): left, the wordmark "MAUDITE MACHINE" (an anchor to "/", aria-label "Maudite Machine, main site") with the tagline "raw machine grooves with a human pulse" under it; right, two buttons TRACKLIST and INFO (44 x 44 minimum, `aria-expanded`).
2. Ruler (`.v3-ruler`, desktop only, right edge, vertical): buttons 2012, 2014, 2017, 2020, 2023, 2025, MIX; the active span is red.
3. Stage (`.v3-stage`, `role="group"`, `tabindex="0"`, aria-label "Discography line", `aria-describedby` a visually hidden sentence: "Arrow keys move between tracks. Enter plays the selected track. Digits 1 to 4 choose a pattern group."). Contains the `<canvas aria-hidden="true">` and the bead tooltip.
4. Panel (`.v3-panel`): the 303 silkscreen block, the PATTERN GROUP rotary, six knobs, the display, transport, steps.
5. Tracklist drawer (`.v3-drawer.is-tracklist`, `role="dialog"`, aria-label "Tracklist"): rendered from first paint (hidden until opened), sections I to IV, a real `<button>` per playable track and mixtape, an anchor per unplayable track.
6. Info drawer (`.v3-drawer.is-info`, `role="dialog"`, aria-label "Info"): booking, press, socials, main site, calm mode.
7. Visually hidden `aria-live="polite"` region.
8. DEV-only error strip (`.v3-devlog`), see section 9.

Order of appearance on screen follows the DOM: the top bar over the stage, the panel over the stage bottom, drawers over everything with a scrim.

### 5.2 Panel layout

Desktop (1024 px and up): one row, height 168 px, max width 1180 px centred, 16 px above the bottom safe area, 1 px cream border at 60 percent on `#0C0C0C` at 92 percent, 1 px section rules. Grid columns: silkscreen 150 px, pattern group 96 px, knobs 6 x 64 px, display 1fr (min 260 px), transport 4 x 48 px, steps 16 x 20 px. Tablet (768 to 1023): two rows: knobs and rotary above, display, transport and steps below. Mobile (under 768): stacked rows, 16 px gutters:

- Row A (56 px): BACK, RUN/STOP, FWD (48 px each), the display (title marquee only if it overflows, timecode), CLEAR (44 px).
- Row B (44 px target, 20 px visual): the 16 step cells with 4 px LED dots above, one touch target.
- Row C (44 px): PATTERN GROUP as a segmented control I, II, III, IV (4 x 44 px) and a KNOBS toggle (44 px, `aria-expanded`).
- Row D (64 px, hidden until KNOBS is on): six 48 px dials, `6 * 48 + 5 * 8 = 328 px`, fits in 343 px.
- Landscape phones (height under 500 px): rows A and B only, the rotary and knobs behind the KNOBS toggle, top bar 40 px.

The panel never scrolls the page; drawers scroll inside themselves.

### 5.3 Copy (English, short, no exclamation marks, no place names)

- Wordmark: "MAUDITE MACHINE". Tagline: "raw machine grooves with a human pulse".
- Panel silkscreen: "MAUDITE MACHINE" bold, "ACID LINE" under it (where Roland prints "Bass Line"), then in 8 px: "COMPUTER CONTROLLED". Labels: TUNING, CUT OFF FREQ, RESONANCE, ENV MOD, DECAY, ACCENT, PATTERN GROUP with I II III IV and the legend "I featured, II originals, III remixes, IV mixtapes", RUN/STOP, BACK, FWD, CLEAR.
- Display idle: "Pick a track on the line, then RUN." Mobile: "Tap a bead, then RUN."
- Display selected: title 22 px light (16 px mobile) and the meta line "{project}, {year}, {category singular}" (for mixtapes "Mixtape {number}, {year}, {duration}").
- Display states: "LOADING", "PAUSED", "Tap RUN again.", "Not on SoundCloud." with "Listen on Bandcamp", "Skipped: {title}".
- Knob tooltips: "TUNING: bends the wave of the line", "CUT OFF: detail and glow", "RESONANCE: winds the coil", "ENV MOD: how much the current swells the line", "DECAY: tail length of the current", "ACCENT: brightness of the current and the flashes". Under reduced motion ENV MOD and DECAY add " (inert in calm mode)".
- Tracklist: heading "TRACKLIST", sections "I  FEATURED", "II  ORIGINALS", "III  REMIXES", "IV  MIXTAPES" with counts; rows "{nn}  {title}" with "{year}" right-aligned (duration for mixtapes), aria-label "Play {title}, {year}, {category}"; unplayable rows: "{title}", "not on SoundCloud", anchor "Bandcamp". The current row has a red dot and `aria-current="true"`.
- Info: heading "MAUDITE MACHINE", line "raw machine grooves with a human pulse", line "Hypnotic techno. VRSTL Records. 8day.", section "BOOKING" listing `BOOKING_CONTACTS` as "{label.en}{name ? ', ' + name : ''}" with the email as a `mailto:` anchor, section "PRESS" with "Press kit (PDF)" to `/Presskit_Maudite_Machine_2026-27.pdf`, "Tech rider" to `/techrider`, "Press assets" to `/press/`, section "LISTEN" with the SoundCloud profile link from `mixtapes.json`, section "SOCIALS" with the 15 entries of `SOCIALS` (icons from `SOCIAL_ICONS` as inline SVG `fill="currentColor"` 18 px in a 44 px target; entries with `icon: null` render their initial in a 1 px cream circle, like v2), a toggle "Calm mode" (checkbox, forces the reduced-motion path, stored in localStorage `mm_v3_calm`), and the footer link "Main site" to "/". Every anchor to another origin has `target="_blank" rel="noopener"`.

### 5.4 Typography (Larsseit only, copied `@font-face` in `v3.css`, scoped under `.v3-root`)

The three declarations from `src/v2/v2.css` (light 300 to 400, medium 500 to 600, bold 700 to 900, `font-display: swap`, same `/fonts/larsseit/*.woff2` URLs) are copied verbatim into `v3.css`. Uses:

- Wordmark: 13 px bold, uppercase, letter-spacing 0.28em (12 px on mobile). Tagline: 10 px light, letter-spacing 0.06em, cream 70 percent.
- Panel labels: 10 px medium, uppercase, 0.14em, cream 70 percent. Silkscreen: 11 px bold 0.24em and 9 px medium 0.2em.
- Display: 22 px light (16 px mobile) sentence case; meta and timecodes 12 px medium with `font-variant-numeric: tabular-nums`.
- Drawer rows: 15 px medium, meta 12 px; drawer headings 11 px bold 0.22em; info body 15 px light.
- Colours: cream `#F6F1E7` on ink; secondary text cream at 70 percent; red `#FF3B1F` only for state. Contrast: cream on `#0C0C0C` 17:1, 70 percent cream about 8.5:1, red about 5:1 and never the only carrier of a state (the display always says it in words).
- Knobs: SVG, outer tick ring (11 ticks over 270 degrees), ink cap, cream indicator line, rotation -135 to +135 degrees. Rotary: SVG dial with ticks I II III IV, pointer at -54, -18, 18, 54 degrees. Steps: 1 px cream squares with a 4 px LED dot above (red when lit).
- Focus: 2 px cream outline, 3 px offset, on every focusable element (`:focus-visible`).

### 5.5 z-index and pointer-events

| Layer | z | pointer-events |
|---|---|---|
| `.v3-stage` and canvas | 0 | auto, `touch-action: none` on the canvas only |
| `.v3-top`, `.v3-ruler` | 20 | none on the containers, auto on buttons and links |
| `.v3-panel` | 25 | auto |
| `.v3-tooltip` | 30 | none |
| drawer scrim | 39 | auto (click closes) |
| `.v3-drawer` | 40 | auto, `overflow-y: auto`, `overscroll-behavior: contain` |
| `.v3-devlog` (DEV) | 50 | none |

`.v3-root`: `position: fixed; inset: 0; height: 100dvh; overflow: hidden; background: #0C0C0C; color: #F6F1E7` (inline `position: fixed` as well, by repo habit). `V3App` mounts outside any `.page` element, exactly like `V2App`. On mount: `document.body.classList.add('v3-active')`, `document.title = 'Maudite Machine | Acid Line'`, set `meta[name=theme-color]` to `#0C0C0C`, add `meta[name=robots] noindex` (an experiment, out of the sitemap); all restored on unmount. In `v3.css`: `body.v3-active { padding: 0 !important; background: #0C0C0C !important; overflow: hidden; }` and `html:has(body.v3-active) { background: #0C0C0C !important; overflow: hidden; scroll-behavior: auto; }` (the v1 CSS sets `html { background: #000 !important }` in a mobile block and pads the body; v2 does the same override in cream).

---

## 6. Interaction map

### 6.1 Desktop, mouse

- Move over the canvas: hover pick (nearest bead or hub centre within 28 CSS px, projections refreshed at most every 16 ms). Hover: bead colour ramps in 150 ms, scale 1.08, `cursor: pointer`, tooltip "{title}, {year}" at the projected point offset 14 px right and 10 px up, 120 ms fade, no delay. If two centres are within 20 px of each other, the tooltip lists both and a second click cycles.
- Click on the canvas without drag (pointer travel under 10 px between pointerdown and pointerup): select the hovered bead. Nothing plays.
- Horizontal drag on the canvas: dolly (section 3.1). Wheel over the canvas: dolly. Wheel over a knob: the knob (1 percent per notch, `preventDefault` on that element only).
- Knob: vertical drag with `setPointerCapture`, 1 px = 0.6 percent; double-click resets to default; tooltip on hover after 250 ms and while dragging.
- Rotary: click a tick (native radios); the pointer turns 260 ms easeOutBack.
- Ruler: click a year, 1.1 s dolly. Steps: click seeks. Transport: buttons. Drawers: buttons, scrim click closes, focus moves into the drawer on open and returns to the opener on close.

### 6.2 Keyboard

- Tab order: wordmark, TRACKLIST, INFO, ruler years (desktop), stage, rotary radios (one tab stop, arrows inside), six knobs, BACK, RUN/STOP, FWD, CLEAR, steps slider, then drawers when open.
- Global (window keydown, ignored when the target is an input, textarea, contenteditable or a button, and when a drawer is open except Escape):
  - Space: `toggle()` only if a track is current AND `hasGesture` is true. `hasGesture` becomes true on the first pointerup or Enter inside `.v3-root`; before that Space does nothing (the brief's rule: space is play/pause only after a first click gesture).
  - ArrowLeft / ArrowRight: `prev()` / `next()` when a track is current (a real key gesture, allowed); otherwise move the selection along the current group (Left into the past, Right toward now).
  - ArrowUp / ArrowDown: move the selection (Up into the past, Down toward now), never the engine.
  - Enter on the stage: play the selection (`play(selected, group)`), which also sets `hasGesture`.
  - Digits 1 to 4: pattern group I to IV.
  - Escape: close the open drawer or the tooltip.
- Knob (role slider, `aria-valuemin 0`, `aria-valuemax 100`, `aria-valuenow`, `aria-valuetext` with the mapping): arrows 1 percent, Shift plus arrows 10 percent, Home and End.
- Steps (role slider 0 to 16): arrows seek by one sixteenth, Home and End.
- The stage announces selection and playback changes in the live region.

### 6.3 Touch

- Tap on the canvas (pointer travel under 10 px, no `dragging`): select the nearest bead or hub within 36 px. A drag (any axis) dollies, never selects. There is no hover: the tap shows the same information in the panel display, and the tooltip is not used on touch.
- Knobs: 48 px dials behind the KNOBS toggle, vertical drag, tooltip shown while the finger is down and for 600 ms after; double-tap resets.
- Steps: the whole row is one 44 px target; a tap seeks to the nearest sixteenth.
- Tracklist and Info open as bottom sheets (max 70dvh, 44 px handle, swipe down or the handle closes). The tracklist sheet is the guaranteed picking surface: 44 px rows, a row plays.
- No pinch (nothing to zoom), no gyroscope (permission prompt on iOS). One finger does everything.

### 6.4 Hover-only and its touch twin

| Desktop hover | Touch equivalent |
|---|---|
| bead tooltip (title, year) | tap selects; the display shows title, meta |
| knob tooltip after 250 ms | tooltip while dragging the dial |
| bead brighten on hover | selected colour on tap |
| ruler year hover underline | ruler hidden; the tracklist sections and group IV cover navigation |

---

## 7. Responsive and accessibility

### 7.1 Breakpoints and 3D simplifications

- Width under 768 px (mobile): stacked panel rows, no ruler, ribbon 1024 segments, no core pass, icosahedron detail 1, ring in MeshStandardMaterial, monolith stride 3 (about 1,000 blocks), antialias off, DPR `min(devicePixelRatio, 1.5)`.
- Width 768 to 1023 (tablet): two-row panel, desktop scene settings.
- Width 1024 and up: one-row panel.
- Aspect under 1 (portrait, any width): monolith width 7, `sMin = 0.36`, lookAt bias -1.0 so the ring and the wrap sit in the top 60 percent of the viewport above the panel.
- Height under 500 px (landscape phone): two-row panel only, top bar 40 px.
- Resize: `ResizeObserver` on `.v3-root`, debounced 100 ms; the renderer size follows the stage, the aspect switch rebuilds the monolith matrices, the camera projection updates. `100dvh` root, no horizontal scroll: every overlay is `width: 100%` with 16 px gutters and `max-width: 100vw`; verified by `document.documentElement.scrollWidth === window.innerWidth` at 375 px.

### 7.2 Reduced motion (`prefers-reduced-motion: reduce`, observed live, or the Calm mode toggle)

Still beautiful, just still: the poster is a cream ribbon with its halo on ink, silver beads, a dark ring, one red bead, the name at the end.

- No intro: everything at its final state on the first frame, the canvas fades in over 300 ms (CSS opacity).
- No continuous animation: `uTime` frozen, no breath, no bead rotation, no ghost current, no standby pulse, no chase, no segment pop, no bead pulse, no parallax, no sway, no grain motion.
- Render on demand: a dirty flag; one render on knob change (a single 300 ms tween then stop), on selection (a cut: camera and ring jump, the wrap appears at its final state), on hover, on resize, on each engine progress update (the rotor and the groove step once per second), on drawer toggle.
- Playing still reads: the current bead is red, the wrap is on, the ribbon body at the wrap is 20 percent brighter instead of the flowing current, the 16 ring LEDs and the HTML steps show the progress fill, the timecode counts. Hover and press keep their 90 to 250 ms micro transitions (discrete changes). Drawers use 150 ms opacity only.
- The flag lives in `state/motion.ts` (`useSyncExternalStore`), read by the camera, the ribbon uniforms, the sequencer, the beads, the panel CSS (`.v3-root[data-v3-motion="reduced"]` turns every CSS animation off).

### 7.3 Accessibility

- Every 3D control has an HTML twin: beads and hubs are rows in the tracklist (real buttons), the transport is buttons, seek is the steps slider, the rotary is radios, the knobs are sliders. Nothing about the music or the contacts is locked behind the canvas.
- Labels: aria-labels as listed in section 5, `aria-pressed` on RUN/STOP, `aria-current` on the current row, `aria-expanded` on drawer buttons and the KNOBS toggle, `role="dialog"` drawers with focus trapping and Escape, `aria-live="polite"` announcements.
- The canvas is `aria-hidden`; the stage group carries the description and the keyboard behaviour.
- Contrast as in 5.4; focus rings 2 px cream, 3 px offset; touch targets 44 px minimum (48 px on the transport and dials); text never smaller than 10 px and only for tracked uppercase labels.
- `hasGesture` gate on Space prevents accidental audio from a keyboard before any interaction.

### 7.4 No WebGL, context lost, errors

- `V3App` checks `webgl2` at mount and listens for `webglcontextlost` (prevent default, mark `data-v3-gl="fallback"`) and `webglcontextrestored` (rebuild). The fallback page: the same top bar, the same panel wired to the same engine, the tracklist rendered inline and open under the panel (not dismissable), the info content inline below it, and behind them a static SVG ribbon drawn from `path.ts` (a `<polyline>` of 512 points projected with a fixed camera, cream stroke 2 px with a CSS blur halo, 37 silver circles and 5 rings). It is deliberately good enough to ship on its own and is also what a crawler sees.
- A React error boundary around the stage renders the same fallback; in DEV it prints the error in the devlog strip.

---

## 8. Performance budget

- Draw calls: 13 desktop, 12 mobile, 10 low tier (section 2.9). Reviewer reads `data-v3-calls` (renderer.info.render.calls, written once per second in DEV).
- Triangles: desktop about 76k (ribbon 12.3k, beads 13.4k, gates 7.7k, ring 6k, monolith 36k, quads 2); mobile about 40k.
- Textures on the GPU: the PMREM environment (256) and the 64 x 64 LED halo. The raster canvas for the monolith is CPU only and discarded after sampling. Mixtape artworks are HTML `<img loading="lazy">` in the tracklist rows and the display, never GL textures.
- CPU per frame: 42 bead matrices, 16 segment and 16 LED writes, 5 gates only on TUNING change, uniforms, one camera solve: under 1 ms. No allocations in the loop (module-level scratch `Vector3`, `Quaternion`, `Matrix4`, `Color`).
- GPU: 4 ms on an M1 laptop, 12 ms on an iPhone 12 class device at DPR 1.5 in the mobile profile, 60 fps target both.
- Adaptive tier: after the intro (or immediately under reduced motion, where no probe runs), average the frame time of frames 30 to 90; above 24 ms switch to low: DPR 1, 512 segments, halo pass off, LED halos off, monolith halved (odd instances hidden), grain off. Store `mm_v3_tier` in sessionStorage so a reload starts low without probing again.
- Render loop: `requestAnimationFrame` with dt clamped to 50 ms; `document.visibilitychange` pauses the loop (not the audio); under reduced motion the loop runs only while a 300 ms tween is alive or a dirty flag is set.
- Shader warm-up: `renderer.compile(scene, camera)` during the black boot frame so the reveal never stutters on first draw.
- Bundle: three via named imports from `three` plus `three/examples/jsm/environments/RoomEnvironment.js` (about 150 to 170 KB gz), v3 code about 30 KB gz, no fiber, no drei, no postprocessing: about 200 KB gz for the route chunk, hard cap 700 KB. Fonts are the same three woff2 files as v2 (44 KB each, cached from the main site). Measure after build: `for f in dist/assets/*.js; do printf '%s %s\n' "$(gzip -c "$f" | wc -c)" "$f"; done | sort -n | tail -5`. Optional `build.rollupOptions.output.manualChunks: { 'v3-three': ['three'] }` to make the number obvious; not required because only the v3 chunk imports three.
- Lazy plan: the whole route is `React.lazy`; v1 and v2 never load a byte of it. Inside the route: nothing else is lazy (the scene is the page). Mixtape artworks load on demand.
- Dispose on unmount (idempotent, StrictMode double-mount safe): cancel rAF, disconnect the ResizeObserver, remove pointer, wheel, key, matchMedia and visibility listeners, dispose every geometry, material, the halo texture and the environment texture, `renderer.dispose()`, `renderer.forceContextLoss()`, remove the canvas, restore body class, title, theme-color and robots meta. Verify in DEV: `renderer.info.memory` reads zero geometries and textures before the context loss.

---

## 9. Files, dependencies, route

### 9.1 Dependencies

`npm install three @types/three` (latest; the spec uses no API newer than r163, anything r170 or later is fine). `node_modules` is a symlink to `node_modules.nosync`; npm installs through it. Commit `package.json` and `package-lock.json` (the Pages workflow runs `npm ci`). Nothing else: no fiber, no drei, no postprocessing, no tween library.

### 9.2 Route (`src/App.tsx`, the only file outside `src/v3` that changes)

```tsx
// Experiment v3 : Acid Line, hors sitemap (chunk lazy, v1 et v2 n'en chargent rien)
const V3App = React.lazy(() => import('./v3/V3App'));
...
<Route path="/v3" element={lazyEl(<V3App />)} />
```

Placed in the "Site principal" block after `/techrider`. `sitemap.xml` and `scripts/generate-sitemap.mjs` untouched. The existing `copy-404` plugin makes `/v3` deep links work on GitHub Pages.

### 9.3 File structure (`src/v3/`)

```
V3App.tsx                 provider wrap (real or mock engine), WebGL check, chrome (body class,
                          title, theme-color, noindex), layout, error boundary, data-v3-* attributes
v3.css                    scoped .v3-root, @font-face copies, top bar, panel, knobs, rotary, steps,
                          display, drawers, tooltip, fallback, reduced-motion rules
engine/useEngine.ts       useAudioPlayer re-export, or the DEV mock when ?v3mock=1
engine/MockEngine.tsx     DEV only: same context shape, fake widget latency 1500 ms, 300 s fake
                          duration, toggle, next, prev, seek, close, and ?v3mock=fail which makes
                          the second play() error so the notice path can be reviewed
state/bridge.ts           the refs React writes and the scene reads (engine mirror, selection,
                          hover, group, pending, noticeAt)
state/knobs.ts            six knob values 0..1 with defaults, external store (useSyncExternalStore),
                          localStorage mm_v3_knobs with try/catch and validation, reset()
state/motion.ts           reduced-motion flag: matchMedia (observed live) OR calm toggle
                          (localStorage mm_v3_calm)
data/beads.ts             sort, t placement, groups I to IV, mixtape adapter, ruler years,
                          isMixtape map, category singular labels
scene/AcidLine.ts         the renderer class: create(canvas, opts), resize, frame(dt), setTier,
                          dispose; owns the loop, the probe, the intro timeline
scene/path.ts             basePos, frameAt, fullPos, smoothPos, the TS mirror of the GLSL
scene/shaders.ts          ribbon vertex and fragment, groove, background, grain (GLSL strings)
scene/Ribbon.ts           strip geometry, three materials, shared uniforms, rebuild(segments)
scene/Beads.ts            beads and gates InstancedMeshes, colour states, tweens, placement
scene/Sequencer.ts        the ring: segments, LEDs, halos, groove, playhead, lamp, travel, clamp,
                          rotor, chase, standby, self-test
scene/Monolith.ts         font raster, InstancedMesh, name lamp, aspect rebuild
scene/CameraRig.ts        rail, shots, focus, drawer pull, year jump, parallax, sway, cuts
scene/pick.ts             screen-space projection of the 42 centres, nearest within a radius,
                          the two-within-20 px cycle
scene/tween.ts            tween list {from, to, duration, ease, onUpdate, onDone}, easings
                          (easeOutQuint, easeInOutCubic, easeOutBack(k), easeInCubic, easeOutCubic)
scene/beatClock.ts        130 BPM metronome: start(now), stop, step(now)
panel/Panel.tsx           the 303 panel container and grid
panel/Knob.tsx            SVG dial, role slider, drag, wheel, keys, double reset, tooltip
panel/PatternGroup.tsx    radiogroup I to IV drawn as a rotary
panel/Display.tsx         title, meta, state words, timecode, notice, artwork thumb
panel/Transport.tsx       BACK, RUN/STOP, FWD, CLEAR
panel/Steps.tsx           16 cells, role slider, seek, loading chase, notice flash
ui/TopBar.tsx             wordmark, tagline, TRACKLIST, INFO
ui/Ruler.tsx              years, active span
ui/Tracklist.tsx          drawer or sheet, sections, rows, artworks
ui/Info.tsx               booking, press, listen, socials, calm mode, main site
ui/Drawer.tsx             dialog shell: scrim, focus trap, Escape, sheet gestures
ui/Tooltip.tsx            positioned tooltip, pointer-events none
ui/SocialIcon.tsx         inline SVG from SOCIAL_ICONS or the initial pastille
fallback/StaticLine.tsx   SVG ribbon and beads from path.ts for the no-WebGL page
hooks/useKeys.ts          the global key map with the hasGesture gate
hooks/useStageInput.ts    pointer and wheel on the stage: drag versus tap, hover throttle, dolly
```

Every file imports `V2Track` and `isPlayable` from `src/v2/context/AudioPlayerContext.tsx` and data from `src/v2/data/*` read-only. No v1 or v2 file changes.

### 9.4 Repo traps the engineer must know

- `index.html` installs a global console filter and an error swallower: any console message or uncaught error whose text contains "Canvas", "getContext", "Uncaught", "TypeError: Cannot read", "ReferenceError", "Failed to execute" and more is silently dropped, including errors thrown inside the render loop. Wrap `AcidLine.create()` and the loop body in try/catch, and in DEV print errors with `console.table([{ where, message }])` (not overridden) and into the `.v3-devlog` strip (`import.meta.env.DEV` only). Never ship the devlog.
- The same script replaces `CanvasRenderingContext2D.prototype.createPattern` with a function returning null and wraps `HTMLCanvasElement.prototype.getContext` for 2d contexts. The monolith raster uses `fillText` and `getImageData` only; three.js CanvasTexture and WebGL contexts are unaffected.
- `main.tsx` renders in `React.StrictMode`: effects mount, unmount and mount again in dev. `AcidLine.create` and `dispose` must be re-runnable.
- `.page > * { position: relative }` and the fixed-position trap: irrelevant here because `V3App` mounts outside `.page`, but keep the inline `position: fixed` on the root anyway.
- iCloud Drive: slow filesystem, slow first import of three in the dev server. Start the dev server only through the Claude_Browser tools (`preview_start` with name `dev`, port 5173, config in `.claude/launch.json`), never from Bash. Run `npm run build` once at the end, not after every change.
- `typescript` is not installed: esbuild strips types without checking them. Write clean TS anyway and keep `@types/three` so editors help.
- The SoundCloud iframe is a module singleton appended to `document.body` (fixed, 2 px, opacity 0.01, z-index -1). It survives route changes; the provider pauses it on unmount. Do not touch it.

### 9.5 Build and verification commands

- `npm run build` must pass (it also runs the sitemap prebuild and the SEO postbuild; neither knows about /v3).
- `grep -rnP "\x{2014}|\x{2013}" src/v3 src/App.tsx docs/v3` must print nothing.
- `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F000}-\x{1F2FF}]" src/v3` must print nothing.
- Gzip sizes of the route chunks as in section 8.
- Dev verification through the Claude_Browser preview only, reading `data-v3-*` attributes, `aria-pressed`, the display text and the DEV `window.__v3` object (`{ renderer, scene, state, stats }`, DEV only). Never click RUN, never click a tracklist row, never call `play()` or `toggle()` from the console. To review the playing visuals use `?v3mock=1` (DEV only): its `play()` never touches the SoundCloud widget.
- End of session: the report in `docs/reports/YYYY-MM-DD-v3-acid-line.md` per the project CLAUDE.md, then commit and push.

### 9.6 Build order and cut list

Order, each step leaving the page working:

1. Route, `V3App`, chrome, `v3.css`, data adapters, panel, drawers, engine binding, keyboard: the page works end to end as HTML over black (this is also the fallback page).
2. Scene skeleton: renderer, background and grain quads, camera rail with dolly, ribbon with the three passes, beads and gates, screen-space picking, hover and select.
3. Knobs to uniforms with smoothing, persistence, tooltips.
4. The sequencer ring: travel, clamp, rotor, groove, chase, standby, self-test.
5. The monolith and the name lamp; The Name camera blend.
6. Intro timeline, wrap, current, ghost, notice flash, reduced motion path, on-demand rendering, adaptive tier.
7. Mobile pass at 375 x 812 and landscape; touch input; sheets.
8. Dispose, error boundary, no-WebGL fallback, build, size check, dash and emoji greps, session report.

If the clock runs out, cut in this order and no other: (a) segment pop and dock clamp spring, (b) LED halos, (c) core pass, (d) ghost current, (e) monolith depth jitter, (f) parallax and sway. Never cut: the HTML truth, reduced motion, dispose, the mobile layout, the ring, the reveal, the wrap.

---

## 10. Acceptance checklist (no audio is ever played)

1. `/v3` paints black within the first frame: no cream flash, `meta[name=theme-color]` reads `#0C0C0C` while mounted and `#f6f1e7` again after navigating to `/`; `body.v3-active` present only while mounted; `document.title` is "Maudite Machine | Acid Line".
2. Intro: the ring self-test, the name lamp, the reveal from the name toward the camera, bead pops, panel slide, all done by 2.6 s; `data-v3-state` goes boot to idle; a click during the intro jumps everything to its end.
3. Tracklist drawer lists 37 tracks and 5 mixtapes in sections I (10), II (32), III (5), IV (5): 35 track buttons plus 5 mixtape buttons, and 2 unplayable rows with a Bandcamp anchor. Open, Escape closes, focus returns to the TRACKLIST button.
4. Hover a bead on desktop: tooltip with title and year, cursor pointer, the bead brightens; leaving it fades in 250 ms.
5. Click a bead: `data-v3-selected` holds its id, the camera reaches the Focus shot within 1 s, the ring travels to the bead and clamps, the wrap winds around it, the display shows title and meta; `data-v3-state` is `selected`, `data-v3-current` is empty, RUN has `aria-pressed="false"` and a breathing red outline. Nothing played.
6. A drag of more than 10 px on the canvas dollies the camera and never selects; wheel dollies; the ruler years dolly in about 1.1 s; at the end of the dolly into the past the wall of blocks reads MAUDITE MACHINE in Larsseit and the ribbon passes through it.
7. Pattern Group: switching to II, III or IV dims beads outside the group and turns the pointer; IV moves the camera to the five gates; arrow keys on the focused stage move the selection within the group; digits 1 to 4 switch groups; selecting a dimmed bead switches the rotary to its group.
8. Knobs: dragging each of the six visibly changes the line (wave, glow, coil, and the current-related ones at least change `aria-valuenow`); values survive a reload (localStorage `mm_v3_knobs`); double-click resets; wheel over a knob nudges by 1 percent; keyboard arrows move it; tooltip after 250 ms says what it drives.
9. Mock review (DEV, `?v3mock=1`): click a tracklist row; `data-v3-state` goes loading (display LOADING, LED chase) then playing; the timecode counts; `data-v3-step` cycles 0 to 15; the rotor turns and the groove fills; the bead is red; FWD moves everything to the next bead; RUN pauses (`aria-pressed` false, display PAUSED); CLEAR returns to idle with the ring back at the newest bead. With `?v3mock=fail` the second track shows "Skipped: {title}" for 4 s and the bead flashes red twice. No SoundCloud request appears in the network log.
10. The real engine is bound: with the DEV tools, `window.__v3.state.engine` is the provider's context object and the RUN click handler calls `play` or `toggle` from `useAudioPlayer` (code review, not a click).
11. Space does nothing before any click or Enter; after a gesture and with a current track (mock), Space toggles; ArrowLeft and ArrowRight call prev and next only when a track is current.
12. 375 x 812: `document.documentElement.scrollWidth === 375`, no element wider than the viewport, the panel rows fit inside 16 px gutters, all targets 44 px or more (transport and dials 48 px, the steps row is one 44 px target), the ring and the wrap sit in the top 60 percent above the panel in Focus, the KNOBS toggle reveals six 48 px dials, the tracklist opens as a bottom sheet with 44 px rows.
13. Touch: a tap selects, a drag dollies, no hover dependency anywhere (every hover feature has its twin from section 6.4).
14. Reduced motion (OS setting or Calm mode): no intro, no continuous animation (the DEV frame counter `window.__v3.stats.frames` stays flat while idle), selection is a cut, the poster still shows the ribbon, the halo, the beads, the ring and the name; `data-v3-motion="reduced"`; the knob tooltips for ENV MOD and DECAY say inert.
15. DPR: `window.__v3.renderer.getPixelRatio()` is at most 1.5 on a 2x or 3x screen.
16. Draw calls: `data-v3-calls` at most 13 on desktop, 12 on mobile; `window.__v3.renderer.info.render.triangles` under 90k.
17. Low tier: with `sessionStorage.mm_v3_tier = 'low'` and a reload, `data-v3-tier="low"`, the halo pass, LED halos and grain are gone, DPR is 1, the page still reads.
18. No WebGL (`?v3nogl=1` in DEV, or a browser with WebGL disabled): `data-v3-gl="fallback"`, the static SVG line, the panel, the inline tracklist and info are all present and the links resolve; the page is complete.
19. Info drawer: two booking `mailto:` anchors from `BOOKING_CONTACTS`, the SoundCloud profile link, the press kit PDF, `/techrider`, `/press/`, 15 social links (11 with icons, 4 with initials), Calm mode, and the "Main site" link to `/`.
20. Keyboard: Tab reaches every control in the section 6.2 order with a visible 2 px cream focus ring; drawers trap focus; the live region announces selection changes (inspect its text).
21. Unmount: navigate `/v3` to `/` to `/v3` twice: no error in the DEV strip, `renderer.info.memory` reads zero before the context loss, the v2 page is intact (cream, its nav, its sticky player).
22. Existing routes unaffected: `/`, `/radar`, `/techrider`, `/v1` render as before; `dist/sitemap.xml` does not contain `/v3`; `dist/` is not edited by hand.
23. `npm run build` passes; the route chunk total is under 700 KB gz (expected about 200 KB); the dash grep and the emoji grep print nothing across `src/v3`, `src/App.tsx` and `docs/v3`.
24. Copy audit: every displayed string is English, no exclamation marks, no place names, the tagline "raw machine grooves with a human pulse" appears under the wordmark and in the Info drawer, the panel silkscreen reads MAUDITE MACHINE / ACID LINE.
25. The session report exists in `docs/reports/` with the four required sections, and the commit message contains no em dash, no en dash, no emoji.
