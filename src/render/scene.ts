import * as THREE from 'three';
import { ISLAND_RADIUS, TUNING } from '../sim/config';
import type { LanternState } from '../sim/types';

interface LanternVisual {
  id: string;
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
  safeRingMat: THREE.MeshBasicMaterial;
  progressArc: THREE.Mesh;
  progressMat: THREE.MeshBasicMaterial;
  emberGroup: THREE.Group;
}

export class IslandWorld {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  private readonly fog: THREE.FogExp2;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly clouds: THREE.Mesh[] = [];
  private readonly boatGroup = new THREE.Group();
  private readonly lanternVisuals = new Map<string, LanternVisual>();

  private readonly darkSky = new THREE.Color('#090616');
  private readonly warmSky = new THREE.Color('#27182c');
  private readonly darkFog = new THREE.Color('#0c071b');
  private readonly warmFog = new THREE.Color('#301d28');
  private readonly workColor = new THREE.Color();

  private currentWarmth = 0;

  constructor(canvas: HTMLCanvasElement, initialLanterns: LanternState[]) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );

    this.scene.background = this.darkSky.clone();
    this.fog = new THREE.FogExp2(this.darkFog.getHex(), 0.0155);
    this.scene.fog = this.fog;

    this.hemiLight = new THREE.HemisphereLight('#7a6cb8', '#1b1429', 0.72);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight('#b9b4ff', 0.68);
    this.moonLight.position.set(18, 32, -20);
    this.scene.add(this.moonLight);

    this.buildSkyAndSeaOfClouds();
    this.buildIslandTerrain(initialLanterns);
    this.buildPierAndBoat();
    this.buildForestGrove();
    this.buildLanternShrines(initialLanterns);
  }

  private buildSkyAndSeaOfClouds(): void {
    // Stars
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    let s = 1337;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = rand() * Math.PI * 0.42;
      const r = 110 + rand() * 35;
      positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
      positions[i * 3 + 1] = Math.sin(phi) * r + 10;
      positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: '#ffe8b8',
      size: 0.75,
      transparent: true,
      opacity: 0.85,
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Crescent Moon
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#fff3c4' })
    );
    moon.position.set(42, 48, -62);
    this.scene.add(moon);

    // Sea of clouds below island
    const cloudGeo = new THREE.SphereGeometry(1, 12, 10);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#251d3a',
      emissive: '#140f26',
      roughness: 0.95,
    });
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2;
      const dist = ISLAND_RADIUS + 6 + (i % 3) * 10;
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const sx = 6 + (i % 4) * 2.5;
      puff.scale.set(sx, 2.2 + (i % 2), sx * 0.8);
      puff.position.set(
        Math.cos(angle) * dist,
        -2.6 - (i % 3) * 1.1,
        Math.sin(angle) * dist
      );
      puff.userData.baseAngle = angle;
      puff.userData.dist = dist;
      puff.userData.speed = 0.012 + (i % 3) * 0.004;
      this.clouds.push(puff);
      this.scene.add(puff);
    }
  }

  private buildIslandTerrain(lanterns: LanternState[]): void {
    // Main circular island top at y = 0
    const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 2.5, 3.0, 48);
    const islandMat = new THREE.MeshStandardMaterial({
      color: '#202b38',
      roughness: 0.92,
      metalness: 0.04,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -1.5;
    this.scene.add(island);

    // Soft moss center & outer stone rim
    const grassGeo = new THREE.CircleGeometry(ISLAND_RADIUS - 2.2, 48);
    const grassMat = new THREE.MeshStandardMaterial({
      color: '#253543',
      roughness: 0.95,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.01;
    this.scene.add(grass);

    // Central stone star plaza at (0,0,0)
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 24),
      new THREE.MeshStandardMaterial({ color: '#39344a', roughness: 0.85 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.025;
    this.scene.add(plaza);

    // Stone footpaths from center to each Great Lantern
    const pathMat = new THREE.MeshStandardMaterial({ color: '#353147', roughness: 0.9 });
    for (const lantern of lanterns) {
      const len = Math.hypot(lantern.pos[0], lantern.pos[2]);
      if (len < 1) continue;
      const stepCount = Math.floor(len / 2.4);
      for (let i = 1; i < stepCount; i++) {
        const t = i / stepCount;
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.06, 8), pathMat);
        stone.position.set(lantern.pos[0] * t, 0.02, lantern.pos[2] * t);
        this.scene.add(stone);
      }
    }

    // Perimeter low stone boundary posts indicating soft cloud edge
    const postMat = new THREE.MeshStandardMaterial({
      color: '#463f5c',
      emissive: '#1e1633',
      roughness: 0.8,
    });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      // Leave gap for wooden pier around south (-Z, angle -PI/2 or x~0, z<0)
      const px = Math.sin(a) * (ISLAND_RADIUS - 0.8);
      const pz = Math.cos(a) * (ISLAND_RADIUS - 0.8);
      if (pz < -37 && Math.abs(px) < 3.5) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.85, 6), postMat);
      post.position.set(px, 0.4, pz);
      this.scene.add(post);
    }
  }

  private buildPierAndBoat(): void {
    // Wooden pier at south shore (0, 0, -40) — Đảo Bến
    const woodMat = new THREE.MeshStandardMaterial({ color: '#5c3c28', roughness: 0.85 });
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.15), woodMat);
      plank.position.set(0, 0.04, -38.8 - i * 1.25);
      this.scene.add(plank);
    }
    for (const side of [-1.4, 1.4]) {
      for (const zOff of [-40, -45]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 8), woodMat);
        pillar.position.set(side, 0.55, zOff);
        this.scene.add(pillar);
      }
    }
    const pierLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd166' })
    );
    pierLantern.position.set(1.4, 1.42, -45);
    this.scene.add(pierLantern);
    const pierLight = new THREE.PointLight('#ffaa44', 1.6, 10);
    pierLight.position.set(1.4, 1.5, -45);
    this.scene.add(pierLight);

    // Moored crescent cloud-boat
    const boatHull = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.5, 4.4),
      new THREE.MeshStandardMaterial({ color: '#6b472f', roughness: 0.8 })
    );
    this.boatGroup.add(boatHull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6),
      woodMat
    );
    mast.position.set(0, 1.2, 0.4);
    this.boatGroup.add(mast);
    const bowLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd166' })
    );
    bowLantern.position.set(0, 2.1, 1.6);
    this.boatGroup.add(bowLantern);
    this.boatGroup.position.set(3.2, -0.35, -44.2);
    this.scene.add(this.boatGroup);
  }

  private buildForestGrove(): void {
    // Cozy twilight grove around (-14, 0, -11) where Bé Lạc wanders
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2824', roughness: 0.9 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: '#24474f', roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: '#2b5459', roughness: 0.85 }),
    ];

    const treeOffsets: Array<[number, number, number]> = [
      [-19, -15, 1.15],
      [-15.5, -17, 0.95],
      [-10.5, -16, 1.2],
      [-8.5, -11.5, 1.0],
      [-18.5, -9, 1.1],
      [-19.5, -5, 0.9],
      [-14, -5.2, 1.05],
      [-9, -6.5, 0.95],
      [-12, -13, 0.85],
      [-16.5, -12.5, 1.1],
    ];

    treeOffsets.forEach(([x, z, scale], idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 1.8 * scale, 7),
        trunkMat
      );
      trunk.position.y = 0.9 * scale;
      tree.add(trunk);

      const crown1 = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 * scale, 2.3 * scale, 8),
        leafMats[idx % 2]
      );
      crown1.position.y = 2.4 * scale;
      tree.add(crown1);

      const crown2 = new THREE.Mesh(
        new THREE.ConeGeometry(1.1 * scale, 1.9 * scale, 8),
        leafMats[(idx + 1) % 2]
      );
      crown2.position.y = 3.5 * scale;
      tree.add(crown2);

      tree.position.set(x, 0, z);
      this.scene.add(tree);
    });
  }

  private buildLanternShrines(lanterns: LanternState[]): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#453e59', roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#5c3c28', roughness: 0.8 });

    for (const lantern of lanterns) {
      const group = new THREE.Group();
      group.position.set(lantern.pos[0], 0, lantern.pos[2]);

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.25, 0.45, 8),
        stoneMat
      );
      pedestal.position.y = 0.225;
      group.add(pedestal);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 3.2, 8),
        woodMat
      );
      post.position.y = 1.8;
      group.add(post);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 0.75, 8),
        woodMat
      );
      roof.position.y = 3.9;
      group.add(roof);

      const coreMat = new THREE.MeshStandardMaterial({
        color: '#4c3f63',
        emissive: '#ff9f43',
        emissiveIntensity: 0.08,
        roughness: 0.4,
      });
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.48, 1.15, 8),
        coreMat
      );
      core.position.y = 3.1;
      group.add(core);

      const light = new THREE.PointLight('#ffaa44', 0, 22, 1.5);
      light.position.set(0, 3.3, 0);
      group.add(light);

      // Safe radius golden aura on ground (shown when lit)
      const safeRingMat = new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const safeRing = new THREE.Mesh(
        new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48),
        safeRingMat
      );
      safeRing.rotation.x = -Math.PI / 2;
      safeRing.position.y = 0.04;
      safeRing.visible = false;
      group.add(safeRing);

      // Deposit progress ring close to pedestal
      const progressMat = new THREE.MeshBasicMaterial({
        color: '#ffb74d',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      const progressArc = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 1.55, 24),
        progressMat
      );
      progressArc.rotation.x = -Math.PI / 2;
      progressArc.position.y = 0.05;
      group.add(progressArc);

      // Rising ember particles when lit
      const emberGroup = new THREE.Group();
      const emberMat = new THREE.MeshBasicMaterial({ color: '#ffd166' });
      for (let i = 0; i < 6; i++) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), emberMat);
        spark.userData.phase = (i / 6) * Math.PI * 2;
        emberGroup.add(spark);
      }
      emberGroup.visible = false;
      group.add(emberGroup);

      this.scene.add(group);
      this.lanternVisuals.set(lantern.id, {
        id: lantern.id,
        group,
        coreMat,
        light,
        safeRing,
        safeRingMat,
        progressArc,
        progressMat,
        emberGroup,
      });
    }
  }

  syncLanterns(lanterns: LanternState[], timeS: number, dt: number): void {
    let litCount = 0;
    for (const lantern of lanterns) {
      if (lantern.lit) litCount++;
      const vis = this.lanternVisuals.get(lantern.id);
      if (!vis) continue;

      vis.group.position.set(lantern.pos[0], 0, lantern.pos[2]);

      const ratio = Math.min(1, lantern.deposited / TUNING.lantern_cost);
      if (lantern.lit) {
        const flicker = 1 + Math.sin(timeS * 5 + lantern.pos[0]) * 0.07;
        vis.coreMat.color.set('#fff3c4');
        vis.coreMat.emissive.set('#ffaa3b');
        vis.coreMat.emissiveIntensity = 1.9 * flicker;
        vis.light.intensity = 18 * flicker;
        vis.safeRing.visible = true;
        vis.safeRingMat.opacity = 0.2 + Math.sin(timeS * 2.2) * 0.05;
        vis.progressArc.visible = false;
        vis.emberGroup.visible = true;
        vis.emberGroup.children.forEach((child, idx) => {
          const p = (timeS * 0.8 + idx * 0.55) % 2.4;
          child.position.set(
            Math.cos(timeS * 1.5 + idx) * 0.55,
            2.6 + p * 1.4,
            Math.sin(timeS * 1.5 + idx) * 0.55
          );
        });
      } else {
        vis.coreMat.color.set('#4c3f63');
        vis.coreMat.emissive.set('#ff9f43');
        vis.coreMat.emissiveIntensity = 0.1 + ratio * 0.75;
        vis.light.intensity = ratio * 4.5;
        vis.safeRing.visible = false;
        vis.progressArc.visible = true;
        vis.progressMat.opacity = 0.18 + ratio * 0.55;
        vis.progressArc.scale.setScalar(0.85 + ratio * 0.2);
        vis.emberGroup.visible = false;
      }
    }

    // Smooth sky & atmosphere warming (0/5 -> 5/5 lit)
    const targetWarmth = litCount / Math.max(1, TUNING.lantern_count_night1);
    this.currentWarmth += (targetWarmth - this.currentWarmth) * (1 - Math.exp(-2.2 * dt));

    this.workColor.copy(this.darkSky).lerp(this.warmSky, this.currentWarmth);
    (this.scene.background as THREE.Color).copy(this.workColor);
    this.workColor.copy(this.darkFog).lerp(this.warmFog, this.currentWarmth);
    this.fog.color.copy(this.workColor);
    this.fog.density = 0.0155 - this.currentWarmth * 0.0055;
    this.hemiLight.intensity = 0.72 + this.currentWarmth * 0.65;
    this.moonLight.intensity = 0.68 + this.currentWarmth * 0.35;

    // Gentle cloud drift & moored cloud-boat bobbing
    for (const cloud of this.clouds) {
      const baseAngle = cloud.userData.baseAngle as number;
      const dist = cloud.userData.dist as number;
      const speed = cloud.userData.speed as number;
      const a = baseAngle + timeS * speed;
      cloud.position.x = Math.cos(a) * dist;
      cloud.position.z = Math.sin(a) * dist;
    }
    this.boatGroup.position.y = -0.35 + Math.sin(timeS * 1.6) * 0.15;
    this.boatGroup.rotation.z = Math.sin(timeS * 1.2) * 0.04;
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
