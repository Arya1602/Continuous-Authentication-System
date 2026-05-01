from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np

from pipelines.keystroke_pipeline import (
    extract_fixed_vector,
    extract_free_windows,
    enough_to_extract,
)
from pipelines.model_pipeline import (
    load_model,
    train_model,
    score_attempt,
    score_windows,
    log_login_attempt,
    get_session_logs,
    get_far_frr_stats,
)

router = APIRouter()

_model_cache: Dict[str, dict] = {}
_session_window_store: Dict[str, List[np.ndarray]] = {}

MIN_WINDOWS_TO_TRAIN = 20

def _get_model(user_id: str, model_type: str = "login") -> dict:
    key = f"{user_id}:{model_type}"
    if key not in _model_cache:
        bundle = load_model(user_id, model_type)
        if bundle is None:
            raise HTTPException(404, f"No {model_type} model found. Please enroll first.")
        _model_cache[key] = bundle
    return _model_cache[key]


def _try_get_model(user_id: str, model_type: str) -> Optional[dict]:
    key = f"{user_id}:{model_type}"
    if key in _model_cache:
        return _model_cache[key]
    bundle = load_model(user_id, model_type)
    if bundle is not None:
        _model_cache[key] = bundle
    return bundle


def _session_model_exists(user_id: str) -> bool:
    return _try_get_model(user_id, "session") is not None

class LoginScoreRequest(BaseModel):
    user_id: str
    events:  List[Dict]


class SessionScoreRequest(BaseModel):
    user_id:    str
    session_id: str
    events:     List[Dict]
    total_keys: int


class TrainSessionRequest(BaseModel):
    user_id: str

@router.post("/login-score")
def score_login(req: LoginScoreRequest):
    bundle = _get_model(req.user_id, "login")

    if not enough_to_extract(req.events, mode="fixed"):
        raise HTTPException(422, "Too few keystrokes for login scoring.")

    vec = extract_fixed_vector(req.events)
    if vec is None:
        raise HTTPException(422, "Feature extraction failed! Type the phrase more naturally.")

    score, verdict = score_attempt(bundle, vec)
    log_login_attempt(req.user_id, score, verdict, source="login")

    session_exists = _session_model_exists(req.user_id)

    return {
        "score":                score,
        "threshold":            bundle["threshold"],
        "verdict":              verdict,
        "access_denied":        verdict == "denied",
        "mode":                 "fixed",
        "algo":                 bundle.get("model_algo", "ocsvm"),
        "session_model_exists": session_exists,
    }


@router.post("/score")
def score_session(req: SessionScoreRequest):
    windows = extract_free_windows(req.events)

    if not windows:
        raise HTTPException(
            422,
            f"Not enough keystrokes for session scoring. "
            f"Need at least 30 consecutive keystrokes, got {req.total_keys}."
        )

    store = _session_window_store.setdefault(req.user_id, [])
    new_window_count = max(0, len(windows) - (len(store) % max(len(windows), 1)))
    store.extend(windows[-new_window_count:] if new_window_count > 0 else [])
    store.extend(windows)
    windows_accumulated = len(store)
    can_train_session   = windows_accumulated >= MIN_WINDOWS_TO_TRAIN

    bundle = _try_get_model(req.user_id, "session")

    if bundle is None:
        return {
            "score":               None,
            "threshold":           None,
            "verdict":             "pending",
            "mode":                "free",
            "model_used":          "none (accumulating)",
            "algo":                "lof",
            "windows_scored":      len(windows),
            "windows_accumulated": windows_accumulated,
            "can_train_session":   can_train_session,
        }

    score, verdict = score_windows(bundle, windows)
    log_login_attempt(req.user_id, score, verdict, source="session")

    return {
        "score":               score,
        "threshold":           bundle["threshold"],
        "verdict":             verdict,
        "mode":                "free",
        "model_used":          "session",
        "algo":                "lof",
        "windows_scored":      len(windows),
        "windows_accumulated": windows_accumulated,
        "can_train_session":   can_train_session,
    }


@router.post("/train-session")
def train_session_model(req: TrainSessionRequest):
    windows = _session_window_store.get(req.user_id, [])

    if len(windows) < MIN_WINDOWS_TO_TRAIN:
        if _session_model_exists(req.user_id):
            return {"success": True, "message": "Session model already exists.", "retrained": False}
        raise HTTPException(
            400,
            f"Need {MIN_WINDOWS_TO_TRAIN} windows, have {len(windows)}."
        )

    feature_matrix = np.vstack(windows)   # (N, 37)
    ok, message    = train_model(req.user_id, feature_matrix, model_type="session")

    if not ok:
        return {"success": False, "message": message, "retrained": False}

    _session_window_store.pop(req.user_id, None)
    _model_cache.pop(f"{req.user_id}:session", None)

    return {"success": True, "message": message, "retrained": True}


@router.get("/logs/{user_id}")
def fetch_logs(user_id: str):
    return {"logs": get_session_logs(user_id)}


@router.get("/stats/{user_id}")
def fetch_stats(user_id: str):
    return get_far_frr_stats(user_id)


@router.post("/invalidate-cache/{user_id}")
def invalidate_cache(user_id: str):
    keys = [k for k in list(_model_cache) if k.startswith(user_id)]
    for k in keys:
        _model_cache.pop(k, None)
    return {"cleared": True, "keys_removed": keys}