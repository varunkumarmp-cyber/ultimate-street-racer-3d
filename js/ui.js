/**
 * ULTIMATE STREET RACER - UI, HUD & Minimap Controller
 * Renders the arcade racing HUD, 2D canvas minimap, countdown sequence,
 * results screen, pause modal, car/track selectors, settings, and touch controls.
 */

class UIManager {
    constructor(game) {
        this.game = game;

        // Minimap canvas
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        // HUD Elements
        this.speedValEl = document.getElementById('hud-speed-val');
        this.gearValEl = document.getElementById('hud-gear-val');
        this.lapValEl = document.getElementById('hud-lap-val');
        this.posValEl = document.getElementById('hud-pos-val');
        this.timeValEl = document.getElementById('hud-time-val');
        this.bestValEl = document.getElementById('hud-best-val');
        this.nitroBarEl = document.getElementById('hud-nitro-fill');
        this.tachNeedleEl = document.getElementById('tach-needle');
        this.wrongWayEl = document.getElementById('hud-wrong-way');

        // Countdown element
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownText = document.getElementById('countdown-text');

        // Modals & Screens
        this.mainMenuScreen = document.getElementById('screen-main-menu');
        this.carSelectScreen = document.getElementById('screen-car-select');
        this.customizeScreen = document.getElementById('screen-customize');
        this.trackSelectScreen = document.getElementById('screen-track-select');
        this.settingsScreen = document.getElementById('screen-settings');
        this.pauseScreen = document.getElementById('screen-pause');
        this.finishScreen = document.getElementById('screen-finish');

        // Results screen elements
        this.resultsTitle = document.getElementById('results-title');
        this.resultsTable = document.getElementById('results-table-body');

        // Touch controls
        this.touchControlsEl = document.getElementById('touch-controls-container');

        // Cached track bounds for minimap
        this.minimapBounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };

        this.setupEventHandlers();
        this.setupCustomizeScreen();
        this.setupTouchControls();
    }

    setupEventHandlers() {
        // Main Menu Buttons
        document.getElementById('btn-main-play')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.startRace();
        });

        document.getElementById('btn-main-cars')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('car-select');
        });

        document.getElementById('btn-main-customize')?.addEventListener('click', () => {
            this.game.openGarage();
        });

        document.getElementById('btn-main-tracks')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('track-select');
        });

        document.getElementById('btn-main-settings')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('settings');
        });

        // Car Select Buttons
        const carCards = document.querySelectorAll('.car-card');
        carCards.forEach(card => {
            card.addEventListener('click', () => {
                const carKey = card.dataset.car;
                this.game.selectCar(carKey);
                carCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.game.sound.playClickSound();
            });
        });

        document.getElementById('btn-car-customize')?.addEventListener('click', () => {
            this.game.openGarage();
        });

        document.getElementById('btn-car-back')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('main-menu');
        });

        // Track Select Buttons
        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach(card => {
            card.addEventListener('click', () => {
                const trackKey = card.dataset.track;
                this.game.selectTrack(trackKey);
                trackCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.game.sound.playClickSound();
            });
        });

        document.getElementById('btn-track-back')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('main-menu');
        });

        // Settings Controls
        const masterVol = document.getElementById('setting-master-vol');
        masterVol?.addEventListener('input', (e) => {
            this.game.sound.setMasterVolume(parseFloat(e.target.value));
        });

        const musicToggle = document.getElementById('setting-music-toggle');
        musicToggle?.addEventListener('change', () => {
            this.game.sound.toggleMusic();
        });

        const sfxToggle = document.getElementById('setting-sfx-toggle');
        sfxToggle?.addEventListener('change', () => {
            this.game.sound.toggleSfx();
        });

        const touchToggle = document.getElementById('setting-touch-toggle');
        touchToggle?.addEventListener('change', (e) => {
            if (this.touchControlsEl) {
                this.touchControlsEl.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        document.getElementById('btn-settings-back')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.showScreen('main-menu');
        });

        // Pause Menu Buttons
        document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.togglePause();
        });

        document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.restartRace();
        });

        document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.exitToMainMenu();
        });

        // Results Screen Buttons
        document.getElementById('btn-finish-restart')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.restartRace();
        });

        document.getElementById('btn-finish-menu')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.exitToMainMenu();
        });

        // On-screen HUD buttons
        document.getElementById('hud-pause-btn')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.togglePause();
        });

        document.getElementById('hud-camera-btn')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.switchCamera();
        });

        document.getElementById('hud-reset-btn')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.resetPlayerToTrack();
        });
    }

    setupTouchControls() {
        const bindTouchBtn = (id, onStart, onEnd) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const start = (e) => {
                e.preventDefault();
                btn.classList.add('active');
                onStart();
            };
            const end = (e) => {
                e.preventDefault();
                btn.classList.remove('active');
                onEnd();
            };
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        bindTouchBtn('touch-left', () => this.game.input.left = true, () => this.game.input.left = false);
        bindTouchBtn('touch-right', () => this.game.input.right = true, () => this.game.input.right = false);
        bindTouchBtn('touch-gas', () => this.game.input.throttle = true, () => this.game.input.throttle = false);
        bindTouchBtn('touch-brake', () => this.game.input.brake = true, () => this.game.input.brake = false);
        bindTouchBtn('touch-drift', () => this.game.input.handbrake = true, () => this.game.input.handbrake = false);
        bindTouchBtn('touch-nitro', () => this.game.input.boost = true, () => this.game.input.boost = false);

        // Auto-detect mobile devices or touch screens
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.touchControlsEl && isTouchDevice) {
            this.touchControlsEl.style.display = 'block';
            const touchCheck = document.getElementById('setting-touch-toggle');
            if (touchCheck) touchCheck.checked = true;
        }
    }

    calculateMinimapBounds(track3D) {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let pt of track3D.samplePoints) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.z < minZ) minZ = pt.z;
            if (pt.z > maxZ) maxZ = pt.z;
        }

        // Add padding
        const padX = (maxX - minX) * 0.15;
        const padZ = (maxZ - minZ) * 0.15;
        this.minimapBounds = {
            minX: minX - padX,
            maxX: maxX + padX,
            minZ: minZ - padZ,
            maxZ: maxZ + padZ
        };
    }

    showScreen(name) {
        const screens = [
            this.mainMenuScreen,
            this.carSelectScreen,
            this.customizeScreen,
            this.trackSelectScreen,
            this.settingsScreen,
            this.pauseScreen,
            this.finishScreen
        ];

        screens.forEach(s => {
            if (s) s.classList.remove('active');
        });

        const hud = document.getElementById('hud-container');
        if (hud) hud.style.display = (name === 'racing' || name === 'pause') ? 'block' : 'none';

        if (name === 'main-menu') this.mainMenuScreen?.classList.add('active');
        if (name === 'car-select') this.carSelectScreen?.classList.add('active');
        if (name === 'customize') this.customizeScreen?.classList.add('active');
        if (name === 'track-select') this.trackSelectScreen?.classList.add('active');
        if (name === 'settings') this.settingsScreen?.classList.add('active');
        if (name === 'pause') this.pauseScreen?.classList.add('active');
        if (name === 'finish') this.finishScreen?.classList.add('active');
    }

    showCountdown(num) {
        if (!this.countdownOverlay || !this.countdownText) return;
        this.countdownOverlay.style.display = 'flex';

        if (num > 0) {
            this.countdownText.innerText = num;
            this.countdownText.className = 'countdown-num count-' + num;
        } else {
            this.countdownText.innerText = 'GO!';
            this.countdownText.className = 'countdown-num count-go';
        }
    }

    hideCountdown() {
        if (this.countdownOverlay) {
            this.countdownOverlay.style.display = 'none';
        }
    }

    formatTime(seconds) {
        if (!seconds || seconds === Infinity) return '--:--.--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    updateHUD(playerPhysics, raceTime, position, totalRacers, isWrongWay) {
        if (!playerPhysics) return;

        // Speedometer
        const speedKmh = playerPhysics.getSpeedKmh();
        if (this.speedValEl) this.speedValEl.innerText = speedKmh;

        // Gear Indicator
        if (this.gearValEl) this.gearValEl.innerText = playerPhysics.getGear();

        // Tachometer Needle Rotation (0 to 180 degrees)
        if (this.tachNeedleEl) {
            const rpmNorm = Math.min(1.0, speedKmh / 260);
            const deg = -90 + rpmNorm * 180;
            this.tachNeedleEl.style.transform = `rotate(${deg}deg)`;
        }

        // Lap Counter
        if (this.lapValEl) {
            this.lapValEl.innerText = `${Math.min(playerPhysics.currentLap, playerPhysics.totalLaps)} / ${playerPhysics.totalLaps}`;
        }

        // Race Position
        if (this.posValEl) {
            const suffixes = ['th', 'ST', 'ND', 'RD', 'th', 'th', 'th'];
            const suffix = suffixes[position] || 'th';
            this.posValEl.innerHTML = `${position}<span class="pos-suffix">${suffix}</span> <span class="pos-total">/ ${totalRacers}</span>`;
        }

        // Timer
        if (this.timeValEl) {
            this.timeValEl.innerText = this.formatTime(raceTime);
        }

        // Best Lap
        if (this.bestValEl) {
            this.bestValEl.innerText = this.formatTime(playerPhysics.bestLapTime);
        }

        // Nitro Bar & Asphalt Speed Vignette
        if (this.nitroBarEl) {
            const pct = Math.max(0, Math.min(100, playerPhysics.nitro));
            this.nitroBarEl.style.width = pct + '%';
            if (playerPhysics.isBoosting) {
                this.nitroBarEl.classList.add('boosting');
            } else {
                this.nitroBarEl.classList.remove('boosting');
            }
        }

        const vignette = document.getElementById('nitro-speed-vignette');
        if (vignette) {
            if (playerPhysics.isBoosting) {
                vignette.classList.add('active');
            } else {
                vignette.classList.remove('active');
            }
        }

        // Wrong Way Warning
        if (this.wrongWayEl) {
            this.wrongWayEl.style.display = isWrongWay ? 'block' : 'none';
        }
    }

    renderMinimap(track3D, playerPhysics, aiControllers) {
        if (!this.minimapCtx || !this.minimapCanvas) return;
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        const b = this.minimapBounds;
        const toCanvasX = (worldX) => ((worldX - b.minX) / (b.maxX - b.minX)) * (w - 24) + 12;
        const toCanvasY = (worldZ) => ((worldZ - b.minZ) / (b.maxZ - b.minZ)) * (h - 24) + 12;

        // Draw track road spline
        ctx.beginPath();
        ctx.strokeStyle = '#222538';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 0; i <= track3D.samplePoints.length; i++) {
            const pt = track3D.samplePoints[i % track3D.samplePoints.length];
            const cx = toCanvasX(pt.x);
            const cy = toCanvasY(pt.z);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        // Inner glowing track line
        ctx.beginPath();
        ctx.strokeStyle = '#3a86ff';
        ctx.lineWidth = 3;
        for (let i = 0; i <= track3D.samplePoints.length; i++) {
            const pt = track3D.samplePoints[i % track3D.samplePoints.length];
            const cx = toCanvasX(pt.x);
            const cy = toCanvasY(pt.z);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        // Start/Finish Line Indicator
        const startPt = track3D.samplePoints[0];
        const sX = toCanvasX(startPt.x);
        const sY = toCanvasY(startPt.z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sX - 4, sY - 4, 8, 8);

        // Draw AI Opponents
        for (let ai of aiControllers) {
            const aiX = toCanvasX(ai.physics.position.x);
            const aiY = toCanvasY(ai.physics.position.z);

            ctx.fillStyle = '#' + ai.profile.color.toString(16).padStart(6, '0');
            ctx.beginPath();
            ctx.arc(aiX, aiY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Player Car (Glowing Cyan Arrow with heading)
        const pX = toCanvasX(playerPhysics.position.x);
        const pY = toCanvasY(playerPhysics.position.z);

        ctx.save();
        ctx.translate(pX, pY);
        // Map heading angle (Three.js world: Z = forward, X = right)
        // Canvas: X = right, Y = down (Z)
        const angle = Math.atan2(playerPhysics.forward.z, playerPhysics.forward.x);
        ctx.rotate(angle);

        // Cyan Player Marker
        ctx.fillStyle = '#00f5d4';
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-6, -5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    showRaceResults(allResults, playerPosition) {
        if (!this.finishScreen || !this.resultsTable) return;

        if (this.resultsTitle) {
            if (playerPosition === 1) {
                this.resultsTitle.innerText = 'VICTORY! 1ST PLACE';
                this.resultsTitle.className = 'results-header victory';
            } else if (playerPosition <= 3) {
                this.resultsTitle.innerText = `PODIUM FINISH: ${playerPosition}TH PLACE`;
                this.resultsTitle.className = 'results-header podium';
            } else {
                this.resultsTitle.innerText = `RACE COMPLETED: ${playerPosition}TH PLACE`;
                this.resultsTitle.className = 'results-header defeat';
            }
        }

        // Populate results table
        let tableHtml = '';
        allResults.forEach((res, idx) => {
            const isPlayerRow = res.isPlayer ? 'player-row' : '';
            tableHtml += `
                <tr class="${isPlayerRow}">
                    <td><strong>${idx + 1}</strong></td>
                    <td>${res.name} ${res.isPlayer ? '(YOU)' : ''}</td>
                    <td>${res.carName}</td>
                    <td>${this.formatTime(res.totalTime)}</td>
                    <td>${this.formatTime(res.bestLap)}</td>
                </tr>
            `;
        });

        this.resultsTable.innerHTML = tableHtml;
        this.showScreen('finish');
    }

    setupCustomizeScreen() {
        // Tab switching
        const tabBtns = document.querySelectorAll('.custom-tab-btn');
        const tabContents = document.querySelectorAll('.customize-tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.add('active');
                this.game.sound.playClickSound();
            });
        });

        // 1. Body Paint Swatches
        const paintSwatches = document.querySelectorAll('#swatches-paint .swatch-btn');
        paintSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                paintSwatches.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const colorHex = parseInt(btn.dataset.color, 16);
                const activeFinish = document.querySelector('#group-paint-finish .pill-btn.active')?.dataset.finish || 'metallic';
                this.game.playerCar?.setPaint(colorHex, activeFinish);
            });
        });

        // Paint Finish Pills
        const finishPills = document.querySelectorAll('#group-paint-finish .pill-btn');
        finishPills.forEach(btn => {
            btn.addEventListener('click', () => {
                finishPills.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const finish = btn.dataset.finish;
                this.game.currentFinish = finish;
                const activeColor = this.game.playerCar?.config.primaryColor || 0xdd1122;
                this.game.playerCar?.setPaint(activeColor, finish);
            });
        });

        // 2. Racing Stripe Swatches
        const stripeSwatches = document.querySelectorAll('#swatches-stripe .swatch-btn');
        stripeSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                stripeSwatches.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const colorVal = btn.dataset.color;
                if (colorVal === 'none') {
                    this.game.playerCar?.setStripe(null, false);
                } else {
                    this.game.playerCar?.setStripe(parseInt(colorVal, 16), true);
                }
            });
        });

        // 3. Window Tint Pills
        const tintPills = document.querySelectorAll('#group-window-tint .pill-btn');
        tintPills.forEach(btn => {
            btn.addEventListener('click', () => {
                tintPills.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const tintHex = parseInt(btn.dataset.tint, 16);
                const opacity = parseFloat(btn.dataset.opacity);
                this.game.playerCar?.setWindowTint(tintHex, opacity);
            });
        });

        // 4. Rim Color Swatches
        const rimSwatches = document.querySelectorAll('#swatches-rims .swatch-btn');
        rimSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                rimSwatches.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                this.game.playerCar?.setRims(parseInt(btn.dataset.color, 16));
            });
        });

        // 5. Brake Caliper Swatches
        const caliperSwatches = document.querySelectorAll('#swatches-calipers .swatch-btn');
        caliperSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                caliperSwatches.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                this.game.playerCar?.setCalipers(parseInt(btn.dataset.color, 16));
            });
        });

        // 6. Underglow Swatches
        const underglowSwatches = document.querySelectorAll('#swatches-underglow .swatch-btn');
        underglowSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                underglowSwatches.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const colorVal = btn.dataset.color;
                if (colorVal === 'off') {
                    this.game.playerCar?.setUnderglow(null);
                } else {
                    this.game.playerCar?.setUnderglow(parseInt(colorVal, 16));
                }
            });
        });

        // 7. Spoiler Style Pills
        const spoilerPills = document.querySelectorAll('#group-spoiler .pill-btn');
        spoilerPills.forEach(btn => {
            btn.addEventListener('click', () => {
                spoilerPills.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.sound.playClickSound();
                const spoilerStyle = btn.dataset.spoiler;
                this.game.currentSpoiler = spoilerStyle;
                this.game.playerCar?.setSpoiler(spoilerStyle);
            });
        });

        // 8. Performance Tuning Sliders
        const speedSlider = document.getElementById('tune-speed-slider');
        const speedLabel = document.getElementById('tune-speed-label');
        speedSlider?.addEventListener('input', (e) => {
            const mult = parseFloat(e.target.value);
            const baseKmh = this.game.playerCar?.config.topSpeedKmh || 165;
            const tunedKmh = Math.round(baseKmh * mult);
            const pct = Math.round((mult - 1.0) * 100);
            if (speedLabel) speedLabel.innerText = (mult === 1.0) ? `Stock (${baseKmh} km/h)` : `${pct > 0 ? '+' : ''}${pct}% ECU Tune (${tunedKmh} km/h)`;
            this.game.playerPhysics?.applyTuning({ speed: mult });
        });

        const accelSlider = document.getElementById('tune-accel-slider');
        const accelLabel = document.getElementById('tune-accel-label');
        accelSlider?.addEventListener('input', (e) => {
            const mult = parseFloat(e.target.value);
            const pct = Math.round((mult - 1.0) * 100);
            if (accelLabel) accelLabel.innerText = (mult === 1.0) ? 'Stage 1 (Normal)' : `Stage ${mult >= 1.15 ? '3' : '2'} Turbo (${pct > 0 ? '+' : ''}${pct}%)`;
            this.game.playerPhysics?.applyTuning({ accel: mult });
        });

        const handlingSlider = document.getElementById('tune-handling-slider');
        const handlingLabel = document.getElementById('tune-handling-label');
        handlingSlider?.addEventListener('input', (e) => {
            const mult = parseFloat(e.target.value);
            const pct = Math.round((mult - 1.0) * 100);
            if (handlingLabel) handlingLabel.innerText = (mult === 1.0) ? 'Street Balance' : `Track Stiffened (${pct > 0 ? '+' : ''}${pct}%)`;
            this.game.playerPhysics?.applyTuning({ handling: mult });
        });

        const nitroSlider = document.getElementById('tune-nitro-slider');
        const nitroLabel = document.getElementById('tune-nitro-label');
        nitroSlider?.addEventListener('input', (e) => {
            const mult = parseFloat(e.target.value);
            const pct = Math.round((mult - 1.0) * 100);
            if (nitroLabel) nitroLabel.innerText = (mult === 1.0) ? 'Dual Shot' : `High-Pressure Flow (${pct > 0 ? '+' : ''}${pct}%)`;
            this.game.playerPhysics?.applyTuning({ nitro: mult });
        });

        // 9. Save & Race / Save & Back
        document.getElementById('btn-custom-race')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.saveCarCustomization();
            this.game.startRace();
        });

        document.getElementById('btn-custom-back')?.addEventListener('click', () => {
            this.game.sound.playClickSound();
            this.game.saveCarCustomization();
            this.game.exitToMainMenu();
        });

        this.setupGarageDragControls();
    }

    setupGarageDragControls() {
        const screen = this.customizeScreen;
        if (!screen) return;

        let isDown = false;
        let startX = 0;
        let startY = 0;

        const onPointerDown = (clientX, clientY, target) => {
            if (target.closest('button') || target.closest('input') || target.closest('.customize-tabs') || target.closest('.option-pill-group') || target.closest('.color-swatches')) {
                return;
            }
            isDown = true;
            this.game.garageIsDragging = true;
            startX = clientX;
            startY = clientY;
        };

        const onPointerMove = (clientX, clientY) => {
            if (!isDown || this.game.state !== 'CUSTOMIZE') return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            startX = clientX;
            startY = clientY;

            this.game.garageOrbitAngle = (this.game.garageOrbitAngle || 0.6) - dx * 0.009;
            this.game.garageOrbitPitch = Math.max(0.08, Math.min(0.85, (this.game.garageOrbitPitch || 0.35) + dy * 0.006));
        };

        const onPointerUp = () => {
            isDown = false;
            this.game.garageIsDragging = false;
        };

        screen.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY, e.target));
        window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onPointerUp);

        screen.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchend', onPointerUp);
    }

    syncCustomizeUI() {
        if (!this.game.playerCar) return;
        const car = this.game.playerCar;
        const phys = this.game.playerPhysics;

        // Sync paint color swatch
        const pColorHex = '0x' + car.config.primaryColor.toString(16).padStart(6, '0');
        const paintSwatches = document.querySelectorAll('#swatches-paint .swatch-btn');
        paintSwatches.forEach(b => {
            b.classList.toggle('active', b.dataset.color.toLowerCase() === pColorHex.toLowerCase());
        });

        // Sync finish pill
        const currentFinish = this.game.currentFinish || 'metallic';
        const finishPills = document.querySelectorAll('#group-paint-finish .pill-btn');
        finishPills.forEach(b => {
            b.classList.toggle('active', b.dataset.finish === currentFinish);
        });

        // Sync stripe swatch
        const stripeSwatches = document.querySelectorAll('#swatches-stripe .swatch-btn');
        const stripeVisible = car.stripeMesh ? car.stripeMesh.visible : true;
        const sColorHex = '0x' + (car.config.stripeColor || 0xffffff).toString(16).padStart(6, '0');
        stripeSwatches.forEach(b => {
            if (!stripeVisible) {
                b.classList.toggle('active', b.dataset.color === 'none');
            } else {
                b.classList.toggle('active', b.dataset.color.toLowerCase() === sColorHex.toLowerCase());
            }
        });

        // Sync rim swatch
        const rimColorHex = car.rimMat ? ('0x' + car.rimMat.color.getHex().toString(16).padStart(6, '0')) : '0xdddddd';
        const rimSwatches = document.querySelectorAll('#swatches-rims .swatch-btn');
        rimSwatches.forEach(b => {
            b.classList.toggle('active', b.dataset.color.toLowerCase() === rimColorHex.toLowerCase());
        });

        // Sync caliper swatch
        const calColorHex = car.caliperMat ? ('0x' + car.caliperMat.color.getHex().toString(16).padStart(6, '0')) : '0xff0022';
        const calSwatches = document.querySelectorAll('#swatches-calipers .swatch-btn');
        calSwatches.forEach(b => {
            b.classList.toggle('active', b.dataset.color.toLowerCase() === calColorHex.toLowerCase());
        });

        // Sync underglow swatch
        const ugSwatches = document.querySelectorAll('#swatches-underglow .swatch-btn');
        const ugVisible = car.underglowPlane && car.underglowPlane.visible;
        const ugHex = ugVisible ? ('0x' + car.underglowMat.color.getHex().toString(16).padStart(6, '0')) : 'off';
        ugSwatches.forEach(b => {
            b.classList.toggle('active', b.dataset.color.toLowerCase() === ugHex.toLowerCase());
        });

        // Sync spoiler pill
        const curSpoiler = this.game.currentSpoiler || 'gt_wing';
        const spoilerPills = document.querySelectorAll('#group-spoiler .pill-btn');
        spoilerPills.forEach(b => {
            b.classList.toggle('active', b.dataset.spoiler === curSpoiler);
        });

        // Sync tuning sliders
        if (phys) {
            const speedSlider = document.getElementById('tune-speed-slider');
            const speedLabel = document.getElementById('tune-speed-label');
            if (speedSlider) {
                speedSlider.value = phys.tuneSpeed || 1.0;
                const baseKmh = car.config.topSpeedKmh || 165;
                const tunedKmh = Math.round(baseKmh * (phys.tuneSpeed || 1.0));
                const pct = Math.round(((phys.tuneSpeed || 1.0) - 1.0) * 100);
                if (speedLabel) speedLabel.innerText = (phys.tuneSpeed === 1.0) ? `Stock (${baseKmh} km/h)` : `${pct > 0 ? '+' : ''}${pct}% ECU Tune (${tunedKmh} km/h)`;
            }

            const accelSlider = document.getElementById('tune-accel-slider');
            const accelLabel = document.getElementById('tune-accel-label');
            if (accelSlider) {
                accelSlider.value = phys.tuneAccel || 1.0;
                const pct = Math.round(((phys.tuneAccel || 1.0) - 1.0) * 100);
                if (accelLabel) accelLabel.innerText = (phys.tuneAccel === 1.0) ? 'Stage 1 (Normal)' : `Stage ${phys.tuneAccel >= 1.15 ? '3' : '2'} Turbo (${pct > 0 ? '+' : ''}${pct}%)`;
            }

            const handlingSlider = document.getElementById('tune-handling-slider');
            const handlingLabel = document.getElementById('tune-handling-label');
            if (handlingSlider) {
                handlingSlider.value = phys.tuneHandling || 1.0;
                const pct = Math.round(((phys.tuneHandling || 1.0) - 1.0) * 100);
                if (handlingLabel) handlingLabel.innerText = (phys.tuneHandling === 1.0) ? 'Street Balance' : `Track Stiffened (${pct > 0 ? '+' : ''}${pct}%)`;
            }

            const nitroSlider = document.getElementById('tune-nitro-slider');
            const nitroLabel = document.getElementById('tune-nitro-label');
            if (nitroSlider) {
                nitroSlider.value = phys.tuneNitro || 1.0;
                const pct = Math.round(((phys.tuneNitro || 1.0) - 1.0) * 100);
                if (nitroLabel) nitroLabel.innerText = (phys.tuneNitro === 1.0) ? 'Dual Shot' : `High-Pressure Flow (${pct > 0 ? '+' : ''}${pct}%)`;
            }
        }
    }
}

window.UIManager = UIManager;
