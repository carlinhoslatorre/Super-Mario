/**
 * Super Mario: Gravity Chaos - COMPLETE REWRITE (STABILITY VERSION)
 * Addresses: Blur, Controls, Overlay Persistence, and Instant Death.
 */

const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    tileDim: 32,
    gravity: 0.5,
    jumpForce: -11, // Slightly softer jump
    walkSpeed: 4.5,
    gravityFlipDuration: 5000,
};

const SPRITE_MAP = {
    hero: {
        idle: { x: 0, y: 0, w: 32, h: 32, frames: 1 },
        walk: { x: 0, y: 0, w: 32, h: 32, frames: 1 }, // Defaulting to first frame if spritesheet fails
        jump: { x: 0, y: 0, w: 32, h: 32, frames: 1 }
    },
    tiles: { floor: 0, brick: 1, box: 2, coin: 3, pipe: 4, spike: 5, star: 6 }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // --- 1. Fix Blur (HiDPI) ---
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.canvasWidth * dpr;
        this.canvas.height = CONFIG.canvasHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;

        this.coins = 0;
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = true;
        this.gravityDir = 1;
        this.isGravityFlipped = false;
        this.gravityFlipTimer = 0;
        this.invincibleTimer = 0;

        this.entities = [];
        this.player = null;
        this.camera = { x: 0, y: 0 };
        this.images = {};
        this.keys = {};

        // Important: Attach event listeners BEFORE loading assets to ensure button works
        this.setupEventListeners();
        this.init();
    }

    async init() {
        try {
            await this.loadAssets();
            this.resetLevel();
            this.gameLoop();
        } catch (e) {
            console.error("Game Init Failed:", e);
            // Fallback: Start even without images
            this.resetLevel();
            this.gameLoop();
        }
    }

    async loadAssets() {
        const assets = {
            'bg': 'assets/bg.png',
            'hero': 'assets/hero.png',
            'tiles': 'assets/tiles.png',
            'enemies': 'assets/enemies.png'
        };

        const promises = Object.entries(assets).map(([name, path]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[name] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load: ${path}. Using color placeholder.`);
                    // Create a 1x1 dummy canvas as fallback
                    const dummy = document.createElement('canvas');
                    dummy.width = dummy.height = 32;
                    this.images[name] = dummy;
                    resolve();
                };
                img.src = path;
            });
        });
        await Promise.all(promises);
    }

    setupEventListeners() {
        // --- 2. Fix Controls ---
        window.addEventListener('keydown', (e) => {
            const monitored = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW'];
            if (monitored.includes(e.code)) {
                e.preventDefault();
                this.keys[e.code] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys[e.code]) this.keys[e.code] = false;
        });

        const startBtn = document.getElementById('start-btn');
        const restartBtn = document.getElementById('restart-btn');

        const startGame = () => {
            console.log("Game Starting...");
            this.isPaused = false;
            this.isGameOver = false;
            this.resetLevel();

            // --- 3. Fix Overlay Persistence ---
            const overlay = document.getElementById('overlay');
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.add('hidden');
            }
            window.focus();
        };

        if (startBtn) startBtn.onclick = startGame;
        if (restartBtn) restartBtn.onclick = startGame;
    }

    resetLevel() {
        this.coins = 0;
        this.score = 0;
        this.gravityDir = 1;
        this.isGravityFlipped = false;
        this.gravityFlipTimer = 0;
        this.invincibleTimer = 180; // 3 seconds safety

        // Stable Base Level Map
        this.map = Array(12).fill(0).map(() => Array(100).fill(0));
        // Fill floor for first 20 blocks
        for (let c = 0; c < 100; c++) {
            this.map[11][c] = 1;
            if (c > 5 && c % 10 === 0) this.map[10][c] = 2; // Some bricks
            if (c > 10 && c % 15 === 0) this.map[7][c] = 3; // Question boxes
        }
        // Add a gravity star
        this.map[8][25] = 7;

        this.player = new Player(100, 300, this);
        this.entities = [
            new Enemy(600, 320, this),
            new Enemy(1200, 320, this)
        ];
        this.updateHUD();
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        if (this.invincibleTimer > 0) {
            this.invincibleTimer--;
            this.player.alpha = (this.invincibleTimer % 20 > 10) ? 0.3 : 0.8;

            // --- 4. Special Anti-Death Check ---
            // If dying while invincible, respawn immediately
            if (this.player.y > 700 || this.player.y < -200) {
                this.player.y = 100;
                this.player.vy = 0;
            }
        } else {
            this.player.alpha = 1.0;
        }

        this.player.update();
        this.entities.forEach(ent => ent.update());

        this.camera.x = Math.round(this.player.x - 300);
        if (this.camera.x < 0) this.camera.x = 0;

        if (this.player.y > 800 || this.player.y < -300) {
            this.gameOver();
        }
    }

    draw() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Draw Sky Background
        if (this.images.bg) {
            const bgX = (-(this.camera.x * 0.2) % 800);
            this.ctx.drawImage(this.images.bg, Math.floor(bgX), 0, 800, 600);
            this.ctx.drawImage(this.images.bg, Math.floor(bgX + 800), 0, 800, 600);
        } else {
            this.ctx.fillStyle = '#5c94fc';
            this.ctx.fillRect(0, 0, 800, 600);
        }

        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        // Draw Map
        for (let r = 0; r < this.map.length; r++) {
            for (let c = 0; c < this.map[r].length; c++) {
                const type = this.map[r][c];
                if (type > 0) {
                    const tx = c * CONFIG.tileDim;
                    const ty = r * CONFIG.tileDim;
                    if (this.images.tiles) {
                        let sx = (type - 1) * 32;
                        if (type === 7) sx = 6 * 32;
                        this.ctx.drawImage(this.images.tiles, sx, 0, 32, 32, tx, ty, 32, 32);
                    } else {
                        this.ctx.fillStyle = type === 1 ? '#8B4513' : '#FFD700';
                        this.ctx.fillRect(tx, ty, 32, 32);
                    }
                }
            }
        }

        this.entities.forEach(ent => ent.draw(this.ctx));
        this.player.draw(this.ctx);

        this.ctx.restore();
    }

    gameOver() {
        if (this.invincibleTimer > 0) return;
        this.isGameOver = true;
        const overlay = document.getElementById('overlay');
        const goScreen = document.getElementById('game-over-screen');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }
        if (goScreen) goScreen.classList.remove('hidden');
        document.getElementById('final-score').innerText = this.score;
    }

    updateHUD() {
        document.getElementById('coin-count').innerText = this.coins.toString().padStart(2, '0');
        document.getElementById('score').innerText = this.score.toString().padStart(6, '0');
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    reverseGravity() {
        this.gravityDir *= -1;
        this.isGravityFlipped = (this.gravityDir === -1);
        document.getElementById('gravity-status').innerText = this.isGravityFlipped ? "CHAOS" : "NORMAL";
    }
}

class Entity {
    constructor(x, y, game) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.w = 30; this.h = 30;
        this.game = game;
    }

    rectIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
    }

    checkCollisions() {
        const collisions = [];
        const startRow = Math.max(0, Math.floor(this.y / 32) - 1);
        const endRow = Math.min(this.game.map.length - 1, Math.ceil((this.y + this.h) / 32) + 1);
        const startCol = Math.max(0, Math.floor(this.x / 32) - 1);
        const endCol = Math.min(this.game.map[0].length - 1, Math.ceil((this.x + this.w) / 32) + 1);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const type = this.game.map[r][c];
                if (type === 1 || type === 2) {
                    collisions.push({ x: c * 32, y: r * 32, w: 32, h: 32 });
                } else if (type === 7 && this === this.game.player) {
                    if (this.rectIntersect({ x: this.x, y: this.y, w: 30, h: 30 }, { x: c * 32, y: r * 32, w: 32, h: 32 })) {
                        this.game.map[r][c] = 0;
                        this.game.reverseGravity();
                    }
                }
            }
        }
        return collisions;
    }

    applyPhysics(blocks) {
        this.y += this.vy;
        blocks.forEach(b => {
            if (this.rectIntersect({ x: this.x, y: this.y, w: this.w, h: this.h }, b)) {
                if (this.vy * this.game.gravityDir > 0) {
                    this.y = this.game.gravityDir === 1 ? b.y - this.h : b.y + b.h;
                    this.vy = 0;
                    this.onGround = true;
                } else {
                    this.y = this.game.gravityDir === 1 ? b.y + b.h : b.y - this.h;
                    this.vy = 0;
                }
            }
        });

        this.x += this.vx;
        blocks.forEach(b => {
            if (this.rectIntersect({ x: this.x, y: this.y, w: this.w, h: this.h }, b)) {
                if (this.vx > 0) this.x = b.x - this.w;
                else this.x = b.x + b.w;
                this.vx = 0;
            }
        });
    }
}

class Player extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.onGround = false;
        this.facing = 1;
        this.state = 'idle';
    }

    update() {
        this.onGround = false;
        let move = 0;
        if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) move = -1;
        else if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) move = 1;

        if (move !== 0) {
            this.vx += move * 0.4;
            this.facing = move;
            this.state = 'walk';
        } else {
            this.vx *= 0.85;
            this.state = 'idle';
        }

        if (Math.abs(this.vx) > CONFIG.walkSpeed) this.vx = CONFIG.walkSpeed * Math.sign(this.vx);
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        if ((this.game.keys['ArrowUp'] || this.game.keys['KeyW'] || this.game.keys['Space']) && this.onGround) {
            this.vy = CONFIG.jumpForce * this.game.gravityDir;
            this.onGround = false;
        }

        this.vy += CONFIG.gravity * this.game.gravityDir;
        const blocks = this.checkCollisions();
        this.applyPhysics(blocks);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha || 1;
        ctx.translate(Math.floor(this.x + 15), Math.floor(this.y + 15));
        if (this.facing === -1) ctx.scale(-1, 1);
        if (this.game.gravityDir === -1) ctx.scale(1, -1);

        if (this.game.images.hero) {
            ctx.drawImage(this.game.images.hero, 0, 0, 32, 32, -16, -16, 32, 32);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-15, -15, 30, 30);
        }
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.vx = -1.5;
    }
    update() {
        this.vy += CONFIG.gravity * this.game.gravityDir;
        const blocks = this.checkCollisions();
        this.applyPhysics(blocks);
        if (this.vx === 0) this.vx = 1.5; // Simple wall bounce

        if (this.rectIntersect({ x: this.x, y: this.y, w: 30, h: 30 }, { x: this.game.player.x, y: this.game.player.y, w: 30, h: 30 })) {
            if (this.game.invincibleTimer === 0) this.game.gameOver();
        }
    }
    draw(ctx) {
        if (this.game.images.enemies) {
            ctx.drawImage(this.game.images.enemies, 0, 0, 32, 32, Math.floor(this.x), Math.floor(this.y), 32, 32);
        } else {
            ctx.fillStyle = 'blue';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 30, 30);
        }
    }
}

window.onload = () => { new Game(); };
