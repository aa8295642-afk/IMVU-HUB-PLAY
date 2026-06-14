const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ارقام')
    .setDescription('🔢 خمّن الرقم السري بين 1 و 100!'),

  async execute(interaction) {
    const session = {
      secret:   Math.floor(Math.random() * 100) + 1,
      attempts: 0,
      min:      1,
      max:      100,
      history:  [],
    };
    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds:     [buildEmbed(session)],
      components: [buildButtons()],
    });
  },

  async handleButton(interaction, action) {
    if (action === 'guess') {
      // افتح modal للإدخال
      const modal = new ModalBuilder()
        .setCustomId('ارقام:modal')
        .setTitle('🔢 أدخل تخمينك')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('guess_input')
              .setLabel('رقم بين 1 و 100')
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(3)
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    if (action === 'new') {
      const session = {
        secret:   Math.floor(Math.random() * 100) + 1,
        attempts: 0,
        min:      1,
        max:      100,
        history:  [],
      };
      sessions.set(interaction.channelId, session);
      return interaction.update({
        embeds:     [buildEmbed(session)],
        components: [buildButtons()],
      });
    }

    // Quick guess buttons (low / mid / high)
    const session = sessions.get(interaction.channelId);
    if (!session) return;
    const guess = parseInt(action);
    if (!isNaN(guess)) await processGuess(interaction, session, guess, true);
  },
};

// معالجة الـ modal
const originalExecute = module.exports.execute;
module.exports.handleModal = async (interaction) => {
  const session = sessions.get(interaction.channelId);
  if (!session) return interaction.reply({ content: '❌ ابدأ لعبة جديدة بـ `/ارقام`', ephemeral: true });
  const guess = parseInt(interaction.fields.getTextInputValue('guess_input'));
  if (isNaN(guess) || guess < 1 || guess > 100) {
    return interaction.reply({ content: '❌ أدخل رقم بين 1 و 100!', ephemeral: true });
  }
  await processGuess(interaction, session, guess, false);
};

async function processGuess(interaction, session, guess, isUpdate) {
  session.attempts++;
  session.history.unshift(`${guess}`);
  if (session.history.length > 5) session.history.pop();

  let result;
  if (guess === session.secret) {
    result = 'win';
  } else if (guess < session.secret) {
    result = 'low';
    session.min = Math.max(session.min, guess + 1);
  } else {
    result = 'high';
    session.max = Math.min(session.max, guess - 1);
  }

  const embed  = buildEmbed(session, guess, result);
  const components = result === 'win' ? [buildNewGameBtn()] : [buildButtons(session)];

  if (isUpdate) {
    await interaction.update({ embeds: [embed], components });
  } else {
    await interaction.update({ embeds: [embed], components }).catch(() =>
      interaction.reply({ embeds: [embed], components })
    );
  }

  if (result === 'win') sessions.delete(interaction.channelId);
}

function buildEmbed(session, lastGuess, result) {
  let desc = `🎯 خمّن الرقم السري بين **${session.min}** و **${session.max}**\n\n`;

  if (result === 'win') {
    desc = `🎉 **وجدته!** الرقم كان **${session.secret}** في **${session.attempts}** محاولة!\n\n`;
  } else if (result === 'low') {
    desc += `⬆️ **${lastGuess}** صغير — الرقم أكبر!\n`;
  } else if (result === 'high') {
    desc += `⬇️ **${lastGuess}** كبير — الرقم أصغر!\n`;
  }

  if (session.history.length > 0) {
    desc += `\n📋 **آخر تخمينات:** ${session.history.join(' ← ')}`;
  }

  return new EmbedBuilder()
    .setColor(result === 'win' ? 0x10b981 : result === 'low' ? 0xf59e0b : result === 'high' ? 0x3b82f6 : 0xf59e0b)
    .setTitle('🔢 خمّن الرقم')
    .setDescription(desc)
    .addFields({ name: '🔄 المحاولات', value: `${session.attempts}`, inline: true },
               { name: '📏 المدى الحالي', value: `${session.min} - ${session.max}`, inline: true })
    .setFooter({ text: 'اضغط "خمّن" وأدخل رقمك!' });
}

function buildButtons(session) {
  const mid = Math.floor(((session?.min ?? 1) + (session?.max ?? 100)) / 2);
  const lo  = Math.floor(((session?.min ?? 1) + mid) / 2);
  const hi  = Math.floor((mid + (session?.max ?? 100)) / 2);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ارقام:guess').setLabel('✏️ أدخل تخميني').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ارقام:${lo}`).setLabel(`${lo}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ارقام:${mid}`).setLabel(`${mid} وسط`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ارقام:${hi}`).setLabel(`${hi}`).setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

function buildNewGameBtn() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ارقام:new').setLabel('🔄 لعبة جديدة').setStyle(ButtonStyle.Success),
  );
}
