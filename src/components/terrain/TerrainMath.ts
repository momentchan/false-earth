import fractal from '@packages/r3f-gist/shaders/cginc/noise/fractal.glsl'

export const terrainUniforms = {
  uTerrainAmp: { value: 0.3 },
  uTerrainFreq: { value: 0.4 },
  uTerrainSeed: { value: 0.0 }
}

export const terrainMath = /* glsl */ `
  ${fractal}

  uniform float uTerrainAmp;
  uniform float uTerrainFreq;
  uniform float uTerrainSeed;

  // Calculate Height (Y-up standard)
  float getTerrainHeight(vec2 xz) {
      vec2 samplePos = xz + vec2(0.001); // Offset to avoid origin artifacts
      return fbm2(samplePos * uTerrainFreq + uTerrainSeed, 0.0) * uTerrainAmp;
  }

  // Calculate Normal (Y-up standard)
  vec3 getTerrainNormal(vec2 xz) {
      float baseEpsilon = 0.1;
      // Adaptive sampling
      float minDist = max(abs(xz.x), abs(xz.y)); 
      float epsilon = max(baseEpsilon, minDist * 0.01);

      float h = getTerrainHeight(xz);
      float hx = getTerrainHeight(xz + vec2(epsilon, 0.0));
      float hz = getTerrainHeight(xz + vec2(0.0, epsilon));

      // Standard Finite Difference method for Y-up
      vec3 p1 = vec3(epsilon, hx - h, 0.0);
      vec3 p2 = vec3(0.0, hz - h, epsilon);

      // Cross product order for Y-up
      vec3 normal = cross(p2, p1);
      float len = length(normal);
      
      // Handle edge case where normal is zero (flat surface)
      if (len < 0.0001) {
          return vec3(0.0, 1.0, 0.0); // Default to up vector (Y-up)
      }
      
      return normalize(normal);
  }
  
  // Helper to rotate a vector around an axis (for aligning grass to slope)
  vec3 rotateAxis(vec3 v, vec3 axis, float angle) {
      return mix(dot(axis, v) * axis, v, cos(angle)) + cross(axis, v) * sin(angle);
  }
`

