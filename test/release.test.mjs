/**
 * The package version, the schema version and the changelog have to agree.
 *
 * A document only sees `oio_version`, which is major.minor. The package version adds a
 * patch number for changes that alter nothing a document may contain. These tests keep the
 * two tied together, so a release can never ship a package version that names a contract
 * the schema does not define, or a contract with no changelog entry.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LATEST_SCHEMA_VERSION, SCHEMA_VERSIONS } from "../scripts/lib/validate-oio.mjs";
import { stampNewestHeading } from "../scripts/stamp-changelog-date.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const changelog = readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8");

const BUMPS = ["patch", "minor", "major"];

/** The largest bump any changeset waiting in .changeset/ asks for, or undefined. */
const pendingBump = () => {
	const dir = resolve(ROOT, ".changeset");
	let highest = -1;
	for (const file of readdirSync(dir).filter((name) => name.endsWith(".md") && name !== "README.md")) {
		const front = readFileSync(resolve(dir, file), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
		assert.ok(front, `.changeset/${file} has no front matter`);
		for (const line of front[1].split(/\r?\n/).filter((entry) => entry.trim())) {
			const match = line.match(/^\s*["']?([^"':]+)["']?\s*:\s*(patch|minor|major)\s*$/);
			assert.ok(match, `.changeset/${file}: cannot read "${line}"`);
			assert.equal(match[1], manifest.name, `.changeset/${file} names a package this repository does not hold`);
			highest = Math.max(highest, BUMPS.indexOf(match[2]));
		}
	}
	return highest < 0 ? undefined : BUMPS[highest];
};

const applyBump = (version, bump) => {
	const [major, minor, patch] = version.split(".").map(Number);
	if (bump === "major") return `${major + 1}.0.0`;
	if (bump === "minor") return `${major}.${minor + 1}.0`;
	if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
	return version;
};

const majorMinor = (version) => version.split(".").slice(0, 2).join(".");

test("the schema version is the one the package will carry once pending changesets are applied", () => {
	const bump = pendingBump();
	const next = applyBump(manifest.version, bump);
	assert.equal(
		LATEST_SCHEMA_VERSION,
		majorMinor(next),
		bump
			? `a pending ${bump} changeset takes the package to ${next}, so the schema must be OIO ${majorMinor(next)}`
			: `package.json is ${manifest.version}, so the schema must be OIO ${majorMinor(manifest.version)}`,
	);
});

test("the current schema accepts the oio_version the package names", () => {
	const schema = JSON.parse(readFileSync(SCHEMA_VERSIONS[LATEST_SCHEMA_VERSION], "utf8"));
	assert.ok(schema.definitions.system.properties.oio_version.enum.includes(LATEST_SCHEMA_VERSION));
});

test("every earlier contract is frozen under schemas/versions and exported by the package", () => {
	for (const [version, path] of Object.entries(SCHEMA_VERSIONS)) {
		if (version === LATEST_SCHEMA_VERSION) {
			assert.equal(manifest.exports["./schema"], "./schemas/oio-schema.json");
			continue;
		}
		const published = `./schemas/versions/oio-schema-${version}.0.json`;
		assert.equal(path, resolve(ROOT, published), `OIO ${version} is not where frozen contracts live`);
		assert.ok(existsSync(path), `${published} is missing`);
		assert.equal(manifest.exports[`./schema/${version}.0`], published, `package.json does not export OIO ${version}`);
	}
});

test("the changelog has an entry for the package's current version", () => {
	assert.match(changelog, /^# @user-needs-mapping\/oio-schema\r?\n/, "changesets inserts entries under this exact title");
	const escaped = manifest.version.replaceAll(".", "\\.");
	assert.match(changelog, new RegExp(`^## ${escaped}( \\(.+\\))?\\r?$`, "m"), `no "## ${manifest.version}" heading`);
});

test("only the newest undated changelog heading is dated, and only once", () => {
	const fresh = "# pkg\n\n## 1.3.0\n\n- a\n\n## 1.2.0 (2026-11-01)\n\n- b\n";
	const stamped = stampNewestHeading(fresh, "2026-12-01");
	assert.equal(stamped, "# pkg\n\n## 1.3.0 (2026-12-01)\n\n- a\n\n## 1.2.0 (2026-11-01)\n\n- b\n");
	assert.equal(stampNewestHeading(stamped, "2026-12-02"), stamped, "a dated heading must not be dated again");
	assert.equal(stampNewestHeading("# pkg\n\n## 1.2.0 (unreleased)\n", "2026-12-01"), "# pkg\n\n## 1.2.0 (unreleased)\n");
	assert.throws(() => stampNewestHeading(fresh, "1 December"));
});
