# Licensing status

**This repository is not yet licensed.** [`LICENSE`](LICENSE) contains the Apache License,
Version 2.0, prepared for review. It is a **proposal**, not a licence grant that has taken
effect, because one question about the provenance of the structural schema is unresolved.
That question is set out below and only the copyright holders can answer it.

Until it is answered and this file is updated, treat the repository as carrying **no licence
grant**: no rights to use, copy, modify or distribute have been given.

## What was checked

| | |
|---|---|
| Existing licence file | None. No `LICENSE`, `COPYING`, `NOTICE` or equivalent existed before this change. |
| Copyright notices in source | None anywhere in the tree. |
| Package metadata | `package.json` declares `"license": "UNLICENSED"` and `"private": true`. |
| Contributors, all time | One: Rich Allen `<rich@conjurersolutions.co.uk>`, 7 commits. |
| Third-party code vendored | None. `ajv` (MIT) and `yaml` (ISC) are declared dependencies, not copied into this tree. |

Because there is exactly one committer, there is **no need to collect a licence agreement
from other contributors**. That part of a relicensing exercise does not apply here.

## The unresolved question

**Is the structural OIO schema this repository's own work to license?**

The evidence says the structural core was derived by copy-and-edit from an existing "UNM"
(User Needs Mapping) JSON Schema, not written from scratch:

- The repository's **first commit** (`b109b62`, "Add initial schema") added
  `schemas/unm-schema.json` — not an OIO file. The current `schemas/oio-schema.json` descends
  from it.
- That first commit is **72% byte-identical** to the copy of the UNM schema vendored in Fast
  Flow Toolkit: 209 of 290 leaf values match exactly. The
  27 shared paths that differ are almost entirely `description` prose.
- The definitions correspond one-for-one, including the distinctive `relationship`
  short-form/long-form construct: `actor`→`user`, `service`→`technicalSystem`, with `system`,
  `need`, `capability`, `team`, `teamInteraction`, `orgGroup`, `externalDependency`,
  `dataAsset` and `relationship` carried across unchanged.
- Residual UNM vocabulary survived into the committed OIO schema until this session — several
  descriptions still referred to `service` and `service.externalDeps` in a schema whose entity
  is `technicalSystem`.

That level of correspondence is copying, not independent convergence.

**Whose work is it?** Established by the maintainer, 2026-09-09:

Kristian Zachariassen (`krzachariassen`) **authored the original UNM schema** for his own
UNM Platform product. OIO was written to support import and export from Fast Flow Toolkit and
to remain mappable to that schema, and was initially based on it before diverging as the two
systems came to represent things differently. The two discussed the interchange; the schema
was not written from scratch here.

So the derivation is confirmed, and so is third-party authorship. Two consequences follow, and
both matter:

- **This repository cannot unilaterally place Kristian's expression under Apache 2.0.**
  Apache 2.0 grants rights in the licensor's own work.
- **Owning the "User Needs Mapping" name, the `userneedsmapping.com` domain and this GitHub
  organisation does not change that.** Those are brand and trademark matters. They confer no
  copyright in a file someone else wrote.

Nor does a shared origin in conversation resolve it. If the work were treated as jointly
authored, the maintainer is UK-based, and under UK law joint owners of copyright generally
cannot license the work without their co-owners' consent — so that route does not unblock
anything unilaterally either.

### The upstream repository has since been deleted

`github.com/krzachariassen/unm-platform` now returns 404, as does the raw schema URL. The
GitHub account itself is live. No public fork or mirror carries the file, and no Wayback
snapshot was retrievable.

**This does not help, and slightly hurts.** Deleting a repository does not abandon copyright,
release the work into the public domain, or grant anyone rights. What it removes is the
ability to *read* a licence that may well have been there — the file was fetched from a public
`raw.githubusercontent.com` URL on `main`, and Fast Flow Toolkit still carries the command that
fetched it, so the repository was public at the time. Public on GitHub is not the same as
licensed for redistribution, but it does mean a `LICENSE` file may have existed and would now
settle this in a sentence.

Fast Flow Toolkit's vendored copy is now the only accessible record of what the original
contained. **It should not be deleted.** It is the evidence of exactly what was and was not
taken, and the fetch command beside it records where it came from.

### How much of the original survives: none, as of 2026-09-09

The inherited wording has been rewritten. Both schema files were measured against Fast Flow
Toolkit's vendored copy of the original two ways — whole `description` strings that were
byte-identical, and any run of eight or more consecutive words in common — then rewritten
until both measures reached zero.

| | Before | After |
|---|---|---|
| OIO 1.1: descriptions byte-identical to UNM | 23 of 243 (9.5%) | **0** |
| OIO 1.1: descriptions sharing an 8+ word run | 29 of 486 strings | **0** |
| OIO 1.0 frozen: descriptions byte-identical | 23 of 78 (29.5%) | **0** |
| OIO 1.0 frozen: descriptions sharing an 8+ word run | 29 of 156 strings | **0** |

52 descriptions were rewritten across the two files. The two most distinctive borrowings are
gone rather than reworded: the *"Merchant, Eater, Operator"* personas, and the *"Kafka …
Elasticsearch"* product examples in the data-asset types.

**Only prose changed.** With `description` and `title` ignored, both schema files are
byte-identical to their previous committed state: no property, type, `enum`, `required` or
`additionalProperties` value moved. The frozen 1.0 file's contract is therefore untouched in
the sense that matters — it validates exactly the documents it validated before — while no
longer carrying someone else's sentences. All 61 tests and all three examples pass unchanged.

To reproduce the measurement, compare the `description` values in `schemas/oio-schema.json`
against those in Fast Flow Toolkit's vendored copy of the UNM schema, both for exact equality
and for shared runs of eight or more words.

### What remains, and why it is weaker ground

What is still shared is **structure**: 148 of 748 schema paths (19.8%), meaning field names
and their arrangement — `system`, `needs`, `capabilities`, the short-form/long-form
`relationship` construct.

That is materially weaker ground for a copyright claim than prose was. Field names are short,
functional, and largely dictated by the domain rather than chosen for expression: the
vocabulary comes from Team Topologies and Wardley mapping, not from either party. Two schemas
describing the same domain would be expected to converge on much of it.

This is a reduction in exposure, not a legal opinion, and it does not replace step 1 below.

### What would resolve it

Do **both**. Either alone leaves something open; together they close it quickly.

1. **Ask Kristian for a written grant.** This is the real fix. A short email is enough — it
   need not be a formal document — and it should cover both this repository and Fast Flow
   Toolkit's vendored copy, which redistributes his file in a second place. Record the grant,
   its date and its scope in this file. If he confirms the original was published under a
   permissive licence, that works too: record the licence and honour its attribution terms.

2. ~~**Rewrite the remaining descriptions in this repository's own words.**~~ **Done,
   2026-09-09** — 52 descriptions across both schema files, taking both overlap measures to
   zero. See above. This was the part that did not depend on anyone replying, and it is
   finished; step 1 is not, and is still the real fix.

**Attribution is worth adding either way.** Crediting Kristian's original UNM schema as the
starting point costs nothing, is accurate, and is what Apache 2.0 or MIT would require if the
upstream turns out to have carried one. That is what a `NOTICE` file is for, and it should be
added as part of resolution.

A third option — rewriting the structural core outright — is disproportionate and is listed
only for completeness.

No `NOTICE` file has been created yet. The author is now identified, so the obstacle is no
longer that there is nobody to credit: it is that the wording of an attribution depends on
which resolution path is taken, and writing one before the grant exists would describe a
permission that has not been given.

## Copyright holder

**Not asserted, and deliberately left blank.** No copyright line has been added to any file.

Git authorship establishes that Rich Allen *wrote* the commits. It does not establish who
*owns* the copyright — the `@conjurersolutions.co.uk` address raises the ordinary question of
whether the work was done for a company, and only the parties involved know the answer. Naming
"Rich Allen", "Conjurer Solutions Ltd" or the `User-Needs-Mapping` organisation on the strength
of a git log would be a guess recorded as a fact.

The `Copyright [yyyy] [name of copyright owner]` line inside the `LICENSE` appendix is the
**standard illustrative placeholder** from the official text and has deliberately not been
filled in. It is part of the licence's own instructions to users, not this project's copyright
notice.

## What is unblocked

The provenance question touches only the **structural schema**. Everything else in this
repository was written from scratch and is unencumbered by it:

- `scripts/` — the validator, CLI and ontology drift check
- `test/`
- `examples/`
- `docs/`
- `README.md`
- `.github/workflows/`
- The **OIO 1.1 investigation extension** within the schema files — signals, constraints,
  outcomes, flow decision records, metrics, check-ins, provenance, identifiers and the
  relationships between them

These carry no third-party expression. Their shared *vocabulary* with Fast Flow Toolkit —
enum values such as `assumed`, `confirmed`, `supported` — is terminology rather than creative
expression, and FFTK is a repository under the same authorship, so it raises no separate
question.

## Steps remaining, once the question is answered

1. Record the answer and its basis in this file, and change the heading from proposed to
   applied.
2. Set `"license": "Apache-2.0"` in `package.json`, replacing `"UNLICENSED"`. This is
   deliberately **not** done yet: that field is the machine-readable assertion that the
   package *is* Apache-2.0 licensed, and asserting it now would state as settled the very
   thing that is not.
3. Decide whether `"private": true` should stay. It currently prevents accidental publication
   to npm and is unrelated to the licence.
4. Add a `NOTICE` file **only if** resolution path (2) or (3) above creates an attribution
   obligation.
5. Add a copyright line naming the established holder.

## Scope of the licence, once applied

Apache 2.0 would cover **this repository's material**: the schemas, the validation tooling,
the tests, the examples and the documentation.

It would **not** reach a model you write. Creating, validating or exchanging an `.oio.yaml`
document that conforms to this schema does not make your model a derivative work of the
schema, and puts no licence obligation on your own organisational data. A schema describes a
shape; conforming to a shape is not copying the description of it.

The one thing to watch: if you copy text out of the files in [`examples/`](examples/) into
your own document, you are copying this repository's material, and the licence applies to
what you copied. Your own content stays yours.
