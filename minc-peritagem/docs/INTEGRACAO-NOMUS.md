# Integração com o Nomus: o que falta para começar

Documento de apoio para conversar com a TI e com o suporte do Nomus. A aba **Estrutura** do app (v5.3.0) já está pronta para receber os dados; falta o acesso à API.

## 1. O que se sabe e o que não se sabe

| Assunto | Situação | Fonte |
|---|---|---|
| O Nomus tem API e roda 100% na nuvem | **Informado** | Miguel |
| O código do item (ex.: `03.022-006701`) é gerado pelo Nomus | **Informado** | Miguel |
| O Nomus é um ERP industrial com módulo Engenharia > Produtos e Lista de Materiais (BOM) | **Confirmado** em material público do fabricante | Pesquisa |
| Endpoints, autenticação, campos e limites da API | **Não verificado.** Não há documentação pública acessível | Precisa vir do Nomus |
| Prefixos do código indicam o tipo (`03.022` componente, `01.09` matéria-prima, `09.1` serviço) | **Hipótese**, baseada só no print enviado | Confirmar com o cadastro |

## 2. O que pedir ao Nomus / TI (checklist)

- [ ] Documentação da API (REST?) e o endereço do ambiente da empresa
- [ ] Um **usuário/token somente leitura** para testes (nunca um usuário administrador)
- [ ] Endpoint para **buscar produto por nome ou código**
- [ ] Endpoint para **obter a estrutura (lista de materiais) de um produto**, com os níveis
- [ ] Campos devolvidos: código, descrição, unidade, tipo/grupo do produto, quantidade na estrutura, nível
- [ ] Limite de requisições por minuto e se existe ambiente de homologação
- [ ] Quem autoriza o acesso na empresa e se há política de segurança a seguir
- [ ] (Futuro) Se a API permite **cadastrar produto**, para a equipe de cadastro

## 3. Desenho proposto (confiança: alta no desenho, média no esforço até ver a API)

```
Aparelho (app)  ->  função segura no servidor  ->  API do Nomus
                    (guarda o token em segredo)
```

- O token do Nomus **nunca vai para o aparelho**: fica só na função do servidor (mesmo modelo da função de usuários que já existe).
- Só usuário ativo e logado pode buscar. Cada consulta fica registrada.
- Buscar e importar exigem internet. A estrutura importada fica salva no aparelho e continua editável offline.

## 4. Como o dado do Nomus entra no app (mapa provisório)

| Campo do app | Vem do Nomus (hipótese) |
|---|---|
| Código | código do produto |
| Nome / descrição | descrição do produto |
| Unidade | unidade de medida |
| Quantidade | quantidade na estrutura |
| Pai (nível na árvore) | nível na lista de materiais |
| Tipo da folha (matéria-prima ou serviço) | tipo/grupo do produto |
| Não tem cadastro | **continua manual**: o operador marca e digita; o item cai na planilha "Para cadastro" |

## 5. Fluxo do operador (como descrito)

1. Pesquisa a válvula por **nome ou código** e seleciona.
2. A estrutura inteira aparece na aba Estrutura.
3. O operador só indica a providência de cada componente (Fabricar, Substituir etc.).
4. O que não existe no Nomus: marca **"Não tem cadastro"** e digita; a equipe de cadastro recebe a lista pronta.

## 6. Decisões para quando a API estiver disponível

- Todo componente exige providência hoje. Uma estrutura importada terá muitos itens que não serão tocados: provavelmente precisará de uma opção **"Sem intervenção"**.
- Importar sobre um processo que já tem componentes: **substituir** ou **juntar**?
- Se a estrutura mudar no Nomus depois, o processo já iniciado **não** deve mudar sozinho.

## 7. Sobre o servidor "Omid"

Para avaliar se ele pode ser o servidor do aplicativo, preciso saber: o que é (máquina virtual, plataforma gerenciada, outro), quem administra, se tem backup e se roda contêineres. O site em si (arquivos estáticos) roda em qualquer servidor. Banco, login e fotos hoje estão no Supabase, e migrá-los é um projeto separado, que só vale a pena com um motivo claro (custo, política da empresa, integração).
