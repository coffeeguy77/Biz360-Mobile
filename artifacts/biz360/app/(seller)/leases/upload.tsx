import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { Clause, Lease } from "@/context/leaseTypes";

const API_BASE = (() => { try { const d = (global as any).__replit_dev_domain; return d ? `https://${d}` : ""; } catch { return ""; } })();

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function UploadLease() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLease, updateLease, addClause } = useLease();
  const [status, setStatus] = useState<"idle" | "uploading" | "analysing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length) {
        setSelectedFile({
          name: result.assets[0].name,
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType ?? undefined,
        });
        setStatus("idle");
        setErrorMsg("");
      }
    } catch {
      Alert.alert("Error", "Could not open document picker.");
    }
  };

  const analyse = async () => {
    if (!selectedFile) return;
    if (!API_BASE) {
      Alert.alert("Not available", "Cannot connect to the server in this environment.");
      return;
    }

    const leaseId = genId();
    const isPdf = selectedFile.name.toLowerCase().endsWith(".pdf") || selectedFile.mimeType === "application/pdf";
    const fileType = isPdf ? "pdf" : "docx";

    const newLease: Lease = {
      id: leaseId,
      name: selectedFile.name.replace(/\.[^.]+$/, ""),
      uploadDate: new Date().toISOString(),
      status: "analysing",
      fileType,
    };
    await addLease(newLease);

    setStatus("uploading");
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const res = await fetch(selectedFile.uri);
        const blob = await res.blob();
        formData.append("file", blob, selectedFile.name);
      } else {
        formData.append("file", {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.mimeType ?? (isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        } as any);
      }

      setStatus("analysing");

      const response = await fetch(`${API_BASE}/api/lease-analysis`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errBody?.error ?? `HTTP ${response.status}`);
      }

      const data = await response.json() as {
        jurisdiction?: string;
        leaseType?: string;
        parties?: { tenant?: string; landlord?: string };
        premises?: string;
        term?: string;
        rentAmount?: string;
        clauses?: Array<{
          title: string;
          category: string;
          rating: string;
          riskLevel: string;
          plainEnglish: string;
          originalText: string;
          suggestedText?: string;
          cafeRelevanceScore: number;
          negotiationScore: number;
        }>;
      };

      const clauseIds: string[] = [];
      if (data.clauses?.length) {
        for (const c of data.clauses) {
          const id = genId();
          clauseIds.push(id);
          await addClause({
            id,
            title: c.title ?? "Untitled Clause",
            category: c.category ?? "Other",
            rating: (c.rating as Clause["rating"]) ?? "balanced",
            riskLevel: (c.riskLevel as Clause["riskLevel"]) ?? "medium",
            plainEnglish: c.plainEnglish ?? "",
            originalText: c.originalText ?? "",
            suggestedText: c.suggestedText,
            jurisdictions: data.jurisdiction ? [data.jurisdiction as Clause["jurisdictions"][0]] : [],
            cafeRelevanceScore: c.cafeRelevanceScore ?? 3,
            negotiationScore: c.negotiationScore ?? 3,
            sourceLeaseId: leaseId,
            isSeed: false,
          } as Clause);
        }
      }

      await updateLease(leaseId, {
        status: "complete",
        jurisdiction: data.jurisdiction as Lease["jurisdiction"],
        leaseType: data.leaseType as Lease["leaseType"],
        parties: data.parties,
        premises: data.premises,
        term: data.term,
        rentAmount: data.rentAmount,
        clauseCount: clauseIds.length,
        extractedClauseIds: clauseIds,
      });

      setStatus("done");
      setTimeout(() => {
        router.push(`/lease-detail/${leaseId}` as any);
      }, 1000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setErrorMsg(msg);
      setStatus("error");
      await updateLease(leaseId, { status: "failed" });
    }
  };

  const isLoading = status === "uploading" || status === "analysing";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Upload Lease</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>PDF or DOCX · Max 20MB</Text>
          </View>
        </View>

        {/* Drop zone */}
        <TouchableOpacity
          style={[
            styles.dropZone,
            { borderColor: selectedFile ? "#3B82F6" : colors.border, backgroundColor: selectedFile ? "#1E3A5C" : colors.card },
          ]}
          onPress={pickDocument}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Feather
            name={selectedFile ? "file-text" : "upload-cloud"}
            size={40}
            color={selectedFile ? "#3B82F6" : colors.mutedForeground}
          />
          {selectedFile ? (
            <>
              <Text style={[styles.dropFileName, { color: "#3B82F6" }]}>{selectedFile.name}</Text>
              <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>Tap to change file</Text>
            </>
          ) : (
            <>
              <Text style={[styles.dropTitle, { color: colors.foreground }]}>Choose Lease Document</Text>
              <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>PDF or Word document</Text>
            </>
          )}
        </TouchableOpacity>

        {/* What AI analyses */}
        <View style={[styles.infoCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <Text style={styles.infoTitle}>What the AI analyses</Text>
          {[
            "Rent, outgoings, CPI escalation terms",
            "Lease options and renewal rights",
            "Exclusivity and permitted use restrictions",
            "Make-good and handback obligations",
            "Assignment and subletting rights",
            "Landlord's works and disruption clauses",
            "Special conditions and red flags",
          ].map(item => (
            <View key={item} style={styles.infoRow}>
              <Feather name="check" size={12} color="#16A34A" />
              <Text style={[styles.infoText, { color: "#8B9CB8" }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Status messages */}
        {status === "uploading" && (
          <View style={[styles.statusCard, { backgroundColor: "#1E3A5C" }]}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={[styles.statusText, { color: "#93C5FD" }]}>Uploading document…</Text>
          </View>
        )}
        {status === "analysing" && (
          <View style={[styles.statusCard, { backgroundColor: "#1E3A5C" }]}>
            <ActivityIndicator color="#F59E0B" />
            <Text style={[styles.statusText, { color: "#FCD34D" }]}>AI is analysing your lease…</Text>
            <Text style={[styles.statusSub, { color: "#8B9CB8" }]}>This usually takes 20–40 seconds</Text>
          </View>
        )}
        {status === "done" && (
          <View style={[styles.statusCard, { backgroundColor: "#052E16" }]}>
            <Feather name="check-circle" size={22} color="#16A34A" />
            <Text style={[styles.statusText, { color: "#86EFAC" }]}>Analysis complete! Opening results…</Text>
          </View>
        )}
        {status === "error" && (
          <View style={[styles.statusCard, { backgroundColor: "#7F1D1D" }]}>
            <Feather name="alert-circle" size={22} color="#FCA5A5" />
            <Text style={[styles.statusText, { color: "#FCA5A5" }]}>Analysis failed</Text>
            <Text style={[styles.statusSub, { color: "#FCA5A5" }]}>{errorMsg}</Text>
          </View>
        )}

        {/* Analyse button */}
        <TouchableOpacity
          style={[
            styles.analyseBtn,
            { backgroundColor: selectedFile && !isLoading ? "#2563EB" : "#1E3A5C" },
          ]}
          onPress={analyse}
          disabled={!selectedFile || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="cpu" size={18} color={selectedFile ? "#fff" : "#6B7280"} />
              <Text style={[styles.analyseBtnText, { color: selectedFile ? "#fff" : "#6B7280" }]}>
                Analyse with AI
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Your lease is processed securely and not stored on our servers. Always seek independent legal advice.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 16 },
  headerRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:         { padding: 4 },
  title:           { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:             { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dropZone:        { borderRadius: 16, borderWidth: 2, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 10 },
  dropFileName:    { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  dropTitle:       { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  dropSub:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoCard:        { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  infoTitle:       { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 2 },
  infoRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText:        { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  statusCard:      { borderRadius: 14, padding: 16, alignItems: "center", gap: 8 },
  statusText:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusSub:       { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  analyseBtn:      { borderRadius: 14, padding: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  analyseBtnText:  { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  disclaimer:      { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
});
