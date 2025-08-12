/**
 * Utility functions for formatting numbers and other data
 */

/**
 * Format view counts in social media style (1K, 2.5M, 1B)
 * Perfect for TikTok/Instagram/YouTube style view counts
 */
export const formatCount = (count: number): string => {
  if (!count || count === 0 || isNaN(count)) {
    return '0';
  }
  
  // Handle billions (1B+)
  if (count >= 1000000000) {
    const billions = count / 1000000000;
    if (billions < 10) {
      return `${Math.floor(billions * 10) / 10}B`.replace('.0B', 'B'); // 1.2B, 9.9B -> 1B
    } else {
      return `${Math.floor(billions)}B`; // 12B, 999B
    }
  }
  
  // Handle millions (1M+)
  if (count >= 1000000) {
    const millions = count / 1000000;
    if (millions < 10) {
      return `${Math.floor(millions * 10) / 10}M`.replace('.0M', 'M'); // 1.2M, 9.9M -> 1M
    } else {
      return `${Math.floor(millions)}M`; // 12M, 999M
    }
  }
  
  // Handle thousands (1K+)
  if (count >= 1000) {
    const thousands = count / 1000;
    if (thousands < 10) {
      return `${Math.floor(thousands * 10) / 10}K`.replace('.0K', 'K'); // 1.2K, 9.9K -> 1K
    } else {
      return `${Math.floor(thousands)}K`; // 12K, 999K
    }
  }
  
  // Handle smaller numbers (show full number)
  return count.toString();
};

/**
 * Format view counts specifically for view displays
 * Adds appropriate suffix for views
 */
export const formatViewCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format like counts for social media buttons
 */
export const formatLikeCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format comment counts for comment sections
 */
export const formatCommentCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format follower counts for profile displays
 */
export const formatFollowerCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format following counts for profile displays
 */
export const formatFollowingCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format video/glint counts for profile displays
 */
export const formatVideoCount = (count: number): string => {
  return formatCount(count);
};

/**
 * Format general statistics numbers
 */
export const formatStatCount = (count: number): string => {
  return formatCount(count);
};
