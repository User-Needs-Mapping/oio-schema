#!/usr/bin/env node
/**
 * Compare the vocabularies OIO claims to share with Fast Flow Toolkit against that
 * application's own schema profile.
 *
 *   node scripts/check-ontology-drift.mjs <path-to-consumer-schema-profile.yaml> [--json]
 *
 * This exists because it has already happened. OIO 1.1 was drafted against one revision of
 * the consuming application's ontology and merged against another: the decision verdict
 * values changed from `validated | disproved` to `supported | not-supported` while this
 * schema was being written, and nothing would have noticed. A shared vocabulary that
 * silently stops being shared is worse than no claim of sharing at all, because the
 * documentation goes on asserting it.
 *
 * The check is one-directional on purpose: it reports where OIO disagrees with the consumer.
 * It does not judge which side is right. OIO follows the consuming application's agreed
 * ontology, so a disagreement is a prompt to go and read the decision behind it, never to
 * auto-update anything.
 *
 * Exit codes: 0 aligned, 1 drift found, 2 could not run.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../schemas/oio-schema.json");

/**
 * Every vocabulary the README and the schema descriptions describe as shared.
 * Adding a "Shared vocabulary with Fast Flow Toolkit" note to a field without adding it
 * here makes a claim nothing checks.
 */
const SHARED_FIELDS = [
	{ definition: "signal", field: "signal_type", entity: "signal" },
	{ definition: "signal", field: "severity", entity: "signal" },
	{ definition: "signal", field: "dismiss_reason", entity: "signal" },
	{ definition: "constraint", field: "certainty", entity: "constraint" },
	{ definition: "constraint", field: "standing", entity: "constraint" },
	{ definition: "outcome", field: "status", entity: "outcome" },
	{ definition: "outcome", field: "archived_reason", entity: "outcome" },
	{ definition: "flowDecisionRecord", field: "phase", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "status", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "verdict", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "rollout_status", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "intervention_type", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "confidence", entity: "flow-decision-record" },
	{ definition: "flowDecisionRecord", field: "reversibility", entity: "flow-decision-record" },
	{ definition: "metricDefinition", field: "direction", entity: "metric" },
];

/** Relationship properties OIO mirrors, keyed by the OIO definition that carries them. */
const SHARED_RELATIONSHIP_FIELDS = [
	{ definition: "revealsLink", field: "effect", relationship: "reveals", property: "effect" },
	{ definition: "boundsLink", field: "state_at_commit", relationship: "bounds", property: "state_at_commit" },
	{ definition: "affectsLink", field: "role", relationship: "affects", property: "role" },
];

const args = process.argv.slice(2);
const json = args.includes("--json");
const profilePath = args.find((arg) => !arg.startsWith("-"));

if (!profilePath) {
	process.stderr.write(
		"Usage: check-ontology-drift <path-to-consumer-schema-profile.yaml> [--json]\n" +
			"\nPoint this at the schema profile of the application that consumes OIO documents.\n",
	);
	process.exit(2);
}

let profile;
let schema;
try {
	profile = parseYaml(readFileSync(profilePath, "utf8"));
	schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
} catch (error) {
	process.stderr.write(`check-ontology-drift: ${error.message}\n`);
	process.exit(2);
}

const findings = [];

for (const { definition, field, entity } of SHARED_FIELDS) {
	const ours = schema.definitions?.[definition]?.properties?.[field]?.enum;
	const theirs = profile.entities?.[entity]?.fields?.[field]?.values;
	if (!ours) {
		findings.push({ kind: "missing-locally", where: `${definition}.${field}` });
		continue;
	}
	if (!theirs) {
		findings.push({ kind: "missing-upstream", where: `${entity}.${field}`, oio: ours });
		continue;
	}
	if (JSON.stringify(ours) !== JSON.stringify(theirs)) {
		findings.push({ kind: "drift", where: `${entity}.${field}`, oio: ours, fftk: theirs });
	}
}

for (const { definition, field, relationship, property } of SHARED_RELATIONSHIP_FIELDS) {
	const ours = schema.definitions?.[definition]?.properties?.[field]?.enum;
	const theirs = profile.relationships?.[relationship]?.properties?.[property]?.values;
	if (!ours || !theirs) {
		findings.push({ kind: ours ? "missing-upstream" : "missing-locally", where: `${relationship}.${property}` });
		continue;
	}
	if (JSON.stringify(ours) !== JSON.stringify(theirs)) {
		findings.push({ kind: "drift", where: `${relationship}.${property}`, oio: ours, fftk: theirs });
	}
}

if (json) {
	process.stdout.write(`${JSON.stringify({ checked: SHARED_FIELDS.length + SHARED_RELATIONSHIP_FIELDS.length, findings }, null, 2)}\n`);
} else if (findings.length === 0) {
	process.stderr.write(
		`aligned — ${SHARED_FIELDS.length + SHARED_RELATIONSHIP_FIELDS.length} shared vocabularies match FFTK\n`,
	);
} else {
	process.stderr.write(`DRIFT — ${findings.length} of ${SHARED_FIELDS.length + SHARED_RELATIONSHIP_FIELDS.length} shared vocabularies disagree with FFTK\n\n`);
	for (const finding of findings) {
		if (finding.kind === "drift") {
			process.stderr.write(`  ${finding.where}\n`);
			process.stderr.write(`    FFTK: ${JSON.stringify(finding.fftk)}\n`);
			process.stderr.write(`    OIO : ${JSON.stringify(finding.oio)}\n`);
		} else {
			process.stderr.write(`  ${finding.where}: ${finding.kind}\n`);
		}
	}
	process.stderr.write(
		"\nFind the decision that changed this vocabulary and read it before editing anything here.\n" +
			"OIO follows that application's agreed ontology; it does not negotiate with it.\n",
	);
}

process.exit(findings.length === 0 ? 0 : 1);
