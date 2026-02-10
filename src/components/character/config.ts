// ============================================================================
// Constants
// ============================================================================

/** Physics, movement, and animation blend config. Tweak here instead of in hooks. */
export const CHARACTER_CONFIG = {
  walkSpeed: 1.0,
  runSpeed: 3.5,
  rotateSpeed: 2.5,
  speedLerp: 0.1,
  rotationLerp: 0.15,
  animBlendLerp: 0.15,
} as const;

// Character mesh name constants
export const BODY_MESH_NAMES: readonly string[] = [
  'Astronaut_Suit_Body_Detail_01_Mesh',
  'Astronaut_Suit_Body_Mesh',
  'Astronaut_Suit_Shoes_Mesh',
];


export const BODY_TEXTURE_PATHS = {
  map: 'textures/Body/Astronaut_Suit_Body_Albedo.ktx2',
  metalnessMap: 'textures/Body/Astronaut_Suit_Body_Metallic.ktx2',
  aoMap: 'textures/Body/Astronaut_Suit_Body_Ao.ktx2',
  normalMap: 'textures/Body/Astronaut_Suit_Body_Normals.ktx2',
};

export const DETAIL_TEXTURE_PATHS = {
  map: 'textures/Details/Astronaut_Suit_Details_Albedo.ktx2',
  metalnessMap: 'textures/Details/Astronaut_Suit_Details_Metallic.ktx2',
  aoMap: 'textures/Details/Astronaut_Suit_Details_Ao.ktx2',
  normalMap: 'textures/Details/Astronaut_Suit_Details_Normals.ktx2',
};

export const MODEL_PATHS = [
  '/models/Astronaut.glb',
  '/models/Idle.glb',
  '/models/Walking.glb',
  '/models/Running.glb',
  '/models/WalkingBack.glb',
];

// ============================================================================
// Types
// ============================================================================

export interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
  visible?: boolean;
}

export interface CharacterState {
  currentSpeed: number;
  targetSpeed: number;
  maxSpeed: number;
  rotateSpeed: number;
  speedLerpFactor: number;
  animBlendLerpFactor: number;
  currentIdleWeight: number;
  currentWalkWeight: number;
  isMoving: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

// src/core/physics/types.ts
export interface PhysicsState {
  speed: number;
  rotationVelocity: number; // Used for FPV smoothing

  // Animation weights
  idleWeight: number;
  walkWeight: number;
  runWeight: number;
  backWeight: number;

  // Config Parameters
  walkSpeed: number;
  runSpeed: number;
  backSpeed: number;
  rotateSpeed: number; // Base rotation speed

  // Smoothing Factors
  speedLerpFactor: number;
  rotationLerpFactor: number;
  animBlendLerpFactor: number;
}

export const INITIAL_PHYSICS_STATE: PhysicsState = {
  speed: 0,
  rotationVelocity: 0,
  idleWeight: 1.0,
  walkWeight: 0.0,
  runWeight: 0.0,
  backWeight: 0.0,
  walkSpeed: 1.0,
  runSpeed: 3.5,
  backSpeed: 0.6,
  rotateSpeed: 2.5,
  speedLerpFactor: 0.1,
  rotationLerpFactor: 0.15,
  animBlendLerpFactor: 0.15,
};