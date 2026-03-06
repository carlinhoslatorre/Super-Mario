/**
 * SUPER MARIO: GRAVITY CHAOS - ZERO-FAILURE VERSION
 * 
 * WHY THIS WORKS:
 * 1. NO EXTERNAL IMAGES: All sprites are drawn via code to avoid CORS/Black Screen errors.
 * 2. NO BORRAMENTO: Integer scaling and pixel-rendering forced.
 * 3. NO OVERLAY: Explicitly removed after click.
 * 4. TRANSPARENCY: No purple squares because we draw pixels directly.
 */

const CONFIG = {
    w: 800,
    h: 600,
    tile: 32,
    gravity: 0.6,
    jump: -12,
    speed: 5
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'game-canvas';
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.w;
        this.canvas.height = CONFIG.h;
        this.ctx.imageSmoothingEnabled = false;

        this.keys = {};
        this.camera = 0;
        this.isPaused = true;
        this.isGameOver = false;
        this.invincible = 0;
        this.score = 0;
        this.coins = 0;

        this.sprites = {};
        this.createSprites();
        this.setupKeys();
        this.reset();

        // Start Loop
        this.loop();

        // Final Fix for Button
        setTimeout(() => {
            const btn = document.getElementById('start-btn');
            if (btn) btn.onclick = () => this.start();
        }, 100);
    }

    createSprites() {
        // --- DRAW MARIO MANUALLY (Pixel by Pixel) ---
        const mario = document.createElement('canvas');
        mario.width = mario.height = 32;
        const mc = mario.getContext('2d');

        // Simple 8-bit Mario Representation
        mc.fillStyle = '#ff0000'; // Hat
        mc.fillRect(8, 2, 16, 4);
        mc.fillStyle = '#ffcc99'; // Face
        mc.fillRect(8, 6, 14, 10);
        mc.fillStyle = '#3333ff'; // Overalls
        mc.fillRect(8, 16, 16, 10);
        mc.fillStyle = '#663300'; // Shoes
        mc.fillRect(8, 26, 6, 4); mc.fillRect(18, 26, 6, 4);
        this.sprites.hero = mario;

        // --- DRAW TILE ---
        const tile = document.createElement('canvas');
        tile.width = tile.height = 32;
        const tc = tile.getContext('2d');
        tc.fillStyle = '#8B4513'; tc.fillRect(0, 0, 32, 32); // Brown
        tc.strokeStyle = '#5D2E0C'; tc.strokeRect(2, 2, 28, 28); // Shadow
        this.sprites.floor = tile;

        // --- DRAW ENEMY ---
        const enemy = document.createElement('canvas');
        enemy.width = enemy.height = 32;
        const ec = enemy.getContext('2d');
        ec.fillStyle = '#800080'; ec.beginPath();
        ec.arc(16, 16, 12, 0, Math.PI * 2); ec.fill(); // Purple Ball
        ec.fillStyle = 'white'; ec.fillRect(10, 10, 4, 4); ec.fillRect(18, 10, 4, 4); // Eyes
        this.sprites.enemy = enemy;
    }

    setupKeys() {
        window.onkeydown = (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space'].includes(e.code)) e.preventDefault();
            this.keys[e.code] = true;
        };
        window.onkeyup = (e) => this.keys[e.code] = false;
    }

    start() {
        this.isPaused = false;
        this.isGameOver = false;
        this.reset();
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.style.display = 'none';
        window.focus();
    }

    reset() {
        this.player = { x: 100, y: 300, vx: 0, vy: 0, w: 24, h: 30, ground: false, facing: 1 };
        this.camera = 0;
        this.invincible = 120;
        this.enemies = [{ x: 800, y: 512, vx: -2 }];

        // Simple Floor
        this.map = [];
        for (let i = 0; i < 100; i++) {
            this.map.push({ x: i * 32, y: 544, w: 32, h: 32 });
        }
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        if (this.invincible > 0) this.invincible--;

        // Input
        let move = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) { move = -1; this.player.facing = -1; }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) { move = 1; this.player.facing = 1; }

        this.player.vx += move * 0.8;
        this.player.vx *= 0.85; // Friction

        if ((this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) && this.player.ground) {
            this.player.vy = CONFIG.jump;
            this.player.ground = false;
        }

        // Gravity
        this.player.vy += CONFIG.gravity;

        // Physics (Simplified)
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;

        // Collision with Floor
        this.player.ground = false;
        this.map.forEach(b => {
            if (this.player.x < b.x + b.w && this.player.x + this.player.w > b.x &&
                this.player.y < b.y + b.h && this.player.y + this.player.h > b.y) {
                if (this.player.vy > 0) {
                    this.player.y = b.y - this.player.h;
                    this.player.vy = 0;
                    this.player.ground = true;
                }
            }
        });

        // Enemies
        this.enemies.forEach(e => {
            e.x += e.vx;
            if (Math.abs(this.player.x - e.x) < 20 && Math.abs(this.player.y - e.y) < 20) {
                if (this.invincible <= 0) this.die();
            }
        });

        // Camera
        this.camera = Math.max(0, this.player.x - 300);

        if (this.player.y > 650) this.die();
    }

    die() {
        this.isGameOver = true;
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('start-screen').classList.remove('hidden');
        }
    }

    draw() {
        // Pixel-Perfect Clear
        this.ctx.fillStyle = '#5c94fc'; // Light Blue
        this.ctx.fillRect(0, 0, CONFIG.w, CONFIG.h);

        this.ctx.save();
        this.ctx.translate(-Math.floor(this.camera), 0);

        // Map
        this.map.forEach(b => {
            this.ctx.drawImage(this.sprites.floor, b.x, b.y);
        });

        // Enemies
        this.enemies.forEach(e => {
            this.ctx.drawImage(this.sprites.enemy, Math.floor(e.x), Math.floor(e.y));
        });

        // Player
        this.ctx.save();
        this.ctx.translate(Math.floor(this.player.x + 12), Math.floor(this.player.y + 15));
        if (this.player.facing === -1) this.ctx.scale(-1, 1);
        if (this.invincible % 10 < 5) {
            this.ctx.drawImage(this.sprites.hero, -16, -16);
        }
        this.ctx.restore();

        this.ctx.restore();

        // HUD
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px monospace';
        this.ctx.fillText(`SCORE: ${this.score}`, 20, 30);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Initializer
window.onload = () => { window.g = new Game(); };
