#!/usr/bin/env node

const { getPort, getPortStatus } = require("./port-guard");

function printBusyPortError(port, details) {
  console.error("");
  console.error(`[dev preflight] Port ${port} is already in use.`);
  console.error(
    "A running Next.js process on the same port can leave server chunks and /_next assets out of sync with the current code."
  );
  console.error(
    "Stop the existing process or reuse it, then retry `npm run dev`."
  );
  console.error(
    "If you recently ran `npm run build`, switched branches, or edited routes, layouts, or global CSS, restart with `npm run dev:clean`."
  );

  if (details.length > 0) {
    console.error(`[dev preflight] Listening PID(s): ${details.join(", ")}`);
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

  if (portCheck.status === "free") {
    process.exit(0);
  }

  console.error("");
  console.error(
    `[dev preflight] Failed to verify port ${port}: ${portCheck.reason || "unknown error"}`
  );
  console.error("");
  process.exit(1);
}

void main();
