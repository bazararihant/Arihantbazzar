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
                        <Text style={styles.adminBadgeText}>👑 CENTRAL ADMIN</Text>
                    </View>
                    <Text style={styles.adminTitle}>अरिहंत बाजार मुख्य ॲडमिन</Text>
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
                {/* BIG PROMINENT HISTORY NAVIGATION CARD */}
                <TouchableOpacity
                    style={styles.historyActionCard}
                    onPress={() => onViewHistory("orders")}
                    activeOpacity={0.88}
                >
                    <View style={styles.historyActionContent}>
                        <View style={styles.historyIconCircle}>
                            <Text style={styles.historyIconText}>📜</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.historyActionTitle}>
                                संपूर्ण ऑर्डर इतिहास पहा (Order History)
                            </Text>
                            <Text style={styles.historyActionSub}>
                                सर्व जुन्या ऑर्डर्स किंवा तारीख निवडून कस्टम इतिहास पाहण्यासाठी येथे क्लिक करा
                            </Text>
                        </View>
                        <Text style={styles.historyActionArrow}>➔</Text>
                    </View>
                </TouchableOpacity>

                {/* USER MANAGEMENT & ROLE ACCESS BUTTON */}
                <TouchableOpacity
                    style={styles.userManagementBtn}
                    onPress={() => setShowUserModal(true)}
                    activeOpacity={0.88}
                >
                    <View style={styles.ledgerActionContent}>
                        <View style={[styles.ledgerIconCircle, { backgroundColor: "#EFF6FF" }]}>
                            <Text style={styles.ledgerIconText}>👥</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.ledgerBadgeRow}>
                                <Text style={styles.ledgerActionTitle}>
                                    युजर व्यवस्थापन (User Management)
                                </Text>
                                <View style={[styles.newBadge, { backgroundColor: "#2563EB" }]}>
                                    <Text style={styles.newBadgeText}>ॲक्सेस</Text>
                                </View>
                            </View>
                            <Text style={styles.ledgerActionSub}>
                                नवीन शाखा मॅनेजर जोडा, पासवर्ड सेट करा आणि खाती व्यवस्थापित करा
                            </Text>
                        </View>
                        <Text style={styles.ledgerActionArrow}>➔</Text>
                    </View>
                </TouchableOpacity>

                {/* WORKER ATTENDANCE & SALARY MANAGEMENT CARD */}
                <TouchableOpacity
                    style={styles.salaryActionCard}
                    onPress={onViewSalary}
                    activeOpacity={0.88}
                >
                    <View style={styles.ledgerActionContent}>
                        <View style={[styles.ledgerIconCircle, { backgroundColor: "#DCFCE7" }]}>
                            <Text style={styles.ledgerIconText}>👷</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.ledgerBadgeRow}>
                                <Text style={styles.ledgerActionTitle}>
                                    कामगार हजेरी व पगार (Worker Attendance & Salary)
                                </Text>
                                <View style={[styles.newBadge, { backgroundColor: "#16A34A" }]}>
                                    <Text style={styles.newBadgeText}>हजेरी / उचल</Text>
                                </View>
                            </View>
                            <Text style={styles.ledgerActionSub}>
                                रोजची हजेरी (पूर्ण/अर्धा दिवस), पगार, उचल/ॲडव्हान्स ट्रॅकिंग, मासिक व कस्टम अहवाल
                            </Text>
                        </View>
                        <Text style={styles.ledgerActionArrow}>➔</Text>
                    </View>
                </TouchableOpacity>

                {/* CASH LEDGER & BROTHER SETTLEMENT CARD */}
                <TouchableOpacity
                    style={styles.ledgerActionCard}
                    onPress={onViewLedger}
                    activeOpacity={0.88}
                >
                    <View style={styles.ledgerActionContent}>
                        <View style={styles.ledgerIconCircle}>
                            <Text style={styles.ledgerIconText}>💰</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.ledgerBadgeRow}>
                                <Text style={styles.ledgerActionTitle}>
                                    रोख जमा-खर्च हिशोब (Cash Ledger)
                                </Text>
                                <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>खतावणी</Text>
                                </View>
                            </View>
                            <Text style={styles.ledgerActionSub}>
                                अरिहंत बाजार आणि ॲडमिनमधील कॅश देवाणघेवाण व अंतिम बाकी हिशोब पहा
                            </Text>
                        </View>
                        <Text style={styles.ledgerActionArrow}>➔</Text>
                    </View>
                </TouchableOpacity>

                {/* MONTHLY EXPENSE HIGHLIGHT BANNER */}
                <TouchableOpacity
                    style={styles.monthlyExpenseCard}
                    onPress={() => onViewHistory("report")}
                    activeOpacity={0.88}
                >
                    <View style={styles.monthlyExpenseHeader}>
                        <View style={styles.monthlyBadge}>
                            <Text style={styles.monthlyBadgeText}>💰 {currentMonthStats.monthName} चा एकूण खर्च</Text>
                        </View>
                        <Text style={styles.monthlyReportLinkText}>खर्च अहवाल पहा ➔</Text>
                    </View>

                    <View style={styles.monthlyExpenseContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.monthlyExpenseAmount}>
                                ₹ {currentMonthStats.totalExpense.toLocaleString("en-IN")}
                            </Text>
                            <Text style={styles.monthlyExpenseSub}>
                                या महिन्यात {currentMonthStats.ordersInMonth} ऑर्डर्स नोंदवल्या गेल्या (तारीखनिहाय तपशील पहा)
                            </Text>
                        </View>
                        <View style={styles.monthlyIconBox}>
                            <Text style={styles.monthlyIconText}>📊</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* TODAY'S ORDERS BANNER */}
                <View style={styles.todayHeaderBanner}>
                    <View style={styles.todayBadge}>
                        <Text style={styles.todayBadgeText}>⚡ आजचे थेट काम</Text>
                    </View>
                    <Text style={styles.todayTitle}>
                        📅 आजच्या ऑर्डर्स ({todayFormatted})
                    </Text>
                    <Text style={styles.todaySub}>
                        फक्त आज नोंदवलेल्या ऑर्डर्सचे रिअल-टाइम तपशील
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
                                    <View style={{ flex: 1 }}>
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
    userManagementBtn: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: "#93C5FD",
        elevation: 2,
    },
    orderCreatorBadge: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 4,
        alignSelf: "flex-start",
    },
    orderCreatorText: {
        fontSize: 12,
        color: "#334155",
        fontWeight: "600",
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
    historyActionCard: {
        backgroundColor: "#1E293B",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    historyActionContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    historyIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    historyIconText: {
        fontSize: 22,
    },
    historyActionTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    historyActionSub: {
        fontSize: 11,
        color: "#94A3B8",
        marginTop: 2,
    },
    historyActionArrow: {
        fontSize: 20,
        fontWeight: "800",
        color: "#38BDF8",
        marginLeft: 8,
    },
    monthlyExpenseCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: "#86EFAC",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    monthlyExpenseHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    monthlyBadge: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    monthlyBadgeText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#16A34A",
    },
    monthlyReportLinkText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#16A34A",
    },
    monthlyExpenseContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    monthlyExpenseAmount: {
        fontSize: 26,
        fontWeight: "900",
        color: "#0F172A",
    },
    monthlyExpenseSub: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    monthlyIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F0FDF4",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#BBF7D0",
        marginLeft: 10,
    },
    monthlyIconText: {
        fontSize: 22,
    },
    todayHeaderBanner: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: "#93C5FD",
    },
    todayBadge: {
        backgroundColor: "#DBEAFE",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    todayBadgeText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#1D4ED8",
    },
    todayTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    todaySub: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 14,
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
    statNum: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    statTxt: {
        fontSize: 11,
        color: "#64748B",
        fontWeight: "600",
        marginTop: 2,
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
    salaryActionCard: {
        backgroundColor: "#064E3B",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: "#34D399",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    ledgerActionCard: {
        backgroundColor: "#0F172A",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: "#38BDF8",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    ledgerActionContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    ledgerIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    ledgerIconText: {
        fontSize: 22,
    },
    ledgerBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    ledgerActionTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    newBadge: {
        backgroundColor: "#16A34A",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    newBadgeText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "700",
    },
    ledgerActionSub: {
        fontSize: 11,
        color: "#94A3B8",
        marginTop: 2,
    },
    ledgerActionArrow: {
        fontSize: 20,
        fontWeight: "800",
        color: "#38BDF8",
        marginLeft: 8,
    },
});
