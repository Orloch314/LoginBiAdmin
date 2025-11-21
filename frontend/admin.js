const BASE = "http://localhost:3000";

function ensureAdmin() {
  const username = localStorage.getItem("username");
  const isAdmin = localStorage.getItem("isAdmin") === "1";
  if (!username || !isAdmin) {
    window.location.href = "login.html";
    return null;
  }
  return username;
}

async function fetchUsers() {
  const el = document.getElementById("usersList");
  el.innerText = "Caricamento...";
  try {
    const res = await fetch(`${BASE}/users`);
    const users = await res.json();
    el.innerHTML = users.map(u => `
      <div class="user-row">
        <strong>${u.username}</strong> ${u.isAdmin ? "(admin)" : ""} - reports: ${u.reports.join(", ")}
        <button data-user="${u.username}" class="btnEdit">Edit</button>
        <button data-user="${u.username}" class="btnDel">Delete</button>
      </div>
    `).join("");
    document.querySelectorAll(".btnDel").forEach(b => b.addEventListener("click", onDeleteUser));
    document.querySelectorAll(".btnEdit").forEach(b => b.addEventListener("click", onEditUser));
  } catch (e) {
    el.innerText = "Errore al cargar los usuarios";
  }
}

async function fetchReports() {
  const el = document.getElementById("reportsList");
  el.innerText = "Caricamento...";
  try {
    const res = await fetch(`${BASE}/reports`);
    const data = await res.json();
    el.innerHTML = Object.entries(data).map(([id, r]) => `
      <div class="report-row">
        <strong>${id}</strong> - ${r.title}
        <button data-report="${id}" class="btnDelReport">Delete</button>
      </div>
    `).join("");
    document.querySelectorAll(".btnDelReport").forEach(b => b.addEventListener("click", onDeleteReport));
  } catch (e) {
    el.innerText = "Error al cargar los reportes";
  }
}

async function onDeleteUser(e) {
  const username = e.currentTarget.dataset.user;
  if (!confirm(`Eliminare utente ${username}?`)) return;
  const adminUsername = ensureAdmin();
  try {
    const res = await fetch(`${BASE}/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername })
    });
    const data = await res.json();
    document.getElementById("usersMsg").innerText = data.message || data.error || "";
    await fetchUsers();
  } catch (e) {
    document.getElementById("usersMsg").innerText = "Errore";
  }
}

async function onEditUser(e) {
  const username = e.currentTarget.dataset.user;
  const newReports = prompt("Inserisci reports separati da virgola per l'utente (es: sales,finance):");
  const isAdmin = confirm("Rendere admin questo utente?");
  if (newReports === null) return;
  const reportsArr = newReports.split(",").map(s=>s.trim()).filter(Boolean);
  const adminUsername = ensureAdmin();
  try {
    const res = await fetch(`${BASE}/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername, reports: reportsArr, isAdmin })
    });
    const data = await res.json();
    document.getElementById("usersMsg").innerText = data.message || data.error || "";
    await fetchUsers();
  } catch (e) {
    document.getElementById("usersMsg").innerText = "Errore";
  }
}

async function onDeleteReport(e) {
  const id = e.currentTarget.dataset.report;
  if (!confirm(`Eliminare report ${id}?`)) return;

  const adminUsername = ensureAdmin();
  try {
    const res = await fetch(`${BASE}/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername })
    });

    const data = await res.json();
    document.getElementById("reportsMsg").innerText = data.message || data.error || "";
    await fetchReports();
  } catch (e) {
    document.getElementById("reportsMsg").innerText = "Errore";
  }
}


async function createUser() {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value;
  const reports = (document.getElementById("newReports").value || "").split(",").map(s=>s.trim()).filter(Boolean);
  const isAdmin = document.getElementById("newIsAdmin").checked;
  if (!username) { document.getElementById("usersMsg").innerText = "username richiesto"; return; }
  const adminUsername = ensureAdmin();
  try {
    const res = await fetch(`${BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername, username, password, reports, isAdmin })
    });
    const data = await res.json();
    document.getElementById("usersMsg").innerText = data.message || data.error || "";
    await fetchUsers();
  } catch (e) {
    document.getElementById("usersMsg").innerText = "Errore";
  }
}

async function saveReport() {
  const id = document.getElementById("reportId").value.trim();
  const title = document.getElementById("reportTitle").value.trim();
  const url = document.getElementById("reportUrl").value.trim();
  if (!id || !title || !url) { document.getElementById("reportsMsg").innerText = "id, title e url richiesti"; return; }
  const adminUsername = ensureAdmin();
  try {
    const res = await fetch(`${BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUsername, id, title, url })
    });
    const data = await res.json();
    document.getElementById("reportsMsg").innerText = data.message || data.error || "";
    await fetchReports();
  } catch (e) {
    document.getElementById("reportsMsg").innerText = "Errore";
  }
}

document.getElementById("btnCreateUser").addEventListener("click", createUser);
document.getElementById("btnSaveReport").addEventListener("click", saveReport);
document.getElementById("btnLogout").addEventListener("click", () => { localStorage.clear(); window.location.href = "login.html"; });

document.addEventListener("DOMContentLoaded", () => {
  ensureAdmin();
  fetchUsers();
  fetchReports();
});
