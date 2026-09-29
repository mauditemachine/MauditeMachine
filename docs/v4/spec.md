# MM-808: build spec for mauditemachine.com/v4

Status: as implemented (2026-09-29, after the review pass). This engineering spec was written before the build from the client brief "/v4, la machine isometrique de Maudite Machine", then kept in sync by the six build stages and by the review pass that followed them (37 findings): every section carries "As implemented" notes where the build differs, and section 19 lists every deviation with its reason (items 1 to 9 are the owner's open questions, items 10 onward the stage notes, stage 6 from item 80, the review pass from item 91). Where a normative line and an "As implemented" note disagree, the note is what ships.

Language of this file, of every comment and of every UI string: ASCII only. No em dash (U+2014), no en dash (U+2013), no emoji, no accented letter anywhere in docs/v4, src/v4 or src/App.tsx. Ranges are written "100 to 150", signs "+/-", degrees "deg".

Owner's hard rules, repeated because they are not negotiable: git is read-only for the builders (status, diff, log only; the main session commits); never make audible sound (load /v4 with ?debug=1&mute=1 before any interaction, never click a SoundCloud row, never call scPlay or scResume from the console); no new npm dependency (three 0.186.1 by named imports only, never import * as THREE); mobile 390 x 844 is tested at every stage; the dev server runs only through the Claude_Browser preview tools (preview_start "dev", port 5173) and stays running; UI copy in English, short; comments short, in French without accents or in English.

---

## 0. How to read this

- Scene units: the machine is 14 x 9 x 1.6 units. World axes: +y up, +x along the machine's width, +z along its depth toward the near (front) edge. The camera sits at (12, 10, 12), so +x goes screen-right-and-down, +z goes screen-left-and-down, +y goes up. "Front" means +z, "back" -z, "left" -x, "right" +x, always in machine terms. Zone A (pads) is at -x, zone D (LCD) at +x/-z.
- Orthographic projection of a world point p, in scene units before the viewport scale: sx = 0.7071 * (p.x - p.z); sy (up) = -0.3590 * p.x + 0.8615 * p.y - 0.3590 * p.z. Pixels = units * s where s = canvasWidth / (2 * hw) (section 3.2). Every pixel figure in this document comes from this formula; section 6.5 reproduces the script so any layout change can be rechecked in ten seconds.
- Every number in a table is normative. "Tune between a and b" appears only where a value is judged by eye; the range is then the contract.
- Plateau coordinates: unless stated otherwise, positions of objects on the plateau are given in the plateau group's local frame, whose origin is the centre of the plateau's flat top surface (world (0, 1.6, 0) when the machine is closed). Local y = 0 is the top surface.

---

## 1. Decisions taken beyond the client brief (read once, then build)

1. Picking is screen-space, against the projected hit shapes of an explicit list of interactive objects (section 6), evaluated only on pointermove and pointerdown. three's Raycaster is not used: the hit shapes come from the same projection that positions the HTML twins, so mouse, touch, keyboard and assistive technology share one geometry and nothing can drift. This satisfies the brief's intent (never in the render loop, explicit list) more strictly than a raycast would.
2. Pads are 2.2 units on a 3.05 unit pitch. At the brief's mobile framing (machine at 92 % of a 390 px viewport, 22.06 px per unit) this is the smallest pitch that puts two adjacent pad centres 48 px apart (48.3 px measured, section 6.5). They are still "gros": 215 x 130 px on a 1440 px desktop.
3. Transport: RUN/STOP at x 1.5, CLEAR at x 4.3, TEMPO at x 6.1, all at z 3.3. RUN to CLEAR is 49 px and RUN to the nearest pad 51 px on the 390 px phone. The 16 step buttons are 7 px apart on that phone whatever the layout (the whole row is 100 px wide), so on coarse pointers the 3D steps are display only and the pattern is edited on an HTML step strip under the machine (the Dock, section 11.4). It is the one piece of UI the brief does not mention, and the only way to program the sequencer on a phone. (Review pass: the Dock also carries RUN, CLEAR, OPEN and the tempo as 48 px HTML buttons, because the projected 3D transport is 13 to 18 px on the phone, section 11.4 and section 19 item 101.)
4. Draw calls are counted the way renderer.info counts them, shadow pass included. The budget tables in section 4.6 include it. Geometry that never moves is merged into single meshes (BufferGeometryUtils.mergeGeometries); InstancedMesh is used where instances move or change colour individually (pads, buttons, LEDs, knobs, caps, rings). Same draw-call count as the brief's all-instanced plan, simpler code.
5. Pressing RUN while a SoundCloud track plays pauses the track first (one source plays at a time, the v2 engine's own rule). The brief only states the other direction (a starting track stops the machine); both are now explicit.
6. RectAreaLight is kept: in three 0.186.1 RectAreaLightUniformsLib.js is 1 KB (measured); the LTC tables ship inside the core build that is loaded anyway. (Corrected at stage 1, section 19 item 10: the tables are NOT in the core build; they cost 101 KB gzip. Stage 6: the RectAreaLight is gone, a yellow PointLight takes its place at 0 KB and /v4 fits its 220 KB budget, section 4.2 and section 19 item 80.)
7. The /v3 MockEngine (src/v3/engine/MockEngine.tsx, imported read-only) is reused in DEV behind ?v4mock=1 so the "track playing" visuals can be reviewed without SoundCloud. Zero new code, dead branch in production.
8. TRACKS rows show title, type, year and release ("Limbos LP", "Single / EP", "Remix"): the data has no record-label field and inventing one is not allowed (section 19).
9. A 460 px panel cannot sit beside a machine that fills 78 % of the viewport. When a section opens on desktop the camera reframes the machine to 78 % of (viewport width - 304 px) and shifts it left; the panel takes the right column, may overlap the empty socle corner, never the LCD (checked at 1440 and 1280, section 11.2). Under reduced motion the reframe is a cut.
10. The exploded stack is 14.6 units tall and does not fit the 13.0 unit desktop frustum: OPEN zooms the camera out to fit and raises the target by 2 units over the same 900 ms (section 12.3). On mobile the portrait frustum already fits.
11. Zone D layout: the knob row sits at z 0.3 and OPEN at z -1.75 so that on the phone OPEN is 27 px from the nearest knob instead of 17 px; TONE and LEVEL sit on a diagonal (screen-horizontal) so they are 36 px apart instead of 16 px.

---

## 2. The experience

A drum machine on a table, seen from above at 30 degrees, in a dark studio. Ink background, graphite body, one yellow accent, one red button. You understand it in a second: four pads on the left, sixteen steps along the front with a red RUN button, five knobs on the right labelled TRACKS, MIXTAPES, PRESS, SHOWS, CONTACT, a small green LCD at the back right with an OPEN button under it.

- Tap a pad: it sinks, flashes yellow, and the drum sounds immediately. The last pad you hit stays faintly lit: it is the selected instrument.
- Click the steps: they hold the selected instrument's hits; LEDs above them show the pattern. RUN turns yellow and the LEDs chase at the tempo; TEMPO, TONE and LEVEL are real knobs.
- Click a navigation knob: it turns 30 degrees, its LED lights, a yellow trace runs out of the machine like a PCB track and hooks a glass panel of real HTML beside the machine (desktop) or a sheet slides up under the machine (mobile). Click a track: it plays through the existing SoundCloud engine, the machine stops its own beat and the LCD shows the title and the timecode.
- Press OPEN: the top plate lifts and tilts, the base sinks, and the PCB inside is revealed, with three clickable chips: LABEL, LIVE, STUDIO. CLOSE puts it back.

Copy (English, short, no exclamation marks, no place names in the HTML): section 11.1 lists every string.

---

## 3. Camera, framing, projection

### 3.1 Camera

`OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100)`, `position.set(12, 10, 12)`, `up = (0, 1, 0)`, `lookAt(0, 0, 0)`. `hh = hw * canvasHeight / canvasWidth`. The camera basis this gives (used by scene/hit.ts and by the fallback SVG): right R = (0.7071, 0, -0.7071), up U = (-0.3590, 0.8615, -0.3590), view direction -Z with Z = (0.6092, 0.5077, 0.6092). Elevation 30.5 deg, azimuth 45 deg. No OrbitControls, no user rotation, nothing ever shows the underside.

### 3.2 Base framing (state: nothing open)

- PLATEAU_W = 0.7071 * (14 + 9) = 16.263 units (projected width of the plateau footprint). The whole machine with the socle projects to 16.69 x 9.85 units; its projected centre is 0.69 units above the target (the target is the base centre), which leaves room for the top bar.
- Desktop (layout "desktop", section 11.2): hw = (PLATEAU_W / 2) / 0.78 = 10.425. At 1440 x 900: s = 69.06 px per unit, plateau 1123 px = 78 % of the width, machine 1153 x 680 px. At 1280 x 800: s = 61.39, machine 1024 x 605 px.
- Mobile (canvas = top 55 % of the viewport): hw = (PLATEAU_W / 2) / 0.92 = 8.839. At 390 x 464: s = 22.06, plateau 359 px = 92 %, machine 368 x 217 px, frustum 17.68 x 21.03 units. At 375 x 446: s = 21.21.
- Vertical guard, both layouts: hw = max(hwBase, (9.85 / 0.86) / 2 * aspect) so the machine always fits in 86 % of the canvas height. On desktop the guard applies ABOVE aspect 1.82 (below it hwBase wins), which includes most 1080p browser viewports: at 1920 x 950 (aspect 2.02) hw is 11.57 and the plateau covers 70 % of the width, 71 % at 1920 x 960 and 2560 x 1300, instead of 78 % (owner question, section 19 item 104). At 1440 x 900 (aspect 1.6) it does not apply.
- Constants in theme.ts: FRAME_DESKTOP = 0.78, FRAME_MOBILE = 0.92, PLATEAU_W, MACHINE_H = 9.85.

### 3.3 Section framing (desktop only)

When `section !== null` on desktop: stageW = W - 304 for W >= 1100, stageW = W - 200 for 768 <= W < 1100 (W = canvas width in px). hw = hwBase * W / stageW. The camera position and target are both translated along R by -((W - stageW) / 2) / s units, so the machine's projected centre moves from W/2 to stageW/2. Tween 400 ms easeInOutCubic on hw and on the offset; reduced motion: cut. Check at 1440: s = 54.5, machine centre at 568 px, LCD right edge at 940 px, panel left edge at 948 px (no overlap of the LCD); the socle corner overlaps the panel by about 75 px, which is intended.

As implemented (stage 4, scene/renderer.ts `updateCamera`, `retargetFraming`): the offset is applied to the frustum (left and right shifted by ox units), not to the camera, so the parallax still turns around the machine's centre and the hit projection follows by its signature. (The sign in the paragraph above is inverted: translating the camera along -R would move the machine to the right; the frustum shift moves it left as intended.) The stage width is `stageW = max(W / 3, min(W - gutter, (panelLeft(W) - 16) / (0.5 + 7.018 / (2 hwBase))))`: the second term keeps the right corner of the LCD bezel (plateau point (6.25, -3.675), 7.018 units right of the machine's projected centre, theme.ts `LCD_RIGHT_SX`) 16 px left of the panel, which the gutter alone does not below 1440 px (at 1280 the LCD would pass 18 px under the panel, at 1024 93 px). `panelLeft(W)` (theme.ts) mirrors the CSS box of 11.2. Tween: t from 0 to 1 over 400 ms easeInOutCubic, hw and ox interpolate on t; reduced motion and layout switches: cut. Measured: 1440 x 900 s 53.43 px per unit, LCD right edge 932 px, panel 948 px, plateau corner 991 px (the empty corner, 43 px under the panel); 1280 x 800 s 44.26, LCD 772, panel 788; 1024 x 768 s 32.79, LCD 572, panel 588. Closing returns to t 0 (s 69.06 at 1440).

### 3.4 Explode framing

When explode enters "opening": hwTarget = max(hwCurrent, 8.47 * aspect) (the stack is 14.57 units tall and must fit in 86 % of the height), target y from 0 to +2.0 (the stack's projected centre rises by 1.76 units). Tween 900 ms easeInOutQuart in step with the layers; the reverse on "closing". On mobile hwTarget = hwCurrent (21 units of frustum height already fit). Section framing and explode framing compose (the offsets add).

As implemented (stage 5, scene/renderer.ts `updateCamera`, theme.ts `EXPLODE`): the plateau tilts the other way (12.1, section 19 item 64), so the exploded stack is shorter: 12.09 units in projection (sy -5.31 to 6.78 with the pads and knobs on top, rest parallax), its centre 0.74 units above the target, against 14.81 units centred 2.10 above for the +12 tilt the numbers above were written for. Implemented: hwTarget = max(hwCurrent, 7.03 * aspect) (the stack in 86 % of the height, `EXPLODE.fitHalfH`) and the view rises by 0.74 units (`EXPLODE.shiftY`) on both layouts, which centres the stack. Both act on the frustum (top and bottom shifted by oy, hw scaled), not on the camera, like the section framing; with both active, the section offset is recomputed from the current hw so the machine's centre stays at stageW / 2 px. The framing t is the explode timeline's own curve (900 ms easeInOutQuart, no delay, reversed on closing), not a separate tween. Measured: 1440 x 900 closed hw 10.425 (69.06 px per unit), open hw 11.248 (64.02), frustum top 7.77 and bottom -6.29; 390 x 844 hw stays 8.839 (the 21-unit frustum already fits), top 11.256, bottom -9.776, the stack's box from 98.8 to 365.6 px in the 464 px canvas. With a section open on desktop, the section hw (13.47 at 1440) already exceeds the explode need: only the vertical shift applies.

As implemented (review pass, scene/explode.ts): the framing t is `max(plateau, socle)`, the layer furthest from its closed place, not the plateau's curve alone. Opening is unchanged (the plateau leads with no delay); on CLOSE the framing now follows the plateau, which only starts coming down after 160 ms, instead of shrinking at once: the old curve clipped the lifted back-left corner of the plateau past the top of the canvas for 150 to 250 ms on wide viewports (6.7 px at 1280 x 720, 18 px at 1920 x 960). Measured over the whole CLOSE timeline, `measure().plateau.y` never goes above the canvas: minimum 51.2 px at 1440 x 900, 20.5 px at 1920 x 960, 16.9 px at 1440 x 789, 5.6 px at 2560 x 1300 with the pointer in the bottom-right corner (parallax yaw -4, pitch +4), each minimum being the closed end state.

### 3.5 Parallax (desktop, fine pointer, full motion only)

Pointer position normalised over the canvas host to nx, ny in [-1, 1]. Target yaw = -nx * 4 deg about world +y; target pitch = ny * 4 deg about the world axis a = normalize(1, 0, -1) (the screen-horizontal axis; positive angle dips the near edge). Both applied to machineRoot (section 5.1), never to the camera. Smoothing per frame: current += (target - current) * (1 - 0.94 ^ (dt / 16.667)), which is the brief's 0.06 at 60 fps and frame-rate independent. The loop stays alive while |target - current| > 0.0003 rad; pointerleave sets the target to 0. Effective elevation stays within 26.5 to 34.5 deg. Gyroscope: none. Disabled on coarse pointers and under reduced motion.

### 3.6 Resize

ResizeObserver on the canvas host, coalesced to one requestAnimationFrame: `renderer.setSize(w, h, false)`, camera bounds recomputed from section 3.2 to 3.4, twins and trace re-projected, one render. Layout switches (desktop <-> mobile at 768 px) re-present the same state (section 11).

---

## 4. Rendering

### 4.1 Renderer

`new WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' })`. `setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2))`. As implemented (review pass): isMobile is the device class, `(max-width: 767px)` OR `(hover: none) and (pointer: coarse)`, not the width alone, so a phone in landscape (844 x 390) or a tablet keeps the mobile tier and its 16 draw-call budget (checked by forcing the coarse query at 1440 x 900: DPR 1.5, no antialias, shadow map 512, silk 1024 x 642, 14 / 16 calls, framing still desktop at 78 %). A `(resolution: N dppx)` media query, re-armed on each change, calls resize() when the window moves between a 1x and a 2x screen (the CSS size does not change then). `setClearColor(0x0A0A0B, 1)`. `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.0`, `outputColorSpace = SRGBColorSpace`, `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`. WebGL2 is required by three 0.186: if `canvas.getContext('webgl2')` returns null before creating the renderer, or the constructor throws, the fallback page renders (section 13.4). `renderer.compile(scene, camera)` once before the first frame so the intro does not stutter.

### 4.2 Lights

| Light | Parameters |
|---|---|
| DirectionalLight | colour 0xFFF6E8 (warm white), intensity 2.2 (tune 1.8 to 2.6), position (8, 14, 6), target (0, 0, 0), castShadow, shadow.mapSize 1024 desktop / 512 mobile, shadow.camera left -11 right 11 top 11 bottom -11 near 1 far 40, shadow.bias -0.0004, shadow.normalBias 0.02 |
| HemisphereLight | sky 0xF6F1E7 (bone), ground 0x0A0A0B (ink), intensity 0.35 |
| RectAreaLight | colour 0xF2C230 (yellow), intensity 0.7 (tune 0.4 to 1.0), width 6, height 3, position (-9, 2.5, 1), lookAt(0, 0.8, 0); `RectAreaLightUniformsLib.init()` called once per page before the first RectAreaLight is created |

No HDRI, no scene.environment, no fog, no post-processing.

As implemented (stage 6, scene/renderer.ts, theme.ts `LIGHT_RIM`): the RectAreaLight and `RectAreaLightUniformsLib` are removed. Their LTC tables were a lazy chunk of 101.3 KB gzip that every visit of /v4 loaded (the first frame even waited for it, 1.5 s at most) and that put /v4 at 298.4 KB against the 220 KB budget (section 19 item 80). The warm rim is a `PointLight(0xF2C230, 6, 0, 2)` (distance 0, physical decay 2) at (-9, 3, 0), without shadow. It was fitted by image difference at 1440 x 900 against the RectAreaLight render (the old light and the candidates in the same scene, one visible at a time, whole-frame `readPixels`): mean absolute error over the machine 0.21 levels closed and 0.15 open, against 0.56 and 0.45 with no rim at all; on the pixels the RectAreaLight lit by 5 levels or more (the left bevel band, the left part of the top face, the front faces of the pads) the mean signed error is -0.1 / 0.0 levels (red / green) against -8.1 / -5.6 without a rim, so the warm edge is kept. A DirectionalLight from the same direction could not match (0.47 at best: it lights the right end as much as the left), a SpotLight left larger errors on the lifted plateau, and a PointLight at y 3.5 to 4 overlit the lifted plateau's left bevel. The calibrated colours of stages 1 to 5 (ALBEDO_GAIN, PAD_GLOW, LIT, the PCB) stay valid. The first frame now waits for the fonts only (1.5 s at most).

### 4.3 Shadow

One `PlaneGeometry(40, 40)` rotated -PI/2 about x at local y -0.001, `ShadowMaterial({ opacity: 0.45, depthWrite: false })`, `receiveShadow = true`, child of socleGroup so it sinks with the base during the explode. Casters: plateau, socle, pads, knob bodies on desktop; plateau and pads only on mobile. The plateau receives shadows (pads and knobs shade it).

As implemented (review pass, scene/materials.ts `withContactShadow`, theme.ts `CONTACT_SHADOW`): the key light (8, 14, 6) sits on the camera's side, so the cast shadow falls behind the machine and the machine hides it (read-back: every background point around the machine was exactly the ink, 10,10,11; section 19 item 16). The same plane now also carries a contact shadow, computed in its own shader (onBeforeCompile, no texture, no extra draw call): alpha = max(0.45 x (1 - shadowMask), 0.45 x (1 - smoothstep(0, 1.6, d))) where d is the fragment's distance, in socle space, to the rounded footprint of the socle (14.3 x 9.3, corners 0.8). Read back at 1440 x 900: the ink under the front and side edges of the base goes from 10 to 6 over about 28 px, then back to 10 by about 90 px (the socle walls read 3 to 4). Draw calls unchanged (16 / 18 desktop, 14 / 16 mobile).

### 4.4 Materials

All `MeshStandardMaterial` unless stated. `flatShading: true` on the two body meshes only.

| Name | Used by | Settings |
|---|---|---|
| body | plateau, socle | vertexColors true, flatShading true, roughness 0.7, metalness 0 |
| pad | pads | vertexColors true (top #2F2F32, sides graphite), roughness 0.8, metalness 0, instanceEmissive patch |
| button | steps, RUN, CLEAR, OPEN | roughness 0.6, metalness 0, instanceColor, instanceEmissive patch |
| knob | knob bodies (with the bone mark as vertex colour) | vertexColors true, roughness 0.65, metalness 0 |
| metal | caps and screws | vertexColors true, roughness 0.55, metalness 0.7 (0.45 until the review pass; the brief's range is 0.55 to 0.8) |
| ring | knob rings | MeshBasicMaterial, toneMapped false, instanceColor |
| led | LEDs | MeshBasicMaterial, toneMapped false, instanceColor |
| lcd | LCD plane | MeshBasicMaterial, map lcdTexture, toneMapped false |
| silk | plateau silk plane | map silkTexture, transparent true, depthWrite false, polygonOffset true, polygonOffsetFactor -1, polygonOffsetUnits -1, roughness 0.7 |
| pcb | PCB board | map pcbTexture, roughness 0.75, metalness 0 |
| parts | merged PCB components | vertexColors true, roughness 0.55, metalness 0 |
| mention | socle mention plane | MeshBasicMaterial, map, transparent true, toneMapped false |
| shadow | shadow plane | ShadowMaterial opacity 0.45, depthWrite false |

instanceEmissive patch (scene/materials.ts): a `InstancedBufferAttribute(new Float32Array(count * 3), 3)` named `instanceEmissive` on the geometry, and `material.onBeforeCompile = (shader) => { vertex: declare 'attribute vec3 instanceEmissive; varying vec3 vInstanceEmissive;' and assign it in main; fragment: declare the varying and append 'totalEmissiveRadiance += vInstanceEmissive;' right after the '#include <emissivemap_fragment>' line }`. Set `material.customProgramCacheKey = () => 'instEmissive'`. Twenty lines, no per-instance emissive otherwise exists in three.

Colour constants (theme.ts, hex strings plus the same values as numbers for three):

| Token | Hex | Use |
|---|---|---|
| ink | #0A0A0B | scene clear colour, page background |
| graphite | #141417 | plateau flat top and sides, pad sides |
| graphiteHi | #1C1D21 | plateau bevel, knob bodies, CLEAR and OPEN buttons |
| graphiteLo | #08080A | socle, LCD bezel |
| line | #2E3036 | LED off, silk rules, TEMPO/TONE/LEVEL rings, socle mention |
| bone | #F6F1E7 | text, knob marks, silk at 70 % alpha |
| yellow | #F2C230 | nav knob rings, RUN when running, trace, OPEN frame, active row marker |
| yellowHi | #FFD75E | LED on, hover ring, pad flash |
| red | #C8442F | RUN/STOP when stopped, nothing else |
| padTop | #2F2F32 | bone 12 % over graphite |
| stepBtn | #585756 | bone 30 % over graphite |
| ledSet | #6E6C6A | bone 40 % over graphite: programmed step |
| ledHover | #A9A69F | bone 70 % over graphite: hovered step |
| lcdBg | #0F1410 | LCD base |
| lcdInk | #9FB89A | LCD text |
| lcdGlass | #29322A | lcdInk at 18 % over lcdBg: LCD fill |
| pcb | #12301F | board |
| copper | #B8763A | traces and pads |
| chip | #0B0B0D | chip bodies |
| leg | #8A8F98 | chip legs, crystals |
| cap | #23283A / #4A5068 | capacitor body / top |
| cell | #B9BCC4 | coin cell |
| resistor | #C9B48A | resistors |

As implemented (review pass): the metal caps use roughness 0.55 (the brief's floor; its metalness exception, 0.7, stays) and their calibrated albedo `LIT.cap` is scaled by 0.86 to keep the displayed top at 145,142,138 (at equal albedo the rougher metal read 156,153,149). Four materials stay unlit `MeshBasicMaterial` with `toneMapped: false` against the brief's "MeshStandardMaterial uniquement": the knob rings, the LEDs, the LCD plane and the socle mention, so that they display their exact tokens (a lit material would add the key light's highlight and the ACES curve). Deliberate deviation, owner question in section 19 item 105.

### 4.5 Canvas textures

Fonts: v4.css declares its own `@font-face` for "Robot Radicals" (/fonts/RobotRadicals.otf, .ttf) and "SF Pro Display" 300/400/500/600/700/900 (/fonts/SF-Pro-Display-*.woff2), copied from src/styles.css lines 125 to 170. Every canvas texture draws once with the fallback font (system-ui), then `Promise.all([document.fonts.load('700 40px "SF Pro Display"'), document.fonts.load('400 40px "Robot Radicals"')])` resolves (or a 3 s timeout fires) and it redraws, sets `needsUpdate = true`, calls requestRender.

| Texture | Size desktop / mobile | Content |
|---|---|---|
| silk (plateau) | 2048 x 1284 / 1024 x 642 (covers the 13.4 x 8.4 flat top; 152.8 / 76.4 px per unit) | section 5.4 |
| lcd | 512 x 192 both | section 5.5, updated at most 4 times per second and only when its text changed |
| pcb | 1024 x 640 / 512 x 320 (12.6 x 7.8 board; 81.3 / 40.6 px per unit) | section 5.7 |
| mention | 256 x 36 both | "V.4 / 2026" |

All: `colorSpace = SRGBColorSpace`, `anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())`, mipmaps on (LinearMipmapLinearFilter) except the LCD (LinearFilter, no mipmaps). Silk text: `font = '700 {px}px "SF Pro Display"'`, uppercase, `ctx.letterSpacing = '0.18em'` when the property exists, otherwise glyph-by-glyph with 0.18 em advance; colour rgba(246, 241, 231, 0.70). Font pixel size from a cap height in units: px = capUnits * pxPerUnit / 0.70 (SF Pro cap height is 0.70 em).

Repo trap: index.html replaces `CanvasRenderingContext2D.prototype.createPattern` with a function returning null and wraps `getContext('2d')`. The textures use fillText, fillRect, arc, lineTo and getImageData only; never createPattern.

As implemented (stage 5): the LCD texture also has mipmaps and anisotropy (LinearMipmapLinearFilter, like the others): the plane is seen at a grazing angle and is 74 px wide on the phone, where a plain linear filter would shimmer; it redraws at most 4 times per second and a redraw plus upload plus render measured 2.1 ms on the desktop (section 19 item 69). The LCD uses the system monospace and never waits for a font. The PCB and mention textures redraw after `document.fonts.load` like the silk. The PCB canvas is painted with pre-compensated colours (materials.ts `litCss(tone, gain)`: the token in linear space times the gain, back to sRGB), calibrated by pixel read-back like the vertex colours (section 19 item 75).

### 4.6 Draw calls and triangles (budget: 20 desktop, 16 mobile; 60k / 35k triangles)

Main pass, machine closed (11 calls): shadow plane, plateau, socle, silk, pads (InstancedMesh 4), buttons (InstancedMesh 19), LEDs (InstancedMesh 21), knob bodies (InstancedMesh 8), caps and screws (InstancedMesh 12), rings (InstancedMesh 8), LCD. Plus the socle mention plane (1) = 12.
Shadow pass: 4 desktop (plateau, socle, pads, knob bodies), 2 mobile (plateau, pads).
Exploded adds: PCB board (1), PCB components merged (1) = 2.

| State | Desktop | Mobile |
|---|---|---|
| closed | 12 + 4 = 16 | 12 + 2 = 14 |
| exploded | 14 + 4 = 18 | 14 + 2 = 16 |

Triangles (estimates): plateau 500, socle 400, pads 4 x 300, buttons 19 x 96, LEDs 21 x 12, knob bodies 8 x 140, caps 12 x 80, rings 8 x 480, LCD 2, silk 2, shadow 2, mention 2: about 10.5k closed; PCB board 12 and components about 4k: about 14.5k exploded. Mobile uses 24-segment cylinders and 32-segment rings: about 8k / 11k. The trace is SVG: zero draw calls.

Verify with `window.__v4.stats.drawCalls` and `.triangles` (renderer.info.render after each frame), on desktop closed, desktop exploded, mobile closed, mobile exploded.

As implemented (stage 5), read from `__v4.stats` (renderer.info.render after each frame): desktop 1440 x 900 closed 16 calls, 13,244 triangles; exploded 18 calls, 15,140 triangles; mobile 390 x 844 closed 14 calls, 9,960 triangles; exploded 16 calls, 11,648 triangles (budgets 20 / 60k and 16 / 35k). The PCB components are one call (1,884 triangles desktop, 1,676 mobile: each family is instanced on the CPU and merged, section 19 item 66). renderer.info.programs 13; memory 14 geometries and 9 textures while mounted (desktop), 0 and 0 after unmount (`__v4LastDispose`, also after an unmount with the machine open).

As implemented (stage 6, final code, unchanged by the rim swap): desktop 1440 x 900 16 / 18 calls and 13,244 / 15,140 triangles (closed / exploded), mobile 390 x 844 14 / 16 calls and 9,960 / 11,648 triangles. Frame cost at 2880 x 1800 device pixels, render plus a 1 x 1 `readPixels` to force the GPU sync, median of 30 renders: 1.1 to 1.3 ms closed after warm-up (1.1 ms with the PointLight at intensity 0 as well: the light costs nothing measurable).

---

## 5. Anatomy: every object, exact dimensions

### 5.1 Scene hierarchy

```
scene
  camera (OrthographicCamera)
  directional light + target, hemisphere light, rect area light
  machineRoot (Group, at origin; parallax yaw and pitch apply here)
    plateauGroup (Group, position (0, 1.6, 0); explode: y +3.5 and tilt 12 deg about (1,0,-1)/sqrt2, pivot = this origin)
      plateau (Mesh, merged: plate + LCD bezel, vertex colours)
      silk (Mesh, plane 13.4 x 8.4 at y 0.004)
      pads (InstancedMesh x4)
      buttons (InstancedMesh x19: 16 steps, RUN, CLEAR, OPEN)
      leds (InstancedMesh x21: 16 step LEDs, 5 knob LEDs)
      knobs (InstancedMesh x8: 5 nav, TEMPO, TONE, LEVEL)
      caps (InstancedMesh x12: 8 knob caps, 4 screws)
      rings (InstancedMesh x8)
      lcd (Mesh, plane 3.5 x 1.25)
    pcbGroup (Group, position (0, 0.72, 0); visible only from "opening" to "closing")
      board (Mesh, box 12.6 x 0.1 x 7.8, textured top)
      parts (Mesh, merged components; scale.y animates 0.001 to 1 during the reveal)
    socleGroup (Group, position (0, 0, 0); explode: y -1.5)
      socle (Mesh, merged: base + connectors, vertex colours)
      mention (Mesh, plane on the front face)
      shadowPlane (Mesh)
```

Only three objects move during the explode: plateauGroup, pcbGroup.parts (scale) and socleGroup (section 12). Only the pads' instance matrices, the knobs' (with caps and rings) and machineRoot's rotation move otherwise.

### 5.2 Body

| Part | Geometry | Position (local) | Colour rule |
|---|---|---|---|
| plateau plate | ExtrudeGeometry of a rounded-rect Shape 13.4 x 8.4, corner radius 0.6, curveSegments 8, depth 0.9, bevelEnabled, bevelThickness 0.18, bevelSize 0.3, bevelSegments 2, then rotated so the extrusion axis is y and translated so the top of the top bevel is at local y 0 (the plate spans y -0.9 to 0; outer footprint 14 x 9) | plateauGroup origin | per-vertex from the flat face normal: ny > 0.97 graphite (flat top, 13.4 x 8.4), ny < -0.97 graphiteLo (hidden bottom), abs(ny) < 0.15 graphite (sides), otherwise graphiteHi (the bevel band, 0.3 wide) |
| LCD bezel | BoxGeometry 3.8 x 0.06 x 1.55 | centre (4.35, 0.03, -2.9), merged into the plateau mesh | graphiteLo |
| socle base | ExtrudeGeometry of a rounded-rect 14.1 x 9.1, corner radius 0.7, depth 0.7, bevelThickness 0.06, bevelSize 0.1, bevelSegments 1; outer footprint 14.3 x 9.3, spans y 0 to 0.7 | socleGroup origin | graphiteLo, bevel band graphite |
| power inlet | BoxGeometry 0.12 x 0.45 x 0.7 protruding from the +x face | centre (7.21, 0.35, 2.6) | graphite |
| jacks (2) | CylinderGeometry r 0.14, length 0.1, axis x | (7.2, 0.35, 1.6) and (7.2, 0.35, 1.1) | line |
| USB | BoxGeometry 0.12 x 0.22 x 0.5 | (7.21, 0.35, 0.3) | line |
| mention plane | PlaneGeometry 1.6 x 0.22 facing +z, texture "V.4 / 2026" in line colour on transparent | (-5.2, 0.35, 4.66) | line |

The connectors are merged into the socle geometry (one draw call). The plateau's flat top is 13.4 x 8.4: usable placement area x in [-6.65, 6.65], z in [-4.15, 4.15].

As implemented (stage 5, scene/machine.ts `buildConnectors`, scene/silk.ts `Mention`): connectors as specified, merged with the socle (still one draw call); each jack has an ink hole (r 0.06) a hair proud of its line barrel. The mention is SF Pro Display 700, tracking 0.18 em, 22 px centred on the 256 x 36 canvas, `MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })`: it displays #2E3036 exactly on the socle's front face, readable up close and quiet at a glance; it sinks with the socle.

### 5.3 Plateau objects

Zone A, pads (InstancedMesh, RoundedBoxGeometry(2.2, 0.35, 2.2, 2, 0.1) translated so its base is at y 0; vertex colours top padTop, sides graphite; castShadow):

| Pad | Instance centre (x, z) | Key |
|---|---|---|
| BD | (-5.05, -1.90) | A |
| SD | (-2.00, -1.90) | S |
| TOM | (-5.05, 1.15) | D |
| CH | (-2.00, 1.15) | F |

Press: instance y from 0 to -0.12 in 60 ms (linear), back to 0 in 180 ms easeOutCubic; instanceEmissive on the top face only (per-vertex `emissiveMask`, 1 on the flat top, 0 on the sides) at the flash colour for 120 ms, then 0, except the selected instrument which rests at the selected colour. As implemented both colours are calibrated to what is DISPLAYED through ACES (theme.ts `PAD_GLOW`, section 19 item 22): flash reads #F2C230 (241,194,91 measured), selected reads padTop plus 25 % yellow (97,82,47). Sequencer hits flash the pad (emissive only, no movement) for 100 ms (`Pads.flash`).

Zone B, sequencer (buttons InstancedMesh: CylinderGeometry(1, 1, 1, 24 desktop / 16 mobile) translated base y 0, scaled per instance; LEDs InstancedMesh: CircleGeometry(0.09, 12) rotated flat, at y 0.012):

| Object | Centre (x, z) | Scale (r, h, r) | instanceColor |
|---|---|---|---|
| step i, i = 0..15 | (-0.3 + 0.42 i, 2.20) | (0.17, 0.10, 0.17) | stepBtn |
| step LED i | (-0.3 + 0.42 i, 1.75) | radius 0.09 | line / ledSet / ledHover / yellowHi (section 7.5) |
| RUN/STOP | (1.5, 3.30) | (0.42, 0.12, 0.42) | red; running: yellow with instanceEmissive yellow * 0.5 |
| CLEAR | (4.3, 3.30) | (0.30, 0.12, 0.30) | graphiteHi |
| OPEN | (4.4, -1.75) | (0.34, 0.12, 0.34) | graphiteHi |

As implemented (stage 3, scene/sequencer3d.ts): the buttons InstancedMesh holds 18 instances today (steps 0 to 15, RUN 16, CLEAR 17; OPEN arrives with the explode stage as instance 18), receives shadows, casts none; the LEDs InstancedMesh holds the 16 step LEDs (the 5 knob LEDs are appended by the knob stage). Button colours are linear albedos calibrated on the DISPLAYED top face (theme.ts `LIT`, section 19 item 38): stepBtn renders 92,86,78, red 200,68,47, graphiteHi 29,28,29; RUN while running adds `RUN_GLOW` = yellow x 0.5 (the spec value) as instanceEmissive and renders 238,194,76 on top, 230,185,65 on the side (blue is out of gamut under ACES, like the pad flash). LEDs are `MeshBasicMaterial({ toneMapped: false })` with instanceColor, so they display the exact tokens (read back: line 46,48,54; ledSet 110,108,106; yellowHi 255,215,94).

As implemented (stage 5): OPEN is instance 18 of the buttons InstancedMesh (19 instances), graphiteHi like CLEAR (`LIT.clear`), at (4.4, -1.75) inside the yellow silk frame; its label OPEN or CLOSE is drawn by the silk at the start of each opening and closing (two redraws per cycle, 3.0 ms each with the upload and a render). Hotspot `open`: disc r 0.34, height 0.12, after the five nav knobs and before TONE and LEVEL.

Zone C and knobs (knobs InstancedMesh: merged CylinderGeometry(0.42, 0.42, 0.5, 32 desktop / 24 mobile) with base at y 0 plus a mark BoxGeometry 0.05 x 0.02 x 0.26 at (0, 0.505, -0.22) in bone; caps InstancedMesh: merged CylinderGeometry(0.14, 0.14, 0.04, 20) plus a slot BoxGeometry 0.02 x 0.012 x 0.2 in line colour; rings InstancedMesh: TorusGeometry(0.42, 0.03, 6, 40 desktop / 32 mobile) rotated flat):

| Object | Centre (x, z) | Knob scale | Cap at y | Ring colour | LED (x, z) | Silk label at (x, z), cap height |
|---|---|---|---|---|---|---|
| TRACKS | (0.9, 0.3) | 1 | 0.50 | yellow | (0.9, -0.45) | (0.9, 1.05), 0.18 |
| MIXTAPES | (2.2, 0.3) | 1 | 0.50 | yellow | (2.2, -0.45) | (2.2, 1.05), 0.18 |
| PRESS | (3.5, 0.3) | 1 | 0.50 | yellow | (3.5, -0.45) | (3.5, 1.05), 0.18 |
| SHOWS | (4.8, 0.3) | 1 | 0.50 | yellow | (4.8, -0.45) | (4.8, 1.05), 0.18 |
| CONTACT | (6.1, 0.3) | 1 | 0.50 | yellow | (6.1, -0.45) | (6.1, 1.05), 0.18 |
| TEMPO | (6.1, 3.3) | (0.95, 0.8, 0.95) | 0.40 | line | none | (6.1, 3.95), 0.16 |
| TONE | (0.9, -2.4) | (0.67, 0.8, 0.67) | 0.40 | line | none | (0.9, -1.85), 0.16 |
| LEVEL | (2.1, -3.5) | (0.67, 0.8, 0.67) | 0.40 | line | none | (2.1, -2.95), 0.16 |

As implemented (stage 3, scene/knobs.ts): class `Knobs` builds the three InstancedMeshes for a list of knob specs; the Stage passes [TEMPO] only (theme.ts `TEMPO_KNOB`), the knob stage appends the five nav knobs, TONE and LEVEL to that list (and the 4 screws to the caps). The ring rests on the plateau (tube centre at y 0.03) and takes the knob's x and z scale; the cap does not scale. Calibrated displayed colours: knob body graphiteHi x 3 (top 30,29,30), bone mark 241,238,234, metal cap 145,142,138 (target leg, metalness 0.7 with no environment). TEMPO angle about +y is `+135 - 270 * (bpm - 100) / 50` deg, so the knob turns CLOCKWISE (seen from above) as the tempo rises: 100 BPM at +135 (mark at half past seven), 130 BPM at -27, 150 BPM at -135 (section 19 item 39). API for the next stage: setAngle(id, rad), setRise(id, y), setRing(id, tone), hotspot(id, kind, layer), info().

As implemented (stage 4): the Stage passes the eight knobs in this order: TEMPO, TRACKS, MIXTAPES, PRESS, SHOWS, CONTACT, TONE, LEVEL (theme.ts `TEMPO_KNOB`, `NAV_KNOB_SPECS`, `TONE_KNOB`, `LEVEL_KNOB`); still three draw calls (bodies, caps, rings). The five knob LEDs are instances 16 to 20 of the step LED InstancedMesh (`Sequencer3D.setKnobLed`, no extra draw call), line when off, yellowHi for the open section. Section change: the active knob turns to -30 deg and the previous one back to 0, 220 ms easeOutCubic (Stage tweens `knob.angle.<id>`); hover with a mouse: the knob, its cap and ring rise to 0.08 in 150 ms easeOutCubic and the ring turns yellowHi, leaving reverses both; reduced motion: instant. TONE and LEVEL follow the bus values with the TEMPO convention (`potAngle(v)` = +135 - 270 v deg, clockwise as the value rises): tone 1.0 at -135 deg, level 0.8 at -81 deg. New Knobs API: `angleOf(id)`, `riseOf(id)`, `hotspot(id, kind, layer, hotspotId, section)`; knobs.ts exports `potAngle` and `tempoAngle`. The 4 screws are NOT placed: the front-right one (6.45, 4.0, radius 0.091) would sit on the final O of the TEMPO label, which spans x 5.63 to 6.57 and z 3.87 to 4.03 (section 19 item 52).
Nav knob angles: rest 0, active -30 deg about +y (clockwise seen from above), tween 220 ms easeOutCubic; the cap and ring follow the knob (same instance transform). Hover (desktop): knob, cap and ring rise by 0.08 over 150 ms easeOutCubic; ring instanceColor yellowHi. TEMPO angle = -135 + 270 * (bpm - 100) / 50 deg; TONE and LEVEL angle = -135 + 270 * value deg. Knob LED colours: off line, on yellowHi.

Screws: 4 instances of the caps geometry, scale (0.65, 1, 0.65), at (+/-6.45, 0, +/-4.0), rotation.y fixed at 0.3, 1.1, 2.0 and 2.6 rad.

### 5.4 Silk (plateau texture content)

Canvas pixel of a plateau point (x, z): px = (x + 6.7) / 13.4 * W, py = (z + 4.2) / 8.4 * H. All text SF Pro Display 700, uppercase, tracking 0.18 em, bone 70 %, centred on its point unless stated.

| Item | Text | Point (x, z) | Cap height (units) |
|---|---|---|---|
| pad labels | BD, SD | (-5.05, -0.585), (-2.0, -0.585) (was -0.38: hidden by the TOM and CH pads, section 19 item 24) | 0.26 |
| pad labels | TOM, CH | (-5.05, 2.6), (-2.0, 2.6) | 0.26 |
| wordmark | MAUDITE MACHINE | (-3.5, 3.45) | 0.30 |
| model | MM-808 | (-3.5, 3.9) | 0.16 |
| step numbers | 1, 5, 9, 13 | (x of steps 1, 5, 9, 13, 2.65) | 0.13 (bone 70 % like all the silk since the review pass; 45 % before) |
| transport | RUN/STOP, CLEAR, TEMPO | (1.5, 3.95), (4.3, 3.95), (6.1, 3.95) | 0.16 |
| nav labels | TRACKS ... CONTACT | table 5.3 | 0.18 |
| audio labels | TONE, LEVEL | (0.9, -1.85), (2.1, -2.95) | 0.16 |
| OPEN label | OPEN, or CLOSE while explode is open or opening | right-aligned at x 3.95, z -1.75 | 0.18 |
| OPEN frame | rounded rectangle, stroke 0.035 units, corner 0.12, yellow 100 % | from (3.0, -2.12) to (4.95, -1.38) | |
| rules | 0.02-unit lines in line colour: x = -0.55 from z -3.9 to 3.9; z = 1.45 from x -0.2 to 6.6 | | |

The silk redraws and re-uploads only when the OPEN label changes (two uploads per explode cycle) and after the fonts load.

### 5.5 LCD

Plane 3.5 x 1.25 at (4.35, 0.065, -2.9), texture 512 x 192. Fill lcdGlass, text lcdInk, font `400 34px ui-monospace, Menlo, Consolas, monospace`, 24 px padding, baselines at 76 and 150 px, 20 characters per line maximum (truncate with a trailing period). Composer (scene/screen.ts), evaluated at most every 250 ms and drawn only when the two strings changed:

- Line 1: left = section name in uppercase (TRACKS, MIXTAPES, PRESS, SHOWS, CONTACT, STUDIO) or "MM-808" when no section is open; right = `${bpm} BPM`.
- Line 2, first rule that applies: transient message (STEP 07 BD ON, CLEARED, TAP A PAD FIRST, NO SIGNAL; 800 ms, 4000 ms for NO SIGNAL) > engine notice ("SKIPPED " + title, while the notice is non-null) > sc loading "LOADING" > sc playing: title (13 chars max) left, timecode m:ss right > sc paused: title left, "PAUSED" right > running "RUN" + (instrument ? "  " + instrument : "") > "READY" + (instrument ? "  " + instrument : "").

Twin: `<div role="status" aria-live="polite" class="v4-sr">` with both lines as text (section 6.3).

As implemented (stage 4, state/lcd.ts): the composer is a store (`lcd.get()`, `lcd.subscribe()`, started and stopped by V4App), not part of the scene: the LCD mesh and its twin (a later stage) only read it. It recomposes on every change of the section, the pattern (bpm, instrument), RUN/STOP, the SoundCloud bridge and the transient message, at most every 250 ms (a change inside the window lands at its end), and publishes only when one of the two lines changed; its own timer runs only while a track plays (timecode) or a transient message is shown. `lcd.get()` = { l1, r1, l2, r2, text: [line1, line2], updates }. Titles and notices are uppercased; the left part is cut (trailing period) to leave the right part and one space: a title keeps 14 characters beside m:ss and 12 beside h:mm:ss (fmtTime gives h:mm:ss past one hour: the mixtapes). One deviation in the order of line 2: a running sequencer (RUN) comes before a paused track (PAUSED), because the machine that plays is the information of the moment (section 19 item 50). Examples measured through `__v4.state.lcd`: "TRACKS       130 BPM", "LIMBOS          0:30", "LIMBOS        PAUSED", "SKIPPED DEAD LINK T.", "LOADING", "NO SIGNAL".

As implemented (stage 5, scene/screen.ts `Screen`, ui/Lcd.tsx): the mesh is the plane of this section, `MeshBasicMaterial({ map, toneMapped: false })`, so the glass shows #29322A and the text #9FB89A exactly. It subscribes to state/lcd.ts and redraws only when the two lines changed, with its own 250 ms guard (a change inside the window lands at its end); each redraw requests one frame. Left parts at x 24 px, right parts right-aligned at 488 px, baselines 76 and 150; the glyphs are compressed by 0.952 horizontally because the 512 x 192 texture covers a 3.5 x 1.25 plane (they would be 5 % too wide). Measured: a fake playing track (`__v4.sc.simulate`, progress pushed every 50 ms for 3 s) gave 4 redraws and 4 frames (LOADING, LIMBOS 0:12, 0:13, 0:14); tempo changes every 30 ms for 2 s gave 3.75 redraws per second, smallest gap 250.3 ms; at rest nothing. The twin is `<div role="status" aria-live="polite" aria-atomic="true" class="v4-sr">` with "{l1} {r1}. {l2}" plus PAUSED when paused: the ticking timecode is left out (one announcement per second would be noise); the section, the tempo, the title and the transient messages are announced.

### 5.6 Explode-only objects and PCB

pcbGroup at world (0, 0.72, 0). Board: BoxGeometry 12.6 x 0.1 x 7.8 centred (0, 0.05, 0), top face UV-mapped to the whole texture, the other five faces UV-mapped to a 4 x 4 px solid patch of the texture painted #0E2418 (one material, one draw call). Components: one merged BufferGeometry (vertex colours), positioned on the board top (y 0.1 in group space = world 0.82), geometry translated so the board top is y 0 and `parts.position.y = 0.1`, so `parts.scale.y` from 0.001 to 1 reveals them from the board.

| Component | Geometry | Positions (x, z on the board) | Colour |
|---|---|---|---|
| big chips (clickable) | BoxGeometry 1.7 x 0.2 x 1.2 plus 16 legs BoxGeometry 0.06 x 0.08 x 0.16 at z +/-0.66, x = -0.7 + 0.2 j | LABEL (-3.6, -0.4), LIVE (0.0, -0.4), STUDIO (3.6, -0.4) | chip, legs leg |
| small chips | BoxGeometry 0.8 x 0.14 x 0.6 | (-1.8, 2.2), (1.8, 2.2), (-4.8, 2.0), (4.8, -2.6) | chip |
| capacitors | CylinderGeometry r 0.28 h 0.6 plus top disc r 0.28 h 0.02 | (-5.4, -2.4), (-4.6, -2.4), (-5.4, 0.6), (2.6, 2.4), (3.4, 2.4), (5.2, 1.2) | cap body, top |
| coin cell | CylinderGeometry r 0.5 h 0.14 | (5.0, -0.6) | cell |
| resistors | BoxGeometry 0.5 x 0.16 x 0.16 along x | z 3.2, x = -4.5 + 1.0 k, k = 0..9 | resistor |
| crystals | CylinderGeometry r 0.12 h 0.5, axis x | (-1.0, 1.2), (1.0, 1.2) | leg |

As implemented (stage 5, scene/pcb.ts, theme.ts `CHIP`, `CHIPS`, `PCB_PARTS`): under the lifted plateau only the front half and the right strip of the board are visible (78 % of its area at rest parallax with the -12 tilt, 47 % with +12), and the chip row of the table at z -0.4 was behind the plateau with either tilt (worst margins -0.8 to -2.5 units). Positions as built (board x, z):

| Component | Positions |
|---|---|
| big chips | LABEL (-2.8, 1.7), LIVE (0.6, 1.7), STUDIO (4.0, 1.7): body 1.7 x 0.2 x 1.2 from y 0.03 to 0.23, 2 x 8 legs, a yellow pin-1 dot (r 0.07); worst visibility margin 0.25 units over the whole parallax range (LABEL, pointer at the bottom-right corner of the canvas), 1.0 at rest |
| small chips U4 to U7 | (-4.9, -0.2), (-1.2, -0.4), (2.3, -2.4), (-2.7, -2.9) |
| capacitors C1 to C6 | (-5.35, 2.35), (-4.55, 2.35), (5.5, -2.6), (5.5, -1.8), (-3.6, -2.2), (0.4, -2.8); top disc r 0.26 |
| coin cell BT1 | (4.2, -2.6) |
| resistors R1 to R10 | z -1.15, x = -4.05 + 0.9 k |
| crystals X1, X2 | (-0.9, 0.35), (2.3, 0.35) |

Each family is a template geometry placed by a list of transforms; the placed copies are merged into one BufferGeometry with vertex colours (one draw call, section 19 item 66). The three big chips come first, so their vertex ranges are known: a hovered chip rises by 0.06 in 150 ms and only its range is re-uploaded. Neither the board nor the parts cast or receive shadows (section 19 item 70). Displayed colours at 1440 x 900: chip tops 10,8,7 (#0B0B0D), legs 147,147,147 (#8A8F98), capacitor sides 34,38,58 (capBody #23283A, lit from the side: gain 4), tops 66 to 76, 70 to 76, 91 to 92 (#4A5068), coin cell 183,180,178 (#B9BCC4), resistors 197,177,135 (#C9B48A), pin-1 dot 222,190,70.

### 5.7 PCB texture content

Base pcb. Traces: 24 polylines, copper, 3 px (desktop) wide, produced by a seeded generator (seed 808, mulberry32) that walks a 0.4-unit grid with 90 deg turns and 45 deg diagonals, never crossing a component footprint; round pads (copper ring 2 px, centre #0B1A11, radius 6 px) at both ends of every trace and at 20 grid intersections. Component footprints as bone 1 px outlines. Silk text bone 90 % (#F6F1E7 at 90 %: the brief's white is the warm white, never a pure white; pure white until the review pass): MAUDITE MACHINE (48 px, SF Pro Display 700, tracking 0.18 em) at the back-left; "MM-808  REV 4.0" (28 px); "V.4 2026" (22 px); LABEL, LIVE, STUDIO (30 px) centred 0.9 units in front of each big chip; designators C1 to C6, R1 to R10, U1 to U3, X1, X2 (16 px) beside their parts. No city: the brief's "MONTPELLIER" was printed until the review pass and is removed (site rule of commit 1e6cf7f, section 19 items 1 and 103; the one-line entry to restore it is in the comment above theme.ts `PCB_SILK`).

As implemented (stage 5): the generator starts traces from free grid points just outside each component (heading away from it, the three chips first), then from seeded random free points until 24 are drawn; a walk goes straight for 2 steps, then picks straight (weight 6), 45 deg (1.6 each side) or 90 deg (0.5 each side), never enters a component, a text box or another trace, never crosses the other diagonal of a grid cell, and is dropped under 4 points. Desktop result: 24 traces, 175 grid segments, 68 pads (48 trace ends, 20 vias). Footprints: white 1 px outlines, the three clickable chips framed in yellow 2 px (like the OPEN frame). The silk sits where the board shows: MAUDITE MACHINE 48 px along the front edge (x -6.0 to about 1.2, z 3.45), "MM-808  REV 4.0" 28 px right-aligned on the same line, "V.4 2026" 22 px right-aligned at x 6.0, z 0.15 (MONTPELLIER at z -0.3 until the review pass), LABEL, LIVE and STUDIO 30 px centred 1.02 units in front of their chip, designators U1 to U7, C1 to C6, BT1, R1 to R10, X1, X2 16 px (section 19 item 67). Displayed: board 12 to 18, 42 to 47, 27 to 28 (#12301F is 18,48,31), copper 183,117,51 (#B8763A).

---

## 6. Interactive objects, hit shapes, HTML twins

### 6.1 The list (scene/hit.ts, also `window.__v4.hotspots`)

Every hotspot carries: id, kind, world footprint (centre and half extents on its plane, base y, height), hit shape (quad: the projected top face polygon; disc: the projected ellipse of the top circle plus the side height; rect: the projected bounding box), the twin's role and aria, the pointer semantics, the keyboard shortcut, and `enabled` (chips only when explode is open; 3D steps disabled on coarse pointers).

| id | Shape | Twin | aria-label (English) | Pointer | Key |
|---|---|---|---|---|---|
| pad-BD, pad-SD, pad-TOM, pad-CH | box 2.2 x 2.2 at y 0..0.35 (convex silhouette of its 8 projected corners, section 19 item 25) | button | "Bass drum pad, key A" (snare S, tom D, hi-hat F) | pointerdown fires; CH held > 300 ms retriggers open | A S D F |
| step-1 .. step-16 | disc r 0.17 | button, aria-pressed = on for the selected instrument | "Step 7, bass drum on" (or "no instrument selected") | pointerup within 10 px | none (Tab, Enter) |
| run | disc r 0.42 | button, aria-pressed = running | "Run, Space" (fixed name since the review pass; it was "Stop, Space" while running) | pointerup | Space |
| clear | disc r 0.30 | button | "Clear pattern" | pointerup | none |
| tempo | disc r 0.40, height 0.4 | div role slider, aria-valuemin 100, max 150, now bpm, aria-valuetext "130 BPM" | "Tempo" | vertical drag: 100 px = 50 BPM; wheel +/-1 per notch; double-click resets 130 | arrows +/-1, Shift +/-5, Home/End |
| knob-tracks .. knob-contact | disc r 0.42, height 0.5 | button, aria-expanded | "Tracks, key 1" ... "Contact, key 5" | pointerup | 1 2 3 4 5 |
| open | disc r 0.34 | button, aria-pressed = open | "Open the machine, key O" (fixed name since the review pass; it was "Close the machine, key O" while open) | pointerup | O |
| tone, level | disc r 0.28, height 0.4 | div role slider 0..100 | "Tone" / "Level" | vertical drag: 150 px = full range; wheel +/-2 %; double-click resets (tone 100, level 80) | arrows +/-2, Shift +/-10 |
| chip-label | quad 1.7 x 1.2 at world y 0.82..1.02 | a href https://vrstlrecords.com target _blank rel noopener | "VRSTL Records, label" | pointerup | Enter, Space (review pass) |
| chip-live | quad | a href /techrider | "Tech rider, live" | pointerup | Enter, Space (review pass) |
| chip-studio | quad | button | "Studio setup" | pointerup | none |
| lcd | rect | div role status (not focusable) | | none | |

Tab order (DOM order of the twins): pads (4), steps (16), run, clear, tempo, the five nav knobs, open, tone, level, then chips (3, only rendered while explode is open or opening); the panel or sheet comes after the twins in the DOM.

As implemented (stage 3, ui/Hotspots.tsx; twins and keys come with the accessibility stage): steps, RUN and CLEAR fire on pointerup when the pointer moved at most 10 px (theme.ts `PRESS_SLOP_PX`) and the release point still picks the same hotspot; TEMPO starts a drag on pointerdown (pointer capture), 2 px per BPM upward (100 px = 50 BPM), after a 3 px dead zone; the wheel over TEMPO accumulates 100 px of delta per BPM (lines x 40, pages x 800; wheel up = faster; Ctrl + wheel is left to the browser) and calls preventDefault only over TEMPO; two taps without movement within 350 ms reset 130 BPM (mouse and touch alike, no dblclick listener). Hover (mouse): cursor `pointer` over hotspots, `ns-resize` over TEMPO, the hovered step's LED turns ledHover. Hit shapes of the discs are the convex hull of 12 points on the top and bottom circles (section 6.2), so a step is 22.7 x 17.5 px and RUN 56 x 35.6 px on the 1440 x 900 desktop (smaller than the footprint-box figures of the table in 6.5).

As implemented (stage 4): hotspot kinds `knob` (ids knob-tracks to knob-contact, each carrying its `section`), `tone` and `level`; the list order is pads, steps, run, clear, tempo, the five knobs, tone, level (OPEN and the chips are appended by the explode stage). Knobs fire on pointerup like the steps; TONE and LEVEL are potards like TEMPO: vertical drag 150 px for the whole range after the 3 px dead zone, wheel 2 % per 100 px of delta (preventDefault only over them), two taps within 350 ms reset (tone 1.0, level 0.8), cursor ns-resize. The mobile target rects of the knobs, TONE and LEVEL are 48 x 48 px; knob centres are 22.7 px apart on the 390 px phone and resolve by nearest centre. The digits 1 to 5 and Escape work from hooks/useKeys.ts; the twins (and A S D F, Space, O) come with the accessibility stage.

As implemented (stage 5): kinds `open` (fires on pointerup, like RUN) and `chip` (ids chip-label, chip-live, chip-studio, each carrying its `chip`) on the pcbGroup layer: a box 1.7 x 1.48 (legs included) from the board top to the chip top. The list always holds 34 entries in this order: pads, steps, run, clear, tempo, the five knobs, open, tone, level, the three chips; the chips are `enabled` while the machine is open, and during the opening once the plateau is 85 % up (about 570 ms after OPEN), never while closing (section 19 item 71); the LCD is not a hotspot (its twin is a visually hidden live region). Measured targets: desktop chips 143.9 x 85.8 px; 390 x 844 OPEN 48 x 48 (raw 14.5 x 9.6), chips 49.6 x 48 (raw 49.6 x 29.6), chip centres 59.5 px apart, and 15 touch probes 18 to 20 px off the chip centres all resolve to their chip. A chip on the canvas activates its twin (`element.click()`): LABEL and LIVE are real links, so pointer, keyboard and screen reader follow the same native link (new tab with noopener, same-tab navigation).

### 6.2 Hit testing

- Projection of a hotspot: its footprint corners (4 for a quad, 8 sampled points of the top ellipse plus the base for a disc) go through machineRoot's and the layer group's world matrices, then the camera projection, to canvas pixels; the result is cached and recomputed only on the frames where machineRoot, plateauGroup, socleGroup, the camera or the canvas size changed (a dirty flag set by parallax, explode, framing, resize), throttled to every third frame while a continuous animation runs, exact on the frame it settles. As implemented (stage 2, scene/hit.ts `HitMap`): a box projects its 8 corners, a disc 12 points on its top and bottom circles, and the hit shape is the convex hull of those points (the silhouette); the cache is refreshed lazily, on the next `pick()` or `list()`, whenever a signature of the camera matrices, the layers' world matrices, the layers' visibility, the enabled flags, the canvas size and the pointer class changed. Nothing runs in the render loop.
- pointermove and pointerdown on the hit layer (one absolutely positioned element over the canvas, `touch-action: none`): collect the enabled hotspots whose shape contains the point (point in projected polygon for quads, point in projected ellipse for discs, rect for the LCD); if several, take the nearest centre (the cluster rule); on coarse pointers also accept a point within 24 px of a hotspot's edge when it is inside no shape, again nearest centre. This is what gives every pad and transport button its 48 px minimum touch area on the phone (section 6.5).
- Pointer semantics: pads fire on pointerdown (the sound must not wait), sliders start a drag on pointerdown (pointer capture, vertical delta), everything else fires on pointerup when the pointer moved less than 10 px and is still over the same hotspot. A pointerdown outside any hotspot does nothing (no drag rotation exists).
- Hover (fine pointers): the hit layer's cursor becomes "pointer" over a hotspot; nav knobs rise and their ring turns yellowHi; step LEDs turn ledHover; the hover id is written to the bridge; leaving resets in 150 ms.
- Any pointerdown or keydown anywhere in the root also counts as the first gesture (section 8.4) and skips the intro.

### 6.3 Twins (ui/Hotspots.tsx)

- One `<div class="v4-twins">` per layout holds one element per hotspot, `position: absolute`, transparent background, `pointer-events: none` (the hit layer handles the pointer), positioned with `transform: translate(x px, y px)` and sized to the projected bounding box of its hit shape, enlarged to at least 48 x 48 px on coarse pointers and 32 x 32 px otherwise, centred on the hotspot's projected centre. Buttons have `type="button"`, `tabIndex 0`; links are real anchors; sliders have `tabIndex 0` and the slider aria set.
- Keyboard and assistive technology act on the twins (native click and key events) and call the same store actions as the hit layer; a pointer activation calls `twin.focus({ preventScroll: true })` on its twin so the focus order continues from there.
- `:focus-visible` on a twin draws a 2 px yellow outline with 2 px offset and a 10 px radius. The pointer never shows it.
- The LCD twin is `<div role="status" aria-live="polite">` updated with the two LCD lines (text only, at the same 4 Hz cap).
- In the fallback page the twins do not exist; the same actions are plain HTML controls (section 13.4).

As implemented (stage 5, ui/Hotspots.tsx `Twins`): the twin layer exists and holds OPEN (button, aria-pressed, "Open the machine, key O" / "Close the machine, key O") and the three chips from "opening" to the end of "closing" (anchor to https://vrstlrecords.com, target _blank, rel noopener, "VRSTL Records, label"; anchor to /techrider, "Tech rider, live"; button "Studio setup"), tabIndex 0 while the chips are live. Each twin takes the target rect of its hotspot (`x, y, w, h`), written into its style after every rendered frame (`stage.onView`), so it follows the explode, the framing and the parallax without a React render. Tab order checked with real key presses: OPEN, LABEL, LIVE, STUDIO, with the 2 px yellow outline (rgb 242,194,48) on :focus-visible; when the machine closes, a focus left on a chip returns to OPEN. The other hotspots get their twins in the accessibility stage (the component takes more kinds); a pointer activation does not move the focus yet.

As implemented (stage 6, ui/Hotspots.tsx `Twins`): one twin per hotspot, 31 while closed and 34 from "opening" to the end of "closing" (the three chips), in the DOM order of 6.1, inside `<div class="v4-twins" role="group" aria-label="MM-808 drum machine">`: the four pad buttons ("Bass drum pad, key A", "Snare pad, key S", "Tom pad, key D", "Hi-hat pad, key F", aria-pressed = selected instrument), the 16 step buttons ("Step 7, bass drum on" or "off", "Step 7, no instrument selected" when none is selected; aria-pressed = on for the selected instrument), RUN ("Run, Space" / "Stop, Space", aria-pressed = running), CLEAR ("Clear pattern"), TEMPO (`div role="slider"`, aria-valuemin 100, aria-valuemax 150, aria-valuenow the bpm, aria-valuetext "130 BPM", aria-orientation vertical), the five nav knobs ("Tracks, key 1" to "Contact, key 5", aria-expanded, aria-controls the section element `v4-section-<id>`), OPEN, TONE and LEVEL (`role="slider"`, 0 to 100, aria-valuetext "80 %"), then the chips (stage 5). Buttons activate natively (Enter on keydown, Space on keyup) and a held Enter does not repeat (the repeated keydowns are cancelled, one press = one activation); sliders take the Arrow keys (1 BPM or 2 %), Shift+Arrow and Page Up / Page Down (5 BPM or 10 %), Home and End. Twins are placed from `hit.list()` after every rendered frame and only when that list changed (the HitMap returns the same array until its signature moves), so resize, section framing, parallax, the intro and the explode move them without a React render; measured: every twin rect equals its hotspot's target rect (0.0 px difference, closed and exploded). Focus ring: `:focus-visible` 2 px solid yellow, 2 px offset, 10 px radius (read on a real Tab press: 2px solid rgb(242, 194, 48)). Pointer policy (deviation, section 19 item 81): a pointer activation does NOT move the focus to its twin; a pointerdown on the hit layer blurs a focused twin instead, so Space stays RUN/STOP after a click. On the mobile layout the 16 step twins stay in the DOM and in the Tab order with their aria-pressed (6.4) although their hotspots are disabled for touch; the Dock carries the same controls on the phone.

As implemented (review pass): (a) placement. The twins are no longer re-placed after every rendered frame. After each frame, `hit.version()` compares the signature of the view (camera, layers, canvas size, flags) without reprojecting or allocating; while it keeps changing (parallax, section framing, intro, explode), the twins wait, except the one that has the keyboard focus, which follows every frame so its ring stays on its object; once the view is still (a rendered frame with the same signature, or the Stage's new `onIdle` hook when the loop stops or after a resize rendered outside the loop) all twins are written once. Measured at 1440 x 900: a parallax move of 68 frames did 1 reprojection and 1 placement pass (at the end) instead of 68, with the twins equal to their hotspot rects afterwards (0.0 px); with a twin focused, 1 reprojection per frame and only that twin written. (b) RUN and OPEN keep a fixed name ("Run, Space", "Open the machine, key O") and carry their state in aria-pressed: a toggle button that also renamed itself read "Stop, Space, toggle button, pressed". (c) The LABEL and LIVE twins are anchors, which natively activate on Enter only: Space now activates them too (keydown, a user activation, so LABEL's new tab is allowed). (d) Space on a slider twin (TEMPO, TONE, LEVEL) is RUN/STOP (section 13).

### 6.4 Coarse-pointer hit list

When `(hover: none) and (pointer: coarse)` matches: the 16 step hotspots are disabled for the hit layer (their twins keep working for assistive technology) and the pattern is edited on the Dock (section 11.4). Enabled for touch: pads, run, clear, tempo, the five nav knobs, open, tone, level, chips.

As implemented (stage 3): the 16 step hotspots are disabled when the LAYOUT is mobile (max-width 767 px, the Dock is shown), not when the pointer is coarse, so that a coarse pointer on a desktop-layout screen (tablet, phone in landscape: 11 to 20 px step pitch, no Dock) can still program the steps; on the 390 x 844 phone both rules give the same result (`enabled === false` for the 16 steps). The Stage re-applies the rule on every layout change (section 19 item 40).

### 6.5 Projected sizes and the 48 px verification

Computed with the formulas of section 0 for the positions of section 5 (the script: for each hotspot take the 8 corners of its footprint box, project, take the bounding box; distance = between projected centres). Desktop 1440 x 900 (s 69.06), mobile 390 x 464 canvas (s 22.06). The last column is the nearest other hotspot enabled on that layout.

| Hotspot | Desktop w x h px | Mobile w x h px | Mobile nearest centre |
|---|---|---|---|
| pad-BD | 215 x 130 | 69 x 41 | pad-CH 48.3 px |
| pad-SD | 215 x 130 | 69 x 41 | knob-tracks 40.5 px |
| pad-TOM | 215 x 130 | 69 x 41 | pad-BD 53.4 px |
| pad-CH | 215 x 130 | 69 x 41 | pad-BD 48.3 px (run 51.4 px) |
| run | 82 x 49 | 26 x 16 | clear 49.0 px |
| clear | 59 x 37 | 19 x 12 | tempo 30.4 px |
| tempo | 78 x 63 | 25 x 20 | clear 30.4 px |
| nav knobs | 82 x 71 | 26 x 23 | next knob 22.7 px |
| open | 66 x 41 | 21 x 13 | knob-contact 26.7 px |
| tone / level | 55 x 52 | 17 x 16 | each other 36 px |
| step (each) | 33 x 23, pitch 23 px | 11 x 7, pitch 7.3 px | disabled on touch |
| lcd | 232 x 121 | 74 x 39 | |

Rule met on the 390 px phone: every pad and transport twin is at least 48 x 48 px; adjacent pads are 48.3 px apart or more; RUN is 49 px or more from every other touch hotspot; the one exception is knob-tracks, whose centre is 40.5 px from pad-SD's centre (the knob row cannot move further right, CONTACT already sits at the plateau edge): a tap on the SD pad itself always lands on SD because its own footprint is 69 x 42 px, and a tap between the two resolves by nearest centre. CLEAR, TEMPO, the nav knobs, OPEN, TONE and LEVEL are resolved by nearest centre inside their enlarged areas. At 375 px the pad spacing is 46.5 px; the brief's device is 390 px. The check is automated: `window.__v4.hotspots` lists w, h, cx, cy per hotspot, and the stage 3 acceptance script asserts w >= 48, h >= 48 and the spacing above on the mobile emulation.

Measured at stage 3 (390 x 844 emulation, coarse pointer, canvas 390 x 464.2, s 22.06): target rects (w x h in `__v4.hotspots`) run 48 x 48, clear 48 x 48, tempo 48 x 48, pads 68.6 x 48.1; raw silhouettes run 17.9 x 11.4, clear 12.8 x 8.8, tempo 17 x 17. Centres: run to clear 49.0 px, clear to tempo 29.3 px, run to pad-CH 53.4 px, run to tempo 78 px, pad-BD to pad-CH 48.3 px; step pitch 7.4 px (steps disabled). Region resolving to each hotspot with the coarse rule, sampled on the 1 px grid of the canvas: RUN 2862 px2, 60 x 59 px across its centre, and the whole 49.6 px disc around its centre resolves to RUN; CLEAR 2062 px2, 43 x 57 px across its centre, centred disc 29.5 px; TEMPO 2770 px2, 47 x 65 px, centred disc 29.6 px (CLEAR and TEMPO are 29.3 px apart: nearest centre splits the gap, section 19 item 42).

---

## 7. UI state machine

### 7.1 Store (state/store.ts, useSyncExternalStore; the scene reads a mirror in state/bridge.ts written by one effect)

| Field | Values | Initial |
|---|---|---|
| instrument | null, 'BD', 'SD', 'TOM', 'CH' | null |
| running | boolean | false |
| bpm | integer 100..150 | 130 (or persisted) |
| pattern | Record<Inst, string of 16 chars '0'/'1'> | default pattern (or persisted) |
| tone, level | 0..1 | 1.0, 0.8 |
| section | null, 'tracks', 'mixtapes', 'press', 'shows', 'contact', 'studio' | null |
| explode | 'closed', 'opening', 'open', 'closing' | 'closed' |
| hover | hotspot id or null | null |
| sc | { status: 'idle' / 'loading' / 'playing' / 'paused', id, title, position (s), duration (s) } derived from the engine | idle |
| notice | string or null (engine) | null |
| lcdMessage | { text, until } or null | null |
| layout | 'desktop', 'mobile' | from matchMedia (max-width: 767px) |
| coarse | boolean | from matchMedia (hover: none) and (pointer: coarse) |
| motion | 'full', 'reduced' | state/motion.ts |
| gl | 'webgl', 'fallback' | 'webgl', or 'fallback' with ?nowebgl=1 |
| audioReady, muted | boolean | false, from ?mute=1 |
| intro | 'pending', 'done' | 'done' under reduced motion or fallback |

Derived word for `data-v4-state`: fallback -> "nogl"; running -> "running"; instrument -> "selected"; otherwise "idle". The brief's other states are flags on the root: `data-v4-section`, `data-v4-exploded` (closed/opening/open/closing), `data-v4-sc`, `data-v4-motion`, `data-v4-gl`, `data-v4-layout`, `data-v4-instrument`, `data-v4-bpm`, `data-v4-running`, `data-v4-muted`, `data-v4-intro`.

### 7.2 Events and transitions

| Event | Guard | Effects |
|---|---|---|
| GESTURE (first pointerdown or keydown anywhere) | | audio.ensure() creates the AudioContext; audio.resume(); intro skipped (tweens finished); every later interaction calls audio.resume() again if the context is suspended |
| PAD_DOWN(inst) | | audio.trigger(inst, now) first; instrument = inst; press tween and flash; twins' aria-pressed refresh |
| PAD_HOLD(CH) at 300 ms | pointer still down on pad-CH | audio.trigger('CH', now, open = true) |
| STEP_TOGGLE(i) | instrument !== null, else lcdMessage "TAP A PAD FIRST" | pattern[instrument][i] flips; persist (debounced 300 ms); lcdMessage "STEP 07 BD ON" or "OFF" (step 1-based, two digits); LEDs refresh |
| RUN_TOGGLE | | not running: if sc.status is 'playing' then engine.toggle() (pause); clock.start(); running = true. Running: clock.stop(); running = false; playhead LED off |
| CLEAR | | every instrument's 16 steps to '0'; persist; lcdMessage "CLEARED"; running unchanged |
| TEMPO_SET(bpm) | clamp and round to 100..150 | bpm; clock.setBpm (takes effect at the next step boundary); persist |
| TONE_SET(v), LEVEL_SET(v) | clamp 0..1 | audio.setTone / setLevel (setTargetAtTime 20 ms); knob angle |
| KNOB(s) | | section === s: section = null (knob back to 0 deg, LED off, trace retracts, panel closes). Otherwise section = s: previous knob back, this knob to -30 deg and LED on, panel shows s, trace draws (desktop), sheet opens (mobile); 'shows' triggers the events fetch once |
| PANEL_CLOSE (x button, Escape, sheet drag, tab strip close) | | section = null, same effects as above |
| OPEN_TOGGLE | explode is 'closed' or 'open' | closed -> 'opening' (timeline, section 12) -> 'open'; open -> 'closing' -> 'closed'; silk OPEN label redraw at the start; chips enabled while open or opening; framing of section 3.4 |
| CHIP(label) | explode open | window.open('https://vrstlrecords.com', '_blank', 'noopener') |
| CHIP(live) | explode open | location.assign('/techrider') (leaves /v4; the provider pauses the widget on unmount) |
| CHIP(studio) | explode open | section = 'studio' (panel or sheet; no knob moves; the LCD shows STUDIO) |
| ROW_PLAY(item) | item.playable | if engine.current?.id === item.id: engine.toggle(); else engine.play(item.track, queueOf(section)); sc.status = 'loading' (pending, 8 s timeout -> lcdMessage "NO SIGNAL" 4 s) |
| ENGINE (current, playing, progress, duration, notice change) | | sc derived; on playing false -> true: if running then RUN_TOGGLE (auto STOP, the brief's rule); progress feeds the LCD only (no React render per tick: the store keeps position in a ref read by the 4 Hz composer) |
| ESC | | section !== null: PANEL_CLOSE; else explode open: OPEN_TOGGLE; else instrument = null |
| KEY(A/S/D/F) | no modifier, not in an editable field, not a key repeat | PAD_DOWN then PAD_UP (no hold mode from the keyboard) |
| KEY(Space) | focus not on a button or a link (native activation handles those; a slider twin keeps Space as RUN/STOP since the review pass), no modifier | RUN_TOGGLE, preventDefault |
| KEY(1..5), KEY(O) | same guards | KNOB(section by index), OPEN_TOGGLE |
| VIS_HIDDEN (document hidden or canvas host not intersecting) | | loop paused; audio.suspend() (ctx.suspend()); the clock interval keeps running and schedules nothing while currentTime is frozen; the last suspend or resume request wins (8.3) |
| VIS_VISIBLE | | audio.resume() attempted (may need the next gesture on iOS); requestRender |
| RESIZE | | section 3.6; layout may flip: the same section shows as panel or sheet |
| CONTEXT_LOST | | preventDefault on the event; gl = 'fallback' (fallback page shown, canvas hidden); as implemented (review pass): the sequencer stops (its pending hits are cancelled) and RUN is refused while the fallback shows (`clock.lock`), since the fallback has no RUN/STOP and no Space |
| CONTEXT_RESTORED | | scene rebuilt; gl = 'webgl'; RUN allowed again |
| ERROR (scene create or frame throws) | | gl = 'fallback'; in DEV the message goes to the devlog strip; as implemented (review pass): a frame or React render error is final, the Stage is disposed (GL context, geometries, textures, observers, subscriptions) and the sequencer is stopped and locked like CONTEXT_LOST |

### 7.3 Reduced motion variants (motion === 'reduced')

No intro; no parallax; knob turn, rise and LED: instant; trace: drawn without the dash animation and without the dot; panel and sheet: appear without transition (opacity 0 to 1 over 120 ms is allowed, no translate); explode: the two end states only (the timeline is skipped, framing is a cut); section framing: cut; pad press: sound and the 120 ms flash, no movement; LEDs and the playhead still animate because they are the sequencer; the render loop runs only while running or while a flash is alive.

As implemented (stage 6): all of the above. `motion.reduced()` (state/motion.ts) is `?motion=reduce` OR `prefers-reduced-motion: reduce` observed live; turning it on while the intro runs finishes the intro and turns the parallax off. Measured with ?motion=reduce: `data-v4-intro="0"` at mount (`__v4.state.intro` 'done', machineRoot at y 0), no parallax (0 frames after a pointermove, yaw and pitch 0), OPEN goes from closed to open in 1 frame (plateauGroup y 5.1), 0 frames at rest, RUN renders 21 frames in 2 s for 14 steps at 100 BPM (1.5 per step: the LED changes plus the ends of the pad flashes).

### 7.4 Intro (motion === 'full', gl webgl)

700 ms from the first frame: machineRoot y from -0.6 to 0 (easeOutCubic), the 16 step LEDs chase left to right then right to left in yellowHi over 400 ms, the LCD shows "MM-808" then the READY line at 500 ms. Any gesture finishes all tweens at once. `data-v4-intro` goes "1" to "0".

As implemented (stage 6, scene/renderer.ts `stepIntro` and `finishIntro`, state/intro.ts, theme.ts `INTRO`): full motion only. The Stage lowers machineRoot to y -0.6 at creation; the intro animator starts at the first rendered frame and brings it back to 0 over 700 ms (easeOutCubic) while one step LED at a time lights yellowHi from step 1 to 16 and back (400 ms, starting at 100 ms; `Sequencer3D.setIntroLed`, a channel of its own so it never fights the playhead). The LCD is not animated (it reads MM-808 / READY from the start). The first pointerdown or keydown anywhere (the window capture listener of index.tsx) calls `stage.finishIntro()` before the gesture reaches its target, so a click during the intro lands on the final geometry. The store state/intro.ts ('pending' or 'done') drives `data-v4-intro` ("1" during the intro) and `__v4.state.intro`. Measured: "1" for about 600 ms, then "0"; 35 to 38 frames from mount to rest, then 0 frames over 2 s; the intro plays again on every mount (checked over three /v4 -> / -> /v4 cycles).

### 7.5 LED colour rules (step LEDs)

Per step, in priority: playhead on this step while running -> yellowHi; hovered (fine pointer) -> ledHover; programmed -> ledSet; else line. "Programmed" means: the selected instrument has a hit on the step when an instrument is selected; otherwise (no instrument selected, for example right after load) the union of the four instruments, so the default pattern is visible on arrival. The playhead LED lights on the frame where `clock.currentStep(ctx.currentTime)` changes.

---

## 8. Audio (src/v4/audio/drums.ts)

### 8.1 Graph

```
voices -> drumBus (Gain 1.0)
       -> toneFilter (BiquadFilter lowpass, Q 0.8, frequency = 300 * 60 ^ tone, i.e. 300 Hz at 0 to 18 kHz at 1)
       -> levelGain (Gain, value = level * level, default 0.64)
       -> compressor (DynamicsCompressor threshold -14 dB, knee 10, ratio 3, attack 0.004, release 0.15)
       -> analyser (AnalyserNode fftSize 1024, smoothingTimeConstant 0)
       -> master (Gain 1.0; 0 for the whole session when ?mute=1, and setLevel never touches it)
       -> ctx.destination
```

The analyser sits before master so the signal is measurable while nothing reaches the speakers. `window.__v4.audio` exposes ctx (undefined until the first gesture), analyser, master, muted, tone, level, and for the tests created (contexts made since load), triggers, last ({ inst, open, when, at, state }), peak(), setTone(), setLevel().

As implemented (stage 4): TONE and LEVEL reach their value with a 20 ms LINEAR ramp from the current value (`cancelScheduledValues(now)`, `setValueAtTime(param.value, now)`, `linearRampToValueAtTime(target, now + 0.02)`), not with `setTargetAtTime`. Chrome computes a setTarget approach step by step over the render quanta a node actually processes, and the filter and the level gain process nothing while the bus is silent between two hits: the first hit after a change played with the OLD value (measured at the analyser under ?mute=1: CH peak 0.58 right after TONE 0, 0.001 on the next hit). With the ramp, the first hit after TONE 0 reads 0.001 and after TONE 1 reads 0.62; LEVEL 0.3 gives an SD peak of 0.09 to 0.10 against 0.65 to 0.79 at 1.0; master stays 0 (section 19 item 51). `__v4.audio` adds `toneHz` and `levelGain` (the values of the last rendered quantum, stale while the bus is silent). drums.ts exports `mix` ({ tone, level, subscribe }) for the knob angles.

### 8.2 Voices (all times relative to `when`, a ctx time; every ramp is AudioParam automation; sources are stopped at when + tail + 0.05 and nodes are garbage collected)

| Inst | Recipe |
|---|---|
| BD | OscillatorNode sine, frequency 150 at when, exponentialRampToValueAtTime(48, when + 0.06); gain 0 at when, linearRamp to 1 at when + 0.002, exponentialRamp to 0.001 at when + 0.42; then Gain 1.4 -> WaveShaperNode (curve tanh(2.5 x) sampled at 1024 points, oversample '2x') -> Gain 0.8 -> drumBus |
| SD | noise: AudioBufferSourceNode over a 1 s white-noise AudioBuffer generated once (Float32 random in [-1, 1]), -> BiquadFilter bandpass 1800 Hz Q 1.2 -> gain 1 at when, exponentialRamp to 0.001 at when + 0.18; body: OscillatorNode triangle 180 Hz (exponentialRamp to 140 Hz at when + 0.06) -> gain 0.6 to 0.001 at when + 0.12; both -> Gain 0.9 -> drumBus |
| TOM | OscillatorNode sine 220 Hz, exponentialRamp to 110 Hz at when + 0.12; gain 1 to 0.001 at when + 0.30 -> drumBus |
| CH | noise -> BiquadFilter highpass 7000 Hz Q 0.7 -> gain 0.7 at when, exponentialRamp to 0.001 at when + 0.045 (closed) or when + 0.22 (open: pad held longer than 300 ms; sequencer hits are always closed) -> drumBus |

Peak of a BD hit at the analyser: about 0.6 to 0.9 with level 0.8. Acceptance: `getFloatTimeDomainData` peak > 0.01 within 50 ms of a pad hit under ?mute=1. Measured at stage 2 (real clicks, ?mute=1, master gain 0): peaks BD 0.41 to 0.60, SD 0.63 to 0.66, TOM 0.69, CH closed 0.57 to 0.66, CH open 0.71; first sample above 0.01 7 to 14 ms after the pointerdown on a running context, 46 to 52 ms on the very first gesture of a page (audio device start, section 19 item 28).

### 8.3 Lifecycle

- `ensure()` creates `new AudioContext({ latencyHint: 'interactive' })` and the graph on the first user gesture only (pointerdown or keydown handlers), never at mount, never from a timer. The module keeps one context for the page; unmount suspends it, remount reuses it.
- `resume()` is called at the start of every interaction handler (pads, steps, RUN, knobs, keys, sheet gestures) when `ctx.state === 'suspended'` (iOS rule). The returned promise is ignored except for logging in DEV.
- `suspend()` on VIS_HIDDEN; `resume()` on VIS_VISIBLE (may be refused without a gesture; the next interaction resumes).
- As implemented (review pass): `ctx.state` only changes once the rendering thread has handled a request, so a hide then show faster than that left the context suspended while the clock showed RUN (and the reverse ran it while hidden). drums.ts keeps the wanted state (`want`): `resume()` sets it to running and calls `ctx.resume()` whenever the context is not closed (it resolves at once when already running); `suspend()` sets it to suspended and, when its promise resolves, resumes again if a resume came in the meantime. The last request wins in any order: suspend + resume ends running, suspend + resume + suspend ends suspended, resume + suspend + resume ends running (checked on the live context).
- `?mute=1`: `master.gain.value = 0` at creation and the LEVEL knob drives levelGain only.

### 8.4 SoundCloud coupling (src/v4/engine.ts)

`EngineProvider` and `useEngine` are the v2 `AudioPlayerProvider` and `useAudioPlayer` (src/v2/context/AudioPlayerContext.tsx, read-only import), exactly as /v3 does in src/v3/engine/useEngine.ts; in DEV with ?v4mock=1 they are `MockEngineProvider` and `useMockEngine` from src/v3/engine/MockEngine.tsx (same EngineCtx shape, 1500 ms fake latency, 300 s fake duration, ?v4mock=fail makes the second play fail so the SKIPPED path can be reviewed). The choice is made once at module load.

The engine owns the SoundCloud widget through src/utils/scWidget.ts (read-only): the playGen counter cancels a play() that is still loading when pause() or another play() happens, the FINISH/PAUSE pairing is handled by the widget module, errors produce `notice` (the skipped title for 4 s) and the queue advances past dead links. /v4 uses only `play(track, queue)`, `toggle()`, `next()`, `prev()`, `close()`, `current`, `playing`, `progress`, `duration`, `notice`. No iframe exists before the first `play()`: the provider only mounts an `<audio>` element and the widget's hidden iframe is created inside `scPlay` on the first row click. Acceptance: `document.querySelector('iframe[title="Radar SoundCloud engine"]') === null` until a row is clicked (which the builders never do; they verify by code reading and by `Object.keys(row).find(k => k.startsWith('__reactProps'))` showing an onClick function on a row).

Rules: a track starting (playing false -> true) stops the sequencer; the LCD shows the title and the timecode from `progress * duration`; a track pausing or finishing never restarts the sequencer; RUN pauses a playing track (section 1, decision 5); leaving /v4 pauses the widget (provider unmount). scWidget.ts needs no change.

As implemented (stage 4): engine.ts as above (ENGINE_IS_MOCK from ?v4mock in DEV only), plus `EngineBridge`, the ONLY consumer of the engine context: it renders nothing, re-renders on every widget progress event and copies { current, playing, progress, duration, notice } into the bridge `audio/soundcloud.ts` in one effect, and attaches { play, toggle }. The bridge mirrors src/v3/state/bridge.ts: a plain store (`sc.get()` = { status idle / loading / playing / paused, id, title, duration, notice }, `sc.subscribe()`, `sc.position()` in seconds kept outside the store) that the LCD composer, the rows and the root attributes read, so V4App never re-renders per progress tick. Rules implemented there: `sc.play(track, queue)` (ROW_PLAY: same track toggles, another plays with the queue of its list), `sc.pauseForRun()` (called by actions.runToggle before starting the clock), auto STOP on playing false -> true, LOADING from the request (or from any new current track: queue advance, dead link skipped) until playing with progress > 0, 8 s at most, then "NO SIGNAL" 4 s; each request carries a number (playGen, as in the widget) so an older timeout never fires for a newer request. The widget calls themselves (scPlay on the first row click, setScHandlers for play / pause / progress / finish / error, the widget's own playGen) stay in the reused v2 provider and src/utils/scWidget.ts, unchanged. Review without sound: `__v4.sc.simulate({ title, playing, progress, duration, notice })` pushes a FAKE engine state into the bridge and replaces the engine handle by a fake that only flips that state (no v2 engine, no widget, no iframe); `simulate(null)` restores. Verified that way on 390 x 844 (mute=1): RUN on, simulated start: `running` false, autoStops 1, LCD "LIMBOS 0:30" then "1:00"; RUN while playing: status paused (fake toggle), running; STOP: "LIMBOS PAUSED"; notice: "SKIPPED DEAD LINK T."; a start with no progress: LOADING, NO SIGNAL at 8 s. No iframe at any point; the 40 row buttons (35 tracks, 5 mixtapes) carry an onClick function in their React props; no row was ever clicked.

---

## 9. Clock (src/v4/audio/clock.ts)

- Constants: TICK_MS = 25, LOOKAHEAD_S = 0.1, STEPS = 16. stepDur = 60 / bpm / 4 seconds (0.11538 s at 130 BPM).
- `start()`: requires the context (ensure() already ran); `anchor = ctx.currentTime + 0.05`, `n = 0`, `nextTime = anchor`, `step = 0`, then `setInterval(tick, TICK_MS)`.
- `tick()`: `while (nextTime < ctx.currentTime + LOOKAHEAD_S) { scheduleStep(step, nextTime); nextTime += stepDur; step = (step + 1) % 16; n += 1 }`. Never a lone setTimeout. The interval is the only timer; if the tab was throttled and `nextTime` fell behind `currentTime`, the loop catches up by scheduling the missed steps at their (past) times, which the graph plays immediately; `late` is recorded.
- `scheduleStep(step, when)`: for each instrument whose pattern has '1' at `step`, `drums.trigger(inst, when)`; push `{ step, when, expected: anchor + n * stepDur, at: ctx.currentTime }` into a 64-entry ring (`scheduled`); push `{ step, when }` into the playhead queue read by the render loop.
- `setBpm(bpm)`: stores the new stepDur; it applies to the next `nextTime += stepDur` (step boundary), then the grid re-anchors: `anchor = nextTime`, `n = 0`, so `expected` stays meaningful.
- `stop()`: clearInterval; playhead queue cleared; pending hits are cancelled (the voices scheduled up to 100 ms ahead that have not started yet; those starting within the current render quantum, under 3 ms, play out rather than click).
- `currentStep(nowCtx)`: the step of the last playhead entry with `when <= nowCtx`, or -1 when stopped.
- Debug: `window.__v4.clock.scheduled` (the ring as an array, oldest first) and `drift()` = `{ maxMs, meanMs, lateMs, lateCount }` where maxMs and meanMs are over `abs(when - expected) * 1000` (must read < 1 ms while the tempo is constant) and lateMs is the largest `(at - when) * 1000` above zero with lateCount the number of entries where `at > when` (must be 0 in a foreground tab).
- Under VIS_HIDDEN the context is suspended: currentTime freezes, the while loop schedules nothing, and on resume the grid continues from `nextTime` without a jump. This is why the clock does not stop on hide.
- As implemented (stage 3): module `clock` with `start()` (false without a context), `stop()`, `toggle()`, `clear()` (the CLEAR transport: `pattern.clear()`, running unchanged), `entryAt(t)` and `currentStep(t)` (latest step of the current run whose `when <= t`), `subscribe(fn)` (RUN/STOP), `onStep(fn)` (every scheduled step at scheduling time; the Stage uses it to wake its loop), `drift()`, `resetStats()`. The tempo follows the pattern store (`pattern.subscribe`), applied at the next step boundary with the re-anchoring above. A step more than 50 ms late (frozen or starved tab) is DROPPED and counted instead of being played in a burst; the grid continues (section 19 item 35). Each ring entry is `{ seq, step, when, expected, at, mask }` (mask: bit k = INSTRUMENTS[k] played). `drift()` = `{ maxMs, meanMs, lateMs, lateCount, count, dropped, minLeadMs, maxTickGapMs, ticks }`, accumulated over every step since the last RUN or `resetStats()`, not only over the 64 entries of the ring. The render loop reads `entryAt(ctx.currentTime)`: the LED, the pad flashes of that step and the Dock change when the step SOUNDS, not when it is scheduled up to 100 ms earlier.
- As implemented (review pass): STOP cancels. Before, the voices already handed to drums.trigger() kept playing after STOP, so STOP then RUN inside the 100 ms lookahead flammed (the old step 0 BD at t + 50 ms over the new run's BD at t + 70 ms) and a SoundCloud track starting (sc.sync calls clock.stop) got up to 100 ms of drums over its first notes. Now `trigger(inst, when, open, out)` pushes a `Voice` ({ when, srcs, nodes }) into the clock's `pending` list (pruned in tick() once started); `stop()` calls `cancelVoice()` on every voice whose `when` is after the current render quantum: `stop(0)` on its sources (a stop before the start time means the source never plays) and a direct `disconnect()` of all its nodes (no reliance on onended). Measured under ?mute=1: RUN, STOP 21 ms later cancelled the pending BD (step 0 at +50 ms), and the analyser stayed at 0.000 for the next 160 ms; a RUN right after gave its BD 64 ms later (peak 0.60). `clock.lock(on)` (index.tsx, while the fallback page shows) stops and refuses RUN. Debug: `__v4.clock.pending`, `.cancelled`, `.locked`.

---

## 10. Persistence (src/v4/audio/pattern.ts)

Key `mm.v4.pattern`, value:

```
{"v":1,"bpm":130,"steps":{"BD":"1000100010001000","SD":"0000100000001000","TOM":"0000000000000010","CH":"0010001000100010"}}
```

That is the default pattern (steps 1-based in the brief: BD 1 5 9 13, CH 3 7 11 15, SD 5 13, TOM 15; index 0 is step 1). Types: `type Inst = 'BD' | 'SD' | 'TOM' | 'CH'`, `INSTRUMENTS: Inst[]` in that order, `interface Pattern { bpm: number; steps: Record<Inst, string> }`.

- `load()`: `try { JSON.parse(localStorage.getItem(KEY)) } catch { return DEFAULT }`; validation field by field: `v === 1`; `bpm` an integer within 100..150 else 130; each `steps[inst]` a string matching `/^[01]{16}$/` else that instrument's default. Anything else in the object is ignored. Never throws.
- `save(p)`: `try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}`; called by the store, debounced 300 ms after the last change, and immediately on `pagehide`.
- TONE and LEVEL are not persisted (a session that starts silent would be a trap).
- `toggle(p, inst, i)`, `clear(p)` return new objects (immutable updates for the store).

---

## 11. Sections, panels, mobile, fallback

### 11.1 Content and copy (English; the HTML for all six sections exists in the DOM at load, inactive ones carry the `hidden` attribute)

Section titles in Robot Radicals 26 px uppercase bone: TRACKS, MIXTAPES, PRESS, SHOWS, CONTACT, STUDIO. Body SF Pro Display 400 15 px / 1.45 bone; meta lines bone at 60 %; rows at least 44 px tall; no 1 px card borders, no coloured left rules, no gradients on text, zero emoji.

- TRACKS: data.ts `TRACKS` = BEADS of kind 'track' from src/v3/data/beads.ts in reverse order (newest first, 37 rows). Row = `<button>` for playable items (35): title, then meta "Original, 2026, Single / EP" (categoryLabel, year, project, comma separated); unplayable items (2): a `<li>` with title, meta "not on SoundCloud" and an anchor "Bandcamp" to track.link (target _blank rel noopener). The current item shows a 6 px yellow dot before the title and the title in yellowHi; aria-current="true"; aria-label "Play {title}" / "Pause {title}". Click = ROW_PLAY with queue = the playable tracks in display order.
- MIXTAPES: `MIXTAPES` = BEADS of kind 'mixtape', newest first (5 rows): title, meta "Mixtape 39, 2026, 1:29:33" (number, year, mixtape.duration). Same row mechanics; queue = the five mixtapes.
- PRESS: sentence "Press kit, tech rider, hi-res photos and artwork." then three links: "Press kit (PDF)" -> /Presskit_Maudite_Machine_2026-27.pdf, "Tech rider (PDF)" -> /Tech_Rider_Maudite_Machine_2026-27.pdf, "Press assets" -> /press/ (all target _blank rel noopener).
- SHOWS: `fetchShows()` reads /events.json (`fetch('/events.json', { cache: 'no-cache' })`, once per page, cached) and keeps the entries whose `date >= today` (both as 'YYYY-MM-DD', today from the local clock), sorted ascending. Row: date formatted "16 Oct 2026", title, location (displayed as data), the whole row an anchor to `url` (target _blank rel noopener). Empty or failed: "No upcoming dates." and the link "All shows" -> /shows.
- CONTACT: two rows from `BOOKING_CONTACTS` (src/v2/data/contacts.ts): label.en, then name when present, then a mailto anchor showing the email ("International booking, Diane, vrstlrecords@gmail.com"; "Canada / USA booking, mauditemachine@gmail.com"). Then the socials grid: `SOCIALS` (15 links) as 44 x 44 px anchors in a compact grid (8 per row on desktop, 5 on mobile), icon 20 px: inline SVG path from `SOCIAL_ICONS` (src/v2/data/socialIcons.ts, viewBox vb, fill currentColor) or, for Hypeddit, Songkick, Gigmit and Beatport, a 20 px disc with the initial letter in SF Pro Display 700; colour bone, yellow on hover and focus-visible; aria-label = label; target _blank rel noopener.
- STUDIO (opened by the STUDIO chip): line "Live setup", list: Ableton Live, Push 3, Dreadbox Typhon, Minilogue XD, APC40, SSL 2+; link "Tech rider" -> /techrider.
- Panel chrome: title, an "x" close button (44 px, aria-label "Close"), and on mobile the tab strip (section 11.3).
- LCD strings: MM-808, READY, RUN, LOADING, PAUSED, SKIPPED, CLEARED, NO SIGNAL, TAP A PAD FIRST, STEP nn XX ON/OFF, BPM.
- Fallback page strings: h1 MAUDITE MACHINE, subtitle MM-808, then the six section titles above.

As implemented (stage 4, ui/Panel.tsx and ui/sections/*.tsx): the six sections are always rendered, in the panel (WebGL page) or expanded in the fallback page (never both). An inactive section is VISUALLY hidden (clip, 1 px, `.v4-sec[data-active='0']`), not `hidden`: its text stays in the accessibility tree for screen readers and search engines, and its links and buttons take tabIndex -1 so the Tab order never lands on something invisible (section 19 item 47). Each section is `<section aria-labelledby>` with its h2 (Robot Radicals 26 px, 22 px on mobile). TRACKS and MIXTAPES rows are `<button>` with aria-label "Play {title}" (or "Pause {title}" when current and playing or loading), `aria-describedby` pointing at the meta line, `aria-current` and `data-state` (the sc status) on the current one, whose dot blinks while LOADING (full motion only). The meta line does not repeat a word: remixes read "Remix, 2023" instead of "Remix, 2023, Remix" (section 19 item 48). SHOWS reads /events.json at mount (not at first open) so the dates are in the DOM from the load; at 2026-09-28 one date is upcoming: "16 Oct 2026, Soiree Versatile" with its location (data, accents kept); an event without an http(s) URL renders without a link. CONTACT: "International booking" then "Diane, vrstlrecords@gmail.com" (mailto), "Canada / USA booking" then "mauditemachine@gmail.com"; 15 social anchors (11 SVG, 4 initials H S G B), 8 columns on desktop, 5 on mobile (3 even rows). PRESS, SHOWS and CONTACT external links carry a small north-east arrow (SVG). STUDIO is built now (Live setup, the six items, "Tech rider" -> /techrider) and waits for its chip. The fallback page (fallback/NoWebGL.tsx) renders the six sections expanded under the title; the static SVG machine is still to come.

As implemented (review pass): (a) TRACKS and MIXTAPES rows are no longer one `<button>` each: a mouse drag or a triple click starts no text selection inside a button, and the brief wants the panel "selectionnable, copiable". A row is now `<li class="v4-row v4-row-play">` holding an empty `<button class="v4-row-btn">` stretched under the whole row (position absolute, inset 0; aria-label "Play {title}" or "Pause {title}", aria-describedby the meta line, aria-current, the 2 px focus ring around the row) and the title and meta as plain spans above it (z-index 1, `user-select: text`). The `<li>` holds the click handler (`rowClick` in ui/sections/common.tsx): a click anywhere on the row plays, pauses or resumes, except a click that ends a text selection inside the row (drag) and the second click of a double click; keyboard and screen-reader activations of the button bubble to it with detail 0 and always play. The current row carries `data-current` and `data-state` for the yellow dot and the LOADING blink. Checked without playing anything (owner rule): programmatic selection of a title works, `elementFromPoint` on the title returns the span and on the row padding the button, the `<li>` React props hold the onClick, and with `__v4.sc.simulate()` (a fake engine, no widget, no iframe) the handler requested a play for a single click and a keyboard click (detail 0), and nothing for a click ending a selection in the row or for the second click of a double click; 0 iframes. (b) SHOWS is never empty: while /events.json is pending the "All shows" link to /shows is already rendered, and `fetchShows()` aborts after 5 s (AbortController) and resolves to [] ("No upcoming dates." plus the link). Checked with a fetch that never answers: the link during the wait, the empty text and the link after 5.2 s.

### 11.2 Desktop panel and trace (layout 'desktop': min-width 768 px)

- `.v4-panel`: position absolute, right 32 px, top 50 % translated -50 %, width min(460 px, calc(100vw - 340 px)), max-height 70 vh, overflow-y auto, overscroll-behavior contain, background rgba(20, 20, 23, 0.92), backdrop-filter blur(12 px), border-radius 16 px, padding 24 px, colour bone, z-index 30. Selectable, copyable, keyboard reachable (the close button first, then the rows). Opening: opacity 0 to 1 and translateX(16 px) to 0 over 220 ms after the trace starts (the panel is visible by the time the dot arrives); closing: 150 ms fade.
- For 768 <= W < 1100: width min(420 px, W - 280 px), right 16 px.
- Camera reframing: section 3.3.
- Trace (ui/Trace.tsx): one `<svg>` covering the stage, pointer-events none, z-index 25 (under the panel, over the canvas). Path from the active knob's projected centre K: P1 = (min(machineRightEdge + 28, panelLeft - 40), K.y) where machineRightEdge is the projected x of the plateau corner (7, -4.5); P2 = (P1.x, anchorY) with anchorY = panel top + 36 px (the title row); P3 = (panelLeft, anchorY). If abs(K.y - anchorY) < 12 px the vertical leg is dropped (one bend). Stroke yellow 1.5 px, stroke-linejoin round, stroke-linecap round; a 6 px yellowHi disc travels the path once (a second path with the same geometry, stroke-width 6, stroke-dasharray "6 L" and stroke-dashoffset animated from 6 to -L over 350 ms starting at 400 ms, then hidden). Draw-in: stroke-dasharray L, stroke-dashoffset L to 0 over 400 ms linear (L = path length from getTotalLength). Re-routed on resize and on parallax settle. Under reduced motion: no dash animation, no dot. Closing: the path fades 150 ms.

As implemented (stage 4): the panel is vertically centred with `top: 50%` and `translate(x, -50%)`, closed = opacity 0, no pointer events, no backdrop filter, translateX 16 px (its text stays in the DOM); open = the 220 ms transition with an 80 ms delay (so it has landed before the line reaches it at 400 ms); the header holds only the 44 px close button (top right) on desktop and the body scrolls inside (max 70 vh). The trace uses `pathLength = 1` on both paths: draw-in is stroke-dasharray "1 1" with the offset from 1 to 0, the dot is a 0.001 dash with round caps and a 6 px stroke (and a small drop-shadow glow) moved by offset 0 to -1, so the geometry can change while it draws. It is animated by its own rAF loop (400 ms draw, dot from 400 to 750 ms) and RE-ROUTED on every frame the Stage renders (`stage.onView`, which covers the 400 ms section reframing, parallax and resize) and on every resize of the panel (ResizeObserver). Route: K = the knob's projected top centre (`__v4.hotspots`), machineRightEdge = `stage.projectPlateau(7, 0, -4.5).x`, panelLeft = the panel's untransformed offsetLeft, anchorY = its top + 36 px; P1.x is kept at least 12 px right of K; a 2.5 px yellow pad marks the start. Under reduced motion the trace appears at once, fully drawn, without the dot: the brief's reduced-motion rule turns animations into their end state (the exploded view appears at once), and a static line is not motion (section 19 item 49). Measured at 1440 x 900 (setTimeout rAF of the test pane): offset 0.82 at 60 ms, 0 at 442 ms after the tap (the knob released at about 40 ms), dot running from 484 to 783 ms, knob at -30 deg at 263 ms, framing t 1 at 442 ms; 22 frames for the opening, then 0.

As implemented (review pass): the trace no longer reads the picking list nor the layout on every frame. The knob point is projected directly (`stage.projectPlateau(knob.x, 0.54, 0.3, out)`, the same top-centre point as the hotspot, into reused objects: no allocation), and the panel box (offsetLeft, offsetWidth, getBoundingClientRect().top + 36) is read when the trace starts, in the panel's ResizeObserver callback and on window resize, never after the twins' style writes of a frame (which forced a synchronous layout on every moving frame). The path string is rebuilt and written only when one of its numbers changed. Measured on a TRACKS opening at 1440 x 900: 21 frames of framing, 64 reroutes, 2 reads of the panel box, 1 reprojection of the hotspots (at rest), path "M581.9 379.2H908V171H948", offset 0 and the dot done.

### 11.3 Mobile sheet (layout 'mobile': max-width 767 px)

- The canvas host is the top 55 % (`height: 55dvh`); the bottom 45 % is ink and holds the Dock when no section is open.
- `.v4-sheet`: position fixed, left 0, right 0, bottom 0, height 45 dvh, background rgba(20, 20, 23, 0.96) (blur optional on mobile, off by default for performance), border-radius 16 px 16 px 0 0, transform translateY(100 %) -> translateY(0) over 280 ms cubic-bezier(0.16, 1, 0.3, 1), z-index 30. Header: a 36 x 4 px handle (bone 40 %), the title, the close button, and a horizontally scrollable tab strip of the five section names (44 px tall buttons, aria-pressed for the current one) so switching sections does not require the 23 px knobs; body scrolls (`overflow-y: auto`, `overscroll-behavior: contain`). Closing: the x button, Escape, a downward drag of more than 80 px or a downward flick faster than 0.5 px/ms on the handle or header (pointer capture, translateY follows the finger, snaps back otherwise).
- The machine above stays live: pads, RUN, CLEAR, TEMPO, knobs and OPEN keep working while the sheet is open.
- No trace, no floating panel on mobile.

As implemented (stage 4): the same `.v4-panel` element becomes the sheet under 768 px (absolute at the bottom of the fixed root, 45 dvh = 380 px on the 390 x 844 phone, translateY(100 %) when closed, 280 ms cubic-bezier(0.16, 1, 0.3, 1), no blur, rgba(20, 20, 23, 0.96)). Header = the handle, then one row with the tab strip (five 44 px buttons, aria-pressed; the active tab is scrolled into view, smooth unless reduced motion, and the strip fades at the edge that has more tabs) and the close button; the section h2 stays in the scrolling body. Drag: pointer events on the header, a drag starts only after 6 px downward (so taps on a tab or on x stay taps), then pointer capture, translateY follows the finger; release beyond 80 px, or with the last move faster than 0.5 px/ms, closes (the sheet finishes its course from the finger), otherwise it snaps back. Focus: the close button takes it on open (spec 13); on close, focus returns to the element that had it before (if any) or leaves the sheet. The Dock is hidden (`visibility: hidden`) while a section is open. Verified on the 390 x 844 emulation (touch): knob tap opens with the tab pressed and the knob LED on, the sheet at top 464 px once open, a pad tap while open triggers the drum (mute=1), a 48 px slow drag snaps back, a 100 px drag closes, a 36 px flick at 1.2 px/ms closes, a tab switches the section and the knobs follow. No horizontal scroll (scrollWidth 390).

As implemented (review pass): the tab strip has no edge fade any more (it was a linear-gradient mask over the tab labels, a gradient on text against the brief's colour rule, section 19 item 100): the tab cut at the edge and the scroll to the active tab say that the strip scrolls. The strip is exactly as tall as its 44 px tabs and scrolls (overflow auto), which clipped the 2 px focus ring drawn outside a tab: `.v4-tab:focus-visible` now uses outline-offset -2 px (checked with Shift+Tab from the close button: CONTACT focused, ring 2px solid rgb(242, 194, 48) inside the tab).

### 11.4 Dock (mobile only, when no section is open)

`.v4-dock` under the canvas host: a row of the four instrument names (BD SD TOM CH, the selected one in yellow) then the 16 steps as two rows of 8 cells of 44 x 44 px (gap 4 px, 380 px wide on a 390 px screen), each a `<button aria-pressed>` showing its state for the selected instrument (or the union when none, dimmed) with the playhead cell in yellowHi while running; tapping a cell is STEP_TOGGLE. Hint line above it when no instrument is selected: "Tap a pad, then the steps." The Dock is hidden while the sheet is open and in the fallback page (which has its own controls). It reads the same store as the 3D LEDs.

As implemented (stage 3, ui/Dock.tsx): the instrument names are buttons (92 x 44 px, aria-pressed, aria-label "Select bass drum") that select WITHOUT playing (a pad plays); the step cells show their number, graphite when off, ledSet (#6E6C6A) when on, #464545 (bone 22 %) for the dimmed union, yellowHi for the playhead; with no instrument they carry aria-disabled="true" and aria-label "Step 7, no instrument selected", and a tap flashes the hint in yellow (600 ms) instead of toggling. The playhead comes from `state/playhead.ts`, written by the render loop on the frame the 3D LED changes (the Dock and the LED never disagree: 0 mismatches over 440 samples). The Dock is centred vertically in the bottom 45 % (`top: 55dvh`), `touch-action: manipulation`, z-index 20; the sheet stage must hide it while a section is open.

As implemented (review pass, ui/Dock.tsx, v4.css): (a) a transport row under the steps: RUN (aria-pressed = running, yellow when pressed, calls actions.runToggle: the same gesture, SoundCloud pause and clock as the 3D button), CLEAR, OPEN (aria-pressed = open or opening, actions.openToggle), then the tempo as "-" / value / "+" (1 BPM per tap, disabled at 100 and 150; the LCD live region announces the value); the 3D RUN, CLEAR, TEMPO and OPEN project to 13 to 18 px on the phone, CLEAR is 29 px from TEMPO and OPEN 22 px from the CONTACT knob, so taps near them could land on the neighbour. Measured at 390 x 844: RUN 74 x 48, CLEAR 61 x 48, OPEN 61 x 48, tempo buttons 48 x 48; a real tap on RUN started the sequencer (created the muted context), "+" twice gave 132 BPM on the LCD, "-" twice 130, OPEN opened the machine (16 calls), RUN and OPEN turned yellow; the red stays on the 3D RUN only. (b) Instrument buttons and step cells are 48 px tall (cells 44 x 48: eight 48 px columns plus gaps do not fit 380 px; `aspect-ratio` is gone because it carried the 48 px height over to the width). (c) Contrast (WCAG AA, 11 px text): an off cell is bone 60 % on graphite (6.45:1, was bone 45 %, 4.15:1), a programmed cell bone on ledSet #6E6C6A (4.64:1, was ink, 3.78:1), the two fills 3.52:1 apart; instruments and transport keys 6.45:1, pressed 10.05:1. (d) The Dock is mounted only on the mobile layout (index.tsx, `mobile && <Dock />`): on desktop it was hidden by CSS but still re-rendered on every step. Its content (hint, instruments, steps, transport) spans y 535 to 774 in the bottom 45 % (464 to 844).

### 11.5 Fallback page (fallback/NoWebGL.tsx)

Rendered when WebGL2 is unavailable, when the renderer fails, on context loss, with ?nowebgl=1, and by the error boundary. Same chrome, ink background. Content: h1 MAUDITE MACHINE (Robot Radicals), MM-808, then `StaticMachine` (an inline SVG, viewBox 0 0 800 480, drawn from the LAYOUT constants through the same projection formula: the socle and plateau rhombi with their bevel band in graphiteHi, the four pads, the 16 steps and LEDs, the three transport shapes, the eight knobs with yellow rings, the LCD rectangle, silk labels in bone 70 %; no animation), then the six sections expanded in order TRACKS, MIXTAPES, PRESS, SHOWS, CONTACT, STUDIO with the same components as the panel (`inline` prop), so the tracks stay playable through the engine. No sequencer in the fallback. No technical message, no black screen.

---

As implemented (stage 6, fallback/NoWebGL.tsx, fallback/StaticMachine.tsx): the page as above. `StaticMachine` is an inline SVG (viewBox 0 0 800 480, `role="img"` with a title and a one-line description) built once when the module loads. The camera basis is derived from theme.ts `CAMERA` as three builds it (R = normalize(up x Z), U = Z x R); the socle and the plateau are the convex silhouettes of their rounded outlines (theme.ts PLATE and SOCLE: sides, bevel band, top face); the flat plateau content (the two rules, the yellow OPEN frame, the 16 step LEDs showing the default pattern's union in ledSet, the knob LEDs, every silk text with the texture's fitting rule, OPEN) is drawn in plateau coordinates through one SVG `matrix()` per height; the solids (pads with their two visible faces, the 16 steps, RUN, CLEAR, OPEN, the eight knobs with their rings, bone marks at the default angles, metal caps) are sorted back to front by x + z; the LCD reads MM-808, 130 BPM, READY. CSS: width 100 % up to 720 px, `aspect-ratio: 5 / 3`, `flex: 0 0 auto` (without it the column flexbox shrank the SVG to 0 px high). Checked: ?nowebgl=1 gives `data-v4-gl="fallback"`, `data-v4-state="nogl"`, no canvas, no twin, the SVG at 720 x 432 px (1440 x 900) and 354 x 212 px (390 x 844, scrollWidth 390), the six sections expanded (35 track buttons, 2 Bandcamp rows, 5 mixtapes, 15 socials), no technical text. The same page comes up when WebGL is really missing (checked by making `getContext('webgl2')` return null before an SPA navigation to /v4: `Stage.create` returns null, gl 'fallback', the SVG and the six sections, no canvas, intro 'done'; only the DEV devlog strip, never shipped, names the error). The machine shortcuts (A S D F, Space, 1 to 5, O) are off on this page (no machine, no sound); Escape stays. A render error in any control of the WebGL page (hit layer, twins, LCD twin, Dock, trace, panel) now also lands here: each group sits in a `StageBoundary` (index.tsx) whose `onError('stage')` sets gl to 'fallback' (before, only the canvas host was wrapped and an error elsewhere would have unmounted the page).

## 12. OPEN: the exploded view (scene/explode.ts)

### 12.1 Layers and transforms

| Layer | Object | Closed | Open | Delay |
|---|---|---|---|---|
| 1 | plateauGroup (with everything on it) | position y 1.6, rotation 0 | position y 5.1 (+3.5), rotated +12 deg about a = normalize(1, 0, -1) applied with rotateOnWorldAxis semantics from identity (the near edge dips, the top face tilts toward the camera; the underside is never seen) | 0 ms |
| 2 | pcbGroup | visible false | visible true from t = 0 of "opening"; `parts.scale.y` 0.001 -> 1 | 80 ms |
| 3 | socleGroup (with the shadow plane and the mention) | y 0 | y -1.5 | 160 ms |

Duration 900 ms per layer, easeInOutQuart (x < 0.5 ? 8 x^4 : 1 - (-2 x + 2)^4 / 2). "opening" lasts 900 + 160 = 1060 ms, then "open". CLOSE runs the same tweens backwards with the reverse order of delays: socle 0 ms, PCB 80 ms, plateau 160 ms; pcbGroup.visible = false at the end of "closing". While the plateau's underside still encloses the components during the first 360 ms they are hidden by the opaque plate (depth test), so no special casing is needed. The music keeps running during the explode.

### 12.2 Interactions in the open state

The three big chips are hotspots (section 6.1) with their twins rendered only from "opening" to the end of "closing". The plateau hotspots move with their layer (re-projection each animated frame, throttled per section 6.2, exact on settle). The OPEN button reads CLOSE (silk redraw) and its twin says "Close the machine".

### 12.3 Framing

Section 3.4: hw tween and target y tween over the same 900 ms with 0 ms delay. Under reduced motion the whole thing is a cut: transforms set to their end values, one frame.

As implemented (stage 5, scene/explode.ts `Explode`, state/explode.ts `explode`): the tilt is -12 deg about normalize(1, 0, -1): the front edge rises like a lid instead of dipping (theme.ts `EXPLODE.tiltDeg`, section 19 item 64); with +12 the dipping front edge covered the board (47 % visible, the chips hidden), with -12 78 % is visible; the underside stays hidden either way (tilt plus parallax pitch 16 deg at most, camera elevation 30.5 deg; checked at the extreme parallax). The store holds closed / opening / open / closing; OPEN_TOGGLE (3D button, key O, twin, `__v4.openToggle()`) is accepted from closed or open only, and only while a Stage is attached (the fallback page ignores O); the Stage animates and then settles the store to open or closed. The timeline is one function of the time since OPEN (layer progress = easeInOutQuart((t - delay) / 900), delays 0 / 80 / 160 ms opening, the reverse closing), so it needs no tween list; the OPEN label and the twins switch at the start. Measured at 1440 x 900 (16 ms timer rAF of the test pane): opening 1060 ms on the frame clock, 56 frames, then 0 frames over 2 s at rest open; closing restores the camera frustum, the plateau's position and quaternion, the socle, the part scale (0.001), pcbGroup.visible false, the chip flags, the twins and the labels exactly (compared value by value); draw calls 16, 18, 16. The sequencer keeps running: 28 steps across a full open and close at 130 BPM on desktop, 26 on the phone, drift max 7e-11 ms and 1.2e-11 ms, lateCount 0, dropped 0, the playhead continuous. Reduced motion: one rendered frame for OPEN and one for CLOSE (opening to open in 44 ms on the 16 ms timer). Escape closes the open section first, then the exploded view, then deselects the instrument. Unmounting /v4 while open resets the store: the next mount starts closed.

As implemented (review pass): the framing progress is `max(plateau, socle)` instead of the undelayed curve, so on CLOSE it waits for the plateau (160 ms of delay) and the lifted plateau is never cut at the top of wide viewports (section 3.4 as implemented, section 19 item 108). The opening, the layer timings and the 1060 ms totals are unchanged.

---

## 13. Accessibility, keyboard, reduced motion, fallback

- Twins with aria-labels, roles and `tabIndex` for every hotspot (section 6.3); Tab order pads, steps, transport (run, clear, tempo), nav knobs, OPEN, tone, level, chips; Enter and Space activate buttons natively; sliders take arrows, Page keys, Home and End; visible 2 px yellow focus ring on twins and on every HTML control (panel rows, links, sheet tabs, Dock cells, close buttons).
- Global shortcuts (hooks/useKeys.ts, pattern of src/v3/hooks/useKeys.ts): A S D F pads, Space RUN/STOP, 1 to 5 sections, O OPEN/CLOSE, Escape close (section 7.2). Ignored with Alt, Ctrl or Meta, inside inputs, textareas, selects and contenteditable, and while a key repeats (pads). Space is left to the focused button or slider when one has focus.
- Live region: the LCD twin (role status) announces section changes, RUN/STOP and the playing title; rows carry aria-current.
- The panel traps nothing (it is not modal on desktop); the mobile sheet moves focus to its close button on open and returns it to the knob's twin on close.
- Reduced motion: section 7.3; `?motion=reduce` and `prefers-reduced-motion: reduce` (observed live) both set it.
- No WebGL: section 11.5; `?nowebgl=1` forces it in every build.
- The whole textual content of the six sections is in the DOM at load (section 11.1), also in the WebGL page (inactive sections `hidden`).
- No sound without a gesture: section 8.3.

As implemented (stage 6, hooks/useKeys.ts): A S D F call `padDown` (sound, selection, press animation; any case, no hold mode), Space calls `runToggle` unless the focus is on a control that owns Space (button, link, `role="slider"`, `role="button"`, input, textarea, select, contenteditable), 1 to 5 match `e.key` or the physical key (`Digit1`, `Numpad1`: on an AZERTY keyboard the digits need Shift otherwise), O toggles OPEN, Escape closes (the section, then the exploded view, then the instrument). Ignored with Alt, Ctrl or Meta, on a key repeat, inside editable fields, and when the event was already handled. Verified with real key presses on the 1440 x 900 page: the first Tab lands on pad-BD with the yellow ring, Enter fires it once, D selects TOM, Space runs then stops (drift lateCount 0), 2 opens MIXTAPES (aria-expanded true), Escape closes it, O opens the machine (18 calls), Tab from LEVEL reaches chip-label, Up x3, Shift+Up, End and Home take TEMPO to 133, 138, 150 and 100, Down x2 and Shift+Down take LEVEL to 0.76 then 0.66 with the master gain at 0 throughout; a real click on pad-CH while step-3 had the focus left the focus on the body and the next Space started the sequencer. The sheet keeps its focus rule (13 above): a knob tap on the phone opens it with the focus on its close button.

As implemented (review pass): Space is left only to buttons, links, `role="button"`, summary and editable fields; a focused slider twin (TEMPO, TONE, LEVEL), which has no use for Space, keeps it as RUN/STOP (checked: TEMPO focused, Space ran then stopped the sequencer). The LABEL and LIVE chip twins activate on Space as well as Enter (checked with the links' default action cancelled by a capturing listener: "label" then "live", no navigation).

---

## 14. Performance

### 14.1 Render loop (scene/renderer.ts)

```
requestRender(): dirty = true; if (rafId === 0) rafId = requestAnimationFrame(frame)
frame(now): rafId = 0; dt = min(50, now - last); last = now
  tweens.update(now); parallax.update(dt); explode.update(now)
  if (running) playhead.update(ctx.currentTime)      // LED change sets dirty
  lcd.tick(now)                                        // 4 Hz, sets dirty on change
  if (hit.dirty) hit.reproject()                       // twins and trace
  if (dirty) { renderer.render(scene, camera); stats.frames += 1; stats.lastRenderAt = now; stats.drawCalls = info.render.calls; stats.triangles = info.render.triangles; dirty = false }
  if (tweens.alive > 0 || parallax.moving || explode.animating || running || flashes.alive > 0) requestRender()
```

At rest (nothing running, no hover transition, no parallax error) zero frames are rendered: `window.__v4.stats.frames` stays constant over 2 s. The loop never allocates (module-level scratch Vector3, Matrix4, Color, Quaternion).

As implemented (stage 3): an animator returns `true` (it changed the scene: render, keep the loop), `'poll'` (nothing changed, read me again next frame: keep the loop, render nothing) or `false`. While RUN is on, the playhead animator reads `clock.entryAt(ctx.currentTime)` on every rAF and returns `true` only when the step changes; pad flashes end on a deadline read by `Pads.update()` (`'poll'` until then) instead of a per-frame tween, so a flash costs two frames. Measured at 130 BPM: 30 frames rendered for 135 rAFs over 2.3 s with the default pattern (desktop), and under reduced motion 1.23 frames per step (one per step plus one per flash end) and 2 frames per pad press (stage 2: 8). `stats.rafs` counts every rAF, rendered or not.

As implemented (review pass): nothing reprojects the picking list inside the render loop any more. `onView` listeners (an array, iterated by index: no Set iterator per frame) are the trace and the twin that has the keyboard focus; a new `onIdle(fn)` hook fires when the loop stops (and after a resize rendered outside the loop), where the twins are placed once. The hotspot reprojection (1.3 ms for 34 hotspots) now runs on pointer events (picking) and once per settled motion; the per-frame check is the signature (`hit.version()`, 0.009 ms, no allocation). `Explode.update` no longer creates a closure per frame (a private method), and `stage.projectPlateau()` takes an optional output object.

### 14.2 Visibility

IntersectionObserver on the canvas host (threshold 0) and `document.visibilitychange`: not visible -> loop paused (no rAF), `ctx.suspend()`; visible -> `ctx.resume()` attempt and one requestRender. The clock keeps its interval (section 9).

As implemented and verified (stage 6): `stage.onIntersect([{ isIntersecting: false }])` and a hidden `visibilityState` both pause the loop (0 frames while hidden, even after a requestRender and a section opening) and suspend the running AudioContext ('suspended'); coming back resumes it ('running') and renders one frame showing the final state (an animation started while hidden completes on that frame).

### 14.3 Budgets (all measured, all in the acceptance)

| Budget | Limit | Expected | How to measure |
|---|---|---|---|
| /v4 chunk | 220 KB gzip, three included | 170 to 190 KB (three core tree-shaken about 135 to 150, jsm helpers 11, v4 code 25 to 35) | `npm run build`, then `for f in dist/assets/*.js; do printf '%s %s\n' "$(gzip -c "$f" \| wc -c)" "$f"; done \| sort -n \| tail -5`; report the v4 chunk name and size |
| draw calls | 20 desktop, 16 mobile | 16/18 desktop, 14/16 mobile (closed/exploded), section 4.6 | `__v4.stats.drawCalls` |
| triangles | 60k desktop, 35k mobile | about 10.5k/14.5k desktop, 8k/11k mobile | `__v4.stats.triangles` |
| frame rate | 60 fps M1, 30 fps iPhone 12 | frame time under 4 ms on M1 desktop | `__v4.stats.frames` over 1 s while running |
| idle | 0 fps | 0 | frames constant over 2 s at rest |
| DPR | 1.5 max on mobile | | `renderer.getPixelRatio()` via `__v4.scene.renderer` |
| SoundCloud iframe | none before the first row click | | querySelector on the iframe title |
| memory after unmount | renderer.info.memory geometries 0, textures 0 | | `__v4LastDispose` written by dispose() in DEV |
| first paint | ink, no cream flash | | theme-color and body background set in a layout effect |

As measured (stage 6, final build, `npm run build`, vite gzip sizes, byte counts from `gzip -c`):

| Budget | Measured |
|---|---|
| /v4 chunk, three included | 199.3 kB gzip (198,132 bytes): lazy chunk index-DI0tu-U_.js 125.50 kB raw / 43.91 kB gzip, three chunk three.module-DFGaftil.js 568.37 / 145.34 (shared with /v3, it also holds the v3 beads and the MockEngine), CSS index-UIzZYoWZ.css 14.26 / 3.45, shared data chunks AudioPlayerContext 1.30, contacts 3.50, mixtapes 1.82. No RectAreaLightUniformsLib chunk any more (it was 101.3 kB, total 298.4 at stage 5). The app shell index-CF0XZmVw.js (133.0 kB gzip: React, the router, the main site) loads for every route and is not counted, as in stages 1 to 5. |
| draw calls | desktop 16 / 18, mobile 14 / 16 (closed / exploded) |
| triangles | desktop 13,244 / 15,140, mobile 9,960 / 11,648 |
| frame time | 1.1 to 1.3 ms median at 2880 x 1800 device pixels (section 4.6) |
| idle | 0 frames over 2 s after the intro, closed and open |
| DPR | 2 desktop, 1.5 on the 390 x 844 emulation |
| SoundCloud iframe | none (`iframe[title="Radar SoundCloud engine"]` null, 0 iframes), rows carry an onClick |
| memory after unmount | 0 geometries, 0 textures (`__v4LastDispose`, three unmounts) |
| first paint | ink: title, theme-color #0A0A0B and body.v4-active in the layout effect, restored on unmount |

As measured (review pass, final build, `npm run build` exit 0):

| Budget | Measured |
|---|---|
| /v4 chunk, three included | 199.7 kB gzip (199,716 bytes by gzip -c): lazy chunk index-Cc7C42gr.js 130.66 kB raw / 45.47 kB gzip (45,198 B; stage 6: 125.50 / 43.91), three chunk three.module-DPGTgCfl.js 568.37 / 145.34 (144,256 B), CSS index-DOMDHFZ9.css 14.88 / 3.53 (3,555 B), AudioPlayerContext 1.30 (1,329 B), contacts 3.50 (3,534 B), mixtapes 1.82 (1,844 B). Under the 220 KB cap; no RectAreaLight code anywhere. |
| draw calls | desktop 16 / 18, mobile 14 / 16 (closed / exploded): the contact shadow lives in the existing shadow plane |
| triangles | desktop 13,244 / 15,140, mobile 9,960 / 11,648 |
| idle | 0 frames and 0 rAFs over 2 s after the intro |
| per-frame work | no hotspot reprojection while the view moves (twins placed at rest, one reprojection per motion), no layout read in the trace's frame path |

### 14.4 Dispose (idempotent, StrictMode double-mount safe)

Cancel rAF, clear the clock interval if running (and set running false), disconnect ResizeObserver and IntersectionObserver, remove pointer, key, visibility and matchMedia listeners, dispose every geometry, material and texture (silk, lcd, pcb, mention), `renderer.dispose()`, `renderer.forceContextLoss()`, remove the canvas, restore body class, title and theme-color (the robots meta is no longer touched since the review pass, section 19 item 106), suspend the AudioContext (kept for a remount). In DEV, write `window.__v4LastDispose = { geometries, textures }` from `renderer.info.memory` before the context loss.

As implemented and verified (stage 6): three SPA cycles / -> /v4 -> / (history.pushState plus popstate, the real router) with `EventTarget.prototype.addEventListener` / `removeEventListener`, `ResizeObserver`, `IntersectionObserver` and `setInterval` instrumented from the home page on. Every /v4 mount shows the same live set (window pointerdown 1, keydown 2, pointerup 1, touchend 1, the Stage's visibilitychange, 3 MediaQueryList listeners, the hit layer and stage input listeners, the canvas context listeners, 2 ResizeObservers, 1 IntersectionObserver, no interval at rest) and every return to / removes it; nothing grows from one mount to the next (the only growing counts are the v2 home's image load and error listeners and React's non-delegated scroll listener on the unmounted sheet tab strip, both left to the garbage collector with their elements). `window.__v4` is recreated with a new Stage on each mount and deleted on /; `__v4LastDispose` reads 0 and 0 each time; body class, title and theme-color return to the v2 values (v2-active, #f6f1e7); no v4 canvas stays behind; no console error after a marker (read at the DevTools protocol level, so index.html's filter hides nothing) and no devlog entry; /v3 still loads (Acid Line, its canvas).

---

## 15. Debug contract and verification rules

### 15.1 URL flags (parsed once in state/flags.ts, honoured in every build)

| Flag | Effect |
|---|---|
| ?debug=1 | `window.__v4` is installed (below); `data-v4-*` attributes exist regardless |
| ?mute=1 | master gain forced to 0 for the whole session; analyser still sees the signal; `data-v4-muted="1"` |
| ?motion=reduce | reduced-motion path |
| ?nowebgl=1 | the fallback page |
| ?v4mock=1, ?v4mock=fail | DEV only: the /v3 MockEngine replaces the SoundCloud engine |

### 15.2 window.__v4 (src/v4/debug.ts), fields added from stage 1 and kept by every later stage

```
window.__v4 = {
  version: 'v4',
  stats: { frames, drawCalls, triangles, lastRenderAt, loopActive, dpr },
  state: { section, running, bpm, exploded, pattern, instrument, sc, layout, motion, gl, intro },   // live getters on the store
  audio: { ctx, analyser, master, muted, tone, level },       // ctx undefined until the first gesture
  clock: { scheduled: [...last 64 { step, when, expected, at }], drift(): { maxMs, meanMs, lateMs, lateCount } },
  hotspots: [{ id, kind, shape, enabled, x, y, w, h, cx, cy }],   // current projected list, twins included
  scene: { renderer, scene, camera },                          // for inspection only
  requestRender(), reproject()                                 // for tests
}
```

`state.pattern` is the serialized object of section 10. `hotspots` is the array the twins are positioned from (same objects).

As implemented at stage 3: `__v4.clock` = { running, bpm, stepDur, scheduled (the 64 last `{ seq, step, when, expected, at, mask }`, oldest first), drift(), resetStats(), currentStep() }; `__v4.state.running`, `.playhead` (the lit step, -1 when stopped), `.lcdMessage` (transient LCD text still shown, or null); `__v4.seq` = { leds (16 tone names), run ('red' / 'yellow'), playhead, hover, programmed (16 chars), instrument }; `__v4.knobs` = { ids, angleDeg, rise, ring }; `__v4.pads.flashes` (flash count per pad); `__v4.stats.rafs`. Root attributes `data-v4-running` ("1" / "0") and `data-v4-state="running"`.

As implemented at stage 4: `__v4.state.section` (null or the open section), `.sc` ({ status, id, title, duration, notice, position }), `.lcd` (the two LCD lines as displayed); `__v4.sc` = the SoundCloud bridge's debug ({ state, mock, attached, pending, playGen, counters { requests, starts, autoStops, runPauses, noSignal }, simulate(p) }, section 8.4); `__v4.lcd` (the full LCD state: l1, r1, l2, r2, text, updates); `__v4.trace` ({ on, section, d, points, dashoffset, dot 'hidden' / 'running' / 'done', starts, routes }); `__v4.knobs` covers the eight knobs; `__v4.seq.knobLeds` (5 booleans); `__v4.measure().framing` ({ section: t, ox }); `__v4.audio.toneHz`, `.levelGain`; `__v4.openSection(s)` (as a tab would). Root attributes `data-v4-section` ('' or the section) and `data-v4-sc` (idle, loading, playing, paused). `stage.projectPlateau(x, y, z)` and `stage.onView(fn)` are public for the trace.

As implemented at stage 5: `__v4.state.exploded` ('closed', 'opening', 'open', 'closing') and the root attribute `data-v4-exploded`; `__v4.explode` = { state, toggles, plateau, pcb, socle, frame (progress 0 to 1), animating, open, plateauY, tiltDeg, socleY, partsScaleY, pcbVisible, runs, lastMs }; `__v4.openToggle()` (as the button, guard included); `__v4.screen` = { draws, text, lastDrawAt, minGapMs, font, size }; `__v4.pcb` = { size, traces, segments, pads, vias, parts, triangles, draws, webfont, rise }; `__v4.twins` = the mounted twins { id, tag, label, href, target, rel, pressed, tabIndex, x, y, w, h }; `__v4.silk.openLabel`; `__v4.measure()` adds `framing.explode`, `framing.oy` and `explode`. Chips in `__v4.hotspots` carry `chip`.

As implemented at stage 6: `__v4.state.intro` ('pending' during the intro, 'done' after it, at once under reduced motion or without WebGL) and the live root attribute `data-v4-intro`; `__v4.twins` lists every mounted twin in Tab order as { id (its hotspot id, from `data-hotspot`), tag, role, label, href, target, rel, pressed, expanded, valueNow, tabIndex, x, y, w, h } (window px); `__v4.hotspots` is unchanged (34 entries, target rect x, y, w, h, top centre cx, cy, raw box, silhouette).

As implemented at the review pass: `__v4.clock.pending` (voices scheduled and not started yet), `.cancelled` (voices cancelled by STOP since the page loaded) and `.locked` (RUN refused while the fallback shows); `__v4.stage.onIdle(fn)` and `__v4.stage.hit.version()` are public (twins); `__v4.state.lcd` and the rest unchanged. The TRACKS and MIXTAPES rows carry their onClick on the `<li class="v4-row-play">`, not on the button (verification by React props, section 11.1 as implemented).

### 15.3 Builder verification rules (from the owner, repeated because they are checked)

- Always open /v4 with `?debug=1&mute=1` before touching a pad, a step or RUN; verify sound through `__v4.audio.analyser` (peak > 0.01 within 50 ms of a pad hit) and `__v4.clock.drift()` (maxMs < 1, lateCount 0), never by ear.
- Never click a track or mixtape row; never call scPlay, scResume, engine.play or engine.toggle from the console. Verify the wiring by reading the code and by checking that a row's React props hold an onClick function.
- index.html installs a console filter that silently drops any message containing "Canvas", "getContext", "Uncaught", "TypeError: Cannot read", "ReferenceError", "Failed to execute" and more, and swallows window errors: never verify anything through console.log; read `window.__v4`, the `data-v4-*` attributes, aria attributes and the LCD twin's text. In DEV, errors caught by the boundary and the loop are printed with `console.table([{ where, message }])` (not filtered) and in the `.v4-devlog` strip (DEV only, never shipped).
- Mobile check at every stage: `resize_window` 390 x 844 (touch emulated), then `preset: "desktop"` when done.
- The dev server: `preview_start` with name "dev" only; never from Bash; leave it running.
- git: status, diff, log only.

---

## 16. Files, route, fonts, CSS chrome, repo traps

### 16.1 Route (src/App.tsx, the only file outside src/v4 and docs/v4 that changes)

```tsx
// Experiment v4 : la machine isometrique, hors sitemap (chunk lazy)
const V4App = React.lazy(() => import('./v4/index'));
...
<Route path="/v3" element={lazyEl(<V3App />)} />
<Route path="/v4" element={lazyEl(<V4App />)} />
```

The lazy line goes right after the V3App lazy line; the Route right after the /v3 Route. `src/v4/index.tsx` has `export default V4App`. /v4 is not added to scripts/generate-sitemap.mjs and not to any nav. The `copy-404` plugin makes deep links work on GitHub Pages.

### 16.2 File structure (src/v4/)

```
index.tsx              V4App (default export): EngineProvider wrap, chrome (body class v4-active, title
                       "Maudite Machine | MM-808", theme-color #0A0A0B, all restored on unmount; no robots
                       override since the review pass), root layout, error boundary, data-v4-* attributes,
                       debug install; review pass: quality tier by device class, the Stage disposed after a
                       frame or render error, the sequencer locked while the fallback shows, the Dock
                       mounted on the mobile layout only
theme.ts               colour tokens (hex and numbers), fonts, timings, FRAME constants, LAYOUT (every
                       position and dimension of section 5 as named constants), PCB_SILK lines, copy strings
data.ts                TRACKS, MIXTAPES (from src/v3/data/beads BEADS), queues, PRESS_LINKS, STUDIO_GEAR,
                       fmtTime re-export, fetchShows() (events.json, cached, filtered, sorted)
engine.ts              EngineProvider, useEngine, EngineCtx (v2 AudioPlayerProvider or the v3 MockEngine in DEV),
                       EngineBridge (stage 4: the only context consumer, copies the engine into the bridge)
state/flags.ts         URL flags parsed once: debug, mute, motion, nowebgl, v4mock
state/motion.ts        reduced-motion flag (matchMedia live OR ?motion=reduce), useReducedMotion
state/store.ts         NOT BUILT: the state lives in small observable stores (audio/pattern.ts, audio/clock.ts,
                       audio/soundcloud.ts, state/section.ts, state/explode.ts, state/lcd.ts,
                       state/lcdMessage.ts, state/playhead.ts, state/intro.ts), read by React through
                       useSyncExternalStore and by the Stage through subscriptions
state/bridge.ts        NOT BUILT for the same reason; audio/soundcloud.ts is the SoundCloud bridge
state/intro.ts         (stage 6) the intro store: pending, done
scene/renderer.ts      Stage: create(host, opts) | null, renderer, camera, lights, shadow plane, loop,
                       requestRender, resize, framing (base, section, explode), parallax, observers,
                       context lost/restored, dispose; owns the stats
scene/materials.ts     shared materials, the instanceEmissive patch, vertex-colour helpers
scene/machine.ts       machineRoot, plateauGroup, socleGroup, pcbGroup; plate and socle geometries
                       (extrude + bevel + vertex colours by normal), LCD bezel, connectors, mention plane
scene/pads.ts          pads InstancedMesh, press tween, flash deadlines (update()), selected glow
scene/sequencer3d.ts   buttons InstancedMesh (steps, RUN, CLEAR, OPEN), LEDs InstancedMesh, LED rules, playhead
scene/knobs.ts         knob bodies, caps and screws, rings; angles, hover rise, active state, TEMPO/TONE/LEVEL
                       (stage 3: class Knobs, TEMPO only, tempoAngle(); stage 4: the eight knobs, potAngle(),
                       angleOf, riseOf; screws not placed, section 19 item 52)
state/playhead.ts      the step the render loop lit (-1 when stopped), read by the Dock and the debug
state/lcdMessage.ts    transient LCD messages (STEP 07 BD ON, CLEARED, TAP A PAD FIRST) for the LCD stage
scene/screen.ts        LCD CanvasTexture and the 4 Hz composer (stage 5: the mesh and its texture, reading
                       state/lcd.ts, redrawn at most 4 times per second)
scene/silk.ts          plateau silk texture, PCB texture, mention texture; font loading then redraw (stage 5:
                       class Mention; the PCB texture lives in scene/pcb.ts)
scene/pcb.ts           board and merged components, chip footprints for the hotspots (stage 5: texture with the
                       seeded router, CPU-instanced parts merged, chip hotspots, hover rise)
scene/explode.ts       the three-layer timeline and its framing hooks
state/explode.ts       (stage 5) the OPEN store: closed, opening, open, closing; toggle guard, settle, attach
scene/hit.ts           hotspot definitions, projection, hit shapes, nearest-centre resolution, twin rects
actions.ts             actions shared by the pointer, the keys and the twins (stage 2: gesture, padDown, padHold;
                       stage 3: selectInstrument, stepToggle, runToggle, clearPattern, setTempo; stage 4: knob,
                       openSection, closeSection, escape, dialTone, dialLevel, playItem, RUN pauses a track;
                       stage 5: openToggle, chipAction, Escape closes the exploded view)
state/section.ts       (stage 4) the open section: get, set, toggle, subscribe
state/lcd.ts           (stage 4) the LCD composer store: two lines, 4 Hz at most (replaces the composer part
                       of scene/screen.ts, which keeps the CanvasTexture)
audio/soundcloud.ts    (stage 4) the SoundCloud bridge (mirror of src/v3/state/bridge.ts): sc store, play,
                       pauseForRun, sync from EngineBridge, LOADING / NO SIGNAL, auto STOP, debug simulate()
hooks/useMedia.ts      (stage 4) matchMedia hook shared by index.tsx
ui/sections/common.tsx (stage 4) SectionFrame, PlayList (TRACKS and MIXTAPES rows), ExternalMark
scene/tween.ts         Tweens (run/cancel/update/finishAll) and easings: linear, easeOutCubic,
                       easeInOutCubic, easeInOutQuart (own code, about thirty lines)
audio/drums.ts         AudioContext lifecycle, graph, voices, mute, tone and level
audio/clock.ts         lookahead scheduler, playhead queue, debug ring, drift()
audio/pattern.ts       Inst, Pattern, DEFAULT_PATTERN, toggle, clear, load, save, validation
ui/Panel.tsx           desktop panel and mobile sheet shell (one component), the six sections always
                       rendered, close button, tab strip, sheet gestures
ui/Trace.tsx           SVG overlay, routing, draw-in, dot
ui/Hotspots.tsx        hit layer (pointer events; stage 2: pads and the CH hold; stage 3: steps, RUN, CLEAR on
                       release, TEMPO drag, wheel and double tap, step hover; stage 5: OPEN and chips on release, chip
                       hover, Twins with OPEN and the three chips; stage 6: twins for all 34 hotspots, slider keys,
                       a pointerdown blurs a focused twin) and twins (buttons, sliders, links), focus handling
ui/Dock.tsx            mobile step strip and instrument row
ui/Lcd.tsx             the aria-live twin of the LCD (stage 5, without the ticking timecode)
ui/SocialIcon.tsx      inline SVG from SOCIAL_ICONS or the initial disc
ui/sections/Tracks.tsx, Mixtapes.tsx, Press.tsx, Shows.tsx, Contact.tsx, Studio.tsx
fallback/NoWebGL.tsx   the static page (stage 6: with StaticMachine)
fallback/StaticMachine.tsx  (stage 6) the SVG machine drawn from theme.ts through the camera projection
hooks/useKeys.ts       the global key map with the gesture and focus guards (stage 4: Escape, 1 to 5; stage 5: O;
                       stage 6: A S D F, Space, physical digit keys, machine keys off in the fallback)
debug.ts               window.__v4 assembly (only with ?debug=1)
v4.css                 scoped .v4-root, @font-face copies, panel, sheet, dock, twins, trace, devlog,
                       fallback, reduced-motion rules, body.v4-active chrome
```

Imports from three, named only: WebGLRenderer, OrthographicCamera, Scene, Group, Mesh, InstancedMesh, InstancedBufferAttribute, BoxGeometry, PlaneGeometry, CylinderGeometry, CircleGeometry, TorusGeometry, ExtrudeGeometry, Shape, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, DirectionalLight, HemisphereLight, RectAreaLight, CanvasTexture, Color, Vector3, Matrix4, Quaternion, Object3D, ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, LinearFilter, LinearMipmapLinearFilter, DoubleSide. From three/examples/jsm: lights/RectAreaLightUniformsLib.js, geometries/RoundedBoxGeometry.js, utils/BufferGeometryUtils.js (mergeGeometries). Read-only imports from the repo: src/v3/data/beads.ts (BEADS, fmtTime), src/v3/engine/MockEngine.tsx (DEV), src/v2/context/AudioPlayerContext.tsx (AudioPlayerProvider, useAudioPlayer, V2Track, isPlayable), src/v2/data/contacts.ts, src/v2/data/socials.ts, src/v2/data/socialIcons.ts, src/utils/scWidget.ts (indirectly, through the provider).

As implemented (stage 6): PointLight replaces RectAreaLight and PCFShadowMap replaces PCFSoftShadowMap (item 11); nothing is imported from three/examples/jsm/lights any more; the jsm imports are geometries/RoundedBoxGeometry.js and utils/BufferGeometryUtils.js only. Every import from 'three' is named.

### 16.3 CSS chrome (v4.css)

`.v4-root { position: fixed; inset: 0; height: 100dvh; overflow: hidden; background: #0A0A0B; color: #F6F1E7; font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif; }` plus an inline `style={{ position: 'fixed' }}` on the root by repo habit (the `.page > * { position: relative }` trap; V4App mounts outside `.page` like V2App and V3App, so it is belt and braces). `body.v4-active { padding: 0 !important; margin: 0 !important; background: #0A0A0B !important; overflow: hidden; }` and `html:has(body.v4-active) { background: #0A0A0B !important; overflow: hidden; scroll-behavior: auto; }` (the v1 CSS pads the body on mobile and sets html to black). Preflight is off: `.v4-root a { color: inherit }`, `.v4-root :where(button) { font: inherit; color: inherit; background: none; border: 0 }`. z-index: canvas host 0, hit layer 10, twins 12, trace 25, panel and sheet 30, dock 20, devlog 50.

### 16.4 Repo traps

- iCloud Drive: slow filesystem, slow first import of three in the dev server; never scan node_modules (a symlink to node_modules.nosync).
- No typescript binary: esbuild strips types without checking. Write sound TS anyway (strict null checks in mind, no `any` outside the widget boundary).
- React.StrictMode double-mounts effects in DEV: Stage.create and dispose must be re-runnable; the AudioContext is a module singleton.
- The SoundCloud iframe is a module singleton appended to document.body when the first track plays; never touch it.
- Fonts: the same files as the main site (cached); the canvas textures redraw after document.fonts.load.
- The console filter of index.html (section 15.3).

---

## 17. Build order (each stage leaves /v4 working; mobile 390 x 844 is checked at the end of every stage)

1. Skeleton and HTML truth: route, index.tsx, theme.ts, v4.css with the font-faces, flags, store, bridge, data.ts, engine.ts, useKeys, Panel with the six sections (desktop panel and mobile sheet with tab strip), fallback page with StaticMachine, debug.ts. Check: /v4?nowebgl=1&debug=1 shows the complete static page with 37 + 5 rows, press links, shows from events.json, 2 contacts, 15 socials, studio list; `window.__v4.state` reads; mobile: the sheet opens from the tab strip and closes by drag.
2. Audio, clock, pattern, persistence, Dock: pads and steps work through the keyboard and the Dock without any 3D. Check under ?mute=1: analyser peak on A/S/D/F, RUN with Space, drift() under 1 ms, mm.v4.pattern round trip and validation of a corrupted value, LEVEL cannot raise master.
3. Scene: renderer, camera, framing, lights, shadow, body, silk, pads, buttons, LEDs, knobs, LCD, hit layer, twins, render on demand, resize, dispose. Check: draw calls 16 desktop / 14 mobile, triangles, twins >= 48 px and the pad spacing on mobile (section 6.5), zero frames at rest, `__v4LastDispose` zero after a route change /v4 -> / -> /v4.
4. Interactions: pad press and flash, step toggles and LED rules, RUN colour and playhead, knob rotation, LED, hover and rise, TEMPO/TONE/LEVEL drags and keys, parallax, section framing and trace on desktop, sheet on mobile, SoundCloud coupling with ?v4mock=1 (LCD title and timecode, auto STOP, SKIPPED with ?v4mock=fail), intro. Check: no iframe exists without a row click (none is made), `__v4.state.sc` follows the mock.
5. Explode: PCB textures and components, socle connectors and mention, the timeline, chips and their twins, STUDIO panel, framing. Check: draw calls 18 desktop / 16 mobile while open, the plateau never shows its underside, chips reachable by Tab while open.
6. Hardening: reduced motion path, IntersectionObserver and visibility, context lost and restored, error boundary, `npm run build` with the gzip report, the dash and emoji greps, the acceptance checklist on desktop and mobile, section 19 updated with every deviation, the status line of this file, the session report in docs/reports/ per the project CLAUDE.md. The main session commits.

Cut list if the clock runs out, in this order and no other: (a) the dot on the trace, (b) the hover rise of the knobs, (c) socle connectors and the mention plane, (d) PCB variety (keep the three chips and the capacitors), (e) the intro LED self-test, (f) parallax. Never cut: the HTML truth, the debug and mute contract, the mobile sheet and Dock, reduced motion, dispose, the explode, the 48 px pads.

---

## 18. Acceptance checklist (no audio is ever heard: every run uses ?debug=1&mute=1)

1. /v4 paints ink on the first frame; `meta[name=theme-color]` reads #0A0A0B while mounted and its previous value after navigating to /; `body.v4-active` only while mounted; `document.title` is "Maudite Machine | MM-808"; robots meta left as index.html's "index, follow" (the brief wants the panel indexable; noindex until the review pass); `dist/sitemap.xml` does not contain /v4.
2. Desktop 1440 x 900: the plateau spans 78 % of the width (measure two hotspots from `__v4.hotspots`: pad-BD and knob-contact centres 546 px apart, tolerance 3 px); mobile 390 x 844: 92 % (pad-TOM to knob-contact centres 204 px apart, tolerance 2 px); the canvas host is 464 px tall on mobile.
3. Hotspots: 34 entries in `__v4.hotspots` when closed (35 with the LCD), 37 when open; on the mobile emulation every pad and transport entry has w >= 48 and h >= 48, and the pad centres are at least 48 px apart.
4. Pads: dispatching a pointerdown on the hit layer at pad-BD's centre sets `data-v4-instrument="BD"`, the analyser peak exceeds 0.01 within 50 ms, `__v4.stats.frames` increases for about 250 ms then stops; the twin's aria-pressed and the Dock reflect the selection.
5. Steps: with BD selected, a click on step-3's centre flips `state.pattern.steps.BD[2]`, the LCD twin reads "STEP 03 BD ON", and `localStorage['mm.v4.pattern']` holds it within 400 ms; a reload restores it; a corrupted value in localStorage is replaced by the default without an error.
6. Default pattern on first load: BD 1 5 9 13, CH 3 7 11 15, SD 5 13, TOM 15, visible on the LEDs (union) before any pad is hit.
7. RUN: Space (after a first gesture) sets `data-v4-running="1"`, RUN turns yellow, the playhead LED cycles 16 steps every 1.846 s at 130 BPM, `__v4.clock.drift()` reads maxMs < 1 and lateCount 0 after 10 s; Space again stops. CLEAR empties all four rows and keeps running.
8. TEMPO: a vertical drag on the knob changes `data-v4-bpm` within 100..150, the LCD line 1 shows it, the slider twin's aria-valuenow follows, the arrow keys move by 1; TONE and LEVEL change `__v4.audio.tone` and `.level`; with ?mute=1 `__v4.audio.master.gain.value` stays 0 after any LEVEL change.
9. Knobs: clicking TRACKS sets `data-v4-section="tracks"`, the knob instance rotates -30 deg, its LED lights, the panel appears with 37 rows (35 buttons, 2 Bandcamp anchors), the SVG trace has a path whose stroke-dashoffset reaches 0 within 450 ms; clicking MIXTAPES returns TRACKS to 0 deg; clicking the active knob again closes; Escape closes; digits 1 to 5 switch.
10. Panel content: PRESS shows the sentence and three links with the exact hrefs; SHOWS lists events from /events.json with dates >= today, sorted ascending, or "No upcoming dates." with the /shows link; CONTACT shows the two mailto rows and 15 social links (11 with SVG icons, 4 with initials) that turn yellow on hover; STUDIO lists the six items.
11. SoundCloud wiring: no iframe before any row click; a row's React props include an onClick function; with ?v4mock=1 a row click (mock only) gives `data-v4-sc="loading"` then "playing", the LCD twin shows the title and a counting timecode, the sequencer stopped if it was running; with ?v4mock=fail the second row shows "SKIPPED ..." for 4 s; pressing RUN while the mock plays pauses it (`data-v4-sc="paused"`).
12. OPEN: click or O sets `data-v4-exploded="opening"` then "open" within 1.1 s; plateauGroup.position.y reads 5.1, socleGroup -1.5, pcbGroup visible; the OPEN silk reads CLOSE; three chip twins exist and Tab reaches them; the camera's hw grew on desktop; CLOSE reverses and pcbGroup.visible is false at the end; draw calls 18 / 16 while open.
13. Chips: chip-label's twin is an anchor to https://vrstlrecords.com with target _blank and rel noopener; chip-live's twin an anchor to /techrider; chip-studio opens the STUDIO section.
14. Hover (desktop): moving the pointer over a nav knob raises it by 0.08 and turns its ring yellowHi, the cursor is "pointer"; over a step the LED turns ledHover; leaving resets.
15. Parallax (desktop, full motion): moving the pointer across the canvas rotates machineRoot by at most 4 deg on each axis, the loop stops within 1 s of the pointer stopping, twins follow (compare `__v4.hotspots` before and after).
16. Idle: with nothing running and the pointer outside the canvas, `__v4.stats.frames` is constant over 2 s.
17. Visibility: hiding the tab (or scrolling the canvas out with a taller container in a test) pauses the loop and `__v4.audio.ctx.state` becomes "suspended"; returning resumes rendering.
18. Reduced motion (?motion=reduce): `data-v4-motion="reduced"`, no intro (`data-v4-intro="0"` at mount), no parallax, OPEN is a cut (state goes closed to open in one frame), the sequencer still runs and renders one frame per step.
19. No WebGL (?nowebgl=1): `data-v4-gl="fallback"`, the static SVG machine, the six sections expanded, all links resolve; no canvas element; no technical message.
20. Mobile 390 x 844: no horizontal scroll (`document.documentElement.scrollWidth === 390`), the canvas host is 55 dvh, the Dock shows the instrument row, 16 cells of 44 x 48 px and the transport row (RUN, CLEAR, OPEN, tempo, each at least 48 x 48 px; 44 x 44 cells and no transport until the review pass), a knob tap opens the sheet in 280 ms with the tab strip, the sheet closes by drag, pads and RUN work while the sheet is open, the 3D steps are disabled for touch (`hotspots[].enabled === false` for steps) but their twins keep aria-pressed.
21. Keyboard: Tab order pads, steps, run, clear, tempo, knobs, open, tone, level (chips when open), 2 px yellow focus ring visible on each; Enter/Space on a twin fires exactly once; A S D F, Space, 1 to 5, O, Escape behave per section 7.2; nothing fires with a modifier held or inside the panel's text.
22. Silk and fonts: after `document.fonts.ready` the plateau texture shows BD SD TOM CH, TRACKS to CONTACT, RUN/STOP, CLEAR, TEMPO, TONE, LEVEL, OPEN, MAUDITE MACHINE, MM-808 in SF Pro Display 700 (compare a canvas sample before and after the font load in DEV, or inspect the drawn font string); the LCD uses a monospace font.
23. Draw calls and triangles per section 4.6 on all four combinations; DPR at most 1.5 on the mobile emulation; frame time under 4 ms on the M1 (measure with performance.now around `requestRender()` plus one frame).
24. Unmount: /v4 -> / -> /v4 twice: no devlog error, `__v4LastDispose` reads zero geometries and textures, the v2 home is intact (cream, its nav, its sticky player), /v3 still works.
25. Build: `npm run build` passes; the v4 chunk is at most 220 KB gzip (report the exact figure); `grep -rnP "\x{2014}|\x{2013}" src/v4 docs/v4 src/App.tsx` prints nothing; `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F000}-\x{1F2FF}]" src/v4 docs/v4` prints nothing; `LC_ALL=C grep -rnP "[^\x00-\x7F]" docs/v4 src/v4` prints nothing (ASCII only, data files excluded).
26. Copy audit: every displayed string is English and short, no exclamation marks, no place names in the HTML (event locations and contact labels are data); since the review pass no city name appears in any displayed text, the PCB silk included (section 19 item 103).
27. This file's status line reads "as implemented" and section 19 lists every deviation; the session report exists in docs/reports/ with the four required sections; the commit message (main session) contains no em dash, no en dash, no emoji.

### Acceptance run of stage 6 (final code)

Every run with ?debug=1&mute=1 in the hidden preview pane (Chrome emulation, the rAF and visibility shim of section 19 item 87), desktop 1440 x 900 and 390 x 844; no sound reached the speakers (master gain 0 throughout), no SoundCloud row was clicked.

1. Pass: title "Maudite Machine | MM-808", theme-color #0A0A0B, robots "noindex, nofollow", body.v4-active while mounted; after /: v2-active, #f6f1e7 and the home title; dist/sitemap.xml has 4 URLs, none is /v4.
2. Stage 4 reading: pad-BD to knob-contact 541.4 px at 1440 x 900 (item 62); unchanged.
3. Pass with the stage 5 reading (item 74): 34 entries always; on 390 x 844 the pads are 68.6 x 48.1 px, RUN, CLEAR, TEMPO and OPEN 48 x 48 px, pad centres 48.3 px apart at least.
4. Pass: a twin click on pad-SD gives an analyser peak of 0.578 after 16.6 ms, aria-pressed and `data-v4-instrument` follow; the hit layer path is stage 2's.
5. and 6. Stage 3 (unchanged code paths).
7. Pass: Space runs and stops (RUN yellow, the run twin reads "Stop, Space", drift maxMs 7e-12, lateCount 0); the 10 s run is stage 3's.
8. Pass by keyboard (section 13 as implemented); the drags are stage 3 and 4.
9. to 11. Stage 4, re-checked: no iframe, 0 iframes, a row's React props hold an onClick function, 40 row buttons in the panel.
12. and 13. Pass: O gives "opening" then "open", 18 calls, the three chip twins in the Tab order with the specified hrefs, target and rel.
14. and 15. Stages 4 and 1.
16. Pass: 0 frames over 2 s at rest, closed and open, after the intro.
17. Pass (14.2 as implemented).
18. Pass (7.3 as implemented).
19. Pass (11.5 as implemented).
20. Pass: scrollWidth 390, canvas host 464.2 px, Dock 16 cells and the instrument row, the 16 step hotspots `enabled === false` with 16 step twins keeping aria-pressed, a knob tap opens the sheet (focus on its close button), a pad tap still plays while the sheet is open; the sheet drag is stage 4's.
21. Pass (13 as implemented).
22. Stage 1.
23. Pass (4.6 as implemented; DPR 1.5 on the phone).
24. Pass (14.4 as implemented), /v3 still loads.
25. Pass: `npm run build` passes, /v4 199.3 kB gzip with three (14.3 as measured), the dash, emoji and ASCII greps print nothing.
26. Pass: no exclamation mark in the copy; MONTPELLIER only on the PCB silk (item 1, still open).
27. This status line and section 19 are written. The session report in docs/reports/ is left to the main session (the builders' write scope is src/v4, docs/v4 and the App.tsx route), with the commit.

### Acceptance run of the review pass (final code)

Same conditions as stage 6 (hidden preview pane with its shim, ?debug=1&mute=1, master gain 0, no row clicked, links cancelled). Items not listed pass as in the stage 6 run (their code paths are unchanged).

1. Pass, with the review change: title, theme-color #0A0A0B and body.v4-active while mounted, restored on / (v2-active, #f6f1e7); robots "index, follow" on /v4 and on / (item 106).
3. Pass: 34 hotspots; on 390 x 844 the pads 68.6 x 48.1 px, RUN, CLEAR, TEMPO and OPEN 48 x 48 px; the Dock adds RUN 74 x 48, CLEAR 61 x 48, OPEN 61 x 48, tempo 48 x 48.
4. Pass: a real click on pad-SD, first gesture of the page: context created running, signal at 11.1 ms; the next hit 10.1 ms, peak 0.598.
7. Pass: Space runs and stops; STOP cancels pending hits (item 92).
12. Pass: O opens (18 calls desktop, 16 mobile), the OPEN twin keeps its name with aria-pressed "true", the three chip twins are in the Tab order; CLOSE never clips at four viewport sizes (item 108).
13. Pass: Space (and Enter) on chip-label and chip-live activate the links (cancelled for the test).
16. Pass: 0 frames and 0 rAFs over 2 s at rest.
20. Pass: scrollWidth 390, canvas host 464.2 px, instrument row 48 px, cells 44 x 48, transport row 48 px; a real tap on the Dock's RUN started the sequencer and the head cell followed the playhead; the 16 3D step hotspots disabled; 14 / 16 calls.
21. Pass, with the review changes: Tab lands on pad-BD with the 2px solid rgb(242, 194, 48) ring; Space on the focused TEMPO slider runs and stops; the sheet tab ring is drawn inside the tab.
23. Pass: 16 / 18 and 14 / 16 calls; DPR 2 desktop, 1.5 phone; the mobile tier also on a coarse pointer at 1440 x 900 (item 96).
24. Pass: two SPA cycles / -> /v4: `__v4LastDispose` 0 / 0 each time, no v4 canvas left on /, the clock stopped, a new Stage with 16 calls and 31 twins on return; no console error or warning (console.error and console.warn wrapped) over a cycle plus a section, OPEN, CLOSE, RUN, CLEAR and STOP.
25. Pass: `npm run build` exit 0, 199.7 kB gzip (item 115); the three greps print nothing.
26. Pass: no place name in any displayed text, the PCB silk included (item 103).

---

## 19. Open questions for the owner and handoff notes

1. "MONTPELLIER" on the PCB silkscreen is requested by the brief but the repo's recent rule (commit 1e6cf7f, "Plus aucune mention de lieu dans les textes affiches du site") removed place names from displayed text. Default: implemented as the brief says, as one entry of `PCB_SILK` in theme.ts, so removing it is a one-line change. Please confirm. CLOSED at the review pass: removed (item 103); the entry to restore it is quoted in the comment above `PCB_SILK`.
2. TRACKS rows: the brief asks for "titre, type, annee, label". src/v2/data/discography.json has no record-label field (fields: id, title, project, artist, role, year, category, link, featured, soundcloudUrl, releaseDate, trackNo, dateApprox). The fourth column shows `project` (Limbos LP, Single / EP, Remix). If labels are wanted they belong in discography.json, which is read-only for this mission.
3. The mobile Dock (HTML step strip) is an addition: on a 390 px phone the 3D steps are 7 px apart, so without it the sequencer cannot be programmed on a phone. Remove ui/Dock.tsx if unwanted.
4. Pads are 2.2 units on a 3.05 pitch (brief: 2 units) so that adjacent pads are 48 px apart on the 390 px phone; the transport is spaced for the same reason (section 6.5).
5. RUN pauses a playing SoundCloud track (decision 5). Alternative: let both play.
6. Lists are newest first (the /v3 line is oldest first).
7. Title "Maudite Machine | MM-808" and the model name MM-808 on the silk come from the brief's PCB text; change theme.ts COPY.title and COPY.model if another name is wanted.
8. src/utils/scWidget.ts needs no change. Note for future work: the widget's `onProgress` fires many times per second; /v4 keeps the position in a ref and composes the LCD at 4 Hz so React never renders per tick.
9. `?debug=1` installs `window.__v4` in production builds too (URL gated, no cost otherwise). Say so if it must be DEV only.

### Stage 1 (foundation): deviations and notes

10. RectAreaLight cost (decision 6 corrected). RectAreaLightUniformsLib.js (1 KB) imports RectAreaLightTexturesLib.js: 315 KB of LTC tables, 101 KB gzip, absent from three's core build. Implemented as specified (RectAreaLightUniformsLib.init() once per page), but the module is loaded by a dynamic import in its own chunk (RectAreaLightUniformsLib-*.js), started when the stage is created; the first frame waits for it and for the fonts, 1.5 s at most (after that the machine renders without the rim and the rim arrives with an async shader compile). Stage 1 build: v4 chunk 11.1 KB gzip + three chunk (shared with /v3) 142.0 KB gzip = 153 KB on the critical path; the LTC chunk adds 103 KB (256 KB in total). Owner decision: (a) keep the lazy chunk and count only the critical path against the 220 KB budget; (b) drop the RectAreaLight (saves 103 KB) and make the warm rim with a yellow PointLight or DirectionalLight (0 KB); (c) keep it and accept 256 KB.
11. PCFSoftShadowMap was removed in three 0.186: WebGLShadowMap warns "PCFSoftShadowMap has been removed" and switches to PCFShadowMap. The stage sets PCFShadowMap directly with `shadow.radius` 4 desktop / 3 mobile (5-tap Vogel disk, radius in texels), which is what the soft type now maps to (theme.ts LIGHT_KEY.radius).
12. The palette is applied as DISPLAYED colours (theme.ts ALBEDO_GAIN = 3). With vertex colours equal to the tokens, ACES crushed the body: measured top #0A0908 (as dark as the background), flanks #020202, bevels #110F0F. The brief defines the tokens by what the faces look like (graphite = top face, graphiteHi = lit chamfers, graphiteLo = flanks in shadow), so body albedos are token x 3 in linear space. Measured at 1440 x 900 (sRGB 0 to 255): top 21,19,19 (graphite 20,20,23), lit bevels 34,33,33 (graphiteHi 28,29,33), plate flanks 7 to 10 (graphiteLo 8,8,10), socle walls 3 to 4, background 10,10,11. Light intensities keep the spec values (2.2 / 0.35 / 0.7). Later stages: lit materials (pads, buttons, knobs) go through materials.ts `albedo()` and are checked the same way (pixel read-back).
13. Extrusion: three's ExtrudeGeometry `depth` excludes the two bevels. To keep the stated spans (plate y -0.9 to 0, socle y 0 to 0.7), depth = thickness - 2 x bevelThickness (plate 0.54, socle 0.58); the plate's lower bevel leaves a dark groove between plate and socle. `curveSegments` is 4, not 8: three subdivides arcs at 2 x curveSegments, so 4 gives the 8 facets per corner that the triangle estimate of 4.6 assumed. Measured: plateau 440 triangles (LCD bezel included), socle 284.
14. Vertex colour thresholds: flat top at ny > 0.995 (with 0.97 the inner bevel facet, ny 0.9705, would be painted as top); downward bevels take graphiteLo (in shadow) instead of graphiteHi.
15. Silk fitting: at the specified cap heights with 0.18 em tracking, MIXTAPES overlapped TRACKS and PRESS, CONTACT ran past the flat top, CLOSE crossed its frame and the last letter of LEVEL disappeared under the LCD bezel (0.06 high, from x 2.45). theme.ts SILK_TEXTS: the nav row shares one size that fits 1.18 units (cap 0.134 instead of 0.18); TONE and LEVEL fit 0.66 and the LEVEL label moves from x 2.1 to 2.0; OPEN/CLOSE fits 0.85, TEMPO 1.1, the wordmark 5.3.
16. Shadow visibility: the key light (8, 14, 6) sits on the camera's side (8 deg off its azimuth, 24 deg higher), so the cast shadow falls behind the machine and the machine hides it; only a thin contact line shows at the left end of the base (checked by tinting the ShadowMaterial red, test only). A black shadow at 0.45 over ink darkens 10 to 6 at most. Kept as specified. If the brief's "ombre portee douce" must read, the key light has to move to the other side: (-6, 14, 8) puts a soft shadow at the right of the machine (diagnostic render, not shipped). Owner decision: it also changes which faces are lit. Closed at the review pass without moving the light: a contact shadow in the shadow plane's shader (item 107).
17. Parallax settle time: with lerp 0.06 and the 0.0003 rad stop threshold, a 3 deg step settles in 81 frames (1.35 s at 60 fps), longer than acceptance 15's "within 1 s" for a sudden full-range jump; continuous pointer motion settles sooner. Kept as specified.
18. Build order: this build follows a six-stage plan whose stage 1 is the scene foundation (theme, renderer, body, silk, shadow, parallax, entry, CSS, route, debug base), not the order of section 17.
19. Quality tier fixed at creation: antialias, DPR cap, shadow map size, silk texture size and the caster list follow the layout at creation (max-width 767 px); the framing follows the live layout (matchMedia listener in the stage). A desktop window resized across 768 px keeps its creation tier. Review pass: the tier is chosen by device class, narrow layout OR coarse pointer (item 96).
20. Debug additions from stage 1: `window.__v4.measure()` (projected boxes of the sharp footprint and of the real meshes, px per unit, frustum, parallax angles), `.silk` (draws, webfont, font string) and `.stage` (the Stage instance, for tests). `.audio`, `.clock`, `.hotspots` and `.reproject()` arrive with their stages.

### Stage 2 (pads and sound): deviations and notes

21. Scope of this stage in the six-stage plan: audio/drums.ts (four voices, bus, analyser before master, mute, lifecycle), audio/pattern.ts (16 steps x 4 instruments, selected instrument, bpm, persistence), scene/pads.ts, scene/tween.ts, scene/hit.ts (picking), ui/Hotspots.tsx (the hit layer only), actions.ts, window.__v4 additions. Not in this stage: audio/clock.ts, the Dock, hooks/useKeys.ts (A S D F), the HTML twins, state/store.ts and state/bridge.ts. The selected instrument, the steps and the bpm live in the pattern store (`pattern` in audio/pattern.ts, observable, read by React through useSyncExternalStore and by the Stage through a subscription); the later store should keep it as the source of truth for those three fields or absorb it.
22. Pad glow calibrated to the displayed colour. With the spec's values, measured at 1440 x 900 by pixel read-back: yellow x 1.0 rendered 228,207,118 (a pastel yellow, ACES desaturates it) and yellow x 0.25 rendered 160,134,72 (a plain khaki, not a faint yellow). theme.ts `PAD_GLOW` holds linear emissive radiances found by inverting three's ACESFilmic curve around the rendered top: flash [1.214, 0.397, 0] reads 241,194,91 (#F2C230 is 242,194,48; its blue is out of gamut under ACES), selected [0.073, 0.048, 0] reads 97,82,47 (the rendered top plus 25 % of the yellow). The glow lights the top face only: an `emissiveMask` vertex attribute (smoothstep of the normal's y, 0.55 to 0.95) weights `instanceEmissive` in the shader patch (materials.ts `withInstanceEmissive(material, masked)`). If the lights change, recalibrate.
23. `PAD_ALBEDO_GAIN` 2.1 for the pad top instead of `ALBEDO_GAIN` 3: at x 3 the padTop top rendered 63,59,56; at x 2.1 it renders 48 to 51, 45 to 47, 43 to 44 (padTop is 47,47,50; the warm cast is the key light's, as on the body). Pad sides stay graphite x 3 and render like the plateau top (21,19,19).
24. Pad labels BD and SD moved from z -0.38 to -0.585 (theme.ts PADS.labelZ). The TOM and CH pads (0.35 high, back edge at z 0.05) hide the plateau behind them up to z -0.37 at the base view and -0.45 at the lowest parallax elevation (26.5 deg): at -0.38 the lower half of BD and SD was hidden. At -0.585 the labels span z -0.715 to -0.455, clear of the pad in front and 0.085 in front of their own pad's front edge (z -0.8). Checked on a magnified render.
25. Hit shapes are the convex silhouette of each hotspot's box (8 projected corners), not the top-face quad, so a click on a pad's visible front face (20 px tall on desktop, 6.6 px on the phone) hits it. Projection is lazy and signature-based (section 6.2 as implemented). The hit layer is `.v4-hit` inside `.v4-stage` (z-index 10, touch-action none, no selection, no touch callout, context menu prevented for the CH hold); the Stage's parallax still receives its pointermove by bubbling.
26. Touch areas on the 390 x 844 emulation (touch emulated, coarse pointer): raw projected bounding box of each pad 68.6 x 41.5 px; target rect (bbox united with a 48 x 48 box around the top centre) 68.6 x 48.1 px, listed as w, h in `__v4.hotspots` (bw, bh hold the raw box). Region that resolves to each pad with the coarse rule, sampled on a 1 px grid: BD 101 x 66 px (3885 px2), SD 93 x 90 (5385), TOM 93 x 90 (5377), CH 102 x 73 (4243), against 1650 px2 for the shape alone. Every point within 24 px of BD's centre resolves to BD; for SD, TOM and CH, 6 to 12 of the 1793 points of that 48 px disc lie on the neighbouring pad's visible front face and resolve to that pad (shape first, then nearest centre, as specified), so their fully resolved centred disc is 43 px wide. Centres: BD to CH 48.3 px, BD to SD 53.3, BD to TOM 53.4, SD to TOM 95.1. Desktop 1440 x 900: each pad 214.9 x 129.9 px.
27. `__v4.audio.ctx` is `undefined` before the first gesture (the stage acceptance's wording; section 15.2 said null). `__v4.audio.created` counts the contexts made since load: 0 before any gesture, 1 after, still 1 after /v4 -> / -> /v4 (the context is suspended on unmount and reused).
28. First-hit latency. On a running context the first analyser sample above 0.01 comes 7 to 14 ms after the pointerdown (this includes the DynamicsCompressor's fixed 6 ms lookahead in Chrome). On the first gesture of a page (context created by that pointerdown) it comes 46 to 52 ms after it: `ctx.currentTime` stays at 0 for about 20 ms, renders one 256-frame block, then waits until about 45 to 50 ms before the next (output device start), and the compressor's lookahead pushes the hit into that second block. The same happens on the first hit after a resume (46.5 ms measured after a remount). The rules (no context before a gesture, suspend when hidden or unmounted) make this unavoidable; the sound is still scheduled at the gesture's context time. Accepted again at the review pass (item 111).
29. Touch devices: pointerdown from a finger is not an activation-triggering event (Chrome and WebKit activate on pointerup or touchend for touch), so on a real phone the first tap creates the context suspended and its hit plays when the pointerup / touchend listener resumes it; later taps are immediate. The emulation used here delivers mouse events, so the first tap creates a running context. index.tsx `useAudioGestures`: window capture listeners, pointerdown and keydown call `gesture()` (ensure + resume), pointerup and touchend call `resume()`; the Stage's visibility hook suspends and resumes the context.
30. CH hold: the closed hit fires on pointerdown; if the pointer is still on pad-CH after 300 ms a second, open hit (220 ms decay) fires and the pad flashes for 100 ms. Releasing earlier or sliding off the pad cancels it; sliding onto another pad triggers nothing (pads fire on pointerdown only). Measured: signal above 0.01 for 44 ms (closed) and 168 ms (open).
31. TONE and LEVEL use `setTargetAtTime(value, now, 0.02)` (20 ms time constant). Noise hits (SD, CH) start at a random offset in the one-second buffer so that repeated hits are not identical (not specified). Voices are built with factory methods (createGain...) for older Safari, and every node of a voice is disconnected in its source's `onended`.
32. Stage 2 numbers: draw calls desktop 8 (main 5, shadow 3), mobile 7; triangles desktop 3852, mobile 3568 (pads 4 x 300 in each pass); frames at rest 0; one pad press renders 15 frames (about 240 ms) then the loop stops; reduced motion: flash only, 8 frames. Build: v4 chunk 50.33 KB raw / 18.20 KB gzip (stage 1: 11.14), CSS 1.26 KB gzip, three chunk 142.93 KB gzip, lazy LTC chunk 101.18 KB gzip: critical path 162.4 KB gzip, total 263.6 KB gzip (see item 10).
33. Debug additions from stage 2: `__v4.state.pattern` (the stored form), `.instrument`, `.bpm`; `__v4.pattern` (the store: get, select, toggle, clear, setBpm, flush), `__v4.pads` (y, glow, selected, lastPress), `__v4.hotspots` ({ id, kind, shape, enabled, inst, x, y, w, h, cx, cy, bx, by, bw, bh, poly }), `__v4.pick(x, y, coarse)`, `__v4.reproject()`, `__v4.audio` (item 27 and section 8.1); root attributes `data-v4-instrument`, `data-v4-bpm` and `data-v4-state="selected"`.

### Stage 3 (sequencer): deviations and notes

34. Scope of this stage in the six-stage plan: audio/clock.ts (lookahead scheduler), scene/sequencer3d.ts (16 steps, RUN/STOP, CLEAR, 16 LEDs), scene/knobs.ts (the knob meshes, TEMPO only), ui/Dock.tsx (the phone step strip), state/playhead.ts, state/lcdMessage.ts, the actions (selectInstrument, stepToggle, runToggle, clearPattern, setTempo) and the hit layer semantics for steps, transport and TEMPO. Not in this stage: the LCD itself (the messages are stored for it), the HTML twins and the keyboard (Space for RUN), the SoundCloud coupling (RUN pausing a track, a track stopping RUN), the intro LED self-test, knob hover (rise, ring yellowHi), the OPEN button instance, the nav knobs, TONE, LEVEL, the screws and the knob LEDs (all four go into the meshes built here).
35. Clock as specified in section 9 with three additions. (a) A step more than 50 ms late is dropped and counted (`drift().dropped`) instead of being played in a burst when a starved or frozen tab wakes up; the grid continues without a shift. Section 9 said "catches up by scheduling the missed steps at their (past) times", which would fire every missed step at once. (b) `drift()` accumulates over every step since RUN or `resetStats()` (the ring keeps only the last 64), and adds count, dropped, minLeadMs (smallest `when - at`), maxTickGapMs and ticks. (c) `clock.clear()` is the CLEAR transport (it empties the pattern; the clock reads the pattern at each step), `onStep(fn)` fires at scheduling time and wakes the render loop. Measured with ?debug=1&mute=1 (master gain 0), 130 BPM, final code, default pattern: desktop 1440 x 900, 147.5 s (1278 steps): maxMs 2.1e-9, meanMs 7.6e-10, lateCount 0, dropped 0, max tick gap 27.4 ms, min lead 50 ms (the first step); 390 x 844, 134.2 s (1163 steps): maxMs 1.8e-9, meanMs 6.5e-10, lateCount 0, dropped 0, max tick gap 27 ms (an earlier 140.8 s desktop run read the same). Rendering while running: 12 frames per second for 59 rAFs per second on both layouts. The drift figure only proves that the additive grid does not wander; the audio itself was checked at the analyser: with CH alone on steps 1, 5, 9 and 13, every programmed step shows a peak of 0.36 to 0.68 within its step and every other step reads exactly 0; onsets land 6.00 to 6.08 ms after the scheduled `when` (the DynamicsCompressor's fixed 6 ms lookahead) and 46 inter-onset intervals match 4 x stepDur (461.538 ms) within +/-0.04 ms. A tempo change while running (130 to 140 BPM) switches the interval from 115.385 ms to 107.143 ms at a step boundary with no irregular gap, and drift stays at 1e-11 ms after the re-anchoring.
36. Rendered on demand while running (section 14.1 as implemented): an animator may return 'poll'; the playhead animator reads the audio clock on every rAF and renders only when the step changes; pad flashes end on deadlines (`Pads.update()`), which also cut a reduced-motion pad press from 8 frames to 2. Measured: 30 frames for 135 rAFs over 2.3 s (default pattern, full motion), 1.23 frames per step under reduced motion, 0 frames and 0 rAFs over 2 s after STOP.
37. Sequencer hits flash their pads (100 ms, no movement) on the frame their step SOUNDS (the same `entryAt(ctx.currentTime)` entry that lights the LED, whose `mask` says which instruments were scheduled), not when the clock schedules them up to 100 ms earlier. The LED lights 3 to 21 ms after `when` in the test pane (its rAF is a 16 ms timer there); `ctx.currentTime` is used as specified, without output-latency compensation (a Bluetooth output would see the LED lead the sound by its latency).
38. Lit colours calibrated on the displayed top faces by pixel read-back at 1440 x 900 (theme.ts `LIT`, `RUN_GLOW`), like stages 1 and 2: greys keep the warm cast of the key light and match the token's luminance (stepBtn renders 92,86,78; graphiteHi CLEAR and knob 29,28,29 and 30,29,30; bone mark 241,238,234; metal cap 145,142,138 for leg), red and yellow are matched channel by channel (RUN 200,68,47; RUN running 238,194,76 with the spec's instanceEmissive yellow x 0.5, blue out of gamut). LEDs and rings are unlit (`toneMapped: false`) and display their exact tokens. If the lights change, recalibrate.
39. TEMPO turns clockwise (seen from above) as the tempo rises: angle about +y = +135 - 270 * (bpm - 100) / 50 deg. Read with the "positive = counter-clockwise" convention of the nav knobs (-30 deg = clockwise), the formula of section 5.3 (-135 + 270 t) would have turned it the wrong way for a potentiometer. Interaction: vertical drag 2 px per BPM after a 3 px dead zone, wheel 100 px of delta per BPM (preventDefault over TEMPO only), two taps within 350 ms reset 130, cursor ns-resize over TEMPO (pointer elsewhere). Verified: +30 px gives 145, the clamps hold at 150 and 100, two wheel notches up then one down give +1, a double tap gives 130, the knob angle follows (-27, -108, -135, +135 deg), the value persists.
40. The 3D steps are disabled when the layout is mobile (the Dock is shown), not when the pointer is coarse (section 6.4 as implemented): a tablet or a phone in landscape uses the desktop layout, has no Dock and would otherwise have no way to program the steps. Verified both ways at runtime (390 x 844: 0 of 16 enabled, Dock flex; back to 1440 x 900: 16 enabled, Dock hidden).
41. Dock (section 11.4 as implemented): the instrument row selects without playing; union mode is dimmed and aria-disabled, a tap there flashes the hint instead of toggling; cells are 44 x 44 px, 380 px per row, centred in the bottom 45 %. Verified with real clicks on the 390 x 844 emulation: BD selected from the Dock (no trigger), step 3 toggled (aria-pressed, aria-label "Step 3, bass drum on", the 3D LED 3 lit, localStorage written), RUN tapped on the machine: the Dock's yellow cell and the 3D playhead agreed on 440 of 440 samples; CLEAR tapped on the machine emptied the four rows and kept running; no horizontal scroll (scrollWidth 390).
42. Owner decision, phone transport spacing. The target rects of RUN, CLEAR and TEMPO are 48 x 48 px (by construction, as the pads' are) and RUN resolves over its whole 49.6 px centred disc, but CLEAR and TEMPO sit 29.3 px apart on the 390 px phone, so each resolves over a 29.5 px centred disc (43 x 57 px and 47 x 65 px across their centres), which section 6.5 already accepted ("resolved by nearest centre"). A literal 48 px exclusive area for all three would need 96 px between RUN and TEMPO along the row: 5.5 units, while the plateau gives 4.6 without moving RUN closer to the CH pad. Options: (a) keep; (b) add RUN, CLEAR and TEMPO -/+ as 44 px HTML buttons to the Dock on phones; (c) re-layout the front strip (TEMPO moved elsewhere). Closed at the review pass with (b), at 48 px and with OPEN (item 101).
43. The STEP_TOGGLE and CLEAR events write their LCD messages ("STEP 07 BD ON", "STEP 07 BD OFF", "TAP A PAD FIRST", "CLEARED", 800 ms) into state/lcdMessage.ts, read today by `__v4.state.lcdMessage` and by the LCD stage tomorrow. On desktop a step clicked with no instrument selected changes nothing visible until the LCD exists.
44. Stage 3 numbers. Draw calls desktop 14 (main 10: plateau, silk, socle, shadow plane, pads, buttons, LEDs, knob bodies, caps, rings; shadow 4: plateau, socle, pads, knob bodies), mobile 12 (shadow 2). Triangles desktop 6624 (main 4560, shadow 2064), mobile 5496 (main 3856, shadow 1640). Build (vite gzip): v4 chunk 66.50 KB raw / 23.87 KB gzip (stage 2: 18.20), v4 CSS 5.41 / 1.68 KB, three chunk 143.11 KB gzip, lazy LTC chunk 101.18 KB gzip: critical path 168.7 KB gzip, 269.8 KB with the LTC chunk (item 10). GPU memory after unmount 0 geometries, 0 textures (also after an unmount while running: the clock stops, the context is suspended).
45. Debug additions from stage 3: section 15.2 as implemented (`__v4.clock`, `.seq`, `.knobs`, `.state.running`, `.state.playhead`, `.state.lcdMessage`, `.pads.flashes`, `.stats.rafs`; root attributes `data-v4-running`, `data-v4-state="running"`).

### Stage 4 (navigation knobs, panel, sections, SoundCloud): deviations and notes

46. Scope of this stage in the six-stage plan: scene/knobs.ts (the five navigation knobs, TONE and LEVEL wired to the bus, hover and active states), the five knob LEDs (instances of the step LED mesh), the section framing of 3.3, state/section.ts, data.ts, engine.ts with EngineBridge, audio/soundcloud.ts (the bridge), state/lcd.ts (the LCD composer as a store), ui/Panel.tsx (desktop panel and mobile sheet), ui/Trace.tsx, ui/sections/* (the five sections of the brief plus STUDIO), ui/SocialIcon.tsx, hooks/useKeys.ts (Escape, 1 to 5), hooks/useMedia.ts; the fallback page now renders the sections expanded. Not in this stage: the LCD mesh and its role=status twin (they read state/lcd.ts), the HTML twins of the hotspots and the other keys (A S D F, Space, O), OPEN and the explode (the STUDIO section is ready for its chip), the screws (item 52), the intro, the static SVG machine of the fallback.
47. Inactive sections are VISUALLY hidden (clip), not `hidden` (11.1 said `hidden`): the stage brief asks that all section text be in the DOM at load, "visually hidden when closed, for SEO and screen readers", and the `hidden` attribute would take it out of the accessibility tree. Their links and buttons take tabIndex -1 so Tab never lands on something invisible; a screen reader can still read and activate them. The closed desktop panel is opacity 0 with no pointer events and no backdrop filter; the closed sheet sits just below the viewport.
48. TRACKS meta without a repeated word: every remix has "Remix" as its project, so remixes read "Remix, 2023" instead of "Remix, 2023, Remix"; the others read "Original, 2026, Single / EP". The record label is still absent from the data (item 2).
49. Trace under reduced motion: drawn at once, without the dash animation and without the dot (7.3 and 11.2). The stage brief says "hidden with reduced motion"; read as its animation hidden, in line with the client brief where reduced motion turns animations into their end state (the exploded view appears at once). To hide the whole trace instead: in Trace.tsx, make `on` false when `motion.reduced()`.
50. LCD line 2 order: a running sequencer (RUN) comes before a paused track (PAUSED); 5.5 put paused first, which would show "TITLE PAUSED" while the beat plays right after RUN paused the track (decision 5).
51. TONE and LEVEL: a 20 ms linear ramp replaces setTargetAtTime (8.1 as implemented; item 31 is superseded for these two parameters). Chrome advances a setTarget approach only on the render quanta a node processes, and the tone filter and the level gain process nothing while the bus is silent between hits, so the first hit after a change played at the old value (CH peak 0.58 right after TONE 0, 0.001 on the next hit). Measured after the fix: first hit after TONE 0 0.001, after TONE 1 0.62; SD at LEVEL 0.3 0.09 to 0.10, at 1.0 0.65 to 0.79; master 0 throughout. A latent stage 2 bug, visible only now that TONE and LEVEL have controls.
52. Screws not placed: the front-right screw of 5.3 (6.45, 4.0, radius 0.091) lands on the final O of the TEMPO silk label (x 5.63 to 6.57, z 3.87 to 4.03 with the stage 1 fitting). Options for the owner: (a) no screws (current); (b) three screws; (c) move the TEMPO label (0.15 units back, or left aligned) and place the four. The caps mesh takes them at no draw-call cost.
53. Section framing keeps the LCD 16 px clear of the panel (3.3 as implemented): the gutter alone (304 or 200 px) put the LCD 18 px under the panel at 1280 and 93 px at 1024 (the spec checked 1440). The offset is a frustum shift, which also avoids the inverted sign of 3.3. The machine is smaller when a section is open (s 53.4 at 1440, 44.3 at 1280, 32.8 at 1024) and the plateau's empty corner may pass under the panel (43 px at 1440).
54. SoundCloud: engine.ts is the spec's (v2 provider, v3 mock in DEV); the stage brief's "soundcloud.ts with scPlay, setScHandlers, playGen" is the bridge of 8.4 as implemented: the widget calls stay in the reused v2 provider and src/utils/scWidget.ts, which need no change. RUN while a track is LOADING does not cancel it (the v2 toggle would resume it, and its close() leaves a race where a late widget callback starts the sound with no state): the track starts and stops the sequencer, which is the brief's rule. No row was clicked during the build (owner rule); the coupling was verified with `__v4.sc.simulate()` (a fake engine, no v2 engine, no widget) and the rows' React props.
55. SHOWS reads /events.json at mount, not at first open (7.2 said 'shows' triggers the fetch): the dates must be in the DOM at load. One request per page (cached; a failed request leaves the next mount free to retry); 12 entries, one upcoming at 2026-09-28 (16 Oct 2026).
56. Active and hovered knobs: "tourne de 30 degres vers la droite" is -30 deg about +y (clockwise seen from above); the white mark then points back-right. A hovered knob's ring turns yellowHi; the active knob keeps its yellow ring (its LED says it is active).
57. Mobile sheet additions: the tab strip scrolls the active tab into view and fades at the edge that hides tabs (the five names need about 400 px, the strip has about 330 beside the close button); the section h2 stays at the top of the scrolling body rather than in the header. The edge fade is removed at the review pass (a gradient over text, item 100).
58. The fallback page renders the six sections expanded with the same components (tracks playable through the engine), so a failed WebGL page already carries the whole content; its static SVG machine is still to come.
59. Build: Rollup groups the modules imported by both /v3 and /v4 (src/v3/data/beads.ts, src/v3/engine/MockEngine.tsx) with three in the shared chunk it names three.module-*.js: 146.12 kB gzip instead of 143.11; /v3 loads the same code as before, now from that chunk. MockEngine is a dead branch in production for both (about 1 kB gzip).
60. Stage 4 numbers. Draw calls desktop 14 (unchanged: the new knobs and LEDs are instances of existing meshes), mobile 12; triangles desktop 12648 (stage 3: 6624; seven knobs x (140 body + 92 cap + 480 ring) in the main pass plus 140 per body in the shadow pass, five LEDs x 12), mobile 9644; frames at rest 0; opening a section on desktop renders 22 frames (the 400 ms reframing), then 0; reduced motion 1 frame. GPU memory after unmount 0 geometries, 0 textures. Build (vite gzip): v4 chunk index-*.js 90.93 kB raw / 32.30 kB gzip (gzip -c 32141 B; stage 3: 23.87), v4 CSS 13.54 / 3.34 kB, three chunk 146.12 kB gzip, shared data chunks mixtapes 1.82, contacts 3.50, AudioPlayerContext 1.30: critical path 187.3 kB gzip, 290.6 kB with the lazy LTC chunk (101.30 kB, item 10).
61. Debug additions from stage 4: 15.2 as implemented.
62. Acceptance 2 check value: pad-BD to knob-contact top centres measure 541.4 px at 1440 x 900, which is what the projection gives for the hotspots' top centres (pad y 0.35, knob y 0.54): 7.841 units x 69.063 px. The 546 px of acceptance 2 used other heights; the check should read 541.5 +/- 3 px.

### Stage 5 (LCD, OPEN, PCB, explode): deviations and notes

63. Scope of this stage in the six-stage plan: scene/screen.ts (the LCD mesh on state/lcd.ts) and its twin ui/Lcd.tsx, the OPEN button (instance 18) and its silk label, scene/pcb.ts, scene/explode.ts, state/explode.ts, the socle connectors and mention, the chips and STUDIO (the section built at stage 4), the twin layer for OPEN and the chips, key O, Escape for the exploded view. Not in this stage: the twins of the other hotspots, keys A S D F and Space, the intro, the StaticMachine SVG of the fallback, the hardening checklist and the session report.
64. OWNER CHECK, tilt direction: the plateau tilts -12 deg (front edge up, a lid being lifted), not +12 (front edge down, toward the camera) as 12.1 said. Measured on the real geometry: at +12 the lifted plateau hides 53 % of the board and the three chips of 5.6 (worst margins -1.6 to -2.5 units), and even a chip row at the very front of the board is covered at the extreme parallax; at -12 78 % of the board shows (68 % at the worst parallax) and the stack is 12.1 units tall instead of 14.8 (less zoom-out on desktop). Cost: while open, the plateau's top face is seen flatter (its projected depth drops to 62 % of the closed view, where +12 would enlarge it to 133 %). The brief only says "s'incline de 12 degres"; flipping is one sign in theme.ts `EXPLODE.tiltDeg`, but the chips and the PCB silk would then have to move again.
65. Chips moved from z -0.4 to z 1.7 and spread to the right (LABEL x -2.8, LIVE 0.6, STUDIO 4.0) so they stay visible under the lifted plateau over the whole parallax range (grid search on the projected silhouettes, worst margin 0.25 units, 1.0 at rest); the other components moved to the visible front band and right strip where they read, the rest under the plateau (5.6 as implemented).
66. PCB components are ONE merged mesh (the 4.6 plan), not "InstancedMesh groups" (stage brief): each family (chips with legs, small chips, capacitors, coin cell, resistors, crystals) is a template placed by a list of transforms, instanced on the CPU and merged, because one InstancedMesh per family (six draws) would put the phone at 21 calls exploded against a budget of 16. Exploded: 18 calls desktop, 16 mobile.
67. PCB silk placement: MAUDITE MACHINE along the front edge instead of the back-left (the back-left of the board is under the lifted plateau), the other texts where they can be seen (5.7 as implemented). MONTPELLIER is printed (item 1 still open: one line in theme.ts `PCB_SILK`).
68. Explode framing recomputed for the -12 tilt (3.4 as implemented): hw max(current, 7.03 x aspect) and a 0.74 unit view shift instead of 8.47 x aspect and +2.0 of target height.
69. LCD texture with mipmaps and anisotropy (4.5 said LinearFilter, no mipmaps): the plane is seen at a grazing angle and is 74 px wide on the phone.
70. The PCB neither casts nor receives shadows: under the lifted plateau the key light's shadow (displaced about 3 units back from the plateau) would cover the whole visible band of the board and turn it black.
71. During the opening the chips answer the pointer only once the plateau is 85 % up (about 570 ms after OPEN, `EXPLODE.chipsFrom`), not from t = 0 (7.2): hidden under the plateau at first, their silhouettes could catch taps meant for the front of the TOM and CH pads. Their twins exist from "opening" (keyboard); the chips are disabled from the start of "closing".
72. A chip tapped on the canvas activates its twin (`element.click()` inside the pointerup handler, which carries the user activation): LABEL and LIVE are real anchors, so the new tab and the navigation are the browser's own and identical for pointer, keyboard and screen reader; `chipAction()` (window.open, location.assign, STUDIO section) is the fallback when no twin is mounted. Verified without opening anything: a capturing click listener recorded then cancelled the anchor activations (LABEL https://vrstlrecords.com target _blank rel noopener, LIVE /techrider) on desktop (mouse) and on 390 x 844 (touch); STUDIO opened its panel (desktop) and its sheet (phone, focus on the close button); the LCD read STUDIO.
73. Twins: this stage adds the twin layer with OPEN and the three chips only; the other 30 hotspots have no twin until the accessibility stage (Tab reaches OPEN, then the chips when open; a pointer activation does not move the focus yet). The LCD twin leaves the ticking timecode out.
74. Acceptance 3: `__v4.hotspots` always lists 34 entries (the chips are listed while closed, `enabled: false`), not 34 closed and 37 open; the LCD has no hotspot.
75. PCB colours calibrated on the displayed image at 1440 x 900, like `LIT`: the board is painted per channel (1.47, 1.94, 2.57) because the warm key light eats its blue (one x 3 gain rendered 26,63,32, too bright and yellow-green; now 12 to 18, 42 to 47, 27 to 28 for #12301F 18,48,31, the spread coming from the yellow rim light on the left), copper x 1.4 renders 183,117,51 for #B8763A, the parts as in 5.6 as implemented. If the lights change, recalibrate.
76. Additions: the three clickable chips carry a yellow pin-1 dot and a yellow footprint frame (the OPEN frame's code: yellow means it can be pressed), and a hovered chip rises by 0.06 in 150 ms like a hovered knob (instant under reduced motion); the socle's jacks have a dark hole.
77. STUDIO list: "SSL 2+" (the product's name, stage 4 data.ts `STUDIO_GEAR`) where the brief writes "SSL2+".
78. Stage 5 numbers. Draw calls (renderer.info, shadow pass included): desktop closed 16 (main 12: plateau, silk, socle, shadow plane, pads, buttons, LEDs, knob bodies, caps, rings, LCD, mention; shadow 4), exploded 18 (+ board, parts); mobile 14 / 16. Triangles: desktop 13,244 / 15,140; mobile 9,960 / 11,648. Programs 13; mounted memory 14 geometries, 9 textures (desktop); after unmount 0 / 0. Frames: 0 at rest, closed and open; OPEN 56 frames over 1060 ms; reduced motion 1. Frame cost with a forced GPU sync (readPixels) at 2880 x 1800 device pixels: median 1.7 ms closed, 1.6 ms open. Build (vite gzip): v4 chunk index-*.js 114.20 kB raw / 40.07 kB gzip (gzip -c 39,870 B; stage 4: 32.30), v4 CSS 13.92 kB raw / 3.39 kB gzip (gzip -c 3,416 B), three chunk 146.12 kB gzip unchanged, lazy LTC chunk 101.30 kB gzip: /v4 critical path 195.1 kB gzip (gzip -c sum 195,075 B), 298.4 kB with the LTC chunk (item 10).
79. Debug additions from stage 5: 15.2 as implemented.

### Stage 6 (accessibility, fallback, performance pass): deviations and notes

80. Budget, owner decision of item 10 closed by the budget rule ("if above, cut imports and features until it fits"): the RectAreaLight and its LTC tables are cut, nothing else. /v4 went from 298.4 kB gzip (stage 5, with the lazy LTC chunk) to 199.3 kB gzip, three included (14.3 as measured); the first frame no longer waits for a 101 kB download. The warm rim is kept by a yellow PointLight fitted on the old render (4.2 as implemented): mean error 0.2 levels, the left edge reproduced. Cut list, in full: RectAreaLight, `RectAreaLightUniformsLib.init()`, the lazy RectAreaLightUniformsLib chunk, the late-rim async compile path. The trace dot, the knob hover, the connectors, the PCB variety, the intro LED test and the parallax (section 17's cut list) are all kept.
81. Pointer activation and focus (6.3 said a pointer activation focuses its twin): not done, on purpose. With that rule, clicking a pad then pressing Space would have replayed the pad (Space activates the focused button natively), while the brief makes Space RUN/STOP. Now a pointerdown on the hit layer blurs a focused twin and focuses nothing: after a click Space is RUN/STOP; a keyboard user who Tabs keeps the native activation of the focused twin. To restore the spec's rule, focus the twin in `fire()` and accept that Space then activates it.
82. Twins, choices within 6.3: TEMPO, TONE and LEVEL are `role="slider"` divs (aria-orientation vertical, valuetext "130 BPM" and "80 %"); the knob twins carry aria-controls to their section; a held Enter does not repeat a twin; the twin group is labelled "MM-808 drum machine". The step twins stay focusable on the phone (6.4) although the Dock duplicates them there; hiding them from assistive technology on the mobile layout would shorten the Tab path by 16 stops (one attribute in Twins) if the owner prefers.
83. Keys, choices within 7.2 and 13: Space is left to any control that owns it (buttons, links, sliders, fields), not only twins, so Space still activates a panel row or a Dock cell that has the focus; digits also match the physical keys (AZERTY); the machine keys are off on the fallback page (Escape stays). A S D F on a focused panel link still play a pad (global shortcuts), as the spec's guards allow.
84. Intro (7.4 as implemented): the machine rise and the LED test, no LCD sequence (the LCD already reads MM-808 / READY); the first gesture finishes it before the gesture is handled.
85. Fallback (11.5 as implemented): StaticMachine drawn from the theme constants, sober, no animation, no technical message; the error boundary now also covers every HTML control of the WebGL page.
86. Performance pass: the HitMap signature, read by the twins after every rendered frame, is now compared and written in place (no array and no Set allocated per frame); the Stage passes one size object to it. Twins write their styles only when the projected list changed. Measured costs: `hit.list()` without change 0.009 ms, a full reprojection of the 34 hotspots 1.3 ms (only on frames where something moved).
87. Environment (unchanged from stages 1 to 5): the preview pane is hidden, so each load gets the shim (visibilityState 'visible', rAF on a 16 ms timer, a visibilitychange event) and `__v4.stage.onLayout()` / `onResize()` after a resize; real clicks and key presses come from the preview tool (they carry user activation, so the muted AudioContext runs), everything else from `__v4` and the DOM. Real rAF, ResizeObserver, IntersectionObserver and matchMedia events are still not observed end to end; the IntersectionObserver path was driven through `stage.onIntersect`. The console errors listed by the tool before the first marker of the session came from hot reloads during the edit (old module versions); none after it.
88. Stage 6 numbers: draw calls desktop 16 / 18, mobile 14 / 16; triangles desktop 13,244 / 15,140, mobile 9,960 / 11,648; frames 35 to 38 from mount to rest (intro), 0 at rest over 2 s; reduced motion 0 at mount, 1 frame for OPEN, 1.5 frames per step while running; frame cost 1.1 to 1.3 ms (2880 x 1800); build: v4 chunk 125.50 kB raw / 43.91 kB gzip (stage 5: 114.20 / 40.07), v4 CSS 14.26 / 3.45 kB, three chunk 568.37 / 145.34 kB, AudioPlayerContext 1.30, contacts 3.50, mixtapes 1.82: 199.3 kB gzip (198,132 bytes by gzip -c).
89. Still open for the owner (unchanged by this stage): item 1 (MONTPELLIER on the PCB silk), items 2 to 9, item 16 (shadow hidden behind the machine with the specified key light), 17 (parallax settle 1.35 s for a full jump), 42 (CLEAR and TEMPO 29 px apart on the phone), 49 (trace under reduced motion drawn at once), 52 (screws not placed), 64 (tilt -12 deg), 77 (SSL 2+). If the owner moves the key light (item 16), re-fit the rim (item 80) and recalibrate PAD_GLOW, LIT and the PCB colours by pixel read-back.
90. Left to the main session: the session report in docs/reports/ (project CLAUDE.md rule; outside the builders' write scope), the commit of src/v4, docs/v4, src/App.tsx and dist/ (rebuilt by `npm run build`, 72 dist entries in git status).

### Review pass (37 findings): fixes, skips and owner questions

91. Scope. The review listed 37 findings (11 major, 26 minor, the last one a measurement report; findings 2 and 17, and 16 and 29, are duplicates). Every major and every minor that was cheap and safe is fixed; two minors are skipped with their reason (items 112 and 113); four points are left as owner questions (items 104 to 106 and 114). Write scope unchanged (src/v4, docs/v4); git untouched. Checked in the preview pane with ?debug=1&mute=1 only (master gain 0 throughout), at 1440 x 900, 390 x 844 and the wide sizes of item 108; no SoundCloud row was clicked (the row handler was exercised on the fake engine of `__v4.sc.simulate()`); links were never followed (a capturing listener cancelled them).
92. STOP cancels the pending hits (finding 1, section 9 as implemented): before, STOP left up to 100 ms of scheduled voices playing, so STOP then RUN inside the lookahead flammed and a starting SoundCloud track got drums over its first notes. drums.ts `trigger(..., out)` hands the clock a `Voice` record, `cancelVoice()` stops its sources at 0 and disconnects its nodes. Measured: a pending BD cancelled 21 ms after RUN, 0.000 at the analyser for the next 160 ms, the next RUN's BD at +64 ms (peak 0.60).
93. The runtime fallback stops the sequencer (findings 2 and 17): a context loss or a frame or render error showed the fallback page (no RUN/STOP, no Space) with the clock still running, and the next tap anywhere resumed the AudioContext and the loop. Now onContextLost stops the clock before switching, and an effect locks it while gl is 'fallback' (`clock.lock`, RUN refused). Measured with WEBGL_lose_context: running 1 -> 0, pending 0, locked, `clock.start()` refused; a real tap on the fallback page resumed the context and the analyser stayed at 0.000 over 600 ms; restoreContext brought the machine, the 31 twins and RUN back.
94. suspend and resume race (finding 3): the last request wins (section 8.3 as implemented).
95. No hotspot reprojection per frame (findings 4 and 21, sections 6.3, 11.2 and 14.1 as implemented): twins placed at rest (or the focused one per frame), the trace on two projected points with the panel box read outside the frame path, `onView` listeners in an array, `onIdle` added, no closure per explode frame. Measured: a 68-frame parallax move went from 68 reprojections and 68 placement passes to 1 and 1; a TRACKS opening read the panel box twice in 21 frames.
96. Quality tier by device class (finding 5, section 4.1 as implemented): `mobile` = narrow layout OR coarse pointer, so a phone in landscape or a tablet stays within the 16-call budget (14 / 16 measured with the coarse query forced at 1440 x 900). Item 19 (tier fixed at creation) still holds: a desktop window resized under 768 px keeps its creation tier.
97. Small scene fixes: `Pcb.setRise` no longer clears the other chip's pending GPU range (finding 6: two chips changed before an upload keep two ranges, three merges them); a `(resolution: N dppx)` listener re-applies the DPR when a window changes screen (finding 7: forcing devicePixelRatio 1 then 2 gave a 1440 x 900 then 2880 x 1800 buffer); the Screen subscribes to state/lcd.ts only once the Stage's GL work succeeded (finding 18: with the PCB's 2d context forced to fail, the page fell back, no canvas stayed and 0 LCD subscriptions were left, where the dead Screen used to stay subscribed).
98. A frame or React render error disposes the Stage (finding 8): `glFailed` is part of the Stage effect, so the WebGL context, 14 geometries, 9 textures, observers and subscriptions are released; a context loss keeps the Stage (it can be restored) and a creation failure has nothing to release. Measured with an animator that throws: fallback, clock stopped and locked, `__v4.stage` null, `__v4LastDispose` 0 / 0, no canvas.
99. Colours and materials brought back to the brief (findings 9, 25, 26, 27): metal caps at roughness 0.55 with `LIT.cap` x 0.86 (145,142,138 displayed, as before); the four silk step numbers at bone 70 % (were 45 %; the fallback SVG reads the same entries); the PCB silk and footprint outlines in bone 90 % instead of pure white (a text pixel over the board now reads 224,224,214, bone over #12301F). The unlit materials are item 105.
100. Accessibility and colour rules in the HTML (findings 10, 11, 16, 29): Dock cells at 4.5:1 or more (section 11.4 as implemented), the tab focus ring drawn inside the tab, no gradient mask over the tab labels (the brief: "pas de degrade sur du texte"; the `data-start` / `data-end` markers that drove it are gone from Panel.tsx).
101. Phone transport at 48 px (findings 32 and 33, closes item 42): the Dock carries RUN, CLEAR, OPEN and the tempo (section 11.4 as implemented). The 3D transport stays as it was (48 x 48 target rects resolved by nearest centre), decorative plus nearest-centre on the phone.
102. Keyboard (findings 12, 13, 14): Space activates the LABEL and LIVE chip links, Space on a slider twin is RUN/STOP, RUN and OPEN twins keep a fixed name with aria-pressed (sections 6.3 and 13 as implemented).
103. MONTPELLIER removed from the PCB silk (finding 30, closes item 1): the brief lists it, but the owner's site rule of commit 1e6cf7f ("les textes du site n'annoncent plus de lieu du tout", with three stated exceptions that do not include this one) is later and site-wide. The router's obstacles changed with it: 24 traces, 169 grid segments on desktop (162 on the phone), 68 pads (the desktop read 175 segments before). One line restores it (comment above theme.ts `PCB_SILK`).
104. OWNER QUESTION, machine width on 1080p screens (finding 24): the 86 % height guard applies above aspect 1.82, which covers most 1080p browser viewports (1920 x 950: 70 % of the width instead of the brief's 78 %; 71 % at 1920 x 960 and 2560 x 1300). Section 3.2 had the rule the wrong way round; fixed. Options: (a) keep (the machine is never cut and keeps the explode headroom); (b) loosen `FIT_H` (0.9) or raise the frame target, the socle then comes closer to the canvas edges and the explode framing must be rechecked (item 108).
105. OWNER QUESTION, unlit materials (finding 25): the knob rings, the LEDs, the LCD and the socle mention are `MeshBasicMaterial` (toneMapped false) so they show their exact tokens, against "MeshStandardMaterial uniquement". Options: (a) keep (deliberate, recorded here); (b) MeshStandardMaterial with color black and emissive = token, toneMapped false (same draw calls; the LEDs and rings would need the instanceEmissive patch, and a lit black surface still takes a specular highlight).
106. Robots (finding 28): /v4 no longer sets `noindex, nofollow`; the page keeps index.html's "index, follow", because the brief wants the panel HTML "selectionnable, copiable, indexable" and only asks that /v4 stay out of the sitemap (it does: scripts/generate-sitemap.mjs untouched). /v3's experiment convention (noindex) is not copied. To keep /v4 out of search engines instead, restore the robots block of `usePageChrome` (index.tsx).
107. Visible shadow (finding 31, closes item 16 without moving the light): the contact shadow in the shadow plane's shader (section 4.3 as implemented), because moving the key light to (-6, 14, 8) would change which faces are lit and every read-back calibration (ALBEDO_GAIN, PAD_GLOW, LIT, the PCB, the rim fit). No extra draw call, so the mobile exploded view stays at 16.
108. CLOSE framing (finding 22, sections 3.4 and 12.3 as implemented): the framing follows max(plateau, socle); no clipping over the whole CLOSE timeline at 1440 x 900, 1440 x 789, 1920 x 960 and 2560 x 1300 (extreme parallax).
109. Selectable rows (finding 23, section 11.1 as implemented): title and meta are plain text over a stretched button; click anywhere plays, except a click that ends a selection.
110. Small React fixes (findings 15, 19, 20): SHOWS shows its link while loading and gives up after 5 s; the Dock is mounted on the mobile layout only; `useMedia` subscribes once per query (0 MediaQueryList add or remove over 7 re-renders of V4Shell, was 1 each per render).
111. First sound at about 50 ms on the first gesture of a page (finding 34): accepted and documented (item 28: audio device start plus the compressor's 6 ms lookahead). The alternative (route the first hit around the compressor) would change that hit's level for a one-time 6 ms. Measured this pass: 11.1 ms for the first pad hit of a page in the preview pane, 10.1 ms for the next (peak 0.598).
112. SKIPPED, phone layout bands (finding 35): the machine uses 204 px of the 464 px canvas on the 390 x 844 phone. The fixes offered shrink the canvas (about 242 px) or re-anchor the framing: the first breaks the brief's split ("la machine occupe les 55 % du haut, le contenu les 45 % du bas") and, under 0.645 x the width, the height guard would shrink the machine and bring adjacent pads under 48 px apart (rule 5); the second only moves the empty band. The new transport row makes the Dock taller (content from y 535 to 774), which already shortens the gap under the machine. Owner decision if the split itself should change.
113. SKIPPED, social initials (finding 36): Hypeddit, Songkick, Gigmit and Beatport keep their initial in a bone ring. It is the main site's own convention for these four (src/v2/components/SocialLinks.tsx, read-only: "les marques absentes de Font Awesome ... ont une pastille initiale"), spec 11.1 specifies it, the brief asks for monochrome bone icons, which it is, and the repo has no licensed path for these marks (drawing brand logos from memory would misrepresent them; a neutral link glyph would make the four identical).
114. OWNER NOTE (finding 37): the LIVE chip navigates the same tab to /techrider, which unmounts the machine and stops a running pattern; LABEL opens VRSTL Records in a new tab. Confirm, or give LIVE target _blank as well (one field in theme.ts `CHIPS`).
115. Review pass numbers: build exit 0, /v4 199.7 kB gzip with three (14.3 as measured, review pass); draw calls 16 / 18 desktop, 14 / 16 mobile; triangles unchanged; 0 frames at rest; greps for em dash, en dash, emoji and non-ASCII on src/v4, docs/v4 and src/App.tsx print nothing.
116. Still open for the owner after the review pass: items 2 to 9, 17, 49, 52, 64, 77 (unchanged), 104, 105, 106 (decided toward the brief, reversible), 112, 114. Items 1 (MONTPELLIER), 16 (shadow) and 42 (phone transport) are closed.
