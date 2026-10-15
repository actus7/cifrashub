/* eslint-disable @typescript-eslint/no-require-imports */
// `npm audit --audit-level=moderate` that tolerates advisories with no published fix.
const { spawnSync } = require("child_process");

// Advisory URL -> why it is accepted. Remove an entry as soon as a patched version ships.
const ACCEPTED = {
  // braces <= 3.0.3 (no patched release yet); only reached through dev tooling globs
  // (shadcn CLI, eslint-config-next), never with user input.
  "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm": "no patched braces release",
};
const FAIL_LEVELS = new Set(["moderate", "high", "critical"]);

const run = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", shell: true });
const report = JSON.parse(run.stdout || "{}");
if (!report.vulnerabilities) {
  console.error(run.stderr || run.stdout);
  process.exit(1);
}

// Advisory objects live in `via` of the vulnerable package itself; string entries only
// point at another package, so checking the objects covers every transitive chain.
const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities)) {
  for (const via of vuln.via) {
    if (typeof via === "object") advisories.set(via.url, via);
  }
}

const failing = [...advisories.values()].filter(
  (a) => FAIL_LEVELS.has(a.severity) && !(a.url in ACCEPTED),
);
for (const a of failing) console.error(`${a.severity}: ${a.name} ${a.range} - ${a.title} (${a.url})`);
for (const url of Object.keys(ACCEPTED)) {
  if (advisories.has(url)) console.warn(`accepted: ${url} (${ACCEPTED[url]})`);
}

process.exit(failing.length > 0 ? 1 : 0);
