import { Sky as DreiSky } from '@react-three/drei'
import { useControls } from 'leva'
import { useMemo } from 'react'
import * as THREE from 'three'

interface SkyProps {
  sunPosition?: THREE.Vector3
}

export function Sky({ sunPosition: sunPositionProp }: SkyProps = {}) {
  const skyParams = useControls('Background.Sky', {
    useLightPosition: { value: true, label: 'Use Light Position' },
    sunPositionX: { value: 0, min: -1, max: 1, step: 0.1 },
    sunPositionY: { value: 1, min: -1, max: 1, step: 0.1 },
    sunPositionZ: { value: 0, min: -1, max: 1, step: 0.1 },
    turbidity: { value: 4.4, min: 0, max: 20, step: 0.1 },
    rayleigh: { value: 0.2, min: 0, max: 4, step: 0.1 },
    mieCoefficient: { value: 0.005, min: 0, max: 0.1, step: 0.001 },
    mieDirectionalG: { value: 0.8, min: 0, max: 1, step: 0.01 },
    inclination: { value: 0.49, min: 0, max: 1, step: 0.01 },
    azimuth: { value: 0.25, min: 0, max: 1, step: 0.01 },
    distance: { value: 100, min: 0, max: 1000, step: 10 }
  })

  const sunPosition = useMemo(() => {
    if (skyParams.useLightPosition && sunPositionProp) {
      // Normalize the light position for sky (sky expects normalized direction)
      const normalized = sunPositionProp.clone().normalize()
      return [normalized.x, normalized.y, normalized.z] as [number, number, number]
    }
    return [skyParams.sunPositionX, skyParams.sunPositionY, skyParams.sunPositionZ] as [number, number, number]
  }, [skyParams.useLightPosition, skyParams.sunPositionX, skyParams.sunPositionY, skyParams.sunPositionZ, sunPositionProp])

  return (
    <DreiSky
      sunPosition={sunPosition}
      turbidity={skyParams.turbidity}
      rayleigh={skyParams.rayleigh}
      mieCoefficient={skyParams.mieCoefficient}
      mieDirectionalG={skyParams.mieDirectionalG}
      inclination={skyParams.inclination}
      azimuth={skyParams.azimuth}
      distance={skyParams.distance}
    />
  )
}

