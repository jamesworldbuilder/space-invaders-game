import express from 'express';
const app = express();

app.get('/', (req, res) => {
    const gameContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:;">
        <title>Invaders Game by James</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                overflow: hidden;
            }
            html, body {
                width: 100%;
                height: 100%;
                background-color: #000000;
                overflow: hidden;
                font-family: 'Press Start 2P', cursive;
            }
            .game-container {
                height: 100%;
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
                overflow: hidden;
                min-height: 300px; /* Minimum height to ensure playability */
                min-width: 300px; /* Minimum width to ensure playability */
                max-width: 380px; /* Maximum width for smaller screens */
                max-height: 870px; /* Maximum height for larger screens */
                padding: calc(var(--block-size) * 0.53) calc(var(--block-size) * 0.33) calc(var(--block-size) * 0.33) calc(var(--block-size) * 0.33);
                margin: 0 auto; /* Center the container horizontally */
            }

            canvas {
                background-color: #000000;
                width: 100%;
                height: 100%;
                object-fit: contain;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
            }
            /* UI Screens (Start and Game Over) */
            .ui-screen {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                gap: 20px;
                z-index: 20;
                padding: 1em;
            }
            .hidden {
                display: none;
            }
            .title {
                font-size: 1.5em;
                color: #663399;
            }
            .score {
                font-size: 1em;
                color: #E0E0E0;
            }
            .button {
                padding: 15px 30px;
                background-color: #000000;
                color: #E0E0E0;
                border: 2px solid #663399;
                cursor: pointer;
                font-family: 'Press Start 2P', cursive;
                font-size: 0.9em;
            }
            .button:hover {
                background-color: #9933FF;
            }
            .leaderboard {
                 font-size: 0.8em;
            }
            .leaderboard h3 {
                color: #663399;
                margin-bottom: 10px;
            }
            .leaderboard ol {
                list-style-type: none;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <div class="game-container" id="gameContainer">
            <canvas id="gameCanvas"></canvas>

            <!-- Start Screen -->
            <div id="startScreen" class="ui-screen">
                <div class="title">INVADERS</div>
                <button id="startButton" class="button">Start Game</button>
            </div>

            <!-- Game Over Screen -->
            <div id="gameOverScreen" class="ui-screen hidden">
                <div class="title">Game Over</div>
                <div id="finalScore" class="score"></div>
                <button id="retryButton" class="button">Play Again</button>
            </div>
        </div>

        <script>
        (function() {
            // --- Canvas and UI Setup ---
            const gameContainer = document.getElementById('gameContainer');
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const startScreen = document.getElementById('startScreen');
            const gameOverScreen = document.getElementById('gameOverScreen');
            const startButton = document.getElementById('startButton');
            const retryButton = document.getElementById('retryButton');
            const finalScoreElement = document.getElementById('finalScore');

            // --- Easy Origin Switch ---
            // Set to true when deploying to GitHub Pages, false for local development
            const IS_PRODUCTION = false;
            const PARENT_ORIGIN = IS_PRODUCTION ? 'https://jamesworldbuilder.github.io' : '*';

            // --- Parent Window Communication ---
            const isEmbedded = (window.self !== window.top);
            const postParent = (message) => {
                if (isEmbedded) {
                    window.parent.postMessage(message, PARENT_ORIGIN);
                }
            };

            // --- Game Constants for Sizing ---
            const cols = 10;
            const rows = 20;
            let blockSize = 30;

            // --- Game State ---
            let score = 0;
            let gameOver = false;
            let animationFrameId;
            let keys = {};
            let isFlashingScore = false;
            let scoreFlashStartTime = 0;
            const scoreFlashDuration = 500;
            let lastTime = 0;
            let alienFireTimer = 0;
            const alienFireInterval = 1000;
            let playerShotCount = 0;
            let isReloading = false;
            const reloadTime = 1400;
            let lastShotTime = 0;
            const quickFireThreshold = 250; 
            let lastStandMode = false;
            let invadersAreVulnerable = false;
            let invaderVulnerableTimer = 0;
            let playerDestructionTimer = 0; // Added for destruction delay
            // --- UFO score values ---
            const ufoScores = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100, 50];
            let ufoHitCount = 0;
            let ufoPowerUpHitCounter = 0; // Persistent counter for the vulnerability power-up

            // --- Pause State ---
            let isPaused = false;
            let resizeTimeout = null;
            const RESIZE_DELAY = 500; // Half second delay

            // --- Speed Adjustment Variables ---
            const baseSpeed = 60; // Base speed divisor
            let currentSpeedDivisor = baseSpeed;
            let verticalDescentSpeed = 5; // Base vertical descent speed when player is destroyed

            // --- Mobile Detection ---
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const mobileSpeedMultiplier = 1.5; // Increase speed by 50% on mobile


            // --- Sprite Definitions ---
            const invaderSprites = [
                [ // Type 0: Octopus
                    [0,0,1,0,0,0,0,0,1,0,0],
                    [0,0,0,1,0,0,0,1,0,0,0],
                    [0,0,1,1,1,1,1,1,1,0,0],
                    [0,1,1,0,1,1,1,0,1,1,0],
                    [1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,1,1,1,1,1,1,1,0,1],
                    [1,0,1,0,0,0,0,0,1,0,1],
                    [0,0,1,1,0,0,0,1,1,0,0]
                ],
                [ // Type 1: Crab
                    [0,0,1,1,0,0,0,1,1,0,0],
                    [0,1,1,1,1,1,1,1,1,1,0],
                    [1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,0,0,1,0,0,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1],
                    [0,0,1,0,1,0,1,0,1,0,0],
                    [0,1,0,0,0,1,0,0,0,1,0],
                    [1,0,0,0,0,0,0,0,0,0,1]
                ],
                [ // Type 2: Squid
                    [0,0,0,0,1,1,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,0,0,0],
                    [0,0,1,1,1,1,1,1,1,0,0],
                    [0,0,1,0,1,1,1,0,1,0,0],
                    [0,1,1,1,1,1,1,1,1,1,0],
                    [0,0,1,1,0,1,0,1,1,0,0],
                    [0,1,0,0,1,0,1,0,0,1,0],
                    [0,0,1,0,0,1,0,0,1,0,0]
                ]
            ];
            
            // --- UFO Sprite Definition ---
            const ufoSprite = [
                [0,0,0,1,1,1,1,1,1,1,0,0,0],
                [0,0,1,1,1,1,1,1,1,1,1,0,0],
                [0,1,1,1,1,1,1,1,1,1,1,1,0],
                [1,1,0,1,1,0,1,0,1,1,0,1,1],
                [0,1,1,1,1,1,1,1,1,1,1,1,0],
                [0,0,1,1,1,0,0,0,1,1,1,0,0],
                [0,0,0,1,0,0,0,0,0,1,0,0,0]
            ];


            // --- Game Objects ---
            class Player {
                constructor() {
                    this.pixelSize = Math.max(1, Math.floor(blockSize / 13));
                    this.width = this.pixelSize * 13;
                    this.height = this.pixelSize * 7;
                    this.x = (canvas.width / 2) - (this.width / 2);
                    this.y = canvas.height - this.height - (blockSize * 1.3);
                    this.speed = blockSize / 6;
                    this.health = 6;
                    this.isCritical = false;
                    this.isHit = false;
                    this.hitTimer = 0;
                    this.isDestroyed = false;
                }
                
                drawPropulsion() {
                    const ps = this.pixelSize;
                    if (ps <= 0) return;

                    const baseX = this.x + ps * 4.5; 
                    const baseY = this.y + this.height;

                    const flameHeight = ps * (3 + Math.sin(Date.now() / 60) * 1.5);

                    ctx.fillStyle = '#4169E1';
                    ctx.beginPath();
                    ctx.moveTo(baseX, baseY);
                    ctx.lineTo(baseX + ps * 2, baseY + flameHeight);
                    ctx.lineTo(baseX + ps * 4, baseY);
                    ctx.closePath();
                    ctx.fill();

                    const innerFlameHeight = flameHeight * 0.6;
                    ctx.fillStyle = '#ADD8E6';
                    ctx.beginPath();
                    ctx.moveTo(baseX + ps, baseY);
                    ctx.lineTo(baseX + ps * 2, baseY + innerFlameHeight);
                    ctx.lineTo(baseX + ps * 3, baseY);
                    ctx.closePath();
                    ctx.fill();
                }

                draw() {
                    if (this.isDestroyed) return;
                    
                    this.drawPropulsion();
                    
                    const ps = this.pixelSize;
                    if (ps <= 0) return;
                    ctx.save();
                    
                    let bodyColor = '#DCDCDC';
                    let wingColor = '#4169E1';
                    let cannonColor = '#FFD700';
                    let tipColor = '#DC143C';

                    if (this.isHit) {
                        if (Math.floor(Date.now() / 75) % 2 === 0) {
                            bodyColor = '#DC143C';
                            wingColor = '#DC143C';
                        }
                    } else if (this.isCritical) {
                        const alpha = (Math.sin(Date.now() / 150) + 1) / 4 + 0.5;
                        ctx.globalAlpha = alpha;
                        bodyColor = '#DC143C';
                        wingColor = '#DC143C';
                        cannonColor = '#DC143C';
                        tipColor = '#DC143C';
                    }

                    ctx.fillStyle = bodyColor;
                    ctx.fillRect(this.x + ps * 5, this.y, ps * 3, ps * 7);
                    ctx.fillRect(this.x + ps * 4, this.y + ps, ps * 5, ps * 5);
                    ctx.fillRect(this.x + ps * 3, this.y + ps * 2, ps * 7, ps * 3);

                    ctx.fillStyle = wingColor;
                    ctx.fillRect(this.x, this.y + ps * 4, ps * 13, ps * 2);
                    ctx.fillRect(this.x + ps, this.y + ps * 3, ps * 11, ps);
                    ctx.fillRect(this.x + ps * 2, this.y + ps * 2, ps * 9, ps);
                    
                    ctx.fillStyle = cannonColor;
                    ctx.fillRect(this.x + ps * 6, this.y - ps, ps, ps);

                    ctx.fillStyle = tipColor;
                    ctx.fillRect(this.x, this.y + ps * 3, ps, ps);
                    ctx.fillRect(this.x + ps * 12, this.y + ps * 3, ps, ps);
                    
                    ctx.restore();
                }

                update(deltaTime) {
                    if (this.isDestroyed) return;
                    
                    if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed;
                    if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed;
                    if (this.x < 0) this.x = 0;
                    if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
                    
                    if (this.isHit) {
                        this.hitTimer -= deltaTime;
                        if (this.hitTimer <= 0) {
                            this.isHit = false;
                        }
                    }
                    
                    this.draw();
                }
            }

            class Projectile {
                constructor(x, y, velocity) {
                    this.x = x;
                    this.y = y;
                    this.width = Math.max(1, Math.floor(blockSize / 10));
                    this.height = Math.max(4, Math.floor(blockSize / 4));
                    this.velocity = velocity;
                }
                draw() {
                    const halfHeight = this.height / 2;
                    ctx.fillStyle = '#FFD700';
                    ctx.fillRect(this.x, this.y, this.width, halfHeight);
                    ctx.fillStyle = '#FF8C00';
                    ctx.fillRect(this.x, this.y + halfHeight, this.width, this.height - halfHeight);
                }
                update() {
                    this.y += this.velocity;
                    this.draw();
                }
            }
            
            class AlienProjectile {
                constructor(x, y) {
                    this.pixelSize = Math.max(1, Math.floor(blockSize / 10));
                    this.width = this.pixelSize * 2;
                    this.height = this.pixelSize * 5;
                    this.x = x;
                    this.y = y;
                    this.velocity = blockSize / 6;
                    this.sprite = [ [1,0], [0,1], [1,0], [0,1], [1,0] ];
                }
                draw() {
                    if (this.pixelSize <= 0) return;
                    ctx.fillStyle = '#FFFF00';
                    for (let r = 0; r < this.sprite.length; r++) {
                        for (let c = 0; c < this.sprite[r].length; c++) {
                            if (this.sprite[r][c] === 1) {
                                ctx.fillRect(this.x + c * this.pixelSize, this.y + r * this.pixelSize, this.pixelSize, this.pixelSize);
                            }
                        }
                    }
                }
                 update() {
                    this.y += this.velocity;
                    this.draw();
                }
            }

            class Invader {
                constructor(x, y, spriteType) {
                    this.spriteType = spriteType;
                    // Use the same pixel size calculation as UFO for consistent scaling
                    this.pixelSize = Math.max(1, Math.floor(blockSize / 13));
                    this.width = this.pixelSize * 13;
                    this.height = this.pixelSize * 8;
                    this.x = x;
                    this.y = y;
                    this.isHit = false;
                    this.hitTimer = 0;
                    this.isDying = false;
                    this.deathTimer = 0;
                    this.isVulnerable = false;

                    if (spriteType === 2) this.health = 3;
                    else if (spriteType === 1) this.health = 2;
                    else this.health = 1;
                }

                draw() {
                    if (this.isVulnerable) {
                        ctx.fillStyle = Math.floor(Date.now() / 100) % 2 === 0 ? '#DC143C' : '#F5F5F5';
                    } else {
                        ctx.fillStyle = this.isHit ? '#DC143C' : '#F5F5F5';
                    }
                    const sprite = invaderSprites[this.spriteType];
                    if (this.pixelSize <= 0) return;
                    for (let r = 0; r < sprite.length; r++) {
                        for (let c = 0; c < sprite[r].length; c++) {
                            if (sprite[r][c] === 1) {
                                ctx.fillRect(this.x + c * this.pixelSize, this.y + r * this.pixelSize, this.pixelSize, this.pixelSize);
                            }
                        }
                    }
                }
            }
            
            class UFO {
                constructor() {
                    this.pixelSize = Math.max(1, Math.floor(blockSize / 13));
                    this.width = this.pixelSize * 13;
                    this.height = this.pixelSize * 7;
                    this.y = blockSize * 1.5; 
                    this.speed = blockSize / 60; 
                    this.active = false;
                    this.isHit = false;
                    this.hitTimer = 0;
                    this.spawnTimer = 5000;
                    this.hits = 0;
                }

                spawn() {
                    this.direction = Math.random() < 0.5 ? 1 : -1;
                    this.x = this.direction === 1 ? -this.width : canvas.width;
                    this.active = true;
                    this.hits = 0;
                }
                
                update(deltaTime) {
                    if (!this.active) {
                        this.spawnTimer -= deltaTime;
                        if(this.spawnTimer <= 0) {
                            this.spawn();
                            this.spawnTimer = 8000 + Math.random() * 5000;
                        }
                        return;
                    }
                    
                    this.x += this.speed * this.direction * (deltaTime / (1000/60));
                    
                    if ((this.direction === 1 && this.x > canvas.width) || (this.direction === -1 && this.x < -this.width)) {
                        this.active = false;
                    }

                    if (this.isHit) {
                        this.hitTimer -= deltaTime;
                        if (this.hitTimer <= 0) {
                            this.isHit = false;
                        }
                    }
                    
                    this.draw();
                }

                draw() {
                     if (!this.active) return;
                    
                    ctx.fillStyle = this.isHit ? '#FF4500' : '#FF00FF';
                    const ps = this.pixelSize;
                    if (ps <= 0) return;
                    for (let r = 0; r < ufoSprite.length; r++) {
                        for (let c = 0; c < ufoSprite[r].length; c++) {
                            if (ufoSprite[r][c] === 1) {
                                ctx.fillRect(this.x + c * ps, this.y + r * ps, ps, ps);
                            }
                        }
                    }
                }

                takeHit() {
                    this.hits++;
                    ufoPowerUpHitCounter++;
                    
                    const scoreToAdd = ufoScores[ufoHitCount % 15];
                    updateScore(scoreToAdd);
                    ufoHitCount++;

                    if (ufoPowerUpHitCounter > 0 && ufoPowerUpHitCounter % 3 === 0) {
                        invadersAreVulnerable = true;
                        invaderVulnerableTimer = 5000;
                        grid.invaders.forEach(inv => {
                            if (!inv.isDying) {
                                inv.isVulnerable = true;
                            }
                        });
                    }

                    if (this.hits >= 23) {
                        this.active = false;
                        explosions.push(new Explosion(this.x + this.width / 2, this.y + this.height / 2));
                    } else {
                        this.isHit = true;
                        this.hitTimer = 150;
                    }
                }
            }

            class InvaderGrid {
                constructor() {
                    this.x = 0;
                    this.y = blockSize * 2; 
                    // Apply mobile speed multiplier for quicker horizontal movement
                    const mobileSpeedAdjustment = isMobile ? mobileSpeedMultiplier : 1;
                    this.velocity = { x: (blockSize / currentSpeedDivisor) * mobileSpeedAdjustment, y: 0 };
                    this.invaders = [];
                    this.directionChangesCount = 0;
                    // Even fewer direction changes on mobile for quicker descent
                    this.directionChangesRequired = isMobile ? 
                        Math.floor(Math.random() * 1) + 1 : // 1-2 on mobile
                        Math.floor(Math.random() * 2) + 1;   // 1-3 on desktop
                    // Larger vertical step on mobile for quicker descent
                    this.verticalStep = isMobile ? 
                        blockSize * 0.45 :  // Larger step on mobile
                        blockSize * 0.35;   // Normal step on desktop
                    this.init();
                }

                init() {
                    // Minimum canvas dimensions
                    const baseWidth = 350;
                    const baseHeight = 700;
                    
                    // Calculate column and row adjustments
                    const widthReduction = Math.max(0, baseWidth - canvas.width);
                    const heightReduction = Math.max(0, baseHeight - canvas.height);
                    
                    // Adjust columns and rows (reduce cols by 1 - increase rows by 1 for every 100px reduction)
                    const colAdjustment = Math.floor(widthReduction / 100);
                    const rowAdjustment = Math.floor(heightReduction / 100);
                    
                    let numCols = Math.max(3, 7 - colAdjustment); // Minimum 3 columns
                    let numRows = Math.min(8, 5 + rowAdjustment); // Maximum 8 rows
                    
                    this.invaders = [];
                    
                    // Use the same pixel size calculation as UFO for consistent scaling
                    const tempPixelSize = Math.max(1, Math.floor(blockSize / 13));
                    const invaderWidth = tempPixelSize * 13;
                    const invaderHeight = tempPixelSize * 8;
                    const horizontalSpacing = invaderWidth * 1.5;
                    const verticalSpacing = invaderHeight * 1.5;
                    const totalGridWidth = (numCols - 1) * horizontalSpacing + invaderWidth;
                    const startX = (canvas.width - totalGridWidth) / 2;
                    const startY = this.y + blockSize;

                    let rowTypes = [0, 1, 2];
                    // Fill remaining rows with random types
                    for (let i = 0; i < numRows - 3; i++) {
                        rowTypes.push(Math.floor(Math.random() * 3));
                    }

                    // Shuffle the row types for more varied appearance
                    for (let i = rowTypes.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [rowTypes[i], rowTypes[j]] = [rowTypes[j], rowTypes[i]];
                    }

                    for (let i = 0; i < numRows; i++) {
                        const spriteType = rowTypes[i % rowTypes.length];
                        for (let j = 0; j < numCols; j++) {
                            this.invaders.push(new Invader(startX + j * horizontalSpacing, startY + i * verticalSpacing, spriteType));
                        }
                    }
                    
                    // Update velocity immediately after initialization
                    this.updateVelocity();
                }

                updateVelocity() {
                    // Calculate speed adjustment based on canvas dimensions
                    const widthAdjustment = Math.max(0, (350 - canvas.width)) / 100;
                    const heightAdjustment = Math.max(0, (700 - canvas.height)) / 100;
                    const totalAdjustment = widthAdjustment + heightAdjustment;
                    
                    // Apply adjustment (half second per 100px below threshold)
                    currentSpeedDivisor = baseSpeed + (totalAdjustment * 30); // 30 = 60 fps * 0.5 seconds
                    
                    // Update velocity - ensure it's never too fast or too slow
                    const minSpeedDivisor = 30;  // Minimum speed (faster)
                    const maxSpeedDivisor = 120; // Maximum speed (slower)
                    const clampedDivisor = Math.max(minSpeedDivisor, Math.min(maxSpeedDivisor, currentSpeedDivisor));
                    
                    // Apply mobile speed multiplier for quicker horizontal movement
                    const mobileSpeedAdjustment = isMobile ? mobileSpeedMultiplier : 1;
                    this.velocity.x = (blockSize / clampedDivisor) * mobileSpeedAdjustment;
                    
                    // Update vertical step (reduce by 1.5 for every 100px below threshold)
                    const verticalReduction = totalAdjustment * 1.5;
                    this.verticalStep = Math.max(blockSize * 0.1, blockSize * 0.25 - verticalReduction);
                    
                    // Update vertical descent speed for destruction animation
                    verticalDescentSpeed = Math.max(1, 5 - (totalAdjustment * 1.5));
                    
                    // Update UFO speed to match the overall game speed scaling
                    if (ufo) {
                        ufo.speed = blockSize / 60 * (clampedDivisor / baseSpeed);
                    }
                    
                    // Update alien projectile speed to match the overall game speed scaling
                    AlienProjectile.prototype.velocity = blockSize / 6 * (clampedDivisor / baseSpeed);
                }

                update(deltaTime) {
                    const gridPadding = 5; // Remove padding to match UFO boundaries
                    let moveDown = false;
                    const speedMultiplier = deltaTime / (1000/60);

                    // Find the leftmost and rightmost invaders to check boundaries
                    let leftmostX = canvas.width;
                    let rightmostX = 0;
                    
                    for (const invader of this.invaders) {
                        if (invader.isDying) continue;
                        leftmostX = Math.min(leftmostX, invader.x);
                        rightmostX = Math.max(rightmostX, invader.x + invader.width);
                    }

                    // Check if invaders hit the edges of the canvas
                    if ((leftmostX < gridPadding && this.velocity.x < 0) || 
                        (rightmostX > canvas.width - gridPadding && this.velocity.x > 0)) {
                        this.velocity.x *= -1;
                        this.directionChangesCount++;
                        
                        // Check if it's time to descend
                        if (this.directionChangesCount >= this.directionChangesRequired) {
                            moveDown = true; 
                            // Reset for next descent with mobile-specific values
                            this.directionChangesCount = 0;
                            this.directionChangesRequired = isMobile ? 
                                Math.floor(Math.random() * 1) + 1 : // 1-2 on mobile
                                Math.floor(Math.random() * 2) + 1;   // 1-3 on desktop
                        }
                    }

                    if (moveDown) {
                        // Descend exactly one row
                        for (const invader of this.invaders) {
                            if (!invader.isDying) invader.y += this.verticalStep;
                        }
                    }

                    for (const invader of this.invaders) {
                        if (!invader.isDying) invader.x += this.velocity.x * speedMultiplier;
                        
                        if (invader.isHit) {
                            invader.hitTimer -= deltaTime;
                            if (invader.hitTimer <= 0) {
                                invader.isHit = false;
                            }
                        }
                        
                        if (!invader.isDying) {
                            invader.draw();
                        }
                    }
                }
            }

            class Explosion {
                constructor(x, y) {
                    // Use the same pixel size calculation as UFO for consistent scaling
                    this.pixelSize = Math.max(1, Math.floor(blockSize / 13));
                    this.x = x - (this.pixelSize * 13) / 2;
                    this.y = y - (this.pixelSize * 8) / 2;
                    this.timer = 120;
                    this.sprite = [
                        [0,1,0,0,0,0,0,0,0,0,1,0,0],
                        [0,0,1,0,0,1,0,0,0,1,0,0,0],
                        [0,0,0,1,0,1,0,1,0,0,0,1,0],
                        [1,1,1,0,0,0,1,0,0,1,0,0,0],
                        [0,0,0,0,0,1,0,1,0,0,0,1,1],
                        [0,0,0,1,0,0,1,0,0,1,0,0,0],
                        [0,0,1,0,0,0,0,0,0,0,1,0,0]
                    ];
                }
                draw() {
                    if (this.pixelSize <= 0) return;
                    ctx.fillStyle = '#FF8C00';
                    for (let r = 0; r < this.sprite.length; r++) {
                        for (let c = 0; c < this.sprite[r].length; c++) {
                            if (this.sprite[r][c] === 1) {
                                ctx.fillStyle = (c % 2 === 0) ? '#FFD700' : '#FF8C00';
                                ctx.fillRect(this.x + c * this.pixelSize, this.y + r * this.pixelSize, this.pixelSize, this.pixelSize);
                            }
                        }
                    }
                }
            }
            
            class ReloadAnimation {
                constructor(playerRef) {
                    this.player = playerRef;
                    this.timer = reloadTime;
                    this.radius = this.player.width * 0.6;
                }

                update(deltaTime) {
                    this.timer -= deltaTime;
                }

                draw() {
                    const progress = 1 - (this.timer / reloadTime);
                    const centerX = this.player.x + this.player.width / 2;
                    const centerY = this.player.y + this.player.height / 2;
                    
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, this.radius, -Math.PI / 2, -Math.PI / 2 + (progress * Math.PI * 2));
                    ctx.strokeStyle = '#4169E1';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }


            class Barricade {
                constructor(startX) {
                    this.width = blockSize * 1.7;
                    this.height = blockSize;
                    this.x = startX;
                    this.y = canvas.height - (blockSize * 3.8);
                    this.partSize = Math.max(1, Math.floor(blockSize / 5));
                    this.grid = [];
                    this.initialParts = 0;
                    this.currentParts = 0;
                    this.init();
                }

                init() {
                    const gridWidth = Math.floor(this.width / this.partSize);
                    const gridHeight = Math.floor(this.height / this.partSize);
                    this.grid = [];
                    this.initialParts = 0;
                    for(let i = 0; i < gridHeight; i++) {
                        this.grid[i] = [];
                        for(let j = 0; j < gridWidth; j++) {
                            if (i > gridHeight / 2 && (j > gridWidth / 4.5 && j < gridWidth * 3 / 4.5)) {
                                this.grid[i][j] = 0;
                            } else {
                                this.grid[i][j] = 1;
                                this.initialParts++;
                            }
                        }
                    }
                    this.currentParts = this.initialParts;
                }

                draw() {
                     if (this.partSize <= 0) return;
                     for(let i = 0; i < this.grid.length; i++) {
                        for(let j = 0; j < this.grid[i].length; j++) {
                            if (this.grid[i][j] === 1) {
                                ctx.fillStyle = '#2E8B57';
                                ctx.fillRect(this.x + j * this.partSize, this.y + i * this.partSize, this.partSize, this.partSize);
                            }
                        }
                    }
                }
            }
            
            let player, grid, projectiles, alienProjectiles, explosions, barricades, reloadAnimations, ufo;

            function setupCanvas() {
                const containerWidth = gameContainer.offsetWidth;
                const containerHeight = gameContainer.offsetHeight;
                
                // Calculate optimal block size based on container
                const blockSizeW = containerWidth / cols;
                const blockSizeH = containerHeight / rows;
                blockSize = Math.floor(Math.min(blockSizeW, blockSizeH));
                
                // Set reasonable bounds for block size
                const minBlockSize = 15;
                const maxBlockSize = 40;
                blockSize = Math.max(minBlockSize, Math.min(maxBlockSize, blockSize));
                
                // Set canvas dimensions - this sets the actual pixel dimensions
                canvas.width = cols * blockSize;
                canvas.height = rows * blockSize;
                
                // Reset any CSS transforms that might interfere
                canvas.style.transform = 'none';
                
                ctx.imageSmoothingEnabled = false;
                
                // Update invader speed based on new canvas dimensions
                if (grid) {
                    grid.updateVelocity();
                }
            }

            function init() {
                score = 0;
                gameOver = false;
                projectiles = [];
                alienProjectiles = [];
                explosions = [];
                barricades = [];
                reloadAnimations = [];
                lastStandMode = false;
                invadersAreVulnerable = false;
                ufoHitCount = 0;
                ufoPowerUpHitCounter = 0;
                playerDestructionTimer = 0;
                isPaused = false;
                
                player = new Player();
                grid = new InvaderGrid();
                ufo = new UFO();

                // Adjust barricade count based on canvas width
                const baseWidth = 350;
                const widthReduction = Math.max(0, baseWidth - canvas.width);
                const barricadeAdjustment = Math.floor(widthReduction / 100); // Reduce barricades for every 100px reduction
                const barricadeCount = Math.max(2, 4 - barricadeAdjustment); // Minimum 2 barricades
                
                const barricadeWidth = blockSize * 1.8;
                const totalBarricadeWidth = barricadeCount * barricadeWidth;
                const spacing = (canvas.width - totalBarricadeWidth) / (barricadeCount + 1);
                
                barricades = [];
                for(let i = 0; i < barricadeCount; i++) {
                    barricades.push(new Barricade(spacing * (i + 1) + (i * barricadeWidth)));
                }
            }

            function drawKey(x, y, width, height, text, isPressed) {
                const cornerRadius = height * 0.2;
                const bevelOffset = height * 0.08;
                const alpha = 0.9; // Transparency

                if (isPressed) {
                    ctx.fillStyle = `rgba(34, 34, 34, ${alpha})`; // #222
                    ctx.beginPath();
                    ctx.roundRect(x, y, width, height, cornerRadius);
                    ctx.fill();

                    ctx.fillStyle = `rgba(153, 51, 255, ${alpha * 0.7})`;
                    ctx.beginPath();
                    ctx.roundRect(x, y - bevelOffset, width, height, cornerRadius);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(102, 51, 153, ${alpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(x, y - bevelOffset, width, height, cornerRadius);
                    ctx.stroke();
                    
                    ctx.fillStyle = `rgba(224, 224, 224, ${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(34, 34, 34, ${alpha * 0.5})`;
                    ctx.beginPath();
                    ctx.roundRect(x, y, width, height, cornerRadius);
                    ctx.fill();

                    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
                    ctx.beginPath();
                    ctx.roundRect(x, y - bevelOffset, width, height, cornerRadius);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(102, 51, 153, ${alpha * 0.5})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(x, y - bevelOffset, width, height, cornerRadius);
                    ctx.stroke();
                    
                    ctx.fillStyle = `rgba(224, 224, 224, ${alpha * 0.5})`;
                }
                
                const fontSize = height * (text === 'spacebar' ? 0.38 : 0.4);
                const fontFamily = text === 'spacebar' ? 'Arial' : '"Press Start 2P"';
                ctx.font = 'bold ' + fontSize + 'px ' + fontFamily;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x + width / 2, y - bevelOffset + height / 2);
            }
            
            function drawControls() {
                const keySize = blockSize * 1.1; 
                const keyPadding = blockSize * 0.22;
                const topY = canvas.height - (blockSize * 7); 
                const centerX = canvas.width / 2;

                const arrowKeysTotalWidth = (keySize * 2) + keyPadding;
                const arrowStartX = centerX - (arrowKeysTotalWidth / 2);

                drawKey(arrowStartX, topY, keySize, keySize, '←', keys['ArrowLeft'] || keys['KeyA']);
                drawKey(arrowStartX + keySize + keyPadding, topY, keySize, keySize, '→', keys['ArrowRight'] || keys['KeyD']);

                const spacebarWidth = arrowKeysTotalWidth * 1.5;
                const spacebarHeight = keySize * 0.9;
                const spacebarX = centerX - (spacebarWidth / 2);
                const spacebarY = topY + keySize + keyPadding;
                
                drawKey(spacebarX, spacebarY, spacebarWidth, spacebarHeight, 'spacebar', keys['Space']);
            }

            function drawPauseOverlay() {
                // Draw semi-transparent overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw "Resizing" message
                ctx.fillStyle = '#FFFFFF'; 
                ctx.font = (blockSize * 0.8) + 'px "Arial"'; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Resizing...', canvas.width / 2, canvas.height / 2);
            }

            function animate(time = 0) {
                if (gameOver) return;
                
                // Pause the game during resizing
                if (isPaused) {
                    // Draw the current game state with pause overlay
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw all game elements
                    if (!player.isDestroyed) {
                        drawControls();
                    }
                    player.draw();
                    grid.invaders.forEach(inv => inv.draw());
                    ufo.draw();
                    barricades.forEach(b => b.draw());
                    projectiles.forEach(p => p.draw());
                    alienProjectiles.forEach(p => p.draw());
                    explosions.forEach(e => e.draw());
                    reloadAnimations.forEach(a => a.draw());
                    drawWatermark();
                    drawScore();
                    
                    // Draw pause overlay
                    drawPauseOverlay();
                    
                    // Continue checking for resume
                    animationFrameId = requestAnimationFrame(animate);
                    return;
                }
                
                animationFrameId = requestAnimationFrame(animate);
                
                const deltaTime = time - lastTime;
                lastTime = time;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (player.isDestroyed) {
                    // Handle destruction delay
                    if (playerDestructionTimer > 0) {
                        playerDestructionTimer -= deltaTime;
                        // Just draw the current state without moving invaders yet
                        barricades.forEach(b => b.draw());
                        drawWatermark();
                        drawScore();
                        for (const explosion of explosions) {
                            explosion.draw();
                        }
                        for (const invader of grid.invaders) {
                            invader.draw();
                        }
                        return;
                    }

                    // Draw explosions as they fade out
                    for (let i = explosions.length - 1; i >= 0; i--) {
                        const explosion = explosions[i];
                        explosion.timer -= deltaTime;
                        if (explosion.timer <= 0) {
                            explosions.splice(i, 1);
                        } else {
                            explosion.draw();
                        }
                    }

                    // Rapidly descend all remaining invaders
                    let invadersStillOnScreen = false;
                    for (const invader of grid.invaders) {
                        invader.y += verticalDescentSpeed; // Use adjusted descent speed
                        invader.draw();
                        if (invader.y < canvas.height) {
                            invadersStillOnScreen = true;
                        }
                    }

                    // Draw remaining elements that should persist
                    barricades.forEach(b => b.draw());
                    for (const invader of grid.invaders) {
                        invader.draw();
                    }
                    drawWatermark();
                    drawScore();

                    // End the game only after all invaders are off-screen AND explosions are done
                    if (!invadersStillOnScreen && explosions.length === 0) {
                        endGame(false);
                    }
                    
                    return; // Skip the rest of the game loop
                }
                
                // --- Draw background elements first ---
                if (!player.isDestroyed) {
                    drawControls();
                }

                if (invadersAreVulnerable) {
                    invaderVulnerableTimer -= deltaTime;
                    if (invaderVulnerableTimer <= 0) {
                        invadersAreVulnerable = false;
                        grid.invaders.forEach(inv => inv.isVulnerable = false);
                    }
                }

                player.update(deltaTime);
                grid.update(deltaTime);
                ufo.update(deltaTime);
                barricades.forEach(barricade => barricade.draw());
                
                alienFireTimer -= deltaTime;
                if (lastStandMode) {
                    if (alienFireTimer <= 0 && grid.invaders.length > 0) {
                        alienFireTimer = 400;
                        for (const invader of grid.invaders) {
                            if (!invader.isDying) {
                                alienProjectiles.push(new AlienProjectile(invader.x + invader.width / 2, invader.y + invader.height));
                            }
                        }
                    }
                } else {
                    if (alienFireTimer <= 0 && grid.invaders.length > 0 && alienProjectiles.length < 2) {
                        alienFireTimer = alienFireInterval;
                        const firingInvader = grid.invaders[Math.floor(Math.random() * grid.invaders.length)];
                        if (firingInvader) {
                            alienProjectiles.push(new AlienProjectile(firingInvader.x + firingInvader.width / 2, firingInvader.y + firingInvader.height));
                        }
                    }
                }

                for (let i = explosions.length - 1; i >= 0; i--) {
                    const explosion = explosions[i];
                    explosion.timer -= deltaTime;
                    if(explosion.timer <= 0) {
                        explosions.splice(i, 1);
                    } else {
                        explosion.draw();
                    }
                }
                
                for (let i = reloadAnimations.length - 1; i >= 0; i--) {
                    const anim = reloadAnimations[i];
                    anim.update(deltaTime);
                    if (anim.timer <= 0) {
                        reloadAnimations.splice(i, 1);
                    } else {
                        anim.draw();
                    }
                }

                for (let i = projectiles.length - 1; i >= 0; i--) {
                    const p = projectiles[i];
                    p.update();

                    if (p.y < 0) {
                        projectiles.splice(i, 1);
                        continue;
                    }
                    
                    if (ufo.active && !ufo.isHit && p.y < ufo.y + ufo.height && p.y + p.height > ufo.y &&
                        p.x < ufo.x + ufo.width && p.x + p.width > ufo.x) {
                        ufo.takeHit();
                        projectiles.splice(i, 1);
                        continue;
                    }

                    let projectileHit = false;
                    for (let j = grid.invaders.length - 1; j >= 0; j--) {
                        const invader = grid.invaders[j];
                        if (!invader.isDying && p.y < invader.y + invader.height && p.y + p.height > invader.y &&
                            p.x < invader.x + invader.width && p.x + p.width > invader.x) {
                            
                            if (invader.isVulnerable) {
                                invader.health = 0;
                            } else {
                                invader.health--;
                            }
                            
                            invader.isHit = true;
                            invader.hitTimer = 100;
                            updateScore(5);

                            if (invader.health <= 0) {
                                invader.isDying = true;
                                invader.deathTimer = 150;
                            }
                            
                            projectiles.splice(i, 1);
                            projectileHit = true;
                            break; 
                        }
                    }
                    if (projectileHit) continue;

                    for (let j = barricades.length - 1; j >= 0; j--) {
                        const barricade = barricades[j];
                        const gridX = Math.floor((p.x - barricade.x) / barricade.partSize);
                        const gridY = Math.floor((p.y - barricade.y) / barricade.partSize);
                        if (barricade.grid[gridY] && barricade.grid[gridY][gridX] === 1) {
                            
                            let partsToRemove = Math.floor(Math.random() * 3) + 1;
                            let neighbors = [[0,0], [0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];

                            for (let k = 0; k < partsToRemove; k++) {
                                if (neighbors.length === 0) break;
                                const [dx, dy] = neighbors.splice(Math.floor(Math.random() * neighbors.length), 1)[0];
                                const checkX = gridX + dx;
                                const checkY = gridY + dy;
                                if (barricade.grid[checkY] && barricade.grid[checkY][checkX] === 1) {
                                    barricade.grid[checkY][checkX] = 0;
                                    barricade.currentParts--;
                                }
                            }

                            projectiles.splice(i, 1);
                            projectileHit = true;
                            break;
                        }
                    }
                     if (projectileHit) continue;
                }

                for (let i = grid.invaders.length - 1; i >= 0; i--) {
                    const invader = grid.invaders[i];
                    if (invader.isDying) {
                        invader.deathTimer -= deltaTime;
                        if (invader.deathTimer <= 0) {
                            explosions.push(new Explosion(invader.x + invader.width / 2, invader.y + invader.height / 2));
                            grid.invaders.splice(i, 1);
                            updateScore(10);
                        }
                    }
                }

                if (grid.invaders.length === 0 && !gameOver) {
                    endGame(true);
                    return;
                }

                for (let i = barricades.length - 1; i >= 0; i--) {
                    const barricade = barricades[i];
                    let shouldExplode = false;

                    for (const invader of grid.invaders) {
                         if (invader.x < barricade.x + barricade.width &&
                            invader.x + invader.width > barricade.x &&
                            invader.y < barricade.y + barricade.height &&
                            invader.y + invader.height > barricade.y) {
                                shouldExplode = true;
                                break;
                            }
                    }
                    
                    const damagePercentage = barricade.initialParts > 0 ? (barricade.initialParts - barricade.currentParts) / barricade.initialParts : 0;
                    if (damagePercentage > 0.42) {
                        shouldExplode = true;
                    }

                    if (shouldExplode) {
                        for(let k = 0; k < 10; k++) {
                            const randomX = barricade.x + Math.random() * barricade.width;
                            const randomY = barricade.y + Math.random() * barricade.height;
                            explosions.push(new Explosion(randomX, randomY));
                        }
                        barricades.splice(i, 1);
                        updateScore(-25);
                    }
                }


                 for (let i = alienProjectiles.length - 1; i >= 0; i--) {
                    const p = alienProjectiles[i];
                    p.update();

                    if (p.y + p.height > canvas.height) {
                        alienProjectiles.splice(i, 1);
                        continue;
                    }

                    if (!player.isDestroyed && p.y < player.y + player.height && p.y + p.height > player.y &&
                        p.x < player.x + player.width && p.x + p.width > player.x) {
                        
                        alienProjectiles.splice(i, 1);

                        if (player.isCritical) {
                            player.isDestroyed = true;
                            explosions.push(new Explosion(player.x + player.width / 2, player.y + player.height / 2));
                            playerDestructionTimer = 500; // Half second delay before invaders descend
                        } else {
                            player.health--;
                            if(player.health <= 1) {
                                player.isCritical = true;
                            }
                            player.isHit = true;
                            player.hitTimer = 200;
                            updateScore(-5);
                        }
                        continue;
                    }

                    for (let j = barricades.length - 1; j >= 0; j--) {
                        const barricade = barricades[j];
                        const gridX = Math.floor((p.x - barricade.x) / barricade.partSize);
                        const gridY = Math.floor((p.y - barricade.y) / barricade.partSize);
                        if (barricade.grid[gridY] && barricade.grid[gridY][gridX] === 1) {
                             barricade.grid[gridY][gridX] = 0;
                             barricade.currentParts--;
                            alienProjectiles.splice(i, 1);
                            break;
                        }
                    }
                }

                if (!lastStandMode && grid.invaders.length > 0) {
                    if (grid.invaders.some(inv => inv.y + inv.height >= player.y - 47)) {
                        lastStandMode = true;
                        alienFireTimer = 0.7;
                    }
                }
                
                drawWatermark();
                // Draw score on top of everything
                drawScore();
            }

            function drawWatermark() {
                const watermarkText = '© TAITO CORPORATION 1978 ALL RIGHTS RESERVED'; 
                const watermarkFontSize = blockSize * 0.22; 
                ctx.font = watermarkFontSize + 'px "Press Start 2P", cursive'; 
                ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; 
                ctx.textAlign = 'center'; 
                ctx.textBaseline = 'bottom'; 
                
                // Measure the text width
                const textWidth = ctx.measureText(watermarkText).width;
                const maxWidth = canvas.width * 0.9; // Allow 9% margin on each side
                
                if (textWidth > maxWidth) {
                    // Text is too wide - split into two lines
                    const words = watermarkText.split(' ');
                    const midPoint = Math.ceil(words.length / 2);
                    const line1 = words.slice(0, midPoint).join(' ');
                    const line2 = words.slice(midPoint).join(' ');
                    
                    // Draw both lines snapped to bottom
                    ctx.fillText(line1, canvas.width / 2, canvas.height - blockSize * 0.33);
                    ctx.fillText(line2, canvas.width / 2, canvas.height - blockSize * 0.08);
                } else {
                    // Text fits on one line, snap to bottom
                    ctx.fillText(watermarkText, canvas.width / 2, canvas.height - blockSize * 0.1);
                }
            }

            function drawScore() {
                const scoreText = `Score: ${score}`;
                ctx.font = `${blockSize * 0.7}px "Press Start 2P"`;
                let flashColor = '#FFD700';
                if (isFlashingScore && isFlashingScoreNegative) {
                    flashColor = '#DC143C';
                }

                if (isFlashingScore) {
                    const elapsed = Date.now() - scoreFlashStartTime;
                    ctx.fillStyle = (elapsed < scoreFlashDuration && Math.floor(elapsed / 100) % 2 === 0) ? flashColor : '#F5F5F5';
                    if (elapsed >= scoreFlashDuration) {
                        isFlashingScore = false;
                        isFlashingScoreNegative = false;
                    }
                } else {
                    ctx.fillStyle = '#F5F5F5';
                }
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(scoreText, canvas.width / 2, 10);

                if (player && player.isCritical && !player.isDestroyed) {
                    if (Math.floor(Date.now() / 300) % 2 === 0) {
                        ctx.fillStyle = '#DC143C';
                        ctx.font = `${blockSize * 0.55}px "Press Start 2P"`;
                        ctx.fillText('CRITICAL DAMAGE!', canvas.width / 2, blockSize * 2.5);
                    }
                }
            }

            let isFlashingScoreNegative = false;
            function updateScore(points) {
                score += points;
                isFlashingScore = true;
                isFlashingScoreNegative = points < 0;
                scoreFlashStartTime = Date.now();
            }
            
            function startGame() {
                startScreen.classList.add('hidden');
                gameOverScreen.classList.add('hidden');
                gameOverScreen.querySelector('.title').textContent = "Game Over";
                setupCanvas();
                init();
                lastTime = performance.now();
                animate(lastTime);
                postParent('gameStarted');
            }

            function endGame(isWin = false) {
                if(gameOver) return;
                gameOver = true;
                cancelAnimationFrame(animationFrameId);
                
                // Round-up negative score
                if (score < 0) {
                    score = 0;
                }

                const titleElement = gameOverScreen.querySelector('.title');
                if (isWin) {
                    titleElement.textContent = "YOU WIN!";
                } else {
                    titleElement.textContent = "Game Over";
                }

                finalScoreElement.textContent = `Final Score: ${score}`;
                gameOverScreen.classList.remove('hidden');
                postParent('gameEnded');
            }

            // --- Event Listeners ---
            startButton.addEventListener('click', startGame);
            retryButton.addEventListener('click', startGame);

            window.addEventListener('keydown', (e) => {
                if (player && !player.isDestroyed && !isPaused) {
                    keys[e.code] = true;
                    if (e.code === 'Space' && !isReloading) {
                        const now = performance.now();
                        if(now - lastShotTime > quickFireThreshold) {
                            playerShotCount = 0;
                        }
                        lastShotTime = now;
                        
                        projectiles.push(new Projectile(player.x + player.width / 2 - 1.5, player.y, -5));
                        playerShotCount++;

                        if (playerShotCount >= 3) {
                            isReloading = true;
                            playerShotCount = 0;
                            reloadAnimations.push(new ReloadAnimation(player));
                            setTimeout(() => { isReloading = false; }, reloadTime);
                        }
                    }
                }
            });

            window.addEventListener('keyup', (e) => {
                keys[e.code] = false;
            });

            window.addEventListener('message', (event) => {
                // Check if origin is allowed
                if (PARENT_ORIGIN !== '*' && event.origin !== PARENT_ORIGIN) return;
                
                if (event.data && event.data.type && event.data.code) {
                    const keyboardEvent = new KeyboardEvent(event.data.type, { code: event.data.code, bubbles: true });
                    window.dispatchEvent(keyboardEvent);
                }
            });
            
            window.addEventListener('resize', () => {
                // Clear any existing timeout
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                
                // Pause the game
                isPaused = true;
                
                // Set up the resize timeout
                resizeTimeout = setTimeout(() => {
                    setupCanvas();
                    if (!gameOver && player) {
                        // Recalculate player position and other game elements
                        player.x = (canvas.width / 2) - (player.width / 2);
                        player.y = canvas.height - player.height - blockSize;
                        
                        // Recalculate barricade positions
                        const barricadeWidth = blockSize * 1.8;
                        const totalBarricadeWidth = barricades.length * barricadeWidth;
                        const spacing = (canvas.width - totalBarricadeWidth) / (barricades.length + 1);
                        
                        barricades.forEach((barricade, i) => {
                            barricade.x = spacing * (i + 1) + (i * barricadeWidth);
                            barricade.y = canvas.height - (blockSize * 3.8);
                        });
                        
                        // Update invader speed
                        if (grid) {
                            grid.updateVelocity();
                        }
                    }
                    
                    // Resume the game
                    isPaused = false;
                    resizeTimeout = null;
                    
                    // Reset lastTime to avoid large deltaTime after pause
                    lastTime = performance.now();
                }, RESIZE_DELAY);
            });
            setupCanvas();
        })();
        </script>
    </body>
    </html>
    `;
    res.send(gameContent);
});

const port = parseInt(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log(`Invaders Game: listening on port ${port}`);
});
