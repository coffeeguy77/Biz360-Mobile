import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clause } from '@/context/leaseTypes';
import { useColors } from '@/hooks/useColors';
import { RiskBadge, RatingBadge } from './RiskBadge';
import { ScoreBar } from './ScoreBar';

interface ClauseCardProps {
  clause: Clause;
  onPress?: () => void;
}

export function ClauseCard({ clause, onPress }: ClauseCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const borderColor = clause.riskLevel === 'critical' ? '#7F1D1D'
    : clause.riskLevel === 'high' ? '#78350F'
    : clause.rating === 'tenant-friendly' ? '#14532D'
    : '#1E3A5C';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor }]}
      onPress={onPress ?? (() => setExpanded(e => !e))}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{clause.title}</Text>
          <Text style={[styles.category, { color: colors.mutedForeground }]}>{clause.category}</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </View>

      <View style={styles.badges}>
        <RiskBadge level={clause.riskLevel} small />
        <RatingBadge rating={clause.rating} small />
      </View>

      <Text style={[styles.plain, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 2}>
        {clause.plainEnglish}
      </Text>

      {expanded && (
        <View style={styles.detail}>
          <ScoreBar label="Café Relevance" score={clause.cafeRelevanceScore} color="#3B82F6" />
          <ScoreBar label="Negotiation Priority" score={clause.negotiationScore} color="#F59E0B" />

          {clause.originalText ? (
            <View>
              <Text style={styles.detailLabel}>Original Text</Text>
              <View style={[styles.quoteBox, { backgroundColor: '#0F1F35' }]}>
                <Text style={styles.quoteText}>{clause.originalText}</Text>
              </View>
            </View>
          ) : null}

          {clause.suggestedText ? (
            <View>
              <Text style={[styles.detailLabel, { color: '#86EFAC' }]}>Suggested Improvement</Text>
              <View style={[styles.quoteBox, { backgroundColor: '#052e16' }]}>
                <Text style={[styles.quoteText, { color: '#86EFAC' }]}>{clause.suggestedText}</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:        { borderRadius: 14, padding: 14, borderWidth: 1, borderLeftWidth: 3, gap: 10 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerLeft:  { flex: 1, gap: 2 },
  title:       { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  category:    { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badges:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  plain:       { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#8B9CB8', lineHeight: 18 },
  detail:      { gap: 12, paddingTop: 4 },
  detailLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#8B9CB8', marginBottom: 4 },
  quoteBox:    { borderRadius: 8, padding: 10 },
  quoteText:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#8B9CB8', lineHeight: 16 },
});
