/**
 * debug-utils.js
 * Debugging utilities for script analysis and character data
 *
 * Helps troubleshoot data flow between:
 * - window.masterContext (legacy)
 * - window.scriptMasterContext (new comprehensive analysis)
 * - localStorage
 * - state object
 */

// Note: We access state and other functions via window or dynamic imports
// to avoid circular dependencies and missing module errors

// ============================================================================
// CONTEXT SYNCHRONIZATION
// ============================================================================

/**
 * Ensure both masterContext and scriptMasterContext are synced
 * The character profile display looks for scriptMasterContext
 * Some legacy code looks for masterContext
 */
window.syncMasterContexts = function() {
    console.log('🔄 Syncing master contexts...');

    // If scriptMasterContext exists but masterContext doesn't, sync
    if (window.scriptMasterContext && !window.masterContext) {
        window.masterContext = window.scriptMasterContext;
        localStorage.setItem('masterContext', JSON.stringify(window.masterContext));
        console.log('✅ Copied scriptMasterContext → masterContext');
    }

    // If masterContext exists but scriptMasterContext doesn't, sync
    if (window.masterContext && !window.scriptMasterContext) {
        window.scriptMasterContext = window.masterContext;
        localStorage.setItem('scriptMasterContext', JSON.stringify(window.scriptMasterContext));
        console.log('✅ Copied masterContext → scriptMasterContext');
    }

    // If both exist, use the newer one (check createdAt)
    if (window.masterContext && window.scriptMasterContext) {
        const masterDate = new Date(window.masterContext.createdAt || 0);
        const scriptMasterDate = new Date(window.scriptMasterContext.createdAt || 0);

        if (masterDate > scriptMasterDate) {
            window.scriptMasterContext = window.masterContext;
            localStorage.setItem('scriptMasterContext', JSON.stringify(window.scriptMasterContext));
            console.log('✅ masterContext is newer, synced to scriptMasterContext');
        } else if (scriptMasterDate > masterDate) {
            window.masterContext = window.scriptMasterContext;
            localStorage.setItem('masterContext', JSON.stringify(window.masterContext));
            console.log('✅ scriptMasterContext is newer, synced to masterContext');
        } else {
            console.log('✅ Both contexts are already in sync');
        }
    }

    // Extract confirmed characters
    if (window.masterContext?.characters) {
        window.confirmedCharacters = Object.keys(window.masterContext.characters);
        console.log(`✅ Extracted ${window.confirmedCharacters.length} confirmed characters`);
    }

    return {
        masterContext: !!window.masterContext,
        scriptMasterContext: !!window.scriptMasterContext,
        confirmedCharacters: window.confirmedCharacters?.length || 0
    };
};

// ============================================================================
// FULL DATA DEBUG
// ============================================================================

/**
 * Comprehensive debug of all data sources
 */
window.debugAllData = function() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     COMPLETE DATA DEBUG REPORT        ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. Check window.masterContext
    console.log('📦 window.masterContext:');
    if (window.masterContext) {
        console.log('  ✅ EXISTS');
        console.log('  Characters:', Object.keys(window.masterContext.characters || {}).length);
        console.log('  Created:', window.masterContext.createdAt);
        console.log('  Character names:', Object.keys(window.masterContext.characters || {}));
    } else {
        console.log('  ❌ NOT FOUND');
    }

    // 2. Check window.scriptMasterContext
    console.log('\n📦 window.scriptMasterContext:');
    if (window.scriptMasterContext) {
        console.log('  ✅ EXISTS');
        console.log('  Characters:', Object.keys(window.scriptMasterContext.characters || {}).length);
        console.log('  Created:', window.scriptMasterContext.createdAt);
        console.log('  Character names:', Object.keys(window.scriptMasterContext.characters || {}));
    } else {
        console.log('  ❌ NOT FOUND');
    }

    // 3. Check window.scriptNarrativeContext
    console.log('\n📊 window.scriptNarrativeContext:');
    if (window.scriptNarrativeContext) {
        console.log('  ✅ EXISTS');
        console.log('  Characters:', window.scriptNarrativeContext.characters?.length || 0);
        if (window.scriptNarrativeContext.characters) {
            console.log('  Character names:', window.scriptNarrativeContext.characters.map(c => c.name));
        }
    } else {
        console.log('  ❌ NOT FOUND');
    }

    // 4. Check localStorage
    console.log('\n💿 localStorage:');
    const lsMaster = localStorage.getItem('masterContext');
    const lsScriptMaster = localStorage.getItem('scriptMasterContext');

    if (lsMaster) {
        try {
            const parsed = JSON.parse(lsMaster);
            console.log('  ✅ masterContext stored');
            console.log('  Characters:', Object.keys(parsed.characters || {}).length);
        } catch (e) {
            console.log('  ⚠️ masterContext exists but parse error:', e);
        }
    } else {
        console.log('  ❌ masterContext not in localStorage');
    }

    if (lsScriptMaster) {
        try {
            const parsed = JSON.parse(lsScriptMaster);
            console.log('  ✅ scriptMasterContext stored');
            console.log('  Characters:', Object.keys(parsed.characters || {}).length);
        } catch (e) {
            console.log('  ⚠️ scriptMasterContext exists but parse error:', e);
        }
    } else {
        console.log('  ❌ scriptMasterContext not in localStorage');
    }

    // 5. Check state
    console.log('\n💾 state object:');
    const state = window.state || {};
    console.log('  Scenes:', state.scenes?.length || 0);
    console.log('  Cast profiles:', Object.keys(state.castProfiles || {}).length);
    console.log('  Confirmed characters:', window.confirmedCharacters?.length || 0);

    // 6. Summary and recommendations
    console.log('\n📋 SUMMARY & RECOMMENDATIONS:');

    if (window.scriptMasterContext || window.masterContext) {
        console.log('  ✅ Character data IS available');
        if (!window.scriptMasterContext && window.masterContext) {
            console.log('  ⚠️ Run window.syncMasterContexts() to sync contexts');
        }
        if (!window.confirmedCharacters) {
            console.log('  ⚠️ Run window.syncMasterContexts() to extract character list');
        }
    } else {
        console.log('  ❌ NO character data available');
        console.log('  → Run initial script analysis to generate character data');
        console.log('  → Click "Initialize AI Context" button in tools panel');
    }

    console.log('\n═══════════════════════════════════════════\n');
};

// ============================================================================
// SCRIPT PROCESSING DEBUG
// ============================================================================

/**
 * Debug version of script processing
 * Shows step-by-step what's happening during import
 */
window.debugProcessScript = async function() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     SCRIPT IMPORT DEBUG                ║');
    console.log('╚════════════════════════════════════════╝\n');

    const scriptInput = document.getElementById('script-input')?.value;
    if (!scriptInput) {
        console.error('❌ No script input found');
        return;
    }

    console.log('✅ 1. Script input exists');
    console.log('   Length:', scriptInput.length, 'characters');

    // Use the existing processScript function
    try {
        console.log('🤖 2. Processing script with existing handler...');

        if (typeof window.processScript === 'function') {
            await window.processScript();
            console.log('✅ 3. Script processed successfully');
        } else {
            console.error('❌ processScript function not available');
            console.log('   Falling back to manual extraction...');
            return await manualCharacterExtraction(scriptInput);
        }

        // Check if initialization succeeded
        const state = window.state || {};
        console.log('   Scenes found:', state.scenes?.length || 0);

        // Try to initialize AI context
        try {
            console.log('🤖 4. Initializing AI context...');

            if (typeof window.initializeAIContext === 'function') {
                const success = await window.initializeAIContext();

                if (success) {
                    console.log('✅ 5. AI Analysis complete');

                    // Check what was created
                    const masterContext = window.scriptMasterContext || window.masterContext;
                    if (masterContext?.characters) {
                        console.log('   Characters found:', Object.keys(masterContext.characters).length);
                        console.log('   Character names:', Object.keys(masterContext.characters));

                        // Ensure both contexts are synced
                        window.masterContext = masterContext;
                        window.scriptMasterContext = masterContext;

                        // Extract character list
                        window.confirmedCharacters = Object.keys(masterContext.characters);
                        console.log('✅ 6. Confirmed characters:', window.confirmedCharacters);

                        // Refresh character tabs
                        if (typeof window.createCharacterTabs === 'function') {
                            window.createCharacterTabs();
                            console.log('✅ 7. Character tabs created');
                        }

                        console.log('\n✅ SUCCESS! Character data is now available.');
                        console.log('   Try clicking on a character tab to view their profile.\n');

                        return masterContext;
                    } else {
                        console.warn('⚠️ AI context initialized but no characters found');
                    }
                } else {
                    console.warn('⚠️ AI context initialization returned false');
                    console.log('   Trying manual extraction...');
                    return await manualCharacterExtraction(scriptInput);
                }
            } else {
                console.warn('⚠️ initializeAIContext not available');
                console.log('   Trying manual extraction...');
                return await manualCharacterExtraction(scriptInput);
            }
        } catch (error) {
            console.error('❌ AI Analysis failed:', error);
            console.log('\n💡 Trying fallback manual extraction...\n');
            return await manualCharacterExtraction(scriptInput);
        }

    } catch (error) {
        console.error('❌ Script processing failed:', error);
        console.log('\n💡 Trying fallback manual extraction...\n');
        return await manualCharacterExtraction(scriptInput);
    }
};

/**
 * Manual character extraction fallback
 * When AI analysis fails, extract characters manually from dialogue
 */
async function manualCharacterExtraction(scriptText) {
    console.log('🔧 Starting manual character extraction...');

    const characters = {};

    // Find all character names from dialogue
    const dialoguePattern = /^([A-Z][A-Z\s\.\-\']+)(\s*\([^\)]*\))?$/gm;
    const matches = scriptText.matchAll(dialoguePattern);

    const foundNames = new Set();

    for (const match of matches) {
        let charName = match[1].trim();
        // Clean up name
        charName = charName.replace(/(\s*\(.*\)|\s*V\.O\.|CONT'D|CONT\.|O\.S\.|O\.C\.)/g, '').trim();

        if (charName && charName.length > 1 && !charName.includes('INT.') && !charName.includes('EXT.')) {
            foundNames.add(charName);
        }
    }

    console.log(`  Found ${foundNames.size} potential characters`);

    // Create basic profile for each
    for (const charName of foundNames) {
        // Look for character description
        const descPattern = new RegExp(`${charName}[^a-zA-Z].*?\\([^)]{10,}\\)`, 'i');
        const descMatch = scriptText.match(descPattern);

        characters[charName] = {
            fullName: charName,
            scriptDescriptions: descMatch ? [{
                text: descMatch[0],
                sceneNumber: 1,
                type: 'introduction'
            }] : [],
            physicalProfile: {
                age: "Not specified",
                build: "Not specified",
                hairColor: "Not specified",
                eyeColor: "Not specified"
            },
            characterAnalysis: {
                role: "supporting",
                personality: "To be analyzed",
                arc: "To be determined"
            },
            visualProfile: {
                overallVibe: "To be determined from script",
                styleChoices: "To be determined from context"
            },
            continuityNotes: {
                keyLooks: "To be identified",
                signature: "To be determined"
            }
        };

        console.log(`  ✓ Created basic profile for: ${charName}`);
    }

    const result = {
        scriptTitle: 'Untitled',
        totalScenes: 0,
        characters: characters,
        storyTimeline: {
            totalDays: 1,
            dayBreakdown: []
        },
        createdAt: new Date().toISOString()
    };

    // Store results
    window.masterContext = result;
    window.scriptMasterContext = result;
    localStorage.setItem('masterContext', JSON.stringify(result));
    localStorage.setItem('scriptMasterContext', JSON.stringify(result));
    window.confirmedCharacters = Object.keys(characters);

    console.log(`✅ Manual extraction complete: ${window.confirmedCharacters.length} characters`);
    console.log('   Character names:', window.confirmedCharacters);

    return result;
}

// ============================================================================
// QUICK TEST FUNCTION
// ============================================================================

/**
 * Test with a simple script
 */
window.testAnalysis = async function() {
    console.log('🧪 Running test with sample script...\n');

    const testScript = `FADE IN:

EXT. FERRY - DAY

The ferry deck pitches gently. Ocean spray mists the air.

EINAR (30s), blond forelock spills above his crisp blue eyes, leans against the railing.

EINAR
Beautiful day.

PETER LAWSON (52), weathered face shows years of outdoor work, joins him.

PETER
That it is.

GWEN LAWSON (25), Peter's daughter, athletic build and determined expression, approaches carrying coffee.

GWEN
Here you go, Dad.

She hands Peter a cup, glances at Einar with curiosity.

FADE OUT.`;

    // Set script input
    const scriptInput = document.getElementById('script-input');
    if (scriptInput) {
        scriptInput.value = testScript;
        console.log('✅ Test script loaded into input field');
    } else {
        console.log('⚠️ Script input field not found, but continuing...');
    }

    // Process it
    const result = await window.debugProcessScript();

    if (result) {
        console.log('\n✅ TEST SUCCESSFUL!');
        console.log('   Characters created:', Object.keys(result.characters || {}).join(', '));
        console.log('\n   Run window.debugAllData() to see full report');
        console.log('   Or click on a character tab to view profile\n');
    }

    return result;
};

// ============================================================================
// FIX FUNCTIONS
// ============================================================================

/**
 * Fix missing character data
 * Runs if characters appear in tabs but profiles are empty
 */
window.fixCharacterData = async function() {
    console.log('🔧 Attempting to fix character data...\n');

    const state = window.state || {};

    // Check if script is loaded
    if (!state.scenes || state.scenes.length === 0) {
        console.error('❌ No script loaded. Import a script first.');
        return false;
    }

    // Check if we have confirmed characters but no master context
    if (window.confirmedCharacters && window.confirmedCharacters.length > 0) {
        if (!window.masterContext?.characters && !window.scriptMasterContext?.characters) {
            console.log('Found character list but no profile data. Re-running analysis...');

            // Use the debug process script
            await window.debugProcessScript();

            console.log('✅ Analysis complete. Character data should now be available.');
            return true;
        }
    }

    // Try to sync contexts
    const syncResult = window.syncMasterContexts();

    if (syncResult.masterContext && syncResult.scriptMasterContext) {
        console.log('✅ Contexts synced successfully');
        return true;
    }

    console.log('❌ Could not fix character data automatically.');
    console.log('   Run window.testAnalysis() to test with sample script');
    console.log('   Or run window.debugAllData() to see what data exists');

    return false;
};

// ============================================================================
// AUTO-SYNC ON LOAD
// ============================================================================

// Automatically sync contexts when this module loads
setTimeout(() => {
    if (window.masterContext || window.scriptMasterContext) {
        console.log('🔄 Auto-syncing master contexts on load...');
        window.syncMasterContexts();
    }
}, 1000);

console.log('✅ Debug utilities loaded');
console.log('   Available commands:');
console.log('   - window.debugAllData() - Complete data report');
console.log('   - window.debugProcessScript() - Debug script import');
console.log('   - window.testAnalysis() - Test with sample script');
console.log('   - window.syncMasterContexts() - Sync data contexts');
console.log('   - window.fixCharacterData() - Attempt to fix missing data');
console.log('   - window.debugCharacterProfile(name) - Debug specific character');
