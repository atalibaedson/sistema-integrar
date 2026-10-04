// ⚠️ CÓPIA GERADA de src/alertas.ts — NÃO edite aqui. Mude a fonte e rode: npm run sincronizar:servidor
// Central de avisos — regras PURAS (sem navegador, sem React, sem store).
//
// O mesmo arquivo roda no app (sino, Painel, selos) e no servidor (a função que
// manda o push). Por isso ele só importa tipos e regras puras, e recebe o estado
// e a hora como argumento. Uma cópia vai para supabase/functions/_shared (ver
// scripts/sincronizar-servidor.mjs; um teste barra o deploy se ficarem
// diferentes). Mantenha-o sem imports de navegador.
//
// Ideia: avisar só quando alguém precisa FAZER algo. Cada aviso tem uma chave
// estável (tipo + alvo), uma lista de destinatários e um "nível": se o
// responsável não resolve, o aviso SOBE (líder acima, depois a Gestão) em vez de
// se repetir todo dia para a mesma pessoa.
import type { AppState, ConfigAlertas, Dispensa, Interacao, Status, Usuario, Visitante } from './types.ts'
import { HORARIO_CONTATO_LABEL } from './types.ts'
import { papelVeTudo } from './regras-acesso.ts'

export const ALERTAS_PADRAO: ConfigAlertas = {
  ativo: true,
  semResponsavelDias: 1,
  primeiroContatoDias: 2,
  intervaloContatoDias: 4, // cadência de ~3 dias entre contatos + 1 de tolerância
  liderSemContatoDias: 3,
  avisoEsperaDias: 3,
  cuidadoDias: 1,
  subirLiderDias: 2,
  subirCoordenacaoDias: 5,
  equipeParadaDias: 5,
  acolhedorParadoQtd: 3,
  cultoSemCadastro: true,
  horaResumo: 8,
}

// Config efetiva: o que a igreja personalizou por cima do padrão. Valor inválido
// (vazio, negativo, texto) cai no padrão — um campo apagado não desliga o aviso.
export function alertasConfig(cfg?: { alertas?: Partial<ConfigAlertas> }): ConfigAlertas {
  const c: Record<string, unknown> = { ...ALERTAS_PADRAO }
  const dado = (cfg?.alertas ?? {}) as Record<string, unknown>
  for (const k of Object.keys(ALERTAS_PADRAO) as (keyof ConfigAlertas)[]) {
    const v = dado[k]
    const padrao = ALERTAS_PADRAO[k]
    if (typeof padrao === 'boolean') {
      if (typeof v === 'boolean') c[k] = v
    } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      c[k] = Math.round(v)
    }
  }
  return c as unknown as ConfigAlertas
}

export type TipoAlerta =
  | 'sem_responsavel' | 'novo_para_voce' | 'primeiro_contato' | 'contato_vencido'
  | 'lider_sem_contato' | 'resposta_recebida' | 'quase_em_espera' | 'cuidado'
  | 'equipe_parada' | 'acolhedor_parado' | 'culto_sem_cadastro'

// Mesmos tons das etiquetas do Painel (.painel-ico-*, .painel-chip-*)
export type Gravidade = 'crit' | 'warn' | 'gold' | 'acc'

export interface Alerta {
  chave: string // estável — identifica o aviso para adiar / resolver
  tipo: TipoAlerta
  gravidade: Gravidade
  titulo: string
  detalhe: string
  visitanteId?: string
  rota: string // para onde o toque leva (sem o #)
  destinatarios: string[] // ids de Usuario que devem ver este aviso
  nivel: 0 | 1 | 2 // 0 = responsável · 1 = subiu ao líder acima · 2 = chegou à Gestão
  dias: number // há quantos dias a situação existe (ordenação e texto)
  imediato?: boolean // no push, avisa na hora (senão, entra no resumo do dia)
  semanal?: boolean // no push, só nos resumos de segunda-feira
}

// ---- Auxiliares ----

const DIA_MS = 86_400_000

// Etapas em que alguém deveria estar mexendo na ficha (igual a store.ts)
const ATIVAS: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido', 'batismo',
]
// Mesma regra do "ficha parada" do Painel (PRAZO_ATUALIZACAO_DIAS em store.ts)
const DIAS_FICHA_PARADA = 7

function diasEntre(iso: string | undefined, agora: Date): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((agora.getTime() - t) / DIA_MS))
}

// yyyy-mm-dd no horário de Brasília (o servidor roda em UTC)
export function dataLocalBR(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
}

export function partesBR(agora: Date): { hora: number; diaSemana: number; data: string } {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(agora)
  const hora = Number(f.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(f.find((p) => p.type === 'weekday')?.value ?? 'Sun')
  return { hora, diaSemana: dia < 0 ? 0 : dia, data: dataLocalBR(agora) }
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome
}

function pl(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function quando(dias: number): string {
  return dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

// Quem recebe o aviso conforme o nível. Nível 0: os responsáveis diretos. Nível 1:
// + o supervisor direto de cada um. Nível 2: + toda a Gestão Integração.
function escalonar(s: AppState, primarios: string[], nivel: 0 | 1 | 2, extras: string[] = []): string[] {
  const ids = new Set<string>(primarios)
  if (nivel >= 1) {
    for (const id of primarios) {
      const sup = s.usuarios.find((u) => u.id === id)?.supervisorId
      if (sup) ids.add(sup)
    }
    for (const id of extras) ids.add(id)
  }
  if (nivel >= 2 || ids.size === 0) for (const u of gestao(s)) ids.add(u.id)
  return [...ids].filter((id) => s.usuarios.some((u) => u.id === id && u.ativo))
}

// Gestão Integração; se a igreja não tem ninguém nessa função, os pastores
function gestao(s: AppState): Usuario[] {
  const ativos = s.usuarios.filter((u) => u.ativo)
  const g = ativos.filter((u) => u.papeis.includes('coordenacao'))
  return g.length > 0 ? g : ativos.filter((u) => u.papeis.includes('pastor'))
}

function nivelPorAtraso(atraso: number, cfg: ConfigAlertas): 0 | 1 | 2 {
  if (atraso >= cfg.subirCoordenacaoDias) return 2
  if (atraso >= cfg.subirLiderDias) return 1
  return 0
}

// Líder(es) que cuidam do visitante: o designado ou os do grupo de destino
function lideresDe(s: AppState, v: Visitante): string[] {
  if (v.liderConexaoId) return [v.liderConexaoId]
  const c = s.conexoes.find((x) => x.id === v.conexaoId)
  return [c?.liderId, c?.lider2Id].filter((x): x is string => !!x)
}

const ORDEM_GRAVIDADE: Record<Gravidade, number> = { crit: 0, warn: 1, gold: 2, acc: 3 }

// ---- Cálculo ----

// Todos os avisos da igreja, cada um com a lista de quem deve vê-lo. Quem
// consome filtra por pessoa (alertasDoUsuario) e tira os adiados.
export function calcularAlertas(s: AppState, agora: Date = new Date()): Alerta[] {
  const cfg = alertasConfig(s.config)
  if (!cfg.ativo) return []

  // Interações por visitante, da mais recente para a mais antiga
  const porVisitante = new Map<string, Interacao[]>()
  for (const i of s.interacoes) {
    const arr = porVisitante.get(i.visitanteId)
    if (arr) arr.push(i)
    else porVisitante.set(i.visitanteId, [i])
  }
  for (const arr of porVisitante.values()) arr.sort((a, b) => b.data.localeCompare(a.data))
  const intsDe = (v: Visitante): Interacao[] => porVisitante.get(v.id) ?? []

  const nomeUsuario = (id?: string) => s.usuarios.find((u) => u.id === id)?.nome ?? 'a equipe'
  const out: Alerta[] = []

  const responsavelAtivo = (v: Visitante): string | undefined =>
    v.responsavelId && s.usuarios.some((u) => u.id === v.responsavelId && u.ativo) ? v.responsavelId : undefined

  for (const v of s.visitantes) {
    if (!ATIVAS.includes(v.status)) continue
    const nome = v.nome
    const ints = intsDe(v)
    const ultima = ints[0]
    const diasCadastro = diasEntre(v.dataCadastro, agora)
    const rota = `/visitante/${v.id}`
    const resp = responsavelAtivo(v)

    // Cuidado / crise: sai do roteiro normal — só este aviso vale para a pessoa.
    // Quem vê é a mesma regra de podeVerCuidado: pastores + o responsável.
    if (v.flagCuidado) {
      const semRegistro = !ultima || diasEntre(ultima.data, agora) >= cfg.cuidadoDias
      if (semRegistro) {
        const pastores = s.usuarios.filter((u) => u.ativo && u.papeis.includes('pastor')).map((u) => u.id)
        const dest = [...new Set([...pastores, ...(resp ? [resp] : [])])]
        const dias = diasEntre(ultima?.data ?? v.dataCadastro, agora)
        out.push({
          chave: `cuidado:${v.id}`, tipo: 'cuidado', gravidade: 'crit', visitanteId: v.id, rota,
          titulo: `Cuidado: ${nome}`,
          detalhe: ultima
            ? `Caso de cuidado/crise sem registro ${quando(dias)}. Acione a liderança e registre o encaminhamento.`
            : 'Caso de cuidado/crise ainda sem nenhum registro. Acione a liderança e registre o encaminhamento.',
          destinatarios: dest, nivel: 0, dias, imediato: true,
        })
      }
      continue
    }

    // Sem responsável: ninguém assumiu — vai para a Gestão
    if (!resp) {
      if (v.status !== 'novo' && v.status !== 'em_contato' && v.status !== 'aguardando_resposta') continue
      if (diasCadastro >= cfg.semResponsavelDias) {
        out.push({
          chave: `sem_responsavel:${v.id}`, tipo: 'sem_responsavel', visitanteId: v.id, rota,
          gravidade: diasCadastro >= 3 ? 'crit' : 'warn',
          titulo: `${nome} está sem responsável`,
          detalhe: `Cadastrado ${quando(diasCadastro)} e ninguém assumiu. Atribua um responsável na ficha.`,
          destinatarios: gestao(s).map((u) => u.id), nivel: 0, dias: diasCadastro,
        })
      }
      continue
    }

    // 1º contato: visitante novo, ainda sem nenhum registro
    if ((v.status === 'novo' || v.status === 'em_contato') && ints.length === 0) {
      if (diasCadastro < cfg.primeiroContatoDias) {
        const horario = v.melhorHorarioContato ? ` (melhor horário: ${HORARIO_CONTATO_LABEL[v.melhorHorarioContato].toLowerCase()})` : ''
        const extra = v.desejaContato ? ` Pediu contato no cadastro${horario}.` : ''
        out.push({
          chave: `novo_para_voce:${v.id}`, tipo: 'novo_para_voce', gravidade: 'acc', visitanteId: v.id, rota,
          titulo: `Novo visitante para você: ${nome}`,
          detalhe: `Faça o 1º contato de acolhimento.${extra}`,
          destinatarios: [resp], nivel: 0, dias: diasCadastro, imediato: true,
        })
      } else {
        const atraso = diasCadastro - cfg.primeiroContatoDias
        const nivel = nivelPorAtraso(atraso, cfg)
        out.push({
          chave: `primeiro_contato:${v.id}`, tipo: 'primeiro_contato', visitanteId: v.id, rota,
          gravidade: nivel >= 1 ? 'crit' : 'warn',
          titulo: `1º contato atrasado: ${nome}`,
          detalhe: `Responsável: ${nomeUsuario(resp)}. Cadastrado ${quando(diasCadastro)} e sem nenhum contato registrado.`,
          destinatarios: escalonar(s, [resp], nivel), nivel, dias: diasCadastro,
        })
      }
      continue
    }

    // Em contato / aguardando resposta
    if (v.status === 'em_contato' || v.status === 'aguardando_resposta') {
      // Resposta registrada por OUTRA pessoa (ex.: o líder) → o responsável precisa saber
      if (ultima?.respondeu && ultima.autorId && ultima.autorId !== resp && diasEntre(ultima.data, agora) <= 2) {
        out.push({
          chave: `resposta_recebida:${ultima.id}`, tipo: 'resposta_recebida', gravidade: 'acc', visitanteId: v.id, rota,
          titulo: `${nome} respondeu`,
          detalhe: `${nomeUsuario(ultima.autorId)} registrou uma resposta ${quando(diasEntre(ultima.data, agora))}. Veja e dê o próximo passo.`,
          destinatarios: [resp], nivel: 0, dias: diasEntre(ultima.data, agora),
        })
      }

      // Perto de ir para "Em espera" (silêncio do visitante)
      const ultimaResposta = ints.find((i) => i.respondeu)?.data ?? v.dataCadastro
      const silencio = diasEntre(ultimaResposta, agora)
      const prazoEspera = s.config?.prazoEsperaDias ?? 14
      if (cfg.avisoEsperaDias > 0 && silencio >= prazoEspera - cfg.avisoEsperaDias && silencio < prazoEspera) {
        const faltam = prazoEspera - silencio
        out.push({
          chave: `quase_em_espera:${v.id}`, tipo: 'quase_em_espera', gravidade: 'warn', visitanteId: v.id, rota,
          titulo: `${nome} vai para "Em espera" em ${pl(faltam, 'dia', 'dias')}`,
          detalhe: `Sem resposta há ${silencio} dias. Um último contato pessoal ainda pode reabrir o vínculo.`,
          destinatarios: [resp], nivel: 0, dias: silencio,
        })
        continue // este aviso já cobre o "falta contato" — um por pessoa
      }

      // Contato vencido: passou o intervalo sem registro
      if (ultima) {
        const desde = diasEntre(ultima.data, agora)
        if (desde >= cfg.intervaloContatoDias) {
          const atraso = desde - cfg.intervaloContatoDias
          const nivel = nivelPorAtraso(atraso, cfg)
          out.push({
            chave: `contato_vencido:${v.id}`, tipo: 'contato_vencido', visitanteId: v.id, rota,
            gravidade: nivel >= 1 ? 'crit' : 'warn',
            titulo: `Contato pendente: ${nome}`,
            detalhe: `Responsável: ${nomeUsuario(resp)}. Último contato registrado ${quando(desde)}.`,
            destinatarios: escalonar(s, [resp], nivel), nivel, dias: desde,
          })
        }
      }
      continue
    }

    // Encaminhado ao líder: o líder precisa falar com a pessoa ANTES da visita
    if (v.status === 'encaminhado_lider') {
      const desde = [...v.historicoStatus].reverse().find((h) => h.para === 'encaminhado_lider')?.data ?? v.atualizadoEm
      const contatoDoLider = ints.some((i) => i.autorPapel === 'lider' && i.data > desde)
      const dias = diasEntre(desde, agora)
      if (!contatoDoLider && dias >= cfg.liderSemContatoDias) {
        const lideres = lideresDe(s, v)
        const atraso = dias - cfg.liderSemContatoDias
        const nivel = nivelPorAtraso(atraso, cfg)
        const primarios = lideres.length > 0 ? lideres : [resp]
        out.push({
          chave: `lider_sem_contato:${v.id}`, tipo: 'lider_sem_contato', visitanteId: v.id, rota,
          gravidade: nivel >= 1 ? 'crit' : 'warn',
          titulo: lideres.length > 0 ? `Líder ainda não falou com ${nome}` : `${nome} está sem líder definido`,
          detalhe: lideres.length > 0
            ? `Encaminhado ${quando(dias)}. O líder deve fazer contato antes da visita ao grupo.`
            : `Encaminhado ${quando(dias)}, mas nenhum líder foi definido. Escolha o grupo/líder na ficha.`,
          // o responsável acompanha desde o nível 1
          destinatarios: escalonar(s, primarios, nivel, [resp]), nivel, dias,
        })
      }
    }
  }

  // ---- Não abastecimento (visão da Gestão e dos pastores; resumo semanal) ----
  const gerentes = s.usuarios.filter((u) => u.ativo && papelVeTudo(u)).map((u) => u.id)
  const ativas = s.visitantes.filter((v) => ATIVAS.includes(v.status))

  // 1) Ninguém da equipe registrou contato por vários dias
  if (ativas.length > 0 && cfg.equipeParadaDias > 0) {
    const ultimaGeral = s.interacoes.reduce((m, i) => (i.data > m ? i.data : m), '')
    const base = ultimaGeral || ativas.reduce((m, v) => (v.dataCadastro < m ? v.dataCadastro : m), ativas[0].dataCadastro)
    const dias = diasEntre(base, agora)
    if (dias >= cfg.equipeParadaDias) {
      out.push({
        chave: 'equipe_parada', tipo: 'equipe_parada', gravidade: 'crit', rota: '/visitantes?grupo=sem_atualizacao',
        titulo: 'A equipe não registra contatos',
        detalhe: ultimaGeral
          ? `Nenhum contato foi registrado ${quando(dias)}, e há ${pl(ativas.length, 'visitante ativo', 'visitantes ativos')}.`
          : `Nenhum contato foi registrado ainda, e há ${pl(ativas.length, 'visitante ativo', 'visitantes ativos')}.`,
        destinatarios: gerentes, nivel: 2, dias, semanal: true,
      })
    }
  }

  // 2) Uma pessoa com várias fichas paradas
  if (cfg.acolhedorParadoQtd > 0) {
    const paradasPor = new Map<string, Visitante[]>()
    for (const v of ativas) {
      const resp = responsavelAtivo(v)
      if (!resp) continue
      const ult = intsDe(v)[0]?.data ?? ''
      const base = ult > v.atualizadoEm ? ult : v.atualizadoEm
      if (diasEntre(base || v.dataCadastro, agora) >= DIAS_FICHA_PARADA) {
        const arr = paradasPor.get(resp)
        if (arr) arr.push(v)
        else paradasPor.set(resp, [v])
      }
    }
    for (const [uid, lista] of paradasPor) {
      if (lista.length < cfg.acolhedorParadoQtd) continue
      const sup = s.usuarios.find((u) => u.id === uid)?.supervisorId
      out.push({
        chave: `acolhedor_parado:${uid}`, tipo: 'acolhedor_parado', gravidade: 'warn',
        rota: `/visitantes?resp=${uid}`,
        titulo: `${primeiroNome(nomeUsuario(uid))} tem ${lista.length} fichas paradas`,
        detalhe: `${lista.length} visitantes sem atualização há ${DIAS_FICHA_PARADA}+ dias com a mesma pessoa. Vale oferecer ajuda ou redistribuir.`,
        destinatarios: [...new Set([...gerentes, ...(sup ? [sup] : [])])], nivel: 0, dias: DIAS_FICHA_PARADA, semanal: true,
      })
    }
  }

  // 3) Culto que já passou e não teve nenhum cadastro (confirmar, sem cobrança)
  if (cfg.cultoSemCadastro) {
    const hoje = dataLocalBR(agora)
    const limite = dataLocalBR(new Date(agora.getTime() - 3 * DIA_MS))
    for (const culto of s.config?.cultosDef ?? []) {
      for (const data of culto.ocorrencias ?? []) {
        if (data >= hoje || data < limite) continue
        const teve = s.visitantes.some((v) =>
          v.cultoPrimeiraVisita === culto.nome &&
          (v.dataPrimeiraVisita ? v.dataPrimeiraVisita === data : dataLocalBR(new Date(v.dataCadastro)) === data))
        if (teve) continue
        const [, m, d] = data.split('-')
        out.push({
          chave: `culto_sem_cadastro:${culto.nome}:${data}`, tipo: 'culto_sem_cadastro', gravidade: 'gold',
          rota: '/novo',
          titulo: `Nenhum cadastro no culto "${culto.nome}" (${d}/${m})`,
          detalhe: `Ninguém foi cadastrado como visitante nesse culto. Se houve visitantes, cadastre agora; se não houve, é só marcar "Já resolvi".`,
          destinatarios: gerentes, nivel: 0, dias: diasEntre(`${data}T12:00:00-03:00`, agora), semanal: true,
        })
      }
    }
  }

  return out.sort((a, b) =>
    ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || b.nivel - a.nivel || b.dias - a.dias)
}

// ---- Dispensas (adiar / já resolvi) ----

export function idDispensa(usuarioId: string, chave: string): string {
  return `${usuarioId}|${chave}`
}

export function dispensaAtiva(dispensas: Dispensa[] | undefined, usuarioId: string, chave: string, agora: Date = new Date()): Dispensa | undefined {
  const d = (dispensas ?? []).find((x) => x.id === idDispensa(usuarioId, chave))
  return d && new Date(d.ate).getTime() > agora.getTime() ? d : undefined
}

// Avisos desta pessoa, separando os que estão adiados
export function alertasDoUsuario(
  s: AppState, usuarioId: string | undefined, agora: Date = new Date(), todos?: Alerta[],
): { ativos: Alerta[]; adiados: { alerta: Alerta; ate: string }[] } {
  if (!usuarioId) return { ativos: [], adiados: [] }
  const ativos: Alerta[] = []
  const adiados: { alerta: Alerta; ate: string }[] = []
  for (const a of todos ?? calcularAlertas(s, agora)) {
    if (!a.destinatarios.includes(usuarioId)) continue
    const d = dispensaAtiva(s.dispensas, usuarioId, a.chave, agora)
    if (d) adiados.push({ alerta: a, ate: d.ate })
    else ativos.push(a)
  }
  return { ativos, adiados }
}

// ---- Texto do push (só contagens: o aviso aparece na tela bloqueada, e o
// nome de um visitante — ainda mais num caso de cuidado — não deve aparecer lá) ----

const ROTULO_TIPO: Record<TipoAlerta, [string, string]> = {
  sem_responsavel: ['visitante sem responsável', 'visitantes sem responsável'],
  novo_para_voce: ['novo visitante para você', 'novos visitantes para você'],
  primeiro_contato: ['1º contato atrasado', '1ºs contatos atrasados'],
  contato_vencido: ['contato pendente', 'contatos pendentes'],
  lider_sem_contato: ['visitante esperando o líder', 'visitantes esperando o líder'],
  resposta_recebida: ['resposta para ver', 'respostas para ver'],
  quase_em_espera: ['prestes a ir para "Em espera"', 'prestes a ir para "Em espera"'],
  cuidado: ['caso de cuidado', 'casos de cuidado'],
  equipe_parada: ['alerta de equipe parada', 'alertas de equipe parada'],
  acolhedor_parado: ['pessoa com fichas paradas', 'pessoas com fichas paradas'],
  culto_sem_cadastro: ['culto sem cadastro', 'cultos sem cadastro'],
}

export function textoPush(alertas: Alerta[]): { titulo: string; corpo: string } {
  const n = alertas.length
  const por = new Map<TipoAlerta, number>()
  for (const a of alertas) por.set(a.tipo, (por.get(a.tipo) ?? 0) + 1)
  const partes = [...por.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([t, q]) => `${q} ${ROTULO_TIPO[t][q === 1 ? 0 : 1]}`)
  const resto = por.size > 3 ? ' e mais' : ''
  return {
    titulo: n === 1 ? 'Você tem 1 aviso' : `Você tem ${n} avisos`,
    corpo: partes.join(' · ') + resto,
  }
}

export function textoPushImediato(alertas: Alerta[]): { titulo: string; corpo: string } {
  const cuidado = alertas.filter((a) => a.tipo === 'cuidado').length
  const novos = alertas.filter((a) => a.tipo === 'novo_para_voce').length
  if (cuidado > 0) {
    return {
      titulo: 'Caso de cuidado precisa de atenção',
      corpo: cuidado === 1 ? 'Abra o sistema para ver e registrar o encaminhamento.' : `${cuidado} casos precisam de atenção. Abra o sistema.`,
    }
  }
  return {
    titulo: novos === 1 ? 'Novo visitante para você' : `${novos} novos visitantes para você`,
    corpo: 'Faça o 1º contato de acolhimento.',
  }
}
