import { useAppState } from '../../store'
import { useCadastroUnico } from '../../cadastroUnico'
import { descreverConexao, divergencias, ESTADO_CIVIL_CU_LABEL, idadeEmAnos } from '../../regras-cadastro-unico'
import { igrejaAtivaId } from '../../igrejas'
import { useSessaoReal } from '../../acesso'
import type { Usuario } from '../../types'
import { formatarTelefone } from '../../regras-membros'

const dataBR = (d?: string) => (d ? d.split('-').reverse().join('/') : '')
const horaBR = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')

// Cadastro único (Check-iFE) da pessoa, na gaveta da Equipe — etapa 2, fase A. Só leitura:
// quem corrige os dados é a própria pessoa (no Check-iFE ou, na fase B, no Integrar).
// Se o nome/WhatsApp da ficha estiver diferente, a liderança pode copiar para a ficha.
export default function CadastroUnicoSecao({ u, onUsarNaFicha }: {
  u: Usuario
  onUsarNaFicha: (dados: { nome?: string; whatsapp?: string }) => void
}) {
  const s = useAppState()
  const sessao = useSessaoReal()
  const cu = useCadastroUnico([u.authUserId], sessao?.userId)
  if (!u.authUserId || cu.estado === 'desligado') return null
  const p = cu.pessoas.get(u.authUserId)
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const conexao = descreverConexao(p, igrejaAtivaId(), s.conexoes, termoGrupo)
  const diferente = divergencias(u, p)
  const idade = idadeEmAnos(p?.dataNascimento)

  return (
    <section className="eq-g-secao">
      <h3>Cadastro único <small>Check-iFE · só leitura</small></h3>
      {cu.estado === 'carregando' && !p && <p className="eq-g-nota">Consultando…</p>}
      {cu.estado === 'indisponivel' && !p && <p className="eq-g-nota">Não foi possível consultar o cadastro único agora. Os dados da ficha continuam valendo.</p>}
      {cu.estado === 'sem_permissao' && !p && (
        <p className="eq-g-nota">Seu perfil no Check-iFE ainda não tem o papel de pastor ou integração, por isso o cadastro único não aparece aqui. Peça ao administrador do Check-iFE.</p>
      )}
      {!p && (cu.estado === 'ok' || cu.estado === 'parcial') && (
        <p className="eq-g-nota">Esta pessoa ainda não tem cadastro único (a conta precisa ter o e-mail confirmado).</p>
      )}
      {p && (
        <>
          <dl className="cu-dados">
            <dt>Nome</dt><dd>{p.nome ?? '—'}</dd>
            <dt>WhatsApp</dt><dd>{p.telefone ? formatarTelefone(p.telefone) : '—'}</dd>
            <dt>E-mail</dt><dd>{p.email ?? '—'}</dd>
            <dt>Nascimento</dt><dd>{p.dataNascimento ? `${dataBR(p.dataNascimento)}${idade !== undefined ? ` · ${idade} anos` : ''}` : '—'}</dd>
            <dt>Estado civil</dt><dd>{p.estadoCivil ? ESTADO_CIVIL_CU_LABEL[p.estadoCivil] : '—'}</dd>
            <dt>{termoGrupo}</dt><dd className={`cu-${conexao.tom}`}>{conexao.texto}</dd>
          </dl>
          {diferente.length > 0 && (
            <div className="eq-g-linha-acao cu-diferente">
              <p>A ficha está com {diferente.map((d) => (d === 'nome' ? 'outro nome' : 'outro WhatsApp')).join(' e ')}. O cadastro único é o que vale.</p>
              <button type="button" className="btn btn-sec btn-mini" onClick={() => onUsarNaFicha({
                nome: diferente.includes('nome') ? p.nome : undefined,
                whatsapp: diferente.includes('whatsapp') ? p.telefone : undefined,
              })}>Usar na ficha</button>
            </div>
          )}
          {cu.lidoEm && <p className="eq-g-nota">Lido às {horaBR(cu.lidoEm)}.</p>}
        </>
      )}
    </section>
  )
}
