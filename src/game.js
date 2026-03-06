/**
 * Super Mario: Gravity Chaos - PRO-STABILITY VERSION
 * 
 * FIXES:
 * 1. Image Blur: Integer scaling & pixelated rendering.
 * 2. Controls: Better key handling & focus management.
 * 3. Purple Square: Added a 'Chromakey' filter to remove magenta backgrounds.
 * 4. Overlay: DOM removal to ensure it's gone for good.
 */

const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    tileDim: 32,
    gravity: 0.55,
    jumpForce: -11.5,
    walkSpeed: 5,
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // --- 1. Pixel Perfect Setup ---
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;

        this.coins = 0;
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = true;
        this.gravityDir = 1;
        this.invincibleTimer = 0;

        this.entities = [];
        this.player = null;
        this.camera = { x: 0, y: 0 };
        this.images = {};
        this.keys = {}; // Stores key states (true/false)

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAssets();
        this.resetLevel();
        this.gameLoop();
    }

    async loadAssets() {
        const assets = {
            'bg': 'assets/bg.png',
            'hero': 'assets/hero.png',
            'tiles': 'assets/tiles.png',
            'enemies': 'assets/enemies.png'
        };

        const load = (name, path) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    // --- 2. Chromakey (Remove Purple/Magenta) ---
                    this.images[name] = this.removeBackground(img);
                    resolve();
                };
                img.onerror = () => {
                    this.images[name] = null;
                    resolve();
                };
                img.src = path;
            });
        };

        const promises = Object.entries(assets).map(([name, path]) => load(name, path));
        await Promise.all(promises);
    }

    // Helper to remove #FF00FF (Magenta) background
    removeBackground(img) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const octx = offCanvas.getContext('2d');
        octx.drawImage(img, 0, 0);

        try {
            const imgData = octx.getImageData(0, 0, offCanvas.width, offCanvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Check for Magenta (R:255, G:0, B:255) or similar
                if (data[i] > 200 && data[i + 1] < 50 && data[i + 2] > 200) {
                    data[i + 3] = 0; // Set alpha to 0 (transparent)
                }
            }
            octx.putImageData(imgData, 0, 0);
            return offCanvas;
        } catch (e) {
            return img; // Return original if canvas tainted
        }
    }

    setupEventListeners() {
        // --- 3. Robust Controls ---
        const handleKey = (code, state) => {
            const map = {
                'ArrowLeft': 'left', 'KeyA': 'left',
                'ArrowRight': 'right', 'KeyD': 'right',
                'ArrowUp': 'up', 'KeyW': 'up', 'Space': 'up'
            };
            if (map[code]) this.keys[map[code]] = state;
        };

        window.addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
                e.preventDefault();
            }
            handleKey(e.code, true);
        });

        window.addEventListener('keyup', (e) => {
            handleKey(e.code, false);
        });

        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.onclick = () => this.start();
        }
    }

    start() {
        console.log("Game Start Triggered");
        this.isPaused = false;
        this.isGameOver = false;
        this.resetLevel();

        // --- 4. Force Overlay Removal from DOM ---
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.remove();

        window.focus();
    }

    resetLevel() {
        this.gravityDir = 1;
        this.invincibleTimer = 180;
        this.score = 0;
        this.coins = 0;

        // Build Level
        this.map = Array(12).fill(0).map(() => Array(100).fill(0));
        for (let i = 0; i < 100; i++) {
            this.map[11][i] = 1;
            if (i > 10 && i % 8 === 0) this.map[7][i] = 2; // Some bricks
        }

        this.player = new Player(100, 300, this);
        this.entities = [new Enemy(800, 320, this)];
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        if (this.invincibleTimer > 0) this.invincibleTimer--;

        this.player.update();
        this.entities.forEach(e => e.update());

        this.camera.x = Math.floor(this.player.x - 300);
        if (this.camera.x < 0) this.camera.x = 0;

        if (this.player.y > 600 || this.player.y < -300) {
            this.gameOver();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, 800, 600);

        // Draw Background
        if (this.images.bg) {
            const x = Math.floor(-(this.camera.x * 0.3) % 800);
            this.ctx.drawImage(this.images.bg, x, 0);
            this.ctx.drawImage(this.images.bg, x + 800, 0);
        }

        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        // Draw Map
        for (let r = 0; r < this.map.length; r++) {
            for (let c = 0; c < this.map[r].length; c++) {
                const type = this.map[r][c];
                if (type > 0 && this.images.tiles) {
                    this.ctx.drawImage(this.images.tiles, (type - 1) * 32, 0, 32, 32, c * 32, r * 32, 32, 32);
                } else if (type > 0) {
                    this.ctx.fillStyle = type === 1 ? 'green' : 'brown';
                    this.ctx.fillRect(c * 32, r * 32, 32, 32);
                }
            }
        }

        this.player.draw(this.ctx);
        this.entities.forEach(e => e.draw(this.ctx));

        this.ctx.restore();
    }

    gameOver() {
        if (this.invincibleTimer > 0) return;
        location.reload(); // Hard reset for stability
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Player {
    constructor(x, y, game) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.w = 32; this.h = 32;
        this.game = game;
        this.onGround = false;
        this.facing = 1;
    }

    update() {
        this.onGround = false;

        // Horizontal Movement
        if (this.game.keys['left']) {
            this.vx -= 0.6;
            this.facing = -1;
        } else if (this.game.keys['right']) {
            this.vx += 0.6;
            this.facing = 1;
        } else {
            this.vx *= 0.85;
        }

        // Limit speed
        if (Math.abs(this.vx) > 5) this.vx = 5 * Math.sign(this.vx);

        // Jump
        if (this.game.keys['up'] && this.onGround) {
            this.vy = CONFIG.jumpForce;
            this.onGround = false;
        }

        // Gravity
        this.vy += CONFIG.gravity;

        // Physics
        this.y += this.vy;
        if (this.y > 320) { this.y = 320; this.vy = 0; this.onGround = true; } // Floor collision

        this.x += this.vx;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(Math.floor(this.x + 16), Math.floor(this.y + 16));
        if (this.facing === -1) ctx.scale(-1, 1);

        if (this.game.images.hero) {
            ctx.drawImage(this.game.images.hero, 0, 0, 32, 32, -16, -16, 32, 32);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-16, -16, 32, 32);
        }
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, game) { this.x = x; this.y = y; this.game = game; this.vx = -2; }
    update() {
        this.x += this.vx;
        if (this.x < 0 || this.x > 2000) this.vx *= -1;
    }
    draw(ctx) {
        if (this.game.images.enemies) {
            ctx.drawImage(this.game.images.enemies, 0, 0, 32, 32, Math.floor(this.x), Math.floor(this.y), 32, 32);
        } else {
            ctx.fillStyle = 'blue';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 32, 32);
        }
    }
}

window.onload = () => { new Game(); };
