export const CITIES = [
  "Rio Branco, AC", "Maceió, AL", "Macapá, AP", "Manaus, AM", "Salvador, BA", "Feira de Santana, BA", "Fortaleza, CE",
  "Brasília, DF", "Vitória, ES", "Vila Velha, ES", "Goiânia, GO", "Anápolis, GO", "São Luís, MA", "Cuiabá, MT",
  "Campo Grande, MS", "Belo Horizonte, MG", "Uberlândia, MG", "Juiz de Fora, MG", "Belém, PA", "João Pessoa, PB",
  "Curitiba, PR", "Londrina, PR", "Maringá, PR", "Recife, PE", "Caruaru, PE", "Teresina, PI", "Rio de Janeiro, RJ",
  "Niterói, RJ", "Natal, RN", "Porto Alegre, RS", "Caxias do Sul, RS", "Porto Velho, RO", "Boa Vista, RR",
  "Florianópolis, SC", "Joinville, SC", "Blumenau, SC", "São Paulo, SP", "Campinas, SP", "Ribeirão Preto, SP",
  "Sorocaba, SP", "Santos, SP", "São José dos Campos, SP", "Aracaju, SE", "Palmas, TO",
];
export const STATES = [...new Set(CITIES.map((c) => c.split(", ")[1]!))].sort();
