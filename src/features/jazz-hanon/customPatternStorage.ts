import type { ChordDegree } from '../../data/exercises';

const STORAGE_KEY = 'piano-steps:custom-hanon-patterns';

export interface StoredPattern {
  id: string;
  name: string;
  degrees: ChordDegree[];
  createdAt: number;
}

interface StorageEnvelope {
  version: 1;
  patterns: StoredPattern[];
}

export function generatePatternId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `custom-${Date.now()}-${rand}`;
}

export function loadCustomPatterns(): StoredPattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: StorageEnvelope = JSON.parse(raw);
    return (data.patterns ?? []).filter(
      (p) => p.id && p.name && Array.isArray(p.degrees) && p.degrees.length === 8
    );
  } catch {
    return [];
  }
}

function saveAll(patterns: StoredPattern[]): void {
  const envelope: StorageEnvelope = { version: 1, patterns };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function saveCustomPattern(pattern: StoredPattern): void {
  const existing = loadCustomPatterns();
  existing.push(pattern);
  saveAll(existing);
}

export function updateCustomPattern(id: string, updates: Partial<Omit<StoredPattern, 'id'>>): void {
  const patterns = loadCustomPatterns().map(p =>
    p.id === id ? { ...p, ...updates } : p
  );
  saveAll(patterns);
}

export function deleteCustomPattern(id: string): void {
  const patterns = loadCustomPatterns().filter(p => p.id !== id);
  saveAll(patterns);
}
