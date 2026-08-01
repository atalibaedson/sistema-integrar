import { useState } from 'react'
import { useAppState } from '../store'
import { IcoBusca, IcoDownload } from '../icones'

// PDF do manual servido como arquivo estático (pasta public/), publicado na raiz.
const URL_MANUAL_PDF = '/Manual-Consolidacao-iFE.pdf'

// Manual de uso dentro do app. Espelha o conteúdo de manual.html (fonte do PDF).
type Bloco = {
  h?: string // subtítulo dentro da seção (ex.: nome de um papel)
  p?: string
  lista?: string[]
  passos?: string[]
  nota?: { tipo: 'info' | 'ok' | 'warn' | 'crit'; texto: string }
}
type Secao = { id: string; icone: string; titulo: string; resumo: string; blocos: Bloco[] }

function secoes(termoGrupo: string): Secao[] {
  return [
    {
      id: 'comecar', icone: '🚀', titulo: 'Começando', resumo: 'Entrar no sistema e deixar com cara de app.',
      blocos: [
        { p: 'O sistema abre no navegador — não precisa instalar nada. Cada pessoa entra com o próprio login (e-mail e senha), e vê apenas o que a sua função permite.' },
        {
          h: 'Primeiro acesso (só uma vez)',
          passos: [
            'Abra o link do sistema e toque em "Criar acesso / Cadastre-se".',
            'Preencha seus dados, seu e-mail e uma senha, e marque a(s) sua(s) função(ões).',
            'Confirme o e-mail pelo link que chega na sua caixa de entrada.',
            'Aguarde a Gestão da Integração (ou um pastor) aprovar o seu acesso.',
            'Depois de aprovado, entre em "Entrar" com o seu e-mail e senha.',
          ],
        },
        { nota: { tipo: 'info', texto: 'Esqueceu a senha? Na tela "Entrar", use "Esqueci a senha" para receber um link de redefinição no seu e-mail.' } },
        {
          h: 'Deixar com cara de aplicativo (recomendado)',
          lista: [
            'iPhone (Safari): Compartilhar → Adicionar à Tela de Início',
            'Android (Chrome): menu ⋮ → Adicionar à tela inicial',
          ],
        },
        { nota: { tipo: 'ok', texto: 'Tudo o que você registra é salvo automaticamente na nuvem — o topo mostra "● Sincronizado". Pode fechar e continuar depois em qualquer aparelho: nada se perde.' } },
      ],
    },
    {
      id: 'areas', icone: '🧭', titulo: 'As áreas do app', resumo: 'O que cada tela do menu faz.',
      blocos: [
        { lista: [
          'Painel — o que fazer hoje, o funil da consolidação e os alertas.',
          'Jornada — quadro visual por etapa; arraste o cartão para avançar a pessoa.',
          'Visitantes — lista de todos, filtrada por etapa, com a próxima ação de cada um.',
          'Novo visitante — cadastro de quem você aborda no culto.',
          'Painel do líder — o que cada líder precisa fazer com quem foi encaminhado a ele.',
          'Relatórios — os números da consolidação (Gestão e pastores).',
          'Equipe — cadastro das pessoas do ministério e suas funções (Gestão e pastores).',
          'Aprovações — liberar o acesso de novos integrantes (Gestão e pastores).',
          'Auditoria — histórico de quem fez o quê (Gestão e pastores).',
          'Configurações — igreja, grupos, cultos, mensagens, QR code, requisitos e backup (Gestão e pastores).',
          'Ajuda — este manual.',
        ] },
        { nota: { tipo: 'info', texto: 'O menu mostra só as áreas da sua função. Um acolhedor, por exemplo, vê apenas o cadastro de visitante e a Ajuda.' } },
      ],
    },
    {
      id: 'jornada', icone: '🗺️', titulo: 'A jornada do visitante', resumo: 'Os 7 passos, do "chegou" ao "virou membro".',
      blocos: [
        { passos: [
          'Cadastro realizado — a pessoa chega pelo culto (o acolhedor cadastra) ou pelo QR code (ela mesma preenche).',
          'Primeira semana de contatos — mensagens de segunda (acolhida), quarta (convite ao grupo) e sábado (celebração). O texto já vem pronto.',
          `Encaminhado ao líder de ${termoGrupo} — quando a pessoa aceita visitar, o líder fala com ela ANTES da visita.`,
          `Visita ao ${termoGrupo} — a pessoa participa de um encontro pela primeira vez.`,
          `Líder assume o acompanhamento — depois da visita, o líder confirma que assumiu e registra quando a pessoa começou a frequentar a ${termoGrupo}. A consolidação fica de apoio.`,
          'Batismo — etapa de quem ainda não é batizado. Quem já chegou batizado pula este passo.',
          'Membro 🎉 — ser recebido(a) como membro da igreja conclui a jornada.',
        ] },
        { nota: { tipo: 'info', texto: 'O batismo é um passo opcional: muitos já chegam batizados de outra igreja — e ninguém se batiza duas vezes. Por isso quem já é batizado vai direto de "Líder assume" para "Membro". O que fecha a jornada, nos dois caminhos, é virar membro.' } },
        { nota: { tipo: 'info', texto: `Antes de receber como membro, o líder confirma dois requisitos (configuráveis pela Gestão): estar na ${termoGrupo} há pelo menos 3 meses e ter tido mais de 80% de frequência nesse período. Se faltar tempo, é possível receber como exceção — e isso fica registrado.` } },
        { nota: { tipo: 'info', texto: 'Você não precisa decorar isso: ao registrar cada contato, o sistema move a pessoa para o passo certo sozinho. A ficha sempre mostra onde ela está e o que fazer.' } },
        { nota: { tipo: 'warn', texto: 'Marcou etapa errada? Na ficha, no fim do "Passo a passo da jornada", use "↩ Voltar para a etapa anterior". Para trocar por qualquer outra, use a aba Acompanhamento → "Marcou errado?".' } },
      ],
    },
    {
      id: 'cadastrar', icone: '➕', titulo: 'Cadastrar um visitante', resumo: 'No culto ou pelo QR code.',
      blocos: [
        { h: 'No culto (você cadastra)', passos: [
          'Abra "Novo visitante" no menu.',
          'Preencha nome e WhatsApp (o resto é opcional, mas ajuda).',
          'Se aparecer aviso de possível duplicado, abra a ficha existente em vez de cadastrar de novo.',
          'O sistema sugere um grupo pela região e perfil. Toque em Cadastrar.',
        ] },
        { h: 'Pelo QR code (a pessoa cadastra)', p: 'Em Configurações → Autocadastro (QR) você imprime o código para deixar nas mesas ou no telão. A pessoa aponta a câmera, preenche sozinha, e o cadastro cai direto no sistema.' },
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
        { nota: { tipo: 'info', texto: 'Princípio da casa: uma consolidação sem registro gera perda de informação importante. Registre sempre — é rápido e protege o cuidado com a pessoa.' } },
      ],
    },
    {
      id: 'papeis', icone: '🧑‍🤝‍🧑', titulo: 'Papéis da equipe — o que cada um faz', resumo: 'A função de cada pessoa e como usar o sistema.',
      blocos: [
        { p: 'Cada pessoa do ministério tem uma ou mais funções, definidas em Equipe e confirmadas na aprovação do acesso. A função decide o que a pessoa vê e faz no sistema.' },

        {
          h: '🌸 Acolhedor — recebe e cadastra no culto',
          p: 'O que faz: é quem recebe o visitante no dia do culto e faz o cadastro na hora. No sistema, tem acesso só ao formulário de cadastro (e a esta Ajuda) — ao entrar, já cai direto na tela de cadastro.',
          passos: [
            'Entre com o seu login — a tela de "Novo visitante" abre sozinha.',
            'Preencha nome e WhatsApp (o mínimo); o resto ajuda, mas é opcional.',
            'Se aparecer aviso de possível duplicado, avise a equipe em vez de recadastrar.',
            'Toque em Cadastrar. Pronto para receber e cadastrar o próximo.',
          ],
        },
        { nota: { tipo: 'info', texto: 'O acompanhamento depois do cadastro é do integrador pós-culto — o acolhedor não precisa voltar à ficha.' } },

        {
          h: '🤲 Integrador pós-culto — acompanha a primeira fase',
          p: 'O que faz: é o "dono" do acompanhamento na primeira semana. Faz os contatos no WhatsApp, registra cada conversa e encaminha ao líder quando a pessoa aceita conhecer o grupo. Vê apenas os visitantes sob a sua responsabilidade.',
          passos: [
            'No Painel, veja "o que fazer hoje" e a lista de Visitantes.',
            'Abra a ficha da pessoa; no passo atual, toque em Enviar mensagem e depois em Registrar o contato.',
            'Diga como ela respondeu — o sistema avança a etapa sozinho.',
            'Quando ela aceitar visitar, encaminhe ao líder (o sistema guia o handoff).',
            'Registre sempre. Num caso de sofrimento ou urgência, toque em 🚨 Cuidado/crise.',
          ],
        },

        {
          h: `🏠 Líder de ${termoGrupo} — recebe e integra no grupo`,
          p: `O que faz: recebe quem foi encaminhado, faz o contato antes da primeira visita, confirma que assumiu o acompanhamento e cuida da pessoa até o batismo e a recepção como membro. Trabalha pelo Painel do líder.`,
          passos: [
            'Abra o Painel do líder: seus visitantes aparecem por tarefa (falar antes da visita / confirmar que assumiu / acompanhando).',
            'Faça o contato pré-visita (mensagem pronta). Quando a pessoa visitar, marque "Visitou".',
            'Confirme que assumiu o acompanhamento.',
            `Registre a data em que ela começou a frequentar a ${termoGrupo}.`,
            'Encaminhe ao batismo (se ainda não é batizada) e, por fim, receba como membro — confirmando os requisitos de tempo e frequência.',
          ],
        },

        {
          h: '🧭 Gestão Integração — coordena tudo',
          p: 'O que faz: enxerga o sistema inteiro. Distribui visitantes, acompanha o funil, resolve pendências, aprova os acessos da equipe, cadastra as pessoas e configura o sistema.',
          passos: [
            'Acompanhe o Painel e a lista completa de Visitantes.',
            'Em Aprovações, libere (ou recuse) os novos acessos que pedem entrada.',
            'Em Equipe, cadastre pessoas, defina funções e a hierarquia (quem supervisiona quem).',
            'Em Configurações, ajuste igreja, grupos, cultos, mensagens, QR code, requisitos de membresia e backup.',
            'Em Relatórios e Auditoria, acompanhe os números e o histórico de ações.',
          ],
        },

        {
          h: '✝️ Pastores e Gestão Ministerial — cobertura pastoral',
          p: 'O que faz: dá cobertura pastoral e enxerga tudo, inclusive os registros sensíveis de cuidado/crise. Participa das aprovações de acesso e acompanha os indicadores.',
          passos: [
            'Seja acionado nos casos 🚨 de cuidado/crise (só pastor e o responsável direto veem esses registros).',
            'Acompanhe os Relatórios da consolidação.',
            'Ajude a liberar novos acessos em Aprovações.',
          ],
        },

        { nota: { tipo: 'info', texto: 'Uma pessoa pode ter mais de uma função ao mesmo tempo (ex.: líder e integrador) — o acesso é a soma das funções. Cada um vê os visitantes sob o seu cuidado (ou de quem supervisiona); Gestão e pastores veem todos.' } },
      ],
    },
    {
      id: 'cuidado', icone: '🚨', titulo: 'Cuidado & crise', resumo: 'Quando o cuidado vem antes do roteiro.',
      blocos: [
        { p: 'Na ficha, toque no botão vermelho 🚨 (ou escolha "Cuidado/crise" ao registrar). Isso sinaliza a liderança sem interromper o registro.' },
        { h: 'O que fazer', lista: [
          'Saia do roteiro de consolidação.',
          'Acione a liderança / pastor.',
          'Registre o encaminhamento na ficha.',
          'Nunca prometa nada em nome da igreja, nem aja sozinho.',
          'Havendo risco iminente, oriente também os serviços de emergência.',
        ] },
        { nota: { tipo: 'crit', texto: 'Esses são os registros mais delicados. Só o pastor e o responsável direto os veem. Anote com sobriedade e trate com sigilo.' } },
      ],
    },
    {
      id: 'faq', icone: '❓', titulo: 'Perguntas frequentes', resumo: 'As dúvidas mais comuns da equipe.',
      blocos: [
        { p: 'Preciso instalar algo? Não — abre no navegador; opcionalmente "Adicionar à Tela de Início".' },
        { p: 'Como eu entro? Com seu e-mail e senha, depois de aprovado. No primeiro acesso, cadastre-se, confirme o e-mail e aguarde a aprovação da Gestão/pastores.' },
        { p: 'Esqueci a senha. Use "Esqueci a senha" na tela Entrar — chega um link de redefinição no seu e-mail.' },
        { p: 'Cadastrei no meu celular, aparece no de outra pessoa? Sim, tudo sincroniza na nuvem automaticamente.' },
        { p: 'Quem vê os dados? Cada um vê os visitantes sob seu cuidado (ou de quem supervisiona). Gestão e pastores veem todos; os registros de cuidado/crise, só o pastor e o responsável direto.' },
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
      <h1 className="titulo-pagina">Ajuda — Manual de uso</h1>
      <p className="subtitulo">Como usar o sistema de consolidação, passo a passo — para quem nunca usou.</p>

      <a
        className="btn btn-sec"
        href={URL_MANUAL_PDF}
        download
        target="_blank"
        rel="noreferrer"
        style={{ marginBottom: 14 }}
      >
        <IcoDownload size={15} /> Baixar manual (PDF)
      </a>

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
                {bl.h && <h4 style={{ margin: '16px 0 6px', fontSize: 15, fontWeight: 700 }}>{bl.h}</h4>}
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
