const sessionToken = localStorage.getItem("sessionToken");
const user = JSON.parse(localStorage.getItem("user") || "null");

const welcome = document.getElementById("welcome");
const userSubtitle = document.getElementById("userSubtitle");
const summary = document.getElementById("summary");
const reportsContainer = document.getElementById("reports");
const reportsSection = document.getElementById("reportsSection");
const adminSection = document.getElementById("adminSection");
const usersTable = document.getElementById("usersTable");
const reportsTable = document.getElementById("reportsTable");
const pendingInvites = document.getElementById("pendingInvites");
const pendingInvitesResult = document.getElementById("pendingInvitesResult");
const logoutBtn = document.getElementById("logoutBtn");
const changePasswordForm = document.getElementById("changePasswordForm");
const createUserForm = document.getElementById("createUserForm");
const assignReportsForm = document.getElementById("assignReportsForm");
const reportForm = document.getElementById("reportForm");
const smtpSettingsForm = document.getElementById("smtpSettingsForm");
const changePasswordResult = document.getElementById("changePasswordResult");
const createUserResult = document.getElementById("createUserResult");
const assignResult = document.getElementById("assignResult");
const smtpSettingsResult = document.getElementById("smtpSettingsResult");
const selectedUser = document.getElementById("selectedUser");
const selectedUserEmail = document.getElementById("selectedUserEmail");
const selectedUserActive = document.getElementById("selectedUserActive");
const selectedUserAdmin = document.getElementById("selectedUserAdmin");
const resendInviteBtn = document.getElementById("resendInviteBtn");
const reportId = document.getElementById("reportId");
const reportTitle = document.getElementById("reportTitle");
const reportUrl = document.getElementById("reportUrl");
const reportActive = document.getElementById("reportActive");
const clearReportFormBtn = document.getElementById("clearReportFormBtn");
const newUserReports = document.getElementById("newUserReports");
const assignReportList = document.getElementById("assignReportList");
const smtpPasswordStatus = document.getElementById("smtpPasswordStatus");
let dashboardState = { users: [], reports: [], pendingInvites: [], smtpSettings: {} };
let currentUser = user;
let editingReportId = null;
let assignedReports = [];
let activeReportId = null;

function setBoxMessage(element, text, type = "success") {
  element.className = `invite-box ${type === "success" ? "" : "error"}`.trim();
  element.innerText = text;
  element.classList.remove("hidden");
}

function formatDate(value) {
  if (!value) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRole(role) {
  return role === "admin" ? "Administrador" : "Usuario";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportCheckboxHtml(reports, name, selectedIds = []) {
  return reports
    .map(
      (report) => `
        <label class="checkbox-item">
          <input type="checkbox" name="${name}" value="${escapeHtml(report.id)}" ${selectedIds.includes(report.id) ? "checked" : ""} />
          <span>${escapeHtml(report.title)} <span class="muted">(${escapeHtml(report.id)})</span></span>
        </label>`
    )
    .join("");
}

function selectedCheckboxValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function toggleFieldVisibility(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  button.setAttribute("aria-label", isHidden ? "Ocultar contraseña" : "Mostrar contraseña");
  button.innerText = isHidden ? "Ocultar" : "Mostrar";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-session-token": sessionToken,
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la operación");
  }

  return payload;
}

function renderSummary(userData) {
  summary.innerHTML = `
    <div class="metric-card metric-wide">
      <span class="metric-label">Último acceso</span>
      <strong>${escapeHtml(formatDate(userData.lastLoginAt))}</strong>
      <small>Fecha y hora del último ingreso</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Últimos 7 días</span>
      <strong>${escapeHtml(userData.logins7d)}</strong>
      <small>Accesos recientes</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Últimos 30 días</span>
      <strong>${escapeHtml(userData.logins30d)}</strong>
      <small>Accesos mensuales</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Accesos totales</span>
      <strong>${escapeHtml(userData.totalLogins)}</strong>
      <small>Historial completo</small>
    </div>
    <div class="metric-card">
      <span class="metric-label">Rol</span>
      <strong class="metric-role">${escapeHtml(formatRole(userData.role))}</strong>
      <small>Perfil de autorización</small>
    </div>
  `;
}

function renderReports(reports) {
  assignedReports = reports;
  if (!reports.length) {
    reportsContainer.innerHTML = `
      <div class="empty-state">
        <span>▥</span>
        <h3>No hay reportes asignados</h3>
        <p>Contacta al administrador para solicitar acceso a un reporte.</p>
      </div>`;
    return;
  }

  if (!activeReportId || !reports.some((report) => report.id === activeReportId)) {
    activeReportId = reports[0].id;
  }

  const activeReport = reports.find((report) => report.id === activeReportId);
  reportsContainer.innerHTML = `
    <div class="report-workspace">
      <aside class="report-sidebar">
        <span class="report-sidebar-label">Reportes disponibles</span>
        ${reports.map((report) => `
          <button
            type="button"
            class="report-nav-item ${report.id === activeReportId ? "active" : ""}"
            data-action="open-report"
            data-report="${escapeHtml(report.id)}"
          >
            <span class="report-nav-icon">▥</span>
            <span>
              <strong>${escapeHtml(report.title)}</strong>
              <small>${escapeHtml(report.id)}</small>
            </span>
          </button>`).join("")}
      </aside>
      <div class="report-view">
        <div class="report-view-header">
          <div>
            <span class="eyebrow">Reporte activo</span>
            <h3>${escapeHtml(activeReport.title)}</h3>
          </div>
          <a class="report-external-link" href="${escapeHtml(activeReport.url)}" target="_blank" rel="noopener noreferrer">Abrir en una nueva pestaña</a>
        </div>
        <iframe class="report-frame" src="${escapeHtml(activeReport.url)}" title="${escapeHtml(activeReport.title)}" allowfullscreen></iframe>
      </div>
    </div>`;
}

function activateAdminTab(tabName) {
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== tabName);
  });
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function renderAdminForms(reports, users) {
  newUserReports.innerHTML = reportCheckboxHtml(reports, "newUserReportIds");
  assignReportList.innerHTML = reportCheckboxHtml(reports, "assignReportIds");

  selectedUser.innerHTML = users
    .map((entry) => `<option value="${escapeHtml(entry.username)}">${escapeHtml(entry.username)} (${escapeHtml(formatRole(entry.role))})</option>`)
    .join("");

  refreshSelectedUserPanel();
}

function renderUsersTable(users) {
  usersTable.innerHTML = users
    .map((entry) => {
      const status = entry.active ? '<span class="status-pill ok">activo</span>' : '<span class="status-pill warn">inactivo</span>';
      const reportCount = Array.isArray(entry.reportIds) ? entry.reportIds.length : 0;
      const isCurrentUser = currentUser && entry.username === currentUser.username;
      const selfAction = isCurrentUser
        ? '<button type="button" class="secondary" data-action="focus-password">Contraseña</button>'
        : `<button type="button" class="danger" data-action="delete-user" data-user="${escapeHtml(entry.username)}">Eliminar</button>`;

      return `
        <tr>
          <td>${escapeHtml(entry.username)}</td>
          <td>${escapeHtml(formatRole(entry.role))}</td>
          <td>${escapeHtml(formatDate(entry.lastLoginAt))}</td>
          <td>${escapeHtml(entry.logins7d)}</td>
          <td>${escapeHtml(entry.logins30d)}</td>
          <td>${escapeHtml(entry.totalLogins)}</td>
          <td>${escapeHtml(entry.email || "")}</td>
          <td>${status}</td>
          <td>${reportCount}</td>
          <td>
            <button type="button" class="secondary" data-action="select-user" data-user="${escapeHtml(entry.username)}">Seleccionar</button>
            <button type="button" class="secondary" data-action="invite-user" data-user="${escapeHtml(entry.username)}">Token</button>
            ${selfAction}
          </td>
        </tr>`;
    })
    .join("");
}

function renderReportsTable(reports) {
  reportsTable.innerHTML = reports
    .map(
      (report) => `
        <tr>
          <td>${escapeHtml(report.id)}</td>
          <td>${escapeHtml(report.title)}</td>
          <td>${report.active === false ? '<span class="status-pill warn">inactivo</span>' : '<span class="status-pill ok">activo</span>'}</td>
          <td>
            <button type="button" class="secondary" data-action="edit-report" data-report="${escapeHtml(report.id)}">Modificar</button>
            <button type="button" class="danger" data-action="delete-report" data-report="${escapeHtml(report.id)}">Eliminar</button>
          </td>
        </tr>`
    )
    .join("");
}

function renderPendingInvites(invites) {
  if (!invites.length) {
    pendingInvites.innerHTML = "No hay invitaciones pendientes.";
    return;
  }

  pendingInvites.innerHTML = invites
    .map(
      (invite) => `
        <article class="invite-item">
          <div class="invite-item-header">
            <div>
              <strong>${escapeHtml(invite.username)}</strong>
              <span>${escapeHtml(invite.email || "Se debe agregar un email al perfil")}</span>
            </div>
            <span class="status-pill warn">Pendiente</span>
          </div>
          <div class="invite-meta">
            <span><strong>Vencimiento</strong>${escapeHtml(formatDate(invite.expiresAt))}</span>
            <span><strong>Último envío</strong>${escapeHtml(formatDate(invite.lastSentAt))}</span>
          </div>
          <div class="invite-link">${escapeHtml(`${window.location.origin}/login.html?invite=${invite.token}`)}</div>
          <button
            type="button"
            class="secondary"
            data-action="send-pending-invite"
            data-token="${escapeHtml(invite.token)}"
            ${invite.email ? "" : 'disabled title="Primero guarda un email en el perfil del usuario"'}
          >Enviar token por email</button>
        </article>`
    )
    .join("");
}

function renderSmtpSettings(settings = {}) {
  document.getElementById("smtpHost").value = settings.host || "";
  document.getElementById("smtpPort").value = settings.port || 465;
  document.getElementById("smtpUser").value = settings.user || "";
  document.getElementById("smtpPassword").value = "";
  document.getElementById("smtpFromName").value = settings.fromName || "";
  document.getElementById("smtpFromEmail").value = settings.fromEmail || "";
  document.getElementById("smtpPortalUrl").value = settings.portalUrl || "";
  document.getElementById("smtpPortalPath").value = settings.portalPath || "/admin.html";
  document.getElementById("emailSubject").value = settings.emailSubject || "";
  document.getElementById("emailBody").value = settings.emailBody || "";
  document.getElementById("smtpClearPassword").checked = false;
  smtpPasswordStatus.innerText = settings.hasPassword
    ? "Contraseña SMTP configurada."
    : "Contraseña SMTP no configurada.";
}

function refreshSelectedUserPanel() {
  const userName = selectedUser.value;
  const selected = dashboardState.users.find((entry) => entry.username === userName);
  if (!selected) {
    return;
  }

  selectedUserActive.checked = selected.active;
  selectedUserAdmin.checked = selected.role === "admin";
  selectedUserEmail.value = selected.email || "";

  [...document.querySelectorAll('input[name="assignReportIds"]')].forEach((input) => {
    input.checked = (selected.reportIds || []).includes(input.value);
  });
}

async function loadDashboard() {
  if (!sessionToken) {
    window.location.href = "login.html";
    return;
  }

  try {
    const me = await requestJson("/api/me");
    currentUser = me.user;
    welcome.innerText = `¡Bienvenido, ${me.user.username}!`;
    userSubtitle.innerText = `Rol: ${formatRole(me.user.role)}`;
    document.querySelector(".user-avatar").innerText = me.user.username.slice(0, 1).toUpperCase();
    renderSummary(me.user);

    if (me.isAdmin) {
      reportsSection.classList.add("hidden");
      adminSection.classList.remove("hidden");
      const adminState = await requestJson("/api/admin/state");
      dashboardState = adminState;
      renderAdminForms(adminState.reports, adminState.users);
      renderUsersTable(adminState.users);
      renderReportsTable(adminState.reports);
      renderPendingInvites(adminState.pendingInvites);
      renderSmtpSettings(adminState.smtpSettings);
    } else {
      reportsSection.classList.remove("hidden");
      adminSection.classList.add("hidden");
      renderReports(me.reports);
    }
  } catch (error) {
    localStorage.clear();
    window.location.href = "login.html";
  }
}

selectedUser.addEventListener("change", refreshSelectedUserPanel);

document.getElementById("toggleCurrentPassword").addEventListener("click", () => {
  toggleFieldVisibility("currentPassword", "toggleCurrentPassword");
});

document.getElementById("toggleNewPassword").addEventListener("click", () => {
  toggleFieldVisibility("newPassword", "toggleNewPassword");
});

document.getElementById("toggleConfirmNewPassword").addEventListener("click", () => {
  toggleFieldVisibility("confirmNewPassword", "toggleConfirmNewPassword");
});

logoutBtn.addEventListener("click", async () => {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignorar errores de cierre de sesión y limpiar igualmente el estado local.
  } finally {
    localStorage.clear();
    window.location.href = "login.html";
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  changePasswordResult.classList.add("hidden");

  try {
    await requestJson("/api/me/password", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword: document.getElementById("currentPassword").value,
        newPassword: document.getElementById("newPassword").value,
        confirmPassword: document.getElementById("confirmNewPassword").value
      })
    });

    changePasswordForm.reset();
    setBoxMessage(changePasswordResult, "Contraseña actualizada.");
  } catch (error) {
    setBoxMessage(changePasswordResult, error.message, "error");
  }
});

createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createUserResult.classList.add("hidden");

  try {
    const payload = {
      username: document.getElementById("newUsername").value,
      email: document.getElementById("newEmail").value,
      role: document.getElementById("newRole").value,
      reportIds: selectedCheckboxValues("newUserReportIds")
    };

    const response = await requestJson("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setBoxMessage(
      createUserResult,
      response.emailSent
        ? `Usuario creado. Email enviado. Invitación: ${response.inviteLink}`
        : `Usuario creado. Invitación: ${response.inviteLink}. Email no enviado: ${response.emailError || "n/d"}`
    );
    createUserForm.reset();
    await loadDashboard();
  } catch (error) {
    setBoxMessage(createUserResult, error.message, "error");
  }
});

assignReportsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  assignResult.classList.add("hidden");

  const username = selectedUser.value;
  if (!username) {
    setBoxMessage(assignResult, "Selecciona un usuario.", "error");
    return;
  }

  try {
    const response = await requestJson(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify({
        email: selectedUserEmail.value,
        role: selectedUserAdmin.checked ? "admin" : "user",
        active: selectedUserActive.checked,
        reportIds: selectedCheckboxValues("assignReportIds")
      })
    });

    setBoxMessage(assignResult, `Usuario actualizado: ${response.user.username}`);
    await loadDashboard();
  } catch (error) {
    setBoxMessage(assignResult, error.message, "error");
  }
});

resendInviteBtn.addEventListener("click", async () => {
  assignResult.classList.add("hidden");

  const username = selectedUser.value;
  if (!username) {
    setBoxMessage(assignResult, "Selecciona un usuario.", "error");
    return;
  }

  try {
    const response = await requestJson(`/api/admin/users/${encodeURIComponent(username)}/resend-invite`, {
      method: "POST"
    });

    setBoxMessage(
      assignResult,
      response.emailSent
        ? `Nueva invitación. Email enviado: ${response.inviteLink}`
        : `Nueva invitación: ${response.inviteLink}. Email no enviado: ${response.emailError || "n/d"}`
    );
  } catch (error) {
    setBoxMessage(assignResult, error.message, "error");
  }
});

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    id: document.getElementById("reportId").value,
    title: reportTitle.value,
    url: reportUrl.value,
    active: reportActive.checked
  };

  try {
    const method = editingReportId ? "PUT" : "POST";
    const endpoint = editingReportId
      ? `/api/admin/reports/${encodeURIComponent(editingReportId)}`
      : "/api/admin/reports";

    await requestJson(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    editingReportId = null;
    reportForm.reset();
    reportActive.checked = true;
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

clearReportFormBtn.addEventListener("click", () => {
  editingReportId = null;
  reportForm.reset();
  reportActive.checked = true;
});

smtpSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  smtpSettingsResult.classList.add("hidden");

  try {
    const response = await requestJson("/api/admin/smtp-settings", {
      method: "PUT",
      body: JSON.stringify({
        host: document.getElementById("smtpHost").value,
        port: document.getElementById("smtpPort").value,
        user: document.getElementById("smtpUser").value,
        password: document.getElementById("smtpPassword").value,
        fromName: document.getElementById("smtpFromName").value,
        fromEmail: document.getElementById("smtpFromEmail").value,
        portalUrl: document.getElementById("smtpPortalUrl").value,
        portalPath: document.getElementById("smtpPortalPath").value,
        emailSubject: document.getElementById("emailSubject").value,
        emailBody: document.getElementById("emailBody").value,
        clearPassword: document.getElementById("smtpClearPassword").checked
      })
    });

    dashboardState.smtpSettings = response.smtpSettings;
    renderSmtpSettings(response.smtpSettings);
    setBoxMessage(smtpSettingsResult, "Configuración SMTP guardada.");
  } catch (error) {
    setBoxMessage(smtpSettingsResult, error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const userName = button.dataset.user;
  const reportIdValue = button.dataset.report;
  const inviteTokenValue = button.dataset.token;
  const tabName = button.dataset.tab;

  try {
    if (action === "admin-tab") {
      activateAdminTab(tabName);
      return;
    }

    if (action === "open-report") {
      activeReportId = reportIdValue;
      renderReports(assignedReports);
      return;
    }

    if (action === "select-user") {
      activateAdminTab("users");
      selectedUser.value = userName;
      refreshSelectedUserPanel();
      return;
    }

    if (action === "invite-user") {
      const response = await requestJson(`/api/admin/users/${encodeURIComponent(userName)}/resend-invite`, {
        method: "POST"
      });
      setBoxMessage(assignResult, `Token regenerado: ${response.inviteLink}`);
      return;
    }

    if (action === "send-pending-invite") {
      const originalText = button.innerText;
      button.disabled = true;
      button.innerText = "Enviando...";
      pendingInvitesResult.classList.add("hidden");

      try {
        const response = await requestJson(`/api/admin/invites/${encodeURIComponent(inviteTokenValue)}/send`, {
          method: "POST"
        });
        setBoxMessage(
          pendingInvitesResult,
          response.emailSent
            ? `Token enviado a ${response.email}.`
            : `Email no enviado: ${response.emailError || "error desconocido"}`,
          response.emailSent ? "success" : "error"
        );
      } finally {
        button.disabled = false;
        button.innerText = originalText;
      }
      return;
    }

    if (action === "delete-user") {
      if (!window.confirm(`¿Eliminar al usuario ${userName}?`)) {
        return;
      }

      await requestJson(`/api/admin/users/${encodeURIComponent(userName)}`, { method: "DELETE" });
      await loadDashboard();
      return;
    }

    if (action === "focus-password") {
      activateAdminTab("security");
      document.getElementById("currentPassword").focus();
      changePasswordForm.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (action === "edit-report") {
      activateAdminTab("reports");
      const report = dashboardState.reports.find((entry) => entry.id === reportIdValue);
      if (!report) {
        return;
      }

      editingReportId = report.id;
      reportId.value = report.id;
      reportTitle.value = report.title;
      reportUrl.value = report.url;
      reportActive.checked = report.active !== false;
      reportForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "delete-report") {
      if (!window.confirm(`¿Eliminar el reporte ${reportIdValue}?`)) {
        return;
      }

      await requestJson(`/api/admin/reports/${encodeURIComponent(reportIdValue)}`, {
        method: "DELETE"
      });
      await loadDashboard();
    }
  } catch (error) {
    if (action === "send-pending-invite") {
      setBoxMessage(pendingInvitesResult, error.message, "error");
    } else {
      alert(error.message);
    }
  }
});

loadDashboard();
