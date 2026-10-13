export default class VoiceStateListener {
  constructor(intros) { this.intros = intros; }
  handle(oldState, newState) {
    return this.intros.onVoiceChange({ guildId: newState.guild.id, userId: newState.id,
      previousChannelId: oldState.channelId, channelId: newState.channelId,
      isBot: Boolean(newState.member?.user?.bot) });
  }
}
