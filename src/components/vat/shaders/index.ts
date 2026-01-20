import vat from './vat.glsl'

export const VAT_VERTEX_SHADER = /* glsl */`
varying vec2 vUv;

${vat}

void main() {
  vec3 vatPos = VAT_pos(uFrame);
  vec3 basePos = position;

  vec3 position =(basePos + vatPos);

  csm_Position = position;
  csm_Normal = VAT_nrm(uFrame);
  vUv = uv;
  vUv1 = uv1;
  vColor = color.rgb;
}
`

export const VAT_FRAGMENT_SHADER = /* glsl */`
varying vec2 vUv1;
void main() {
  csm_FragColor = vec4(vUv1, 0.0, 1.0);
  // Material handles all color/rendering
}
`
