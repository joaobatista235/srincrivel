class CommandHandler {
    constructor(client) {
        this.client = client;
    }

    async handleCommand(message, args) {
        const cmd = args.shift().toLowerCase();
        let command = this.client.commands.get(cmd) || this.client.commands.get(this.client.aliases.get(cmd));

        if (!command) return;

        try {
            await command.run(this.client, message, args);
        } catch (err) {
            console.error('Erro ao executar o comando:', err);
            message.reply('Ocorreu um erro ao executar esse comando.');
        }
    }
}

export default CommandHandler;
