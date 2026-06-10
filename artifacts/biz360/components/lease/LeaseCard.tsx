import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lease, AnalysisStatus } from '@/context/leaseTypes';
import { useColors } from '@/hooks/useColors';

interface LeaseCardProps {
  lease: Lease;
  onPress: () => void;
  onDelete: () => void;
}

const STATUS_CONFIG: Record<AnalysisStatus, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#6B7280', icon: 'clock' },
  analysing: { label: 'Analysing', color: '#F59E0B', icon: 'loader' },
  complete:  { label: 'Complete',  color: '#16A34A', icon: 'check-circle' },
  failed:    { label: 'Failed',    color: '#EF4444', icon: 'alert-circle' },
};

export function LeaseCard({ lease, onPress, onDelete }: LeaseCardProps) {
  const colors = useColors();
  const st = STATUS_CONFIG[lease.status];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.left}>
        <View style={[styles.icon, { backgroundColor: '#1E3A5C' }]}>
          <Feather name="file-text" size={18} color="#3B82F6" />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{lease.name}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {new Date(lease.uploadDate).toLocaleDateString('en-AU')}
            {lease.jurisdiction ? ` · ${lease.jurisdiction}` : ''}
            {lease.clauseCount ? ` · ${lease.clauseCount} clauses` : ''}
          </Text>
          <View style={styles.statusRow}>
            <Feather name={st.icon as any} size={12} color={st.color} />
            <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="trash-2" size={16} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:      { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  left:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info:      { flex: 1, gap: 2 },
  name:      { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  meta:      { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status:    { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
