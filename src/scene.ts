import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Dimensions
const D = { WIDTH: 2.4, DEPTH: 0.8, PILLAR_H: 0.35, WALL_H: 0.6, ROOF_H: 0.35 };
const halfW = D.WIDTH / 2;
const halfD = D.DEPTH / 2;
const PH = D.PILLAR_H;
const WH = D.WALL_H;
const RH = D.ROOF_H;
const wallTop = PH + WH;
const OV = 0.15;
const roofHalf = halfD + OV;
const roofAngle = Math.atan2(RH, roofHalf);
const slopeLen = Math.hypot(roofHalf, RH);
const tilt = Math.PI / 2 - roofAngle;

const R = Math.random;
const PI = Math.PI;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface DeviceState {
  roofWindow: boolean;
  sideWindow: boolean;
  conveyor: boolean;
  lights: boolean;
}

export interface SensorState {
  temp: number | null;
  humid: number | null;
  gas: number | null;
  feed: number | null;
}

export interface AppState {
  sensor: SensorState;
  device: DeviceState;
  connection: { status: string };
}

interface Animatables {
  roofWindows: { mesh: THREE.Group; baseAngle: number }[];
  sideWindow: THREE.Group | null;
  conveyorBelt: THREE.Mesh | null;
  conveyorRollers: THREE.Mesh[];
  motor: THREE.Mesh | null;
  chickens: THREE.Group[];
  interiorLights: { light: THREE.PointLight; bulbMat: THREE.MeshBasicMaterial }[];
}

export function createScene(
  container: HTMLElement,
  onStateChange: (state: AppState) => void
) {
  const state: AppState = {
    sensor: { temp: null, humid: null, gas: null, feed: null },
    device: { roofWindow: true, sideWindow: true, conveyor: false, lights: false },
    connection: { status: 'connecting' },
  };

  const animatables: Animatables = {
    roofWindows: [],
    sideWindow: null,
    conveyorBelt: null,
    conveyorRollers: [],
    motor: null,
    chickens: [],
    interiorLights: [],
  };

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(3.2, 2.2, 3.2);

  const renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth > 768 });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Environment map (PMREM)
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 256;
  const ectx = envCanvas.getContext('2d')!;
  const eg = ectx.createLinearGradient(0, 0, 0, 256);
  eg.addColorStop(0, '#ffffff');
  eg.addColorStop(0.5, '#e8e8e8');
  eg.addColorStop(1, '#a0a0a0');
  ectx.fillStyle = eg;
  ectx.fillRect(0, 0, 512, 256);
  ectx.fillStyle = '#ffffff';
  ectx.beginPath();
  ectx.ellipse(150, 60, 80, 40, 0, 0, Math.PI * 2);
  ectx.fill();
  ectx.beginPath();
  ectx.ellipse(360, 60, 100, 45, 0, 0, Math.PI * 2);
  ectx.fill();
  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const envRT = pmrem.fromEquirectangular(envTexture);
  scene.environment = envRT.texture;

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = PI / 2 - 0.05;
  controls.minDistance = 1;
  controls.maxDistance = 14;
  controls.target.set(0, 0.7, 0);

  // Lighting
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.near = 1; sc.far = 30; sc.left = sc.bottom = -4; sc.right = sc.top = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(5, 3, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(-2, 4, -8);
  scene.add(rim);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
  topLight.position.set(0, 10, 0);
  scene.add(topLight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // Procedural textures
  const rr = (a: number, b: number) => a + R() * (b - a);

  function createTex(w: number, h: number, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, rx: number, ry: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    fn(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const woodTex = (rx = 1, ry = 1) => createTex(512, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#d4a86a');
    g.addColorStop(0.5, '#e0b87a');
    g.addColorStop(1, '#c99a5c');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      x.strokeStyle = `rgba(140,90,45,${rr(0.1, 0.3)})`;
      x.lineWidth = rr(0.5, 1.5);
      const py = R() * h;
      x.beginPath();
      x.moveTo(0, py);
      for (let px = 0; px <= w; px += 40) x.lineTo(px, py + Math.sin(px * 0.02 + i) * 4);
      x.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const px = R() * w, py = R() * h;
      const rg = x.createRadialGradient(px, py, 0, px, py, 12);
      rg.addColorStop(0, 'rgba(120,70,30,.7)');
      rg.addColorStop(1, 'rgba(120,70,30,0)');
      x.fillStyle = rg;
      x.fillRect(px - 15, py - 15, 30, 30);
    }
  }, rx, ry);

  const tinTex = () => createTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b8c0c8';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 8) {
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.fillRect(i, 0, 3, h);
      x.fillStyle = 'rgba(0,0,0,.15)';
      x.fillRect(i + 4, 0, 3, h);
    }
    x.strokeStyle = 'rgba(100,110,120,.3)';
    for (let y = 0; y < h; y += 64) {
      x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke();
    }
  }, 12, 2);

  const gridTex = (rx: number, ry: number) => createTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#c8d0d8';
    x.lineWidth = 2.5;
    for (let i = 0; i <= w; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke();
    }
    x.strokeStyle = '#a8b0b8';
    x.lineWidth = 3.5;
    for (let i = 0; i <= w; i += 64) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke();
    }
  }, rx, ry);

  // FIX BUG #3: Belt texture dengan pola lebih kontras & panah directional
  const beltTex = () => createTex(512, 512, (x, w, h) => {
    // Base hitam
    x.fillStyle = '#1a1a1a';
    x.fillRect(0, 0, w, h);
    // Grain karet lebih kontras
    for (let i = 0; i < 2000; i++) {
      x.fillStyle = `rgba(90,90,90,${rr(0, 0.5)})`;
      x.beginPath(); x.arc(R() * w, R() * h, 1, 0, 2 * PI); x.fill();
    }
    // Garis transverse yang jelas (setiap 32px)
    x.strokeStyle = 'rgba(60,60,60,0.8)';
    x.lineWidth = 2;
    for (let i = 0; i < w; i += 32) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
    }
    // Panah directional untuk indikasi arah
    for (let i = 0; i < w; i += 128) {
      for (let j = 0; j < h; j += 128) {
        x.fillStyle = 'rgba(40,40,40,0.9)';
        x.beginPath();
        x.moveTo(i + 20, j + 64);
        x.lineTo(i + 60, j + 32);
        x.lineTo(i + 60, j + 96);
        x.closePath();
        x.fill();
      }
    }
    // Kotoran tersebar
    for (let i = 0; i < 25; i++) {
      const px = R() * w, py = R() * h, r = rr(8, 18);
      x.fillStyle = `rgba(110,70,30,${rr(0.6, 0.95)})`;
      x.beginPath(); x.ellipse(px, py, r, r * 0.6, R() * PI, 0, 2 * PI); x.fill();
    }
  }, 8, 2);

  // FIX BUG #3: Roller texture dengan garis supaya rotasi kelihatan
  const rollerTex = () => createTex(64, 64, (x, w, h) => {
    x.fillStyle = '#8b5a2b';
    x.fillRect(0, 0, w, h);
    // Garis memanjang
    for (let i = 0; i < w; i += 8) {
      x.strokeStyle = 'rgba(60,30,15,0.6)';
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
    }
  }, 2, 1);

  // Materials
  const S = (c: number, m: number, r: number, o: any = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, o));

  const mat = {
    wood: S(0xffffff, 0, 0.85, { map: woodTex() }),
    woodBeam: S(0xffffff, 0, 0.85, { map: woodTex(4, 1) }),
    wallWood: S(0xffffff, 0, 0.85, { map: woodTex(2, 1), side: THREE.DoubleSide }),
    corrugated: S(0xffffff, 0.5, 0.6, { map: tinTex(), side: THREE.DoubleSide }),
    chickenWire: S(0xffffff, 0.5, 0.5, { map: gridTex(20, 10), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide }),
    floorMesh: S(0xffffff, 0.5, 0.5, { map: gridTex(24, 8), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xe8f4f8, transmission: 0.85, ior: 1.5, roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    iron: S(0x4a4a4a, 0.7, 0.5),
    servo: S(0x1e40af, 0.5, 0.45),
    motorGold: S(0xd4a017, 0.9, 0.3),
    gearbox: S(0xa8b0b8, 0.8, 0.4),
    panelGreen: S(0x166534, 0.1, 0.65),
    panelBlue: S(0x0e7490, 0.1, 0.65),
    l298n: S(0xb91c1c, 0.1, 0.7),
    relay: S(0x2563eb, 0.1, 0.6),
    wireRed: S(0xdc2626, 0.2, 0.6),
    wireYellow: S(0xfbbf24, 0.2, 0.6),
    wireBlack: S(0x1e293b, 0.2, 0.6),
    wireOrange: S(0xf97316, 0.2, 0.6),
    wireGreen: S(0x16a34a, 0.2, 0.6),
    chickenBody: S(0xf8f8f4, 0, 0.9),
    chickenBeak: S(0xd97706, 0, 0.6),
    chickenComb: S(0xb91c1c, 0, 0.7),
    chickenLeg: S(0xb45309, 0, 0.7),
    feederYellow: S(0xfbbf24, 0.3, 0.4),
    feederRed: S(0xdc2626, 0.3, 0.4),
    conveyorBelt: S(0xffffff, 0.1, 0.9, { map: beltTex() }),
    rollerWood: S(0xffffff, 0, 0.85, { map: rollerTex() }),
    board: S(0x0a0a0a, 0.3, 0.5),
    white: S(0xf0f0f0, 0.1, 0.6),
  };

  // Helpers
  const meshHelper = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = scene): THREE.Mesh => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  };

  const Box = (w: number, h: number, l: number, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = scene) =>
    meshHelper(new THREE.BoxGeometry(w, h, l), m, x, y, z, p);

  const Cyl = (a: number, b: number, h: number, s: number, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = scene) =>
    meshHelper(new THREE.CylinderGeometry(a, b, h, s), m, x, y, z, p);

  const Plane = (w: number, h: number, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = scene) =>
    meshHelper(new THREE.PlaneGeometry(w, h), m, x, y, z, p);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    S(0xf5f5f5, 0, 0.9)
  );
  ground.rotation.x = -PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Contact shadow
  const csCanvas = document.createElement('canvas');
  csCanvas.width = csCanvas.height = 256;
  const cctx = csCanvas.getContext('2d')!;
  const cg = cctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  cg.addColorStop(0, 'rgba(0,0,0,.5)');
  cg.addColorStop(0.7, 'rgba(0,0,0,.15)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  cctx.fillStyle = cg;
  cctx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(csCanvas), transparent: true, opacity: 0.6, depthWrite: false })
  );
  contactShadow.rotation.x = -PI / 2;
  contactShadow.position.y = 0.002;
  scene.add(contactShadow);

  // Coop group
  const coop = new THREE.Group();
  scene.add(coop);

  function buildCoop() {
    const zf = halfD + 0.04;

    // Pillars & frame
    [-1, 1].forEach(sx => [-1, 1].forEach(sz =>
      Box(0.06, wallTop, 0.06, mat.wood, sx * (halfW - 0.03), wallTop / 2, sz * (halfD - 0.03), coop)
    ));

    // Horizontal beams
    [0.1, PH + 0.03, wallTop - 0.03].forEach(y => {
      [-1, 1].forEach(sz => Box(D.WIDTH, 0.05, 0.05, mat.woodBeam, 0, y, sz * (halfD - 0.03), coop));
      [-1, 1].forEach(sx => Box(0.05, 0.05, D.DEPTH, mat.wood, sx * (halfW - 0.03), y, 0, coop));
    });

    // Cross brace X at legs
    const L = Math.hypot(D.DEPTH - 0.06, PH - 0.1 - 0.03);
    const ang = Math.atan2(PH - 0.13, D.DEPTH - 0.06);
    [-1, 1].forEach(sx => [-1, 1].forEach(s => {
      const b = Box(0.025, 0.025, L, mat.wood, sx * (halfW - 0.03), PH / 2, 0, coop);
      b.rotation.x = s * ang;
    }));

    // Floor mesh
    const fl = Plane(D.WIDTH - 0.1, D.DEPTH - 0.1, mat.floorMesh, 0, PH, 0, coop);
    fl.rotation.x = -PI / 2;

    // Back wall & side walls (solid wood)
    Plane(D.WIDTH - 0.1, WH - 0.05, mat.wallWood, 0, PH + WH / 2, -halfD + 0.03, coop);

    [-1, 1].forEach(sx => {
      Plane(D.DEPTH - 0.1, WH - 0.05, mat.wallWood, sx * (halfW - 0.03), PH + WH / 2, 0, coop).rotation.y = sx * PI / 2;
      // Gable triangle
      const sh = new THREE.Shape();
      sh.moveTo(-halfD, 0);
      sh.lineTo(halfD, 0);
      sh.lineTo(0, RH);
      const gb = meshHelper(new THREE.ShapeGeometry(sh), mat.wallWood, sx * (halfW - 0.03), wallTop, 0, coop);
      gb.rotation.y = sx * PI / 2;
    });

    // Front wall slats (with gap for door)
    for (let x = -halfW + 0.07; x < halfW - 0.05; x += 0.075) {
      if (x > -1.18 && x < -0.62) continue;
      Box(0.035, WH - 0.08, 0.02, mat.wood, x, PH + WH / 2, halfD - 0.03, coop);
    }

    // Wire support frame horizontal bars
    [PH + 0.15, PH + 0.35, PH + 0.5].forEach(y => {
      Cyl(0.003, 0.003, D.WIDTH - 0.1, 4, mat.iron, 0, y, halfD - 0.03, coop).rotation.z = PI / 2;
      Cyl(0.003, 0.003, D.WIDTH - 0.1, 4, mat.iron, 0, y, -halfD + 0.03, coop).rotation.z = PI / 2;
    });

    // Door (left front)
    const dg = new THREE.Group();
    dg.position.set(-0.9, PH, halfD - 0.01);
    coop.add(dg);
    Box(0.45, 0.5, 0.03, mat.wood, 0, 0.27, 0, dg);
    Box(0.5, 0.04, 0.04, mat.woodBeam, 0, 0.03, 0.01, dg);
    Box(0.5, 0.04, 0.04, mat.woodBeam, 0, 0.52, 0.01, dg);
    [-1, 1].forEach(s => Box(0.04, 0.5, 0.04, mat.wood, s * 0.23, 0.27, 0.01, dg));
    [0.12, 0.42].forEach(y => Box(0.06, 0.05, 0.015, mat.iron, -0.24, y, 0.03, dg));
    Cyl(0.012, 0.012, 0.08, 8, mat.iron, 0.15, 0.27, 0.04, dg).rotation.z = PI / 2;

    // ====== ATAP PELANA DENGAN LUBANG UNTUK JENDELA ======
    const roofL = D.WIDTH + 0.6;  // 3.0
    const roofW = D.DEPTH + 0.8;  // 1.6
    const rw = 0.4, rh = 0.28;  // ukuran jendela atap
    const holeX = [-0.6, 0.6];  // posisi X lubang di koordinat lokal atap
    const holeY = 0.15;  // posisi Y lubang (tengah slope)

    // Material kaca untuk jendela atap
    const roofGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8e8f0,
      transmission: 0.85,
      opacity: 0.9,
      transparent: true,
      roughness: 0.05,
      ior: 1.45,
      thickness: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Fungsi untuk membuat atap dengan lubang + UV mapping
    function createRoofWithHoles() {
      const shape = new THREE.Shape();
      // Bentuk atap persegi panjang
      shape.moveTo(-roofL / 2, -slopeLen / 2);
      shape.lineTo(roofL / 2, -slopeLen / 2);
      shape.lineTo(roofL / 2, slopeLen / 2);
      shape.lineTo(-roofL / 2, slopeLen / 2);
      shape.closePath();

      // Buat 2 lubang untuk jendela
      holeX.forEach(x => {
        const hole = new THREE.Path();
        hole.moveTo(x - rw / 2, holeY - rh / 2);
        hole.lineTo(x + rw / 2, holeY - rh / 2);
        hole.lineTo(x + rw / 2, holeY + rh / 2);
        hole.lineTo(x - rw / 2, holeY + rh / 2);
        hole.closePath();
        shape.holes.push(hole);
      });

      // Buat geometry dari shape
      const geo = new THREE.ShapeGeometry(shape);
      
      // UV mapping manual untuk texture seng
      geo.computeBoundingBox();
      const posAttr = geo.attributes.position;
      const uvs: number[] = [];
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        uvs.push((x + roofL / 2) / roofL, (y + slopeLen / 2) / slopeLen);
      }
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      return geo;
    }

    // Atap depan (dengan 2 lubang)
    const roofFrontGeom = createRoofWithHoles();
    const rf = new THREE.Mesh(roofFrontGeom, mat.corrugated);
    rf.rotation.x = -tilt;
    rf.position.set(0, wallTop + RH / 2, roofW / 4);
    rf.castShadow = true;
    rf.receiveShadow = true;
    coop.add(rf);

    // Atap belakang (tanpa lubang - pakai Plane biasa)
    const rb = Plane(roofL, slopeLen, mat.corrugated, 0, wallTop + RH / 2, -roofW / 4, coop);
    rb.rotation.set(tilt, PI, 0);

    // ====== JENDELA ATAP (2 buah) ======
    holeX.forEach((x: number, i: number) => {
      // Hitung posisi lubang dalam koordinat global
      // holeY = 0.15 dari pusat slope (dalam koordinat lokal atap)
      const roofSurfaceY = wallTop + RH / 2;
      const roofSurfaceZ = roofW / 4;
      
      // Posisi lubang di permukaan atap (konversi dari lokal ke global)
      const holeWorldY = roofSurfaceY + holeY * Math.sin(tilt);
      const holeWorldZ = roofSurfaceZ - holeY * Math.cos(tilt);

      // --- SERVO MG90S STATIS (nempel di rangka atap) ---
      const servoGroup = new THREE.Group();
      servoGroup.position.set(
        x + rw / 2 + 0.08,
        holeWorldY + 0.02,
        holeWorldZ - 0.03
      );
      servoGroup.rotation.x = -tilt;

      // Body servo MG90S
      Box(0.023, 0.012, 0.028, mat.servo, 0, 0, 0, servoGroup);
      // Bracket mounting
      Box(0.03, 0.003, 0.035, mat.iron, 0, -0.008, 0, servoGroup);
      // Kabel servo
      Cyl(0.002, 0.002, 0.08, 4, mat.wireRed, 0.01, -0.02, 0, servoGroup);
      Cyl(0.002, 0.002, 0.08, 4, mat.wireBlack, 0, -0.02, 0, servoGroup);
      Cyl(0.002, 0.002, 0.08, 4, mat.wireYellow, -0.01, -0.02, 0, servoGroup);
      coop.add(servoGroup);

      // --- GRUP JENDELA BERGERAK (pivot di TEPI ATAS) ---
      const g = new THREE.Group();
      g.name = 'roof_win_' + (i + 1);

      // Pivot di tepi atas lubang (y = 0 di local = tepi atas)
      // Kaca memanjang ke bawah (negative Y)
      const OUT = 0.015;  // offset dari permukaan atap

      // Posisi pivot di tepi atas lubang
      const pivotY = holeWorldY + rh / 2 * Math.sin(tilt) + OUT;
      const pivotZ = holeWorldZ + rh / 2 * Math.cos(tilt) + OUT;

      g.position.set(x, pivotY, pivotZ);
      g.rotation.x = -tilt;  // sejajar dengan atap saat ditutup

      // Kaca (pivot di y=0, memanjang ke y=-rh)
      const pane = meshHelper(new THREE.BoxGeometry(rw, rh, 0.008), roofGlassMat, 0, -rh / 2, 0, g);
      pane.renderOrder = 10;

      // Frame kayu tipis mengelilingi kaca (semua di y ≤ 0)
      const frameThick = 0.015;
      // Frame atas (di pivot)
      Box(rw + frameThick * 2, frameThick, 0.012, mat.wood, 0, -frameThick / 2, 0, g);
      // Frame bawah
      Box(rw + frameThick * 2, frameThick, 0.012, mat.wood, 0, -rh - frameThick / 2, 0, g);
      // Frame kiri
      Box(frameThick, rh, 0.012, mat.wood, -rw / 2 - frameThick / 2, -rh / 2, 0, g);
      // Frame kanan
      Box(frameThick, rh, 0.012, mat.wood, rw / 2 + frameThick / 2, -rh / 2, 0, g);

      // Engsel di tepi atas (2 buah)
      [-1, 1].forEach(s => {
        Cyl(0.004, 0.004, 0.025, 6, mat.iron, s * (rw / 2 - 0.05), -0.005, 0, g)
          .rotation.z = PI / 2;
      });

      coop.add(g);
      // baseAngle = -tilt (sejajar atap), saat buka tambah -PI/4 (45° ke atas)
      animatables.roofWindows.push({ mesh: g, baseAngle: -tilt });
    });

    // ====== JENDELA SAMPING (1 buah di dinding kanan) ======
    const winW = 0.4, winH = 0.32;
    const wy = PH + 0.3;  // tinggi jendela
    const wx = 0.45;  // posisi X jendela (di dinding kanan/depan)

    // Material kaca untuk jendela samping
    const sideGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8e8f0,
      transmission: 0.85,
      opacity: 0.9,
      transparent: true,
      roughness: 0.05,
      ior: 1.45,
      thickness: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // --- SERVO MG90S STATIS di sisi dalam dinding ---
    const sideServoGroup = new THREE.Group();
    sideServoGroup.position.set(
      wx - winW / 2 - 0.05,  // di kiri jendela, di dalam
      wy + winH / 2,
      halfD - 0.05  // di dalam dinding
    );
    // Body servo
    Box(0.023, 0.012, 0.028, mat.servo, 0, 0, 0, sideServoGroup);
    // Bracket
    Box(0.03, 0.003, 0.035, mat.iron, 0, -0.008, 0, sideServoGroup);
    coop.add(sideServoGroup);

    // --- GRUP JENDELA BERGERAK (pivot di TEPI KIRI) ---
    const win = new THREE.Group();
    win.name = 'side_win';

    // Pivot di tepi kiri kaca (x = 0 di local = tepi kiri)
    // Kaca memanjang ke kanan (positive X)
    const OUT = 0.02;  // offset dari permukaan dinding
    win.position.set(wx - winW / 2, wy, halfD + OUT);

    // Kaca (pivot di x=0, memanjang ke x=+winW)
    const sidePane = meshHelper(new THREE.BoxGeometry(winW, winH, 0.008), sideGlassMat, winW / 2, 0, 0, win);
    sidePane.renderOrder = 10;

    // Frame kayu tipis mengelilingi kaca
    const frameThick = 0.015;
    // Frame atas
    Box(winW + frameThick * 2, frameThick, 0.012, mat.wood, winW / 2, winH / 2 + frameThick / 2, 0, win);
    // Frame bawah
    Box(winW + frameThick * 2, frameThick, 0.012, mat.wood, winW / 2, -winH / 2 - frameThick / 2, 0, win);
    // Frame kiri (di pivot)
    Box(frameThick, winH + frameThick * 2, 0.012, mat.wood, -frameThick / 2, 0, 0, win);
    // Frame kanan
    Box(frameThick, winH + frameThick * 2, 0.012, mat.wood, winW + frameThick / 2, 0, 0, win);

    // Engsel di tepi kiri (2 buah)
    [-1, 1].forEach(s => {
      Cyl(0.004, 0.004, 0.025, 6, mat.iron, 0.005, s * (winH / 2 - 0.05), 0, win)
        .rotation.x = PI / 2;
    });

    coop.add(win);
    animatables.sideWindow = win;

    // Electronics panel
    Box(0.1, 0.14, 0.012, mat.panelGreen, -0.45, PH + 0.4, zf, coop);
    Box(0.05, 0.05, 0.015, mat.relay, -0.34, PH + 0.34, zf, coop);
    Box(0.04, 0.025, 0.02, mat.board, -0.45, PH + 0.42, zf + 0.01, coop);
    Box(0.13, 0.09, 0.012, mat.panelBlue, -0.45, 0.2, zf, coop);
    Box(0.07, 0.07, 0.02, mat.l298n, -0.1, 0.17, zf, coop);

    // Wires
    (['wireRed', 'wireYellow', 'wireBlack', 'wireOrange'] as const).forEach((m, idx) => {
      const y = [0.52, 0.5, 0.48, 0.46][idx];
      Cyl(0.004, 0.004, 0.95, 6, (mat as any)[m], 0.025, PH + y - 0.35 + 0.35, zf + 0.012, coop).rotation.z = PI / 2;
    });
    (['wireRed', 'wireGreen', 'wireYellow', 'wireBlack'] as const).forEach((m, idx) => {
      const x = [-0.49, -0.46, -0.43, -0.4][idx];
      Cyl(0.004, 0.004, 0.5, 6, (mat as any)[m], x, 0.475, zf + 0.012, coop);
    });
    Cyl(0.004, 0.004, 0.35, 6, mat.wireOrange, -0.28, 0.19, zf + 0.012, coop).rotation.z = PI / 2;
    Cyl(0.004, 0.004, 0.35, 6, mat.wireGreen, -0.28, 0.17, zf + 0.012, coop).rotation.z = PI / 2;

    // Sensors
    Box(0.05, 0.07, 0.03, mat.white, halfW - 0.15, PH + 0.4, halfD - 0.1, coop);
    Cyl(0.02, 0.02, 0.04, 12, mat.iron, halfW - 0.15, PH + 0.4, -halfD + 0.1, coop).rotation.x = PI / 2;

    // Conveyor
    const cy = 0.22;
    const belt = Box(D.WIDTH - 0.2, 0.02, D.DEPTH - 0.1, mat.conveyorBelt, 0, cy, 0, coop);
    belt.name = 'conveyor_belt';
    animatables.conveyorBelt = belt;

    // FIX BUG #3: Roller lebih besar (0.07) & low-poly (12 segments) supaya rotasi kelihatan
    [-1, 1].forEach(s => {
      const r = Cyl(0.07, 0.07, D.DEPTH - 0.06, 12, mat.rollerWood, s * (halfW - 0.12), cy, 0, coop);
      r.rotation.x = PI / 2;
      animatables.conveyorRollers.push(r);
    });
    [-0.3, 0.3].forEach(x => {
      Cyl(0.04, 0.04, D.DEPTH - 0.06, 12, mat.rollerWood, x, cy - 0.07, 0, coop).rotation.x = PI / 2;
    });

    const motor = Cyl(0.03, 0.03, 0.09, 16, mat.motorGold, -halfW + 0.2, 0.2, halfD + 0.07, coop);
    motor.rotation.x = PI / 2;
    animatables.motor = motor;
    Box(0.06, 0.05, 0.05, mat.gearbox, -halfW + 0.2, 0.2, halfD + 0.14, coop);

    // Feeder tubes & water line
    Cyl(0.03, 0.03, D.WIDTH - 0.3, 12, mat.feederYellow, 0, PH + 0.13, -0.2, coop).rotation.z = PI / 2;
    Cyl(0.025, 0.025, D.WIDTH - 0.3, 12, mat.feederRed, 0, PH + 0.1, 0.2, coop).rotation.z = PI / 2;
    for (let x = -halfW + 0.3; x <= halfW - 0.3; x += 0.4) {
      Cyl(0.036, 0.036, 0.02, 8, mat.iron, x, PH + 0.13, -0.2, coop).rotation.z = PI / 2;
      Cyl(0.03, 0.03, 0.02, 8, mat.iron, x, PH + 0.1, 0.2, coop).rotation.z = PI / 2;
    }

    // Straw on floor
    const strawCanvas = document.createElement('canvas');
    strawCanvas.width = strawCanvas.height = 512;
    const sctx = strawCanvas.getContext('2d')!;
    for (let i = 0; i < 400; i++) {
      const a = R() * PI;
      const l = 8 + R() * 15;
      sctx.strokeStyle = `rgba(${180 + (R() * 40 | 0)},${150 + (R() * 30 | 0)},${80 + (R() * 30 | 0)},${0.6 + R() * 0.3})`;
      sctx.lineWidth = 1 + R();
      const px = R() * 512, py = R() * 512;
      sctx.beginPath();
      sctx.moveTo(px, py);
      sctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      sctx.stroke();
    }
    const strawTex = new THREE.CanvasTexture(strawCanvas);
    strawTex.wrapS = strawTex.wrapT = THREE.RepeatWrapping;
    strawTex.repeat.set(4, 2);
    strawTex.colorSpace = THREE.SRGBColorSpace;
    const strawMesh = Plane(
      D.WIDTH - 0.15, D.DEPTH - 0.15,
      new THREE.MeshStandardMaterial({ map: strawTex, transparent: true, alphaTest: 0.1, roughness: 1, side: THREE.DoubleSide }),
      0, PH + 0.005, 0, coop
    );
    strawMesh.rotation.x = -PI / 2;
    strawMesh.castShadow = false;

    // Perches (tenggeran)
    [-0.3, 0, 0.3].forEach((z, i) => {
      const y = PH + 0.42 - i * 0.08;
      Cyl(0.015, 0.015, D.WIDTH - 0.3, 8, mat.wood, 0, y, z, coop).rotation.z = PI / 2;
      [-1, 1].forEach(sx =>
        Cyl(0.008, 0.008, 0.05, 6, mat.iron, sx * (halfW - 0.07), y, z, coop).rotation.z = PI / 2
      );
    });

    // Water droplets
    const dropMat = new THREE.MeshStandardMaterial({ color: 0xa8d8f0, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.3 });
    for (let x = -halfW + 0.5; x <= halfW - 0.5; x += 0.4) {
      const d = meshHelper(new THREE.SphereGeometry(0.005, 6, 6), dropMat, x, PH + 0.06, 0.2, coop);
      d.scale.set(1, 1.4, 1);
      d.castShadow = false;
    }

    // Bolt & plate details at corners
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
      Cyl(0.008, 0.008, 0.01, 6, mat.iron, sx * (halfW - 0.03), PH + 0.01, sz * (halfD + 0.0), coop).rotation.x = PI / 2;
      Box(0.04, 0.04, 0.005, mat.iron, sx * (halfW - 0.03), PH + 0.01, sz * (halfD + 0.005), coop);
    }));

    // Nesting boxes with eggs
    const eggMat = S(0xf5e6c8, 0, 0.4);
    [-1, 1].forEach(sx => {
      const nb = new THREE.Group();
      nb.position.set(sx * (halfW + 0.16), PH, 0);
      coop.add(nb);
      Box(0.32, 0.02, 0.6, mat.wood, 0, 0.01, 0, nb);
      Box(0.32, 0.3, 0.02, mat.wood, 0, 0.17, -0.29, nb);
      Box(0.02, 0.3, 0.6, mat.wood, sx * 0.15, 0.17, 0, nb);
      Box(0.32, 0.09, 0.02, mat.wood, 0, 0.045, 0.29, nb);
      const roof = Box(0.38, 0.03, 0.68, mat.wood, 0, 0.34, 0, nb);
      roof.rotation.z = -sx * 0.12;
      // Eggs
      const n = 2 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const e = meshHelper(new THREE.SphereGeometry(0.028, 12, 10), eggMat, sx * -0.03, 0.05, -0.2 + i * 0.12 + R() * 0.04, nb);
        e.scale.set(0.85, 1.2, 0.85);
        e.rotation.z = (R() - 0.5) * 0.3;
      }
    });

    // Interior lights
    [-0.6, 0, 0.6].forEach(x => {
      Cyl(0.03, 0.04, 0.03, 12, mat.iron, x, wallTop - 0.06, 0, coop);
      const l = new THREE.PointLight(0xfff5ea, 0, 3);
      l.position.set(x, wallTop - 0.12, 0);
      coop.add(l);
      const bm = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), bm);
      b.position.copy(l.position);
      coop.add(b);
      animatables.interiorLights.push({ light: l, bulbMat: bm });
    });
  }

  buildCoop();

  // Chickens
  function buildChickens(n: number) {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      const cb = mat.chickenBody;
      const pose = Math.floor(R() * 3);

      const body = meshHelper(new THREE.SphereGeometry(0.13, 16, 12), cb, 0, 0.13, 0, c);
      body.scale.set(1.15, 0.85, 1.3);

      let hy = 0.22, hz = 0.12, lh = 0.06, sc: number;
      if (pose === 0) { sc = 0.6 + R() * 0.1; lh = 0.02; hy = 0.18; }
      else if (pose === 1) { sc = 0.7 + R() * 0.1; hy = 0.24; }
      else { sc = 0.65 + R() * 0.1; hy = 0.16; hz = 0.16; }
      c.scale.setScalar(sc);

      const head = meshHelper(new THREE.SphereGeometry(0.065, 12, 10), cb, 0, hy, hz, c);
      const beak = meshHelper(new THREE.ConeGeometry(0.018, 0.05, 6), mat.chickenBeak, 0, hy, hz + 0.06, c);
      beak.rotation.x = PI / 2;

      [-1, 1].forEach(s =>
        meshHelper(new THREE.CylinderGeometry(0.008, 0.01, lh, 6), mat.chickenLeg, s * 0.04, lh / 2, 0, c)
      );

      const comb = meshHelper(new THREE.SphereGeometry(0.022, 6, 6), mat.chickenComb, 0, hy + 0.06, hz, c);
      comb.scale.set(0.7, 1.2, 1);
      meshHelper(new THREE.SphereGeometry(0.015, 6, 6), mat.chickenComb, 0, hy - 0.03, hz + 0.06, c);

      [1, -1].forEach(s => {
        const wing = meshHelper(new THREE.SphereGeometry(0.07, 10, 8), cb, s * 0.1, 0.13, 0, c);
        wing.scale.set(0.6, 1.1, 0.5);
      });

      const px = (R() - 0.5) * (D.WIDTH - 0.6);
      const pz = pose === 0
        ? (R() > 0.5 ? 1 : -1) * (halfD - 0.15 - R() * 0.1)
        : (R() - 0.5) * (D.DEPTH - 0.35);

      c.position.set(px, PH + 0.02, pz);
      c.rotation.y = R() * PI * 2;
      c.userData = { phase: R() * PI * 2, peckSpeed: 2 + R() * 1.5, head, beak };
      scene.add(c);
      animatables.chickens.push(c);
    }
  }
  buildChickens(12);

  // Dust particles
  const dustN = 100;
  const dustPositions = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPositions[i * 3] = (R() - 0.5) * 4;
    dustPositions[i * 3 + 1] = R() * 2;
    dustPositions[i * 3 + 2] = (R() - 0.5) * 2;
  }
  const dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeom, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.008, transparent: true, opacity: 0.25, depthWrite: false
  }));
  scene.add(dust);

  // Simulation
  const sensor = { temp: 29.2, humid: 68, gas: 12, feed: 84 };
  let simInterval: number | null = null;

  function tick() {
    sensor.temp = Math.max(25, Math.min(35, sensor.temp + (R() - 0.48) * 0.3));
    sensor.humid = Math.max(50, Math.min(85, 100 - (sensor.temp - 25) * 3 + (R() - 0.5) * 3));
    sensor.gas += state.device.conveyor ? -0.8 : 0.15;
    sensor.gas = Math.max(5, Math.min(45, sensor.gas));
    if (R() > 0.7) sensor.feed = Math.max(20, sensor.feed - 1);
    state.sensor = { ...sensor };
    onStateChange({ ...state });
  }

  function connect() {
    simInterval = window.setInterval(tick, 2000);
    tick();
    state.connection.status = 'connected';
    onStateChange({ ...state });
  }

  function sendCommand(id: keyof DeviceState, value: boolean) {
    state.device[id] = value;
    if (id === 'lights') {
      animatables.interiorLights.forEach(l => {
        l.light.intensity = value ? 1.8 : 0;
        l.bulbMat.color.setHex(value ? 0xfff5ea : 0x333333);
      });
    }
    onStateChange({ ...state });
  }

  // Camera views
  const views: Record<string, [number[], number[]]> = {
    iso: [[3.2, 2.2, 3.2], [0, 0.7, 0]],
    front: [[0, 1, 5], [0, 0.7, 0]],
    inside: [[0.9, PH + 0.3, 0.2], [-0.6, PH + 0.12, -0.1]],
    top: [[0, 6, 0.1], [0, 0, 0]],
  };

  let camTween: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;

  function setView(name: string) {
    const v = views[name];
    if (v) camTween = { p: new THREE.Vector3(...v[0]), t: new THREE.Vector3(...v[1]) };
  }

  // Animation loop
  const clock = new THREE.Clock();
  let animId: number;

  function animate() {
    animId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    // Camera tween
    if (camTween) {
      camera.position.lerp(camTween.p, 0.08);
      controls.target.lerp(camTween.t, 0.08);
      if (camera.position.distanceTo(camTween.p) < 0.02) camTween = null;
    }

    // Roof windows — pivot di tepi atas, buka ke atas +PI/4 (45°)
    // rotasi X positif membuat bottom edge (di -Y lokal) naik ke atas
    const tr = state.device.roofWindow ? PI / 4 : 0;
    animatables.roofWindows.forEach(w => {
      const t = w.baseAngle + tr;
      w.mesh.rotation.x += (t - w.mesh.rotation.x) * 6 * delta;
    });

    // Side window — pivot di tepi kiri, buka ke samping +PI/2 (90°)
    // rotasi Y positif membuat kaca (di +X lokal) keluar ke samping
    if (animatables.sideWindow) {
      const ts = state.device.sideWindow ? PI / 2 : 0;
      animatables.sideWindow.rotation.y += (ts - animatables.sideWindow.rotation.y) * 6 * delta;
    }

    // Conveyor — FIX BUG #3: rotation.z (bukan y), speed 0.8, motor vibration 0.03
    if (state.device.conveyor && animatables.conveyorBelt) {
      (animatables.conveyorBelt.material as THREE.MeshStandardMaterial).map!.offset.x -= 0.8 * delta;
      // Roller sudah di-rotate.x = PI/2, jadi sumbu memanjangnya sekarang Z lokal
      animatables.conveyorRollers.forEach(r => r.rotation.z += 2.5 * delta);
      if (animatables.motor) animatables.motor.rotation.z = Math.sin(Date.now() * 0.05) * 0.03;
    }

    // Chickens
    animatables.chickens.forEach(c => {
      const { phase, peckSpeed, head, beak } = c.userData;
      c.rotation.z = Math.sin(time * 1.5 + phase) * 0.025;
      const peck = Math.sin(time * peckSpeed + phase);
      if (peck > 0.7) {
        head.rotation.x = lerp(head.rotation.x, PI / 3, 0.12);
        beak.rotation.x = lerp(beak.rotation.x, PI / 3 + PI / 2, 0.12);
      } else {
        head.rotation.x = lerp(head.rotation.x, 0, 0.08);
        beak.rotation.x = lerp(beak.rotation.x, PI / 2, 0.08);
      }
      if (Math.sin(time * 0.5 + phase * 2) > 0.9) {
        c.rotation.y += delta * 0.3;
        const nx = c.position.x + Math.sin(c.rotation.y) * delta * 0.05;
        const nz = c.position.z + Math.cos(c.rotation.y) * delta * 0.05;
        if (Math.abs(nx) < halfW - 0.3 && Math.abs(nz) < halfD - 0.15) {
          c.position.x = nx;
          c.position.z = nz;
        }
      }
    });

    // Dust
    const dp = dust.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < dp.length; i += 3) {
      dp[i + 1] += Math.sin(time * 0.5 + i) * 0.0002;
      dp[i] += 0.0003;
      if (dp[i] > 2) dp[i] = -2;
    }
    dust.geometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
  }

  // Resize handler
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // Start
  connect();
  animate();

  // Cleanup
  return {
    setView,
    sendCommand,
    getState: () => state,
    dispose: () => {
      cancelAnimationFrame(animId);
      if (simInterval) clearInterval(simInterval);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
