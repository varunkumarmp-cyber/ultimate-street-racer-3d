/**
 * ULTIMATE STREET RACER - 3D Car Generator & Entity
 * Procedurally generates detailed 3D sports cars with rotating wheels,
 * steering pivots, dynamic brake lights, exhaust pipes, and suspension tilting.
 */

const CAR_CONFIGS = {
    'apex_gt': {
        name: 'APEX GT',
        type: 'Sports Coupe',
        primaryColor: 0xdd1122, // Crimson Red
        stripeColor: 0xffffff,  // White stripes
        topSpeedKmh: 165,       // Asphalt-style balanced cruising speed
        accelRate: 11.2,        // Smooth 0-100 km/h in ~3.5s
        brakeRate: 24.0,
        handling: 1.05,
        driftGrip: 0.94,
        nitroMultiplier: 1.25,  // Boosts to ~206 km/h
        bodyStyle: 'coupe'
    },
    'viper_v8': {
        name: 'VIPER V8',
        type: 'Muscle Beast',
        primaryColor: 0x18181a, // Matte Black
        stripeColor: 0xffb703,  // Gold Stripes
        topSpeedKmh: 178,       // Highest straight-line top speed
        accelRate: 10.4,        // Punchy V8 torque
        brakeRate: 22.0,
        handling: 0.92,
        driftGrip: 0.88,
        nitroMultiplier: 1.28,  // Boosts to ~228 km/h
        bodyStyle: 'muscle'
    },
    'phantom_r': {
        name: 'PHANTOM R',
        type: 'Hypercar',
        primaryColor: 0x00d2ff, // Electric Cyan
        stripeColor: 0x0d1b2a,  // Carbon Black
        topSpeedKmh: 170,       // Agile hypercar
        accelRate: 12.4,        // Rapid acceleration
        brakeRate: 26.0,
        handling: 1.20,
        driftGrip: 1.02,
        nitroMultiplier: 1.24,  // Boosts to ~210 km/h
        bodyStyle: 'hyper'
    }
};

const AI_CAR_PROFILES = [
    { name: 'Ghost Vance', configKey: 'phantom_r', color: 0x00f5d4, accent: 0x111111, maxSpeedOffset: 1.02, aggro: 0.95 },
    { name: 'Fury Rostova', configKey: 'viper_v8', color: 0xff0055, accent: 0xffffff, maxSpeedOffset: 1.01, aggro: 0.90 },
    { name: 'Kenji Sato', configKey: 'apex_gt', color: 0x2ec4b6, accent: 0x011627, maxSpeedOffset: 0.99, aggro: 0.85 },
    { name: 'Jax Cole', configKey: 'viper_v8', color: 0xff9f1c, accent: 0x000000, maxSpeedOffset: 0.97, aggro: 0.80 },
    { name: 'Nova Chen', configKey: 'apex_gt', color: 0x9d4edd, accent: 0xffffff, maxSpeedOffset: 0.95, aggro: 0.75 }
];

class Car3D {
    constructor(scene, configKey = 'apex_gt', customColors = null) {
        this.scene = scene;
        this.config = Object.assign({}, CAR_CONFIGS[configKey] || CAR_CONFIGS['apex_gt']);

        if (customColors) {
            if (customColors.primary !== undefined) this.config.primaryColor = customColors.primary;
            if (customColors.stripe !== undefined) this.config.stripeColor = customColors.stripe;
        }

        // Hierarchy:
        // rootGroup (positioned at car center on track)
        //   -> bodyGroup (tilts for suspension roll/pitch)
        //        -> chassis, cabin, spoiler, headlights, taillights, exhausts
        //   -> frontLeftWheelPivot (steers & rotates)
        //   -> frontRightWheelPivot (steers & rotates)
        //   -> rearLeftWheel (rotates)
        //   -> rearRightWheel (rotates)
        this.root = new THREE.Group();
        this.bodyGroup = new THREE.Group();
        this.root.add(this.bodyGroup);

        this.wheels = {
            flPivot: null,
            flMesh: null,
            frPivot: null,
            frMesh: null,
            rlMesh: null,
            rrMesh: null
        };

        this.taillightMat = null;
        this.headlightMat = null;
        this.bodyMat = null;
        this.accentMat = null;
        this.glassMat = null;
        this.darkMetalMat = null;
        this.chromeMat = null;
        this.rimMat = null;
        this.caliperMat = null;
        this.underglowMat = null;
        this.underglowPlane = null;
        this.underglowLight = null;
        this.stripeMesh = null;
        this.spoilerGroup = null;

        this.exhaustPositions = []; // Local vectors for particle emission

        // Build procedural geometry
        this.buildCar();

        this.scene.add(this.root);
    }

    buildCar() {
        this.bodyMat = new THREE.MeshStandardMaterial({
            color: this.config.primaryColor,
            metalness: 0.88,
            roughness: 0.18,
            envMapIntensity: 1.0
        });

        this.accentMat = new THREE.MeshStandardMaterial({
            color: this.config.stripeColor,
            metalness: 0.6,
            roughness: 0.28
        });

        this.glassMat = new THREE.MeshStandardMaterial({
            color: 0x111625,
            metalness: 0.95,
            roughness: 0.05,
            transparent: true,
            opacity: 0.78
        });

        this.darkMetalMat = new THREE.MeshStandardMaterial({
            color: 0x161618,
            metalness: 0.85,
            roughness: 0.35
        });

        this.chromeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.98,
            roughness: 0.1
        });

        this.rimMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            metalness: 0.92,
            roughness: 0.18
        });

        this.caliperMat = new THREE.MeshStandardMaterial({
            color: 0xff0022,
            roughness: 0.35,
            metalness: 0.5
        });

        this.headlightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xeeffff,
            emissiveIntensity: 1.2
        });

        this.taillightMat = new THREE.MeshStandardMaterial({
            color: 0xff1122,
            emissive: 0xff0022,
            emissiveIntensity: 0.5
        });

        // 1. CHASSIS / LOWER BODY
        // Sports car dimensions: length ~4.4m, width ~1.9m, height ~1.2m
        const chassisGeo = new THREE.BoxGeometry(1.85, 0.48, 4.3);
        const chassis = new THREE.Mesh(chassisGeo, this.bodyMat);
        chassis.position.y = 0.42;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        this.bodyGroup.add(chassis);

        // Underbody / Diffuser (aerodynamic carbon underside)
        const underbodyGeo = new THREE.BoxGeometry(1.9, 0.12, 4.35);
        const underbody = new THREE.Mesh(underbodyGeo, this.darkMetalMat);
        underbody.position.y = 0.20;
        this.bodyGroup.add(underbody);

        // Racing Stripes along hood and trunk
        const stripeGeo = new THREE.BoxGeometry(0.55, 0.02, 4.25);
        this.stripeMesh = new THREE.Mesh(stripeGeo, this.accentMat);
        this.stripeMesh.position.set(0, 0.67, 0);
        this.bodyGroup.add(this.stripeMesh);

        // 2. CABIN / COCKPIT
        const cabinGeo = new THREE.BoxGeometry(1.42, 0.55, 2.1);
        const cabin = new THREE.Mesh(cabinGeo, this.glassMat);
        cabin.position.set(0, 0.88, -0.2);
        cabin.castShadow = true;
        this.bodyGroup.add(cabin);

        // Cabin Roof Cap
        const roofGeo = new THREE.BoxGeometry(1.36, 0.08, 1.7);
        const roof = new THREE.Mesh(roofGeo, this.bodyMat);
        roof.position.set(0, 1.18, -0.22);
        roof.castShadow = true;
        this.bodyGroup.add(roof);

        // Side Mirrors
        const mirrorGeo = new THREE.BoxGeometry(0.28, 0.12, 0.18);
        const mirrorL = new THREE.Mesh(mirrorGeo, this.darkMetalMat);
        mirrorL.position.set(-0.95, 0.82, 0.55);
        const mirrorR = new THREE.Mesh(mirrorGeo, this.darkMetalMat);
        mirrorR.position.set(0.95, 0.82, 0.55);
        this.bodyGroup.add(mirrorL);
        this.bodyGroup.add(mirrorR);

        // 3. FRONT SPLITTER & HOOD SCOOP
        const splitterGeo = new THREE.BoxGeometry(1.92, 0.08, 0.5);
        const splitter = new THREE.Mesh(splitterGeo, this.darkMetalMat);
        splitter.position.set(0, 0.18, 2.15);
        this.bodyGroup.add(splitter);

        if (this.config.bodyStyle === 'muscle') {
            const scoopGeo = new THREE.BoxGeometry(0.7, 0.18, 0.8);
            const scoop = new THREE.Mesh(scoopGeo, this.darkMetalMat);
            scoop.position.set(0, 0.72, 1.1);
            this.bodyGroup.add(scoop);
        } else if (this.config.bodyStyle === 'hyper') {
            const roofScoopGeo = new THREE.BoxGeometry(0.4, 0.16, 0.7);
            const roofScoop = new THREE.Mesh(roofScoopGeo, this.darkMetalMat);
            roofScoop.position.set(0, 1.26, -0.1);
            this.bodyGroup.add(roofScoop);
        }

        // 4. HEADLIGHTS
        const headlightGeo = new THREE.BoxGeometry(0.38, 0.12, 0.12);
        const headlightL = new THREE.Mesh(headlightGeo, this.headlightMat);
        headlightL.position.set(-0.7, 0.52, 2.15);
        const headlightR = new THREE.Mesh(headlightGeo, this.headlightMat);
        headlightR.position.set(0.7, 0.52, 2.15);
        this.bodyGroup.add(headlightL);
        this.bodyGroup.add(headlightR);

        // 5. TAILLIGHTS (LED Light Strip)
        const taillightGeo = new THREE.BoxGeometry(1.65, 0.10, 0.12);
        const taillights = new THREE.Mesh(taillightGeo, this.taillightMat);
        taillights.position.set(0, 0.55, -2.15);
        this.bodyGroup.add(taillights);

        // 6. REAR SPOILER / WING GROUP (Customizable styles)
        this.spoilerGroup = new THREE.Group();
        this.bodyGroup.add(this.spoilerGroup);
        this.setSpoiler('gt_wing');

        // 7. UNDERGLOW NEON
        const underglowGeo = new THREE.PlaneGeometry(2.1, 4.2);
        this.underglowMat = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        });
        this.underglowPlane = new THREE.Mesh(underglowGeo, this.underglowMat);
        this.underglowPlane.rotation.x = -Math.PI / 2;
        this.underglowPlane.position.y = 0.08;
        this.underglowPlane.visible = false;
        this.root.add(this.underglowPlane);

        this.underglowLight = new THREE.PointLight(0x00f5d4, 0, 5.0);
        this.underglowLight.position.set(0, 0.2, 0);
        this.root.add(this.underglowLight);

        // 7. EXHAUST PIPES
        const exhaustGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12);
        exhaustGeo.rotateX(Math.PI / 2);

        const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustL.position.set(-0.45, 0.26, -2.18);
        const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
        exhaustR.position.set(0.45, 0.26, -2.18);

        this.bodyGroup.add(exhaustL);
        this.bodyGroup.add(exhaustR);

        this.exhaustPositions = [
            new THREE.Vector3(-0.45, 0.26, -2.25),
            new THREE.Vector3(0.45, 0.26, -2.25)
        ];

        // 8. WHEELS & BRAKES
        const wheelRadius = 0.38;
        const wheelWidth = 0.32;
        const halfTrackWidth = 0.95;
        const wheelbaseFront = 1.35;
        const wheelbaseRear = -1.35;

        // Wheel builder helper
        const createWheelMesh = () => {
            const wheelGroup = new THREE.Group();

            // Rubber Tire
            const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
            tireGeo.rotateZ(Math.PI / 2);
            const tireMat = new THREE.MeshStandardMaterial({
                color: 0x151515,
                roughness: 0.85,
                metalness: 0.1
            });
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.castShadow = true;
            wheelGroup.add(tire);

            // Alloy Rim
            const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, wheelWidth * 1.02, 12);
            rimGeo.rotateZ(Math.PI / 2);
            const rim = new THREE.Mesh(rimGeo, this.rimMat);
            wheelGroup.add(rim);

            // Brake Caliper
            const caliperGeo = new THREE.BoxGeometry(0.08, 0.18, 0.14);
            const caliper = new THREE.Mesh(caliperGeo, this.caliperMat);
            caliper.position.set(0, 0.14, 0);
            wheelGroup.add(caliper);

            return wheelGroup;
        };

        // Front Left Wheel Pivot
        this.wheels.flPivot = new THREE.Group();
        this.wheels.flPivot.position.set(-halfTrackWidth, wheelRadius, wheelbaseFront);
        this.wheels.flMesh = createWheelMesh();
        this.wheels.flPivot.add(this.wheels.flMesh);
        this.root.add(this.wheels.flPivot);

        // Front Right Wheel Pivot
        this.wheels.frPivot = new THREE.Group();
        this.wheels.frPivot.position.set(halfTrackWidth, wheelRadius, wheelbaseFront);
        this.wheels.frMesh = createWheelMesh();
        this.wheels.frPivot.add(this.wheels.frMesh);
        this.root.add(this.wheels.frPivot);

        // Rear Left Wheel
        this.wheels.rlMesh = createWheelMesh();
        this.wheels.rlMesh.position.set(-halfTrackWidth, wheelRadius, wheelbaseRear);
        this.root.add(this.wheels.rlMesh);

        // Rear Right Wheel
        this.wheels.rrMesh = createWheelMesh();
        this.wheels.rrMesh.position.set(halfTrackWidth, wheelRadius, wheelbaseRear);
        this.root.add(this.wheels.rrMesh);
    }

    setBraking(isBraking) {
        if (!this.taillightMat) return;
        this.taillightMat.emissiveIntensity = isBraking ? 1.8 : 0.4;
    }

    updateVisuals(speedMps, steerAngle, rollAngle, pitchAngle, dt) {
        // Rotate wheels based on linear speed: distance = speed * dt; angle = distance / radius
        const wheelRadius = 0.38;
        const rotationDelta = (speedMps / wheelRadius) * dt;

        if (this.wheels.flMesh) this.wheels.flMesh.rotation.x += rotationDelta;
        if (this.wheels.frMesh) this.wheels.frMesh.rotation.x += rotationDelta;
        if (this.wheels.rlMesh) this.wheels.rlMesh.rotation.x += rotationDelta;
        if (this.wheels.rrMesh) this.wheels.rrMesh.rotation.x += rotationDelta;

        // Front wheel steering angle pivot
        if (this.wheels.flPivot) this.wheels.flPivot.rotation.y = steerAngle;
        if (this.wheels.frPivot) this.wheels.frPivot.rotation.y = steerAngle;

        // Chassis suspension roll and pitch
        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = rollAngle;
            this.bodyGroup.rotation.x = pitchAngle;
        }
    }

    getExhaustWorldPositions() {
        const result = [];
        for (let i = 0; i < this.exhaustPositions.length; i++) {
            const worldPos = this.exhaustPositions[i].clone();
            worldPos.applyEuler(this.bodyGroup.rotation);
            worldPos.applyQuaternion(this.root.quaternion);
            worldPos.add(this.root.position);
            result.push(worldPos);
        }
        return result;
    }

    getRearTireWorldPositions() {
        const leftTire = new THREE.Vector3(-0.95, 0.1, -1.35);
        leftTire.applyQuaternion(this.root.quaternion);
        leftTire.add(this.root.position);

        const rightTire = new THREE.Vector3(0.95, 0.1, -1.35);
        rightTire.applyQuaternion(this.root.quaternion);
        rightTire.add(this.root.position);

        return [leftTire, rightTire];
    }

    setPaint(colorHex, finish = 'metallic') {
        this.config.primaryColor = colorHex;
        if (this.bodyMat) {
            this.bodyMat.color.setHex(colorHex);
            if (finish === 'metallic') {
                this.bodyMat.metalness = 0.88;
                this.bodyMat.roughness = 0.18;
            } else if (finish === 'gloss') {
                this.bodyMat.metalness = 0.20;
                this.bodyMat.roughness = 0.06;
            } else if (finish === 'matte') {
                this.bodyMat.metalness = 0.08;
                this.bodyMat.roughness = 0.88;
            }
        }
    }

    setStripe(colorHex, visible = true) {
        if (!this.stripeMesh || !this.accentMat) return;
        if (!visible || colorHex === null) {
            this.stripeMesh.visible = false;
        } else {
            this.stripeMesh.visible = true;
            this.config.stripeColor = colorHex;
            this.accentMat.color.setHex(colorHex);
        }
    }

    setRims(colorHex) {
        if (this.rimMat) {
            this.rimMat.color.setHex(colorHex);
        }
    }

    setCalipers(colorHex) {
        if (this.caliperMat) {
            this.caliperMat.color.setHex(colorHex);
        }
    }

    setWindowTint(colorHex, opacity = 0.78) {
        if (this.glassMat) {
            this.glassMat.color.setHex(colorHex);
            this.glassMat.opacity = opacity;
        }
    }

    setUnderglow(colorHexOrNull) {
        if (!this.underglowPlane) return;
        if (!colorHexOrNull || colorHexOrNull === 'off') {
            this.underglowPlane.visible = false;
            if (this.underglowLight) this.underglowLight.intensity = 0;
        } else {
            this.underglowPlane.visible = true;
            const col = (typeof colorHexOrNull === 'string') ? parseInt(colorHexOrNull.replace('#', '0x')) : colorHexOrNull;
            this.underglowMat.color.setHex(col);
            if (this.underglowLight) {
                this.underglowLight.color.setHex(col);
                this.underglowLight.intensity = 2.2;
            }
        }
    }

    setSpoiler(type = 'gt_wing') {
        if (!this.spoilerGroup) return;
        while (this.spoilerGroup.children.length > 0) {
            this.spoilerGroup.remove(this.spoilerGroup.children[0]);
        }

        if (type === 'gt_wing') {
            const wingGeo = new THREE.BoxGeometry(1.9, 0.06, 0.42);
            const wing = new THREE.Mesh(wingGeo, this.darkMetalMat);
            wing.position.set(0, 1.08, -2.05);

            const stGeo = new THREE.BoxGeometry(0.06, 0.48, 0.22);
            const stL = new THREE.Mesh(stGeo, this.darkMetalMat);
            stL.position.set(-0.6, 0.82, -2.0);
            const stR = new THREE.Mesh(stGeo, this.darkMetalMat);
            stR.position.set(0.6, 0.82, -2.0);

            this.spoilerGroup.add(wing);
            this.spoilerGroup.add(stL);
            this.spoilerGroup.add(stR);
        } else if (type === 'ducktail') {
            const lipGeo = new THREE.BoxGeometry(1.7, 0.14, 0.32);
            const lip = new THREE.Mesh(lipGeo, this.accentMat);
            lip.position.set(0, 0.72, -2.08);
            lip.rotation.x = -0.35;
            this.spoilerGroup.add(lip);
        } else if (type === 'shark_fin') {
            const finGeo = new THREE.BoxGeometry(0.06, 0.48, 1.6);
            const fin = new THREE.Mesh(finGeo, this.accentMat);
            fin.position.set(0, 1.10, -1.2);
            this.spoilerGroup.add(fin);
        }
    }

    destroy() {
        if (this.root && this.root.parent) {
            this.root.parent.remove(this.root);
        }
    }
}

window.Car3D = Car3D;
window.CAR_CONFIGS = CAR_CONFIGS;
window.AI_CAR_PROFILES = AI_CAR_PROFILES;
