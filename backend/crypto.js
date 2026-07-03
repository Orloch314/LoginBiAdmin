import crypto from "crypto";

export function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

export function normalizeReportId(reportId) {
  return String(reportId ?? "").trim().toLowerCase();
}

export function cleanString(value) {
  return String(value ?? "").trim();
}

export function randomToken() {
  return crypto.randomUUID();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) {
    return false;
  }

  const [salt, expected] = storedHash.split(":");
  const derived = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(expected, "hex"));
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDays(date, days) {
  const output = new Date(date);
  output.setDate(output.getDate() + days);
  return output;
}

export function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);
}

export function isExpired(isoDate) {
  if (!isoDate) {
    return false;
  }

  return new Date(isoDate).getTime() <= Date.now();
}
