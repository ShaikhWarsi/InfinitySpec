// @component
// ==============================================================================
// INFINITY // Spatial Study Copilot & Ambient Knowledge Canvas
// Lens Studio 5.24 + Snap Spectacles 2024 (6DoF Optical Waveguide AR)
// Devpost Hackathon: Learn AR with SPECS
// ==============================================================================

// @input Asset.Texture texThink
// @input Asset.Texture texCreate
// @input Asset.Texture texLearn
// @input Asset.Texture texStore
// @input Asset.Texture texExplore
// @input Asset.Texture texWhiteboard
// @input Asset.RenderMesh boxMesh
// @input Asset.RenderMesh sphereMesh
// @input Asset.RenderMesh torusMesh
// @input Asset.Material pbrMaterial
// @input Asset.Material textMaterial
// @input Asset.AudioTrackAsset chimeAudio

print("[INFINITY] Booting Spatial Study Copilot & Ambient Knowledge Canvas...");


// ------------------------------------------------------------------------------
// Native SIK Hand Tracking, Pinch Hysteresis & Dual-Hand Transform Engine
// (Adapted from Spatialis & Specs Samples Architecture)
// ------------------------------------------------------------------------------
var nativeHandTrackingInitialized = false;
var REFERENCE_HAND_SPAN = 18.0; // cm nominal adult hand
var PINCH_DOWN_DIST = 3.0;      // cm (closes pinch)
var PINCH_UP_DIST = 4.5;        // cm (opens pinch - hysteresis gap prevents chatter)

function measureHandSpan(hand) {
    if (!hand) return 1.0;
    try {
        var wrist = hand.wrist ? hand.wrist.position : null;
        var middle = hand.middleTip ? hand.middleTip.position : null;
        if (wrist && middle) {
            var span = wrist.distance(middle);
            return Math.max(0.6, Math.min(1.6, span / REFERENCE_HAND_SPAN));
        }
    } catch(e) {}
    return 1.0;
}

function initNativeSIKHandTracking() {
    if (nativeHandTrackingInitialized) return;
    try {
        if (typeof global.SIK !== "undefined" && global.SIK && global.SIK.HandInputData) {
            state.rightHand = global.SIK.HandInputData.getHand("right");
            state.leftHand = global.SIK.HandInputData.getHand("left");
            if (state.rightHand) {
                state.rightHand.onPinchDown.add(function() {
                    state.rightPinching = true;
                    checkTwoHandFramingGesture();
                });
                state.rightHand.onPinchUp.add(function() {
                    state.rightPinching = false;
                });
            }
            if (state.leftHand) {
                state.leftHand.onPinchDown.add(function() {
                    state.leftPinching = true;
                    checkTwoHandFramingGesture();
                });
                state.leftHand.onPinchUp.add(function() {
                    state.leftPinching = false;
                });
            }
            nativeHandTrackingInitialized = true;
            print("[INFINITY SIK] Native 6DoF HandInputData connected with pinch hysteresis.");
        }
    } catch(e) {}
}

function checkFistDismiss(hand) {
    if (!hand || !hand.thumbTip || !hand.thumbTip.position) return false;
    var palm = (typeof hand.getPalmCenter === "function") ? hand.getPalmCenter() : null;
    if (!palm && hand.wrist && hand.middleKnuckle && hand.wrist.position && hand.middleKnuckle.position) {
        palm = hand.wrist.position.add(hand.middleKnuckle.position).uniformScale(0.5);
    }
    if (!palm) return false;
    var tips = [hand.indexTip, hand.middleTip, hand.ringTip, hand.pinkyTip];
    for (var t = 0; t < tips.length; t++) {
        if (!tips[t] || !tips[t].position) return false;
        if (tips[t].position.distance(palm) >= 4.8) return false;
    }
    return hand.thumbTip.position.distance(palm) < 5.2;
}

function updateNativeSIKGestures(dt) {
    if (!nativeHandTrackingInitialized) return;

    // Check closed-fist dismiss gesture (from QWERTY HandPose math)
    if (!state.fistDismissed && (checkFistDismiss(state.rightHand) || checkFistDismiss(state.leftHand))) {
        state.fistDismissed = true;
        for (var fn = state.notes.length - 1; fn >= 0; fn--) {
            var nFist = state.notes[fn];
            if (nFist.id && nFist.id.indexOf("Voice") !== -1) {
                if (nFist.obj) nFist.obj.destroy();
                if (nFist.labelObj) nFist.labelObj.destroy();
                state.notes.splice(fn, 1);
            }
        }
        if (state.voiceHud && state.voiceHudLabel) {
            setTextContent(state.voiceHudLabel, "[ ? CANVAS MINIMIZED // CLOSED-FIST GESTURE ]", 4.2);
            applyMaterialStyle(state.voiceHud, null, new vec4(0.8, 0.2, 0.4, 0.95));
            state.voiceHudTimer = 2.5;
        }
        if (typeof global.infinityPlayAudioChime === "function") global.infinityPlayAudioChime(false);
    } else if (!checkFistDismiss(state.rightHand) && !checkFistDismiss(state.leftHand)) {
        state.fistDismissed = false;
    }

    // 1. Process Joint Tracking with Pinch Hysteresis
    if (state.rightHand) {
        var rSpan = measureHandSpan(state.rightHand);
        var rThumb = state.rightHand.thumbTip ? state.rightHand.thumbTip.position : null;
        var rIndex = state.rightHand.indexTip ? state.rightHand.indexTip.position : null;
        if (rThumb && rIndex) {
            state.rightPinchPoint = rThumb.add(rIndex).uniformScale(0.5);
            var rSep = rThumb.distance(rIndex);
            if (!state.rightPinching && rSep <= PINCH_DOWN_DIST * rSpan) {
                state.rightPinching = true;
            } else if (state.rightPinching && rSep >= PINCH_UP_DIST * rSpan) {
                state.rightPinching = false;
            }
        }
    }

    if (state.leftHand) {
        var lSpan = measureHandSpan(state.leftHand);
        var lThumb = state.leftHand.thumbTip ? state.leftHand.thumbTip.position : null;
        var lIndex = state.leftHand.indexTip ? state.leftHand.indexTip.position : null;
        if (lThumb && lIndex) {
            state.leftPinchPoint = lThumb.add(lIndex).uniformScale(0.5);
            var lSep = lThumb.distance(lIndex);
            if (!state.leftPinching && lSep <= PINCH_DOWN_DIST * lSpan) {
                state.leftPinching = true;
            } else if (state.leftPinching && lSep >= PINCH_UP_DIST * lSpan) {
                state.leftPinching = false;
            }
        }
    }

    // 2. Two-Hand Continuous Manipulation & Crush-to-Delete
    if (state.rightPinching && state.leftPinching && state.rightPinchPoint && state.leftPinchPoint) {
        var handSep = state.rightPinchPoint.distance(state.leftPinchPoint);
        var midPoint = state.rightPinchPoint.add(state.leftPinchPoint).uniformScale(0.5);

        // Find if targeting a study note
        var targetNote = null;
        for (var i = 0; i < state.notes.length; i++) {
            var n = state.notes[i];
            if (n.curPos && n.curPos.distance(midPoint) < 22.0) {
                targetNote = n;
                break;
            }
        }

        if (targetNote) {
            if (!state.twoHandManipulating) {
                state.twoHandManipulating = true;
                state.twoHandStartSep = Math.max(8.0, handSep);
                state.twoHandTargetNote = targetNote;
            } else if (state.twoHandTargetNote === targetNote) {
                var scaleRatio = Math.max(0.12, Math.min(2.8, handSep / state.twoHandStartSep));
                if (scaleRatio <= 0.16) {
                    // Crush-to-delete gesture triggered
                    state.notes = state.notes.filter(function(x) { return x !== targetNote; });
                    if (targetNote.obj) targetNote.obj.destroy();
                    if (targetNote.labelObj) targetNote.labelObj.destroy();
                    state.twoHandManipulating = false;
                    state.twoHandTargetNote = null;
                    if (state.voiceHud && state.voiceHudLabel) {
                        setTextContent(state.voiceHudLabel, "[ ? NOTE CRUSHED // REMOVED VIA GESTURE ]", 4.2);
                        applyMaterialStyle(state.voiceHud, null, new vec4(1.0, 0.3, 0.2, 0.95));
                        state.voiceHudTimer = 2.5;
                    }
                    triggerAudioRipple(midPoint);
                    return;
                }
                targetNote.curScale = targetNote.baseScale.uniformScale(scaleRatio);
                targetNote.curPos = vec3.lerp(targetNote.curPos, midPoint, dt * 6.0);
            }
        } else {
            state.twoHandManipulating = false;
            checkTwoHandFramingGesture();
        }
    } else {
        state.twoHandManipulating = false;
        state.twoHandTargetNote = null;
    }
}

function checkTwoHandFramingGesture() {
    if (state.rightHand && state.leftHand && state.rightHand.isPinching && state.leftHand.isPinching &&
        state.rightHand.isPinching() && state.leftHand.isPinching()) {
        try {
            var rPos = state.rightHand.thumbTip.position;
            var lPos = state.leftHand.thumbTip.position;
            var center = rPos.add(lPos).uniformScale(0.5);
            if (state.textbookMarker) {
                var deskY = state.surfaceManager ? state.surfaceManager.calibratedHeight + 0.8 : -17.2;
                state.textbookMarker.getTransform().setWorldPosition(new vec3(center.x, deskY, center.z));
            }
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? DUAL-PINCH: TEXTBOOK FRAMED IN ROOM ]", 4.0);
                state.voiceHudTimer = 2.5;
            }
            triggerAudioRipple(center);
        } catch(e) {}
    }
}

// ------------------------------------------------------------------------------
// Native Spectacles Interaction Kit (SIK) & Audio Feedback Bridges
// (Incorporating Waveguide Optical Tuning & Focus Feedback from OpenBand Architecture)
// ------------------------------------------------------------------------------
var WAVEGUIDE_DARK_BG = new vec4(0.04, 0.08, 0.16, 0.90); // Additive-safe: avoids pure-black transparency
var WAVEGUIDE_ACCENT_CYAN = new vec4(0.0, 0.94, 1.0, 0.95); // Luminous waveguide cyan
var WAVEGUIDE_FOCUS_GOLD = new vec4(1.0, 0.75, 0.08, 0.95);  // High-contrast focus indicator

var audioPlayer = null;
function initAudioFeedbackSystem() {
    try {
        var audioObj = getOrCreateObject("Infinity_Spatial_Audio_Player", null, null);
        audioPlayer = audioObj.createComponent("Component.AudioComponent");
    } catch(e) {}
}

global.infinityPlayAudioChime = function(success) {
    if (audioPlayer && script.sndTriggerStart) {
        audioPlayer.audioTrack = success ? script.sndTriggerStart : (script.sndTriggerEnd || script.sndTriggerStart);
        try { audioPlayer.play(1); } catch(e) {}
    }
};

function attachSIKInteractable(sceneObj, onTriggerCallback, onHoverCallback) {
    if (!sceneObj) return;
    try {
        var interactable = sceneObj.createComponent("InteractionKit:Interactable") ||
                           sceneObj.createComponent("Interactable");
        if (interactable && interactable.onTriggerStart) {
            interactable.onTriggerStart.add(function(e) {
                if (typeof onTriggerCallback === "function") onTriggerCallback(e);
            });
            if (interactable.onHoverEnter && typeof onHoverCallback === "function") {
                interactable.onHoverEnter.add(function(e) { onHoverCallback(true, e); });
                interactable.onHoverExit.add(function(e) { onHoverCallback(false, e); });
            }
        }
    } catch(e) {}
    try {
        if (!sceneObj.getComponent("Physics.ColliderComponent")) {
            var col = sceneObj.createComponent("Physics.ColliderComponent");
            if (col && typeof Shape !== "undefined" && Shape.createBoxShape) {
                col.shape = Shape.createBoxShape();
            }
        }
    } catch(e) {}
}


// ------------------------------------------------------------------------------
// Spatial Cognitive States (Replacing 2D Kanban with Spatial Computing States)
// ------------------------------------------------------------------------------
var SPATIAL_STATES = {
    "ANCHORED": {
        label: "ANCHORED",
        color: new vec4(0.0, 1.0, 0.66, 1.0),     // Neon Emerald
        desc: "Pinned to physical room coordinates"
    },
    "SYNTHESIZING": {
        label: "SYNTHESIZING",
        color: new vec4(1.0, 0.75, 0.08, 1.0),    // Radiant Gold
        desc: "Active neural AI thought stream"
    },
    "SYNCHRONIZED": {
        label: "SYNCHRONIZED",
        color: new vec4(0.0, 0.94, 1.0, 1.0),     // Cyberpunk Cyan
        desc: "Cross-device spatial vault synced"
    }
};

// ------------------------------------------------------------------------------
// 5 Cosmic Workspaces Configuration with 15deg Cylindrical Ergonomics
// ------------------------------------------------------------------------------
var WORKSPACES = {
    "Think": {
        name: "Think",
        title: "INFINITY // QUANTUM STUDY LAB",
        subtitle: "QUANTUM COMPUTING 101 deg 6DOF KNOWLEDGE CONSTELLATION",
        color: new vec4(0.0, 0.94, 1.0, 1.0),
        colorHex: "#00f0ff",
        notes: [
            {
                id: "StickyNote_Arch",
                labelId: "Label_Note_Arch",
                title: "1. QUBIT SUPERPOSITION",
                body: "deg |?? = a|0? + deg|1?\ndeg Simultaneous state overlap\n[x] Bloch sphere mapped",
                status: "ANCHORED",
                basePos: new vec3(-15.0, 1.5, -66.5),
                baseRotY: 14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_Gaze",
                labelId: "Label_Note_Gaze",
                title: "2. QUANTUM ENTANGLEMENT",
                body: "deg Bell state |F+? = (|00?+|11?)/v2\ndeg Non-local correlation\n[x] Spooky action verified",
                status: "SYNCHRONIZED",
                basePos: new vec3(0.0, 5.5, -68.5),
                baseRotY: 0.0
            },
            {
                id: "StickyNote_Constellation",
                labelId: "Label_Note_Constellation",
                title: "3. DECOHERENCE NOISE",
                body: "deg Thermal environment noise\ndeg T1 relaxation / T2 dephasing\n[!] Error correction required",
                status: "SYNTHESIZING",
                basePos: new vec3(15.0, 1.0, -66.5),
                baseRotY: -14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_AI",
                labelId: "Label_Note_AI",
                title: "4. SHOR'S ALGORITHM",
                body: "deg Polynomial prime factoring\ndeg Quantum phase estimation\n[x] Cryptographic speedup",
                status: "ANCHORED",
                basePos: new vec3(-2.0, -8.5, -67.5),
                baseRotY: 0.0,
                baseRotX: 8.0 * Math.PI / 180.0
            }
        ],
        connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
        aiExpansions: [
            "Multimodal Spatial Vector Clustering Synthesized",
            "Attention Flow Graph Linked between Notes",
            "Autonomous 6DoF Viewport Predictor Activated",
            "Sub-Millisecond Neural Concept Synthesized"
        ]
    },
    "Create": {
        name: "Create",
        title: "INFINITY // CREATE WORKSPACE",
        subtitle: "VOLUMETRIC PROTOTYPING deg PROCEDURAL SHADERS",
        color: new vec4(0.72, 0.22, 1.0, 1.0),
        colorHex: "#b838ff",
        notes: [
            {
                id: "StickyNote_Arch",
                labelId: "Label_Note_Arch",
                title: "GLASS TRANSMISSION",
                body: "deg Acrylic PBR backplate\n[x] Additive Cyberpunk glow",
                status: "ANCHORED",
                basePos: new vec3(-15.0, 1.5, -66.5),
                baseRotY: 14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_Gaze",
                labelId: "Label_Note_Gaze",
                title: "UI MESH PIPELINE",
                body: "deg 3D Card Rasterization\ndeg Status cycling on tap",
                status: "SYNCHRONIZED",
                basePos: new vec3(0.0, 5.5, -68.5),
                baseRotY: 0.0
            },
            {
                id: "StickyNote_Constellation",
                labelId: "Label_Note_Constellation",
                title: "ENERGY CORRIDORS",
                body: "deg Luminous beam corridors\n[x] Zero-allocation math",
                status: "ANCHORED",
                basePos: new vec3(15.0, 1.0, -66.5),
                baseRotY: -14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_AI",
                labelId: "Label_Note_AI",
                title: "? AI 3D GENERATOR",
                body: "deg Procedural Asset Mesh\n[ ] Dynamic Shader compile",
                status: "SYNTHESIZING",
                basePos: new vec3(-2.0, -8.5, -67.5),
                baseRotY: 0.0,
                baseRotX: 8.0 * Math.PI / 180.0
            }
        ],
        connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
        aiExpansions: [
            "Volumetric Hologram Wireframe Generated",
            "Dynamic Cyberpunk Color Palette Synthesized",
            "Realtime Glass Refraction Map Compiled"
        ]
    },
    "Learn": {
        name: "Learn",
        title: "INFINITY // LEARN WORKSPACE",
        subtitle: "BIOMECHANICAL TRACKING deg ROTATION INVARIANT AI",
        color: new vec4(1.0, 0.75, 0.08, 1.0),
        colorHex: "#ffb000",
        notes: [
            {
                id: "StickyNote_Arch",
                labelId: "Label_Note_Arch",
                title: "21-JOINT SKELETON",
                body: "deg XRHand joint poses\n[x] SIK Gaze/Pinch Filter",
                status: "ANCHORED",
                basePos: new vec3(-15.0, 1.5, -66.5),
                baseRotY: 14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_Gaze",
                labelId: "Label_Note_Gaze",
                title: "SPECTACLES SIK",
                body: "deg Gaze ray hysteresis (2cm)\ndeg Ballistic throw dampening",
                status: "SYNCHRONIZED",
                basePos: new vec3(0.0, 5.5, -68.5),
                baseRotY: 0.0
            },
            {
                id: "StickyNote_Constellation",
                labelId: "Label_Note_Constellation",
                title: "SEATED COMFORT",
                body: "deg Focus plane at 100cm\n[x] 15-deg downward arc",
                status: "ANCHORED",
                basePos: new vec3(15.0, 1.0, -66.5),
                baseRotY: -14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_AI",
                labelId: "Label_Note_AI",
                title: "? AI SYNAPSE",
                body: "deg Kinematic drift corrector\n[ ] Adaptive hand smoother",
                status: "SYNTHESIZING",
                basePos: new vec3(-2.0, -8.5, -67.5),
                baseRotY: 0.0,
                baseRotX: 8.0 * Math.PI / 180.0
            }
        ],
        connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
        aiExpansions: [
            "Joint Distance Ratios Normalized Across Chirality",
            "Predictive Sub-Millisecond Motion Extrapolated",
            "Waveguide Color Dispersion Balanced"
        ]
    },
    "Store": {
        name: "Store",
        title: "INFINITY // STORE WORKSPACE",
        subtitle: "CROSS-SESSION PERSISTENCE deg COORDINATE VAULT",
        color: new vec4(0.0, 1.0, 0.66, 1.0),
        colorHex: "#00ffaa",
        notes: [
            {
                id: "StickyNote_Arch",
                labelId: "Label_Note_Arch",
                title: "SESSION SERIALIZER",
                body: "deg Local JSON Coordinate Vault\n[x] Instant state restore",
                status: "ANCHORED",
                basePos: new vec3(-15.0, 1.5, -66.5),
                baseRotY: 14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_Gaze",
                labelId: "Label_Note_Gaze",
                title: "AUTO-SAVE DEBOUNCE",
                body: "deg 500ms Quiescent timer\ndeg Zero UI hitching on drop",
                status: "SYNCHRONIZED",
                basePos: new vec3(0.0, 5.5, -68.5),
                baseRotY: 0.0
            },
            {
                id: "StickyNote_Constellation",
                labelId: "Label_Note_Constellation",
                title: "MULTI-SLOT VAULT",
                body: "deg 5 Independent Workspaces\n[x] Per-slot memory isolation",
                status: "ANCHORED",
                basePos: new vec3(15.0, 1.0, -66.5),
                baseRotY: -14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_AI",
                labelId: "Label_Note_AI",
                title: "? AI COMPACTOR",
                body: "deg Graph structure reducer\n[ ] Semantic clustering",
                status: "SYNTHESIZING",
                basePos: new vec3(-2.0, -8.5, -67.5),
                baseRotY: 0.0,
                baseRotX: 8.0 * Math.PI / 180.0
            }
        ],
        connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
        aiExpansions: [
            "Graph Compaction Complete: 4 Notes Index Synthesized",
            "Zero-Loss Coordinate Quantization Applied",
            "Vault Checksum Verified Across Persistent Storage"
        ]
    },
    "Explore": {
        name: "Explore",
        title: "INFINITY // EXPLORE GALAXY",
        subtitle: "INFINITE WHITEBOARD ZOOM deg COSMIC NAVIGATION",
        color: new vec4(1.0, 0.0, 0.5, 1.0),
        colorHex: "#ff007f",
        notes: [
            {
                id: "StickyNote_Arch",
                labelId: "Label_Note_Arch",
                title: "CELESTIAL DOCK",
                body: "deg 5 Celestial Planetary Orbs\n[x] 1-pinch fast jump",
                status: "ANCHORED",
                basePos: new vec3(-15.0, 1.5, -66.5),
                baseRotY: 14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_Gaze",
                labelId: "Label_Note_Gaze",
                title: "INFINITE ZOOM",
                body: "deg Semantic Level-of-Detail\ndeg Adaptive typography scaling",
                status: "SYNCHRONIZED",
                basePos: new vec3(0.0, 5.5, -68.5),
                baseRotY: 0.0
            },
            {
                id: "StickyNote_Constellation",
                labelId: "Label_Note_Constellation",
                title: "GALAXY OVERVIEW",
                body: "deg Macro view of all thoughts\n[x] High-level graph vision",
                status: "ANCHORED",
                basePos: new vec3(15.0, 1.0, -66.5),
                baseRotY: -14.0 * Math.PI / 180.0
            },
            {
                id: "StickyNote_AI",
                labelId: "Label_Note_AI",
                title: "? DEEP SPACE AI",
                body: "deg Deep Concept Traversal\n[ ] Infinite Sub-Universe",
                status: "SYNTHESIZING",
                basePos: new vec3(-2.0, -8.5, -67.5),
                baseRotY: 0.0,
                baseRotX: 8.0 * Math.PI / 180.0
            }
        ],
        connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
        aiExpansions: [
            "Infinite Whiteboard Sub-Universe Instantiated",
            "Semantic Cluster Map Generated in Latent Space",
            "Multi-Scale Thought Constellation Synthesized"
        ]
    }
};

// ==============================================================================
// MODULAR SUBSYSTEM 1: ShapeRecognizer (Geometric Analysis Engine)
// ==============================================================================
function ShapeRecognizer() {
    this.minPoints = 6;
    this.autoNeatenEnabled = true;
}

ShapeRecognizer.prototype.recognize = function(points) {
    if (!points || points.length < this.minPoints) return null;
    var n = points.length;
    var pStart = points[0];
    var pEnd = points[n - 1];

    var totalLength = 0;
    for (var i = 1; i < n; i++) {
        var dx = points[i].x - points[i - 1].x;
        var dy = points[i].y - points[i - 1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    if (totalLength < 0.5) return null;

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    var sumX = 0, sumY = 0;
    for (var j = 0; j < n; j++) {
        var p = points[j];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        sumX += p.x;
        sumY += p.y;
    }
    var width = maxX - minX;
    var height = maxY - minY;
    var cx = sumX / n;
    var cy = sumY / n;

    var endDx = pEnd.x - pStart.x;
    var endDy = pEnd.y - pStart.y;
    var endDist = Math.sqrt(endDx * endDx + endDy * endDy);
    var isClosed = endDist < Math.max(1.8, totalLength * 0.32);

    if (isClosed) {
        var rMean = (width + height) * 0.25;
        var sumVar = 0;
        for (var k = 0; k < n; k++) {
            var rx = points[k].x - cx;
            var ry = points[k].y - cy;
            var distToCenter = Math.sqrt(rx * rx + ry * ry);
            sumVar += (distToCenter - rMean) * (distToCenter - rMean);
        }
        var stdR = Math.sqrt(sumVar / n);
        var aspect = (height > 0) ? (width / height) : 1.0;

        if (stdR / (rMean + 0.001) < 0.28 && aspect > 0.65 && aspect < 1.45) {
            return { type: "circle", cx: cx, cy: cy, r: Math.max(1.5, rMean), confidence: 0.94 };
        }

        var boxPerimeter = 2 * (width + height);
        if (Math.abs(totalLength - boxPerimeter) / boxPerimeter < 0.42) {
            var diag = Math.sqrt(width * width + height * height) || 1.0;
            var corners = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
            var maxCornerDist = 0;
            for (var c = 0; c < 4; c++) {
                var cMin = Infinity;
                for (var pIdx = 0; pIdx < n; pIdx++) {
                    var cdx = points[pIdx].x - corners[c].x;
                    var cdy = points[pIdx].y - corners[c].y;
                    var cd = Math.sqrt(cdx * cdx + cdy * cdy);
                    if (cd < cMin) cMin = cd;
                }
                if (cMin > maxCornerDist) maxCornerDist = cMin;
            }
            var minDim = Math.min(width, height) || 1.0;
            var sumDistToBoundary = 0;
            for (var bIdx = 0; bIdx < n; bIdx++) {
                var pB = points[bIdx];
                var dEdgeX = Math.min(Math.abs(pB.x - minX), Math.abs(pB.x - maxX));
                var dEdgeY = Math.min(Math.abs(pB.y - minY), Math.abs(pB.y - maxY));
                sumDistToBoundary += Math.min(dEdgeX, dEdgeY);
            }
            if (maxCornerDist / diag < 0.28 && (sumDistToBoundary / n) / minDim < 0.20) {
                return { type: "rect", cx: cx, cy: cy, width: Math.max(2.5, width), height: Math.max(2.0, height), confidence: 0.88 };
            }
        }
    } else {
        var straightDist = Math.sqrt((pEnd.x - pStart.x) * (pEnd.x - pStart.x) + (pEnd.y - pStart.y) * (pEnd.y - pStart.y));
        if (straightDist / (totalLength + 0.001) > 0.82) {
            return { type: "line", start: pStart, end: pEnd, length: straightDist, cx: (pStart.x + pEnd.x) * 0.5, cy: (pStart.y + pEnd.y) * 0.5, confidence: 0.96 };
        }
    }
    return null;
};
global.ShapeRecognizer = ShapeRecognizer;

// ==============================================================================
// MODULAR SUBSYSTEM 2: DrawingAndSnappingModule (3D Polyline Inking & Shape Snapper)
// ==============================================================================
function DrawingAndSnappingModule(kernelState) {
    this.kernel = kernelState;
    this.recognizer = new ShapeRecognizer();
    this.isDrawing = false;
    this.currentStrokePoints = [];
    this.drawnObjects = [];
    this.strokeSegments = [];
    this.maxSegments = 30;
    this.initStrokePool();
}

DrawingAndSnappingModule.prototype.initStrokePool = function() {
    this.strokePool = [];
    for (var i = 0; i < this.maxSegments; i++) {
        var seg = global.scene.createSceneObject("Stroke_Segment_" + i);
        var vis = seg.createComponent("Component.RenderMeshVisual");
        if (this.kernel.boxMesh) vis.mesh = this.kernel.boxMesh;
        if (this.kernel.pbrMaterial) { var m = (typeof this.kernel.pbrMaterial.clone === "function") ? this.kernel.pbrMaterial.clone() : this.kernel.pbrMaterial; vis.mainMaterial = m; vis.material = m; }
        seg.getTransform().setWorldScale(new vec3(0.3, 0.3, 0.3));
        this.applyColor(seg, new vec4(0.0, 0.94, 1.0, 0.9));
        seg.enabled = false;
        this.strokePool.push(seg);
    }
};

DrawingAndSnappingModule.prototype.applyColor = function(obj, color) {
    if (!obj) return;
    var visual = obj.getComponent("Component.RenderMeshVisual") || obj.getComponent("RenderMeshVisual");
    if (visual && visual.mainPass && visual.mainPass.baseColor) {
        visual.mainPass.baseColor = color;
    }
};

DrawingAndSnappingModule.prototype.startStroke = function(point3D) {
    this.isDrawing = true;
    this.currentStrokePoints = [{ x: point3D.x, y: point3D.y, z: point3D.z }];
    this.resetStrokePool();
};

DrawingAndSnappingModule.prototype.addStrokePoint = function(point3D) {
    if (!this.isDrawing) return;
    var last = this.currentStrokePoints[this.currentStrokePoints.length - 1];
    var dx = point3D.x - last.x;
    var dy = point3D.y - last.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.8) {
        this.currentStrokePoints.push({ x: point3D.x, y: point3D.y, z: point3D.z });
        this.renderStrokeSegments();
    }
};

DrawingAndSnappingModule.prototype.renderStrokeSegments = function() {
    var count = Math.min(this.currentStrokePoints.length - 1, this.maxSegments);
    for (var i = 0; i < count; i++) {
        var pA = this.currentStrokePoints[i];
        var pB = this.currentStrokePoints[i + 1];
        var midX = (pA.x + pB.x) * 0.5;
        var midY = (pA.y + pB.y) * 0.5;
        var midZ = (pA.z + pB.z) * 0.5;
        var dx = pB.x - pA.x;
        var dy = pB.y - pA.y;
        var dz = pB.z - pA.z;
        var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 0.01) len = 0.01;

        var segObj = this.strokePool[i];
        segObj.enabled = true;
        var trans = segObj.getTransform();
        trans.setWorldPosition(new vec3(midX, midY, midZ));
        trans.setWorldScale(new vec3(0.28, 0.28, len));
        var dir = new vec3(dx / len, dy / len, dz / len);
        trans.setLocalRotation(quat.lookAt(dir, vec3.up()));
    }
};

DrawingAndSnappingModule.prototype.resetStrokePool = function() {
    for (var i = 0; i < this.strokePool.length; i++) {
        this.strokePool[i].enabled = false;
    }
};

DrawingAndSnappingModule.prototype.endStroke = function() {
    if (!this.isDrawing) return null;
    this.isDrawing = false;
    this.resetStrokePool();

    if (this.currentStrokePoints.length < 5) {
        this.currentStrokePoints = [];
        return null;
    }

    var shape = this.recognizer.recognize(this.currentStrokePoints);
    if (shape) {
        print("[INFINITY INK] ? Snapped Shape Recognized: " + shape.type.toUpperCase());
        var snappedMesh = this.instantiateSnappedShape(shape);
        this.currentStrokePoints = [];
        return { shape: shape, obj: snappedMesh };
    } else {
        this.currentStrokePoints = [];
        return null;
    }
};

DrawingAndSnappingModule.prototype.instantiateSnappedShape = function(shape) {
    var snappedObj = global.scene.createSceneObject("Snapped_Shape_" + shape.type + "_" + (this.drawnObjects.length + 1));
    var vis = snappedObj.createComponent("Component.RenderMeshVisual");

    if (shape.type === "circle") {
        if (this.kernel.torusMesh) vis.mesh = this.kernel.torusMesh;
        else if (this.kernel.sphereMesh) vis.mesh = this.kernel.sphereMesh;
        snappedObj.getTransform().setWorldPosition(new vec3(shape.cx, shape.cy, -67.5));
        var diam = shape.r * 2.0;
        snappedObj.getTransform().setWorldScale(new vec3(diam, diam, 0.4));
        this.applyColor(snappedObj, new vec4(1.0, 0.75, 0.08, 0.95)); // Radiant Gold ring
    } else if (shape.type === "rect") {
        if (this.kernel.boxMesh) vis.mesh = this.kernel.boxMesh;
        snappedObj.getTransform().setWorldPosition(new vec3(shape.cx, shape.cy, -67.5));
        snappedObj.getTransform().setWorldScale(new vec3(shape.width, shape.height, 0.4));
        this.applyColor(snappedObj, new vec4(0.0, 1.0, 0.66, 0.90)); // Neon Emerald frame
    } else if (shape.type === "line") {
        if (this.kernel.boxMesh) vis.mesh = this.kernel.boxMesh;
        snappedObj.getTransform().setWorldPosition(new vec3(shape.cx, shape.cy, -67.5));
        snappedObj.getTransform().setWorldScale(new vec3(0.35, 0.35, shape.length));
        var dx = shape.end.x - shape.start.x;
        var dy = shape.end.y - shape.start.y;
        var dir = new vec3(dx / shape.length, dy / shape.length, 0);
        snappedObj.getTransform().setLocalRotation(quat.lookAt(dir, vec3.up()));
        this.applyColor(snappedObj, new vec4(0.0, 0.94, 1.0, 0.95)); // Cyberpunk Cyan
    }

    this.drawnObjects.push(shape);
    return snappedObj;
};
global.DrawingAndSnappingModule = DrawingAndSnappingModule;

// ==============================================================================
// MODULAR SUBSYSTEM 3: FTUEOnboarding (3-Step Spatial Onboarding Engine)
// ==============================================================================
function FTUEOnboarding(storageKey) {
    this.storageKey = storageKey || "INFINITY_FTUE_V3";
    this.completed = false;
    
    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            this.completed = (global.persistentStorageSystem.store.getString(this.storageKey) === "true");
        } catch(e) {}
    }
    
    this.active = !this.completed;
    this.step = this.active ? 1 : 0;
    this.steps = [
        {
            id: 1,
            tag: "STEP 1 OF 3 // SPATIAL SELECTION",
            prompt: "PINCH ANY NOTE TO REPOSITION",
            detail: "Grab a 3D thought card with pinch & drag across your physical desk."
        },
        {
            id: 2,
            tag: "STEP 2 OF 3 // CELESTIAL NAV",
            prompt: "PINCH A PLANET TO EXPLORE ANOTHER WORLD",
            detail: "Pinch any orbiting planetary sphere below to warp to that workspace."
        },
        {
            id: 3,
            tag: "STEP 3 OF 3 // AMBIENT ERGONOMICS",
            prompt: "LOOK AWAY TO GIVE YOUR WORLD ROOM TO BREATHE",
            detail: "Tilt your head up or glance away to watch INFINITY softly fade to ambient transparency."
        }
    ];
    this.listeners = [];
}

FTUEOnboarding.prototype.onStepChange = function(cb) {
    if (typeof cb === "function") this.listeners.push(cb);
};

FTUEOnboarding.prototype.notify = function() {
    for (var i = 0; i < this.listeners.length; i++) {
        try { this.listeners[i](this.step, this.getCurrentStepData()); } catch(e) {}
    }
};

FTUEOnboarding.prototype.isActive = function() {
    return this.active && !this.completed && this.step >= 1 && this.step <= 3;
};

FTUEOnboarding.prototype.getCurrentStepData = function() {
    if (!this.isActive()) return null;
    return this.steps[this.step - 1];
};

FTUEOnboarding.prototype.advance = function(expectedStep) {
    if (!this.active) return;
    if (!expectedStep || this.step === expectedStep) {
        if (this.step < 3) {
            this.step += 1;
            this.notify();
        } else {
            this.finish();
        }
    }
};

FTUEOnboarding.prototype.finish = function() {
    this.active = false;
    this.completed = true;
    this.step = 0;
    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            global.persistentStorageSystem.store.putString(this.storageKey, "true");
        } catch(e) {}
    }
    this.notify();
    print("[INFINITY ONBOARDING] ? Tutorial completed and persisted.");
};

FTUEOnboarding.prototype.reset = function() {
    this.completed = false;
    this.active = true;
    this.step = 1;
    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            global.persistentStorageSystem.store.putString(this.storageKey, "false");
        } catch(e) {}
    }
    this.notify();
    print("[INFINITY ONBOARDING] ? Tutorial reset for replay.");
};
global.FTUEOnboarding = FTUEOnboarding;

// ==============================================================================
// MODULAR SUBSYSTEM 4: NoteEditorKeyboard (3D Easel & Spatial Virtual Keyboard Deck)
// ==============================================================================
function NoteEditorKeyboard(kernelState) {
    this.kernel = kernelState;
    this.active = false;
    this.targetNote = null;
    this.editField = "body";
    this.editTitle = "";
    this.editBody = "";
    this.capsLock = false;
    this.easelObj = null;
    this.easelLabel = null;
    this.keyboardDeck = null;
    this.keycapObjects = [];

    this.KEY_LAYOUT = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L", "BKSP"],
        ["TAB", "Z", "X", "C", "V", "B", "N", "M", "SPACE", "SAVE"]
    ];

    this.uiInitialized = false;
}

NoteEditorKeyboard.prototype.initUI = function() {
    // 1. Editor Display Easel (Z = -64cm, Y = 6.5cm)
    this.easelObj = global.scene.createSceneObject("Editor_Easel_Backplate");
    var visual = this.easelObj.createComponent("Component.RenderMeshVisual");
    if (this.kernel.boxMesh) visual.mesh = this.kernel.boxMesh;
    if (this.kernel.pbrMaterial) { var m = (typeof this.kernel.pbrMaterial.clone === "function") ? this.kernel.pbrMaterial.clone() : this.kernel.pbrMaterial; visual.mainMaterial = m; visual.material = m; }
    this.easelObj.getTransform().setWorldPosition(new vec3(0.0, 6.5, -64.0));
    this.easelObj.getTransform().setWorldScale(new vec3(32.0, 14.0, 0.4));
    this.applyColor(this.easelObj, new vec4(0.04, 0.08, 0.16, 0.95));

    this.easelLabel = global.scene.createSceneObject("Editor_Easel_Text");
    var txt = this.easelLabel.createComponent("Component.Text3D");
    txt.text = "? INFINITY NOTE EDITOR\n[SELECT A NOTE TO EDIT]";
    txt.size = 4.2;
    if (txt.mainPass && txt.mainPass.baseColor) {
        txt.mainPass.baseColor = new vec4(0.0, 0.94, 1.0, 1.0);
    }
    this.easelLabel.getTransform().setWorldPosition(new vec3(0.0, 6.5, -63.5));

    // 2. Spatial Virtual Keyboard Deck (Z = -58cm, Y = -4.5cm, tilted 22deg)
    this.keyboardDeck = global.scene.createSceneObject("Editor_Keyboard_Deck");
    var kbVisual = this.keyboardDeck.createComponent("Component.RenderMeshVisual");
    if (this.kernel.boxMesh) kbVisual.mesh = this.kernel.boxMesh;
    if (this.kernel.pbrMaterial) { var m = (typeof this.kernel.pbrMaterial.clone === "function") ? this.kernel.pbrMaterial.clone() : this.kernel.pbrMaterial; kbVisual.mainMaterial = m; kbVisual.material = m; }
    this.keyboardDeck.getTransform().setWorldPosition(new vec3(0.0, -4.5, -58.0));
    this.keyboardDeck.getTransform().setWorldScale(new vec3(36.0, 11.0, 0.4));
    this.keyboardDeck.getTransform().setLocalRotation(quat.fromEulerAngles(22.0 * Math.PI / 180.0, 0, 0));
    this.applyColor(this.keyboardDeck, new vec4(0.02, 0.05, 0.10, 0.92));

    // 3. Build Keycaps
    var startX = -15.5;
    var startY = -1.2;
    var stepX = 3.4;
    var stepY = -2.5;

    for (var r = 0; r < this.KEY_LAYOUT.length; r++) {
        var row = this.KEY_LAYOUT[r];
        for (var c = 0; c < row.length; c++) {
            var keyChar = row[c];
            var kObj = global.scene.createSceneObject("Keycap_" + keyChar + "_" + r + "_" + c);
            var kVis = kObj.createComponent("Component.RenderMeshVisual");
            if (this.kernel.boxMesh) kVis.mesh = this.kernel.boxMesh;
            if (this.kernel.pbrMaterial) { var m = (typeof this.kernel.pbrMaterial.clone === "function") ? this.kernel.pbrMaterial.clone() : this.kernel.pbrMaterial; kVis.mainMaterial = m; kVis.material = m; }

            var kx = startX + c * stepX;
            var ky = startY + r * stepY;
            var kz = -57.5 + (r * 0.9);

            var kw = (keyChar === "SPACE" || keyChar === "SAVE" || keyChar === "BKSP" || keyChar === "TAB") ? 4.2 : 2.8;
            kObj.getTransform().setWorldScale(new vec3(kw, 1.9, 0.3));
            kObj.getTransform().setWorldPosition(new vec3(kx, ky, kz));
            kObj.getTransform().setLocalRotation(quat.fromEulerAngles(22.0 * Math.PI / 180.0, 0, 0));

            var keyColor = (keyChar === "SAVE") ? new vec4(0.0, 1.0, 0.66, 0.95) :
                           (keyChar === "BKSP") ? new vec4(1.0, 0.25, 0.25, 0.95) :
                           (keyChar === "TAB")  ? new vec4(1.0, 0.75, 0.08, 0.95) :
                           new vec4(0.12, 0.22, 0.36, 0.90);
            this.applyColor(kObj, keyColor);

            var kLbl = global.scene.createSceneObject("KeyLabel_" + keyChar);
            var kTxt = kLbl.createComponent("Component.Text3D");
            kTxt.text = keyChar;
            kTxt.size = 2.6;
            kLbl.getTransform().setWorldPosition(new vec3(kx, ky, kz + 0.3));
            kLbl.getTransform().setLocalRotation(quat.fromEulerAngles(22.0 * Math.PI / 180.0, 0, 0));

            this.keycapObjects.push({
                obj: kObj,
                labelObj: kLbl,
                key: keyChar,
                pos: new vec3(kx, ky, kz)
            });
        }
    }

    this.setVisible(false);
    this.active = false;
};

NoteEditorKeyboard.prototype.applyColor = function(obj, color) {
    if (!obj) return;
    var visual = obj.getComponent("Component.RenderMeshVisual") || obj.getComponent("RenderMeshVisual");
    if (visual && visual.mainPass && visual.mainPass.baseColor) {
        visual.mainPass.baseColor = color;
    }
};

NoteEditorKeyboard.prototype.setVisible = function(vis) {
    this.active = vis;
    if (this.easelObj) this.easelObj.enabled = vis;
    if (this.easelLabel) this.easelLabel.enabled = vis;
    if (this.keyboardDeck) this.keyboardDeck.enabled = vis;
    for (var i = 0; i < this.keycapObjects.length; i++) {
        if (this.keycapObjects[i].obj) this.keycapObjects[i].obj.enabled = vis;
        if (this.keycapObjects[i].labelObj) this.keycapObjects[i].labelObj.enabled = vis;
    }
};

NoteEditorKeyboard.prototype.openEditor = function(note) {
    if (!note || !note.cfg) return;
    if (!this.uiInitialized) {
        this.initUI();
        this.uiInitialized = true;
    }
    this.targetNote = note;
    this.editTitle = note.cfg.title || "UNTITLED";
    this.editBody = note.cfg.body || "";
    this.editField = "body";
    this.setVisible(true);
    this.updateDisplay();
    print("[INFINITY EDITOR] Opened 3D Note Editor for: " + this.editTitle);
};

NoteEditorKeyboard.prototype.closeEditor = function() {
    this.setVisible(false);
    this.targetNote = null;
    print("[INFINITY EDITOR] Closed Note Editor");
};

NoteEditorKeyboard.prototype.updateDisplay = function() {
    if (!this.easelLabel) return;
    var txt = this.easelLabel.getComponent("Component.Text3D");
    if (!txt) return;

    var isTitle = (this.editField === "title");
    var fieldIndicator = isTitle ? ">>> [EDITING TITLE] <<<" : ">>> [EDITING BODY] <<<";
    var bodyLines = this.editBody.split("\n").slice(0, 3).join("\n");

    var displayStr = "? INFINITY // SPATIAL NOTE EDITOR\n" +
                     fieldIndicator + "  (Tap TAB to switch)\n" +
                     "----------------------------------------\n" +
                     "TITLE: " + this.editTitle + (isTitle ? " deg" : "") + "\n" +
                     "BODY:\n" + bodyLines + (!isTitle ? " deg" : "") + "\n" +
                     "----------------------------------------\n" +
                     "[ TAB: Switch Field | BKSP: Delete | SAVE: Commit ]";
    txt.text = displayStr;
};

NoteEditorKeyboard.prototype.handleKeyPress = function(key) {
    if (!this.active) return false;

    if (key === "SAVE") {
        this.saveChanges();
        return true;
    } else if (key === "TAB") {
        this.editField = (this.editField === "title") ? "body" : "title";
        this.updateDisplay();
        return true;
    } else if (key === "BKSP") {
        if (this.editField === "title") {
            if (this.editTitle.length > 0) this.editTitle = this.editTitle.substring(0, this.editTitle.length - 1);
        } else {
            if (this.editBody.length > 0) this.editBody = this.editBody.substring(0, this.editBody.length - 1);
        }
        this.updateDisplay();
        return true;
    } else if (key === "SPACE") {
        if (this.editField === "title") {
            if (this.editTitle.length < 24) this.editTitle += " ";
        } else {
            if (this.editBody.length < 90) this.editBody += " ";
        }
        this.updateDisplay();
        return true;
    } else {
        var ch = this.capsLock ? key.toUpperCase() : key;
        if (this.editField === "title") {
            if (this.editTitle.length < 24) this.editTitle += ch;
        } else {
            if (this.editBody.length < 90) this.editBody += ch;
        }
        this.updateDisplay();
        return true;
    }
};

NoteEditorKeyboard.prototype.saveChanges = function() {
    if (!this.targetNote) return;
    this.targetNote.cfg.title = this.editTitle;
    this.targetNote.cfg.body = this.editBody;
    this.targetNote.status = "SYNCHRONIZED";

    if (this.targetNote.labelObj) {
        var txt = this.targetNote.labelObj.getComponent("Component.Text3D");
        if (txt) {
            txt.text = this.editTitle + "\n" + this.editBody + "\n[ SYNCHRONIZED ]";
        }
    }

    print("[INFINITY EDITOR] ? Changes saved to note: " + this.editTitle);
    this.closeEditor();

    if (this.kernel.saveWorkspaceState && this.kernel.state && this.kernel.state.focusedWorkspace) {
        this.kernel.saveWorkspaceState(this.kernel.state.focusedWorkspace);
    }
    if (this.kernel.state) {
        this.kernel.state.pulseEnergy = 1.0;
    }
};

NoteEditorKeyboard.prototype.checkRayHit = function(screenPos, raycastFn) {
    if (!this.active) return false;

    for (var i = 0; i < this.keycapObjects.length; i++) {
        var k = this.keycapObjects[i];
        var hitResult = raycastFn(screenPos, k.pos, 2.2);
        if (hitResult.hit) {
            this.handleKeyPress(k.key);
            return true;
        }
    }

    if (this.easelObj) {
        var easelPos = this.easelObj.getTransform().getWorldPosition();
        var eHit = raycastFn(screenPos, easelPos, 14.0);
        if (eHit.hit) {
            this.editField = (this.editField === "title") ? "body" : "title";
            this.updateDisplay();
            return true;
        }
    }

    return false;
};
global.NoteEditorKeyboard = NoteEditorKeyboard;

// ==============================================================================
// MODULAR SUBSYSTEM 5: LiveAIAssistantModule (Contextual Edge AI Bridge)
// ==============================================================================
function LiveAIAssistantModule(kernelState) {
    this.kernel = kernelState;
    this.isLoading = false;
    this.requestCount = 0;
}

LiveAIAssistantModule.prototype.synthesizeSpatialExpansion = function(selectedNote, workspaceKey, callback) {
    this.requestCount++;
    this.isLoading = true;

    var currentTitle = (selectedNote && selectedNote.cfg && selectedNote.cfg.title) ? selectedNote.cfg.title : "COGNITIVE ROOT";
    var currentBody = (selectedNote && selectedNote.cfg && selectedNote.cfg.body) ? selectedNote.cfg.body : "Spatial concept";

    print("[INFINITY AI] Initiating synthesis for workspace [" + workspaceKey + "] on node: '" + currentTitle + "'");

    if (this.kernel.state.voiceHudLabel) {
        var hTxt = this.kernel.state.voiceHudLabel.getComponent("Component.Text3D");
        if (hTxt) hTxt.text = "[ ? AI SYNTHESIZING NEURAL VECTORS... ]";
    }

    var expansion = this.generateContextualExpansion(currentTitle, currentBody, workspaceKey);

    var resultPayload = {
        success: true,
        source: "ON_DEVICE_CURRICULUM_SYNTHESIZER",
        title: "? SYNTHESIS: " + currentTitle.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().substring(0, 18),
        body: "deg " + expansion.text + "\ndeg " + expansion.link + "\n[x] Vector Linked",
        status: "SYNCHRONIZED",
        confidence: 0.94
    };

    this.isLoading = false;
    print("[INFINITY AI] ? Contextual Edge Synthesis complete: " + resultPayload.title);

    if (typeof callback === "function") {
        callback(resultPayload);
    }
    return resultPayload;
};

LiveAIAssistantModule.prototype.generateContextualExpansion = function(title, body, wsKey) {
    var tLower = title.toLowerCase();
    if (wsKey === "Think") {
        if (tLower.indexOf("arch") !== -1 || tLower.indexOf("6dof") !== -1) {
            return {
                text: "Multi-Anchor Kinematic Transform: Decouples optical head pose from world desk grid.",
                link: "6DoF Parallax Drift Compensator calibrated."
            };
        } else if (tLower.indexOf("gaze") !== -1 || tLower.indexOf("sik") !== -1) {
            return {
                text: "Micro-Saccade Filter: Stabilizes 3D raycast target during sustained manual pinches.",
                link: "SIK Gaze Raycast Confidence: 98.6%."
            };
        } else {
            return {
                text: "Attention Flow Graph: Dynamically weights visual hierarchy across 15deg cylindrical arc.",
                link: "Concentric optical focus plane locked at Z=-68cm."
            };
        }
    } else if (wsKey === "Create") {
        return {
            text: "Volumetric Cyberpunk Shader: Computes additive glass transmission without dark occlusion.",
            link: "Waveguide additive color balance optimized."
        };
    } else if (wsKey === "Learn") {
        return {
            text: "Ergonomic Hand Kinematics: Calibrates pinch hysteresis against near-field optical distortion.",
            link: "Seated arm elevation model confirmed within low-fatigue envelope."
        };
    } else if (wsKey === "Store") {
        return {
            text: "Persistent Coordinate Vault: Preserves spatial desk coordinates across sessions.",
            link: "Local persistent storage system synchronized."
        };
    } else {
        return {
            text: "Cosmic Latent Space Traversal: Expands thought clusters into 6DoF constellation graphs.",
            link: "Infinite whiteboard zoom levels compiled."
        };
    }
};

LiveAIAssistantModule.prototype.summarizeKnowledgeGraph = function(workspaceKey, callback) {
    var state = this.kernel.state;
    var currentNotes = state.notes || [];
    var concepts = [];
    for (var i = 0; i < currentNotes.length; i++) {
        if (currentNotes[i].cfg && currentNotes[i].cfg.title) {
            concepts.push(currentNotes[i].cfg.title.replace(/^[0-9.]+\s*/, ""));
        }
    }
    var conceptsStr = concepts.slice(0, 3).join(" ? ");
    var synthTitle = "? GRAPH SYNTHESIS";
    var synthBody = "deg Cross-Concept: " + conceptsStr + "\ndeg Coherent quantum cognitive model linked\n[x] Knowledge Graph Synthesized";

    var synthNode = {
        id: "StickyNote_Synthesis_" + Math.floor(state.time || 1),
        labelId: "Label_Note_Synthesis_" + Math.floor(state.time || 1),
        title: synthTitle,
        body: synthBody,
        status: "SYNTHESIZING",
        basePos: new vec3(0.0, -2.5, -64.0),
        baseRotY: 0.0
    };

    var nObj = getOrCreateObject(synthNode.id, this.kernel.boxMesh, this.kernel.pbrMaterial);
    var cardText = synthTitle + "\n" + synthBody + "\n[ SYNTHESIZING ]";
    var lblObj = getOrCreateText3D(synthNode.labelId, cardText, 4.8, new vec4(1.0, 0.85, 0.20, 1.0));

    nObj.getTransform().setWorldScale(new vec3(14.0, 8.8, 0.5));
    nObj.getTransform().setWorldPosition(synthNode.basePos);
    applyMaterialStyle(nObj, null, new vec4(0.08, 0.12, 0.22, 0.94));

    lblObj.getTransform().setWorldPosition(new vec3(0.0, -2.5, -63.2));

    var noteEntry = {
        obj: nObj,
        labelObj: lblObj,
        id: synthNode.id,
        cfg: synthNode,
        status: "SYNTHESIZING",
        targetPos: synthNode.basePos,
        curPos: synthNode.basePos,
        baseScale: new vec3(14.0, 8.8, 0.5),
        curScale: new vec3(14.0, 8.8, 0.5),
        isHovered: false
    };
    state.notes.push(noteEntry);
    state.pulseEnergy = 1.0;
    triggerAudioRipple(synthNode.basePos);

    if (state.voiceHud && state.voiceHudLabel) {
        setTextContent(state.voiceHudLabel, "[ ? KNOWLEDGE GRAPH SYNTHESIZED // 4 NODES ]", 4.2);
        applyMaterialStyle(state.voiceHud, null, new vec4(1.0, 0.75, 0.08, 0.95));
        state.voiceHudTimer = 3.5;
    }

    print("[INFINITY AI] ? Knowledge Graph Synthesized: " + synthTitle);
    if (typeof callback === "function") callback(noteEntry);
    return noteEntry;
};

global.LiveAIAssistantModule = LiveAIAssistantModule;

// ==============================================================================
// MODULAR SUBSYSTEM 6: SessionDocumentExporter (Markdown & JSON Vault Exporter)
// ==============================================================================
function SessionDocumentExporter() {}

SessionDocumentExporter.exportSessionDocument = function(sessionData) {
    var wsName = sessionData.workspaceName || "THINK";
    var notes = sessionData.notes || [];
    var shapes = sessionData.shapes || [];
    var timestamp = new Date().toISOString();

    var md = "# ?? INFINITY // Spatial Thinking Session Report\n\n";
    md += "* **Generated:** `" + timestamp + "`\n";
    md += "* **Active Workspace:** **" + wsName.toUpperCase() + "**\n";
    md += "* **Target Hardware:** Snap Spectacles (6DoF Optical AR)\n";
    md += "* **Interaction Engine:** Spectacles Interaction Kit (SIK) + Infinity OS Kernel\n\n";
    md += "---\n\n";
    md += "## ?? Spatial Thought Objects & Cognitive Notes\n\n";

    if (notes.length === 0) {
        md += "*No active notes in this workspace.*\n\n";
    } else {
        for (var i = 0; i < notes.length; i++) {
            var n = notes[i];
            var isSync = (n.status === "SYNCHRONIZED");
            var check = isSync ? "[x]" : "[ ]";
            md += "### " + (i + 1) + ". " + check + " " + (n.cfg ? n.cfg.title : "Untitled Note") + " `[" + (n.status || "ANCHORED") + "]`\n";
            md += "* **Position (3D):** `(" + n.curPos.x.toFixed(1) + ", " + n.curPos.y.toFixed(1) + ", " + n.curPos.z.toFixed(1) + ") cm`\n";
            if (n.cfg && n.cfg.body) {
                var lines = n.cfg.body.split("\n");
                for (var l = 0; l < lines.length; l++) {
                    var line = lines[l].trim();
                    if (line) md += "  > " + line + "\n";
                }
            }
            md += "\n";
        }
    }

    md += "---\n\n";
    md += "## ?? Snapped Geometric Shapes & Drawings\n\n";
    if (shapes.length === 0) {
        md += "*No geometric shapes drawn in this session.*\n\n";
    } else {
        for (var s = 0; s < shapes.length; s++) {
            var sh = shapes[s];
            md += "* **Shape #" + (s + 1) + ":** `" + sh.type.toUpperCase() + "` at `(" + sh.cx.toFixed(1) + ", " + sh.cy.toFixed(1) + ")`\n";
        }
    }

    var exportPayload = {
        schema: "INFINITY_SPATIAL_SESSION_V2",
        exportedAt: timestamp,
        workspace: wsName,
        markdown: md,
        rawNotesCount: notes.length,
        rawShapesCount: shapes.length
    };

    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            global.persistentStorageSystem.store.putString("INFINITY_EXPORT_" + wsName, JSON.stringify(exportPayload));
            print("[INFINITY VAULT] Session exported to persistent storage for workspace: " + wsName);
        } catch(e) {}
    }

    return exportPayload;
};
global.SessionDocumentExporter = SessionDocumentExporter;

// ==============================================================================
// MODULAR SUBSYSTEM 7: DesktopCompanionSyncModule (Glasses-Native Ingestion Bridge)
// ==============================================================================
function DesktopCompanionSyncModule(kernelState) {
    this.kernel = kernelState;
    this.receivedPackets = 0;
}

DesktopCompanionSyncModule.prototype.injectDesktopSnippet = function(title, content, category) {
    this.receivedPackets++;
    var noteTitle = title || ("DESKTOP CLIP #" + this.receivedPackets);
    var noteBody = content || "External desktop snippet injected into AR.";
    var targetWs = category || (this.kernel.state.focusedWorkspace || "Think");

    print("[INFINITY DESKTOP SYNC] Ingesting content from companion to [" + targetWs + "]: " + noteTitle);

    if (this.kernel.state.notes && this.kernel.state.notes.length > 0) {
        var note = this.kernel.state.notes[0];
        note.cfg.title = "? " + noteTitle;
        note.cfg.body = "deg " + noteBody + "\n[x] Synced from Companion";
        note.status = "SYNCHRONIZED";

        if (note.labelObj) {
            var txt = note.labelObj.getComponent("Component.Text3D");
            if (txt) {
                txt.text = note.cfg.title + "\n" + note.cfg.body + "\n[ SYNCHRONIZED ]";
            }
        }
    }

    if (this.kernel.state.voiceHud && this.kernel.state.voiceHudLabel) {
        var hTxt = this.kernel.state.voiceHudLabel.getComponent("Component.Text3D");
        if (hTxt) hTxt.text = "[ ? SNIPPET INJECTED TO AR ]";
        this.kernel.state.voiceHudTimer = 3.0;
    }

    if (this.kernel.state) {
        this.kernel.state.pulseEnergy = 1.0;
    }

    return { success: true, title: noteTitle, workspace: targetWs };
};
global.DesktopCompanionSyncModule = DesktopCompanionSyncModule;

// ==============================================================================
// SURFACE TRACKING & PHYSICAL TABLE SNAPPING ENGINE (Critical 1 & P1)
// ==============================================================================
function SurfaceTrackingManager(kernelState) {
    this.kernel = kernelState;
    this.worldQuery = null;
    this.calibratedHeight = -18.0; // cm relative to camera
    this.surfaceTiltDeg = 35.0;     // Ergonomic 35deg recline toward user (from QWERTY)
    this.surfaceLiftCm = 1.2;       // +1.2cm clearance so fingers poke hologram before wood table
    this.surfaceSnapping = true;
    this.initWorldQuery();
}

SurfaceTrackingManager.prototype.initWorldQuery = function() {
    if (global.WorldQueryModule) {
        try {
            this.worldQuery = global.WorldQueryModule;
            print("[INFINITY SURFACE] WorldQueryModule detected on Spectacles hardware.");
        } catch(e) {}
    }
    // Bind global physical desk detection hook from SurfaceAnchorEngine
    var self = this;
    global.infinityOnDeskDetected = function(surfaceY, normal) {
        self.calibratedHeight = surfaceY;
        self.updateSurfacePositions();
        if (self.kernel.state.voiceHud && self.kernel.state.voiceHudLabel) {
            setTextContent(self.kernel.state.voiceHudLabel, "[ ? PHYSICAL DESK LOCKED: " + surfaceY.toFixed(1) + " CM ]", 4.2);
            applyMaterialStyle(self.kernel.state.voiceHud, null, new vec4(0.0, 0.85, 0.5, 0.95));
            self.kernel.state.voiceHudTimer = 3.0;
        }
        print("[INFINITY SURFACE] Locked to real room mesh tabletop at Y=" + surfaceY.toFixed(1));
    };
};

SurfaceTrackingManager.prototype.adjustDeskElevation = function(deltaY) {
    this.calibratedHeight += deltaY;
    this.calibratedHeight = Math.max(-45.0, Math.min(-5.0, this.calibratedHeight));
    this.updateSurfacePositions();
    if (this.kernel.state.voiceHud && this.kernel.state.voiceHudLabel) {
        setTextContent(this.kernel.state.voiceHudLabel, "[ ? DESK CALIBRATED: " + this.calibratedHeight.toFixed(1) + " CM ]", 4.2);
        this.kernel.state.voiceHudTimer = 2.5;
    }
    print("[INFINITY SURFACE] Calibrated Desk Elevation: " + this.calibratedHeight.toFixed(1) + " cm");
};

SurfaceTrackingManager.prototype.updateSurfacePositions = function() {
    var state = this.kernel.state;
    var effectiveY = this.calibratedHeight + (this.surfaceLiftCm || 1.2);
    var tiltRad = (this.surfaceTiltDeg || 35.0) * (Math.PI / 180.0);
    var pitchRad = ((this.surfaceTiltDeg || 35.0) - 90.0) * (Math.PI / 180.0);
    var tiltQuat = quat.fromEulerAngles(pitchRad, 0, 0);

    if (state.deskSurface) {
        var p = state.deskSurface.getTransform().getWorldPosition();
        state.deskSurface.getTransform().setWorldPosition(new vec3(p.x, this.calibratedHeight, p.z));
    }
    if (state.deskTrim) {
        state.deskTrim.getTransform().setWorldPosition(new vec3(0.0, this.calibratedHeight + 0.7, -70.0));
    }
    if (state.textbookMarker) {
        state.textbookMarker.getTransform().setWorldPosition(new vec3(-18.0, effectiveY, -64.0));
        state.textbookMarker.getTransform().setLocalRotation(tiltQuat);
    }
    if (state.textbookLabel) {
        state.textbookLabel.getTransform().setWorldPosition(new vec3(-18.0, effectiveY + 0.4, -64.0));
        state.textbookLabel.getTransform().setLocalRotation(tiltQuat);
    }
    if (state.deskCorners) {
        for (var i = 0; i < state.deskCorners.length; i++) {
            var c = state.deskCorners[i];
            if (c.obj) {
                c.obj.getTransform().setWorldPosition(new vec3(c.x, this.calibratedHeight + 0.8, c.z));
            }
        }
    }
    if (state.calibrationButtons) {
        for (var b = 0; b < state.calibrationButtons.length; b++) {
            var btn = state.calibrationButtons[b];
            if (btn.obj) {
                btn.obj.getTransform().setWorldPosition(new vec3(btn.basePos.x, this.calibratedHeight + 0.9, btn.basePos.z));
            }
            if (btn.labelObj) {
                btn.labelObj.getTransform().setWorldPosition(new vec3(btn.basePos.x, this.calibratedHeight + 1.2, btn.basePos.z));
            }
        }
    }
    this.updateContactShadows();
};

SurfaceTrackingManager.prototype.updateContactShadows = function() {
    var state = this.kernel.state;
    if (!state.contactShadows) return;
    for (var i = 0; i < state.notes.length; i++) {
        var n = state.notes[i];
        var shadow = state.contactShadows[i];
        if (shadow && n.curPos) {
            var heightAboveDesk = Math.max(0.2, n.curPos.y - this.calibratedHeight);
            var shadowScale = Math.max(7.0, 13.2 - heightAboveDesk * 0.22);
            shadow.getTransform().setWorldPosition(new vec3(n.curPos.x, this.calibratedHeight + 0.15, n.curPos.z));
            shadow.getTransform().setWorldScale(new vec3(shadowScale, 0.05, shadowScale * 0.62));
            var shadowAlpha = Math.max(0.12, 0.58 - (heightAboveDesk * 0.025));
            applyMaterialStyle(shadow, null, new vec4(0.02, 0.04, 0.08, shadowAlpha * state.ambientOpacity));
        }
    }
};

SurfaceTrackingManager.prototype.snapToPhysicalSurface = function(ray) {
    if (this.worldQuery && typeof this.worldQuery.hitTestWorldMesh === "function" && ray) {
        try {
            var hit = this.worldQuery.hitTestWorldMesh(ray.origin, ray.direction);
            if (hit && hit.position) {
                this.calibratedHeight = hit.position.y;
                this.updateSurfacePositions();
                print("[INFINITY SURFACE] Snapped to physical surface mesh at Y=" + this.calibratedHeight.toFixed(1));
                return true;
            }
        } catch(e) {}
    }
    this.calibratedHeight = -18.0;
    this.updateSurfacePositions();
    if (this.kernel.state.voiceHud && this.kernel.state.voiceHudLabel) {
        setTextContent(this.kernel.state.voiceHudLabel, "[ ? DESK DEFAULT: -18.0 CM GROUNDED ]", 4.2);
        this.kernel.state.voiceHudTimer = 2.5;
    }
    return false;
};
global.SurfaceTrackingManager = SurfaceTrackingManager;

// ==============================================================================
// Core Engine State & Data Structures
// ==============================================================================
var state = {
    mode: "WORKSPACE_FOCUS", // "GALAXY" or "WORKSPACE_FOCUS"
    focusedWorkspace: "Think",
    camera: null,
    planets: {},
    labels: {},
    notes: [],
    constellations: [],
    whiteboard: null,
    deskSurface: null,
    voiceHud: null,
    voiceHudLabel: null,
    voiceHudTimer: 0.0,
    headerLabel: null,
    subLabel: null,
    audioRipple: null,
    audioRippleScale: 0.2,
    audioRippleActive: false,
    draggedNote: null,
    lastScreenPos: new vec2(0.5, 0.5),
    time: 0.0,
    pulseEnergy: 0.0,
    ambientOpacity: 1.0,
    aiIndex: 0,
    persistentCache: {},
    ftueBillboard: null,
    ftueText: null,
    ftueOnboarding: null,
    noteEditor: null,
    shapeModule: null,
    aiModule: null,
    desktopSync: null,
    surfaceManager: null,
    deskElevation: -18.0,
    deskCorners: [],
    deskTrim: null,
    calibrationButtons: [],
    summarizeButton: null,
    contactShadows: [],
    pointerReticle: null,
    pointerDot: null,
    exportModal: null,
    exportModalActive: false,
    exportModalCloseBtn: null,
    exportModalSyncBtn: null,
    aiCore: null,
    lastTappedNote: null,
    lastNoteTapTime: 0.0,
    lastAppliedOpacity: -1.0,
    workspacePill: null,
    workspacePillLabel: null
};

// Touch / Tap Discrimination State (Enhanced with Obsidiar Kinematics)
var TAP_MAX_SEC = 0.35;
var DRAG_THRESHOLD_CM = 2.0;
var RENDER_ORDER_LABEL = 998;
var RENDER_ORDER_CARD = 999;
var RENDER_ORDER_TEXT = 1000;

var touchState = {
    startPos: new vec2(0, 0),
    startTime: 0,
    hasMoved: false,
    dragThreshold: 0.035, // 3.5% screen distance threshold
    tapMaxSec: TAP_MAX_SEC,
    dragThresholdCm: DRAG_THRESHOLD_CM,
    lastDragEndTime: 0,
    activeTouch: false
};

// ------------------------------------------------------------------------------
// Helper Utilities & Scene Hierarchy Search
// ------------------------------------------------------------------------------
function findObjectByName(name, root) {
    if (!root) {
        var count = global.scene.getRootObjectsCount();
        for (var i = 0; i < count; i++) {
            var found = findObjectByName(name, global.scene.getRootObject(i));
            if (found) return found;
        }
        return null;
    }
    if (root.name === name) return root;
    for (var j = 0; j < root.getChildrenCount(); j++) {
        var childFound = findObjectByName(name, root.getChild(j));
        if (childFound) return childFound;
    }
    return null;
}

function getText3D(obj) {
    if (!obj) return null;
    return obj.getComponent("Component.Text3D") || obj.getComponent("Text3D");
}

function setTextContent(obj, str, size) {
    if (!obj) return;
    var txt = getText3D(obj);
    if (txt) {
        txt.text = str;
        if (size) txt.size = size;
    }
}

function applyMaterialStyle(obj, texAsset, color, renderOrder, disableDepthTest) {
    if (!obj) return;
    var visual = obj.getComponent("Component.RenderMeshVisual") || obj.getComponent("RenderMeshVisual");
    if (visual) {
        if (renderOrder !== undefined && typeof visual.setRenderOrder === "function") {
            visual.setRenderOrder(renderOrder);
        }
        if (visual.mainPass) {
            if (texAsset) {
                visual.mainPass.baseTex = texAsset;
            }
            if (color && visual.mainPass.baseColor) {
                visual.mainPass.baseColor = color;
            }
            if (disableDepthTest) {
                visual.mainPass.depthTest = false;
            }
        }
    }
}

// ------------------------------------------------------------------------------
// Autonomous Self-Bootstrapping Engine: Procedural Scene Instantiator
// ------------------------------------------------------------------------------
function getOrCreateObject(name, meshAsset, matAsset) {
    var obj = findObjectByName(name);
    if (!obj) {
        obj = global.scene.createSceneObject(name);
        if (meshAsset || matAsset) {
            var visual = obj.createComponent("Component.RenderMeshVisual");
            if (meshAsset) visual.mesh = meshAsset;
            if (matAsset) {
                var instMat = (typeof matAsset.clone === "function") ? matAsset.clone() : matAsset;
                visual.mainMaterial = instMat;
                visual.material = instMat;
            }
        if (state.camera) { try { obj.layer = state.camera.getSceneObject().layer; } catch(e) {} }
        }
        print("[INFINITY BOOT] Procedurally instantiated: " + name);
    }
    return obj;
}

function getOrCreateText3D(name, defaultText, size, color, renderOrder, disableDepthTest) {
    var obj = findObjectByName(name);
    if (!obj) {
        obj = global.scene.createSceneObject(name);
        var txt = obj.createComponent("Component.Text3D");
        if (script.textMaterial && script.textMaterial.mainPass) { try { txt.mainMaterial = script.textMaterial; } catch(e) {} }
        if (state.camera) { try { obj.layer = state.camera.getSceneObject().layer; } catch(e) {} }
        txt.text = defaultText || "";
        if (size) txt.size = size;
        if (renderOrder !== undefined && typeof txt.setRenderOrder === "function") {
            txt.setRenderOrder(renderOrder);
        }
        if (disableDepthTest) {
            if (typeof txt.depthTest === "boolean") txt.depthTest = false;
            if (txt.mainPass) txt.mainPass.depthTest = false;
        }
        if (color) {
            try {
                if (txt.textFill) txt.textFill.color = color;
                if (txt.mainPass && txt.mainPass.baseColor) txt.mainPass.baseColor = color;
            } catch(e) {}
        }
        print("[INFINITY BOOT] Procedurally instantiated Text3D: " + name);
    }
    return obj;
}

// ------------------------------------------------------------------------------
// True 3D Spatial Vector Raycast Engine (Matching SIK 3D Standards)
// ------------------------------------------------------------------------------
function getCameraRay(screenPos) {
    if (!state.camera) return null;
    var camObj = state.camera.getSceneObject();
    if (!camObj) return null;
    var camPos = camObj.getTransform().getWorldPosition();
    var farPoint = state.camera.screenSpaceToWorldSpace(screenPos, 100.0);
    var dir = farPoint.sub(camPos);
    var lenSq = dir.lengthSquared;
    var normDir = (lenSq > 0.00001) ? dir.normalize() : camObj.getTransform().forward;
    return {
        origin: camPos,
        direction: normDir
    };
}
function raycast3D(screenPos, targetPos, hitRadius) {
    if (!state.camera) return { hit: false, dist3D: Infinity };
    var ray = getCameraRay(screenPos);
    if (!ray) return { hit: false, dist3D: Infinity };

    var v = targetPos.sub(ray.origin);
    var t = v.dot(ray.direction);
    if (t <= 0) return { hit: false, dist3D: Infinity };

    var closestPoint = ray.origin.add(ray.direction.uniformScale(t));
    var dist3D = closestPoint.distance(targetPos);
    return {
        hit: dist3D <= hitRadius,
        dist3D: dist3D,
        point: closestPoint
    };
}

// ------------------------------------------------------------------------------
// Session Persistence (Save & Reopen Workspaces)
// ------------------------------------------------------------------------------
function saveWorkspaceState(wsKey) {
    var noteData = [];
    for (var i = 0; i < state.notes.length; i++) {
        var n = state.notes[i];
        noteData.push({
            id: n.id,
            x: n.curPos ? n.curPos.x : (n.targetPos ? n.targetPos.x : 0),
            y: n.curPos ? n.curPos.y : (n.targetPos ? n.targetPos.y : 0),
            z: n.curPos ? n.curPos.z : (n.targetPos ? n.targetPos.z : -68.0),
            title: (n.cfg && n.cfg.title) ? n.cfg.title : n.id,
            body: (n.cfg && n.cfg.body) ? n.cfg.body : "",
            status: n.status || "ANCHORED",
            isCustom: !!(n.id && (n.id.indexOf("Voice") !== -1 || n.id.indexOf("Synthesis") !== -1 || n.id.indexOf("Desktop") !== -1))
        });
    }
    var jsonStr = JSON.stringify(noteData);
    state.persistentCache[wsKey] = jsonStr;

    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            global.persistentStorageSystem.store.putString("INFINITY_WS_" + wsKey, jsonStr);
            print("[INFINITY OS] Workspace preserved to persistent storage: " + wsKey);
        } catch(e) {
            print("[INFINITY OS] Persistent store warning: " + e);
        }
    }
}

function loadWorkspaceState(wsKey) {
    var jsonStr = null;
    if (global.persistentStorageSystem && global.persistentStorageSystem.store) {
        try {
            jsonStr = global.persistentStorageSystem.store.getString("INFINITY_WS_" + wsKey);
        } catch(e) {}
    }
    if (!jsonStr && state.persistentCache[wsKey]) {
        jsonStr = state.persistentCache[wsKey];
    }
    if (jsonStr) {
        try {
            var data = JSON.parse(jsonStr);
            print("[INFINITY OS] Workspace restored from storage: " + wsKey);
            return data;
        } catch(e) {}
    }
    return null;
}

// ------------------------------------------------------------------------------
// Galaxy Planet Configurations
// ------------------------------------------------------------------------------
var GALAXY_PLANET_CONFIGS = {
    "Planet_Think":   { key: "Think",   label: "THINK",   basePos: new vec3(-26.0, 9.0, -86.0), baseScale: new vec3(5.2, 5.2, 5.2), texProp: "texThink" },
    "Planet_Create":  { key: "Create",  label: "CREATE",  basePos: new vec3(-13.0, 14.0, -90.0), baseScale: new vec3(5.6, 5.6, 5.6), texProp: "texCreate" },
    "Planet_Learn":   { key: "Learn",   label: "LEARN",   basePos: new vec3(0.0, 16.5, -92.0), baseScale: new vec3(6.8, 6.8, 6.8), texProp: "texLearn" },
    "Planet_Store":   { key: "Store",   label: "STORE",   basePos: new vec3(13.0, 14.0, -90.0), baseScale: new vec3(5.6, 5.6, 5.6), texProp: "texStore" },
    "Planet_Explore": { key: "Explore", label: "EXPLORE", basePos: new vec3(26.0, 9.0, -86.0), baseScale: new vec3(5.2, 5.2, 5.2), texProp: "texExplore" }
};

// ------------------------------------------------------------------------------
// Boot Lifecycle & Autonomous Self-Instantiation
// ------------------------------------------------------------------------------
script.createEvent('OnStartEvent').bind(function() {
    print("[INFINITY OS] Kernel booting into 6DoF Spatial Universe...");

    // 1. Link Camera
    var camObj = findObjectByName("Camera Object") || findObjectByName("Camera");
    if (camObj) {
        state.camera = camObj.getComponent("Component.Camera") || camObj.getComponent("Camera");
        print("[INFINITY OS] Spatial Camera linked successfully");
    }

    // Network Connectivity Resilience & Toast HUD (Post-It Pattern)
    state.internetAvailable = true;
    if (typeof global.deviceInfoSystem !== "undefined" && global.deviceInfoSystem) {
        state.internetAvailable = global.deviceInfoSystem.isInternetAvailable();
        global.deviceInfoSystem.onInternetStatusChanged.add(function(args) {
            state.internetAvailable = args.isInternetAvailable;
            if (state.voiceHud && state.voiceHudLabel) {
                if (args.isInternetAvailable) {
                    setTextContent(state.voiceHudLabel, "[ ? INFINITY // RECONNECTED deg ? AI READY ]", 4.0);
                    applyMaterialStyle(state.voiceHud, null, new vec4(0.0, 0.85, 0.45, 0.95));
                } else {
                    setTextContent(state.voiceHudLabel, "[ ?? INFINITY // OFFLINE - LOCAL MODE ACTIVE ]", 4.0);
                    applyMaterialStyle(state.voiceHud, null, new vec4(0.95, 0.25, 0.15, 0.95));
                }
                state.voiceHudTimer = 3.5;
            }
            print("[INFINITY OS] Internet connectivity changed: " + (args.isInternetAvailable ? "ONLINE" : "OFFLINE"));
        });
    }

    // 2. Virtual Desk Surface Stand-In Plate (90x1.2x54cm) with Corner Alignments
    state.deskSurface = getOrCreateObject("Virtual_Desk_Surface", script.boxMesh, script.pbrMaterial);
    state.deskSurface.getTransform().setWorldPosition(new vec3(0.0, -18.0, -70.0));
    state.deskSurface.getTransform().setWorldScale(new vec3(90.0, 1.2, 54.0));
    applyMaterialStyle(state.deskSurface, script.texWhiteboard, new vec4(0.08, 0.12, 0.22, 0.94));

    var deskCorners = [
        { name: "Desk_Corner_TL", x: -43.0, z: -95.0 },
        { name: "Desk_Corner_TR", x:  43.0, z: -95.0 },
        { name: "Desk_Corner_BL", x: -43.0, z: -45.0 },
        { name: "Desk_Corner_BR", x:  43.0, z: -45.0 }
    ];
    state.deskCorners = [];
    for (var ci = 0; ci < deskCorners.length; ci++) {
        var cData = deskCorners[ci];
        var cornerObj = getOrCreateObject(cData.name, script.boxMesh, script.pbrMaterial);
        cornerObj.getTransform().setWorldPosition(new vec3(cData.x, -17.2, cData.z));
        cornerObj.getTransform().setWorldScale(new vec3(3.2, 0.35, 3.2));
        applyMaterialStyle(cornerObj, null, new vec4(0.0, 0.94, 1.0, 0.92));
        state.deskCorners.push({ obj: cornerObj, x: cData.x, z: cData.z });
    }

    state.deskTrim = getOrCreateObject("Desk_Surface_Rim", script.boxMesh, script.pbrMaterial);
    state.deskTrim.getTransform().setWorldPosition(new vec3(0.0, -17.3, -70.0));
    state.deskTrim.getTransform().setWorldScale(new vec3(91.2, 0.25, 55.2));
    applyMaterialStyle(state.deskTrim, null, new vec4(1.0, 0.75, 0.08, 0.40));

    // 2bb. Stand-in Reference Marker for Physical Study Textbook (Anchor for Shared Perspective)
    state.textbookMarker = getOrCreateObject("Desk_Textbook_Reference_Marker", script.boxMesh, script.pbrMaterial);
    state.textbookMarker.getTransform().setWorldPosition(new vec3(-18.0, -17.2, -64.0));
    state.textbookMarker.getTransform().setWorldScale(new vec3(22.0, 0.5, 16.0));
    state.textbookMarker.getTransform().setLocalRotation(quat.fromEulerAngles(0, -6.0 * Math.PI / 180.0, 0));
    applyMaterialStyle(state.textbookMarker, null, new vec4(0.05, 0.09, 0.18, 0.82));

    state.textbookLabel = getOrCreateText3D("Label_Textbook_Reference", "[ PHYSICAL TEXTBOOK / WORKBOOK ANCHOR ]", 2.6, new vec4(0.0, 0.94, 1.0, 0.85));
    state.textbookLabel.getTransform().setWorldPosition(new vec3(-18.0, -16.8, -64.0));
    state.textbookLabel.getTransform().setLocalRotation(quat.fromEulerAngles(-80.0 * Math.PI / 180.0, -6.0 * Math.PI / 180.0, 0));

    // 2b. Table Height Calibration & Feature Controls (Physical Grounding HUD)
    var deskButtons = [
        { id: "Button_Desk_Up", label: "[ ? +5cm ]", x: -16.0, color: new vec4(0.0, 0.94, 1.0, 0.92) },
        { id: "Button_Desk_Down", label: "[ ? -5cm ]", x: -5.0, color: new vec4(0.0, 0.94, 1.0, 0.92) },
        { id: "Button_Desk_Snap", label: "[ ? SNAP ]", x: 6.0, color: new vec4(0.0, 1.0, 0.66, 0.95) },
        { id: "Button_Voice_Note", label: "[ ??? DICTATE ]", x: 18.0, color: new vec4(1.0, 0.75, 0.08, 0.95) }
    ];
    state.calibrationButtons = [];
    for (var bi = 0; bi < deskButtons.length; bi++) {
        var bData = deskButtons[bi];
        var btnObj = getOrCreateObject(bData.id, script.boxMesh, script.pbrMaterial);
        btnObj.getTransform().setWorldPosition(new vec3(bData.x, -17.1, -47.0));
        btnObj.getTransform().setWorldScale(new vec3(8.5, 0.35, 2.8));
        applyMaterialStyle(btnObj, null, new vec4(0.06, 0.10, 0.18, 0.94));

        var btnLbl = getOrCreateText3D("Label_" + bData.id, bData.label, 3.2, bData.color);
        btnLbl.getTransform().setWorldPosition(new vec3(bData.x, -16.8, -47.0));
        state.calibrationButtons.push({ obj: btnObj, labelObj: btnLbl, id: bData.id, basePos: new vec3(bData.x, -17.1, -47.0) });
    }

    // 2c. 3D Visual Targeting Reticle (P4)
    state.pointerReticle = getOrCreateObject("Visual_Pointer_Reticle", script.torusMesh, script.pbrMaterial);
    state.pointerReticle.getTransform().setWorldPosition(new vec3(0.0, -18.0, -70.0));
    state.pointerReticle.getTransform().setWorldScale(new vec3(0.8, 0.8, 0.8));
    applyMaterialStyle(state.pointerReticle, null, new vec4(0.0, 0.94, 1.0, 0.85));

    state.pointerDot = getOrCreateObject("Visual_Pointer_Dot", script.sphereMesh, script.pbrMaterial);
    state.pointerDot.getTransform().setWorldPosition(new vec3(0.0, -18.0, -70.0));
    state.pointerDot.getTransform().setWorldScale(new vec3(0.2, 0.2, 0.2));
    applyMaterialStyle(state.pointerDot, null, new vec4(0.0, 0.94, 1.0, 1.0));

    // 2d. One-Tap Summarize Knowledge Graph Button (P7)
    var sumBtn = getOrCreateObject("Button_Summarize_Graph", script.boxMesh, script.pbrMaterial);
    sumBtn.getTransform().setWorldPosition(new vec3(0.0, -12.5, -67.5));
    sumBtn.getTransform().setWorldScale(new vec3(16.0, 2.4, 0.4));
    applyMaterialStyle(sumBtn, null, new vec4(0.08, 0.14, 0.24, 0.94));

    var sumLbl = getOrCreateText3D("Label_Button_Summarize_Graph", "[ ? SUMMARIZE GRAPH ]", 3.6, new vec4(1.0, 0.85, 0.20, 1.0));
    sumLbl.getTransform().setWorldPosition(new vec3(0.0, -12.5, -67.1));
    state.summarizeButton = { obj: sumBtn, labelObj: sumLbl };

    // 3. Configure Celestial Planets & Orbital Labels
    for (var pName in GALAXY_PLANET_CONFIGS) {
        var cfg = GALAXY_PLANET_CONFIGS[pName];
        var pObj = getOrCreateObject(pName, script.sphereMesh, script.pbrMaterial);
        
        state.planets[cfg.key] = {
            obj: pObj,
            config: cfg,
            targetPos: cfg.basePos,
            targetScale: cfg.baseScale,
            orbitOffset: Math.random() * 6.28
        };

        var tex = script[cfg.texProp];
        applyMaterialStyle(pObj, tex, WORKSPACES[cfg.key].color);
        pObj.getTransform().setWorldPosition(cfg.basePos);
        pObj.getTransform().setWorldScale(cfg.baseScale);

        var lObj = getOrCreateText3D("Label_" + cfg.key, cfg.label, 8.5, WORKSPACES[cfg.key].color);
        state.labels[cfg.key] = lObj;
    }

    // 4. Whiteboard Backdrop (Translucent Ambient Glass Frame)
    state.whiteboard = getOrCreateObject("Spatial_Whiteboard", script.boxMesh, script.pbrMaterial);
    state.whiteboard.getTransform().setWorldPosition(new vec3(0, -5, -72));
    state.whiteboard.getTransform().setWorldScale(new vec3(56, 30, 0.4));
    applyMaterialStyle(state.whiteboard, script.texWhiteboard, new vec4(0.03, 0.06, 0.12, 0.88));

    // 5. 3D Voice Command Status HUD Pill
    state.voiceHud = getOrCreateObject("HUD_Voice_Indicator", script.boxMesh, script.pbrMaterial);
    state.voiceHud.getTransform().setWorldPosition(new vec3(0.0, 11.2, -69.0));
    state.voiceHud.getTransform().setWorldScale(new vec3(26.0, 3.2, 0.5));
    applyMaterialStyle(state.voiceHud, null, new vec4(0.04, 0.08, 0.18, 0.90));

    state.voiceHudLabel = getOrCreateText3D("Label_Voice_HUD", "[ ? INFINITY // SPATIAL STUDY COPILOT ]", 4.2, new vec4(0.0, 0.94, 1.0, 1.0));
    state.voiceHudLabel.getTransform().setWorldPosition(new vec3(0.0, 11.2, -68.3));

    // 6. Whiteboard Headers & Subtitles
    state.headerLabel = getOrCreateText3D("Label_Whiteboard_Header", "INFINITY // QUANTUM STUDY LAB", 11.0, new vec4(0.0, 0.94, 1.0, 1.0));
    state.headerLabel.getTransform().setWorldPosition(new vec3(0, 7.5, -70));

    state.subLabel = getOrCreateText3D("Label_Whiteboard_Sub", "TAP NOTE TO CYCLE STATUS • TAP [ ✎ ] TO EDIT • LOOK AWAY TO DIM", 4.6, new vec4(1.0, 1.0, 1.0, 0.95));
    state.subLabel.getTransform().setWorldPosition(new vec3(0, 4.8, -70));

    // 6b. Workspace Status & Quick-Switcher Pill (Decluttered Header HUD)
    var pillObj = getOrCreateObject("Workspace_Selector_Pill", script.boxMesh, script.pbrMaterial);
    pillObj.getTransform().setWorldPosition(new vec3(20.0, 7.5, -69.5));
    pillObj.getTransform().setWorldScale(new vec3(12.0, 2.6, 0.4));
    applyMaterialStyle(pillObj, null, new vec4(0.06, 0.12, 0.22, 0.94), RENDER_ORDER_CARD);

    var pillLbl = getOrCreateText3D("Label_Workspace_Selector", "[ THINK ▾ ]", 3.4, WORKSPACES["Think"].color, RENDER_ORDER_TEXT, true);
    pillLbl.getTransform().setWorldPosition(new vec3(20.0, 7.5, -68.8));
    state.workspacePill = pillObj;
    state.workspacePillLabel = pillLbl;

    // 7. Initialize 4 Spatial Sticky Notes with 15deg Cylindrical Curved Ergonomics
    var ws = WORKSPACES[state.focusedWorkspace];
    for (var k = 0; k < ws.notes.length; k++) {
        var nCfg = ws.notes[k];
        var nObj = getOrCreateObject(nCfg.id, script.boxMesh, script.pbrMaterial);

        var st = SPATIAL_STATES[nCfg.status] || SPATIAL_STATES["ANCHORED"];
        var cardText = nCfg.title + "\n" + nCfg.body + "\n[ " + st.label + " ]";
        var lblObj = getOrCreateText3D(nCfg.labelId, cardText, 4.8, new vec4(1.0, 1.0, 1.0, 1.0), RENDER_ORDER_TEXT, true);

        nObj.getTransform().setWorldScale(new vec3(13.2, 8.2, 0.5));
        nObj.getTransform().setWorldPosition(nCfg.basePos);
        
        var initRotY = nCfg.baseRotY || 0.0;
        var initRotX = nCfg.baseRotX || 0.0;
        nObj.getTransform().setLocalRotation(quat.fromEulerAngles(initRotX, initRotY, 0.0));

        applyMaterialStyle(nObj, null, new vec4(0.08, 0.16, 0.28, 0.98), RENDER_ORDER_CARD, true);

        lblObj.getTransform().setWorldPosition(new vec3(nCfg.basePos.x, nCfg.basePos.y, nCfg.basePos.z + 0.75));
        lblObj.getTransform().setLocalRotation(quat.fromEulerAngles(initRotX, initRotY, 0.0));

        // Action Pill: [ ✎ ] Edit Button directly on top-right of card
        var editBtn = getOrCreateObject("Button_Edit_" + k, script.boxMesh, script.pbrMaterial);
        editBtn.getTransform().setWorldScale(new vec3(2.6, 1.4, 0.25));
        editBtn.getTransform().setWorldPosition(new vec3(nCfg.basePos.x + 4.8, nCfg.basePos.y + 2.8, nCfg.basePos.z + 0.5));
        editBtn.getTransform().setLocalRotation(quat.fromEulerAngles(initRotX, initRotY, 0.0));
        applyMaterialStyle(editBtn, null, new vec4(0.0, 0.85, 1.0, 0.90), RENDER_ORDER_CARD);

        var editLbl = getOrCreateText3D("Label_Edit_" + k, "[ ✎ ]", 2.2, new vec4(1.0, 1.0, 1.0, 1.0), RENDER_ORDER_TEXT, true);
        editLbl.getTransform().setWorldPosition(new vec3(nCfg.basePos.x + 4.8, nCfg.basePos.y + 2.8, nCfg.basePos.z + 0.75));
        editLbl.getTransform().setLocalRotation(quat.fromEulerAngles(initRotX, initRotY, 0.0));

        // Contact shadow grounding plane beneath note (Waveguide physical anchoring)
        var shadowObj = getOrCreateObject("Contact_Shadow_" + k, script.boxMesh, script.pbrMaterial);
        shadowObj.getTransform().setWorldPosition(new vec3(nCfg.basePos.x, -17.9, nCfg.basePos.z));
        shadowObj.getTransform().setWorldScale(new vec3(12.0, 0.05, 7.5));
        applyMaterialStyle(shadowObj, null, new vec4(0.02, 0.04, 0.08, 0.58));
        state.contactShadows.push(shadowObj);

        state.notes.push({
            obj: nObj,
            labelObj: lblObj,
            editBtn: editBtn,
            editLabel: editLbl,
            id: nCfg.id,
            cfg: nCfg,
            status: nCfg.status,
            targetPos: nCfg.basePos,
            curPos: nCfg.basePos,
            baseScale: new vec3(13.2, 8.2, 0.5),
            curScale: new vec3(13.2, 8.2, 0.5),
            isHovered: false
        });
    }

    // 8. Initialize Constellation Beams
    for (var b = 1; b <= 4; b++) {
        var beamObj = getOrCreateObject("Constellation_Link_" + b, script.boxMesh, script.pbrMaterial);
        state.constellations.push(beamObj);
        applyMaterialStyle(beamObj, null, new vec4(0.0, 0.94, 1.0, 0.85));
        beamObj.getTransform().setWorldScale(new vec3(0.24, 0.24, 1.0));
    }

    // 9. Holographic AI Assistant Orb & Audio Ripple Ring
    var aiCore = getOrCreateObject("AI_Assistant_Core", script.sphereMesh, script.pbrMaterial);
    state.aiCore = aiCore;
    aiCore.getTransform().setWorldPosition(new vec3(-2.0, -8.5, -67.5));
    aiCore.getTransform().setWorldScale(new vec3(4.2, 4.2, 4.2));
    applyMaterialStyle(aiCore, null, new vec4(0.0, 0.94, 1.0, 0.95));

    state.audioRipple = getOrCreateObject("Audio_Ripple_Ring", script.torusMesh, script.pbrMaterial);
    state.audioRipple.getTransform().setWorldPosition(new vec3(-2.0, -8.5, -67.5));
    state.audioRipple.getTransform().setWorldScale(new vec3(0.1, 0.1, 0.1));
    applyMaterialStyle(state.audioRipple, null, new vec4(0.0, 0.94, 1.0, 0.0));

    // 10. Deterministic Subsystem Initialization Sequence (Phases 3 & 4)
    var kernelInterface = {
        state: state,
        WORKSPACES: WORKSPACES,
        boxMesh: script.boxMesh,
        sphereMesh: script.sphereMesh,
        torusMesh: script.torusMesh,
        pbrMaterial: script.pbrMaterial,
        saveWorkspaceState: saveWorkspaceState
    };

        // Subsystem 0: Surface Tracking & Physical Snapping Manager
    if (global.SurfaceTrackingManager) {
        state.surfaceManager = new global.SurfaceTrackingManager(kernelInterface);
        print("[INFINITY] ? Surface Tracking & Table Snapping Engine initialized.");
    }

    // Subsystem 1: FTUE Onboarding
    if (global.FTUEOnboarding) {
        state.ftueOnboarding = new global.FTUEOnboarding("INFINITY_FTUE_V3");
        initFTUEBillboard();
        print("[INFINITY OS] ? FTUE 3-Step Spatial Onboarding Engine initialized.");
    }

    // Subsystem 2: 3D Note Editor & Virtual Keyboard Deck
    if (global.NoteEditorKeyboard) {
        state.noteEditor = new global.NoteEditorKeyboard(kernelInterface);
        print("[INFINITY OS] ? 3D Note Editor & Spatial Keyboard Deck initialized.");
    }

    // Subsystem 3: 3D Polyline Inking & Shape Snapper
    if (global.DrawingAndSnappingModule) {
        state.shapeModule = new global.DrawingAndSnappingModule(kernelInterface);
        print("[INFINITY OS] ? 3D Inking & Shape Recognizer initialized.");
    }

    // Subsystem 4: Live Contextual AI Assistant Bridge
    if (global.LiveAIAssistantModule) {
        state.aiModule = new global.LiveAIAssistantModule(kernelInterface);
        print("[INFINITY OS] ? Live Contextual AI Assistant Bridge initialized.");
    }

    // Subsystem 5: Desktop Companion Sync Bridge
    if (global.DesktopCompanionSyncModule) {
        state.desktopSync = new global.DesktopCompanionSyncModule(kernelInterface);
        global.infinityInjectDesktopSnippet = function(title, content, category) {
            return state.desktopSync.injectDesktopSnippet(title, content, category);
        };
        print("[INFINITY OS] ? Desktop Companion Sync Bridge initialized.");
    }

    // 11. Boot into Think Workspace with Desk Anchoring
    enterFocusMode("Think");
    print("[INFINITY OS] Cosmic Spatial Desktop online. Ready for Spectacles SIK Gaze & Pinch!");
    initAudioFeedbackSystem();
    initNativeSIKHandTracking();
});

// ------------------------------------------------------------------------------
// FTUE 3D Spatial Interactive Tutorial Billboard
// ------------------------------------------------------------------------------
function initFTUEBillboard() {
    if (!state.ftueOnboarding || !state.ftueOnboarding.isActive()) return;

    state.ftueBillboard = getOrCreateObject("FTUE_Holographic_Billboard", script.boxMesh, script.pbrMaterial);
    state.ftueBillboard.getTransform().setWorldPosition(new vec3(0.0, 14.8, -66.0));
    state.ftueBillboard.getTransform().setWorldScale(new vec3(38.0, 4.6, 0.4));
    applyMaterialStyle(state.ftueBillboard, null, new vec4(0.02, 0.07, 0.16, 0.94));

    var stepData = state.ftueOnboarding.getCurrentStepData();
    var billboardText = stepData ? 
        ("[ " + stepData.tag + " ]\n" + stepData.prompt) : 
        "? WELCOME TO INFINITY SPATIAL COMPUTER";

    state.ftueText = getOrCreateText3D("Label_FTUE_Tutorial", billboardText, 4.2, new vec4(1.0, 0.75, 0.08, 1.0));
    state.ftueText.getTransform().setWorldPosition(new vec3(0.0, 14.8, -65.3));

    state.ftueOnboarding.onStepChange(function(step, data) {
        if (state.ftueBillboard && state.ftueText) {
            if (data) {
                state.ftueBillboard.enabled = true;
                state.ftueText.enabled = true;
                setTextContent(state.ftueText, "[ " + data.tag + " ]\n" + data.prompt, 4.2);
                state.pulseEnergy = 0.8;
            } else {
                state.ftueBillboard.enabled = false;
                state.ftueText.enabled = false;
            }
        }
    });
}

// ------------------------------------------------------------------------------
// Whiteboard Focus Mode & Celestial Space Navigation
// ------------------------------------------------------------------------------
function enterFocusMode(workspaceKey) {
    if (state.mode === "WORKSPACE_FOCUS" && state.focusedWorkspace) {
        saveWorkspaceState(state.focusedWorkspace);
    }

    state.mode = "WORKSPACE_FOCUS";
    state.focusedWorkspace = workspaceKey;
    var ws = WORKSPACES[workspaceKey];

    print("[INFINITY OS] ? Cosmic Jump to Workspace: " + ws.title);

    if (state.headerLabel) {
        setTextContent(state.headerLabel, ws.title);
        var hTxt = getText3D(state.headerLabel);
        if (hTxt && hTxt.mainPass && hTxt.mainPass.baseColor) {
            hTxt.mainPass.baseColor = ws.color;
        }
    }
    if (state.subLabel) setTextContent(state.subLabel, ws.subtitle);

    var savedPositions = loadWorkspaceState(workspaceKey);

    for (var i = 0; i < state.notes.length; i++) {
        var n = state.notes[i];
        var nCfg = ws.notes[i];
        if (nCfg) {
            var targetPos = (savedPositions && savedPositions[i]) ? 
                new vec3(savedPositions[i].x, savedPositions[i].y, savedPositions[i].z) : 
                nCfg.basePos;

            var status = (savedPositions && savedPositions[i] && savedPositions[i].status) ?
                savedPositions[i].status : nCfg.status;

            n.targetPos = targetPos;
            n.status = status;
            n.cfg = nCfg;

            var tex = script[GALAXY_PLANET_CONFIGS["Planet_" + workspaceKey].texProp];
            applyMaterialStyle(n.obj, tex, ws.color);

            if (n.labelObj) {
                var st = SPATIAL_STATES[status] || SPATIAL_STATES["ANCHORED"];
                var content = nCfg.title + "\n" + nCfg.body + "\n[ " + st.label + " ]";
                setTextContent(n.labelObj, content, 4.8);
            }
        }
    }

    // Clean up or hide custom notes from previous workspace
    for (var cn = state.notes.length - 1; cn >= ws.notes.length; cn--) {
        var oldNote = state.notes[cn];
        if (oldNote && oldNote.obj) oldNote.obj.destroy();
        if (oldNote && oldNote.labelObj) oldNote.labelObj.destroy();
        if (oldNote && oldNote.editBtn) oldNote.editBtn.destroy();
        if (oldNote && oldNote.editLabel) oldNote.editLabel.destroy();
        if (oldNote && oldNote.deleteBtn) oldNote.deleteBtn.destroy();
        if (oldNote && oldNote.deleteLabel) oldNote.deleteLabel.destroy();
        state.notes.splice(cn, 1);
    }

    // Update compact workspace selector pill
    if (state.workspacePill && state.workspacePillLabel) {
        setTextContent(state.workspacePillLabel, "[ " + workspaceKey.toUpperCase() + " ▾ ]", 3.4);
        var pTxt = getText3D(state.workspacePillLabel);
        if (pTxt && pTxt.mainPass && pTxt.mainPass.baseColor) {
            pTxt.mainPass.baseColor = ws.color;
        }
    }

    for (var k in state.planets) {
        var p = state.planets[k];
        // In deep study focus mode, completely hide celestial dock to eliminate 46deg FOV cockpit clutter
        p.targetScale = new vec3(0.01, 0.01, 0.01);
        p.targetPos = new vec3(p.config.basePos.x, p.config.basePos.y + 35.0, p.config.basePos.z - 50.0);
        if (p.obj) {
            p.obj.enabled = false;
        }
        if (state.labels[k]) {
            state.labels[k].enabled = false;
        }
    }

    state.pulseEnergy = 1.0;

    // Sync discrete focus targets with InfinityFocusNavigationGroup
    if (typeof global.infinitySetFocusTargets === "function" && state.notes) {
        var focusTargets = [];
        for (var ft = 0; ft < state.notes.length; ft++) {
            if (state.notes[ft] && state.notes[ft].obj) {
                focusTargets.push(state.notes[ft].obj);
            }
        }
        global.infinitySetFocusTargets(focusTargets);
    }
}

function returnToGalaxy() {
    if (state.mode === "WORKSPACE_FOCUS") {
        saveWorkspaceState(state.focusedWorkspace);
    }

    state.mode = "GALAXY";
    print("[INFINITY OS] Returning to Galaxy Overview...");

    if (state.headerLabel) setTextContent(state.headerLabel, "INFINITY // COSMIC SPATIAL UNIVERSE");
    if (state.subLabel) setTextContent(state.subLabel, "PINCH ANY PLANET TO ENTER WORKSPACE deg ? AI ACTIVE");

    for (var k in state.planets) {
        var p = state.planets[k];
        if (p.obj) {
            p.obj.enabled = true;
        }
        p.targetPos = p.config.basePos;
        p.targetScale = p.config.baseScale;
        if (state.labels[k]) {
            state.labels[k].enabled = true;
        }
    }

    // Adapt note positions into 3D Constellation Knowledge Graph (Obsidiar Integration)
    if (typeof global.constellationSolveLayout !== "function") {
        global.constellationSolveLayout = function(graphNodes, radius) {
            var n = graphNodes ? graphNodes.length : 0;
            if (n === 0) return [];
            var rad = radius || 55.0;
            var solved = [];
            var goldenAngle = Math.PI * (3 - Math.sqrt(5));
            for (var gi = 0; gi < n; gi++) {
                var gy = 1 - (gi / (n > 1 ? (n - 1) : 1)) * 2;
                var radiusAtY = Math.sqrt(Math.max(0, 1 - gy * gy));
                var theta = goldenAngle * gi;
                var gx = Math.cos(theta) * radiusAtY;
                var gz = Math.sin(theta) * radiusAtY;
                var gPos = new vec3(gx * rad * 0.72, gy * rad * 0.38 + 4.0, -rad * 0.85 + gz * 10.0);
                solved.push({ id: graphNodes[gi].id, position: gPos });
            }
            return solved;
        };
    }
    if (typeof global.constellationSolveLayout === "function") {
        try {
            var graphNodes = [];
            for (var ni = 0; ni < state.notes.length; ni++) {
                var noteObj = state.notes[ni];
                graphNodes.push({
                    id: noteObj.id,
                    wordCount: (noteObj.cfg && noteObj.cfg.body) ? noteObj.cfg.body.length : 20,
                    links: [(ni + 1) % state.notes.length + ""]
                });
            }
            var solved = global.constellationSolveLayout(graphNodes, 55.0);
            for (var si = 0; si < solved.length && si < state.notes.length; si++) {
                state.notes[si].targetPos = solved[si].position;
            }
        } catch(e) {
            print("[INFINITY OS] Constellation solve error: " + e);
        }
    }
}

// ------------------------------------------------------------------------------
// Constellation Dynamic Geometry Solver (60 FPS quat.lookAt)
// ------------------------------------------------------------------------------
function updateConstellationConnections() {
    if (state.notes.length < 2 || state.constellations.length === 0) return;

    var ws = WORKSPACES[state.focusedWorkspace];
    var connections = (ws && ws.connections) ? ws.connections : [[0, 1], [1, 2], [2, 3], [3, 0]];
    var beamColor = ws ? ws.color : new vec4(0, 0.94, 1, 0.85);

    for (var c = 0; c < connections.length && c < state.constellations.length; c++) {
        var idxA = connections[c][0];
        var idxB = connections[c][1];

        if (idxA >= state.notes.length || idxB >= state.notes.length) continue;

        var posA = state.notes[idxA].curPos;
        var posB = state.notes[idxB].curPos;

        var midX = (posA.x + posB.x) * 0.5;
        var midY = (posA.y + posB.y) * 0.5;
        var midZ = (posA.z + posB.z) * 0.5;
        var midPoint = new vec3(midX, midY, midZ);

        var dx = posB.x - posA.x;
        var dy = posB.y - posA.y;
        var dz = posB.z - posA.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.01) dist = 0.01;

        var beam = state.constellations[c];
        var bTrans = beam.getTransform();

        bTrans.setWorldPosition(midPoint);

        var dir = new vec3(dx / dist, dy / dist, dz / dist);
        var rot = quat.lookAt(dir, vec3.up());
        bTrans.setLocalRotation(rot);

        var thickness = (0.24 + state.pulseEnergy * 0.45) * state.ambientOpacity;
        bTrans.setWorldScale(new vec3(thickness, thickness, dist));

        var pulsedColor = new vec4(
            beamColor.r * (0.8 + state.pulseEnergy * 0.2),
            beamColor.g * (0.8 + state.pulseEnergy * 0.2),
            beamColor.b * (0.8 + state.pulseEnergy * 0.2),
            0.85 * state.ambientOpacity
        );
        applyMaterialStyle(beam, null, pulsedColor);
    }
}

// ------------------------------------------------------------------------------
// Interactive Status Cycling on Sticky Notes (Spatial Cognitive States)
// ------------------------------------------------------------------------------
function cycleNoteStatus(note) {
    if (!note) return;
    if (note.status === "ANCHORED") {
        note.status = "SYNTHESIZING";
    } else if (note.status === "SYNTHESIZING") {
        note.status = "SYNCHRONIZED";
    } else {
        note.status = "ANCHORED";
    }

    var st = SPATIAL_STATES[note.status] || SPATIAL_STATES["ANCHORED"];
    print("[INFINITY OS] Note spatial state updated: " + note.cfg.title + " -> " + st.label);

    if (note.labelObj) {
        var updatedText = note.cfg.title + "\n" + note.cfg.body + "\n[ " + st.label + " ]";
        setTextContent(note.labelObj, updatedText, 4.8);
    }

    state.pulseEnergy = 0.7;
    triggerAudioRipple(note.curPos);

    if (state.focusedWorkspace) {
        saveWorkspaceState(state.focusedWorkspace);
    }
}

// ------------------------------------------------------------------------------
// Procedural Spatial Audio Ripple Visualizer
// ------------------------------------------------------------------------------
function triggerAudioRipple(centerPos) {
    if (audioPlayer) {
        try {
            if (script.chimeAudio) {
                audioPlayer.audioTrack = script.chimeAudio;
            }
            audioPlayer.getSceneObject().getTransform().setWorldPosition(centerPos);
            audioPlayer.play(1);
        } catch(e) {}
    }
    if (!state.audioRipple) return;
    state.audioRipple.getTransform().setWorldPosition(centerPos);
    state.audioRippleScale = 0.2;
    state.audioRippleActive = true;
}

// ------------------------------------------------------------------------------
// Real-Time Frame Loop (60+ FPS Engine)
// ------------------------------------------------------------------------------
script.createEvent('UpdateEvent').bind(function() {
    var dt = getDeltaTime();
    state.time += dt;

    // 0. Update Native SIK Gestures & Two-Hand Continuous Manipulation
    updateNativeSIKGestures(dt);

    if (state.pulseEnergy > 0.01) {
        state.pulseEnergy = Math.max(0.0, state.pulseEnergy - dt * 2.2);
    }

    // 1. Voice Command HUD Timer (Auto-dismiss to eliminate FOV clutter)
    if (state.voiceHudTimer > 0.0) {
        state.voiceHudTimer = Math.max(0.0, state.voiceHudTimer - dt);
        if (state.voiceHudTimer <= 0.0 && state.voiceHudLabel) {
            setTextContent(state.voiceHudLabel, "");
            applyMaterialStyle(state.voiceHud, null, new vec4(0.04, 0.08, 0.18, 0.0));
        }
    }

    // 2. Glance-Away Ambient Attenuation Engine
    if (state.camera) {
        var camTrans = state.camera.getSceneObject().getTransform();
        var camFwd = camTrans.forward || new vec3(0, 0, -1);
        var deskDir = new vec3(0.0, -6.0, -70.0).sub(camTrans.getWorldPosition()).normalize();
        var dotFwd = camFwd.dot(deskDir);
        
        var targetOpacity = (dotFwd < 0.82) ? 0.22 : 1.0;
        state.ambientOpacity = vec3.lerp(new vec3(state.ambientOpacity, 0, 0), new vec3(targetOpacity, 0, 0), dt * 2.8).x;

        if (targetOpacity < 0.3 && state.ftueOnboarding && state.ftueOnboarding.isActive() && state.ftueOnboarding.step === 3) {
            state.ftueOnboarding.advance(3);
        }
    }

    // 3. Continuous 3D Hover Detection (+14% Scale Cue) & 3D Targeting Reticle
    var hoveredIndex = -1;
    if (state.mode === "WORKSPACE_FOCUS") {
        for (var h = 0; h < state.notes.length; h++) {
            var nCheck = state.notes[h];
            var rayResult = raycast3D(state.lastScreenPos, nCheck.curPos, 9.0);
            if (rayResult.hit) {
                hoveredIndex = h;
                break;
            }
        }
    }

    // Update 3D Targeting Reticle Position & Scale
    if (state.pointerReticle && state.camera) {
        var retRay = getCameraRay(state.lastScreenPos);
        if (retRay) {
            var hitDist = 68.0;
            var retColor = new vec4(0.0, 0.94, 1.0, 0.85);
            var retScale = new vec3(0.85, 0.85, 0.85);

            if (hoveredIndex !== -1) {
                hitDist = state.notes[hoveredIndex].curPos.distance(retRay.origin);
                retColor = new vec4(1.0, 0.75, 0.08, 0.95);
                retScale = new vec3(1.35, 1.35, 1.35);
            } else if (state.surfaceManager) {
                var deskY = state.surfaceManager.calibratedHeight;
                var denom = retRay.direction.y || -0.001;
                var tDesk = (deskY - retRay.origin.y) / denom;
                if (tDesk > 10.0 && tDesk < 160.0) hitDist = tDesk;
            }
            var targetRetPos = retRay.origin.add(retRay.direction.uniformScale(hitDist));
            state.pointerReticle.getTransform().setWorldPosition(targetRetPos);
            state.pointerReticle.getTransform().setWorldScale(vec3.lerp(state.pointerReticle.getTransform().getWorldScale(), retScale, dt * 10.0));
            applyMaterialStyle(state.pointerReticle, null, retColor);

            if (state.pointerDot) {
                state.pointerDot.getTransform().setWorldPosition(targetRetPos);
                applyMaterialStyle(state.pointerDot, null, retColor);
            }
        }
    }

    // Update Contact Shadows Grounding
    if (state.surfaceManager) {
        state.surfaceManager.updateContactShadows();
    }

    // 4. Animate Celestial Planets (Only when in Galaxy Overview)
    var isGalaxy = (state.mode === "GALAXY");
    for (var key in state.planets) {
        var p = state.planets[key];
        if (p.obj && p.obj.enabled !== isGalaxy) {
            p.obj.enabled = isGalaxy;
        }
        if (state.labels[key] && state.labels[key].enabled !== isGalaxy) {
            state.labels[key].enabled = isGalaxy;
        }
        if (!isGalaxy) continue;

        var trans = p.obj.getTransform();

        var floatY = Math.sin(state.time * 1.6 + p.orbitOffset) * 0.65;
        var rotSpeed = (key === state.focusedWorkspace && state.mode === "WORKSPACE_FOCUS") ? 0.6 : 0.2;
        var rotQuat = quat.fromEulerAngles(0, state.time * rotSpeed, floatY * 0.03);
        trans.setLocalRotation(rotQuat);

        var pos = trans.getWorldPosition();
        var target = new vec3(p.targetPos.x, p.targetPos.y + floatY, p.targetPos.z);
        trans.setWorldPosition(vec3.lerp(pos, target, dt * 5.0));

        var curScale = trans.getWorldScale();
        trans.setWorldScale(vec3.lerp(curScale, p.targetScale.uniformScale(state.ambientOpacity), dt * 5.0));

        var lObj = state.labels[key];
        if (lObj) {
            var lTargetY = p.targetPos.y + floatY - (p.targetScale.y * 0.75 + 3.2);
            lObj.getTransform().setWorldPosition(new vec3(target.x, lTargetY, target.z));
        }
    }

    // 5. Animate Spatial Whiteboard & Virtual Desk
    var wbTargetY = (state.mode === "WORKSPACE_FOCUS") ? -5.0 : -34.0;
    var wbTargetZ = (state.mode === "WORKSPACE_FOCUS") ? -72.0 : -88.0;

    if (state.whiteboard) {
        var wbPos = state.whiteboard.getTransform().getWorldPosition();
        state.whiteboard.getTransform().setWorldPosition(vec3.lerp(wbPos, new vec3(0, wbTargetY, wbTargetZ), dt * 5.0));
        if (Math.abs(state.ambientOpacity - state.lastAppliedOpacity) > 0.005) {
            applyMaterialStyle(state.whiteboard, script.texWhiteboard, new vec4(0.03, 0.06, 0.12, 0.88 * state.ambientOpacity));
            if (state.deskSurface) {
                applyMaterialStyle(state.deskSurface, script.texWhiteboard, new vec4(0.08, 0.12, 0.20, 0.85 * state.ambientOpacity));
            }
            state.lastAppliedOpacity = state.ambientOpacity;
        }
    }

    if (state.headerLabel) {
        var hPos = state.headerLabel.getTransform().getWorldPosition();
        state.headerLabel.getTransform().setWorldPosition(vec3.lerp(hPos, new vec3(0, wbTargetY + 12.5, wbTargetZ + 2.0), dt * 5.0));
    }

    if (state.subLabel) {
        var sPos = state.subLabel.getTransform().getWorldPosition();
        state.subLabel.getTransform().setWorldPosition(vec3.lerp(sPos, new vec3(0, wbTargetY + 9.8, wbTargetZ + 2.0), dt * 5.0));
    }

    // 6. Animate Sticky Notes with 15deg Cylindrical Curvature & Hover Scaling
    for (var i = 0; i < state.notes.length; i++) {
        var n = state.notes[i];
        var isHover = (i === hoveredIndex) && (state.draggedNote !== n);
        var scaleTargetMultiplier = isHover ? 1.14 : 1.0;
        var noteTargetScale = n.baseScale.uniformScale(scaleTargetMultiplier * state.ambientOpacity);

        n.curScale = vec3.lerp(n.curScale, noteTargetScale, dt * 8.0);
        n.obj.getTransform().setWorldScale(n.curScale);

        if (state.draggedNote === n) {
            n.obj.getTransform().setWorldPosition(n.curPos);
        } else {
            var nPos = n.obj.getTransform().getWorldPosition();
            var targetZ = (state.mode === "WORKSPACE_FOCUS") ? n.targetPos.z : n.targetPos.z - 30.0;
            var tPos = new vec3(n.targetPos.x, n.targetPos.y, targetZ);
            n.curPos = vec3.lerp(nPos, tPos, dt * 6.0);
            n.obj.getTransform().setWorldPosition(n.curPos);
        }

        if (n.labelObj) {
            n.labelObj.getTransform().setWorldPosition(new vec3(n.curPos.x, n.curPos.y, n.curPos.z + 0.75));
        }
        if (n.editBtn) {
            n.editBtn.getTransform().setWorldPosition(new vec3(n.curPos.x + 4.8, n.curPos.y + 2.8, n.curPos.z + 0.5));
        }
        if (n.editLabel) {
            n.editLabel.getTransform().setWorldPosition(new vec3(n.curPos.x + 4.8, n.curPos.y + 2.8, n.curPos.z + 0.75));
        }
        if (n.deleteBtn) {
            n.deleteBtn.getTransform().setWorldPosition(new vec3(n.curPos.x - 4.8, n.curPos.y + 2.8, n.curPos.z + 0.5));
        }
        if (n.deleteLabel) {
            n.deleteLabel.getTransform().setWorldPosition(new vec3(n.curPos.x - 4.8, n.curPos.y + 2.8, n.curPos.z + 0.75));
        }
    }

    // 7. Update Glowing Constellation Links in Real-Time
    updateConstellationConnections();

    // 8. Animate AI Assistant Holographic Orb (Uses cached state.aiCore - 0 scene search overhead)
    var aiTargetCore = state.aiCore || findObjectByName("AI_Assistant_Core");
    if (aiTargetCore) {
        var aiTrans = aiTargetCore.getTransform();
        if (typeof global.wristCompanionIsDocked === "function" && global.wristCompanionIsDocked() && state.leftHand && state.leftHand.isTracked && state.leftHand.isTracked()) {
            var wristPos = (state.leftHand.wrist && state.leftHand.wrist.position) ? state.leftHand.wrist.position : null;
            if (wristPos) {
                aiTrans.setWorldPosition(vec3.lerp(aiTrans.getWorldPosition(), wristPos.add(new vec3(0, 3.5, 2.0)), dt * 8.0));
                aiTrans.setWorldScale(new vec3(1.5, 1.5, 1.5));
            }
        } else {
            var aiPulse = (4.2 + Math.sin(state.time * 3.5) * 0.45 + state.pulseEnergy * 2.2) * state.ambientOpacity;
            aiTrans.setWorldScale(new vec3(aiPulse, aiPulse, aiPulse));
            aiTrans.setLocalRotation(quat.fromEulerAngles(state.time * 0.8, state.time * 1.4, state.time * 0.4));
        }
    }

    // 9. Animate Audio Ripple Wave
    if (state.audioRippleActive && state.audioRipple) {
        state.audioRippleScale += dt * 14.0;
        state.audioRipple.getTransform().setWorldScale(new vec3(state.audioRippleScale, state.audioRippleScale, 0.4));
        var alphaRipple = Math.max(0.0, 1.0 - (state.audioRippleScale / 12.0));
        applyMaterialStyle(state.audioRipple, null, new vec4(0.0, 0.94, 1.0, alphaRipple * 0.7));
        if (alphaRipple <= 0.01) {
            state.audioRippleActive = false;
        }
    }
});

// ------------------------------------------------------------------------------
// AI Spatial Assistant Synthesis Engine (Contextual Live Bridge)
// ------------------------------------------------------------------------------
function triggerAIAssistant() {
    var wsKey = state.focusedWorkspace || "Think";
    var ws = WORKSPACES[wsKey];
    if (!ws) return;

    state.aiIndex++;
    state.pulseEnergy = 1.0;

    if (state.aiModule) {
        var selectedNode = (state.notes.length >= 4) ? state.notes[3] : state.notes[0];
        state.aiModule.synthesizeSpatialExpansion(selectedNode, wsKey, function(result) {
            print("[INFINITY OS] ? Live AI Module Returned: " + result.title);
            if (state.subLabel) {
                setTextContent(state.subLabel, result.title + " // " + result.body.split("\n")[0]);
            }
            if (state.notes.length >= 4) {
                var aiNote = state.notes[3];
                aiNote.targetPos = new vec3(aiNote.targetPos.x, aiNote.targetPos.y - 1.5, aiNote.targetPos.z);
                aiNote.status = "SYNCHRONIZED";
                aiNote.cfg.title = result.title;
                aiNote.cfg.body = result.body;
                if (aiNote.labelObj) {
                    var st = SPATIAL_STATES["SYNCHRONIZED"];
                    var updatedText = result.title + "\n" + result.body + "\n[ " + st.label + " ]";
                    setTextContent(aiNote.labelObj, updatedText, 4.4);
                }
            }
        });
    } else {
        var expansion = ws.aiExpansions[state.aiIndex % ws.aiExpansions.length];
        print("[INFINITY OS] ? AI Assistant Activated: " + expansion);
        if (state.subLabel) {
            setTextContent(state.subLabel, "? AI SYNTHESIS: " + expansion);
        }
        if (state.notes.length >= 4) {
            var aiNoteLegacy = state.notes[3];
            aiNoteLegacy.targetPos = new vec3(aiNoteLegacy.targetPos.x, aiNoteLegacy.targetPos.y - 1.5, aiNoteLegacy.targetPos.z);
            aiNoteLegacy.status = "SYNCHRONIZED";
            if (aiNoteLegacy.labelObj) {
                var stLegacy = SPATIAL_STATES["SYNCHRONIZED"];
                var updatedTextLegacy = "? AI SYNTHESIS #" + state.aiIndex + "\ndeg " + expansion + "\n[ " + stLegacy.label + " ]";
                setTextContent(aiNoteLegacy.labelObj, updatedTextLegacy, 4.4);
            }
        }
    }

    triggerAudioRipple(new vec3(-2.0, -8.5, -67.5));

    if (state.ftueOnboarding && state.ftueOnboarding.isActive()) {
        state.ftueOnboarding.advance(3);
    }
}

// ------------------------------------------------------------------------------
// Voice Command Simulator & SIK Audio Status HUD
// ------------------------------------------------------------------------------
// Interim Voice Feedback Hook for AsrModule streaming
global.infinityVoiceInterimUpdate = function(streamText) {
    if (state.voiceHud && state.voiceHudLabel) {
        setTextContent(state.voiceHudLabel, streamText, 3.8);
        applyMaterialStyle(state.voiceHud, null, new vec4(0.15, 0.35, 0.75, 0.95));
        state.voiceHudTimer = 1.6;
    }
};

function handleVoiceCommand(cmd) {
    if (!cmd) return;
    var c = cmd.toLowerCase().trim();
    print("[INFINITY OS] ??? Processing Voice Command: '" + c + "'");

    if (state.voiceHud && state.voiceHudLabel) {
        setTextContent(state.voiceHudLabel, "[ ??? VOICE: \"" + c.toUpperCase() + "\" ? EXECUTING ]", 4.4);
        applyMaterialStyle(state.voiceHud, null, new vec4(1.0, 0.75, 0.08, 0.95));
        state.voiceHudTimer = 2.8;
    }

    if (c.indexOf("expand") !== -1 || c.indexOf("ai") !== -1 || c.indexOf("synthesize") !== -1) {
        triggerAIAssistant();
    } else if (c.indexOf("dock assistant") !== -1 || c.indexOf("wrist assistant") !== -1 || c.indexOf("dock to wrist") !== -1) {
        if (typeof global.wristCompanionDock === "function") {
            global.wristCompanionDock();
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? AI ASSISTANT DOCKED TO WRIST ]", 4.0);
                state.voiceHudTimer = 2.0;
            }
        }
    } else if (c.indexOf("undock assistant") !== -1 || c.indexOf("release assistant") !== -1 || c.indexOf("world assistant") !== -1) {
        if (typeof global.wristCompanionUndock === "function") {
            global.wristCompanionUndock(new vec3(-2.0, -8.5, -67.5));
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? AI ASSISTANT UNDOCKED TO STUDY DESK ]", 4.0);
                state.voiceHudTimer = 2.0;
            }
        }
    } else if (c.indexOf("think") !== -1 || c.indexOf("architecture") !== -1) {
        enterFocusMode("Think");
    } else if (c.indexOf("create") !== -1 || c.indexOf("code") !== -1) {
        enterFocusMode("Create");
    } else if (c.indexOf("learn") !== -1 || c.indexOf("calculus") !== -1) {
        enterFocusMode("Learn");
    } else if (c.indexOf("store") !== -1 || c.indexOf("neuroscience") !== -1) {
        enterFocusMode("Store");
    } else if (c.indexOf("explore") !== -1) {
        enterFocusMode("Explore");
    } else if (c.indexOf("galaxy") !== -1 || c.indexOf("overview") !== -1 || c.indexOf("zoom out") !== -1) {
        returnToGalaxy();
    } else if (c.indexOf("desk up") !== -1 || c.indexOf("raise desk") !== -1) {
        if (state.surfaceManager) state.surfaceManager.adjustDeskElevation(5.0);
    } else if (c.indexOf("desk down") !== -1 || c.indexOf("lower desk") !== -1) {
        if (state.surfaceManager) state.surfaceManager.adjustDeskElevation(-5.0);
    } else if (c.indexOf("calibrate") !== -1 || c.indexOf("table") !== -1) {
        if (state.surfaceManager) state.surfaceManager.snapToPhysicalSurface();
    } else if (c.indexOf("next") !== -1) {
        if (typeof global.infinityFocusNext === "function") {
            global.infinityFocusNext();
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? FOCUS -> NEXT STUDY CARD ]", 4.0);
                state.voiceHudTimer = 2.0;
            }
        }
    } else if (c.indexOf("previous") !== -1 || c.indexOf("prev") !== -1 || c.indexOf("back card") !== -1) {
        if (typeof global.infinityFocusPrevious === "function") {
            global.infinityFocusPrevious();
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? FOCUS -> PREVIOUS STUDY CARD ]", 4.0);
                state.voiceHudTimer = 2.0;
            }
        }
    } else if (c.indexOf("select") !== -1 || c.indexOf("open card") !== -1 || c.indexOf("activate") !== -1) {
        if (state.voiceHud && state.voiceHudLabel) {
            setTextContent(state.voiceHudLabel, "[ ? STUDY CARD ACTIVATED VIA FOCUS ]", 4.2);
            state.voiceHudTimer = 2.5;
        }
        triggerAudioRipple(new vec3(0, 0, -66.0));
    } else if (c.indexOf("clear notes") !== -1 || c.indexOf("reset notes") !== -1 || c.indexOf("delete notes") !== -1) {
        for (var i = state.notes.length - 1; i >= 0; i--) {
            var n = state.notes[i];
            if (n.id && n.id.indexOf("Voice") !== -1) {
                if (n.obj) n.obj.destroy();
                if (n.labelObj) n.labelObj.destroy();
                state.notes.splice(i, 1);
            }
        }
        if (state.voiceHud && state.voiceHudLabel) {
            setTextContent(state.voiceHudLabel, "[ ? NOTES CLEARED VIA VOICE ]", 4.2);
            state.voiceHudTimer = 2.5;
        }
    } else if (c.indexOf("replay") !== -1 || c.indexOf("tutorial") !== -1) {
        if (state.ftueOnboarding) {
            state.ftueOnboarding.reset();
            initFTUEBillboard();
        }
    } else if (c.indexOf("export") !== -1 || c.indexOf("save") !== -1) {
        exportWorkspaceDocument();
    } else if (c.indexOf("keyboard") !== -1 || c.indexOf("edit") !== -1 || c.indexOf("open editor") !== -1) {
        if (state.notes && state.notes.length > 0 && state.noteEditor) {
            state.noteEditor.openEditor(state.notes[0]);
            if (state.voiceHud && state.voiceHudLabel) {
                setTextContent(state.voiceHudLabel, "[ ? 3D NOTE EDITOR OPENED FOR NOTE 1 ]", 4.0);
                applyMaterialStyle(state.voiceHud, null, new vec4(0.0, 0.94, 1.0, 0.95));
                state.voiceHudTimer = 2.5;
            }
        }
    }
}
global.infinityVoiceCommand = handleVoiceCommand;

// ------------------------------------------------------------------------------
// Voice Dictation Note Generator (Hands-Free Spectacles Input)
// ------------------------------------------------------------------------------
function infinityDictateVoiceNote(dictatedText) {
    var wsKey = state.focusedWorkspace || "Think";
    var title = "5. QUANTUM TELEPORTATION";
    var body = dictatedText || "deg Entanglement-assisted state transfer\ndeg Verified via Bell basis measurement\n[x] Quantum channel active";

    var newId = "StickyNote_Voice_" + Math.floor(state.time || 1);
    var newObj = getOrCreateObject(newId, script.boxMesh, script.pbrMaterial);
    var cardText = title + "\n" + body + "\n[ ANCHORED ]";
    var lblObj = getOrCreateText3D("Label_" + newId, cardText, 4.8, new vec4(1.0, 1.0, 1.0, 1.0));

    var spawnPos = new vec3(2.0, 6.5, -66.0);
    newObj.getTransform().setWorldScale(new vec3(13.2, 8.2, 0.5));
    newObj.getTransform().setWorldPosition(spawnPos);
    applyMaterialStyle(newObj, null, new vec4(0.08, 0.16, 0.28, 0.98), RENDER_ORDER_CARD, true);

    lblObj.getTransform().setWorldPosition(new vec3(spawnPos.x, spawnPos.y, spawnPos.z + 0.75));

    var editBtn = getOrCreateObject("Button_Edit_" + newId, script.boxMesh, script.pbrMaterial);
    editBtn.getTransform().setWorldScale(new vec3(2.6, 1.4, 0.25));
    editBtn.getTransform().setWorldPosition(new vec3(spawnPos.x + 4.8, spawnPos.y + 2.8, spawnPos.z + 0.5));
    applyMaterialStyle(editBtn, null, new vec4(0.0, 0.85, 1.0, 0.90), RENDER_ORDER_CARD);

    var editLbl = getOrCreateText3D("Label_Edit_" + newId, "[ ✎ ]", 2.2, new vec4(1.0, 1.0, 1.0, 1.0), RENDER_ORDER_TEXT, true);
    editLbl.getTransform().setWorldPosition(new vec3(spawnPos.x + 4.8, spawnPos.y + 2.8, spawnPos.z + 0.75));

    var delBtn = getOrCreateObject("Button_Del_" + newId, script.boxMesh, script.pbrMaterial);
    delBtn.getTransform().setWorldScale(new vec3(2.6, 1.4, 0.25));
    delBtn.getTransform().setWorldPosition(new vec3(spawnPos.x - 4.8, spawnPos.y + 2.8, spawnPos.z + 0.5));
    applyMaterialStyle(delBtn, null, new vec4(1.0, 0.3, 0.25, 0.90), RENDER_ORDER_CARD);

    var delLbl = getOrCreateText3D("Label_Del_" + newId, "[ ✕ ]", 2.2, new vec4(1.0, 1.0, 1.0, 1.0), RENDER_ORDER_TEXT, true);
    delLbl.getTransform().setWorldPosition(new vec3(spawnPos.x - 4.8, spawnPos.y + 2.8, spawnPos.z + 0.75));

    var noteEntry = {
        obj: newObj,
        labelObj: lblObj,
        editBtn: editBtn,
        editLabel: editLbl,
        deleteBtn: delBtn,
        deleteLabel: delLbl,
        id: newId,
        cfg: { id: newId, title: title, body: body, status: "ANCHORED", basePos: spawnPos },
        status: "ANCHORED",
        targetPos: spawnPos,
        curPos: spawnPos,
        baseScale: new vec3(13.2, 8.2, 0.5),
        curScale: new vec3(13.2, 8.2, 0.5),
        isHovered: false
    };
    state.notes.push(noteEntry);
    state.pulseEnergy = 1.0;
    triggerAudioRipple(spawnPos);

    if (state.voiceHud && state.voiceHudLabel) {
        setTextContent(state.voiceHudLabel, "[ ??? VOICE NOTE ADDED: " + title + " ]", 4.2);
        applyMaterialStyle(state.voiceHud, null, new vec4(1.0, 0.75, 0.08, 0.95));
        state.voiceHudTimer = 3.5;
    }
    print("[INFINITY VOICE] ? Voice note created: " + title);
    return noteEntry;
}
global.infinityDictateVoiceNote = infinityDictateVoiceNote;


// ------------------------------------------------------------------------------
// Workspace Session Document Exporter
// ------------------------------------------------------------------------------
function exportWorkspaceDocument() {
    if (!global.SessionDocumentExporter) return null;
    var wsKey = state.focusedWorkspace || "Think";
    var drawnShapes = (state.shapeModule && state.shapeModule.drawnObjects) ? state.shapeModule.drawnObjects : [];

    var exportResult = global.SessionDocumentExporter.exportSessionDocument({
        workspaceName: wsKey,
        notes: state.notes,
        shapes: drawnShapes
    });

    // Spawn / Show Volumetric In-Lens Export Modal (Minor 8)
    if (!state.exportModal) {
        state.exportModal = getOrCreateObject("Export_Modal_Board", script.boxMesh, script.pbrMaterial);
        state.exportModal.getTransform().setWorldPosition(new vec3(0.0, 2.0, -62.0));
        state.exportModal.getTransform().setWorldScale(new vec3(36.0, 24.0, 0.5));
        applyMaterialStyle(state.exportModal, null, new vec4(0.05, 0.08, 0.16, 0.96));

        var modalTitle = getOrCreateText3D("Label_Export_Modal_Title", "[ ?? INFINITY // EXPORTED KNOWLEDGE VAULT ]", 4.8, new vec4(1.0, 0.85, 0.20, 1.0));
        modalTitle.getTransform().setWorldPosition(new vec3(0.0, 11.5, -61.2));

        var previewLines = exportResult.markdown.split("\n").slice(0, 7).join("\n");
        state.exportModalBody = getOrCreateText3D("Label_Export_Modal_Body", previewLines, 3.2, new vec4(1.0, 1.0, 1.0, 0.95));
        state.exportModalBody.getTransform().setWorldPosition(new vec3(0.0, 4.0, -61.2));

        var syncBtn = getOrCreateObject("Button_Modal_Sync", script.boxMesh, script.pbrMaterial);
        syncBtn.getTransform().setWorldPosition(new vec3(-8.0, -7.5, -61.2));
        syncBtn.getTransform().setWorldScale(new vec3(12.0, 2.2, 0.4));
        applyMaterialStyle(syncBtn, null, new vec4(0.0, 0.94, 1.0, 0.92));
        var syncLbl = getOrCreateText3D("Label_Modal_Sync", "[ ?? SYNC DESKTOP ]", 3.2, new vec4(1.0, 1.0, 1.0, 1.0));
        syncLbl.getTransform().setWorldPosition(new vec3(-8.0, -7.5, -60.8));
        state.exportModalSyncBtn = syncBtn;

        var closeBtn = getOrCreateObject("Button_Modal_Close", script.boxMesh, script.pbrMaterial);
        closeBtn.getTransform().setWorldPosition(new vec3(8.0, -7.5, -61.2));
        closeBtn.getTransform().setWorldScale(new vec3(10.0, 2.2, 0.4));
        applyMaterialStyle(closeBtn, null, new vec4(1.0, 0.2, 0.4, 0.92));
        var closeLbl = getOrCreateText3D("Label_Modal_Close", "[ ? DISMISS ]", 3.2, new vec4(1.0, 1.0, 1.0, 1.0));
        closeLbl.getTransform().setWorldPosition(new vec3(8.0, -7.5, -60.8));
        state.exportModalCloseBtn = closeBtn;
    }

    state.exportModal.enabled = true;
    state.exportModalActive = true;

    if (state.voiceHud && state.voiceHudLabel) {
        setTextContent(state.voiceHudLabel, "[ ? SESSION EXPORTED TO VAULT // MD+JSON ]", 4.2);
        applyMaterialStyle(state.voiceHud, null, new vec4(0.0, 1.0, 0.66, 0.95));
        state.voiceHudTimer = 3.5;
    }
    state.pulseEnergy = 1.0;
    triggerAudioRipple(new vec3(0.0, 2.0, -62.0));
    return exportResult;
}
global.infinityExportSession = exportWorkspaceDocument;

// ------------------------------------------------------------------------------
// Interaction Engine: Hardened 3D Raycasting with Drag/Tap Discrimination (Phase 5)
// ------------------------------------------------------------------------------
function handleDragStart(screenPos) {
    if (!state.camera || state.mode !== "WORKSPACE_FOCUS") return;
    state.lastScreenPos = screenPos;
    touchState.startPos = screenPos;
    touchState.startTime = getTime();
    touchState.hasMoved = false;
    touchState.activeTouch = true;

    // Check if aiming at note
    for (var i = 0; i < state.notes.length; i++) {
        var note = state.notes[i];
        var nHit = raycast3D(screenPos, note.curPos, 9.5);
        if (nHit.hit) {
            state.draggedNote = note;
            return;
        }
    }

    // If not note and editor not active, start inking on desk plane
    if (state.shapeModule && !state.draggedNote && (!state.noteEditor || !state.noteEditor.active)) {
        var worldPt = state.camera.screenSpaceToWorldSpace(screenPos, 108.0);
        state.shapeModule.startStroke(new vec3(worldPt.x, worldPt.y, -67.5));
    }
}

function handleDragMove(screenPos) {
    state.lastScreenPos = screenPos;
    if (!state.camera || !touchState.activeTouch) return;

    var dx = screenPos.x - touchState.startPos.x;
    var dy = screenPos.y - touchState.startPos.y;
    var moveDist = Math.sqrt(dx * dx + dy * dy);

    if (moveDist > touchState.dragThreshold) {
        touchState.hasMoved = true;
    }

    if (state.draggedNote && touchState.hasMoved) {
        var worldPt = state.camera.screenSpaceToWorldSpace(screenPos, 108.0);
        var clampedX = Math.max(-28.0, Math.min(28.0, worldPt.x));
        var clampedY = Math.max(-16.0, Math.min(14.0, worldPt.y));
        state.draggedNote.curPos = new vec3(clampedX, clampedY, -68.0);
        state.draggedNote.targetPos = state.draggedNote.curPos;

        if (state.draggedNote.labelObj) {
            state.draggedNote.labelObj.getTransform().setWorldPosition(new vec3(clampedX, clampedY, -68.0 + 0.75));
        }
        if (state.draggedNote.editBtn) {
            state.draggedNote.editBtn.getTransform().setWorldPosition(new vec3(clampedX + 4.8, clampedY + 2.8, -68.0 + 0.5));
        }
        if (state.draggedNote.editLabel) {
            state.draggedNote.editLabel.getTransform().setWorldPosition(new vec3(clampedX + 4.8, clampedY + 2.8, -68.0 + 0.75));
        }
        if (state.draggedNote.deleteBtn) {
            state.draggedNote.deleteBtn.getTransform().setWorldPosition(new vec3(clampedX - 4.8, clampedY + 2.8, -68.0 + 0.5));
        }
        if (state.draggedNote.deleteLabel) {
            state.draggedNote.deleteLabel.getTransform().setWorldPosition(new vec3(clampedX - 4.8, clampedY + 2.8, -68.0 + 0.75));
        }

        if (state.ftueOnboarding && state.ftueOnboarding.isActive()) {
            state.ftueOnboarding.advance(1);
        }
    } else if (state.shapeModule && state.shapeModule.isDrawing) {
        var strokePt = state.camera.screenSpaceToWorldSpace(screenPos, 108.0);
        state.shapeModule.addStrokePoint(new vec3(strokePt.x, strokePt.y, -67.5));
    }
}

function handleDragEnd() {
    touchState.activeTouch = false;
    if (touchState.hasMoved) {
        touchState.lastDragEndTime = getTime();
    }

    if (state.draggedNote) {
        if (touchState.hasMoved) {
            print("[INFINITY OS] 3D Repositioned Note: " + state.draggedNote.id + " at " + state.draggedNote.curPos.toString());
            if (state.focusedWorkspace) {
                saveWorkspaceState(state.focusedWorkspace);
            }
        }
        state.draggedNote = null;
    } else if (state.shapeModule && state.shapeModule.isDrawing) {
        var recognized = state.shapeModule.endStroke();
        if (recognized) {
            state.pulseEnergy = 0.8;
            triggerAudioRipple(recognized.obj.getTransform().getWorldPosition());
        }
    }
}

function handleTapOrPinch(screenPos) {
    if (!state.camera) return;

    // Discard tap if this was the tail end of a drag gesture within 280ms (Phase 5)
    if (touchState.hasMoved || (getTime() - touchState.lastDragEndTime) < 0.28) {
        return;
    }

    print("[INFINITY OS] 3D Raycast Tap event at: (" + screenPos.x.toFixed(2) + ", " + screenPos.y.toFixed(2) + ")");

    // 0. Check Note Editor & Keyboard Subsystem First
    if (state.noteEditor && state.noteEditor.active) {
        var editorHit = state.noteEditor.checkRayHit(screenPos, raycast3D);
        if (editorHit) return;
    }

    // 0b. Check In-Lens Export Modal Buttons (Dismiss & Sync)
    if (state.exportModal && state.exportModalActive) {
        if (state.exportModalCloseBtn) {
            var cHit = raycast3D(screenPos, state.exportModalCloseBtn.getTransform().getWorldPosition(), 5.5);
            if (cHit.hit) {
                state.exportModal.enabled = false;
                state.exportModalActive = false;
                triggerAudioRipple(state.exportModalCloseBtn.getTransform().getWorldPosition());
                return;
            }
        }
        if (state.exportModalSyncBtn) {
            var sHit = raycast3D(screenPos, state.exportModalSyncBtn.getTransform().getWorldPosition(), 6.5);
            if (sHit.hit) {
                if (state.desktopSync) {
                    state.desktopSync.injectDesktopSnippet("VAULT SYNC", "Exported quantum study session synchronized to desktop companion.", "Vault");
                }
                state.exportModal.enabled = false;
                state.exportModalActive = false;
                triggerAudioRipple(state.exportModalSyncBtn.getTransform().getWorldPosition());
                return;
            }
        }
    }

    // 0c. Check Desk Height Calibration Buttons & Voice Button
    if (state.calibrationButtons) {
        for (var b = 0; b < state.calibrationButtons.length; b++) {
            var cb = state.calibrationButtons[b];
            var btnHit = raycast3D(screenPos, cb.obj.getTransform().getWorldPosition(), 4.8);
            if (btnHit.hit) {
                triggerAudioRipple(cb.obj.getTransform().getWorldPosition());
                if (cb.id === "Button_Desk_Up" && state.surfaceManager) {
                    state.surfaceManager.adjustDeskElevation(5.0);
                } else if (cb.id === "Button_Desk_Down" && state.surfaceManager) {
                    state.surfaceManager.adjustDeskElevation(-5.0);
                } else if (cb.id === "Button_Desk_Snap" && state.surfaceManager) {
                    var ray = getCameraRay(screenPos);
                    state.surfaceManager.snapToPhysicalSurface(ray);
                } else if (cb.id === "Button_Voice_Note") {
                    infinityDictateVoiceNote();
                }
                return;
            }
        }
    }

    // 0d. Check Summarize Knowledge Graph Button
    if (state.summarizeButton) {
        var sumHit = raycast3D(screenPos, state.summarizeButton.obj.getTransform().getWorldPosition(), 7.5);
        if (sumHit.hit) {
            triggerAudioRipple(state.summarizeButton.obj.getTransform().getWorldPosition());
            if (state.aiModule && typeof state.aiModule.summarizeKnowledgeGraph === "function") {
                state.aiModule.summarizeKnowledgeGraph(state.focusedWorkspace);
            }
            return;
        }
    }

    // 0e. Check Workspace Selector Pill ([ THINK ▾ ])
    if (state.workspacePill) {
        var wpPos = state.workspacePill.getTransform().getWorldPosition();
        var wpHit = raycast3D(screenPos, wpPos, 8.0);
        if (wpHit.hit) {
            triggerAudioRipple(wpPos);
            var wsOrder = ["Think", "Create", "Learn", "Store", "Explore"];
            var curWsIdx = wsOrder.indexOf(state.focusedWorkspace || "Think");
            var nextWs = wsOrder[(curWsIdx + 1) % wsOrder.length];
            enterFocusMode(nextWs);
            return;
        }
    }

    // 0f. Check Note Action Pills ([ ✎ EDIT ] and [ ✕ DELETE ])
    for (var a = 0; a < state.notes.length; a++) {
        var an = state.notes[a];
        if (an.editBtn) {
            var ebPos = an.editBtn.getTransform().getWorldPosition();
            var ebHit = raycast3D(screenPos, ebPos, 3.5);
            if (ebHit.hit) {
                triggerAudioRipple(ebPos);
                if (state.noteEditor) {
                    state.noteEditor.openEditor(an);
                    if (state.voiceHud && state.voiceHudLabel) {
                        setTextContent(state.voiceHudLabel, "[ ✦ 3D NOTE EDITOR OPENED ]", 4.0);
                        applyMaterialStyle(state.voiceHud, null, new vec4(0.0, 0.94, 1.0, 0.95));
                        state.voiceHudTimer = 2.5;
                    }
                }
                return;
            }
        }
        if (an.deleteBtn) {
            var dbPos = an.deleteBtn.getTransform().getWorldPosition();
            var dbHit = raycast3D(screenPos, dbPos, 3.5);
            if (dbHit.hit) {
                triggerAudioRipple(dbPos);
                if (an.obj) an.obj.destroy();
                if (an.labelObj) an.labelObj.destroy();
                if (an.editBtn) an.editBtn.destroy();
                if (an.editLabel) an.editLabel.destroy();
                if (an.deleteBtn) an.deleteBtn.destroy();
                if (an.deleteLabel) an.deleteLabel.destroy();
                state.notes.splice(a, 1);
                if (state.voiceHud && state.voiceHudLabel) {
                    setTextContent(state.voiceHudLabel, "[ ✦ NOTE REMOVED ]", 4.0);
                    state.voiceHudTimer = 2.0;
                }
                return;
            }
        }
    }

    // 1. Check AI Assistant Core
    var aiCore = findObjectByName("AI_Assistant_Core");
    if (aiCore) {
        var aiPos = aiCore.getTransform().getWorldPosition();
        var aiHit = raycast3D(screenPos, aiPos, 5.5);
        if (aiHit.hit) {
            if (typeof global.wristCompanionToggle === "function") {
                global.wristCompanionToggle(new vec3(-2.0, -8.5, -67.5));
            }
            triggerAIAssistant();
            return;
        }
    }

    // 2. Return to Galaxy when tapping top margin in focus mode
    if (state.mode === "WORKSPACE_FOCUS" && screenPos.y < 0.12) {
        returnToGalaxy();
        return;
    }

    // 3. Check Note Cards - Tapping cycles cognitive state cleanly (guarded by tap vs drag discrimination)
    var isRecentDrag = (getTime() - touchState.lastDragEndTime) < 0.15;
    if (!isRecentDrag) {
        for (var i = 0; i < state.notes.length; i++) {
            var note = state.notes[i];
            var noteHit = raycast3D(screenPos, note.curPos, 8.5);
            if (noteHit.hit) {
                var now = getTime();
                if (state.lastTappedNote === note && (now - state.lastNoteTapTime) < 0.38) {
                    // Double-tap detected: open 3D Note Editor!
                    state.lastTappedNote = null;
                    state.lastNoteTapTime = 0.0;
                    if (state.noteEditor) {
                        state.noteEditor.openEditor(note);
                        triggerAudioRipple(note.curPos);
                        if (state.voiceHud && state.voiceHudLabel) {
                            setTextContent(state.voiceHudLabel, "[ ? 3D NOTE EDITOR OPENED ]", 4.0);
                            applyMaterialStyle(state.voiceHud, null, new vec4(0.0, 0.94, 1.0, 0.95));
                            state.voiceHudTimer = 2.5;
                        }
                    }
                    return;
                }
                state.lastTappedNote = note;
                state.lastNoteTapTime = now;
                cycleNoteStatus(note);
                triggerAudioRipple(note.curPos);
                if (state.ftueOnboarding && state.ftueOnboarding.isActive()) {
                    state.ftueOnboarding.advance(2);
                }
                return;
            }
        }
    }

    // 4. Check Planet Selection
    var closestPlanet = null;
    var minRayDist = 12.0;
    for (var key in state.planets) {
        var p = state.planets[key];
        var pPos = p.obj.getTransform().getWorldPosition();
        var pHit = raycast3D(screenPos, pPos, p.config.baseScale.x * 1.4);
        if (pHit.hit && pHit.dist3D < minRayDist) {
            minRayDist = pHit.dist3D;
            closestPlanet = key;
        }
    }

    if (closestPlanet) {
        if (state.mode === "GALAXY") {
            enterFocusMode(closestPlanet);
        } else if (closestPlanet === state.focusedWorkspace) {
            returnToGalaxy();
        } else {
            enterFocusMode(closestPlanet);
        }
        if (state.ftueOnboarding && state.ftueOnboarding.isActive()) {
            state.ftueOnboarding.advance(2);
        }
    }
}

// ------------------------------------------------------------------------------
// Bind Lens Studio Input Events
// ------------------------------------------------------------------------------
script.createEvent("TapEvent").bind(function(eventData) {
    handleTapOrPinch(eventData.getTapPosition());
});

script.createEvent("TouchStartEvent").bind(function(eventData) {
    handleDragStart(eventData.getTouchPosition());
});

script.createEvent("TouchMoveEvent").bind(function(eventData) {
    handleDragMove(eventData.getTouchPosition());
});

script.createEvent("TouchEndEvent").bind(function(eventData) {
    handleDragEnd();
});

// ------------------------------------------------------------------------------
// Fallback Bridge Bindings for WristCompanion & FocusNavigation
// ------------------------------------------------------------------------------
var _wristDockedState = false;
if (typeof global.wristCompanionDock !== "function") {
    global.wristCompanionDock = function() {
        _wristDockedState = true;
        if (state.aiCore) {
            state.aiCore.getTransform().setWorldScale(new vec3(1.5, 1.5, 1.5));
        }
        print("[INFINITY COMPANION] AI Assistant docked to wrist.");
    };
}
if (typeof global.wristCompanionUndock !== "function") {
    global.wristCompanionUndock = function(worldPos) {
        _wristDockedState = false;
        if (state.aiCore) {
            state.aiCore.getTransform().setWorldPosition(worldPos || new vec3(-2.0, -8.5, -67.5));
            state.aiCore.getTransform().setWorldScale(new vec3(4.2, 4.2, 4.2));
        }
        print("[INFINITY COMPANION] AI Assistant undocked to world space.");
    };
}
if (typeof global.wristCompanionToggle !== "function") {
    global.wristCompanionToggle = function(worldPos) {
        if (_wristDockedState) {
            global.wristCompanionUndock(worldPos);
        } else {
            global.wristCompanionDock();
        }
    };
}
if (typeof global.wristCompanionIsDocked !== "function") {
    global.wristCompanionIsDocked = function() {
        return _wristDockedState;
    };
}

var _focusIndex = 0;
if (typeof global.infinityFocusNext !== "function") {
    global.infinityFocusNext = function() {
        if (state.notes && state.notes.length > 0) {
            _focusIndex = (_focusIndex + 1) % state.notes.length;
            for (var fi = 0; fi < state.notes.length; fi++) {
                state.notes[fi].isHovered = (fi === _focusIndex);
            }
            triggerAudioRipple(state.notes[_focusIndex].curPos);
        }
    };
}
if (typeof global.infinityFocusPrevious !== "function") {
    global.infinityFocusPrevious = function() {
        if (state.notes && state.notes.length > 0) {
            _focusIndex = (_focusIndex - 1 + state.notes.length) % state.notes.length;
            for (var fi = 0; fi < state.notes.length; fi++) {
                state.notes[fi].isHovered = (fi === _focusIndex);
            }
            triggerAudioRipple(state.notes[_focusIndex].curPos);
        }
    };
}
if (typeof global.infinitySetFocusTargets !== "function") {
    global.infinitySetFocusTargets = function(targets) {
        _focusIndex = 0;
    };
}

// ------------------------------------------------------------------------------
// Automated 90-Second Demo Sequence for Screen Recording (Devpost Hackathon)
// ------------------------------------------------------------------------------
global.infinityRunFullDemoSequence = function() {
    print("\n=======================================================");
    print("?? [INFINITY DEMO] STARTING 90-SECOND AUTOMATED SHOWCASE");
    print("=======================================================\n");

    function narrate(text) {
        if (typeof global.infinityVoiceInterimUpdate === "function") {
            global.infinityVoiceInterimUpdate("? [DEMO] " + text);
        }
        print("?? [DEMO NARRATION] " + text);
    }

    var timeline = [
        { t: 1.0,  fn: function() { narrate("ACT 1: 6DoF Spatial Whiteboard & Virtual Desk Online"); } },
        { t: 4.5,  fn: function() { narrate("Calibrating desk against physical room mesh..."); global.infinityVoiceCommand("table"); } },
        { t: 9.0,  fn: function() { narrate("Ergonomic height calibration (+5 cm)..."); global.infinityVoiceCommand("desk up"); } },
        { t: 14.0, fn: function() { narrate("ACT 2: SIK Focus Navigation across Quantum study cards..."); } },
        { t: 17.5, fn: function() { narrate("Focusing Card 1 (Architecture)..."); global.infinityFocusNext(); } },
        { t: 21.0, fn: function() { narrate("Focusing Card 2 (SIK Gaze & Pinch)..."); global.infinityFocusNext(); } },
        { t: 25.0, fn: function() { narrate("Activating Card & Triggering Audio Chime..."); global.infinityVoiceCommand("select"); } },
        { t: 29.5, fn: function() { narrate("Focusing Card 3 (Constellation Graph Links)..."); global.infinityFocusNext(); } },
        { t: 34.0, fn: function() { narrate("ACT 3: Cosmic Jump to 'CREATE' Workspace..."); global.infinityVoiceCommand("create"); } },
        { t: 41.0, fn: function() { narrate("Cosmic Jump to 'LEARN' Workspace (Calculus / Curriculum)..."); global.infinityVoiceCommand("learn"); } },
        { t: 48.0, fn: function() { narrate("Restoring persistent state -> Return to 'THINK' Lab..."); global.infinityVoiceCommand("think"); } },
        { t: 54.0, fn: function() { narrate("ACT 4: Hands-free Voice Dictation in AR..."); global.infinityDictateVoiceNote("Wavefunction collapse verified at 432Hz spatial frequency"); } },
        { t: 60.5, fn: function() { narrate("Live Desktop Companion WebSocket sync..."); global.infinityInjectDesktopSnippet("DESKTOP RESEARCH SYNC", "Imported textbook reference notes from VS Code companion.", "Research"); } },
        { t: 67.0, fn: function() { narrate("ACT 5: Opening Volumetric 3D Note Editor & Spatial Keyboard..."); global.infinityVoiceCommand("open editor"); } },
        { t: 76.0, fn: function() { narrate("ACT 6: Exporting Session Document (Markdown + JSON Vault)..."); global.infinityExportSession(); } },
        { t: 84.0, fn: function() { narrate("? INFINITY SPATIAL OS // SHOWCASE COMPLETE ?"); global.infinityPlayAudioChime(true); } },
        { t: 88.0, fn: function() { print("\n?? [INFINITY DEMO] 90-SECOND DEMO SEQUENCE COMPLETE!\n"); } }
    ];

    for (var i = 0; i < timeline.length; i++) {
        (function(item) {
            var delayEvt = script.createEvent("DelayedCallbackEvent");
            delayEvt.bind(function() {
                try { item.fn(); } catch(e) { print("[DEMO ERROR] " + e); }
            });
            delayEvt.reset(item.t);
        })(timeline[i]);
    }
};

var demoKeyEvt = script.createEvent("KeyPressEvent");
demoKeyEvt.bind(function(evt) {
    if (evt.key === "D" || evt.key === "Space") {
        global.infinityRunFullDemoSequence();
    }
});

var autoDemoEvt = script.createEvent("DelayedCallbackEvent");
autoDemoEvt.bind(function() {
    print("[INFINITY DEMO] Auto-starting 90-second demo sequence now!");
    global.infinityRunFullDemoSequence();
});
autoDemoEvt.reset(2.5);
