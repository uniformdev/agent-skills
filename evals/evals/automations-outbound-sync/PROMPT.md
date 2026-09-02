When we publish a product in Uniform, our search index never hears about it. Editors publish, then someone pastes the same fields into the search service by hand, and the index is always stale.

The search service is a plain HTTP API. To upsert a product you POST JSON to:

  https://search.internal.example.com/indexes/products

with an `Authorization: Bearer <key>` header. The body should be enough to find and display the product later (id, name, and whatever else the published entry carries). The API key is stored as a secret in our Uniform project under the name `SEARCH_API_KEY`; don't put its value in the code.

Only `product` entries matter. We publish other content too and the search index should not see those.

This has to run inside Uniform when the product is published. We don't want to stand up or operate a server of our own for it, and we don't want an editor to press a second button.

Uniform credentials for the project are already in `.env`.

Write the code only — do not push, publish or deploy anything to our Uniform project, and do not run any CLI command that would. We'll review it first.

Do not ask questions — make reasonable decisions and build it.
