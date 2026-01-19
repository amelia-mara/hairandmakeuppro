import type { Project, Scene, Character, Look } from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';

// Generate demo scenes (42 total)
function generateDemoScenes(): Scene[] {
  const locations = [
    { slugline: "SARAH'S APARTMENT - LIVING ROOM", intExt: 'INT' as const },
    { slugline: "COFFEE SHOP", intExt: 'INT' as const },
    { slugline: "CITY STREET", intExt: 'EXT' as const },
    { slugline: "HOSPITAL CORRIDOR", intExt: 'INT' as const },
    { slugline: "DR. WILSON'S OFFICE", intExt: 'INT' as const },
    { slugline: "SARAH'S APARTMENT - BEDROOM", intExt: 'INT' as const },
    { slugline: "PARK", intExt: 'EXT' as const },
    { slugline: "MIKE'S CAR", intExt: 'INT' as const },
    { slugline: "RESTAURANT", intExt: 'INT' as const },
    { slugline: "ROOFTOP BAR", intExt: 'EXT' as const },
  ];

  const timesOfDay: Scene['timeOfDay'][] = ['DAY', 'NIGHT', 'MORNING', 'EVENING'];

  const characterAssignments: Record<number, string[]> = {
    1: ['char-sarah', 'char-mike'],
    2: ['char-sarah'],
    3: ['char-sarah', 'char-mike'],
    4: ['char-sarah', 'char-wilson'],
    5: ['char-wilson'],
    6: ['char-sarah'],
    7: ['char-sarah', 'char-mike'],
    8: ['char-sarah', 'char-mike', 'char-wilson'],
    9: ['char-mike'],
    10: ['char-sarah'],
    11: ['char-sarah', 'char-mike'],
    12: ['char-sarah', 'char-wilson'],
    13: ['char-sarah'],
    14: ['char-sarah', 'char-mike'],
    15: ['char-sarah'],
    16: ['char-wilson'],
    17: ['char-sarah', 'char-wilson'],
    18: ['char-sarah', 'char-mike', 'char-wilson'],
    19: ['char-mike'],
    20: ['char-sarah'],
    // Continue pattern for remaining scenes
  };

  return Array.from({ length: 42 }, (_, i) => {
    const sceneNum = i + 1;
    const locationIndex = i % locations.length;
    const location = locations[locationIndex];
    const timeIndex = Math.floor(i / 10) % timesOfDay.length;

    // Determine characters for this scene
    let characters: string[];
    if (characterAssignments[sceneNum]) {
      characters = characterAssignments[sceneNum];
    } else {
      // Default assignment for scenes not explicitly defined
      if (sceneNum % 5 === 0) {
        characters = ['char-sarah', 'char-mike', 'char-wilson'];
      } else if (sceneNum % 3 === 0) {
        characters = ['char-sarah', 'char-wilson'];
      } else if (sceneNum % 2 === 0) {
        characters = ['char-sarah', 'char-mike'];
      } else {
        characters = ['char-sarah'];
      }
    }

    const synopsis = getDemoSynopsis(sceneNum);
    return {
      id: `scene-${sceneNum}`,
      sceneNumber: String(sceneNum),
      slugline: `${location.intExt}. ${location.slugline} - ${timesOfDay[timeIndex]}`,
      intExt: location.intExt,
      timeOfDay: timesOfDay[timeIndex],
      synopsis: synopsis || undefined,
      scriptContent: sceneNum <= 3 ? getDemoScriptContent(sceneNum) : undefined,
      characters,
      isComplete: sceneNum <= 3,
      completedAt: sceneNum <= 3 ? new Date(Date.now() - (4 - sceneNum) * 86400000) : undefined,
    };
  });
}

function getDemoSynopsis(sceneNum: number): string {
  const synopses: Record<number, string> = {
    1: "Sarah wakes up late and rushes to get ready while Mike waits impatiently. The tension between them is palpable.",
    2: "Sarah meets an old friend at the coffee shop and learns disturbing news about her past.",
    3: "Sarah and Mike argue on the busy street. A confrontation escalates unexpectedly.",
    4: "Sarah receives test results from Dr. Wilson. The news changes everything.",
    5: "Dr. Wilson reviews patient files alone, discovering a pattern that concerns him.",
    8: "Sarah, Mike, and Dr. Wilson meet at the restaurant to discuss the treatment plan.",
    12: "Sarah confronts Dr. Wilson about the test results in his office.",
    15: "Sarah reflects alone in her bedroom, making a difficult decision about her future.",
    16: "Dr. Wilson makes an urgent phone call that could change everything.",
    23: "The group gathers at the rooftop bar for a tense celebration.",
  };
  return synopses[sceneNum] ?? '';
}

function getDemoScriptContent(sceneNum: number): string {
  const scripts: Record<number, string> = {
    1: `FADE IN:

INT. SARAH'S APARTMENT - LIVING ROOM - MORNING

Sunlight streams through partially closed blinds. SARAH CHEN (30s, disheveled) rushes out from the bedroom, still pulling on a sweater.

MIKE (O.S.)
Sarah! We're going to be late!

SARAH
I know, I know! Just give me two minutes.

She grabs her bag, knocking over a stack of papers.

SARAH (CONT'D)
(muttering)
Where are my keys...

MIKE enters from the kitchen, holding a coffee cup.

MIKE
On the counter. Where you always leave them.

Sarah shoots him a look but grabs the keys.`,
    2: `INT. COFFEE SHOP - DAY

Sarah sits alone at a corner table, nervously stirring her latte. The door chimes. She looks up to see JENNIFER (40s, elegant) approaching.

JENNIFER
Sarah! It's been what, ten years?

SARAH
(standing, awkward hug)
Something like that. You look... well.

They sit. An uncomfortable silence.

JENNIFER
I wasn't sure you'd come. After everything.

SARAH
I almost didn't.

Jennifer reaches into her purse, pulls out a worn photograph.`,
    3: `EXT. CITY STREET - DAY

Sarah and Mike walk quickly through the crowded sidewalk. Their body language screams tension.

MIKE
You can't keep doing this, Sarah.

SARAH
Doing what? Living my life?

MIKE
Running from everything. Everyone who tries to help you.

Sarah stops abruptly. Pedestrians flow around them.

SARAH
(voice rising)
Help me? Is that what you call it?

MIKE
Keep your voice down.

SARAH
No! I'm done keeping quiet.`,
  };
  return scripts[sceneNum] ?? '';
}

// Demo characters
const demoCharacters: Character[] = [
  {
    id: 'char-sarah',
    name: 'Sarah Chen',
    initials: 'SC',
    avatarColour: '#C9A962',
  },
  {
    id: 'char-mike',
    name: 'Mike',
    initials: 'M',
    avatarColour: '#5B8DEF',
  },
  {
    id: 'char-wilson',
    name: 'Dr. Wilson',
    initials: 'DW',
    avatarColour: '#7B68EE',
  },
];

// Demo looks
const demoLooks: Look[] = [
  {
    id: 'look-sarah-1',
    characterId: 'char-sarah',
    name: 'Day 1 - Professional',
    scenes: ['1', '2', '3', '4', '5', '6', '7', '8'],
    estimatedTime: 30,
    makeup: {
      ...createEmptyMakeupDetails(),
      foundation: 'MAC Studio Fix NC25',
      coverage: 'Medium',
      concealer: 'NARS Radiant Creamy',
      concealerPlacement: 'Under eyes, nose bridge',
      contour: 'Charlotte Tilbury Filmstar Bronze',
      contourPlacement: 'Hollows of cheeks, jawline',
      highlight: 'Becca Champagne Pop',
      highlightPlacement: 'Cheekbones, brow bone, cupid\'s bow',
      blush: 'NARS Orgasm',
      blushPlacement: 'Apples of cheeks',
      browProduct: 'Anastasia Brow Wiz - Medium Brown',
      browShape: 'Natural arch, slightly filled',
      eyePrimer: 'Urban Decay Primer Potion',
      lidColour: 'Soft champagne shimmer',
      creaseColour: 'Warm taupe',
      outerV: 'Deep brown',
      liner: 'Tight line - dark brown',
      lashes: 'Individual clusters outer corner',
      lipLiner: 'MAC Spice',
      lipColour: 'Charlotte Tilbury Pillow Talk',
      setting: 'MAC Fix+, Laura Mercier powder T-zone',
    },
    hair: {
      ...createEmptyHairDetails(),
      style: 'Soft waves, parted slightly off-center to the left',
      products: 'Oribe Dry Texturizing Spray, GHD curl hold spray',
      parting: 'Left of center',
      piecesOut: 'Face-framing layers around cheekbones',
      pins: 'None visible - bobby pins hidden at crown if needed',
      accessories: 'None',
    },
  },
  {
    id: 'look-sarah-2',
    characterId: 'char-sarah',
    name: 'Day 2 - Casual',
    scenes: ['9', '10', '11', '12', '13', '14', '15'],
    estimatedTime: 20,
    makeup: {
      ...createEmptyMakeupDetails(),
      foundation: 'MAC Studio Fix NC25 - lighter application',
      coverage: 'Light-Medium',
      concealer: 'NARS Radiant Creamy',
      concealerPlacement: 'Under eyes only',
      blush: 'Glossier Cloud Paint - Dusk',
      blushPlacement: 'Diffused across cheeks',
      browProduct: 'Anastasia Brow Wiz - Medium Brown',
      browShape: 'Natural, brushed up',
      lidColour: 'Cream shimmer',
      liner: 'None',
      lashes: 'Mascara only - Benefit Roller Lash',
      lipColour: 'Fresh Lip Balm tinted - Rose',
    },
    hair: {
      ...createEmptyHairDetails(),
      style: 'Loose ponytail, slightly messy',
      products: 'Texture spray, smoothing serum on flyaways',
      parting: 'Center',
      piecesOut: 'Loose tendrils around face',
      pins: 'Clear elastic, hidden bobby pins',
      accessories: 'None',
    },
  },
  {
    id: 'look-mike-1',
    characterId: 'char-mike',
    name: 'Standard Look',
    scenes: ['1', '3', '7', '8', '9', '11', '14', '18', '19'],
    estimatedTime: 10,
    makeup: {
      ...createEmptyMakeupDetails(),
      foundation: 'Light powder for shine control',
      coverage: 'Minimal',
      concealer: 'Touch of concealer for blemishes if needed',
      setting: 'Blotting papers throughout day',
    },
    hair: {
      ...createEmptyHairDetails(),
      style: 'Short, textured, modern professional',
      products: 'American Crew Fiber',
      parting: 'None - swept back and to side',
    },
  },
  {
    id: 'look-wilson-1',
    characterId: 'char-wilson',
    name: 'Doctor Look',
    scenes: ['4', '5', '8', '12', '16', '17', '18'],
    estimatedTime: 15,
    makeup: {
      ...createEmptyMakeupDetails(),
      foundation: 'Light powder',
      coverage: 'Minimal - natural',
      concealer: 'Under eye if needed',
      browProduct: 'Clear brow gel',
      setting: 'Mattifying setting spray',
    },
    hair: {
      ...createEmptyHairDetails(),
      style: 'Distinguished gray, neatly combed back',
      products: 'Light pomade for control',
      parting: 'Side part - right',
    },
  },
];

// Create demo continuity events
export const demoContinuityEvent = {
  id: 'event-1',
  type: 'Wound' as const,
  name: 'Forehead Cut',
  description: 'Small laceration above left eyebrow, 2cm length',
  stage: 'Fresh bleeding',
  sceneRange: '12-18',
  products: 'Skin Illustrator FX Palette, Fresh Scab, KD-151 Blood',
  referencePhotos: [],
};

// Export the complete demo project
export const demoProject: Project = {
  id: 'demo-project',
  name: 'Demo Production',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date(),
  scenes: generateDemoScenes(),
  characters: demoCharacters,
  looks: demoLooks,
};

// Function to load demo data into the store
export function loadDemoData(setProject: (project: Project) => void) {
  setProject(demoProject);
}
