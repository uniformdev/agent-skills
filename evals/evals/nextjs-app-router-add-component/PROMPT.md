This Next.js project is already integrated with Uniform CMS and renders `page` and `hero` components.

Content editors have modeled a new component in Uniform and need it supported in the app:

- Component type `feature_list`: has a `heading` text parameter and a `features` slot that holds `feature` components.
- Component type `feature`: has `title` and `description` text parameters.

Add support for both component types so compositions using them render correctly, following the conventions already used in this project. The heading and titles should be editable inline in Uniform's visual editor. Keep all existing components working.
