import { useState } from 'react'
import { useAppState } from '../../store'
import { type ConfigIgreja } from '../../types'
import { BotaoSalvar } from '../../campos'
import { toast } from '../../toast'
import { IcoCheck, IcoCopiar, IcoImpressora, IcoOlho } from '../../icones'
import { salvarConfig, useRascunho } from './comum'

/* ---------------- Aba: Autocadastro (QR code) ---------------- */

export default function AbaAutocadastro() {
  const s = useAppState()
  const cfg = s.config
  const [copiado, setCopiado] = useState(false)

  const url = (cfg.autocadastroUrl || '').trim() || `${window.location.origin}${window.location.pathname}#/autocadastro`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=16&data=${encodeURIComponent(url)}`

  // Rascunhos: link, textos e campos visíveis
  const link = useRascunho({ autocadastroUrl: cfg.autocadastroUrl })
  const textos = useRascunho({
    autocadastroTitulo: cfg.autocadastroTitulo,
    autocadastroMensagem: cfg.autocadastroMensagem,
    autocadastroMensagemFinal: cfg.autocadastroMensagemFinal,
  })

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function imprimir() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Cadastro Visitante - ${cfg.nomeIgreja}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { color: ${cfg.corPrimaria}; }
        img { width: 340px; height: 340px; margin: 24px 0; }
        p { font-size: 18px; color: #333; }
      </style></head>
      <body>
        <h1>${cfg.nomeIgreja}</h1>
        <p>Foi uma alegria receber você! 🎉<br>Aponte a câmera e deixe seu contato:</p>
        <img src="${qrUrl}" />
        <p style="font-size:13px;color:#888">${url}</p>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  // Campos que a igreja liga/desliga (nome, contato e nascimento são fixos)
  const camposOpcionais: { chave: keyof ConfigIgreja; rotulo: string }[] = [
    { chave: 'autocadastroMostrarSituacaoCivil', rotulo: 'Estado civil' },
    { chave: 'autocadastroMostrarEndereco', rotulo: 'Endereço' },
    { chave: 'autocadastroMostrarBairro', rotulo: 'Bairro' },
    { chave: 'autocadastroMostrarCidade', rotulo: 'Cidade' },
    { chave: 'autocadastroPerguntarPrimeiraVez', rotulo: 'É a primeira vez na igreja?' },
    { chave: 'autocadastroPerguntarMembroOutra', rotulo: 'É membro de outra igreja?' },
    { chave: 'autocadastroPerguntarBatismo', rotulo: 'Já é batizado(a)?' },
    { chave: 'autocadastroPerguntarComoConheceu', rotulo: 'Como conheceu a igreja?' },
    { chave: 'autocadastroPerguntarConexao', rotulo: `Quer fazer parte de uma ${cfg.termoGrupo || 'Conexão'}?` },
    { chave: 'autocadastroPerguntarContato', rotulo: 'Quer que a equipe entre em contato? (+ horário)' },
    { chave: 'autocadastroPerguntarOracao', rotulo: 'Pedido de oração' },
  ]

  return (
    <>
      <div className="card">
        <h3>QR code e link público</h3>
        <p className="descricao-secao">
          Imprima o QR e deixe nas mesas/telão, ou divulgue o link. O visitante preenche sozinho e o
          cadastro cai direto no sistema com a triagem automática.
        </p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src={qrUrl} alt="QR code do autocadastro"
            style={{ width: 200, height: 200, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="campo"><span>Link público divulgado</span>
              <input
                type="text" value={link.d.autocadastroUrl}
                onChange={(e) => link.set({ autocadastroUrl: e.target.value })}
                placeholder="https://visitante.suaigreja.com.br"
              />
            </label>
            <p className="descricao-secao" style={{ marginTop: -4 }}>
              É o endereço que aparece no QR e no botão de copiar. Aponte esse domínio para este app na hospedagem (Netlify).
            </p>
            <BotaoSalvar pendente={link.pendente} onSalvar={() => { salvarConfig({ autocadastroUrl: link.d.autocadastroUrl.trim() }); toast('Link salvo') }} rotulo="Salvar link" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn" onClick={imprimir}><IcoImpressora size={15} /> Imprimir QR</button>
              <button className="btn btn-sec" onClick={copiar}>{copiado ? <><IcoCheck size={15} /> Copiado!</> : <><IcoCopiar size={15} /> Copiar link</>}</button>
              <a className="btn btn-sec" href="#/autocadastro" target="_blank" rel="noreferrer"><IcoOlho size={15} /> Prévia</a>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Campos do formulário</h3>
        <p className="descricao-secao">
          Escolha o que perguntar ao visitante. <b>Nome, contato e data de nascimento</b> são sempre exibidos —
          o restante você liga ou desliga aqui.
        </p>
        <div className="grade-toggles">
          {camposOpcionais.map((f) => (
            <label className="check toggle-item" key={f.chave as string}>
              <input
                type="checkbox" checked={Boolean(cfg[f.chave])}
                onChange={(e) => { salvarConfig({ [f.chave]: e.target.checked } as Partial<ConfigIgreja>); toast(e.target.checked ? `"${f.rotulo}" ativado` : `"${f.rotulo}" desativado`) }}
              />
              {f.rotulo}
            </label>
          ))}
        </div>
        <p className="descricao-secao" style={{ marginTop: 12, marginBottom: 0 }}>
          A pergunta do batismo é sem pressão — serve para a equipe não convidar ao batismo quem já é batizado.
        </p>
      </div>

      <div className="card">
        <h3>Textos da página</h3>
        <p className="descricao-secao">O que o visitante lê ao abrir e ao terminar o formulário.</p>
        <label className="campo"><span>Título de boas-vindas</span>
          <input type="text" value={textos.d.autocadastroTitulo} onChange={(e) => textos.set({ autocadastroTitulo: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem de introdução</span>
          <textarea value={textos.d.autocadastroMensagem} onChange={(e) => textos.set({ autocadastroMensagem: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem final (após enviar)</span>
          <textarea value={textos.d.autocadastroMensagemFinal} onChange={(e) => textos.set({ autocadastroMensagemFinal: e.target.value })} />
        </label>
        <BotaoSalvar pendente={textos.pendente} onSalvar={() => { salvarConfig(textos.d); toast('Textos salvos') }} />
      </div>
    </>
  )
}
