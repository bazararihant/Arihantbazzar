import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { clearAuthData, UserSession } from "../../services/storage";

interface Props {
    user: UserSession;
    onLogout: () => void;
    onCreateOrder: () => void;
    onViewOrder: (orderId: number) => void;
    onViewHistory?: () => void;
    onViewLedger?: () => void;
    onViewSalary?: () => void;
}

interface OrderItem {
    id: number;
    franchise_id: number;
    order_date: string;
    status: "pending" | "approved" | "dispatched" | "delivered" | "rejected";
    notes: string;
    bill_image_url: string | null;
    bill_amount: string | null;
    created_at: string;
    total_items: number;
    franchise_name: string;
    franchise_code: string;
    user_name?: string;
    user_role?: string;
}

export default function BranchDashboardScreen({
    user,
    onLogout,
    onCreateOrder,
    onViewOrder,
    onViewHistory,
    onViewLedger,
    onViewSalary,
}: Props) {
    const insets = useSafeAreaInsets();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");

    const loadOrders = useCallback(async () => {
        try {
            const res = await api.get("/orders");
            setOrders(res.data.orders || []);
        } catch (error: any) {
            console.error("Failed to load orders:", error);
            Alert.alert(
                "डेटा लोड अयशस्वी",
                error?.response?.data?.message || "ऑर्डर्स लोड करता आल्या नाहीत"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const onRefresh = () => {
        setRefreshing(true);
        loadOrders();
    };

    const handleLogout = async () => {
        Alert.alert("लॉगआउट", "तुम्हाला नक्की लॉगआउट करायचे आहे का?", [
            { text: "रद्द करा", style: "cancel" },
            {
                text: "लॉगआउट",
                style: "destructive",
                onPress: async () => {
                    await clearAuthData();
                    onLogout();
                },
            },
        ]);
    };

    // Calculate Counts
    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const approvedCount = orders.filter((o) => o.status === "approved").length;
    const dispatchedCount = orders.filter((o) => o.status === "dispatched").length;
    const deliveredCount = orders.filter((o) => o.status === "delivered").length;

    // Filter Active vs History
    const activeOrders = orders.filter(
        (o) => o.status === "pending" || o.status === "approved" || o.status === "dispatched"
    );
    const historyOrders = orders.filter(
        (o) => o.status === "delivered" || o.status === "rejected"
    );

    const displayedOrders = activeTab === "active" ? activeOrders : historyOrders;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return { bg: "#FEF3C7", text: "#D97706", label: "प्रलंबित (Pending)" };
            case "approved":
                return { bg: "#DBEAFE", text: "#2563EB", label: "मंजूर (Approved)" };
            case "dispatched":
                return { bg: "#E0E7FF", text: "#4F46E5", label: "मार्गस्थ (Dispatched)" };
            case "delivered":
                return { bg: "#DCFCE7", text: "#16A34A", label: "डिलिव्हर (Delivered)" };
            case "rejected":
                return { bg: "#FEE2E2", text: "#DC2626", label: "नाकारले (Rejected)" };
            default:
                return { bg: "#F1F5F9", text: "#64748B", label: status };
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <View style={styles.branchHeader}>
                    <View style={styles.branchBadgeRow}>
                        <Text style={styles.branchBadge}>
                            {user.franchise_code || "BHILWADI"}
                        </Text>
                        <Text style={styles.branchLocText}>📍 भिलवडी, सांगली</Text>
                    </View>
                    <Text style={styles.branchTitle}>
                        {user.franchise_name || "अरिहंत बाजार (भिलवडी, सांगली)"}
                    </Text>
                    <Text style={styles.userRole}>
                        {user.role === "worker"
                            ? `👷‍♂️ ${user.name} (कामगार - फक्त ऑर्डर नोंदणी)`
                            : user.role === "sub_admin"
                            ? `🏢 ${user.name} (सब-ॲडमिन / व्यवस्थापक)`
                            : `🏢 ${user.name} (शाखा व्यवस्थापक)`}
                    </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {user.role !== "worker" && onViewHistory && (
                        <TouchableOpacity
                            style={{
                                backgroundColor: "#EFF6FF",
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                borderRadius: 8,
                                marginRight: 6,
                                borderWidth: 1,
                                borderColor: "#BFDBFE",
                            }}
                            onPress={onViewHistory}
                        >
                            <Text style={{ fontSize: 12, fontWeight: "700", color: "#2563EB" }}>📜 इतिहास</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Text style={styles.logoutText}>लॉगआउट 🚪</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Big Action Button to Create New Order */}
                <TouchableOpacity
                    style={styles.createOrderBtn}
                    onPress={onCreateOrder}
                    activeOpacity={0.85}
                >
                    <View style={styles.createBtnContent}>
                        <View style={styles.plusCircle}>
                            <Text style={styles.plusIcon}>＋</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.createBtnTitle}>
                                नवीन सामानाची लिस्ट पाठवा
                            </Text>
                            <Text style={styles.createBtnSubtitle}>
                                Daily Material Indent / सामानाची मागणी नोंदवा
                            </Text>
                        </View>
                        <Text style={styles.createBtnArrow}>➔</Text>
                    </View>
                </TouchableOpacity>

                {/* Cash Ledger Action Button - Hidden for Workers */}
                {user.role !== "worker" && onViewLedger && (
                    <TouchableOpacity
                        style={styles.ledgerBtn}
                        onPress={onViewLedger}
                        activeOpacity={0.85}
                    >
                        <View style={styles.createBtnContent}>
                            <View style={styles.moneyCircle}>
                                <Text style={styles.moneyIcon}>💰</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.ledgerBtnTitle}>
                                    रोख जमा-खर्च हिशोब (Cash Ledger)
                                </Text>
                                <Text style={styles.ledgerBtnSubtitle}>
                                    ॲडमिनसोबतचा पैशांची देवाणघेवाण व बाकी हिशोब पहा
                                </Text>
                            </View>
                            <Text style={styles.ledgerBtnArrow}>➔</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Worker Attendance & Salary Button - for Sub-Admin / Manager */}
                {user.role !== "worker" && onViewSalary && (
                    <TouchableOpacity
                        style={styles.salaryBtn}
                        onPress={onViewSalary}
                        activeOpacity={0.85}
                    >
                        <View style={styles.createBtnContent}>
                            <View style={[styles.moneyCircle, { backgroundColor: "#DCFCE7" }]}>
                                <Text style={styles.moneyIcon}>👷</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.salaryBtnTitle}>
                                    कामगार हजेरी व पगार (Worker Attendance & Salary)
                                </Text>
                                <Text style={styles.salaryBtnSubtitle}>
                                    दैनिक हजेरी (पूर्ण/अर्धा दिवस), उचल/ॲडव्हान्स व मासिक पगार हिशोब
                                </Text>
                            </View>
                            <Text style={styles.salaryBtnArrow}>➔</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Status Overview Grid */}
                <Text style={styles.sectionHeader}>आजची स्थिती (Order Status)</Text>
                <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { borderLeftColor: "#F59E0B" }]}>
                        <Text style={styles.statNumber}>{pendingCount}</Text>
                        <Text style={styles.statLabel}>⏳ प्रलंबित</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#2563EB" }]}>
                        <Text style={styles.statNumber}>{approvedCount}</Text>
                        <Text style={styles.statLabel}>📋 मंजूर</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#4F46E5" }]}>
                        <Text style={styles.statNumber}>{dispatchedCount}</Text>
                        <Text style={styles.statLabel}>🚚 मार्गस्थ</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#16A34A" }]}>
                        <Text style={styles.statNumber}>{deliveredCount}</Text>
                        <Text style={styles.statLabel}>✅ पूर्ण</Text>
                    </View>
                </View>

                {/* TAB SELECTOR: ACTIVE ORDERS VS ORDER HISTORY */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === "active" && styles.tabButtonActive]}
                        onPress={() => setActiveTab("active")}
                    >
                        <Text style={[styles.tabButtonText, activeTab === "active" && styles.tabButtonTextActive]}>
                            📦 चालू ऑर्डर्स ({activeOrders.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
                        onPress={() => setActiveTab("history")}
                    >
                        <Text style={[styles.tabButtonText, activeTab === "history" && styles.tabButtonTextActive]}>
                            📜 ऑर्डर इतिहास ({historyOrders.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* List Header */}
                <View style={styles.listHeaderRow}>
                    <Text style={styles.listTitle}>
                        {activeTab === "active"
                            ? "सध्या प्रक्रियेत असलेल्या ऑर्डर्स"
                            : "पूर्ण झालेला इतिहास (Order History)"}
                    </Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Text style={styles.refreshLink}>🔄 रिफ्रेश करा</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color="#16A34A"
                        style={{ marginVertical: 30 }}
                    />
                ) : displayedOrders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📦</Text>
                        <Text style={styles.emptyTitle}>
                            {activeTab === "active"
                                ? "कोणतीही चालू ऑर्डर नाही"
                                : "अद्याप कोणताही ऑर्डर इतिहास नाही"}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {activeTab === "active"
                                ? "वर दिलेल्या 'नवीन सामानाची लिस्ट पाठवा' बटणावर क्लिक करून ऑर्डर नोंदवा."
                                : "पूर्ण झालेल्या ऑर्डर्स येथे इतिहास स्वरूपात दिसतील."}
                        </Text>
                    </View>
                ) : (
                    displayedOrders.map((item) => {
                        const badge = getStatusBadge(item.status);
                        const hasBill = !!item.bill_image_url;

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.orderCard}
                                onPress={() => onViewOrder(item.id)}
                                activeOpacity={0.85}
                            >
                                <View style={styles.orderCardTop}>
                                    <View>
                                        <Text style={styles.orderId}>
                                            ऑर्डर #{item.id}
                                        </Text>
                                        <Text style={styles.orderDate}>
                                            📅 {new Date(item.created_at).toLocaleString("mr-IN", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: badge.bg },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBadgeText,
                                                { color: badge.text },
                                            ]}
                                        >
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                {item.notes ? (
                                    <Text style={styles.orderNotes} numberOfLines={1}>
                                        📝 नोंद: {item.notes}
                                    </Text>
                                ) : null}

                                <View style={styles.cardDivider} />

                                <View style={styles.orderCardBottom}>
                                    <View>
                                        <Text style={styles.itemsCount}>
                                            🛒 {item.total_items} सामानाचे आयटम
                                        </Text>
                                        {item.user_name ? (
                                            <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                                👤 नोंदवले: {item.user_name}
                                            </Text>
                                        ) : null}
                                    </View>

                                    {/* Bill Status Indicator - Hidden for workers */}
                                    {user.role !== "worker" && (
                                        <View
                                            style={[
                                                styles.billBadge,
                                                hasBill
                                                    ? styles.billBadgeUploaded
                                                    : styles.billBadgePending,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.billBadgeText,
                                                    hasBill
                                                        ? styles.billBadgeTextUploaded
                                                        : styles.billBadgeTextPending,
                                                ]}
                                            >
                                                {hasBill ? "बिल जोडले ✅" : "बिल बाकी 📷"}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    topBar: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    branchHeader: {
        flex: 1,
    },
    branchBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
    },
    branchBadge: {
        backgroundColor: "#DCFCE7",
        color: "#16A34A",
        fontSize: 10,
        fontWeight: "800",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    branchLocText: {
        fontSize: 11,
        color: "#64748B",
        fontWeight: "600",
    },
    branchTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    userRole: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 1,
    },
    logoutBtn: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },
    logoutText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#DC2626",
    },
    scrollContent: {
        padding: 14,
    },
    createOrderBtn: {
        backgroundColor: "#16A34A",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    createBtnContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    plusCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    plusIcon: {
        color: "#FFFFFF",
        fontSize: 26,
        fontWeight: "700",
        marginTop: -2,
    },
    createBtnTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
    createBtnSubtitle: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 11,
        marginTop: 2,
    },
    createBtnArrow: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "700",
        marginLeft: 8,
    },
    sectionHeader: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 10,
    },
    statsGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 10,
        marginHorizontal: 3,
        borderLeftWidth: 3.5,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
    },
    statNumber: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    statLabel: {
        fontSize: 11,
        color: "#64748B",
        fontWeight: "600",
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        borderRadius: 10,
        padding: 3,
        marginBottom: 14,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 8,
    },
    tabButtonActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#64748B",
    },
    tabButtonTextActive: {
        color: "#16A34A",
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        paddingHorizontal: 2,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
    },
    refreshLink: {
        fontSize: 12,
        fontWeight: "700",
        color: "#16A34A",
    },
    emptyContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderStyle: "dashed",
        marginVertical: 10,
    },
    emptyIcon: {
        fontSize: 34,
        marginBottom: 6,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#475569",
    },
    emptySubtitle: {
        fontSize: 12,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 4,
    },
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    orderCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    orderId: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    orderDate: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "800",
    },
    orderNotes: {
        fontSize: 12,
        color: "#475569",
        marginTop: 8,
    },
    cardDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginVertical: 10,
    },
    orderCardBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    itemsCount: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    billBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    billBadgeUploaded: {
        backgroundColor: "#DCFCE7",
    },
    billBadgePending: {
        backgroundColor: "#FEF3C7",
    },
    billBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    billBadgeTextUploaded: {
        color: "#16A34A",
    },
    billBadgeTextPending: {
        color: "#D97706",
    },
    ledgerBtn: {
        backgroundColor: "#0F172A",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: "#38BDF8",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    moneyCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    moneyIcon: {
        fontSize: 22,
    },
    ledgerBtnTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    ledgerBtnSubtitle: {
        fontSize: 11,
        color: "#94A3B8",
        marginTop: 2,
    },
    ledgerBtnArrow: {
        fontSize: 20,
        fontWeight: "800",
        color: "#38BDF8",
        marginLeft: 8,
    },
    salaryBtn: {
        backgroundColor: "#064E3B",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: "#34D399",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    salaryBtnTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    salaryBtnSubtitle: {
        fontSize: 11,
        color: "#A7F3D0",
        marginTop: 2,
    },
    salaryBtnArrow: {
        fontSize: 20,
        fontWeight: "800",
        color: "#34D399",
        marginLeft: 8,
    },
});
