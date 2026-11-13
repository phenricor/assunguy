// Content tables, first imported from the prototype; edited here from now on.
// From here on these tables are the source of truth: edit them by hand.
import type { GoodDef, BuildingDef, VehicleDef, TransportRoleDef, LevelDef, MilestoneDef, LawDef, BiomeDef, BalanceDef, WorldDef } from './types.js';

export const GOODS = {
  "corn": {
    "group": "farming",
    "localPrice": 2,
    "exportPrice": 3.2,
    "baseDemand": 240,
    "food": true,
    "perishable": true,
    "dietWeight": 3
  },
  "beans": {
    "group": "farming",
    "localPrice": 4,
    "exportPrice": 5.5,
    "baseDemand": 130,
    "food": true,
    "dietWeight": 3
  },
  "cassava": {
    "group": "farming",
    "localPrice": 1.5,
    "exportPrice": 0,
    "food": true,
    "perishable": true,
    "dietWeight": 2
  },
  "rice": {
    "group": "farming",
    "localPrice": 3,
    "exportPrice": 4.5,
    "baseDemand": 180,
    "food": true,
    "dietWeight": 2
  },
  "wheat": {
    "group": "farming",
    "localPrice": 4,
    "exportPrice": 5.5,
    "baseDemand": 130,
    "food": true,
    "dietWeight": 1
  },
  "pineNut": {
    "group": "farming",
    "localPrice": 2,
    "exportPrice": 3,
    "baseDemand": 70,
    "food": true,
    "perishable": true,
    "dietWeight": 1
  },
  "fish": {
    "group": "river",
    "localPrice": 2,
    "exportPrice": 0,
    "food": true,
    "spoils": true,
    "perishable": true,
    "dietWeight": 3
  },
  "saltFish": {
    "group": "river",
    "localPrice": 3,
    "exportPrice": 5,
    "baseDemand": 90,
    "food": true,
    "dietWeight": 1
  },
  "huskedRice": {
    "group": "crafts",
    "localPrice": 4.4,
    "exportPrice": 6.4,
    "baseDemand": 150,
    "food": true,
    "dietWeight": 1
  },
  "jerky": {
    "group": "crafts",
    "localPrice": 7.5,
    "exportPrice": 10.5,
    "baseDemand": 140,
    "food": true,
    "dietWeight": 1
  },
  "cornmeal": {
    "group": "crafts",
    "localPrice": 3.2,
    "exportPrice": 4.8,
    "baseDemand": 140,
    "food": true,
    "dietWeight": 1
  },
  "cassavaFlour": {
    "group": "crafts",
    "localPrice": 2.6,
    "exportPrice": 4.2,
    "baseDemand": 140,
    "food": true,
    "dietWeight": 2
  },
  "wheatFlour": {
    "group": "crafts",
    "localPrice": 6.5,
    "exportPrice": 8.5,
    "baseDemand": 90,
    "food": true,
    "dietWeight": 1
  },
  "lard": {
    "group": "farming",
    "localPrice": 6,
    "exportPrice": 8.5,
    "baseDemand": 120,
    "food": true,
    "dietWeight": 1
  },
  "meat": {
    "group": "farming",
    "localPrice": 5,
    "exportPrice": 7,
    "baseDemand": 90,
    "food": true,
    "perishable": true,
    "dietWeight": 1
  },
  "sugarcane": {
    "group": "farming",
    "localPrice": 1,
    "exportPrice": 0
  },
  "rapadura": {
    "group": "crafts",
    "localPrice": 5,
    "exportPrice": 7,
    "baseDemand": 160,
    "perFamily": 0.1
  },
  "cachaca": {
    "group": "crafts",
    "localPrice": 6,
    "exportPrice": 9,
    "baseDemand": 130,
    "perFamily": 0.06
  },
  "sugar": {
    "group": "crafts",
    "localPrice": 9,
    "exportPrice": 14,
    "baseDemand": 220,
    "perFamily": 0.03
  },
  "yerba": {
    "group": "farming",
    "localPrice": 2.5,
    "exportPrice": 3.5,
    "baseDemand": 90,
    "perFamily": 0.04
  },
  "mate": {
    "group": "crafts",
    "localPrice": 7,
    "exportPrice": 11,
    "baseDemand": 420,
    "perFamily": 0.05
  },
  "tobaccoLeaf": {
    "group": "farming",
    "localPrice": 5,
    "exportPrice": 7,
    "baseDemand": 90
  },
  "ropeTobacco": {
    "group": "crafts",
    "localPrice": 9,
    "exportPrice": 12,
    "baseDemand": 120,
    "perFamily": 0.03
  },
  "cotton": {
    "group": "farming",
    "localPrice": 4,
    "exportPrice": 6,
    "baseDemand": 150
  },
  "cloth": {
    "group": "crafts",
    "localPrice": 11,
    "exportPrice": 14,
    "baseDemand": 90,
    "perFamily": 0.08
  },
  "coffee": {
    "group": "farming",
    "localPrice": 6,
    "exportPrice": 9,
    "baseDemand": 90
  },
  "driedCoffee": {
    "group": "crafts",
    "localPrice": 9,
    "exportPrice": 14,
    "baseDemand": 220,
    "perFamily": 0.02
  },
  "hide": {
    "group": "farming",
    "localPrice": 3,
    "exportPrice": 5,
    "baseDemand": 80
  },
  "leather": {
    "group": "crafts",
    "localPrice": 7,
    "exportPrice": 9,
    "baseDemand": 60
  },
  "shoes": {
    "group": "crafts",
    "localPrice": 14,
    "exportPrice": 16,
    "baseDemand": 40,
    "perFamily": 0.04
  },
  "planks": {
    "group": "crafts",
    "localPrice": 3,
    "exportPrice": 4.5,
    "baseDemand": 120,
    "perFamily": 0.12
  },
  "rooftiles": {
    "group": "crafts",
    "localPrice": 3,
    "exportPrice": 3.8,
    "baseDemand": 80,
    "perFamily": 0.08
  },
  "furniture": {
    "group": "crafts",
    "localPrice": 16,
    "exportPrice": 18,
    "baseDemand": 30,
    "perFamily": 0.03
  },
  "barrels": {
    "group": "crafts",
    "localPrice": 6,
    "exportPrice": 7,
    "baseDemand": 40,
    "perFamily": 0.02
  },
  "lime": {
    "group": "mining",
    "localPrice": 2,
    "exportPrice": 3.5,
    "baseDemand": 150,
    "perFamily": 0.03
  },
  "iron": {
    "group": "mining",
    "localPrice": 4,
    "exportPrice": 6,
    "baseDemand": 100
  },
  "tools": {
    "group": "crafts",
    "localPrice": 14,
    "exportPrice": 16,
    "baseDemand": 50,
    "perFamily": 0.05
  },
  "lead": {
    "group": "mining",
    "localPrice": 3,
    "exportPrice": 7,
    "baseDemand": 100
  },
  "gold": {
    "group": "mining",
    "localPrice": 30,
    "exportPrice": 40,
    "baseDemand": 30
  },
  "firewood": {
    "group": "crafts",
    "localPrice": 0.3,
    "exportPrice": 0.5,
    "baseDemand": 300
  }
} as const satisfies Record<string, GoodDef>;

export const BUILDINGS = {
  "hut": {
    "category": "housing",
    "cost": 20,
    "payer": "families",
    "housing": 1
  },
  "house": {
    "category": "housing",
    "cost": 80,
    "payer": "families",
    "housing": 2
  },
  "whitewashedHouse": {
    "category": "housing",
    "cost": 150,
    "payer": "families",
    "minLevel": 5,
    "housing": 3
  },
  "townhouse": {
    "category": "housing",
    "cost": 260,
    "payer": "families",
    "minLevel": 9,
    "housing": 4
  },
  "chapel": {
    "category": "services",
    "cost": 200,
    "payer": "colony",
    "jobs": 1,
    "sector": "services",
    "service": "faith",
    "radius": 10,
    "color": "#8A5BB5"
  },
  "church": {
    "category": "services",
    "cost": 900,
    "payer": "colony",
    "minLevel": 9,
    "jobs": 2,
    "sector": "services",
    "service": "faith",
    "radius": 16,
    "color": "#8A5BB5",
    "size": [
      2,
      2
    ]
  },
  "school": {
    "category": "services",
    "cost": 300,
    "payer": "colony",
    "jobs": 2,
    "sector": "services",
    "service": "school",
    "radius": 8,
    "color": "#2F5AA8"
  },
  "apothecary": {
    "category": "services",
    "cost": 250,
    "payer": "colony",
    "jobs": 1,
    "sector": "services",
    "service": "health",
    "radius": 8,
    "color": "#14875A"
  },
  "hospital": {
    "category": "services",
    "cost": 1100,
    "payer": "colony",
    "minLevel": 14,
    "jobs": 4,
    "sector": "services",
    "service": "health",
    "radius": 18,
    "color": "#14875A"
  },
  "theater": {
    "category": "services",
    "cost": 1400,
    "payer": "colony",
    "minLevel": 16,
    "jobs": 3,
    "sector": "services",
    "service": "culture",
    "radius": 16,
    "color": "#B5476B"
  },
  "well": {
    "category": "services",
    "cost": 60,
    "payer": "colony",
    "service": "water",
    "radius": 5,
    "color": "#2E7FB8"
  },
  "workshop": {
    "category": "retired",
    "cost": 200,
    "payer": "colony",
    "minLevel": 99,
    "radius": 8,
    "color": "#14875A",
    "teaches": true
  },
  "directorate": {
    "category": "services",
    "cost": 400,
    "payer": "colony",
    "jobs": 2,
    "sector": "services"
  },
  "council": {
    "category": "services",
    "cost": 800,
    "payer": "colony",
    "minLevel": 7,
    "jobs": 3,
    "sector": "services"
  },
  "store": {
    "category": "commerce",
    "cost": 200,
    "payer": "colony",
    "jobs": 1,
    "sector": "commerce",
    "service": "commerce",
    "radius": 7,
    "color": "#A67C12",
    "capacity": {
      "market": 40
    }
  },
  "market": {
    "category": "commerce",
    "cost": 600,
    "payer": "colony",
    "minLevel": 5,
    "jobs": 3,
    "sector": "commerce",
    "service": "commerce",
    "radius": 12,
    "color": "#A67C12",
    "size": [
      2,
      2
    ],
    "capacity": {
      "market": 120
    }
  },
  "riverPort": {
    "category": "transport",
    "cost": 300,
    "payer": "colony",
    "jobs": 1,
    "sector": "river",
    "riverside": true
  },
  "waystation": {
    "category": "transport",
    "cost": 300,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 1,
    "sector": "commerce"
  },
  "pasture": {
    "category": "retired",
    "cost": 150,
    "payer": "colony",
    "minLevel": 7,
    "jobs": 1,
    "sector": "commerce",
    "size": [
      3,
      3
    ]
  },
  "cornField": {
    "category": "crops",
    "cost": 40,
    "payer": "families",
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "corn",
      "perSeason": 42,
      "season": 2
    }
  },
  "beanField": {
    "category": "crops",
    "cost": 45,
    "payer": "families",
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "beans",
      "perSeason": 24,
      "season": 1
    }
  },
  "cassavaField": {
    "category": "crops",
    "cost": 35,
    "payer": "families",
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "cassava",
      "perSeason": 13
    }
  },
  "riceField": {
    "category": "crops",
    "cost": 60,
    "payer": "families",
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "rice",
      "perSeason": 36,
      "season": 2
    },
    "nearWater": 3
  },
  "wheatField": {
    "category": "crops",
    "cost": 60,
    "payer": "families",
    "minLevel": 4,
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "wheat",
      "perSeason": 28,
      "season": 0
    }
  },
  "caneField": {
    "category": "crops",
    "cost": 55,
    "payer": "families",
    "minLevel": 6,
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "sugarcane",
      "perSeason": 64,
      "season": 3
    }
  },
  "tobaccoField": {
    "category": "crops",
    "cost": 70,
    "payer": "families",
    "minLevel": 8,
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "tobaccoLeaf",
      "perSeason": 16,
      "season": 1
    }
  },
  "cottonField": {
    "category": "crops",
    "cost": 70,
    "payer": "families",
    "minLevel": 11,
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "cotton",
      "perSeason": 20,
      "season": 2
    }
  },
  "coffeeField": {
    "category": "crops",
    "cost": 90,
    "payer": "families",
    "minLevel": 14,
    "jobs": 1,
    "sector": "farming",
    "crop": true,
    "output": {
      "good": "coffee",
      "perSeason": 18,
      "season": 3
    }
  },
  "corral": {
    "category": "livestock",
    "cost": 110,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 1,
    "sector": "farming",
    "extraOutputs": [
      {
        "good": "meat",
        "perSeason": 9
      },
      {
        "good": "hide",
        "perSeason": 3
      }
    ]
  },
  "pigsty": {
    "category": "livestock",
    "cost": 90,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 1,
    "sector": "farming",
    "nuisance": 1,
    "processingCapacity": 18,
    "recipes": [
      {
        "from": "corn",
        "to": "lard",
        "ratio": 0.5
      }
    ]
  },
  "fishery": {
    "category": "livestock",
    "cost": 120,
    "payer": "colony",
    "jobs": 2,
    "sector": "river",
    "riverside": true,
    "output": {
      "good": "fish",
      "perSeason": 34
    }
  },
  "pineNutGrove": {
    "category": "livestock",
    "cost": 50,
    "payer": "colony",
    "minLevel": 2,
    "jobs": 1,
    "sector": "farming",
    "output": {
      "good": "pineNut",
      "perSeason": 30,
      "season": 2
    },
    "nearForest": true
  },
  "yerbaGrove": {
    "category": "livestock",
    "cost": 70,
    "payer": "colony",
    "minLevel": 6,
    "jobs": 1,
    "sector": "farming",
    "output": {
      "good": "yerba",
      "perSeason": 40,
      "season": 3
    },
    "onDeposit": [
      "yerba"
    ]
  },
  "sawmill": {
    "category": "extraction",
    "cost": 250,
    "payer": "colony",
    "jobs": 2,
    "sector": "crafts",
    "output": {
      "good": "planks",
      "perSeason": 22
    },
    "nearForest": true,
    "nuisance": 3
  },
  "pottery": {
    "category": "extraction",
    "cost": 200,
    "payer": "colony",
    "jobs": 2,
    "sector": "crafts",
    "output": {
      "good": "rooftiles",
      "perSeason": 14
    },
    "nuisance": 3
  },
  "mine": {
    "category": "extraction",
    "cost": 300,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 2,
    "sector": "mining",
    "nuisance": 2,
    "onDeposit": [
      "lime",
      "lead",
      "gold",
      "iron"
    ]
  },
  "monjolo": {
    "category": "workshops",
    "cost": 130,
    "payer": "colony",
    "minLevel": 2,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 30,
    "recipes": [
      {
        "from": "corn",
        "to": "cornmeal",
        "ratio": 0.8
      },
      {
        "from": "rice",
        "to": "huskedRice",
        "ratio": 0.85,
        "minLevel": 3
      }
    ]
  },
  "flourHouse": {
    "category": "workshops",
    "cost": 150,
    "payer": "colony",
    "minLevel": 2,
    "jobs": 2,
    "sector": "crafts",
    "processingCapacity": 30,
    "recipes": [
      {
        "from": "cassava",
        "to": "cassavaFlour",
        "ratio": 0.8
      }
    ]
  },
  "saltery": {
    "category": "workshops",
    "cost": 180,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 2,
    "sector": "crafts",
    "nuisance": 1,
    "processingCapacity": 40,
    "recipes": [
      {
        "from": "fish",
        "to": "saltFish",
        "ratio": 0.6
      },
      {
        "from": "meat",
        "to": "jerky",
        "ratio": 0.8,
        "minLevel": 7
      }
    ]
  },
  "mill": {
    "category": "workshops",
    "cost": 220,
    "payer": "colony",
    "minLevel": 4,
    "jobs": 2,
    "sector": "crafts",
    "riverside": true,
    "processingCapacity": 30,
    "recipes": [
      {
        "from": "wheat",
        "to": "wheatFlour",
        "ratio": 0.8
      }
    ]
  },
  "sugarMill": {
    "category": "workshops",
    "cost": 450,
    "payer": "colony",
    "minLevel": 6,
    "jobs": 3,
    "sector": "crafts",
    "size": [
      2,
      2
    ],
    "nuisance": 3,
    "processingCapacity": 64,
    "recipes": [
      {
        "from": "sugarcane",
        "to": "rapadura",
        "ratio": 0.4
      },
      {
        "from": "sugarcane",
        "to": "sugar",
        "ratio": 0.2,
        "minLevel": 14
      }
    ]
  },
  "distillery": {
    "category": "workshops",
    "cost": 240,
    "payer": "colony",
    "minLevel": 7,
    "jobs": 1,
    "sector": "crafts",
    "nuisance": 1,
    "processingCapacity": 40,
    "recipes": [
      {
        "from": "sugarcane",
        "to": "cachaca",
        "ratio": 0.3
      }
    ]
  },
  "yerbaDryer": {
    "category": "workshops",
    "cost": 220,
    "payer": "colony",
    "minLevel": 6,
    "jobs": 2,
    "sector": "crafts",
    "nuisance": 1,
    "processingCapacity": 40,
    "recipes": [
      {
        "from": "yerba",
        "to": "mate",
        "ratio": 0.5
      }
    ]
  },
  "tobaccoShed": {
    "category": "workshops",
    "cost": 140,
    "payer": "colony",
    "minLevel": 8,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 20,
    "recipes": [
      {
        "from": "tobaccoLeaf",
        "to": "ropeTobacco",
        "ratio": 0.9
      }
    ]
  },
  "tannery": {
    "category": "workshops",
    "cost": 200,
    "payer": "colony",
    "minLevel": 9,
    "jobs": 1,
    "sector": "crafts",
    "nuisance": 3,
    "processingCapacity": 12,
    "recipes": [
      {
        "from": "hide",
        "to": "leather",
        "ratio": 0.8
      }
    ]
  },
  "carpentry": {
    "category": "workshops",
    "cost": 180,
    "payer": "colony",
    "minLevel": 10,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 8,
    "recipes": [
      {
        "from": "planks",
        "to": "furniture",
        "ratio": 0.5
      }
    ]
  },
  "cooperage": {
    "category": "workshops",
    "cost": 150,
    "payer": "colony",
    "minLevel": 10,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 10,
    "recipes": [
      {
        "from": "planks",
        "to": "barrels",
        "ratio": 0.8
      }
    ]
  },
  "smithy": {
    "category": "workshops",
    "cost": 260,
    "payer": "colony",
    "minLevel": 10,
    "jobs": 2,
    "sector": "crafts",
    "nuisance": 1,
    "processingCapacity": 8,
    "recipes": [
      {
        "from": "iron",
        "to": "tools",
        "ratio": 0.6
      }
    ]
  },
  "coffeeYard": {
    "category": "workshops",
    "cost": 160,
    "payer": "colony",
    "minLevel": 14,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 20,
    "recipes": [
      {
        "from": "coffee",
        "to": "driedCoffee",
        "ratio": 0.8
      }
    ]
  },
  "loom": {
    "category": "workshops",
    "cost": 280,
    "payer": "colony",
    "minLevel": 11,
    "jobs": 2,
    "sector": "crafts",
    "processingCapacity": 15,
    "recipes": [
      {
        "from": "cotton",
        "to": "cloth",
        "ratio": 0.8
      }
    ]
  },
  "shoemaker": {
    "category": "workshops",
    "cost": 170,
    "payer": "colony",
    "minLevel": 13,
    "jobs": 1,
    "sector": "crafts",
    "processingCapacity": 8,
    "recipes": [
      {
        "from": "leather",
        "to": "shoes",
        "ratio": 0.7
      }
    ]
  },
  "fountain": {
    "category": "services",
    "cost": 350,
    "payer": "colony",
    "minLevel": 9,
    "service": "water",
    "radius": 7,
    "color": "#2E7FB8"
  },
  "jail": {
    "category": "services",
    "cost": 600,
    "payer": "colony",
    "minLevel": 9,
    "jobs": 1,
    "sector": "services",
    "radius": 12
  },
  "fireStation": {
    "category": "services",
    "cost": 900,
    "payer": "colony",
    "minLevel": 12,
    "jobs": 2,
    "sector": "services",
    "radius": 12
  },
  "depot": {
    "category": "retired",
    "cost": 1800,
    "payer": "colony",
    "jobs": 2,
    "sector": "commerce",
    "lateGame": true,
    "fixed": true
  },
  "cartWorkshop": {
    "category": "retired",
    "cost": 1500,
    "payer": "colony",
    "jobs": 2,
    "sector": "crafts",
    "lateGame": true,
    "fixed": true
  },
  "woodYard": {
    "category": "transport",
    "cost": 900,
    "payer": "colony",
    "minLevel": 9,
    "jobs": 2,
    "sector": "crafts",
    "output": {
      "good": "firewood",
      "perSeason": 110
    },
    "nearForest": true,
    "fixed": true
  },
  "warehouse": {
    "category": "retired",
    "cost": 3500,
    "payer": "colony",
    "jobs": 2,
    "sector": "commerce",
    "lateGame": true,
    "fixed": true
  },
  "trainStation": {
    "category": "transport",
    "cost": 5000,
    "payer": "colony",
    "jobs": 3,
    "sector": "commerce",
    "lateGame": true,
    "fixed": true
  },
  "railWorkshop": {
    "category": "retired",
    "cost": 6000,
    "payer": "colony",
    "jobs": 3,
    "sector": "crafts",
    "lateGame": true,
    "fixed": true
  },
  "steamPier": {
    "category": "transport",
    "cost": 5000,
    "payer": "colony",
    "minLevel": 9,
    "jobs": 2,
    "sector": "river",
    "riverside": true,
    "fixed": true
  },
  "shipyard": {
    "category": "retired",
    "cost": 6000,
    "payer": "colony",
    "jobs": 3,
    "sector": "crafts",
    "riverside": true,
    "lateGame": true,
    "fixed": true
  },
  "tradingPost": {
    "category": "transport",
    "cost": 250,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 1,
    "sector": "commerce"
  },
  "landing": {
    "category": "transport",
    "cost": 200,
    "payer": "colony",
    "minLevel": 3,
    "jobs": 1,
    "sector": "river",
    "riverside": true
  },
  "railStop": {
    "category": "transport",
    "cost": 1500,
    "payer": "colony",
    "jobs": 1,
    "sector": "commerce",
    "lateGame": true,
    "fixed": true
  }
} as const satisfies Record<string, BuildingDef>;

export const VEHICLES = {
  "canoe": {
    "mode": "river",
    "cargo": 120,
    "price": 120,
    "upkeep": 10,
    "minLevel": 1
  },
  "muleTrain": {
    "mode": "road",
    "cargo": 80,
    "price": 200,
    "upkeep": 20,
    "minLevel": 3
  },
  "wagon": {
    "mode": "road",
    "cargo": 150,
    "price": 650,
    "upkeep": 35,
    "minLevel": 9
  },
  "steamboat": {
    "mode": "river",
    "cargo": 700,
    "price": 4500,
    "upkeep": 110,
    "minLevel": 9,
    "firewood": 40
  },
  "railcar": {
    "mode": "rail",
    "cargo": 250,
    "price": 900,
    "upkeep": 25,
    "lateGame": true
  },
  "lightTrain": {
    "mode": "rail",
    "cargo": 900,
    "price": 10000,
    "upkeep": 200,
    "firewood": 60,
    "lateGame": true
  },
  "mediumTrain": {
    "mode": "rail",
    "cargo": 1500,
    "price": 16000,
    "upkeep": 280,
    "firewood": 80,
    "lateGame": true
  },
  "heavyTrain": {
    "mode": "rail",
    "cargo": 2400,
    "price": 24000,
    "upkeep": 380,
    "firewood": 110,
    "lateGame": true
  }
} as const satisfies Record<string, VehicleDef>;

export const TRANSPORT_ROLES = {
  "store": {
    "role": "commerce",
    "reach": 6
  },
  "market": {
    "role": "commerce",
    "reach": 10
  },
  "tradingPost": {
    "starter": "muleTrain", "role": "collection",
    "mode": "road",
    "reach": 8,
    "vehicles": [
      "muleTrain",
      "wagon"
    ],
    "slots": [
      4,
      6,
      8
    ]
  },
  "landing": {
    "starter": "canoe", "role": "collection",
    "mode": "river",
    "reach": 8,
    "vehicles": [
      "canoe"
    ],
    "slots": [
      4,
      6,
      8
    ]
  },
  "railStop": {
    "starter": "railcar", "role": "collection",
    "mode": "rail",
    "reach": 10,
    "vehicles": [
      "railcar"
    ],
    "slots": [
      4,
      6,
      8
    ]
  },
  "riverPort": {
    "starter": "canoe", "role": "gateway",
    "mode": "river",
    "vehicles": [
      "canoe"
    ],
    "slots": [
      4,
      6,
      8
    ]
  },
  "waystation": {
    "starter": "muleTrain", "role": "gateway",
    "mode": "road",
    "vehicles": [
      "muleTrain",
      "wagon"
    ],
    "slots": [
      6,
      8,
      10
    ]
  },
  "steamPier": {
    "role": "gateway",
    "mode": "river",
    "vehicles": [
      "steamboat"
    ],
    "slots": [
      3,
      3,
      3
    ]
  },
  "trainStation": {
    "role": "gateway",
    "mode": "rail",
    "vehicles": [
      "lightTrain",
      "mediumTrain",
      "heavyTrain"
    ],
    "slots": [
      4,
      4,
      4
    ]
  }
} as const satisfies Record<string, TransportRoleDef>;

export const LEVELS: readonly LevelDef[] = [
  {
    "level": 1,
    "workers": 0,
    "income": 0
  },
  {
    "level": 2,
    "workers": 10,
    "income": 500
  },
  {
    "level": 3,
    "workers": 20,
    "income": 1100
  },
  {
    "level": 4,
    "workers": 32,
    "income": 1900
  },
  {
    "level": 5,
    "workers": 44,
    "income": 2800,
    "milestone": 1
  },
  {
    "level": 6,
    "workers": 54,
    "income": 3500
  },
  {
    "level": 7,
    "workers": 64,
    "income": 4300
  },
  {
    "level": 8,
    "workers": 76,
    "income": 5200,
    "districts": 2
  },
  {
    "level": 9,
    "workers": 90,
    "income": 6200,
    "milestone": 2
  },
  {
    "level": 10,
    "workers": 106,
    "income": 7400,
    "idle": 0.3
  },
  {
    "level": 11,
    "workers": 124,
    "income": 8800
  },
  {
    "level": 12,
    "workers": 144,
    "income": 10400,
    "districts": 3
  },
  {
    "level": 13,
    "workers": 166,
    "income": 12200,
    "idle": 0.25
  },
  {
    "level": 14,
    "workers": 190,
    "income": 14000,
    "milestone": 3
  },
  {
    "level": 15,
    "workers": 220,
    "income": 16500
  },
  {
    "level": 16,
    "workers": 255,
    "income": 19500,
    "districts": 4,
    "requires": {
      "hospital": 1
    }
  },
  {
    "level": 17,
    "workers": 295,
    "income": 23000,
    "idle": 0.25
  },
  {
    "level": 18,
    "workers": 340,
    "income": 27000,
    "districts": 5,
    "requires": {
      "hospital": 1,
      "theater": 1
    }
  }
];

export const MILESTONES: readonly MilestoneDef[] = [
  {
    "id": "settlement",
    "grant": 160,
    "shareOfTrade": 0.1
  },
  {
    "id": "parish",
    "grant": 120,
    "shareOfTrade": 0.1,
    "families": 44,
    "satisfaction": 50,
    "deadline": 40,
    "requires": {
      "chapel": 1,
      "school": 1,
      "directorate": 1
    }
  },
  {
    "id": "village",
    "grant": 80,
    "shareOfTrade": 0.1,
    "families": 90,
    "satisfaction": 55,
    "lands": 4,
    "deadline": 56,
    "requires": {
      "chapel": 2,
      "school": 2,
      "apothecary": 2,
      "market": 1
    }
  },
  {
    "id": "town",
    "grant": 40,
    "shareOfTrade": 0.1,
    "families": 190,
    "satisfaction": 60,
    "lands": 9,
    "deadline": 72,
    "road": true,
    "requires": {
      "church": 1,
      "council": 1,
      "school": 4,
      "apothecary": 3,
      "market": 2
    }
  }
];

export const LEVEL_UNLOCKS: Readonly<Record<number, readonly string[]>> = {
  "2": [
    "pineNutGrove",
    "monjolo",
    "flourHouse",
    "workshop"
  ],
  "3": [
    "waystation",
    "corral",
    "pigsty",
    "mine",
    "saltery",
    "tradingPost",
    "landing"
  ],
  "4": [
    "wheatField",
    "mill"
  ],
  "5": [
    "whitewashedHouse",
    "market"
  ],
  "6": [
    "caneField",
    "yerbaGrove",
    "sugarMill",
    "yerbaDryer"
  ],
  "7": [
    "pasture",
    "distillery",
    "council"
  ],
  "8": [
    "tobaccoField",
    "tobaccoShed"
  ],
  "9": [
    "townhouse",
    "church",
    "tannery",
    "fountain",
    "jail",
    "woodYard",
    "steamPier"
  ],
  "10": [
    "carpentry",
    "cooperage",
    "smithy"
  ],
  "11": [
    "cottonField",
    "loom"
  ],
  "12": [
    "fireStation"
  ],
  "13": [
    "shoemaker"
  ],
  "14": [
    "coffeeField",
    "coffeeYard",
    "hospital"
  ],
  "16": [
    "theater"
  ]
};

export const LAWS = {
  "healthCode": {
    "satisfaction": -1
  },
  "weeklyFair": {
    "satisfaction": 2
  },
  "foodPriceCap": {
    "satisfaction": 3
  },
  "landRegistry": {
    "satisfaction": -3
  },
  "compulsorySchool": {
    "satisfaction": 2
  },
  "workParty": {
    "satisfaction": -2
  },
  "sundayWork": {
    "satisfaction": -5
  },
  "longHours": {
    "satisfaction": -7,
    "requires": "sundayWork"
  }
} as const satisfies Record<string, LawDef>;

export const PATH_CHOICES: Readonly<Record<number, readonly [string, string]>> = {
  "3": [
    "polyculture",
    "monoculture"
  ],
  "7": [
    "familyWorkshop",
    "manufacture"
  ],
  "11": [
    "freeMuleteers",
    "storeContract"
  ],
  "16": [
    "publicSchool",
    "brotherhoods"
  ]
};

export const BIOMES = {
  "floodplain": {
    "forest": -0.45,
    "soil": {
      "rice": 1.35,
      "sugarcane": 1.25,
      "corn": 1.15,
      "cassava": 1.1,
      "beans": 1,
      "wheat": 0.7,
      "coffee": 0.7,
      "tobaccoLeaf": 1,
      "cotton": 0.9
    },
    "deposits": {}
  },
  "grassland": {
    "forest": -0.75,
    "soil": {
      "wheat": 1.35,
      "beans": 1.15,
      "corn": 1,
      "cassava": 0.85,
      "rice": 0.7,
      "sugarcane": 0.75,
      "coffee": 0.85,
      "tobaccoLeaf": 1.05,
      "cotton": 1.1
    },
    "deposits": {
      "yerba": 2
    }
  },
  "forest": {
    "forest": 0.12,
    "soil": {
      "corn": 0.9,
      "cassava": 1,
      "beans": 0.9,
      "wheat": 0.8,
      "rice": 0.7,
      "sugarcane": 0.85,
      "coffee": 1,
      "tobaccoLeaf": 0.9,
      "cotton": 0.7
    },
    "deposits": {}
  },
  "yerbaForest": {
    "forest": -0.25,
    "soil": {
      "corn": 1,
      "beans": 1,
      "cassava": 1,
      "wheat": 0.9,
      "rice": 0.7,
      "sugarcane": 0.85,
      "coffee": 1,
      "tobaccoLeaf": 1,
      "cotton": 0.9
    },
    "deposits": {
      "yerba": 9
    }
  },
  "highlands": {
    "forest": 0.02,
    "soil": {
      "corn": 0.7,
      "cassava": 0.8,
      "beans": 0.75,
      "wheat": 0.7,
      "rice": 0.6,
      "sugarcane": 0.65,
      "coffee": 0.9,
      "tobaccoLeaf": 0.8,
      "cotton": 0.65
    },
    "deposits": {
      "lime": 3,
      "lead": 3,
      "iron": 3
    }
  },
  "diggings": {
    "forest": 0.02,
    "soil": {
      "corn": 0.95,
      "cassava": 0.95,
      "beans": 0.9,
      "wheat": 0.8,
      "rice": 0.9,
      "sugarcane": 0.9,
      "coffee": 0.9,
      "tobaccoLeaf": 0.95,
      "cotton": 0.8
    },
    "deposits": {
      "gold": 4,
      "lime": 1
    }
  }
} as const satisfies Record<string, BiomeDef>;

export const WEATHER_ODDS: readonly Readonly<Record<string, number>>[] = [
  {
    "clear": 0.35,
    "cloudy": 0.25,
    "rain": 0.25,
    "storm": 0.1,
    "fog": 0.05
  },
  {
    "clear": 0.3,
    "cloudy": 0.15,
    "rain": 0.35,
    "storm": 0.2
  },
  {
    "clear": 0.35,
    "cloudy": 0.25,
    "fog": 0.3,
    "rain": 0.1
  },
  {
    "clear": 0.35,
    "cloudy": 0.2,
    "fog": 0.35,
    "rain": 0.1
  }
];

export const ORIGIN_TRADE: Readonly<Record<string, string>> = {
  "german": "crafts",
  "swedish": "crafts",
  "swiss": "crafts",
  "italian": "farming",
  "brazilian": "farming",
  "french": "commerce",
  "belgian": "commerce",
  "english": "mining",
  "spanish": "river"
};

export const BALANCE: BalanceDef = {
  "subsistencePerSeason": 3,
  "subsistenceIncomeShare": 0.8,
  "storageKeep": {
    "none": 0.9,
    "grain": 0.97,
    "fresh": 0.85
  },
  "riverFreight": 0.5,
  "freeCarryDistance": 6,
  "upgradeOpensJobs": true,
  "milestoneWorkers": true,
  "smallHomes": true,
  "districtsFromStart": true,
  "titheSpare": 1,
  "adviseExportDuty": true,
  "taxFloorAfterTown": 50,
  "routeChoiceSharpness": 8,
  "isolatedCommerceWeight": 0.6,
  "lotPrice": 20,
  "seedAid": 6,
  "arrivalAid": 5,
  "newcomerWage": 2,
  "wasteLimit": 0.25,
  "firewoodPrice": 0.4,
  "expeditionCost": 60,
  "autosaves": 5,
  "travelTime": {
    "canoe": 0.35,
    "steamboat": 0.12,
    "muleTrain": 0.9,
    "wagon": 0.55
  },
  "tariffMargins": [
    -0.3,
    0,
    0.15,
    0.3,
    0.6
  ],
  "depositYield": {
    "lime": 24,
    "lead": 18,
    "gold": 2,
    "iron": 20
  },
  "milestoneCostFactor": [
    1,
    1,
    1.25,
    1.6
  ]
};

export const WORLD: WorldDef = {
  "width": 90,
  "height": 105,
  "regionSize": 15,
  "regionCols": 6,
  "regionRows": 7,
  "startColumn": 22,
  "startRow": 47
};
