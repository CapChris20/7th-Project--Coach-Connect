import Constants from 'expo-constants';

export const getApiBase = () => {
  return (
    Constants.expoConfig?.extra?.apiBaseUrl ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'http://localhost:4000'
  );
};
