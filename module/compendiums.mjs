const DISCIPLINES = [
  {
    name: 'Animalism', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Animalism.png',
    system: { level: 0, description: '<p>Animalism grants a vampire dominion over the animal kingdom, allowing communication with and control over beasts. At higher levels, the Kindred can even reach into the Beast within mortals and other vampires.</p>', powers: {
      lvl1: { name: 'Feral Whispers', desc: `<p>The vampire establishes an empathic link with an animal through eye contact, allowing communication and simple commands. The animal is favorably disposed but not compelled to obey.</p><p><b>System:</b> Roll Manipulation + Animal Ken. Difficulty depends on the animal type: predatory mammals (diff 6), other mammals/predatory birds (diff 7), other birds/reptiles (diff 8). More successes mean stronger, longer-lasting commands. Cannot force an animal to act against its nature or risk its life.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.animalKen', difficulty: 6, cost: '' },
      lvl2: { name: 'Beckoning', desc: `<p>The vampire calls out in the voice of a specific animal type, mystically summoning creatures of that species within earshot. Summoned animals are favorably disposed but not directly controlled.</p><p><b>System:</b> Roll Charisma + Survival (diff 6). Successes determine how many animals respond: 1 = one animal, 2 = one quarter, 3 = half, 4 = most, 5 = all within earshot. The call can be as specific as desired (e.g., only male bats, or one particular animal).</p>`, primary: 'attributes.charisma', secondary: 'abilities.survival', difficulty: 6, cost: '' },
      lvl3: { name: 'Quell the Beast', desc: `<p>The vampire subdues the Beast within a mortal or animal through touch or eye contact, stripping them of strong emotions and rendering them apathetic and compliant.</p><p><b>System:</b> Roll Manipulation + Intimidation (to cow) or Manipulation + Empathy (to soothe), diff 7. Extended action requiring total successes equal to the target's Willpower. While quelled, the target cannot use or regain Willpower and ceases all struggles. Does not work on Kindred, though the soothing version may help pull a vampire out of frenzy (3+ successes). Target recovers by rolling Willpower (diff 6) once per day, accumulating successes equal to the vampire's Willpower.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.intimidation', difficulty: 6, cost: '' },
      lvl4: { name: 'Subsume the Spirit', desc: `<p>The vampire possesses an animal by locking gazes, transferring consciousness into the creature while the Kindred's body falls into a torpor-like state.</p><p><b>System:</b> Roll Manipulation + Animal Ken (diff 8). Successes determine which Disciplines can be used while possessing: 1 = none, 2 = sensory (Auspex), 3 = emotional (Presence), 4 = mental (Dominate, Dementation), 5 = mystical (Thaumaturgy, etc.). Damage to the animal is applied to the vampire's body (soakable). If the animal dies, the vampire enters torpor. On return, the player rolls Wits + Empathy (diff 8) to avoid retaining animalistic behavior.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.animalKen', difficulty: 8, cost: '1 Willpower' },
      lvl5: { name: 'Drawing Out the Beast', desc: `<p>The vampire expels his own Beast into a nearby target, sending the victim into immediate frenzy while the Kindred retains composure.</p><p><b>System:</b> Roll Manipulation + Self-Control/Instinct (diff 8). Target must be visible. 1 success = Beast goes to a random individual, 2 = vampire is stunned next turn but succeeds, 3+ = clean transfer. On failure, the vampire himself enters a doubled-intensity frenzy. If the vampire leaves before the target's frenzy ends, he loses his Beast entirely (no frenzy but no Willpower either). Must retrieve it by coaxing it back or killing the host.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.animalKen', difficulty: 8, cost: '1 Willpower' }
    }}
  },
  {
    name: 'Auspex', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Auspex.png',
    system: { level: 0, description: '<p>Auspex sharpens a vampire\'s senses to supernatural levels, granting the ability to read auras, perceive thoughts, and pierce illusions such as Obfuscate. However, heightened senses leave the Kindred vulnerable to sudden bright lights, loud noises, and other intense stimuli.</p>', powers: {
      lvl1: { name: 'Heightened Senses', desc: `<p>The vampire doubles the clarity and range of all five senses. May also receive occasional precognitive flashes at the Storyteller's discretion.</p><p><b>System:</b> Reflexive action, no roll needed. Perception-related difficulties may be reduced by the character's Auspex rating. Vulnerable to sensory overload from sudden stimuli (bright lights, loud sounds may blind or deafen for an hour or more).</p>`, primary: 'attributes.perception', secondary: 'abilities.awareness', difficulty: 6, cost: '' },
      lvl2: { name: 'Aura Perception', desc: `<p>The vampire perceives the psychic aura surrounding any living or supernatural being, reading emotional states and identifying supernatural creatures by the characteristics of their aura.</p><p><b>System:</b> Roll Perception + Empathy (diff 8). Successes determine detail: 1 = shade only (pale/bright), 2 = main color, 3 = color patterns, 4 = subtle shifts, 5 = full mixtures. Vampires have pale auras, werewolves are vibrant, ghosts are weak and flickering. Can scan a crowd for a specific aura quality, but detailed reads require focusing on one individual per scene.</p>`, primary: 'attributes.perception', secondary: 'abilities.empathy', difficulty: 8, cost: '' },
      lvl3: { name: 'The Spirit\'s Touch', desc: `<p>By handling an object, the vampire reads psychic impressions left on it, learning about the last person who touched it, when, and under what emotional circumstances.</p><p><b>System:</b> Roll Perception + Empathy (difficulty varies by age and emotional intensity of the impressions, 4-9). Each success reveals more detail: 1 = basic info (gender, hair color), 2 = a second detail, 3 = age and emotional state, 4 = the person's name, 5+ = extensive information about the person's relationship with the object. A botch overwhelms the vampire for 30 minutes.</p>`, primary: 'attributes.perception', secondary: 'abilities.empathy', difficulty: 6, cost: '' },
      lvl4: { name: 'Telepathy', desc: `<p>The vampire projects thoughts into a target's mind or reads thoughts from surface emotions down to buried memories.</p><p><b>System:</b> Roll Intelligence + Subterfuge (diff = target's current Willpower). One success projects thoughts (detectable by the target with Perception + Awareness vs vampire's Manipulation + Subterfuge). Each additional success plucks deeper layers of thought. Deep secrets require 5+ successes. Costs 1 Willpower to attempt on other vampires or supernaturals. Thoughts appear as streams of imagery, not clear prose.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.subterfuge', difficulty: 6, cost: '' },
      lvl5: { name: 'Psychic Projection', desc: `<p>The vampire projects consciousness out of the body as an astral form, traveling anywhere below the moon's orbit while the physical body lies in torpor. An ephemeral silver cord connects soul to body.</p><p><b>System:</b> Spend 1 Willpower and roll Perception + Awareness. Difficulty depends on distance (5 = in sight, 7 = familiar location, 9 = distant/unfamiliar). The astral form is immune to physical damage but vulnerable to fire/sunlight. Can use Auspex normally, other non-physical Disciplines with 3+ successes. Two astral forms encountering each other interact using Mental/Social Traits in place of Physical. Combat severs the silver cord (Willpower as health levels). Each scene requires another Willpower point and roll.</p>`, primary: 'attributes.perception', secondary: 'abilities.awareness', difficulty: 7, cost: '1 Willpower' }
    }}
  },
  {
    name: 'Celerity', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Celerity.png',
    system: { level: 0, description: '<p>Celerity grants supernatural speed. Each dot adds one die to Dexterity-related rolls. The vampire can also spend one blood point per dot to gain extra physical actions in a turn (at full dice pool, no splitting). Extra actions occur at end of turn and cannot themselves be split.</p>', powers: {
      lvl1: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl3: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl4: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl5: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Chimerstry', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Chimerstry.png',
    system: { level: 0, description: '<p>Chimerstry creates illusions from the vampire\'s will, confounding senses and even technology. Illusions can be dispelled if a victim proves them false. Auspex can be used to contest Chimerstry (see Seeing the Unseen).</p>', powers: {
      lvl1: { name: 'Ignis Fatuus', desc: `<p>Creates a minor static illusion affecting one sense (sight, sound, smell, touch, or taste). Tactile illusions have no real substance.</p><p><b>System:</b> Spend 1 Willpower. The illusion is limited to roughly 20 cubic feet per dot of Chimerstry. Lasts until the vampire leaves the vicinity or someone sees through it.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.subterfuge', difficulty: 6, cost: '1 Willpower' },
      lvl2: { name: 'Fata Morgana', desc: `<p>Creates static illusions appealing to all senses at once. The illusion has no solid presence but is convincing to all five senses.</p><p><b>System:</b> Spend 1 Willpower + 1 blood point. Illusion remains until dispelled, as per Ignis Fatuus.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.subterfuge', difficulty: 6, cost: '1 Willpower' },
      lvl3: { name: 'Apparition', desc: `<p>Grants motion to an illusion created with Ignis Fatuus or Fata Morgana.</p><p><b>System:</b> Spend 1 blood point to animate the illusion in one significant way or many subtle ways. Performing complex actions while maintaining the illusion requires a Willpower roll; failure dissolves it. Once the creator stops concentrating, the illusion repeats a simple programmed motion.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.subterfuge', difficulty: 6, cost: '1 Willpower' },
      lvl4: { name: 'Permanency', desc: `<p>Makes an Ignis Fatuus or Fata Morgana illusion persist even when the vampire is not present.</p><p><b>System:</b> Spend 1 blood point. The illusion becomes permanent until deliberately dissolved, including programmed motion from Apparition.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.subterfuge', difficulty: 6, cost: '1 Willpower' },
      lvl5: { name: 'Horrid Reality', desc: `<p>Projects a hallucination directly into one victim's mind. The target believes the illusion completely; illusory damage manifests as real injuries.</p><p><b>System:</b> Costs 2 Willpower. Roll Manipulation + Subterfuge (diff = victim's Perception + Self-Control/Instinct). Each success inflicts 1 level of unsoakable lethal damage. The victim heals instantly if convinced the damage was illusory within 24 hours (Charisma + Empathy, diff = Manipulation + Subterfuge of the caster, 2+ successes). Cannot actually kill, but may cause torpor or unconsciousness.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.subterfuge', difficulty: 7, cost: '1 Willpower' }
    }}
  },
  {
    name: 'Dementation', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Dementation.png',
    system: { level: 0, description: '<p>Dementation channels madness into the minds of others, unlocking hidden darkness in the target\'s psyche rather than creating insanity from nothing. Primarily associated with the Malkavians.</p>', powers: {
      lvl1: { name: 'Passion', desc: `<p>Amplifies or deadens an emotion already present in the target through conversation.</p><p><b>System:</b> Roll Charisma + Empathy (diff = target's Humanity/Path rating). Cannot choose the emotion, only intensify or suppress it. Duration: 1 success = 1 turn, 2 = 1 hour, 3 = 1 night, 4 = 1 week, 5 = 1 month, 6+ = 3 months. May modify frenzy or Virtue roll difficulties by 1-2.</p>`, primary: 'attributes.charisma', secondary: 'abilities.empathy', difficulty: 6, cost: '' },
      lvl2: { name: 'The Haunting', desc: `<p>Floods a victim's senses with disturbing visions, sounds, or sensations that occur mainly when alone and at night. The vampire cannot control the specific manifestations.</p><p><b>System:</b> Spend 1 blood point. Roll Manipulation + Subterfuge (diff = victim's Perception + Self-Control/Instinct). Duration: 1 success = 1 night, 2 = 2 nights, 3 = 1 week, 4 = 1 month, 5 = 3 months, 6+ = 1 year. Particularly disturbing manifestations may reduce dice pools for a turn or two.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.subterfuge', difficulty: 6, cost: '' },
      lvl3: { name: 'Eyes of Chaos', desc: `<p>The vampire reads hidden patterns in a person's soul, random events, or coded messages, potentially discerning someone's true Nature.</p><p><b>System:</b> Roll Perception + Occult. Difficulty depends on familiarity: stranger (diff 9), acquaintance (8), ally (6), coded message (7), patterns in nature (6). Results are delivered as allegory and symbolism, never plain facts.</p>`, primary: 'attributes.perception', secondary: 'abilities.occult', difficulty: 5, cost: '' },
      lvl4: { name: 'Voice of Madness', desc: `<p>Speaking aloud, the vampire drives listeners into frenzy or panic.</p><p><b>System:</b> Spend 1 blood point. Roll Manipulation + Empathy (diff 7). One target per success; all must hear the voice. Kindred and werewolves may resist with a frenzy/Rotschreck roll at +2 difficulty. Mortals are affected automatically. The user must also test for frenzy (at -1 difficulty; on failure, +1 difficulty instead).</p>`, primary: 'attributes.manipulation', secondary: 'abilities.empathy', difficulty: 7, cost: '' },
      lvl5: { name: 'Total Insanity', desc: `<p>Overwhelms a target with madness, inflicting five derangements at once.</p><p><b>System:</b> Requires the target's undivided attention for one full turn. Spend 1 blood point. Roll Manipulation + Intimidation (diff = victim's current Willpower). Duration: 1 success = 1 turn, 2 = 1 night, 3 = 1 week, 4 = 1 month, 5+ = 1 year. The victim can spend Willpower equal to the successes rolled to end the effects early.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.intimidation', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Dominate', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Dominate.png',
    system: { level: 0, description: '<p>Dominate imposes the vampire\'s will on others through eye contact and verbal commands. It works on one target at a time and requires the subject to understand the vampire. Cannot be used on vampires of lower Generation than the user.</p>', powers: {
      lvl1: { name: 'Command', desc: `<p>The vampire issues a one-word command that the target must obey instantly. The command must be clear and unambiguous (run, stop, follow, scream). Cannot order self-harm.</p><p><b>System:</b> Roll Manipulation + Intimidation (diff = target's current Willpower). More successes produce more vigorous or prolonged compliance. Commands against the target's Nature may fail.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.intimidation', difficulty: 6, cost: '' },
      lvl2: { name: 'Mesmerize', desc: `<p>Implants a suggestion in the target's subconscious through speech and eye contact. Can be triggered immediately or by a later stimulus.</p><p><b>System:</b> Roll Manipulation + Leadership (diff = target's current Willpower). 1-2 successes: nothing obviously strange, 3-4: effective unless endangering the subject, 5+: nearly any command short of self-harm. Cannot force actions against the target's Nature. A new Mesmerize attempt overwrites any previous one only if it scores more successes.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.leadership', difficulty: 6, cost: '' },
      lvl3: { name: 'The Forgetful Mind', desc: `<p>The vampire rewrites or removes the target's memories through hypnotic questioning.</p><p><b>System:</b> Roll Wits + Subterfuge (diff = target's current Willpower). 1 success: remove one memory for one day. 2: permanently remove (not alter). 3: slight changes. 4: alter or remove entire scenes. 5: reconstruct entire periods of life. Poorly detailed false memories crumble faster than well-crafted ones. To restore altered memories, the restorer's Dominate must equal or exceed the original user's, with more successes on Wits + Empathy (diff = original user's permanent Willpower).</p>`, primary: 'attributes.wits', secondary: 'abilities.subterfuge', difficulty: 6, cost: '' },
      lvl4: { name: 'Conditioning', desc: `<p>Over weeks or months of sustained mental manipulation, the vampire makes a subject utterly pliant and resistant to other Kindred's Dominate.</p><p><b>System:</b> Roll Charisma + Leadership (diff = target's current Willpower) once per scene. Extended action requiring 5-10 times the subject's Self-Control/Instinct in total successes. Once fully conditioned, the target obeys without eye contact, and other vampires' Dominate attempts against the target are at +2 difficulty. Conditioning fades if the subject is separated from the vampire for roughly 6 months minus their Willpower in weeks.</p>`, primary: 'attributes.charisma', secondary: 'abilities.leadership', difficulty: 6, cost: '' },
      lvl5: { name: 'Possession', desc: `<p>The vampire takes over a mortal's body entirely, transferring consciousness into the victim while the Kindred's body falls into torpor.</p><p><b>System:</b> First, strip all the target's temporary Willpower through a resisted roll: Charisma + Intimidation vs target's Willpower (diff 7 each). Then roll Manipulation + Intimidation (diff 7) to determine control depth: 1 = no Disciplines, 2 = sensory, 3 = emotional, 4 = mental, 5 = mystical. Damage to the possessed body is also applied to the vampire's body (soakable). If the mortal dies, the vampire enters torpor. Cannot possess other vampires or supernatural creatures (except blood-bound ghouls).</p>`, primary: 'attributes.charisma', secondary: 'abilities.intimidation', difficulty: 8, cost: '' }
    }}
  },
  {
    name: 'Fortitude', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Fortitude.png',
    system: { level: 0, description: '<p>Fortitude grants supernatural resilience. Each dot adds to Stamina for soaking normal damage (bashing and lethal) and also allows the vampire to soak aggravated damage from sources like fire, sunlight, and supernatural attacks.</p>', powers: {
      lvl1: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl3: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl4: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl5: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Necromancy', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 0, description: '<p>Necromancy is blood magic devoted to commanding the souls of the dead. Like Thaumaturgy, it is divided into paths and rituals. The Sepulchre Path is the primary path, presented here. A necromancer must master three levels of the primary path before learning a secondary path, and must master all five levels before starting a third.</p>', powers: {
      lvl1: { name: 'Witness of Death', desc: `<p>Attunes the vampire's senses to perceive ghosts as translucent phantoms. The vampire's eyes flicker with pale blue fire visible only to the dead.</p><p><b>System:</b> Roll Perception + Awareness (diff 5). Success lasts for the scene. A botch means the vampire can see only the dead for the scene (+3 difficulty to vision-based rolls). Ghosts notice the glowing eyes with Perception + Alertness (diff 7).</p>`, primary: 'attributes.perception', secondary: 'abilities.awareness', difficulty: 5, cost: '' },
      lvl2: { name: 'Summon Soul', desc: `<p>Calls a ghost back from the Underworld for conversation. Requires knowing the ghost's name and having an object it contacted in life.</p><p><b>System:</b> Spend 1 blood point. Roll Manipulation + Occult (diff 7 or ghost's Willpower, whichever is higher). A piece of the ghost's corpse reduces difficulty by 1. The ghost cannot leave the vampire's sight. Spend Willpower to dismiss. A botch summons a hostile Spectre instead.</p>`, primary: 'attributes.perception', secondary: 'abilities.occult', difficulty: 5, cost: '' },
      lvl3: { name: 'Compel Soul', desc: `<p>Commands a ghost to perform tasks. Requires the ghost's name and a relevant object.</p><p><b>System:</b> Spend 1 blood point. Resisted roll: Manipulation + Occult vs ghost's Willpower (diff 6 both). Net successes determine control: 1 = one simple safe task, 2 = two tasks or one mildly dangerous one, 3 = one difficult/dangerous task or servitude up to one month, 4 = extreme-risk tasks or slavery for a month (permanent Willpower for a year), 5+ = any task within one month including lethal danger. If the ghost wins, the vampire loses Willpower equal to net successes.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 6, cost: '' },
      lvl4: { name: 'Haunting', desc: `<p>Binds a ghost to a specific location or object. The wraith risks destruction if it tries to leave.</p><p><b>System:</b> Spend 1 blood point. Roll Manipulation + Occult (diff = ghost's Willpower, min 4; +1 if binding to an object; -1 if using part of the corpse). Each success binds for one night. Spend 1 Willpower for one week, or 1 permanent Willpower for a year and a day. A trapped ghost attempting to leave must make extended Willpower rolls (diff 9, 4 successes) or take aggravated damage.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 6, cost: '' },
      lvl5: { name: 'Torment', desc: `<p>The vampire strikes a ghost's ectoplasmic form from the physical world, inflicting damage without being struck in return.</p><p><b>System:</b> Roll Stamina + Empathy (diff = ghost's current Willpower). Each success inflicts one level of lethal damage on the ghost. If the ghost loses all health levels, it vanishes into the Underworld and cannot return for one month.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Obfuscate', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Obfuscate.png',
    system: { level: 0, description: '<p>Obfuscate conceals the vampire from perception by clouding the minds of observers. It does not grant true invisibility and does not fool cameras or electronic recording devices, though observers won\'t notice the vampire on a live feed. Auspex can potentially pierce Obfuscate (see Seeing the Unseen). Range is approximately 5 yards per dot of Wits + Stealth.</p>', powers: {
      lvl1: { name: 'Cloak of Shadows', desc: `<p>The vampire hides in shadows and cover, becoming unnoticed as long as he stays silent, still, and out of direct light.</p><p><b>System:</b> No roll required. Concealment breaks if the vampire moves, attacks, or falls under direct light. Does not hold up against determined scrutiny.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: 'Unseen Presence', desc: `<p>The vampire moves around unseen. Shadows shift to cover him and people unconsciously avert their gaze.</p><p><b>System:</b> No roll required unless the character draws attention (speaking, bumping objects, etc.). The ST calls for Wits + Stealth rolls when the vampire might accidentally reveal himself. Drawing obvious attention (smashing a window, yelling) ends the concealment immediately and bystanders may recall the vampire's actions with a Wits + Awareness roll (diff 7).</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl3: { name: 'Mask of a Thousand Faces', desc: `<p>The vampire alters others' perception of his appearance, projecting a different face without physically changing.</p><p><b>System:</b> Roll Manipulation + Performance (diff 7). 1 success: minor feature changes, Nosferatu appear ugly but normal. 2: unrecognizable. 3: looks as intended. 4: complete transformation including voice and mannerisms. 5: opposite sex, extreme age/size changes. Mimicking someone more attractive costs additional blood points equal to the Appearance difference.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.performance', difficulty: 7, cost: '' },
      lvl4: { name: 'Vanish from the Mind\'s Eye', desc: `<p>The vampire disappears from plain view, even while being directly observed. Mortals may panic; weak-willed individuals forget the vampire was ever present.</p><p><b>System:</b> Roll Charisma + Stealth (diff = target's Wits + Alertness). 3 or fewer successes: ghostlike and indistinct. 4+: completely invisible. If successes exceed a viewer's Willpower, that person forgets the vampire entirely. Mortals must roll Wits + Courage (diff 9) to react immediately; failure stuns them for two turns.</p>`, primary: 'attributes.charisma', secondary: 'abilities.stealth', difficulty: 6, cost: '' },
      lvl5: { name: 'Cloak the Gathering', desc: `<p>Extends any Obfuscate power to conceal nearby allies. Each person who breaks cover is individually exposed, but the rest remain hidden.</p><p><b>System:</b> The vampire may conceal one extra person per dot of Stealth, applying one Obfuscate power to the entire group with a single roll. Only if the vampire himself errs does the power drop for everyone.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Obtenebration', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Obtenebration.png',
    system: { level: 0, description: '<p>Obtenebration grants control over shadows and supernatural darkness. The Lasombra signature Discipline. Vampires using Obtenebration can see through darkness they control, though others (even other Obtenebration users) cannot.</p>', powers: {
      lvl1: { name: 'Shadow Play', desc: `<p>The vampire manipulates existing shadows, stretching, moving, or shaping them. Controlled shadows gain tangible substance.</p><p><b>System:</b> Spend 1 blood point, no roll. Lasts one scene. Stealth +1 die, ranged attacks against the vampire +1 difficulty, Intimidation +1 die, or subtract 1 die from a target's Stamina pool (including soak). Only one effect on one target at a time. Mortals witnessing this must roll Courage (diff 8) or suffer -1 die to all pools for the scene.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 6, cost: '' },
      lvl2: { name: 'Shroud of Night', desc: `<p>Creates a cloud of impenetrable darkness that muffles sound and extinguishes non-fire light sources.</p><p><b>System:</b> Roll Manipulation + Occult (diff 7). Base diameter 10 feet/3 meters, doubled per additional success. Creating it outside line of sight is +2 difficulty and costs 1 blood point. Those inside suffer +2 difficulty to all actions (even with enhanced senses) and -2 Stamina dice. Can asphyxiate mortals who reach 0 Stamina.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 7, cost: '1 blood' },
      lvl3: { name: 'Arms of the Abyss', desc: `<p>Creates shadowy tentacles from patches of darkness.</p><p><b>System:</b> Spend 1 blood point. Roll Manipulation + Occult (diff 7); each success creates one tentacle (6 feet/2 meters long, Str and Dex equal to the vampire's Obtenebration). Spend blood to add +1 Str/Dex or +6 feet per point. Each tentacle has 4 health levels, soaks with vampire's Stamina + Fortitude, and constricts for Str+1 lethal per turn. Can be destroyed by fire and sunlight.</p>`, primary: 'attributes.manipulation', secondary: 'abilities.occult', difficulty: 7, cost: '1 blood' },
      lvl4: { name: 'Black Metamorphosis', desc: `<p>The vampire infuses himself with shadow, gaining a monstrous appearance with four shadowy tentacles and bands of darkness across the body.</p><p><b>System:</b> Spend 2 blood points. Roll Manipulation + Courage (diff 7). Grants four tentacles (Str/Dex = vampire's own), -2 to opponents' Stamina/soak on touch, one bonus attack per turn via tentacles, +3 Intimidation dice. Mortals must roll Courage (diff 8) or suffer Rotschreck-like panic. A botch inflicts 2 unsoakable lethal.</p>`, primary: 'attributes.manipulation', secondary: 'virtues.courage', difficulty: 6, cost: '2 blood' },
      lvl5: { name: 'Tenebrous Form', desc: `<p>The vampire physically transforms into an amoeboid patch of living shadow, immune to physical attacks and able to slither through any crack.</p><p><b>System:</b> Costs 3 blood points. Immune to physical damage but still vulnerable to fire and sunlight (Rotschreck difficulties +1). Cannot physically attack, but can ooze over targets for Shroud of Night effects. May use mental Disciplines. Unaffected by gravity; can flow up walls. Mortals witnessing the transformation roll Courage (diff 8) or panic.</p>`, primary: '', secondary: '', difficulty: 6, cost: '3 blood' }
    }}
  },
  {
    name: 'Potence', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Potence.png',
    system: { level: 0, description: '<p>Potence grants supernatural strength. Each dot adds one die to all Strength-related rolls. The vampire may spend one blood point to convert those Potence dice into automatic successes for one turn. In melee and brawl combat, Potence successes (rolled or automatic) add to damage.</p>', powers: {
      lvl1: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl3: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl4: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl5: { name: '', desc: ``, primary: '', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Presence', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Presence.png',
    system: { level: 0, description: '<p>Presence manipulates emotions, inspiring fervor or terror in crowds. Anyone can resist by spending 1 Willpower and rolling Willpower (diff 8) each scene. Vampires 3+ Generations lower need only spend 1 Willpower for the entire night. Presence controls emotions, not direct actions.</p>', powers: {
      lvl1: { name: 'Awe', desc: `<p>The vampire becomes magnetically attractive, drawing people closer and making them receptive to her point of view.</p><p><b>System:</b> Spend 1 blood point. Roll Charisma + Performance (diff 7). Affects those with lowest Willpower first: 1 success = 1 person, 2 = 2 people, 3 = 6, 4 = 20, 5 = everyone nearby. Lasts for the scene. Danger breaks the effect. Targets may spend Willpower each scene to resist; after spending Willpower equal to the successes rolled, they break free for the night.</p>`, primary: 'attributes.charisma', secondary: 'abilities.performance', difficulty: 7, cost: '' },
      lvl2: { name: 'Dread Gaze', desc: `<p>The vampire focuses her terrifying supernatural visage to petrify a single target with fear.</p><p><b>System:</b> Roll Charisma + Intimidation (diff = target's Wits + Courage). Each success subtracts 1 from the target's action dice pool next turn. 3+ successes forces the target to flee. Can be used as an extended action; if the target reaches zero dice, they collapse in terror. Failure loses accumulated successes. A botch makes the target immune for the rest of the story.</p>`, primary: 'attributes.charisma', secondary: 'abilities.intimidation', difficulty: 6, cost: '' },
      lvl3: { name: 'Entrancement', desc: `<p>Bends another's emotions to make them a willing, devoted servant for a limited duration.</p><p><b>System:</b> Spend 1 blood point. Roll Appearance + Empathy (diff = target's current Willpower). Botch: immune for the story. Failure: immune for the night. 1 success = 1 hour, 2 = 1 day, 3 = 1 week, 4 = 1 month, 5 = 1 year. Entranced servants retain creativity and individuality, unlike Dominate victims, but may be unpredictable.</p>`, primary: 'attributes.appearance', secondary: 'abilities.empathy', difficulty: 6, cost: '' },
      lvl4: { name: 'Summon', desc: `<p>The vampire calls any person she has ever met to her side across any distance. The target knows intuitively how to find the Summoner.</p><p><b>System:</b> Spend 1 blood point. Roll Charisma + Subterfuge (base diff 5; 7 if met only briefly; 4 if Presence was used on the target before; 8 if a previous attempt failed). Successes determine urgency: 1 = slow/hesitant, 3 = reasonable speed, 5 = rushes with abandon. The Summons dissipates at dawn and must be renewed each night. The target retains survival instincts.</p>`, primary: 'attributes.charisma', secondary: 'abilities.subterfuge', difficulty: 6, cost: '' },
      lvl5: { name: 'Majesty', desc: `<p>The vampire projects an aura of absolute authority that makes defiance nearly unthinkable.</p><p><b>System:</b> Spend 1 Willpower, no roll needed by the vampire. Anyone wishing to oppose, contradict, or act against the vampire must roll Courage (diff = vampire's Charisma + Intimidation, max 10). Failure forces the individual to defer, even to absurd lengths. Lasts one scene.</p>`, primary: 'attributes.charisma', secondary: 'abilities.intimidation', difficulty: 7, cost: '' }
    }}
  },
  {
    name: 'Protean', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Protean.png',
    system: { level: 0, description: '<p>Protean grants shapeshifting abilities: bestial claws, animal forms, mist form, and melding with earth. Transformed vampires can generally use other Disciplines (Storyteller discretion). Clothing and small possessions transform with the vampire. A staked vampire cannot transform.</p>', powers: {
      lvl1: { name: 'Eyes of the Beast', desc: `<p>The vampire's eyes glow red, granting perfect vision in total darkness.</p><p><b>System:</b> No roll required, takes one full turn to activate. Social rolls with mortals are at +1 difficulty while active unless the eyes are hidden. Reduces darkness penalties from +2 to +1.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: 'Feral Claws', desc: `<p>The vampire grows razor-sharp claws capable of rending flesh, stone, and metal.</p><p><b>System:</b> Spend 1 blood point, one turn to grow. Lasts one scene. Claws inflict Strength +1 aggravated damage (not soakable by most supernaturals without Fortitude). Climbing roll difficulties reduced by 2.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl3: { name: 'Earth Meld', desc: `<p>The vampire sinks into bare earth, becoming one with the ground. Provides full protection from daylight. Cannot move while interred.</p><p><b>System:</b> Spend 1 blood point, takes one turn. The vampire enters near-torpor, sensing surroundings only distantly. Requires Humanity/Path roll (diff 6) to rouse in response to danger. Detection attempts are at +2 difficulty. Disturbance to the soil expels the vampire immediately (Perception rolls +2 difficulty for observers, vampire -2 initiative for the first turn).</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl4: { name: 'Shape of the Beast', desc: `<p>The vampire transforms into a wolf or bat, gaining the animal's natural abilities while retaining vampire intelligence.</p><p><b>System:</b> Spend 1 blood point, 3 turns to transform (extra blood points reduce by 1 turn each, minimum 1). Lasts until next dawn or voluntary change. Wolf: Str+1 aggravated bite/claws, double speed, -2 Perception difficulty. Bat: Str reduced to 1, can fly at 20 mph, -3 hearing Perception difficulty, +2 difficulty to be hit. Most Disciplines remain usable except Necromancy, Serpentis, Thaumaturgy, and Vicissitude.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl5: { name: 'Mist Form', desc: `<p>The vampire disperses into a cloud of mist, immune to physical attacks and able to slip through any opening.</p><p><b>System:</b> Spend 1 blood point, 3 turns to transform (extra blood reduces by 1 turn each, min 1). Immune to mundane physical attacks, takes 1 fewer die of damage from fire and sunlight. Cannot physically attack. Can perceive surroundings normally and use non-physical Disciplines. Strong winds may buffet but cannot disperse the form.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' }
    }}
  },
  {
    name: 'Quietus', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Quietus.png',
    system: { level: 0, description: '<p>Quietus focuses on silent killing through blood-based poisons, vitae manipulation, and pestilence. Primarily associated with the Assamite Clan.</p>', powers: {
      lvl1: { name: 'Silence of Death', desc: `<p>A mystical zone of utter silence radiates from the vampire, preventing any sound within.</p><p><b>System:</b> Spend 1 blood point. Creates a 20-foot (6-meter) radius of complete silence centered on the vampire for one hour. No roll required.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl2: { name: 'Scorpion\'s Touch', desc: `<p>The vampire converts blood into a contact poison that strips Stamina from victims.</p><p><b>System:</b> Spend blood points (max = Stamina) and roll Willpower (diff 6). On a successful touch, the target loses Stamina equal to blood points spent. Target resists with Stamina + Fortitude (diff 6). Duration by successes: 1 = 1 turn, 2 = 1 hour, 3 = 1 day, 4 = 1 month, 5 = permanent. Mortals at 0 Stamina become terminally ill; vampires enter torpor. Can be spat up to 10 ft per Str dot (Stamina + Athletics, diff 6) or applied to melee weapons.</p>`, primary: 'willpower', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl3: { name: 'Dagon\'s Call', desc: `<p>After touching the target, the vampire can later burst the victim's blood vessels from any distance, drowning them in their own blood.</p><p><b>System:</b> Must touch target first. Within one hour, spend 1 Willpower. Contested Stamina rolls (diff = opponent's permanent Willpower). Net successes = lethal damage. Can be continued each turn for an additional Willpower point per turn.</p>`, primary: '', secondary: '', difficulty: 6, cost: '2 blood' },
      lvl4: { name: 'Baal\'s Caress', desc: `<p>The vampire's blood becomes a corrosive ichor that converts weapon damage to aggravated.</p><p><b>System:</b> No roll required. Coat a melee weapon with blood; each successful hit consumes 1 blood point but inflicts aggravated damage instead of normal. Misses don't consume blood. Only works on melee weapons (not ranged ammunition).</p>`, primary: '', secondary: '', difficulty: 6, cost: '1+ blood' },
      lvl5: { name: 'Taste of Death', desc: `<p>The vampire spits caustic blood at a target, burning flesh and corroding bone.</p><p><b>System:</b> Spit range: 10 feet (3 meters) per dot of Strength + Potence. Roll Stamina + Athletics (diff 6) to hit. Each blood point spat inflicts 2 dice of aggravated damage. No limit other than blood pool and per-turn spending maximum.</p>`, primary: 'attributes.dexterity', secondary: 'abilities.athletics', difficulty: 6, cost: '1+ blood' }
    }}
  },
  {
    name: 'Serpentis', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Serpentis.png',
    system: { level: 0, description: '<p>Serpentis is the serpent-themed Discipline of the Followers of Set, granting powers tied to snakes, hypnotic gazes, and the ability to remove one\'s own heart for safekeeping.</p>', powers: {
      lvl1: { name: 'The Eyes of the Serpent', desc: `<p>The vampire's eyes turn gold with large black irises, hypnotically immobilizing mortals who meet his gaze.</p><p><b>System:</b> No roll needed for mortals (they are frozen as long as eye contact is maintained). For vampires and supernaturals, roll Willpower (diff 9). Targets can spend Willpower to break free if attacked. Must be able to see the vampire's eyes.</p>`, primary: 'willpower', secondary: '', difficulty: 6, cost: '' },
      lvl2: { name: 'The Tongue of the Asp', desc: `<p>The vampire extends a forked, razor-edged tongue up to 18 inches that can be used as a weapon and to drink blood.</p><p><b>System:</b> Spend 1 blood point. The tongue inflicts Strength aggravated damage (diff 6). If the vampire wounds the target, she may drink blood next turn as with a bite. Mortals are struck helpless as with the Kiss. The tongue also halves darkness penalties due to vibration sensitivity.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl3: { name: 'The Skin of the Adder', desc: `<p>The vampire's skin becomes scaly and mottled, granting supernatural flexibility and resistance.</p><p><b>System:</b> Spend 1 blood point + 1 Willpower. Soak difficulties drop to 5. Can soak aggravated damage from claws/fangs (not fire, sunlight, or magic) with Stamina. Bite damage +1 die. Can slip through any opening that fits the head. Appearance drops to 1.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood + 1 WP' },
      lvl4: { name: 'The Form of the Cobra', desc: `<p>The vampire transforms into a large black cobra (10+ feet long, weighing the same as human form), gaining a venomous bite and enhanced smell.</p><p><b>System:</b> Spend 1 blood point, 3 turns to transform. Bite inflicts normal damage plus venom fatal to mortals. Enhanced smell (Perception bonus at ST discretion), hearing rolls +2 difficulty. Lasts until dawn or voluntary change. Can use most Disciplines except those requiring hands.</p>`, primary: '', secondary: '', difficulty: 6, cost: '1 blood' },
      lvl5: { name: 'The Heart of Darkness', desc: `<p>The vampire removes her own heart during a new moon, rendering herself immune to staking and reducing frenzy difficulties by 2. The heart can be hidden for safekeeping, but if seized, the vampire is utterly at the holder's mercy.</p><p><b>System:</b> No roll required. Can only be performed during a new moon. Destroying the heart (fire or sunlight only) kills the vampire instantly. Staking the removed heart causes instant torpor. Can also be performed on other vampires through surgery.</p>`, primary: '', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Thaumaturgy', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 0, description: '<p>Thaumaturgy is blood magic, divided into paths and rituals. The primary path (Path of Blood, presented here) increases automatically with the overall Thaumaturgy rating. Other paths must be purchased separately. The character learns one Level 1 ritual free and can learn additional rituals up to their Thaumaturgy level through study.</p>', powers: {
      lvl1: { name: 'A Taste for Blood', desc: `<p>By touching a sample of blood, the vampire determines how much vitae remains in the subject, how recently they fed, approximate Generation (if Kindred), and whether they have committed diablerie.</p><p><b>System:</b> Roll Perception + Occult (diff 7). Successes determine the amount and accuracy of information gained. Three or more successes reveal diablerie.</p>`, primary: 'attributes.perception', secondary: 'abilities.occult', difficulty: 7, cost: '' },
      lvl2: { name: 'Blood Rage', desc: `<p>Through touch, the vampire forces another Kindred to expend blood points against their will.</p><p><b>System:</b> Roll Dexterity + Subterfuge (diff 6). Each success forces the target to spend 1 blood point immediately (can exceed per-turn Generation limits). The caster chooses how the blood is spent (boosting attributes, healing, etc.). Each success also increases the target's frenzy difficulty by 1. Cannot be used on yourself to bypass Generation limits.</p>`, primary: 'attributes.dexterity', secondary: 'abilities.subterfuge', difficulty: 6, cost: '' },
      lvl3: { name: 'Blood of Potency', desc: `<p>The vampire temporarily concentrates their blood, effectively lowering their Generation.</p><p><b>System:</b> Roll Intelligence + Occult (diff 8). Each success provides one step down in Generation or one hour of duration; successes must be split between both. Cannot be used while already active. If diablerized during the effect, the diablerist only gains benefit of the actual Generation. Childer are created at the sire's true Generation. Blood exceeding the normal pool maximum dilutes when the power ends.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.occult', difficulty: 8, cost: '' },
      lvl4: { name: 'Theft of Vitae', desc: `<p>The vampire siphons blood directly from a visible target up to 50 feet away, pulling it through the air in a physical stream.</p><p><b>System:</b> Roll Intelligence + Medicine (diff 6). Each success transfers 1 blood point. Counts as ingesting the blood (for blood bond purposes, etc.) but prevents being bound. Obviously supernatural; public use is a Masquerade breach.</p>`, primary: 'attributes.intelligence', secondary: 'abilities.medicine', difficulty: 6, cost: '' },
      lvl5: { name: 'Cauldron of Blood', desc: `<p>The vampire boils blood inside a target's veins through physical contact.</p><p><b>System:</b> Roll Willpower (diff 6). Each success boils 1 blood point, dealing 1 level of aggravated damage per point boiled (soakable only with Fortitude). A single success kills any mortal.</p>`, primary: 'willpower', secondary: '', difficulty: 6, cost: '' }
    }}
  },
  {
    name: 'Vicissitude', type: 'discipline', img: 'systems/vtm-v20/VTM icons/Vicissitude.png',
    system: { level: 0, description: '<p>Vicissitude allows sculpting of flesh and bone through physical contact. Effects on mortals, ghouls, and higher-Generation vampires are permanent; equal or lower-Generation vampires can heal the changes as aggravated damage. Nosferatu always revert changes that improve their appearance. Requires skin-to-skin contact.</p>', powers: {
      lvl1: { name: 'Malleable Visage', desc: `<p>The vampire reshapes her own body: height, build, voice, facial features, skin tone. Changes are cosmetic and limited (no more than a foot of height change).</p><p><b>System:</b> Spend 1 blood point per body part changed. Roll Intelligence + Medicine (diff 6). Duplicating another person requires Perception + Medicine (diff 8, 5 successes for a perfect copy). Increasing Appearance costs diff 9 and 1 additional blood per dot. A botch permanently reduces Appearance by 1.</p>`, primary: 'attributes.dexterity', secondary: 'abilities.crafts', difficulty: 6, cost: '' },
      lvl2: { name: 'Fleshcraft', desc: `<p>Performs drastic alterations on another creature's flesh (skin, muscle, fat, cartilage, but not bone). Requires grappling the victim.</p><p><b>System:</b> Spend 1 blood point and grapple the target. Roll Dexterity + Medicine (diff 5 for crude work, up to 9 for precision). Can increase or decrease Appearance by 1 per success. Can redistribute tissue for +1 soak per success (at the cost of 1 Strength or 1 health level each).</p>`, primary: 'attributes.dexterity', secondary: 'abilities.crafts', difficulty: 6, cost: '' },
      lvl3: { name: 'Bonecraft', desc: `<p>Manipulates bone in addition to flesh, enabling extreme reshaping or using bone as a weapon.</p><p><b>System:</b> Spend 1 blood point. Roll Strength + Medicine (difficulty varies). As a weapon: diff 7, each success deals 1 lethal damage as bones pierce outward. Can form bone spikes (Str+1 lethal, costs 1 health level) or defensive quills (damage attacker's Strength in lethal unless 3+ attack successes; costs 5 minus successes in health levels). Five or more successes on Strength + Medicine can curve a vampire's ribcage inward, rupturing the heart and causing loss of half the target's blood points.</p>`, primary: 'attributes.strength', secondary: 'abilities.crafts', difficulty: 6, cost: '' },
      lvl4: { name: 'Horrid Form', desc: `<p>The vampire transforms into a monstrous 8-foot creature with chitinous skin and ape-like arms.</p><p><b>System:</b> Spend 2 blood points. All Physical Attributes +3, all Social Attributes drop to 0 (except Intimidation, which may use Strength). Brawl damage +1 due to bony ridges. No roll required for the transformation itself.</p>`, primary: '', secondary: '', difficulty: 6, cost: '2 blood' },
      lvl5: { name: 'Bloodform', desc: `<p>The vampire transforms all or part of her body into sentient vitae. Each body part converts to a specific number of blood points (legs = 2 each, arms/head/abdomen = 1 each, torso = 2).</p><p><b>System:</b> The blood can be reconverted on contact or regrown by spending equivalent blood points. Fully liquefied, the vampire is immune to staking, cutting, and bludgeoning but vulnerable to fire and sunlight. Can ooze through cracks. Mental Disciplines usable without eye contact or speech. Mortals who witness this roll Courage (diff 8) or panic.</p>`, primary: '', secondary: '', difficulty: 6, cost: '3 blood' }
    }}
  },
];

const BACKGROUNDS = [
  {
    name: 'Allies', type: 'background', img: 'icons/svg/mystery-man.svg',
    system: { rating: 0, description: '<p>Mortals who support you willingly: friends, family, or loyal organizations. They help out of genuine relationship, not coercion, but have their own lives and limitations. They may provide indirect access to their own contacts, influence, or resources.</p>', levels: {
      lvl1: { name: 'One Ally', desc: '<p>One ally of moderate influence and power</p>' },
      lvl2: { name: 'Two Allies', desc: '<p>Two allies, both of moderate power</p>' },
      lvl3: { name: 'Three Allies', desc: '<p>Three allies, one of whom is quite influential</p>' },
      lvl4: { name: 'Four Allies', desc: '<p>Four allies, one of whom is very influential</p>' },
      lvl5: { name: 'Five Allies', desc: '<p>Five allies, one of whom is extremely influential</p>' },
    }}
  },
  {
    name: 'Alternate Identity', type: 'background', img: 'icons/svg/card-hand.svg',
    system: { rating: 0, description: '<p>You maintain a separate identity with supporting documentation. Useful for infiltration, espionage, or simply keeping your real identity hidden from certain circles.</p>', levels: {
      lvl1: { name: 'Novice', desc: '<p>New at maintaining the identity; occasional slips.</p>' },
      lvl2: { name: 'Established', desc: '<p>Convincing enough to pass as a professional in a specific field.</p>' },
      lvl3: { name: 'Recognized', desc: '<p>Known and recognized by name in your infiltrated area.</p>' },
      lvl4: { name: 'Trusted', desc: '<p>You hold respect and trust within your cover identity.</p>' },
      lvl5: { name: 'Respected', desc: '<p>You command respect and may have accumulated influence under your false name.</p>' },
    }}
  },
  {
    name: 'Black Hand Membership', type: 'background', img: 'icons/svg/skull.svg',
    system: { rating: 0, description: '<p>Sabbat only. You are a member of the Black Hand, the Sabbat\'s elite soldiers and assassins. You may call on fellow members for aid, but must answer their calls in return. Revealing your membership adds your rating to Social dice pools when dealing with other Sabbat.</p>', levels: {
      lvl1: { name: 'Grunt', desc: '<p>You may call upon one Black Hand member once per story.</p>' },
      lvl2: { name: 'Known and Respected', desc: '<p>You may call upon two members once per story.</p>' },
      lvl3: { name: 'Held in Regard', desc: '<p>You may call upon five members once per story.</p>' },
      lvl4: { name: 'Hero', desc: '<p>You may call upon seven members twice per story and lead large groups into action.</p>' },
      lvl5: { name: 'Legend', desc: '<p>You may call upon twelve members twice per story. The Seraphim may seek your counsel.</p>' },
    }}
  },
  {
    name: 'Contacts', type: 'background', img: 'icons/svg/book.svg',
    system: { rating: 0, description: '<p>People across the city you can bribe, manipulate, or coerce into providing information. Each dot represents one major contact who reliably provides information in their area of expertise. You also have a network of minor contacts reachable by rolling your Contacts rating (diff 7).</p>', levels: {
      lvl1: { name: 'One Major Contact', desc: '<p>One major contact</p>' },
      lvl2: { name: 'Two Major Contacts', desc: '<p>Two major contacts</p>' },
      lvl3: { name: 'Three Major Contacts', desc: '<p>Three major contacts</p>' },
      lvl4: { name: 'Four Major Contacts', desc: '<p>Four major contacts</p>' },
      lvl5: { name: 'Five Major Contacts', desc: '<p>Five major contacts</p>' },
    }}
  },
  {
    name: 'Domain', type: 'background', img: 'icons/svg/castle.svg',
    system: { rating: 0, description: '<p>Physical territory you control for feeding purposes, recognized by the local Kindred authority. Each dot reduces hunting difficulty by 1 and adds to your starting blood pool. Dots can be allocated to security instead of size (+1 difficulty for intruders, -1 to detect them).</p>', levels: {
      lvl1: { name: 'Small Building', desc: '<p>A single small building; enough for a basic haven.</p>' },
      lvl2: { name: 'Large Structure', desc: '<p>A church, warehouse, or mid-rise with controllable access.</p>' },
      lvl3: { name: 'City Block', desc: '<p>A high-rise or city block with concealment opportunities.</p>' },
      lvl4: { name: 'Defensible Area', desc: '<p>A location with inherent protective features (tunnels, private security, etc.).</p>' },
      lvl5: { name: 'Entire Neighborhood', desc: '<p>An entire neighborhood or suburb.</p>' },
    }}
  },
  {
    name: 'Fame', type: 'background', img: 'icons/svg/sun.svg',
    system: { rating: 0, description: '<p>You are recognized in mortal society. Fame grants social privileges and makes it harder for enemies to make you disappear quietly, but also makes you more conspicuous. Each dot reduces hunting difficulty by 1 in populated areas and may reduce Social roll difficulties against impressionable people.</p>', levels: {
      lvl1: { name: 'Select Subculture', desc: '<p>Known within a specific subculture (club scene, industry, etc.).</p>' },
      lvl2: { name: 'Minor Celebrity', desc: '<p>Occasionally recognized by strangers.</p>' },
      lvl3: { name: 'Greater Renown', desc: '<p>Regularly recognized; moderate public profile.</p>' },
      lvl4: { name: 'Full-Blown Celebrity', desc: '<p>Your name is widely recognized by average people.</p>' },
      lvl5: { name: 'Household Word', desc: '<p>Universally known. An icon of public consciousness.</p>' },
    }}
  },
  {
    name: 'Generation', type: 'background', img: 'icons/svg/blood.svg',
    system: { rating: 0, description: '<p>Represents the purity of your blood and proximity to the First Vampire. Without dots in this Background, you are 13th Generation.</p>', levels: {
      lvl1: { name: '12th Generation', desc: '<p>12th Generation: 11 blood pool, 1/turn</p>' },
      lvl2: { name: '11th Generation', desc: '<p>11th Generation: 12 blood pool, 1/turn</p>' },
      lvl3: { name: '10th Generation', desc: '<p>10th Generation: 13 blood pool, 1/turn</p>' },
      lvl4: { name: '9th Generation', desc: '<p>9th Generation: 14 blood pool, 2/turn</p>' },
      lvl5: { name: '8th Generation', desc: '<p>8th Generation: 15 blood pool, 3/turn</p>' },
    }}
  },
  {
    name: 'Herd', type: 'background', img: 'icons/svg/village.svg',
    system: { rating: 0, description: '<p>A group of mortals you can feed from safely. Adds dice to hunting rolls. Not closely controllable or skilled (use Allies or Retainers for that).</p>', levels: {
      lvl1: { name: 'Three Vessels', desc: '<p>Three vessels</p>' },
      lvl2: { name: 'Seven Vessels', desc: '<p>Seven vessels</p>' },
      lvl3: { name: '15 Vessels', desc: '<p>15 vessels</p>' },
      lvl4: { name: '30 Vessels', desc: '<p>30 vessels</p>' },
      lvl5: { name: '60 Vessels', desc: '<p>60 vessels</p>' },
    }}
  },
  {
    name: 'Influence', type: 'background', img: 'icons/svg/city.svg',
    system: { rating: 0, description: '<p>Your pull in mortal society: political sway, bureaucratic leverage, or social pressure. Can sometimes substitute for an Ability when dealing with officials. Easier to effect change locally than globally.</p>', levels: {
      lvl1: { name: 'Moderately Influential', desc: '<p>A factor in city politics</p>' },
      lvl2: { name: 'Well-Connected', desc: '<p>A force in state politics</p>' },
      lvl3: { name: 'Position of Influence', desc: '<p>A factor in regional politics</p>' },
      lvl4: { name: 'Broad Personal Power', desc: '<p>A force in national politics</p>' },
      lvl5: { name: 'Vastly Influential', desc: '<p>A factor in global politics</p>' },
    }}
  },
  {
    name: 'Mentor', type: 'background', img: 'icons/svg/statue.svg',
    system: { rating: 0, description: '<p>A Kindred (often your sire) who offers guidance, advice, or intervention on your behalf. A mentor won\'t always come to the rescue and may expect favors in return. Remains aloof and will abandon you if you prove troublesome.</p>', levels: {
      lvl1: { name: 'Ancilla', desc: '<p>An ancilla of little influence, or a Ductus/Pack Priest.</p>' },
      lvl2: { name: 'Respected', desc: '<p>A respected elder or decorated veteran.</p>' },
      lvl3: { name: 'Heavily Influential', desc: '<p>A Primogen member or Bishop.</p>' },
      lvl4: { name: 'Great Power', desc: '<p>A Prince or Archbishop.</p>' },
      lvl5: { name: 'Extraordinarily Powerful', desc: '<p>A Justicar or Cardinal.</p>' },
    }}
  },
  {
    name: 'Resources', type: 'background', img: 'icons/svg/coins.svg',
    system: { rating: 0, description: '<p>Wealth and material assets you control: cash, investments, property, or earning capital. Provides a monthly allowance based on rating. Detail the source of income. Less liquid assets take time to convert to cash.</p>', levels: {
      lvl1: { name: 'Sufficient', desc: '<p>Working-class stability. Modest but comfortable.</p>' },
      lvl2: { name: 'Moderate', desc: '<p>Middle-class. Can hire help and maintain a servant. Portable assets for 6 months at the 1-dot level.</p>' },
      lvl3: { name: 'Comfortable', desc: '<p>Prominent community member with land and property. Can draw generous credit. 1-dot lifestyle anywhere, indefinitely.</p>' },
      lvl4: { name: 'Wealthy', desc: '<p>Significant tangible wealth exceeding most peers. 3-dot lifestyle for a year, 2-dot indefinitely without attention.</p>' },
      lvl5: { name: 'Extremely Wealthy', desc: '<p>Vast, widely distributed assets. Governments and corporations court your investment. 3-dot minimum travel comfort.</p>' },
    }}
  },
  {
    name: 'Retainers', type: 'background', img: 'icons/svg/combat.svg',
    system: { rating: 0, description: '<p>Loyal servants: ghouls, dominated mortals, or fanatical followers. You must maintain control through salary, vitae, or Disciplines. They are never blindly loyal without enforcement. Retainers should have flaws and limitations.</p>', levels: {
      lvl1: { name: 'One Retainer', desc: '<p>One retainer</p>' },
      lvl2: { name: 'Two Retainers', desc: '<p>Two retainers</p>' },
      lvl3: { name: 'Three Retainers', desc: '<p>Three retainers</p>' },
      lvl4: { name: 'Four Retainers', desc: '<p>Four retainers</p>' },
      lvl5: { name: 'Five Retainers', desc: '<p>Five retainers</p>' },
    }}
  },
  {
    name: 'Rituals', type: 'background', img: 'icons/svg/fire.svg',
    system: { rating: 0, description: '<p>Sabbat only. Knowledge of Sabbat ritae and rituals. Essential for Pack Priests; without this Background, ritae do not function.</p>', levels: {
      lvl1: { name: 'Initiate', desc: '<p>You know a few auctoritas ritae.</p>' },
      lvl2: { name: 'Practiced', desc: '<p>You know some auctoritas and a few ignobilis ritae.</p>' },
      lvl3: { name: 'Accomplished', desc: '<p>You know all auctoritas ritae and some ignobilis. Can create your own ignobilis given time.</p>' },
      lvl4: { name: 'Expert', desc: '<p>You know all auctoritas and many ignobilis ritae. Familiar with regional and pack-specific ritae.</p>' },
      lvl5: { name: 'Master', desc: '<p>You know all auctoritas and dozens of ignobilis ritae. Familiar with nearly all known ritae across the Sabbat.</p>' },
    }}
  },
  {
    name: 'Status', type: 'background', img: 'icons/svg/anchor.svg',
    system: { rating: 0, description: '<p>Your standing among local Kindred, derived from personal achievement, bloodline, or Sect reputation. High Camarilla Status does not transfer to the Sabbat and vice versa. Caitiff cannot purchase Status at character creation.</p>', levels: {
      lvl1: { name: 'Known', desc: '<p>Known: a neonate / Pack Priest</p>' },
      lvl2: { name: 'Respected', desc: '<p>Respected: an ancilla / respected Ductus</p>' },
      lvl3: { name: 'Influential', desc: '<p>Influential: an elder / Templar</p>' },
      lvl4: { name: 'Powerful', desc: '<p>Powerful: Primogen member / Bishop</p>' },
      lvl5: { name: 'Luminary', desc: '<p>Luminary: a Prince / Archbishop</p>' },
    }}
  },
];

const WEAPONS = [
  // ── Blunt Weapons (bashing) ──
  {
    name: 'Small Club', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'bashing', difficulty: 6, conceal: 'J', range: '',
      description: '<p>Covers blackjacks, batons, tonfas, and short improvised bludgeons under about two feet long.</p>' }
  },
  {
    name: 'Large Club', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'bashing', difficulty: 6, conceal: 'T', range: '',
      requireTrait: 'attributes.strength', requireMin: 2,
      description: '<p>Baseball bats, canes, pool cues, maces, and similar weapons between two and four feet long.</p>' }
  },
  {
    name: 'Staff', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'bashing', difficulty: 5, conceal: 'N', range: '',
      description: '<p>A two-handed blunt weapon roughly as tall as the wielder. Includes bo staves and similar long implements.</p>' }
  },

  // ── Edged Weapons (lethal) ──
  {
    name: 'Knife', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '',
      description: '<p>Any short blade up to about 12 inches. Covers fighting knives, tantos, and utility blades. Conceal P or J depending on size.</p>' }
  },
  {
    name: 'Rapier', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'bashing', difficulty: 6, conceal: 'T', range: '',
      description: '<p>A lightweight thrusting sword. Bashing damage unless the tip is sharpened. Won\'t reliably parry heavier weapons.</p>' }
  },
  {
    name: 'Saber', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      description: '<p>A curved blade two to three feet long. Includes sabers, katanas, and scimitars.</p>' }
  },
  {
    name: 'Broadsword', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      requireTrait: 'attributes.strength', requireMin: 2,
      description: '<p>A straight, heavy blade roughly three feet long. Requires some strength to wield effectively.</p>' }
  },
  {
    name: 'Two-Handed Sword', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+5', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '',
      requireTrait: 'attributes.strength', requireMin: 4,
      description: '<p>A massive blade four to six feet long requiring both hands. Needs Strength + Potence 7 to swing one-handed.</p>' }
  },
  {
    name: 'Stake', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      description: '<p>A sharpened wooden stake. A called shot to the heart (+3 difficulty, 3 successes) paralyzes a vampire until removed.</p>' }
  },

  // ── Miscellaneous Weapons ──
  {
    name: 'Brass Knuckles', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'bashing', difficulty: 6, conceal: 'P', range: '',
      description: '<p>Adds an extra die of bashing damage to punches. Does not stack with claw attacks.</p>' }
  },
  {
    name: 'Whip', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '',
      description: '<p>A flexible weapon that can slash or entangle (treat entangling as a grapple at range).</p>' }
  },
  {
    name: 'Chain', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'bashing', difficulty: 6, conceal: 'J', range: '',
      description: '<p>Heavier than a whip. Less useful for entangling but hits harder.</p>' }
  },

  // ── Thrown Weapons (lethal) ──
  {
    name: 'Dart', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str-1', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '',
      description: '<p>Small throwing weapons including darts and shuriken. Minimal damage on their own but easily coated with chemicals.</p>' }
  },
  {
    name: 'Throwing Knife', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+1', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '',
      description: '<p>A balanced knife designed for throwing. Can be thrown hilt-first for bashing (+1 difficulty).</p>' }
  },
  {
    name: 'Spear', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '',
      requireTrait: 'attributes.strength', requireMin: 2,
      description: '<p>A thrown or thrusting polearm. Can be used with an atlatl for +2 Strength when determining range and damage.</p>' }
  },

  // ── Ranged ──
  {
    name: 'Semi-Auto, Lt', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '20', capacity: '17+1',
      description: '<p>A light semi-automatic pistol (9mm/.22). Rate: 4.</p>' }
  },
  {
    name: 'Semi-Auto, Hv', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '30', capacity: '7+1',
      description: '<p>A heavy semi-automatic pistol (.45 ACP/10mm). Rate: 3.</p>' }
  },
  {
    name: 'Rifle', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '200', capacity: '5+1',
      description: '<p>A bolt-action or semi-automatic rifle. Rate: 1.</p>' }
  },
  {
    name: 'SMG, Small', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '30+1',
      description: '<p>A compact submachine gun. Rate: 3. Capable of bursts, full-auto, and sprays.</p>' }
  },
  {
    name: 'SMG, Large', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '50', capacity: '30+1',
      description: '<p>A full-size submachine gun. Rate: 3. Capable of bursts, full-auto, and sprays.</p>' }
  },
  {
    name: 'Assault Rifle', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '150', capacity: '30+1',
      description: '<p>A military assault rifle. Rate: 3. Capable of bursts, full-auto, and sprays.</p>' }
  },
  {
    name: 'Crossbow', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '20', capacity: '1',
      description: '<p>A modern crossbow. Rate: 1. Wooden bolts can stake a vampire with a called shot to the heart.</p>' }
  },

  // ── Revolvers ──
  {
    name: 'Saturday Night Special', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '12', capacity: '6',
      description: '<p>A cheap, small-caliber revolver. Low stopping power and unreliable, but easy to acquire and discard. Caliber varies (.22, .25, .38). Rate: 3.</p>' }
  },
  {
    name: 'S&W M640 / Colt Agent', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '12', capacity: '6',
      description: '<p>A small holdout revolver with rounded hammer for quick draws from concealment. Caliber: .38 Special. Rate: 3.</p>' }
  },
  {
    name: 'S&W M686 / Colt Python', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '30', capacity: '6',
      description: '<p>A well-regarded mid-caliber revolver. Various barrel lengths available. Caliber: .357 Magnum. Rate: 2.</p>' }
  },
  {
    name: 'S&W Model 29 / Colt Anaconda', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '6', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '35', capacity: '6',
      description: '<p>A high-caliber revolver used for hunting and sport. Difficult to fire one-handed with Strength below 3. Caliber: .44 Magnum. Rate: 2.</p>' }
  },
  {
    name: 'Ruger Redhawk', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '6', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '50', capacity: '6',
      description: '<p>A massive hunting revolver. Too bulky to fire one-handed below Strength 4. A long-barrel variant (Super Redhawk) has Range 100. Caliber: .44 Magnum. Rate: 2.</p>' }
  },
  {
    name: 'Freedom Arms Casull', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '40', capacity: '5',
      description: '<p>A custom-built revolver firing modified rifle rounds. Used for large game hunting. Cannot be fired one-handed below Strength 4. Single-action. Caliber: .454 Casull. Rate: 1.</p>' }
  },
  {
    name: 'Remington XP-100', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '50', capacity: '1',
      description: '<p>A single-shot, bolt-action precision pistol. Can mount a scope. Caliber: .221. Rate: 1.</p>' }
  },

  // ── Automatic Pistols ──
  {
    name: 'Hammerli M280 Target', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '30', capacity: '5+1',
      description: '<p>A precision target pistol with ergonomic custom grip (+1 die for the intended user, -1 for anyone else). Can mount a scope. Caliber: .22 LR. Rate: 5.</p>' }
  },
  {
    name: 'Sites M380', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '20', capacity: '8+1',
      description: '<p>A slim, streamlined autoloader designed for easy concealment and minimal training. Also available in 9mm (Clip 9+1) and .40 S&W (Damage 5, Clip 9+1). Caliber: .380. Rate: 4.</p>' }
  },
  {
    name: 'Walther PPK', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '15', capacity: '7+1',
      description: '<p>A compact, easily concealed German pistol. Silencers are relatively easy to find for this model. Caliber: .380. Rate: 4.</p>' }
  },
  {
    name: 'Beretta Model 92', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '15+1',
      description: '<p>A widely used high-capacity 9mm autoloader, standard issue for many police and military forces. Caliber: 9mm. Rate: 4.</p>' }
  },
  {
    name: 'Calico Model 950', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '20', capacity: '50+1',
      description: '<p>An unusual pistol with a cylindrical top-mounted magazine. An SMG variant (Model 960A) exists with a folding stock (Range 40, burst/auto capable). Caliber: 9mm. Rate: 4. Clip: 50+1 or 100+1.</p>' }
  },
  {
    name: 'Glock 17', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '17+1',
      description: '<p>A popular polymer-framed 9mm pistol. A compact version exists (Clip 10+1, Conceal P). Caliber: 9mm. Rate: 4.</p>' }
  },
  {
    name: 'Glock 20', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '15+1',
      description: '<p>A 10mm polymer-framed pistol with greater stopping power than 9mm models. Compact version available (Clip 10+1, Conceal P). Caliber: 10mm. Rate: 3.</p>' }
  },
  {
    name: 'Glock 21', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '13+1',
      description: '<p>A .45 ACP polymer-framed pistol. Compact version available (Clip 10+1, Conceal P). Caliber: .45 ACP. Rate: 3.</p>' }
  },
  {
    name: 'Glock 22', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '15+1',
      description: '<p>A widely used law enforcement duty pistol. Compact version available (Clip 10+1, Conceal P). Caliber: .40 S&W. Rate: 4.</p>' }
  },
  {
    name: 'Heckler & Koch P7M13', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'P', range: '20', capacity: '13',
      description: '<p>A high-quality German pistol with a grip-integrated safety that fires when held and engages when released. Excellent reputation for reliability. Caliber: 9mm. Rate: 4.</p>' }
  },
  {
    name: 'Colt M1911A1', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '7+1',
      description: '<p>A classic .45 caliber semi-automatic pistol with widespread military and civilian use. Caliber: .45 ACP. Rate: 3. Clip varies by model (7+1 to 9+1).</p>' }
  },
  {
    name: 'SIG-Sauer P220 / P230', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '7+1',
      description: '<p>Reliable Swiss-German autoloaders. P220: .45 ACP, Damage 5. P230: .380, Damage 4. Rate: 3.</p>' }
  },
  {
    name: 'IMI Desert Eagle', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '30', capacity: '7',
      description: '<p>The largest production autoloader. Also available in .357 and .44 Magnum. Minimum Strength 4 to fire one-handed. Caliber: .50 AE. Rate: 1.</p>' }
  },

  // ── Submachine Guns ──
  {
    name: 'Beretta Model 93R', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '20+1',
      description: '<p>A three-round-burst machine pistol variant of the Model 92, with fold-down grip and stock. Not capable of full-auto. Caliber: 9mm. Rate: 15.</p>' }
  },
  {
    name: 'Ceska Model 61', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '3', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '10+1 or 20+1',
      description: '<p>A very small, cheap SMG. Low-powered but easily concealed. Widely available worldwide. Caliber: .32 ACP. Rate: 15. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Glock 18', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '17+1, 19+1, or 33+1',
      description: '<p>A full-auto machine pistol variant of the Glock 17. Designed for law enforcement and military use. Caliber: 9mm. Rate: 19. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Heckler & Koch MP5', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '40', capacity: '15+1 or 30+1',
      description: '<p>An extremely reliable and well-regarded SMG series used by special operations units worldwide. Also available in 10mm (Damage 5). Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Heckler & Koch MP5K', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '15+1 or 30+1',
      description: '<p>A short-barreled, highly concealable variant of the MP5. Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Heckler & Koch MP5SD', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '40', capacity: '15+1 or 30+1',
      description: '<p>A sound-suppressed MP5 variant with integral suppressor. Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'IMI Uzi', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '50', capacity: '16+1, 20+1, or 32+1',
      description: '<p>An iconic SMG with worldwide distribution. Also available in .45 ACP (Damage 5, Clip 16). Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'IMI Mini-Uzi', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '25', capacity: '16+1, 20+1, or 32+1',
      description: '<p>A smaller Uzi variant with reduced range. Also available in .45 ACP (Damage 5, Clip 16). Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'IMI Micro-Uzi', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '15', capacity: '16+1, 20+1, or 32+1',
      description: '<p>The smallest Uzi variant. Very short range. Also available in .45 ACP (Damage 5, Clip 16). Caliber: 9mm. Rate: 21. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Ingram M10', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '25', capacity: '32+1',
      description: '<p>A durable full-auto SMG. Fires full-auto only; single shots require skill. Also available in .45 ACP (Damage 5). Suppressors available. Caliber: 9mm. Rate: 32+. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Intratec TEC-9', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '20+1 or 32+1',
      description: '<p>A cheap semi-auto pistol easily converted to full-auto. Unreliable, especially after modification. Caliber: 9mm. Rate: 18. Burst/auto/spray capable.</p>' }
  },
  {
    name: 'Thompson M1928', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '50', capacity: '20 or 100',
      description: '<p>A heavy, full-auto-only SMG. Optional 100-round drum magazine. Caliber: .45 ACP. Rate: 15. Burst/auto/spray capable.</p>' }
  },

  // ── Rifles ──
  {
    name: 'Remington Model 700', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '300', capacity: '5+1',
      description: '<p>A common bolt-action hunting rifle. Internal ammunition supply. Caliber: .30-06/.308. Rate: 1.</p>' }
  },
  {
    name: 'Remington M24', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '9', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '500', capacity: '5+1',
      description: '<p>Military sniper variant of the Model 700. Extremely difficult to acquire. Caliber: .300 Win Mag. Rate: 1.</p>' }
  },
  {
    name: 'Remington Model 740', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '275', capacity: '5+1',
      description: '<p>A smaller-caliber semi-automatic rifle. Caliber: .223/5.56mm. Rate: 3.</p>' }
  },
  {
    name: 'Ruger 10/22', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '100', capacity: '10+1 or 50+1',
      description: '<p>A small-caliber semi-automatic rifle for small game. Can be converted to full-auto with a skilled gunsmith. Caliber: .22 LR. Rate: 4.</p>' }
  },
  {
    name: 'Weatherby Mark V', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '10', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '300+', capacity: '3+1',
      description: '<p>A bolt-action big-game rifle. Recoil inflicts (7 - Strength) bashing on the firer if not properly braced. Caliber: .460 Weatherby Mag. Rate: 1.</p>' }
  },
  {
    name: 'Barrett Model 82', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '12', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '300', capacity: '11',
      description: '<p>A massive semi-automatic anti-materiel rifle firing heavy machine gun rounds. Ignores any cover lighter than a cinder-block wall. Recoil can break bones in an unprepared shooter. Caliber: .50 BMG. Rate: 1.</p>' }
  },

  // ── Assault Rifles ──
  {
    name: 'Colt M16', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '200', capacity: '20+1 or 30+1',
      description: '<p>Standard U.S. military assault rifle. Newer models are burst-only; older models have full-auto. Caliber: 5.56mm. Rate: 15-20.</p>' }
  },
  {
    name: 'Colt M4', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '120', capacity: '20+1 or 30+1',
      description: '<p>A carbine variant of the M16 with folding stock and shorter barrel. Caliber: 5.56mm. Rate: 15-20.</p>' }
  },
  {
    name: 'AK-74', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '200', capacity: '30',
      description: '<p>Standard Soviet-era assault rifle. Folding-stock variants available (Range 120, Conceal T). Caliber: 5.45mm. Rate: 20.</p>' }
  },
  {
    name: 'Steyr AUG', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '7', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '200', capacity: '42+1',
      description: '<p>A bullpup assault rifle with modular design (convertible to SMG, carbine, or LMG). Integral scope. Caliber: 5.56mm. Rate: 21. SMG config: 9mm, Damage 4, Range 50.</p>' }
  },
  {
    name: 'M14', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '275', capacity: '20+1',
      description: '<p>A 1950s-era battle rifle still in widespread use. A sniper variant (M21) exists. Caliber: 7.62mm. Rate: 10.</p>' }
  },
  {
    name: 'FN FAL', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '275', capacity: '20+1',
      description: '<p>A widely distributed Belgian battle rifle. Caliber: 7.62mm. Rate: 10.</p>' }
  },
  {
    name: 'Heckler & Koch G3', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '275', capacity: '20+1',
      description: '<p>A German battle rifle. Slightly heavier than similar models but very reliable. Caliber: 7.62mm. Rate: 10.</p>' }
  },
  {
    name: 'AK-47', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '250', capacity: '30+1',
      description: '<p>One of the most widely distributed battle rifles in the world. Extremely reliable. Folding-stock variants available (Conceal T). Caliber: 7.62mm Soviet (not interchangeable). Rate: 10.</p>' }
  },

  // ── Shotguns ──
  {
    name: 'Double-Barreled Shotgun', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '2',
      description: '<p>A simple two-shot shotgun. Both barrels can fire as one action. Can be sawed off (Range 10/5, Conceal T/J). Rate: 2. Caliber: 12-gauge.</p>' }
  },
  {
    name: 'Benelli M3 Super 90', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '20', capacity: '7',
      description: '<p>A semi-automatic shotgun used by SWAT teams. Caliber: 12-gauge. Rate: 3.</p>' }
  },
  {
    name: 'Remington 870P', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '8',
      description: '<p>A standard pump-action police shotgun. Can be sawed off (Range 10, Conceal T). Caliber: 12-gauge. Rate: 1.</p>' }
  },
  {
    name: 'Ithaca M37', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '5',
      description: '<p>A pump-action police shotgun. Can be sawed off (Range 10, Conceal T). Caliber: 12-gauge. Rate: 1.</p>' }
  },
  {
    name: 'Mossberg M500', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '5',
      description: '<p>A pump-action police shotgun. Can be sawed off (Range 10, Conceal T). Caliber: 12-gauge. Rate: 1.</p>' }
  },
  {
    name: 'Franchi SPAS-12', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '7',
      description: '<p>A semi-auto shotgun that can switch to pump-action (Rate drops to 1). Folding stock with one-hand brace. Caliber: 12-gauge. Rate: 3.</p>' }
  },
  {
    name: 'Daewoo USAS-12', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '8', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '20', capacity: '12 or 28',
      description: '<p>A fully automatic military shotgun. Punishing recoil. Clip: 12 (magazine) or 28 (drum). Caliber: 12-gauge. Rate: 6.</p>' }
  },

  // ── Accessories ──
  {
    name: 'Telescopic Scopes', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { description: '<p>Adds 2 dice to aimed shots. Increases medium-range distance by 50%. Mountable on rifles, assault rifles, and some revolvers/bolt-action pistols. Requires Firearms 3 to install properly (1 hour + 20 rounds to zero).</p>' }
  },
  {
    name: 'Night-Vision Scopes', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { description: '<p>Starlight: reduces darkness penalties by 1 (min +1). IR: reduces by 2 (min +1), can use IR flashlight. Thermal: reduces darkness/fog/smoke by 3, cover by 1, sees heat signatures (vampires appear blurred unless recently fed). Starlight requires Resources 2, IR requires 3, Thermal requires 4.</p>' }
  },
  {
    name: 'Laser Sights', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { description: '<p>Projects a visible dot on target. Adds 1 die to aimed shots at 30 yards or less. Mountable on any weapon. Resources 3.</p>' }
  },
  {
    name: 'Silencers and Suppressors', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { description: '<p>Reduces gunshot noise. Effective on pistols and SMGs; rifles lose 2+ Damage from suppression. Weapons with Damage over 4 can only be suppressed, not silenced. Adds one level to Conceal. Highly illegal without permits.</p>' }
  },
  {
    name: 'Disguised Weapons', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { description: '<p>A weapon built into a briefcase or similar container. Fires at +2 difficulty with no aimed shots possible. Muzzle flash is visible even if suppressed. Must be opened to reload. Requires Gunsmith 4 to build. Some models (MP5K, Glock 19, M10) come with purpose-built briefcases.</p>' }
  },

  // ── Fan-Made Melee ──
  {
    name: 'Blessed Macuahuitl', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '',
      description: '<p>A macuahuitl is an ancient weapon from mesoamerican times. This weapon has obsidian shards embedded into its sides, meant to cause severe bleeding rather than outright death. This macuahuitl in particular was blessed by a powerful shaman to help Jaguar warriors defend their people from all of the foul beasts that roam the jungles.</p><p>The blessed weapon causes aggravated damage to supernatural creatures. The user is able to reroll up the top three dice in their dice pool without using a point of Willpower. If wielded by a kindred, it increases their hunger by 1 everytime they successfully make an attack with the weapon.</p>' }
  },
  {
    name: 'Silvered Brass Knuckles', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'bashing', difficulty: 6, conceal: 'P', range: '',
      description: '<p>Favored by warriors of faith, these Brass Knuckles were forged with pure silver and coated in holy water. These silvered brass knuckles allow the user to damage spirits and many other supernatural creatures. Although not particularly deadly, this weapon can be easily concealed to ensure the user always has the means to defend themselves.</p><p>Ignores damage immunity or penalties to supernatural creatures. This weapon still respects the resistance of physical armor.</p>' }
  },
  {
    name: 'Poisoned Machete', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      description: '<p>A broad blade used either as an agricultural implement similar to an axe, or in combat like a long-bladed knife. It was said to have been coated in the paralyzing vitae of a powerful Tremere long ago. It\'s blade still shines with a sickly green color that yearns to course through the veins of another creature. Once the blade makes contact with flesh, the poison rushes into the bloodstream. Afterwards, the poison requires an hour in order to regenerate back onto the blade\'s edge.</p><p>A creature struck with this weapon enters Torpor for 1 minute if they are kindred or for the scene if they are human.</p>' }
  },
  {
    name: 'Oni Tooth Katana', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      description: '<p>This Japanese sword is said to be infused with the teeth of an Oni. It is said to provide the user with sight in darkness and enhanced fighting abilities at the cost of blood.</p><p>Requires 1 point of Aggravated damage to activate. Increases Melee skill to 4. Allows sight in darkness and negates Oblivion discipline based stealth.</p>' }
  },
  {
    name: 'Golden Gada', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+4', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '',
      description: '<p>A golden spherical head mounted on a shaft, with a spike on the top. On this weapon has the holy inscriptions of shamans that protect the user from supernatural harm. A weapon made for the sole purpose of smiting the undead, it hurts the eyes of nonmortal creatures.</p><p>Requires 4 Strength or Resolve to wield. Requires mortal to be wielded. Increases Stamina to 5. Grants immunity to user against Dominate and Presence disciplines. Causes 1 point of aggravated damage if a undead creatures touches the object willingly.</p>' }
  },
  {
    name: 'S.A.D. Standard Issue Stun Baton', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'bashing', difficulty: 6, conceal: 'T', range: '',
      description: '<p>The Special Affairs Division Stun Baton releases a minimum of 20 million volts to temporarily disable and keep any attacker at bay. The voltage can be increased to the point that even the supernatural find the weapon to be a threat. These weapons have been known to find themselves on the black market and in the hands of well-connected Hunters.</p><p>On a critical, a Kindred enters Torpor for 10 minutes or a Mortal dies.</p>' }
  },
  {
    name: 'Bladed Whip', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+2', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '',
      description: '<p>A cruel device made by twisted kindred centuries ago with the sole intention of torturing its victim. This whip is made with three serrated blade tails, meant to cut open the flesh with every strike. However, in recent years modern hunters have modified the weapon to ignite in flame to use against those that walk the path of night.</p><p>Requires 3 Dexterity or Melee to wield. Causes aggravated damage instead of superficial damage to creatures with a weakness to flame.</p>' }
  },
  {
    name: 'Steel Bat', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'bashing', difficulty: 6, conceal: 'T', range: '',
      description: '<p>An ordinary-looking baseball bat that has been enhanced with reinforced steel. Used by Hunters who wish to carry their weapon with them without arousing too much suspicion. Although this weapon is dense, it causes a devastating impact to anything unlucky enough to get in its path.</p><p>Requires 3 Strength or Melee to wield. Deal double damage to objects.</p>' }
  },
  {
    name: 'Cursed Spear', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: 'Str+3', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '',
      description: '<p>A weapon forged from the Jungles of South America with a particularly large series of fangs that serves as the tip of the spear. Fangs said to be from werewolves who fought and lost their conflict with the Incas. These fangs refuse to dull and can pierce steel.</p><p>Ignores armor and is able to inflict damage to spirits.</p>' }
  },

  // ── Fan-Made Ranged ──
  {
    name: 'Hunters\' .44 Magnum', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '35', capacity: '6',
      description: '<p>The .44 Remington Magnum, also known as Hunters\' .44 Magnum, is a rimmed, large-bore cartridge. Once famously called \'the most powerful handgun in the world\', it remains a favorite amongst Hunters looking to inform any foe that they mean business. This handgun is strong enough to take down a bear and will absolutely cause real damage to most foul creatures that walk the path of night.</p><p>Causes aggravated damage to kindred. On a critical, it sends the kindred into torpor. Results may vary on Werewolves. Ignores 2 Armor. Holds 6 bullets.</p>' }
  },
  {
    name: 'Special Affairs Division Riot Shotgun', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '4', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '20', capacity: '10',
      description: '<p>A riot shotgun is a shotgun designed or modified for use as a primarily defensive weapon, by the use of a short barrel and a larger magazine capacity than standard shotguns. This weapon was designed to ward off supernatural creatures in close quarters combat.</p><p>Ignores 2 armor in close combat. 10 shell capacity.</p>' }
  },
  {
    name: 'S.A.D. Flamethrower', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '3', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '15', capacity: '',
      description: '<p>A flamethrower is a ranged incendiary device designed to project a controllable jet of fire. This device is made by the Special Affairs Division to help fight against enemies capable of warping the perception of others by spraying fire in any area an enemy might be. This device has a tank filled with fuel used to create the flames. While it does have a hardened tank to help prevent explosions, it is still vulnerable.</p><p>Ignores cover. 20 minutes worth of flame. Capable of attacking multiple enemies at once. Sets affected area on fire.</p>' }
  },
  {
    name: 'Compound Crossbow', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '3', damageType: 'lethal', difficulty: 6, conceal: 'T', range: '20', capacity: '1',
      description: '<p>A crossbow is a ranged weapon using an elastic launching device consisting of a bow-like assembly called a prod, mounted horizontally on the main frame called a tiller, which is hand-held in a similar fashion to the stock of a long firearm. Although the firepower offered by the crossbow pales in comparison to firearms, it makes up for in stealth and customization. Allowing users to alter the bolts to specifically target the weakness of their enemy.</p><p>Ignores 1 Armor. Silvered bolts affect all supernatural creatures.</p>' }
  },
  {
    name: 'Boomerang Blade', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '2', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '15', capacity: '1',
      description: '<p>This weapon is crafted from sharpened metal and is intended to be thrown at enemies. During its flight, it will curve and return to the user if used correctly. While it may not outright kill a creature, it has been known to be effective in weakening a target for allies to bring down.</p><p>Requires 3 Dexterity to use properly. Affects all supernatural creatures.</p>' }
  },
  {
    name: 'Silenced Pistol', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '2', damageType: 'lethal', difficulty: 6, conceal: 'J', range: '20', capacity: '13',
      description: '<p>A silencer, also known as a sound suppressor, suppressor, or sound moderator, is a muzzle device that reduces the acoustic intensity of the gunshot. This helps the every day assassin with their goal of maintaining stealth while on a mission.</p><p>Silent gun shot. Ignores 1 armor. 13 rounds.</p>' }
  },
  {
    name: 'M134 Mini Gun', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '3', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '200', capacity: '6000',
      description: '<p>The M134 Minigun is an American six-barrel rotary machine gun with a high rate of fire ranging around 2,000 to 6,000 rounds per minute. Featuring a Gatling-style rotating barrel assembly with an external power source, normally an electric motor. When stealth is not an objective, this weapon helps level the playing field regardless of what supernatural powers are in play.</p><p>Ignores armor. Requires 3 Strength to wield. 6000 rounds.</p>' }
  },
  {
    name: 'AS50 Sniper Rifle', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '5', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '250', capacity: '5',
      description: '<p>The AS50 is a semi-automatic .50 BMG anti-materiel precision rifle. It enables operators to engage targets at very long ranges with high accuracy using explosive or incendiary ammunition. Highly trained operatives use these weapons to eliminate threats before their targets even realize they are in danger. A well-placed shot from this weapon will grievously wound any creature regardless of what power it wields.</p><p>If you open a fight while using this weapon, add 2 additional dice to your combat roll. Causes aggravated damage to all physical creature types. Ignores armor.</p>' }
  },
  {
    name: 'SCAR', type: 'weapon', img: 'icons/svg/sword.svg',
    system: { damage: '3', damageType: 'lethal', difficulty: 6, conceal: 'N', range: '150', capacity: '20',
      description: '<p>A favorite of most Special Affairs Division operatives. This Belgian-made assault rifle is capable of grenade launcher attachments to help eliminate threats big and small. This weapon allows for accuracy as well as fire power in the battlefield that is quick to overwhelm less armed enemies.</p><p>Gun - Ignores 1 armor. 20 Rounds.</p><p>Grenade Launcher (+5 Damage) - Ignores 2 Armor. 3 Grenades. Deals damage to all creatures within a 20ft area.</p>' }
  },
];

const ARMOR = [
  {
    name: 'Reinforced Clothing', type: 'armor', img: 'icons/svg/shield.svg',
    system: { rating: 1, penalty: 0, equipped: false,
      description: '<p>Heavy leather or thick clothing offering minimal protection without restricting movement.</p>' }
  },
  {
    name: 'Armor T-Shirt', type: 'armor', img: 'icons/svg/shield.svg',
    system: { rating: 2, penalty: -1, equipped: false,
      description: '<p>A thin concealed Kevlar vest worn under a shirt. Light but slightly restrictive.</p>' }
  },
  {
    name: 'Kevlar Vest', type: 'armor', img: 'icons/svg/shield.svg',
    system: { rating: 3, penalty: -1, equipped: false,
      description: '<p>A standard ballistic vest. Covers the torso with solid protection against small arms.</p>' }
  },
  {
    name: 'Flak Jacket', type: 'armor', img: 'icons/svg/shield.svg',
    system: { rating: 4, penalty: -2, equipped: false,
      description: '<p>A heavy military-grade jacket with ballistic plating. Bulky and conspicuous.</p>' }
  },
  {
    name: 'Full Body Armor', type: 'armor', img: 'icons/svg/shield.svg',
    system: { rating: 5, penalty: -3, equipped: false,
      description: '<p>Complete tactical body armor with helmet and limb plating. Extremely restrictive.</p>' }
  },
];

const MERITS = [
  // ── Physical ──
  { name: 'Acute Sense', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>One of your senses is exceptionally sharp. -2 difficulty on rolls using that sense. Stacks with Auspex.</p>' } },
  { name: 'Ambidextrous', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>No off-hand penalty. Multiple-action rules still apply, but no difficulty increase for using your non-dominant hand.</p>' } },
  { name: 'Bruiser', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>Your appearance radiates quiet menace. -1 difficulty on Intimidation rolls against those who haven\'t proven physically superior to you.</p>' } },
  { name: 'Catlike Balance', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>Innate perfect balance. -2 difficulty on all balance-related rolls.</p>' } },
  { name: 'Early Riser', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>Your Humanity/Path is treated as 10 for determining when you rise each evening. Cannot take Deep Sleeper.</p>' } },
  { name: 'Eat Food', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>You can eat and taste normal food (though you gain no nourishment and must expel it later). Useful for passing as human.</p>' } },
  { name: 'Friendly Face', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'physical', description: '<p>Your face reminds everyone of someone they know. -1 difficulty on appropriate Social rolls with strangers on first meeting.</p>' } },
  { name: 'Blush of Health', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'physical', description: '<p>You retain the color of a living mortal and your skin feels only slightly cool. Much easier to pass as human.</p>' } },
  { name: 'Enchanting Voice', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'physical', description: '<p>Your voice commands attention. -2 difficulty on rolls using your voice to persuade, charm, or command.</p>' } },
  { name: 'Daredevil', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'physical', description: '<p>+3 dice on exceptionally risky non-combat actions (diff 8+, potential 3+ health levels damage). Negate one botch die from such rolls.</p>' } },
  { name: 'Efficient Digestion', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'physical', description: '<p>Gain 1 extra blood point for every 2 consumed when feeding. Cannot exceed blood pool maximum.</p>' } },
  { name: 'Huge Size', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 4, meritType: 'physical', description: '<p>At least 6\'10" and 300 lbs. Gain an extra Bruised health level. Bonuses to pushing, resisting knockdown, etc. Very conspicuous.</p>' } },

  // ── Mental ──
  { name: 'Coldly Logical', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>You separate facts from emotional coloring. -1 difficulty on related rolls to see through deception or hysteria.</p>' } },
  { name: 'Common Sense', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>The ST may warn you when you\'re about to do something obviously unwise.</p>' } },
  { name: 'Concentration', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>You are unaffected by dice penalties from distracting circumstances (loud noise, strobe lights, etc.).</p>' } },
  { name: 'Introspection', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>Keen insight into motivations. +2 Perception dice against anyone sharing your Nature or Demeanor.</p>' } },
  { name: 'Language', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>You know one additional language beyond your native tongue. May be taken multiple times.</p>' } },
  { name: 'Time Sense', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>You can accurately estimate the passage of time without a clock or other device.</p>' } },
  { name: 'Useful Knowledge', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'mental', description: '<p>Your expertise in a specific field makes you interesting to an elder, granting temporary patronage. Functions like a 1-dot Mentor with a specific interest, but not permanent.</p>' } },
  { name: 'Code of Honor', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'mental', description: '<p>You follow a strict personal code of ethics (work out details with the ST). +2 dice on Willpower/Virtue rolls when acting in accordance with your code or resisting violations of it.</p>' } },
  { name: 'Computer Aptitude', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'mental', description: '<p>Computers are intuitive to you. -2 difficulty on all computer-related rolls.</p>' } },
  { name: 'Eidetic Memory', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'mental', description: '<p>You remember everything you see and hear with perfect detail. Under stress, roll Perception + Alertness (diff 6) to concentrate.</p>' } },
  { name: 'Light Sleeper', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'mental', description: '<p>You wake instantly at any sign of trouble with no grogginess. Ignore Humanity/Path restrictions on daytime dice pools.</p>' } },
  { name: 'Calm Heart', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'mental', description: '<p>+2 dice when resisting frenzy. Brujah may not take this Merit.</p>' } },
  { name: 'Iron Will', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'mental', description: '<p>You resist mental Disciplines (Dominate, Presence) with extraordinary tenacity. +3 dice on Willpower rolls to resist such powers.</p>' } },
  { name: 'Precocious', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'mental', description: '<p>You learn quickly. Training time and experience costs for a chosen Ability (or Abilities, at ST discretion) are halved.</p>' } },

  // ── Social ──
  { name: 'Bullyboy', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>You\'re known as a vampire willing to use physical force. +1 die on Social rolls where implied violence would help. Caitiff cannot take this Merit.</p>' } },
  { name: 'Natural Leader', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>Others naturally follow your direction. -2 difficulty on Leadership rolls.</p>' } },
  { name: 'Prestigious Sire', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>Your sire is well-regarded, earning you a measure of respect by association. -1 difficulty on Social rolls with those who respect your sire.</p>' } },
  { name: 'Scholar of Enemies', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'social', description: '<p>You have extensive knowledge of your Sect\'s enemies. +2 dice on Intelligence rolls when planning against them.</p>' } },
  { name: 'Scholar of Others', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'social', description: '<p>You have studied one other Clan or faction extensively. +2 dice on Intelligence rolls relating to that group.</p>' } },
  { name: 'Old Pal', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'social', description: '<p>You have a close friend from your mortal days who is now a vampire in another Clan or Sect. You maintain a friendly relationship despite political differences.</p>' } },
  { name: 'Boon', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>An elder owes you a favor. The value of the boon depends on how many points you spend. One point might be a minor favor; more points represent significant debts.</p>' } },

  // ── Additional Merits ──
  { name: 'Additional Discipline', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 5, meritType: 'supernatural', description: '<p>You have access to one additional Discipline outside your Clan\'s normal repertoire. This counts as a Clan Discipline for all purposes including XP costs.</p>' } },
  { name: 'Broken Bond', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 4, meritType: 'social', description: '<p>You were once blood bound but have broken free. Your former regnant is likely unaware or actively hunting you.</p>' } },
  { name: 'Clan Friendship', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 4, meritType: 'social', description: '<p>An entire Clan (not your own) has a favorable opinion of you. +1 die on Social rolls with members of that Clan. The friendship must be reciprocated through roleplay.</p>' } },
  { name: 'Deceptive Aura', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'supernatural', description: '<p>Your aura does not display the pale hue typical of vampires. To Auspex users, you appear mortal.</p>' } },
  { name: 'Elysium Regular', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>You are a regular at Elysium gatherings. +1 die on Social rolls while in Elysium.</p>' } },
  { name: 'Former Ghoul', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'supernatural', description: '<p>You were a ghoul before your Embrace. You retain knowledge of your former domitor\'s activities, which can be useful or dangerous.</p>' } },
  { name: 'Friend of the Underground', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'social', description: '<p>You have connections among the Nosferatu or other underground networks. You can call on them for information or shelter.</p>' } },
  { name: 'Harmless', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>Everyone considers you a non-threat. People don\'t bother to watch you or guard their tongues around you. +1 die on subterfuge-related Social rolls in political situations.</p>' } },
  { name: 'Healing Touch', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'supernatural', description: '<p>Your lick heals wounds rather than causing the normal Kiss. You can seal bite marks automatically after feeding.</p>' } },
  { name: 'Hidden Diablerie', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'supernatural', description: '<p>The black veins that appear in a diablerist\'s aura are not visible in yours. Auspex users cannot detect your past diablerie through aura reading.</p>' } },
  { name: 'Inoffensive to Animals', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'supernatural', description: '<p>Animals do not react negatively to your vampiric presence. They treat you as they would any mortal.</p>' } },
  { name: 'Lucky', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'supernatural', description: '<p>Things tend to go your way. Once per session, you may reroll a failed roll (not a botch).</p>' } },
  { name: 'Magic Resistance', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'supernatural', description: '<p>You have a natural resistance to Thaumaturgy and other blood magic. +2 difficulty for anyone targeting you with such powers. This also affects beneficial magic.</p>' } },
  { name: 'Medium', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'supernatural', description: '<p>You can perceive and communicate with ghosts without Necromancy. You can sense when ghosts are nearby and interact with them naturally.</p>' } },
  { name: 'Natural Linguist', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'mental', description: '<p>You have a gift for languages. The time to learn a new language is halved, and you can communicate basic ideas in a language after only brief exposure.</p>' } },
  { name: 'Nine Lives', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 6, meritType: 'supernatural', description: '<p>Fate protects you. You can avoid certain-death situations a number of times per chronicle (determined by the ST, but usually limited). Each "life" spent averts one lethal outcome.</p>' } },
  { name: 'Oracular Ability', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'supernatural', description: '<p>You receive visions of the future, usually in dreams. The visions are cryptic and symbolic, never clear instructions. The ST provides the visions at dramatically appropriate moments.</p>' } },
  { name: 'Primogen Friendship', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 4, meritType: 'social', description: '<p>A Primogen member is favorably disposed toward you. They will offer advice and minor aid, though they won\'t risk their own position for you.</p>' } },
  { name: 'Protege', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>An influential Kindred has taken an interest in your development. Similar to Mentor but more patron-like; they introduce you to useful contacts.</p>' } },
  { name: 'Rep', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>You have a positive reputation among Kindred. -1 difficulty on Social rolls with those who know your reputation.</p>' } },
  { name: 'Rising Star', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'social', description: '<p>You are seen as one to watch by the Kindred establishment. Elders are more willing to help and less inclined to hinder you. -1 difficulty on Social rolls with elders.</p>' } },
  { name: 'Sabbat Survivor', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 1, meritType: 'social', description: '<p>You survived a Sabbat attack and your experience gives you insight into their tactics. +1 die when planning against or fighting Sabbat.</p>' } },
  { name: 'Sanctity', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'supernatural', description: '<p>Something about you puts others off harming you. Attackers must roll Willpower (diff 8) before attacking you, even in frenzy.</p>' } },
  { name: 'Spirit Mentor', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'supernatural', description: '<p>A disembodied spirit watches over you and offers guidance. It may be a ghost, an ancestor, or something stranger. Advice comes through dreams, whispers, or signs.</p>' } },
  { name: 'True Faith', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 7, meritType: 'supernatural', description: '<p>You possess genuine faith in a higher power. You can repel vampires by presenting a holy symbol and rolling Willpower (diff of target\'s Willpower). Each success keeps the vampire at bay for one turn. You are immune to Dominate and Presence.</p>' } },
  { name: 'True Love', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 4, meritType: 'supernatural', description: '<p>You have found (and possibly lost) true love. This gives you an extra Willpower point to spend once per session when acting to protect or return to your love.</p>' } },
  { name: 'Unbondable', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 5, meritType: 'supernatural', description: '<p>You cannot be blood bound. No amount of another vampire\'s vitae can create a bond over you.</p>' } },
  { name: 'Lawman\'s Friend', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'social', description: '<p>You have contacts and allies in local law enforcement. They don\'t know about the supernatural but will do you favors within reason.</p>' } },
  { name: 'Mole', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 3, meritType: 'social', description: '<p>You have an informant inside an enemy organization who regularly feeds you information.</p>' } },
  { name: 'Open Road', type: 'merit', img: 'icons/svg/upgrade.svg', system: { cost: 2, meritType: 'social', description: '<p>You can travel freely between Camarilla cities without difficulty. Princes give you safe passage (though not necessarily respect).</p>' } },
];

const FLAWS = [
  // ── Physical Flaws ──
  { name: 'Hard of Hearing', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>+2 difficulty on hearing-based Perception rolls.</p>' } },
  { name: 'Short', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>You are well below average height. -2 dice on pursuit rolls. May have difficulty reaching things or being taken seriously.</p>' } },
  { name: 'Smell of the Grave', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>You exude an odor of earth, decay, or embalming fluid. -2 dice on Social rolls with mortals in close proximity.</p>' } },
  { name: 'Tic/Twitch', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>You have a repetitive motion that you perform unconsciously under stress. +1 difficulty on Social and Stealth rolls during tense situations.</p>' } },
  { name: 'Bad Sight', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>+2 difficulty on vision-based Perception rolls. Correctable with glasses/contacts, but those can be lost.</p>' } },
  { name: 'One Eye', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'physical', description: '<p>+2 difficulty on Perception rolls involving depth perception. -1 die to ranged attack rolls.</p>' } },
  { name: 'Disfigured', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'physical', description: '<p>A visible disfigurement makes you ugly and memorable. Appearance cannot exceed 2. Social difficulties may increase.</p>' } },
  { name: 'Child', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>You were Embraced as a child. You have the Strength and Stamina of a child (max 2 without Potence/Fortitude), and adults rarely take you seriously. Restricted in many mortal social situations.</p>' } },
  { name: 'Deformity', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>You have a significant physical deformity (misshapen limb, hunchback, etc.) that affects interactions and may impair movement. +2 difficulty on physical and some social rolls depending on the deformity.</p>' } },
  { name: 'Lame', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>Your legs are damaged or otherwise impaired. Movement speed is halved, and running is impossible.</p>' } },
  { name: 'Monstrous', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>Your Appearance is 0 and can never be raised. You are obviously inhuman and must stay hidden from mortals. A Nosferatu taking this Flaw is something truly terrible to behold.</p>' } },
  { name: 'Permanent Wound', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>You have an unhealing wound that constantly seeps blood, costing you an extra blood point per night. The wound cannot be healed by any means.</p>' } },
  { name: 'Slow Healing', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>You heal damage at half the normal rate, requiring twice the blood and/or time.</p>' } },
  { name: 'Addiction', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>You are addicted to a substance that must be present in the blood you drink. If absent, you automatically frenzy.</p>' } },
  { name: 'Blind', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -6, meritType: 'physical', description: '<p>You cannot see. Vision-based Perception rolls automatically fail. +2 difficulty on most physical actions. Some activities are impossible without assistance.</p>' } },
  { name: 'Deep Sleeper', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'physical', description: '<p>Extremely difficult to wake during the day. Waking requires a Willpower roll (diff 8). You lose 2 dice from all pools for the first 10 minutes after waking.</p>' } },

  // ── Mental Flaws ──
  { name: 'Nightmares', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>Horrible nightmares every time you sleep. On waking, roll Willpower (diff 7) or lose 1 die on all actions for the night. Botch: you believe you\'re still in the nightmare.</p>' } },
  { name: 'Prey Exclusion', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You refuse to feed from a specific class of prey (children, women, the innocent, etc.). If forced to do so, you automatically frenzy.</p>' } },
  { name: 'Shy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>+1 difficulty on Social rolls in crowds or unfamiliar situations. With close friends or in solitude, no penalty.</p>' } },
  { name: 'Soft-Hearted', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You can\'t stand suffering. Whenever witnessing cruelty or inflicting pain, you are at +2 difficulty on all rolls for the rest of the scene unless you find a way to alleviate the suffering.</p>' } },
  { name: 'Speech Impediment', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You stutter, lisp, or otherwise have difficulty speaking clearly. +2 difficulty on verbal Communication rolls. Certain Disciplines requiring speech may also be affected.</p>' } },
  { name: 'Territorial', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You are extremely protective of your domain. +2 difficulty to resist frenzy when anyone enters your territory uninvited.</p>' } },
  { name: 'Vengeful', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You hold grudges and pursue revenge obsessively. Roll Willpower (diff 7) to resist acting against someone who has wronged you when the opportunity arises.</p>' } },
  { name: 'Lunacy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>The moon phases increase your frenzy difficulty: crescent +1, half/gibbous +2, full +3.</p>' } },
  { name: 'Short Fuse', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>+2 difficulty to resist frenzy. Brujah cannot take this Flaw.</p>' } },
  { name: 'Weak-Willed', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'mental', description: '<p>-2 dice on Willpower rolls to resist Dominate, Presence, and other mental influence.</p>' } },
  { name: 'Amnesia', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You cannot remember your mortal life or the events leading to your Embrace. Memories may surface at the worst possible times (ST discretion).</p>' } },
  { name: 'Confused', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You frequently become disoriented or confused, especially under stress. +1 difficulty to Wits-related rolls in complex or fast-moving situations.</p>' } },
  { name: 'Absent-Minded', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'mental', description: '<p>You are deeply absorbed in your own thoughts and forget things constantly. Roll Wits + Alertness (diff 7) to remember immediate details. You may forget appointments, names, or even combat priorities.</p>' } },
  { name: 'Thirst for Innocence', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>The sight of innocence triggers bloodlust. Roll Self-Control/Instinct or frenzy and attack the source.</p>' } },
  { name: 'Guilt-Wracked', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'mental', description: '<p>You are consumed by guilt for what you\'ve become. Gain a temporary derangement from the guilt at least once per session (ST discretion).</p>' } },

  // ── Social Flaws ──
  { name: 'Infamous Sire', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>Your sire is despised or feared. +2 difficulty on Social rolls with those who know your lineage.</p>' } },
  { name: 'Mistaken Identity', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You look identical to another Kindred and are constantly confused for them. Problems intended for that person find their way to you.</p>' } },
  { name: 'New Arrival', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You\'re new in town and know nobody. You have no local contacts, allies, or established relationships, and must build everything from scratch.</p>' } },
  { name: 'New Kid', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You\'re the most recently Embraced in the city. +1 difficulty on Social rolls with other neonates who constantly remind you of your low status.</p>' } },
  { name: 'Recruitment Target', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>An enemy organization is aggressively trying to recruit you. They show up at the worst times.</p>' } },
  { name: 'Sire\'s Resentment', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>Your sire dislikes you and actively seeks to harm you. Their allies work against you as well.</p>' } },
  { name: 'Special Responsibility', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You volunteered for a duty to gain respect, and now you\'re stuck with it. No credit for doing it, but you\'d lose standing if you stopped.</p>' } },
  { name: 'Sympathizer', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You\'ve publicly sympathized with the enemy Sect\'s goals. You are suspected of treason.</p>' } },
  { name: 'Enemy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You have an enemy seeking to harm you. Higher point values represent more powerful enemies.</p>' } },
  { name: 'Bound', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You are blood bound to another vampire. Your will is not entirely your own. Sabbat cannot take this Flaw.</p>' } },
  { name: 'Catspaw', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You\'ve done dirty work for someone powerful and are now a liability they want to silence.</p>' } },
  { name: 'Escaped Target', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>Someone you intended to Embrace was taken by another. +2 difficulty to resist frenzy in their presence. +1 difficulty on Charisma rolls until resolved.</p>' } },
  { name: 'Failure', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You held a position of responsibility and failed catastrophically. You\'re branded as incompetent and excluded from power circles.</p>' } },
  { name: 'Masquerade Breaker', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You broke the Masquerade early on. Someone covered for you and now holds it over you. Only for Sects that observe the Masquerade.</p>' } },
  { name: 'Old Flame', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>A former loved one now works with the enemy and plays on your sympathies. Contested Manipulation + Expression roll to act against them.</p>' } },
  { name: 'Outcast', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You are shunned by other Kindred. Most won\'t willingly associate with you.</p>' } },
  { name: 'Rival Sires', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>Two vampires wanted to Embrace you. The one who failed is at +2 difficulty to resist frenzy around you and may work to destroy you.</p>' } },
  { name: 'Uppity', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'social', description: '<p>You brag too much about your status. +2 difficulty on Social rolls with vampires you\'ve alienated. Roll Willpower (diff 6) to keep your mouth shut when you could boast.</p>' } },
  { name: 'Disgrace to the Blood', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>Your sire publicly considers your Embrace a mistake. You are mocked at gatherings and your achievements are discounted.</p>' } },
  { name: 'Former Prince', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>You were once a Prince but lost that position. The current Prince is wary of you and may act against you. Camarilla only.</p>' } },
  { name: 'Hunted Like a Dog', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>Another Sect or group has marked you for extermination and pursues you relentlessly.</p>' } },
  { name: 'Narc', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>You are known as an informer. +1 difficulty on Social rolls with those who disagree with your politics. People feed you misinformation.</p>' } },
  { name: 'Notoriety', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>You have a bad reputation (deserved or not). +2 difficulty on Social rolls with those who\'ve heard of you.</p>' } },
  { name: 'Sleeping With the Enemy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'social', description: '<p>You have a secret intimate relationship with a member of an opposing Sect. Discovery means death.</p>' } },
  { name: 'Clan Enmity', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>An entire Clan wants you dead. +2 difficulty on all Social rolls with members of that Clan.</p>' } },
  { name: 'Hunted', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>A fanatical witch-hunter pursues you. Anyone you associate with may also be targeted.</p>' } },
  { name: 'Loathsome Regnant', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>You are blood bound to a vampire who mistreats you horribly. Sabbat cannot take this Flaw.</p>' } },
  { name: 'Overextended', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>You\'ve accumulated too much influence. People work actively to cut you down and block your expansion.</p>' } },
  { name: 'Probationary Sect Member', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>You defected from another Sect and are treated with distrust and hostility until you prove yourself.</p>' } },
  { name: 'Blood Hunted', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'social', description: '<p>You are the target of a blood hunt. At 4 points, only your home city is off limits. At 6, the entire Camarilla hunts you. Camarilla only.</p>' } },
  { name: 'Laughingstock', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -5, meritType: 'social', description: '<p>The Harpies have made you their favorite target. +2 difficulty on Social rolls in Elysium, +1 elsewhere. +2 difficulty to Intimidate or Dominate anyone who\'s heard the mockery. Camarilla only.</p>' } },
  { name: 'Red List', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -7, meritType: 'social', description: '<p>You are on (or being considered for) the Camarilla\'s Red List. Any Camarilla vampire will attack on sight or call for overwhelming backup.</p>' } },

  // ── Supernatural ──
  { name: 'Cast No Reflection', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'supernatural', description: '<p>You cast no reflection. Detrimental for passing as human. You may be mistaken for a Lasombra.</p>' } },
  { name: 'Cold Breeze', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'supernatural', description: '<p>A chill wind follows you everywhere. +1 difficulty on appropriate Social rolls with mortals. Obviously supernatural.</p>' } },
  { name: 'Repulsed by Garlic', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'supernatural', description: '<p>You cannot abide garlic. Roll Willpower (difficulty varies) or flee from the smell.</p>' } },
  { name: 'Touch of Frost', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'supernatural', description: '<p>Plants wither as you approach and die at your touch. Your skin leeches heat from living beings.</p>' } },
  { name: 'Cursed', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'supernatural', description: '<p>You suffer a supernatural curse. Severity depends on points spent: betrayed secrets rebound on you (1 pt), tools break in your hands (3 pts), your accomplishments always sour (5 pts).</p>' } },
  { name: 'Beacon of the Unholy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>You radiate palpable evil. Clergy and devout mortals instinctively know something is wrong with you.</p>' } },
  { name: 'Deathsight', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Everything looks rotted and decayed to you. -2 difficulty to resist Appearance-based effects, but +2 difficulty on Perception rolls and +1 on Social rolls.</p>' } },
  { name: 'Eerie Presence', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Mortals unconsciously sense your undead nature. +2 difficulty on all Social rolls with mortals.</p>' } },
  { name: 'Lord of the Flies', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Buzzing flies swarm around you constantly. +1 difficulty on Social rolls, +2 on Stealth rolls.</p>' } },
  { name: 'Can\'t Cross Running Water', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'supernatural', description: '<p>You cannot cross running water unless at least 50 feet above it. Running water = any body at least 2 feet wide and not stagnant.</p>' } },
  { name: 'Haunted', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'supernatural', description: '<p>An angry ghost (likely an early victim) haunts you, actively hindering you and tormenting those in your presence.</p>' } },
  { name: 'Repelled by Crosses', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'supernatural', description: '<p>Ordinary crosses repel you. Roll Willpower (diff 9) or flee for the scene. Botch: the touch of a cross deals 1 unsoakable aggravated per turn of contact.</p>' } },
  { name: 'Grip of the Damned', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'supernatural', description: '<p>Your bite brings only pain, not ecstasy. Victims struggle and scream, requiring you to grapple them. May require a Humanity roll at ST discretion. Giovanni cannot take this Flaw.</p>' } },
  { name: 'Dark Fate', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -5, meritType: 'supernatural', description: '<p>You are doomed to a terrible end. You occasionally have visions of this fate (spend Willpower or -1 die to all actions for the night). The ST determines the nature and timing.</p>' } },
  { name: 'Light-Sensitive', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -5, meritType: 'supernatural', description: '<p>Sunlight deals double damage. Moonlight can cause lethal damage when shining directly on you. Bright lights hurt your eyes. Followers of Set cannot take this Flaw.</p>' } },

  // ── Additional Flaws ──
  { name: 'Botched Presentation', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>Your introduction to Kindred society went badly. You are remembered for the embarrassment and treated accordingly.</p>' } },
  { name: 'Conspicuous Consumption', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'supernatural', description: '<p>You must completely drain and kill any mortal you feed from. You cannot take small sips. Each feeding is a potential Masquerade breach.</p>' } },
  { name: 'Dark Secret', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>You harbor a secret that would be devastating if revealed. Discovery could mean exile, blood hunt, or worse.</p>' } },
  { name: 'Deaf', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'physical', description: '<p>You cannot hear. All hearing-based Perception rolls automatically fail. Verbal Disciplines that require the target to hear cannot affect you, but you also cannot use speech-based powers.</p>' } },
  { name: 'Disease Carrier', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'supernatural', description: '<p>You carry a mortal disease that does not affect you but is transmitted to anyone you bite or share blood with. Particularly dangerous for the Masquerade.</p>' } },
  { name: 'Dulled Bite', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'physical', description: '<p>Your fangs produce no ecstatic sensation when you bite. Victims feel only pain and will struggle, requiring you to restrain them.</p>' } },
  { name: 'Expendable', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'social', description: '<p>Nobody would miss you. Your Sect considers you disposable and would sacrifice you without hesitation.</p>' } },
  { name: 'Fifteenth Generation', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'supernatural', description: '<p>Your blood is so thin that many vampiric abilities are weakened. Blood pool max is 10, can spend only 1 per turn, max trait rating is 4. Some Disciplines may not function at full power.</p>' } },
  { name: 'Flashbacks', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -6, meritType: 'mental', description: '<p>Certain stimuli trigger vivid flashbacks that incapacitate you. During a flashback, you cannot act for 1-3 turns (ST discretion) and may react violently to perceived threats that aren\'t real.</p>' } },
  { name: 'Flesh of the Corpse', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -5, meritType: 'physical', description: '<p>Your flesh is obviously dead and rotting. Social rolls with mortals are nearly impossible. You cannot pass for human under any circumstances without supernatural concealment.</p>' } },
  { name: 'Fourteenth Generation', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Your blood is thin. Blood pool max is 10, can spend only 1 per turn, max trait rating is 5. You may have difficulty creating ghouls or using certain Disciplines.</p>' } },
  { name: 'Glowing Eyes', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'supernatural', description: '<p>Your eyes glow visibly (red, green, or gold) in the dark. This is obviously supernatural and makes stealth and passing as human very difficult at night.</p>' } },
  { name: 'Impatient', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You hate waiting and want everything done immediately. +1 difficulty on extended actions and any roll requiring patience or careful timing.</p>' } },
  { name: 'Incomplete Understanding', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You have a fundamentally flawed understanding of your vampiric nature or your Sect\'s beliefs. This misunderstanding will eventually cause problems.</p>' } },
  { name: 'Infectious Bite', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Your bite causes serious infections in mortals. Wounds you inflict become septic within days unless treated medically. Traces back to you easily.</p>' } },
  { name: 'Infertile Vitae', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -5, meritType: 'supernatural', description: '<p>Your blood cannot create ghouls or blood bonds. You can still Embrace, but the results may be unpredictable.</p>' } },
  { name: 'Lazy', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'mental', description: '<p>You avoid effort. +1 difficulty on any roll requiring sustained concentration or extended effort. You do the minimum possible in any task.</p>' } },
  { name: 'Mute', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'physical', description: '<p>You cannot speak. Communication requires writing, sign language, or supernatural means. Verbal Disciplines (Dominate commands, etc.) cannot be used.</p>' } },
  { name: 'Open Wound', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>You have a wound that constantly weeps blood. Costs 1 extra blood point each night and makes stealth difficult due to the scent trail.</p>' } },
  { name: 'Permanent Fangs', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -3, meritType: 'physical', description: '<p>Your fangs cannot retract. You must hide them at all times or risk Masquerade violations. +2 difficulty on Social rolls when your mouth is visible.</p>' } },
  { name: 'Phobia', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You have an irrational fear of a specific thing or situation. When confronted with it, roll Courage (diff 7+) or flee or freeze. Even on success, you are at +1 difficulty on all actions while the stimulus is present.</p>' } },
  { name: 'Stereotype', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'mental', description: '<p>You buy completely into the stereotypes associated with your Clan or Sect. This narrowmindedness makes you predictable and easy to manipulate.</p>' } },
  { name: 'Thin Blood', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -4, meritType: 'supernatural', description: '<p>Your vitae is weak. Blood bonds you create are fragile (half strength), creating ghouls is unreliable, and your blood pool may be reduced at ST discretion.</p>' } },
  { name: 'Unconvinced', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -1, meritType: 'mental', description: '<p>You are not fully committed to your Sect\'s cause. Your doubts make you unreliable in the eyes of your superiors and easy to turn.</p>' } },
  { name: 'Victim of the Masquerade', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>You believe yourself to be mortal. The Embrace didn\'t fully take in your mind. You suppress your vampiric nature and are confused and terrified by your own powers.</p>' } },
  { name: 'Vulnerability to Silver', type: 'merit', img: 'icons/svg/downgrade.svg', system: { cost: -2, meritType: 'supernatural', description: '<p>Silver burns you as if it were fire, causing aggravated damage on contact. This is unusual for vampires and may suggest a connection to werewolves.</p>' } },
];

const WEAPON_CATEGORIES = [
  // Parent folders
  { name: 'Melee Weapons', parent: null, weapons: [] },
  { name: 'Ranged Weapons', parent: null, weapons: [] },

  // Melee sub-categories
  {
    name: 'Blunt Weapons', parent: 'Melee Weapons',
    description: '<p>Blunt weapons deal bashing damage unless otherwise noted or a called strike to the head is made.</p>',
    weapons: ['Small Club', 'Large Club', 'Staff', 'Steel Bat']
  },
  {
    name: 'Edged Weapons', parent: 'Melee Weapons',
    description: '<p>Edged weapons deal lethal damage unless otherwise noted.</p>',
    weapons: ['Knife', 'Rapier', 'Saber', 'Broadsword', 'Two-Handed Sword', 'Stake',
      'Blessed Macuahuitl', 'Poisoned Machete', 'Oni Tooth Katana']
  },
  {
    name: 'Miscellaneous Weapons', parent: 'Melee Weapons',
    description: '<p>Weapons that don\'t fit neatly into blunt or edged categories.</p>',
    weapons: ['Brass Knuckles', 'Whip', 'Chain',
      'Silvered Brass Knuckles', 'S.A.D. Standard Issue Stun Baton', 'Bladed Whip', 'Golden Gada']
  },
  {
    name: 'Thrown Weapons', parent: 'Melee Weapons',
    description: '<p>Thrown weapons deal lethal damage unless otherwise noted. They use the same Traits as melee weapons.</p>',
    weapons: ['Dart', 'Throwing Knife', 'Spear', 'Cursed Spear']
  },

  // Ranged sub-categories
  {
    name: 'Revolvers', parent: 'Ranged Weapons',
    description: '<p>Revolvers fire from a rotating cylinder containing five or more rounds. Generally bulkier than semi-automatics but mechanically simpler and more reliable. Cannot be silenced. Botches typically result in misfires rather than jams.</p>',
    weapons: [
      'Saturday Night Special',
      'S&W M640 / Colt Agent', 'S&W M686 / Colt Python', 'S&W Model 29 / Colt Anaconda',
      'Ruger Redhawk', 'Freedom Arms Casull', 'Hunters\' .44 Magnum'
    ]
  },
  {
    name: 'Automatic Pistols', parent: 'Ranged Weapons',
    description: '<p>Semi-automatic pistols feed from detachable magazines and use recoil to cycle the next round. More complex than revolvers and slightly more prone to jams. Can be carried with a full magazine plus one in the chamber (+1 to Clip).</p>',
    weapons: [
      'Semi-Auto, Lt', 'Semi-Auto, Hv', 'Silenced Pistol',
      'Hammerli M280 Target', 'Sites M380', 'Walther PPK', 'Beretta Model 92',
      'Calico Model 950', 'Glock 17', 'Glock 20', 'Glock 21', 'Glock 22',
      'Heckler & Koch P7M13', 'Colt M1911A1', 'SIG-Sauer P220 / P230', 'IMI Desert Eagle'
    ]
  },
  {
    name: 'Submachine Guns and Machine Pistols', parent: 'Ranged Weapons',
    description: '<p>Small automatic weapons firing pistol-caliber ammunition at high rates. Bridging the gap between pistols and rifles. Best suited for close-range engagements. Like autoloaders, may hold an extra round in the chamber (+1 to Clip).</p>',
    weapons: [
      'SMG, Small', 'SMG, Large',
      'Beretta Model 93R', 'Ceska Model 61', 'Glock 18',
      'Heckler & Koch MP5', 'Heckler & Koch MP5K', 'Heckler & Koch MP5SD',
      'IMI Uzi', 'IMI Mini-Uzi', 'IMI Micro-Uzi',
      'Ingram M10', 'Intratec TEC-9', 'Thompson M1928'
    ]
  },
  {
    name: 'Rifles', parent: 'Ranged Weapons',
    description: '<p>Non-automatic long guns firing fast, narrow-diameter bullets down a rifled barrel. May be bolt-action, lever-action, or semi-automatic. Like autoloaders, may hold an extra round in the chamber (+1 to Clip).</p>',
    weapons: [
      'Rifle', 'AS50 Sniper Rifle',
      'Remington Model 700', 'Remington M24', 'Remington Model 740',
      'Ruger 10/22', 'Weatherby Mark V', 'Barrett Model 82'
    ]
  },
  {
    name: 'Assault Rifles', parent: 'Ranged Weapons',
    description: '<p>Military-grade automatic rifles. True assault rifles fire small rounds at high cyclic rates; battle rifles use larger, slower ammunition. Full-auto and burst-capable weapons are highly illegal for civilians. Semiautomatic collector versions can be converted by a skilled gunsmith.</p>',
    weapons: [
      'Assault Rifle', 'SCAR',
      'Colt M16', 'Colt M4', 'AK-74', 'Steyr AUG',
      'M14', 'FN FAL', 'Heckler & Koch G3', 'AK-47'
    ]
  },
  {
    name: 'Shotguns', parent: 'Ranged Weapons',
    description: '<p>Large-bore weapons firing slugs or pellet clusters down a smooth barrel. Limited range and capacity but devastating at close range. May be pump-action, lever-action, or semi-automatic. At close range (within 3 yards), add 2 dice to the damage pool.</p>',
    weapons: [
      'Special Affairs Division Riot Shotgun',
      'Double-Barreled Shotgun', 'Benelli M3 Super 90',
      'Remington 870P', 'Ithaca M37', 'Mossberg M500',
      'Franchi SPAS-12', 'Daewoo USAS-12'
    ]
  },
  {
    name: 'Firearm Accessories', parent: 'Ranged Weapons',
    description: '<p>Modifications and add-ons that enhance a firearm\'s accuracy, stealth, or versatility.</p>',
    weapons: ['Telescopic Scopes', 'Night-Vision Scopes', 'Laser Sights', 'Silencers and Suppressors', 'Disguised Weapons']
  },
  {
    name: 'Special Weapons', parent: 'Ranged Weapons',
    description: '<p>Unconventional armaments outside standard firearm categories, from crossbows to flamethrowers.</p>',
    weapons: ['Crossbow', 'Compound Crossbow', 'Boomerang Blade', 'S.A.D. Flamethrower', 'Remington XP-100', 'M134 Mini Gun']
  }
];

const COMPENDIUM_VERSION = 35;

export function registerCompendiumSettings() {
  game.settings.register('vtm-v20', 'compendiumVersion', {
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
  });
}

export async function populateCompendiums() {
  if (!game.user.isGM) return;

  const ver = game.settings.get('vtm-v20', 'compendiumVersion');
  if (ver >= COMPENDIUM_VERSION) return;

  console.log(`VtM V20 | Compendium version ${ver} -> ${COMPENDIUM_VERSION}, refreshing...`);

  const packs = [
    { name: 'disciplines', label: 'Disciplines', data: DISCIPLINES },
    { name: 'backgrounds', label: 'Backgrounds', data: BACKGROUNDS },
    { name: 'weapons', label: 'Weapons', data: WEAPONS, categories: WEAPON_CATEGORIES },
    { name: 'armor', label: 'Armor', data: ARMOR },
    { name: 'merits', label: 'Merits', data: MERITS },
    { name: 'flaws', label: 'Flaws', data: FLAWS },
  ];

  for (const { name, label, data, categories } of packs) {
    const packId = `vtm-v20.${name}`;
    let pack = game.packs.get(packId);
    if (!pack) pack = game.packs.find(p => p.metadata.name === name);
    if (!pack) {
      console.warn(`VtM V20 | Pack "${name}" not found. Available:`, [...game.packs.keys()]);
      continue;
    }

    try {
      await pack.configure({ locked: false });

      // clear old entries
      const idx = await pack.getIndex();
      if (idx.size > 0) {
        const ids = idx.contents.map(e => e._id);
        await Item.deleteDocuments(ids, { pack: pack.collection });
        console.log(`VtM V20 | Cleared ${ids.length} old ${label}`);
      }

      // clear old folders
      if (pack.folders.size > 0) {
        const folderIds = pack.folders.contents.map(f => f.id);
        await Folder.deleteDocuments(folderIds, { pack: pack.collection });
      }

      // create category folders and map items into them
      let itemData = data;
      if (categories) {
        const foldersByName = {};

        // first pass: parent folders (no parent field or parent: null)
        const parents = categories.filter(c => !c.parent);
        if (parents.length) {
          const parentData = parents.map((cat, i) => ({
            name: cat.name, type: 'Item',
            sort: (i + 1) * 100000,
            description: cat.description || '',
          }));
          const created = await Folder.createDocuments(parentData, { pack: pack.collection });
          for (const f of created) foldersByName[f.name] = f.id;
        }

        // second pass: child folders nested under their parent
        const children = categories.filter(c => c.parent);
        if (children.length) {
          const childData = children.map((cat, i) => ({
            name: cat.name, type: 'Item',
            sort: (i + 1) * 100000,
            folder: foldersByName[cat.parent] || null,
            description: cat.description || '',
          }));
          const created = await Folder.createDocuments(childData, { pack: pack.collection });
          for (const f of created) foldersByName[f.name] = f.id;
        }

        const nameToFolder = {};
        for (const cat of categories) {
          for (const wpn of cat.weapons) {
            nameToFolder[wpn] = foldersByName[cat.name];
          }
        }
        itemData = data.map(item => {
          const fid = nameToFolder[item.name];
          return fid ? { ...item, folder: fid } : item;
        });
        console.log(`VtM V20 | Created ${Object.keys(foldersByName).length} folders in ${label}`);
      }

      const docs = await Item.createDocuments(itemData, { pack: pack.collection });
      await pack.configure({ locked: true });
      ui.notifications.info(`VtM V20: Loaded ${docs.length} ${label}.`);
      console.log(`VtM V20 | Populated ${label} (${docs.length} items)`);
    } catch (err) {
      console.error(`VtM V20 | Failed to populate ${name}:`, err);
      ui.notifications.error(`VtM V20: Failed to load ${label}. Check console.`);
    }
  }

  await game.settings.set('vtm-v20', 'compendiumVersion', COMPENDIUM_VERSION);
}
