import { useState, type ReactNode } from 'react'
import AbaIgreja from './AbaIgreja'
import AbaJornada from './AbaJornada'
import AbaCultos from './AbaCultos'
import AbaGrupos from './AbaGrupos'
import AbaMensagens from './AbaMensagens'
import AbaAutocadastro from './AbaAutocadastro'
import AbaDados from './AbaDados'
import { IcoBanco, IcoCalendario, IcoCasa, IcoCelular, IcoIgreja, IcoMapa, IcoMensagem } from '../../icones'
import { useAppState } from '../../store'

type Aba = 'igreja' | 'jornada' | 'cultos' | 'grupos' | 'mensagens' | 'autocadastro' | 'dados'

// Seções no padrão das configurações da família iFE: menu lateral (ícone,
// nome, o que tem dentro) no computador; pílulas roláveis no celular.
const ABAS: { id: Aba; rotulo: string; dica: string; icone: ReactNode }[] = [
  { id: 'igreja', rotulo: 'Igreja', dica: 'Identidade, cores e regras gerais', icone: <IcoIgreja size={18} /> },
  { id: 'jornada', rotulo: 'Jornada', dica: 'Nomes das etapas e datas marcadas', icone: <IcoMapa size={18} /> },
  { id: 'cultos', rotulo: 'Cultos', dica: 'Cultos fixos e suas datas', icone: <IcoCalendario size={18} /> },
  { id: 'grupos', rotulo: 'Grupos', dica: 'Grupos e seus líderes', icone: <IcoCasa size={18} /> },
  { id: 'mensagens', rotulo: 'Mensagens', dica: 'Textos do fluxo de contato', icone: <IcoMensagem size={18} /> },
  { id: 'autocadastro', rotulo: 'Autocadastro', dica: 'Página pública do QR code', icone: <IcoCelular size={18} /> },
  { id: 'dados', rotulo: 'Dados & Nuvem', dica: 'Backup e sincronização', icone: <IcoBanco size={18} /> },
]

// Seção inicial pelo endereço (#/config?aba=autocadastro) — atalhos do Painel
function abaDoEndereco(): Aba {
  const q = window.location.hash.split('?')[1]
  const a = q ? new URLSearchParams(q).get('aba') : null
  return ABAS.some((x) => x.id === a) ? (a as Aba) : 'igreja'
}

export default function Configuracoes() {
  const termoGrupo = useAppState().config.termoGrupo?.trim() || 'Conexão'
  const [aba, setAba] = useState<Aba>(abaDoEndereco)
  const atual = ABAS.find((a) => a.id === aba)!
  // "Grupos" fala a língua da igreja (Conexões, Células, PGs…)
  const dica = (a: typeof ABAS[number]) => (a.id === 'grupos' ? `${termoGrupo} e seus líderes` : a.dica)

  return (
    <div className="config">
      <h1 className="titulo-pagina">Configurações</h1>
      <p className="subtitulo">Adapte o sistema à realidade da sua igreja.</p>

      <div className="config-grade">
        <nav className="config-nav" aria-label="Seções das configurações">
          {ABAS.map((a) => (
            <button
              key={a.id} type="button" aria-current={aba === a.id ? 'page' : undefined}
              className={`config-nav-item ${aba === a.id ? 'ativo' : ''}`} onClick={() => setAba(a.id)}
            >
              <span className="config-nav-ico">{a.icone}</span>
              <span className="config-nav-txt"><b>{a.rotulo}</b><small>{dica(a)}</small></span>
            </button>
          ))}
        </nav>

        <div className="config-conteudo">
          <div className="config-cab">
            <h2>{atual.rotulo}</h2>
            <p>{dica(atual)}</p>
          </div>

          {aba === 'igreja' && <AbaIgreja />}
          {aba === 'jornada' && <AbaJornada />}
          {aba === 'cultos' && <AbaCultos />}
          {aba === 'grupos' && <AbaGrupos />}
          {aba === 'mensagens' && <AbaMensagens />}
          {aba === 'autocadastro' && <AbaAutocadastro />}
          {aba === 'dados' && <AbaDados />}
        </div>
      </div>
    </div>
  )
}
