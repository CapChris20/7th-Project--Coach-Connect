import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  listAll, 
  getMetadata 
} from 'firebase/storage';
import { storage } from '../../app/config';

// Upload a file to Firebase Storage
export const uploadFile = async (file, path, metadata = {}) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    
    console.log('Uploading file to path:', path);
    const storageRef = ref(storage, path);
    
    // Convert file to blob if it's a File object
    let fileBlob;
    if (file instanceof File) {
      fileBlob = file;
    } else if (file.uri) {
      // For React Native, convert URI to blob
      const response = await fetch(file.uri);
      fileBlob = await response.blob();
    } else {
      throw new Error('Invalid file format');
    }
    
    const uploadResult = await uploadBytes(storageRef, fileBlob, metadata);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    console.log('File uploaded successfully:', downloadURL);
    return { 
      success: true, 
      downloadURL, 
      ref: uploadResult.ref,
      metadata: uploadResult.metadata 
    };
  } catch (error) {
    console.error('Upload file error:', error);
    return { success: false, error: error.message };
  }
};

// Get download URL for a file
export const getFileURL = async (path) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    
    const storageRef = ref(storage, path);
    const downloadURL = await getDownloadURL(storageRef);
    
    console.log('Download URL retrieved:', downloadURL);
    return { success: true, downloadURL };
  } catch (error) {
    console.error('Get file URL error:', error);
    return { success: false, error: error.message };
  }
};

// Delete a file from Firebase Storage
export const deleteFile = async (path) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    
    console.log('Deleting file from path:', path);
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    
    console.log('File deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    return { success: false, error: error.message };
  }
};

// List all files in a directory
export const listFiles = async (path) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    
    console.log('Listing files in path:', path);
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    
    const files = [];
    
    // Get download URLs for all files
    for (const itemRef of result.items) {
      try {
        const downloadURL = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        
        files.push({
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          downloadURL,
          metadata
        });
      } catch (error) {
        console.warn('Error getting metadata for file:', itemRef.name, error);
      }
    }
    
    console.log('Files listed successfully:', files.length, 'files found');
    return { success: true, files };
  } catch (error) {
    console.error('List files error:', error);
    return { success: false, error: error.message };
  }
};

// Upload user profile image
export const uploadProfileImage = async (userId, imageFile) => {
  const path = `users/${userId}/profile/profile-image-${Date.now()}`;
  const metadata = {
    contentType: 'image/jpeg',
    customMetadata: {
      uploadedBy: userId,
      type: 'profile-image'
    }
  };
  
  return await uploadFile(imageFile, path, metadata);
};

// Upload workout progress photo
export const uploadProgressPhoto = async (userId, photoFile, workoutId = null) => {
  const timestamp = Date.now();
  const path = `users/${userId}/progress/${workoutId ? `workout-${workoutId}` : 'general'}-${timestamp}`;
  const metadata = {
    contentType: 'image/jpeg',
    customMetadata: {
      uploadedBy: userId,
      type: 'progress-photo',
      workoutId: workoutId || 'general',
      timestamp: timestamp.toString()
    }
  };
  
  return await uploadFile(photoFile, path, metadata);
};

// Upload food image
export const uploadFoodImage = async (userId, imageFile, foodId = null) => {
  const timestamp = Date.now();
  const path = `users/${userId}/food/${foodId ? `food-${foodId}` : 'custom'}-${timestamp}`;
  const metadata = {
    contentType: 'image/jpeg',
    customMetadata: {
      uploadedBy: userId,
      type: 'food-image',
      foodId: foodId || 'custom',
      timestamp: timestamp.toString()
    }
  };
  
  return await uploadFile(imageFile, path, metadata);
};

// Upload trainer note as text file
export const uploadTrainerNote = async (trainerId, clientId, textContent) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    
    const timestamp = Date.now();
    const path = `trainerNotes/${trainerId}/${clientId}/${timestamp}.txt`;
    
    // Convert text to blob
    const blob = new Blob([textContent], { type: 'text/plain' });
    
    const metadata = {
      contentType: 'text/plain',
      customMetadata: {
        uploadedBy: trainerId,
        clientId: clientId,
        type: 'trainer-note',
        timestamp: timestamp.toString()
      }
    };
    
    const result = await uploadFile(blob, path, metadata);
    return result;
  } catch (error) {
    console.error('Upload trainer note error:', error);
    return { success: false, error: error.message };
  }
};