import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import UserManagementModal from "./UserManagementModal";

interface Props {
    user: UserSession;
    onLogout: () => void;
    onCreateOrder?: () => void;
    onViewOrder: (orderId: number) => void;
    onViewHistory: (tab?: "orders" | "report") => void;
    onViewLedger: () => void;
    onViewSalary: () => void;
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
    user_name: string;
    user_role?: string;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
    address: string;
    phone: string;
}

export default function AdminDashboardScreen({
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
    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [ordersRes, franchisesRes] = await Promise.all([
                api.get("/orders"),
                api.get("/orders/franchises"),
            ]);

            setOrders(ordersRes.data.orders || []);
            setFranchises(franchisesRes.data.franchises || []);
        } catch (error: any) {
            console.error("Admin data load error:", error);
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
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogout = () => {
        Alert.alert("लॉगआउट", "तुम्हाला ॲडमिन पॅनेलमधून लॉगआउट करायचे आहे का?", [
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

    // Filter STRICTLY for Today's Orders on Admin Dashboard
    const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
    const todayFormatted = useMemo(() => {
        return new Date().toLocaleDateString("mr-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    }, []);

    const todayOrders = useMemo(() => {
        return orders.filter((o) => {
            const oDate = o.created_at ? o.created_at.split("T")[0] : "";
            const isToday = oDate === todayStr;
            if (!isToday) return false;
            if (selectedStatus && o.status !== selectedStatus) return false;
            return true;
        });
    }, [orders, todayStr, selectedStatus]);

    // All orders from today (unfiltered by status) for accurate counters
    const allTodayOrders = useMemo(() => {
        return orders.filter((o) => {
            const oDate = o.created_at ? o.created_at.split("T")[0] : "";
            return oDate === todayStr;
        });
    }, [orders, todayStr]);

    const todayTotal = allTodayOrders.length;
    const todayPending = allTodayOrders.filter((o) => o.status === "pending").length;
    const todayApproved = allTodayOrders.filter((o) => o.status === "approved").length;
    const todayDispatched = allTodayOrders.filter((o) => o.status === "dispatched").length;
    const todayDelivered = allTodayOrders.filter((o) => o.status === "delivered").length;

    // Calculate This Month's Total Expense & Orders
    const currentMonthStats = useMemo(() => {
        const nowDate = new Date();
        const curM = nowDate.getMonth();
        const curY = nowDate.getFullYear();
        let totalExpense = 0;
        let ordersInMonth = 0;

        orders.forEach((o) => {
            if (!o.created_at) return;
            const d = new Date(o.created_at);
            if (d.getMonth() === curM && d.getFullYear() === curY) {
                ordersInMonth += 1;
                if (o.bill_amount) {
                    totalExpense += parseFloat(o.bill_amount);
                }
            }
        });

        const monthName = nowDate.toLocaleDateString("mr-IN", { month: "long", year: "numeric" });
        return { totalExpense, ordersInMonth, monthName };
    }, [orders]);

    const getStatusStyle = (status: string) => {
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

    const activeBranch = franchises[0] || {
        name: "अरिहंत बाजार (भिलवडी, सांगली)",
        code: "BHILWADI",
        address: "भिलवडी, ता. पलूस, सांगली",
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header */}
            <View style={styles.topBar}>
                <View>
                    <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>
                            {user.role === "sub_admin" ? "🏢 SUB-ADMIN / सब-ॲडमिन" : "👑 CENTRAL ADMIN"}
                        </Text>
                    </View>
                    <Text style={styles.adminTitle}>
                        {user.name ? `${user.name} (${user.role === "sub_admin" ? "सब-ॲडमिन" : "मुख्य ॲडमिन"})` : "अरिहंत बाजार ॲडमिन"}
                    </Text>
                    <Text style={styles.adminSubtitle}>
                        🏢 {activeBranch.name}
                    </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity style={styles.historyTopBtn} onPress={() => onViewHistory("orders")}>
                        <Text style={styles.historyTopBtnText}>📜 इतिहास</Text>
                    </TouchableOpacity>
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
                {/* COMPACT ACTION BUTTON TO CREATE NEW ORDER (ADMIN / SUB-ADMIN) */}
                {onCreateOrder && (
                    <TouchableOpacity
                        style={styles.compactCreateBtn}
                        onPress={onCreateOrder}
                        activeOpacity={0.85}
                    >
                        <View style={styles.compactCreateBtnLeft}>
                            <View style={styles.compactPlusCircle}>
                                <Text style={styles.compactPlusIcon}>＋</Text>
                            </View>
                            <Text style={styles.compactCreateBtnTitle}>
                                नवीन सामानाची लिस्ट पाठवा / ऑर्डर टाका
                            </Text>
                        </View>
                        <Text style={styles.compactCreateBtnArrow}>➔</Text>
                    </TouchableOpacity>
                )}

                {/* 2x2 COMPACT QUICK ACTION GRID */}
                <View style={styles.actionGrid}>
                    {/* History Card */}
                    <TouchableOpacity
                        style={[styles.actionGridItem, { borderColor: "#BFDBFE" }]}
                        onPress={() => onViewHistory("orders")}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionGridIconCircle, { backgroundColor: "#EFF6FF" }]}>
                            <Text style={styles.actionGridIcon}>📜</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionGridTitle} numberOfLines={1}>ऑर्डर इतिहास</Text>
                            <Text style={styles.actionGridSub} numberOfLines={1}>सर्व जुन्या ऑर्डर्स</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Worker Attendance & Salary */}
                    <TouchableOpacity
                        style={[styles.actionGridItem, { borderColor: "#BBF7D0" }]}
                        onPress={onViewSalary}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionGridIconCircle, { backgroundColor: "#DCFCE7" }]}>
                            <Text style={styles.actionGridIcon}>👷</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionGridTitle} numberOfLines={1}>कामगार पगार</Text>
                            <Text style={styles.actionGridSub} numberOfLines={1}>हजेरी व उचल</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Cash Ledger */}
                    <TouchableOpacity
                        style={[styles.actionGridItem, { borderColor: "#BAE6FD" }]}
                        onPress={onViewLedger}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionGridIconCircle, { backgroundColor: "#F0F9FF" }]}>
                            <Text style={styles.actionGridIcon}>💰</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionGridTitle} numberOfLines={1}>कॅश लेजर</Text>
                            <Text style={styles.actionGridSub} numberOfLines={1}>जमा-खर्च हिशोब</Text>
                        </View>
                    </TouchableOpacity>

                    {/* User Management */}
                    <TouchableOpacity
                        style={[styles.actionGridItem, { borderColor: "#DDD6FE" }]}
                        onPress={() => setShowUserModal(true)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionGridIconCircle, { backgroundColor: "#F5F3FF" }]}>
                            <Text style={styles.actionGridIcon}>👥</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionGridTitle} numberOfLines={1}>युजर मॅनेजमेंट</Text>
                            <Text style={styles.actionGridSub} numberOfLines={1}>शाखा खाती</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* COMPACT MONTHLY EXPENSE STRIP */}
                <TouchableOpacity
                    style={styles.compactMonthlyStrip}
                    onPress={() => onViewHistory("report")}
                    activeOpacity={0.85}
                >
                    <View style={styles.monthlyStripLeft}>
                        <View style={styles.monthlyStripBadge}>
                            <Text style={styles.monthlyStripBadgeText}>💰 {currentMonthStats.monthName}</Text>
                        </View>
                        <Text style={styles.monthlyStripAmount}>
                            ₹{currentMonthStats.totalExpense.toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.monthlyStripCount}>({currentMonthStats.ordersInMonth} ऑर्डर्स)</Text>
                    </View>
                    <Text style={styles.monthlyStripLink}>खर्च अहवाल ➔</Text>
                </TouchableOpacity>

                {/* COMPACT TODAY'S ORDERS HEADER */}
                <View style={styles.todayHeaderRow}>
                    <Text style={styles.todayTitle}>
                        📅 आजच्या ऑर्डर्स ({todayFormatted})
                    </Text>
                </View>

                {/* TODAY'S STATS OVERVIEW */}
                <View style={styles.statsRow}>
                    <View style={[styles.statBox, { borderLeftColor: "#2563EB" }]}>
                        <Text style={styles.statNum}>{todayTotal}</Text>
                        <Text style={styles.statTxt}>आज एकूण</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#F59E0B" }]}>
                        <Text style={styles.statNum}>{todayPending}</Text>
                        <Text style={styles.statTxt}>⏳ प्रलंबित</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#4F46E5" }]}>
                        <Text style={styles.statNum}>{todayDispatched}</Text>
                        <Text style={styles.statTxt}>🚚 मार्गस्थ</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#16A34A" }]}>
                        <Text style={styles.statNum}>{todayDelivered}</Text>
                        <Text style={styles.statTxt}>✅ पूर्ण</Text>
                    </View>
                </View>

                {/* Filter By Status Chips for Today's Orders */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusChipsScroll}>
                    {[
                        { label: "आजच्या सर्व", value: null },
                        { label: "⏳ प्रलंबित", value: "pending" },
                        { label: "📋 मंजूर", value: "approved" },
                        { label: "🚚 मार्गस्थ", value: "dispatched" },
                        { label: "✅ पूर्ण", value: "delivered" },
                    ].map((chip, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.chip,
                                selectedStatus === chip.value && styles.chipActive,
                            ]}
                            onPress={() => setSelectedStatus(chip.value)}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    selectedStatus === chip.value && styles.chipTextActive,
                                ]}
                            >
                                {chip.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* TODAY'S ORDERS LIST */}
                <View style={styles.listHeaderRow}>
                    <Text style={styles.listTitle}>
                        आजच्या ऑर्डर्सची यादी ({todayOrders.length})
                    </Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Text style={styles.refreshLink}>🔄 रिफ्रेश करा</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color="#2563EB"
                        style={{ marginVertical: 30 }}
                    />
                ) : todayOrders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📅</Text>
                        <Text style={styles.emptyTitle}>आज अजून कोणतीही ऑर्डर आलेली नाही</Text>
                        <Text style={styles.emptySubtitle}>
                            भिलवडी शाखेकडून आज ऑर्डर आल्यावर ती येथे लगेच दिसेल. जुन्या ऑर्डर्स पाहण्यासाठी वर 'इतिहास पहा' वर क्लिक करा.
                        </Text>
                        <TouchableOpacity style={styles.emptyHistoryBtn} onPress={() => onViewHistory("orders")}>
                            <Text style={styles.emptyHistoryBtnText}>📜 संपूर्ण ऑर्डर इतिहास उघडा ➔</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    todayOrders.map((item) => {
                        const badge = getStatusStyle(item.status);
                        const hasBill = !!item.bill_image_url;

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.orderCard}
                                onPress={() => onViewOrder(item.id)}
                                activeOpacity={0.85}
                            >
                                <View style={styles.cardHeaderRow}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <View style={styles.branchTag}>
                                            <Text style={styles.branchTagText}>
                                                🏢 {item.franchise_name || "भिलवडी शाखा"}
                                            </Text>
                                        </View>
                                        <Text style={styles.orderIdText}>
                                            ऑर्डर #{item.id}
                                        </Text>
                                        <Text style={styles.orderMetaText}>
                                            📅 आज, {new Date(item.created_at).toLocaleTimeString("mr-IN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </Text>
                                        <View style={styles.orderCreatorBadge}>
                                            <Text style={styles.orderCreatorText}>
                                                👤 ऑर्डर नोंदवली: <Text style={{ fontWeight: "800", color: "#1D4ED8" }}>{item.user_name || "माहिती नाही"}</Text> {item.user_role === "worker" ? "👷‍♂️ (कामगार)" : item.user_role === "sub_admin" ? "🏢 (सब-ॲडमिन)" : item.user_role === "admin" ? "👑 (ॲडमिन)" : ""}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                {item.notes ? (
                                    <View style={styles.orderNotesBox}>
                                        <Text style={styles.orderNotesText} numberOfLines={2}>
                                            📝 {item.notes}
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={styles.cardDivider} />

                                <View style={styles.cardFooterRow}>
                                    <Text style={styles.itemsBadge}>
                                        🛒 {item.total_items} सामानाचे आयटम
                                    </Text>

                                    <View
                                        style={[
                                            styles.billStatusPill,
                                            hasBill ? styles.billUploaded : styles.billPending,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.billStatusText,
                                                hasBill ? styles.billTextUploaded : styles.billTextPending,
                                            ]}
                                        >
                                            {hasBill
                                                ? `बिल: ₹${item.bill_amount || "0"} ✅`
                                                : "बिल बाकी 📷"}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            <UserManagementModal
                visible={showUserModal}
                onClose={() => setShowUserModal(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    compactCreateBtn: {
        backgroundColor: "#16A34A",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
    },
    compactCreateBtnLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    compactPlusCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
    },
    compactPlusIcon: {
        fontSize: 16,
        color: "#FFFFFF",
        fontWeight: "900",
    },
    compactCreateBtnTitle: {
        fontSize: 13,
        fontWeight: "800",
        color: "#FFFFFF",
        flex: 1,
    },
    compactCreateBtnArrow: {
        fontSize: 15,
        fontWeight: "800",
        color: "#FFFFFF",
        marginLeft: 6,
    },
    orderCreatorBadge: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 4,
        alignSelf: "flex-start",
        maxWidth: "100%",
        flexShrink: 1,
    },
    orderCreatorText: {
        fontSize: 12,
        color: "#334155",
        fontWeight: "600",
        flexWrap: "wrap",
    },
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
    adminBadge: {
        alignSelf: "flex-start",
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 2,
    },
    adminBadgeText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#2563EB",
    },
    adminTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    adminSubtitle: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 1,
    },
    historyTopBtn: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#BFDBFE",
    },
    historyTopBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2563EB",
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
    actionGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: 8,
    },
    actionGridItem: {
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    actionGridIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 6,
    },
    actionGridIcon: {
        fontSize: 15,
    },
    actionGridTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: "#1E293B",
    },
    actionGridSub: {
        fontSize: 10,
        color: "#64748B",
        marginTop: 1,
    },
    compactMonthlyStrip: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#BBF7D0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    monthlyStripLeft: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        flex: 1,
    },
    monthlyStripBadge: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    monthlyStripBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#16A34A",
    },
    monthlyStripAmount: {
        fontSize: 13,
        fontWeight: "900",
        color: "#0F172A",
    },
    monthlyStripCount: {
        fontSize: 10,
        color: "#64748B",
    },
    monthlyStripLink: {
        fontSize: 11,
        fontWeight: "700",
        color: "#16A34A",
        marginLeft: 4,
    },
    todayHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        marginTop: 2,
        paddingHorizontal: 2,
    },
    todayTitle: {
        fontSize: 13,
        fontWeight: "800",
        color: "#1E293B",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    statBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 2,
        marginHorizontal: 2,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
    },
    statNum: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    statTxt: {
        fontSize: 10,
        color: "#64748B",
        fontWeight: "600",
        marginTop: 1,
    },
    statusChipsScroll: {
        marginBottom: 14,
    },
    chip: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    chipActive: {
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
    },
    chipText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    chipTextActive: {
        color: "#FFFFFF",
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        paddingHorizontal: 2,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1E293B",
    },
    refreshLink: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2563EB",
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
    emptyHistoryBtn: {
        marginTop: 14,
        backgroundColor: "#2563EB",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    emptyHistoryBtnText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 13,
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
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    branchTag: {
        alignSelf: "flex-start",
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    branchTagText: {
        fontSize: 11,
        color: "#475569",
        fontWeight: "700",
    },
    orderIdText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    orderMetaText: {
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
    orderNotesBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        padding: 8,
        marginTop: 8,
    },
    orderNotesText: {
        fontSize: 12,
        color: "#475569",
    },
    cardDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginVertical: 10,
    },
    cardFooterRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
    },
    itemsBadge: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    billStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    billUploaded: {
        backgroundColor: "#DCFCE7",
    },
    billPending: {
        backgroundColor: "#FEF3C7",
    },
    billStatusText: {
        fontSize: 11,
        fontWeight: "700",
    },
    billTextUploaded: {
        color: "#16A34A",
    },
    billTextPending: {
        color: "#D97706",
    },
});
