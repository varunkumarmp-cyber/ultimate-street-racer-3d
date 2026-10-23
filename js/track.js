/**
 * ULTIMATE STREET RACER - 3D Track & Environment Generator
 * Generates 3 unique circuits (Neon City, Alpine Pass, Desert Canyon) with
 * asphalt ribbons, rumble curbs, barriers, start/finish gantries, checkpoints,
 * and immersive thematic 3D scenery.
 */

const TRACK_CONFIGS = {
    'city': {
        name: 'NEON CITY CIRCUIT',
        description: 'Downtown streets surrounded by glowing skyscrapers, neon signs, and tight chicanes.',
        difficulty: 'Medium',
        laps: 3,
        ambientColor: 0x221c3b,
        dirLightColor: 0x8899ff,
        skyColor: 0x09071a,
        fogColor: 0x110b24,
        fogDensity: 0.0018,
        theme: 'city'
    },
    'alpine': {
        name: 'ALPINE MOUNTAIN PASS',
        description: 'Scenic high-altitude mountain road with winding switchbacks, tunnels, and steep drops.',
        difficulty: 'Hard',
        laps: 3,
        ambientColor: 0x556677,
        dirLightColor: 0xfff0dd,
        skyColor: 0x5599dd,
        fogColor: 0x77aacc,
        fogDensity: 0.0012,
        theme: 'alpine'
    },
    'desert': {
        name: 'DESERT CANYON SPEEDWAY',
        description: 'Blisteringly fast canyon circuit with sweeping banked turns and golden sunset lighting.',
        difficulty: 'Easy',
        laps: 3,
        ambientColor: 0x664433,
        dirLightColor: 0xffaa55,
        skyColor: 0xdd6633,
        fogColor: 0x884422,
        fogDensity: 0.0014,
        theme: 'desert'
    }
};

class Track3D {
    constructor(scene, trackKey = 'city') {
        this.scene = scene;
        this.config = TRACK_CONFIGS[trackKey] || TRACK_CONFIGS['city'];
        this.trackKey = trackKey;

        this.rootGroup = new THREE.Group();
        this.scene.add(this.rootGroup);

        this.roadWidth = 14.0;
        this.barrierWidth = 0.5;
        this.barrierHeight = 1.3;
        this.curbWidth = 1.2;

        this.curve = null;
        this.trackLength = 0;
        this.samplePoints = [];
        this.sampleTangents = [];
        this.sampleNormals = [];
        this.sampleBinormals = [];
        this.numSamples = 400;

        this.checkpoints = []; // Array of checkpoint positions & distances
        this.numCheckpoints = 14;

        this.environmentObjects = [];

        // Build Track
        this.buildSpline();
        this.buildRoadMesh();
        this.buildStartFinishGantry();
        this.buildCheckpoints();
        this.buildEnvironment();
    }

    buildSpline() {
        let rawPoints = [];

        if (this.trackKey === 'city') {
            // High-speed city circuit with chicanes, hairpins, and long straights
            rawPoints = [
                new THREE.Vector3(0, 0, 0),         // Start line
                new THREE.Vector3(0, 0, 120),       // Main straight
                new THREE.Vector3(30, 0, 220),      // Turn 1
                new THREE.Vector3(90, 0, 260),      // Wide curve
                new THREE.Vector3(180, 0, 240),     // Sweep
                new THREE.Vector3(220, 0, 160),     // Chicane entry
                new THREE.Vector3(190, 0, 100),     // Chicane flick
                new THREE.Vector3(230, 0, 20),      // Turn 4
                new THREE.Vector3(260, 0, -80),     // High speed curve
                new THREE.Vector3(240, 0, -180),    // Back straight
                new THREE.Vector3(170, 0, -250),    // Hairpin approach
                new THREE.Vector3(90, 0, -280),     // Hairpin apex
                new THREE.Vector3(10, 0, -230),     // Hairpin exit
                new THREE.Vector3(-30, 0, -140),    // S-curve 1
                new THREE.Vector3(-10, 0, -60)      // Final corner onto main straight
            ];
        } else if (this.trackKey === 'alpine') {
            // Mountain pass with elevation hills and switchbacks
            rawPoints = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 5, 100),
                new THREE.Vector3(-60, 14, 180),
                new THREE.Vector3(-140, 22, 210),
                new THREE.Vector3(-210, 28, 150),
                new THREE.Vector3(-170, 32, 50),
                new THREE.Vector3(-240, 35, -40),
                new THREE.Vector3(-210, 26, -150),
                new THREE.Vector3(-120, 18, -210),
                new THREE.Vector3(-30, 10, -250),
                new THREE.Vector3(60, 4, -190),
                new THREE.Vector3(90, 1, -90),
                new THREE.Vector3(40, 0, -30)
            ];
        } else {
            // Desert Canyon Speedway: fast sweeping banked tri-oval layout
            rawPoints = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, 150),
                new THREE.Vector3(70, 2, 270),
                new THREE.Vector3(180, 5, 300),
                new THREE.Vector3(280, 3, 230),
                new THREE.Vector3(290, 1, 90),
                new THREE.Vector3(240, 0, -60),
                new THREE.Vector3(140, -1, -190),
                new THREE.Vector3(30, 0, -260),
                new THREE.Vector3(-60, 0, -200),
                new THREE.Vector3(-60, 0, -70)
            ];
        }

        this.curve = new THREE.CatmullRomCurve3(rawPoints, true, 'catmullrom', 0.25);
        this.trackLength = this.curve.getLength();

        // Sample points, tangents, and frames
        this.samplePoints = [];
        this.sampleTangents = [];
        this.sampleNormals = [];
        this.sampleBinormals = [];

        for (let i = 0; i <= this.numSamples; i++) {
            const u = i / this.numSamples;
            const pt = this.curve.getPointAt(u);
            const tan = this.curve.getTangentAt(u).normalize();

            // Binormal = tangent x UP vector (0, 1, 0)
            const up = new THREE.Vector3(0, 1, 0);
            const binormal = new THREE.Vector3().crossVectors(tan, up).normalize();
            // Normal = binormal x tangent
            const normal = new THREE.Vector3().crossVectors(binormal, tan).normalize();

            this.samplePoints.push(pt);
            this.sampleTangents.push(tan);
            this.sampleNormals.push(normal);
            this.sampleBinormals.push(binormal);
        }
    }

    createRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Asphalt dark gray
        ctx.fillStyle = '#1c1c20';
        ctx.fillRect(0, 0, 512, 512);

        // Asphalt fine grain noise
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const gray = Math.floor(18 + Math.random() * 24);
            ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
            ctx.fillRect(x, y, 2, 2);
        }

        // Outer white edge lines
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(16, 0, 14, 512);
        ctx.fillRect(512 - 30, 0, 14, 512);

        // Dashed yellow centerline
        ctx.fillStyle = '#ffcc00';
        for (let y = 0; y < 512; y += 64) {
            ctx.fillRect(256 - 6, y + 10, 12, 44);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 35);
        return texture;
    }

    createCurbTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Alternating red and white rumble strips
        for (let y = 0; y < 256; y += 64) {
            ctx.fillStyle = '#ee1122';
            ctx.fillRect(0, y, 128, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, y + 32, 128, 32);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 60);
        return texture;
    }

    createBarrierTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Steel barrier with yellow/black hazard stripes
        ctx.fillStyle = '#555560';
        ctx.fillRect(0, 0, 256, 64);

        ctx.fillStyle = '#e5a50a';
        ctx.fillRect(0, 20, 256, 24);

        ctx.fillStyle = '#111111';
        for (let x = -50; x < 350; x += 36) {
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x + 18, 20);
            ctx.lineTo(x, 44);
            ctx.lineTo(x - 18, 44);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(40, 1);
        return texture;
    }

    buildRoadMesh() {
        const roadTex = this.createRoadTexture();
        const curbTex = this.createCurbTexture();
        const barrierTex = this.createBarrierTexture();

        const roadMat = new THREE.MeshStandardMaterial({
            map: roadTex,
            roughness: 0.85,
            metalness: 0.15
        });

        const curbMat = new THREE.MeshStandardMaterial({
            map: curbTex,
            roughness: 0.6
        });

        const barrierMat = new THREE.MeshStandardMaterial({
            map: barrierTex,
            roughness: 0.5,
            metalness: 0.7
        });

        const halfW = this.roadWidth / 2;
        const curbW = this.curbWidth;
        const barH = this.barrierHeight;

        // Custom geometries for road, curbs, and barriers
        const roadGeo = new THREE.BufferGeometry();
        const curbLGeo = new THREE.BufferGeometry();
        const curbRGeo = new THREE.BufferGeometry();
        const barLGeo = new THREE.BufferGeometry();
        const barRGeo = new THREE.BufferGeometry();

        const roadVerts = [];
        const roadUvs = [];
        const roadIndices = [];

        const curbLVerts = [];
        const curbLUvs = [];
        const curbLIndices = [];

        const curbRVerts = [];
        const curbRUvs = [];
        const curbRIndices = [];

        const barLVerts = [];
        const barLUvs = [];
        const barLIndices = [];

        const barRVerts = [];
        const barRUvs = [];
        const barRIndices = [];

        for (let i = 0; i <= this.numSamples; i++) {
            const pt = this.samplePoints[i];
            const binormal = this.sampleBinormals[i];
            const normal = this.sampleNormals[i];
            const vUv = i / this.numSamples;

            // Road Left and Right
            const roadL = pt.clone().addScaledVector(binormal, -halfW);
            const roadR = pt.clone().addScaledVector(binormal, halfW);

            roadVerts.push(roadL.x, roadL.y + 0.05, roadL.z);
            roadVerts.push(roadR.x, roadR.y + 0.05, roadR.z);
            roadUvs.push(0, vUv);
            roadUvs.push(1, vUv);

            // Curbs
            const curbL_Outer = roadL.clone().addScaledVector(binormal, -curbW).addScaledVector(normal, 0.08);
            curbLVerts.push(curbL_Outer.x, curbL_Outer.y, curbL_Outer.z);
            curbLVerts.push(roadL.x, roadL.y + 0.06, roadL.z);
            curbLUvs.push(0, vUv);
            curbLUvs.push(1, vUv);

            const curbR_Outer = roadR.clone().addScaledVector(binormal, curbW).addScaledVector(normal, 0.08);
            curbRVerts.push(roadR.x, roadR.y + 0.06, roadR.z);
            curbRVerts.push(curbR_Outer.x, curbR_Outer.y, curbR_Outer.z);
            curbRUvs.push(0, vUv);
            curbRUvs.push(1, vUv);

            // Left Barrier Wall
            const barL_Base = curbL_Outer.clone();
            const barL_Top = barL_Base.clone().addScaledVector(normal, barH);
            barLVerts.push(barL_Base.x, barL_Base.y, barL_Base.z);
            barLVerts.push(barL_Top.x, barL_Top.y, barL_Top.z);
            barLUvs.push(vUv * 10, 0);
            barLUvs.push(vUv * 10, 1);

            // Right Barrier Wall
            const barR_Base = curbR_Outer.clone();
            const barR_Top = barR_Base.clone().addScaledVector(normal, barH);
            barRVerts.push(barR_Base.x, barR_Base.y, barR_Base.z);
            barRVerts.push(barR_Top.x, barR_Top.y, barR_Top.z);
            barRUvs.push(vUv * 10, 0);
            barRUvs.push(vUv * 10, 1);

            if (i < this.numSamples) {
                const row = i * 2;
                // Road quad
                roadIndices.push(row, row + 1, row + 2);
                roadIndices.push(row + 1, row + 3, row + 2);

                // Left curb quad
                curbLIndices.push(row, row + 1, row + 2);
                curbLIndices.push(row + 1, row + 3, row + 2);

                // Right curb quad
                curbRIndices.push(row, row + 1, row + 2);
                curbRIndices.push(row + 1, row + 3, row + 2);

                // Left barrier quad
                barLIndices.push(row, row + 2, row + 1);
                barLIndices.push(row + 1, row + 2, row + 3);

                // Right barrier quad
                barRIndices.push(row, row + 1, row + 2);
                barRIndices.push(row + 1, row + 3, row + 2);
            }
        }

        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
        roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
        roadGeo.setIndex(roadIndices);
        roadGeo.computeVertexNormals();

        curbLGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbLVerts, 3));
        curbLGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbLUvs, 2));
        curbLGeo.setIndex(curbLIndices);
        curbLGeo.computeVertexNormals();

        curbRGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbRVerts, 3));
        curbRGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbRUvs, 2));
        curbRGeo.setIndex(curbRIndices);
        curbRGeo.computeVertexNormals();

        barLGeo.setAttribute('position', new THREE.Float32BufferAttribute(barLVerts, 3));
        barLGeo.setAttribute('uv', new THREE.Float32BufferAttribute(barLUvs, 2));
        barLGeo.setIndex(barLIndices);
        barLGeo.computeVertexNormals();

        barRGeo.setAttribute('position', new THREE.Float32BufferAttribute(barRVerts, 3));
        barRGeo.setAttribute('uv', new THREE.Float32BufferAttribute(barRUvs, 2));
        barRGeo.setIndex(barRIndices);
        barRGeo.computeVertexNormals();

        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.receiveShadow = true;
        this.rootGroup.add(roadMesh);

        const curbLMesh = new THREE.Mesh(curbLGeo, curbMat);
        const curbRMesh = new THREE.Mesh(curbRGeo, curbMat);
        this.rootGroup.add(curbLMesh);
        this.rootGroup.add(curbRMesh);

        const barLMesh = new THREE.Mesh(barLGeo, barrierMat);
        const barRMesh = new THREE.Mesh(barRGeo, barrierMat);
        barLMesh.castShadow = true;
        barRMesh.castShadow = true;
        this.rootGroup.add(barLMesh);
        this.rootGroup.add(barRMesh);
    }

    buildStartFinishGantry() {
        const gantryGroup = new THREE.Group();
        const startPt = this.samplePoints[0];
        const startTan = this.sampleTangents[0];
        const startBin = this.sampleBinormals[0];

        gantryGroup.position.copy(startPt);
        gantryGroup.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(startBin.clone().negate(), new THREE.Vector3(0, 1, 0), startTan)
        );

        // Checkered Finish Line Texture on Road
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const sq = 16;
        for (let x = 0; x < 256; x += sq) {
            for (let y = 0; y < 64; y += sq) {
                ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#111111';
                ctx.fillRect(x, y, sq, sq);
            }
        }
        const checkeredTex = new THREE.CanvasTexture(canvas);
        const lineGeo = new THREE.PlaneGeometry(this.roadWidth, 2.5);
        const lineMat = new THREE.MeshStandardMaterial({ map: checkeredTex, roughness: 0.7 });
        const lineMesh = new THREE.Mesh(lineGeo, lineMat);
        lineMesh.rotation.x = -Math.PI / 2;
        lineMesh.position.y = 0.08;
        gantryGroup.add(lineMesh);

        // Overhead Truss Bridge
        const trussMat = new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.8, roughness: 0.3 });
        const postGeo = new THREE.BoxGeometry(0.8, 6.5, 0.8);

        const postL = new THREE.Mesh(postGeo, trussMat);
        postL.position.set(-this.roadWidth / 2 - 1.2, 3.25, 0);
        postL.castShadow = true;

        const postR = new THREE.Mesh(postGeo, trussMat);
        postR.position.set(this.roadWidth / 2 + 1.2, 3.25, 0);
        postR.castShadow = true;

        const crossbarGeo = new THREE.BoxGeometry(this.roadWidth + 3.4, 1.2, 1.4);
        const crossbar = new THREE.Mesh(crossbarGeo, trussMat);
        crossbar.position.set(0, 6.0, 0);
        crossbar.castShadow = true;

        gantryGroup.add(postL);
        gantryGroup.add(postR);
        gantryGroup.add(crossbar);

        // Overhead Digital Banner Sign
        const bannerCanvas = document.createElement('canvas');
        bannerCanvas.width = 512;
        bannerCanvas.height = 128;
        const bCtx = bannerCanvas.getContext('2d');
        bCtx.fillStyle = '#050510';
        bCtx.fillRect(0, 0, 512, 128);
        bCtx.strokeStyle = '#00f5d4';
        bCtx.lineWidth = 6;
        bCtx.strokeRect(4, 4, 504, 120);

        bCtx.fillStyle = '#00f5d4';
        bCtx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
        bCtx.textAlign = 'center';
        bCtx.fillText('START / FINISH', 256, 52);

        bCtx.fillStyle = '#ff0055';
        bCtx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        bCtx.fillText('ULTIMATE STREET RACER', 256, 96);

        const bannerTex = new THREE.CanvasTexture(bannerCanvas);
        const bannerGeo = new THREE.PlaneGeometry(8.5, 2.0);
        const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
        const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
        bannerMesh.position.set(0, 6.0, -0.75);
        bannerMesh.rotation.y = Math.PI;
        gantryGroup.add(bannerMesh);

        this.rootGroup.add(gantryGroup);
    }

    buildCheckpoints() {
        this.checkpoints = [];
        for (let i = 0; i < this.numCheckpoints; i++) {
            const u = i / this.numCheckpoints;
            const pt = this.curve.getPointAt(u);
            const tan = this.curve.getTangentAt(u).normalize();
            const trackDist = u * this.trackLength;

            this.checkpoints.push({
                index: i,
                pos: pt,
                tangent: tan,
                distance: trackDist,
                radius: this.roadWidth * 0.75
            });

            // Visual Checkpoint Arch (subtle glowing archway)
            if (i > 0) {
                const archGeo = new THREE.TorusGeometry(this.roadWidth * 0.55, 0.15, 8, 24, Math.PI);
                const archMat = new THREE.MeshBasicMaterial({
                    color: 0x00f5d4,
                    transparent: true,
                    opacity: 0.35,
                    wireframe: true
                });
                const archMesh = new THREE.Mesh(archGeo, archMat);
                archMesh.position.copy(pt).add(new THREE.Vector3(0, 0.2, 0));
                archMesh.lookAt(pt.clone().add(tan));
                this.rootGroup.add(archMesh);
            }
        }
    }

    buildEnvironment() {
        if (this.trackKey === 'city') {
            this.buildCityScenery();
        } else if (this.trackKey === 'alpine') {
            this.buildAlpineScenery();
        } else {
            this.buildDesertScenery();
        }
    }

    buildCityScenery() {
        // Ground plane
        const groundGeo = new THREE.PlaneGeometry(800, 800);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d0c14, roughness: 0.95 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2;
        ground.receiveShadow = true;
        this.rootGroup.add(ground);

        // Skyscraper building generator
        const bldgColors = [0x151624, 0x1f1d36, 0x131a2e, 0x241d3b];
        const neonColors = [0x00f5d4, 0xff0055, 0x7209b7, 0xfee440, 0x3a86ff];

        const buildingCount = 90;
        for (let i = 0; i < buildingCount; i++) {
            const angle = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.1;
            const dist = 60 + Math.random() * 250;
            const bx = Math.cos(angle) * dist + 80;
            const bz = Math.sin(angle) * dist - 20;

            // Check if too close to road
            const testPt = new THREE.Vector3(bx, 0, bz);
            const closest = this.getClosestTrackPoint(testPt);
            if (closest.distanceToCenter < this.roadWidth * 1.5) continue;

            const bWidth = 18 + Math.random() * 22;
            const bDepth = 18 + Math.random() * 22;
            const bHeight = 45 + Math.random() * 110;

            const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
            const bMat = new THREE.MeshStandardMaterial({
                color: bldgColors[Math.floor(Math.random() * bldgColors.length)],
                roughness: 0.4,
                metalness: 0.6
            });
            const bMesh = new THREE.Mesh(bGeo, bMat);
            bMesh.position.set(bx, bHeight / 2, bz);
            bMesh.castShadow = true;
            bMesh.receiveShadow = true;
            this.rootGroup.add(bMesh);

            // Add Glowing Neon Sign on top of some buildings
            if (Math.random() > 0.5) {
                const signGeo = new THREE.BoxGeometry(bWidth * 0.7, 4.0, 0.8);
                const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
                const signMat = new THREE.MeshBasicMaterial({ color: neonColor });
                const signMesh = new THREE.Mesh(signGeo, signMat);
                signMesh.position.set(bx, bHeight + 2.5, bz);
                this.rootGroup.add(signMesh);
            }
        }

        // Grandstand with Crowd near Start/Finish
        this.buildGrandstand(new THREE.Vector3(-this.roadWidth - 8, 0, 40), 55);
    }

    buildGrandstand(pos, length) {
        const grandstandGroup = new THREE.Group();
        grandstandGroup.position.copy(pos);

        const baseGeo = new THREE.BoxGeometry(10, 6, length);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.7 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(0, 3, 0);
        grandstandGroup.add(base);

        // Roof canopy
        const roofGeo = new THREE.BoxGeometry(14, 0.5, length);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xee2244, roughness: 0.5 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 7.5, 0);
        grandstandGroup.add(roof);

        this.rootGroup.add(grandstandGroup);
    }

    buildAlpineScenery() {
        // Alpine Mountain peaks and pine trees
        const terrainGeo = new THREE.PlaneGeometry(900, 900, 32, 32);
        const posAttr = terrainGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const d = Math.sqrt(vx * vx + vy * vy);
            // Rise up into mountains further out
            if (d > 160) {
                posAttr.setZ(i, (d - 160) * 0.45 + Math.sin(vx * 0.04) * 20);
            }
        }
        terrainGeo.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({ color: 0x2e4a2e, roughness: 0.9 });
        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.y = -0.5;
        this.rootGroup.add(terrain);

        // Pine Trees
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.5, 6);
        const foliageGeo = new THREE.ConeGeometry(2.5, 6.0, 7);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1b432a, roughness: 0.8 });

        for (let i = 0; i < 110; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 260;
            const tx = Math.cos(angle) * dist - 50;
            const tz = Math.sin(angle) * dist;

            const testPt = new THREE.Vector3(tx, 0, tz);
            const closest = this.getClosestTrackPoint(testPt);
            if (closest.distanceToCenter < this.roadWidth * 1.4) continue;

            const treeGroup = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.75;
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 5.2;

            treeGroup.add(trunk);
            treeGroup.add(foliage);
            treeGroup.position.set(tx, 0, tz);
            this.rootGroup.add(treeGroup);
        }
    }

    buildDesertScenery() {
        // Desert sand plane and rock canyon mesas
        const desertGeo = new THREE.PlaneGeometry(900, 900);
        const desertMat = new THREE.MeshStandardMaterial({ color: 0xbd7d4a, roughness: 0.95 });
        const desert = new THREE.Mesh(desertGeo, desertMat);
        desert.rotation.x = -Math.PI / 2;
        desert.position.y = -0.2;
        this.rootGroup.add(desert);

        // Mesa rock formations
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a4522, roughness: 0.9 });
        for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 70 + Math.random() * 260;
            const rx = Math.cos(angle) * dist + 60;
            const rz = Math.sin(angle) * dist;

            const testPt = new THREE.Vector3(rx, 0, rz);
            const closest = this.getClosestTrackPoint(testPt);
            if (closest.distanceToCenter < this.roadWidth * 1.5) continue;

            const mRadius = 15 + Math.random() * 25;
            const mHeight = 20 + Math.random() * 45;
            const mesaGeo = new THREE.CylinderGeometry(mRadius * 0.8, mRadius, mHeight, 9);
            const mesa = new THREE.Mesh(mesaGeo, rockMat);
            mesa.position.set(rx, mHeight / 2, rz);
            this.rootGroup.add(mesa);
        }

        // Cacti
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3d6b38, roughness: 0.85 });
        const cStemGeo = new THREE.CylinderGeometry(0.35, 0.4, 4.5, 6);
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 25 + Math.random() * 180;
            const cx = Math.cos(angle) * dist;
            const cz = Math.sin(angle) * dist;

            const testPt = new THREE.Vector3(cx, 0, cz);
            const closest = this.getClosestTrackPoint(testPt);
            if (closest.distanceToCenter < this.roadWidth * 1.2) continue;

            const cactus = new THREE.Mesh(cStemGeo, cactusMat);
            cactus.position.set(cx, 2.25, cz);
            this.rootGroup.add(cactus);
        }
    }

    /**
     * Finds the closest point on the track spline to any 3D position
     */
    getClosestTrackPoint(pos) {
        let bestDistSq = Infinity;
        let bestIndex = 0;

        for (let i = 0; i < this.numSamples; i++) {
            const pt = this.samplePoints[i];
            const dx = pos.x - pt.x;
            const dz = pos.z - pt.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestIndex = i;
            }
        }

        const centerPt = this.samplePoints[bestIndex];
        const tangent = this.sampleTangents[bestIndex];
        const normal = this.sampleNormals[bestIndex];
        const binormal = this.sampleBinormals[bestIndex];
        const u = bestIndex / this.numSamples;
        const trackDistance = u * this.trackLength;

        // Signed lateral distance from center: positive = right, negative = left
        const toPos = new THREE.Vector3().subVectors(pos, centerPt);
        const lateralDist = toPos.dot(binormal);
        const distanceToCenter = Math.sqrt(bestDistSq);

        return {
            point: centerPt,
            tangent: tangent,
            normal: normal,
            binormal: binormal,
            u: u,
            index: bestIndex,
            distanceToCenter: distanceToCenter,
            lateralDist: lateralDist,
            trackDistance: trackDistance,
            isOffTrack: Math.abs(lateralDist) > (this.roadWidth / 2)
        };
    }

    destroy() {
        if (this.rootGroup && this.rootGroup.parent) {
            this.rootGroup.parent.remove(this.rootGroup);
        }
    }
}

window.Track3D = Track3D;
window.TRACK_CONFIGS = TRACK_CONFIGS;
