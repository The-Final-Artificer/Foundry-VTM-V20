export const RITUALS = [
  // ── Level One Necromantic Rituals ──
  {
    name: 'Call of the Hungry Dead', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>Ten minutes of casting, a hair from the victim's head, and a black candle to burn it in: that is all it takes to tear open the target's hearing to the far side of the Shroud. The unprepared get no gentle introduction, just a flood of howls, pleas, and inhuman demands with nothing intelligible in it, and more than one victim has been driven briefly mad by the roar.</p>` }
  },
  {
    name: 'Eldritch Beacon', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>Fifteen minutes of casting over a green candle, whose drippings are gathered and rolled into a small wax sphere. Whoever carries the sphere, knowingly or not, burns in the Shadowlands like a sickly green-white flare, and every ghostly power lands on them harder and more easily. The beacon burns for one hour per success on the casting roll.</p>` }
  },
  {
    name: 'Insight', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>The necromancer stares into a corpse's eyes for five minutes and watches the dead man's last moments replay there, visible to no one else. Successes set the clarity: one gives a rough sense of the death, two a clear image of its final seconds, three adds sound and the preceding minutes, four the last half hour, five full sensory playback of the final hour. A botch instead shows the caster his own Final Death, which can force a Rötschreck roll. The ritual fails on corpses missing both eyes, too far decomposed, or belonging to vampires who found Golconda.</p>` }
  },
  {
    name: 'Knowing Stone', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>The necromancer bleeds herself and paints the target's name in vitae on a consecrated stone, marking that spirit for as long as the stone endures. From then on she can learn the target's whereabouts, living or dead, by dancing herself into a trance around the stone until a spirit leans close and whispers the answer. The enchantment expires on All Saints Day unless renewed with a blood point.</p>` }
  },
  {
    name: 'Minestra di Morte', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>A grisly kitchen rite: a piece of a corpse simmered in half a liter of Kindred vitae with rosemary for remembrance, basil for the grave, and salt for clarity, brought to a boil and eaten. Success reveals whether the person the flesh came from became a wraith, a Spectre, or nothing at all, and only that person. The blood is consumed by the magic: another vampire's vitae neither bonds nor nourishes, and the caster's own is simply lost. Vampires who cannot stomach food fail to keep the soup down but still get their answer.</p>` }
  },
  {
    name: 'Ritual of the Smoking Mirror', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 1, ritualType: 'necromantic', description: `<p>An obsidian mirror, edge-sharpened so that gripping it draws blood, becomes a window onto the world as the dead see it. The caster chooses one aspect per casting: Lifesight reads auras as the Auspex power Aura Perception does, while Deathsight shows ghosts, the Shadowlands, and the stain of oblivion on the living as per Eyes of the Dead. At Storyteller discretion the mirror can also reveal the flaws in an object strongly tied to life or death, a murder weapon or a healer's window box. The sight lasts one scene; a botch tends to offend the spirits consulted.</p>` }
  },

  // ── Level Two Necromantic Rituals ──
  {
    name: 'Eyes of the Grave', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>Two hours of casting and a pinch of fresh grave soil condemn the target to a week of sudden, unannounced visions of her own death, each lasting up to a minute. Only the victim sees them; the caster never learns what they show. Every vision forces a Courage roll, difficulty 7, with failure leaving her a shaking wreck, and the timing is never convenient: they arrive mid-drive, mid-shot, mid-sentence.</p>` }
  },
  {
    name: 'The Hand of Glory', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>The old burglar's talisman, made properly: a condemned murderer's severed hand, wrung dry in a shroud, cured a fortnight in salt, saltpeter, and long peppers, then oven-dried with vervain and fern. Any success on the roll makes it viable, and it works forever. In use, the fingertips are coated in fat rendered from a hanged man and lit, and the old formula spoken over them: the sleeping stay asleep, the waking stay awake. Every affected mortal in the house drops into unrousable sleep for a scene; one finger refuses to light for each occupant the hand cannot claim, and supernatural beings are beyond it entirely. Only its maker can snuff it at will; anyone else needs milk, and nothing but milk.</p>` }
  },
  {
    name: 'Occhio d\'Uomo Morto', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>Under a new moon, with incense and midnight chanting, the necromancer prepares an eye taken from a corpse whose soul lingered on, then plucks out one of her own and seats the dead eye in the socket, letting Kindred healing seal it in. The reward is permanent, roll-free Shroudsight, and if the donor became a Spectre, a muffled ear on Spectre-chatter nearby: a Perception + Occult roll gleans vague impressions, and a botch may lodge a derangement as the whispers seep in. The costs are real: one dot of Appearance unless the eye stays hidden, +1 difficulty on mundane visual Perception, and the furious donor ghost can find its eye anywhere and works its powers on the thief at -1 difficulty. In exchange, eye-contact Disciplines used against the necromancer suffer +1 difficulty, since they meet a stranger's soul halfway.</p>` }
  },
  {
    name: 'Puppet', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>Over an hour the necromancer works grave soil across the subject's eyes, lips, and brow, opening the body as a vessel. For the rest of the night any wraith attempting possession of the subject gains two automatic successes. Washing the soil off changes nothing. Useful for interviewing the recently dead through borrowed lips; equally serviceable as psychological torture.</p>` }
  },
  {
    name: 'The Ritual of Pochtli', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>Never cast alone and never cast for itself, this rite welds several necromancers into one working. The participants restrain a mortal vessel, carve blasphemous symbols into the flesh, and each drinks only from the cut he made. The Necromantic ritual or path use that follows draws on all of them: the group rolls together and pools its successes, provided every participant knows both this ritual and the working being attempted. The price of shared power is shared failure, since a single botch among them annihilates the whole pool and turns the working horribly wrong.</p>` }
  },
  {
    name: 'Two Centimes', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 2, ritualType: 'necromantic', description: `<p>The necromancer lays a mortal out as if for burial, coins on the eyes, and ceremonially kills him: the soul drops into the Underworld while the body waits. The soul walks as a ghost among ghosts, able to see, travel, and speak with the dead, and able to report everything back to the waiting vampire, but utterly unable to touch or change anything on either side. Servants volunteer for it as scouts. Victims do not volunteer, which is rather the point.</p>` }
  },

  // ── Level Three Necromantic Rituals ──
  {
    name: 'Blood Dance', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>Two hours of dance and chant, colored sands and ocean salt poured into a precise sigil on the ground, all to open one hour of conversation between a ghost and a living relative. The called spirit appears within the sand pattern; every other ghost is entreated to keep its distance. Necromancers hire this rite out for money and favors more often than they cast it for themselves. Failure simply means no one answered.</p>` }
  },
  {
    name: 'Divine Sign', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>Given a subject's birth date, the necromancer reads the shape of their nature closely enough to anticipate them: on a living target, the ritual predicts the person's next course of action in time to prepare for it. Worked on a ghost, the intimacy runs deeper, binding the caster's understanding to the wraith so thoroughly that it counts as holding one of the ghost's fetters for every necromantic purpose.</p>` }
  },
  {
    name: 'Din of the Damned', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>Half an hour spent laying an unbroken line of crematorium ash along a room's walls (doorways may be crossed) turns the room's privacy over to the dead. For the rest of the night, every eavesdropping attempt, a glass on the wall, a laser microphone, Heightened Senses, must beat the caster's casting successes on Perception + Occult at difficulty 7. Those who fall short hear only wailing, moaning, and the winds of the Underworld; a botch leaves the listener deaf until sunrise.</p>` }
  },
  {
    name: 'Nightmare Drums', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>The necromancer coats a personal possession of the victim in his own blood and burns it, sending its ghostly image across the Shroud as both a wanted poster and a first payment. While it burns, he and any assistants hammer out a rhythm on great drums of human skin, silent here, deafening in the lands of the dead. The ghosts come to negotiate mostly to stop the noise, and agree to haunt the victim's dreams for as long as demanded in exchange for a favor: a message carried to kin, or revenge on someone who wronged them. The caster chooses the target and can end the haunting, but the nightmares themselves belong entirely to the ghosts.</p>` }
  },
  {
    name: 'Ritual of the Unearthed Fetter', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>Three hours of casting attune a finger bone from the target ghost's skeleton, using the ghost's name and a chip of gravestone that crumbles to dust over the bone as the rite concludes. The bone then points, compass-like, toward something the wraith cannot let go of, and most necromancers hang it from a thread and follow it. Holding that fetter makes every Necromantic working against the ghost dramatically easier, as the Sepulchre Path describes.</p>` }
  },
  {
    name: 'Tempesta Scudo', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 3, ritualType: 'necromantic', description: `<p>One of the few battlefield rituals: a turn of graceless, stamping dance ending with the necromancer biting through her own lip and spitting blood in a circle around herself. The dance requires Dexterity + Performance at difficulty 7 in combat (6 outside it); the bite costs a level of bashing damage and the spit a blood point, and then the normal ritual roll decides the working. Within the circle, every action a ghost attempts is at +2 difficulty.</p>` }
  },

  // ── Level Four Necromantic Rituals ──
  {
    name: 'Baleful Doll', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 4, ritualType: 'necromantic', description: `<p>Four or five hours of chanting handcraft, a coat of the necromancer's blood, and an unwashed piece of the victim's clothing produce a doll wedded to the victim's spirit; a Stamina + Crafts roll at difficulty 8 governs the work, and a doll that fails to resemble its subject is only good for selling to tourists. A finished doll is a dreadful lever: injuring it, pins being traditional, inflicts six dice of bashing damage on the victim, and destroying it outright inflicts six dice of lethal.</p>` }
  },
  {
    name: 'Bastone Diabolico', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 4, ritualType: 'necromantic', description: `<p>A leg bone taken from a living donor who must survive the taking, dipped in molten lead, inscribed with runes, and then used to beat that same donor to death while the caster drones a Greek chant. The result is a devil stick that anyone can wake with a point of Willpower for a scene: each blow strips a struck ghost of a point of its Passion pool, and against walking corpses (never vampires) it adds a die of damage and deals aggravated harm. Ghosts recognize the thing on sight without knowing why, and their avoidance imposes +1 difficulty on the bearer's rolls to summon or attract them.</p>` }
  },
  {
    name: 'Cadaver\'s Touch', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 4, ritualType: 'necromantic', description: `<p>Three hours of chanting while a wax doll in the victim's shape melts away leave a mortal wearing death without dying: cold clammy skin, a thread of a pulse, chalk-pale flesh, a fair imitation of the walking dead. Social rolls suffer +2 difficulty for the duration. The curse holds as long as the wax stays molten, ends if it is allowed to cool and set, and breaks permanently if the wax boils away.</p>` }
  },
  {
    name: 'Peek Past the Shroud', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 4, ritualType: 'necromantic', description: `<p>An hour's enchantment over a handful of ergot strips the mold of its poison and turns it into a key: a pinch eaten grants Shroudsight for a number of hours equal to the caster's Stamina. Each success on the roll yields three doses. A botch reverses the cleansing catastrophically, rendering the whole batch instantly lethal, eight dice of lethal damage to anyone who swallows it, vampires included.</p>` }
  },
  {
    name: 'Ritual of Xipe Totec', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 4, ritualType: 'necromantic', description: `<p>An obsidian dagger, a living victim, and a steady hand: the skin is taken whole, the victim's blood drained into a golden bowl and mixed with octli and amaranth, and the draught makes the necromancer sweat a sheen of blood (one point) that lets the flayed skin knit over his own as a second face. The victim must survive the flaying, though rarely for long, and must be of similar build or the fit betrays itself. To the eye the disguise is perfect; it grants none of the victim's manner or memories, so it serves best where friends and family are scarce. The skin drinks a blood point nightly to stay fresh, and removing it, which must be done with the same dagger and costs a level of unsoakable lethal damage, ruins it. Supernatural creatures cannot be worn, though ghouls can.</p>` }
  },

  // ── Level Five Necromantic Rituals ──
  {
    name: 'Chill of Oblivion', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 5, ritualType: 'necromantic', description: `<p>Twelve hours, less one per success, spent naked on bare earth while a half-meter block of ice melts on the subject's chest (three bashing levels for mortals) fill the subject with the grave's own cold for one night per dot of the caster's Occult. Fire and heat deal lethal damage instead of aggravated, and the subject can smother flames outright: each success on a Willpower roll at difficulty 9 lowers a fire's soak difficulty by 1, and a fire brought to 2 collapses into embers. The bill: an aura veined in writhing black that looks damningly like diablerie, a palpable arm's-length cold that mirrors the Flaws Touch of Frost and Eerie Presence, and the steady attention of hostile ghosts drawn to the nimbus.</p>` }
  },
  {
    name: 'Dead Man\'s Hand', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 5, ritualType: 'necromantic', description: `<p>A rag carrying the victim's blood, sweat, or tears is closed inside a freshly severed human hand, and as the hand rots, so does the victim, bloating, graying, sloughing, while the mind stays clear enough to watch. The caster pays two blood points per point of the victim's Stamina and Fortitude. Health levels fall on a fixed clock: twelve hours each at Bruised and Hurt, six at Injured, three at Wounded, one at Mauled, thirty minutes at Crippled, then twelve hours Incapacitated, at the end of which mortals die and Kindred sink into torpor. Only opening the hand and removing the rag stops it, whereupon health returns up the same ladder.</p>` }
  },
  {
    name: 'Esilio', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 5, ritualType: 'necromantic', description: `<p>Five spoken syllables in a tongue no one can place, said by some to predate Babel and to be the very words of Caine's exile. Cast successfully, they tear a hole in the caster's own chest that opens onto the deepest Underworld, invisible to ordinary eyes and a black vortex to Witness of Death or Shroudsight. Any ghost clutched to the necromancer's chest, a Clinch or Tackle, is shredded into the pit: one spirit per success, then the vortex closes, or at scene's end regardless. Destroyed ghosts stay gone at least a month and return, if ever, as Spectres more often than not. The toll is brutal: one blood and one Willpower to speak the Words, a level of unsoakable lethal damage per success rolled, and a permanent point of Humanity each casting, with other Paths at the Storyteller's mercy.</p>` }
  },
  {
    name: 'Grasp the Ghostly', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Necromancy.png',
    system: { level: 5, ritualType: 'necromantic', description: `<p>Six unbroken hours of chanting haul a single object out of the Underworld and into solid reality, assuming its ghostly owner does not object successfully, and they usually object. The prize must be balanced by trading back a material object of roughly equal mass or it snaps home across the Shroud. Only relics, items recently destroyed in the living world, can be reclaimed at all; wraith-made artifacts unravel at the first touch of the living world, and even a stolen relic fades away after about a year.</p>` }
  },

  // ══════════════════════════════════
  // Thaumaturgical Rituals
  // ══════════════════════════════════

  // ── Level One Thaumaturgical Rituals ──
  {
    name: 'Bind the Accusing Tongue', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Reputedly among the first rituals the Tremere ever perfected, and a quiet explanation for how little organized resistance they faced. An image of the target, a lock of the target's hair, and a black silk cord wound around both while the incantation is spoken: from then on the victim cannot speak ill of the caster unless he beats the caster's successes on a Willpower roll at a difficulty of the caster's Thaumaturgy + 3. The gag holds until that roll is won or the cord is unwound, at which point hair and image crumble to dust.</p>` }
  },
  {
    name: 'Blood Rush', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>A single turn's working that counterfeits the ecstasy of feeding without a drop taken. Cast to indulge, occasionally; cast far more often to keep the Beast quiet when fresh blood is about to be in the room. The vampire must carry a predator's fang for it to work, and for up to an hour hunger-driven frenzy simply does not reach him, after which his appetite returns as it was.</p>` }
  },
  {
    name: 'Communicate with Kindred Sire', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Holding an object her sire once owned, the caster meditates for half an hour and opens a mind-to-mind conversation with him across any distance. The link carries words in both directions for ten minutes per success, or until either party chooses to hang up.</p>` }
  },
  {
    name: 'Defense of the Sacred Haven', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>An hour of incantation and blood-drawn sigils on every window and door seals a haven against the sun: within six meters of the casting, dawn simply fails to enter, glancing off the glass and dying at the thresholds. It costs one blood point, and the darkness holds for as long as the thaumaturge remains inside the warded radius.</p>` }
  },
  {
    name: 'Deflection of Wooden Doom', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>An hour spent seated inside an unbroken circle of wood, scrap, sawdust, furniture, timber, all of it serves, ending with a splinter placed beneath the caster's tongue. Until the next dawn or dusk, the first stake driven at her heart crumbles to dust in the attacker's grip. Only an actual attempt triggers it; a stake merely carried nearby is safe, and spitting out the splinter ends the protection early.</p>` }
  },
  {
    name: 'Devil\'s Touch', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>A curse for mortals who have earned a thaumaturge's spite: a penny hidden somewhere on the victim's person while the ritual is spoken over him. Until sunrise the world finds him repulsive without knowing why, strangers sneering, children jeering, beggars spitting, every hand and door turned against him. Vampires are immune; the penny is the point.</p>` }
  },
  {
    name: 'Domino of Life', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>With a vial of fresh human blood on his person, the vampire buys back one piece of mortality for a night: breath, a heartbeat's warmth, appetite, living color, any single trait he chooses. It adds a die to his pools for passing as human, and unless someone has real cause for suspicion, the one convincing detail is usually all the audience needs.</p>` }
  },
  {
    name: 'Engaging the Vessel of Transference', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>A container between cup and jug size is sealed brim-full of blood and marked with a Hermetic sigil over a three-hour casting, less 15 minutes per success. Ever after, bare skin against the vessel quietly swaps its contents for an equal measure of the toucher's blood, with nothing felt but a faint chill; even thin gloves defeat it. The vessel keeps trading until opened. Its two classic uses are bottling a stranger's vitae for the laboratory, and building a blood bond in a victim who believes he has merely carried a jar. Scholars with Occult 4 or better may recognize the sigil on an Intelligence + Occult roll at difficulty 8 with two successes.</p>` }
  },
  {
    name: 'Illuminate the Trail of Prey', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Burning a length of white satin ribbon carried for a full day sets the quarry's trail alight, visibly only to the caster: footsteps, tire tracks, even flight paths glow with an unhealthy shine, blazing where the passage is fresh and guttering where it is old. The caster needs the target's name or face in mind. The light dies if the quarry wades into water or reaches the end of his journey.</p>` }
  },
  {
    name: 'Incantation of the Shepherd', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Spinning slowly with a piece of glass held to each eye while chanting, the vampire takes a headcount. When the ritual ends he knows the direction and distance of every member of his Herd, or, lacking that Background, of the three nearest mortals he has fed from at least three times. The reach is 15 kilometers per dot of Herd, or about eight with none.</p>` }
  },
  {
    name: 'Purity of Flesh', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Seated on bare earth inside a ring of 13 sharp stones, the caster spends a blood point and meditates while everything foreign works its way out of her body: dirt, drugs, toxins, lodged bullets, tattoo ink, all of it rising through the skin and flaking off as gray grit inside the circle, along with her clothes, makeup, and jewelry. The rite scours matter only; enchantments, mind control, and blood-borne disease remain untouched.</p>` }
  },
  {
    name: 'Wake with Evening\'s Freshness', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Feathers are burned and their ashes scattered over the day's resting place immediately before sleep; any interruption to the casting spoils it. Should danger approach while the sun rules, the caster snaps awake at once, and for the first two turns of consciousness ignores the usual daytime dice-pool cap from Humanity or Path, time enough to meet the problem on his feet before the lethargy settles in.</p>` }
  },
  {
    name: 'Widow\'s Spite', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 1, ritualType: 'thaumaturgical', description: `<p>Petty malice given form: a crude wax or cloth doll of the victim, which bleeds when the ritual bites. The target suffers a sharp pain, maddening itch, or similar misery exactly where the caster chooses, real enough to ruin an evening and harmless enough to prove nothing. No mechanical effect beyond the sensation; that has never been the point.</p>` }
  },

  // ── Level Two Thaumaturgical Rituals ──
  {
    name: 'Blood Walk', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>Cast over a single point of another vampire's blood across three hours, less 15 minutes per success, this ritual reads the vitae like a family register. Each success climbs one Generation up the subject's lineage, to the Fourth at best since the Third keep their own counsel, yielding true names and faces, along with the subject's Generation and Clan or bloodline. Three or more successes also expose every blood bond the subject is party to, on either end of the leash.</p>` }
  },
  {
    name: 'Burning Blade', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>Born in the Clan's desperate early wars, this ritual wraps a melee weapon in flickering green flame that bites the supernatural where it cannot heal. The caster cuts her weapon hand during the rite, an unsoakable but normally healable level of lethal damage, and feeds the weapon three blood points. The next several successful strikes, one per success rolled, inflict aggravated damage on supernatural targets; the charges spend themselves whether wanted or not, each hit using one until the blade burns out. Castings cannot be stacked.</p>` }
  },
  {
    name: 'Donning the Mask of Shadows', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>The subject fades to a dark, smoky translucence, footfalls muffled, edges uncertain: not invisibility, but close enough for most rooms. It can cover up to Occult-rating subjects at once, each beyond the first adding five minutes to the casting. Only senses sharp enough to pierce Obfuscate 3, Auspex among them, find the masked. The veil lasts one hour per success or until the caster chooses to drop it.</p>` }
  },
  {
    name: 'Eyes of the Night Hawk', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>Touching a bird of prey, the vampire pours her senses into it, seeing through its eyes and hearing through its ears while steering its flight by thought alone. Flight is all it will give: no fetching, no fighting, no scratching on command, and it returns to her hand when done, at sunrise at the latest. The rite ends with a debt: the bird's eyes must be put out, or the darkness owed falls on the caster instead, three nights of total blindness.</p>` }
  },
  {
    name: 'Machine Blitz', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>With a scrap of rusted metal in her pocket, or, in an older variant, a spit-soaked knot to untie, the thaumaturge simply wills machinery to die. Engines stall, drives wipe, phone batteries drain flat, life support goes quiet: anything more intricate than rope and pulley stops while she concentrates. The failure looks entirely coincidental, and the ritual grants no control whatsoever, only the stopping.</p>` }
  },
  {
    name: 'Principal Focus of Vitae Infusion', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>An object no larger than two cupped hands, a coin will do, is imbued with a single point of blood, turning faintly red and slick to the touch. At a thought from the caster it dissolves back into usable vitae, which makes such trinkets the thaumaturge's emergency ration of choice. A focus can be made for an ally who attends the casting, but only with the caster's own blood, with everything drinking it implies for the bond.</p>` }
  },
  {
    name: 'Recure of the Homeland', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>Earth from the soil of the caster's mortal birthplace, kneaded with two points of her own blood while she recites her mortal family line, becomes a paste that closes wounds nothing else will: one handful heals one aggravated wound, one handful per night. The magic is wholly personal and works for no one but the thaumaturge who knows it.</p>` }
  },
  {
    name: 'Ward versus Ghouls', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>A point of blood poured over an object, ten minutes of incantation, and ten hours of setting produce a glyph that ghouls regret touching: three dice of lethal damage, repeated on every further contact, and a ghoul who means to grip the warded thing anyway must first spend a point of Willpower. The ward inhabits one object, and one object means one part: scribed on a car door, it guards the door, not the car. Weapons take wards well, even ammunition, though a warded bullet survives firing only on a five-success Firearms roll.</p>` }
  },
  {
    name: 'Warding Circle versus Ghouls', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 2, ritualType: 'thaumaturgical', description: `<p>The area version of the ward: three points of mortal blood and the usual casting raise a circle around the caster, three meters of radius by default, that ghouls cross only at cost. Every three-meter extension adds one to the difficulty (capped at 9, extra successes required beyond that) and one more blood point. The standard casting time yields a circle lasting the night; a full night's casting makes it last a year and a day. A ghoul at the boundary feels a tingle and a faint breeze, recognizable as a ward with Intelligence + Occult at difficulty 8, and pressing on demands beating the caster's successes on Willpower at difficulty of Thaumaturgy + 3: failure means the circle throws him back with three dice of bashing damage and +1 difficulty on his next attempt. Leaving is never blocked. The Clan maintains sibling circles at higher levels, against Lupines, against Kindred, and against Spirits, Ghosts, and Demons, each learned separately, each using the matching ward's components in larger quantity.</p>` }
  },

  // ── Level Three Thaumaturgical Rituals ──
  {
    name: 'Clinging of the Insect', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>A live spider under the tongue lets the caster take to walls and ceilings like the spider itself, provided the surface bears her weight, at half her normal speed. Mortal witnesses tend to remember the sight longer than they would like. The power holds for a scene, or until she spits the spider out; the spider's survival is optional.</p>` }
  },
  {
    name: 'Flesh of Fiery Touch', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>The subject swallows a glowing ember at the climax of a two-hour casting, less ten minutes per success, taking one aggravated level (soakable with Fortitude, difficulty 6). Until the next sunset, any hand laid deliberately on the subject's skin is seared for one aggravated level under the same soak; accidental brushes and being touched through clothing cost nothing. The ritual also gilds the subject with an artificial sun-bronzed tone, metallic at close inspection (Perception + Medicine, difficulty 8), which certain vain practitioners consider the entire point.</p>` }
  },
  {
    name: 'Incorporeal Passage', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>Carrying a shard of a shattered mirror that holds her image, the caster steps out of substance entirely: walls, doors, and manacles cease to apply, and physical attacks pass through her uselessly. The one law is forward motion: her path through solid matter must be straight and without retreat, which rules out strolling down through the earth. The state lasts one hour per success on a Wits + Survival roll at difficulty 6, and ends early if she turns the shard away so it no longer reflects her.</p>` }
  },
  {
    name: 'Mirror of Second Sight', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>An ordinary oval mirror, no smaller than a hand and no longer than a forearm, bathed in a point of the caster's blood under incantation, thereafter refuses to be lied to: werewolves show their war-forms in it, magi burn with strange light, faeries drop their seemings, ghosts drift visibly through its depths, and the truly faithful sometimes appear wrapped in gold.</p>` }
  },
  {
    name: 'Pavis of Foul Presence', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>The Warlocks privately call this their ritual for the Ventrue. A blue silk cord worn at the caster's throat turns the Presence Discipline back on its user: the awe, the terror, the summons, each lands on the vampire who sent it, so the Toreador who tries to terrify the caster frightens only herself. Only powers that target the caster directly and require a roll can rebound; room-filling effects like Majesty pass unhindered. The pavis absorbs one effect per success rolled, expiring at sunrise, and the Tremere insist, correctly so far, that no one outside the Clan knows the trick.</p>` }
  },
  {
    name: 'Sanguine Assistant', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>The thaumaturge opens his arm over a prepared earthen bowl, spends five blood points, and lets the ritual scavenge his workshop: beakers, pencils, scrap and semiprecious stones swirl together into a knee-high homunculus, animated by blood and oddly considerate about never absorbing anything its maker will turn out to need. It serves one night per success, then climbs into its bowl and falls apart, though a fond master can call the same servant back, memories intact, with a fresh casting. The assistant has Strength and Stamina 1, its creator's Dexterity and Mental Attributes, Social Attributes that grow into its master's over its first nights, and all his Abilities at one dot less; it knows his entire Thaumaturgical repertoire well enough to teach it. Timid by nature, it flees violence except in defense of its maker's existence, and no mind-affecting power can pry it from his will.</p>` }
  },
  {
    name: 'Shaft of Belated Quiescence', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>A stake of rowan, coated in three points of the caster's blood and blackened over oak flame across a five-hour rite (less half an hour per success), acquires patience. Struck into a vampire with an ordinary Dexterity + Melee attack (difficulty 6, Strength + 1 lethal, no called shot needed), the tip snaps off if even one level of damage lands, and begins to travel. The Storyteller then rolls the caster's Thaumaturgy (difficulty 9) hourly, adding successes to the attack's; a botch means bone deflects it and empties the count. At 15 accumulated successes it finds the heart: paralysis for Kindred, death for mortals and ghouls. Surgery is an hourly extended Dexterity + Medicine roll (difficulty 7 on Kindred, 8 on mortals) needing successes equal to the shaft's, but the fragment squirms from probes, rolling every half hour once hunted, and any surgery roll under three successes costs the patient an unsoakable level of lethal damage. Spears, arrows, and pool cues of rowan take the enchantment; bullets never do. Hearts removed by Serpentis have nothing for it to find.</p>` }
  },
  {
    name: 'Ward versus Lupines', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 3, ritualType: 'thaumaturgical', description: `<p>The ghoul ward's teeth, reset for werewolves: identical casting, identical effects, with a handful of silver dust standing in for the blood point.</p>` }
  },

  // ── Level Four Thaumaturgical Rituals ──
  {
    name: 'Bone of Lies', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 4, ritualType: 'thaumaturgical', description: `<p>A mortal bone at least two centuries old, fed 10 blood points on the night of casting, becomes an incorruptible witness: whoever holds it and tries to lie tells the truth instead. Each thwarted lie burns one of the stored points and darkens the bone until, fully ebony, it is spent. The magic works by binding the bone's original owner, whose spirit swallows every stifled lie and grows fouler for it; summoned later, that spirit wears all the sins it absorbed on top of its fury at the servitude. Prudent casters use anonymous bones and bury them afterward, and no bone serves twice, though a skeleton has plenty to spare.</p>` }
  },
  {
    name: 'Firewalker', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 4, ritualType: 'thaumaturgical', description: `<p>The caster severs a fingertip and burns it in a Thaumaturgical circle, buying an hour in which flame loses most of its terror: the subject soaks fire with Stamina, or Stamina + Fortitude if he has it. The amputation costs no health levels but hurts enough to demand a Willpower roll, and casting it on other vampires spends the caster's fingertips, not theirs. Sabbat packs use it for bravado; quieter practitioners save it for the nights when the fire is coming regardless.</p>` }
  },
  {
    name: 'Heart of Stone', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 4, ritualType: 'thaumaturgical', description: `<p>Nine hours, less one per success, lying naked on stone while a bare candle burns to nothing over the heart, one aggravated level, soak difficulty 5, and the heart itself turns to rock. Stakes become nearly meaningless: twice the caster's Thaumaturgy rating in extra soak dice against any attack on the heart, and total immunity to the Shaft of Belated Quiescence. But sympathy is a law of magic, and a stone heart feels like stone: Conscience or Conviction and Empathy fall to 1 (to 0 if already there), every Social pool except Intimidation is halved, Discipline rolls included, Presence and its cousins struggle against him at +3 difficulty, and every Merit of warmth and fellowship simply stops working. Self-cast only, and it lasts exactly as long as its owner wants it to.</p>` }
  },
  {
    name: 'Splinter Servant', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 4, ritualType: 'thaumaturgical', description: `<p>A darker cousin of the Belated Shaft, and incompatible with it: a stake cut from a tree fed on the dead, bound in nightshade twine under wax seal, over a 12-hour casting less one per success. Tearing the binding wakes it, and its holder has that same turn to aim it and command the attack, or become the nearest available target. The freed stake splits into a scuttling half-human shape that exists only to reach a heart: attack pool of the caster's Wits + Occult, damage of the caster's Thaumaturgy, 30 meters of movement or leap per turn, never dodging, never splitting its actions, striking at difficulty 9 under the normal staking rules. It has three health levels and is hit only at +3 difficulty, small and fast as it is. It lives five combat turns per casting success, then collapses into ordinary splinters; pulled out of a pierced heart carelessly, it leaves fragments behind unless the puller manages three successes on Dexterity at difficulty 8.</p>` }
  },
  {
    name: 'Ward versus Kindred', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 4, ritualType: 'thaumaturgical', description: `<p>The same warding as against ghouls and Lupines, aimed at the caster's own kind: identical mechanics, fueled by a point of the caster's own blood, and politely declining to harm the caster herself.</p>` }
  },

  // ── Level Five Thaumaturgical Rituals ──
  {
    name: 'Blood Contract', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 5, ritualType: 'thaumaturgical', description: `<p>An agreement written in the caster's blood, signed in the signatories' own, and sealed over three nights of casting, after which the terms enforce themselves. The Storyteller holds the pen on what enforcement means; there are credible accounts of demons arriving to collect. Creation consumes one blood point, each signature another, and the only exits are performance of the terms or burning the document, which cannot be forbidden by its own clauses: contracts drafted with fireproofing provisions combust on completion, apparently on principle.</p>` }
  },
  {
    name: 'Enchant Talisman', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 5, ritualType: 'thaumaturgical', description: `<p>The first ritual most Tremere learn after mastering their primary path: a full lunar month, new moon to new moon, six hours a night, carving a rigid object about a meter long, sword, staff, violin, shotgun, with runes of the caster's true name and everything she knows of the Art. One blood point per night, and an extended Intelligence + Occult roll (difficulty 8, one roll per week) needing 20 net successes; a missed night or a failed total ruins the work entirely. The finished talisman raises the difficulty of all magic targeting its holder by one, lends two dice to her primary path and one to her ritual castings, adds a die to strike with when swung, and can be found from afar with Perception + Occult at difficulty 7. The danger is symmetrical: in enemy hands it lends three dice to any magic worked against its owner, and rituals using it as a component may cut far deeper. One talisman per thaumaturge, ever untransferable; each must carve her own.</p>` }
  },
  {
    name: 'Escape to a True Friend', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 5, ritualType: 'thaumaturgical', description: `<p>A meter-wide circle charred into bare ground over six nights of six-hour castings, less one night per two successes, each night watered with three of the caster's own blood points. Ever after, stepping into the circle and speaking the true name of the person whose friendship she trusts most carries her instantly to them, arriving discreetly out of sight and a few minutes' walk away. She may bring one companion, or cargo up to her own weight, and the circle serves indefinitely so long as it remains unmarred.</p>` }
  },
  {
    name: 'Paper Flesh', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 5, ritualType: 'thaumaturgical', description: `<p>The victim's true name, easier written for the young than for elders who have buried theirs, is inscribed on paper; the caster cuts himself with the sheet and burns it. For one night the subject dries out like old parchment: Stamina and Fortitude collapse to 1 apiece, with one extra point retained (Fortitude first, never exceeding the original scores) for every Generation below Eighth. Used on the physically formidable, it turns fortress bodies into kindling.</p>` }
  },
  {
    name: 'Ward versus Spirits', type: 'ritual', img: 'systems/vtm-v20/VTM icons/Thaumaturgy.png',
    system: { level: 5, ritualType: 'thaumaturgical', description: `<p>The warding formula turned on the bodiless: mechanically the ghoul ward in every respect, keyed with a handful of pure sea salt, and biting spirits on both the physical and spiritual planes, including anything summoned or embodied by paths like Elemental Mastery. Two sibling rituals of the same level round out the set: Ward versus Ghosts, keyed with powdered tombstone marble, and Ward versus Demons, keyed with a vial of holy water.</p>` }
  },
];
