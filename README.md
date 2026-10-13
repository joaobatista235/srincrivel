# Sr Incrível

Bot de Discord para um servidor pessoal: música, áudios de entrada, rolagem de dados.

## Requisitos

- Node.js **26.x**.
- Token de um bot do Discord.
- Permissões no servidor: Ver canais, Enviar mensagens, Inserir links, Conectar e Falar.
- Conexão à internet para instalar dependências e obter músicas.

FFmpeg e yt-dlp são instalados pelo npm. O encoder Opus usa WebAssembly e dispensa ferramentas de compilação C++. A comunicação de voz usa a versão atual de @discordjs/voice com suporte a DAVE.

## Instalação

Na pasta do projeto:

```powershell
npm ci
Copy-Item .env.example .env
```

Preencha o arquivo .env:

```dotenv
TOKEN=token_do_bot
GUILD_ID=id_do_servidor
```

Não são necessárias chaves de serviços de IA.

```powershell
npm start
```

O Node carrega o .env nativamente. A inicialização valida a configuração e registra os comandos no servidor indicado por GUILD_ID. O registro substitui a lista anterior de comandos desse bot no servidor, incluindo a remoção de /chat e /ouvir.

## Comandos

| Comando | Função |
| --- | --- |
| /play musica | Busca no YouTube pelo nome ou reproduz uma URL suportada por yt-dlp. |
| /pause | Pausa ou retoma a música. |
| /resume | Retoma uma música pausada. |
| /skip | Pula para a próxima música. |
| /previous | Volta à música anterior. |
| /stop | Para a fila e desconecta o bot. |
| /sair | Desconecta o bot, inclusive durante uma intro. |
| /autoplay | Busca próximos vídeos pelo título e artista da música atual no YouTube. |
| /roll dados | Rola dados no formato 2d6. |

Os controles de música exigem que o usuário esteja no mesmo canal de voz do bot. Os botões do painel atual usam as mesmas ações dos slash commands; controles antigos são desativados.

As respostas dos comandos são privadas, exceto /roll. O painel da música aparece no canal de texto. O autoplay consulta até dez vídeos por título e artista, excluindo o vídeo atual; fontes externas ao YouTube não fornecem autoplay.

Links de Spotify e Deezer não são convertidos em músicas do YouTube. O projeto não mantém plugins instalados sem uso. A disponibilidade de cada URL depende do suporte do yt-dlp e das regras do provedor.

## Áudios de entrada

O cadastro src/utils/usuarios.json e os arquivos de src/intros são privados, ignorados pelo Git e devem existir somente na máquina onde o bot roda. O cadastro é opcional: sem ele, o bot inicia normalmente, com intros desativadas.

Para configurar intros, use src/config/usuarios.example.json como modelo e associe cada ID de usuário a um arquivo de src/intros:

```json
{
  "123456789012345678": { "audio": "entrada.mp3" }
}
```

Intros não interrompem uma fila de música, mesmo pausada, ou uma busca pendente. Durante uma busca, aguarde a conclusão antes de executar novos controles ou /sair. Cada servidor tem sua própria sessão; conclusão, desconexão e falhas liberam o player e a conexão.

## Verificações

```powershell
npm test
npm run check
npm run check:audio
npm run check:extractor
npm run check:privacy
```

- npm test executa testes locais com o runner do Node, sem login no Discord.
- npm run check valida a sintaxe de todos os arquivos ativos e dos testes.
- npm run check:audio verifica Opus, FFmpeg, yt-dlp e mostra as dependências de voz.
- npm run check:extractor consulta metadados e uma URL de áudio pública no YouTube. Não baixa mídia nem inicia o bot. Também aceita uma URL como argumento: npm run check:extractor -- URL.

Os executáveis auxiliares são baixados na instalação. Para reinstalá-los e atualizar o yt-dlp instalado, execute npm rebuild @distube/yt-dlp ffmpeg-static. O package.json aprova apenas os scripts dessas duas dependências para versões do npm que exigem essa configuração.

## Organização

- index.js: inicia o bot e trata sinais de encerramento.
- src/bootstrap/createBot.js: constrói dependências concretas e conecta os adaptadores.
- src/application/: ações de música, política de intros, dados e coordenação das sessões de voz. Recebe IDs e objetos simples; não importa SDKs.
- src/adapters/discord/: ciclo de vida do cliente, registro explícito dos nove comandos, roteamento das interações e tradução dos eventos de voz.
- src/adapters/discord/commands/music/: comandos e fábrica de comandos de música.
- src/adapters/discord/presentation/: painéis, botões e mensagens em português.
- src/adapters/audio/: implementações dos players, tradução dos eventos do DisTube e execução do yt-dlp.
- src/config/: leitura de ambiente e configuração de intros, separadamente.
- tests/: regressão, contratos dos adaptadores e dependências entre camadas.
- experimental/voice/: implementação anterior de /ouvir, preservada e desativada.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para contratos, fluxo e decisões de organização.

O chat e toda a integração de IA foram removidos. A implementação de /ouvir será retomada posteriormente; suas dependências não fazem parte da instalação ativa.

Consulte [MIGRATION.md](MIGRATION.md) para versões, decisões e validações da migração.

## Proteção do versionamento

Execute npm run setup:hooks uma vez em cada clone. O hook de pre-commit verifica arquivos privados rastreados e padrões conhecidos de credenciais no conteúdo staged. Não exibe valores detectados. npm run check:privacy executa a mesma verificação manualmente.

.gitignore impede novas inclusões de áudios pessoais, cadastro de usuários, .env, avatares, ZIPs, cookies, chaves e caches. Ignorar um arquivo não o remove de commits anteriores; a limpeza histórica é descrita em SECURITY_AUDIT.md.

Consulte também [DEPENDENCIES.md](DEPENDENCIES.md) para entender o fluxo de áudio e cada biblioteca.
