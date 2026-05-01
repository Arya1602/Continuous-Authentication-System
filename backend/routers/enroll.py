from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import numpy as np

from pipelines.keystroke_pipeline import (
    extract_fixed_vector,
    enough_to_extract,
    ENROLLMENT_PHRASE,
)
from pipelines.model_pipeline import train_model

router = APIRouter()

_enrollment_store: Dict[str, List[np.ndarray]] = {}

REQUIRED_ATTEMPTS = 8    
MIN_TO_TRAIN      = 6    


class AttemptRequest(BaseModel):
    user_id: str
    events:  List[Dict]


class TrainRequest(BaseModel):
    user_id: str


@router.get("/phrase")
def get_enrollment_phrase():
    return {"phrase": ENROLLMENT_PHRASE}


@router.post("/attempt")
def save_attempt(req: AttemptRequest):
    if not enough_to_extract(req.events, mode="fixed"):
        raise HTTPException(400, "Not enough keystrokes, type the full phrase.")

    vec = extract_fixed_vector(req.events)
    if vec is None:
        raise HTTPException(422, "Feature extraction failed! Try typing more naturally.")

    store = _enrollment_store.setdefault(req.user_id, [])
    store.append(vec[0])   

    count = len(store)
    return {"saved": count, "required": REQUIRED_ATTEMPTS, "ready": count >= MIN_TO_TRAIN}


@router.post("/train")
def train(req: TrainRequest):
    attempts = _enrollment_store.get(req.user_id, [])

    if len(attempts) < MIN_TO_TRAIN:
        raise HTTPException(
            400, f"Need at least {MIN_TO_TRAIN} attempts, have {len(attempts)}."
        )

    feature_matrix = np.vstack(attempts)   

    col_means = np.abs(np.mean(feature_matrix, axis=0))
    col_stds  = np.std(feature_matrix, axis=0)
    col_cv    = col_stds / (col_means + 1e-9)
    mean_cv   = float(np.mean(col_cv))

    if mean_cv > 2.5:
        _enrollment_store.pop(req.user_id, None)
        raise HTTPException(
            422,
            f"Typing patterns are too inconsistent (variance score: {mean_cv:.2f}). "
            "Try again! Please type the enrollment phrase at your normal, relaxed and natural pace."
        )

    ok, message = train_model(req.user_id, feature_matrix, model_type="login")

    if not ok:
        raise HTTPException(500, message)

    _enrollment_store.pop(req.user_id, None)

    return {
        "success":        True,
        "message":        message,
        "consistency_cv": round(mean_cv, 3),
    }


@router.delete("/reset/{user_id}")
def reset_attempts(user_id: str):
    _enrollment_store.pop(user_id, None)
    return {"cleared": True}


@router.get("/status/{user_id}")
def get_status(user_id: str):
    count = len(_enrollment_store.get(user_id, []))
    return {"saved": count, "required": REQUIRED_ATTEMPTS, "ready": count >= MIN_TO_TRAIN}