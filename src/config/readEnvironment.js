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

  const introsValue = env.INTROS_ENABLED?.trim().toLowerCase() ?? 'true';

  if (!['true', 'false', '1', '0'].includes(introsValue)) {
    throw new Error('Configure INTROS_ENABLED como true, false, 1 ou 0.');
  }

  const introsEnabled = introsValue === 'true' || introsValue === '1';

  return Object.freeze({ token, guildId, introsEnabled });
}
