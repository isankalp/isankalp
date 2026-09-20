import { v4 as uuid } from 'uuid'

export interface ProfileMeta {
  id: string
  name: string
  createdAt: number
}

const REGISTRY_KEY = 'goals-tracker:profiles'
const ACTIVE_KEY = 'goals-tracker:activeProfileId'
export const DEFAULT_PROFILE: ProfileMeta = { id: 'default', name: 'Personal', createdAt: 0 }

function readRegistry(): ProfileMeta[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return [DEFAULT_PROFILE]
    const parsed = JSON.parse(raw) as ProfileMeta[]
    return parsed.length ? parsed : [DEFAULT_PROFILE]
  } catch {
    return [DEFAULT_PROFILE]
  }
}

function writeRegistry(profiles: ProfileMeta[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(profiles))
}

export function listProfiles(): ProfileMeta[] {
  return readRegistry()
}

export function getActiveProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || DEFAULT_PROFILE.id
  } catch {
    return DEFAULT_PROFILE.id
  }
}

/** The default profile keeps the original 'goals-tracker' database name so existing users don't lose data. */
export function dbNameForProfile(id: string): string {
  return id === DEFAULT_PROFILE.id ? 'goals-tracker' : `goals-tracker-${id}`
}

export function createProfile(name: string): ProfileMeta {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Profile name is required.')
  const profiles = readRegistry()
  if (profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('A profile with that name already exists.')
  }
  const profile: ProfileMeta = { id: uuid(), name: trimmed, createdAt: Date.now() }
  writeRegistry([...profiles, profile])
  return profile
}

/** Switches the active profile and reloads the page so every module re-reads a fresh, profile-scoped database. */
export function switchActiveProfile(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
  window.location.reload()
}

export async function deleteProfile(id: string): Promise<void> {
  if (id === DEFAULT_PROFILE.id) throw new Error('The default profile cannot be deleted.')
  const profiles = readRegistry().filter((p) => p.id !== id)
  writeRegistry(profiles.length ? profiles : [DEFAULT_PROFILE])
  const wasActive = getActiveProfileId() === id
  const { default: Dexie } = await import('dexie')
  await Dexie.delete(dbNameForProfile(id))
  if (wasActive) {
    switchActiveProfile(DEFAULT_PROFILE.id)
  }
}
