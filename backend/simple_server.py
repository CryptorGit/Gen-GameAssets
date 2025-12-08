"""
シンプルなテスト用サーバー
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Test Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "message": "Server is running"}

@app.get("/")
async def root():
    return {"message": "Hello from test server"}

if __name__ == "__main__":
    print("Starting test server on http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
