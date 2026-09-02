Our product data lives in a PIM, and our marketing site content lives in Uniform. Today someone re-types product changes into Uniform by hand and it is always out of date.

The PIM can call out to a URL whenever a product changes. It sends a POST with a JSON body like `{ "sku": "AB-1234", "name": "Trail runner 2", "price": 129.95, "description": "..." }` and a shared secret in an `x-pim-secret` header. We want Uniform to receive that call and create the matching `product` entry, or update it if we already have one for that SKU.

Two things matter to us:

- Anyone on the internet can hit that URL, so we must not trust a request until the shared secret checks out. The secret is stored as a secret in our Uniform project, under the name `PIM_WEBHOOK_SECRET`; don't put its value in the code.
- The PIM can send the same change more than once, and we must not end up with duplicate products.

This has to run inside Uniform. We don't want to stand up or operate a server of our own for it.

Uniform credentials for the project are already in `.env`.

Write the code only — do not push, publish or deploy anything to our Uniform project, and do not run any CLI command that would. We'll review it first.

Do not ask questions — make reasonable decisions and build it.
