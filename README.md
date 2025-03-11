---

```markdown
# Bot de Discord 🤖

![Bot Logo](https://media.stickerswiki.app/mrexcept/80554.512.webp)

Um bot de Discord desenvolvido em **Node.js v18** para um servidor pessoal entre amigos. O bot é orientado a objetos e possui funcionalidades avançadas, como reprodução de músicas, integração com inteligência artificial e áudios de introdução personalizados.

---

## Índice 📚

- [Visão Geral](#visão-geral-)
- [Funcionalidades](#funcionalidades-)
- [Tecnologias Utilizadas](#tecnologias-utilizadas-)
- [Pré-requisitos](#pré-requisitos-)
- [Como Executar](#como-executar-)
- [Estrutura do Projeto](#estrutura-do-projeto-)
- [Contribuição](#contribuição-)
- [Licença](#licença-)

---

## Visão Geral 🌟

Este bot foi desenvolvido para um servidor de Discord pessoal, com o objetivo de proporcionar uma experiência divertida e interativa para os membros. Ele é capaz de tocar músicas diretamente do YouTube, interagir com os usuários por meio de inteligência artificial e reproduzir áudios de introdução quando membros entram em call.

---

## Funcionalidades ✨

- **Reprodução de Músicas**:
  - Busca e toca músicas diretamente do YouTube.
  - Suporte para playlists e integração com Spotify, SoundCloud e Deezer.
- **Inteligência Artificial**:
  - Cria um chat privado com um usuário e mantém uma conversa fluida.
  - Responde com base em um prompt pré-configurado, incluindo informações sobre o servidor e membros.
- **Áudios de Introdução**:
  - Reproduz um áudio personalizado sempre que um membro entra em call.
- **Slash Commands**:
  - Comandos interativos para facilitar a interação com o bot.
- **Código Limpo e Modular**:
  - Estrutura orientada a objetos e organização em pastas para facilitar a manutenção e expansão.

---

## Tecnologias Utilizadas 🛠️

- **Linguagem**: Node.js v18
- **Bibliotecas Principais**:
  - `discord.js`: Para interação com a API do Discord.
  - `distube`: Para reprodução de músicas.
  - `@google/generative-ai`: Para integração com inteligência artificial.
  - `ffmpeg-static`: Para processamento de áudio.
  - `dotenv`: Para gerenciamento de variáveis de ambiente.
- **Outras Dependências**:
  - `@discordjs/opus` e `@discordjs/voice`: Para suporte a áudio.
  - `libsodium-wrappers`: Para criptografia.

---

## Pré-requisitos 📋

Antes de executar o projeto, certifique-se de ter instalado:

- [Node.js](https://nodejs.org/) (v18 ou superior)
- [Git](https://git-scm.com/)
- [FFmpeg](https://ffmpeg.org/) (para processamento de áudio)
- Uma conta no [Google Cloud](https://cloud.google.com/) (para a API de IA)

---

## Como Executar 🚀

Siga os passos abaixo para rodar o bot localmente:

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/bot-discord.git
   cd bot-discord
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**:
   - Crie um arquivo `.env` na raiz do projeto.
   - Adicione as seguintes variáveis:
     ```env
     DISCORD_TOKEN=seu_token_do_discord
     GOOGLE_API_KEY=sua_chave_da_api_google
     YOUTUBE_API_KEY=sua_chave_da_api_youtube
     ```

4. **Execute o bot**:
   ```bash
   node .
   ```

---

## Estrutura do Projeto 🗂️

```
bot-discord/
├── src/
│   ├── commands/        # Implementação dos Slash Commands
│   ├── config/          # Configurações do bot
│   ├── controllers/     # Lógica de controle
│   ├── entities/        # Entidades do sistema
│   ├── intros/          # Áudios de introdução
│   └── index.js         # Ponto de entrada do bot
├── .env                 # Variáveis de ambiente
├── .gitignore           # Arquivos ignorados pelo Git
├── package.json         # Dependências do projeto
└── README.md            # Documentação do projeto
```

---

## Contribuição 🤝

Contribuições são bem-vindas! Siga os passos abaixo:

1. Faça um fork do projeto.
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/nova-feature
   ```
3. Commit suas alterações:
   ```bash
   git commit -m "Adiciona nova feature"
   ```
4. Envie as alterações:
   ```bash
   git push origin feature/nova-feature
   ```
5. Abra um Pull Request.

---

## Licença 📜

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Feito com ❤️ por [João Batista](https://github.com/joaobatista235).
```
