import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'

/** Baixa a lista em .xlsx. O gerador só é carregado quando a pessoa pede a planilha. */
export async function downloadList(view: ListView, instances: RoomInstance[]): Promise<void> {
  const [{ listSheet, exportFileName }, { xlsx, XLSX_MIME }] = await Promise.all([
    import('../engine/export.ts'),
    import('../engine/xlsx.ts'),
  ])
  const blob = new Blob([xlsx(listSheet(view, instances))], { type: XLSX_MIME })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(new Date().toLocaleDateString('sv-SE'))
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
