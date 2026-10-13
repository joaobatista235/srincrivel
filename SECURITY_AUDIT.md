# Auditoria do histórico Git

Auditoria realizada em 12/10/2026, horário de São Paulo, sobre todas as referências locais e referências públicas anunciadas pelo remoto.

## Achados

- O repositório GitHub é público.
- Foram examinados 28 commits e 297 blobs distintos, incluindo 282 conteúdos textuais e arquivos internos do ZIP histórico.
- srincrivel.zip, incluído em dezembro de 2024 e depois apagado, continha um .env com um token de Discord. Apagar o ZIP em um commit posterior não removeu o conteúdo histórico.
- Áudios pessoais de src/intros, cadastro de usuários em três caminhos históricos, avatares e prompts com dados pessoais estavam versionados.
- Código antigo continha números com formato de ID Discord; a filtragem remove esses identificadores históricos e os nomes literais dos arquivos de intro.
- E-mails pessoais apareciam nos metadados dos commits. A versão filtrada preserva os nomes de autoria e substitui e-mails pessoais por um endereço redigido; endereços GitHub noreply são preservados.
- Cache Python e uma engine/binário vendorizado também estavam no histórico e foram retirados da versão filtrada.

Os valores do token e dos IDs não foram exibidos, testados contra serviços nem gravados em arquivos de substituição. O scanner não determina se um token ainda está ativo.

## Correções no código e no versionamento atual

- Comando de mensagens pessoais e configuração relacionada removidos.
- src/intros e usuarios.json ficam apenas locais, ignorados pelo Git. O cadastro deixou de ser obrigatório para iniciar o bot.
- usuarios.example.json fornece um exemplo anônimo, sem dados reais.
- .gitignore ampliado para mídia pessoal, avatares, exportações, cookies, chaves e caches.
- Hook de pre-commit e npm run check:privacy detectam arquivos privados rastreados e padrões comuns de credenciais no conteúdo staged.
- E-mail de autoria local configurado com o endereço GitHub noreply já utilizado pelo proprietário neste repositório.

## Histórico filtrado preparado

A filtragem lê o repositório original e grava somente objetos sanitizados em um repositório separado. Não cria uma cópia bruta do histórico. Todos os caminhos privados identificados, o ZIP e o binário vendorizado foram excluídos dos commits. Tokens reconhecidos, IDs históricos e nomes de intro embutidos em texto são redigidos.

A primeira filtragem reduziu os 28 commits a 25: commits que passaram a conter somente remoções de dados privados ficaram vazios e foram eliminados. A auditoria desse resultado encontrou zero candidatos de credenciais, zero candidatos de IDs Discord e nenhum ZIP ou mídia privada. A aplicação das alterações atuais acrescenta um novo commit ao candidato para publicação.

O candidato final tem 26 commits e 234 blobs distintos. A nova auditoria encontrou zero candidatos de credenciais e IDs reais e nenhum caminho privado ou ZIP; o ID artificial do exemplo e dos testes é reconhecido como placeholder. Uma instalação limpa, sem cadastro ou áudios pessoais, passou nos 35 testes. As proteções bloquearam tanto um cadastro privado adicionado com git add -f quanto uma credencial sintética; ambas as fixtures foram removidas e não entraram em commits.

O histórico público permanece inalterado até o envio autorizado da nova main. O envio exige force-push com lease, pois os identificadores dos commits mudam. Outras cópias devem ser recriadas a partir do histórico limpo para evitar reintroduzir os objetos antigos.

## Ação necessária sobre a credencial

Se o token histórico ainda estiver em uso, redefina-o no Discord Developer Portal e atualize o .env local. Remover o histórico não revoga credenciais.

Mesmo depois da publicação, objetos antigos podem permanecer em caches e referências internas do GitHub ou em clones de terceiros. Consulte o [procedimento oficial de remoção de dados sensíveis do GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) para solicitar a limpeza dessas referências e caches. A API pública não listou forks, mas isso não permite saber quem já clonou ou baixou o repositório.

## Limites

A inspeção de texto cobre formatos comuns de tokens, chaves e atribuições. Não é prova absoluta de inexistência de qualquer segredo em qualquer formato. Áudios e imagens pessoais foram classificados pelo caminho e retirados integralmente do histórico filtrado; não foram reproduzidos ou interpretados semanticamente. Binários e arquivos gerados identificados foram removidos da versão filtrada.
