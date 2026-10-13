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
    Image,
} from "react-native";
import api, { getMediaUrl } from "../../services/api";
import { clearAuthData, UserSession } from "../../services/storage";

interface Props {
    user: UserSession;
    onLogout: () => void;
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
    user_name: string;
}

interface Franchise {
    id: number;
    name: string;
    code: string;
}

export default function AdminDashboardScreen({
    user,
    onLogout,
    onViewOrder,
}: Props) {
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [selectedFranchiseId, setSelectedFranchiseId] = useState<number | null>(
        null
    );
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [ordersRes, franchisesRes] = await Promise.all([
                api.get("/orders", {
                    params: {
                        franchise_id: selectedFranchiseId || undefined,
                        status: selectedStatus || undefined,
                    },
                }),
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
    }, [selectedFranchiseId, selectedStatus]);

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

    // Calculate Summary Stats from All Loaded
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const approvedOrders = orders.filter((o) => o.status === "approved").length;
    const dispatchedOrders = orders.filter((o) => o.status === "dispatched").length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered").length;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "pending":
                return { bg: "#FEF3C7", text: "#D97706", label: "प्रलंबित" };
            case "approved":
                return { bg: "#DBEAFE", text: "#2563EB", label: "मंजूर" };
            case "dispatched":
                return { bg: "#E0E7FF", text: "#4F46E5", label: "मार्गस्थ" };
            case "delivered":
                return { bg: "#DCFCE7", text: "#16A34A", label: "डिलिव्हर" };
            default:
                return { bg: "#F1F5F9", text: "#64748B", label: status };
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.topBar}>
                <View>
                    <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>👑 CENTRAL ADMIN</Text>
                    </View>
                    <Text style={styles.adminTitle}>मार्ट मुख्य ॲडमिन</Text>
                    <Text style={styles.adminSubtitle}>सर्व ४ फ्रँचायझी ऑर्डर्स फीड</Text>
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
                {/* Stats Overview */}
                <Text style={styles.sectionTitle}>एकूण सारांश (Overview)</Text>
                <View style={styles.statsRow}>
                    <View style={[styles.statBox, { borderLeftColor: "#2563EB" }]}>
                        <Text style={styles.statNum}>{totalOrders}</Text>
                        <Text style={styles.statTxt}>एकूण ऑर्डर्स</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#F59E0B" }]}>
                        <Text style={styles.statNum}>{pendingOrders}</Text>
                        <Text style={styles.statTxt}>⏳ प्रलंबित</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#4F46E5" }]}>
                        <Text style={styles.statNum}>{dispatchedOrders}</Text>
                        <Text style={styles.statTxt}>🚚 मार्गस्थ</Text>
                    </View>
                    <View style={[styles.statBox, { borderLeftColor: "#16A34A" }]}>
                        <Text style={styles.statNum}>{deliveredOrders}</Text>
                        <Text style={styles.statTxt}>✅ पूर्ण</Text>
                    </View>
                </View>

                {/* Filter By Branch (Franchise Filter) */}
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
                    🏢 शाखा निवडा (Filter by Branch):
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                >
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            selectedFranchiseId === null && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedFranchiseId(null)}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                selectedFranchiseId === null &&
                                    styles.filterChipTextActive,
                            ]}
                        >
                            सर्व ४ शाखा (All Branches)
                        </Text>
                    </TouchableOpacity>

                    {franchises.map((f) => {
                        const active = selectedFranchiseId === f.id;
                        return (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => setSelectedFranchiseId(f.id)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        active && styles.filterChipTextActive,
                                    ]}
                                >
                                    {f.code} • {f.name.replace("Mart Express - ", "")}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Orders Feed */}
                <View style={styles.listHeaderRow}>
                    <Text style={styles.sectionTitle}>
                        ऑर्डर्स यादी ({orders.length})
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
                ) : orders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyTitle}>कोणतीही ऑर्डर सापडली नाही</Text>
                        <Text style={styles.emptySubtitle}>
                            निवडलेल्या शाखेकडून किंवा स्टेटससाठी अजून ऑर्डर आलेली नाही.
                        </Text>
                    </View>
                ) : (
                    orders.map((item) => {
                        const badge = getStatusStyle(item.status);
                        const hasBill = !!item.bill_image_url;
                        const billThumb = getMediaUrl(item.bill_image_url);

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
                                                {item.franchise_code} • {item.franchise_name}
                                            </Text>
                                        </View>
                                        <Text style={styles.orderId}>
                                            ऑर्डर #{item.id}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusPill,
                                            { backgroundColor: badge.bg },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusPillText,
                                                { color: badge.text },
                                            ]}
                                        >
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.orderDate}>
                                    📅 {new Date(item.created_at).toLocaleString("mr-IN", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </Text>

                                {item.notes ? (
                                    <Text style={styles.notesText} numberOfLines={1}>
                                        📝 {item.notes}
                                    </Text>
                                ) : null}

                                <View style={styles.cardDivider} />

                                <View style={styles.cardBottomRow}>
                                    <Text style={styles.itemCountText}>
                                        🛒 {item.total_items} सामानाचे आयटम
                                    </Text>

                                    {/* Bill Indicator / Thumbnail */}
                                    {hasBill && billThumb ? (
                                        <View style={styles.billWithThumb}>
                                            <Image
                                                source={{ uri: billThumb }}
                                                style={styles.billThumb}
                                            />
                                            <Text style={styles.billUploadedText}>
                                                बिल फोटो ✅
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.noBillBadge}>
                                            <Text style={styles.noBillBadgeText}>
                                                बिल बाकी ⚠️
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
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    adminBadge: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: "flex-start",
        marginBottom: 4,
    },
    adminBadgeText: {
        color: "#2563EB",
        fontWeight: "800",
        fontSize: 10,
    },
    adminTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    adminSubtitle: {
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
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 10,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 18,
        gap: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderLeftWidth: 4,
    },
    statNum: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    statTxt: {
        fontSize: 10,
        color: "#64748B",
        fontWeight: "700",
        marginTop: 4,
    },
    filterScroll: {
        marginBottom: 16,
    },
    filterChip: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    filterChipTextActive: {
        color: "#FFFFFF",
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    refreshLink: {
        color: "#2563EB",
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
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
    },
    emptySubtitle: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
        marginTop: 4,
    },
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    branchTag: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: "flex-start",
        marginBottom: 4,
    },
    branchTagText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#0F172A",
    },
    orderId: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    orderDate: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 4,
    },
    notesText: {
        fontSize: 12,
        color: "#64748B",
        fontStyle: "italic",
        marginTop: 6,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: "800",
    },
    cardDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginVertical: 10,
    },
    cardBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    itemCountText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    billWithThumb: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    billThumb: {
        width: 24,
        height: 24,
        borderRadius: 4,
    },
    billUploadedText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#15803D",
    },
    noBillBadge: {
        backgroundColor: "#FEF3C7",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    noBillBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#B45309",
    },
});
