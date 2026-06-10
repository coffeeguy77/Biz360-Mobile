import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ScoreBarProps {
  label: string;
  score: number;
  max?: number;
  color?: string;
}

export function ScoreBar({ label, score, max = 5, color = '#3B82F6' }: ScoreBarProps) {
  const pct = Math.min(1, score / max);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.score, { color }]}>{score}/{max}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:     { fontSize: 11, color: '#8B9CB8', fontFamily: 'Inter_400Regular' },
  score:     { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  track:     { height: 4, backgroundColor: '#1E3A5C', borderRadius: 2, overflow: 'hidden' },
  fill:      { height: 4, borderRadius: 2 },
});
