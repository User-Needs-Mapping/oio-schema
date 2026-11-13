# Licensing status

**This repository is licensed under the Apache License, Version 2.0.** [`LICENSE`](LICENSE)
holds the unmodified licence text, and [`NOTICE`](NOTICE) holds the attribution that must be
carried with the work.

The licence was held back until one question was answered: whether the structural schema,
which was derived from someone else's schema, was this repository's to license. It has been
answered by the author of that schema, and his grant is recorded below.

## The grant

**From:** Kristian Zachariassen, author of the original User Needs Mapping (UNM) schema
**To:** Rich Allen, maintainer of this repository
**Form:** email
**Recorded here:** 2026-11-13

The operative wording, quoted from the email:

> I'm happy for the OIO schema to be published under Apache 2.0, including the parts of its
> structure derived from my original UNM schema.
>
> I'm also happy for Fast Flow Toolkit to retain and distribute the vendored
> unm-schema.json used by the oio-to-unm converter.
>
> For clarity, I grant permission for the original UNM schema represented by that vendored
> schema, and derivatives of that schema incorporated into OIO, to be used, modified and
> distributed under the Apache License 2.0.
>
> That grant is specifically for the UNM schema/interchange model and its derivatives. It
> doesn't apply to the rest of the former UNM Platform codebase or the current PLENIOR
> product/codebase.

And on attribution, asked for and agreed:

> “Based in part on the original User Needs Mapping (UNM) schema by Kristian Zachariassen,
> used with permission.”

### What it covers

| | Covered? |
|---|---|
| OIO's structure, including the parts derived from the UNM schema | **Yes**, under Apache 2.0 |
| The original UNM schema as represented by Fast Flow Toolkit's vendored `unm-schema.json` | **Yes**, under Apache 2.0 |
| Fast Flow Toolkit retaining and distributing that vendored copy | **Yes**, expressly |
| The rest of the former UNM Platform codebase | **No** |
| The PLENIOR product or codebase | **No** |

### What it asks for

Keep the attribution. It is in [`NOTICE`](NOTICE), which Apache 2.0 §4(d) requires anyone
redistributing this work to carry with it, and `package.json` lists `NOTICE` among the files
the package ships. A test fails if the attribution is removed or reworded.

Fast Flow Toolkit's vendored copy should carry the same attribution beside it. That is a
change in that repository, not this one.

## History

Kept because it explains why the licence arrived when it did, and what was checked.

**The derivation.** The repository's first commit (`b109b62`) added `schemas/unm-schema.json`,
not an OIO file, and the current schema descends from it. That commit was 72% byte-identical
to Fast Flow Toolkit's vendored copy of the UNM schema, with the definitions corresponding
one for one (`actor`→`user`, `service`→`technicalSystem`, and the distinctive short-form /
long-form `relationship` construct carried across). The maintainer confirmed on 2026-09-09
that the UNM schema was Kristian's own work for his UNM Platform product, and that OIO was
written to interchange with Fast Flow Toolkit while staying mappable to it.

**The upstream licence.** `github.com/krzachariassen/unm-platform` had stopped resolving by
September 2026, so its licence could not be read. Kristian has since confirmed from the
repository's history that it carried a `LICENSE` file from 25 March 2026, and that the
licence was all-rights-reserved, not a permissive one. Rather than establish when the schema
was originally fetched relative to that date, he granted the permission above, which makes
the question moot.

**The rewrite.** On 2026-09-09, before the grant, every schema description that shared
wording with the UNM original was rewritten — 52 descriptions across both schema files,
taking byte-identical descriptions and shared runs of eight or more words to zero. Only prose
changed; no property, type, `enum`, `required` or `additionalProperties` value moved. That
work stands, but it is no longer what the licence rests on. The grant is.

**Contributors.** At the time the licence was applied, every commit in this repository's
history was by one author, so no other contributor's agreement was needed.

**Third-party code.** None is vendored. `ajv` (MIT) and `yaml` (ISC) are declared
dependencies, not copied into the tree.

## Copyright holder

**Not yet asserted.** No copyright line has been added to any file, and `NOTICE` carries none.

Git authorship establishes who wrote the commits. It does not establish who owns the
copyright: the work may have been done personally or for a company, and only the parties
involved know which. Naming a holder on the strength of a git log would record a guess as a
fact. The licence is in effect without one; a copyright line can be added to `NOTICE` once
the holder is confirmed.

The `Copyright [yyyy] [name of copyright owner]` line inside the `LICENSE` appendix is the
standard illustrative placeholder from the official text. It is the licence's instruction
to its users, not this project's copyright notice, and it stays as it is.

## Scope of the licence

Apache 2.0 covers **this repository's material**: the schemas, the validation tooling, the
tests, the examples and the documentation.

It does **not** reach a model you write. Creating, validating or exchanging an `.oio.yaml`
document that conforms to this schema does not make your model a derivative work of the
schema, and puts no licence obligation on your own organisational data. A schema describes
a shape; conforming to a shape is not copying the description of it.

The one thing to watch: if you copy text out of the files in [`examples/`](examples/) into
your own document, you are copying this repository's material, and the licence applies to
what you copied. Your own content stays yours.
