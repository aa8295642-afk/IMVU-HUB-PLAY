const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const WORDS = [
  { word: 'برتقال',  hint: 'فاكهة حمضية برتقالية اللون' },
  { word: 'مستشفى', hint: 'مكان يعالج فيه المرضى' },
  { word: 'طائرة',  hint: 'وسيلة نقل تطير في السماء' },
  { word: 'شاطئ',   hint: 'مكان جميل بجانب البحر' },
  { word: 'مكتبة',  hint: 'مكان فيه كتب كثيرة' },
  { word: 'تمساح',  hint: 'زواحف ضخمة تعيش في الأنهار' },
  { word: 'عصفور',  hint: 'طائر صغير يغني' },
  { word: 'بطريق',  hint: 'طائر لا يطير ويعيش في الجليد' },
  { word: 'صحراء',  hint: 'منطقة جافة ورمالها كثيرة' },
  { word: 'قلعة',   hint: 'حصن قديم فيه أبراج' },
  { word: 'نافورة', hint: 'ماء يتدفق للأعلى في الحدائق' },
  { word: 'غيتار',  hint: 'آلة موسيقية وترية' },
  { word: 'دولفين', hint: 'حيوان بحري ذكي وودود' },
  { word: 'بركان',  hint: 'جبل يثور وينفث الحمم' },
  { word: 'خيمة',   hint: 'مأوى مؤقت من القماش' },
  { word: 'فلفل',   hint: 'توابل تجعل الأكل حاراً' },
  { word: 'مطبخ',   hint: 'غرفة الطبخ في البيت' },
  { word: 'جسور',   hint: 'تربط بين ضفتين فوق الماء' },
  { word: 'مزرعة',  hint: 'مكان تربية الحيوانات والزراعة' },
  { word: 'حديقة',  hint: 'مكان جميل فيه أشجار وزهور' },
];

const ARABIC_LETTERS = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي';
const MAX_LIVES = 6;
const GALLOWS = ['😵', '😨', '😟', '😬', '😐', '🙂', '😀'];

const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('كلمات')
    .setDescription('📝 لعبة الكلمات — خمّن الكلمة حرف حرف!'),

  async execute(interaction) {
    const chosen = WORDS[Math.floor(Math.random() * WORDS.length)];
    const session = {
      word:    chosen.word,
      hint:    chosen.hint,
      guessed: new Set(),
      lives:   MAX_LIVES,
      score:   0,
      streak:  0,
    };
    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds:     [buildEmbed(session)],
      components: buildAlphabetButtons(session),
    });
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ ابدأ لعبة بـ `/كلمات`', ephemeral: true });

    if (action === 'new') {
      const chosen = WORDS[Math.floor(Math.random() * WORDS.length)];
      session.word    = chosen.word;
      session.hint    = chosen.hint;
      session.guessed = new Set();
      session.lives   = MAX_LIVES;
      return interaction.update({
        embeds:     [buildEmbed(session)],
        components: buildAlphabetButtons(session),
      });
    }

    const letter = action;
    if (session.guessed.has(letter)) return;
    session.guessed.add(letter);

    const correct = session.word.includes(letter);
    if (!correct) session.lives--;

    const won  = session.word.split('').every(l => session.guessed.has(l));
    const lost = session.lives <= 0;

    if (won) {
      session.score  += 20 + session.streak * 5;
      session.streak++;
    } else if (lost) {
      session.streak = 0;
    }

    const embed = buildEmbed(session, won ? '🎉 فزت!' : lost ? `😵 خسرت! الكلمة كانت: ${session.word}` : '');
    const components = (won || lost) ? [buildNewBtn()] : buildAlphabetButtons(session);

    await interaction.update({ embeds: [embed], components });
    if (won || lost) sessions.delete(interaction.channelId);
  },
};

function buildEmbed(session, feedback = '') {
  const display = session.word.split('').map(l =>
    session.guessed.has(l) ? `**${l}**` : `\\_`
  ).join('  ');

  const wrongLetters = [...session.guessed].filter(l => !session.word.includes(l));
  const livesEmoji   = GALLOWS[session.lives] || '😵';

  return new EmbedBuilder()
    .setColor(feedback.includes('فزت') ? 0x10b981 : feedback.includes('خسرت') ? 0xef4444 : 0x3b82f6)
    .setTitle('📝 لعبة الكلمات')
    .setDescription(
      `💡 **تلميح:** ${session.hint}\n\n` +
      `${display}\n\n` +
      (feedback ? `> ${feedback}\n\n` : '') +
      (wrongLetters.length > 0 ? `❌ حروف خاطئة: ${wrongLetters.join(' ')}` : '')
    )
    .addFields(
      { name: `${livesEmoji} الأرواح`, value: `${'❤️'.repeat(session.lives)}${'🖤'.repeat(MAX_LIVES - session.lives)}`, inline: true },
      { name: '⭐ النقاط',           value: `${session.score}`,  inline: true },
      { name: '🔥 السلسلة',          value: `${session.streak}`, inline: true },
    )
    .setFooter({ text: 'اضغط على حرف للتخمين!' });
}

function buildAlphabetButtons(session) {
  const rows   = [];
  const letters = ARABIC_LETTERS.split('');
  const chunks  = [];
  for (let i = 0; i < letters.length; i += 5) chunks.push(letters.slice(i, i + 5));

  for (const chunk of chunks.slice(0, 5)) {
    const row = new ActionRowBuilder();
    for (const l of chunk) {
      const used    = session.guessed.has(l);
      const correct = session.word.includes(l);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`كلمات:${l}`)
          .setLabel(l)
          .setStyle(used ? (correct ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary)
          .setDisabled(used)
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildNewBtn() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('كلمات:new').setLabel('🔄 كلمة جديدة').setStyle(ButtonStyle.Primary),
  );
}
