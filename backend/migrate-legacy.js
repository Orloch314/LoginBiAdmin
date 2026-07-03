import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword, normalizeReportId, normalizeUsername, nowIso, randomToken, addDays } from "./crypto.js";
import { ensureStorage, dataFiles, writeJson } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legacyUsersFile = process.env.LEGACY_USERS_FILE ?? "C:/Users/Roberto.Riva/loginbi/backend/users.json";
const legacyReportsFile = process.env.LEGACY_REPORTS_FILE ?? "C:/Users/Roberto.Riva/loginbi/backend/reports.json";
const excludedLegacyAdminUsername = normalizeUsername(process.env.LEGACY_ADMIN_USERNAME ?? "admin");

function readLegacyJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function guessRole(username, index) {
  if (normalizeUsername(username) === "admin") {
    return "admin";
  }

  return index === 0 ? "admin" : "user";
}

ensureStorage();

const legacyUsers = readLegacyJson(legacyUsersFile, []);
const legacyReports = readLegacyJson(legacyReportsFile, {});

const now = nowIso();
const reports = Object.entries(legacyReports).map(([id, report]) => ({
  id: normalizeReportId(id),
  title: String(report?.title ?? id).trim(),
  url: String(report?.url ?? "").trim(),
  active: true,
  createdAt: now,
  updatedAt: now
}));

const reportIdSet = new Set(reports.map((report) => report.id));
const users = [];
const invites = [];

legacyUsers.forEach((legacyUser, index) => {
  const username = String(legacyUser?.username ?? "").trim();
  if (!username) {
    return;
  }

  if (normalizeUsername(username) === excludedLegacyAdminUsername) {
    return;
  }

  const normalizedReports = Array.isArray(legacyUser?.reports)
    ? legacyUser.reports.map((reportId) => normalizeReportId(reportId)).filter((reportId) => reportId && reportIdSet.has(reportId))
    : [];

  const inviteToken = randomToken();
  invites.push({
    token: inviteToken,
    username,
    createdAt: now,
    expiresAt: addDays(new Date(), 14).toISOString(),
    usedAt: null,
    createdBy: "migration"
  });

  users.push({
    username,
    passwordHash: hashPassword(String(legacyUser?.password ?? "ChangeMe123!")),
    email: String(legacyUser?.email ?? "").trim().toLowerCase(),
    role: guessRole(username, index),
    active: true,
    reportIds: normalizedReports,
    mustSetPassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  });
});

writeJson(dataFiles.users, users);
writeJson(dataFiles.reports, reports);
writeJson(dataFiles.invites, invites);
writeJson(dataFiles.sessions, []);
writeJson(dataFiles.accessLog, []);
writeJson(dataFiles.auditLog, []);

console.log(`Migrated ${users.length} users and ${reports.length} reports.`);
console.log("Invites have been generated in backend/data/invites.json.");
