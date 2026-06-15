/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const roots = [
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

for (const root of roots) {
  const pluginsIndex = path.join(root, "dist", "client", "plugins", "index.mjs");

  if (!fs.existsSync(pluginsIndex)) {
    continue;
  }

  let content = fs.readFileSync(pluginsIndex, "utf8");
  if (content.includes("apiKeyClient")) {
    continue;
  }

  content = `const apiKeyClient = () => ({ id: "api-key", $InferServerPlugin: {} });\n${content.replace("export {", "export { apiKeyClient,")}`;
  fs.writeFileSync(pluginsIndex, content);
}
