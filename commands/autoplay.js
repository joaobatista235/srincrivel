module.exports = {
  name: 'autoplay',
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("Nenhuma fila encontrada")
    return queue.toggleAutoplay();
  },
}
