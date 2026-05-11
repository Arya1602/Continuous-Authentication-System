import { useNavigate } from "react-router-dom";
import { HeaderHome } from "../components/Header";
import { styles } from "../components/styles";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{ ...styles.page, background: "#fff" }}>
      <HeaderHome />
      <hr style={styles.divider} />

      {/* description */}
      <div
        style={{
          background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
          border: "1px solid #DDD6FE",
          borderRadius: 14,
          padding: "1.2rem 1.4rem",
          marginBottom: "1.5rem",
          marginTop: "1rem",
        }}
      >
        <p
          style={{
            fontSize: "0.88rem",
            color: "#374151",
            lineHeight: 1.8,
            textAlign: "center",
            margin: 0,
          }}
        >
          ContinuAuth learns the unique rhythm of how you type and quietly keeps
          watch the entire time you're logged in.
          <br />
          No extra steps. No tokens. Just you, typing naturally.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Register card */}
        <div style={{ ...styles.card, border: "1.5px solid #E0E7FF" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
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
                style={{ fontSize: 26, color: "#4F46E5" }}
              >
                person_add
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: 6,
              }}
            >
              New User
            </div>
            <p
              style={{ fontSize: "0.75rem", color: "#6B7280", lineHeight: 1.6 }}
            >
              Create your account and enroll your unique typing profile
            </p>
          </div>
          <button style={styles.btnPrimary} onClick={() => navigate("/enroll")}>
            Register
          </button>
        </div>

        {/* Login card */}
        <div style={{ ...styles.card, border: "1.5px solid #EDE9FE" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                background: "#F5F3FF",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 26, color: "#6D28D9" }}
              >
                lock_open
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: 6,
              }}
            >
              Existing User
            </div>
            <p
              style={{ fontSize: "0.75rem", color: "#6B7280", lineHeight: 1.6 }}
            >
              Login with password and keystroke biometric verification
            </p>
          </div>
          <button
            style={{ ...styles.btnPrimary, background: "#4F46E5" }}
            onClick={() => navigate("/session")}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* working */}
      <div style={{ ...styles.card, marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: "#4F46E5" }}
          >
            auto_awesome
          </span>
          <span
            style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1a1a2e" }}
          >
            Here's how it works
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          {[
            {
              icon: "edit",
              label: "Register",
              desc: "Type the enrollment phrase 5 times to build your typing profile.",
            },
            {
              icon: "verified_user",
              label: "Login check",
              desc: "Keystroke dynamics verified against your OC-SVM login model.",
            },
            {
              icon: "monitoring",
              label: "Live monitoring",
              desc: "Every 50 keystrokes, LOF model re-verifies your identity silently.",
            },
            {
              icon: "security",
              label: "Auto-lockout",
              desc: "One warning on anomaly and repeated failure locks the session.",
            },
          ].map(({ icon, label, desc }) => (
            <div
              key={label}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                background: "#F8F9FC",
                borderRadius: 10,
                padding: "0.75rem",
                border: "1px solid #E8ECF4",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: "#EEF2FF",
                  borderRadius: 9,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 17, color: "#4F46E5" }}
                >
                  {icon}
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#1a1a2e",
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: "0.74rem",
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
      </div>
    </div>
  );
}