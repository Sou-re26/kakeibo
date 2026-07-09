import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORIES, Category, INCOME_CATEGORIES, Subcategory } from '@/constants/categories';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function CategoryScreen() {
  const { draft, updateDraft } = useTransactionDraft();
  const categories = draft.type === '収入' ? INCOME_CATEGORIES : CATEGORIES;
  const [selectedMain, setSelectedMain] = useState<Category | null>(null);

  // 下書きへ書き込んで back で戻る(replace だと detail が新インスタンスになり入力が消える)
  // サブカテゴリを持つカテゴリは小カテゴリ選択へ、持たない(収入等)ものはタップで即確定
  const handleSelectMain = (cat: Category) => {
    if (cat.subcategories.length === 0) {
      updateDraft({ categoryKey: cat.key, subcategoryKey: null });
      router.back();
      return;
    }
    setSelectedMain(cat);
  };

  const handleSelectSub = (sub: Subcategory) => {
    if (!selectedMain) return;
    updateDraft({ categoryKey: selectedMain.key, subcategoryKey: sub.key });
    router.back();
  };

  // 小カテゴリ一覧の表示
  if (selectedMain) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedMain(null)}>
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            {selectedMain.label}
          </ThemedText>
        </View>

        {selectedMain.subcategories.map((sub) => (
          <Pressable key={sub.key} style={styles.row} onPress={() => handleSelectSub(sub)}>
            <ThemedText style={styles.rowText}>{sub.label}</ThemedText>
          </Pressable>
        ))}
      </ThemedView>
    );
  }

  // 大カテゴリ一覧の表示
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={styles.backIcon}>←</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          カテゴリの選択
        </ThemedText>
      </View>

      {categories.map((cat) => (
        <Pressable key={cat.key} style={styles.row} onPress={() => handleSelectMain(cat)}>
          <ThemedText style={styles.icon}>{cat.icon}</ThemedText>
          <View style={styles.rowTextArea}>
            <ThemedText style={styles.rowTitle}>{cat.label}</ThemedText>
            {cat.subcategories.length > 0 ? (
              <ThemedText style={styles.rowSubtitle} numberOfLines={1}>
                {cat.subcategories.map((sub) => sub.label).join('、')}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={styles.chevron}>›</ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  backIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  icon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  rowTextArea: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  chevron: {
    fontSize: 20,
    color: '#888',
  },
  rowText: {
    fontSize: 16,
  },
});