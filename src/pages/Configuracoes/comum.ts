// Helpers compartilhados pelas abas das Configurações.
import { useEffect, useRef, useState } from 'react'
import { setEstado } from '../../store'
import { type ConfigIgreja } from '../../types'

/* ---------------- Rascunho + Salvar ----------------
   Guarda as edições localmente e só grava ao clicar em "Salvar" — assim a pessoa
   tem certeza do que foi salvo. Adota mudanças externas (nuvem) só quando não há
   edição pendente, para não descartar o que está sendo digitado. */
export function useRascunho<T extends object>(atual: T) {
  const [d, setD] = useState<T>(atual)
  const ref = useRef(JSON.stringify(atual))
  const atualKey = JSON.stringify(atual)
  useEffect(() => {
    if (atualKey !== ref.current) {
      setD((x) => (JSON.stringify(x) === ref.current ? atual : x))
      ref.current = atualKey
    }
  }, [atualKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const pendente = JSON.stringify(d) !== atualKey
  return { d, set: (p: Partial<T>) => setD((x) => ({ ...x, ...p })), pendente }
}

export function salvarConfig(patch: Partial<ConfigIgreja>) {
  setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
}

// normaliza texto para busca (sem acento, minúsculo)
export function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
