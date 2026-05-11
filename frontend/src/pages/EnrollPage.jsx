import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderHome } from "../components/Header";
import { styles } from "../components/styles";
import { useKeystroke } from "../hooks/useKeystroke";
import { api } from "../api/client";

const REQUIRED = 8;
const FREE_TEXT_TARGET = 200; // keystrokes needed to seed LOF

// Step labels — 5 steps total (0–4)
const STEPS = [
  "Create your account",
  "Guidelines Review",
  "Fixed-Phrase Enrollment",
  "Free-Typing Enrollment",
  "Registration Complete",
];

export default function EnrollPage() {
  const navigate = useNavigate();
  const ks = useKeystroke(); // used for phrase typing
  const freeKs = useKeystroke(); // used for free-text typing
  const inputRef = useRef(null);
  const freeTextRef = useRef(null);

  const [step, setStep] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [user, setUser] = useState(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [collectedAttempts, setCollectedAttempts] = useState([]);
  const [typed, setTyped] = useState("");
  const [attemptOk, setAttemptOk] = useState(null);

  // Free-text state
  const [freeText, setFreeText] = useState("");
  const [freeKeyCount, setFreeKeyCount] = useState(0);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saved = collectedAttempts.length;
  const freeProgress = Math.min(100, (freeKeyCount / FREE_TEXT_TARGET) * 100);
  const freeReady = freeKeyCount >= FREE_TEXT_TARGET;

  // ── Step 0: Validate form ──────────────────────────────────────────────────
  async function handleRegister() {
    setError("");
    if (
      !username.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    )
      return setError("All fields are required.");
    if (username.trim().length < 3)
      return setError("Username must be at least 3 characters.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      const { phrase: p } = await api.getPhrase();
      setPhrase(p);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Collect phrase attempts ───────────────────────────────────────
  async function handleAttemptSubmit() {
    if (typed.trim().toLowerCase() !== phrase.toLowerCase()) {
      setAttemptOk("err");
      setTyped("");
      ks.reset();
      inputRef.current?.focus();
      return;
    }
    const events = ks.getEvents();
    const newAttempts = [...collectedAttempts, events];
    setCollectedAttempts(newAttempts);
    setAttemptOk("ok");
    setTyped("");
    ks.reset();
    inputRef.current?.focus();

    if (newAttempts.length >= REQUIRED) {
      setLoading(true);
      try {
        // 1. Create user account
        const u = await api.register(
          username.trim().toLowerCase(),
          email.trim().toLowerCase(),
          password,
        );
        setUser(u);
        // 2. Save all collected phrase attempts
        for (const evts of newAttempts) {
          await api.saveAttempt(u.user_id, evts);
        }
        // 3. Train OC-SVM login model
        await api.trainModel(u.user_id);
        // Move to free-text seeding step
        setStep(3);
        setTimeout(() => freeTextRef.current?.focus(), 150);
      } catch (e) {
        setError(e.message);
        setCollectedAttempts([]);
        setAttemptOk(null);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleKeyDown(e) {
    ks.onKeyDown(e);
    if (e.key === "Enter") handleAttemptSubmit();
  }

  // ── Step 3: Free-text keystroke collection ────────────────────────────────
  function handleFreeKeyDown(e) {
    freeKs.onKeyDown(e);
    setFreeKeyCount((c) => c + 1);
  }

  async function handleSeedSession() {
    setSeedError("");
    if (!freeReady) return;
    setSeedLoading(true);
    try {
      await api.seedSession(user.user_id, freeKs.getEvents());
      setStep(4);
    } catch (e) {
      // Seeding failure is non-fatal — session model builds in first session instead
      setSeedError(
        e.message +
          " (You can still log in, model will build during your session.)",
      );
      setStep(4);
    } finally {
      setSeedLoading(false);
    }
  }

  // ── Stepper ────────────────────────────────────────────────────────────────
  function Stepper() {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        {STEPS.map((label, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i < STEPS.length - 1 ? 1 : 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    i < step ? "#4F46E5" : i === step ? "#1a1a2e" : "#E8ECF4",
                  color: i <= step ? "#fff" : "#9CA3AF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  transition: "all 0.2s",
                }}
              >
                {i < step ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14 }}
                  >
                    check
                  </span>
                ) : (
                  i + 1
                )}
              </div>
              <span
                style={{
                  fontSize: "0.62rem",
                  marginTop: 3,
                  whiteSpace: "nowrap",
                  color: i === step ? "#1a1a2e" : "#9CA3AF",
                  fontWeight: i === step ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 4px",
                  marginBottom: 16,
                  background: i < step ? "#4F46E5" : "#E8ECF4",
                  transition: "background 0.2s",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, background: "#fff" }}>
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
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          arrow_back
        </span>
        Back to Home
      </button>

      <HeaderHome />
      <hr style={styles.divider} />
      <Stepper />

      {error && <div style={styles.alert("error")}>{error}</div>}

      {/* ── Step 0: Registration form ── */}
      {step === 0 && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: "#4F46E5" }}
            >
              person_add
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              Create Your Account
            </span>
          </div>

          <label style={styles.label}>Username</label>
          <input
            style={{ ...styles.input, marginBottom: 12 }}
            placeholder="e.g. john_doe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            autoFocus
          />

          <label style={styles.label}>Email</label>
          <input
            style={{ ...styles.input, marginBottom: 12 }}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />

          <label style={styles.label}>Password</label>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              style={{ ...styles.input, paddingRight: "2.5rem" }}
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
            <span
              className="material-symbols-outlined"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 18,
                color: "#9CA3AF",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </div>

          <label style={styles.label}>Confirm Password</label>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input
              style={{
                ...styles.input,
                paddingRight: "2.5rem",
                borderColor: confirmPassword
                  ? password === confirmPassword
                    ? "#6EE7B7"
                    : "#FCA5A5"
                  : undefined,
              }}
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
            {confirmPassword && (
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 18,
                  pointerEvents: "none",
                  color: password === confirmPassword ? "#059669" : "#DC2626",
                }}
              >
                {password === confirmPassword ? "check_circle" : "cancel"}
              </span>
            )}
          </div>

          <button
            style={styles.btnPrimary}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "Preparing enrollment..." : "Continue to Enrollment"}
          </button>
        </div>
      )}

      {/* ── Step 1: Guide ── */}
      {step === 1 && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: "#4F46E5" }}
            >
              menu_book
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              How Enrollment Works
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                icon: "keyboard",
                title: "Fixed Phrase Entry",
                desc: "You will be asked to type the same phrase eight times. This process trains the login verification model.",
              },
              {
                icon: "speed",
                title: "Typing Instructions",
                desc: "Please type at your natural pace. Avoid intentionally speeding up or slowing down, as consistency improves model accuracy.",
              },
              {
                icon: "edit_note",
                title: "Type freely (~200 keystrokes)",
                desc: "After completing the fixed phrase step, you can type freely. This stage trains the continuous session model, enabling real-time authentication from your very first login.",
              },
              {
                icon: "model_training",
                title: "Automated Model Training",
                desc: "Both the login and session models are trained and stored automatically. No additional setup is required.",
              },
              {
                icon: "policy",
                title: "Continuous Session Protection",
                desc: "During active sessions, the system verifies your identity every 100 keystrokes. Any significant deviation in typing behavior triggers an anomaly alert.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    background: "#EEF2FF",
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: "#4F46E5" }}
                  >
                    {icon}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.83rem",
                      fontWeight: 600,
                      color: "#1a1a2e",
                      marginBottom: 2,
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "#6B7280",
                      lineHeight: 1.5,
                    }}
                  >
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              borderRadius: 10,
              padding: "0.8rem 1rem",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#6D28D9",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Your enrollment phrase
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "1rem",
                color: "#1a1a2e",
                letterSpacing: "0.03em",
              }}
            >
              {phrase}
            </div>
          </div>

          <button
            style={styles.btnPrimary}
            onClick={() => {
              setStep(2);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            Start Enrollment
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 6 }}
            >
              arrow_forward
            </span>
          </button>
        </div>
      )}

      {/* ── Step 2: Phrase attempts ── */}
      {step === 2 && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: "#4F46E5" }}
              >
                fingerprint
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  fontFamily: "'Space Grotesk',sans-serif",
                }}
              >
                Phrase Enrollment
              </span>
            </div>
            <span
              style={{
                fontSize: "0.78rem",
                color: "#6B7280",
                background: "#F3F4F6",
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              Attempt {Math.min(saved + 1, REQUIRED)} of {REQUIRED}
            </span>
          </div>

          <div
            style={{
              background: "#E8ECF4",
              borderRadius: 99,
              height: 6,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: "linear-gradient(90deg, #4F46E5, #6D28D9)",
                width: `${(saved / REQUIRED) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>

          <div
            style={{
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              borderRadius: 10,
              padding: "0.8rem 1rem",
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

          {attemptOk === "ok" && saved < REQUIRED && (
            <div
              style={{
                ...styles.alert("success"),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                check_circle
              </span>
              Attempt {saved} recorded — {REQUIRED - saved} more to go.
            </div>
          )}
          {attemptOk === "ok" && saved >= REQUIRED && (
            <div
              style={{
                ...styles.alert("success"),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                check_circle
              </span>
              All {REQUIRED} attempts done. Training your profile now...
            </div>
          )}
          {attemptOk === "err" && (
            <div
              style={{
                ...styles.alert("error"),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                error
              </span>
              Phrase did not match — type it exactly as shown.
            </div>
          )}
          {loading && (
            <div
              style={{
                ...styles.alert("info"),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                hourglass_top
              </span>
              Creating your account and training login model. Please wait...
            </div>
          )}

          <input
            ref={inputRef}
            style={{ ...styles.input, marginBottom: 12, fontSize: "0.92rem" }}
            placeholder="Type the phrase here and press Enter..."
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={ks.onKeyUp}
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />

          <button
            style={styles.btnIndigo}
            onClick={handleAttemptSubmit}
            disabled={loading || !typed.trim()}
          >
            {loading ? "Saving profile..." : "Submit Attempt"}
          </button>

          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 14,
              justifyContent: "center",
            }}
          >
            {Array.from({ length: REQUIRED }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 8,
                  borderRadius: 4,
                  background: i < saved ? "#4F46E5" : "#E8ECF4",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.72rem",
              color: "#9CA3AF",
              marginTop: 6,
            }}
          >
            {saved} / {REQUIRED} attempts collected
            {saved === 0 && " — nothing saved to server yet"}
          </p>
        </div>
      )}

      {/* ── Step 3: Free-text typing to seed session LOF ── */}
      {step === 3 && user && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: "#4F46E5" }}
            >
              edit_note
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              Session Profile Setup
            </span>
            <span
              style={{
                marginLeft: "auto",
                ...styles.badge(freeReady ? "green" : "blue"),
                fontSize: "0.72rem",
              }}
            >
              {freeReady
                ? "Ready!"
                : `${freeKeyCount} / ${FREE_TEXT_TARGET} keystrokes`}
            </span>
          </div>

          <div style={{ ...styles.alert("info"), marginBottom: 14 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, verticalAlign: "middle", marginRight: 6 }}
            >
              info
            </span>
            Last step! Type anything freely for ~200
            keystrokes.
          </div>

          <div
            style={{
              background: "#E8ECF4",
              borderRadius: 99,
              height: 8,
              marginBottom: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: freeReady
                  ? "linear-gradient(90deg, #059669, #10B981)"
                  : "linear-gradient(90deg, #6D28D9, #4F46E5)",
                width: `${freeProgress}%`,
                transition: "width 0.2s ease, background 0.4s",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
              Free-text keystrokes
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: freeReady ? "#059669" : "#4F46E5",
              }}
            >
              {freeKeyCount} / {FREE_TEXT_TARGET}
            </span>
          </div>

          <p
            style={{
              fontSize: "0.76rem",
              color: "#6B7280",
              marginBottom: 8,
              lineHeight: 1.6,
            }}
          >
            Type a sentence or just write your thoughts. The
            content does not matter only your typing rhythm is captured.
          </p>

          <textarea
            ref={freeTextRef}
            rows={6}
            style={{
              ...styles.input,
              resize: "vertical",
              lineHeight: 1.6,
              fontSize: "0.88rem",
              marginBottom: 12,
            }}
            placeholder="Type anything here..."
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={handleFreeKeyDown}
            onKeyUp={freeKs.onKeyUp}
            disabled={seedLoading}
            spellCheck={false}
          />

          {seedError && (
            <div style={{ ...styles.alert("error"), marginBottom: 10 }}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 15,
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                warning
              </span>
              {seedError}
            </div>
          )}

          {!freeReady && (
            <div style={{ ...styles.alert("info"), marginBottom: 10 }}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 15,
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                keyboard
              </span>
              {FREE_TEXT_TARGET - freeKeyCount} more keystrokes needed to
              complete setup.
            </div>
          )}

          <button
            style={{ ...styles.btnIndigo, opacity: freeReady ? 1 : 0.5 }}
            onClick={handleSeedSession}
            disabled={!freeReady || seedLoading}
          >
            {seedLoading
              ? "Training session model..."
              : freeReady
                ? "Complete Enrollment →"
                : `Type ${FREE_TEXT_TARGET - freeKeyCount} more keystrokes...`}
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.72rem",
              color: "#9CA3AF",
              marginTop: 10,
            }}
          >
            Your login model is already saved. This step trains the continuous
            session model.
          </p>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 4 && user && (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: "#D1FAE5",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 36, color: "#059669" }}
              >
                verified
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Enrollment Complete
            </h2>
            <p
              style={{ fontSize: "0.82rem", color: "#6B7280", marginBottom: 4 }}
            >
              Account is created in ContinuAuth
            </p>
            <p
              style={{
                fontSize: "0.78rem",
                color: "#6B7280",
                marginBottom: 24,
              }}
            >
              Logged in as <strong>{user.username}</strong>
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              {[
                {
                  icon: "verified_user",
                  text: "Your login model is ready, your phrase can now be used to verify you",
                },
                {
                  icon: "model_training",
                  text: "Your session model is set up, so continuous authentication starts right away.",
                },
              ].map(({ icon, text }) => (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0.5rem 0.75rem",
                    background: "#F0FDF4",
                    borderRadius: 8,
                    border: "1px solid #BBF7D0",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: "#059669", flexShrink: 0 }}
                  >
                    {icon}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#166534" }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* <div
              style={{
                ...styles.alert("info"),
                textAlign: "left",
                marginBottom: 20,
              }}
            >
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
              At login time, type the phrase to verify identity and during sessions,
              ContinuAuth checks every 100 keystrokes a different typing
              rhythm triggers an anomaly alert.
            </div> */}

            <button
              style={styles.btnIndigo}
              onClick={() => navigate("/session")}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 16,
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                login
              </span>
              Proceed to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}