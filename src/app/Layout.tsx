import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', emoji: '🏠' },
  { to: '/metronome', label: 'Metronome', emoji: '🥁' },
  { to: '/chords', label: 'Chords', emoji: '🎹' },
  { to: '/two-five-one', label: 'II-V-I', emoji: '🎵' },
  { to: '/jazz-hanon', label: 'Hanon', emoji: '🎼' },
  { to: '/chord-detect', label: 'Detect', emoji: '🎤' },
  { to: '/chord-sense', label: 'Sense', emoji: '🎧' },
  { to: '/humming', label: 'Humming', emoji: '🎙️' },
];

/** Hamburger menu icon */
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/** Close (X) icon */
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-4 gap-1 shrink-0">
        <h1 className="text-lg font-bold mb-4 px-3">Piano Steps</h1>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.emoji}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto overscroll-none">
        <Outlet />
      </main>

      {/* Mobile FAB menu */}
      <div className="md:hidden">
        {/* Backdrop overlay */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Menu items */}
        <div className={`fixed bottom-20 right-4 z-50 flex flex-col gap-2${menuOpen ? '' : ' pointer-events-none'}`}>
          {navItems.map((item, idx) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-2 rounded-full shadow-lg text-sm whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white text-gray-700'
                } ${
                  menuOpen
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
                style={{ transitionDelay: menuOpen ? `${idx * 30}ms` : '0ms' }}
              >
                {item.emoji} {item.label}
              </NavLink>
            );
          })}
        </div>

        {/* FAB button */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`fixed bottom-6 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            menuOpen
              ? 'bg-gray-700 text-white'
              : 'bg-amber-500 text-white'
          }`}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
    </div>
  );
}
