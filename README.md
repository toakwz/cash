# AURUM — Fine Watches & Jewellery

Scroll-driven landing page (three.js, GSAP, ScrollTrigger, Lenis).

## Folder
- index.html
- js/ : massif-scene.js (original module, fallback), massif-fast-scene.js + massif-fast-gl.js (3D in a worker)
- img/ : dial, bezel, bracelet, movement, service — each as .jpg AND .webp (placeholders; replace with your own, same names)

## View
Serve the folder (browsers block modules from file://):

    python3 -m http.server 8000

Open http://localhost:8000. Needs internet for the libraries and Google Fonts.
