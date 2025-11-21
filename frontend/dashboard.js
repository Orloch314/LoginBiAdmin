const BASE = "http://localhost:3000";

function ensureAuth() {
  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "login.html";
    return null;
  }
  return username;
}

document.addEventListener("DOMContentLoaded", () => {
  const username = ensureAuth();
  if (!username) return;
  document.getElementById("welcome").innerText = `Bienvenido, ${username}`;
  const reports = JSON.parse(localStorage.getItem("reports") || "[]");
  const container = document.getElementById("reportsContainer");

  if (!reports.length) {
    container.innerHTML = "<p>Nessun report assegnato</p>";
    return;
  }

  reports.forEach(r => {
    const box = document.createElement("section");
    box.className = "report-box";
    box.innerHTML = `<h3>${escapeHtml(r.title || "")}</h3>
      <div class="iframe-wrap">
        <iframe src="${r.url}" allowfullscreen frameborder="0"></iframe>
      </div>`;
    container.appendChild(box);
  });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById("btnLogout").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});
