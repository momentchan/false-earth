// src/components/cosmic/CosmicBeams.tsx
// Decoupled beam component - only handles beam rendering and animation
import { useRef, useMemo, useImperativeHandle, forwardRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { createCosmicBeamMaterial } from "./CosmicBeamMaterial";
import gsap from "gsap";

const MAX_BEAMS = 20;
const BEAM_HEIGHT = 20; // Beam length
const DROP_HEIGHT = 50; // Height from which beam drops

export interface CosmicBeamsRef {
  triggerBeam: (position: THREE.Vector3, onHit?: (position: THREE.Vector3) => void) => void;
}

export const CosmicBeams = forwardRef<CosmicBeamsRef, {}>((_props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const beams = useMemo(() => {
    return Array.from({ length: MAX_BEAMS }).map(() => ({
      position: new THREE.Vector3(),
      y: -5000,
      scaleWidth: 0,
      isAnimating: false,
      onHit: null as ((position: THREE.Vector3) => void) | null
    }));
  }, []);

  const { material } = useMemo(() => createCosmicBeamMaterial(), []);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const startBeamAnimation = (position: THREE.Vector3, onHit?: (position: THREE.Vector3) => void) => {
    const beam = beams.find(b => !b.isAnimating);
    
    if (beam) {
      beam.isAnimating = true;
      beam.position.copy(position);
      beam.onHit = onHit || null;
      
      // GSAP Animation Logic
      const beamIndex = beams.indexOf(beam);
      const tl = gsap.timeline({
        onComplete: () => {
          // Update matrix to hidden state before cleanup
          if (meshRef.current) {
            dummy.position.set(0, -5000, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(beamIndex, dummy.matrix);
            meshRef.current.instanceMatrix.needsUpdate = true;
          }
          
          // Cleanup when all animation finishes
          beam.isAnimating = false; // Animation finished, release back to pool
          beam.y = -5000; // Hide
          beam.scaleWidth = 0;
          beam.onHit = null;
        }
      });

      // Set initial state
      beam.y = DROP_HEIGHT + (BEAM_HEIGHT / 2);
      beam.scaleWidth = 0.1;

      // Phase 1: Fast drop (Strike)
      tl.to(beam, {
        y: BEAM_HEIGHT / 2, // Hit ground
        scaleWidth: 0.15,   // Slightly thicker (Stretch)
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          if (beam.onHit) {
            beam.onHit(beam.position.clone());
            beam.onHit = null;
          }
        }
      });

      // Phase 2: Fade out after impact (Decay)
      tl.to(beam, {
        scaleWidth: 0,      // Width becomes 0
        duration: 0.35,
        ease: "power2.out",
      });
    }
  };

  // Initialize all beams to be hidden on mount
  useEffect(() => {
    if (!meshRef.current) return;
    
    dummy.position.set(0, -5000, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    
    for (let i = 0; i < MAX_BEAMS; i++) {
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useImperativeHandle(ref, () => ({
    triggerBeam: (position: THREE.Vector3, onHit?: (position: THREE.Vector3) => void) => {
      startBeamAnimation(position, onHit);
    }
  }));

  // Render Loop: Only sync data (Sync)
  useFrame(() => {
    if (!meshRef.current) return;
    
    let needsUpdate = false;

    // Iterate through all animating beams, update matrices
    beams.forEach((beam, i) => {
      // Only update matrices for beams that are animating (performance optimization)
      if (beam.isAnimating) {
        dummy.position.copy(beam.position);
        dummy.position.y = beam.y;           // Y calculated by GSAP
        dummy.scale.set(beam.scaleWidth, 1, beam.scaleWidth); // Width calculated by GSAP
        
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, MAX_BEAMS]} 
        frustumCulled={false} // Always render, beams are very tall
        layers={1}
    >
      <cylinderGeometry args={[1, 1, BEAM_HEIGHT, 8]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
});

CosmicBeams.displayName = 'CosmicBeams';
