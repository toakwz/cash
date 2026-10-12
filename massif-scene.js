import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
gsap.registerPlugin(ScrollTrigger)

/* ══════════════════════════════════════════════════════════════════
   ASSETS — everything below is drawn here, in code. No files.
   ══════════════════════════════════════════════════════════════════ */

/* ── 1. grain ──────────────────────────────────────────────────── */
;(function grain(){
  const c = document.createElement('canvas'); c.width = c.height = 170
  const x = c.getContext('2d'); const img = x.createImageData(170, 170)
  for (let i = 0; i < img.data.length; i += 4){
    const v = 110 + Math.random() * 145
    img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255
  }
  x.putImageData(img, 0, 0)
  document.getElementById('grain').style.backgroundImage = `url(${c.toDataURL()})`
})()

/* ── 2. the plates ─────────────────────────────────────────────────
   Photographs, served from ./img next to this file — not hotlinked, so
   the page keeps working if a CDN does not. Five, one per capability,
   and the three named projects reuse the frame / steel / span shots.

   Chosen for colour that is already the brand's: hi-vis and painted
   steel are safety orange and plant is yellow, so the palette comes out
   of the work rather than being imposed on it. Graded in CSS, not in the
   files — a light shared saturate/contrast so five photographs from five
   sources read as one set, and so hover can lift the grade instead of
   swapping to a second image.

   Sources: unsplash.com, free licence —
     rebar      photo-1768926968986-a88590ce5025
     frame      photo-1576577610667-c9ea0ac983fd
     steel      photo-1651150538399-3bd977cb30c0
     span       photo-1601036452788-deedf9b7893f
     demolition photo-1677588508537-5106322c2d40 */
const PLATES = {
  dial:      'img/dial.jpg',  // collections: Rolex / sports watches
  bezel:      'img/bezel.jpg',  // dress watches and complications
  bracelet:      'img/bracelet.jpg',  // bracelets and straps
  movement:       'img/movement.jpg',  // movements and servicing
  service: 'img/service.jpg',  // trade-in and valuation
}
document.querySelectorAll('[data-art]').forEach(el => {
  el.style.backgroundImage = `url(${PLATES[el.dataset.art]})`
})

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

/* ══════════════════════════════════════════════════════════════════
   SCROLL
   ══════════════════════════════════════════════════════════════════ */
const acts = [...document.querySelectorAll('.act')]
gsap.set(acts[0], { opacity: 1 })

/* headline letters, split once so each act can rise in letter by letter */
function splitChars(el){
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3){
      const frag = document.createDocumentFragment()
      for (const ch of n.textContent){
        if (ch === ' '){ frag.appendChild(document.createTextNode(' ')); continue }
        const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch
        frag.appendChild(sp)
      }
      n.replaceWith(frag)
    } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n)
  })
  walk(el)
}
acts.forEach(splitChars)
function revealChars(el){
  gsap.fromTo(el.querySelectorAll('.ch'), { yPercent: 60, opacity: 0, rotateX: -70 },
    { yPercent: 0, opacity: 1, rotateX: 0, duration: .75, stagger: .024, ease: 'power3.out', overwrite: true })
}

/* smooth scroll — held until the loader lifts */
if (window.Lenis && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.84 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(time => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  lenis.stop()
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href')
    const el = id.length > 1 && document.querySelector(id)
    if (el){ e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 }) }
    else if (id === '#top'){ e.preventDefault(); lenis.scrollTo(0, { duration: 1.6 }) }
  }))
}

/* magnetic buttons */
document.querySelectorAll('.btn, .xray').forEach(b => {
  b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect()
    gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.28,
                 y: (e.clientY - r.top - r.height / 2) * 0.42, duration: .5, ease: 'power3.out' })
  })
  b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.4)' }))
})

/* drawing / built */
const xray = document.querySelector('.xray')
xray?.addEventListener('click', () => {
  const toDrawing = SCAN.h > SCAN_TOP / 2
  gsap.to(SCAN, { h: toDrawing ? 0 : SCAN_TOP, duration: toDrawing ? 2.0 : 3.0,
                  ease: 'power2.inOut', overwrite: true })
  xray.classList.toggle('is-drawing', toDrawing)
  xray.querySelector('span').textContent = toDrawing ? 'View built' : 'View drawings'
})

/* The hero is pinned for four screens and p walks 0 → 3 across it. The
   render loop eases toward it, so the scrub itself is left raw. Acts
   only re-animate when the index actually changes, in either direction,
   so scrolling back up replays them. */
ScrollTrigger.create({
  trigger: '.hero',
  start: 'top top',
  end: '+=520%',            // four shots over five screens — paced, not sluggish
  pin: true,
  scrub: 0.8,               // scrub inertia on top of Lenis
  onUpdate(self){
    S.target = self.progress * 3
    const idx = Math.round(S.target)
    if (idx === S.act) return
    S.act = idx
    acts.forEach((el, i) => {
      const on = i === idx
      /* The acts are stacked in one absolute rail, so an even crossfade
         shows both headlines overlapping at half strength. The outgoing
         one is cleared in half the time it takes the next to arrive,
         which reads as a swap rather than a smear. */
      gsap.to(el, on
        ? { opacity: 1, y: 0,  duration: .5,  delay: .1, ease: 'power3.out', overwrite: true }
        : { opacity: 0, y: 18, duration: .22,            ease: 'power2.in',  overwrite: true })
      if (on) revealChars(el)
    })
  },
})

/* The model belongs to the hero; fade the canvas as the copy takes over.
   fromTo with immediateRender:false so it never writes a start value
   before the page has scrolled — and it reverses on the way back up. */
gsap.fromTo(canvas, { opacity: 1 }, {
  opacity: 0, ease: 'none', immediateRender: false,
  scrollTrigger: {
    trigger: '.hero', start: 'bottom 85%', end: 'bottom 35%', scrub: true,
    onUpdate: self => { sceneAlpha = 1 - self.progress },
  },
})

/* manifesto — word by word */
document.querySelectorAll('[data-split]').forEach(p => {
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3){
        const frag = document.createDocumentFragment()
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t.trim()){ frag.appendChild(document.createTextNode(t)); return }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = t
          frag.appendChild(s)
        })
        n.replaceWith(frag)
      } else if (n.nodeType === 1) walk(n)
    })
  }
  walk(p)
  gsap.to(p.querySelectorAll('.w'), {
    opacity: 1, stagger: 0.035, ease: 'none',
    scrollTrigger: { trigger: p, start: 'top 78%', end: 'bottom 62%', scrub: true },
  })
})

/* counters */
document.querySelectorAll('[data-count]').forEach(el => {
  const to = parseFloat(el.dataset.count)
  const dec = +(el.dataset.dec || 0)
  const o = { v: 0 }
  gsap.to(o, {
    v: to, duration: 2.1, ease: 'power2.out',
    /* toggleActions so they replay: with the default, scrolling to the
       bottom and back left every counter finished and still */
    scrollTrigger: { trigger: el, start: 'top 88%',
                     toggleActions: 'restart none none reverse' },
    onUpdate(){ el.textContent = o.v.toFixed(dec) },
  })
})

/* ── ACT TWO ──────────────────────────────────────────────────────
   The method section was five paragraphs and nothing else — the one
   place the page stopped inventing. It now pins and conducts the same
   maquette through its own five stages: the ground, the temporary
   works, the frame cycle, the glazing, and standing back off the
   finished thing. Nothing new is modelled; the states were all already
   in there, waiting to be asked for.

   Desktop only. On a phone the model would be behind the copy at a size
   that helps nobody, so the section stays exactly as it was. */
/* ScrollTrigger measures at script time — before Archivo has loaded and
   before the plate photographs have laid out — and every headline above
   this section changes height when they do. Left alone, the pin's start
   sat 460px past where the section actually reaches the top of the
   screen, so there was a dead band where the method filled the viewport
   with no model in it. Re-measure once the page is genuinely settled. */
document.fonts?.ready.then(() => ScrollTrigger.refresh())
addEventListener('load', () => ScrollTrigger.refresh())

const ACT2_OK = matchMedia('(min-width: 861px)').matches
if (ACT2_OK){
  const proc = document.querySelector('#proc')
  const steps = [...proc.querySelectorAll('.step')]
  ScrollTrigger.create({
    trigger: proc, start: 'top top', end: '+=460%', pin: true, scrub: 0.8,
    /* This trigger is created before the capability rail's, so it
       refreshes first and computes its start without the 474px of
       pin-spacing that rail is about to insert above it — which put the
       start 474px early and left a dead band where the method filled
       the screen with no model in it. Refresh last instead. */
    refreshPriority: -1,
    onToggle(self){
      ACT2.on = self.isActive
      proc.classList.toggle('is-act2', self.isActive)
      applyOffset()
      canvas.classList.toggle('act2', self.isActive)   /* opacity rides the class */
      /* The pin wraps the section in a .pin-spacer that inherits .sec's
         z-index:2, which traps the section inside a z-2 stacking context
         — so raising the section alone puts the copy UNDER the canvas.
         The spacer is what has to move. */
      if (proc.parentElement.classList.contains('pin-spacer'))
        proc.parentElement.style.zIndex = self.isActive ? 4 : 2
      /* the maquette and the aggregate never share the frame */
      site.visible = !self.isActive
      scanGroup.visible = scanGroup.visible && !self.isActive
      aPoints.visible = self.isActive
      if (lvlEl) lvlEl.style.display = self.isActive ? 'none' : ''
      if (self.isActive){
        S.p = S.target = 0.28
        SWING.a = SWING.b = SWING.av = SWING.bv = 0
      } else {
        gsap.to(SCAN, { h: SCAN_TOP, duration: .9, overwrite: true })
        gsap.to(CLAD, { v: 4, duration: .9, overwrite: true })
        steps.forEach(el => el.classList.remove('on'))
      }
    },
    onUpdate(self){
      ACT2.g = self.progress * 4
      /* one index for the step and the telemetry, or the panel reads 04
         while step 05 is lit */
      const sh = aShape(ACT2.g)
      ACT2.i = Math.max(0, Math.min(4, sh.k + (sh.f > 0.5 ? 1 : 0)))
      steps.forEach((el, k) => el.classList.toggle('on', k === ACT2.i))
      /* the fill runs down to the bottom of the open stage */
      const live = steps[ACT2.i], rail = proc.querySelector('.prail')
      if (rail && live) rail.style.height = (live.offsetTop + live.offsetHeight - 14) + 'px'
    },
  })
}

/* capability rail — horizontal on vertical scroll */
const track = document.querySelector('.caps__track')
const capCards = [...track.querySelectorAll('.cap')]
const capBar = document.querySelector('.capbar')
const capSegs = capCards.map((c, i) => {
  const seg = document.createElement('div')
  seg.className = 'capbar__seg'
  seg.innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b>'
  capBar.appendChild(seg)
  return seg
})
/* The bar fills continuously across the five segments and the card the
   rail has arrived at takes the orange rule — so the section reads as a
   programme being worked through rather than a row of boxes. */
function capProgress(t){
  const n = capCards.length, live = Math.max(0, Math.min(n - 1, Math.floor(t * n)))
  for (let i = 0; i < n; i++){
    capSegs[i].classList.toggle('done', t * n - i > 0.98)
    capCards[i].classList.toggle('is-live', i === live)
  }
}
capProgress(0)
gsap.to(track, {
  x: () => -(track.scrollWidth - innerWidth + 40),
  ease: 'none',
  scrollTrigger: {
    trigger: '.caps', start: 'top top',
    end: () => '+=' + (track.scrollWidth - innerWidth + 40),
    pin: true, scrub: 0.6, invalidateOnRefresh: true,
    onUpdate: self => capProgress(self.progress),
  },
})

/* work plates — a wipe off the image, and a slow push on the art */
document.querySelectorAll('.plate').forEach(pl => {
  gsap.to(pl.querySelector('.plate__mask'), {
    scaleY: 0, duration: 1.25, ease: 'expo.inOut',
    scrollTrigger: { trigger: pl, start: 'top 82%',
                     toggleActions: 'play none none reverse' },
  })
  gsap.fromTo(pl.querySelector('.plate__img'),
    { yPercent: -7 }, { yPercent: 7, ease: 'none',
    scrollTrigger: { trigger: pl, start: 'top bottom', end: 'bottom top', scrub: true } })
})

/* Process steps rise in — but only where act two is NOT running. Inside
   a pinned section all five are on screen at once, so the reveal is
   meaningless there, and worse: it leaves an inline opacity:1 on every
   step that outranks the act-two dimming. */
if (!ACT2_OK) gsap.utils.toArray('.step').forEach(s => {
  gsap.from(s, { opacity: 0, y: 38, duration: .8, ease: 'power3.out',
    scrollTrigger: { trigger: s, start: 'top 86%',
                     toggleActions: 'play none none reverse' } })
})

/* marquee — scroll velocity nudges it */
const marq = document.querySelector('.marq__in')
gsap.to(marq, { xPercent: -50, repeat: -1, duration: 18, ease: 'none' })
ScrollTrigger.create({
  onUpdate(self){ gsap.to(marq, { timeScale: 1 + Math.abs(self.getVelocity()) / 1800,
    duration: .3, overwrite: true }) },
})

/* nav progress */
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self){ gsap.set('.prog', { width: (self.progress * 100) + '%' }) },
})

/* ── the footer wordmark ─────────────────────────────────────────
   Ticks on the ground line, same rule as the loader tape, then the
   built half is raised out of the ground as the footer arrives. It
   starts translated down by exactly the height of its own clip, so
   there is nothing above the line until it rises. */
{
  const ticks = document.querySelector('.mk__ticks')
  if (ticks){
    for (let x = 0; x <= 1000; x += 25){
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      const h = x % 100 ? 5 : 11
      l.setAttribute('x1', x); l.setAttribute('x2', x)
      l.setAttribute('y1', 115); l.setAttribute('y2', 115 + h)
      ticks.appendChild(l)
    }
    /* The M is flown in, not dropped. A tower crane does three things
       with a load: the trolley TRAVELS out along the jib, the hoist runs
       the load DOWN, and the load SWINGS the whole time because it hangs
       from a moving point. So this is a real pendulum hanging off the
       trolley, forced by the trolley's own acceleration — it lags on the
       way out, overshoots when the trolley stops, and is steadied before
       it touches, exactly like the crane in the hero. */
    const setG = document.querySelector('.mk__set')
    const rope = document.querySelector('.mk__rope')
    const hook = document.querySelector('.mk__hook')
    const LIFT = 128, CAP_TOP = 16, JBY = -184
    let mCx = 90
    const placeM = () => {
      const c = document.createElement('canvas').getContext('2d')
      const fs = parseFloat(getComputedStyle(document.querySelector('.mk')).fontSize) || 190
      c.font = '900 ' + fs + 'px Archivo'
      const wM = c.measureText('A').width
      document.querySelectorAll('.mk__word').forEach(t => t.setAttribute('x', 20 + wM))
      mCx = 20 + wM / 2
    }
    /* A tower crane, in the wordmark's own coordinates: mast off the
       right of the word, a jib long enough to reach the FIRST letter,
       counter-jib and ballast behind it, pendants from the cat head.
       Latticed with real bracing rather than two lines, because at this
       width a bare outline reads as scaffolding poles. */
    const NS = 'http://www.w3.org/2000/svg'
    const crane = document.querySelector('.mk__crane')
    const add = (tag, at, cls) => {
      const e = document.createElementNS(NS, tag)
      for (const k in at) e.setAttribute(k, at[k])
      if (cls) e.setAttribute('class', cls)
      crane.appendChild(e); return e
    }
    const ln = (x1, y1, x2, y2, cls) => add('line', { x1, y1, x2, y2 }, cls)
    {
      const GY = 115, MX = 918, HW = 12
      const MT = -196, JB = JBY, JT = -206, APEX = -246
      const TIP = 24, CJ = 996
      ln(MX - HW, GY, MX - HW, MT); ln(MX + HW, GY, MX + HW, MT)      // mast legs
      for (let y = MT; y < GY; y += 26){                              // lattice
        ln(MX - HW, y, MX + HW, Math.min(y + 26, GY))
        ln(MX + HW, y, MX - HW, Math.min(y + 26, GY))
        ln(MX - HW, y, MX + HW, y)
      }
      ln(MX - 24, GY, MX + 24, GY)                                    // base
      ln(TIP, JB, MX - HW, JB); ln(TIP + 40, JT, MX - HW, JT)         // jib chords
      for (let x = TIP + 40; x < MX - HW; x += 46){                   // jib bracing
        ln(x, JT, Math.min(x + 46, MX - HW), JB)
        ln(Math.min(x + 46, MX - HW), JT, x, JB)
      }
      ln(TIP, JB, TIP + 40, JT)
      ln(MX + HW, JB, CJ, JB); ln(MX + HW, JT, CJ - 16, JT)           // counter-jib
      for (let x = MX + HW; x < CJ - 16; x += 40) ln(x, JT, x + 40, JB)
      add('rect', { x: CJ - 52, y: JB - 4, width: 46, height: 26 })   // ballast
      ln(MX - HW, JT, MX, APEX); ln(MX + HW, JT, MX, APEX)            // cat head
      ln(MX, APEX, 250, JT); ln(MX, APEX, 560, JT)                    // pendants
      ln(MX, APEX, CJ - 26, JT)
      ln(MX - 30, -150, MX - 30, -100); ln(MX - 30, -150, MX - HW, -150) // mast tie
    }
    const trolley = ln(0, JBY, 0, JBY, 'hot')

    placeM()
    document.fonts?.ready.then(placeM)

    /* R.tx  — trolley x along the jib
       R.hoist — 1 at the jib, 0 set on the ground line
       R.a / R.av — swing angle and its rate, integrated per frame */
    const PARK = 790
    const R = { tx: PARK, hoist: 1, a: 0, av: 0, released: false }
    let lastTx = PARK, lastV = 0
    const applyRig = dt => {
      if (dt > 0){
        const v = (R.tx - lastTx) / dt, acc = (v - lastV) / dt
        lastTx = R.tx; lastV = v
        const L = Math.max(40, (CAP_TOP - LIFT * R.hoist) - JBY)
        /* units are SVG units; g is tuned so a ~150-unit rope swings at
           about a second and a half, which reads as mass at this scale */
        /* the trolley covers ~680 units in 1.7 s, so its raw acceleration
           would slam the load into any stop and hold it there. Scale the
           forcing, and when the stop IS hit, reflect the velocity rather
           than just clamping the angle — a clamp alone pins the load at
           the limit for a dozen frames, which reads as a glitch. */
        R.av += (-(2600 / L) * Math.sin(R.a) - 0.16 * acc / L - 1.55 * R.av) * dt
        R.a += R.av * dt
        const STOP = 0.27
        if (Math.abs(R.a) > STOP){ R.a = Math.sign(R.a) * STOP; R.av *= -0.3 }
      }
      /* steadied before it lands: the swing is let out over the last
         fifth of the lower, so the letter touches down plumb */
      const a = R.a * (R.released ? 1 : Math.min(1, R.hoist * 5))
      const L = (CAP_TOP - LIFT * R.hoist) - JBY
      const hx = R.tx + L * Math.sin(a), hy = JBY + L * Math.cos(a)
      trolley.setAttribute('x1', R.tx - 14); trolley.setAttribute('x2', R.tx + 14)
      rope.setAttribute('x1', R.tx); rope.setAttribute('y1', JBY)
      rope.setAttribute('x2', hx);   rope.setAttribute('y2', hy)
      hook.setAttribute('transform', `translate(${hx},${hy - 30}) rotate(${a * 57.2958})`)
      if (!R.released)
        setG.setAttribute('transform',
          `translate(${hx - mCx},${hy - CAP_TOP}) rotate(${a * 57.2958},${mCx},${CAP_TOP})`)
    }
    applyRig(0)

    /* Scrubbed, not played. As a timed animation it fired while you were
       still scrolling toward the footer and was usually over before you
       reached it — all you saw was an empty hook going home. Tied to
       scroll, you drive the crane: scroll down and it carries the M out
       and sets it; scroll back up and it picks the M up out of its slot
       and takes it back to the mast. */
    const lift = gsap.timeline({ paused: true })
      .to(R, { tx: () => mCx, duration: 1.6, ease: 'power2.inOut' })   // travel out
      .to({}, { duration: 0.35 })                                       // let it swing
      .to(R, { hoist: 0.2, duration: 0.9, ease: 'power2.in' })          // run down
      .to(R, { hoist: 0,   duration: 0.8, ease: 'power3.out' })         // creep on
      .addLabel('set')
      .to({}, { duration: 0.25 })
      .to(R, { hoist: 1.05, duration: 0.9, ease: 'power2.inOut' })      // hook home
      .to(R, { tx: PARK,  duration: 1.2, ease: 'power2.inOut' }, '<0.2')
    const SET_P = lift.labels.set / lift.duration()

    let rigT = 0
    /* refreshPriority -2: the method pin above refreshes at -1 and adds
       4,600px of spacing. Anything below it on the page must refresh
       AFTER it, or it measures its position without that spacing and
       fires four and a half screens early — which is exactly why the
       original timed version was always over before you got here. */
    /* The footer is the last thing on the page, so a scrub that runs to
       the end of the scroll only ever got ~440px — the whole lift over
       less than half a screen. Pin the footer instead: it holds still,
       the crane is in full view, and the lift gets 130% of a screen to
       play out in. */
    ScrollTrigger.create({
      /* 220% of a screen: the lift is a slow, heavy thing and should
         take a deliberate scroll, not a flick */
      trigger: '.foot', start: 'bottom bottom', end: '+=220%',
      pin: true, refreshPriority: -2,
    })
    /* The pin and the scrub are separate on purpose. On the LAST element
       of a page GSAP's pin spacer does not add the full duration — this
       one came up 375px short, so a lift mapped to the pin's own end ran
       past the bottom of the page and its last 29% (hook home, trolley
       back) could never be reached. Mapped to 'max' instead, and
       refreshed after the pin, the lift ends exactly where the scroll
       does, whatever the spacer turns out to be. */
    ScrollTrigger.create({
      trigger: '.foot', start: 'bottom bottom', end: 'max',
      /* scrub 1.6 — the load trails the wheel by over a second and a half,
         so it keeps moving after you stop, the way a hanging load would */
      animation: lift, scrub: 1.6, refreshPriority: -3,
    })
    /* Drawn every frame, ungated. It was gated on a "footer is near"
       trigger, but a trigger's end is exclusive — scroll straight to the
       last pixel of the page and it reads inactive, so the finished state
       was never drawn and the M sat back on the hook. Six attribute writes
       a frame do not need a guard. */
    gsap.ticker.add(() => {
      const now = performance.now()
      const dt = rigT ? Math.min(0.05, (now - rigT) / 1000) : 0
      rigT = now
      /* past the set point the letter belongs to the word, not the hook;
         scroll back before it and the hook has it again — at hoist 0, so
         there is nothing to jump */
      R.released = lift.progress() >= SET_P - 1e-4
      if (R.released) setG.setAttribute('transform', 'translate(0,0)')
      applyRig(dt)
    })

    /* .mk__word, not .mk--built — the M carries the same classes and a
       rise-from-below tween on it would fight the set-down */
    gsap.from('.mk__word.mk--built', {              // raised out of the ground
      y: 99, duration: 1.15, ease: 'power3.out',
      scrollTrigger: { trigger: '.foot__mark', start: 'top 88%', refreshPriority: -2 },
    })
    gsap.from('.mk__word.mk--buried', {
      opacity: 0, duration: 1.1, delay: .35, ease: 'power2.out',
      scrollTrigger: { trigger: '.foot__mark', start: 'top 88%', refreshPriority: -2 },
    })
    gsap.from('.mk__ground', {
      scaleX: 0, transformOrigin: '0 50%', duration: 1.1, ease: 'power3.inOut',
      scrollTrigger: { trigger: '.foot__mark', start: 'top 90%', refreshPriority: -2 },
    })
  }
}

/* cursor */
const cur  = document.querySelector('.cursor')
const curs = document.querySelector('.curs')
const curTag = curs.querySelector('.curs__tag')
/* The dot is the position; the reticle is always a few frames behind it
   and catches up — which is the whole read of the thing. */
const cp = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2,
             rx: innerWidth / 2, ry: innerHeight / 2 }
let stillT = 0
function wake(){
  clearTimeout(stillT)
  cur.classList.remove('still'); curs.classList.remove('still')
  stillT = setTimeout(() => { cur.classList.add('still'); curs.classList.add('still') }, 1500)
}
addEventListener('pointermove', e => {
  cp.tx = e.clientX; cp.ty = e.clientY
  if (!curs.classList.contains('ready')) curs.classList.add('ready')
  wake()
}, { passive: true })
addEventListener('pointerdown', () => curs.classList.add('down'))
addEventListener('pointerup',   () => curs.classList.remove('down'))
/* off the window entirely, both halves go rather than park at the edge */
addEventListener('pointerleave', () => { curs.classList.remove('ready'); cur.style.opacity = '0' })
addEventListener('pointerenter', () => { curs.classList.add('ready');    cur.style.opacity = '' })
;(function curLoop(){
  cp.x += (cp.tx - cp.x) * 0.34; cp.y += (cp.ty - cp.y) * 0.34   // the dot, sharp
  cp.rx += (cp.tx - cp.rx) * 0.13; cp.ry += (cp.ty - cp.ry) * 0.13  // the reticle, settling
  cur.style.transform  = `translate(${cp.x}px,${cp.y}px)`
  curs.style.transform = `translate(${cp.rx}px,${cp.ry}px)`
  requestAnimationFrame(curLoop)
})()
/* A plate says what the click would do; everything else just opens. */
document.querySelectorAll('a,button,.cap,.plate,.xray').forEach(el => {
  const tag = el.dataset.cursor || (el.classList.contains('plate') ? 'View' : '')
  el.addEventListener('pointerenter', () => {
    if (tag){ curTag.textContent = tag; curs.classList.add('tag'); cur.classList.add('hide') }
    else curs.classList.add('on')
  })
  el.addEventListener('pointerleave', () => {
    curs.classList.remove('on', 'tag'); cur.classList.remove('hide')
  })
})

/* ══════════════════════════════════════════════════════════════════
   BOOT — hold the loader until frames are actually on screen
   ══════════════════════════════════════════════════════════════════ */
const LD = { el: document.getElementById('loader'),
             n: document.getElementById('ldn'),
             task: document.getElementById('ldtask'),
             bar: document.querySelector('.ld__bar i') }
const TASKS = [[0,'Sourcing'],[28,'Setting out'],[54,'Cutting'],
               [78,'Polishing'],[96,'Hallmarking']]

/* three odometer columns, hundreds → units */
const digits = [0, 1, 2].map(() => {
  const d = document.createElement('span'); d.className = 'ld__d'
  const col = document.createElement('i')
  col.innerHTML = '<b>0</b><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b>' +
                  '<b>6</b><b>7</b><b>8</b><b>9</b><b>0</b>'
  d.appendChild(col); LD.n.appendChild(d); return col
})

/* the tape: a tick every 2, a taller one every 10 */
{
  const ticks = document.querySelector('.ld__ticks')
  for (let i = 0; i <= 100; i += 2){
    const t = document.createElement('i')
    t.style.left = i + '%'
    t.style.height = i % 10 ? '4px' : '9px'
    ticks.appendChild(t)
  }
  const stages = document.querySelector('.ld__stages')
  TASKS.forEach(([at], i) => {
    const el = document.createElement('span')
    el.className = 'ld__stage'; el.style.left = at + '%'
    el.textContent = String(i + 1).padStart(2, '0')
    stages.appendChild(el)
  })
}
const stageEls = [...document.querySelectorAll('.ld__stage')]
let taskIx = -1

const o = { v: 0 }
/* Not a single sweep: the programme moves in stages and pauses between
   them, the same cure-hold rhythm the frame is built on. */
const boot = gsap.timeline()
TASKS.map(t => t[0]).concat(100).slice(1).forEach((to, i) => {
  boot.to(o, { v: to, duration: [0.95, 0.86, 0.82, 0.68, 0.5][i], ease: 'power2.inOut' })
      .to({}, { duration: [0.22, 0.19, 0.17, 0.13, 0][i] })
})
/* A column that rolls continuously is a blur of half-glyphs at this
   size. A real odometer sits on its digit and flicks over at the end of
   the cycle, so each column holds for the first 72% and turns in the
   last 28% — which is what makes it read as mechanism rather than mush.
   flick() is that turn, 0 → 1, over the fraction of a single step. */
const flick = f => {
  const e = Math.min(1, Math.max(0, (f - 0.72) / 0.28))
  return e * e * (3 - 2 * e)
}
/* And the turn has to CARRY. Giving each column its own fraction of its
   own cycle (v/100 for the hundreds) is wrong: the hundreds column then
   starts creeping toward 1 from v=72 and reads 196 at ninety-six. A
   column may only move while the column beneath it is wrapping 9 → 0,
   which is what these carries are. */
const odo = v => {
  const f  = flick(v - Math.floor(v))
  const d0 = Math.floor(v) % 10,        c0 = d0 === 9 ? f  : 0
  const d1 = Math.floor(v / 10) % 10,   c1 = d1 === 9 ? c0 : 0
  const d2 = Math.floor(v / 100) % 10
  return [d2 + c1, d1 + c0, d0 + f]
}
boot.eventCallback('onUpdate', () => {
  const v = o.v
  const seat = 0.13                       // measured ink top inside the cell
  const pos = odo(v)
  digits[0].style.transform = `translateY(${-pos[0] - seat}em)`
  digits[1].style.transform = `translateY(${-pos[1] - seat}em)`
  digits[2].style.transform = `translateY(${-pos[2] - seat}em)`
  LD.bar.style.width = v + '%'
  for (let i = TASKS.length - 1; i >= 0; i--){
    if (v < TASKS[i][0]) continue
    stageEls[i].classList.add('hit')
    if (i !== taskIx){
      taskIx = i
      gsap.fromTo(LD.task, { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: .45, ease: 'power3.out',
          onStart(){ LD.task.textContent = TASKS[i][1] } })
    }
    break
  }
})
boot.eventCallback('onComplete', function(){
    /* struck, not faded: the panel lifts like formwork coming off, and
       the content lags behind it so the thing has some weight. */
    gsap.to('.ld__row, .ld__tape', { y: -34, opacity: 0, duration: .5, ease: 'power2.in' })
    gsap.to(LD.el, { yPercent: -100, duration: 1.25, ease: 'power4.inOut', delay: .16 })
    document.body.classList.remove('lock')
    ScrollTrigger.refresh()
    gsap.to(S, { intro: 0, duration: 3.2, ease: 'power3.out' })   // camera settles onto the first shot
    gsap.to(SCAN, { h: SCAN_TOP, duration: 4.2, ease: 'power2.inOut', delay: 0.3 })   // drawn, then built
    revealChars(acts[0])
    lenis?.start()
    gsap.from('.hero__in > *', { y: 26, opacity: 0, duration: 1,
      stagger: .12, ease: 'power3.out' })
    setTimeout(() => LD.el.remove(), 1400)
})

window.__massif = { scene, camera, renderer, S, SWING, applyState, placeCamera, site, crane, building, PLATES,
  SCAN, LIVE, CLAD, floors, loadBeam, roofBeam, groundBeam, updateScan, updateHUD, updateNotes, updateSparks, spLife, get lenis(){ return lenis } }
