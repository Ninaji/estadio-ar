// Sons em estilo "bloco" (inspirados em jogos voxel): grãos curtos de ruído filtrado
// para pedra, madeira e cascalho, batidas graves e nada de tons agudos puros.
// Tudo sintetizado em tempo real com Web Audio, sem arquivos.

const rand = (a, b) => a + Math.random() * (b - a);

export class Synth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Precisa ser chamado dentro de um toque (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch { /* opcional */ }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // passa-baixa geral: corta qualquer chiado agudo
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5200;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.master.connect(tone).connect(comp).connect(this.ctx.destination);
      this.noise = this.#makeNoise(2.5);
      const resume = () => this.ctx && this.ctx.state !== 'running' && this.ctx.resume();
      document.addEventListener('visibilitychange', () => !document.hidden && resume());
      this.ctx.addEventListener?.('statechange', () => {
        if (this.ctx.state === 'interrupted') setTimeout(resume, 300);
      });
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  #makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.985 * b0 + w * 0.12; // marrom-rosado: mais "terra", menos chiado
      b1 = 0.6 * b1 + w * 0.5;
      d[i] = (b0 + b1 * 0.35) * 0.9;
    }
    return buf;
  }

  /** Grão de ruído filtrado: a base de todos os sons de bloco. */
  #grain(t, { freq = 800, q = 1.2, dur = 0.08, gain = 0.4, type = 'bandpass', attack = 0.003 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  /** Corpo grave curto (o "toc" de um bloco batendo). */
  #body(t, f0, f1, dur, gain) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // --- sons de interface ------------------------------------------------------

  /** Clique de madeira (botões). */
  click() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const p = rand(0.9, 1.12);
    this.#grain(t, { freq: 520 * p, q: 3, dur: 0.06, gain: 0.55 });
    this.#body(t, 190 * p, 120 * p, 0.05, 0.25);
  }

  /** Colocar bloco de pedra. */
  place() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const p = rand(0.85, 1.15);
    this.#grain(t, { freq: 850 * p, q: 1.1, dur: 0.09, gain: 0.5 });
    this.#grain(t + 0.018, { freq: 520 * p, q: 1.4, dur: 0.07, gain: 0.35 });
    this.#body(t, 140 * p, 80 * p, 0.08, 0.3);
  }

  /** Quebrar bloco: vários grãos esfarelando. */
  breakBlock() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const p = rand(0.85, 1.1);
    for (let i = 0; i < 6; i++) {
      this.#grain(t + i * rand(0.022, 0.034), { freq: rand(500, 1300) * p, q: rand(1, 2.5), dur: rand(0.04, 0.08), gain: 0.42 - i * 0.05 });
    }
    this.#body(t, 120 * p, 60 * p, 0.12, 0.28);
  }

  /** Liga (coloca) / desliga (quebra). */
  toggle(on) {
    if (on) this.place();
    else this.breakBlock();
  }

  /** Clique leve de cascalho enquanto arrasta sliders. */
  tick() {
    if (!this.ready) return;
    this.#grain(this.ctx.currentTime, { freq: rand(900, 1300), q: 3, dur: 0.035, gain: 0.22 });
  }

  /** Camada "impressa" na construção: bloco de pedra com tom subindo devagar. */
  beep(pitch = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#grain(t, { freq: 600 * pitch * rand(0.92, 1.08), q: 1.3, dur: 0.06, gain: 0.3 });
    this.#body(t, 110 * pitch, 70 * pitch, 0.06, 0.18);
  }

  /** Bloco pesado caindo no chão. */
  thump() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#body(t, 95, 38, 0.38, 0.6);
    this.#grain(t, { freq: 260, q: 0.8, dur: 0.28, gain: 0.55, type: 'lowpass' });
    this.#grain(t + 0.03, { freq: 700, q: 1.2, dur: 0.12, gain: 0.3 });
  }

  /** "Conquista": três batidas de madeira subindo (tons médios, nada agudo). */
  chime() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [262, 330, 392].forEach((f, i) => {
      const at = t + i * 0.1;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.22, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 0.25);
      this.#grain(at, { freq: 500, q: 3, dur: 0.04, gain: 0.25 });
    });
  }

  /** Sopro grave e arenoso (cortes e desmontagem). */
  whoosh(dur = 0.6, up = true) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(up ? 220 : 1300, t);
    f.frequency.exponentialRampToValueAtTime(up ? 1300 : 200, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.1);
  }

  /** Passo em pedra. */
  step() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.#grain(t, { freq: rand(380, 520), q: 1.6, dur: 0.05, gain: 0.22 });
    this.#grain(t + 0.025, { freq: rand(700, 900), q: 2, dur: 0.03, gain: 0.12 });
  }

  // --- estádio ----------------------------------------------------------------

  /** Sinal de início/gol: buzina grave curta (substitui o apito agudo). */
  whistle(long = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dur = long ? 0.9 : 0.4;
    for (const [f, p] of [[196, 0.16], [294, 0.08]]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p, t + 0.03);
      g.gain.setValueAtTime(p, t + dur - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** Corneta da torcida. */
  horn() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const [f, p] of [[147, 0.18], [220, 0.08]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.95, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.12);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p, t + 0.08);
      g.gain.setValueAtTime(p, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.4);
    }
  }

  /** Fogos: chiado subindo, estrondo grave e estalos de cascalho. */
  firework(delay = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.8);
    this.#body(t + 0.72, 80, 35, 0.5, 0.55);
    this.#grain(t + 0.72, { freq: 220, q: 0.7, dur: 0.45, gain: 0.6, type: 'lowpass' });
    for (let i = 0; i < 7; i++) this.#grain(t + 0.85 + Math.random() * 0.5, { freq: rand(900, 1600), q: 2.5, dur: 0.04, gain: 0.18 });
  }
}
