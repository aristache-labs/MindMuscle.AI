import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Sentry from '@sentry/react-native';
import {
  highlightMusclesInSvg,
  extractSvgIds,
  analyzeSvgStructure,
  MUSCLE_CONFIG,
} from '../utils/muscleHighlighter';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

// Error Boundary specifically for SVG components
class SvgErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        component: 'SvgErrorBoundary',
        action: 'svg_render_error',
      },
      extra: {
        errorInfo,
        stack: error.stack,
        message: error.message,
      },
    });
    console.error('SVG Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

interface BodyViewProps {
  svg: string | null;
  loading: boolean;
  placeholderText: string;
  visible?: boolean;
}

// Memoized BodyView component to prevent unnecessary re-renders
const BodyView = React.memo(({ svg, loading, placeholderText, visible = true }: BodyViewProps) => {
  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} />;
  }

  if (!svg) {
    return (
      <View style={styles.bodyPlaceholder}>
        <Text style={styles.placeholderText}>{placeholderText}</Text>
      </View>
    );
  }

  // Don't render SVG if not visible to prevent JSI issues
  if (!visible) {
    return (
      <View style={styles.bodyPlaceholder}>
        <Text style={styles.placeholderText}>Loading diagram...</Text>
      </View>
    );
  }

  // Additional safety check - don't render if svg is still being processed
  if (!svg || svg.length === 0) {
    return (
      <View style={styles.bodyPlaceholder}>
        <Text style={styles.placeholderText}>{placeholderText}</Text>
      </View>
    );
  }

  // Wrap SVG in error boundary for additional safety
  const errorFallback = (
    <View style={styles.bodyPlaceholder}>
      <Text style={styles.placeholderText}>Error displaying diagram</Text>
    </View>
  );

  // Safely render SVG, handling potential parsing errors
  try {
    return (
      <SvgErrorBoundary fallback={errorFallback}>
        <SvgXml xml={svg} width="100%" height="100%" />
      </SvgErrorBoundary>
    );
  } catch (error) {
    console.warn('Error rendering SVG:', error);
    Sentry.captureException(error, {
      tags: {
        component: 'MuscleDiagram',
        action: 'svg_render',
      },
      extra: {
        svgLength: svg?.length,
        placeholderText,
        visible,
      },
    });
    return errorFallback;
  }
});

BodyView.displayName = 'BodyView';

interface MuscleDiagramProps {
  frontBodySvg: string | null;
  backBodySvg: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  loading: boolean;
  isCardioExercise: boolean;
  debugMode?: boolean;
  visible?: boolean;
}

export default function MuscleDiagram({
  frontBodySvg,
  backBodySvg,
  primaryMuscles,
  secondaryMuscles,
  loading,
  isCardioExercise,
  debugMode = false,
  visible = true,
}: MuscleDiagramProps) {
  // Early return if not visible to prevent any SVG processing
  if (!visible) {
    return (
      <View style={styles.muscleMapContainer}>
        <View style={styles.bodyPlaceholder}>
          <Text style={styles.placeholderText}>Diagram not visible</Text>
        </View>
      </View>
    );
  }

  // Track component mount
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MuscleDiagram component mounted',
      category: 'ui.lifecycle',
      data: {
        primaryMusclesCount: primaryMuscles.length,
        secondaryMusclesCount: secondaryMuscles.length,
        isCardioExercise,
        debugMode,
        hasFrontSvg: !!frontBodySvg,
        hasBackSvg: !!backBodySvg,
        visible,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'MuscleDiagram component unmounted',
        category: 'ui.lifecycle',
        data: {
          visible,
        },
      });
    };
  }, []);

  // Track visibility changes
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: `MuscleDiagram visibility changed to ${visible}`,
      category: 'ui.lifecycle',
      data: {
        visible,
        hasSvgData: !!(frontBodySvg || backBodySvg),
      },
    });
  }, [visible, frontBodySvg, backBodySvg]);

  // Track muscle data changes
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MuscleDiagram muscle data updated',
      category: 'ui.update',
      data: {
        primaryMuscles: primaryMuscles.join(', '),
        secondaryMuscles: secondaryMuscles.join(', '),
        isCardioExercise,
      },
    });
  }, [primaryMuscles.join(','), secondaryMuscles.join(','), isCardioExercise]);

  // Ensure Cardio is included in primaryMuscles when isCardioExercise is true
  const enhancedPrimaryMuscles = useMemo(() => {
    try {
      if (isCardioExercise && !primaryMuscles.some((m) => m.toLowerCase() === 'cardio')) {
        return ['Cardio', ...primaryMuscles];
      }
      return primaryMuscles;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MuscleDiagram',
          action: 'enhance_muscles',
        },
        extra: {
          primaryMuscles,
          isCardioExercise,
        },
      });
      return primaryMuscles;
    }
  }, [primaryMuscles, isCardioExercise]);

  // Normalize muscle names to improve matching
  const normalizedSecondaryMuscles = useMemo(() => {
    try {
      return secondaryMuscles.map((m) => m.trim());
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MuscleDiagram',
          action: 'normalize_muscles',
        },
        extra: {
          secondaryMuscles,
        },
      });
      return secondaryMuscles;
    }
  }, [secondaryMuscles]);

  // Debug SVG structure if needed
  useMemo(() => {
    if (debugMode) {
      try {
        console.log('======= MUSCLE DIAGRAM DEBUG =======');
        console.log('Muscles to highlight:', {
          primary: enhancedPrimaryMuscles,
          secondary: normalizedSecondaryMuscles,
        });

        // Analyze front SVG
        if (frontBodySvg) {
          console.log('--- FRONT SVG ANALYSIS ---');
          console.log(analyzeSvgStructure(frontBodySvg, false));
        } else {
          console.warn('Front SVG is missing');
        }

        // Analyze back SVG
        if (backBodySvg) {
          console.log('--- BACK SVG ANALYSIS ---');
          console.log(analyzeSvgStructure(backBodySvg, true));
        } else {
          console.warn('Back SVG is missing');
        }

        console.log('==================================');
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MuscleDiagram',
            action: 'debug_analysis',
          },
          extra: {
            hasFrontSvg: !!frontBodySvg,
            hasBackSvg: !!backBodySvg,
            enhancedPrimaryMuscles,
            normalizedSecondaryMuscles,
          },
        });
      }
    }
  }, [frontBodySvg, backBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  // Add diagnostic logging for SVG IDs and colors
  useMemo(() => {
    if (debugMode) {
      try {
        console.log('\n=== SVG ID Analysis ===');

        // Analyze front view
        if (frontBodySvg) {
          const frontIds = extractSvgIds(frontBodySvg);
          console.log('\nFRONT VIEW IDs:');
          console.log('----------------');
          frontIds.forEach((id) => {
            // Try to identify if this ID matches any muscle
            const lowerCaseId = id.toLowerCase();
            const matchingMuscle = Object.entries(MUSCLE_CONFIG).find(([, config]) =>
              config.ids.some(
                (muscleId) =>
                  lowerCaseId.includes(muscleId.toLowerCase()) ||
                  muscleId.toLowerCase().includes(lowerCaseId),
              ),
            );

            if (matchingMuscle) {
              const [muscleName, config] = matchingMuscle;
              const isPrimary = primaryMuscles.some(
                (m) =>
                  m.toLowerCase().includes(muscleName.toLowerCase()) ||
                  muscleName.toLowerCase().includes(m.toLowerCase()),
              );
              const isSecondary = secondaryMuscles.some(
                (m) =>
                  m.toLowerCase().includes(muscleName.toLowerCase()) ||
                  muscleName.toLowerCase().includes(m.toLowerCase()),
              );

              console.log(`ID: ${id}`);
              console.log(`  → Matches muscle: ${muscleName}`);
              console.log(`  → Expected color: ${config.color}${isSecondary ? '80' : ''}`);
              console.log(
                `  → Role: ${isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : 'NOT TARGETED'}`,
              );
              console.log('----------------');
            } else if (id.toLowerCase().includes('vector')) {
              console.log(`ID: ${id}`);
              console.log('  → Vector element (no muscle match)');
              console.log('----------------');
            }
          });
        } else {
          console.log('No front view SVG available');
        }

        // Analyze back view
        if (backBodySvg) {
          const backIds = extractSvgIds(backBodySvg);
          console.log('\nBACK VIEW IDs:');
          console.log('----------------');
          backIds.forEach((id) => {
            // Try to identify if this ID matches any muscle
            const lowerCaseId = id.toLowerCase();
            const matchingMuscle = Object.entries(MUSCLE_CONFIG).find(([, config]) =>
              config.ids.some(
                (muscleId) =>
                  lowerCaseId.includes(muscleId.toLowerCase()) ||
                  muscleId.toLowerCase().includes(lowerCaseId),
              ),
            );

            if (matchingMuscle) {
              const [muscleName, config] = matchingMuscle;
              const isPrimary = primaryMuscles.some(
                (m) =>
                  m.toLowerCase().includes(muscleName.toLowerCase()) ||
                  muscleName.toLowerCase().includes(m.toLowerCase()),
              );
              const isSecondary = secondaryMuscles.some(
                (m) =>
                  m.toLowerCase().includes(muscleName.toLowerCase()) ||
                  muscleName.toLowerCase().includes(m.toLowerCase()),
              );

              console.log(`ID: ${id}`);
              console.log(`  → Matches muscle: ${muscleName}`);
              console.log(`  → Expected color: ${config.color}${isSecondary ? '80' : ''}`);
              console.log(
                `  → Role: ${isPrimary ? 'PRIMARY' : isSecondary ? 'SECONDARY' : 'NOT TARGETED'}`,
              );
              console.log('----------------');
            } else if (id.toLowerCase().includes('vector')) {
              console.log(`ID: ${id}`);
              console.log('  → Vector element (no muscle match)');
              console.log('----------------');
            }
          });
        } else {
          console.log('No back view SVG available');
        }

        console.log('\nTarget Muscles:');
        console.log('Primary:', primaryMuscles);
        console.log('Secondary:', secondaryMuscles);
        console.log('===================\n');
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MuscleDiagram',
            action: 'svg_id_analysis',
          },
          extra: {
            hasFrontSvg: !!frontBodySvg,
            hasBackSvg: !!backBodySvg,
            primaryMuscles,
            secondaryMuscles,
          },
        });
      }
    }
  }, [frontBodySvg, backBodySvg, primaryMuscles, secondaryMuscles, debugMode]);

  // Memoize the highlighted SVGs to avoid recalculating on every render
  const highlightedFrontSvg = useMemo(() => {
    // Don't process SVG if component is not visible to prevent JSI crashes
    if (!visible || !frontBodySvg) return null;

    const startTime = performance.now();
    try {
      if (debugMode) {
        console.log('[FRONT] Generating highlighted SVG');
      }

      const result = highlightMusclesInSvg(
        frontBodySvg,
        enhancedPrimaryMuscles,
        normalizedSecondaryMuscles,
        false, // isBackView
        debugMode, // debug mode
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Track performance
      Sentry.addBreadcrumb({
        message: 'Front SVG highlighting completed',
        category: 'performance',
        data: {
          duration: `${duration.toFixed(2)}ms`,
          primaryMusclesCount: enhancedPrimaryMuscles.length,
          secondaryMusclesCount: normalizedSecondaryMuscles.length,
          wasModified: result !== frontBodySvg,
        },
      });

      // Check if front SVG was modified
      if (debugMode) {
        if (result === frontBodySvg) {
          console.warn('[FRONT] WARNING: SVG was not modified by highlighting process');
          Sentry.captureMessage('Front SVG not modified during highlighting', {
            level: 'warning',
            tags: {
              component: 'MuscleDiagram',
              action: 'front_svg_highlighting',
            },
            extra: {
              primaryMuscles: enhancedPrimaryMuscles,
              secondaryMuscles: normalizedSecondaryMuscles,
            },
          });
        } else {
          console.log('[FRONT] SVG was successfully modified');
        }
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      Sentry.captureException(error, {
        tags: {
          component: 'MuscleDiagram',
          action: 'front_svg_highlighting',
        },
        extra: {
          duration: `${duration.toFixed(2)}ms`,
          svgLength: frontBodySvg?.length,
          primaryMuscles: enhancedPrimaryMuscles,
          secondaryMuscles: normalizedSecondaryMuscles,
          debugMode,
        },
      });

      return frontBodySvg; // Return original SVG on error
    }
  }, [visible, frontBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  const highlightedBackSvg = useMemo(() => {
    // Don't process SVG if component is not visible to prevent JSI crashes
    if (!visible || !backBodySvg) return null;

    const startTime = performance.now();
    try {
      if (debugMode) {
        console.log('[BACK] Generating highlighted SVG');
      }

      const result = highlightMusclesInSvg(
        backBodySvg,
        enhancedPrimaryMuscles,
        normalizedSecondaryMuscles,
        true, // isBackView
        debugMode, // debug mode
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Track performance
      Sentry.addBreadcrumb({
        message: 'Back SVG highlighting completed',
        category: 'performance',
        data: {
          duration: `${duration.toFixed(2)}ms`,
          primaryMusclesCount: enhancedPrimaryMuscles.length,
          secondaryMusclesCount: normalizedSecondaryMuscles.length,
          wasModified: result !== backBodySvg,
        },
      });

      // Check if back SVG was modified
      if (debugMode) {
        if (result === backBodySvg) {
          console.warn('[BACK] WARNING: SVG was not modified by highlighting process');
          Sentry.captureMessage('Back SVG not modified during highlighting', {
            level: 'warning',
            tags: {
              component: 'MuscleDiagram',
              action: 'back_svg_highlighting',
            },
            extra: {
              primaryMuscles: enhancedPrimaryMuscles,
              secondaryMuscles: normalizedSecondaryMuscles,
            },
          });
        } else {
          console.log('[BACK] SVG was successfully modified');
        }
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      Sentry.captureException(error, {
        tags: {
          component: 'MuscleDiagram',
          action: 'back_svg_highlighting',
        },
        extra: {
          duration: `${duration.toFixed(2)}ms`,
          svgLength: backBodySvg?.length,
          primaryMuscles: enhancedPrimaryMuscles,
          secondaryMuscles: normalizedSecondaryMuscles,
          debugMode,
        },
      });

      return backBodySvg; // Return original SVG on error
    }
  }, [visible, backBodySvg, enhancedPrimaryMuscles, normalizedSecondaryMuscles, debugMode]);

  const views = useMemo(
    () => [
      { svg: highlightedFrontSvg, text: 'Front view not available' },
      { svg: highlightedBackSvg, text: 'Back view not available' },
    ],
    [highlightedFrontSvg, highlightedBackSvg],
  );

  // Track loading state changes
  React.useEffect(() => {
    if (loading) {
      Sentry.addBreadcrumb({
        message: 'MuscleDiagram loading started',
        category: 'ui.state',
      });
    } else {
      Sentry.addBreadcrumb({
        message: 'MuscleDiagram loading completed',
        category: 'ui.state',
        data: {
          hasFrontSvg: !!highlightedFrontSvg,
          hasBackSvg: !!highlightedBackSvg,
          visible,
        },
      });
    }
  }, [loading, highlightedFrontSvg, highlightedBackSvg, visible]);

  return (
    <View style={styles.muscleMapContainer}>
      <View style={styles.muscleMap}>
        <View style={styles.bodyViewContainer}>
          {views.map((view, index) => (
            <View key={index} style={styles.bodyView}>
              <BodyView
                loading={loading}
                svg={view.svg}
                placeholderText={view.text}
                visible={visible}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muscleMapContainer: {
    marginVertical: SPACING.md,
  },
  muscleMap: {
    position: 'relative',
    marginVertical: SPACING.md * -1,
  },
  bodyViewContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bodyView: {
    width: '45%',
    height: 325,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyPlaceholder: {
    width: '90%',
    height: '95%',
    backgroundColor: 'rgba(100,100,100,0.3)',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: SPACING.sm,
  },
});
