import { Environment, StatsGl, useGLTF } from "@react-three/drei";
import LevaWrapper from "../debug/LevaWrapper";
import { Canvas } from "@react-three/fiber";
import { useEffect, Suspense, useMemo, useState } from "react";
import { DirectionalLight } from "../components/DirectionalLight";
import { WebGPURenderer } from "three/webgpu";
import Effects from "../components/Effects/Effects";
import { useGameStore } from "../core/store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import { AudioManager } from "../components/audio/AudioManager";
import { DeviceDetector } from "../core/utils/DeviceDetector";
import { UI } from "../ui/UI";
import { useKeyboard } from "../core/input/useKeyboard";
import { preloadVATAssets } from "../components/Rose/core";
import { WorldController } from "../components/WorldController";
import { WebGpuPerf } from "../debug/WebGPUPerf";
import { Inspector } from 'three/addons/inspector/Inspector.js';
import { createContext } from "react";
import * as THREE from "three/webgpu";


useGLTF.preload('/models/Astronaut.glb');
useGLTF.preload('/models/Idle.glb');
useGLTF.preload('/models/Walking.glb');
useGLTF.preload('/models/Running.glb');
useGLTF.preload('/models/WalkingBack.glb');

preloadVATAssets('/vat/Rose_meta.json');
preloadVATAssets('/vat/RoseLowPoly_meta.json');


export const BeamSceneContext = createContext<THREE.Scene | null>(null);

export default function App() {
    const beamScene = useMemo(() => new THREE.Scene(), []);

    const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'c') {
                toggleCameraMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleCameraMode]);
    useKeyboard();

    return <>
        <LevaWrapper collapsed={true} initialHidden={true} />
        <DeviceDetector />
        <UI />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [20, 20, 30]
            }}
            gl={(canvas) => {
                const renderer = new WebGPURenderer({
                    ...canvas as any,
                    powerPreference: "high-performance",
                    antialias: true,
                    alpha: true,
                });
                renderer.setClearColor('#000000');
                renderer.autoClear = true;
                // renderer.inspector = new Inspector();

                return renderer.init().then(() => renderer);
            }}
            dpr={[1, 1.5]}
            performance={{ min: 0.5, max: 1 }}
        >
            <AudioManager />
            {/* <WebGpuPerf /> */}
            {/* <StatsGl /> */}

            <BeamSceneContext.Provider value={beamScene}>
                <WorldController />

                <Suspense fallback={null}>
                    <color attach="background" args={['#000000']} />
                    <CameraViewControl />
                    <Environment
                        files="/textures/potsdamer_platz_1k_nb.hdr"
                        environmentIntensity={0.5}
                    />
                    <DirectionalLight />
                    <Effects />
                </Suspense>
            </BeamSceneContext.Provider>
        </Canvas>
    </>
}
