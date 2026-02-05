import { useRef, useEffect, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useUploadQueueStore } from '../store/uploadQueueStore'
import * as THREE from 'three/webgpu'

interface AsyncCompileProps {
  children: React.ReactNode
  id: string
  onReady?: (id: string, isReady: boolean) => void
  debug?: boolean
}

/**
 * Manages asynchronous shader compilation and GPU uploads with bandwidth throttling.
 * 
 * State flow: idle → compiled → uploading → done
 * 
 * Ensures only one component uploads to GPU at a time to prevent PCIe saturation.
 */
export function AsyncCompile({ children, id, onReady, debug = false }: AsyncCompileProps) {
  const { gl, camera } = useThree()
  
  const enqueueUpload = useUploadQueueStore((state) => state.enqueueUpload)
  const processNextUpload = useUploadQueueStore((state) => state.processNextUpload)
  const removeUpload = useUploadQueueStore((state) => state.removeUpload)
  const currentUploader = useUploadQueueStore((state) => state.currentUploader)
  
  const groupRef = useRef<THREE.Group>(null)
  const [status, setStatus] = useState<'idle' | 'compiled' | 'uploading' | 'done'>('idle')
  const frameCount = useRef(0)
  const startTime = useRef<number>(0)
  
  const log = (...args: any[]) => {
    if (debug) console.log(...args)
  }

  // Stage 1: Shader Compilation (parallel)
  useEffect(() => {
    let isMounted = true
    const compile = async () => {
      log(`📦 [${id}] Stage 1: Starting shader compilation...`);
      startTime.current = performance.now();
      
      await new Promise(resolve => setTimeout(resolve, 0)) 
      
      if (groupRef.current && isMounted) {
        try {
          await gl.compileAsync(groupRef.current, camera)
          
          if (isMounted) {
            const compileTime = (performance.now() - startTime.current).toFixed(1);
            log(`✨ [${id}] Stage 1 Complete: Shaders compiled in ${compileTime}ms. Joining upload queue...`);
            setStatus('compiled')
            enqueueUpload(id)
          }
        } catch (error) {
            console.error(`❌ [${id}] Compilation error:`, error)
            onReady?.(id, true) 
            setStatus('done')
            
            // Prevent queue deadlock on error
            const state = useUploadQueueStore.getState();
            if (state.currentUploader === id) {
              processNextUpload();
            }
        }
      }
    }
    
    onReady?.(id, false)
    compile()
    
    return () => {
      isMounted = false
      onReady?.(id, false)
      removeUpload(id)
    }
  }, [gl, camera, id, enqueueUpload, onReady, removeUpload, processNextUpload])

  // Stage 2: Wait for upload slot
  useEffect(() => {
    if (status === 'compiled' && currentUploader === id) {
      log(`⬆️  [${id}] Stage 2: Got upload slot! Starting GPU data transfer...`);
      setStatus('uploading')
      frameCount.current = 0
      startTime.current = performance.now();
    }
  }, [currentUploader, status, id])

  // Stage 3: GPU upload (serial, one at a time)
  useFrame(() => {
    if (status !== 'uploading') return;
    
    frameCount.current += 1
    
    if (frameCount.current === 1) {
      log(`  📤 [${id}] Frame ${frameCount.current}/3: Uploading geometry & textures to GPU...`);
    }
    
    // Allow 3+ frames for GPU to complete data transfer
    if (frameCount.current > 3) {
      const uploadTime = (performance.now() - startTime.current).toFixed(1);
      log(`  💾 [${id}] Stage 3 Complete: Upload finished in ${uploadTime}ms (${frameCount.current} frames)`);
      
      setStatus('done')
      onReady?.(id, true)
      processNextUpload()
    }
  })

  const isVisible = status === 'uploading' || status === 'done'

  return (
    <group ref={groupRef} visible={isVisible}>
      {children}
    </group>
  )
}
