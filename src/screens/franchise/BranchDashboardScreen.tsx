import React, { useEffect, useState, useCallback } from "react";
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from "react-native";
import api from "../../services/api";
import { clearAuthData, UserSession } from "../../services/storage";

interface Props {
    user: UserSession;
    onLogout: () => void;
    onCreateOrder: () => void;
    onViewOrder: (orderId: number) => void;
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
}

export default function BranchDashboardScreen({
    user,
    onLogout,
    onCreateOrder,
    onViewOrder,
}: Props) {
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
        <SafeAreaView style={styles.container}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <View style={styles.branchHeader}>
                    <Text style={styles.branchBadge}>
                        {user.franchise_code || "BRANCH"}
                    </Text>
                    <Text style={styles.branchTitle}>
                        {user.franchise_name || user.name}
                    </Text>
                    <Text style={styles.userRole}>शाखा व्यवस्थापक (Branch Manager)</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>लॉगआउट 🚪</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Big Action Button */}
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

                {/* Orders List Section */}
                <View style={styles.listHeaderRow}>
                    <Text style={styles.sectionHeader}>मागवलेल्या ऑर्डर्सची यादी</Text>
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
                ) : orders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📦</Text>
                        <Text style={styles.emptyTitle}>अद्याप कोणतीही ऑर्डर नाही</Text>
                        <Text style={styles.emptySubtitle}>
                            वर दिलेल्या बटणावर क्लिक करून आजच्या सामानाची पहिली लिस्ट पाठवा.
                        </Text>
                    </View>
                ) : (
                    orders.map((item) => {
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
                                    <Text style={styles.itemsCount}>
                                        🛒 {item.total_items} सामानाचे आयटम
                                    </Text>

                                    {/* Bill Status Indicator */}
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
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    branchHeader: {
        flex: 1,
    },
    branchBadge: {
        fontSize: 11,
        fontWeight: "800",
        color: "#16A34A",
        backgroundColor: "#DCFCE7",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 4,
    },
    branchTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    userRole: {
        fontSize: 12,
        color: "#64748B",
    },
    logoutBtn: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    logoutText: {
        color: "#DC2626",
        fontWeight: "700",
        fontSize: 12,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 35,
    },
    createOrderBtn: {
        backgroundColor: "#16A34A",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#16A34A",
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    createBtnContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    plusCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    plusIcon: {
        color: "#FFFFFF",
        fontSize: 24,
        fontWeight: "900",
    },
    createBtnTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
    createBtnSubtitle: {
        color: "#DCFCE7",
        fontSize: 12,
        marginTop: 2,
    },
    createBtnArrow: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "700",
        marginLeft: 10,
    },
    sectionHeader: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 22,
        gap: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderLeftWidth: 4,
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
        marginTop: 4,
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    refreshLink: {
        color: "#16A34A",
        fontSize: 12,
        fontWeight: "700",
    },
    emptyContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 30,
        alignItems: "center",
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
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 18,
    },
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 1,
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
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    orderNotes: {
        fontSize: 12,
        color: "#475569",
        marginTop: 8,
        fontStyle: "italic",
    },
    cardDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginVertical: 12,
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
        paddingHorizontal: 10,
        paddingVertical: 4,
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
        color: "#15803D",
    },
    billBadgeTextPending: {
        color: "#B45309",
    },
});
