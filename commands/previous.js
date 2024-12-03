export default {
  name: 'previous',
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message);
    
    if (!queue) return console.log("Fila vazia");
    try{
      const song = queue.previous()
      console.log("Música anterior");
    }catch(e){
      console.log("Nenhuma musica anterior");
    }
  }
}
