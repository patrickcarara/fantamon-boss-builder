# Fantamon Boss Builder — Versão 1

## Como abrir

1. Extraia o arquivo ZIP.
2. Abra a pasta `Fantamon_Boss_Builder_v1`.
3. Dê dois cliques em `index.html`.
4. O programa abrirá no navegador.

## O que já funciona

- Cadastro, edição, pesquisa, favorito e exclusão de bosses.
- Várias estratégias por boss.
- Nome livre para cada estratégia.
- Estratégia marcada como principal.
- Abertura automática da estratégia principal.
- Duplicar, renomear e excluir estratégia.
- Quatro slots de personagens.
- Cada personagem possui 4 posições de skill.
- Drag and drop de skills para cada uma das 4 posições.
- Dois cliques para remover skill do slot.
- Observações separadas por estratégia.
- Salvamento automático no navegador.

## Imagens

As cinco skills atuais usam imagens provisórias em SVG.

Para trocar uma imagem:
1. Coloque a imagem na pasta `assets/skills/mage`.
2. Edite o caminho correspondente no começo do arquivo `script.js`.

Para adicionar a imagem de um boss, coloque o arquivo em `assets/bosses` e, no cadastro do boss, informe por exemplo:

`assets/bosses/ancient-dragon.png`

## Importante

Os dados são salvos no armazenamento local do navegador. Não apague os dados do navegador sem antes fazer uma cópia quando adicionarmos o sistema de exportação/importação.


## Atualização v1.1
Cada personagem agora possui exatamente 4 espaços visuais de skill. Arraste uma skill para cada espaço. Dois cliques removem a skill daquela posição.


## Atualização v1.2

Novidades:
- Escolha direta de imagem do boss pelo computador.
- Prévia da imagem antes de salvar.
- Exportação de backup completo em JSON.
- Importação de backup.
- Exibição da data e hora da última alteração da estratégia.

### Recomendação
Use o botão `Exportar Backup` de tempos em tempos. O arquivo gerado guarda bosses, estratégias, observações, slots e imagens adicionadas diretamente pelo programa.


## Atualização v1.3
- Área da imagem do boss aumentada em aproximadamente 3 cm na largura e 5 cm na altura.


## Atualização v1.4
- Corrigido o enquadramento da imagem do boss para não ultrapassar as laterais do quadro.
- A imagem agora usa `object-fit: contain`, mantendo a proporção inteira dentro do espaço.


## Atualização v1.5
- Quadro da imagem do boss definido em 400 x 560 pixels.
- Imagem centralizada e ajustada proporcionalmente dentro do quadro.


## Atualização v1.6

- Adicionado botão `Exportar PNG`.
- A exportação captura a área principal com a imagem do boss e a estratégia montada.
- O arquivo recebe automaticamente o nome do boss e da estratégia.

### Observação sobre Exportar PNG
Esta versão usa a biblioteca html2canvas carregada pela internet. Na primeira utilização do recurso, mantenha o computador conectado à internet.


## Versão baseada na v1.6 — layout 20% menor

- Esta versão voltou para a base da v1.6.
- O layout geral foi reduzido em 20%.
- Todos os elementos visuais ficam em aproximadamente 80% do tamanho anterior.


## Atualização v1.9

Base:
- Mantido o layout aprovado da v1.6 com redução geral de 20%.
- Removido o botão `Exportar PNG`.

Biblioteca de Skills:
- Adicionado botão `+ Adicionar várias Skills`.
- É possível selecionar várias imagens de uma só vez.
- As imagens são adicionadas automaticamente à classe atualmente selecionada.
- O nome inicial da skill é criado a partir do nome do arquivo.
- Skills importadas podem ser removidas pelo botão `×`.
- Classes disponíveis no seletor: Mage, Warrior, Archer e Priest.
- As skills ficam salvas no armazenamento local do navegador e também entram no sistema de backup.

Importante:
Por segurança do navegador, uma página HTML não pode gravar arquivos diretamente em uma pasta física do Windows sem pedir permissão especial. Nesta versão, as skills são armazenadas dentro dos dados do Fantamon Boss Builder e organizadas pela classe selecionada, funcionando como a pasta daquela classe dentro do aplicativo.


## Atualização v2.0 — Gerenciamento de Classes

Agora é possível:
- Adicionar novas classes.
- Renomear qualquer classe.
- Excluir classes.
- Manter as skills organizadas separadamente por classe.
- Usar automaticamente as novas classes nos 4 slots dos personagens.
- Selecionar uma nova classe na biblioteca e importar várias skills para ela.

Importante:
Ao renomear uma classe, as skills existentes permanecem vinculadas normalmente.
Ao excluir uma classe, as skills personalizadas daquela classe são removidas da biblioteca.


## Atualização v2.1

- Removido o nome visível abaixo das imagens das skills.
- As imagens das skills ficaram maiores.
- O nome da skill aparece somente quando o mouse fica sobre a imagem.
- A mudança vale tanto para a biblioteca quanto para as skills colocadas nos personagens.


## Atualização v2.2

- Ajustado o painel da estratégia para terminar praticamente na mesma altura do cartão do boss.
- A biblioteca de skills sobe e fica alinhada logo abaixo dos dois painéis, reduzindo o grande espaço vazio sob a imagem do boss.
- Os 4 personagens continuam visíveis, mas com espaçamento interno um pouco mais compacto.
- Mantido o layout geral reduzido em 20% que já havia sido aprovado.
