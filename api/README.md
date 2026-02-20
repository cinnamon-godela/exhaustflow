# Chiller Prediction API

The **production API is hosted on AWS**. The frontend is configured via `VITE_CHILLER_API_URL` in `.env` (your AWS base URL, no trailing slash). It calls `POST {url}/predict` and `GET {url}/health`.

This folder is the same API for **local or self-hosted** use (e.g. run with uvicorn). Use it only if you want to run the API yourself instead of AWS.

## AWS (production)

- Set `VITE_CHILLER_API_URL` in the frontend `.env` to your AWS API base URL.
- Ensure your AWS API (API Gateway / Lambda / ECS etc.) allows CORS from your frontend origin (e.g. your Vercel/host domain and `http://localhost:5173` for dev).

## Endpoints

- **GET /health** — returns `{"status": "online"}`.
- **POST /predict** — body: `{ "Windspeed", "CFM", "Orientation", "Spacing" }` → returns `{ "Chiller 01": T, ... "Chiller 20": T }`.

## Run locally (optional)

If you run this API yourself instead of using AWS:

1. Python 3.9+, venv, and `pip install -r requirements.txt`.
2. Put `chiller_model.pth` and `dataset/dataset.csv` in the project root (or set `CHILLER_MODEL_PATH` and `CHILLER_DATA_PATH`).
3. From `api` folder: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
4. In the frontend `.env` set `VITE_CHILLER_API_URL=http://localhost:8000`.
