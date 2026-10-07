# Ordenação automática por status (SETEMBRO a DEZEMBRO)

Ordem resultante em cada aba: **PAGO** (topo) → **PARCIALMENTE PAGO** (meio) → **NÃO PAGO** (fim).
Linhas vazias ficam no final, antes da linha de total. A ordem atual é mantida dentro de cada grupo.
Uma linha com fornecedor mas **sem valor total** fica no grupo NÃO PAGO até o valor ser preenchido.

## Instalação (Excel desktop, uma vez só)

1. Abra a planilha no Excel e salve uma cópia como **Pasta de Trabalho Habilitada para Macro (.xlsm)**.
2. Pressione `Alt + F11` para abrir o editor do VBA.
3. Menu **Arquivo > Importar arquivo...** e escolha `modOrdenacao.bas`.
4. No painel esquerdo, dê duplo clique em **EstaPasta_de_trabalho** (ThisWorkbook) e cole todo o
   conteúdo de `ThisWorkbook.cls.txt`.
5. Salve e feche. Ao reabrir, clique em **Habilitar conteúdo** (macros).

Pronto: ao abrir o arquivo e a cada vez que um status mudar (ex.: novo pagamento lançado em
LANÇAMENTOS), as quatro abas se reorganizam sozinhas. Para forçar manualmente: `Alt + F8` > `OrdenarTodasAsAbas`.

## Observações

- Funciona só no Excel desktop (Windows/Mac). Não roda no Google Planilhas nem no Excel online.
- Cada reordenação limpa o histórico de "Desfazer" (Ctrl+Z) do Excel.
- A macro usa temporariamente a coluna AD das abas e a limpa ao final.
- Cabeçalho considerado: linha 4 (SETEMBRO/OUTUBRO) e linha 2 (NOVEMBRO/DEZEMBRO). Se mudar o layout, ajuste `LinhaCabecalho` em `modOrdenacao.bas`.
