/**
 * ULTIMATE STREET RACER - AI Racing Opponents & Multi-Car Collision Engine
 * Manages 5 AI drivers with intelligent waypoint following, curve anticipation,
 * dynamic lane shifting for overtaking, rubber banding, and car-to-car collisions.
 */

class AICarController {
    constructor(profile, gridIndex, scene, track3D, particleSystem, soundEngine) {
        this.profile = profile;
        this.gridIndex = gridIndex;
        this.track3D = track3D;

        // Build 3D Car Model
        this.car3D = new Car3D(scene, profile.configKey, {
            primary: profile.color,
            stripe: profile.accent
        });

        // Setup Physics
        this.physics = new VehiclePhysics(this.car3D, track3D, particleSystem, soundEngine, false);
        this.physics.topSpeedMps *= (profile.maxSpeedOffset || 1.0);
        this.physics.setStartGridPosition(gridIndex);

        // AI Driving Personality
        this.targetLaneOffset = (gridIndex % 2 === 0 ? -2.5 : 2.5) + (Math.random() - 0.5) * 1.5;
        this.laneShiftTimer = Math.random() * 4.0;
        this.aggression = profile.aggro || 0.8;
        this.lookaheadDist = 28.0; // meters ahead along spline
    }

    update(dt, playerPhysics, allCars, raceActive) {
        if (!raceActive) {
            this.physics.update(dt, { throttle: false, brake: false, left: false, right: false }, false);
            return;
        }

        // 1. DYNAMIC LANE SHIFTING (Overtaking & clear air)
        this.laneShiftTimer -= dt;
        if (this.laneShiftTimer <= 0) {
            this.laneShiftTimer = 3.0 + Math.random() * 4.0;
            // Pick a lane offset between -4.5m (left) and +4.5m (right)
            this.targetLaneOffset = (Math.random() - 0.5) * 9.0;
        }

        // 2. WAYPOINT TARGET SELECTION
        // Find current position on track spline
        const curTrackInfo = this.track3D.getClosestTrackPoint(this.physics.position);
        const curDistance = curTrackInfo.trackDistance;

        // Lookahead along track based on current speed
        const speedRatio = Math.max(0.3, this.physics.speed / this.physics.topSpeedMps);
        const lookahead = this.lookaheadDist * (0.8 + speedRatio * 0.7);
        const targetDist = (curDistance + lookahead) % this.track3D.trackLength;
        const targetU = targetDist / this.track3D.trackLength;

        // Spline point at target distance
        const splinePt = this.track3D.curve.getPointAt(targetU);
        const splineTan = this.track3D.curve.getTangentAt(targetU).normalize();
        const splineBin = new THREE.Vector3().crossVectors(splineTan, new THREE.Vector3(0, 1, 0)).normalize();

        // Target waypoint offset by chosen lane
        const targetPoint = splinePt.clone().addScaledVector(splineBin, this.targetLaneOffset);

        // 3. STEERING CALCULATION
        const toTarget = targetPoint.clone().sub(this.physics.position);
        toTarget.y = 0;
        toTarget.normalize();

        // Cross product with car forward vector to determine turn direction
        const crossY = this.physics.forward.x * toTarget.z - this.physics.forward.z * toTarget.x;

        let steerInput = 0;
        if (crossY > 0.05) {
            steerInput = -1.0; // Turn Left (negative steer)
        } else if (crossY < -0.05) {
            steerInput = 1.0;  // Turn Right (positive steer)
        } else {
            steerInput = -crossY * 8.0;
        }

        // 4. CORNER ANTICIPATION & SPEED MANAGEMENT
        const farTargetDist = (curDistance + lookahead * 1.6) % this.track3D.trackLength;
        const farTan = this.track3D.curve.getTangentAt(farTargetDist / this.track3D.trackLength).normalize();
        const curvatureAngle = splineTan.angleTo(farTan);

        let targetSpeedMps = this.physics.topSpeedMps;
        if (curvatureAngle > 0.35) {
            const cornerSlowdown = Math.max(0.45, 1.0 - (curvatureAngle - 0.35) * 1.2);
            targetSpeedMps *= cornerSlowdown;
        }

        // 5. TRAFFIC AVOIDANCE (Never ram the player or cars ahead)
        let forceBrake = false;
        for (let other of allCars) {
            if (other === this.physics) continue;
            const toOther = other.position.clone().sub(this.physics.position);
            toOther.y = 0;
            const distToOther = toOther.length();

            if (distToOther < 22.0) {
                const fwdDist = toOther.dot(this.physics.forward);
                if (fwdDist > 0 && fwdDist < 18.0) {
                    const latDist = toOther.dot(this.physics.right);
                    if (Math.abs(latDist) < 3.6) {
                        // Car in front - steer to the clear side
                        this.targetLaneOffset = (latDist >= 0) ? -4.2 : 4.2;
                        // Avoid rear collision
                        if (fwdDist < 12.0 && this.physics.speed >= other.speed) {
                            targetSpeedMps = Math.min(targetSpeedMps, other.speed * 0.85);
                            forceBrake = true;
                        }
                    }
                }
            }
        }

        // 6. COMPETITIVE RUBBER BANDING
        const playerDist = playerPhysics.trackProgress;
        const myDist = this.physics.trackProgress;
        const distDiff = myDist - playerDist;

        if (distDiff > 80) {
            targetSpeedMps *= 0.92;
        } else if (distDiff < -100) {
            targetSpeedMps *= 1.10;
        }

        // 7. THROTTLE / BRAKE INPUTS
        let throttle = false;
        let brake = forceBrake;
        let wantBoost = false;

        if (!forceBrake && this.physics.speed < targetSpeedMps) {
            throttle = true;
            if (curvatureAngle < 0.15 && this.physics.speed > 35 && distDiff < 20 && Math.random() < 0.05) {
                wantBoost = true;
            }
        } else if (this.physics.speed > targetSpeedMps + 2.0) {
            brake = true;
        }

        // Execute physics step: left = steerInput < -0.1, right = steerInput > 0.1
        this.physics.update(dt, {
            throttle: throttle,
            brake: brake,
            left: steerInput < -0.1,
            right: steerInput > 0.1,
            handbrake: false,
            boost: wantBoost
        }, raceActive);
    }
}

class AIManager {
    constructor(scene, track3D, particleSystem, soundEngine) {
        this.scene = scene;
        this.track3D = track3D;
        this.particles = particleSystem;
        this.sound = soundEngine;

        this.opponents = [];
        this.buildOpponents();
    }

    buildOpponents() {
        this.opponents = [];
        // 5 AI Opponents starting in grid positions 1, 2, 3, 4, 5 (Player starts in grid position 0 or 5)
        for (let i = 0; i < AI_CAR_PROFILES.length; i++) {
            const profile = AI_CAR_PROFILES[i];
            const ai = new AICarController(
                profile,
                i + 1, // grid position 1 through 5
                this.scene,
                this.track3D,
                this.particles,
                this.sound
            );
            this.opponents.push(ai);
        }
    }

    resetRace() {
        for (let i = 0; i < this.opponents.length; i++) {
            this.opponents[i].physics.setStartGridPosition(i + 1);
        }
    }

    update(dt, playerPhysics, raceActive) {
        // Collect all car physics objects
        const allCars = [playerPhysics];
        for (let ai of this.opponents) {
            allCars.push(ai.physics);
        }

        // Update AI cars
        for (let ai of this.opponents) {
            ai.update(dt, playerPhysics, allCars, raceActive);
        }

        // Resolve Car-to-Car collisions
        this.resolveCarCollisions(allCars);
    }

    resolveCarCollisions(allCars) {
        const minDistance = 2.4; // minimum center-to-center distance before overlapping
        const minDistanceSq = minDistance * minDistance;

        for (let i = 0; i < allCars.length; i++) {
            const carA = allCars[i];
            for (let j = i + 1; j < allCars.length; j++) {
                const carB = allCars[j];

                const delta = new THREE.Vector3().subVectors(carA.position, carB.position);
                delta.y = 0;
                const distSq = delta.lengthSq();

                if (distSq < minDistanceSq && distSq > 0.0001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minDistance - dist;
                    const normal = delta.clone().divideScalar(dist); // points from B to A

                    // Separate cars equally so they don't overlap
                    carA.position.addScaledVector(normal, overlap * 0.52);
                    carB.position.addScaledVector(normal, -overlap * 0.52);

                    // Elastic impulse velocity exchange
                    const velA = carA.forward.clone().multiplyScalar(carA.speed)
                        .addScaledVector(carA.right, carA.lateralSpeed);
                    const velB = carB.forward.clone().multiplyScalar(carB.speed)
                        .addScaledVector(carB.right, carB.lateralSpeed);

                    const relVel = new THREE.Vector3().subVectors(velA, velB);
                    const impulseMag = relVel.dot(normal);

                    if (impulseMag < 0) {
                        const elasticity = 0.5;
                        const impulse = normal.clone().multiplyScalar(-(1 + elasticity) * impulseMag * 0.5);

                        // Clamp speeds safely to prevent runaway velocity
                        carA.speed = Math.max(-15.0, Math.min(carA.topSpeedMps * 1.4, carA.speed));
                        carB.speed = Math.max(-15.0, Math.min(carB.topSpeedMps * 1.4, carB.speed));
                        carA.lateralSpeed = Math.max(-20.0, Math.min(20.0, carA.lateralSpeed));
                        carB.lateralSpeed = Math.max(-20.0, Math.min(20.0, carB.lateralSpeed));

                        // Rate-limited contact sparks and audio (prevents loop/hang)
                        const now = performance.now();
                        if (!this.lastCarCrashTime || now - this.lastCarCrashTime > 180) {
                            this.lastCarCrashTime = now;

                            const contactPt = new THREE.Vector3().addVectors(carA.position, carB.position).multiplyScalar(0.5);
                            contactPt.y += 0.4;
                            if (this.particles) {
                                this.particles.emitSparks(contactPt, 6);
                            }

                            if ((carA.isPlayer || carB.isPlayer) && this.sound) {
                                const impactSpeed = Math.abs(impulseMag);
                                if (impactSpeed > 2.0) {
                                    this.sound.playCrashSound(Math.min(1.0, impactSpeed / 20.0));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    destroy() {
        for (let ai of this.opponents) {
            ai.car3D.destroy();
        }
        this.opponents = [];
    }
}

window.AIManager = AIManager;
window.AICarController = AICarController;
