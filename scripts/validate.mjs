#!/usr/bin/env node
/**
 * Validate OIO documents.
 *
 *   node scripts/validate.mjs [--schema 1.0|1.1] [--json] [--strict] <file...>
 *
 * Findings go to stderr and machine-readable results to stdout, so the command
 * composes: `node scripts/validate.mjs --json examples/*.oio.yaml | jq`.
 *
 * Exit codes: 0 clean, 1 validation failed, 2 could not run.
 */

import { readFileSync } from "node:fs";
import process from "node:process";
import { LATEST_SCHEMA_VERSION, SCHEMA_VERSIONS, validateSource } from "./lib/validate-oio.mjs";

const USAGE = `Usage: oio-validate [options] <file...>

Options:
  --schema <version>  Validate against a specific OIO schema version
                      (${Object.keys(SCHEMA_VERSIONS).sort().join(", ")}; default ${LATEST_SCHEMA_VERSION})
  --json              Write results to stdout as JSON
  --strict            Treat warnings as failures
  -h, --help          Show this help
`;

const parseArgs = (argv) => {
	const options = { schemaVersion: LATEST_SCHEMA_VERSION, json: false, strict: false, files: [] };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "-h" || arg === "--help") return { help: true };
		else if (arg === "--json") options.json = true;
		else if (arg === "--strict") options.strict = true;
		else if (arg === "--schema") {
			i += 1;
			options.schemaVersion = argv[i];
			if (!SCHEMA_VERSIONS[options.schemaVersion]) {
				return { error: `unknown schema version "${argv[i]}" (known: ${Object.keys(SCHEMA_VERSIONS).join(", ")})` };
			}
		} else if (arg.startsWith("-")) return { error: `unknown option "${arg}"` };
		else options.files.push(arg);
	}
	if (options.files.length === 0) return { error: "no input files" };
	return { options };
};

const { help, error, options } = parseArgs(process.argv.slice(2));

if (help) {
	process.stdout.write(USAGE);
	process.exit(0);
}
if (error) {
	process.stderr.write(`oio-validate: ${error}\n\n${USAGE}`);
	process.exit(2);
}

const results = [];
let failed = false;

for (const file of options.files) {
	let source;
	try {
		source = readFileSync(file, "utf8");
	} catch (readError) {
		process.stderr.write(`oio-validate: cannot read ${file}: ${readError.message}\n`);
		process.exit(2);
	}

	const result = validateSource(source, { schemaVersion: options.schemaVersion });
	const fileFailed = !result.ok || (options.strict && result.warnings.length > 0);
	if (fileFailed) failed = true;
	results.push({ file, ...result });

	if (!options.json) {
		const status = result.ok ? (result.warnings.length > 0 ? "ok (warnings)" : "ok") : "FAILED";
		process.stderr.write(`${status}  ${file}  [OIO ${result.schemaVersion}]\n`);
		for (const finding of result.errors) {
			process.stderr.write(`  error   ${finding.path}  ${finding.code}: ${finding.message}\n`);
		}
		for (const finding of result.warnings) {
			process.stderr.write(`  warning ${finding.path}  ${finding.code}: ${finding.message}\n`);
		}
	}
}

if (options.json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);

process.exit(failed ? 1 : 0);
