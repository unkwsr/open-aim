import {
  BackSide, BufferAttribute, BufferGeometry, Color, DataTexture,
  EquirectangularReflectionMapping, FloatType, LinearFilter, LinearSRGBColorSpace,
  Mesh, MeshBasicMaterial, RepeatWrapping, RGBAFormat
} from '/studio/vendor/three.module.js';

export function isSigilSkin(id) {
  return /^vct-2026-sigil-(standard|purple-red|pacific|americas|green)(-mvp)?$/.test(id);
}

// The supplied Radiance exports are RLE-encoded, top-down, equirectangular RGBE images.
export function decodeSigilEnvironment(buffer) {
  const bytes = new Uint8Array(buffer);
  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  const size = /\n-Y (\d+) \+X (\d+)\n/.exec(header);
  if (!size || !header.includes('FORMAT=32-bit_rle_rgbe')) throw Error('Invalid Sigil HDR header');
  const height = Number(size[1]);
  const width = Number(size[2]);
  const channels = new Uint8Array(width * 4);
  const pixels = new Float32Array(width * height * 4);
  let cursor = size.index + size[0].length;
  for (let row = 0; row < height; row++) {
    if (bytes[cursor] !== 2 || bytes[cursor + 1] !== 2 ||
        ((bytes[cursor + 2] << 8) | bytes[cursor + 3]) !== width) throw Error('Invalid Sigil HDR scanline');
    cursor += 4;
    for (let channel = 0; channel < 4; channel++) {
      let written = 0;
      while (written < width) {
        const packet = bytes[cursor++];
        const repeated = packet > 128;
        const count = repeated ? packet - 128 : packet;
        if (!count || written + count > width || cursor + (repeated ? 1 : count) > bytes.length) {
          throw Error('Invalid Sigil HDR channel');
        }
        const offset = channel * width + written;
        if (repeated) channels.fill(bytes[cursor++], offset, offset + count);
        else {
          channels.set(bytes.subarray(cursor, cursor + count), offset);
          cursor += count;
        }
        written += count;
      }
    }
    for (let column = 0; column < width; column++) {
      const offset = ((height - 1 - row) * width + column) * 4;
      const exponent = channels[width * 3 + column];
      const scale = exponent ? 2 ** (exponent - 136) : 0;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = channels[channel * width + column] * scale;
      }
      pixels[offset + 3] = 1;
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function applySigilSurface(material, spec) {
  if (!spec) return;
  material.envMapRotation.y = spec.rotation * Math.PI * 2;
  // Sample the original packed masks. MRS stores metal in red and roughness in
  // green, and AEM stores ambient occlusion in red and emission in green.
  material.onBeforeCompile = shader => {
    shader.uniforms.sigilEmission = { value: spec.emission };
    shader.fragmentShader = 'uniform float sigilEmission;\n' + shader.fragmentShader
      .replace('#include <metalnessmap_fragment>', `
        float metalnessFactor = metalness * texture2D(metalnessMap, vMetalnessMapUv).r;
      `)
      .replace('#include <emissivemap_fragment>', `
        totalEmissiveRadiance = diffuseColor.rgb * texture2D(aoMap, vAoMapUv).g * sigilEmission;
      `);
  };
  material.customProgramCacheKey = () => 'sigil-surface';
}

export function createSigilOutline(gun, blob, offset, spec, { smoke, scroll }) {
  const geometry = new BufferGeometry();
  const width = spec.verts * 3;
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(blob, offset, width), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(blob, offset + width * 4, width), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(blob, offset + width * 8, spec.verts * 2), 2));
  geometry.setIndex(new BufferAttribute(new Uint16Array(blob, offset + spec.verts * 32, spec.indices), 1));
  for (const texture of [smoke, scroll]) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
  }
  const time = { value: 0 };
  const layers = [[4.2, .32], [1.7, .78]].map(([widthScale, opacity]) => {
    const material = new MeshBasicMaterial({
      map: smoke, color: new Color().setRGB(...spec.color), side: BackSide, opacity,
      transparent: true, depthWrite: false, toneMapped: false
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, {
        outlineTime: time, outlineScroll: { value: scroll }, outlineSpeed: { value: spec.speed },
        outlineNear: { value: spec.near * widthScale }, outlineFar: { value: spec.far * widthScale },
        outlineDistance: { value: spec.distance / 100 }
      });
      shader.vertexShader = 'uniform float outlineNear, outlineFar, outlineDistance;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float distanceToCamera = length((modelViewMatrix * vec4(position, 1.0)).xyz);
          transformed += normal * mix(outlineNear, outlineFar, clamp(distanceToCamera / outlineDistance, 0.0, 1.0));
        `);
      shader.fragmentShader = 'uniform sampler2D outlineScroll;\nuniform float outlineTime, outlineSpeed;\n' +
        shader.fragmentShader.replace('#include <map_fragment>', `
          vec2 drift = vec2(outlineTime * outlineSpeed, 0.0);
          float smoke = texture2D(map, vMapUv + drift).r;
          float scroll = texture2D(outlineScroll, vMapUv - drift).r;
          diffuseColor.a *= mix(0.25, 1.0, max(smoke, scroll));
        `);
    };
    const shell = new Mesh(geometry, material);
    shell.name = 'vct-sigil:outline';
    shell.frustumCulled = false;
    gun.add(shell);
    return shell;
  });
  return {
    update(seconds) { time.value = seconds; },
    dispose() {
      for (const shell of layers) {
        shell.removeFromParent();
        shell.material.dispose();
      }
      geometry.dispose();
    }
  };
}
