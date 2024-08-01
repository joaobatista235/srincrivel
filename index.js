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
    const comandos = fs.readdirSync(`./commands/${local}`).filter(arquivo => arquivo.endsWith('.js'));

    for (let file of comandos) {
        let puxar = require(`./commands/${local}/${file}`);

        if (puxar.name) {
            client.commands.set(puxar.name, puxar);
        }
        if (puxar.aliases && Array.isArray(puxar.aliases))
            puxar.aliases.forEach(x => client.aliases.set(x, puxar.name));
    }
});

client.on("messageCreate", async (message) => {
    const reacoes = ['❤️', '🧡', '💛'];
    const valoresUsuarios = Object.values(usuarios);

    if (valoresUsuarios.includes(message.author.id)) {
        for (let i = 0; i < reacoes.length; i++) {
            message.react(reacoes[i]);
        }
    }

    let prefix = config.prefix;

    if (message.channel.type === Discord.ChannelType.DM || message.author.bot) return;
    if (!message.content.length > prefix.length) return;
    if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;
  
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
  
    let cmd = args.shift().toLowerCase();
    if (cmd.length === 0) return;
  
    let command = client.commands.get(cmd) || client.aliases.get(cmd);
    if (!command) return;

    try {
        await command.run(client, message, args);
        cnl = message;
    } catch (err) {
        console.error('Erro:' + err);
    }

});

client.on(Discord.Events.InteractionCreate, async interaction => {
    listeners.acoes(interaction.customId)
    let command = client.commands.get(interaction.customId);
    try {
        command.run(client, cnl);
        await interaction.update({ components: listeners.btnComponent });
    } catch (err) {
        console.error('Erro:' + err);
    }
});

// LISTENERS DO PLAYER DE MUSICA
client.distube
    .on('playSong', (queue, song) => listeners.onPlaySong(client.user.username, cnl.author.iconURL, song.name, song.thumbnail, song.formattedDuration, cnl.channel))
    .on('addSong', (queue, song) => listeners.onAddSong(song.name, cnl.channel))
    .on('error', (textChannel, e) => listeners.error(e.message, cnl.channel))
    .on('finish', queue => queue.textChannel?.send('Fim da fila!'))
    .on('finishSong', queue => queue.textChannel?.send('Fim da música!'))
    .on('disconnect', queue => queue.textChannel?.send('Disconectado!'))
    .on('empty', queue => queue.textChannel?.send('O canal de voz está vazio! Saindo do canal...'))

client.on("ready", () => {

    console.log('Servidores em que o bot está:');
    client.guilds.cache.forEach((guild) => {
    //console.log(`${guild.name} - ${guild.id}`);

    // Remover o bot de algum servidor pelo id
    // if (guild.id == 'idServidor') {
    //     guild.leave()
    //       .then(() => console.log(`Bot removido do servidor: ${guild.name}`))
    //       .catch(console.error);
    //   }

    });

    client.users.fetch(usuarios.digao, false).then((user) => {
        user.send('Eu sei aonde vc mora');
    });

})