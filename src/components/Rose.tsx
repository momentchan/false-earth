import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { uniform, vec3 } from "three/tsl";
import { useVATPreloader } from "./vat/VATPreloader";
import { extractGeometryFromScene } from "./vat/utils";
import { setupVATGeometry } from "./vat/utils";
import { createVATMaterial } from "./vat/materials/vatNodeMaterial";

export default function Rose() {
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

    useEffect(() => {
        if (!groupRef.current || !scene || !meta || !isLoaded) return

        const geometry = extractGeometryFromScene(scene as any)
        if (!geometry) {
            console.warn('VAT geometry not found in scene')
            return
        }

        setupVATGeometry(geometry as any, meta as any)

        // Create simple VAT node material
        const mat = createVATMaterial(
            posTex as THREE.Texture,
            nrmTex as THREE.Texture | null,
            meta as any,
            uniforms,
            petalTex,
            outlineTex
        )
        const mesh = new THREE.Mesh(geometry as any, mat)
        mesh.frustumCulled = false
        meshRef.current = mesh
        groupRef.current!.add(mesh)

        return () => {
            groupRef.current?.remove(mesh)
            geometry.dispose()
            mat.dispose()
        }
    }, [scene, meta, isLoaded, posTex, nrmTex])

    // Update frame uniform when control changes
    useEffect(() => {
        const baseColor = new THREE.Color(config.Green);
        uniforms.uFrame.value = config.Frame
        uniforms.uGreen.value = new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b)
    }, [config, uniforms])


    return (
        <group ref={groupRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} scale={10}>
                <planeGeometry />
                <meshBasicMaterial color="white" />
            </mesh>
        </group>);
}
