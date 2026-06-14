const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

const EMOJIS = ['🍎','🍌','🍇','🍓','🍑','🥝','🍋','🍊','🍉','🍒','🥭','🍍','🥥','🍆','🥑','🌽','🥕','🍄','🌸','⭐','🔥','💎','🎯','🎸','🚀','🦁','🐯','🦊','🐸','🦋'];

function generateSequence(level) {
  const count = 3 + level;
  const seq = [];
  for (let i = 0; i < count; i++) {
    seq.push(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  }
  return seq;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('🧠 تحدي الذاكرة — احفظ التسلسل وكرره!'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل!', ephemeral: true });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🧠 تحدي الذاكرة!')
        .setDescription(
          '**طريقة اللعب:**\n\n' +
          '👀 هتشوف تسلسل من الإيموجيز لمدة **5 ثواني**\n' +
          '🧠 احفظهم كويس!\n' +
          '✅ بعدين اضغط عليهم **بنفس الترتيب**\n' +
          '🏆 كل مرحلة تسلسل أطول!\n\n' +
          '**المراحل:**\n' +
          '• مرحلة 1: 4 إيموجيز\n' +
          '• مرحلة 2: 5 إيموجيز\n' +
          '• مرحلة 3: 6 إيموجيز\n' +
          '• وهكذا...\n\n' +
          '*اضغط ابدأ!* 👇'
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('memory:start')
          .setLabel('🧠 ابدأ التحدي!')
          .setStyle(ButtonStyle.Primary),
      )],
    });
  },

  async handleButton(interaction, action) {
    // بدء اللعبة
    if (action === 'start') {
      if (sessions.has(interaction.channelId)) {
        return interaction.reply({ content: '⚠️ في لعبة شغالة!', ephemeral: true });
      }

      const session = {
        playerId: interaction.user.id,
        channelId: interaction.channelId,
        level: 1,
        sequence: [],
        playerInput: [],
        phase: 'showing',
        scores: {},
      };

      session.sequence = generateSequence(session.level);
      sessions.set(interaction.channelId, session);

      // اعرض التسلسل
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle(`🧠 المرحلة ${session.level}`)
          .setDescription(
            `احفظ التسلسل ده!\n\n` +
            `# ${session.sequence.join('  ')}\n\n` +
            `⏱️ عندك **5 ثواني** تحفظهم!`
          )
        ],
        components: [],
      });

      // بعد 5 ثواني اخفي التسلسل
      setTimeout(async () => {
        session.phase = 'input';
        session.playerInput = [];

        const uniqueEmojis = [...new Set(session.sequence)];
        const allEmojis = [...uniqueEmojis];

        // زود إيموجيز تانية مش في التسلسل
        while (allEmojis.length < Math.min(12, uniqueEmojis.length + 4)) {
          const e = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
          if (!allEmojis.includes(e)) allEmojis.push(e);
        }

        // خلط
        allEmojis.sort(() => Math.random() - 0.5);
        session.emojiOptions = allEmojis;

        try {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xf59e0b)
              .setTitle(`🧠 المرحلة ${session.level} - اضغط بالترتيب!`)
              .setDescription(
                `اضغط على الإيموجيز **بنفس الترتيب** اللي شفته!\n\n` +
                `التقدم: ${session.playerInput.map(() => '✅').join('') || '⬜'.repeat(session.sequence.length)}\n` +
                `(${session.playerInput.length}/${session.sequence.length})`
              )
            ],
            components: buildEmojiButtons(allEmojis, session.level),
          });
        } catch (e) {
          console.error(e);
        }
      }, 5000);

      return;
    }

    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة!', ephemeral: true });

    if (session.phase !== 'input') return interaction.reply({ content: '⚠️ استنى!', ephemeral: true });

    // لعب متعدد
    if (!session.scores[interaction.user.id]) {
      session.scores[interaction.user.id] = { name: interaction.user.username, score: 0 };
    }

    // اختيار إيموجي
    if (action.startsWith('emoji_')) {
      const emoji = action.replace('emoji_', '');
      session.playerInput.push(emoji);

      const pos = session.playerInput.length - 1;
      const correct = session.sequence[pos] === emoji;

      if (!correct) {
        // غلط!
        sessions.delete(session.channelId);

        const leaderboard = Object.values(session.scores)
          .sort((a, b) => b.score - a.score)
          .map((p, i) => `${['🥇','🥈','🥉'][i] || '🏅'} **${p.name}** - ${p.score} نقطة`)
          .join('\n') || 'لا يوجد';

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('❌ غلط!')
            .setDescription(
              `**${interaction.user.username}** ضغط على ${emoji} بدل ${session.sequence[pos]}!\n\n` +
              `التسلسل الصح كان:\n# ${session.sequence.join('  ')}\n\n` +
              `**الترتيب النهائي:**\n${leaderboard}`
            )
          ],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('memory:start')
              .setLabel('🔄 العب تاني')
              .setStyle(ButtonStyle.Primary),
          )],
        });
        return;
      }

      // كل الإجابات صح
      if (session.playerInput.length === session.sequence.length) {
        // نقطة للي جاوب
        session.scores[interaction.user.id].score += session.level * 10;
        session.level++;
        session.sequence = generateSequence(session.level);
        session.playerInput = [];
        session.phase = 'showing';

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle(`✅ صح! المرحلة ${session.level}`)
            .setDescription(
              `🎉 **${interaction.user.username}** صح!\n\n` +
              `احفظ التسلسل الجديد!\n\n` +
              `# ${session.sequence.join('  ')}\n\n` +
              `⏱️ عندك **5 ثواني**!`
            )
          ],
          components: [],
        });

        setTimeout(async () => {
          session.phase = 'input';
          session.playerInput = [];

          const uniqueEmojis = [...new Set(session.sequence)];
          const allEmojis = [...uniqueEmojis];
          while (allEmojis.length < Math.min(12, uniqueEmojis.length + 4)) {
            const e = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            if (!allEmojis.includes(e)) allEmojis.push(e);
          }
          allEmojis.sort(() => Math.random() - 0.5);
          session.emojiOptions = allEmojis;

          try {
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle(`🧠 المرحلة ${session.level} - اضغط بالترتيب!`)
                .setDescription(
                  `اضغط على الإيموجيز **بنفس الترتيب**!\n\n` +
                  `⬜`.repeat(session.sequence.length) + `\n` +
                  `(0/${session.sequence.length})`
                )
              ],
              components: buildEmojiButtons(allEmojis, session.level),
            });
          } catch (e) {
            console.error(e);
          }
        }, 5000);

        return;
      }

      // تحديث التقدم
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle(`🧠 المرحلة ${session.level} - اضغط بالترتيب!`)
          .setDescription(
            `اضغط على الإيموجيز **بنفس الترتيب**!\n\n` +
            `${'✅'.repeat(session.playerInput.length)}${'⬜'.repeat(session.sequence.length - session.playerInput.length)}\n` +
            `(${session.playerInput.length}/${session.sequence.length})`
          )
        ],
        components: buildEmojiButtons(session.emojiOptions, session.level),
      });
      return;
    }
  },
};

function buildEmojiButtons(emojis, level) {
  const rows = [];
  const perRow = 4;
  for (let i = 0; i < emojis.length; i += perRow) {
    const row = new ActionRowBuilder();
    for (let j = i; j < Math.min(i + perRow, emojis.length); j++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`memory:emoji_${emojis[j]}`)
          .setLabel(emojis[j])
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
    if (rows.length >= 4) break;
  }
  return rows;
}
