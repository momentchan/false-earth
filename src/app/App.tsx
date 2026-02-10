import { Environment, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { LevaWrapper } from "@core";
import { Canvas, useLoader } from "@react-three/fiber";
import { useEffect, Suspense, useMemo, useState } from "react";
import { DirectionalLight } from "../components/DirectionalLight";
import { WebGPURenderer } from "three/webgpu";
import Effects from "../components/Effects/Effects";
import { useGameStore } from "../core/store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import { AudioManager } from "@core";
import { DeviceDetector } from "../core/utils/DeviceDetector";
import { UI } from "../ui/UI";
import { preloadVATAssets } from "../components/Rose/core";
import { WorldController } from "../components/WorldController";
import { createContext } from "react";
import * as THREE from "three/webgpu";
import { KeyboardMapper } from "@core";
import { input, keyBindings } from "../core/input/controls";
import { useShortcut } from "@core/hooks/useShortcut";
import { AudioLoader } from 'three';
import { KTX2Preloader } from "@core";
import { ROSE_TEXTURES } from "../components/Rose/core/config";
import { BODY_TEXTURE_PATHS, DETAIL_TEXTURE_PATHS, MODEL_PATHS } from '../components/character/config';


useLoader.preload(AudioLoader,
    ['/audio/fs_grass1.mp3',
        '/audio/fs_grass2.mp3',
        '/audio/fs_grass3.mp3',
        '/audio/fs_grass4.mp3',
        '/audio/fs_grass5.mp3']);

useLoader.preload(AudioLoader, ['/audio/wave01.mp3']);

useGLTF.preload(MODEL_PATHS);

preloadVATAssets('/vat/Rose_meta.json');
preloadVATAssets('/vat/RoseLowPoly_meta.json');

export const BeamSceneContext = createContext<THREE.Scene | null>(null);

export default function App() {
    const beamScene = useMemo(() => new THREE.Scene(), []);
    const [dpr, setDpr] = useState(1.5);

    const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);
    const setGpuError = useGameStore((state) => state.setGpuError);
    const setAudioListener = useGameStore((state) => state.setAudioListener);
    const gpuError = useGameStore((state) => state.gpuError);

    // Check WebGPU support on mount
    useEffect(() => {
        const checkWebGPU = async () => {
            if (!navigator.gpu) {
                setGpuError("WEBGPU NOT SUPPORTED");
                console.error("WebGPU is not supported in this browser");
                return;
            }
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    setGpuError("NO GPU ADAPTER FOUND");
                    console.error("No GPU adapter found");
                    return;
                }
                console.log('WebGPU initialized successfully');
                setGpuError(null); // Clear any previous errors
            } catch (e) {
                setGpuError("GPU INIT FAILED");
                console.error("WebGPU initialization failed:", e);
            }
        };
        checkWebGPU();
    }, [setGpuError]);

    useShortcut('c', () => {
        toggleCameraMode();
    });

    return <>
        <LevaWrapper collapsed={true} initialHidden={true} />
        <DeviceDetector />
        <UI />
        <KeyboardMapper input={input} keyMap={keyBindings} />


        {!gpuError && (
            <Canvas
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
                    renderer.sortObjects = false;

                    return renderer.init().then(() => renderer);
                }}
                dpr={dpr}
            >
                <Suspense fallback={null}>
                    <KTX2Preloader paths={ROSE_TEXTURES} />
                    <KTX2Preloader paths={BODY_TEXTURE_PATHS} />
                    <KTX2Preloader paths={DETAIL_TEXTURE_PATHS} />
                </Suspense>

                <AudioManager onListenerCreated={setAudioListener} />

                <PerformanceMonitor
                    bounds={() => [28, 32]}
                    onFallback={() => setDpr(1)}
                    onChange={({ factor }) => {
                        const targetDpr = 1 + 1 * factor;
                        setDpr(targetDpr);
                        // console.log("factor", factor, "target DPR", targetDpr);
                    }}
                />

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
        )}
    </>
}
