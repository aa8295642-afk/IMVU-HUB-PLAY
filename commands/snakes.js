const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

// السلالم: من -> إلى
const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
};

// الثعابين: من -> إلى
const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡'];

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function getDiceEmoji(num) {
  return ['⚀','⚁','⚂','⚃','⚄','⚅'][num - 1];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snakes')
    .setDescription('🐍 لعبة السلم والثعبان! من 2 لـ 4 لاعبين!'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل!', ephemeral: true });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle('🐍 لعبة السلم والثعبان!')
        .setDescription(
          '**طريقة اللعب:**\n\n' +
          '🎯 **الهدف:** أول واحد يوصل الخانة **100** يفوز!\n\n' +
          '**القواعد:**\n' +
          '• كل واحد بدوره يرمي **النرد** 🎲\n' +
          '• لو وقفت على **سلم** ⬆️ تطلع لفوق!\n' +
          '• لو وقفت على **ثعبان** 🐍 تنزل لتحت!\n' +
          '• لازم توصل **100 بالظبط** - لو النرد زيادة تفضل في مكانك\n\n' +
          '**السلالم ⬆️:**\n' +
          '4→14 | 9→31 | 20→38 | 28→84\n' +
          '40→59 | 51→67 | 63→81 | 71→91\n\n' +
          '**الثعابين 🐍:**\n' +
          '17→7 | 54→34 | 62→19 | 64→60\n' +
          '87→24 | 93→73 | 95→75 | 99→78\n\n' +
          '*من 2 لـ 4 لاعبين - انضم!* 👇'
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('snakes:join')
          .setLabel('✋ انضم للعبة')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('snakes:leave')
          .setLabel('❌ اخرج')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('snakes:start')
          .setLabel('▶️ ابدأ اللعبة')
          .setStyle(ButtonStyle.Primary),
      )],
    });

    const session = {
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      players: [interaction.user.id],
      playerNames: { [interaction.user.id]: interaction.user.username },
      positions: { [interaction.user.id]: 0 },
      currentPlayer: 0,
      phase: 'joining',
    };

    sessions.set(interaction.channelId, session);
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة!', ephemeral: true });

    // انضمام
    if (action === 'join') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ اللعبة بدأت!', ephemeral: true });
      if (session.players.includes(interaction.user.id)) return interaction.reply({ content: '✅ انت موجود!', ephemeral: true });
      if (session.players.length >= 4) return interaction.reply({ content: '⚠️ اللعبة ممتلئة! (4 لاعبين بس)', ephemeral: true });

      session.players.push(interaction.user.id);
      session.playerNames[interaction.user.id] = interaction.user.username;
      session.positions[interaction.user.id] = 0;

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildLobbyButtons()],
      });
      return;
    }

    // خروج
    if (action === 'leave') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ مينفعش تخرج بعد البداية!', ephemeral: true });
      if (!session.players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });

      session.players = session.players.filter(p => p !== interaction.user.id);
      delete session.playerNames[interaction.user.id];
      delete session.positions[interaction.user.id];

      if (session.players.length === 0) {
        sessions.delete(session.channelId);
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('❌ انتهت اللعبة!')],
          components: [],
        });
        return;
      }

      if (session.hostId === interaction.user.id) session.hostId = session.players[0];

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildLobbyButtons()],
      });
      return;
    }

    // بدء اللعبة
    if (action === 'start') {
      if (interaction.user.id !== session.hostId) return interaction.reply({ content: '⚠️ بس الهوست يبدأ!', ephemeral: true });
      if (session.players.length < 2) return interaction.reply({ content: '⚠️ محتاج لاعبين على الأقل!', ephemeral: true });
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ اللعبة بدأت بالفعل!', ephemeral: true });

      session.phase = 'playing';
      session.currentPlayer = 0;

      const currentId = session.players[session.currentPlayer];

      await interaction.update({
        embeds: [buildGameEmbed(session, `دور **${session.playerNames[currentId]}** ${PLAYER_EMOJIS[session.currentPlayer]}! اضغط ارمي النرد!`)],
        components: [buildRollButton()],
      });
      return;
    }

    // رمي النرد
    if (action === 'roll') {
      const currentId = session.players[session.currentPlayer];

      if (interaction.user.id !== currentId) {
        return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
      }

      const dice = rollDice();
      const oldPos = session.positions[currentId];
      let newPos = oldPos + dice;
      let extraMsg = '';

      // لو زاد عن 100
      if (newPos > 100) {
        newPos = oldPos;
        extraMsg = `\n⚠️ النرد زيادة! فاضلك **${100 - oldPos}** عشان توصل، فضلت في **${oldPos}**`;
      } else if (newPos === 100) {
        // فاز!
        session.positions[currentId] = 100;
        sessions.delete(session.channelId);

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 انتهت اللعبة!')
            .setDescription(
              `${getDiceEmoji(dice)} رمى **${dice}**\n\n` +
              `🎉 **${session.playerNames[currentId]}** ${PLAYER_EMOJIS[session.currentPlayer]} وصل **100** وفاز! 🎊\n\n` +
              buildPositions(session)
            )
          ],
          components: [],
        });
        return;
      } else {
        session.positions[currentId] = newPos;

        // تحقق من سلم أو ثعبان
        if (LADDERS[newPos]) {
          const ladderTo = LADDERS[newPos];
          session.positions[currentId] = ladderTo;
          extraMsg = `\n⬆️ **سلم!** طلع من **${newPos}** لـ **${ladderTo}**! 🎉`;
          newPos = ladderTo;
        } else if (SNAKES[newPos]) {
          const snakeTo = SNAKES[newPos];
          session.positions[currentId] = snakeTo;
          extraMsg = `\n🐍 **ثعبان!** نزل من **${newPos}** لـ **${snakeTo}**! 😱`;
          newPos = snakeTo;
        }
      }

      // دور اللاعب الجاي
      session.currentPlayer = (session.currentPlayer + 1) % session.players.length;
      const nextId = session.players[session.currentPlayer];

      await interaction.update({
        embeds: [buildGameEmbed(
          session,
          `${getDiceEmoji(dice)} **${session.playerNames[currentId]}** رمى **${dice}** ووصل **${newPos}**${extraMsg}\n\nدور **${session.playerNames[nextId]}** ${PLAYER_EMOJIS[session.currentPlayer]}!`
        )],
        components: [buildRollButton()],
      });
      return;
    }
  },
};

function buildLobbyEmbed(session) {
  const playerList = session.players.map((p, i) =>
    `${PLAYER_EMOJIS[i]} **${session.playerNames[p]}**`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('🐍 السلم والثعبان - انتظار اللاعبين')
    .setDescription(
      `**اللاعبين (${session.players.length}/4):**\n${playerList}\n\n` +
      `الهوست يضغط **ابدأ** لما يجتمع الكل!`
    );
}

function buildLobbyButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('snakes:join').setLabel('✋ انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('snakes:leave').setLabel('❌ اخرج').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('snakes:start').setLabel('▶️ ابدأ').setStyle(ButtonStyle.Primary),
  );
}

function buildRollButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('snakes:roll')
      .setLabel('🎲 ارمي النرد!')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildPositions(session) {
  return session.players.map((p, i) =>
    `${PLAYER_EMOJIS[i]} **${session.playerNames[p]}** - خانة **${session.positions[p]}**`
  ).join('\n');
}

function buildGameEmbed(session, message) {
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('🐍 السلم والثعبان')
    .setDescription(`> ${message}`)
    .addFields(
      { name: '📍 المواقع', value: buildPositions(session) },
    )
    .setFooter({ text: 'أول واحد يوصل 100 يفوز! 🏆' });
}
