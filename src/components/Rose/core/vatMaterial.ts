import * as THREE from "three/webgpu";
import {
  texture,
  uniform,
  vec2,
  float,
  positionLocal,
  uv,
  vertexColor,
  Fn,
  vec4,
  vec3,
  step,
  abs,
  sign,
  normalize,
  transformNormalToView,
  mix,
  varying,
  instanceIndex,
  instancedArray,
  mx_rotate2d,
  fract,
  smoothstep,
  mx_hsvtorgb,
  mx_rgbtohsv,
  mx_noise_float,
  remapClamp,
  cross,
  dot,
  clamp,
  acos,
  length,
  If
} from "three/tsl";
import { VATMeta } from "./types";
import { TerrainUniforms } from "../../types";
import { getTerrainHeight, getTerrainNormal, rotateAxis } from "../../terrain/terrainHelpers";
import { calculateWindStrength, safeNormalize } from "../../grass/core/windHelpers";
import { WindUniforms } from "../../wind/Wind";

/**
 * Simple VAT node material based on GLSL shader
 * Samples position and normal textures using uv1 coordinates
 * Consumes an external uFrame uniform so callers can drive animation
 */
export function createVATMaterial(
  posTex: THREE.Texture,
  nrmTex: THREE.Texture,
  vatData: ReturnType<typeof instancedArray>,
  visibleIndicesBuffer: ReturnType<typeof instancedArray>,
  meta: VATMeta,
  uniforms: Record<string, any>,
  colorTex: THREE.Texture,
  outlineTex: THREE.Texture,
  normalMapTex: THREE.Texture,
  terrainUniforms?: TerrainUniforms,
  windUniforms?: WindUniforms,
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();
  material.side = THREE.DoubleSide;

  const outline = texture(outlineTex, uv());
  // Get correct instance data
  const uvCord = vec2(uv().x.sub(0.5).mul(0.8).add(0.5), uv().y);

  const trueIndex = visibleIndicesBuffer.element(instanceIndex);
  const data = vatData.element(trueIndex);
  const seed = data.get("seed");
  const progress = data.get("progress");

  // Handle VAT animation frame
  const frame = data.get("frame");
  const texWidth = meta.textureWidth;
  const uFrames = uniform(meta.frameCount);
  const uv1 = uv(1);
  const frameIndex = uFrames.sub(float(1.0)).mul(frame);
  const frameOffset = frameIndex.mul(1.0 / texWidth);
  const sampleUV = vec2(uv1.x.add(frameOffset), uv1.y);

  // HSV shift helper: input rgb + hsv shift -> rgb
  const hsvShift = Fn(([color, shift]: [any, any]) => {
    const hsv = mx_rgbtohsv(color);
    const shifted = vec3(
      hsv.x.add(shift.x),
      hsv.y.add(shift.y),
      hsv.z.add(shift.z)
    );
    const clamped = vec3(
      shifted.x,
      shifted.y.clamp(0.0, 1.0),
      shifted.z.clamp(0.0, 1.0)
    );
    return mx_hsvtorgb(clamped);
  });

  // Optional terrain height/normal functions
  const terrainHeightFn = terrainUniforms
    ? getTerrainHeight(terrainUniforms.uTerrainAmp, terrainUniforms.uTerrainFreq, terrainUniforms.uTerrainSeed)
    : null;
  const terrainNormalFn = terrainHeightFn ? getTerrainNormal(terrainHeightFn) : null;
  const hasWind = !!windUniforms;

  // Position calculation (Refactor: read position and scale from buffer)
  material.positionNode = Fn(() => {
    // Read VAT vertex offset
    const vatPos = texture(posTex, sampleUV).rgb;

    const xzRotated = mx_rotate2d(vec2(vatPos.x, vatPos.z), seed.mul(360));
    const rotatedOffset = vec3(xzRotated.x, vatPos.y, xzRotated.y);

    // Apply instance scale
    const scale = mix(uniforms.uScaleMin, uniforms.uScaleMax, seed);
    const scaledOffset = rotatedOffset.mul(scale);
    const heightFactor = smoothstep(float(0.0), float(0.5), vatPos.y.abs());

    let instancePos = data.get("position");

    // Apply wind sway (same wind logic as grass)
    if (hasWind && windUniforms) {
      const windDirNorm = safeNormalize(windUniforms.uWindDir);
      const windStrength = calculateWindStrength(instancePos.xz, {
        uWindDir: windUniforms.uWindDir,
        uWindScale: windUniforms.uWindScale,
        uTime: windUniforms.uTime,
        uWindSpeed: windUniforms.uWindSpeed,
        uWindStrength: windUniforms.uWindStrength,
      });
      const swayX = windDirNorm.x.mul(windStrength.mul(heightFactor)); // small sway factor scaled by height
      const swayZ = windDirNorm.y.mul(windStrength.mul(heightFactor));
      const swayVec = vec3(swayX, float(0.0), swayZ);
      instancePos = instancePos.add(swayVec);
    }

    // // Optional slope alignment using terrain normal (reuse helper)
    // if (terrainNormalFn) {
    //   const tn = terrainNormalFn(instancePos.xz);
    //   const up = vec3(float(0.0), float(1.0), float(0.0));
    //   const axis = cross(up, tn);
    //   const dotProd = clamp(dot(up, tn), float(-1.0), float(1.0));
    //   const angle = acos(dotProd);
      
    //   // Only rotate if slope is significant
    //   const axisLen = length(axis);
    //   const minAxisLen = float(0.001);
    //   const shouldRotate = axisLen.greaterThan(minAxisLen);
      
    //   If(shouldRotate, () => {
    //     const axisNorm = normalize(axis);
    //     const rotated = rotateAxis(scaledOffset, axisNorm, angle);
    //     scaledOffset.assign(rotated);
    //   });
    // }

    // Apply world position (instance offset + VAT shape)
    let worldPos = positionLocal.add(scaledOffset).add(instancePos);

    // Apply terrain height offset if available
    if (terrainHeightFn) {
      const h = terrainHeightFn(instancePos.xz);
      return vec3(worldPos.x, worldPos.y.add(h), worldPos.z);
    }

    return worldPos;
  })();

  // material.fragmentNode = Fn(() => {
  //   // const dieOut = smoothstep(0., 1.0, smoothstep(1.0, 0.8, progress)); 
  //   const dieOut = smoothstep(0.9, 0.8, progress); 

  //   return vec4(dieOut, 0.0, 0.0, 1.0);
  // })();


  // Color processing with HSV shift
  material.colorNode = Fn(() => {
    const vColor = vertexColor(0).r;
    const isPetal = step(abs(vColor.sub(0.7)), 0.05);
    const isStem = step(abs(vColor.sub(0.0)), 0.05);
    const isLeaf = step(abs(vColor.sub(1.0)), 0.05);

    const n = remapClamp(mx_noise_float(uv().mul(uniforms.uNoiseScale)), 0.0, 1.0, 0.0, 1.0);
    const stemColor = mix(uniforms.uGreen, uniforms.uGreen2, n);

    let petalCol = texture(colorTex, uvCord).rgb;

    const hueShift = seed.mul(float(0.02).add(smoothstep(float(0.6), float(1.0), progress).mul(0.03))).add(uniforms.uHueShift);//          .add(smoothstep(float(0.6), float(1.0), progress).mul(0.03))).add(uniforms.uHueShift);
    const valueShift = fract(seed.mul(25.0)).mul(1);
    petalCol = hsvShift(petalCol, vec3(hueShift, 0.0, valueShift));
    const darker = hsvShift(petalCol, vec3(0.0, 0.0, -0.1));
    petalCol = mix(darker, petalCol, outline.rgb);

    const finalColor = petalCol.mul(isPetal)
      .add(stemColor.mul(isStem))
      .add(stemColor.mul(isLeaf));

    const dieOut = smoothstep(0.95, 0.8, progress); 
    finalColor.mulAssign(dieOut);
    
    return vec4(finalColor, 1.0);
  })();

  // Calculate VAT normal with rotation matching the position
  const calculateVatNormalView = Fn(() => {
    const texel = texture(nrmTex, sampleUV);
    let vatNormalLocal: any;

    if (meta.compressNormal) {
      const encoded = texel.xy.mul(vec2(2.0)).sub(vec2(1.0));
      const v = vec3(
        encoded.x,
        encoded.y,
        float(1.0).sub(abs(encoded.x)).sub(abs(encoded.y))
      );

      const sX = sign(v.x);
      const sY = sign(v.y);
      const adjX = float(1.0).sub(abs(v.y)).mul(sX);
      const adjY = float(1.0).sub(abs(v.x)).mul(sY);

      const t = step(float(0.0), v.z);
      const finalX = mix(adjX, v.x, t);
      const finalY = mix(adjY, v.y, t);
      vatNormalLocal = normalize(vec3(finalX, finalY, v.z));
    } else {
      // Uncompressed normals: multiply by 2 and subtract 1
      vatNormalLocal = normalize(texel.rgb.mul(vec3(2.0)).sub(vec3(1.0)));
    }

    const xzRotated = mx_rotate2d(vec2(vatNormalLocal.x, vatNormalLocal.z), seed.mul(360));
    const rotatedNormalLocal = vec3(xzRotated.x, vatNormalLocal.y, xzRotated.y);

    return transformNormalToView(rotatedNormalLocal);
  });
  const vatNormalView = varying(calculateVatNormalView());

  material.normalNode = Fn(() => {
    const mapN = texture(normalMapTex, uvCord).rgb.mul(2.0).sub(1.0);
    const finalNormal = vatNormalView
      .add(mapN.mul(uniforms.uNormalScale));
    return  normalize(finalNormal);
  })();

  return material;
}
