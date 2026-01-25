# Overall Refactor Plan

## Executive Summary
This document outlines a comprehensive refactoring plan for the r3f-procedural-grass-webgpu codebase. The refactoring focuses on improving code organization, reducing duplication, enhancing type safety, and establishing better architectural patterns.

---

## 1. File Structure & Organization

### 1.1 Current Issues
- Mixed concerns in root-level components
- Inconsistent directory structure
- Some utilities scattered across component folders
- Missing clear separation between core logic and UI components

### 1.2 Proposed Structure

**Rationale for Constants & Types Organization:**
- **Feature-specific constants/types** stay with their features in a single `config.ts` file (combines constants, types, and config)
- **Only truly shared types** go in `core/types/` (e.g., `TerrainUniforms` used by grass, character, and terrain)
- This keeps related code together, making it easier to find and maintain
- Reduces unnecessary indirection and file proliferation
- Simpler structure: one `config.ts` per feature instead of separate `constants.ts` and `types.ts` files
```
src/
├── app/                          # Application entry & setup
│   ├── App.tsx
│   └── index.jsx
│
├── core/                         # Core game systems (shared logic)
│   ├── types/                    # Only truly shared types (used across multiple systems)
│   │   ├── terrain.ts            # TerrainUniforms (used by grass, character, terrain)
│   │   ├── wind.ts              # WindUniforms (used by grass, rose, wind)
│   │   └── index.ts
│   ├── shaders/                  # Shared shader utilities
│   │   ├── terrain/
│   │   │   ├── terrainHelpers.ts
│   │   │   └── terrainMath.ts (deprecated, remove)
│   │   ├── wind/
│   │   │   └── windHelpers.ts
│   │   └── common/
│   │       └── mathHelpers.ts
│   └── utils/                    # Pure utility functions
│       ├── gridSnapping.ts
│       └── math.ts
│
├── components/                   # React components
│   ├── grass/
│   │   ├── GrassWebGPU.tsx      # Main component (simplified)
│   │   ├── GrassLOD.tsx
│   │   └── core/                 # Grass-specific core logic
│   │       ├── grassCompute.ts
│   │       ├── grassMaterial.ts
│   │       ├── grassGeometry.ts
│   │       ├── shaderHelpers.ts
│   │       ├── uniforms.ts
│   │       ├── grassControls.ts
│   │       ├── config.ts         # Constants, types, and config combined
│   │       └── windHelpers.ts (move to core/shaders/wind/)
│   │
│   ├── character/
│   │   ├── Character.tsx
│   │   ├── hooks/
│   │   │   ├── useCharacterAssets.ts
│   │   │   ├── useCharacterPhysics.ts
│   │   │   ├── useCharacterTrail.ts
│   │   │   └── index.ts
│   │   ├── config.ts             # Constants and types combined
│   │   └── index.ts
│   │
│   ├── cosmic/
│   │   ├── CosmicSystem.tsx      # Orchestrator (simplified)
│   │   ├── CosmicBeams.tsx
│   │   ├── CosmicBeamMaterial.ts
│   │   ├── config.ts             # Constants and types (if needed)
│   │   └── hooks/
│   │       └── useCosmicWaves.ts
│   │
│   ├── rose/
│   │   ├── Rose.tsx
│   │   ├── RoseSpawner.tsx
│   │   └── core/
│   │       ├── vatCompute.ts
│   │       ├── vatMaterial.ts
│   │       ├── config.ts         # Constants and types combined
│   │       └── index.ts
│   │
│   ├── terrain/
│   │   ├── Terrain.tsx
│   │   └── config.ts            # Terrain-specific constants (types mostly in core/types/terrain.ts)
│   │
│   ├── wind/
│   │   └── Wind.tsx             # Constants/types in core/types/wind.ts if needed
│   │
│   ├── camera/
│   │   ├── CameraViewControl.tsx
│   │   └── index.ts
│   │
│   ├── background/
│   │   ├── Background.tsx
│   │   └── Stars.tsx
│   │
│   ├── effects/
│   │   └── Effects.tsx
│   │
│   └── debug/
│       ├── DebugModeToggle.tsx
│       ├── GrassCullingDebug.tsx
│       └── NormalSphere.tsx
│
├── store/                        # State management
│   ├── gameStore.ts              # Main store (organized with clear sections)
│   └── types.ts
│
└── setup/                        # Setup & configuration
    └── setupDevtoolsPatch.ts
```

### 1.3 Actions
1. Create `core/` directory for shared logic
2. Move terrain helpers to `core/shaders/terrain/`
3. Move wind helpers to `core/shaders/wind/`
4. Combine feature-specific constants/types into single `config.ts` files
5. Move only truly shared types to `core/types/` (TerrainUniforms, WindUniforms)
6. Remove deprecated `TerrainMath.ts` (GLSL version)
7. Keep grass core files flat (no unnecessary subdirectories for single files)

---

## 2. Code Duplication & Reusability

### 2.1 Issues Identified
- Terrain height/normal calculation duplicated (TSL vs GLSL)
- Wind calculation logic scattered
- Uniform management duplicated across components
- Similar shader helper patterns repeated

### 2.2 Solutions

#### 2.2.1 Create Shared Shader Utilities
- **File**: `core/shaders/wind/windHelpers.ts`
  - Consolidate all wind-related shader functions
  - Export reusable TSL functions

- **File**: `core/shaders/terrain/terrainHelpers.ts`
  - Keep only TSL version
  - Remove GLSL `TerrainMath.ts`

#### 2.2.2 Create Uniform Manager
- **File**: `core/utils/uniformManager.ts`
  - Centralized uniform creation/update utilities
  - Type-safe uniform builders

#### 2.2.3 Extract Common Patterns
- **File**: `core/shaders/common/mathHelpers.ts`
  - Bezier functions
  - Easing functions
  - Vector utilities

### 2.3 Actions
1. Extract wind helpers to shared location
2. Remove duplicate terrain math (keep TSL only)
3. Create uniform manager utility
4. Extract common shader math functions

---

## 3. Type Safety Improvements

### 3.1 Current Issues
- Excessive use of `any` types
- Missing interfaces for complex objects
- Inconsistent type definitions
- Some props not properly typed

### 3.2 Improvements

#### 3.2.1 Create Comprehensive Type Definitions
```typescript
// components/grass/core/config.ts (combines constants and types)
export interface GrassUniforms {
  uTime: ReturnType<typeof uniform>;
  uWindDir: ReturnType<typeof uniform>;
  // ... all grass uniforms
}

export interface GrassComputeUniforms extends GrassUniforms {
  // ... compute-specific uniforms
}

export interface GrassMaterialUniforms extends GrassUniforms {
  // ... material-specific uniforms
}

// Only shared types in core/types/ (TerrainUniforms, WindUniforms)
```

#### 3.2.2 Type Store Sections
```typescript
// store/gameStore.ts
// Organize types by section for clarity
interface CameraState {
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
}

interface CharacterState {
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;
}

// Combine into GameState interface
```

#### 3.2.3 Type Component Props
- All component props should have explicit interfaces
- Remove `any` from function parameters
- Use generic types where appropriate

### 3.3 Actions
1. Create type definitions for all uniforms
2. Type all store slices
3. Replace `any` with proper types
4. Add JSDoc comments for complex types

---

## 4. State Management Refactoring

### 4.1 Current Issues
- Mixed concerns in one store file
- No clear organization/separation
- Uniform management mixed with component state
- Hard to see what state belongs to which system

### 4.2 Proposed Structure

#### 4.2.1 Organize Store with Clear Sections
```typescript
// store/gameStore.ts
interface GameState {
  // ===== Camera State =====
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  
  // ===== Character State =====
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;
  
  // ===== Terrain State =====
  terrainUniforms: TerrainUniforms | null;
  setTerrainUniforms: (uniforms: TerrainUniforms | null) => void;
  
  // ===== Wind State =====
  windUniforms: WindUniforms | null;
  setWindUniforms: (uniforms: WindUniforms | null) => void;
  
  // ===== Cosmic/Wave State =====
  waveStorageBuffer: THREE.StorageBufferAttribute | null;
  setWaveStorageBuffer: (buffer: THREE.StorageBufferAttribute | null) => void;
  activeWaveCount: number;
  setActiveWaveCount: (count: number) => void;
  roseRef: React.MutableRefObject<RoseHandle | null> | null;
  setRoseRef: (ref: React.MutableRefObject<RoseHandle | null> | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Camera
  cameraMode: CameraMode.TPS,
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleCameraMode: () => set((state) => ({
    cameraMode: (state.cameraMode + 1) % 3
  })),
  
  // Character
  characterRef: null,
  setCharacterRef: (ref) => set({ characterRef: ref }),
  
  // Terrain
  terrainUniforms: null,
  setTerrainUniforms: (uniforms) => set({ terrainUniforms: uniforms }),
  
  // Wind
  windUniforms: null,
  setWindUniforms: (uniforms) => set({ windUniforms: uniforms }),
  
  // Cosmic
  waveStorageBuffer: null,
  setWaveStorageBuffer: (buffer) => set({ waveStorageBuffer: buffer }),
  activeWaveCount: 0,
  setActiveWaveCount: (count) => set({ activeWaveCount: count }),
  roseRef: null,
  setRoseRef: (ref) => set({ roseRef: ref }),
}));
```

#### 4.2.2 Benefits of Single File
- Simpler structure - no need to jump between files
- All state visible in one place
- Clear section comments organize by feature
- Easier to understand the full state at a glance

### 4.3 Actions
1. Organize store with clear section comments
2. Group related state together
3. Document which state should be global vs local
4. Keep it as a single file for simplicity

---

## 5. Component Refactoring

### 5.1 Large Components to Split

#### 5.1.1 CosmicSystem.tsx
**Current**: 168 lines, handles orchestration, spawning, wave triggering
**Proposed**:
- `CosmicSystem.tsx` - Main orchestrator (simplified)
- `hooks/useCosmicBeamSpawner.ts` - Beam spawning logic
- `hooks/useCosmicWaveTrigger.ts` - Wave triggering logic
- `utils/beamPositionValidator.ts` - Position validation

#### 5.1.2 GrassWebGPU.tsx
**Current**: 257 lines, handles setup, uniforms, compute, rendering
**Proposed**:
- `GrassWebGPU.tsx` - Main component (simplified)
- `hooks/useGrassSetup.ts` - Initialization logic
- `hooks/useGrassUniforms.ts` - Uniform management
- `hooks/useGrassCompute.ts` - Compute shader management

#### 5.1.3 Effects.tsx
**Current**: 265 lines, handles all post-processing
**Proposed**:
- `Effects.tsx` - Main component (simplified)
- `hooks/usePostProcessing.ts` - Post-processing setup
- `hooks/useDepthOfField.ts` - DoF logic
- `hooks/useBloom.ts` - Bloom logic
- `hooks/useSMAA.ts` - SMAA logic

#### 5.1.4 CameraViewControl.tsx
**Current**: 216 lines, handles all camera modes
**Proposed**:
- `CameraViewControl.tsx` - Main component
- `hooks/useFPVCamera.ts` - FPV camera logic
- `hooks/useTPSCamera.ts` - TPS camera logic
- `hooks/useFreeCamera.ts` - Free camera logic
- `utils/cameraHelpers.ts` - Helper functions

### 5.2 Actions
1. Extract hooks from large components
2. Create utility functions for complex logic
3. Simplify main components to orchestration only
4. Improve component composition

---

## 6. Shader Code Organization

### 6.1 Current Issues
- Very large shader files (grassCompute.ts: 508 lines, shaderHelpers.ts: 572 lines)
- Mixed concerns in single files
- Wave logic mixed with other helpers
- Some functions could be better organized

### 6.2 Proposed Organization

#### 6.2.1 Split shaderHelpers.ts
```
core/shaders/common/
├── bezier.ts          # Bezier curve functions
├── easing.ts          # Easing functions
├── math.ts            # General math utilities
└── vectors.ts         # Vector utilities

components/grass/core/
├── windEffects.ts     # Wind-specific effects
├── characterEffects.ts # Character interaction effects
├── waveEffects.ts     # Wave/shockwave effects
└── terrainEffects.ts # Terrain alignment effects
```

#### 6.2.2 Organize grassCompute.ts
- Split into logical sections with clear comments
- Extract complex functions (e.g., `getClumpInfo`, `performCulling`)
- Create helper modules for specific computations

### 6.3 Actions
1. Split large shader helper files
2. Organize by concern (wind, terrain, character, waves)
3. Extract complex compute functions
4. Add clear section comments

---

## 7. Constants & Configuration

### 7.1 Current Issues
- Constants scattered across files
- Magic numbers in code
- Some configuration mixed with logic

### 7.2 Proposed Structure
```typescript
// components/grass/core/config.ts
// Combines constants, types, and configuration in one file

export const GRASS_CONSTANTS = {
  DEFAULT_BLADES_PER_AXIS: 1024,
  DEFAULT_GRASS_AREA_SIZE: 80,
  DEFAULT_GRID_DIVISIONS: 1024,
  // ... all grass constants
} as const;

export interface GrassUniforms {
  uTime: ReturnType<typeof uniform>;
  uWindDir: ReturnType<typeof uniform>;
  // ... all grass uniforms
}

export interface GrassComputeUniforms extends GrassUniforms {
  // ... compute-specific uniforms
}

// Only truly shared types go in core/types/ (TerrainUniforms, WindUniforms)
```

### 7.3 Actions
1. Combine constants and types into single `config.ts` files per feature
2. Remove magic numbers
3. Create typed constant objects
4. Document constant purposes
5. Only move types to `core/types/` if truly shared across multiple systems

---

## 8. Import Organization

### 8.1 Current Issues
- Inconsistent import ordering
- Some circular dependencies possible
- Mixed import styles

### 8.2 Proposed Standard
```typescript
// 1. External libraries
import { useEffect } from 'react';
import * as THREE from 'three/webgpu';

// 2. React Three Fiber
import { useFrame, useThree } from '@react-three/fiber';

// 3. Internal core utilities
import { GRASS_CONSTANTS } from '@/core/constants';
import { getTerrainHeight } from '@/core/shaders/terrain';

// 4. Internal components
import { Character } from '@/components/character';

// 5. Types
import type { GrassProps } from '@/core/types';
```

### 8.3 Actions
1. Standardize import order
2. Use path aliases (@/core, @/components)
3. Check for circular dependencies
4. Group imports logically

---

## 9. Naming Conventions

### 9.1 Current Issues
- Inconsistent naming (e.g., `useGridSnapping` vs `useCharacterAssets`)
- Some files use different naming patterns
- Component vs hook naming unclear

### 9.2 Proposed Standards
- **Components**: PascalCase (e.g., `GrassWebGPU.tsx`)
- **Hooks**: camelCase starting with `use` (e.g., `useGrassSetup.ts`)
- **Utilities**: camelCase (e.g., `uniformManager.ts`)
- **Types**: PascalCase (e.g., `GrassUniforms`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_BLADES_PER_AXIS`)

### 9.3 Actions
1. Rename files to match conventions
2. Update all imports
3. Document naming standards
4. Ensure consistency

---

## 10. Documentation & Comments

### 10.1 Current Issues
- Some complex logic lacks comments
- Missing JSDoc for exported functions
- No architecture documentation

### 10.2 Proposed Improvements
- Add JSDoc to all exported functions
- Document complex algorithms
- Add architecture overview
- Document shader function purposes

### 10.3 Actions
1. Add JSDoc comments
2. Document complex shader logic
3. Create architecture diagram
4. Add inline comments for non-obvious code

---

## 11. Performance Optimizations

### 11.1 Identified Opportunities
- Some `useMemo` dependencies could be optimized
- Some effects could be combined
- Uniform updates could be batched

### 11.2 Actions
1. Review and optimize `useMemo` dependencies
2. Combine related `useEffect` hooks where possible
3. Batch uniform updates
4. Profile and optimize hot paths

---

## 12. Testing Considerations

### 12.1 Current State
- No visible test files
- Complex logic not easily testable

### 12.2 Proposed Structure
```
src/
├── __tests__/
│   ├── core/
│   │   ├── utils/
│   │   └── shaders/
│   └── components/
```

### 12.3 Actions
1. Extract testable pure functions
2. Create test utilities
3. Add unit tests for core utilities
4. Add integration tests for components

---

## Implementation Priority

### Phase 1: Foundation (High Priority)
1. Create core directory structure
2. Move shared utilities to core
3. Combine feature-specific constants/types into `config.ts` files
4. Move only truly shared types to `core/types/`
5. Remove duplicate code

### Phase 2: Organization (Medium Priority)
1. Split large components
2. Extract hooks
3. Organize shader code
4. Organize store with clear sections

### Phase 3: Quality (Lower Priority)
1. Improve type safety
2. Add documentation
3. Optimize performance
4. Add tests

---

## Migration Strategy

1. **Create new structure** alongside existing code
2. **Move code incrementally** (one module at a time)
3. **Update imports** as code is moved
4. **Test after each move** to ensure nothing breaks
5. **Remove old files** once migration is complete

---

## Notes

- This refactoring should be done incrementally
- Each phase should be tested before moving to the next
- Keep git history clean with logical commits
- Document breaking changes if any
- Consider creating a migration guide for team members
