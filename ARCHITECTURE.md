# Arquitetura do Sr Incrível

A organização usa uma aplicação independente dos SDKs, adaptadores para Discord e áudio e um ponto explícito de composição. As portas são contratos de objetos JavaScript documentados junto às classes; não há framework de injeção nem classes abstratas sem uso.

## Estrutura

~~~text
src/
  bootstrap/createBot.js
  application/
    music/MusicActions.js
    intros/IntroActions.js
    dice/rollDice.js
    audio/VoiceSessionCoordinator.js
    errors/ApplicationError.js
  adapters/
    discord/
      DiscordBot.js
      CommandRegistry.js
      InteractionRouter.js
      VoiceStateListener.js
      commands/music/ (comandos e createMusicCommand.js)
      commands/roll.js
      presentation/ (MusicPanel, musicControls, errorMessages)
    audio/
      DisTubePlayer.js
      DisTubeEvents.js
      IntroAudioPlayer.js
      YtDlpExtractor.js
      ytDlpProcess.js
      playerErrors.js
  config/ (readEnvironment, readIntroConfiguration, usuarios.example.json)
~~~

## Dependências e fluxo

~~~mermaid
flowchart LR
  Discord[Interação Discord] --> Router[InteractionRouter]
  Router --> Command[Comando: extrai IDs]
  Command --> Actions[MusicActions]
  Actions --> Port[Porta do player]
  Port --> Player[DisTubePlayer]
  Player --> DisTube[DisTube e yt-dlp]
  DisTube --> Events[DisTubeEvents: converte eventos]
  Events --> Panel[MusicPanel]
  Actions --> Coordinator[VoiceSessionCoordinator]
  Voice[VoiceStateListener] --> Intros[IntroActions]
  Intros --> Coordinator
  Intros --> IntroPlayer[IntroAudioPlayer]
~~~

O bootstrap conhece as implementações concretas. A aplicação importa somente módulos de sua própria camada e recursos nativos do Node. Adaptadores podem importar contratos e erros da aplicação; a aplicação não importa adaptadores ou leitores de configuração. Os testes verificam essa direção das dependências.

## Responsabilidades

MusicActions valida o canal e a disponibilidade da fila, coordena a reserva de busca e executa métodos nomeados: play, pause, resume, autoplay, skip, previous, stop e leave. Recebe { guildId, userId, voiceChannelId, textChannelId, query } e devolve resultados sem texto ou embeds. Não recebe Interaction, Queue, Guild ou Message.

DisTubePlayer implementa state/play/pause/resume/toggleAutoplay/skip/previous/stop/leave. state devolve null ou { hasQueue, channelId, paused, autoplay }. Ele resolve IDs no cliente, mantém filas nativas internamente e normaliza falhas conhecidas para ApplicationError, preservando a causa para diagnóstico.

IntroActions decide quando uma mudança de canal permite uma intro. IntroAudioPlayer implementa play({ guildId, channelId, audio }, onEnd) e stop(guildId), controla recursos de voz e chama onEnd na liberação. VoiceStateListener converte os objetos Discord em dados simples.

VoiceSessionCoordinator mantém reservas independentes por servidor. Consulta o estado atual do player para impedir que uma intro interrompa música pausada ou conexões existentes. Uma reserva cobre também buscas pendentes; falhas liberam a reserva. Durante o carregamento, controles e saída retornam MUSIC_LOADING para impedir que uma busca tardia reconecte o bot depois de /sair. Liberações antigas não removem reservas novas.

CommandRegistry contém uma lista explícita de nove comandos. Não varre pastas, portanto a fábrica createMusicCommand nunca é registrada como comando. InteractionRouter reconhece a interação antes de executar a ação e trata respostas privadas ou públicas. As dependências dos comandos contêm apenas music, panels e player; o token não é repassado.

MusicPanel é dono das mensagens e valida botões antigos. Tokens de geração impedem que envios atrasados recriem um painel após sua remoção. Falhas ao editar controles são registradas, sem desfazer uma ação de áudio já concluída. DisTubeEvents converte os eventos nativos em notificações simples; o bootstrap conecta essas notificações aos painéis.

DiscordBot cuida de login, eventos Discord, registro no servidor e encerramento idempotente. createBot constrói todos os componentes. rollDice contém apenas validação e sorteio; o comando roll formata o embed. ApplicationError identifica falhas por códigos; apresentação traduz códigos e resultados para português.

## Configuração e dados privados

readEnvironment valida a versão do Node, TOKEN e GUILD_ID. readIntroConfiguration lê e valida o cadastro opcional. O exemplo público fica em src/config/usuarios.example.json.

Os arquivos privados existentes permanecem em src/utils/usuarios.json e src/intros por compatibilidade com a instalação local. A pasta utils não contém código ativo. Esses dados continuam ignorados pelo Git; sem cadastro, intros ficam desativadas. /ouvir continua isolado em experimental/voice.

## Validação

npm test cobre aplicação, fronteiras dos adaptadores, roteamento, dados, configuração, reservas e limpeza de voz, controles atrasados e extração. npm run check valida sintaxe. npm run check:audio verifica o encoder e executáveis. Nenhum teste local efetua login no Discord.

## Por que application, adapters e bootstrap

Application descreve o que o bot faz e as regras para permitir cada ação. Exemplo: somente alguém no mesmo canal pode controlar música; uma intro não pode disputar voz com uma busca pendente. Essas regras operam sobre IDs e estados simples. Uma fila nativa do DisTube não atravessa essa fronteira.

Adapters adaptam as bibliotecas ao formato que a aplicação entende e às respostas esperadas pelo Discord. Os adaptadores de entrada convertem interações e eventos em dados da aplicação. Os adaptadores de saída executam áudio ou apresentam mensagens. É por isso que comandos e painéis pertencem ao adaptador Discord, enquanto operações nativas de fila e conexão pertencem ao adaptador de áudio.

Bootstrap significa preparar a inicialização. createBot cria os objetos e fornece suas dependências: o mesmo coordenador é entregue a MusicActions e IntroActions; o player concreto é entregue à aplicação; os callbacks dos eventos são conectados aos painéis. Essa montagem fica concentrada em um único lugar. Ela usa injeção de dependências pelo construtor, sem um container adicional.

Config cuida do acesso a ambiente e arquivos. A aplicação recebe dados já carregados e validados, em vez de ler TOKEN ou usuarios.json diretamente. Presentation cuida da aparência: embeds, botões e mensagens em português. Sua localização dentro do adaptador Discord expressa que essa apresentação depende da plataforma.

Essa organização combina princípios de Clean Architecture com portas e adaptadores. O projeto não tem uma camada domain separada porque suas regras atuais cabem nos casos de uso; não foram criadas entidades artificiais para representar um cliente Discord. Uma porta aqui é o contrato de métodos e dados que um objeto precisa oferecer. DisTubePlayer cumpre a porta de música, mas os testes podem fornecer um player falso com os mesmos métodos.

## Descoberta, identificação, registro e execução dos comandos

Essas quatro etapas têm funções diferentes:

1. Descoberta: CommandRegistry importa explicitamente os nove módulos de comandos e recebe uma lista dessas definições. Não lê o diretório commands. Um arquivo novo só se torna ativo depois de entrar nessa lista.
2. Identificação: cada definição possui data, construído por SlashCommandBuilder. data.name, definido por setName, é a chave usada no Map. O nome do arquivo não define o nome público.
3. Registro: após ClientReady, DiscordBot chama registry.register. As definições são convertidas por data.toJSON e enviadas ao servidor configurado em GUILD_ID pela API do Discord. Isso registra nomes, descrições e opções; a função execute permanece no processo Node.
4. Execução: InteractionRouter lê interaction.commandName para slash commands ou interaction.customId para botões. Consulta registry.get(name), reconhece a interação com deferReply/deferUpdate e chama command.execute. A resposta ou erro é apresentado no Discord.

Exemplo: leave.js exporta createMusicCommand('sair', descrição, 'leave'). O arquivo se chama leave.js, a chave no Map e o comando público são sair, e o método da aplicação é music.leave. Renomear o arquivo não muda /sair se setName e o import continuarem corretos.

A implementação antiga percorria os arquivos .js para descobrir módulos, mas também indexava comandos por command.data.name. A mudança principal foi substituir descoberta automática por composição explícita. Isso torna visível quais comandos estão ativos e permite manter createMusicCommand ao lado deles sem tentar registrá-lo como comando.

Os botões são gerados com customId como pause, skip, previous, stop e autoplay. Esses IDs correspondem às chaves no registro, permitindo usar a mesma definição para botão e slash command. A propriedade button determina quais comandos aceitam essa entrada. MusicPanel verifica se a mensagem ainda é o painel atual antes de executar a ação.

createMusicCommand reduz repetição nos comandos de música. Ele define nome e descrição, converte a interação para IDs, chama a ação escolhida, atualiza ou remove os controles quando necessário e traduz o resultado para uma resposta. Não representa uma décima definição de comando.

Para adicionar um comando: crie o módulo com data e execute, importe-o em CommandRegistry e inclua-o na lista de definições. Quando o comando envolver uma nova regra, coloque essa regra na aplicação e deixe a conversão de dados no adaptador. Reinicie o bot para enviar a nova definição ao Discord. Nomes duplicados ou definições sem execute são rejeitados antes do login.

## Exemplo completo: /play

O Discord entrega a interação; InteractionRouter encontra play e reconhece o pedido. O comando extrai guildId, userId, voiceChannelId, textChannelId e query. MusicActions verifica a autorização e reserva a sessão de voz. DisTubePlayer resolve os IDs para objetos Discord e chama DisTube, que usa YtDlpExtractor/ytDlpProcess para obter metadados e o stream.

Quando a reprodução começa, DisTubeEvents recebe playSong, converte Queue e Song em dados simples e chama o callback configurado pelo bootstrap. MusicPanel publica embed e botões. Ao terminar o pedido de play, a reserva de carregamento é liberada; a existência da fila continua impedindo intros. O resultado ADDED é convertido na mensagem privada de confirmação. Se houver falha, a reserva também é liberada e o código do erro vira uma mensagem em português.

## Formatação

O código ativo usa dois espaços, aspas simples, ponto e vírgula e limite preferencial de 100 colunas. Métodos e etapas lógicas têm linhas em branco para facilitar leitura. .editorconfig orienta os editores e .prettierrc.json configura os formatadores compatíveis; .prettierignore exclui os dados privados, dependências e a implementação experimental de voz.

O formatador utilizado na revisão é uma ferramenta temporária, sem inclusão nas dependências do bot. A revisão compara as árvores sintáticas antes e depois para confirmar que as alterações de código são apenas de formatação.
