import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backendDir = __dirname;
export const dataDir = path.join(__dirname, "data");
export const publicDir = path.join(__dirname, "..", "frontend");

export const dataFiles = {
  users: path.join(dataDir, "users.json"),
  reports: path.join(dataDir, "reports.json"),
  invites: path.join(dataDir, "invites.json"),
  sessions: path.join(dataDir, "sessions.json"),
  accessLog: path.join(dataDir, "access-log.json"),
  auditLog: path.join(dataDir, "audit-log.json")
};

function ensureDir(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function ensureStorage() {
  ensureDir(dataDir);
  ensureDir(publicDir);
}

export function readJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    if (!content.trim()) {
      return fallbackValue;
    }

    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function loadState() {
  return {
    users: readJson(dataFiles.users, []),
    reports: readJson(dataFiles.reports, []),
    invites: readJson(dataFiles.invites, []),
    sessions: readJson(dataFiles.sessions, []),
    accessLog: readJson(dataFiles.accessLog, []),
    auditLog: readJson(dataFiles.auditLog, [])
  };
}

export function saveState(state) {
  writeJson(dataFiles.users, state.users);
  writeJson(dataFiles.reports, state.reports);
  writeJson(dataFiles.invites, state.invites);
  writeJson(dataFiles.sessions, state.sessions);
  writeJson(dataFiles.accessLog, state.accessLog);
  writeJson(dataFiles.auditLog, state.auditLog);
}
