import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RiskLevel, ClauseRating } from '@/context/leaseTypes';

interface RiskBadgeProps {
  level: RiskLevel;
  small?: boolean;
}
interface RatingBadgeProps {
  rating: ClauseRating;
  small?: boolean;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; color: string }> = {
  critical: { label: 'Critical', bg: '#7F1D1D', color: '#FCA5A5' },
  high:     { label: 'High Risk', bg: '#78350F', color: '#FCD34D' },
  medium:   { label: 'Medium', bg: '#1E3A5C', color: '#93C5FD' },
  low:      { label: 'Low Risk', bg: '#14532D', color: '#86EFAC' },
};

const RATING_CONFIG: Record<ClauseRating, { label: string; bg: string; color: string }> = {
  'tenant-friendly':   { label: 'Tenant-Friendly', bg: '#14532D', color: '#86EFAC' },
  'balanced':          { label: 'Balanced', bg: '#1E3A5C', color: '#93C5FD' },
  'landlord-friendly': { label: 'Landlord-Friendly', bg: '#7F1D1D', color: '#FCA5A5' },
};

export function RiskBadge({ level, small }: RiskBadgeProps) {
  const cfg = RISK_CONFIG[level];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small && styles.small]}>
      <Text style={[styles.label, { color: cfg.color }, small && styles.smallLabel]}>{cfg.label}</Text>
    </View>
  );
}

export function RatingBadge({ rating, small }: RatingBadgeProps) {
  const cfg = RATING_CONFIG[rating];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small && styles.small]}>
      <Text style={[styles.label, { color: cfg.color }, small && styles.smallLabel]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label:      { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  small:      { paddingHorizontal: 6, paddingVertical: 2 },
  smallLabel: { fontSize: 10 },
});
