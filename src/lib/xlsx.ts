import { strToU8, zipSync } from 'fflate'

export type StyleKey = 'default' | 'title' | 'head' | 'wrap' | 'crit' | 'C' | 'NC' | 'NA' | 'NT' | 'code'
export interface Cell {
  v: string | number
  s?: StyleKey
  /** Preview shown in the browser view. */
  image?: string
  /** Key used to find the thumbnail to embed in the .xlsx. */
  imageId?: number
}
export interface SheetImage {
  row: number
  col: number
  png: Uint8Array
  width: number
  height: number
  label: string
}
export type CellInput = string | number | Cell | null | undefined
export interface Sheet {
  name: string
  widths: number[]
  rows: CellInput[][]
  /** Cell range (e.g. "D4:D12") that gets a C / NC / NA / NT dropdown. */
  statusValidation?: string
  freezeRow?: number
  images?: SheetImage[]
  /** Row height in points, by 0-based row index. */
  rowHeights?: Record<number, number>
}

const STYLE_INDEX: Record<StyleKey, number> = { default: 0, title: 1, head: 2, wrap: 3, crit: 4, C: 5, NC: 6, NA: 7, NT: 8, code: 9 }

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

const colName = (i: number) => {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="10"/><name val="Consolas"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F3A8A"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC6F6D5"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFED7D7"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDF2F7"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEFCBF"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFC5D2"/></left><right style="thin"><color rgb="FFBFC5D2"/></right><top style="thin"><color rgb="FFBFC5D2"/></top><bottom style="thin"><color rgb="FFBFC5D2"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`

function cellXml(input: CellInput, row: number, col: number): string {
  if (input === null || input === undefined || input === '') return ''
  const cell: Cell = typeof input === 'object' ? input : { v: input }
  const ref = `${colName(col)}${row + 1}`
  const s = STYLE_INDEX[cell.s ?? 'default']
  const style = s ? ` s="${s}"` : ''
  return typeof cell.v === 'number'
    ? `<c r="${ref}"${style}><v>${cell.v}</v></c>`
    : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.v))}</t></is></c>`
}

function sheetXml(sheet: Sheet): string {
  const cols = sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const rows = sheet.rows
    .map((r, ri) => {
      const ht = sheet.rowHeights?.[ri]
      const attrs = ht ? ` ht="${ht}" customHeight="1"` : ''
      return `<row r="${ri + 1}"${attrs}>${r.map((c, ci) => cellXml(c, ri, ci)).join('')}</row>`
    })
    .join('')
  const pane = sheet.freezeRow
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : ''
  const validation = sheet.statusValidation
    ? `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${sheet.statusValidation}"><formula1>"C,NC,NA,NT"</formula1></dataValidation></dataValidations>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}<cols>${cols}</cols><sheetData>${rows}</sheetData>${validation}${sheet.images?.length ? '<drawing r:id="rId1"/>' : ''}</worksheet>`
}

const EMU = 9525
const OFFSET = 3 * EMU

function drawingXml(images: SheetImage[]): string {
  const anchors = images
    .map((img, i) => {
      const cx = img.width * EMU
      const cy = img.height * EMU
      return `<xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>${OFFSET}</xdr:colOff><xdr:row>${img.row}</xdr:row><xdr:rowOff>${OFFSET}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Image ${i + 1}" descr="${esc(img.label)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`
}

const safeName = (n: string) => n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${esc(safeName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  let drawingCount = 0
  let mediaCount = 0
  const drawingOverrides: string[] = []
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet))
    if (!sheet.images?.length) return
    drawingCount++
    files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingCount}.xml"/></Relationships>`,
    )
    files[`xl/drawings/drawing${drawingCount}.xml`] = strToU8(drawingXml(sheet.images))
    const rels = sheet.images.map((img, k) => {
      mediaCount++
      files[`xl/media/image${mediaCount}.png`] = img.png
      return `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${mediaCount}.png"/>`
    })
    files[`xl/drawings/_rels/drawing${drawingCount}.xml.rels`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`,
    )
    drawingOverrides.push(`<Override PartName="/xl/drawings/drawing${drawingCount}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)
  })
  files['[Content_Types].xml'] = strToU8(new TextDecoder().decode(files['[Content_Types].xml']).replace('</Types>', `${drawingOverrides.join('')}</Types>`))
  return zipSync(files)
}
