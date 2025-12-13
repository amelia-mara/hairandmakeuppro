# Script Breakdown Page - Gap Analysis Report

**Date:** 2024-12-13
**Status:** Comprehensive Review Complete

---

## Executive Summary

The Script Breakdown page has a solid foundation with most core features implemented. Key gaps exist primarily in:
1. **Import formats** (only paste supported, not file upload)
2. **Scene card background colors** (spec requires INT/EXT + DAY/NIGHT color coding)
3. **Key Identifiers section** (missing from profile - spec requires signature features)
4. **Search highlight in script text** (search works but doesn't highlight matches in center panel)
5. **Export formats** (PDF export incomplete)

---

## Detailed Gap Analysis by Workflow Stage

---

### STAGE 1: SCRIPT IMPORT

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Import button location | Top right header | Top right header | ✅ Implemented | - |
| Paste dialog | Required | Working (textarea modal) | ✅ Implemented | - |
| PDF upload | Required | ❌ Not implemented | **GAP** | High |
| Fountain (.fountain) upload | Required | ❌ Not implemented | **GAP** | Medium |
| Plain text (.txt) upload | Required | ❌ Not implemented | **GAP** | Medium |
| Final Draft (.fdx) upload | Required | ❌ Not implemented | **GAP** | Medium |

**Tasks:**
1. [ ] Add file upload functionality to import modal
2. [ ] Implement PDF screenplay parser
3. [ ] Implement Fountain format parser
4. [ ] Implement FDX (Final Draft XML) parser
5. [ ] Add drag-and-drop support to import modal

---

### STAGE 2: SCRIPT ANALYSIS (AI-Powered)

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Character detection from dialogue | Required | Working | ✅ Implemented | - |
| Character detection from action lines | Required | Working | ✅ Implemented | - |
| Story day detection | Required | Working | ✅ Implemented | - |
| Time cue detection | Required | Working | ✅ Implemented | - |
| CONTINUOUS indicators | Required | Working | ✅ Implemented | - |
| Flashback/flash forward markers | Required | Working | ✅ Implemented | - |
| Script descriptions extraction | Required | Working | ✅ Implemented | - |
| storyDayCue display | Shows detection hint | Working | ✅ Implemented | - |
| storyDayConfidence | Required | Working | ✅ Implemented | - |
| Synopsis generation | Required | Working | ✅ Implemented | - |

**Status:** This stage is well-implemented.

---

### STAGE 3: CHARACTER CONFIRMATION

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Character list review modal | Required | Working | ✅ Implemented | - |
| Scene count per character | Required | Working | ✅ Implemented | - |
| Role classification | Lead/Supporting/Featured/Extra | Partially (main/supporting) | ⚠️ Partial | Low |
| Character merge functionality | Required | Working | ✅ Implemented | - |
| Choose primary name | Required | Working | ✅ Implemented | - |
| Character removal | Required | Working | ✅ Implemented | - |
| Select All / Deselect All | Required | Working | ✅ Implemented | - |

**Tasks:**
1. [ ] Add "Featured" and "Extra" role classifications (currently only main/supporting)

---

### STAGE 4: LEFT PANEL - SCENE LIST

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Search bar | Top of panel | Working | ✅ Implemented | - |
| Scene number search | Required | Working | ✅ Implemented | - |
| Location search | Required | Working | ✅ Implemented | - |
| Content search | Required | Working | ✅ Implemented | - |
| Character name search | Required | Working | ✅ Implemented | - |
| Synopsis search | Required | Working | ✅ Implemented | - |
| Match count display | Required | ❌ Not implemented | **GAP** | Medium |
| **Search highlight in script text** | Required | ❌ Not implemented | **GAP** | High |
| Scene cards display | Required | Working | ✅ Implemented | - |
| Scene number display | Required | Working | ✅ Implemented | - |
| Location (truncated) | Required | Working | ✅ Implemented | - |
| Time of day badge | Required | Working | ✅ Implemented | - |
| Character count badge | Required | Working | ✅ Implemented | - |
| Story day · Time · INT/EXT line | Required | Working | ✅ Implemented | - |
| **Background colors (INT/EXT + DAY/NIGHT)** | See spec table | ❌ Not implemented | **GAP** | High |
| Selected state (gold border) | Required | Working | ✅ Implemented | - |
| Scene count in header | Required | Working | ✅ Implemented | - |
| Escape to clear search | Required | ❌ Not tested | **GAP** | Low |

**Background Color Spec (Missing):**
- INT/DAY → White/default
- EXT/DAY → Yellow tint
- INT/NIGHT → Blue tint
- EXT/NIGHT → Green tint

**Tasks:**
1. [ ] Implement scene card background colors based on INT/EXT + DAY/NIGHT
2. [ ] Add match count display to search results
3. [ ] Highlight search term in script text (center panel)
4. [ ] Verify Escape key clears search

---

### STAGE 5: CENTRE PANEL - TABS

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Tab bar with SCRIPT tab | Required | Working | ✅ Implemented | - |
| Character tabs (one per character) | Required | Working | ✅ Implemented | - |
| Truncated character names | Required | Working | ✅ Implemented | - |
| Category legend | Required | Working | ✅ Implemented | - |
| Zoom In/Out buttons | Required | Working | ✅ Implemented | - |
| Formatted screenplay display | Required | Working | ✅ Implemented | - |
| Tag highlights (color-coded) | Required | Working | ✅ Implemented | - |
| Text selection → tag popup | Required | Working | ✅ Implemented | - |
| Tag popup with category dropdown | Required | Working | ✅ Implemented | - |
| Link to existing character option | Required | Working | ✅ Implemented | - |
| Assign to character dropdown | Required | Working | ✅ Implemented | - |
| Props category | Spec lists | ❌ Not in categories | **GAP** | Medium |
| Vehicles category | Spec lists | ❌ Not in categories | **GAP** | Low |

**Tasks:**
1. [ ] Add "Props" to tagging categories
2. [ ] Add "Vehicles" to tagging categories (if needed)

---

### STAGE 6: RIGHT PANEL - SCENE BREAKDOWN

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Panel header with scene info | Required | Working | ✅ Implemented | - |
| **Timeline section compact layout** | Required | Working | ✅ Implemented | - |
| Story Day dropdown | Required | Working | ✅ Implemented | - |
| Time of Day dropdown | Required | Working | ✅ Implemented | - |
| Note field (time jumps) | Required | Working | ✅ Implemented | - |
| Copy from Previous (←) button | Required | Working | ✅ Implemented | - |
| Copy to Next (→) button | Required | Working | ✅ Implemented | - |
| Confirm (✓) button | Required | Working | ✅ Implemented | - |
| Scene type checkboxes (Fb, Ff, Tj, Dr, Mo) | Required | Working | ✅ Implemented | - |
| Auto-detection hint | Required | Working | ✅ Implemented | - |
| **Characters in scene section** | Required | Working | ✅ Implemented | - |
| Character count badge | Required | Working | ✅ Implemented | - |
| Character name display | Required | Working | ✅ Implemented | - |
| [1st] badge for first appearance | Spec requires | Working ("1st" button) | ✅ Implemented | - |
| [×] Remove from scene button | Required | Working | ✅ Implemented | - |
| **ENTERS WITH fields** | Hair, Makeup, Wardrobe | Working | ✅ Implemented | - |
| **CHANGES toggle** | No Change / Change | Working | ✅ Implemented | - |
| **EXITS WITH display** | Required | Working | ✅ Implemented | - |
| "Same as entry" display | When No Change | Working | ✅ Implemented | - |
| Continuity Events section | Per character | Working | ✅ Implemented | - |
| + Create Event button | Required | Working | ✅ Implemented | - |
| **+ Add Character to Scene** | Required | Working | ✅ Implemented | - |
| Navigation (← Previous / Next →) | Required | Working | ✅ Implemented | - |
| **Right panel scrolls to TOP on scene change** | Required | ❌ Not verified | **GAP** | Medium |

**Tasks:**
1. [ ] Verify right panel scrolls to top when navigating scenes
2. [ ] Ensure auto-scroll behavior is consistent

---

### STAGE 7: CHARACTER PROFILE TABS

#### 7.1 Profile Tab Structure

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Sub-tabs: Profile, Lookbook, Timeline, Events | Required | Working | ✅ Implemented | - |

#### 7.2 Profile Sub-Tab

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| **Order: Physical → Key Identifiers → Visual → Lookbook → Script** | Per spec | Missing Key Identifiers | **GAP** | High |
| Physical Profile (editable form) | Required | Working | ✅ Implemented | - |
| Age, Gender fields | Required | Working | ✅ Implemented | - |
| Hair Colour, Hair Type | Required | Working | ✅ Implemented | - |
| Eye Colour, Skin Tone | Required | Working | ✅ Implemented | - |
| Build, Distinguishing Features | Required | Working | ✅ Implemented | - |
| Notes field | Required | Working | ✅ Implemented | - |
| AI auto-fill from script | Required | Working | ✅ Implemented | - |
| **KEY IDENTIFIERS section** | Required | ❌ Not implemented | **GAP** | **Critical** |
| Signature features with categories | Hair, Skin, Facial Feature, etc. | ❌ Not implemented | **GAP** | **Critical** |
| Source badges (Script/Creative/Continuity) | Required | ❌ Not implemented | **GAP** | High |
| Visual Identity (AI generated) | Required | Working | ✅ Implemented | - |
| Character Vibe | Required | Working | ✅ Implemented | - |
| Visual Approach | Required | Working | ✅ Implemented | - |
| Arc Influence | Required | Working | ✅ Implemented | - |
| Key Visual Moments | Required | Working | ✅ Implemented | - |
| Suggested Colour Palette | Required | Working | ✅ Implemented | - |
| Generate Analysis button | Required | Working | ✅ Implemented | - |
| Lookbook Summary | Required | Working | ✅ Implemented | - |
| Distinct Looks count | Required | Working | ✅ Implemented | - |
| Continuity Events count | Required | Working | ✅ Implemented | - |
| Script Descriptions (collapsible) | Required | Working | ✅ Implemented | - |

**KEY IDENTIFIERS Spec Detail (Missing Feature):**
```
┌─────────────────────────────────────────────────────────────────┐
│ KEY IDENTIFIERS                                        [+ Add]  │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ HAIR   Sharp-eyes, observant                      [Script]  │ │
│ │        How: Natural - emphasise with subtle eye makeup      │ │
│ │        Script: "sharp-eyes" (Scene 2)                       │ │
│ │        Applies: All scenes                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Tasks:**
1. [ ] **Implement KEY IDENTIFIERS section in character profile**
2. [ ] Add identifier categories (Hair, Skin, Facial Feature, Tattoo, Piercing, Scar/Wound, Prosthetic, Accessory, Other)
3. [ ] Add source badges (Script Requirement - red, Creative Choice - blue, Continuity Result - orange)
4. [ ] Add "+ Add" button for manual identifiers
5. [ ] Link identifiers to script references

#### 7.3 Lookbook Sub-Tab

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| View toggle: By Look / By Day | Required | Working | ✅ Implemented | - |
| Compact look cards (default) | Required | Working | ✅ Implemented | - |
| Expandable look cards | Required | Working | ✅ Implemented | - |
| Look name (editable) | Required | Working | ✅ Implemented | - |
| Hair, Makeup, Wardrobe display | Required | Working | ✅ Implemented | - |
| Scene ranges (compressed format) | "1-3, 5-7" format | Working | ✅ Implemented | - |
| Story day grouping | Required | Working | ✅ Implemented | - |
| Continuity events overlay | Required | Working | ✅ Implemented | - |

#### 7.4 Timeline Sub-Tab

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| Horizontal swimlane/Gantt chart | Required | Working | ✅ Implemented | - |
| Scene numbers across top | Required | Working | ✅ Implemented | - |
| Story days shown below scenes | D1, D2, D3 format | Working | ✅ Implemented | - |
| Look rows with colored bars | Required | Working | ✅ Implemented | - |
| Event rows with stage progression | Required | Working | ✅ Implemented | - |
| Row labels fixed on left | Required | Working | ✅ Implemented | - |
| Click scene → Jump to breakdown | Required | Working | ✅ Implemented | - |
| Hover highlights | Required | Working | ✅ Implemented | - |

#### 7.5 Events Sub-Tab

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| List all continuity events | Required | Working | ✅ Implemented | - |
| Auto-detected events | Required | Working | ✅ Implemented | - |
| Event types | injuries, health, SFX, aging, pregnancy, dirt, other | Working | ✅ Implemented | - |
| Event CRUD operations | Required | Working | ✅ Implemented | - |
| Progression generation (AI) | Required | Working | ✅ Implemented | - |
| Event modal (3-column view) | Required | Working | ✅ Implemented | - |
| Generate AI Timeline button | Required | Working | ✅ Implemented | - |
| Export to PDF | Required | ⚠️ Incomplete | **GAP** | Medium |

---

### STAGE 8: ADDITIONAL FEATURES

| Feature | Spec | Current | Status | Priority |
|---------|------|---------|--------|----------|
| **Tools Menu** | Top right header | Working (slide-out panel) | ✅ Implemented | - |
| Export Master Breakdown (TSV/CSV) | Required | ❌ Not implemented | **GAP** | High |
| Export Character Profiles | Required | ⚠️ Partial (HTML only) | **GAP** | Medium |
| Export Continuity Report | Required | ❌ Not implemented | **GAP** | Medium |
| Print View | Required | ❌ Not implemented | **GAP** | Low |
| Project Settings | Required | Working (AI Settings) | ✅ Implemented | - |
| **AI Chat Assistant** | Floating button (bottom right) | ❌ Not implemented | **GAP** | Medium |
| **Auto-Save** | Required | Working | ✅ Implemented | - |
| Version history | Required | Working | ✅ Implemented | - |
| **Keyboard Shortcuts** | See table below | ⚠️ Partial | **GAP** | Medium |

**Keyboard Shortcuts Spec:**
| Shortcut | Action | Status |
|----------|--------|--------|
| ↑ / ↓ | Navigate scenes | ❌ Not implemented |
| Escape | Clear search / Close modal | ⚠️ Partial |
| Ctrl+S | Force save | ❌ Not implemented |
| Ctrl+F | Focus search bar | ❌ Not implemented |

**Tasks:**
1. [ ] Implement TSV/CSV export for Master Breakdown
2. [ ] Implement PDF export for Character Profiles
3. [ ] Implement Continuity Report export
4. [ ] Add Print View functionality
5. [ ] Implement AI Chat Assistant (floating button)
6. [ ] Add keyboard shortcuts (↑↓ for scenes, Ctrl+S, Ctrl+F)

---

## Priority Task List

### Critical (Must Fix)
1. **KEY IDENTIFIERS section** - Core feature missing from character profiles
2. **Scene card background colors** - Visual differentiation for INT/EXT + DAY/NIGHT
3. **Search highlight in script text** - Search works but results not highlighted

### High Priority
1. PDF/Fountain/FDX import formats
2. TSV/CSV Master Breakdown export
3. Key Identifiers with source badges
4. Props tagging category

### Medium Priority
1. Match count in search results
2. Right panel scroll-to-top on navigation
3. AI Chat Assistant
4. Keyboard shortcuts
5. PDF exports for profiles/events
6. Continuity Report export

### Low Priority
1. Vehicles tagging category
2. Print View
3. Featured/Extra role classifications

---

## Data Model Alignment Check

### Current State Object
```javascript
window.breakdownState = {
    // ✅ Matches spec
    scenes: [...],
    sceneBreakdowns: {...},
    confirmedCharacters: Set,
    continuityEvents: {...},

    // ⚠️ Naming differences
    castProfiles: {...},           // Spec calls this 'characters'
    characterStates: {...},        // Per-scene character data

    // ❌ Missing from spec
    keyIdentifiers: {...}          // Need to add for KEY IDENTIFIERS feature
}
```

### Scene Object Alignment
```javascript
// Current implementation ✅ matches spec
scene = {
    number: "1",
    heading: "1 EXT. BEACH - NIGHT",
    content: "...",
    storyDay: "Day 1",
    storyDayNote: null,
    storyTimeOfDay: "Night",
    storyDayConfidence: "high",
    storyDayCue: null,
    isFlashback: false,
    isFlashForward: false,
    isTimeJump: false,
    isDream: false,
    isMontage: false,
    synopsis: "..."
}
```

### Character State Object (Per Scene)
```javascript
// Current implementation ✅ matches spec pattern
characterStates[sceneIndex][characterName] = {
    enterHair: "...",       // Spec: hair (enters with)
    enterMakeup: "...",     // Spec: makeup (enters with)
    enterWardrobe: "...",   // Spec: wardrobe (enters with)
    changeStatus: "no-change|has-changes",  // Spec: hasChange
    changeHair: "...",
    changeMakeup: "...",
    changeWardrobe: "...",
    exitHair: "...",        // Calculated if has changes
    exitMakeup: "...",
    exitWardrobe: "...",
    notes: ""
}
```

---

## Summary Statistics

| Category | Spec Items | Implemented | Gaps |
|----------|------------|-------------|------|
| Stage 1: Import | 6 | 1 | 5 |
| Stage 2: Analysis | 11 | 11 | 0 |
| Stage 3: Characters | 7 | 6 | 1 |
| Stage 4: Scene List | 17 | 13 | 4 |
| Stage 5: Centre Panel | 13 | 11 | 2 |
| Stage 6: Right Panel | 22 | 21 | 1 |
| Stage 7: Profiles | 42 | 37 | 5 |
| Stage 8: Additional | 14 | 5 | 9 |
| **TOTAL** | **132** | **105** | **27** |

**Implementation Coverage: 79.5%**

---

## Recommended Implementation Order

### Sprint 1: Critical Features
1. KEY IDENTIFIERS section (character profile)
2. Scene card background colors
3. Search highlight in script

### Sprint 2: Import/Export
1. File upload for import (PDF, Fountain, FDX)
2. TSV/CSV Master Breakdown export
3. PDF export improvements

### Sprint 3: UX Polish
1. Keyboard shortcuts
2. Match count in search
3. AI Chat Assistant
4. Props/Vehicles categories

### Sprint 4: Reports & Print
1. Continuity Report export
2. Print View
3. Role classification refinements

---

*Report generated: 2024-12-13*
