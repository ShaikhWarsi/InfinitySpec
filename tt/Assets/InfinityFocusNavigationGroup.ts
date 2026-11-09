/**
 * InfinityFocusNavigationGroup.ts
 * -----------------------------------------------------------------------------
 * Discrete Spatial Focus Navigation Ring for INFINITY on Snap Spectacles.
 *
 * Implements tvOS/Spectacles HIG compliant focus model:
 * - Exactly one item focused at a time (focusIndex).
 * - Strict boundary clamping at both ends (no wrap-around to prevent disorientation).
 * - Forward focal depth lift (focusLiftZ) and scale accentuation on active target.
 * - SIK Interactable resolution for non-pointing input sources (Voice, Keyboard, Companion).
 *
 * Adapted from OpenBand NavigationGroup for INFINITY Spatial OS.
 * Lens Studio 5.24+ / SIK 0.14.0+ / TypeScript.
 */

import { Interactable } from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

export const NO_FOCUS_INDEX = -1;

@component
export class InfinityFocusNavigationGroup extends BaseScriptComponent {

    @ui.separator
    @ui.label('<span style="color: #00F0FF;">INFINITY Focus Navigation Ring</span>')

    @input
    @allowUndefined
    @hint("Ordered list of focusable SceneObjects (study notes, dock buttons).")
    targets: SceneObject[] = [];

    @input
    @hint("Starting focused index at lens boot.")
    startIndex: number = 0;

    @input
    @hint("Local Z depth lift applied to focused target in cm.")
    focusLiftZ: number = 1.0;

    @input
    @hint("Subtle scale multiplier applied to focused target.")
    focusScale: number = 1.08;

    @input
    @hint("Enable debug print logging.")
    debugLogging: boolean = false;

    private focusIndex: number = NO_FOCUS_INDEX;
    private basePositions: vec3[] = [];
    private baseScales: vec3[] = [];
    private interactableCache: (Interactable | null)[] = [];

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
    }

    private onStart(): void {
        this.initializeTargets();

        // Bind global navigation shortcuts for OS Kernel & Voice Command routing
        (globalThis as any).infinityFocusNext = () => this.step(1);
        (globalThis as any).infinityFocusPrevious = () => this.step(-1);
        (globalThis as any).infinityFocusGetIndex = () => this.getFocusIndex();
        (globalThis as any).infinitySetFocusTargets = (newTargets: SceneObject[]) => this.setTargets(newTargets);
    }

    public initializeTargets(): void {
        this.basePositions = [];
        this.baseScales = [];
        this.interactableCache = [];

        if (!this.targets || this.targets.length === 0) {
            this.focusIndex = NO_FOCUS_INDEX;
            return;
        }

        for (let i = 0; i < this.targets.length; i++) {
            const obj = this.targets[i];
            if (obj) {
                const trans = obj.getTransform();
                this.basePositions.push(trans.getLocalPosition());
                this.baseScales.push(trans.getLocalScale());
                const interactable = ((obj as any).getComponent("InteractionKit:Interactable") as Interactable) ||
                                     ((obj as any).getComponent("Interactable") as Interactable) || null;
                this.interactableCache.push(interactable);
            } else {
                this.basePositions.push(vec3.zero());
                this.baseScales.push(vec3.one());
                this.interactableCache.push(null);
            }
        }

        const clampedStart = Math.max(0, Math.min(this.targets.length - 1, this.startIndex));
        this.setFocusIndex(clampedStart);
    }

    public setTargets(newTargets: SceneObject[]): void {
        // Reset previous focused target transform
        this.clearActiveFocusVisual();
        this.targets = newTargets || [];
        this.initializeTargets();
    }

    /**
     * Discrete step navigation.
     * Direction: +1 = forward/next, -1 = backward/previous.
     * Enforces strict clamping at boundaries (NO WRAP-AROUND).
     */
    public step(direction: number): boolean {
        if (!this.targets || this.targets.length === 0) return false;

        const current = this.focusIndex === NO_FOCUS_INDEX ? 0 : this.focusIndex;
        const targetIndex = current + (direction > 0 ? 1 : -1);

        // Clamping check
        if (targetIndex < 0 || targetIndex >= this.targets.length) {
            if (this.debugLogging) {
                print("[INFINITY FOCUS] Boundary reached at index " + current + " (refusing wrap-around)");
            }
            if (typeof (globalThis as any).infinityPlayAudioChime === "function") {
                (globalThis as any).infinityPlayAudioChime(false);
            }
            return false;
        }

        this.setFocusIndex(targetIndex);
        return true;
    }

    public setFocusIndex(index: number): void {
        if (index === this.focusIndex) return;

        this.clearActiveFocusVisual();
        this.focusIndex = index;
        this.applyActiveFocusVisual();

        if (this.debugLogging) {
            print("[INFINITY FOCUS] Focused target -> index " + index + " (" + (this.targets[index] ? this.targets[index].name : "null") + ")");
        }

        if (typeof (globalThis as any).infinityPlayAudioChime === "function") {
            (globalThis as any).infinityPlayAudioChime(true);
        }
    }

    private clearActiveFocusVisual(): void {
        if (this.focusIndex >= 0 && this.focusIndex < this.targets.length) {
            const obj = this.targets[this.focusIndex];
            if (obj && this.basePositions[this.focusIndex] && this.baseScales[this.focusIndex]) {
                obj.getTransform().setLocalPosition(this.basePositions[this.focusIndex]);
                obj.getTransform().setLocalScale(this.baseScales[this.focusIndex]);
            }
        }
    }

    private applyActiveFocusVisual(): void {
        if (this.focusIndex >= 0 && this.focusIndex < this.targets.length) {
            const obj = this.targets[this.focusIndex];
            if (obj && this.basePositions[this.focusIndex] && this.baseScales[this.focusIndex]) {
                const basePos = this.basePositions[this.focusIndex];
                const baseScale = this.baseScales[this.focusIndex];

                // Lift forward along Z and apply scale nudge
                const liftedPos = new vec3(basePos.x, basePos.y, basePos.z + this.focusLiftZ);
                const nudgedScale = baseScale.uniformScale(this.focusScale);

                obj.getTransform().setLocalPosition(liftedPos);
                obj.getTransform().setLocalScale(nudgedScale);
            }
        }
    }

    public getFocusIndex(): number {
        return this.focusIndex;
    }

    public getFocusedObject(): SceneObject | null {
        if (this.focusIndex >= 0 && this.focusIndex < this.targets.length) {
            return this.targets[this.focusIndex];
        }
        return null;
    }

    public getFocusedInteractable(): Interactable | null {
        if (this.focusIndex >= 0 && this.focusIndex < this.interactableCache.length) {
            return this.interactableCache[this.focusIndex];
        }
        return null;
    }
}
