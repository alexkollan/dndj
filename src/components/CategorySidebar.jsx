// CategorySidebar.jsx — Navigation
import React from 'react';
import '../styles/components/Sidebar.css';

function CategorySidebar({ categories, selectedCategory, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">DND<span>j</span></div>
      
      <nav className="sidebar__section">
        <h3 className="sidebar__title">Library</h3>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`sidebar__nav-item ${selectedCategory === cat ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => onSelect(cat)}
          >
            <span className="sidebar__icon">{cat === 'sfx' ? '⚡' : '🎵'}</span>
            <span>{cat.toUpperCase()}</span>
          </button>
        ))}
      </nav>

      <nav className="sidebar__section">
        <h3 className="sidebar__title">Collections</h3>
        <button
          className={`sidebar__nav-item ${selectedCategory === 'scenes' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => onSelect('scenes')}
        >
          <span className="sidebar__icon">🎬</span>
          <span>SCENES</span>
        </button>
      </nav>
    </aside>
  );
}

export default CategorySidebar;
