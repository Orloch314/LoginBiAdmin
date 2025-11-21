const BASE = "";

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  document.getElementById("error").innerText = "";

  try {
    const res = await fetch(`${BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({ error: "Error" }));
      document.getElementById("error").innerText = err.error || "Credenziales equivocadas";
      return;
    }
    const data = await res.json();
    // salva info locali (non è un token sicuro ma è quello che hai richiesto)
    localStorage.setItem("username", data.username);
    localStorage.setItem("isAdmin", data.isAdmin ? "1" : "0");
    localStorage.setItem("reports", JSON.stringify(data.reports || []));
    if (data.mustChangePassword) {
      // obbliga al cambio password
      window.location.href = "change-password.html";
      return;
    }
    window.location.href = data.isAdmin ? "admin.html" : "dashboard.html";
  } catch (e) {
    document.getElementById("error").innerText = "Error de conexión al servidor";
  }
}

document.getElementById("btnLogin").addEventListener("click", login);
document.addEventListener("keypress", (e)=>{ if (e.key === "Enter") login(); });
