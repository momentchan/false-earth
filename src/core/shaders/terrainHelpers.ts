import {
  Fn,
  vec2,
  vec3,
  float,
  normalize,
  cross,
  length,
  max,
  abs,
  select,
  dot,
  cos,
  sin,
  mx_fractal_noise_float,
} from "three/tsl";

/**
 * Returns function that calculates terrain height
 * @param uTerrainAmp - Terrain amplitude uniform
 * @param uTerrainFreq - Terrain frequency uniform
 * @param uTerrainSeed - Terrain seed uniform
 */
export function getTerrainHeight(
  uTerrainAmp: any,
  uTerrainFreq: any,
  uTerrainSeed: any
) {
  return Fn(([xz]: [any]) => {
    const samplePos = xz.add(vec2(0.001)); // Offset to avoid origin artifacts
    const noiseValue = mx_fractal_noise_float(
      samplePos.mul(uTerrainFreq).add(vec2(uTerrainSeed, float(0.0)))
    );
    return noiseValue.mul(uTerrainAmp);
  });
}

/**
 * Returns function that calculates terrain normal
 * @param getTerrainHeight - Function returned from getTerrainHeight
 */
export function getTerrainNormal(getTerrainHeight: any) {
  return Fn(([xz]: [any]) => {
    const baseEpsilon = float(0.1);
    const minDist = max(abs(xz.x), abs(xz.y));
    const epsilon = max(baseEpsilon, minDist.mul(0.01));

    const h = getTerrainHeight(xz);
    const hx = getTerrainHeight(xz.add(vec2(epsilon, float(0.0))));
    const hz = getTerrainHeight(xz.add(vec2(float(0.0), epsilon)));

    // Standard Finite Difference method for Y-up
    const p1 = vec3(epsilon, hx.sub(h), float(0.0));
    const p2 = vec3(float(0.0), hz.sub(h), epsilon);

    // Cross product order for Y-up
    const normal = cross(p2, p1);
    const len = length(normal);

    // Handle edge case where normal is zero (flat surface)
    const threshold = float(0.0001);
    const defaultNormal = vec3(float(0.0), float(1.0), float(0.0));
    return select(
      len.greaterThan(threshold),
      normalize(normal),
      defaultNormal
    );
  });
}

/**
 * Rotates a vector around an axis by a given angle
 * @param v - Vector to rotate
 * @param axis - Rotation axis
 * @param angle - Rotation angle in radians
 */
export const rotateAxis = Fn(([v, axis, angle]: [any, any, any]) => {
  const axisNorm = normalize(axis);
  const proj = axisNorm.mul(dot(axisNorm, v));
  return proj
    .add(v.sub(proj).mul(cos(angle)))
    .add(cross(axisNorm, v).mul(sin(angle)));
});
