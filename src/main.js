import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fields } from './fields.js';
import { computeHairData, createHairMesh } from './hair.js';

// --- Config ---
const NUM_HAIRS = 2500;
const HAIR_LENGTH = 0.14;
const HAIR_SEGMENTS = 3;
const TRANSITION_SECS = 0.55;

// --- State ---
let scene, camera, renderer, controls, clock;
let hairMesh, singularityGroup;
let currentField = 'rotation';
let transition = null;

init();
requestAnimationFrame(animate);

// ----------------------------- Setup -----------------------------

function init() {
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();
  scene.background = createGradientTexture();

  // Camera
  camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0.0, 3.2);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2;
  controls.maxDistance = 6;

  // Lights
  scene.add(new THREE.AmbientLight(0x404060, 0.7));
  const key = new THREE.DirectionalLight(0xfff0dd, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8090ff, 0.35);
  fill.position.set(-4, 0, -2);
  scene.add(fill);
  const rim = new THREE.PointLight(0xff7040, 0.5, 10);
  rim.position.set(0, -3, -3);
  scene.add(rim);

  // Cat body
  scene.add(createCatMesh());

  // Singularity markers
  singularityGroup = new THREE.Group();
  scene.add(singularityGroup);

  // Initial field
  setField('rotation');
  setupUI();

  addEventListener('resize', onResize);
}

// ----------------------------- Cat mesh --------------------------

function createCatMesh() {
  const group = new THREE.Group();

  // Body sphere
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.92, metalness: 0.04 }),
    ),
  );

  // Ears (cones, base embedded in sphere)
  const earGeo = new THREE.ConeGeometry(0.18, 0.45, 32);
  const earMat = new THREE.MeshStandardMaterial({ color: 0xc4956a, roughness: 0.85 });
  const innerGeo = new THREE.ConeGeometry(0.1, 0.28, 32);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.8 });

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(side * 0.35, 1.08, 0.12);
    ear.rotation.set(-0.15, 0, side * 0.25);
    group.add(ear);

    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(side * 0.35, 1.09, 0.16);
    inner.rotation.set(-0.15, 0, side * 0.25);
    group.add(inner);
  }

  // Face features (flat circles projected onto sphere surface)
  const addCircle = (cx, cy, radius, color, offset) => {
    const cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
    const n = new THREE.Vector3(cx, cy, cz).normalize();
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(cx + n.x * offset, cy + n.y * offset, cz + n.z * offset);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    group.add(mesh);
  };

  // Eyes: big & cute — sclera -> iris -> pupil
  for (const side of [-1, 1]) {
    addCircle(side * 0.27, 0.15, 0.17, 0xeeeedd, 0.007);
    addCircle(side * 0.27, 0.15, 0.13, 0x66bb6a, 0.013);
    addCircle(side * 0.27, 0.15, 0.07, 0x111111, 0.019);
    // Eye shine
    addCircle(side * 0.27 + 0.04, 0.2, 0.03, 0xffffff, 0.025);
  }

  // Nose
  addCircle(0, -0.02, 0.05, 0xff69b4, 0.007);

  // Curly tail
  const tailPoints = [];
  const tailTurns = 1.6;
  const tailSegs = 40;
  for (let i = 0; i <= tailSegs; i++) {
    const t = i / tailSegs;
    const angle = t * Math.PI * 2 * tailTurns;
    const r = 0.08 + t * 0.12;
    tailPoints.push(new THREE.Vector3(
      Math.sin(angle) * r,
      -0.15 + t * 0.45,
      -1.0 - t * 0.4 + Math.cos(angle) * r,
    ));
  }
  const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 32, 0.035, 8, false);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.9, metalness: 0.04 });
  group.add(new THREE.Mesh(tailGeo, tailMat));

  return group;
}

// ----------------------------- Hair / fields ---------------------

function setField(name) {
  currentField = name;
  const field = fields[name];
  const targetData = computeHairData(field.fn, NUM_HAIRS, HAIR_LENGTH, HAIR_SEGMENTS);

  if (!hairMesh) {
    hairMesh = createHairMesh(targetData);
    scene.add(hairMesh);
  } else {
    // Smooth transition from current to target
    transition = {
      startPos: hairMesh.geometry.attributes.position.array.slice(),
      startCol: hairMesh.geometry.attributes.color.array.slice(),
      targetData,
      elapsed: 0,
    };
  }

  updateSingularities(field.singularities);
  document.getElementById('field-desc').textContent = field.description;
}

function updateSingularities(positions) {
  singularityGroup.clear();
  const geo = new THREE.SphereGeometry(0.05, 16, 16);
  for (const [x, y, z] of positions) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.85,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * 1.04, y * 1.04, z * 1.04);
    singularityGroup.add(m);
  }
}

// ----------------------------- UI --------------------------------

function setupUI() {
  const container = document.getElementById('controls');
  for (const [key, field] of Object.entries(fields)) {
    const btn = document.createElement('button');
    btn.className = 'field-btn' + (key === currentField ? ' active' : '');
    btn.textContent = field.name;
    btn.addEventListener('click', () => {
      if (key === currentField) return;
      container.querySelectorAll('.field-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setField(key);
    });
    container.appendChild(btn);
  }
  document.getElementById('field-desc').textContent = fields[currentField].description;
}

// ----------------------------- Animation -------------------------

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  controls.update();

  // Hair transition
  if (transition) {
    transition.elapsed += delta;
    const t = Math.min(transition.elapsed / TRANSITION_SECS, 1);
    const ease = t * t * (3 - 2 * t); // smoothstep

    const pos = hairMesh.geometry.attributes.position.array;
    const col = hairMesh.geometry.attributes.color.array;
    const { startPos, startCol, targetData } = transition;

    for (let i = 0, len = pos.length; i < len; i++) {
      pos[i] = startPos[i] + (targetData.positions[i] - startPos[i]) * ease;
      col[i] = startCol[i] + (targetData.colors[i] - startCol[i]) * ease;
    }
    hairMesh.geometry.attributes.position.needsUpdate = true;
    hairMesh.geometry.attributes.color.needsUpdate = true;

    if (t >= 1) transition = null;
  }

  // Pulse singularity markers
  for (const m of singularityGroup.children) {
    const pulse = Math.sin(time * 3);
    m.scale.setScalar(1 + 0.18 * pulse);
    m.material.opacity = 0.6 + 0.3 * pulse;
  }

  renderer.render(scene, camera);
}

// ----------------------------- Helpers ---------------------------

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function createGradientTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0f0c29');
  g.addColorStop(0.5, '#302b63');
  g.addColorStop(1, '#24243e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  return new THREE.CanvasTexture(c);
}
