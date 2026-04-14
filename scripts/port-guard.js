const { spawnSync } = require("node:child_process");
const net = require("node:net");

function getPort() {
  return Number.parseInt(process.env.PORT || "3001", 10);
}

function checkPortWithLsof(port) {
  const result = spawnSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
    { encoding: "utf8" }
  );

  if (result.error) {
    return { status: "unknown", details: [], reason: result.error.message };
  }

  const pids = result.stdout
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (result.status === 0) {
    return { status: "busy", details: pids };
  }

  if (result.status === 1 && pids.length === 0) {
    return { status: "free", details: [] };
  }

  return {
    status: "unknown",
    details: pids,
    reason: result.stderr.trim() || `lsof exited with code ${result.status}`,
  };
}

function checkPortWithSocket(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.unref();

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve({ status: "busy", details: [] });
        return;
      }

      resolve({ status: "unknown", details: [], reason: error.message });
    });

    server.listen(port, () => {
      server.close(() => {
        resolve({ status: "free", details: [] });
      });
    });
  });
}

async function getPortStatus(port = getPort()) {
  const lsofCheck = checkPortWithLsof(port);

  if (lsofCheck.status !== "unknown") {
    return lsofCheck;
  }

  return checkPortWithSocket(port);
}

module.exports = {
  getPort,
  getPortStatus,
};
