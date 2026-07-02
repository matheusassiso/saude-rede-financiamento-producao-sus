# Funcoes auxiliares do projeto Rede, Financiamento e Producao SUS

read_project_csv <- function(path) {
  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8", check.names = FALSE)
}

fmt_num <- function(x, digits = 0) {
  format(round(as.numeric(x), digits), big.mark = ".", decimal.mark = ",", scientific = FALSE, trim = TRUE)
}

fmt_money <- function(x, digits = 0) {
  paste0("R$ ", fmt_num(x, digits))
}

top_n <- function(data, var, n = 10) {
  data[order(data[[var]], decreasing = TRUE), ][seq_len(min(n, nrow(data))), ]
}

safe_name <- function(x) {
  iconv(x, from = "", to = "ASCII//TRANSLIT")
}

metric_palette <- function(values, palette = c("#d9efc2", "#9bd18c", "#4fa66c", "#277f62", "#15524d")) {
  values <- as.numeric(values)
  if (all(is.na(values))) return(rep("#d6ddd8", length(values)))
  bins <- cut(values, breaks = unique(quantile(values, probs = seq(0, 1, length.out = length(palette) + 1), na.rm = TRUE)), include.lowest = TRUE)
  palette[as.integer(bins)]
}
