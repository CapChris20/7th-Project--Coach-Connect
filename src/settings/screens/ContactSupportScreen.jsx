/**
 * Contact Support Screen
 *
 * Purpose: UI screen or component: Contact Support Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: ContactSupportScreen
 *
 * @file-header
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Alert, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';
import { getSupportEmail } from '../supportConfig';
import { openSupportMailto, offerSupportMailtoFallback } from '../supportMailto';
import { getApiBase } from '../../shared/api/baseUrl';
import { getAuth } from 'firebase/auth';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS } from '../../navigation/bottomNavMetrics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const PINK = '#FF6B9D';
const PURPLE = '#C084FC';
const CYAN = '#06B6D4';
const ORANGE = '#F97316';
const NUTRITION_GRADIENT = ['#E91E63', '#FF6B9D', '#C084FC'];
const BORDER_PAD = 0.35;

function getCardTokens(isDark) {
  return isDark
    ? {
        bg: '#141419',
        border: 'rgba(255,255,255,0.08)',
        text2: 'rgba(255,255,255,0.92)',
        text3: 'rgba(255,255,255,0.72)',
        inputBg: 'rgba(255,255,255,0.03)',
      }
    : {
        bg: '#FFFFFF',
        border: 'rgba(10,10,15,0.06)',
        text2: 'rgba(10,10,15,0.86)',
        text3: 'rgba(10,10,15,0.68)',
        inputBg: 'rgba(0,0,0,0.01)',
      };
}

function GradientCard({ borderColors, style, innerStyle, children }) {
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      <View style={innerStyle}>{children}</View>
    </LinearGradient>
  );
}

function openSupportMail() {
  openSupportMailto({ subject: 'Coach Connect support' });
}

export default function ContactSupportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const supportEmail = getSupportEmail();
  const t = getCardTokens(isDark);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const checklist = useMemo(
    () => ({
      before: [
        'Fully close the app and open it again.',
        'Check you’re on the account you normally use.',
        'For sign-in issues, try Forgot password first.',
      ],
      include: [
        'What you were trying to do',
        'What happened instead',
        'iPhone or Android (approximate model is fine)',
        'Screenshots if something looks wrong',
      ],
    }),
    []
  );

  async function submit() {
    const s = String(subject || '').trim();
    const m = String(message || '').trim();
    if (!s) {
      Alert.alert('Missing subject', 'Please add a short subject so we can route your message.');
      return;
    }
    if (!m) {
      Alert.alert('Missing message', 'Please describe what you need help with.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken(true);
      const base = getApiBase();
      const res = await fetch(`${base}/api/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject: s, message: m }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.error || 'Failed to send message.');
      }
      setSubject('');
      setMessage('');
      Alert.alert('Sent', 'Thanks — we received your message.');
    } catch (e) {
      offerSupportMailtoFallback({
        subject: s,
        body: m,
        apiError: e?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' },
    scroll: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: embedShellBottomNav ? BOTTOM_NAV_BAR_HEIGHT + 24 : 24 },

    heroOuter: { borderRadius: 16, padding: BORDER_PAD, marginBottom: 16 },
    heroInner: {
      borderRadius: 14,
      padding: 24,
      backgroundColor: t.bg,
      alignItems: 'center',
      borderWidth: 0,
    },
    heroIconOuter: { width: 64, height: 64, borderRadius: 32, padding: BORDER_PAD, marginBottom: 14 },
    heroIconInner: {
      flex: 1,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 0,
    },
    heroTitle: { fontSize: 32, fontWeight: '900', color: isDark ? '#FFFFFF' : '#1A1A2E', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
    heroSub: { fontSize: 15, fontWeight: '600', color: t.text2, textAlign: 'center', lineHeight: 21 },

    intro: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22, marginBottom: 16 },

    sectionHeaderRow: { marginTop: 8, marginBottom: 12 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.text3,
    },
    sectionUnderline: { width: 22, height: 1.5, backgroundColor: '#FF6B9D', marginTop: 8, borderRadius: 999 },

    cardOuter: { borderRadius: 14, padding: BORDER_PAD, marginBottom: 12 },
    cardInner: { borderRadius: 12, padding: 16, backgroundColor: t.bg, borderWidth: 0 },
    cardTitle: { fontSize: 16, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 8, letterSpacing: -0.2 },
    body: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22 },
    bullet: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22, marginBottom: 8 },
    label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', color: t.text3, marginTop: 14, marginBottom: 8 },

    formTitle: { fontSize: 17, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 6, letterSpacing: -0.2 },
    formSub: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 21 },
    input: {
      height: 48,
      borderWidth: 0.5,
      borderColor: 'rgba(255,107,157,0.20)',
      borderRadius: 10,
      paddingHorizontal: 14,
      color: isDark ? '#FFFFFF' : '#0A0A0F',
      backgroundColor: t.inputBg,
      marginTop: 10,
    },
    inputMultiline: { minHeight: 120, height: undefined, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
    helper: { fontSize: 12, fontWeight: '600', color: t.text3, marginTop: 10, lineHeight: 17 },

    buttonWrap: { marginTop: 14 },
    button: { borderRadius: 999, overflow: 'hidden' },
    buttonInner: { height: 48, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },

    footer: {
      marginTop: 12,
      padding: 16,
      backgroundColor: t.bg,
      borderColor: t.border,
      borderWidth: 0,
      borderRadius: 12,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: t.text2, lineHeight: 20 },
  });

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <CoachConnectHeader title="Contact support" skipTopSafeInset onBack={onClose} />

      <ScrollView style={styles.scroll} {...FORM_SCROLL_PROPS}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.heroOuter} innerStyle={styles.heroInner}>
            <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.heroIconOuter} innerStyle={styles.heroIconInner}>
              <Ionicons name="headset-outline" size={34} color="#FFFFFF" />
            </GradientCard>
            <Text style={styles.heroTitle}>Contact Support</Text>
            <Text style={styles.heroSub}>We’re here to help.</Text>
          </GradientCard>

          <Text style={styles.intro}>
            We’re glad you’re here. Tell us what’s going on and we’ll work through it with you.
          </Text>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Using the app</Text>
            <View style={styles.sectionUnderline} />
          </View>

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>What we can help with</Text>
            <Text style={styles.bullet}>- Signing in, password reset, or account deletion</Text>
            <Text style={styles.bullet}>- Workout planner, exercise library, active workouts, or history</Text>
            <Text style={styles.bullet}>- Nutrition logging, barcode search, or home dashboard numbers</Text>
            <Text style={styles.bullet}>- Messages, trainer requests, files your coach shared</Text>
            <Text style={styles.bullet}>- AI Coach (limits, scope, or turning AI off in Settings)</Text>
            <Text style={[styles.bullet, { marginBottom: 0 }]}>- Privacy questions or requests about your data</Text>
          </GradientCard>

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>Before you email</Text>
            {checklist.before.map((t) => (
              <Text key={t} style={styles.bullet}>- {t}</Text>
            ))}
          </GradientCard>

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>In your email, please include</Text>
            {checklist.include.map((t) => (
              <Text key={t} style={styles.bullet}>- {t}</Text>
            ))}
          </GradientCard>

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>What we can’t do</Text>
            <Text style={styles.body}>We can’t diagnose conditions, prescribe treatment, or replace your doctor or dietitian.</Text>
          </GradientCard>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Email us</Text>
            <View style={styles.sectionUnderline} />
          </View>

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.formTitle}>Email us</Text>
            <Text style={styles.formSub}>
              Send a message right here. If delivery fails, you can still email us.
            </Text>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject (required)"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={styles.input}
              autoCapitalize="sentences"
              editable={!submitting}
              returnKeyType="next"
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Message (required)"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />
            <Text style={styles.helper}>
              Tip: include what you tapped, what you expected, and what happened instead.
            </Text>

            <View style={styles.buttonWrap}>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.98 }] }]}
                onPress={submit}
                disabled={submitting}
              >
                <LinearGradient colors={NUTRITION_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonInner}>
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.buttonText}>Sending…</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Send message</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            {supportEmail ? (
              <>
                <Text style={[styles.body, { marginTop: 12 }]}>Email: {supportEmail}</Text>
                <Pressable onPress={openSupportMail}>
                  <Text style={[styles.helper, { marginTop: 8 }]}>Or email instead</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.helper}>No support email is configured for this build.</Text>
            )}
          </GradientCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {supportEmail
                ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
                : 'We can’t give medical advice; for health emergencies, contact local emergency services.'}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
