# SMAA shader assets

Source: Three.js **r180**, MIT licensed:

- https://github.com/mrdoob/three.js/blob/r180/examples/jsm/shaders/SMAAShader.js
- https://github.com/mrdoob/three.js/blob/r180/examples/jsm/postprocessing/SMAAPass.js

The shader is SMAA 1x Medium, color-edge detection, ported from SMAA v2.8.
`SMAAShader.mjs` wraps the upstream shader objects in `createSMAAShaders(Vector2)`
so the host supplies uniform vectors without loading another Three.js build.
GLSL is unchanged. `area.png` and `search.png` are decoded from the upstream
SMAAPass's embedded PNG data URLs. No CDN or network access is used at runtime.

Three.js and the upstream SMAA license notices are included alongside these files.
Upstream SMAA: https://github.com/iryoku/smaa

The local controller processes a display-encoded framebuffer copy, using the
upstream blend shader's gamma-aware blending. It does not substitute map materials
or run another output/tone-mapping transform on the copied image.
