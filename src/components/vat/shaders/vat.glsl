// VAT (Vertex Animation Texture) functions
// Common module for VAT position and normal sampling
// New format: time-based sampling using texel size

// VAT uniform declarations
uniform sampler2D uPosTex;
uniform sampler2D uNrmTex;
uniform float uFrame;
uniform float uFrames;
uniform float uTexW;
uniform float uTexH;
uniform float uTexelSizeX;
uniform int uNormalsCompressed;

// VAT attribute and varying declarations
attribute vec4 color;
varying vec2 vUv1;
varying vec3 vColor;

vec3 octDecode(vec2 e) {
  e = e * 2.0 - 1.0;
  vec3 v = vec3(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
  if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * sign(v.xy);
  return normalize(v);
}

// Time-based sampling using texel size
// timePosition is 0-1, representing animation progress
vec3 VAT_pos(float timePosition) {
  // Calculate frame index: (frameCount - 1) * timePosition
  float frameIndex = (uFrames - 1.0) * timePosition;
  // Calculate UV offset: frameIndex * texelSize.x
  float frameOffset = frameIndex * uTexelSizeX;
  // Sample at uv1 + offset
  vec2 uv = vec2(uv1.x + frameOffset, uv1.y);
  return texture2D(uPosTex, uv).xyz;
}

// Time-based normal sampling
// timePosition is 0-1, representing animation progress
vec3 VAT_nrm(float timePosition) {
  // Calculate frame index: (frameCount - 1) * timePosition
  float frameIndex = (uFrames - 1.0) * timePosition;
  // Calculate UV offset: frameIndex * texelSize.x
  float frameOffset = frameIndex * uTexelSizeX;
  // Sample at uv1 + offset
  vec2 uv = vec2(uv1.x + frameOffset, uv1.y);
  vec4 texel = texture2D(uNrmTex, uv);
  if (uNormalsCompressed == 1) {
    // Oct-encoded normals
    return octDecode(texel.xy);
  } else {
    vec3 normal = texel.xyz * 2.0 - 1.0;
    return normalize(normal);
  }
}

