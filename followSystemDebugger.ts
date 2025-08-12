import { followService } from './lib/followService';

/**
 * Debug utility for the follow system
 * Helps diagnose and monitor follow operations
 */

export class FollowSystemDebugger {
  private static instance: FollowSystemDebugger;
  private operationLog: Array<{
    timestamp: number;
    operation: string;
    userId: string;
    targetId: string;
    result: boolean;
    duration: number;
  }> = [];

  static getInstance(): FollowSystemDebugger {
    if (!FollowSystemDebugger.instance) {
      FollowSystemDebugger.instance = new FollowSystemDebugger();
    }
    return FollowSystemDebugger.instance;
  }

  /**
   * Log a follow operation for debugging
   */
  logOperation(
    operation: 'follow' | 'unfollow' | 'toggle',
    userId: string,
    targetId: string,
    result: boolean,
    duration: number
  ) {
    this.operationLog.push({
      timestamp: Date.now(),
      operation,
      userId,
      targetId,
      result,
      duration
    });

    // Keep only last 100 operations
    if (this.operationLog.length > 100) {
      this.operationLog.shift();
    }

    console.log(`🔍 Follow Debug: ${operation} ${userId}->${targetId} = ${result} (${duration}ms)`);
  }

  /**
   * Get recent operations for a user
   */
  getRecentOperations(userId: string, limit: number = 10) {
    return this.operationLog
      .filter(op => op.userId === userId || op.targetId === userId)
      .slice(-limit)
      .map(op => ({
        ...op,
        timestamp: new Date(op.timestamp).toISOString()
      }));
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.operationLog.length === 0) {
      return { avgDuration: 0, successRate: 0, totalOperations: 0 };
    }

    const totalDuration = this.operationLog.reduce((sum, op) => sum + op.duration, 0);
    const successCount = this.operationLog.filter(op => op.result).length;

    return {
      avgDuration: Math.round(totalDuration / this.operationLog.length),
      successRate: Math.round((successCount / this.operationLog.length) * 100),
      totalOperations: this.operationLog.length,
      recentOperations: this.operationLog.slice(-5)
    };
  }

  /**
   * Test follow system functionality
   */
  async testFollowSystem(currentUserId: string, targetUserId: string) {
    console.log('🧪 Starting Follow System Test...\n');

    const results = {
      followTest: false,
      unfollowTest: false,
      toggleTest: false,
      statusCheck: false,
      performanceOk: false
    };

    try {
      // Test 1: Follow operation
      console.log('1️⃣ Testing follow operation...');
      const startTime = Date.now();
      const followResult = await followService.followUser(currentUserId, targetUserId);
      const followDuration = Date.now() - startTime;
      
      this.logOperation('follow', currentUserId, targetUserId, followResult, followDuration);
      results.followTest = followResult;

      // Test 2: Status check
      console.log('2️⃣ Testing follow status check...');
      const isFollowing = await followService.isFollowing(currentUserId, targetUserId);
      results.statusCheck = isFollowing;
      console.log(`   Follow status: ${isFollowing ? '✅' : '❌'}`);

      // Test 3: Unfollow operation
      console.log('3️⃣ Testing unfollow operation...');
      const unfollowStart = Date.now();
      const unfollowResult = await followService.unfollowUser(currentUserId, targetUserId);
      const unfollowDuration = Date.now() - unfollowStart;
      
      this.logOperation('unfollow', currentUserId, targetUserId, unfollowResult, unfollowDuration);
      results.unfollowTest = unfollowResult;

      // Test 4: Toggle operation
      console.log('4️⃣ Testing toggle operation...');
      const toggleStart = Date.now();
      const toggleResult = await followService.toggleFollow(currentUserId, targetUserId);
      const toggleDuration = Date.now() - toggleStart;
      
      this.logOperation('toggle', currentUserId, targetUserId, toggleResult, toggleDuration);
      results.toggleTest = toggleResult;

      // Test 5: Performance check
      const stats = this.getPerformanceStats();
      results.performanceOk = stats.avgDuration < 3000; // Less than 3 seconds
      
      console.log('\n📊 Performance Stats:', stats);
      console.log('\n🎯 Test Results:', results);

      const allPassed = Object.values(results).every(result => result);
      console.log(`\n${allPassed ? '✅' : '❌'} Overall Test Result: ${allPassed ? 'PASSED' : 'FAILED'}`);

      return { results, stats };

    } catch (error) {
      console.error('❌ Test failed:', error);
      return { results, error };
    }
  }

  /**
   * Monitor follow operations in real-time
   */
  startRealTimeMonitoring(userId: string) {
    console.log(`📡 Starting real-time monitoring for user: ${userId}`);
    
    // This would integrate with your existing real-time listeners
    // For now, we'll just log when called
    setInterval(() => {
      const recentOps = this.getRecentOperations(userId, 5);
      if (recentOps.length > 0) {
        console.log(`📊 Recent operations for ${userId}:`, recentOps);
      }
    }, 30000); // Log every 30 seconds if there are operations
  }

  /**
   * Clear debug logs
   */
  clearLogs() {
    this.operationLog = [];
    console.log('🧹 Debug logs cleared');
  }

  /**
   * Export logs for analysis
   */
  exportLogs() {
    return {
      timestamp: new Date().toISOString(),
      operations: this.operationLog,
      stats: this.getPerformanceStats()
    };
  }
}

// Export singleton instance
export const followDebugger = FollowSystemDebugger.getInstance();

// Usage example:
// import { followDebugger } from './followSystemDebugger';
// 
// // Test the system
// await followDebugger.testFollowSystem('user1', 'user2');
// 
// // Monitor performance
// followDebugger.startRealTimeMonitoring('user1');
// 
// // Get stats
// const stats = followDebugger.getPerformanceStats();
// console.log('Performance:', stats);
