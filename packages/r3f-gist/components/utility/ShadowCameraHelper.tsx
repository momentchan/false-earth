import { useRef, useEffect } from 'react'
import { useHelper } from '@react-three/drei'
import * as THREE from 'three'

interface ShadowCameraHelperProps {
    /** Ref to the directional light */
    lightRef: React.RefObject<THREE.DirectionalLight | null>
    /** Whether to show the shadow camera frustum (yellow wireframe box showing shadow bounds) */
    visible?: boolean
}

/**
 * ShadowCameraHelper - Visualizes the shadow camera frustum for a directional light
 * 
 * Displays a yellow wireframe box showing the shadow camera's orthographic frustum bounds.
 * This helps you verify that all objects that need to cast shadows are within the shadow camera's coverage area.
 * 
 * Note: This shows the shadow frustum bounds (using CameraHelper on the shadow camera), 
 * NOT the light direction. Use DirectionalLightHelper separately if you need to visualize the light direction.
 * 
 * @example
 * ```tsx
 * const lightRef = useRef<THREE.DirectionalLight>(null)
 * 
 * <directionalLight ref={lightRef} castShadow ... />
 * <ShadowCameraHelper lightRef={lightRef} visible={showHelper} />
 * ```
 */
export default function ShadowCameraHelper({ 
    lightRef, 
    visible = true
}: ShadowCameraHelperProps) {
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
    
    useEffect(() => {
        if (lightRef.current?.shadow?.camera) {
            cameraRef.current = lightRef.current.shadow.camera as THREE.OrthographicCamera
        }
    })
    
    // Show shadow camera frustum (the actual shadow bounds)
    useHelper(
        visible && cameraRef.current 
            ? (cameraRef as React.MutableRefObject<THREE.Object3D>) 
            : null, 
        THREE.CameraHelper
    )
    
    return null
}
