import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

// Optional rapier dependency
let BallCollider: any, RigidBody: any, isRapierAvailable = false;

// Fallback components
const FallbackBallCollider = ({ children, ...props }: any) => <group {...props}>{children}</group>;
const FallbackRigidBody = ({ children, ...props }: any) => <group {...props}>{children}</group>;

// Try to load @react-three/rapier
try {
    const { BallCollider: RapierBallCollider, RigidBody: RapierRigidBody } = require('@react-three/rapier');
    BallCollider = RapierBallCollider;
    RigidBody = RapierRigidBody;
    isRapierAvailable = true;
} catch (error) {
    // Expected when @react-three/rapier is not installed
    isRapierAvailable = false;
    BallCollider = FallbackBallCollider;
    RigidBody = FallbackRigidBody;
}

interface PhysicalPointerProps {
    /** Scale of the collision sphere */
    scale?: number;
    /** Whether to show a visual representation */
    visible?: boolean;
    /** Callback when position updates */
    onPositionUpdate?: (position: THREE.Vector3) => void;
    /** Whether to show error message when rapier is not available */
    showRapierError?: boolean;
}

/**
 * Check if @react-three/rapier is available
 */
export function isPhysicsSupported(): boolean {
    return isRapierAvailable;
}

/**
 * PhysicalPointer - A physics-enabled pointer that follows the mouse cursor
 * Requires @react-three/rapier for physics simulation
 * Falls back to visual-only mode if rapier is not available
 */
export default function PhysicalPointer({
    scale = 1,
    visible = false,
    onPositionUpdate,
    showRapierError = false
}: PhysicalPointerProps) {
    const camera = useThree((state) => state.camera);
    const ref = useRef<any>(null);

    useFrame(({ mouse }) => {
        const mousePosition = new THREE.Vector3();
        mousePosition.set(mouse.x, mouse.y, 0.5);
        mousePosition.unproject(camera);

        const direction = mousePosition.sub(camera.position).normalize();
        const distanceToPlane = -camera.position.dot(direction);
        const intersection = camera.position.clone().add(direction.multiplyScalar(distanceToPlane));

        // Update the physics body position (if rapier is available)
        if (isRapierAvailable && ref.current?.setNextKinematicTranslation) {
            ref.current.setNextKinematicTranslation(intersection);
        } else if (!isRapierAvailable && ref.current) {
            // Fallback to simple position update
            ref.current.position.copy(intersection);
        }

        // Call the position update callback
        onPositionUpdate?.(intersection);
    });

    // Show error message if rapier is not available and user wants to see it
    if (!isRapierAvailable && showRapierError) {
        return (
            <group>
                <mesh position={[0, 0, 0]}>
                    <planeGeometry args={[2, 0.5]} />
                    <meshBasicMaterial color="red" transparent opacity={0.8} />
                </mesh>
                {/* Error text would need a text component - simplified for now */}
            </group>
        );
    }

    return (
        <RigidBody
            position={[0, 0, 0]}
            type={isRapierAvailable ? "kinematicPosition" : undefined}
            colliders={isRapierAvailable ? false : undefined}
            ref={ref}
        >
            {isRapierAvailable && <BallCollider args={[scale]} />}
            {(visible || !isRapierAvailable) && (
                <mesh>
                    <sphereGeometry args={[scale]} />
                    <meshBasicMaterial
                        color={isRapierAvailable ? "red" : "orange"}
                        transparent
                        opacity={0.5}
                        wireframe
                    />
                </mesh>
            )}
        </RigidBody>
    );
}