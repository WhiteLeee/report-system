import fs from "node:fs";

const DEFAULT_TCP_HOST = "127.0.0.1";
const DEFAULT_PG_PORT = "5432";
const DEFAULT_SOCKET_HOST = "/tmp";

function readEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

function resolveSocketHost(): string {
  const explicitHost = readEnv("REPORT_SYSTEM_TEST_PGHOST") || readEnv("PGHOST");
  if (explicitHost.startsWith("/")) {
    return explicitHost;
  }

  const port = readEnv("PGPORT") || DEFAULT_PG_PORT;
  const socketPath = `${DEFAULT_SOCKET_HOST}/.s.PGSQL.${port}`;
  return fs.existsSync(socketPath) ? DEFAULT_SOCKET_HOST : "";
}

function buildTcpConnectionString(dbName: string): string {
  const port = readEnv("PGPORT") || DEFAULT_PG_PORT;
  return `postgres://${DEFAULT_TCP_HOST}:${port}/${dbName}`;
}

function buildSocketConnectionString(dbName: string, host: string): string {
  const port = readEnv("PGPORT") || DEFAULT_PG_PORT;
  const encodedHost = encodeURIComponent(host);
  return `postgres:///${dbName}?host=${encodedHost}&port=${port}`;
}

function buildDefaultConnectionString(dbName: string): string {
  const socketHost = resolveSocketHost();
  if (socketHost) {
    return buildSocketConnectionString(dbName, socketHost);
  }
  return buildTcpConnectionString(dbName);
}

export function resolveTestDbUrl(dbName: string): string {
  const explicit = readEnv("REPORT_SYSTEM_TEST_DB_URL");
  if (explicit) {
    return explicit;
  }
  return buildDefaultConnectionString(dbName);
}

export function resolveTestAdminDbUrl(): string {
  const explicit = readEnv("REPORT_SYSTEM_TEST_ADMIN_DB_URL");
  if (explicit) {
    return explicit;
  }
  return buildDefaultConnectionString("postgres");
}

export function shouldManageIsolatedDatabase(): boolean {
  return readEnv("REPORT_SYSTEM_TEST_DB_URL") === "";
}
