/**
 * ULTIMATE STREET RACER - Physics & Vehicle Dynamics Engine
 * Handles acceleration, braking, reverse, speed-dependent steering,
 * drift slip dynamics, barrier collisions, car-to-car elastic impacts,
 * and track surface grounding.
 */

class VehiclePhysics {
    constructor(car3D, track3D, particleSystem, soundEngine, isPlayer = true) {
        this.car3D = car3D;
        this.track3D = track3D;
        this.particles = particleSystem;
        this.sound = soundEngine;
        this.isPlayer = isPlayer;

        // Configuration
        this.config = this.car3D.config;
        this.topSpeedMps = (this.config.topSpeedKmh || 220) / 3.6; // convert km/h to m/s
        this.accelRate = this.config.accelRate || 26.0;
        this.brakeRate = this.config.brakeRate || 40.0;
        this.driftGrip = this.config.driftGrip || 0.92;
        this.nitroMultiplier = this.config.nitroMultiplier || 1.25;

        // Performance Tuning Multipliers
        this.tuneSpeed = 1.0;
        this.tuneAccel = 1.0;
        this.tuneHandling = 1.0;
        this.tuneNitro = 1.0;

        // State Vectors
        this.position = new THREE.Vector3();
        this.forward = new THREE.Vector3(0, 0, 1);
        this.right = new THREE.Vector3(1, 0, 0);
        this.up = new THREE.Vector3(0, 1, 0);

        this.speed = 0;          // Linear forward speed (m/s)
        this.lateralSpeed = 0;   // Sideways drift speed (m/s)
        this.heading = 0;        // Radians around Y axis
        this.steerAngle = 0;     // Front wheel angle (-maxSteer to +maxSteer)

        // Visual tilt
        this.bodyRoll = 0;
        this.bodyPitch = 0;

        // Nitro system
        this.nitro = 100;        // 0 to 100%
        this.isBoosting = false;
        this.nitroRechargeRate = 12.0; // % per second
        this.nitroDrainRate = 32.0;    // % per second

        // Drift state
        this.isDrifting = false;
        this.driftScore = 0;

        // Off-road state
        this.isOffTrack = false;

        // Lap & Checkpoint tracking
        this.currentLap = 1;
        this.totalLaps = this.track3D.config.laps || 3;
        this.currentCheckpointIdx = 0;
        this.completedCheckpointsCount = 0;
        this.trackProgress = 0; // Lap + distance fraction for position sorting
        this.isFinished = false;
        this.finishTime = 0;
        this.lapTimes = [0, 0, 0];
        this.currentLapStartTime = 0;
        this.bestLapTime = Infinity;

        // Collision radius
        this.collisionRadius = 1.35;
    }

    applyTuning(tuning) {
        if (!tuning) return;
        if (tuning.speed !== undefined) this.tuneSpeed = tuning.speed;
        if (tuning.accel !== undefined) this.tuneAccel = tuning.accel;
        if (tuning.handling !== undefined) this.tuneHandling = tuning.handling;
        if (tuning.nitro !== undefined) this.tuneNitro = tuning.nitro;
    }

    resetToTrack(checkpointIndex = null) {
        let cpIdx = (checkpointIndex !== null) ? checkpointIndex : this.currentCheckpointIdx;
        if (cpIdx < 0 || cpIdx >= this.track3D.checkpoints.length) {
            cpIdx = 0;
        }

        const cp = this.track3D.checkpoints[cpIdx];
        this.position.copy(cp.pos).add(new THREE.Vector3(0, 0.05, 0));
        this.speed = 0;
        this.lateralSpeed = 0;
        this.bodyRoll = 0;
        this.bodyPitch = 0;
        this.isBoosting = false;
        this.isDrifting = false;

        // Align heading with track tangent
        this.heading = Math.atan2(cp.tangent.x, cp.tangent.z);
        this.updateVectors();
        this.syncCarMesh();
    }

    setStartGridPosition(gridIndex = 0) {
        // Staggered starting grid behind the start/finish line
        const startTan = this.track3D.sampleTangents[0];
        const startBin = this.track3D.sampleBinormals[0];
        const startPt = this.track3D.samplePoints[0];

        // Staggered starting grid: Player starts in clear pole position
        const row = Math.floor(gridIndex / 2);
        const col = gridIndex % 2; // 0 = left, 1 = right
        const lateralOffset = (col === 0 ? -2.8 : 2.8);
        // Player (grid 0) starts ahead; AI opponents start spaced safely behind
        const longitudinalOffset = (gridIndex === 0) ? -2.0 : (-12.0 - row * 10.0);

        this.position.copy(startPt)
            .addScaledVector(startTan, longitudinalOffset)
            .addScaledVector(startBin, lateralOffset);
        this.position.y = startPt.y + 0.05;

        this.heading = Math.atan2(startTan.x, startTan.z);
        this.speed = 0;
        this.lateralSpeed = 0;
        this.currentLap = 1;
        this.currentCheckpointIdx = 0;
        this.completedCheckpointsCount = 0;
        this.trackProgress = 0;
        this.isFinished = false;

        this.updateVectors();
        this.syncCarMesh();
    }

    updateVectors() {
        this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
        this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    }

    update(dt, input, raceActive = true) {
        if (dt > 0.1) dt = 0.1; // clamp delta time for stability

        // 1. INPUT PROCESSING - 100% Manual Player Control
        let throttle = 0;
        let brake = 0;
        let steer = 0;
        let handbrake = false;
        let wantBoost = false;

        if (raceActive && !this.isFinished) {
            if (input.throttle) throttle = 1.0;
            if (input.brake) brake = 1.0;
            // CORRECT STEERING: Left turns towards -X (steer = -1), Right turns towards +X (steer = +1)
            if (input.left) steer -= 1.0;
            if (input.right) steer += 1.0;
            if (input.handbrake) handbrake = true;
            if (input.boost) wantBoost = true;
        }

        // 2. NITRO BOOST
        this.isBoosting = wantBoost && (this.nitro > 1.0) && (throttle > 0) && (this.speed > 5);
        if (this.isBoosting) {
            this.nitro = Math.max(0, this.nitro - this.nitroDrainRate * dt);
        } else {
            // Passive recharge
            this.nitro = Math.min(100, this.nitro + this.nitroRechargeRate * dt);
        }

        // 3. TOP SPEED & ACCELERATION CALCULATION
        let effectiveTopSpeed = this.topSpeedMps * (this.tuneSpeed || 1.0);
        if (this.isBoosting) {
            effectiveTopSpeed *= this.nitroMultiplier;
        }

        // Off-road penalty
        const closestTrack = this.track3D.getClosestTrackPoint(this.position);
        this.isOffTrack = closestTrack.isOffTrack;
        if (this.isOffTrack) {
            effectiveTopSpeed = Math.min(effectiveTopSpeed, 14.0); // max ~50 km/h in dirt
        }

        // Acceleration & Braking Dynamics - Asphalt Style Progression
        if (throttle > 0 && brake === 0) {
            // Smooth torque curve with gentle drop-off near top speed
            const speedRatio = Math.max(0, this.speed / effectiveTopSpeed);
            let accel = this.accelRate * (this.tuneAccel || 1.0) * (1.0 - speedRatio * 0.65);
            if (this.isBoosting) accel *= (1.35 * (this.tuneNitro || 1.0)); // Controlled nitro burst
            if (this.isOffTrack) accel *= 0.45;

            this.speed += accel * throttle * dt;
            if (this.speed > effectiveTopSpeed) {
                this.speed = THREE.MathUtils.lerp(this.speed, effectiveTopSpeed, dt * 2.5);
            }
        } else if (brake > 0) {
            if (this.speed > 0.5) {
                // Firm, responsive braking before corners
                this.speed -= this.brakeRate * brake * dt;
                if (this.speed < 0) this.speed = 0;
            } else {
                // Smooth reverse
                const reverseMaxSpeed = -8.5; // ~30 km/h reverse
                this.speed -= this.accelRate * 0.45 * brake * dt;
                if (this.speed < reverseMaxSpeed) this.speed = reverseMaxSpeed;
            }
        } else {
            // Natural coasting rolling friction
            const dragRate = this.isOffTrack ? 10.0 : 3.5;
            if (this.speed > 0) {
                this.speed = Math.max(0, this.speed - dragRate * dt);
            } else if (this.speed < 0) {
                this.speed = Math.min(0, this.speed + dragRate * dt);
            }
        }

        // 4. SPEED-DEPENDENT STEERING & DRIFTING (ASPHALT STYLE ARCADE HANDLING)
        const speedKmh = Math.abs(this.speed * 3.6);
        // Consistent, intuitive steer factor
        const steerSpeedFactor = Math.max(0.68, 1.0 - (speedKmh / 240) * 0.32);
        const maxSteerAngle = 0.78 * steerSpeedFactor;
        const targetSteerAngle = steer * maxSteerAngle * (this.config.handling || 1.0) * (this.tuneHandling || 1.0);

        this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, dt * 18.0);

        // Asphalt Drifting: engage handbrake or turn hard at speed to initiate powerslide
        const isTurningHard = Math.abs(this.steerAngle) > 0.28 && speedKmh > 30;
        this.isDrifting = (handbrake && speedKmh > 18) || (isTurningHard && handbrake);

        // Turn rate: tight, controlled, responsive
        const minTurnSpeed = Math.min(Math.abs(this.speed), 6.5) * Math.sign(this.speed || 1);
        const turnSpeed = this.speed * 0.9 + minTurnSpeed * 0.5;
        let turnRate = (turnSpeed / 2.0) * Math.tan(this.steerAngle) * 2.0;

        if (this.isDrifting) {
            turnRate *= 1.6; // Sharp drift cornering
            // Drift bonus nitro recharge
            this.nitro = Math.min(100, this.nitro + 24.0 * dt);
        }

        this.heading += turnRate * dt;
        this.updateVectors();

        // Asphalt Lateral Drift Slip: car slides sideways while maintaining forward speed
        if (this.isDrifting) {
            const slipTarget = this.steerAngle * this.speed * (0.85 - this.driftGrip * 0.2);
            this.lateralSpeed = THREE.MathUtils.lerp(this.lateralSpeed, slipTarget, dt * 7.0);
        } else {
            this.lateralSpeed = THREE.MathUtils.lerp(this.lateralSpeed, 0, dt * 14.0 * this.driftGrip);
        }

        // 5. POSITION INTEGRATION
        const velocity = this.forward.clone().multiplyScalar(this.speed)
            .addScaledVector(this.right, this.lateralSpeed);

        this.position.addScaledVector(velocity, dt);

        // Ground clamping to track surface
        this.position.y = THREE.MathUtils.lerp(this.position.y, closestTrack.point.y + 0.05, dt * 12.0);

        // 6. TRACK BARRIER COLLISION
        const halfRoad = this.track3D.roadWidth / 2;
        const curbWidth = this.track3D.curbWidth;
        const barrierLimit = halfRoad + curbWidth - 0.25;

        if (this.barrierCooldown === undefined) this.barrierCooldown = 0;
        this.barrierCooldown = Math.max(0, this.barrierCooldown - dt);

        if (Math.abs(closestTrack.lateralDist) > barrierLimit) {
            const sideSign = closestTrack.lateralDist > 0 ? 1 : -1;

            // Safely clamp position to the boundary on the SAME side
            this.position.copy(closestTrack.point)
                .addScaledVector(closestTrack.binormal, sideSign * barrierLimit);

            // Reflect & dampen lateral speed inward
            this.lateralSpeed = -sideSign * Math.min(4.0, Math.abs(this.lateralSpeed) * 0.4);

            // Friction dampening
            this.speed *= 0.96;

            // Rate-limited audio & particles (prevents loop/hang)
            if (this.barrierCooldown <= 0) {
                this.barrierCooldown = 0.22;
                if (this.sound && this.isPlayer && Math.abs(this.speed) > 4) {
                    this.sound.playCrashSound(Math.min(1.0, Math.abs(this.speed) / 25));
                }
                if (this.particles && Math.abs(this.speed) > 4) {
                    this.particles.emitSparks(this.position, 8);
                }
            }
        }

        // Safety guards against NaN or runaway speed
        if (isNaN(this.speed)) this.speed = 0;
        if (isNaN(this.lateralSpeed)) this.lateralSpeed = 0;
        this.speed = Math.max(-15.0, Math.min(effectiveTopSpeed * 1.5, this.speed));
        this.lateralSpeed = Math.max(-25.0, Math.min(25.0, this.lateralSpeed));

        // 7. SUSPENSION ROLL & PITCH VISUALS
        const targetRoll = -this.steerAngle * (this.speed / 30.0) * 0.12 - (this.lateralSpeed / 20.0) * 0.10;
        this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, targetRoll, dt * 8.0);

        const targetPitch = (throttle > 0 ? -0.04 : (brake > 0 ? 0.06 : 0.0)) * (Math.abs(this.speed) / 25.0);
        this.bodyPitch = THREE.MathUtils.lerp(this.bodyPitch, targetPitch, dt * 8.0);

        // 8. BRAKE LIGHTS
        this.car3D.setBraking(brake > 0 || this.isDrifting);

        // 9. PARTICLE EMISSIONS
        if (this.particles) {
            // Tire smoke on drift or burnouts
            if (this.isDrifting || (throttle > 0 && Math.abs(this.speed) < 5)) {
                const tirePositions = this.car3D.getRearTireWorldPositions();
                for (let pos of tirePositions) {
                    this.particles.emitSmoke(pos, velocity);
                }
            }

            // Nitro blue exhaust flames
            if (this.isBoosting) {
                const exhausts = this.car3D.getExhaustWorldPositions();
                for (let exPos of exhausts) {
                    this.particles.emitNitro(exPos, this.forward, velocity);
                }
            }

            // Off-road dust
            if (this.isOffTrack && Math.abs(this.speed) > 6) {
                const tirePositions = this.car3D.getRearTireWorldPositions();
                for (let pos of tirePositions) {
                    this.particles.emitDust(pos, velocity);
                }
            }
        }

        // 10. AUDIO UPDATE (PLAYER ONLY)
        if (this.sound && this.isPlayer) {
            const rpmNorm = Math.min(1.0, Math.abs(this.speed) / effectiveTopSpeed);
            this.sound.updateEngineSound(rpmNorm, throttle > 0, this.isBoosting);

            const slipAmount = Math.abs(this.lateralSpeed) / 10.0 + (this.isDrifting ? 0.6 : 0);
            this.sound.updateDriftScreech(slipAmount);

            this.sound.updateNitroSound(this.isBoosting);
        }

        // 11. CHECKPOINTS & LAP TRACKING
        this.updateCheckpoints(raceActive);

        // 12. SYNC 3D MESH
        this.syncCarMesh(dt);
    }

    updateCheckpoints(raceActive) {
        if (!raceActive) return;

        const checkpoints = this.track3D.checkpoints;
        const nextCpIdx = (this.currentCheckpointIdx + 1) % checkpoints.length;
        const nextCp = checkpoints[nextCpIdx];

        const distToNextCp = this.position.distanceTo(nextCp.pos);
        if (distToNextCp < nextCp.radius * 1.5) {
            // Checkpoint passed!
            this.currentCheckpointIdx = nextCpIdx;
            this.completedCheckpointsCount++;

            if (this.isPlayer && this.sound) {
                this.sound.playCheckpointChime();
            }

            // Completed a full lap!
            if (nextCpIdx === 0 && this.completedCheckpointsCount >= checkpoints.length) {
                if (this.currentLap < this.totalLaps) {
                    this.currentLap++;
                } else if (!this.isFinished) {
                    this.isFinished = true;
                    if (this.isPlayer && this.sound) {
                        this.sound.playVictoryFanfare();
                    }
                }
            }
        }

        // Calculate continuous race progress for 1st-6th position sorting
        const closest = this.track3D.getClosestTrackPoint(this.position);
        this.trackProgress = (this.currentLap - 1) * this.track3D.trackLength + closest.trackDistance;
    }

    syncCarMesh(dt = 0.016) {
        this.car3D.root.position.copy(this.position);
        this.car3D.root.rotation.set(0, this.heading, 0);

        // Update wheel rotation, front wheel steering pivot, chassis suspension roll/pitch
        this.car3D.updateVisuals(this.speed, this.steerAngle, this.bodyRoll, this.bodyPitch, dt);
    }

    getSpeedKmh() {
        return Math.round(Math.abs(this.speed * 3.6));
    }

    getGear() {
        const kmh = this.getSpeedKmh();
        if (this.speed < -0.5) return 'R';
        if (kmh < 2) return 'N';
        if (kmh < 45) return '1';
        if (kmh < 85) return '2';
        if (kmh < 130) return '3';
        if (kmh < 175) return '4';
        if (kmh < 220) return '5';
        return '6';
    }
}

window.VehiclePhysics = VehiclePhysics;
