# You Can't Comb the Hair on a Spherical Cat

An interactive 3D visualization of the **Hairy Ball Theorem** — the topological result that any continuous tangent vector field on a sphere must have at least one zero.

In other words: no matter how you try to comb a hairy sphere, there will always be at least one cowlick or bald spot.

Inspired by [Evan Chen's Napkin](https://github.com/vEnhance/napkin).

**Live demo:** https://kukushking.github.io/spherical-cat/

## Usage

Drag to rotate, scroll to zoom. Switch between four vector field configurations to see different singularity patterns:

- **Two Vortices** — rotation field with hurricane-like poles
- **Source & Sink** — upward combing with bald spots at top and bottom
- **Single Cowlick** — nearly uniform flow with one index-2 singularity
- **Spirals** — swirling vortices at the poles

Red pulsing dots mark the singularities — points where the vector field is zero.

## Run locally

```
python3 -m http.server 8080
```

Open http://localhost:8080. No build step or dependencies to install — Three.js loads from CDN.
