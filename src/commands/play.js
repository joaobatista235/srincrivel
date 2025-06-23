import { SlashCommandBuilder } from '@discordjs/builders';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Toca uma música.')
        .addStringOption(option =>
            option.setName('musica')
                .setDescription('Nome ou URL da música.')
                .setRequired(true)),

    async execute(interaction, distube) {
        const query = interaction.options.getString('musica');
        const voiceChannel = interaction.member?.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: "❌ Você precisa estar em um canal de voz para tocar música.", ephemeral: true });
        }

        const playAudioHandler = interaction.client.playAudioHandler;
        if (playAudioHandler && playAudioHandler.isPlayingMusic) {
            await interaction.editReply("⏳ Aguarde o áudio de entrada terminar antes de tocar música...");
            return;
        }

        try {
            await interaction.deferReply();
            await distube.play(voiceChannel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
                interaction
            });

        } catch (err) {
            console.error("Erro no DisTube:", err);

            const errorMessage = {
                'NoVoice': "❌ Já estou conectado em outro canal!",
                'InvalidURL': "❌ Link inválido ou não suportado!",
                'AgeRestricted': "❌ Conteúdo restrito por idade!",
                'PrivateVideo': "❌ Vídeo privado não pode ser reproduzido!"
            }[err.code] || `❌ Erro desconhecido: ${err.message}`;

            await interaction.editReply(errorMessage);
        }
    },
};