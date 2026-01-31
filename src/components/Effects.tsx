import { useRef, useEffect, useMemo } from "react";
import { useControls } from "leva";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { clamp, distance, float, length, mix, pass, pow, smoothstep, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { useGameStore, CameraMode } from "../core/store/gameStore";

export default function Effects() {
    // 1. Get Quality and Camera Mode from Store
    const cameraMode = useGameStore((state) => state.cameraMode);
    const quality = useGameStore((state) => state.quality); // 'high' | 'low'
    const characterRef = useGameStore((state) => state.characterRef);
    
    // Determine if we are in high quality mode
    const isHighQuality = quality === 'high';

    const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
    
    // Node References for updating uniforms without rebuilding
    const dofPassRef = useRef<any>(null);
    const bloomPassRef = useRef<any>(null);
    
    const { gl, scene, camera } = useThree();

    const beamCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
    const camPos = useMemo(() => new THREE.Vector3(), []);
    const characterPos = useMemo(() => new THREE.Vector3(), []);

    // --- LEVA CONTROLS ---
    // Even in Low quality, we keep controls availble in code, but they are ignored in the render chain
    const smaaParams = useControls('Effects.SMAA', {
        enabled: { value: false, label: 'Enable SMAA' }
    }, { collapsed: true });

    const bloomParams = useControls('Effects.Bloom', {
        enabled: { value: true, label: 'Enable Bloom' },
        threshold: { value: 0.35, min: 0, max: 1, step: 0.01 },
        strength: { value: 0.3, min: 0, max: 3, step: 0.01 },
        radius: { value: 0.5, min: 0, max: 1, step: 0.01 }
    }, { collapsed: true });

    const toneMappingParams = useControls('Effects.Tone Mapping', {
        enabled: { value: true, label: 'Enable Tone Mapping' },
        exposure: { value: 1.1, min: 0.1, max: 2, step: 0.01 }
    }, { collapsed: true });

    // DoF Params (Grouped by Camera Mode)
    const dofParamsTPS = useControls('Effects.DoF.TPS', {
        enabled: { value: true, label: 'Enable Depth of Field' },
        autofocus: { value: true, label: 'Auto Focus Character' },
        focusDistance: { value: 1.3, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.TPS.autofocus') },
        focalLength: { value: 25.0, min: 0.01, max: 100, step: 0.1 },
        bokehScale: { value: 5, min: 0.0, max: 10.0, step: 0.1 }
    }, { collapsed: true });

    const dofParamsFREE = useControls('Effects.DoF.FREE', {
        enabled: { value: true, label: 'Enable Depth of Field' },
        autofocus: { value: false, label: 'Auto Focus Character' },
        focusDistance: { value: 5, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.FREE.autofocus') },
        focalLength: { value: 10.0, min: 0.01, max: 100, step: 0.1 },
        bokehScale: { value: 5, min: 0.0, max: 10.0, step: 0.1 }
    }, { collapsed: true });

    const dofParamsFPV = useControls('Effects.DoF.FPV', {
        enabled: { value: false, label: 'Enable Depth of Field' },
        autofocus: { value: false, label: 'Auto Focus Character' },
        focusDistance: { value: 10, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.FPV.autofocus') },
        focalLength: { value: 50.0, min: 0.01, max: 100, step: 0.1 },
        bokehScale: { value: 3, min: 0.0, max: 10.0, step: 0.1 }
    }, { collapsed: true });

    // Computed DoF Params
    const dofParams = useMemo(() => {
        switch (cameraMode) {
            case CameraMode.TPV: return dofParamsTPS;
            case CameraMode.FREE: return dofParamsFREE;
            case CameraMode.FPV: return dofParamsFPV;
            default: return dofParamsTPS;
        }
    }, [cameraMode, dofParamsTPS, dofParamsFREE, dofParamsFPV]);

    // --- UNIFORMS ---
    const uFocusDistance = useRef(uniform(dofParams.focusDistance));
    const uFocalLength = useRef(uniform(dofParams.focalLength));
    const uBokehScale = useRef(uniform(dofParams.bokehScale));
    const uHelmetStrength = useRef(uniform(0));

    // Update Uniforms (Cheap, runs every render or param change)
    useEffect(() => {
        if (!dofParams.autofocus) {
            uFocusDistance.current.value = dofParams.focusDistance;
        }
        uFocalLength.current.value = dofParams.focalLength;
        uBokehScale.current.value = dofParams.bokehScale;
    }, [dofParams, isHighQuality]); // Depend on quality to ensure refresh

    // --- MAIN EFFECT COMPOSITION ---
    useEffect(() => {
        if (!gl || !scene || !camera || !(gl instanceof WebGPURenderer)) return;

        const renderer = gl as WebGPURenderer;
        const postProcessing = new THREE.PostProcessing(renderer);
        postProcessingRef.current = postProcessing;

        // 1. Layer Setup
        camera.layers.enable(0);
        camera.layers.disable(1);
        beamCamera.layers.disableAll();
        beamCamera.layers.enable(1);
        beamCamera.copy(camera);

        // 2. Base Scene Pass
        const scenePass = pass(scene, camera);
        const sceneTex = scenePass.getTextureNode('output');
        const scenePassDepth = scenePass.getViewZNode();

        // 3. Beam Pass (Always enabled, core mechanic)
        const beamPass = pass(scene, beamCamera);
        const beamPassColor = beamPass.getTextureNode('output');
        const beamPassDepth = beamPass.getViewZNode();

        // 4. Helmet Distortion / Aberration Logic (Always enabled, cheap math)
        const uvNode = uv();
        const toCenter = uvNode.sub(0.5);
        const dist = length(toCenter);
        const dir = toCenter.normalize();

        const distortStrength = float(0.2).mul(uHelmetStrength.current);
        const distortOffset = dir.mul(pow(dist, 3.0)).mul(distortStrength);
        const distortedUV = uvNode.sub(distortOffset);

        const aberStrength = float(0.01).mul(uHelmetStrength.current);
        const aberOffset = dir.mul(dist).mul(aberStrength);

        const rUV = distortedUV.sub(aberOffset);
        const gUV = distortedUV;
        const bUV = distortedUV.add(aberOffset);

        // Manual Chromatic Aberration Sampling
        const r = sceneTex.sample(rUV).r;
        const g = sceneTex.sample(gUV).g;
        const b = sceneTex.sample(bUV).b;
        
        const scenePassColor = vec4(r, g, b, 1.0);

        // 5. Tone Mapping (Global Renderer Setting)
        if (toneMappingParams.enabled) {
            renderer.toneMapping = THREE.ReinhardToneMapping;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        } else {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        // --- COMPOSITION CHAIN ---
        let finalNode: any = scenePassColor;

        // [Quality Check] Depth of Field
        // Only add DoF node if Quality is HIGH and Enabled
        if (isHighQuality && dofParams.enabled) {
            const dofNode = dof(
                scenePassColor,
                scenePassDepth,
                uFocusDistance.current,
                uFocalLength.current,
                uBokehScale.current
            );
            dofPassRef.current = dofNode;
            finalNode = dofNode; // Pass output to next stage
        } else {
            dofPassRef.current = null;
        }

        // [Core] Add Beams (Always on)
        const depthDiff = beamPassDepth.sub(scenePassDepth);
        const occlusionFactor = smoothstep(float(0), float(10), depthDiff);
        const beamColor = beamPassColor.mul(occlusionFactor);
        finalNode = finalNode.add(beamColor);

        // [Core] Helmet Overlay (Always on)
        const vignette = smoothstep(0.2, 0.8, dist);
        const mask = clamp(float(1.0).sub(vignette), 0.0, 1.0);
        const glassTint = vec4(0.6, 0.65, 0.7, 1.0);
        const helmetOverlay = finalNode.mul(vec4(mask, mask, mask, 1.0)).mul(glassTint);
        finalNode = mix(finalNode, helmetOverlay, uHelmetStrength.current);

        // [Quality Check] Bloom
        if (isHighQuality && bloomParams.enabled) {
            const bloomNode = bloom(finalNode);
            bloomPassRef.current = bloomNode;
            
            // Set initial values
            bloomNode.threshold.value = bloomParams.threshold;
            bloomNode.strength.value = bloomParams.strength;
            bloomNode.radius.value = bloomParams.radius;

            finalNode = finalNode.add(bloomNode);
        } else {
            bloomPassRef.current = null;
        }

        // [Quality Check] SMAA
        if (isHighQuality && smaaParams.enabled) {
            const smaaNode = smaa(finalNode);
            finalNode = smaaNode;
        }

        // Output
        postProcessing.outputNode = finalNode

        return () => {
            postProcessingRef.current = null;
            dofPassRef.current = null;
            bloomPassRef.current = null;
            // Reset layers
            camera.layers.enableAll(); 
        };

    }, [
        gl, scene, camera, beamCamera,
        isHighQuality, 
        dofParams.enabled, 
        bloomParams.enabled, 
        smaaParams.enabled, 
        toneMappingParams.enabled
    ]);
    
    // Update Bloom Params (Only if node exists)
    useEffect(() => {
        if (bloomPassRef.current) {
            bloomPassRef.current.threshold.value = bloomParams.threshold;
            bloomPassRef.current.strength.value = bloomParams.strength;
            bloomPassRef.current.radius.value = bloomParams.radius;
        }
    }, [bloomParams]);

    // Update Helmet Strength
    useEffect(() => {
        uHelmetStrength.current.value = cameraMode === CameraMode.FPV ? 1 : 0;
    }, [cameraMode]);

    // Update Exposure
    useEffect(() => {
        if (gl && toneMappingParams.enabled) {
            const renderer = gl as unknown as WebGPURenderer;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        }
    }, [gl, toneMappingParams]);

    // --- RENDER LOOP ---
    useFrame(() => {
        // AutoFocus Logic (Only run if DoF is active in High Quality)
        if (isHighQuality && dofParams.enabled && dofParams.autofocus && characterRef?.current) {
            camera.getWorldPosition(camPos);
            characterRef.current.getWorldPosition(characterPos);
            const dist = camPos.distanceTo(characterPos);
            uFocusDistance.current.value = dist;
        }

        // Sync Beam Camera
        beamCamera.copy(camera);
        
        // Isolate Layers for rendering
        camera.layers.disable(1);
        beamCamera.layers.disableAll();
        beamCamera.layers.enable(1);

        // Render Effect Chain
        if (postProcessingRef.current) {
            postProcessingRef.current.render();
        }
    }, 1);

    return null;
}