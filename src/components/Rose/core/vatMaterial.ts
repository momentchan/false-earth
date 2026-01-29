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
  If,
  time,
  positionWorld,
  cameraPosition,
  oneMinus,
  materialNormal,
  normalMap,
  TBNViewMatrix,
  mat3,
  faceDirection,
  materialRoughness,
} from "three/tsl";
import { VATMeta } from "./config";
import { TerrainUniforms } from "../../../core/types";
import { getTerrainHeight, getTerrainNormal, rotateAxis } from "../../../core/shaders/terrainHelpers";
import { calculateWindStrength, safeNormalize } from "../../../core/shaders/windHelpers";
import { WindUniforms } from "../../../core/types";

const hsvShift = Fn(([color, shift]: [any, any]) => {
  const hsv = mx_rgbtohsv(color);
  const shifted = vec3(hsv.x.add(shift.x), hsv.y.add(shift.y), hsv.z.add(shift.z));
  const clamped = vec3(shifted.x.clamp(0.0, 1.0), shifted.y.clamp(0.0, 1.0), shifted.z.clamp(0.0, 1.0));
  return mx_hsvtorgb(clamped);
});

const decodeVatNormal = (texel: any, isCompressed: boolean) => {
  if (isCompressed) {
    const encoded = texel.xy.mul(2.0).sub(1.0);
    const vZ = float(1.0).sub(abs(encoded.x)).sub(abs(encoded.y));
    const v = vec3(encoded.x, encoded.y, vZ);
    const s = sign(v.xy);
    const adj = float(1.0).sub(abs(v.yx)).mul(s);
    const finalXY = mix(adj, v.xy, step(0.0, v.z));
    return normalize(vec3(finalXY.x, finalXY.y, v.z));
  }
  return normalize(texel.rgb.mul(2.0).sub(1.0));
};


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

  // context & data
  const trueIndex = visibleIndicesBuffer.element(instanceIndex);
  const data = vatData.element(trueIndex);
  const seed = data.get("seed");
  const progress = data.get("progress");
  const instancePos = data.get("position");

  // mask
  const vColor = vertexColor(0).r;
  const isPetal = step(abs(vColor.sub(0.7)), 0.05);
  const isStem = step(abs(vColor.sub(0.0)), 0.05);
  const isLeaf = step(abs(vColor.sub(1.0)), 0.05);
  const outline = texture(outlineTex, uv());
  const uvCord = vec2(uv().x.sub(0.5).mul(0.8).add(0.5), uv().y);

  // vat frame
  const frame = data.get("frame");
  const uFrames = uniform(meta.frameCount);
  const frameIndex = uFrames.sub(float(1.0)).mul(frame);
  const sampleUV = vec2(uv(1).x.add(frameIndex.mul(1.0 / meta.textureWidth)), uv(1).y);

  // terrain
  const terrainHeightFn = terrainUniforms
    ? getTerrainHeight(terrainUniforms.uTerrainAmp, terrainUniforms.uTerrainFreq, terrainUniforms.uTerrainSeed)
    : null;
  const terrainNormalFn = terrainHeightFn ? getTerrainNormal(terrainHeightFn) : null;

  const applyRotation = Fn(([vec]: [any]) => {
    const xzRotated = mx_rotate2d(vec2(vec.x, vec.z), seed.mul(360));
    let result = vec3(xzRotated.x, vec.y, xzRotated.y);

    if (terrainNormalFn) {
      const tn = terrainNormalFn(instancePos.xz);
      const up = vec3(0.0, 1.0, 0.0);
      const axis = cross(up, tn);
      const dotProd = clamp(dot(up, tn), -1.0, 1.0);
      const angle = acos(dotProd);

      If(length(axis).greaterThan(0.001), () => {
        result.assign(rotateAxis(result, normalize(axis), angle));
      });
    }

    return result;
  });


  material.positionNode = Fn(() => {
    const vatPos = texture(posTex, sampleUV).rgb;

    const scale = mix(uniforms.uScaleMin, uniforms.uScaleMax, seed);
    const localPos = applyRotation(vatPos.mul(scale));

    let worldPos = positionLocal.add(localPos).add(instancePos);

    if (windUniforms) {
      const heightFactor = smoothstep(float(0.0), float(0.08), vatPos.y.abs()).mul(0.2);
      const windDirNorm = safeNormalize(windUniforms.uWindDir);
      const windStrength = calculateWindStrength(instancePos.xz, {
        uWindDir: windUniforms.uWindDir,
        uWindScale: windUniforms.uWindScale,
        uTime: windUniforms.uTime,
        uWindSpeed: windUniforms.uWindSpeed,
        uWindStrength: windUniforms.uWindStrength,
      });
      const sway = vec3(windDirNorm.x, 0.0, windDirNorm.y).mul(windStrength.mul(heightFactor));
      worldPos = worldPos.add(sway);
    }

    if (terrainHeightFn) {
      worldPos.y.addAssign(terrainHeightFn(instancePos.xz));
    }

    return worldPos;
  })();

  material.colorNode = Fn(() => {
    const ns = mix(uniforms.uNoiseScale, vec2(5, 5), isPetal);
    const nr = mix(vec2(0, 1), vec2(0.5, 1), isPetal);
    const n = remapClamp(mx_noise_float(uv().mul(ns)), -1.0, 1.0, nr.x, nr.y);
    const stemColor = mix(uniforms.uGreen, uniforms.uGreen2, n);

    let petalCol = texture(colorTex, uvCord).rgb;
    const seed2 = fract(seed.mul(87.65));

    const hueShift = seed2.mul(float(uniforms.uHueRandomness).add(smoothstep(float(0.6), float(1.0), progress).mul(0.03))).add(uniforms.uHueShift);
    const valueShift = fract(seed2.mul(25.0)).mul(1);
    petalCol = hsvShift(petalCol, vec3(hueShift, 0.0, valueShift));
    const darker = hsvShift(petalCol, vec3(0.0, 0.0, -0.1));
    petalCol = mix(darker, petalCol, outline.rgb);

    petalCol.mulAssign(n);

    const finalColor = petalCol.mul(isPetal)
      .add(stemColor.mul(isStem))
      .add(stemColor.mul(isLeaf));

    return vec4(finalColor.mul(smoothstep(0.95, 0.8, progress)), 1.0);
  })();


  // Calculate VAT normal with rotation matching the position
  const calculateVatNormalView = Fn(() => {
    const rawNormal = texture(nrmTex, sampleUV);
    const vatNormalLocal = decodeVatNormal(rawNormal, meta.compressNormal ?? true);
    const rotatedNormalLocal = applyRotation(vatNormalLocal);
    return transformNormalToView(rotatedNormalLocal);
  });

  const vN = varying(calculateVatNormalView());

  const calculateVatTangentView = Fn(() => {
    const baseTangent = vec3(1.0, 0.0, 0.0);
    const rotatedTangent = applyRotation(baseTangent);
    const vTangentGuess = transformNormalToView(rotatedTangent);
    return normalize(vTangentGuess.sub(vN.mul(dot(vN, vTangentGuess))));
  });

  const vT = varying(calculateVatTangentView());
  const vB = normalize(cross(vT, vN));

  material.normalNode = Fn(() => {
    const mapN = texture(normalMapTex, uvCord).rgb.mul(2.0).sub(1.0);
    const scaledMapN = vec3(mapN.xy.mul(uniforms.uNormalScale), mapN.z);
    const tbn = mat3(vT, vB, vN);
    return normalize(tbn.mul(scaledMapN)).mul(faceDirection);
  })();

  // Fresnel emissive effect
  material.emissiveNode = Fn(() => {
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const fresnel = float(1.0).sub(abs(dot(materialNormal, viewDir)))
      .pow(uniforms.uFresnelPower)
      .mul(uniforms.uFresnelIntensity);

    // Apply fresnel to emissive
    const u = mix(uv(0).x, uv(0).y, isPetal);
    const animSpeed = mix(-0.2, -0.7, fract(seed.mul(35.8)));
    const t = time.add(seed.mul(123.0)).mul(animSpeed);
    const wave = smoothstep(0.3, 0.0, abs(u.sub(mix(-0.2, 1.2, fract(t)))));
    const glow = wave.mul(uniforms.uEmissiveIntensity);

    return uniforms.uEmissiveColor.mul(glow.add(fresnel));
  })();

  // material.fragmentNode = Fn(() => {
  //   const u = mix(uv(0).x, uv(0).y, isPetal);
  //   const s = smoothstep(0.0, 1, u);
  //   const t = time.add(seed.mul(123.0)).mul(-0.5);
  //   const d = smoothstep(0.3, 0.0, abs(u.sub(mix(-0.2, 1.2, fract(t))))).mul(s).mul(oneMinus(s));
  //   const vatPos = texture(posTex, sampleUV).rgb;
  //   const heightFactor = smoothstep(float(0.0), float(0.08), vatPos.y.abs());

  //   return vec4(materialRoughness, 0, 0, 1.0);
  //   return vec4(oneMinus(heightFactor), 0, 0.0, 1.0);
  // })();

  return material;
}
