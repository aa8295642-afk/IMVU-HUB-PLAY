const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

const GRID_SIZE = 5;
const MINE_COUNT = 5;

function createBoard() {
  const board = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => ({
      mine: false,
      revealed: false,
      number: 0,
    }))
  );

  // وضع الألغام
  let placed = 0;
  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // حساب الأرقام
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!board[r][c].mine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc].mine) {
              count++;
            }
          }
        }
        board[r][c].number = count;
      }
    }
  }

  return board;
}

function countRevealed(board) {
  return board.flat().filter(c => c.revealed && !c.mine).length;
}

function totalSafe(board) {
  return board.flat().filter(c => !c.mine).length;
}

const NUMBER_EMOJIS = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minesweeper')
    .setDescription('💣 لعبة مسح الألغام!'),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل!', ephemeral: true });
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x6b7280)
        .setTitle('💣 لعبة مسح الألغام!')
        .setDescription(
          '**طريقة اللعب:**\n\n' +
          '🎯 **الهدف:** افتح كل المربعات اللي مفيهاش ألغام!\n\n' +
          '**القواعد:**\n' +
          '• الشبكة **5×5** فيها **5 ألغام** 💣\n' +
          '• لما تضغط مربع:\n' +
          '  - لو فيه لغم = **انفجرت!** 💥\n' +
          '  - لو مفيش = بيظهر رقم بكام لغم حواليه\n' +
          '• الأرقام بتساعدك تتجنب الألغام\n\n' +
          '**الأوضاع:**\n' +
          '🎮 **فردي** - العب لوحدك وحاول تخلص\n' +
          '👥 **تحدي** - من 2 لـ 4 لاعبين، أكتر واحد يفتح مربعات يفوز، لو انفجرت تتطرد!\n\n' +
          '*اختار الوضع:* 👇'
        )
      ],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('minesweeper:solo')
          .setLabel('🎮 فردي')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('minesweeper:multi')
          .setLabel('👥 تحدي بين لاعبين')
          .setStyle(ButtonStyle.Success),
      )],
    });
  },

  async handleButton(interaction, action) {
    // وضع فردي
    if (action === 'solo') {
      if (sessions.has(interaction.channelId)) {
        return interaction.reply({ content: '⚠️ في لعبة شغالة!', ephemeral: true });
      }

      const board = createBoard();
      const session = {
        mode: 'solo',
        board,
        playerId: interaction.user.id,
        playerName: interaction.user.username,
        channelId: interaction.channelId,
        over: false,
      };

      sessions.set(interaction.channelId, session);

      await interaction.update({
        embeds: [buildSoloEmbed(session, `دورك يا **${interaction.user.username}**! اضغط مربع! 🎯`)],
        components: buildBoardButtons(session, 'solo'),
      });
      return;
    }

    // وضع تحدي - لوبي
    if (action === 'multi') {
      if (sessions.has(interaction.channelId)) {
        return interaction.reply({ content: '⚠️ في لعبة شغالة!', ephemeral: true });
      }

      const session = {
        mode: 'multi',
        board: createBoard(),
        players: [interaction.user.id],
        playerNames: { [interaction.user.id]: interaction.user.username },
        scores: { [interaction.user.id]: 0 },
        eliminated: [],
        currentPlayer: 0,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        phase: 'joining',
        over: false,
      };

      sessions.set(interaction.channelId, session);

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildLobbyButtons()],
      });
      return;
    }

    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة!', ephemeral: true });

    // انضمام للوبي
    if (action === 'join') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ اللعبة بدأت!', ephemeral: true });
      if (session.players.includes(interaction.user.id)) return interaction.reply({ content: '✅ انت موجود!', ephemeral: true });
      if (session.players.length >= 4) return interaction.reply({ content: '⚠️ اللعبة ممتلئة!', ephemeral: true });

      session.players.push(interaction.user.id);
      session.playerNames[interaction.user.id] = interaction.user.username;
      session.scores[interaction.user.id] = 0;

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildLobbyButtons()],
      });
      return;
    }

    // خروج من اللوبي
    if (action === 'leave') {
      if (session.phase !== 'joining') return interaction.reply({ content: '⚠️ مينفعش تخرج بعد البداية!', ephemeral: true });
      if (!session.players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });

      session.players = session.players.filter(p => p !== interaction.user.id);
      delete session.playerNames[interaction.user.id];
      delete session.scores[interaction.user.id];

      if (session.players.length === 0) {
        sessions.delete(interaction.channelId);
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(0xef4444).setDescription('❌ انتهت اللعبة - مفيش لاعبين!')],
          components: [],
        });
        return;
      }

      if (session.hostId === interaction.user.id) {
        session.hostId = session.players[0];
      }

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildLobbyButtons()],
      });
      return;
    }

    // بدء التحدي
    if (action === 'startmulti') {
      if (interaction.user.id !== session.hostId) return interaction.reply({ content: '⚠️ بس الهوست يبدأ!', ephemeral: true });
      if (session.players.length < 2) return interaction.reply({ content: '⚠️ محتاج لاعبين على الأقل!', ephemeral: true });

      session.phase = 'playing';
      session.board = createBoard();

      await interaction.update({
        embeds: [buildMultiEmbed(session, `دور **${session.playerNames[session.players[session.currentPlayer]]}**! اضغط مربع!`)],
        components: buildBoardButtons(session, 'multi'),
      });
      return;
    }

    // اعادة تشغيل فردي
    if (action === 'restart') {
      sessions.delete(session.channelId);
      const board = createBoard();
      const newSession = {
        mode: 'solo',
        board,
        playerId: interaction.user.id,
        playerName: interaction.user.username,
        channelId: interaction.channelId,
        over: false,
      };
      sessions.set(interaction.channelId, newSession);

      await interaction.update({
        embeds: [buildSoloEmbed(newSession, `دورك يا **${interaction.user.username}**! اضغط مربع! 🎯`)],
        components: buildBoardButtons(newSession, 'solo'),
      });
      return;
    }

    // الضغط على مربع - فردي
    if (action.startsWith('cell_') && session.mode === 'solo') {
      if (interaction.user.id !== session.playerId) {
        return interaction.reply({ content: '⚠️ مش لعبتك!', ephemeral: true });
      }

      const [r, c] = action.replace('cell_', '').split('_').map(Number);
      const cell = session.board[r][c];

      if (cell.revealed) return interaction.reply({ content: '⚠️ المربع ده اتفتح بالفعل!', ephemeral: true });

      cell.revealed = true;

      if (cell.mine) {
        // انفجر!
        session.over = true;
        sessions.delete(session.channelId);

        // اكشف كل الألغام
        session.board.flat().forEach(c => { if (c.mine) c.revealed = true; });

        await interaction.update({
          embeds: [buildSoloEmbed(session, '💥 **انفجرت!** خسرت!')],
          components: [
            ...buildBoardButtons(session, 'solo', true),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('minesweeper:restart')
                .setLabel('🔄 العب تاني')
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        });
        return;
      }

      const revealed = countRevealed(session.board);
      const total = totalSafe(session.board);

      if (revealed === total) {
        // فاز!
        session.over = true;
        sessions.delete(session.channelId);

        await interaction.update({
          embeds: [buildSoloEmbed(session, `🎉 **فزت!** فتحت كل المربعات الآمنة!`)],
          components: [
            ...buildBoardButtons(session, 'solo', true),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('minesweeper:restart')
                .setLabel('🔄 العب تاني')
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        });
        return;
      }

      await interaction.update({
        embeds: [buildSoloEmbed(session, `✅ آمن! ${revealed}/${total} مربع 🎯`)],
        components: buildBoardButtons(session, 'solo'),
      });
      return;
    }

    // الضغط على مربع - تحدي
    if (action.startsWith('cell_') && session.mode === 'multi') {
      const currentPlayerId = session.players[session.currentPlayer];
      if (interaction.user.id !== currentPlayerId) {
        return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
      }

      const [r, c] = action.replace('cell_', '').split('_').map(Number);
      const cell = session.board[r][c];

      if (cell.revealed) return interaction.reply({ content: '⚠️ المربع ده اتفتح!', ephemeral: true });

      cell.revealed = true;

      if (cell.mine) {
        // انفجر - اتطرد
        session.eliminated.push(currentPlayerId);
        const elimName = session.playerNames[currentPlayerId];
        session.players.splice(session.currentPlayer, 1);

        // كشف اللغم
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setDescription(`💥 **${elimName}** انفجر وتطرد من اللعبة!`)
          ],
        });

        if (session.players.length <= 1) {
          // انتهت اللعبة
          const winner = session.players[0];
          sessions.delete(session.channelId);

          session.board.flat().forEach(c => { if (c.mine) c.revealed = true; });

          const scoresList = Object.entries(session.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([id, score], i) => `${['🥇','🥈','🥉'][i] || '🏅'} **${session.playerNames[id] || 'لاعب'}** - ${score} مربع`)
            .join('\n');

          await interaction.update({
            embeds: [new EmbedBuilder()
              .setColor(0xffd700)
              .setTitle('🏆 انتهت اللعبة!')
              .setDescription(
                (winner ? `🎉 **${session.playerNames[winner]}** فاز!\n\n` : '💥 الكل انفجر!\n\n') +
                `**النتائج:**\n${scoresList}`
              )
            ],
            components: buildBoardButtons(session, 'multi', true),
          });
          return;
        }

        // دور اللاعب الجاي
        if (session.currentPlayer >= session.players.length) {
          session.currentPlayer = 0;
        }

        await interaction.update({
          embeds: [buildMultiEmbed(session, `دور **${session.playerNames[session.players[session.currentPlayer]]}**!`)],
          components: buildBoardButtons(session, 'multi'),
        });
        return;
      }

      // آمن - نقطة
      session.scores[currentPlayerId] = (session.scores[currentPlayerId] || 0) + 1;
      const revealed = countRevealed(session.board);
      const total = totalSafe(session.board);

      if (revealed === total) {
        // كل المربعات اتفتحت
        sessions.delete(session.channelId);
        const scoresList = Object.entries(session.scores)
          .sort((a, b) => b[1] - a[1])
          .map(([id, score], i) => `${['🥇','🥈','🥉'][i] || '🏅'} **${session.playerNames[id] || 'لاعب'}** - ${score} مربع`)
          .join('\n');

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 انتهت اللعبة! كل المربعات اتفتحت!')
            .setDescription(`**النتائج:**\n${scoresList}`)
          ],
          components: buildBoardButtons(session, 'multi', true),
        });
        return;
      }

      // دور اللاعب الجاي
      session.currentPlayer = (session.currentPlayer + 1) % session.players.length;

      await interaction.update({
        embeds: [buildMultiEmbed(session, `✅ آمن! دور **${session.playerNames[session.players[session.currentPlayer]]}**!`)],
        components: buildBoardButtons(session, 'multi'),
      });
      return;
    }
  },
};

function buildSoloEmbed(session, message) {
  const revealed = countRevealed(session.board);
  const total = totalSafe(session.board);
  return new EmbedBuilder()
    .setColor(0x6b7280)
    .setTitle('💣 مسح الألغام - فردي')
    .setDescription(`> ${message}`)
    .addFields(
      { name: '✅ مفتوح', value: `${revealed}/${total}`, inline: true },
      { name: '💣 ألغام', value: `${MINE_COUNT}`, inline: true },
    );
}

function buildMultiEmbed(session, message) {
  const scoresList = session.players.map(p =>
    `• **${session.playerNames[p]}** - ${session.scores[p] || 0} مربع`
  ).join('\n');

  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('💣 مسح الألغام - تحدي')
    .setDescription(`> ${message}`)
    .addFields(
      { name: '👥 اللاعبين', value: scoresList || 'لا يوجد' },
      { name: '💣 ألغام', value: `${MINE_COUNT}`, inline: true },
      { name: '✅ مفتوح', value: `${countRevealed(session.board)}/${totalSafe(session.board)}`, inline: true },
    );
}

function buildLobbyEmbed(session) {
  const playerList = session.players.map(p => `• **${session.playerNames[p]}**`).join('\n');
  return new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('💣 مسح الألغام - تحدي')
    .setDescription(
      `**اللاعبين (${session.players.length}/4):**\n${playerList}\n\n` +
      `انضم واستنى الهوست يبدأ!`
    );
}

function buildLobbyButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('minesweeper:join').setLabel('✋ انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('minesweeper:leave').setLabel('❌ اخرج').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('minesweeper:startmulti').setLabel('▶️ ابدأ').setStyle(ButtonStyle.Primary),
  );
}

function buildBoardButtons(session, mode, disabled = false) {
  const rows = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = session.board[r][c];
      let label = '⬜';
      let style = ButtonStyle.Secondary;

      if (cell.revealed) {
        if (cell.mine) {
          label = '💣';
          style = ButtonStyle.Danger;
        } else if (cell.number === 0) {
          label = '✅';
          style = ButtonStyle.Success;
        } else {
          label = NUMBER_EMOJIS[cell.number];
          style = ButtonStyle.Success;
        }
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`minesweeper:cell_${r}_${c}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled || cell.revealed)
      );
    }
    rows.push(row);
  }
  return rows;
}
