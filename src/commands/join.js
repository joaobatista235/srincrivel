import { Constants } from 'discord.js';

export default {
  name: 'entrar',
  aliases: ['move'],
  run: async (client, message, args) => {
    let voiceChannel = message.member.voice.channel
    if (args[0]) {
      voiceChannel = await client.channels.fetch(args[0])
      if (!Constants.VoiceBasedChannelTypes.includes(voiceChannel?.type)) {
        return console.log("Entrou no canal")
      }
    }
    if (!voiceChannel) {
      return console.log("nao entrou no canal")
    }
    client.distube.voices.join(voiceChannel)
  }
}
