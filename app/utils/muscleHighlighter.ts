// import { COLORS } from '../constants/theme';
import * as Sentry from '@sentry/react-native';

// Types for muscle configuration
export type MuscleView = 'front' | 'back' | 'both';

export interface MuscleConfig {
  ids: string[]; // Base SVG element ID prefixes for this muscle
  view: MuscleView; // Whether this muscle is visible in front, back, or both views
  color: string; // Color to use for this muscle
}

// Define your muscle color palette
export const MUSCLE_COLORS: Record<string, string> = {
  cardio: '#FF5252',
  lats: '#3CE8E8',
  biceps: '#D74FA0',
  chest: '#00D3FF',
  shoulders: '#C34FFB',
  forearms: '#FF38DF',
  obliques: '#38FF98',
  quads: '#EDFF38',
  glutes: '#949F27',
  adductors: '#D7B110',
  abs: '#00FF19',
  traps: '#7B3C9B',
  abductors: '#C2B575',
  lowerback: '#98D1D0',
  'lower back': '#98D1D0',
  hamstrings: '#D0F70D',
  triceps: '#F361C4',
  calves: '#DFFE4A',
};

// Configuration for each muscle group
export const MUSCLE_CONFIG: Record<string, MuscleConfig> = {
  cardio: {
    ids: ['Cardio', 'Heart', 'CardioSystem', 'cardiovascular', 'Cardiovascular'],
    view: 'front',
    color: MUSCLE_COLORS.cardio,
  },
  chest: {
    ids: [
      'Chest',
      'CHEST',
      'Chest_2',
      'Chest_3',
      'Chest_4',
      'pectorals',
      'pecs',
      'Pectorals',
      'Pectoralis',
      'PectoralisMajor',
      'Pecs',
      'chest-left',
      'chest-right',
      'chest_left',
      'chest_right',
    ],
    view: 'front',
    color: MUSCLE_COLORS.chest,
  },
  shoulders: {
    ids: [
      'Shoulders',
      'SHOULDERS',
      'Shoulders_2',
      'Shoulders_3',
      'Delts',
      'DELTS',
      'delts',
      'deltoids',
      'Deltoids',
      'Shoulder',
      'shoulder',
      'deltoid',
      'Deltoid',
      'LeftShoulder',
      'RightShoulder',
      'ShoulderLeft',
      'ShoulderRight',
      'shoulder-left',
      'shoulder-right',
      'shoulders-left',
      'shoulders-right',
      'ShoulderMuscles',
      'DeltoidGroup',
    ],
    view: 'both',
    color: MUSCLE_COLORS.shoulders,
  },
  triceps: {
    ids: [
      'Triceps',
      'TRICEPS',
      'tricep',
      'Tricep',
      'Triceps-left',
      'Triceps-right',
      'Triceps_left',
      'Triceps_right',
      'triceps-left',
      'triceps-right',
      'triceps_left',
      'triceps_right',
    ],
    view: 'both',
    color: MUSCLE_COLORS.triceps,
  },
  biceps: {
    ids: [
      'Biceps',
      'BICEPS',
      'Biceps_2',
      'bicep',
      'Biceps-left',
      'Biceps-right',
      'Biceps_left',
      'Biceps_right',
      'biceps-left',
      'biceps-right',
      'biceps_left',
      'biceps_right',
    ],
    view: 'front',
    color: MUSCLE_COLORS.biceps,
  },
  forearms: {
    ids: [
      'Forearms',
      'Forearms_2',
      'Forearms_3',
      'Forearms_4',
      'Forearms_5',
      'Forearms_6',
      'ForearmBack',
      'ForearmBack_Left',
      'ForearmBack_Right',
      'forearm-left',
      'forearm-right',
      'forearms-left',
      'forearms-right',
    ],
    view: 'both',
    color: MUSCLE_COLORS.forearms,
  },
  abs: {
    ids: [
      'Abs',
      'ABS',
      'Abs_2',
      'Abs_3',
      'abdomen',
      'abdominals',
      'Abdomen',
      'Abdominals',
      'rectus-abdominis',
      'six-pack',
      'Rectus_Abdominis',
      'Rectus',
      'Core',
      'abs-upper',
      'abs-lower',
      'abs_upper',
      'abs_lower',
    ],
    view: 'front',
    color: MUSCLE_COLORS.abs,
  },
  obliques: {
    ids: [
      'Obliques',
      'Obliques_2',
      'Obliques_3',
      'Obliques_4',
      'Obliques_5',
      'oblique',
      'external-obliques',
      'internal-obliques',
      'obliques-front',
      'obliques-back',
      'obliques-left',
      'obliques-right',
    ],
    view: 'both',
    color: MUSCLE_COLORS.obliques,
  },
  quads: {
    ids: [
      'Quads',
      'QUADS',
      'Quads_2',
      'quadriceps',
      'QUADRICEPS',
      'QuadricepsFemoris',
      'Quadriceps-Femoris',
      'quad',
      'Quad',
      'quads',
      'QuadGroup',
      'Front-Thigh',
      'quads-left',
      'quads-right',
      'quad-left',
      'quad-right',
    ],
    view: 'front',
    color: MUSCLE_COLORS.quads,
  },
  adductors: {
    ids: [
      'Adductors',
      'Adductors_2',
      'Adductors_3',
      'Adductors_4',
      'Adductors_5',
      'Aductors',
      'adductor',
      'Adductor',
      'adductors',
      'inner-thigh',
      'inner-thighs',
      'groin',
      'adductors-left',
      'adductors-right',
    ],
    view: 'both',
    color: MUSCLE_COLORS.adductors,
  },
  abductors: {
    ids: [
      'Abductors',
      'Abductors_2',
      'AbductorGroup',
      'hip-abductors',
      'hip-abductor',
      'abductor',
      'abductors-left',
      'abductors-right',
    ],
    view: 'front',
    color: MUSCLE_COLORS.abductors,
  },
  lats: {
    ids: [
      'Lats',
      'LATS',
      'Lats_2',
      'latissimus',
      'latissimus-dorsi',
      'LatissimusDorsi',
      'Back-Wings',
      'BackWings',
      'lats-left',
      'lats-right',
      'lat-left',
      'lat-right',
    ],
    view: 'back',
    color: MUSCLE_COLORS.lats,
  },
  traps: {
    ids: [
      'Traps',
      'TRAPS',
      'Traps_2',
      'Traps_3',
      'Traps_4',
      'trapezius',
      'TRAPEZIUS',
      'Trapezius',
      'TrapMuscle',
      'trap',
      'Trap',
      'TrapeziusGroup',
      'trapezius-muscle',
      'upper-back',
      'traps-upper',
      'traps-middle',
      'traps-lower',
    ],
    view: 'both',
    color: MUSCLE_COLORS.traps,
  },
  lowerback: {
    ids: [
      'Lower Back',
      'LowerBack',
      'lower-back',
      'erectorspinae',
      'erector-spinae',
      'Erector',
      'Lower_Back',
      'Lowerback',
      'erector',
      'LumbarRegion',
      'Lumbar',
      'lumbar',
      'SpinalErectors',
      'lower-back-left',
      'lower-back-right',
    ],
    view: 'back',
    color: MUSCLE_COLORS.lowerback,
  },
  'lower back': {
    ids: [
      'Lower Back',
      'LowerBack',
      'lower-back',
      'erectorspinae',
      'erector-spinae',
      'Erector',
      'Lower_Back',
      'Lowerback',
      'erector',
      'LumbarRegion',
      'Lumbar',
      'lumbar',
      'SpinalErectors',
      'lower-back-left',
      'lower-back-right',
    ],
    view: 'back',
    color: MUSCLE_COLORS.lowerback,
  },
  glutes: {
    ids: [
      'Glutes',
      'GLUTES',
      'gluteus',
      'GLUTEUS',
      'GluteusMaximus',
      'gluteus-maximus',
      'butt',
      'buttocks',
      'Buttocks',
      'GluteusMuscle',
      'Glute',
      'glute',
      'glutes-left',
      'glutes-right',
      'glute-left',
      'glute-right',
    ],
    view: 'back',
    color: MUSCLE_COLORS.glutes,
  },
  hamstrings: {
    ids: [
      'Hamstrings',
      'HAMSTRINGS',
      'Hamstrings_2',
      'Hamstrings_3',
      'Hamstrings_4',
      'hamstring',
      'HAMSTRING',
      'Hamstring',
      'BackThigh',
      'back-thigh',
      'HamstringGroup',
      'hamstrings-left',
      'hamstrings-right',
    ],
    view: 'back',
    color: MUSCLE_COLORS.hamstrings,
  },
  calves: {
    ids: [
      'Calves',
      'CALVES',
      'calf',
      'CALF',
      'gastrocnemius',
      'GASTROCNEMIUS',
      'Gastrocnemius',
      'SoleusMuscle',
      'soleus',
      'Soleus',
      'CalfMuscle',
      'calf-muscle',
      'lower-leg',
      'calves-left',
      'calves-right',
      'calf-left',
      'calf-right',
    ],
    view: 'both',
    color: MUSCLE_COLORS.calves,
  },
};

// Precompile regex patterns once at module load
interface PrecompiledPattern {
  id: string;
  view: MuscleView;
  muscleKey: string;
}

const PRECOMPILED: PrecompiledPattern[] = [];

// Create lookup maps for faster muscle identification
const NORMALIZED_MUSCLE_MAP: Map<string, string> = new Map();
const NORMALIZED_INPUT_TO_KEY: Map<string, string> = new Map();

// Build lookup map for muscle names to their normalized keys
Object.entries(MUSCLE_CONFIG).forEach(([muscleKey, cfg]) => {
  // Store the normalized key to original mapping
  const normalizedKey = normalizeMuscleKey(muscleKey);
  NORMALIZED_MUSCLE_MAP.set(normalizedKey, muscleKey);

  // Also map each possible ID to the muscle key
  for (const id of cfg.ids) {
    const normalizedId = normalizeMuscleKey(id);
    NORMALIZED_INPUT_TO_KEY.set(normalizedId, muscleKey);
  }

  cfg.ids.forEach((id) => {
    PRECOMPILED.push({ id, view: cfg.view, muscleKey });
  });
});

/**
 * Normalize a muscle name consistently for lookup
 */
function normalizeMuscleKey(muscleKey: string): string {
  return muscleKey.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find the original muscle key for a given input name
 */
function findMuscleKey(muscleName: string): string | null {
  const normalized = normalizeMuscleKey(muscleName);

  // First try direct match with muscle key
  if (NORMALIZED_MUSCLE_MAP.has(normalized)) {
    return NORMALIZED_MUSCLE_MAP.get(normalized) || null;
  }

  // Then try match with any muscle ID
  if (NORMALIZED_INPUT_TO_KEY.has(normalized)) {
    return NORMALIZED_INPUT_TO_KEY.get(normalized) || null;
  }

  // Try partial matches for common variations
  for (const [key, value] of NORMALIZED_MUSCLE_MAP.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }

  // Try partial matches in the input mapping
  for (const [key, value] of NORMALIZED_INPUT_TO_KEY.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Extracts all IDs from an SVG string for diagnostic purposes
 */
export function extractSvgIds(svg: string): string[] {
  try {
    Sentry.addBreadcrumb({
      message: 'Extracting SVG IDs',
      category: 'muscle_highlighting',
      data: { svgLength: svg?.length || 0 },
      level: 'info',
    });

    if (!svg) {
      Sentry.addBreadcrumb({
        message: 'Empty SVG provided to extractSvgIds',
        category: 'muscle_highlighting',
        level: 'warning',
      });
      return [];
    }

    const idMatches = Array.from(svg.matchAll(/id=["']([^"']+)["']/g)).map((m) => m[1]);

    Sentry.addBreadcrumb({
      message: 'SVG IDs extracted successfully',
      category: 'muscle_highlighting',
      data: {
        totalIds: idMatches.length,
        sampleIds: idMatches.slice(0, 5),
      },
      level: 'info',
    });

    return idMatches;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'muscleHighlighter',
        function: 'extractSvgIds',
      },
      contexts: {
        svg_info: {
          svg_length: svg?.length || 0,
          svg_provided: !!svg,
        },
      },
    });
    return [];
  }
}

/**
 * Escapes special characters in a string for use in a regular expression
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if pattern view matches current back/front selection
 */
function shouldProcessView(view: MuscleView, isBackView: boolean): boolean {
  if (view === 'both') return true;
  if (isBackView && view === 'back') return true;
  if (!isBackView && view === 'front') return true;
  return false;
}

/**
 * Log debug information for muscle pattern processing
 */
function logPatternDebug(
  muscleKey: string,
  id: string,
  normalizedKey: string,
  primarySet: Set<string>,
  secondarySet: Set<string>,
  isBackView: boolean,
): void {
  console.log(
    `[SVG:${isBackView ? 'BACK' : 'FRONT'}] Processing muscle: ${muscleKey} (id: ${id}, normalized: ${normalizedKey})`,
  );
  console.log(
    `[SVG:${isBackView ? 'BACK' : 'FRONT'}] Primary set has: ${primarySet.has(normalizedKey)}, Secondary set has: ${secondarySet.has(normalizedKey)}`,
  );
  if (normalizedKey === 'lats') {
    console.log(
      `[SVG:${isBackView ? 'BACK' : 'FRONT'}] LATS DEBUG - Primary set contents:`,
      Array.from(primarySet),
    );
    console.log(
      `[SVG:${isBackView ? 'BACK' : 'FRONT'}] LATS DEBUG - Looking for: "${normalizedKey}"`,
    );
    console.log(
      `[SVG:${isBackView ? 'BACK' : 'FRONT'}] LATS DEBUG - Set has it: ${primarySet.has(normalizedKey)}`,
    );
  }
}

/**
 * Get muscle style based on primary/secondary sets
 */
function getMuscleStyle(
  normalizedKey: string,
  muscleConfig: MuscleConfig,
  primarySet: Set<string>,
  secondarySet: Set<string>,
): string | null {
  if (primarySet.has(normalizedKey)) {
    return `fill:${muscleConfig.color};stroke:white;stroke-width:0.5;`;
  } else if (secondarySet.has(normalizedKey)) {
    return `fill:${muscleConfig.color}CC;stroke:white;stroke-width:0.5;`;
  }
  return null;
}

/**
 * Apply style to SVG element
 */
function applySvgStyle(output: string, id: string, style: string): string {
  const exactPattern = `(<[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*?)(>|\\/>)`;
  const exactRegex = new RegExp(exactPattern, 'gi');

  return output.replace(exactRegex, (match, prefix, closeTag) => {
    // Skip if already styled
    if (match.includes('style="')) {
      return match;
    }

    // Strip old fills/styles
    let cleaned = prefix.replace(/\s(style|fill)=["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/\/$/, '');

    if (/^<path\b/i.test(cleaned)) {
      return `${cleaned} style="${style}" />`;
    }
    return `${cleaned} style="${style}"${closeTag === '/>' ? ' />' : '>'}`;
  });
}

/**
 * Process a single pattern for muscle matching
 */
function processPattern(
  pattern: PrecompiledPattern,
  output: string,
  primarySet: Set<string>,
  secondarySet: Set<string>,
  isBackView: boolean,
  debugMode: boolean,
): { output: string } {
  const { id, view, muscleKey } = pattern;

  // Skip if view doesn't match current front/back selection
  if (!shouldProcessView(view, isBackView)) {
    return { output };
  }

  // Determine style for this muscle using consistent normalization
  const normalizedKey = normalizeMuscleKey(muscleKey);

  if (debugMode) {
    logPatternDebug(muscleKey, id, normalizedKey, primarySet, secondarySet, isBackView);
  }

  // Get original key from normalized key
  const originalKey = NORMALIZED_MUSCLE_MAP.get(normalizedKey) || muscleKey;

  // Check if the muscle config exists
  const muscleConfig = MUSCLE_CONFIG[originalKey];
  if (!muscleConfig) {
    if (debugMode) {
      console.warn(
        `[SVG] No muscle config found for: ${originalKey} (normalized: ${normalizedKey})`,
      );
    }
    return { output };
  }

  const style = getMuscleStyle(normalizedKey, muscleConfig, primarySet, secondarySet);
  if (!style) {
    return { output };
  }

  const updatedOutput = applySvgStyle(output, id, style);
  return { output: updatedOutput };
}

/**
 * Process direct muscle matching using precompiled patterns
 */
function processDirectMuscleMatching(
  output: string,
  primarySet: Set<string>,
  secondarySet: Set<string>,
  isBackView: boolean,
  debugMode: boolean,
  matchedIds: string[],
): { output: string; matchCount: number } {
  try {
    Sentry.addBreadcrumb({
      message: 'Processing direct muscle matching',
      category: 'muscle_highlighting',
      data: {
        isBackView,
        debugMode,
        primaryMuscleCount: primarySet.size,
        secondaryMuscleCount: secondarySet.size,
      },
      level: 'info',
    });

    let currentOutput = output;
    let matchCount = 0;

    if (debugMode) {
      console.log(
        `[SVG:${isBackView ? 'BACK' : 'FRONT'}] Starting direct muscle matching with ${PRECOMPILED.length} patterns`,
      );
    }

    // First try direct muscle name matching
    PRECOMPILED.forEach((pattern) => {
      const result = processPattern(
        pattern,
        currentOutput,
        primarySet,
        secondarySet,
        isBackView,
        debugMode,
      );

      if (result.output !== currentOutput) {
        currentOutput = result.output;
        matchedIds.push(pattern.id);
        matchCount++;
        if (debugMode) {
          console.log(
            `[SVG:${isBackView ? 'BACK' : 'FRONT'}] Matched muscle: ${pattern.muscleKey} (${pattern.id})`,
          );
        }
      }
    });

    if (debugMode) {
      console.log(
        `[SVG:${isBackView ? 'BACK' : 'FRONT'}] Direct muscle matching completed with ${matchCount} matches`,
      );
      if (matchedIds.length > 0) {
        console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Matched IDs:`, matchedIds);
      } else {
        console.warn(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] No IDs were matched!`);
      }
    }

    Sentry.addBreadcrumb({
      message: 'Direct muscle matching completed',
      category: 'muscle_highlighting',
      data: {
        matchCount,
        matchedIds: matchedIds.slice(-5), // Last 5 matches
      },
      level: 'info',
    });

    return { output: currentOutput, matchCount };
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'muscleHighlighter',
        function: 'processDirectMuscleMatching',
      },
      contexts: {
        muscle_matching: {
          isBackView,
          debugMode,
          primaryMuscleCount: primarySet.size,
          secondaryMuscleCount: secondarySet.size,
        },
      },
    });
    return { output, matchCount: 0 };
  }
}

/**
 * Process aggressive matching for front view when no direct matches found
 */
function processAggressiveMatching(
  output: string,
  svg: string,
  primarySet: Set<string>,
  secondarySet: Set<string>,
  debugMode: boolean,
): { output: string; matchCount: number } {
  let currentOutput = output;
  let matchCount = 0;

  if (debugMode) {
    console.log('[SVG:FRONT] No direct matches found, trying aggressive matching');
  }

  // Try to match any IDs that contain muscle names
  [...primarySet, ...secondarySet].forEach((muscleKey) => {
    const isPrimary = primarySet.has(muscleKey);
    const originalKey = NORMALIZED_MUSCLE_MAP.get(muscleKey) || muscleKey;
    const muscleConfig = MUSCLE_CONFIG[originalKey];

    if (!muscleConfig || (muscleConfig.view !== 'both' && muscleConfig.view !== 'front')) {
      return;
    }

    const style = `fill:${muscleConfig.color}${isPrimary ? '' : 'CC'};stroke:white;stroke-width:0.5;`;

    // Try to find any elements with IDs containing this muscle name
    const musclePattern = new RegExp(
      `<[^>]*\\bid=["'][^"']*?${escapeRegExp(originalKey)}[^"']*?["'][^>]*?>`,
      'gi',
    );
    const matches = Array.from(svg.matchAll(musclePattern));

    if (matches.length > 0) {
      matches.forEach((match) => {
        const element = match[0];
        if (!element.includes('style="')) {
          const styledElement = element.replace(/>$/, ` style="${style}">`);
          currentOutput = currentOutput.replace(element, styledElement);
          matchCount++;
          if (debugMode) {
            console.log(`[SVG:FRONT] Matched muscle by name: ${originalKey}`);
          }
        }
      });
    }
  });

  return { output: currentOutput, matchCount };
}

/**
 * Log matching results for debugging
 */
function logMatchingResults(
  totalMatchCount: number,
  matchedIds: string[],
  isBackView: boolean,
): void {
  if (totalMatchCount === 0) {
    console.warn(
      `[SVG:${isBackView ? 'BACK' : 'FRONT'}] WARNING: No muscles were matched in the SVG`,
    );
  } else {
    console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Total matches: ${totalMatchCount}`);
    if (matchedIds.length > 0) {
      console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Matched IDs:`, matchedIds);
    }
  }
}

/**
 * Highlight muscles in an SVG string based on primary and secondary muscles
 */
/**
 * Initialize muscle sets from input arrays
 */
function initializeMuscleSets(
  primaryMuscles: string[],
  secondaryMuscles: string[],
  debugMode: boolean,
): { primarySet: Set<string>; secondarySet: Set<string> } {
  // Convert input muscle names to actual muscle keys
  const primaryMuscleKeys = primaryMuscles
    .map(findMuscleKey)
    .filter((key): key is string => key !== null);

  const secondaryMuscleKeys = secondaryMuscles
    .map(findMuscleKey)
    .filter((key): key is string => key !== null);

  if (debugMode) {
    console.log('[SVG] Mapped muscle keys:', {
      primary: primaryMuscleKeys,
      secondary: secondaryMuscleKeys,
    });
  }

  // Create sets of normalized muscle keys for quick lookup
  const primarySet = new Set(primaryMuscles.map((m) => normalizeMuscleKey(m)));
  const secondarySet = new Set(secondaryMuscles.map((m) => normalizeMuscleKey(m)));

  // Also add normalized keys of the mapped muscles
  primaryMuscleKeys.forEach((key) => primarySet.add(normalizeMuscleKey(key)));
  secondaryMuscleKeys.forEach((key) => secondarySet.add(normalizeMuscleKey(key)));

  return { primarySet, secondarySet };
}

/**
 * Log debug information about SVG analysis
 */
function logSvgAnalysis(
  svg: string,
  primarySet: Set<string>,
  secondarySet: Set<string>,
  isBackView: boolean,
): void {
  // Extract all IDs from the SVG for analysis
  const allIds = extractSvgIds(svg);

  console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Found IDs:`, allIds.slice(0, 20));
  console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Total IDs found: ${allIds.length}`);

  // Check for specific muscle-related IDs
  const latsIds = allIds.filter((id) => id.toLowerCase().includes('lat'));
  const bicepsIds = allIds.filter((id) => id.toLowerCase().includes('bicep'));
  const chestIds = allIds.filter((id) => id.toLowerCase().includes('chest'));

  console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Lats-related IDs:`, latsIds);
  console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Biceps-related IDs:`, bicepsIds);
  console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Chest-related IDs:`, chestIds);

  console.log('[SVG] Final muscle sets:', {
    primarySet: Array.from(primarySet),
    secondarySet: Array.from(secondarySet),
  });

  // Show what PRECOMPILED patterns we have for specific muscles
  const latsPatterns = PRECOMPILED.filter((p) => p.muscleKey === 'lats');
  const bicepsPatterns = PRECOMPILED.filter((p) => p.muscleKey === 'biceps');
  console.log('[SVG] Lats patterns in PRECOMPILED:', latsPatterns);
  console.log('[SVG] Biceps patterns in PRECOMPILED:', bicepsPatterns);
}

export function highlightMusclesInSvg(
  svg: string,
  primaryMuscles: string[],
  secondaryMuscles: string[],
  isBackView: boolean,
  debugMode: boolean = false,
): string {
  try {
    Sentry.addBreadcrumb({
      message: 'Starting muscle highlighting',
      category: 'muscle_highlighting',
      data: {
        isBackView,
        debugMode,
        primaryMuscleCount: primaryMuscles.length,
        secondaryMuscleCount: secondaryMuscles.length,
        svgLength: svg?.length || 0,
      },
      level: 'info',
    });

    if (!svg) {
      Sentry.addBreadcrumb({
        message: 'Empty SVG provided for muscle highlighting',
        category: 'muscle_highlighting',
        level: 'warning',
      });
      return '';
    }

    if (debugMode) {
      console.log(`[SVG] Processing ${isBackView ? 'BACK' : 'FRONT'} view with muscles:`, {
        primary: primaryMuscles,
        secondary: secondaryMuscles,
      });
      console.log(`[SVG] PRECOMPILED patterns count: ${PRECOMPILED.length}`);
      console.log(`[SVG] Sample PRECOMPILED patterns:`, PRECOMPILED.slice(0, 10));
    }

    const { primarySet, secondarySet } = initializeMuscleSets(
      primaryMuscles,
      secondaryMuscles,
      debugMode,
    );

    if (debugMode) {
      logSvgAnalysis(svg, primarySet, secondarySet, isBackView);
    }

    let output = svg;
    let totalMatchCount = 0;
    const matchedIds: string[] = [];

    // Process direct muscle matching
    const directMatchResult = processDirectMuscleMatching(
      output,
      primarySet,
      secondarySet,
      isBackView,
      debugMode,
      matchedIds,
    );
    output = directMatchResult.output;
    totalMatchCount += directMatchResult.matchCount;

    // If no matches found, try more aggressive matching for the front view
    if (!isBackView && totalMatchCount === 0) {
      const aggressiveMatchResult = processAggressiveMatching(
        output,
        svg,
        primarySet,
        secondarySet,
        debugMode,
      );
      output = aggressiveMatchResult.output;
      totalMatchCount += aggressiveMatchResult.matchCount;
    }

    if (debugMode) {
      logMatchingResults(totalMatchCount, matchedIds, isBackView);
    }

    Sentry.addBreadcrumb({
      message: 'Muscle highlighting completed successfully',
      category: 'muscle_highlighting',
      data: {
        totalMatchCount,
        outputLength: output.length,
        matchedIds: matchedIds.slice(0, 10), // First 10 matches
      },
      level: 'info',
    });

    return output;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'muscleHighlighter',
        function: 'highlightMusclesInSvg',
      },
      contexts: {
        muscle_highlighting: {
          isBackView,
          debugMode,
          primaryMuscleCount: primaryMuscles.length,
          secondaryMuscleCount: secondaryMuscles.length,
          svgLength: svg?.length || 0,
        },
      },
    });
    return svg; // Return original SVG on error
  }
}

/**
 * Gets the color for a muscle, with optional transparency for secondary muscles
 */
export function getMuscleColor(muscleKey: string, isPrimary: boolean): string {
  try {
    Sentry.addBreadcrumb({
      message: 'Getting muscle color',
      category: 'muscle_highlighting',
      data: { muscleKey, isPrimary },
      level: 'debug',
    });

    // Handle empty or invalid muscle keys
    if (!muscleKey || typeof muscleKey !== 'string' || muscleKey.trim().length === 0) {
      Sentry.addBreadcrumb({
        message: 'Empty or invalid muscle key provided',
        category: 'muscle_highlighting',
        data: { muscleKey, isPrimary },
        level: 'warning',
      });
      return isPrimary ? '#FF3B30' : '#FF3B30CC'; // Return fallback red color
    }

    const normalizedKey = normalizeMuscleKey(muscleKey);

    // Handle cases where normalization results in empty string
    if (!normalizedKey || normalizedKey.length === 0) {
      Sentry.addBreadcrumb({
        message: 'Muscle key normalization resulted in empty string',
        category: 'muscle_highlighting',
        data: { originalMuscleKey: muscleKey, normalizedKey, isPrimary },
        level: 'warning',
      });
      return isPrimary ? '#FF3B30' : '#FF3B30CC'; // Return fallback red color
    }

    // First try to get the original key from our maps
    let originalKey =
      NORMALIZED_MUSCLE_MAP.get(normalizedKey) || NORMALIZED_INPUT_TO_KEY.get(normalizedKey);

    // If not found, fallback to direct access attempt
    if (!originalKey) {
      // Try to find by partial match
      for (const [key, value] of NORMALIZED_MUSCLE_MAP.entries()) {
        if (key.includes(normalizedKey) || normalizedKey.includes(key)) {
          originalKey = value;
          break;
        }
      }

      // If still not found, use the input key
      if (!originalKey) {
        originalKey = muscleKey;
      }
    }

    // Get the color from the MUSCLE_COLORS object
    let baseColor = MUSCLE_COLORS[normalizedKey];

    // If not found directly, try with the original key
    if (!baseColor && originalKey) {
      const originalNormalized = normalizeMuscleKey(originalKey);
      baseColor = MUSCLE_COLORS[originalNormalized];
    }

    // If still not found, try some common fallback mappings
    if (!baseColor) {
      const fallbackMappings: Record<string, string> = {
        unknown: 'chest',
        other: 'chest',
        general: 'chest',
        fullbody: 'chest',
        compound: 'chest',
      };

      const fallbackKey = fallbackMappings[normalizedKey];
      if (fallbackKey) {
        baseColor = MUSCLE_COLORS[fallbackKey];

        Sentry.addBreadcrumb({
          message: 'Used fallback mapping for muscle color',
          category: 'muscle_highlighting',
          data: {
            originalMuscleKey: muscleKey,
            normalizedKey,
            fallbackKey,
            foundColor: !!baseColor,
            isPrimary,
          },
          level: 'info',
        });
      }
    }

    // If still not found, use a fallback color
    if (!baseColor) {
      baseColor = '#FF3B30'; // fallback to a default red

      Sentry.addBreadcrumb({
        message: 'No muscle color found, using default fallback',
        category: 'muscle_highlighting',
        data: {
          originalMuscleKey: muscleKey,
          normalizedKey,
          originalKey,
          isPrimary,
          availableKeys: Object.keys(MUSCLE_COLORS).slice(0, 10), // Show first 10 available keys for debugging
        },
        level: 'warning',
      });
    }

    return isPrimary ? baseColor : `${baseColor}CC`; // CC = 80% opacity for secondary
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'muscleHighlighter',
        function: 'getMuscleColor',
      },
      contexts: {
        muscle_color: {
          muscleKey,
          isPrimary,
        },
      },
    });
    // Return fallback color on error
    return isPrimary ? '#FF3B30' : '#FF3B30CC';
  }
}

/**
 * Interface for SVG structure analysis result
 */
interface SvgAnalysisResult {
  totalElements?: {
    ids: number;
    paths: number;
    groups: number;
  };
  muscleIdentifiers?: {
    vectorElements: string[] | string;
    shoulderElements: string[] | string;
    muscleElements: string[] | string;
    viewSpecific: string[] | string;
  };
  structure?: {
    hasSvgNamespace: boolean;
    hasViewBox: boolean;
    fillColors: string[] | string;
    hasCommonMusclePatterns: boolean;
  };
  error?: string;
}

/**
 * Analyze SVG structure and muscle IDs to help diagnose highlighting issues
 * Only used in debug mode
 */
export function analyzeSvgStructure(svg: string, isBackView: boolean): SvgAnalysisResult {
  try {
    Sentry.addBreadcrumb({
      message: 'Analyzing SVG structure',
      category: 'muscle_highlighting',
      data: {
        isBackView,
        svgLength: svg?.length || 0,
      },
      level: 'info',
    });

    if (!svg) {
      Sentry.addBreadcrumb({
        message: 'Empty SVG provided for analysis',
        category: 'muscle_highlighting',
        level: 'warning',
      });
      return { error: 'Empty SVG' };
    }
    // Basic SVG info
    const allIds = extractSvgIds(svg);
    const totalPaths = (svg.match(/<path/gi) || []).length;
    const totalGroups = (svg.match(/<g/gi) || []).length;

    // ID categories
    const vectorIds = allIds.filter((id) => /vector/i.test(id));
    const shoulderIds = allIds.filter((id) => /shoulder|delt/i.test(id));
    const muscleIds = allIds.filter((id) =>
      /muscle|bicep|tricep|chest|quad|abs|glute|ham|calf|trap|lat/i.test(id),
    );

    // Front/back specific analysis
    const viewSpecificIds = isBackView
      ? allIds.filter((id) => /back|posterior|rear/i.test(id))
      : allIds.filter((id) => /front|anterior/i.test(id));

    // Analyze for possible structural issues
    const hasSvgNamespace = svg.includes('xmlns="http://www.w3.org/2000/svg"');
    const hasViewBox = svg.includes('viewBox=');

    // Check for fill attributes that might interfere with highlighting
    const fillAttrs = Array.from(svg.matchAll(/fill=["']([^"']*)["']/gi))
      .map((m) => m[1])
      .filter((v, i, a) => a.indexOf(v) === i); // unique values

    // Check if common muscle patterns exist at all
    const hasCommonMusclePatterns = /chest|shoulder|bicep|tricep|abs|quad|glute/i.test(svg);

    const result = {
      totalElements: {
        ids: allIds.length,
        paths: totalPaths,
        groups: totalGroups,
      },
      muscleIdentifiers: {
        vectorElements: vectorIds.length ? vectorIds.slice(0, 5) : 'none',
        shoulderElements: shoulderIds.length ? shoulderIds.slice(0, 5) : 'none',
        muscleElements: muscleIds.length ? muscleIds.slice(0, 10) : 'none',
        viewSpecific: viewSpecificIds.length ? viewSpecificIds.slice(0, 5) : 'none',
      },
      structure: {
        hasSvgNamespace,
        hasViewBox,
        fillColors: fillAttrs.length ? fillAttrs.slice(0, 5) : 'none',
        hasCommonMusclePatterns,
      },
    };

    Sentry.addBreadcrumb({
      message: 'SVG structure analysis completed',
      category: 'muscle_highlighting',
      data: {
        totalIds: allIds.length,
        totalPaths,
        totalGroups,
      },
      level: 'info',
    });

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'muscleHighlighter',
        function: 'analyzeSvgStructure',
      },
      contexts: {
        svg_analysis: {
          isBackView,
          svgLength: svg?.length || 0,
        },
      },
    });
    return { error: String(error) };
  }
}

// Create an object with all exported functions to provide as default export
const muscleHighlighter = {
  MUSCLE_CONFIG,
  highlightMusclesInSvg,
  getMuscleColor,
  extractSvgIds,
  analyzeSvgStructure,
};

export default muscleHighlighter;
