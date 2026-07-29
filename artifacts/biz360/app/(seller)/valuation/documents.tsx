import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useValuation } from "@/context/ValuationContext";
import { API_BASE } from "@/constants/api";

const DOC_TYPES = [
  { value: "valuation", label: "Valuation Report", icon: "trending-up" },
  { value: "equipment", label: "Equipment List", icon: "tool" },
  { value: "financials", label: "Financial Report", icon: "bar-chart-2" },
  { value: "other", label: "Other Document", icon: "file" },
] as const;

type DocType = (typeof DOC_TYPES)[number]["value"];

interface ListingDoc {
  id: string;
  title: string;
  docType: DocType;
  url: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

type UploadStatus = "idle" | "reading" | "uploading" | "done" | "error";

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function typeConfig(docType: string) {
  return DOC_TYPES.find((d) => d.value === docType) ?? DOC_TYPES[3];
}

export default function DocumentsScreen() {
  const { cafe } = useValuation();
  const listingId = cafe?.listingId ?? "";

  const [docs, setDocs] = useState<ListingDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("valuation");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem("auth_token");
  }

  async function fetchDocs() {
    if (!listingId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/listing-documents/${listingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs ?? []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchDocs(); }, [listingId]);

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setSelectedFile(asset);
      // Pre-fill title from filename (strip extension)
      const name = asset.name.replace(/\.[^.]+$/, "");
      setDocTitle(name);
    } catch (e) {
      Alert.alert("Error", "Could not open file picker");
    }
  }

  async function upload() {
    if (!selectedFile || !docTitle.trim() || !listingId) return;
    setStatus("reading");
    setErrorMsg("");
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setStatus("uploading");
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/listing-documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          listingId,
          title: docTitle.trim(),
          docType,
          data: base64,
          mimeType: selectedFile.mimeType ?? "application/pdf",
          fileSize: selectedFile.size,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      setStatus("done");
      setSelectedFile(null);
      setDocTitle("");
      setDocType("valuation");
      await fetchDocs();
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }

  async function deleteDoc(id: string, title: string) {
    Alert.alert("Delete Document", `Remove "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const token = await getToken();
            await fetch(`${API_BASE}/api/listing-documents/${id}`, {
              method: "DELETE",
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            setDocs((prev) => prev.filter((d) => d.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete document");
          }
        },
      },
    ]);
  }

  const canUpload = selectedFile && docTitle.trim() && status !== "uploading" && status !== "reading";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
      </View>

      {/* Upload card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Attach a Document</Text>
        <Text style={styles.sectionSub}>
          Upload from your device. Buyers will see a "View" link — no download required.
        </Text>

        {/* File picker */}
        <TouchableOpacity style={styles.dropZone} onPress={pickFile}>
          <Feather name="upload" size={22} color="#3b82f6" />
          {selectedFile ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
              {selectedFile.size ? <Text style={styles.fileSize}>{formatBytes(selectedFile.size)}</Text> : null}
            </View>
          ) : (
            <Text style={styles.dropLabel}>Choose PDF, Excel or CSV</Text>
          )}
          {selectedFile && (
            <TouchableOpacity onPress={() => { setSelectedFile(null); setDocTitle(""); }} hitSlop={8}>
              <Feather name="x" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Title */}
        {selectedFile && (
          <View style={{ gap: 10, marginTop: 12 }}>
            <Text style={styles.fieldLabel}>Document title</Text>
            <TextInput
              style={styles.input}
              value={docTitle}
              onChangeText={setDocTitle}
              placeholder="e.g. Valuation Report Feb 2025"
              placeholderTextColor="#475569"
            />

            {/* Type selector */}
            <Text style={styles.fieldLabel}>Document type</Text>
            <View style={styles.typeGrid}>
              {DOC_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, docType === t.value && styles.typeChipActive]}
                  onPress={() => setDocType(t.value)}
                >
                  <Feather name={t.icon as any} size={13} color={docType === t.value ? "#3b82f6" : "#94a3b8"} />
                  <Text style={[styles.typeChipText, docType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Upload button */}
            <TouchableOpacity
              style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
              onPress={upload}
              disabled={!canUpload}
            >
              {status === "reading" || status === "uploading" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : status === "done" ? (
                <><Feather name="check-circle" size={15} color="#fff" /><Text style={styles.uploadBtnText}>Uploaded!</Text></>
              ) : (
                <><Feather name="upload-cloud" size={15} color="#fff" /><Text style={styles.uploadBtnText}>
                  {status === "reading" ? "Reading file…" : "Upload & Generate Link"}
                </Text></>
              )}
            </TouchableOpacity>

            {status === "error" && (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={14} color="#f87171" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Documents list */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Attached Documents</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 12 }} />
        ) : docs.length === 0 ? (
          <Text style={styles.emptyText}>No documents attached yet.</Text>
        ) : (
          docs.map((doc) => {
            const cfg = typeConfig(doc.docType);
            return (
              <View key={doc.id} style={styles.docRow}>
                <View style={styles.docIcon}>
                  <Feather name={cfg.icon as any} size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docMeta}>{cfg.label}{doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => Linking.openURL(doc.url)}
                >
                  <Feather name="external-link" size={13} color="#3b82f6" />
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteDoc(doc.id, doc.title)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Feather name="trash-2" size={15} color="#f87171" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingTop: 60 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f1f5f9" },
  card: { margin: 16, marginBottom: 0, backgroundColor: "#1e293b", borderRadius: 16, padding: 20, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#f1f5f9", marginBottom: 2 },
  sectionSub: { fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 18 },
  dropZone: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: "#334155", borderStyle: "dashed",
    borderRadius: 12, padding: 16, marginTop: 4,
  },
  dropLabel: { color: "#64748b", fontSize: 14, flex: 1 },
  fileName: { color: "#f1f5f9", fontSize: 13, fontWeight: "600" },
  fileSize: { color: "#64748b", fontSize: 11, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155",
    borderRadius: 10, padding: 12, color: "#f1f5f9", fontSize: 14,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0f172a",
  },
  typeChipActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  typeChipText: { fontSize: 12, color: "#94a3b8" },
  typeChipTextActive: { color: "#3b82f6", fontWeight: "600" },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#3b82f6", borderRadius: 12, padding: 14,
  },
  uploadBtnDisabled: { opacity: 0.4 },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#450a0a", borderRadius: 10, padding: 12 },
  errorText: { color: "#f87171", fontSize: 12, flex: 1 },
  emptyText: { color: "#475569", fontSize: 13, marginTop: 8 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#1e293b" },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1e3a5f", alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: 13, fontWeight: "600", color: "#f1f5f9" },
  docMeta: { fontSize: 11, color: "#64748b" },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#1e3a5f", borderRadius: 8 },
  viewBtnText: { color: "#3b82f6", fontSize: 12, fontWeight: "600" },
});
