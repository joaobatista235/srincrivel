export default {
    name: "tocar", // Coloque o nome do seu comando
    aliases: [""], // Coloque sinônimos do nome do comando

    run: async (client, message, args) => {
        client.distube.play(message.member.voice.channel, args.join(" ")), {
            member: message.member,
            textChannel: message.channel,
            message
        }
    }
}