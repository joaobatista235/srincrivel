import { SlashCommandBuilder } from '@discordjs/builders';
import Discord from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola um dado com o formato `xdy` (ex: `2d6`)')
        .addStringOption(option =>
            option.setName('dados')
                .setDescription('Formato dos dados (ex: 2d6)')
                .setRequired(true)),

    async execute(interaction) {
        const dados = interaction.options.getString('dados');
        if (!/^\d+d\d+$/.test(dados)) {
            return interaction.reply({ content: "❌ Por favor, forneça o formato correto, como `2d6` (2 dados de 6 lados).", ephemeral: true });
        }

        const [qtdDados, tipoDado] = dados.split('d').map(Number);

        if (qtdDados <= 0 || tipoDado <= 0 || qtdDados > 100) {
            return interaction.reply({ content: "❌ O número de dados deve ser positivo e no máximo 100, e o tipo de dado deve ser maior que 0.", ephemeral: true });
        }

        const resultados = rolarDados(qtdDados, tipoDado);
        const total = resultados.reduce((acc, val) => acc + val, 0);

        const embed = new Discord.EmbedBuilder()
            .setColor("Random")
            .setAuthor({ name: `${interaction.user.username}`, iconURL: `${interaction.user.displayAvatarURL()}` })
            .setTitle(`🎲 Rolando ${qtdDados} dados d${tipoDado}`)
            .addFields(
                { name: 'Resultados', value: resultados.join(' / '), inline: true },
                { name: 'Total', value: `${total}`, inline: true },
            )
            .setFooter({ text: "Boa sorte!" });

        await interaction.reply({ content: "🎲 Lançando os dados...", ephemeral: true });

        await interaction.followUp({ embeds: [embed] });
    },
};

function rolarDados(qtd, tipo) {
    const resultados = [];
    for (let i = 0; i < qtd; i++) {
        const randomSeed = Date.now() + i;
        resultados.push(Math.floor(randomComSeed(randomSeed) * tipo) + 1);
    }
    return resultados;
}

function randomComSeed(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
