source("R/code.R")

dir.create("figures", showWarnings = FALSE)
dir.create("docs", showWarnings = FALSE)
dir.create("docs/data", recursive = TRUE, showWarnings = FALSE)

stopifnot(requireNamespace("jsonlite", quietly = TRUE))
stopifnot(requireNamespace("rmarkdown", quietly = TRUE))
stopifnot(requireNamespace("knitr", quietly = TRUE))

`%||%` <- function(a, b) if (!is.null(a)) a else b

municipios <- read_project_csv("data/municipios_rede_sus.csv")
resumo <- read_project_csv("data/resumo_indicadores.csv")
perfis <- read_project_csv("data/perfis_municipais.csv")

geo <- jsonlite::fromJSON("data/ms_rede_sus.geojson", simplifyVector = FALSE)
municipios_by_code <- setNames(seq_len(nrow(municipios)), municipios$municipality_code)

for (i in seq_along(geo$features)) {
  props <- geo$features[[i]]$properties
  code <- as.character(props$municipality_code %||% props$municipality_code_ibge %||% props$provider_municipality_code)
  idx <- municipios_by_code[[code]]
  if (!is.null(idx) && !is.na(idx)) {
    row <- municipios[idx, ]
    for (nm in names(row)) geo$features[[i]]$properties[[nm]] <- row[[nm]]
  }
}

jsonlite::write_json(geo, "data/ms_rede_sus.geojson", auto_unbox = TRUE, digits = 12)
jsonlite::write_json(geo, "docs/data/ms_rede_sus.geojson", auto_unbox = TRUE, digits = 12)

extract_polygons <- function(feature) {
  geom <- feature$geometry
  if (geom$type == "Polygon") return(list(geom$coordinates))
  geom$coordinates
}

all_points <- function(geo) {
  pts <- do.call(rbind, lapply(geo$features, function(feature) {
    polys <- extract_polygons(feature)
    do.call(rbind, lapply(polys, function(poly) do.call(rbind, lapply(poly, function(ring) do.call(rbind, ring)))))
  }))
  data.frame(x = as.numeric(pts[, 1]), y = as.numeric(pts[, 2]))
}

plot_map <- function(metric, title, file, categorical = FALSE) {
  pts <- all_points(geo)
  png(file.path("figures", file), width = 1400, height = 950, res = 150, bg = "white")
  par(mar = c(0.5, 0.5, 3.5, 0.5))
  plot(NA, xlim = range(pts$x), ylim = range(pts$y), asp = 1, axes = FALSE, xlab = "", ylab = "", main = title, cex.main = 1.3)

  values <- vapply(geo$features, function(feature) as.character(feature$properties[[metric]] %||% NA), character(1))
  if (categorical) {
    colors <- c("Cluster 1" = "#1f8a5b", "Cluster 2" = "#b44a3f", "Cluster 3" = "#256f9c", "Cluster 4" = "#af7a20")
    fill <- unname(colors[values])
    fill[is.na(fill)] <- "#d6ddd8"
  } else {
    fill <- metric_palette(as.numeric(values))
  }

  for (i in seq_along(geo$features)) {
    for (poly in extract_polygons(geo$features[[i]])) {
      for (ring in poly) {
        ring <- do.call(rbind, ring)
        ring <- cbind(as.numeric(ring[, 1]), as.numeric(ring[, 2]))
        polygon(ring[, 1], ring[, 2], col = fill[i], border = "white", lwd = 0.6)
      }
    }
  }

  if (categorical) {
    legend("bottomleft", legend = names(colors), fill = colors, bty = "n", cex = 0.85)
  } else {
    legend("bottomleft", legend = c("menor", "", "", "", "maior"), fill = c("#d9efc2", "#9bd18c", "#4fa66c", "#277f62", "#15524d"), bty = "n", horiz = TRUE, cex = 0.8)
  }
  dev.off()
}

plot_bar <- function(data, metric, title, file, formatter = fmt_num) {
  d <- top_n(data, metric, 10)
  png(file.path("figures", file), width = 1400, height = 900, res = 150, bg = "white")
  par(mar = c(5, 12, 4, 2))
  values <- d[[metric]]
  labels <- safe_name(d$municipality_name)
  barplot(rev(values), horiz = TRUE, names.arg = rev(labels), las = 1, col = "#1f8a5b", border = NA, main = title, xlab = "")
  text(rev(values), seq_along(values), labels = rev(formatter(values)), pos = 4, cex = 0.75)
  dev.off()
}

plot_map("cluster", "Perfis municipais integrados", "01_mapa_perfis_municipais.png", categorical = TRUE)
plot_map("health_spending_per_capita", "Gasto em saude per capita", "02_mapa_gasto_per_capita.png")
plot_map("sus_beds_per_10k", "Leitos SUS por 10 mil habitantes", "03_mapa_leitos_sus.png")
plot_map("outpatient_value_per_capita_brl", "Valor ambulatorial aprovado per capita", "04_mapa_producao_ambulatorial.png")
plot_bar(municipios, "health_spending_per_capita", "Maiores gastos em saude per capita", "05_ranking_gasto_per_capita.png", fmt_money)
plot_bar(municipios, "primary_care_production_per_1000", "Maior producao APS por mil habitantes", "06_ranking_aps.png", function(x) fmt_num(x, 1))

dashboard <- paste0('<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rede, Financiamento e Producao SUS</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    :root{--bg:#f7f8f5;--panel:#fff;--ink:#1e2528;--muted:#657174;--line:#dce2dd;--green:#1f8a5b;--blue:#256f9c}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,"Segoe UI",Arial,sans-serif;line-height:1.45}
    header,main,footer{width:min(1180px,calc(100% - 32px));margin:0 auto} header{padding:28px 0 18px;display:grid;gap:12px}
    h1{margin:0;font-size:clamp(30px,4vw,54px);line-height:1.04;letter-spacing:0} h2{margin:0 0 12px;font-size:22px} p{margin:0;color:var(--muted)}
    a{color:var(--blue);text-decoration:none}.lede{max-width:820px;font-size:17px}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .metric,.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px}.metric{padding:12px;min-height:82px}.metric strong{display:block;color:var(--green);font-size:23px;line-height:1.08;overflow-wrap:anywhere}.metric span{display:block;margin-top:8px;color:var(--muted);font-size:12px}
    section{margin:24px 0}.layout{display:grid;grid-template-columns:330px 1fr;gap:14px}.panel{padding:16px}#map{height:620px;border:1px solid var(--line);border-radius:8px;background:#e8eee9}
    select{width:100%;min-height:38px;border:1px solid var(--line);border-radius:8px;padding:8px;background:#fff;font:inherit;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:14px}th{background:#eef3ef}
    .links{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.links a{border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:#fff;font-size:14px}footer{color:var(--muted);font-size:13px;padding:8px 0 30px}
    @media(max-width:900px){.layout,.metrics{grid-template-columns:1fr}#map{height:480px}}
  </style>
</head>
<body>
  <header><h1>Rede, Financiamento e Producao SUS</h1><p class="lede">Projeto R de analise aplicada sobre estrutura assistencial, financiamento e producao do SUS nos 79 municipios de Mato Grosso do Sul.</p><div class="metrics">',
  paste(sprintf('<div class="metric"><strong>%s</strong><span>%s</span></div>', resumo$value, resumo$indicator), collapse = ""),
  '</div></header>
  <main><section class="layout"><aside class="panel"><h2>Mapa municipal</h2><select id="metric"></select><p id="status">Carregando mapa...</p><div class="links"><a href="../rede_financiamento_producao_sus.pdf">PDF</a><a href="../rede_financiamento_producao_sus.Rmd">Rmd</a><a href="../data/municipios_rede_sus.csv">Dados</a></div></aside><div id="map"></div></section>
  <section><h2>Perfis municipais</h2><table><thead><tr><th>Perfil</th><th>Municipios</th><th>Gasto per capita</th><th>Leitos SUS/10 mil</th><th>Sintese</th></tr></thead><tbody>',
  paste(sprintf("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>", perfis$cluster, fmt_num(perfis$municipalities), fmt_money(perfis$health_spending_per_capita), fmt_num(perfis$sus_beds_per_10k, 1), perfis$cluster_label), collapse = ""),
  '</tbody></table></section></main><footer>Analise exploratoria com bases publicas. Mapas e rankings apoiam leitura profissional; nao substituem validacao institucional.</footer>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const metrics=[["cluster","Perfil municipal"],["health_spending_per_capita","Gasto per capita"],["sus_beds_per_10k","Leitos SUS/10 mil"],["facilities_per_10k","Estabelecimentos/10 mil"],["equipment_per_10k","Equipamentos/10 mil"],["outpatient_value_per_capita_brl","Valor ambulatorial per capita"]];
    const sel=document.querySelector("#metric"),status=document.querySelector("#status"); sel.innerHTML=metrics.map(([id,label])=>`<option value="${id}">${label}</option>`).join("");
    const map=L.map("map",{scrollWheelZoom:false}).setView([-20.6,-54.6],6); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap"}).addTo(map); let layer; sel.addEventListener("change",draw); draw();
    function f(value){return Number.isFinite(value)?new Intl.NumberFormat("pt-BR",{maximumFractionDigits:value>100?0:2}).format(value):"sem dado"}
    function color(raw,min,max){const cluster={"Cluster 1":"#1f8a5b","Cluster 2":"#b44a3f","Cluster 3":"#256f9c","Cluster 4":"#af7a20"}; if(cluster[raw])return cluster[raw]; const value=Number(raw); if(!Number.isFinite(value))return "#d6ddd8"; const t=Math.max(0,Math.min(1,(value-min)/((max-min)||1))); return ["#d9efc2","#9bd18c","#4fa66c","#277f62","#15524d"][Math.min(4,Math.floor(t*5))]}
    async function draw(){const metric=sel.value||metrics[0][0],label=metrics.find(([id])=>id===metric)?.[1]||metric,data=await fetch("data/ms_rede_sus.geojson").then(r=>r.json()),vals=data.features.map(feat=>Number(feat.properties?.[metric])).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals); if(layer)layer.remove(); layer=L.geoJSON(data,{style:feat=>({fillColor:color(feat.properties?.[metric],min,max),fillOpacity:.82,color:"#fff",weight:.8}),onEachFeature:(feat,item)=>{const p=feat.properties||{},raw=p[metric]; item.bindPopup("<strong>"+(p.municipality_name||"Municipio")+"</strong><br>"+label+": "+(Number.isFinite(Number(raw))?f(Number(raw)):raw))}}).addTo(map); map.fitBounds(layer.getBounds(),{padding:[18,18]}); status.textContent=data.features.length+" municipios — "+label+"."}
  </script></body></html>')

writeLines(dashboard, "docs/rede_sus_dashboard.html", useBytes = TRUE)

rmarkdown::render("rede_financiamento_producao_sus.Rmd", output_format = "html_document", output_file = "relatorio.html", output_dir = "docs", quiet = TRUE)

edge <- "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
if (file.exists(edge)) {
  html <- normalizePath("docs/relatorio.html", winslash = "/")
  pdf <- normalizePath(".", winslash = "/", mustWork = TRUE)
  pdf <- file.path(pdf, "rede_financiamento_producao_sus.pdf")
  system2(edge, c("--headless", "--disable-gpu", paste0("--print-to-pdf=", shQuote(pdf)), paste0("file:///", html)), stdout = FALSE, stderr = FALSE)
}

message("Projeto R reconstruido com sucesso.")
