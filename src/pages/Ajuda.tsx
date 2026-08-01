import { useState } from 'react'
import { useAppState } from '../store'
import { IcoBusca } from '../icones'

// Manual de uso dentro do app. Espelha o conteúdo de manual.html.
type Bloco = { p?: string; lista?: string[]; passos?: string[]; nota?: { tipo: 'info' | 'ok' | 'warn' | 'crit'; texto: string } }
type Secao = { id: string; icone: string; titulo: string; resumo: string; blocos: Bloco[] }

function secoes(termoGrupo: string): Secao[] {
  return [
    {
      id: 'comecar', icone: '🚀', titulo: 'Começando', resumo: 'Acessar e deixar com cara de app.',
      blocos: [
        { p: 'O sistema abre no navegador — não precisa instalar nada. Ele já entra conectado e mostra "● Sincronizado" no topo, sinal de que seus dados estão salvos na nuvem e aparecem em qualquer aparelho da equipe.' },
        { p: 'Para um ícone na tela inicial (parecendo um app):', lista: ['iPhone (Safari): Compartilhar → Adicionar à Tela de Início', 'Android (Chrome): menu ⋮ → Adicionar à tela inicial'] },
        { nota: { tipo: 'ok', texto: 'Tudo o que você registra é salvo automaticamente. Pode fechar e continuar depois — nada se perde.' } },
      ],
    },
    {
      id: 'areas', icone: '🧭', titulo: 'As áreas do app', resumo: 'O que cada tela do menu faz.',
      blocos: [
        { lista: [
          'Painel — o que fazer hoje, o funil da consolidação e alertas.',
          'Jornada — quadro visual por etapa; arraste o cartão para avançar a pessoa.',
          'Visitantes — lista de todos, filtrada por etapa, com a próxima ação de cada um.',
          'Novo visitante — cadastro de quem você aborda no culto.',
          'Painel do líder — o que cada líder precisa fazer com quem foi encaminhado a ele.',
          'Equipe — cadastro das pessoas do ministério e suas funções.',
          'Configurações — dados da igreja, grupos, mensagens, QR code e backup.',
        ] },
      ],
    },
    {
      id: 'jornada', icone: '🗺️', titulo: 'A jornada do visitante', resumo: 'Os 7 passos, do "chegou" ao "virou membro".',
      blocos: [
        { passos: [
          'Cadastro realizado — a pessoa chega pelo culto (você cadastra) ou pelo QR code (ela mesma preenche).',
          `Primeira semana de contatos — mensagens de segunda (acolhida), quarta (convite ao grupo) e sábado (celebração). O texto já vem pronto.`,
          `Encaminhado ao líder de ${termoGrupo} — quando a pessoa aceita visitar, o líder fala com ela ANTES da visita.`,
          `Visita ao ${termoGrupo} — a pessoa participa de um encontro pela primeira vez.`,
          'Líder assume o acompanhamento — depois da visita, o líder confirma que assumiu. A consolidação fica de apoio.',
          'Batismo — etapa de quem ainda não é batizado. Quem já chegou batizado pula este passo.',
          'Membro 🎉 — ser recebido(a) como membro da igreja conclui a jornada.',
        ] },
        { nota: { tipo: 'info', texto: 'O batismo é um passo opcional: nem todo visitante precisa dele, porque muitos já chegam batizados de outra igreja — e ninguém se batiza duas vezes. Por isso, quem já é batizado vai direto de "Líder assume" para "Membro". O que fecha a jornada, nos dois caminhos, é virar membro.' } },
        { nota: { tipo: 'info', texto: 'Você não precisa decorar isso: ao registrar cada contato, o sistema move a pessoa para o passo certo sozinho. A ficha sempre mostra onde ela está.' } },
        { nota: { tipo: 'warn', texto: 'Marcou etapa errada? Na ficha, no fim do "Passo a passo da jornada", use "↩ Voltar para a etapa anterior". Para trocar por qualquer outra, use a aba Acompanhamento → "Marcou errado?".' } },
      ],
    },
    {
      id: 'cadastrar', icone: '➕', titulo: 'Cadastrar um visitante', resumo: 'No culto ou pelo QR code.',
      blocos: [
        { p: 'No culto:', passos: [
          'Abra "Novo visitante" no menu.',
          'Preencha nome e WhatsApp (o resto é opcional, mas ajuda).',
          'Se aparecer aviso de possível duplicado, abra a ficha existente em vez de cadastrar de novo.',
          'O sistema sugere um grupo pela região e perfil. Toque em Cadastrar.',
        ] },
        { p: 'Pelo QR code: em Configurações → Autocadastro (QR) você imprime o código para deixar nas mesas ou no telão. A pessoa aponta a câmera, preenche sozinha, e cai direto no sistema.' },
      ],
    },
    {
      id: 'registrar', icone: '📝', titulo: 'Registrar um contato', resumo: 'O coração do acompanhamento.',
      blocos: [
        { passos: [
          'Abra a ficha da pessoa e, no passo atual, toque em "Enviar mensagem" (texto pronto) e depois em "Registrar o contato".',
          'Responda "Como ela respondeu?": Quer visitar / Respondeu / Não respondeu / Pediu para parar / Cuidado-crise.',
          'Anote em uma linha o que a pessoa disse e o próximo passo. Toque em Salvar registro.',
        ] },
        { nota: { tipo: 'ok', texto: 'O sistema confirma o que aconteceu (ex.: "Maria avançou: Em contato → Encaminhado ao líder") e a etapa muda sozinha.' } },
        { nota: { tipo: 'info', texto: 'Princípio da casa: uma consolidação sem registro gera perda de informações importantes. Registre sempre.' } },
      ],
    },
    {
      id: 'papeis', icone: '🧑‍🤝‍🧑', titulo: 'Papéis da equipe', resumo: 'Quem faz o quê no ministério.',
      blocos: [
        { lista: [
          'Gestão Integração — distribui os visitantes, acompanha o funil e resolve pendências.',
          'Integradores pós-culto — "donos" do acompanhamento na primeira fase: fazem os contatos e registram tudo.',
          'Líder de grupo — recebe quem aceitou o convite, fala antes da visita e assume depois.',
          'Pastores e Gestão Ministerial — acionados nos casos de cuidado/crise e nas decisões que pedem cobertura pastoral.',
        ] },
        { nota: { tipo: 'info', texto: 'Cada pessoa vê apenas os visitantes sob seu cuidado (ou de quem ela supervisiona). Escolha quem você é no seletor "Vendo como" no topo.' } },
      ],
    },
    {
      id: 'cuidado', icone: '🚨', titulo: 'Cuidado & crise', resumo: 'Quando o cuidado vem antes do roteiro.',
      blocos: [
        { p: 'Na ficha, toque no botão vermelho 🚨 (ou escolha "Cuidado/crise" ao registrar). Isso sinaliza a liderança sem interromper o registro.' },
        { p: 'O que fazer:', lista: [
          'Saia do roteiro de consolidação.',
          'Acione a liderança / pastor.',
          'Registre o encaminhamento na ficha.',
          'Nunca prometa nada em nome da igreja, nem aja sozinho.',
          'Havendo risco iminente, oriente também os serviços de emergência.',
        ] },
        { nota: { tipo: 'crit', texto: 'Esses são os registros mais delicados. Só pastor e o responsável direto os veem. Anote com sobriedade e trate com sigilo.' } },
      ],
    },
    {
      id: 'faq', icone: '❓', titulo: 'Perguntas frequentes', resumo: 'As dúvidas mais comuns da equipe.',
      blocos: [
        { p: 'Preciso instalar algo? Não — abre no navegador; opcionalmente "Adicionar à Tela de Início".' },
        { p: 'Cadastrei no meu celular, aparece no de outra pessoa? Sim, tudo sincroniza na nuvem automaticamente.' },
        { p: 'Meus registros podem se perder? Não, desde que apareça "● Sincronizado". Se ficar em erro, verifique a internet e recarregue.' },
        { p: 'Marquei etapa errada? Use "Voltar para a etapa anterior" na ficha, ou a aba Acompanhamento.' },
        { p: 'Cadastrei alguém duas vezes? O sistema avisa ao digitar o WhatsApp; siga com uma ficha só.' },
        { p: 'A pessoa pediu para parar? Registre "Pediu para parar" — a porta segue aberta se ela voltar.' },
      ],
    },
  ]
}

function Nota({ tipo, texto }: { tipo: 'info' | 'ok' | 'warn' | 'crit'; texto: string }) {
  const classe = tipo === 'ok' ? 'alerta-info' : tipo === 'warn' ? 'alerta-warn' : tipo === 'crit' ? 'alerta-perigo' : 'alerta-info'
  const emoji = tipo === 'ok' ? '✅' : tipo === 'warn' ? '⚠️' : tipo === 'crit' ? '🚨' : '💡'
  return <div className={`alerta ${classe}`} style={{ marginTop: 10 }}>{emoji} <div>{texto}</div></div>
}

export default function Ajuda() {
  const s = useAppState()
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<string | null>('comecar')

  const todas = secoes(s.config.termoGrupo)
  const b = busca.trim().toLowerCase()
  const lista = b
    ? todas.filter((sec) => JSON.stringify(sec).toLowerCase().includes(b))
    : todas

  return (
    <div style={{ maxWidth: 780 }}>
      <h1 className="titulo-pagina">Ajuda</h1>
      <p className="subtitulo">Como usar o sistema de consolidação, passo a passo.</p>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1, maxWidth: 360 }}>
          <span className="search-icon"><IcoBusca /></span>
          <input type="text" placeholder="Buscar na ajuda…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {lista.length === 0 && <div className="vazio">Nada encontrado para "{busca}".</div>}

      {lista.map((sec) => {
        const abertoAgora = b !== '' || aberta === sec.id
        return (
          <div className="card" key={sec.id} style={{ marginBottom: 10 }}>
            <div
              className="card-cab"
              style={{ marginBottom: abertoAgora ? 12 : 0, cursor: 'pointer' }}
              onClick={() => setAberta(aberta === sec.id ? null : sec.id)}
            >
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{sec.icone}</span> {sec.titulo}
              </h3>
              {!abertoAgora && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{sec.resumo}</span>}
            </div>
            {abertoAgora && sec.blocos.map((bl, i) => (
              <div key={i}>
                {bl.p && <p style={{ margin: '0 0 10px', fontSize: 14.5, color: 'var(--text-2)' }}>{bl.p}</p>}
                {bl.lista && (
                  <ul style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                    {bl.lista.map((it, j) => <li key={j}>{it}</li>)}
                  </ul>
                )}
                {bl.passos && (
                  <ol style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                    {bl.passos.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{it}</li>)}
                  </ol>
                )}
                {bl.nota && <Nota tipo={bl.nota.tipo} texto={bl.nota.texto} />}
              </div>
            ))}
          </div>
        )
      })}

      <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5, marginTop: 30, fontStyle: 'italic' }}>
        "Não estamos falando de um produto, e sim de pessoas."
      </p>
    </div>
  )
}
