/**
 * Super Mario: Gravity Chaos
 * Core Game Engine
 */

const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    tileDim: 32,
    gravity: 0.6,
    jumpForce: -12,
    walkSpeed: 4,
    gravityFlipDuration: 5000, // 5 seconds
};

// --- Spritesheet Map ---
const SPRITE_MAP = {
    hero: {
        idle: { x: 0, y: 0, w: 32, h: 32, frames: 1 },
        walk: { x: 0, y: 32, w: 32, h: 32, frames: 3 },
        jump: { x: 0, y: 64, w: 32, h: 32, frames: 1 }
    },
    tiles: {
        floor: 0,
        brick: 1,
        box: 2,
        coin: 3,
        pipe: 4,
        spike: 5,
        star: 6
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.coins = 0;
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = true;
        this.gravityDir = 1; // 1 = normal, -1 = inverted
        this.isGravityFlipped = false;
        this.gravityFlipTimer = 0;

        this.entities = [];
        this.player = null;
        this.camera = { x: 0, y: 0 };

        this.images = {};
        this.keys = {};

        this.init();
    }

    async init() {
        await this.loadAssets();
        this.setupEventListeners();
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

        for (const [name, path] of Object.entries(assets)) {
            const img = new Image();
            img.src = path;
            await new Promise(resolve => img.onload = resolve);
            this.images[name] = img;
        }
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        document.getElementById('start-btn').onclick = () => {
            document.getElementById('overlay').classList.add('hidden');
            this.isPaused = false;
        };

        document.getElementById('restart-btn').onclick = () => {
            this.resetLevel();
            document.getElementById('game-over-screen').classList.add('hidden');
            document.getElementById('overlay').classList.add('hidden');
            this.isGameOver = false;
            this.isPaused = false;
        };
    }

    resetLevel() {
        this.coins = 0;
        this.score = 0;
        this.gravityDir = 1;
        this.isGravityFlipped = false;
        this.gravityFlipTimer = 0;
        this.updateHUD();

        // Level Map
        // 0: Empty, 1: Floor, 2: Brick, 3: Box, 4: Coin, 5: Pipe, 6: Spike, 7: Star, 8: Hidden Brick, 9: Falling Floor
        this.map = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 2, 2, 2, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 4, 4, 4, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 9, 9, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0],
            [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 0, 0, 0, 0, 0, 4, 4, 0, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ];

        this.hiddenBlocks = []; // {x, y, revealed}
        this.fallingPlatforms = []; // {x, y, timer}

        this.player = new Player(100, 100, this);
        this.entities = [
            new Enemy(600, 320, this),
            new Enemy(1200, 320, this),
            new Enemy(1800, 300, this)
        ];
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        // Gravity flip timer logic
        if (this.isGravityFlipped) {
            this.gravityFlipTimer -= 16;
            if (this.gravityFlipTimer <= 0) {
                this.reverseGravity();
            }
        }

        // Falling Platforms logic
        this.fallingPlatforms.forEach(p => {
            if (p.triggered) {
                p.timer -= 16;
                if (p.timer <= 0) p.y += 10;
            }
        });

        this.player.update();
        this.entities.forEach(ent => ent.update());

        this.camera.x = Math.max(0, this.player.x - 300);

        // Check for Game Over (falling off)
        if (this.player.y > this.canvas.height + 200 || this.player.y < -200) {
            this.gameOver();
        }
    }

    reverseGravity() {
        this.gravityDir *= -1;
        this.isGravityFlipped = this.gravityDir === -1;
        this.gravityFlipTimer = this.isGravityFlipped ? CONFIG.gravityFlipDuration : 0;
        this.updateHUD();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Background (parallax-ish)
        const bgX = -(this.camera.x * 0.3) % 800;
        this.ctx.drawImage(this.images.bg, bgX, 0);
        this.ctx.drawImage(this.images.bg, bgX + 800, 0);

        // Apply Glitch Effect if Gravity is Flipped
        if (this.isGravityFlipped && Math.random() < 0.1) {
            this.ctx.fillStyle = 'rgba(255, 0, 255, 0.1)';
            this.ctx.fillRect(Math.random() * 800, 0, 50, 600);
        }

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw Map Tiles
        for (let row = 0; row < this.map.length; row++) {
            for (let col = 0; col < this.map[row].length; col++) {
                const tileType = this.map[row][col];
                if (tileType > 0) {
                    if (tileType === 8) { // Hidden Block
                        // Only draw if revealed (we'll check a separate flag later or use a different type)
                        continue;
                    }
                    if (tileType === 9) { // Falling Floor (visual as floor for now)
                        this.drawTile(1, col * CONFIG.tileDim, row * CONFIG.tileDim);
                        continue;
                    }
                    this.drawTile(tileType, col * CONFIG.tileDim, row * CONFIG.tileDim);
                }
            }
        }

        // Draw Entities
        this.entities.forEach(ent => ent.draw(this.ctx));
        this.player.draw(this.ctx);

        this.ctx.restore();
    }

    drawTile(type, x, y) {
        let sx = (type - 1) * CONFIG.tileDim;
        if (type === 7) sx = 6 * CONFIG.tileDim; // Star is index 6
        this.ctx.drawImage(this.images.tiles, sx, 0, CONFIG.tileDim, CONFIG.tileDim, x, y, CONFIG.tileDim, CONFIG.tileDim);
    }

    updateHUD() {
        document.getElementById('coin-count').innerText = this.coins.toString().padStart(2, '0');
        document.getElementById('score').innerText = this.score.toString().padStart(6, '0');
        document.getElementById('gravity-status').innerText = this.isGravityFlipped ? 'CHAOS' : 'NORMAL';
        document.getElementById('gravity-status').style.color = this.isGravityFlipped ? 'var(--accent-color)' : 'var(--text-color)';
    }

    gameOver() {
        this.isGameOver = true;
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('overlay').classList.remove('hidden');
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Entity {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.w = 32;
        this.h = 32;
        this.game = game;
    }

    get collisionRect() {
        return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
    }

    checkCollisions() {
        const floorTiles = [];
        const startRow = Math.max(0, Math.floor(this.y / 32) - 2);
        const endRow = Math.min(this.game.map.length - 1, Math.ceil((this.y + this.h) / 32) + 2);
        const startCol = Math.max(0, Math.floor(this.x / 32) - 2);
        const endCol = Math.min(this.game.map[0].length - 1, Math.ceil((this.x + this.w) / 32) + 2);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const type = this.game.map[r][c];
                const blockRect = { x: c * 32, y: r * 32, w: 32, h: 32 };

                if (type === 1 || type === 2 || type === 3 || type === 5) {
                    floorTiles.push(blockRect);
                } else if (type === 4) { // Coin
                    if (this.rectIntersect(this.collisionRect, blockRect)) {
                        this.game.map[r][c] = 0;
                        this.game.coins++;
                        this.game.score += 100;
                        this.game.updateHUD();
                    }
                } else if (type === 6) { // Spikes
                    if (this.rectIntersect(this.collisionRect, blockRect)) {
                        if (this === this.game.player) this.game.gameOver();
                    }
                } else if (type === 7) { // Gravity Star
                    if (this.rectIntersect(this.collisionRect, blockRect)) {
                        this.game.map[r][c] = 0;
                        this.game.reverseGravity();
                        this.game.score += 500;
                    }
                } else if (type === 8) { // Hidden Block (Troll)
                    // Check if hit from below
                    if (this.rectIntersect(this.collisionRect, blockRect)) {
                        if (this.vy * this.game.gravityDir < 0) {
                            this.game.map[r][c] = 2; // Turn into brick
                            this.game.score += 100;
                            floorTiles.push(blockRect);
                        }
                    }
                } else if (type === 9) { // Falling Floor (Troll)
                    if (this.rectIntersect(this.collisionRect, blockRect)) {
                        floorTiles.push(blockRect);
                        // Trigger fall
                        // (Add logic to handle falling tiles if needed, but for now we'll just treat as floor)
                    }
                }
            }
        }
        return floorTiles;
    }

    rectIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.w ||
            r2.x + r2.w < r1.x ||
            r2.y > r1.y + r1.h ||
            r2.y + r2.h < r1.y);
    }

    applyPhysics(blocks) {
        // Vertical move
        this.y += this.vy;
        blocks.forEach(block => {
            if (this.rectIntersect(this.collisionRect, block)) {
                if (this.vy * this.game.gravityDir > 0) {
                    this.y = this.game.gravityDir === 1 ? block.y - this.h + 4 : block.y + block.h - 4;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy * this.game.gravityDir < 0) {
                    this.y = this.game.gravityDir === 1 ? block.y + block.h - 4 : block.y - this.h + 4;
                    this.vy = 0;
                }
            }
        });

        // Horizontal move
        this.x += this.vx;
        blocks.forEach(block => {
            if (this.rectIntersect(this.collisionRect, block)) {
                if (this.vx > 0) this.x = block.x - this.w + 4;
                else if (this.vx < 0) this.x = block.x + block.w - 4;
                this.vx = 0;
            }
        });
    }
}


class Player extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.onGround = false;
        this.animFrame = 0;
        this.facing = 1; // 1: right, -1: left
        this.state = 'idle';
    }

    update() {
        this.onGround = false;

        // Input
        if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) {
            this.vx = -CONFIG.walkSpeed;
            this.facing = -1;
            this.state = 'walk';
        } else if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) {
            this.vx = CONFIG.walkSpeed;
            this.facing = 1;
            this.state = 'walk';
        } else {
            this.vx *= 0.8;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
            this.state = 'idle';
        }

        if ((this.game.keys['ArrowUp'] || this.game.keys['KeyW'] || this.game.keys['Space']) && this.onGround) {
            this.vy = CONFIG.jumpForce * this.game.gravityDir;
            this.onGround = false;
        }

        // Gravity
        this.vy += CONFIG.gravity * this.game.gravityDir;
        if (Math.abs(this.vy) > 15) this.vy = 15 * Math.sign(this.vy);

        const blocks = this.checkCollisions();
        this.applyPhysics(blocks);

        if (!this.onGround) this.state = 'jump';

        // Animation
        this.animFrame += 0.15;
    }

    draw(ctx) {
        const sprite = SPRITE_MAP.hero[this.state];
        const frame = Math.floor(this.animFrame) % sprite.frames;

        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (this.facing === -1) ctx.scale(-1, 1);
        if (this.game.gravityDir === -1) ctx.scale(1, -1);

        ctx.drawImage(
            this.game.images.hero,
            sprite.x + frame * 32, sprite.y, 32, 32,
            -16, -16, 32, 32
        );
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.vx = -2;
        this.onGround = false;
    }

    update() {
        this.onGround = false;
        this.vy += CONFIG.gravity * this.game.gravityDir;

        const blocks = this.checkCollisions();
        this.applyPhysics(blocks);

        // Turn around at walls or edges
        if (this.vx === 0) this.vx = -this.vx;

        // Kill player on touch
        if (this.rectIntersect(this.collisionRect, this.game.player.collisionRect)) {
            // Check if player is stomping
            const p = this.game.player;
            const stompHeight = this.game.gravityDir === 1 ? p.y + p.h < this.y + 10 : p.y > this.y + this.h - 10;

            if (stompHeight && p.vy * this.game.gravityDir > 0) {
                this.die();
                p.vy = -10 * this.game.gravityDir;
                this.game.score += 200;
            } else {
                this.game.gameOver();
            }
        }
    }

    die() {
        this.game.entities = this.game.entities.filter(e => e !== this);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (this.game.gravityDir === -1) ctx.scale(1, -1);
        ctx.drawImage(this.game.images.enemies, 0, 0, 32, 32, -16, -16, 32, 32);
        ctx.restore();
    }
}

// Start Game
window.onload = () => {
    new Game();
};
