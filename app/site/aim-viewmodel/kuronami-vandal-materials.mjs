export function isKuronamiVandal(id) {
  return /^kuronami-vandal-(standard|black-red)$/.test(id);
}

export function applyKuronamiMaps(material, mode) {
  if (!mode) return;
  material.customProgramCacheKey = () => 'kuronami-vandal-' + mode;
  material.onBeforeCompile = shader => {
    if (mode === 'decal') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        'totalEmissiveRadiance *= diffuseColor.a;');
      return;
    }
    // Keep the original packed textures and sample their Unreal channels directly.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <metalnessmap_fragment>',
        'float kuronamiMetal = texture2D(metalnessMap, vMetalnessMapUv).r;\nfloat metalnessFactor = metalness * kuronamiMetal;')
      .replace('#include <emissivemap_fragment>',
        'vec3 kuronamiAem = texture2D(aoMap, vAoMapUv).rgb;\ntotalEmissiveRadiance *= kuronamiAem.g;');

    if (mode === 'standard-steel') {
      // The Standard atlas has authored steel reflections. Retain them where
      // the trainer's first-person environment would otherwise darken the metal.
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 authoredSteel = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.72));
        float silver = smoothstep(0.32, 0.87, kuronamiMetal);
        float blueSteel = smoothstep(0.005, 0.045, diffuseColor.b - diffuseColor.r);
        float steelValue = dot(authoredSteel, vec3(0.2126, 0.7152, 0.0722));
        vec3 coolSteel = mix(authoredSteel, steelValue * vec3(0.90, 1.02, 1.20), 0.32);
        vec3 restored = mix(coolSteel, authoredSteel * 1.06, silver);
        float coverage = max(0.91 * silver, 0.80 * blueSteel);
        outgoingLight = mix(outgoingLight, max(outgoingLight, restored), coverage);
        #include <opaque_fragment>
      `);
    } else if (mode === 'black-steel') {
      // Keep the authored edge glints while darkening the wider steel faces.
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 authored = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.64));
        float silver = smoothstep(0.32, 0.84, kuronamiMetal);
        float value = dot(authored, vec3(0.2126, 0.7152, 0.0722));
        vec3 burgundy = mix(authored, value * vec3(1.05, 0.97, 0.97), 0.46);
        float trimContrast = mix(0.24, 1.0, smoothstep(0.23, 0.51, value));
        vec3 trim = mix(authored, vec3(value), 0.62) * vec3(1.26, 1.22, 1.22) * trimContrast;
        vec3 restored = mix(burgundy, trim, silver);
        float shadowLift = mix(0.68, 1.0, smoothstep(0.025, 0.24, value));
        outgoingLight = mix(outgoingLight, max(outgoingLight, restored), mix(0.76, 0.96, silver) * shadowLift);
        #include <opaque_fragment>
      `);
    } else if (mode === 'standard-water') {
      // The blue AEM channel traces the brighter center of the crystal seams.
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float crystal = pow(kuronamiAem.b, 0.66);
        outgoingLight += crystal * vec3(0.055, 0.34, 0.61);
        outgoingLight += diffuseColor.rgb * 0.46;
        #include <opaque_fragment>
      `);
    } else if (mode === 'black-water') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float crystal = pow(kuronamiAem.b, 0.66);
        outgoingLight += crystal * vec3(0.034, 0.036, 0.045);
        outgoingLight += diffuseColor.rgb * 0.34;
        #include <opaque_fragment>
      `);
    }
  };
}
