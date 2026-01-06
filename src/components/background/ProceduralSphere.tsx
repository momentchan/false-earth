import { useRef, useMemo, useEffect } from 'react'
import { useControls } from 'leva'
import { useFrame } from '@react-three/fiber'
import CustomShaderMaterial from 'three-custom-shader-material'
import simplexNoise from '@packages/r3f-gist/shaders/cginc/noise/simplexNoise.glsl'
import * as THREE from 'three'

const backgroundVertex = /* glsl */ `
  varying vec3 vWPos;
  
  void main() {
    vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
    
    csm_Position = position;
  }
`

const backgroundFragment = /* glsl */ `
  ${simplexNoise}
  
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uNoiseScale;
  
  varying vec3 vWPos;
  
  void main() {
    vec3 noiseCoord = vWPos * uNoiseScale + vec3(uTime * uSpeed);
    
    // Sample 3D simplex noise
    float n = simplexNoise3d(noiseCoord);
    n = n * 0.5 + 0.5;
    
    // Mix colors
    vec3 color = mix(uColor2, uColor1, n);
    
    color *= uIntensity;
    
    csm_DiffuseColor = vec4(color, 1.0);
  }
`

export function ProceduralSphere() {
  const materialRef = useRef<any>(null)
  
  const bgParams = useControls('Background.Procedural', {
    color1: { value: '#343638' },
    color2: { value: '#000000' },
    intensity: { value: 1.0, min: 0, max: 2, step: 0.1 },
    speed: { value: 0.1, min: 0, max: 1, step: 0.01 },
    noiseScale: { value: { x: 0.05, y: 0.1, z: 0.05 }, step: 0.01, min: 0.01, max: 0.1 },
  })

  const color1Ref = useRef(new THREE.Color())
  const color2Ref = useRef(new THREE.Color())
  const uniforms = useMemo(() => ({
    uColor1: { value: new THREE.Color(bgParams.color1) },
    uColor2: { value: new THREE.Color(bgParams.color2) },
    uIntensity: { value: bgParams.intensity },
    uTime: { value: 0.0 },
    uSpeed: { value: bgParams.speed },
    uNoiseScale: { value: new THREE.Vector3(bgParams.noiseScale.x, bgParams.noiseScale.y, bgParams.noiseScale.z) }
  }), [bgParams.color1, bgParams.color2, bgParams.intensity, bgParams.speed, bgParams.noiseScale.x, bgParams.noiseScale.y, bgParams.noiseScale.z])

  // Update uniforms when params change (most are handled by useMemo, only update what changes)
  useEffect(() => {
    color1Ref.current.set(bgParams.color1)
    uniforms.uColor1.value.set(color1Ref.current.r, color1Ref.current.g, color1Ref.current.b)
    color2Ref.current.set(bgParams.color2)
    uniforms.uColor2.value.set(color2Ref.current.r, color2Ref.current.g, color2Ref.current.b)
    uniforms.uIntensity.value = bgParams.intensity
    uniforms.uSpeed.value = bgParams.speed
    uniforms.uNoiseScale.value.set(bgParams.noiseScale.x, bgParams.noiseScale.y, bgParams.noiseScale.z)
    
    if (materialRef.current) {
      materialRef.current.needsUpdate = true
    }
  }, [bgParams, uniforms])

  // Update time every frame for animation
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
  })


  return (
    <mesh position={[0, 0, 0]} scale={30}>
      <sphereGeometry args={[1, 4, 4]} />
      <CustomShaderMaterial
        ref={materialRef}
        baseMaterial={THREE.MeshBasicMaterial}
        vertexShader={backgroundVertex}
        fragmentShader={backgroundFragment}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

