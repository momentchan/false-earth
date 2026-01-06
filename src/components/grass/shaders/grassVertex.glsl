// ============================================================================
// Attributes & Uniforms
// ============================================================================
attribute vec3 instanceOffset;
attribute float instanceId;

// Texture Uniforms
uniform sampler2D uTextureBladeParams;
uniform sampler2D uTextureClumpData;
uniform sampler2D uTextureMotionSeeds;
uniform vec2 uTextureGrassSize;

// Geometry Uniforms
uniform float uGeometryThicknessStrength;
uniform float uGeometryBaseWidth;
uniform float uGeometryTipThin;
uniform float uBladeSegments;

// Wind Uniforms
uniform float uWindTime;
uniform vec2 uWindDir;
uniform float uWindSwayFreqMin;
uniform float uWindSwayFreqMax;
uniform float uWindSwayStrength;
uniform vec2 uWindDistanceRange;

// LOD Uniforms
uniform vec2 uLODRange;

// Cull Uniforms
uniform vec3 uCullParams;

// ============================================================================
// Varyings
// ============================================================================
varying float vHeight;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vTangent;
varying vec3 vSide;
varying vec2 vToCenter;
varying vec3 vWorldPos;
varying float vClumpSeed;
varying float vBladeSeed;

// ============================================================================
// Utility Functions
// ============================================================================
vec2 safeNormalize(vec2 v) {
  float m2 = dot(v, v);
  return (m2 > 1e-6) ? v * inversesqrt(m2) : vec2(1.0, 0.0);
}

// ============================================================================
// Bezier Curve Functions
// ============================================================================
vec3 bezier3(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
  float u = 1.0 - t;
  return u*u*u*p0 + 3.0*u*u*t*p1 + 3.0*u*t*t*p2 + t*t*t*p3;
}

vec3 bezier3Tangent(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
  float u = 1.0 - t;
  return 3.0*u*u*(p1-p0) + 6.0*u*t*(p2-p1) + 3.0*t*t*(p3-p2);
}

// ============================================================================
// Wind Functions
// ============================================================================
vec3 getWindDirection() {
  return vec3(safeNormalize(uWindDir), 0.0).xzy;
}

void applyWindPush(inout vec3 p1, inout vec3 p2, inout vec3 p3, float windStrength, float height) {
  vec3 windDir = getWindDirection();
  float windScale = windStrength;
  
  float tipPush = windScale * height * 0.25;
  float midPush1 = windScale * height * 0.08;
  float midPush2 = windScale * height * 0.15;
  
  p1 += windDir * midPush1;
  p2 += windDir * midPush2;
  p3 += windDir * tipPush;
}

void applyWindSway(
  inout vec3 p1, inout vec3 p2, inout vec3 p3,
  float windStrength, float height, float perBladeHash01, float t,
  vec2 worldXZ
) {
  // Two directions: along wind + cross wind (adds natural "twist")
  vec3 W = getWindDirection();                              // along wind
  vec3 CW = normalize(vec3(-W.z, 0.0, W.x));               // cross wind
  vec2 windDir2 = vec2(W.x, W.z);                           // 2D wind dir for wave calculation

  // Gust envelope (slow breathing)
  float seed = mod(perBladeHash01 * 3.567, 1.0); 
  float gust = 0.65 + 0.35 * sin(uWindTime * 0.35 + seed * 6.28318);

  // Traveling wave along wind direction (big-scale flow)
  float wave = dot(worldXZ, windDir2) * 0.15; // 0.10~0.25 usually good

  // Per-blade frequency variation: mix between min and max based on hash
  float baseFreq = mix(uWindSwayFreqMin, uWindSwayFreqMax, seed);
  float phase = perBladeHash01 * 6.28318 + wave;

  // Low freq (main sway) + high freq (small flutter)
  float low  = sin(uWindTime * baseFreq + phase + t * 2.2);
  float high = sin(uWindTime * (baseFreq * 5.0) + phase * 1.7 + t * 5.0);

  // Amplitude: keep it small. (your old 2.2 is the reason it's jelly)
  // windStrength already has uWindStrength applied from compute shader
  float amp = height * windStrength;
  float swayLow  = amp * gust * uWindSwayStrength;  // main motion
  float swayHigh = amp * 0.8 * uWindSwayStrength;         // small detail

  // Direction blend: mostly wind, a bit cross wind driven by high component
  vec3 dir = normalize(W + CW * (high * 0.35));

  // Apply on control points (root stable, tip strongest)
  p1 += dir * (low * swayLow * 0.25 + high * swayHigh * 0.25 * 0.3);
  p2 += dir * (low * swayLow * 0.55 + high * swayHigh * 0.55 * 0.6);
  p3 += dir * (low * swayLow * 1.00 + high * swayHigh * 1.00 * 1.0);
}

// ============================================================================
// View-dependent Tilt Functions
// ============================================================================
vec3 applyViewDependentTilt(
  vec3 posObj, vec3 posW,
  vec3 tangent, vec3 side, vec3 normal,
  vec2 uv, float t
) {
  vec3 camDirW = normalize(cameraPosition - posW);
  
  vec3 tangentW = normalize((modelMatrix * vec4(tangent, 0.0)).xyz);
  vec3 sideW = normalize((modelMatrix * vec4(side, 0.0)).xyz);
  vec3 normalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  
  mat3 toLocal = mat3(tangentW, sideW, normalW);
  vec3 camDirLocal = normalize(transpose(toLocal) * camDirW);
  
  float edgeMask = (uv.x - 0.5) * camDirLocal.y;
  edgeMask *= pow(abs(camDirLocal.y), 1.2);
  edgeMask = clamp(edgeMask, 0.0, 1.0);
  
  float centerMask = pow(1.0 - t, 0.5) * pow(t + 0.05, 0.33);
  centerMask = clamp(centerMask, 0.0, 1.0);
  
  float tilt = uGeometryThicknessStrength * edgeMask * centerMask;
  vec3 nXZ = normalize(normal * vec3(1.0, 0.0, 1.0));
  return posObj + nXZ * tilt;
}

// ============================================================================
// Blade Shape Functions
// ============================================================================
void getBezierControlPoints(float discreteType, float height, float bend, out vec3 p1, out vec3 p2) {
  // Use strictly the chosen type (no mix functions)
  if (discreteType == 0.0) {
    p1 = vec3(0.0, height * 0.4, bend * 0.5);
    p2 = vec3(0.0, height * 0.75, bend * 0.7);
  } else if (discreteType == 1.0) {
    p1 = vec3(0.0, height * 0.35, bend * 0.6);
    p2 = vec3(0.0, height * 0.7, bend * 0.8);
  } else {
    p1 = vec3(0.0, height * 0.3, bend * 0.7);
    p2 = vec3(0.0, height * 0.65, bend * 1.0);
  }
}

// ============================================================================
// LOD Functions
// ============================================================================
// Calculate LOD-based position T for vertex folding
// Returns the folded position T that should be used for geometry calculations
// shapeT: Original smooth t (0.0 -> 1.0) from uv.y
// instanceOffset: Instance position in object space
float calculateLODPositionT(float shapeT, vec3 instanceOffset) {
  // Calculate distance from instance to camera
  vec3 worldBasePos = (modelMatrix * vec4(instanceOffset, 1.0)).xyz;
  float dist = length(cameraPosition - worldBasePos);
  
  // Calculate LOD weight (0.0 = full detail, 1.0 = fully folded)
  float lodWeight = smoothstep(uLODRange.x, uLODRange.y, dist);
  
  // Vertex folding logic for position calculation only
  // uBladeSegments is set from BLADE_SEGMENTS constant, so uv.y ranges from 0/uBladeSegments to uBladeSegments/uBladeSegments
  float totalSegments = uBladeSegments;
  float vertexRow = floor(shapeT * totalSegments + 0.5);
  
  // When lodWeight approaches 1.0, we only keep even rows (0, 2, 4...)
  // Odd rows (1, 3, 5...) are folded to even rows
  float foldedRow = floor(vertexRow / 2.0) * 2.0;
  
  // Determine final position T for Bezier curve calculation (geometry only)
  float positionT = mix(vertexRow, foldedRow, step(0.5, lodWeight)) / totalSegments;
  
  return positionT;
}

// ============================================================================
// Main Vertex Shader
// ============================================================================
void main() {
  // 1. Separate "Shape T" (smooth, for appearance) and "Position T" (folded, for geometry)
  // shapeT: Original smooth t (0.0 -> 1.0) for width, thickness, and visual properties
  float shapeT = uv.y;
  float s = (uv.x - 0.5) * 2.0;
  
  // 2. Calculate LOD-based position T for vertex folding
  float positionT = calculateLODPositionT(shapeT, instanceOffset);

  // 2. Texture Coordinates
  int ix = int(mod(instanceId, uTextureGrassSize.x));
  int iy = int(floor(instanceId / uTextureGrassSize.x));
  ivec2 texelCoord = ivec2(ix, iy);

  // 3. Read Precomputed Data
  vec4 bladeParams = texelFetch(uTextureBladeParams, texelCoord, 0);
  vec4 clumpData = texelFetch(uTextureClumpData, texelCoord, 0);
  vec4 motionSeeds = texelFetch(uTextureMotionSeeds, texelCoord, 0);
  
  float height = bladeParams.x;
  float width = bladeParams.y;
  float bend = bladeParams.z;
  float bladeType = floor(bladeParams.w * 3.0);
  
  vec2 toCenter = clumpData.xy;
  float presence = clumpData.z;
  float clumpSeed01 = clumpData.w;
  
  float facingAngle01 = motionSeeds.x;
  float perBladeHash01 = motionSeeds.y;
  float windStrength = motionSeeds.z;
  
  float facingAngle = facingAngle01 * PI * 2.0;

  // 4. Calculate distance for wind falloff (farther = less wind)
  vec3 worldBasePos = (modelMatrix * vec4(instanceOffset, 1.0)).xyz;
  float dist = length(cameraPosition - worldBasePos);
  
  // Calculate wind distance falloff (1.0 = full wind at near, 0.0 = no wind at far)
  // If uWindDistanceRange is not set (0,0), use full wind strength
  float windDistanceFalloff = 1.0;
  if (uWindDistanceRange.y > 0.0) {
    windDistanceFalloff = 1.0 - smoothstep(uWindDistanceRange.x, uWindDistanceRange.y, dist);
  }
  
  // Apply distance-based wind falloff
  windStrength *= windDistanceFalloff;

  // 5. Bezier Control Points
  vec3 p0 = vec3(0.0, 0.0, 0.0);
  vec3 p3 = vec3(0.0, height, 0.0);
  vec3 p1, p2;
  getBezierControlPoints(bladeType, height, bend, p1, p2);

  // 6. Apply Wind Effects (use positionT for wind calculations)
  applyWindPush(p1, p2, p3, windStrength, height);
  applyWindSway(p1, p2, p3, windStrength, height, perBladeHash01, positionT, instanceOffset.xz);

  // 7. Calculate Spine and Tangent using positionT (for geometry position)
  vec3 spine = bezier3(p0, p1, p2, p3, positionT);
  vec3 tangent = normalize(bezier3Tangent(p0, p1, p2, p3, positionT));

  // 8. TBN Frame
  vec3 ref = vec3(0.0, 0.0, 1.0);
  vec3 side = normalize(cross(ref, tangent));
  vec3 normal = normalize(cross(side, tangent));

  // 9. Per-Instance Culling (Density-based random culling)
  // Distance already calculated above for wind falloff, reuse it
  
  // 1. Calculate culling weight (0.0 = near, no culling, 1.0 = far, fully culled)
  float cullWeight = smoothstep(uCullParams.x, uCullParams.y, dist);
  
  // 2. Random culling logic (using existing perBladeHash01)
  // When cullWeight increases, more random values fall into the culling range
  // This ensures each blade disappears at a different time, creating natural randomness
  float isCulled = step(1.0 - cullWeight, perBladeHash01);
  
  // 3. Smooth scaling disappearance (shrink before culling)
  // Make blades about to be culled shrink first (e.g., within 0.1 range before culling threshold)
  // This creates a smooth transition instead of instant disappearance
  float shrinkGate = smoothstep(1.0 - cullWeight, 1.0 - cullWeight + 0.1, perBladeHash01);
  
  // 4. Density Compensation
  // As grass becomes sparse, we increase the width of remaining blades to compensate visual gaps
  // uCullParams.z is recommended to be between 1.0 ~ 2.0
  float densityCompensation = mix(1.0, uCullParams.z, cullWeight);
  
  // 5. Combine culling and scaling for smooth disappearance
  // Apply both culling (instant removal) and shrinking (smooth scale down) effects
  float finalPresence = presence * (1.0 - isCulled) * (1.0 - shrinkGate);
  
  // 10. Blade Geometry - Use shapeT for width calculation (maintains smooth tapering)
  // This ensures the tip always has width = 0, even when vertices are folded
  float widthFactor = (shapeT + uGeometryBaseWidth) * pow(1.0 - shapeT, uGeometryTipThin);
  
  // Apply density compensation to width
  vec3 lpos = spine + side * (width * densityCompensation) * widthFactor * s * finalPresence;

  // 11. Apply Rotation
  lpos.xz = rotate2D(lpos.xz, facingAngle);
  tangent.xz = rotate2D(tangent.xz, facingAngle);
  side.xz = rotate2D(side.xz, facingAngle);
  
  tangent = normalize(tangent);
  side = normalize(side);
  normal = normalize(normal);

  // 11.5. Terrain Height and Slope Alignment
  // Calculate world position anchor for terrain sampling
  // Get terrain data
  float terrainHeight = getTerrainHeight(worldBasePos.xz);
  vec3 terrainNormal = getTerrainNormal(worldBasePos.xz);
  
  // Slope Alignment: Align the local "Up" vector (0,1,0) to the "Terrain Normal"
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 axis = cross(up, terrainNormal);
  float dotProd = clamp(dot(up, terrainNormal), -1.0, 1.0);
  float angle = acos(dotProd);
  
  // Only rotate if slope is significant
  if (length(axis) > 0.001) {
      axis = normalize(axis);
      lpos = rotateAxis(lpos, axis, angle);
      tangent = rotateAxis(tangent, axis, angle);
      side = rotateAxis(side, axis, angle);
      normal = rotateAxis(normal, axis, angle);
  }

  // 12. Transform to World Space
  vec3 posObj = lpos + instanceOffset;
  // Apply terrain height offset (Y-up in world space)
  posObj.y += terrainHeight;
  vec3 posW = (modelMatrix * vec4(posObj, 1.0)).xyz;

  // 13. View-dependent Tilt (use shapeT for tilt calculation to maintain smooth appearance)
  vec3 posObjTilted = applyViewDependentTilt(posObj, posW, tangent, side, normal, uv, shapeT);
  vec3 posWTilted = (modelMatrix * vec4(posObjTilted, 1.0)).xyz;

  // 13. Output
  csm_Position = posWTilted;

  vN = -normal;
  vTangent = tangent;
  vSide = side;
  vToCenter = toCenter;
  vWorldPos = posWTilted;
  vUv = uv;
  vHeight = shapeT; 
  vClumpSeed = clumpSeed01;
  vBladeSeed = perBladeHash01;
}
