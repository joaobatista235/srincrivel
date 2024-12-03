export default {
  name: 'pause',
  aliases: ['pause', 'hold'],
  inVoiceChannel: true,
  run: async (client, message) => {
    const queue = client.distube.getQueue(message)
    if (!queue) return console.log("Fila vazia");

    if (queue.paused) {
      try{
        await queue.resume();
        return console.log("Fila despausada");
      }catch(e){
        return console.log("Erro" + e);
      }
    }

    try{
      await queue.pause();
      return console.log("Fila pausada");
    }catch(e){
      return console.log("Erro" + e);
    }
    
    
  }
}
