from fastapi import WebSocket
import json
import asyncio
import base64
import cv2
import numpy as np
from app.game_logic import Game
from app.face_detection import FaceDetector
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketHandler:
    def __init__(self):
        self.active_connections = {}
        self.games = {}
        self.detectors = {}
        self.last_frame_time = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        connection_id = id(websocket)
        self.active_connections[connection_id] = websocket
        self.games[connection_id] = Game()
        self.detectors[connection_id] = FaceDetector()
        self.last_frame_time[connection_id] = 0
        self.last_status = {}
        
        logger.info(f"New connection: {connection_id}")
        
        # Send initial game state
        await self.send_game_state(websocket, connection_id)

    def disconnect(self, websocket: WebSocket):
        connection_id = id(websocket)
        logger.info(f"Disconnecting: {connection_id}")
        
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.games:
            del self.games[connection_id]
        if connection_id in self.detectors:
            self.detectors[connection_id].release()
            del self.detectors[connection_id]
        if connection_id in self.last_frame_time:
            del self.last_frame_time[connection_id]

    async def handle_message(self, websocket: WebSocket, message: str):
        connection_id = id(websocket)
        try:
            data = json.loads(message)
            
            if data["type"] == "video_frame":
                await self.process_video_frame(websocket, connection_id, data["frame"])
            elif data["type"] == "restart_game":
                await self.restart_game(websocket, connection_id)
            elif data["type"] == "start_game":  # NEW
                await self.start_game(websocket, connection_id)
            elif data["type"] == "pause_game":  # NEW
                await self.pause_game(websocket, connection_id)
            elif data["type"] == "manual_jump":  # NEW
                await self.manual_jump(websocket, connection_id)
            elif data["type"] == "reset_calibration":
                self.detectors[connection_id].reset_calibration()
                await websocket.send_text(json.dumps({
                    "type": "info",
                    "message": "Calibration reset - move your head up and down"
                }))
                
        except Exception as e:
            logger.error(f"Error handling message from {connection_id}: {str(e)}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing message: {str(e)}"
            }))

    async def process_video_frame(self, websocket: WebSocket, connection_id: int, frame_data: str):
        try:
            # Rate limiting - process at most 15 FPS
            current_time = time.time()
            if current_time - self.last_frame_time.get(connection_id, 0) < 1.0/25.0: 
                return
            
            self.last_frame_time[connection_id] = current_time
            
            # Decode base64 image
            if ',' in frame_data:
                frame_bytes = base64.b64decode(frame_data.split(',')[1])
            else:
                frame_bytes = base64.b64decode(frame_data)
                
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                logger.warning(f"Failed to decode frame from {connection_id}")
                return
            
            # Get face detection result
            detector = self.detectors[connection_id]
            bird_pos_y, processed_image = detector.detect_nose_position(frame)
            
            # Update game
            game = self.games[connection_id]
            game.update(bird_pos_y)
            
            # Send game state
            await self.send_game_state(websocket, connection_id)
            
            # Send processed video frame back
            try:
                # Reduce image quality for better performance
                encode_param = [cv2.IMWRITE_JPEG_QUALITY, 70]
                _, buffer = cv2.imencode('.jpg', processed_image, encode_param)
                processed_frame_b64 = base64.b64encode(buffer).decode('utf-8')
                
                await websocket.send_text(json.dumps({
                    "type": "video_processed",
                    "frame": f"data:image/jpeg;base64,{processed_frame_b64}"
                }))
            except Exception as e:
                logger.error(f"Error encoding processed frame: {str(e)}")
            
        except Exception as e:
            logger.error(f"Error processing video frame from {connection_id}: {str(e)}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing video frame: {str(e)}"
            }))

    async def start_game(self, websocket: WebSocket, connection_id: int):
        """Start the actual game with obstacles"""
        try:
            self.games[connection_id].start_game()
            await self.send_game_state(websocket, connection_id)
            logger.info(f"Game started for connection {connection_id}")
            
            await websocket.send_text(json.dumps({
                "type": "info",
                "message": "Game started! Avoid the pipes!"
            }))
        except Exception as e:
            logger.error(f"Error starting game for {connection_id}: {str(e)}")

    async def pause_game(self, websocket: WebSocket, connection_id: int):
        """Pause/unpause the game"""
        try:
            self.games[connection_id].pause_game()
            await self.send_game_state(websocket, connection_id)
            
            game_mode = self.games[connection_id].game_mode
            message = "Game paused" if game_mode == "paused" else "Game resumed"
            
            await websocket.send_text(json.dumps({
                "type": "info",
                "message": message
            }))
            logger.info(f"Game {game_mode} for connection {connection_id}")
        except Exception as e:
            logger.error(f"Error pausing/resuming game for {connection_id}: {str(e)}")

    async def manual_jump(self, websocket: WebSocket, connection_id: int):
        """Handle manual jump command (fallback when camera not active)"""
        try:
            # This could be used as a fallback control method
            # For now, just send a status message
            await websocket.send_text(json.dumps({
                "type": "info",
                "message": "Manual jump detected - use camera for better control!"
            }))
        except Exception as e:
            logger.error(f"Error handling manual jump for {connection_id}: {str(e)}")

    # Update the restart_game method to return to preview mode:
    async def restart_game(self, websocket: WebSocket, connection_id: int):
        try:
            self.games[connection_id].restart()  # This now returns to preview mode
            await self.send_game_state(websocket, connection_id)
            logger.info(f"Game restarted for connection {connection_id}")
            
            await websocket.send_text(json.dumps({
                "type": "info",
                "message": "Back to preview mode - Click Start Game to play!"
            }))
        except Exception as e:
            logger.error(f"Error restarting game for {connection_id}: {str(e)}")

    async def send_game_state(self, websocket: WebSocket, connection_id: int):
        try:
            game_state = self.games[connection_id].get_state()
            await websocket.send_text(json.dumps({
                "type": "game_state",
                "data": game_state
            }))
        except Exception as e:
            logger.error(f"Error sending game state to {connection_id}: {str(e)}")
    
    async def send_status(self, websocket: WebSocket, connection_id: int, message: str, type: str):
        if self.last_status.get(connection_id) != message:  
            await websocket.send_text(json.dumps({
                "type": "info",
                "message": message
            }))
            self.last_status[connection_id] = message  
        else:
            logger.debug(f"Skipped duplicate status message: {message} for {connection_id}")
            
    async def send_periodic_updates(self):
        """Send periodic game updates even without video frames"""
        while True:
            for connection_id, game in self.games.items():
                if connection_id in self.active_connections:
                    try:
                        websocket = self.active_connections[connection_id]
                        await self.send_game_state(websocket, connection_id)
                    except Exception as e:
                        logger.error(f"Error in periodic update for {connection_id}: {str(e)}")
            
            await asyncio.sleep(1.0/60.0)