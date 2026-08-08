import { useState } from 'react'
import { useAppState } from '../../store'
import { type ConfigIgreja } from '../../types'
import { PALETAS } from '../../tema'
import { toast } from '../../toast'
import { BotaoSalvar } from '../../campos'
import { IcoCheck, IcoEditar, IcoLixeira, IcoMais, IcoX } from '../../icones'
import { salvarConfig, useRascunho } from './comum'

/* ---------------- Aba: Igreja ---------------- */

export default function AbaIgreja() {
  const cfg = useAppState().config
  const id = useRascunho({ nomeIgreja: cfg.nomeIgreja, subtitulo: cfg.subtitulo, termoGrupo: cfg.termoGrupo })
  const regras = useRascunho({ prazoEsperaDias: cfg.prazoEsperaDias })

  return (
    <>
      <div className="card">
        <h3>Identidade</h3>
        <p className="descricao-secao">Nome e termos que aparecem no menu, no formulário público de autocadastro e nos relatórios.</p>
        <div className="linha-campos">
          <label className="campo"><span>Nome da igreja</span>
            <input type="text" value={id.d.nomeIgreja} onChange={(e) => id.set({ nomeIgreja: e.target.value })} />
          </label>
          <label className="campo"><span>Subtítulo</span>
            <input type="text" value={id.d.subtitulo} onChange={(e) => id.set({ subtitulo: e.target.value })} />
          </label>
        </div>
        <label className="campo"><span>Como vocês chamam o grupo pequeno?</span>
          <input type="text" value={id.d.termoGrupo} onChange={(e) => id.set({ termoGrupo: e.target.value })} placeholder="Conexão, Célula, PG, GC…" />
        </label>
        <BotaoSalvar pendente={id.pendente} onSalvar={() => { salvarConfig(id.d); toast('Identidade salva') }} />
      </div>

      <Cores />

      <div className="card">
        <h3>Regras do fluxo</h3>
        <p className="descricao-secao">Prazos que controlam as automações do acompanhamento.</p>
        <label className="campo" style={{ maxWidth: 380 }}>
          <span>Dias sem resposta até mover para "Em espera"</span>
          <input
            type="number" min={1} max={90} value={regras.d.prazoEsperaDias}
            onChange={(e) => regras.set({ prazoEsperaDias: Math.max(1, Number(e.target.value) || 14) })}
          />
        </label>
        <BotaoSalvar pendente={regras.pendente} onSalvar={() => { salvarConfig(regras.d); toast('Regras salvas') }} />
      </div>

      <ListaEditavel
        titulo={'Opções de "Como conheceu a igreja?"'}
        descricao="Aparecem no cadastro manual e no autocadastro do QR code. Ótimas para medir quais canais trazem mais visitantes."
        itens={cfg.comoConheceuOpcoes}
        placeholder="ex.: Rádio local"
        onChange={(comoConheceuOpcoes) => { salvarConfig({ comoConheceuOpcoes }); toast('Opções salvas') }}
      />
    </>
  )
}

/* ---------------- Cores (aplicadas na hora, com prévia ao vivo) ---------------- */

function Cores() {
  const cfg = useAppState().config

  function mudar(patch: Partial<ConfigIgreja>) {
    salvarConfig(patch)
  }

  const campos: { chave: 'corFundo' | 'corEscura' | 'corPrimaria'; rotulo: string; dica: string }[] = [
    { chave: 'corFundo', rotulo: 'Cor de fundo (papel)', dica: 'O fundo das telas' },
    { chave: 'corEscura', rotulo: 'Cor escura (fundos, títulos)', dica: 'Títulos e o fundo das telas públicas' },
    { chave: 'corPrimaria', rotulo: 'Cor primária (destaques, botões)', dica: 'Botões e destaques' },
  ]

  const paletaAtiva = PALETAS.find(
    (p) => p.corFundo.toLowerCase() === cfg.corFundo.toLowerCase() &&
      p.corEscura.toLowerCase() === cfg.corEscura.toLowerCase() &&
      p.corPrimaria.toLowerCase() === cfg.corPrimaria.toLowerCase(),
  )

  return (
    <div className="card">
      <h3>Cores</h3>
      <p className="descricao-secao">
        As cores do sistema inteiro — aplicadas e salvas na hora, para você ver o resultado ao vivo.
        Os tons derivados (mais claros/escuros) são calculados sozinhos, inclusive a cor do texto sobre os botões.
      </p>

      <div className="ac-secao" style={{ paddingTop: 0, borderTop: 'none' }}>
        <div className="ac-secao-titulo">Paletas prontas</div>
        <div className="ac-opcoes">
          {PALETAS.map((p) => (
            <button
              type="button" key={p.nome} title={p.descricao}
              className={`ac-opcao ${paletaAtiva?.nome === p.nome ? 'sel' : ''}`}
              onClick={() => { mudar({ corFundo: p.corFundo, corEscura: p.corEscura, corPrimaria: p.corPrimaria }); toast(`Paleta "${p.nome}" aplicada`) }}
            >
              <span style={{ display: 'inline-flex', gap: 3, marginRight: 7, verticalAlign: '-2px' }}>
                {[p.corFundo, p.corEscura, p.corPrimaria].map((c) => (
                  <i key={c} style={{ width: 10, height: 10, borderRadius: 3, background: c, border: '1px solid rgba(0,0,0,.15)' }} />
                ))}
              </span>
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="ac-secao">
        <div className="ac-secao-titulo">Ajuste fino</div>
        {campos.map((c) => (
          <label className="campo" key={c.chave}>
            <span>{c.rotulo} <em className="campo-dica">({c.dica})</em></span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color" value={cfg[c.chave]}
                onChange={(e) => mudar({ [c.chave]: e.target.value })}
                style={{ width: 46, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
              />
              <code style={{ fontSize: 13 }}>{cfg[c.chave]}</code>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Lista editável (opções de texto) ---------------- */

function ListaEditavel({ titulo, descricao, itens, placeholder, onChange }: {
  titulo: string
  descricao: string
  itens: string[]
  placeholder: string
  onChange: (itens: string[]) => void
}) {
  const [novo, setNovo] = useState('')
  const [editIdx, setEditIdx] = useState(-1)
  const [editTexto, setEditTexto] = useState('')

  function salvarEdicao(i: number) {
    const t = editTexto.trim()
    if (t) onChange(itens.map((x, j) => j === i ? t : x))
    setEditIdx(-1)
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <p className="descricao-secao">{descricao}</p>
      {itens.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          {editIdx === i ? (
            <>
              <input
                type="text" value={editTexto} autoFocus
                onChange={(e) => setEditTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') salvarEdicao(i); if (e.key === 'Escape') setEditIdx(-1) }}
                style={{ flex: 1 }}
              />
              <button className="btn-icone ok" onClick={() => salvarEdicao(i)} title="Salvar"><IcoCheck /></button>
              <button className="btn-icone" onClick={() => setEditIdx(-1)} title="Cancelar"><IcoX /></button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, fontSize: 13.5 }}>{item}</span>
              <button className="btn-icone" onClick={() => { setEditIdx(i); setEditTexto(item) }} title="Editar"><IcoEditar /></button>
              <button className="btn-icone perigo" onClick={() => onChange(itens.filter((_, j) => j !== i))} title="Remover"><IcoLixeira /></button>
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          type="text" value={novo} placeholder={placeholder}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) { onChange([...itens, novo.trim()]); setNovo('') } }}
          style={{ maxWidth: 320 }}
        />
        <button
          className="btn btn-mini"
          onClick={() => {
            if (!novo.trim()) return
            onChange([...itens, novo.trim()])
            setNovo('')
          }}
        ><IcoMais size={14} /> Adicionar</button>
      </div>
    </div>
  )
}
