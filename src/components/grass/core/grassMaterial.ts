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
  mx_fractal_noise_float,
  mx_noise_float,
  remapClamp,
  normalView,
  directionToColor,
  normalWorld,
} from "three/tsl";
import {
  getTerrainHeight,
  getTerrainNormal,
} from "../../terrain/terrainHelpers";
import {
  bezier3,
  bezier3Tangent,
  getBezierControlPoints,
  getWindDirection,
  applyWindPush,
  applyWindSway,
  computeLightingNormal,
  applySlopeAlignment,
  applyViewDependentTilt,
} from "./shaderHelpers";

/**
 * Creates a grass material with vertex shader that scales blade geometry
 * based on computed blade width and height parameters
 */
export function createGrassMaterial(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  visibleIndicesBuffer: ReturnType<typeof instancedArray>,
  uniforms: Record<string, any>,
  terrainUniforms?: {
    uTerrainAmp: any;
    uTerrainFreq: any;
    uTerrainSeed: any;
    uColor: any;
  }
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

  // Use terrain uniforms (required)
  const terrainAmp = terrainUniforms?.uTerrainAmp ?? uniform(2.5);
  const terrainFreq = terrainUniforms?.uTerrainFreq ?? uniform(0.1);
  const terrainSeed = terrainUniforms?.uTerrainSeed ?? uniform(0.0);

  const grassVertex = Fn(() => {
    // Terrain helper functions
    const terrainHeight = getTerrainHeight(
      terrainAmp,
      terrainFreq,
      terrainSeed
    );
    const terrainNormal = getTerrainNormal(terrainHeight);

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

    const worldBasePos = modelWorldMatrix.mul(
      vec4(instancePos.x, instancePos.y, instancePos.z, float(1.0))
    ).xyz;

    // Calculate terrain height and normal
    const th = terrainHeight(vec2(worldBasePos.x, worldBasePos.z));
    const tn = terrainNormal(vec2(worldBasePos.x, worldBasePos.z));

    const dist = length(cameraPosition.sub(worldBasePos));

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

    // Apply Wind Effects
    const windDir = getWindDirection(uniforms.uWindDir);
    const windPushed = applyWindPush(windDir)(p1, p2, p3, windStrength, height);
    const windSwayed = applyWindSway(
      windDir,
      uniforms.uTime,
      uniforms.uWindSwayFreqMin,
      uniforms.uWindSwayFreqMax,
      uniforms.uWindSwayStrength
    )(
      windPushed.p1,
      windPushed.p2,
      windPushed.p3,
      windStrength,
      height,
      perBladeHash01,
      t,
      vec2(instancePos.x, instancePos.z)
    );
    p1 = windSwayed.p1;
    p2 = windSwayed.p2;
    p3 = windSwayed.p3;

    // Calculate spine (position along Bezier curve) and tangent
    const spine = bezier3(p0, p1, p2, p3, t);
    const tangent = normalize(bezier3Tangent(p0, p1, p2, p3, t));

    const ref = vec3(0.0, 0.0, 1.0);
    const side = normalize(cross(ref, tangent));
    const normal = normalize(cross(side, tangent));

    const widthFactor = t
      .add(uniforms.uBaseWidth)
      .mul(pow(float(1.0).sub(t), uniforms.uTipThin));

    const lposBase = spine.add(side.mul(width).mul(widthFactor).mul(s));

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

    // Apply terrain height offset (Y-up in world space)
    const position = vec3(
      lpos.x.add(instancePos.x),
      lpos.y.add(instancePos.y).add(th),
      lpos.z.add(instancePos.z)
    );

    // Transform to world space for tilt calculation
    const worldPos = modelWorldMatrix.mul(
      vec4(position.x, position.y, position.z, float(1.0))
    ).xyz;

    // Apply view-dependent tilt for thickness effect
    const positionFinal = applyViewDependentTilt(
      position,
      worldPos,
      sideRotated,
      normalRotated,
      uvCoords,
      t,
      uniforms.uThicknessStrength,
      modelWorldMatrix,
      cameraPosition
    );

    // Transform final position to world space
    const worldPosFinal = modelWorldMatrix.mul(
      vec4(positionFinal.x, positionFinal.y, positionFinal.z, float(1.0))
    ).xyz;

    // Write to varyings for fragment shader
    vGeoNormal.assign(normalRotated);
    vHeight.assign(t);
    vToCenter.assign(toCenter);
    vWorldPos.assign(worldPosFinal);
    vSide.assign(sideRotated);
    vClumpSeed.assign(clumpSeed01);
    vBladeSeed.assign(perBladeHash01); // perBladeHash01 already declared above

    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(positionFinal);
  });

  material.vertexNode = grassVertex();

  const lightingNormal = computeLightingNormal(near, far);

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

    // This blends geometry normal with clump normal based on height and distance
    const finalWorldNormal = lightingNormal(
      geoNormal,
      vToCenter,
      vHeight,
      vWorldPos
    );

    // Transform to view space
    // Multiply by faceDirection to handle double-sided rendering correctly
    // faceDirection is 1.0 for front faces and -1.0 for back faces
    return transformNormalToView(finalWorldNormal).mul(faceDirection);
  })();

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

    // Height-based AO
    const ao = mix(
      float(0.35),
      float(1.0),
      clamp(pow(vHeight, uniforms.uAOPower), float(0.0), float(1.0))
    );
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

    // Fake Translucency / Backlight
    // const baseNormal = normalize(vGeoNormal);
    // const V = normalize(cameraPosition.sub(vWorldPos));
    // const L = normalize(uLightDirection);
    // const lightingNormal = computeLightingNormal(
    //   vGeoNormal,
    //   vToCenter,
    //   vHeight,
    //   vWorldPos
    // );
    // const N = lightingNormal;
    // const backNdL = clamp(dot(N.negate(), L), float(0.0), float(1.0));
    // const NdV = dot(baseNormal, V);
    // const viewGrazing = smoothstep(float(0.0), float(0.6), oneMinus(NdV));

    // const thickness = pow(oneMinus(vHeight), float(1.3));
    // const backLight = mul(mul(backNdL, viewGrazing), thickness);

    // const trans = mul(mul(uLightColor, backLight), uLightBackStrength);
    // finalColor = finalColor.add(trans);

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

  material.envNode = Fn(() => {
    const envMap = material.envMap;
    if (envMap) {
      const ao = mix(
        float(0.35),
        float(1.0),
        clamp(pow(vHeight, uniforms.uAOPower), float(0.0), float(1.0))
      );
      const envSample = pmremTexture(envMap).mul(ao);
      return envSample;
    }
    return vec3(0.0, 0.0, 0.0);
  })();

  // material.fragmentNode = Fn(() => {
  //   const normalColor = directionToColor(normalWorld);
  //   const rawDataColor = normalColor.pow(2.2);

  //   return vec4(rawDataColor, 1);
  // })();

  return {
    material,
  };
}
