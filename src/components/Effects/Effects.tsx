import { useRef, useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { clamp, float, length, mix, pass, pow, smoothstep, uniform, uv, vec4 } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";

import { useGameStore, CameraMode } from "../../core/store/gameStore";
import { useEffectsControls } from "./useEffectsControls";

export default function Effects() {
  const { isHighQuality, cameraMode, bloom: bloomCfg, dof: dofCfg, toneMapping: tmCfg, smaa: smaaEnabled } = useEffectsControls();

  const characterRef = useGameStore((state) => state.characterRef);
  const { gl, scene, camera } = useThree();

  const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
  const beamCamera = useMemo(() => new THREE.PerspectiveCamera(), []);

  const uParams = useRef({
    focusDist: uniform(0),
    focalLen: uniform(0),
    bokeh: uniform(0),
    helmetStr: uniform(0),
    bloomThresh: uniform(0),
    bloomStr: uniform(0),
    bloomRad: uniform(0),
  });

  const vecCache = useMemo(() => ({ cam: new THREE.Vector3(), char: new THREE.Vector3() }), []);

  useEffect(() => {
    uParams.current.bloomThresh.value = bloomCfg.threshold;
    uParams.current.bloomStr.value = bloomCfg.strength;
    uParams.current.bloomRad.value = bloomCfg.radius;

    if (!dofCfg.autofocus) {
      uParams.current.focusDist.value = dofCfg.focusDistance;
    }
    uParams.current.focalLen.value = dofCfg.focalLength;
    uParams.current.bokeh.value = dofCfg.bokehScale;

    uParams.current.helmetStr.value = cameraMode === CameraMode.FPV ? 1 : 0;

    if (gl) {
      const renderer = gl as unknown as WebGPURenderer;
      renderer.toneMappingExposure = Math.pow(tmCfg.exposure, 4.0);
    }
  }, [bloomCfg.threshold, bloomCfg.strength, bloomCfg.radius, dofCfg, cameraMode, tmCfg.exposure, gl]);

  useEffect(() => {
    if (!gl || !scene || !camera || !(gl instanceof WebGPURenderer)) return;

    const renderer = gl as WebGPURenderer;
    const pp = new THREE.PostProcessing(renderer);
    postProcessingRef.current = pp;

    beamCamera.copy(camera);

    const scenePass = pass(scene, camera);
    const sceneTex = scenePass.getTextureNode('output');
    const sceneDepth = scenePass.getViewZNode();

    const beamPass = pass(scene, beamCamera);
    const beamColor = beamPass.getTextureNode('output');
    const beamDepth = beamPass.getViewZNode();

    const uvNode = uv();
    const toCenter = uvNode.sub(0.5);
    const dist = length(toCenter);

    const distortStr = float(0.2).mul(uParams.current.helmetStr);
    const distortOffset = toCenter.normalize().mul(pow(dist, 3.0)).mul(distortStr);
    const distortedUV = uvNode.sub(distortOffset);

    const aberStr = float(0.01).mul(uParams.current.helmetStr);
    const aberOffset = toCenter.normalize().mul(dist).mul(aberStr);

    const r = sceneTex.sample(distortedUV.sub(aberOffset)).r;
    const g = sceneTex.sample(distortedUV).g;
    const b = sceneTex.sample(distortedUV.add(aberOffset)).b;

    const baseColor = vec4(r, g, b, 1.0);

    let finalNode: any = baseColor;

    if (isHighQuality && dofCfg.enabled) {
      finalNode = dof(
        finalNode,
        sceneDepth,
        uParams.current.focusDist,
        uParams.current.focalLen,
        uParams.current.bokeh
      );
    }

    const depthDiff = beamDepth.sub(sceneDepth);
    const beamOcclusion = smoothstep(float(0), float(10), depthDiff);
    finalNode = finalNode.add(beamColor.mul(beamOcclusion));

    const vignette = smoothstep(0.2, 0.8, dist);
    const mask = clamp(float(1.0).sub(vignette), 0.0, 1.0);
    const helmetOverlay = finalNode.mul(vec4(mask, mask, mask, 1.0)).mul(vec4(0.6, 0.65, 0.7, 1.0));
    finalNode = mix(finalNode, helmetOverlay, uParams.current.helmetStr);

    if (isHighQuality && bloomCfg.enabled) {
      const bloomNode = bloom(finalNode);
      bloomNode.threshold = uParams.current.bloomThresh;
      bloomNode.strength = uParams.current.bloomStr;
      bloomNode.radius = uParams.current.bloomRad;
      finalNode = finalNode.add(bloomNode);
    }

    if (isHighQuality && smaaEnabled) {
      finalNode = smaa(finalNode);
    }

    pp.outputNode = finalNode;

    renderer.toneMapping = tmCfg.enabled ? THREE.ReinhardToneMapping : THREE.NoToneMapping;

    return () => {
      postProcessingRef.current = null;
      camera.layers.enableAll();
    };
  }, [
    gl,
    scene,
    camera,
    isHighQuality,
    dofCfg.enabled,
    bloomCfg.enabled,
    smaaEnabled,
    tmCfg.enabled,
  ]);

  useFrame(() => {
    if (!postProcessingRef.current) return;

    if (isHighQuality && dofCfg.enabled && dofCfg.autofocus && characterRef?.current) {
      camera.getWorldPosition(vecCache.cam);
      characterRef.current.getWorldPosition(vecCache.char);
      uParams.current.focusDist.value = vecCache.cam.distanceTo(vecCache.char);
    }

    beamCamera.copy(camera);

    camera.layers.disableAll();
    camera.layers.enable(0);

    beamCamera.layers.disableAll();
    beamCamera.layers.enable(1);

    postProcessingRef.current.render();

    camera.layers.enableAll();
  }, 1);

  return null;
}
