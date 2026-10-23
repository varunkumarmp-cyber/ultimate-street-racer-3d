/**
 * ULTIMATE STREET RACER - Particle System
 * High performance particle engine for tire smoke, nitro exhaust flames,
 * collision sparks, and off-road dust.
 */

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;

        // Particle Pools
        this.maxParticles = 600;
        this.particles = [];
        this.activeCount = 0;

        // Shared Geometry and Materials
        this.initParticleMeshes();
    }

    createCircleTexture(color = '#ffffff', glow = true) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        if (glow) {
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(0.3, color);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
            grad.addColorStop(0, color);
            grad.addColorStop(0.7, color);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    initParticleMeshes() {
        // Textures
        this.smokeTexture = this.createCircleTexture('rgba(200, 205, 215, 0.8)', false);
        this.nitroTexture = this.createCircleTexture('#00ffff', true);
        this.sparkTexture = this.createCircleTexture('#ffaa00', true);
        this.dustTexture = this.createCircleTexture('rgba(160, 130, 90, 0.7)', false);

        // Materials
        this.smokeMat = new THREE.SpriteMaterial({
            map: this.smokeTexture,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        this.nitroMat = new THREE.SpriteMaterial({
            map: this.nitroTexture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.sparkMat = new THREE.SpriteMaterial({
            map: this.sparkTexture,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.dustMat = new THREE.SpriteMaterial({
            map: this.dustTexture,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        // Circular ring-buffer pointer for O(1) instant allocation
        this.poolIndex = 0;

        // Pre-create pooled sprites
        for (let i = 0; i < this.maxParticles; i++) {
            const sprite = new THREE.Sprite(this.smokeMat.clone());
            sprite.visible = false;
            this.scene.add(sprite);

            this.particles.push({
                sprite: sprite,
                active: false,
                type: 'smoke',
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                scale: 1.0,
                maxScale: 2.5,
                opacity: 1.0,
                maxLife: 1.0,
                life: 0,
                gravity: 0
            });
        }
    }

    getFreeParticle() {
        // O(1) circular ring buffer allocation - instant and zero lag
        const p = this.particles[this.poolIndex];
        this.poolIndex = (this.poolIndex + 1) % this.maxParticles;
        return p;
    }

    emitSmoke(pos, carVel) {
        const p = this.getFreeParticle();
        p.active = true;
        p.type = 'smoke';
        p.sprite.material = this.smokeMat.clone();
        p.sprite.visible = true;

        p.pos.copy(pos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            0.1 + Math.random() * 0.1,
            (Math.random() - 0.5) * 0.4
        ));
        p.sprite.position.copy(p.pos);

        // Soft upward & expanding drift
        p.vel.set(
            (Math.random() - 0.5) * 0.8 + carVel.x * 0.1,
            0.6 + Math.random() * 0.8,
            (Math.random() - 0.5) * 0.8 + carVel.z * 0.1
        );

        p.scale = 0.5 + Math.random() * 0.3;
        p.maxScale = 2.2 + Math.random() * 1.0;
        p.sprite.scale.set(p.scale, p.scale, 1);

        p.maxLife = 0.7 + Math.random() * 0.4;
        p.life = p.maxLife;
        p.opacity = 0.5;
        p.gravity = -0.2; // Rises slightly
    }

    emitNitro(pos, carDir, carVel) {
        const p = this.getFreeParticle();
        p.active = true;
        p.type = 'nitro';
        p.sprite.material = this.nitroMat.clone();
        p.sprite.visible = true;

        p.pos.copy(pos);
        p.sprite.position.copy(p.pos);

        // Blast backwards relative to car direction
        const blastSpeed = 8.0 + Math.random() * 4.0;
        p.vel.set(
            -carDir.x * blastSpeed + (Math.random() - 0.5) * 1.5,
            -carDir.y * blastSpeed + (Math.random() - 0.5) * 0.5,
            -carDir.z * blastSpeed + (Math.random() - 0.5) * 1.5
        ).addScaledVector(carVel, 0.4);

        p.scale = 0.8 + Math.random() * 0.4;
        p.maxScale = 0.2; // Shrinks down
        p.sprite.scale.set(p.scale, p.scale, 1);

        p.maxLife = 0.2 + Math.random() * 0.15;
        p.life = p.maxLife;
        p.opacity = 1.0;
        p.gravity = 0;
    }

    emitSparks(pos, count = 15) {
        for (let i = 0; i < count; i++) {
            const p = this.getFreeParticle();
            p.active = true;
            p.type = 'spark';
            p.sprite.material = this.sparkMat.clone();
            p.sprite.visible = true;

            p.pos.copy(pos);
            p.sprite.position.copy(p.pos);

            const speed = 4.0 + Math.random() * 8.0;
            p.vel.set(
                (Math.random() - 0.5) * speed,
                Math.random() * speed * 0.8 + 2.0,
                (Math.random() - 0.5) * speed
            );

            p.scale = 0.25 + Math.random() * 0.2;
            p.maxScale = 0.05;
            p.sprite.scale.set(p.scale, p.scale, 1);

            p.maxLife = 0.35 + Math.random() * 0.3;
            p.life = p.maxLife;
            p.opacity = 1.0;
            p.gravity = 9.8; // Falls down
        }
    }

    emitDust(pos, carVel) {
        const p = this.getFreeParticle();
        p.active = true;
        p.type = 'dust';
        p.sprite.material = this.dustMat.clone();
        p.sprite.visible = true;

        p.pos.copy(pos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            0.15,
            (Math.random() - 0.5) * 0.5
        ));
        p.sprite.position.copy(p.pos);

        p.vel.set(
            (Math.random() - 0.5) * 1.2 + carVel.x * 0.15,
            0.8 + Math.random() * 0.5,
            (Math.random() - 0.5) * 1.2 + carVel.z * 0.15
        );

        p.scale = 0.6 + Math.random() * 0.4;
        p.maxScale = 2.0;
        p.sprite.scale.set(p.scale, p.scale, 1);

        p.maxLife = 0.5 + Math.random() * 0.3;
        p.life = p.maxLife;
        p.opacity = 0.6;
        p.gravity = 0.3;
    }

    update(dt) {
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
                continue;
            }

            const lifeProgress = 1.0 - (p.life / p.maxLife); // 0.0 to 1.0

            // Apply gravity/velocity
            p.vel.y -= p.gravity * dt;
            p.pos.addScaledVector(p.vel, dt);
            p.sprite.position.copy(p.pos);

            // Scale & Fade based on type
            if (p.type === 'smoke' || p.type === 'dust') {
                const curScale = THREE.MathUtils.lerp(p.scale, p.maxScale, lifeProgress);
                p.sprite.scale.set(curScale, curScale, 1);
                p.sprite.material.opacity = p.opacity * (1.0 - lifeProgress);
            } else if (p.type === 'nitro') {
                const curScale = THREE.MathUtils.lerp(p.scale, p.maxScale, lifeProgress);
                p.sprite.scale.set(curScale, curScale, 1);
                p.sprite.material.opacity = p.opacity * (1.0 - lifeProgress * 0.8);
            } else if (p.type === 'spark') {
                const curScale = THREE.MathUtils.lerp(p.scale, p.maxScale, lifeProgress);
                p.sprite.scale.set(curScale, curScale, 1);
                p.sprite.material.opacity = p.opacity * (1.0 - lifeProgress);
            }
        }
    }

    clear() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles[i].active = false;
            this.particles[i].sprite.visible = false;
        }
    }
}

window.ParticleSystem = ParticleSystem;
