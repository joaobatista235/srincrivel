# Bibliotecas e fluxo de áudio

O projeto declara seis bibliotecas diretamente. Outras aparecem em node_modules porque são dependências internas dessas seis.

| Biblioteca | Versão | Papel neste bot |
| --- | --- | --- |
| discord.js | 14.27.0 | Conecta o bot ao Discord e fornece comandos, interações, mensagens, embeds e botões. |
| @discordjs/voice | 0.19.2 | Gerencia conexões de voz, players, recursos de áudio e envio de pacotes para o Discord. Inclui suporte ao protocolo DAVE. |
| distube | 5.2.3 | Gerencia a fila de músicas, pausa, retomada, próxima/anterior e autoplay. Usa @discordjs/voice para transmitir áudio. |
| @distube/yt-dlp | 2.0.1 | Instala o executável yt-dlp. O adaptador do projeto chama esse executável para consultar metadados e obter a URL do áudio. |
| ffmpeg-static | 5.3.0 | Instala o executável FFmpeg. FFmpeg lê o áudio de uma URL ou MP3 local e o decodifica para o processamento de voz. |
| opusscript | 0.0.8 | Fornece libopus compilado para WebAssembly, convertendo amostras de áudio em pacotes comprimidos no formato Opus. |

## yt-dlp

[yt-dlp](https://github.com/yt-dlp/yt-dlp) é um programa de linha de comando para extrair informações e acessar mídia de sites como YouTube. Aqui, ele procura vídeos pelo nome, lê título/duração e encontra uma URL temporária para o áudio. O bot passa essa URL ao FFmpeg; o código usa --skip-download e --simulate, então yt-dlp não salva a música inteira em um arquivo local. A reprodução ainda transfere áudio pela rede para tocá-lo.

O pacote npm @distube/yt-dlp e o executável yt-dlp são componentes diferentes: o pacote instala o programa; a versão do programa pode ser atualizada separadamente. Nosso adaptador implementa a API pública de plugins do DisTube e define Node como runtime dos desafios JavaScript do YouTube.

## Encoder Opus e WebAssembly

Encoder significa codificador: ele transforma o áudio em um formato adequado para transmissão. Opus é o formato de áudio comprimido usado nas chamadas do Discord. Esse processamento é necessário tanto para músicas quanto para intros.

WebAssembly, ou WASM, é um formato binário que permite executar código compilado dentro de runtimes como Node.js. [opusscript](https://github.com/abalabahaha/opusscript) fornece a biblioteca libopus compilada com Emscripten. O código WASM roda dentro do processo do bot; não exige abrir navegador e não envia áudio a um serviço externo de codificação.

Antes, @discordjs/opus instalava um módulo nativo ligado ao sistema operacional e arquitetura da máquina. Foi avaliada sua versão 0.10.0, mas a cadeia de instalação trazia componentes antigos vulneráveis. opusscript evita essa cadeia e a necessidade de compilação C++ na instalação. Pode consumir mais CPU que o encoder nativo, dependendo da máquina e da carga.

A versão 0.0.8 é a faixa aceita por prism-media 1.3.5, dependência de @discordjs/voice. A versão 0.1.1 de opusscript existe, mas não corresponde a esse peer dependency. O encoder 0.0.8 foi testado no Node 26 produzindo um pacote de áudio válido.

## Caminho do áudio

```mermaid
flowchart LR
  Y[YouTube ou link] --> D[yt-dlp encontra a URL]
  D --> F[FFmpeg decodifica o áudio]
  I[MP3 local de intro] --> F
  F --> O[opusscript codifica em Opus]
  O --> V[discordjs/voice transmite]
  V --> C[Canal de voz do Discord]
```

DisTube coordena a fila e o playback. discord.js recebe os comandos e mantém a conexão do bot. DAVE e a criptografia da conexão são responsabilidades da camada de voz, separadas da compressão Opus.

## Dependências internas relevantes

- prism-media: conecta os fluxos de áudio e usa FFmpeg e o encoder Opus.
- @snazzah/davey: implementação do protocolo DAVE, instalada por @discordjs/voice.
- undici: cliente HTTP usado pelas bibliotecas.
- @discordjs/builders, @discordjs/rest e discord-api-types: construção e registro de comandos e comunicação com a API.
- ws: transporte WebSocket da conexão com o Discord.

O lockfile registra toda a árvore para instalações reproduzíveis. Somente as seis bibliotecas da tabela são dependências diretas mantidas pelo projeto.

## Inventário completo das dependências internas instaladas

Inventário da instalação Windows validada: 51 nomes de pacotes, em 55 instalações quando se contam as versões duplicadas. A tabela acima explica as seis dependências diretas; abaixo estão todos os demais pacotes efetivamente presentes. Pacotes opcionais de outras plataformas não estão incluídos.

| Pacote interno | Versão instalada | Função |
| --- | --- | --- |
| @derhuerst/http-basic | 8.2.4 | Requisições HTTP do instalador do FFmpeg. |
| @discordjs/builders | 1.14.1 | Constrói comandos, embeds e componentes de interface. |
| @discordjs/collection | 1.5.3, 2.1.1 | Coleções Map com operações auxiliares. |
| @discordjs/formatters | 0.6.2 | Formatação de textos para o Discord. |
| @discordjs/rest | 2.6.3 | Cliente HTTP da API REST do Discord. |
| @discordjs/util | 1.2.0 | Utilitários internos das bibliotecas Discord. |
| @discordjs/ws | 1.2.3 | Gerencia a conexão WebSocket com o gateway Discord. |
| @sapphire/async-queue | 1.5.5 | Organiza operações assíncronas em fila. |
| @sapphire/shapeshift | 4.0.0 | Valida dados e opções de builders. |
| @sapphire/snowflake | 3.5.5 | Manipula identificadores numéricos no formato Snowflake. |
| @snazzah/davey | 0.1.12 | Implementa criptografia de voz DAVE. |
| @snazzah/davey-win32-x64-msvc | 0.1.12 | Binário DAVE para Windows x64, já compilado. |
| @types/node | 22.8.7, 10.17.60 | Definições de tipos da API Node; não codifica áudio nem executa o bot. |
| @types/ws | 8.18.2 | Definições de tipos para WebSocket. |
| @vladfrangu/async_event_emitter | 2.4.7 | Eventos que suportam listeners assíncronos. |
| agent-base | 6.0.2 | Base para agentes de conexão HTTP/proxy. |
| buffer-from | 1.1.2 | Compatibilidade na criação de buffers binários. |
| caseless | 0.12.0 | Tratamento de cabeçalhos HTTP sem distinguir maiúsculas/minúsculas. |
| concat-stream | 2.0.0 | Reúne partes de um stream em um buffer. |
| dargs | 7.0.0 | Converte objetos de opções em argumentos de linha de comando. |
| debug | 4.3.7 | Logs internos de depuração das bibliotecas. |
| discord-api-types | 0.38.56 | Tipos e constantes da API Discord. |
| env-paths | 2.2.1 | Localiza diretórios de cache/configuração conforme o sistema operacional. |
| fast-deep-equal | 3.1.3 | Compara estruturas de dados. |
| http-response-object | 3.0.2 | Representa uma resposta HTTP no instalador. |
| https-proxy-agent | 5.0.1 | Conexões HTTPS por proxy. |
| inherits | 2.0.4 | Compatibilidade de herança em módulos JavaScript. |
| lodash | 4.18.1 | Operações auxiliares sobre arrays e objetos. |
| lodash.snakecase | 4.1.1 | Converte nomes para snake_case. |
| magic-bytes.js | 1.13.1 | Identifica tipos de arquivo pela assinatura binária. |
| ms | 2.1.3 | Converte e formata durações de tempo. |
| parse-cache-control | 1.0.1 | Interpreta o cabeçalho HTTP Cache-Control. |
| prism-media | 1.3.5 | Pipeline de áudio, FFmpeg, Opus e streams. |
| progress | 2.0.3 | Barra de progresso dos instaladores. |
| readable-stream | 3.6.2 | Implementação de streams usada por dependências internas. |
| safe-buffer | 5.2.1 | Utilitários de compatibilidade para buffers. |
| string_decoder | 1.3.0 | Decodifica texto vindo de buffers/streams. |
| tiny-typed-emitter | 2.1.0 | Emissor de eventos usado pelo DisTube. |
| ts-mixer | 6.0.4 | Composição de classes/mixins. |
| tslib | 2.8.1 | Funções auxiliares de código compilado de TypeScript. |
| typedarray | 0.0.6 | Compatibilidade com arrays binários tipados. |
| undici | 7.30.0, 6.29.0 | Cliente HTTP das bibliotecas Discord/DisTube. |
| undici-types | 6.19.8 | Definições de tipos do cliente HTTP. |
| util-deprecate | 1.0.2 | Avisos de APIs obsoletas em dependências internas. |
| ws | 8.22.0 | Implementação de WebSocket. |
