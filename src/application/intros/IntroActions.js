/** Intro port: play({guildId,channelId,audio}, onEnd), stop(guildId). */
export default class IntroActions {
  constructor({ users, player, coordinator }) {
    this.users = users;
    this.player = player;
    this.coordinator = coordinator;
  }
  async onVoiceChange({ guildId, userId, channelId, previousChannelId, isBot }) {
    if (isBot || !channelId || channelId === previousChannelId) return;
    const audio = this.users[userId]?.audio;
    if (!audio) return;
    const reservation = this.coordinator.reserveIntro(guildId, channelId);
    if (!reservation) return;
    const release = () => this.coordinator.release(guildId, reservation);
    try { await this.player.play({ guildId, channelId, audio }, release); }
    catch (error) { release(); throw error; }
  }
  stop(guildId) { this.player.stop(guildId); }
}
