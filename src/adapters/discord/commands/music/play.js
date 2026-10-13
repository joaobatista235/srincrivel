import { createMusicCommand } from './createMusicCommand.js';

const command = createMusicCommand('play', 'Toca uma música.');

command.data.addStringOption(option =>
  option
    .setName('musica')
    .setDescription('Nome ou URL da música.')
    .setRequired(true)
    .setMaxLength(1000),
);

export default command;
