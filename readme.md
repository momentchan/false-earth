# False Earth


<img width="2559" height="1593" alt="螢幕擷取畫面 2026-02-09 173835" src="https://github.com/user-attachments/assets/85adc859-7ab1-44e1-91db-2a9f884c00f4" />

</br>

🔗 **[Live Demo](https://false-earth.mingjyunhung.com/)**
🔗 **[Article](https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/)**


**False Earth** is an interactive WebGPU experience that continues the journey of [Drift](https://github.com/momentchan/drift) - presenting a continuous landscape generated in real time through GPU-based simulations.



Set after the long drift through space, the project follows an astronaut who arrives on a surface that resembles Earth, yet does not behave like one. As the astronaut moves forward, the ground responds and transforms, leaving visible traces across an endless field. Rather than telling a story through words, the experience unfolds through motion and change—where distance never closes and the environment reveals its nature only through interaction. By navigating this unfamiliar terrain, visitors encounter a world that appears stable at first glance, but gradually exposes uncertain form.


## 💡 Attribution
If you use this project in your own work, please provide credit to the author. 

**Author:** Ming-Jyun Hung  
**Source:** [https://mingjyunhung.com/](https://mingjyunhung.com/)


---

Built with React Three Fiber and Three.js WebGPU (TSL): GPU-computed grass, procedural terrain, VAT roses, and a playable character.

## Features

- **WebGPU grass**: Compute shaders (TSL) for blade position, Voronoi clumping, wind, terrain sampling, and character push
- **Stable, tile-free pattern**: PCG hash for jitter and seeds (no `sin`/`mod`), CPU grid index for stable snapping
- **LOD**: Distance-based LOD with configurable segment counts and draw buffers
- **Procedural terrain**: FBM-based height and normals sampled in compute
- **VAT roses**: Vertex Animation Texture roses with LOD and compute-driven spawn/update
- **Character**: Third-person character with camera modes (Follow / FPV / Detached), grass push interaction
- **Cosmic beams**: Animated beam effects in a separate scene
- **Post-processing**: TSL pipeline with Bloom, DoF, SMAA; PerformanceMonitor for adaptive DPR

## Tech Stack

- **React Three Fiber** – React renderer for Three.js
- **Three.js WebGPU** – WebGPU renderer and backend
- **TSL (Three Shading Language)** – Compute and vertex/fragment in TypeScript (no raw GLSL for grass)
- **Vite** – Build and dev server
- **Leva** – Debug controls
- **Zustand** – Game state (camera, character, WebGPU error, etc.)
- **r3f-perf** – Performance monitoring and DPR scaling

## Installation

```bash
npm install
npm run dev    # HTTPS dev server
npm run build
npm run preview
```

## Project Structure

```
src/
├── app/
│   └── App.tsx                 # Canvas, WebGPU init, PerformanceMonitor, DPR context
├── components/
│   ├── grass/                  # WebGPU procedural grass
│   │   ├── core/
│   │   │   ├── config.ts      # Blades, LOD segments, structure (data0–data3)
│   │   │   ├── grassCompute.ts # Position, Voronoi, terrain, wind, push (TSL)
│   │   │   ├── grassMaterial.ts # Vertex unpack + Bezier blade (TSL)
│   │   │   ├── grassGeometry.ts # Instance buffer, no positions buffer
│   │   │   └── shaderHelpers.ts # Bezier, wind, PCG hash (hash2to1, hash2to2)
│   │   ├── GrassWebGPU.tsx     # R3F WebGPU grass root, grid snapping
│   │   ├── GrassLOD.tsx        # LOD draw buffers and compute dispatch
│   │   └── hooks/
│   │       ├── useGrassCompute.ts
│   │       └── useGrassUniforms.ts
│   ├── Rose/                   # VAT flowers
│   │   ├── core/               # vatCompute, vatMaterial, config
│   │   ├── Rose.tsx / RoseLOD.tsx
│   │   └── hooks/
│   ├── character/              # Character mesh, physics, camera
│   ├── cosmic/                  # Beam effects
│   ├── Effects/                 # Post-processing (Bloom, DoF, SMAA)
│   ├── camera/                 # CameraViewControl, follow/FPV
│   ├── audio/                  # AudioManager, BGM, one-shot
│   ├── Terrain.tsx
│   └── DirectionalLight.tsx
├── core/
│   ├── shaders/                # Terrain, wind, uniforms (TSL helpers)
│   ├── store/                  # gameStore (Zustand)
│   ├── utils/                  # gridSnapping, DeviceDetector, etc.
│   └── input/                  # Keyboard, touch
├── ui/                         # LoadingScreen, SideBar, AudioButton, etc.
└── debug/                      # LevaWrapper, WebGPUPerf
```

## Key Components

- **Grass**: Compute writes packed per-blade data (position, width/height/bend, rotation, normal, push); material reads only that buffer and builds Bezier blades. Grid snapping uses one blade spacing; CPU passes `uGridIndex` for stable seeds.
- **Terrain**: FBM height and normals; sampled in grass compute and applied to blade bases.
- **Rose**: VAT playback with compute for spawn, lifecycle, and LOD routing.
- **Effects**: TSL post pass combining main scene + beam scene (Bloom, DoF, SMAA).

## Development

- **TypeScript** throughout
- **TSL** for all grass and effects shaders (no `vite-plugin-glsl` for grass)
- **HTTPS** for dev (required for WebGPU in many environments)
- **Path alias**: `@packages/*` for shared packages
