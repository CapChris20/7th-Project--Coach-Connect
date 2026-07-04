/**
 * Bug Report Screen
 *
 * Purpose: UI screen or component: Bug Report Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: BugReportScreen
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
const ORANGE = '#F97316';
const BORDER_PAD = 0.6;

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

function openBugMail() {
  const body =
    'What I was doing:\n\n' +
    'What went wrong:\n\n' +
    'Device (iPhone / Android):\n\n' +
    'Rough date/time:\n\n';
  openSupportMailto({ subject: 'Bug report — Coach Connect', body });
}

export default function BugReportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const supportEmail = getSupportEmail();
  const t = getCardTokens(isDark);
  const [whatExpected, setWhatExpected] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [steps, setSteps] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const includeList = useMemo(
    () => [
      '1. What you expected',
      '2. What you got',
      '3. Steps: “I opened… then I tapped…”',
      '4. How often: once or every time',
      '5. Device: iPhone or Android',
    ],
    []
  );

  const templateList = useMemo(
    () => [
      'What I was doing:',
      'What went wrong:',
      'Device (iPhone / Android):',
      'Rough date/time:',
    ],
    []
  );

  async function submitBug() {
    const exp = String(whatExpected || '').trim();
    const hap = String(whatHappened || '').trim();
    const st = String(steps || '').trim();
    if (!exp || !hap) {
      Alert.alert('Missing details', 'Please fill in what you expected and what happened.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    setSubmitting(true);
    const subject = 'Bug report — Coach Connect';
    const message =
      `What I expected:\n${exp}\n\n` +
      `What happened:\n${hap}\n\n` +
      (st ? `Steps:\n${st}\n\n` : '') +
      (deviceInfo ? `Device:\n${deviceInfo}\n\n` : '');

    try {
      const token = await user.getIdToken(true);
      const base = getApiBase();

      const res = await fetch(`${base}/api/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.error || 'Failed to send bug report.');
      }
      setWhatExpected('');
      setWhatHappened('');
      setSteps('');
      setDeviceInfo('');
      Alert.alert('Sent', 'Thanks — your bug report was sent.');
    } catch (e) {
      offerSupportMailtoFallback({ subject, body: message, apiError: e?.message });
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
      borderWidth: 0.5,
      borderColor: t.border,
    },
    heroIconOuter: { width: 64, height: 64, borderRadius: 32, padding: BORDER_PAD, marginBottom: 14 },
    heroIconInner: {
      flex: 1,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    heroTitle: { fontSize: 32, fontWeight: '900', color: isDark ? '#FFFFFF' : '#1A1A2E', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
    heroSub: { fontSize: 15, fontWeight: '600', color: t.text2, textAlign: 'center', lineHeight: 21 },
    intro: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22, marginTop: 14, marginBottom: 16 },

    sectionHeaderRow: { marginTop: 8, marginBottom: 12 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.text3,
    },
    sectionUnderline: { width: 22, height: 1.5, backgroundColor: ORANGE, marginTop: 8, borderRadius: 999 },

    cardOuter: { borderRadius: 14, padding: BORDER_PAD, marginBottom: 12 },
    cardInner: { borderRadius: 12, padding: 16, backgroundColor: t.bg, borderWidth: 0.5, borderColor: t.border },
    cardTitle: { fontSize: 16, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 8, letterSpacing: -0.2 },
    body: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22 },
    bullet: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22, marginBottom: 8 },

    formTitle: { fontSize: 17, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 6, letterSpacing: -0.2 },
    formSub: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 21 },
    label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', color: t.text3, marginTop: 14, marginBottom: 8 },
    input: {
      height: 48,
      borderWidth: 0.5,
      borderColor: 'rgba(249,115,22,0.20)',
      borderRadius: 10,
      paddingHorizontal: 14,
      color: isDark ? '#FFFFFF' : '#0A0A0F',
      backgroundColor: t.inputBg,
      marginTop: 10,
    },
    inputMultiline: { minHeight: 110, height: undefined, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
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
      borderWidth: 0.5,
      borderRadius: 12,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: t.text2, lineHeight: 20 },
  });

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <CoachConnectHeader title="Report a bug" skipTopSafeInset onBack={onClose} />

      <ScrollView style={styles.scroll} {...FORM_SCROLL_PROPS}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <GradientCard borderColors={[ORANGE, PINK]} style={styles.heroOuter} innerStyle={styles.heroInner}>
            <GradientCard borderColors={[ORANGE, PINK]} style={styles.heroIconOuter} innerStyle={styles.heroIconInner}>
              <Ionicons name="bug-outline" size={34} color="#FFFFFF" />
            </GradientCard>
            <Text style={styles.heroTitle}>Report a Bug</Text>
            <Text style={styles.heroSub}>Help us make it better.</Text>
          </GradientCard>

          <Text style={styles.intro}>
            If something broke or feels wrong, we want to know. Your report helps everyone.
          </Text>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Report details</Text>
            <View style={styles.sectionUnderline} />
          </View>

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>What counts as a bug</Text>
            <Text style={styles.body}>
              Buttons that don’t respond, screens that won’t load, data that disappears, videos that never play, or anything
              that used to work and suddenly doesn’t.
            </Text>
          </GradientCard>

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>Please include</Text>
            {includeList.map((t) => (
              <Text key={t} style={styles.bullet}>- {t.replace(/^\d+\.\s*/, '')}</Text>
            ))}
          </GradientCard>

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>Don’t send</Text>
            <Text style={styles.body}>
              Passwords, full card numbers, or private health details you don’t want stored in email.
            </Text>
          </GradientCard>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Send a bug report</Text>
            <View style={styles.sectionUnderline} />
          </View>

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.formTitle}>Send a bug report</Text>
            <Text style={styles.formSub}>Tell us what you expected, what happened, and steps if you can.</Text>

            <Text style={styles.label}>What you expected</Text>
            <TextInput
              value={whatExpected}
              onChangeText={setWhatExpected}
              placeholder="Example: “I expected the workout to save.”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>What happened instead</Text>
            <TextInput
              value={whatHappened}
              onChangeText={setWhatHappened}
              placeholder="Example: “It froze and kicked me out.”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Steps (optional)</Text>
            <TextInput
              value={steps}
              onChangeText={setSteps}
              placeholder="Example: “Open Training → Planner → Generate…”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Device (optional)</Text>
            <TextInput
              value={deviceInfo}
              onChangeText={setDeviceInfo}
              placeholder="Example: “iPhone 14, iOS 18”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.helper}>Don’t include passwords or payment details.</Text>

            <View style={styles.buttonWrap}>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.98 }] }]}
                onPress={submitBug}
                disabled={submitting}
              >
                <LinearGradient colors={[ORANGE, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonInner}>
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.buttonText}>Sending…</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Send bug report</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            {supportEmail ? (
              <Pressable onPress={openBugMail}>
                <Text style={[styles.helper, { marginTop: 10 }]}>Or email instead</Text>
              </Pressable>
            ) : null}
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
