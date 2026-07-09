import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import 'react-native-reanimated';

import { SettingsProvider } from '@/contexts/settings';
import { TransactionDraftProvider } from '@/contexts/transaction-draft';
import { db } from '@/db/client';
import migrations from '@/drizzle/migrations';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return <Text>マイグレーションエラー: {error.message}</Text>;
  }

  if (!success) {
    return <Text>読み込み中...</Text>;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SettingsProvider>
        <TransactionDraftProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* ウィザード3画面は画面内ヘッダー(✕/←+画面名)を持つため、デフォルトヘッダーを消す */}
            <Stack.Screen name="input" options={{ headerShown: false }} />
            <Stack.Screen name="detail" options={{ headerShown: false }} />
            <Stack.Screen name="category" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </TransactionDraftProvider>
      </SettingsProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}