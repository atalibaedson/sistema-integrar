import { useEffect, useState } from 'react'
import { useAppState } from '../../store'
import { type Visitante } from '../../types'
import { atualizarVisitante, marcarMembresia, prontidaoMembro } from '../../actions'
import { SeletorData as CampoData } from '../../campos'

export function fmt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
export function fmtDia(iso: string): string {
  // "2026-08-01" (só data) é interpretado como meia-noite UTC pelo Date — no
  // fuso do Brasil isso vira o dia ANTERIOR. Datas de batismo, membresia e 1ª
  // visita são salvas nesse formato, então precisam ser lidas como data local.
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const d = soData ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

/**
 * Escolha de data a partir do calendário cadastrado em Configurações.
 *
 * Batismo e recepção de membros não acontecem em qualquer dia: são eventos com
 * data marcada. Escolher numa lista evita o erro de digitação na pressa. Mas a
 * vida não cabe sempre no calendário — por isso sempre existe a saída "outra
 * data", que abre o campo livre. Sem datas cadastradas, cai direto no campo livre.
 */
export function SeletorData({ datas, valor, onMudar, rotulo }: {
  datas: string[]
  valor: string
  onMudar: (d: string) => void
  rotulo: string
}) {
  const cadastradas = [...new Set(datas)].filter(Boolean).sort()
  const [livre, setLivre] = useState(cadastradas.length === 0)
  const semCalendario = cadastradas.length === 0 || livre

  // Mantém o valor coerente com o modo, senão o botão salva uma data que a
  // pessoa não escolheu: no modo lista, um valor fora da lista não está
  // realmente selecionado (o select mostra "escolher a data") e precisa ser
  // zerado; no modo livre, começar em hoje é o atalho útil.
  useEffect(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    if (semCalendario && !valor) onMudar(hoje)
    if (!semCalendario && valor && !cadastradas.includes(valor)) onMudar('')
  }, [semCalendario, valor])

  if (semCalendario) {
    return (
      <div className="campo" style={{ marginBottom: 0, maxWidth: 210 }}>
        <span>{rotulo}</span>
        <CampoData value={valor} onChange={onMudar} />
        {cadastradas.length > 0 && (
          <a href="#/" onClick={(e) => { e.preventDefault(); setLivre(false) }} style={{ fontSize: 11.5, marginTop: 4, display: 'inline-block' }}>
            ← escolher uma data do calendário
          </a>
        )}
      </div>
    )
  }

  return (
    <label className="campo" style={{ marginBottom: 0, maxWidth: 230 }}>
      <span>{rotulo}</span>
      <select
        value={cadastradas.includes(valor) ? valor : ''}
        onChange={(e) => {
          if (e.target.value === '__outra__') { setLivre(true); return }
          onMudar(e.target.value)
        }}
      >
        <option value="">— escolher a data —</option>
        {cadastradas.map((d) => <option key={d} value={d}>{fmtDia(d)}</option>)}
        <option value="__outra__">Outra data…</option>
      </select>
    </label>
  )
}

/**
 * Data em que a pessoa começou a frequentar o grupo — preenchida pelo líder.
 * É a base do requisito de tempo mínimo para virar membro.
 */
export function CampoInicioConexao({ v }: { v: Visitante }) {
  const s = useAppState()
  const grupo = s.config.termoGrupo || 'Conexão'
  return (
    <div className="campo" style={{ marginBottom: 0, maxWidth: 230 }}>
      <span>Começou a frequentar a {grupo} em</span>
      <CampoData
        value={v.dataInicioConexao ?? ''}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(iso) => atualizarVisitante(v.id, { dataInicioConexao: iso || undefined })}
      />
    </div>
  )
}

/**
 * Botão de concluir a jornada (virar membro), com a checagem de prontidão que a
 * liderança do grupo faz antes: tempo mínimo frequentando o grupo (calculado da
 * data de início) e confirmação de frequência. O tempo pode ser liberado como
 * exceção — a vida nem sempre cabe na regra —, e tudo o que foi confirmado fica
 * registrado no histórico. As exigências são configuráveis (0 desliga cada uma).
 *
 * `primaria` controla só o destaque visual do botão: nos passos onde virar
 * membro é o próximo marco natural ele vem como ação principal; senão, secundária.
 */
export function BotaoVirarMembro({ v, primaria }: { v: Visitante; primaria: boolean }) {
  const s = useAppState()
  const [dataMembresia, setDataMembresia] = useState('')
  const [freqOk, setFreqOk] = useState(false)
  const [excecao, setExcecao] = useState(false)
  const pr = prontidaoMembro(s, v)
  const primeiroNome = v.nome.split(' ')[0]
  const grupo = s.config.termoGrupo || 'Conexão'

  const tempoLiberado = pr.tempoOk || excecao
  const freqLiberado = !pr.exigeFrequencia || freqOk
  const podeConcluir = !!dataMembresia && tempoLiberado && freqLiberado

  // O que a liderança confirmou na hora — vai para o histórico da membresia.
  const obs = [
    pr.exigeFrequencia && freqOk ? `frequência acima de ${pr.frequenciaMinima}% confirmada` : '',
    pr.exigeTempo && !pr.tempoOk && excecao ? `exceção ao tempo mínimo (${pr.meses ?? 0}/${pr.mesesMinimos} meses no grupo)` : '',
  ].filter(Boolean).join('; ')

  const plural = (n: number) => (n === 1 ? 'mês' : 'meses')

  return (
    <div>
      {pr.regraAtiva && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--bg)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Antes de receber {primeiroNome} como membro:
          </div>

          {pr.exigeTempo && (
            <div style={{ marginBottom: pr.exigeFrequencia ? 10 : 0 }}>
              {!pr.temDataInicio ? (
                <>
                  <p className="rot-sub" style={{ margin: '0 0 6px' }}>
                    ⏳ Informe quando {primeiroNome} começou a frequentar a {grupo} — o mínimo é {pr.mesesMinimos} {plural(pr.mesesMinimos)}.
                  </p>
                  <CampoInicioConexao v={v} />
                </>
              ) : pr.tempoOk ? (
                <p className="rot-sub" style={{ margin: 0 }}>
                  ✅ Frequenta a {grupo} há <b>{pr.meses} {plural(pr.meses!)}</b> (mínimo {pr.mesesMinimos}).
                </p>
              ) : (
                <>
                  <p className="rot-sub" style={{ margin: '0 0 4px' }}>
                    ⚠️ Frequenta a {grupo} há <b>{pr.meses} {plural(pr.meses!)}</b> — o mínimo é {pr.mesesMinimos} {plural(pr.mesesMinimos)}.
                  </p>
                  <label className="check" style={{ marginBottom: 0 }}>
                    <input type="checkbox" checked={excecao} onChange={(e) => setExcecao(e.target.checked)} />
                    Receber mesmo assim, como exceção
                  </label>
                </>
              )}
            </div>
          )}

          {pr.exigeFrequencia && (
            <label className="check" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={freqOk} onChange={(e) => setFreqOk(e.target.checked)} />
              Confirmo que {primeiroNome} teve mais de {pr.frequenciaMinima}% de frequência na {grupo} nesse período.
            </label>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <SeletorData
          datas={s.config.datasMembresia} valor={dataMembresia} onMudar={setDataMembresia}
          rotulo="Data da recepção como membro"
        />
        <button
          className={primaria ? 'btn' : 'btn btn-sec'}
          disabled={!podeConcluir}
          onClick={() => marcarMembresia(v.id, dataMembresia, obs || undefined)}
        >
          🎉 Concluir: virou membro!
        </button>
      </div>
    </div>
  )
}
