// Mini partida voxel no gramado (modo Show): 22 jogadores, goleiros, árbitro e bola.
import * as THREE from 'three';
import { PITCH } from '../stadium/spec.js';

const HOME = 0x1f5bff;
const AWAY = 0xffe14d;
const FORMATION = [
  [0, -48], [-20, -32], [-7, -34], [7, -34], [20, -32], [-24, -12], [-8, -16], [8, -16], [24, -12], [-9, 2], [9, 2],
];

export class MiniMatch {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.visible = false;
    parent.add(this.group);
    const body = new THREE.BoxGeometry(1.0, 1.6, 0.7);
    body.translate(0, 0.8, 0);
    const head = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    head.translate(0, 1.95, 0);
    const n = 23;
    this.bodies = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial(), n);
    this.heads = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ color: 0xf1c27d }), n);
    this.group.add(this.bodies, this.heads);
    this.ball = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 }));
    this.group.add(this.ball);
    this.players = [];
    const c = new THREE.Color();
    for (let t = 0; t < 2; t++) {
      for (let p = 0; p < 11; p++) {
        const [fx, fz] = FORMATION[p];
        const sgn = t === 0 ? 1 : -1;
        const home = new THREE.Vector2(fx * sgn, fz * sgn);
        this.players.push({ team: t, keeper: p === 0, home, pos: home.clone(), vel: new THREE.Vector2(), speed: 6 + Math.random() * 2.5 });
        c.set(p === 0 ? (t === 0 ? 0x22c55e : 0xec4899) : t === 0 ? HOME : AWAY);
        this.bodies.setColorAt(t * 11 + p, c);
      }
    }
    this.players.push({ team: 2, referee: true, home: new THREE.Vector2(10, 0), pos: new THREE.Vector2(10, 0), vel: new THREE.Vector2(), speed: 6 });
    c.set(0x111111);
    this.bodies.setColorAt(22, c);
    this.ballPos = new THREE.Vector2(0, 0);
    this.ballVel = new THREE.Vector2(0, 0);
    this.ballY = 0;
    this.ballVy = 0;
    this.owner = null;
    this.cooldown = 0;
    this.onGoal = () => {};
    this.goalLock = 0;
    this.m = new THREE.Matrix4();
  }

  set visible(v) { this.group.visible = v; }
  get visible() { return this.group.visible; }

  kickoff() {
    this.ballPos.set(0, 0);
    this.ballVel.set(0, 0);
    this.owner = null;
    for (const p of this.players) p.pos.copy(p.home);
  }

  update(dt) {
    if (!this.group.visible) return;
    dt = Math.min(dt, 0.05);
    const ball = this.ballPos;
    this.cooldown -= dt;
    this.goalLock -= dt;
    // jogadores: perseguem a bola os mais próximos de cada time, os demais seguram posição
    const nearest = [null, null];
    const nd = [Infinity, Infinity];
    for (const p of this.players) {
      if (p.team > 1 || p.keeper) continue;
      const d = p.pos.distanceTo(ball);
      if (d < nd[p.team]) { nd[p.team] = d; nearest[p.team] = p; }
    }
    const shift = THREE.MathUtils.clamp(ball.y * 0.5, -18, 18);
    for (const p of this.players) {
      let target;
      if (p.referee) target = new THREE.Vector2(ball.x + 12, ball.y * 0.9);
      else if (p.keeper) target = new THREE.Vector2(THREE.MathUtils.clamp(ball.x * 0.3, -3, 3), p.home.y);
      else if (p === nearest[p.team]) target = ball.clone();
      else target = new THREE.Vector2(p.home.x + ball.x * 0.25, p.home.y + shift);
      const to = target.sub(p.pos);
      const dist = to.length();
      if (dist > 0.3) to.multiplyScalar(Math.min(p.speed, dist * 2) / dist);
      else to.set(0, 0);
      p.vel.lerp(to, Math.min(1, dt * 4));
      p.pos.addScaledVector(p.vel, dt);
      p.pos.x = THREE.MathUtils.clamp(p.pos.x, -PITCH.halfW, PITCH.halfW);
      p.pos.y = THREE.MathUtils.clamp(p.pos.y, -PITCH.halfL - 1, PITCH.halfL + 1);
      // chute
      if (!p.referee && this.cooldown <= 0 && p.pos.distanceTo(ball) < 1.3) {
        const goalZ = p.team === 0 ? PITCH.halfL + 2 : -PITCH.halfL - 2;
        const aim = new THREE.Vector2((Math.random() - 0.5) * 14, goalZ).sub(ball);
        const shoot = Math.abs(goalZ - ball.y) < 30 && Math.random() < 0.5;
        aim.normalize().multiplyScalar(shoot ? 26 : 12 + Math.random() * 6);
        if (!shoot) aim.rotateAround(new THREE.Vector2(), (Math.random() - 0.5) * 1.6);
        this.ballVel.copy(aim);
        this.ballVy = shoot ? 4 : 2;
        this.cooldown = 0.5;
      }
    }
    // bola
    ball.addScaledVector(this.ballVel, dt);
    this.ballVel.multiplyScalar(Math.max(0, 1 - dt * 0.9));
    this.ballVy -= 18 * dt;
    this.ballY = Math.max(0, this.ballY + this.ballVy * dt);
    if (this.ballY === 0) this.ballVy = Math.abs(this.ballVy) * 0.4;
    if (Math.abs(ball.x) > PITCH.halfW) { ball.x = Math.sign(ball.x) * PITCH.halfW; this.ballVel.x *= -0.6; }
    if (Math.abs(ball.y) > PITCH.halfL) {
      const inGoal = Math.abs(ball.x) < 3.66 && this.ballY < 2.4;
      if (inGoal && this.goalLock <= 0) {
        this.goalLock = 4;
        this.onGoal(ball.y > 0 ? 0 : 1);
        setTimeout(() => this.kickoff(), 2500);
      }
      ball.y = Math.sign(ball.y) * PITCH.halfL;
      this.ballVel.y *= -0.5;
    }

    const m = this.m;
    this.players.forEach((p, i) => {
      const ang = Math.atan2(p.vel.x, p.vel.y);
      const bob = Math.abs(Math.sin(performance.now() * 0.012 + i)) * Math.min(1, p.vel.length() / 3) * 0.25;
      m.makeRotationY(ang);
      m.setPosition(p.pos.x, PITCH.y + bob, p.pos.y);
      this.bodies.setMatrixAt(i, m);
      this.heads.setMatrixAt(i, m);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.ball.position.set(ball.x, PITCH.y + 0.35 + this.ballY, ball.y);
    this.ball.rotation.x += this.ballVel.y * dt * 0.8;
    this.ball.rotation.z -= this.ballVel.x * dt * 0.8;
  }
}
