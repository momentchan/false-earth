import { AdaptiveDpr, CameraControls, Environment } from "@react-three/drei";
import { CanvasCapture } from "@packages/r3f-gist/components/utility";
import { LevaWrapper } from "@packages/r3f-gist/components";
import { Canvas } from "@react-three/fiber";
import Grass from "../components/Grass";
import { useState } from "react";
import Effects from "../components/Effects";
import { Terrain } from "../components/Terrain";
import { DirectionalLight } from "../components/DirectionalLight";
import { Background } from "../components/background/Background";
import * as THREE from 'three'
import { Perf } from "r3f-perf";
import { WebGPURenderer } from "three/webgpu";
import GrassWebGPU from "../components/GrassWebGPU";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { vec3, vec4, Fn, normalView, float, positionLocal, normalLocal, cameraProjectionMatrix, cameraViewMatrix, modelWorldMatrix, modelNormalMatrix, mx_rotate2d, vec2, transformNormalToView, normalize, mat3, faceDirection } from "three/tsl";

import { extend } from "@react-three/fiber";
extend({ MeshBasicNodeMaterial })

export default function App() {
    const [terrainParams, setTerrainParams] = useState<{ amplitude: number; frequency: number; seed: number; color: string } | undefined>(undefined)
    const [lightPosition, setLightPosition] = useState<THREE.Vector3 | undefined>(undefined)
    const [patchSize, setPatchSize] = useState<number | undefined>(undefined)

    return <>
        <LevaWrapper collapsed={true} />

        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 50,
                position: [0, 3, 10]
            }}
            gl={(canvas) => {
                const renderer = new WebGPURenderer({
                    ...canvas as any,
                    powerPreference: "high-performance",
                    antialias: true,
                    alpha: false,
                    stencil: false,
                });
                return renderer.init().then(() => renderer);
            }}
            dpr={[1, 2]}
            performance={{ min: 0.5, max: 1 }}
        >
            {/* <Perf /> */}

            <color attach="background" args={['#000000']} />
            {/* <AdaptiveDpr pixelated /> */}

            <CameraControls makeDefault maxDistance={20} minDistance={5} maxPolarAngle={Math.PI / 2.2} minPolarAngle={Math.PI / 4} dollySpeed={0.5} />
            <Environment preset="city" environmentIntensity={0.5} />
            <DirectionalLight onPositionChange={setLightPosition} />
            {/* <Background sunPosition={lightPosition} /> */}
            {/* <Terrain onParamsChange={setTerrainParams} patchSize={patchSize} /> */}
            <GrassWebGPU />
            {/* <Grass terrainParams={terrainParams} patchSize={patchSize} onPatchSizeChange={setPatchSize} /> */}
            <CanvasCapture />

            <mesh position={[0, 2, 0]}>
                <planeGeometry args={[1, 1]} />
                <primitive
                    object={(() => {
                        const material = new MeshStandardNodeMaterial();
                        material.side = THREE.DoubleSide;
                        material.fragmentNode = Fn(() => {
                            const normalColor = normalView.mul(0.5).add(0.5);
                            return vec4(normalColor, float(1.0));
                        })();
                        return material;
                    })()}
                />
            </mesh>

            <mesh position={[2, 2, 0]}>
                <planeGeometry args={[1, 1]} />
                <primitive
                    object={(() => {
                        const material = new MeshStandardNodeMaterial();
                        material.side = THREE.DoubleSide;

                        material.vertexNode = Fn(({ material }: { material: THREE.Material }) => {
                            // 1. 定義旋轉角度 (90度) - mx_rotate2d 使用度數，不是弧度
                            const angle = float(180);

                            // 2. 旋轉位置 (Position)
                            const pos = positionLocal;
                            const posXZ = mx_rotate2d(vec2(pos.x, pos.z), angle);
                            const rotatedPos = vec3(posXZ.x, pos.y, posXZ.y);

                            // 3. 旋轉法線 (Normal) - 必須與位置使用相同的旋轉
                            const norm = normalLocal;
                            const normXZ = mx_rotate2d(vec2(norm.x, norm.z), angle);
                            const rotatedNormLocal = vec3(normXZ.x, norm.y, normXZ.y);

                            const normalWorldVec4 = modelNormalMatrix.mul(vec4(rotatedNormLocal.x, rotatedNormLocal.y, rotatedNormLocal.z, float(0.0)));
                            const rotatedNormWorld = normalize(normalWorldVec4.xyz);

                            // (material as any).normalNode = transformNormalToView(rotatedNormWorld).toVarying();

                            // 6. 計算最終位置
                            const worldPos = modelWorldMatrix.mul(vec4(rotatedPos.x, rotatedPos.y, rotatedPos.z, float(1.0)));

                            return cameraProjectionMatrix.mul(cameraViewMatrix).mul(worldPos);
                        })();

                        material.normalNode = Fn(() => {
                            const angle = float(180);
                          
                            const n = normalLocal;
                            const nXZ = mx_rotate2d(vec2(n.x, n.z), angle);
                            return transformNormalToView(vec3(nXZ.x, n.y, nXZ.y)).toVarying().mul(faceDirection); // local space only
                          })();

                        material.fragmentNode = Fn(() => {
                            const normalColor = normalView.mul(0.5).add(0.5);
                            return vec4(normalColor, float(1.0));
                        })();
                        return material;
                    })()}
                />
            </mesh>
            {/* <mesh>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color="red" />
            </mesh> */}
            {/* <Effects /> */}
        </Canvas>
    </>
}
