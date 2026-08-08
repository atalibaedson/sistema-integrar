import { useAppState } from '../../store'
import {
  HORARIO_CONTATO_LABEL, OPCOES_DESEJA_CONEXAO, ORIGEM_LABEL, SITUACAO_BATISMO_LABEL, SITUACAO_CIVIL_LABEL,
  type HorarioContato, type SituacaoBatismo, type SituacaoCivil, type Visitante,
} from '../../types'
import { atualizarVisitante, excluirVisitante, registrarBatismo } from '../../actions'
import { SeletorData as CampoData } from '../../campos'
import { navegar } from '../../router'
import { IcoLixeira } from '../../icones'
import { fmt } from './comum'

/* ================= Aba: Dados (editável) ================= */

export default function AbaDados({ v }: { v: Visitante }) {
  const s = useAppState()
  const m = (patch: Partial<Visitante>) => atualizarVisitante(v.id, patch)

  return (
    <div className="card">
      <h3>Dados do visitante</h3>
      <p className="descricao-secao">Alterações são salvas automaticamente.</p>
      <div className="linha-campos">
        <label className="campo"><span>Nome</span>
          <input type="text" value={v.nome} onChange={(e) => m({ nome: e.target.value })} />
        </label>
        <label className="campo"><span>WhatsApp</span>
          <input type="tel" value={v.whatsapp} onChange={(e) => m({ whatsapp: e.target.value })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>E-mail</span>
          <input type="email" value={v.email ?? ''} onChange={(e) => m({ email: e.target.value || undefined })} />
        </label>
        <div className="campo"><span>Data de nascimento</span>
          <CampoData value={v.dataNascimento ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => m({ dataNascimento: iso || undefined })} />
        </div>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Endereço</span>
          <input type="text" value={v.endereco ?? ''} onChange={(e) => m({ endereco: e.target.value || undefined })} placeholder="Rua e número" />
        </label>
        <label className="campo"><span>Bairro</span>
          <input type="text" value={v.bairro ?? ''} onChange={(e) => m({ bairro: e.target.value || undefined })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Cidade</span>
          <input type="text" value={v.cidade ?? ''} onChange={(e) => m({ cidade: e.target.value || undefined })} />
        </label>
        <label className="campo"><span>Situação civil</span>
          <select value={v.situacaoCivil ?? ''} onChange={(e) => m({ situacaoCivil: (e.target.value || undefined) as SituacaoCivil | undefined })}>
            <option value="">—</option>
            {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="campo"><span>1ª visita (culto)</span>
          <select value={v.cultoPrimeiraVisita ?? ''} onChange={(e) => m({ cultoPrimeiraVisita: e.target.value || undefined })}>
            <option value="">—</option>
            {s.config.cultos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="linha-campos">
        <div className="campo"><span>Data da 1ª visita</span>
          <CampoData value={v.dataPrimeiraVisita ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => m({ dataPrimeiraVisita: iso || undefined })} />
        </div>
        <div className="campo" />
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Como conheceu a igreja</span>
          <select value={v.comoConheceu ?? ''} onChange={(e) => m({ comoConheceu: e.target.value || undefined })}>
            <option value="">—</option>
            {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="campo"><span>Origem do cadastro</span>
          <input type="text" value={`${ORIGEM_LABEL[v.origem]} · ${fmt(v.dataCadastro)}`} readOnly style={{ background: 'var(--surface2)' }} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Primeira vez na igreja?</span>
          <select value={v.primeiraVez === undefined ? '' : v.primeiraVez ? 'sim' : 'nao'} onChange={(e) => m({ primeiraVez: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
            <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        <label className="campo"><span>Membro de outra igreja?</span>
          <select value={v.membroOutraIgreja === undefined ? '' : v.membroOutraIgreja ? 'sim' : 'nao'} onChange={(e) => m({ membroOutraIgreja: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
            <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
      </div>

      {/* Batismo: fato da pessoa, não etapa do funil. Fica aqui (e não no roteiro)
          justamente porque pode ser preenchido em qualquer momento da jornada. */}
      <div className="bloco-destaque">
        <div className="bloco-destaque-titulo">💧 Situação de batismo</div>
        <p className="descricao-secao" style={{ marginTop: 0 }}>
          Não é etapa da jornada — quem já chega batizado não precisa de batismo para virar membro.
          Serve para não convidar ao batismo quem já é batizado, e para saber quem ainda pode ser convidado.
        </p>
        <div className="linha-campos">
          <label className="campo"><span>Situação</span>
            <select
              value={v.situacaoBatismo ?? ''}
              onChange={(e) => registrarBatismo(v.id, (e.target.value || undefined) as SituacaoBatismo | undefined, v.dataBatismo)}
            >
              <option value="">— ainda não sabemos —</option>
              {Object.entries(SITUACAO_BATISMO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {v.situacaoBatismo && v.situacaoBatismo !== 'nao_batizado' && (
            <div className="campo"><span>Data do batismo <em className="campo-dica">(se souber)</em></span>
              <CampoData
                value={v.dataBatismo ?? ''}
                onChange={(iso) => registrarBatismo(v.id, v.situacaoBatismo, iso || undefined)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Data da membresia editável aqui, e não só no momento de concluir a
          jornada: quem chega a "Membro" pelo quadro da Jornada ou por uma
          correção manual de status entra sem data, e sem este campo não haveria
          como preencher depois — só desfazendo o status. */}
      {(v.status === 'integrado' || v.dataMembresia) && (
        <div className="bloco-destaque">
          <div className="bloco-destaque-titulo">🎉 Membresia</div>
          <p className="descricao-secao" style={{ marginTop: 0 }}>
            O dia em que a pessoa foi recebida como membro — é o que conclui a jornada.
          </p>
          <div className="linha-campos">
            <div className="campo"><span>Data em que virou membro</span>
              <CampoData value={v.dataMembresia ?? ''} onChange={(iso) => m({ dataMembresia: iso || undefined })} />
            </div>
            <div className="campo" />
          </div>
          {v.status === 'integrado' && !v.dataMembresia && (
            <div className="alerta alerta-warn" style={{ marginBottom: 0 }}>
              ⚠️ <div>Está como membro, mas <b>sem a data</b> registrada. Preencha acima — sem ela, a pessoa não aparece nos relatórios por período.</div>
            </div>
          )}
        </div>
      )}
      <div className="linha-campos">
        <label className="campo"><span>Quer participar de uma {s.config.termoGrupo || 'Conexão'}?</span>
          <select value={v.desejaConexao ?? ''} onChange={(e) => m({ desejaConexao: e.target.value || undefined })}>
            <option value="">—</option>
            {OPCOES_DESEJA_CONEXAO.map((o) => <option key={o} value={o}>{o}</option>)}
            {v.desejaConexao && !(OPCOES_DESEJA_CONEXAO as readonly string[]).includes(v.desejaConexao) && (
              <option value={v.desejaConexao}>{v.desejaConexao}</option>
            )}
          </select>
        </label>
        <label className="campo"><span>Deseja contato? · melhor horário</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={v.desejaContato === undefined ? '' : v.desejaContato ? 'sim' : 'nao'} onChange={(e) => m({ desejaContato: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
              <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
            </select>
            <select value={v.melhorHorarioContato ?? ''} onChange={(e) => m({ melhorHorarioContato: (e.target.value || undefined) as HorarioContato | undefined })}>
              <option value="">horário</option>
              {(Object.keys(HORARIO_CONTATO_LABEL) as HorarioContato[]).map((h) => <option key={h} value={h}>{HORARIO_CONTATO_LABEL[h]}</option>)}
            </select>
          </div>
        </label>
      </div>
      <label className="campo"><span>🙏 Pedido de oração</span>
        <textarea value={v.pedidoOracao ?? ''} onChange={(e) => m({ pedidoOracao: e.target.value || undefined })} placeholder="O que a pessoa pediu para orarmos." />
      </label>
      <label className="campo"><span>Observações (equipe)</span>
        <textarea value={v.observacoes ?? ''} onChange={(e) => m({ observacoes: e.target.value || undefined })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={v.flagMenorIdade} onChange={(e) => m({ flagMenorIdade: e.target.checked })} />
        Menor de idade (contato com o responsável)
      </label>

      <div className={`alerta ${v.consentimentoLgpd ? 'alerta-info' : 'alerta-warn'}`} style={{ marginTop: 4 }}>
        {v.consentimentoLgpd ? '✅' : '⚠️'} <div>
          <b>Consentimento LGPD:</b> {v.consentimentoLgpd
            ? <>autorizado{v.consentimentoLgpdData ? ` em ${fmt(v.consentimentoLgpdData)}` : ''}.</>
            : 'não registrado — este cadastro é anterior a esse controle, ou o consentimento não foi confirmado.'}
        </div>
      </div>

      <hr style={{ margin: '18px 0 14px', border: 'none', borderTop: '1px solid var(--border)' }} />
      <details>
        <summary style={{ color: 'var(--danger)' }}>Cadastrou por engano? Excluir este visitante</summary>
        <p className="descricao-secao" style={{ marginTop: 8 }}>
          Remove este cadastro e o histórico de contatos por completo — use para duplicados ou testes.
          Não tem volta. Se a pessoa só não quer mais ser contatada, prefira mudar o status para "Recusou".
        </p>
        <button
          className="btn btn-perigo btn-mini"
          onClick={() => {
            if (!confirm(`Excluir o cadastro de "${v.nome}" para sempre? Esta ação não pode ser desfeita.`)) return
            excluirVisitante(v.id, 'Cadastro feito por engano')
            navegar('/visitantes')
          }}
        ><IcoLixeira size={13} /> Excluir cadastro</button>
      </details>
    </div>
  )
}
