import { useState, type ReactNode } from 'react'
import { useAppState } from './store'
import { rotuloPapel } from './types'
import { alternarModoTema, getModoTema } from './tema-modo'
import { IcoEscudo, IcoLua, IcoSol } from './icones'

// Moldura das telas públicas — o mesmo formato da entrada do Louvor e do
// Check-iFE: painel institucional na cor escura da igreja (marca, frase,
// versículo) à esquerda e o conteúdo à direita. No celular o painel vira uma
// faixa compacta no topo.
//   publico="equipe"    → entrar, criar acesso, nova senha, aguardando liberação
//   publico="visitante" → autocadastro do visitante (QR code)
// Textos fixos são neutros (servem a qualquer igreja); nome, cores e termos vêm
// das Configurações (white-label).

function sigla(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((w) => w.length > 2)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'IG'
}

export default function TelaPublica({ children, publico = 'equipe', larga = false }: {
  children: ReactNode
  publico?: 'equipe' | 'visitante'
  larga?: boolean
}) {
  const cfg = useAppState().config
  const [modo, setModo] = useState(getModoTema())
  const termoGrupo = cfg.termoGrupo?.trim() || 'Conexão'
  const equipe = publico === 'equipe'

  return (
    <div className={`tp ${equipe ? 'tp-equipe' : 'tp-visitante'}`}>
      <aside className="tp-painel">
        <div className="tp-marca">
          <span className="tp-selo">{sigla(cfg.nomeIgreja)}</span>
          <span className="tp-marca-txt">
            <b>{cfg.nomeIgreja}</b>
            <small>{cfg.subtitulo}</small>
          </span>
        </div>

        <div className="tp-hero">
          {equipe ? (
            <>
              <h2>Cada visitante, acolhido do primeiro culto à família.</h2>
              <p>Cadastre, acompanhe e encaminhe cada pessoa aos grupos — com toda a equipe na mesma página, no computador ou no celular.</p>
              <div className="tp-passos" aria-hidden>
                <span>Visitou</span><i>›</i><span>Contato</span><i>›</i><span>{termoGrupo}</span><i>›</i><span className="tp-passo-fim">Família</span>
              </div>
            </>
          ) : (
            <>
              <h2>{cfg.autocadastroTitulo}</h2>
              <p>{cfg.autocadastroMensagem}</p>
            </>
          )}
        </div>

        <div className="tp-pe-painel">
          <p className="tp-verso">“Portanto, acolhei-vos uns aos outros, como também Cristo nos acolheu.”</p>
          <p className="tp-ref">ROMANOS 15.7</p>
          {equipe && (
            <p className="tp-papeis">
              {[rotuloPapel('pastor'), rotuloPapel('coordenacao'), rotuloPapel('consolidador'), rotuloPapel('lider')].join(' · ')}
            </p>
          )}
        </div>
      </aside>

      <main className={`tp-lado ${larga ? 'tp-lado-topo' : ''}`}>
        {equipe && (
          <button
            type="button" className="tp-tema"
            onClick={() => setModo(alternarModoTema())}
            aria-label={modo === 'escuro' ? 'Tema claro' : 'Tema escuro'}
          >
            {modo === 'escuro' ? <><IcoSol size={14} /> Claro</> : <><IcoLua size={14} /> Escuro</>}
          </button>
        )}
        <div className={`tp-caixa ${larga ? 'tp-caixa-larga' : ''}`}>
          {children}
          {equipe && (
            <div className="tp-rodape">
              <span><IcoEscudo size={14} /> Conexão segura</span>
              <span className="tp-versao">Integração · v{__APP_VERSION__}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
