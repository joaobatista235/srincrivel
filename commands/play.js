export default {
  name: 'tocar',
  aliases: ['p'],
  inVoiceChannel: true,
  run: async (client, message, args) => {
    const string = args.join(' ')
    if (!string) return message.channel.send(`${client.emotes.error} | Please enter a song url or query to search.`)

    try {
      client.distube.play(message.member.voice.channel, string, {
        member: message.member,
        textChannel: message.channel,
        message
      });
    } catch (err) {
      console.error("Erro ao tentar tocar a música:", err);
      return message.channel.send(`Erro ao tentar tocar a música: ${err.message}`);
    }
  }
}