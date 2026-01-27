import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useGridSnapping } from '../../core/utils/gridSnapping'
import { GrassLOD } from './GrassLOD'
import type { GrassProps } from './core/config'
import { useGameStore } from '../../core/store/gameStore'
import { useGrassUniforms } from './hooks/useGrassUniforms'
import { useGrassCompute } from './hooks/useGrassCompute'

export default function GrassWebGPU({ cullCamera }: GrassProps = {} as GrassProps) {
  const { camera: defaultCamera } = useThree()
  const groupRef = useRef<THREE.Group>(null)

  const cameraToUse = cullCamera || defaultCamera

  const characterRef = useGameStore((state) => state.characterRef)
  const windUniforms = useGameStore((state) => state.windUniforms)

  const characterPos = useMemo(() => new THREE.Vector3(), [])

  const { uniforms, params } = useGrassUniforms(windUniforms)
  const { lodBuffers, grassData, positions } = useGrassCompute(uniforms, windUniforms, cameraToUse)

  // Use centralized grid snapping hook
  const { gridCellSize } = useGridSnapping({
    camera: cameraToUse,
    onSnap: ({ snappedX, snappedZ }) => {
      if (!groupRef.current) return;

      groupRef.current.position.set(snappedX, 0, snappedZ)
      groupRef.current.updateMatrixWorld(true)

      if (groupRef.current) {
        uniforms.compute.uGroupOffset.value.setFromMatrixPosition(groupRef.current.matrixWorld)
        uniforms.compute.uGridCellSize.value = gridCellSize
        uniforms.material.uGroupOffset.value.copy(uniforms.compute.uGroupOffset.value)
      }
    },
  })

  useFrame(() => {
    if (characterRef?.current) {
      characterRef.current.getWorldPosition(characterPos);
      uniforms.material.uCharacterWorldPos.value.copy(characterPos);
    }
  })

  return (
    <group ref={groupRef}>
      {lodBuffers.map((lodBuffer) => (
        <GrassLOD
          key={`lod-${lodBuffer.segments}-${lodBuffer.minDistance}-${lodBuffer.maxDistance}`}
          grassParams={params}
          grassData={grassData}
          positions={positions}
          lodBuffer={lodBuffer}
          uniforms={uniforms.material}
        />
      ))}
    </group>
  )
}
