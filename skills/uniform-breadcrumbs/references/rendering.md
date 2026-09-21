# Rendering

The trail module returns data; this is what to do with it. Nothing here is Uniform-specific
except where the crumb shape shows through, so adapt it to the project's design system rather
than copying the class names.

The examples are React with `next/link` because they have to import something. Swap in whatever
the project already uses for links and for the site's absolute URL — the semantics below are the
part that matters, and none of them depend on the framework.

## Contents

- [The component](#the-component)
- [Accessibility rules](#accessibility-rules)
- [Separators](#separators)
- [The home crumb](#the-home-crumb)
- [Deep trails](#deep-trails)
- [BreadcrumbList structured data](#breadcrumblist-structured-data)

## The component

```tsx
// components/BreadcrumbsView.tsx
import Link from 'next/link';
import type { Crumb } from '@/lib/breadcrumbs/trail';

export function BreadcrumbsView({
  crumbs,
  label = 'Breadcrumb',
}: {
  crumbs: Crumb[];
  label?: string;
}) {
  // A trail with only the current page in it is noise. So is an empty one.
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label={label} className="breadcrumbs">
      <ol>
        {crumbs.map((crumb) => {
          const current = crumb.isCurrent ? ('page' as const) : undefined;
          return (
            <li key={crumb.id}>
              {crumb.href ? (
                <Link href={crumb.href} aria-current={current}>
                  {crumb.title}
                </Link>
              ) : (
                <span aria-current={current}>{crumb.title}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

`crumb.id` is the project map node id, so it is stable when an author renames a node — which
`title` and `href` are not. Use it as the key.

## Accessibility rules

| Rule | Why |
|---|---|
| Wrap in `<nav aria-label="Breadcrumb">` | A page usually has several landmarks; the label is what distinguishes this one. Do not include the word "navigation" — the role already says it |
| Use `<ol>`, not `<ul>` or a row of `<div>`s | The order is the meaning. Assistive tech announces position and count from it |
| One `<li>` per crumb, including non-linked ones | Dropping placeholder levels breaks "3 of 5" |
| `aria-current="page"` on the last crumb only | The literal string `"page"`; `aria-current="true"` is weaker and `aria-current` on every crumb is wrong |
| Never make the current page a link | A link to the page you are on is a dead control |
| Separators must not reach the accessibility tree | Otherwise every crumb is announced as "slash" |
| Do not add `role="navigation"` or `role="list"` | Redundant with `<nav>` and `<ol>`, and an explicit `role="list"` is only needed when CSS `list-style: none` strips semantics in Safari |

If a design calls for the trail to be visually hidden on small screens, hide it with CSS, not by
returning `null` — the structured data and the landmark should still be there.

## Separators

Render them from CSS so they never become content:

```css
.breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
}

.breadcrumbs li + li::before {
  /* The "/ ''" half sets empty alternative text, keeping the glyph out of the
     accessibility tree in browsers that expose generated content. */
  content: '/' / '';
  padding: 0 0.5em;
}
```

If the design needs an icon rather than a glyph, use an inline SVG with `aria-hidden="true"` and
`focusable="false"` inside the `<li>` instead — an `<img>` separator needs `alt=""` for the same
reason. Do not put the separator inside the anchor; it becomes part of the link text.

## The home crumb

The trail's first node is the project map root (`/`). Two things decide how to render it:

- Its `name` is whatever the author called the root — often the site name, rarely "Home". Pass
  `rootTitle` to override the label in the trail rather than renaming the node; the name is how
  authors find it in the project map tree.
- A project map root with no composition attached comes back as `type: "placeholder"`, and
  `hrefFor` correctly refuses to link it. Whether to then show an unlinked home crumb, drop it
  with `includeRoot: false`, or attach a composition to the root is a project decision — the one
  option that is always wrong is linking `/` unconditionally, which ships a 404 into every page.

Replacing the label with an icon is fine as long as the link keeps an accessible name
(`aria-label` on the anchor, `aria-hidden` on the glyph).

## Deep trails

Two approaches, and the choice is not cosmetic:

**Ellipsis on overflow — the default.** No crumb is removed, nothing is hidden from assistive
tech or from crawlers, and no JavaScript is involved.

```css
.breadcrumbs li {
  min-width: 0;
}
.breadcrumbs li:not(:first-child):not(:last-child) a {
  display: block;
  max-width: 12ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Collapse the middle.** Worth the complexity past roughly five levels, and only then. Build it
as a disclosure: keep every crumb in the DOM, hide the middle ones while collapsed, and give the
toggle an accessible name that says what it reveals ("Show 3 more levels") rather than an
ellipsis with no name. Always keep the home crumb and the last two visible.

Do not truncate by slicing the array on the server. The crumbs you drop are also dropped from
the structured data, and a crawler then sees a different hierarchy than the one that exists.

## BreadcrumbList structured data

Emit it once per page, from the same array the component renders.

```tsx
// components/BreadcrumbsJsonLd.tsx
import type { Crumb } from '@/lib/breadcrumbs/trail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;

export function BreadcrumbsJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  // `item` is required on every entry except the last one. A placeholder ancestor — or a
  // crumb whose path still held a ":token" — has no URL to put there, and inventing one
  // ships a 404 into the markup. Drop those entries and renumber, or the whole list is
  // invalid. This is the one place the structured data may legitimately be shorter than
  // the visible trail; see the note below.
  const entries = crumbs.filter((crumb, index) => crumb.href || index === crumbs.length - 1);
  if (entries.length < 2) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.title,
      // Absolute everywhere it appears; omitted only on the last entry.
      ...(crumb.href ? { item: new URL(crumb.href, SITE_URL).toString() } : {}),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

Rules that make the difference between valid and ignored markup:

| Rule | Consequence of breaking it |
|---|---|
| `position` starts at 1 and increments by 1 with no gaps | The list is rejected |
| **`item` is required on every entry except the last** | An entry without it invalidates the list — and a trail through a placeholder ancestor hits this on ordinary pages, not edge cases. Filter, then renumber |
| `item` must be an absolute URL | Relative hrefs are dropped; `new URL(href, SITE_URL)` handles it |
| Omit `item` on the final entry (or point it at the canonical URL of the current page) | Self-referencing a dynamic URL with query strings splits it from the canonical |
| Do not mark up crumbs the user cannot see | Adding levels that are not on screen is spam under Google's structured-data policy |

**On the visible trail and the structured data diverging.** The rule that matters is
directional: never mark up more than is visible. Fewer is tolerated, and here it is forced —
a grouping level has no URL, so it cannot be a non-final `ListItem`, and the alternatives are
an invalid list or a fabricated href. Keep the level in the rendered `<ol>`, where it is real
hierarchy the reader should see, and drop it from the JSON-LD.
| Emit one `BreadcrumbList` per trail | Two trails on a page means two separate `BreadcrumbList` objects, not one merged list |

`dangerouslySetInnerHTML` is the correct way to emit JSON-LD in React — a `{JSON.stringify(...)}`
child gets HTML-escaped and the block silently stops parsing. Serialize values you do not
control (an author-supplied title containing `</script>`) with a serializer that escapes `<`, or
strip it before rendering.
