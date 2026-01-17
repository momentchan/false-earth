import {
  vec2,
  vec3,
  vec4,
  float,
  normalize,
  sqrt,
  dot,
  select,
  sin,
  mod,
  mix,
  Fn,
  pow,
  length,
  smoothstep,
  cameraPosition,
  cross,
  clamp,
  acos,
  If,
  abs,
  texture,
  oneMinus,
} from "three/tsl";
import { rotateAxis } from "../../terrain/terrainHelpers";
import { DEFAULT_GRASS_AREA_SIZE } from "./constants";

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
 * Gets Bezier control points based on blade type
 */
export const getBezierControlPoints = (
  discreteType: any,
  height: any,
  bend: any
) => {
  // Type 0
  const p1_type0 = vec3(0.0, height.mul(0.4), bend.mul(0.5));
  const p2_type0 = vec3(0.0, height.mul(0.75), bend.mul(0.7));

  // Type 1
  const p1_type1 = vec3(0.0, height.mul(0.35), bend.mul(0.6));
  const p2_type1 = vec3(0.0, height.mul(0.7), bend.mul(0.8));

  // Type 2
  const p1_type2 = vec3(0.0, height.mul(0.3), bend.mul(0.7));
  const p2_type2 = vec3(0.0, height.mul(0.65), bend.mul(1.0));

  // Select based on discreteType (0.0, 1.0, or 2.0)
  const isType0 = discreteType.equal(float(0.0));
  const isType1 = discreteType.equal(float(1.0));

  const p1 = select(isType0, p1_type0, select(isType1, p1_type1, p1_type2));
  const p2 = select(isType0, p2_type0, select(isType1, p2_type1, p2_type2));

  return { p1, p2 };
};

/**
 * Returns wind direction calculation function
 * @param uWindDir - Wind direction uniform (vec2)
 */
export function getWindDirection(uWindDir: any) {
  return () => {
    const windDir2D = safeNormalize2D(uWindDir);
    return vec3(windDir2D.x, 0.0, windDir2D.y);
  };
}

/**
 * Returns function that applies wind push effect to Bezier control points
 */
export function applyWindPush(getWindDirection: () => any) {
  return (
    p1: any,
    p2: any,
    p3: any,
    windStrength: any,
    height: any
  ) => {
    const windDir = getWindDirection();
    const windScale = windStrength;

    const tipPush = windScale.mul(height).mul(0.25);
    const midPush1 = windScale.mul(height).mul(0.08);
    const midPush2 = windScale.mul(height).mul(0.15);

    const p1Pushed = p1.add(windDir.mul(midPush1));
    const p2Pushed = p2.add(windDir.mul(midPush2));
    const p3Pushed = p3.add(windDir.mul(tipPush));

    return { p1: p1Pushed, p2: p2Pushed, p3: p3Pushed };
  };
}

/**
 * Returns function that applies wind sway effect to Bezier control points
 */
export function applyWindSway(
  getWindDirection: () => any,
  uTime: any,
  uWindSwayFreqMin: any,
  uWindSwayFreqMax: any,
  uWindSwayStrength: any
) {
  return (
    p1: any,
    p2: any,
    p3: any,
    windStrength: any,
    height: any,
    perBladeHash01: any,
    t: any,
    worldXZ: any
  ) => {
    // Two directions: along wind + cross wind (adds natural "twist")
    const W = getWindDirection();
    const CW = normalize(vec3(W.z.negate(), float(0.0), W.x));
    const windDir2 = vec2(W.x, W.z);

    // Gust envelope (slow breathing)
    const seed = mod(perBladeHash01.mul(3.567), float(1.0));
    const gust = float(0.65).add(
      float(0.35).mul(sin(uTime.mul(0.35).add(seed.mul(6.28318))))
    );

    // Traveling wave along wind direction (big-scale flow)
    const wave = dot(worldXZ, windDir2).mul(0.15);

    // Per-blade frequency variation: mix between min and max based on hash
    const baseFreq = mix(uWindSwayFreqMin, uWindSwayFreqMax, seed);
    const phase = perBladeHash01.mul(6.28318).add(wave);

    // Low freq (main sway) + high freq (small flutter)
    const low = sin(uTime.mul(baseFreq).add(phase).add(t.mul(2.2)));
    const high = sin(
      uTime.mul(baseFreq.mul(5.0)).add(phase.mul(1.7)).add(t.mul(5.0))
    );

    // Amplitude: keep it small
    const amp = height.mul(windStrength);
    const swayLow = amp.mul(gust).mul(uWindSwayStrength);
    const swayHigh = amp.mul(0.8).mul(uWindSwayStrength);

    // Direction blend: mostly wind, a bit cross wind driven by high component
    const dir = normalize(W.add(CW.mul(high.mul(0.35))));

    // Apply on control points (root stable, tip strongest)
    const p1Sway = p1.add(
      dir.mul(
        low.mul(swayLow).mul(0.25).add(high.mul(swayHigh).mul(0.25).mul(0.3))
      )
    );
    const p2Sway = p2.add(
      dir.mul(
        low.mul(swayLow).mul(0.55).add(high.mul(swayHigh).mul(0.55).mul(0.6))
      )
    );
    const p3Sway = p3.add(
      dir.mul(low.mul(swayLow).mul(1.0).add(high.mul(swayHigh).mul(1.0)))
    );

    return { p1: p1Sway, p2: p2Sway, p3: p3Sway };
  };
}

/**
 * Returns function that calculates vertex sway offset for top of blade
 * Creates sin-like swaying motion perpendicular to blade axis
 */
export function applyVertexSway(
  getWindDirection: () => any,
  uTime: any,
  uWindSwayFreqMin: any,
  uWindSwayFreqMax: any,
  uWindSwayStrength: any
) {
  return (
    side: any,
    t: any,
    height: any,
    windStrength: any,
    perBladeHash01: any,
    worldXZ: any
  ) => {
    // Only affects vertices near the tip (t close to 1.0)
    const topSwayMask = smoothstep(float(0.5), float(1.0), t);
    
    // Get wind direction for wave calculation
    const W = getWindDirection();
    const windDir2 = vec2(W.x, W.z);
    
    // Gust envelope (slow breathing)
    const seed = mod(perBladeHash01.mul(3.567), float(1.0));
    const gust = float(0.65).add(
      float(0.35).mul(sin(uTime.mul(0.35).add(seed.mul(6.28318))))
    );
    
    // Traveling wave along wind direction
    const wave = dot(worldXZ, windDir2).mul(0.15);
    
    // Per-blade frequency variation
    const baseFreq = mix(uWindSwayFreqMin, uWindSwayFreqMax, seed);
    const phase = perBladeHash01.mul(6.28318).add(wave);
    
    // Sin wave for sway (low freq main sway + high freq flutter)
    const low = sin(uTime.mul(baseFreq).add(phase).add(t.mul(2.2)));
    const high = sin(
      uTime.mul(baseFreq.mul(5.0)).add(phase.mul(1.7)).add(t.mul(5.0))
    );
    
    // Amplitude increases with height and wind strength
    const amp = height.mul(windStrength);
    const swayLow = amp.mul(gust).mul(uWindSwayStrength);
    const swayHigh = amp.mul(0.8).mul(uWindSwayStrength);
    
    // Combine low and high frequency sway
    const swayAmount = low.mul(swayLow).add(high.mul(swayHigh));
    
    // Apply sway in side direction, scaled by top mask
    return side.mul(swayAmount).mul(topSwayMask);
  };
}

/**
 * Returns function that computes lighting normal by blending geometry normal with clump normal
 * Based on height and distance from camera
 */
export function computeLightingNormal(near: number, far: number) {
  return Fn(
    ([geoNormal, toCenter, height, worldPos]: [any, any, any, any]) => {
      // Clump normal: cone-shaped normal pointing towards clump center
      const clumpNormal = normalize(vec3(toCenter.x, float(0.7), toCenter.y));

      // Height mask: bottom is influenced more by the clump; top by geometry
      const heightMask = pow(float(1.0).sub(height), float(0.7));

      // Distance mask: further from the camera, blend more toward clump normal
      const dist = length(cameraPosition.sub(worldPos));
      const distMask = smoothstep(float(near), float(far), dist);

      // Blend geometry normal and clump normal
      const blendFactor = heightMask.mul(distMask);
      const blendedNormal = normalize(mix(geoNormal, clumpNormal, blendFactor));
      
      return blendedNormal;
    }
  );
}

/**
 * Applies slope alignment rotation to align grass blade with terrain normal
 * Rotates position, tangent, side, and normal vectors to match terrain slope
 */
export function applySlopeAlignment(
  terrainNormal: any,
  lpos: any,
  tangentRotated: any,
  sideRotated: any,
  normalRotated: any
) {
  // Slope Alignment: Align the local "Up" vector (0,1,0) to the "Terrain Normal"
  const up = vec3(float(0.0), float(1.0), float(0.0));
  const axis = cross(up, terrainNormal);
  const dotProd = clamp(dot(up, terrainNormal), float(-1.0), float(1.0));
  const angle = acos(dotProd);
  
  // Only rotate if slope is significant
  const axisLen = length(axis);
  const minAxisLen = float(0.001);
  const shouldRotate = axisLen.greaterThan(minAxisLen);
  
  If(shouldRotate, () => {
    const axisNorm = normalize(axis);
    lpos.assign(rotateAxis(lpos, axisNorm, angle));
    tangentRotated.assign(rotateAxis(tangentRotated, axisNorm, angle));
    sideRotated.assign(rotateAxis(sideRotated, axisNorm, angle));
    normalRotated.assign(rotateAxis(normalRotated, axisNorm, angle));
  });
}

/**
 * Applies view-dependent tilt to make grass blades appear thicker when viewed from the side
 * @param posObj - Object space position
 * @param posW - World space position
 * @param side - Side vector (object space)
 * @param normal - Normal vector (object space)
 * @param uvCoords - UV coordinates (x: width across blade, y: height along blade)
 * @param t - Shape parameter (0 at base, 1 at tip)
 * @param uGeometryThicknessStrength - Strength uniform for thickness effect
 * @param modelWorldMatrix - Model to world matrix
 * @param cameraPos - Camera position in world space
 */
export function applyViewDependentTilt(
  posObj: any,
  posW: any,
  side: any,
  normal: any,
  uvCoords: any,
  t: any,
  uGeometryThicknessStrength: any,
  modelWorldMatrix: any,
  cameraPos: any
) {
  const camDirW = normalize(cameraPos.sub(posW));
  
  // Transform side vector to world space (only need side for camDirLocalY)
  const sideW = normalize(modelWorldMatrix.mul(vec4(side, float(0.0))).xyz);
  
  // Convert camera direction Y component from world space to local space
  // camDirLocalY = dot(camDirW, sideW)
  const camDirLocalY = dot(camDirW, sideW);
  
  // Edge mask: stronger on edges when viewed from side
  const edgeMask = uvCoords.x.sub(float(0.5)).mul(camDirLocalY);
  edgeMask.mulAssign(pow(abs(camDirLocalY), float(1.2)));
  const edgeMaskClamped = clamp(edgeMask, float(0.0), float(1.0));
  
  // Center mask: stronger at base, weaker at tip
  const centerMask = pow(float(1.0).sub(t), float(0.5)).mul(pow(t.add(float(0.05)), float(0.33)));
  const centerMaskClamped = clamp(centerMask, float(0.0), float(1.0));
  
  // Calculate tilt amount
  const tilt = uGeometryThicknessStrength.mul(edgeMaskClamped).mul(centerMaskClamped);
  
  // Normal XZ component (horizontal normal)
  const normalXZ = normalize(vec3(normal.x, float(0.0), normal.z));
  
  // Apply tilt offset
  return posObj.add(normalXZ.mul(tilt));
}

/**
 * Samples terrain height and normal from heightmap texture
 * @param worldXZ - World XZ position (vec2)
 * @param uGroupOffset - Group offset uniform (vec3)
 * @param heightmap - Storage texture containing height (R) and normal (GBA)
 * @returns Object with height (th) and normalized terrain normal (tn)
 */
export const sampleTerrainHeightAndNormal = (
  worldXZ: any,
  uGroupOffset: any,
  heightmap: any
) => {
  // Calculate UV coordinates for terrain sampling
  const uvCoord = worldXZ.sub(uGroupOffset.xz).div(DEFAULT_GRASS_AREA_SIZE).add(vec2(0.5));
  uvCoord.y = oneMinus(uvCoord.y);
  
  // Sample height and normal from texture
  const heightmapSample = texture(heightmap, uvCoord);
  const th = heightmapSample.r;
  
  // Extract normal from GBA channels and remap from [0, 1] back to [-1, 1]
  // Formula: (value - 0.5) * 2.0 = value * 2.0 - 1.0
  const normalX = heightmapSample.g.mul(float(2.0)).sub(float(1.0));
  const normalY = heightmapSample.b.mul(float(2.0)).sub(float(1.0));
  const normalZ = heightmapSample.a.mul(float(2.0)).sub(float(1.0));
  const normalRaw = vec3(normalX, normalY, normalZ);
  
  // Normalize to ensure it's a unit vector (handles any precision loss from storage)
  const normalLen = length(normalRaw);
  const threshold = float(0.0001);
  const defaultNormal = vec3(float(0.0), float(1.0), float(0.0));
  const tn = select(
    normalLen.greaterThan(threshold),
    normalize(normalRaw),
    defaultNormal
  );
  
  return { th, tn };
};

