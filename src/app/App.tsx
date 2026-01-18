import { CameraControls, Environment } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { Terrain } from "../components/terrain/Terrain";
import { DirectionalLight } from "../components/DirectionalLight";
import * as THREE from 'three/webgpu'
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";
import { GrassCullingDebug } from "../components/debug/GrassCullingDebug";
import { DebugModeToggle } from "../components/debug/DebugModeToggle";
import Effects from "../components/Effects";
import { Character } from "../components/character";
import { TerrainUniforms } from "../components/terrain/types";
import { Background } from "../components/Background";

export default function App() {
    const [terrainUniforms, setTerrainUniforms] = useState<TerrainUniforms | undefined>(undefined)
    const [lightPosition, setLightPosition] = useState<THREE.Vector3 | undefined>(undefined)
    const [debugMode, setDebugMode] = useState(false) // Toggle for culling debug mode

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
                dollySpeed={0.5}
            />
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight onPositionChange={setLightPosition} />
            <Background />

            <Effects />
            

            {/* Toggle between normal mode and culling debug mode */}
            <DebugModeToggle onToggle={() => setDebugMode(prev => !prev)} />
            {debugMode ? (
                <GrassCullingDebug />
            ) : (
                <>
                    <Terrain onUniformsChange={setTerrainUniforms} />
                    <GrassWebGPU terrainUniforms={terrainUniforms} />
                    <Character position={[0, 0, 0]} scale={0.01} terrainUniforms={terrainUniforms} />
                </>
            )}
            
        </Canvas>
    </>
}
