import { PresencaTipo } from './supabase'

// ── DATAS ────────────────────────────────────────────────────────────

export function diasDoMes(mesAno: string): Date[] {
  const [ano, mes] = mesAno.split('-').map(Number)
  const total = new Date(ano, mes, 0).getDate()
  const dias: Date[] = []
  for (let d = 1; d <= total; d++) {
    const dt = new Date(ano, mes - 1, d)
    if (dt.getDay() !== 0) dias.push(dt) // sem domingos
  }
  return dias
}

export function isSabado(d: Date) { return d.getDay() === 6 }
export function isDomingo(d: Date) { return d.getDay() === 0 }

export function formatDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function formatBR(dt: Date): string {
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export function mesAtual(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

export function nomeMes(mesAno: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const [, mes] = mesAno.split('-').map(Number)
  return meses[mes - 1]
}

export function fim1Quinzena(dias: Date[]): number {
  const idx = dias.findIndex(d => d.getDate() > 15)
  return idx === -1 ? dias.length - 1 : idx - 1
}

// ── MOEDA ─────────────────────────────────────────────────────────────

export function formatR$(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatNum(v: number, dec = 2): string {
  return (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── PRESENÇA ──────────────────────────────────────────────────────────

export const AUSENCIAS: PresencaTipo[] = ['FALTA', 'ATESTADO', 'AUSENTE', 'SAIU']
export const PRESENCA_LABEL: Record<PresencaTipo, string> = {
  NORMAL: 'Normal',
  FALTA: 'Falta',
  ATESTADO: 'Atestado',
  AUSENTE: 'Ausente',
  SAIU: 'Saiu',
  SABADO_EXTRA: 'Sábado Extra',
}
export const PRESENCA_COR: Record<PresencaTipo, string> = {
  NORMAL: 'bg-green-50 text-green-800',
  SABADO_EXTRA: 'bg-orange-50 text-orange-800',
  FALTA: 'bg-red-50 text-red-700',
  ATESTADO: 'bg-yellow-50 text-yellow-800',
  AUSENTE: 'bg-gray-100 text-gray-600',
  SAIU: 'bg-gray-200 text-gray-500',
}

// ── VALIDAÇÕES ────────────────────────────────────────────────────────

export function validarFracoes(f1: number, f2: number): string | null {
  if (f1 <= 0 || f1 > 1) return 'Fração 1 deve estar entre 0 e 1'
  if (f2 && (f2 <= 0 || f2 > 1)) return 'Fração 2 deve estar entre 0 e 1'
  if (f2 && f1 + f2 > 1) return 'Soma das frações não pode ultrapassar 1'
  return null
}

// ── CAFÉ ─────────────────────────────────────────────────────────────
export const CAFE_DIA = 8 // R$ por dia trabalhado
