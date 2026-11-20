import * as THREE from 'three';
import { ISLAND_RADIUS, TUNING } from '../sim/config';
import type { LanternState } from '../sim/types';
import { createGlowSpriteTexture, createIslandGroundTexture } from './textures';

interface LanternVisual {
  id: string;
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
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
  private readonly clouds: THREE.Mesh[] = [];
  private readonly seaLanterns: THREE.Group[] = [];
  private readonly groveFireflies: THREE.Mesh[] = [];
  private readonly boatGroup = new THREE.Group();
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly glowTex = createGlowSpriteTexture(
    'rgba(255, 250, 210, 1)',
    'rgba(255, 190, 82, 0.55)',
    'rgba(255, 145, 50, 0)'
  );

  private readonly darkSky = new THREE.Color('#1a183b');
  private readonly warmSky = new THREE.Color('#43284a');
  private readonly darkFog = new THREE.Color('#211d45');
  private readonly warmFog = new THREE.Color('#543347');
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      280
    );

    this.scene.background = this.darkSky.clone();
    this.fog = new THREE.FogExp2(this.darkFog.getHex(), 0.0062);
    this.scene.fog = this.fog;

    // Bright enchanted fairy-tale lighting
    this.ambientLight = new THREE.AmbientLight('#7a70ad', 0.95);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#c4c0ff', '#483b66', 1.25);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight('#eef0ff', 1.45);
    this.moonLight.position.set(22, 38, -24);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -42;
    this.moonLight.shadow.camera.right = 42;
    this.moonLight.shadow.camera.top = 42;
    this.moonLight.shadow.camera.bottom = -42;
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 110;
    this.moonLight.shadow.bias = -0.0008;
    this.scene.add(this.moonLight);

    this.warmRimLight = new THREE.DirectionalLight('#ffb673', 0.45);
    this.warmRimLight.position.set(-24, 18, 28);
    this.scene.add(this.warmRimLight);

    this.buildSkyAndSeaOfClouds();
    this.buildIslandTerrain(initialLanterns);
    this.buildPierAndBoat();
    this.buildForestGrove();
    this.buildLanternShrines(initialLanterns);
  }

  private buildSkyAndSeaOfClouds(): void {
    // Stars
    const starCount = 460;
    const positions = new Float32Array(starCount * 3);
    let s = 1337;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < starCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = rand() * Math.PI * 0.44;
      const r = 112 + rand() * 35;
      positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
      positions[i * 3 + 1] = Math.sin(phi) * r + 12;
      positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: '#fff1c9',
      size: 0.85,
      transparent: true,
      opacity: 0.9,
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Luminous Moon + glow halo
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 20, 20),
      new THREE.MeshBasicMaterial({ color: '#fff7d6' })
    );
    moon.position.set(44, 48, -64);
    this.scene.add(moon);

    const moonHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffe9b0',
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    moonHalo.scale.set(22, 22, 1);
    moonHalo.position.copy(moon.position);
    this.scene.add(moonHalo);

    // Soft pastel sea of clouds below island
    const cloudGeo = new THREE.SphereGeometry(1, 12, 10);
    const cloudMats = [
      new THREE.MeshStandardMaterial({
        color: '#4f4678',
        emissive: '#282046',
        roughness: 0.92,
      }),
      new THREE.MeshStandardMaterial({
        color: '#5f5288',
        emissive: '#332652',
        roughness: 0.9,
      }),
    ];
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const dist = ISLAND_RADIUS + 6 + (i % 4) * 9;
      const puff = new THREE.Mesh(cloudGeo, cloudMats[i % 2]);
      const sx = 6.2 + (i % 4) * 2.4;
      puff.scale.set(sx, 2.2 + (i % 2), sx * 0.85);
      puff.position.set(
        Math.cos(angle) * dist,
        -2.3 - (i % 3) * 0.9,
        Math.sin(angle) * dist
      );
      puff.userData.baseAngle = angle;
      puff.userData.dist = dist;
      puff.userData.speed = 0.014 + (i % 3) * 0.004;
      this.clouds.push(puff);
      this.scene.add(puff);
    }

    // Floating paper lotus lanterns (đèn hoa đăng) drifting on the cloud sea
    const petalMat = new THREE.MeshStandardMaterial({
      color: '#ff9ebb',
      emissive: '#ff7096',
      emissiveIntensity: 0.4,
      roughness: 0.6,
    });
    const lotusCoreMat = new THREE.MeshBasicMaterial({ color: '#ffe599' });
    for (let i = 0; i < 10; i++) {
      const lotus = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.16, 6), petalMat);
      lotus.add(base);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lotusCoreMat);
      flame.position.y = 0.16;
      lotus.add(flame);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: '#ffb766',
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.scale.set(2.2, 2.2, 1);
      glow.position.y = 0.2;
      lotus.add(glow);

      const angle = (i / 10) * Math.PI * 2 + 0.3;
      const dist = ISLAND_RADIUS + 4.5 + (i % 2) * 3.5;
      lotus.userData.angle = angle;
      lotus.userData.dist = dist;
      lotus.position.set(Math.cos(angle) * dist, -0.5, Math.sin(angle) * dist);
      this.seaLanterns.push(lotus);
      this.scene.add(lotus);
    }
  }

  private buildIslandTerrain(lanterns: LanternState[]): void {
    // Cliff rim cylinder below grass top
    const cliffGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 2.8, 3.0, 48);
    const cliffMat = new THREE.MeshStandardMaterial({
      color: '#384159',
      roughness: 0.88,
    });
    const cliff = new THREE.Mesh(cliffGeo, cliffMat);
    cliff.position.y = -1.52;
    cliff.receiveShadow = true;
    this.scene.add(cliff);

    // Meadow surface with procedural Canvas2D ground texture
    const groundTex = createIslandGroundTexture();
    const grassGeo = new THREE.CircleGeometry(ISLAND_RADIUS - 0.4, 56);
    const grassMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: 0.02,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.01;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Central compass stone plaza at (0, 0, 0)
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.7, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: '#5b5675', roughness: 0.8 })
    );
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 3.7, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.075;
    this.scene.add(plazaRing);

    // Stepping stones from center to each Great Lantern
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#615b7a', roughness: 0.85 });
    for (const lantern of lanterns) {
      const len = Math.hypot(lantern.pos[0], lantern.pos[2]);
      if (len < 1) continue;
      const stepCount = Math.floor(len / 2.2);
      for (let i = 2; i < stepCount; i++) {
        const t = i / stepCount;
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.08, 8), stoneMat);
        stone.position.set(lantern.pos[0] * t, 0.03, lantern.pos[2] * t);
        stone.receiveShadow = true;
        this.scene.add(stone);
      }
    }

    // Perimeter low mossy stones & warm mini-markers
    const postMat = new THREE.MeshStandardMaterial({
      color: '#5d5478',
      roughness: 0.85,
    });
    const capMat = new THREE.MeshBasicMaterial({ color: '#ffd88a' });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const px = Math.sin(a) * (ISLAND_RADIUS - 1.0);
      const pz = Math.cos(a) * (ISLAND_RADIUS - 1.0);
      if (pz < -36.5 && Math.abs(px) < 4.0) continue;

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.9, 6), postMat);
      post.position.set(px, 0.45, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      this.scene.add(post);

      if (i % 2 === 0) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), capMat);
        cap.position.set(px, 1.0, pz);
        this.scene.add(cap);
      }
    }

    // Decorative meadow wildflower tufts & mossy boulders
    const flowerColors = ['#ffd166', '#f4a2c8', '#a5f3fc'];
    const stemMat = new THREE.MeshStandardMaterial({ color: '#3b7a5e', roughness: 0.9 });
    for (let i = 0; i < 36; i++) {
      const a = i * 2.39996;
      const r = 6.5 + ((i * 7.3) % 28);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const tuft = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.28, 6), stemMat);
      base.position.y = 0.14;
      tuft.add(base);
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 6, 6),
        new THREE.MeshBasicMaterial({ color: flowerColors[i % flowerColors.length] })
      );
      bloom.position.y = 0.28;
      tuft.add(bloom);
      tuft.position.set(x, 0, z);
      this.scene.add(tuft);
    }
  }

  private buildPierAndBoat(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5238', roughness: 0.8 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#583926', roughness: 0.85 });

    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.15), woodMat);
      plank.position.set(0, 0.06, -38.8 - i * 1.25);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.scene.add(plank);
    }

    for (const side of [-1.45, 1.45]) {
      for (const zOff of [-39.6, -45.2]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 1.75, 8), darkWoodMat);
        pillar.position.set(side, 0.65, zOff);
        pillar.castShadow = true;
        this.scene.add(pillar);
      }
      const pierLantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshBasicMaterial({ color: '#ffe082' })
      );
      pierLantern.position.set(side, 1.62, -45.2);
      this.scene.add(pierLantern);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: '#ffbe55',
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.scale.set(2.4, 2.4, 1);
      glow.position.copy(pierLantern.position);
      this.scene.add(glow);
    }

    const pierLight = new THREE.PointLight('#ffbe55', 5.0, 16, 1.1);
    pierLight.position.set(0, 2.0, -44.5);
    this.scene.add(pierLight);

    // Moored crescent cloud-boat
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 4.6), woodMat);
    hull.castShadow = true;
    this.boatGroup.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 1.4, 8, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#e6be7a', roughness: 0.75 })
    );
    cabin.rotation.z = Math.PI / 2;
    cabin.rotation.y = Math.PI / 2;
    cabin.position.set(0, 0.55, -0.3);
    this.boatGroup.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), darkWoodMat);
    mast.position.set(0, 1.3, 0.6);
    this.boatGroup.add(mast);
    const bowLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffe599' })
    );
    bowLantern.position.set(0, 2.35, 1.55);
    this.boatGroup.add(bowLantern);
    this.boatGroup.position.set(3.4, -0.25, -44.4);
    this.scene.add(this.boatGroup);
  }

  private buildForestGrove(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c3c2e', roughness: 0.88 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: '#2f6b64', roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: '#3b7e72', roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: '#27595a', roughness: 0.82 }),
    ];

    const treeOffsets: Array<[number, number, number]> = [
      [-19, -15, 1.18],
      [-15.5, -17.2, 0.98],
      [-10.5, -16, 1.24],
      [-8.5, -11.5, 1.02],
      [-18.8, -9, 1.14],
      [-19.6, -5, 0.92],
      [-14, -5.2, 1.06],
      [-9, -6.5, 0.96],
      [-12, -13.2, 0.9],
      [-16.5, -12.6, 1.12],
    ];

    treeOffsets.forEach(([x, z, scale], idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.34 * scale, 1.9 * scale, 7),
        trunkMat
      );
      trunk.position.y = 0.95 * scale;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let tier = 0; tier < 3; tier++) {
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry((1.55 - tier * 0.34) * scale, (2.1 - tier * 0.3) * scale, 9),
          leafMats[(idx + tier) % leafMats.length]
        );
        crown.position.y = (2.1 + tier * 1.15) * scale;
        crown.castShadow = true;
        crown.receiveShadow = true;
        tree.add(crown);
      }

      // Warm fairy-bulb hanging on selected grove trees
      if (idx % 3 === 0) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#ffe082' })
        );
        bulb.position.set(0.8 * scale, 1.95 * scale, 0.4 * scale);
        tree.add(bulb);
      }

      tree.position.set(x, 0, z);
      this.scene.add(tree);
    });

    // Subtle warm grove light + drifting fairy sparks around Bé Lạc's forest
    const groveLight = new THREE.PointLight('#ffd27d', 4.5, 15, 1.1);
    groveLight.position.set(-14, 3.2, -11);
    this.scene.add(groveLight);

    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffe599' });
    for (let i = 0; i < 8; i++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), sparkMat);
      spark.userData.phase = (i / 8) * Math.PI * 2;
      spark.userData.radius = 2.5 + (i % 3) * 1.8;
      this.groveFireflies.push(spark);
      this.scene.add(spark);
    }
  }

  private buildLanternShrines(lanterns: LanternState[]): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#6b6387', roughness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6e3b2e', roughness: 0.72 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#392e4f', roughness: 0.75 });

    for (const lantern of lanterns) {
      const group = new THREE.Group();
      group.position.set(lantern.pos[0], 0, lantern.pos[2]);

      // Stepped stone plinth
      const baseBottom = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.55, 0.3, 8),
        stoneMat
      );
      baseBottom.position.y = 0.15;
      baseBottom.receiveShadow = true;
      group.add(baseBottom);

      const baseTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.15, 0.28, 8),
        stoneMat
      );
      baseTop.position.y = 0.44;
      baseTop.receiveShadow = true;
      group.add(baseTop);

      // Four vermilion wooden shrine pillars
      for (const [px, pz] of [
        [-0.58, -0.58],
        [0.58, -0.58],
        [-0.58, 0.58],
        [0.58, 0.58],
      ]) {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, 3.1, 7),
          woodMat
        );
        pillar.position.set(px, 2.05, pz);
        pillar.castShadow = true;
        group.add(pillar);
      }

      // Pagoda roof & finial
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.85, 8), roofMat);
      roof.position.y = 3.95;
      roof.castShadow = true;
      group.add(roof);

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.4, metalness: 0.3 })
      );
      finial.position.y = 4.45;
      group.add(finial);

      // Paper lantern core
      const coreMat = new THREE.MeshStandardMaterial({
        color: '#6b5b8a',
        emissive: '#ff9f43',
        emissiveIntensity: 0.25,
        roughness: 0.38,
      });
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.46, 1.25, 8),
        coreMat
      );
      core.position.y = 2.85;
      group.add(core);

      // Soft additive glow sprite around lantern core
      const haloMat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffb74d',
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloSprite = new THREE.Sprite(haloMat);
      haloSprite.scale.set(4.5, 4.5, 1);
      haloSprite.position.y = 2.85;
      group.add(haloSprite);

      // Wide warm pool light (decay=1.1 for lush warm illumination)
      const light = new THREE.PointLight('#ffb14d', 3.0, 26, 1.1);
      light.position.set(0, 3.1, 0);
      group.add(light);

      // Safe radius golden aura on ground
      const safeRingMat = new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const safeRing = new THREE.Mesh(
        new THREE.RingGeometry(TUNING.safe_radius - 0.16, TUNING.safe_radius, 52),
        safeRingMat
      );
      safeRing.rotation.x = -Math.PI / 2;
      safeRing.position.y = 0.05;
      safeRing.visible = false;
      group.add(safeRing);

      // Deposit progress ring close to pedestal
      const progressMat = new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const progressArc = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.78, 28),
        progressMat
      );
      progressArc.rotation.x = -Math.PI / 2;
      progressArc.position.y = 0.06;
      group.add(progressArc);

      // 3 deposit indicator orbs around pedestal
      const orbSlots: THREE.Mesh[] = [];
      for (let i = 0; i < TUNING.lantern_cost; i++) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#473e5e' })
        );
        const a = (i * Math.PI * 2) / TUNING.lantern_cost;
        orb.position.set(Math.cos(a) * 1.32, 0.85, Math.sin(a) * 1.32);
        group.add(orb);
        orbSlots.push(orb);
      }

      // Rising ember particles when lit
      const emberGroup = new THREE.Group();
      const emberMat = new THREE.MeshBasicMaterial({ color: '#ffe599' });
      for (let i = 0; i < 8; i++) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), emberMat);
        emberGroup.add(spark);
      }
      emberGroup.visible = false;
      group.add(emberGroup);

      this.scene.add(group);
      this.lanternVisuals.set(lantern.id, {
        id: lantern.id,
        group,
        coreMat,
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

  syncLanterns(lanterns: LanternState[], timeS: number, dt: number): void {
    let litCount = 0;
    for (const lantern of lanterns) {
      if (lantern.lit) litCount++;
      const vis = this.lanternVisuals.get(lantern.id);
      if (!vis) continue;

      vis.group.position.set(lantern.pos[0], 0, lantern.pos[2]);

      const ratio = Math.min(1, lantern.deposited / TUNING.lantern_cost);
      vis.orbSlots.forEach((orb, idx) => {
        const mat = orb.material as THREE.MeshBasicMaterial;
        const filled = idx < lantern.deposited;
        mat.color.set(filled ? '#ffd166' : '#534770');
        orb.scale.setScalar(filled ? 1.25 : 0.85);
        orb.position.y = 0.85 + Math.sin(timeS * 3 + idx) * 0.08;
      });

      if (lantern.lit) {
        const flicker = 1 + Math.sin(timeS * 5 + lantern.pos[0]) * 0.07;
        vis.coreMat.color.set('#fff6d1');
        vis.coreMat.emissive.set('#ffb13d');
        vis.coreMat.emissiveIntensity = 2.2 * flicker;
        vis.haloMat.opacity = 0.85 * flicker;
        vis.haloSprite.scale.setScalar(7.2 * flicker);
        vis.light.intensity = 22 * flicker;
        vis.safeRing.visible = true;
        vis.safeRingMat.opacity = 0.25 + Math.sin(timeS * 2.2) * 0.06;
        vis.progressArc.visible = false;
        vis.emberGroup.visible = true;
        vis.emberGroup.children.forEach((child, idx) => {
          const p = (timeS * 0.9 + idx * 0.45) % 2.8;
          child.position.set(
            Math.cos(timeS * 1.6 + idx) * 0.68,
            2.4 + p * 1.5,
            Math.sin(timeS * 1.6 + idx) * 0.68
          );
        });
      } else {
        vis.coreMat.color.set('#6d5d8c');
        vis.coreMat.emissive.set('#ff9f43');
        vis.coreMat.emissiveIntensity = 0.28 + ratio * 0.95;
        vis.haloMat.opacity = 0.24 + ratio * 0.35;
        vis.haloSprite.scale.setScalar(4.0 + ratio * 1.5);
        vis.light.intensity = 3.2 + ratio * 7.5;
        vis.safeRing.visible = false;
        vis.progressArc.visible = true;
        vis.progressMat.opacity = 0.32 + ratio * 0.55;
        vis.progressArc.scale.setScalar(0.92 + ratio * 0.14);
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
    this.fog.density = 0.0062 - this.currentWarmth * 0.003;
    this.hemiLight.intensity = 1.25 + this.currentWarmth * 0.5;
    this.moonLight.intensity = 1.45 + this.currentWarmth * 0.25;

    // Clouds & floating lotus lanterns
    for (const cloud of this.clouds) {
      const baseAngle = cloud.userData.baseAngle as number;
      const dist = cloud.userData.dist as number;
      const speed = cloud.userData.speed as number;
      const a = baseAngle + timeS * speed;
      cloud.position.x = Math.cos(a) * dist;
      cloud.position.z = Math.sin(a) * dist;
    }

    for (let i = 0; i < this.seaLanterns.length; i++) {
      const lotus = this.seaLanterns[i];
      const baseA = lotus.userData.angle as number;
      const dist = lotus.userData.dist as number;
      const a = baseA + timeS * 0.03;
      lotus.position.set(
        Math.cos(a) * dist,
        -0.45 + Math.sin(timeS * 1.8 + i) * 0.18,
        Math.sin(a) * dist
      );
      lotus.rotation.y = timeS * 0.4 + i;
    }

    for (let i = 0; i < this.groveFireflies.length; i++) {
      const sp = this.groveFireflies[i];
      const phase = sp.userData.phase as number;
      const rad = sp.userData.radius as number;
      sp.position.set(
        -14 + Math.cos(timeS * 0.7 + phase) * rad,
        1.2 + Math.sin(timeS * 2.1 + phase) * 0.65,
        -11 + Math.sin(timeS * 0.7 + phase) * rad
      );
    }

    this.boatGroup.position.y = -0.25 + Math.sin(timeS * 1.6) * 0.14;
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
