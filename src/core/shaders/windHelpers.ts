import {
  vec2,
  float,
  atan,
  sin,
  cos,
  dot,
  sqrt,
  select,
  PI,
  TWO_PI,
  mx_fractal_noise_float,
  remapClamp,
} from "three/tsl";

/**
 * Safely normalize a 2D vector, returning a fallback if length is too small
 */
export function safeNormalize(v: any) {
  const m2 = dot(v, v);
  const normalized = v.mul(float(1.0).div(sqrt(m2)));
  const fallback = vec2(1.0, 0.0);
  return select(m2.greaterThan(float(1e-6)), normalized, fallback);
}

/**
 * Normalize an angle to [-PI, PI] range
 */
export function normalizeAngle(angle: any) {
  return atan(sin(angle), cos(angle));
}

/**
 * Calculate wind strength at a given world XZ position
 * @param worldXZ - World position (x, z) coordinates
 * @param uniforms - Wind-related uniforms: uWindDir, uWindScale, uTime, uWindSpeed, uWindStrength
 * @returns Wind strength value in [0, 1] range
 */
export function calculateWindStrength(worldXZ: any, uniforms: {
  uWindDir: any;
  uWindScale: any;
  uTime: any;
  uWindSpeed: any;
  uWindStrength: any;
}) {
  const windDirNorm = safeNormalize(uniforms.uWindDir);
  const windUv = worldXZ
    .mul(uniforms.uWindScale)
    .add(windDirNorm.mul(uniforms.uTime).mul(uniforms.uWindSpeed));

  const windStrength01 = mx_fractal_noise_float(windUv);
  // Remap noise value from [-1, 1] to [0, uWindStrength] and clamp to [0, 1]
  return remapClamp(
    windStrength01,
    float(-1.0),
    float(1.0),
    float(0.0),
    uniforms.uWindStrength
  );
}

/**
 * Apply wind facing effect to a base angle and normalize to [0, 1] range
 * @param baseAngle - Base angle in radians
 * @param windStrength01 - Wind strength in [0, 1] range
 * @param uniforms - Wind-related uniforms: uWindDir, uWindFacing
 * @returns Normalized angle in [0, 1] range
 */
export function applyWindFacingAndNormalize(
  baseAngle: any,
  windStrength01: any,
  uniforms: {
    uWindDir: any;
    uWindFacing: any;
  }
) {
  const windDir = safeNormalize(uniforms.uWindDir);
  const windAngle = atan(windDir.y, windDir.x);
  const angleDiff = atan(
    sin(windAngle.sub(baseAngle)),
    cos(windAngle.sub(baseAngle))
  );
  const facingAngle = baseAngle.add(
    angleDiff.mul(uniforms.uWindFacing.mul(windStrength01))
  );
  return normalizeAngle(facingAngle).add(PI).div(TWO_PI);
}
