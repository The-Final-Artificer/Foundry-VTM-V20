export const VTM = {};

VTM.attributes = {
  physical: ['strength', 'dexterity', 'stamina'],
  social: ['charisma', 'manipulation', 'appearance'],
  mental: ['perception', 'intelligence', 'wits']
};

VTM.abilities = {
  talents: ['alertness', 'athletics', 'awareness', 'brawl', 'empathy',
            'expression', 'intimidation', 'leadership', 'streetwise', 'subterfuge'],
  skills: ['animalKen', 'crafts', 'drive', 'etiquette', 'firearms',
           'larceny', 'melee', 'performance', 'stealth', 'survival'],
  knowledges: ['academics', 'computer', 'finance', 'investigation', 'law',
               'medicine', 'occult', 'politics', 'science', 'technology']
};

VTM.clans = [
  'Assamite', 'Brujah', 'Followers of Set', 'Gangrel', 'Giovanni',
  'Lasombra', 'Malkavian', 'Nosferatu', 'Ravnos', 'Toreador',
  'Tremere', 'Tzimisce', 'Ventrue', 'Caitiff', 'Pander'
];

VTM.clanDisciplines = {
  'Assamite':         ['Celerity', 'Obfuscate', 'Quietus'],
  'Brujah':           ['Celerity', 'Potence', 'Presence'],
  'Followers of Set': ['Obfuscate', 'Presence', 'Serpentis'],
  'Gangrel':          ['Animalism', 'Fortitude', 'Protean'],
  'Giovanni':         ['Dominate', 'Necromancy', 'Potence'],
  'Lasombra':         ['Dominate', 'Obtenebration', 'Potence'],
  'Malkavian':        ['Auspex', 'Dementation', 'Obfuscate'],
  'Nosferatu':        ['Animalism', 'Obfuscate', 'Potence'],
  'Ravnos':           ['Animalism', 'Chimerstry', 'Fortitude'],
  'Toreador':         ['Auspex', 'Celerity', 'Presence'],
  'Tremere':          ['Auspex', 'Dominate', 'Thaumaturgy'],
  'Tzimisce':         ['Animalism', 'Auspex', 'Vicissitude'],
  'Ventrue':          ['Dominate', 'Fortitude', 'Presence'],
  'Caitiff':          [],
  'Pander':           [],
};

VTM.generationTable = {
  3:  { maxBlood: 100, bloodPerTurn: 20, traitMax: 10 },
  4:  { maxBlood: 50,  bloodPerTurn: 10, traitMax: 9 },
  5:  { maxBlood: 40,  bloodPerTurn: 8,  traitMax: 8 },
  6:  { maxBlood: 30,  bloodPerTurn: 6,  traitMax: 7 },
  7:  { maxBlood: 20,  bloodPerTurn: 5,  traitMax: 6 },
  8:  { maxBlood: 15,  bloodPerTurn: 3,  traitMax: 5 },
  9:  { maxBlood: 14,  bloodPerTurn: 2,  traitMax: 5 },
  10: { maxBlood: 13,  bloodPerTurn: 1,  traitMax: 5 },
  11: { maxBlood: 12,  bloodPerTurn: 1,  traitMax: 5 },
  12: { maxBlood: 11,  bloodPerTurn: 1,  traitMax: 5 },
  13: { maxBlood: 10,  bloodPerTurn: 1,  traitMax: 5 },
  14: { maxBlood: 10,  bloodPerTurn: 1,  traitMax: 5 },
  15: { maxBlood: 10,  bloodPerTurn: 1,  traitMax: 5 }
};

VTM.healthLevels = [
  { key: 'bruised', penalty: 0 },
  { key: 'hurt', penalty: -1 },
  { key: 'injured', penalty: -1 },
  { key: 'wounded', penalty: -2 },
  { key: 'mauled', penalty: -2 },
  { key: 'crippled', penalty: -5 },
  { key: 'incapacitated', penalty: null }
];

VTM.natures = [
  'Architect', 'Autocrat', 'Bon Vivant', 'Bravo', 'Capitalist',
  'Caregiver', 'Celebrant', 'Chameleon', 'Child', 'Competitor',
  'Conformist', 'Conniver', 'Curmudgeon', 'Dabbler', 'Deviant',
  'Director', 'Enigma', 'Eye of the Storm', 'Fanatic', 'Gallant',
  'Guru', 'Idealist', 'Judge', 'Loner', 'Martyr', 'Masochist',
  'Monster', 'Pedagogue', 'Penitent', 'Perfectionist', 'Rebel',
  'Rogue', 'Sadist', 'Scientist', 'Sociopath', 'Soldier',
  'Survivor', 'Thrill-Seeker', 'Traditionalist', 'Trickster', 'Visionary'
];

VTM.paths = {
  'Humanity':                          { virtues: { conscience: 'Conscience', selfControl: 'Self-Control' }, bearing: 'Normalcy' },
  'Path of Blood':                     { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Resolve' },
  'Path of Bones':                     { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Silence' },
  'Path of the Beast':                 { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Menace' },
  'Path of Caine':                     { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Faith' },
  'Path of Cathari':                   { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Seduction' },
  'Path of Death and the Soul':        { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Silence' },
  'Path of the Feral Heart':           { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Menace' },
  'Path of Harmony':                   { virtues: { conscience: 'Conscience', selfControl: 'Self-Control' }, bearing: 'Normalcy' },
  'Path of Honorable Accord':          { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Devotion' },
  'Path of Lilith':                    { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Tribulation' },
  'Path of Metamorphosis':             { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Inhumanity' },
  'Path of Night':                     { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Darkness' },
  'Path of Paradox':                   { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Confidence' },
  'Path of Power and the Inner Voice': { virtues: { conscience: 'Conviction', selfControl: 'Instinct' },    bearing: 'Command' },
  'Path of Typhon':                    { virtues: { conscience: 'Conviction', selfControl: 'Self-Control' }, bearing: 'Devotion' },
};

// Humanity bearing scale (index = rating, 0-10)
VTM.bearingLabels = [
  'Monstrous', 'Horrific', 'Bestial', 'Cold', 'Unfeeling',
  'Distant', 'Removed', 'Normal', 'Caring', 'Compassionate', 'Saintly'
];

// Difficulty modifier by path/humanity rating
VTM.bearingModifiers = { 10: -2, 9: -1, 8: -1, 7: 0, 6: 0, 5: 0, 4: 0, 3: 1, 2: 1, 1: 2, 0: null };

VTM.meritTypes = ['physical', 'social', 'mental', 'supernatural'];
VTM.damageTypes = ['bashing', 'lethal', 'aggravated'];
VTM.concealOptions = ['P', 'J', 'T', 'N'];
