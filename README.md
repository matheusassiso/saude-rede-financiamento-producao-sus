# Rede, Financiamento e Produção SUS · Mato Grosso do Sul

[![Dashboard](https://img.shields.io/badge/Dashboard-Interativo-1a6b3c?style=for-the-badge&logo=html5&logoColor=white)](docs/rede_sus_dashboard.html)
[![Relatório](https://img.shields.io/badge/Relatório-PDF-blue?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](rede_financiamento_producao_sus.pdf)

Projeto **R** de análise aplicada sobre estrutura assistencial, financiamento municipal e produção do SUS nos 79 municípios de Mato Grosso do Sul.

---

## Motivação

Bases públicas de saúde costumam ser consultadas separadamente. CNES mostra capacidade instalada; SIOPS mostra financiamento; SISAB e SIA/SUS mostram produção; a análise de agrupamentos mostra perfis municipais. Separadas, essas bases explicam pouco. Integradas, elas permitem uma leitura profissional sobre oferta, gasto, escala, dependência territorial e prioridades de investigação.

---

## Pergunta de análise

**Como estrutura assistencial, financiamento e produção do SUS se distribuem entre os municípios de Mato Grosso do Sul, e quais perfis territoriais aparecem quando essas dimensões são analisadas em conjunto?**

---

## Estrutura

```text
saude-rede-financiamento-producao-sus/
├── R/code.R
├── scripts/build_project.R
├── data/
├── figures/
├── docs/rede_sus_dashboard.html
├── docs/relatorio.html
├── rede_financiamento_producao_sus.Rmd
├── rede_financiamento_producao_sus.pdf
└── rede-sus.Rproj
```

---

## Como reproduzir

Abra `rede-sus.Rproj` no RStudio e rode:

```r
source("scripts/build_project.R")
```

O script reconstrói:

- bases consolidadas em `data/`;
- mapas e rankings em `figures/`;
- dashboard em `docs/rede_sus_dashboard.html`;
- relatório HTML em `docs/relatorio.html`;
- PDF em `rede_financiamento_producao_sus.pdf`.

---

## Resultados

| Entregável | Arquivo |
|---|---|
| Relatório-fonte | `rede_financiamento_producao_sus.Rmd` |
| Relatório final | `rede_financiamento_producao_sus.pdf` |
| Dashboard | `docs/rede_sus_dashboard.html` |
| Base municipal | `data/municipios_rede_sus.csv` |
| Perfis municipais | `data/perfis_municipais.csv` |
| Figuras | `figures/` |

---

## Observação sobre linguagem do GitHub

HTML, GeoJSON, CSV, PNG e PDF são artefatos gerados e foram marcados em `.gitattributes` como `linguist-generated=true`. O repositório deve aparecer como projeto R/RMarkdown, não como projeto HTML.

---

## Limitações

A análise é exploratória. Os indicadores administrativos podem sofrer atraso, revisão e diferenças de cobertura. Mapas e rankings ajudam a formular hipóteses e priorizar investigação, mas não substituem validação institucional, auditoria documental ou avaliação de política pública.
