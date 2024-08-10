const Discord = require("discord.js");

module.exports = {
    name: "roll", // Coloque o nome do seu comando
    aliases: [""], // Coloque sinônimos do nome do comando

    run: async (client, message, args) => {
        
        let stringComando = JSON.stringify(args[0])
        const stringLimpa = stringComando.replace(/[\[\]"']/g, '');
        let numeros = stringLimpa.split("d")  

        let qtdDados = parseInt(numeros[0])
        let tipoDado = parseInt(numeros[1])

        console.log("Quantidade de dados: " + qtdDados)
        console.log("Tipo do dado: " + tipoDado)

        let dados = []
        let desc = []
        let loading =     '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜'
        let loadingHalf = '🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜'
        let loadingFull = '🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩'

        for(let i = 0; i < qtdDados; i++){
            let randomSeed = Date.now() + i
            dados.push(Math.floor(randomComSeed(randomSeed) * tipoDado) + 1)
            desc.push(`🎲`)
        }

        let embed = new Discord.EmbedBuilder()
        .setColor("Random")
        .setAuthor({ name: `${message.author.username}`, iconURL: `${message.author.displayAvatarURL()}` })
        .setTitle(`Rolando ${qtdDados} dados d${tipoDado}.`)
        .addFields(
            { name: 'Dados', value: dados.join(' / '), inline: true },
        )
        .setDescription(`${desc}`);

        const result = await message.channel.send("Lançando dados...");
        
        await new Promise((resolve) => setTimeout(resolve, 1000));
        result.delete()
        message.channel.send({embeds: [embed]})

    }
}

function randomComSeed(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }