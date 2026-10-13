const SNOWFLAKE = /^\d{17,20}$/;

export function readEnvironment(env = process.env) {
  if (Number(process.versions.node.split('.')[0]) !== 26) {
    throw new Error('Este projeto requer Node.js 26.');
  }
  const token = env.TOKEN?.trim();
  const guildId = env.GUILD_ID?.trim();
  if (!token) throw new Error('Configure TOKEN no arquivo .env.');
  if (!guildId || !SNOWFLAKE.test(guildId)) {
    throw new Error('Configure GUILD_ID com o ID do servidor Discord.');
  }
  return Object.freeze({ token, guildId });
}
