// ============================================================================
// Color Uniforms
// ============================================================================
uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec2 uBladeSeedRange;
uniform vec2 uClumpInternalRange;
uniform vec2 uClumpSeedRange;
uniform float uAOPower;
uniform vec3 uGroundColor;
uniform vec4 uNoiseParams;

// Normal Uniforms
uniform float uMidSoft;
uniform float uRimPos;
uniform float uRimSoft;

// Lighting Uniforms
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uLightBackStrength;

// Cull Uniforms
uniform vec3 uCullParams;

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
// Lighting Normal Computation (Ghost-style)
// ============================================================================
vec3 computeLightingNormal(
  vec3 geoNormal,
  vec2 toCenter,
  float t,
  vec3 worldPos
) {
  vec3 clumpNormal = normalize(vec3(toCenter.x, 0.7, toCenter.y));
  float heightMask = pow(1.0 - t, 0.7);
  float dist = length(cameraPosition - worldPos);
  float distMask = smoothstep(4.0, 12.0, dist);
  
  // Blend to clump normal first
  vec3 blendedNormal = normalize(
    mix(
      geoNormal,
      clumpNormal,
      heightMask * distMask
    )
  );
  
  // Material blending: fade to ground normal at distance (visual denoising)
  // This makes distant grass blend better with the ground
  float mixToGround = smoothstep(uCullParams.x, uCullParams.y, dist);
  vec3 groundNormal = vec3(0.0, 1.0, 0.0);
  
  return normalize(mix(blendedNormal, groundNormal, mixToGround));
}

// ============================================================================
// Main Fragment Shader
// ============================================================================
void main() {
  // --------------------------------------------------------------------------
  // 1. TBN Frame
  // --------------------------------------------------------------------------
  vec3 T = normalize(vTangent);
  vec3 S = normalize(vSide);
  vec3 baseNormal = normalize(vN);

  // --------------------------------------------------------------------------
  // 2. Width shaping (Rim + Midrib)
  // --------------------------------------------------------------------------
  float u = vUv.x - 0.5;
  float au = abs(u);

  float mid01 = smoothstep(-uMidSoft, uMidSoft, u);
  float rimMask = smoothstep(uRimPos, uRimPos + uRimSoft, au);
  float v01 = mix(mid01, 1.0 - mid01, rimMask);
  float ny = v01 * 2.0 - 1.0;

  float widthNormalStrength = 0.35;
  vec3 geoNormal = normalize(baseNormal + S * ny * widthNormalStrength);

  // --------------------------------------------------------------------------
  // 3. Lighting normal (Ghost-style clump blending)
  // --------------------------------------------------------------------------
  vec3 lightingNormal = computeLightingNormal(
    geoNormal,
    vToCenter,
    vHeight,
    vWorldPos
  );

  csm_FragNormal = lightingNormal;

  // --------------------------------------------------------------------------
  // 4. Base Color (Height Gradient)
  // --------------------------------------------------------------------------
  vec3 color = mix(uBaseColor, uTipColor, vHeight);

  // --------------------------------------------------------------------------
  // 5. Ghost-style Color Layering (three layers)
  // --------------------------------------------------------------------------
  float innerClump = smoothstep(0.0, 1.0, length(vToCenter));
  color *= mix(uClumpInternalRange.x, uClumpInternalRange.y, innerClump);
  color *= mix(uClumpSeedRange.x, uClumpSeedRange.y, vClumpSeed);
  color *= mix(uBladeSeedRange.x, uBladeSeedRange.y, vBladeSeed);

  // --------------------------------------------------------------------------
  // 6. Height-based AO (must multiply) - Ghost shape source
  // --------------------------------------------------------------------------
  float ao = mix(0.35, 1.0, clamp(pow(vHeight, uAOPower), 0.0, 1.0));
  color *= ao;

  // --------------------------------------------------------------------------
  // 7. Distance-based Shading Simplification (Ghost important)
  // --------------------------------------------------------------------------
  float dist = length(cameraPosition - vWorldPos);
  float distFade = smoothstep(6.0, 14.0, dist);

  // Reduce contrast and color variation at distance
  color = mix(color, vec3(dot(color, vec3(0.333))), distFade * 0.35);
  
  // Material Blending: fade to ground color at distance (visual denoising)
  // This makes distant grass blend better with the ground surface
  float mixToGroundColor = smoothstep(uCullParams.x, uCullParams.y, dist);
  color = mix(color, uGroundColor, mixToGroundColor * 0.5);

  // --------------------------------------------------------------------------
  // 8. Fake Translucency / Backlight (Ghost core)
  // --------------------------------------------------------------------------
  vec3 Ng = normalize(baseNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightDirection);
  vec3 N = lightingNormal;

  // Backlight condition: light on back + grazing angle
  float backNdL = clamp(dot(-N, L), 0.0, 1.0);
  float NdV = dot(Ng, V);
  float viewGrazing = smoothstep(0.0, 0.6, 1.0 - NdV);

  float thickness = pow(1.0 - vHeight, 1.3);
  float backLight = backNdL * viewGrazing * thickness;

  vec3 trans = uLightColor * backLight * uLightBackStrength;
  color += trans;

  float noise = remap(
    simplexNoise2d(vUv * uNoiseParams.xy + vec2(vBladeSeed, vClumpSeed)), 
    vec2(-1.0, 1.0), 
    uNoiseParams.zw
  );
  color *= noise;

  csm_DiffuseColor = vec4(color, 1.0);
}

