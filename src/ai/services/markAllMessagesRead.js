// Utility to mark all messages as read for a user
// Run this once to clean up any old unread messages

import { db } from '../../app/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function markAllMessagesReadForUser(userId) {
  try {
    console.log('🔍 Finding all conversations for user:', userId);
    
    // Get all conversations for this user
    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const conversationsSnapshot = await getDocs(conversationsQuery);
    const conversationIds = [];
    
    conversationsSnapshot.forEach((doc) => {
      conversationIds.push(doc.id);
    });
    
    console.log(`📨 Found ${conversationIds.length} conversations`);
    
    // For each conversation, mark all messages as read
    let totalMarked = 0;
    
    for (const conversationId of conversationIds) {
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      const updatePromises = [];
      
      messagesSnapshot.forEach((docSnap) => {
        const messageData = docSnap.data();
        // Mark as read if not sent by current user and not already read
        if (messageData.senderId !== userId && messageData.read === false) {
          updatePromises.push(
            updateDoc(doc(db, 'messages', docSnap.id), { read: true })
          );
          totalMarked++;
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    }
    
    console.log(`✅ Marked ${totalMarked} messages as read`);
    return totalMarked;
  } catch (error) {
    console.error('❌ Error marking messages as read:', error);
    throw error;
  }
}
