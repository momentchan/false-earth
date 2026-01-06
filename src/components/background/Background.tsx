import { memo } from 'react'
import { useControls } from 'leva'
import { Sky } from './Sky'
import { ProceduralSphere } from './ProceduralSphere'
import * as THREE from 'three'

interface BackgroundProps {
  sunPosition?: THREE.Vector3
}

export const Background = memo(function Background({ sunPosition }: BackgroundProps = {} as BackgroundProps) {
  const bgControl = useControls('Background', {
    type: { value: 'procedural', options: ['procedural', 'sky', 'none'] },
  }, { collapsed: true })

  if (bgControl.type === 'sky') {
    return <Sky sunPosition={sunPosition} />
  }

  if (bgControl.type === 'procedural') {
    return <ProceduralSphere />
  }

  return null
})

