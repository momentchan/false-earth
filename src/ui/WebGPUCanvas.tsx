'use client';

import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { WebGPURenderer } from 'three/webgpu';
import { ReactNode } from 'react';

interface WebGPUCanvasProps {
  children: ReactNode;
  width?: number; // Visual width in pixels
  height?: number; // Visual height in pixels
  style?: React.CSSProperties;
  className?: string;
  dpr?: number | [number, number];
}

export default function WebGPUCanvas({ 
  children, 
  width = 200, 
  height = 200, 
  style, 
  className,
  dpr = [1, 2] 
}: WebGPUCanvasProps) {
  
  // Calculate camera boundaries to match pixel size 1:1
  const halfW = width / 2;
  const halfH = height / 2;

  return (
    <div style={{ width, height, ...style }} className={className}>
      <Canvas
        style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
        dpr={dpr}
        gl={(canvas) => {
          // Initialize generic WebGPU renderer optimized for UI
          const renderer = new WebGPURenderer({
            ...canvas as any,
            powerPreference: "high-performance",
            antialias: true,
            alpha: true,
            depth: false,   // CRITICAL: Disabling depth fixes the resize crash
            stencil: false, // Saves memory
          });
          return renderer.init().then(() => renderer);
        }}
      >
        <OrthographicCamera 
          makeDefault 
          position={[0, 0, 10]}
          zoom={1}
          left={-halfW}
          right={halfW}
          top={halfH}
          bottom={-halfH}
        />
        
        {children}
      </Canvas>
    </div>
  );
}