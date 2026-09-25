// Content bank for the English learning app.
// Levels: beginner, intermediate, advanced

const LEVELS = ["beginner", "intermediate", "advanced"];

const LEVEL_LABELS = {
  beginner: "Başlangıç (A1-A2)",
  intermediate: "Orta Seviye (B1-B2)",
  advanced: "İleri Seviye (C1-C2)",
};

// --- Placement test ---------------------------------------------------
// Mixed-difficulty grammar/vocab questions used to estimate the user's level.
// Each question has a `weight` (1 = easy/beginner, 2 = intermediate, 3 = advanced).
const PLACEMENT_QUESTIONS = [
  {
    q: "She ___ to school every day.",
    options: ["go", "goes", "going", "gone"],
    answer: "goes",
    weight: 1,
  },
  {
    q: "I ___ a book right now.",
    options: ["read", "reads", "am reading", "have read"],
    answer: "am reading",
    weight: 1,
  },
  {
    q: "They ___ dinner when I arrived.",
    options: ["cooked", "were cooking", "have cooked", "cook"],
    answer: "were cooking",
    weight: 2,
  },
  {
    q: "If I ___ more time, I would learn French.",
    options: ["have", "had", "will have", "having"],
    answer: "had",
    weight: 2,
  },
  {
    q: "By the time we arrived, the movie ___ already ___.",
    options: ["had / started", "has / started", "was / starting", "did / start"],
    answer: "had / started",
    weight: 3,
  },
  {
    q: "She speaks English as if she ___ a native speaker.",
    options: ["is", "was", "were", "be"],
    answer: "were",
    weight: 3,
  },
  {
    q: "Choose the correct word: 'Their house is ___ than ours.'",
    options: ["big", "bigger", "biggest", "more big"],
    answer: "bigger",
    weight: 1,
  },
  {
    q: "'Despite ___ tired, she finished the race.'",
    options: ["she was", "being", "to be", "be"],
    answer: "being",
    weight: 3,
  },
  {
    q: "Pick the correct question tag: 'You like coffee, ___?'",
    options: ["don't you", "do you", "aren't you", "isn't it"],
    answer: "don't you",
    weight: 2,
  },
  {
    q: "'This is the book ___ I told you about.'",
    options: ["who", "which", "whose", "when"],
    answer: "which",
    weight: 2,
  },
];

// --- Reading passages ---------------------------------------------------
const READING = {
  beginner: [
    {
      title: "A Day at the Park",
      text: "Tom likes to go to the park on Sunday mornings. He walks his dog, Max, near the lake. Sometimes they see ducks swimming in the water. After the walk, Tom sits on a bench and drinks coffee. He feels happy and relaxed.",
      questions: [
        {
          q: "When does Tom go to the park?",
          options: ["Saturday evening", "Sunday morning", "Friday night", "Monday afternoon"],
          answer: "Sunday morning",
        },
        {
          q: "What is the name of Tom's dog?",
          options: ["Rex", "Max", "Buddy", "Charlie"],
          answer: "Max",
        },
        {
          q: "What does Tom drink on the bench?",
          options: ["Tea", "Juice", "Coffee", "Water"],
          answer: "Coffee",
        },
      ],
    },
  ],
  intermediate: [
    {
      title: "The Rise of Remote Work",
      text: "Over the past decade, remote work has become increasingly common. Many companies discovered that employees can be just as productive at home as in the office, provided they have the right tools and a quiet space. However, remote work also brings challenges, such as feelings of isolation and difficulty separating work from personal life. As a result, some businesses now offer hybrid models, combining office days with remote days.",
      questions: [
        {
          q: "According to the text, what did many companies discover?",
          options: [
            "Employees are less productive at home",
            "Employees can be equally productive at home",
            "Remote work is always better",
            "Offices are no longer needed",
          ],
          answer: "Employees can be equally productive at home",
        },
        {
          q: "What is one challenge of remote work mentioned in the text?",
          options: ["Higher salaries", "Isolation", "More meetings", "Longer commutes"],
          answer: "Isolation",
        },
        {
          q: "What solution do some businesses offer?",
          options: ["Fully remote only", "Hybrid models", "Four-day weeks", "No offices at all"],
          answer: "Hybrid models",
        },
      ],
    },
  ],
  advanced: [
    {
      title: "The Paradox of Choice",
      text: "Modern consumers are often presented with an overwhelming number of options, from streaming services to breakfast cereals. While one might assume that more choices lead to greater satisfaction, psychological research suggests the opposite can be true. This phenomenon, known as the paradox of choice, indicates that excessive options can lead to decision paralysis, anxiety, and even regret over choices made, as people wonder whether an alternative might have been better.",
      questions: [
        {
          q: "What does the 'paradox of choice' refer to?",
          options: [
            "More choices always increase happiness",
            "Excessive options can cause anxiety and regret",
            "Consumers prefer fewer products",
            "Streaming services are declining",
          ],
          answer: "Excessive options can cause anxiety and regret",
        },
        {
          q: "What might people experience after making a decision with too many options?",
          options: ["Certainty", "Regret", "Relief", "Boredom"],
          answer: "Regret",
        },
        {
          q: "What is 'decision paralysis' an example of in this text?",
          options: [
            "A benefit of having many choices",
            "A negative effect of too many choices",
            "A marketing strategy",
            "A type of streaming service",
          ],
          answer: "A negative effect of too many choices",
        },
      ],
    },
  ],
};

// --- Writing exercises (fill in the blank / grammar correction) --------
const WRITING = {
  beginner: [
    { sentence: "He ___ (be) a teacher.", options: ["am", "is", "are", "be"], answer: "is" },
    { sentence: "There ___ two cats in the garden.", options: ["is", "are", "was", "be"], answer: "are" },
    { sentence: "I ___ (not like) spicy food.", options: ["don't like", "doesn't like", "not like", "isn't like"], answer: "don't like" },
    { sentence: "She has ___ (a) apple every morning.", options: ["a", "an", "the", "no article"], answer: "an" },
    { sentence: "We ___ (go) to the cinema yesterday.", options: ["go", "goes", "went", "gone"], answer: "went" },
  ],
  intermediate: [
    { sentence: "By next year, I ___ (finish) my degree.", options: ["will finish", "will have finished", "finish", "finished"], answer: "will have finished" },
    { sentence: "She suggested ___ (go) to the beach.", options: ["to go", "going", "go", "went"], answer: "going" },
    { sentence: "The report ___ (write) by the team last week.", options: ["wrote", "was written", "is written", "has written"], answer: "was written" },
    { sentence: "I wish I ___ (know) the answer.", options: ["know", "knew", "known", "will know"], answer: "knew" },
    { sentence: "He is used to ___ (work) long hours.", options: ["work", "working", "worked", "works"], answer: "working" },
  ],
  advanced: [
    { sentence: "Had I known about the meeting, I ___ (attend).", options: ["would attend", "would have attended", "will attend", "attended"], answer: "would have attended" },
    { sentence: "Not only ___ (she / win) the race, but she also broke the record.", options: ["she won", "did she win", "she did win", "won she"], answer: "did she win" },
    { sentence: "Rarely ___ (we / see) such dedication.", options: ["we see", "do we see", "we do see", "did we saw"], answer: "do we see" },
    { sentence: "The proposal, ___ (which / present) yesterday, was well received.", options: ["which presented", "which was presented", "presenting", "which presents"], answer: "which was presented" },
    { sentence: "It is essential that he ___ (be) on time.", options: ["is", "be", "was", "will be"], answer: "be" },
  ],
};

// --- Listening exercises (text spoken via speechSynthesis) ---------------
const LISTENING = {
  beginner: [
    { text: "My name is Anna and I live in London.", q: "Where does Anna live?", options: ["Paris", "London", "Madrid", "Rome"], answer: "London" },
    { text: "The store closes at six o'clock.", q: "What time does the store close?", options: ["Five o'clock", "Six o'clock", "Seven o'clock", "Eight o'clock"], answer: "Six o'clock" },
    { text: "I would like a cup of tea, please.", q: "What does the speaker want?", options: ["Coffee", "Water", "Tea", "Juice"], answer: "Tea" },
  ],
  intermediate: [
    { text: "Although it was raining, we decided to go hiking in the mountains.", q: "What was the weather like?", options: ["Sunny", "Raining", "Snowing", "Windy"], answer: "Raining" },
    { text: "The conference has been rescheduled to next Friday due to a scheduling conflict.", q: "Why was the conference rescheduled?", options: ["Bad weather", "A scheduling conflict", "Low attendance", "Technical issues"], answer: "A scheduling conflict" },
  ],
  advanced: [
    { text: "Despite considerable criticism, the policy was implemented without any significant modifications.", q: "What happened to the policy despite criticism?", options: ["It was cancelled", "It was implemented unchanged", "It was heavily modified", "It was delayed"], answer: "It was implemented unchanged" },
    { text: "The committee's decision, though controversial, ultimately reflected the majority's long-term interests.", q: "What did the decision reflect?", options: ["Short-term gains", "The majority's long-term interests", "A minority opinion", "Financial pressure"], answer: "The majority's long-term interests" },
  ],
};

// --- Speaking / pronunciation exercises ---------------------------------
const SPEAKING = {
  beginner: [
    { text: "Hello, how are you today?", tip: "Focus on clear vowel sounds in 'hello' and 'how'." },
    { text: "I like to drink coffee in the morning.", tip: "Pay attention to the 'th' sound is not used here; practice 'coffee' stress on the first syllable." },
    { text: "The weather is nice today.", tip: "Practice the 'th' sound in 'the' and 'weather'." },
  ],
  intermediate: [
    { text: "I have been studying English for three years.", tip: "Link 'have been' smoothly and stress 'studying'." },
    { text: "Could you please repeat that more slowly?", tip: "Practice rising intonation for polite requests." },
  ],
  advanced: [
    { text: "Despite the unforeseen circumstances, the project was completed successfully.", tip: "Focus on word stress in 'unforeseen' and 'circumstances'." },
    { text: "The negotiations ultimately resulted in a mutually beneficial agreement.", tip: "Practice linking words and reducing unstressed syllables." },
  ],
};
