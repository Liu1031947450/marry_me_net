let audioContext: AudioContext | null = null;
let master: GainNode | null = null;
let melodyTimer: ReturnType<typeof setInterval> | undefined;
let active = false;
let noteIndex = 0;
let lastStep = 0;

const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 0,
  440, 523.25, 659.25, 587.33, 523.25, 440, 392, 0];

function tone(frequency: number, duration: number, volume: number, offset = 0, type: OscillatorType = 'sine') {
  if (!audioContext || !master || !active || frequency === 0) return;
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const start = audioContext.currentTime + offset;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

export async function setSound(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    active = false;
    clearInterval(melodyTimer);
    melodyTimer = undefined;
    if (master && audioContext) master.gain.setTargetAtTime(0, audioContext.currentTime, 0.03);
    return false;
  }
  try {
    audioContext ??= new AudioContext();
    if (!master) {
      master = audioContext.createGain();
      master.connect(audioContext.destination);
    }
    await audioContext.resume();
    active = audioContext.state === 'running';
    master.gain.setTargetAtTime(active ? 0.45 : 0, audioContext.currentTime, 0.03);
    if (active && !melodyTimer) {
      melodyTimer = setInterval(() => {
        if (document.hidden) return;
        tone(melody[noteIndex % melody.length], 0.8, 0.16);
        if (noteIndex % 4 === 0) tone([130.81, 174.61, 146.83, 196][Math.floor(noteIndex / 4) % 4], 1.9, 0.1);
        noteIndex += 1;
      }, 430);
    }
    return active;
  } catch {
    active = false;
    return false;
  }
}

export function footstep(time: number) {
  if (time - lastStep < 240) return;
  lastStep = time;
  tone(150 + (Math.floor(time / 240) % 2) * 30, 0.055, 0.05, 0, 'triangle');
}

export function chime(kind: 'room' | 'love' | 'yes' | 'escape') {
  const notes = kind === 'escape' ? [659.25, 880] : kind === 'yes'
    ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
    : kind === 'love' ? [392, 523.25, 659.25, 783.99] : [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => tone(frequency, 0.8, 0.22, index * 0.14, 'triangle'));
}
