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
  uniform,
  sin,
  mix,
  dot,
  mod,
  length,
  sqrt,
  oneMinus,
  smoothstep,
  varying,
  abs,
  clamp,
  mul,
  transformNormalToView,
  faceDirection,
  pmremTexture,
  uint,
} from "three/tsl";

/**
 * Creates a grass material with vertex shader that scales blade geometry
 * based on computed blade width and height parameters
 */
export function createGrassMaterial(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  visibleIndicesBuffer?: ReturnType<typeof instancedArray>,
  initialValues?: {
    baseWidth?: number;
    tipThin?: number;
    windTime?: number;
    windDir?: { x: number; y: number };
    swayFreqMin?: number;
    swayFreqMax?: number;
    swayStrength?: number;
    windDistanceStart?: number;
    windDistanceEnd?: number;
    cullStart?: number;
    cullEnd?: number;
    roughness?: number;
    metalness?: number;
    emissive?: string;
    envMapIntensity?: number;
    midSoft?: number;
    rimPos?: number;
    rimSoft?: number;
    baseColor?: THREE.Color | string;
    tipColor?: THREE.Color | string;
    groundColor?: THREE.Color | string;
    bladeSeedRange?: { x: number; y: number };
    clumpSeedRange?: { x: number; y: number };
    aoPower?: number;
    lightDirection?: THREE.Vector3;
    lightColor?: THREE.Color | string;
    lightBackStrength?: number;
    noiseParams?: { x: number; y: number; z: number; w: number };
  }
) {
  const baseWidth = initialValues?.baseWidth ?? 0.35;
  const tipThin = initialValues?.tipThin ?? 0.9;

  // Wind uniforms
  const uWindTime = uniform(initialValues?.windTime ?? 0.0);
  const uWindDir = uniform(
    vec2(initialValues?.windDir?.x ?? 1.0, initialValues?.windDir?.y ?? 0.0)
  );
  const uWindSwayFreqMin = uniform(initialValues?.swayFreqMin ?? 0.4);
  const uWindSwayFreqMax = uniform(initialValues?.swayFreqMax ?? 1.5);
  const uWindSwayStrength = uniform(initialValues?.swayStrength ?? 0.1);
  const uWindDistanceStart = uniform(initialValues?.windDistanceStart ?? 10.0);
  const uWindDistanceEnd = uniform(initialValues?.windDistanceEnd ?? 30.0);

  // Width shaping uniforms
  const uMidSoft = uniform(initialValues?.midSoft ?? 0.25);
  const uRimPos = uniform(initialValues?.rimPos ?? 0.42);
  const uRimSoft = uniform(initialValues?.rimSoft ?? 0.03);

  // Color uniforms
  const baseColorValue =
    initialValues?.baseColor instanceof THREE.Color
      ? initialValues.baseColor
      : new THREE.Color(initialValues?.baseColor ?? "#000000");
  const tipColorValue =
    initialValues?.tipColor instanceof THREE.Color
      ? initialValues.tipColor
      : new THREE.Color(initialValues?.tipColor ?? "#ffffff");
  const groundColorValue =
    initialValues?.groundColor instanceof THREE.Color
      ? initialValues.groundColor
      : new THREE.Color(initialValues?.groundColor ?? "#1a3319");
  const lightColorValue =
    initialValues?.lightColor instanceof THREE.Color
      ? initialValues.lightColor
      : new THREE.Color(initialValues?.lightColor ?? "#ffffff");

  const uBaseColor = uniform(
    vec3(baseColorValue.r, baseColorValue.g, baseColorValue.b)
  );
  const uTipColor = uniform(
    vec3(tipColorValue.r, tipColorValue.g, tipColorValue.b)
  );
  const uGroundColor = uniform(
    vec3(groundColorValue.r, groundColorValue.g, groundColorValue.b)
  );
  const uBladeSeedRange = uniform(
    vec2(
      initialValues?.bladeSeedRange?.x ?? 0.95,
      initialValues?.bladeSeedRange?.y ?? 1.03
    )
  );
  const uClumpSeedRange = uniform(
    vec2(
      initialValues?.clumpSeedRange?.x ?? 0.9,
      initialValues?.clumpSeedRange?.y ?? 1.1
    )
  );
  const uAOPower = uniform(initialValues?.aoPower ?? 0.6);
  const uLightDirection = uniform(
    vec3(
      initialValues?.lightDirection?.x ?? 0.0,
      initialValues?.lightDirection?.y ?? 0.0,
      initialValues?.lightDirection?.z ?? -1.0
    )
  );
  const uLightColor = uniform(
    vec3(lightColorValue.r, lightColorValue.g, lightColorValue.b)
  );
  const uLightBackStrength = uniform(initialValues?.lightBackStrength ?? 0.6);
  const uNoiseParams = uniform(
    vec4(
      initialValues?.noiseParams?.x ?? 1.0,
      initialValues?.noiseParams?.y ?? 3.0,
      initialValues?.noiseParams?.z ?? 0.7,
      initialValues?.noiseParams?.w ?? 1.0
    )
  );

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

  // Apply material properties
  material.roughness = initialValues?.roughness ?? 0.3;
  material.metalness = initialValues?.metalness ?? 0.5;
  if (initialValues?.emissive) {
    material.emissive = new THREE.Color(initialValues.emissive);
  }
  material.envMapIntensity = initialValues?.envMapIntensity ?? 0.5;

  const grassVertex = Fn(() => {
    // Bezier Curve Functions
    const bezier3 = (p0: any, p1: any, p2: any, p3: any, t: any) => {
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

    const bezier3Tangent = (p0: any, p1: any, p2: any, p3: any, t: any) => {
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

    const getBezierControlPoints = (
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

    const safeNormalize2D = (v: any) => {
      const m2 = dot(v, v);
      const len = sqrt(m2);
      const threshold = float(1e-6);
      return select(len.greaterThan(threshold), v.div(len), vec2(1.0, 0.0));
    };

    const getWindDirection = () => {
      const windDir2D = safeNormalize2D(uWindDir);
      return vec3(windDir2D.x, 0.0, windDir2D.y);
    };

    const applyWindPush = (
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

    const applyWindSway = (
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
        float(0.35).mul(sin(uWindTime.mul(0.35).add(seed.mul(6.28318))))
      );

      // Traveling wave along wind direction (big-scale flow)
      const wave = dot(worldXZ, windDir2).mul(0.15);

      // Per-blade frequency variation: mix between min and max based on hash
      const baseFreq = mix(uWindSwayFreqMin, uWindSwayFreqMax, seed);
      const phase = perBladeHash01.mul(6.28318).add(wave);

      // Low freq (main sway) + high freq (small flutter)
      const low = sin(uWindTime.mul(baseFreq).add(phase).add(t.mul(2.2)));
      const high = sin(
        uWindTime.mul(baseFreq.mul(5.0)).add(phase.mul(1.7)).add(t.mul(5.0))
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

    // Get data from compute shader
    // If using indirect drawing, read the actual blade index from visible indices buffer
    // Otherwise, use instanceIndex directly
    const trueIndex = visibleIndicesBuffer !== undefined 
      ? visibleIndicesBuffer.element(instanceIndex)
      : uint(instanceIndex);
    
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
    const dist = length(cameraPosition.sub(worldBasePos));

    // Calculate wind distance falloff (1.0 = full wind at near, 0.0 = no wind at far)
    // If uWindDistanceEnd is not set (0), use full wind strength
    const windDistanceFalloff = select(
      uWindDistanceEnd.greaterThan(float(0.0)),
      oneMinus(smoothstep(uWindDistanceStart, uWindDistanceEnd, dist)),
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
    const windPushed = applyWindPush(p1, p2, p3, windStrength, height);
    const windSwayed = applyWindSway(
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

    // Calculate width factor (matching GLSL: (shapeT + uGeometryBaseWidth) * pow(1.0 - shapeT, uGeometryTipThin))
    const shapeT = t; // For now, shapeT = t (will differ when LOD is added)
    const widthFactor = shapeT
      .add(float(baseWidth))
      .mul(pow(float(1.0).sub(shapeT), float(tipThin)));

    // Apply width offset from spine (matching GLSL: spine + side * width * widthFactor * s)
    // For now, skip densityCompensation and finalPresence (will be added later)
    const lpos = spine.add(side.mul(width).mul(widthFactor).mul(s));

    // Apply rotation (matching GLSL: lpos.xz = rotate2D(lpos.xz, facingAngle))
    // Rotate only XZ components, preserving Y
    const lposXZ = mx_rotate2d(vec2(lpos.x, lpos.z), facingAngle);
    const lposRotated = vec3(lposXZ.x, lpos.y, lposXZ.y);

    const normalXZ = mx_rotate2d(vec2(normal.x, normal.z), facingAngle);
    const normalRotated = vec3(normalXZ.x, normal.y, normalXZ.y);

    // Rotate side vector for fragment shader
    const sideXZ = mx_rotate2d(vec2(side.x, side.z), facingAngle);
    const sideRotated = normalize(vec3(sideXZ.x, side.y, sideXZ.y));

    // Calculate world position for fragment shader
    const position = lposRotated.add(instancePos);
    const positionWorldVec4 = modelWorldMatrix.mul(
      vec4(position.x, position.y, position.z, float(1.0))
    );
    const worldPos = positionWorldVec4.xyz;

    // Write to varyings for fragment shader
    vGeoNormal.assign(normalRotated);
    vHeight.assign(shapeT);
    vToCenter.assign(toCenter);
    vWorldPos.assign(worldPos);
    vSide.assign(sideRotated);
    vClumpSeed.assign(clumpSeed01);
    vBladeSeed.assign(perBladeHash01); // perBladeHash01 already declared above

    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(position);
  });

  material.vertexNode = grassVertex();

  const computeLightingNormal = Fn(
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

  // Set normal node for PBR lighting
  material.normalNode = Fn(() => {
    // Width shaping (Rim + Midrib)
    const uvCoords = uv();
    const u = uvCoords.x.sub(0.5);
    const au = abs(u);

    const mid01 = smoothstep(uMidSoft.negate(), uMidSoft, u);
    const rimMask = smoothstep(uRimPos, uRimPos.add(uRimSoft), au);
    const v01 = mix(mid01, oneMinus(mid01), rimMask);
    const ny = v01.mul(2.0).sub(1.0);

    const widthNormalStrength = float(0.35);
    const sideNorm = normalize(vSide);
    const baseNormal = normalize(vGeoNormal);
    const geoNormal = normalize(
      baseNormal.add(sideNorm.mul(ny).mul(widthNormalStrength))
    );

    // This blends geometry normal with clump normal based on height and distance
    const finalWorldNormal = computeLightingNormal(
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
    const color = mix(uBaseColor, uTipColor, vHeight);

    // Color Layering
    const clumpSeedFactor = mix(
      uClumpSeedRange.x,
      uClumpSeedRange.y,
      vClumpSeed
    );
    const bladeSeedFactor = mix(
      uBladeSeedRange.x,
      uBladeSeedRange.y,
      vBladeSeed
    );
    let finalColor = mul(mul(color, clumpSeedFactor), bladeSeedFactor);

    // Height-based AO
    const ao = mix(
      float(0.35),
      float(1.0),
      clamp(pow(vHeight, uAOPower), float(0.0), float(1.0))
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
      .add(uGroundColor.mul(mixToGroundFactor));

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
    // const uvCoords = uv();
    // const noiseUv = mul(uvCoords, vec2(uNoiseParams.x, uNoiseParams.y)).add(
    //   vec2(vBladeSeed, vClumpSeed)
    // );
    // const noiseValue = mx_fractal_noise_float(noiseUv);
    // // Remap noise from [-1, 1] to [uNoiseParams.z, uNoiseParams.w]
    // const noiseRemapped = remapClamp(
    //   noiseValue,
    //   float(-1.0),
    //   float(1.0),
    //   uNoiseParams.z,
    //   uNoiseParams.w
    // );
    // finalColor = mul(finalColor, noiseRemapped);

    return vec4(finalColor, float(1.0));
  })();

  material.envNode = Fn(() => {
    const envMap = material.envMap;
    if (envMap) {
      const ao = mix(
        float(0.35),
        float(1.0),
        clamp(pow(vHeight, uAOPower), float(0.0), float(1.0))
      );
      const envSample = pmremTexture(envMap).mul(ao);
      return envSample;
    }
    return vec3(0.0, 0.0, 0.0);
  })();

  // material.fragmentNode = Fn(() => {
  //   const data = grassData.element(instanceIndex);
  //   const presence = data.get("presence").toConst("presence");
  //   const baseNormal = normalize(vGeoNormal);

  //   const normalColor = normalView.mul(0.5).add(0.5);
  //   return vec4(vHeight, 0,0, float(1.0));
  // })();

  return {
    material,
    uniforms: {
      uWindTime,
      uWindDir,
      uWindSwayFreqMin,
      uWindSwayFreqMax,
      uWindSwayStrength,
      uWindDistanceStart,
      uWindDistanceEnd,
      uMidSoft,
      uRimPos,
      uRimSoft,
      uBaseColor,
      uTipColor,
      uGroundColor,
      uBladeSeedRange,
      uClumpSeedRange,
      uAOPower,
      uLightDirection,
      uLightColor,
      uLightBackStrength,
      uNoiseParams,
    },
  };
}
