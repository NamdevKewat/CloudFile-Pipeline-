import { useEffect, useState } from "react";
import Auth from "./components/Auth";
import Pipeline from "./components/Pipeline";

const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cf_token");
    if (!token) {
      setChecking(false);
      return;
    }

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setUser(data.data.user))
      .catch(() => localStorage.removeItem("cf_token"))
      .finally(() => setChecking(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("cf_token");
    setUser(null);
  };

  if (checking) return <div className="loading">Loading...</div>;
  return user ? <Pipeline user={user} onLogout={logout} /> : <Auth onAuth={setUser} />;
}
