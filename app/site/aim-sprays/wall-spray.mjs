export function createWallSpray({ e5: PlaneGeometry, dp: MeshBasicMaterial, bd: Mesh, cN: Texture, be: Vector3, f$: Raycaster, bg: SRGBColorSpace }, stage, getMap, isRunning) {
  const height = .75;
  const width = height * 194 / 259;
  const ray = new Raycaster(undefined, undefined, 0, 4);
  const position = new Vector3();
  const direction = new Vector3();
  const up = new Vector3(0, 1, 0);
  let current, geometry, material, bitmap, loading;
  let generation = 0;
  let nextPlacement = 0;
  let disposed = false;

  function loadArtwork() {
    loading ??= fetch('/aim-sprays/snow-leopard.jpg')
      .then(response => {
        if (!response.ok) throw Error('Missing spray artwork');
        return response.blob();
      })
      .then(blob => createImageBitmap(blob, { imageOrientation: 'flipY' }))
      .then(image => {
        if (disposed) {
          image.close();
          return;
        }
        bitmap = image;
        const map = new Texture(bitmap);
        map.flipY = false;
        map.colorSpace = SRGBColorSpace;
        map.needsUpdate = true;
        material = new MeshBasicMaterial({ map, alphaTest: .5, polygonOffset: true, polygonOffsetFactor: -2 });
        geometry = new PlaneGeometry(width, height);
      }).catch(error => {
        loading = null;
        console.warn('Wall spray:', error);
      });
    return loading;
  }

  function clear() {
    generation++;
    current?.removeFromParent();
    current = null;
    nextPlacement = 0;
  }

  async function place() {
    if (disposed || !isRunning() || document.pointerLockElement !== stage.canvas || performance.now() < nextPlacement) return;
    const map = getMap();
    if (!map) return;
    const camera = stage.camera;
    camera.updateMatrixWorld();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const hit = ray.intersectObject(map, true).find(item => item.face && item.object.visible);
    if (!hit) return;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (Math.abs(normal.y) > .35) return;

    // Require the full spray to sit on the same wall plane so it cannot hang over a corner.
    const right = new Vector3().crossVectors(up, normal).normalize();
    const wallUp = new Vector3().crossVectors(normal, right);
    direction.copy(normal).negate();
    ray.far = .12;
    const fits = [-1, 1].every(x => [-1, 1].every(y => {
      position.copy(hit.point).addScaledVector(right, x * width / 2).addScaledVector(wallUp, y * height / 2)
        .addScaledVector(normal, .06);
      ray.set(position, direction);
      const corner = ray.intersectObject(map, true).find(item => item.face && item.object.visible);
      return corner && Math.abs(corner.distance - .06) < .015 &&
        corner.face.normal.clone().transformDirection(corner.object.matrixWorld).dot(normal) > .98;
    }));
    ray.far = 4;
    if (!fits) return;

    nextPlacement = performance.now() + 1500;
    const stamp = ++generation;
    await loadArtwork();
    if (stamp !== generation || !material || !isRunning() || getMap() !== map) return;
    current?.removeFromParent();
    current = new Mesh(geometry, material);
    current.name = 'Wall spray';
    current.position.copy(hit.point).addScaledVector(normal, .003);
    current.lookAt(position.copy(current.position).add(normal));
    stage.scene.add(current);
  }

  return {
    place,
    clear,
    dispose() {
      disposed = true;
      clear();
      geometry?.dispose();
      material?.map.dispose();
      material?.dispose();
      bitmap?.close();
    }
  };
}

