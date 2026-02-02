import { useMemo, useEffect } from "react";
import { folder, useControls } from "leva";
import { uniform, vec2, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";

export function useRoseUniforms() {
  const [config] = useControls("Rose", () => ({
    Render: folder(
      {
        green: { value: "#325825" },
        green2: { value: "#699555" },
        scaleMin: { value: 8, min: 0, max: 20 },
        scaleMax: { value: 20, min: 0, max: 20 },
        normalScale: { value: 5, min: 0, max: 5 },
        hueShift: { value: 0.5, min: 0, max: 1 },
        hueRandomness: { value: 0.1, min: 0, max: 0.5 },
        noiseScale: { value: { x: 1, y: 100 }, min: 0, max: 100 },
        emissiveColor: { value: "#ffffff" },
        emissiveIntensity: { value: 0.4, min: 0, max: 2 },
        fresnelPower: { value: 4.2, min: 0.5, max: 20 },
        fresnelIntensity: { value: 0.2, min: 0, max: 1 },
        metalness: { value: 0, min: 0, max: 1 },
        roughness: { value: 0.7, min: 0, max: 1 },
      },
      { collapsed: true }
    ),
    Lifecycle: folder(
      {
        delayMin: { value: 0, min: 0, max: 10 },
        delayMax: { value: 0, min: 0, max: 10 },
        growMin: { value: 2, min: 0, max: 10 },
        growMax: { value: 5, min: 0, max: 10 },
        keepMin: { value: 2, min: 0, max: 10 },
        keepMax: { value: 5, min: 0, max: 10 },
        dieMin: { value: 2, min: 0, max: 10 },
        dieMax: { value: 5, min: 0, max: 10 },
      },
      { collapsed: true }
    ),
  }), { collapsed: true });

  const uniforms = useMemo(
    () => ({
      mat: {
        uGreen: uniform(vec3(0)),
        uGreen2: uniform(vec3(0)),
        uScaleMin: uniform(0),
        uScaleMax: uniform(0),
        uNormalScale: uniform(0),
        uHueShift: uniform(0),
        uHueRandomness: uniform(0),
        uNoiseScale: uniform(vec2(0)),
        uEmissiveColor: uniform(vec3(0)),
        uEmissiveIntensity: uniform(0),
        uFresnelPower: uniform(0),
        uFresnelIntensity: uniform(0),
        uCharacterWorldPos: uniform(new THREE.Vector3()),
      },
      compute: {
        uDelayMin: uniform(0),
        uDelayMax: uniform(0),
        uGrowMin: uniform(0),
        uGrowMax: uniform(0),
        uKeepMin: uniform(0),
        uKeepMax: uniform(0),
        uDieMin: uniform(0),
        uDieMax: uniform(0),
        uViewProjectionMatrix: uniform(new THREE.Matrix4()),
        uCameraPosition: uniform(new THREE.Vector3()),
        uDeltaTime: uniform(0),
        uCharacterWorldPos: uniform(new THREE.Vector3()),
      },
    }),
    []
  );

  useEffect(() => {
    const c1 = new THREE.Color(config.green);
    const c2 = new THREE.Color(config.green2);
    const ce = new THREE.Color(config.emissiveColor);

    uniforms.mat.uGreen.value.set(c1.r, c1.g, c1.b);
    uniforms.mat.uGreen2.value.set(c2.r, c2.g, c2.b);
    uniforms.mat.uScaleMin.value = config.scaleMin;
    uniforms.mat.uScaleMax.value = config.scaleMax;
    uniforms.mat.uNormalScale.value = config.normalScale;
    uniforms.mat.uHueShift.value = config.hueShift;
    uniforms.mat.uHueRandomness.value = config.hueRandomness;
    uniforms.mat.uNoiseScale.value.set(config.noiseScale.x, config.noiseScale.y);
    uniforms.mat.uEmissiveColor.value.set(ce.r, ce.g, ce.b);
    uniforms.mat.uEmissiveIntensity.value = config.emissiveIntensity;
    uniforms.mat.uFresnelPower.value = config.fresnelPower;
    uniforms.mat.uFresnelIntensity.value = config.fresnelIntensity;

    uniforms.compute.uDelayMin.value = config.delayMin;
    uniforms.compute.uDelayMax.value = config.delayMax;
    uniforms.compute.uGrowMin.value = config.growMin;
    uniforms.compute.uGrowMax.value = config.growMax;
    uniforms.compute.uKeepMin.value = config.keepMin;
    uniforms.compute.uKeepMax.value = config.keepMax;
    uniforms.compute.uDieMin.value = config.dieMin;
    uniforms.compute.uDieMax.value = config.dieMax;
  }, [config, uniforms]);

  return { uniforms, config };
}
