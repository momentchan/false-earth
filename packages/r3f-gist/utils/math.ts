import * as THREE from 'three';

/**
 * Generate a random vector inside a sphere
 */
export function getRandomVectorInsideSphere(radius: number): THREE.Vector3 {
    const vector = new THREE.Vector3();
    vector.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    vector.normalize().multiplyScalar(Math.random() * radius);
    return vector;
}

/**
 * Radical inverse function for Halton/Hammersley sequences.
 * It generates a quasi-random value in [0, 1) for the given base and index.
 */
export function radicalInverse(base: number, index: number): number {
    let result = 0;
    let fraction = 1 / base;
    let i = index;

    while (i > 0) {
        result += (i % base) * fraction;
        i = Math.floor(i / base);
        fraction /= base;
    }

    return result;
}

/**
 * Generate a 2D Halton sequence of quasi-random samples in the unit square.
 * Returns a Float32Array in [x0, y0, x1, y1, ...] order for easy GPU uploads.
 */
export function generateHalton2D(count: number, out?: Float32Array, offset = 1): Float32Array {
    const samples = out ?? new Float32Array(count * 2);

    if (samples.length < count * 2) {
        throw new Error('generateHalton2D: output array is smaller than required.');
    }

    for (let i = 0; i < count; i++) {
        const index = offset + i;
        samples[i * 2] = radicalInverse(2, index);
        samples[i * 2 + 1] = radicalInverse(3, index);
    }

    return samples;
}