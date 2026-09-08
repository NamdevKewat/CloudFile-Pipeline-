import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      localStorage.setItem("cf_token", data.data.token);
      onAuth(data.data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand"><span>CF</span> CloudFile Pipeline</div>
        <div className="auth-icon"><ShieldCheck size={27} /></div>
        <p className="kicker">SECURE FILE PIPELINE</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Sign in to access your extraction workspace."
            : "Create an account to start processing your files."}
        </p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 characters" minLength="6" required />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="process" disabled={busy}>
            {busy ? <><Loader2 className="spin" size={18} /> Please wait...</> : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="switch">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}
          <button onClick={toggleMode}>{mode === "login" ? "Sign up" : "Sign in"}</button>
        </div>
        <p className="privacy"><ShieldCheck size={13} /> JWT protected - Passwords hashed with bcrypt</p>
      </div>
    </div>
  );
}
