import { struct } from "three/tsl";

export const vatStructure = struct({
    position: 'vec3',  // World coordinates
    isActive: 'float',   // Status: 0=dead, 1=alive (prepared for Spawn system)
    frame: 'float',    // Current animation frame (0-1)
    startTime: 'float',  // Time when the instance was spawned
    seed: 'float',  // Seed for random values
})