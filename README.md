# RGAA Assistant — Images (Theme 1)

AI-assisted RGAA 4.1 auditor. This first slice covers **Theme 1 (Images)
only** — criteria 1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 1.9.

It's a Chrome extension (Manifest V3, TypeScript, Vite + `@crxjs/vite-plugin`)
that:

1. Numbers every `<img>` on the current page with a red box (content script:
   [`src/content/inject.ts`](src/content/inject.ts)) and builds a matching
   JSON element list (alt text, aria-label, nearby text, whether it's inside
   a link, a few deterministic checks).
2. Assembles the RGAA Theme 1 audit prompt for that element list
   ([`src/lib/ai-client.ts`](src/lib/ai-client.ts) +
   [`src/lib/prompt-template.ts`](src/lib/prompt-template.ts)) and copies it
   to the clipboard.

**v0.1 makes no AI API call.** The popup's "Copy AI prompt" button copies
the ready-to-paste prompt text (system instructions + `Elements: [...]`) so
you can test it manually: screenshot the numbered page, paste the
screenshot into a chat UI, then paste the copied prompt after it. Wiring an
actual model call in behind `ai-client.ts` is the next step once that manual
flow checks out.

## Develop

```bash
npm install
npm run dev
```

Then load the `dist/` folder as an unpacked extension at
`chrome://extensions` (enable Developer mode first).

## Use

1. Open the popup on any page.
2. Click **Number images on page** — red numbered boxes appear over every
   image, and the matching element list renders in the popup.
3. Take a screenshot of the page (boxes included).
4. Click **Copy AI prompt**, then paste the screenshot and the prompt (in
   that order) into a chat UI.
5. **Clear highlights** removes the boxes when you're done.

## Scope

This repo intentionally covers Theme 1 (Images) only, as a standalone
proof of concept for the AI-assisted audit workflow, separate from the
rule-based engine in the `25-rgaa-extension` project.
