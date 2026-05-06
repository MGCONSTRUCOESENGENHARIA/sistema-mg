'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { VEICULOS_INICIAL, VENCIMENTOS_INICIAL, KM_INICIAL } from '@/lib/data'

type Veiculo = typeof VEICULOS_INICIAL[number] & { [key: string]: any }
type Vencimento = typeof VENCIMENTOS_INICIAL[number] & { [key: string]: any }
type Km = typeof KM_INICIAL[number] & { [key: string]: any }

interface StoreCtx {
  veiculos: Veiculo[]
  vencimentos: Vencimento[]
  kmData: Km[]
  updateVeiculo: (num: number, fields: Partial<Veiculo>) => void
  updateVencimento: (num: number, fields: Partial<Vencimento>) => void
  updateKm: (num: number, fields: Partial<Km>) => void
}

const Store = createContext<StoreCtx>(null as any)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([...VEICULOS_INICIAL] as any)
  const [vencimentos, setVencimentos] = useState<Vencimento[]>([...VENCIMENTOS_INICIAL] as any)
  const [kmData, setKmData] = useState<Km[]>([...KM_INICIAL] as any)

  function updateVeiculo(num: number, fields: Partial<Veiculo>) {
    setVeiculos(prev => prev.map(v => v.num === num ? { ...v, ...fields } : v))
  }
  function updateVencimento(num: number, fields: Partial<Vencimento>) {
    setVencimentos(prev => prev.map(v => v.num === num ? { ...v, ...fields } : v))
  }
  function updateKm(num: number, fields: Partial<Km>) {
    setKmData(prev => prev.map(k => k.num === num ? { ...k, ...fields } : k))
  }

  return (
    <Store.Provider value={{ veiculos, vencimentos, kmData, updateVeiculo, updateVencimento, updateKm }}>
      {children}
    </Store.Provider>
  )
}

export function useStore() { return useContext(Store) }
