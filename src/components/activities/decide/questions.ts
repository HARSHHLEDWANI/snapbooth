/**
 * "we decide" question deck. Add a question = add one object.
 * Options are deliberately few (2–3) so consensus is possible and the
 * "convince me" round has real stakes.
 */

export interface DecideQuestion {
  emoji: string;
  q: string;
  options: string[];
}

export const DECIDE_QUESTIONS: DecideQuestion[] = [
  { emoji: '🌅', q: 'our dream first trip together goes to…', options: ['a beach at sunset', 'a mountain cabin', 'a big loud city'] },
  { emoji: '🍕', q: 'official "us" food, forever:', options: ['pizza', 'ramen', 'tacos'] },
  { emoji: '🐾', q: 'the pet we’re obviously getting:', options: ['a chaotic dog', 'a judgy cat', 'no pets — plants'] },
  { emoji: '🎬', q: 'movie night default:', options: ['comfort rewatch', 'something brand new', 'horror we’ll regret'] },
  { emoji: '🛋️', q: 'ideal saturday:', options: ['stay in, do nothing', 'out until 2am', 'a little of both'] },
  { emoji: '⏰', q: 'we are, fundamentally:', options: ['morning people', 'night owls', 'nap enthusiasts'] },
  { emoji: '🎧', q: 'road trip aux cable rule:', options: ['driver picks', 'one song each', 'one shared playlist'] },
  { emoji: '🧳', q: 'packing style as a team:', options: ['lists, weeks ahead', 'night-before chaos'] },
  { emoji: '🍳', q: 'in the kitchen, we’d be:', options: ['one cooks, one vibes', 'both cook, chaos', 'takeout champions'] },
  { emoji: '📱', q: 'texting philosophy:', options: ['reply instantly, always', 'quality over speed'] },
  { emoji: '🎉', q: 'birthdays should be:', options: ['a big surprise party', 'a quiet perfect day', 'a whole birthday WEEK'] },
  { emoji: '🌧️', q: 'perfect rainy day sound:', options: ['lo-fi + blankets', 'loud kitchen dance party', 'silence and books'] },
  { emoji: '💸', q: 'if we win a tiny lottery, we:', options: ['save it, obviously', 'one absurd splurge', 'trip. immediately.'] },
  { emoji: '🌙', q: 'our late-night deep talks are mostly:', options: ['the future', 'weird hypotheticals', 'gossip, lovingly'] },
];
