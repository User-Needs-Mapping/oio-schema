#!/usr/bin/env node
/**
 * Print one version's CHANGELOG.md entry, ready to use as GitHub Release notes.
 *
 *   node scripts/changelog-entry.mjs <version> [--repo-url https://github.com/owner/repo]
 *
 * The entry is everything under `## <version>` up to the next version heading, without the
 * heading itself, because the release already carries the version as its title. Relative
 * links are made absolute against `--repo-url`, since the Releases page does not resolve
 * them. Exits non-zero when the version has no entry, so a release is never published with
 * empty notes.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const changelogEntry = (changelog, version, { repoUrl } = {}) => {
	const lines = changelog.split(/\r?\n/);
	const start = lines.findIndex((line) => new RegExp(`^## ${version.replaceAll(".", "\\.")}(\\s|$)`).test(line));
	if (start < 0) throw new Error(`CHANGELOG.md has no entry for ${version}`);
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => /^## /.test(line));
	const body = (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
	if (!body) throw new Error(`the CHANGELOG.md entry for ${version} is empty`);
	if (!repoUrl) return body;
	const base = repoUrl.replace(/\/+$/, "");
	return body.replace(/\]\((?![a-z][a-z0-9+.-]*:|#)([^)\s]+)\)/gi, (_, path) => `](${base}/blob/main/${path.replace(/^\.?\//, "")})`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const flag = args.indexOf("--repo-url");
	const repoUrl = flag >= 0 ? args[flag + 1] : undefined;
	const version = args.find((arg, index) => !arg.startsWith("--") && (flag < 0 || index !== flag + 1));
	if (!version) {
		process.stderr.write("Usage: changelog-entry <version> [--repo-url <url>]\n");
		process.exit(2);
	}
	const path = resolve(dirname(fileURLToPath(import.meta.url)), "../CHANGELOG.md");
	try {
		process.stdout.write(`${changelogEntry(readFileSync(path, "utf8"), version, { repoUrl })}\n`);
	} catch (error) {
		process.stderr.write(`changelog-entry: ${error.message}\n`);
		process.exit(1);
	}
}
