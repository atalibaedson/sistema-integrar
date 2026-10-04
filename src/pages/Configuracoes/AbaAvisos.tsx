import { useAppState } from '../../store'
import { rotuloPapel, rotuloStatus, type ConfigAlertas } from '../../types'
import { ALERTAS_PADRAO, alertasConfig } from '../../alertas'
import { BotaoSalvar } from '../../campos'
import { toast } from '../../toast'
import { IcoAlerta, IcoRelogio, IcoSeta, IcoUsuarios } from '../../icones'
import { salvarConfig, useRascunho } from './comum'

/* ---------------- Aba: Avisos (prazos da central de avisos) ---------------- */

type ChaveNumero = {
  [K in keyof ConfigAlertas]: ConfigAlertas[K] extends number ? K : never
}[keyof ConfigAlertas]

export default function AbaAvisos() {
  const cfg = useAppState().config
  const efetiva = alertasConfig(cfg)
  const r = useRascunho<ConfigAlertas>(efetiva)
  const padrao = JSON.stringify(r.d) === JSON.stringify(ALERTAS_PADRAO)

  const numero = (chave: ChaveNumero, rotulo: string, ajuda: string, max = 60, min = 0) => (
    <label className="campo" key={chave}>
      <span>{rotulo}</span>
      <input
        type="number" min={min} max={max} value={r.d[chave]}
        onChange={(e) => r.set({ [chave]: Math.min(max, Math.max(min, Math.floor(Number(e.target.value) || 0))) } as Partial<ConfigAlertas>)}
      />
      <small className="campo-ajuda">{ajuda}</small>
    </label>
  )

  return (
    <>
      <div className="card">
        <div className="card-cab">
          <h3>Central de avisos</h3>
          {!padrao && (
            <button className="btn btn-sec btn-mini" onClick={() => r.set({ ...ALERTAS_PADRAO })}>Restaurar prazos padrão</button>
          )}
        </div>
        <p className="descricao-secao">
          O sistema avisa quem precisa <b>fazer algo</b>: no sino do topo, no Painel e, se a pessoa ativar, por notificação no
          celular. Cada aviso vai só para quem precisa vê-lo e, se não for resolvido, <b>sobe</b> para o líder acima e depois
          para a {rotuloPapel('coordenacao')} — em vez de se repetir todo dia para a mesma pessoa. Os prazos abaixo são em dias corridos.
        </p>
        <label className="check" style={{ marginBottom: 6 }}>
          <input type="checkbox" checked={r.d.ativo} onChange={(e) => r.set({ ativo: e.target.checked })} />
          Avisos ligados
        </label>
        <div className="linha-campos">
          <label className="campo" style={{ maxWidth: 300 }}>
            <span>Hora do resumo diário (notificação)</span>
            <input
              type="number" min={7} max={20} value={r.d.horaResumo}
              onChange={(e) => r.set({ horaResumo: Math.min(20, Math.max(7, Math.floor(Number(e.target.value) || 8))) })}
            />
            <small className="campo-ajuda">Horário de Brasília, entre 7h e 20h. Cada pessoa recebe no máximo um resumo por dia.</small>
          </label>
        </div>
      </div>

      <div className="card">
        <h3><IcoRelogio size={16} /> Quando avisar o responsável</h3>
        <div className="ac-grupo">
          {numero('semResponsavelDias', 'Visitante sem responsável', 'Dias depois do cadastro sem ninguém assumir (aviso à Gestão).')}
          {numero('primeiroContatoDias', '1º contato', 'Dias para o responsável fazer o 1º contato antes de o aviso ficar "atrasado".')}
          {numero('intervaloContatoDias', 'Contato pendente', `Dias sem registro de contato em "${rotuloStatus('em_contato')}" ou "${rotuloStatus('aguardando_resposta')}" até avisar.`)}
          {numero('liderSemContatoDias', 'Líder sem contato', `Dias com a pessoa em "${rotuloStatus('encaminhado_lider')}" e o líder sem registrar contato.`)}
          {numero('avisoEsperaDias', 'Antes do "Em espera"', `Quantos dias ANTES de ir automaticamente para "${rotuloStatus('em_espera')}" (prazo de ${cfg.prazoEsperaDias ?? 14} dias) o responsável é avisado. 0 desliga.`, 14)}
          {numero('cuidadoDias', 'Cuidado / crise', 'Dias sem registro de contato num caso de cuidado até avisar os pastores (a 1ª vez é na hora).', 14)}
        </div>
      </div>

      <div className="card">
        <h3><IcoSeta size={16} /> Quando o aviso sobe</h3>
        <p className="descricao-secao">Contados a partir do dia em que o aviso ficou atrasado.</p>
        <div className="ac-grupo">
          {numero('subirLiderDias', 'Sobe ao líder acima', 'Depois de quantos dias de atraso o supervisor da pessoa também é avisado.')}
          {numero('subirCoordenacaoDias', `Chega à ${rotuloPapel('coordenacao')}`, 'Depois de quantos dias de atraso a Gestão também é avisada.')}
        </div>
      </div>

      <div className="card">
        <h3><IcoUsuarios size={16} /> Visão da Gestão: equipe sem abastecer o sistema</h3>
        <p className="descricao-secao">
          Avisos para a {rotuloPapel('coordenacao')} e os {rotuloPapel('pastor')}. No celular, entram só no resumo de segunda-feira.
        </p>
        <div className="ac-grupo">
          {numero('equipeParadaDias', 'Equipe parada', 'Dias sem NENHUM contato registrado por toda a equipe (havendo visitantes em acompanhamento). 0 desliga.')}
          {numero('acolhedorParadoQtd', 'Pessoa com fichas paradas', 'Quantas fichas paradas há 7+ dias com a mesma pessoa até avisar. 0 desliga.', 50)}
        </div>
        <label className="check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={r.d.cultoSemCadastro} onChange={(e) => r.set({ cultoSemCadastro: e.target.checked })} />
          Avisar quando um culto passar sem nenhum visitante cadastrado
        </label>
        <p className="descricao-secao" style={{ marginTop: 6 }}>
          <IcoAlerta size={13} /> Pode ser só um culto sem visitantes — o aviso pede para <i>confirmar</i>, sem tom de cobrança.
        </p>
      </div>

      <BotaoSalvar pendente={r.pendente} onSalvar={() => { salvarConfig({ alertas: r.d }); toast('Avisos salvos') }} />
    </>
  )
}

