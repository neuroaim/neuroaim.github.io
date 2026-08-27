import * as THREE from '../../vendor/three-0.185.1/package/build/three.module.min.js';

const LEGACY_WORLD_SCALE = 1 / 150;
const LEGACY_REFERENCE_DISTANCE = 1200 * LEGACY_WORLD_SCALE;
const CAMERA_HEIGHT = 1.65;
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// The WebGL layer owns every non-text training visual. Text labels remain DOM
// nodes and are projected from their 3D anchors once per frame.
window.TrainingRange3D = class TrainingRange3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071018);
    this.scene.fog = new THREE.FogExp2(0x071018, 0.012);
    const calibratedFov = typeof CFG !== 'undefined' ? CFG.camera?.verticalFov : 73.73979529168804;
    this.camera = new THREE.PerspectiveCamera(calibratedFov, 1, 0.05, 120);
    this.camera.position.set(0, CAMERA_HEIGHT, 0);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    // Training visibility must never change because geometry happens to fall
    // under another object's shadow. Keep lighting for shape perception, but
    // disable the shadow pipeline globally.
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.targets = new Map();
    this.impactMarks = new Map();
    this.latestShotImpact = null;
    this.transientFx = [];
    this.ruleLights = [];
    this.ruleLightFixtures = [];
    this.labels = new Map();
    this.reticleRaycaster = new THREE.Raycaster();
    this.statusElement = document.getElementById('mode-status-text');
    this.modeId = 1;
    this.rangeProfile = this._profileForMode(this.modeId);
    this.trainingDepthScale = this.rangeProfile.targetDistance / LEGACY_REFERENCE_DISTANCE;
    this._buildLighting();
    this._buildRange(this.rangeProfile);
    this._buildReticle();
    this.resize();
  }

  _material(color, emissiveIntensity = 0, roughness = 0.62, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: options.emissive ?? color,
      emissiveIntensity,
      roughness,
      metalness: options.metalness ?? 0.18,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      side: options.side ?? THREE.FrontSide,
      depthWrite: options.depthWrite ?? true,
    });
  }

  _mesh(geometry, material, parent = this.world) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  _box(size, position, material, parent = this.world) {
    const mesh = this._mesh(new THREE.BoxGeometry(...size), material, parent);
    mesh.position.set(...position);
    return mesh;
  }

  _profileForMode(modeId) {
    const fallback = { targetDistance: 14, wallDistance: 20, roomWidth: 24 };
    const profile = (typeof CFG !== 'undefined' && CFG.rangeProfiles?.[modeId]) || fallback;
    const normalized = {
      targetDistance: Math.max(6, Number(profile.targetDistance) || fallback.targetDistance),
      wallDistance: Math.max(12, Number(profile.wallDistance) || fallback.wallDistance),
      roomWidth: Math.max(16, Math.min(48, Number(profile.roomWidth) || fallback.roomWidth)),
    };
    if (modeId === 4) {
      const aspect = this.camera?.aspect || (window.innerWidth / Math.max(1, window.innerHeight));
      const verticalFov = THREE.MathUtils.degToRad(this.camera?.fov || 72);
      const edgeX = Math.tan(verticalFov / 2) * normalized.targetDistance * aspect * 0.68;
      const requiredWidth = Math.ceil((edgeX + 2.5) / 2) * 4;
      normalized.roomWidth = Math.max(normalized.roomWidth, requiredWidth);
    }
    return normalized;
  }

  _disposeGroup(group) {
    if (!group) return;
    group.removeFromParent();
    group.traverse(child => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
      else child.material?.dispose();
    });
  }

  _buildLighting() {
    this.scene.add(new THREE.HemisphereLight(0x90bad0, 0x111416, 1.55));
    const key = new THREE.DirectionalLight(0xd7ecf6, 2.4);
    key.position.set(5, 9, 3);
    key.castShadow = false;
    this.scene.add(key);
  }

  _buildRange(profile) {
    this._disposeGroup(this.rangeShell);
    this._disposeGroup(this.rangeLights);
    this.ruleLights = [];
    this.ruleLightFixtures = [];

    const shell = new THREE.Group();
    shell.name = 'range-shell';
    this.world.add(shell);
    this.rangeShell = shell;

    const lightGroup = new THREE.Group();
    lightGroup.name = 'range-lights';
    this.scene.add(lightGroup);
    this.rangeLights = lightGroup;

    const wallDistance = profile.wallDistance;
    const roomLength = wallDistance + 0.6;
    const roomCenter = wallDistance / 2;
    // Compact FPS practice rooms use an explicit per-mode width. Target Lock
    // is the one wider exception because its peripheral drill uses screen-edge
    // peripheral positions rather than a conventional target lane.
    const roomWidth = profile.roomWidth;
    const halfWidth = roomWidth / 2;
    const concrete = this._material(0x38464d, 0, 0.92, { metalness: 0.02 });
    // Flat, unlit concrete tones preserve the no-light/no-shadow presentation
    // while giving the rear, side and ceiling planes enough separation to read
    // as a real enclosed practice lane instead of one white backdrop.
    const wallMaterial = (color) => new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: false });
    const rearWallColor = 0x92999a;
    const leftWallColor = 0x727b7e;
    const rightWallColor = 0x788184;
    const ceilingColor = 0x666f72;

    const floor = this._box([roomWidth, 0.14, roomLength], [0, -0.08, roomCenter], concrete, shell);
    floor.name = 'range-floor';
    const rearWall = this._box([roomWidth, 10, 0.45], [0, 5, wallDistance], wallMaterial(rearWallColor), shell);
    rearWall.name = 'range-backstop';
    const leftWall = this._box([0.35, 10, roomLength], [-halfWidth, 5, roomCenter], wallMaterial(leftWallColor), shell);
    leftWall.name = 'range-wall-left';
    const rightWall = this._box([0.35, 10, roomLength], [halfWidth, 5, roomCenter], wallMaterial(rightWallColor), shell);
    rightWall.name = 'range-wall-right';
    const ceiling = this._box([roomWidth, 0.2, roomLength], [0, 10, roomCenter], wallMaterial(ceilingColor), shell);
    ceiling.name = 'range-ceiling';

    // Only longitudinal lane paint remains near the player. Booth dividers,
    // floor cross-rails and overhead beams were deliberately removed so no
    // long geometry can interrupt a training target at close range.
    for (const fraction of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
      const x = halfWidth * fraction;
      const strip = this._box(
        [0.055, 0.012, Math.max(2, wallDistance - 2)],
        [x, 0.01, wallDistance / 2 + 1],
        this._material(0x48616c, 0.08, 0.45),
        shell,
      );
      strip.name = 'range-lane-line';
      strip.castShadow = false;
    }

    const lightStep = wallDistance >= 38 ? 7 : 6;
    for (let z = 6; z < wallDistance - 2; z += lightStep) {
      const light = new THREE.PointLight(0x78cfff, 1.15, 15, 1.6);
      light.position.set(0, 9.15, z);
      lightGroup.add(light);
      this.ruleLights.push(light);
      const fixture = this._box([2.1, 0.12, 0.42], [0, 9.55, z], this._material(0xb9efff, 1.5, 0.25), shell);
      fixture.name = 'range-light-fixture';
      fixture.castShadow = false;
      this.ruleLightFixtures.push(fixture);
    }

    this.scene.fog.density = 0.012 * Math.sqrt(30 / wallDistance);
  }

  setModeProfile(modeId) {
    const profile = this._profileForMode(modeId);
    const shellChanged = !this.rangeProfile
      || profile.wallDistance !== this.rangeProfile.wallDistance
      || profile.roomWidth !== this.rangeProfile.roomWidth;
    this.modeId = modeId;
    this.rangeProfile = profile;
    this.trainingDepthScale = profile.targetDistance / LEGACY_REFERENCE_DISTANCE;
    this.clearLatestShotImpact();
    if (modeId !== 7) this.setPlayerLateralOffset(0);
    if (shellChanged) this._buildRange(profile);
  }

  _buildReticle() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0.95 });
    const makeGroup = name => {
      const child = new THREE.Group();
      child.name = name;
      group.add(child);
      return child;
    };
    const cross = makeGroup('cross');
    for (const [x, y, w, h] of [[-8, 0, 8, 2], [8, 0, 8, 2], [0, -8, 2, 8], [0, 8, 2, 8]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), material);
      arm.position.set(x, y, 0);
      cross.add(arm);
    }
    const dot = makeGroup('dot');
    dot.add(new THREE.Mesh(new THREE.CircleGeometry(3, 18), material));
    const circle = makeGroup('circle');
    circle.add(new THREE.Mesh(new THREE.TorusGeometry(7.2, 1, 8, 28), material));
    circle.add(new THREE.Mesh(new THREE.CircleGeometry(2, 16), material));
    const crossdot = makeGroup('crossdot');
    crossdot.add(new THREE.Mesh(new THREE.BoxGeometry(16, 2, 0.5), material));
    crossdot.add(new THREE.Mesh(new THREE.BoxGeometry(2, 16, 0.5), material));
    group.position.set(0, 0, -0.55);
    this.camera.add(group);
    this.scene.add(this.camera);
    this.reticle = group;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    // Three.js stores vertical FOV. This is CS's 90 degree 4:3 view expanded
    // to 106.26 degrees horizontally at 16:9 (73.74 degrees vertically).
    this.camera.fov = typeof CFG !== 'undefined'
      ? CFG.camera.verticalFov
      : 73.73979529168804;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setLook(yaw, pitch) {
    // Three's +Z view reverses its view-space X axis. Pair PI - yaw with the
    // X inversion in legacyToWorld so positive legacy X appears on-screen right
    // and positive mouse movement aims toward it, matching the 2D baseline.
    this.camera.rotation.set(-pitch, Math.PI - yaw, 0, 'YXZ');
  }

  setPlayerLateralOffset(offset = 0) {
    const lateralOffset = Number(offset);
    this.camera.position.set(
      Number.isFinite(lateralOffset) ? lateralOffset : 0,
      CAMERA_HEIGHT,
      0,
    );
  }

  setReticle(visible, opacity = 1, style = 'cross', userScale = 1) {
    const alpha = clamp01(opacity);
    this.reticle.visible = Boolean(visible) && alpha > 0;
    const pixelWorld = 2 * 0.55 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) / Math.max(1, window.innerHeight);
    this.reticle.scale.setScalar(pixelWorld * Math.max(0.1, userScale || 1));
    for (const name of ['cross', 'dot', 'circle', 'crossdot']) {
      const group = this.reticle.getObjectByName(name);
      if (group) group.visible = name === style;
    }
    this.reticle.traverse(child => {
      if (child.material) child.material.opacity = alpha;
    });
  }

  legacyToWorld(x = 0, y = 0, z = WALL_DISTANCE) {
    const factor = this.trainingDepthScale || 1;
    return [
      -x * LEGACY_WORLD_SCALE * factor,
      CAMERA_HEIGHT - y * LEGACY_WORLD_SCALE * factor,
      z * LEGACY_WORLD_SCALE * factor,
    ];
  }

  viewportDummyPosition(viewportX, viewportY, depth = 22, scale = 2.15) {
    // Trials are created before the first render of a mode. Make the camera
    // matrices current so unproject() cannot inherit the previous mode's view.
    this.camera.updateMatrixWorld(true);
    const ndc = new THREE.Vector3(viewportX * 2 - 1, 1 - viewportY * 2, 0.25).unproject(this.camera);
    const direction = ndc.sub(this.camera.position).normalize();
    const distance = (depth - this.camera.position.z) / direction.z;
    const head = this.camera.position.clone().add(direction.multiplyScalar(distance));
    return [head.x, head.y - 0.8 * scale, depth];
  }

  _target(id, factory) {
    let object = this.targets.get(id);
    if (!object) {
      object = factory();
      object.visible = false;
      this.world.add(object);
      this.targets.set(id, object);
    }
    return object;
  }

  _setColor(object, color, emissiveIntensity) {
    object.traverse(child => {
      if (!child.material || child.userData.fixedMaterial) return;
      child.material.color.setHex(color);
      if (child.material.emissive) child.material.emissive.setHex(color);
      if (Number.isFinite(emissiveIntensity)) child.material.emissiveIntensity = emissiveIntensity;
    });
  }

  createOrb(id, color = 0x00d9ff) {
    const object = this._target(id, () => {
      const group = new THREE.Group();
      const core = this._mesh(new THREE.SphereGeometry(0.38, 32, 24), this._material(color, 1.05, 0.28), group);
      core.name = 'core';
      core.castShadow = false;
      return group;
    });
    this._setColor(object, color, 0.95);
    object.traverse(child => {
      if (!child.material) return;
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.renderOrder = 5;
    });
    return object;
  }

  _paintSphere(object, colorAtVertex) {
    const core = object?.getObjectByName('core');
    const positions = core?.geometry?.getAttribute('position');
    if (!core || !positions) return;
    let colors = core.geometry.getAttribute('color');
    if (!colors || colors.count !== positions.count) {
      colors = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
      core.geometry.setAttribute('color', colors);
    }
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index++) {
      colorAtVertex(positions.getX(index), positions.getY(index), positions.getZ(index), color);
      colors.setXYZ(index, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    core.material.vertexColors = true;
    core.material.color.setHex(0xffffff);
    if (core.material.emissive) core.material.emissive.setHex(0x22343a);
    core.material.needsUpdate = true;
  }

  _paintGaborSurface(object, vertical, baseColor, contrast = 0.5) {
    const base = new THREE.Color(baseColor);
    const amplitude = Math.max(0, Math.min(0.46, Number(contrast) * 0.8));
    const radius = 0.38;
    const wavelength = 0.18;
    const sigma = radius * 0.5;
    this._paintSphere(object, (x, y, z, output) => {
      const coordinate = vertical ? x : y;
      const radialSquared = x * x + y * y;
      const envelope = Math.exp(-radialSquared / (2 * sigma * sigma));
      const grating = Math.cos((Math.PI * 2 * coordinate) / wavelength);
      output.copy(base).multiplyScalar(1 + grating * envelope * amplitude);
    });
  }

  _paintRadialProgress(object, fraction, baseColor, fillColor) {
    const base = new THREE.Color(baseColor);
    const fill = new THREE.Color(fillColor);
    const progress = clamp01(fraction);
    const radius = 0.04 + progress * Math.PI * 0.51;
    this._paintSphere(object, (x, y, z, output) => {
      const length = Math.max(0.0001, Math.hypot(x, y, z));
      const angleFromFront = Math.acos(Math.max(-1, Math.min(1, -z / length)));
      const blend = clamp01((radius - angleFromFront) / 0.14 + 0.5);
      output.copy(base).lerp(fill, blend);
    });
  }

  createDummy(id, color = 0xff7a35) {
    const object = this._target(id, () => {
      const group = new THREE.Group();
      const body = this._material(color, 0.12, 0.58, { metalness: 0.08 });
      const joint = this._material(0x1e2b32, 0.03, 0.4, { metalness: 0.55 });
      const silhouettePart = (mesh, part = 'body') => {
        mesh.userData.targetSilhouette = true;
        mesh.userData.targetSilhouettePart = part;
        return mesh;
      };
      const head = silhouettePart(this._mesh(new THREE.SphereGeometry(0.18, 18, 14), body, group), 'head');
      head.position.set(0, 0.8, 0);
      head.name = 'head';
      const neck = silhouettePart(this._mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.13, 12), joint, group));
      neck.position.y = 0.61;
      neck.userData.fixedMaterial = true;
      const torso = silhouettePart(this._mesh(new THREE.CapsuleGeometry(0.22, 0.56, 6, 12), body, group));
      torso.position.y = 0.19;
      const visor = silhouettePart(this._mesh(new THREE.BoxGeometry(0.25, 0.09, 0.045), joint, group), 'head');
      visor.position.set(0, 0.81, -0.155);
      visor.userData.fixedMaterial = true;
      for (const side of [-1, 1]) {
        const arm = silhouettePart(this._mesh(new THREE.CapsuleGeometry(0.065, 0.68, 4, 8), body, group));
        arm.position.set(side * 0.285, 0.08, 0);
        arm.rotation.z = side * 0.1;
        const leg = silhouettePart(this._mesh(new THREE.CapsuleGeometry(0.085, 0.72, 4, 8), body, group));
        leg.position.set(side * 0.115, -0.68, 0);
      }
      const mount = this._mesh(new THREE.BoxGeometry(0.52, 0.055, 0.32), joint, group);
      mount.position.y = -1.14;
      mount.userData.fixedMaterial = true;
      group.userData.headLocalY = 0.8;
      return group;
    });
    this._setColor(object, color, 0.12);
    return object;
  }

  isReticleOnTargetSilhouette(id) {
    return this.getReticleTargetSilhouettePart(id) !== null;
  }

  getReticleTargetSilhouettePart(id) {
    const target = this.targets.get(id);
    if (!target?.visible) return null;
    this.camera.updateMatrixWorld(true);
    target.updateMatrixWorld(true);
    this.reticleRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.reticleRaycaster.intersectObject(target, true)
      .find(intersection => intersection.object.userData.targetSilhouette === true);
    return hit?.object.userData.targetSilhouettePart || null;
  }

  show(id, position, scale = 1, scaleWithTrainingDepth = true) {
    const object = this.targets.get(id);
    if (!object) return null;
    object.visible = true;
    object.position.set(...position);
    object.scale.setScalar(scale * (scaleWithTrainingDepth ? this.trainingDepthScale : 1));
    return object;
  }

  hide(id) {
    const object = this.targets.get(id);
    if (object) object.visible = false;
  }

  clearTargets() {
    this.targets.forEach(object => { object.visible = false; });
    this.labels.forEach(({ element }) => { element.style.display = 'none'; });
    if (this.statusElement) this.statusElement.style.display = 'none';
  }

  syncBulletHoles(holes = []) {
    const active = new Set(holes.map(hole => hole.id));
    this.impactMarks.forEach((mark, id) => {
      if (active.has(id)) return;
      this.world.remove(mark);
      mark.traverse(child => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
      this.impactMarks.delete(id);
    });

    const now = performance.now();
    holes.forEach(hole => {
      let mark = this.impactMarks.get(hole.id);
      if (!mark) {
        mark = new THREE.Group();
        const rim = this._mesh(
          new THREE.RingGeometry(0.026, 0.05, 18),
          new THREE.MeshBasicMaterial({ color: 0xd8e0e4, side: THREE.DoubleSide }),
          mark,
        );
        rim.castShadow = false;
        const core = this._mesh(
          new THREE.CircleGeometry(0.027, 18),
          new THREE.MeshBasicMaterial({ color: 0x11171b, side: THREE.DoubleSide }),
          mark,
        );
        core.position.z = -0.002;
        core.castShadow = false;
        this.world.add(mark);
        this.impactMarks.set(hole.id, mark);
      }
      const position = this.legacyToWorld(hole.x, hole.y, hole.z);
      mark.position.set(position[0], position[1], position[2] - 0.018 * this.trainingDepthScale);
      mark.scale.setScalar(this.trainingDepthScale);
      const alpha = clamp01(1 - (now - hole.spawnTime) / 1500);
      mark.visible = alpha > 0;
      mark.traverse(child => {
        if (!child.material) return;
        child.material.transparent = true;
        child.material.opacity = alpha;
      });
    });
  }

  clearLatestShotImpact() {
    if (!this.latestShotImpact) return;
    this._disposeGroup(this.latestShotImpact);
    this.latestShotImpact = null;
  }

  _jaggedCircleGeometry(radius, segments = 18, seed = 1) {
    const geometry = new THREE.CircleGeometry(radius, segments);
    const positions = geometry.getAttribute('position');
    for (let index = 1; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const length = Math.hypot(x, y);
      if (length < 0.0001) continue;
      const jitter = 0.82 + ((Math.sin(index * 12.9898 + seed * 7.13) + 1) * 0.5) * 0.26;
      positions.setXY(index, x / length * radius * jitter, y / length * radius * jitter);
    }
    positions.needsUpdate = true;
    geometry.computeBoundingSphere();
    return geometry;
  }

  showLatestShotImpact() {
    this.clearLatestShotImpact();
    this.camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const orb = this.targets.get('m3');
    // Mode switches can move a cached target and raycast it in the same frame.
    // Refresh its world transform so the impact always follows the visible ball.
    orb?.updateMatrixWorld(true);
    const orbIntersection = orb?.visible ? raycaster.intersectObject(orb, true)[0] : null;
    const isHit = Boolean(orbIntersection);
    let intersection = orbIntersection;
    if (!intersection) {
      const rearWall = this.rangeShell?.getObjectByName('range-backstop');
      rearWall?.updateMatrixWorld(true);
      intersection = rearWall ? raycaster.intersectObject(rearWall, false)[0] : null;
    }

    let point;
    let normal = new THREE.Vector3(0, 0, -1);
    if (intersection) {
      point = intersection.point.clone();
      if (isHit) {
        const center = orb.getWorldPosition(new THREE.Vector3());
        normal.copy(point).sub(center).normalize();
      } else if (intersection.face) {
        normal.copy(intersection.face.normal).applyNormalMatrix(
          new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld),
        ).normalize();
      }
    } else {
      const wallFront = this.rangeProfile.wallDistance - 0.225 - 0.012;
      const directionZ = raycaster.ray.direction.z;
      const distance = Math.abs(directionZ) > 0.0001
        ? (wallFront - raycaster.ray.origin.z) / directionZ
        : 0;
      point = raycaster.ray.at(Math.max(0, distance), new THREE.Vector3());
    }

    const group = new THREE.Group();
    group.name = 'latest-shot-impact';
    const soot = this._mesh(
      this._jaggedCircleGeometry(0.072, 20, point.x + point.y),
      new THREE.MeshBasicMaterial({ color: 0x181818, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
      group,
    );
    soot.renderOrder = 30;
    const core = this._mesh(
      this._jaggedCircleGeometry(0.043, 16, point.z),
      new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
      group,
    );
    core.position.z = 0.003;
    core.renderOrder = 31;
    const puncture = this._mesh(
      new THREE.CircleGeometry(0.018, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
      group,
    );
    puncture.position.z = 0.005;
    puncture.renderOrder = 32;

    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.position.copy(point).addScaledVector(normal, 0.006);
    this.world.add(group);
    this.latestShotImpact = group;
    return { isHit, point: point.clone(), normal: normal.clone() };
  }

  _screenStatus(text, variant = '') {
    if (!this.statusElement) return;
    this.statusElement.textContent = text;
    this.statusElement.className = `mode-status-text ${variant}`.trim();
    this.statusElement.style.display = 'block';
  }

  _gaborOrb(id, vertical, color, contrast) {
    const object = this._target(id, () => {
      const group = new THREE.Group();
      const core = this._mesh(
        new THREE.SphereGeometry(0.38, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: {
            patchColor: { value: new THREE.Color(color) },
            patchContrast: { value: 0.5 },
            patchOpacity: { value: 1 },
            verticalPattern: { value: 0 },
          },
          vertexShader: `
            varying vec3 localPosition;
            void main() {
              localPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            varying vec3 localPosition;
            uniform vec3 patchColor;
            uniform float patchContrast;
            uniform float patchOpacity;
            uniform float verticalPattern;
            void main() {
              float coordinate = mix(localPosition.y, localPosition.x, verticalPattern);
              float grating = cos(6.28318530718 * coordinate / 0.12);
              float stripe = smoothstep(0.08, 0.42, grating);
              float radial = length(localPosition.xy);
              float gaussian = exp(-(radial * radial) / (2.0 * 0.19 * 0.19));
              float edgeFade = 1.0 - smoothstep(0.27, 0.38, radial);
              float alpha = patchOpacity * stripe * gaussian * edgeFade;
              if (alpha < 0.004) discard;
              vec3 visibleColor = mix(vec3(0.70), patchColor, clamp(patchContrast, 0.0, 1.0));
              gl_FragColor = vec4(visibleColor, alpha);
            }
          `,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
        group,
      );
      core.name = 'core';
      core.castShadow = false;
      return group;
    });
    const material = object.getObjectByName('core')?.material;
    if (material?.uniforms) {
      material.uniforms.patchColor.value.setHex(color);
      material.uniforms.patchContrast.value = clamp01(Number(contrast) || 0);
      material.uniforms.verticalPattern.value = vertical ? 1 : 0;
    }
    return object;
  }

  _label(id, text, position, className = '', color = null) {
    let record = this.labels.get(id);
    if (!record) {
      const element = document.createElement('div');
      element.className = `world-label ${className}`.trim();
      element.style.pointerEvents = 'none';
      document.getElementById('game-screen')?.appendChild(element);
      record = { element, position: new THREE.Vector3() };
      this.labels.set(id, record);
    }
    record.element.textContent = text;
    record.element.style.display = 'block';
    if (color) record.element.style.setProperty('--label-color', color);
    else record.element.style.removeProperty('--label-color');
    record.position.set(...position);
  }

  _setRuleLighting(color, intensity, fixtureColor = color, fixtureIntensity = 1.5) {
    this.ruleLights.forEach(light => {
      light.color.setHex(color);
      light.intensity = intensity;
    });
    this.ruleLightFixtures.forEach(fixture => {
      const material = fixture.material;
      if (!material) return;
      material.color?.setHex(fixtureColor);
      material.emissive?.setHex(fixtureColor);
      material.emissiveIntensity = fixtureIntensity;
    });
  }

  _syncLabels() {
    this.labels.forEach(record => {
      if (record.element.style.display === 'none') return;
      const projected = record.position.clone().project(this.camera);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) <= 1.1 && Math.abs(projected.y) <= 1.1;
      record.element.style.display = visible ? 'block' : 'none';
      if (!visible) return;
      record.element.style.left = `${(projected.x + 1) * 50}%`;
      record.element.style.top = `${(1 - projected.y) * 50}%`;
    });
  }

  syncMode(id, state, mode) {
    this.clearTargets();
    const toWorld = this.legacyToWorld.bind(this);
    const depthScale = this.trainingDepthScale;

    if (id === 1) {
      const fade = Math.min(1, (mode.now() - state.spawnTime) / Math.max(1, state.animationDuration || 500));
      (state.targets || []).forEach((target, index) => {
        const color = 0xd9dfe1;
        const contrast = target.contrast ?? target.opacity ?? 0.5;
        const object = this._gaborOrb(`m1-${index}`, Boolean(target.isVertical), color, contrast);
        const opacity = Math.max(0.001, Number(target.opacity) || 0.001) * fade;
        object.traverse(child => {
          if (!child.material) return;
          child.material.transparent = true;
          if (child.material.uniforms?.patchOpacity) child.material.uniforms.patchOpacity.value = opacity;
          if (child.material.emissive) child.material.emissiveIntensity = 0.22;
          child.material.depthTest = false;
          child.material.depthWrite = false;
          child.renderOrder = 6;
        });
        this.show(`m1-${index}`, toWorld(target.currentX, target.currentY, target.z), Math.max(0.05, target.size / 57));
      });
    }

    if (id === 2 && state.target) {
      const target = state.target;
      // Keep both states bright, but use a strong cool/warm split so radial
      // tracking progress remains readable against the neutral range walls.
      const restingColor = 0x65d7ff;
      const trackedColor = 0xffd43b;
      const object = this.createOrb('m2', restingColor);
      const position = toWorld(target.x, target.y, target.z);
      const targetScale = target.size / 57;
      const progress = state.trackProgress / Math.max(0.001, mode.param('lockTime'));
      const core = object.getObjectByName('core');
      if (core && !core.userData.mode2Unlit) {
        core.material.dispose();
        core.material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: true,
          toneMapped: false,
        });
        core.userData.mode2Unlit = true;
      }
      this._paintRadialProgress(object, progress, restingColor, trackedColor);
      this.show('m2', position, Math.max(0.003, targetScale));
      object.traverse(child => {
        if (!child.material) return;
        child.material.transparent = false;
        child.material.opacity = 1;
      });
    }

    if (id === 3) {
      const target = state.target || state.feedback;
      if (target) {
        const color = 0xffcc00;
        const position = toWorld(target.x, target.y, target.z);
        const object = this.createOrb('m3', color);
        const targetScale = Math.max(0.006, target.size / 57);
        this.show('m3', position, targetScale);
        const feedbackAlpha = state.feedback
          ? Math.max(0, 1 - (mode.now() - state.feedback.startTime) / 500)
          : 1;
        object.traverse(child => {
          if (!child.material) return;
          child.material.transparent = state.feedback != null;
          child.material.opacity = feedbackAlpha;
        });
      }
    }

    if (id === 5 && state.target) {
      const target = state.target;
      const age = mode.now() - target.spawnTime;
      const remaining = clamp01(1 - age / Math.max(1, target.lifetime));
      const object = this.createOrb('m5-ball', 0xffd27a);
      this.show('m5-ball', toWorld(target.x, target.y, target.z), Math.max(0.006, target.size / 57));
      object.traverse(child => {
        if (!child.material) return;
        child.material.transparent = true;
        child.material.opacity = 0.72 + remaining * 0.25;
        child.material.emissiveIntensity = 0.62;
      });
    }

    if (id === 6) {
      (state.targets || []).forEach((target, index) => {
        const isRed = target.color === 'red';
        this.createOrb(`m6-${index}`, isRed ? 0xff3838 : 0x44ff7c);
        this.show(`m6-${index}`, toWorld(target.x, target.y, target.z), Math.max(0.06, target.size / 57));
      });
      const warm = state.rule === 'warm';
      const targetColor = warm ? 0x44ff7c : 0xff3838;
      const targetCssColor = warm ? '#44ff7c' : '#ff3838';
      const pulse = state.warningActive ? Math.sin(performance.now() * 0.012) : 0;
      this.scene.fog.color.setHex(0x071018);
      this._setRuleLighting(
        targetColor,
        state.warningActive ? 1.7 + pulse * 0.45 : 1.15,
        targetColor,
        state.warningActive ? 1.9 + pulse * 0.35 : 1.5,
      );
      const ruleText = warm ? 'SHOOT GREEN' : 'SHOOT RED';
      this._label(
        'm6-rule',
        ruleText,
        [0, 6.85, this.rangeProfile.wallDistance - 0.24],
        'rule-label',
        targetCssColor,
      );
      if (state.warningActive) {
        const seconds = Math.ceil(state.switchTimer / 1000);
        if (seconds > 0 && seconds <= 4) this._screenStatus(String(seconds), 'warning');
      }
    } else {
      this.scene.fog.color.setHex(0x071018);
      this._setRuleLighting(0x78cfff, 1.15, 0xb9efff, 1.5);
    }

    if (id === 7 && state.target) {
      const target = state.target;
      const position = toWorld(target.x, target.y, target.z);
      const object = this.createOrb('m7-ball', 0xff7a00);
      const core = object.getObjectByName('core');
      if (core) {
        core.userData.targetSilhouette = true;
        core.userData.targetSilhouettePart = 'target';
      }

      // The previous dummy used a 0.18 m head radius at 1.8 / 2.15 scale.
      // Scale the 0.38 m base orb from that exact physical head size so the
      // requested ratio remains correct at every target distance.
      const referenceHeadRadius = 0.18 * (1.8 / 2.15);
      const ballScale = (referenceHeadRadius / 0.38) * target.headScale;
      const progress = state.trackProgress / Math.max(0.001, mode.param('lockTime'));
      this.show('m7-ball', position, ballScale, false);
      object.traverse(child => {
        if (!child.material) return;
        child.material.depthTest = false;
        child.material.depthWrite = false;
        child.material.transparent = true;
        child.material.color.setHex(progress >= 1 ? 0xffd06a : 0xff7a00);
        if (child.material.emissive) child.material.emissive.setHex(0xff7a00);
        child.material.emissiveIntensity = 0.28 + clamp01(progress) * 1.1;
        child.material.opacity = 0.72 + clamp01(progress) * 0.26;
        child.renderOrder = 5;
      });
    }

    if (id === 8 && state.target) {
      const target = state.target;
      const position = toWorld(target.x, target.y, target.z);
      const dummyId = 'm8-dummy';
      this.createDummy(dummyId, 0xff7a00);
      // A fixed 1.80 m adult at every difficulty and distance. Put the head on
      // the mode's horizontal tracking line and let perspective alone control
      // its apparent near/mid/far size.
      const dummyScale = 1.8 / 2.15;
      position[1] = CAMERA_HEIGHT - 0.8 * dummyScale;
      const progress = state.trackProgress / Math.max(0.001, mode.param('lockTime'));
      const dummy = this.show(dummyId, position, dummyScale, false);
      // Difficulty can narrow the tracking tolerance without stretching the
      // visible person. Keep one normal human proportion at every level.
      dummy.scale.setScalar(dummyScale);
      dummy.traverse(child => {
        if (!child.material) return;
        child.material.depthTest = false;
        child.material.depthWrite = false;
        child.renderOrder = 5;
        if (!child.userData.fixedMaterial) {
          child.material.transparent = true;
          child.material.color.setHex(progress >= 1 ? 0xffd06a : 0xff7a00);
          child.material.emissive.setHex(0xff7a00);
          child.material.emissiveIntensity = 0.12 + clamp01(progress) * 1.35;
          child.material.opacity = 0.42 + clamp01(progress) * 0.5;
        }
      });
    }
  }

  _gapDisc(id, radius, color) {
    return this._target(id, () => {
      const group = new THREE.Group();
      const material = () => new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.98,
        depthTest: false,
        depthWrite: false,
      });
      const left = this._mesh(
        new THREE.RingGeometry(radius * 0.58, radius, 42, 1, Math.PI * 1.25, Math.PI * 1.5),
        material(),
        group,
      );
      left.name = 'gap-left';
      left.renderOrder = 20;
      const right = this._mesh(
        new THREE.RingGeometry(radius * 0.58, radius, 42, 1, Math.PI * 0.25, Math.PI * 1.5),
        material(),
        group,
      );
      right.name = 'gap-right';
      right.renderOrder = 20;
      return group;
    });
  }

  _setGap(object, gap) {
    // The range camera looks toward +Z by rotating 180 degrees around Y, which
    // mirrors mesh-local X on screen. Select the opposite local arc so the
    // requested semantic direction is the direction the player actually sees.
    object.getObjectByName('gap-left').visible = gap === 'right';
    object.getObjectByName('gap-right').visible = gap === 'left';
  }

  showLockCue() {
    const cue = this._target('lock-cue3d', () => {
      const material = this._material(0xf2eaff, 2.2, 0.2, { transparent: true, opacity: 1 });
      const dot = this._mesh(new THREE.SphereGeometry(0.046, 16, 12), material);
      dot.name = 'fixation-dot';
      dot.castShadow = false;
      dot.material.depthTest = false;
      dot.material.depthWrite = false;
      dot.renderOrder = 24;
      return dot;
    });
    cue.position.set(0, CAMERA_HEIGHT, 2.5);
    cue.scale.setScalar(1);
    cue.userData.started = performance.now();
    cue.visible = true;
  }

  showLockDummy(position, scale = 2.15) {
    const dummy = this.createDummy('lock-dummy', 0x7e8a91);
    // The lock target is a motorized range silhouette. It must remain visible
    // at all eight calibrated viewport positions, including the lower lanes
    // that geometrically intersect the range floor from the player's camera.
    dummy.traverse(child => {
      if (!child.material) return;
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.renderOrder = 10;
    });
    return this.show('lock-dummy', position, scale, false);
  }

  _lockHeadPosition(position, scale = 2.15) {
    return [position[0], position[1] + 0.8 * scale, position[2] - 0.2 * scale];
  }

  showLockProbe(position, gap, scale = 2.15, decoyCount = 4, seed = 1) {
    const probe = this._gapDisc('lock-probe-detail', 0.15, 0xf0eaff);
    this._setGap(probe, gap);
    probe.position.set(...this._lockHeadPosition(position, scale));
    probe.scale.setScalar(scale * 0.93);
    probe.visible = true;

    const decoys = this._target('lock-probe-decoys', () => {
      const group = new THREE.Group();
      for (let index = 0; index < 12; index++) {
        const geometry = index < 4
          ? new THREE.CircleGeometry(0.033, 10)
          : index < 8
            ? new THREE.RingGeometry(0.019, 0.04, 12)
            : new THREE.OctahedronGeometry(0.037, 0);
        const mark = this._mesh(geometry, new THREE.MeshBasicMaterial({
          color: index < 4 ? 0x9da8ae : index < 8 ? 0x84939d : 0xb0bac0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          depthWrite: false,
        }), group);
        mark.userData.safeRadius = index < 4 ? 0.033 : index < 8 ? 0.04 : 0.037;
        mark.renderOrder = 19;
      }
      return group;
    });
    const visibleCount = Math.max(0, Math.min(decoys.children.length, Math.round(decoyCount)));
    const phase = ((seed >>> 0) % 360) * Math.PI / 180;
    decoys.children.forEach((mark, index) => {
      const outer = index >= 6;
      const radius = outer ? 0.44 : 0.30;
      const angle = phase + (index % 6) * Math.PI / 3 + (outer ? Math.PI / 6 : 0);
      mark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, index >= 8 ? -0.006 : 0);
      mark.visible = index < visibleCount;
    });
    decoys.position.copy(probe.position);
    decoys.scale.setScalar(scale);
    decoys.visible = true;
  }

  showLockMask(position, scale = 2.15, count = 6, seed = 1) {
    this.hide('lock-probe-detail');
    this.hide('lock-probe-decoys');
    const mask = this._target('lock-noise-mask', () => {
      const group = new THREE.Group();
      for (let i = 0; i < 20; i++) {
        const geometry = i < 6
          ? new THREE.BoxGeometry(0.058, 0.058, 0.014)
          : i < 12
            ? new THREE.CircleGeometry(0.037, 10)
            : i < 16
              ? new THREE.RingGeometry(0.021, 0.043, 12)
              : new THREE.TetrahedronGeometry(0.04, 0);
        const block = this._mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x73808a, side: THREE.DoubleSide, transparent: true, opacity: 0.78, depthTest: false, depthWrite: false }), group);
        block.name = `noise-${i}`;
        block.userData.safeRadius = i < 6 ? 0.042 : i < 12 ? 0.037 : i < 16 ? 0.043 : 0.04;
        block.renderOrder = 21;
      }
      return group;
    });
    let randomState = (seed >>> 0) || 1;
    const random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };
    const visibleCount = Math.max(0, Math.min(mask.children.length, Math.round(count)));
    mask.children.forEach((block, index) => {
      const exclusionRadius = 0.15 + block.userData.safeRadius + 0.045;
      let x = 0;
      let y = 0;
      // Strict rejection sampling: even the marker's outer bound cannot enter
      // the probe's protected central disc.
      for (let attempt = 0; attempt < 40; attempt++) {
        x = (random() - 0.5) * 0.82;
        y = (random() - 0.5) * 0.68;
        if (Math.hypot(x, y) >= exclusionRadius) break;
      }
      if (Math.hypot(x, y) < exclusionRadius) {
        const fallbackAngle = random() * Math.PI * 2;
        x = Math.cos(fallbackAngle) * (exclusionRadius + 0.01);
        y = Math.sin(fallbackAngle) * (exclusionRadius + 0.01);
      }
      block.position.set(x, y, (random() - 0.5) * 0.01);
      const value = 0.28 + random() * 0.52;
      block.material.color.setRGB(value, value, value);
      block.visible = index < visibleCount;
    });
    mask.position.set(...this._lockHeadPosition(position, scale));
    mask.scale.setScalar(scale);
    mask.visible = true;
  }

  hideLockStimuli() {
    for (const id of ['lock-cue3d', 'lock-probe-detail', 'lock-probe-decoys', 'lock-noise-mask']) this.hide(id);
  }

  hitFeedback(position, correct = true) {
    const material = this._material(correct ? 0x40ff91 : 0xff4058, 1.8, 0.3, { transparent: true, opacity: 0.9 });
    const mesh = this._mesh(new THREE.SphereGeometry(0.09, 10, 8), material);
    mesh.position.set(...position);
    mesh.userData.started = performance.now();
    mesh.userData.until = mesh.userData.started + 280;
    this.transientFx.push(mesh);
  }

  render(now) {
    const fixation = this.targets.get('lock-cue3d');
    if (fixation?.visible) {
      const phase = (now - (fixation.userData.started || now)) % 160;
      const on = phase < 82;
      fixation.material.opacity = on ? 1 : 0.32;
      fixation.scale.setScalar(on ? 1.18 : 0.82);
    }
    this.transientFx = this.transientFx.filter(mesh => {
      if (now > mesh.userData.until) {
        this.world.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        return false;
      }
      const progress = (now - mesh.userData.started) / (mesh.userData.until - mesh.userData.started);
      mesh.scale.setScalar(1 + progress * 4);
      mesh.material.opacity = 1 - progress;
      return true;
    });
    this._syncLabels();
    this.renderer.render(this.scene, this.camera);
  }
};
