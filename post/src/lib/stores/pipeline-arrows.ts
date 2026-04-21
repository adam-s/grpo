/**
 * Shared hover state for cross-section spline overlay.
 *
 * Each OpGrid writes the currently-hovered card number here; the page-level
 * `PipelineArrows` overlay reads it, looks the op's sources up in the static
 * `OPS` config, and draws bezier arcs between whichever `[data-card="N"]`
 * elements happen to be mounted anywhere on the page.
 */

import { writable } from 'svelte/store';

export const hoveredCard = writable<number | null>(null);
