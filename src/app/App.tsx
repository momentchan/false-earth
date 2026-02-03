import { Environment } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useEffect, Suspense } from "react";
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

preloadVATAssets('/vat/Rose_meta.json');


export default function App() {

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
            dpr={[1, 2]}
            performance={{ min: 0.5, max: 1 }}
        >
            <AudioManager />
            <WorldController />
            {/* <WebGpuPerf /> */}
            {/* <StatsGl /> */}

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
        </Canvas>
    </>
}
