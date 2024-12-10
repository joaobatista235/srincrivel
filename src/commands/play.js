export default {
  name: 'tocar',
  aliases: ['play'],
  run: async (client, message, args) => {
    const query = args.join(' ');
    if (!query) {
      return message.reply("❌ Por favor, insira uma URL ou o nome da música para tocar.");
    }

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      return message.reply("❌ Você precisa estar em um canal de voz para tocar música.");
    }

    try {
      await client.distube.play(voiceChannel, query, {
        member: message.member,
        textChannel: message.channel,
        message,
      });

      message.reply(`🎶 Tocando: \`${query}\``);
    } catch (err) {
      console.error("Erro ao tentar tocar a música:", err);
      message.reply(`❌ Ocorreu um erro ao tentar tocar a música: ${err.message}`);
    }
  },
};
