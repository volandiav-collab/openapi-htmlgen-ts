import fs from 'node:fs';
import yaml from 'js-yaml';

export function loadOpenAPI(inputPath: string): Record<string, unknown> {
  const text = fs.readFileSync(inputPath, 'utf-8');
  try { return JSON.parse(text); } catch (_) { /* not json */ }
  const data = yaml.load(text);
  if (!data || typeof data !== 'object') throw new Error('OpenAPI must be an object');
  return data as Record<string, unknown>;
}

export function loadUnifiedJson(inputPath: string): Record<string, unknown> {
  const text = fs.readFileSync(inputPath, 'utf-8');
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Unified doc must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    const data = yaml.load(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Unified doc must be an object');
    }
    return data as Record<string, unknown>;
  }
}
