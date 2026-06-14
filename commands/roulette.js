const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
} = require('discord.js');
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

// ===== شرح اللعبة =====
const EXPLANATION = [
  '🇸🇦 **عربي:**',
  '> **1-** اختر الرقم الذي سيمثلك في اللعبة',
  '> **2-** ستبدأ الجولة الأولى وسيتم تدوير العجلة واختيار لاعب عشوائي',
  '> **3-** إذا كنت اللاعب المختار، فستختار لاعباً من اللاعبين ليتم طرده من اللعبة',
  '> **4-** يُطرد اللاعب وتبدأ جولة جديدة. لما يبقى لاعبان فقط، اللاعب اللي تقع عليه العجلة **يفوز!**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🇺🇸 **English:**',
  '> **1-** Choose your number to join the game',
  '> **2-** The wheel spins and randomly selects a player',
  '> **3-** If selected, you choose another player to eliminate',
  '> **4-** Last 2 players left — the wheel spins and the selected player **wins!**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🇧🇷 **Português:**',
  '> **1-** Escolha seu número para entrar no jogo',
  '> **2-** A roda gira e seleciona um jogador aleatoriamente',
  '> **3-** Se selecionado, você escolhe outro jogador para eliminar',
  '> **4-** Últimos 2 jogadores — a roda gira e o selecionado **vence!**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🇫🇷 **Français:**',
  '> **1-** Choisissez votre numéro pour rejoindre le jeu',
  '> **2-** La roue tourne et sélectionne un joueur au hasard',
  '> **3-** Si sélectionné, vous choisissez un autre joueur à éliminer',
  '> **4-** 2 joueurs restants — la roue tourne et le joueur sélectionné **gagne!**',
].join('\n');

// ===== تخزين الجلسات =====
const sessions = new Map();

// ===== توليد صورة العجلة =====
function generateWheel(players, winnerIdx) {
  const os       = require('os');
  const tmpPath  = path.join(os.tmpdir(), `wheel_${Date.now()}.png`);
  const jsonPath = path.join(os.tmpdir(), `players_${Date.now()}.json`);
  const pyScript = path.join(__dirname, '..', 'wheel.py');

  // نحفظ JSON في ملف مؤقت بدل ما نمرره كـ argument (يحل مشكلة Windows)
  const playersData = players.map(p => ({ number: p.number, username: p.username }));
  fs.writeFileSync(jsonPath, JSON.stringify(playersData), 'utf8');

  const pythonCmds = ['python3', 'python'];
  let success = false;
  for (const cmd of pythonCmds) {
    try {
      execSync(`${cmd} "${pyScript}" "${jsonPath}" ${winnerIdx} "${tmpPath}"`, {
        timeout: 15000,
        windowsHide: true,
      });
      success = true;
      break;
    } catch(e) {
      continue;
    }
  }

  try { fs.unlinkSync(jsonPath); } catch(_) {}
  if (!success) throw new Error('Python not found');
  const buf = fs.readFileSync(tmpPath);
  try { fs.unlinkSync(tmpPath); } catch(_) {}
  return buf;
}

// ===== Embeds =====
function explainEmbed() {
  return new EmbedBuilder()
    .setColor(0xff6b00)
    .setTitle('🎡 رولـيـت  |  Roulette  |  Roleta  |  Roulette')
    .setDescription(EXPLANATION)
    .setFooter({ text: '🎮 IMVU HUB PLAY' });
}

function lobbyEmbed(session) {
  const list = session.players.length
    ? session.players.map(p => `> 🔵 **${p.number}** : <@${p.userId}>`).join('\n')
    : '> No players yet...';
  return new EmbedBuilder()
    .setColor(0xff6b00)
    .setTitle('🎡 Roulette — Join the Game!')
    .setDescription(`**Players:**\n${list}\n\n> 👥 Count: **${session.players.length}**\n> ⚠️ Need at least **3 players** to start`)
    .setFooter({ text: '🎮 IMVU HUB PLAY — Press Join to participate!' });
}

function gameEmbed(session, msg = '') {
  const list = session.players.map(p =>
    p.eliminated
      ? `> ~~**${p.number}** : ${p.username}~~ ❌`
      : `> **${p.number}** : <@${p.userId}>`
  ).join('\n');
  const alive = session.players.filter(p => !p.eliminated).length;
  return new EmbedBuilder()
    .setColor(0xff6b00)
    .setTitle(`🎡 Roulette — Round ${session.round}`)
    .setDescription(`**Players:**\n${list}\n\n${msg ? `> ${msg}\n\n` : ''}> 👥 Remaining: **${alive}**`)
    .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette' });
}

// ===== أزرار اللوبي =====
function lobbyButtons(session) {
  const alreadyJoined = session.players.map(p => p.userId);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('روليت:join')
        .setLabel('✅ Join Game')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('روليت:leave')
        .setLabel('❌ Leave')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('روليت:start_game')
        .setLabel('🎡 Start Game!')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(session.players.length < 3),
    )
  ];
}

// ===== رقم عشوائي غير مستخدم =====
function getRandomNumber(session) {
  const taken = new Set(session.players.map(p => p.number));
  const available = [];
  for (let i = 1; i <= 20; i++) if (!taken.has(i)) available.push(i);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ===== أزرار الطرد =====
function eliminateButtons(session, excludeId) {
  const alive = session.players.filter(p => !p.eliminated && p.userId !== excludeId);
  const rows  = [];
  let   row   = new ActionRowBuilder();
  alive.forEach((p, i) => {
    if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`روليت:eliminate:${p.userId}`)
        .setLabel(`${p.number} — ${p.username}`)
        .setStyle(ButtonStyle.Danger)
    );
  });
  if (alive.length > 0) rows.push(row);
  return rows.slice(0, 5);
}

// ===== دوران العجلة =====
async function spinWheel(channel, session) {
  const alive = session.players.filter(p => !p.eliminated);

  // اختيار الفائز عشوائياً
  const winnerIdx  = Math.floor(Math.random() * alive.length);
  const selected   = alive[winnerIdx];

  // اخترنا — الآن نولّد الصورة
  // نعثر على index اللاعب في المصفوفة الأصلية
  const allAlive   = session.players.filter(p => !p.eliminated);
  const imgPlayers = allAlive.map(p => ({ number: p.number, username: p.username }));
  const imgWinner  = winnerIdx;

  let wheelBuf;
  try {
    wheelBuf = generateWheel(imgPlayers, imgWinner);
  } catch(e) {
    console.error('Wheel gen error:', e);
  }

  const isLastTwo = alive.length === 2;

  if (isLastTwo) {
    // 🏆 فوز!
    const attachment = wheelBuf ? new AttachmentBuilder(wheelBuf, { name: 'wheel.png' }) : null;
    await channel.send({
      content: `🎉 <@${selected.userId}> **won the game!** Congratulations! 🏆`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🏆 Game Over!')
          .setDescription(`## 🥇 Winner is <@${selected.userId}> — number **${selected.number}**!\n\n🎊 Congratulations on your win!`)
          .setImage(attachment ? 'attachment://wheel.png' : null)
          .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette' })
      ],
      files: attachment ? [attachment] : [],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('روليت:new_game').setLabel('🔄 New Game').setStyle(ButtonStyle.Success)
      )]
    });
    sessions.delete(channel.id);
    return;
  }

  // مش آخر جولة
  const attachment = wheelBuf ? new AttachmentBuilder(wheelBuf, { name: 'wheel.png' }) : null;
  const spinMsg = await channel.send({
    content: `🎡 🎡 The wheel selected: <@${selected.userId}> — number **${selected.number}**!\n⚡ يا <@${selected.userId}>، **You have 30 seconds** to choose a player to eliminate! Or you will be eliminated!`,
    embeds: [
      new EmbedBuilder()
        .setColor(0xff6b00)
        .setTitle(`🎡 Round ${session.round} — Selected!`)
        .setDescription(`The wheel landed on: **${selected.number}** — <@${selected.userId}>`)
        .setImage(attachment ? 'attachment://wheel.png' : null)
        .setFooter({ text: '🎮 IMVU HUB PLAY — Roulette' })
    ],
    files: attachment ? [attachment] : [],
    components: eliminateButtons(session, selected.userId),
  });

  session.spinMessage   = spinMsg;
  session.selectedPlayer = selected;
  session.waitingElim   = true;

  // تايمر 30 ثانية — لو ما اختارش يتطرد هو
  session.elimTimeout = setTimeout(async () => {
    if (!session.waitingElim) return;
    await eliminatePlayer(channel, session, selected, true);
  }, 30_000);
}

// ===== طرد لاعب =====
async function eliminatePlayer(channel, session, target, auto = false) {
  session.waitingElim = false;
  clearTimeout(session.elimTimeout);
  target.eliminated = true;
  session.round++;

  const autoTxt = auto ? ' (Time out — auto eliminated! ⏰)' : '';
  await channel.send({
    content: `❌ Eliminated: **${target.number}** — <@${target.userId}>${autoTxt}`,
    embeds: [gameEmbed(session, '🎡 Round القادمة تبدأ بعد 3 ثواني...')],
  });

  if (session.spinMessage) {
    try { await session.spinMessage.edit({ components: [] }); } catch(_) {}
  }

  await new Promise(r => setTimeout(r, 3000));
  await spinWheel(channel, session);
}

// ===== Export =====
module.exports = {
  data: new SlashCommandBuilder()
    .setName('روليت')
    .setDescription('🎡 لعبة الروليت — آخر لاعب يبقى هو الفائز!'),

  async execute(interaction) {
    await interaction.reply({
      embeds: [explainEmbed()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('روليت:open_lobby').setLabel('🎡 Start Game!').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('روليت:close_explain').setLabel('❌ إلغاء').setStyle(ButtonStyle.Secondary),
      )],
    });
  },

  async handleButton(interaction, action, args) {
    if (action === 'close_explain') {
      return interaction.update({ components: [] });
    }

    if (action === 'open_lobby') {
      const session = {
        hostId: interaction.user.id,
        players: [], round: 1,
        selectedPlayer: null, spinMessage: null,
        waitingElim: false, elimTimeout: null,
      };
      sessions.set(interaction.channelId, session);
      return interaction.update({ embeds: [lobbyEmbed(session)], components: lobbyButtons(session) });
    }

    const session = sessions.get(interaction.channelId);
    if (!session) return interaction.reply({ content: '❌ No active game! Use `/روليت` to start.', ephemeral: true });

    // ===== انضمام =====
    if (action === 'join') {
      if (session.players.find(p => p.userId === interaction.user.id))
        return interaction.reply({ content: '⚠️ You already joined the game!', ephemeral: true });
      const num = getRandomNumber(session);
      if (!num)
        return interaction.reply({ content: '❌ Game is full! (max 20 players)', ephemeral: true });
      session.players.push({ userId: interaction.user.id, username: interaction.user.username, number: num, eliminated: false });
      session.players.sort((a,b) => a.number - b.number);
      await interaction.reply({ content: `✅ You joined! Your number is: **${num}**`, ephemeral: true });
      await interaction.message.edit({ embeds: [lobbyEmbed(session)], components: lobbyButtons(session) });
      return;
    }

    // ===== بدء اللعبة =====
    if (action === 'start_game') {
      if (interaction.user.id !== session.hostId)
        return interaction.reply({ content: '❌ Only the host can start the game!', ephemeral: true });
      if (session.players.length < 3)
        return interaction.reply({ content: '❌ You need at least 3 players!', ephemeral: true });

      await interaction.update({ embeds: [gameEmbed(session, '🎡 Game started! Spinning the wheel...')], components: [] });
      await spinWheel(interaction.channel, session);
      return;
    }

    // ===== طرد =====
    if (action === 'eliminate') {
      if (!session.waitingElim) return;
      if (session.selectedPlayer?.userId !== interaction.user.id)
        return interaction.reply({ content: '⚠️ It is not your turn to choose!', ephemeral: true });
      const target = session.players.find(p => p.userId === args[0] && !p.eliminated);
      if (!target) return interaction.reply({ content: '❌ Player not found!', ephemeral: true });
      await interaction.deferUpdate();
      await eliminatePlayer(interaction.channel, session, target, false);
      return;
    }

    // ===== لعبة جديدة =====
    if (action === 'new_game') {
      const s = { hostId: interaction.user.id, players: [], round: 1, selectedPlayer: null, spinMessage: null, waitingElim: false, elimTimeout: null };
      sessions.set(interaction.channelId, s);
      return interaction.update({ embeds: [lobbyEmbed(s)], components: lobbyButtons(s) });
    }
  },
};
