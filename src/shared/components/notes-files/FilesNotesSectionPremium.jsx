/**
 * Files Notes Section Premium
 *
 * Purpose: UI screen or component: Files Notes Section Premium. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: FilesNotesSectionPremium
 *
 * @file-header
 */
import React, { useMemo } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateShort, formatFileSize, getFileTypeFromItem } from '../../utils/formatFileSize';

/** Coach / docs — dark cyan → dark gold */
const GRAD_COACH = ['#0891B2', '#B45309'];
/** My files / images — dark pink → dark orange */
const GRAD_MY = ['#DB2777', '#C2410C'];

const HERO_BORDER = [...GRAD_COACH, ...GRAD_MY];
const UPLOAD_GRADIENT = GRAD_MY;

const FILE_TYPE_META = {
  pdf:         { label: 'PDF',    icon: 'file-text',  gradient: GRAD_COACH },
  video:       { label: 'VIDEO',  icon: 'play-circle', gradient: GRAD_COACH },
  document:    { label: 'DOC',    icon: 'file-text',  gradient: GRAD_COACH },
  spreadsheet: { label: 'SHEET',  icon: 'grid',       gradient: GRAD_COACH },
  image:       { label: 'IMAGE',  icon: 'image',      gradient: GRAD_MY },
  file:        { label: 'FILE',   icon: 'file',       gradient: GRAD_COACH },
};

const CARD_GRADIENT_COACH = ['rgba(8,145,178,0.20)', 'rgba(180,83,9,0.12)', 'rgba(10,10,15,0.95)'];
const CARD_GRADIENT_MY    = ['rgba(219,39,119,0.22)', 'rgba(194,65,12,0.14)', 'rgba(10,10,15,0.95)'];
const CARD_GRADIENT_COACH_LIGHT = ['rgba(8,145,178,0.12)', 'rgba(180,83,9,0.08)', 'rgba(248,249,252,0.95)'];
const CARD_GRADIENT_MY_LIGHT    = ['rgba(219,39,119,0.12)', 'rgba(194,65,12,0.08)', 'rgba(248,249,252,0.95)'];

function GradientPill({ colors, style, children }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={style}>
      {children}
    </LinearGradient>
  );
}

/**
 * Premium files grid — client home Notes & Files workspace and trainer client workspace.
 * @param {'client'|'trainer'} audience
 */
export default function FilesNotesSectionPremium({
  items = [],
  trainerDocuments = [],
  audience = 'client',
  clientName = '',
  isDark = true,
  onOpenItem,
  onDownloadItem,
  onShareItem,
  onDeleteItem,
  onMarkRead,
  onUploadPress,
  uploadLabel = 'Add note or file',
}) {
  const th = isDark
    ? { bg: '#0A0A0F', card: '#141419', text: '#FFF', text70: 'rgba(255,255,255,0.7)', text50: 'rgba(255,255,255,0.5)', text30: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' }
    : { bg: '#F7F7FA', card: '#FFFFFF', text: '#1A1A2E', text70: 'rgba(0,0,0,0.65)', text50: 'rgba(0,0,0,0.45)', text30: 'rgba(0,0,0,0.25)', border: 'rgba(0,0,0,0.06)' };

  const isTrainer = audience === 'trainer';

  const {
    coachFiles,
    myFiles,
    notes,
    yourDocuments,
  } = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    if (isTrainer) {
      const fromClient = list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note');
      const fromYou = list.filter((x) => x?.addedBy === 'trainer' && x?.type !== 'note');
      const allNotes = list.filter((x) => x?.type === 'note');
      const docs = (Array.isArray(trainerDocuments) ? trainerDocuments : []).map((doc) => {
        const isShared = Array.isArray(doc.sharedWith) && doc.sharedWith.length > 0;
        const title = doc.title || 'Untitled';
        return {
          id: doc.id,
          type: 'document',
          name: isShared ? `${title} · Shared` : title,
          title,
          createdAt: doc.updatedAt || doc.createdAt,
          addedBy: 'trainer',
          documentId: doc.id,
        };
      });
      return {
        coachFiles: fromYou,
        myFiles: fromClient,
        notes: allNotes,
        yourDocuments: docs,
      };
    }
    const coach = list.filter((x) => (x?.addedBy === 'trainer' || (x?.type === 'document' && x?.trainerId)) && x?.type !== 'note');
    const mine = list.filter((x) => (x?.addedBy || 'client') === 'client' && x?.type !== 'note');
    const n = list.filter((x) => x?.type === 'note' && x?.addedBy === 'trainer');
    return { coachFiles: coach, myFiles: mine, notes: n, yourDocuments: [] };
  }, [items, isTrainer, trainerDocuments]);

  const heroCopy = isTrainer
    ? {
        title: 'Files & Notes',
        kicker: 'CLIENT WORKSPACE',
        brand: clientName ? String(clientName).trim() : 'Your client',
        tagline: 'EVERYTHING SHARED IN THIS LIBRARY',
      }
    : {
        title: 'Files & Notes',
        kicker: 'WELCOME TO',
        brand: 'Coach Connect',
        tagline: 'EVERYTHING SHARED WITH YOUR COACH',
      };

  const labels = isTrainer
    ? {
        coachSection: 'FROM YOU',
        mySection: 'FROM CLIENT',
        notesSection: 'NOTES',
        docsSection: 'YOUR DOCUMENTS',
        myEmpty: 'No client uploads yet',
        coachEmpty: 'Nothing from you yet — add a note or file below',
      }
    : {
        coachSection: 'FROM YOUR COACH',
        mySection: 'MY FILES',
        notesSection: 'COACHING NOTES',
        docsSection: null,
        myEmpty: 'No files yet — tap + Add file below',
        coachEmpty: null,
      };

  const getFileMeta = (file) => {
    const fType = getFileTypeFromItem(file);
    const meta = FILE_TYPE_META[fType] || FILE_TYPE_META.file;
    const name = file?.name || file?.title || 'File';
    const createdAt = file?.createdAt?.toDate?.() || file?.createdAt;
    const when = createdAt ? formatDateShort(createdAt) : '';
    const size = file?.size ? formatFileSize(file.size) : '';
    const datePart = when ? when.replace(/,?\s*\d{4}$/, '').toUpperCase() : '';
    return { ...meta, name, when: datePart, size, fType };
  };

  const canDeleteFile = (file) => {
    if (!onDeleteItem || !file) return false;
    if (isTrainer) return file?.addedBy === 'trainer';
    return file?.addedBy !== 'trainer';
  };

  const FileCard = ({ file, variant = 'coach' }) => {
    const { label, icon, gradient, name, when, size, fType } = getFileMeta(file);
    const accentGrad = variant === 'coach' ? GRAD_COACH : GRAD_MY;
    const badgeGrad = gradient || accentGrad;
    const accent = badgeGrad[0];
    const cardGrad = variant === 'coach'
      ? (isDark ? CARD_GRADIENT_COACH : CARD_GRADIENT_COACH_LIGHT)
      : (isDark ? CARD_GRADIENT_MY : CARD_GRADIENT_MY_LIGHT);
    const borderCol = variant === 'coach'
      ? (isDark ? 'rgba(8,145,178,0.28)' : 'rgba(8,145,178,0.18)')
      : (isDark ? 'rgba(219,39,119,0.28)' : 'rgba(219,39,119,0.18)');

    return (
      <TouchableOpacity
        style={[s.fileCard, { borderColor: borderCol }]}
        activeOpacity={0.88}
        onPress={async () => { try { await onMarkRead?.(file); } catch (_e) {} onOpenItem?.(file); }}
        onLongPress={() => {
          const actions = [
            { text: 'Open', onPress: () => onOpenItem?.(file) },
            { text: 'Download', onPress: () => onDownloadItem?.(file) },
            { text: 'Share', onPress: () => onShareItem?.(file) },
          ];
          if (canDeleteFile(file)) {
            actions.push({ text: 'Delete', style: 'destructive', onPress: () => onDeleteItem?.(file) });
          }
          actions.push({ text: 'Cancel', style: 'cancel' });
          Alert.alert(name, '', actions);
        }}
        delayLongPress={380}
      >
        {fType === 'image' && (file?.thumbnailUrl || file?.url) ? (
          <View style={s.fileCardGradient}>
            <Image source={{ uri: file.thumbnailUrl || file.url }} style={s.fileCardThumb} resizeMode="cover" />
            <GradientPill colors={badgeGrad} style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{label}</Text>
            </GradientPill>
            <TouchableOpacity
              style={[s.dlBtn, { borderColor: 'rgba(255,255,255,0.4)' }]}
              onPress={() => onDownloadItem?.(file)}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Feather name="download" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <LinearGradient colors={cardGrad} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.fileCardGradient}>
            <GradientPill colors={badgeGrad} style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{label}</Text>
            </GradientPill>
            <View style={s.fileCardIconWrap}>
              <Feather name={icon} size={40} color={accent} />
            </View>
            <TouchableOpacity
              style={[s.dlBtn, { borderColor: `${accent}55` }]}
              onPress={() => onDownloadItem?.(file)}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Feather name="download" size={18} color={accent} />
            </TouchableOpacity>
          </LinearGradient>
        )}
        <View style={s.fileCardInfo}>
          <Text style={[s.fileCardName, { color: th.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[s.fileCardMeta, { color: th.text50 }]} numberOfLines={1}>
            {when}{size ? ` \u00B7 ${size}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const SectionHead = ({ title, count, gradient }) => (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { color: th.text }]}>{title}</Text>
      {count != null && count > 0 && (
        <GradientPill colors={gradient} style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </GradientPill>
      )}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.sectionLine}
      />
    </View>
  );

  const NoteCard = ({ note }) => {
    const preview = String(note?.content || note?.preview || '').trim();
    const createdAt = note?.createdAt?.toDate?.() || note?.createdAt;
    const when = createdAt ? formatDateShort(createdAt) : null;
    const dateStr = when ? when.toUpperCase() : '';
    const noteTitle = isTrainer
      ? (note?.addedBy === 'trainer' ? 'Your note' : 'Client note')
      : 'Coaching Note';

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={async () => {
          try { await onMarkRead?.(note); } catch (_e) {}
          Alert.alert(noteTitle, preview || '\u2014');
        }}
        style={[s.noteCard, { backgroundColor: isDark ? '#0f1018' : '#FFFFFF', borderColor: isDark ? 'rgba(8,145,178,0.18)' : 'rgba(8,145,178,0.12)' }]}
      >
        <LinearGradient colors={GRAD_COACH} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.noteAccent} />
        <View style={s.noteContent}>
          {dateStr ? <Text style={s.noteDate}>{dateStr}</Text> : null}
          <Text style={[s.noteText, { color: th.text70 }]} numberOfLines={4}>{preview || '\u2014'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyCard = ({ message, gradient = GRAD_MY }) => (
    <View style={[s.emptyCard, { borderColor: isDark ? 'rgba(219,39,119,0.15)' : 'rgba(219,39,119,0.10)' }]}>
      <Feather name="upload-cloud" size={28} color={gradient[0]} />
      <Text style={[s.emptyText, { color: th.text50 }]}>{message}</Text>
    </View>
  );

  const renderGrid = (files, variant) => (
    <View style={s.grid}>
      {files.map((f) => (
        <FileCard key={f.id || f.url || f.name} file={f} variant={variant} />
      ))}
    </View>
  );

  const hasAnyContent =
    coachFiles.length > 0 ||
    myFiles.length > 0 ||
    notes.length > 0 ||
    yourDocuments.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.heroOuter}>
        <LinearGradient colors={HERO_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroBorderRing}>
          <View style={[s.heroInner, { backgroundColor: isDark ? '#0A0A0F' : '#F0F0F8' }]}>
            <Text style={[s.heroTitle, { color: th.text }]}>{heroCopy.title}</Text>
            <LinearGradient colors={GRAD_COACH} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroRule} />
            <Text style={[s.heroKicker, { color: th.text50 }]}>{heroCopy.kicker}</Text>
            <Text style={s.heroBrand}>{heroCopy.brand}</Text>
            <Text style={[s.heroTagline, { color: th.text30 }]}>{heroCopy.tagline}</Text>
          </View>
        </LinearGradient>
      </View>

      {!hasAnyContent && isTrainer ? (
        <View style={s.sectionWrap}>
          <EmptyCard message="No notes or files yet — add something for your client below" gradient={GRAD_COACH} />
        </View>
      ) : null}

      {isTrainer ? (
        <View style={s.sectionWrap}>
          <SectionHead title={labels.mySection} count={myFiles.length} gradient={GRAD_MY} />
          {myFiles.length > 0 ? renderGrid(myFiles, 'my') : (
            <EmptyCard message={labels.myEmpty} gradient={GRAD_MY} />
          )}
        </View>
      ) : coachFiles.length > 0 ? (
        <View style={s.sectionWrap}>
          <SectionHead title={labels.coachSection} count={coachFiles.length} gradient={GRAD_COACH} />
          {renderGrid(coachFiles, 'coach')}
        </View>
      ) : null}

      <View style={s.sectionWrap}>
        <SectionHead
          title={isTrainer ? labels.coachSection : labels.mySection}
          count={isTrainer ? coachFiles.length : myFiles.length}
          gradient={isTrainer ? GRAD_COACH : GRAD_MY}
        />
        {(isTrainer ? coachFiles : myFiles).length > 0 ? (
          renderGrid(isTrainer ? coachFiles : myFiles, isTrainer ? 'coach' : 'my')
        ) : (
          <EmptyCard message={isTrainer ? labels.coachEmpty : labels.myEmpty} gradient={isTrainer ? GRAD_COACH : GRAD_MY} />
        )}
      </View>

      {yourDocuments.length > 0 ? (
        <View style={s.sectionWrap}>
          <SectionHead title={labels.docsSection} count={yourDocuments.length} gradient={GRAD_COACH} />
          {renderGrid(yourDocuments, 'coach')}
        </View>
      ) : null}

      {notes.length > 0 ? (
        <View style={s.sectionWrap}>
          <SectionHead title={labels.notesSection} count={notes.length} gradient={GRAD_COACH} />
          <View style={{ gap: 12, paddingHorizontal: 16 }}>
            {notes.map((n) => (
              <NoteCard key={n.id || String(n.createdAt)} note={n} />
            ))}
          </View>
        </View>
      ) : null}

      {onUploadPress ? (
        <View style={s.uploadWrap}>
          <TouchableOpacity onPress={onUploadPress} activeOpacity={0.88}>
            <LinearGradient colors={UPLOAD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.uploadBtn}>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={s.uploadText}>{uploadLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  heroOuter: { paddingHorizontal: 16, marginTop: 8, marginBottom: 20 },
  heroBorderRing: { borderRadius: 22, padding: 2 },
  heroInner: {
    borderRadius: 20, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  heroRule: { width: 36, height: 3, borderRadius: 2, marginVertical: 12 },
  heroKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  heroBrand: { fontSize: 30, fontWeight: '900', color: GRAD_MY[0], letterSpacing: -0.5, marginBottom: 8 },
  heroTagline: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase' },

  sectionWrap: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.6 },
  sectionBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  sectionLine: { flex: 1, height: 2, borderRadius: 1, marginLeft: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },

  fileCard: {
    width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  fileCardGradient: { height: 160, padding: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fileCardThumb: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  typeBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  fileCardIconWrap: { alignItems: 'center', justifyContent: 'center' },
  dlBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  fileCardInfo: { padding: 12, paddingTop: 10 },
  fileCardName: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  fileCardMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  noteCard: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  noteAccent: { width: 4 },
  noteContent: { flex: 1, padding: 16 },
  noteDate: { fontSize: 12, fontWeight: '800', color: GRAD_MY[0], letterSpacing: 0.5, marginBottom: 8 },
  noteText: { fontSize: 14, fontWeight: '600', lineHeight: 22 },

  emptyCard: {
    marginHorizontal: 16, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18,
    paddingVertical: 32, alignItems: 'center', gap: 10,
  },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 12 },

  uploadWrap: { paddingHorizontal: 16, paddingBottom: 24, marginTop: 4 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: GRAD_MY[0], shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  uploadText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
