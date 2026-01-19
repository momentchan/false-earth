import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';
import {
  Fn,
  uniform,
  vec2,
  vec4,
  float,
  instanceIndex,
  uvec2,
  textureStore,
  textureLoad,
  smoothstep,
  clamp,
  length,
  step,
} from 'three/tsl';
import { DEFAULT_GRASS_AREA_SIZE } from '../../grass/core/constants';

const TRAIL_TEXTURE_SIZE = 512;

export function useCharacterTrail(
  uWorldPos: any,
  uVelocity?: any
) {
  const { gl } = useThree();
  const renderer = gl as unknown as WebGPURenderer;

  // Leva controls for trail parameters (real-time adjustable)
  const controls = useControls('Character.Trail', {
    fadeSpeed: { value: 0.9, min: 0.8, max: 1.0, step: 0.001, label: 'Fade Speed' },
    trailRadius: { value: 0.01, min: 0.001, max: 0.05, step: 0.001, label: 'Trail Radius' },
  }, { collapsed: true });
  // Ping-pong phase state
  const phaseRef = useRef(true);
  const currentTextureRef = useRef<THREE.StorageTexture | null>(null);

  // Create storage textures for ping-pong
  const { pingTexture, pongTexture, uFadeSpeed, uTrailRadius } = useMemo(() => {
    // Create storage textures
    const ping = new THREE.StorageTexture(TRAIL_TEXTURE_SIZE, TRAIL_TEXTURE_SIZE);
    ping.type = THREE.FloatType;
    ping.format = THREE.RGBAFormat;

    const pong = new THREE.StorageTexture(TRAIL_TEXTURE_SIZE, TRAIL_TEXTURE_SIZE);
    pong.type = THREE.FloatType;
    pong.format = THREE.RGBAFormat;

    // TSL uniforms
    const fade = uniform(controls.fadeSpeed);
    const radius = uniform(controls.trailRadius);

    return {
      pingTexture: ping,
      pongTexture: pong,
      uFadeSpeed: fade,
      uTrailRadius: radius,
    };
  }, []);

  // Create compute shader function
  const { computeToPong, computeToPing } = useMemo(() => {
    const createTrailCompute = (
      readTex: THREE.StorageTexture,
      writeTex: THREE.StorageTexture
    ) => {
      return Fn(() => {
        const posX = instanceIndex.mod(TRAIL_TEXTURE_SIZE);
        const posY = instanceIndex.div(TRAIL_TEXTURE_SIZE);
        const indexUV = uvec2(posX, posY);

        const prevColor = textureLoad(readTex, indexUV);
        let nextColor = prevColor.rgb.mul(uFadeSpeed);

        const currentUV = vec2(
          float(posX).div(float(TRAIL_TEXTURE_SIZE)),
          float(posY).div(float(TRAIL_TEXTURE_SIZE))
        );

        const characterUV = vec2(
          uWorldPos.x.div( float(DEFAULT_GRASS_AREA_SIZE)).add(float(0.5)),
          float(1.0).sub(uWorldPos.z.div(float(DEFAULT_GRASS_AREA_SIZE)).add(float(0.5)))
        );
        const dist = currentUV.distance(characterUV);

        // Calculate speed from velocity (magnitude of velocity vector)
        const speed = uVelocity ? length(uVelocity) : float(0.0);
        
        const isMoving = step(float(0.0001), speed); // Returns 1.0 when speed > 0.0001, 0.0 otherwise
        const draw = float(1.0).sub(smoothstep(float(0.0), uTrailRadius, dist)).mul(isMoving);
        nextColor = nextColor.add(draw);

        const r = clamp(nextColor.x, float(0.0), float(1.0));
        const g = clamp(nextColor.y, float(0.0), float(1.0));
        const b = clamp(nextColor.z, float(0.0), float(1.0));

        textureStore(writeTex, indexUV, vec4(r, g, b, float(1.0)));
      });
    };

    const computeToPongFn = createTrailCompute(pingTexture, pongTexture);
    const computeToPingFn = createTrailCompute(pongTexture, pingTexture);

    return {
      computeToPong: computeToPongFn().compute(TRAIL_TEXTURE_SIZE * TRAIL_TEXTURE_SIZE),
      computeToPing: computeToPingFn().compute(TRAIL_TEXTURE_SIZE * TRAIL_TEXTURE_SIZE),
    };
  }, [pingTexture, pongTexture, uWorldPos, uVelocity, uFadeSpeed, uTrailRadius, TRAIL_TEXTURE_SIZE]);

  // Update uniforms only when values change
  useEffect(() => {
    uFadeSpeed.value = controls.fadeSpeed;
    uTrailRadius.value = controls.trailRadius;
  }, [controls]);

  // Update trail each frame
  useFrame(() => {
    if (!renderer || !uWorldPos?.value) return;

    if (phaseRef.current) {
      renderer.compute(computeToPong);
      currentTextureRef.current = pongTexture;
    } else {
      renderer.compute(computeToPing);
      currentTextureRef.current = pingTexture;
    }

    phaseRef.current = !phaseRef.current;
  });

  if (!currentTextureRef.current) {
    currentTextureRef.current = pongTexture;
  }

  return {
    trailTexture: currentTextureRef.current,
    pingTexture,
    pongTexture,
  };
}
