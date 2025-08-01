// Procedural 3D Forest Walk – p5.js (WEBGL)
// Genie 2025, updated for endless/procedural grid, arty style, vibrant HSB, and smooth geometry
// p5.js 1.6+, WEBGL mode

// ====== GLOBALS AND CONSTANTS ======
const CELL_SIZE = 400;          // Size of grid cell for procedural generation
const RENDER_RADIUS = 3;        // How many cells out to generate/draw
const DRAW_DIST = CELL_SIZE * RENDER_RADIUS * 1.1; // Max draw distance
const DRAW_DIST2 = DRAW_DIST * DRAW_DIST;
const TREE_DENSITY = 8;         // Trees per cell (approx)
const FLOWER_DENSITY = 7;       // (now unused, per-cluster)
const ANIMAL_DENSITY = 3;       // Animals per cell (denser)

let camX = 0, camY = 90, camZ = 0; // Player position
let camAngle = 0;                  // Yaw
let camPitch = 0;                  // Pitch (mouse look)
let looking = false;               // Pointer lock state

let invertY = false;

const BASE_SPEED = 8;
const SPRINT_SPEED = 16;

let cellMap = new Map();           // "cx,cz" -> {trees, flowers, animals}

// ====== P5 SETUP ======
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 1); // For pastel/vivid hues
  angleMode(RADIANS);
  noStroke();
  const invertBox = document.getElementById('invertY');
  if (invertBox) {
    invertY = invertBox.checked;
    invertBox.addEventListener('change', () => {
      invertY = invertBox.checked;
    });
  }
}

// ====== WINDOW RESIZE ======
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ====== MAIN DRAW LOOP ======
function draw() {
  background(210, 40, 94); // Pastel sky blue (HSB)

  // --- Lighting: moodier/darker forest ---
  ambientLight(15, 20, 25);
  directionalLight(180, 140, 110, -0.4, -1, -0.3); // warm, soft
  directionalLight(80, 120, 150, 0.6, -0.8, 0.2);  // cool rim

  // --- Camera look vector
  let lookX = camX + cos(camAngle) * cos(camPitch);
  let lookY = camY + sin(camPitch);
  let lookZ = camZ + sin(camAngle) * cos(camPitch);

  camera(camX, camY, camZ, lookX, lookY, lookZ, 0, -1, 0);

  // --- Simple atmospheric fog (optional) ---
  push();
  translate(0, -1, 0); // Move fog plane slightly below ground to avoid flicker
  rotateX(-HALF_PI);
  fill(210, 40, 95, 0.18); // Fog color, semi-transparent
  noStroke();
  plane(CELL_SIZE * (RENDER_RADIUS+2), CELL_SIZE * (RENDER_RADIUS+2));
  pop();

  // --- Movement per frame, synced with draw ---
  movementStep();

  // --- Procedural generation of visible cells ---
  let playerCX = Math.floor(camX / CELL_SIZE);
  let playerCZ = Math.floor(camZ / CELL_SIZE);

  // Ensure cells in radius R exist
  for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
    for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
      ensureCell(playerCX + dx, playerCZ + dz);
    }
  }

  // --- Draw all objects (and ground) in visible cells ---
  for (let [key, cell] of cellMap.entries()) {
    let [cx, cz] = key.split(',').map(Number);
    let ox = cx * CELL_SIZE;
    let oz = cz * CELL_SIZE;

    // Draw ground tile for this cell
    drawGroundCell(cx, cz);

    // Trees
    for (let t of cell.trees) {
      let tx = ox + t.x, tz = oz + t.z;
      if (squaredDist(tx, tz, camX, camZ) < DRAW_DIST2) {
        drawTree(tx, tz, t);
      }
    }
    // Flowers
    for (let f of cell.flowers) {
      let fx = ox + f.x, fz = oz + f.z;
      if (squaredDist(fx, fz, camX, camZ) < DRAW_DIST2) {
        drawFlower(fx, fz, f);
      }
    }
    // Animals
    for (let a of cell.animals) {
      let ax = ox + a.x, az = oz + a.z;
      if (squaredDist(ax, az, camX, camZ) < DRAW_DIST2) {
        drawAnimal(ax, az, a);
      }
    }
  }
}

// ====== MOVEMENT AND CAMERA CONTROLS ======
function movementStep() {
  let speed = keyIsDown(SHIFT) ? SPRINT_SPEED : BASE_SPEED;
  // Forward
  if (keyIsPressedOrDown("W", UP_ARROW)) {
    camX += cos(camAngle) * speed;
    camZ += sin(camAngle) * speed;
  }
  // Backward
  if (keyIsPressedOrDown("S", DOWN_ARROW)) {
    camX -= cos(camAngle) * speed;
    camZ -= sin(camAngle) * speed;
  }
  // Strafe left
  if (keyIsPressedOrDown("A", LEFT_ARROW)) {
    camX += cos(camAngle + HALF_PI) * speed * 0.8;
    camZ += sin(camAngle + HALF_PI) * speed * 0.8;
  }
  // Strafe right
  if (keyIsPressedOrDown("D", RIGHT_ARROW)) {
    camX += cos(camAngle - HALF_PI) * speed * 0.8;
    camZ += sin(camAngle - HALF_PI) * speed * 0.8;
  }
}

function keyIsPressedOrDown(...keys) {
  // Helper for multiple keys (keyCode or string)
  for (let k of keys) {
    if (typeof k === "number" ? keyIsDown(k) : keyIsDown(k.charCodeAt(0))) return true;
  }
  return false;
}

function keyPressed() {
  // Mouse capture
  if (key === " " && !looking) {
    looking = true;
    requestPointerLock();
  }
}
function mousePressed() {
  if (!looking) {
    looking = true;
    requestPointerLock();
  }
}
function mouseDragged() {
  if (looking) {
    camAngle += movedX * 0.003;
    const factor = invertY ? -1 : 1;
    camPitch = constrain(camPitch - movedY * 0.003 * factor, -PI/2.2, PI/2.2);
  }
}
function mouseMoved() {
  if (looking && (abs(movedX) > 0 || abs(movedY) > 0)) {
    camAngle += movedX * 0.003;
    const factor = invertY ? -1 : 1;
    camPitch = constrain(camPitch - movedY * 0.003 * factor, -PI/2.2, PI/2.2);
  }
}
function keyReleased() {
  // Escape releases mouse
  if (keyCode === 27) {
    looking = false;
    exitPointerLock();
  }
}
function exitPointerLock() {
  if (document.exitPointerLock) document.exitPointerLock();
}
function requestPointerLock() {
  let c = document.querySelector("canvas");
  if (c && c.requestPointerLock) c.requestPointerLock();
}

// ====== CELL MANAGEMENT AND SEEDED RANDOM ======

// Returns a deterministic float in [0,1) for given ints and salt (Mulberry32 hash)
function seededRandom(ix, iz, salt=0) {
  // Simple, good PRNG for deterministic, grid-based randomness
  let h = 1779033703 ^ ix;
  h = Math.imul(h ^ 0x85ebca6b, 0xc2b2ae35);
  h = Math.imul(h ^ 0x27d4eb2f ^ iz, 0xc2b2ae35);
  h = Math.imul(h ^ 0x165667b1 ^ salt, 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967296);
}
// Frac part
function fract(x) { return x - Math.floor(x); }

function cellKey(cx, cz) { return `${cx},${cz}`; }

// Ensure a cell is generated and stored in cellMap
function ensureCell(cx, cz) {
  let key = cellKey(cx, cz);
  if (cellMap.has(key)) return;
  cellMap.set(key, generateCell(cx, cz));
}

// Generate cell objects deterministically
function canPlace(x, z, occupied, minSq) {
  // Returns true if (x,z) is at least sqrt(minSq) away from all in occupied[]
  for (let p of occupied) {
    let dx = x - p.x, dz = z - p.z;
    if (dx*dx + dz*dz < minSq) return false;
  }
  return true;
}

function generateCell(cx, cz) {
  let trees = [], flowers = [], animals = [];
  let occupied = [];
  // --- Trees (min dist 50) ---
  let treeTries = 0;
  for (let i = 0; i < TREE_DENSITY; i++) {
    let placed = false;
    for (let t = 0; t < 15; t++) {
      let rx = seededRandom(cx, cz, 101 + i + t*10000) * CELL_SIZE;
      let rz = seededRandom(cx, cz, 302 + i + t*10000) * CELL_SIZE;
      let x = rx - CELL_SIZE / 2, z = rz - CELL_SIZE / 2;
      if (canPlace(x, z, occupied, 50*50)) {
        let variantR = seededRandom(cx, cz, 1000 + i + t*10000);
        let type = variantR < 0.38 ? "pine" : (variantR < 0.7 ? "oak" : "birch");
        let tObj = {
          type: type,
          x: x,
          z: z,
          size: 2.0 + seededRandom(cx, cz, 4000 + i + t*10000) * 1.5, // 2.0 to 3.5
          colSeed: seededRandom(cx, cz, 7000 + i + t*10000)
        };
        trees.push(tObj);
        occupied.push({x, z});
        placed = true;
        break;
      }
    }
    treeTries++;
  }
  // --- Animals (min dist 70 from anything) ---
  for (let i = 0; i < ANIMAL_DENSITY; i++) {
    let placed = false;
    for (let t = 0; t < 15; t++) {
      let rx = seededRandom(cx, cz, 1201 + i + t*10000) * CELL_SIZE;
      let rz = seededRandom(cx, cz, 1301 + i + t*10000) * CELL_SIZE;
      let x = rx - CELL_SIZE / 2, z = rz - CELL_SIZE / 2;
      if (canPlace(x, z, occupied, 70*70)) {
        let variantR = seededRandom(cx, cz, 1400 + i + t*10000);
        let type = variantR < 0.5 ? "rabbit" : "deer";
        let aObj = {
          type: type,
          x: x,
          z: z,
          size: type === "rabbit"
            ? 0.86 + 0.22 * seededRandom(cx, cz, 1500 + i + t*10000)
            : 1.45 + 0.65 * seededRandom(cx, cz, 1600 + i + t*10000),
          colSeed: seededRandom(cx, cz, 1700 + i + t*10000),
          idlePhase: TWO_PI * seededRandom(cx, cz, 1800 + i + t*10000)
        };
        animals.push(aObj);
        occupied.push({x, z});
        placed = true;
        break;
      }
    }
  }
  // --- Flower patches (clusters) ---
  let CLUSTERS = 2 + Math.floor(seededRandom(cx, cz, 1337) * 3); // 2-4 clusters
  for (let c = 0; c < CLUSTERS; c++) {
    // Random cluster center, must avoid other clusters/objects by 40*40
    let clusterPlaced = false;
    let clusterCenterX, clusterCenterZ;
    for (let tryC = 0; tryC < 15; tryC++) {
      let rx = seededRandom(cx, cz, 2101 + c + tryC*10000) * CELL_SIZE;
      let rz = seededRandom(cx, cz, 2201 + c + tryC*10000) * CELL_SIZE;
      let x = rx - CELL_SIZE / 2, z = rz - CELL_SIZE / 2;
      if (canPlace(x, z, occupied, 40*40)) {
        clusterCenterX = x;
        clusterCenterZ = z;
        occupied.push({x, z});
        clusterPlaced = true;
        break;
      }
    }
    if (!clusterPlaced) continue;
    // Place flowers in cluster
    let clusterSize = 6 + Math.floor(seededRandom(cx, cz, 2300 + c) * 7); // 6-12 per cluster
    let baseHue = fract(seededRandom(cx, cz, 888 + c) + 0.11 * c) * 360;
    for (let f = 0; f < clusterSize; f++) {
      let ang = seededRandom(cx, cz, 2400 + c*100 + f) * TWO_PI;
      let rad = 6 + seededRandom(cx, cz, 2500 + c*100 + f) * 16; // within radius 22
      let x = clusterCenterX + cos(ang) * rad;
      let z = clusterCenterZ + sin(ang) * rad;
      // Only check min 12*12 from other occupied objects (but not within-cluster)
      if (canPlace(x, z, occupied, 20*20)) {
        let ftype = seededRandom(cx, cz, 2600 + c*100 + f) < 0.5 ? "sphere" : "torus";
        let colh = (baseHue + seededRandom(cx, cz, 888 + c*100 + f) * 32) % 360;
        let cols = 65 + 30 * seededRandom(cx, cz, 889 + c*100 + f);
        let colb = 80 + 18 * seededRandom(cx, cz, 890 + c*100 + f);
        let fObj = {
          type: ftype,
          x: x,
          z: z,
          size: 0.85 + 0.8 * seededRandom(cx, cz, 8010 + c*100 + f),
          h: colh, s: cols, b: colb
        };
        flowers.push(fObj);
        occupied.push({x, z});
      }
    }
  }
  return {trees, flowers, animals};
}

// Squared distance helper
function squaredDist(x1, z1, x2, z2) {
  let dx = x1 - x2, dz = z1 - z2;
  return dx*dx + dz*dz;
}

// --- Draw a ground tile for cell (cx, cz) ---
function drawGroundCell(cx, cz) {
  push();
  translate(cx * CELL_SIZE, 0, cz * CELL_SIZE);
  rotateX(-HALF_PI);
  fill(120, 38, 55);
  plane(CELL_SIZE, CELL_SIZE);
  pop();
}

// ====== OBJECT DRAW HELPERS (ALL OBJECTS SIT ON GROUND) ======

// --- TREE: Pacific-NW tall, thick, colourful, arty foliage, all variants
function drawTree(x, z, t) {
  push();
  translate(x, 0, z);

  // Pastel trunk color by colSeed
  let trunkH, trunkR, foliageY;
  let baseHue = fract(t.colSeed + 0.13) * 50 + 20;
  let trunkColor = color(baseHue, 28, 68);

  if (t.type === "pine") {
    trunkH = 120 * t.size;
    trunkR = 6 * t.size;
    // Place trunk so bottom is at y=0:
    push();
    translate(0, trunkH/2, 0);
    ambientMaterial(trunkColor);
    cylinder(trunkR, trunkH, 16, 1, false);
    pop();
    // Foliage: 4-5 stacked cones, large radii
    let numCones = 4 + Math.floor(fract(t.colSeed + 0.39) * 2); // 4-5
    let baseY = trunkH + 20 * t.size;
    let mainHue = fract(t.colSeed + 0.27) * 60 + 100;
    for (let i = 0; i < numCones; i++) {
      let y = baseY - i*38*t.size;
      let rad = 28 - i*4.2; // start large, taper
      let h = 58 - i*7;
      let col = color(mainHue + 8*i, 55 + 15*i, 78 - 8*i);
      push();
      translate(0, y, 0);
      ambientMaterial(col);
      cone(rad * t.size, h * t.size, 18, 2, false);
      pop();
    }
    // Arty: pastel torus "rings"
    push();
    translate(0, baseY + 19*t.size, 0);
    rotateX(HALF_PI);
    ambientMaterial(mainHue+32, 40, 96, 0.17);
    torus(21*t.size, 4.8*t.size, 28, 10);
    pop();
  } else if (t.type === "oak") {
    trunkH = 70 * t.size;
    trunkR = 11 * t.size;
    push();
    translate(0, trunkH/2, 0);
    ambientMaterial(trunkColor);
    cylinder(trunkR, trunkH, 16, 1, false);
    pop();
    // Foliage: 2 massive pastel spheres
    let mainHue = fract(t.colSeed + 0.41) * 60 + 90;
    let folY = trunkH + 43*t.size;
    for (let i = 0; i < 2; i++) {
      let y = folY - i*17*t.size;
      let rad = 50 + 13*i;
      let col = color(mainHue + 14*i, 55 + 22*i, 88 - 8*i);
      push();
      translate(0, y, 0);
      ambientMaterial(col);
      sphere(rad * t.size, 20, 18);
      pop();
    }
    // Arty: torus for halo
    push();
    translate(0, folY + 15*t.size, 0);
    rotateX(HALF_PI);
    ambientMaterial(mainHue+22, 30, 97, 0.09);
    torus(34*t.size, 3.1*t.size, 26, 10);
    pop();
  } else if (t.type === "birch") {
    trunkH = 80 * t.size;
    trunkR = 8 * t.size;
    // Trunk: white with black stripes, pastel
    let birchHue = (baseHue + 7) % 360;
    push();
    translate(0, trunkH/2, 0);
    ambientMaterial(0, 0, 98);
    cylinder(trunkR, trunkH, 14, 1, false);
    // Black stripes
    for (let i=0; i<7; i++) {
      let y = -trunkH/2 + trunkH * (i+0.5)/8;
      push();
      translate(0, y, trunkR+0.2);
      rotateX(HALF_PI);
      fill(0, 0, 18);
      ellipse(0,0, trunkR*1.9, 1.5);
      pop();
    }
    pop();
    // Foliage: 2 big pastel green spheres + torus
    let mainHue = fract(t.colSeed + 0.19) * 30 + 85;
    let folY = trunkH + 28*t.size;
    for (let i = 0; i < 2; i++) {
      let y = folY - i*13*t.size;
      let rad = 28 + 7*i;
      let col = color(mainHue + 9*i, 40 + 15*i, 98 - 12*i);
      push();
      translate(0, y, 0);
      ambientMaterial(col);
      sphere(rad * t.size, 18, 14);
      pop();
    }
    push();
    translate(0, folY + 12*t.size, 0);
    rotateX(HALF_PI);
    ambientMaterial(mainHue+10, 27, 85, 0.11);
    torus(18*t.size, 2.5*t.size, 18, 8);
    pop();
  }
  pop();
}

// --- FLOWER: bold, smooth, pastel stem and vivid bloom
function drawFlower(x, z, f) {
  push();
  translate(x, 0, z);
  // Stem: pastel green, bottom at y=0
  let stemH = 8 * f.size;
  let stemR = 1.2 * f.size;
  push();
  translate(0, stemH/2, 0);
  ambientMaterial(124, 28, 73, 0.77);
  cylinder(stemR, stemH, 10, 1, false);
  pop();
  // Bloom: vivid, arty shape
  let bloomY = stemH + 2.5*f.size;
  let bloomCol = color(f.h, f.s, f.b);
  if (f.type === "sphere") {
    push();
    translate(0, bloomY, 0);
    ambientMaterial(bloomCol);
    sphere(4.1 * f.size, 12, 10);
    // Stamen: tiny pastel yellow sphere
    push();
    translate(0, -2.2*f.size, 0);
    ambientMaterial(51, 38, 99);
    sphere(1.2*f.size, 7, 5);
    pop();
    pop();
  } else {
    push();
    translate(0, bloomY, 0);
    rotateX(HALF_PI);
    ambientMaterial(bloomCol);
    torus(2.7*f.size, 1.3*f.size, 14, 10);
    // Center dot
    push();
    rotateX(HALF_PI);
    translate(0, 0, 1.35*f.size);
    ambientMaterial(51, 38, 99);
    sphere(1.3*f.size, 7, 5);
    pop();
    pop();
  }
  pop();
}

// --- ANIMAL: smooth abstract shapes, no boxes, arty pastel
function drawAnimal(x, z, a) {
  push();
  // Correct orientation: baseline on ground, then bob
  translate(x, 0, z);
  let t = millis() * 0.001 + a.idlePhase;
  let bobY = sin(t * 1.2) * (1.5 * a.size);
  translate(0, bobY, 0);

  let mainHue = fract(a.colSeed + 0.18) * 40 + 18;
  let pastel = color(mainHue, 24, 81);
  if (a.type === "rabbit") {
    scale(a.size);
    // Body
    push();
    translate(0, 7, 0);
    ambientMaterial(pastel);
    sphere(7.8, 16, 14);
    pop();
    // Head
    push();
    translate(0, -3.8, 6.3);
    ambientMaterial(mainHue, 14, 98);
    sphere(4.2, 12, 10);
    pop();
    // Ears (cylinders)
    for (let side of [-1, 1]) {
      push();
      translate(2.1*side, -10.5, 7.5);
      rotateZ(side*0.10);
      rotateX(-PI/16);
      ambientMaterial(mainHue+13, 32, 99);
      cylinder(1.35, 8, 8, 1, false);
      pop();
    }
    // Tail
    push();
    translate(0, 8.6, -6.2);
    ambientMaterial(40, 6, 99);
    sphere(2.3, 7, 5);
    pop();
  } else if (a.type === "deer") {
    scale(a.size);
    // Body
    push();
    translate(0, 6.2, 0);
    ambientMaterial(mainHue+7, 17, 87);
    sphere(10.2, 18, 14);
    pop();
    // Neck
    push();
    translate(0, -5, 7.7);
    rotateX(-PI/7);
    ambientMaterial(mainHue+12, 12, 97);
    cylinder(2.8, 10, 10, 1, false);
    // Head
    translate(0, -7.5, 0);
    sphere(5.7, 12, 10);
    // Ears (cylinders)
    for (let side of [-1, 1]) {
      push();
      translate(2.2 * side, -3.2, 2.7);
      rotateZ(side*0.18);
      ambientMaterial(mainHue+20, 11, 98);
      cylinder(0.9, 5, 8, 1, false);
      pop();
    }
    pop();
    // Legs (simple, 4 pastel cylinders)
    for (let side of [-1, 1]) {
      for (let f of [1, -1]) {
        push();
        translate(3.9 * side, 15.7, 5.2 * f);
        ambientMaterial(mainHue+3, 7, 96);
        cylinder(0.95, 12, 8, 1, false);
        pop();
      }
    }
    // Tail
    push();
    translate(0, 8.9, -8.2);
    ambientMaterial(43, 5, 98);
    sphere(1.8, 6, 5);
    pop();
    // Abstract antlers (2 airy torus loops)
    for (let side of [-1,1]) {
      push();
      translate(2.9*side, -16.3, 5.1);
      rotateZ(side * 0.35);
      rotateX(-PI/3.5);
      ambientMaterial(mainHue+21, 20, 99, 0.35);
      torus(2.7, 0.36, 10, 4);
      pop();
    }
  }
  pop();
}