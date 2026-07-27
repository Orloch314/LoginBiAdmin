import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backendDir = __dirname;
export const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, "data"));
export const publicDir = path.join(__dirname, "..", "frontend");
const stateLockFile = path.join(dataDir, ".state.lock");
const lockTimeoutMs = Number(process.env.STORAGE_LOCK_TIMEOUT_MS ?? 10000);
const staleLockMs = Number(process.env.STORAGE_STALE_LOCK_MS ?? 30000);
const lockRetryMs = 50;

export const dataFiles = {
  users: path.join(dataDir, "users.json"),
  reports: path.join(dataDir, "reports.json"),
  invites: path.join(dataDir, "invites.json"),
  sessions: path.join(dataDir, "sessions.json"),
  accessLog: path.join(dataDir, "access-log.json"),
  auditLog: path.join(dataDir, "audit-log.json"),
  smtpSettings: path.join(dataDir, "smtp-settings.json")
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
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  const parseFile = (sourcePath) => {
    const content = fs.readFileSync(sourcePath, "utf8");
    if (!content.trim()) {
      throw new Error(`Archivo JSON vacío: ${sourcePath}`);
    }
    return JSON.parse(content);
  };

  try {
    return parseFile(filePath);
  } catch (error) {
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
      throw new Error(`No se pudo leer ${filePath}: ${error.message}`);
    }

    try {
      const backupValue = parseFile(backupPath);
      writeJson(filePath, backupValue, { createBackup: false });
      console.warn(`Se restauró ${filePath} desde la copia de seguridad ${backupPath}`);
      return backupValue;
    } catch (backupError) {
      throw new Error(`No se pudieron leer ${filePath} ni la copia de seguridad: ${backupError.message}`);
    }
  }
}

export function writeJson(filePath, value, { createBackup = true } = {}) {
  ensureDir(path.dirname(filePath));

  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const suffix = `${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
  const temporaryPath = `${filePath}.${suffix}.tmp`;
  const backupPath = `${filePath}.bak`;
  const temporaryBackupPath = `${backupPath}.${suffix}.tmp`;

  try {
    const descriptor = fs.openSync(temporaryPath, "wx");
    try {
      fs.writeFileSync(descriptor, serialized, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }

    if (createBackup && fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, temporaryBackupPath);
      fs.renameSync(temporaryBackupPath, backupPath);
    }

    fs.renameSync(temporaryPath, filePath);
  } finally {
    for (const pendingPath of [temporaryPath, temporaryBackupPath]) {
      try {
        if (fs.existsSync(pendingPath)) {
          fs.unlinkSync(pendingPath);
        }
      } catch {}
    }
  }
}

export function loadState() {
  return {
    users: readJson(dataFiles.users, []),
    reports: readJson(dataFiles.reports, []),
    invites: readJson(dataFiles.invites, []),
    sessions: readJson(dataFiles.sessions, []),
    accessLog: readJson(dataFiles.accessLog, []),
    auditLog: readJson(dataFiles.auditLog, []),
    smtpSettings: readJson(dataFiles.smtpSettings, {})
  };
}

export function saveState(state) {
  writeJson(dataFiles.users, state.users);
  writeJson(dataFiles.reports, state.reports);
  writeJson(dataFiles.invites, state.invites);
  writeJson(dataFiles.sessions, state.sessions);
  writeJson(dataFiles.accessLog, state.accessLog);
  writeJson(dataFiles.auditLog, state.auditLog);
  writeJson(dataFiles.smtpSettings, state.smtpSettings ?? {});
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireStateLock() {
  ensureStorage();
  const startedAt = Date.now();
  const lockId = `${process.pid}:${crypto.randomUUID()}`;

  while (Date.now() - startedAt < lockTimeoutMs) {
    try {
      const handle = await fs.promises.open(stateLockFile, "wx");
      try {
        await handle.writeFile(`${lockId}\n`, "utf8");
      } catch (error) {
        await handle.close();
        try {
          await fs.promises.unlink(stateLockFile);
        } catch {}
        throw error;
      }
      return async () => {
        try {
          await handle.close();
        } finally {
          try {
            const currentLockId = await fs.promises.readFile(stateLockFile, "utf8");
            if (currentLockId.trim() === lockId) {
              await fs.promises.unlink(stateLockFile);
            }
          } catch (error) {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }

      try {
        const lockStats = await fs.promises.stat(stateLockFile);
        if (Date.now() - lockStats.mtimeMs > staleLockMs) {
          await fs.promises.unlink(stateLockFile);
          continue;
        }
      } catch (lockError) {
        if (lockError.code !== "ENOENT") {
          throw lockError;
        }
      }

      await sleep(lockRetryMs);
    }
  }

  throw new Error(`Tiempo de espera agotado al adquirir el bloqueo de almacenamiento después de ${lockTimeoutMs} ms`);
}

function stateSnapshot(state) {
  return {
    users: JSON.stringify(state.users),
    reports: JSON.stringify(state.reports),
    invites: JSON.stringify(state.invites),
    sessions: JSON.stringify(state.sessions),
    accessLog: JSON.stringify(state.accessLog),
    auditLog: JSON.stringify(state.auditLog),
    smtpSettings: JSON.stringify(state.smtpSettings ?? {})
  };
}

function saveChangedState(state, previousSnapshot) {
  const nextSnapshot = stateSnapshot(state);
  for (const [key, filePath] of Object.entries(dataFiles)) {
    if (nextSnapshot[key] !== previousSnapshot[key]) {
      writeJson(filePath, state[key] ?? {});
    }
  }
}

export async function withStateTransaction(mutator) {
  const releaseLock = await acquireStateLock();
  try {
    const state = loadState();
    const previousSnapshot = stateSnapshot(state);
    const result = await mutator(state);
    saveChangedState(state, previousSnapshot);
    return result;
  } finally {
    await releaseLock();
  }
}
