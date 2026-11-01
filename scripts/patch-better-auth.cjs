/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const roots = [
  path.join(__dirname, "..", "node_modules", "better-auth"),
  path.join(
    __dirname,
    "..",
    "node_modules",
    "@neondatabase",
    "auth-ui",
    "node_modules",
    "better-auth",
  ),
  path.join(
    __dirname,
    "..",
    "node_modules",
    "@neondatabase",
    "auth",
    "node_modules",
    "better-auth",
  ),
];

let found = 0;

for (const root of roots) {
  const pluginsIndex = path.join(root, "dist", "client", "plugins", "index.mjs");

  if (!fs.existsSync(pluginsIndex)) {
    continue;
  }

  found += 1;
  let content = fs.readFileSync(pluginsIndex, "utf8");
  if (content.includes("apiKeyClient")) {
    continue;
  }

  content = `const apiKeyClient = () => ({ id: "api-key", $InferServerPlugin: {} });\n${content.replace(/export\s*\{/, "export { apiKeyClient,")}`;
  fs.writeFileSync(pluginsIndex, content);
}

if (found === 0) {
  console.error(
    "patch-better-auth: no better-auth dist/client/plugins/index.mjs found under any known root; the package layout changed. See docs/runbooks/auth-upgrade.md.",
  );
  process.exit(1);
}
