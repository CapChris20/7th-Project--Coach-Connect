// Test notification function - run this in your app to test notifications
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Test function to send a notification
export const testNotification = async () => {
  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Send a test notification immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 CoachConnect Test',
        body: 'This is a test notification from your app!',
        data: { type: 'test' },
        sound: 'default',
      },
      trigger: null, // Show immediately
    });

    console.log('✅ Test notification sent!');
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
};

// Test function to simulate trainer message
export const testTrainerMessage = async () => {
  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Send a trainer message notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 New Message from Trainer',
        body: 'Great workout today! Keep up the good work! 💯',
        data: { 
          type: 'trainer_message',
          trainerId: 'test_trainer_123',
          conversationId: 'test_conv_456'
        },
        sound: 'default',
      },
      trigger: null, // Show immediately
    });

    console.log('✅ Trainer message notification sent!');
  } catch (error) {
    console.error('❌ Error sending trainer notification:', error);
  }
};

// Test function to schedule notification for later
export const scheduleWorkoutReminder = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Schedule for 2 minutes from now
    const trigger = new Date(Date.now() + 2 * 60 * 1000);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏋️ Workout Reminder',
        body: 'Time for your workout! You got this! 🔥',
        data: { type: 'workout_reminder' },
        sound: 'default',
      },
      trigger,
    });

    console.log('✅ Workout reminder scheduled for 2 minutes from now!');
  } catch (error) {
    console.error('❌ Error scheduling reminder:', error);
  }
};

console.log('📱 Notification test functions loaded!');
console.log('Add these to your app and call testNotification() or testTrainerMessage()');
