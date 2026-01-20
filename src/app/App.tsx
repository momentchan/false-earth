import { Environment } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useState, useRef, useEffect } from "react";
import { Terrain } from "../components/terrain/Terrain";
import { DirectionalLight } from "../components/DirectionalLight";
import * as THREE from 'three/webgpu';
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";
import { GrassCullingDebug } from "../components/debug/GrassCullingDebug";
import { DebugModeToggle } from "../components/debug/DebugModeToggle";
import Effects from "../components/Effects";
import { Character } from "../components/character";
import { TerrainUniforms } from "../components/types";
import { Background } from "../components/Background";
import { Stars } from "../components/Stars";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import { useGameStore } from "../store/gameStore";
import { Group } from "three";
import { CameraControls } from "@react-three/drei";
import Rose from "../components/Rose";

export default function App() {
    const [terrainUniforms, setTerrainUniforms] = useState<TerrainUniforms | undefined>(undefined)
    const [debugMode, setDebugMode] = useState(false) // Toggle for culling debug mode
    const [trailTexture, setTrailTexture] = useState<THREE.StorageTexture | null>(null)
    const characterRef = useRef<Group>(null)

    // Store character ref in global state
    const setCharacterRef = useGameStore((state) => state.setCharacterRef);

    useEffect(() => {
        setCharacterRef(characterRef);
        return () => setCharacterRef(null);
    }, [setCharacterRef]);

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
                });
                return renderer.init().then(() => renderer);
            }}
            dpr={[1, 2]}
            performance={{ min: 0.5, max: 1 }}
        >

            <color attach="background" args={['#000000']} />



            <CameraControls
                makeDefault
            />
            {/* <CameraViewControl /> */}
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight />
            <Background />

            {/* <Effects /> */}

            <Rose />
            {/* <Stars /> */}


            {/* Toggle between normal mode and culling debug mode */}
            <DebugModeToggle onToggle={() => setDebugMode(prev => !prev)} />
            {debugMode ? (
                <GrassCullingDebug />
            ) : (
                <>
                    {/* <Terrain onUniformsChange={setTerrainUniforms} /> */}
                    {/* <GrassWebGPU terrainUniforms={terrainUniforms} trailTexture={trailTexture} /> */}
                    {/* <Character ref={characterRef} position={[0, 0, 0]} scale={0.01} terrainUniforms={terrainUniforms} onTrailTextureChange={setTrailTexture} /> */}
                </>
            )}

        </Canvas>
    </>
}
