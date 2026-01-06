# Procedural Grass

A procedural 3D grass rendering demo built with React Three Fiber, featuring GPU-computed grass blades, dynamic terrain generation, and custom shaders.

This implementation is inspired by the procedural grass system featured in **Ghost of Tsushima**, which showcases GPU-based grass rendering techniques for creating realistic, dynamic grass fields. For more details on the original implementation, see the GDC talk: [Procedural Grass in 'Ghost of Tsushima'](https://gdcvault.com/play/1027033/Advanced-Graphics-Summit-Procedural-Grass) by Eric Wohllaib from Sucker Punch Productions.

https://github.com/user-attachments/assets/283c42c2-a126-4e54-8be9-57bf9ab736a8

## Features

- 🌱 **Procedural Grass Rendering**: GPU-computed grass blades with realistic wind animation and physics simulation
- 🏔️ **Dynamic Terrain**: Procedurally generated terrain using fractional Brownian motion (FBM) with customizable height, frequency, and seed
- 🎨 **Custom Shaders**: GLSL shaders for grass vertex and fragment rendering with lighting and wind effects
- 🌅 **Procedural Background**: Dynamic sky and procedural sphere backgrounds that respond to sun position
- 🎛️ **Interactive Controls**: Real-time parameter adjustment via Leva controls for grass, terrain, and lighting
- ✨ **Post-Processing**: Visual effects including SMAA anti-aliasing and custom post-processing pipelines

## Tech Stack

- **React Three Fiber** - React renderer for Three.js
- **Three.js** - 3D graphics library
- **Custom Shader Materials** - Shader customization
- **GPGPU Compute** - GPU-based grass blade simulation
- **Leva** - Interactive controls GUI
- **Vite** - Build tool and dev server
- **GLSL** - Shader programming

## Installation

```bash
# Install dependencies
npm install

# Run the development server (HTTPS enabled)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

The application runs on HTTPS by default. Once started, you can:

- **Navigate**: Use mouse/trackpad to orbit around the scene
- **Adjust Parameters**: Use the Leva controls panel (collapsed by default) to modify:
  - Grass geometry (blade count, segments, height, width)
  - Grass appearance (colors, wind strength, lighting)
  - Terrain parameters (amplitude, frequency, seed, color)
  - Background settings (procedural sphere or sky)
  - Lighting and camera controls

## Project Structure

```
src/
├── app/
│   └── App.tsx              # Main application component
├── components/
│   ├── Grass.tsx            # Main grass component with GPU compute
│   ├── Terrain.tsx          # Procedural terrain generation
│   ├── Effects.tsx          # Post-processing effects
│   ├── DirectionalLight.tsx # Dynamic lighting
│   ├── background/          # Background components
│   │   ├── Background.tsx
│   │   ├── ProceduralSphere.tsx
│   │   └── Sky.tsx
│   └── grass/               # Grass-specific modules
│       ├── constants.ts     # Configuration constants
│       ├── hooks/
│       │   └── useGrassCompute.ts  # GPU compute hook
│       ├── shaders/         # GLSL shaders
│       │   ├── grassComputeShader.glsl
│       │   ├── grassVertex.glsl
│       │   └── grassFragment.glsl
│       └── utils.ts         # Utility functions
packages/
└── r3f-gist/                # Shared R3F utilities and components
```

## Key Components

### Grass Component
Renders thousands of grass blades using GPU compute shaders for physics simulation. Features:
- Wind animation
- Blade bending and deformation
- Dynamic lighting response
- Customizable appearance

### Terrain Component
Generates procedural terrain using FBM noise functions with real-time height displacement.

### Background Components
- **ProceduralSphere**: Custom shader-based sphere background
- **Sky**: Three.js Sky component with sun positioning

## Development

The project uses:
- **TypeScript** for type safety
- **GLSL** shaders imported via `vite-plugin-glsl`
- **Path aliases** (`@packages`) for shared utilities
- **HTTPS** for local development (required for some WebGL features)

## License

MIT License
