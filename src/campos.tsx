// Componentes de formulário compartilhados pelo autocadastro (público) e pelo
// cadastro feito pela equipe — os dois seguem o mesmo padrão visual.

export interface OpcaoEscolha { v: string; rotulo: string }

/**
 * Grupo de opções em "pílulas" — usado para Sim/Não e listas curtas.
 * Melhor que um <select> quando as opções cabem na tela: um toque só, e a
 * resposta fica visível sem abrir menu (importante no celular, no corredor
 * da igreja). Clicar na opção já escolhida desmarca.
 */
export function Escolha({ valor, opcoes, onEscolher }: {
  valor: string
  opcoes: OpcaoEscolha[]
  onEscolher: (v: string) => void
}) {
  return (
    <div className="ac-opcoes">
      {opcoes.map((o) => (
        <button
          type="button" key={o.v}
          className={`ac-opcao ${valor === o.v ? 'sel' : ''}`}
          onClick={() => onEscolher(valor === o.v ? '' : o.v)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export const SIM_NAO: OpcaoEscolha[] = [{ v: 'sim', rotulo: 'Sim' }, { v: 'nao', rotulo: 'Não' }]
