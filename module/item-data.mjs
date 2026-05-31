const f = foundry.data.fields;

function int(initial, min = 0, max = 10) {
  return new f.NumberField({ required: true, nullable: false, initial, min, max, integer: true });
}
function str(initial = '') {
  return new f.StringField({ required: true, nullable: false, initial });
}

export class DisciplineData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const power = () => new f.SchemaField({
      name: str(''),
      desc: str(''),
      primary: str(''),
      secondary: str(''),
      difficulty: int(6, 2, 10),
      cost: str(''),
    });
    return {
      level: int(0, 0, 10),
      description: new f.HTMLField({ initial: '' }),
      powers: new f.SchemaField({
        lvl1: power(),
        lvl2: power(),
        lvl3: power(),
        lvl4: power(),
        lvl5: power(),
      }),
    };
  }
}

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const level = () => new f.SchemaField({
      name: str(''),
      desc: str(''),
    });
    return {
      rating: int(1, 0, 10),
      notes: str(''),
      description: new f.HTMLField({ initial: '' }),
      levels: new f.SchemaField({
        lvl1: level(),
        lvl2: level(),
        lvl3: level(),
        lvl4: level(),
        lvl5: level(),
      }),
    };
  }
}

export class MeritData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cost: new f.NumberField({ required: true, nullable: false, initial: 1, min: -7, max: 7, integer: true }),
      meritType: str('physical'),
      description: new f.HTMLField({ initial: '' }),
    };
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      damage: str('0'),
      damageType: str('lethal'),
      difficulty: int(6, 1, 10),
      conceal: str('P'),
      range: str(''),
      capacity: str(''),
      requireTrait: str(''),
      requireMin: int(0, 0, 5),
      equipped: new f.BooleanField({ initial: false }),
      description: new f.HTMLField({ initial: '' }),
    };
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: int(0, 0, 5),
      penalty: new f.NumberField({ required: true, nullable: false, initial: 0, min: -5, max: 0, integer: true }),
      equipped: new f.BooleanField({ initial: false }),
      description: new f.HTMLField({ initial: '' }),
      bottomWear: str('none'),
      topWear: str('none'),
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: int(1, 0, 999),
      equipped: new f.BooleanField({ initial: false }),
      description: new f.HTMLField({ initial: '' }),
    };
  }
}

export class ContainerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      capacity: int(0, 0, 100),
      penalty: new f.NumberField({ required: true, nullable: false, initial: 0, min: -5, max: 0, integer: true }),
      equipped: new f.BooleanField({ initial: false }),
      description: new f.HTMLField({ initial: '' }),
    };
  }
}
