/**
 * OIO document validation.
 *
 * Two layers, deliberately separate:
 *
 *   1. JSON Schema, which decides whether the document is shaped correctly.
 *   2. Semantic checks, which decide whether it hangs together — identifier
 *      uniqueness, reference resolution and allowed target types. JSON Schema
 *      cannot express any of these, and without them a reference can name
 *      nothing at all and still validate.
 *
 * The semantic layer never guesses. A reference that resolves to more than one
 * record is an error, not a first match, because picking the first match turns
 * an authoring mistake into a silently wrong graph.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv";
import { parse as parseYaml } from "yaml";

const Ajv = AjvModule.default ?? AjvModule;
const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(HERE, "../../schemas");

export const SCHEMA_VERSIONS = {
	"1.1": resolve(SCHEMA_DIR, "oio-schema.json"),
	"1.0": resolve(SCHEMA_DIR, "versions/oio-schema-1.0.0.json"),
};

export const LATEST_SCHEMA_VERSION = "1.1";

/** Structural sections, in the order a document declares them. */
const STRUCTURAL_SECTIONS = [
	["users", "user"],
	["needs", "need"],
	["capabilities", "capability"],
	["technical_systems", "technical_system"],
	["teams", "team"],
	["org_groups", "org_group"],
	["data_assets", "data_asset"],
	["external_dependencies", "external_dependency"],
];

/** Investigation sections. A consumer that does not implement these must say so. */
export const INVESTIGATION_SECTIONS = [
	["metrics", "metric"],
	["signals", "signal"],
	["constraints", "constraint"],
	["outcomes", "outcome"],
	["flow_decision_records", "flow_decision_record"],
];

/** Every type an investigation record may point at when it references structure. */
const STRUCTURAL_TARGETS = [
	"user",
	"need",
	"capability",
	"technical_system",
	"team",
	"team_interaction",
	"org_group",
	"data_asset",
	"external_dependency",
	"relationship",
];

/**
 * The allowed-target table. Every id-based link in the extension appears here;
 * a link absent from this table is a link the validator does not know about,
 * which is itself reported rather than passed over.
 */
export const ALLOWED_TARGETS = {
	"signal.references": STRUCTURAL_TARGETS,
	"signal.reveals": ["constraint"],
	"signal.impedes": ["flow_decision_record"],
	"signal.supersedes": ["signal"],
	"constraint.bounds": ["flow_decision_record", "outcome"],
	"constraint.references": STRUCTURAL_TARGETS,
	"constraint.supersedes": ["constraint"],
	"outcome.beneficiaries": ["user", "team", "org_group"],
	"outcome.references": STRUCTURAL_TARGETS,
	"outcome.measures.metric": ["metric"],
	"outcome.supersedes": ["outcome"],
	"flow_decision_record.cites": ["signal"],
	"flow_decision_record.serves": ["outcome"],
	"flow_decision_record.affects": [
		"user",
		"need",
		"capability",
		"team",
		"external_dependency",
	],
	"flow_decision_record.requires": ["flow_decision_record"],
	"flow_decision_record.metrics.metric": ["metric"],
	"flow_decision_record.chosen_option": ["decision_option"],
	"flow_decision_record.supersedes": ["flow_decision_record"],
	"check_in.readings.metric": ["metric"],
};

/** Name-based structural references, which OIO 1.0 documents use throughout. */
const NAME_REFERENCES = [
	{ section: "needs", field: "user", targets: ["user"] },
	{ section: "needs", field: "fulfilledBy", targets: ["capability"] },
	{ section: "needs", field: "decomposesInto", targets: ["need"] },
	{ section: "capabilities", field: "dependsOn", targets: ["capability"] },
	{ section: "capabilities", field: "decomposesInto", targets: ["capability"] },
	{ section: "technical_systems", field: "enables", targets: ["capability"] },
	{ section: "technical_systems", field: "constrains", targets: ["capability"] },
	{ section: "technical_systems", field: "dependsOn", targets: ["technical_system"] },
	{ section: "technical_systems", field: "externalDeps", targets: ["external_dependency"] },
	{ section: "teams", field: "stewards", targets: ["capability", "technical_system"] },
	{ section: "org_groups", field: "contains", targets: ["team", "capability"] },
	{ section: "data_assets", field: "usedBy", targets: ["technical_system"] },
];

const compiledSchemas = new Map();

const compileSchema = (version) => {
	const cached = compiledSchemas.get(version);
	if (cached) return cached;
	const path = SCHEMA_VERSIONS[version];
	if (!path) throw new Error(`unknown OIO schema version: ${version}`);
	// $id is an identifier for the contract, not a resolution endpoint. Stripping it keeps
	// internal $refs resolving against the in-memory root, which is what every consumer does.
	const { $id: _identifier, ...schema } = JSON.parse(readFileSync(path, "utf8"));
	const ajv = new Ajv({ allErrors: true, strict: false });
	// The 1.0 contract annotates one field with `format: date-time`, which no OIO consumer has
	// ever enforced — Ajv only checks formats when ajv-formats is registered. Registering it as
	// a no-op keeps that behaviour exactly and stops Ajv narrating it on every run. OIO 1.1
	// replaced the annotation with a pattern, which is enforced.
	ajv.addFormat("date-time", () => true);
	const validate = ajv.compile(schema);
	compiledSchemas.set(version, validate);
	return validate;
};

const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

const relationshipTarget = (item) =>
	typeof item === "string" ? item : item && typeof item === "object" ? item.target : undefined;

const issue = (code, path, message, extra = {}) => ({ code, path, message, ...extra });

/**
 * Collects every identified record in the document into one index. Identifiers are
 * unique across the whole document, not per section, which is what removes the
 * ambiguity that names carry.
 */
const buildIdIndex = (doc) => {
	const index = new Map();
	const duplicates = [];

	const add = (id, type, path) => {
		if (typeof id !== "string") return;
		const existing = index.get(id);
		if (existing) {
			duplicates.push(
				issue(
					"duplicate-id",
					path,
					`id "${id}" is already used by ${existing.type} at ${existing.path}`,
					{ id, firstPath: existing.path },
				),
			);
			return;
		}
		index.set(id, { type, path });
	};

	const addRelationshipIds = (items, path) => {
		items.forEach((item, i) => {
			if (item && typeof item === "object" && typeof item.id === "string") {
				add(item.id, "relationship", `${path}/${i}`);
			}
		});
	};

	const addCheckIns = (record, path) => {
		asArray(record.check_ins).forEach((checkIn, i) => {
			if (checkIn && typeof checkIn === "object") add(checkIn.id, "check_in", `${path}/check_ins/${i}`);
		});
	};

	for (const [section, type] of STRUCTURAL_SECTIONS) {
		asArray(doc[section]).forEach((entity, i) => {
			if (!entity || typeof entity !== "object") return;
			const path = `/${section}/${i}`;
			add(entity.id, type, path);
			for (const field of [
				"fulfilledBy",
				"decomposesInto",
				"dependsOn",
				"enables",
				"constrains",
				"stewards",
				"contains",
			]) {
				addRelationshipIds(asArray(entity[field]), `${path}/${field}`);
			}
			asArray(entity.interacts).forEach((interaction, j) => {
				if (interaction && typeof interaction === "object") {
					add(interaction.id, "team_interaction", `${path}/interacts/${j}`);
				}
			});
		});
	}

	for (const [section, type] of INVESTIGATION_SECTIONS) {
		asArray(doc[section]).forEach((record, i) => {
			if (!record || typeof record !== "object") return;
			const path = `/${section}/${i}`;
			add(record.id, type, path);
			addCheckIns(record, path);
			asArray(record.options).forEach((option, j) => {
				if (option && typeof option === "object") add(option.id, "decision_option", `${path}/options/${j}`);
			});
		});
	}

	return { index, duplicates };
};

/** Names, per type, with the paths that declared them, so duplicates can be reported precisely. */
const buildNameIndex = (doc) => {
	const byType = new Map();
	const duplicates = [];
	for (const [section, type] of STRUCTURAL_SECTIONS) {
		const seen = new Map();
		asArray(doc[section]).forEach((entity, i) => {
			if (!entity || typeof entity !== "object" || typeof entity.name !== "string") return;
			const path = `/${section}/${i}`;
			if (seen.has(entity.name)) {
				duplicates.push(
					issue(
						"duplicate-name",
						path,
						`name "${entity.name}" is already used in ${section} at ${seen.get(entity.name)}`,
						{ name: entity.name, section },
					),
				);
				return;
			}
			seen.set(entity.name, path);
		});
		byType.set(type, seen);
	}
	return { byType, duplicates };
};

const checkIdReference = (ctx, linkKey, target, path) => {
	if (typeof target !== "string") return;
	const allowed = ALLOWED_TARGETS[linkKey];
	if (!allowed) {
		ctx.errors.push(issue("unknown-link", path, `no allowed-target rule is defined for "${linkKey}"`));
		return;
	}
	const found = ctx.ids.get(target);
	if (!found) {
		ctx.errors.push(
			issue("unresolved-reference", path, `"${target}" does not match the id of any record in this document`, {
				target,
			}),
		);
		return;
	}
	if (!allowed.includes(found.type)) {
		ctx.errors.push(
			issue(
				"target-type-not-allowed",
				path,
				`${linkKey} may target ${allowed.join(", ")}, but "${target}" is a ${found.type}`,
				{ target, targetType: found.type, allowed },
			),
		);
	}
};

const checkTypedReference = (ctx, linkKey, ref, path) => {
	if (!ref || typeof ref !== "object") return;
	checkIdReference(ctx, linkKey, ref.target, path);
	const found = ctx.ids.get(ref.target);
	if (ref.entity_type && found && found.type !== ref.entity_type) {
		ctx.errors.push(
			issue(
				"entity-type-mismatch",
				path,
				`declared entity_type "${ref.entity_type}" but "${ref.target}" is a ${found.type}`,
				{ target: ref.target, declared: ref.entity_type, actual: found.type },
			),
		);
	}
};

const checkCheckIns = (ctx, record, path) => {
	asArray(record.check_ins).forEach((checkIn, i) => {
		if (!checkIn || typeof checkIn !== "object") return;
		const checkInPath = `${path}/check_ins/${i}`;
		const readings = asArray(checkIn.readings);
		const hasContent =
			(typeof checkIn.note === "string" && checkIn.note.trim() !== "") ||
			(typeof checkIn.interpretation === "string" && checkIn.interpretation.trim() !== "") ||
			readings.length > 0;
		if (!hasContent) {
			ctx.errors.push(
				issue(
					"empty-check-in",
					checkInPath,
					"a check-in must carry an observation, an interpretation or at least one reading",
				),
			);
		}
		readings.forEach((reading, j) => {
			if (reading && typeof reading === "object") {
				checkIdReference(ctx, "check_in.readings.metric", reading.metric, `${checkInPath}/readings/${j}/metric`);
			}
		});
	});
};

const checkMeasures = (ctx, linkKey, measures, path) => {
	asArray(measures).forEach((measure, i) => {
		if (measure && typeof measure === "object") {
			checkIdReference(ctx, linkKey, measure.metric, `${path}/${i}/metric`);
		}
	});
};

const checkSignals = (ctx, doc) => {
	asArray(doc.signals).forEach((signal, i) => {
		if (!signal || typeof signal !== "object") return;
		const path = `/signals/${i}`;
		asArray(signal.references).forEach((ref, j) =>
			checkTypedReference(ctx, "signal.references", ref, `${path}/references/${j}`),
		);
		asArray(signal.reveals).forEach((link, j) =>
			checkIdReference(ctx, "signal.reveals", link?.target, `${path}/reveals/${j}/target`),
		);
		asArray(signal.impedes).forEach((link, j) => {
			const linkPath = `${path}/impedes/${j}/target`;
			checkIdReference(ctx, "signal.impedes", link?.target, linkPath);
			const target = ctx.ids.get(link?.target);
			const fdr = target && ctx.recordAt(target.path);
			if (fdr && (fdr.status ?? "draft") === "draft") {
				ctx.warnings.push(
					issue(
						"impedes-uncommitted-decision",
						linkPath,
						`signal impedes enactment of "${link.target}", which is still a draft and has not been enacted`,
					),
				);
			}
		});
		if (signal.supersedes !== undefined) {
			checkIdReference(ctx, "signal.supersedes", signal.supersedes, `${path}/supersedes`);
		}
	});
};

/**
 * `state_at_commit` is a claim about what somebody believed at the moment a decision was
 * committed. It can only be true of a decision that has a moment of commitment, so stamping
 * one on a draft asserts a belief nobody ever held — the failure this whole field exists to
 * prevent, arriving through the field itself.
 *
 * Its *absence* is not checked, because absence is a fact rather than a gap: on a committed
 * decision it means the condition was named after the decision was made.
 */
const checkStateAtCommit = (ctx, link, path) => {
	const target = ctx.ids.get(link.target);
	if (!target) return;
	if (target.type !== "flow_decision_record") {
		ctx.warnings.push(
			issue(
				"state-at-commit-on-non-decision",
				path,
				`state_at_commit records what a decision was committed under; it has no meaning on a ${target.type}`,
			),
		);
		return;
	}
	const status = ctx.recordAt(target.path)?.status ?? "draft";
	if (status === "draft") {
		ctx.errors.push(
			issue(
				"state-at-commit-on-uncommitted-decision",
				path,
				`"${link.target}" has not committed, so there is no belief-at-commitment to record`,
				{ target: link.target, status },
			),
		);
	}
};

const checkConstraints = (ctx, doc) => {
	asArray(doc.constraints).forEach((constraint, i) => {
		if (!constraint || typeof constraint !== "object") return;
		const path = `/constraints/${i}`;
		asArray(constraint.bounds).forEach((link, j) => {
			const linkPath = `${path}/bounds/${j}`;
			checkIdReference(ctx, "constraint.bounds", link?.target, `${linkPath}/target`);
			if (link?.state_at_commit) checkStateAtCommit(ctx, link, `${linkPath}/state_at_commit`);
		});
		asArray(constraint.references).forEach((ref, j) =>
			checkTypedReference(ctx, "constraint.references", ref, `${path}/references/${j}`),
		);
		if (constraint.supersedes !== undefined) {
			checkIdReference(ctx, "constraint.supersedes", constraint.supersedes, `${path}/supersedes`);
		}
	});
};

const checkOutcomes = (ctx, doc) => {
	asArray(doc.outcomes).forEach((outcome, i) => {
		if (!outcome || typeof outcome !== "object") return;
		const path = `/outcomes/${i}`;
		asArray(outcome.beneficiaries).forEach((ref, j) =>
			checkTypedReference(ctx, "outcome.beneficiaries", ref, `${path}/beneficiaries/${j}`),
		);
		asArray(outcome.references).forEach((ref, j) =>
			checkTypedReference(ctx, "outcome.references", ref, `${path}/references/${j}`),
		);
		checkMeasures(ctx, "outcome.measures.metric", outcome.measures, `${path}/measures`);
		checkCheckIns(ctx, outcome, path);
		if (outcome.supersedes !== undefined) {
			checkIdReference(ctx, "outcome.supersedes", outcome.supersedes, `${path}/supersedes`);
		}
	});
};

const checkDecisionRecords = (ctx, doc) => {
	asArray(doc.flow_decision_records).forEach((fdr, i) => {
		if (!fdr || typeof fdr !== "object") return;
		const path = `/flow_decision_records/${i}`;
		asArray(fdr.cites).forEach((link, j) =>
			checkIdReference(ctx, "flow_decision_record.cites", link?.target, `${path}/cites/${j}/target`),
		);
		if (fdr.serves !== undefined) {
			checkTypedReference(ctx, "flow_decision_record.serves", fdr.serves, `${path}/serves`);
		}
		asArray(fdr.affects).forEach((link, j) =>
			checkTypedReference(ctx, "flow_decision_record.affects", link, `${path}/affects/${j}`),
		);
		asArray(fdr.requires).forEach((ref, j) =>
			checkTypedReference(ctx, "flow_decision_record.requires", ref, `${path}/requires/${j}`),
		);
		checkMeasures(ctx, "flow_decision_record.metrics.metric", fdr.metrics, `${path}/metrics`);
		checkCheckIns(ctx, fdr, path);
		if (fdr.supersedes !== undefined) {
			checkIdReference(ctx, "flow_decision_record.supersedes", fdr.supersedes, `${path}/supersedes`);
		}
		if (fdr.chosen_option !== undefined) {
			const chosenPath = `${path}/chosen_option`;
			checkIdReference(ctx, "flow_decision_record.chosen_option", fdr.chosen_option, chosenPath);
			const ownOptionIds = asArray(fdr.options)
				.map((option) => option?.id)
				.filter((id) => typeof id === "string");
			if (ctx.ids.has(fdr.chosen_option) && !ownOptionIds.includes(fdr.chosen_option)) {
				ctx.errors.push(
					issue(
						"chosen-option-not-listed",
						chosenPath,
						`"${fdr.chosen_option}" is not one of the options this decision considered`,
					),
				);
			}
		}
	});
};

const checkNameReferences = (ctx, doc) => {
	for (const { section, field, targets } of NAME_REFERENCES) {
		asArray(doc[section]).forEach((entity, i) => {
			if (!entity || typeof entity !== "object") return;
			asArray(entity[field]).forEach((item, j) => {
				const name = relationshipTarget(item);
				if (typeof name !== "string") return;
				const path = `/${section}/${i}/${field}/${j}`;
				const matches = targets.filter((type) => ctx.names.get(type)?.has(name));
				if (matches.length === 0) {
					ctx.errors.push(
						issue(
							"unresolved-name",
							path,
							`"${name}" does not name any ${targets.join(" or ")} in this document`,
							{ name, targets },
						),
					);
				} else if (matches.length > 1) {
					ctx.errors.push(
						issue(
							"ambiguous-name",
							path,
							`"${name}" names both a ${matches.join(" and a ")}; add an id-based reference or rename one of them`,
							{ name, matches },
						),
					);
				}
			});
		});
	}

	asArray(doc.teams).forEach((team, i) => {
		asArray(team?.interacts).forEach((interaction, j) => {
			if (!interaction || typeof interaction !== "object") return;
			const path = `/teams/${i}/interacts/${j}`;
			if (typeof interaction.with === "string" && !ctx.names.get("team")?.has(interaction.with)) {
				ctx.errors.push(
					issue("unresolved-name", `${path}/with`, `"${interaction.with}" does not name any team in this document`, {
						name: interaction.with,
						targets: ["team"],
					}),
				);
			}
			// `via` is documented as a free-text pointer, so a name that resolves to nothing is
			// reported but does not fail the document.
			if (
				typeof interaction.via === "string" &&
				!ctx.names.get("capability")?.has(interaction.via) &&
				!ctx.names.get("technical_system")?.has(interaction.via)
			) {
				ctx.warnings.push(
					issue(
						"unresolved-via",
						`${path}/via`,
						`"${interaction.via}" does not name any capability or technical system in this document`,
					),
				);
			}
		});
	});
};

/**
 * Reports which sections a consumer supporting only `supportedSections` would not read.
 * Interchange is only full fidelity if the consumer says what it cannot take.
 */
export const unsupportedSections = (doc, supportedSections) => {
	const supported = new Set(supportedSections);
	return Object.keys(doc ?? {}).filter((key) => key !== "system" && !supported.has(key));
};

const stripIdentifiers = (value, counter) => {
	if (Array.isArray(value)) return value.map((item) => stripIdentifiers(item, counter));
	if (!value || typeof value !== "object") return value;
	const out = {};
	for (const [key, nested] of Object.entries(value)) {
		if (key === "id") {
			counter.count += 1;
			continue;
		}
		out[key] = stripIdentifiers(nested, counter);
	}
	return out;
};

/**
 * Projects an extended document down to its structural core.
 *
 * This is lossy by construction, and says so: `omitted` names every section that was
 * dropped and how many records went with it. A caller that discards that list has
 * silently thrown away the investigation, which is the failure this extension exists
 * to prevent.
 *
 * `target` decides how far back the projection goes, and the two answers are genuinely
 * different documents:
 *
 *   "1.1" (default) keeps identifiers. The result is a structural document that can
 *          still be matched back to the one it came from.
 *   "1.0"  strips identifiers too, because the 1.0 contract has no room for them and
 *          would reject the document. `strippedIdentifiers` counts what that cost, so
 *          the second loss is reported rather than discovered later.
 */
export const projectToStructural = (doc, options = {}) => {
	const target = options.target ?? LATEST_SCHEMA_VERSION;
	const omitted = [];
	const projected = {};
	for (const [key, value] of Object.entries(doc ?? {})) {
		if (INVESTIGATION_SECTIONS.some(([section]) => section === key)) {
			omitted.push({ section: key, records: asArray(value).length });
			continue;
		}
		projected[key] = value;
	}
	if (projected.system && typeof projected.system === "object") {
		const { oio_version: _version, profiles: _profiles, ...system } = projected.system;
		projected.system = system;
	}
	if (target !== "1.0") return { document: projected, omitted, target, strippedIdentifiers: 0 };

	const counter = { count: 0 };
	return {
		document: stripIdentifiers(projected, counter),
		omitted,
		target,
		strippedIdentifiers: counter.count,
	};
};

/**
 * Validates a parsed OIO document.
 *
 * @param {unknown} doc parsed document
 * @param {{ schemaVersion?: string }} [options]
 */
export const validateDocument = (doc, options = {}) => {
	const schemaVersion = options.schemaVersion ?? LATEST_SCHEMA_VERSION;
	const validate = compileSchema(schemaVersion);

	if (!validate(doc)) {
		return {
			ok: false,
			schemaVersion,
			errors: (validate.errors ?? []).map((error) =>
				issue("schema-violation", error.instancePath || "/", `${error.instancePath || "/"} ${error.message}`),
			),
			warnings: [],
		};
	}

	if (!doc || typeof doc !== "object") {
		return { ok: false, schemaVersion, errors: [issue("not-an-object", "/", "document is not an object")], warnings: [] };
	}

	const { index: ids, duplicates: duplicateIds } = buildIdIndex(doc);
	const { byType: names, duplicates: duplicateNames } = buildNameIndex(doc);

	const errors = [...duplicateIds, ...duplicateNames];
	const warnings = [];

	// A duplicated id makes every reference to it meaningless, so reference checking stops here
	// rather than reporting a cascade of consequences of one authoring mistake.
	if (duplicateIds.length > 0) return { ok: false, schemaVersion, errors, warnings };

	const recordAt = (path) => {
		const [, section, i] = path.split("/");
		return doc[section]?.[Number(i)];
	};
	const ctx = { ids, names, errors, warnings, recordAt };

	checkNameReferences(ctx, doc);
	checkSignals(ctx, doc);
	checkConstraints(ctx, doc);
	checkOutcomes(ctx, doc);
	checkDecisionRecords(ctx, doc);

	return { ok: errors.length === 0, schemaVersion, errors, warnings };
};

/** Parses YAML or JSON source and validates it. */
export const validateSource = (source, options = {}) => {
	let doc;
	try {
		doc = parseYaml(source);
	} catch (error) {
		return {
			ok: false,
			schemaVersion: options.schemaVersion ?? LATEST_SCHEMA_VERSION,
			errors: [issue("parse-error", "/", error instanceof Error ? error.message : String(error))],
			warnings: [],
		};
	}
	return validateDocument(doc, options);
};
