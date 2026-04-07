import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const TranscriptionOverlay = ({ text, isListening, isDarkMode }) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isListening) {
      pulse.value = withRepeat(
        withTiming(1.2, { duration: 1000 }),
        -1,
        true
      );
    } else {
      pulse.value = withSpring(1);
    }
  }, [isListening]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      opacity: interpolate(pulse.value, [1, 1.2], [0.8, 1], Extrapolate.CLAMP)
    };
  });

  if (!isListening && !text) return null;

  return (
    <Animated.View 
      style={[
        styles.overlay, 
        { backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(248, 250, 252, 0.95)' }
      ]}
      entering={withSpring({ opacity: 1 })}
      exiting={withSpring({ opacity: 0 })}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.micContainer, animatedIconStyle]}>
          <Ionicons name="mic" size={40} color="#ef4444" />
        </Animated.View>
        
        <Text style={[styles.statusLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
          {isListening ? 'Listening...' : 'Thinking...'}
        </Text>

        <View style={styles.textContainer}>
          <Text 
            style={[
              styles.transcriptionText, 
              { color: isDarkMode ? '#f8fafc' : '#1e293b' }
            ]}
            numberOfLines={4}
          >
            {text || "I'm listening..."}
          </Text>
        </View>

        {isListening && (
          <View style={styles.waveContainer}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <WaveBar key={i} index={i} isListening={isListening} />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const WaveBar = ({ index, isListening }) => {
  const height = useSharedValue(10);

  useEffect(() => {
    if (isListening) {
      height.value = withRepeat(
        withTiming(10 + Math.random() * 30, { duration: 300 + Math.random() * 500 }),
        -1,
        true
      );
    } else {
      height.value = withSpring(10);
    }
  }, [isListening]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.waveBar, animatedStyle]} />;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  micContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
  },
  textContainer: {
    width: '100%',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptionText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 34,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginTop: 40,
  },
  waveBar: {
    width: 4,
    backgroundColor: '#ef4444',
    marginHorizontal: 3,
    borderRadius: 2,
  },
});

export default TranscriptionOverlay;
