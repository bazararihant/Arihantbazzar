import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { UserSession } from "../../services/storage";

interface Props {
    currentUser: UserSession;
    onBack: () => void;
}

interface LedgerSummary {
    total_admin_paid: number;
    total_branch_paid: number;
    difference: number;
    settlement_status: "branch_owes_admin" | "admin_owes_branch" | "settled";
    settlement_text: string;
    badge_color: string;
    total_transactions: number;
}

interface TransactionItem {
    id: number;
    franchise_id: number;
    recorded_by_user_id: number;
    transaction_type: "branch_to_admin" | "admin_to_branch";
    amount: string | number;
    payment_mode: "cash" | "upi" | "bank";
    transaction_date: string;
    notes: string | null;
    created_at: string;
    recorded_by_name: string;
    recorded_by_role: string;
    franchise_name: string;
}

const QUICK_NOTES = [
    "दुकान गल्ला जमा",
    "किरकोळ खर्च",
    "गाडी भाडे",
    "घरखर्च",
    "सामान खरेदी",
    "अनामत रक्कम (Advance)",
];

export default function CashLedgerScreen({ currentUser, onBack }: Props) {
    const insets = useSafeAreaInsets();
    const isAdmin = currentUser.role === "admin" || currentUser.role === "sub_admin";

    const [summary, setSummary] = useState<LedgerSummary | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState<"all" | "branch_to_admin" | "admin_to_branch">("all");

    // Modal state for recording new transaction
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [transType, setTransType] = useState<"branch_to_admin" | "admin_to_branch">(
        isAdmin ? "admin_to_branch" : "branch_to_admin"
    );
    const [amountInput, setAmountInput] = useState("");
    const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
    const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
    const [notesInput, setNotesInput] = useState("");

    const loadData = useCallback(async () => {
        try {
            const [summaryRes, transRes] = await Promise.all([
                api.get("/ledger/summary"),
                api.get("/ledger/transactions"),
            ]);

            setSummary(summaryRes.data.summary);
            setTransactions(transRes.data.transactions || []);
        } catch (error: any) {
            console.error("Ledger load error:", error);
            Alert.alert(
                "डेटा लोड अयशस्वी",
                error?.response?.data?.message || "रोख हिशोब लोड करता आला नाही"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleOpenModal = () => {
        setAmountInput("");
        setNotesInput("");
        setDateInput(new Date().toISOString().split("T")[0]);
        setPaymentMode("cash");
        setTransType(isAdmin ? "admin_to_branch" : "branch_to_admin");
        setModalVisible(true);
    };

    const handleCreateTransaction = async () => {
        const num = parseFloat(amountInput.trim());
        if (isNaN(num) || num <= 0) {
            Alert.alert("अवैध रक्कम", "कृपया वैध रक्कम (₹) टाका");
            return;
        }

        setSubmitting(true);
        try {
            await api.post("/ledger/transactions", {
                transaction_type: transType,
                amount: num,
                payment_mode: paymentMode,
                transaction_date: dateInput,
                notes: notesInput.trim(),
            });

            Alert.alert("यशस्वी", "रोख व्यवहार नोंदवला गेला!");
            setModalVisible(false);
            loadData();
        } catch (error: any) {
            console.error("Create transaction error:", error);
            Alert.alert(
                "नोंद अयशस्वी",
                error?.response?.data?.message || "व्यवहार नोंदवता आला नाही"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTransaction = (id: number) => {
        Alert.alert(
            "एन्ट्री काढून टाका",
            "तुम्हाला ही पैशांची नोंद खरोखर काढून टाकायची आहे का?",
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "काढून टाका",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/ledger/transactions/${id}`);
                            loadData();
                        } catch (error: any) {
                            Alert.alert(
                                "त्रुटी",
                                error?.response?.data?.message || "नोंद काढता आली नाही"
                            );
                        }
                    },
                },
            ]
        );
    };

    const filteredTransactions = useMemo(() => {
        if (filterType === "all") return transactions;
        return transactions.filter((t) => t.transaction_type === filterType);
    }, [transactions, filterType]);

    const formatDateDisplay = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("mr-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>← मागे</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        💰 रोख जमा-खर्च हिशोब
                    </Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        अरिहंत बाजार ↔ मुख्य ॲडमिन
                    </Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                    <Text style={styles.refreshBtnText}>🔄</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#16A34A" />
                    <Text style={styles.loadingText}>हिशोब लोड होत आहे...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom + 20, 40) },
                    ]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. BROTHER SETTLEMENT HIGHLIGHT CARD */}
                    <View
                        style={[
                            styles.settlementCard,
                            summary?.settlement_status === "branch_owes_admin" && styles.borderRed,
                            summary?.settlement_status === "admin_owes_branch" && styles.borderBlue,
                            summary?.settlement_status === "settled" && styles.borderGreen,
                        ]}
                    >
                        <View style={styles.settlementHeaderRow}>
                            <Text style={styles.settlementTag}>⚖️ अंतिम बाकी हिशोब (Settlement)</Text>
                            <View
                                style={[
                                    styles.settlementPill,
                                    { backgroundColor: summary?.badge_color || "#16A34A" },
                                ]}
                            >
                                <Text style={styles.settlementPillText}>
                                    {summary?.settlement_status === "branch_owes_admin"
                                        ? "शाखेचे देणे बाकी"
                                        : summary?.settlement_status === "admin_owes_branch"
                                        ? "ॲडमिनचे देणे बाकी"
                                        : "पूर्ण चुकता"}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.settlementBigAmount}>
                            ₹ {summary?.difference.toLocaleString("en-IN") || "0"}
                        </Text>

                        <View style={styles.settlementTextBox}>
                            <Text style={styles.settlementTextDetail}>
                                {summary?.settlement_text}
                            </Text>
                        </View>
                    </View>

                    {/* 2. SUMMARY COUNTERS (Admin vs Branch) */}
                    <View style={styles.summaryGrid}>
                        {/* Admin Gave */}
                        <View style={[styles.summaryBox, styles.adminBox]}>
                            <View style={styles.summaryBoxHeader}>
                                <Text style={styles.summaryBoxIcon}>🟢</Text>
                                <Text style={styles.summaryBoxTitle}>ॲडमिनने दिलेले</Text>
                            </View>
                            <Text style={styles.summaryBoxAmount}>
                                ₹ {summary?.total_admin_paid.toLocaleString("en-IN") || "0"}
                            </Text>
                            <Text style={styles.summaryBoxSub}>Admin Paid to Branch</Text>
                        </View>

                        {/* Branch Gave */}
                        <View style={[styles.summaryBox, styles.branchBox]}>
                            <View style={styles.summaryBoxHeader}>
                                <Text style={styles.summaryBoxIcon}>🔵</Text>
                                <Text style={styles.summaryBoxTitle}>शाखेने दिलेले</Text>
                            </View>
                            <Text style={styles.summaryBoxAmount}>
                                ₹ {summary?.total_branch_paid.toLocaleString("en-IN") || "0"}
                            </Text>
                            <Text style={styles.summaryBoxSub}>Branch Paid to Admin</Text>
                        </View>
                    </View>

                    {/* 3. ADD TRANSACTION ACTION BUTTON */}
                    <TouchableOpacity
                        style={styles.addEntryBtn}
                        onPress={handleOpenModal}
                        activeOpacity={0.88}
                    >
                        <Text style={styles.addEntryBtnIcon}>➕</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addEntryBtnTitle}>नवीन रोख एन्ट्री करा</Text>
                            <Text style={styles.addEntryBtnSub}>
                                पैसे दिले किंवा घेतल्याची त्वरित नोंद करा
                            </Text>
                        </View>
                        <Text style={styles.addEntryBtnArrow}>➔</Text>
                    </TouchableOpacity>

                    {/* 4. FILTER TABS */}
                    <View style={styles.filterSection}>
                        <Text style={styles.sectionTitle}>
                            व्यवहार इतिहास ({filteredTransactions.length})
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    filterType === "all" && styles.filterChipActive,
                                ]}
                                onPress={() => setFilterType("all")}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        filterType === "all" && styles.filterChipTextActive,
                                    ]}
                                >
                                    सर्व व्यवहार ({transactions.length})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    filterType === "branch_to_admin" && styles.filterChipActive,
                                ]}
                                onPress={() => setFilterType("branch_to_admin")}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        filterType === "branch_to_admin" && styles.filterChipTextActive,
                                    ]}
                                >
                                    शाखेने दिलेले (Branch ➔ Admin)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    filterType === "admin_to_branch" && styles.filterChipActive,
                                ]}
                                onPress={() => setFilterType("admin_to_branch")}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        filterType === "admin_to_branch" && styles.filterChipTextActive,
                                    ]}
                                >
                                    ॲडमिनने दिलेले (Admin ➔ Branch)
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    {/* 5. TRANSACTION PASSBOOK LIST */}
                    {filteredTransactions.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📝</Text>
                            <Text style={styles.emptyTitle}>अजून कोणतीही नोंद नाही</Text>
                            <Text style={styles.emptySub}>
                                वर दिलेल्या 'नवीन रोख एन्ट्री करा' बटणावर क्लिक करून पैशांची देवाणघेवाण नोंदवा.
                            </Text>
                        </View>
                    ) : (
                        filteredTransactions.map((item) => {
                            const isBranchToAdmin = item.transaction_type === "branch_to_admin";
                            const numAmount = Number(item.amount);

                            return (
                                <View key={item.id} style={styles.transCard}>
                                    <View style={styles.transCardTop}>
                                        <View
                                            style={[
                                                styles.transIconCircle,
                                                isBranchToAdmin ? styles.bgBlue : styles.bgGreen,
                                            ]}
                                        >
                                            <Text style={styles.transIconText}>
                                                {isBranchToAdmin ? "🔵" : "🟢"}
                                            </Text>
                                        </View>

                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.transTitle}>
                                                {isBranchToAdmin
                                                    ? "शाखेने ॲडमिनला दिले"
                                                    : "ॲडमिनने शाखेला दिले"}
                                            </Text>
                                            <Text style={styles.transDate}>
                                                📅 {formatDateDisplay(item.transaction_date)} •{" "}
                                                {item.payment_mode === "upi" ? "📱 UPI" : "💵 रोख (Cash)"}
                                            </Text>
                                        </View>

                                        <View style={{ alignItems: "flex-end" }}>
                                            <Text
                                                style={[
                                                    styles.transAmount,
                                                    isBranchToAdmin ? styles.textBlue : styles.textGreen,
                                                ]}
                                            >
                                                ₹ {numAmount.toLocaleString("en-IN")}
                                            </Text>
                                        </View>
                                    </View>

                                    {item.notes ? (
                                        <View style={styles.transNotesBox}>
                                            <Text style={styles.transNotesText}>📝 {item.notes}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.transCardBottom}>
                                        <Text style={styles.transRecordedBy}>
                                            👤 नोंद: {item.recorded_by_name || "वापरकर्ता"}
                                        </Text>

                                        <TouchableOpacity
                                            style={styles.deleteBtn}
                                            onPress={() => handleDeleteTransaction(item.id)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.deleteBtnText}>🗑️ रद्द करा</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* MODAL: ADD CASH ENTRY */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>💵 नवीन रोख नोंद</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* TRANSACTION DIRECTION */}
                            <Text style={styles.modalLabel}>कोणी कोणाला दिले? (Direction)</Text>
                            <View style={styles.directionRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.directionBtn,
                                        transType === "branch_to_admin" && styles.directionBtnActiveBlue,
                                    ]}
                                    onPress={() => setTransType("branch_to_admin")}
                                >
                                    <Text
                                        style={[
                                            styles.directionBtnText,
                                            transType === "branch_to_admin" && styles.directionBtnTextActive,
                                        ]}
                                    >
                                        🔵 शाखेने ॲडमिनला दिले
                                    </Text>
                                    <Text style={styles.directionSub}>Branch ➔ Admin</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.directionBtn,
                                        transType === "admin_to_branch" && styles.directionBtnActiveGreen,
                                    ]}
                                    onPress={() => setTransType("admin_to_branch")}
                                >
                                    <Text
                                        style={[
                                            styles.directionBtnText,
                                            transType === "admin_to_branch" && styles.directionBtnTextActive,
                                        ]}
                                    >
                                        🟢 ॲडमिनने शाखेला दिले
                                    </Text>
                                    <Text style={styles.directionSub}>Admin ➔ Branch</Text>
                                </TouchableOpacity>
                            </View>

                            {/* AMOUNT INPUT */}
                            <Text style={styles.modalLabel}>रक्कम (Amount in ₹) *</Text>
                            <View style={styles.amountInputContainer}>
                                <Text style={styles.rupeeSign}>₹</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={amountInput}
                                    onChangeText={setAmountInput}
                                />
                            </View>

                            {/* PAYMENT MODE */}
                            <Text style={styles.modalLabel}>पेमेंट प्रकार (Payment Mode)</Text>
                            <View style={styles.modeRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeBtn,
                                        paymentMode === "cash" && styles.modeBtnActive,
                                    ]}
                                    onPress={() => setPaymentMode("cash")}
                                >
                                    <Text
                                        style={[
                                            styles.modeBtnText,
                                            paymentMode === "cash" && styles.modeBtnTextActive,
                                        ]}
                                    >
                                        💵 रोख (Cash)
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.modeBtn,
                                        paymentMode === "upi" && styles.modeBtnActive,
                                    ]}
                                    onPress={() => setPaymentMode("upi")}
                                >
                                    <Text
                                        style={[
                                            styles.modeBtnText,
                                            paymentMode === "upi" && styles.modeBtnTextActive,
                                        ]}
                                    >
                                        📱 UPI / बँक
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* DATE INPUT */}
                            <Text style={styles.modalLabel}>दिनांक (YYYY-MM-DD)</Text>
                            <TextInput
                                style={styles.dateInput}
                                value={dateInput}
                                onChangeText={setDateInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#94A3B8"
                            />

                            {/* NOTES INPUT */}
                            <Text style={styles.modalLabel}>कारण / शेरा (Notes - पर्यायी)</Text>
                            <TextInput
                                style={styles.notesInput}
                                placeholder="उदा. आजचा गल्ला, गाडी भाडे इ."
                                placeholderTextColor="#94A3B8"
                                value={notesInput}
                                onChangeText={setNotesInput}
                            />

                            {/* QUICK REASON CHIPS */}
                            <View style={styles.quickChipsContainer}>
                                {QUICK_NOTES.map((q) => (
                                    <TouchableOpacity
                                        key={q}
                                        style={styles.quickChip}
                                        onPress={() => setNotesInput(q)}
                                    >
                                        <Text style={styles.quickChipText}>+ {q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* SUBMIT BUTTON */}
                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                                onPress={handleCreateTransaction}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.submitBtnText}>✅ नोंद जतन करा (Save Entry)</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    backBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },
    backBtnText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
    },
    headerSubtitle: {
        fontSize: 12,
        color: "#64748B",
    },
    refreshBtn: {
        padding: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },
    refreshBtnText: {
        fontSize: 16,
    },
    centerLoading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: "#64748B",
    },
    scrollContent: {
        padding: 16,
    },
    /* SETTLEMENT CARD */
    settlementCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    borderRed: {
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
    },
    borderBlue: {
        borderColor: "#93C5FD",
        backgroundColor: "#EFF6FF",
    },
    borderGreen: {
        borderColor: "#86EFAC",
        backgroundColor: "#F0FDF4",
    },
    settlementHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    settlementTag: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
        textTransform: "uppercase",
    },
    settlementPill: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    settlementPillText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
    },
    settlementBigAmount: {
        fontSize: 32,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 8,
    },
    settlementTextBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    settlementTextDetail: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
        lineHeight: 22,
    },
    /* SUMMARY GRID */
    summaryGrid: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    summaryBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    adminBox: {
        borderLeftWidth: 4,
        borderLeftColor: "#16A34A",
    },
    branchBox: {
        borderLeftWidth: 4,
        borderLeftColor: "#2563EB",
    },
    summaryBoxHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    summaryBoxIcon: {
        fontSize: 12,
        marginRight: 6,
    },
    summaryBoxTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    summaryBoxAmount: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 2,
    },
    summaryBoxSub: {
        fontSize: 10,
        color: "#64748B",
    },
    /* ADD ENTRY BUTTON */
    addEntryBtn: {
        backgroundColor: "#16A34A",
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    addEntryBtnIcon: {
        fontSize: 22,
        marginRight: 12,
        color: "#FFFFFF",
    },
    addEntryBtnTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    addEntryBtnSub: {
        fontSize: 12,
        color: "#DCFCE7",
        marginTop: 2,
    },
    addEntryBtnArrow: {
        fontSize: 20,
        color: "#FFFFFF",
        fontWeight: "700",
    },
    /* FILTER SECTION */
    filterSection: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 10,
    },
    filterRow: {
        flexDirection: "row",
        gap: 8,
    },
    filterChip: {
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    filterChipActive: {
        backgroundColor: "#0F172A",
        borderColor: "#0F172A",
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    filterChipTextActive: {
        color: "#FFFFFF",
    },
    /* EMPTY STATE */
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 40,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 10,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        paddingHorizontal: 24,
    },
    /* TRANSACTION CARD */
    transCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    transCardTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    transIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    bgBlue: {
        backgroundColor: "#DBEAFE",
    },
    bgGreen: {
        backgroundColor: "#DCFCE7",
    },
    transIconText: {
        fontSize: 16,
    },
    transTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0F172A",
    },
    transDate: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    transAmount: {
        fontSize: 16,
        fontWeight: "800",
    },
    textBlue: {
        color: "#2563EB",
    },
    textGreen: {
        color: "#16A34A",
    },
    transNotesBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
        borderLeftWidth: 3,
        borderLeftColor: "#CBD5E1",
    },
    transNotesText: {
        fontSize: 12,
        color: "#334155",
        fontWeight: "500",
    },
    transCardBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    transRecordedBy: {
        fontSize: 11,
        color: "#94A3B8",
    },
    deleteBtn: {
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    deleteBtnText: {
        fontSize: 11,
        color: "#EF4444",
        fontWeight: "600",
    },
    /* MODAL STYLES */
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "90%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    modalCloseText: {
        fontSize: 20,
        color: "#64748B",
        padding: 4,
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        marginTop: 12,
        marginBottom: 8,
    },
    directionRow: {
        flexDirection: "row",
        gap: 10,
    },
    directionBtn: {
        flex: 1,
        backgroundColor: "#F1F5F9",
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#E2E8F0",
    },
    directionBtnActiveBlue: {
        backgroundColor: "#EFF6FF",
        borderColor: "#2563EB",
    },
    directionBtnActiveGreen: {
        backgroundColor: "#F0FDF4",
        borderColor: "#16A34A",
    },
    directionBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    directionBtnTextActive: {
        color: "#0F172A",
    },
    directionSub: {
        fontSize: 10,
        color: "#94A3B8",
        marginTop: 2,
    },
    amountInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        paddingHorizontal: 14,
    },
    rupeeSign: {
        fontSize: 22,
        fontWeight: "800",
        color: "#0F172A",
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: "800",
        color: "#0F172A",
        paddingVertical: 10,
    },
    modeRow: {
        flexDirection: "row",
        gap: 10,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    modeBtnActive: {
        backgroundColor: "#0F172A",
        borderColor: "#0F172A",
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
    },
    modeBtnTextActive: {
        color: "#FFFFFF",
    },
    dateInput: {
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        padding: 10,
        fontSize: 14,
        color: "#0F172A",
    },
    notesInput: {
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        padding: 10,
        fontSize: 14,
        color: "#0F172A",
    },
    quickChipsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8,
    },
    quickChip: {
        backgroundColor: "#F1F5F9",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    quickChipText: {
        fontSize: 11,
        color: "#475569",
        fontWeight: "500",
    },
    submitBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 20,
        marginBottom: 20,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
