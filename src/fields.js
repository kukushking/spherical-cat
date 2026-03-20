// Vector field definitions on the unit sphere (y-up convention).
// Each field function takes a point (x, y, z) on the unit sphere
// and returns a tangent vector [vx, vy, vz].

function tangentProject(px, py, pz, vx, vy, vz) {
  const dot = vx * px + vy * py + vz * pz;
  return [vx - dot * px, vy - dot * py, vz - dot * pz];
}

export const fields = {
  rotation: {
    name: 'Two Vortices',
    description:
      'Hair swirls around the vertical axis, creating two vortex singularities at the poles \u2014 like hurricanes on a planet. Each has index\u00A0+1, summing to the required\u00A02.',
    fn: (x, y, z) => [z, 0, -x], // y_hat x p, already tangent
    singularities: [
      [0, 1, 0],
      [0, -1, 0],
    ],
  },

  northward: {
    name: 'Source & Sink',
    description:
      'All hair is combed upward. A source emerges at the south pole and a sink at the north \u2014 two unavoidable bald spots, each with index\u00A0+1.',
    fn: (x, y, z) => tangentProject(x, y, z, 0, 1, 0),
    singularities: [
      [0, 1, 0],
      [0, -1, 0],
    ],
  },

  cowlick: {
    name: 'Single Cowlick',
    description:
      'Via stereographic projection the hair flows nearly uniformly \u2014 but all the \u201Cdebt\u201D collects at one point, forming a single index\u00A0+2 cowlick at the top.',
    fn: (x, y, z) => {
      if (y > 0.9999) return [0, 0, 0];
      const d = 1 - y;
      const X = x / d;
      const Z = z / d;
      const s = 1 + X * X + Z * Z;
      const s2 = s * s;
      // Pushforward of constant field (1,0) in the stereographic (X,Z) plane
      return [
        2 * (1 + Z * Z - X * X) / s2,
        4 * X / s2,
        -4 * X * Z / s2,
      ];
    },
    singularities: [[0, 1, 0]],
  },

  spiral: {
    name: 'Spirals',
    description:
      'Blending rotation with upward combing creates two spiral singularities at the poles \u2014 each a swirling vortex that draws hair inward.',
    fn: (x, y, z) => {
      const [nx, ny, nz] = tangentProject(x, y, z, 0, 1, 0);
      return [z + nx, ny, -x + nz];
    },
    singularities: [
      [0, 1, 0],
      [0, -1, 0],
    ],
  },
};
