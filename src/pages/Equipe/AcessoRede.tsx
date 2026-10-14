import { useEffect, useState } from 'react'
import { consultarAcessoRede, definirAcessoRede } from '../../supabaseClient'
import { APPS_DAS_IGREJAS } from '../../urlApp'
import { confirmar } from '../../confirmar'
import { toast } from '../../toast'
import type { Usuario } from '../../types'

// "Acesso a outras igrejas" na ficha de um pastor (Equipe). Substitui o SQL manual do
// pastor de rede: quem é pastor aprovado aqui E na outra igreja marca/desmarca. O
// servidor (`acesso-membro` → rede_*) confere tudo e cria a ficha de pastor lá.
const nomeDaIgreja = (id: string) => APPS_DAS_IGREJAS[id]?.nome ?? id

export default function AcessoRede({ u }: { u: Usuario }) {
  const [igrejas, setIgrejas] = useState<{ id: string; temAcesso: boolean }[] | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState('')

  async function carregar() {
    if (!u.authUserId) return
    const r = await consultarAcessoRede(u.authUserId)
    if (!r.ok) { setErro(r.erro ?? 'Não foi possível consultar agora.'); setIgrejas([]); return }
    setErro('')
    setIgrejas(r.igrejas)
  }
  useEffect(() => { void carregar() }, [u.authUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function alternar(id: string, temAcesso: boolean) {
    if (!u.authUserId) return
    const nome = nomeDaIgreja(id)
    const ok = await confirmar(temAcesso
      ? { titulo: 'Tirar acesso', mensagem: `Tirar o acesso de ${u.nome} à ${nome}? O cadastro dele(a) lá fica desativado e ele(a) deixa de ver os dados dessa igreja.`, confirmar: 'Tirar acesso', perigo: true }
      : { titulo: 'Dar acesso', mensagem: `Dar a ${u.nome} acesso de pastor à ${nome}? Ele(a) passa a ver todos os dados dessa igreja, inclusive cuidado pastoral.`, confirmar: 'Dar acesso' })
    if (!ok) return
    setSalvando(id)
    const r = await definirAcessoRede(u.authUserId, id, !temAcesso)
    setSalvando('')
    if (!r.ok) { toast(r.erro ?? 'Não foi possível salvar agora.', 'erro'); return }
    toast(temAcesso ? `Acesso à ${nome} retirado` : `Acesso à ${nome} liberado`)
    void carregar()
  }

  return (
    <section className="eq-g-secao">
      <h3>Acesso a outras igrejas</h3>
      {igrejas === null && <p className="eq-g-nota">Consultando…</p>}
      {erro && <p className="eq-g-nota">{erro}</p>}
      {igrejas && !erro && igrejas.length === 0 && (
        <p className="eq-g-nota">Você não é pastor aprovado em outra igreja da rede — só pode dar acesso às igrejas em que também é.</p>
      )}
      {igrejas && igrejas.map((ig) => (
        <div className="eq-g-linha-acao" key={ig.id}>
          <p><b>{nomeDaIgreja(ig.id)}</b> · {ig.temAcesso ? 'tem acesso de pastor' : 'sem acesso'}</p>
          <button type="button" className="btn btn-sec btn-mini" disabled={!!salvando} onClick={() => void alternar(ig.id, ig.temAcesso)}>
            {salvando === ig.id ? 'Salvando…' : ig.temAcesso ? 'Tirar acesso' : 'Dar acesso'}
          </button>
        </div>
      ))}
      <p className="eq-g-nota">Só aparecem as igrejas em que você também é pastor aprovado. Fica registrado na auditoria das duas igrejas.</p>
    </section>
  )
}
