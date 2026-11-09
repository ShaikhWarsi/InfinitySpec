// ==============================================================================
// INFINITY // Automated 90-Second Hackathon Demo Sequence
// Lens Studio 5.24 + Snap Spectacles 2024 (Learn AR with SPECS Devpost Hackathon)
// ==============================================================================
// Paste this directly into the Lens Studio Logger Console, or trigger via:
// global.infinityRunFullDemoSequence();
// ==============================================================================

(function() {
    function sleep(ms) {
        return new Promise(function(resolve) {
            var evt = script.createEvent ? script.createEvent("DelayedCallbackEvent") : null;
            if (evt) {
                evt.bind(function() { resolve(); });
                evt.reset(ms / 1000.0);
            } else {
                var start = getTime();
                var updateEvt = script.createEvent("UpdateEvent");
                updateEvt.bind(function() {
                    if (getTime() - start >= ms / 1000.0) {
                        updateEvt.enabled = false;
                        resolve();
                    }
                });
            }
        });
    }

    async function runDemo() {
        print("\n=======================================================");
        print("🎬 [INFINITY DEMO] STARTING 90-SECOND AUTOMATED SHOWCASE");
        print("=======================================================\n");

        // Helper to update voice HUD with narration banner
        function narrate(text, seconds) {
            if (typeof global.infinityVoiceInterimUpdate === "function") {
                global.infinityVoiceInterimUpdate("✦ [DEMO] " + text);
            }
            print("⏱️ [DEMO NARRATION] " + text);
        }

        // ------------------------------------------------------------------
        // ACT 1: BOOT & 6DoF SPATIAL WORKSPACE GROUNDING (0:00 - 0:15)
        // ------------------------------------------------------------------
        narrate("ACT 1: Booting 6DoF Spatial Whiteboard & Virtual Desk...", 4.0);
        await sleep(3500);

        // Calibrate table height
        narrate("Calibrating desk against physical environment mesh...", 3.5);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("table");
        }
        await sleep(4000);

        // Adjust elevation upward
        narrate("Ergonomic height adjustment (+5 cm)...", 3.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("desk up");
        }
        await sleep(3500);

        // ------------------------------------------------------------------
        // ACT 2: SIK FOCUS RING & STUDY NOTE INTERACTION (0:15 - 0:32)
        // ------------------------------------------------------------------
        narrate("ACT 2: SIK Focus Navigation across Quantum study cards...", 3.5);
        await sleep(3000);

        // Step through study cards
        narrate("Focusing Card 1 (Architecture)...", 2.5);
        if (typeof global.infinityFocusNext === "function") global.infinityFocusNext();
        await sleep(3000);

        narrate("Focusing Card 2 (SIK Gaze & Pinch)...", 2.5);
        if (typeof global.infinityFocusNext === "function") global.infinityFocusNext();
        await sleep(3000);

        narrate("Activating Card & Triggering Haptic/Audio Feedback...", 3.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("select");
        }
        await sleep(3500);

        narrate("Focusing Card 3 (Constellation Graph Linking)...", 2.5);
        if (typeof global.infinityFocusNext === "function") global.infinityFocusNext();
        await sleep(3500);

        // ------------------------------------------------------------------
        // ACT 3: CELESTIAL WORKSPACE JUMPS & PERSISTENCE (0:32 - 0:50)
        // ------------------------------------------------------------------
        narrate("ACT 3: Cosmic Jump to 'CREATE' Workspace...", 4.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("create");
        }
        await sleep(5500);

        narrate("Cosmic Jump to 'LEARN' Workspace (Calculus / Curriculum)...", 4.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("learn");
        }
        await sleep(5500);

        narrate("Restoring persistent state -> Jumping back to 'THINK' Lab...", 4.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("think");
        }
        await sleep(5000);

        // ------------------------------------------------------------------
        // ACT 4: VOICE DICTATION & COMPANION DESKTOP SYNC (0:50 - 1:08)
        // ------------------------------------------------------------------
        narrate("ACT 4: Hands-free Voice Dictation in AR...", 3.5);
        if (typeof global.infinityDictateVoiceNote === "function") {
            global.infinityDictateVoiceNote("Wavefunction collapse verified at 432Hz spatial frequency");
        }
        await sleep(5000);

        narrate("Live Desktop Companion WebSocket sync...", 3.5);
        if (typeof global.infinityInjectDesktopSnippet === "function") {
            global.infinityInjectDesktopSnippet("DESKTOP RESEARCH SYNC", "Imported textbook reference notes from VS Code companion.", "Research");
        }
        await sleep(4500);

        // ------------------------------------------------------------------
        // ACT 5: 3D NOTE EDITOR & SPATIAL KEYBOARD (1:08 - 1:20)
        // ------------------------------------------------------------------
        narrate("ACT 5: Opening Volumetric 3D Note Editor & Spatial Keyboard...", 4.0);
        if (typeof global.infinityVoiceCommand === "function") {
            global.infinityVoiceCommand("open editor");
        }
        await sleep(6500);

        // ------------------------------------------------------------------
        // ACT 6: SESSION EXPORT & KNOWLEDGE VAULT MODAL (1:20 - 1:32)
        // ------------------------------------------------------------------
        narrate("ACT 6: Exporting Session Document (Markdown + JSON Vault)...", 4.0);
        if (typeof global.infinityExportSession === "function") {
            global.infinityExportSession();
        }
        await sleep(7000);

        // ------------------------------------------------------------------
        // FINALE: READY FOR SPECTACLES 2024 SUBMISSION (1:32+)
        // ------------------------------------------------------------------
        narrate("✦ INFINITY SPATIAL OS // SHOWCASE COMPLETE ✦", 5.0);
        if (typeof global.infinityPlayAudioChime === "function") {
            global.infinityPlayAudioChime(true);
        }
        print("\n=======================================================");
        print("🎉 [INFINITY DEMO] 90-SECOND DEMO SEQUENCE COMPLETE!");
        print("=======================================================\n");
    }

    // Expose globally
    global.infinityRunFullDemoSequence = runDemo;

    // Set up delayed key or automatic trigger
    print("[INFINITY DEMO] Script loaded! Trigger anytime via: global.infinityRunFullDemoSequence()");
})();

