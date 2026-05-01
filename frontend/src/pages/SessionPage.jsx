import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { HeaderDashboard } from "../components/Header";
import { styles } from "../components/styles";
import { useKeystroke } from "../hooks/useKeystroke";
import { api } from "../api/client";

const CHECK_EVERY = 100;
const WARNING_LIMIT = 2;
const SESSION_ID = `sess_${Date.now()}`;

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
function computeWpm(text, elapsedMs) {
  if (!elapsedMs || elapsedMs < 1000) return 0;
  return Math.round(
    text.trim().split(/\s+/).filter(Boolean).length / (elapsedMs / 60000),
  );
}

function HealthRing({ score, threshold, pending }) {
  const r = 42,
    cx = 52,
    cy = 52,
    circ = 2 * Math.PI * r;
  let ratio = 1,
    color = "#9CA3AF",
    label = "Pending";
  if (!pending && score !== null && threshold !== null) {
    ratio = Math.min(
      1,
      Math.max(0, score / (Math.abs(threshold) * 2 + 0.01) + 0.5),
    );
    if (score >= threshold) {
      color = "#10B981";
      label = "Safe";
    } else if (score >= threshold * 0.5) {
      color = "#F59E0B";
      label = "Caution";
    } else {
      color = "#EF4444";
      label = "Risk";
    }
  }
  const dash = circ * ratio,
    gap = circ - dash;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg width={104} height={104} viewBox="0 0 104 104">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={8}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill={color}
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          {label}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#6B7280"
          style={{ fontSize: 9 }}
        >
          {pending ? "building…" : score !== null ? score.toFixed(3) : "—"}
        </text>
      </svg>
      <span
        style={{
          fontSize: "0.7rem",
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Session Trust
      </span>
    </div>
  );
}

function WpmCard({ wpm, wpmHistory }) {
  return (
    <div
      style={{
        ...styles.metric,
        padding: "0.7rem",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, color: "#6D28D9" }}
        >
          speed
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          WPM
        </span>
      </div>
      <div style={{ ...styles.metricValue, fontSize: "1.6rem", lineHeight: 1 }}>
        {wpm}
      </div>
      {wpmHistory.length > 1 && (
        <ResponsiveContainer width="100%" height={32}>
          <AreaChart
            data={wpmHistory}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6D28D9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="#6D28D9"
              strokeWidth={1.5}
              fill="url(#wpmGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function NextCheckBar({ totalKeys }) {
  const progress = (totalKeys % CHECK_EVERY) / CHECK_EVERY;
  const remaining = CHECK_EVERY - (totalKeys % CHECK_EVERY);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
          Next check in
        </span>
        <span
          style={{ fontSize: "0.72rem", fontWeight: 600, color: "#4F46E5" }}
        >
          ~{remaining} keys
        </span>
      </div>
      <div
        style={{
          background: "#E8ECF4",
          borderRadius: 99,
          height: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            background: "linear-gradient(90deg, #4F46E5, #6D28D9)",
            width: `${progress * 100}%`,
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

function CheckTable({ checks }) {
  return (
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 17, color: "#4F46E5" }}
        >
          table_rows
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          Per-Check Breakdown
        </span>
      </div>
      {checks.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: "0.8rem",
            padding: "1rem 0",
          }}
        >
          No checks yet — keep typing!
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
            }}
          >
            <thead>
              <tr style={{ background: "#F8F9FC" }}>
                {[
                  "#",
                  "Time",
                  "Score",
                  "Threshold",
                  "Windows",
                  "Keys",
                  "Verdict",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      color: "#6B7280",
                      fontWeight: 600,
                      borderBottom: "1px solid #E8ECF4",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...checks].reverse().map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700 }}>
                    #{c.n}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "#6B7280",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.time}
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                    {c.score != null ? c.score.toFixed(4) : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                    {c.threshold != null ? c.threshold.toFixed(4) : "—"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{c.windows ?? "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{c.keys}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      style={styles.badge(
                        c.verdict === "granted"
                          ? "green"
                          : c.verdict === "pending"
                            ? "blue"
                            : "red",
                      )}
                    >
                      {c.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfidenceTimeline({ sessionChecks }) {
  if (sessionChecks.length === 0)
    return (
      <div
        style={{
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9CA3AF",
          fontSize: "0.8rem",
        }}
      >
        Chart appears after first LOF check
      </div>
    );
  const thr = sessionChecks[0]?.threshold ?? 0;
  const data = sessionChecks.map((c) => ({
    name: `#${c.n}`,
    score: +c.score.toFixed(4),
    threshold: +thr.toFixed(4),
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="safeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <ReferenceLine
          y={thr}
          stroke="#EF4444"
          strokeDasharray="4 2"
          label={{
            value: "Threshold",
            position: "right",
            fontSize: 10,
            fill: "#EF4444",
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#4F46E5"
          strokeWidth={2}
          fill="url(#safeGrad)"
          dot={{ r: 3, fill: "#4F46E5" }}
          activeDot={{ r: 5 }}
          name="Score"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function FarFrrTimeline({ farFrrHistory }) {
  if (farFrrHistory.length < 2)
    return (
      <div
        style={{
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9CA3AF",
          fontSize: "0.8rem",
        }}
      >
        Appears after 2+ session checks
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart
        data={farFrrHistory}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="check" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          formatter={(v) => [`${v}%`]}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="far"
          stroke="#EF4444"
          strokeWidth={2}
          dot={{ r: 2 }}
          name="FAR %"
        />
        <Line
          type="monotone"
          dataKey="frr"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={{ r: 2 }}
          name="FRR %"
        />
        <Line
          type="monotone"
          dataKey="eer"
          stroke="#6D28D9"
          strokeWidth={2}
          dot={{ r: 2 }}
          name="EER %"
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AnomalyHeatmap({ allChecks }) {
  if (allChecks.length === 0)
    return (
      <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9CA3AF",
          fontSize: "0.8rem",
        }}
      >
        No checks yet
      </div>
    );
  const N = 60;
  const padded = [
    ...Array(Math.max(0, N - allChecks.length)).fill(null),
    ...allChecks.slice(-N),
  ];
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {padded.map((c, i) => {
          let bg = "#F3F4F6";
          if (c)
            bg =
              c.verdict === "granted"
                ? "#BBF7D0"
                : c.verdict === "denied"
                  ? "#FCA5A5"
                  : "#FDE68A";
          return (
            <div
              key={i}
              title={
                c
                  ? `#${c.n} ${c.verdict} ${c.score != null ? c.score.toFixed(3) : ""}`
                  : "empty"
              }
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: bg,
                transition: "background 0.3s",
                cursor: c ? "help" : "default",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {[
          { color: "#BBF7D0", label: "Verified" },
          { color: "#FCA5A5", label: "Anomaly" },
          { color: "#FDE68A", label: "Pending" },
          { color: "#F3F4F6", label: "Empty" },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
              }}
            />
            <span style={{ fontSize: "0.68rem", color: "#6B7280" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionHistoryCard({ logs }) {
  const byDay = {};
  logs.forEach((l) => {
    const day = new Date(l.attempted_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    byDay[day] = byDay[day] || [];
    byDay[day].push(l);
  });
  const days = Object.entries(byDay).slice(-5).reverse();
  if (days.length === 0)
    return (
      <div style={styles.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 17, color: "#4F46E5" }}
          >
            calendar_month
          </span>
          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
            Session History
          </span>
        </div>
        <p
          style={{
            fontSize: "0.8rem",
            color: "#9CA3AF",
            textAlign: "center",
            padding: "0.5rem 0",
          }}
        >
          No history yet
        </p>
      </div>
    );
  return (
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 17, color: "#4F46E5" }}
        >
          calendar_month
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          Session History (last 5 days)
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map(([day, entries]) => {
          const denied = entries.filter((e) => e.verdict === "denied").length;
          const granted = entries.filter((e) => e.verdict === "granted").length;
          const verdict =
            denied === 0 ? "green" : denied > granted ? "red" : "blue";
          return (
            <div
              key={day}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.55rem 0.75rem",
                borderRadius: 9,
                background: "#F8F9FC",
                border: "1px solid #E8ECF4",
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#1a1a2e",
                  minWidth: 60,
                }}
              >
                {day}
              </span>
              <span style={styles.badge(verdict)}>
                {denied === 0
                  ? "Clean"
                  : denied > granted
                    ? "Anomalous"
                    : "Mixed"}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.72rem",
                  color: "#6B7280",
                }}
              >
                {entries.length} checks · {denied} anomal
                {denied === 1 ? "y" : "ies"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportButton({
  allChecks,
  logs,
  stats,
  user,
  sessionDuration,
  totalKeys,
  wpm,
}) {
  function handleExport() {
    const now = new Date();
    const denied = allChecks.filter((c) => c.verdict === "denied").length;
    const granted = allChecks.filter((c) => c.verdict === "granted").length;
    const status =
      denied === 0 ? "Clean" : denied > granted ? "Anomalous" : "Mixed";
    const statusColor =
      status === "Clean"
        ? "#059669"
        : status === "Anomalous"
          ? "#DC2626"
          : "#F59E0B";
    const statusBg =
      status === "Clean"
        ? "#D1FAE5"
        : status === "Anomalous"
          ? "#FEE2E2"
          : "#FEF3C7";

    const logRows = logs
      .slice(0, 30)
      .map(
        (l) => `
      <tr>
        <td>${l.source === "login" ? "🔑 Login" : "⚡ Session"}</td>
        <td class="${l.verdict === "granted" ? "ok" : "bad"}">${l.verdict === "granted" ? "✓ Verified" : "✗ Anomaly"}</td>
        <td>${new Date(l.attempted_at).toLocaleTimeString()}</td>
        <td>${(l.score ?? 0).toFixed(4)}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ContinuAuth Session Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#1a1a2e;padding:36px;font-size:13px;line-height:1.6}
  .header{border-bottom:2px solid #4F46E5;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.03em}
  .logo span{color:#4F46E5}
  .sub{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6B7280;margin-top:2px}
  .meta{text-align:right;font-size:11px;color:#6B7280}
  .section{border:1px solid #E8ECF4;border-radius:8px;padding:16px;margin-bottom:16px}
  .stitle{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #F3F4F6}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
  .met{background:#F8F9FC;border-radius:6px;padding:12px;text-align:center}
  .val{font-size:22px;font-weight:700}
  .lbl{font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
  .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:700;font-size:12px;background:${statusBg};color:${statusColor}}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#F8F9FC;padding:8px 10px;text-align:left;font-weight:600;color:#374151;border-bottom:1px solid #E8ECF4}
  td{padding:7px 10px;border-bottom:1px solid #F9FAFB}
  .ok{color:#059669;font-weight:600}
  .bad{color:#DC2626;font-weight:600}
  .footer{margin-top:24px;text-align:center;font-size:10px;color:#9CA3AF;border-top:1px solid #E8ECF4;padding-top:16px}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Continu<span>Auth</span></div>
    <div class="sub">Behavioral Biometric Authentication - Session Report</div>
  </div>
  <div class="meta">
    <div><strong>${user?.username ?? "—"}</strong></div>
    <div>${now.toLocaleDateString()} · ${now.toLocaleTimeString()}</div>
  </div>
</div>

<div class="section">
  <div class="stitle">Session Overview</div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
    <span>Overall Status:</span>
    <span class="badge">${status}</span>
  </div>
  <div class="grid3">
    <div class="met"><div class="val">${fmtDur(sessionDuration)}</div><div class="lbl">Duration</div></div>
    <div class="met"><div class="val">${totalKeys}</div><div class="lbl">Keystrokes</div></div>
    <div class="met"><div class="val">${wpm}</div><div class="lbl">Avg WPM</div></div>
  </div>
</div>

<div class="section">
  <div class="stitle">Authentication Results</div>
  <div class="grid3">
    <div class="met"><div class="val">${allChecks.length}</div><div class="lbl">Total Checks</div></div>
    <div class="met"><div class="val" style="color:#059669">${granted}</div><div class="lbl">Verified</div></div>
    <div class="met"><div class="val" style="color:#DC2626">${denied}</div><div class="lbl">Anomalies</div></div>
  </div>
  ${
    stats
      ? `<div class="grid3">
    <div class="met"><div class="val" style="color:#EF4444">${stats.far}%</div><div class="lbl">False Accept Rate</div></div>
    <div class="met"><div class="val" style="color:#F59E0B">${stats.frr}%</div><div class="lbl">False Reject Rate</div></div>
    <div class="met"><div class="val" style="color:#6D28D9">${stats.eer}%</div><div class="lbl">Equal Error Rate</div></div>
  </div>`
      : ""
  }
</div>

<div class="section">
  <div class="stitle">Authentication Log (last 30 events)</div>
  <table>
    <thead><tr><th>Type</th><th>Result</th><th>Time</th><th>Score</th></tr></thead>
    <tbody>${logRows || '<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:16px">No events yet</td></tr>'}</tbody>
  </table>
</div>

<div class="footer">
  ContinuAuth — Continuous Behavioral Biometric Authentication<br>
  This report was automatically generated and covers this session only.
</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Allow pop-ups to export the report.");
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <button
      onClick={handleExport}
      style={{
        ...styles.btnSecondary,
        width: "auto",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: "0.78rem",
        padding: "0.4rem 0.8rem",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
        picture_as_pdf
      </span>
      Export Session Report
    </button>
  );
}

export default function SessionPage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("login_form");
  const [user, setUser] = useState(null);
  const [phrase, setPhrase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [phraseInput, setPhraseInput] = useState("");
  const phraseKs = useKeystroke();
  const phraseRef = useRef(null);

  const [draftText, setDraftText] = useState("");
  const sessionKs = useKeystroke();
  const textareaRef = useRef(null);

  const [loginScore, setLoginScore] = useState(null);
  const [loginScoreErr, setLoginScoreErr] = useState("");

  const [checkCount, setCheckCount] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [lastCheck, setLastCheck] = useState(null);
  const [anomalyWarning, setAnomalyWarning] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);

  const [sessionTrained, setSessionTrained] = useState(false);
  const [sessionChecks, setSessionChecks] = useState([]);
  const [allChecks, setAllChecks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [checking, setChecking] = useState(false);
  const [windowsAccumulated, setWindowsAccumulated] = useState(0);
  const [trainTriggered, setTrainTriggered] = useState(false);

  const [latestScore, setLatestScore] = useState(null);
  const [latestThreshold, setLatestThreshold] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [wpmHistory, setWpmHistory] = useState([]);
  const [sessionStartMs, setSessionStartMs] = useState(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [farFrrHistory, setFarFrrHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (phase !== "dashboard") return;
    if (!sessionStartMs) setSessionStartMs(Date.now());
    const id = setInterval(
      () => setSessionDuration(Date.now() - (sessionStartMs || Date.now())),
      1000,
    );
    return () => clearInterval(id);
  }, [phase, sessionStartMs]);

  useEffect(() => {
    if (phase !== "dashboard") return;
    const w = computeWpm(draftText, sessionDuration);
    setWpm(w);
    if (w > 0) setWpmHistory((h) => [...h.slice(-19), { v: w }]);
  }, [draftText, sessionDuration, phase]);

  const refreshStats = useCallback(async (uid) => {
    try {
      const s = await api.getSessionLogs(uid);
      const rows = s.logs || [];
      setLogs(rows);
      const loginRows = rows.filter((r) => r.source === "login");
      const sessionRows = rows.filter((r) => r.source === "session");
      const frr = loginRows.length
        ? loginRows.filter((r) => r.verdict === "denied").length /
          loginRows.length
        : 0;
      const far = sessionRows.length
        ? sessionRows.filter((r) => r.verdict === "denied").length /
          sessionRows.length
        : 0;
      const newStats = {
        far: +(far * 100).toFixed(2),
        frr: +(frr * 100).toFixed(2),
        eer: +(((far + frr) / 2) * 100).toFixed(2),
      };
      setStats(newStats);
      setFarFrrHistory((h) => [
        ...h,
        {
          check: `#${sessionRows.length}`,
          far: newStats.far,
          frr: newStats.frr,
          eer: newStats.eer,
        },
      ]);
    } catch (_) {}
  }, []);

  // Step 1: Password login
  async function handleLogin() {
    setError("");
    if (!username.trim() || !password.trim())
      return setError("Enter username and password.");
    setLoading(true);
    try {
      const u = await api.login(username.trim().toLowerCase(), password);
      if (!u.enrolled) {
        setError(
          "You have not enrolled yet. Please register and enroll first.",
        );
        setLoading(false);
        return;
      }
      setUser(u);
      const { phrase: p } = await api.getPhrase();
      setPhrase(p);
      setPhase("phrase_entry");
      setTimeout(() => phraseRef.current?.focus(), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Phrase keystroke scoring
  async function handlePhraseSubmit() {
    setError("");
    if (phraseInput.trim().toLowerCase() !== phrase.toLowerCase()) {
      setLoginScoreErr(
        "Phrase does not match. Please type it exactly as shown.",
      );
      setPhraseInput("");
      phraseKs.reset();
      phraseRef.current?.focus();
      return;
    }
    setLoading(true);
    setLoginScoreErr("");
    try {
      const events = phraseKs.getEvents();
      const res = await api.scoreLogin(user.user_id, events);
      setLoginScore(res);
      setLatestThreshold(res.threshold);

      if (res.session_model_exists) setSessionTrained(true);

      if (res.access_denied) {
        setPhase("access_denied");
      } else {
        await refreshStats(user.user_id);
        setPhase("dashboard");
        setSessionStartMs(Date.now());
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Session continuous check
  const sessionTrainedRef = useRef(sessionTrained);
  const trainTriggeredRef = useRef(trainTriggered);
  useEffect(() => {
    sessionTrainedRef.current = sessionTrained;
  }, [sessionTrained]);
  useEffect(() => {
    trainTriggeredRef.current = trainTriggered;
  }, [trainTriggered]);

  const runSessionCheck = useCallback(
    async (events, keyCount) => {
      if (checking || !user) return;
      setChecking(true);
      const now = new Date().toLocaleTimeString();
      try {
        const res = await api.scoreSession(
          user.user_id,
          SESSION_ID,
          events,
          keyCount,
        );
        setWindowsAccumulated(res.windows_accumulated ?? 0);

        const newN = checkCount + 1;
        const entry = {
          n: newN,
          score: res.score,
          verdict: res.verdict,
          model: res.model_used,
          windows: res.windows_scored,
          keys: keyCount,
          threshold: res.threshold,
          time: now,
        };
        setLastCheck(entry);
        setCheckCount((c) => c + 1);
        setAllChecks((prev) => [...prev, entry]);

        if (res.verdict === "pending") {
          if (res.can_train_session && !trainTriggeredRef.current) {
            setTrainTriggered(true);
            try {
              const tr = await api.trainSessionModel(user.user_id);
              if (tr.success) setSessionTrained(true);
            } catch (_) {}
          }
          setChecking(false);
          return;
        }

        if (res.score !== null) {
          setLatestScore(res.score);
          if (res.threshold !== null) setLatestThreshold(res.threshold);
          setSessionChecks((prev) => [
            ...prev,
            { n: newN, score: res.score, threshold: res.threshold },
          ]);
        }

        if (!sessionTrainedRef.current) setSessionTrained(true);

        if (res.verdict === "denied") {
          const nc = anomalyCount + 1;
          setAnomalyCount(nc);
          if (nc > WARNING_LIMIT) setPhase("locked");
          else setAnomalyWarning(true);
        } else {
          setAnomalyWarning(false);
        }

        if (res.can_train_session && !trainTriggeredRef.current) {
          setTrainTriggered(true);
          try {
            const tr = await api.trainSessionModel(user.user_id);
            if (tr.success && tr.retrained) setTrainTriggered(false);
          } catch (_) {}
        }

        await refreshStats(user.user_id);
      } catch (_) {
      } finally {
        setChecking(false);
      }
    },
    [checking, user, checkCount, anomalyCount, refreshStats],
  );

  function handleDraftKeyDown(e) {
    sessionKs.onKeyDown(e);
    const nc = totalKeys + 1;
    setTotalKeys(nc);
    if (nc % CHECK_EVERY === 0) runSessionCheck(sessionKs.getEvents(), nc);
  }

  function handleManualCheck() {
    if (totalKeys < 30) return;
    runSessionCheck(sessionKs.getEvents(), totalKeys);
  }

  function handleLogout() {
    navigate("/");
  }

  const grantedInSession = logs.filter(
    (l) => l.source === "session" && l.verdict === "granted",
  ).length;
  const deniedInSession = logs.filter(
    (l) => l.source === "session" && l.verdict === "denied",
  ).length;
  const metricsBarData = stats
    ? [
        { name: "FAR %", value: stats.far, fill: "#EF4444" },
        { name: "FRR %", value: stats.frr, fill: "#F59E0B" },
        { name: "EER %", value: stats.eer, fill: "#6D28D9" },
      ]
    : [];

  function TabBtn({ id, icon, label }) {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0.5rem 1rem",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 600,
          background: active ? "#4F46E5" : "transparent",
          color: active ? "#fff" : "#6B7280",
          transition: "all 0.15s",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          {icon}
        </span>
        {label}
      </button>
    );
  }

  function MetricChip({ icon, value, label, color }) {
    return (
      <div
        style={{
          ...styles.metric,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 20, color: color || "#4F46E5", marginBottom: 2 }}
        >
          {icon}
        </span>
        <div style={{ ...styles.metricValue, fontSize: "1.3rem" }}>{value}</div>
        <div style={styles.metricLabel}>{label}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.page,
        background:
          phase === "dashboard" || phase === "locked" ? "#f8f9fc" : "#fff",
      }}
    >
      {/* Login Form */}
      {phase === "login_form" && (
        <>
          <button
            onClick={() => navigate("/")}
            style={{
              ...styles.btnSecondary,
              width: "auto",
              marginBottom: "1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.8rem",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16 }}
            >
              arrow_back
            </span>
            Back to Home
          </button>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: 60,
                height: 60,
                background: "#EEF2FF",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 30, color: "#4F46E5" }}
              >
                lock_open
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Welcome Back
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#6B7280" }}>
              Sign in to your account
            </p>
          </div>
          {error && <div style={styles.alert("error")}>{error}</div>}
          <div style={styles.card}>
            <label style={styles.label}>Username</label>
            <input
              style={{ ...styles.input, marginBottom: 12 }}
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            <label style={styles.label}>Password</label>
            <input
              style={{ ...styles.input, marginBottom: 20 }}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              style={styles.btnPrimary}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <hr style={{ ...styles.divider, margin: "1rem 0" }} />
            <button
              style={styles.btnSecondary}
              onClick={() => navigate("/enroll")}
            >
              Create an account
            </button>
          </div>
        </>
      )}

      {/* Enter phrase */}
      {phase === "phrase_entry" && (
        <>
          <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: "#EEF2FF",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 28, color: "#4F46E5" }}
              >
                keyboard
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Keystroke Verification
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#6B7280" }}>
              Type the phrase below to verify your typing identity
            </p>
          </div>
          {error && <div style={styles.alert("error")}>{error}</div>}
          {loginScoreErr && (
            <div style={styles.alert("error")}>{loginScoreErr}</div>
          )}
          <div style={styles.card}>
            <div
              style={{
                background: "#F5F3FF",
                border: "1px solid #DDD6FE",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#6D28D9",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Type this phrase exactly
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.97rem",
                  color: "#1a1a2e",
                  letterSpacing: "0.03em",
                }}
              >
                {phrase}
              </div>
            </div>
            <div style={{ ...styles.alert("info"), marginBottom: 12 }}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 15,
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                info
              </span>
              Type at your normal pace. Your keystroke dynamics are being
              analysed.
            </div>
            <label style={styles.label}>Your input</label>
            <input
              ref={phraseRef}
              style={{ ...styles.input, marginBottom: 14, fontSize: "0.92rem" }}
              placeholder="Type the phrase above..."
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              onKeyDown={(e) => {
                phraseKs.onKeyDown(e);
                if (e.key === "Enter") handlePhraseSubmit();
              }}
              onKeyUp={phraseKs.onKeyUp}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              style={styles.btnIndigo}
              onClick={handlePhraseSubmit}
              disabled={loading || !phraseInput.trim()}
            >
              {loading ? "Verifying..." : "Verify Identity"}
            </button>
          </div>
        </>
      )}

      {/* access denied */}
      {phase === "access_denied" && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: "#FEE2E2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 40, color: "#DC2626" }}
            >
              gpp_bad
            </span>
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Access Denied
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#6B7280",
              maxWidth: 360,
              margin: "0 auto 8px",
            }}
          >
            Your keystroke pattern did not match the enrolled profile.
          </p>
          {loginScore && (
            <div
              style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: 20 }}
            >
              Score: <strong>{loginScore.score?.toFixed(4)}</strong> —
              Threshold: <strong>{loginScore.threshold?.toFixed(4)}</strong>
            </div>
          )}
          <div
            style={{
              ...styles.alert("error"),
              maxWidth: 400,
              margin: "0 auto 20px",
              textAlign: "left",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, verticalAlign: "middle", marginRight: 6 }}
            >
              security
            </span>
            If this is your account, ensure you are typing naturally at your
            normal pace and try again.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              style={{ ...styles.btnSecondary, width: "auto" }}
              onClick={() => {
                setPhraseInput("");
                phraseKs.reset();
                setLoginScore(null);
                setLoginScoreErr("");
                setPhase("phrase_entry");
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 16,
                  verticalAlign: "middle",
                  marginRight: 4,
                }}
              >
                replay
              </span>
              Try Again
            </button>
            <button
              style={{ ...styles.btnSecondary, width: "auto" }}
              onClick={() => navigate("/")}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 16,
                  verticalAlign: "middle",
                  marginRight: 4,
                }}
              >
                home
              </span>
              Home
            </button>
          </div>
        </div>
      )}

      {phase === "dashboard" && user && (
        <>
          {/* Top bar */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #E8ECF4",
              borderRadius: 12,
              padding: "0.8rem 1.2rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <HeaderDashboard username={user.username} />
              <div style={{ display: "flex", gap: 8 }}>
                <ExportButton
                  allChecks={allChecks}
                  logs={logs}
                  stats={stats}
                  user={user}
                  sessionDuration={sessionDuration}
                  totalKeys={totalKeys}
                  wpm={wpm}
                />
                <button
                  onClick={handleLogout}
                  style={{
                    ...styles.btnSecondary,
                    width: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.8rem",
                    padding: "0.4rem 0.9rem",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    logout
                  </span>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {loginScore && (
            <div
              style={{
                ...styles.alert(
                  loginScore.verdict === "granted" ? "success" : "error",
                ),
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.8rem",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 17 }}
              >
                {loginScore.verdict === "granted" ? "verified_user" : "gpp_bad"}
              </span>
              {loginScore.verdict === "granted"
                ? `Login keystroke verified — score: ${loginScore.score?.toFixed(4)}`
                : `Login keystroke anomaly — score: ${loginScore.score?.toFixed(4)}`}
            </div>
          )}

          {!sessionTrained && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FCD34D",
                borderRadius: 10,
                padding: "0.65rem 1rem",
                marginBottom: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: "#D97706" }}
              >
                model_training
              </span>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    color: "#92400E",
                  }}
                >
                  Building your session profile
                </div>
                <div
                  style={{
                    fontSize: "0.74rem",
                    color: "#B45309",
                    marginTop: 1,
                  }}
                >
                  Collecting free-text windows — {windowsAccumulated}/20 ready.
                  Type ~{Math.max(0, 400 - totalKeys)} more characters. No
                  anomaly checks until profile is built.
                </div>
              </div>
            </div>
          )}

          {anomalyWarning && (
            <div
              style={{
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: 10,
                padding: "0.7rem 1rem",
                marginBottom: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: "#D97706" }}
              >
                warning
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#92400E",
                  }}
                >
                  Anomaly Detected — Warning {anomalyCount}/{WARNING_LIMIT}
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "#B45309",
                    marginTop: 2,
                  }}
                >
                  {WARNING_LIMIT - anomalyCount} more anomal
                  {WARNING_LIMIT - anomalyCount === 1 ? "y" : "ies"} will
                  terminate this session.
                </div>
              </div>
              <button
                onClick={() => setAnomalyWarning(false)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#B45309",
                  cursor: "pointer",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18 }}
                >
                  close
                </span>
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 4,
              background: "#F3F4F6",
              borderRadius: 10,
              padding: 4,
              marginBottom: "1rem",
            }}
          >
            <TabBtn id="dashboard" icon="dashboard" label="Dashboard" />
            <TabBtn id="analysis" icon="analytics" label="Analysis" />
            <TabBtn id="history" icon="calendar_month" label="History" />
          </div>

          {activeTab === "dashboard" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto auto 1fr 1fr 1fr 1fr",
                  gap: "0.6rem",
                  marginBottom: "0.8rem",
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    ...styles.card,
                    marginBottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.8rem",
                  }}
                >
                  <HealthRing
                    score={latestScore}
                    threshold={latestThreshold}
                    pending={!sessionTrained}
                  />
                </div>
                <div
                  style={{
                    ...styles.card,
                    marginBottom: 0,
                    padding: "0.7rem",
                    minWidth: 110,
                  }}
                >
                  <WpmCard wpm={wpm} wpmHistory={wpmHistory} />
                </div>
                <MetricChip
                  icon="keyboard"
                  value={totalKeys}
                  label="Keystrokes"
                  color="#4F46E5"
                />
                <MetricChip
                  icon="check_circle"
                  value={grantedInSession}
                  label="Verified"
                  color="#059669"
                />
                <MetricChip
                  icon="gpp_bad"
                  value={deniedInSession}
                  label="Anomalies"
                  color="#DC2626"
                />
                <div
                  style={{
                    ...styles.metric,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    justifyContent: "center",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 20, color: "#059669" }}
                  >
                    timer
                  </span>
                  <div style={{ ...styles.metricValue, fontSize: "1.1rem" }}>
                    {fmtDur(sessionDuration)}
                  </div>
                  <div style={styles.metricLabel}>Duration</div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 280px",
                  gap: "0.8rem",
                  marginBottom: "0.8rem",
                }}
              >
                <div style={styles.card}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 17, color: "#4F46E5" }}
                      >
                        edit_note
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        Continuous Authentication
                      </span>
                    </div>
                    <span
                      style={{
                        ...styles.badge(sessionTrained ? "green" : "blue"),
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: "0.68rem",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 11 }}
                      >
                        {sessionTrained ? "verified_user" : "hourglass_top"}
                      </span>
                      {sessionTrained ? "LOF Active" : "Building"}
                    </span>
                  </div>
                  <NextCheckBar totalKeys={totalKeys} />
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#9CA3AF",
                      marginBottom: 6,
                    }}
                  >
                    Type anything — checks every {CHECK_EVERY} keystrokes,
                    silently in the background.
                  </p>
                  <textarea
                    ref={textareaRef}
                    rows={6}
                    style={{
                      ...styles.input,
                      resize: "vertical",
                      lineHeight: 1.6,
                      fontSize: "0.88rem",
                    }}
                    placeholder="Start typing here..."
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    onKeyUp={sessionKs.onKeyUp}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>
                      {draftText.length} chars · {totalKeys} keystrokes
                    </span>
                    <button
                      onClick={handleManualCheck}
                      disabled={checking || totalKeys < 30}
                      style={{
                        ...styles.btnSecondary,
                        width: "auto",
                        padding: "0.3rem 0.8rem",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14 }}
                      >
                        {checking ? "hourglass_top" : "play_circle"}
                      </span>
                      {checking ? "Checking..." : "Check Now"}
                    </button>
                  </div>
                </div>

                <div style={styles.card}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 17, color: "#4F46E5" }}
                    >
                      radar
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      Last Check
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.72rem",
                        color: "#9CA3AF",
                      }}
                    >
                      {checkCount} total
                    </span>
                  </div>
                  {lastCheck ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          padding: "0.8rem",
                          borderRadius: 10,
                          background:
                            lastCheck.verdict === "granted"
                              ? "#F0FDF4"
                              : lastCheck.verdict === "pending"
                                ? "#FFFBEB"
                                : "#FEF2F2",
                          border: `1px solid ${lastCheck.verdict === "granted" ? "#BBF7D0" : lastCheck.verdict === "pending" ? "#FCD34D" : "#FECACA"}`,
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: 32,
                            color:
                              lastCheck.verdict === "granted"
                                ? "#059669"
                                : lastCheck.verdict === "pending"
                                  ? "#D97706"
                                  : "#DC2626",
                          }}
                        >
                          {lastCheck.verdict === "granted"
                            ? "verified_user"
                            : lastCheck.verdict === "pending"
                              ? "hourglass_top"
                              : "gpp_bad"}
                        </span>
                        <div
                          style={{
                            fontFamily: "'Space Grotesk',sans-serif",
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            marginTop: 4,
                            color:
                              lastCheck.verdict === "granted"
                                ? "#065F46"
                                : lastCheck.verdict === "pending"
                                  ? "#92400E"
                                  : "#991B1B",
                          }}
                        >
                          {lastCheck.verdict === "granted"
                            ? "Verified"
                            : lastCheck.verdict === "pending"
                              ? "Building Profile"
                              : "Anomaly"}
                        </div>
                      </div>
                      {[
                        { label: "Check", value: `#${lastCheck.n}` },
                        {
                          label: "Score",
                          value:
                            lastCheck.score != null
                              ? lastCheck.score.toFixed(4)
                              : "—",
                        },
                        {
                          label: "Threshold",
                          value:
                            lastCheck.threshold != null
                              ? lastCheck.threshold.toFixed(4)
                              : "—",
                        },
                        { label: "Windows", value: lastCheck.windows ?? "—" },
                        { label: "Model", value: lastCheck.model ?? "—" },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ fontSize: "0.74rem", color: "#6B7280" }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              maxWidth: 120,
                              textAlign: "right",
                              wordBreak: "break-all",
                            }}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "1.5rem 0",
                        color: "#9CA3AF",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 36,
                          display: "block",
                          marginBottom: 8,
                        }}
                      >
                        pending
                      </span>
                      <span style={{ fontSize: "0.8rem" }}>
                        Awaiting first check
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.card}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17, color: "#4F46E5" }}
                  >
                    show_chart
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    Confidence Timeline
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.72rem",
                      color: "#9CA3AF",
                    }}
                  >
                    Shaded area = safe zone above threshold
                  </span>
                </div>
                <ConfidenceTimeline sessionChecks={sessionChecks} />
              </div>
            </>
          )}

          {activeTab === "analysis" && (
            <>
              <CheckTable checks={allChecks} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.8rem",
                  marginBottom: "0.8rem",
                }}
              >
                <div style={styles.card}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 17, color: "#4F46E5" }}
                    >
                      trending_up
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      FAR / FRR Over Time
                    </span>
                  </div>
                  <FarFrrTimeline farFrrHistory={farFrrHistory} />
                  {stats && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        marginTop: 8,
                      }}
                    >
                      {[
                        { label: "FAR", value: stats.far, color: "#EF4444" },
                        { label: "FRR", value: stats.frr, color: "#F59E0B" },
                        { label: "EER", value: stats.eer, color: "#6D28D9" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              color,
                              fontFamily: "'Space Grotesk',sans-serif",
                            }}
                          >
                            {value}%
                          </div>
                          <div
                            style={{ fontSize: "0.68rem", color: "#6B7280" }}
                          >
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={styles.card}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 17, color: "#4F46E5" }}
                    >
                      grid_view
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      Anomaly Heatmap
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.72rem",
                        color: "#9CA3AF",
                      }}
                    >
                      Last 60 checks
                    </span>
                  </div>
                  <AnomalyHeatmap allChecks={allChecks} />
                </div>
              </div>

              <div style={styles.card}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17, color: "#4F46E5" }}
                  >
                    history
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    Authentication Log
                  </span>
                </div>
                {logs.length === 0 ? (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#9CA3AF",
                      textAlign: "center",
                      padding: "1rem 0",
                    }}
                  >
                    No logs yet
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      maxHeight: 280,
                      overflowY: "auto",
                    }}
                  >
                    {logs
                      .slice()
                      .reverse()
                      .map((log, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "0.45rem 0.7rem",
                            borderRadius: 8,
                            background:
                              log.verdict === "granted" ? "#F0FDF4" : "#FEF2F2",
                            border: `1px solid ${log.verdict === "granted" ? "#D1FAE5" : "#FECACA"}`,
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: 15,
                              color:
                                log.verdict === "granted"
                                  ? "#059669"
                                  : "#DC2626",
                              flexShrink: 0,
                            }}
                          >
                            {log.verdict === "granted"
                              ? "check_circle"
                              : "cancel"}
                          </span>
                          <span
                            style={{
                              ...styles.badge(
                                log.source === "login"
                                  ? "blue"
                                  : log.verdict === "granted"
                                    ? "green"
                                    : "red",
                              ),
                              flexShrink: 0,
                              fontSize: "0.68rem",
                            }}
                          >
                            {log.source}
                          </span>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "#1a1a2e",
                              flex: 1,
                            }}
                          >
                            {log.verdict === "granted" ? "Verified" : "Anomaly"}
                            <span
                              style={{
                                fontWeight: 400,
                                color: "#6B7280",
                                marginLeft: 6,
                              }}
                            >
                              score: {(log.score ?? 0).toFixed(4)}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "#9CA3AF",
                              flexShrink: 0,
                            }}
                          >
                            {new Date(log.attempted_at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "history" && (
            <>
              <SessionHistoryCard logs={logs} />
              <div style={styles.card}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17, color: "#4F46E5" }}
                  >
                    bar_chart
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    Current Session Metrics
                  </span>
                </div>
                {stats && stats.far + stats.frr + stats.eer > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart
                        data={metricsBarData}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          unit="%"
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(v) => [`${v}%`]}
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                          fill="#4F46E5"
                          label={{
                            position: "top",
                            fontSize: 10,
                            formatter: (v) => `${v}%`,
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        marginTop: 6,
                      }}
                    >
                      {metricsBarData.map(({ name, value, fill }) => (
                        <div key={name} style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              color: fill,
                              fontFamily: "'Space Grotesk',sans-serif",
                            }}
                          >
                            {value}%
                          </div>
                          <div
                            style={{ fontSize: "0.68rem", color: "#6B7280" }}
                          >
                            {name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#9CA3AF",
                      fontSize: "0.8rem",
                      padding: "1rem 0",
                    }}
                  >
                    Metrics appear after first verified session check
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {phase === "locked" && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: "#FEE2E2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 44, color: "#DC2626" }}
            >
              lock
            </span>
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: 8,
              color: "#991B1B",
            }}
          >
            Session Terminated
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#6B7280",
              maxWidth: 380,
              margin: "0 auto 8px",
            }}
          >
            Multiple keystroke anomalies were detected. Your session has been
            locked for security.
          </p>
          <div
            style={{ fontSize: "0.8rem", color: "#9CA3AF", marginBottom: 24 }}
          >
            Anomalies detected: <strong>{anomalyCount}</strong>
          </div>
          <div
            style={{
              ...styles.alert("error"),
              maxWidth: 420,
              margin: "0 auto 24px",
              textAlign: "left",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, verticalAlign: "middle", marginRight: 6 }}
            >
              security
            </span>
            If you are the legitimate user, return to the home page and log in
            again. Type at your natural, relaxed pace.
          </div>
          <button
            style={{ ...styles.btnPrimary, width: "auto" }}
            onClick={() => navigate("/")}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}
            >
              home
            </span>
            Return to Home
          </button>
        </div>
      )}
    </div>
  );
}
