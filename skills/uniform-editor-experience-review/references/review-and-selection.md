# Reporting findings and choosing what to fix

The report and the question that follows it use the same grouping, **category → fix type →
findings**, defined in [review-checks.md](review-checks.md#fix-types).

## The report

In chat by default. Write it to a file when the user asks for one, or offer to when it runs long.

```markdown
# Editor experience review

<SDK> (`<package>` <version>) · <N> components reviewed · <N> findings, <N> of them live-site bugs

## <Category>

### <Fix type> — recommended
- **<Component>** · `<file>:<line>` · <check ID> — <what the author sees or cannot do in Canvas>.
  Fix: <the change in one sentence, and what the live site keeps>.

### <Fix type> — recommended · changes the live site
- **<Component>** · `<file>:<line>` · <check ID> — <what visitors get today>. Fix: <the change>.

## No findings
<Components> — reviewed; nothing to change.

## Needs a manual check
- **<Component or setting>** · <check ID> — <what the user has to decide or confirm, and why>.
```

Rules for the report:

- **One bullet per component per check.** Component, `file:line`, check ID.
- **Symptom first, in the author's terms**: what they see or cannot do in Canvas. Then the fix in
  one sentence. The code-level cause belongs in the fix, not the headline.
- **Mark live-site bugs** in the fix-type heading.
- **List the components with no findings.**
- **Omit empty categories and fix types.** No "Slots: nothing found" sections.
- Findings the agent should not decide or cannot confirm from code alone (E7, a hide-when-empty
  guard that also hides visible content, preview viewport settings, anything that needs a running
  Canvas) go under *Needs a manual check*, not into a fix type.

## Asking which fixes to apply

### With a multi-select question tool

Where the agent has a structured question tool with multi-select (Claude Code's `AskUserQuestion`),
ask in one call:

- **One question per category** that has findings, in the order Empty states, Slots, Interactive,
  Playground — at most four, which is the tool's per-call limit.
- **One option per fix type** with findings, at most four per question. If a category ever has
  more, merge the two smallest.
- **Label**: the fix type, with "(Recommended)" appended when its default is recommended. **Description**:
  the components it touches and what changes for the author.
- **Name what a fix depends on** in its description, so the user decides with it in view: on the
  App Router, following the selection relies on an internal Canvas message; on the Page Router,
  the pattern frame relies on the experimental `decorators` prop.
- **Header**: the category name, 12 characters or fewer.
- A question needs at least two options. When a category has a single fix type, add `Not now`.

```json
{
  "questions": [
    {
      "question": "Which <category> fixes should I apply?",
      "header": "<Category>",
      "multiSelect": true,
      "options": [
        { "label": "<Fix type> (Recommended)", "description": "<components> — <what changes for the author>" },
        { "label": "<Fix type> (Recommended)", "description": "<components> — <what changes>; <what it depends on, if anything>" }
      ]
    }
  ]
}
```

An answer may include free text under "Other". Read it as instructions ("only this component",
"skip that one for now") and adjust the selection before applying.

### Without one

Agents with no structured question tool, or a user who prefers typing, get a numbered list after the
report. `[x]` marks the recommended defaults:

```markdown
Reply with the numbers to apply, `recommended`, or `all`:

1. [x] <Fix type> — <components>
2. [x] <Fix type> — <components> (<what it depends on, if anything>)
3. [x] <Fix type> — <components> (changes the live site)
```

### When not to ask

| The user said | Do |
|---|---|
| Fix it / apply everything / don't stop to ask | Skip the question. Apply every fix type whose default is recommended, then report what you applied and what you left out |
| Review only / don't change code / I want to decide | Write the report, end it with the numbered list, and stop. Change no code |
| Fix one named thing ("make the carousel editable") | Scope the review to that component, and apply without asking unless the fix reaches beyond it |

## Applying the selection

1. **Foundations the selection needs, first**: the gate helpers, the App Router empty-placeholder
   resolver, the App Router selection hook, per the table in
   [review-checks.md](review-checks.md#fix-types). Reuse the project's own if it has them.
2. **Each selected fix type**, across all the components it lists, with the fix in the linked
   reference.
3. **Nothing else.** Unselected findings stay in the report as open items; do not fix them in
   passing, even when you are in the same file.

## The closing report

- **Applied**: fix type, components, files.
- **Left open**: the fix types not selected, still listed so they are not lost, and the manual
  checks.
- **Verify**: the result of the [live-site comparison](review-checks.md#the-live-site-looks-the-same),
  or why it could not run, and the Canvas checklist items that still need a human in Canvas
  ([review-checks.md](review-checks.md#check-in-canvas)).
