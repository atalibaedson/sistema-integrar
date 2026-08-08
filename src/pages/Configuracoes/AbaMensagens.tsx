import { useState } from 'react'
import { comExclusoes, GATILHOS_FIXOS, setEstado, uid, useAppState } from '../../store'
import { rotuloEtapa, type EtapaFluxo, type Template } from '../../types'
import { BotaoSalvar } from '../../campos'
import { toast } from '../../toast'
import { IcoMais } from '../../icones'

/* ---------------- Aba: Mensagens ---------------- */

export default function AbaMensagens() {
  const s = useAppState()
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [etapaNova, setEtapaNova] = useState<EtapaFluxo>('geral')

  const fixos = s.templates.filter((t) => (GATILHOS_FIXOS as readonly string[]).includes(t.gatilho))
  const extras = s.templates.filter((t) => !(GATILHOS_FIXOS as readonly string[]).includes(t.gatilho))
  const etapasComExtra = (Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).filter((e) => extras.some((t) => t.etapa === e))

  function editar(id: string, patch: Partial<Template>) {
    setEstado((st) => ({
      ...st,
      templates: st.templates.map((x) => x.id === id ? { ...x, ...patch } : x),
    }))
  }

  return (
    <>
      <div className="card">
        <h3>💡 Variáveis disponíveis</h3>
        <p className="descricao-secao" style={{ marginBottom: 8 }}>
          Escreva o texto e use estas marcações — elas são trocadas pelos dados reais na hora de enviar:
        </p>
        <div className="ac-opcoes">
          <span className="tag" style={{ fontFamily: 'monospace' }}>{'{{nome}}'} → primeiro nome do visitante</span>
          <span className="tag" style={{ fontFamily: 'monospace' }}>{'{{nome_conexão}}'} → nome da {s.config.termoGrupo || 'Conexão'} do visitante</span>
        </div>
      </div>

      <div className="card">
        <h3>Mensagens do fluxo</h3>
        <p className="descricao-secao">
          Usadas pelos botões "💬 Enviar" do sistema. Estas não podem ser excluídas (fazem parte do fluxo),
          mas o texto é todo seu. Edite e clique em <b>Salvar</b> em cada uma.
        </p>
        {fixos.map((t) => <MensagemFixaEditor key={t.id} t={t} onSalvar={editar} />)}
      </div>

      <div className="card">
        <h3>Minhas mensagens ({extras.length})</h3>
        <p className="descricao-secao">
          Mensagens extras da sua igreja. Escolha em qual etapa do fluxo cada uma pode ser usada — se houver mais de
          uma na mesma etapa, o botão de enviar mostra uma opção para selecionar qual mandar.
        </p>

        {extras.length === 0 && <div className="vazio" style={{ padding: '14px 0' }}>Nenhuma mensagem extra ainda.</div>}

        {etapasComExtra.map((etapa) => (
          <div key={etapa} style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-2)', marginBottom: 8 }}>
              {rotuloEtapa(etapa)}
            </h4>
            {extras.filter((t) => t.etapa === etapa).map((t) => (
              <div key={t.id} style={{ marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div className="linha-campos">
                  <label className="campo"><span>Título</span>
                    <input type="text" value={t.titulo} onChange={(e) => editar(t.id, { titulo: e.target.value })} />
                  </label>
                  <label className="campo"><span>Etapa do fluxo</span>
                    <select value={t.etapa} onChange={(e) => editar(t.id, { etapa: e.target.value as EtapaFluxo })}>
                      {(Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{rotuloEtapa(e)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="campo" style={{ marginBottom: 6 }}>
                  <span>Texto (use {'{{nome}}'} e {'{{nome_conexão}}'})</span>
                  <textarea value={t.texto} onChange={(e) => editar(t.id, { texto: e.target.value })} />
                </label>
                <button
                  className="btn btn-sec btn-mini"
                  onClick={() => { setEstado((st) => comExclusoes({ ...st, templates: st.templates.filter((x) => x.id !== t.id) }, 'template', [t.id])); toast('Mensagem excluída', 'info') }}
                >🗑️ Excluir</button>
              </div>
            ))}
          </div>
        ))}

        <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <h4 style={{ fontSize: 13, marginBottom: 8 }}>Nova mensagem</h4>
        <div className="linha-campos">
          <label className="campo"><span>Título da nova mensagem</span>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex.: Convite para o batismo" />
          </label>
          <label className="campo"><span>Etapa do fluxo</span>
            <select value={etapaNova} onChange={(e) => setEtapaNova(e.target.value as EtapaFluxo)}>
              {(Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{rotuloEtapa(e)}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Texto (use {'{{nome}}'} e {'{{nome_conexão}}'})</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Olá, {{nome}}! …" />
        </label>
        <button
          className="btn"
          onClick={() => {
            if (!titulo.trim() || !texto.trim()) return
            setEstado((st) => ({
              ...st,
              templates: [...st.templates, { id: uid(), gatilho: `custom_${uid()}`, titulo: titulo.trim(), texto: texto.trim(), etapa: etapaNova }],
            }))
            setTitulo(''); setTexto(''); setEtapaNova('geral')
            toast('Mensagem adicionada')
          }}
        ><IcoMais size={14} /> Adicionar mensagem</button>
      </div>
    </>
  )
}

// Ordem das etapas nos seletores (mantém o fluxo legível)
const ETAPAS_ORDEM: Record<EtapaFluxo, true> = {
  aproximacao: true, conexao: true, celebracao: true, pre_visita: true, aviso_lider: true, reengajamento: true, geral: true,
}

// Editor de uma mensagem fixa: rascunho + botão salvar (segurança de "salvou?")
function MensagemFixaEditor({ t, onSalvar }: { t: Template; onSalvar: (id: string, patch: Partial<Template>) => void }) {
  const [texto, setTexto] = useState(t.texto)
  const pendente = texto !== t.texto
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="campo" style={{ marginBottom: 4 }}>
        <span>{t.titulo} <span className="tag" style={{ marginLeft: 6 }}>{rotuloEtapa(t.etapa)}</span></span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <BotaoSalvar pendente={pendente} onSalvar={() => { onSalvar(t.id, { texto }); toast('Mensagem salva') }} rotulo="Salvar mensagem" />
    </div>
  )
}
