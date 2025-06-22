import { SlashCommandBuilder } from '@discordjs/builders';

export default {
    data: new SlashCommandBuilder()
        .setName('guiham')
        .setDescription('Manda mensagem para o guiham.')
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('Conteúdo da mensagem.')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const mensagem = interaction.options.getString('mensagem');
            const user = await interaction.client.users.fetch('465188039656734721');

            if (!user) {
                return interaction.reply({ content: '❌ Não foi possível encontrar o usuário especificado.', ephemeral: true });
            }

            await user.send(mensagem);
            await interaction.reply({ content: '✅ Mensagem enviada com sucesso para o guiham!', ephemeral: true });
        } catch (err) {
            console.error("Erro:", err);
            await interaction.reply({ content: `❌ Ocorreu um erro ao enviar a mensagem: ${err.message}`, ephemeral: true });
        }
    },
};
