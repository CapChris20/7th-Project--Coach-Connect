import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../services/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getOrCreateConversation } from '../../services/firebase/trainerMessaging';
import { auth } from '../../services/firebase/config';

export default function TrainerSearchScreen({ onSelectTrainer, onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'name', 'specialization', 'location'
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(null);

  // Fetch trainers from Firestore
  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        console.log('🔍 Fetching trainers...');
        setLoading(true);
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'trainer'));
        const querySnapshot = await getDocs(q);
        
        const trainersList = [];
        querySnapshot.forEach((doc) => {
          trainersList.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by name
        trainersList.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
        console.log('✅ Found', trainersList.length, 'trainers');
        setTrainers(trainersList);
        setFilteredTrainers(trainersList);
      } catch (error) {
        console.error('❌ Error fetching trainers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainers();
  }, []);

  // Filter trainers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTrainers(trainers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = trainers.filter((trainer) => {
      const name = (trainer.name || '').toLowerCase();
      const specializations = (trainer.specializations || []).join(' ').toLowerCase();
      const location = (trainer.location || '').toLowerCase();
      const bio = (trainer.bio || '').toLowerCase();

      switch (filter) {
        case 'name':
          return name.includes(query);
        case 'specialization':
          return specializations.includes(query);
        case 'location':
          return location.includes(query);
        default:
          return (
            name.includes(query) ||
            specializations.includes(query) ||
            location.includes(query) ||
            bio.includes(query)
          );
      }
    });

    setFilteredTrainers(filtered);
  }, [searchQuery, filter, trainers]);

  const handleMessageTrainer = async (trainer) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ No authenticated user');
        return;
      }

      setMessaging(trainer.id);
      console.log('💬 Starting conversation with trainer:', trainer.id);
      
      // Create or get conversation
      const conversationId = await getOrCreateConversation(currentUser.uid, trainer.id);
      console.log('✅ Conversation ID:', conversationId);
      
      // Call the callback to open messaging screen
      if (onSelectTrainer) {
        onSelectTrainer(trainer, conversationId);
      }
    } catch (error) {
      console.error('❌ Error starting conversation:', error);
    } finally {
      setMessaging(null);
    }
  };

  const renderTrainerCard = ({ item: trainer }) => {
    const initials = (trainer.name || 'T')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View
        style={[
          styles.trainerCard,
          { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' },
        ]}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Trainer Info */}
        <View style={styles.trainerInfo}>
          <Text style={styles.trainerName}>{trainer.name || 'Trainer'}</Text>
          {trainer.credentials && (
            <Text style={styles.credentials}>{trainer.credentials}</Text>
          )}

          {/* Specializations */}
          {trainer.specializations && trainer.specializations.length > 0 && (
            <View style={styles.specializationsContainer}>
              {trainer.specializations.slice(0, 3).map((spec, index) => (
                <View key={index} style={styles.specializationTag}>
                  <Text style={styles.specializationText}>{spec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bio */}
          {trainer.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {trainer.bio}
            </Text>
          )}

          {/* Location */}
          {trainer.location && (
            <Text style={styles.location}>📍 {trainer.location}</Text>
          )}
        </View>

        {/* Message Button */}
        <TouchableOpacity
          style={[
            styles.messageButton,
            messaging === trainer.id && { opacity: 0.6 },
          ]}
          onPress={() => handleMessageTrainer(trainer)}
          disabled={messaging === trainer.id}
        >
          {messaging === trainer.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.messageButtonText}>Message</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    header: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: isDark
        ? 'rgba(139, 92, 246, 0.2)'
        : 'rgba(139, 92, 246, 0.15)',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.md,
    },
    searchContainer: {
      marginBottom: spacing.md,
    },
    searchInput: {
      backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(139, 92, 246, 0.3)'
        : 'rgba(139, 92, 246, 0.2)',
    },
    filterContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    filterButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(139, 92, 246, 0.3)'
        : 'rgba(139, 92, 246, 0.2)',
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    filterButtonTextActive: {
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    trainerCard: {
      flexDirection: 'row',
      padding: spacing.md,
      borderRadius: 16,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(139, 92, 246, 0.2)'
        : 'rgba(139, 92, 246, 0.15)',
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    trainerInfo: {
      flex: 1,
    },
    trainerName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    credentials: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    specializationsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    specializationTag: {
      backgroundColor: isDark
        ? 'rgba(139, 92, 246, 0.2)'
        : 'rgba(139, 92, 246, 0.15)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
    },
    specializationText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
    },
    bio: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      lineHeight: 18,
    },
    location: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    messageButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
    },
    messageButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyStateText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Trainers</Text>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainers..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <View style={styles.filterContainer}>
            {['all', 'name', 'specialization', 'location'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterButton,
                  filter === f && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === f && styles.filterButtonTextActive,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredTrainers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery
              ? 'No trainers found matching your search'
              : 'No trainers available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrainers}
          renderItem={renderTrainerCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

