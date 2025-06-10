class FlappyBirdWebGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('videoElement');
        this.processedCanvas = document.getElementById('processedCanvas');
        this.processedCtx = this.processedCanvas.getContext('2d');
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.musicPlaying = true; // Music starts playing by default
        this.lastStatus = null;

        this.ws = null;
        this.mediaStream = null;
        this.cameraActive = false;
        this.gameState = null;
        this.isProcessingFrame = false;
        
        // Game grid configuration (20x10 grid untuk konsistensi dengan backend)
        this.gridWidth = 20;
        this.gridHeight = 10;
        this.cellWidth = this.canvas.width / this.gridWidth;
        this.cellHeight = this.canvas.height / this.gridHeight;
        
        // Asset management
        this.images = {};
        this.assetsLoaded = false;
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameRate = 10;

        // Game state management
        this.gameMode = 'preview'; // 'preview', 'playing', 'paused', 'game_over'
        this.autoStartCamera = true; // Auto start camera on load
        this.currentBird = 'bird'; // Default bird
        this.previousBird = 'bird';

        this.initializeGame();
    }

    async initializeGame() {
        await this.loadAssets();
        this.setupEventListeners();
        this.setupWebSocket();
        this.startRenderLoop();

        // Auto start camera and music for preview mode
        if (this.autoStartCamera) {
            setTimeout(() => {
                this.startCameraForPreview();
            }, 1000);
        }
        
        // Start background music
        this.playBackgroundMusic();
        
        // Show initial status
        this.showStatus('Preview mode - Move your head up/down to control the bird!', 'info');
    }

    async loadAssets() {
        const assetPaths = {
            background: '/static/assets/background-day.png',
            bird: '/static/assets/bluebird-midflap.png',
            redBird: '/static/assets/redbird-midflap.png',
            yellowBird: '/static/assets/yellowbird-midflap.png',
            pipe: '/static/assets/pipe-green.png',
            base: '/static/assets/base.png',
            music: '/static/assets/music-bg.mp3' // Optional preload
        };

        const loadPromises = Object.keys(assetPaths).map(key => {
            if (key === 'music') {
                return new Promise((resolve) => {
                    const audio = new Audio();
                    audio.oncanplaythrough = () => {
                        this.images[key] = audio; // Store for reference if needed
                        resolve();
                    };
                    audio.onerror = () => {
                        console.warn(`Failed to load ${key}, continuing without preload`);
                        resolve();
                    };
                    audio.src = assetPaths[key];
                });
            }
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load ${key} image, using fallback`);
                    this.images[key] = null;
                    resolve();
                };
                img.src = assetPaths[key];
            });
        });

        await Promise.all(loadPromises);
        this.assetsLoaded = true;
        console.log('Assets loaded successfully');
    }

    setupEventListeners() {
        // Camera toggle button
        document.getElementById('toggleCamera').addEventListener('click', () => {
            this.toggleCamera();
        });

        // Start game button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startActualGame();
        });

        // Pause game button
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseGame();
        });

        // Game restart button
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        // Play again button (from modal)
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.hideGameOverModal();
            this.restartGame();
        });

        // Music toggle button
        document.getElementById('musicToggleBtn').addEventListener('click', () => {
            this.toggleMusic();
        });

        document.getElementById('selectBirdBtn').addEventListener('click', () => {
            this.showBirdSelectionModal();
        });

        document.getElementById('birdOptions').addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                const birdType = e.target.getAttribute('data-bird');
                this.currentBird = birdType; 
                document.querySelectorAll('#birdOptions img').forEach(img => img.classList.remove('border-4', 'border-green-500'));
                e.target.classList.add('border-4', 'border-green-500');
                console.log(`Selected bird: ${this.currentBird}`);
            }
        });

        document.getElementById('confirmBirdBtn').addEventListener('click', () => {
            this.hideBirdSelectionModal();
            this.showStatus(`Switched to ${this.currentBird === 'bird' ? 'Blue' : this.currentBird === 'redBird' ? 'Red' : 'Yellow'} Bird!`, 'success');
        });

        document.getElementById('cancelBirdBtn').addEventListener('click', () => {
            this.currentBird = this.previousBird; 
            this.hideBirdSelectionModal();
            document.querySelectorAll('#birdOptions img').forEach(img => {
                img.classList.remove('border-4', 'border-green-500');
                if (img.getAttribute('data-bird') === this.currentBird) {
                    img.classList.add('border-4', 'border-green-500');
                }
            });
        });

        // Keyboard controls sebagai fallback (spacebar untuk jump)
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !this.cameraActive) {
                event.preventDefault();
                this.sendManualJump();
            }
        });
    }

    showBirdSelectionModal() {
        const modal = document.getElementById('birdSelectionModal');
        this.previousBird = this.currentBird; 
        modal.classList.add('show');
        document.querySelectorAll('#birdOptions img').forEach(img => {
            img.classList.remove('border-4', 'border-green-500');
            if (img.getAttribute('data-bird') === this.currentBird) {
                img.classList.add('border-4', 'border-green-500');
            }
        });
    }

    hideBirdSelectionModal() {
        const modal = document.getElementById('birdSelectionModal');
        modal.classList.remove('show');
    }

    playBackgroundMusic() {
        if (this.backgroundMusic && this.musicPlaying) {
            this.backgroundMusic.play().catch(error => {
                console.error('Error playing background music:', error);
                this.showStatus('Could not play background music', 'error');
            });
        }
    }

    toggleMusic() {
        if (this.musicPlaying) {
            this.backgroundMusic.pause();
            this.musicPlaying = false;
            document.getElementById('musicToggleBtn').textContent = 'Music Off';
            document.getElementById('musicToggleBtn').className = 
                'bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 ml-2';
            this.showStatus('Background music paused', 'info');
        } else {
            this.backgroundMusic.play().catch(error => {
                console.error('Error playing background music:', error);
                this.showStatus('Could not play background music', 'error');
            });
            this.musicPlaying = true;
            document.getElementById('musicToggleBtn').textContent = 'Music On';
            document.getElementById('musicToggleBtn').className = 
                'bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 ml-2';
            this.showStatus('Background music playing', 'info');
        }
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.showStatus('Connected to game server', 'success');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.showStatus('Disconnected from server. Reconnecting...', 'warning');
            this.backgroundMusic.pause(); // Pause music on disconnect
            
            // Reconnect after 3 seconds
            setTimeout(() => {
                if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                    this.setupWebSocket();
                }
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showStatus('Connection error', 'error');
            this.backgroundMusic.pause; // Pause music on error
        };
    }

    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'game_state':
                this.gameState = data.data;
                
                // Update game mode from server
                if (this.gameState.game_mode) {
                    this.gameMode = this.gameState.game_mode;
                    this.updateGameButtons();
                    // Resume music if returning to preview or playing mode
                    if (this.gameMode === 'preview' || this.gameMode === 'playing') {
                        this.playBackgroundMusic();
                    }
                }
                
                this.updateUI();
                
                // Show game over modal if game ended
                if (this.gameState.game_over) {
                    if (document.getElementById('gameOverModal').classList.contains('hidden')) {
                        setTimeout(() => {
                            this.showGameOverModal();
                            this.backgroundMusic.pause(); // Pause music on game over
                        }, 500); // Small delay for better UX
                    }
                }
                break;
                
            case 'video_processed':
                this.displayProcessedVideo(data.frame);
                this.isProcessingFrame = false;
                break;
                
            case 'info':
                this.showStatus(data.message, 'info');
                break;
                
            case 'error':
                console.error('Server error:', data.message);
                this.showStatus(data.message, 'error');
                this.isProcessingFrame = false;
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    async toggleCamera() {
        const button = document.getElementById('toggleCamera');
        
        if (!this.cameraActive) {
            await this.startCamera(button);
        } else {
            this.stopCamera(button);
        }
    }

    async startCamera(button) {
        try {
            // Request camera access with specific constraints
            const constraints = {
                video: {
                    width: { exact: 300 },
                    height: { exact: 225 },
                    facingMode: 'user', // Front-facing camera
                    frameRate: { ideal: 15, max: 30 }
                }
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.mediaStream;
            
            // Wait for video metadata to load
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    console.log(`Video dimensions: ${this.video.videoWidth}x${this.video.videoHeight}`);
                    resolve();
                };
            });

            // Start video playback
            await this.video.play();
            
            // Update UI
            this.cameraActive = true;
            button.textContent = 'Stop Camera';
            button.className = button.className.replace('bg-green-500 hover:bg-green-600', 'bg-red-500 hover:bg-red-600');
            
            this.showStatus('Camera started! Move your head up/down to control the bird', 'success');
            
            // Start video processing after a short delay
            setTimeout(() => {
                this.startVideoProcessing();
            }, 200);
            
        } catch (error) {
            console.error('Camera error:', error);
            let errorMessage = 'Camera access denied';
            
            if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is in use by another application';
            }
            
            this.showStatus(errorMessage, 'error');
        }
    }

    stopCamera(button) {
        // Stop all media tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.label);
            });
            this.mediaStream = null;
        }

        // Reset video element
        this.video.srcObject = null;
        this.cameraActive = false;
        this.isProcessingFrame = false;

        // Show original video, hide processed canvas
        this.video.style.display = 'block';
        this.processedCanvas.style.display = 'none';

        // Update button
        button.textContent = '📷 Start Camera';
        button.className = button.className.replace('bg-red-500 hover:bg-red-600', 'bg-green-500 hover:bg-green-600');
        
        this.showStatus('Camera stopped', 'info');
    }

    startVideoProcessing() {
        if (!this.cameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const processFrame = () => {
            // Check if we should continue processing
            if (!this.cameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            // Rate limiting - process at specified frame rate
            const currentTime = Date.now();
            if (currentTime - this.lastFrameTime < 1000 / this.frameRate) {
                requestAnimationFrame(processFrame);
                return;
            }

            // Check if already processing a frame
            if (this.isProcessingFrame) {
                requestAnimationFrame(processFrame);
                return;
            }

            // Check if video is ready
            if (this.video.readyState < 2) {
                requestAnimationFrame(processFrame);
                return;
            }

            try {
                // Capture frame from video
                const canvas = document.createElement('canvas');
                const videoWidth = this.video.videoWidth || 640;
                const videoHeight = this.video.videoHeight || 480;
                
                canvas.width = videoWidth;
                canvas.height = videoHeight;
                
                const ctx = canvas.getContext('2d');
                
                if (videoWidth > 0 && videoHeight > 0) {
                    // Draw video frame to canvas
                    ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
                    
                    // Convert to base64 with compression
                    const frameData = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // Send to server for processing
                    this.isProcessingFrame = true;
                    this.lastFrameTime = currentTime;
                    
                    this.ws.send(JSON.stringify({
                        type: 'video_frame',
                        frame: frameData
                    }));
                }
            } catch (error) {
                console.error('Error capturing video frame:', error);
                this.isProcessingFrame = false;
            }

            // Schedule next frame
            requestAnimationFrame(processFrame);
        };

        // Start the processing loop
        console.log('Starting video processing loop');
        processFrame();
    }

    displayProcessedVideo(frameData) {
        try {
            const img = new Image();
            img.onload = () => {
                // Tetapkan ukuran kanvas ke nilai tetap
                this.processedCanvas.width = 300; // Lebar tetap
                this.processedCanvas.height = 225; // Tinggi tetap
                
                // Skala gambar agar sesuai dengan kanvas
                const scale = Math.min(this.processedCanvas.width / img.width, this.processedCanvas.height / img.height);
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;
                
                // Hapus kanvas sebelum menggambar
                this.processedCtx.clearRect(0, 0, this.processedCanvas.width, this.processedCanvas.height);
                // Gambar gambar yang diskalakan di tengah kanvas
                this.processedCtx.drawImage(
                    img,
                    (this.processedCanvas.width - newWidth) / 2,
                    (this.processedCanvas.height - newHeight) / 2,
                    newWidth,
                    newHeight
                );
                
                // Tampilkan kanvas yang diproses
                this.video.style.display = 'none';
                this.processedCanvas.style.display = 'block';
            };
            
            img.onerror = () => {
                console.error('Error loading processed frame');
                this.isProcessingFrame = false;
            };
            
            img.src = frameData;
        } catch (error) {
            console.error('Error displaying processed video:', error);
            this.isProcessingFrame = false;
        }
    }

    sendManualJump() {
        // Fallback manual control when camera is not active
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'manual_jump'
            }));
        }
    }

    updateUI() {
        if (!this.gameState) return;

        const scoreElement = document.getElementById('score');
        const highscoreElement = document.getElementById('highscore');

        if (scoreElement) scoreElement.textContent = this.gameState.score;
        if (highscoreElement) highscoreElement.textContent = this.gameState.highscore;

        if (this.gameState.show_restart_dialog) {
            const countdownElement = document.getElementById('countdownTimer');
            if (countdownElement) {
                countdownElement.textContent = this.gameState.auto_restart_countdown;
            }
        }
    }

    startRenderLoop() {
        const render = () => {
            this.renderGame();
            requestAnimationFrame(render);
        };
        render();
    }

    renderGame() {
        this.clearCanvas();
        
        if (this.gameState && this.assetsLoaded) {
            this.drawBackground();
            
            // Only draw pipes in playing mode
            if (this.gameMode === 'playing' && !this.gameState.preview_mode) {
                this.drawPipes();
            }
            
            this.drawBird();
            this.drawGround();
            
            // Draw game mode indicator
            if (this.gameMode === 'preview') {
                this.drawPreviewOverlay();
            } else if (this.gameMode === 'paused') {
                this.drawPausedOverlay();
            }
        } else {
            this.drawWaitingScreen();
        }
    }

    clearCanvas() {
        // Sky gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground() {
        if (this.images.background) {
            // Tile background image
            const bgWidth = this.images.background.width;
            const bgHeight = this.images.background.height;
            const scaleY = this.canvas.height / bgHeight;
            const scaledWidth = bgWidth * scaleY;
            
            for (let x = 0; x < this.canvas.width; x += scaledWidth) {
                this.ctx.drawImage(this.images.background, x, 0, scaledWidth, this.canvas.height);
            }
        }
    }

    drawBird() {
        if (!this.gameState) return;
        
        const birdX = 2 * this.cellWidth; // Fixed X position
        const birdY = this.gameState.bird_pos_y * this.cellHeight;
        const birdSize = this.cellWidth * 0.8;
        
        if (this.images[this.currentBird]) {
            // Draw bird sprite based on currentBird
            this.ctx.drawImage(
                this.images[this.currentBird],
                birdX - birdSize / 2,
                birdY - birdSize / 2,
                birdSize,
                birdSize
            );
        } else {
            // Fallback: draw simple bird
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(birdX, birdY, birdSize / 3, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Bird eye
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(birdX + birdSize / 8, birdY - birdSize / 8, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawPipes() {
        if (!this.gameState || !this.gameState.pipes) return;
        
        this.gameState.pipes.forEach(pipe => {
            const pipeX = pipe.x * this.cellWidth;
            const gapY = pipe.gap_y;
            const pipeWidth = this.cellWidth * 1.5;
            const gapSize = 3; // Gap size dalam grid units
            
            if (this.images.pipe) {
                // Top pipe (inverted)
                const topPipeHeight = (gapY - gapSize / 2) * this.cellHeight;
                if (topPipeHeight > 0) {
                    this.ctx.save();
                    this.ctx.translate(pipeX + pipeWidth / 2, topPipeHeight);
                    this.ctx.scale(1, -1);
                    this.ctx.drawImage(this.images.pipe, -pipeWidth / 2, 0, pipeWidth, topPipeHeight);
                    this.ctx.restore();
                }
                
                // Bottom pipe
                const bottomPipeY = (gapY + gapSize / 2) * this.cellHeight;
                const bottomPipeHeight = this.canvas.height - bottomPipeY - 50; // Subtract ground height
                if (bottomPipeHeight > 0) {
                    this.ctx.drawImage(
                        this.images.pipe,
                        pipeX,
                        bottomPipeY,
                        pipeWidth,
                        bottomPipeHeight
                    );
                }
            } else {
                // Fallback: draw simple rectangles
                this.ctx.fillStyle = '#228B22';
                
                // Top pipe
                const topPipeHeight = (gapY - gapSize / 2) * this.cellHeight;
                if (topPipeHeight > 0) {
                    this.ctx.fillRect(pipeX, 0, pipeWidth, topPipeHeight);
                }
                
                // Bottom pipe
                const bottomPipeY = (gapY + gapSize / 2) * this.cellHeight;
                const bottomPipeHeight = this.canvas.height - bottomPipeY - 50;
                if (bottomPipeHeight > 0) {
                    this.ctx.fillRect(pipeX, bottomPipeY, pipeWidth, bottomPipeHeight);
                }
                
                // Pipe caps
                this.ctx.fillStyle = '#32CD32';
                if (topPipeHeight > 0) {
                    this.ctx.fillRect(pipeX - 5, topPipeHeight - 20, pipeWidth + 10, 20);
                }
                if (bottomPipeHeight > 0) {
                    this.ctx.fillRect(pipeX - 5, bottomPipeY, pipeWidth + 10, 20);
                }
            }
        });
    }

    drawGround() {
        const groundY = this.canvas.height - 50;
        
        if (this.images.base) {
            // Tile ground image
            const baseWidth = this.images.base.width;
            for (let x = 0; x < this.canvas.width; x += baseWidth) {
                this.ctx.drawImage(this.images.base, x, groundY);
            }
        } else {
            // Fallback: draw simple ground
            this.ctx.fillStyle = '#DEB887';
            this.ctx.fillRect(0, groundY, this.canvas.width, 50);
        }
    }

    drawWaitingScreen() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        
        if (this.gameMode === 'preview') {
            this.ctx.fillText('Flappy Bird Face Control', this.canvas.width / 2, this.canvas.height / 2 - 60);
            this.ctx.font = '18px Arial';
            this.ctx.fillText('Preview Mode - Move your head to control the bird', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Click "Start Game" to begin playing with obstacles!', this.canvas.width / 2, this.canvas.height / 2 + 20);
        } else if (this.gameMode === 'paused') {
            this.ctx.fillText('GAME PAUSED', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '18px Arial';
            this.ctx.fillText('Click Resume to continue', this.canvas.width / 2, this.canvas.height / 2 + 20);
        } else {
            this.ctx.fillText('Flappy Bird Face Control', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.font = '18px Arial';
            this.ctx.fillText('Connecting to game server...', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '14px Arial';
            this.ctx.fillText('Camera will start automatically!', this.canvas.width / 2, this.canvas.height / 2 + 30);
        }
    }

    showGameOverModal() {
        if (!this.gameState) return;
        
        document.getElementById('finalScore').textContent = this.gameState.score;
        document.getElementById('modalHighScore').textContent = this.gameState.highscore;
        
        document.getElementById('gameOverModal').classList.remove('hidden');
        this.showStatus(`Game Over! Score: ${this.gameState.score}`, 'info');
        this.backgroundMusic.pause();
    }

    hideGameOverModal() {
        document.getElementById('gameOverModal').classList.add('hidden');
    }

    restartGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'restart_game'
            }));
            this.gameMode = 'preview'; // Back to preview mode
            this.hideGameOverModal();
            this.updateGameButtons();
            this.playBackgroundMusic(); // Resume music on restart
            this.showStatus('Back to preview mode - Click Start Game to play again!', 'success');
        } else {
            this.showStatus('Cannot restart - not connected to server', 'error');
        }
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('statusMessage');
        if (!statusDiv || this.lastStatus === message) return;
        
        const statusElement = document.createElement('div');
        
        const bgColors = {
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'info': 'bg-blue-500',
            'warning': 'bg-yellow-500'
        };
        
        const bgColor = bgColors[type] || 'bg-blue-500';
        
        statusElement.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg mb-2 transform transition-all duration-300 opacity-0 translate-x-full`;
        statusElement.textContent = message;
        
        statusDiv.appendChild(statusElement);
        
        // Animate in
        requestAnimationFrame(() => {
            statusElement.classList.remove('opacity-0', 'translate-x-full');
        });
        
        // Remove after delay
        setTimeout(() => {
            statusElement.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.parentNode.removeChild(statusElement);
                }
            }, 300);
        }, 3000);
        
        console.log(`[${type.toUpperCase()}] ${message}`);
        this.lastStatus = message;
    }

    async startCameraForPreview() {
        const button = document.getElementById('toggleCamera');
        if (!this.cameraActive) {
            await this.startCamera(button);
            this.showStatus('Camera started! Use Start Game button to begin playing', 'success');
        }
    }

    startActualGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'start_game'
            }));
            this.gameMode = 'playing';
            this.updateGameButtons();
            this.showStatus('Game started! Avoid the pipes!', 'success');
            this.playBackgroundMusic(); // Ensure music is playing
        }
    }

    pauseGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'pause_game'
            }));
            this.gameMode = this.gameMode === 'paused' ? 'playing' : 'paused';
            this.updateGameButtons();
            this.showStatus(this.gameMode === 'paused' ? 'Game paused' : 'Game resumed', 'info');
            if (this.gameMode === 'paused') {
                this.backgroundMusic.pause();
            } else {
                this.playBackgroundMusic();
            }
        }
    }

    updateGameButtons() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const restartBtn = document.getElementById('restartBtn');
        const selectBirdBtn = document.getElementById('selectBirdBtn');
        
        // Update Start button
        if (this.gameMode === 'preview') {
            startBtn.textContent = 'Start Game';
            startBtn.disabled = false;
            startBtn.className = 'bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105';
        } else {
            startBtn.textContent = '🎮 Game Started';
            startBtn.disabled = true;
            startBtn.className = 'bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg cursor-not-allowed opacity-50';
        }
        
        // Update Pause button
        if (this.gameMode === 'playing') {
            pauseBtn.textContent = '⏸️ Pause';
            pauseBtn.disabled = false;
            pauseBtn.className = 'bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 ml-2';
        } else if (this.gameMode === 'paused') {
            pauseBtn.textContent = '▶️ Resume';
            pauseBtn.disabled = false;
            pauseBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 ml-2';
        } else {
            pauseBtn.disabled = true;
            pauseBtn.className = 'bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg cursor-not-allowed opacity-50 ml-2';
        }
        
        // Update Select Bird button
        if (this.gameMode === 'preview') {
            selectBirdBtn.disabled = false;
            selectBirdBtn.className = 'bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 ml-2';
        } else {
            selectBirdBtn.disabled = true;
            selectBirdBtn.className = 'bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg cursor-not-allowed opacity-50 ml-2';
        }
    }

    drawPreviewOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, 80);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PREVIEW MODE', this.canvas.width / 2, 30);
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Move your head up/down • No obstacles • Click Start Game to play', this.canvas.width / 2, 55);
    }

    drawPausedOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Click Resume to continue playing', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Flappy Bird Web Game...');
    try {
        new FlappyBirdWebGame();
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
});