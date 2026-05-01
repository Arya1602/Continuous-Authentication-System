const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export const api = {
  register: (username, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: { username, email, password },
    }),

  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),

  getPhrase: () => request("/enroll/phrase"),

  saveAttempt: (user_id, events) =>
    request("/enroll/attempt", { method: "POST", body: { user_id, events } }),

  trainModel: (user_id) =>
    request("/enroll/train", { method: "POST", body: { user_id } }),

  resetAttempts: (user_id) =>
    request(`/enroll/reset/${user_id}`, { method: "DELETE" }),

  enrollStatus: (user_id) => request(`/enroll/status/${user_id}`),

  scoreLogin: (user_id, events) =>
    request("/session/login-score", {
      method: "POST",
      body: { user_id, events },
    }),

  scoreSession: (user_id, session_id, events, total_keys) =>
    request("/session/score", {
      method: "POST",
      body: { user_id, session_id, events, total_keys },
    }),

  trainSessionModel: (user_id) =>
    request("/session/train-session", { method: "POST", body: { user_id } }),

  getSessionLogs: (user_id) => request(`/session/logs/${user_id}`),

  getStats: (user_id) => request(`/session/stats/${user_id}`),

  invalidateCache: (user_id) =>
    request(`/session/invalidate-cache/${user_id}`, { method: "POST" }),
};
