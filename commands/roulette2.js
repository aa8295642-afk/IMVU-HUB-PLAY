const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ===== شرح اللعبة =====
const EXPLANATION = [
  '🇺🇸 **English:**',
  '> **1.** Press **Join** to enter — you get a random number',
  '> **2.** The wheel spins and lands on a random player',
  '> **3.** That player **must** choose someone to eliminate',
  '> **4.** If they don\'t choose in **30 seconds**, they get eliminated instead!',
  '> **5.** Last 2 players — wheel spins again, winner is selected! 🏆',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🇸🇦 **عربي:**',
  '> **1.** اضغط **Join** للدخول — ستحصل على رقم عشوائي',
  '> **2.** تدور العجلة وتقف على لاعب عشوائي',
  '> **3.** ذلك اللاعب **يجب** أن يختار شخصاً لطرده',
  '> **4.** إذا لم يختر خلال **30 ثانية**، سيُطرد هو بدلاً منه!',
  '> **5.** آخر لاعبان — العجلة تدور مرة أخيرة والفائز يُختار! 🏆',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🇪🇸 **Español:**',
  '> **1.** Presiona **Join** para entrar — recibirás un número aleatorio',
  '> **2.** La ruleta gira y cae en un jugador aleatorio',
  '> **3.** Ese jugador **debe** elegir a alguien para eliminar',
  '> **4.** Si no elige en **30 segundos**, ¡será eliminado él mismo!',
  '> **5.** Últimos 2 jugadores — la ruleta gira una última vez y elige al ganador! 🏆',
].join('\n');

const sessions = new Map();

// ===== توليد GIF =====
function generateWheel(players, winnerIdx) {
  const tmpJson  = path.join(os.tmpdir(), `rpl2_${Date.now()}.json`);
  const tmpGif   = path.join(os.tmpdir(), `rpl2_${Date.now()}.gif`);
  const pyScript = path.join(__dirname, '..', 'wheel.py');

  fs.writeFileSync(tmpJson, JSON.stringify(
    players.map(p => ({ number: p.number, username: p.username }))
  ), 'utf8');

  const cmds = ['python3', 'python'];
  let ok = false;
  for (const cmd of cmds) {
    try {
      execSync(`${cmd} "${pyScript}" "${tmpJson}" ${winnerIdx} "${tmpGif}"`, {
        timeout: 30000, windowsHide: true,
      });
      ok = true; break;
    } catch(_) {}
  }

  try { fs.unlinkSync(tmpJson); } catch(_) {}
  if (!ok) return null;
  const buf = fs.readFileSync(tmpGif);
  try { fs.unlinkSync(tmpGif); } catch(_) {}
  return buf;
}

// ===== Embeds =====
function explainEmbed() {
  return new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle('🎡  R O U L E T T E  2')
    .setDescription(EXPLANATION)
    .setFooter({ text: '🎮 IMVU HUB PLAY — Owner only' });
}

function lobbyEmbed(session) {
  const list = session.players.length
    ? session.players.map(p => `> 🔴 **${p.number}** — <@${p.userId}>`).join('\n')
    : '> *No players yet...*';
  return new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle('🎡 Roulette 2 — Lobby')
    .setDescription(
      `**Players:**\n${list}\n\n` +
      `> 👥 Count: **${session.players.length}**\n` +
      `> ⚠️ Need at least **3 players** to start`
    )
    .setFooter({ text: '🎮 IMVU HUB PLAY — Press Join to participate!' });
}

function gameEmbed(session, msg = '') {
  const list = session.players.map(p =>
    p.eliminated
      ? `> ~~**${p.number}** — ${p.username}~~ ❌`
      : `> **${p.number}** — <@${p.userId}>`
  ).join('\n');
  const alive = session.players.filter(p => !p.eliminated).length;
  return new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle(`🎡 Roulette 2 — Round ${session.round}`)
    .setDescription(
      `**Players:**\n${list}\n\n` +
      (msg ? `> ${msg}\n\n` : '') +
      `> 👥 Remaining: **${alive}**`
    )
    .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette 2' });
}

function lobbyButtons(session) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('روليت2:join')
      .setLabel('✅ Join')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('روليت2:leave')
      .setLabel('❌ Leave')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('روليت2:start_game')
      .setLabel('🎡 Start!')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(session.players.length < 3),
  )];
}

function eliminateButtons(session, excludeId) {
  const alive = session.players.filter(p => !p.eliminated && p.userId !== excludeId);
  const rows  = [];
  let   row   = new ActionRowBuilder();
  alive.forEach((p, i) => {
    if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`روليت2:eliminate:${p.userId}`)
        .setLabel(`${p.number} — ${p.username}`)
        .setStyle(ButtonStyle.Danger)
    );
  });
  if (alive.length > 0) rows.push(row);
  return rows.slice(0, 5);
}

function getRandomNumber(session) {
  const taken = new Set(session.players.map(p => p.number));
  const avail = [];
  for (let i = 1; i <= 20; i++) if (!taken.has(i)) avail.push(i);
  if (!avail.length) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

function isAdmin(interaction) {
  return interaction.guild.ownerId === interaction.user.id ||
    interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

// ===== دوران العجلة =====
async function spinWheel(channel, session) {
  const alive     = session.players.filter(p => !p.eliminated);
  const winnerIdx = Math.floor(Math.random() * alive.length);
  const selected  = alive[winnerIdx];
  const isLastTwo = alive.length === 2;

  const gifBuf    = generateWheel(alive, winnerIdx);
  const attachment = gifBuf ? new AttachmentBuilder(gifBuf, { name: 'wheel.gif' }) : null;

  if (isLastTwo) {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Game Over!')
      .setDescription(
        `## 🥇 Winner: <@${selected.userId}> — #${selected.number}!\n\n🎊 **Congratulations!**`
      )
      .setImage(attachment ? 'attachment://wheel.gif' : null)
      .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette 2' });

    await channel.send({
      content: `🎉 <@${selected.userId}> **won the game!** Congratulations! 🏆`,
      embeds:  [embed],
      files:   attachment ? [attachment] : [],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('روليت2:new_game')
          .setLabel('🔄 New Game')
          .setStyle(ButtonStyle.Primary)
      )],
    });

    sessions.delete(channel.id);
    return;
  }

  // مش آخر جولة — اللاعب المختار يطرد شخص
  const embed = new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle(`🎡 Round ${session.round} — Selected!`)
    .setDescription(`The wheel landed on: **#${selected.number}** — <@${selected.userId}>`)
    .setImage(attachment ? 'attachment://wheel.gif' : null)
    .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette 2' });

  const spinMsg = await channel.send({
    content: `🎡 <@${selected.userId}> — **You have 30 seconds** to choose a player to eliminate! Or **you** will be eliminated! ⚡`,
    embeds:  [embed],
    files:   attachment ? [attachment] : [],
    components: eliminateButtons(session, selected.userId),
  });

  session.spinMessage    = spinMsg;
  session.selectedPlayer = selected;
  session.waitingElim    = true;

  // لو ما اختارش في 30 ثانية — هو اللي يتطرد
  session.elimTimeout = setTimeout(async () => {
    if (!session.waitingElim) return;
    await eliminatePlayer(channel, session, selected, true);
  }, 30_000);
}

async function eliminatePlayer(channel, session, target, auto = false) {
  session.waitingElim = false;
  clearTimeout(session.elimTimeout);
  target.eliminated = true;
  session.round++;

  const autoTxt = auto ? ' *(time out — auto eliminated ⏰)*' : '';

  if (session.spinMessage) {
    try { await session.spinMessage.edit({ components: [] }); } catch(_) {}
  }

  await channel.send({
    content: `❌ **#${target.number} — ${target.username}** has been eliminated!${autoTxt}`,
    embeds:  [gameEmbed(session, '🎡 Next round starts in 3 seconds...')],
  });

  await new Promise(r => setTimeout(r, 3000));
  await spinWheel(channel, session);
}

// ===== Export =====
module.exports = {
  data: new SlashCommandBuilder()
    .setName('روليت2')
    .setDescription('🎡 Roulette 2 — the wheel picks who eliminates!')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({
      embeds: [explainEmbed()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('روليت2:open_lobby')
          .setLabel('🎡 Start Game!')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('روليت2:close_explain')
          .setLabel('✖ Close')
          .setStyle(ButtonStyle.Secondary),
      )],
    });
  },

  async handleButton(interaction, action, args) {
    if (action === 'close_explain')
      return interaction.update({ components: [] });

    if (action === 'open_lobby') {
      const session = {
        hostId: interaction.user.id,
        players: [], round: 1,
        selectedPlayer: null, spinMessage: null,
        waitingElim: false, elimTimeout: null,
      };
      sessions.set(interaction.channelId, session);
      return interaction.update({
        embeds: [lobbyEmbed(session)],
        components: lobbyButtons(session),
      });
    }

    const session = sessions.get(interaction.channelId);
    if (!session)
      return interaction.reply({ content: '❌ No active game! Use `/روليت2` to start.', ephemeral: true });

    if (action === 'join') {
      if (session.players.find(p => p.userId === interaction.user.id))
        return interaction.reply({ content: '⚠️ You already joined!', ephemeral: true });
      const num = getRandomNumber(session);
      if (!num)
        return interaction.reply({ content: '❌ Game is full! (max 20)', ephemeral: true });
      session.players.push({ userId: interaction.user.id, username: interaction.user.username, number: num, eliminated: false });
      session.players.sort((a, b) => a.number - b.number);
      await interaction.reply({ content: `✅ You joined! Your number is: **#${num}**`, ephemeral: true });
      await interaction.message.edit({ embeds: [lobbyEmbed(session)], components: lobbyButtons(session) });
      return;
    }

    if (action === 'leave') {
      const idx = session.players.findIndex(p => p.userId === interaction.user.id);
      if (idx === -1)
        return interaction.reply({ content: '⚠️ You are not in the game!', ephemeral: true });
      session.players.splice(idx, 1);
      await interaction.reply({ content: '👋 You left the game!', ephemeral: true });
      await interaction.message.edit({ embeds: [lobbyEmbed(session)], components: lobbyButtons(session) });
      return;
    }

    if (action === 'start_game') {
      if (!isAdmin(interaction))
        return interaction.reply({ content: '❌ Only the server owner/admin can start the game!', ephemeral: true });
      if (session.players.length < 3)
        return interaction.reply({ content: '❌ Need at least 3 players!', ephemeral: true });

      await interaction.update({
        embeds: [gameEmbed(session, '🎡 Game started! Spinning the wheel...')],
        components: [],
      });
      await spinWheel(interaction.channel, session);
      return;
    }

    if (action === 'eliminate') {
      if (!session.waitingElim) return;
      if (session.selectedPlayer?.userId !== interaction.user.id)
        return interaction.reply({ content: '⚠️ It\'s not your turn!', ephemeral: true });
      const target = session.players.find(p => p.userId === args[0] && !p.eliminated);
      if (!target)
        return interaction.reply({ content: '❌ Player not found!', ephemeral: true });
      await interaction.deferUpdate();
      await eliminatePlayer(interaction.channel, session, target, false);
      return;
    }

    if (action === 'new_game') {
      if (!isAdmin(interaction))
        return interaction.reply({ content: '❌ Only the server owner/admin can start a new game!', ephemeral: true });
      const s = {
        hostId: interaction.user.id,
        players: [], round: 1,
        selectedPlayer: null, spinMessage: null,
        waitingElim: false, elimTimeout: null,
      };
      sessions.set(interaction.channelId, s);
      return interaction.update({ embeds: [lobbyEmbed(s)], components: lobbyButtons(s) });
    }
  },
};
