"use strict";

/* ===================== Audio engine ===================== */

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();

const masterGain = ctx.createGain();
const compressor = ctx.createDynamicsCompressor();
masterGain.connect(compressor);
compressor.connect(ctx.destination);

function setMasterVolume(v) {
  masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
}

/* ---- Procedural built-in sound synthesis (no external audio files needed) ---- */

function makeBuffer(seconds) {
  const length = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  return ctx.createBuffer(1, length, ctx.sampleRate);
}

function synthKick() {
  const buf = makeBuffer(0.5);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 150 * Math.exp(-t * 22) + 42;
    phase += (2 * Math.PI * freq) / sr;
    const amp = Math.exp(-t * 8.5);
    data[i] = Math.sin(phase) * amp;
  }
  return buf;
}

function synthSnare() {
  const buf = makeBuffer(0.28);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    const noiseEnv = Math.exp(-t * 16);
    const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 28);
    data[i] = noise * noiseEnv * 0.75 + tone * 0.5;
  }
  return buf;
}

function synthHihat() {
  const buf = makeBuffer(0.14);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const white = Math.random() * 2 - 1;
    const hp = white - prev; // crude high-pass via differencing
    prev = white;
    const env = Math.exp(-t * 40);
    data[i] = hp * env * 0.9;
  }
  return buf;
}

function synthClap() {
  const buf = makeBuffer(0.35);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const bursts = [0, 0.012, 0.026, 0.045];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const b of bursts) {
      if (t >= b) {
        const lt = t - b;
        s += (Math.random() * 2 - 1) * Math.exp(-lt * 30);
      }
    }
    data[i] = s * 0.6;
  }
  return buf;
}

function synthSub() {
  const buf = makeBuffer(0.6);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * 55) / sr;
    const amp = Math.exp(-t * 4.5);
    data[i] = Math.sin(phase) * amp;
  }
  return buf;
}

function synthStab() {
  const buf = makeBuffer(0.3);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let p1 = 0, p2 = 0;
  const f1 = 110, f2 = 110 * 1.008;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    p1 += (2 * Math.PI * f1) / sr;
    p2 += (2 * Math.PI * f2) / sr;
    const saw1 = 2 * ((p1 / (2 * Math.PI)) % 1) - 1;
    const saw2 = 2 * ((p2 / (2 * Math.PI)) % 1) - 1;
    const env = Math.exp(-t * 9);
    data[i] = (saw1 + saw2) * 0.35 * env;
  }
  return buf;
}

function synthTom(startFreq, endFreq, dur) {
  return function () {
    const buf = makeBuffer(dur);
    const data = buf.getChannelData(0);
    const sr = ctx.sampleRate;
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = endFreq + (startFreq - endFreq) * Math.exp(-t * 14);
      phase += (2 * Math.PI * freq) / sr;
      const amp = Math.exp(-t * (1 / dur) * 3.2);
      data[i] = Math.sin(phase) * amp;
    }
    return buf;
  };
}

function synthOpenHat() {
  const buf = makeBuffer(0.38);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const white = Math.random() * 2 - 1;
    const hp = white - prev;
    prev = white;
    const env = Math.exp(-t * 8);
    data[i] = hp * env * 0.8;
  }
  return buf;
}

function synthRim() {
  const buf = makeBuffer(0.08);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 90);
    const tone = Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 70);
    data[i] = noise * 0.5 + tone * 0.6;
  }
  return buf;
}

function synthShaker() {
  const buf = makeBuffer(0.2);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const white = Math.random() * 2 - 1;
    const hp = white - prev;
    prev = white;
    const env = Math.exp(-t * 18) * (0.5 + 0.5 * Math.sin(t * 90));
    data[i] = hp * env * 0.7;
  }
  return buf;
}

function synthCrash() {
  const buf = makeBuffer(1.4);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const partials = [1, 1.33, 1.78, 2.41, 3.06];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let metallic = 0;
    for (const p of partials) metallic += Math.sin(2 * Math.PI * 420 * p * t);
    const noise = Math.random() * 2 - 1;
    const env = Math.exp(-t * 2.2);
    data[i] = (metallic * 0.12 + noise * 0.5) * env;
  }
  return buf;
}

function synthPercBlip() {
  const buf = makeBuffer(0.12);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 300 + 1400 * Math.exp(-t * 35);
    phase += (2 * Math.PI * freq) / sr;
    const amp = Math.exp(-t * 24);
    data[i] = Math.sign(Math.sin(phase)) * 0.25 * amp;
  }
  return buf;
}

function synthSubDrop() {
  const buf = makeBuffer(1.1);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 20 + 220 * Math.exp(-t * 4.5);
    phase += (2 * Math.PI * freq) / sr;
    const amp = Math.exp(-t * 2.2);
    data[i] = Math.sin(phase) * amp;
  }
  return buf;
}

function synthRiser() {
  const buf = makeBuffer(1.2);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const progress = t / 1.2;
    const white = Math.random() * 2 - 1;
    const hp = white - prev;
    prev = white;
    const mixed = white * (1 - progress) + hp * progress;
    const env = progress * progress;
    data[i] = mixed * env * 0.7;
  }
  return buf;
}

function synthLaser() {
  const buf = makeBuffer(0.22);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 1800 * Math.exp(-t * 22) + 80;
    phase += (2 * Math.PI * freq) / sr;
    const amp = Math.exp(-t * 12);
    data[i] = Math.sin(phase) * amp * 0.5;
  }
  return buf;
}

function synthImpact() {
  const buf = makeBuffer(0.9);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * 65) / sr;
    const low = Math.sin(phase) * Math.exp(-t * 5);
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 22);
    data[i] = low * 0.7 + noise * 0.5;
  }
  return buf;
}

function synthReverseSwell() {
  const dur = 0.6;
  const buf = makeBuffer(dur);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const progress = t / dur;
    const noise = Math.random() * 2 - 1;
    const env = progress * progress * progress;
    data[i] = noise * env * 0.6;
  }
  return buf;
}

function synthVocalChop() {
  const buf = makeBuffer(0.18);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  const f0 = 260;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * f0) / sr;
    const formant = Math.sin(phase) + 0.6 * Math.sin(phase * 2.01) + 0.35 * Math.sin(phase * 3.98);
    const env = Math.exp(-t * 16) * Math.min(1, t * 200);
    data[i] = formant * 0.22 * env;
  }
  return buf;
}

function synthCowbell() {
  const buf = makeBuffer(0.3);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let p1 = 0, p2 = 0;
  const f1 = 845, f2 = 540;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    p1 += (2 * Math.PI * f1) / sr;
    p2 += (2 * Math.PI * f2) / sr;
    const env = Math.exp(-t * 14);
    data[i] = (Math.sign(Math.sin(p1)) * 0.5 + Math.sign(Math.sin(p2)) * 0.5) * env * 0.35;
  }
  return buf;
}

function synthSnap() {
  const buf = makeBuffer(0.1);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55);
    const tone = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 60);
    data[i] = noise * 0.6 + tone * 0.3;
  }
  return buf;
}

function synthRide() {
  const buf = makeBuffer(0.9);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const partials = [1, 1.62, 2.2, 3.05];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let metallic = 0;
    for (const p of partials) metallic += Math.sin(2 * Math.PI * 620 * p * t);
    const noise = Math.random() * 2 - 1;
    const env = Math.exp(-t * 3.5);
    data[i] = (metallic * 0.1 + noise * 0.35) * env;
  }
  return buf;
}

function synthDownlifter() {
  const dur = 1.0;
  const buf = makeBuffer(dur);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const progress = t / dur;
    const freq = 800 * (1 - progress) + 60 * progress;
    phase += (2 * Math.PI * freq) / sr;
    const noise = Math.random() * 2 - 1;
    const env = Math.exp(-t * 2.5) * (1 - progress * 0.3);
    data[i] = (Math.sin(phase) * 0.5 + noise * 0.3) * env;
  }
  return buf;
}

function synthGlitchBlip() {
  const buf = makeBuffer(0.15);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const holdSamples = Math.max(1, Math.floor(sr * 0.006));
  let val = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % holdSamples === 0) val = Math.random() * 2 - 1;
    const t = i / sr;
    const env = Math.exp(-t * 20);
    data[i] = val * env * 0.5;
  }
  return buf;
}

function synthMetalHit() {
  const buf = makeBuffer(0.5);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  const partials = [1, 2.02, 3.4, 4.9];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const p of partials) s += Math.sin(2 * Math.PI * 300 * p * t);
    const noise = Math.random() * 2 - 1;
    const env = Math.exp(-t * 7);
    data[i] = (s * 0.15 + noise * 0.3) * env;
  }
  return buf;
}

function synthSiren() {
  const dur = 1.0;
  const buf = makeBuffer(dur);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 500 + 300 * Math.sin(2 * Math.PI * 3 * t);
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.min(1, t * 8) * Math.exp(-Math.max(0, t - 0.7) * 6);
    data[i] = Math.sin(phase) * 0.4 * env;
  }
  return buf;
}

function synthAirHorn() {
  const dur = 0.45;
  const buf = makeBuffer(dur);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let p1 = 0, p2 = 0;
  const f1 = 370.0, f2 = 370 * 1.006;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 6 * t);
    p1 += (2 * Math.PI * f1 * vibrato) / sr;
    p2 += (2 * Math.PI * f2 * vibrato) / sr;
    const saw1 = 2 * ((p1 / (2 * Math.PI)) % 1) - 1;
    const saw2 = 2 * ((p2 / (2 * Math.PI)) % 1) - 1;
    const env = Math.min(1, t * 40) * Math.exp(-Math.max(0, t - 0.28) * 14);
    data[i] = (saw1 + saw2) * 0.28 * env;
  }
  return buf;
}

function synthAlarmBlip() {
  const buf = makeBuffer(0.3);
  const data = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  let phase = 0;
  const freq = 1200;
  const bursts = [0, 0.15];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * freq) / sr;
    let env = 0;
    for (const b of bursts) {
      const lt = t - b;
      if (lt >= 0 && lt < 0.08) env = Math.max(env, Math.exp(-lt * 35));
    }
    data[i] = Math.sin(phase) * 0.4 * env;
  }
  return buf;
}

const SOUND_LIBRARY = [
  { name: "Kick", category: "Davul", synth: synthKick, color: "#00e5ff" },
  { name: "Snare", category: "Davul", synth: synthSnare, color: "#ff3b9a" },
  { name: "Hi-Hat", category: "Davul", synth: synthHihat, color: "#39ff9c" },
  { name: "Açık Hi-Hat", category: "Davul", synth: synthOpenHat, color: "#39ff9c" },
  { name: "Clap", category: "Davul", synth: synthClap, color: "#ffd23b" },
  { name: "Rimshot", category: "Davul", synth: synthRim, color: "#ffd23b" },
  { name: "Snap", category: "Davul", synth: synthSnap, color: "#ffd23b" },
  { name: "Shaker", category: "Davul", synth: synthShaker, color: "#ffd23b" },
  { name: "Cowbell", category: "Davul", synth: synthCowbell, color: "#ffd23b" },
  { name: "Tom (Düşük)", category: "Davul", synth: synthTom(160, 70, 0.35), color: "#5b8bff" },
  { name: "Tom (Orta)", category: "Davul", synth: synthTom(260, 120, 0.3), color: "#5b8bff" },
  { name: "Tom (Yüksek)", category: "Davul", synth: synthTom(380, 180, 0.25), color: "#5b8bff" },
  { name: "Conga", category: "Davul", synth: synthTom(300, 190, 0.22), color: "#5b8bff" },
  { name: "Timbale", category: "Davul", synth: synthTom(500, 260, 0.18), color: "#5b8bff" },
  { name: "Crash", category: "Davul", synth: synthCrash, color: "#5b8bff" },
  { name: "Ride", category: "Davul", synth: synthRide, color: "#5b8bff" },
  { name: "Perc Blip", category: "Davul", synth: synthPercBlip, color: "#ff5b8a" },
  { name: "Sub Hit", category: "Bas & Efekt", synth: synthSub, color: "#8a5bff" },
  { name: "Sub Drop", category: "Bas & Efekt", synth: synthSubDrop, color: "#8a5bff" },
  { name: "Stab", category: "Bas & Efekt", synth: synthStab, color: "#ff7a3b" },
  { name: "Riser", category: "Bas & Efekt", synth: synthRiser, color: "#ff7a3b" },
  { name: "Downlifter", category: "Bas & Efekt", synth: synthDownlifter, color: "#ff7a3b" },
  { name: "Laser Zap", category: "Bas & Efekt", synth: synthLaser, color: "#b23bff" },
  { name: "Impact", category: "Bas & Efekt", synth: synthImpact, color: "#b23bff" },
  { name: "Metal Hit", category: "Bas & Efekt", synth: synthMetalHit, color: "#b23bff" },
  { name: "Reverse Swell", category: "Bas & Efekt", synth: synthReverseSwell, color: "#b23bff" },
  { name: "Vocal Chop", category: "Bas & Efekt", synth: synthVocalChop, color: "#00e5ff" },
  { name: "Glitch Blip", category: "Bas & Efekt", synth: synthGlitchBlip, color: "#00e5ff" },
  { name: "Siren", category: "Bas & Efekt", synth: synthSiren, color: "#39ff9c" },
  { name: "Air Horn", category: "Bas & Efekt", synth: synthAirHorn, color: "#39ff9c" },
  { name: "Alarm Blip", category: "Bas & Efekt", synth: synthAlarmBlip, color: "#39ff9c" },
];
SOUND_LIBRARY.forEach((e) => (e.kind = "sample"));

const STARTER_TRACK_NAMES = ["Kick", "Snare", "Hi-Hat", "Clap", "Sub Hit", "Stab"];

function getLibraryBuffer(entry) {
  if (!entry.buffer) entry.buffer = entry.synth();
  return entry.buffer;
}

const NOTE_FREQS = {
  E1: 41.2, F1: 43.65, "F#1": 46.25, G1: 49.0, "G#1": 51.91,
  A1: 55.0, "A#1": 58.27, B1: 61.74, C2: 65.41, D2: 73.42, E2: 82.41,
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
const NOTE_FULL_FREQS = {};
const NOTE_FULL_LIST = [];
for (let m = 36; m <= 84; m++) {
  const name = NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
  NOTE_FULL_FREQS[name] = midiToFreq(m);
  NOTE_FULL_LIST.push(name);
}

const INSTRUMENT_PRESETS = {
  lead: { label: "Lead Synth", waveform: "sawtooth", unison: [-9, 9], cutoff: 3200, q: 1, attack: 0.004, release: 0.28 },
  pluck: { label: "Pluck", waveform: "triangle", unison: [0], cutoff: 2600, q: 0.6, attack: 0.001, release: 0.2 },
  bell: { label: "FM Bell", fm: true, ratio: 3.01, index: 4, attack: 0.001, release: 1.3 },
  pad: { label: "Pad / Choir", waveform: "sawtooth", unison: [-14, -5, 5, 14], cutoff: 1600, q: 0.4, attack: 0.4, release: 1.6 },
  brass: { label: "Brass Stab", waveform: "sawtooth", unison: [-6, 6], cutoff: 1100, q: 5, attack: 0.035, release: 0.4 },
  marimba: { label: "Marimba", waveform: "sine", unison: [0], cutoff: 6500, q: 0.3, attack: 0.001, release: 0.35 },
  organ: { label: "Org", waveform: "square", unison: [-1200, 0, 700, 1200], cutoff: 5200, q: 0.2, attack: 0.008, release: 0.3 },
  bass808: { label: "808 Bass", waveform: "sine", unison: [0], cutoff: 500, q: 0.4, attack: 0.004, release: 1.0, pitchDrop: true },
};

const TRACK_COLORS = ["#00e5ff", "#b23bff", "#ff3b9a", "#39ff9c", "#ffd23b", "#ff7a3b", "#5b8bff", "#ff5b8a"];
let colorIndex = 0;
function nextColor() {
  const c = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return c;
}

/* ===================== Track model ===================== */

let trackIdSeq = 1;
const tracks = [];

class Track {
  constructor(name, color) {
    this.id = trackIdSeq++;
    this.name = name;
    this.color = color || nextColor();
    this.steps = new Array(totalSteps).fill(false);
    this.muted = false;
    this.solo = false;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.85;
    this.gain.connect(masterGain);
  }
  resize(n) {
    const next = new Array(n).fill(false);
    for (let i = 0; i < Math.min(n, this.steps.length); i++) next[i] = this.steps[i];
    this.steps = next;
  }
  setVolume(v) {
    this.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
  }
  trigger(_time) {
    /* overridden */
  }
}

class SampleTrack extends Track {
  constructor(name, buffer, color) {
    super(name, color);
    this.buffer = buffer;
    this.type = "sample";
  }
  trigger(time) {
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    src.start(time);
  }
}

class WobbleTrack extends Track {
  constructor(name, color) {
    super(name, color);
    this.type = "wobble";
    this.waveform = "sawtooth";
    this.note = "F1";
    this.cutoff = 400;
    this.lfoDepth = 1200;
    this.lfoRate = 5;
    this.attack = 0.01;
    this.release = 0.09;

    this.osc = ctx.createOscillator();
    this.osc.type = this.waveform;
    this.osc.frequency.value = NOTE_FREQS[this.note];

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.cutoff;
    this.filter.Q.value = 8;

    this.envGain = ctx.createGain();
    this.envGain.gain.value = 0;

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.lfoRate;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = this.lfoDepth;

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    this.osc.connect(this.filter);
    this.filter.connect(this.envGain);
    this.envGain.connect(this.gain);

    this.osc.start();
    this.lfo.start();
  }
  setWaveform(w) { this.waveform = w; this.osc.type = w; }
  setNote(n) { this.note = n; this.osc.frequency.setTargetAtTime(NOTE_FREQS[n], ctx.currentTime, 0.01); }
  setCutoff(v) { this.cutoff = v; this.filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.01); }
  setLfoDepth(v) { this.lfoDepth = v; this.lfoGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01); }
  setLfoRate(v) { this.lfoRate = v; this.lfo.frequency.setTargetAtTime(v, ctx.currentTime, 0.01); }
  trigger(time) {
    const g = this.envGain.gain;
    const stepDur = (60 / bpm) / 4;
    const releaseEnd = time + Math.min(this.release + this.attack, stepDur * 0.95);
    g.cancelScheduledValues(time);
    g.setValueAtTime(0.0001, time);
    g.linearRampToValueAtTime(1, time + this.attack);
    g.exponentialRampToValueAtTime(0.0001, releaseEnd);
  }
}

class InstrumentTrack extends Track {
  constructor(name, presetKey, color) {
    super(name, color);
    this.type = "instrument";
    this.presetKey = presetKey;
    this.preset = INSTRUMENT_PRESETS[presetKey];
    this.note = "C3";
    this.attack = this.preset.attack;
    this.release = this.preset.release;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.preset.cutoff || 4000;
    this.filter.Q.value = this.preset.q != null ? this.preset.q : 1;

    this.envGain = ctx.createGain();
    this.envGain.gain.value = 0;
    this.filter.connect(this.envGain);
    this.envGain.connect(this.gain);

    this.oscillators = [];
    this.modOsc = null;
    this.modGain = null;

    if (this.preset.fm) {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      const modulator = ctx.createOscillator();
      modulator.type = "sine";
      const modGain = ctx.createGain();
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(this.filter);
      carrier.start();
      modulator.start();
      this.oscillators.push(carrier);
      this.modOsc = modulator;
      this.modGain = modGain;
    } else {
      for (const det of this.preset.unison) {
        const osc = ctx.createOscillator();
        osc.type = this.preset.waveform;
        osc.detune.value = det;
        osc.connect(this.filter);
        osc.start();
        this.oscillators.push(osc);
      }
    }
    this.setNote(this.note);
  }
  setNote(n) {
    this.note = n;
    const freq = NOTE_FULL_FREQS[n];
    const now = ctx.currentTime;
    if (this.preset.fm) {
      this.oscillators[0].frequency.setTargetAtTime(freq, now, 0.01);
      this.modOsc.frequency.setTargetAtTime(freq * this.preset.ratio, now, 0.01);
      this.modGain.gain.setTargetAtTime(freq * this.preset.index, now, 0.01);
    } else {
      for (const osc of this.oscillators) osc.frequency.setTargetAtTime(freq, now, 0.01);
    }
  }
  setRelease(v) {
    this.release = v;
  }
  trigger(time) {
    const g = this.envGain.gain;
    const stepDur = (60 / bpm) / 4;
    const a = Math.min(this.attack, stepDur * 0.4);
    const r = Math.max(0.02, Math.min(this.release, stepDur * 6));
    g.cancelScheduledValues(time);
    g.setValueAtTime(0.0001, time);
    g.linearRampToValueAtTime(1, time + a);
    g.exponentialRampToValueAtTime(0.0001, time + a + r);

    if (this.preset.pitchDrop) {
      const freq = NOTE_FULL_FREQS[this.note];
      const osc = this.oscillators[0];
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(freq * 3.2, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.09);
    }
  }
}

function previewInstrument(presetKey) {
  const temp = new InstrumentTrack("preview", presetKey, "#ffffff");
  temp.trigger(ctx.currentTime);
  const cleanupDelay = (temp.attack + temp.release) * 1000 + 500;
  setTimeout(() => {
    temp.oscillators.forEach((o) => {
      try { o.stop(); } catch (e) {}
    });
    if (temp.modOsc) {
      try { temp.modOsc.stop(); } catch (e) {}
    }
    temp.gain.disconnect();
  }, cleanupDelay);
}

function previewWobble() {
  const temp = new WobbleTrack("preview", "#b23bff");
  temp.trigger(ctx.currentTime);
  const cleanupDelay = (temp.attack + temp.release) * 1000 + 500;
  setTimeout(() => {
    try { temp.osc.stop(); } catch (e) {}
    try { temp.lfo.stop(); } catch (e) {}
    temp.gain.disconnect();
  }, cleanupDelay);
}

/* ===================== Sequencer / scheduler ===================== */

let bpm = 140;
let totalSteps = 16;
let isPlaying = false;
let currentStep = 0;
let nextStepTime = 0.0;
let timerId = null;
const scheduleAheadTime = 0.12;
const lookaheadMs = 25;
const scheduledEvents = []; // {step, time} for UI playhead sync

function anySolo() {
  return tracks.some((t) => t.solo);
}

function scheduleStep(step, time) {
  const solo = anySolo();
  for (const track of tracks) {
    if (!track.steps[step]) continue;
    if (solo && !track.solo) continue;
    if (!solo && track.muted) continue;
    track.trigger(time);
  }
  scheduledEvents.push({ step, time });
}

function schedulerTick() {
  while (nextStepTime < ctx.currentTime + scheduleAheadTime) {
    scheduleStep(currentStep, nextStepTime);
    nextStepTime += 60.0 / bpm / 4;
    currentStep = (currentStep + 1) % totalSteps;
  }
}

function play() {
  if (isPlaying) return;
  ctx.resume();
  isPlaying = true;
  currentStep = 0;
  nextStepTime = ctx.currentTime + 0.05;
  timerId = setInterval(schedulerTick, lookaheadMs);
  playBtn.textContent = "■";
  playBtn.classList.add("playing");
  requestAnimationFrame(drawPlayhead);
}

function stop() {
  isPlaying = false;
  clearInterval(timerId);
  timerId = null;
  playBtn.textContent = "▶";
  playBtn.classList.remove("playing");
  document.querySelectorAll(".step.playhead").forEach((el) => el.classList.remove("playhead"));
}

function drawPlayhead() {
  if (!isPlaying) return;
  const now = ctx.currentTime;
  let lastShown = null;
  while (scheduledEvents.length && scheduledEvents[0].time <= now) {
    lastShown = scheduledEvents.shift();
  }
  if (lastShown) {
    document.querySelectorAll(".step.playhead").forEach((el) => el.classList.remove("playhead"));
    document.querySelectorAll(`.steps[data-step-count] .step[data-index="${lastShown.step}"]`).forEach((el) => {
      el.classList.add("playhead");
    });
  }
  requestAnimationFrame(drawPlayhead);
}

/* ===================== UI rendering ===================== */

const trackListEl = document.getElementById("trackList");
const playBtn = document.getElementById("playBtn");
const clearBtn = document.getElementById("clearBtn");
const bpmInput = document.getElementById("bpmInput");
const stepsSelect = document.getElementById("stepsSelect");
const masterVolumeEl = document.getElementById("masterVolume");
const fileInput = document.getElementById("fileInput");
const addWobbleBtn = document.getElementById("addWobbleBtn");
const openLibraryBtn = document.getElementById("openLibraryBtn");
const closeLibraryBtn = document.getElementById("closeLibraryBtn");
const libraryModal = document.getElementById("libraryModal");
const libraryListEl = document.getElementById("libraryList");

function renderAll() {
  trackListEl.innerHTML = "";
  for (const track of tracks) trackListEl.appendChild(renderTrack(track));
}

function renderTrack(track) {
  const row = document.createElement("div");
  row.className = "track";
  row.style.setProperty("--track-color", track.color);

  const header = document.createElement("div");
  header.className = "track-header";

  const nameInput = document.createElement("input");
  nameInput.className = "track-name";
  nameInput.value = track.name;
  nameInput.addEventListener("change", () => (track.name = nameInput.value));

  const typeTag = document.createElement("span");
  typeTag.className = "tag";
  typeTag.textContent =
    track.type === "wobble" ? "Wobble" : track.type === "instrument" ? track.preset.label : "Örnek";

  const muteBtn = document.createElement("button");
  muteBtn.className = "mini-btn mute" + (track.muted ? " active" : "");
  muteBtn.textContent = "M";
  muteBtn.title = "Sustur";
  muteBtn.addEventListener("click", () => {
    track.muted = !track.muted;
    muteBtn.classList.toggle("active", track.muted);
  });

  const soloBtn = document.createElement("button");
  soloBtn.className = "mini-btn solo" + (track.solo ? " active" : "");
  soloBtn.textContent = "S";
  soloBtn.title = "Solo";
  soloBtn.addEventListener("click", () => {
    track.solo = !track.solo;
    soloBtn.classList.toggle("active", track.solo);
  });

  const volWrap = document.createElement("div");
  volWrap.className = "vol-wrap";
  const volLabel = document.createElement("span");
  volLabel.textContent = "Ses";
  const volInput = document.createElement("input");
  volInput.type = "range";
  volInput.min = "0";
  volInput.max = "1";
  volInput.step = "0.01";
  volInput.value = String(track.gain.gain.value);
  volInput.addEventListener("input", () => track.setVolume(parseFloat(volInput.value)));
  volWrap.append(volLabel, volInput);

  const removeBtn = document.createElement("button");
  removeBtn.className = "mini-btn remove";
  removeBtn.textContent = "×";
  removeBtn.title = "Parçayı sil";
  removeBtn.addEventListener("click", () => {
    const idx = tracks.indexOf(track);
    if (idx >= 0) tracks.splice(idx, 1);
    track.gain.disconnect();
    if (track.osc) { try { track.osc.stop(); } catch (e) {} }
    if (track.lfo) { try { track.lfo.stop(); } catch (e) {} }
    if (track.oscillators) { track.oscillators.forEach((o) => { try { o.stop(); } catch (e) {} }); }
    if (track.modOsc) { try { track.modOsc.stop(); } catch (e) {} }
    renderAll();
  });

  header.append(nameInput, typeTag, muteBtn, soloBtn, volWrap, removeBtn);
  row.appendChild(header);

  if (track.type === "wobble") {
    row.appendChild(renderSynthControls(track));
  } else if (track.type === "instrument") {
    row.appendChild(renderInstrumentControls(track));
  }

  row.appendChild(renderSteps(track));
  return row;
}

function renderSynthControls(track) {
  const wrap = document.createElement("div");
  wrap.className = "synth-controls";

  const waveLabel = document.createElement("label");
  waveLabel.textContent = "Dalga Formu";
  const waveSelect = document.createElement("select");
  ["sawtooth", "square"].forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w === "sawtooth" ? "Testere" : "Kare";
    if (w === track.waveform) opt.selected = true;
    waveSelect.appendChild(opt);
  });
  waveSelect.addEventListener("change", () => track.setWaveform(waveSelect.value));
  waveLabel.appendChild(waveSelect);

  const noteLabel = document.createElement("label");
  noteLabel.textContent = "Nota";
  const noteSelect = document.createElement("select");
  Object.keys(NOTE_FREQS).forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    if (n === track.note) opt.selected = true;
    noteSelect.appendChild(opt);
  });
  noteSelect.addEventListener("change", () => track.setNote(noteSelect.value));
  noteLabel.appendChild(noteSelect);

  const cutoffLabel = document.createElement("label");
  cutoffLabel.textContent = "Kesim Frekansı";
  const cutoffInput = document.createElement("input");
  cutoffInput.type = "range";
  cutoffInput.min = "100";
  cutoffInput.max = "3000";
  cutoffInput.step = "10";
  cutoffInput.value = String(track.cutoff);
  cutoffInput.addEventListener("input", () => track.setCutoff(parseFloat(cutoffInput.value)));
  cutoffLabel.appendChild(cutoffInput);

  const depthLabel = document.createElement("label");
  depthLabel.textContent = "LFO Derinliği";
  const depthInput = document.createElement("input");
  depthInput.type = "range";
  depthInput.min = "0";
  depthInput.max = "3000";
  depthInput.step = "10";
  depthInput.value = String(track.lfoDepth);
  depthInput.addEventListener("input", () => track.setLfoDepth(parseFloat(depthInput.value)));
  depthLabel.appendChild(depthInput);

  const rateLabel = document.createElement("label");
  rateLabel.textContent = "Wobble Hızı (Hz)";
  const rateInput = document.createElement("input");
  rateInput.type = "range";
  rateInput.min = "0.5";
  rateInput.max = "20";
  rateInput.step = "0.1";
  rateInput.value = String(track.lfoRate);
  rateInput.addEventListener("input", () => track.setLfoRate(parseFloat(rateInput.value)));
  rateLabel.appendChild(rateInput);

  wrap.append(waveLabel, noteLabel, cutoffLabel, depthLabel, rateLabel);
  return wrap;
}

function renderInstrumentControls(track) {
  const wrap = document.createElement("div");
  wrap.className = "synth-controls";

  const noteLabel = document.createElement("label");
  noteLabel.textContent = "Nota";
  const noteSelect = document.createElement("select");
  NOTE_FULL_LIST.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    if (n === track.note) opt.selected = true;
    noteSelect.appendChild(opt);
  });
  noteSelect.addEventListener("change", () => track.setNote(noteSelect.value));
  noteLabel.appendChild(noteSelect);

  const releaseLabel = document.createElement("label");
  releaseLabel.textContent = "Uzunluk (sn)";
  const releaseInput = document.createElement("input");
  releaseInput.type = "range";
  releaseInput.min = "0.05";
  releaseInput.max = "2.5";
  releaseInput.step = "0.05";
  releaseInput.value = String(track.release);
  releaseInput.addEventListener("input", () => track.setRelease(parseFloat(releaseInput.value)));
  releaseLabel.appendChild(releaseInput);

  wrap.append(noteLabel, releaseLabel);
  return wrap;
}

function renderSteps(track) {
  const grid = document.createElement("div");
  grid.className = "steps";
  grid.setAttribute("data-step-count", String(totalSteps));
  grid.style.setProperty("--n", String(totalSteps));
  grid.style.setProperty("--track-color", track.color);

  track.steps.forEach((on, i) => {
    const step = document.createElement("div");
    step.className = "step" + (on ? " on" : "");
    step.setAttribute("data-index", String(i));
    step.addEventListener("click", () => {
      track.steps[i] = !track.steps[i];
      step.classList.toggle("on", track.steps[i]);
    });
    grid.appendChild(step);
  });
  return grid;
}

/* ===================== Track creation helpers ===================== */

function addSampleTrack(name, buffer) {
  const t = new SampleTrack(name, buffer, nextColor());
  tracks.push(t);
  renderAll();
  return t;
}

function addWobbleTrack(name) {
  const t = new WobbleTrack(name || "Wobble Bass", nextColor());
  tracks.push(t);
  renderAll();
  return t;
}

function addInstrumentTrack(name, presetKey) {
  const t = new InstrumentTrack(name, presetKey, nextColor());
  tracks.push(t);
  renderAll();
  return t;
}

function loadBuiltinTracks() {
  for (const name of STARTER_TRACK_NAMES) {
    const entry = SOUND_LIBRARY.find((s) => s.name === name);
    if (!entry) continue;
    const t = new SampleTrack(entry.name, getLibraryBuffer(entry), entry.color);
    tracks.push(t);
  }
  const wobble = new WobbleTrack("Wobble Bass", "#b23bff");
  tracks.push(wobble);

  // A simple starter half-time dubstep pattern so it makes music immediately.
  const patterns = {
    Kick: [0, 6],
    Snare: [8],
    "Hi-Hat": [2, 6, 10, 14],
    Clap: [8],
    "Sub Hit": [0],
    "Wobble Bass": [0, 2, 4, 6, 8, 10, 12, 14],
  };
  for (const t of tracks) {
    const pat = patterns[t.name];
    if (pat) pat.forEach((i) => (t.steps[i] = true));
  }
}

/* ===================== Sound library modal ===================== */

const INSTRUMENT_LIBRARY = Object.entries(INSTRUMENT_PRESETS).map(([key, preset], i) => ({
  kind: "instrument",
  presetKey: key,
  name: preset.label,
  category: "Enstrüman",
  color: TRACK_COLORS[(i + 3) % TRACK_COLORS.length],
}));
INSTRUMENT_LIBRARY.push({ kind: "wobble", name: "Wobble Bass", category: "Enstrüman", color: "#b23bff" });

const ALL_LIBRARY = [...SOUND_LIBRARY, ...INSTRUMENT_LIBRARY];

function renderLibrary() {
  libraryListEl.innerHTML = "";
  const categories = [...new Set(ALL_LIBRARY.map((s) => s.category))];
  for (const category of categories) {
    const heading = document.createElement("div");
    heading.className = "library-category";
    heading.textContent = category;
    libraryListEl.appendChild(heading);

    for (const entry of ALL_LIBRARY.filter((s) => s.category === category)) {
      const row = document.createElement("div");
      row.className = "library-item";
      row.style.setProperty("--item-color", entry.color);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = entry.name;

      const previewBtn = document.createElement("button");
      previewBtn.className = "preview-btn";
      previewBtn.textContent = "▶";
      previewBtn.title = "Önizle";
      previewBtn.addEventListener("click", () => {
        ctx.resume();
        if (entry.kind === "sample") {
          const src = ctx.createBufferSource();
          src.buffer = getLibraryBuffer(entry);
          src.connect(masterGain);
          src.start();
        } else if (entry.kind === "instrument") {
          previewInstrument(entry.presetKey);
        } else if (entry.kind === "wobble") {
          previewWobble();
        }
      });

      const addBtn = document.createElement("button");
      addBtn.className = "add-btn";
      addBtn.textContent = "+ Ekle";
      addBtn.addEventListener("click", () => {
        if (entry.kind === "sample") {
          addSampleTrack(entry.name, getLibraryBuffer(entry));
        } else if (entry.kind === "instrument") {
          addInstrumentTrack(entry.name, entry.presetKey);
        } else if (entry.kind === "wobble") {
          addWobbleTrack(`Wobble Bass ${tracks.filter((t) => t.type === "wobble").length + 1}`);
        }
      });

      row.append(name, previewBtn, addBtn);
      libraryListEl.appendChild(row);
    }
  }
}

function openLibrary() {
  libraryModal.classList.remove("hidden");
}
function closeLibrary() {
  libraryModal.classList.add("hidden");
}

/* ===================== Event wiring ===================== */

playBtn.addEventListener("click", () => (isPlaying ? stop() : play()));

clearBtn.addEventListener("click", () => {
  for (const t of tracks) t.steps.fill(false);
  renderAll();
});

bpmInput.addEventListener("change", () => {
  const v = parseInt(bpmInput.value, 10);
  bpm = Math.min(220, Math.max(40, isNaN(v) ? 140 : v));
  bpmInput.value = String(bpm);
});

stepsSelect.addEventListener("change", () => {
  totalSteps = parseInt(stepsSelect.value, 10);
  for (const t of tracks) t.resize(totalSteps);
  renderAll();
});

masterVolumeEl.addEventListener("input", () => setMasterVolume(parseFloat(masterVolumeEl.value)));

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const name = file.name.replace(/\.[^/.]+$/, "");
      addSampleTrack(name, audioBuffer);
    } catch (err) {
      console.error("Ses dosyası yüklenemedi:", file.name, err);
      alert(`"${file.name}" yüklenemedi. Desteklenen bir ses formatı olduğundan emin ol.`);
    }
  }
  fileInput.value = "";
});

addWobbleBtn.addEventListener("click", () => addWobbleTrack(`Wobble Bass ${tracks.filter((t) => t.type === "wobble").length + 1}`));

openLibraryBtn.addEventListener("click", openLibrary);
closeLibraryBtn.addEventListener("click", closeLibrary);
libraryModal.addEventListener("click", (e) => {
  if (e.target === libraryModal) closeLibrary();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLibrary();
});

/* ===================== Init ===================== */

setMasterVolume(parseFloat(masterVolumeEl.value));
loadBuiltinTracks();
renderAll();
renderLibrary();
