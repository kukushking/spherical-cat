import * as THREE from 'three';

// Fibonacci sphere produces ~evenly spaced points on a unit sphere.
function fibonacciSphere(n) {
  const pts = new Float32Array(n * 3);
  const golden = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(1 - y * y);
    const theta = 2 * Math.PI * i / golden;
    pts[i * 3] = Math.cos(theta) * r;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = Math.sin(theta) * r;
  }
  return pts;
}

const BASE_COLOR = new THREE.Color(0xff8c42);
const TIP_COLOR = new THREE.Color(0xaa5500);
const SING_COLOR = new THREE.Color(0xff1744);

/**
 * Compute raw position / color arrays for hair line-segments.
 * Returns { positions: Float32Array, colors: Float32Array }.
 */
export function computeHairData(fieldFn, numHairs, hairLength, segments) {
  const pts = fibonacciSphere(numHairs);
  const verticesPerHair = segments * 2; // LineSegments uses pairs
  const totalVerts = numHairs * verticesPerHair;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  // --- Pass 1: magnitudes & directions ---
  const mags = new Float32Array(numHairs);
  const dirs = new Float32Array(numHairs * 3);
  let maxMag = 0;

  for (let i = 0; i < numHairs; i++) {
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2];
    const [vx, vy, vz] = fieldFn(px, py, pz);
    const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
    mags[i] = mag;
    if (mag > 1e-8) {
      dirs[i * 3] = vx / mag;
      dirs[i * 3 + 1] = vy / mag;
      dirs[i * 3 + 2] = vz / mag;
    }
    if (mag > maxMag) maxMag = mag;
  }

  // --- Pass 2: build geometry ---
  const curve = new Float32Array((segments + 1) * 3); // reused per hair
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();

  for (let i = 0; i < numHairs; i++) {
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2];
    const tx = dirs[i * 3], ty = dirs[i * 3 + 1], tz = dirs[i * 3 + 2];

    // Normalize magnitude with sqrt compression so most hairs stay visible
    const normMag = maxMag > 0 ? Math.pow(mags[i] / maxMag, 0.4) : 0;
    const len = hairLength * normMag;

    // Build curved hair: tangent direction + gentle outward lift
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      curve[j * 3] = px * 1.003 + t * len * tx + t * t * 0.022 * px;
      curve[j * 3 + 1] = py * 1.003 + t * len * ty + t * t * 0.022 * py;
      curve[j * 3 + 2] = pz * 1.003 + t * len * tz + t * t * 0.022 * pz;
    }

    // Fill line-segment pairs
    const off = i * verticesPerHair * 3;
    const singFactor = 1 - Math.min(normMag * 2.5, 1); // 0 = normal, 1 = singularity

    for (let j = 0; j < segments; j++) {
      const si = off + j * 6;
      positions[si] = curve[j * 3];
      positions[si + 1] = curve[j * 3 + 1];
      positions[si + 2] = curve[j * 3 + 2];
      positions[si + 3] = curve[(j + 1) * 3];
      positions[si + 4] = curve[(j + 1) * 3 + 1];
      positions[si + 5] = curve[(j + 1) * 3 + 2];

      const t1 = j / segments;
      const t2 = (j + 1) / segments;
      c1.lerpColors(BASE_COLOR, TIP_COLOR, t1).lerp(SING_COLOR, singFactor);
      c2.lerpColors(BASE_COLOR, TIP_COLOR, t2).lerp(SING_COLOR, singFactor);

      colors[si] = c1.r; colors[si + 1] = c1.g; colors[si + 2] = c1.b;
      colors[si + 3] = c2.r; colors[si + 4] = c2.g; colors[si + 5] = c2.b;
    }
  }

  return { positions, colors };
}

/** Create a THREE.LineSegments mesh from hair data. */
export function createHairMesh(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions.slice(), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors.slice(), 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88 });
  return new THREE.LineSegments(geo, mat);
}
