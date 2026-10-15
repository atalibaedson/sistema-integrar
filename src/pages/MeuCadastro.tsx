import { useEffect, useMemo, useState } from 'react'
import { setEstado, useAppState } from '../store'
import { usuarioAtual, useUsuarioAtualId } from '../acesso'
import { igrejaAtivaId } from '../igrejas'
import { registrarAuditoria } from '../auditoria'
import { toast } from '../toast'
import { formatarTelefone } from '../regras-membros'
import { ESTADO_CIVIL_CU_LABEL, linkPerfilCheckife, pendenciasCU, type EstadoCivilCU, type PessoaCU } from '../regras-cadastro-unico'
import {
  aceitarTermo, lerMeuCadastro, lerTermo, limparTermo, listarConexoesCU, salvarMeusDados, salvarMinhaParticipacao,
  useSituacaoCadastroUnico, type ConexaoCU, type TermoCU,
} from '../meuCadastro'
import { urlDoApp } from '../urlApp'
import { IcoAlerta, IcoCheck } from '../icones'

// "Meu cadastro" (etapa 2, fase B): a pessoa corrige o PRÓPRIO cadastro único sem sair do
// Integrar. Vale também no Check-iFE e no Louvor. Endereço, filhos, contato de emergência e
// os campos extras da igreja ficam no Check-iFE (link no fim da página).
export default function MeuCadastro() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const situacao = useSituacaoCadastroUnico()
  const [pessoa, setPessoa] = useState<PessoaCU | null | undefined>(undefined)
  const [termo, setTermo] = useState<TermoCU | null>(null)
  const [leuTermo, setLeuTermo] = useState(false)
  const [conexoes, setConexoes] = useState<ConexaoCU[]>([])
  const [nome, setNome] = useState('')
  const [whats, setWhats] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivilCU | ''>('')
  const [conexao, setConexao] = useState('') // id, 'nenhuma' ou '' (não respondeu)
  const [salvando, setSalvando] = useState('')

  async function carregar() {
    const p = await lerMeuCadastro()
    setPessoa(p)
    if (p) {
      setNome(p.nome ?? eu?.nome ?? '')
      setWhats(p.telefone ? formatarTelefone(p.telefone) : eu?.whatsapp ?? '')
      setNascimento(p.dataNascimento ?? '')
      setEstadoCivil(p.estadoCivil ?? '')
      setConexao(p.conexaoSituacao === 'nao_participa' ? 'nenhuma' : p.conexaoCodigo ?? '')
    }
  }
  useEffect(() => {
    void carregar()
    void lerTermo().then(setTermo)
    void listarConexoesCU().then(setConexoes)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const faltaTermo = !!situacao.valor?.falta.includes('termo')
  const semConta = !!situacao.valor?.falta.includes('conta') || pessoa === null
  const pendencias = pendenciasCU(situacao.valor, termoGrupo)
  const linkCheckife = linkPerfilCheckife(`${urlDoApp()}/#/meu-cadastro`)

  // Lista de conexões: a do Check-iFE (duas igrejas, a da pessoa primeiro); sem ela, as desta igreja
  const grupos = useMemo(() => {
    const lista: ConexaoCU[] = conexoes.length > 0 ? conexoes
      : s.conexoes.map((c) => ({ igreja: igrejaAtivaId(), igrejaNome: s.config.nomeIgreja, id: c.id, nome: c.nome, minha: true }))
    const m = new Map<string, { rotulo: string; itens: ConexaoCU[] }>()
    for (const c of lista) {
      const g = m.get(c.igreja) ?? { rotulo: c.cidade ? `${c.igrejaNome} · ${c.cidade}` : c.igrejaNome, itens: [] }
      g.itens.push(c)
      m.set(c.igreja, g)
    }
    return [...m.entries()]
  }, [conexoes, s.conexoes, s.config.nomeIgreja])
  const igrejaDaConexao = (id: string) => grupos.find(([, g]) => g.itens.some((c) => c.id === id))?.[0] ?? igrejaAtivaId()

  async function aceitar() {
    if (!termo) return
    setSalvando('termo')
    const r = await aceitarTermo(termo.versao)
    setSalvando('')
    if (!r.ok) { toast(r.erro, 'erro'); if (r.erro.includes('atualizado')) void lerTermo().then(setTermo); return }
    toast('Termo aceito — obrigado!')
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || whats.replace(/\D/g, '').length < 10) { toast('Preencha o nome e um WhatsApp com DDD.', 'erro'); return }
    setSalvando('dados')
    const r = await salvarMeusDados({ nome, telefone: whats, dataNascimento: nascimento || undefined })
    setSalvando('')
    if (!r.ok) { toast(r.erro, 'erro'); return }
    // a ficha do Integrar é uma cópia: acompanha o cadastro único
    if (eu && (eu.nome !== nome.trim() || eu.whatsapp !== formatarTelefone(whats.replace(/\D/g, '')))) {
      const novoWhats = formatarTelefone(whats.replace(/\D/g, ''))
      setEstado((st) => ({ ...st, usuarios: st.usuarios.map((x) => (x.id === eu.id ? { ...x, nome: nome.trim(), whatsapp: novoWhats } : x)) }))
      registrarAuditoria('✏️ Atualizou o próprio cadastro', { alvoTipo: 'usuario', alvoId: eu.id, alvoNome: nome.trim() })
    }
    toast('Dados salvos')
    void carregar()
  }

  async function salvarParticipacao(e: React.FormEvent) {
    e.preventDefault()
    if (!pessoa) return
    if (!conexao) { toast(`Escolha a sua ${termoGrupo.toLowerCase()} ou "Ainda não participo".`, 'erro'); return }
    setSalvando('participacao')
    const r = await salvarMinhaParticipacao(pessoa.pessoaId, { estadoCivil: estadoCivil || undefined, conexao, igreja: igrejaDaConexao(conexao) })
    setSalvando('')
    if (!r.ok) { toast(r.erro, 'erro'); return }
    toast('Salvo')
    void carregar()
  }

  return (
    <div className="meu-cadastro">
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Meu cadastro</h1>
          <p className="subtitulo">Seus dados no cadastro único da igreja. Valem também no Check-iFE e no Louvor.</p>
        </div>
      </div>

      {semConta && (
        <div className="card mc-cartao">
          <p className="mc-texto">Seu cadastro único ainda não foi criado. Ele aparece quando o e-mail da sua conta está confirmado. Saia e entre de novo depois de confirmar.</p>
        </div>
      )}

      {!semConta && pendencias.length > 0 && (
        <div className="cu-aviso-papel" role="status">
          <IcoAlerta size={16} />
          <span>Para completar: {pendencias.join('; ')}.{situacao.valor?.camposPendentes.length ? <> As informações extras ficam no <a href={linkCheckife}>Check-iFE</a>.</> : null}</span>
        </div>
      )}

      {!semConta && faltaTermo && termo && (
        <section className="card mc-cartao">
          <h2 className="mc-titulo">Termo de privacidade do cadastro único</h2>
          <div className="mc-termo" dangerouslySetInnerHTML={{ __html: limparTermo(termo.html) }} />
          <label className="check"><input type="checkbox" checked={leuTermo} onChange={(e) => setLeuTermo(e.target.checked)} /> Li e aceito o termo (versão {termo.versao}).</label>
          <div className="mc-acoes">
            <button type="button" className="btn" disabled={!leuTermo || salvando === 'termo'} onClick={() => void aceitar()}>
              <IcoCheck size={14} /> {salvando === 'termo' ? 'Salvando…' : 'Aceitar o termo'}
            </button>
          </div>
        </section>
      )}

      {!semConta && pessoa && (
        <form className="card mc-cartao" onSubmit={(e) => void salvarDados(e)}>
          <h2 className="mc-titulo">Dados pessoais</h2>
          <div className="ac-grupo">
            <label className="campo"><span>Nome completo</span><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
            <label className="campo"><span>WhatsApp</span><input type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(00) 90000-0000" /></label>
            <label className="campo"><span>Data de nascimento</span><input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} /></label>
          </div>
          <div className="mc-acoes"><button className="btn" type="submit" disabled={salvando === 'dados'}>{salvando === 'dados' ? 'Salvando…' : 'Salvar dados'}</button></div>
        </form>
      )}

      {!semConta && pessoa && (
        <form className="card mc-cartao" onSubmit={(e) => void salvarParticipacao(e)}>
          <h2 className="mc-titulo">Estado civil e {termoGrupo}</h2>
          {faltaTermo && <p className="mc-texto">Aceite o termo acima para preencher estes dados.</p>}
          <fieldset className="mc-campos" disabled={faltaTermo}>
            <div className="ac-grupo">
              <label className="campo"><span>Estado civil</span>
                <select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value as EstadoCivilCU | '')}>
                  <option value="">— selecionar —</option>
                  {(Object.keys(ESTADO_CIVIL_CU_LABEL) as EstadoCivilCU[]).map((k) => <option key={k} value={k}>{ESTADO_CIVIL_CU_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="campo"><span>Você participa de uma {termoGrupo}?</span>
                <select value={conexao} onChange={(e) => setConexao(e.target.value)}>
                  <option value="">— escolher —</option>
                  <option value="nenhuma">Ainda não participo</option>
                  {grupos.map(([igreja, g]) => (
                    <optgroup key={igreja} label={g.rotulo}>
                      {g.itens.map((c) => <option key={`${igreja}:${c.id}`} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <div className="mc-acoes"><button className="btn" type="submit" disabled={faltaTermo || salvando === 'participacao'}>{salvando === 'participacao' ? 'Salvando…' : 'Salvar'}</button></div>
          </fieldset>
        </form>
      )}

      <p className="eq-g-nota mc-rodape">
        Endereço, filhos, contato de emergência e outras informações ficam no <a href={linkCheckife}>Check-iFE (perfil)</a> — com o mesmo e-mail e senha.
      </p>
    </div>
  )
}
