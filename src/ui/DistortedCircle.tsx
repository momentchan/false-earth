'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { 
  vec3, vec2, cos, sin, atan, normalize, length, 
  mix, smoothstep, positionLocal, uniform, 
  mx_noise_float 
} from 'three/tsl';

interface DistortedCircleProps {
  radius?: number;
  segments?: number;
  color?: string;
  distortionStrength?: number; // 0 to 1
  seed?: number;
  lineWidth?: number;
}

export default function DistortedCircle({
  radius = 10,
  segments = 128,
  color = '#aaaaaa',
  distortionStrength = 0,
  seed = 0,
  lineWidth = 5,
}: DistortedCircleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Uniforms
  const uTime = useMemo(() => uniform(0), []);
  const uStrength = useMemo(() => uniform(0), []); // Start at 0
  const uSeed = useMemo(() => uniform(seed), [seed]);
  const uColor = useMemo(() => uniform(new THREE.Color(color)), [color]);

  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
    const path = new THREE.CatmullRomCurve3(curve.getPoints(segments).map(p => new THREE.Vector3(p.x, p.y, 0)));
    path.closed = true;
    return new THREE.TubeGeometry(path, segments, lineWidth * 0.1, 8, true);
  }, [radius, segments, lineWidth]);

  const material = useMemo(() => {
    // TSL Node Logic
    const vertexNode = () => {
      const pos = positionLocal; // vec3
      
      // Calculate polar coordinates
      const center = normalize(pos).mul(radius);
      const dist = length(center.xy);
      const angle = atan(center.y, center.x);

      // Noise Calculation
      const noiseRadius = 0.65; // Fixed freq for simplicity
      const noisePos = vec2(
        cos(angle).mul(noiseRadius).add(uTime.mul(0.5)).add(uSeed.mul(100.0)), 
        sin(angle).mul(noiseRadius).add(uSeed.mul(50.0))
      );
      
      // Apply Distortion
      const radialNoise = mx_noise_float(noisePos);
      const strengthFactor = mix(0.7, 1.0, smoothstep(0.0, 1.0, uStrength));
      
      const newRadius = dist.mul(radialNoise.mul(0.5).mul(uStrength).mul(0.6).add(1.0)).mul(strengthFactor);

      // Reconstruct Position
      const offset = pos.sub(center);
      const newCenter = vec3(cos(angle).mul(newRadius), sin(angle).mul(newRadius), 0.0);

      return newCenter.add(offset); // Return vec3 Local Position
    };

    return new THREE.MeshBasicNodeMaterial({
      colorNode: uColor,
      positionNode: vertexNode(),
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
  }, [radius, uColor, uSeed, uStrength, uTime]);

  useFrame((state, delta) => {
    uTime.value += delta;
    // Smoothly interpolate strength based on prop (replaces GSAP)
    uStrength.value = THREE.MathUtils.lerp(uStrength.value, distortionStrength, 0.1);
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0,0, seed % 1]} />;
}