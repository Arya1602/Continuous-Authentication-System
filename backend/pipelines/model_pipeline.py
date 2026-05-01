import io
import pickle
import base64
import numpy as np
import sklearn
from typing import Optional, Tuple, List

from sklearn.preprocessing     import StandardScaler
from sklearn.decomposition     import PCA
from sklearn.svm               import OneClassSVM
from sklearn.neighbors         import LocalOutlierFactor
from sklearn.feature_selection import VarianceThreshold
from sklearn.model_selection   import train_test_split

from database.config import supabase

MAX_SESSION_THRESHOLD = 0.15

def _serialize(obj) -> str:
    buf = io.BytesIO()
    pickle.dump(obj, buf)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _deserialize(blob: str):
    return pickle.loads(base64.b64decode(blob.encode("utf-8")))


def _calibrate_threshold(model, X_val: np.ndarray, model_type: str = "login") -> float:
    scores = model.decision_function(X_val)
    pct5   = float(np.percentile(scores, 5))

    if model_type == "session":
        raw = pct5 - 0.10          
        return min(raw, MAX_SESSION_THRESHOLD)
    else:
        return pct5 - 0.05


def _tune_nu(X_train: np.ndarray, X_val: np.ndarray) -> float:
    if len(X_train) < 4:
        return 0.01
    best_nu, best_frr = 0.01, 1.0
    for nu in [0.001, 0.005, 0.01, 0.02, 0.05, 0.1]:
        try:
            clf = OneClassSVM(kernel="rbf", nu=nu)
            clf.fit(X_train)
            frr = float(np.mean(clf.predict(X_val) == -1))
            if frr < best_frr:
                best_frr, best_nu = frr, nu
        except Exception:
            continue
    return best_nu


def _tune_lof_neighbors(X_train: np.ndarray, X_val: np.ndarray) -> int:
    if len(X_train) < 5:
        return 5
    best_k, best_frr = 5, 1.0
    max_k = max(5, min(20, int(len(X_train) * 0.6)))
    for k in [5, 7, 10, 12, 15, 20]:
        if k > max_k:
            break
        try:
            lof = LocalOutlierFactor(n_neighbors=k, novelty=True, contamination=0.05)
            lof.fit(X_train)
            frr = float(np.mean(lof.predict(X_val) == -1))
            if frr < best_frr:
                best_frr, best_k = frr, k
        except Exception:
            continue
    return best_k


def _preprocess(
    X_train: np.ndarray,
    X_val:   np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, StandardScaler, PCA, Optional[VarianceThreshold]]:
    scaler   = StandardScaler()
    X_tr_s   = scaler.fit_transform(X_train)
    X_vl_s   = scaler.transform(X_val)

    max_comp = min(X_tr_s.shape[0] - 1, X_tr_s.shape[1])
    pca      = PCA(n_components=min(0.95, max_comp / X_tr_s.shape[1]), random_state=42)
    X_tr_p   = pca.fit_transform(X_tr_s)
    X_vl_p   = pca.transform(X_vl_s)

    selector = VarianceThreshold(threshold=0.005)
    try:
        X_tr_f = selector.fit_transform(X_tr_p)
        X_vl_f = selector.transform(X_vl_p)
        if X_tr_f.shape[1] == 0:
            raise ValueError
    except Exception:
        selector = None
        X_tr_f   = X_tr_p
        X_vl_f   = X_vl_p

    return X_tr_f, X_vl_f, scaler, pca, selector


def _fit_ocsvm(feature_matrix: np.ndarray) -> dict:
    if len(feature_matrix) <= 10:
        X_train = X_val = feature_matrix
    else:
        X_train, X_val = train_test_split(feature_matrix, test_size=0.2, random_state=42)

    X_tr_f, X_vl_f, scaler, pca, selector = _preprocess(X_train, X_val)
    best_nu = _tune_nu(X_tr_f, X_vl_f)
    model   = OneClassSVM(kernel="rbf", nu=best_nu)
    model.fit(X_tr_f)
    threshold = _calibrate_threshold(model, X_vl_f, model_type="login")

    return {
        "scaler": scaler, "pca": pca, "selector": selector,
        "model": model, "model_algo": "ocsvm", "threshold": threshold,
        "best_nu": best_nu, "n_attempts": int(len(feature_matrix)),
        "feature_dim": int(feature_matrix.shape[1]),
        "pca_components": int(X_tr_f.shape[1]),
        "sklearn_version": sklearn.__version__,
    }


def _fit_lof(feature_matrix: np.ndarray) -> dict:
    if len(feature_matrix) <= 30:
        X_train = X_val = feature_matrix
    else:
        X_train, X_val = train_test_split(feature_matrix, test_size=0.2, random_state=42)

    X_tr_f, X_vl_f, scaler, pca, selector = _preprocess(X_train, X_val)
    best_k = _tune_lof_neighbors(X_tr_f, X_vl_f)
    model  = LocalOutlierFactor(n_neighbors=best_k, novelty=True, contamination=0.05)
    model.fit(X_tr_f)
    threshold = _calibrate_threshold(model, X_vl_f, model_type="session")

    return {
        "scaler": scaler, "pca": pca, "selector": selector,
        "model": model, "model_algo": "lof", "threshold": threshold,
        "best_k": best_k, "n_attempts": int(len(feature_matrix)),
        "feature_dim": int(feature_matrix.shape[1]),
        "pca_components": int(X_tr_f.shape[1]),
        "sklearn_version": sklearn.__version__,
    }


def train_model(
    user_id:        str,
    feature_matrix: np.ndarray,
    model_type:     str = "login",
) -> Tuple[bool, str]:
    if feature_matrix is None or len(feature_matrix) < 4:
        n = len(feature_matrix) if feature_matrix is not None else 0
        return False, f"Need at least 4 samples, got {n}."
    try:
        if model_type == "session":
            bundle    = _fit_lof(feature_matrix)
            algo_info = f"LOF (k={bundle['best_k']})"
        else:
            bundle    = _fit_ocsvm(feature_matrix)
            algo_info = f"OC-SVM (nu={bundle['best_nu']:.3f})"

        blob = _serialize(bundle)
        supabase.table("user_models").upsert({
            "user_id":      user_id,
            "model_type":   model_type,
            "model_blob":   blob,
            "threshold":    bundle["threshold"],
            "feature_mean": bundle["scaler"].mean_.tolist(),
            "feature_std":  bundle["scaler"].scale_.tolist(),
            "sample_count": bundle["n_attempts"],
        }).execute()

        if model_type == "login":
            supabase.table("users").update({"enrolled": True}).eq("user_id", user_id).execute()

        return True, (
            f"[{model_type}] {algo_info} | "
            f"samples={bundle['n_attempts']} | "
            f"dim={bundle['feature_dim']} | "
            f"PCA={bundle['pca_components']} | "
            f"threshold={bundle['threshold']:.4f}"
        )
    except Exception as e:
        return False, f"Training failed: {str(e)}"


def load_model(user_id: str, model_type: str = "login") -> Optional[dict]:
    try:
        resp = (
            supabase.table("user_models")
            .select("model_blob")
            .eq("user_id",    user_id)
            .eq("model_type", model_type)
            .single()
            .execute()
        )
        if not resp.data:
            return None

        bundle = _deserialize(resp.data["model_blob"])

        if model_type == "session":
            if bundle.get("threshold", MAX_SESSION_THRESHOLD) > MAX_SESSION_THRESHOLD:
                bundle["threshold"] = MAX_SESSION_THRESHOLD

        return bundle
    except Exception:
        return None


def _transform(bundle: dict, vector: np.ndarray) -> np.ndarray:
    x = bundle["scaler"].transform(vector)
    x = bundle["pca"].transform(x)
    if bundle.get("selector") is not None:
        x = bundle["selector"].transform(x)
    return x


def score_attempt(bundle: dict, vector: np.ndarray) -> Tuple[float, str]:
    try:
        expected = bundle.get("feature_dim")
        if vector is None:
            return 0.0, "error"
        if expected is not None and vector.shape[1] != expected:
            return 0.0, "error"
        x       = _transform(bundle, vector)
        score   = float(bundle["model"].decision_function(x)[0])
        verdict = "granted" if score >= bundle["threshold"] else "denied"
        return score, verdict
    except Exception:
        return 0.0, "error"


def score_windows(bundle: dict, windows: List[np.ndarray]) -> Tuple[float, str]:
    if not windows:
        return 0.0, "error"
    scores = []
    for w in windows:
        s, v = score_attempt(bundle, w.reshape(1, -1))
        if v != "error":
            scores.append(s)
    if not scores:
        return 0.0, "error"
    mean_score = float(np.mean(scores))
    verdict    = "granted" if mean_score >= bundle["threshold"] else "denied"
    return mean_score, verdict


def log_login_attempt(user_id: str, score: float, verdict: str, source: str = "login") -> None:
    try:
        supabase.table("login_attempts").insert({
            "user_id": user_id, "score": score,
            "verdict": verdict, "source": source,
        }).execute()
    except Exception:
        pass


def get_session_logs(user_id: str, limit: int = 50) -> list:
    try:
        resp = (
            supabase.table("login_attempts")
            .select("score, verdict, source, attempted_at")
            .eq("user_id", user_id)
            .order("attempted_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def get_far_frr_stats(user_id: str) -> dict:
    try:
        resp = (
            supabase.table("login_attempts")
            .select("score, verdict, source")
            .eq("user_id", user_id)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return {"far": 0.0, "frr": 0.0, "eer": 0.0,
                    "total": 0, "granted": 0, "denied": 0}

        login_rows   = [r for r in rows if r["source"] == "login"]
        session_rows = [r for r in rows if r["source"] == "session"]

        frr = (sum(1 for r in login_rows   if r["verdict"] == "denied") / len(login_rows)
               if login_rows else 0.0)
        far = (sum(1 for r in session_rows if r["verdict"] == "denied") / len(session_rows)
               if session_rows else 0.0)
        eer     = (frr + far) / 2
        total   = len(rows)
        granted = sum(1 for r in rows if r["verdict"] == "granted")
        denied  = sum(1 for r in rows if r["verdict"] == "denied")

        return {
            "far":     round(far, 4), "frr": round(frr, 4), "eer": round(eer, 4),
            "total":   total, "granted": granted, "denied":  denied,
        }
    except Exception:
        return {"far": 0.0, "frr": 0.0, "eer": 0.0, "total": 0, "granted": 0, "denied": 0}