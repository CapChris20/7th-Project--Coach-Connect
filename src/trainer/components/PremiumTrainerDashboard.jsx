import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../app/config';

export default function PremiumTrainerDashboard({ 
  trainerId,
  onMessage, 
  onCall, 
  onSchedule, 
  onProgress, 
  onViewReports,
  onClientSelect,
  onNewClient,
  clients: propClients,
}) {
  const { colors, spacing, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');

  // Load clients from database
  useEffect(() => {
    const loadClients = async () => {
      if (!trainerId) return;
      
      try {
        const clientsRef = collection(db, 'trainer_clients', trainerId, 'clients');
        const q = query(clientsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const clientList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setClients(clientList);
        
        if (!selectedClient && clientList.length > 0) {
          setSelectedClient(clientList[0]);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, [trainerId]);

  // Update clients if prop changes
  useEffect(() => {
    if (propClients) {
      setClients(propClients);
      if (!selectedClient && propClients.length > 0) {
        setSelectedClient(propClients[0]);
      }
    }
  }, [propClients]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    setShowClientDropdown(false);
    if (onClientSelect) {
      onClientSelect(client);
    }
  };

  const renderClientDropdown = () => {
    if (!showClientDropdown) return null;

    return (
      <View style={[styles.dropdown, { backgroundColor: isDark ? '#1E1B2E' : '#FFFFFF' }]}>
        <ScrollView style={{ maxHeight: 200 }}>
          {clients.map(client => (
            <TouchableOpacity
              key={client.id}
              style={[
                styles.dropdownItem,
                { borderBottomColor: colors.border }
              ]}
              onPress={() => handleClientSelect(client)}
            >
              <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                {client.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'progress':
        return (
          <View style={styles.tabContent}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Progress Tracking</Text>
            <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
              Monitor client progress and achievements
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={onProgress}
            >
              <Text style={styles.actionButtonText}>View Progress</Text>
            </TouchableOpacity>
          </View>
        );
      case 'nutrition':
        return (
          <View style={styles.tabContent}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Nutrition Plans</Text>
            <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
              Create and manage nutrition programs
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {}}
            >
              <Text style={styles.actionButtonText}>Manage Nutrition</Text>
            </TouchableOpacity>
          </View>
        );
      case 'requests':
        return (
          <View style={styles.tabContent}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Client Requests</Text>
            <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
              Review and respond to client inquiries
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {}}
            >
              <Text style={styles.actionButtonText}>View Requests</Text>
            </TouchableOpacity>
          </View>
        );
      case 'calendar':
        return (
          <View style={styles.tabContent}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Schedule</Text>
            <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
              Manage appointments and sessions
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={onSchedule}
            >
              <Text style={styles.actionButtonText}>View Calendar</Text>
            </TouchableOpacity>
          </View>
        );
      case 'files':
        return (
          <View style={styles.tabContent}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Documents</Text>
            <Text style={[styles.tabSubtitle, { color: colors.textSecondary }]}>
              Share files and resources with clients
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={onViewReports}
            >
              <Text style={styles.actionButtonText}>View Files</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.greetingSection}>
            <Text style={[styles.greetingText, { color: colors.text }]}>
              {getGreeting()}, Coach! 👋
            </Text>
            <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
              Welcome back to your dashboard
            </Text>
          </View>
        </View>

        {/* Client Card */}
        <View style={[styles.clientCard, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}>
          <TouchableOpacity onPress={() => setShowClientDropdown(!showClientDropdown)}>
            <View style={styles.clientHeader}>
              <View style={styles.clientInfo}>
                <Text style={[styles.clientLabel, { color: colors.textSecondary }]}>Current Client</Text>
                <View style={styles.clientNameRow}>
                  <Text style={[styles.clientName, { color: colors.text }]}>
                    {selectedClient ? selectedClient.name : 'No client selected'}
                  </Text>
                  <MaterialCommunityIcons 
                    name={showClientDropdown ? 'chevron-up' : 'chevron-down'} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
          
          {renderClientDropdown()}
          
          {selectedClient && (
            <View style={styles.clientStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {selectedClient.sessionsCompleted || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {selectedClient.weeksActive || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Weeks</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {selectedClient.goalsAchieved || 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Goals</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}
            onPress={onMessage}
          >
            <MaterialCommunityIcons name="message" size={24} color={colors.primary} />
            <Text style={[styles.actionCardText, { color: colors.text }]}>Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}
            onPress={onCall}
          >
            <MaterialCommunityIcons name="phone" size={24} color={colors.primary} />
            <Text style={[styles.actionCardText, { color: colors.text }]}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}
            onPress={onSchedule}
          >
            <MaterialCommunityIcons name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.actionCardText, { color: colors.text }]}>Schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}
            onPress={onProgress}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color={colors.primary} />
            <Text style={[styles.actionCardText, { color: colors.text }]}>Progress</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabsContainer}>
          {['progress', 'nutrition', 'requests', 'calendar', 'files'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && [styles.activeTab, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === tab ? '#FFFFFF' : colors.textSecondary }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={[styles.tabContentContainer, { backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF' }]}>
          {renderTabContent()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    paddingTop: 60,
    paddingBottom: 30,
  },
  greetingSection: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  clientCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clientHeader: {
    marginBottom: 16,
  },
  clientInfo: {
    flex: 1,
  },
  clientLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientName: {
    fontSize: 20,
    fontWeight: '700',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 1000,
    marginTop: 8,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  clientStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionCardText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeTab: {
    // Will be set by theme
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContentContainer: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabContent: {
    alignItems: 'center',
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  tabSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
