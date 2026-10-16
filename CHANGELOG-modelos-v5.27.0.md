# ServiceHub v5.27.0 — Modelos de válvula (projetos)

- Cada componente do modelo agora guarda: POS, nome, código Nomus, nº do desenho, material, quantidade, unidade, **subcomponente (pai)**, matéria-prima e serviços.
- Modelo guarda também código Nomus do produto e desenho geral.
- Editor (Administração > Modelos de válvula): segunda linha por componente (código, desenho, material, "Subcomponente de"), recuo por nível.
- **Importar planilha (.xlsx)** e **Baixar planilha modelo** (abas Modelo, Componentes, Matéria-prima, Serviços).
- "Novo processo" a partir do modelo carrega a árvore completa (subcomponentes, desenho, código, matéria-prima e serviços na Estrutura).
- Compatível com modelos antigos (só POS/nome/qtd/un).
Arquivos alterados: modelos.js, modulos.css, app.js (versão), service-worker.js (versão).
