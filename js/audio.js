/**
 * ULTIMATE STREET RACER - Audio Engine
 * Procedural Web Audio API synthesizer for engine sounds, drifts, collisions,
 * nitro boost, UI effects, and dynamic synthwave background music.
 * Zero external audio files required!
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isInitialized = false;
        this.masterVolume = 0.8;
        this.sfxVolume = 0.9;
        this.musicVolume = 0.6;
        this.musicEnabled = true;
        this.sfxEnabled = true;

        // Master gain nodes
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        // Engine sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineFilter = null;
        this.engineGain = null;
        this.engineBaseFreq = 55; // Hz

        // Tire screech nodes
        this.screechNoise = null;
        this.screechFilter = null;
        this.screechGain = null;

        // Nitro sound nodes
        this.nitroNoise = null;
        this.nitroFilter = null;
        this.nitroGain = null;

        // Music sequencer state
        this.musicInterval = null;
        this.step = 0;
        this.bpm = 126;
        this.isPlayingMusic = false;

        // Noise buffer cache
        this.noiseBuffer = null;
    }

    init() {
        if (this.isInitialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();

            // Create Master Bus
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // SFX Bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // Music Bus
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicEnabled ? this.musicVolume : 0, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            // Create Shared White Noise Buffer
            this.noiseBuffer = this.createNoiseBuffer(2);

            // Setup continuous sound generators
            this.setupEngineSound();
            this.setupScreechSound();
            this.setupNitroSound();

            this.isInitialized = true;

            if (this.musicEnabled) {
                this.startMusic();
            }
        } catch (e) {
            console.warn("Web Audio API not supported or blocked:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    createNoiseBuffer(seconds) {
        if (!this.ctx) return null;
        const bufferSize = this.ctx.sampleRate * seconds;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    setupEngineSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc2.type = 'triangle';

        this.engineOsc1.frequency.setValueAtTime(55, now);
        this.engineOsc2.frequency.setValueAtTime(110, now);

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(250, now);
        this.engineFilter.Q.setValueAtTime(3.5, now);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.0, now);

        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);

        this.engineOsc1.start();
        this.engineOsc2.start();
    }

    updateEngineSound(rpmNorm, throttle, isBoosting) {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;

        // Base pitch from RPM (0.0 to 1.0)
        const targetFreq = 48 + rpmNorm * 220 + (throttle ? 25 : 0) + (isBoosting ? 60 : 0);
        this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, now, 0.05);

        // Lowpass filter opens up with throttle and RPM
        const filterCutoff = 180 + rpmNorm * 1800 + (throttle ? 500 : 0) + (isBoosting ? 1200 : 0);
        this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.06);

        // Engine volume
        const targetGain = 0.08 + rpmNorm * 0.22 + (throttle ? 0.08 : 0);
        this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    setupScreechSound() {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        this.screechNoise = this.ctx.createBufferSource();
        this.screechNoise.buffer = this.noiseBuffer;
        this.screechNoise.loop = true;

        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.setValueAtTime(1500, now);
        this.screechFilter.Q.setValueAtTime(4.0, now);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0.0, now);

        this.screechNoise.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.sfxGain);

        this.screechNoise.start();
    }

    updateDriftScreech(slipAmount) {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        // slipAmount: 0.0 to 1.0
        const gain = Math.min(1.0, Math.max(0, (slipAmount - 0.15) * 1.3));
        const targetFreq = 1200 + slipAmount * 800;
        this.screechFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
        this.screechGain.gain.setTargetAtTime(gain * 0.35, now, 0.04);
    }

    setupNitroSound() {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        this.nitroNoise = this.ctx.createBufferSource();
        this.nitroNoise.buffer = this.noiseBuffer;
        this.nitroNoise.loop = true;

        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'lowpass';
        this.nitroFilter.frequency.setValueAtTime(900, now);
        this.nitroFilter.Q.setValueAtTime(2.0, now);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.0, now);

        this.nitroNoise.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.sfxGain);

        this.nitroNoise.start();
    }

    updateNitroSound(isBoosting) {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const targetGain = isBoosting ? 0.4 : 0.0;
        const targetCutoff = isBoosting ? 2600 : 700;
        this.nitroGain.gain.setTargetAtTime(targetGain, now, 0.05);
        this.nitroFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
    }

    playCrashSound(intensity = 1.0) {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        try {
            const now = this.ctx.currentTime;
            if (this.lastCrashAudioTime && (now - this.lastCrashAudioTime < 0.18)) return;
            this.lastCrashAudioTime = now;

            const clampedIntensity = Math.min(1.0, Math.max(0.2, intensity));

            // Sub thump
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
            oscGain.gain.setValueAtTime(clampedIntensity * 0.5, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(oscGain);
            oscGain.connect(this.sfxGain);
            osc.start(now);
            osc.stop(now + 0.22);

            // Noise impact crunch
            if (this.noiseBuffer) {
                const noiseSource = this.ctx.createBufferSource();
                noiseSource.buffer = this.noiseBuffer;
                const noiseFilter = this.ctx.createBiquadFilter();
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.setValueAtTime(700, now);
                noiseFilter.Q.setValueAtTime(1.5, now);
                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(clampedIntensity * 0.6, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

                noiseSource.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);
                noiseSource.start(now);
                noiseSource.stop(now + 0.28);
            }
        } catch (e) {
            console.warn("Crash audio error:", e);
        }
    }

    playCountdownBeep(isGo = false) {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = isGo ? 'triangle' : 'sine';
        const freq = isGo ? 1650 : 880;
        const duration = isGo ? 0.45 : 0.2;

        osc.frequency.setValueAtTime(freq, now);
        if (isGo) {
            osc.frequency.exponentialRampToValueAtTime(2200, now + duration);
        }

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + duration);
    }

    playCheckpointChime() {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const tones = [1046.5, 1318.5]; // C6, E6
        tones.forEach((tone, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const startTime = now + idx * 0.08;
            osc.frequency.setValueAtTime(tone, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(startTime);
            osc.stop(startTime + 0.28);
        });
    }

    playVictoryFanfare() {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const notes = [
            { f: 523.25, d: 0.15, offset: 0 },    // C5
            { f: 659.25, d: 0.15, offset: 0.15 }, // E5
            { f: 783.99, d: 0.15, offset: 0.30 }, // G5
            { f: 1046.5, d: 0.60, offset: 0.45 }  // C6
        ];
        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            const startTime = now + note.offset;
            osc.frequency.setValueAtTime(note.f, startTime);
            gain.gain.setValueAtTime(0.35, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.d);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(startTime);
            osc.stop(startTime + note.d);
        });
    }

    playClickSound() {
        if (!this.isInitialized || !this.ctx || !this.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    // Dynamic Procedural Synthwave Music Generator
    startMusic() {
        if (this.isPlayingMusic || !this.ctx) return;
        this.isPlayingMusic = true;
        this.step = 0;

        const stepTime = (60 / this.bpm) / 4; // 16th note in seconds

        // Bassline pattern (A minor / F / C / G progression)
        // 4 bars, 16 steps each = 64 steps
        const bassNotes = [
            // Bar 1: Am (A1 = 55Hz)
            55, 55, 0, 55,  55, 0, 110, 55,  55, 55, 0, 55,  110, 55, 82.4, 55,
            // Bar 2: F (F1 = 43.65Hz)
            43.65, 43.65, 0, 43.65,  43.65, 0, 87.3, 43.65,  43.65, 43.65, 0, 43.65,  87.3, 43.65, 65.4, 43.65,
            // Bar 3: C (C2 = 65.41Hz)
            65.41, 65.41, 0, 65.41,  65.41, 0, 130.8, 65.41,  65.41, 65.41, 0, 65.41,  130.8, 65.41, 98, 65.41,
            // Bar 4: G (G1 = 49Hz)
            49, 49, 0, 49,  49, 0, 98, 49,  49, 49, 0, 49,  98, 49, 73.4, 49
        ];

        // Lead synth arpeggio notes (frequencies in Hz)
        const leadScale = [220, 261.6, 329.6, 392, 440, 523.25, 659.25, 783.99]; // Am pentatonic/diatonic

        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled || !this.ctx || this.ctx.state === 'suspended') return;
            const now = this.ctx.currentTime;
            const currentStep = this.step % 64;
            const beatStep = this.step % 16;

            // 1. Kick Drum (on beats 0, 4, 8, 12)
            if (beatStep === 0 || beatStep === 4 || beatStep === 8 || beatStep === 12) {
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(140, now);
                kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
                kickGain.gain.setValueAtTime(0.6, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                kickOsc.connect(kickGain);
                kickGain.connect(this.musicGain);
                kickOsc.start(now);
                kickOsc.stop(now + 0.15);
            }

            // 2. Snare / Clap (on beats 4, 12)
            if (beatStep === 4 || beatStep === 12) {
                const snareSource = this.ctx.createBufferSource();
                snareSource.buffer = this.noiseBuffer;
                const snareFilter = this.ctx.createBiquadFilter();
                snareFilter.type = 'highpass';
                snareFilter.frequency.setValueAtTime(1000, now);
                const snareGain = this.ctx.createGain();
                snareGain.gain.setValueAtTime(0.3, now);
                snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                snareSource.connect(snareFilter);
                snareFilter.connect(snareGain);
                snareGain.connect(this.musicGain);
                snareSource.start(now);
                snareSource.stop(now + 0.18);
            }

            // 3. Hi-Hat (every odd 16th step)
            if (beatStep % 2 === 1) {
                const hatSource = this.ctx.createBufferSource();
                hatSource.buffer = this.noiseBuffer;
                const hatFilter = this.ctx.createBiquadFilter();
                hatFilter.type = 'highpass';
                hatFilter.frequency.setValueAtTime(7000, now);
                const hatGain = this.ctx.createGain();
                hatGain.gain.setValueAtTime(beatStep % 4 === 2 ? 0.12 : 0.06, now);
                hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                hatSource.connect(hatFilter);
                hatFilter.connect(hatGain);
                hatGain.connect(this.musicGain);
                hatSource.start(now);
                hatSource.stop(now + 0.05);
            }

            // 4. Synth Bassline
            const bassFreq = bassNotes[currentStep];
            if (bassFreq > 0) {
                const bassOsc = this.ctx.createOscillator();
                const bassFilter = this.ctx.createBiquadFilter();
                const bassGain = this.ctx.createGain();
                bassOsc.type = 'sawtooth';
                bassOsc.frequency.setValueAtTime(bassFreq, now);

                bassFilter.type = 'lowpass';
                bassFilter.frequency.setValueAtTime(350, now);
                bassFilter.Q.setValueAtTime(4.0, now);
                bassFilter.frequency.exponentialRampToValueAtTime(120, now + stepTime * 0.9);

                bassGain.gain.setValueAtTime(0.28, now);
                bassGain.gain.exponentialRampToValueAtTime(0.01, now + stepTime * 0.9);

                bassOsc.connect(bassFilter);
                bassFilter.connect(bassGain);
                bassGain.connect(this.musicGain);
                bassOsc.start(now);
                bassOsc.stop(now + stepTime);
            }

            // 5. Arpeggiated Synth Lead (every 2 steps)
            if (this.step % 2 === 0) {
                const noteIdx = (currentStep * 3) % leadScale.length;
                const leadFreq = leadScale[noteIdx];
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                const leadFilter = this.ctx.createBiquadFilter();

                leadOsc.type = 'square';
                leadOsc.frequency.setValueAtTime(leadFreq, now);

                leadFilter.type = 'lowpass';
                leadFilter.frequency.setValueAtTime(1400, now);
                leadFilter.Q.setValueAtTime(2.0, now);

                leadGain.gain.setValueAtTime(0.08, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 1.5);

                leadOsc.connect(leadFilter);
                leadFilter.connect(leadGain);
                leadGain.connect(this.musicGain);
                leadOsc.start(now);
                leadOsc.stop(now + stepTime * 1.5);
            }

            this.step++;
        }, stepTime * 1000);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.isPlayingMusic = false;
    }

    setMasterVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        }
    }

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, val));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicEnabled ? this.musicVolume : 0, this.ctx.currentTime);
        }
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime);
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicEnabled ? this.musicVolume : 0, this.ctx.currentTime);
        }
        return this.musicEnabled;
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime);
        }
        return this.sfxEnabled;
    }
}

// Global Sound Instance
window.soundEngine = new SoundEngine();
