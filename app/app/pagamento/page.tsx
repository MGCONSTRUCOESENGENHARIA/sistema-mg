"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { mesAtual, nomeMes, formatR$, formatDate } from "@/lib/utils";

const TABELA_INSS: [number, number][] = [
  [4000, 368.6],
  [3866.67, 352.6],
  [2800, 227.68],
  [2706.67, 219.28],
  [2613.33, 210.88],
  [2520, 202.48],
  [2426.67, 194.08],
  [2333.33, 185.68],
  [2146.67, 168.88],
  [2050, 160.18],
  [1981.67, 154.03],
  [1913.33, 147.88],
  [1845, 141.73],
  [1776.67, 135.58],
  [1708.33, 129.43],
  [1640, 123.28],
  [1571.67, 117.87],
  [1800, 137.68],
  [1740, 132.28],
  [1680, 126.88],
  [1620, 121.5],
  [1560, 117.0],
  [1500, 112.5],
  [1440, 108.0],
  [1380, 103.5],
];

function calcINSS(salarioFinal: number): number {
  const sorted = [...TABELA_INSS].sort((a, b) => b[0] - a[0]);
  for (const [base, desc] of sorted) {
    if (salarioFinal >= base) return desc;
  }
  return 0;
}

function calcDSR(
  presencasDatas: { data: string; tipo: string }[],
  mes: string,
): number {
  const faltasDatas = presencasDatas
    .filter((p) => p.tipo === "FALTA" || p.tipo === "AUSENTE")
    .map((p) => new Date(p.data + "T12:00"));

  if (faltasDatas.length === 0) return 0;

  const [ano, mo] = mes.split("-").map(Number);
  const domingosMes: Date[] = [];
  const d = new Date(ano, mo - 1, 1);

  while (d.getMonth() === mo - 1) {
    if (d.getDay() === 0) domingosMes.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  const domingosPenalizados = new Set<string>();

  for (const falta of faltasDatas) {
    const domingo = new Date(falta);
    domingo.setDate(falta.getDate() + ((7 - falta.getDay()) % 7));

    const domKey = formatDate(domingo);
    const estaNoMes = domingosMes.some((dom) => formatDate(dom) === domKey);

    if (estaNoMes) domingosPenalizados.add(domKey);
  }

  return domingosPenalizados.size;
}

interface Linha {
  func_id: string;
  nome: string;
  equipe: string;
  empresa: string;
  pix_tipo: string | null;
  pix_chave: string | null;
  tipo_pagamento: string;
  valor_diaria: number;
  salario_base: number;
  total_diarias: number;
  extras_folha: number;
  dias_uteis: number;
  faltas: number;
  ausentes: number;
  extra_folha_valor: number;
  adiantamento_valor: number;
  presencas_datas: { data: string; tipo: string }[];
}

function calcRow(l: Linha, ed: any) {
  const tipo = ed.tipo_pagamento || l.tipo_pagamento;
  const faltasEAusentes = l.faltas + l.ausentes;
  const naoRegistrado = l.empresa === "NÃO REGISTRADO";
  const taxaSindicato = naoRegistrado ? 0 : 17.66;
  const horaExtraAuto = l.extras_folha * l.valor_diaria;

  if (tipo === "DIÁRIA") {
    const totalBase = l.dias_uteis * l.valor_diaria;

    const total =
      totalBase +
      horaExtraAuto -
      l.adiantamento_valor +
      (ed.complemento || 0) -
      (ed.desc_materiais || 0) -
      (ed.desc_emprestimo || 0) -
      (ed.desc_acerto || 0) -
      (ed.desc_pensao || 0) -
      taxaSindicato;

    return {
      dsr: 0,
      inss: 0,
      salarioLiq: 0,
      horaExtra: horaExtraAuto,
      total,
      contracheque: total - horaExtraAuto,
      sindicato: taxaSindicato,
    };
  }

  const salBase = l.salario_base;
  const salarioFinal = salBase - (salBase / 30) * faltasEAusentes;

  if (tipo === "SALÁRIO") {
    const total =
      salarioFinal -
      l.adiantamento_valor +
      horaExtraAuto +
      (ed.complemento || 0) -
      (ed.desc_materiais || 0) -
      (ed.desc_emprestimo || 0) -
      (ed.desc_acerto || 0) -
      (ed.desc_pensao || 0) -
      taxaSindicato;

    return {
      dsr: 0,
      inss: 0,
      salarioLiq: salarioFinal,
      horaExtra: horaExtraAuto,
      total,
      contracheque: total - horaExtraAuto,
      sindicato: taxaSindicato,
    };
  }

  const dsrCalc = ((salarioFinal * 2) / 30) * (ed.dsr_qtd || 0);
  const inss = calcINSS(salarioFinal);

  const total =
    salarioFinal -
    l.adiantamento_valor +
    horaExtraAuto +
    (ed.complemento || 0) -
    (ed.desc_materiais || 0) -
    (ed.desc_emprestimo || 0) -
    (ed.desc_acerto || 0) -
    (ed.desc_pensao || 0) -
    dsrCalc -
    taxaSindicato -
    inss;

  return {
    dsr: dsrCalc,
    inss,
    salarioLiq: salarioFinal,
    horaExtra: horaExtraAuto,
    total,
    contracheque: total - horaExtraAuto,
    sindicato: taxaSindicato,
  };
}

export default function PagamentoPage() {
  const [equipe, setEquipe] = useState<"ARMAÇÃO" | "CARPINTARIA">("ARMAÇÃO");
  const [mes, setMes] = useState(mesAtual());
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Record<string, any>>({});
  const [modalFunc, setModalFunc] = useState<any>(null);
  const [mostrarResumo, setMostrarResumo] = useState(false);

  useEffect(() => {
    carregar();
  }, [equipe, mes]);

  async function carregar() {
    setLoading(true);

    const { data: comp } = await supabase
      .from("competencias")
      .select("id")
      .eq("mes_ano", mes)
      .maybeSingle();

    const { data: funcs } = await supabase
      .from("funcionarios")
      .select("id,nome,equipe,valor_diaria,salario_base,empresa,pix_tipo,pix_chave")
      .eq("equipe", equipe)
      .eq("ativo", true)
      .order("nome");

    if (!funcs?.length) {
      setLinhas([]);
      setLoading(false);
      return;
    }

    let presencas: any[] = [];

    if (comp?.id) {
      const { data: pres } = await supabase
        .from("presencas")
        .select("funcionario_id,tipo,fracao,fracao2,data")
        .eq("competencia_id", comp.id)
        .in(
          "funcionario_id",
          funcs.map((f: any) => f.id),
        );

      presencas = pres || [];
    }

    let ajustesAdiantamento: any[] = [];

    if (comp?.id) {
      const { data: ajAdt } = await supabase
        .from("pagamento_ajustes")
        .select("funcionario_id,complemento")
        .eq("competencia_id", comp.id)
        .eq("tipo", "adiantamento");

      ajustesAdiantamento = ajAdt || [];
    }

    const resultado: Linha[] = funcs.map((func: any) => {
      const pAll = presencas.filter((p) => p.funcionario_id === func.id);

      let totalDiarias = 0;
      let extrasfolha = 0;
      let faltas = 0;
      let ausentes = 0;

      pAll.forEach((p) => {
        const data = new Date(p.data + "T12:00");
        const dia = data.getDate();
        const fracaoTotal = Number(p.fracao || 1) + Number(p.fracao2 || 0);

        if (p.tipo === "FALTA") {
          faltas++;
        } else if (p.tipo === "AUSENTE") {
          ausentes++;
        } else if (p.tipo === "SABADO_EXTRA" && dia >= 16) {
          extrasfolha += fracaoTotal;
        } else if (p.tipo === "NORMAL") {
          totalDiarias += fracaoTotal;
        }
      });

      const diasUteis = totalDiarias + faltas + ausentes;
      const salarioBase = Number(func.salario_base || 0);
      const valorDiaria = Number(func.valor_diaria || 0);
      const ajusteAdiantamento = ajustesAdiantamento.find(
        (a) => a.funcionario_id === func.id,
      );
      const complementoAdiantamento = Number(
        ajusteAdiantamento?.complemento || 0,
      );
      const adiantamentoParaDesconto =
        salarioBase * 0.5 + complementoAdiantamento;

      return {
        func_id: func.id,
        nome: func.nome,
        equipe: func.equipe,
        empresa: func.empresa || "",
        pix_tipo: func.pix_tipo || "",
        pix_chave: func.pix_chave || "",
        tipo_pagamento: "DIÁRIA",
        valor_diaria: valorDiaria,
        salario_base: salarioBase,
        total_diarias: totalDiarias,
        extras_folha: extrasfolha,
        dias_uteis: diasUteis,
        faltas,
        ausentes,
        extra_folha_valor: extrasfolha * valorDiaria,
        adiantamento_valor: adiantamentoParaDesconto,
        presencas_datas: pAll.map((p) => ({ data: p.data, tipo: p.tipo })),
      };
    });

    let ajustes: any[] = [];

    if (comp?.id) {
      const { data: aj } = await supabase
        .from("pagamento_ajustes")
        .select("*")
        .eq("competencia_id", comp.id)
        .eq("tipo", "pagamento_final")
        .in(
          "funcionario_id",
          funcs.map((f: any) => f.id),
        );

      ajustes = aj || [];
    }

    const newEdit: Record<string, any> = {};

    resultado.forEach((l) => {
      const aj = ajustes.find((a) => a.funcionario_id === l.func_id);
      const dsr = calcDSR(l.presencas_datas, mes);

      newEdit[l.func_id] = aj
        ? {
            tipo_pagamento: aj.tipo_pagamento || "DIÁRIA",
            complemento: aj.complemento || 0,
            desc_materiais: aj.desc_materiais || 0,
            desc_emprestimo: aj.desc_emprestimo || 0,
            desc_acerto: aj.desc_acerto || 0,
            desc_pensao: aj.desc_pensao || 0,
            dsr_qtd: aj.dsr_qtd || dsr,
          }
        : {
            tipo_pagamento: "DIÁRIA",
            complemento: 0,
            desc_materiais: 0,
            desc_emprestimo: 0,
            desc_acerto: 0,
            desc_pensao: 0,
            dsr_qtd: dsr,
          };
    });

    setLinhas(resultado);
    setEditando(newEdit);
    setLoading(false);
  }

  async function salvarAjuste(funcId: string, newEd: any) {
    const { data: comp } = await supabase
      .from("competencias")
      .select("id")
      .eq("mes_ano", mes)
      .maybeSingle();

    if (!comp?.id) return;

    await supabase.from("pagamento_ajustes").upsert(
      {
        competencia_id: comp.id,
        funcionario_id: funcId,
        tipo: "pagamento_final",
        ...newEd,
        hora_extra: 0,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "competencia_id,funcionario_id,tipo" },
    );
  }

  const saveTimers = useRef<Record<string, any>>({});

  function setEdit(funcId: string, field: string, val: any) {
    setEditando((ed) => {
      const newEd = { ...(ed[funcId] || {}), [field]: val };

      clearTimeout(saveTimers.current[funcId]);
      saveTimers.current[funcId] = setTimeout(
        () => salvarAjuste(funcId, newEd),
        800,
      );

      return { ...ed, [funcId]: newEd };
    });
  }

  function getEd(funcId: string) {
    return (
      editando[funcId] || {
        tipo_pagamento: "DIÁRIA",
        complemento: 0,
        desc_materiais: 0,
        desc_emprestimo: 0,
        desc_acerto: 0,
        desc_pensao: 0,
        dsr_qtd: 0,
      }
    );
  }

  function copiarResumo() {
    const linhasResumo = linhas.map((l) => {
      const calc = calcRow(l, getEd(l.func_id));

      return `${l.nome}	${l.pix_tipo || "—"}	${l.pix_chave || "—"}	${formatR$(calc.contracheque)}	${formatR$(calc.horaExtra)}`;
    });

    const totalContracheque = linhas.reduce(
      (s, l) => s + calcRow(l, getEd(l.func_id)).contracheque,
      0,
    );
    const totalHoraExtra = linhas.reduce(
      (s, l) => s + calcRow(l, getEd(l.func_id)).horaExtra,
      0,
    );

    const texto = [
      `RESUMO PAGAMENTO FINAL — ${equipe} — ${nomeMes(mes)}`,
      "",
      "FUNCIONÁRIO	PIX	CHAVE PIX	TOTAL CONTRACHEQUE	HORA EXTRA",
      ...linhasResumo,
      "",
      `TOTAL			${formatR$(totalContracheque)}	${formatR$(totalHoraExtra)}`,
    ].join("\n");

    navigator.clipboard.writeText(texto);
    alert("Resumo copiado!");
  }

  const btnEq = (eq: "ARMAÇÃO" | "CARPINTARIA") => ({
    padding: "7px 18px",
    borderRadius: 8,
    border: "2px solid #1a3a5c",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    background: equipe === eq ? "#1a3a5c" : "#fff",
    color: equipe === eq ? "#fff" : "#1a3a5c",
  });

  function corTipo(tipo: string) {
    if (tipo === "SALÁRIO")
      return { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8" };
    if (tipo === "SINDICATO")
      return { bg: "#dcfce7", border: "#86efac", color: "#166534" };
    return { bg: "#fefce8", border: "#fbbf24", color: "#92400e" };
  }

  const inp = (red?: boolean) => ({
    width: 75,
    textAlign: "right" as const,
    border: `1px solid ${red ? "#fca5a5" : "#fbbf24"}`,
    borderRadius: 4,
    padding: "3px 5px",
    fontSize: 11,
    background: red ? "#fef2f2" : "#fefce8",
    fontWeight: 600,
    outline: "none",
  });

  const totalGeral = linhas.reduce(
    (s, l) => s + calcRow(l, getEd(l.func_id)).total,
    0,
  );
  const totalCC = linhas.reduce(
    (s, l) => s + calcRow(l, getEd(l.func_id)).contracheque,
    0,
  );

  const totalResumoContracheque = linhas.reduce(
    (s, l) => s + calcRow(l, getEd(l.func_id)).contracheque,
    0,
  );
  const totalResumoHoraExtra = linhas.reduce(
    (s, l) => s + calcRow(l, getEd(l.func_id)).horaExtra,
    0,
  );

  const COLS = [
    { label: "FUNCIONÁRIO", bg: "#1a3a5c", min: 200, sticky: true },
    { label: "TIPO", bg: "#1a3a5c", min: 100 },
    { label: "DIAS TRABALHADOS", bg: "#1e4d2b" },
    { label: "SÁBADOS/FERIADOS", bg: "#4c1d95" },
    { label: "DIAS ÚTEIS", bg: "#1e4d2b" },
    { label: "FALTAS", bg: "#7f1d1d" },
    { label: "AUSENTE", bg: "#6b7280" },
    { label: "DSR", bg: "#92400e" },
    { label: "VALOR", bg: "#1a3a5c" },
    { label: "SALÁRIO FINAL", bg: "#1a3a5c" },
    { label: "ADIANTAMENTO", bg: "#065f46" },
    { label: "HORA EXTRA", bg: "#7c2d12" },
    { label: "COMPLEMENTO", bg: "#7c2d12" },
    { label: "DESC. MAT.", bg: "#991b1b" },
    { label: "DESC. VALE", bg: "#991b1b" },
    { label: "DESC. ACERTO", bg: "#991b1b" },
    { label: "DESC. PENSÃO", bg: "#991b1b" },
    { label: "DESC. DSR", bg: "#991b1b" },
    { label: "DESC. SIND.", bg: "#991b1b" },
    { label: "DESC. INSS", bg: "#991b1b" },
    { label: "TOTAL PGTO", bg: "#064e3b" },
    { label: "CONTRACHEQUE", bg: "#065f46" },
  ];

  return (
    <div>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-resumo,
          .print-resumo * {
            visibility: visible !important;
          }

          .print-resumo {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          .print-resumo-scroll {
            overflow: visible !important;
            padding: 10px !important;
          }

          .print-resumo table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          .print-resumo tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          .print-resumo th,
          .print-resumo td {
            font-size: 9px !important;
            padding: 5px 6px !important;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button style={btnEq("ARMAÇÃO")} onClick={() => setEquipe("ARMAÇÃO")}>
          Armação
        </button>
        <button
          style={btnEq("CARPINTARIA")}
          onClick={() => setEquipe("CARPINTARIA")}
        >
          Carpintaria
        </button>

        <select
          value={mes}
          onChange={(e) => {
            setMes(e.target.value);
            setEditando({});
          }}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
          }}
        >
          {[
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "08",
            "09",
            "10",
            "11",
            "12",
          ].map((m) => {
            const v = `2026-${m}`;
            const ns = [
              "Janeiro",
              "Fevereiro",
              "Março",
              "Abril",
              "Maio",
              "Junho",
              "Julho",
              "Agosto",
              "Setembro",
              "Outubro",
              "Novembro",
              "Dezembro",
            ];
            return (
              <option key={v} value={v}>
                {ns[+m - 1]} 2026
              </option>
            );
          })}
        </select>

        <button
          onClick={() => setMostrarResumo(true)}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: "#1a3a5c",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          📋 Resumo
        </button>

        <button
          onClick={() => window.print()}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: "1px solid #6b7280",
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          🖨 Imprimir
        </button>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          Sábados/Feriados contam a partir do dia 16
        </span>
      </div>

      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#1a3a5c",
          marginBottom: 2,
        }}
      >
        Pagamento Final — Dia 05 · {equipe}
      </h1>

      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
        {nomeMes(mes)} · Mês completo
      </p>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          Carregando...
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "max-content" }}>
            <thead>
              <tr>
                {COLS.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      background: h.bg,
                      color: "#fff",
                      padding: "8px 8px",
                      textAlign: i === 0 ? "left" : "center",
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: h.min || 85,
                      whiteSpace: "nowrap",
                      position: h.sticky ? "sticky" : undefined,
                      left: h.sticky ? 0 : undefined,
                      zIndex: h.sticky ? 20 : undefined,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {linhas.map((l, fi) => {
                const ed = getEd(l.func_id);
                const tipo = ed.tipo_pagamento || l.tipo_pagamento;
                const cores = corTipo(tipo);
                const calc = calcRow(l, ed);
                const bg = fi % 2 === 0 ? "#fff" : "#f9fafb";

                return (
                  <tr key={l.func_id} style={{ background: bg }}>
                    <td
                      style={{
                        padding: "7px 12px",
                        fontWeight: 600,
                        color: "#1a3a5c",
                        fontSize: 12,
                        position: "sticky",
                        left: 0,
                        background: bg,
                        zIndex: 2,
                        borderRight: "2px solid #e5e7eb",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                      onClick={() => setModalFunc({ l, ed, calc })}
                    >
                      <span style={{ borderBottom: "1px dashed #93c5fd" }}>
                        {l.nome}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: cores.bg,
                      }}
                    >
                      <select
                        value={tipo}
                        onChange={(e) =>
                          setEdit(l.func_id, "tipo_pagamento", e.target.value)
                        }
                        style={{
                          border: `1px solid ${cores.border}`,
                          borderRadius: 4,
                          padding: "3px 4px",
                          fontSize: 10,
                          fontWeight: 700,
                          outline: "none",
                          background: cores.bg,
                          color: cores.color,
                        }}
                      >
                        <option value="DIÁRIA">DIÁRIA</option>
                        <option value="SALÁRIO">SALÁRIO</option>
                        <option value="SINDICATO">SINDICATO</option>
                      </select>
                    </td>

                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#166534",
                        fontSize: 13,
                      }}
                    >
                      {l.total_diarias.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "center",
                        color: "#6d28d9",
                        fontSize: 13,
                      }}
                    >
                      {l.extras_folha > 0 ? l.extras_folha.toFixed(1) : "—"}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "center",
                        color: "#166534",
                        fontSize: 13,
                      }}
                    >
                      {l.dias_uteis.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "center",
                        color: "#dc2626",
                        fontSize: 13,
                      }}
                    >
                      {l.faltas || "—"}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: 13,
                      }}
                    >
                      {l.ausentes || "—"}
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fff7ed",
                      }}
                    >
                      <input
                        type="number"
                        step="1"
                        style={{ ...inp(), width: 50 }}
                        value={ed.dsr_qtd ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "dsr_qtd",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        fontSize: 12,
                      }}
                    >
                      {formatR$(l.valor_diaria)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        fontSize: 12,
                      }}
                    >
                      {tipo === "DIÁRIA"
                        ? formatR$(l.salario_base)
                        : formatR$(calc.salarioLiq)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      -{formatR$(l.adiantamento_valor)}
                    </td>

                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        background: "#fff7ed",
                        fontWeight: 700,
                        color: "#92400e",
                        fontSize: 12,
                      }}
                    >
                      {formatR$(calc.horaExtra)}
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fff7ed",
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        style={inp()}
                        value={ed.complemento || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "complemento",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fef2f2",
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        style={inp(true)}
                        value={ed.desc_materiais || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "desc_materiais",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fef2f2",
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        style={inp(true)}
                        value={ed.desc_emprestimo || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "desc_emprestimo",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fef2f2",
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        style={inp(true)}
                        value={ed.desc_acerto || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "desc_acerto",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "4px 4px",
                        textAlign: "center",
                        background: "#fef2f2",
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        style={inp(true)}
                        value={ed.desc_pensao || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          setEdit(
                            l.func_id,
                            "desc_pensao",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      {tipo === "SINDICATO" ? formatR$(calc.dsr) : "—"}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      {l.empresa === "NÃO REGISTRADO"
                        ? "—"
                        : formatR$(calc.sindicato)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        color: "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      {tipo === "SINDICATO" ? formatR$(calc.inss) : "—"}
                    </td>

                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#065f46",
                        background: "#dcfce7",
                        fontSize: 13,
                      }}
                    >
                      {formatR$(calc.total)}
                    </td>
                    <td
                      style={{
                        padding: "7px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#1e40af",
                        background: "#eff6ff",
                        fontSize: 13,
                      }}
                    >
                      {formatR$(calc.contracheque)}
                    </td>
                  </tr>
                );
              })}

              <tr style={{ background: "#1a3a5c", fontWeight: 700 }}>
                <td
                  style={{
                    padding: "9px 12px",
                    color: "#fff",
                    fontSize: 12,
                    position: "sticky",
                    left: 0,
                    background: "#1a3a5c",
                    zIndex: 2,
                  }}
                >
                  TOTAL {equipe}
                </td>
                <td colSpan={19} style={{ padding: "9px 8px" }}></td>
                <td
                  style={{
                    padding: "9px 8px",
                    textAlign: "right",
                    color: "#86efac",
                    fontSize: 13,
                  }}
                >
                  {formatR$(totalGeral)}
                </td>
                <td
                  style={{
                    padding: "9px 8px",
                    textAlign: "right",
                    color: "#93c5fd",
                    fontSize: 13,
                  }}
                >
                  {formatR$(totalCC)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {mostrarResumo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setMostrarResumo(false)}
        >
          <div
            className="print-resumo"
            style={{
              background: "white",
              borderRadius: 16,
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: "#1a3a5c",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
                  Resumo para Pagamento Final
                </div>
                <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>
                  {equipe} · {nomeMes(mes)}
                </div>
              </div>

              <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={copiarResumo}
                  style={{
                    background: "#fff",
                    color: "#1a3a5c",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Copiar
                </button>

                <button
                  onClick={() => window.print()}
                  style={{
                    background: "rgba(255,255,255,.14)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,.35)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Imprimir
                </button>

                <button
                  onClick={() => setMostrarResumo(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="print-resumo-scroll" style={{ overflow: "auto", padding: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        background: "#f3f4f6",
                        color: "#374151",
                        fontSize: 11,
                      }}
                    >
                      FUNCIONÁRIO
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        background: "#f3f4f6",
                        color: "#374151",
                        fontSize: 11,
                      }}
                    >
                      PIX
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        background: "#f3f4f6",
                        color: "#374151",
                        fontSize: 11,
                      }}
                    >
                      CHAVE PIX
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        background: "#eff6ff",
                        color: "#1e40af",
                        fontSize: 11,
                      }}
                    >
                      TOTAL CONTRACHEQUE
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        background: "#fff7ed",
                        color: "#92400e",
                        fontSize: 11,
                      }}
                    >
                      HORA EXTRA
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {linhas.map((l, i) => {
                    const ed = getEd(l.func_id);
                    const calc = calcRow(l, ed);
                    const bg = i % 2 === 0 ? "#fff" : "#f9fafb";

                    return (
                      <tr key={l.func_id} style={{ background: bg }}>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1a3a5c",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {l.nome}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontSize: 12,
                            borderBottom: "1px solid #e5e7eb",
                            color: "#374151",
                            fontWeight: 600,
                          }}
                        >
                          {l.pix_tipo || "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontSize: 12,
                            borderBottom: "1px solid #e5e7eb",
                            color: "#374151",
                            fontWeight: 600,
                          }}
                        >
                          {l.pix_chave || "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontSize: 12,
                            borderBottom: "1px solid #e5e7eb",
                            color: "#1e40af",
                            fontWeight: 700,
                          }}
                        >
                          {formatR$(calc.contracheque)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontSize: 12,
                            borderBottom: "1px solid #e5e7eb",
                            color: "#92400e",
                            fontWeight: 700,
                          }}
                        >
                          {formatR$(calc.horaExtra)}
                        </td>
                      </tr>
                    );
                  })}

                  <tr style={{ background: "#1a3a5c", fontWeight: 700 }}>
                    <td
                      style={{
                        padding: "9px 10px",
                        color: "#fff",
                        fontSize: 12,
                      }}
                    >
                      TOTAL
                    </td>
                    <td style={{ padding: "9px 10px" }}></td>
                    <td style={{ padding: "9px 10px" }}></td>
                    <td
                      style={{
                        padding: "9px 10px",
                        textAlign: "right",
                        color: "#93c5fd",
                        fontSize: 12,
                      }}
                    >
                      {formatR$(totalResumoContracheque)}
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        textAlign: "right",
                        color: "#fed7aa",
                        fontSize: 12,
                      }}
                    >
                      {formatR$(totalResumoHoraExtra)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalFunc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setModalFunc(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              width: "100%",
              maxWidth: 440,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: "#1a3a5c",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
                  {modalFunc.l.nome}
                </div>
                <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>
                  {equipe} · Pagamento Final — {mes}
                </div>
              </div>
              <button
                onClick={() => setModalFunc(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {[
                {
                  label: "Tipo",
                  val: modalFunc.ed.tipo_pagamento || "DIÁRIA",
                  color: "#1a3a5c",
                },
                {
                  label: "Dias Trabalhados",
                  val: modalFunc.l.total_diarias.toFixed(1) + " dias",
                  color: "#166534",
                },
                {
                  label: "Sábados/Feriados 2ª quinzena",
                  val: modalFunc.l.extras_folha.toFixed(1) + " dias",
                  color: "#6d28d9",
                },
                { label: "Faltas", val: modalFunc.l.faltas, color: "#dc2626" },
                {
                  label: "Ausentes",
                  val: modalFunc.l.ausentes,
                  color: "#dc2626",
                },
                {
                  label: "Valor Diária",
                  val: formatR$(modalFunc.l.valor_diaria),
                  color: "#1a3a5c",
                },
                {
                  label: "Salário Base",
                  val: formatR$(modalFunc.l.salario_base),
                  color: "#1a3a5c",
                },
                {
                  label: "Salário Final",
                  val: formatR$(modalFunc.calc.salarioLiq),
                  color: "#1d4ed8",
                },
                {
                  label: "Hora Extra",
                  val: formatR$(modalFunc.calc.horaExtra),
                  color: "#92400e",
                },
                {
                  label: "Complemento",
                  val: formatR$(modalFunc.ed.complemento || 0),
                  color: "#92400e",
                },
                {
                  label: "(-) Adiantamento",
                  val: "-" + formatR$(modalFunc.l.adiantamento_valor),
                  color: "#dc2626",
                },
                {
                  label: "(-) Desc. Materiais",
                  val: "-" + formatR$(modalFunc.ed.desc_materiais || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) Desc. Vale",
                  val: "-" + formatR$(modalFunc.ed.desc_emprestimo || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) Desc. Acerto",
                  val: "-" + formatR$(modalFunc.ed.desc_acerto || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) Desc. Pensão",
                  val: "-" + formatR$(modalFunc.ed.desc_pensao || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) Desc. DSR",
                  val: "-" + formatR$(modalFunc.calc.dsr || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) Sindicato",
                  val: "-" + formatR$(modalFunc.calc.sindicato || 0),
                  color: "#dc2626",
                },
                {
                  label: "(-) INSS",
                  val: "-" + formatR$(modalFunc.calc.inss || 0),
                  color: "#dc2626",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    {item.label}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: item.color }}
                  >
                    {item.val}
                  </span>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0 4px",
                  borderTop: "2px solid #e5e7eb",
                  marginTop: 4,
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#1a3a5c" }}
                >
                  TOTAL PGTO
                </span>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: "#065f46" }}
                >
                  {formatR$(modalFunc.calc.total)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}
                >
                  Contracheque
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}
                >
                  {formatR$(modalFunc.calc.contracheque)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
