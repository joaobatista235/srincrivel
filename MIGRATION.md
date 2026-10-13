# Migração para Node 26

Versões consultadas diretamente no registro oficial npm em 12/10/2026, horário de São Paulo. Ambiente de validação: Windows, Node 26.10.0 e npm 11.19.1.

## Dependências ativas

| Biblioteca | Antes | Depois | Decisão |
| --- | --- | --- | --- |
| discord.js | 14.16.3 | 14.27.0 | Última versão estável consultada; usa Events.ClientReady e MessageFlags.Ephemeral. |
| @discordjs/voice | 0.17.0 | 0.19.2 | Última estável; requer Node >=22.12 e inclui DAVE. |
| distube | 5.0.7 | 5.2.3 | Última estável; requer Node >=22.12. Eventos, opções, gerenciadores e retornos assíncronos conferidos na versão instalada. |
| @distube/yt-dlp | 2.0.1 | 2.0.1 | Já estava na última estável consultada; utilizado para instalar o executável yt-dlp. |
| ffmpeg-static | ausente | 5.3.0 | Última estável; instala FFmpeg para DisTube e intros. |
| opusscript | ausente | 0.0.8 | Versão aceita pelo peer dependency de prism-media 1.3.5, usado por @discordjs/voice. |

opusscript 0.1.1 existe, mas o peer dependency de prism-media exige ^0.0.8. A versão 0.0.8 foi escolhida e o encoder testado no Node 26, sem --force ou --legacy-peer-deps. @discordjs/opus 0.10.0 também foi avaliado: seu encoder carregou no Node 26, mas trouxe uma cadeia antiga de instalação com vulnerabilidades em tar. Foi substituído pelo encoder WebAssembly, removendo essa cadeia e a necessidade de compilação nativa.

@distube/youtube 1.0.4 é a última versão consultada, mas depende de ytdl-core/ytpl antigos. Em vez de sobrescrever dependências incompatíveis, foi retirado. O novo YtDlpExtractor implementa a API pública PlayableExtractorPlugin do DisTube e usa o executável yt-dlp para URLs, playlists, busca e autoplay. O subprocesso recebe argumentos sem shell, limites de tempo e Node como runtime JavaScript. O autoplay usa busca por título/artista; não depende da extração de Mixes do YouTube.

## Remoções

- /chat, AIContextManager, prompts de IA e eventos messageCreate.
- SDKs de Google e OpenAI e variáveis de ambiente da IA.
- Babel e flags que ocultavam warnings.
- dotenv: substituído pelo --env-file-if-exists do Node 26.
- Plugins de Spotify, SoundCloud, Deezer e ytdl-core sem uso ativo.
- canvas, libsodium-wrappers e fluent-ffmpeg sem uso ativo; a plataforma oferece aes-256-gcm e FFmpeg é usado diretamente.
- Bibliotecas de transcrição, node-fetch e form-data do /ouvir: o código anterior está em experimental/voice e não é carregado.
- Entidade User e utilitários de caminho/configuração redundantes.
- Nomes de usuários utilizados apenas no prompt de IA; o cadastro de intros mantém IDs e arquivos de áudio somente localmente, fora do Git.
- IDs de servidor/categoria/bot embutidos na lógica. GUILD_ID fica no .env; o comando de mensagens pessoais e sua configuração foram removidos.

## Correções de comportamento

- Reconhecimento da interação antes de operações de rede; deferReply para slash commands e deferUpdate apenas para botões.
- Serviço de música compartilhado por comandos e botões, com tratamento centralizado de erros.
- previous aguarda o retorno assíncrono do DisTube.
- stop encerra fila e conexão, e retira os controles antigos.
- Controles exigem o mesmo canal de voz do bot.
- Intros são isoladas por servidor e não disputam conexão com filas ou buscas de música.
- Conclusão e falhas de intro liberam recursos sem timers atrasados que possam destruir uma sessão nova.
- Busca e leitura de JSON do yt-dlp possuem timeout; falhas não são ocultadas.
- Carregamento de comandos usa URLs de arquivo válidas no Windows e falha cedo em módulos inválidos.
- Rolagem usa node:crypto, limita tamanho e evita ultrapassar o limite dos embeds.

## Validação

- Testes de regressão com node --test.
- Verificação de sintaxe no Node 26.10.0.
- Inicialização e encerramento offline, carregando nove comandos sem /chat ou /ouvir.
- Encoder Opus produzindo um pacote de áudio; FFmpeg e yt-dlp executados localmente.
- Biblioteca DAVE carregada na plataforma Windows x64.
- Consulta real de metadados e URL de áudio do YouTube.
- Busca real por nome e autoplay por título/artista, sem baixar áudio.
- npm audit reportando zero vulnerabilidades conhecidas.
- npm ls sem conflitos de dependências obrigatórias. Pacotes opcionais de outras plataformas não são instalados no Windows.

Os testes não incluem login, registro de comandos nem transmissão de voz em um servidor Discord. A validação dessas etapas requer TOKEN e permissões do bot. Fontes de mídia podem alterar seus requisitos independentemente das bibliotecas npm.
