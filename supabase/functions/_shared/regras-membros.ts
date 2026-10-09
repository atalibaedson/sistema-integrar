// ⚠️ CÓPIA GERADA de src/regras-membros.ts — NÃO edite aqui. Mude a fonte e rode: npm run sincronizar:servidor
// Regras PURAS de quem pode entrar na igreja — sem navegador, sem React, sem store.
//
// O vínculo de uma conta com a igreja (tabela `membros_igreja`) é o que libera a
// leitura do bloco `estados`, e o bloco inclui cuidado pastoral e crises. Por
// isso o vínculo só nasce depois que a LIDERANÇA aprova a pessoa, e quem decide
// isso é o servidor (Edge Function `acesso-membro`), nunca o navegador. Este
// arquivo concentra as regras para elas serem testadas aqui e usadas, iguais,
// pelas funções do servidor (cópia gerada em supabase/functions/_shared — ver
// scripts/sincronizar-servidor.mjs). Mantenha-o sem imports de navegador.
import type { AppState, Papel, RegistroAuditoria, SituacaoCivil, Usuario } from './types.ts'
import { PAPEL_LABEL } from './types.ts'

export const PAPEIS_VALIDOS = Object.keys(PAPEL_LABEL) as Papel[]
const SITUACOES: SituacaoCivil[] = ['solteiro', 'casado', 'divorciado', 'viuvo', 'outro']
const LIMITE_AUDITORIA = 1000 // = LIMITE_REGISTROS em auditoria.ts

export function normalizarEmail(e?: string | null): string {
  return (e ?? '').trim().toLowerCase()
}

/** A conta de login (Supabase Auth) que está pedindo algo. */
export interface ContaAuth {
  id: string
  email?: string | null
  emailConfirmado: boolean
}

// ---- Achar a ficha da conta na equipe ----

/**
 * A ficha da equipe que pertence a esta conta. Primeiro pelo id da conta; só
 * depois pelo e-mail — e o e-mail só vale se a ficha ainda não tem conta
 * ligada e o e-mail da conta já foi confirmado (senão qualquer um criaria uma
 * conta com o e-mail de outra pessoa e herdaria a ficha dela).
 */
export function acharFicha(usuarios: Usuario[], conta: ContaAuth): Usuario | undefined {
  const porConta = usuarios.find((u) => u.authUserId === conta.id)
  if (porConta) return porConta
  const email = normalizarEmail(conta.email)
  if (!email || !conta.emailConfirmado) return undefined
  return usuarios.find((u) => !u.authUserId && normalizarEmail(u.email) === email)
}

export type StatusConta = 'sem_ficha' | 'pendente_aprovacao' | 'aprovado' | 'rejeitado' | 'inativo'

/** Situação da conta para a tela de espera. Ficha criada pela liderança, sem login, conta como "sem ficha" (dá para reivindicar). */
export function statusDaConta(ficha?: Usuario): StatusConta {
  if (!ficha) return 'sem_ficha'
  if (!ficha.ativo) return 'inativo'
  switch (ficha.statusAcesso) {
    case 'aprovado': return 'aprovado'
    case 'pendente_aprovacao': return 'pendente_aprovacao'
    case 'rejeitado': return 'rejeitado'
    default: return 'sem_ficha' // 'sem_login' e 'pendente_confirmacao_email'
  }
}

// ---- Quem pode aprovar ----

/** Pastor ou Gestão Integração, ativo e com acesso aprovado. */
export function ehAdminAprovado(u?: Usuario): boolean {
  return !!u && u.ativo && u.statusAcesso === 'aprovado' && (u.papeis.includes('pastor') || u.papeis.includes('coordenacao'))
}

export function existeAdminAprovado(usuarios: Usuario[]): boolean {
  return usuarios.some((u) => ehAdminAprovado(u))
}

/** O primeiro administrador da igreja pode ativar o próprio acesso — só enquanto NÃO há nenhum aprovado. */
export function podeSerPrimeiroAdmin(usuarios: Usuario[], conta: ContaAuth): boolean {
  const ficha = acharFicha(usuarios, conta)
  return !!ficha && ficha.ativo && !existeAdminAprovado(usuarios) &&
    (ficha.statusAcesso === 'pendente_aprovacao' || ficha.statusAcesso === 'aprovado')
}

/**
 * Quem chama pode aprovar acessos nesta igreja? (a conferência que o servidor faz antes de criar o vínculo)
 * Aqui só vale a ficha LIGADA à conta (authUserId): o poder de aprovar nunca vem de uma
 * coincidência de e-mail. Uma ficha antiga, achada só pelo e-mail, é ligada à conta no
 * primeiro acesso (ver `ligarFichaAConta`) e só depois passa a poder aprovar.
 */
export function chamadorPodeAprovar(usuarios: Usuario[], conta: ContaAuth): boolean {
  return ehAdminAprovado(usuarios.find((u) => u.authUserId === conta.id))
}

/** Grava o id da conta na ficha achada só pelo e-mail (a partir daí, o vínculo é por conta, não por e-mail). */
export function ligarFichaAConta(estado: AppState, fichaId: string, authUserId: string): AppState {
  return {
    ...estado,
    usuarios: (estado.usuarios ?? []).map((u) => (u.id === fichaId && !u.authUserId ? { ...u, authUserId } : u)),
  }
}

/** A conta indicada tem ficha nesta igreja (condição para a liderança liberar o vínculo dela)? */
export function contaTemFicha(usuarios: Usuario[], authUserId: string): boolean {
  return usuarios.some((u) => u.authUserId === authUserId)
}

/**
 * A liderança pode tirar o vínculo desta conta com a igreja? Nunca o da própria pessoa
 * que pede (ninguém se tranca para fora por engano) e só de quem tem ficha aqui.
 */
export function podeRevogarVinculo(
  usuarios: Usuario[], chamador: ContaAuth, alvoAuthUserId: string,
): { ok: true } | { ok: false; erro: string } {
  if (!chamadorPodeAprovar(usuarios, chamador)) return { ok: false, erro: 'Só Pastores e a Gestão Integração aprovados podem retirar acessos.' }
  if (alvoAuthUserId === chamador.id) return { ok: false, erro: 'Você não pode retirar o seu próprio acesso.' }
  if (!contaTemFicha(usuarios, alvoAuthUserId)) return { ok: false, erro: 'Essa conta não tem cadastro nesta igreja.' }
  return { ok: true }
}

/** Marca como inativa a ficha ligada à conta (a retirada vale mesmo que a gravação do app ainda não tenha chegado). */
export function desativarFichaDaConta(estado: AppState, authUserId: string): AppState {
  return {
    ...estado,
    usuarios: (estado.usuarios ?? []).map((u) => (u.authUserId === authUserId ? { ...u, ativo: false } : u)),
  }
}

/** Quem está desativado na Equipe não deve manter o vínculo (o servidor o retira sozinho na próxima consulta). */
export function deveTerVinculo(ficha?: Usuario): boolean {
  return statusDaConta(ficha) !== 'inativo'
}

// ---- O pedido de acesso (vem dos metadados da conta + do que a pessoa confirma) ----

export interface Solicitacao {
  nome: string
  whatsapp: string
  dataNascimento?: string
  situacaoCivil?: SituacaoCivil
  conexaoParticipaId?: string // 'nenhuma' vira undefined
  papeis: Papel[]
  loginPreferido: 'email' | 'whatsapp'
  fotoUrl?: string
  consentimentoLgpdEm: string // ISO
}

export type LeituraSolicitacao =
  | { ok: true; solicitacao: Solicitacao }
  | { ok: false; erro: string; semDados?: boolean }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Só dígitos (padrão combinado entre os sistemas: "telefone") vira "(12) 99999-0000"; texto já formatado ou estrangeiro fica como veio. */
export function formatarTelefone(t: string): string {
  if (/\D/.test(t)) return t // já tem formatação (ou é internacional, com +)
  let d = t.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t
}

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900
}

/**
 * Monta o pedido a partir dos metadados da conta (`user_metadata`, que a própria
 * pessoa pode editar — por isso é só um PEDIDO, nunca concede acesso) e, quando
 * vem da tela "Completar cadastro", do que ela informou ali (`extra`).
 *
 * `automatico`: o pedido nasce do cadastro feito neste site (origem 'integrar'
 * desta igreja). Sem isso, uma conta criada em outro sistema ou em outra igreja
 * jamais vira pedido sem a pessoa pedir.
 */
export function lerSolicitacao(
  meta: unknown,
  extra: unknown,
  opcoes: { igrejaId: string; prefixoFoto?: string; agora?: Date; automatico: boolean },
): LeituraSolicitacao {
  const m = obj(meta)
  const mi = obj(m.integrar)
  const x = obj(extra)
  const agora = opcoes.agora ?? new Date()

  if (opcoes.automatico && !(m.origem === 'integrar' && mi.igreja === opcoes.igrejaId && Array.isArray(mi.funcoes))) {
    return { ok: false, erro: 'Esta conta não pediu acesso ao Integrar.', semDados: true }
  }

  const nome = texto(x.nome ?? m.nome, 120)
  const whatsapp = texto(x.telefone ?? m.telefone, 30)
  const nascimentoBruto = texto(x.nascimento ?? m.nascimento, 10)
  const situacao = texto(x.situacaoCivil ?? mi.situacaoCivil, 20) as SituacaoCivil
  const conexao = texto(x.conexao ?? m.conexao, 80)
  const login = texto(x.loginPreferido ?? mi.loginPreferido, 10)
  const funcoesBrutas = x.funcoes ?? mi.funcoes
  const foto = texto(x.fotoUrl ?? mi.fotoUrl, 500)
  const consentimento = x.consentimento === true || (typeof mi.consentimentoEm === 'string' && !!mi.consentimentoEm)

  if (nome.length < 2) return { ok: false, erro: 'Informe o nome completo.' }
  if (whatsapp.replace(/\D/g, '').length < 10) return { ok: false, erro: 'Informe o WhatsApp com DDD.' }
  const papeis = [...new Set((Array.isArray(funcoesBrutas) ? funcoesBrutas : []).filter((p): p is Papel => PAPEIS_VALIDOS.includes(p as Papel)))]
  if (papeis.length === 0) return { ok: false, erro: 'Marque ao menos uma função.', semDados: true }
  if (!consentimento) return { ok: false, erro: 'É preciso autorizar o uso dos dados.' }
  if (nascimentoBruto && !dataValida(nascimentoBruto)) return { ok: false, erro: 'Data de nascimento inválida.' }

  return {
    ok: true,
    solicitacao: {
      nome,
      whatsapp: formatarTelefone(whatsapp),
      dataNascimento: nascimentoBruto || undefined,
      situacaoCivil: SITUACOES.includes(situacao) ? situacao : undefined,
      conexaoParticipaId: conexao && conexao !== 'nenhuma' ? conexao : undefined,
      papeis,
      loginPreferido: login === 'whatsapp' ? 'whatsapp' : 'email',
      // só aceita foto do bucket do próprio projeto (nada de endereço qualquer)
      fotoUrl: foto && opcoes.prefixoFoto && foto.startsWith(opcoes.prefixoFoto) ? foto : undefined,
      consentimentoLgpdEm: agora.toISOString(),
    },
  }
}

// ---- Aplicar o pedido ao estado da igreja (feito pelo servidor) ----

export interface ResultadoSolicitacao {
  estado: AppState
  resultado: 'criada' | 'reivindicada' | 'ja_existe'
  usuarioId: string
}

/** Gestão Integração ativa (ordem alfabética) — supervisor padrão dos Integradores pós-culto novos. */
function gestorPadrao(usuarios: Usuario[]): Usuario | undefined {
  return usuarios
    .filter((u) => u.ativo && u.papeis.includes('coordenacao'))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))[0]
}

/**
 * Cria (ou reivindica) a ficha PENDENTE da conta. Nunca aprova nada. Idempotente:
 * se a conta já tem ficha, devolve o estado como está.
 */
export function aplicarSolicitacao(
  estado: AppState,
  conta: ContaAuth,
  sol: Solicitacao,
  gerarId: () => string,
  agora: Date = new Date(),
): ResultadoSolicitacao {
  const usuarios = estado.usuarios ?? []
  const existente = acharFicha(usuarios, conta)
  const email = normalizarEmail(conta.email) || undefined
  const iso = agora.toISOString()

  // Já tem ficha: pendente/aprovada/rejeitada. Só uma ficha criada pela
  // liderança (sem login) pode ser reivindicada.
  if (existente && statusDaConta(existente) !== 'sem_ficha') {
    return { estado, resultado: 'ja_existe', usuarioId: existente.id }
  }

  const dados: Partial<Usuario> = {
    nome: sol.nome,
    whatsapp: sol.whatsapp,
    email,
    dataNascimento: sol.dataNascimento,
    situacaoCivil: sol.situacaoCivil,
    conexaoParticipaId: sol.conexaoParticipaId,
    fotoUrl: sol.fotoUrl,
    authUserId: conta.id,
    statusAcesso: 'pendente_aprovacao',
    loginPreferido: sol.loginPreferido,
    cadastroCompletoEm: iso,
  }

  let usuarioId: string
  let usuariosNovos: Usuario[]
  let resultado: 'criada' | 'reivindicada'
  if (existente) {
    // ficha da liderança passa a ter conta (mantém id, funções e vínculos já definidos)
    usuarioId = existente.id
    resultado = 'reivindicada'
    usuariosNovos = usuarios.map((u) =>
      u.id === existente.id
        ? { ...u, ...limpar(dados), papeis: [...new Set([...u.papeis, ...sol.papeis])] }
        : u,
    )
  } else {
    // id previsível: dois aparelhos pedindo ao mesmo tempo mesclam em vez de duplicar
    usuarioId = `u-${conta.id}`
    resultado = 'criada'
    const gestor = sol.papeis.includes('consolidador') ? gestorPadrao(usuarios) : undefined
    const novo: Usuario = {
      id: usuarioId,
      papeis: sol.papeis,
      ativo: true,
      supervisorId: gestor?.id,
      ...(limpar(dados) as Omit<Usuario, 'id' | 'papeis' | 'ativo'>),
    } as Usuario
    usuariosNovos = [...usuarios, novo]
  }

  const registro: RegistroAuditoria = {
    id: gerarId(),
    data: iso,
    usuarioNome: sol.nome,
    acao: resultado === 'criada' ? '📝 Integrante pediu acesso' : '📝 Integrante assumiu o próprio cadastro',
    detalhe: `Funções: ${sol.papeis.map((p) => PAPEL_LABEL[p]).join(', ')} · aguardando aprovação da liderança`,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: sol.nome,
  }

  return {
    resultado,
    usuarioId,
    estado: {
      ...estado,
      usuarios: usuariosNovos,
      // um cadastro antigo apagado não pode "barrar" esta nova ficha
      excluidos: (estado.excluidos ?? []).filter((t) => !(t.tipo === 'usuario' && t.id === usuarioId)),
      auditoria: [registro, ...(estado.auditoria ?? [])].slice(0, LIMITE_AUDITORIA),
    },
  }
}

// campos `undefined` não sobrescrevem o que a ficha já tinha
function limpar<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
