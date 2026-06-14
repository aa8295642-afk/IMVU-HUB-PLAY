const {
  SlashCommandBuilder, EmbedBuilder,
} = require('discord.js');

const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('🔢 خمّن الرقم! البوت عنده رقم من 1 لـ 100'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل!', ephemeral: true });
    }

    const number = Math.floor(Math.random() * 100) + 1;
    const session = {
      number,
      attempts: {},
      totalAttempts: 0,
      maxAttempts: 10,
      channelId: interaction.channelId,
      timeout: null,
    };

    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🔢 خمّن الرقم!')
        .setDescription(
          'اخترت رقم من **1 لـ 100** 🤫\n\n' +
          'اكتب رقمك في الشات!\n' +
          `عندكم **${session.maxAttempts} محاولات** مجموعة\n\n` +
          '⬆️ = رقمك أكبر من الصح\n' +
          '⬇️ = رقمك أصغر من الصح'
        )
        .setFooter({ text: 'اكتب رقم من 1 لـ 100!' })
      ],
    });

    // timeout بعد 2 دقيقة
    session.timeout = setTimeout(async () => {
      if (sessions.has(interaction.channelId)) {
        sessions.delete(interaction.channelId);
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('⏰ انتهى الوقت!')
            .setDescription(`الرقم كان **${number}** 😅`)
          ],
        });
      }
    }, 120000);
  },

  async handleMessage(message, session) {
    const num = parseInt(message.content);
    if (isNaN(num) || num < 1 || num > 100) return;

    session.totalAttempts++;
    session.attempts[message.author.id] = (session.attempts[message.author.id] || 0) + 1;

    if (num === session.number) {
      clearTimeout(session.timeout);
      sessions.delete(session.channelId);

      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('🎉 صح!')
          .setDescription(
            `**${message.author.username}** عرفها! الرقم كان **${session.number}** 🎊\n\n` +
            `المحاولات: **${session.totalAttempts}**`
          )
        ],
      });
    } else if (session.totalAttempts >= session.maxAttempts) {
      clearTimeout(session.timeout);
      sessions.delete(session.channelId);

      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('💥 خلصت المحاولات!')
          .setDescription(`الرقم كان **${session.number}** 😅\nالعبوا تاني بـ /guess`)
        ],
      });
    } else {
      const remaining = session.maxAttempts - session.totalAttempts;
      const hint = num > session.number ? '⬇️ أصغر!' : '⬆️ أكبر!';

      await message.reply(
        `${hint} متبقي **${remaining} محاولات**`
      );
    }
  },
};

module.exports.sessions = sessions;
