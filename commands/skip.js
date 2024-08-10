module.exports = {
  name: 'skip',
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message);
    if (!queue) return console.log("Canal nao especificado")
    try {
      await queue.skip()
      console.log("Música pulada");
    } catch (e) {
      console.log("erro: " + e)
    }
  }
}
