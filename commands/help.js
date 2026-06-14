const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('العاب')
    .setDescription('🎮 شوف كل الألعاب المتاحة'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🎮 IMVU HUB PLAY')
      .setDescription('أهلاً بك في **IMVU HUB PLAY**!\nاكتب الأمر عشان تلعب مع الأعضاء 🕹️')
      .addFields(
        { name: '🎭 `/غميضة`',  value: 'واحد يوصّف كلمة والباقي يخمنوا' },
        { name: '🕵️ `/مافيا`',  value: 'وزّع أدوار المافيا على اللاعبين بسرية' },
        { name: '🎨 `/الوان`',   value: 'اضغط اللون الصح بأسرع ما تقدر!' },
        { name: '🔢 `/ارقام`',   value: 'خمّن الرقم السري بين 1 و 100' },
        { name: '📝 `/كلمات`',   value: 'خمّن الكلمة حرف حرف قبل ما تخلص أرواحك' },
      )
      .setFooter({ text: '🎉 IMVU HUB PLAY — بالتوفيق للجميع!' });

    await interaction.reply({ embeds: [embed] });
  },
};
