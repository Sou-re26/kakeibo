import { eq } from 'drizzle-orm';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { accountDelta } from '@/lib/balance';

// 円の整数のみ許可(負値=負債も可)。不正なら null。
function parseBalance(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export default function AccountScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accountId = id ? Number(id) : null;
  const isEdit = accountId !== null;

  const [name, setName] = useState('');
  const [balanceText, setBalanceText] = useState('0');
  // 取引による増減。入力欄は「現在の残高」なので、保存時に 基準残高 = 入力値 - delta と逆算する
  const [delta, setDelta] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (accountId === null) return;
    let isActive = true;

    const loadAccount = async () => {
      try {
        const [rows, txRows] = await Promise.all([
          db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1),
          db
            .select({
              type: transactions.type,
              amount: transactions.amount,
              accountId: transactions.accountId,
              toAccountId: transactions.toAccountId,
            })
            .from(transactions),
        ]);
        if (isActive && rows.length > 0) {
          const d = accountDelta(accountId, txRows);
          setName(rows[0].name);
          setDelta(d);
          setBalanceText(String(rows[0].balance + d));
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadAccount();

    return () => {
      isActive = false;
    };
  }, [accountId]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('保存できません', '口座名を入力してください。');
      return;
    }
    const balance = parseBalance(balanceText);
    if (balance === null) {
      Alert.alert('保存できません', '残高は整数(円)で入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      if (accountId === null) {
        await db.insert(accounts).values({ name: trimmedName, balance });
      } else {
        await db
          .update(accounts)
          .set({ name: trimmedName, balance: balance - delta })
          .where(eq(accounts.id, accountId));
      }
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('保存に失敗しました', 'もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (accountId === null) return;
    Alert.alert('口座を削除', `「${name}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(accounts).where(eq(accounts.id, accountId));
            router.back();
          } catch (error) {
            console.error(error);
            Alert.alert('削除に失敗しました', 'もう一度お試しください。');
          }
        },
      },
    ]);
  };

  const textColor = Colors[colorScheme].text;
  const borderColor = Colors[colorScheme].border;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: isEdit ? '口座の編集' : '口座の追加' }} />

      <View style={styles.field}>
        <ThemedText style={styles.label}>口座名</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          placeholder="例: 現金、〇〇銀行"
          placeholderTextColor={Colors[colorScheme].icon}
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.label}>現在の残高(円)</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor }]}
          placeholder="0"
          placeholderTextColor={Colors[colorScheme].icon}
          value={balanceText}
          onChangeText={setBalanceText}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <Pressable
        style={[
          styles.saveButton,
          { backgroundColor: Colors[colorScheme].tint },
          isSaving && styles.disabled,
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <ThemedText style={{ color: Colors[colorScheme].background }}>
          {isSaving ? '保存中...' : '保存'}
        </ThemedText>
      </Pressable>

      {isEdit ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <ThemedText style={styles.deleteText}>この口座を削除</ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 24,
  },
  disabled: {
    opacity: 0.7,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    color: '#E5484D', // 削除の警告色(status: critical相当)
  },
});
