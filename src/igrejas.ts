// Acesso multi-igreja (visão de rede). Um pastor de rede é membro de mais de uma
// igreja (tabela membros_igreja); aqui o app descobre quais são e permite trocar
// a igreja ativa — o que recarrega o app apontando para a outra igreja, reusando
// toda a sincronização já existente. Quem tem uma só igreja não vê o seletor.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { getConfigNuvem, getIgrejaAtiva, setIgrejaAtiva } from './nuvem'

export interface IgrejaAcesso {
  id: string
  nome: string
}

// Nome de cada igreja, aprendido ao visitá-la (config.nomeIgreja) — serve de
// fallback no seletor quando o registro público de igrejas não está disponível.
const CHAVE_NOMES = 'ife-igrejas-nomes'

function nomesCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_NOMES) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function lembrarNomeIgreja(igrejaId: string, nome: string) {
  if (!igrejaId || !nome) return
  try {
    const m = nomesCache()
    if (m[igrejaId] !== nome) {
      m[igrejaId] = nome
      localStorage.setItem(CHAVE_NOMES, JSON.stringify(m))
    }
  } catch {
    // storage indisponível: sem cache de nome
  }
}

// Igreja ativa: o override do seletor, ou a igreja padrão do site.
export function igrejaAtivaId(): string {
  return getIgrejaAtiva() ?? getConfigNuvem()?.igrejaId ?? ''
}

// Troca a igreja ativa e recarrega o app apontando para ela. Voltar à igreja
// padrão do site limpa o override.
export function trocarIgreja(id: string) {
  if (!id || id === igrejaAtivaId()) return
  setIgrejaAtiva(id === getConfigNuvem()?.igrejaId ? null : id)
  window.location.hash = '/'
  window.location.reload()
}

// Vínculos do usuário logado (ids das igrejas de que é membro). Busca uma vez e
// cacheia — o seletor e o boot (auto-provisão de rede) compartilham o resultado.
let vinculosCache: string[] | null = null
let vinculosPromise: Promise<string[]> | null = null

function buscarVinculos(): Promise<string[]> {
  if (!vinculosPromise) {
    vinculosPromise = (async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase.from('membros_igreja').select('igreja_id')
        if (error) return []
        return [...new Set((data ?? []).map((r: { igreja_id: string }) => r.igreja_id))]
      } catch {
        return []
      }
    })().then((ids) => { vinculosCache = ids; return ids })
  }
  return vinculosPromise
}

// Ids das igrejas de que o usuário é membro. `null` enquanto carrega.
export function useVinculos(): { ids: string[] | null } {
  const [ids, setIds] = useState<string[] | null>(vinculosCache)
  useEffect(() => {
    let vivo = true
    void buscarVinculos().then((v) => { if (vivo) setIds(v) })
    return () => { vivo = false }
  }, [])
  return { ids }
}

// Igrejas de que o usuário logado é membro (para o seletor). Devolve lista vazia
// quando é uma só — aí o seletor não aparece.
export function useIgrejasDoUsuario(): { igrejas: IgrejaAcesso[]; ativa: string } {
  const [igrejas, setIgrejas] = useState<IgrejaAcesso[]>([])
  const ativa = igrejaAtivaId()

  useEffect(() => {
    let vivo = true
    void (async () => {
      const ids = await buscarVinculos()
      if (ids.length <= 1) {
        if (vivo) setIgrejas([])
        return
      }
      // Nomes: registro público de igrejas (se existir) → cache → o próprio id.
      const nomes: Record<string, string> = {}
      if (supabase) {
        try {
          const { data: regs } = await supabase.from('igrejas').select('id,nome').in('id', ids)
          for (const r of (regs ?? []) as { id: string; nome: string }[]) nomes[r.id] = r.nome
        } catch {
          // registro ainda não existe: usa o cache/id
        }
      }
      const cache = nomesCache()
      const lista = ids
        .map((id) => ({ id, nome: nomes[id] ?? cache[id] ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      if (vivo) setIgrejas(lista)
    })()
    return () => { vivo = false }
  }, [])

  return { igrejas, ativa }
}
