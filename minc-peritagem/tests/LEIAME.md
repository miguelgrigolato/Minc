# Teste da sincronização na nuvem (pastas por processo)

Simula o Supabase no navegador (`mock-supabase.js`) e confere, com dois aparelhos:
fotos/anexos só sobem com Processo, Pedido, Equipamento e Cliente preenchidos; caminhos `<pasta>/fotos`,
`<pasta>/anexos` e `<pasta>/documentos`; download no outro aparelho (inclusive fotos antigas em `<id>/`);
exclusão apagando os dois caminhos.

```
cd public && python3 -m http.server 8765 &
npm i playwright   # uma vez
node ../tests/nuvem.test.js
```
