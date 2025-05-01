import { COLORS } from '../constants/theme';

// Types for muscle configuration
export type MuscleView = 'front' | 'back' | 'both';

export interface MuscleConfig {
  ids: string[];            // Base SVG element ID prefixes for this muscle
  view: MuscleView;         // Whether this muscle is visible in front, back, or both views
  color: string;            // Color to use for this muscle
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
  cardio:     { ids: ['Cardio', 'Heart', 'CardioSystem', 'cardiovascular', 'Cardiovascular'],        view: 'front', color: MUSCLE_COLORS.cardio },
  chest:      { ids: ['Chest', 'Chest_2', 'Chest_3', 'Chest_4', 'pectorals', 'pecs', 'Pectorals', 'Pectoralis', 'PectoralisMajor', 'Pecs', 'chest-left', 'chest-right', 'chest_left', 'chest_right'],      view: 'front', color: MUSCLE_COLORS.chest },
  shoulders:  { ids: ['Shoulders', 'Shoulders_2', 'Shoulders_3', 'Delts', 'delts', 'deltoids', 'Deltoids', 'Shoulder', 'shoulder', 'deltoid', 'Deltoid', 'LeftShoulder', 'RightShoulder', 'ShoulderLeft', 'ShoulderRight', 'shoulder-left', 'shoulder-right', 'shoulders-left', 'shoulders-right', 'ShoulderMuscles', 'DeltoidGroup'],      view: 'both',  color: MUSCLE_COLORS.shoulders },
  triceps:    { ids: ['Triceps', 'tricep', 'Tricep', 'Triceps-left', 'Triceps-right', 'Triceps_left', 'Triceps_right', 'triceps-left', 'triceps-right', 'triceps_left', 'triceps_right'],                 view: 'both',  color: MUSCLE_COLORS.triceps },
  biceps:     { ids: ['Biceps', 'Biceps_2', 'bicep', 'Biceps-left', 'Biceps-right', 'Biceps_left', 'Biceps_right', 'biceps-left', 'biceps-right', 'biceps_left', 'biceps_right'],                  view: 'front', color: MUSCLE_COLORS.biceps },
  forearms:   { ids: ['Forearms', 'Forearms_2', 'Forearms_3', 'Forearms_4', 'Forearms_5', 'Forearms_6', 'ForearmBack', 'ForearmBack_Left', 'ForearmBack_Right', 'forearm-left', 'forearm-right', 'forearms-left', 'forearms-right'],      view: 'both',  color: MUSCLE_COLORS.forearms },
  abs:        { ids: ['Abs', 'Abs_2', 'Abs_3', 'abdomen', 'abdominals', 'Abdomen', 'Abdominals', 'rectus-abdominis', 'six-pack', 'Rectus_Abdominis', 'Rectus', 'Core', 'abs-upper', 'abs-lower', 'abs_upper', 'abs_lower'],             view: 'front', color: MUSCLE_COLORS.abs },
  obliques:   { ids: ['Obliques', 'Obliques_2', 'Obliques_3', 'Obliques_4', 'Obliques_5', 'oblique', 'external-obliques', 'internal-obliques', 'obliques-front', 'obliques-back', 'obliques-left', 'obliques-right'],                view: 'both',  color: MUSCLE_COLORS.obliques },
  quads:      { ids: ['Quads', 'Quads_2', 'quadriceps', 'QuadricepsFemoris', 'Quadriceps-Femoris', 'quad', 'Quad', 'quads', 'QuadGroup', 'Front-Thigh', 'quads-left', 'quads-right', 'quad-left', 'quad-right'],                   view: 'front', color: MUSCLE_COLORS.quads },
  adductors:  { ids: ['Adductors', 'Adductors_2', 'Adductors_3', 'Adductors_4', 'Adductors_5', 'Aductors', 'adductor', 'Adductor', 'adductors', 'inner-thigh', 'inner-thighs', 'groin', 'adductors-left', 'adductors-right'],      view: 'both',  color: MUSCLE_COLORS.adductors },
  abductors:  { ids: ['Abductors', 'Abductors_2', 'AbductorGroup', 'hip-abductors', 'hip-abductor', 'abductor', 'abductors-left', 'abductors-right'],               view: 'front', color: MUSCLE_COLORS.abductors },
  lats:       { ids: ['Lats', 'Lats_2', 'latissimus', 'latissimus-dorsi', 'LatissimusDorsi', 'Back-Wings', 'BackWings', 'lats-left', 'lats-right', 'lat-left', 'lat-right'],                    view: 'back',  color: MUSCLE_COLORS.lats },
  traps:      { ids: ['Traps', 'Traps_2', 'Traps_3', 'Traps_4', 'trapezius', 'Trapezius', 'TrapMuscle', 'trap', 'Trap', 'TrapeziusGroup', 'trapezius-muscle', 'upper-back', 'traps-upper', 'traps-middle', 'traps-lower'],      view: 'both',  color: MUSCLE_COLORS.traps },
  lowerback:  { ids: ['Lower Back', 'LowerBack', 'lower-back', 'erectorspinae', 'erector-spinae', 'Erector', 'Lower_Back', 'Lowerback', 'erector', 'LumbarRegion', 'Lumbar', 'lumbar', 'SpinalErectors', 'lower-back-left', 'lower-back-right'],    view: 'back',  color: MUSCLE_COLORS.lowerback },
  'lower back': { ids: ['Lower Back', 'LowerBack', 'lower-back', 'erectorspinae', 'erector-spinae', 'Erector', 'Lower_Back', 'Lowerback', 'erector', 'LumbarRegion', 'Lumbar', 'lumbar', 'SpinalErectors', 'lower-back-left', 'lower-back-right'],             view: 'back',  color: MUSCLE_COLORS.lowerback },
  glutes:     { ids: ['Glutes', 'gluteus', 'GluteusMaximus', 'gluteus-maximus', 'butt', 'buttocks', 'Buttocks', 'GluteusMuscle', 'Glute', 'glute', 'glutes-left', 'glutes-right', 'glute-left', 'glute-right'],                  view: 'back',  color: MUSCLE_COLORS.glutes },
  hamstrings: { ids: ['Hamstrings', 'Hamstrings_2', 'Hamstrings_3', 'Hamstrings_4', 'hamstring', 'Hamstring', 'BackThigh', 'back-thigh', 'HamstringGroup', 'hamstrings-left', 'hamstrings-right'],              view: 'back',  color: MUSCLE_COLORS.hamstrings },
  calves:     { ids: ['Calves', 'calf', 'gastrocnemius', 'Gastrocnemius', 'SoleusMuscle', 'soleus', 'Soleus', 'CalfMuscle', 'calf-muscle', 'lower-leg', 'calves-left', 'calves-right', 'calf-left', 'calf-right'],                  view: 'both',  color: MUSCLE_COLORS.calves },
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
  
  cfg.ids.forEach(id => {
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
  
  return null;
}

/**
 * Performs a basic validation check on an SVG string
 * Using simple regex patterns instead of DOMParser which is not available in React Native
 */
function validateSvg(svg: string): { isValid: boolean; error?: string } {
  try {
    // Basic structure checks
    if (!svg.includes('<svg')) {
      return { isValid: false, error: 'Missing <svg> tag' };
    }

    // Check for opening/closing tag balance
    const openingTags = (svg.match(/<[^/][^>]*>/g) || []).length;
    const closingTags = (svg.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (svg.match(/<[^>]*\/>/g) || []).length;
    
    if (openingTags - closingTags - selfClosingTags !== 0) {
      return { 
        isValid: false, 
        error: `Tag mismatch: ${openingTags} opening, ${closingTags} closing, ${selfClosingTags} self-closing` 
      };
    }

    // Check for common syntax errors
    if (svg.includes('"/ style="')) {
      return { isValid: false, error: 'Malformed style attribute: "/ style="' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: String(error) };
  }
}

/**
 * Extracts all IDs from an SVG string for diagnostic purposes
 */
export function extractSvgIds(svg: string): string[] {
  if (!svg) return [];
  
  const idMatches = Array.from(svg.matchAll(/id=["']([^"']+)["']/g)).map(m => m[1]);
  return idMatches;
}

/**
 * Enhanced ID matching function to help identify muscle elements with different naming patterns
 */
function findSvgElementsByPattern(svg: string, pattern: string): string[] {
  if (!svg) return [];
  
  const regex = new RegExp(`id=["']([^"']*${pattern}[^"']*)["']`, 'gi');
  const matches = Array.from(svg.matchAll(regex)).map(m => m[1]);
  return matches;
}

/**
 * Highlight muscles in an SVG string based on primary and secondary muscles
 */
export function highlightMusclesInSvg(
  svg: string,
  primaryMuscles: string[],
  secondaryMuscles: string[],
  isBackView: boolean,
  debugMode: boolean = false
): string {
  if (!svg) return '';

  if (debugMode) {
    console.log(`[SVG] Processing ${isBackView ? 'BACK' : 'FRONT'} view with muscles:`, {
      primary: primaryMuscles,
      secondary: secondaryMuscles,
    });
  }

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
      secondary: secondaryMuscleKeys
    });
  }

  // Create sets of normalized muscle keys for quick lookup
  const primarySet = new Set(primaryMuscles.map(m => normalizeMuscleKey(m)));
  const secondarySet = new Set(secondaryMuscles.map(m => normalizeMuscleKey(m)));

  // Also add normalized keys of the mapped muscles
  primaryMuscleKeys.forEach(key => primarySet.add(normalizeMuscleKey(key)));
  secondaryMuscleKeys.forEach(key => secondarySet.add(normalizeMuscleKey(key)));

  let output = svg;
  let totalMatchCount = 0;
  const matchedIds: string[] = [];

  // Extract all IDs from the SVG for analysis
  const allIds = extractSvgIds(svg);
  
  if (debugMode) {
    console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Found IDs:`, allIds.slice(0, 20));
  }

  // First try direct muscle name matching
  PRECOMPILED.forEach(({ id, view, muscleKey }) => {
    // Skip if view doesn't match current front/back selection
    if (view !== 'both') {
      if (isBackView && view !== 'back') return;
      if (!isBackView && view !== 'front') return;
    }

    // Determine style for this muscle using consistent normalization
    const normalizedKey = normalizeMuscleKey(muscleKey);
    let style = '';

    // Get original key from normalized key
    const originalKey = NORMALIZED_MUSCLE_MAP.get(normalizedKey) || muscleKey;
    
    if (primarySet.has(normalizedKey)) {
      style = `fill:${MUSCLE_CONFIG[originalKey].color};stroke:white;stroke-width:0.5;`;
    } else if (secondarySet.has(normalizedKey)) {
      style = `fill:${MUSCLE_CONFIG[originalKey].color}CC;stroke:white;stroke-width:0.5;`;
    } else {
      return;
    }

    // Try exact ID match first
    const exactPattern = `(<[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*?)(>|\\/>)`;
    const exactRegex = new RegExp(exactPattern, 'gi');
    
    let tempOutput = output;
    output = output.replace(exactRegex, (match, prefix, closeTag) => {
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
    
    if (tempOutput !== output) {
      matchedIds.push(id);
      totalMatchCount++;
      if (debugMode) {
        console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Matched muscle: ${muscleKey} (${id})`);
      }
    }
  });

  // If no matches found, try more aggressive matching for the front view
  if (!isBackView && totalMatchCount === 0) {
    if (debugMode) {
      console.log('[SVG:FRONT] No direct matches found, trying aggressive matching');
    }
    
    // Try to match any IDs that contain muscle names
    [...primarySet, ...secondarySet].forEach(muscleKey => {
      const isPrimary = primarySet.has(muscleKey);
      const originalKey = NORMALIZED_MUSCLE_MAP.get(muscleKey) || muscleKey;
      const muscleConfig = MUSCLE_CONFIG[originalKey];
      
      if (!muscleConfig || (muscleConfig.view !== 'both' && muscleConfig.view !== 'front')) {
        return;
      }
      
      const style = `fill:${muscleConfig.color}${isPrimary ? '' : 'CC'};stroke:white;stroke-width:0.5;`;
      
      // Try to find any elements with IDs containing this muscle name
      const musclePattern = new RegExp(`<[^>]*\\bid=["'][^"']*?${escapeRegExp(originalKey)}[^"']*?["'][^>]*?>`, 'gi');
      const matches = Array.from(svg.matchAll(musclePattern));
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const element = match[0];
          if (!element.includes('style="')) {
            const styledElement = element.replace(/>$/, ` style="${style}">`);
            output = output.replace(element, styledElement);
            totalMatchCount++;
            if (debugMode) {
              console.log(`[SVG:FRONT] Matched muscle by name: ${originalKey}`);
            }
          }
        });
      }
    });
  }

  if (debugMode) {
    if (totalMatchCount === 0) {
      console.warn(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] WARNING: No muscles were matched in the SVG`);
    } else {
      console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Total matches: ${totalMatchCount}`);
      if (matchedIds.length > 0) {
        console.log(`[SVG:${isBackView ? 'BACK' : 'FRONT'}] Matched IDs:`, matchedIds);
      }
    }
  }

  return output;
}

/**
 * Escapes special characters in a string for use in a regular expression
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Gets the color for a muscle, with optional transparency for secondary muscles
 */
export function getMuscleColor(muscleKey: string, isPrimary: boolean): string {
  const normalizedKey = normalizeMuscleKey(muscleKey);
  
  // First try to get the original key from our maps
  let originalKey = NORMALIZED_MUSCLE_MAP.get(normalizedKey) || 
                    NORMALIZED_INPUT_TO_KEY.get(normalizedKey);
  
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
  
  // If still not found, use a fallback color
  if (!baseColor) {
    baseColor = '#FF3B30'; // fallback to a default red
  }
  
  return isPrimary ? baseColor : `${baseColor}CC`; // CC = 80% opacity for secondary
}

/**
 * Analyze SVG structure and muscle IDs to help diagnose highlighting issues
 * Only used in debug mode
 */
export function analyzeSvgStructure(svg: string, isBackView: boolean): Record<string, any> {
  if (!svg) return { error: 'Empty SVG' };
  
  try {
    // Basic SVG info
    const allIds = extractSvgIds(svg);
    const totalPaths = (svg.match(/<path/gi) || []).length;
    const totalGroups = (svg.match(/<g/gi) || []).length;
    
    // ID categories
    const vectorIds = allIds.filter(id => /vector/i.test(id));
    const shoulderIds = allIds.filter(id => /shoulder|delt/i.test(id));
    const muscleIds = allIds.filter(id => 
      /muscle|bicep|tricep|chest|quad|abs|glute|ham|calf|trap|lat/i.test(id)
    );
    
    // Front/back specific analysis
    const viewSpecificIds = isBackView ? 
      allIds.filter(id => /back|posterior|rear/i.test(id)) : 
      allIds.filter(id => /front|anterior/i.test(id));
      
    // Analyze for possible structural issues
    const hasSvgNamespace = svg.includes('xmlns="http://www.w3.org/2000/svg"');
    const hasViewBox = svg.includes('viewBox=');
    
    // Check for fill attributes that might interfere with highlighting
    const fillAttrs = Array.from(svg.matchAll(/fill=["']([^"']*)["']/gi))
      .map(m => m[1])
      .filter((v, i, a) => a.indexOf(v) === i); // unique values
    
    // Check if common muscle patterns exist at all
    const hasCommonMusclePatterns = 
      /chest|shoulder|bicep|tricep|abs|quad|glute/i.test(svg);
      
    return {
      totalElements: {
        ids: allIds.length,
        paths: totalPaths,
        groups: totalGroups,
      },
      muscleIdentifiers: {
        vectorElements: vectorIds.length ? vectorIds.slice(0, 5) : 'none',
        shoulderElements: shoulderIds.length ? shoulderIds.slice(0, 5) : 'none',
        muscleElements: muscleIds.length ? muscleIds.slice(0, 10) : 'none',
        viewSpecific: viewSpecificIds.length ? viewSpecificIds.slice(0, 5) : 'none'
      },
      structure: {
        hasSvgNamespace,
        hasViewBox,
        fillColors: fillAttrs.length ? fillAttrs.slice(0, 5) : 'none',
        hasCommonMusclePatterns
      }
    };
  } catch (error) {
    return { error: String(error) };
  }
}
