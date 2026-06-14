const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const sessions = new Map();

const GRID_SIZE = 25; // 5x5

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hideseek')
    .setDescription('🔍 لعبة الاختباء — اختبي في مكان والدوّار يدور عليك!')
    .addIntegerOption(opt =>
      opt.setName('min_players')
        .setDescription('أقل عدد لاعبين للبدء (افتراضي 3)')
        .setMinValue(2)
        .setMaxValue(15)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (sessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل!', ephemeral: true });
    }

    const minPlayers = interaction.options.getInteger('min_players') || 3;

    const session = {
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      players: [],
      eliminated: [],
      phase: 'joining', // joining, hiding, seeking
      seekerId: null,
      hidingSpots: {}, // userId -> spotNumber
      currentRound: 0,
      minPlayers,
      messageId: null,
      timeout: null,
    };

    sessions.set(interaction.channelId, session);

    const msg = await interaction.reply({
      embeds: [buildLobbyEmbed(session)],
      components: [buildJoinButtons()],
      fetchReply: true,
    });

    session.messageId = msg.id;

    // بدء بعد 30 ثانية لو في لاعبين كافيين
    session.timeout = setTimeout(async () => {
      if (session.phase !== 'joining') return;
      if (session.players.length < session.minPlayers) {
        sessions.delete(interaction.channelId);
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('❌ انتهت اللعبة')
            .setDescription(`مفيش لاعبين كافيين! محتاج ${session.minPlayers} على الأقل.`)
          ],
        });
        return;
      }
      await startHiding(interaction.channel, session);
    }, 30000);
  },

  async handleButton(interaction, action) {
    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ مفيش لعبة شغالة!', ephemeral: true });

    // انضمام للعبة
    if (action === 'join') {
      if (session.phase !== 'joining') {
        return interaction.reply({ content: '⚠️ اللعبة بدأت بالفعل!', ephemeral: true });
      }
      if (session.players.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ انت موجود بالفعل!', ephemeral: true });
      }
      session.players.push(interaction.user.id);

      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildJoinButtons()],
      });

      await interaction.followUp({ content: `✅ ${interaction.user} انضم للعبة!`, ephemeral: false });

      // لو وصل 15 لاعب ابدأ تلقائي
      if (session.players.length >= 15) {
        clearTimeout(session.timeout);
        await startHiding(interaction.channel, session);
      }
      return;
    }

    // خروج من اللعبة
    if (action === 'leave') {
      if (session.phase !== 'joining') {
        return interaction.reply({ content: '⚠️ مينفعش تخرج بعد ما اللعبة بدأت!', ephemeral: true });
      }
      session.players = session.players.filter(p => p !== interaction.user.id);
      await interaction.update({
        embeds: [buildLobbyEmbed(session)],
        components: [buildJoinButtons()],
      });
      await interaction.followUp({ content: `👋 ${interaction.user} خرج من اللعبة!`, ephemeral: false });
      return;
    }

    // بدء يدوي من الهوست
    if (action === 'start') {
      if (interaction.user.id !== session.hostId) {
        return interaction.reply({ content: '⚠️ بس الهوست يقدر يبدأ!', ephemeral: true });
      }
      if (session.players.length < session.minPlayers) {
        return interaction.reply({ content: `⚠️ محتاج ${session.minPlayers} لاعبين على الأقل!`, ephemeral: true });
      }
      clearTimeout(session.timeout);
      await interaction.deferUpdate();
      await startHiding(interaction.channel, session);
      return;
    }

    // اختيار مكان للاختباء
    if (action === 'hide') {
      if (session.phase !== 'hiding') {
        return interaction.reply({ content: '⚠️ مش وقت الاختباء!', ephemeral: true });
      }
      if (!session.players.includes(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ انت مش في اللعبة!', ephemeral: true });
      }
      if (interaction.user.id === session.seekerId) {
        return interaction.reply({ content: '⚠️ انت الدوّار، مش محتاج تختبي!', ephemeral: true });
      }

      // أرسل شبكة الاختباء بشكل خاص
      await interaction.reply({
        content: '🔍 اختار مكان تختبي فيه! (بس انت تشوف الرسالة دي)',
        components: buildGrid('hide', null),
        ephemeral: true,
      });
      return;
    }

    // لما يختار رقم للاختباء
    if (action.startsWith('spot_hide_')) {
      const spot = parseInt(action.replace('spot_hide_', ''));
      if (session.hidingSpots[interaction.user.id] !== undefined) {
        return interaction.reply({ content: '✅ اخترت بالفعل!', ephemeral: true });
      }
      session.hidingSpots[interaction.user.id] = spot;
      await interaction.update({
        content: `✅ اخترت الاختباء في المكان **#${spot}**! 🤫`,
        components: [],
        ephemeral: true,
      });

      // لو كل اللاعبين اختاروا
      const activePlayers = session.players.filter(p => p !== session.seekerId);
      const hiddenPlayers = activePlayers.filter(p => session.hidingSpots[p] !== undefined);
      if (hiddenPlayers.length >= activePlayers.length) {
        clearTimeout(session.timeout);
        await startSeeking(interaction.channel, session);
      }
      return;
    }

    // الدوّار يختار مكان يفتشه
    if (action.startsWith('spot_seek_')) {
      const spot = parseInt(action.replace('spot_seek_', ''));
      if (interaction.user.id !== session.seekerId) {
        return interaction.reply({ content: '⚠️ انت مش الدوّار!', ephemeral: true });
      }

      // شوف مين في المكان ده
      const found = session.players.filter(p => session.hidingSpots[p] === spot);

      if (found.length > 0) {
        // طرد اللاعبين اللي اتلقوا
        found.forEach(p => {
          session.players = session.players.filter(id => id !== p);
          session.eliminated.push(p);
          delete session.hidingSpots[p];
        });

        const foundMentions = found.map(p => `<@${p}>`).join(', ');
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`🎯 المكان #${spot}`)
            .setDescription(`تم إيجاد: ${foundMentions} وطردهم من اللعبة! 💀`)
          ],
        });
      } else {
        await interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle(`🔍 المكان #${spot}`)
            .setDescription('المكان ده فاضي! 😮‍💨')
          ],
        });
      }

      await interaction.deferUpdate();

      // تحقق لو اللعبة انتهت
      const remaining = session.players.filter(p => p !== session.seekerId);
      if (remaining.length === 0) {
        await endGame(interaction.channel, session, null);
        return;
      }
      if (remaining.length === 1) {
        await endGame(interaction.channel, session, remaining[0]);
        return;
      }

      // جولة جديدة
      await nextRound(interaction.channel, session);
    }
  },
};

async function startHiding(channel, session) {
  session.phase = 'hiding';
  session.currentRound++;

  // اختيار دوّار عشوائي
  session.seekerId = session.players[Math.floor(Math.random() * session.players.length)];
  session.hidingSpots = {};

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('🏃 اللعبة بدأت!')
      .setDescription(
        `الدوّار هو: <@${session.seekerId}> 🔍\n\n` +
        `**اللاعبين:** ${session.players.filter(p => p !== session.seekerId).map(p => `<@${p}>`).join(', ')}\n\n` +
        `عندكم **20 ثانية** تختاروا مكان تختبوا فيه!\n` +
        `اضغطوا على زر **اختبي!** 👇`
      )
    ],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hideseek:hide')
        .setLabel('🫥 اختبي!')
        .setStyle(ButtonStyle.Primary)
    )],
  });

  // timeout 20 ثانية للاختباء
  session.timeout = setTimeout(async () => {
    // اللي مختارش مكان يتحط في مكان عشوائي
    session.players.forEach(p => {
      if (p !== session.seekerId && session.hidingSpots[p] === undefined) {
        session.hidingSpots[p] = Math.floor(Math.random() * GRID_SIZE) + 1;
      }
    });
    await startSeeking(channel, session);
  }, 20000);
}

async function startSeeking(channel, session) {
  clearTimeout(session.timeout);
  session.phase = 'seeking';

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔍 وقت التفتيش!')
      .setDescription(
        `<@${session.seekerId}> دورك تفتش!\n\n` +
        `اختار مكان من الشبكة تحت!\n` +
        `اللاعبين المتبقين: **${session.players.filter(p => p !== session.seekerId).length}** 🫥`
      )
    ],
    components: buildGrid('seek', null),
  });
}

async function nextRound(channel, session) {
  session.currentRound++;

  // دوّار جديد من اللاعبين المتبقين
  const activePlayers = session.players.filter(p => p !== session.seekerId);
  session.seekerId = activePlayers[Math.floor(Math.random() * activePlayers.length)];
  session.hidingSpots = {};
  session.phase = 'hiding';

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`🔄 جولة جديدة! (${session.currentRound})`)
      .setDescription(
        `الدوّار الجديد: <@${session.seekerId}> 🔍\n\n` +
        `اللاعبين المتبقين: ${session.players.filter(p => p !== session.seekerId).map(p => `<@${p}>`).join(', ')}\n\n` +
        `عندكم **20 ثانية** تختبوا! 👇`
      )
    ],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hideseek:hide')
        .setLabel('🫥 اختبي!')
        .setStyle(ButtonStyle.Primary)
    )],
  });

  session.timeout = setTimeout(async () => {
    session.players.forEach(p => {
      if (p !== session.seekerId && session.hidingSpots[p] === undefined) {
        session.hidingSpots[p] = Math.floor(Math.random() * GRID_SIZE) + 1;
      }
    });
    await startSeeking(channel, session);
  }, 20000);
}

async function endGame(channel, session, winnerId) {
  sessions.delete(session.channelId);

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 انتهت اللعبة!')
      .setDescription(
        winnerId
          ? `🎉 **<@${winnerId}> فاز باللعبة!** 🎉\n\nآخر واحد اختبى وما اتلقاش!`
          : '💀 كل اللاعبين اتطردوا! الدوّار فاز!'
      )
      .setFooter({ text: 'العب تاني بـ /hideseek' })
    ],
  });
}

function buildLobbyEmbed(session) {
  const playerList = session.players.length > 0
    ? session.players.map(p => `• <@${p}>`).join('\n')
    : 'لا يوجد لاعبين بعد';

  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('🔍 لعبة الاختباء!')
    .setDescription(
      '**طريقة اللعب:**\n' +
      '1️⃣ اضغط **دخول إلى اللعبة**\n' +
      '2️⃣ اختار مكان من الشبكة تختبي فيه\n' +
      '3️⃣ الدوّار يفتش في المكان\n' +
      '4️⃣ لو لقاك اتطردت!\n' +
      '5️⃣ آخر واحد مختبي يفوز!\n\n' +
      `**اللاعبين المشاركين: (${session.players.length}/15)**\n${playerList}`
    )
    .setFooter({ text: `اللعبة ستبدأ بعد 30 ثانية أو لما الهوست يضغط ابدأ | محتاج ${session.minPlayers} لاعبين` });
}

function buildJoinButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hideseek:join')
      .setLabel('دخول إلى اللعبة')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('hideseek:leave')
      .setLabel('اخرج من اللعبة')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('hideseek:start')
      .setLabel('▶️ ابدأ اللعبة')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildGrid(type, highlighted) {
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 5; c++) {
      const num = r * 5 + c + 1;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`hideseek:spot_${type}_${num}`)
          .setLabel(highlighted === num ? '🎯' : `${num}`)
          .setStyle(highlighted === num ? ButtonStyle.Danger : ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}
