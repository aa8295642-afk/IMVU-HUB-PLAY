const {
  SlashCommandBuilder, EmbedBuilder,
} = require('discord.js');

const QUESTIONS = [
  // 🧮 رياضيات
  { q: 'كم ناتج 15 × 8؟', a: '120', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 144 ÷ 12؟', a: '12', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 25 + 37؟', a: '62', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 9 × 9؟', a: '81', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 100 - 43؟', a: '57', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 7 × 7؟', a: '49', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 200 ÷ 8؟', a: '25', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 13 × 4؟', a: '52', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 81 ÷ 9؟', a: '9', cat: '🧮 رياضيات' },
  { q: 'كم ناتج 17 + 56؟', a: '73', cat: '🧮 رياضيات' },

  // 🌍 معلومات عامة
  { q: 'ايه عاصمة فرنسا؟', a: 'باريس', cat: '🌍 معلومات عامة' },
  { q: 'ايه عاصمة اليابان؟', a: 'طوكيو', cat: '🌍 معلومات عامة' },
  { q: 'ايه أطول نهر في العالم؟', a: 'النيل', cat: '🌍 معلومات عامة' },
  { q: 'كم عدد قارات العالم؟', a: '7', cat: '🌍 معلومات عامة' },
  { q: 'ايه عاصمة البرازيل؟', a: 'برازيليا', cat: '🌍 معلومات عامة' },
  { q: 'ايه أكبر محيط في العالم؟', a: 'المحيط الهادي', cat: '🌍 معلومات عامة' },
  { q: 'كم عدد دول العالم تقريباً؟', a: '195', cat: '🌍 معلومات عامة' },
  { q: 'ايه عاصمة مصر؟', a: 'القاهرة', cat: '🌍 معلومات عامة' },
  { q: 'ايه أعلى جبل في العالم؟', a: 'إيفرست', cat: '🌍 معلومات عامة' },
  { q: 'ايه عاصمة السعودية؟', a: 'الرياض', cat: '🌍 معلومات عامة' },

  // ⚽ رياضة
  { q: 'مين فاز بكأس العالم 2022؟', a: 'الأرجنتين', cat: '⚽ رياضة' },
  { q: 'كام لاعب في فريق كرة القدم؟', a: '11', cat: '⚽ رياضة' },
  { q: 'مين أكثر لاعب تسجيلاً للأهداف في تاريخ كرة القدم؟', a: 'رونالدو', cat: '⚽ رياضة' },
  { q: 'في أنهي دولة أول كأس عالم؟', a: 'أوروغواي', cat: '⚽ رياضة' },
  { q: 'كام دورة أولمبية مرت؟', a: '33', cat: '⚽ رياضة' },
  { q: 'مين فاز بدوري أبطال أوروبا 2024؟', a: 'ريال مدريد', cat: '⚽ رياضة' },
  { q: 'كام لاعب في فريق كرة السلة؟', a: '5', cat: '⚽ رياضة' },
  { q: 'في أنهي دولة اخترعت كرة القدم؟', a: 'إنجلترا', cat: '⚽ رياضة' },

  // 🎮 ألعاب وأنمي
  { q: 'مين بطل لعبة ماريو؟', a: 'ماريو', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين بطل أنمي ناروتو؟', a: 'ناروتو', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين بطل أنمي دراغون بول؟', a: 'غوكو', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين بطل لعبة Minecraft؟', a: 'ستيف', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين بطل أنمي ون بيس؟', a: 'لوفي', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين صنع لعبة Minecraft؟', a: 'موجانج', cat: '🎮 ألعاب وأنمي' },
  { q: 'كام موسم في أنمي أتاك أون تايتان؟', a: '4', cat: '🎮 ألعاب وأنمي' },
  { q: 'مين بطل أنمي ديث نوت؟', a: 'لايت', cat: '🎮 ألعاب وأنمي' },

  // 🎵 موسيقى وترفيه
  { q: 'مين غنى أغنية Billie Jean؟', a: 'مايكل جاكسون', cat: '🎵 موسيقى' },
  { q: 'مين أكثر فنان مشاهدة على يوتيوب في التاريخ؟', a: 'جاستن بيبر', cat: '🎵 موسيقى' },
  { q: 'في أنهي سنة اتأسس يوتيوب؟', a: '2005', cat: '🎵 موسيقى' },
  { q: 'مين غنى أغنية Shape of You؟', a: 'إد شيران', cat: '🎵 موسيقى' },
  { q: 'مين غنى أغنية Despacito؟', a: 'لويس فونسي', cat: '🎵 موسيقى' },
];

const activeSessions = new Map();

function getRandom(arr, count) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

function normalize(str) {
  return str.trim().toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('🎯 تحدي الأسئلة — أول واحد يجاوب صح يكسب نقطة!'),

  async execute(interaction) {
    if (activeSessions.has(interaction.channelId)) {
      return interaction.reply({ content: '⚠️ في لعبة شغالة بالفعل في الشانيل ده!', ephemeral: true });
    }

    const questions = getRandom(QUESTIONS, 3);
    const session = {
      questions,
      current: 0,
      scores: {},
      hostId: interaction.user.id,
      channelId: interaction.channelId,
      timeout: null,
    };

    activeSessions.set(interaction.channelId, session);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🎯 تحدي الأسئلة بدأ!')
        .setDescription('هيكون في **3 أسئلة**\nأول واحد يكتب الإجابة الصح في الشات يكسب نقطة!\n⏱️ كل سؤال عنده **10 ثواني**')
        .setFooter({ text: 'السؤال الأول جاي...' })
      ],
    });

    await askQuestion(interaction.channel, session);
  },

  async handleMessage(message, session) {
    if (!session) return;
    const current = session.questions[session.current];
    if (!current) return;

    if (normalize(message.content) === normalize(current.a)) {
      clearTimeout(session.timeout);

      const userId = message.author.id;
      session.scores[userId] = (session.scores[userId] || 0) + 1;

      await message.reply(`✅ صح! **${message.author.username}** كسب نقطة! 🎉`);

      session.current++;

      if (session.current >= session.questions.length) {
        await endGame(message.channel, session);
      } else {
        setTimeout(() => askQuestion(message.channel, session), 2000);
      }
    }
  },
};

async function askQuestion(channel, session) {
  const current = session.questions[session.current];

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`❓ سؤال ${session.current + 1} من ${session.questions.length}`)
      .setDescription(`**${current.q}**`)
      .addFields({ name: 'الفئة', value: current.cat, inline: true })
      .setFooter({ text: '⏱️ عندك 10 ثواني!' })
    ],
  });

  session.timeout = setTimeout(async () => {
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('⏰ انتهى الوقت!')
        .setDescription(`الإجابة الصح كانت: **${current.a}**`)
      ],
    });

    session.current++;
    if (session.current >= session.questions.length) {
      await endGame(channel, session);
    } else {
      setTimeout(() => askQuestion(channel, session), 2000);
    }
  }, 10000);
}

async function endGame(channel, session) {
  activeSessions.delete(session.channelId);

  const scores = Object.entries(session.scores)
    .sort((a, b) => b[1] - a[1]);

  let leaderboard = '';
  if (scores.length === 0) {
    leaderboard = 'محدش جاوب صح 😅';
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach(([userId, score], i) => {
      leaderboard += `${medals[i] || '🏅'} <@${userId}> - **${score} نقطة**\n`;
    });
  }

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('🏆 انتهت اللعبة!')
      .setDescription('**الترتيب النهائي:**\n\n' + leaderboard)
      .setFooter({ text: 'العب تاني بـ /trivia' })
    ],
  });
}

module.exports.activeSessions = activeSessions;
