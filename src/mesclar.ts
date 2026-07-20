// Mesclagem de estados (local × nuvem) — registro a registro, por id.
// Substitui o modelo "última gravação vence", que perdia cadastros quando
// dois computadores usavam o sistema ao mesmo tempo: agora os dados se somam,
// e as exclusões se propagam pelas lápides (AppState.excluidos).
import type { AppState, Exclusao, RegistroAuditoria } from './types'

const LIMITE_LAPIDES = 800
const LIMITE_AUDITORIA = 2000

function chave(t: Exclusao): string {
  return `${t.tipo}:${t.id}`
}

export function mesclarEstados(local: AppState, remoto: AppState): AppState {
  // Lápides dos dois lados valem: excluiu em qualquer máquina, some das duas
  const lapides = new Map<string, Exclusao>()
  for (const t of [...(remoto.excluidos ?? []), ...(local.excluidos ?? [])]) {
    lapides.set(chave(t), t)
  }
  const apagado = (tipo: Exclusao['tipo'], id: string) => lapides.has(`${tipo}:${id}`)

  // União por id; quando o mesmo registro existe nos dois lados, `escolher`
  // decide qual versão fica (padrão: a local, de quem está editando agora).
  function unir<T extends { id: string }>(
    loc: T[], rem: T[], tipo: Exclusao['tipo'],
    escolher: (l: T, r: T) => T = (l) => l,
  ): T[] {
    const m = new Map<string, T>()
    for (const r of rem) m.set(r.id, r)
    for (const l of loc) {
      const r = m.get(l.id)
      m.set(l.id, r ? escolher(l, r) : l)
    }
    return [...m.values()].filter((x) => !apagado(tipo, x.id))
  }

  const visitantes = unir(local.visitantes, remoto.visitantes, 'visitante',
    (l, r) => ((r.atualizadoEm ?? '') > (l.atualizadoEm ?? '') ? r : l))
    .sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''))
  const idsVisitantes = new Set(visitantes.map((v) => v.id))

  const interacoes = unir(local.interacoes, remoto.interacoes, 'interacao')
    .filter((i) => idsVisitantes.has(i.visitanteId))
    .sort((a, b) => b.data.localeCompare(a.data))

  const usuarios = unir(local.usuarios, remoto.usuarios, 'usuario')
  const conexoes = unir(local.conexoes, remoto.conexoes, 'conexao')
  const templates = unir(local.templates, remoto.templates, 'template')

  // Auditoria é só-acrescenta: união por id, mais recente primeiro
  const audMap = new Map<string, RegistroAuditoria>()
  for (const a of [...(remoto.auditoria ?? []), ...(local.auditoria ?? [])]) audMap.set(a.id, a)
  const auditoria = [...audMap.values()]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, LIMITE_AUDITORIA)

  // Config: vence quem editou por último (carimbo configAtualizadaEm)
  const configLocalMaisNova =
    (local.configAtualizadaEm ?? '') >= (remoto.configAtualizadaEm ?? '')
  const config = configLocalMaisNova ? local.config : remoto.config
  const configAtualizadaEm = configLocalMaisNova
    ? local.configAtualizadaEm
    : remoto.configAtualizadaEm

  const excluidos = [...lapides.values()]
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, LIMITE_LAPIDES)

  return {
    ...local,
    config,
    configAtualizadaEm,
    visitantes,
    interacoes,
    usuarios,
    conexoes,
    templates,
    auditoria,
    excluidos,
  }
}
