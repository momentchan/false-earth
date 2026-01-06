import {
    Camera,
    ClampToEdgeWrapping,
    DataTexture,
    FloatType,
    Mesh,
    NearestFilter,
    PlaneGeometry,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    WebGLRenderer,
    WebGLRenderTarget,
    Texture,
    IUniform
} from 'three';

type Uniforms = { [uniform: string]: IUniform };

interface Variable {
    name: string;
    initialValueTexture: DataTexture;
    material: ShaderMaterial;
    dependencies: Variable[] | null;
    renderTargets: WebGLRenderTarget[];
    wrapS: number | null;
    wrapT: number | null;
    minFilter: number;
    magFilter: number;
}

class GPUComputationRenderer {

    private readonly sizeX: number;
    private readonly sizeY: number;
    private readonly renderer: WebGLRenderer;

    variables: Variable[] = [];
    currentTextureIndex: number = 0;

    private dataType: number = FloatType;

    private scene: Scene;
    private camera: Camera;
    private passThruUniforms: Uniforms;
    private passThruShader: ShaderMaterial;
    private mesh: Mesh;

    constructor(sizeX: number, sizeY: number, renderer: WebGLRenderer) {

        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.renderer = renderer;

        this.scene = new Scene();

        this.camera = new Camera();
        this.camera.position.z = 1;

        this.passThruUniforms = {
            passThruTexture: { value: null as unknown as Texture }
        } as Uniforms;

        this.passThruShader = this.createShaderMaterial(this.getPassThroughFragmentShader(), this.passThruUniforms);

        this.mesh = new Mesh(new PlaneGeometry(2, 2), this.passThruShader);
        this.scene.add(this.mesh);

    }

    setDataType(type: number) {
        this.dataType = type;
        return this;
    }

    addVariable(variableName: string, computeFragmentShader: string, initialValueTexture: DataTexture): Variable {

        const material = this.createShaderMaterial(computeFragmentShader);

        const variable: Variable = {
            name: variableName,
            initialValueTexture: initialValueTexture,
            material: material,
            dependencies: null,
            renderTargets: [],
            wrapS: null,
            wrapT: null,
            minFilter: NearestFilter,
            magFilter: NearestFilter
        };

        this.variables.push(variable);

        return variable;

    }

    addVariableByMat(variableName: string, material: ShaderMaterial, initialValueTexture: DataTexture): Variable {

        material.vertexShader = this.getPassThroughVertexShader();
        this.addResolutionDefine(material);

        const variable: Variable = {
            name: variableName,
            initialValueTexture: initialValueTexture,
            material: material,
            dependencies: null,
            renderTargets: [],
            wrapS: null,
            wrapT: null,
            minFilter: NearestFilter,
            magFilter: NearestFilter
        };

        this.variables.push(variable);

        return variable;

    }

    setVariableDependencies(variable: Variable, dependencies: Variable[]) {

        variable.dependencies = dependencies;

    }

    init(): string | null {

        if (this.renderer.capabilities.isWebGL2 === false && this.renderer.extensions.has('OES_texture_float') === false) {

            return 'No OES_texture_float support for float textures.';

        }

        if (this.renderer.capabilities.maxVertexTextures === 0) {

            return 'No support for vertex shader textures.';

        }

        for (let i = 0; i < this.variables.length; i++) {

            const variable = this.variables[i];

            // Creates rendertargets and initialize them with input texture
            variable.renderTargets[0] = this.createRenderTarget(this.sizeX, this.sizeY, variable.wrapS ?? undefined, variable.wrapT ?? undefined, variable.minFilter, variable.magFilter);
            variable.renderTargets[1] = this.createRenderTarget(this.sizeX, this.sizeY, variable.wrapS ?? undefined, variable.wrapT ?? undefined, variable.minFilter, variable.magFilter);
            this.renderTexture(variable.initialValueTexture, variable.renderTargets[0]);
            this.renderTexture(variable.initialValueTexture, variable.renderTargets[1]);

            // Adds dependencies uniforms to the ShaderMaterial
            const material = variable.material;
            const uniforms = material.uniforms as Uniforms;

            if (variable.dependencies !== null) {

                for (let d = 0; d < variable.dependencies.length; d++) {

                    const depVar = variable.dependencies[d];

                    if (depVar.name !== variable.name) {

                        // Checks if variable exists
                        let found = false;

                        for (let j = 0; j < this.variables.length; j++) {

                            if (depVar.name === this.variables[j].name) {

                                found = true;
                                break;

                            }

                        }

                        if (!found) {

                            return 'Variable dependency not found. Variable=' + variable.name + ', dependency=' + depVar.name;

                        }

                    }

                    uniforms[depVar.name] = { value: null as unknown as Texture } as IUniform;

                    material.fragmentShader = '\nuniform sampler2D ' + depVar.name + ';\n' + material.fragmentShader;

                }

            }

        }

        this.currentTextureIndex = 0;

        return null;

    }

    compute() {

        const currentTextureIndex = this.currentTextureIndex;
        const nextTextureIndex = this.currentTextureIndex === 0 ? 1 : 0;

        for (let i = 0, il = this.variables.length; i < il; i++) {

            const variable = this.variables[i];

            // Sets texture dependencies uniforms
            if (variable.dependencies !== null) {

                const uniforms = variable.material.uniforms as Uniforms;

                for (let d = 0, dl = variable.dependencies.length; d < dl; d++) {

                    const depVar = variable.dependencies[d];

                    uniforms[depVar.name].value = depVar.renderTargets[currentTextureIndex].texture;

                }

            }

            // Performs the computation for this variable
            this.doRenderTarget(variable.material, variable.renderTargets[nextTextureIndex]);

        }

        this.currentTextureIndex = nextTextureIndex;

    }

    getCurrentRenderTarget(variable: Variable) {

        return variable.renderTargets[this.currentTextureIndex];

    }

    getAlternateRenderTarget(variable: Variable) {

        return variable.renderTargets[this.currentTextureIndex === 0 ? 1 : 0];

    }

    dispose() {

        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

        const variables = this.variables;

        for (let i = 0; i < variables.length; i++) {

            const variable = variables[i];

            if (variable.initialValueTexture) variable.initialValueTexture.dispose();

            const renderTargets = variable.renderTargets;

            for (let j = 0; j < renderTargets.length; j++) {

                const renderTarget = renderTargets[j];
                renderTarget.dispose();

            }

        }

    }

    addResolutionDefine(materialShader: ShaderMaterial) {

        materialShader.defines = materialShader.defines || {};
        materialShader.defines.resolution = 'vec2( ' + this.sizeX.toFixed(1) + ', ' + this.sizeY.toFixed(1) + ' )';

    }

    createShaderMaterial(computeFragmentShader: string, uniforms?: Uniforms) {

        uniforms = uniforms || {} as Uniforms;

        const material = new ShaderMaterial({
            name: 'GPUComputationShader',
            uniforms: uniforms,
            vertexShader: this.getPassThroughVertexShader(),
            fragmentShader: computeFragmentShader
        });

        this.addResolutionDefine(material);

        return material;

    }

    createRenderTarget(sizeXTexture?: number, sizeYTexture?: number, wrapS?: number, wrapT?: number, minFilter?: number, magFilter?: number) {

        sizeXTexture = sizeXTexture || this.sizeX;
        sizeYTexture = sizeYTexture || this.sizeY;

        wrapS = wrapS || ClampToEdgeWrapping;
        wrapT = wrapT || ClampToEdgeWrapping;

        minFilter = minFilter || NearestFilter;
        magFilter = magFilter || NearestFilter;

        const renderTarget = new WebGLRenderTarget(sizeXTexture, sizeYTexture, {
            wrapS: wrapS,
            wrapT: wrapT,
            minFilter: minFilter,
            magFilter: magFilter,
            format: RGBAFormat,
            type: this.dataType,
            depthBuffer: false
        });

        return renderTarget;

    }

    createTexture() {

        const data = new Float32Array(this.sizeX * this.sizeY * 4);
        const texture = new DataTexture(data, this.sizeX, this.sizeY, RGBAFormat, FloatType);
        texture.needsUpdate = true;
        return texture;

    }

    renderTexture(input: Texture, output: WebGLRenderTarget) {

        // Takes a texture, and render out in rendertarget
        // input = Texture
        // output = RenderTarget

        (this.passThruUniforms.passThruTexture as IUniform).value = input;

        this.doRenderTarget(this.passThruShader, output);

        (this.passThruUniforms.passThruTexture as IUniform).value = null;

    }

    doRenderTarget(material: ShaderMaterial, output: WebGLRenderTarget) {

        const currentRenderTarget = this.renderer.getRenderTarget();

        const currentXrEnabled = this.renderer.xr.enabled;
        const currentShadowAutoUpdate = this.renderer.shadowMap.autoUpdate;

        this.renderer.xr.enabled = false; // Avoid camera modification
        this.renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
        this.mesh.material = material;
        this.renderer.setRenderTarget(output);
        this.renderer.render(this.scene, this.camera);
        this.mesh.material = this.passThruShader;

        this.renderer.xr.enabled = currentXrEnabled;
        this.renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

        this.renderer.setRenderTarget(currentRenderTarget);

    }

    private getPassThroughVertexShader() {

        return 'void main()\t{\n' +
            '\n' +
            '\tgl_Position = vec4( position, 1.0 );\n' +
            '\n' +
            '}\n';

    }

    private getPassThroughFragmentShader() {

        return 'uniform sampler2D passThruTexture;\n' +
            '\n' +
            'void main() {\n' +
            '\n' +
            '\tvec2 uv = gl_FragCoord.xy / resolution.xy;\n' +
            '\n' +
            '\tgl_FragColor = texture2D( passThruTexture, uv );\n' +
            '\n' +
            '}\n';

    }

}

export { GPUComputationRenderer };


