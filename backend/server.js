import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  addDays,
  addHours,
  cleanString,
  hashPassword,
  isExpired,
  normalizeEmail,
  normalizeReportId,
  normalizeUsername,
  nowIso,
  randomToken,
  verifyPassword
} from "./crypto.js";
import { sendInviteEmail } from "./mailer.js";
import { ensureStorage, loadState, saveState, publicDir } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const sessionDurationHours = Number(process.env.SESSION_DURATION_HOURS ?? 8);
const inviteDurationDays = Number(process.env.INVITE_DURATION_DAYS ?? 14);
const bootstrapUsername = cleanString(process.env.BOOTSTRAP_ADMIN_USERNAME ?? "admin");
const bootstrapPassword = cleanString(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "admin123!");
const defaultSmtpPort = 465;
const defaultInvitePortalPath = "/admin.html";

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

ensureStorage();
bootstrapData();

function bootstrapData() {
  const state = loadState();
  const now = nowIso();

  if (!state.reports.length) {
    state.reports.push({
      id: "sudameris",
      title: "Report Sudameris",
      url: "https://app.powerbi.com/view?r=eyJrIjoiNTBkOTk2MTUtYTI3Ni00OTkxLTg1ZmUtOGNlZmU4MzhjNzI1IiwidCI6ImU3MjVkMTUwLWFkZjEtNDExMy1hNTU2LTU2Y2E4MWEyOGY4NCJ9",
      active: true,
      createdAt: now,
      updatedAt: now
    });
  }

  const existingAdmin = state.users.find((user) => normalizeUsername(user.username) === normalizeUsername(bootstrapUsername));
  if (!existingAdmin) {
    state.users.push({
      username: bootstrapUsername,
      passwordHash: hashPassword(bootstrapPassword),
      email: cleanString(process.env.BOOTSTRAP_ADMIN_EMAIL ?? ""),
      role: "admin",
      active: true,
      reportIds: [],
      mustSetPassword: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    });
  } else if (existingAdmin) {
    existingAdmin.role = "admin";
    existingAdmin.active = true;
    existingAdmin.mustSetPassword = false;
    existingAdmin.passwordHash = existingAdmin.passwordHash || hashPassword(bootstrapPassword);
    existingAdmin.email = existingAdmin.email ?? "";
    existingAdmin.reportIds = [];
    existingAdmin.updatedAt = now;
  }

  if (!state.invites) {
    state.invites = [];
  }

  if (!state.sessions) {
    state.sessions = [];
  }

  if (!state.accessLog) {
    state.accessLog = [];
  }

  if (!state.auditLog) {
    state.auditLog = [];
  }

  state.smtpSettings = normalizeSmtpSettings(state.smtpSettings);

  saveState(state);
}

function loadFreshState() {
  return loadState();
}

function saveFreshState(state) {
  saveState(state);
}

function cleanExpiredState(state) {
  const now = Date.now();
  state.invites = state.invites.filter((invite) => !invite.usedAt && new Date(invite.expiresAt).getTime() > now);
  state.sessions = state.sessions.filter((session) => !session.revokedAt && new Date(session.expiresAt).getTime() > now);
}

function logAudit(state, actor, action, subject, details = {}) {
  state.auditLog.push({
    at: nowIso(),
    actor,
    action,
    subject,
    details
  });
}

function getUserStats(username, accessLog, now = new Date()) {
  const normalizedUsername = normalizeUsername(username);
  const events = accessLog
    .filter((entry) => normalizeUsername(entry.username) === normalizedUsername && entry.type === "login")
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());

  const lastLoginAt = events.length ? events[events.length - 1].at : null;
  const last7Threshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const last30Threshold = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  return {
    lastLoginAt,
    logins7d: events.filter((entry) => new Date(entry.at).getTime() >= last7Threshold).length,
    logins30d: events.filter((entry) => new Date(entry.at).getTime() >= last30Threshold).length
  };
}

function findUser(state, username) {
  const normalizedUsername = normalizeUsername(username);
  return state.users.find((user) => normalizeUsername(user.username) === normalizedUsername);
}

function findReport(state, reportId) {
  const normalizedReportId = normalizeReportId(reportId);
  return state.reports.find((report) => report.id === normalizedReportId);
}

function normalizeSmtpSettings(settings = {}) {
  return {
    host: cleanString(settings.host),
    port: Number(settings.port || defaultSmtpPort),
    user: cleanString(settings.user),
    password: String(settings.password ?? ""),
    fromName: cleanString(settings.fromName),
    fromEmail: normalizeEmail(settings.fromEmail),
    portalUrl: cleanString(settings.portalUrl),
    portalPath: cleanString(settings.portalPath || defaultInvitePortalPath)
  };
}

function publicSmtpSettings(settings = {}) {
  const normalized = normalizeSmtpSettings(settings);
  return {
    host: normalized.host,
    port: normalized.port,
    user: normalized.user,
    fromName: normalized.fromName,
    fromEmail: normalized.fromEmail,
    portalUrl: normalized.portalUrl,
    portalPath: normalized.portalPath,
    hasPassword: Boolean(normalized.password)
  };
}

function validateSmtpSettings(payload, currentSettings = {}) {
  const current = normalizeSmtpSettings(currentSettings);
  const next = {
    host: cleanString(payload.host),
    port: Number(payload.port || defaultSmtpPort),
    user: cleanString(payload.user),
    password: payload.clearPassword === true ? "" : current.password,
    fromName: cleanString(payload.fromName),
    fromEmail: normalizeEmail(payload.fromEmail),
    portalUrl: cleanString(payload.portalUrl),
    portalPath: cleanString(payload.portalPath || defaultInvitePortalPath)
  };

  if (payload.password) {
    next.password = String(payload.password);
  }

  if (!next.host) {
    return { error: "Host SMTP obbligatorio" };
  }

  if (!Number.isInteger(next.port) || next.port < 1 || next.port > 65535) {
    return { error: "Porta SMTP non valida" };
  }

  if (!next.user) {
    return { error: "Utente SMTP obbligatorio" };
  }

  if (!next.password) {
    return { error: "Password SMTP obbligatoria" };
  }

  if (!next.fromName) {
    return { error: "Nome mittente obbligatorio" };
  }

  if (!next.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.fromEmail)) {
    return { error: "Email mittente non valida" };
  }

  if (!next.portalUrl) {
    return { error: "URL portale obbligatorio" };
  }

  try {
    new URL(next.portalUrl);
  } catch {
    return { error: "URL portale non valido" };
  }

  next.portalPath = next.portalPath.startsWith("/") ? next.portalPath : `/${next.portalPath}`;

  return { settings: next };
}

function getSmtpReadyError(settings = {}) {
  const validation = validateSmtpSettings({ ...settings, password: settings.password }, settings);
  return validation.error ?? null;
}

function buildInviteLink(state, token) {
  const settings = normalizeSmtpSettings(state.smtpSettings);
  const base = settings.portalUrl.replace(/\/+$/, "");
  const portalPath = settings.portalPath.startsWith("/") ? settings.portalPath : `/${settings.portalPath}`;
  return `${base}${portalPath}?invite=${encodeURIComponent(token)}`;
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { error: "Email obbligatoria" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { error: "Email non valida" };
  }

  return { email: normalized };
}

function resolveReports(state, reportIds) {
  const uniqueIds = [...new Set((Array.isArray(reportIds) ? reportIds : []).map((reportId) => normalizeReportId(reportId)).filter(Boolean))];
  return uniqueIds
    .map((reportId) => findReport(state, reportId))
    .filter((report) => report && report.active !== false);
}

function getSessionToken(req) {
  const headerToken = req.get("x-session-token");
  if (headerToken) {
    return headerToken.trim();
  }

  const authHeader = req.get("authorization");
  if (!authHeader) {
    return "";
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireSession(req, res, next) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(401).json({ error: "Sessione mancante" });
  }

  const state = loadFreshState();
  cleanExpiredState(state);

  const session = state.sessions.find((entry) => entry.token === sessionToken && !entry.revokedAt);
  if (!session || isExpired(session.expiresAt)) {
    if (session) {
      session.revokedAt = nowIso();
      saveFreshState(state);
    }

    return res.status(401).json({ error: "Sessione scaduta" });
  }

  const user = findUser(state, session.username);
  if (!user || user.active === false) {
    return res.status(401).json({ error: "Utente non disponibile" });
  }

  req.auth = { sessionToken, user, state, session };
  next();
}

function requireAdmin(req, res, next) {
  if (req.auth?.user?.role !== "admin") {
    return res.status(403).json({ error: "Permessi insufficienti" });
  }

  next();
}

function createSession(state, username) {
  const now = new Date();
  const sessionToken = randomToken();
  const expiresAt = addHours(now, sessionDurationHours).toISOString();

  state.sessions.push({
    token: sessionToken,
    username,
    createdAt: nowIso(),
    expiresAt,
    revokedAt: null
  });

  return sessionToken;
}

function registerLogin(state, user, sessionToken) {
  const at = nowIso();
  state.accessLog.push({
    username: user.username,
    at,
    type: "login",
    sessionToken
  });

  user.lastLoginAt = at;
  user.updatedAt = at;
}

function buildSessionPayload(state, user, sessionToken) {
  const reports = user.role === "admin" ? [] : resolveReports(state, user.reportIds);
  const stats = getUserStats(user.username, state.accessLog);

  return {
    sessionToken,
    user: {
      username: user.username,
      role: user.role,
      active: user.active,
      mustSetPassword: Boolean(user.mustSetPassword),
      lastLoginAt: stats.lastLoginAt,
      logins7d: stats.logins7d,
      logins30d: stats.logins30d
    },
    reports
  };
}

function ensureValidUserPayload(state, payload, allowRole = true) {
  const username = cleanString(payload.username);
  if (!username) {
    return { error: "Username obbligatorio" };
  }

  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { error: "Username non valido" };
  }

  if (allowRole) {
    const role = cleanString(payload.role ?? "user").toLowerCase();
    if (!["admin", "user"].includes(role)) {
      return { error: "Ruolo non valido" };
    }
  }

  const reportIds = Array.isArray(payload.reportIds) ? [...new Set(payload.reportIds.map((reportId) => normalizeReportId(reportId)).filter(Boolean))] : [];
  const invalidReportIds = reportIds.filter((reportId) => !findReport(state, reportId));
  if (invalidReportIds.length) {
    return { error: `Report non trovati: ${invalidReportIds.join(", ")}` };
  }

  const emailValidation = payload.email !== undefined ? validateEmail(payload.email) : null;
  if (emailValidation?.error) {
    return { error: emailValidation.error };
  }

  return {
    username,
    normalizedUsername,
    role: allowRole ? cleanString(payload.role ?? "user").toLowerCase() : "user",
    reportIds: allowRole && cleanString(payload.role ?? "user").toLowerCase() === "admin" ? [] : reportIds,
    email: emailValidation?.email ?? normalizeEmail(payload.email)
  };
}

function publicUserList(state) {
  return state.users
    .map((user) => {
      const stats = getUserStats(user.username, state.accessLog);
      return {
        username: user.username,
        role: user.role,
        active: user.active !== false,
        mustSetPassword: Boolean(user.mustSetPassword),
        email: cleanString(user.email ?? ""),
        reportIds: user.role === "admin" ? [] : Array.isArray(user.reportIds) ? user.reportIds : [],
        lastLoginAt: stats.lastLoginAt,
        logins7d: stats.logins7d,
        logins30d: stats.logins30d
      };
    })
    .sort((left, right) => left.username.localeCompare(right.username));
}

function createInviteForUser(state, username, createdBy) {
  const token = randomToken();
  const expiresAt = addDays(new Date(), inviteDurationDays).toISOString();

  state.invites = state.invites.filter((invite) => normalizeUsername(invite.username) !== normalizeUsername(username) || invite.usedAt);
  state.invites.push({
    token,
    username,
    createdAt: nowIso(),
    expiresAt,
    usedAt: null,
    createdBy
  });

  const user = findUser(state, username);
  if (user) {
    user.mustSetPassword = true;
    user.active = false;
    user.updatedAt = nowIso();
  }

  return token;
}

async function sendInviteForUser(state, user, token) {
  if (!user.email) {
    return { sent: false, error: "Email destinatario mancante" };
  }

  const smtpSettings = normalizeSmtpSettings(state.smtpSettings);
  const configError = getSmtpReadyError(smtpSettings);
  if (configError) {
    return { sent: false, error: `Configurazione SMTP incompleta: ${configError}` };
  }

  try {
    await sendInviteEmail({
      smtpHost: smtpSettings.host,
      smtpPort: smtpSettings.port,
      smtpUser: smtpSettings.user,
      smtpPassword: smtpSettings.password,
      fromName: smtpSettings.fromName,
      fromEmail: smtpSettings.fromEmail,
      toEmail: user.email,
      username: user.username,
      inviteLink: buildInviteLink(state, token)
    });
    return { sent: true };
  } catch (error) {
    logAudit(state, "system", "invite-email-failed", user.username, { error: String(error?.message ?? error) });
    saveFreshState(state);
    return { sent: false, error: String(error?.message ?? error) };
  }
}

function consumeInvite(state, token) {
  const invite = state.invites.find((entry) => entry.token === token && !entry.usedAt);
  if (!invite || isExpired(invite.expiresAt)) {
    return null;
  }

  invite.usedAt = nowIso();
  return invite;
}

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.post("/api/auth/login", (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const username = cleanString(req.body.username);
  const password = String(req.body.password ?? "");
  const user = findUser(state, username);

  if (!user || user.active === false || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Credenziali errate" });
  }

  const sessionToken = createSession(state, user.username);
  registerLogin(state, user, sessionToken);
  user.active = true;
  user.mustSetPassword = false;
  logAudit(state, user.username, "login", user.username);
  saveFreshState(state);

  res.json(buildSessionPayload(state, user, sessionToken));
});

app.post("/api/auth/accept-invite", (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const token = cleanString(req.body.token);
  const password = String(req.body.password ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");

  if (!token) {
    return res.status(400).json({ error: "Token obbligatorio" });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "La password deve avere almeno 8 caratteri" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Le password non coincidono" });
  }

  const invite = consumeInvite(state, token);
  if (!invite) {
    return res.status(400).json({ error: "Token non valido o scaduto" });
  }

  const user = findUser(state, invite.username);
  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  user.passwordHash = hashPassword(password);
  user.mustSetPassword = false;
  user.active = true;
  user.updatedAt = nowIso();

  const sessionToken = createSession(state, user.username);
  registerLogin(state, user, sessionToken);
  logAudit(state, user.username, "accept-invite", user.username, { inviteToken: token });
  saveFreshState(state);

  res.json(buildSessionPayload(state, user, sessionToken));
});

app.post("/api/auth/logout", requireSession, (req, res) => {
  const state = loadFreshState();
  const session = state.sessions.find((entry) => entry.token === req.auth.sessionToken);
  if (session) {
    session.revokedAt = nowIso();
  }

  logAudit(state, req.auth.user.username, "logout", req.auth.user.username);
  saveFreshState(state);
  res.json({ message: "Logout eseguito" });
});

app.put("/api/me/password", requireSession, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const user = findUser(state, req.auth.user.username);
  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const currentPassword = String(req.body.currentPassword ?? "");
  const newPassword = String(req.body.newPassword ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");

  if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: "Password attuale non corretta" });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "La nuova password deve avere almeno 8 caratteri" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Le password non coincidono" });
  }

  user.passwordHash = hashPassword(newPassword);
  user.mustSetPassword = false;
  user.updatedAt = nowIso();
  logAudit(state, user.username, "change-password", user.username);
  saveFreshState(state);

  res.json({ message: "Password aggiornata" });
});

app.get("/api/me", requireSession, (req, res) => {
  const state = loadFreshState();
  const user = findUser(state, req.auth.user.username);
  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const stats = getUserStats(user.username, state.accessLog);

  res.json({
    user: {
      username: user.username,
      role: user.role,
      active: user.active !== false,
      mustSetPassword: Boolean(user.mustSetPassword),
      lastLoginAt: stats.lastLoginAt,
      logins7d: stats.logins7d,
      logins30d: stats.logins30d
    },
    reports: user.role === "admin" ? [] : resolveReports(state, user.reportIds),
    allReports: state.reports.filter((report) => report.active !== false),
    isAdmin: user.role === "admin"
  });
});

app.get("/api/admin/state", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);
  const pendingInvites = state.invites
    .filter((invite) => !invite.usedAt)
    .map((invite) => ({
      token: invite.token,
      username: invite.username,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      createdBy: invite.createdBy
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  res.json({
    users: publicUserList(state),
    reports: state.reports.sort((left, right) => left.title.localeCompare(right.title)),
    pendingInvites,
    smtpSettings: publicSmtpSettings(state.smtpSettings)
  });
});

app.put("/api/admin/smtp-settings", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const validation = validateSmtpSettings(req.body, state.smtpSettings);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  state.smtpSettings = validation.settings;
  logAudit(state, req.auth.user.username, "update-smtp-settings", "smtp-settings", {
    host: state.smtpSettings.host,
    port: state.smtpSettings.port,
    user: state.smtpSettings.user,
    fromName: state.smtpSettings.fromName,
    fromEmail: state.smtpSettings.fromEmail,
    portalUrl: state.smtpSettings.portalUrl,
    portalPath: state.smtpSettings.portalPath,
    hasPassword: Boolean(state.smtpSettings.password)
  });
  saveFreshState(state);

  res.json({ smtpSettings: publicSmtpSettings(state.smtpSettings) });
});

app.post("/api/admin/users", requireSession, requireAdmin, async (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const validation = ensureValidUserPayload(state, req.body, true);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  if (!validation.email) {
    return res.status(400).json({ error: "Email obbligatoria" });
  }

  if (state.users.some((user) => normalizeUsername(user.username) === validation.normalizedUsername)) {
    return res.status(400).json({ error: "Utente gia esistente" });
  }

  const now = nowIso();
  const user = {
    username: validation.username,
    passwordHash: null,
    email: validation.email,
    role: validation.role,
    active: false,
    reportIds: validation.reportIds,
    mustSetPassword: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  };

  state.users.push(user);
  const inviteToken = createInviteForUser(state, user.username, req.auth.user.username);
  const inviteLink = buildInviteLink(state, inviteToken);
  logAudit(state, req.auth.user.username, "create-user", user.username, {
    role: user.role,
    reportIds: user.reportIds
  });
  saveFreshState(state);
  const emailStatus = await sendInviteForUser(state, user, inviteToken);

  res.status(201).json({
    user: {
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
      reportIds: user.reportIds,
      mustSetPassword: user.mustSetPassword
    },
    inviteToken,
    inviteLink,
    emailSent: emailStatus.sent,
    emailError: emailStatus.error ?? null
  });
});

app.put("/api/admin/users/:username", requireSession, requireAdmin, async (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const user = findUser(state, req.params.username);
  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const role = cleanString(req.body.role ?? user.role).toLowerCase();
  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Ruolo non valido" });
  }

  if (req.body.email !== undefined) {
    const emailValidation = validateEmail(req.body.email);
    if (emailValidation.error) {
      return res.status(400).json({ error: emailValidation.error });
    }
    user.email = emailValidation.email;
  }

  const reportIds = Array.isArray(req.body.reportIds)
    ? [...new Set(req.body.reportIds.map((reportId) => normalizeReportId(reportId)).filter(Boolean))]
    : user.reportIds;

  const invalidReportIds = reportIds.filter((reportId) => !findReport(state, reportId));
  if (invalidReportIds.length) {
    return res.status(400).json({ error: `Report non trovati: ${invalidReportIds.join(", ")}` });
  }

  if (typeof req.body.active === "boolean") {
    user.active = req.body.active;
  }

  user.role = role;
  user.reportIds = role === "admin" ? [] : reportIds;
  user.updatedAt = nowIso();

  if (req.body.resetInvite === true) {
    const inviteToken = createInviteForUser(state, user.username, req.auth.user.username);
    const inviteLink = buildInviteLink(state, inviteToken);
    logAudit(state, req.auth.user.username, "reset-invite", user.username);
    saveFreshState(state);
    const emailStatus = await sendInviteForUser(state, user, inviteToken);

    return res.json({
      user: {
        username: user.username,
        email: user.email ?? "",
        role: user.role,
        active: user.active,
        reportIds: user.reportIds,
        mustSetPassword: user.mustSetPassword
      },
      inviteToken,
      inviteLink,
      emailSent: emailStatus.sent,
      emailError: emailStatus.error ?? null
    });
  }

  logAudit(state, req.auth.user.username, "update-user", user.username, {
    role: user.role,
    active: user.active,
    reportIds: user.reportIds
  });
  saveFreshState(state);

  res.json({
    user: {
      username: user.username,
      email: user.email ?? "",
      role: user.role,
      active: user.active,
      reportIds: user.reportIds,
      mustSetPassword: user.mustSetPassword
    }
  });
});

app.post("/api/admin/users/:username/resend-invite", requireSession, requireAdmin, async (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const user = findUser(state, req.params.username);
  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const inviteToken = createInviteForUser(state, user.username, req.auth.user.username);
  const inviteLink = buildInviteLink(state, inviteToken);
  logAudit(state, req.auth.user.username, "resend-invite", user.username);
  saveFreshState(state);
  const emailStatus = await sendInviteForUser(state, user, inviteToken);

  res.json({
    inviteToken,
    inviteLink,
    emailSent: emailStatus.sent,
    emailError: emailStatus.error ?? null
  });
});

app.delete("/api/admin/users/:username", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const normalizedUsername = normalizeUsername(req.params.username);
  if (normalizedUsername === normalizeUsername(req.auth.user.username)) {
    return res.status(400).json({ error: "Non puoi eliminare il tuo account. Puoi solo cambiare la password." });
  }

  const index = state.users.findIndex((user) => normalizeUsername(user.username) === normalizedUsername);
  if (index === -1) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  const [removedUser] = state.users.splice(index, 1);
  state.sessions = state.sessions.filter((session) => normalizeUsername(session.username) !== normalizedUsername);
  state.invites = state.invites.filter((invite) => normalizeUsername(invite.username) !== normalizedUsername);
  logAudit(state, req.auth.user.username, "delete-user", removedUser.username);
  saveFreshState(state);

  res.json({ message: "Utente eliminato" });
});

app.post("/api/admin/reports", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const id = normalizeReportId(req.body.id);
  const title = cleanString(req.body.title);
  const url = cleanString(req.body.url);
  const active = req.body.active !== false;

  if (!id) {
    return res.status(400).json({ error: "Codice report obbligatorio" });
  }

  if (!title) {
    return res.status(400).json({ error: "Titolo report obbligatorio" });
  }

  if (!url) {
    return res.status(400).json({ error: "URL report obbligatorio" });
  }

  if (state.reports.some((report) => report.id === id)) {
    return res.status(400).json({ error: "Report gia esistente" });
  }

  const now = nowIso();
  state.reports.push({
    id,
    title,
    url,
    active,
    createdAt: now,
    updatedAt: now
  });

  logAudit(state, req.auth.user.username, "create-report", id, { title, url, active });
  saveFreshState(state);

  res.status(201).json({ report: findReport(state, id) });
});

app.put("/api/admin/reports/:id", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const report = findReport(state, req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report non trovato" });
  }

  const title = cleanString(req.body.title ?? report.title);
  const url = cleanString(req.body.url ?? report.url);

  if (!title || !url) {
    return res.status(400).json({ error: "Titolo e URL sono obbligatori" });
  }

  report.title = title;
  report.url = url;
  if (typeof req.body.active === "boolean") {
    report.active = req.body.active;
  }
  report.updatedAt = nowIso();

  logAudit(state, req.auth.user.username, "update-report", report.id, {
    title: report.title,
    url: report.url,
    active: report.active
  });
  saveFreshState(state);

  res.json({ report });
});

app.delete("/api/admin/reports/:id", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  cleanExpiredState(state);

  const normalizedReportId = normalizeReportId(req.params.id);
  const index = state.reports.findIndex((report) => report.id === normalizedReportId);
  if (index === -1) {
    return res.status(404).json({ error: "Report non trovato" });
  }

  const [removedReport] = state.reports.splice(index, 1);
  state.users.forEach((user) => {
    user.reportIds = (Array.isArray(user.reportIds) ? user.reportIds : []).filter((reportId) => reportId !== removedReport.id);
  });

  logAudit(state, req.auth.user.username, "delete-report", removedReport.id);
  saveFreshState(state);

  res.json({ message: "Report eliminato" });
});

app.get("/api/admin/audit", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  res.json({
    auditLog: state.auditLog.slice().sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
  });
});

app.get("/api/admin/export", requireSession, requireAdmin, (req, res) => {
  const state = loadFreshState();
  res.json({
    users: state.users,
    reports: state.reports,
    invites: state.invites,
    sessions: state.sessions,
    accessLog: state.accessLog,
    auditLog: state.auditLog,
    smtpSettings: publicSmtpSettings(state.smtpSettings)
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint non trovato" });
});

app.listen(3000, () => {
  console.log("Server in ascolto su http://localhost:3000");
});
