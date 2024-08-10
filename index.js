const Discord = require("discord.js");
const { DisTube } = require('distube');
const fs = require("fs");

const client = new Discord.Client({ intents: [1, 512, 32768, 2, 128, "GuildVoiceStates"] });

require('dotenv').config();
// Import de arquivos necessarios
let cnl = null;
const listeners = require('./config/listeners.js');
const config = require("./config/config.json");
const usuarios = require("./config/usuarios.json");

client.distube = new DisTube(client, {
    leaveOnStop: false,
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
})

client.login(process.env.TOKEN);
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
client.categories = fs.readdirSync(`./commands/`);

fs.readdirSync('./commands/').forEach(local => {
    const comandos = fs.readdirSync(`./commands/`).filter(arquivo => arquivo.endsWith('.js'));

    for (let file of comandos) {
        let puxar = require(`./commands/${file}`);

        if (puxar.name) {
            client.commands.set(puxar.name, puxar);
        }
        if (puxar.aliases && Array.isArray(puxar.aliases))
            puxar.aliases.forEach(x => client.aliases.set(x, puxar.name));
    }
});

// Event Listener para mensagens
client.on("messageCreate", async (message) => {
    // Ignorar mensagens de DMs, bots e mensagens muito curtas
    if (message.channel.type === Discord.ChannelType.DM ||
        message.author.bot ||
        message.content.length <= config.prefix.length) return;

    // Verificar se a mensagem começa com o prefixo
    if (!message.content.toLowerCase().startsWith(config.prefix.toLowerCase())) return;

    // Remover o prefixo, separar os argumentos e obter o comando
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();

    // Obter o comando a partir do nome ou alias
    let command = client.commands.get(cmd) || client.aliases.get(cmd);
    if (!command) return;

    try {
        // Executar o comando
        await command.run(client, message, args);
        cnl = message; // Armazenar o canal da mensagem (considerar alternativas)
    } catch (err) {
        console.error('Erro ao executar o comando:', err);
        // Enviar mensagem de erro para o usuário
        message.reply('Ocorreu um erro ao executar esse comando.');
    }
});

// Event Listener para interações
client.on(Discord.Events.InteractionCreate, async interaction => {
    listeners.acoes(interaction.customId);

    let command = client.commands.get(interaction.customId);
    if (!command) return;

    try {
        await command.run(client, cnl); // Executar o comando
        await interaction.update({ components: listeners.btnComponent });
    } catch (err) {
        console.error('Erro ao executar o comando:', err);
        // Enviar mensagem de erro para o usuário
        interaction.reply('Ocorreu um erro ao executar esse comando.');
    }
});

// Event Listeners para o DisTube
client.distube
    .on('playSong', (queue, song) => listeners.onPlaySong(client.user.username, cnl.author.iconURL, song.name, song.thumbnail, song.formattedDuration, cnl.channel))
    .on('addSong', (queue, song) => listeners.onAddSong(song.name, cnl.channel))
    .on('error', (channel, e) => {
        console.error('Erro no DisTube:', e);
        channel.send(`Ocorreu um erro: ${e.message}`);
    })
    .on('finish', queue => queue.textChannel?.send('Fim da fila!'))
    .on('finishSong', queue => queue.textChannel?.send('Fim da música!'))
    .on('disconnect', queue => queue.textChannel?.send('Disconectado!'))
    .on('empty', queue => queue.textChannel?.send('O canal de voz está vazio! Saindo do canal...'));

client.on("ready", () => {

    console.log('SrIncrivel está entre nós.');

    // Listar servidores em que o bot está ativo
    // client.guilds.cache.forEach((guild) => {
    //     console.log(`${guild.name} - ${guild.id}`);
    // });

    // Remover o bot de algum servidor pelo id
    // if (guild.id == 'idServidor') {
    //     guild.leave()
    //       .then(() => console.log(`Bot removido do servidor: ${guild.name}`))
    //       .catch(console.error);
    //   }

    client.users.fetch(usuarios.digao, false).then((user) => {
        user.send('Eu sei aonde vc mora');
    });

    client.login(process.env.TOKEN);

})