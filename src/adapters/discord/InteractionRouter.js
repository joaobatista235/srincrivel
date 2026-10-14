import { MessageFlags } from 'discord.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { errorMessage } from './presentation/errorMessages.js';

export default class InteractionRouter {
  constructor(registry, dependencies) {
    this.registry = registry;
    this.dependencies = dependencies;
  }

  async handleInteraction(interaction) {
    const isButton = interaction.isButton();

    if (!isButton && !interaction.isChatInputCommand()) return;

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Use este comando em um servidor.',
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const name = isButton ? interaction.customId : interaction.commandName;
    const command = this.registry.get(name);

    if (!command || (isButton && !command.button)) {
      await interaction.reply({
        content: 'Este comando ou controle não está mais disponível.',
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    try {
      if (isButton) await interaction.deferUpdate();
      else await interaction.deferReply(command.public ? {} : { flags: MessageFlags.Ephemeral });

      const response = await command.execute(interaction, this.dependencies);

      if (!isButton) await interaction.editReply(response);
    } catch (error) {
      if (!(error instanceof ApplicationError) || (error.cause && error.code !== 'NO_RELATED'))
        console.error(`Erro em /${name}:`, error);

      const content = errorMessage(error);

      if (isButton && interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [], components: [] });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  }
}
