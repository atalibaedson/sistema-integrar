import { useState } from 'react'
import { comExclusoes, setEstado, usuarioPorId, useAppState } from '../../store'
import { PAPEL_COR, rotuloPapel, type Papel, type Usuario } from '../../types'
import { linkWhatsApp } from '../../actions'
import { criariCiclo } from '../../acesso'
import { registrarAuditoria } from '../../auditoria'
import { navegar } from '../../router'
import { toast } from '../../toast'
import { confirmar } from '../../confirmar'
import { supabase } from '../../supabaseClient'
import { IcoCheck, IcoCopiar, IcoEmail, IcoLixeira, IcoWhats, IcoX } from '../../icones'
import Avatar from '../../Avatar'
import Gaveta from './Gaveta'
import { ChipAcesso, ChipsPapeis, definirSupervisor, SeletorFuncoes } from './comum'

function dataBR(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : ''
}

const mesmosPapeis = (a: Papel[], b: Papel[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

// Gaveta de edição de um membro. Tudo vai para um rascunho e só é gravado em
// "Salvar alterações" (nome, WhatsApp, funções, grupo e supervisor). Desativar e
// excluir são ações à parte, com efeito imediato e confirmação.
export default function EditarMembro({ u, onFechar }: { u: Usuario; onFechar: () => void }) {
  const s = useAppState()
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const [nome, setNome] = useState(u.nome)
  const [whats, setWhats] = useState(u.whatsapp)
  const [papeis, setPapeis] = useState<Papel[]>(u.papeis)
  const [conexaoId, setConexaoId] = useState(u.conexaoId ?? '')
  const [supervisorId, setSupervisorId] = useState(u.supervisorId ?? '')

  const mudouConexao = conexaoId !== (u.conexaoId ?? '')
  const mudouSupervisor = supervisorId !== (u.supervisorId ?? '')
  const mudouBasico = nome.trim() !== u.nome || whats.trim() !== u.whatsapp || !mesmosPapeis(papeis, u.papeis)
  const sujo = mudouConexao || mudouSupervisor || mudouBasico
  const valido = !!nome.trim() && !!whats.trim() && papeis.length > 0

  // Visitantes que dependem desta pessoa (responsável ou líder designado)
  const dependentes = s.visitantes.filter((v) => v.responsavelId === u.id || v.liderConexaoId === u.id)
  const aprovador = usuarioPorId(s, u.aprovadoPorId)

  async function tentarFechar() {
    if (sujo && !(await confirmar({
      titulo: 'Descartar alterações?', mensagem: `Você alterou dados de ${u.nome} que ainda não foram salvos.`,
      confirmar: 'Descartar', perigo: true,
    }))) return
    onFechar()
  }

  async function salvar() {
    if (!valido || !sujo) return
    // Valida tudo ANTES de gravar qualquer coisa: se algo falhar, nada muda.
    if (mudouSupervisor && supervisorId && criariCiclo(s, u.id, supervisorId)) {
      toast(`Não é possível: ${u.nome} já supervisiona (direta ou indiretamente) essa pessoa. Isso criaria um ciclo na hierarquia.`, 'erro')
      return
    }
    if (mudouConexao && u.conexaoId && conexaoId) {
      const atual = s.conexoes.find((c) => c.id === u.conexaoId)?.nome ?? 'outro grupo'
      const nova = s.conexoes.find((c) => c.id === conexaoId)?.nome ?? ''
      if (!(await confirmar({ titulo: `Trocar o ${termoGrupo.toLowerCase()} do líder`, mensagem: `${u.nome} já é líder de "${atual}".\n\nConfirmar a mudança para "${nova}"?`, confirmar: 'Confirmar mudança' }))) return
    }

    if (mudouBasico) {
      setEstado((st) => ({
        ...st,
        usuarios: st.usuarios.map((x) =>
          x.id === u.id ? { ...x, nome: nome.trim(), whatsapp: whats.trim(), papeis } : x,
        ),
      }))
      const mudou = [
        nome.trim() !== u.nome ? `nome: "${u.nome}" → "${nome.trim()}"` : '',
        whats.trim() !== u.whatsapp ? 'WhatsApp' : '',
        !mesmosPapeis(papeis, u.papeis) ? `funções: ${papeis.map((p) => rotuloPapel(p)).join(', ')}` : '',
      ].filter(Boolean).join(' · ')
      registrarAuditoria('✏️ Editou integrante', { alvoTipo: 'usuario', alvoId: u.id, alvoNome: nome.trim(), detalhe: mudou })
    }

    if (mudouConexao) {
      setEstado((st) => ({
        ...st,
        usuarios: st.usuarios.map((x) => x.id === u.id ? { ...x, conexaoId: conexaoId || undefined } : x),
        conexoes: st.conexoes.map((c) => {
          let cx = c
          if (c.id === u.conexaoId) {
            if (cx.liderId === u.id) cx = { ...cx, liderId: undefined }
            if (cx.lider2Id === u.id) cx = { ...cx, lider2Id: undefined }
          }
          if (c.id === conexaoId) {
            if (!cx.liderId) cx = { ...cx, liderId: u.id }
            else if (!cx.lider2Id) cx = { ...cx, lider2Id: u.id }
          }
          return cx
        }),
      }))
      registrarAuditoria('✏️ Alterou o grupo do líder', {
        alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
        detalhe: `${s.conexoes.find((c) => c.id === u.conexaoId)?.nome ?? 'sem grupo'} → ${s.conexoes.find((c) => c.id === conexaoId)?.nome ?? 'sem grupo'}`,
      })
    }

    if (mudouSupervisor) definirSupervisor(s, u, supervisorId)

    toast('Membro salvo')
    onFechar()
  }

  function alternarAtivo() {
    setEstado((st) => ({
      ...st,
      usuarios: st.usuarios.map((x) => x.id === u.id ? { ...x, ativo: !u.ativo } : x),
    }))
    registrarAuditoria(u.ativo ? '⏸ Desativou integrante' : '▶ Reativou integrante', {
      alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
    })
    toast(u.ativo ? 'Membro desativado' : 'Membro reativado', 'info')
    onFechar()
  }

  async function remover() {
    const aviso = dependentes.length > 0
      ? `\n\n⚠️ ${u.nome} cuida de ${dependentes.length} visitante(s) — eles ficarão SEM responsável/líder e precisarão ser redistribuídos. Se a pessoa só saiu por um tempo, prefira "Desativar".`
      : ''
    if (!(await confirmar({ titulo: 'Remover integrante', mensagem: `Remover ${u.nome} da equipe? Esta ação não pode ser desfeita.${aviso}`, confirmar: 'Excluir', perigo: true }))) return
    const authUserId = u.authUserId
    const agora = new Date().toISOString()
    setEstado((st) => comExclusoes({
      ...st,
      usuarios: st.usuarios.filter((x) => x.id !== u.id),
      // Solta os vínculos de vez: visitante com responsável "fantasma" não
      // aparecia em nenhum filtro, e ninguém o reassumia.
      visitantes: st.visitantes.map((v) =>
        v.responsavelId === u.id || v.liderConexaoId === u.id
          ? {
            ...v,
            responsavelId: v.responsavelId === u.id ? undefined : v.responsavelId,
            liderConexaoId: v.liderConexaoId === u.id ? undefined : v.liderConexaoId,
            atualizadoEm: agora,
          }
          : v,
      ),
      conexoes: st.conexoes.map((c) => {
        let cx = c
        if (cx.liderId === u.id) cx = { ...cx, liderId: undefined }
        if (cx.lider2Id === u.id) cx = { ...cx, lider2Id: undefined }
        return cx
      }),
    }, 'usuario', [u.id]))
    registrarAuditoria('🗑️ Removeu integrante da equipe', {
      alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
      detalhe: `Funções: ${u.papeis.map((p) => rotuloPapel(p)).join(', ')}` +
        (dependentes.length > 0 ? ` · ${dependentes.length} visitante(s) ficaram sem responsável/líder: ${dependentes.map((v) => v.nome).join(', ')}` : ''),
    })
    if (authUserId && supabase) {
      try {
        await supabase.functions.invoke('deletar-usuario-auth', { body: { authUserId } })
      } catch {
        // falha silenciosa: o usuário já foi removido do app
      }
    }
    onFechar()
  }

  async function copiarLinkCadastro() {
    const link = `${window.location.origin}${window.location.pathname}#/cadastro-integrante`
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado — envie à pessoa')
    } catch {
      toast(link, 'info')
    }
  }

  const candidatos = s.usuarios.filter((x) => x.id !== u.id && x.ativo)

  return (
    <Gaveta rotulo={`Editar ${u.nome}`} onFechar={() => void tentarFechar()}>
      <header className="eq-g-cab">
        <Avatar nome={nome || u.nome} tom={PAPEL_COR[papeis[0]]} foto={u.fotoUrl} tamanho="g" />
        <div className="eq-g-id">
          <h2>{u.nome}</h2>
          <ChipsPapeis papeis={u.papeis} />
          <div className="eq-g-contato">
            <span><IcoWhats size={12} /> {u.whatsapp}</span>
            {u.email && <span><IcoEmail size={12} /> {u.email}</span>}
          </div>
        </div>
        <button type="button" className="btn-icone" onClick={() => void tentarFechar()} title="Fechar" aria-label="Fechar"><IcoX size={16} /></button>
      </header>

      <div className="eq-g-corpo">
        <section className="eq-g-secao">
          <h3>Dados</h3>
          <label className="campo"><span>Nome</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>
          <label className="campo"><span>WhatsApp</span>
            <input type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} />
          </label>
        </section>

        <section className="eq-g-secao">
          <h3>Funções <small>marque todas que a pessoa exerce</small></h3>
          <SeletorFuncoes papeis={papeis} onMudar={setPapeis} />
        </section>

        <section className="eq-g-secao">
          <h3>Organização</h3>
          {papeis.includes('lider') && (
            <label className="campo"><span>{termoGrupo} que lidera</span>
              <select value={conexaoId} onChange={(e) => setConexaoId(e.target.value)}>
                <option value="">— sem {termoGrupo.toLowerCase()} —</option>
                {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}
          <label className="campo"><span>Supervisor <em className="campo-dica">(vê o acompanhamento desta pessoa)</em></span>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
              <option value="">— ninguém acima —</option>
              {candidatos.map((x) => (
                <option key={x.id} value={x.id}>{x.nome} · {x.papeis.map((p) => rotuloPapel(p)).join(', ')}</option>
              ))}
            </select>
          </label>
          <p className="eq-g-nota">
            {dependentes.length === 0
              ? 'Não cuida de nenhum visitante no momento.'
              : <>Cuida de <b>{dependentes.length}</b> {dependentes.length === 1 ? 'visitante' : 'visitantes'} agora.</>}
          </p>
        </section>

        <section className="eq-g-secao">
          <h3>Acesso ao sistema</h3>
          <div className="eq-g-acesso">
            <ChipAcesso u={u} />
            <span>
              {u.statusAcesso === 'sem_login' && 'Ainda não tem login com senha. Envie o link de cadastro para a pessoa criar o acesso — a liderança aprova depois.'}
              {u.statusAcesso === 'pendente_aprovacao' && 'Pediu acesso e aguarda a aprovação da liderança.'}
              {u.statusAcesso === 'pendente_confirmacao_email' && 'Ainda não confirmou o e-mail.'}
              {u.statusAcesso === 'aprovado' && `Entra com ${u.email ?? 'login próprio'}${u.aprovadoEm ? ` · liberado em ${dataBR(u.aprovadoEm)}${aprovador ? ` por ${aprovador.nome}` : ''}` : ''}.`}
              {u.statusAcesso === 'rejeitado' && `Acesso recusado${u.motivoRejeicao ? `: ${u.motivoRejeicao}` : ''}.`}
            </span>
          </div>
          <div className="eq-g-acoes-linha">
            {u.statusAcesso === 'sem_login' && (
              <button type="button" className="btn btn-sec btn-mini" onClick={() => void copiarLinkCadastro()}><IcoCopiar size={13} /> Copiar link de cadastro</button>
            )}
            {u.statusAcesso === 'pendente_aprovacao' && (
              <button type="button" className="btn btn-sec btn-mini" onClick={() => navegar('/aprovacoes')}>Abrir Aprovações</button>
            )}
            <a className="btn btn-sec btn-mini eq-g-whats" href={linkWhatsApp(u.whatsapp)} target="_blank" rel="noreferrer"><IcoWhats size={13} /> Chamar no WhatsApp</a>
          </div>
        </section>

        <section className="eq-g-secao eq-g-perigo">
          <h3>Situação na equipe</h3>
          <div className="eq-g-linha-acao">
            <p>{u.ativo ? <><b>Desativar</b> bloqueia o acesso e tira a pessoa das listas, sem apagar o histórico.</> : <>Esta pessoa está <b>inativa</b>: não acessa o sistema nem aparece nas listas.</>}</p>
            <button type="button" className="btn btn-sec btn-mini" onClick={alternarAtivo}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
          <div className="eq-g-linha-acao">
            <p><b>Excluir</b> remove a pessoa de vez e libera o e-mail. Não tem volta.</p>
            <button type="button" className="btn btn-mini btn-perigo-forte" onClick={() => void remover()}><IcoLixeira size={13} /> Excluir</button>
          </div>
        </section>
      </div>

      <footer className="eq-g-rodape">
        <button type="button" className="btn" onClick={() => void salvar()} disabled={!valido || !sujo}>
          <IcoCheck size={14} /> Salvar alterações
        </button>
        <button type="button" className="btn btn-sec" onClick={() => void tentarFechar()}>Cancelar</button>
        {sujo && <span className="eq-g-pend">Alterações não salvas</span>}
      </footer>
    </Gaveta>
  )
}
