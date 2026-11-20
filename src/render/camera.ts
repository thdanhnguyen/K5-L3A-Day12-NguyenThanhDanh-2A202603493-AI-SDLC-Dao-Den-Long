import * as THREE from 'three';
import type { Vec3 } from '../sim/types';

export class FollowCamera {
  yawDeg = 0;
  distance = 13.0;
  height = 15.5;
  zoom = 1.0;

  private readonly currentPos = new THREE.Vector3(0, 15.5, -13.0);
  private readonly lookTarget = new THREE.Vector3(0, 0.65, 0);

  reset(): void {
    this.yawDeg = 0;
    this.zoom = 1.0;
    this.currentPos.set(0, this.height, -this.distance);
    this.lookTarget.set(0, 0.65, 0);
  }

  rotateBy(deltaYawDeg: number): void {
    this.yawDeg = ((this.yawDeg + deltaYawDeg + 540) % 360) - 180;
  }

  zoomBy(delta: number): void {
    this.zoom = Math.max(0.65, Math.min(1.55, this.zoom + delta * 0.08));
  }

  update(camera: THREE.PerspectiveCamera, playerPos: Vec3, dt: number): void {
    const theta = (this.yawDeg * Math.PI) / 180;
    const forwardX = Math.sin(theta);
    const forwardZ = Math.cos(theta);

    const effDist = this.distance * this.zoom;
    const effHeight = this.height * this.zoom;

    const desiredX = playerPos[0] - forwardX * effDist;
    const desiredY = playerPos[1] + effHeight;
    const desiredZ = playerPos[2] - forwardZ * effDist;

    const alpha = 1 - Math.exp(-9 * dt);
    this.currentPos.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), alpha);
    this.lookTarget.lerp(
      new THREE.Vector3(playerPos[0], playerPos[1] + 0.65, playerPos[2]),
      alpha
    );

    camera.position.copy(this.currentPos);
    camera.lookAt(this.lookTarget);
  }
}
