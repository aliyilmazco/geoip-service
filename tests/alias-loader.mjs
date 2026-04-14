import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const rootDir = process.cwd();

function resolveWithExtensions(candidatePath) {
  const candidates = [
    candidatePath,
    `${candidatePath}.ts`,
    `${candidatePath}.tsx`,
    `${candidatePath}.js`,
    `${candidatePath}.mjs`,
    path.join(candidatePath, "index.ts"),
    path.join(candidatePath, "index.tsx"),
    path.join(candidatePath, "index.js"),
  ];

  return candidates.find((entry) => fs.existsSync(entry));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  if (specifier.startsWith("@/")) {
    const absolutePath = resolveWithExtensions(path.join(rootDir, specifier.slice(2)));

    if (absolutePath) {
      return nextResolve(pathToFileURL(absolutePath).href, context);
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier) &&
    context.parentURL
  ) {
    const baseDir = path.dirname(fileURLToPath(context.parentURL));
    const absolutePath = resolveWithExtensions(path.resolve(baseDir, specifier));

    if (absolutePath) {
      return nextResolve(pathToFileURL(absolutePath).href, context);
    }
  }

  return nextResolve(specifier, context);
}
