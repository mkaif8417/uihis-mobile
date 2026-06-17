// import Footer from "@/components/Footer";
import Header from "@/components/Header";
import useFarmer from "@/components/context/FarmerContext";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert,
    Animated,
    Image, Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type ComponentItem = {
    appl_reg_no: string;
    comp: string;
    compn: string;
    land_area: number;
};

type DocumentControl = {
    document_name: string;
    fileId: string;
    file_Upload_Timimgs: string | null;
    type1: string;
    canUploadFile: boolean;
    isDisabled: boolean;
    gpslat: string | null;
    gpslong: string | null;
};

type DocsResponse = {
    applicantname: string;
    controls: DocumentControl[];
    data: ComponentItem[];
    finYear: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KON = "34";
const MAX_FILE_SIZE = 512000;
// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSchemeLabel(compn: string): string {
    if (compn.startsWith("NHM") || compn.startsWith("56")) return "NHM (MIDH)";
    if (compn.startsWith("IHD") || compn.startsWith("E2")) return "IHD";
    const match = compn.match(/^([A-Z\-()/ ]+)/);
    return match ? match[1].trim() : compn.slice(0, 20);
}
function isUploaded(control: DocumentControl): boolean {
    return !!(
        control.file_Upload_Timimgs &&
        control.file_Upload_Timimgs.trim() !== ""
    );
}
function getMaxSize(type1: string): number {
    const match = type1.match(/(\d+)\s*KB/i);
    return match ? parseInt(match[1]) * 1024 : 512000;
}


// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadDocs() {
    const { farmer } = useFarmer();

    const [regNo, setRegNo] = useState<string>("");
    const [components, setComponents] = useState<ComponentItem[]>([]);
    const [selectedComp, setSelectedComp] = useState<ComponentItem | null>(null);
    const [compDropdownOpen, setCompDropdownOpen] = useState(false);

    const [docs, setDocs] = useState<DocumentControl[]>([]);
    const [applicantName, setApplicantName] = useState<string>("");
    const [finYear, setFinYear] = useState<string>("");

    const [currentDocIndex, setCurrentDocIndex] = useState<number>(0);

    const [loadingReg, setLoadingReg] = useState(true);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [errorReg, setErrorReg] = useState("");
    const [errorDocs, setErrorDocs] = useState("");

    const [selectedFile, setSelectedFile] = useState<{
        uri: string;
        name: string;
        mimeType?: string;
        size?: number;
        rawFile?: File;
    } | null>(null);

    const [uploading, setUploading] = useState(false);

    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ uri: string; mimeType?: string } | null>(null);

    // ── Animation for count badge ─────────────────────────────────────────────
    const countAnim = useRef(new Animated.Value(1)).current;

    // ── Derived state (no extra useState needed) ───────────────────────────────
    // Pending docs = those NOT yet uploaded on the server
    const pendingDocs = docs.filter(doc => !isUploaded(doc));
    const totalDocs = docs.length;
    const uploadedCount = docs.filter(isUploaded).length; // always from server data

    // ✅ FIX: Derive allDone from docs, not a separate state
    const allDone = totalDocs > 0 && pendingDocs.length === 0;

    // ✅ FIX: Safe index — never goes out of bounds if pendingDocs shrinks
    const safeDocIndex = Math.min(currentDocIndex, Math.max(0, pendingDocs.length - 1));
    const currentDoc = pendingDocs.length > 0 ? pendingDocs[safeDocIndex] : null;

    const isImage = currentDoc?.type1?.toLowerCase().includes("image");

    // ── Reset when docs change ─────────────────────────────────────────────────
    useEffect(() => {
        setCurrentDocIndex(0);
        setSelectedFile(null);
    }, [docs]);

    // ── Animate count badge on upload ──────────────────────────────────────────
   const animateBadge = () => {
    countAnim.setValue(1.4);
    Animated.spring(countAnim, {
        toValue: 1,
        friction: 4,
        
        useNativeDriver: Platform.OS !== "web", // ✅ false on web, true on mobile
    }).start();
};

    // ── Step 1: Fetch registration info ───────────────────────────────────────
    useEffect(() => {
        const fetchReg = async () => {
            setLoadingReg(true);
            setErrorReg("");
            try {
                const res = await fetch(
                    `https://localhost:7065/api/UIHis/getbeneficiarydetailsmob?kon=${KON}&mobileno=${farmer.mobile_no}&year=26`,
               

                    { headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" } }
                );
                if (!res.ok) throw new Error("Server error");
                const result = await res.json();
                if (!Array.isArray(result) || result.length === 0) {
                    setErrorReg("No registration data found.");
                    return;
                }
                setRegNo(result[0].appl_reg_no);
            } catch {
                setErrorReg("Failed to fetch registration info.");
            } finally {
                setLoadingReg(false);
            }
        };
        fetchReg();
    }, [farmer.mobile_no]);

    // ── Step 2: Fetch component list ──────────────────────────────────────────
    useEffect(() => {
        if (!regNo) return;
        const fetchComponents = async () => {
            try {
                const res = await fetch(
                    `https://localhost:7065/api/UIHis/Hos_Scheme_Scandocs_others_Upload_PL?BenRegNo=${regNo}&kon=${KON}`,
                    // 'https://hortnet.hortharyana.gov.in/UIHortHar-API/api/UIHis/Hos_Scheme_Scandocs_others_Upload_PL?BenRegNo=U250810040128&kon=08'
                    { headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" } }
                );
                if (!res.ok) throw new Error("Server error");
                const result: DocsResponse = await res.json();
                setComponents(result.data ?? []);
                setFinYear(result.finYear ?? "");
                setApplicantName(result.applicantname ?? "");
            } catch {
                // silent — component list failure is non-critical
            }
        };
        fetchComponents();
    }, [regNo]);

    // ── Step 3: Fetch docs for selected component ─────────────────────────────
    const fetchDocs = async (comp: ComponentItem) => {
        setLoadingDocs(true);
        setErrorDocs("");
        setDocs([]);
        setSelectedFile(null);
        try {
            const res = await fetch(
                `https://localhost:7065/api/UIHis/Hos_Scheme_Scandocs_others_Upload_PLch?BenRegNo=${comp.appl_reg_no}&kon=${KON}&comp=${comp.comp}`,
                 //    " https://hortnet.hortharyana.gov.in/UIHortHar-API/api/UIHis/Hos_Scheme_Scandocs_others_Upload_PLch?BenRegNo=U250810040128&kon=08&comp=56020126N"
                { headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" } }
            );
            if (!res.ok) throw new Error("Server error");
            const result: DocsResponse = await res.json();
              console.log("=== RAW API RESPONSE ===");
        console.log(JSON.stringify(result, null, 2));
        console.log("========================");
           
    setDocs(
            (result.controls ?? []).filter(
                doc => doc.fileId !== "Test" && doc.document_name.trim() !== "Test"
            )
        );

        setApplicantName(prev => result.applicantname || prev);
        setFinYear(prev => result.finYear || prev);
    } catch {
        setErrorDocs("Failed to fetch documents. Please try again.");
    } finally {
        setLoadingDocs(false);
    }
};

    const handleSelectComp = (comp: ComponentItem) => {
        setSelectedComp(comp);
        setCompDropdownOpen(false);
        fetchDocs(comp);
    };

    // ── File selection ─────────────────────────────────────────────────────────
   const handleSelectFile = async () => {
    if (!currentDoc) return;
    const isImageDoc = currentDoc.type1?.toLowerCase().includes("image");
    const maxSize = getMaxSize(currentDoc.type1 ?? "");

    if (isImageDoc) {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permission Denied", "Allow access to your gallery to select images.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });

        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const rawFile = (asset as any).file as File | undefined;
        const imageSize = rawFile?.size ?? asset.fileSize ?? 0;

        if (imageSize > maxSize) {
            Alert.alert(
                "File Too Large",
                `Selected image is ${(imageSize / 1024).toFixed(0)} KB.\nMaximum allowed size is ${maxSize / 1024} KB.`
            );
            return;
        }

        setSelectedFile({
            uri: asset.uri,
            name: asset.fileName ?? `image_${currentDoc.fileId}.jpg`,
            mimeType: asset.mimeType ?? "image/jpeg",
            size: imageSize,
            rawFile,
        });

    } else {
        const result = await DocumentPicker.getDocumentAsync({
            type: "*/*",
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets[0]) return;

            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            const rawFile = (asset as any).file as File | undefined;
            const pdfSize = rawFile?.size ?? asset.size ?? 0;

            if (pdfSize > MAX_FILE_SIZE) {
                Alert.alert(
                    "File Too Large",
                    `${asset.name} is ${(pdfSize / 1024 / 1024).toFixed(2)} MB.\nMaximum allowed size is 1 MB.`
                );
                return;
            }

            setSelectedFile({
                uri: asset.uri,
                name: asset.name,
                mimeType: asset.mimeType ?? "application/pdf",
                size: pdfSize,
                rawFile,
            });
        }
    };

    // ── Preview ───────────────────────────────────────────────────────────────
    const handlePreview = async () => {
        if (!selectedFile || !currentDoc) return;
        const isImageFile =
            currentDoc.type1?.toLowerCase().includes("image") ||
            selectedFile.mimeType?.startsWith("image/");

        if (isImageFile) {
            setPreviewFile({ uri: selectedFile.uri, mimeType: selectedFile.mimeType });
            setPreviewVisible(true);
        } else {
            await WebBrowser.openBrowserAsync(selectedFile.uri);
        }
    };

    // ── Upload current doc, then advance ──────────────────────────────────────
const handleUpload = async () => {
    if (!selectedFile || !currentDoc || !selectedComp) return;
 console.log("selectedFile:", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        mimeType: selectedFile.mimeType,
        size: selectedFile.size,
        rawFile: selectedFile.rawFile,  // is this undefined?
    });
    // ✅ Platform check — no manual removal needed later
    if (Platform.OS === "web" && !selectedFile.rawFile) {
        Alert.alert("Error", "No raw file available — please re-select the file.");
        return;
    }

    let ipAddress = "0.0.0.0";
    try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        ipAddress = ipData.ip ?? "0.0.0.0";
    } catch { }

    setUploading(true);

    try {
        const formData = new FormData();

if (Platform.OS === "web") {
    // rawFile is confirmed available on web
    formData.append("files", selectedFile.rawFile!, selectedFile.name);
} else {
    formData.append("files", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType ?? "application/octet-stream",
    } as any);
}

        formData.append("fileIds", currentDoc.fileId);
        formData.append("regno", selectedComp.appl_reg_no);
        formData.append("statecd", KON);
        formData.append("dcomp", selectedComp.comp);
        formData.append("kon", KON);
        formData.append("latitude", currentDoc.gpslat ?? "0");
        formData.append("longitude", currentDoc.gpslong ?? "0");
        formData.append("ipaddress", ipAddress);
//  console.log("=== FormData being sent ===");
//         for (let [key, value] of formData.entries()) {
//             console.log(key, "→", value);
//         }
        console.log("===========================");
        const res = await fetch(
            "https://localhost:7065/api/UIHis/Hos_Scheme_Scandocs_others_Upload_uploadAllDocumentsll",
            {
                method: "POST",
                body: formData,
                headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" },
            }
        );

       const result = await res.json().catch(() => ({}));
const message = result?.message || result?.Message || "";

// ✅ Check message FIRST, before checking res.ok
const success =
    typeof message === "string" &&
    (message.toLowerCase().includes("upload sucess") ||
        message.toLowerCase().includes("upload success"));

if (!success) throw new Error(message || `Server error: ${res.status}`);

        setSelectedFile(null);
        setCurrentDocIndex(0);
        animateBadge();
        await fetchDocs(selectedComp);

    } catch (err: any) {
        Alert.alert("Upload Failed", err.message || "Please try again.");
    } finally {
        setUploading(false);
    }
};
    // ── Navigation ────────────────────────────────────────────────────────────
    const handleSkip = () => {
        if (safeDocIndex < pendingDocs.length - 1) {
            setCurrentDocIndex(i => i + 1);
            setSelectedFile(null);
        }
    };

    const handlePrev = () => {
        if (safeDocIndex > 0) {
            setCurrentDocIndex(i => i - 1);
            setSelectedFile(null);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safeArea}>
            <Header />

            {/* Image Preview Modal */}
            <Modal
                visible={previewVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.modalClose} onPress={() => setPreviewVisible(false)}>
                        <Text style={styles.modalCloseText}>✕  Close</Text>
                    </Pressable>
                    {previewFile && (
                        <Image
                            source={{ uri: previewFile.uri }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

            <ScrollView contentContainerStyle={styles.container}>

                {/* Title Bar */}
                <View style={styles.titleBar}>
                    <Text style={styles.titleText}>Upload Documents</Text>
                </View>

                {/* Registration Info Card */}
                <View style={styles.regCard}>
                    {loadingReg ? (
                        <ActivityIndicator color="#fff" />
                    ) : errorReg ? (
                        <Text style={styles.regError}>{errorReg}</Text>
                    ) : (
                        <>
                            <View style={styles.regRow}>
                                <Text style={styles.regLabel}>Applicant Name</Text>
                                <Text style={styles.regValue}>{applicantName || farmer.applicant_name || "—"}</Text>
                            </View>
                            <View style={styles.dividerLine} />
                            <View style={styles.regRow}>
                                <Text style={styles.regLabel}>Application Reg. No.</Text>
                                <View style={styles.regNoBox}>
                                    <Text style={styles.regNoText}>{regNo || "—"}</Text>
                                </View>
                            </View>
                            {finYear ? (
                                <>
                                    <View style={styles.dividerLine} />
                                    <View style={styles.regRow}>
                                        <Text style={styles.regLabel}>Financial Year</Text>
                                        <Text style={styles.regValue}>{finYear}</Text>
                                    </View>
                                </>
                            ) : null}
                        </>
                    )}
                </View>

                {/* ── Component Selector ── */}
                {!loadingReg && !errorReg && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Component / Scheme</Text>
                        <TouchableOpacity
                            style={styles.dropdownTrigger}
                            onPress={() => setCompDropdownOpen(p => !p)}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[styles.dropdownTriggerText, !selectedComp && { color: "#9e9e9e" }]}
                                numberOfLines={2}
                            >
                                {selectedComp
                                    ? `${getSchemeLabel(selectedComp.compn)} — ${selectedComp.compn}`
                                    : "— Select a component —"}
                            </Text>
                            <Text style={styles.dropdownChevron}>{compDropdownOpen ? "▲" : "▼"}</Text>
                        </TouchableOpacity>

                        {compDropdownOpen && (
                            <View style={styles.dropdownList}>
                                {components.length === 0 ? (
                                    <Text style={styles.dropdownEmpty}>No components available</Text>
                                ) : (
                                    components.map((comp, idx) => {
                                        const isSelected = selectedComp?.comp === comp.comp;
                                        return (
                                            <TouchableOpacity
                                                key={comp.comp}
                                                style={[
                                                    styles.dropdownItem,
                                                    idx < components.length - 1 && styles.dropdownItemBorder,
                                                    isSelected && styles.dropdownItemSelected,
                                                ]}
                                                onPress={() => handleSelectComp(comp)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.dropdownItemLeft}>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                        <View style={{
                                                            width: 10, height: 10, borderRadius: 5,
                                                            backgroundColor: isSelected ? "#20ae0b" : "#aed581"
                                                        }} />
                                                        <View style={styles.schemeBadge}>
                                                            <Text style={styles.schemeBadgeText}>{getSchemeLabel(comp.compn)}</Text>
                                                        </View>
                                                    </View>
                                                    <Text
                                                        style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}
                                                        numberOfLines={3}
                                                    >
                                                        {comp.compn}
                                                    </Text>
                                                </View>
                                                <Text style={styles.dropdownItemArea}>
                                                    {comp.land_area} {comp.land_area === 1 ? "Acre" : "Acres"}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* ── Documents Section ── */}
                {selectedComp && (
                    <View style={styles.section}>

                        {loadingDocs ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator color="#33691e" size="large" />
                                <Text style={styles.loadingText}>Fetching documents…</Text>
                            </View>
                        ) : errorDocs ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{errorDocs}</Text>
                                <Pressable style={styles.retryBtn} onPress={() => fetchDocs(selectedComp)}>
                                    <Text style={styles.retryText}>Retry</Text>
                                </Pressable>
                            </View>
                        ) : docs.length === 0 ? (
                            <Text style={styles.emptyText}>No documents found.</Text>
                        ) : allDone ? (
                            /* ── All Done Screen ── */
                            <View style={styles.allDoneCard}>
                                <Text style={styles.allDoneIcon}>✅</Text>
                                <Text style={styles.allDoneTitle}>All Documents Uploaded!</Text>
                                <Text style={styles.allDoneSubtitle}>
                                    {totalDocs} of {totalDocs} documents submitted successfully.
                                </Text>
                                <Pressable
                                    style={styles.refreshBtn}
                                    onPress={() => fetchDocs(selectedComp)}
                                >
                                    <Text style={styles.refreshBtnText}>Refresh Status</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                {/* ── Progress Header ── */}
                                <View style={styles.progressHeader}>
                                    <Text style={styles.sectionTitle}>Required Documents</Text>
                                    {/* ✅ Animated badge — bounces on each successful upload */}
                                    <Animated.View
                                        style={[
                                            styles.progressBadge,
                                            { transform: [{ scale: countAnim }] }
                                        ]}
                                    >
                                        <Text style={styles.progressBadgeText}>
                                            {uploadedCount}/{totalDocs} uploaded
                                        </Text>
                                    </Animated.View>
                                </View>

                                {/* ── Progress Bar ── */}
                                <View style={styles.progressBarTrack}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${(uploadedCount / totalDocs) * 100}%` }
                                        ]}
                                    />
                                </View>

                                {/* ── Progress Percentage Text ── */}
                                <Text style={styles.progressPercent}>
                                    {Math.round((uploadedCount / totalDocs) * 100)}% complete
                                    {pendingDocs.length > 0
                                        ? ` — ${pendingDocs.length} remaining`
                                        : ""}
                                </Text>

                                {/* ── Doc Steps Row ── */}
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.stepsScroll}
                                    contentContainerStyle={styles.stepsContainer}
                                >
                                    {docs.map((doc, idx) => {
                                        const uploaded = isUploaded(doc);
                                        const pendingIdx = pendingDocs.indexOf(doc);
                                        const isCurrent = !uploaded && pendingIdx === safeDocIndex;
                                        return (
                                            <View key={doc.fileId} style={styles.stepItem}>
                                                <View style={[
                                                    styles.stepDot,
                                                    uploaded ? styles.stepDotDone
                                                        : isCurrent ? styles.stepDotActive
                                                            : styles.stepDotPending
                                                ]}>
                                                    {uploaded
                                                        ? <Text style={styles.stepDotText}>✓</Text>
                                                        : <Text style={styles.stepDotText}>{idx + 1}</Text>
                                                    }
                                                </View>
                                                <Text style={[
                                                    styles.stepLabel,
                                                    isCurrent && styles.stepLabelActive
                                                ]} numberOfLines={2}>
                                                    {doc.document_name.trim()}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>

                                {/* ── Current Document Card ── */}
                                {currentDoc && (
                                    <View style={styles.docCard}>
                                        {/* Top strip */}
                                        <View style={styles.docCardHeader}>
                                            <View style={styles.docCardHeaderLeft}>
                                                <View style={styles.docIndexBadge}>
                                                    <Text style={styles.docIndexBadgeText}>
                                                        {docs.indexOf(currentDoc) + 1}
                                                    </Text>
                                                </View>
                                                <Text style={styles.docCardTitle} numberOfLines={2}>
                                                    {currentDoc.document_name.trim()}
                                                </Text>
                                            </View>
                                            <View style={[
                                                styles.docTypePill,
                                                isImage ? styles.docTypePillImage : styles.docTypePillPdf
                                            ]}>
                                                <Text style={styles.docTypePillText}>
                                                    {isImage ? "📷 Image" : "📄 PDF"}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.docCardDivider} />

                                        {/* File size limit notice */}
                                        <View style={styles.fileSizeNotice}>
                                            <Text style={styles.fileSizeNoticeText}>
                                                ⚠️ Maximum file size: 1 MB
                                            </Text>
                                        </View>

                                        {/* Selected file preview row */}
                                        {selectedFile ? (
                                            <View style={styles.selectedFileRow}>
                                                <Text style={styles.selectedFileIcon}>
                                                    {isImage ? "🖼️" : "📄"}
                                                </Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.selectedFileName} numberOfLines={1}>
                                                        {selectedFile.name}
                                                    </Text>
                                                    <Text style={styles.selectedFileSize}>
                                                        {((selectedFile.size ?? 0) / 1024).toFixed(0)} KB
                                                        {selectedFile.size && selectedFile.size > MAX_FILE_SIZE * 0.8
                                                            ? "  ⚠️ Near limit"
                                                            : "  ✓ Within limit"
                                                        }
                                                    </Text>
                                                </View>
                                                <Pressable onPress={() => setSelectedFile(null)}>
                                                    <Text style={styles.clearFileBtn}>✕</Text>
                                                </Pressable>
                                            </View>
                                        ) : (
                                            <View style={styles.noFileRow}>
                                                <Text style={styles.noFileText}>No file selected yet</Text>
                                            </View>
                                        )}

                                        {/* Three action buttons */}
                                        <View style={styles.actionRow}>
                                            {/* Select File */}
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionBtn,
                                                    styles.selectBtn,
                                                    pressed && { opacity: 0.85 },
                                                    !currentDoc.canUploadFile && styles.actionBtnDisabled,
                                                ]}
                                                // disabled={!currentDoc.canUploadFile}
                                                //just bypassing for test purpose remove when comp completed and uncomment that above
                                                disabled={false}
                                                onPress={handleSelectFile}
                                            >
                                                <Text style={styles.actionBtnText}>📁 Select</Text>
                                            </Pressable>

                                            {/* Preview */}
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionBtn,
                                                    styles.previewBtn,
                                                    pressed && { opacity: 0.85 },
                                                    !selectedFile && styles.actionBtnDisabled,
                                                ]}
                                                disabled={!selectedFile}
                                                onPress={handlePreview}
                                            >
                                                <Text style={[
                                                    styles.actionBtnText,
                                                    !selectedFile && styles.actionBtnTextDisabled
                                                ]}>
                                                    👁 Preview
                                                </Text>
                                            </Pressable>

                                            {/* Upload */}
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.actionBtn,
                                                    styles.uploadBtn,
                                                    pressed && { opacity: 0.85 },
                                                    // (!selectedFile || uploading || !currentDoc.canUploadFile) && styles.actionBtnDisabled,
                                                    //just bypassing for test remove when comp completed
                                                  (!selectedFile || uploading) && styles.actionBtnDisabled,
                                                   ]}
                                                
                                                // disabled={!selectedFile || uploading || !currentDoc.canUploadFile}
                                                //just bypassing for test purpose remove when comp completed and uncomment that above
                                                disabled={!selectedFile || uploading}
                                                
                                                onPress={handleUpload}
                                            >
                                                {uploading ? (
                                                    <ActivityIndicator color="#fff" size="small" />
                                                ) : (
                                                    <Text style={[
                                                        styles.actionBtnText,
                                                        (!selectedFile || !currentDoc.canUploadFile) && styles.actionBtnTextDisabled
                                                    ]}>
                                                        ↑ Upload
                                                    </Text>
                                                )}
                                            </Pressable>
                                        </View>

                                        {/* GPS info */}
                                        {currentDoc.gpslat && currentDoc.gpslat !== "0" && (
                                            <Text style={styles.gpsInfo}>
                                                📍 GPS: {currentDoc.gpslat}, {currentDoc.gpslong}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* ── Navigation ── */}
                                <View style={styles.navRow}>
                                    <Pressable
                                        style={[
                                            styles.navBtn,
                                            styles.navBtnOutline,
                                            safeDocIndex === 0 && styles.navBtnDisabled,
                                        ]}
                                        disabled={safeDocIndex === 0}
                                        onPress={handlePrev}
                                    >
                                        <Text style={[
                                            styles.navBtnTextOutline,
                                            safeDocIndex === 0 && styles.navBtnTextDisabled,
                                        ]}>
                                            ◀ Previous
                                        </Text>
                                    </Pressable>

                                    <Text style={styles.docCounter}>
                                        {safeDocIndex + 1} / {pendingDocs.length} pending
                                    </Text>

                                    <Pressable
                                        style={[
                                            styles.navBtn,
                                            styles.navBtnFill,
                                            safeDocIndex === pendingDocs.length - 1 && styles.navBtnDisabled,
                                        ]}
                                        disabled={safeDocIndex === pendingDocs.length - 1}
                                        onPress={handleSkip}
                                    >
                                        <Text style={[
                                            styles.navBtnTextFill,
                                            safeDocIndex === pendingDocs.length - 1 && styles.navBtnTextDisabled,
                                        ]}>
                                            Skip ▶
                                        </Text>
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f4f6f5" },
    container: { paddingBottom: 32 },

    titleBar: { backgroundColor: "#33691e", padding: 14, borderRadius: 15, margin: 12, marginBottom: 0 },
    titleText: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center" },

    regCard: { backgroundColor: "#0a1d40", margin: 12, padding: 16, borderRadius: 10, elevation: 3 },
    regRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    regLabel: { color: "#aed581", fontSize: 13, flex: 1, flexShrink: 1 },
    regValue: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
    regNoBox: { backgroundColor: "#1b5e20", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#7cb342" },
    regNoText: { color: "#fff", fontSize: 15, fontWeight: "bold", letterSpacing: 1 },
    dividerLine: { height: 1, backgroundColor: "#1e3a6e", marginVertical: 6 },
    regError: { color: "#ef9a9a", fontSize: 14 },

    section: { paddingHorizontal: 12, marginTop: 8 },
    sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#1b5e20" },

    dropdownTrigger: { backgroundColor: "#fff", borderRadius: 8, borderLeftWidth: 5, borderLeftColor: "#7cb342", paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 1, marginBottom: 4 },
    dropdownTriggerText: { fontSize: 14, color: "#1b5e20", flex: 1, paddingRight: 8 },
    dropdownChevron: { fontSize: 12, color: "#7cb342" },
    dropdownList: { backgroundColor: "#fff", borderRadius: 8, elevation: 4, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e8f5e9" },
    dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
    dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f8e9" },
    dropdownItemSelected: { backgroundColor: "#f1f8e9" },
    dropdownItemLeft: { flex: 1, paddingRight: 10 },
    dropdownItemText: { fontSize: 13, color: "#33691e", marginTop: 4 },
    dropdownItemTextSelected: { fontWeight: "600" },
    dropdownItemArea: { fontSize: 12, color: "#7cb342", fontWeight: "600" },
    dropdownEmpty: { padding: 16, color: "#9e9e9e", textAlign: "center" },
    schemeBadge: { alignSelf: "flex-start", backgroundColor: "#e8f5e9", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    schemeBadgeText: { fontSize: 11, color: "#2e7d32", fontWeight: "700" },

    loadingBox: { alignItems: "center", paddingVertical: 30, gap: 10 },
    loadingText: { color: "#558b2f", fontSize: 14 },
    errorBox: { backgroundColor: "#ffebee", borderRadius: 8, padding: 16, alignItems: "center" },
    errorText: { color: "#c62828", fontSize: 14, marginBottom: 10, textAlign: "center" },
    retryBtn: { backgroundColor: "#c62828", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
    retryText: { color: "#fff", fontWeight: "bold" },
    emptyText: { color: "#9e9e9e", textAlign: "center", paddingVertical: 20 },

    // Progress header
    progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    progressBadge: { backgroundColor: "#1b5e20", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
    progressBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },

    // Progress bar
    progressBarTrack: { height: 6, backgroundColor: "#c8e6c9", borderRadius: 3, marginBottom: 4, overflow: "hidden" },
    progressBarFill: { height: 6, backgroundColor: "#33691e", borderRadius: 3 },

    // Progress percent text
    progressPercent: { fontSize: 11, color: "#558b2f", marginBottom: 12, textAlign: "right" },

    // Step dots
    stepsScroll: { marginBottom: 14 },
    stepsContainer: { flexDirection: "row", gap: 12, paddingVertical: 4, paddingHorizontal: 2 },
    stepItem: { alignItems: "center", width: 64 },
    stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    stepDotDone: { backgroundColor: "#2e7d32" },
    stepDotActive: { backgroundColor: "#33691e", borderWidth: 2, borderColor: "#aed581" },
    stepDotPending: { backgroundColor: "#e0e0e0" },
    stepDotText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    stepLabel: { fontSize: 9, color: "#757575", textAlign: "center", lineHeight: 12 },
    stepLabelActive: { color: "#1b5e20", fontWeight: "700" },

    // Doc card
    docCard: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", elevation: 2, marginBottom: 12 },
    docCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, gap: 10 },
    docCardHeaderLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 },
    docIndexBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#e8f5e9", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
    docIndexBadgeText: { fontSize: 12, color: "#2e7d32", fontWeight: "700" },
    docCardTitle: { fontSize: 14, color: "#212121", flex: 1, lineHeight: 20, fontWeight: "600" },
    docTypePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
    docTypePillImage: { backgroundColor: "#e3f2fd" },
    docTypePillPdf: { backgroundColor: "#fff3e0" },
    docTypePillText: { fontSize: 11, fontWeight: "600" },
    docCardDivider: { height: 1, backgroundColor: "#f5f5f5", marginHorizontal: 14 },

    // File size notice
    fileSizeNotice: { backgroundColor: "#fff8e1", marginHorizontal: 14, marginTop: 10, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    fileSizeNoticeText: { fontSize: 11, color: "#f57f17" },

    // Selected file row
    selectedFileRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f1f8e9", marginHorizontal: 14, marginTop: 10, borderRadius: 8, padding: 10, gap: 8 },
    selectedFileIcon: { fontSize: 18 },
    selectedFileName: { fontSize: 12, color: "#33691e", fontWeight: "600", flex: 1 },
    selectedFileSize: { fontSize: 11, color: "#558b2f" },
    clearFileBtn: { fontSize: 16, color: "#9e9e9e", paddingHorizontal: 4 },
    noFileRow: { marginHorizontal: 14, marginTop: 10, paddingVertical: 10, alignItems: "center" },
    noFileText: { color: "#bdbdbd", fontSize: 13 },

    gpsInfo: { fontSize: 11, color: "#757575", marginHorizontal: 14, marginTop: 4, marginBottom: 4 },

    // Three action buttons
    actionRow: { flexDirection: "row", gap: 8, marginHorizontal: 14, marginTop: 12, marginBottom: 14 },
    actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    selectBtn: { backgroundColor: "#33691e" },
    previewBtn: { backgroundColor: "#1565c0" },
    uploadBtn: { backgroundColor: "#1b5e20" },
    actionBtnDisabled: { backgroundColor: "#bdbdbd" },
    actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    actionBtnTextDisabled: { color: "#eeeeee" },

    // Navigation
    navRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 8 },
    navBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: "center" },
    navBtnOutline: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#7cb342" },
    navBtnFill: { backgroundColor: "#33691e" },
    navBtnDisabled: { backgroundColor: "#f5f5f5", borderColor: "#e0e0e0" },
    navBtnTextOutline: { color: "#33691e", fontWeight: "bold", fontSize: 13 },
    navBtnTextFill: { color: "#fff", fontWeight: "bold", fontSize: 13 },
    navBtnTextDisabled: { color: "#bdbdbd" },
    docCounter: { fontSize: 12, color: "#757575", textAlign: "center", flex: 1 },

    // All done
    allDoneCard: { backgroundColor: "#fff", borderRadius: 12, padding: 32, alignItems: "center", elevation: 2, gap: 10 },
    allDoneIcon: { fontSize: 52, marginBottom: 4 },
    allDoneTitle: { fontSize: 18, fontWeight: "bold", color: "#1b5e20" },
    allDoneSubtitle: { fontSize: 14, color: "#558b2f", textAlign: "center" },
    refreshBtn: { marginTop: 10, backgroundColor: "#33691e", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
    refreshBtnText: { color: "#fff", fontWeight: "bold" },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
    modalClose: { position: "absolute", top: 50, right: 20, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, zIndex: 10 },
    modalCloseText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    modalImage: { width: "95%", height: "80%" },
});