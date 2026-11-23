import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { fetchSwaps, type IngredientSwap } from '@/services/recommendations';

export default function SwapsScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [swaps, setSwaps] = useState<IngredientSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSwaps([]);
    setLoading(true);
    setError(null);
    fetchSwaps(query, controller.signal)
      .then((results) => {
        if (!controller.signal.aborted) setSwaps(results);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load ingredient substitutions.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const search = () => setQuery(searchText.trim());
  const clearSearch = () => {
    setSearchText('');
    setQuery('');
  };

  const openSource = async (swap: IngredientSwap) => {
    if (!/^https:\/\//i.test(swap.source_url)) {
      setSourceError('This substitution does not have a valid source URL.');
      return;
    }
    try {
      await Linking.openURL(swap.source_url);
      setSourceError(null);
    } catch {
      setSourceError('Could not open the substitution source.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">Ingredient swaps</Text>
      <Text style={styles.intro}>
        Browse sourced substitution ideas or search by the ingredient you want to replace.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search substitutions by ingredient"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={search}
          placeholder="e.g. eggs, buttermilk, soy sauce"
          placeholderTextColor={Colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search swaps"
          onPress={search}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
          <Ionicons name="search" size={18} color="#FFFFFF" />
        </Pressable>
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear swap search"
            onPress={clearSearch}
            style={styles.clearButton}>
            <Ionicons name="close-circle" size={22} color={Colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
        <Text style={styles.noticeText}>
          These are sourced suggestions, not guaranteed replacements. Check the source’s use notes and product labels.
          Allergen notes reflect the supplied data and are not a safety guarantee.
        </Text>
      </View>

      {loading && <Text style={styles.status}>Loading substitutions…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {sourceError && <Text style={styles.error}>{sourceError}</Text>}
      {!loading && !error && swaps.length === 0 && (
        <Text style={styles.status}>
          {query ? `No sourced substitutions found for “${query}”.` : 'No sourced substitutions are available.'}
        </Text>
      )}

      {swaps.map((swap, index) => (
        <View key={`${swap.ingredient}-${index}`} style={styles.card}>
          <Text style={styles.cardTitle}>Replace {swap.ingredient}</Text>
          <Text style={styles.detail}>
            Applies to: {swap.applies_to.join(', ')}
          </Text>
          <Text style={styles.substitute}>{swap.substitute}</Text>
          <Text style={styles.detail}>Use when: {swap.use_when}</Text>
          <View style={styles.allergenNote}>
            <Text style={styles.allergenLabel}>Substitute allergen note</Text>
            <Text style={styles.detail}>{swap.substitute_contains}</Text>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open source: ${swap.source_name}`}
            onPress={() => {
              void openSource(swap);
            }}
            style={({ pressed }) => [styles.sourceButton, pressed && styles.sourcePressed]}>
            <Text style={styles.sourceText}>{swap.source_name}</Text>
            <Ionicons name="open-outline" size={16} color={Colors.accent} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    letterSpacing: -0.5,
    color: Colors.ink,
  },
  intro: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.muted,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.ink,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: Colors.accentPressed,
  },
  clearButton: {
    width: 26,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: Colors.successSoft,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.ink,
  },
  status: {
    paddingVertical: 16,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
  },
  error: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.accent,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  substitute: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.ink,
  },
  detail: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.muted,
  },
  allergenNote: {
    borderRadius: 12,
    backgroundColor: Colors.background,
    padding: 10,
    gap: 4,
  },
  allergenLabel: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.ink,
  },
  sourceButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  sourcePressed: {
    opacity: 0.7,
  },
  sourceText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.accent,
  },
});
