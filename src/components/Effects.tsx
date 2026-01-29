import { useRef, useEffect, useMemo } from "react";
import { useControls } from "leva";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { float, pass, smoothstep, uniform } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { useGameStore, CameraMode } from "../core/store/gameStore";

export default function Effects() {
    const cameraMode = useGameStore((state) => state.cameraMode);
    const characterRef = useGameStore((state) => state.characterRef);
    const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
    const bloomPassRef = useRef<any>(null);
    const smaaPassRef = useRef<any>(null);
    const { gl, scene, camera } = useThree();

    const beamCamera = useMemo(() => new THREE.PerspectiveCamera(), []);

    // Temporary vectors for calculation to avoid GC
    const camPos = useMemo(() => new THREE.Vector3(), []);
    const characterPos = useMemo(() => new THREE.Vector3(), []);

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
        enabled: { value: true, label: 'Enable Depth of Field' },
        autofocus: { value: false, label: 'Auto Focus Character' },
        focusDistance: { value: 10, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.FPV.autofocus') },
        focalLength: { value: 50.0, min: 0.01, max: 100, step: 0.1 },
        bokehScale: { value: 3, min: 0.0, max: 10.0, step: 0.1 }
    }, { collapsed: true });

    // Get current DoF params based on camera mode
    const dofParams = useMemo(() => {
        switch (cameraMode) {
            case CameraMode.TPS:
                return dofParamsTPS;
            case CameraMode.FREE:
                return dofParamsFREE;
            case CameraMode.FPV:
                return dofParamsFPV;
            default:
                return dofParamsTPS;
        }
    }, [cameraMode, dofParamsTPS, dofParamsFREE, dofParamsFPV]);


    // Use uniforms for DoF parameters to avoid rebuilding PostProcessing
    // Initialize with current mode's values
    const uFocusDistance = useRef(uniform(dofParams.focusDistance));
    const uFocalLength = useRef(uniform(dofParams.focalLength));
    const uBokehScale = useRef(uniform(dofParams.bokehScale));
    const dofPassRef = useRef<any>(null);

    // Update uniform values from Leva (Only if NOT autofocusing)
    // This effect runs when DoF params change or camera mode changes
    useEffect(() => {
        if (!dofParams.autofocus) {
            uFocusDistance.current.value = dofParams.focusDistance;
        }
        uFocalLength.current.value = dofParams.focalLength;
        uBokehScale.current.value = dofParams.bokehScale;
    }, [dofParams.focusDistance, dofParams.focalLength, dofParams.bokehScale, dofParams.autofocus, dofParams.enabled]);

    useEffect(() => {
        // Ensure we are using a WebGPURenderer
        if (!gl || !scene || !camera || !(gl instanceof WebGPURenderer)) {
            return;
        }

        const renderer = gl as WebGPURenderer;

        // Initialize PostProcessing
        const postProcessing = new THREE.PostProcessing(renderer);
        postProcessingRef.current = postProcessing;

        // layer mask        
        camera.layers.enable(0);
        camera.layers.disable(1);

        beamCamera.layers.disableAll();
        beamCamera.layers.enable(1);

        beamCamera.copy(camera);

        // create render passes
        const scenePass = pass(scene, camera);
        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDepth = scenePass.getViewZNode();

        // beam pass
        const beamPass = pass(scene, beamCamera);
        const beamPassColor = beamPass.getTextureNode('output');
        const beamPassDepth = beamPass.getViewZNode();

        // tone mapping
        if (toneMappingParams.enabled) {
            renderer.toneMapping = THREE.ReinhardToneMapping;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        } else {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        // tsl node compositing chain

        let finalNode: any = scenePassColor;

        // apply dof (only to scene layer)
        if (dofParams.enabled) {
            const dofNode = dof(
                scenePassColor,
                scenePassDepth,
                uFocusDistance.current,
                uFocalLength.current,
                uBokehScale.current
            );
            dofPassRef.current = dofNode;
            finalNode = dofNode;
        }

        // add beams
        const depthDiff = beamPassDepth.sub(scenePassDepth);
        const occlusionFactor = smoothstep(float(0), float(10), depthDiff);
        const beamColor = beamPassColor.mul(occlusionFactor);

        finalNode = finalNode.add(beamColor);

        // apply bloom (to entire composition)
        if (bloomParams.enabled) {
            const bloomNode = bloom(finalNode);
            bloomPassRef.current = bloomNode;

            bloomNode.threshold.value = bloomParams.threshold;
            bloomNode.strength.value = bloomParams.strength;
            bloomNode.radius.value = bloomParams.radius;

            finalNode = finalNode.add(bloomNode);
        }

        // smaa (anti-aliasing)
        if (smaaParams.enabled) {
            const smaaNode = smaa(finalNode);
            smaaPassRef.current = smaaNode;
            finalNode = smaaNode;
        }

        // set output
        postProcessing.outputNode = finalNode;

        return () => {
            if (postProcessingRef.current) {
                postProcessingRef.current = null;
            }
            bloomPassRef.current = null;
            smaaPassRef.current = null;
            // Restore main camera settings on cleanup to avoid affecting other components
            camera.layers.enableAll();
        };
    }, [gl, scene, camera, smaaParams.enabled, bloomParams.enabled, dofParams.enabled, toneMappingParams.enabled, beamCamera]);

    // Update Bloom Uniforms efficiently
    useEffect(() => {
        if (bloomPassRef.current && bloomParams.enabled) {
            bloomPassRef.current.threshold.value = bloomParams.threshold;
            bloomPassRef.current.strength.value = bloomParams.strength;
            bloomPassRef.current.radius.value = bloomParams.radius;
        }
    }, [bloomParams.threshold, bloomParams.strength, bloomParams.radius, bloomParams.enabled]);

    // Update DoF parameters via DoF node properties (if they exist)
    // The uniforms are already updated in the first useEffect above
    // This ensures DoF node properties are also updated if the node exposes them
    useEffect(() => {
        if (dofPassRef.current && dofParams.enabled) {
            // Update DoF node properties directly if they exist
            // Only update focusDistance if NOT autofocusing
            if (dofPassRef.current.focusDistance && !dofParams.autofocus) {
                dofPassRef.current.focusDistance.value = dofParams.focusDistance;
            }
            if (dofPassRef.current.focalLength) {
                dofPassRef.current.focalLength.value = dofParams.focalLength;
            }
            if (dofPassRef.current.bokehScale) {
                dofPassRef.current.bokehScale.value = dofParams.bokehScale;
            }
        }
    }, [dofParams.focusDistance, dofParams.focalLength, dofParams.bokehScale, dofParams.enabled, dofParams.autofocus]);

    // Update Exposure efficiently
    useEffect(() => {
        if (gl && toneMappingParams.enabled) {
            const renderer = gl as unknown as WebGPURenderer;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        }
    }, [gl, toneMappingParams.exposure, toneMappingParams.enabled]);

    // Render Loop & Auto Focus Logic
    // Priority 1 ensures this runs AFTER R3F's default render/update cycle, 
    // effectively taking over the screen output.
    useFrame(() => {
        // --- AUTOFOCUS LOGIC ---
        if (dofParams.enabled && dofParams.autofocus && characterRef?.current) {
            // Get camera world position
            camera.getWorldPosition(camPos);

            // Get character world position from ref
            characterRef.current.getWorldPosition(characterPos);

            // Calculate distance from camera to character position
            const dist = camPos.distanceTo(characterPos);

            // Update the uniform directly
            uFocusDistance.current.value = dist;
        }

        // Sync cameras
        // Copy main camera parameters (position, rotation, FOV) to beam camera every frame
        // Ensures both layers are perfectly aligned
        beamCamera.copy(camera);

        // Force layer settings again (prevent other code from interfering)
        camera.layers.disable(1);
        beamCamera.layers.disableAll();
        beamCamera.layers.enable(1);

        if (postProcessingRef.current) {
            postProcessingRef.current.render();
        }
    }, 1);

    return null;
}