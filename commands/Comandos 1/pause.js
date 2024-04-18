module.exports = {
  name: 'pause',
  aliases: ['pause', 'hold'],
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("fila vazia")//message.channel.send(`${client.emotes.error} | There is nothing in the queue right now!`)
    if (queue.paused) {
      queue.resume()
      return console.log("resumed")//message.channel.send('Resumed the song for you :)')
    }
    queue.pause()
    console.log("pausado")//message.channel.send('Paused the song for you :)')
  }
}
