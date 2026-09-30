# Reporting findings and choosing what to fix

The review ends in two things: a report the user can read on its own, and a choice of what to
apply. Both are built from the same grouping — **category → fix type → findings** — defined in
[review-checks.md](review-checks.md#fix-types).

## The report

In chat by default. Write it to a file when the user asks for one, or offer to when it runs long.

```markdown
# Editor experience review

App Router (`@uniformdev/next-app-router` 20.80) · 11 components reviewed · 14 findings, 2 of them live-site bugs

## Empty states

### Keep empty components visible — recommended
- **Button** · `components/Button.tsx:21` · E1 — a button with no label renders nothing in every
  mode, so a freshly dropped button vanishes and cannot be selected.
  Fix: render it in the Edit tab with its label placeholder; the live site keeps rendering nothing.

### Text and rich-text placeholders — recommended
- **RichText** · `components/RichText.tsx:14` · E5 — an empty body shows nothing in Canvas; this
  SDK never renders `UniformRichText`'s placeholder. Fix: an Edit-tab hint when the value is empty.

## Interactive

### Fix editing leaks — recommended · live-site bug
- **Tabs** · `components/TabsClient.tsx:31` · I7 — the tab labels are built with a hand-made
  editing marker, so they are `contentEditable` for every visitor. Fix: pass the child's real
  parameter; the SDK marks it editable only in the editor.

## No findings
Hero, Page — reviewed; nothing to change.

## Needs a manual check
- **Preview viewports** · P2 — the CLI could not reach the project; compare its viewports with the
  design system's breakpoints (Mobile 360, Tablet 768, Desktop 1280 today).
```

Rules for the report:

- **One bullet per component per check.** Component, `file:line`, check ID.
- **Symptom first, in the author's terms** — what they see or cannot do in Canvas. Then the fix in
  one sentence. The code-level cause belongs in the fix, not the headline.
- **Mark live-site bugs** in the fix-type heading. They change what visitors get today, which is a
  different kind of urgency from authoring comfort.
- **List the components with no findings.** It shows they were reviewed, not skipped.
- **Omit empty categories and fix types.** No "Slots: nothing found" sections.
- Findings the agent cannot confirm from code alone — viewport settings, anything that needs a
  running Canvas — go under *Needs a manual check*, not into a fix type.

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
- **Header**: the category name, 12 characters or fewer.
- A question needs at least two options. When a category has a single fix type, add `Not now`.

```json
{
  "questions": [
    {
      "question": "Which empty-state fixes should I apply?",
      "header": "Empty states",
      "multiSelect": true,
      "options": [
        { "label": "Keep empty components visible (Recommended)", "description": "Button, Hero CTA — shown with placeholders in the Edit tab; unchanged on the live site" },
        { "label": "Media placeholders (Recommended)", "description": "Image, Video — a placeholder the size of the media when no asset is set" },
        { "label": "Text and rich-text placeholders (Recommended)", "description": "RichText, Card — hints for empty text the editor otherwise hides" }
      ]
    },
    {
      "question": "Which interactive-component fixes should I apply?",
      "header": "Interactive",
      "multiSelect": true,
      "options": [
        { "label": "Keep hidden items mounted (Recommended)", "description": "Carousel, Tabs, Accordion — inactive items stay in the page so they can be selected" },
        { "label": "Stop motion while editing (Recommended)", "description": "Carousel — no autoplay in the Edit tab; Preview keeps it" },
        { "label": "Reach every item (Recommended)", "description": "Carousel, Tabs follow the Canvas selection; Accordion opens in the Edit tab" },
        { "label": "Fix editing leaks (Recommended)", "description": "Tabs — labels are contentEditable on the live site today" }
      ]
    }
  ]
}
```

An answer may include free text under "Other" — read it as instructions ("only the carousel",
"skip Tabs for now") and adjust the selection before applying.

### Without one

Agents with no structured question tool, or a user who prefers typing, get a numbered list after the
report. `[x]` marks the recommended defaults:

```markdown
Reply with the numbers to apply, `recommended`, or `all`:

1. [x] Keep empty components visible — Button, Hero CTA
2. [x] Media placeholders — Image, Video
3. [x] Text and rich-text placeholders — RichText, Card
4. [x] Keep hidden items mounted — Carousel, Tabs, Accordion
5. [x] Stop motion while editing — Carousel
6. [x] Reach every item — Carousel, Tabs, Accordion
7. [x] Fix editing leaks — Tabs (live-site bug)
8. [ ] Match preview viewports — project setting; needs CLI access
```

### When not to ask

| The user said | Do |
|---|---|
| Fix it / apply everything / don't stop to ask | Skip the question. Apply every fix type whose default is recommended, then report what you applied and what you left out |
| Review only / don't change code / I want to decide | Write the report, end it with the numbered list, and stop. Change no code |
| Fix one named thing ("make the carousel editable") | Scope the review to that component, and apply without asking unless the fix reaches beyond it |

## Applying the selection

1. **Foundations the selection needs, first** — the gate helpers, the App Router empty-placeholder
   resolver, the App Router selection hook — per the table in
   [review-checks.md](review-checks.md#fix-types). Reuse the project's own if it has them.
2. **Each selected fix type**, across all the components it lists, with the fix in the linked
   reference.
3. **Nothing else.** Unselected findings stay in the report as open items; do not fix them in
   passing, even when you are in the same file.

## The closing report

- **Applied** — fix type, components, files.
- **Left open** — the fix types not selected, still listed so they are not lost.
- **Verify** — the production diff result, and the Canvas checklist items that still need a human
  in Canvas ([review-checks.md](review-checks.md#check-in-canvas)).
