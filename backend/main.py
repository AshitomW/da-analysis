from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from data.router import router as data_router
from data.cleaning_router import router as cleaning_router
from analysis.router import router as analysis_router
from ml.router import router as ml_router
from results_router import router as results_router
from generator.router import router as generator_router

app = FastAPI(title="Water-Energy Nexus Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router, prefix="/api/data")
app.include_router(cleaning_router, prefix="/api/clean")
app.include_router(analysis_router, prefix="/api/analysis")
app.include_router(ml_router, prefix="/api/ml")
app.include_router(results_router, prefix="/api")
app.include_router(generator_router, prefix="/api/generator")


@app.get("/api/health")
def health():
    return {"status": "ok"}
