// True Faith rides on a discipline-shaped item so it gets the same dots, level
// texts and buttons. The texts are the only part that differs between builds.
export const TRUE_FAITH = {
  name: 'True Faith', type: 'discipline', img: 'icons/svg/holy-shield.svg',
  system: {
    level: 1,
    description: `<p>True Faith is conviction strong enough to hold the undead at bay. It is rated 1 to 5 and can belong to any religion: what matters is the certainty of the believer, not the symbol in their hand.</p><p><b>System:</b> Each dot adds one die to every Willpower and Virtue roll. Faith needs a Humanity of 9 or more. Below that it falls silent, and it returns when the Humanity does. Aura Perception shows the faithful with a silver or gold halo, brighter with each dot.</p>`,
    powers: {
      lvl1: { name: 'True Faith 1', desc: `<p>Brandish a holy symbol or pray aloud to hold a vampire off.</p><p><b>System:</b> Roll Faith against a difficulty equal to the vampire's current Willpower. Each success forces it one step back. With no successes it cannot advance, and on a botch it advances freely. If the symbol is pressed against the vampire's body, each success burns for one aggravated health level instead.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: 'True Faith 2', desc: `<p>The faithful can shake off Dominate and similar powers that reach into the mind.</p><p><b>System:</b> Spend Willpower to resist. One point holds for a few turns.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl3: { name: 'True Faith 3', desc: `<p>In quiet, peaceful surroundings the faithful may feel that something unclean is near, without knowing what it is.</p><p><b>System:</b> The Storyteller decides when the feeling comes, or calls for an Awareness roll. It never works in a crowd or in the middle of an argument. The faithful may also learn the Awareness ability.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl4: { name: 'True Faith 4', desc: `<p>The faithful is beyond the reach of the blood and of the powers that bend minds.</p><p><b>System:</b> The character cannot be made a ghoul and is immune to mind-altering Disciplines such as Dominate, Presence, and Obfuscate.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl5: { name: 'True Faith 5', desc: `<p>The holiness of the faithful is more than the Damned can bear. A vampire who hears them pray or preach, or who is touched by them, is overcome and must flee.</p><p><b>System:</b> To stay, the vampire spends a Willpower point each turn or succeeds on a Stamina roll each turn (difficulty 5 + its own Intelligence). A vampire that cannot get away collapses, helpless.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
    },
    elderPowers: [],
  },
  flags: { 'vtm-v20': { trueFaith: true } },
};
