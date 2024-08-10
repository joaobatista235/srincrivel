module.exports = {
  name: 'stop',
  aliases: ['disconnect', 'leave'],
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("erro");

    try {
      await queue.stop();
      console.log("Música ou fila parada");
    } catch (e) {
      console.log("erro: " + e)
    }

  }
}
