// ============================================================================
// Common Shader Math Helpers
// ============================================================================

import {
  vec2,
  float,
  sqrt,
  dot,
  select,
  pow,
  clamp,
  abs,
  mix,
  step,
} from "three/tsl";

/**
 * Safely normalizes a 2D vector, returning a default if length is too small
 */
export const safeNormalize2D = (v: any) => {
  const m2 = dot(v, v);
  const len = sqrt(m2);
  const threshold = float(1e-6);
  return select(len.greaterThan(threshold), v.div(len), vec2(1.0, 0.0));
};

/**
 * Cubic Bezier curve evaluation
 * @param p0 - Start point (vec3)
 * @param p1 - First control point (vec3)
 * @param p2 - Second control point (vec3)
 * @param p3 - End point (vec3)
 * @param t - Parameter along curve [0, 1] (float)
 * @returns Point on Bezier curve (vec3)
 */
export const bezier3 = (p0: any, p1: any, p2: any, p3: any, t: any) => {
  const u = float(1.0).sub(t);
  const u3 = u.mul(u).mul(u);
  const u2t = u.mul(u).mul(t);
  const ut2 = u.mul(t).mul(t);
  const t3 = t.mul(t).mul(t);

  return p0
    .mul(u3)
    .add(p1.mul(u2t).mul(3.0))
    .add(p2.mul(ut2).mul(3.0))
    .add(p3.mul(t3));
};

/**
 * Cubic Bezier curve tangent evaluation
 * @param p0 - Start point (vec3)
 * @param p1 - First control point (vec3)
 * @param p2 - Second control point (vec3)
 * @param p3 - End point (vec3)
 * @param t - Parameter along curve [0, 1] (float)
 * @returns Tangent vector at point on Bezier curve (vec3)
 */
export const bezier3Tangent = (p0: any, p1: any, p2: any, p3: any, t: any) => {
  const u = float(1.0).sub(t);
  const u2 = u.mul(u);
  const ut = u.mul(t);
  const t2 = t.mul(t);

  return p1
    .sub(p0)
    .mul(u2)
    .mul(3.0)
    .add(p2.sub(p1).mul(ut).mul(6.0))
    .add(p3.sub(p2).mul(t2).mul(3.0));
};

/**
 * Easing function: easeInOutCubic
 * Provides smooth acceleration and deceleration
 * @param t - Input value [0, 1] (float)
 * @returns Eased value [0, 1] (float)
 */
export const easeInOutCubic = (t: any) => {
  const clampedT = t.clamp(0.0, 1.0);
  const val1 = clampedT.mul(clampedT).mul(clampedT).mul(4.0);
  const p = clampedT.sub(1.0);
  const val2 = p.mul(p).mul(p).mul(4.0).add(1.0);
  const isSecondHalf = step(0.5, clampedT);
  return mix(val1, val2, isSecondHalf);
};

/**
 * Easing function: easeOutCubic
 * Provides smooth deceleration
 * @param t - Input value [0, 1] (float)
 * @returns Eased value [0, 1] (float)
 */
export const easeOutCubic = (t: any) => {
  const x = t.clamp(0.0, 1.0);
  const oneMinusX = float(1.0).sub(x);
  return float(1.0).sub(oneMinusX.mul(oneMinusX).mul(oneMinusX));
};

/**
 * Easing function: easeOutExpo
 * Provides exponential deceleration
 * @param t - Input value [0, 1] (float)
 * @returns Eased value [0, 1] (float)
 */
export const easeOutExpo = (t: any) => {
  const x = t.clamp(0.0, 1.0);
  return float(1.0).sub(pow(float(2.0), x.mul(-10.0)));
};
