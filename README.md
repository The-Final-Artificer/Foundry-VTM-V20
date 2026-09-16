# Vampire: The Masquerade V20 for Foundry VTT

A deeply automated Foundry VTT system for Vampire: The Masquerade 20th Anniversary Edition. Built for tables that want the full V20 combat and blood economy handled by the sheet, not the calculator.

This system is completely free, but if you would like to support me and get cool stuff in the process please head over to my Patreon: https://www.patreon.com/c/TheFinalArtificer

## Highlights

### Character Sheets
- Full sheets for Vampires and Mortals: attributes, abilities, virtues, backgrounds, and advantages with dot tracking
- Specialties on high-rated traits, with hover descriptions right on the sheet
- Nature and Demeanor archetype summaries on hover
- Hunger indicator when the blood runs low
- Paged bio editor with rich text formatting
- Export any character sheet to a standalone HTML file for offline use
- Character generation wizard, including Path characters with Conviction and Instinct

### Combat, Fully Automated
- Declaration and resolution phases with dice-splitting sliders, an optional declaration timer, yielding, and a delay system that lets you bank actions and jump back in mid-round
- Combat maneuvers handled end to end: Bite (kiss or attack), Clinch, Hold, Sweep, Tackle, Disarm, Ready Weapon, Get Up
- Targeting, positioning (flank and rear), outnumbering, weapon range, and movement penalties, all as one-click toggles
- Firearm fire modes: three-round burst and full auto with real per-turn bullet and ammo tracking
- Firearms deal bashing to Kindred automatically, unless you call a headshot
- Defenses that know the rules: block restrictions against lethal, parry with riposte, and effective Dexterity everywhere
- Blood in combat: healing as a reflexive action, physical attribute boosts with automatic decay, per-turn generational spending limits tracked for you
- Aggravated damage soak that asks the right questions (fire or sunlight, Fortitude, armor)
- Custom VTM-styled turn marker and movement readouts above tokens

### Disciplines
- Activation costs in blood and Willpower are spent automatically, with a private cost receipt to the player and GM
- Combat integration for discipline powers: Protean claws and forms, Serpentis, Quietus, Vicissitude Bonecraft and Horrid Form, Chimerstry's Horrid Reality, Obtenebration's Shadow Play, and more
- A complete Celerity package: passive initiative and movement, movement bursts, and extra-action dice budgets with turn caps
- Fortitude wired into the soak rules where the book says it matters

### Blood Magic
- Thaumaturgy and Necromancy with their paths and rituals as proper item types
- Dedicated compendiums: 22 paths and 67 rituals, organized by school and level

### The Beast
- Frenzy and Rötschreck as full mechanical states with wound penalty immunity
- Distinct Self-Control and Instinct handling, including Riding the Wave
- Situational checks built in: falling, throwing, awakening, electrocution, fire, sunlight, frenzy, and Rötschreck

### Inventory
- Carrying capacity with automatic penalties, real weights across all compendiums
- Two-hand rule: one weapon per hand, off-hand penalties, and Ambidextrous support
- Works out of the box, with clean item sheets for weapons, attire, equipment, and containers

### The Authentic Text Manager
The system ships with original descriptions written for this project. If you own the V20 book, the Authentic Text Manager (in system settings, GM only) lets you replace them with the book's own wording, privately, inside your world:

- Paste an entire chapter and hit Parse. The manager recognizes every entry it has a slot for and files each piece automatically
- Supported in bulk: Backgrounds, Personality Archetypes, all Disciplines including Thaumaturgy and Necromancy with their Paths and Rituals, Merits and Flaws, and the Attribute and Ability rating ladders
- Cleans up page headers, footers, page numbers, and split words from PDF copying on its own
- Review everything before applying, with per-entry editing, and export your text once to reuse in every world you run

## Installation

1. In Foundry VTT, go to **Game Systems** and click **Install System**
2. Paste the following manifest URL:

```
https://github.com/The-Final-Artificer/Foundry-VTM-V20/releases/latest/download/system.json
```

3. Click **Install**

## Requirements

- Foundry VTT v13 or later (verified on v14)

## Legal

This is unofficial fan content. It is not affiliated with or endorsed by Paradox Interactive AB.

Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit [worldofdarkness.com](https://www.worldofdarkness.com).

This project is published under the [Dark Pack](https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement) agreement.

![Dark Pack](VTM%20icons/darkpack_logo2.webp)

## License

The code for this system is released under the [MIT License](LICENSE).
