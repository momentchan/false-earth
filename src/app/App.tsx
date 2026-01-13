import { CameraControls, Environment } from "@react-three/drei";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import { useState, useRef } from "react";
import { Terrain } from "../components/terrain/Terrain";
import { DirectionalLight } from "../components/DirectionalLight";
import * as THREE from 'three/webgpu'
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/grass/GrassWebGPU";
import { NormalSphere } from "../components/NormalSphere";
import { KeyboardCameraControls } from "../components/interaction";
import { Background } from "../components/Background";


export default function App() {
    const [terrainUniforms, setTerrainUniforms] = useState<{ uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any } | undefined>(undefined)
    const [lightPosition, setLightPosition] = useState<THREE.Vector3 | undefined>(undefined)

    return <>
        <LevaWrapper collapsed={true} />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 100,
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
            {/* <Perf /> */}

            <color attach="background" args={['#000000']} />
            {/* <AdaptiveDpr pixelated /> */}

            <CameraControls 
                // ref={cameraControlsRef}
                makeDefault 
                dollySpeed={0.5}
            />
            {/* <KeyboardCameraControls 
                // cameraControlsRef={cameraControlsRef}
                moveSpeed={2.0} 
                enableVerticalMovement={true} 
                verticalSpeed={3.0} 
            /> */}
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight onPositionChange={setLightPosition} />
            {/* <Background sunPosition={lightPosition} /> */}
            <Terrain onUniformsChange={setTerrainUniforms} />
            <GrassWebGPU terrainUniforms={terrainUniforms} />
            {/* <NormalSphere position={[0, 5, 0]} /> */}
        </Canvas>
    </>
}
