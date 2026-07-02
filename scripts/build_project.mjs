import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const sourceRoot = path.resolve(repo, "..", "..");
const source = (...parts) => path.join(sourceRoot, ...parts);
const dest = (...parts) => path.join(repo, ...parts);
const mkdir = (...parts) => fs.mkdirSync(dest(...parts), { recursive: true });
const write = (file, text) => fs.writeFileSync(dest(file), text, "utf8");
const read = (...parts) => fs.readFileSync(source(...parts), "utf8");
const copy = (fromParts, toFile) => fs.copyFileSync(source(...fromParts), dest(toFile));

for (const dir of ["R", "scripts", "data", "figures", "docs", "docs/data"]) mkdir(dir);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  const esc = value => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [header.join(","), ...rows.map(row => header.map(key => esc(row[key])).join(","))].join("\n") + "\n";
}

const n = value => Number(String(value ?? "").replace(",", "."));
const finite = value => Number.isFinite(n(value));
const fmt = (value, digits = 0) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits });
const money = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const sum = (rows, field) => rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
const median = values => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const top = (rows, field, count = 10) => [...rows].filter(row => Number.isFinite(Number(row[field]))).sort((a, b) => Number(b[field]) - Number(a[field])).slice(0, count);

const cnes = parseCsv(read("02 - mapa-rede-assistencial-cnes", "data", "processed", "cnes_ms_2025_12_municipal_summary.csv"));
const siops = parseCsv(read("03 - orcamento-municipal-saude-siops", "data", "processed", "siops_ms_mg_municipal_indicators_2024_p6.csv"));
const sisab = parseCsv(read("04 - producao-atencao-primaria-sisab", "data", "processed", "sisab_primary_care_production_ms_mg_2025_municipal_summary.csv")).filter(row => row.state === "MS");
const amb = parseCsv(read("10 - producao-ambulatorial-sus", "data", "processed", "s10_municipality_outpatient_summary_ms_2024.csv"));
const clusters = parseCsv(read("11 - agrupamento-estrutura-gasto-desfechos-saude", "data", "processed", "s11_health_cluster_assignments_ms.csv"));
const profiles = parseCsv(read("11 - agrupamento-estrutura-gasto-desfechos-saude", "data", "processed", "s11_health_cluster_profiles_ms.csv"));

const cnesBy = new Map(cnes.map(row => [row.municipality_code_sus, row]));
const ambBy = new Map(amb.map(row => [row.provider_municipality_code, row]));
const sisabBy = new Map(sisab.map(row => [row.municipality_code_6, row]));
const siopsBy = new Map();
for (const row of siops) {
  if (!siopsBy.has(row.municipality_code)) siopsBy.set(row.municipality_code, { municipality: row.municipality });
  siopsBy.get(row.municipality_code)[row.indicator_key] = n(row.value);
}

const municipios = clusters.map(row => {
  const code = row.municipality_code;
  const c = cnesBy.get(code) ?? {};
  const a = ambBy.get(code) ?? {};
  const s = sisabBy.get(code) ?? {};
  const o = siopsBy.get(code) ?? {};
  const pop = n(row.population_2024);
  const aps = n(s.total_production);
  return {
    municipality_code: code,
    municipality_name: row.municipality_name,
    population_2024: pop,
    facilities: n(c.facilities || row.facilities),
    sus_linked_facilities: n(c.sus_linked_facilities),
    sus_beds: n(c.sus_beds || row.sus_beds),
    existing_equipment: n(c.existing_equipment || row.existing_equipment),
    facilities_per_10k: n(row.facilities_per_10k),
    sus_beds_per_10k: n(row.sus_beds_per_10k),
    equipment_per_10k: n(row.equipment_per_10k),
    sus_linked_share: n(row.sus_linked_share),
    health_spending_per_capita: n(row.health_spending_per_capita),
    personnel_spending_share_health_spending: n(row.personnel_spending_share_health_spending),
    investment_share_health_spending: n(row.investment_share_health_spending),
    transfer_share_health_spending: n(row.health_transfer_share_health_spending),
    own_revenue_applied_asps_lc141: n(row.own_revenue_applied_asps_lc141 || o.own_revenue_applied_asps_lc141),
    outpatient_records: n(a.records),
    outpatient_approved_quantity: n(a.approved_quantity),
    outpatient_approved_value_brl: n(a.approved_value_brl),
    outpatient_quantity_per_1000: n(a.approved_quantity_per_1000),
    outpatient_value_per_capita_brl: n(a.approved_value_per_capita_brl),
    primary_care_total_production_2025: aps,
    primary_care_home_visit_share: n(s.home_visit_share),
    primary_care_dental_share: n(s.dental_share),
    primary_care_procedure_share: n(s.procedure_share),
    primary_care_production_per_1000: pop ? aps / pop * 1000 : NaN,
    cluster: row.cluster,
    cluster_label: row.cluster_label,
    pc1: n(row.pc1),
    pc2: n(row.pc2)
  };
});

const resumo = [
  ["Municípios analisados", municipios.length],
  ["População coberta", fmt(sum(municipios, "population_2024"))],
  ["Estabelecimentos CNES", fmt(sum(municipios, "facilities"))],
  ["Leitos SUS", fmt(sum(municipios, "sus_beds"))],
  ["Equipamentos registrados", fmt(sum(municipios, "existing_equipment"))],
  ["Produção ambulatorial aprovada", fmt(sum(municipios, "outpatient_approved_quantity"))],
  ["Valor ambulatorial aprovado", money(sum(municipios, "outpatient_approved_value_brl"))],
  ["Produção APS SISAB 2025", fmt(sum(municipios, "primary_care_total_production_2025"))],
  ["Gasto em saúde per capita mediano", money(median(municipios.map(row => row.health_spending_per_capita)))],
  ["Leitos SUS por 10 mil habitantes (mediana)", fmt(median(municipios.map(row => row.sus_beds_per_10k)), 1)]
].map(([indicator, value]) => ({ indicator, value }));

write("data/municipios_rede_sus.csv", toCsv(municipios));
write("data/resumo_indicadores.csv", toCsv(resumo));
write("data/perfis_municipais.csv", toCsv(profiles));
copy(["11 - agrupamento-estrutura-gasto-desfechos-saude", "docs", "dashboard_map.geojson"], "data/ms_rede_sus.geojson");
copy(["11 - agrupamento-estrutura-gasto-desfechos-saude", "docs", "dashboard_map.geojson"], "docs/data/ms_rede_sus.geojson");

function mdTable(headers, rows) {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.join(" | ")} |`)].join("\n");
}
const resumoTable = mdTable(["Indicador", "Resultado"], resumo.map(row => [row.indicator, row.value]));
const profilesTable = mdTable(["Perfil", "Municípios", "Gasto per capita", "Leitos SUS/10 mil", "Síntese"], profiles.map(row => [row.cluster, fmt(n(row.municipalities)), money(n(row.health_spending_per_capita)), fmt(n(row.sus_beds_per_10k), 1), row.cluster_label]));
const topGasto = mdTable(["Município", "Gasto per capita", "Perfil"], top(municipios, "health_spending_per_capita", 8).map(row => [row.municipality_name, money(row.health_spending_per_capita), row.cluster_label]));
const topAmb = mdTable(["Município", "Valor ambulatorial per capita", "Quantidade aprovada"], top(municipios, "outpatient_value_per_capita_brl", 8).map(row => [row.municipality_name, money(row.outpatient_value_per_capita_brl), fmt(row.outpatient_approved_quantity)]));
const topAps = mdTable(["Município", "Produção APS por mil hab.", "Produção total"], top(municipios, "primary_care_production_per_1000", 8).map(row => [row.municipality_name, fmt(row.primary_care_production_per_1000, 1), fmt(row.primary_care_total_production_2025)]));

function barSvg(rows, field, title, file, format = value => fmt(value)) {
  const width = 980, height = 520, left = 260, topPad = 70, rowH = 42;
  const max = Math.max(...rows.map(row => Number(row[field]) || 0));
  const bars = rows.map((row, i) => {
    const y = topPad + i * rowH;
    const w = ((Number(row[field]) || 0) / max) * (width - left - 150);
    return `<text x="24" y="${y + 22}" font-size="15" fill="#1e2528">${row.municipality_name}</text><rect x="${left}" y="${y}" width="${w.toFixed(1)}" height="26" rx="4" fill="#1f8a5b"/><text x="${left + w + 8}" y="${y + 19}" font-size="14" fill="#364044">${format(Number(row[field]))}</text>`;
  }).join("\n");
  write(`figures/${file}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfcfa"/><text x="24" y="38" font-size="26" font-weight="700" font-family="Arial" fill="#1e2528">${title}</text><g font-family="Arial">${bars}</g></svg>`);
}

function mapSvg(metric, title, file, categorical = false) {
  const geo = JSON.parse(fs.readFileSync(dest("data/ms_rede_sus.geojson"), "utf8"));
  const width = 920, height = 620, pad = 24;
  const pts = [];
  for (const f of geo.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) for (const p of ring) pts.push(p);
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const project = ([x, y]) => [pad + (x - minX) / (maxX - minX) * (width - 2 * pad), height - pad - (y - minY) / (maxY - minY) * (height - 2 * pad)];
  const values = geo.features.map(f => n(f.properties?.[metric])).filter(Number.isFinite);
  const min = Math.min(...values), max = Math.max(...values);
  const palette = ["#d9efc2", "#9bd18c", "#4fa66c", "#277f62", "#15524d"];
  const clustersColor = { "Cluster 1": "#1f8a5b", "Cluster 2": "#b44a3f", "Cluster 3": "#256f9c", "Cluster 4": "#af7a20" };
  const color = f => {
    if (categorical) return clustersColor[f.properties?.[metric]] ?? "#d6ddd8";
    const value = n(f.properties?.[metric]);
    if (!Number.isFinite(value)) return "#d6ddd8";
    return palette[Math.min(4, Math.max(0, Math.floor((value - min) / ((max - min) || 1) * 5)))];
  };
  const paths = geo.features.map(f => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const d = polys.map(poly => poly.map(ring => ring.map((p, i) => { const [x, y] = project(p); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + " Z").join(" ")).join(" ");
    return `<path d="${d}" fill="${color(f)}" stroke="#fff" stroke-width="1"/>`;
  }).join("\n");
  const legend = categorical
    ? Object.entries(clustersColor).map(([label, fill], i) => `<rect x="${34 + i * 200}" y="575" width="18" height="18" fill="${fill}"/><text x="${58 + i * 200}" y="589" font-size="13">${label}</text>`).join("")
    : palette.map((fill, i) => `<rect x="${34 + i * 92}" y="575" width="86" height="18" fill="${fill}"/>`).join("") + `<text x="34" y="607" font-size="13">${fmt(min, 1)}</text><text x="390" y="607" font-size="13">${fmt(max, 1)}</text>`;
  write(`figures/${file}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfcfa"/><text x="24" y="38" font-size="25" font-weight="700" font-family="Arial" fill="#1e2528">${title}</text><g transform="translate(0,24) scale(1,.9)">${paths}</g><g font-family="Arial" fill="#364044">${legend}</g></svg>`);
}

mapSvg("cluster", "Perfis municipais integrados", "01_mapa_perfis_municipais.svg", true);
mapSvg("health_spending_per_capita", "Gasto em saúde per capita", "02_mapa_gasto_per_capita.svg");
mapSvg("sus_beds_per_10k", "Leitos SUS por 10 mil habitantes", "03_mapa_leitos_sus.svg");
mapSvg("approved_value_per_capita_brl", "Valor ambulatorial aprovado per capita", "04_mapa_producao_ambulatorial.svg");
barSvg(top(municipios, "health_spending_per_capita", 10), "health_spending_per_capita", "Maiores gastos em saúde per capita", "05_ranking_gasto_per_capita.svg", money);
barSvg(top(municipios, "primary_care_production_per_1000", 10), "primary_care_production_per_1000", "Maior produção APS por mil habitantes", "06_ranking_aps.svg", value => fmt(value, 1));

const intro = `Este repositório apresenta um projeto único de análise aplicada sobre rede assistencial, financiamento municipal e produção do SUS em Mato Grosso do Sul. A proposta não é empilhar estudos isolados, mas organizar cinco dimensões analíticas em uma sequência única: estrutura da rede, orçamento, atenção primária, produção ambulatorial e perfis municipais integrados.`;

write("README.md", `# Rede, Financiamento e Produção SUS · Mato Grosso do Sul

[![Dashboard](https://img.shields.io/badge/Dashboard-Interativo-1a6b3c?style=for-the-badge&logo=html5&logoColor=white)](docs/rede_sus_dashboard.html)
[![Relatório](https://img.shields.io/badge/Relatório-PDF-blue?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](rede_financiamento_producao_sus.pdf)

${intro}

---

## Motivação

Bases públicas de saúde costumam ser consultadas separadamente. CNES mostra capacidade instalada; SIOPS mostra financiamento; SISAB e SIA/SUS mostram produção; a análise de agrupamentos mostra perfis municipais. Separadas, essas bases explicam pouco. Integradas, elas permitem uma leitura profissional sobre oferta, gasto, escala, dependência territorial e prioridades de investigação.

---

## Pergunta de análise

**Como estrutura assistencial, financiamento e produção do SUS se distribuem entre os municípios de Mato Grosso do Sul, e quais perfis territoriais aparecem quando essas dimensões são analisadas em conjunto?**

---

## Dados e métodos

| Dimensão | Fonte analítica | Papel no estudo |
|---|---|---|
| Rede assistencial | CNES | Estabelecimentos, leitos SUS, equipamentos e vínculo SUS |
| Financiamento | SIOPS | Gasto per capita, composição do gasto e aplicação de recursos próprios |
| Atenção primária | SISAB | Produção municipal de APS em 2025 |
| Produção ambulatorial | SIA/SUS | Quantidade e valor aprovado em 2024 |
| Perfil integrado | Matriz municipal consolidada | Agrupamentos exploratórios e análise geoespacial |

O fluxo analítico segue a ordem: padronização municipal, consolidação das fontes, indicadores per capita, análise descritiva, análise exploratória, agrupamento municipal e mapas coropléticos.

---

## Resultados descritivos

${resumoTable}

---

## Perfis municipais

${profilesTable}

---

## Mostras visuais

![Perfis municipais](figures/01_mapa_perfis_municipais.svg)

![Gasto per capita](figures/02_mapa_gasto_per_capita.svg)

![Leitos SUS](figures/03_mapa_leitos_sus.svg)

![Produção ambulatorial](figures/04_mapa_producao_ambulatorial.svg)

---

## Dashboard interativo

> [**Abrir dashboard**](docs/rede_sus_dashboard.html) — mapa municipal com seleção de indicadores, resumo executivo e links para dados finais.

---

## Estrutura

\`\`\`
saude-rede-financiamento-producao-sus/
├── R/code.R                                → funções auxiliares da análise
├── scripts/build_project.mjs               → reconstrói dados, figuras, Rmd, dashboard e PDF
├── data/                                   → bases finais consolidadas
├── figures/                                → mapas e rankings do estudo
├── docs/rede_sus_dashboard.html            → dashboard interativo
├── rede_financiamento_producao_sus.Rmd     → relatório-fonte
├── rede_financiamento_producao_sus.pdf     → relatório final
└── README.md
\`\`\`

---

## Como reproduzir

\`\`\`bash
node scripts/build_project.mjs
pandoc rede_financiamento_producao_sus.Rmd --standalone --toc -o docs/relatorio.html
\`\`\`

A renderização do PDF foi feita a partir do HTML com Microsoft Edge em modo headless.

---

## Limitações

A análise é exploratória. Os indicadores administrativos podem sofrer atraso, revisão e diferenças de cobertura. Mapas e rankings ajudam a formular hipóteses e priorizar investigação, mas não substituem validação institucional, auditoria documental ou avaliação de política pública.
`);

write("R/code.R", `# Funções auxiliares — Rede, Financiamento e Produção SUS

carregar_municipios <- function(path = "data/municipios_rede_sus.csv") {
  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8")
}

resumo_indicadores <- function(path = "data/resumo_indicadores.csv") {
  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8")
}

perfil_por_cluster <- function(path = "data/perfis_municipais.csv") {
  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8")
}

ranking <- function(dados, variavel, n = 10) {
  dados[order(dados[[variavel]], decreasing = TRUE), ][seq_len(min(n, nrow(dados))), ]
}
`);

write("rede_financiamento_producao_sus.Rmd", `---
title: "Rede, Financiamento e Produção SUS em Mato Grosso do Sul"
author: "Matheus Assis de Oliveira"
date: "2026-07-02"
output:
  html_document:
    toc: true
    toc_float: true
    number_sections: true
    theme: flatly
    highlight: tango
    code_folding: hide
---

# Introdução

${intro}

A pergunta central é: **como estrutura assistencial, financiamento e produção do SUS se distribuem entre os municípios, e quais perfis territoriais aparecem quando essas dimensões são analisadas em conjunto?**

# Motivação

A análise isolada de bases públicas cria uma leitura fragmentada. Um município pode ter alta despesa per capita por escala populacional, produção ambulatorial concentrada por papel regional, ou estrutura física proporcionalmente elevada sem ser um polo populacional. A integração permite observar essas relações em uma linguagem útil para gestão, auditoria exploratória e portfólio profissional de análise de dados.

# Dados

Foram integradas cinco dimensões: CNES, SIOPS, SISAB, SIA/SUS e matriz municipal de agrupamento. Todas foram reduzidas à unidade municipal para permitir comparação, cálculo de taxas e leitura geoespacial.

# Métodos

1. Padronização dos códigos municipais.
2. Consolidação das bases por município.
3. Cálculo de indicadores por habitante e por 10 mil habitantes.
4. Estatística descritiva estadual.
5. Rankings exploratórios.
6. Agrupamento municipal por estrutura, gasto e indicadores de contexto.
7. Mapas coropléticos para leitura territorial.
8. Dashboard interativo para comunicação dos resultados.

# Resultados descritivos

${resumoTable}

# Análise exploratória

## Perfis municipais integrados

${profilesTable}

Os agrupamentos organizam os municípios em perfis úteis para leitura profissional: municípios pequenos com capacidade local elevada, perfis de maior gasto e alerta, polos regionais de rede mais densa e municípios com menor densidade estrutural.

## Maiores gastos per capita

${topGasto}

## Maiores valores ambulatoriais per capita

${topAmb}

## Maiores produções de APS por mil habitantes

${topAps}

# Análise geoespacial

A análise geoespacial mostra a distribuição dos indicadores no território. A interpretação é exploratória: mapas ajudam a localizar padrões, contrastes e hipóteses de investigação.

![Perfis municipais integrados](figures/01_mapa_perfis_municipais.svg)

![Gasto em saúde per capita](figures/02_mapa_gasto_per_capita.svg)

![Leitos SUS por 10 mil habitantes](figures/03_mapa_leitos_sus.svg)

![Valor ambulatorial aprovado per capita](figures/04_mapa_producao_ambulatorial.svg)

# Dashboard interativo

O dashboard em \`docs/rede_sus_dashboard.html\` facilita a leitura por município, indicador e perfil. Ele foi pensado para avaliação profissional rápida: mapa, indicadores executivos, ranking e acesso às bases finais.

# Resultados gerados

- \`data/municipios_rede_sus.csv\`: base municipal consolidada.
- \`data/resumo_indicadores.csv\`: indicadores executivos.
- \`data/perfis_municipais.csv\`: síntese dos clusters.
- \`figures/\`: mapas e rankings.
- \`docs/rede_sus_dashboard.html\`: painel interativo.

# Limitações

Os dados são administrativos e podem ter atraso, revisão e diferenças de cobertura. Indicadores per capita podem supervalorizar municípios pequenos. Mapas e clusters apontam padrões, mas não explicam causalidade. A leitura final precisa considerar escala populacional, papel regional dos serviços e validação institucional.
`);

const cards = resumo.map(row => `<div class="metric"><strong>${row.value}</strong><span>${row.indicator}</span></div>`).join("\n");
const rows = profiles.map(row => `<tr><td>${row.cluster}</td><td>${fmt(n(row.municipalities))}</td><td>${money(n(row.health_spending_per_capita))}</td><td>${fmt(n(row.sus_beds_per_10k), 1)}</td><td>${row.cluster_label}</td></tr>`).join("\n");
write("docs/rede_sus_dashboard.html", `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rede, Financiamento e Produção SUS</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    :root { --bg:#f7f8f5; --panel:#fff; --ink:#1e2528; --muted:#657174; --line:#dce2dd; --green:#1f8a5b; --blue:#256f9c; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter, "Segoe UI", Arial, sans-serif; line-height:1.45; }
    header, main, footer { width:min(1180px, calc(100% - 32px)); margin:0 auto; }
    header { padding:28px 0 18px; display:grid; gap:12px; }
    h1 { margin:0; font-size:clamp(30px, 4vw, 54px); line-height:1.04; letter-spacing:0; }
    h2 { margin:0 0 12px; font-size:22px; letter-spacing:0; }
    h3 { margin:0 0 8px; font-size:17px; letter-spacing:0; }
    p { margin:0; color:var(--muted); }
    a { color:var(--blue); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .lede { max-width:820px; font-size:17px; }
    .metrics { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:10px; }
    .metric, .panel, .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .metric { padding:12px; min-height:82px; }
    .metric strong { display:block; color:var(--green); font-size:23px; line-height:1.08; overflow-wrap:anywhere; }
    .metric span { display:block; margin-top:8px; color:var(--muted); font-size:12px; }
    section { margin:24px 0; }
    .layout { display:grid; grid-template-columns:330px 1fr; gap:14px; }
    .panel { padding:16px; }
    #map { height:620px; border:1px solid var(--line); border-radius:8px; background:#e8eee9; }
    select { width:100%; min-height:38px; border:1px solid var(--line); border-radius:8px; padding:8px; background:#fff; font:inherit; margin-bottom:8px; }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th, td { padding:10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; font-size:14px; }
    th { background:#eef3ef; }
    .links { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .links a { border:1px solid var(--line); border-radius:8px; padding:7px 10px; background:#fff; font-size:14px; }
    footer { color:var(--muted); font-size:13px; padding:8px 0 30px; }
    @media (max-width:900px) { .layout, .metrics { grid-template-columns:1fr; } #map { height:480px; } }
  </style>
</head>
<body>
  <header>
    <h1>Rede, Financiamento e Produção SUS</h1>
    <p class="lede">Projeto único de análise aplicada sobre estrutura assistencial, financiamento e produção do SUS nos 79 municípios de Mato Grosso do Sul.</p>
    <div class="metrics">${cards}</div>
  </header>
  <main>
    <section class="layout">
      <aside class="panel">
        <h2>Mapa municipal</h2>
        <select id="metric"></select>
        <p id="status">Carregando mapa...</p>
        <div class="links">
          <a href="../rede_financiamento_producao_sus.pdf">PDF</a>
          <a href="../rede_financiamento_producao_sus.Rmd">Rmd</a>
          <a href="../data/municipios_rede_sus.csv">Dados</a>
        </div>
      </aside>
      <div id="map"></div>
    </section>
    <section>
      <h2>Perfis municipais</h2>
      <table><thead><tr><th>Perfil</th><th>Municípios</th><th>Gasto per capita</th><th>Leitos SUS/10 mil</th><th>Síntese</th></tr></thead><tbody>${rows}</tbody></table>
    </section>
  </main>
  <footer>Análise exploratória com bases públicas. Mapas e rankings apoiam leitura profissional; não substituem validação institucional.</footer>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const metrics = [
      ["cluster", "Perfil municipal"],
      ["health_spending_per_capita", "Gasto per capita"],
      ["sus_beds_per_10k", "Leitos SUS/10 mil"],
      ["facilities_per_10k", "Estabelecimentos/10 mil"],
      ["equipment_per_10k", "Equipamentos/10 mil"],
      ["approved_value_per_capita_brl", "Valor ambulatorial per capita"]
    ];
    const sel = document.querySelector("#metric");
    const status = document.querySelector("#status");
    sel.innerHTML = metrics.map(([id, label]) => '<option value="' + id + '">' + label + '</option>').join('');
    const map = L.map("map", { scrollWheelZoom:false }).setView([-20.6, -54.6], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:18, attribution:"&copy; OpenStreetMap" }).addTo(map);
    let layer;
    sel.addEventListener("change", draw);
    draw();
    function f(value) { return Number.isFinite(value) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits:value > 100 ? 0 : 2 }).format(value) : "sem dado"; }
    function color(raw, min, max) {
      const cluster = { "Cluster 1":"#1f8a5b", "Cluster 2":"#b44a3f", "Cluster 3":"#256f9c", "Cluster 4":"#af7a20" };
      if (cluster[raw]) return cluster[raw];
      const value = Number(raw);
      if (!Number.isFinite(value)) return "#d6ddd8";
      const t = Math.max(0, Math.min(1, (value - min) / ((max - min) || 1)));
      return ["#d9efc2", "#9bd18c", "#4fa66c", "#277f62", "#15524d"][Math.min(4, Math.floor(t * 5))];
    }
    async function draw() {
      const metric = sel.value || metrics[0][0];
      const label = metrics.find(([id]) => id === metric)?.[1] || metric;
      const data = await fetch("data/ms_rede_sus.geojson").then(r => r.json());
      const vals = data.features.map(feat => Number(feat.properties?.[metric])).filter(Number.isFinite);
      const min = Math.min(...vals), max = Math.max(...vals);
      if (layer) layer.remove();
      layer = L.geoJSON(data, {
        style: feat => ({ fillColor:color(feat.properties?.[metric], min, max), fillOpacity:.82, color:"#fff", weight:.8 }),
        onEachFeature: (feat, item) => {
          const p = feat.properties || {};
          const raw = p[metric];
          item.bindPopup("<strong>" + (p.municipality_name || "Município") + "</strong><br>" + label + ": " + (Number.isFinite(Number(raw)) ? f(Number(raw)) : raw));
        }
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding:[18,18] });
      status.textContent = data.features.length + " municípios — " + label + ".";
    }
  </script>
</body>
</html>`);

write(".gitignore", `.Rhistory
.RData
.Rproj.user/
.DS_Store
Thumbs.db
`);
write("rede-sus.Rproj", `Version: 1.0

RestoreWorkspace: Default
SaveWorkspace: Default
AlwaysSaveHistory: Default

EnableCodeIndexing: Yes
UseSpacesForTab: Yes
NumSpacesForTab: 2
Encoding: UTF-8

RnwWeave: knitr
LaTeX: pdfLaTeX
`);
console.log("project rebuilt from source analyses");
