#define PI 3.14159265359
#define TWO_PI 6.28318530718

// ============================================================================
// Compute Uniforms
// ============================================================================
uniform vec2 uResolution;
uniform sampler2D uPositions;

// Shape Parameters
uniform float uBladeHeightMin;
uniform float uBladeHeightMax;
uniform float uBladeWidthMin;
uniform float uBladeWidthMax;
uniform float uBendAmountMin;
uniform float uBendAmountMax;

// Clump Parameters
uniform float uClumpSize;
uniform float uClumpRadius;
uniform float uCenterYaw;
uniform float uBladeYaw;
uniform float uClumpYaw;
uniform vec3 uBladeRandomness;
uniform float uTypeTrendScale;

// Wind Parameters
uniform float uWindTime;
uniform float uWindScale;
uniform float uWindSpeed;
uniform float uWindStrength;
uniform vec2 uWindDir;
uniform float uWindFacing;


// ============================================================================
// Output Declarations (Multiple Render Targets - WebGL2/GLSL ES 3.00)
// ============================================================================
layout(location = 0) out vec4 outBladeParams;   // height, width, bend, type
layout(location = 1) out vec4 outClumpData;     // toCenter.x, toCenter.y, presence, clumpSeed01
layout(location = 2) out vec4 outMotionSeeds;  // facingAngle01, perBladeHash01, windStrength01, lodSeed01

// ============================================================================
// Hash Functions (matching CPU version exactly)
// ============================================================================
float hash11(float x) {
  return fract(sin(x * 37.0) * 43758.5453123);
}

vec2 hash21(vec2 p) {
  float h1 = hash11(dot(p, vec2(127.1, 311.7)));
  float h2 = hash11(dot(p, vec2(269.5, 183.3)));
  return vec2(h1, h2);
}

vec2 hash2(vec2 p) {
  float x = dot(p, vec2(127.1, 311.7));
  float y = dot(p, vec2(269.5, 183.3));
  return fract(sin(vec2(x, y)) * 43758.5453);
}

// ============================================================================
// Utility Functions
// ============================================================================
vec2 safeNormalize(vec2 v) {
  float m2 = dot(v, v);
  return (m2 > 1e-6) ? v * inversesqrt(m2) : vec2(1.0, 0.0);
}

// Normalize angle to [-π, π] range
float normalizeAngle(float angle) {
  return atan(sin(angle), cos(angle));
}

// Note: simplexNoise3d and fbm2 are included from fractal.glsl via useGrassCompute hook

// ============================================================================
// Voronoi Clump Calculation
// ============================================================================
// Returns: distToCenter, cellId.x, cellId.y
vec3 getClumpInfo(vec2 worldXZ) {
  vec2 cell = worldXZ / uClumpSize;
  vec2 baseCell = floor(cell);

  float minDist = 1e9;
  vec2 bestCellId = vec2(0.0);

  // Check 3x3 neighborhood to find closest Voronoi cell
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighborCell = baseCell + vec2(float(i), float(j));
      vec2 seed = hash2(neighborCell);
      vec2 seedCoord = neighborCell + seed;
      vec2 diff = cell - seedCoord;
      float d2 = dot(diff, diff);

      if (d2 < minDist) {
        minDist = d2;
        bestCellId = neighborCell;
      }
    }
  }

  float distToCenter = sqrt(minDist) * uClumpSize;
  return vec3(distToCenter, bestCellId.x, bestCellId.y);
}

// Calculate direction from blade position to clump center
vec2 calculateToCenter(vec2 worldXZ, vec2 cellId) {
  vec2 clumpSeed = hash2(cellId);
  vec2 clumpCenterWorld = (cellId + clumpSeed) * uClumpSize;
  
  vec2 dir = clumpCenterWorld - worldXZ;
  float len = length(dir);
  return len > 1e-5 ? dir / len : vec2(1.0, 0.0);
}

// Calculate presence (fade-out factor) based on distance from clump center
float calculatePresence(float distToCenter) {
  float r = clamp(distToCenter / uClumpRadius, 0.0, 1.0);
  float t = clamp((r - 0.7) / (1.0 - 0.7), 0.0, 1.0);
  float smoothstepVal = t * t * (3.0 - 2.0 * t);
  return 1.0 - smoothstepVal;
}

// ============================================================================
// Parameter Generation
// ============================================================================
// Generate per-clump parameters (height, width, bend, type)
vec4 getClumpParams(vec2 cellId) {
  vec2 c1 = hash21(cellId * 11.0);
  vec2 c2 = hash21(cellId * 23.0);

  // Use dynamic min/max ranges directly
  float clumpBaseHeight = mix(uBladeHeightMin, uBladeHeightMax, c1.x);
  float clumpBaseWidth = mix(uBladeWidthMin, uBladeWidthMax, c1.y);
  float clumpBaseBend = mix(uBendAmountMin, uBendAmountMax, c2.x);
  
  float typeTrend = simplexNoise2d(cellId * uTypeTrendScale);
  typeTrend = typeTrend * 0.5 + 0.5;

  return vec4(clumpBaseHeight, clumpBaseWidth, clumpBaseBend, typeTrend);
}

// Generate per-blade parameters based on clump params
vec4 getBladeParams(vec2 seed, vec4 clumpParams) {
  vec2 h1 = hash21(seed * 13.0);
  vec2 h2 = hash21(seed * 29.0);

  float height = clumpParams.x * mix(1.0 - uBladeRandomness.x, 1.0 + uBladeRandomness.x, h1.x);
  float width = clumpParams.y * mix(1.0 - uBladeRandomness.y, 1.0 + uBladeRandomness.y, h1.y);
  float bend = clumpParams.z * mix(1.0 - uBladeRandomness.z, 1.0 + uBladeRandomness.z, h2.x);
  float type = clumpParams.w;

  return vec4(height, width, bend, type);
}

// ============================================================================
// Angle Calculation
// ============================================================================
// Calculate base angle with clump and per-blade variations
float calculateBaseAngle(vec2 toCenter, vec2 worldXZ, vec2 cellId, float perBladeHash01) {
  // Angle towards clump center
  float clumpAngle = atan(toCenter.y, toCenter.x) * uCenterYaw;
  
  // Per-blade random offset
  float randomOffset = (perBladeHash01 - 0.5) * uBladeYaw;
  
  // Per-clump yaw variation
  float clumpHash = hash11(dot(cellId, vec2(9.7, 3.1)));
  float clumpYaw = (clumpHash - 0.5) * uClumpYaw;
  
  return clumpAngle + randomOffset + clumpYaw;
}

// Blend angle towards wind direction (Ghost-style wind-facing)
float applyWindFacing(float baseAngle, vec2 windDir, float windStrength01) {
  float windAngle = atan(windDir.y, windDir.x);
  
  // Calculate angle difference wrapped to [-π, π]
  float angleDiff = atan(sin(windAngle - baseAngle), cos(windAngle - baseAngle));
  
  // Blend based on wind strength and windFacing parameter
  return baseAngle + angleDiff * (uWindFacing * windStrength01);
}

// Apply wind facing and normalize angle to [0, 1] range
float applyWindFacingAndNormalize(float baseAngle, vec2 windDir, float windStrength01) {
  float facingAngle = applyWindFacing(baseAngle, windDir, windStrength01);
  return (normalizeAngle(facingAngle) + PI) / TWO_PI;
}

// Sample wind strength from noise field
float calculateWindStrength(vec2 worldXZ) {
  vec2 windDir = safeNormalize(uWindDir);
  vec2 windUv = worldXZ * uWindScale + windDir * uWindTime * uWindSpeed;
  
  float windStrength01 = fbm2(windUv, 0.0);
  return clamp(windStrength01 * uWindStrength, 0.0, 1.0);
}

// ============================================================================
// Main Compute Shader
// ============================================================================
void main() {
  // 1. Get blade world position
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec4 posData = texture(uPositions, uv);
  vec2 worldXZ = posData.xz;

  // 2. Calculate Voronoi clump information
  vec3 clumpInfo = getClumpInfo(worldXZ);
  float distToCenter = clumpInfo.x;
  vec2 cellId = clumpInfo.yz;
  
  // 3. Calculate clump-related data
  vec2 toCenter = calculateToCenter(worldXZ, cellId);
  float presence = calculatePresence(distToCenter);
  
  // 4. Generate blade and clump parameters
  vec4 clumpParams = getClumpParams(cellId);
  vec4 bladeParams = getBladeParams(worldXZ, clumpParams);

  // 5. Generate seeds (calculate once, reuse)
  float perBladeHash01 = hash11(dot(worldXZ, vec2(37.0, 17.0)));
  float lodSeed01 = hash11(dot(worldXZ, vec2(19.3, 53.7)));
  
  // Generate clump-level seed (fixed for entire clump, based on cellId)
  float clumpSeed01 = hash11(dot(cellId, vec2(47.3, 61.7)));

  // 6. Calculate blade facing angle
  float baseAngle = calculateBaseAngle(toCenter, worldXZ, cellId, perBladeHash01);
  
  // 7. Apply wind effects
  float windStrength = calculateWindStrength(worldXZ); // Apply wind strength multiplier
  vec2 windDir = safeNormalize(uWindDir);
  float facingAngle01 = applyWindFacingAndNormalize(baseAngle, windDir, windStrength);

  // 8. Output to multiple render targets
  outBladeParams = bladeParams;
  outClumpData = vec4(toCenter.x, toCenter.y, presence, clumpSeed01);
  outMotionSeeds = vec4(facingAngle01, perBladeHash01, windStrength, lodSeed01);
}
