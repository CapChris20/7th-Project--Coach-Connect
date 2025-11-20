import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';

// Create a new document
export const createDoc = async (collectionName, data) => {
  try {
    console.log('Creating document in collection:', collectionName);
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Document created with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Create document error:', error);
    return { success: false, error: error.message };
  }
};

// Get a single document by ID
export const getDocById = async (collectionName, docId) => {
  try {
    console.log('Getting document:', docId, 'from collection:', collectionName);
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('Document found:', docSnap.data());
      return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
    } else {
      console.log('Document not found');
      return { success: false, error: 'Document not found' };
    }
  } catch (error) {
    console.error('Get document error:', error);
    return { success: false, error: error.message };
  }
};

// Update a document
export const updateDocById = async (collectionName, docId, data) => {
  try {
    console.log('Updating document:', docId, 'in collection:', collectionName);
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    console.log('Document updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Update document error:', error);
    return { success: false, error: error.message };
  }
};

// Delete a document
export const deleteDocById = async (collectionName, docId) => {
  try {
    console.log('Deleting document:', docId, 'from collection:', collectionName);
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    console.log('Document deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete document error:', error);
    return { success: false, error: error.message };
  }
};

// Query documents with filters
export const queryCollection = async (collectionName, filters = [], orderByField = null, orderDirection = 'asc', limitCount = null) => {
  try {
    console.log('Querying collection:', collectionName, 'with filters:', filters);
    let q = collection(db, collectionName);
    
    // Apply filters
    filters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = [];
    
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('Query completed, found', documents.length, 'documents');
    return { success: true, data: documents };
  } catch (error) {
    console.error('Query collection error:', error);
    return { success: false, error: error.message };
  }
};
