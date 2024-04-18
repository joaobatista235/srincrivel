module.exports = {
  name: 'skip',
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("Canal nao especificado")//message.channel.send(`${client.emotes.error} | There is nothing in the queue right now!`)
    try {
      const song = await queue.skip()
      console.log("pulado")//message.channel.send(`${client.emotes.success} | Skipped! Now playing:\n${song.name}`)
    } catch (e) {
      console.log("erro: " + e)//message.channel.send(`${client.emotes.error} | ${e}`)
    }
  }
}
