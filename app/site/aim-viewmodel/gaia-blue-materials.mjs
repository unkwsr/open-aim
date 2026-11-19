export function tuneGaiaBlueMaterial(material, finish) {
  if (!finish) return material;

  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = shader => {
    previousCompile.call(material, shader);
    if (finish === 'bark') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        // Raise the warm wood midtones while retaining the dark recesses.
        diffuseColor.rgb = pow(diffuseColor.rgb, vec3(.75)) * vec3(1.12, 1.05, .99);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        float vein = texture2D(emissiveMap, vEmissiveMapUv).g;
        float feather = texture2D(emissiveMap, vEmissiveMapUv, 2.25).g;
        float core = smoothstep(.025, .60, vein);
        totalEmissiveRadiance += vec3(.015, .42, 1.06) * core
          + vec3(.012, .14, .47) * max(0.0, feather - vein) * .62;
      `);
    } else {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 crystalView = normalize(vViewPosition);
        float rim = pow(1.0 - abs(dot(normal, crystalView)), 3.0);
        vec3 halfAngle = normalize(crystalView + normalize(vec3(-.55, .84, .76)));
        float glint = pow(max(0.0, dot(normal, halfAngle)), 28.0);
        totalEmissiveRadiance += vec3(.025, .25, .54) * rim
          + vec3(.55, .77, 1.0) * glint * .34;
      `);
    }
  };
  material.customProgramCacheKey = () => previousKey.call(material) + ':gaia-blue:' + finish;
  return material;
}
