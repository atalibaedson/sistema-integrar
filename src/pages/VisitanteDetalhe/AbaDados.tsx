import { useState } from 'react'
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
  const [cep, setCep] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)
  const m = (patch: Partial<Visitante>) => atualizarVisitante(v.id, patch)

  async function buscarCep(nums: string) {
    setBuscandoCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${nums}/json/`)
      const d = await r.json()
      if (!d.erro) {
        m({ endereco: d.logradouro || undefined, bairro: d.bairro || undefined, cidade: d.localidade || undefined })
      }
    } catch {}
    setBuscandoCep(false)
  }

  return (
    <div className="card">
      <div className="secao-header" style={{ marginBottom: 14 }}>
        <span>👤 Dados</span>
        <span className="secao-cont">alterações salvas automaticamente</span>
      </div>

      {/* ---- Contato ---- */}
      <div className="dados-secao" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
        <div className="dados-secao-titulo">📞 Contato</div>
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
          <label className="campo"><span>Situação civil</span>
            <select value={v.situacaoCivil ?? ''} onChange={(e) => m({ situacaoCivil: (e.target.value || undefined) as SituacaoCivil | undefined })}>
              <option value="">—</option>
              {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <div className="campo" />
        </div>
      </div>

      {/* ---- Localização ---- */}
      <div className="dados-secao">
        <div className="dados-secao-titulo">📍 Localização</div>
        <div className="linha-campos">
          <label className="campo">
            <span>CEP <em className="campo-dica">(preenche automaticamente)</em></span>
            <div style={{ position: 'relative' }}>
              <input
                type="text" value={cep} maxLength={9} placeholder="00000-000"
                onChange={(e) => {
                  const nums = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const fmt = nums.length > 5 ? `${nums.slice(0, 5)}-${nums.slice(5)}` : nums
                  setCep(fmt)
                  if (nums.length === 8) buscarCep(nums)
                }}
              />
              {buscandoCep && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-3)', pointerEvents: 'none' }}>
                  buscando…
                </span>
              )}
            </div>
          </label>
          <div className="campo" />
        </div>
        <label className="campo"><span>Endereço</span>
          <input type="text" value={v.endereco ?? ''} onChange={(e) => m({ endereco: e.target.value || undefined })} placeholder="Rua e número" />
        </label>
        <div className="linha-campos">
          <label className="campo"><span>Bairro</span>
            <input type="text" value={v.bairro ?? ''} onChange={(e) => m({ bairro: e.target.value || undefined })} />
          </label>
          <label className="campo"><span>Cidade</span>
            <input type="text" value={v.cidade ?? ''} onChange={(e) => m({ cidade: e.target.value || undefined })} />
          </label>
        </div>
      </div>

      {/* ---- Visita ---- */}
      <div className="dados-secao">
        <div className="dados-secao-titulo">⛪ Visita</div>
        <div className="linha-campos">
          <label className="campo"><span>1ª visita (culto)</span>
            <select value={v.cultoPrimeiraVisita ?? ''} onChange={(e) => m({ cultoPrimeiraVisita: e.target.value || undefined })}>
              <option value="">—</option>
              {s.config.cultos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="campo"><span>Data da 1ª visita</span>
            <CampoData value={v.dataPrimeiraVisita ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => m({ dataPrimeiraVisita: iso || undefined })} />
          </div>
        </div>
        <div className="linha-campos">
          <label className="campo"><span>Como conheceu a igreja</span>
            <select value={v.comoConheceu ?? ''} onChange={(e) => m({ comoConheceu: e.target.value || undefined })}>
              <option value="">—</option>
              {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <div className="linha-campos" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="campo"><span>Primeira vez?</span>
              <select value={v.primeiraVez === undefined ? '' : v.primeiraVez ? 'sim' : 'nao'} onChange={(e) => m({ primeiraVez: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
                <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </label>
          </div>
        </div>
        <div className="linha-campos">
          <label className="campo"><span>Membro de outra igreja?</span>
            <select value={v.membroOutraIgreja === undefined ? '' : v.membroOutraIgreja ? 'sim' : 'nao'} onChange={(e) => m({ membroOutraIgreja: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
              <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
            </select>
          </label>
          <label className="campo"><span>Origem do cadastro</span>
            <input type="text" value={`${ORIGEM_LABEL[v.origem]} · ${fmt(v.dataCadastro)}`} readOnly style={{ background: 'var(--surface2)' }} />
          </label>
        </div>
      </div>

      {/* ---- Batismo ---- */}
      <div className="bloco-destaque">
        <div className="bloco-destaque-titulo">💧 Situação de batismo</div>
        <p className="descricao-secao" style={{ marginTop: 0 }}>
          Quem já chega batizado não precisa de batismo para virar membro — serve para não convidar quem já foi.
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
              <CampoData value={v.dataBatismo ?? ''} onChange={(iso) => registrarBatismo(v.id, v.situacaoBatismo, iso || undefined)} />
            </div>
          )}
        </div>
      </div>

      {/* ---- Membresia ---- */}
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
              ⚠️ <div>Está como membro, mas <b>sem a data</b>. Preencha acima — sem ela a pessoa não aparece nos relatórios por período.</div>
            </div>
          )}
        </div>
      )}

      {/* ---- Preferências ---- */}
      <div className="dados-secao">
        <div className="dados-secao-titulo">💬 Preferências e contato</div>
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
      </div>

      <div className={`alerta ${v.consentimentoLgpd ? 'alerta-info' : 'alerta-warn'}`} style={{ marginTop: 14 }}>
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
          Remove este cadastro e o histórico por completo. Não tem volta. Se a pessoa só não quer mais ser contatada, prefira mudar o status para "Recusou".
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
