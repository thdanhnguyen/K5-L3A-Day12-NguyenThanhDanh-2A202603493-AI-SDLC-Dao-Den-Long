import * as THREE from 'three';
import { TUNING, distXZ } from '../sim/config';
import type {
  CreativeBuffs,
  LanternState,
  MoteColor,
  MoteState,
  PlayerState,
  ShadeState,
  Vec3,
  WanderingGirlState,
} from '../sim/types';
import { createGlowSpriteTexture, createNonLaTexture } from './textures';

const MOTE_COLORS: Record<MoteColor, string> = {
  gold: '#ffd166',
  red: '#ff5a5f',
  blue: '#38bdf8',
  green: '#4ade80',
};

export class EntityVisuals {
  private readonly scene: THREE.Scene;
  private readonly glowTex = createGlowSpriteTexture(
    'rgba(255, 255, 255, 1)',
    'rgba(255, 235, 175, 0.58)',
    'rgba(255, 200, 120, 0)'
  );

  // Player Mây
  private readonly playerGroup = new THREE.Group();
  private readonly playerBody = new THREE.Group();
  private readonly hatLanternLight: THREE.PointLight;
  private readonly hatLanternCore: THREE.Mesh;
  private readonly hatLanternGlow: THREE.Sprite;
  private readonly orbitingFireflies: THREE.Mesh[] = [];
  private readonly buffRing: THREE.Mesh;
  private readonly buffRingMat: THREE.MeshBasicMaterial;
  private readonly pulseWave: THREE.Mesh;
  private readonly pulseWaveMat: THREE.MeshBasicMaterial;
  private pulseWaveTimer = 0;
  private pulseWaveMaxRadius = TUNING.pulse_radius;
  private prevPlayerPos: Vec3 = [0, 0, 0];

  // Chim Giấy Đèn Lồng
  private readonly birdGroup = new THREE.Group();
  private readonly leftWing = new THREE.Mesh();
  private readonly rightWing = new THREE.Mesh();
  private readonly birdCoreMat: THREE.MeshStandardMaterial;
  private readonly birdGlowMat: THREE.SpriteMaterial;
  private readonly birdTrail: THREE.Mesh[] = [];
  private birdPos = new THREE.Vector3(1.2, 2.2, -0.8);
  private idleSinceProgressS = 0;
  private prevBestLanternProgress = 0;
  private manualGuideTimer = 0;

  // Bé Lạc (Wandering Girl)
  private readonly girlGroup = new THREE.Group();
  private readonly girlCelebration: THREE.Group;

  // Dynamic pools
  private readonly moteMeshes = new Map<string, THREE.Group>();
  private readonly shadeMeshes = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- Build Mây ---
    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(0.46, 1.08, 14),
      new THREE.MeshStandardMaterial({ color: '#3b829c', roughness: 0.68 })
    );
    robe.position.y = 0.56;
    robe.castShadow = true;
    this.playerBody.add(robe);

    // Flowing warm amber sash/scarf
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#ffb347', roughness: 0.65 })
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.98;
    this.playerBody.add(sash);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#fde4cf', roughness: 0.6 })
    );
    head.position.y = 1.24;
    head.castShadow = true;
    this.playerBody.add(head);

    // Woven Vietnamese Nón Lá
    const nonLaTex = createNonLaTexture();
    const nonLa = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 0.36, 24),
      new THREE.MeshStandardMaterial({
        map: nonLaTex,
        color: '#f7d88c',
        roughness: 0.72,
      })
    );
    nonLa.position.y = 1.48;
    nonLa.castShadow = true;
    this.playerBody.add(nonLa);

    // Hanging mini lantern at front of nón lá
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: '#6b4228' })
    );
    stick.rotation.x = Math.PI / 3;
    stick.position.set(0, 1.4, 0.58);
    this.playerBody.add(stick);

    this.hatLanternCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffe58f' })
    );
    this.hatLanternCore.position.set(0, 1.24, 0.72);
    this.playerBody.add(this.hatLanternCore);

    this.hatLanternGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffd166',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.hatLanternGlow.scale.set(1.2, 1.2, 1);
    this.hatLanternGlow.position.copy(this.hatLanternCore.position);
    this.playerBody.add(this.hatLanternGlow);

    this.hatLanternLight = new THREE.PointLight('#ffc466', 6.0, 18, 1.1);
    this.hatLanternLight.position.set(0, 1.45, 0.72);
    this.playerBody.add(this.hatLanternLight);

    // Grounded contact shadow disc
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({
        color: '#0e0a1c',
        transparent: true,
        opacity: 0.32,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.03;
    this.playerGroup.add(contactShadow);
    this.playerGroup.add(this.playerBody);

    // Orbiting fireflies representing carried motes
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe58f' })
      );
      orb.visible = false;
      this.orbitingFireflies.push(orb);
      this.playerGroup.add(orb);
    }

    // Active buff ring on ground
    this.buffRingMat = new THREE.MeshBasicMaterial({
      color: '#ff5a5f',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    this.buffRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 1.0, 28),
      this.buffRingMat
    );
    this.buffRing.rotation.x = -Math.PI / 2;
    this.buffRing.position.y = 0.06;
    this.buffRing.visible = false;
    this.playerGroup.add(this.buffRing);
    this.scene.add(this.playerGroup);

    // Pulse shockwave mesh
    this.pulseWaveMat = new THREE.MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.pulseWave = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.0, 48),
      this.pulseWaveMat
    );
    this.pulseWave.rotation.x = -Math.PI / 2;
    this.pulseWave.position.y = 0.14;
    this.pulseWave.visible = false;
    this.scene.add(this.pulseWave);

    // --- Build Chim Giấy Đèn Lồng (Origami Lantern Bird) ---
    const paperMat = new THREE.MeshStandardMaterial({
      color: '#fff9e6',
      emissive: '#ffbf5e',
      emissiveIntensity: 0.55,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    this.birdCoreMat = paperMat;

    const birdBody = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.54, 4), paperMat);
    birdBody.rotation.x = Math.PI / 2;
    this.birdGroup.add(birdBody);

    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 4),
      new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 0.4 })
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.34;
    this.birdGroup.add(beak);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 3), paperMat);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.1, -0.32);
    this.birdGroup.add(tail);

    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 0.16, 0.48, 0.08, -0.02, 0, 0, -0.2]),
        3
      )
    );
    wingGeo.computeVertexNormals();
    this.leftWing.geometry = wingGeo;
    this.leftWing.material = paperMat;
    this.birdGroup.add(this.leftWing);

    const rightWingGeo = new THREE.BufferGeometry();
    rightWingGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 0.16, -0.48, 0.08, -0.02, 0, 0, -0.2]),
        3
      )
    );
    rightWingGeo.computeVertexNormals();
    this.rightWing.geometry = rightWingGeo;
    this.rightWing.material = paperMat;
    this.birdGroup.add(this.rightWing);

    this.birdGlowMat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: '#ffd166',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const birdGlow = new THREE.Sprite(this.birdGlowMat);
    birdGlow.scale.set(1.6, 1.6, 1);
    this.birdGroup.add(birdGlow);

    const birdLight = new THREE.PointLight('#ffd166', 2.8, 10, 1.1);
    this.birdGroup.add(birdLight);
    this.scene.add(this.birdGroup);

    const trailMat = new THREE.MeshBasicMaterial({
      color: '#ffe58f',
      transparent: true,
      opacity: 0.8,
    });
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), trailMat);
      dot.visible = false;
      this.birdTrail.push(dot);
      this.scene.add(dot);
    }

    // --- Build Bé Lạc (Wandering Girl) ---
    const girlCloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.96, 12),
      new THREE.MeshStandardMaterial({ color: '#f08a7e', roughness: 0.65 })
    );
    girlCloak.position.y = 0.48;
    girlCloak.castShadow = true;
    this.girlGroup.add(girlCloak);

    const girlHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#fde4cf', roughness: 0.6 })
    );
    girlHead.position.y = 1.06;
    girlHead.castShadow = true;
    this.girlGroup.add(girlHead);

    const girlRibbon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffe58f' })
    );
    girlRibbon.position.set(0, 1.28, 0);
    this.girlGroup.add(girlRibbon);

    const girlGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffc670',
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    girlGlow.scale.set(2.4, 2.4, 1);
    girlGlow.position.y = 1.1;
    this.girlGroup.add(girlGlow);

    const girlPetalRing = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.85, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffb8a8',
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      })
    );
    girlPetalRing.rotation.x = -Math.PI / 2;
    girlPetalRing.position.y = 0.05;
    this.girlGroup.add(girlPetalRing);

    const girlBeacon = new THREE.PointLight('#ffc078', 5.2, 14, 1.1);
    girlBeacon.position.set(0, 1.4, 0);
    this.girlGroup.add(girlBeacon);

    this.girlCelebration = new THREE.Group();
    const sparkleMat = new THREE.MeshBasicMaterial({ color: '#ffd166' });
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), sparkleMat);
      this.girlCelebration.add(sp);
    }
    this.girlCelebration.visible = false;
    this.girlGroup.add(this.girlCelebration);
    this.scene.add(this.girlGroup);
  }

  triggerPulseEffect(playerPos: Vec3, empowered: boolean): void {
    this.pulseWaveTimer = 0.55;
    this.pulseWaveMaxRadius = TUNING.pulse_radius * (empowered ? 1.4 : 1.0);
    this.pulseWave.position.set(playerPos[0], 0.14, playerPos[2]);
    this.pulseWave.visible = true;
    this.pulseWaveMat.color.set(empowered ? '#ff857a' : '#ffd166');
  }

  triggerManualBirdGuide(): void {
    this.manualGuideTimer = 5.0;
  }

  sync(
    player: PlayerState,
    lanterns: LanternState[],
    motes: MoteState[],
    shades: ShadeState[],
    girl: WanderingGirlState,
    buffs: CreativeBuffs,
    timeS: number,
    dt: number
  ): void {
    // 1. Player Mây
    this.playerGroup.position.set(player.pos[0], player.pos[1], player.pos[2]);

    const vx = player.pos[0] - this.prevPlayerPos[0];
    const vz = player.pos[2] - this.prevPlayerPos[2];
    const moveMag = Math.hypot(vx, vz);
    if (moveMag > 0.004) {
      const targetRot = Math.atan2(vx, vz);
      let diff = targetRot - this.playerBody.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerBody.rotation.y += diff * Math.min(1, dt * 14);
      this.playerBody.position.y = Math.abs(Math.sin(timeS * 12)) * 0.06;
    } else {
      this.playerBody.position.y = 0;
    }
    this.prevPlayerPos = [player.pos[0], player.pos[1], player.pos[2]];

    this.playerBody.visible =
      player.invulnTimer <= 0 || Math.floor(player.invulnTimer * 16) % 2 === 0;

    // Hat lantern brightness scales with carried light
    this.hatLanternLight.intensity = 6.0 + player.carried * 1.4;
    const hatScale = 0.9 + Math.min(1, player.carried / TUNING.carry_capacity) * 0.6;
    this.hatLanternCore.scale.setScalar(hatScale);
    this.hatLanternGlow.scale.setScalar(1.15 + player.carried * 0.16);

    // Orbiting fireflies around Mây
    for (let i = 0; i < this.orbitingFireflies.length; i++) {
      const orb = this.orbitingFireflies[i];
      if (i < player.carried) {
        orb.visible = true;
        const angle = timeS * 2.4 + (i * Math.PI * 2) / Math.max(1, player.carried);
        orb.position.set(
          Math.cos(angle) * 0.98,
          1.15 + Math.sin(timeS * 3 + i) * 0.2,
          Math.sin(angle) * 0.98
        );
      } else {
        orb.visible = false;
      }
    }

    if (buffs.powerTimer > 0) {
      this.buffRing.visible = true;
      this.buffRingMat.color.set('#ff5a5f');
    } else if (buffs.speedTimer > 0) {
      this.buffRing.visible = true;
      this.buffRingMat.color.set('#38bdf8');
    } else {
      this.buffRing.visible = false;
    }

    if (this.pulseWaveTimer > 0) {
      this.pulseWaveTimer = Math.max(0, this.pulseWaveTimer - dt);
      const t = 1 - this.pulseWaveTimer / 0.55;
      const r = 0.8 + t * this.pulseWaveMaxRadius;
      this.pulseWave.scale.setScalar(r);
      this.pulseWaveMat.opacity = (1 - t) * 0.85;
      if (this.pulseWaveTimer === 0) {
        this.pulseWave.visible = false;
      }
    }

    // 2. Chim Giấy Đèn Lồng
    this.updateBird(player, lanterns, shades, timeS, dt);

    // 3. Bé Lạc
    if (girl.active) {
      if (!girl.found) {
        this.girlGroup.visible = true;
        this.girlGroup.position.set(girl.pos[0], 0, girl.pos[2]);
        this.girlGroup.rotation.y = -girl.angle;
        this.girlCelebration.visible = false;
      } else if (girl.celebrationTimer > 0) {
        this.girlGroup.visible = true;
        this.girlCelebration.visible = true;
        const p = 3.0 - girl.celebrationTimer;
        this.girlCelebration.children.forEach((sp, i) => {
          const a = timeS * 4 + (i * Math.PI * 2) / 8;
          sp.position.set(
            Math.cos(a) * (0.6 + p * 0.4),
            0.6 + p * 1.1,
            Math.sin(a) * (0.6 + p * 0.4)
          );
        });
      } else {
        this.girlGroup.visible = false;
      }
    } else {
      this.girlGroup.visible = false;
    }

    // 4. Motes pool
    const activeMoteIds = new Set(motes.map((m) => m.id));
    for (const [id, mesh] of this.moteMeshes) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(mesh);
        this.moteMeshes.delete(id);
      }
    }
    motes.forEach((mote, index) => {
      let group = this.moteMeshes.get(mote.id);
      if (!group) {
        group = this.createMoteMesh(mote.color);
        this.moteMeshes.set(mote.id, group);
        this.scene.add(group);
      }
      group.position.set(
        mote.pos[0],
        0.85 + Math.sin(timeS * 3.1 + index) * 0.22,
        mote.pos[2]
      );
      group.rotation.y = timeS * 1.6 + index;
      const wings = group.userData.wings as THREE.Group;
      wings.rotation.z = Math.sin(timeS * 18 + index) * 0.35;
    });

    // 5. Shades pool
    const activeShadeIds = new Set(shades.map((s) => s.id));
    for (const [id, mesh] of this.shadeMeshes) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(mesh);
        this.shadeMeshes.delete(id);
      }
    }
    shades.forEach((shade, index) => {
      let group = this.shadeMeshes.get(shade.id);
      if (!group) {
        group = this.createShadeMesh(shade.variant === 'large');
        this.shadeMeshes.set(shade.id, group);
        this.scene.add(group);
      }
      const hoverY = Math.sin(timeS * 3.5 + index) * 0.14;
      group.position.set(shade.pos[0], hoverY, shade.pos[2]);

      const bodyMat = group.userData.bodyMat as THREE.MeshStandardMaterial;
      const stunRing = group.userData.stunRing as THREE.Group;
      const wisps = group.userData.wisps as THREE.Group;
      wisps.rotation.y = timeS * 2.2 + index;

      if (shade.state === 'stunned') {
        bodyMat.color.set('#8971b8');
        bodyMat.emissive.set('#d8b4fe');
        bodyMat.emissiveIntensity = 0.8;
        group.rotation.y = timeS * 8;
        stunRing.visible = true;
        stunRing.rotation.y = -timeS * 5;
      } else if (shade.state === 'flee') {
        bodyMat.color.set('#381e5c');
        bodyMat.emissive.set('#a855f7');
        bodyMat.emissiveIntensity = 0.55;
        group.rotation.y = Math.atan2(
          shade.pos[0] - player.pos[0],
          shade.pos[2] - player.pos[2]
        );
        stunRing.visible = false;
      } else {
        bodyMat.color.set('#1f0e33');
        bodyMat.emissive.set('#6b21a8');
        bodyMat.emissiveIntensity = 0.45;
        group.rotation.y = Math.atan2(
          player.pos[0] - shade.pos[0],
          player.pos[2] - shade.pos[2]
        );
        stunRing.visible = false;
      }
    });
  }

  private updateBird(
    player: PlayerState,
    lanterns: LanternState[],
    shades: ShadeState[],
    timeS: number,
    dt: number
  ): void {
    const progressSum = lanterns.reduce((acc, l) => acc + l.deposited + (l.lit ? 5 : 0), 0);
    if (progressSum !== this.prevBestLanternProgress) {
      this.prevBestLanternProgress = progressSum;
      this.idleSinceProgressS = 0;
    } else {
      this.idleSinceProgressS += dt;
    }
    this.manualGuideTimer = Math.max(0, this.manualGuideTimer - dt);

    let targetLantern: LanternState | null = null;
    let bestDist = Infinity;
    for (const l of lanterns) {
      if (l.lit) continue;
      const d = distXZ(player.pos, l.pos);
      if (d < bestDist) {
        bestDist = d;
        targetLantern = l;
      }
    }

    const dangerClose = shades.some(
      (s) => s.state !== 'stunned' && distXZ(player.pos, s.pos) <= 10.5
    );

    const shouldGuide =
      targetLantern !== null &&
      (this.manualGuideTimer > 0 ||
        player.carried >= TUNING.lantern_cost ||
        this.idleSinceProgressS >= 6.0);

    let desiredPos: THREE.Vector3;
    let lookPos: THREE.Vector3;

    if (shouldGuide && targetLantern !== null) {
      const dx = targetLantern.pos[0] - player.pos[0];
      const dz = targetLantern.pos[2] - player.pos[2];
      const len = Math.max(0.01, Math.hypot(dx, dz));
      const lead = Math.min(len, 4.8);
      desiredPos = new THREE.Vector3(
        player.pos[0] + (dx / len) * lead,
        2.35 + Math.sin(timeS * 4.5) * 0.25,
        player.pos[2] + (dz / len) * lead
      );
      lookPos = new THREE.Vector3(targetLantern.pos[0], 2.5, targetLantern.pos[2]);

      this.birdTrail.forEach((dot, idx) => {
        dot.visible = true;
        const frac = (idx + 1) / (this.birdTrail.length + 1);
        const span = Math.min(len, 9.0);
        dot.position.set(
          player.pos[0] + (dx / len) * span * frac,
          1.45 + Math.sin(timeS * 5 + idx) * 0.15,
          player.pos[2] + (dz / len) * span * frac
        );
      });
    } else {
      const orbitA = timeS * 1.45;
      desiredPos = new THREE.Vector3(
        player.pos[0] + Math.cos(orbitA) * 1.5,
        2.15 + Math.sin(timeS * 3.5) * 0.2,
        player.pos[2] + Math.sin(orbitA) * 1.5
      );
      lookPos = new THREE.Vector3(
        desiredPos.x - Math.sin(orbitA),
        desiredPos.y,
        desiredPos.z + Math.cos(orbitA)
      );
      this.birdTrail.forEach((dot) => {
        dot.visible = false;
      });
    }

    this.birdPos.lerp(desiredPos, 1 - Math.exp(-5.5 * dt));
    this.birdGroup.position.copy(this.birdPos);
    this.birdGroup.lookAt(lookPos);

    const flap = Math.sin(timeS * (dangerClose ? 18 : 10)) * 0.55;
    this.leftWing.rotation.z = flap;
    this.rightWing.rotation.z = -flap;
    this.birdCoreMat.emissive.set(dangerClose ? '#e879f9' : '#ffbf5e');
    this.birdCoreMat.emissiveIntensity = dangerClose ? 1.05 : 0.55;
    this.birdGlowMat.color.set(dangerClose ? '#e879f9' : '#ffd166');
  }

  private createMoteMesh(color: MoteColor): THREE.Group {
    const group = new THREE.Group();
    const hex = MOTE_COLORS[color];

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({ color: hex })
    );
    group.add(core);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: hex,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.set(1.5, 1.5, 1);
    group.add(glow);

    // Fluttering fairy firefly wings
    const wings = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.14), wingMat);
      wing.position.set(side * 0.18, 0.06, 0);
      wing.rotation.x = Math.PI / 2;
      wing.rotation.z = side * 0.35;
      wings.add(wing);
    }
    group.add(wings);
    group.userData.wings = wings;

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.4, 18),
      new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.6;
    group.add(halo);
    return group;
  }

  private createShadeMesh(isLarge: boolean): THREE.Group {
    const group = new THREE.Group();
    const scale = isLarge ? 1.45 : 0.9;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#1f0e33',
      emissive: '#6b21a8',
      emissiveIntensity: 0.45,
      roughness: 0.52,
    });

    const torso = new THREE.Mesh(
      new THREE.ConeGeometry(0.52 * scale, 1.5 * scale, 12),
      bodyMat
    );
    torso.position.y = 0.88 * scale;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34 * scale, 12, 10),
      bodyMat
    );
    head.position.y = 1.52 * scale;
    head.castShadow = true;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({
      color: isLarge ? '#fb7185' : '#e879f9',
    });
    for (const side of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065 * scale, 6, 6), eyeMat);
      eye.position.set(side * scale, 1.54 * scale, 0.28 * scale);
      group.add(eye);
    }

    // Floating ink tendrils around base
    const wisps = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const wisp = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * scale, 6, 6),
        bodyMat
      );
      const a = (i * Math.PI * 2) / 4;
      wisp.position.set(Math.cos(a) * 0.48 * scale, 0.32 * scale, Math.sin(a) * 0.48 * scale);
      wisps.add(wisp);
    }
    group.add(wisps);
    group.userData.wisps = wisps;

    // Ground danger aura ring
    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68 * scale, 0.92 * scale, 24),
      new THREE.MeshBasicMaterial({
        color: isLarge ? '#a855f7' : '#9333ea',
        transparent: true,
        opacity: isLarge ? 0.45 : 0.3,
        side: THREE.DoubleSide,
      })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.05;
    group.add(auraRing);

    if (isLarge) {
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.52, 6), bodyMat);
        horn.position.set(side * 0.28, 2.48, 0);
        horn.rotation.z = -side * 0.35;
        group.add(horn);
      }
    }

    const stunRing = new THREE.Group();
    stunRing.position.y = 2.05 * scale;
    const starMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), starMat);
      const a = (i * Math.PI * 2) / 4;
      star.position.set(Math.cos(a) * 0.48 * scale, 0, Math.sin(a) * 0.48 * scale);
      stunRing.add(star);
    }
    stunRing.visible = false;
    group.add(stunRing);

    group.userData.bodyMat = bodyMat;
    group.userData.stunRing = stunRing;
    return group;
  }

  reset(): void {
    for (const mesh of this.moteMeshes.values()) this.scene.remove(mesh);
    this.moteMeshes.clear();
    for (const mesh of this.shadeMeshes.values()) this.scene.remove(mesh);
    this.shadeMeshes.clear();
    this.prevPlayerPos = [0, 0, 0];
    this.idleSinceProgressS = 0;
    this.prevBestLanternProgress = 0;
    this.manualGuideTimer = 0;
    this.pulseWaveTimer = 0;
    this.pulseWave.visible = false;
  }
}
