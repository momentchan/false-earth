// src/ui/controls/TouchControls.tsx
import { useState, useRef } from 'react';
import { inputState } from './InputManager';

export function TouchControls() {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isRunning, setIsRunning] = useState(false); // For visual feedback
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  
  // --- Configuration ---
  const MAX_RADIUS = 50; 
  const DEAD_ZONE = 10;      // Dead zone: No response if moved less than 10px (prevents jitter)
  const RUN_THRESHOLD = 0.8; // Threshold: Trigger run if pushed past 80% (approx 40px)

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickContainerRef.current) return;

    // 1. Calculate center point
    const rect = joystickContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // 2. Calculate distance
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 3. Clamp range & Normalize
    // If finger drags outside circle, clamp to MAX_RADIUS
    let clampedDistance = distance;
    if (distance > MAX_RADIUS) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * MAX_RADIUS;
      deltaY = Math.sin(angle) * MAX_RADIUS;
      clampedDistance = MAX_RADIUS;
    }

    // 4. Update UI visuals
    setJoystickPos({ x: deltaX, y: deltaY });

    // --- Core Logic: Update InputManager ---

    // A. Handle movement & rotation (Dead Zone Check)
    if (clampedDistance > DEAD_ZONE) {
      // Push up (Y < 0) to move forward
      inputState.moveForward = deltaY < -DEAD_ZONE;
      
      // Push left/right to rotate
      inputState.rotateLeft = deltaX < -DEAD_ZONE;
      inputState.rotateRight = deltaX > DEAD_ZONE;
    } else {
      // Stop all movement if inside dead zone
      inputState.moveForward = false;
      inputState.rotateLeft = false;
      inputState.rotateRight = false;
    }

    // B. Handle sprinting (Run Logic based on Radius)
    // Calculate pull ratio (0.0 ~ 1.0)
    const pullRatio = clampedDistance / MAX_RADIUS;
    
    // If pulled past 80%, treat as running
    const shouldRun = pullRatio > RUN_THRESHOLD;
    
    inputState.run = shouldRun;
    setIsRunning(shouldRun); // Update local state to change joystick color
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleJoystickMove(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) {
      handleJoystickMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Reset visuals
    setJoystickPos({ x: 0, y: 0 });
    setIsRunning(false);
    
    // Reset all input states
    inputState.moveForward = false;
    inputState.rotateLeft = false;
    inputState.rotateRight = false;
    inputState.run = false;
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '40px',
      left: '0',
      width: '100%', 
      height: '150px',
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'flex-start', // Align left
      padding: '0 40px',
      userSelect: 'none',
      zIndex: 100
    }}>
      {/* Virtual Joystick */}
      <div 
        ref={joystickContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '120px',
          height: '120px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: `2px solid ${isRunning ? 'rgba(255, 200, 0, 0.6)' : 'rgba(255, 255, 255, 0.3)'}`, // Change border color when running
          backdropFilter: 'blur(4px)',
          borderRadius: '50%',
          position: 'relative',
          pointerEvents: 'auto',
          touchAction: 'none',
          transition: 'border-color 0.2s', // Color transition effect
        }}
      >
        {/* Joystick Knob */}
        <div style={{
          width: '50px',
          height: '50px',
          // Yellow when running, white when walking
          background: isRunning ? 'rgba(255, 200, 0, 0.9)' : 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
          transition: joystickPos.x === 0 ? 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'background 0.2s',
          boxShadow: isRunning ? '0 0 10px rgba(255, 200, 0, 0.5)' : 'none', // Glow when running
        }} />
      </div>
    </div>
  );
}