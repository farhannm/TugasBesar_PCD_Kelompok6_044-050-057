from fastapi import WebSocket
import json
import asyncio
import base64
import cv2
import numpy as np
from app.game_logic import Game
from app.face_detection import FaceDetector

class WebSocketHandler:
    def __init__(self):
        self.active_connections = {}
        self.games = {}
        self.detectors = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        connection_id = id(websocket)
        self.active_connections[connection_id] = websocket
        self.games[connection_id] = Game()
        self.detectors[connection_id] = FaceDetector()
        
        # Send initial game state
        await self.send_game_state(websocket, connection_id)

    def disconnect(self, websocket: WebSocket):
        connection_id = id(websocket)
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.games:
            del self.games[connection_id]
        if connection_id in self.detectors:
            self.detectors[connection_id].release()
            del self.detectors[connection_id]

    async def handle_message(self, websocket: WebSocket, message: str):
        connection_id = id(websocket)
        try:
            data = json.loads(message)
            
            if data["type"] == "video_frame":
                await self.process_video_frame(websocket, connection_id, data["frame"])
            elif data["type"] == "restart_game":
                await self.restart_game(websocket, connection_id)
                
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing message: {str(e)}"
            }))

    async def process_video_frame(self, websocket: WebSocket, connection_id: int, frame_data: str):
        try:
            # Decode base64 image
            frame_bytes = base64.b64decode(frame_data.split(',')[1])
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Get face detection result
            detector = self.detectors[connection_id]
            bird_pos_y, processed_image = detector.detect_nose_position(frame)
            
            # Update game
            game = self.games[connection_id]
            game.update(bird_pos_y)
            
            # Send game state
            await self.send_game_state(websocket, connection_id)
            
            # Send processed video frame back
            _, buffer = cv2.imencode('.jpg', processed_image)
            processed_frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            await websocket.send_text(json.dumps({
                "type": "video_processed",
                "frame": f"data:image/jpeg;base64,{processed_frame_b64}"
            }))
            
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing video frame: {str(e)}"
            }))

    async def restart_game(self, websocket: WebSocket, connection_id: int):
        self.games[connection_id] = Game()
        await self.send_game_state(websocket, connection_id)

    async def send_game_state(self, websocket: WebSocket, connection_id: int):
        game_state = self.games[connection_id].get_state()
        await websocket.send_text(json.dumps({
            "type": "game_state",
            "data": game_state
        }))