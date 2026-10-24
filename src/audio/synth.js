// Sons 100% sintetizados com Web Audio (nenhum arquivo de áudio).

export class Synth {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.crowd = null;
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
      this.master.gain.value = 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
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
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
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
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // ruído rosa aproximado
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  #noiseSrc(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    src.loopStart = Math.random();
    return src;
  }

  #env(gainNode, t, a, peak, dur) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  #tone(type, f0, f1, dur, peak = 0.2, delay = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.#env(g, t, 0.008, peak, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  click() {
    this.#tone('sine', 920, 620, 0.07, 0.18);
  }

  toggle(on) {
    this.#tone('triangle', on ? 520 : 780, on ? 780 : 520, 0.09, 0.14);
    this.#tone('triangle', on ? 1040 : 620, on ? 1240 : 460, 0.08, 0.08, 0.06);
  }

  beep(pitch = 1) {
    this.#tone('square', 1100 * pitch, 1100 * pitch, 0.035, 0.035);
  }

  chime() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.#tone('sine', f, f, 0.6, 0.12, i * 0.09));
  }

  thump() {
    if (!this.ready) return;
    this.#tone('sine', 110, 38, 0.35, 0.5);
    this.#burst(0.12, 300, 0.25);
  }

  #burst(dur, freq, peak, q = 1, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const src = this.#noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.#env(g, t, 0.005, peak, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Sopro filtrado com varredura de frequência (cortes, desmontagem). */
  whoosh(dur = 0.6, up = true) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.#noiseSrc();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(up ? 300 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(up ? 2600 : 280, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  /** Apito do árbitro com trinado. */
  whistle(long = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dur = long ? 1.1 : 0.35;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2900;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = this.ctx.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.22, t + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Corneta da torcida. */
  horn() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const [f, p] of [[233, 0.16], [466, 0.07], [349, 0.06]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.96, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.12);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
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

  /** Grito de gol: rugido de multidão que cresce e se dissipa. */
  cheer(power = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const [freq, q, peak] of [[520, 0.8, 0.55], [1300, 1.4, 0.35], [2600, 2, 0.16]]) {
      const src = this.#noiseSrc();
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(freq * 0.7, t);
      f.frequency.linearRampToValueAtTime(freq * 1.15, t + 1.2);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak * power, t + 0.35);
      g.gain.setValueAtTime(peak * power, t + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 3.6);
    }
  }

  /** Fogos: assobio subindo e estouro com estalos. */
  firework(delay = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.7);
    const g = this.ctx.createGain();
    this.#env(g, t, 0.05, 0.05, 0.72);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.8);
    this.#burst(0.5, 180, 0.6, 0.7, 0.72 + delay);
    for (let i = 0; i < 6; i++) this.#burst(0.05, 3000 + Math.random() * 2000, 0.12, 3, 0.85 + delay + Math.random() * 0.5);
  }

  step() {
    if (!this.ready) return;
    this.#burst(0.04, 1800, 0.05, 4);
  }

  /** Ambiente de torcida contínuo (modo Show). */
  startCrowd(level = 0.22) {
    if (!this.ctx || this.crowd) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 1.5);
    out.connect(this.master);
    const layers = [];
    for (const [freq, q, gain, rate] of [[420, 0.7, 0.8, 0.13], [900, 1.1, 0.5, 0.21], [1800, 1.6, 0.22, 0.34]]) {
      const src = this.#noiseSrc(true);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      // ondulação lenta como cantos de torcida
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = rate;
      const lg = this.ctx.createGain();
      lg.gain.value = gain * 0.45;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(out);
      src.start();
      lfo.start();
      layers.push(src, lfo);
    }
    this.crowd = { out, layers, level };
  }

  stopCrowd() {
    if (!this.crowd) return;
    const { out, layers } = this.crowd;
    const t = this.ctx.currentTime;
    out.gain.setTargetAtTime(0.0001, t, 0.4);
    setTimeout(() => layers.forEach((n) => n.stop()), 2000);
    this.crowd = null;
  }
}
