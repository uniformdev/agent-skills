# Submission

The endpoint that receives form posts, plus validation, spam handling, integrations, and personalization on submit.

## The contract

The container POSTs JSON to `/api/forms/submit`:

```json
{
  "formIdentifier": "contact-us",
  "composition": "composition-uuid",
  "fields": {
    "email":     { "label": "Email address",   "type": "email",    "value": "alice@example.com", "order": 0 },
    "message":   { "label": "Your message",    "type": "textarea", "value": "Hello",             "order": 1 },
    "subscribe": { "label": "Send me updates", "type": "checkbox", "value": "true",              "order": 2 }
  }
}
```

Three properties of this shape matter:

- **Fields are namespaced under `fields`.** A field an author names "form identifier" cannot clobber the form's own metadata.
- **Every value is a string.** Checkboxes are `"true"`/`"false"`, numbers are numeric strings. One shape to parse.
- **Each field carries its `label` and `order`.** A generic handler can build a readable email or a spreadsheet row without knowing which form it received.

**Write the handler generically.** Authors change the field set in Uniform's visual editor with no deploy. A handler that reads `body.fields.email` and ignores the rest will silently discard whatever an author adds tomorrow. Iterate `fields`; treat named fields as a small validated subset, not as the whole payload.

The container reads `message` off a non-2xx response and shows it to the user, so keep messages user-facing — never leak internal errors or stack traces into `message`.

## Rules for the handler

**Allow-list the forms.** `KNOWN_FORMS` is the difference between an endpoint that accepts your forms and one that accepts anything. It also gives you a place to keep the server-side required-field list per form.

**Never trust the client.** `required`, `inputType`, and any min/max are hints rendered into HTML. Re-check everything that matters server-side.

**Never log the payload.** Form submissions are personal data. Log the identifier and the error, not the values.

**Rate limit.** Add IP or session rate limiting (an edge middleware, a KV counter, or your platform's WAF) before this endpoint sees production traffic

**Handle Spam and malicious requests** consider a spam service, CAPTCHA or Turnstile like token. Validate and sanitise each item of input data before storing or sending it out.

**Respond quickly.** If delivery is slow (CRM APIs, SMTP), enqueue the submission and return 200 rather than holding the request open. A user staring at a disabled button for eight seconds will double-submit.
