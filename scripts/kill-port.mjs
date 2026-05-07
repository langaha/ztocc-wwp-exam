import { execSync } from "node:child_process";

const port = Number(process.argv[2] ?? "");
if (!Number.isFinite(port) || port <= 0) process.exit(0);

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
}

function getWindowsProcessName(pid) {
  try {
    const out = sh(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`
    ).trim();
    return out;
  } catch {
    return "";
  }
}

function killPidWindows(pid) {
  execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
}

function mainWindows() {
  let out = "";
  try {
    out = sh("netstat -ano -p tcp");
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    if (!s.toUpperCase().includes("LISTENING")) continue;
    if (!s.includes(`:${port} `) && !s.endsWith(`:${port}`)) continue;
    const parts = s.split(/\s+/);
    const pid = Number(parts[parts.length - 1] ?? "");
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  const blocked = [];
  for (const pid of pids) {
    const name = getWindowsProcessName(pid).toLowerCase();
    if (!name) continue;
    if (name === "node" || name === "nodejs") {
      killPidWindows(pid);
      continue;
    }
    blocked.push({ pid, name });
  }

  if (blocked.length) {
    const details = blocked.map((x) => `${x.name}(${x.pid})`).join(", ");
    process.stderr.write(
      `Port ${port} is used by non-node processes: ${details}. Please stop them or change port.\n`
    );
    process.exit(1);
  }
}

function mainUnix() {
  try {
    const ids = sh(`lsof -ti tcp:${port} -sTCP:LISTEN`).trim();
    if (!ids) return;
    const pids = ids
      .split(/\s+/)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

if (process.platform === "win32") mainWindows();
else mainUnix();

