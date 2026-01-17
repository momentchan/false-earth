import * as THREE from "three/webgpu";
import {
  Fn,
  vec3,
  vec2,
  instancedArray,
  instanceIndex,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cameraPosition,
  modelWorldMatrix,
  vec4,
  uv,
  float,
  normalize,
  select,
  floor,
  cross,
  pow,
  mx_rotate2d,
  mix,
  dot,
  length,
  oneMinus,
  smoothstep,
  varying,
  abs,
  clamp,
  mul,
  transformNormalToView,
  faceDirection,
  pmremTexture,
  uniform,
  mx_noise_float,
  remapClamp,
  materialRoughness,
  texture,
} from "three/tsl";
import {
  bezier3,
  bezier3Tangent,
  getBezierControlPoints,
  getWindDirection,
  applyWindPush,
  applyVertexSway,
  applySlopeAlignment,
  applyViewDependentTilt,
  sampleTerrainHeightAndNormal,
} from "./shaderHelpers";
import { DEFAULT_GRASS_AREA_SIZE } from "./constants";

/**
 * Creates a grass material with vertex shader that scales blade geometry
 * based on computed blade width and height parameters
 */
export function createGrassMaterial(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  visibleIndicesBuffer: ReturnType<typeof instancedArray>,
  uniforms: Record<string, any>,
  heightmap?: THREE.StorageTexture,
  lodDebugColor?: THREE.Color // LOD debug color for visualization
) {

  // Define varyings for passing data from vertex to fragment
  const vGeoNormal = varying(vec3(0.0));
  const vHeight = varying(float(0.0));
  const vToCenter = varying(vec2(0.0));
  const vWorldPos = varying(vec3(0.0));
  const vSide = varying(vec3(0.0));
  const vClumpSeed = varying(float(0.0));
  const vBladeSeed = varying(float(0.0));

  const near = 15;
  const far = 30;

  const material = new THREE.MeshStandardNodeMaterial();
  material.side = THREE.DoubleSide;

  // FIX: Correct PBR lighting coordinate system when Group snaps
  // Problem: When Group snaps, ModelMatrix jumps, causing lighting to use wrong world position
  // Solution: Calculate local position = WorldPos - GroupOffset
  // Result: ModelMatrix (+GroupOffset) × positionNode (-GroupOffset) = correct continuous WorldPos
  const uGroupOffset = uniforms.uGroupOffset ?? uniform(new THREE.Vector3(0, 0, 0));
  
  material.positionNode = Fn(() => {
    const trueIndex = visibleIndicesBuffer.element(instanceIndex);
    const instanceWorldPos = positions.element(trueIndex);
    const localPos = instanceWorldPos.sub(uGroupOffset);
    return localPos;
  })();

  const grassVertex = Fn(() => {
    // Get data from compute shader
    // Read the actual blade index from visible indices buffer (indirect drawing)
    const trueIndex = visibleIndicesBuffer.element(instanceIndex);

    const data = grassData.element(trueIndex);
    const instancePos = positions.element(trueIndex);

    const width = data.get("bladeWidth").toConst();
    const height = data.get("bladeHeight").toConst();
    const bend = data.get("bladeBend").toConst();
    const bladeType = floor(data.get("bladeType").toConst().mul(3.0));

    const facingAngle = data.get("facingAngle01").toConst().mul(360);

    // Get wind strength and per-blade hash from compute shader
    const windStrength01 = data.get("windStrength01").toConst();
    const perBladeHash01 = data.get("perBladeHash01").toConst();

    const toCenter = data.get("toCenter").toConst();
    const clumpSeed01 = data.get("clumpSeed01").toConst();

    // instancePos is already in world space (stored from compute shader)
    // Get world XZ position for wind calculations (already in world space)
    const worldXZ = vec2(instancePos.x, instancePos.z);

    // Sample terrain height and normal from heightmap texture
    const { th, tn } = sampleTerrainHeightAndNormal(worldXZ, uGroupOffset, heightmap);

    const dist = length(cameraPosition.sub(instancePos));

    // Calculate wind distance falloff (1.0 = full wind at near, 0.0 = no wind at far)
    // If uWindDistanceEnd is not set (0), use full wind strength
    const windDistanceFalloff = select(
      uniforms.uWindDistanceEnd.greaterThan(float(0.0)),
      oneMinus(
        smoothstep(uniforms.uWindDistanceStart, uniforms.uWindDistanceEnd, dist)
      ),
      float(1.0)
    );
    const windStrength = windStrength01.mul(windDistanceFalloff);

    // Get UV coordinates
    const uvCoords = uv();
    const t = uvCoords.y; // Position along blade (0 = base, 1 = tip)
    const s = uvCoords.x.sub(0.5).mul(2.0); // Side position (-1 to 1)

    // Bezier Control Points
    const p0 = vec3(0.0, 0.0, 0.0); // Base point
    let p3 = vec3(0.0, height, 0.0); // Tip point
    let { p1, p2 } = getBezierControlPoints(bladeType, height, bend);

    // Apply Wind Push (affects control points for overall blade push)
    const getWindDir = getWindDirection(uniforms.uWindDir);
    const windPushed = applyWindPush(getWindDir)(p1, p2, p3, windStrength, height);
    p1 = windPushed.p1;
    p2 = windPushed.p2;
    p3 = windPushed.p3;

    // Calculate spine (position along Bezier curve) and tangent
    const spine = bezier3(p0, p1, p2, p3, t);
    const tangent = normalize(bezier3Tangent(p0, p1, p2, p3, t));

    // Calculate side direction (perpendicular to tangent, used for blade width)
    const ref = vec3(0.0, 0.0, 1.0);
    const side = normalize(cross(ref, tangent));

    // Apply sin-like sway effect to vertices at top of blade
    const vertexSway = applyVertexSway(
      getWindDir,
      uniforms.uTime,
      uniforms.uWindSwayFreqMin,
      uniforms.uWindSwayFreqMax,
      uniforms.uWindSwayStrength
    );
    const swayOffset = vertexSway(side, t, height, windStrength, perBladeHash01, worldXZ);
    const spineWithSway = spine.add(swayOffset);
    const normal = normalize(cross(side, tangent));

    const widthFactor = t
      .add(uniforms.uBaseWidth)
      .mul(pow(float(1.0).sub(t), uniforms.uTipThin));

    // Use spine with sway instead of original spine
    const lposBase = spineWithSway.add(side.mul(width).mul(widthFactor).mul(s));

    const lposXZ = mx_rotate2d(vec2(lposBase.x, lposBase.z), facingAngle);
    let lpos = vec3(lposXZ.x, lposBase.y, lposXZ.y);

    const normalXZ = mx_rotate2d(vec2(normal.x, normal.z), facingAngle);
    let normalRotated = vec3(normalXZ.x, normal.y, normalXZ.y);

    // Rotate side vector for fragment shader
    const sideXZ = mx_rotate2d(vec2(side.x, side.z), facingAngle);
    let sideRotated = normalize(vec3(sideXZ.x, side.y, sideXZ.y));

    // Rotate tangent vector
    const tangentXZ = mx_rotate2d(vec2(tangent.x, tangent.z), facingAngle);
    let tangentRotated = normalize(vec3(tangentXZ.x, tangent.y, tangentXZ.y));

    // Slope Alignment: Align the local "Up" vector (0,1,0) to the "Terrain Normal"
    applySlopeAlignment(tn, lpos, tangentRotated, sideRotated, normalRotated);

    // instancePos is already in world space
    // lpos is local space blade geometry - add it directly to world position with terrain height
    // (parent group only has translation, no rotation/scale, so local-space lpos can be added directly)
    const worldPos = instancePos.add(lpos).add(vec3(float(0.0), th, float(0.0)));

    // Apply view-dependent tilt for thickness effect
    // positionFinal is in local space (object space), but we're working in world space now
    // We need to apply the tilt delta in world space directly
    const positionFinal = applyViewDependentTilt(
      lpos, // Use lpos as object space position (local blade geometry)
      worldPos, // Use worldPos as world space position
      sideRotated,
      normalRotated,
      uvCoords,
      t,
      uniforms.uThicknessStrength,
      modelWorldMatrix, // Still needed for transforming side vector
      cameraPosition
    );

    // Calculate tilt delta in local space (from lpos)
    const tiltDelta = positionFinal.sub(lpos);
    // Transform tilt delta to world space and add to worldPos
    // Since parent group only has translation (no rotation), the delta direction is preserved
    const tiltDeltaWorld = modelWorldMatrix.mul(vec4(tiltDelta.x, tiltDelta.y, tiltDelta.z, float(0.0))).xyz;
    const worldPosFinal = worldPos.add(tiltDeltaWorld);
    const worldPosFinal4 = vec4(worldPosFinal.x, worldPosFinal.y, worldPosFinal.z, float(1.0));

    // Write to varyings for fragment shader
    vGeoNormal.assign(normalRotated);
    vHeight.assign(t);
    vToCenter.assign(toCenter);
    vWorldPos.assign(worldPosFinal);
    vSide.assign(sideRotated);
    vClumpSeed.assign(clumpSeed01);
    vBladeSeed.assign(perBladeHash01); // perBladeHash01 already declared above

    // Transform from world space to clip space (reuse worldPosFinal4 vec4)
    // World space → View space → Clip space
    const viewPos = cameraViewMatrix.mul(worldPosFinal4);
    return cameraProjectionMatrix.mul(viewPos);
  });

  material.vertexNode = grassVertex();

  // Set normal node for PBR lighting
  material.normalNode = Fn(() => {
    // Width shaping (Rim + Midrib)
    const uvCoords = uv();
    const u = uvCoords.x.sub(0.5);
    const au = abs(u);

    const mid01 = smoothstep(uniforms.uMidSoft.negate(), uniforms.uMidSoft, u);
    const rimMask = smoothstep(
      uniforms.uRimPos,
      uniforms.uRimPos.add(uniforms.uRimSoft),
      au
    );
    const v01 = mix(mid01, oneMinus(mid01), rimMask);
    const ny = v01.mul(2.0).sub(1.0);

    const widthNormalStrength = float(0.35);
    const sideNorm = normalize(vSide);
    const baseNormal = normalize(vGeoNormal);
    const geoNormal = normalize(
      baseNormal.add(sideNorm.mul(ny).mul(widthNormalStrength))
    );

    // Transform to view space
    // Multiply by faceDirection to handle double-sided rendering correctly
    // faceDirection is 1.0 for front faces and -1.0 for back faces
    return transformNormalToView(geoNormal).mul(faceDirection);
  })();

  // Calculate AO factor (reusable across colorNode, roughnessNode, and envNode)
  const calculateAO = () => {
    return mix(
      float(0.35),
      float(1.0),
      clamp(pow(vHeight, uniforms.uAOPower), float(0.0), float(1.0))
    );
  };

  // Fragment shader for color calculation
  material.colorNode = Fn(() => {
    // Base Color (Height Gradient)
    const color = mix(uniforms.uBaseColor, uniforms.uTipColor, vHeight);

    // Color Layering
    const clumpSeedFactor = mix(
      uniforms.uClumpSeedRange.x,
      uniforms.uClumpSeedRange.y,
      vClumpSeed
    );
    const bladeSeedFactor = mix(
      uniforms.uBladeSeedRange.x,
      uniforms.uBladeSeedRange.y,
      vBladeSeed
    );
    let finalColor = mul(mul(color, clumpSeedFactor), bladeSeedFactor);

    // Height-based AO (reuse calculateAO)
    const ao = calculateAO();
    finalColor = mul(finalColor, ao);

    // Distance-based Shading Simplification
    const dist = length(cameraPosition.sub(vWorldPos));
    const distFade = smoothstep(float(near), float(far), dist);
    const grayValue = dot(finalColor, vec3(float(0.333)));
    const distFadeFactor = distFade.mul(float(0.35));
    finalColor = finalColor
      .mul(oneMinus(distFadeFactor))
      .add(vec3(grayValue).mul(distFadeFactor));

    // Material Blending: fade to ground color at distance
    const mixToGroundColor = smoothstep(float(near), float(far), dist);
    const mixToGroundFactor = mixToGroundColor.mul(float(0.5));
    finalColor = finalColor
      .mul(oneMinus(mixToGroundFactor))
      .add(uniforms.uGroundColor.mul(mixToGroundFactor));

    // Noise
    const uvCoords = uv();
    const noiseUv = mul(
      uvCoords,
      vec2(uniforms.uNoiseParams.x, uniforms.uNoiseParams.y)
    ).add(vec2(vBladeSeed, vClumpSeed));
    const noiseValue = mx_noise_float(noiseUv);
    // Remap noise from [-1, 1] to [uNoiseParams.z, uNoiseParams.w]
    const noiseRemapped = remapClamp(
      noiseValue,
      float(-1.0),
      float(1.0),
      uniforms.uNoiseParams.z,
      uniforms.uNoiseParams.w
    );
    finalColor = mul(finalColor, noiseRemapped);

    return vec4(finalColor, float(1.0));
  })();

  // Override roughness with AO effect: bottom (low AO) is rougher, top (high AO) is smoother
  material.roughnessNode = Fn(() => {
    const ao = calculateAO();
    // Base roughness from material property, modulated by AO
    const baseRoughness = materialRoughness;
    const roughnessMin = baseRoughness.mul(float(0.5));
    const roughnessMax = baseRoughness.mul(float(1)); 
    const roughness = mix(roughnessMax, roughnessMin, remapClamp(ao, float(0.35), float(1.0), float(0.0), float(1.0)));
    return clamp(roughness, float(0.0), float(1.0));
  })();

  material.envNode = Fn(() => {
    const envMap = material.envMap;
    if (envMap) {
      const ao = calculateAO();
      const envSample = pmremTexture(envMap).mul(ao);
      return envSample;
    }
    return vec3(0.0, 0.0, 0.0);
  })();

  // Uncomment to enable LOD debug coloring
  // material.fragmentNode = Fn(() => {

  //   const trueIndex = visibleIndicesBuffer.element(instanceIndex);

  //   const data = grassData.element(trueIndex);
  //   const instancePos = positions.element(trueIndex);

  //   const bladeType = floor(data.get("bladeType").toConst().mul(3.0));

  //   // instancePos is already in world space (stored from compute shader)
  //   const worldBasePos = instancePos;
    
  //   // Get world XZ position for wind calculations (already in world space)
  //   const worldXZ = vec2(worldBasePos.x, worldBasePos.z);

  //   // Calculate terrain height and normal
  //   // const th = terrainHeight(worldXZ);


  //   const uvCoord = worldXZ.sub(uGroupOffset.xz).div(DEFAULT_GRASS_AREA_SIZE).add(vec2(0.5));
  //   uvCoord.y = oneMinus(uvCoord.y);


  //   return vec4(uvCoord.x, uvCoord.y, float(0), float(1.0));

  //   const presence = data.get("presence").toConst();
  //   return vec4(presence, 0,0, 1.0);

  //   const typeColor = vec3(0.0, 0.0, 0.0).toVar();
  //   const isType0 = bladeType.equal(float(0.0));
  //   const isType1 = bladeType.equal(float(1.0));
  //   const isType2 = bladeType.equal(float(2.0));
    
  //   If(isType0, () => {
  //     typeColor.assign(vec3(1.0, 0.0, 0.0));
  //   }).ElseIf(isType1, () => {
  //     typeColor.assign(vec3(0.0, 1.0, 0.0));
  //   }).ElseIf(isType2, () => {
  //     typeColor.assign(vec3(0.0, 0.0, 1.0));
  //   });
  //   return vec4(typeColor, 1.0);
  // })();

  return {
    material,
  };
}
