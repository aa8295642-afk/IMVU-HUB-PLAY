const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('✊ حجر ورقة مقص بين لاعبين!')
    .addUserOption(opt =>
      opt.setName('opponent')
        .setDescription('اختار خصمك')
        .setRequired(true)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');

    if (opponent.bot) return interaction.reply({ content: '❌ مينفعش تلعب مع بوت!', ephemeral: true });
    if (opponent.id === interaction.user.id) return interaction.reply({ content: '❌ مينفعش تلعب مع نفسك!', ephemeral: true });

    const session = {
      players: [interaction.user, opponent],
      choices: { [interaction.user.id]: null, [opponent.id]: null },
      channelId: interaction.channelId,
    };

    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('✊ حجر ورقة مقص!')
        .setDescription(
          `${interaction.user} **vs** ${opponent}\n\n` +
          `الاتنين يضغطوا اختيارهم! الاختيار مخفي لحد ما الاتنين يختاروا 🤫`
        )
      ],
      components: [buildButtons()],
    });
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة شغالة!', ephemeral: true });

    const isPlayer = session.players.some(p => p.id === interaction.user.id);
    if (!isPlayer) return interaction.reply({ content: '⚠️ انت مش في اللعبة دي!', ephemeral: true });

    if (session.choices[interaction.user.id]) {
      return interaction.reply({ content: '✅ انت اخترت بالفعل! استنى الثاني.', ephemeral: true });
    }

    session.choices[interaction.user.id] = action;
    await interaction.reply({ content: `✅ اخترت **${getEmoji(action)}** - استنى الثاني!`, ephemeral: true });

    // لو الاتنين اختاروا
    const [p1, p2] = session.players;
    const c1 = session.choices[p1.id];
    const c2 = session.choices[p2.id];

    if (c1 && c2) {
      sessions.delete(session.channelId);
      const result = getResult(c1, c2);

      let winner = '';
      if (result === 1) winner = `🎉 **${p1.username}** فاز!`;
      else if (result === 2) winner = `🎉 **${p2.username}** فاز!`;
      else winner = '🤝 **تعادل!**';

      const channel = interaction.channel;
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor(result === 0 ? 0xf59e0b : 0x10b981)
          .setTitle('✊ النتيجة!')
          .setDescription(
            `${p1.username}: **${getEmoji(c1)}**\n` +
            `${p2.username}: **${getEmoji(c2)}**\n\n` +
            winner
          )
        ],
      });
    }
  },
};

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps:rock').setLabel('✊ حجر').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rps:paper').setLabel('📄 ورقة').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rps:scissors').setLabel('✂️ مقص').setStyle(ButtonStyle.Danger),
  );
}

function getEmoji(choice) {
  return { rock: '✊ حجر', paper: '📄 ورقة', scissors: '✂️ مقص' }[choice];
}

function getResult(c1, c2) {
  if (c1 === c2) return 0;
  if (
    (c1 === 'rock' && c2 === 'scissors') ||
    (c1 === 'scissors' && c2 === 'paper') ||
    (c1 === 'paper' && c2 === 'rock')
  ) return 1;
  return 2;
}
