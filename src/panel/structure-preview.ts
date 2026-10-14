/**
 * “Structure preview”: the page rebuilt from its HTML structure only, shown in a sandboxed frame (no script, no network)
 * to judge by eye whether headings, paragraphs, lists, tables and landmarks tell the story of the page.
 */
export interface StructureData {
  title: string
  lang: string
  html: string
  headings: number
  loose: number
  truncated: boolean
}

const STYLE = `
:root{color-scheme:light}
body{font:16px/1.55 Georgia,'Times New Roman',serif;color:#1f2937;max-width:760px;margin:0 auto;padding:16px 20px}
h1,h2,h3,h4,h5,h6{font-family:system-ui,sans-serif;line-height:1.25;margin:1.2em 0 .4em;color:#111827}
h1{font-size:2em;border-bottom:3px solid #1d4ed8;padding-bottom:.2em}h2{font-size:1.5em}h3{font-size:1.25em}h4,h5,h6{font-size:1.05em}
h1::before,h2::before,h3::before,h4::before,h5::before,h6::before{font:700 11px system-ui,sans-serif;background:#1d4ed8;color:#fff;border-radius:3px;padding:1px 5px;margin-right:8px;vertical-align:middle}
h1::before{content:'H1'}h2::before{content:'H2'}h3::before{content:'H3'}h4::before{content:'H4'}h5::before{content:'H5'}h6::before{content:'H6'}
p{margin:.7em 0}ul,ol,dl{margin:.7em 0;padding-left:1.6em}
table{border-collapse:collapse;margin:1em 0;font-family:system-ui,sans-serif;font-size:14px}th,td{border:1px solid #cbd5e1;padding:4px 8px}th{background:#e2e8f0}caption{font-weight:600;text-align:left;padding:4px 0}
.lm{border:1px dashed #94a3b8;border-radius:8px;margin:12px 0;padding:8px 12px;position:relative;background:#f8fafc}
.lmtag{display:inline-block;font:600 11px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;color:#475569;background:#e2e8f0;border-radius:3px;padding:1px 6px;margin-bottom:6px}
.link{color:#1d4ed8;text-decoration:underline}.btn{display:inline-block;font:14px system-ui,sans-serif;border:1px solid #64748b;border-radius:6px;padding:1px 8px;background:#fff}
.field{font:13px ui-monospace,monospace;border-bottom:1px solid #64748b;background:#f1f5f9;padding:0 4px}
.img,.frame{display:inline-block;font:12px system-ui,sans-serif;background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;border-radius:4px;padding:0 6px}
.bad,.img.bad{background:#fef2f2;color:#b91c1c;border-color:#fca5a5;font-style:normal}
.loose{background:#ffedd5;border-bottom:2px solid #ea580c}
`

/** The sandboxed document shown in the frame of the reading page. */
export function structureDocument(data: StructureData): string {
  const lang = data.lang.replace(/[^a-zA-Z-]/g, '').slice(0, 12)
  return `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head><meta charset="utf-8"><title></title><style>${STYLE}</style></head><body>${data.html}</body></html>`
}
