import { useRef, useState } from 'react'
import {
  ativarNuvem, desligarNuvem, getEstado, setEstado, substituirEstado, testarNuvem,
  useNuvem, zerarDados,
} from '../../store'
import { getConfigNuvem } from '../../nuvem'
import { registrarAuditoria } from '../../auditoria'
import { IcoDownload } from '../../icones'

/* ---------------- Aba: Dados & Nuvem ---------------- */

export default function AbaDados() {
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function exportar() {
    const estadoAtual = getEstado()
    const blob = new Blob([JSON.stringify(estadoAtual, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `consolidacao-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup exportado — guarde o arquivo em local seguro.')
    registrarAuditoria('⬇️ Exportou backup completo', { alvoTipo: 'sistema', detalhe: `${estadoAtual.visitantes.length} visitante(s)` })
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0]
    if (!arq) return
    arq.text().then((textoArq) => {
      try {
        const dados = JSON.parse(textoArq)
        if (!Array.isArray(dados.visitantes)) throw new Error('formato inválido')
        substituirEstado(dados)
        setMsg('Backup restaurado com sucesso.')
        registrarAuditoria('⬆️ Restaurou backup (substituiu os dados)', { alvoTipo: 'sistema' })
      } catch {
        setMsg('Arquivo inválido — nada foi alterado.')
      }
    })
    e.target.value = ''
  }

  return (
    <>
      {msg && <div className="alerta alerta-info">ℹ️ <div>{msg}</div></div>}

      <CardNuvem />

      <div className="card">
        <h3>Backup</h3>
        <p className="descricao-secao">
          Os dados ficam salvos neste navegador. Exporte um backup regularmente — ele também serve para levar os dados para outro computador.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportar}><IcoDownload size={15} /> Exportar backup (.json)</button>
          <button className="btn btn-sec" onClick={() => arquivoRef.current?.click()}>Restaurar backup</button>
          <input ref={arquivoRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importar} />
        </div>
      </div>

      <div className="card" style={{ borderColor: '#fecaca' }}>
        <h3 style={{ color: 'var(--danger)' }}>Zona de perigo</h3>
        <p className="descricao-secao">
          Apaga todos os visitantes, contatos e cadastros deste navegador. Não tem volta (a menos que você tenha um backup).
        </p>
        <button
          className="btn btn-perigo"
          onClick={() => {
            if (confirm('Tem certeza? Todos os dados serão apagados. Exportou um backup antes?')) {
              zerarDados()
              setMsg('Dados zerados.')
            }
          }}
        >🗑️ Zerar todos os dados</button>
      </div>
    </>
  )
}

/* ---------------- Sincronização online (Supabase) ---------------- */

function CardNuvem() {
  const nuvem = useNuvem()
  const salva = getConfigNuvem()
  const [url, setUrl] = useState(salva?.url ?? '')
  const [anonKey, setAnonKey] = useState(salva?.anonKey ?? '')
  const [igrejaId, setIgrejaId] = useState(salva?.igrejaId ?? 'minha-igreja')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const conectada = nuvem.status !== 'desligada'

  async function conectar() {
    if (!url.trim() || !anonKey.trim() || !igrejaId.trim()) {
      setErro('Preencha os três campos (URL, chave e identificador da igreja).')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const cfg = { url: url.trim(), anonKey: anonKey.trim(), igrejaId: igrejaId.trim() }
      const remoto = await testarNuvem(cfg)
      const usarRemoto = remoto !== null &&
        confirm('Já existem dados salvos na nuvem para esta igreja.\n\nOK = usar os dados da NUVEM (substitui os deste navegador)\nCancelar = enviar os dados LOCAIS para a nuvem (substitui os de lá)')
      await ativarNuvem(cfg, usarRemoto ? remoto : null)
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : String(e)
      setErro(`Não foi possível conectar. ${detalhe} — veja o guia SUPABASE.md.`)
    } finally {
      setOcupado(false)
    }
  }

  const rotuloStatus: Record<string, string> = {
    sincronizando: '🟡 Sincronizando…',
    ok: '🟢 Conectada e sincronizada',
    erro: '🔴 Erro na última sincronização — verifique a conexão',
  }

  return (
    <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
      <h3>🌐 Sincronização online</h3>
      <p className="descricao-secao">
        Sem a nuvem, os dados vivem só neste navegador. Conectando ao Supabase (gratuito para começar),
        tudo é salvo online automaticamente e você acessa de qualquer dispositivo. O passo a passo está
        no arquivo <b>SUPABASE.md</b> do projeto.
      </p>

      {conectada ? (
        <>
          <p style={{ fontSize: 14, marginBottom: 4 }}>{rotuloStatus[nuvem.status]}</p>
          {nuvem.ultimoSync && (
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
              Última sincronização: {new Date(nuvem.ultimoSync).toLocaleString('pt-BR')}
            </p>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
            Igreja: <b>{salva?.igrejaId}</b> · {salva?.url}
          </p>
          <button className="btn btn-sec btn-mini" onClick={() => { desligarNuvem(); }}>
            Desconectar da nuvem (os dados locais permanecem)
          </button>
        </>
      ) : (
        <>
          {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}
          <div className="linha-campos">
            <label className="campo"><span>URL do projeto Supabase</span>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </label>
            <label className="campo"><span>Chave da API (publishable ou anon)</span>
              <input type="text" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="sb_publishable_… ou eyJ…" />
            </label>
          </div>
          <label className="campo" style={{ maxWidth: 320 }}><span>Identificador da igreja</span>
            <input type="text" value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)} placeholder="ex.: ife-matriz" />
          </label>
          <button className="btn" onClick={conectar} disabled={ocupado}>
            {ocupado ? 'Conectando…' : '🌐 Conectar e sincronizar'}
          </button>
        </>
      )}
    </div>
  )
}
