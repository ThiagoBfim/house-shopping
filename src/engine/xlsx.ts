// Gera um .xlsx de uma planilha só, sem dependências: o arquivo é um zip (sem compressão)
// com os XML mínimos do formato Office Open XML.

export type Cell =
  | { text: string; bold?: boolean }
  | { number: number; format?: 'money' | 'int'; bold?: boolean }
  | { link: string; text?: string }
  | { formula: string; value: number; format?: 'money'; bold?: boolean }
  | null

export interface Sheet {
  /** Nome da aba (até 31 caracteres, sem []:*?/\). */
  name: string
  /** Largura de cada coluna, em caracteres. */
  widths: number[]
  /** A primeira linha é o cabeçalho (fica congelado ao rolar). */
  rows: Cell[][]
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Estilos (índices de cellXfs em styles.xml).
const STYLE = { plain: 0, bold: 1, money: 2, moneyBold: 3, link: 4, int: 5 }

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

/** Escapa texto para XML e remove caracteres de controle (inválidos no XML). */
export function escapeXml(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- remover controles é justamente o objetivo
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  )
}

const inlineText = (ref: string, style: number, text: string) =>
  `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`

function sheetXml(sheet: Sheet): { xml: string; links: string[] } {
  const links: string[] = []
  const hyperlinks: string[] = []
  const rows = sheet.rows.map((cells, r) => {
    const xml = cells.map((cell, c) => {
      if (!cell) return ''
      const ref = `${columnName(c)}${r + 1}`
      if ('link' in cell) {
        links.push(cell.link)
        hyperlinks.push(`<hyperlink ref="${ref}" r:id="rId${links.length}"/>`)
        return inlineText(ref, STYLE.link, cell.text ?? cell.link)
      }
      if ('text' in cell) return inlineText(ref, cell.bold ? STYLE.bold : STYLE.plain, cell.text)
      const style =
        cell.format === 'money'
          ? cell.bold
            ? STYLE.moneyBold
            : STYLE.money
          : 'format' in cell && cell.format === 'int'
            ? STYLE.int
            : cell.bold
              ? STYLE.bold
              : STYLE.plain
      if ('formula' in cell) {
        return `<c r="${ref}" s="${style}"><f>${escapeXml(cell.formula)}</f><v>${cell.value}</v></c>`
      }
      return `<c r="${ref}" s="${style}"><v>${cell.number}</v></c>`
    })
    return `<row r="${r + 1}">${xml.join('')}</row>`
  })
  const cols = sheet.widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('')
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    (hyperlinks.length ? `<hyperlinks>${hyperlinks.join('')}</hyperlinks>` : '') +
    `</worksheet>`
  return { xml, links }
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>` +
  `<fonts count="3">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="6">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

/** Planilha → bytes do arquivo .xlsx. */
export function xlsx(sheet: Sheet): Uint8Array<ArrayBuffer> {
  const { xml, links } = sheetXml(sheet)
  const name = escapeXml(sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))
  const rel = (id: string, type: string, target: string, external = false) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${escapeXml(target)}"${external ? ' TargetMode="External"' : ''}/>`
  const rels = (items: string[]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`

  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    ],
    ['_rels/.rels', rels([rel('rId1', 'officeDocument', 'xl/workbook.xml')])],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      rels([
        rel('rId1', 'worksheet', 'worksheets/sheet1.xml'),
        rel('rId2', 'styles', 'styles.xml'),
      ]),
    ],
    ['xl/styles.xml', STYLES_XML],
    ['xl/worksheets/sheet1.xml', xml],
  ]
  if (links.length) {
    files.push([
      'xl/worksheets/_rels/sheet1.xml.rels',
      rels(links.map((url, i) => rel(`rId${i + 1}`, 'hyperlink', url, true))),
    ])
  }
  return zip(files.map(([path, content]) => [path, new TextEncoder().encode(content)]))
}

// Zip "stored" (sem compressão): suficiente para planilhas pequenas e sem dependências.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function zip(files: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  // 1980-01-01 00:00 (data fixa: o mesmo conteúdo gera o mesmo arquivo)
  const [time, date] = [0, (0 << 9) | (1 << 5) | 1]

  for (const [path, data] of files) {
    const name = encoder.encode(path)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + end.length)
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}
