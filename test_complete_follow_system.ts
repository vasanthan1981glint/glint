import { followService } from './lib/followService';
import { notificationService } from './lib/notificationService';

/**
 * Test script for the complete follow system
 * This script demonstrates all the follow system functionality
 */

// Mock user IDs for testing
const USER_A = 'user-a-12345';
const USER_B = 'user-b-67890';
const USER_C = 'user-c-54321';

async function testFollowSystem() {
  console.log('🧪 Starting Follow System Tests...\n');

  try {
    // Test 1: Basic Follow Operation
    console.log('1️⃣ Testing basic follow operation...');
    const followSuccess = await followService.followUser(USER_A, USER_B);
    console.log(`   Follow User A -> User B: ${followSuccess ? '✅' : '❌'}`);

    // Test 2: Check Follow Status
    console.log('\n2️⃣ Testing follow status check...');
    const isFollowing = await followService.isFollowing(USER_A, USER_B);
    console.log(`   User A following User B: ${isFollowing ? '✅' : '❌'}`);

    // Test 3: Get Follow Statistics
    console.log('\n3️⃣ Testing follow statistics...');
    const statsUserB = await followService.getUserFollowStats(USER_B, USER_A);
    console.log(`   User B stats: ${statsUserB.followersCount} followers, ${statsUserB.followingCount} following`);
    console.log(`   User A is following User B: ${statsUserB.isFollowing ? '✅' : '❌'}`);

    // Test 4: Multiple Follow Relationships
    console.log('\n4️⃣ Testing multiple follow relationships...');
    await followService.followUser(USER_C, USER_B); // User C follows User B
    await followService.followUser(USER_A, USER_C); // User A follows User C
    
    const updatedStatsB = await followService.getUserFollowStats(USER_B);
    console.log(`   User B now has ${updatedStatsB.followersCount} followers`);

    // Test 5: Get Following List
    console.log('\n5️⃣ Testing following list...');
    const userAFollowing = await followService.getFollowing(USER_A);
    console.log(`   User A is following ${userAFollowing.length} users: [${userAFollowing.join(', ')}]`);

    // Test 6: Get Followers List
    console.log('\n6️⃣ Testing followers list...');
    const userBFollowers = await followService.getFollowers(USER_B);
    console.log(`   User B has ${userBFollowers.length} followers: [${userBFollowers.join(', ')}]`);

    // Test 7: Unfollow Operation
    console.log('\n7️⃣ Testing unfollow operation...');
    const unfollowSuccess = await followService.unfollowUser(USER_A, USER_B);
    console.log(`   Unfollow User A -> User B: ${unfollowSuccess ? '✅' : '❌'}`);
    
    const isStillFollowing = await followService.isFollowing(USER_A, USER_B);
    console.log(`   User A still following User B: ${isStillFollowing ? '❌' : '✅'}`);

    // Test 8: Toggle Follow
    console.log('\n8️⃣ Testing toggle follow...');
    const toggleResult1 = await followService.toggleFollow(USER_A, USER_B);
    console.log(`   Toggle follow (should follow): ${toggleResult1 ? '✅' : '❌'}`);
    
    const toggleResult2 = await followService.toggleFollow(USER_A, USER_B);
    console.log(`   Toggle follow (should unfollow): ${toggleResult2 ? '✅' : '❌'}`);

    // Test 9: Notification System
    console.log('\n9️⃣ Testing notification system...');
    
    // Send a follow notification
    const notificationSuccess = await notificationService.sendFollowNotification(
      USER_A,
      USER_B,
      'TestUserA',
      'https://example.com/avatar.jpg'
    );
    console.log(`   Follow notification sent: ${notificationSuccess ? '✅' : '❌'}`);

    // Get notifications for User B
    const notifications = await notificationService.getUserNotifications(USER_B, 10);
    console.log(`   User B has ${notifications.length} notifications`);

    // Test 10: Real-time Listener (Mock)
    console.log('\n🔟 Testing real-time listener setup...');
    const listener = followService.setupFollowListener(
      USER_A,
      USER_B,
      (isFollowing: boolean) => {
        console.log(`   📡 Real-time update: User A following User B = ${isFollowing}`);
      }
    );
    console.log(`   Real-time listener setup: ${listener ? '✅' : '❌'}`);

    // Cleanup
    if (listener) {
      listener();
      console.log('   Cleaned up real-time listener ✅');
    }

    console.log('\n🎉 Follow System Tests Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testNotificationSystem() {
  console.log('\n📬 Testing Notification System...\n');

  try {
    // Test different notification types
    const notifications = [
      {
        type: 'follow',
        fromUser: USER_A,
        toUser: USER_B,
        username: 'TestUserA',
        avatar: 'https://example.com/avatar-a.jpg'
      },
      {
        type: 'like',
        fromUser: USER_C,
        toUser: USER_B,
        username: 'TestUserC',
        avatar: 'https://example.com/avatar-c.jpg',
        videoId: 'video-123'
      },
      {
        type: 'comment',
        fromUser: USER_A,
        toUser: USER_C,
        username: 'TestUserA',
        avatar: 'https://example.com/avatar-a.jpg',
        videoId: 'video-456',
        commentId: 'comment-789'
      }
    ];

    for (const notif of notifications) {
      let success = false;
      
      switch (notif.type) {
        case 'follow':
          success = await notificationService.sendFollowNotification(
            notif.fromUser,
            notif.toUser,
            notif.username,
            notif.avatar
          );
          break;
        case 'like':
          success = await notificationService.sendLikeNotification(
            notif.fromUser,
            notif.toUser,
            notif.videoId!,
            notif.username,
            notif.avatar
          );
          break;
        case 'comment':
          success = await notificationService.sendCommentNotification(
            notif.fromUser,
            notif.toUser,
            notif.videoId!,
            notif.commentId!,
            notif.username,
            notif.avatar
          );
          break;
      }
      
      console.log(`   ${notif.type} notification: ${success ? '✅' : '❌'}`);
    }

    // Test notification retrieval
    console.log('\n📥 Testing notification retrieval...');
    const userBNotifs = await notificationService.getUserNotifications(USER_B, 20);
    const userCNotifs = await notificationService.getUserNotifications(USER_C, 20);
    
    console.log(`   User B notifications: ${userBNotifs.length}`);
    console.log(`   User C notifications: ${userCNotifs.length}`);

    // Test unread count
    const unreadCount = await notificationService.getUnreadCount(USER_B);
    console.log(`   User B unread notifications: ${unreadCount}`);

    console.log('\n📬 Notification System Tests Completed!');
    
  } catch (error) {
    console.error('❌ Notification test failed:', error);
  }
}

async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases...\n');

  try {
    // Test 1: Self-follow prevention
    console.log('1️⃣ Testing self-follow prevention...');
    const selfFollow = await followService.followUser(USER_A, USER_A);
    console.log(`   Self-follow prevented: ${!selfFollow ? '✅' : '❌'}`);

    // Test 2: Double follow prevention
    console.log('\n2️⃣ Testing double follow...');
    await followService.followUser(USER_A, USER_B);
    const doubleFollow = await followService.followUser(USER_A, USER_B);
    console.log(`   Double follow handled: ${doubleFollow ? '✅' : '❌'}`);

    // Test 3: Invalid user IDs
    console.log('\n3️⃣ Testing invalid user IDs...');
    const invalidFollow = await followService.followUser('', USER_B);
    console.log(`   Invalid user ID handled: ${!invalidFollow ? '✅' : '❌'}`);

    // Test 4: Non-existent user follow status
    console.log('\n4️⃣ Testing non-existent user...');
    const nonExistentStatus = await followService.isFollowing('non-existent', USER_B);
    console.log(`   Non-existent user handled: ${!nonExistentStatus ? '✅' : '❌'}`);

    console.log('\n🧪 Edge Case Tests Completed!');
    
  } catch (error) {
    console.error('❌ Edge case test failed:', error);
  }
}

// Export test functions for use in the app
export {
    testEdgeCases, testFollowSystem,
    testNotificationSystem
};

// Example usage:
// import { testFollowSystem } from './test_complete_follow_system';
// testFollowSystem();
