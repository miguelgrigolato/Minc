# Teste da sincronização na nuvem (pastas por processo)

Simula o Supabase no navegador (`mock-supabase.js`) e confere, com dois aparelhos:
fotos/anexos só sobem com Processo, Pedido, Equipamento e Cliente preenchidos; caminhos `<pasta>/fotos`,
`<pasta>/anexos` e `<pasta>/documentos`; download no outro aparelho (inclusive fotos antigas em `<id>/`);
exclusão apagando os dois caminhos; limites de tamanho do banco (migração 009): um processo acima do limite
fica pendente sem travar os outros, e valor com mais de 200 caracteres volta inteiro para o outro aparelho.

```
python3 tests/pior-caso/servir.py 8790 &          # serve o app (qualquer servidor estático serve)
npm i playwright                                    # uma vez
URL=http://localhost:8790/public/index.html node tests/nuvem.test.js
```
