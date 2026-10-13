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
