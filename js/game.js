/**
 * ULTIMATE STREET RACER - Core Game Engine
 * Master game loop, Three.js scene & renderer, dynamic lighting, chase camera
 * with 4 switchable views, input manager, state machine, and race director.
 */

class GameEngine {
    constructor() {
        this.container = document.getElementById('game-container');

        // Game States: 'MENU', 'COUNTDOWN', 'RACING', 'PAUSED', 'FINISHED'
        this.state = 'MENU';

        // Selections
        this.selectedCarKey = 'apex_gt';
        this.selectedTrackKey = 'city';

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.dirLight = null;
        this.hemiLight = null;

        // Subsystems
        this.sound = window.soundEngine;
        this.particles = null;
        this.track = null;
        this.playerCar = null;
        this.playerPhysics = null;
        this.aiManager = null;
        this.ui = null;

        // Input State
        this.input = {
            throttle: false,
            brake: false,
            left: false,
            right: false,
            handbrake: false,
            boost: false
        };

        // Camera Modes: 0: Chase Close, 1: Chase Far, 2: Hood/Bumper, 3: Helicopter/Top-Down
        this.cameraMode = 0;
        this.cameraShakeTrauma = 0;
        this.turntableAngle = 0;

        // Garage 360 Orbit & Customization
        this.garageOrbitAngle = 0.6;
        this.garageOrbitPitch = 0.35;
        this.garageOrbitDist = 6.2;
        this.garageIsDragging = false;
        this.currentFinish = 'metallic';
        this.currentSpoiler = 'gt_wing';

        // Race State & Timing
        this.raceTime = 0;
        this.lapStartTime = 0;
        this.countdownTimer = 0;
        this.countdownStep = 3;
        this.totalRacers = 6;
        this.playerPosition = 1;
        this.isWrongWay = false;

        // Delta time clock
        this.clock = new THREE.Clock();

        this.initThree();
        this.initSubsystems();
        this.setupKeyboardInput();
        this.setupWindowResize();

        // Start animation loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x09071a);
        this.scene.fog = new THREE.FogExp2(0x110b24, 0.0018);

        // Camera
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.2, 1200);
        this.camera.position.set(0, 3, -6);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.hemiLight = new THREE.HemisphereLight(0x8899ff, 0x221c3b, 0.7);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.dirLight.position.set(60, 100, 40);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 250;
        const d = 50;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);
    }

    initSubsystems() {
        // Particles
        this.particles = new ParticleSystem(this.scene);

        // Track
        this.loadTrack(this.selectedTrackKey);
        this.loadCarCustomization();

        // UI Manager
        this.ui = new UIManager(this);
        this.ui.calculateMinimapBounds(this.track);
        this.ui.syncCustomizeUI();
        this.ui.showScreen('main-menu');
    }

    loadTrack(trackKey) {
        if (this.track) {
            this.track.destroy();
        }
        if (this.aiManager) {
            this.aiManager.destroy();
        }
        if (this.playerCar) {
            this.playerCar.destroy();
        }

        this.selectedTrackKey = trackKey;
        this.track = new Track3D(this.scene, trackKey);

        // Update atmosphere lighting to match track theme
        const tConf = this.track.config;
        this.scene.background = new THREE.Color(tConf.skyColor);
        this.scene.fog.color = new THREE.Color(tConf.fogColor);
        this.scene.fog.density = tConf.fogDensity;
        this.hemiLight.color = new THREE.Color(tConf.dirLightColor);
        this.hemiLight.groundColor = new THREE.Color(tConf.ambientColor);

        // Spawn Player Car
        this.playerCar = new Car3D(this.scene, this.selectedCarKey);
        this.playerPhysics = new VehiclePhysics(this.playerCar, this.track, this.particles, this.sound, true);
        this.playerPhysics.setStartGridPosition(0);

        // Spawn 5 AI Opponents
        this.aiManager = new AIManager(this.scene, this.track, this.particles, this.sound);

        if (this.ui) {
            this.ui.calculateMinimapBounds(this.track);
        }
    }

    selectCar(carKey) {
        this.selectedCarKey = carKey;
        if (this.playerCar) {
            this.playerCar.destroy();
        }
        this.playerCar = new Car3D(this.scene, this.selectedCarKey);
        this.playerPhysics = new VehiclePhysics(this.playerCar, this.track, this.particles, this.sound, true);
        this.playerPhysics.setStartGridPosition(0);
        this.loadCarCustomization();
        if (this.ui) {
            this.ui.syncCustomizeUI();
        }
    }

    selectTrack(trackKey) {
        this.loadTrack(trackKey);
    }

    setupKeyboardInput() {
        const onKey = (code, isDown) => {
            // Unlock audio on first user key/click
            if (!this.sound.isInitialized) {
                this.sound.init();
            } else {
                this.sound.resume();
            }

            switch (code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.input.throttle = isDown;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.input.brake = isDown;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.input.left = isDown;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.input.right = isDown;
                    break;
                case 'Space':
                    this.input.handbrake = isDown;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.input.boost = isDown;
                    break;
                case 'KeyC':
                    if (isDown) this.switchCamera();
                    break;
                case 'KeyR':
                    if (isDown) this.resetPlayerToTrack();
                    break;
                case 'Escape':
                    if (isDown) this.togglePause();
                    break;
            }
        };

        window.addEventListener('keydown', (e) => onKey(e.code, true));
        window.addEventListener('keyup', (e) => onKey(e.code, false));

        // Unlock audio on click / touch
        window.addEventListener('click', () => {
            if (!this.sound.isInitialized) this.sound.init();
            else this.sound.resume();
        }, { once: true });

        window.addEventListener('touchstart', () => {
            if (!this.sound.isInitialized) this.sound.init();
            else this.sound.resume();
        }, { once: true });
    }

    setupWindowResize() {
        window.addEventListener('resize', () => {
            if (!this.camera || !this.renderer) return;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    switchCamera() {
        this.cameraMode = (this.cameraMode + 1) % 4;
    }

    resetPlayerToTrack() {
        if (this.state === 'RACING' || this.state === 'COUNTDOWN') {
            this.playerPhysics.resetToTrack();
            this.cameraShakeTrauma = 0.3;
        }
    }

    startRace() {
        this.sound.init();
        this.sound.resume();

        // Position all cars at starting grid
        this.playerPhysics.setStartGridPosition(0);
        this.aiManager.resetRace();

        this.raceTime = 0;
        this.lapStartTime = 0;
        this.countdownStep = 3;
        this.countdownTimer = 1.0;
        this.state = 'COUNTDOWN';

        this.ui.showScreen('racing');
        this.ui.showCountdown(3);
        this.sound.playCountdownBeep(false);
    }

    restartRace() {
        this.startRace();
    }

    togglePause() {
        if (this.state === 'RACING') {
            this.state = 'PAUSED';
            this.ui.showScreen('pause');
        } else if (this.state === 'PAUSED') {
            this.state = 'RACING';
            this.ui.showScreen('racing');
        }
    }

    exitToMainMenu() {
        this.state = 'MENU';
        this.playerPhysics.setStartGridPosition(0);
        this.ui.showScreen('main-menu');
    }

    openGarage() {
        this.sound.playClickSound();
        this.state = 'CUSTOMIZE';
        this.playerPhysics.setStartGridPosition(0);
        this.loadCarCustomization();
        if (this.ui) {
            this.ui.syncCustomizeUI();
            this.ui.showScreen('customize');
        }
    }

    saveCarCustomization() {
        if (!this.playerCar) return;
        const key = `usr_custom_${this.selectedCarKey}`;
        const customData = {
            primaryColor: this.playerCar.config.primaryColor,
            finish: this.currentFinish || 'metallic',
            stripeColor: this.playerCar.config.stripeColor,
            stripeVisible: this.playerCar.stripeMesh ? this.playerCar.stripeMesh.visible : true,
            rimColor: this.playerCar.rimMat ? this.playerCar.rimMat.color.getHex() : 0xdddddd,
            caliperColor: this.playerCar.caliperMat ? this.playerCar.caliperMat.color.getHex() : 0xff0022,
            glassColor: this.playerCar.glassMat ? this.playerCar.glassMat.color.getHex() : 0x111625,
            glassOpacity: this.playerCar.glassMat ? this.playerCar.glassMat.opacity : 0.85,
            underglowColor: (this.playerCar.underglowPlane && this.playerCar.underglowPlane.visible) ? this.playerCar.underglowMat.color.getHex() : null,
            spoilerType: this.currentSpoiler || 'gt_wing',
            tuning: {
                speed: this.playerPhysics ? this.playerPhysics.tuneSpeed : 1.0,
                accel: this.playerPhysics ? this.playerPhysics.tuneAccel : 1.0,
                handling: this.playerPhysics ? this.playerPhysics.tuneHandling : 1.0,
                nitro: this.playerPhysics ? this.playerPhysics.tuneNitro : 1.0
            }
        };
        try {
            localStorage.setItem(key, JSON.stringify(customData));
        } catch(e) {}
    }

    loadCarCustomization() {
        if (!this.playerCar) return;
        const key = `usr_custom_${this.selectedCarKey}`;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const d = JSON.parse(raw);
            if (d.primaryColor !== undefined) {
                this.currentFinish = d.finish || 'metallic';
                this.playerCar.setPaint(d.primaryColor, this.currentFinish);
            }
            if (d.stripeColor !== undefined) {
                this.playerCar.setStripe(d.stripeColor, d.stripeVisible !== false);
            }
            if (d.rimColor !== undefined) {
                this.playerCar.setRims(d.rimColor);
            }
            if (d.caliperColor !== undefined) {
                this.playerCar.setCalipers(d.caliperColor);
            }
            if (d.glassColor !== undefined) {
                this.playerCar.setWindowTint(d.glassColor, d.glassOpacity || 0.85);
            }
            if (d.underglowColor !== undefined) {
                this.playerCar.setUnderglow(d.underglowColor);
            }
            if (d.spoilerType !== undefined) {
                this.currentSpoiler = d.spoilerType;
                this.playerCar.setSpoiler(d.spoilerType);
            }
            if (d.tuning && this.playerPhysics) {
                this.playerPhysics.applyTuning(d.tuning);
            }
        } catch(e) {}
    }

    updateRaceDirector(dt) {
        if (this.state === 'COUNTDOWN') {
            // Update countdown timer
            this.countdownTimer -= dt;
            if (this.countdownTimer <= 0) {
                this.countdownStep--;
                this.countdownTimer = 1.0;

                if (this.countdownStep > 0) {
                    this.ui.showCountdown(this.countdownStep);
                    this.sound.playCountdownBeep(false);
                } else if (this.countdownStep === 0) {
                    // GO!
                    this.ui.showCountdown(0);
                    this.sound.playCountdownBeep(true);
                    this.state = 'RACING';
                    this.lapStartTime = 0;
                    this.raceTime = 0;
                }
            } else if (this.countdownStep === 0 && this.countdownTimer < 0.3) {
                this.ui.hideCountdown();
            }
        }

        if (this.state === 'RACING') {
            this.raceTime += dt;

            // Check lap completion times for player
            if (this.playerPhysics.currentLap > 1 && this.lapStartTime === 0) {
                this.lapStartTime = this.raceTime;
            }

            // Wrong-way check
            const closest = this.track.getClosestTrackPoint(this.playerPhysics.position);
            const dotForwardTrack = this.playerPhysics.forward.dot(closest.tangent);
            this.isWrongWay = dotForwardTrack < -0.35 && Math.abs(this.playerPhysics.speed) > 3.0;

            // Check race finish
            if (this.playerPhysics.isFinished && this.state !== 'FINISHED') {
                this.state = 'FINISHED';
                this.playerPhysics.finishTime = this.raceTime;
                this.showResults();
            }
        }

        // Calculate Real-Time 1st to 6th Positions
        this.calculatePositions();

        // Update HUD & 2D Minimap
        this.ui.updateHUD(
            this.playerPhysics,
            this.raceTime,
            this.playerPosition,
            this.totalRacers,
            this.isWrongWay
        );

        this.ui.renderMinimap(this.track, this.playerPhysics, this.aiManager.opponents);
    }

    calculatePositions() {
        const racers = [
            {
                name: 'PLAYER',
                carName: this.playerCar.config.name,
                isPlayer: true,
                progress: this.playerPhysics.trackProgress,
                totalTime: this.playerPhysics.finishTime || this.raceTime,
                bestLap: this.playerPhysics.bestLapTime
            }
        ];

        for (let ai of this.aiManager.opponents) {
            racers.push({
                name: ai.profile.name,
                carName: ai.car3D.config.name,
                isPlayer: false,
                progress: ai.physics.trackProgress,
                totalTime: ai.physics.finishTime || (this.raceTime + (this.playerPhysics.trackProgress - ai.physics.trackProgress) * 0.05),
                bestLap: 45.0 + Math.random() * 5.0
            });
        }

        // Sort descending by race progress
        racers.sort((a, b) => b.progress - a.progress);

        for (let i = 0; i < racers.length; i++) {
            if (racers[i].isPlayer) {
                this.playerPosition = i + 1;
                break;
            }
        }

        this.cachedLeaderboard = racers;
    }

    showResults() {
        this.calculatePositions();
        this.ui.showRaceResults(this.cachedLeaderboard, this.playerPosition);
    }

    updateCamera(dt) {
        if (!this.playerCar || !this.camera) return;

        if (this.state === 'MENU') {
            // Turntable showcase camera orbiting car
            this.turntableAngle += dt * 0.45;
            const dist = 7.5;
            const cx = this.playerPhysics.position.x + Math.sin(this.turntableAngle) * dist;
            const cz = this.playerPhysics.position.z + Math.cos(this.turntableAngle) * dist;
            const cy = this.playerPhysics.position.y + 2.4;

            this.camera.position.set(cx, cy, cz);
            this.camera.lookAt(
                this.playerPhysics.position.x,
                this.playerPhysics.position.y + 0.9,
                this.playerPhysics.position.z
            );
        if (this.state === 'CUSTOMIZE') {
            // Interactive 360 garage orbit or slow spin if not dragging
            if (!this.garageIsDragging) {
                this.garageOrbitAngle += dt * 0.22;
            }
            const dist = this.garageOrbitDist || 6.2;
            const pitch = this.garageOrbitPitch || 0.35;
            const cx = this.playerPhysics.position.x + Math.sin(this.garageOrbitAngle) * Math.cos(pitch) * dist;
            const cy = this.playerPhysics.position.y + 0.5 + Math.sin(pitch) * dist;
            const cz = this.playerPhysics.position.z + Math.cos(this.garageOrbitAngle) * Math.cos(pitch) * dist;

            this.camera.position.set(cx, cy, cz);
            this.camera.lookAt(
                this.playerPhysics.position.x,
                this.playerPhysics.position.y + 0.65,
                this.playerPhysics.position.z
            );
            return;
        }

        if (this.state === 'FINISHED') {
            // Victory slow rotating camera around player car
            this.turntableAngle += dt * 0.7;
            const dist = 6.0;
            const cx = this.playerPhysics.position.x + Math.sin(this.turntableAngle) * dist;
            const cz = this.playerPhysics.position.z + Math.cos(this.turntableAngle) * dist;
            const cy = this.playerPhysics.position.y + 2.0;

            this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), dt * 3.0);
            this.camera.lookAt(
                this.playerPhysics.position.x,
                this.playerPhysics.position.y + 0.8,
                this.playerPhysics.position.z
            );
            return;
        }

        // Target look-ahead point - focused over the front hood
        const lookAheadDist = 6.5 + Math.abs(this.playerPhysics.speed) * 0.20;
        const targetLook = this.playerPhysics.position.clone()
            .addScaledVector(this.playerPhysics.forward, lookAheadDist);
        targetLook.y += 0.95;

        let targetCamPos = new THREE.Vector3();

        if (this.cameraMode === 0) {
            // Asphalt Signature Close Chase Camera: lower, closer, aggressive stance
            const lagBehind = -5.0 - (this.playerPhysics.isBoosting ? 0.6 : 0);
            targetCamPos = this.playerPhysics.position.clone()
                .addScaledVector(this.playerPhysics.forward, lagBehind)
                .add(new THREE.Vector3(0, 1.85, 0));
        } else if (this.cameraMode === 1) {
            // Chase Far
            targetCamPos = this.playerPhysics.position.clone()
                .addScaledVector(this.playerPhysics.forward, -7.8)
                .add(new THREE.Vector3(0, 3.2, 0));
        } else if (this.cameraMode === 2) {
            // Hood / Bumper View
            targetCamPos = this.playerPhysics.position.clone()
                .addScaledVector(this.playerPhysics.forward, 0.4)
                .add(new THREE.Vector3(0, 1.05, 0));
        } else if (this.cameraMode === 3) {
            // Helicopter / Birds-eye
            targetCamPos = this.playerPhysics.position.clone()
                .addScaledVector(this.playerPhysics.forward, -3.5)
                .add(new THREE.Vector3(0, 12.0, 0));
        }

        // Camera Shake calculation
        if (this.cameraShakeTrauma > 0) {
            this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma);
            const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.40;
            targetCamPos.x += (Math.random() - 0.5) * shake;
            targetCamPos.y += (Math.random() - 0.5) * shake;
            targetCamPos.z += (Math.random() - 0.5) * shake;
            this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.2);
        }

        // Smooth Camera Lerp with NaN protection
        if (!isNaN(targetCamPos.x) && !isNaN(targetCamPos.y) && !isNaN(targetCamPos.z)) {
            const camLerpSpeed = (this.cameraMode === 2) ? 25.0 : 12.0;
            this.camera.position.lerp(targetCamPos, dt * camLerpSpeed);
        }
        if (!isNaN(targetLook.x) && !isNaN(targetLook.y) && !isNaN(targetLook.z)) {
            this.camera.lookAt(targetLook);
        }

        // Asphalt Camera Banking / Roll into turns
        if (this.cameraMode === 0 || this.cameraMode === 1) {
            const targetBank = -this.playerPhysics.steerAngle * 0.06 - (this.playerPhysics.lateralSpeed / 20.0) * 0.04;
            this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, targetBank, dt * 8.0);
        }

        // Asphalt Dynamic FOV for speed sensation & nitro punch (comfortable, readable range)
        const speedRatio = Math.min(1.0, Math.abs(this.playerPhysics.speed) / 50.0);
        const targetFov = 60 + speedRatio * 8 + (this.playerPhysics.isBoosting ? 7 : 0);
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5.0);
        this.camera.updateProjectionMatrix();

        // Update Directional Light position to follow car
        this.dirLight.position.set(
            this.playerPhysics.position.x + 50,
            this.playerPhysics.position.y + 80,
            this.playerPhysics.position.z + 30
        );
        this.dirLight.target.position.copy(this.playerPhysics.position);
        this.dirLight.target.updateMatrixWorld();
    }

    animate() {
        requestAnimationFrame(this.animate);

        const dt = Math.min(this.clock.getDelta(), 0.05);

        if (this.state !== 'PAUSED') {
            // 1. Update Player Physics
            const raceIsActive = (this.state === 'RACING');
            this.playerPhysics.update(dt, this.input, raceIsActive);

            // 2. Update AI Opponents & Collisions
            this.aiManager.update(dt, this.playerPhysics, raceIsActive);

            // 3. Update Particle Systems
            this.particles.update(dt);

            // 4. Update Race Director & HUD
            this.updateRaceDirector(dt);
        }

        // 5. Update Camera
        this.updateCamera(dt);

        // 6. Render 3D Scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameEngine();
});
