# Domain Docs

## Layout

This is a single-context repository:

- `GLOSSARY.md` at the repository root defines domain vocabulary.
- `docs/adr/` contains architecture decision records.

## Before exploring

Read the glossary and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their absence
or suggest creating them upfront. Create them lazily when domain terms
or decisions are resolved.

## Use the glossary's vocabulary

Use established glossary terms in issue titles, proposals, hypotheses,
and test names. Avoid synonyms the glossary explicitly rejects.

If a concept is missing, reconsider whether it belongs to the domain;
otherwise note the gap for later domain modeling.

## Flag ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR,
and explain why that decision should be reconsidered.
