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

        // Decorative scenery (Hills and Bushes)
        this.scenery = [];
        for (let i = 0; i < 40; i++) {
            this.scenery.push({
                x: i * 350 + Math.random() * 200,
                type: Math.random() > 0.4 ? 'hill' : 'bush',
                scale: 0.8 + Math.random() * 0.4
            });
        }

        for (let c = 0; c < 200; c++) {
            // FLOOR
            if (!(c >= 70 && c <= 72) && !(c >= 130 && c <= 134)) {
                this.map[14][c] = 1;
                this.map[13][c] = 1;
            }

            // PATTERN INSPIRED BY THE IMAGE
            if (c === 18) this.map[9][c] = 2; // Lone brick
            if (c >= 22 && c <= 25) {
                if (c === 23) this.map[9][c] = 4; // ? Block
                else this.map[9][c] = 2; // Bricks
            }
            if (c === 23) this.map[5][c] = 3; // Lone ? high up

            // Pipe
            if (c === 32) {
                this.map[12][c] = 8; this.map[12][c+1] = 9;
                this.map[13][c] = 10; this.map[13][c+1] = 10;
                this.entities.push(new PiranhaPlant((c * 32) + 16, 12 * 32, this));
            }

            // General Gameplay elements
            if (c > 45 && c % 18 === 0) {
                this.entities.push(new Goomba(c * 32, 384, this));
            }
            if (c === 60) this.map[9][c] = 7; // Gravity Star Box
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

        // Sky background gradient
        let skyGrad = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvasHeight);
        skyGrad.addColorStop(0, '#0EA5E9');
        skyGrad.addColorStop(1, '#38BDF8');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Draw Scenery (Hills and Bushes)
        this.scenery.forEach(s => {
            let sx = s.x - (this.camera.x * 0.4);
            this.ctx.save();
            this.ctx.translate(sx, 416); // Anchored to ground
            this.ctx.scale(s.scale, s.scale);
            
            if (s.type === 'hill') {
                // Classic Green Hill with dots
                this.ctx.fillStyle = '#22c55e';
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 60, 80, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#14532d';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                // Dots
                this.ctx.fillStyle = '#14532d';
                this.ctx.beginPath(); this.ctx.arc(-10, -20, 3, 0, 6.28); this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(15, -10, 3, 0, 6.28); this.ctx.fill();
            } else {
                // Bush
                this.ctx.fillStyle = '#4ade80';
                this.ctx.beginPath();
                this.ctx.arc(-20, 0, 20, 0, 6.28);
                this.ctx.arc(0, -10, 25, 0, 6.28);
                this.ctx.arc(20, 0, 20, 0, 6.28);
                this.ctx.fill();
                this.ctx.strokeStyle = '#166534';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            this.ctx.restore();
        });

        // Animated Clouds
        this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const time = Date.now() * 0.001;
        for (let i = 0; i < 10; i++) {
            let cx = (i * 600 + time * 30) % (CONFIG.canvasWidth + 800) - 400;
            let cy = 80 + Math.sin(time + i) * 15;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 25, 0, 6.28);
            this.ctx.arc(cx + 30, cy - 10, 35, 0, 6.28);
            this.ctx.arc(cx + 60, cy, 25, 0, 6.28);
            this.ctx.fill();
        }
        this.ctx.restore();

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
        this.ctx.save();
        switch (type) {
            case 1: // Floor (Brown with detail)
                this.ctx.fillStyle = '#924E00';
                this.ctx.fillRect(x, y, 32, 32);
                this.ctx.fillStyle = '#4B2800';
                this.ctx.fillRect(x, y + 28, 32, 4); // Shadow
                this.ctx.fillRect(x + 28, y, 4, 32); // Right shadow
                this.ctx.fillStyle = '#C06600';
                this.ctx.fillRect(x, y, 32, 4); // Highlight
                break;
            case 2: // Bricks (Segmented)
                this.ctx.fillStyle = '#C84C0C';
                this.ctx.fillRect(x, y, 32, 32);
                this.ctx.strokeStyle = '#4B2800';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y + 16); this.ctx.lineTo(x + 32, y + 16);
                this.ctx.moveTo(x + 16, y); this.ctx.lineTo(x + 16, y + 16);
                this.ctx.moveTo(x + 8, y + 16); this.ctx.lineTo(x + 8, y + 32);
                this.ctx.moveTo(x + 24, y + 16); this.ctx.lineTo(x + 24, y + 32);
                this.ctx.stroke();
                break;
            case 3: case 4: case 5: // Q-Box (Yellow)
                this.ctx.fillStyle = '#FFCC00';
                this.ctx.fillRect(x, y, 32, 32);
                this.ctx.strokeStyle = '#000';
                this.ctx.strokeRect(x+1, y+1, 30, 30);
                this.ctx.fillStyle = '#000';
                this.ctx.font = 'bold 20px "Press Start 2P"';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('?', x + 16, y + 25);
                break;
            case 6: // Used Block
                this.ctx.fillStyle = '#7d7d7d';
                this.ctx.fillRect(x, y, 32, 32);
                this.ctx.strokeRect(x, y, 32, 32);
                break;
            case 8: case 9: case 10: // Pipe
                this.ctx.fillStyle = '#00A800';
                this.ctx.fillRect(x, y, 32, 32);
                this.ctx.strokeRect(x, y, 32, 32);
                break;
            default:
                this.ctx.fillStyle = '#fff';
                this.ctx.fillRect(x, y, 32, 32);
        }
        this.ctx.restore();
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
                if ((type >= 1 && type <= 6) || (type >= 8 && type <= 10)) { // Solid tiles including Pipes
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
        // 1. VERTICAL RESOLUTION
        this.y += this.vy;
        this.onGround = false;
        
        let blocks = this.checkCollisions();
        blocks.forEach(b => {
            if (this.rectIntersect(this, b)) {
                if (this.vy * this.game.gravityDir > 0) { // Falling towards floor
                    this.y = this.game.gravityDir === 1 ? b.y - this.h : b.y + b.h;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy * this.game.gravityDir < 0) { // Hitting head on ceiling
                    this.y = this.game.gravityDir === 1 ? b.y + b.h : b.y - this.h;
                    this.vy = 0;
                    if (this === this.game.player) this.game.hitBlock(b.r, b.c);
                }
            }
        });

        // 2. HORIZONTAL RESOLUTION
        this.x += this.vx;
        // Re-check collisions after vertical resolution is finalized
        blocks = this.checkCollisions();
        blocks.forEach(b => {
            if (this.rectIntersect(this, b)) {
                // Check vertical overlap at the new Y position
                const overlapY = Math.min(this.y + this.h, b.y + b.h) - Math.max(this.y, b.y);
                
                // Only block horizontally if the block is truly in front of the entity,
                // not just something they are standing on or hitting with their head.
                // We use a larger buffer (8px) to allow for small clips during jumps.
                if (overlapY > 8) { 
                    const entityMid = this.x + this.w / 2;
                    const blockMid = b.x + b.w / 2;
                    
                    if (entityMid < blockMid) { // Hit side of block from left
                        this.x = b.x - this.w;
                        this.vx = 0;
                    } else { // Hit side of block from right
                        this.x = b.x + b.w;
                        this.vx = 0;
                    }
                    if (this.onCollisionWall) this.onCollisionWall();
                }
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
        this.trail = [];
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
        // Trail logic
        if (Math.abs(this.vx) > 2 || Math.abs(this.vy) > 2) {
            this.trail.push({ 
                x: this.x, 
                y: this.y, 
                alpha: 0.4, 
                bg: this.game.gravityDir === -1 ? '#FACC15' : 'rgba(255,255,255,0.4)' 
            });
        }
        if (this.trail.length > 8) this.trail.shift();
        this.trail.forEach(t => t.alpha -= 0.05);
        this.trail = this.trail.filter(t => t.alpha > 0);
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
        // Draw trail
        this.trail.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.fillStyle = t.bg;
            ctx.translate(t.x + this.w / 2, t.y + this.h / 2);
            if (this.facing === -1) ctx.scale(-1, 1);
            if (this.game.gravityDir === -1) ctx.scale(1, -1);
            ctx.beginPath();
            ctx.roundRect(-12, -16, 24, 32, 8);
            ctx.fill();
            ctx.restore();
        });

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
            ctx.drawImage(this.game.images.hero, 0, sy, 32, 32, -18, -18, 36, 36);
        } else {
            // PREMIUM Mario Canvas Drawing (Fallback that looks like the 3D render)
            const mainColor = this.isFire ? '#FFFFFF' : '#FF3131';
            const accentColor = this.isFire ? '#FF3131' : '#3B82F6';
            const skinColor = '#FFCEA5';

            // Shoes (Brown)
            ctx.fillStyle = '#543310';
            ctx.beginPath();
            ctx.ellipse(-8, 14, 8, 4, 0, 0, Math.PI * 2);
            ctx.ellipse(8, 14, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Overalls
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.roundRect(-12, -4, 24, 20, 6);
            ctx.fill();

            // Overalls Straps
            ctx.fillRect(-11, -8, 5, 8);
            ctx.fillRect(6, -8, 5, 8);

            // Buttons
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.arc(-7, 0, 2.5, 0, Math.PI * 2);
            ctx.arc(7, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Shirt
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.roundRect(-10, -10, 20, 6, 2); // Body part
            ctx.fill();
            // Arms
            ctx.fillRect(-14, -8, 6, 8);
            ctx.fillRect(8, -8, 6, 8);

            // Gloves
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.arc(-14, 2, 5, 0, Math.PI * 2);
            ctx.arc(14, 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Head
            ctx.fillStyle = skinColor;
            ctx.beginPath();
            ctx.arc(0, -18, 12, 0, Math.PI * 2);
            ctx.fill();

            // Nose
            ctx.beginPath();
            ctx.ellipse(3, -16, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Mustache & Hair
            ctx.fillStyle = '#3E2723';
            ctx.beginPath();
            ctx.ellipse(0, -13, 8, 3, 0, 0, Math.PI * 2); // Mustache
            ctx.fill();
            ctx.fillRect(-14, -20, 4, 8); // Sideburn

            // Eyes
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.ellipse(4, -21, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3B82F6';
            ctx.beginPath(); ctx.arc(5, -20, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.arc(5, -20, 1, 0, Math.PI * 2); ctx.fill();

            // Hat
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.ellipse(0, -25, 14, 8, 0, Math.PI, Math.PI * 2); // Top
            ctx.fill();
            ctx.fillRect(0, -26, 14, 4); // Peak

            // 'M' Symbol
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(0, -26, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FF3131';
            ctx.font = 'bold 6px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('M', 0, -24);
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
        ctx.save();
        ctx.translate(Math.floor(this.x + 16), Math.floor(this.y + 16));
        
        if (this.game.images.enemies && this.game.images.enemies.width > 32) {
            ctx.drawImage(this.game.images.enemies, 0, 0, 32, 32, -16, -16, 32, 32);
        } else {
            // PREMIUM Goomba Canvas Drawing
            const capColor = '#8D5524';
            const skinColor = '#FFCEA5';
            const shoeColor = '#4B2800';

            // Feet
            ctx.fillStyle = shoeColor;
            ctx.beginPath();
            ctx.ellipse(-10, 12, 8, 5, 0, 0, Math.PI * 2);
            ctx.ellipse(10, 12, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Stem
            ctx.fillStyle = skinColor;
            ctx.beginPath();
            ctx.roundRect(-10, 0, 20, 12, 5);
            ctx.fill();

            // Head (Cap)
            ctx.fillStyle = capColor;
            ctx.beginPath();
            ctx.moveTo(-18, 5);
            ctx.quadraticCurveTo(-18, -15, 0, -18);
            ctx.quadraticCurveTo(18, -15, 18, 5);
            ctx.quadraticCurveTo(0, 10, -18, 5);
            ctx.fill();
            ctx.strokeStyle = '#5D3A1A';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Eyes
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(-5, -5, 4, 6, 0.1, 0, Math.PI * 2);
            ctx.ellipse(5, -5, 4, 6, -0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.arc(-4, -5, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -5, 1.5, 0, Math.PI * 2); ctx.fill();

            // Angry Eyebrows
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-10, -12); ctx.lineTo(-2, -8);
            ctx.moveTo(10, -12); ctx.lineTo(2, -8);
            ctx.stroke();

            // Teeth
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(-6, 1); ctx.lineTo(-4, 5); ctx.fill();
            ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(6, 1); ctx.lineTo(4, 5); ctx.fill();
        }
        ctx.restore();
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
        // Inner Glow
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(this.x + 6, this.y + 6, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

class PiranhaPlant extends Entity {
    constructor(x, y, game) {
        super(x - 16, y, game);
        this.w = 32; this.h = 32;
        this.startY = y;
        this.offset = 0;
        this.timer = 0;
        this.dir = -1; // -1 for emerging, 1 for hiding
    }
    update() {
        this.timer++;
        // Movement cycle
        if (this.timer % 120 === 0) this.dir = -this.dir;

        if (this.timer % 120 < 60) {
            this.offset += this.dir * 0.5;
        }

        this.offset = Math.max(-40, Math.min(0, this.offset));
        this.y = this.startY + this.offset;

        // Collision with player
        if (!this.dead && this.rectIntersect(this, this.game.player)) {
            if (this.game.player.invincibleTimer > 600) {
                this.die();
            } else if (this.game.player.invincibleTimer === 0) {
                this.game.player.takeDamage();
            }
        }
    }
    die() { this.dead = true; this.game.score += 400; }
    draw(ctx) {
        ctx.save();
        // Plant logic: green stem, red head with white spots (couve-flor style)
        ctx.fillStyle = '#00A800';
        ctx.fillRect(this.x + 10, this.y + 16, 12, 30); // Stem

        // Head
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.ellipse(this.x + 16, this.y + 8, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(this.x + 16, this.y + 4, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // White Spots
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(this.x + 8, this.y + 4, 3, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x + 24, this.y + 10, 4, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x + 12, this.y + 12, 2, 0, 6.28); ctx.fill();

        ctx.restore();
    }
}

window.onload = () => { new Game(); };
