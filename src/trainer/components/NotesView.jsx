import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function NotesView() {
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showUploadFile, setShowUploadFile] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  const handleAddNote = () => {
    if (newNoteTitle.trim() && newNoteContent.trim()) {
      const newNote = {
        id: Date.now(),
        date: 'Just now',
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
      };
      setNotes([newNote, ...notes]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowAddNote(false);
    }
  };

  const handleUploadFile = async (type) => {
    try {
      if (type === 'image') {
        // Request permission first
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
          return;
        }

        // Pick image
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (!result.canceled) {
          const newFile = {
            id: Date.now(),
            name: result.assets[0].fileName || 'Image',
            uri: result.assets[0].uri,
            type: 'image',
            size: result.assets[0].fileSize || 0,
            date: 'Just now',
          };
          setFiles([newFile, ...files]);
          setShowUploadFile(false);
        }
      } else if (type === 'document') {
        // Pick document
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });

        if (!result.canceled) {
          const newFile = {
            id: Date.now(),
            name: result.assets[0].name,
            uri: result.assets[0].uri,
            type: 'document',
            size: result.assets[0].size || 0,
            date: 'Just now',
          };
          setFiles([newFile, ...files]);
          setShowUploadFile(false);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file. Please try again.');
    }
  };

  const handleDeleteNote = (id) => {
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
  };

  const handleDeleteFile = (id) => {
    const updatedFiles = files.filter(file => file.id !== id);
    setFiles(updatedFiles);
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'PDF': return '📄';
      case 'Folder': return '📁';
      case 'Video': return '🎥';
      default: return '📎';
    }
  };

  const getFileColor = (type) => {
    switch (type) {
      case 'PDF': return '#FF453A';
      case 'Folder': return '#0A84FF';
      case 'Video': return '#30D158';
      default: return '#8E8E93';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Client Notes</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddNote(true)}>
            <Text style={styles.addButtonText}>+ Add Note</Text>
          </TouchableOpacity>
        </View>

        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>Add your first client note</Text>
          </View>
        ) : (
          notes.map((note) => (
            <TouchableOpacity key={note.id} style={styles.noteCard}>
              <Text style={styles.noteDate}>{note.date}</Text>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteContent}>{note.content}</Text>
              <View style={styles.noteActions}>
                <TouchableOpacity style={styles.noteAction}>
                  <Text style={styles.noteActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noteAction} onPress={() => handleDeleteNote(note.id)}>
                  <Text style={styles.noteActionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Files Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shared Files</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowUploadFile(true)}>
            <Text style={styles.addButtonText}>+ Upload File</Text>
          </TouchableOpacity>
        </View>

        {files.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>No files yet</Text>
            <Text style={styles.emptySubtitle}>Upload your first file</Text>
          </View>
        ) : (
          files.map((file) => (
            <TouchableOpacity key={file.id} style={styles.fileCard}>
              <View style={[styles.fileIcon, { backgroundColor: `${getFileColor(file.type)}20` }]}>
                <Text style={styles.fileIconText}>{getFileIcon(file.type)}</Text>
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{file.name}</Text>
                <Text style={styles.fileMeta}>{file.size} • {file.date}</Text>
              </View>
              <Text style={styles.fileArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Add Note Modal */}
      {showAddNote && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add New Note</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Note Title"
              placeholderTextColor="#8E8E93"
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
            />
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Note Content"
              placeholderTextColor="#8E8E93"
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddNote(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleAddNote}>
                <Text style={styles.confirmButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Upload File Modal */}
      {showUploadFile && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Upload File</Text>
            <Text style={styles.modalSubtitle}>File upload functionality would be implemented here</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowUploadFile(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleUploadFile}>
                <Text style={styles.confirmButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#0A84FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  noteCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Glass morphism effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    // Inner shadow effect
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  noteDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noteContent: {
    fontSize: 14,
    color: '#C7C7CC',
    marginBottom: 12,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 16,
  },
  noteAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  noteActionText: {
    fontSize: 12,
    color: '#0A84FF',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fileCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    // Glass morphism effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    // Inner shadow effect
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fileIconText: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 14,
    color: '#8E8E93',
  },
  fileArrow: {
    fontSize: 20,
    color: '#8E8E93',
  },
});
