from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from app.websocket_handler import WebSocketHandler

app = FastAPI(title="Flappy Bird Web Game")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create data directory if not exists
os.makedirs("data", exist_ok=True)

# Initialize WebSocket handler
websocket_handler = WebSocketHandler()

@app.get("/")
async def serve_game():
    return FileResponse("static/index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket_handler.handle_message(websocket, data)
    except WebSocketDisconnect:
        websocket_handler.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=True,
        reload_dirs=["app", "static"]
    )