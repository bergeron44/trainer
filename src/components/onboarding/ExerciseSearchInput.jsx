import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

// Use a plain axios instance without auth headers — the exercise list endpoint is public
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

/**
 * Strict exercise search input — the user MUST select from the DB.
 * Free-typed text is shown but not accepted as a valid exercise until
 * a DB match is selected from the dropdown.
 *
 * Props:
 *   value       {string}   current exercise name (display only)
 *   onChange    {fn}       called with a full exercise object on DB selection
 *                           called with null when the user clears/types freely
 *   placeholder {string}
 *   className   {string}
 */
export default function ExerciseSearchInput({ value, onChange, placeholder = 'Search exercise...', className = '' }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false); // true when a DB item is selected
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value reset (e.g. when the parent step changes)
  useEffect(() => {
    setQuery(value || '');
    setConfirmed(!!value); // treat pre-filled value as confirmed
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const fetchSuggestions = useCallback((q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    publicApi.get(`/exercises?name=${encodeURIComponent(q.trim())}&limit=8`)
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : [];
        setResults(items);
        setOpen(items.length > 0);
      })
      .catch(() => {
        setResults([]);
        setOpen(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setConfirmed(false); // user is typing freely — no longer confirmed
    onChange(null);       // notify parent that selection is cleared

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 280);
  };

  const handleSelect = (exercise) => {
    setQuery(exercise.name);
    setConfirmed(true);
    setOpen(false);
    setResults([]);
    onChange({
      id: String(exercise._id || exercise.id || ''),
      name: exercise.name,
      sets: exercise.default_sets ?? 3,
      reps: exercise.default_reps ?? '10',
      rest_seconds: exercise.rest_seconds ?? 60,
    });
  };

  const handleClear = () => {
    setQuery('');
    setConfirmed(false);
    setResults([]);
    setOpen(false);
    onChange(null);
  };

  // Icon on the right side: confirmed = green check, partial text = warning, empty = nothing
  const statusIcon = confirmed
    ? <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
    : query.length > 0
      ? <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500 pointer-events-none" />
      : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin pointer-events-none" />
          : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        }
        <input
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-8 h-9 rounded-md border text-sm bg-[#0A0A0A] text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-colors ${
            confirmed
              ? 'border-green-600/50 focus:ring-green-600/40'
              : query.length > 1
                ? 'border-yellow-600/50 focus:ring-yellow-600/40'
                : 'border-[#2A2A2A] focus:ring-[#00F2FF]/40'
          }`}
        />
        {statusIcon}
      </div>

      {/* Hint under input when user is typing without confirming */}
      {!confirmed && query.length > 1 && !open && !loading && (
        <p className="text-xs text-yellow-600 mt-1 px-1">Select an exercise from the list</p>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {results.map((ex) => (
            <button
              key={ex._id || ex.id || ex.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(ex);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#2A2A2A] transition-colors flex items-center justify-between gap-2"
            >
              <span className="text-sm text-white truncate">{ex.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {ex.muscle_group} · {ex.default_sets}×{ex.default_reps}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-xl px-3 py-2 text-sm text-gray-500">
          No exercises found for "{query}"
        </div>
      )}
    </div>
  );
}
