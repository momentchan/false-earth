import { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { Fn, vec4, directionToColor, normalWorld } from 'three/tsl';

interface NormalSphereProps {
  position?: [number, number, number];
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
}

export function NormalSphere({
  position = [0, 5, 0],
  radius = 1,
  widthSegments = 32,
  heightSegments = 32,
}: NormalSphereProps) {
  const material = useMemo(() => {
    const mat = new THREE.NodeMaterial();
    mat.toneMapped = false;
    mat.fragmentNode = Fn(() => {
      const normalColor = directionToColor(normalWorld);
      const rawDataColor = normalColor.pow(2.2);
      return vec4(rawDataColor, 1);
    })();
    return mat;
  }, []);

  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, widthSegments, heightSegments]} />
      <primitive object={material} />
    </mesh>
  );
}

