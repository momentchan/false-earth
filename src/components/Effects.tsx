import { useRef, useEffect } from "react";
import { useControls } from "leva";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { pass, uniform } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
// @ts-ignore - DoFNode may not have TypeScript definitions yet
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
// @ts-ignore - SMAANode may not have TypeScript definitions yet
import { smaa } from "three/addons/tsl/display/SMAANode.js";

export default function Effects() {
    const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
    const bloomPassRef = useRef<any>(null);
    const smaaPassRef = useRef<any>(null);
    const { gl, scene, camera } = useThree();

    const [effectsParams] = useControls('Effects', () => ({
        enabled: { value: true }
    }));

    const smaaParams = useControls('Effects.SMAA', {
        enabled: { value: false, label: 'Enable SMAA' }
    }, { collapsed: true });

    const bloomParams = useControls('Effects.Bloom', {
        enabled: { value: true, label: 'Enable Bloom' },
        threshold: { value: 0.1, min: 0, max: 0.5, step: 0.01 },
        strength: { value: 0.3, min: 0, max: 3, step: 0.01 },
        radius: { value: 0.5, min: 0, max: 1, step: 0.01 }
    }, { collapsed: true });

    const dofParams = useControls('Effects.DoF', {
        enabled: { value: true, label: 'Enable Depth of Field' },
        focusDistance: { value: 3, min: 0, max: 100, step: 0.1 },
        focalLength: { value: 10.0, min: 0.01, max: 100, step: 0.1 },
        bokehScale: { value: 5, min: 0.0, max: 10.0, step: 0.1 }
    }, { collapsed: true });

    const toneMappingParams = useControls('Effects.Tone Mapping', {
        enabled: { value: true, label: 'Enable Tone Mapping' },
        exposure: { value: 1.1, min: 0.1, max: 2, step: 0.01 }
    }, { collapsed: true });

    // Use uniforms for DoF parameters to avoid rebuilding PostProcessing
    const uFocusDistance = useRef(uniform(dofParams.focusDistance));
    const uFocalLength = useRef(uniform(dofParams.focalLength));
    const uBokehScale = useRef(uniform(dofParams.bokehScale));
    const dofPassRef = useRef<any>(null);

    // Update uniform values
    useEffect(() => {
        uFocusDistance.current.value = dofParams.focusDistance;
        uFocalLength.current.value = dofParams.focalLength;
        uBokehScale.current.value = dofParams.bokehScale;
    }, [dofParams.focusDistance, dofParams.focalLength, dofParams.bokehScale]);

    useEffect(() => {
        // Ensure we are using a WebGPURenderer
        if (!gl || !scene || !camera || !effectsParams.enabled || !(gl instanceof WebGPURenderer)) {
            return;
        }

        const renderer = gl as WebGPURenderer;
        
        // Initialize PostProcessing
        const postProcessing = new THREE.PostProcessing(renderer);
        postProcessingRef.current = postProcessing;

        // Create scene pass (color and depth)
        const scenePass = pass(scene, camera);
        const scenePassColor = scenePass.getTextureNode('output');
        const scenePassDepth = scenePass.getViewZNode();

        // Configure Tone Mapping on the renderer
        if (toneMappingParams.enabled) {
            renderer.toneMapping = THREE.ReinhardToneMapping;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        } else {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        // Build effect chain: Scene -> DoF -> Bloom
        let finalNode: any = scenePassColor;

        // --- DoF Effect ---
        if (dofParams.enabled) {
            // Use dof node
            // Parameters: (ColorNode, DepthNode, FocusDistance, FocalLength, BokehScale)
            const dofNode = dof(
                scenePassColor,
                scenePassDepth,
                uFocusDistance.current,
                uFocalLength.current,
                uBokehScale.current
            );
            dofPassRef.current = dofNode;
            
            // In newer TSL versions, dofNode output is already composited
            finalNode = dofNode;
        }

        // --- Bloom Effect ---
        if (bloomParams.enabled) {
            // Pass DoF result into Bloom, so bokeh highlights will also glow
            const bloomNode = bloom(finalNode);
            bloomPassRef.current = bloomNode;
            
            // Set parameters
            bloomNode.threshold.value = bloomParams.threshold;
            bloomNode.strength.value = bloomParams.strength;
            bloomNode.radius.value = bloomParams.radius;

            // Blend Bloom
            // @ts-ignore - add operation returns compatible node type
            finalNode = finalNode.add(bloomNode);
        }

        // --- SMAA Effect (applied at the end) ---
        if (smaaParams.enabled) {
            const smaaNode = smaa(finalNode);
            smaaPassRef.current = smaaNode;
            finalNode = smaaNode;
        }

        // Set output
        // @ts-ignore - finalNode is compatible with outputNode type
        postProcessing.outputNode = finalNode;

        return () => {
            if (postProcessingRef.current) {
                postProcessingRef.current = null;
            }
            bloomPassRef.current = null;
            smaaPassRef.current = null;
        };
    }, [gl, scene, camera, effectsParams.enabled, smaaParams.enabled, bloomParams.enabled, dofParams.enabled, toneMappingParams.enabled]);

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
            if (dofPassRef.current.focusDistance) {
                dofPassRef.current.focusDistance.value = dofParams.focusDistance;
            }
            if (dofPassRef.current.focalLength) {
                dofPassRef.current.focalLength.value = dofParams.focalLength;
            }
            if (dofPassRef.current.bokehScale) {
                dofPassRef.current.bokehScale.value = dofParams.bokehScale;
            }
        }
    }, [dofParams.focusDistance, dofParams.focalLength, dofParams.bokehScale, dofParams.enabled]);

    // Update Exposure efficiently
    useEffect(() => {
        if (gl && toneMappingParams.enabled) {
            const renderer = gl as unknown as WebGPURenderer;
            renderer.toneMappingExposure = Math.pow(toneMappingParams.exposure, 4.0);
        }
    }, [gl, toneMappingParams.exposure, toneMappingParams.enabled]);

    // Render Loop
    // Priority 1 ensures this runs AFTER R3F's default render/update cycle, 
    // effectively taking over the screen output.
    useFrame(() => {
        if (postProcessingRef.current && effectsParams.enabled) {
            postProcessingRef.current.render();
        }
    }, 1);

    return null;
}