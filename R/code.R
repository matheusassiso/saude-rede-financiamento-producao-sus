# Funções auxiliares — Rede, Financiamento e Produção SUS

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
