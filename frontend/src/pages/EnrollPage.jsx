import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderHome } from "../components/Header";
import { styles } from "../components/styles";
import { useKeystroke } from "../hooks/useKeystroke";
import { api } from "../api/client";

const REQUIRED = 8;
const STEPS = [
  "Create your account",
  "Read the guide",
  "Enroll your typing pattern",
  "Registration complete",
];

export default function EnrollPage() {
  const navigate = useNavigate();
  const ks = useKeystroke();
  const inputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [phrase, setPhrase] = useState("");
  const [user, setUser] = useState(null);

  // Registration form held in state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // collectedAttempts: array of raw events arrays, one per attempt
  // Nothing is sent to backend until all REQUIRED attempts are collected
  const [collectedAttempts, setCollectedAttempts] = useState([]);
  const [typed, setTyped] = useState("");
  const [attemptOk, setAttemptOk] = useState(null); // null | 'ok' | 'err'

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saved = collectedAttempts.length;

  // Step 0: Validate form + fetch phrase, nothing saved to database yet

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
      // Only fetch the enrollment phrase and user is not created in Supabase yet
      const { phrase: p } = await api.getPhrase();
      setPhrase(p);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Collect attempts locally

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

    // All attempts collected, now saving everything to Supabase
    if (newAttempts.length >= REQUIRED) {
      setLoading(true);
      try {
        // 1. Create user in Supabase
        const u = await api.register(
          username.trim().toLowerCase(),
          email.trim().toLowerCase(),
          password,
        );
        setUser(u);

        // 2. Save all collected attempts sequentially
        for (const evts of newAttempts) {
          await api.saveAttempt(u.user_id, evts);
        }

        // 3. Train OC-SVM login model
        await api.trainModel(u.user_id);

        setStep(3);
      } catch (e) {
        setError(e.message);
        // Roll back so user can retry from the enroll step
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
                  fontSize: "0.65rem",
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
                  margin: "0 6px",
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

      {/* Step 0: Registration form */}
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
                  color: password === confirmPassword ? "#059669" : "#DC2626",
                  pointerEvents: "none",
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

      {/* Step 1: Guide */}
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
                title: "Type a fixed phrase 5 times",
                desc: "You will be asked to type the same sentence multiple times. This helps the system understand your natural typing rhythm.",
              },
              {
                icon: "speed",
                title: "Type naturally",
                desc: "There is no need to rush or slow down. Just type the way you usually do.",
              },
              {
                icon: "check_circle",
                title: "Make sure the phrase is exact",
                desc: "Each attempt is checked against the original sentence. If there is any mismatch, it would not be counted, so simply try again.",
              },
              {
                icon: "model_training",
                title: "Model trains automatically",
                desc: "Once you complete 5 correct attempts, the system automatically builds your typing pattern model and saves your account.",
              },
              {
                icon: "policy",
                title: "What Happens During Login",
                desc: "Every time you log in, you will type the same phrase again. Your typing pattern is instantly compared with your saved profile to verify your identity in real time.",
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

      {/* Step 2: Collect attempts */}
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
                Enrollment
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

          {/* Progress bar */}
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

          {/* Phrase */}
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
              Attempt {saved} recorded, {REQUIRED - saved} more to go.
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
              All {REQUIRED} attempts collected. Saving your profile now...
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
              Phrase did not match. Please type it exactly as shown.
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
              Creating your account and training your model. Please Wait...
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

          {/* Attempt dots */}
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
            {saved === 0 && "nothing saved to server yet"}
          </p>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && user && (
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
              style={{ fontSize: "0.82rem", color: "#6B7280", marginBottom: 6 }}
            >
              Your account and typing profile have been saved successfully.
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

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[{ text: "Account created in ContinuAuth" }].map(({ text }) => (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: "#059669" }}
                  >
                    check
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#374151" }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            <hr style={{ ...styles.divider, margin: "1.2rem 0" }} />

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
