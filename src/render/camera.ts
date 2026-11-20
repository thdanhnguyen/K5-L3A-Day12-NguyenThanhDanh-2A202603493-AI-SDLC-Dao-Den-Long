import * as THREE from 'three';
import type { Vec3 } from '../sim/types';

export class FollowCamera {
  yawDeg = 0;
  distance = 11.5;
  height = 5.4;

  private readonly currentPos = new THREE.Vector3(0, 5.4, -11.5);
  private readonly lookTarget = new THREE.Vector3(0, 1.4, 0);

  reset(): void {
    this.yawDeg = 0;
    this.distance = 11.5;
    this.currentPos.set(0, this.height, -this.distance);
    this.lookTarget.set(0, 1.4, 0);
  }

  rotateBy(deltaYawDeg: number): void {
    this.yawDeg = ((this.yawDeg + deltaYawDeg + 540) % 360) - 180;
  }

  zoomBy(delta: number): void {
    this.distance = Math.max(7.5, Math.min(18, this.distance + delta));
  }

  update(camera: THREE.PerspectiveCamera, playerPos: Vec3, dt: number): void {
    const theta = (this.yawDeg * Math.PI) / 180;
    const forwardX = Math.sin(theta);
    const forwardZ = Math.cos(theta);

    const desiredX = playerPos[0] - forwardX * this.distance;
    const desiredY = playerPos[1] + this.height * (this.distance / 11.5);
    const desiredZ = playerPos[2] - forwardZ * this.distance;

    const alpha = 1 - Math.exp(-9 * dt);
    this.currentPos.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), alpha);
    this.lookTarget.lerp(
      new THREE.Vector3(playerPos[0], playerPos[1] + 1.4, playerPos[2]),
      alpha
    );

    camera.position.copy(this.currentPos);
    camera.lookAt(this.lookTarget);
  }
}
