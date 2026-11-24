#!/usr/bin/env node
/**
 * Date the newest version heading in CHANGELOG.md.
 *
 *   node scripts/stamp-changelog-date.mjs [path] [--date YYYY-MM-DD]
 *
 * `changeset version` writes headings as a bare `## 1.3.0`. Consumers of a schema need to
 * know when a contract appeared, so this runs straight after it and turns the topmost
 * undated heading into `## 1.3.0 (2026-12-01)`. Headings that already carry a date or a
 * note in brackets are left alone, so running it twice changes nothing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HEADING = /^## (\d+\.\d+\.\d+)[ \t]*$/m;

export const stampNewestHeading = (changelog, date) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`not a YYYY-MM-DD date: ${date}`);
	const first = changelog.match(/^## .*$/m);
	if (!first || !HEADING.test(first[0])) return changelog;
	return changelog.replace(first[0], `${first[0].trimEnd()} (${date})`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const dateFlag = args.indexOf("--date");
	const date = dateFlag >= 0 ? args[dateFlag + 1] : new Date().toISOString().slice(0, 10);
	const path =
		args.find((arg, index) => !arg.startsWith("--") && (dateFlag < 0 || index !== dateFlag + 1)) ??
		resolve(dirname(fileURLToPath(import.meta.url)), "../CHANGELOG.md");
	const before = readFileSync(path, "utf8");
	const after = stampNewestHeading(before, date);
	if (after !== before) writeFileSync(path, after);
}
