/**
 * Behaviour of real documents through the validator.
 *
 * These tests exercise the distinctions the extension exists to protect — a report
 * staying a report, a proposal staying a proposal, a lifted constraint not rewriting
 * the past — rather than restating the schema back to itself.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
	INVESTIGATION_SECTIONS,
	projectToStructural,
	unsupportedSections,
	validateDocument,
	validateSource,
} from "../scripts/lib/validate-oio.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES = {
	structural: "examples/structural-only.oio.yaml",
	investigation: "examples/investigation-unvalidated.oio.yaml",
	review: "examples/decision-and-review.oio.yaml",
};

const source = (key) => readFileSync(resolve(ROOT, EXAMPLES[key]), "utf8");
const doc = (key) => parseYaml(source(key));
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (result) => result.errors.map((error) => error.code);

const findById = (records, id) => records.find((record) => record.id === id);

// --- compatibility ------------------------------------------------------------

test("a structural document written for 1.0 stays valid under both published versions", () => {
	for (const schemaVersion of ["1.0", "1.1"]) {
		const result = validateSource(source("structural"), { schemaVersion });
		assert.deepEqual(result.errors, [], `structural example failed under OIO ${schemaVersion}`);
	}
});

test("every published example validates against the version it declares", () => {
	for (const key of Object.keys(EXAMPLES)) {
		const parsed = doc(key);
		const declared = parsed.system.oio_version ?? "1.0";
		const result = validateDocument(parsed, { schemaVersion: declared });
		assert.deepEqual(result.errors, [], `${EXAMPLES[key]} failed under the version it declares`);
	}
});

test("an extended document is rejected by the 1.0 validator, so optional sections buy no forward compatibility", () => {
	// The 1.0 contract closes the top level with additionalProperties: false. Adding
	// sections in 1.1 does not make an old validator able to read them — it makes it
	// refuse the document. This is the compatibility limit, stated as a test so nobody
	// documents it the other way round.
	const result = validateDocument(doc("investigation"), { schemaVersion: "1.0" });
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => error.code === "schema-violation"));
});

test("a document carrying an investigation must declare the version it was written against", () => {
	const undeclared = clone(doc("investigation"));
	delete undeclared.system.oio_version;
	const result = validateDocument(undeclared);
	assert.equal(result.ok, false, "an undeclared extended document must not pass");
	assert.ok(result.errors.some((error) => error.code === "schema-violation"));
});

test("projecting to the structural core reports every record it drops", () => {
	const { document, omitted, strippedIdentifiers } = projectToStructural(doc("review"));

	assert.deepEqual(validateDocument(document, { schemaVersion: "1.1" }).errors, []);
	assert.equal(strippedIdentifiers, 0, "the default projection keeps identifiers");
	assert.ok(omitted.length > 0, "a lossy projection must account for what it lost");
	for (const { section, records } of omitted) {
		assert.ok(
			INVESTIGATION_SECTIONS.some(([name]) => name === section),
			`${section} is not an investigation section`,
		);
		assert.ok(records > 0, `${section} was reported as dropped but held nothing`);
	}
	assert.ok(omitted.some(({ section }) => section === "signals"));
	assert.ok(omitted.some(({ section }) => section === "flow_decision_records"));
});

test("a projection kept at 1.1 is not a 1.0 document, because identifiers are a 1.1 addition", () => {
	const { document } = projectToStructural(doc("review"));
	const result = validateDocument(document, { schemaVersion: "1.0" });

	assert.equal(result.ok, false, "identifiers alone are enough for a 1.0 validator to refuse it");
	assert.ok(result.errors.some((error) => error.code === "schema-violation"));
});

test("projecting all the way back to 1.0 strips identifiers and counts what that cost", () => {
	const { document, omitted, strippedIdentifiers } = projectToStructural(doc("review"), { target: "1.0" });

	assert.deepEqual(validateDocument(document, { schemaVersion: "1.0" }).errors, []);
	assert.ok(omitted.length > 0);
	assert.ok(strippedIdentifiers > 0, "the second loss must be reported, not discovered later");
	assert.equal(document.capabilities[0].id, undefined);
});

test("a consumer can be told which sections it does not implement", () => {
	const structuralOnlyConsumer = ["users", "needs", "capabilities", "teams", "technical_systems"];
	const unsupported = unsupportedSections(doc("review"), structuralOnlyConsumer);
	assert.ok(unsupported.includes("signals"));
	assert.ok(unsupported.includes("constraints"));
	assert.ok(unsupported.includes("outcomes"));
	assert.ok(unsupported.includes("flow_decision_records"));
});

// --- identity and references --------------------------------------------------

test("renaming an entity keeps the evidence attached to it", () => {
	const renamed = clone(doc("investigation"));
	const capability = findById(renamed.capabilities, "cap-cross-functional-decisions");
	capability.name = "Deciding across the functions";

	const result = validateDocument(renamed);
	assert.deepEqual(result.errors, [], "an id-based reference must survive a rename");

	const signal = findById(renamed.signals, "sig-function-tension");
	assert.ok(signal.references.some((ref) => ref.target === "cap-cross-functional-decisions"));
});

test("renaming an entity breaks the name-based structural references that point at it", () => {
	// The contrast that justifies identifiers: the structural core resolves by name, so a
	// rename detaches everything referring to the old one.
	const renamed = clone(doc("structural"));
	const capability = renamed.capabilities.find((entity) => entity.name === "Job Dispatch");
	capability.name = "Dispatching Jobs";

	const result = validateDocument(renamed);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("unresolved-name"));
});

test("a duplicated identifier is rejected rather than resolved to whichever came first", () => {
	const duplicated = clone(doc("investigation"));
	duplicated.signals[1].id = duplicated.signals[0].id;

	const result = validateDocument(duplicated);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("duplicate-id"));
});

test("a name shared by two kinds of entity is reported as ambiguous, not silently picked", () => {
	const ambiguous = {
		system: { name: "Ambiguity" },
		capabilities: [{ name: "Notifications" }],
		technical_systems: [{ name: "Notifications" }],
		teams: [{ name: "Comms", type: "stream-aligned", stewards: ["Notifications"] }],
	};
	const result = validateDocument(ambiguous);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("ambiguous-name"));
});

test("a reference to an identifier that does not exist is rejected", () => {
	const dangling = clone(doc("investigation"));
	dangling.flow_decision_records[0].cites.push({ target: "sig-nothing-here" });

	const result = validateDocument(dangling);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("unresolved-reference"));
});

test("a reference to the wrong kind of record is rejected even though the id resolves", () => {
	const wrongType = clone(doc("investigation"));
	// `cites` reaches signals. Pointing it at a constraint resolves, and means nothing.
	wrongType.flow_decision_records[0].cites.push({ target: "con-decision-authority" });

	const result = validateDocument(wrongType);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("target-type-not-allowed"));
});

test("a declared entity_type that disagrees with the resolved target is rejected", () => {
	const mismatched = clone(doc("investigation"));
	mismatched.signals[0].references[0].entity_type = "team";

	const result = validateDocument(mismatched);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("entity-type-mismatch"));
});

test("a decision cannot choose an option it never considered", () => {
	const invented = clone(doc("review"));
	const fdr = findById(invented.flow_decision_records, "fdr-event-driven-reissue");
	fdr.chosen_option = "opt-nightly-batch"; // a real option, belonging to the other decision

	const result = validateDocument(invented);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("chosen-option-not-listed"));
});

// --- meaning preserved --------------------------------------------------------

test("a reported signal stays reported through serialisation, and being cited does not promote it", () => {
	const parsed = parseYaml(stringifyYaml(doc("investigation")));
	const signal = findById(parsed.signals, "sig-executive-needs-attributed");

	assert.equal(signal.evidence, "reported");
	assert.equal(signal.provenance.source_type, "interview");

	const citing = parsed.flow_decision_records[0].cites.find(
		(link) => link.target === "sig-executive-needs-attributed",
	);
	assert.ok(citing, "the decision cites this signal");
	assert.equal(
		findById(parsed.signals, "sig-executive-needs-attributed").evidence,
		"reported",
		"citing evidence must not upgrade it",
	);
});

test("the schema supplies no evidence status, so an unknown one never becomes a stated one", () => {
	const unknownEvidence = clone(doc("investigation"));
	delete unknownEvidence.signals[0].evidence;

	const result = validateDocument(unknownEvidence);
	assert.deepEqual(result.errors, [], "evidence status must be optional");
	assert.equal(unknownEvidence.signals[0].evidence, undefined);
});

test("a suspected constraint and a confirmed one are different documents, not the same one read differently", () => {
	const suspected = findById(doc("investigation").constraints, "con-decision-authority");
	const checked = findById(doc("review").constraints, "con-release-window");

	assert.equal(suspected.certainty, "assumed");
	assert.equal(suspected.standing, "live");
	assert.equal(checked.certainty, "confirmed");
	assert.equal(checked.standing, "lifted");
});

test("certainty and standing move independently", () => {
	const both = clone(doc("review"));
	const constraint = findById(both.constraints, "con-release-window");
	constraint.certainty = "assumed";
	constraint.standing = "lifted";

	assert.deepEqual(validateDocument(both).errors, [], "an assumed condition may also have been lifted");
});

test("a proposed decision carries no decision text and no chosen option", () => {
	const proposed = findById(doc("investigation").flow_decision_records, "fdr-cross-functional-decision-making");

	assert.equal(proposed.status, "draft");
	assert.equal(proposed.decision, undefined, "a proposal has not decided anything");
	assert.equal(proposed.chosen_option, undefined, "no structural option is approved");
	assert.ok(proposed.options.length > 1, "the alternatives are recorded, not just the favourite");
	assert.ok(proposed.options.every((option) => option.status === "under-consideration"));
});

test("a decision that has left draft must say what was decided", () => {
	const committedWithoutDecision = clone(doc("investigation"));
	committedWithoutDecision.flow_decision_records[0].status = "committed";

	const result = validateDocument(committedWithoutDecision);
	assert.equal(result.ok, false, "committing must not be possible without a decision");
	assert.ok(result.errors.some((error) => error.code === "schema-violation"));
});

test("a reviewed decision must carry the verdict that made it reviewed", () => {
	const reviewedWithoutVerdict = clone(doc("review"));
	const fdr = findById(reviewedWithoutVerdict.flow_decision_records, "fdr-event-driven-reissue");
	delete fdr.verdict;

	const result = validateDocument(reviewedWithoutVerdict);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => error.code === "schema-violation"));
});

test("a decision's verdict and the outcome it serves are judged separately", () => {
	const parsed = doc("review");
	const fdr = findById(parsed.flow_decision_records, "fdr-event-driven-reissue");
	const outcome = findById(parsed.outcomes, fdr.serves.target);

	assert.equal(fdr.verdict, "validated");
	assert.equal(outcome.status, "observing");
	assert.ok(
		!Object.hasOwn(outcome, "verdict"),
		"an outcome has no verdict; conflating the two is the collision the naming avoids",
	);
});

test("a constraint changing state does not rewrite what an earlier decision was committed under", () => {
	const parsed = doc("review");
	const constraint = findById(parsed.constraints, "con-release-window");
	const boundDecision = constraint.bounds.find((link) => link.target === "fdr-event-driven-reissue");

	assert.equal(constraint.certainty, "confirmed", "the condition has since been checked");
	assert.equal(constraint.standing, "lifted", "and has since stopped applying");
	assert.equal(boundDecision.state_at_commit, "assumed", "the decision was still taken on an assumption");
});

test("changing a constraint's current state leaves the commit-time record alone", () => {
	const changed = clone(doc("review"));
	const constraint = findById(changed.constraints, "con-release-window");
	const before = constraint.bounds.find((link) => link.target === "fdr-event-driven-reissue").state_at_commit;

	constraint.certainty = "assumed";
	constraint.standing = "live";

	const after = constraint.bounds.find((link) => link.target === "fdr-event-driven-reissue").state_at_commit;
	assert.equal(after, before, "state_at_commit is a separate field precisely so this cannot happen");
	assert.deepEqual(validateDocument(changed).errors, []);
});

test("a superseded decision keeps its own context and verdict", () => {
	const parsed = doc("review");
	const successor = findById(parsed.flow_decision_records, "fdr-event-driven-reissue");
	const superseded = findById(parsed.flow_decision_records, successor.supersedes);

	assert.ok(superseded, "the superseded record is still in the document");
	assert.equal(superseded.verdict, "inconclusive");
	assert.ok(superseded.context.length > 0);
	assert.notEqual(superseded.verdict, successor.verdict);
});

// --- check-ins ----------------------------------------------------------------

test("a check-in with notes and no measurement is valid", () => {
	const parsed = doc("review");
	const outcome = findById(parsed.outcomes, "out-confirmations-match-reality");
	const qualitative = findById(outcome.check_ins, "ci-out-2026-08-14");

	assert.equal(qualitative.readings, undefined, "no reading was taken, and none was invented");
	assert.ok(qualitative.note.length > 0);
	assert.deepEqual(validateDocument(parsed).errors, []);
});

test("a check-in keeps what was observed apart from what it was taken to mean", () => {
	const outcome = findById(doc("review").outcomes, "out-confirmations-match-reality");
	const checkIn = findById(outcome.check_ins, "ci-out-2026-06-30");

	assert.ok(checkIn.note.length > 0, "the observation");
	assert.ok(checkIn.interpretation.length > 0, "the reading of it");
	assert.notEqual(checkIn.note, checkIn.interpretation);
	assert.ok(checkIn.readings.length > 0);
	assert.ok(checkIn.readings[0].context, "a reading that cannot be compared fairly says so");
});

test("a check-in that records nothing at all is rejected", () => {
	const empty = clone(doc("review"));
	const outcome = findById(empty.outcomes, "out-confirmations-match-reality");
	outcome.check_ins.push({ id: "ci-empty", at: "2026-09-01" });

	const result = validateDocument(empty);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("empty-check-in"));
});

test("a reading must name a metric the document defines", () => {
	const undefinedMetric = clone(doc("review"));
	const outcome = findById(undefinedMetric.outcomes, "out-confirmations-match-reality");
	outcome.check_ins[0].readings[0].metric = "met-invented";

	const result = validateDocument(undefinedMetric);
	assert.equal(result.ok, false);
	assert.ok(codes(result).includes("unresolved-reference"));
});

test("an outcome is representable with no measure, target or date at all", () => {
	const outcome = findById(doc("investigation").outcomes, "out-timely-strategic-decisions");

	assert.equal(outcome.measures, undefined);
	assert.equal(outcome.target_date, undefined);
	assert.ok(outcome.success_criteria.length > 0, "success is still stated, in words");
});

// --- serialisation ------------------------------------------------------------

test("serialising and reparsing a document preserves every supported field", () => {
	for (const key of Object.keys(EXAMPLES)) {
		const original = doc(key);
		const roundTripped = parseYaml(stringifyYaml(original));
		assert.deepEqual(roundTripped, original, `${EXAMPLES[key]} did not survive a YAML round trip`);
		const declared = original.system.oio_version ?? "1.0";
		assert.deepEqual(validateDocument(roundTripped, { schemaVersion: declared }).errors, []);
	}
});

test("a signal can point at a relationship and at a team interaction, not only at entities", () => {
	const signal = findById(doc("review").signals, "sig-stale-confirmations");
	const targets = signal.references.map((ref) => ref.entity_type);

	assert.ok(targets.includes("team_interaction"));
	assert.ok(targets.includes("relationship"));
	assert.deepEqual(validateDocument(doc("review")).errors, []);
});

test("an obstruction to enacting a decision keeps the signal's own tension type", () => {
	const parsed = doc("review");
	const signal = findById(parsed.signals, "sig-schema-migration-blocked-rollout");

	assert.equal(signal.impedes[0].target, "fdr-event-driven-reissue");
	assert.ok(signal.signal_type, "impeding a decision is a link, not a replacement for the type");
	assert.equal(
		parsed.constraints.some((constraint) =>
			(constraint.references ?? []).some((ref) => ref.target === signal.id),
		),
		false,
		"encountering an obstruction does not create a standing condition",
	);
});
