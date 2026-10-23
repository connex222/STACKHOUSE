/** Original bot personalities: published traits and friendly table chatter.
 * No personality has access to rivals' hidden hands. */
export const BOT_PERSONAS=Object.freeze(
[
  {
    "id": 1,
    "name": "The Host",
    "style": "calm",
    "taunts": [
      "A warm welcome to this table.",
      "That was a thoughtful play.",
      "There is always another hand."
    ]
  },
  {
    "id": 2,
    "name": "The Strategist",
    "style": "planner",
    "taunts": [
      "I have a plan for this.",
      "Let us see what the next card brings.",
      "Interesting move."
    ]
  },
  {
    "id": 3,
    "name": "The Sunshine",
    "style": "cheerful",
    "taunts": [
      "Good luck, everyone!",
      "That is a lovely draw.",
      "I am having a grand time."
    ]
  },
  {
    "id": 4,
    "name": "The Gentleman",
    "style": "cautious",
    "taunts": [
      "No rush, good moves take time.",
      "A neat little turn.",
      "Well played indeed."
    ]
  },
  {
    "id": 5,
    "name": "The Rebel",
    "style": "reckless",
    "taunts": [
      "I am going for it!",
      "Fortune favours the bold.",
      "That was worth the risk."
    ]
  },
  {
    "id": 6,
    "name": "The Captain",
    "style": "planner",
    "taunts": [
      "Steady as she goes.",
      "Keeping the crew on course.",
      "A tidy manoeuvre."
    ]
  },
  {
    "id": 7,
    "name": "The Star",
    "style": "cheerful",
    "taunts": [
      "My lucky turn perhaps?",
      "A little sparkle for the table!",
      "What a wonderful game."
    ]
  },
  {
    "id": 8,
    "name": "The Professor",
    "style": "planner",
    "taunts": [
      "Fascinating probability.",
      "Let us test that theory.",
      "This result bears watching."
    ]
  },
  {
    "id": 9,
    "name": "The Drifter",
    "style": "cautious",
    "taunts": [
      "I will take the quiet path.",
      "Slow and steady this time.",
      "The next hand will tell."
    ]
  },
  {
    "id": 10,
    "name": "The Ace",
    "style": "bold",
    "taunts": [
      "I fancy my chances.",
      "That card looks promising.",
      "What a close one!"
    ]
  },
  {
    "id": 11,
    "name": "The Maverick",
    "style": "reckless",
    "taunts": [
      "I like the unexpected.",
      "Let us shake up the table.",
      "That was a bold experiment."
    ]
  },
  {
    "id": 12,
    "name": "The Gamer",
    "style": "planner",
    "taunts": [
      "Calculated!",
      "I had my eye on that.",
      "Good game, keep it going."
    ]
  },
  {
    "id": 13,
    "name": "The Duchess",
    "style": "cautious",
    "taunts": [
      "A graceful little move.",
      "Patience is an advantage.",
      "There is elegance in restraint."
    ]
  },
  {
    "id": 14,
    "name": "The Joker",
    "style": "wild-hoarder",
    "taunts": [
      "A surprise in my sleeve.",
      "You never know what comes next.",
      "I had to play that one!"
    ]
  },
  {
    "id": 15,
    "name": "The Ranger",
    "style": "cautious",
    "taunts": [
      "I am watching the table.",
      "Stay sharp out there.",
      "A clean move is best."
    ]
  },
  {
    "id": 16,
    "name": "The Trendsetter",
    "style": "bold",
    "taunts": [
      "Let us make this interesting.",
      "That is how I play it.",
      "Your turn to shine."
    ]
  }
]);
export function botPersona(id){return BOT_PERSONAS.find(persona=>persona.id===id)||BOT_PERSONAS[0];}
