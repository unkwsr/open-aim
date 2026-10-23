// The Studio's 3D view: the same drill as the 2D map, seen in 3D with an orbit camera.
// It only draws and answers "what is under the mouse"; editing stays in studio.js, which
// passes in everything it needs (drill, selection, helpers) and handles the results.
import * as THREE from "./vendor/three.module.js";

const RED = 0xe0646f, RED_SHOOT = 0xff4655, GREEN = 0x4ade80, ORANGE = 0xffb547, TEAL = 0x2fe0c8, AIR = 0x7fd8ff;
const rad = (d) => (d * Math.PI) / 180;

export function createView3D(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "view3d";
  const labels = document.createElement("canvas");
  labels.className = "labels3d";
  container.prepend(canvas, labels); // under the buttons and hints over the map
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x07090c);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090c, 80, 220);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x20242c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  const world = new THREE.Group(); // ground or map
  const things = new THREE.Group(); // drill items, rebuilt on change
  scene.add(world, things);

  const orbit = { target: new THREE.Vector3(), dist: 30, yaw: 0, pitch: rad(50) };
  let W = 1, H = 1, key = "", worldKey = "";
  const pickables = []; // meshes with userData.hit
  const surfaces = []; // meshes you can place things on
  let bots = new Map(); // id -> { group, y } for the preview
  let flashes = []; // { id, curve, target, ball, burst }
  let labelList = []; // { text, pos, strong }

  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(W, H, false);
    labels.width = Math.round(W * (window.devicePixelRatio || 1));
    labels.height = Math.round(H * (window.devicePixelRatio || 1));
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  function placeCamera() {
    const { target, dist, yaw, pitch } = orbit;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  // ---------- world: training range floor or the map's collision as a blockout ----------
  function setWorld(map, rangeSize) {
    const k = map ? `map:${map.id}` : `range:${rangeSize}`;
    if (k === worldKey) return;
    worldKey = k;
    disposeGroup(world);
    surfaces.length = 0;
    if (!map) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(rangeSize, rangeSize), new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.userData.surface = true;
      world.add(ground);
      surfaces.push(ground);
      const grid = new THREE.GridHelper(rangeSize, rangeSize, 0xff4655, 0x3a4250);
      grid.position.y = 0.01;
      world.add(grid);
      return;
    }
    const tri = (list, color, lift, seeThrough) => {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(list.length);
      for (let i = 0; i < list.length; i += 3) { arr[i] = list[i]; arr[i + 1] = list[i + 1] + lift; arr[i + 2] = list[i + 2]; }
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, flatShading: true, ...(seeThrough ? { transparent: true, opacity: 0.35, depthWrite: false } : {}) }));
      world.add(m);
      return m;
    };
    // Walls and roofs see-through, so your bots and start stay visible behind them.
    if (map.meshes.solid.length) tri(map.meshes.solid, 0x6b7280, 0, !!map.meshes.nav);
    if (map.meshes.nav) surfaces.push(tri(map.meshes.nav, 0x8d96a3, -0.05));
    else surfaces.push(world.children[0]);
  }

  function disposeGroup(g) {
    for (const o of [...g.children]) {
      o.traverse((c) => { c.geometry?.dispose(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose()); });
      g.remove(o);
    }
  }

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const glow = (color, opacity = 0.35) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  function pickable(mesh, hit) { mesh.userData.hit = hit; pickables.push(mesh); return mesh; }
  function handle(x, y, z, color, hit, size = 0.25) {
    const m = pickable(new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false })), hit);
    m.position.set(x, y, z);
    m.renderOrder = 10;
    things.add(m);
    return m;
  }
  function polyline(points, color, dashed = false) {
    const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.3 }) : new THREE.LineBasicMaterial({ color });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    things.add(l);
    return l;
  }
  // The game's ramp: rises toward local +z.
  function wedge(hx, hy, hz) {
    const v = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz]];
    const f = [[0, 1, 2], [0, 2, 3], [3, 2, 5], [3, 5, 4], [0, 4, 5], [0, 5, 1], [1, 5, 2], [0, 3, 4]];
    const arr = new Float32Array(f.flatMap((t) => t.flatMap((i) => v[i])));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  }

  // A game block (from gameBlock()) split into the game's own parts.
  function addBlock(block, parts, material, hit) {
    const group = new THREE.Group();
    group.position.set(block.position.x, block.position.y, block.position.z);
    group.rotation.y = block.rotationY || 0;
    for (const p of parts) {
      const geo = p.shape === "ramp" ? wedge(p.half.x, p.half.y, p.half.z)
        : p.shape === "cylinder" ? new THREE.CylinderGeometry(p.half.x, p.half.x, p.half.y * 2, 20)
        : new THREE.BoxGeometry(p.half.x * 2, p.half.y * 2, p.half.z * 2);
      const m = new THREE.Mesh(geo, material);
      m.position.set(p.center.x, p.center.y, p.center.z);
      if (hit) { pickable(m, hit); m.userData.surface = true; surfaces.push(m); }
      group.add(m);
    }
    things.add(group);
    return group;
  }

  function addBot(it, y, selected, h) {
    const g = new THREE.Group();
    const tall = it.crouch ? 1.15 : 1.75;
    const bodyMat = mat(it.shoots !== "off" ? RED_SHOOT : RED, { emissive: selected ? 0x553333 : 0x000000 });
    const body = pickable(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, tall - 0.6, 4, 12), bodyMat), { type: "item", id: it.id });
    body.position.y = tall / 2;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), mat(0xffffff));
    nose.position.set(0, tall - 0.25, -0.32);
    g.add(body, nose);
    if (it.shoots !== "off") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: ORANGE }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    }
    if (selected) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    }
    g.position.set(it.x, y, it.z);
    g.rotation.y = rad(h.facingOf(it));
    things.add(g);
    bots.set(it.id, { group: g, y, item: it });
    labelList.push({ text: h.label(it), pos: new THREE.Vector3(it.x, y + tall + 0.35, it.z), strong: selected, follow: it.id });
  }

  // ---------- rebuild everything from the drill ----------
  // h: helpers from studio.js (floorAt, plan, flashTarget, gameBlock, blockParts, label, facingOf, across, wallEnds, startDir)
  function sync(drill, sel, h, previewing) {
    const k = JSON.stringify(drill) + "|" + sel + "|" + previewing;
    if (k === key) return;
    key = k;
    disposeGroup(things);
    pickables.length = 0;
    for (let i = surfaces.length - 1; i >= 0; i--) if (!world.children.includes(surfaces[i])) surfaces.splice(i, 1);
    bots = new Map(); flashes = []; labelList = [];
    const Y = (x, z, y) => h.floorAt(x, z, y) ?? y ?? 0;

    // structures and walls
    for (const it of drill.items) {
      const isSel = it.id === sel;
      if (it.kind === "block") {
        const block = h.gameBlock(it, it.id, Y(it.x, it.z, it.y));
        const m = mat(new THREE.Color(it.color || "#6b7280").getHex(), { emissive: isSel ? 0x333333 : 0x000000 });
        addBlock(block, h.blockParts(block), m, { type: "item", id: it.id });
        labelList.push({ text: h.label(it), pos: new THREE.Vector3(it.x, block.position.y + it.h / 2 + 0.4, it.z), strong: isSel });
      } else if (it.kind === "wall") {
        const y = Y(it.x, it.z, it.y);
        const block = { position: { x: it.x, y: y + it.height / 2, z: it.z }, rotationY: rad(it.turn || 0) };
        const m = it.invisible ? glow(AIR, isSel ? 0.35 : 0.18) : mat(isSel ? 0x9aa1ae : 0x59606b);
        addBlock(block, [{ shape: "box", center: { x: 0, y: 0, z: 0 }, half: { x: it.length / 2, y: it.height / 2, z: 0.15 } }], m, { type: "item", id: it.id });
        if (isSel) for (const [i, p] of h.wallEnds(it).entries()) handle(p.x, y + 0.1, p.z, 0xffffff, { type: "wallEnd", id: it.id, end: i });
        labelList.push({ text: h.label(it), pos: new THREE.Vector3(it.x, y + it.height + 0.4, it.z), strong: isSel });
      } else if (it.kind === "smoke") {
        const y = Y(it.x, it.z, it.y);
        const s = pickable(new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.7), glow(0xa974ff, isSel ? 0.4 : 0.25)), { type: "item", id: it.id });
        s.position.set(it.x, y, it.z);
        things.add(s);
        labelList.push({ text: h.label(it), pos: new THREE.Vector3(it.x, y + 4.8, it.z), strong: isSel });
      } else if (it.kind === "targets") {
        const y = Y(it.x, it.z, it.y) + (it.lift ?? 1.6);
        const zone = pickable(new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.6, it.width), Math.max(0.6, it.height)), glow(new THREE.Color(it.color || "#2fe0c8").getHex(), isSel ? 0.3 : 0.15)), { type: "item", id: it.id });
        zone.position.set(it.x, y, it.z);
        zone.rotation.y = rad(h.facingOf(it));
        things.add(zone);
        const a = h.across(it), n = Math.max(1, Math.min(it.count, 6));
        for (let i = 0; i < n; i++) {
          const f = n === 1 ? 0 : i / (n - 1) - 0.5;
          const ball = new THREE.Mesh(new THREE.SphereGeometry({ small: 0.12, medium: 0.2, large: 0.32 }[it.size] || 0.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(it.color || "#2fe0c8") }));
          ball.position.set(it.x + a.x * f * it.width, y, it.z + a.z * f * it.width);
          things.add(ball);
        }
        if (isSel) for (const s of [-1, 1]) handle(it.x + a.x * s * it.width / 2, y, it.z + a.z * s * it.width / 2, 0xffffff, { type: "width", id: it.id });
        labelList.push({ text: h.label(it), pos: new THREE.Vector3(it.x, y + it.height / 2 + 0.4, it.z), strong: isSel });
      }
    }

    // bots, their routes, strafe lines and flashes
    for (const it of drill.items.filter((i) => i.kind === "bot")) {
      const isSel = it.id === sel;
      const y = Y(it.x, it.z, it.y);
      if (it.route) {
        const pts = it.route.map((p) => ({ x: p.x, y: Y(p.x, p.z, p.y) + 0.08, z: p.z }));
        polyline(it.move === "patrol" && pts.length > 2 ? [...pts, pts[0]] : pts, isSel ? ORANGE : 0x8a6a3a, true);
        if (isSel) pts.forEach((p, i) => handle(p.x, p.y + 0.15, p.z, i === 0 ? GREEN : i === pts.length - 1 && it.move !== "patrol" ? RED_SHOOT : ORANGE, { type: "point", id: it.id, index: i }, 0.3));
      }
      if (it.move === "strafe") {
        const a = h.across(it), half = it.width / 2;
        polyline([{ x: it.x - a.x * half, y: y + 0.08, z: it.z - a.z * half }, { x: it.x + a.x * half, y: y + 0.08, z: it.z + a.z * half }], isSel ? ORANGE : 0x8a6a3a);
        if (isSel) for (const s of [-1, 1]) handle(it.x + a.x * half * s, y + 0.15, it.z + a.z * half * s, ORANGE, { type: "width", id: it.id });
      }
      if (isSel && h.fixedFacing(it)) {
        const f = h.dir(it.facing);
        handle(it.x + f.x * 2.2, y + 1.5, it.z + f.z * 2.2, 0xffffff, { type: "botTurn", id: it.id });
      }
      const fl = h.flashPath(it);
      if (fl) {
        const pts = [];
        for (let i = 0; i <= 24; i++) { const q = fl.curve(i / 24); pts.push({ x: q.x, y: fl.fromY + 1.5 + (fl.toY - fl.fromY - 1.5) * (i / 24) + Math.sin((Math.PI * i) / 24) * 0.8, z: q.z }); }
        polyline(pts, 0xffffff, true);
        const star = handle(fl.target.x, fl.toY, fl.target.z, 0xffffff, { type: "flash", id: it.id }, 0.28);
        star.geometry.dispose(); star.geometry = new THREE.OctahedronGeometry(0.3);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const burst = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        ball.visible = false; burst.visible = false;
        things.add(ball, burst);
        flashes.push({ id: it.id, pts, ball, burst, at: new THREE.Vector3(fl.target.x, fl.toY, fl.target.z) });
      }
      addBot(it, y, isSel, h);
    }

    // you
    const st = drill.start, sy = Y(st.x, st.z, st.y);
    const you = new THREE.Group();
    const body = pickable(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 12), mat(GREEN, { emissive: sel === "start" ? 0x225533 : 0 })), { type: "start" });
    body.position.y = 0.87;
    you.add(body);
    you.position.set(st.x, sy, st.z);
    things.add(you);
    const d = h.dir(st.facing);
    polyline([{ x: st.x, y: sy + 1.6, z: st.z }, { x: st.x + d.x * 4, y: sy + 1.6, z: st.z + d.z * 4 }], GREEN);
    handle(st.x + d.x * 4, sy + 1.6, st.z + d.z * 4, GREEN, { type: "turn" });
    labelList.push({ text: "YOU", pos: new THREE.Vector3(st.x, sy + 2.2, st.z), strong: sel === "start", you: true });
  }

  // ---------- preview: move bots and flashes ----------
  function animate(t, h) {
    for (const [id, b] of bots) {
      const at = h.previewPos(b.item, t);
      b.group.visible = at.shown;
      b.group.position.set(at.x, h.floorAt(at.x, at.z, b.y) ?? b.y, at.z);
      const lab = labelList.find((l) => l.follow === id);
      if (lab) lab.pos.set(at.x, b.group.position.y + 2.1, at.z);
      const fl = flashes.find((f) => f.id === id);
      if (fl) {
        const age = at.flashAge;
        fl.ball.visible = age !== undefined && age < h.FUSE;
        fl.burst.visible = age !== undefined && age >= h.FUSE;
        if (fl.ball.visible) { const p = fl.pts[Math.min(fl.pts.length - 1, Math.floor((age / h.FUSE) * (fl.pts.length - 1)))]; fl.ball.position.set(p.x, p.y, p.z); }
        if (fl.burst.visible) { const k = (age - h.FUSE) / 0.6; fl.burst.position.copy(fl.at); fl.burst.scale.setScalar(0.5 + k * 4); fl.burst.material.opacity = 0.9 * (1 - k); }
      }
    }
  }
  function still(h) {
    for (const b of bots.values()) { b.group.visible = true; b.group.position.set(b.item.x, b.y, b.item.z); }
    for (const f of flashes) { f.ball.visible = false; f.burst.visible = false; }
    for (const l of labelList) if (l.follow) { const b = bots.get(l.follow); if (b) l.pos.set(b.item.x, b.y + (b.item.crouch ? 1.5 : 2.1), b.item.z); }
    void h;
  }

  function render() {
    placeCamera();
    renderer.render(scene, camera);
    const g = labels.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = "700 12px Bahnschrift, Segoe UI";
    g.textAlign = "center";
    const v = new THREE.Vector3();
    for (const l of labelList) {
      v.copy(l.pos).project(camera);
      if (v.z > 1) continue;
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      const w = g.measureText(l.text).width + 10;
      g.fillStyle = l.you ? "rgba(74,222,128,.95)" : l.strong ? "rgba(255,255,255,.95)" : "rgba(10,17,24,.8)";
      g.fillRect(x - w / 2, y - 13, w, 17);
      g.fillStyle = l.you || l.strong ? "#0a1118" : "#e6e9ec";
      g.fillText(l.text, x, y);
    }
  }

  // ---------- mouse helpers ----------
  const ray = new THREE.Raycaster();
  const ndc = (px, py) => new THREE.Vector2((px / W) * 2 - 1, -(py / H) * 2 + 1);
  function pick(px, py) {
    ray.setFromCamera(ndc(px, py), camera);
    // Handles first (drawn on top), then the nearest thing.
    const hits = ray.intersectObjects(pickables, false);
    const top = hits.find((x) => x.object.renderOrder === 10) || hits[0];
    return top ? top.object.userData.hit : null;
  }
  // The floor, map or structure top under the mouse (skipId: leave out a structure being dragged).
  function surfacePoint(px, py, skipId) {
    ray.setFromCamera(ndc(px, py), camera);
    const list = skipId ? surfaces.filter((m) => !m.userData.hit || m.userData.hit.id !== skipId) : surfaces;
    const hit = ray.intersectObjects(list, false)[0];
    if (hit) return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    return planePoint(px, py, 0);
  }
  function planePoint(px, py, y) {
    ray.setFromCamera(ndc(px, py), camera);
    const p = new THREE.Vector3();
    const ok = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p);
    return ok ? { x: p.x, y, z: p.z } : null;
  }
  function orbitBy(dx, dy) {
    orbit.yaw -= dx * 0.006;
    orbit.pitch = Math.max(rad(8), Math.min(rad(88), orbit.pitch + dy * 0.006));
  }
  function panBy(dx, dy) {
    const s = orbit.dist * 0.0015;
    const right = new THREE.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw));
    const fwd = new THREE.Vector3(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw));
    orbit.target.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s);
  }
  function zoomBy(f) { orbit.dist = Math.max(3, Math.min(400, orbit.dist / f)); }
  // Behind and above `start`, looking the way it looks.
  function frame(start, y, facing) {
    orbit.target.set(start.x, y, start.z);
    orbit.yaw = rad(facing);
    orbit.pitch = rad(40);
    orbit.dist = 26;
  }
  function focus(x, y, z) { orbit.target.set(x, y, z); }

  return { canvas, labels, resize, setWorld, sync, animate, still, render, pick, surfacePoint, planePoint, orbitBy, panBy, zoomBy, frame, focus, forceRebuild: () => (key = "") };
}
