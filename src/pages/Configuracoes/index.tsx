import { useState } from 'react'
import AbaIgreja from './AbaIgreja'
import AbaJornada from './AbaJornada'
import AbaCultos from './AbaCultos'
import AbaGrupos from './AbaGrupos'
import AbaMensagens from './AbaMensagens'
import AbaAutocadastro from './AbaAutocadastro'
import AbaDados from './AbaDados'

type Aba = 'igreja' | 'jornada' | 'cultos' | 'grupos' | 'mensagens' | 'autocadastro' | 'dados'

const ABAS: { id: Aba; rotulo: string; dica: string }[] = [
  { id: 'igreja', rotulo: '⛪ Igreja', dica: 'Identidade, cores e regras gerais' },
  { id: 'jornada', rotulo: '🗺️ Jornada', dica: 'Nomes das etapas e datas marcadas' },
  { id: 'cultos', rotulo: '📅 Cultos', dica: 'Cultos fixos e suas datas' },
  { id: 'grupos', rotulo: '🏠 Grupos', dica: 'Conexões e seus líderes' },
  { id: 'mensagens', rotulo: '💬 Mensagens', dica: 'Textos do fluxo de contato' },
  { id: 'autocadastro', rotulo: '📱 Autocadastro', dica: 'Página pública do QR code' },
  { id: 'dados', rotulo: '💾 Dados & Nuvem', dica: 'Backup e sincronização' },
]

export default function Configuracoes() {
  const [aba, setAba] = useState<Aba>('igreja')
  const atual = ABAS.find((a) => a.id === aba)!

  return (
    <div>
      <h1 className="titulo-pagina">Configurações</h1>
      <p className="subtitulo">Adapte o sistema à realidade da sua igreja.</p>

      <div className="abas">
        {ABAS.map((a) => (
          <button key={a.id} className={`aba ${aba === a.id ? 'ativa' : ''}`} onClick={() => setAba(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      <p className="descricao-secao" style={{ margin: '0 0 16px', fontStyle: 'italic' }}>{atual.dica}</p>

      {aba === 'igreja' && <AbaIgreja />}
      {aba === 'jornada' && <AbaJornada />}
      {aba === 'cultos' && <AbaCultos />}
      {aba === 'grupos' && <AbaGrupos />}
      {aba === 'mensagens' && <AbaMensagens />}
      {aba === 'autocadastro' && <AbaAutocadastro />}
      {aba === 'dados' && <AbaDados />}
    </div>
  )
}
