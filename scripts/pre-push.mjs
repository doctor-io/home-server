#!/usr/bin/env node

import { execSync } from "node:child_process";

function run(command, options = {}) {
  execSync(command, {
    stdio: "inherit",
    ...options,
  });
}

function runQuiet(command) {
  return execSync(command, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

function isVersionBumpCommit(message) {
  return /^chore: bump version \d+\.\d+\.\d+$/.test(message);
}

function main() {
  const lastCommitMessage = runQuiet("git log -1 --pretty=%s");

  run("npm run lint");
  run("npm run test:unit");

  if (isVersionBumpCommit(lastCommitMessage)) {
    console.log("pre-push: version already bumped in latest commit, continuing push.");
    return;
  }

  const previousVersion = runQuiet("node -p \"require('./package.json').version\"");

  run("npm run version:patch:no-tag");
  run("git add package.json package-lock.json");

  const nextVersion = runQuiet("node -p \"require('./package.json').version\"");
  run(`git commit -m "chore: bump version ${nextVersion}"`);

  console.log(
    `pre-push: version bumped ${previousVersion} -> ${nextVersion}. Push stopped so this new commit can be pushed. Run git push again.`,
  );

  process.exit(1);
}

main();
