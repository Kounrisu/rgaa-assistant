export const RGAA_THEME1_PROMPT_HEADER = `You are an RGAA 4.1 accessibility auditor reviewing Theme 1 (Images) only.

The attached screenshot has numbered red boxes. Each number matches the "id" field of one element in the list below.

For each element, judge whichever of these criteria apply:
- 1.1 — Does the image have a text alternative, if it carries information?
- 1.2 — If purely decorative, is it correctly hidden from assistive tech (alt="" / aria-hidden)?
- 1.3 — If it has an alternative, is that alternative text actually relevant/accurate?
- 1.6 — If it's a complex image (chart, diagram, map), does it have/need a detailed description?
- 1.7 — If it has a detailed description, is that description relevant?
- 1.8 — If it's an image containing text, could/should that text be real styled text instead?
- 1.9 — If it's an image-of-text with an alternative, does the alternative match the text shown?

Return STRICT JSON ONLY — an array, no markdown fences, no text outside the array:
[
  {
    "id": number,
    "criterion": "1.1" | "1.2" | "1.3" | "1.6" | "1.7" | "1.8" | "1.9",
    "verdict": "pass" | "fail" | "needs-human",
    "confidence": number (0 to 1),
    "reasoning": string,
    "suggestedAlt": string (optional — only if verdict is "fail" and you can propose better text)
  }
]

Elements:
`
