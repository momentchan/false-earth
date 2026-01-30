import { Environment, Loader, Preload, StatsGl, useProgress } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useRef, useEffect, Suspense } from "react";
import { Terrain } from "../components/terrain/Terrain";
import { Wind } from "../components/wind/Wind";
import { DirectionalLight } from "../components/DirectionalLight";
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";
import Effects from "../components/Effects";
import { Character } from "../components/character";
import { Background } from "../components/background/Background";
import { Stars } from "../components/background/Stars";
import { useGameStore } from "../core/store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import Rose, { RoseHandle } from "../components/Rose/Rose";
import { CosmicSystem } from "../components/cosmic/CosmicSystem";
import { AsyncCompile } from "../core/utils/AsyncCompile";
import { LoadingScreen } from "../components/LoadingScreen";
import AudioButton from "../components/audio/AudioButton";

export default function App() {
    const roseRef = useRef<RoseHandle>(null)
    const setRoseRef = useGameStore((state) => state.setRoseRef);

    // Register roseRef to global store
    useEffect(() => {
        setRoseRef(roseRef);
        return () => setRoseRef(null);
    }, [setRoseRef]);


    // Get toggle method from store
    const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);

    // Centralized Input Management (Keyboard)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'c') {
                toggleCameraMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleCameraMode]);

    return <>
        <LevaWrapper collapsed={true} initialHidden={true} />

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


                return renderer.init().then(() => renderer);
            }}
            dpr={[1, 2]}
            performance={{ min: 0.5, max: 1 }}
        >
            <Suspense fallback={null}>

                {/* <StatsGl /> */}

                <color attach="background" args={['#000000']} />

                <CameraViewControl />

                <Environment
                    files="/textures/potsdamer_platz_1k_nb.hdr"
                    environmentIntensity={0.5}
                />
                <DirectionalLight />

                <Background />
                <Stars />
                <CosmicSystem />

                <Terrain />
                <Wind />
                <AsyncCompile id="rose">
                    <Rose ref={roseRef} count={2000} />
                </AsyncCompile>

                <AsyncCompile id="grass">
                    <GrassWebGPU />
                </AsyncCompile>

                <AsyncCompile id="character">
                    <Character position={[0, 0, 0]} scale={1} />
                </AsyncCompile>

                <Effects />

            </Suspense>
        </Canvas>
        {/* <AudioUICanvas /> */}
        <AudioButton />
        <LoadingScreen />
    </>
}
