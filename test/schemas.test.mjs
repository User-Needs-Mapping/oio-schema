/**
 * Properties of the schema files themselves.
 *
 * The schema shipped on `main` before this work did not parse and its internal $refs
 * did not resolve, so these are not idle checks.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ALLOWED_TARGETS, SCHEMA_VERSIONS, validateDocument } from "../scripts/lib/validate-oio.mjs";

const load = (version) => JSON.parse(readFileSync(SCHEMA_VERSIONS[version], "utf8"));

const collectRefs = (node, found = []) => {
	if (Array.isArray(node)) node.forEach((item) => collectRefs(item, found));
	else if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node)) {
			if (key === "$ref" && typeof value === "string") found.push(value);
			else collectRefs(value, found);
		}
	}
	return found;
};

for (const version of Object.keys(SCHEMA_VERSIONS)) {
	test(`OIO ${version} schema parses and every internal $ref resolves`, () => {
		const schema = load(version);
		const names = new Set(Object.keys(schema.definitions));
		for (const ref of collectRefs(schema)) {
			assert.match(ref, /^#\/definitions\//, `unexpected external $ref: ${ref}`);
			const name = ref.replace("#/definitions/", "");
			assert.ok(names.has(name), `$ref "${ref}" points at a definition that does not exist`);
		}
	});
	test(`OIO ${version} schema declares no definition that nothing reaches`, () => {
		const schema = load(version);
		const used = new Set(collectRefs(schema).map((ref) => ref.replace("#/definitions/", "")));
		const orphans = Object.keys(schema.definitions).filter((name) => !used.has(name));
		assert.deepEqual(orphans, [], `unreachable definitions: ${orphans.join(", ")}`);
	});
	test(`OIO ${version} schema names only formats a consumer can actually check`, () => {
		// The committed 1.0 schema used `format: "datetime"`, which is not a JSON Schema
		// format name and so validated nothing anywhere, silently.
		const known = new Set(["date-time", "date", "time", "email", "uri", "regex"]);
		const walk = (node) => {
			if (Array.isArray(node)) node.forEach(walk);
			else if (node && typeof node === "object") {
				if (typeof node.format === "string") {
					assert.ok(known.has(node.format), `unknown format name "${node.format}"`);
				}
				Object.values(node).forEach(walk);
			}
		};
		walk(load(version));
	});
}

test("the identifier of each schema names the repository this schema lives in", () => {
	// The committed schema identified itself as User-Needs-Mapping/oio-datamodel, which
	// does not exist. `git remote` and the GitHub API both resolve this repo to
	// User-Needs-Mapping/oio-schema.
	for (const version of Object.keys(SCHEMA_VERSIONS)) {
		assert.match(load(version).$id, /^https:\/\/github\.com\/User-Needs-Mapping\/oio-schema\//);
	}
});

test("the frozen 1.0 contract carries no part of the investigation extension", () => {
	const frozen = load("1.0");
	for (const section of ["signals", "constraints", "outcomes", "flow_decision_records", "metrics"]) {
		assert.equal(frozen.properties[section], undefined, `1.0 must not know about ${section}`);
	}
	assert.equal(frozen.definitions.system.properties.oio_version, undefined);
	assert.equal(frozen.definitions.user.properties.id, undefined, "1.0 has no identifiers");
});

test("1.1 keeps every structural constraint the 1.0 contract imposes", () => {
	const frozen = load("1.0");
	const current = load("1.1");
	for (const [name, definition] of Object.entries(frozen.definitions)) {
		const now = current.definitions[name];
		assert.ok(now, `1.1 dropped the ${name} definition`);
		if (definition.required) {
			for (const field of definition.required) {
				assert.ok(now.required?.includes(field), `1.1 stopped requiring ${name}.${field}`);
			}
		}
		for (const [field, spec] of Object.entries(definition.properties ?? {})) {
			assert.ok(now.properties?.[field], `1.1 dropped ${name}.${field}`);
			if (spec.enum) {
				assert.deepEqual(
					now.properties[field].enum,
					spec.enum,
					`1.1 changed the ${name}.${field} enum, which would reclassify existing documents`,
				);
			}
		}
	}
});

test("the version enum a document may declare matches the versions the validator offers", () => {
	const declarable = load("1.1").definitions.system.properties.oio_version.enum;
	for (const version of declarable) {
		assert.ok(SCHEMA_VERSIONS[version], `documents may declare "${version}" but no such schema is published`);
	}
});

test("a document is rejected outright for a top-level section neither version defines", () => {
	const doc = { system: { name: "S" }, canvas_positions: [{ x: 1 }] };
	for (const schemaVersion of ["1.0", "1.1"]) {
		const result = validateDocument(doc, { schemaVersion });
		assert.equal(result.ok, false, `${schemaVersion} accepted an undefined section`);
		assert.ok(result.errors.some((error) => error.code === "schema-violation"));
	}
});

test("every id-based link the validator polices is a property the schema actually defines", () => {
	// The allowed-target table and the schema are edited separately, so they can drift
	// apart. A rule for a property that no longer exists silently polices nothing.
	const schema = load("1.1");
	const owners = {
		signal: "signal",
		constraint: "constraint",
		outcome: "outcome",
		flow_decision_record: "flowDecisionRecord",
		check_in: "checkIn",
	};
	for (const key of Object.keys(ALLOWED_TARGETS)) {
		const [owner, field] = key.split(".");
		const definition = schema.definitions[owners[owner]];
		assert.ok(definition, `no schema definition owns "${key}"`);
		assert.ok(definition.properties[field], `${key} polices a property the schema does not define`);
	}
});

test("every reference-bearing field on an investigation record has an allowed-target rule", () => {
	const declared = {
		signal: ["references", "reveals", "impedes", "supersedes"],
		constraint: ["bounds", "references", "supersedes"],
		outcome: ["beneficiaries", "references", "supersedes"],
		flow_decision_record: ["cites", "serves", "affects", "requires", "supersedes", "chosen_option"],
	};
	for (const [owner, fields] of Object.entries(declared)) {
		for (const field of fields) {
			assert.ok(
				ALLOWED_TARGETS[`${owner}.${field}`],
				`${owner}.${field} can point somewhere but nothing checks where`,
			);
		}
	}
});
