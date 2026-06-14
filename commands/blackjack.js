const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function formatHand(hand, hideSecond = false) {
  if (hideSecond) {
    return `${hand[0].rank}${hand[0].suit} | 🎴`;
  }
  return hand.map(c => `${c.rank}${c.suit}`).join(' | ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 لعبة البلاك جاك — وصّل لـ 21 من غير ما تعدّيها!'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل! انتظر ما تخلص.', ephemeral: true });
    }

    // شرح اللعبة الأول
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1a1a2e)
        .setTitle('🃏 لعبة البلاك جاك!')
        .setDescription(
          '**طريقة اللعب:**\n\n' +
          '🎯 **الهدف:** وصّل لـ **21 نقطة** أو أقرب منها من غير ما تعدّيها!\n\n' +
          '**قيمة الأوراق:**\n' +
          '• 2️⃣-🔟 = قيمتها الطبيعية\n' +
          '• 🃏 J, Q, K = 10 نقاط\n' +
          '• 🅰️ A = 1 أو 11 (الأفضل ليك)\n\n' +
          '**الأزرار:**\n' +
          '• 👆 **Hit** = اسحب ورقة جديدة\n' +
          '• ✋ **Stand** = وقّف وخلي الديلر يلعب\n\n' +
          '**قواعد الديلر:**\n' +
          '• الديلر لازم يسحب لو عنده أقل من 17\n' +
          '• لو عدّيت 21 = **Bust** وخسرت فوراً! 💥\n' +
          '• لو وصلت 21 من أول ورقتين = **Blackjack!** 🎉\n\n' +
          '*اضغط ابدأ اللعبة!* 👇'
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('blackjack:start')
          .setLabel('🎮 ابدأ اللعبة!')
          .setStyle(ButtonStyle.Success),
      )],
    });
  },

  async handleButton(interaction, action) {
    // بدء اللعبة
    if (action === 'start') {
      if (sessions.has(interaction.channelId)) {
        return interaction.reply({ content: '⚠️ في لعبة شغالة!', ephemeral: true });
      }

      const deck = createDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      const session = {
        deck,
        playerHand,
        dealerHand,
        playerId: interaction.user.id,
        channelId: interaction.channelId,
        over: false,
      };

      sessions.set(interaction.channelId, session);

      const playerTotal = handValue(playerHand);

      // لو بلاك جاك من أول ورقتين
      if (playerTotal === 21) {
        sessions.delete(interaction.channelId);
        return interaction.update({
          embeds: [buildEmbed(session, '🎉 **BLACKJACK!** فزت فوراً! 21 من أول ورقتين!', 0xffd700, false)],
          components: [buildRestartButton()],
        });
      }

      return interaction.update({
        embeds: [buildEmbed(session, 'دورك! اسحب ورقة أو وقّف؟', 0x3b82f6, true)],
        components: [buildGameButtons()],
      });
    }

    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة شغالة!', ephemeral: true });

    if (interaction.user.id !== session.playerId) {
      return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
    }

    if (session.over) return;

    // سحب ورقة
    if (action === 'hit') {
      session.playerHand.push(session.deck.pop());
      const total = handValue(session.playerHand);

      if (total > 21) {
        session.over = true;
        sessions.delete(session.channelId);
        return interaction.update({
          embeds: [buildEmbed(session, `💥 **Bust!** عندك ${total} - خسرت!`, 0xef4444, false)],
          components: [buildRestartButton()],
        });
      }

      if (total === 21) {
        // وصل 21 روح للديلر مباشرة
        return await dealerPlay(interaction, session);
      }

      return interaction.update({
        embeds: [buildEmbed(session, `عندك **${total}** - اسحب تاني أو وقّف؟`, 0x3b82f6, true)],
        components: [buildGameButtons()],
      });
    }

    // وقّف
    if (action === 'stand') {
      return await dealerPlay(interaction, session);
    }

    // لعبة جديدة
    if (action === 'restart') {
      sessions.delete(interaction.channelId);
      const deck = createDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      const newSession = {
        deck,
        playerHand,
        dealerHand,
        playerId: interaction.user.id,
        channelId: interaction.channelId,
        over: false,
      };

      sessions.set(interaction.channelId, newSession);

      const playerTotal = handValue(playerHand);
      if (playerTotal === 21) {
        sessions.delete(interaction.channelId);
        return interaction.update({
          embeds: [buildEmbed(newSession, '🎉 **BLACKJACK!** فزت فوراً!', 0xffd700, false)],
          components: [buildRestartButton()],
        });
      }

      return interaction.update({
        embeds: [buildEmbed(newSession, 'دورك! اسحب ورقة أو وقّف؟', 0x3b82f6, true)],
        components: [buildGameButtons()],
      });
    }
  },
};

async function dealerPlay(interaction, session) {
  // الديلر يلعب
  while (handValue(session.dealerHand) < 17) {
    session.dealerHand.push(session.deck.pop());
  }

  const playerTotal = handValue(session.playerHand);
  const dealerTotal = handValue(session.dealerHand);

  sessions.delete(session.channelId);
  session.over = true;

  let resultMsg, color;

  if (dealerTotal > 21) {
    resultMsg = `🎉 الديلر **Bust** (${dealerTotal}) - **فزت!**`;
    color = 0x10b981;
  } else if (playerTotal > dealerTotal) {
    resultMsg = `🎉 **فزت!** ${playerTotal} > ${dealerTotal}`;
    color = 0x10b981;
  } else if (playerTotal < dealerTotal) {
    resultMsg = `😔 **خسرت!** ${playerTotal} < ${dealerTotal}`;
    color = 0xef4444;
  } else {
    resultMsg = `🤝 **تعادل!** الاتنين عندهم ${playerTotal}`;
    color = 0xf59e0b;
  }

  return interaction.update({
    embeds: [buildEmbed(session, resultMsg, color, false)],
    components: [buildRestartButton()],
  });
}

function buildEmbed(session, message, color, hideDealer) {
  const playerTotal = handValue(session.playerHand);
  const dealerTotal = hideDealer
    ? cardValue(session.dealerHand[0].rank)
    : handValue(session.dealerHand);

  return new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 بلاك جاك')
    .addFields(
      {
        name: `🤵 الديلر ${hideDealer ? '(ورقة مخفية)' : `| ${dealerTotal} نقطة`}`,
        value: formatHand(session.dealerHand, hideDealer),
      },
      {
        name: `👤 انت | ${playerTotal} نقطة`,
        value: formatHand(session.playerHand),
      },
    )
    .setDescription(`> ${message}`);
}

function buildGameButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('blackjack:hit')
      .setLabel('👆 Hit - اسحب ورقة')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('blackjack:stand')
      .setLabel('✋ Stand - وقّف')
      .setStyle(ButtonStyle.Danger),
  );
}

function buildRestartButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('blackjack:restart')
      .setLabel('🔄 العب تاني')
      .setStyle(ButtonStyle.Success),
  );
}
