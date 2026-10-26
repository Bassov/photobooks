# editor-command-sequence-pbt

Tag: prep
Milestone: M3
Title: property tests over command sequences (issue #50 item 2)
Status: done

## Scope

- [ ] fast-check model-based tests (`fc.commands`) over the editor command layer: random sequences of add / remove gallery, place, replace, swap, move, unplace, apply template and add / remove / move spread against a simple model; after every step the book parses, invariants hold (no dangling refs, every placed asset in the gallery) and placement counts match the model
- [ ] Shrunk failing sequences kept as regression cases; seed and `numRuns` for PR runs in `quality/gates.json`, a longer run nightly
- [ ] At most ~1000 changed lines; more command families go to the next checkbox (growth rule)
- **Done when:** a seeded bug in one op (a swap that drops a placement) is caught and shrunk to a minimal sequence, and the model is reusable by `document-history` for undo / redo sequences.
