import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth, db } from '../../app/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, withDelay, Easing, withRepeat, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';

// --- Reusable Components ---

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const AnimatedStatValue = ({ value }) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: 1000,
      easing: Easing.out(Easing.quad),
    });
  }, [value]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(animatedValue.value)}`,
    };
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      style={styles.statValue}
      animatedProps={animatedProps}
    />
  );
};

const Stat = ({ icon, value, label, colors, suffix = '', isPulsing = false }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isPulsing) {
      scale.value = withRepeat(
        withTiming(1.15, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    }
  }, [isPulsing]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: isPulsing ? scale.value : 1 }],
    };
  });

    return (
    <TouchableOpacity 
      style={styles.statItem}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`You have completed ${value} ${label.toLowerCase()}`}>

      <LinearGradient colors={colors} style={styles.statIcon}>
        <Animated.View style={animatedIconStyle}>
          <Ionicons name={icon} size={28} color="white" />
        </Animated.View>
      </LinearGradient>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <AnimatedStatValue value={value} />
        {suffix && <Text style={styles.statValue}>{suffix}</Text>}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const StatsRow = ({ stats }) => (
  <View style={styles.statsContainer}>
    <Stat icon="barbell" value={stats.workouts} label="WORKOUTS" colors={['#8B7FFF', '#60A5FA']} />
    <View style={styles.statDivider} />
    <Stat icon="time" value={stats.minutes} suffix="m" label="TIME" colors={['#32D74B', '#2DD4BF']} />
    <View style={styles.statDivider} />
    <Stat icon="flame" value={stats.streak} label="STREAK" colors={['#FF9F0A', '#FFD60A']} isPulsing={stats.streak > 0} />
  </View>
);

const ActionCard = ({ icon, title, subtitle, colors }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={() => (scale.value = withSpring(0.98))}
      onPressOut={() => (scale.value = withSpring(1))}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <Animated.View style={animatedStyle}>
        <BlurView intensity={80} tint="dark" style={styles.actionCard}>
          <LinearGradient colors={colors} style={styles.actionIcon}>
            <Ionicons name={icon} size={28} color="white" />
          </LinearGradient>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionSubtitle}>{subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255, 255, 255, 0.3)" />
        </BlurView>
      </Animated.View>
    </TouchableOpacity>
  );
};

const AnimatedActionCard = ({ icon, title, subtitle, colors, index }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(index * 100, withTiming(1));
    translateY.value = withDelay(index * 100, withTiming(0));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ActionCard icon={icon} title={title} subtitle={subtitle} colors={colors} />
    </Animated.View>
  );
};

const ProgramCard = ({ thumbnail, name, duration, isActive }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={() => (scale.value = withSpring(0.98))}
      onPressOut={() => (scale.value = withSpring(1))}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${duration}`}
      accessibilityHint={isActive ? "This is your active program" : "View program details"}
    >
      <Animated.View style={animatedStyle}>
        <BlurView intensity={80} tint="dark" style={styles.programCard}>
          <Image source={thumbnail} style={styles.programThumbnail} />
          <View style={styles.programInfo}>
            <Text style={styles.programName}>{name}</Text>
            <Text style={styles.programDuration}>{duration}</Text>
          </View>
          {isActive && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          )}
        </BlurView>
      </Animated.View>
    </TouchableOpacity>
  );
};

const ProgramsSection = () => (
  <View style={styles.programsContainer}>
    <View style={styles.programsHeader}>
      <Text style={styles.programsTitle}>Your Programs</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="View All Programs" accessibilityHint="Navigates to a list of all your programs">
        <Text style={styles.programsLink}>View All Programs</Text>
      </TouchableOpacity>
    </View>
    <ProgramCard
      thumbnail={require('../../assets/icons/workout.png')} // placeholder
      name="Beginner Strength"
      duration="4-week program"
      isActive={true}
    />
  </View>
);

const AccountSection = () => (
  <View style={styles.accountContainer}>
    <Text style={styles.sectionTitle}>Account</Text>
    <AnimatedActionCard icon="card-outline" title="Subscription Details" subtitle="Premium Plan" colors={['#8B7FFF', '#60A5FA']} index={0} />
    <AnimatedActionCard icon="trophy-outline" title="Achievements & Badges" subtitle="View your accomplishments" colors={['#FF9F0A', '#FFD60A']} index={1} />
    <AnimatedActionCard icon="time-outline" title="Workout History" subtitle="Review past workouts" colors={['#32D74B', '#2DD4BF']} index={2} />
    <AnimatedActionCard icon="settings-outline" title="App Settings" subtitle="Customize your experience" colors={['#8E8E93', '#6B7280']} index={3} />
    <AnimatedActionCard icon="help-circle-outline" title="Help & Support" subtitle="Get assistance" colors={['#5856D6', '#5E5CE6']} index={4} />
  </View>
);

export default function ProfileScreen({ onSignOut, onClose, onNavigate }) {
  const navigation = onNavigate ? { navigate: onNavigate } : null;
  const { isDark } = useTheme();
  const [user, setUser] = useState(auth?.currentUser || null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      if (db) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            if (onSignOut) onSignOut();
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[1][0]}` : names[0][0];
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' }}>
        <ActivityIndicator size="large" color="#8B7FFF" />
      </View>
    );
  }

  const displayName = userData?.name || user?.displayName || 'User';
  const joinDate = userData?.createdAt
    ? `Joined ${new Date(userData.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Joined recently';

  const stats = {
    workouts: userData?.totalWorkouts || 0,
    minutes: userData?.totalMinutes || 0,
    streak: userData?.currentStreak || 0,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <CoachConnectHeader 
          title="PROFILE" 
          isDark={isDark}
          onProfilePress={onNavigate ? () => onNavigate('profile') : null}
          onSettingsPress={onNavigate ? () => onNavigate('settings') : null}
        />
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['rgba(40, 35, 60, 0.95)', 'rgba(30, 30, 40, 0.95)']}
          style={styles.profileSection}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient colors={['#8B7FFF', '#FF6B9D']} style={styles.avatarBorder}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{getInitials(displayName)}</Text>
              </View>
            </LinearGradient>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>💪 Premium Member</Text>
            </View>
          </View>
          <Text style={styles.joinDate}>{joinDate}</Text>
        </LinearGradient>

        <StatsRow stats={stats} />

        <View style={styles.actionCardContainer}>
          <AnimatedActionCard icon="flame-outline" title="Streak & Calendar" subtitle="You are on a streak!" colors={['#FF9F0A', '#FF453A']} index={0} />
          <AnimatedActionCard icon="bookmark-outline" title="Saved Workouts" subtitle="Workouts to review" colors={['#60A5FA', '#8B7FFF']} index={1} />
          <AnimatedActionCard icon="gift-outline" title="Refer a Friend" subtitle="Earn US$10 per friend" colors={['#32D74B', '#2DD4BF']} index={2} />
        </View>

        <ProgramsSection />
        <AccountSection />

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} accessibilityRole="button" accessibilityLabel="Sign Out" accessibilityHint="Signs you out of your account">
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
        
        {onNavigate && (
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            paddingTop: 10,
            paddingBottom: 30,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.1)'
          }}>
            <TouchableOpacity onPress={() => { alert('Home clicked!'); onNavigate('home'); }} style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 12 }}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { alert('Workout clicked!'); onNavigate('workout'); }} style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 12 }}>Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { alert('Voice clicked!'); onNavigate('voice'); }} style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 12 }}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { alert('Nutrition clicked!'); onNavigate('nutrition'); }} style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 12 }}>Nutrition</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { alert('Profile clicked!'); onNavigate('profile'); }} style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 12 }}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Add padding to avoid covering BottomNavBar
  },
  profileSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(40, 35, 60, 0.95)',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarBorder: {
    borderRadius: 42,
    padding: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  premiumBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  joinDate: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    height: '50%',
  },
  actionCardContainer: {
    marginHorizontal: 16,
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  programsContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  programsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  programsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  programsLink: {
    fontSize: 14,
    color: '#8B7FFF',
    fontWeight: '600',
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  programThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 16,
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  programDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#32D74B',
    marginRight: 6,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#32D74B',
  },
  accountContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 16,
  },
  signOutButton: {
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 69, 58, 0.8)',
  },
});
