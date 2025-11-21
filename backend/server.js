import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const DATA_DIR = path.resolve("./backend");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const SALT_ROUNDS = 10;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// helper read/write safe
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.error("readJSON error", filePath, e);
    return [];
  }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// --- MIGRAZIONE: se trovi password in chiaro, hashala automaticamente ---
function ensureUsersHashed() {
  let users = readJSON(USERS_FILE);
  let changed = false;

  users = users.map(u => {
    // Se password già hashata → NON toccarla
    if (
      typeof u.password === "string" &&
      (u.password.startsWith("$2a$") || u.password.startsWith("$2b$"))
    ) {
      return u;
    }

    // Altrimenti hashala
    const hashed = bcrypt.hashSync(String(u.password || "changeme"), SALT_ROUNDS);
    changed = true;

    return {
      ...u,
      password: hashed,
      mustChangePassword: typeof u.mustChangePassword === "boolean" ? u.mustChangePassword : true,
      isAdmin: !!u.isAdmin
    };
  });

  if (changed) {
    writeJSON(USERS_FILE, users);
    console.log("✅ Migrazione password: plaintext -> bcrypt (users.json aggiornato).");
  }

  return users;
}

// Load reports (object map)
function loadReports() {
  const r = readJSON(REPORTS_FILE);
  // if file contains object (as in example), return as object; else array -> convert
  return Array.isArray(r) ? r : r;
}

let users = ensureUsersHashed();
let reports = loadReports();

// utility: persist users variable
function persistUsers() {
  writeJSON(USERS_FILE, users);
}

// ------------------ ENDPOINTS ------------------


// Login: verifica username + password (bcrypt); restituisce reports assegnati e mustChangePassword
app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username e password richiesti" });

  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Credenziali errate" });

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return res.status(401).json({ error: "Credenziali errate" });

  // prepare report list
  const userReports = (user.reports || []).map(rid => reports[rid]).filter(Boolean);
  res.json({
    username: user.username,
    isAdmin: !!user.isAdmin,
    mustChangePassword: !!user.mustChangePassword,
    reports: userReports
  });
});

// Change password (must be logged in client-side by username). Enforce mustChangePassword -> false
app.post("/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body || {};
  if (!username || !newPassword) return res.status(400).json({ error: "username e nuova password richiesti" });

  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: "Utente non trovato" });

  // if oldPassword provided, check it; otherwise allow if mustChangePassword true (e.g. first time)
  if (oldPassword) {
    const ok = await bcrypt.compare(String(oldPassword), user.password);
    if (!ok) return res.status(401).json({ error: "Password attuale errata" });
  }

  const hashed = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
  user.password = hashed;
  user.mustChangePassword = false;
  persistUsers();
  res.json({ message: "Password aggiornata" });
});

// ------------------ USERS (admin) ------------------
// NOTE: these endpoints are not heavily secured: the frontend must call them only from admin page.
// We use a simple `adminUsername` check from request body to avoid adding tokens (as requested).
// On production, proteggi con HTTPS, IP restrictions o autenticazione reale.
function requireAdmin(req, res, next) {
  const { adminUsername } = req.body || req.query || {};
  const admin = users.find(u => u.username === adminUsername && u.isAdmin);
  if (!admin) return res.status(403).json({ error: "Accesso admin richiesto (invia adminUsername in body/query)" });
  next();
}

// Restituisce tutti gli utenti (senza password)
app.get("/users", (req, res) => {
  const safe = users.map(u => ({
    username: u.username,
    reports: u.reports || [],
    mustChangePassword: !!u.mustChangePassword,
    isAdmin: !!u.isAdmin
  }));
  res.json(safe);
});

// Crea un nuovo utente (admin-required)
app.post("/users", requireAdmin, async (req, res) => {
  const { username, password = "changeme", reports: userReports = [], isAdmin = false } = req.body || {};
  if (!username) return res.status(400).json({ error: "username richiesto" });
  if (users.find(u => u.username === username)) return res.status(400).json({ error: "Utente già esistente" });

  const hashed = await bcrypt.hash(String(password), SALT_ROUNDS);
  const newUser = { username, password: hashed, reports: userReports, mustChangePassword: true, isAdmin: !!isAdmin };
  users.push(newUser);
  persistUsers();
  res.json({ message: "Utente creato", user: { username: newUser.username, reports: newUser.reports, mustChangePassword: newUser.mustChangePassword, isAdmin: newUser.isAdmin } });
});

// Aggiorna utente (admin)
app.put("/users/:username", requireAdmin, async (req, res) => {
  const target = req.params.username;
  const { password, reports: newReports, mustChangePassword, isAdmin } = req.body || {};
  const user = users.find(u => u.username === target);
  if (!user) return res.status(404).json({ error: "Utente non trovato" });

  if (password) {
    user.password = await bcrypt.hash(String(password), SALT_ROUNDS);
  }
  if (Array.isArray(newReports)) user.reports = newReports;
  if (typeof mustChangePassword === "boolean") user.mustChangePassword = mustChangePassword;
  if (typeof isAdmin === "boolean") user.isAdmin = isAdmin;
  persistUsers();
  res.json({ message: "Utente aggiornato", user: { username: user.username, reports: user.reports, mustChangePassword: user.mustChangePassword, isAdmin: user.isAdmin } });
});

// Cancella utente (admin)
app.delete("/users/:username", requireAdmin, (req, res) => {
  const target = req.params.username;
  const idx = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ error: "Utente non trovato" });
  users.splice(idx, 1);
  persistUsers();
  res.json({ message: "Utente eliminato" });
});

// ------------------ REPORTS (admin) ------------------

// Get reports object (admin or anyone - safe)
app.get("/reports", (req, res) => {
  res.json(reports);
});

// Create/Update report (admin)
app.post("/reports", requireAdmin, (req, res) => {
  const { id, title, url } = req.body || {};
  if (!id || !title || !url) return res.status(400).json({ error: "id, title e url richiesti" });
  reports[id] = { title, url };
  writeJSON(REPORTS_FILE, reports);
  res.json({ message: "Report creato/aggiornato", report: reports[id] });
});

// Delete report (admin)
app.delete("/reports/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!reports[id]) return res.status(404).json({ error: "Report non trovato" });
  delete reports[id];
  writeJSON(REPORTS_FILE, reports);
  res.json({ message: "Report eliminato" });
});

// Serve static files dal frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// fallback per SPA / pagine multiple
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ------------------ Avvio server ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server in ascolto su http://localhost:${PORT}`);
});
