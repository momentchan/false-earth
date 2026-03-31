<!-- wp:video {"id":113279} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/false-earth_reel-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p><a href="https://false-earth.mingjyunhung.com/">Live Demo</a></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="https://github.com/momentchan/false-earth">Source Code</a></p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2 class="wp-block-heading">Intro</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><em>False Earth</em> is an interactive WebGPU project and the sequel to my first work, <em>Drift</em>.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>In <em><a href="https://drift-co0.pages.dev/">Drift</a></em>, I explored a storytelling experience about an astronaut lost in space, drifting while longing to return home. I implemented an AI-generated diary to reflect his mental state—the loneliness, the depression, and memories of the time he spent with his family.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113215} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/drift_reel-v2-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p>Now, the story continues. The astronaut has landed on a new planet. It looks like Earth, but it feels strange and "false." The world is covered with a field of infinite grass that seems to never end. When he moves, cosmic beams fall from the sky, and flowers bloom and die instantly.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":113476,"width":"838px","height":"auto","aspectRatio":"1.6064699715441066","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large is-resized"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/image-27-edited.png" alt="" class="wp-image-113476" style="aspect-ratio:1.6064699715441066;width:838px;height:auto"/></figure>
<!-- /wp:image -->

<!-- wp:heading -->
<h2 class="wp-block-heading">The WebGL Prototypes</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Before diving into <em>False Earth</em>, I ran several experiments to see if the web could handle my vision.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong><a href="https://vat-flowers.pages.dev/">Vertex Animation Texture (VAT) </a></strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Rendering thousands of animated vertices was a heavy task for the CPU. To solve this, I moved the work to the GPU using instancing and VAT—a technique where animation data (positions and normals) was baked into a texture. By replaying this data in the shader, I offloaded the work from the CPU to the GPU. In this demo, I created a scene where hundreds of flowers bloomed, grew, and died as the user moved the mouse.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113217} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/vat_flowers.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong><a href="https://procedural-grass.pages.dev/" data-type="link" data-id="https://procedural-grass.pages.dev/">Procedural Grass </a></strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Realistic grass is the soul of <em>False Earth</em>. While many web projects already feature beautiful grass, I wanted blades that could react realistically to lighting and interaction. Inspired by the <em>Ghost of Tsushima</em> team's <a href="https://gdcvault.com/play/1027033/Advanced-Graphics-Summit-Procedural-Grass">technical breakdown</a>, I built a procedural system that gave me total control over every blade's shape, color, and movement.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113219} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/procedural_grass_demo-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The WebGL Limit </strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>However, I quickly hit a performance bottleneck. As I increased the number of flowers and grass blades, the frame rate dropped dramatically. Beyond raw draw calls, I struggled with the limitations of GPGPU in WebGL—handling framebuffer object (FBO) read/write operations for complex GPU computations was clunky and counter-intuitive.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>I realized that to achieve the scale I had in mind, I had to move to WebGPU. This was my first time using WebGPU and TSL (Three.js Shading Language), and I was amazed by how it simplified everything. Instead of FBO workarounds, I could use <strong>storage buffers</strong>—read/write GPU memory accessible from both compute and render passes—to manage data directly on the GPU. This shift allowed me to focus on the logic of the world rather than fighting the API.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2 class="wp-block-heading">The Infinite Grass Field</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The Spatial Strategy</strong> </h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Practically, it is impossible to generate enough individual blades to cover an entire world. To create the illusion of vastness, I divided the field into a <strong>grid system</strong>. As the camera crosses a grid boundary, the entire vertex group snaps forward. This <strong>infinite scrolling</strong> trick keeps the grass surrounding the character no matter how far they travel. I used world position as a <strong>deterministic seed</strong> to generate parameters for each blade's shape, color, and local elevation, which stays consistent across every grid snap.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113290} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-snapping-1080p-1.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The GPU Data Pipeline</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>In WebGPU, I stored the parameters for each blade in a structured <strong>storage buffer</strong>, computed the data in a compute shader, and passed it into the rendering pipeline. Each blade's <strong>data package</strong> is tightly packed into four <code>vec4</code> values (64 bytes per instance) for GPU-friendly alignment:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>Position and Type</strong>: World position (<code>xyz</code>) and a blade type index (<code>w</code>) for shape variation.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Shape Parameters</strong>: Randomized width, height, bend curvature, and wind strength.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Rotation and Seeds</strong>: Pre-computed sine/cosine for facing rotation, plus clump and per-blade hash seeds for color and sway variation.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Compressed Normal and Interaction</strong>: Terrain normal stored as only two components (<code>x</code>, <code>z</code>)—the <code>y</code> component is reconstructed in the vertex shader via <code>sqrt(1 − x² − z²)</code>, halving normal storage cost. The remaining two floats carry the character push vector.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>To populate these fields with natural variation, I adopted a <strong>Voronoi clustering</strong> approach. Each blade finds its two nearest Voronoi centers and <strong>blends</strong> their parameters (height, width, bend) based on the distance to each center. This prevents hard seams at clump boundaries—blades near an edge transition gradually between their neighbors' properties rather than snapping abruptly.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113387} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-voronoi-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>Vertex Deformation</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>To bring the infinite field to life, I focused on making simple plane geometries behave like organic matter. The deformation logic in the vertex shader is a multi-layered displacement stack that builds up progressively:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Bending &amp; Sway</strong></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>The core shape of each blade is defined by a <strong>cubic Bézier curve</strong> with four control points. Each vertex has a parameter <code>t</code> that runs from 0 at the root to 1 at the tip, which is used to evaluate the curve. Two inner control points (<code>p1</code>, <code>p2</code>) control how the blade bends:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Cubic Bézier: 4 control points define the blade's curvature
const spine = bezier3(p0, p1, p2, p3, t);
const tangent = normalize(bezier3Tangent(p0, p1, p2, p3, t));
const side = normalize(cross(vec3(0.0, 0.0, 1.0), tangent));</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113391} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-bending.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p>Wind displaces the control points directly, pushing mid-points gently and the tip more aggressively. This bends the entire blade in a natural arc rather than applying a flat offset:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Wind pushes control points proportionally (root stable, tip strongest)
const p1Pushed = p1.add(windDir.mul(windScale.mul(height).mul(0.08)));
const p2Pushed = p2.add(windDir.mul(windScale.mul(height).mul(0.15)));
const p3Pushed = p3.add(windDir.mul(windScale.mul(height).mul(0.25)));</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>To add life to the field, I introduced a <strong>dual-frequency sine-wave sway</strong> on top of the Bézier spine: a low-frequency oscillation for the main sway and a high-frequency flutter for fine detail. Both increase in intensity toward the tip, and a slow "gust" envelope modulates the overall amplitude so the field appears to breathe. To maintain visual stability and reduce flicker at a distance, I faded the wind intensity for distant blades using a distance-based falloff.</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Only affects vertices near the tip
const topSwayMask = smoothstep(float(0.5), float(1.0), t);

// Gust envelope — slow breathing that modulates overall amplitude
const gust = float(0.65).add(
  float(0.35).mul(sin(uTime.mul(0.35).add(seed.mul(6.28318))))
);

// Low freq (main sway) + high freq (small flutter)
const low  = sin(uTime.mul(baseFreq).add(phase).add(t.mul(2.2)));
const high = sin(uTime.mul(baseFreq.mul(5.0)).add(phase.mul(1.7)).add(t.mul(5.0)));

// Gust drives the low-frequency sway, high-freq stays constant
const swayLow  = amp.mul(gust).mul(uWindSwayStrength);
const swayHigh = amp.mul(0.8).mul(uWindSwayStrength);

const swayAmount = low.mul(swayLow).add(high.mul(swayHigh));
return side.mul(swayAmount).mul(topSwayMask);</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113393} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-sway.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p><strong>Terrain Alignment</strong></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>To keep blades flush with the ground, I computed a rotation from the local up-vector <code>(0, 1, 0)</code> to the terrain normal using a cross-product axis and <code>acos(dot)</code> angle. By unpacking the terrain normal from the storage buffer, I kept the grass, flowers, and character aligned with the same elevation data.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>The "Thick" Illusion</strong></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>The blades are flat 2D planes, so I applied a <strong>view-dependent tilt</strong> to make them appear thicker when viewed from the side. The tilt pushes vertices outward along the face normal, scaled by how edge-on the blade is to the camera. An edge mask (stronger on the sides) combined with a center mask (stronger at the base) prevents the effect from distorting the tip or adding bulk where it is not needed.</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// How edge-on is this blade to the camera?
const camDirLocalY = dot(camDirW, sideW);

// Edge mask: stronger on the sides when viewed head-on
const edgeMask = uvCoords.x.sub(0.5).mul(camDirLocalY);
edgeMask.mulAssign(pow(abs(camDirLocalY), float(1.2)));

// Center mask: stronger at the base, weaker at the tip
const centerMask = pow(float(1.0).sub(t), float(0.5)).mul(pow(t.add(0.05), float(0.33)));

// Push vertices outward along the face normal
return posObj.add(normalXZ.mul(thicknessStrength.mul(edgeMask).mul(centerMask)));</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113395} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-view-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>Interaction</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>For push interaction, I passed the character's position into the compute shader and gave each blade an <strong>outward push vector</strong>. The radial strength falls off from the character, and the displacement along the blade is weighted by <strong>t²</strong> so it is strongest at the tip and zero at the root. On top of the lateral push, the blade's height is <strong>flattened</strong> toward the ground so blades don't just slide sideways—they compress down as the character passes over them:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Compute shader: radial falloff from character
const pushFactor = smoothstep(pushRadius, float(0.0), charDist);
const pushVector = safeCharDir.mul(pushFactor).mul(pushAmount);

// Vertex shader: push outward + flatten height
lpos = vec3(
  lpos.x.add(pushVector.x.mul(pow(t, float(2.0)))),
  lpos.y.mul(oneMinus(pushLen.mul(flattenAmount).mul(t))),
  lpos.z.add(pushVector.y.mul(pow(t, float(2.0))))
);</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113400} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-interaction-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p>In <em>False Earth</em>, cosmic beams fall from the sky and send energy waves across the ground. I built a <strong>wave system</strong> that stores each wave's position, start time, maximum radius, and lifetime in a storage buffer. Multiple waves can be active simultaneously, and the shader loops through all of them per blade.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Each wave expands as a <strong>ring-shaped wavefront</strong> rather than a filled circle. The ring width is 20% of the maximum radius, and a <code>smoothstep</code> creates a soft falloff from the wavefront edge. A separate fade curve ramps the intensity up at birth and down as the wave expires, so the ring appears, swells outward, and dissolves naturally.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>The same wave strength drives both the <strong>emissive glow</strong> and the <strong>outward vertex push</strong>, so the visual ring and the physical ripple through the grass stay perfectly synchronized:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Ring shape: distance from the expanding wavefront
const distFromWavefront = abs(dist.sub(currentRadius));
const ringWidth = maxRadius.mul(0.2);
const shape = smoothstep(ringWidth, float(0.0), distFromWavefront);

// Lifetime fade: ramp up at birth, fade out before death
const fade = smoothstep(float(1.0), float(0.5), progress)
            .mul(smoothstep(float(0.0), float(0.1), progress));

const combinedStrength = shape.mul(fade);

// Same strength drives both glow (scalar) and push (vector)
result.strength += combinedStrength;
result.force    += pushDir.mul(combinedStrength);</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113403} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-wave-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>Procedural Shading</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Each blade is composed of a plane without any texture. To achieve a high-fidelity look while keeping the performance overhead low, I focused on several procedural shading techniques:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>Structural Normals</strong>: A real grass blade has a raised midrib down the center and thin rims at the edges. I faked this on a flat plane by bending the shading normal across the blade's width using the horizontal UV, creating a midrib inflection at the center and lifted rims near the edges. The result is blended into the geometric normal at low strength so the blade catches light as if it had real cross-sectional curvature.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Procedural Variation</strong>: For the colors, I added a small amount of <strong>randomness</strong> based on the clump and blade seeds, ensuring each blade had subtle differences.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Performance-First Shading</strong>: For performance, I applied <strong>ambient occlusion (AO)</strong> based solely on the height of the blade, darkening the roots to create depth.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Atmospheric Depth</strong>: Finally, I added a <strong>desaturation effect</strong> for distant blades to create atmospheric perspective and depth.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:video {"id":113413} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-grass-render-1080p-1.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading -->
<h2 class="wp-block-heading">VAT Flowers</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>In <em>False Earth</em>, flowers bloom dynamically as energy waves expand across the terrain. To handle this efficiently, I moved the spawning logic entirely into a compute shader, assigning each instance a unique position, lifetime, and seed.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The Circular Spawning System</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>To keep flowers spawning without costly CPU readbacks, I implemented a <strong>circular buffer</strong> backed by a storage index.</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>Atomic Indexing</strong>: Each new flower increments a global index via <code>atomicAdd</code>.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Automatic Recycling</strong>: The index wraps with modulo against the maximum instance count, recycling slots so the lifecycle stays smooth even during heavy interaction.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Each spawn atomically claims the next slot, wrapping to reuse old instances
const headIndex = atomicAdd(spawnStorage.get("index"), uint(1)).mod(uint(maxCount));
const instance = vatData.element(headIndex);</code></pre>
<!-- /wp:code -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The Lifecycle State Machine</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Every active flower moves through a state machine driven by normalized age (<code>progress = age / lifetime</code>). I mapped each stage to VAT playback progress using phase boundaries (<code>p1</code>, <code>p2</code>, <code>p3</code>) derived from per-instance seed variation:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>Delay</strong> [0, p1): The dormant period before growth begins. VAT frame stays at 0.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Grow</strong> [p1, p2): The blooming sequence where VAT progress scales from 0 to 1.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Keep</strong> [p2, p3): The flower holds the final animated frame (1.0) for its peak duration.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Die</strong> [p3, 1.0]: Progress reverses linearly from 1.0 back toward 0, so the flower withers and shrinks.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:code -->
<pre class="wp-block-code"><code>If(progress.lessThan(p1), () =&gt; {
    currentFrame.assign(0.0);
}).ElseIf(progress.lessThan(p2), () =&gt; {
    currentFrame.assign(progress.sub(p1).div(p2.sub(p1)));
}).ElseIf(progress.lessThan(p3), () =&gt; {
    currentFrame.assign(1.0);
}).Else(() =&gt; {
    const die = progress.sub(p3).div(float(1.0).sub(p3));
    currentFrame.assign(float(1.0).sub(die));
});</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>When the sequence finishes, the instance is marked inactive and its slot is free for the next spawn.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":113419,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/Group-1-1-800x473.png" alt="" class="wp-image-113419"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>VAT Rendering</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>In the vertex shader, VAT textures are sampled using the computed frame index to reconstruct animated positions. Per-instance size variation, derived from each instance's seed, reduces visible repetition across the field.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Similar to the grass, I aligned each flower to the terrain surface, applied wind effects, and calculated an interaction force based on proximity to the character. Although petals, stems, and leaves share the same mesh, I encoded a material mask into the vertex color R channel during preprocessing: <code>0.0</code> for stems, <code>0.5</code> for petals, and <code>1.0</code> for leaves. In the fragment shader, a simple <code>step(abs(value − threshold), 0.05)</code> recovers each mask, allowing me to color and shade all three materials separately within a single draw call.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":113422,"width":"840px","height":"auto","aspectRatio":"1.3769834866333173","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large is-resized"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/image-29-800x581.png" alt="" class="wp-image-113422" style="aspect-ratio:1.3769834866333173;width:840px;height:auto"/><figcaption class="wp-element-caption">Vertex color mask debug view — Blue: Stems (R = 0.0), Red: Petals (R = 0.5), Green: Leaves (R = 1.0)</figcaption></figure>
<!-- /wp:image -->

<!-- wp:paragraph -->
<p>For the final touch, I combined a <strong>Fresnel rim glow</strong> with a <strong>traveling wave</strong> that sweeps across each petal's surface over time. The wave position is driven by a <code>fract(time)</code> offset per instance, so every flower pulses at its own rhythm. Together, these give the flora a mystical, ethereal quality.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113424} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-flower-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading -->
<h2 class="wp-block-heading">Optimization</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The Indirect Draw Architecture</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Even with much of the work on the GPU, drawing millions of blades remains costly. A common optimization is <strong>frustum culling</strong>—submitting only geometry visible to the camera. Because blade positions are generated on the GPU, traditional CPU-side culling is not available. <strong>WebGPU indirect drawing</strong> addresses this limitation. The same architecture described below is reused for both the grass field and the VAT flowers.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Indirect draw</strong> allows the GPU to set draw counts for the pipeline by reading an indirect buffer. WebGPU defines this buffer as a <code>Uint32Array</code> with five fields:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><code>vertexCount</code>: Number of vertices per instance.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><code>instanceCount</code>: Number of instances to draw (updated atomically).</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><code>firstVertex</code>: Offset in the vertex buffer.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><code>firstInstance</code>: Offset in the instance buffer.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><code>offset</code>: Base instance offset.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>In Three.js, connect the geometry to that buffer with a single call:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>geometry.setIndirect(drawBuffer)</code></pre>
<!-- /wp:code -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>GPU-Driven Culling &amp; Filtering</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>With the indirect buffer in place, a compute pass can now decide which instances actually get drawn. At the start of every frame, a small reset pass sets <code>instanceCount</code> back to zero via <code>atomicStore</code>. Then, the main compute pass checks each blade's visibility and appends each visible instance's index into a <code>visibleIndicesBuffer</code> while incrementing <code>instanceCount</code> atomically. Blades very close to the camera are always included to prevent nearby grass from popping out due to frustum-plane edge cases:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Always include blades near the camera
const isCloseEnough = abs(diff.x).add(abs(diff.z)).lessThan(float(3));
const isVisible = isCloseEnough.or(performCulling(worldPos));

If(isVisible, () =&gt; {
    const slot = atomicAdd(drawStorage.get("instanceCount"), uint(1));
    visibleIndicesBuffer.element(slot).assign(uint(instanceIndex));
});</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>Then, in the vertex shader, <code>visibleIndicesBuffer</code> is read to resolve the real instance index:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>const trueIndex = visibleIndicesBuffer.element(instanceIndex);
const data = grassData.element(trueIndex);</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>Filtering before the draw pass limits vertex shading to on-screen instances. With blades spread around the camera, a ~75° horizontal field of view covers roughly one-fifth of the full 360° surroundings—meaning around 80% of instances can be culled before they ever reach the vertex shader.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113441} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-culling-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>GPU-Driven LOD</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>I reused the same indirect pattern for <strong>level of detail (LOD)</strong>. Instead of one global draw buffer, I used several buffers—one per mesh density. The configuration defines three tiers:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>High detail</strong> (15 segments): 0–5 m from camera</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Medium detail</strong> (5 segments): 5–20 m</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Low detail</strong> (2 segments): 20 m to horizon</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>The compute pass measures each blade's distance to the camera and routes the instance index into the appropriate LOD bucket. Because the far ring covers vastly more area than the near ring, the majority of visible blades end up in the lowest tier (2 segments instead of 15), drastically reducing the total triangle count while keeping nearby blades detailed.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113443} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-lod-1080p.mp4" playsinline></video><figcaption class="wp-element-caption">LOD debug view — Red: high detail, Green: medium, Blue: low</figcaption></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p>To soften LOD boundaries, I apply a <strong>per-instance noise jitter</strong> to the distance test, which breaks the hard circular banding that would otherwise appear at transitions:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>// Jitter the distance test to soften LOD transition rings
const noiseSeed = fract(float(instanceIndex).mul(0.12345)).mul(2.0).sub(1.0);
const noisyDist = distToCamera.add(distToCamera.mul(noiseScale).mul(noiseSeed));

If(noisyDist.greaterThanEqual(minDist).and(noisyDist.lessThan(maxDist)), () =&gt; {
    const lodIndex = atomicAdd(drawStorage.get("instanceCount"), uint(1));
    indices.element(lodIndex).assign(uint(instanceIndex));
});</code></pre>
<!-- /wp:code -->

<!-- wp:video {"id":113437} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-lod-noise-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>Non-blocking Startup: Async Compilation</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Shader compilation can block the main thread and freeze the UI during load. For <em>False Earth</em>, I wanted the introduction to stay responsive, so I wrapped every heavy component (grass, flowers, character) in an <code>AsyncCompile</code> wrapper that uses Three.js's <code>compileAsync</code> and manages a three-stage pipeline:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><strong>Stage 1 — Compile</strong>: All components call WebGPU's <code>compileAsync</code> in parallel, so shaders build simultaneously without blocking the main thread. As a safety net, each compile races against a timeout—on some mobile GPUs, <code>compileAsync</code> can take unexpectedly long or stall entirely. If the timeout fires, the component skips async compilation and renders immediately, accepting a small first-frame stutter rather than leaving the user stuck on a loading screen.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Stage 2 — Queue</strong>: Once compiled, each component joins a global FIFO queue and waits for its turn. Only one component proceeds at a time—rendering all of them simultaneously on their first frame would overwhelm the driver and cause a massive frame spike.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Stage 3 — Upload</strong>: The active component becomes visible and renders for the first time, which is the expensive frame—the GPU driver transfers its textures, geometry, and buffers into VRAM. Since there is no completion signal, the component holds the slot for a fixed number of frames as a buffer before releasing it to the next component.</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>The result is a smooth <em>idle → compiled → uploading → done</em> state machine per component, with the loading animation running uninterrupted throughout.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":113507,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/Group-14-1-800x356.png" alt="" class="wp-image-113507"/><figcaption class="wp-element-caption">AsyncCompile pipeline — components compile in parallel, then upload to VRAM one at a time through a FIFO queue</figcaption></figure>
<!-- /wp:image -->

<!-- wp:heading -->
<h2 class="wp-block-heading">The Final Polish</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading"><strong>The Post-Processing</strong></h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>In <em>False Earth</em>, I implemented a first-person (FPV) mode so visitors can experience the world from the astronaut's perspective. The post-processing chain builds up layer by layer: starting from the raw scene, I apply <strong>chromatic aberration</strong> (sampling R, G, and B at slightly offset UVs to simulate lens fringing), then a <strong>vignette</strong> with a cool-blue tint to suggest a helmet visor, then <strong>bloom</strong> for emissive glow, and finally <strong>tone mapping</strong> to control overall exposure.</p>
<!-- /wp:paragraph -->

<!-- wp:video {"id":113487} -->
<figure class="wp-block-video"><video autoplay loop muted src="https://tympanus.net/codrops/wp-content/uploads/2026/03/demo-postprocessing-1080p.mp4" playsinline></video></figure>
<!-- /wp:video -->

<!-- wp:paragraph -->
<p>In TSL, the entire chain is wired as a node graph rather than a fixed sequence of fullscreen passes. Color and depth are exposed as nodes from the scene pass, and each effect plugs in as a transform on those nodes:</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>const scenePass = pass(scene, camera);
const colorTex = scenePass.getTextureNode('output');
const depthTex = scenePass.getViewZNode();

// Each effect transforms the node chain
let finalNode = applyAberration(colorTex);
finalNode = applyVignette(finalNode);
finalNode = finalNode.add(bloom(finalNode));

const pp = new THREE.PostProcessing(renderer);
pp.outputNode = finalNode;</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph -->
<p>I also added depth of field (DOF) to blur distant geometry in a cinematic way. A side effect is that thin, emissive elements such as the cosmic beam were blurred as well, which softened their sharp, high-energy appearance.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>To correct this, I render beams in a separate <code>beamScene</code>. In post-processing, I compare depth from the beam pass with the main scene depth and use the difference to composite occlusion: beams remain sharp where they should read as foreground, while still occluding correctly behind terrain.</p>
<!-- /wp:paragraph -->

<!-- wp:code -->
<pre class="wp-block-code"><code>const depthDiff = beamDepth.sub(sceneDepth);
const beamOcclusion = smoothstep(float(0), float(10), depthDiff);
finalNode = finalNode.add(beamColor.mul(beamOcclusion));</code></pre>
<!-- /wp:code -->

<!-- wp:group {"style":{"border":{"radius":{"topLeft":"0px","topRight":"0px","bottomLeft":"0px","bottomRight":"0px"},"width":"0px","style":"none"},"dimensions":{"minHeight":"0px"},"spacing":{"blockGap":"var:preset|spacing|20"}},"layout":{"type":"grid","columnCount":2,"minimumColumnWidth":null}} -->
<div class="wp-block-group" style="border-style:none;border-width:0px;border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;min-height:0px"><!-- wp:image {"id":113495,"sizeSlug":"large","linkDestination":"none","style":{"layout":{"columnSpan":1,"rowSpan":1},"border":{"radius":{"topLeft":"0px","topRight":"0px","bottomLeft":"0px","bottomRight":"0px"}}}} -->
<figure class="wp-block-image size-large has-custom-border"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/螢幕擷取畫面-2026-03-31-131008-1-800x519.png" alt="" class="wp-image-113495"/><figcaption class="wp-element-caption">Main scene — color output</figcaption></figure>
<!-- /wp:image -->

<!-- wp:image {"id":113496,"sizeSlug":"large","linkDestination":"none","style":{"layout":{"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/螢幕擷取畫面-2026-03-31-131020-1-800x519.png" alt="" class="wp-image-113496"/><figcaption class="wp-element-caption">Beam scene — color output (rendered separately)</figcaption></figure>
<!-- /wp:image -->

<!-- wp:image {"id":113497,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/螢幕擷取畫面-2026-03-31-131015-1-800x519.png" alt="" class="wp-image-113497"/><figcaption class="wp-element-caption">Main scene — depth buffer (white = near, black = far)</figcaption></figure>
<!-- /wp:image -->

<!-- wp:image {"id":113498,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/螢幕擷取畫面-2026-03-31-131029-1-800x519.png" alt="" class="wp-image-113498"/><figcaption class="wp-element-caption">Beam scene — depth buffer (used for occlusion test)</figcaption></figure>
<!-- /wp:image --></div>
<!-- /wp:group -->

<!-- wp:image {"id":113502,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://tympanus.net/codrops/wp-content/uploads/2026/03/螢幕擷取畫面-2026-03-31-131034-1-1-800x519.png" alt="" class="wp-image-113502"/><figcaption class="wp-element-caption">Final composite — beams blended with depth-aware occlusion</figcaption></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">Syncing Sound to Motion</h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Sound grounds the character's presence in the scene. Footsteps are triggered when the character moves on the grass. Trigger timing is tied to the locomotion animation so playback stays aligned at both walk and run speeds.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>I use five footstep samples with a ±200-cent pitch randomization per trigger to avoid obvious repetition. Volume attenuates with distance to the camera using the Web Audio API's spatial model. The implementation creates short-lived <code>BufferSource</code> nodes directly on the <code>AudioContext</code>, which keeps CPU overhead modest even with many concurrent one-shots.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2 class="wp-block-heading">Conclusion</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>I started my career as an interactive developer for physical digital art installations. Years ago, when I first encountered Three.js, I was blown away by how easily web graphics allowed people to interact across different platforms.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>The transition from WebGL to WebGPU is a massive leap in that same direction. Compute shaders, indirect drawing, and storage buffers gave me the tools to render over a million grass blades, drive flower lifecycles entirely on the GPU, and keep everything interactive at real-time frame rates—all inside a browser. It has narrowed the gap between the web and AAA game engines in a way that felt unimaginable when I started.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>For me, <em>False Earth</em> is only one step in learning what I can build when I move beyond the traditional constraints I used to work within. As web graphics continue to advance, I am looking forward to exploring even more immersive storytelling and creating digital experiences that feel more alive, responsive, and emotionally grounded.</p>
<!-- /wp:paragraph -->