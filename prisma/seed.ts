import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedQuestion = {
  text: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category: string;
  explanation: string;
  scripture: { book: string; chapter: number; verse: number; verseEnd?: number };
  options: { text: string; isCorrect: boolean }[];
};

const categories = [
  { slug: 'OLD_TESTAMENT', name: 'Old Testament' },
  { slug: 'NEW_TESTAMENT', name: 'New Testament' },
  { slug: 'PEOPLE', name: 'People' },
  { slug: 'EVENTS', name: 'Events' },
  { slug: 'TEACHINGS', name: 'Teachings' },
  { slug: 'GENERAL', name: 'General' },
];

const questions: SeedQuestion[] = [
  {
    text: 'Who built the ark before the flood?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'God commanded Noah to build an ark to preserve his family and representatives of the animals.',
    scripture: { book: 'Genesis', chapter: 6, verse: 13, verseEnd: 22 },
    options: [{ text: 'Noah', isCorrect: true }, { text: 'Moses', isCorrect: false }, { text: 'Abraham', isCorrect: false }, { text: 'Joshua', isCorrect: false }],
  },
  {
    text: 'Who led the Israelites out of Egypt?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'Moses led Israel out of Egypt after God called him and sent the plagues through him.',
    scripture: { book: 'Exodus', chapter: 3, verse: 10, verseEnd: 12 },
    options: [{ text: 'Moses', isCorrect: true }, { text: 'David', isCorrect: false }, { text: 'Samuel', isCorrect: false }, { text: 'Elijah', isCorrect: false }],
  },
  {
    text: 'Who defeated Goliath?', difficulty: 'EASY', category: 'PEOPLE',
    explanation: 'David defeated Goliath with a sling and a stone while trusting the Lord.',
    scripture: { book: '1 Samuel', chapter: 17, verse: 45, verseEnd: 50 },
    options: [{ text: 'David', isCorrect: true }, { text: 'Saul', isCorrect: false }, { text: 'Jonathan', isCorrect: false }, { text: 'Samson', isCorrect: false }],
  },
  {
    text: 'Who was known for extraordinary strength connected with his uncut hair?', difficulty: 'EASY', category: 'PEOPLE',
    explanation: 'Samson was a Nazirite judge whose strength was associated with his consecration to God and uncut hair.',
    scripture: { book: 'Judges', chapter: 16, verse: 17, verseEnd: 20 },
    options: [{ text: 'Samson', isCorrect: true }, { text: 'Gideon', isCorrect: false }, { text: 'Absalom', isCorrect: false }, { text: 'Caleb', isCorrect: false }],
  },
  {
    text: 'Which prophet was taken up to heaven in a whirlwind?', difficulty: 'MEDIUM', category: 'PEOPLE',
    explanation: 'Elijah was taken up while Elisha witnessed the event.',
    scripture: { book: '2 Kings', chapter: 2, verse: 9, verseEnd: 12 },
    options: [{ text: 'Elijah', isCorrect: true }, { text: 'Isaiah', isCorrect: false }, { text: 'Jeremiah', isCorrect: false }, { text: 'Elisha', isCorrect: false }],
  },
  {
    text: 'Who interpreted Pharaoh\'s dreams in Egypt?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'Joseph interpreted Pharaoh\'s dreams and advised Egypt to prepare for famine.',
    scripture: { book: 'Genesis', chapter: 41, verse: 14, verseEnd: 16 },
    options: [{ text: 'Joseph', isCorrect: true }, { text: 'Daniel', isCorrect: false }, { text: 'Aaron', isCorrect: false }, { text: 'Ezra', isCorrect: false }],
  },
  {
    text: 'Who was thrown into the lions\' den?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'Daniel continued praying to God despite the decree, and God shut the lions\' mouths.',
    scripture: { book: 'Daniel', chapter: 6, verse: 16, verseEnd: 23 },
    options: [{ text: 'Daniel', isCorrect: true }, { text: 'Nehemiah', isCorrect: false }, { text: 'Job', isCorrect: false }, { text: 'Ezekiel', isCorrect: false }],
  },
  {
    text: 'Which queen risked approaching the king to save her people?', difficulty: 'MEDIUM', category: 'OLD_TESTAMENT',
    explanation: 'Esther approached the king despite the danger and helped expose Haman\'s plan.',
    scripture: { book: 'Esther', chapter: 4, verse: 14, verseEnd: 16 },
    options: [{ text: 'Esther', isCorrect: true }, { text: 'Ruth', isCorrect: false }, { text: 'Deborah', isCorrect: false }, { text: 'Bathsheba', isCorrect: false }],
  },
  {
    text: 'Who was the mother of Samuel?', difficulty: 'MEDIUM', category: 'PEOPLE',
    explanation: 'Hannah prayed for a son and dedicated Samuel to the Lord.',
    scripture: { book: '1 Samuel', chapter: 1, verse: 10, verseEnd: 20 },
    options: [{ text: 'Hannah', isCorrect: true }, { text: 'Leah', isCorrect: false }, { text: 'Rachel', isCorrect: false }, { text: 'Miriam', isCorrect: false }],
  },
  {
    text: 'Who succeeded Moses as leader of Israel?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'Joshua was commissioned to lead Israel into the promised land after Moses.',
    scripture: { book: 'Joshua', chapter: 1, verse: 1, verseEnd: 9 },
    options: [{ text: 'Joshua', isCorrect: true }, { text: 'Caleb', isCorrect: false }, { text: 'Aaron', isCorrect: false }, { text: 'Samuel', isCorrect: false }],
  },
  {
    text: 'Who baptized Jesus?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'John baptized Jesus in the Jordan, where the Spirit descended like a dove.',
    scripture: { book: 'Matthew', chapter: 3, verse: 13, verseEnd: 17 },
    options: [{ text: 'John the Baptist', isCorrect: true }, { text: 'Peter', isCorrect: false }, { text: 'Andrew', isCorrect: false }, { text: 'Philip', isCorrect: false }],
  },
  {
    text: 'How many apostles did Jesus appoint?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'Jesus appointed twelve apostles to be with him and to be sent out to preach.',
    scripture: { book: 'Mark', chapter: 3, verse: 13, verseEnd: 19 },
    options: [{ text: 'Twelve', isCorrect: true }, { text: 'Seven', isCorrect: false }, { text: 'Ten', isCorrect: false }, { text: 'Seventy', isCorrect: false }],
  },
  {
    text: 'Who betrayed Jesus for thirty pieces of silver?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'Judas Iscariot agreed to hand Jesus over to the chief priests for thirty pieces of silver.',
    scripture: { book: 'Matthew', chapter: 26, verse: 14, verseEnd: 16 },
    options: [{ text: 'Judas Iscariot', isCorrect: true }, { text: 'Thomas', isCorrect: false }, { text: 'Bartholomew', isCorrect: false }, { text: 'Matthew', isCorrect: false }],
  },
  {
    text: 'Who denied knowing Jesus three times?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'Peter denied Jesus three times before the rooster crowed, as Jesus had predicted.',
    scripture: { book: 'Matthew', chapter: 26, verse: 69, verseEnd: 75 },
    options: [{ text: 'Peter', isCorrect: true }, { text: 'John', isCorrect: false }, { text: 'James', isCorrect: false }, { text: 'Andrew', isCorrect: false }],
  },
  {
    text: 'Who climbed a sycamore tree to see Jesus?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'Zacchaeus climbed a sycamore tree because he was short and wanted to see Jesus pass by.',
    scripture: { book: 'Luke', chapter: 19, verse: 1, verseEnd: 10 },
    options: [{ text: 'Zacchaeus', isCorrect: true }, { text: 'Nicodemus', isCorrect: false }, { text: 'Bartimaeus', isCorrect: false }, { text: 'Cornelius', isCorrect: false }],
  },
  {
    text: 'What did Jesus turn water into at Cana?', difficulty: 'EASY', category: 'EVENTS',
    explanation: 'Jesus performed his first recorded sign at Cana by turning water into wine.',
    scripture: { book: 'John', chapter: 2, verse: 1, verseEnd: 11 },
    options: [{ text: 'Wine', isCorrect: true }, { text: 'Oil', isCorrect: false }, { text: 'Milk', isCorrect: false }, { text: 'Blood', isCorrect: false }],
  },
  {
    text: 'What is the greatest commandment according to Jesus?', difficulty: 'MEDIUM', category: 'TEACHINGS',
    explanation: 'Jesus identified wholehearted love for God as the greatest commandment.',
    scripture: { book: 'Matthew', chapter: 22, verse: 37, verseEnd: 38 },
    options: [{ text: 'Love God with all your heart', isCorrect: true }, { text: 'Build a temple', isCorrect: false }, { text: 'Avoid all travel', isCorrect: false }, { text: 'Fast every day', isCorrect: false }],
  },
  {
    text: 'Who was the first Christian martyr recorded in Acts?', difficulty: 'MEDIUM', category: 'NEW_TESTAMENT',
    explanation: 'Stephen gave testimony about Jesus and was stoned after seeing the glory of God.',
    scripture: { book: 'Acts', chapter: 7, verse: 54, verseEnd: 60 },
    options: [{ text: 'Stephen', isCorrect: true }, { text: 'Barnabas', isCorrect: false }, { text: 'Silas', isCorrect: false }, { text: 'Philip', isCorrect: false }],
  },
  {
    text: 'Which apostle was known as a tax collector before following Jesus?', difficulty: 'EASY', category: 'PEOPLE',
    explanation: 'Jesus called Matthew, also called Levi, from the tax booth to follow him.',
    scripture: { book: 'Matthew', chapter: 9, verse: 9 },
    options: [{ text: 'Matthew', isCorrect: true }, { text: 'Simon the Zealot', isCorrect: false }, { text: 'Thomas', isCorrect: false }, { text: 'James', isCorrect: false }],
  },
  {
    text: 'Who wrote many New Testament letters and was sent to the Gentiles?', difficulty: 'MEDIUM', category: 'NEW_TESTAMENT',
    explanation: 'Paul was commissioned as an apostle to the Gentiles and wrote numerous New Testament letters.',
    scripture: { book: 'Acts', chapter: 9, verse: 1, verseEnd: 19 },
    options: [{ text: 'Paul', isCorrect: true }, { text: 'Luke', isCorrect: false }, { text: 'Timothy', isCorrect: false }, { text: 'Apollos', isCorrect: false }],
  },
  {
    text: 'Which woman showed loyalty to Naomi and became an ancestor of David?', difficulty: 'MEDIUM', category: 'OLD_TESTAMENT',
    explanation: 'Ruth remained with Naomi, married Boaz, and became part of David\'s family line.',
    scripture: { book: 'Ruth', chapter: 1, verse: 16, verseEnd: 17 },
    options: [{ text: 'Ruth', isCorrect: true }, { text: 'Orpah', isCorrect: false }, { text: 'Martha', isCorrect: false }, { text: 'Mary Magdalene', isCorrect: false }],
  },
  {
    text: 'What happened to Lazarus before Jesus called him from the tomb?', difficulty: 'EASY', category: 'EVENTS',
    explanation: 'Lazarus had died and had been in the tomb four days when Jesus raised him.',
    scripture: { book: 'John', chapter: 11, verse: 38, verseEnd: 44 },
    options: [{ text: 'He died', isCorrect: true }, { text: 'He moved to Rome', isCorrect: false }, { text: 'He became a priest', isCorrect: false }, { text: 'He was imprisoned', isCorrect: false }],
  },
  {
    text: 'Which prophet was sent to Nineveh after being swallowed by a great fish?', difficulty: 'EASY', category: 'OLD_TESTAMENT',
    explanation: 'Jonah was sent to preach to Nineveh after God delivered him from the fish.',
    scripture: { book: 'Jonah', chapter: 1, verse: 1, verseEnd: 17 },
    options: [{ text: 'Jonah', isCorrect: true }, { text: 'Nahum', isCorrect: false }, { text: 'Amos', isCorrect: false }, { text: 'Micah', isCorrect: false }],
  },
  {
    text: 'What did Solomon ask God to give him?', difficulty: 'MEDIUM', category: 'TEACHINGS',
    explanation: 'Solomon asked for an understanding mind to govern God\'s people and discern between good and evil.',
    scripture: { book: '1 Kings', chapter: 3, verse: 9, verseEnd: 12 },
    options: [{ text: 'Wisdom', isCorrect: true }, { text: 'Military strength', isCorrect: false }, { text: 'Longer life', isCorrect: false }, { text: 'More land', isCorrect: false }],
  },
  {
    text: 'Which disciple doubted Jesus\' resurrection until seeing him?', difficulty: 'EASY', category: 'NEW_TESTAMENT',
    explanation: 'Thomas said he would not believe until he saw the marks, and Jesus then invited him to see and believe.',
    scripture: { book: 'John', chapter: 20, verse: 24, verseEnd: 29 },
    options: [{ text: 'Thomas', isCorrect: true }, { text: 'Philip', isCorrect: false }, { text: 'Judas son of James', isCorrect: false }, { text: 'Matthew', isCorrect: false }],
  },
];

async function main(): Promise<void> {
  const categoryRecords = new Map<string, { id: string }>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
      select: { id: true },
    });
    categoryRecords.set(category.slug, record);
  }

  for (const question of questions) {
    if (question.options.length !== 4 || question.options.filter((option) => option.isCorrect).length !== 1) {
      throw new Error(`Invalid seed question: ${question.text}`);
    }

    const category = categoryRecords.get(question.category);
    if (!category) {
      throw new Error(`Missing seed category: ${question.category}`);
    }

    await prisma.question.create({
      data: {
        text: question.text,
        difficulty: question.difficulty,
        type: 'MULTIPLE_CHOICE',
        categoryId: category.id,
        explanation: question.explanation,
        published: true,
        options: {
          create: question.options.map((option, index) => ({
            text: option.text,
            order: index + 1,
            isCorrect: option.isCorrect,
          })),
        },
        scriptureReference: { create: question.scripture },
      },
    });
  }

  console.log(`Seeded ${questions.length} questions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
