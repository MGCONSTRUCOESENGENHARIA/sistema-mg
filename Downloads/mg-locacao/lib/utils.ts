export function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return '—'
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
export function fmtKm(v: number | null | undefined): string {
  if (!v) return '—'
  return Number(v).toLocaleString('pt-BR') + ' km'
}
export function modelShort(m: string): string {
  return m.replace('FIAT/','').replace('CHEV/','').replace('HYU/','').replace('VW/','').replace('I/BYD','BYD').replace('FORD/','')
}
export function shortName(name: string | null | undefined): string {
  if (!name) return '—'
  const parts = name.trim().split(' ')
  return parts.length <= 2 ? name : parts[0] + ' ' + parts[1]
}
export const situacaoMap: Record<string,{color:string,bg:string}> = {
  'ALUGADO':    { color: '#16a34a', bg: '#dcfce7' },
  'DISPONÍVEL': { color: '#2563eb', bg: '#dbeafe' },
  'RESERVADO':  { color: '#d97706', bg: '#fef3c7' },
  'À VENDA':    { color: '#7c3aed', bg: '#ede9fe' },
  'PT/ROUBO':   { color: '#dc2626', bg: '#fee2e2' },
  'VENDIDO':    { color: '#6b7280', bg: '#f3f4f6' },
  'PREPARANDO': { color: '#6b7280', bg: '#f3f4f6' },
}
export function kmInfo(km: number) {
  if (km >= 150000) return { color: '#dc2626', bg: '#fee2e2', label: 'Alto' }
  if (km >= 80000)  return { color: '#d97706', bg: '#fef3c7', label: 'Médio' }
  return { color: '#16a34a', bg: '#dcfce7', label: 'Baixo' }
}
