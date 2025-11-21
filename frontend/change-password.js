const BASE = "http://localhost:3000";

async function changePassword() {
  const username = localStorage.getItem("username");
  if (!username) { window.location.href = "login.html"; return; }
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const newPassword2 = document.getElementById("newPassword2").value;
  const msg = document.getElementById("msg");
  msg.innerText = "";

  if (!newPassword || newPassword !== newPassword2) {
    msg.innerText = "Le nuove password non coincidono o sono vuote";
    return;
  }

  try {
    const res = await fetch(`${BASE}/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, oldPassword: oldPassword || undefined, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      msg.innerText = data.error || "Errore";
      return;
    }
    // password cambiata, porta alla dashboard corretta
    const isAdmin = localStorage.getItem("isAdmin") === "1";
    msg.innerText = "Password actualizada. Redirección...";
    setTimeout(()=> window.location.href = isAdmin ? "admin.html" : "dashboard.html", 800);
  } catch (e) {
    msg.innerText = "Error de conexion al servidor";
  }
}

document.getElementById("btnChange").addEventListener("click", changePassword);
