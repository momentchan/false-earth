import { GPUComputationRenderer } from "./GPUComputationRenderer";
import { WebGLRenderer, Texture, IUniform, ShaderMaterial, DataTexture } from "three";

export default class GPGPU {
    private gpuCompute: GPUComputationRenderer;
    private variables: Record<string, any>;

    constructor(renderer: WebGLRenderer, w: number = 512, h: number = 512) {
        this.gpuCompute = new GPUComputationRenderer(w, h, renderer);
        this.variables = {};
    }

    addVariable(name: string, data: Float32Array, simulationMat: ShaderMaterial) {
        const texture = this.gpuCompute.createTexture();
        (texture.image as { data: Float32Array }).data = data;

        const variable = this.gpuCompute.addVariableByMat(name, simulationMat, texture as unknown as DataTexture);
        this.variables[name] = variable;
        return variable;
    }

    getVariable(name: string) {
        return this.variables[name];
    }

    setVariableDependencies(variable: string, dependencies: string[]) {
        this.gpuCompute.setVariableDependencies(this.variables[variable], dependencies.map(key => this.variables[key]));
    }

    init() {
        this.gpuCompute.init();
    }

    compute() {
        this.gpuCompute.compute();
    }

    getUniform<T = any>(name: string, property: string): IUniform<T> {
        return (this.variables[name].material.uniforms[property]) as IUniform<T>;
    }

    setUniform(name: string, property: string, value: any) {
        this.getUniform(name, property).value = value;
    }

    getCurrentRenderTarget(name: string): Texture {
        return this.gpuCompute.getCurrentRenderTarget(this.variables[name]).texture;
    }
}


