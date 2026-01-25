// ============================================================================
// Cosmic Configuration
// ============================================================================

// Beam spawning constants
export const MIN_BEAM_DISTANCE = 10.0;
export const MAX_POSITION_ATTEMPTS = 10;

// Beam animation constants
export const MAX_BEAMS = 20;
export const BEAM_HEIGHT = 20; // Beam length
export const DROP_HEIGHT = 50; // Height from which beam drops

// Default wave parameters
export const DEFAULT_WAVE_PARAMS = {
  radiusMin: 5.0,
  radiusMax: 10.0,
  lifetimeMin: 3.0,
  lifetimeMax: 5.0,
  donutMinRadius: 5.0,
  donutMaxRadius: 15.0,
  autoSpawn: true,
  minSpawnInterval: 2.0,
  maxSpawnInterval: 5.0,
  speedThreshold: 0.1,
};
