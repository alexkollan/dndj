// src/main.jsx — React Entry Point
// Mounts the React application into the #root div defined in index.html.
// This is the only file that touches the DOM directly.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
