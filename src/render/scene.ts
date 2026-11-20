import * as THREE from 'three';
import { TICK_RATE, TUNING } from '../sim/config';
import type { NightMapDef } from '../sim/maps';
import type { LanternState, Vec3, WindState } from '../sim/types';
import { createGlowSpriteTexture, createIslandGroundTexture } from './textures';

interface LanternVisual {
  id: string;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  tearMarks: THREE.Group;
  fuelBarGroup: THREE.Group;
  fuelBarFill: THREE.Mesh;
  fuelBarFillMat: THREE.MeshBasicMaterial;
  haloSprite: THREE.Sprite;
  haloMat: THREE.SpriteMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
  safeRingMat: THREE.MeshBasicMaterial;
  progressArc: THREE.Mesh;
  progressMat: THREE.MeshBasicMaterial;
  orbSlots: THREE.Mesh[];
  emberGroup: THREE.Group;
}

export class IslandWorld {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  private readonly fog: THREE.FogExp2;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly warmRimLight: THREE.DirectionalLight;
  private readonly nightGroup = new THREE.Group();
  private readonly clouds: THREE.Mesh[] = [];
  private readonly windLeaves: THREE.Mesh[] = [];
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly boatGroup = new THREE.Group();
  private readonly groundTex = createIslandGroundTexture();
  private readonly glowTex = createGlowSpriteTexture(
    'rgba(255, 246, 194, 1)',
    'rgba(255, 229, 138, 0.55)',
    'rgba(255, 179, 71, 0)'
  );

  // Standard palette (TICKET-02 Part 3)
  private readonly skyColor = new THREE.Color('#0E1430');
  private readonly fogColor = new THREE.Color('#1B2350');
  private readonly warmSkyColor = new THREE.Color('#241c40');
  private readonly workColor = new THREE.Color();

  private currentWarmth = 0;

  constructor(canvas: HTMLCanvasElement, map: NightMapDef, initialLanterns: LanternState[]) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      320
    );

    this.scene.background = this.skyColor.clone();
    this.fog = new THREE.FogExp2(this.fogColor.getHex(), 0.0045);
    this.scene.fog = this.fog;

    // Formula from spec: ambient intensity = 0.15 + 0.55 * (lit / total)
    this.ambientLight = new THREE.AmbientLight('#F5F1E6', 0.15);
    this.scene.add(this.ambientLight);

    // Bright fill lights so top-down 3rd-person view remains crisp and readable
    this.hemiLight = new THREE.HemisphereLight('#b8c4f0', '#2b394d', 1.15);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight('#eef2ff', 1.45);
    this.moonLight.position.set(28, 44, -26);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -55;
    this.moonLight.shadow.camera.right = 55;
    this.moonLight.shadow.camera.top = 55;
    this.moonLight.shadow.camera.bottom = -55;
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 130;
    this.moonLight.shadow.bias = -0.0008;
    this.scene.add(this.moonLight);

    this.warmRimLight = new THREE.DirectionalLight('#FFB347', 0.35);
    this.warmRimLight.position.set(-28, 22, 32);
    this.scene.add(this.warmRimLight);

    this.buildSkyAndSeaOfClouds();
    this.buildWindLeaves();
    this.scene.add(this.nightGroup);
    this.loadNight(map, initialLanterns);
  }

  private buildSkyAndSeaOfClouds(): void {
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    let s = 1337;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = rand() * Math.PI * 0.44;
      const r = 130 + rand() * 35;
      positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
      positions[i * 3 + 1] = Math.sin(phi) * r + 14;
      positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: '#FFF6C2', size: 0.85, transparent: true, opacity: 0.9 })
      )
    );

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(5, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#FFE9B0' })
    );
    moon.position.set(48, 52, -72);
    this.scene.add(moon);

    // Sea of clouds plane (#12384A) + soft cloud puffs
    const seaPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshBasicMaterial({ color: '#12384A' })
    );
    seaPlane.rotation.x = -Math.PI / 2;
    seaPlane.position.y = -11.5;
    this.scene.add(seaPlane);

    const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#1b475c',
      emissive: '#12384A',
      roughness: 0.95,
    });
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const dist = 52 + (i % 4) * 14;
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const sx = 8 + (i % 4) * 3;
      puff.scale.set(sx, 2.5, sx * 0.85);
      puff.position.set(Math.cos(angle) * dist + 20, -4.5 - (i % 3), Math.sin(angle) * dist);
      puff.userData.baseAngle = angle;
      puff.userData.dist = dist;
      puff.userData.speed = 0.01 + (i % 3) * 0.004;
      this.clouds.push(puff);
      this.scene.add(puff);
    }
  }

  private buildWindLeaves(): void {
    const leafMat = new THREE.MeshBasicMaterial({
      color: '#C9B48A',
      side: THREE.DoubleSide,
    });
    const leafGeo = new THREE.PlaneGeometry(0.32, 0.16);
    for (let i = 0; i < 32; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.visible = false;
      leaf.userData.offsetX = ((i * 19) % 70) - 35;
      leaf.userData.offsetZ = ((i * 29) % 70) - 35;
      leaf.userData.height = 1.2 + (i % 6) * 0.9;
      this.windLeaves.push(leaf);
      this.scene.add(leaf);
    }
  }

  loadNight(map: NightMapDef, lanterns: LanternState[]): void {
    while (this.nightGroup.children.length > 0) {
      this.nightGroup.remove(this.nightGroup.children[0]);
    }
    this.lanternVisuals.clear();
    this.currentWarmth = 0;

    if (map.night === 1) {
      this.buildDiskIsland(0, 0, 40, 0);
      this.buildPierAndBoat();
      this.buildTreeCluster([-19, -15, -15.5, -17.2, -10.5, -16, -8.5, -11.5, -18.5, -9, -14, -5.2]);
    } else if (map.night === 2) {
      this.buildDiskIsland(0, 0, 28, 0);
      this.buildDiskIsland(70, 0, 28, 0);
      this.buildBambooBridge();
      this.buildTreeCluster([10, -14, 14, -10, 62, -14, 78, 12]);
    } else {
      // Night 3 — 3 terraced levels
      this.buildDiskIsland(0, 0, 45, 0);
      this.buildNight3TiersAndRamps(map);
      this.buildTreeCluster([-26, -18, -22, -22, -29, -14, 24, -22]);
    }

    for (const pad of map.jumpPads) {
      this.buildJumpPad(pad.pos);
    }

    this.buildLanternShrines(lanterns);
  }

  private buildDiskIsland(cx: number, cz: number, radius: number, topY: number): void {
    const cliff = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius - 2.4, 3.0, 48),
      new THREE.MeshStandardMaterial({ color: '#42475a', roughness: 0.9 })
    );
    cliff.position.set(cx, topY - 1.52, cz);
    cliff.receiveShadow = true;
    this.nightGroup.add(cliff);

    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.1, 48),
      new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 0.88 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, topY + 0.01, cz);
    grass.receiveShadow = true;
    this.nightGroup.add(grass);
  }

  private buildBambooBridge(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F', roughness: 0.85 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), woodMat);
    bridge.position.set(35, -0.1, 0);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    this.nightGroup.add(bridge);

    for (let x = 27; x <= 43; x += 2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 4.05), woodMat);
      plank.position.set(x, 0.03, 0);
      this.nightGroup.add(plank);
    }
  }

  private buildNight3TiersAndRamps(map: NightMapDef): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#5b5873', roughness: 0.85 });
    const grassMat = new THREE.MeshStandardMaterial({ color: '#2F5D50', roughness: 0.88 });
    const sandMat = new THREE.MeshStandardMaterial({ color: '#C9B48A', roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F', roughness: 0.82 });

    // Tier 1 half-annulus (r in [12, 24], z > 0, top at Y = 3)
    const tier1Shape = new THREE.Shape();
    tier1Shape.absarc(0, 0, 24, 0, Math.PI, false);
    tier1Shape.absarc(0, 0, 12, Math.PI, 0, true);
    tier1Shape.closePath();

    const tier1Geo = new THREE.ExtrudeGeometry(tier1Shape, { depth: 3.0, bevelEnabled: false });
    tier1Geo.rotateX(Math.PI / 2);
    // Note: rotateX(+PI/2) maps shape +Y -> world +Z and extrusion depth +Z -> world -Y
    const tier1Mesh = new THREE.Mesh(tier1Geo, stoneMat);
    tier1Mesh.position.y = 3.0;
    tier1Mesh.castShadow = true;
    tier1Mesh.receiveShadow = true;
    this.nightGroup.add(tier1Mesh);

    const tier1Top = new THREE.Mesh(
      new THREE.RingGeometry(12, 24, 36, 1, 0, Math.PI),
      grassMat
    );
    tier1Top.rotation.x = -Math.PI / 2;
    tier1Top.position.y = 3.02;
    tier1Top.receiveShadow = true;
    this.nightGroup.add(tier1Top);

    // Tier 2 center disk (R = 8, Y = 6)
    const tier2Cliff = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6.0, 36), stoneMat);
    tier2Cliff.position.y = 3.0;
    tier2Cliff.castShadow = true;
    tier2Cliff.receiveShadow = true;
    this.nightGroup.add(tier2Cliff);

    const tier2Top = new THREE.Mesh(new THREE.CircleGeometry(8, 36), sandMat);
    tier2Top.rotation.x = -Math.PI / 2;
    tier2Top.position.y = 6.02;
    tier2Top.receiveShadow = true;
    this.nightGroup.add(tier2Top);

    // 2 straight 3m ramps along 30° and 150° from r=30 (Y=0) to r=24 (Y=3)
    for (const ramp of map.ramps) {
      const rad = (ramp.angleDeg * Math.PI) / 180;
      const midR = (ramp.rStart + ramp.rEnd) / 2;
      const horizLen = ramp.rStart - ramp.rEnd;
      const heightDiff = ramp.yEnd - ramp.yStart;
      const slopeLen = Math.hypot(horizLen, heightDiff);
      const slopePitch = Math.atan2(heightDiff, horizLen);

      const rampGroup = new THREE.Group();
      rampGroup.position.set(Math.cos(rad) * midR, (ramp.yStart + ramp.yEnd) / 2, Math.sin(rad) * midR);
      rampGroup.rotation.y = -rad + Math.PI / 2;

      const rampMesh = new THREE.Mesh(
        new THREE.BoxGeometry(ramp.halfWidth * 2, 0.25, slopeLen),
        woodMat
      );
      rampMesh.rotation.x = -slopePitch;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampGroup.add(rampMesh);
      this.nightGroup.add(rampGroup);
    }

    // Bell Tower at (0, 6, 0), R = 2m, H = 8m
    const towerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 2.0, 8.0, 16),
      woodMat
    );
    towerBase.position.set(0, 10.0, 0);
    towerBase.castShadow = true;
    this.nightGroup.add(towerBase);

    const towerRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.7, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: '#3b2e4d', roughness: 0.7 })
    );
    towerRoof.position.set(0, 15.1, 0);
    towerRoof.castShadow = true;
    this.nightGroup.add(towerRoof);

    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.7, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: '#F2C14E', metalness: 0.6, roughness: 0.3 })
    );
    bell.position.set(0, 13.4, 0);
    this.nightGroup.add(bell);
  }

  private buildJumpPad(pos: Vec3): void {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.1, 0.16, 20),
      new THREE.MeshStandardMaterial({
        color: '#F2C14E',
        emissive: '#FFB347',
        emissiveIntensity: 0.65,
      })
    );
    pad.position.set(pos[0], pos[1] + 0.08, pos[2]);
    this.nightGroup.add(pad);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#FFE58A',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.set(2.8, 2.8, 1);
    glow.position.set(pos[0], pos[1] + 0.6, pos[2]);
    this.nightGroup.add(glow);
  }

  private buildPierAndBoat(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F', roughness: 0.85 });
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.15), woodMat);
      plank.position.set(0, 0.06, -38.8 - i * 1.25);
      plank.receiveShadow = true;
      this.nightGroup.add(plank);
    }

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 4.6), woodMat);
    this.boatGroup.clear();
    this.boatGroup.add(hull);
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#FFE9B0' })
    );
    lantern.position.set(0, 1.5, 1.4);
    this.boatGroup.add(lantern);
    this.boatGroup.position.set(3.4, -0.25, -44.4);
    this.nightGroup.add(this.boatGroup);
  }

  private buildTreeCluster(coords: number[]): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F', roughness: 0.88 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2F5D50', roughness: 0.8 });
    for (let i = 0; i < coords.length; i += 2) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.8, 7), trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      tree.add(trunk);
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.2, 8), leafMat);
      c1.position.y = 2.2;
      c1.castShadow = true;
      tree.add(c1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 8), leafMat);
      c2.position.y = 3.3;
      c2.castShadow = true;
      tree.add(c2);
      tree.position.set(coords[i], 0, coords[i + 1]);
      this.nightGroup.add(tree);
    }
  }

  private buildLanternShrines(lanterns: LanternState[]): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#5B5F6E', roughness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6B4A2F', roughness: 0.75 });

    for (const lantern of lanterns) {
      const group = new THREE.Group();
      group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.45, 8), stoneMat);
      pedestal.position.y = 0.225;
      pedestal.receiveShadow = true;
      group.add(pedestal);

      for (const [px, pz] of [
        [-0.55, -0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [0.55, 0.55],
      ]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 7), woodMat);
        pillar.position.set(px, 1.85, pz);
        pillar.castShadow = true;
        group.add(pillar);
      }

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.85, 8), woodMat);
      roof.position.y = 3.75;
      roof.castShadow = true;
      group.add(roof);

      const coreMat = new THREE.MeshStandardMaterial({
        color: '#5B5F6E',
        emissive: '#FFB347',
        emissiveIntensity: 0.2,
        roughness: 0.38,
      });
      const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.46, 1.2, 8), coreMat);
      coreMesh.position.y = 2.7;
      group.add(coreMesh);

      // Paper tear marks visible when lantern is unlit (colorblind-friendly shape cue)
      const tearMarks = new THREE.Group();
      const tearMat = new THREE.MeshBasicMaterial({ color: '#1a1a28', side: THREE.DoubleSide });
      for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
        const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.55), tearMat);
        tear.position.set(Math.sin(angle) * 0.52, 2.65, Math.cos(angle) * 0.52);
        tear.rotation.y = angle;
        tear.rotation.z = 0.28;
        tearMarks.add(tear);
      }
      group.add(tearMarks);

      // 3D Fuel bar floating above lit lanterns
      const fuelBarGroup = new THREE.Group();
      fuelBarGroup.position.y = 4.65;
      const fuelBg = new THREE.Mesh(
        new THREE.BoxGeometry(1.68, 0.2, 0.08),
        new THREE.MeshBasicMaterial({ color: '#0E1430' })
      );
      fuelBarGroup.add(fuelBg);
      const fuelBarFillMat = new THREE.MeshBasicMaterial({ color: '#FFB347' });
      const fuelBarFill = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.13, 0.1), fuelBarFillMat);
      fuelBarGroup.add(fuelBarFill);
      fuelBarGroup.visible = false;
      group.add(fuelBarGroup);

      const haloMat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#FFE9B0',
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloSprite = new THREE.Sprite(haloMat);
      haloSprite.scale.set(4.5, 4.5, 1);
      haloSprite.position.y = 2.7;
      group.add(haloSprite);

      const light = new THREE.PointLight('#FFB347', 3.0, 26, 1.1);
      light.position.set(0, 3.0, 0);
      group.add(light);

      const safeRingMat = new THREE.MeshBasicMaterial({
        color: '#F2C14E',
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const safeRing = new THREE.Mesh(
        new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 52),
        safeRingMat
      );
      safeRing.rotation.x = -Math.PI / 2;
      safeRing.position.y = 0.05;
      safeRing.visible = false;
      group.add(safeRing);

      const progressMat = new THREE.MeshBasicMaterial({
        color: '#F2C14E',
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
      });
      const progressArc = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.68, 28), progressMat);
      progressArc.rotation.x = -Math.PI / 2;
      progressArc.position.y = 0.06;
      group.add(progressArc);

      const orbSlots: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#5B5F6E' })
        );
        const a = (i * Math.PI * 2) / 5;
        orb.position.set(Math.cos(a) * 1.25, 0.8, Math.sin(a) * 1.25);
        group.add(orb);
        orbSlots.push(orb);
      }

      const emberGroup = new THREE.Group();
      const emberMat = new THREE.MeshBasicMaterial({ color: '#FFE9B0' });
      for (let i = 0; i < 8; i++) {
        emberGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), emberMat));
      }
      emberGroup.visible = false;
      group.add(emberGroup);

      this.nightGroup.add(group);
      this.lanternVisuals.set(lantern.id, {
        id: lantern.id,
        group,
        coreMesh,
        coreMat,
        tearMarks,
        fuelBarGroup,
        fuelBarFill,
        fuelBarFillMat,
        haloSprite,
        haloMat,
        light,
        safeRing,
        safeRingMat,
        progressArc,
        progressMat,
        orbSlots,
        emberGroup,
      });
    }
  }

  syncLanterns(lanterns: LanternState[], wind: WindState, timeS: number, dt: number): void {
    let litCount = 0;
    for (const lantern of lanterns) {
      if (lantern.lit) litCount++;
      const vis = this.lanternVisuals.get(lantern.id);
      if (!vis) continue;

      const cost = lantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      const ratio = Math.min(1, lantern.deposited / cost);
      const filledSegments = Math.round(ratio * vis.orbSlots.length);
      vis.orbSlots.forEach((orb, idx) => {
        const mat = orb.material as THREE.MeshBasicMaterial;
        const filled = idx < filledSegments;
        mat.color.set(filled ? '#FFB347' : '#5B5F6E');
        orb.scale.setScalar(filled ? 1.25 : 0.85);
      });

      if (lantern.lit) {
        const fuel = lantern.fuelUnits / TICK_RATE;
        const fuelFrac = Math.max(0.02, Math.min(1, fuel / TUNING.fuel_max));
        const isLow = fuel < TUNING.low_fuel_threshold;
        const blinkOn = !isLow || Math.sin(timeS * Math.PI * 2) >= 0;
        const flicker = 1 + Math.sin(timeS * 5 + lantern.pos[0]) * 0.06;

        vis.coreMesh.scale.y = 1.0;
        vis.tearMarks.visible = false;
        vis.fuelBarGroup.visible = true;
        vis.fuelBarGroup.lookAt(this.camera.position);
        vis.fuelBarFill.scale.x = fuelFrac;
        vis.fuelBarFill.position.x = -(1 - fuelFrac) * 0.78;
        vis.fuelBarFillMat.color.set(isLow ? (blinkOn ? '#FF5A5F' : '#FFE9B0') : '#FFB347');

        vis.coreMat.color.set('#FFE9B0');
        vis.coreMat.emissive.set('#FFB347');
        vis.coreMat.emissiveIntensity = (blinkOn ? 2.2 : 0.5) * flicker;
        vis.haloMat.opacity = (blinkOn ? 0.85 : 0.25) * flicker;
        vis.haloSprite.scale.setScalar(7.2 * flicker);
        vis.light.intensity = (blinkOn ? 22 : 8) * flicker;
        vis.safeRing.visible = !isLow;
        vis.progressArc.visible = false;
        vis.emberGroup.visible = true;
        vis.emberGroup.children.forEach((child, idx) => {
          const p = (timeS * 0.9 + idx * 0.45) % 2.8;
          child.position.set(
            Math.cos(timeS * 1.6 + idx) * 0.65,
            2.3 + p * 1.5,
            Math.sin(timeS * 1.6 + idx) * 0.65
          );
        });
      } else {
        // Unlit lanterns deflate 20% vertically and display paper tears
        vis.coreMesh.scale.y = 0.8;
        vis.tearMarks.visible = true;
        vis.fuelBarGroup.visible = false;
        vis.coreMat.color.set('#5B5F6E');
        vis.coreMat.emissive.set('#FFB347');
        vis.coreMat.emissiveIntensity = 0.2 + ratio * 0.9;
        vis.haloMat.opacity = 0.22 + ratio * 0.35;
        vis.haloSprite.scale.setScalar(4.0 + ratio * 1.4);
        vis.light.intensity = 3.0 + ratio * 7.5;
        vis.safeRing.visible = false;
        vis.progressArc.visible = true;
        vis.progressMat.opacity = 0.3 + ratio * 0.55;
        vis.emberGroup.visible = false;
      }
    }

    const total = Math.max(1, lanterns.length);
    const ratioLit = litCount / total;
    // Exact spec ambient intensity: 0.15 + 0.55 * (lit / total)
    this.ambientLight.intensity = 0.15 + 0.55 * ratioLit;

    this.currentWarmth += (ratioLit - this.currentWarmth) * (1 - Math.exp(-2.2 * dt));
    this.workColor.copy(this.skyColor).lerp(this.warmSkyColor, this.currentWarmth);
    (this.scene.background as THREE.Color).copy(this.workColor);
    this.fog.color.copy(this.fogColor);
    this.fog.density = 0.0045 - this.currentWarmth * 0.0018;
    this.hemiLight.intensity = 1.15 + this.currentWarmth * 0.45;

    for (const cloud of this.clouds) {
      const baseAngle = cloud.userData.baseAngle as number;
      const dist = cloud.userData.dist as number;
      const speed = cloud.userData.speed as number;
      const a = baseAngle + timeS * speed;
      cloud.position.x = Math.cos(a) * dist + 20;
      cloud.position.z = Math.sin(a) * dist;
    }

    this.boatGroup.position.y = -0.25 + Math.sin(timeS * 1.6) * 0.14;
    this.boatGroup.rotation.z = Math.sin(timeS * 1.2) * 0.04;

    // Wind leaves VFX during telegraph & active gust
    const showLeaves = wind.enabled && (wind.telegraph || wind.active);
    const windRad = (wind.dirDeg * Math.PI) / 180;
    const speed = wind.active ? 16 : 5;
    this.windLeaves.forEach((leaf, idx) => {
      leaf.visible = showLeaves;
      if (!showLeaves) return;
      const baseX = leaf.userData.offsetX as number;
      const baseZ = leaf.userData.offsetZ as number;
      const h = leaf.userData.height as number;
      const shift = (timeS * speed + idx * 3.1) % 60;
      leaf.position.set(
        ((baseX + Math.cos(windRad) * shift + 45) % 90) - 45,
        h + Math.sin(timeS * 6 + idx) * 0.4,
        ((baseZ + Math.sin(windRad) * shift + 45) % 90) - 45
      );
      leaf.rotation.set(timeS * 4 + idx, timeS * 3, idx);
    });
  }

  projectToScreen(pos: Vec3): { x: number; y: number; inFront: boolean } {
    const v = new THREE.Vector3(pos[0], pos[1] + 2.0, pos[2]);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      inFront: v.z < 1,
    };
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
