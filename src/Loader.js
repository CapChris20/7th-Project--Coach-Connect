import React from 'react';
import { StyleSheet, View, Animated } from 'react-native';

const Loader = () => {
  // Create animated values for each dot
  const [dot1Anim] = React.useState(new Animated.Value(0));
  const [dot2Anim] = React.useState(new Animated.Value(0));
  const [dot3Anim] = React.useState(new Animated.Value(0));
  const [dot4Anim] = React.useState(new Animated.Value(0));
  const [dot5Anim] = React.useState(new Animated.Value(0));

  // Start animations when component mounts
  React.useEffect(() => {
    const animateDot = (animatedValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 800,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 800,
            delay: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all animations with different delays
    const animations = [
      animateDot(dot1Anim, 100),
      animateDot(dot2Anim, 200),
      animateDot(dot3Anim, 300),
      animateDot(dot4Anim, 400),
      animateDot(dot5Anim, 500),
    ];

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  // Interpolate values for animation
  const dot1Transform = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48], // -3rem ≈ -48px
  });

  const dot1Scale = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot2Transform = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot2Scale = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot3Transform = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot3Scale = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot4Transform = dot4Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot4Scale = dot4Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot5Transform = dot5Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot5Scale = dot5Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  return (
    <View style={styles.container}>
      <View style={styles.loader}>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot1Transform },
                { scale: dot1Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot1Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot2Transform },
                { scale: dot2Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot2Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot3Transform },
                { scale: dot3Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot3Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot4Transform },
                { scale: dot4Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot4Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot5Transform },
                { scale: dot5Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot5Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68, // 20px dot + 48px jump space
  },
  dot: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#212121',
    marginHorizontal: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  dotBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: '#16b0c1',
  },
  dotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: '#661e92',
  },
});

export default Loader;
