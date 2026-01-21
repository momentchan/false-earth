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
} from "three/tsl";
import { VATMeta } from "../types";

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
  _outlineTex: THREE.Texture
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();
  material.side = THREE.DoubleSide;



  // Get correct instance data
  const trueIndex = visibleIndicesBuffer.element(instanceIndex);
  const data = vatData.element(trueIndex);

  // Handle VAT animation frame
  const frame = data.get("frame");
  const texWidth = meta.textureWidth;
  const uFrames = uniform(meta.frameCount);
  const uv1 = uv(1);
  const frameIndex = uFrames.sub(float(1.0)).mul(frame);
  const frameOffset = frameIndex.mul(1.0 / texWidth);
  const sampleUV = vec2(uv1.x.add(frameOffset), uv1.y);

  // Position calculation (Refactor: read position and scale from buffer)
  material.positionNode = Fn(() => {
    // Read VAT vertex offset
    const vatOffset = texture(posTex, sampleUV).rgb;

    const seed = data.get("seed");
    const scale = mix(2.0, 0.5, seed);
    
    // Apply instance scale
    const scaledOffset = vatOffset.mul(scale);
    
    // Apply world position
    // Move vertex from local space to world coordinates specified in buffer
    return positionLocal.add(scaledOffset).add(data.get("position"));
  })();



  // Color processing (simplified)
  material.colorNode = Fn(() => {
    const uvCord = vec2(uv().x.sub(0.5).mul(0.8).add(0.5), uv().y);
    const vColor = vertexColor(0).r;
    
    // Simple mask logic
    const isPetal = step(abs(vColor.sub(0.7)), 0.05);
    const isStem = step(abs(vColor.sub(0.0)), 0.05);
    const isLeaf = step(abs(vColor.sub(1.0)), 0.05);

    const petalColor = texture(colorTex, uvCord).rgb;
    const stemColor = uniforms.uGreen;

    // Mix colors
    const finalColor = petalColor.mul(isPetal)
        .add(stemColor.mul(isStem))
        .add(stemColor.mul(isLeaf));

    return vec4(finalColor, 1.0);
  })();

  const calculateVatNormal = Fn(() => {
    const texel = texture(nrmTex, sampleUV);

    if (meta.compressNormal) {
      // Oct-encoded normals: decode from xy channels
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
      const finalV = vec3(finalX, finalY, v.z);

      return transformNormalToView(normalize(finalV));
    }

    // Uncompressed normals: multiply by 2 and subtract 1
    const normal = texel.rgb.mul(vec3(2.0)).sub(vec3(1.0));
    return transformNormalToView(normalize(normal));
  });

  // Force VAT normal sampling in vertex stage, then interpolate
  material.normalNode = varying(calculateVatNormal());

  return material;
}
