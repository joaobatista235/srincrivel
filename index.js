import Discord from "discord.js";
import { DisTube, Events } from 'distube';
import fs from "fs";
import listeners from './config/listeners.js';
import config from "./config/config.json" assert { type: "json" };
import path from 'path';
import { fileURLToPath } from 'url';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus } from '@discordjs/voice';
import 'dotenv/config';

const client = new Discord.Client({ intents: [1, 512, 32768, 2, 128, "GuildVoiceStates"] });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usuarios = JSON.parse(fs.readFileSync('./config/usuarios.json'));

client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
});

client.login(process.env.TOKEN);
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
client.categories = fs.readdirSync(`./commands/`);

const loadCommands = async () => {
    const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const { default: command } = await import(`./commands/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
        }
        if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => client.aliases.set(alias, command.name));
        }
    }
};

loadCommands();

client.on("messageCreate", async (message) => {
    if (message.channel.type === Discord.ChannelType.DM ||
        message.author.bot ||
        message.content.length <= config.prefix.length) return;

    if (!message.content.toLowerCase().startsWith(config.prefix.toLowerCase())) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();

    let command = client.commands.get(cmd) || client.commands.get(client.aliases.get(cmd));
    if (!command) return;

    try {
        await command.run(client, message, args);
    } catch (err) {
        console.error('Erro ao executar o comando:', err);
        message.reply('Ocorreu um erro ao executar esse comando.');
    }
});

client.on(Discord.Events.InteractionCreate, async interaction => {
    listeners.acoes(interaction.customId);

    let command = client.commands.get(interaction.customId);
    if (!command) return;

    try {
        await command.run(client, interaction);
        await interaction.update({ components: listeners.btnComponent });
    } catch (err) {
        console.error('Erro ao executar o comando:', err);
        interaction.reply('Ocorreu um erro ao executar esse comando.');
    }
});

client.distube
    .on('playSong', (queue, song) => 
        listeners.onPlaySong(client.user.username, null, song.name, song.thumbnail, song.formattedDuration, queue.textChannel))
    .on('addSong', (queue, song) => listeners.onAddSong(song.name, queue.textChannel))
    .on(Events.ERROR, (queue, err) => console.log(err))
    .on('finish', queue => queue.textChannel?.send('Fim da fila!'))
    .on('finishSong', queue => queue.textChannel?.send('Fim da música!'))
    .on('disconnect', queue => queue.textChannel?.send('Desconectado!'))
    .on('empty', queue => queue.textChannel?.send('O canal de voz está vazio! Saindo do canal...'));

client.on('voiceStateUpdate', (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const userId = newState.id;
        const userAudio = usuarios[userId];

        if (!userAudio) {
            console.log(`Usuário ${userId} não possui áudio configurado.`);
            return;
        }

        const audioPath = path.join(__dirname, userAudio.audio);
        const voiceChannel = newState.channel;

        if (!voiceChannel) return;

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(audioPath);

            connection.subscribe(player);

            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`Tocando áudio para o usuário ${userId}!`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`Áudio para o usuário ${userId} finalizado. Desconectando...`);
                connection.destroy();
            });
        } catch (error) {
            console.error(`Erro ao tentar reproduzir o áudio para o usuário ${userId}:`, error);
        }
    }
});
    

client.on("ready", () => {
    console.log('SrIncrivel está entre nós.');
});