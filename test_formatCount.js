// Test the formatCount function to show different number formatting

// Copy the formatCount function directly here for testing
const formatCount = (count) => {
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

console.log('🔢 Testing formatCount function:');
console.log('');

// Test different number ranges
const testNumbers = [
  0,
  5,
  42,
  156,
  999,
  1000,      // 1K
  1200,      // 1.2K
  1500,      // 1.5K
  2000,      // 2K
  9900,      // 9.9K
  10000,     // 10K
  12500,     // 12K
  99900,     // 99K
  100000,    // 100K
  999000,    // 999K
  1000000,   // 1M
  1200000,   // 1.2M
  2500000,   // 2.5M
  10000000,  // 10M
  99900000,  // 99M
  100000000, // 100M
  999000000, // 999M
  1000000000, // 1B
  1200000000, // 1.2B
  5600000000, // 5.6B
  12000000000 // 12B
];

testNumbers.forEach(num => {
  const formatted = formatCount(num);
  console.log(`${num.toLocaleString().padStart(12)} → ${formatted.padEnd(6)} (${formatted})`);
});

console.log('');
console.log('✅ Your app already uses this formatting for:');
console.log('   • Follower counts');
console.log('   • Following counts');
console.log('   • Glints (video) counts');
console.log('   • View counts');
console.log('   • Like counts');
