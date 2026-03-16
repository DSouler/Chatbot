from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.controllers.auth_controller import router as auth_router

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routers
app.include_router(auth_router)

@app.get("/")
def read_root():
    return {"message": "Auth Service is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}