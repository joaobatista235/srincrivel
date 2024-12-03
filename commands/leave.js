export default {
  name: 'sair',
  run: async (client, message) => {
    client.distube.voices.leave(message)
  }
}
