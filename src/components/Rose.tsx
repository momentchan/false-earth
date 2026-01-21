import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { atomicAdd, atomicStore, storage, uint, uniform, vec3, instanceIndex, instancedArray, If, time, fract, float } from "three/tsl";
import { useVATPreloader } from "./vat/VATPreloader";
import { extractGeometryFromScene } from "./vat/utils";
import { setupVATGeometry } from "./vat/utils";
import { createVATMaterial } from "./vat/materials/vatNodeMaterial";
import { drawIndirectStructure } from "./grass/core/constants";
import { Fn } from "three/src/nodes/TSL.js";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGPURenderer } from 'three/webgpu'
import { vatStructure } from "./vat/constant";


export default function Rose({ count = 1000 }: { count: number }) {
    const gl = useThree((state) => state.gl)
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')


    const groupRef = useRef<THREE.Group>(null)
    const meshRef = useRef<THREE.Mesh>(null)
    const uniforms = useMemo(() => ({
        uFrame: uniform(0.5),
        uGreen: uniform(vec3(0.6, 0.9, 0.6)),
    }), [])

    const petalTex = useTexture('/textures/Rose/Rose_Petal_Diff.png')
    petalTex.colorSpace = THREE.SRGBColorSpace

    const outlineTex = useTexture('/textures/Rose/Rose_Outline.png')

    const [config] = useControls('Rose', () => ({
        Frame: folder({
            Frame: { value: 0.5, min: 0, max: 1, step: 0.01 },
        }),
        Render: folder({
            Green: { value: '#325825', min: 0, max: 1, step: 0.01 },
        }),
    }))

    const resetComputeRef = useRef<THREE.ComputeNode>(null)
    const computeRef = useRef<any>(null)

    const vatData = useMemo(() => {
        const vatData = new Float32Array(count * 3)
        vatData.fill(0)
        return instancedArray(vatData, vatStructure)
    }, [count])


    useEffect(() => {
        if (!groupRef.current || !scene || !meta || !isLoaded || !vatData) return

        const geometry = extractGeometryFromScene(scene as any)
        if (!geometry) {
            console.warn('VAT geometry not found in scene')
            return
        }

        const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count
        const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(indexCount), indexCount)
        const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
        geometry.setIndirect(drawBuffer)

        const resetCompute = createResetCompute(drawStorage, indexCount)
        resetComputeRef.current = resetCompute

        const visibleIndicesBuffer = createVisibleIndicesBuffer(count)

        const computeFn = createCompute(drawStorage, visibleIndicesBuffer, count, vatData)
        computeRef.current = computeFn

        setupVATGeometry(geometry as any, meta as any)

        // Create simple VAT node material
        const mat = createVATMaterial(
            posTex as THREE.Texture,
            nrmTex as THREE.Texture,
            vatData,
            visibleIndicesBuffer,
            meta as any,
            uniforms,
            petalTex,
            outlineTex,
        )
        const mesh = new THREE.Mesh(geometry, mat)
        mesh.count = count
        mesh.frustumCulled = false
        meshRef.current = mesh
        groupRef.current!.add(mesh)

        return () => {
            groupRef.current?.remove(mesh)
            geometry.dispose()
            mat.dispose()
        }
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData])

    // Update frame uniform when control changes
    useEffect(() => {
        const baseColor = new THREE.Color(config.Green);
        uniforms.uFrame.value = config.Frame
        uniforms.uGreen.value = new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b)
    }, [config, uniforms])

    useFrame(() => {
        const renderer = gl as unknown as WebGPURenderer
        if (!resetComputeRef.current) return

        renderer.compute(resetComputeRef.current)
        renderer.compute(computeRef.current)
    })


    return (
        <group ref={groupRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} scale={10}>
                <planeGeometry />
                <meshBasicMaterial color="white" />
            </mesh>
        </group>
    );
}


export function createCompute(
    drawStorage: ReturnType<typeof storage>,
    indices: ReturnType<typeof instancedArray>,
    count: number,
    vatData: ReturnType<typeof instancedArray>,
) {
    const computeFn = Fn(() => {
        const data = vatData.element(instanceIndex);
        data.get("frame").assign(fract(time));

        If(instanceIndex.lessThan(10), () => {
            const idx = atomicAdd(
                drawStorage.get("instanceCount"),
                uint(1)
            );
            indices.element(idx).assign(uint(instanceIndex));
        })
    });
    return computeFn().compute(count)
}


export function createResetCompute(drawStorage: ReturnType<typeof storage>, indexCount: number) {
    const resetFn = Fn(() => {
        // Reset all LOD buffers
        drawStorage.get("vertexCount").assign(uint(indexCount));
        atomicStore(drawStorage.get("instanceCount"), uint(0));
        drawStorage.get("firstVertex").assign(uint(0));
        drawStorage.get("firstInstance").assign(uint(0));
        drawStorage.get("offset").assign(uint(0));
    });

    return resetFn().compute(1);
}

export function createVisibleIndicesBuffer(count: number) {
    // Use Uint32Array for indices (max 4 billion blades)
    const visibleIndicesArray = new Uint32Array(count)
    visibleIndicesArray.fill(0)
    return instancedArray(visibleIndicesArray, 'uint')
}
