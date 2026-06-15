/**
 * Splash Screen
 *
 * Purpose: UI screen or component: Splash Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/splash
 * Key exports: SplashScreen
 *
 * @file-header
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StatusBar,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { Svg, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get("window");

const LOGO_WIDTH = 240;
const LOGO_HEIGHT = 70;

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);

  useEffect(() => {
    // Make title visible immediately
    opacity.setValue(1);

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();

    const timer = setTimeout(() => {
      onFinish && onFinish();
    }, 3000);

    return () => {
      clearTimeout(timer);
      // Stop animations
      opacity.stopAnimation();
      glow.stopAnimation();
    };
  }, []);

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0618" />

      {/* Video Background */}
      <Video
        ref={videoRef}
        source={require('../assets/motion2Fast_Epic_cinematic_overtheshoulder_view_from_behind_Eg_0.mp4')}
        style={styles.videoBackground}
        resizeMode="cover"
        shouldPlay
        isLooping
        isMuted
        useNativeControls={false}
      />

      {/* Dark overlay for better text visibility */}
      <View style={styles.overlay} />

      {/* CoachConnect Logo */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleShadow}>COACHCONNECT</Text>

        <Animated.Text
          style={[
            styles.titleGlow,
            {
              opacity: glowOpacity,
              textShadowRadius: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 28],
              }),
            },
          ]}
        >
          COACHCONNECT
        </Animated.Text>

        <Svg height={60} width={300} style={styles.svgContainer}>
          <Defs>
            <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor="#FF6B9D" stopOpacity="1" />
              <Stop offset="1" stopColor="#F97316" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <SvgText
            fill="url(#grad)"
            fontSize="42"
            fontWeight="900"
            letterSpacing="4"
            x="0"
            y="45"
          >
            COACHCONNECT
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0618",
    position: 'relative',
  },

  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dark overlay for text visibility
  },

  titleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -LOGO_WIDTH / 2 }, { translateY: -LOGO_HEIGHT / 2 }],
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  titleShadow: {
    position: "absolute",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
    color: "rgba(0,0,0,0.65)",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },

  titleGlow: {
    position: "absolute",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
    color: "rgba(139,92,246,0.45)",
    textShadowColor: "rgba(139,92,246,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },

  titleMain: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#000", // Black color for the mask
  },
  svgContainer: {
    alignSelf: 'center',
  },
  iconImage: {
    width: 40,
    height: 40,
  },
});

