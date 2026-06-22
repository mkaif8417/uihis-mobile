// app.config.js
export default ({ config }) => ({
  ...config,
  // EXPO_PUBLIC_ vars are auto-inlined by Metro — no extra block needed for those
  plugins: [
    ...(config.plugins ?? []),
    'expo-secure-store',
  ],
});