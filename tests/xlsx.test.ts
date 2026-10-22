import { describe, expect, it } from 'vitest'
import { columnName, crc32, escapeXml, xlsx, zip } from '../src/engine/xlsx.ts'

/** Lê um zip "stored" pelo diretório central e confere o CRC de cada arquivo. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files: Record<string, string> = {}
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
    const localNameLength = view.getUint16(local + 26, true)
    const data = bytes.subarray(local + 30 + localNameLength, local + 30 + localNameLength + size)
    expect(crc32(data)).toBe(crc)
    files[name] = new TextDecoder().decode(data)
    at += 46 + nameLength
  }
  return files
}

describe('zip', () => {
  it('crc32 bate com o valor de referência do CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('guarda os arquivos e lê de volta', () => {
    const files = unzip(
      zip([
        ['a.txt', new TextEncoder().encode('um')],
        ['pasta/b.txt', new TextEncoder().encode('dois')],
      ]),
    )
    expect(files).toEqual({ 'a.txt': 'um', 'pasta/b.txt': 'dois' })
  })
})

describe('xlsx', () => {
  it('nomes de coluna', () => {
    expect([0, 7, 25, 26, 27, 701].map(columnName)).toEqual(['A', 'H', 'Z', 'AA', 'AB', 'ZZ'])
  })

  it('escapa XML e remove caracteres de controle', () => {
    expect(escapeXml('A & B <c> "d"\u0001')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;')
  })

  const files = unzip(
    xlsx({
      name: 'Lista: casa/nova',
      widths: [10, 20],
      rows: [
        [
          { text: 'Produto', bold: true },
          { text: 'Preço', bold: true },
        ],
        [{ text: 'Panela & tampa' }, { number: 99.9, format: 'money' }],
        [{ link: 'https://meli.la/abc?x=1&y=2' }, { number: 3, format: 'int' }],
        [null, { formula: 'SUM(B2:B3)', value: 102.9, format: 'money', bold: true }],
      ],
    }),
  )

  it('tem as partes do formato Office Open XML', () => {
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/_rels/sheet1.xml.rels',
      'xl/worksheets/sheet1.xml',
    ])
    // estilo padrão "Normal" (sem ele, leitores avisam que a planilha não tem estilo padrão)
    expect(files['xl/styles.xml']).toContain('<cellStyle name="Normal" xfId="0" builtinId="0"/>')
    expect(files['xl/styles.xml']).toContain('formatCode="&quot;R$&quot; #,##0.00"')
    // nome da aba sem caracteres proibidos
    expect(files['xl/workbook.xml']).toContain('name="Lista  casa nova"')
  })

  it('células: texto, dinheiro, inteiro, fórmula e link', () => {
    const sheet = files['xl/worksheets/sheet1.xml']
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr" s="0"><is><t xml:space="preserve">Panela &amp; tampa</t></is></c>',
    )
    expect(sheet).toContain('<c r="B2" s="2"><v>99.9</v></c>')
    expect(sheet).toContain('<c r="B3" s="5"><v>3</v></c>')
    expect(sheet).toContain('<c r="B4" s="3"><f>SUM(B2:B3)</f><v>102.9</v></c>')
    expect(sheet).not.toContain('r="A4"')
    expect(sheet).toContain('<hyperlink ref="A3" r:id="rId1"/>')
    expect(files['xl/worksheets/_rels/sheet1.xml.rels']).toContain(
      'Target="https://meli.la/abc?x=1&amp;y=2" TargetMode="External"',
    )
    expect(sheet).toContain('<pane ySplit="1"')
  })

  it('sem links, sem o arquivo de relações da planilha', () => {
    const plain = unzip(xlsx({ name: 'A', widths: [], rows: [[{ text: 'x' }]] }))
    expect(plain).not.toHaveProperty('xl/worksheets/_rels/sheet1.xml.rels')
    expect(plain['xl/worksheets/sheet1.xml']).not.toContain('<hyperlinks>')
  })
})
