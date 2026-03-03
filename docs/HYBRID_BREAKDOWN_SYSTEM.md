# Hybrid AI-Assisted + Manual Scene Breakdown System

## Overview

The Hybrid Breakdown System combines AI-powered continuity suggestions with full manual control, giving users the best of both worlds: intelligent automation with complete oversight.

## Key Features

### 1. AI-Generated Suggestions
- Analyzes narrative context to generate intelligent continuity suggestions
- Identifies injuries, hair/makeup changes, wardrobe, emotional states
- Provides confidence scores for each suggestion
- Shows source scene and progression information

### 2. Manual Control
- Accept, reject, or edit any AI suggestion
- Add custom continuity items at any time
- Full control over what gets included in breakdown
- Delete or modify any item

### 3. Scene-by-Scene Review
- Navigate through scenes sequentially
- Track review progress across entire script
- Mark scenes as complete
- Visual indicators for review status

### 4. Export with Audit Trail
- HTML report with full breakdown
- JSON export with complete metadata
- CSV export for scene summaries
- Detailed continuity CSV with all items

## How to Use

### Step 1: Generate AI Suggestions

1. Import your script and run narrative analysis first
2. Open the **Tools** panel (button in top toolbar)
3. Under **AI-ASSISTED BREAKDOWN**, click **"Generate AI Suggestions"**
4. Wait for AI to analyze all scenes and generate suggestions

### Step 2: Start Scene Review

1. Open **Tools** panel
2. Click **"Start Scene Review"**
3. The system will navigate to Scene 1 and enter hybrid mode

### Step 3: Review Suggestions for Each Scene

For each scene, you'll see:

#### AI Suggestions (Yellow Border)
- Pending suggestions that need your review
- Character name, category, and description
- Confidence score (if available)
- Three action buttons:
  - **✓ Accept** - Add to confirmed items
  - **✏️ Edit** - Modify and accept
  - **✗ Reject** - Mark as not applicable

#### Confirmed Items (Green Border)
- AI suggestions you've accepted
- Shows source (AI or AI-Edited)
- Can be deleted if needed

#### Your Additions (Purple Border)
- Custom items you've added manually
- Full control over all fields
- Can be deleted or modified

### Step 4: Add Manual Items

1. Click **"+ Add Item"** button in "Your Additions" section
2. Fill in the form:
   - **Character**: Select from detected characters
   - **Category**: Injury, Hair, Makeup, Wardrobe, Condition, Props, Other
   - **Description**: Detailed description of continuity element
   - **Duration**: How long it lasts (optional)
   - **Importance**: Priority level 1-10 (optional)
   - **Notes**: Additional details (optional)
3. Click **"Add Item"**

### Step 5: Navigate Between Scenes

Use the navigation bar at the bottom:
- **← Previous Scene** - Go to previous scene
- **Mark Complete** - Mark current scene as reviewed and advance
- **Next Scene →** - Go to next scene

### Step 6: Export Your Breakdown

Open **Tools** panel and choose an export format:

- **Export Hybrid Report (HTML)** - Beautiful formatted report with all details
- **Export Hybrid Data (JSON)** - Complete data structure for integration
- **Export Continuity (CSV)** - Spreadsheet of all continuity items

## Workflow Examples

### Accept All Suggestions
If AI suggestions look good:
1. Click **"Accept All Pending"** button
2. Review confirmed items
3. Add any missing manual items
4. Click **"Mark Complete"**

### Selective Review
For more control:
1. Review each suggestion individually
2. Accept the good ones
3. Edit any that need adjustment
4. Reject any that are incorrect
4. Add manual items for anything AI missed
5. Click **"Mark Complete"**

### Manual Only
To add items without using AI:
1. Ignore or reject AI suggestions
2. Click **"+ Add Item"** for each continuity element
3. Fill in all details manually
4. Click **"Mark Complete"** when done

## Data Management

### Clearing Data

To reset the hybrid breakdown system:
1. Open **Tools** panel
2. Under **AI-ASSISTED BREAKDOWN**, click **"Clear Hybrid Data"**
3. Confirm the action
4. All suggestions and review progress will be deleted

### Persistence

All data is automatically saved to browser localStorage:
- Suggestions are preserved between sessions
- Review status is maintained
- Confirmed and manual items are saved
- Can safely close and reopen browser

## Visual Indicators

### Suggestion States
- **Yellow border** - Pending review
- **Green border + faded** - Accepted
- **Red border + strikethrough** - Rejected
- **Blue border** - Being edited

### Review Status Badges
- **NOT STARTED** (Gray) - Scene not yet reviewed
- **IN PROGRESS** (Yellow) - Scene currently being reviewed
- **COMPLETED** (Green) - Scene review finished

### Category Colors
- **Red** - Injuries
- **Purple** - Hair
- **Pink** - Makeup
- **Blue** - Wardrobe
- **Yellow** - Condition
- **Green** - Props

## Integration with Existing System

The hybrid breakdown system:
- Works alongside the enhanced workflow system
- Auto-activates when suggestions exist
- Falls back to standard breakdown when not in use
- Exports integrate with existing breakdown exports

## Troubleshooting

### No Suggestions Generated
- Ensure narrative analysis has been run first
- Check that AI settings are configured (API key set)
- Verify script has been imported properly

### Hybrid Mode Not Showing
- Click **"Generate AI Suggestions"** first
- Check browser console for errors
- Ensure localStorage is enabled

### Export Not Working
- Check that scenes have been reviewed
- Verify browser allows downloads
- Try different export format

## Tips for Best Results

1. **Run Narrative Analysis First** - Provides context for better suggestions
2. **Review Scene by Scene** - Systematic approach catches everything
3. **Use Importance Ratings** - Helps prioritize during production
4. **Add Notes Liberally** - Future you will thank present you
5. **Export Multiple Formats** - Have backups in different formats
6. **Mark Scenes Complete** - Tracks progress through script

## Technical Details

### Files
- `hybrid-breakdown-manager.js` - Core data management
- `hybrid-ui.js` - User interaction functions
- `hybrid-renderer.js` - UI rendering
- `hybrid-export.js` - Export functionality

### Data Structure
```javascript
{
  suggestedContinuity: Map<sceneId, suggestions[]>,
  confirmedContinuity: Map<sceneId, items[]>,
  manualAdditions: Map<sceneId, items[]>,
  sceneReviewStatus: Map<sceneId, ReviewStatus>
}
```

### Storage
- Uses browser localStorage
- Serializes Maps to JSON for storage
- Automatically saves on every change
- Can be cleared via UI

## Future Enhancements

Potential features for future versions:
- Bulk operations (accept/reject multiple)
- Custom suggestion rules
- ML-based confidence scoring
- Cross-scene validation
- Character-focused view
- Timeline visualization
- Collaborative review mode
- Cloud sync

## Support

For issues or feature requests:
1. Check browser console for errors
2. Verify all prerequisites are met
3. Try clearing data and regenerating
4. Report bugs with console logs

---

**Version:** 1.0
**Last Updated:** 2025-11-13
**Compatibility:** Chrome, Firefox, Safari, Edge (latest versions)
