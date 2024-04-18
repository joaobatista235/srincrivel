module.exports = {
  name: 'resume',
  aliases: ['resume', 'unpause'],
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("fila vazia")//message.channel.send(`${client.emotes.error} | There is nothing in the queue right now!`)
    if (queue.paused) {
      queue.resume()
      console.log("resumed")//message.channel.send('Resumed the song for you :)')
    } else {
      console.log("fila nao pausada")//message.channel.send('The queue is not paused!')
    }
  }
}
