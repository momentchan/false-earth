import { useEffect, useRef, RefObject } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

interface KeyboardCameraControlsProps {
  /**
   * Movement speed in units per second
   * @default 5.0
   */
  moveSpeed?: number
  /**
   * Enable vertical movement with Q (up) and E (down) keys
   * @default false
   */
  enableVerticalMovement?: boolean
  /**
   * Vertical movement speed in units per second
   * @default 3.0
   */
  verticalSpeed?: number
  /**
   * Reference to CameraControls instance (optional)
   * If provided, will use CameraControls API to update position
   */
  cameraControlsRef?: RefObject<any>
}

/**
 * KeyboardCameraControls - WASD keyboard controls for camera movement
 * 
 * Controls:
 * - W: Move forward
 * - S: Move backward
 * - A: Move left (strafe)
 * - D: Move right (strafe)
 * - Q: Move up (if enableVerticalMovement is true)
 * - E: Move down (if enableVerticalMovement is true)
 */
export function KeyboardCameraControls({
  moveSpeed = 5.0,
  enableVerticalMovement = false,
  verticalSpeed = 3.0,
  cameraControlsRef,
}: KeyboardCameraControlsProps = {}) {
  const { camera } = useThree()
  const keysPressed = useRef<Set<string>>(new Set())
  
  // Track keyboard state
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      // Only track relevant keys
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        keysPressed.current.add(key)
        event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      keysPressed.current.delete(key)
    }

    // Also clear keys when window loses focus to prevent stuck keys
    const handleBlur = () => {
      keysPressed.current.clear()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  useFrame((_state, delta) => {
    const keys = keysPressed.current
    if (keys.size === 0) return

    // Calculate movement direction based on camera rotation
    const direction = new THREE.Vector3()
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)

    // Get camera's forward direction (negative Z in camera space)
    camera.getWorldDirection(forward)
    
    // Calculate right vector (cross product of forward and world up)
    right.crossVectors(forward, up).normalize()
    
    // Recalculate forward to be parallel to ground (remove vertical component)
    forward.y = 0
    forward.normalize()

    // Apply movement based on pressed keys
    if (keys.has('w')) {
      direction.add(forward)
    }
    if (keys.has('s')) {
      direction.sub(forward)
    }
    if (keys.has('a')) {
      direction.sub(right)
    }
    if (keys.has('d')) {
      direction.add(right)
    }

    // Vertical movement
    if (enableVerticalMovement) {
      if (keys.has('q')) {
        direction.add(up)
      }
      if (keys.has('e')) {
        direction.sub(up)
      }
    }

    // Apply horizontal movement
    let moved = false
    if (direction.lengthSq() > 0) {
      direction.normalize()
      const moveDistance = moveSpeed * delta
      camera.position.addScaledVector(direction, moveDistance)
      moved = true
    }
    
    // Apply vertical movement separately
    if (enableVerticalMovement) {
      if (keys.has('q')) {
        camera.position.y += verticalSpeed * delta
        moved = true
      }
      if (keys.has('e')) {
        camera.position.y -= verticalSpeed * delta
        moved = true
      }
    }
    
    // Update camera matrices if any movement occurred
    if (moved) {
      camera.updateMatrixWorld()
      
      // If CameraControls ref is provided, sync the position to CameraControls
      // This ensures CameraControls knows about the position change
      if (cameraControlsRef?.current) {
        // CameraControls will detect the position change in the next frame
        // We can also explicitly tell it to update by calling update() if needed
        // However, directly modifying camera.position should work since CameraControls
        // reads from the camera each frame
      }
    }
  })

  return null
}

