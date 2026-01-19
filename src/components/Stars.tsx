import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three/webgpu';
import { uniform, time, instanceIndex, instancedBufferAttribute, Fn, uv, vec2, vec3, float, length, smoothstep, mx_hsvtorgb, mx_rgbtohsv, fract, sin, max } from 'three/tsl';
import { useControls } from 'leva';

interface StarsProps {
  count?: number;
  sizeAttenuation?: boolean;
  scale?: number;
  color?: THREE.Color | string;
  rotationSpeed?: number;
}

export function Stars({
  count = 1000,
  color,
  rotationSpeed = 1,
}: StarsProps) {
  const materialRef = useRef<THREE.SpriteNodeMaterial>(null);

  // Leva controls for scale, rim, base color, and hue variation
  const { scale, rim, baseColor, hueVariation } = useControls('Stars', {
    scale: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
    },
    rim: {
      value: 0.95,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    },
    baseColor: {
      value: '#bbd0f5',
    },
    hueVariation: {
      value: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    },
  });

  const radius = 190;
  // Generate random positions and seeds for stars on sphere rim, directly as InstancedBufferAttribute
  const { positionAttribute, seedAttribute } = useMemo(() => {
    const pos = [];
    const seedArray = [];
    
    const rimMin = radius * rim;
    const rimMax = radius;
    const rimThickness = rimMax - rimMin;
    
    for (let i = 0; i < count; i++) {
      const seed = Math.random();
      seedArray.push(seed);
      
      let x, y, z, len;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = Math.sqrt(x * x + y * y + z * z);
      } while (len > 1 || len === 0);
      
      x /= len;
      y /= len;
      z /= len;
      
      if (y < 0) {
        y = -y;
      }
      
      const r = rimMin + Math.random() * rimThickness;
      
      pos.push(r * x, r * y, r * z);
    }
    
    return {
      positionAttribute: new THREE.InstancedBufferAttribute(new Float32Array(pos), 3),
      seedAttribute: new THREE.InstancedBufferAttribute(new Float32Array(seedArray), 1),
    };
  }, [count, radius, rim]);

  // Get color value as RGB - use control if available, otherwise use prop or default
  const colorValue = useMemo(() => {
    const c = new THREE.Color();
    if (baseColor) {
      c.set(baseColor);
    } else if (color) {
      if (typeof color === 'string') {
        c.set(color);
      } else {
        c.copy(color);
      }
    } else {
      c.setHSL(1.0, 0.3, 0.7, THREE.SRGBColorSpace);
    }
    return c;
  }, [baseColor, color]);

  // Create material with TSL nodes
  const material = useMemo(() => {
    const mat = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    // Set material base color
    mat.color.copy(colorValue);

    // Create circle procedurally in fragment shader using opacityNode
    mat.opacityNode = Fn(() => {
      const uvCoords = uv();
      const center = vec2(0.5, 0.5);
      const dist = length(uvCoords.sub(center));
      const circle = smoothstep(float(0.47), float(0.4), dist);
      return circle;
    })();

    // Get seed for this instance
    const seed = instancedBufferAttribute(seedAttribute);

    // Use seed to generate random values for size variation (0.5 to 1.5)
    const sizeVariation = seed.mul(0.5).add(1);

    // Convert base RGB color to HSV in TSL
    const baseRGB = vec3(float(colorValue.r), float(colorValue.g), float(colorValue.b));
    const baseHSV = mx_rgbtohsv(baseRGB);
    
    // Apply hue variation using seed and control value
    const hueShifted = fract(baseHSV.x.add(seed.mul(float(hueVariation))));
    
    // Add sine-based brightness animation with time
    // Each star has a different phase based on seed, creating varied twinkling
    const timePhase = time.add(seed.mul(float(6.28318))).mul(float(5)); // 2*PI for full cycle variation
    const brightnessVariation = sin(timePhase).mul(float(0.3)).add(float(0.7)); // Oscillate between 0.4 and 1.0
    const animatedBrightness = baseHSV.z.mul(brightnessVariation);
    
    const variedHSV = vec3(hueShifted, baseHSV.y, animatedBrightness);
    
    // Convert back to RGB
    const variedColor = mx_hsvtorgb(variedHSV);

    // Set TSL nodes
    mat.positionNode = instancedBufferAttribute(positionAttribute);
    mat.rotationNode = time.mul(rotationSpeed).add(instanceIndex).sin();
    // Ensure minimum scale of 1.0 to prevent blinking/flickering
    const baseScale = uniform(scale).mul(sizeVariation);
    mat.scaleNode = max(baseScale, float(1.0));
    mat.colorNode = variedColor;

    return mat;
  }, [positionAttribute, seedAttribute, scale, colorValue, rotationSpeed, hueVariation]);

  // Store material ref
  useEffect(() => {
    if (materialRef.current !== material) {
      materialRef.current = material;
    }
  }, [material]);

  // Update material when sizeAttenuation changes
  useEffect(() => {
    if (material && material.scaleNode) {
      material.scaleNode = uniform(scale);
      material.needsUpdate = true;
    }
  }, [material, scale]);

  // Create sprite object
  const sprite = useMemo(() => {
    const spriteObj = new THREE.Sprite(material);
    spriteObj.count = count;
    spriteObj.frustumCulled = false;
    
    // Set seed attribute on the sprite's geometry
    if (spriteObj.geometry) {
      spriteObj.geometry.setAttribute('seed', seedAttribute);
    }
    
    return spriteObj;
  }, [material, count, seedAttribute]);

  return <primitive object={sprite} />;
}
