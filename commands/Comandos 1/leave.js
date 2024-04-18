module.exports = {
  name: 'sair',
  run: async (client, message) => {
    client.distube.voices.leave(message)
  }
}
