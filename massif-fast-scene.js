/* page-speed: three.js and its addons are loaded by the worker (massif-fast-gl.js), not here */
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
  dial:      'img/dial.webp',  // collections: Rolex / sports watches
  bezel:      'img/bezel.webp',  // dress watches and complications
  bracelet:      'img/bracelet.webp',  // bracelets and straps
  movement:       'img/movement.webp',  // movements and servicing
  service: 'img/service.webp',  // trade-in and valuation
}
document.querySelectorAll('[data-art]').forEach(el => {
  el.style.backgroundImage = `url(${PLATES[el.dataset.art]})`
})

/* ══════════════════════════════════════════════════════════════════
   THE 3D — page-speed version: in a worker.

   massif-fast-gl.js runs this file's original "THE 3D" part (the maquette,
   the crane, the scan, sparks, beacons, telemetry, annotations, the act-two
   aggregate and the render loop) verbatim, in a Web Worker, on the #scene
   canvas transferred to an OffscreenCanvas (massif-fast.js started it while
   the libraries loaded). What stays here is what the rest of this file
   shares with it: the values the scroll code drives, posted to the worker
   once per frame, and the canvas itself, which this file still fades. The
   worker posts back its writes to the telemetry panel and the annotations,
   which massif-fast.js applies to the real elements.
   ══════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('scene')
const GL = window.__massifGL
let lenis = null
const SCAN = { h: 0 }
const SCAN_TOP = 80
const CLAD = { v: 4 }
const S = { p: 0, target: 0, intro: 1, act: 0 }
const ACT2 = { on: false, g: 0, i: 0 }
let sceneAlpha = 1
const clamp01 = x => Math.min(1, Math.max(0, x))
const ss   = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const AGG_FORMS = { length: 5 }                     // the aggregate's five forms (worker)
function aShape(g){
  const k = Math.min(AGG_FORMS.length - 2, Math.max(0, Math.floor(g)))
  /* the change must also FINISH early, or the last stage is still
     half dispersed when the section runs out of scroll */
  return { k, f: ss(0.45, 0.85, clamp01(g - k)) }
}
const lvlEl = document.querySelector('.lvl')
/* the set-up below runs under the loader; it yields between its blocks */
const nextTask = () => globalThis.scheduler?.yield ? scheduler.yield() : new Promise(r => setTimeout(r, 0))
/* act two's toggle also switches the model: the worker runs those lines */
const applyOffset = () => GL.post({ t: 'act2', on: ACT2.on })
const site = {}, scanGroup = {}, aPoints = {}, SWING = {}

addEventListener('resize', () => { GL.post({ t: 'size', w: innerWidth, h: innerHeight }); ScrollTrigger.refresh() })
let pm = null
addEventListener('pointermove', e => { pm = [e.clientX, e.clientY] })
/* one frame of the worker per animation frame, never more than one in flight */
;(function frame(){
  if (GL.idle()){
    GL.frame({ t: 'f', pm, target: S.target, intro: S.intro, act: S.act, g: ACT2.g, i: ACT2.i,
               scan: SCAN.h, clad: CLAD.v, alpha: sceneAlpha, lenis: !!lenis })
    pm = null
  }
  requestAnimationFrame(frame)
})()

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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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

await nextTask()
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
/* page-speed: the odometer now runs while the model is still being built in
   the worker; the panel is struck only once the worker has drawn the model */
boot.eventCallback('onComplete', () => GL.ready.then(function(){
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
}))

window.__massif = { S, SCAN, CLAD, ACT2, PLATES, GL, get lenis(){ return lenis } }
