# Backlog

Open work, open questions and ideas. Rules belong in `docs/Zoopedia_Finder_Rules.md`; when an
item is done, record it in the rule spec change log and delete it here. Nothing here is
approved work: new features need Paul's yes first.

---

## Test bar

1. **Pure-logic assertion suite.** The house bar is an extracted pure-logic block with its
   own assertion suite. Here the planner logic (`tierOf`,
   `ecoSlug`, `parseReq`, `evaluate`, `wavesFor`, `parsePlan`) sits among the UI code and is
   reached only through the DOM by the smoke test, whose expected values came from the page
   itself. Proposal: a marked `PURE-LOGIC` block plus `tests/logic.test.js`, characterisation
   tests first, then cases with expected values taken from wikily pages or Paul's play. It is a
   refactor of working code, so its own CR. **Needed before the first change to a planner
   rule.**
2. **Build drift check.** Nothing stops a commit whose `dist/` differs from what the build
   produces (for example a hand edit). A check that builds to a temporary file and compares
   would catch it.

## Open questions — need Paul or game evidence

3. Does a role count **reserve-wide** once any released animal fills it, or must the animal live
   inside that ecosystem's area? (rule spec §5.6, assumption 1)
4. Should `Montane Forest` in Sweden mean `Montane Forest (Boreal)`? (§5.6, assumption 4)
5. Career scenario gifts are not modelled. Worth modelling?
6. **Save plan file** has not been tried in the live artifact viewer. Paul: Reserve planner →
   Export plan → Save plan file, and say whether the save prompt appeared.
7. Should exported plans include the species-tab filters? Undecided.

## Data refresh

8. The wikily release-groups index lists only 100 species (pagination not solved);
    `wikily.console.js` adds the rest from `EXTRA_SLUGS`. A new species past the first 100 must
    be added there by hand.
9. `zoopedia.console.js` and `wikily.console.js` have not run end to end in their assembled
    form. Check the output the first time.

## Noticed in the R1.0.0 read-through (21 Oct 2026), not fixed

10. Plan import skips a reserve whose value is not a list without naming it in the "skipped"
    message. Harmless for files this page wrote.
11. Plan import does not check `version`. Correct while only version 1 exists; it must once a
    version 2 does.
12. `build.py` writes with `Path.write_text`, which turns line endings into CRLF on Windows: a
    build there would differ from the committed LF files. Pass `newline="\n"` if the build is
    ever run on Windows.

## Ideas (not requested)

13. Put the page's R-version into exported plans as an extra field (import ignores unknown
    fields, so it would stay `version: 1`), so a plan can be traced to the build that wrote it.
