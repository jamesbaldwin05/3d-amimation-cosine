// Procedural 3D Forest Walk – p5.js (WEBGL)
// Genie 2025, updated for endless/procedural grid, arty style, vibrant HSB, and smooth geometry
// p5.js 1.6+, WEBGL mode

// ====== GLOBALS AND CONSTANTS ======
const CELL_SIZE = 400;          // Size of grid cell for procedural generation
const RENDER_RADIUS = 3;        // How many cells out to generate/draw
const DRAW_DIST = CELL_SIZE * RENDER_RADIUS * 1.1; // Max draw distance
const DRAW_DIST2 = DRAW_DIST * DRAW_DIST;
const TREE_DENSITY = 8;         // Trees per cell (approx)
// const FLOWER_DENSITY = 7;    // (unused, per-cluster)
const ANIMAL_DENSITY = 0;       // Animals per cell (disabled)
const FLOWER_CLEAR = 190;        // px distance from path centre used to keep flowers off the path.
const FLOWER_MIN_DIST = 12;     // px minimum allowed distance between flower centers
const PATH_CLEAR_TREE = 190;    // px clearance from path centre for trees/bushes

let camX = 0, camY = 90, camZ = 0; // Player position
let camAngle = 0;                  // Yaw
let camPitch = 0;                  // Pitch (mouse look)
let looking = false;               // Pointer lock state

let invertY = true;

const BASE_SPEED = 8;
const SPRINT_SPEED = 16;

let cellMap = new Map();           // "cx,cz" -> {trees, flowers, animals}

// ====== P5 SETUP ======
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 1); // For pastel/vivid hues
  angleMode(RADIANS);
  noStroke();
}

// ====== DYNAMIC PROCEDURAL CELL GENERATION WITH PATH BANDS ======

function generateCell(cx, cz) {
  // --- Path ribbon definitions ---
  function edgeData(dir) {
    let ax = cx, az = cz, saltBase;
    if (dir === 'N')      { az -= 1; saltBase = 20000; }
    else if (dir === 'S') {         saltBase = 20000; }
    else if (dir === 'E') {         saltBase = 21000; }
    else if (dir === 'W') { ax -= 1; saltBase = 21000; }
    const PATH_PROB = 0.04;
    const rnd = seededRandom(ax, az, saltBase);
    if (rnd < PATH_PROB) {
      return {
        amp: seededRandom(ax, az, saltBase + 1) * CELL_SIZE * 0.18 + 12,
        phase: seededRandom(ax, az, saltBase + 2) * TWO_PI
      };
    }
    return null;
  }
  const paths = {
    N: edgeData('N'),
    S: edgeData('S'),
    E: edgeData('E'),
    W: edgeData('W'),
  };

  // --- Dynamic, bullet-proof path bands ---
  const PATH_HALF = 93;         // half of PATH_W in drawGroundCell
  const PATH_MARGIN = 20;       // extra safety buffer
  const maxAmpNS = Math.max(paths.N?.amp||0, paths.S?.amp||0);
  const maxAmpEW = Math.max(paths.E?.amp||0, paths.W?.amp||0);
  const bandX = (maxAmpNS > 0) ? PATH_HALF + maxAmpNS + PATH_MARGIN : 0; // for N/S
  const bandZ = (maxAmpEW > 0) ? PATH_HALF + maxAmpEW + PATH_MARGIN : 0; // for E/W

  // --- Place trees and bushes, avoiding path bands ---
  const trees = [];
  const occupied = [];

  function placeTrees(count, sizeRange, variants, minRadiusFactor, saltBase=0) {
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < 30; t++) {
        let rx = seededRandom(cx, cz, 1000 + saltBase*1000 + i*100 + t) * CELL_SIZE;
        let rz = seededRandom(cx, cz, 2000 + saltBase*1000 + i*100 + t) * CELL_SIZE;
        let x = rx - CELL_SIZE / 2, z = rz - CELL_SIZE / 2;
        let variantIndex = Math.floor(seededRandom(cx, cz, 3000 + saltBase*1000 + i*100 + t) * variants.length);
        let variant = variants[variantIndex];
        let size = sizeRange[0] + seededRandom(cx, cz, 4000 + saltBase*1000 + i*100 + t) * (sizeRange[1] - sizeRange[0]);
        let radius = minRadiusFactor + size * 10;

        // Path band clearance: absolutely forbid within band+radius
        let tooClosePath = false;
        if (bandX && Math.abs(x) < bandX + radius) tooClosePath = true;
        if (bandZ && Math.abs(z) < bandZ + radius) tooClosePath = true;
        if (tooClosePath) continue;

        if (canPlaceRadius(x, z, radius, occupied)) {
          trees.push({ type: variant, x, z, size, radius });
          occupied.push({ x, z, radius });
          placed = true;
          break;
        }
      }
    }
  }

  // Example usage:
  placeTrees(1, [4.0, 5.5], ['pine','oak'], 120, 1);
  placeTrees(5, [2.0, 3.5], ['pine','oak','birch'], 70, 2);
  placeTrees(6, [1.2, 1.9], ['pine','oak','birch'], 45, 3);
  placeTrees(4, [1.5, 2.4], ['bush'], 55, 4);

  // --- Place flowers, also using band+radius logic ---
  const flowers = [];
  let flowerOccupied = [];
  const FLOWER_SALT = 8000;
  const clusterCount = Math.floor(seededRandom(cx, cz, FLOWER_SALT + 1) * 3);

  for (let c = 0; c < clusterCount; ++c) {
    let foundCentre = false;
    let cx0 = 0, cz0 = 0;
    for (let attempt = 0; attempt < 8; ++attempt) {
      cx0 = (seededRandom(cx, cz, FLOWER_SALT + 10 + c*100 + attempt*2) - 0.5) * CELL_SIZE;
      cz0 = (seededRandom(cx, cz, FLOWER_SALT + 11 + c*100 + attempt*2) - 0.5) * CELL_SIZE;

      let tooClosePath = false;
      if ((bandX && Math.abs(cx0) < bandX + FLOWER_MIN_DIST) ||
          (bandZ && Math.abs(cz0) < bandZ + FLOWER_MIN_DIST)) tooClosePath = true;

      if (!tooClosePath && canPlaceRadius(cx0, cz0, 8, trees)) {
        foundCentre = true;
        break;
      }
    }
    if (!foundCentre) continue;

    let clusterSize;
    const clusterSizeRand = seededRandom(cx, cz, FLOWER_SALT + 100 + c*10);
    if (clusterSizeRand < 0.7) {
      clusterSize = 5 + Math.floor(seededRandom(cx, cz, FLOWER_SALT + 110 + c*10) * 11);
    } else {
      clusterSize = 1 + Math.floor(seededRandom(cx, cz, FLOWER_SALT + 120 + c*10) * 4);
    }

    for (let f = 0; f < clusterSize; ++f) {
      let fx = 0, fz = 0, placed = false;
      for (let tr = 0; tr < 3; ++tr) {
        const angle = seededRandom(cx, cz, FLOWER_SALT + 200 + c*100 + f*10 + tr) * Math.PI * 2;
        const dist  = seededRandom(cx, cz, FLOWER_SALT + 500 + c*100 + f*10 + tr) * 25;
        fx = cx0 + Math.cos(angle) * dist;
        fz = cz0 + Math.sin(angle) * dist;

        let tooClosePath = false;
        if ((bandX && Math.abs(fx) < bandX + FLOWER_MIN_DIST) ||
            (bandZ && Math.abs(fz) < bandZ + FLOWER_MIN_DIST)) tooClosePath = true;

        if (!tooClosePath && canPlaceRadius(fx, fz, FLOWER_MIN_DIST, trees.concat(flowerOccupied))) {
          placed = true;
          break;
        }
      }
      if (!placed) continue;

      // Add basic flower properties as needed; minimal version
      flowers.push({ x: fx, z: fz });
      flowerOccupied.push({ x: fx, z: fz, radius: FLOWER_MIN_DIST });
    }
  }

  // Return cell data (animals omitted for brevity)
  return { trees, flowers, paths };
}

// --- Minimal helpers for demo purposes ---
function seededRandom(ix, iz, salt=0) {
  let h = 1779033703 ^ ix;
  h = Math.imul(h ^ 0x85ebca6b, 0xc2b2ae35);
  h = Math.imul(h ^ 0x27d4eb2f ^ iz, 0xc2b2ae35);
  h = Math.imul(h ^ 0x165667b1 ^ salt, 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967296);
}
function canPlaceRadius(x, z, r, occupied) {
  for (let o of occupied) {
    let dx = x - o.x, dz = z - o.z;
    let minDist = r + (o.radius || 0);
    if ((dx*dx + dz*dz) < minDist*minDist) return false;
  }
  return true;
}
