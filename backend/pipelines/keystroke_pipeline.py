import numpy as np
from scipy import stats as sp_stats
from typing import List, Dict, Optional

ENROLLMENT_PHRASE = "the quick brown fox jumps over the lazy dog"

WINDOW_SIZE = 30   
WINDOW_STEP = 15   

MIN_KEYPRESSES_FIXED = 25   
MIN_KEYPRESSES_FREE  = 30   

def _pair_events(events: List[Dict]) -> List[Dict]:
    downs = [e for e in events if e["direction"] == "D"]
    ups   = [e for e in events if e["direction"] == "U"]

    up_queues: Dict[str, List[float]] = {}
    for u in ups:
        up_queues.setdefault(u["key"], []).append(u["timestamp_ms"])
    for k in up_queues:
        up_queues[k].sort()

    paired = []
    for d in downs:
        key    = d["key"]
        down_t = d["timestamp_ms"]
        queue  = up_queues.get(key, [])
        match_t = None
        for i, ut in enumerate(queue):
            if ut > down_t:
                match_t = queue.pop(i)
                break
        if match_t is not None:
            paired.append({"key": key, "down_t": down_t, "up_t": match_t})

    paired.sort(key=lambda x: x["down_t"])
    return paired


def _compute_timings(pairs: List[Dict]) -> Optional[Dict[str, np.ndarray]]:
    if len(pairs) < 5:
        return None

    H  = np.array([(p["up_t"] - p["down_t"]) / 1000.0 for p in pairs])
    DD = np.array([(pairs[i+1]["down_t"] - pairs[i]["down_t"]) / 1000.0
                   for i in range(len(pairs) - 1)])
    UD = np.array([(pairs[i+1]["down_t"] - pairs[i]["up_t"]) / 1000.0
                   for i in range(len(pairs) - 1)])

    valid_H    = (H > 0)  & (H  < 1.0)
    valid_DD   = (DD > 0) & (DD < 3.0)
    valid_both = valid_DD & (np.abs(UD) < 2.0)

    H  = H[valid_H]
    DD = DD[valid_both]
    UD = UD[valid_both]

    if len(H) < 3 or len(DD) < 3:
        return None

    return {"H": H, "DD": DD, "UD": UD}


def count_keypresses(events: List[Dict]) -> int:
    return sum(1 for e in events if e["direction"] == "D")


def enough_to_extract(events: List[Dict], mode: str = "fixed") -> bool:
    min_keys = MIN_KEYPRESSES_FIXED if mode == "fixed" else MIN_KEYPRESSES_FREE
    return count_keypresses(events) >= min_keys


def _fixed_engineered_16(H: np.ndarray, DD: np.ndarray, UD: np.ndarray) -> np.ndarray:
    mean_hold = float(np.mean(H));  std_hold = float(np.std(H))
    min_hold  = float(np.min(H));   max_hold = float(np.max(H))
    mean_dd   = float(np.mean(DD)); std_dd   = float(np.std(DD))
    min_dd    = float(np.min(DD));  max_dd   = float(np.max(DD))
    mean_ud   = float(np.mean(UD)); std_ud   = float(np.std(UD))
    min_ud    = float(np.min(UD));  max_ud   = float(np.max(UD))

    return np.array([
        mean_hold, std_hold, min_hold, max_hold,
        mean_dd,   std_dd,   min_dd,   max_dd,
        mean_ud,   std_ud,   min_ud,   max_ud,
        mean_hold / (mean_dd + 1e-9),   # hold_dd_ratio
        mean_hold / (mean_ud + 1e-9),   # hold_ud_ratio
        mean_dd   / (mean_ud + 1e-9),   # dd_ud_ratio
        float(np.sum(DD)),              # total_time
    ], dtype=float)


def _resample(arr: np.ndarray, target: int) -> np.ndarray:
    if len(arr) == target:
        return arr.astype(float)
    x_old = np.linspace(0, 1, len(arr))
    x_new = np.linspace(0, 1, target)
    return np.interp(x_new, x_old, arr).astype(float)


def extract_fixed_vector(events: List[Dict]) -> Optional[np.ndarray]:
    if not events:
        return None
    pairs = _pair_events(events)
    if len(pairs) < 5:
        return None
    timings = _compute_timings(pairs)
    if timings is None:
        return None

    H, DD, UD = timings["H"], timings["DD"], timings["UD"]
    engineered = _fixed_engineered_16(H, DD, UD)
    raw = np.concatenate([_resample(H, 11), _resample(DD, 10), _resample(UD, 10)])
    vec = np.concatenate([engineered, raw])   

    if np.any(np.isnan(vec)) or np.any(np.isinf(vec)):
        return None
    return vec.reshape(1, -1)


def _window_stats_11(arr: np.ndarray) -> List[float]:
    if len(arr) == 0:
        return [0.0] * 11
    mean = float(np.mean(arr))
    std  = float(np.std(arr))
    q25  = float(np.percentile(arr, 25))
    q75  = float(np.percentile(arr, 75))
    return [
        mean,
        std,
        float(np.min(arr)),
        float(np.max(arr)),
        float(np.median(arr)),
        float(sp_stats.skew(arr))     if len(arr) > 2 else 0.0,
        float(sp_stats.kurtosis(arr)) if len(arr) > 3 else 0.0,
        q25,
        q75,
        q75 - q25,                    
        std / (mean + 1e-9),          
    ]


def _build_free_37(H: np.ndarray, DD: np.ndarray, UD: np.ndarray) -> Optional[np.ndarray]:
    stats_h  = _window_stats_11(H)
    stats_dd = _window_stats_11(DD)
    stats_ud = _window_stats_11(UD)

    feat_33 = np.array(stats_h + stats_dd + stats_ud, dtype=float)

    ht_m  = stats_h[0]   # mean hold time
    p2p_m = stats_dd[0]  # mean press-to-press
    r2p_m = stats_ud[0]  # mean release-to-press
    ratios = np.array([
        ht_m  / (p2p_m + 1e-9),
        ht_m  / (r2p_m + 1e-9),
        p2p_m / (r2p_m + 1e-9),
    ], dtype=float)

    dd_mean = float(np.mean(DD)) if len(DD) > 0 else 1e-9
    rhythm  = np.array([float(np.std(DD)) / (dd_mean + 1e-9)], dtype=float)

    vec = np.concatenate([feat_33, ratios, rhythm])  # 33+3+1 = 37

    if np.any(np.isnan(vec)) or np.any(np.isinf(vec)):
        return None
    return vec


def extract_free_windows(events: List[Dict]) -> List[np.ndarray]:
    if not events:
        return []

    pairs = _pair_events(events)
    if len(pairs) < WINDOW_SIZE:
        return []

    windows = []
    for start in range(0, len(pairs) - WINDOW_SIZE + 1, WINDOW_STEP):
        chunk = pairs[start: start + WINDOW_SIZE]

        H  = np.array([(p["up_t"] - p["down_t"]) / 1000.0 for p in chunk])
        DD = np.array([(chunk[i+1]["down_t"] - chunk[i]["down_t"]) / 1000.0
                       for i in range(len(chunk) - 1)])
        UD = np.array([(chunk[i+1]["down_t"] - chunk[i]["up_t"]) / 1000.0
                       for i in range(len(chunk) - 1)])

        H  = H[(H > 0) & (H < 1.0)]
        valid = (DD > 0) & (DD < 3.0) & (np.abs(UD) < 2.0)
        DD, UD = DD[valid], UD[valid]

        if len(H) < 5 or len(DD) < 5:
            continue

        vec = _build_free_37(H, DD, UD)
        if vec is not None:
            windows.append(vec)

    return windows


def extract_free_windows_matrix(events: List[Dict]) -> Optional[np.ndarray]:
    windows = extract_free_windows(events)
    if not windows:
        return None
    return np.vstack(windows)


def extract_attempt_vector(
    events: List[Dict],
    mode: str = "fixed",
) -> Optional[np.ndarray]:
    
    if mode == "fixed":
        return extract_fixed_vector(events)
    windows = extract_free_windows(events)
    if not windows:
        return None
    return np.mean(windows, axis=0).reshape(1, -1)


def get_expected_dims(mode: str) -> int:
    return 47 if mode == "fixed" else 37