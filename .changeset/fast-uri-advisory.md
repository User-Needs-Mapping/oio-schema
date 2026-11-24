---
"@user-needs-mapping/oio-schema": patch
---

Update `fast-uri`, which the validator uses through `ajv`, from 3.1.7 to 3.1.9. This fixes
GHSA-333x-w4r6-6crp (scheme injection through an unescaped colon in a suffix reference) and
four other advisories in the same version range. Nothing that validates changes.
