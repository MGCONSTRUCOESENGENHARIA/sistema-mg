import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── TYPES ──────────────────────────────────────────────────

export type PerfilTipo = 'gestor' | 'escritorio' | 'encarregado' | 'funcionario'
export type EquipeTipo = 'ARMAÇÃO' | 'CARPINTARIA'
export type TipoPassagem = 'PRA FRENTE' | 'REEMBOLSO' | 'MG' | 'NÃO TEM'
export type PresencaTipo = 'NORMAL' | 'FALTA' | 'ATESTADO' | 'AUSENTE' | 'SAIU' | 'SABADO_EXTRA'
export type AvulsoTipo = 'Vale' | 'Empréstimo' | 'Desconto' | 'Adiantamento'
export type CompetenciaStatus = 'ABERTA' | 'FECHADA'
export type PagamentoStatus = 'PENDENTE' | 'CALCULADO' | 'APROVADO'
export type ObraStatus = 'ATIVA' | 'INATIVA' | 'CONCLUIDA'

export interface Perfil {
  id: string
  nome: string
  email: string
  perfil: PerfilTipo
  equipe?: EquipeTipo
  ativo: boolean
}

export interface Funcionario {
  id: string
  nome: string
  cpf?: string
  equipe: EquipeTipo
  funcao: string
  empresa?: string
  valor_diaria: number
  salario_base: number
  usuario_id?: string
  ativo: boolean
}

export interface Obra {
  id: string
  codigo: string
  nome: string
  status: ObraStatus
}

export interface FuncionarioObraPassagem {
  id: string
  funcionario_id: string
  obra_id: string
  tipo_passagem: TipoPassagem
  valor_passagem: number
  funcionarios?: { nome: string; equipe: EquipeTipo }
  obras?: { nome: string; codigo: string }
}

export interface Competencia {
  id: string
  mes_ano: string
  status: CompetenciaStatus
  fechado_por?: string
  fechado_em?: string
}

export interface Presenca {
  id: string
  competencia_id: string
  funcionario_id: string
  data: string
  tipo: PresencaTipo
  obra_id?: string
  fracao?: number
  obra2_id?: string
  fracao2?: number
  registrado_por?: string
  // joins
  funcionarios?: { nome: string; equipe: EquipeTipo; valor_diaria: number }
  obras?: { nome: string; codigo: string }
  obras2?: { nome: string; codigo: string }
}

export interface Avulso {
  id: string
  competencia_id: string
  funcionario_id: string
  data: string
  tipo: AvulsoTipo
  valor: number
  observacao?: string
  funcionarios?: { nome: string; equipe: EquipeTipo }
}

export interface Pagamento {
  id: string
  competencia_id: string
  funcionario_id: string
  tipo: 'adiantamento' | 'pagamento_final'
  total_diarias: number
  total_extras: number
  dias_uteis_mes: number
  total_faltas: number
  valor_diarias: number
  total_passagem: number
  total_cafe: number
  total_avulsos: number
  hora_extra: number
  complemento: number
  outros_desc: number
  desc_materiais: number
  desc_emprestimo: number
  desc_acerto: number
  desc_pensao: number
  desc_dsr: number
  desc_sindicato: number
  desc_inss: number
  total_pagamento: number
  total_contra_cheque: number
  status: PagamentoStatus
  alertas?: string[]
  observacao?: string
  funcionarios?: { nome: string; equipe: EquipeTipo; valor_diaria: number; salario_base: number }
}

export interface RateioMensal {
  id: string
  competencia_id: string
  obra_id: string
  total_armacao: number
  total_carpintaria: number
  total_geral: number
  percentual: number
  obras?: { nome: string; codigo: string }
}
