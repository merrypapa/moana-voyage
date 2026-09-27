// 3인칭 궤도 카메라
import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { clamp, damp, wrapAngle } from '../util.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // 카메라가 바라보는 방향 (월드)
    this.pitch = 0.32;
    this.dist = 9;
    this.zoomMul = 1;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.idle = 0;
    this.init = false;
  }

  update(dt, game, input) {
    const c = game.leader;
    if (!c) return;
    const wp = c.worldPos(new THREE.Vector3());
    let height = c.kind === 'maui' ? 2.4 : 1.6;
    let want = 9;
    if (c.state === 'helm') { want = 17; height = 3; }
    else if (c.form === 'hawk') { want = 13; height = 1.5; }
    else if (c.state === 'climb') { want = 11; }
    else if (c.onBoat) { want = 11; }
    if (game.cutscene && game.cutsceneCam) {
      want = game.cutsceneCam.dist; height = game.cutsceneCam.height;
    }
    this.zoomMul = clamp(this.zoomMul + input.zoom * 0.08, 0.45, 2.6);
    this.dist = damp(this.dist, want * this.zoomMul, 3, dt);

    const manual = Math.abs(input.camDX) + Math.abs(input.camDY) > 0;
    this.yaw -= input.camDX * 0.005;
    this.pitch = clamp(this.pitch + input.camDY * 0.004, -0.15, 1.35);
    if (manual) this.idle = 0; else this.idle += dt;
    // 배를 조종할 때는 자동으로 배 뒤로
    if (c.state === 'helm' && this.idle > 1.2) {
      this.yaw += wrapAngle(game.boat.yaw - this.yaw) * (1 - Math.exp(-1.5 * dt));
    } else if (c.form === 'hawk' && this.idle > 1.5 && Math.hypot(c.vel.x, c.vel.z) > 5) {
      this.yaw += wrapAngle(Math.atan2(c.vel.x, c.vel.z) - this.yaw) * (1 - Math.exp(-1.2 * dt));
    }
    this.target.set(wp.x, wp.y + height, wp.z);
    if (!this.init) { this.smoothTarget.copy(this.target); this.init = true; }
    const jump = this.smoothTarget.distanceTo(this.target) > 60;
    if (jump) this.smoothTarget.copy(this.target);
    else this.smoothTarget.lerp(this.target, 1 - Math.exp(-12 * dt));

    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(
      this.smoothTarget.x - Math.sin(this.yaw) * cp * this.dist,
      this.smoothTarget.y + Math.sin(this.pitch) * this.dist,
      this.smoothTarget.z - Math.cos(this.yaw) * cp * this.dist
    );
    const floor = Math.max(heightAt(pos.x, pos.z) + 1.2, game.zone === 'surface' ? waveHeight(pos.x, pos.z, game.time) + 0.8 : -1e9);
    if (pos.y < floor) pos.y = floor;
    if (game.effects.shake > 0) {
      const s = game.effects.shake * 0.6;
      pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.smoothTarget);
  }
}
