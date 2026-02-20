"""
Chiller Prediction API — run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
Serves POST /predict and GET /health. Add CORS so the frontend can call it.
"""
import os
import torch
import torch.nn as nn
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Configuration ---
MODEL_PATH = os.environ.get("CHILLER_MODEL_PATH", "chiller_model.pth")
DATA_PATH = os.environ.get("CHILLER_DATA_PATH", "dataset/dataset.csv")
INPUT_COLS = ["Windspeed", "CFM", "Orientation", "Spacing"]
OUTPUT_COLS = [f"Chiller {i:02d}" for i in range(1, 21)]


# --- Model Definition (must match training) ---
class ChillerNet(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(ChillerNet, self).__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Linear(128, output_dim),
        )

    def forward(self, x):
        return self.layers(x)


# --- Schema ---
class ChillerInput(BaseModel):
    Windspeed: float
    CFM: float
    Orientation: float
    Spacing: float


app = FastAPI(title="Chiller Prediction API")

# Allow frontend (Vite dev server) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and scaling
model = None
mins = None
maxs = None


@app.on_event("startup")
def load_assets():
    global model, mins, maxs
    # Resolve paths relative to this file's directory
    base = os.path.dirname(os.path.abspath(__file__))
    data_path = DATA_PATH if os.path.isabs(DATA_PATH) else os.path.join(base, "..", DATA_PATH)
    model_path = MODEL_PATH if os.path.isabs(MODEL_PATH) else os.path.join(base, "..", MODEL_PATH)

    if not os.path.exists(data_path):
        raise RuntimeError(f"Data file {data_path} not found for scaling.")
    df = pd.read_csv(data_path)
    mins = torch.tensor(df[INPUT_COLS].min().values, dtype=torch.float32)
    maxs = torch.tensor(df[INPUT_COLS].max().values, dtype=torch.float32)

    model = ChillerNet(len(INPUT_COLS), len(OUTPUT_COLS))
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
        model.eval()
        print("Model and scaling parameters loaded successfully.")
    else:
        raise RuntimeError(f"Model weights not found at {model_path}")


@app.post("/predict")
async def predict(data: ChillerInput):
    try:
        raw_input = torch.tensor(
            [[data.Windspeed, data.CFM, data.Orientation, data.Spacing]], dtype=torch.float32
        )
        scaled_input = (raw_input - mins) / (maxs - mins)
        with torch.no_grad():
            prediction = model(scaled_input).numpy()[0]
        return {OUTPUT_COLS[i]: float(prediction[i]) for i in range(len(OUTPUT_COLS))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "online"}
