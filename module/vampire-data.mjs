const f = foundry.data.fields;

function int(initial, min = 0, max = 10) {
  return new f.NumberField({ required: true, nullable: false, initial, min, max, integer: true });
}
function str(initial = '') {
  return new f.StringField({ required: true, nullable: false, initial });
}
function attack() {
  return new f.SchemaField({
    id: str(),
    name: str('Custom Maneuver'),
    img: str(),
    primary: str('attributes.dexterity'),
    secondary: str('abilities.brawl'),
    accuracyMod: int(0, -20, 20),
    difficultyMod: int(0, -10, 10),
    damageFormula: str('Str'),
    damageType: str('bashing'),
  });
}

export class VampireData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      player: str(), chronicle: str(), nature: str(), demeanor: str(),
      concept: str(), clan: str(), generation: int(13, 3, 15), sire: str(),

      attributes: new f.SchemaField({
        strength: int(1), dexterity: int(1), stamina: int(1),
        charisma: int(1), manipulation: int(1), appearance: int(1),
        perception: int(1), intelligence: int(1), wits: int(1),
      }),

      abilities: new f.SchemaField({
        alertness: int(0), athletics: int(0), awareness: int(0), brawl: int(0),
        empathy: int(0), expression: int(0), intimidation: int(0), leadership: int(0),
        streetwise: int(0), subterfuge: int(0),
        animalKen: int(0), crafts: int(0), drive: int(0), etiquette: int(0),
        firearms: int(0), larceny: int(0), melee: int(0), performance: int(0),
        stealth: int(0), survival: int(0),
        academics: int(0), computer: int(0), finance: int(0), investigation: int(0),
        law: int(0), medicine: int(0), occult: int(0), politics: int(0),
        science: int(0), technology: int(0),
      }),

      virtues: new f.SchemaField({
        conscience: int(1, 0, 5),
        selfControl: int(1, 0, 5),
        courage: int(1, 0, 5),
      }),

      humanity: int(7, 0, 10),
      pathName: str('Humanity'),

      willpower: new f.SchemaField({
        value: int(1, 0, 10),
        max: int(1, 0, 10),
      }),

      blood: new f.SchemaField({
        value: int(10, 0, 100),
        max: int(10, 0, 100),
      }),

      health: new f.SchemaField({
        levels: new f.SchemaField({
          bruised: int(0, 0, 3), hurt: int(0, 0, 3), injured: int(0, 0, 3),
          wounded: int(0, 0, 3), mauled: int(0, 0, 3), crippled: int(0, 0, 3),
          incapacitated: int(0, 0, 3),
        }),
        value: int(7, 0, 7),
        max: int(7, 0, 7),
      }),

      experience: new f.SchemaField({
        current: int(0, 0, 9999),
        total: int(0, 0, 9999),
      }),

      money: new f.SchemaField({
        dollars: new f.NumberField({ required: true, nullable: false, initial: 0, min: 0, integer: true }),
        cents: new f.NumberField({ required: true, nullable: false, initial: 0, min: 0, max: 99, integer: true }),
      }),

      bio: new f.HTMLField({ initial: '' }),
      notes: new f.HTMLField({ initial: '' }),
      customAttacks: new f.ArrayField(attack(), { required: true, nullable: false, initial: [] }),
    };
  }

  prepareDerivedData() {
    const gen = CONFIG.VTM?.generationTable?.[this.generation];
    if (gen) {
      this.blood.max = gen.maxBlood;
      this.bloodPerTurn = gen.bloodPerTurn;
      this.traitMax = gen.traitMax;
      if (this.blood.value > this.blood.max) this.blood.value = this.blood.max;
    }

    const levels = Object.values(this.health.levels);
    this.health.value = levels.filter(v => v === 0).length;
    this.health.max = levels.length;

    const keys = ['bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'];
    const penalties = [0, -1, -1, -2, -2, -5, null];
    this.woundPenalty = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (this.health.levels[keys[i]] > 0) {
        this.woundPenalty = penalties[i];
        break;
      }
    }

  }
}
