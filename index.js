const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();

// Load all commands from /commands folder
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
}

// Register slash commands
const commands = commandFiles.map(f => require(`./commands/${f}`).data.toJSON());
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

client.once('ready', async () => {
  console.log(`✅ البوت شغال! مسجّل كـ ${client.user.tag}`);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ تم تسجيل الأوامر!');
  } catch (err) {
    console.error('❌ خطأ في تسجيل الأوامر:', err);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ حصل خطأ!', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    const [game, action, ...args] = interaction.customId.split(':');
    const cmd = client.commands.get(game);
    if (cmd && cmd.handleButton) {
      try {
        await cmd.handleButton(interaction, action, args);
      } catch (err) {
        console.error(err);
      }
    }
  }
});
// Handle trivia messages
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const { activeSessions } = require('./commands/trivia');
  const session = activeSessions.get(message.channelId);
  if (session) {
    const trivia = require('./commands/trivia');
    await trivia.handleMessage(message, session);
  }
});
const { sessions: guessSessions } = require('./commands/guess');
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const session = guessSessions.get(message.channelId);
  if (session) {
    const guess = require('./commands/guess');
    await guess.handleMessage(message, session);
  }
});
client.login(process.env.BOT_TOKEN);
