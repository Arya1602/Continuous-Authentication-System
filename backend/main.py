from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, enroll, session

app = FastAPI(title="ContinuAuth API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(enroll.router,  prefix="/api/enroll",  tags=["enroll"])
app.include_router(session.router, prefix="/api/session", tags=["session"])


@app.get("/")
def root():
    return {"status": "ContinuAuth API running", "version": "2.0.0"}
