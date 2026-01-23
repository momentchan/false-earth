import { Environment, Html, useProgress, Loader } from "@react-three/drei";
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
import { useGameStore } from "../store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import Rose, { RoseHandle } from "../components/Rose/Rose";
import { CosmicSystem } from "../components/cosmic/CosmicSystem";

export default function App() {
    const roseRef = useRef<RoseHandle>(null)
    // const { active, progress, errors, item, loaded, total } = useProgress()


    // useEffect(() => {
    //     console.log('active', active);
    //     console.log('progress', progress);
    //     console.log('errors', errors);
    //     console.log('item', item);
    //     console.log('loaded', loaded);
    //     console.log('total', total);
    // }, [active, progress, errors, item, loaded, total]);


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
        <LevaWrapper collapsed={true} />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [0, 3, 10]
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

                {/* <color attach="background" args={['#000000']} /> */}

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
                {/* <Rose ref={roseRef} count={2000} /> */}
                {/* <RoseSpawner roseRef={roseRef} spawnCount={32} /> */}
                <GrassWebGPU />
                <Character position={[0, 0, 0]} scale={1} />

                <Effects />
            </Suspense>
        </Canvas>
        <Loader />
    </>
}
