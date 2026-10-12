/* MASSIF — massif-fast-gl.js (page-speed version): the page's 3D, run in a module Web Worker on an
   OffscreenCanvas so the visitor's main thread never builds or draws it.

   Everything between the two "verbatim" markers below is massif-scene.js's own "THE 3D" part, byte for
   byte (from the "THE 3D" banner through `applyState(0, 0)` / `loop()`): the same three.js r165, maquette,
   crane, choreography, drawing/scan, sparks, beacons, telemetry, annotations, lights, camera, the act-two
   aggregate and the render loop. Only what that code reads from the page is stood in for, above it:
     - document.getElementById('scene') is the page's #scene canvas, transferred as an OffscreenCanvas;
     - document.createElement('canvas') is an OffscreenCanvas (the site grid and the crane's name board);
     - the page's two Google fonts (Archivo, JetBrains Mono) are added to this worker as FontFace, from the
       page's own @font-face rules (same files), so the grid letters and the board are drawn in the same faces;
     - the telemetry panel, the annotations and their fades are stand-in elements: every write the code
       makes to them (textContent, style, classList.toggle) is batched and posted back each frame, and the
       page applies it to the real elements (massif-fast.js);
     - innerWidth/innerHeight/devicePixelRatio, 'resize' and 'pointermove' come from the page;
     - requestAnimationFrame(loop) runs the loop once per frame the page posts. Each frame carries what the
       page's scroll code drives (S.target, S.intro, S.act, ACT2.g/i, SCAN.h, CLAD.v, sceneAlpha, lenis);
       act two's toggle runs the same statements the original onToggle ran on the model.
   The three addons import bare 'three' (a worker has no import map), so they are fetched and that one
   specifier is pointed at the same three.module.js URL before they are imported. */
const post = (m, tr) => self.postMessage(m, tr || [])
;(function caps(){
  let ok = typeof OffscreenCanvas === 'function' && typeof FontFace === 'function' && !!self.fonts && typeof fetch === 'function'
  if (ok){
    try {
      const g = new OffscreenCanvas(1, 1).getContext('webgl2'); ok = !!g
      const lc = g && g.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext()
      ok = ok && !!new OffscreenCanvas(1, 1).getContext('2d')
    } catch (e) { ok = false }
  }
  post({ t: 'caps', ok })
})()

let A = null, api = null, last = null
const early = []
self.onmessage = e => {
  const m = e.data
  if (m.t === 'init'){ A = m; start(); return }
  if (!api){ if (m.t === 'f') last = m; else early.push(m); return }
  api.msg(m)
}
const fail = e => post({ t: 'fail', e: String(e && (e.stack || e.message) || e).slice(0, 600) })

async function addon(url){
  const src = await (await fetch(url)).text()
  const blob = new Blob([src.replace(/from\s*(['"])three\1/g, "from '" + A.three + "'")], { type: 'text/javascript' })
  const u = URL.createObjectURL(blob)
  try { return await import(u) } finally { URL.revokeObjectURL(u) }
}
/* the page's Google Fonts stylesheet(s), as FontFace in this worker */
async function fonts(){
  const rules = []
  await Promise.all((A.fontCss || []).map(async href => {
    try {
      const css = await (await fetch(href)).text()
      for (const b of css.match(/@font-face\s*{[^}]*}/g) || []){
        const get = k => { const m = b.match(new RegExp(k + '\\s*:\\s*([^;]+);')); return m && m[1].trim() }
        const fam = (get('font-family') || '').replace(/^['"]|['"]$/g, '')
        const src = get('src')
        if (!fam || !src) continue
        rules.push(new FontFace(fam, src, { style: get('font-style') || 'normal', weight: get('font-weight') || '400',
          stretch: get('font-stretch') || 'normal', unicodeRange: get('unicode-range') || 'U+0-10FFFF', display: get('font-display') || 'swap' }))
      }
    } catch (e) {}
  }))
  for (const f of A.fontFaces || []){
    try { rules.push(new FontFace(f.family, f.src, { style: f.style, weight: f.weight, stretch: f.stretch, unicodeRange: f.range, display: 'swap' })) } catch (e) {}
  }
  rules.forEach(f => self.fonts.add(f))
  const want = Promise.all([self.fonts.load('900 104px Archivo', 'MASSIF'),
                            self.fonts.load('600 22px "JetBrains Mono"', 'ABCDEFGHI12345678')]).catch(() => {})
  await Promise.race([want, new Promise(r => setTimeout(r, 4000))])
}
async function start(){
  try {
    const [THREE, env, utils, gpgpu] = await Promise.all([import(A.three), addon(A.addons.env), addon(A.addons.utils), addon(A.addons.gpgpu), fonts()])
    api = build(THREE, env.RoomEnvironment, utils.mergeGeometries, gpgpu.GPUComputationRenderer)
  } catch (e) { fail(e); return }
  early.splice(0).forEach(m => api.msg(m))
  api.ready()
  if (last) api.msg(last)
}

function build(THREE, RoomEnvironment, mergeGeometries, GPUComputationRenderer){
  let innerWidth = A.w, innerHeight = A.h
  const devicePixelRatio = A.dpr
  const on = {}
  const addEventListener = (t, f) => { (on[t] = on[t] || []).push(f) }
  let next = null
  const requestAnimationFrame = cb => { next = cb; return 1 }
  const ScrollTrigger = { refresh(){} }                      /* the page refreshes its own triggers */
  const ops = []
  const stand = (id, dataset) => ({
    dataset: dataset || {},
    style: new Proxy({}, { set(o, k, v){ o[k] = v; ops.push([id, 's', k, v]); return true } }),
    set textContent(v){ ops.push([id, 't', v]) },
    classList: { toggle(c, f){ ops.push([id, 'c', c, f]); return f } },
  })
  const document = {
    getElementById: id => id === 'scene' ? A.canvas : null,
    createElement: () => new OffscreenCanvas(300, 150),
    querySelector: s => A.q[s] == null ? null : stand(A.q[s]),
    querySelectorAll: s => (A.qa[s] || []).map(([id, ds]) => stand(id, ds)),
    fonts: self.fonts,
  }
/* ─────────────── massif-scene.js, verbatim from here ─────────────── */
/* ══════════════════════════════════════════════════════════════════
   THE 3D — a construction site, modelled and lit as a maquette.

   An architect's model rather than a photoreal render: white concrete,
   a safety-orange tower crane, glass on the lower floors, soft studio
   light from a room environment and one sun casting soft shadows. The
   maquette register is deliberate — it suits the paper palette, and a
   procedural model reads as considered in that register, where the
   same geometry pushed toward photoreal reads as a game asset.

   Scroll drives one value, p (0 → 3), across the pinned hero:
     act 0  the site, core started
     act 1  the frame rises floor by floor
     act 2  the crane picks a steel beam off the laydown and sets it
            on the roof
     act 3  topped out, a low wide hero shot
   ══════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(0x000000, 0)             // the page itself is the backdrop
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping  // keeps the whites white
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.localClippingEnabled = true

const scene = new THREE.Scene()
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.42

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 1, 1400)

/* ── materials ─────────────────────────────────────────────────── */
const M = {
  white:    new THREE.MeshStandardMaterial({ color: 0xF8F5EF, roughness: 0.8 }),
  pad:      new THREE.MeshStandardMaterial({ color: 0xE9E4DA, roughness: 0.92 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xEAE5DB, roughness: 0.88 }),
  core:     new THREE.MeshStandardMaterial({ color: 0xD9D3C7, roughness: 0.94 }),
  paint:    new THREE.MeshStandardMaterial({ color: 0xF2541B, roughness: 0.44, metalness: 0.2 }),
  steel:    new THREE.MeshStandardMaterial({ color: 0x3A3936, roughness: 0.46, metalness: 0.72 }),
  galv:     new THREE.MeshStandardMaterial({ color: 0xB4B3AE, roughness: 0.4, metalness: 0.8 }),
  glass:    new THREE.MeshStandardMaterial({ color: 0x8C9EA8, roughness: 0.1, metalness: 0.55 }),
  ballast:  new THREE.MeshStandardMaterial({ color: 0xC3BDB1, roughness: 0.96 }),
  timber:   new THREE.MeshStandardMaterial({ color: 0xCDAB7C, roughness: 0.86 }),
  cable:    new THREE.MeshStandardMaterial({ color: 0x23221F, roughness: 0.36, metalness: 0.84 }),
  hook:     new THREE.MeshStandardMaterial({ color: 0xF2B51C, roughness: 0.42, metalness: 0.24 }),
  cabin:    new THREE.MeshStandardMaterial({ color: 0xEEEBE5, roughness: 0.66 }),
  tree:     new THREE.MeshStandardMaterial({ color: 0xE2DED5, roughness: 0.9, flatShading: true }),
  figure:   new THREE.MeshStandardMaterial({ color: 0xD4CFC4, roughness: 0.85 }),
}

/* ── geometry helpers ──────────────────────────────────────────────
   Every member is placed between two points and then merged per
   material, so a lattice of hundreds of members is one draw call. */
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const UP = V(0, 1, 0)
function orient(g, a, b){
  const d = b.clone().sub(a)
  g.applyMatrix4(new THREE.Matrix4().compose(
    a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
    V(1, 1, 1)))
  return g
}
const strut = (a, b, t) => orient(new THREE.BoxGeometry(t, a.distanceTo(b), t), a, b)
const rod   = (a, b, r) => orient(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8, 1), a, b)
const box   = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
function merged(list, mat, cast = true){
  const m = new THREE.Mesh(mergeGeometries(list, false), mat)
  m.castShadow = cast; m.receiveShadow = true
  return m
}

const clamp01 = x => Math.min(1, Math.max(0, x))
const ss   = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t
const lerpAng = (a, b, t) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t }

const site = new THREE.Group()
scene.add(site)

/* ── the plinth ────────────────────────────────────────────────────
   A white disc, like the base of a presentation model. Below it, a
   ShadowMaterial plane that is invisible except where a shadow falls,
   so the model's shadow lands on the page itself rather than on a
   rectangle that has to be colour-matched to it. */
{
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
    new THREE.ShadowMaterial({ opacity: 0.2 }))
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -1.62; catcher.receiveShadow = true
  site.add(catcher)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(40, 40.9, 1.6, 144), M.white)
  plinth.position.y = -0.8; plinth.castShadow = true; plinth.receiveShadow = true
  site.add(plinth)
  /* hardstanding, with the setting-out grid drawn on it the way a site
     plan draws it: a faint line every metre, an orange axis every five,
     lettered one way and numbered the other */
  const gc = document.createElement('canvas'); gc.width = 1880; gc.height = 1480
  const gx = gc.getContext('2d'), PPM = 40
  gx.fillStyle = '#E9E4DA'; gx.fillRect(0, 0, gc.width, gc.height)
  const grid = (count, vertical) => {
    for (let m = 0; m <= count; m++){
      const major = m % 5 === 0
      gx.strokeStyle = major ? 'rgba(255,77,20,.34)' : 'rgba(18,17,16,.055)'
      gx.lineWidth = major ? 2.2 : 1
      gx.beginPath()
      if (vertical){ gx.moveTo(m * PPM, 0); gx.lineTo(m * PPM, gc.height) }
      else         { gx.moveTo(0, m * PPM); gx.lineTo(gc.width, m * PPM) }
      gx.stroke()
    }
  }
  grid(47, true); grid(37, false)
  gx.fillStyle = 'rgba(255,77,20,.85)'; gx.font = '600 22px "JetBrains Mono", monospace'
  for (let m = 5, i = 0; m < 47; m += 5, i++) gx.fillText('ABCDEFGHI'[i], m * PPM + 6, 26)
  for (let m = 5, i = 1; m < 37; m += 5, i++) gx.fillText(String(i), 8, m * PPM - 6)
  const gt = new THREE.CanvasTexture(gc)
  gt.colorSpace = THREE.SRGBColorSpace
  gt.anisotropy = renderer.capabilities.getMaxAnisotropy()
  M.padGrid = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.92 })
  const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(47, 37), M.padGrid)
  padMesh.rotation.x = -Math.PI / 2; padMesh.position.set(-1, 0.04, 3); padMesh.receiveShadow = true
  site.add(padMesh)
}

/* ══ the building ══════════════════════════════════════════════════ */
const B = { x: -8, z: 2, W: 17, D: 13, FH: 3.4, N: 11 }
const ROOF_Y = B.N * B.FH
const building = new THREE.Group()
building.position.set(B.x, 0, B.z)
site.add(building)

const COL_X = [-B.W / 2, -B.W / 4, 0, B.W / 4, B.W / 2]
const COL_Z = [-B.D / 2, -B.D / 6, B.D / 6, B.D / 2]
const onEdge = (x, z) => Math.abs(x) === B.W / 2 || Math.abs(z) === B.D / 2

/* One group per floor, geometry built from the floor's own base — but
   split into the three things that actually happen at different times:
   the columns climb out of the deck below, the deck is then poured
   across them, and the cladding goes on behind that. Scaling a floor as
   one mesh is what made the old frame look like it was being extruded
   rather than built. */
const floors = []
for (let i = 0; i < B.N; i++){
  const g = new THREE.Group()
  g.position.y = i * B.FH
  const h = B.FH - 0.34
  const conc = [], glass = [], mull = []
  for (const x of COL_X) for (const z of COL_Z)
    if (onEdge(x, z)) conc.push(box(0.56, h, 0.56, x, h / 2, z))
  conc.push(box(B.W + 0.9, 0.34, B.D + 0.9, 0, h + 0.17, 0))   // slab, proud of the frame
  if (true){                                                  // every floor CAN be clad; CLAD says which are
    const gh = h - 0.18, gy = gh / 2 + 0.09
    glass.push(box(B.W - 0.3, gh, 0.07, 0, gy,  B.D / 2 - 0.12))
    glass.push(box(B.W - 0.3, gh, 0.07, 0, gy, -B.D / 2 + 0.12))
    glass.push(box(0.07, gh, B.D - 0.3,  B.W / 2 - 0.12, gy, 0))
    glass.push(box(0.07, gh, B.D - 0.3, -B.W / 2 + 0.12, gy, 0))
    for (let x = -B.W / 2 + 1.42; x < B.W / 2 - 0.4; x += 1.42){
      mull.push(box(0.07, gh, 0.14, x, gy,  B.D / 2 - 0.05))
      mull.push(box(0.07, gh, 0.14, x, gy, -B.D / 2 + 0.05))
    }
    for (let z = -B.D / 2 + 1.44; z < B.D / 2 - 0.4; z += 1.44){
      mull.push(box(0.14, gh, 0.07,  B.W / 2 - 0.05, gy, z))
      mull.push(box(0.14, gh, 0.07, -B.W / 2 + 0.05, gy, z))
    }
  }
  const cols = merged(conc, M.concrete)
  g.add(cols)

  /* The deck hangs off a pivot at the west edge, so scaling the pivot in
     x sweeps the slab across the bay the way a pour actually runs —
     full thickness the whole time, never stretched. */
  const deck = new THREE.Group()
  deck.position.x = -(B.W + 0.9) / 2
  deck.add(merged([box(B.W + 0.9, 0.34, B.D + 0.9, (B.W + 0.9) / 2, h + 0.17, 0)], M.concrete))
  g.add(deck)

  let clad = null
  if (glass.length){
    clad = new THREE.Group()
    clad.add(merged(glass, M.glass), merged(mull, M.steel))
    g.add(clad)
  }
  /* the dashed drawing needs the finished floor, columns and deck both */
  g.userData = { cols, deck, clad,
    ghostGeo: mergeGeometries([...conc, box(B.W + 0.9, 0.34, B.D + 0.9, 0, h + 0.17, 0)], false) }
  building.add(g)
  floors.push(g)
}

/* the slipform core runs a floor or so ahead of the frame */
const core = merged([box(4.6, 1, 4.2, 1.6, 0.5, -1.2)], M.core)
building.add(core)

/* edge protection, starter bars and formwork: the kit that lives on
   whichever floor is currently being built, and climbs with it */
const topKit = new THREE.Group()
building.add(topKit)
{
  const rails = [], rebar = [], form = []
  const hw = B.W / 2 + 0.36, hd = B.D / 2 + 0.36
  const corners = [V(-hw, 0, -hd), V(hw, 0, -hd), V(hw, 0, hd), V(-hw, 0, hd)]
  for (let k = 0; k < 4; k++){
    const a = corners[k], b = corners[(k + 1) % 4]
    for (const yy of [0.55, 1.08]) rails.push(strut(V(a.x, yy, a.z), V(b.x, yy, b.z), 0.07))
    const n = Math.round(a.distanceTo(b) / 2.2)
    for (let s = 0; s <= n; s++){
      const q = a.clone().lerp(b, s / n)
      rails.push(box(0.08, 1.12, 0.08, q.x, 0.56, q.z))
    }
  }
  for (const x of COL_X) for (const z of COL_Z){
    if (!onEdge(x, z)) continue
    for (const dx of [-0.17, 0.17]) for (const dz of [-0.17, 0.17])
      rebar.push(rod(V(x + dx, 0, z + dz), V(x + dx, 1.4, z + dz), 0.03))
  }
  form.push(box(2.4, 0.18, 1.2, -4, 0.09, 3), box(2.4, 0.18, 1.2, -4, 0.27, 3),
            box(1.3, 1.5, 0.12, 5, 0.75, -3.4))
  topKit.add(merged(rails, M.paint), merged(rebar, M.steel), merged(form, M.timber))
}

/* Crew. Five, and no more: a figure is the one thing in a maquette that
   states the scale outright, and a crowd would turn a model into a
   diorama. Three ride the deck being worked, two the deck below, and
   both climb with the frame. They are placed in the building's own
   coordinates, so a deck top is exactly where a pair of boots goes. */
const crew = new THREE.Group(), crewBelow = new THREE.Group()
building.add(crew, crewBelow)
{
  const put = (g, spots) => g.add(
    merged(spots.map(([x, z]) => new THREE.CapsuleGeometry(0.24, 1.1, 4, 10).translate(x, 0.8, z)), M.figure),
    merged(spots.map(([x, z]) => box(0.5, 0.46, 0.5, x, 1.07, z)), M.paint))    // hi-vis, the one colour on site
  put(crew,      [[-5.2, -4.4], [2.6, 3.8], [6.4, -2.0]])
  put(crewBelow, [[-6.0, 2.4], [4.2, -5.2]])
}

/* scaffold on the west face, cut to the current height by a clipping
   plane rather than scaled — scaling would flatten the ledgers */
const scaffoldClip = new THREE.Plane(V(0, -1, 0), 0)
const scaffold = new THREE.Group()
building.add(scaffold)
{
  const tubeM = M.galv.clone(), boardM = M.timber.clone()
  for (const m of [tubeM, boardM]){ m.clippingPlanes = [scaffoldClip]; m.clipShadows = true }
  const tubes = [], boards = []
  const H = ROOF_Y + 1.4
  const x0 = -B.W / 2 - 1.0, x1 = -B.W / 2 - 2.15
  const zs = []
  for (let z = -B.D / 2; z <= B.D / 2 + 0.01; z += B.D / 6) zs.push(z)
  for (const z of zs) for (const x of [x0, x1]) tubes.push(rod(V(x, 0, z), V(x, H, z), 0.045))
  for (let y = 2; y <= H; y += 2){
    for (const x of [x0, x1]) tubes.push(rod(V(x, y, zs[0]), V(x, y, zs[zs.length - 1]), 0.04))
    for (const z of zs) tubes.push(rod(V(x0, y, z), V(x1, y, z), 0.035))
    boards.push(box(1.06, 0.06, B.D, (x0 + x1) / 2, y + 0.06, 0))
  }
  for (let i = 0; i < zs.length - 1; i++)
    for (let y = 0; y < H - 4; y += 4) tubes.push(rod(V(x1, y, zs[i]), V(x1, y + 4, zs[i + 1]), 0.035))
  scaffold.add(merged(tubes, tubeM), merged(boards, boardM))
  scaffold.userData.H = H
}

/* ══ the tower crane ═══════════════════════════════════════════════ */
const C = { x: 13, z: -4, MH: 50, S: 1.9, JL: 46, CJ: 15 }
const TROLLEY_Y = 1.3
const crane = new THREE.Group()
crane.position.set(C.x, 0, C.z)
site.add(crane)

/* footing and ballast */
crane.add(merged([box(7, 1.1, 7, 0, 0.55, 0)], M.concrete))
crane.add(merged([
  box(2.6, 1.2, 1.4, -1.8, 1.7, -2.4), box(2.6, 1.2, 1.4, 1.8, 1.7, -2.4),
  box(2.6, 1.2, 1.4, -1.8, 1.7,  2.4), box(2.6, 1.2, 1.4, 1.8, 1.7,  2.4)], M.ballast))

/* the mast: four chords, and a braced bay every couple of metres */
{
  const mast = [], h = C.S / 2, y0 = 1.1
  const n = 20, bay = (C.MH - y0) / n
  const ring = y => [V(-h, y, -h), V(h, y, -h), V(h, y, h), V(-h, y, h)]
  for (const c of ring(0)) mast.push(strut(V(c.x, y0, c.z), V(c.x, C.MH, c.z), 0.2))
  for (let i = 0; i < n; i++){
    const A = ring(y0 + i * bay), Bc = ring(y0 + (i + 1) * bay)
    for (let k = 0; k < 4; k++){
      const k2 = (k + 1) % 4
      mast.push(strut(Bc[k], Bc[k2], 0.1))
      const f = (i + k) % 2
      mast.push(strut(f ? A[k] : A[k2], f ? Bc[k2] : Bc[k], 0.085))
    }
  }
  crane.add(merged(mast, M.paint))
}

/* mast ties back to the building — only once the frame reaches them */
const ties = []
for (const ty of [15, 31]){
  const h = C.S / 2, fx = B.x + B.W / 2 + 0.5 - C.x
  const m = merged([
    strut(V(-h, ty, -h), V(fx, ty, -2.5 - C.z), 0.17),
    strut(V(-h, ty,  h), V(fx, ty, -0.5 - C.z), 0.17),
    strut(V(-h, ty, -h), V(fx, ty, -0.5 - C.z), 0.12)], M.paint)
  m.userData.y = ty
  crane.add(m); ties.push(m)
}

/* everything above the slewing ring turns together */
const slew = new THREE.Group()
slew.position.y = C.MH
crane.add(slew)

slew.add(merged([new THREE.CylinderGeometry(1.5, 1.5, 0.9, 28).translate(0, 0.45, 0)], M.steel))
slew.add(merged([box(3.6, 0.5, 3.6, 0, 1.15, 0)], M.paint))
slew.add(merged([box(2.1, 2.3, 2.0, 0.4, 1.9, 2.6)], M.cabin))                     // cab
slew.add(merged([box(0.06, 1.3, 1.7, 1.47, 2.2, 2.6), box(1.9, 1.3, 0.06, 0.4, 2.2, 3.62)], M.glass))

/* tower head */
const HEAD_H = 11
{
  const head = []
  const base = [V(-1.5, 1.4, -1.5), V(1.5, 1.4, -1.5), V(1.5, 1.4, 1.5), V(-1.5, 1.4, 1.5)]
  const apex = V(0, 1.4 + HEAD_H, 0)
  for (const b of base) head.push(strut(b, apex, 0.2))
  for (let s = 1; s < 4; s++){
    const ring = base.map(b => b.clone().lerp(apex, s / 4))
    const lower = base.map(b => b.clone().lerp(apex, (s - 1) / 4))
    for (let k = 0; k < 4; k++){
      head.push(strut(ring[k], ring[(k + 1) % 4], 0.09))
      head.push(strut(lower[k], ring[(k + 1) % 4], 0.07))
    }
  }
  slew.add(merged(head, M.paint))
}

/* jib: a triangular lattice that tapers toward the tip */
const JIB_Y = 1.4, JIB_H = 1.9, JIB_W = 0.95
{
  const jib = []
  const n = 20, bay = C.JL / n
  const taper = x => 1 - 0.35 * Math.max(0, (x - C.JL * 0.55) / (C.JL * 0.45))
  const tri = x => { const t = taper(x); return [V(x, JIB_Y, -JIB_W * t), V(x, JIB_Y, JIB_W * t), V(x, JIB_Y + JIB_H * t, 0)] }
  for (let i = 0; i < n; i++){
    const xa = 1.8 + i * bay, xb = xa + bay
    const A = tri(xa), Bt = tri(xb)
    for (let k = 0; k < 3; k++) jib.push(strut(A[k], Bt[k], k === 2 ? 0.2 : 0.18))
    jib.push(strut(Bt[0], Bt[1], 0.08), strut(Bt[1], Bt[2], 0.08), strut(Bt[2], Bt[0], 0.08))
    const f = i % 2
    jib.push(strut(f ? A[0] : Bt[0], f ? Bt[2] : A[2], 0.07))
    jib.push(strut(f ? A[1] : Bt[1], f ? Bt[2] : A[2], 0.07))
    jib.push(strut(f ? A[0] : Bt[0], f ? Bt[1] : A[1], 0.06))
  }
  slew.add(merged(jib, M.paint))
}

/* counter-jib, machinery and counterweights */
{
  const cj = []
  const n = 6, bay = C.CJ / n
  for (let i = 0; i < n; i++){
    const xa = -1.8 - i * bay, xb = xa - bay
    for (const z of [-1.1, 1.1]) cj.push(strut(V(xa, 1.4, z), V(xb, 1.4, z), 0.24))
    cj.push(strut(V(xb, 1.4, -1.1), V(xb, 1.4, 1.1), 0.12))
    cj.push(strut(V(xa, 1.4, -1.1), V(xb, 1.4, 1.1), 0.08))
  }
  cj.push(box(C.CJ, 0.08, 2.0, -1.8 - C.CJ / 2, 1.56, 0))
  slew.add(merged(cj, M.paint))
  slew.add(merged([box(2.6, 1.4, 1.8, -6, 2.3, 0)], M.steel))
  const cw = []
  for (let i = 0; i < 4; i++) cw.push(box(0.9, 3.0, 2.6, -C.CJ + 0.2 + i * 1.0, 0.1, 0))
  slew.add(merged(cw, M.ballast))
}

/* pendant ties from the head to the jib and counter-jib */
{
  const ap = V(0, 1.4 + HEAD_H, 0)
  slew.add(merged([
    rod(ap, V(C.JL * 0.52, JIB_Y + JIB_H, 0), 0.06),
    rod(ap, V(C.JL * 0.86, JIB_Y + JIB_H * 0.76, 0), 0.06),
    rod(ap, V(-C.CJ + 0.6, 1.6, -0.9), 0.06),
    rod(ap, V(-C.CJ + 0.6, 1.6,  0.9), 0.06)], M.cable))
}

/* the name board on the counter-jib — every real crane carries one */
const boardTex = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 150
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  const draw = () => {
    const x = c.getContext('2d')
    x.fillStyle = '#FAF8F4'; x.fillRect(0, 0, 1024, 150)
    x.fillStyle = '#FF4D14'; x.fillRect(0, 0, 1024, 12); x.fillRect(0, 138, 1024, 12)
    x.fillStyle = '#121110'; x.font = '900 104px Archivo, system-ui, sans-serif'
    x.textAlign = 'center'; x.textBaseline = 'middle'
    x.fillText('AURUM', 512, 80)
    t.needsUpdate = true
  }
  draw()
  document.fonts?.ready.then(draw)          // redraw once Archivo has actually loaded
  return t
})()
{
  const bm = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 })
  const front = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5), bm)
  front.position.set(-8.6, 2.55, 1.22)
  const back = front.clone(); back.position.z = -1.22; back.rotation.y = Math.PI
  front.castShadow = back.castShadow = true
  slew.add(front, back)
}

/* trolley, hoist ropes, hook block and the load */
const trolley = new THREE.Group()
trolley.position.set(30, TROLLEY_Y, 0)
slew.add(trolley)
trolley.add(merged([box(2.0, 0.55, 2.1, 0, -0.27, 0)], M.steel))
const hoist = new THREE.Group()
trolley.add(hoist)
const ropes = merged([rod(V(-0.35, 0, 0), V(-0.35, -1, 0), 0.03),
                      rod(V( 0.35, 0, 0), V( 0.35, -1, 0), 0.03)], M.cable)
hoist.add(ropes)
const block = new THREE.Group()
hoist.add(block)
block.add(merged([box(1.0, 1.1, 0.7, 0, -0.55, 0)], M.hook))
block.add(merged([new THREE.TorusGeometry(0.34, 0.09, 10, 24, Math.PI * 1.35)
  .rotateZ(Math.PI * 0.9).translate(0, -1.45, 0)], M.steel))

/* An I-beam. The underside of its bottom flange sits BEAM_DROP below
   the hook block, which is what the pick and place heights are
   computed from. */
const BEAM_DROP = 4.53
const beamParts = () => [box(0.42, 0.06, 12, 0, -3.9, 0), box(0.42, 0.06, 12, 0, -4.5, 0),
                         box(0.05, 0.6, 12, 0, -4.2, 0)]
const load = new THREE.Group()
block.add(load)
const loadBeam = merged(beamParts(), M.steel)
load.add(loadBeam)
load.add(merged([rod(V(0, -1.72, 0), V(0, -3.87, -4), 0.025),
                 rod(V(0, -1.72, 0), V(0, -3.87,  4), 0.025)], M.cable))

/* ══ the choreography ══════════════════════════════════════════════ */
const HOIST_Y = C.MH + TROLLEY_Y
const PAD_H = 0.6
const LAYDOWN = { x: 26, z: 10 }
const ROOF_AT = { x: B.x + 1.5, z: B.z - 0.5 }
const thetaFor  = (wx, wz) => Math.atan2(-(wz - C.z), wx - C.x)
const radiusFor = (wx, wz) => Math.hypot(wx - C.x, wz - C.z)
const TH = { idle: thetaFor(40, -30), pick: thetaFor(LAYDOWN.x, LAYDOWN.z),
             place: thetaFor(ROOF_AT.x, ROOF_AT.z), rest: thetaFor(30, 25) }
const RAD = { pick: radiusFor(LAYDOWN.x, LAYDOWN.z), place: radiusFor(ROOF_AT.x, ROOF_AT.z) }
const L_PICK  = HOIST_Y - BEAM_DROP - PAD_H
const L_PLACE = HOIST_Y - BEAM_DROP - ROOF_Y + 0.01
const P_PICK = 1.64, P_PLACE = 2.40
/* Rope length sets the load's height outright — the trolley head never
   moves in y — so CARRY is simply "3.4 m of daylight over the roof".
   The load is hoisted to it before the slew starts and held there all
   the way across, which is both how it is actually done and the only
   way the beam does not track through the top floors. */
const CARRY = L_PLACE - 3.4

/* what the model is doing right now, for the telemetry and the notes */
/* How far the glazing has climbed, in floors. The hero sits at 4, which
   is exactly what it looked like when only the bottom four floors had
   glass built at all; the method section drives it up the tower. */
const CLAD = { v: 4 }
const SW_MAX = 0.17                                    // ~10° — a load you can see swinging
const clampF = v => v < -20 ? -20 : v > 20 ? 20 : v    // the forcing a real trolley can deliver
/* 1 everywhere except a dip to 0 across a pick or a set */
const steady = (i0, i1, o0, o1, p) => clamp01(1 - ss(i0, i1, p) + ss(o0, o1, p))
const LIVE = { f: 3, th: 0, L: 12, r: 30 }

/* The load is not drawn where the hook is — it is drawn where a load on
   a 40 m rope would actually be. SWING is a damped pendulum hanging off
   the trolley, forced by the trolley's own acceleration: slew away and
   the block lags behind, stop and it keeps going, then rings down. Two
   axes — a is tangential (across the slew), b is radial (along the jib).
   The scroll-driven accelerations are spiky, so they are low-passed
   before they reach the pendulum. */
const SWING = { th: 0, r: 0, vt: 0, vr: 0, at: 0, ar: 0, a: 0, av: 0, b: 0, bv: 0 }
let ghosts = []                         // filled once the model exists

function applyState(p, t, dt){
  /* The frame. A floor is a cycle, not a fade: columns up, deck poured
     across, edge protection struck and climbed — and then the deck sits
     while it gains strength. The pause is the eased fractional part of
     f, which is what turns a smooth extrusion into a floor-by-floor
     rhythm. The slipform core is deliberately exempt: a slipform really
     does run continuously, day and night, ahead of the frame. */
  const fr = 3 + (B.N - 3) * ss(0.30, 1.50, p)
  const fi = Math.floor(fr), ft = fr - fi
  const f = fi + ss(0.05, 0.74, ft)                    // work, then a beat of curing
  floors.forEach((g, k) => {
    const u = clamp01(f - k), ud = g.userData
    g.visible = u > 0.002
    const cu = ss(0.00, 0.55, u)                       // columns climb
    const du = ss(0.52, 0.95, u)                       // then the pour sweeps across
    const cl = Math.min(ss(0.78, 1.00, u), clamp01(CLAD.v - k))   // deck first, then glazing
    ud.cols.visible = cu > 0.004; ud.cols.scale.y = Math.max(cu, 0.004)
    ud.deck.visible = du > 0.004; ud.deck.scale.x = Math.max(du, 0.004)
    if (ud.clad){ ud.clad.visible = cl > 0.004; ud.clad.scale.y = Math.max(cl, 0.004) }
    if (ghosts[k]) ghosts[k].visible = u < 0.999       // the drawing, until concrete replaces it
  })
  core.scale.y = Math.min((fr + 1.4) * B.FH, ROOF_Y + 3.8)
  topKit.position.y = (fi + ss(0.78, 0.99, ft)) * B.FH // struck and climbed once the deck is cast
  crew.position.y = topKit.position.y                  // the crew is on the deck the kit is on
  crewBelow.position.y = topKit.position.y - B.FH
  crewBelow.visible = topKit.position.y > B.FH * 1.5   // nothing below the deck they started from
  scaffoldClip.constant = Math.min(f * B.FH + 1.4, scaffold.userData.H)
  ties.forEach(m => { m.visible = f * B.FH > m.userData.y + 2 })

  /* the crane: slew to the laydown, pick, slew over the roof, set it
     down, swing clear. Each move is its own eased window so the load
     is exactly at the pick and place points at P_PICK and P_PLACE. */
  let th = TH.idle, r = 30, L = 12
  const a1 = ss(1.10, 1.45, p); th = lerpAng(th, TH.pick, a1); r = lerp(r, RAD.pick, a1)
  /* A hoist never drops a load onto its bearing. It runs down fast to
     about a metre and a half clear, then creeps the last stretch, and
     the smoothstep leaves the rope moving at nearly zero at contact —
     which is what makes the set-down look like a set-down. */
  L = lerp(L, L_PICK - 1.5, ss(1.34, 1.54, p))     // run down to just clear
  L = lerp(L, L_PICK,       ss(1.54, 1.64, p))     // creep onto the timbers
  L = lerp(L, CARRY, ss(1.70, 1.94, p))            // a beat, then hoist to carrying height
  const a2 = ss(1.78, 2.18, p); th = lerpAng(th, TH.place, a2); r = lerp(r, RAD.place, a2)
  L = lerp(L, L_PLACE - 1.6, ss(2.16, 2.32, p))    // over the roof, run down to just clear
  L = lerp(L, L_PLACE,       ss(2.32, 2.40, p))    // creep onto the steel; contact at P_PLACE
  L = lerp(L, CARRY, ss(2.46, 2.74, p))            // unhook, then hoist the block clear
  const a3 = ss(2.52, 2.95, p); th = lerpAng(th, TH.rest, a3); r = lerp(r, 34, a3)

  slew.rotation.y = th
  trolley.position.x = r
  ropes.scale.y = L
  block.position.y = -L

  /* The hook swings freely except on an approach: a driver steadies the
     load well before it lands, holds it dead through the contact, and
     lets it hang free again once the rope is off. The window is
     asymmetric for that reason — long coming in, short going out — and
     it is also what makes the handover to the static copy invisible,
     since both are plumb at the swap. */
  const calm = Math.min(steady(1.34, 1.54, 1.72, 1.90, p),
                        steady(2.04, 2.22, 2.44, 2.64, p))
  if (dt > 0){
    const h = Math.min(dt, 1 / 60)
    /* one model unit is one metre; g is shortened a little so a 40 m
       rope rings at ~8 s instead of its true ~13 — long enough to read
       as mass, short enough to see a whole swing while scrolling */
    const Lh = Math.max(6, L), w2 = 9.81 / Lh * 2.4, drag = 0.26
    const vt = (th - SWING.th) / h * r            // tangential speed of the trolley head
    const vr = (r - SWING.r) / h                  // radial speed along the jib
    SWING.th = th; SWING.r = r
    const at = clampF((vt - SWING.vt) / h), ar = clampF((vr - SWING.vr) / h)
    SWING.vt = vt; SWING.vr = vr
    SWING.at += (at - SWING.at) * 0.18            // low-pass: scrubbed deltas are spiky
    SWING.ar += (ar - SWING.ar) * 0.18
    for (let i = 0; i < 2; i++){                  // half-steps, the scrub can move fast
      const hh = h / 2
      SWING.av += (-w2 * Math.sin(SWING.a) - SWING.at / Lh - drag * SWING.av) * hh
      SWING.bv += (-w2 * Math.sin(SWING.b) - SWING.ar / Lh - drag * SWING.bv) * hh
      SWING.a += SWING.av * hh; SWING.b += SWING.bv * hh
    }
    /* the rope cannot lay over — bounce off the stop instead of pinning */
    if (Math.abs(SWING.a) > SW_MAX){ SWING.a = Math.sign(SWING.a) * SW_MAX; SWING.av *= -0.25 }
    if (Math.abs(SWING.b) > SW_MAX){ SWING.b = Math.sign(SWING.b) * SW_MAX; SWING.bv *= -0.25 }
  }
  const breeze = Math.sin(t * 0.47) * 0.012 + Math.sin(t * 0.81 + 1.3) * 0.006
  hoist.rotation.x = (SWING.a + breeze) * calm
  hoist.rotation.z = (SWING.b + breeze * 0.6) * calm

  /* the mast is 60 m of lattice: it breathes, and it leans a hair
     toward wherever the load is swinging */
  crane.rotation.z = Math.sin(t * 0.31) * 0.0022 + SWING.b * 0.035 * calm
  crane.rotation.x = Math.sin(t * 0.24 + 0.9) * 0.0018 - SWING.a * 0.035 * calm

  load.visible = p >= P_PICK && p < P_PLACE
  groundBeam.visible = p < P_PICK
  roofBeam.visible = p >= P_PLACE

  LIVE.f = f; LIVE.th = th; LIVE.L = L; LIVE.r = r
}

/* The beam on the laydown and the beam on the roof are static copies
   of the hoisted one, taken from the rig itself at the exact pick and
   place moments. Swapping between them is therefore seamless by
   construction — there is nothing to line up by hand. */
function beamCopyAt(p){
  applyState(p, 0)
  site.updateMatrixWorld(true)
  const copy = new THREE.Mesh(loadBeam.geometry, M.steel)
  copy.castShadow = copy.receiveShadow = true
  loadBeam.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
  site.add(copy)
  return copy
}
let groundBeam = { visible: true }, roofBeam = { visible: false }
groundBeam = beamCopyAt(P_PICK)
roofBeam = beamCopyAt(P_PLACE)

/* sleepers and spares under the laydown beam, aligned to it */
{
  const dir = V(0, 0, 1).applyQuaternion(groundBeam.quaternion)
  const lay = new THREE.Group()
  lay.position.set(groundBeam.position.x, 0, groundBeam.position.z)
  lay.rotation.y = Math.atan2(dir.x, dir.z)
  lay.add(merged([box(2.6, PAD_H, 0.45, 0, PAD_H / 2, -4), box(2.6, PAD_H, 0.45, 0, PAD_H / 2, 4)], M.timber))
  lay.add(merged([...beamParts().map(g => g.translate(-0.8, BEAM_DROP + PAD_H, 0)),
                  ...beamParts().map(g => g.translate( 0.8, BEAM_DROP + PAD_H, 0))], M.steel))
  site.add(lay)
}

/* ── the site around it ─────────────────────────────────────────── */
{
  const cab = new THREE.Group()
  cab.position.set(-25, 0, -17); cab.rotation.y = 0.5
  cab.add(merged([box(6.2, 2.6, 2.5, 0, 1.3, 0), box(6.2, 2.6, 2.5, 0.7, 3.95, 0.25)], M.cabin))
  cab.add(merged([box(4.6, 0.7, 0.05, 0, 1.6, 1.27), box(4.6, 0.7, 0.05, 0.7, 4.25, 1.52)], M.glass))
  cab.add(merged([box(6.24, 0.16, 2.54, 0, 0.35, 0), box(6.24, 0.16, 2.54, 0.7, 3.0, 0.25)], M.paint))
  site.add(cab)

  const blocks = [], pallets = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++){
    const px = -21 + i * 1.6, pz = 16 + j * 1.6, hh = 0.8 + ((i * 7 + j * 3) % 3) * 0.2
    pallets.push(box(1.35, 0.15, 1.35, px, 0.075, pz))
    blocks.push(box(1.2, hh, 1.2, px, 0.15 + hh / 2, pz))
  }
  site.add(merged(blocks, M.ballast), merged(pallets, M.timber))

  const bars = []
  for (let i = 0; i < 7; i++) bars.push(rod(V(-0.5, 0.35 + (i % 3) * 0.14, 20 + i * 0.16),
                                            V(9.5, 0.35 + (i % 3) * 0.14, 20 + i * 0.16), 0.06))
  site.add(merged(bars, M.steel),
           merged([box(0.3, 0.28, 1.6, 1, 0.14, 20.5), box(0.3, 0.28, 1.6, 8, 0.14, 20.5)], M.timber))

  /* Maquette trees and figures. Nothing gives a model scale like a
     person, and nothing makes a white model read as a model like
     faceted trees. */
  const crowns = [], trunks = []
  const TREES = [[18, 35, 2.4], [62, 36, 2.0], [108, 35, 2.7], [148, 34, 2.1],
                 [192, 36, 2.6], [242, 35, 1.9], [292, 36, 2.5], [328, 34, 2.2]]
  for (const [deg, rr, s] of TREES){
    const a = deg * Math.PI / 180, x = Math.cos(a) * rr, z = Math.sin(a) * rr
    crowns.push(new THREE.IcosahedronGeometry(s, 1).translate(x, 2.2 + s, z))
    trunks.push(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6).translate(x, 1.2, z))
  }
  site.add(merged(crowns, M.tree), merged(trunks, M.core))

  const people = []
  for (const [x, z] of [[-10, 11.2], [-8.6, 11.8], [23, 13.4], [24.4, 14.2], [-20.5, -13.5], [16.5, 1.2]])
    people.push(new THREE.CapsuleGeometry(0.24, 1.1, 4, 10).translate(x, 0.8, z))
  site.add(merged(people, M.figure))
}

/* ══════════════════════════════════════════════════════════════════
   SHOWCASE LAYER
   ══════════════════════════════════════════════════════════════════ */
let lenis = null

/* ── drawing ↔ building ────────────────────────────────────────────
   The model exists two ways at once: as the orange line drawing it was
   set out from, and as the built thing. A horizontal cut divides them.
   Below it every material renders solid; above it the same geometry
   renders as its own edges. On load the cut rises through the site, so
   it is literally drawn first and built second, and the button in the
   hero sends it back to drawings and home again. */
const SCAN = { h: 0 }
const SCAN_TOP = 80
const keepBelow = new THREE.Plane(V(0, -1, 0), 0)   // solid:   y <= h
const keepAbove = new THREE.Plane(V(0,  1, 0), 0)   // drawing: y >= h
const lineM = new THREE.LineBasicMaterial({ color: 0xFF4D14, transparent: true, opacity: 0.82,
  toneMapped: false, clippingPlanes: [keepAbove] })
const lineScafM = lineM.clone()
lineScafM.clippingPlanes = [keepAbove, scaffoldClip]  // the drawn scaffold still stops at the build
const edges = []
{
  const solidOnly = new Set([M.white, M.pad, M.padGrid])   // the plinth is the table, never a drawing
  const meshes = []
  site.traverse(o => { if (o.isMesh && !solidOnly.has(o.material) && !o.material.isShadowMaterial) meshes.push(o) })
  const clipped = new Set()
  for (const o of meshes){
    const mat = o.material
    if (!clipped.has(mat)){
      mat.clippingPlanes = [...(mat.clippingPlanes || []), keepBelow]
      mat.clipShadows = true
      mat.needsUpdate = true
      clipped.add(mat)
    }
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 24),
      mat.clippingPlanes.includes(scaffoldClip) ? lineScafM : lineM)
    o.add(l)          // a child, so it inherits every scale, slew and visibility of its mesh
    edges.push(l)
  }
}
const scanGroup = new THREE.Group()
{
  const disc = new THREE.Mesh(new THREE.CircleGeometry(47, 96),
    new THREE.MeshBasicMaterial({ color: 0xFF4D14, transparent: true, opacity: 0.06,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
  const ring = new THREE.Mesh(new THREE.RingGeometry(46.3, 47, 160),
    new THREE.MeshBasicMaterial({ color: 0xFF4D14, transparent: true, opacity: 0.62,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
  disc.rotation.x = ring.rotation.x = -Math.PI / 2
  scanGroup.add(disc, ring)
  scene.add(scanGroup)
}
function updateScan(){
  keepBelow.constant = SCAN.h
  keepAbove.constant = -SCAN.h
  scanGroup.position.y = SCAN.h
  scanGroup.visible = SCAN.h > 0.3 && SCAN.h < SCAN_TOP - 6
  const drawing = SCAN.h < SCAN_TOP - 1          // skip ~50k line segments once fully built
  if (edges[0].visible !== drawing) edges.forEach(l => { l.visible = drawing })
}

/* ── the finished tower, drawn ahead of the concrete ───────────────
   Every floor that is not built yet is still there as a dashed orange
   outline, so the whole tower is visible from the first frame and the
   scroll fills it in. */
const ghostM = new THREE.LineDashedMaterial({ color: 0xFF4D14, dashSize: 0.5, gapSize: 0.42,
  transparent: true, opacity: 0.42, toneMapped: false })
ghosts = floors.map((g, k) => {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(g.userData.ghostGeo, 24), ghostM)
  l.computeLineDistances()
  l.position.set(B.x, k * B.FH, B.z)
  site.add(l)
  return l
})

/* ── welding sparks on the floor being built ─────────────────────── */
const SPARKS = 110
const spPos = new Float32Array(SPARKS * 3), spVel = new Float32Array(SPARKS * 3), spLife = new Float32Array(SPARKS)
const sparkGeo = new THREE.BufferGeometry()
sparkGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3))
sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(spLife, 1))
const sparkMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uPix: { value: Math.min(devicePixelRatio, 2) }, uH: { value: innerHeight } },
  vertexShader: `
    attribute float aLife; uniform float uPix, uH; varying float vL;
    void main(){
      vL = aLife;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.6 + aLife * 3.0) * uPix * (uH * 0.0011) * (140.0 / max(-mv.z, 1.0));
    }`,
  fragmentShader: `
    varying float vL;
    void main(){
      vec2 d = gl_PointCoord - 0.5; float r = dot(d, d);
      if (r > 0.25 || vL <= 0.0) discard;
      vec3 c = mix(vec3(1.0, 0.30, 0.08), vec3(1.0, 0.86, 0.42), clamp(vL * 1.3, 0.0, 1.0));
      gl_FragColor = vec4(c, smoothstep(0.25, 0.0, r) * min(1.0, vL * 2.0));
    }`,
})
const sparks = new THREE.Points(sparkGeo, sparkMat)
sparks.frustumCulled = false
scene.add(sparks)
let burstAt = 0
function updateSparks(t, dt, active){
  if (active && t > burstAt){
    burstAt = t + 0.6 + Math.random() * 1.4
    const cx = B.x + COL_X[(Math.random() * COL_X.length) | 0]
    const cz = B.z + (Math.random() < 0.5 ? -B.D / 2 : B.D / 2)
    const cy = LIVE.f * B.FH + 0.9
    for (let i = 0, n = 0; i < SPARKS && n < 38; i++){
      if (spLife[i] > 0) continue
      n++
      spPos[i*3] = cx; spPos[i*3+1] = cy; spPos[i*3+2] = cz
      const a = Math.random() * 6.283, sp = 1.8 + Math.random() * 5.5
      spVel[i*3] = Math.cos(a) * sp; spVel[i*3+1] = 1.2 + Math.random() * 4.5; spVel[i*3+2] = Math.sin(a) * sp
      spLife[i] = 0.55 + Math.random() * 0.55
    }
  }
  let any = false
  for (let i = 0; i < SPARKS; i++){
    if (spLife[i] <= 0) continue
    any = true
    spVel[i*3+1] -= 9.8 * dt
    spPos[i*3] += spVel[i*3] * dt; spPos[i*3+1] += spVel[i*3+1] * dt; spPos[i*3+2] += spVel[i*3+2] * dt
    spLife[i] = Math.max(0, spLife[i] - dt * 1.15)
  }
  if (any){ sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.aLife.needsUpdate = true }
}

/* ── aviation lights on the head and both jib ends ─────────────────── */
const beaconM = new THREE.MeshBasicMaterial({ color: 0xFF2A12, toneMapped: false })
const beacons = [V(0, 1.4 + HEAD_H + 0.45, 0), V(1.8 + C.JL + 0.3, JIB_Y + 0.25, 0), V(-C.CJ - 0.25, 1.9, 0)]
  .map(q => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), beaconM); b.position.copy(q); slew.add(b); return b })
function blinkBeacons(t){
  const on = (t % 1.8) < 0.32
  if (beacons[0].visible !== on) beacons.forEach(b => { b.visible = on })
}

/* ── telemetry ─────────────────────────────────────────────────── */
const hudEl = document.querySelector('.hud')
const notesEl = document.querySelector('.notes')
const HUD = {}
document.querySelectorAll('[data-hud]').forEach(el => { HUD[el.dataset.hud] = { el, v: '' } })
const hudBar = document.querySelector('.hud__bar i')
const put = (k, v) => { const h = HUD[k]; if (h && h.v !== v){ h.v = v; h.el.textContent = v } }
const pad2 = n => String(n).padStart(2, '0')
function updateHUD(){
  if (!hudEl) return
  /* the telemetry follows whichever act is running */
  put('stage', ACT2.on ? pad2(ACT2.i + 1) + ' / 05'
                       : pad2(S.act + 1) + ' / 04')
  put('floor', pad2(Math.min(B.N, Math.floor(LIVE.f + 1e-3))) + ' / ' + B.N)
  put('height', (LIVE.f * B.FH).toFixed(1) + ' m')
  put('slew', String(Math.round(((LIVE.th * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°')
  put('hook', (HOIST_Y - LIVE.L).toFixed(1) + ' m')
  put('load', load.visible ? '2.4 t' : '—')
  hudBar.style.width = (S.p / 3 * 100).toFixed(1) + '%'
}

/* ── annotations ───────────────────────────────────────────────────
   HTML labels pinned to live points on the model, projected through
   the real camera each frame — so they track the slew, the rising
   frame and the hook, and each one only appears in its own act. */
const tmpV = V(0, 0, 0)
const NOTES = [
  /* on the mast, not the head: the head sits right under the nav */
  { key: 'crane', from: -1,   to: 0.62, at: () => crane.localToWorld(tmpV.set(C.S / 2, 34, C.S / 2)) },
  { key: 'core',  from: -1,   to: 0.62, at: () => building.localToWorld(tmpV.set(1.6, core.scale.y, -1.2)) },
  { key: 'frame', from: 0.58, to: 1.46, at: () => tmpV.set(B.x + B.W / 2 + 0.45, LIVE.f * B.FH, B.z + B.D / 2 + 0.45) },
  { key: 'ties',  from: 1.02, to: 1.5,  at: () => crane.localToWorld(tmpV.set(-C.S / 2, 31, 0)) },
  { key: 'beam',  from: 1.66, to: 2.4,  at: () => loadBeam.localToWorld(tmpV.set(0, -3.9, 0)) },
  { key: 'roof',  from: 2.56, to: 9,    at: () => tmpV.set(B.x - 4, ROOF_Y + 1.1, B.z + B.D / 2) },
]
NOTES.forEach(n => { n.el = document.querySelector(`[data-note="${n.key}"]`); n.on = false })
function updateNotes(){
  for (const n of NOTES){
    if (!n.el) continue
    let want = S.p > n.from && S.p < n.to && SCAN.h > SCAN_TOP - 2
    if (want){
      const v = n.at().project(camera)
      if (v.z > 1) want = false
      else n.el.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px,${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`
    }
    if (want !== n.on){ n.on = want; n.el.classList.toggle('on', want) }
  }
}
let overlayAlpha = -1
function fadeOverlays(){
  /* The method section has the stage rail, the open stage and the datum.
     A six-row telemetry panel and the model's own annotations on top of
     that is three readouts saying overlapping things at once. */
  const a = ACT2.on ? 0 : sceneAlpha
  if (overlayAlpha === a) return
  overlayAlpha = a
  if (hudEl) hudEl.style.opacity = a
  if (notesEl) notesEl.style.opacity = a
}

/* ── light ─────────────────────────────────────────────────────── */
scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xE3DCCD, 0.5))
const sun = new THREE.DirectionalLight(0xFFF2E2, 3.4)
sun.position.set(-44, 82, 56)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
Object.assign(sun.shadow.camera, { left: -64, right: 64, top: 64, bottom: -64, near: 20, far: 260 })
sun.shadow.camera.updateProjectionMatrix()      // bounds do nothing until this runs
sun.shadow.bias = -0.00025
sun.shadow.normalBias = 0.035
scene.add(sun, sun.target)

/* ── camera ────────────────────────────────────────────────────────
   Four shots, one per headline. Each is a target, a distance and an
   azimuth/elevation around it; between shots the camera eases across
   most of the scroll segment, so it is mid-move as the headline
   swaps. Azimuth runs from +z toward +x. */
const SHOTS = [
  { t: V(4, 29, 0),   d: 156, az: 34,  el: 11 },
  { t: V(-4, 27, 2),  d: 138, az: 12,  el: 17 },
  { t: V(2, 36, 2),   d: 132, az: 68,  el: 15 },
  { t: V(0, 28, 0),   d: 150, az: 46,  el: 6  },
]
const DEG = Math.PI / 180
const FIT = { dist: 1 }

/* ══════════════════════════════════════════════════════════════════
   THE AGGREGATE — act two's second life.

   The method section used to conduct the maquette. It now conducts a
   quarter of a million points instead: the same five stages, but the
   structure has no geometry at all. It lives as positions in a float
   texture, pushed each frame by one fragment shader toward whichever
   form the scroll has arrived at, and let go into curl noise on the way
   between them.

   The one decision that makes it read as structure: every form is a set
   of SEGMENTS and the points are distributed along them by length.
   Scattered over a surface, 262,144 points at this scale is nine points
   per pixel and every form fills in solid. On lines, the voids stay
   empty — which is what a frame actually is.
   ══════════════════════════════════════════════════════════════════ */
const AGG_SIZE = 512, AGG_N = AGG_SIZE * AGG_SIZE
const ahash = n => { const x = Math.sin(n * 127.1 + 0.7) * 43758.5453; return x - Math.floor(x) }
const aseg = (a, b) => [a[0], a[1], a[2], b[0], b[1], b[2]]
const ACAGE = w => [[-w,-w],[0,-w],[w,-w],[w,0],[w,w],[0,w],[-w,w],[-w,0]]
function aring(out, w, y, x0 = 0, z0 = 0){
  const c = ACAGE(w)
  for (let k = 0; k < c.length; k++){
    const a = c[k], b = c[(k + 1) % c.length]
    out.push(aseg([x0 + a[0], y, z0 + a[1]], [x0 + b[0], y, z0 + b[1]]))
  }
}
function aFrom(segs, jitter){
  const cdf = []; let total = 0
  for (const g of segs) total += Math.hypot(g[3]-g[0], g[4]-g[1], g[5]-g[2])
  let acc = 0
  for (const g of segs){ acc += Math.hypot(g[3]-g[0], g[4]-g[1], g[5]-g[2]) / total; cdf.push(acc) }
  return (i, o) => {
    const r = ahash(i + 0.123)
    let lo = 0, hi = cdf.length - 1
    while (lo < hi){ const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m }
    const g = segs[lo], t = ahash(i + 7.77)
    o[0] = g[0] + (g[3]-g[0]) * t + (ahash(i + 1.1) - 0.5) * jitter
    o[1] = g[1] + (g[4]-g[1]) * t + (ahash(i + 2.2) - 0.5) * jitter
    o[2] = g[2] + (g[5]-g[2]) * t + (ahash(i + 3.3) - 0.5) * jitter
  }
}

/* 01 SURVEY — setting out: an 11 m grid and the diagonals you check it
   square with. 02 TEMPORARY WORKS — scaffold standards and ledgers
   round the footprint, plus the mast. 03 FRAME — nine cages, slab edges
   and a beam grid. 04 ENVELOPE — the frame behind a facade of mullions
   and transoms. 05 CLOSE OUT — everything temporary struck, the
   finished box and its floor lines only. */
const A_SURVEY = (() => {
  const out = [], R = 62
  for (let v = -R; v <= R; v += 11){
    out.push(aseg([v, 0, -R], [v, 0, R])); out.push(aseg([-R, 0, v], [R, 0, v]))
  }
  out.push(aseg([-R,0,-R],[R,0,R]), aseg([R,0,-R],[-R,0,R]))
  return out
})()
const A_TEMP = (() => {
  const out = [], E = 21, H = 22
  for (let x = -E; x <= E; x += 3) for (const z of [-E, E]) out.push(aseg([x,0,z],[x,H,z]))
  for (let z = -E; z <= E; z += 3) for (const x of [-E, E]) out.push(aseg([x,0,z],[x,H,z]))
  for (let y = 2; y <= H; y += 2){
    out.push(aseg([-E,y,-E],[E,y,-E]), aseg([E,y,-E],[E,y,E]),
             aseg([E,y,E],[-E,y,E]), aseg([-E,y,E],[-E,y,-E]))
  }
  for (const [x, z] of ACAGE(2.4)) out.push(aseg([34+x,0,26+z],[34+x,54,26+z]))
  for (let y = 2; y < 54; y += 3) aring(out, 2.4, y, 34, 26)
  return out
})()
const A_FRAME = (() => {
  const out = [], W = 2.2, H = 44, SP = 16, E = SP + 3.5
  for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++)
    for (const [x, z] of ACAGE(W))
      out.push(aseg([gx*SP+x, 0, gz*SP+z], [gx*SP+x, H, gz*SP+z]))
  for (let y = 4; y <= H; y += 4){
    out.push(aseg([-E,y,-E],[E,y,-E]), aseg([E,y,-E],[E,y,E]),
             aseg([E,y,E],[-E,y,E]), aseg([-E,y,E],[-E,y,-E]))
    for (let g = -1; g <= 1; g++){
      out.push(aseg([g*SP,y,-E],[g*SP,y,E])); out.push(aseg([-E,y,g*SP],[E,y,g*SP]))
    }
  }
  return out
})()
const A_ENV = (() => {
  const out = A_FRAME.slice(), H = 44, E = 19.5
  for (let u = -E; u <= E; u += 2.6){
    out.push(aseg([u,0,-E],[u,H,-E]), aseg([u,0,E],[u,H,E]))
    out.push(aseg([-E,0,u],[-E,H,u]), aseg([E,0,u],[E,H,u]))
  }
  for (let y = 4; y <= H; y += 4){
    out.push(aseg([-E,y,-E],[E,y,-E]), aseg([E,y,-E],[E,y,E]),
             aseg([E,y,E],[-E,y,E]), aseg([-E,y,E],[-E,y,-E]))
  }
  return out
})()
const A_DONE = (() => {
  const out = [], H = 44, E = 19.5
  for (const [x, z] of [[-E,-E],[E,-E],[E,E],[-E,E]]) out.push(aseg([x,0,z],[x,H,z]))
  for (let y = 0; y <= H; y += 4){
    out.push(aseg([-E,y,-E],[E,y,-E]), aseg([E,y,-E],[E,y,E]),
             aseg([E,y,E],[-E,y,E]), aseg([-E,y,E],[-E,y,-E]))
  }
  for (let v = -E; v <= E; v += 6.5){
    out.push(aseg([v,0,-E],[v,0,E])); out.push(aseg([-E,0,v],[E,0,v]))
  }
  return out
})()

const AGG_FORMS = [
  /* framing: the survey grid is 124 m across and the scaffold stage has
     a mast 43 m off the footprint — both need standing back from, or
     they run under the copy and off the right edge respectively */
  { name: 'Survey',    segs: A_SURVEY, jit: 0.5,  cam: { d: 188, az: 20, el: 42, t: [4, 2, 0] } },
  { name: 'Temporary', segs: A_TEMP,   jit: 0.18, cam: { d: 156, az: -14, el: 16, t: [15, 20, 11] } },
  { name: 'Frame',     segs: A_FRAME,  jit: 0.16, cam: { d: 132, az: 40, el: 12, t: [0, 23, 0] } },
  { name: 'Envelope',  segs: A_ENV,    jit: 0.14, cam: { d: 118, az: 72, el: 9,  t: [0, 24, 0] } },
  { name: 'Close out', segs: A_DONE,   jit: 0.14, cam: { d: 150, az: 30, el: 15, t: [0, 21, 0] } },
]

const agpu = new GPUComputationRenderer(AGG_SIZE, AGG_SIZE, renderer)
const ao = [0, 0, 0]
const aTex = AGG_FORMS.map(F => {
  const fn = aFrom(F.segs, F.jit), t = agpu.createTexture(), d = t.image.data
  for (let i = 0; i < AGG_N; i++){
    fn(i, ao)
    d[i*4] = ao[0]; d[i*4+1] = ao[1]; d[i*4+2] = ao[2]; d[i*4+3] = 1
  }
  t.needsUpdate = true
  return t
})
/* Seeded ON the survey grid, not scattered around it. The simulation
   only runs while act two is on screen, so a scattered seed means you
   arrive to several seconds of unreadable cloud sitting over the copy —
   the drama belongs in the changes between stages, not the entrance. */
const aSeed = agpu.createTexture(), asd = aSeed.image.data
{
  const fn = aFrom(A_SURVEY, 0.5)
  for (let i = 0; i < AGG_N; i++){
    fn(i, ao)
    asd[i*4] = ao[0]; asd[i*4+1] = ao[1]; asd[i*4+2] = ao[2]; asd[i*4+3] = 0
  }
  aSeed.needsUpdate = true
}
const A_SIM = `
  uniform sampler2D uA, uB; uniform float uMix, uDisp, uTime, uPull;
  vec3 h3(vec3 p){
    p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)),
             dot(p,vec3(113.5,271.9,124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float nz(vec3 p){
    vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.0-2.0*f);
    return mix(mix(mix(dot(h3(i+vec3(0,0,0)),f-vec3(0,0,0)), dot(h3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                   mix(dot(h3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(h3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
               mix(mix(dot(h3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(h3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                   mix(dot(h3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(h3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
  }
  vec3 curl(vec3 p){
    const float e = 0.42;
    float x1=nz(p+vec3(e,0,0)), x2=nz(p-vec3(e,0,0));
    float y1=nz(p+vec3(0,e,0)), y2=nz(p-vec3(0,e,0));
    float z1=nz(p+vec3(0,0,e)), z2=nz(p-vec3(0,0,e));
    return vec3((z1-z2)-(y1-y2), (x1-x2)-(z1-z2), (y1-y2)-(x1-x2)) / (2.0*e);
  }
  void main(){
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 p = texture2D(texturePosition, uv).xyz;
    vec3 target = mix(texture2D(uA, uv).xyz, texture2D(uB, uv).xyz, uMix);
    /* resting turbulence a twentieth of a unit — any nearer the pull and
       the aggregate never arrives, and every form reads as one smear */
    vec3 v = (target - p) * (0.022 + 0.155 * uPull);
    v += curl(p * 0.021 + uTime * 0.05) * (0.045 + 4.6 * uDisp);
    p += v;
    gl_FragColor = vec4(p, length(v));
  }
`
const aVar = agpu.addVariable('texturePosition', A_SIM, aSeed)
agpu.setVariableDependencies(aVar, [aVar])
Object.assign(aVar.material.uniforms, {
  uA: { value: aTex[0] }, uB: { value: aTex[1] },
  uMix: { value: 0 }, uDisp: { value: 0 }, uPull: { value: 1 }, uTime: { value: 0 },
})
const aErr = agpu.init(); if (aErr) console.error(aErr)

const aRefs = new Float32Array(AGG_N * 2)
for (let i = 0; i < AGG_N; i++){
  aRefs[i*2] = (i % AGG_SIZE) / AGG_SIZE
  aRefs[i*2+1] = ((i / AGG_SIZE) | 0) / AGG_SIZE
}
const aGeo = new THREE.BufferGeometry()
aGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AGG_N * 3), 3))
aGeo.setAttribute('aRef', new THREE.BufferAttribute(aRefs, 2))
aGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400)
const aMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: {
    uPos: { value: null }, uSize: { value: 1 },
    /* dark on paper — the inverse of the dark build, same idea */
    uInk: { value: new THREE.Color(0x1A1918) },
    uHot: { value: new THREE.Color(0xFF4D14) },
  },
  vertexShader: `
    uniform sampler2D uPos; uniform float uSize;
    attribute vec2 aRef; varying float vHeat;
    void main(){
      vec4 P = texture2D(uPos, aRef);
      vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * (420.0 / max(-mv.z, 1.0));
      vHeat = P.w;
    }`,
  fragmentShader: `
    uniform vec3 uInk, uHot; varying float vHeat;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.08, d);
      vec3 c = mix(uInk, uHot, clamp(vHeat * 0.55, 0.0, 1.0));
      gl_FragColor = vec4(c, a * 0.34);
    }`,
})
const aPoints = new THREE.Points(aGeo, aMat)
aPoints.visible = false
aPoints.frustumCulled = false
scene.add(aPoints)

/* A stage has to HOLD. Spread linearly, g is only settled at the exact
   integers and every other scroll position is part-dispersed — four per
   cent into the section it is already half loose, and the form never
   reads. So the fraction is shaped: still for the first sixty per cent
   of a stage, then the change happens quickly. The same shape drives the
   camera and the copy, so the words turn over when the form does. */
function aShape(g){
  const k = Math.min(AGG_FORMS.length - 2, Math.max(0, Math.floor(g)))
  /* the change must also FINISH early, or the last stage is still
     half dispersed when the section runs out of scroll */
  return { k, f: ss(0.45, 0.85, clamp01(g - k)) }
}
const aT = V(0, 0, 0)
function aPlace(g, t){
  const { k, f: w } = aShape(g)
  const A = AGG_FORMS[k].cam, Bb = AGG_FORMS[k + 1].cam
  aT.set(lerp(A.t[0], Bb.t[0], w), lerp(A.t[1], Bb.t[1], w), lerp(A.t[2], Bb.t[2], w))
  const d  = lerp(A.d, Bb.d, w) * FIT.dist
  const az = (lerp(A.az, Bb.az, w) + pointer.x * 6 + t * 0.8) * DEG
  const el = (lerp(A.el, Bb.el, w) - pointer.y * 3) * DEG
  camera.position.set(aT.x + d * Math.sin(az) * Math.cos(el),
                      aT.y + d * Math.sin(el),
                      aT.z + d * Math.cos(az) * Math.cos(el))
  camera.lookAt(aT)
}
function aStep(g, t){
  const { k, f } = aShape(g)
  const loose = Math.sin(f * Math.PI)
  const u = aVar.material.uniforms
  u.uA.value = aTex[k]; u.uB.value = aTex[k + 1]
  u.uMix.value = f
  u.uDisp.value = loose * 0.9
  u.uPull.value = 1 - loose * 0.92
  u.uTime.value = t
  agpu.compute()
  aMat.uniforms.uPos.value = agpu.getCurrentRenderTarget(aVar).texture
  aMat.uniforms.uSize.value = Math.max(0.8, Math.min(1.45, innerHeight * Math.min(devicePixelRatio,2) / 1500))
}

const S = { p: 0, target: 0, intro: 1, act: 0 }
/* Five stages, one per step of the method, driven by ACT2.g (0 → 4). */
const ACT2 = { on: false, g: 0, i: 0 }
const SHOTS2 = [
  { t: V(-2, 6,  0), d: 128, az: 22,  el: 26 },   // 01 survey — down onto the ground
  { t: V(-1, 14, 0), d: 120, az: -18, el: 14 },   // 02 temporary works — at the scaffold
  { t: V(0, 26,  0), d: 142, az: 40,  el: 10 },   // 03 frame — the cycle, from across the site
  { t: V(0, 30,  0), d: 118, az: 74,  el: 6  },   // 04 envelope — close on the glazing
  { t: V(0, 24,  0), d: 168, az: 30,  el: 12 },   // 05 handover — stand back off it
]
function placeCamera2(g, t){
  const k = Math.min(3, Math.floor(g)), w = ss(k + 0.08, k + 0.92, g)
  const A = SHOTS2[k], B2 = SHOTS2[k + 1]
  camT.lerpVectors(A.t, B2.t, w)
  const d  = lerp(A.d, B2.d, w) * FIT.dist
  const az = (lerp(A.az, B2.az, w) + pointer.x * 5) * DEG
  const el = (lerp(A.el, B2.el, w) - pointer.y * 3) * DEG
  const bx = Math.sin(t * 0.13) * 1.1, by = Math.sin(t * 0.17 + 1.4) * 0.8
  camera.position.set(camT.x + d * Math.sin(az) * Math.cos(el) + bx,
                      camT.y + d * Math.sin(el) + by,
                      camT.z + d * Math.cos(az) * Math.cos(el))
  camera.lookAt(camT.x + bx * 0.3, camT.y + by * 0.2, camT.z)
}
const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
const camT = V(0, 0, 0)

function placeCamera(p, t = 0){
  const k = Math.min(2, Math.floor(p)), w = ss(k + 0.12, k + 0.88, p)
  const A = SHOTS[k], Bs = SHOTS[k + 1]
  camT.lerpVectors(A.t, Bs.t, w)
  const d  = lerp(A.d, Bs.d, w) * FIT.dist + S.intro * 46
  const az = (lerp(A.az, Bs.az, w) + pointer.x * 5 - S.intro * 14) * DEG
  const el = (lerp(A.el, Bs.el, w) - pointer.y * 3 + S.intro * 5) * DEG
  /* a slow breath on the rig — no operator holds a camera this still */
  const bx = Math.sin(t * 0.13) * 1.1 + Math.sin(t * 0.31 + 2.1) * 0.4
  const by = Math.sin(t * 0.17 + 1.4) * 0.8
  camera.position.set(camT.x + d * Math.sin(az) * Math.cos(el) + bx,
                      camT.y + d * Math.sin(el) + by,
                      camT.z + d * Math.cos(az) * Math.cos(el))
  camera.lookAt(camT.x + bx * 0.3, camT.y + by * 0.2, camT.z)
}

/* The hero pushes the model right so the headline has paper; the method
   section pushes it the other way and down, into the empty quarter under
   the sticky heading, with the five steps running on the right. */
function applyOffset(w = innerWidth, h = innerHeight, portrait = camera.aspect < 1.15){
  if (ACT2.on) camera.setViewOffset(w, h, -w * 0.20, -h * 0.02, w, h)
  else if (portrait) camera.setViewOffset(w, h, w * 0.05, h * 0.2, w, h)
  else camera.setViewOffset(w, h, -w * 0.19, 0, w, h)
  camera.updateProjectionMatrix()
}

/* The staff stands 13 m west of the frame and a metre south of it, and
   every level is projected individually — the spacing between ticks is
   NOT linear on screen, because the camera is a perspective one and the
   top of an 11-storey tower is measurably further away than its base. */
const lvlEl = document.querySelector('.lvl')
const lvlTicks = lvlEl?.querySelector('.lvl__ticks')
const lvlNow = lvlEl?.querySelector('.lvl__now')
const lvlNowB = lvlNow?.querySelector('b')
/* A ladder of twelve ticks and six labels was a second scale competing
   with the telemetry panel for the same fact. One datum, riding the
   live build height, says it once. */
const lvlRows = []
const lvlV = V(0, 0, 0)
function lvlY(y){
  lvlV.set(B.x - 13, y, B.z + 1).project(camera)
  return (-lvlV.y * 0.5 + 0.5) * innerHeight
}
/* Heights are projected truly — the ticks crowd toward the top because
   the top of the tower really is further from the lens. The COLUMN is
   held clear of the west face instead of being projected too, because
   the camera swings through fifty degrees across the five stages and a
   staff in true plan position spends half of them standing inside the
   building it is measuring. */
const LVL_CORNERS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
function updateLevels(){
  if (!lvlEl) return
  /* Where the building ENDS on screen, not where its centre is: project
     all four base corners and take the leftmost. A fixed offset from the
     centre put the staff inside the tower at the shots that swing round
     to the east. */
  let left = Infinity
  for (const [sx, sz] of LVL_CORNERS){
    lvlV.set(B.x + sx * (B.W / 2 + 2), 0, B.z + sz * (B.D / 2 + 2)).project(camera)
    left = Math.min(left, (lvlV.x * 0.5 + 0.5) * innerWidth)
  }
  const x = Math.max(innerWidth * 0.40, Math.min(innerWidth * 0.66, left - 118))
  const h = LIVE.f * B.FH
  lvlNow.style.transform = `translate(${x}px,${lvlY(h)}px)`
  lvlNowB.textContent = h.toFixed(1) + ' M'
}

function fit(){
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  const portrait = camera.aspect < 1.15
  FIT.dist = portrait ? Math.min(3.2, 1.45 / camera.aspect) : 1
  sparkMat.uniforms.uH.value = h
  /* Landscape: slide the model right, so the headline on the left has
     clear paper behind it. Portrait: there is no left, so slide it up
     instead and let the copy have the bottom of the screen. A positive
     y offset moves the window down the frustum, which reads as the
     scene rising. */
  applyOffset(w, h, portrait)
  camera.updateProjectionMatrix()
}
addEventListener('resize', () => { fit(); ScrollTrigger.refresh() })
fit()

addEventListener('pointermove', e => {
  pointer.tx = e.clientX / innerWidth - 0.5
  pointer.ty = e.clientY / innerHeight - 0.5
})

let sceneAlpha = 1
const clock = new THREE.Clock()
let lastT = 0
function loop(){
  const t = clock.getElapsedTime(), dt = Math.min(0.05, t - lastT)
  lastT = t
  /* Lenis already smooths the scroll, so ease less on top of it */
  S.p += (S.target - S.p) * (lenis ? 0.105 : 0.07)   // the model trails the scroll
  pointer.x += (pointer.tx - pointer.x) * 0.035
  pointer.y += (pointer.ty - pointer.y) * 0.035
  if (ACT2.on){
    /* Act two belongs to the aggregate now. The maquette sits it out
       entirely — nothing of the site is stepped or drawn, so this costs
       one compute pass and one draw instead of the whole model. */
    aStep(ACT2.g, t)
    aPlace(ACT2.g, t)
    renderer.render(scene, camera)
    fadeOverlays()
    requestAnimationFrame(loop)
    return
  }
  applyState(S.p, t, dt)
  placeCamera(S.p, t)
  updateScan()
  updateSparks(t, dt, LIVE.f < B.N - 0.02 && S.p < 2.5 && SCAN.h > 40)
  blinkBeacons(t)
  /* ACT2 is its own reason to draw; sceneAlpha stays the hero's to own,
     so scrolling back up restores the hero exactly as it left it. */
  if (ACT2.on || sceneAlpha > 0.005){      // nothing to draw once faded
    renderer.render(scene, camera)
    updateHUD()
    updateNotes()
  }
  fadeOverlays()
  requestAnimationFrame(loop)
}
applyState(0, 0)
loop()
/* ─────────────── massif-scene.js, verbatim to here ─────────────── */
  const flush = t => post({ t, ops: ops.splice(0) })
  return {
    ready(){ flush('ready') },
    msg(m){
      if (m.t === 'size'){
        innerWidth = m.w; innerHeight = m.h
        ;(on.resize || []).forEach(f => f({ type: 'resize' }))
      } else if (m.t === 'act2'){
        /* the model's half of act two's onToggle, the same statements in the same order */
        ACT2.on = m.on
        applyOffset()
        site.visible = !m.on
        scanGroup.visible = scanGroup.visible && !m.on
        aPoints.visible = m.on
        if (m.on){
          S.p = S.target = 0.28
          SWING.a = SWING.b = SWING.av = SWING.bv = 0
        }
      } else if (m.t === 'f'){
        if (m.pm) (on.pointermove || []).forEach(f => f({ type: 'pointermove', clientX: m.pm[0], clientY: m.pm[1] }))
        S.target = m.target; S.intro = m.intro; S.act = m.act
        ACT2.g = m.g; ACT2.i = m.i
        SCAN.h = m.scan; CLAD.v = m.clad
        sceneAlpha = m.alpha
        lenis = m.lenis ? true : null
        const cb = next; next = null
        if (cb) cb()
        flush('f')
      }
    },
  }
}
