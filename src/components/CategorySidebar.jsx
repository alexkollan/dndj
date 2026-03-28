// CategorySidebar.jsx — Category Navigation Sidebar
// Renders the list of sound categories (atmosphere, combat, etc.) as
// clickable nav items. Highlights the currently selected category.
// Purely presentational — all state lives in App.jsx.

import React from 'react';
import '../styles/controls.css';

// Display name overrides — maps raw folder names to friendlier labels
const CATEGORY_LABELS = {
  atmosphere: 'Atmosphere',
  combat: 'Combat',
  exploration: 'Exploration',
  tavern: 'Tavern',
  sfx: 'SFX',
};

/**
 * CategorySidebar
 *
 * Props:
 *   categories       {string[]}  - List of category keys (folder names)
 *   selectedCategory {string}    - The currently active category key
 *   onSelect         {function}  - Called with the category key when clicked
 */
function CategorySidebar({ categories, selectedCategory, onSelect }) {
  return (
    <nav className="category-sidebar" aria-label="Sound categories">
      <h2 className="category-sidebar__title">Categories</h2>
      <ul className="category-sidebar__list">
        {categories.map((cat) => (
          <li key={cat}>
            <button
              className={`category-sidebar__item${selectedCategory === cat ? ' category-sidebar__item--active' : ''}`}
              onClick={() => onSelect(cat)}
              aria-current={selectedCategory === cat ? 'page' : undefined}
            >
              {/* Use friendly label if available, otherwise title-case the key */}
              {CATEGORY_LABELS[cat] ?? cat.replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default CategorySidebar;
