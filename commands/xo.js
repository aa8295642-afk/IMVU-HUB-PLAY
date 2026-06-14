const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xo')
    .setDescription('❌⭕ لعبة XO بين لاعبين!')
    .addUserOption(opt =>
      opt.setName('opponent')
        .setDescription('اختار خصمك')
        .setRequired(true)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');

    if (opponent.bot) {
      return interaction.reply({ content: '❌ مينفعش تلعب مع بوت!', ephemeral: true });
    }
    if (opponent.id === interaction.user.id) {
      return interaction.reply({ content: '❌ مينفعش تلعب مع نفسك!', ephemeral: true });
    }

    const session = {
      players: [interaction.user, opponent],
      board: Array(9).fill(null),
      turn: 0, // 0 = X, 1 = O
      channelId: interaction.channelId,
    };

    sessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds: [buildEmbed(session)],
      components: buildBoard(session),
    });
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) {
      return interaction.reply({ content: '❌ مفيش لعبة شغالة!', ephemeral: true });
    }

    const currentPlayer = session.players[session.turn];
    if (interaction.user.id !== currentPlayer.id) {
      return interaction.reply({ content: '⚠️ مش دورك!', ephemeral: true });
    }

    const cell = parseInt(action);
    if (session.board[cell] !== null) {
      return interaction.reply({ content: '⚠️ الخانة دي مملوءة!', ephemeral: true });
    }

    session.board[cell] = session.turn === 0 ? 'X' : 'O';

    const winner = checkWinner(session.board);
    const isDraw = !winner && session.board.every(c => c !== null);

    if (winner || isDraw) {
      sessions.delete(session.channelId);
      await interaction.update({
        embeds: [buildEndEmbed(session, winner, isDraw)],
        components: buildBoard(session, true),
      });
    } else {
      session.turn = session.turn === 0 ? 1 : 0;
      await interaction.update({
        embeds: [buildEmbed(session)],
        components: buildBoard(session),
      });
    }
  },
};

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // أفقي
    [0,3,6],[1,4,7],[2,5,8], // عمودي
    [0,4,8],[2,4,6],          // قطري
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function buildEmbed(session) {
  const current = session.players[session.turn];
  const symbol = session.turn === 0 ? '❌' : '⭕';
  return new EmbedBuilder()
    .setColor(session.turn === 0 ? 0xef4444 : 0x3b82f6)
    .setTitle('❌⭕ لعبة XO')
    .setDescription(
      `${session.players[0].username} ❌  **vs**  ⭕ ${session.players[1].username}\n\n` +
      `دور: **${symbol} ${current.username}**`
    );
}

function buildEndEmbed(session, winner, isDraw) {
  let title, desc, color;
  if (isDraw) {
    title = '🤝 تعادل!';
    desc = 'اللعبة انتهت بالتعادل!';
    color = 0xf59e0b;
  } else {
    const winnerIndex = winner === 'X' ? 0 : 1;
    const winnerUser = session.players[winnerIndex];
    const symbol = winner === 'X' ? '❌' : '⭕';
    title = `${symbol} ${winnerUser.username} فاز! 🎉`;
    desc = `مبروك لـ **${winnerUser.username}**!`;
    color = 0x10b981;
  }
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc);
}

function buildBoard(session, disabled = false) {
  const symbols = { X: '❌', O: '⭕', null: '⬜' };
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const val = session.board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`xo:${i}`)
          .setLabel(symbols[val])
          .setStyle(val === 'X' ? ButtonStyle.Danger : val === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled || val !== null)
      );
    }
    rows.push(row);
  }
  return rows;
}
