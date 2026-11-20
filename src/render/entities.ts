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

const MOTE_COLORS: Record<MoteColor, string> = {
  gold: '#ffd166',
  red: '#ff5a5f',
  blue: '#38bdf8',
  green: '#4ade80',
};

export class EntityVisuals {
  private readonly scene: THREE.Scene;

  // Player Mây
  private readonly playerGroup = new THREE.Group();
  private readonly playerBody = new THREE.Group();
  private readonly hatLanternLight: THREE.PointLight;
  private readonly hatLanternCore: THREE.Mesh;
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
      new THREE.ConeGeometry(0.45, 1.15, 12),
      new THREE.MeshStandardMaterial({ color: '#396f85', roughness: 0.75 })
    );
    robe.position.y = 0.58;
    this.playerBody.add(robe);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#fde4cf', roughness: 0.65 })
    );
    head.position.y = 1.24;
    this.playerBody.add(head);

    // Nón lá
    const nonLa = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.34, 20),
      new THREE.MeshStandardMaterial({ color: '#e6be6a', roughness: 0.75 })
    );
    nonLa.position.y = 1.46;
    this.playerBody.add(nonLa);

    // Small pole + hanging mini lantern at front of nón lá
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6),
      new THREE.MeshStandardMaterial({ color: '#5c3c28' })
    );
    stick.rotation.x = Math.PI / 3;
    stick.position.set(0, 1.38, 0.52);
    this.playerBody.add(stick);

    this.hatLanternCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd166' })
    );
    this.hatLanternCore.position.set(0, 1.24, 0.66);
    this.playerBody.add(this.hatLanternCore);

    this.hatLanternLight = new THREE.PointLight('#ffbe55', 2.2, 10);
    this.hatLanternLight.position.set(0, 1.3, 0.68);
    this.playerBody.add(this.hatLanternLight);

    this.playerGroup.add(this.playerBody);

    // Orbiting fireflies representing carried motes
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe07a' })
      );
      orb.visible = false;
      this.orbitingFireflies.push(orb);
      this.playerGroup.add(orb);
    }

    // Active buff ring on ground
    this.buffRingMat = new THREE.MeshBasicMaterial({
      color: '#ff5a5f',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    this.buffRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.95, 28),
      this.buffRingMat
    );
    this.buffRing.rotation.x = -Math.PI / 2;
    this.buffRing.position.y = 0.05;
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
    this.pulseWave.position.y = 0.12;
    this.pulseWave.visible = false;
    this.scene.add(this.pulseWave);

    // --- Build Chim Giấy Đèn Lồng (Origami Lantern Bird) ---
    const paperMat = new THREE.MeshStandardMaterial({
      color: '#fff6dc',
      emissive: '#ffb84d',
      emissiveIntensity: 0.45,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    this.birdCoreMat = paperMat;

    const birdBody = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 4), paperMat);
    birdBody.rotation.x = Math.PI / 2;
    this.birdGroup.add(birdBody);

    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 0.14, 0.42, 0.06, -0.02, 0, 0, -0.18]),
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
        new Float32Array([0, 0, 0.14, -0.42, 0.06, -0.02, 0, 0, -0.18]),
        3
      )
    );
    rightWingGeo.computeVertexNormals();
    this.rightWing.geometry = rightWingGeo;
    this.rightWing.material = paperMat;
    this.birdGroup.add(this.rightWing);

    const birdLight = new THREE.PointLight('#ffd166', 1.4, 7);
    this.birdGroup.add(birdLight);
    this.scene.add(this.birdGroup);

    // Bird golden guidance trail
    const trailMat = new THREE.MeshBasicMaterial({
      color: '#ffe07a',
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), trailMat);
      dot.visible = false;
      this.birdTrail.push(dot);
      this.scene.add(dot);
    }

    // --- Build Bé Lạc (Wandering Girl) ---
    const girlCloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.92, 10),
      new THREE.MeshStandardMaterial({ color: '#e67e73', roughness: 0.7 })
    );
    girlCloak.position.y = 0.46;
    this.girlGroup.add(girlCloak);

    const girlHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#fde4cf', roughness: 0.65 })
    );
    girlHead.position.y = 1.02;
    this.girlGroup.add(girlHead);

    const girlRibbon = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffe082' })
    );
    girlRibbon.position.set(0, 1.24, 0);
    this.girlGroup.add(girlRibbon);

    const girlBeacon = new THREE.PointLight('#ffb86c', 3.0, 11);
    girlBeacon.position.set(0, 1.4, 0);
    this.girlGroup.add(girlBeacon);

    this.girlCelebration = new THREE.Group();
    const sparkleMat = new THREE.MeshBasicMaterial({ color: '#ffd166' });
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), sparkleMat);
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
    if (Math.hypot(vx, vz) > 0.004) {
      const targetRot = Math.atan2(vx, vz);
      let diff = targetRot - this.playerBody.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerBody.rotation.y += diff * Math.min(1, dt * 14);
    }
    this.prevPlayerPos = [player.pos[0], player.pos[1], player.pos[2]];

    // Invulnerability blink
    this.playerBody.visible =
      player.invulnTimer <= 0 || Math.floor(player.invulnTimer * 16) % 2 === 0;

    // Hat lantern brightness scales with carried light
    this.hatLanternLight.intensity = 1.6 + player.carried * 0.85;
    const hatScale = 0.85 + Math.min(1, player.carried / TUNING.carry_capacity) * 0.55;
    this.hatLanternCore.scale.setScalar(hatScale);

    // Orbiting fireflies around Mây
    for (let i = 0; i < this.orbitingFireflies.length; i++) {
      const orb = this.orbitingFireflies[i];
      if (i < player.carried) {
        orb.visible = true;
        const angle = timeS * 2.4 + (i * Math.PI * 2) / Math.max(1, player.carried);
        orb.position.set(
          Math.cos(angle) * 0.95,
          1.15 + Math.sin(timeS * 3 + i) * 0.2,
          Math.sin(angle) * 0.95
        );
      } else {
        orb.visible = false;
      }
    }

    // Active creative buff ground ring
    if (buffs.powerTimer > 0) {
      this.buffRing.visible = true;
      this.buffRingMat.color.set('#ff5a5f');
    } else if (buffs.speedTimer > 0) {
      this.buffRing.visible = true;
      this.buffRingMat.color.set('#38bdf8');
    } else {
      this.buffRing.visible = false;
    }

    // Pulse wave VFX
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

    // 2. Chim Giấy Đèn Lồng (Origami Lantern Bird)
    this.updateBird(player, lanterns, shades, timeS, dt);

    // 3. Bé Lạc (Wandering Girl)
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
          sp.position.set(Math.cos(a) * (0.6 + p * 0.4), 0.6 + p * 1.1, Math.sin(a) * (0.6 + p * 0.4));
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
        0.75 + Math.sin(timeS * 3.1 + index) * 0.22,
        mote.pos[2]
      );
      group.rotation.y = timeS * 1.4 + index;
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

      if (shade.state === 'stunned') {
        bodyMat.color.set('#7a5fa8');
        bodyMat.emissive.set('#c4a3ff');
        bodyMat.emissiveIntensity = 0.65;
        group.rotation.y = timeS * 8;
        stunRing.visible = true;
        stunRing.rotation.y = -timeS * 5;
      } else if (shade.state === 'flee') {
        bodyMat.color.set('#2b1548');
        bodyMat.emissive.set('#9333ea');
        bodyMat.emissiveIntensity = 0.45;
        group.rotation.y = Math.atan2(
          shade.pos[0] - player.pos[0],
          shade.pos[2] - player.pos[2]
        );
        stunRing.visible = false;
      } else {
        bodyMat.color.set('#140822');
        bodyMat.emissive.set('#5b1f82');
        bodyMat.emissiveIntensity = 0.35;
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

    // Find nearest unlit lantern
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

      // Position golden guidance breadcrumb trail between Mây and lantern
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
        player.pos[0] + Math.cos(orbitA) * 1.45,
        2.15 + Math.sin(timeS * 3.5) * 0.2,
        player.pos[2] + Math.sin(orbitA) * 1.45
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

    // Wing flap & danger alert tint
    const flap = Math.sin(timeS * (dangerClose ? 18 : 10)) * 0.55;
    this.leftWing.rotation.z = flap;
    this.rightWing.rotation.z = -flap;
    this.birdCoreMat.emissive.set(dangerClose ? '#d946ef' : '#ffb84d');
    this.birdCoreMat.emissiveIntensity = dangerClose ? 0.95 : 0.45;
  }

  private createMoteMesh(color: MoteColor): THREE.Group {
    const group = new THREE.Group();
    const hex = MOTE_COLORS[color];
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 10),
      new THREE.MeshBasicMaterial({ color: hex })
    );
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.028, 6, 16),
      new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.72,
      })
    );
    halo.rotation.x = Math.PI / 2.6;
    group.add(halo);
    return group;
  }

  private createShadeMesh(isLarge: boolean): THREE.Group {
    const group = new THREE.Group();
    const scale = isLarge ? 1.45 : 0.88;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#140822',
      emissive: '#5b1f82',
      emissiveIntensity: 0.35,
      roughness: 0.6,
    });

    const torso = new THREE.Mesh(
      new THREE.ConeGeometry(0.5 * scale, 1.45 * scale, 10),
      bodyMat
    );
    torso.position.y = 0.85 * scale;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32 * scale, 12, 10),
      bodyMat
    );
    head.position.y = 1.45 * scale;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({
      color: isLarge ? '#f472b6' : '#d946ef',
    });
    for (const side of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 6, 6), eyeMat);
      eye.position.set(side * scale, 1.48 * scale, 0.26 * scale);
      group.add(eye);
    }

    if (isLarge) {
      // Twin shadow horns for Bóng Mực Lớn
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.09, 0.45, 6),
          bodyMat
        );
        horn.position.set(side * 0.26, 2.35, 0);
        horn.rotation.z = -side * 0.35;
        group.add(horn);
      }
      const mistRing = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.28, 24),
        new THREE.MeshBasicMaterial({
          color: '#7e22ce',
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      mistRing.rotation.x = -Math.PI / 2;
      mistRing.position.y = 0.06;
      group.add(mistRing);
    }

    // Stun dizzy stars ring
    const stunRing = new THREE.Group();
    stunRing.position.y = 1.95 * scale;
    const starMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), starMat);
      const a = (i * Math.PI * 2) / 4;
      star.position.set(Math.cos(a) * 0.45 * scale, 0, Math.sin(a) * 0.45 * scale);
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
