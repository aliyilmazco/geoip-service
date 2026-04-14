#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const { getPort, getPortStatus } = require("./port-guard");

const nextDirs = [".next", ".next-dev"].map((dir) =>
  path.join(process.cwd(), dir)
);

function printBusyPortError(port, details) {
  console.error("");
  console.error(
    `[dev:clean] Refusing to remove .next or .next-dev while port ${port} is in use.`
  );
  console.error(
    "Cleaning build output under an active Next.js process can produce stale chunk references and MODULE_NOT_FOUND errors."
  );
  console.error(
    "Stop the running server first, then rerun `npm run dev:clean`."
  );

  if (details.length > 0) {
    console.error(`[dev:clean] Listening PID(s): ${details.join(", ")}`);
  }

  console.error(
    `Inspect the port owner with: lsof -nP -iTCP:${port} -sTCP:LISTEN`
  );
  console.error("");
  process.exit(1);
}

async function main() {
  const port = getPort();
  const portCheck = await getPortStatus(port);

  if (portCheck.status === "busy") {
    printBusyPortError(port, portCheck.details);
    return;
  }

  if (portCheck.status === "unknown") {
    console.error(
      `[dev:clean] Failed to verify port ${port}: ${portCheck.reason || "unknown error"}`
    );
    process.exit(1);
  }

  for (const nextDir of nextDirs) {
    try {
      fs.rmSync(nextDir, { force: true, recursive: true });
      console.log(`[dev:clean] Removed ${nextDir}`);
    } catch (error) {
      console.error(`[dev:clean] Failed to remove ${nextDir}: ${error.message}`);
      process.exit(1);
    }
  }
}

void main();
