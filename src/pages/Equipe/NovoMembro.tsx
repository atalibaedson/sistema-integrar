import { useState } from 'react'
import { primeiraGestaoIntegracao, setEstado, uid, useAppState } from '../../store'
import { rotuloPapel, type Papel } from '../../types'
import { registrarAuditoria } from '../../auditoria'
import { toast } from '../../toast'
import { IcoMais, IcoX } from '../../icones'
import Gaveta from './Gaveta'
import { SeletorFuncoes } from './comum'

// Cadastro rápido de um membro (sem login). Para a pessoa ter a própria senha,
// ela usa o link #/cadastro-integrante e a liderança aprova.
export default function NovoMembro({ onFechar }: { onFechar: () => void }) {
  const s = useAppState()
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const [nome, setNome] = useState('')
  const [whats, setWhats] = useState('')
  const [email, setEmail] = useState('')
  const [papeis, setPapeis] = useState<Papel[]>(['consolidador'])
  const [conexaoId, setConexaoId] = useState('')
  const valido = !!nome.trim() && !!whats.trim() && papeis.length > 0

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) return
    const id = uid()
    const gestorPadrao = papeis.includes('consolidador') ? primeiraGestaoIntegracao(s) : undefined
    setEstado((st) => ({
      ...st,
      usuarios: [...st.usuarios, {
        id, nome: nome.trim(), whatsapp: whats.trim(), email: email.trim() || undefined,
        papeis, ativo: true, statusAcesso: 'sem_login',
        conexaoId: papeis.includes('lider') ? (conexaoId || undefined) : undefined,
        supervisorId: gestorPadrao?.id,
      }],
      conexoes: papeis.includes('lider') && conexaoId
        ? st.conexoes.map((c) => {
            if (c.id !== conexaoId) return c
            if (!c.liderId) return { ...c, liderId: id }
            if (!c.lider2Id) return { ...c, lider2Id: id }
            return c
          })
        : st.conexoes,
    }))
    registrarAuditoria('➕ Adicionou integrante à equipe', {
      alvoTipo: 'usuario', alvoId: id, alvoNome: nome.trim(),
      detalhe: `Funções: ${papeis.map((p) => rotuloPapel(p)).join(', ')}`,
    })
    toast('Membro adicionado à equipe')
    onFechar()
  }

  return (
    <Gaveta rotulo="Novo membro" onFechar={onFechar}>
      <form onSubmit={adicionar} className="eq-g-form">
        <header className="eq-g-cab">
          <span className="painel-ico painel-ico-acc"><IcoMais size={18} /></span>
          <div className="eq-g-id">
            <h2>Novo membro</h2>
            <p className="eq-g-sub">Cadastro rápido, sem login. A pessoa pode criar o acesso depois.</p>
          </div>
          <button type="button" className="btn-icone" onClick={onFechar} title="Fechar" aria-label="Fechar"><IcoX size={16} /></button>
        </header>

        <div className="eq-g-corpo">
          <section className="eq-g-secao">
            <h3>Dados</h3>
            <label className="campo"><span>Nome *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </label>
            <label className="campo"><span>WhatsApp *</span>
              <input type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
            <label className="campo"><span>E-mail <em className="campo-dica">(opcional)</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </section>

          <section className="eq-g-secao">
            <h3>Funções * <small>marque todas que a pessoa exerce</small></h3>
            <SeletorFuncoes papeis={papeis} onMudar={setPapeis} />
            {papeis.includes('lider') && (
              <label className="campo" style={{ marginTop: 12 }}><span>{termoGrupo} que lidera</span>
                <select value={conexaoId} onChange={(e) => setConexaoId(e.target.value)}>
                  <option value="">— definir depois —</option>
                  {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
          </section>

          <p className="eq-g-nota">
            Este cadastro não cria login. Para a pessoa ter a própria senha, envie a ela o link
            <b> #/cadastro-integrante</b> — o acesso passa pela aprovação da liderança.
          </p>
        </div>

        <footer className="eq-g-rodape">
          <button className="btn" type="submit" disabled={!valido}>Adicionar à equipe</button>
          <button className="btn btn-sec" type="button" onClick={onFechar}>Cancelar</button>
        </footer>
      </form>
    </Gaveta>
  )
}
