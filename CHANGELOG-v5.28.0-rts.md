# ServiceHub v5.28.0 — RTS

- Removidos os seletores "Formato do título de cada POS" (título sempre "POS. 02 - CORPO – RECUPERAR.") e "Padrão de pintura".
- Ao marcar a providência (Recuperar, Reutilizar, Substituir, Adequar, Fabricar) NADA entra sozinho: abre um **balão flutuante** com as atividades sugeridas, em grupos (da providência marcada + soldagem/usinagem, preparação/pintura, retrofit), com caixas para marcar e filtro. Botão "Escolher atividades" reabre o balão. No celular vira folha na parte de baixo.
- Numeração das atividades reinicia em 1 em cada bloco (conjunto geral, cada POS, montagem), na tela e no PDF.
- Caixa de texto visível em cada POS (aparece como NOTA depois das atividades).
- **Importar laudo do cliente (PDF)**: lê o laudo (itens, componentes com providência/quantidade/atividades, observações gerais, dados do equipamento) e cria as POS e observações no RTS; PDF de instruções vira observação; PDF escaneado (desenho) vira anexo de imagem. Opção de trocar as observações padrão da MINC pelas do laudo quando é o mesmo assunto.
- Novo: laudo.js (leitor/analisador) e vendor/pdfjs (pdf.js 3.11.174, Apache-2.0), carregado só quando o botão é usado.
Arquivos: rts.js, laudo.js, modulos.css, index.html, service-worker.js, app.js (versão), vendor/pdfjs/*.
