export function HeaderHome() {
  return (
    <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
      <div
        style={{
          width: 60,
          height: 60,
          background: "#EEF2FF",
          borderRadius: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <img
          src="/logo.png"
          style={{ width: 40, height: 40, objectFit: "contain" }}
        />
      </div>
      <h1
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "2rem",
          fontWeight: 700,
          color: "#1a1a2e",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        Continu<span style={{ color: "#4F46E5" }}>Auth</span>
      </h1>
      <p
        style={{
          fontSize: "0.78rem",
          fontWeight: 500,
          color: "#6B7280",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Behavioral Biometric Continuous Authentication System
      </p>
    </div>
  );
}

export function HeaderDashboard({ username }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 0",
        marginBottom: 4,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: "#EEF2FF",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/logo.png"
          style={{ width: 28, height: 28, objectFit: "contain" }}
        />
      </div>
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#1a1a2e",
        }}
      >
        Continu<span style={{ color: "#4F46E5" }}>Auth</span>
      </span>
      {username && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.82rem",
            color: "#6B7280",
            background: "#F3F4F6",
            padding: "4px 10px",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            account_circle
          </span>
          {username}
        </span>
      )}
    </div>
  );
}
