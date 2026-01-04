export function shouldDetachSession({
  // Params kept for future policy tweaks; currently only waitPreference/disableDetachEnv matter.
  waitPreference,
  disableDetachEnv,
}: {
  waitPreference: boolean;
  disableDetachEnv: boolean;
}): boolean {
  if (disableDetachEnv) return false;
  return !waitPreference;
}
