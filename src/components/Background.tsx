import { memo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useTexture } from '@react-three/drei'
import { texture, equirectUV } from 'three/tsl'
import * as THREE from 'three'

export const Background = memo(function Background() {
  const { scene } = useThree()

  const starmapControls = useControls('Background', {
    backgroundIntensity: { value: 0.1, min: 0, max: 1, step: 0.01 },
    useTexture: { value: true }
  }, { collapsed: true })

  const starmapTexture = useTexture('/textures/starmap_2020_4k.png')
  starmapTexture.mapping = THREE.EquirectangularReflectionMapping
  starmapTexture.colorSpace = THREE.SRGBColorSpace

  // Update background when controls or texture changes
  useEffect(() => {
    if (starmapControls.useTexture && starmapTexture) {
      // Use the starmap texture with equirectangular mapping
      scene.backgroundNode = texture(starmapTexture, equirectUV()).mul(starmapControls.backgroundIntensity)
    }
  }, [starmapControls.backgroundIntensity, starmapControls.useTexture, scene, starmapTexture])

  return null
})

