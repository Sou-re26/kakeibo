import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EMPTY_FILTER, type TransactionFilter } from '@/lib/transaction-filter';

// 値は transactions.type と同じ日本語リテラル(既知の技術的負債に合わせる)
const TYPES = ['支出', '収入', '振替'] as const;

// カテゴリチップの一覧(支出+収入+未分類)。'uncategorized' は categoryKey null の取引
const CATEGORY_CHIPS = [
  ...CATEGORIES.map((cat) => ({ key: cat.key, label: `${cat.icon} ${cat.label}` })),
  ...INCOME_CATEGORIES.map((cat) => ({ key: cat.key, label: `${cat.icon} ${cat.label}` })),
  { key: 'uncategorized', label: '未分類' },
];

// 期間プリセット。end は「その日を含む」上限(lib/transaction-filter.ts の仕様)
const presetRanges = (now: Date) => [
  { label: '今月', start: new Date(now.getFullYear(), now.getMonth(), 1), end: now },
  {
    label: '先月',
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    end: new Date(now.getFullYear(), now.getMonth(), 0),
  },
  { label: '3ヶ月', start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now },
];

type Props = {
  visible: boolean;
  /** 開いた時点の絞り込み条件(フォームの初期値) */
  initial: TransactionFilter;
  accounts: readonly { id: number; name: string }[];
  onClose: () => void;
  onApply: (filter: TransactionFilter) => void;
};

// 履歴の検索(絞り込み)条件を入力するボトムシート
export function TransactionSearchSheet({ visible, initial, accounts, onClose, onApply }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TransactionFilter>(initial);
  // 金額は入力途中の空文字を許すため文字列で持ち、適用時に数値へ変換する
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [iosPickerTarget, setIosPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setMinText(initial.minAmount !== null ? String(initial.minAmount) : '');
      setMaxText(initial.maxAmount !== null ? String(initial.maxAmount) : '');
      setIosPickerTarget(null);
    }
  }, [visible, initial]);

  const update = (patch: Partial<TransactionFilter>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const toggleType = (type: string) =>
    setDraft((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));

  const toggleCategory = (key: string) =>
    setDraft((prev) => ({
      ...prev,
      categoryKeys: prev.categoryKeys.includes(key)
        ? prev.categoryKeys.filter((k) => k !== key)
        : [...prev.categoryKeys, key],
    }));

  const setDate = (target: 'start' | 'end', value: Date | null) =>
    update(target === 'start' ? { startDate: value } : { endDate: value });

  const openDatePicker = (target: 'start' | 'end') => {
    const current = (target === 'start' ? draft.startDate : draft.endDate) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type !== 'set' || !selected) return;
          setDate(target, selected);
        },
      });
    } else if (Platform.OS === 'ios') {
      // iOSには命令的APIがないため、シート内にインラインのピッカーを表示する
      setIosPickerTarget(target);
    }
    // Webは @react-native-community/datetimepicker 非対応のため何もしない(期間プリセットで代用)
  };

  // onChangeText で数字以外を除去しているため、空文字以外は必ず整数
  const parseAmount = (text: string): number | null => (text === '' ? null : Number(text));

  const handleApply = () => {
    onApply({
      ...draft,
      keyword: draft.keyword.trim(),
      minAmount: parseAmount(minText),
      maxAmount: parseAmount(maxText),
    });
    onClose();
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTER);
    setMinText('');
    setMaxText('');
  };

  const formatDate = (d: Date | null) =>
    d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : '指定なし';

  const chipStyle = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? colors.accent : colors.card },
  ];
  const chipTextStyle = (selected: boolean) => [
    styles.chipText,
    { color: selected ? colors.onAccent : colors.text },
  ];

  const accountChips = (target: 'from' | 'to') => {
    const selectedId = target === 'from' ? draft.accountId : draft.toAccountId;
    const select = (id: number | null) =>
      update(target === 'from' ? { accountId: id } : { toAccountId: id });
    return (
      <View style={styles.chipRow}>
        <Pressable style={chipStyle(selectedId === null)} onPress={() => select(null)}>
          <ThemedText style={chipTextStyle(selectedId === null)}>すべて</ThemedText>
        </Pressable>
        {accounts.map((acc) => (
          <Pressable
            key={acc.id}
            style={chipStyle(selectedId === acc.id)}
            onPress={() => select(acc.id)}
          >
            <ThemedText style={chipTextStyle(selectedId === acc.id)}>{acc.name}</ThemedText>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose}>
        {/* 内側のPressableがタッチを受け、シート内タップで閉じるのを防ぐ */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <ThemedText type="subtitle" style={styles.sheetTitle}>
            検索・絞り込み
          </ThemedText>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              種別
            </ThemedText>
            <View style={styles.chipRow}>
              {TYPES.map((type) => {
                const selected = draft.types.includes(type);
                return (
                  <Pressable key={type} style={chipStyle(selected)} onPress={() => toggleType(type)}>
                    <ThemedText style={chipTextStyle(selected)}>{type}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              期間
            </ThemedText>
            <View style={styles.chipRow}>
              {presetRanges(new Date()).map((preset) => (
                <Pressable
                  key={preset.label}
                  style={chipStyle(false)}
                  onPress={() => update({ startDate: preset.start, endDate: preset.end })}
                >
                  <ThemedText style={chipTextStyle(false)}>{preset.label}</ThemedText>
                </Pressable>
              ))}
            </View>
            {(['start', 'end'] as const).map((target) => {
              const value = target === 'start' ? draft.startDate : draft.endDate;
              return (
                <View key={target} style={styles.dateRow}>
                  <ThemedText style={styles.dateLabel}>
                    {target === 'start' ? '開始日' : '終了日'}
                  </ThemedText>
                  <Pressable
                    style={[styles.dateValue, { backgroundColor: colors.card }]}
                    onPress={() => openDatePicker(target)}
                  >
                    <ThemedText style={value ? undefined : styles.dateEmpty}>
                      {formatDate(value)}
                    </ThemedText>
                  </Pressable>
                  {value ? (
                    <Pressable hitSlop={8} onPress={() => setDate(target, null)}>
                      <ThemedText style={{ color: colors.tint }}>クリア</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {iosPickerTarget ? (
              <DateTimePicker
                value={(iosPickerTarget === 'start' ? draft.startDate : draft.endDate) ?? new Date()}
                mode="date"
                display="inline"
                onChange={(event, selected) => {
                  setIosPickerTarget(null);
                  if (event.type === 'set' && selected) {
                    setDate(iosPickerTarget, selected);
                  }
                }}
              />
            ) : null}

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              カテゴリ
            </ThemedText>
            <View style={styles.chipRow}>
              {CATEGORY_CHIPS.map((chip) => {
                const selected = draft.categoryKeys.includes(chip.key);
                return (
                  <Pressable
                    key={chip.key}
                    style={chipStyle(selected)}
                    onPress={() => toggleCategory(chip.key)}
                  >
                    <ThemedText style={chipTextStyle(selected)}>{chip.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              店名・メモ・タグ
            </ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.card }]}
              placeholder="キーワード(部分一致)"
              placeholderTextColor={colors.icon}
              value={draft.keyword}
              onChangeText={(text) => update({ keyword: text })}
            />

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              口座(出金元)
            </ThemedText>
            {accountChips('from')}

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              入金先(振替)
            </ThemedText>
            {accountChips('to')}

            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              金額範囲
            </ThemedText>
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.amountInput, { color: colors.text, backgroundColor: colors.card }]}
                placeholder="下限なし"
                placeholderTextColor={colors.icon}
                keyboardType="number-pad"
                value={minText}
                onChangeText={(text) => setMinText(text.replace(/[^0-9]/g, ''))}
              />
              <ThemedText>〜</ThemedText>
              <TextInput
                style={[styles.amountInput, { color: colors.text, backgroundColor: colors.card }]}
                placeholder="上限なし"
                placeholderTextColor={colors.icon}
                keyboardType="number-pad"
                value={maxText}
                onChangeText={(text) => setMaxText(text.replace(/[^0-9]/g, ''))}
              />
              <ThemedText>円</ThemedText>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.footerButton, styles.clearButton, { borderColor: colors.border }]}
              onPress={handleClear}
            >
              <ThemedText>クリア</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.footerButton, { backgroundColor: colors.accent }]}
              onPress={handleApply}
            >
              <ThemedText type="defaultSemiBold" style={{ color: colors.onAccent }}>
                この条件で絞り込む
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  sheetTitle: {
    marginBottom: 4,
  },
  form: {
    paddingBottom: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 18,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  dateLabel: {
    width: 52,
    fontSize: 14,
  },
  dateValue: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dateEmpty: {
    opacity: 0.5,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
  },
  clearButton: {
    borderWidth: 1,
  },
});
