const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map(); // channelId -> session

module.exports = {
  data: new SlashCommandBuilder()
    .setName('مافيا')
    .setDescription('🕵️ لعبة المافيا — وزّع الأدوار على اللاعبين!')
    .addStringOption(opt =>
      opt.setName('لاعبين')
        .setDescription('أسماء اللاعبين مفصولة بفاصلة مثل: أحمد,سارة,محمد,علي')
        .setRequired(true)
    ),

  async execute(interaction) {
    const raw     = interaction.options.getString('لاعبين');
    const players = raw.split(/[,،]/).map(s => s.trim()).filter(Boolean);

    if (players.length < 4) {
      return interaction.reply({ content: '❌ تحتاج 4 لاعبين على الأقل!', ephemeral: true });
    }

    // توزيع الأدوار
    const roles   = assignRoles(players);
    const pending = new Set(players.map((_, i) => i)); // اللاعبون اللي لسه ما شافوش دورهم

    sessions.set(interaction.channelId, { players, roles, pending, hostId: interaction.user.id });

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🕵️ لعبة المافيا — توزيع الأدوار')
      .setDescription(
        `تم توزيع الأدوار على **${players.length}** لاعب!\n\n` +
        `كل لاعب يضغط زر اسمه **بسرية** عشان يشوف دوره في رسالة خاصة.\n\n` +
        `**اللاعبون:**\n${players.map((p, i) => `> 🎴 ${p}`).join('\n')}`
      )
      .setFooter({ text: 'اضغط اسمك لتكشف دورك — لا تخلي أحد يشوف!' });

    const rows = buildPlayerButtons(players, pending);
    await interaction.reply({ embeds: [embed], components: rows });
  },

  async handleButton(interaction, action, args) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة!', ephemeral: true });

    if (action === 'reveal') {
      const idx  = parseInt(args[0]);
      const name = session.players[idx];
      const role = session.roles[idx];

      // تأكد إن اللاعب يكشف دوره بس
      // (اختياري: تقدر تربطه بـ user ID لو اللاعبين مسجلين)

      session.pending.delete(idx);

      const roleInfo = ROLES[role];
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(roleInfo.color)
            .setTitle(`${roleInfo.emoji} دورك: ${role}`)
            .setDescription(roleInfo.desc)
            .setFooter({ text: `🔒 هذه الرسالة سرية — لا تشارك دورك!` })
        ],
        ephemeral: true,
      });

      // لو الكل شاف دوره، نحدّث الرسالة
      if (session.pending.size === 0) {
        await interaction.message.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0x10b981)
              .setTitle('✅ الكل شاف دوره!')
              .setDescription('اللعبة جاهزة تبدأ!\n\n**قواعد سريعة:**\n> 🌙 **ليل** — المافيا يختاروا ضحية، المحقق يكشف، الطبيب ينقذ\n> ☀️ **نهار** — الكل يناقش ويصوت على إعدام مشتبه به\n> 🏆 **فوز المدنيين** — لو قضوا على المافيا كلها\n> 💀 **فوز المافيا** — لو بقوا مساويين للمدنيين')
              .setFooter({ text: '🎮 IMVU HUB PLAY — بالتوفيق للجميع!' })
          ],
          components: [],
        });
        sessions.delete(interaction.channelId);
      } else {
        // تحديث الأزرار (احذف اللاعبين اللي كشفوا)
        const rows = buildPlayerButtons(session.players, session.pending);
        await interaction.message.edit({ components: rows });
      }
    }
  },
};

// ===== الأدوار =====
const ROLES = {
  'مافيا':  { emoji: '🔪', color: 0xef4444, desc: 'أنت **مافيا**! كل ليلة تتفق مع زملاءك سراً على قتل مدني واحد. هدفك القضاء على المدنيين.' },
  'محقق':   { emoji: '🔍', color: 0xf59e0b, desc: 'أنت **المحقق**! كل ليلة تكشف هوية لاعب واحد. استخدم المعلومات بذكاء لمساعدة المدنيين.' },
  'طبيب':   { emoji: '💊', color: 0x10b981, desc: 'أنت **الطبيب**! كل ليلة تختار شخصاً لحمايته من القتل — حتى نفسك مرة واحدة.' },
  'مدني':   { emoji: '🙂', color: 0x3b82f6, desc: 'أنت **مدني**! استخدم حدسك وذكاءك في النهار لكشف المافيا قبل فوات الأوان.' },
};

function assignRoles(players) {
  const shuffled = [...players].map((_, i) => i).sort(() => Math.random() - 0.5);
  const roles    = new Array(players.length).fill('مدني');
  const mafiaCount = Math.max(1, Math.floor(players.length / 4));
  let idx = 0;

  for (let i = 0; i < mafiaCount; i++) roles[shuffled[idx++]] = 'مافيا';
  if (idx < shuffled.length) roles[shuffled[idx++]] = 'محقق';
  if (idx < shuffled.length) roles[shuffled[idx++]] = 'طبيب';

  return roles;
}

function buildPlayerButtons(players, pending) {
  const rows = [];
  let current = null;

  players.forEach((p, i) => {
    if (!current || current.components.length === 5) {
      current = new ActionRowBuilder();
      rows.push(current);
    }
    current.addComponents(
      new ButtonBuilder()
        .setCustomId(`مافيا:reveal:${i}`)
        .setLabel(pending.has(i) ? `🎴 ${p}` : `✅ ${p}`)
        .setStyle(pending.has(i) ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(!pending.has(i))
    );
  });

  return rows.slice(0, 5); // Discord max 5 rows
}
