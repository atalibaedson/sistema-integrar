import { useEffect, useState } from 'react'
import { useAppState } from '../store'
import { listarSemConexao, useCadastroUnico } from '../cadastroUnico'
import { definirConexaoDe } from '../meuCadastro'
import { linkWhatsApp } from '../actions'
import { igrejaAtivaId } from '../igrejas'
import { useSessaoReal } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { toast } from '../toast'
import { formatarTelefone } from '../regras-membros'
import type { PessoaCU } from '../regras-cadastro-unico'
import { IcoAlerta, IcoWhats } from '../icones'
import Avatar from '../Avatar'

// "Sem conexão" (decisão D4): quem respondeu no cadastro único que ainda não participa de
// uma Conexão — para a integração convidar. A lista vem do Check-iFE e já chega filtrada
// pelas regras dele (pastor/integração veem só a própria igreja).
export default function SemConexao() {
  const s = useAppState()
  const sessao = useSessaoReal()
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const [lista, setLista] = useState<PessoaCU[] | null | undefined>(undefined)
  const [mudando, setMudando] = useState('')
  // reaproveita o aviso de papel ausente da leitura em lote
  const cu = useCadastroUnico(s.usuarios.map((u) => u.authUserId), sessao?.userId)

  async function carregar() { setLista(await listarSemConexao()) }
  useEffect(() => { void carregar() }, [])

  async function definir(p: PessoaCU, codigo: string) {
    if (!codigo || !p.userId) return
    const nome = s.conexoes.find((c) => c.id === codigo)?.nome ?? codigo
    setMudando(p.pessoaId)
    const r = await definirConexaoDe(p.userId, codigo, igrejaAtivaId())
    setMudando('')
    if (!r.ok) { toast(r.erro, 'erro'); return }
    registrarAuditoria(`🔗 Definiu a ${termoGrupo} de uma pessoa (cadastro único)`, { alvoTipo: 'sistema', alvoNome: p.nome, detalhe: `→ ${nome}` })
    toast(`${p.nome ?? 'Pessoa'} agora participa de ${nome}`)
    void carregar()
  }

  const mensagem = (p: PessoaCU) =>
    `Olá, ${(p.nome ?? '').split(' ')[0]}! Tudo bem? Aqui é da integração da ${s.config.nomeIgreja}. Vimos no seu cadastro que você ainda não participa de uma ${termoGrupo}. Podemos te ajudar a encontrar uma perto de você?`

  return (
    <div className="sem-conexao">
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Sem {termoGrupo.toLowerCase()}</h1>
          <p className="subtitulo">Quem respondeu no cadastro único que ainda não participa de uma {termoGrupo.toLowerCase()} — para convidar.</p>
        </div>
      </div>

      {cu.estado === 'sem_permissao' && (
        <div className="cu-aviso-papel" role="status"><IcoAlerta size={16} />
          <span>O seu perfil no Check-iFE ainda não tem o papel de <b>pastor</b> ou <b>integração</b>, por isso a lista pode vir vazia.</span>
        </div>
      )}
      {lista === undefined && <p className="eq-g-nota">Consultando…</p>}
      {lista === null && <p className="eq-g-nota">Não foi possível consultar o cadastro único agora.</p>}
      {lista && lista.length === 0 && <div className="card"><p className="mc-texto" style={{ margin: 0 }}>Ninguém marcou “ainda não participo”. 🙌</p></div>}

      {lista && lista.length > 0 && (
        <div className="card sc-lista">
          {lista.map((p) => (
            <div className="sc-linha" key={p.pessoaId}>
              <Avatar nome={p.nome ?? '?'} />
              <div className="sc-quem">
                <b>{p.nome ?? 'Sem nome'}</b>
                <small>{p.telefone ? formatarTelefone(p.telefone) : 'sem telefone'}{p.email ? ` · ${p.email}` : ''}</small>
              </div>
              <div className="sc-acoes">
                {p.telefone && (
                  <a className="btn btn-sec btn-mini" href={linkWhatsApp(p.telefone, mensagem(p))} target="_blank" rel="noreferrer"><IcoWhats size={13} /> Convidar</a>
                )}
                <select
                  className="sc-select" value="" disabled={!p.userId || mudando === p.pessoaId}
                  title={p.userId ? `Definir a ${termoGrupo.toLowerCase()}` : 'Pessoa sem conta: só ela mesma pode responder'}
                  onChange={(e) => void definir(p, e.target.value)}
                >
                  <option value="">{mudando === p.pessoaId ? 'Salvando…' : `Definir ${termoGrupo.toLowerCase()}…`}</option>
                  {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
