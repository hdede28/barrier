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

const BUILTIN_SOUNDS = [
  { name: "Kick", synth: synthKick, color: "#00e5ff" },
  { name: "Snare", synth: synthSnare, color: "#ff3b9a" },
  { name: "Hi-Hat", synth: synthHihat, color: "#39ff9c" },
  { name: "Clap", synth: synthClap, color: "#ffd23b" },
  { name: "Sub Hit", synth: synthSub, color: "#8a5bff" },
  { name: "Stab", synth: synthStab, color: "#ff7a3b" },
];

const NOTE_FREQS = {
  E1: 41.2, F1: 43.65, "F#1": 46.25, G1: 49.0, "G#1": 51.91,
  A1: 55.0, "A#1": 58.27, B1: 61.74, C2: 65.41, D2: 73.42, E2: 82.41,
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
  typeTag.textContent = track.type === "wobble" ? "Wobble" : "Örnek";

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
    renderAll();
  });

  header.append(nameInput, typeTag, muteBtn, soloBtn, volWrap, removeBtn);
  row.appendChild(header);

  if (track.type === "wobble") {
    row.appendChild(renderSynthControls(track));
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

function loadBuiltinTracks() {
  for (const s of BUILTIN_SOUNDS) {
    const t = new SampleTrack(s.name, s.synth(), s.color);
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

/* ===================== Init ===================== */

setMasterVolume(parseFloat(masterVolumeEl.value));
loadBuiltinTracks();
renderAll();
