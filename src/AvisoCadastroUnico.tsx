import { useState } from 'react'
import { useAppState } from './store'
import { useSituacaoCadastroUnico } from './meuCadastro'
import { pendenciasCU } from './regras-cadastro-unico'
import { navegar } from './router'
import { IcoAlerta, IcoX } from './icones'

const CHAVE = 'ife-aviso-cadastro-unico-fechado'

// Faixa "complete o seu cadastro único" no topo das telas (fase B). Só AVISA — não bloqueia
// nada no Integrar (decisão combinada com o Check-iFE). Fechar vale até fechar o navegador.
export default function AvisoCadastroUnico() {
  const s = useAppState()
  const situacao = useSituacaoCadastroUnico()
  const [fechado, setFechado] = useState(() => { try { return sessionStorage.getItem(CHAVE) === '1' } catch { return false } })
  const pendencias = pendenciasCU(situacao.valor, s.config.termoGrupo?.trim() || 'Conexão')
  if (fechado || pendencias.length === 0) return null

  function fechar() {
    try { sessionStorage.setItem(CHAVE, '1') } catch { /* sem storage: fecha só agora */ }
    setFechado(true)
  }

  return (
    <div className="cu-faixa" role="status">
      <IcoAlerta size={16} />
      <span className="cu-faixa-txt">Complete o seu cadastro único: {pendencias.join('; ')}.</span>
      <button type="button" className="btn btn-mini" onClick={() => navegar('/meu-cadastro')}>Completar</button>
      <button type="button" className="btn-icone" onClick={fechar} title="Lembrar depois" aria-label="Lembrar depois"><IcoX size={14} /></button>
    </div>
  )
}
