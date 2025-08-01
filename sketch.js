// Procedural 3D Forest Walk – p5.js (WEBGL)
// All code by Genie, 2025
// Requirements: p5.js 1.6+, WEBGL mode

// ====== GLOBALS ======
let trees = [];
let flowers = [];
let animals = [];
const FOREST_RADIUS = 2000;
const NUM_TREES = 250;
const NUM_FLOWERS = 200;
const NUM_ANIMALS = 30;

let camX = 0, camY = 90, camZ = 0; // User camera position
let camAngle = 0; // Yaw (radians, 0 = +X axis)
let camPitch = 0; // For mouse look
let looking = false;
let lastMouseX = 0;

const BASE_SPEED = 8;
const SPRINT_SPEED = 16;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  angleMode(RADIANS);
  noStroke();
  generateForest();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ====== FOREST GENERATION ======
function generateForest() {
  trees = [];
  flowers = [];
  animals = [];
  // --- Trees ---
  for (let i = 0; i < NUM_TREES; i++) {
    let theta = random(TWO_PI);
    let r = sqrt(random(1)) * FOREST_RADIUS; // Uniform density in disk
    let x = cos(theta) * r;
    let z = sin(theta) * r;
    let type = random(["pine", "oak", "birch"]);
    let tree = {
      type: type,
      x: x,
      z: z,
      size: random(1.0, 1.4),
      colour: random(10000), // Seed to pick colour
    };
    trees.push(tree);
  }
  // --- Flowers ---
  for (let i = 0; i < NUM_FLOWERS; i++) {
    let theta = random(TWO_PI);
    let r = sqrt(random(1)) * FOREST_RADIUS;
    let x = cos(theta) * r;
    let z = sin(theta) * r;
    let ftype = random(["sphere", "torus"]);
    let f = {
      type: ftype,
      x: x,
      z: z,
      size: random(0.8, 1.5),
      colour: [random(360), random(0.6, 1), random(0.7, 1)], // HSB
    };
    flowers.push(f);
  }
  // --- Animals ---
  for (let i = 0; i < NUM_ANIMALS; i++) {
    let theta = random(TWO_PI);
    let r = sqrt(random(1)) * FOREST_RADIUS;
    let x = cos(theta) * r;
    let z = sin(theta) * r;
    let type = random(["rabbit", "deer"]);
    let a = {
      type: type,
      x: x,
      z: z,
      size: (type === "rabbit") ? random(0.8, 1.1) : random(1.5, 2.2),
      colour: random(10000),
      idlePhase: random(TWO_PI), // for animation
    };
    animals.push(a);
  }
}

// ====== DRAW LOOP ======
function draw() {
  background(135,206,235); // Sky blue

  // --- Lighting ---
  ambientLight(110, 110, 110);
  // Directional sunlight (warm, from upper left)
  directionalLight(255, 220, 180, -0.3, -1.0, -0.2);

  // --- Camera logic ---
  let lookX = camX + cos(camAngle) * cos(camPitch);
  let lookY = camY + sin(camPitch);
  let lookZ = camZ + sin(camAngle) * cos(camPitch);

  camera(camX, camY, camZ, lookX, lookY, lookZ, 0, 1, 0);

  // --- Ground Plane ---
  push();
  rotateX(-HALF_PI);
  ambientMaterial(90, 143, 63); // Rich green
  specularMaterial(60, 110, 45, 30);
  plane(4000, 4000);
  pop();

  // --- Draw objects (cull far ones for perf) ---
  // Trees
  for (let t of trees) {
    if (sq(t.x - camX) + sq(t.z - camZ) < 2500 * 2500) {
      drawTree(t);
    }
  }
  // Flowers
  for (let f of flowers) {
    if (sq(f.x - camX) + sq(f.z - camZ) < 2500 * 2500) {
      drawFlower(f);
    }
  }
  // Animals
  for (let a of animals) {
    if (sq(a.x - camX) + sq(a.z - camZ) < 2500 * 2500) {
      drawAnimal(a);
    }
  }
}

// ====== CAMERA MOVEMENT / CONTROLS ======
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
  // For mobile or click, capture mouse
  if (!looking) {
    looking = true;
    requestPointerLock();
  }
}

function mouseDragged() {
  // Camera look with mouse drag (only if pointer locked)
  if (looking) {
    camAngle += movedX * 0.003;
    camPitch = constrain(camPitch - movedY * 0.003, -PI/2.2, PI/2.2);
  }
}

function mouseMoved() {
  if (looking && (abs(movedX) > 0 || abs(movedY) > 0)) {
    camAngle += movedX * 0.003;
    camPitch = constrain(camPitch - movedY * 0.003, -PI/2.2, PI/2.2);
  }
}

function keyReleased() {
  // Escape releases mouse
  if (keyCode === 27) { // ESC
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

// --- Actual movement logic in draw (so multiple keys work) ---
function movementStep() {
  let speed = keyIsDown(SHIFT) ? SPRINT_SPEED : BASE_SPEED;
  let moved = false;
  // Forward
  if (keyIsPressedOrDown("W", UP_ARROW)) {
    camX += cos(camAngle) * speed;
    camZ += sin(camAngle) * speed;
    moved = true;
  }
  // Backward
  if (keyIsPressedOrDown("S", DOWN_ARROW)) {
    camX -= cos(camAngle) * speed;
    camZ -= sin(camAngle) * speed;
    moved = true;
  }
  // Strafe left
  if (keyIsPressedOrDown("A", LEFT_ARROW)) {
    camX += cos(camAngle - HALF_PI) * speed * 0.76;
    camZ += sin(camAngle - HALF_PI) * speed * 0.76;
    moved = true;
  }
  // Strafe right
  if (keyIsPressedOrDown("D", RIGHT_ARROW)) {
    camX += cos(camAngle + HALF_PI) * speed * 0.76;
    camZ += sin(camAngle + HALF_PI) * speed * 0.76;
    moved = true;
  }
  // Clamp to bounds
  let maxDist = FOREST_RADIUS * 0.95;
  let dist = sqrt(camX*camX + camZ*camZ);
  if (dist > maxDist) {
    let factor = maxDist / dist;
    camX *= factor;
    camZ *= factor;
  }
}
setInterval(movementStep, 1000/60); // Maintain 60fps movement, decoupled from draw()

// ====== DRAW HELPERS ======

// --- TREE ---
function drawTree(t) {
  push();
  translate(t.x, 0, t.z);

  let variant = t.type;
  let trunkH, trunkR, foliageY;

  // Pick bark and foliage colours
  if (variant === "pine") {
    // Tall, thin brown trunk
    trunkH = 44 * t.size;
    trunkR = 3.9 * t.size;
    ambientMaterial(90, 60, 38);
    cylinder(trunkR, trunkH);
    // Three stacked cones, dark green
    let coneColors = [
      [30, random(90,120), 45],
      [38, random(110,150), 60],
      [46, random(130,170), 70]
    ];
    let topY = -trunkH/2 - 24*t.size;
    for (let i=0; i<3; i++) {
      push();
      translate(0, topY + i*16*t.size, 0);
      ambientMaterial(35, random(80,130), 38 + i*10);
      cone(18 - i*4, 32 - i*8, 16, 2, false);
      pop();
    }
  } else if (variant === "oak") {
    // Thicker trunk, brown
    trunkH = 32 * t.size;
    trunkR = 7.9 * t.size;
    ambientMaterial(104, 77, 33);
    cylinder(trunkR, trunkH);
    // Large green sphere foliage
    push();
    translate(0, -trunkH/2 - 23*t.size, 0);
    ambientMaterial(50, random(130,170), 60);
    sphere(28 * t.size, 12, 12);
    pop();
  } else if (variant === "birch") {
    // White trunk with stripes
    trunkH = 38 * t.size;
    trunkR = 5.2 * t.size;
    fill(230, 230, 220);
    ambientMaterial(240, 236, 226);
    cylinder(trunkR, trunkH);
    // Add black stripes
    for (let i=0;i<5;i++) {
      push();
      let y = -trunkH/2 + trunkH * (i+0.5)/6;
      translate(0, y, trunkR+0.25);
      rotateX(HALF_PI);
      fill(40,40,40);
      ellipse(0,0, trunkR*1.7, 1.4);
      pop();
    }
    // Foliage sphere, lighter green
    push();
    translate(0, -trunkH/2 - 16*t.size, 0);
    ambientMaterial(180, 210, 140);
    sphere(20 * t.size, 10, 10);
    pop();
  }
  pop();
}

// --- FLOWER ---
function drawFlower(f) {
  push();
  translate(f.x, 0, f.z);

  // Stem
  ambientMaterial(55, 140, 60);
  cylinder(1.5 * f.size, 8 * f.size);

  // Bloom (sphere or torus)
  let [h, s, b] = f.colour;
  colorMode(HSB);
  let flowerCol = color(h, s*100, b*100);
  colorMode(RGB);
  translate(0, -6 * f.size, 0);
  ambientMaterial(flowerCol);
  if (f.type === "sphere") {
    sphere(3.8 * f.size, 8, 8);
    // Add stamen (tiny yellow)
    push();
    translate(0, -2.8 * f.size, 0);
    ambientMaterial(255, 215, 60);
    sphere(1.2 * f.size, 5, 5);
    pop();
  } else {
    rotateX(HALF_PI);
    torus(2.2 * f.size, 1.2 * f.size, 10, 8);
    // Center dot
    push();
    rotateX(HALF_PI);
    translate(0, 0, 1.2 * f.size);
    ambientMaterial(255, 220, 110);
    sphere(1.0 * f.size, 5, 5);
    pop();
  }
  pop();
}

// --- ANIMAL ---
function drawAnimal(a) {
  push();
  translate(a.x, 0, a.z);

  // Idle animation: up-down bob
  let t = millis() * 0.001 + a.idlePhase;
  let bobY = sin(t*1.2 + a.x*0.01 + a.z*0.01) * 3.5 * a.size;
  translate(0, bobY, 0);

  if (a.type === "rabbit") {
    // Body
    ambientMaterial(190, 180, 160);
    scale(a.size);
    push();
    scale(1.1, 0.97, 1.5);
    sphere(7, 10, 10);
    pop();
    // Head
    push();
    translate(0, -7, 5.2);
    scale(0.79, 0.88, 1.0);
    sphere(4.5, 8, 8);
    pop();
    // Ears
    for (let side of [-1, 1]) {
      push();
      translate(2.2 * side, -13, 7.5);
      rotateZ(side*0.13);
      scale(0.41, 1.38, 0.41);
      box(3.1, 12.5, 2.0);
      pop();
    }
    // Tail
    push();
    translate(0, 1, -8.5);
    ambientMaterial(235,235,240);
    sphere(2.2, 6, 6);
    pop();
  } else if (a.type === "deer") {
    // Body
    ambientMaterial(150, 115, 60);
    scale(a.size);
    push();
    scale(2.4, 1.1, 1.0);
    box(7.7, 5.6, 14);
    pop();
    // Legs
    for (let side of [-1, 1]) {
      for (let f of [1, -1]) {
        push();
        translate(3.7 * side, 7.5, 5.2 * f);
        scale(0.32, 1.4, 0.32);
        box(4, 12, 4);
        pop();
      }
    }
    // Neck
    push();
    translate(0, -5, 8);
    rotateX(-PI/8);
    scale(0.55, 1.3, 0.55);
    box(4, 9, 4);
    // Head
    translate(0, -5.5, 0);
    scale(1.35, 0.9, 1.1);
    box(5.5, 4.5, 6.5);
    // Ears
    for (let side of [-1, 1]) {
      push();
      translate(2.3 * side, -1.8, 2.3);
      rotateZ(side*0.20);
      scale(0.25, 0.7, 0.35);
      box(2, 6, 2);
      pop();
    }
    // Antlers (simple lines)
    stroke(80, 70, 45);
    strokeWeight(0.5);
    for (let side of [-1,1]) {
      push();
      translate(2.0 * side, -3, 2.5);
      line(0,0,0,   side*3, -7, 2);
      pop();
    }
    noStroke();
    pop();
    // Tail
    push();
    translate(0, 1.1, -7.8);
    ambientMaterial(222, 210, 190);
    sphere(1.7, 5, 5);
    pop();
  }
  pop();
}