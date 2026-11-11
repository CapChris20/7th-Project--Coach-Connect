// Notes to trainer: one text box that saves today's note for the coach to read.
// Flow: load today's saved note through useCardState → show it with an Edit button → typing and Save writes it and tells the trainer.
// Used by NewHomeLayout as the last section.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbButton } from '../../../look-and-feel/nb/NbButton';
import { NbField } from '../../../look-and-feel/nb/NbField';
import { NbPill } from '../../../look-and-feel/nb/NbAccentPieces';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { NB_RADIUS, NB_SPACING, getNbAccent, getNbColors } from '../../../look-and-feel/nb/nbTokens';
import { useCardState } from '../dashboardCardState';

// ===== NAMED CONSTANTS =====

const NOTES_STORAGE_KEY = 'dashboard_notes';
const NOTIFIED_ACCENT_POSITION = 7;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @returns {JSX.Element}
 */
export function NewHomeNotes() {
  // 1. Colors, today's saved note, and the draft being typed.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const { savedValue, showNotified, save } = useCardState(NOTES_STORAGE_KEY);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  // 2. Start editing with the saved text; save only when something is written.
  const startEditing = () => {
    setDraftText(savedValue || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!draftText.trim()) return;
    save(draftText);
    setIsEditing(false);
  };

  // 3. Saved note with Edit, or the writing box with Save.
  const showWriter = isEditing || !savedValue;
  return (
    <NbSurface radius={NB_RADIUS.sheet} innerStyle={styles.cardInner}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={[styles.title, { color: colors.ink }]}>Note to your trainer</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Only your coach reads this.</Text>
        </View>
        {showNotified ? <NbPill label="Trainer notified" accent={getNbAccent(NOTIFIED_ACCENT_POSITION)} /> : null}
      </View>

      {showWriter ? (
        <>
          <NbField
            label="How did you feel today?"
            multiline
            placeholder="Any pain or wins?"
            value={draftText}
            onChangeText={setDraftText}
          />
          <NbButton label="Save note" onPress={handleSave} isDisabled={!draftText.trim()} />
        </>
      ) : (
        <>
          <Text style={[styles.savedNote, { color: colors.ink }]}>{savedValue}</Text>
          <NbButton label="Edit note" variant="plain" onPress={startEditing} />
        </>
      )}
    </NbSurface>
  );
}

export default NewHomeNotes;

const styles = StyleSheet.create({
  cardInner: { padding: NB_SPACING.large, gap: NB_SPACING.large },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: NB_SPACING.medium },
  titleText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  savedNote: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
});
