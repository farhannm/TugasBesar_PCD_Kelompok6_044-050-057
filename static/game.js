
class FlappyBirdWebGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('videoElement');
        this.processedCanvas = document.getElementById('processedCanvas');
        this.processedCtx = this.processedCanvas.getContext('2d');
        
        this.ws = null;
        this.mediaStream = null;
        this.cameraActive = false;
        this.gameState = null;
        
        this.gridWidth = 20;
        this.gridHeight = 10;
        this.cellWidth = this.canvas.width / this.gridWidth;
        this.cellHeight = this.canvas.height / this.gridHeight;
        
        this.images = {};
        this.loadAssets();
        this.setupEventListeners();
        this.setupWebSocket();
        
        // Start render loop
        this.render();
    }

    loadAssets() {
        const assetPaths = {
            background: '/static/assets/background-day.png',
            bird: '/static/assets/bluebird-midflap.png',
            pipe: '/static/assets/pipe-green.png',
            base: '/static/assets/base.png'
        };

        Object.keys(assetPaths).forEach(key => {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
            };
            img.onerror = () => {
                console.warn(`Failed to load ${key} image, using fallback`);
                this.images[key] = null;
            };
            img.src = assetPaths[key];
        });
    }

    setupEventListeners() {
        document.getElementById('toggleCamera').addEventListener('click', () => {
            this.toggleCamera();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.hideGameOverModal();
            this.restartGame();
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.showStatus('Connected to game server', 'success');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            this.showStatus('Disconnected from server', 'error');
            setTimeout(() => this.setupWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            this.showStatus('Connection error', 'error');
        };
    }

    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'game_state':
                this.gameState = data.data;
                this.updateUI();
                if (this.gameState.game_over) {
                    this.showGameOverModal();
                }
                break;
            case 'video_processed':
                this.displayProcessedVideo(data.frame);
                break;
            case 'error':
                this.showStatus(data.message, 'error');
                break;
        }
    }

    async toggleCamera() {
        const button = document.getElementById('toggleCamera');
        
        if (!this.cameraActive) {
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                this.video.srcObject = this.mediaStream;
                this.cameraActive = true;
                button.textContent = '📷 Stop Camera';
                button.className = button.className.replace('bg-green-500 hover:bg-green-600', 'bg-red-500 hover:bg-red-600');
                
                this.showStatus('Camera started successfully', 'success');
                this.startVideoProcessing();
            } catch (error) {
                this.showStatus('Camera access denied', 'error');
            }
        } else {
            this.stopCamera();
            button.textContent = '📷 Start Camera';
            button.className = button.className.replace('bg-red-500 hover:bg-red-600', 'bg-green-500 hover:bg-green-600');
        }
    }

    stopCamera() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        this.cameraActive = false;
        this.video.style.display = 'block';
        this.processedCanvas.style.display = 'none';
    }

    startVideoProcessing() {
        const processFrame = () => {
            if (!this.cameraActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                if (this.cameraActive) {
                    setTimeout(processFrame, 100);
                }
                return;
            }

            // Capture frame from video
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // Convert to base64 and send to server
            const frameData = canvas.toDataURL('image/jpeg', 0.8);
            this.ws.send(JSON.stringify({
                type: 'video_frame',
                frame: frameData
            }));

            setTimeout(processFrame, 100); // Process at ~10 FPS
        };

        // Wait for video to be ready
        this.video.addEventListener('loadedmetadata', () => {
            setTimeout(processFrame, 500);
        });
    }

    displayProcessedVideo(frameData) {
        const img = new Image();
        img.onload = () => {
            this.processedCanvas.width = img.width;
            this.processedCanvas.height = img.height;
            this.processedCtx.drawImage(img, 0, 0);
            
            // Switch to processed canvas
            this.video.style.display = 'none';
            this.processedCanvas.style.display = 'block';
        };
        img.src = frameData;
    }

    updateUI() {
        if (!this.gameState) return;
        
        document.getElementById('score').textContent = this.gameState.score;
        document.getElementById('highscore').textContent = this.gameState.highscore;
    }

    render() {
        this.clearCanvas();
        
        if (this.gameState) {
            this.drawBackground();
            this.drawPipes();
            this.drawBird();
            this.drawGround();
        } else {
            this.drawWaitingScreen();
        }

        requestAnimationFrame(() => this.render());
    }

    clearCanvas() {
        this.ctx.fillStyle = '#70c5ce';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground() {
        if (this.images.background) {
            // Tile background
            const bgWidth = this.images.background.width;
            const bgHeight = this.images.background.height;
            for (let x = 0; x < this.canvas.width; x += bgWidth) {
                this.ctx.drawImage(this.images.background, x, 0, bgWidth, this.canvas.height);
            }
        }
    }

    drawBird() {
        const birdX = 2 * this.cellWidth;
        const birdY = this.gameState.bird_pos_y * this.cellHeight;
        
        if (this.images.bird) {
            this.ctx.drawImage(this.images.bird, 
                birdX - this.cellWidth/2, birdY - this.cellHeight/2, 
                this.cellWidth, this.cellHeight);
        } else {
            // Fallback: draw colored circle
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(birdX, birdY + this.cellHeight/2, this.cellWidth/3, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Bird eye
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(birdX + this.cellWidth/6, birdY + this.cellHeight/3, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawPipes() {
        this.gameState.pipes.forEach(pipe => {
            const pipeX = pipe.x * this.cellWidth;
            const gapY = pipe.gap_y;
            const pipeWidth = this.cellWidth * 1.5;
            
            if (this.images.pipe) {
                // Top pipe (flipped)
                this.ctx.save();
                this.ctx.translate(pipeX + pipeWidth/2, (gapY - 1) * this.cellHeight);
                this.ctx.scale(1, -1);
                this.ctx.drawImage(this.images.pipe, -pipeWidth/2, 0, pipeWidth, (gapY - 1) * this.cellHeight);
                this.ctx.restore();
                
                // Bottom pipe
                this.ctx.drawImage(this.images.pipe, 
                    pipeX, (gapY + 2) * this.cellHeight, 
                    pipeWidth, this.canvas.height - (gapY + 2) * this.cellHeight);
            } else {
                // Fallback: draw colored rectangles
                this.ctx.fillStyle = '#228B22';
                
                // Top pipe
                this.ctx.fillRect(pipeX, 0, pipeWidth, (gapY - 1) * this.cellHeight);
                
                // Bottom pipe
                this.ctx.fillRect(pipeX, (gapY + 2) * this.cellHeight, 
                    pipeWidth, this.canvas.height - (gapY + 2) * this.cellHeight);
                
                // Pipe caps
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(pipeX - 5, (gapY - 1) * this.cellHeight - 20, pipeWidth + 10, 20);
                this.ctx.fillRect(pipeX - 5, (gapY + 2) * this.cellHeight, pipeWidth + 10, 20);
            }
        });
    }

    drawGround() {
        if (this.images.base) {
            const groundY = this.canvas.height - 50;
            for (let x = 0; x < this.canvas.width; x += this.images.base.width) {
                this.ctx.drawImage(this.images.base, x, groundY);
            }
        } else {
            // Fallback: draw colored ground
            this.ctx.fillStyle = '#DEB887';
            this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        }
    }

    drawWaitingScreen() {
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Connecting to Game...', this.canvas.width/2, this.canvas.height/2);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Please wait while we set up your game', this.canvas.width/2, this.canvas.height/2 + 40);
    }

    showGameOverModal() {
        document.getElementById('finalScore').textContent = this.gameState.score;
        document.getElementById('modalHighScore').textContent = this.gameState.highscore;
        document.getElementById('gameOverModal').classList.remove('hidden');
    }

    hideGameOverModal() {
        document.getElementById('gameOverModal').classList.add('hidden');
    }

    restartGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'restart_game'
            }));
            this.hideGameOverModal();
        }
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('statusMessage');
        const statusElement = document.createElement('div');
        
        const bgColor = {
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'info': 'bg-blue-500',
            'warning': 'bg-yellow-500'
        }[type] || 'bg-blue-500';
        
        statusElement.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg mb-2 transform transition-all duration-300`;
        statusElement.textContent = message;
        
        statusDiv.appendChild(statusElement);
        
        // Fade in
        setTimeout(() => {
            statusElement.style.opacity = '1';
            statusElement.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            statusElement.style.opacity = '0';
            statusElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.parentNode.removeChild(statusElement);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlappyBirdWebGame();
});