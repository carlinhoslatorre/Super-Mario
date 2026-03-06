/**
 * SUPER MARIO: GRAVITY CHAOS - ADVANCED MECHANICS VERSION
 * 
 * FEATURES:
 * - Lives System (Starts with 3)
 * - Power-up: Super Mushroom (Grow, break bricks, hit protection)
 * - 1UP Mushroom: Green mushroom for extra lives
 * - Coin System: 100 coins = 1 UP
 * - Interactive Blocks: Bricks (breakable when big) and "?" Blocks (contain coins/mushrooms)
 * - Secret Blocks: Invisible until hit
 */

const CONFIG = {
    w: 800,
    h: 600,
    tile: 32,
    gravity: 0.6,
    jump: -12,
    speed: 5,
    safePeriod: 180 // 3 seconds of absolute safety at start
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

        // Stats
        this.score = 0;
        this.coins = 0;
        this.lives = 3;

        this.sprites = {};
        this.createSprites();
        this.setupKeys();
        this.reset();

        this.loop();

        setTimeout(() => {
            const btn = document.getElementById('start-btn');
            if (btn) btn.onclick = () => this.start();
        }, 100);
    }

    createSprites() {
        const create = (w, h, drawFn) => {
            const canv = document.createElement('canvas');
            canv.width = w; canv.height = h;
            drawFn(canv.getContext('2d'));
            return canv;
        };

        // Mario
        this.sprites.hero = create(32, 32, c => {
            c.fillStyle = '#ff0000'; c.fillRect(8, 2, 16, 4); // Hat
            c.fillStyle = '#ffcc99'; c.fillRect(8, 6, 14, 10); // Face
            c.fillStyle = '#3333ff'; c.fillRect(8, 16, 16, 10); // Overalls
            c.fillStyle = '#663300'; c.fillRect(8, 26, 6, 4); c.fillRect(18, 26, 6, 4);
        });

        // Tiles
        this.sprites.floor = create(32, 32, c => {
            c.fillStyle = '#8B4513'; c.fillRect(0, 0, 32, 32);
            c.strokeStyle = 'black'; c.strokeRect(0, 0, 32, 32);
        });

        this.sprites.brick = create(32, 32, c => {
            c.fillStyle = '#A52A2A'; c.fillRect(0, 0, 32, 32);
            c.strokeStyle = 'rgba(0,0,0,0.5)';
            c.strokeRect(2, 2, 28, 12); c.strokeRect(2, 16, 28, 12);
        });

        this.sprites.qbox = create(32, 32, c => {
            c.fillStyle = '#FFD700'; c.fillRect(0, 0, 32, 32);
            c.fillStyle = '#B8860B'; c.font = 'bold 24px Arial';
            c.fillText('?', 10, 24);
            c.strokeRect(0, 0, 32, 32);
        });

        this.sprites.qbox_empty = create(32, 32, c => {
            c.fillStyle = '#777'; c.fillRect(0, 0, 32, 32);
            c.strokeRect(0, 0, 32, 32);
        });

        // Items
        this.sprites.coin = create(32, 32, c => {
            c.fillStyle = '#FFFF00'; c.beginPath(); c.arc(16, 16, 10, 0, 6.28); c.fill();
            c.strokeStyle = '#DAA520'; c.stroke();
        });

        this.sprites.mushroom = create(32, 32, c => {
            c.fillStyle = '#ff0000'; c.beginPath(); c.arc(16, 12, 12, Math.PI, 0); c.fill();
            c.fillStyle = 'white'; c.fillRect(10, 4, 4, 4); c.fillRect(18, 6, 4, 4);
            c.fillStyle = '#ffcc99'; c.fillRect(10, 12, 12, 12);
        });

        this.sprites.mushroom1up = create(32, 32, c => {
            c.fillStyle = '#00ff00'; c.beginPath(); c.arc(16, 12, 12, Math.PI, 0); c.fill();
            c.fillStyle = 'white'; c.fillRect(10, 4, 4, 4);
            c.fillStyle = '#ffcc99'; c.fillRect(10, 12, 12, 12);
        });

        this.sprites.enemy = create(32, 32, c => {
            c.fillStyle = '#800080'; c.beginPath(); c.arc(16, 16, 12, 0, 6.28); c.fill();
            c.fillStyle = 'white'; c.fillRect(10, 10, 4, 4); c.fillRect(18, 10, 4, 4);
        });
    }

    setupKeys() {
        window.onkeydown = (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space'].includes(e.code)) e.preventDefault();
            this.keys[e.code] = true;
        };
        window.onkeyup = (e) => this.keys[e.code] = false;
    }

    start() {
        if (this.lives <= 0) { this.lives = 3; this.score = 0; this.coins = 0; }
        this.isPaused = false;
        this.isGameOver = false;
        this.reset();
        document.getElementById('overlay').style.display = 'none';
    }

    reset() {
        this.player = {
            x: 64, y: 400, vx: 0, vy: 0,
            w: 24, h: 30, ground: false, facing: 1,
            isBig: false, powerTimer: 0
        };
        this.camera = 0;
        this.invincible = CONFIG.safePeriod;
        this.items = [];
        this.enemies = [{ x: 1000, y: 512, vx: -2 }];

        // Map Generation
        this.blocks = [];
        // Ground
        for (let i = 0; i < 150; i++) {
            this.blocks.push({ x: i * 32, y: 544, w: 32, h: 32, type: 'floor' });
        }

        // Sample Bricks and Q-Boxes
        this.addBlock(200, 400, 'qbox', 'mushroom');
        this.addBlock(232, 400, 'brick');
        this.addBlock(264, 400, 'qbox', 'coin');
        this.addBlock(296, 400, 'brick');
        this.addBlock(328, 400, 'qbox', '1up');

        this.addBlock(500, 350, 'brick');
        this.addBlock(532, 350, 'brick');
        this.addBlock(564, 350, 'brick');

        // Secret Block
        let secret = this.addBlock(400, 300, 'brick', 'coin');
        secret.hidden = true;
    }

    addBlock(x, y, type, content = null) {
        let b = { x, y, w: 32, h: 32, type, content, active: true };
        this.blocks.push(b);
        return b;
    }

    update() {
        if (this.isPaused || this.isGameOver) return;
        if (this.invincible > 0) this.invincible--;

        // Input
        let move = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) { move = -1; this.player.facing = -1; }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) { move = 1; this.player.facing = 1; }

        this.player.vx += move * 0.8;
        this.player.vx *= 0.85;

        if ((this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) && this.player.ground) {
            this.player.vy = CONFIG.jump;
            this.player.ground = false;
        }

        this.player.vy += CONFIG.gravity;

        // Physics & Collision
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        this.player.ground = false;

        this.blocks.forEach(b => {
            if (b.type === 'floor' || !b.hidden || b.hitOnce) {
                if (this.checkCollision(this.player, b)) {
                    // Vertical
                    if (this.player.vy > 0 && this.player.y + this.player.h - this.player.vy <= b.y) {
                        this.player.y = b.y - this.player.h;
                        this.player.vy = 0;
                        this.player.ground = true;
                    }
                    // Head hit
                    else if (this.player.vy < 0 && this.player.y - this.player.vy >= b.y + b.h) {
                        this.player.y = b.y + b.h;
                        this.player.vy = 0.1;
                        this.handleHeadHit(b);
                    }
                    // Horizontal
                    else {
                        if (this.player.vx > 0) this.player.x = b.x - this.player.w;
                        else if (this.player.vx < 0) this.player.x = b.x + b.w;
                    }
                }
            } else if (b.hidden && this.player.vy < 0 && this.checkCollision(this.player, b)) {
                // Secret block reveal
                this.player.y = b.y + b.h;
                this.player.vy = 0.1;
                b.hidden = false;
                this.handleHeadHit(b);
            }
        });

        // Items logic
        this.items.forEach((it, idx) => {
            it.y += it.vy || 0;
            it.x += it.vx || 0;
            if (it.type === 'mushroom' || it.type === '1up') {
                it.vy = (it.vy || 0) + 0.5;
                // Simple floor for items
                if (it.y > 512) { it.y = 512; it.vy = 0; }
            }
            if (this.checkCollision(this.player, it)) {
                this.collectItem(it);
                this.items.splice(idx, 1);
            }
        });

        // Enemies
        this.enemies.forEach(e => {
            e.x += e.vx;
            if (this.checkCollision(this.player, e)) {
                if (this.player.vy > 0 && this.player.y < e.y) {
                    // Stomp
                    this.player.vy = CONFIG.jump / 1.5;
                    e.dead = true;
                    this.score += 100;
                } else if (this.invincible <= 0) {
                    this.takeDamage();
                }
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);

        this.camera = Math.max(0, this.player.x - 300);
        if (this.player.y > 650) this.loseLife();
    }

    handleHeadHit(b) {
        if (b.type === 'qbox' && b.active) {
            this.spawnContent(b);
            b.active = false;
            b.hitOnce = true;
        } else if (b.type === 'brick') {
            if (this.player.isBig) {
                b.dead = true;
                this.score += 50;
            } else {
                b.hitOnce = true;
                if (b.content) { this.spawnContent(b); b.content = null; }
            }
        }
        this.blocks = this.blocks.filter(b => !b.dead);
    }

    spawnContent(b) {
        if (b.content === 'coin') {
            this.addCoin();
            this.score += 200;
        } else if (b.content === 'mushroom') {
            this.items.push({ x: b.x, y: b.y - 32, w: 32, h: 32, type: 'mushroom', vx: 2 });
        } else if (b.content === '1up') {
            this.items.push({ x: b.x, y: b.y - 32, w: 32, h: 32, type: '1up', vx: 2 });
        }
    }

    addCoin() {
        this.coins++;
        if (this.coins >= 100) {
            this.coins = 0;
            this.lives++;
        }
    }

    collectItem(it) {
        if (it.type === 'mushroom') {
            if (!this.player.isBig) {
                this.player.isBig = true;
                this.player.h = 60;
                this.player.y -= 30;
            }
            this.score += 1000;
        } else if (it.type === '1up') {
            this.lives++;
        }
    }

    takeDamage() {
        if (this.player.isBig) {
            this.player.isBig = false;
            this.player.h = 30;
            this.invincible = 120;
        } else {
            this.loseLife();
        }
    }

    loseLife() {
        if (this.invincible > 60) return; // Prevent losing life if just started
        this.lives--;
        if (this.lives <= 0) {
            this.isGameOver = true;
            this.showOverlay("GAME OVER");
        } else {
            this.reset();
            this.invincible = CONFIG.safePeriod; // Full safety on respawn
        }
    }

    showOverlay(msg) {
        const overlay = document.getElementById('overlay');
        overlay.style.display = 'flex';
        document.querySelector('#start-screen h1').innerText = msg;
        document.getElementById('start-btn').innerText = "RETRY";
    }

    checkCollision(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    draw() {
        this.ctx.fillStyle = '#5c94fc';
        this.ctx.fillRect(0, 0, CONFIG.w, CONFIG.h);

        this.ctx.save();
        this.ctx.translate(-Math.floor(this.camera), 0);

        this.blocks.forEach(b => {
            if (b.hidden && !b.hitOnce) return;
            let img = this.sprites[b.type] || this.sprites.floor;
            if ((b.type === 'qbox' || b.type === 'brick') && !b.active && b.hitOnce) img = this.sprites.qbox_empty;
            this.ctx.drawImage(img, b.x, b.y);
        });

        this.items.forEach(it => {
            this.ctx.drawImage(this.sprites[it.type], it.x, it.y);
        });

        this.enemies.forEach(e => {
            this.ctx.drawImage(this.sprites.enemy, Math.floor(e.x), Math.floor(e.y));
        });

        // Player
        this.ctx.save();
        let ph = this.player.isBig ? 64 : 32;
        this.ctx.translate(Math.floor(this.player.x + 12), Math.floor(this.player.y + (this.player.isBig ? 30 : 15)));
        if (this.player.facing === -1) this.ctx.scale(-1, 1);
        if (this.invincible % 10 < 5) {
            this.ctx.drawImage(this.sprites.hero, -16, -ph / 2, 32, ph);
        }
        this.ctx.restore();

        this.ctx.restore();

        // HUD
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px "Press Start 2P", monospace';
        this.ctx.fillText(`LIVES: ${this.lives}  COINS: ${this.coins}  SCORE: ${this.score}`, 20, 40);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => { new Game(); };
