/**
 * Pure function for 1D Blend Tree logic.
 * Maps speed + rotation intent -> target weights for Idle / Walk / Run.
 */

export interface BlendWeights {
  idle: number;
  walk: number;
  run: number;
  back: number;
}

export function calculateBlendWeights(
  speed: number,       // Signed speed (positive = forward, negative = backward)
  isRotating: boolean,
  walkSpeed: number,
  runSpeed: number,
  backSpeed: number    // New parameter needed for interpolation
): BlendWeights {
  
  const absSpeed = Math.abs(speed);
  const isStationary = absSpeed < 0.05;

  // 1. Handle Stationary Rotation (Turn in place)
  // We usually blend some 'Walk' to simulate stepping while turning
  if (isStationary && isRotating) {
    return { idle: 0.3, walk: 0.7, run: 0, back: 0 };
  }

  // Initialize all to 0
  let idle = 0;
  let walk = 0;
  let run = 0;
  let back = 0;

  if (speed < 0) {
    // --- BACKWARD LOGIC ---
    // Calculate ratio based on backSpeed (0 to 1)
    // If speed is -0.3 and backSpeed is 0.6, ratio is 0.5
    const t = Math.min(absSpeed / backSpeed, 1.0);
    
    idle = 1 - t;
    back = t;
    // walk & run remain 0
    
  } else {
    // --- FORWARD LOGIC ---
    if (speed <= walkSpeed) {
      // Blending Idle -> Walk
      const t = absSpeed / walkSpeed;
      idle = 1 - t;
      walk = t;
    } else {
      // Blending Walk -> Run
      const t = (absSpeed - walkSpeed) / (runSpeed - walkSpeed);
      const clampT = Math.min(Math.max(t, 0), 1);
      walk = 1 - clampT;
      run = clampT;
    }
  }

  return { idle, walk, run, back };
}
