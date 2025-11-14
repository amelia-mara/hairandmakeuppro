# Master Context System - Complete Documentation

## Overview

The **Master Context System** is the PRIMARY data source for all character profiles, continuity tracking, and scene breakdown in the Hair & Makeup Pro application. It performs a comprehensive, one-time analysis of the entire screenplay when imported, extracting rich character data, story structure, environmental factors, and continuity requirements.

## Architecture

### Data Flow

```
Script Import
    ↓
ScriptProcessor.parseScreenplay()  (Parse scenes & structure)
    ↓
performDeepAnalysis()  (AI analyzes full script - ONE TIME)
    ↓
window.masterContext  (Created & stored)
    ↓
populateInitialData()  (Populate app state from masterContext)
    ↓
Character Profiles & Scene Breakdowns  (Display rich data)
```

### Storage Locations

1. **Primary**: `window.masterContext` (in-memory for fast access)
2. **Persistent**: `localStorage.getItem('masterContext')` (survives page refresh)
3. **Redundant**: `window.scriptMasterContext` (legacy compatibility)

## Master Context Data Structure

### Complete Schema

```javascript
window.masterContext = {
    // Metadata
    title: "Script Title",
    totalScenes: 100,
    createdAt: "2025-11-14T10:30:00.000Z",
    analysisVersion: "2.0-enhanced",

    // Story Structure
    storyStructure: {
        totalDays: 5,
        timeline: [
            {
                day: "Day 1",
                scenes: [1, 2, 3, 4, 5],
                description: "Introduction, setup"
            },
            {
                day: "Day 2",
                scenes: [6, 7, 8, 9],
                description: "Rising action"
            }
        ],
        flashbacks: [15, 30],
        timeJumps: [
            {
                afterScene: 14,
                jump: "3 days later",
                toDay: "Day 5"
            }
        ]
    },

    // Rich Character Profiles
    characters: {
        "CHARACTER_NAME": {
            // EXACT quotes from script
            scriptDescriptions: [
                {
                    text: "PETER LAWSON (52), weathered face, eyes that have seen too much",
                    sceneNumber: 1,
                    type: "introduction"
                }
            ],

            // Physical characteristics
            physicalProfile: {
                age: "52",
                gender: "Male",
                ethnicity: "Not specified",
                build: "Weathered, worn",
                hairColor: "Graying",
                hairStyle: "Unkempt",
                eyeColor: "Blue",
                distinctiveFeatures: ["Weathered face", "Tired eyes", "Scar on cheek"]
            },

            // Character analysis
            characterAnalysis: {
                role: "protagonist",  // protagonist/supporting/background
                personality: "Haunted, determined, carrying guilt",
                occupation: "Former detective",
                socialClass: "Working class",
                arc: "Redemption - from broken to finding purpose",
                emotionalJourney: "Guilt → Determination → Acceptance"
            },

            // Visual identity for hair/makeup department
            visualProfile: {
                overallVibe: "Tired detective who's been through hell",
                styleChoices: "Practical, worn clothing, doesn't care about appearance",
                groomingHabits: "Neglected, unkempt, stubble",
                makeupNotes: "Bags under eyes, weathered skin, possibly scar",
                quirks: "Rubs face when tired, disheveled appearance",
                inspirations: "True Detective's Rust Cohle, Logan"
            },

            // Continuity tracking
            continuityNotes: {
                keyLooks: "Starts disheveled, cleans up for confrontation",
                transformations: "Gets injured in Scene 45, bruising through Act 3",
                signature: "Always wearing father's watch",
                importantScenes: [1, 15, 45, 89]
            },

            // Scene tracking
            firstAppearance: 1,
            lastAppearance: 98,
            sceneCount: 45,
            scenesPresent: [1, 2, 3, 5, 7, 8, 10, 12, ...]
        }
    },

    // Environmental conditions affecting appearance
    environments: {
        "scene_1": {
            location: "EXT. FERRY - DAY",
            conditions: ["windy", "ocean spray", "bright sun"],
            impactOnAppearance: "Hair windswept, clothes damp from spray"
        },
        "scene_15": {
            location: "INT. WAREHOUSE - NIGHT",
            conditions: ["dusty", "dim lighting", "cold"],
            impactOnAppearance: "Dust on clothes and hair, pale complexion in low light"
        }
    },

    // Physical interactions affecting appearance
    interactions: {
        "scene_15": {
            type: "fight",
            characters: ["PETER LAWSON", "ERIK"],
            impact: "Peter gets cut on cheek, Erik's nose bleeding"
        },
        "scene_30": {
            type: "intimate",
            characters: ["GWEN", "JOHN"],
            impact: "Lipstick smudged, hair disheveled"
        }
    },

    // Emotional beats requiring specific looks
    emotionalBeats: {
        "scene_45": {
            character: "GWEN",
            emotion: "crying",
            visualImpact: "Mascara running, red eyes, blotchy skin"
        }
    },

    // Dialogue that references appearance
    dialogueReferences: {
        "scene_8": {
            line: "You look like hell",
            character: "PETER",
            speaker: "GWEN",
            implication: "Peter needs to look exhausted/disheveled"
        }
    },

    // Major continuity events
    majorEvents: [
        {
            scene: 15,
            type: "fight",
            charactersAffected: ["PETER LAWSON", "ERIK"],
            visualImpact: "Peter: cut on cheek that needs to heal. Erik: broken nose, swelling"
        }
    ],

    // General continuity notes
    continuityNotes: "Pay special attention to Peter's injury healing from Scene 15 onwards"
}
```

## Key Files

### 1. `/js/script-breakdown/export-handlers.js`
**Function**: `performDeepAnalysis(scriptText, scenes)`
- **Purpose**: Creates the masterContext through AI analysis
- **When**: Called ONCE during script import (line 110 in `processScript()`)
- **AI Prompt**: Comprehensive 300+ line prompt extracting all character and story data
- **Token Limit**: 8000 tokens for detailed response
- **Returns**: Complete masterContext object

**Function**: `populateInitialData(masterContext)`
- **Purpose**: Populates application state from masterContext
- **Actions**:
  - Creates `window.confirmedCharacters` list
  - Builds `window.characterProfiles` with rich data
  - Populates `state.castProfiles`, `state.sceneTimeline`, `state.continuityEvents`
  - Applies environment, interaction, and emotional beat data to scenes
  - Renders character tabs and scene list

### 2. `/js/script-breakdown/master-context-utils.js`
**Purpose**: Utility functions for easy access to masterContext data

**Core Functions**:
- `getMasterContext()` - Get or load masterContext
- `getCharacterProfile(name)` - Get complete character data
- `getCharacterPhysicalProfile(name)` - Get physical attributes
- `getCharacterVisualProfile(name)` - Get styling/grooming notes
- `getSceneContext(sceneNumber)` - Get all context for a scene
- `getSceneEnvironment(sceneNumber)` - Get environmental data
- `getSceneInteractions(sceneNumber)` - Get physical interactions
- `getMajorEvents()` - Get all major continuity events

**Global Exports**: Key functions exposed on `window` for easy access throughout the app

### 3. `/js/script-breakdown/character-profiles.js`
**Function**: `buildCharacterProfile(characterName)`
- **Purpose**: Renders rich character profile using masterContext
- **Data Source**: `masterContext.characters[characterName]`
- **Displays**:
  - Script descriptions (exact quotes)
  - Physical profile (age, gender, build, hair, eyes, features)
  - Visual identity (vibe, style, grooming, makeup, inspirations)
  - Character journey (personality, arc, emotional journey)
  - Continuity guidelines (key looks, transformations, signature items)
  - Visual timeline with appearances
  - Continuity events and tagged elements

### 4. `/js/script-breakdown/breakdown-form.js`
**Function**: `renderSceneInfoSection(scene)`
- **Enhanced**: Now calls `renderMasterContextAlerts(sceneContext)`
- **Displays**:
  - Environmental conditions alerts
  - Physical interaction alerts
  - Emotional beat alerts
  - Dialogue reference alerts
  - Flashback indicators

**Function**: `renderMasterContextAlerts(sceneContext)`
- **Purpose**: Display continuity-critical information for the current scene
- **Alert Types**:
  - 🌤️ Environmental Conditions
  - ⚡ Physical Interactions
  - 💔 Emotional Beats
  - 💬 Dialogue References
  - ⏮️ Flashback Indicator

## Usage Patterns

### Accessing Character Data

```javascript
// Get complete profile
const profile = window.getCharacterProfile("PETER LAWSON");

// Get physical attributes
const physical = profile.physicalProfile;
console.log(physical.age);        // "52"
console.log(physical.hairColor);  // "Graying"
console.log(physical.distinctiveFeatures);  // ["Weathered face", "Tired eyes"]

// Get exact script quotes
const descriptions = profile.scriptDescriptions;
descriptions.forEach(desc => {
    console.log(`Scene ${desc.sceneNumber}: "${desc.text}"`);
});

// Get visual profile
const visual = profile.visualProfile;
console.log(visual.overallVibe);     // "Tired detective..."
console.log(visual.groomingHabits);  // "Neglected, unkempt, stubble"
console.log(visual.inspirations);    // "True Detective's Rust Cohle"
```

### Accessing Scene Context

```javascript
// Get all context for a scene
const sceneContext = window.getSceneContext(15);

console.log(sceneContext.storyDay);      // "Day 2"
console.log(sceneContext.environment);   // {location, conditions, impact}
console.log(sceneContext.interactions);  // {type: "fight", characters, impact}
console.log(sceneContext.isFlashback);   // false
```

### Checking Continuity Events

```javascript
// Get all major events
const events = getMajorEvents();

// Get events for specific character
const peterEvents = events.filter(e =>
    e.charactersAffected.includes("PETER LAWSON")
);

// Get events in specific scene
const scene15Events = events.filter(e => e.scene === 15);
```

## Integration Points

### Script Import Flow
1. User imports script via Import Modal
2. `ScriptProcessor.parseScreenplay()` detects scenes
3. `performDeepAnalysis()` runs AI analysis (CRITICAL - only time AI sees full script)
4. `masterContext` created and stored in `window` and `localStorage`
5. `populateInitialData()` spreads data to app state
6. Character tabs and scene list rendered with rich data

### Character Profile Display
1. User clicks on character tab
2. `buildCharacterProfile()` called with character name
3. Retrieves data from `masterContext.characters[name]`
4. Renders sections:
   - Script Descriptions
   - Physical Profile
   - Visual Identity
   - Character Journey
   - Continuity Guidelines
5. User sees comprehensive character breakdown

### Scene Breakdown Display
1. User selects a scene
2. `renderBreakdownPanel()` called
3. `renderSceneInfoSection()` retrieves scene context
4. `renderMasterContextAlerts()` displays:
   - Environmental conditions
   - Physical interactions
   - Emotional beats
   - Dialogue references
5. User sees contextual continuity notes

## Critical Requirements

### ✅ MUST DO

1. **Analysis runs on import**: `performDeepAnalysis()` MUST be called in `processScript()` - it's the ONLY time the AI sees the full script
2. **Store immediately**: masterContext MUST be saved to `localStorage` immediately after creation
3. **Exact quotes**: scriptDescriptions MUST contain EXACT quotes from script (not paraphrased)
4. **Character names**: MUST match EXACTLY as they appear in script
5. **Primary source**: masterContext is PRIMARY - extraction is fallback only

### ❌ MUST NOT DO

1. **Don't skip analysis**: Never import script without running `performDeepAnalysis()`
2. **Don't paraphrase**: Script descriptions must be exact quotes
3. **Don't modify names**: Character names must match script exactly
4. **Don't use extraction as primary**: Regex extraction is fallback, not primary source

## Benefits

### For Hair/Makeup Department

1. **Exact References**: Script descriptions provide exact quotes for character appearance
2. **Physical Details**: Complete physical profile (age, build, hair, eyes, features)
3. **Styling Guide**: Visual profile explains grooming, makeup style, inspirations
4. **Continuity Tracking**: Automatic tracking of injuries, changes, transformations
5. **Environmental Awareness**: Know which scenes have wind, rain, mud affecting hair/makeup
6. **Emotional Preparation**: Know which scenes require crying makeup, exhaustion, etc.
7. **Timeline Clarity**: Story day mapping prevents continuity errors
8. **Interaction Awareness**: Know which scenes have fights, kisses, physical contact

### For Production

1. **Single Analysis**: AI analyzes script once (cost-effective)
2. **Persistent Data**: Survives page refresh via localStorage
3. **Fast Access**: In-memory for instant retrieval
4. **Comprehensive Coverage**: Every character, every scene analyzed
5. **Smart Alerts**: Context-aware warnings for critical scenes
6. **Professional Output**: Print-ready character profiles

## Troubleshooting

### masterContext is null
```javascript
// Check if it exists
window.logMasterContextSummary();

// If missing, re-import script
// Or manually restore from localStorage
const stored = localStorage.getItem('masterContext');
if (stored) {
    window.masterContext = JSON.parse(stored);
}
```

### Character data missing
```javascript
// Check if character exists
console.log(window.getAllCharacterNames());

// If missing, verify name matches script exactly
// Character names are case-sensitive
```

### Scene context not showing
```javascript
// Check scene number (1-indexed, not 0-indexed)
const context = window.getSceneContext(15);  // Scene 15
console.log(context);

// If null, masterContext may not have this scene's data
```

## Future Enhancements

### Potential Additions

1. **Line Numbers**: Extract exact line numbers for scriptDescriptions for highlighting
2. **Image References**: Upload reference images for visual profiles
3. **PDF Export**: Export character profiles as PDF lookbooks
4. **Revision Tracking**: Track changes when script is updated
5. **Multi-Camera**: Track different looks for multi-camera days
6. **Cross-Project**: Share character profiles across similar projects

## Version History

- **v2.0-enhanced** (Current): Comprehensive character profiles with physical, visual, and continuity data
- **v1.0**: Basic character and story structure analysis

---

**Last Updated**: 2025-11-14
**Maintained By**: Hair & Makeup Pro Development Team
