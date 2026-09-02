Our editorial team reviews blog posts in a Uniform workflow before they go live. Right now a human copy-edits every post, and we want an AI to do the first pass.

When an editor moves a post into our "AI Review" stage, the AI should read the post and decide whether it is publishable — no placeholder or lorem-ipsum text, no obvious truncation, no grammar or clarity problems. If it passes, move the post on to "Ready to publish". If it doesn't, move it to "Needs work" so the writer can see it came back.

This has to run inside Uniform, in reaction to the editor's action. We don't want to stand up or operate any infrastructure of our own for it, and nobody should have to press a button to kick it off.

IDs in our project:

- workflow: `3f6b0f9e-1c2a-4d5b-8e7f-9a0b1c2d3e4f`
- "AI Review" stage: `a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d`
- "Ready to publish" stage: `b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e`
- "Needs work" stage: `c3d4e5f6-7a8b-4c9d-0e1f-2a3b4c5d6e7f`

Uniform credentials for the project are already in `.env`.

Write the code only — do not push, publish or deploy anything to our Uniform project, and do not run any CLI command that would. We'll review it first.

Do not ask questions — make reasonable decisions and build it.
