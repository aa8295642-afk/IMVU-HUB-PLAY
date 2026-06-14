const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

// ألوان UNO
const COLORS = ['🔴', '🔵', '🟢', '🟡'];
const COLOR_NAMES = { '🔴': 'أحمر', '🔵': 'أزرق', '🟢': 'أخضر', '🟡': 'أصفر' };
const COLOR_STYLES = {
  '🔴': ButtonStyle.Danger,
  '🔵': ButtonStyle.Primary,
  '🟢': ButtonStyle.Success,
  '🟡': ButtonStyle.Secondary,
};

// أنواع الأوراق
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'];
const SPECIALS = ['⏭️ تخطي', '🔄 عكس', '+2'];
const WILDS = ['🌈 أي لون', '🌈 أي لون +4'];

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (const num of NUMBERS) {
      deck.push({ color, value: num, type: 'number' });
      if (num !== '0') deck.push({ color, value: num, type: 'number' });
    }
    for (const special of SPECIALS) {
      deck.push({ color, value: special, type: 'special' });
      deck.push({ color, value: special, type: 'special' });
    }
  }
  for (const wild of WILDS) {
    for (let i = 0; i < 4; i++) {
      deck.push({ color: '🌈', value: wild, type: 'wild' });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function canPlay(card, topCard) {
  if (card.type === 'wild') return true;
  if (card.color === topCard.color) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function cardLabel(card) {
  if (card.type === 'wild') return card.value;
  return `${card.color} ${card.value}`;
}

function formatCard(card) {
  return `${card.color} ${card.value}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uno')
    .setDescription('🃏 لعبة UNO! من 2 لـ 4 لاعبين!'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة UNO شغالة بالفعل!', ephemeral: true });
    }

    // شرح اللعبة
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🃏 لعبة UNO!')
        .setDescription(
          '**طريقة اللعب:**\n\n' +
          '🎯 **الهدف:** أول واحد يخلص أوراقه يفوز!\n\n' +
          '**قواعد اللعب:**\n' +
          '• كل واحد بياخد **7 أوراق** في البداية\n' +
          '• لازم تلعب ورقة نفس **اللون** أو نفس **الرقم** أو نفس **الحرف**\n' +
          '• لو معندكش ورقة تلعبها، اسحب ورقة جديدة\n\n' +
          '**الأوراق الخاصة:**\n' +
          '• ⏭️ **تخطي** = اللاعب الجاي بيتخطى دوره\n' +
          '• 🔄 **عكس** = اتجاه اللعبة بيتعكس\n' +
          '• **+2** = اللاعب الجاي بياخد ورقتين\n' +
          '• 🌈 **أي لون** = اختار أي لون عايزه\n' +
          '• 🌈 **أي لون +4** = اختار لون واللاعب الجاي بياخد 4 أوراق\n\n' +
          '**لما يتبقالك ورقة واحدة:** اضغط **UNO!** 🃏\n\n' +
          '*من 2 لـ 4 لاعبين - اضغط انضم!* 👇'
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('uno:join')
          .setLabel('✋ انضم للعبة')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('uno:leave')
          .setLabel('❌ اخرج')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('uno:start')
          .setLabel('▶️ ابدأ اللعبة')
          .setStyle(ButtonStyle.Primary),
      )],
    });

    // إنشاء session
    const session = {
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      players: [interaction.user.id],
      playerNames: { [interaction.user.id]: interaction.user.username },
      hands: {},
      deck: [],
      discard: [],
      currentPlayer: 0,
      direction: 1,
      phase: 'joining',
      pendingDraw: 0,
      unoSaid: {},
    };

    sessions.set(interaction.channelId, session);
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة UNO!', ephemeral: true });

    // انضمام
    if (action === 'join') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ اللعبة بدأت!', ephemeral: true });
      if (session.players.includes(interaction.user.id)) return interaction.reply({ content: '✅ انت موجود!', ephemeral: true });
      if (session.players.length >= 4) return interaction.reply({ content: '⚠️ اللعبة ممتلئة! (4 لاعبين بس)', ephemeral: true });

      session.players.push(interaction.user.id);
      session.playerNames[interaction.user.id] = interaction.user.username;

      await interaction.reply({ content: `✅ **${interaction.user.username}** انضم! اللاعبين: ${session.players.length}/4`, ephemeral: false });
      return;
    }

    // خروج
    if (action === 'leave') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ مينفعش تخرج بعد ما اللعبة بدأت!', ephemeral: true });
      if (!session.players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });
      session.players = session.players.filter(p => p !== interaction.user.id);
      delete session.playerNames[interaction.user.id];
      await interaction.reply({ content: `👋 **${interaction.user.username}** خرج!`, ephemeral: false });
      return;
    }

    // بدء اللعبة
    if (action === 'start') {
      if (interaction.user.id !== session.hostId) return interaction.reply({ content: '⚠️ بس الهوست يقدر يبدأ!', ephemeral: true });
      if (session.players.length < 2) return interaction.reply({ content: '⚠️ محتاج لاعبين على الأقل!', ephemeral: true });
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ اللعبة بدأت بالفعل!', ephemeral: true });

      // توزيع الأوراق
      session.deck = createDeck();
      session.players.forEach(p => {
        session.hands[p] = [];
        for (let i = 0; i < 7; i++) {
          session.hands[p].push(session.deck.pop());
        }
      });

      // أول ورقة في المكب
      let firstCard = session.deck.pop();
      while (firstCard.type === 'wild') {
        session.deck.unshift(firstCard);
        firstCard = session.deck.pop();
      }
      session.discard = [firstCard];
      session.phase = 'playing';
      session.currentPlayer = 0;

      await interaction.update({
        embeds: [buildGameEmbed(session)],
        components: [buildGameActions()],
      });

      // ابعت أوراق كل لاعب بشكل خاص
      await sendHandToPlayer(interaction.channel, session, session.players[0]);
      return;
    }

    // شوف أوراقك
    if (action === 'hand') {
      if (!session.players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });
      await sendHandToPlayer(interaction.channel, session, interaction.user.id, interaction);
      return;
    }

    // سحب ورقة
    if (action === 'draw') {
      if (session.players[session.currentPlayer] !== interaction.user.id) {
        return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
      }

      if (session.deck.length === 0) {
        const top = session.discard.pop();
        session.deck = session.discard.sort(() => Math.random() - 0.5);
        session.discard = [top];
      }

      const drawn = session.pendingDraw > 0 ? session.pendingDraw : 1;
      for (let i = 0; i < drawn; i++) {
        if (session.deck.length > 0) session.hands[interaction.user.id].push(session.deck.pop());
      }
      session.pendingDraw = 0;

      await interaction.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setDescription(`📥 **${interaction.user.username}** سحب ${drawn} ورقة/أوراق!`)
        ],
      });

      nextTurn(session);
      await interaction.update({
        embeds: [buildGameEmbed(session)],
        components: [buildGameActions()],
      });
      await sendHandToPlayer(interaction.channel, session, session.players[session.currentPlayer]);
      return;
    }

    // لعب ورقة
    if (action.startsWith('play_')) {
      if (session.players[session.currentPlayer] !== interaction.user.id) {
        return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
      }

      const cardIndex = parseInt(action.replace('play_', ''));
      const card = session.hands[interaction.user.id][cardIndex];
      const topCard = session.discard[session.discard.length - 1];

      if (!canPlay(card, topCard)) {
        return interaction.reply({ content: '❌ مينفعش تلعب الورقة دي!', ephemeral: true });
      }

      if (session.pendingDraw > 0 && card.value !== '+2' && card.value !== '🌈 أي لون +4') {
        return interaction.reply({ content: `⚠️ لازم تسحب ${session.pendingDraw} ورقة!`, ephemeral: true });
      }

      // إزالة الورقة من يد اللاعب
      session.hands[interaction.user.id].splice(cardIndex, 1);
      session.discard.push(card);

      // تحقق من الفوز
      if (session.hands[interaction.user.id].length === 0) {
        sessions.delete(session.channelId);
        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 انتهت اللعبة!')
            .setDescription(`🎉 **${interaction.user.username}** فاز! خلّص كل أوراقه! 🃏`)
          ],
          components: [],
        });
        return;
      }

      // تطبيق تأثير الورقة
      await applyCardEffect(interaction, session, card, interaction.user);

      // لو مش wild (wild بيحتاج اختيار لون)
      if (card.type !== 'wild') {
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`🃏 **${interaction.user.username}** لعب: **${formatCard(card)}**`)
          ],
        });

        await interaction.update({
          embeds: [buildGameEmbed(session)],
          components: [buildGameActions()],
        });
        await sendHandToPlayer(interaction.channel, session, session.players[session.currentPlayer]);
      }
      return;
    }

    // اختيار لون للـ wild
    if (action.startsWith('color_')) {
      if (session.players[session.currentPlayer] !== interaction.user.id) {
        return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
      }

      const color = action.replace('color_', '');
      const topCard = session.discard[session.discard.length - 1];
      topCard.color = color;

      await interaction.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setDescription(`🌈 **${interaction.user.username}** اختار لون **${COLOR_NAMES[color]}**!`)
        ],
      });

      await interaction.update({
        embeds: [buildGameEmbed(session)],
        components: [buildGameActions()],
      });
      await sendHandToPlayer(interaction.channel, session, session.players[session.currentPlayer]);
      return;
    }

    // UNO
    if (action === 'uno') {
      if (!session.players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });
      session.unoSaid[interaction.user.id] = true;
      await interaction.reply({ content: `🃏 **${interaction.user.username}** قال UNO! 🔴`, ephemeral: false });
      return;
    }
  },
};

async function applyCardEffect(interaction, session, card, user) {
  const nextIdx = (session.currentPlayer + session.direction + session.players.length) % session.players.length;

  if (card.value === '⏭️ تخطي') {
    nextTurn(session);
    await interaction.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xef4444)
        .setDescription(`⏭️ **${session.playerNames[session.players[nextIdx]]}** اتخطى!`)
      ],
    });
    nextTurn(session);
  } else if (card.value === '🔄 عكس') {
    session.direction *= -1;
    await interaction.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x10b981)
        .setDescription(`🔄 اتجاه اللعبة اتعكس!`)
      ],
    });
    nextTurn(session);
  } else if (card.value === '+2') {
    session.pendingDraw += 2;
    await interaction.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xef4444)
        .setDescription(`+2 على **${session.playerNames[session.players[nextIdx]]}**!`)
      ],
    });
    nextTurn(session);
  } else if (card.type === 'wild') {
    if (card.value === '🌈 أي لون +4') {
      session.pendingDraw += 4;
    }
    // اختيار لون
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🌈 اختار لون!')
        .setDescription('اختار اللون اللي عايزه!')
      ],
      components: [new ActionRowBuilder().addComponents(
        ...COLORS.map(c => new ButtonBuilder()
          .setCustomId(`uno:color_${c}`)
          .setLabel(COLOR_NAMES[c])
          .setStyle(COLOR_STYLES[c])
        )
      )],
    });
    nextTurn(session);
  } else {
    nextTurn(session);
  }
}

function nextTurn(session) {
  session.currentPlayer = (session.currentPlayer + session.direction + session.players.length) % session.players.length;
}

function buildGameEmbed(session) {
  const topCard = session.discard[session.discard.length - 1];
  const currentPlayerName = session.playerNames[session.players[session.currentPlayer]];

  const playersList = session.players.map((p, i) => {
    const isCurrentPlayer = i === session.currentPlayer;
    const cardCount = session.hands[p] ? session.hands[p].length : 0;
    return `${isCurrentPlayer ? '▶️' : '•'} **${session.playerNames[p]}** - ${cardCount} ورقة`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🃏 UNO!')
    .addFields(
      { name: '🎴 آخر ورقة', value: formatCard(topCard), inline: true },
      { name: '↕️ الاتجاه', value: session.direction === 1 ? '⬇️' : '⬆️', inline: true },
      { name: '📥 أوراق للسحب', value: session.pendingDraw > 0 ? `${session.pendingDraw}` : 'لا', inline: true },
      { name: '👥 اللاعبين', value: playersList },
    )
    .setDescription(`🎮 دور: **${currentPlayerName}**`)
    .setFooter({ text: 'اضغط "شوف أوراقك" عشان تشوف أوراقك وتلعب!' });
}

function buildGameActions() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('uno:hand')
      .setLabel('🃏 شوف أوراقك')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('uno:draw')
      .setLabel('📥 اسحب ورقة')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('uno:uno')
      .setLabel('🔴 UNO!')
      .setStyle(ButtonStyle.Danger),
  );
}

async function sendHandToPlayer(channel, session, playerId, interaction = null) {
  const hand = session.hands[playerId];
  if (!hand) return;

  const topCard = session.discard[session.discard.length - 1];
  const isCurrentPlayer = session.players[session.currentPlayer] === playerId;

  // تقسيم الأوراق لصفوف (5 أوراق في كل صف)
  const playableCards = hand.filter(c => canPlay(c, topCard));
  const rows = [];

  // بس أوراق اللي دوره
  if (isCurrentPlayer && playableCards.length > 0) {
    for (let i = 0; i < Math.min(hand.length, 20); i += 4) {
      const row = new ActionRowBuilder();
      for (let j = i; j < Math.min(i + 4, hand.length); j++) {
        const card = hand[j];
        const playable = canPlay(card, topCard);
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`uno:play_${j}`)
            .setLabel(cardLabel(card).slice(0, 20))
            .setStyle(playable ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!playable)
        );
      }
      rows.push(row);
      if (rows.length >= 4) break;
    }
  }

  const content = {
    embeds: [new EmbedBuilder()
      .setColor(isCurrentPlayer ? 0x10b981 : 0x6b7280)
      .setTitle(`🃏 أوراقك (${hand.length} ورقة)`)
      .setDescription(
        hand.map((c, i) => `${i + 1}. ${formatCard(c)}`).join('\n') +
        (isCurrentPlayer ? '\n\n**دورك! اضغط على ورقة خضراء تلعبها!**' : '\n\n*مش دورك دلوقتي*')
      )
    ],
    components: isCurrentPlayer ? rows : [],
    ephemeral: true,
  };

  if (interaction) {
    await interaction.reply(content);
  } else {
    // إرسال رسالة للشانيل تطلب من اللاعب يضغط
    await channel.send({
      content: `<@${playerId}> دورك! اضغط **شوف أوراقك** عشان تشوف أوراقك وتلعب! 🃏`,
    });
  }
}
