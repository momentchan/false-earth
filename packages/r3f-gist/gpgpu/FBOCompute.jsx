import * as THREE from 'three'
import { createPortal } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useFBO } from '@react-three/drei';

export default forwardRef(function FBOCompute(props, ref) {
    // set up FBO: framebuffer object
    const [scene] = useState(() => new THREE.Scene())
    const [camera] = useState(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1))
    const [positions] = useState(() => new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]))
    const [uvs] = useState(() => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]))

    const target = useFBO(props.width, props.height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType
    })

    useImperativeHandle(ref, () => ({
        update(state) {
            state.gl.setRenderTarget(target)
            state.gl.clear()
            state.gl.render(scene, camera)
            state.gl.setRenderTarget(null)
        },

        getTarget() {
            return target.texture
        }
    }))

    return (<>
        {/* Simulation goes into a FBO/Off-buffer */}
        {createPortal(
            <mesh material={props.simMat}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
                    <bufferAttribute attach="attributes-uv" count={uvs.length / 2} array={uvs} itemSize={2} />
                </bufferGeometry>
            </mesh>,
            scene
        )}
    </>)
})