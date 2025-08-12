// 🔒 Security Utilities for Glint App
// This module provides comprehensive security measures to prevent attacks

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

// 🔒 Security Constants
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 5 * 60 * 1000, // 5 minutes
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  ENCRYPTION_KEY: 'glint_security_key_2025', // In production, use a more secure key
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes of inactivity
};

// 🔒 Input Validation and Sanitization
export class SecurityValidator {
  // Email validation with strict regex
  static validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Password strength validation
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) errors.push('Password must be at least 8 characters long');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/\d/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character');
    if (password.length > 128) errors.push('Password must be less than 128 characters');
    
    return { isValid: errors.length === 0, errors };
  }

  // Username validation (alphanumeric + underscores, 3-30 chars)
  static validateUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  }

  // Sanitize user input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 1000); // Limit length
  }

  // Validate and sanitize comment content
  static validateComment(comment: string): { isValid: boolean; sanitized: string; errors: string[] } {
    const errors: string[] = [];
    
    if (!comment || comment.trim().length === 0) {
      errors.push('Comment cannot be empty');
    }
    
    if (comment.length > 500) {
      errors.push('Comment must be less than 500 characters');
    }
    
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{10,}/g, // Repeated characters
      /https?:\/\/[^\s]+/gi, // URLs (you might want to allow these)
    ];
    
    for (const pattern of spamPatterns) {
      if (pattern.test(comment)) {
        errors.push('Comment contains prohibited content');
        break;
      }
    }
    
    const sanitized = this.sanitizeInput(comment);
    
    return { isValid: errors.length === 0, sanitized, errors };
  }
}

// 🔒 Rate Limiting and Brute Force Protection
export class SecurityRateLimit {
  private static getAttemptKey(identifier: string, action: string): string {
    return `security_attempts_${action}_${identifier}`;
  }

  private static getLastAttemptKey(identifier: string, action: string): string {
    return `security_last_attempt_${action}_${identifier}`;
  }

  // Check if user is locked out
  static async isLockedOut(identifier: string, action: string = 'login'): Promise<boolean> {
    try {
      const attemptsKey = this.getAttemptKey(identifier, action);
      const lastAttemptKey = this.getLastAttemptKey(identifier, action);
      
      const attempts = await AsyncStorage.getItem(attemptsKey);
      const lastAttempt = await AsyncStorage.getItem(lastAttemptKey);
      
      if (!attempts || !lastAttempt) return false;
      
      const attemptCount = parseInt(attempts, 10);
      const lastAttemptTime = parseInt(lastAttempt, 10);
      const now = Date.now();
      
      // If lockout period has passed, reset attempts
      if (now - lastAttemptTime > SECURITY_CONFIG.LOCKOUT_DURATION) {
        await this.resetAttempts(identifier, action);
        return false;
      }
      
      return attemptCount >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;
    } catch (error) {
      console.error('Error checking lockout status:', error);
      return false;
    }
  }

  // Record a failed attempt
  static async recordFailedAttempt(identifier: string, action: string = 'login'): Promise<void> {
    try {
      const attemptsKey = this.getAttemptKey(identifier, action);
      const lastAttemptKey = this.getLastAttemptKey(identifier, action);
      
      const attempts = await AsyncStorage.getItem(attemptsKey);
      const attemptCount = attempts ? parseInt(attempts, 10) + 1 : 1;
      
      await AsyncStorage.setItem(attemptsKey, attemptCount.toString());
      await AsyncStorage.setItem(lastAttemptKey, Date.now().toString());
      
      // Log security event
      console.warn(`🚨 SECURITY: Failed ${action} attempt #${attemptCount} for ${identifier}`);
    } catch (error) {
      console.error('Error recording failed attempt:', error);
    }
  }

  // Reset attempts (on successful login)
  static async resetAttempts(identifier: string, action: string = 'login'): Promise<void> {
    try {
      const attemptsKey = this.getAttemptKey(identifier, action);
      const lastAttemptKey = this.getLastAttemptKey(identifier, action);
      
      await AsyncStorage.removeItem(attemptsKey);
      await AsyncStorage.removeItem(lastAttemptKey);
    } catch (error) {
      console.error('Error resetting attempts:', error);
    }
  }

  // Get remaining lockout time
  static async getRemainingLockoutTime(identifier: string, action: string = 'login'): Promise<number> {
    try {
      const lastAttemptKey = this.getLastAttemptKey(identifier, action);
      const lastAttempt = await AsyncStorage.getItem(lastAttemptKey);
      
      if (!lastAttempt) return 0;
      
      const lastAttemptTime = parseInt(lastAttempt, 10);
      const now = Date.now();
      const remaining = SECURITY_CONFIG.LOCKOUT_DURATION - (now - lastAttemptTime);
      
      return Math.max(0, remaining);
    } catch (error) {
      console.error('Error getting remaining lockout time:', error);
      return 0;
    }
  }
}

// 🔒 Secure Data Encryption
export class SecurityEncryption {
  // Encrypt sensitive data before storing
  static encrypt(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, SECURITY_CONFIG.ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error('Encryption error:', error);
      return data; // Fallback to unencrypted if encryption fails
    }
  }

  // Decrypt sensitive data after retrieving
  static decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, SECURITY_CONFIG.ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Fallback to original if decryption fails
    }
  }
}

// 🔒 Session Management
export class SecuritySession {
  private static readonly SESSION_KEY = 'user_session';
  private static readonly LAST_ACTIVITY_KEY = 'last_activity';

  // Update last activity timestamp
  static async updateActivity(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  // Check if session has expired due to inactivity
  static async isSessionExpired(): Promise<boolean> {
    try {
      const lastActivity = await AsyncStorage.getItem(this.LAST_ACTIVITY_KEY);
      
      if (!lastActivity) return true;
      
      const lastActivityTime = parseInt(lastActivity, 10);
      const now = Date.now();
      
      return (now - lastActivityTime) > SECURITY_CONFIG.SESSION_TIMEOUT;
    } catch (error) {
      console.error('Error checking session expiry:', error);
      return true; // Fail secure - treat as expired
    }
  }

  // Clear all session data
  static async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SESSION_KEY);
      await AsyncStorage.removeItem(this.LAST_ACTIVITY_KEY);
      
      // Clear secure store
      try {
        await SecureStore.deleteItemAsync('userToken');
      } catch (secureError) {
        console.log('SecureStore cleanup completed');
      }
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }
}

// 🔒 Security Logger
export class SecurityLogger {
  static async logSecurityEvent(event: string, details: object = {}): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: 'Glint Mobile App',
    };
    
    console.warn('🔒 SECURITY EVENT:', logEntry);
    
    // In production, you might want to send this to a security monitoring service
    // await sendToSecurityService(logEntry);
  }
}

// 🔒 Content Security Policy
export class SecurityCSP {
  // Validate uploaded file types
  static validateFileType(uri: string, allowedTypes: string[]): boolean {
    const extension = uri.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  // Validate file size (in bytes)
  static validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  // Validate image dimensions
  static validateImageDimensions(width: number, height: number, maxWidth: number = 4096, maxHeight: number = 4096): boolean {
    return width <= maxWidth && height <= maxHeight;
  }
}

// Export all security utilities
export {
    SECURITY_CONFIG, SecurityCSP, SecurityEncryption, SecurityLogger, SecurityRateLimit, SecuritySession, SecurityValidator
};

