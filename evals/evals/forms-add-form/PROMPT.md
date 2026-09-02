This Next.js project is already integrated with Uniform CMS and renders `page` and `hero` components.

Marketing wants a newsletter signup form on the landing page: an email address field, a "Send me updates" checkbox, and a submit button. They've said they'll likely want to add more forms later (a contact form, an event RSVP) that reuse the same submission handling, and they want to be able to reorder or add fields to this form themselves without waiting on a deploy.

Build this as Uniform components, following the conventions already used in this project, plus whatever client-side and server-side code is needed to receive a submission. On a successful signup, mark the visitor as subscribed so the rest of the site can personalize content for them afterwards. Keep the existing `hero` and `page` components working.
