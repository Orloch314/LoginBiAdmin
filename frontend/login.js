const API_ROOT = "";

const loginForm = document.getElementById("loginForm");
const inviteForm = document.getElementById("inviteForm");
const message = document.getElementById("message");
const subtitle = document.getElementById("subtitle");
const params = new URLSearchParams(window.location.search);
const inviteToken = params.get("invite");

function setMessage(text, type = "error") {
  message.className = type === "success" ? "success" : "error";
  message.innerText = text ?? "";
}

function storeSession(data) {
  localStorage.setItem("sessionToken", data.sessionToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("reports", JSON.stringify(data.reports ?? []));
}

function redirectToDashboard() {
  window.location.href = "dashboard.html";
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${API_ROOT}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Operazione non riuscita");
  }

  return payload;
}

if (inviteToken) {
  loginForm.classList.add("hidden");
  inviteForm.classList.remove("hidden");
  subtitle.innerText = "Completa l'attivazione del tuo account con il token ricevuto.";
  document.getElementById("inviteToken").value = inviteToken;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  try {
    const data = await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    });

    storeSession(data);
    redirectToDashboard();
  } catch (error) {
    setMessage(error.message);
  }
});

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  try {
    const data = await requestJson("/api/auth/accept-invite", {
      method: "POST",
      body: JSON.stringify({
        token: document.getElementById("inviteToken").value,
        password: document.getElementById("invitePassword").value,
        confirmPassword: document.getElementById("invitePasswordConfirm").value
      })
    });

    storeSession(data);
    redirectToDashboard();
  } catch (error) {
    setMessage(error.message);
  }
});
