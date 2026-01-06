// ============================================================================
// Utility Functions
// ============================================================================
import * as THREE from 'three'
import { BLADE_SEGMENTS } from './constants'

// ============================================================================
// Seeded Random Number Generator (for consistent position generation)
// ============================================================================
export function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export function createGrassGeometry(gridSize: number, patchSize: number): THREE.InstancedBufferGeometry {
    const grassBlades = gridSize * gridSize;
    const bladeGeometry = new THREE.PlaneGeometry(
        1,
        1,
        1,
        BLADE_SEGMENTS
    )

    bladeGeometry.translate(0, 1 / 2, 0)

    const instancedGeometry = new THREE.InstancedBufferGeometry()

    instancedGeometry.setAttribute('position', bladeGeometry.attributes.position)
    instancedGeometry.setAttribute('normal', bladeGeometry.attributes.normal)
    instancedGeometry.setAttribute('uv', bladeGeometry.attributes.uv)
    instancedGeometry.setIndex(bladeGeometry.index)

    const offsets = new Float32Array(grassBlades * 3)
    const instanceIds = new Float32Array(grassBlades)

    let i = 0;
    let idIdx = 0;

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            const id = x * gridSize + z;
            if (id >= grassBlades) break;
            const fx = x / gridSize - 0.5;
            const fz = z / gridSize - 0.5;

            const seed = (x * 7919 + z * 7919) * 0.0001;
            const jitterX = (seededRandom(seed) - 0.5) * 0.2;
            const jitterZ = (seededRandom(seed + 1.0) - 0.5) * 0.2;

            const px = fx * patchSize + jitterX;
            const pz = fz * patchSize + jitterZ;

            offsets[i++] = px;
            offsets[i++] = 0;
            offsets[i++] = pz;

            instanceIds[idIdx++] = id;
        }
    }

    instancedGeometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    instancedGeometry.setAttribute('instanceId', new THREE.InstancedBufferAttribute(instanceIds, 1))
    
    return instancedGeometry
}

export function createPositionTexture(gridSize: number, patchSize: number): THREE.DataTexture {
    const data = new Float32Array(gridSize * gridSize * 4)
    let idx = 0
    
    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            const fx = x / gridSize - 0.5
            const fz = z / gridSize - 0.5
            
            // Use same seeded random as geometry creation for consistency
            const seed = (x * 7919 + z * 7919) * 0.0001
            const jitterX = (seededRandom(seed) - 0.5) * 0.2
            const jitterZ = (seededRandom(seed + 1.0) - 0.5) * 0.2
            
            const px = fx * patchSize + jitterX
            const pz = fz * patchSize + jitterZ
            
            data[idx++] = px
            data[idx++] = 0
            data[idx++] = pz
            data[idx++] = 0
        }
    }
    
    const texture = new THREE.DataTexture(data, gridSize, gridSize, THREE.RGBAFormat, THREE.FloatType)
    texture.needsUpdate = true
    return texture
}
