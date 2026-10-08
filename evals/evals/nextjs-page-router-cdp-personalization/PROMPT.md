We use Segment as our CDP (Unify and the Profile API are enabled on our workspace) and want this
site to personalize in Uniform based on what Segment knows about each visitor. Segment's
analytics.js is loaded through our tag manager, so visitors already carry the usual Segment
cookies. The site has no logins.

Marketing wants to target these in Uniform personalization rules:

- the audience `high_intent_golfers` (built with anonymous visitors included)
- the computed trait `lifetime_value`, the visitor's total spend in US dollars
- the computed trait `favorite_category`, one of `golf`, `tennis` or `running`

In production the Segment space ID and access token will come from environment variables. We
have no Segment credentials for local development or for sales demos, so we also need to run the
site locally and switch between a few visitor profiles to show the page changing.

Set up whatever Uniform needs so authors can target these, but do not push anything to our
Uniform project — I'll run that myself; tell me what to run. Don't stop to ask questions: make the
choices you would recommend and list them at the end, and make sure the project still type-checks.
