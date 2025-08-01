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
    // Flowers and animals omitted in pure forest mode
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
  // Variable spacing by size categories, adding bushes
  const trees = [];
  const occupied = [];

  // Helper to place trees with given count, size range, variants, and min radius
  function placeTrees(count, sizeRange, variants, minRadiusFactor, saltBase=0) {
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < 30; t++) {
        // Deterministic random for each attempt
        let rx = seededRandom(cx, cz, 1000 + saltBase*1000 + i*100 + t) * CELL_SIZE;
        let rz = seededRandom(cx, cz, 2000 + saltBase*1000 + i*100 + t) * CELL_SIZE;
        let x = rx - CELL_SIZE / 2, z = rz - CELL_SIZE / 2;
        let variantIndex = Math.floor(seededRandom(cx, cz, 3000 + saltBase*1000 + i*100 + t) * variants.length);
        let variant = variants[variantIndex];
        let size = sizeRange[0] + seededRandom(cx, cz, 4000 + saltBase*1000 + i*100 + t) * (sizeRange[1] - sizeRange[0]);
        let radius = minRadiusFactor + size * 10;
        if (canPlaceRadius(x, z, radius, occupied)) {
          let tObj = {
            type: variant,
            x: x,
            z: z,
            size: size,
            colSeed: seededRandom(cx, cz, 7000 + saltBase*1000 + i*100 + t),
            radius: radius
          };
          trees.push(tObj);
          occupied.push({x, z, radius});
          placed = true;
          break;
        }
      }
    }
  }

  // Place trees by categories (large, medium, small, bushes)
  placeTrees(1, [4.0, 5.5], ['pine','oak'], 120, 1);
  placeTrees(5, [2.0, 3.5], ['pine','oak','birch'], 70, 2);
  placeTrees(6, [1.2, 1.9], ['pine','oak','birch'], 45, 3);
  placeTrees(4, [1.5, 2.4], ['bush'], 55, 4);

  // No flowers or animals in pure forest mode
  const flowers = [];
  const animals = [];

  // --- Sparse, curvy dirt paths (N/S/E/W) ---
  // Each direction: with prob ≈ 0.025, store {amp,phase}; else null
  const PATH_PROB = 0.025;
  function curvyData(dirSalt) {
    if (seededRandom(cx, cz, dirSalt) < PATH_PROB) {
      return {
        amp: seededRandom(cx, cz, 9500 + dirSalt) * CELL_SIZE * 0.18 + 12,
        phase: seededRandom(cx, cz, 9600 + dirSalt) * TWO_PI
      };
    }
    return null;
  }
  const paths = {
    N: curvyData(9000),
    S: curvyData(9001),
    E: curvyData(9002),
    W: curvyData(9003),
  };

  return {trees, flowers, animals, paths};
}

// Squared distance helper
function squaredDist(x1, z1, x2, z2) {
  let dx = x1 - x2, dz = z1 - z2;
  return dx*dx + dz*dz;
}

// Place with minimum radius between objects
function canPlaceRadius(x, z, r, occupied) {
  for (let o of occupied) {
    let dx = x - o.x, dz = z - o.z;
    let minDist = r + (o.radius || 0);
    if ((dx*dx + dz*dz) < minDist*minDist) return false;
  }
  return true;
}

// --- Draw a ground tile for cell (cx, cz) ---
function drawGroundCell(cx, cz) {
  const cell = cellMap.get(cellKey(cx, cz));
  push();
  translate(cx * CELL_SIZE, 0, cz * CELL_SIZE);
  rotateX(-HALF_PI);
  fill(120, 38, 55);
  plane(CELL_SIZE, CELL_SIZE);

  // Overlay sparse curvy dirt paths as filled ribbons, flush with ground
  if (cell && cell.paths) {
    push();
    translate(0, 0.2, 0);   // avoid z-fighting yet invisible to eye
    const PATH_W = 280;   // full width (px), very wide
    noStroke();
    fill(30, 65, 35);

    function ribbon(dir, data) {
      if (!data) return;
      const segs = 18;
      const len  = CELL_SIZE/2 + 80;
      const half = PATH_W/2;
      // Helper to get centre point for parameter t (0..1)
      const centre = t => {
        const a = data.amp * Math.sin(t*Math.PI) * Math.sin(data.phase);
        if      (dir==='N') return createVector(  a,           -len*t);
        else if (dir==='S') return createVector(  a,            len*t);
        else if (dir==='E') return createVector(  len*t,        a     );
        else               return createVector( -len*t,        a     ); // W
      };
      beginShape(TRIANGLE_STRIP);
      for (let i=0;i<=segs;i++) {
        const t  = i/segs;
        const c  = centre(t);
        // tangent ≈ centre(t+dt)-centre(t)
        const dt = 1/segs;
        const n  = centre(Math.min(t+dt,1)).sub(c);
        // perpendicular (normalised)
        const p  = createVector(-n.y, n.x).normalize().mult(half);
        vertex(c.x + p.x, c.y + p.y, 0);
        vertex(c.x - p.x, c.y - p.y, 0);
      }
      endShape();
    }

    ribbon('N', cell.paths.N);
    ribbon('S', cell.paths.S);
    ribbon('E', cell.paths.E);
    ribbon('W', cell.paths.W);

    pop();
  }
  pop();
}

// ====== OBJECT DRAW HELPERS (ALL OBJECTS SIT ON GROUND) ======

// --- Helper: Draw vertical bark grooves on cylinders ---
// Disabled for performance
function drawBarkGrooves(r, h, col, variant) {
  return;
  // const grooves = 10;
  // let barkCol;
  // if (variant === 'birch') barkCol = color(0, 0, 15); // dark gray
  // else barkCol = color(hue(col), saturation(col), max(brightness(col)-35, 25));
  // for (let i = 0; i < grooves; i++) {
  //   push();
  //   rotateY(i * TWO_PI / grooves);
  //   translate(r * 0.9, 0, 0); // on surface
  //   ambientMaterial(barkCol);
  //   cylinder(r * 0.05, h*1.02, 6, 1, false);
  //   pop();
  // }
}

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
    // drawBarkGrooves(trunkR, trunkH, trunkColor, t.type); // disabled for perf
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
    } else if (t.type === "oak") {
    trunkH = 70 * t.size;
    trunkR = 11 * t.size;
    push();
    translate(0, trunkH/2, 0);
    ambientMaterial(trunkColor);
    cylinder(trunkR, trunkH, 16, 1, false);
    // drawBarkGrooves(trunkR, trunkH, trunkColor, t.type); // disabled for perf
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
    // drawBarkGrooves(trunkR, trunkH, color(0,0,98), t.type); // disabled for perf
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
  } else if (t.type === 'bush') {
    // 6-sphere textured bush: 1 center, 5 lobes with deterministic offsets
    let base = t.size * 25; // larger scale
    // central sphere
    push();
    translate(0, base*0.55, 0);
    ambientMaterial(110, 45, 60);
    sphere(base*0.6, 16, 14);
    pop();
    // surrounding lobes
    for (let i = 1; i <= 5; i++) {
      let rVal = fract(t.colSeed + i*0.37);
      let ang = rVal * TWO_PI;
      let dist = base * (0.35 + rVal*0.25);
      let ox = cos(ang)*dist;
      let oz = sin(ang)*dist;
      let oy = -base*0.15 + rVal*base*0.1;
      let rad = base*(0.33 + rVal*0.15);
      push();
      translate(ox, rad*0.8 + oy, oz);
      ambientMaterial(110 + rVal*10, 45 + i*4, 55 + rVal*15);
      sphere(rad, 14, 12);
      pop();
    }
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
    // Vivid green for all rabbit parts
    const rabbitCol = color(120, 90, 90);    // bright green (HSB)
    const rabbitLight = color(120, 60, 100); // lighter green for tail

    // Body
    push();
    translate(0, 7, 0);
    ambientMaterial(rabbitCol);
    sphere(7.8, 16, 14);
    pop();
    // Head
    push();
    translate(0, -3.8, 6.3);
    ambientMaterial(rabbitCol);
    sphere(4.2, 12, 10);
    pop();
    // Ears (cylinders)
    for (let side of [-1, 1]) {
      push();
      translate(2.1*side, -10.5, 7.5);
      rotateZ(side*0.10);
      rotateX(-PI/16);
      ambientMaterial(rabbitCol);
      cylinder(1.35, 8, 8, 1, false);
      pop();
    }
    // Tail
    push();
    translate(0, 8.6, -6.2);
    ambientMaterial(rabbitLight);
    sphere(2.3, 7, 5);
    pop();
  } else if (a.type === "deer") {
    scale(a.size);
    // Solid black for all deer parts
    const deerCol = color(0, 0, 0);      // pure black
    const antlerCol = deerCol;           // also black

    // Y-offsets for upright deer
    const BODY_Y = 6.2;
    const LEG_Y = -15.7;
    const NECK_Y = 5;
    const HEAD_Y = 7.5;
    const TAIL_Y = -8.2;
    const ANTLER_Y = 16.3;

    // Body
    push();
    translate(0, BODY_Y, 0);
    ambientMaterial(deerCol);
    sphere(10.2, 18, 14);
    pop();

    // Neck and head
    push();
    translate(0, NECK_Y, 7.7);
    rotateX(-PI/7);
    ambientMaterial(deerCol);
    cylinder(2.8, 10, 10, 1, false);
    // Head
    translate(0, HEAD_Y, 0);
    ambientMaterial(deerCol);
    sphere(5.7, 12, 10);
    // Ears (cylinders)
    for (let side of [-1, 1]) {
      push();
      translate(2.2 * side, HEAD_Y + 1.5, 2.7);
      rotateZ(side*0.18);
      ambientMaterial(deerCol);
      cylinder(0.9, 5, 8, 1, false);
      pop();
    }
    pop();

    // Legs (simple, 4 black cylinders)
    for (let side of [-1, 1]) {
      for (let f of [1, -1]) {
        push();
        translate(3.9 * side, LEG_Y, 5.2 * f);
        ambientMaterial(deerCol);
        cylinder(0.95, 12, 8, 1, false);
        pop();
      }
    }

    // Tail
    push();
    translate(0, TAIL_Y, -8.2);
    ambientMaterial(deerCol);
    sphere(1.8, 6, 5);
    pop();

    // Abstract antlers (2 airy torus loops)
    for (let side of [-1,1]) {
      push();
      translate(2.9*side, ANTLER_Y, 5.1);
      rotateZ(side * 0.35);
      rotateX(-PI/3.5);
      ambientMaterial(antlerCol);
      torus(2.7, 0.36, 10, 4);
      pop();
    }
  }
  pop();
}