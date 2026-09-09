/**
 * The README's examples are checked, so documentation cannot drift away from the schema.
 *
 * Convention: a ```yaml fence in the README is a complete OIO document and is validated
 * as one. Fragments are fenced as ```text so they are not mistaken for documents.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { validateSource } from "../scripts/lib/validate-oio.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README = readFileSync(resolve(ROOT, "README.md"), "utf8");

const yamlBlocks = [...README.matchAll(/^```yaml\r?\n([\s\S]*?)^```/gm)].map((match, index) => ({
	index,
	body: match[1],
}));

test("the README contains YAML examples to check", () => {
	assert.ok(yamlBlocks.length >= 2, "expected a structural example and an extended example");
});

for (const { index, body } of yamlBlocks) {
	test(`README YAML example ${index + 1} is a complete, valid OIO document`, () => {
		const parsed = parseYaml(body);
		const declared = parsed?.system?.oio_version ?? "1.0";
		const result = validateSource(body, { schemaVersion: declared });
		assert.deepEqual(
			result.errors,
			[],
			`README example ${index + 1} does not validate against OIO ${declared}`,
		);
	});
}

test("the README's structural example uses no part of the extension", () => {
	const [structural] = yamlBlocks;
	const parsed = parseYaml(structural.body);
	assert.equal(parsed.system.oio_version, undefined);
	for (const section of ["signals", "constraints", "outcomes", "flow_decision_records", "metrics"]) {
		assert.equal(parsed[section], undefined);
	}
});

test("every file the README links to exists", () => {
	const links = [...README.matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((match) => match[1]);
	assert.ok(links.length > 0, "expected relative links to check");
	for (const link of links) {
		assert.ok(existsSync(resolve(ROOT, link)), `README links to ${link}, which does not exist`);
	}
});
