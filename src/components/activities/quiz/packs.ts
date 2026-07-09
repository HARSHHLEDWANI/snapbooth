/** Question packs for "how well do you know me".
 *  One partner answers as themselves (the truth), the other guesses.
 *  All multiple-choice so answers can match exactly. */

export interface QuizQ {
  q: string;
  options: [string, string, string, string];
}

export interface QuizPack {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  questions: QuizQ[];
}

export const QUIZ_PACKS: QuizPack[] = [
  {
    id: 'cute',
    name: 'cute',
    emoji: '🍓',
    blurb: 'soft ones about us',
    questions: [
      { q: 'what’s my ideal date night?', options: ['cozy movie night', 'fancy dinner out', 'long evening walk', 'games until 2am'] },
      { q: 'how do i show love most?', options: ['little gifts', 'sweet words', 'quality time', 'acts of service'] },
      { q: 'what makes me smile fastest?', options: ['a silly meme', 'a compliment', 'food arriving', 'your voice'] },
      { q: 'my comfort food is…', options: ['something cheesy', 'something sweet', 'something spicy', 'whatever you’re having'] },
      { q: 'the pet name i secretly like most?', options: ['baby', 'love', 'a silly nickname', 'my actual name, said softly'] },
      { q: 'my favourite kind of hug?', options: ['the quick squeeze', 'the long slow one', 'the surprise-from-behind', 'the almost-tackle'] },
      { q: 'what do i want after a bad day?', options: ['to vent it all out', 'distraction and jokes', 'quiet company', 'solutions, please'] },
      { q: 'which tiny gesture melts me?', options: ['forehead kisses', 'holding hands', 'remembering small things', 'good-morning texts'] },
      { q: 'my love song energy is…', options: ['slow and dreamy', 'upbeat and dancey', 'acoustic and soft', 'dramatic and loud'] },
      { q: 'if we adopted a pet tomorrow, i’d want…', options: ['a cat', 'a dog', 'something tiny (hamster!)', 'a plant, let’s be real'] },
      { q: 'the first thing i noticed about you?', options: ['your smile', 'your eyes', 'your laugh', 'your whole vibe'] },
      { q: 'my ideal lazy sunday together?', options: ['breakfast in bed', 'binge-watching shows', 'cooking together', 'napping, obviously'] },
      { q: 'what am i most likely to steal from you?', options: ['your hoodie', 'your fries', 'your playlists', 'your blanket'] },
      { q: 'how do i act when i miss you?', options: ['spam your phone', 'go quiet and mopey', 'get extra busy', 'stalk our old photos'] },
      { q: 'our couple superpower would be…', options: ['reading minds', 'never getting bored', 'perfect comfort silence', 'laughing at nothing'] },
    ],
  },
  {
    id: 'silly',
    name: 'silly',
    emoji: '🦆',
    blurb: 'chaotic little questions',
    questions: [
      { q: 'in a zombie apocalypse, i would…', options: ['have a full survival plan', 'be the comic relief', 'cry but survive anyway', 'befriend the zombies'] },
      { q: 'my most unhinged 3am thought is about…', options: ['space and aliens', 'an old embarrassing moment', 'food i could be eating', 'a fight i won in my head'] },
      { q: 'if i were a kitchen appliance i’d be…', options: ['a chaotic blender', 'a reliable rice cooker', 'a dramatic kettle', 'a mysterious air fryer'] },
      { q: 'what would i do with 24 hours of invisibility?', options: ['eavesdrop on everyone', 'nap somewhere forbidden', 'elaborate pranks', 'sneak into a concert'] },
      { q: 'my villain origin story would start with…', options: ['slow walkers', 'bad wifi', 'someone eating my leftovers', 'group projects'] },
      { q: 'which conspiracy would i lowkey believe?', options: ['birds aren’t real', 'aliens built everything', 'my phone is listening', 'none, i’m the sceptic'] },
      { q: 'if i were a bread, i’d be…', options: ['a soft milk bun', 'a dramatic baguette', 'a chaotic croissant', 'sturdy dependable toast'] },
      { q: 'my go-to karaoke disaster song?', options: ['an emotional ballad', 'an old bollywood banger', 'a rap i can’t actually do', 'whatever’s trending'] },
      { q: 'what would i name our imaginary boat?', options: ['something romantic', 'a terrible pun', 'my own name', 'the unsinkable 2'] },
      { q: 'in a heist movie, my role is…', options: ['the mastermind', 'the distraction', 'the one who trips the alarm', 'the getaway driver'] },
      { q: 'my most irrational fear?', options: ['deep water', 'moths / bugs', 'being perceived', 'mirrors at night'] },
      { q: 'if animals could talk, which would be rudest?', options: ['cats, obviously', 'geese', 'seagulls', 'hamsters (tiny rage)'] },
      { q: 'my browser history is mostly…', options: ['weird food questions', '“is it normal to…”', 'shopping carts i abandon', 'lore deep-dives'] },
      { q: 'what would i do if i won the lottery today?', options: ['tell no one and vanish', 'buy something ridiculous first', 'spreadsheet immediately', 'fly to you, obviously'] },
      { q: 'my sleep style is…', options: ['starfish, whole bed', 'burrito in the blanket', 'perfectly still statue', 'gremlin position'] },
    ],
  },
  {
    id: 'deep',
    name: 'deep',
    emoji: '🌙',
    blurb: 'the 2am conversations',
    questions: [
      { q: 'what do i value most in us?', options: ['honesty', 'laughter', 'loyalty', 'growth'] },
      { q: 'when i imagine “home”, it’s…', options: ['a place we make together', 'wherever you are', 'my childhood one', 'still figuring it out'] },
      { q: 'what am i most afraid of losing?', options: ['the people i love', 'my independence', 'time', 'who i am'] },
      { q: 'how do i handle big changes?', options: ['plan everything', 'feel first, adapt later', 'pretend i’m fine', 'honestly? thrive'] },
      { q: 'what recharges me most?', options: ['being alone a while', 'deep conversation', 'nature and quiet', 'being around my people'] },
      { q: 'my biggest dream for us is…', options: ['travelling the world', 'a calm little life', 'building something together', 'never becoming boring'] },
      { q: 'what do i wish i could tell my younger self?', options: ['it gets better', 'worry less', 'be braver', 'you’re enough already'] },
      { q: 'i feel most proud of myself when…', options: ['i keep a promise', 'i help someone', 'i survive a hard week', 'i grow past old me'] },
      { q: 'in conflict, what do i need first?', options: ['space to cool off', 'to feel heard', 'a hug before words', 'to solve it right now'] },
      { q: 'what does “success” secretly mean to me?', options: ['peace of mind', 'making my people proud', 'freedom over my time', 'leaving something behind'] },
      { q: 'the hardest thing for me to say is…', options: ['“i need help”', '“i was wrong”', '“i’m not okay”', '“no”'] },
      { q: 'i feel closest to you when…', options: ['we talk about everything', 'we’re quiet together', 'we laugh until it hurts', 'you show up for me'] },
      { q: 'what part of the future scares me most?', options: ['distance between us', 'not enough time', 'changing too much', 'honestly, nothing much'] },
      { q: 'my love, at its core, is…', options: ['protective', 'playful', 'patient', 'all-in, always'] },
      { q: 'if tonight were endless, i’d want us to…', options: ['talk until sunrise', 'wander somewhere new', 'do absolutely nothing together', 'dance in the kitchen'] },
    ],
  },
];
