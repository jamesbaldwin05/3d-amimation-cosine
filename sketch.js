// Procedural 3D Flower Field – p5.js (WEBGL)
// Genie 2025, vibrant HSB, clusters and singles, 3D flowers
// p5.js 1.6+, WEBGL mode

// ====== GLOBALS AND CONSTANTS ======
const CELL_SIZE = 400;          // Size of grid cell for procedural generation
const RENDER_RADIUS = 3;        // How many cells out to generate/draw
const DRAW_DIST = CELL_SIZE * RENDER_RADIUS * 1.1; // Max draw distance
const DRAW_DIST2 = DRAW_DIST * DRAW_DIST;

let camX = 0, camY = 90, camZ = 0; // Player position
let camAngle = 0;                  // Yaw
let camPitch = 0;                  // Pitch (mouse look)
let looking = false;               // Pointer lock state

let invertY = true;

const BASE_SPEED = 8;
const SPRINT_SPEED = 16;

let cellMap = new Map();           // "cx,cz" -> {flowers}

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

  // --- Lighting: moody, but bright for flowers ---
  ambientLight(40, 30, 40);
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

  // --- Draw all objects (and ground & flowers) in visible cells ---
  for (let [key, cell] of cellMap.entries()) {
    let [cx, cz] = key.split(',').map(Number);
    let ox = cx * CELL_SIZE;
    let oz = cz * CELL_SIZE;

    // Draw ground tile for this cell
    drawGroundCell(cx, cz);

    // Draw all flowers in the cell
    for (let f of cell.flowers) {
      let fx = ox + f.x, fz = oz + f.z;
      if (squaredDist(fx, fz, camX, camZ) < DRAW_DIST2) {
        drawFlower(fx, fz, f);
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
function fract(x) { return x - Math.floor(x); }

function cellKey(cx, cz) { return `${cx},${cz}`; }

function ensureCell(cx, cz) {
  let key = cellKey(cx, cz);
  if (cellMap.has(key)) return;
  cellMap.set(key, generateCell(cx, cz));
}

// --- Place with minimum squared distance between points
function canPlace(x, z, placed, minSq) {
  for (let p of placed) {
    let dx = x - p.x, dz = z - p.z;
    if (dx*dx + dz*dz < minSq) return false;
  }
  return true;
}

// ====== FLOWER FIELD GENERATION ======
function generateCell(cx, cz) {
  const flowers = [];
  const placedFlowers = [];

  // --- Generate clusters (2–4 per cell) ---
  let clusterCount = 2 + Math.floor(seededRandom(cx, cz, 1010) * 3); // 2–4
  const clusterR = 35; // cluster radius

  for (let cl = 0; cl < clusterCount; cl++) {
    // Random cluster center within cell
    let crx = seededRandom(cx, cz, 2000 + cl*7) * (CELL_SIZE - 2*clusterR) + clusterR - CELL_SIZE/2;
    let crz = seededRandom(cx, cz, 3000 + cl*13) * (CELL_SIZE - 2*clusterR) + clusterR - CELL_SIZE/2;
    let flowerCount = 5 + Math.floor(seededRandom(cx, cz, 4000 + cl*17) * 11); // 5–15

    for (let fi = 0; fi < flowerCount; fi++) {
      let angle = seededRandom(cx, cz, 5000 + cl*23 + fi*3) * TWO_PI;
      let dist = seededRandom(cx, cz, 6000 + cl*31 + fi*5) * (clusterR * 0.85);
      // Small random offsets around center
      let fx = crx + cos(angle) * dist + (seededRandom(cx, cz, 7000 + cl*19 + fi*9) - 0.5) * 8;
      let fz = crz + sin(angle) * dist + (seededRandom(cx, cz, 8000 + cl*21 + fi*11) - 0.5) * 8;

      // Store flower properties
      flowers.push(makeFlower(cx, cz, cl, fi, fx, fz));
      placedFlowers.push({x: fx, z: fz});
    }
  }

  // --- Generate singles (3–6 per cell, not inside any cluster radius) ---
  let singleCount = 3 + Math.floor(seededRandom(cx, cz, 9001) * 4); // 3–6

  for (let si = 0, tries = 0; si < singleCount && tries < 30; tries++) {
    let fx = seededRandom(cx, cz, 9100 + si*3 + tries*11) * CELL_SIZE - CELL_SIZE/2;
    let fz = seededRandom(cx, cz, 9200 + si*5 + tries*17) * CELL_SIZE - CELL_SIZE/2;

    // Must not overlap clusters
    if (canPlace(fx, fz, placedFlowers, (clusterR+5)*(clusterR+5))) {
      flowers.push(makeFlower(cx, cz, 100+si, tries, fx, fz));
      placedFlowers.push({x: fx, z: fz});
      si++;
    }
  }

  return {flowers};
}

// Helper: create a flower object
function makeFlower(cx, cz, saltA, saltB, x, z) {
  let seedBase = 12000 + cx*13 + cz*17 + saltA*23 + saltB*31;
  let size = 0.7 + seededRandom(cx, cz, seedBase) * 0.7; // 0.7–1.4
  let hue = Math.floor(seededRandom(cx, cz, seedBase+1) * 360);
  let sat = 60 + seededRandom(cx, cz, seedBase+2) * 38; // 60–98
  let bri = 70 + seededRandom(cx, cz, seedBase+3) * 28; // 70–98
  let tiltX = (seededRandom(cx, cz, seedBase+4) - 0.5) * 0.5; // -0.25..0.25
  let tiltZ = (seededRandom(cx, cz, seedBase+5) - 0.5) * 0.5; // -0.25..0.25
  let petalCount = 5 + Math.floor(seededRandom(cx, cz, seedBase+6) * 4); // 5–8
  return {x, z, size, h: hue, s: sat, b: bri, tiltX, tiltZ, petalCount};
}

// Squared distance helper
function squaredDist(x1, z1, x2, z2) {
  let dx = x1 - x2, dz = z1 - z2;
  return dx*dx + dz*dz;
}

// ====== DRAW GROUND ======
function drawGroundCell(cx, cz) {
  push();
  translate(cx * CELL_SIZE, 0, cz * CELL_SIZE);
  rotateX(-HALF_PI);
  fill(120, 38, 55);
  plane(CELL_SIZE, CELL_SIZE);
  pop();
}

// ====== DRAW FLOWER ======
function drawFlower(x, z, f) {
  push();
  translate(x, 0, z);

  // Apply tilt (stem leaning)
  rotateX(f.tiltX);
  rotateZ(f.tiltZ);

  // Stem: green cylinder (height 10*size, radius 1*size)
  let stemH = 10 * f.size;
  let stemR = 1 * f.size;
  push();
  translate(0, stemH/2, 0);
  ambientMaterial(110, 56, 55, 0.92);
  cylinder(stemR, stemH, 11, 1, false);
  pop();

  // Petals: cones, arranged radially
  let bloomY = stemH + 0.5 * f.size;
  let petalColor = color(f.h, f.s, f.b);
  let petalRad = 2 * f.size;
  let petalLen = 4 * f.size;
  let petalDist = 3.5 * f.size;

  push();
  translate(0, bloomY, 0);
  for (let i = 0; i < f.petalCount; i++) {
    push();
    let ang = i * TWO_PI / f.petalCount;
    rotateY(ang);
    translate(petalDist, 0, 0);
    rotateZ(HALF_PI); // Lay petals horizontally
    ambientMaterial(petalColor);
    cone(petalRad, petalLen, 16, 2, false);
    pop();
  }
  // Center: small yellow sphere
  ambientMaterial(54, 92, 97);
  sphere(1.3 * f.size, 12, 9);
  pop();

  pop();
}