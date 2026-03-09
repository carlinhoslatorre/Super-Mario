/**
 * SUPER MARIO: GRAVITY CHAOS - DEFINITIVE VERSION
 * includes: Bricks, Q-Blocks, Coins, Mushrooms, Stars, Flowers, Goombas, Koopas.
 */

const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    tileDim: 32,
    gravity: 0.5,
    jumpForce: -11,
    walkSpeed: 4.5,
    invincibleDuration: 10 * 60, // 10 seconds at 60fps
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // HiDPI Support
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

        this.entities = [];
        this.fireballs = [];
        this.items = [];
        this.player = null;
        this.camera = { x: 0, y: 0 };
        this.images = {};
        this.keys = {};

        this.setupEventListeners();
        this.init();
    }

    async init() {
        try {
            await this.loadAssets();
        } catch (e) {
            console.warn("Assets failed to load, using canvas drawing fallback.");
        }
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
        const promises = Object.entries(assets).map(([name, path]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { this.images[name] = img; resolve(); };
                img.onerror = () => { resolve(); };
                img.src = path;
            });
        });
        await Promise.all(promises);
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const monitored = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyF', 'ShiftLeft', 'ShiftRight'];
            if (monitored.includes(e.code)) {
                e.preventDefault();
                this.keys[e.code] = true;
            }
            if (e.code === 'KeyF' || e.code.includes('Shift')) {
                if (this.player && this.player.isFire) this.player.shoot();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys[e.code]) this.keys[e.code] = false;
        });

        const startBtn = document.getElementById('start-btn');
        const restartBtn = document.getElementById('restart-btn');

        const startGame = () => {
            this.isPaused = false;
            this.isGameOver = false;
            this.resetLevel();
            document.getElementById('overlay').classList.add('hidden');
            document.getElementById('game-over-screen').classList.add('hidden');
            window.focus();
        };

        if (startBtn) startBtn.onclick = startGame;
        if (restartBtn) restartBtn.onclick = startGame;
    }

    resetLevel() {
        this.coins = 0;
        this.score = 0;
        this.gravityDir = 1;
        this.entities = [];
        this.fireballs = [];
        this.items = [];
        this.camera = { x: 0, y: 0 };

        // 0=Empty, 1=Floor, 2=Brick, 3=Q-Coin, 4=Q-Mushroom/Flower, 5=Q-Star, 6=Used-Block, 7=Gravity-Star, 8=Pipe
        this.map = Array(15).fill(0).map(() => Array(200).fill(0));

        // Fill base floor
        for (let c = 0; c < 200; c++) {
            this.map[14][c] = 1;
            this.map[13][c] = 1;

            // Add platforms and blocks
            if (c > 10 && c % 12 === 0) {
                this.map[9][c] = 2;
                this.map[9][c + 1] = 4; // Mushroom/Flower
                this.map[9][c + 2] = 2;
            }
            if (c > 20 && c % 15 === 0) {
                this.map[10][c] = 3; // Coin box
                this.map[10][c + 1] = 3;
            }
            if (c === 40) this.map[9][c] = 5; // Star box
            if (c === 60) this.map[9][c] = 7; // Gravity star

            // Random Goombas
            if (c > 15 && c % 20 === 0) {
                this.entities.push(new Goomba(c * 32, 384, this));
            }
            // Random Koopas
            if (c > 25 && c % 30 === 0) {
                this.entities.push(new Koopa(c * 32, 384, this));
            }
        }

        this.player = new Player(100, 300, this);
        this.updateHUD();
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        this.player.update();

        this.entities.forEach((ent, i) => {
            ent.update();
            if (ent.dead) this.entities.splice(i, 1);
        });

        this.fireballs.forEach((fb, i) => {
            fb.update();
            if (fb.dead) this.fireballs.splice(i, 1);
        });

        this.items.forEach((it, i) => {
            it.update();
            if (it.dead) this.items.splice(i, 1);
        });

        // Camera follow
        this.camera.x = Math.round(this.player.x - 300);
        if (this.camera.x < 0) this.camera.x = 0;

        if (this.player.y > 800 || this.player.y < -300) {
            this.gameOver();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Sky background
        this.ctx.fillStyle = '#5c94fc';
        this.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        // Draw Map
        const startCol = Math.floor(this.camera.x / 32);
        const endCol = startCol + 26;
        for (let r = 0; r < this.map.length; r++) {
            for (let c = startCol; c < endCol && c < this.map[r].length; c++) {
                const type = this.map[r][c];
                if (type > 0) {
                    this.drawTile(type, c * 32, r * 32);
                }
            }
        }

        this.items.forEach(it => it.draw(this.ctx));
        this.entities.forEach(ent => ent.draw(this.ctx));
        this.fireballs.forEach(fb => fb.draw(this.ctx));
        this.player.draw(this.ctx);

        this.ctx.restore();
    }

    drawTile(type, x, y) {
        if (this.images.tiles) {
            let sx = 0;
            switch (type) {
                case 1: sx = 0; break; // Floor
                case 2: sx = 32; break; // Brick
                case 3: case 4: case 5: sx = 64; break; // QBox
                case 6: sx = 96; break; // Used
                case 7: sx = 128; break; // Gravity Star
                case 8: sx = 160; break; // Pipe
            }
            this.ctx.drawImage(this.images.tiles, sx, 0, 32, 32, x, y, 32, 32);
        } else {
            // Fallback drawing
            switch (type) {
                case 1: this.ctx.fillStyle = '#8B4513'; break;
                case 2: this.ctx.fillStyle = '#A52A2A'; break;
                case 3: case 4: case 5: this.ctx.fillStyle = '#FFD700'; break;
                case 6: this.ctx.fillStyle = '#777'; break;
                case 7: this.ctx.fillStyle = '#fff'; break;
                default: this.ctx.fillStyle = '#000';
            }
            this.ctx.fillRect(x, y, 32, 32);
            this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            this.ctx.strokeRect(x, y, 32, 32);
            if (type >= 3 && type <= 5) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '20px serif';
                this.ctx.fillText('?', x + 10, y + 24);
            }
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('final-score').innerText = this.score;
    }

    updateHUD() {
        document.getElementById('coin-count').innerText = this.coins.toString().padStart(2, '0');
        document.getElementById('score').innerText = this.score.toString().padStart(6, '0');
        document.getElementById('gravity-status').innerText = this.gravityDir === 1 ? "NORMAL" : "CHAOS";
    }

    hitBlock(r, c) {
        const type = this.map[r][c];
        if (type === 2) { // Brick
            if (this.player.isBig || this.player.isFire) {
                this.map[r][c] = 0;
                this.score += 50;
            } else {
                // Just bounce
            }
        } else if (type >= 3 && type <= 5) { // QBox
            this.spawnItemFromBlock(r, c, type);
            this.map[r][c] = 6; // Become used
        }
    }

    spawnItemFromBlock(r, c, type) {
        const x = c * 32;
        const y = r * 32;
        if (type === 3) { // Coin
            this.coins++;
            this.score += 100;
            if (this.coins >= 100) this.coins = 0;
            this.updateHUD();
        } else if (type === 4) { // Mushroom or Flower
            const itType = (this.player.isBig || this.player.isFire) ? 'flower' : 'mushroom';
            this.items.push(new PowerUp(x, y - 32, itType, this));
        } else if (type === 5) { // Star
            this.items.push(new PowerUp(x, y - 32, 'star', this));
        }
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Entity {
    constructor(x, y, game) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.w = 30; this.h = 30;
        this.game = game;
        this.dead = false;
        this.onGround = false;
    }

    rectIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
    }

    checkCollisions() {
        const blocks = [];
        const startRow = Math.max(0, Math.floor(this.y / 32) - 2);
        const endRow = Math.min(this.game.map.length - 1, Math.ceil((this.y + this.h) / 32) + 2);
        const startCol = Math.max(0, Math.floor(this.x / 32) - 1);
        const endCol = Math.min(this.game.map[0].length - 1, Math.ceil((this.x + this.w) / 32) + 1);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const type = this.game.map[r][c];
                if (type >= 1 && type <= 7 && type !== 7) { // Solid tiles
                    blocks.push({ x: c * 32, y: r * 32, w: 32, h: 32, r, c });
                } else if (type === 7 && this === this.game.player) {
                    if (this.rectIntersect(this, { x: c * 32, y: r * 32, w: 32, h: 32 })) {
                        this.game.map[r][c] = 0;
                        this.game.gravityDir *= -1;
                        this.game.updateHUD();
                    }
                }
            }
        }
        return blocks;
    }

    applyPhysics() {
        const blocks = this.checkCollisions();

        // Vertical
        this.y += this.vy;
        this.onGround = false;
        blocks.forEach(b => {
            if (this.rectIntersect(this, b)) {
                if (this.vy * this.game.gravityDir > 0) { // Falling onto block
                    this.y = this.game.gravityDir === 1 ? b.y - this.h : b.y + b.h;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy * this.game.gravityDir < 0) { // Hitting head
                    this.y = this.game.gravityDir === 1 ? b.y + b.h : b.y - this.h;
                    this.vy = 0.5 * this.game.gravityDir;
                    if (this === this.game.player) this.game.hitBlock(b.r, b.c);
                }
            }
        });

        // Horizontal
        this.x += this.vx;
        blocks.forEach(b => {
            if (this.rectIntersect(this, b)) {
                if (this.vx > 0) this.x = b.x - this.w;
                else if (this.vx < 0) this.x = b.x + b.w;
                this.vx *= -0.5; // Slight bounce or stop
                if (this.onCollisionWall) this.onCollisionWall();
            }
        });
    }
}

class Player extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.w = 24; this.h = 32;
        this.facing = 1;
        this.isBig = false;
        this.isFire = false;
        this.invincibleTimer = 0;
        this.flicker = 0;
    }

    update() {
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        let move = 0;
        if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) move = -1;
        else if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) move = 1;

        if (move !== 0) {
            this.vx += move * 0.5;
            this.facing = move;
        } else {
            this.vx *= 0.8;
        }

        if (Math.abs(this.vx) > CONFIG.walkSpeed) this.vx = CONFIG.walkSpeed * Math.sign(this.vx);

        if ((this.game.keys['ArrowUp'] || this.game.keys['KeyW'] || this.game.keys['Space']) && this.onGround) {
            this.vy = CONFIG.jumpForce * this.game.gravityDir;
            this.onGround = false;
        }

        this.vy += CONFIG.gravity * this.game.gravityDir;
        this.applyPhysics();

        // Check contact with enemies
        this.game.entities.forEach(ent => {
            if (!ent.dead && this.rectIntersect(this, ent)) {
                if (this.invincibleTimer > 600) { // Star power
                    ent.die();
                    this.game.score += 200;
                } else if (this.vy * this.game.gravityDir > 0 && this.y * this.game.gravityDir < ent.y * this.game.gravityDir) {
                    // Stomp
                    if (ent instanceof Koopa && ent.state === 'WALKING') {
                        ent.state = 'SHELL';
                        ent.vx = 0;
                    } else if (ent instanceof Koopa && ent.state === 'SHELL' && ent.vx === 0) {
                        ent.vx = 8 * this.facing;
                    } else {
                        ent.die();
                    }
                    this.vy = -8 * this.game.gravityDir;
                    this.game.score += 100;
                } else if (this.invincibleTimer === 0) {
                    this.takeDamage();
                }
            }
        });
    }

    takeDamage() {
        if (this.isFire || this.isBig) {
            this.isFire = false;
            this.isBig = false;
            this.h = 32;
            this.invincibleTimer = 120; // 2 seconds safety
        } else {
            this.game.gameOver();
        }
    }

    shoot() {
        if (this.game.fireballs.length < 2) {
            this.game.fireballs.push(new Fireball(this.x + 10, this.y + 10, this.facing, this.game));
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) ctx.globalAlpha = 0.5;

        // Star effect
        if (this.invincibleTimer > 600) {
            const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];
            ctx.shadowBlur = 10;
            ctx.shadowColor = colors[Math.floor(Date.now() / 100) % colors.length];
        }

        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (this.facing === -1) ctx.scale(-1, 1);
        if (this.game.gravityDir === -1) ctx.scale(1, -1);

        if (this.game.images.hero) {
            let sy = 0;
            if (this.isFire) sy = 64;
            else if (this.isBig) sy = 32;
            ctx.drawImage(this.game.images.hero, 0, sy, 32, 32, -16, -16, 32, 32);
        } else {
            ctx.fillStyle = this.isFire ? 'white' : (this.isBig ? 'red' : 'orange');
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            // Draw eyes to make it look alive
            ctx.fillStyle = 'black';
            ctx.fillRect(4, -10, 4, 4);
        }
        ctx.restore();
    }
}

class Goomba extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.vx = -1.5;
    }
    update() {
        this.vy += CONFIG.gravity * this.game.gravityDir;
        this.applyPhysics();
    }
    onCollisionWall() { this.vx *= -1; }
    die() { this.dead = true; }
    draw(ctx) {
        if (this.game.images.enemies) {
            ctx.drawImage(this.game.images.enemies, 0, 0, 32, 32, this.x, this.y, 32, 32);
        } else {
            ctx.fillStyle = 'brown';
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y + 15, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
            ctx.fillRect(this.x + 20, this.y + 5, 5, 5);
        }
    }
}

class Koopa extends Entity {
    constructor(x, y, game) {
        super(x, y, game);
        this.vx = -1.2;
        this.state = 'WALKING'; // WALKING, SHELL
    }
    update() {
        this.vy += CONFIG.gravity * this.game.gravityDir;
        this.applyPhysics();

        // Shell logic: kill enemies
        if (this.state === 'SHELL' && Math.abs(this.vx) > 1) {
            this.game.entities.forEach(ent => {
                if (ent !== this && !ent.dead && this.rectIntersect(this, ent)) {
                    ent.die();
                    this.game.score += 500;
                }
            });
        }
    }
    onCollisionWall() { this.vx *= -1; }
    die() { this.dead = true; }
    draw(ctx) {
        if (this.game.images.enemies) {
            let sx = (this.state === 'WALKING') ? 32 : 64;
            ctx.drawImage(this.game.images.enemies, sx, 0, 32, 32, this.x, this.y, 32, 32);
        } else {
            ctx.fillStyle = this.state === 'WALKING' ? 'green' : 'red';
            ctx.fillRect(this.x, this.y + 10, 30, 20);
            if (this.state === 'WALKING') {
                ctx.fillStyle = 'yellow';
                ctx.fillRect(this.x + 10, this.y, 10, 15);
            }
        }
    }
}

class PowerUp extends Entity {
    constructor(x, y, type, game) {
        super(x, y, game);
        this.type = type;
        this.vx = (type === 'flower') ? 0 : 2;
    }
    update() {
        if (this.type !== 'flower') {
            this.vy += CONFIG.gravity * this.game.gravityDir;
            if (this.type === 'star' && this.onGround) this.vy = -5 * this.game.gravityDir;
            this.applyPhysics();
        }

        if (this.rectIntersect(this, this.game.player)) {
            this.collect();
        }
    }
    onCollisionWall() { this.vx *= -1; }
    collect() {
        const p = this.game.player;
        if (this.type === 'mushroom') {
            if (!p.isBig) { p.isBig = true; p.h = 48; p.y -= 16; }
        } else if (this.type === 'flower') {
            p.isBig = true; p.isFire = true; p.h = 48;
        } else if (this.type === 'star') {
            p.invincibleTimer = 900; // 15 seconds
        }
        this.dead = true;
        this.game.score += 1000;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'mushroom' ? 'red' : (this.type === 'flower' ? 'white' : 'yellow');
        ctx.beginPath();
        ctx.arc(this.x + 16, this.y + 16, 12, 0, Math.PI * 2);
        ctx.fill();
        if (this.type === 'flower') {
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

class Fireball extends Entity {
    constructor(x, y, dir, game) {
        super(x, y, game);
        this.vx = dir * 7;
        this.w = 12; this.h = 12;
    }
    update() {
        this.vy += CONFIG.gravity * this.game.gravityDir;
        this.applyPhysics();
        if (this.onGround) this.vy = -4 * this.game.gravityDir;

        this.game.entities.forEach(ent => {
            if (!ent.dead && this.rectIntersect(this, ent)) {
                ent.die();
                this.dead = true;
                this.game.score += 200;
            }
        });
        if (Math.abs(this.vx) < 1) this.dead = true;
    }
    draw(ctx) {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(this.x + 6, this.y + 6, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

window.onload = () => { new Game(); };
