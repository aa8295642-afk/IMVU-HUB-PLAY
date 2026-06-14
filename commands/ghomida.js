const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ===== بيانات الghomida =====
const WORDS = {
  '🐾 حيوانات': ['قطة','كلب','أسد','فيل','زرافة','قرد','ببغاء','دلفين','بطة','دجاجة','حصان','أرنب','ثعلب','ذئب','نمر','دب','تمساح','جمل','بعير','غزال'],
  '🍕 أكل':     ['برجر','بيتزا','كشري','شاورما','فول','كبسة','سوشي','باستا','كنافة','بقلاوة','أيسكريم','شيكولاتة','تفاح','موز','فراولة','مانجو','بطيخ','عصير','كيك','تورتة'],
  '🏙️ أماكن':  ['مستشفى','مدرسة','مطعم','ملعب','سينما','مطار','فندق','شاطئ','جبل','صحراء','غابة','مسجد','متحف','سوق','حديقة','مكتبة','قلعة','برج','ميناء','محطة'],
  '👷 مهن':     ['دكتور','مهندس','معلم','شيف','طيار','شرطي','محامي','صحفي','ممثل','مغني','رياضي','نجار','سباك','كهربائي','مزارع','صياد','رسام','كاتب','مصور','فنان'],
  '📦 أشياء':  ['كرسي','طاولة','تلفزيون','هاتف','حاسوب','سيارة','دراجة','طائرة','قارب','قلم','كتاب','مفتاح','ساعة','نظارة','حقيبة','مروحة','ثلاجة','مصباح','مرآة','سكين'],
};

// تخزين مؤقت للألعاب الجارية
const activeGames = new Map();

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newRound(gameData) {
  const cats = Object.keys(WORDS);
  const cat  = getRandom(cats);
  const word = getRandom(WORDS[cat]);
  gameData.word     = word;
  gameData.category = cat;
  gameData.revealed = false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ghomida')
    .setDescription('🎭 لعبة الghomida — وصّف الكلمة بدون ما تقولها!'),

  async execute(interaction) {
    const game = {
      hostId:   interaction.user.id,
      correct:  0,
      wrong:    0,
      skipped:  0,
      word:     '',
      category: '',
      revealed: false,
    };
    newRound(game);
    activeGames.set(interaction.channelId, game);

    await interaction.reply({
      embeds: [buildEmbed(game)],
      components: buildButtons(false),
    });
  },

  async handleButton(interaction, action) {
    const game = activeGames.get(interaction.channelId);
    if (!game) {
      return interaction.reply({ content: '❌ مفيش لعبة شغالة! استخدم `/ghomida`', ephemeral: true });
    }

    // فقط المضيف يقدر يضغط
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: '⚠️ بس الشخص اللي يوصّف هو اللي يضغط!', ephemeral: true });
    }

    if (action === 'reveal') {
      game.revealed = true;
      await interaction.update({
        embeds: [buildEmbed(game)],
        components: buildButtons(true),
      });
      return;
    }

    if (action === 'correct') { game.correct++; }
    if (action === 'wrong')   { game.wrong++;   }
    if (action === 'skip')    { game.skipped++; }

    newRound(game);
    await interaction.update({
      embeds: [buildEmbed(game)],
      components: buildButtons(false),
    });
  },
};

function buildEmbed(game) {
  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('🎭 لعبة الghomida')
    .setDescription(
      `> 📂 الفئة: **${game.category}**\n\n` +
      `**الكلمة:**\n` +
      (game.revealed
        ? `# \`${game.word}\``
        : `||${game.word}||  ← اضغط "كشف" عشان الموصّف يشوفها`)
    )
    .addFields(
      { name: '✅ صح',   value: `${game.correct}`,  inline: true },
      { name: '❌ غلط',  value: `${game.wrong}`,    inline: true },
      { name: '⏭️ تخطي', value: `${game.skipped}`,  inline: true },
    )
    .setFooter({ text: 'الكلمة مخفية — اضغط "كشف" أولاً ثم وصّف!' });
}

function buildButtons(revealed) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ghomida:reveal')
      .setLabel(revealed ? '✅ تم الكشف' : '👁️ كشف الكلمة')
      .setStyle(revealed ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(revealed),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ghomida:correct').setLabel('✅ صح').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ghomida:wrong').setLabel('❌ غلط').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ghomida:skip').setLabel('⏭️ تخطي').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}
