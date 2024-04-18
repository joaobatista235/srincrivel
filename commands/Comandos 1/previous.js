module.exports = {
  name: 'previous',
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("previous")//message.channel.send(`${client.emotes.error} | There is nothing in the queue right now!`)
    try{
      const song = queue.previous()
      console.log("previous")//message.channel.send(`${client.emotes.success} | Now playing:\n${song.name}`)
    }catch(e){
      console.log("Nenhuma musica anterior")
    }
  }
}
