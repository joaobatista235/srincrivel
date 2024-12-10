import Discord from "discord.js";

export default {
    name: "roll",
    aliases: ["dice", "dado"],

    run: async (client, message, args) => {
        if (!args[0] || !/^\d+d\d+$/.test(args[0])) {
            return message.reply("Por favor, forneça o formato correto, como `!roll 2d6` (2 dados de 6 lados).");
        }

        const [qtdDados, tipoDado] = args[0].split("d").map(Number);

        if (qtdDados <= 0 || tipoDado <= 0 || qtdDados > 100) {
            return message.reply("O número de dados deve ser positivo e no máximo 100, e o tipo de dado deve ser maior que 0.");
        }

        const rolarDados = (qtd, tipo) => {
            const resultados = [];
            for (let i = 0; i < qtd; i++) {
                const randomSeed = Date.now() + i;
                resultados.push(Math.floor(randomComSeed(randomSeed) * tipo) + 1);
            }
            return resultados;
        };

        const resultados = rolarDados(qtdDados, tipoDado);
        const total = resultados.reduce((acc, val) => acc + val, 0);

        const embed = new Discord.EmbedBuilder()
            .setColor("Random")
            .setAuthor({ name: `${message.author.username}`, iconURL: `${message.author.displayAvatarURL()}` })
            .setTitle(`🎲 Rolando ${qtdDados} dados d${tipoDado}`)
            .addFields(
                { name: 'Resultados', value: resultados.join(' / '), inline: true },
                { name: 'Total', value: `${total}`, inline: true },
            )
            .setFooter({ text: "Boa sorte!" });

        const resultMessage = await message.channel.send("🎲 Lançando os dados...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await resultMessage.delete();

        message.channel.send({ embeds: [embed] });
    }
};

function randomComSeed(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}