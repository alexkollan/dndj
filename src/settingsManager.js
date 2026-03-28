/**
 * settingsManager.js — User Preferences Persistence
 * Handles saving and loading category volumes, EQ, and master settings
 * to localStorage so they persist across app restarts.
 */

const SETTINGS_KEY = 'dndj_user_settings';

const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  categories: {} // [categoryName]: { volume: 1, eq: { bass: 0, mid: 0, high: 0 } }
};

/**
 * loadSettings
 * Retrieves settings from localStorage or returns defaults if none exist.
 */
export function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    // Merge stored settings with defaults to handle schema updates
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      categories: parsed.categories || {}
    };
  } catch (err) {
    console.error('Failed to load settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * saveSettings
 * Persists the current settings object to localStorage.
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * getCategorySettings
 * Returns settings for a specific category, ensuring defaults exist.
 */
export function getCategorySettings(settings, categoryName) {
  return settings.categories[categoryName] || {
    volume: 1,
    eq: { bass: 0, mid: 0, high: 0 }
  };
}
