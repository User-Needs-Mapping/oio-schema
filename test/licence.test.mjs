/**
 * The licence text must stay byte-for-byte the official Apache License 2.0.
 *
 * A licence is only useful if it is the licence people believe it is. An accidental edit —
 * a reflowed paragraph, a "helpful" clarification, a find-and-replace that strays out of the
 * README — changes the terms without looking like it changed anything. Pinning the digest
 * makes that a failing test rather than a discovery made later by a lawyer.
 *
 * Digest provenance: SHA-256 of https://www.apache.org/licenses/LICENSE-2.0.txt, fetched
 * 2026-09-09 (HTTP 200, 11,358 bytes). Cross-checked word-for-word, whitespace collapsed,
 * against two independent copies: the Apache Software Foundation's own
 * apache/.github repository, and the SPDX licence list entry for Apache-2.0.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OFFICIAL_SHA256 = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";

// Read as bytes and normalise line endings: git is configured to check out CRLF on Windows,
// so a byte comparison of the raw file would fail there for a reason that has nothing to do
// with the licence terms.
const licenceText = () =>
	readFileSync(resolve(ROOT, "LICENSE"), "utf8").replace(/\r\n/g, "\n");

test("LICENSE is the official Apache License 2.0, unmodified", () => {
	const digest = createHash("sha256").update(licenceText(), "utf8").digest("hex");
	assert.equal(
		digest,
		OFFICIAL_SHA256,
		"LICENSE no longer matches the official Apache 2.0 text — the terms have been altered",
	);
});

test("the licence keeps its appendix and the standard placeholders", () => {
	const text = licenceText();
	assert.ok(text.includes("APPENDIX: How to apply the Apache License to your work"));
	// These are the licence's own instructions to its users. Filling them in here would turn
	// an illustration into this project's copyright claim.
	assert.ok(text.includes("Copyright [yyyy] [name of copyright owner]"));
	assert.ok(text.includes("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION"));
});

test("no copyright holder is asserted anywhere, because none has been established", () => {
	// Naming a holder on the strength of a git log would record a guess as a fact. See
	// LICENSING.md; this test fails the moment someone adds one without updating that file.
	for (const file of ["README.md", "package.json", "LICENSING.md"]) {
		const contents = readFileSync(resolve(ROOT, file), "utf8");
		assert.ok(
			!/©|\(c\)\s*(19|20)\d{2}|Copyright\s+(19|20)\d{2}/i.test(contents),
			`${file} asserts a copyright holder, which LICENSING.md records as unestablished`,
		);
	}
});

test("package metadata does not claim a licence the repository has not granted", () => {
	// LICENSING.md records the licence as proposed, not applied. `license` in package.json is
	// the machine-readable assertion that it IS granted, so the two must not disagree.
	const manifest = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
	const licensing = readFileSync(resolve(ROOT, "LICENSING.md"), "utf8");
	const proposed = licensing.includes("**This repository is not yet licensed.**");

	if (proposed) {
		assert.equal(
			manifest.license,
			"UNLICENSED",
			"LICENSING.md still calls the licence proposed, so package.json must not claim Apache-2.0",
		);
	} else {
		assert.equal(
			manifest.license,
			"Apache-2.0",
			"LICENSING.md no longer calls the licence proposed, so package.json should declare Apache-2.0",
		);
	}
});
