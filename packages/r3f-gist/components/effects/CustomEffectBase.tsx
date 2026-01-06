import { Effect } from 'postprocessing';

interface CustomEffectUniforms {
    [key: string]: { value: any };
}

interface CustomEffectBaseOptions {
    fragmentShader?: string | null;
    childUniforms?: Map<string, { value: any }>;
    vertexShader?: string | null;
    defines?: Record<string, any>;
    [key: string]: any;
}

/**
 * CustomEffectBase - Base class for creating custom post-processing effects
 * Extends the postprocessing Effect class with common utilities
 */
export default class CustomEffectBase extends Effect {
    constructor(
        name: string,
        options: CustomEffectBaseOptions = {}
    ) {
        const {
            fragmentShader = null,
            childUniforms = new Map(),
            vertexShader = null,
            defines = {},
            ...otherOptions
        } = options;

        const defaultFragmentShader = /* glsl */`
            void mainImage(const in vec4 inputColor, in vec2 uv, out vec4 outputColor)
            {
                outputColor = vec4(uv, .0, 1.0);
            }
        `;

        const baseUniforms = new Map([
            ['time', { value: 0 }],
            ['mousePos', { value: [0, 0] }],
            ['mouseDown', { value: -1 }],
        ]);

        super(
            name,
            fragmentShader || defaultFragmentShader,
            {
                uniforms: new Map([...baseUniforms, ...childUniforms]),
                defines: new Map(Object.entries(defines)),
                vertexShader: vertexShader || undefined,
                ...otherOptions
            }
        );
    }

    /**
     * Update effect uniforms - called every frame
     */
    update(renderer: any, inputBuffer: any, deltaTime: number): void {
        if (this.uniforms.has('time')) {
            this.uniforms.get('time')!.value += deltaTime;
        }
    }

    /**
     * Set a uniform value safely
     */
    setUniform(name: string, value: any): void {
        if (this.uniforms.has(name)) {
            this.uniforms.get(name)!.value = value;
        } else {
            console.warn(`CustomEffectBase: Uniform "${name}" does not exist.`);
        }
    }

    /**
     * Set normalized mouse position (-1 to 1)
     */
    setMousePos(x: number, y: number): void {
        // Normalize mouse coordinates to [-1, 1]
        const nx = (x / window.innerWidth) * 2 - 1;
        const ny = -((y / window.innerHeight) * 2 - 1); // Flip Y-axis
        this.setUniform('mousePos', [nx, ny]);
    }

    /**
     * Set mouse down state
     */
    setMouseDown(down: boolean | number): void {
        this.setUniform('mouseDown', down ? 1 : -1);
    }

    /**
     * Get uniform value
     */
    getUniform(name: string): any {
        return this.uniforms.has(name) ? this.uniforms.get(name)?.value : undefined;
    }

    /**
     * Check if uniform exists
     */
    hasUniform(name: string): boolean {
        return this.uniforms.has(name);
    }
}
