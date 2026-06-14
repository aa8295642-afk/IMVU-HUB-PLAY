const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const COLORS = [
  { name: 'أحمر',     emoji: '🔴' },
  { name: 'أزرق',     emoji: '🔵' },
  { name: 'أخضر',     emoji: '🟢' },
  { name: 'أصفر',     emoji: '🟡' },
  { name: 'برتقالي',  emoji: '🟠' },
  { name: 'بنفسجي',   emoji: '🟣' },
  { name: 'أبيض',     emoji: '⚪' },
  { name: 'أسود',     emoji: '⚫' },
  { name: 'بني',      emoji: '🟤' },
  { name: 'وردي',     emoji: '🩷' },
  { name: 'سماوي',    emoji: '🩵' },
  { name: 'رمادي',    emoji: '🩶' },
];

const sessions = new Map();

function getRandom(arr, count) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

function newRound(session) {
  const picked  = getRandom(COLORS, Math.min(6, 4 + Math.floor(session.level / 2)));
  session.target  = picked[0];
  session.options = picked.sort(() => Math.random() - 0.5);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('colors')
    .setDescription('🎨 لعبة الألوان — اضغط اللون الصح بسرعة!'),

  async execute(interaction) {
    const session = {
      hostId:  interaction.user.id,
      score:   0,
      streak:  0,
      level:   1,
      target:  null,
      options: [],
    };
    newRound(session);
    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds:     [buildEmbed(session)],
      components: buildButtons(session),
    });
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ ابدأ لعبة جديدة بـ `/colors`', ephemeral: true });

    const correct = action === session.target.name;

    if (correct) {
      const bonus     = session.streak * 2;
      session.score  += 10 + bonus;
      session.streak++;
      if (session.streak % 5 === 0) session.level++;
    } else {
      session.streak = 0;
    }

    newRound(session);

    await interaction.update({
      embeds:     [buildEmbed(session, correct ? '✅ صح! +نقاط' : '❌ غلط!')],
      components: buildButtons(session),
    });
  },
};

function buildEmbed(session, feedback = '') {
  return new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('🎨 لعبة الألوان')
    .setDescription(
      `اضغط على: **${session.target.emoji} ${session.target.name}**\n\n` +
      (feedback ? `> ${feedback}\n\n` : '')
    )
    .addFields(
      { name: '⭐ النقاط',    value: `${session.score}`,  inline: true },
      { name: '🔥 السلسلة',  value: `${session.streak}`, inline: true },
      { name: '📊 المستوى',  value: `${session.level}`,  inline: true },
    )
    .setFooter({ text: 'كل إجابة صح تكسب نقاط إضافية مع السلسلة!' });
}

function buildButtons(session) {
  const row = new ActionRowBuilder();
  session.options.forEach(c => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`colors:${c.name}`)
        .setLabel(`${c.emoji} ${c.name}`)
        .setStyle(ButtonStyle.Secondary)
    );
  });
  return [row];
}
