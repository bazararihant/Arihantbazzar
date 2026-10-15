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
    TextInput,
    Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { UserSession } from "../../services/storage";

interface Props {
    user: UserSession;
    onBack: () => void;
    onViewOrder: (orderId: number) => void;
    initialTab?: "orders" | "report";
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

interface ExpenseSummary {
    total_orders: number;
    total_expense: number;
    avg_expense: number;
    delivered_orders: number;
    pending_orders: number;
    billed_orders: number;
}

interface DailyExpense {
    date: string;
    orders_count: number;
    daily_expense: number;
}

interface TopItem {
    item_name: string;
    unit: string;
    total_quantity: number;
    orders_count: number;
}

interface ExpenseReportResponse {
    summary: ExpenseSummary;
    daily: DailyExpense[];
    topItems: TopItem[];
}

type MainTabType = "orders" | "report";
type DateFilterType = "all" | "today" | "yesterday" | "this_week" | "this_month" | "custom";
type ReportModeType = "month" | "year" | "custom";

const MONTHS_MR = [
    { num: 1, name: "जानेवारी" },
    { num: 2, name: "फेब्रुवारी" },
    { num: 3, name: "मार्च" },
    { num: 4, name: "एप्रिल" },
    { num: 5, name: "मे" },
    { num: 6, name: "जून" },
    { num: 7, name: "जुलै" },
    { num: 8, name: "ऑगस्ट" },
    { num: 9, name: "सप्टेंबर" },
    { num: 10, name: "ऑक्टोबर" },
    { num: 11, name: "नोव्हेंबर" },
    { num: 12, name: "डिसेंबर" },
];

export default function OrderHistoryScreen({
    user,
    onBack,
    onViewOrder,
    initialTab = "orders",
}: Props) {
    const insets = useSafeAreaInsets();
    const isAdmin = user.role === "admin" || user.role === "sub_admin";
    const [currentTab, setCurrentTab] = useState<MainTabType>(isAdmin ? initialTab : "orders");

    // ==================== ORDERS LIST STATE ====================
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters for Orders List
    const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Custom Date Range Modal for Orders List
    const [customModalVisible, setCustomModalVisible] = useState(false);
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    // ==================== EXPENSE REPORT STATE ====================
    const now = new Date();
    const [reportMode, setReportMode] = useState<ReportModeType>("month");
    const [reportMonth, setReportMonth] = useState<number>(now.getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(now.getFullYear());
    const [repStartDate, setRepStartDate] = useState<string>("");
    const [repEndDate, setRepEndDate] = useState<string>("");

    // Month-to-Month custom range picker (e.g. June 2025 to Feb 2026)
    const [customStartMonth, setCustomStartMonth] = useState<number>(6); // June
    const [customStartYear, setCustomStartYear] = useState<number>(now.getFullYear() - 1);
    const [customEndMonth, setCustomEndMonth] = useState<number>(2); // Feb
    const [customEndYear, setCustomEndYear] = useState<number>(now.getFullYear());

    const [reportData, setReportData] = useState<ExpenseReportResponse | null>(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Load All Orders
    const loadOrders = useCallback(async () => {
        try {
            setLoadingOrders(true);
            const res = await api.get("/orders");
            setOrders(res.data.orders || []);
        } catch (error: any) {
            console.error("History load error:", error);
            Alert.alert(
                "डेटा लोड अयशस्वी",
                error?.response?.data?.message || "इतिहास ऑर्डर्स लोड करता आल्या नाहीत"
            );
        } finally {
            setLoadingOrders(false);
            setRefreshing(false);
        }
    }, []);

    // Load Expense Report
    const loadExpenseReport = useCallback(async () => {
        if (!isAdmin) {
            setReportLoading(false);
            return;
        }
        try {
            setReportLoading(true);
            const params: any = {};

            if (reportMode === "month") {
                params.month = reportMonth;
                params.year = reportYear;
            } else if (reportMode === "year") {
                params.year = reportYear;
            } else if (reportMode === "custom") {
                if (repStartDate) params.start_date = repStartDate;
                if (repEndDate) params.end_date = repEndDate;
            }

            const res = await api.get("/orders/reports/expense", { params });
            setReportData(res.data);
        } catch (error: any) {
            console.error("Expense report error:", error);
            // If backend reports endpoint is not yet live, calculate locally from loaded orders
            calculateLocalExpenseReport();
        } finally {
            setReportLoading(false);
        }
    }, [reportMode, reportMonth, reportYear, repStartDate, repEndDate]);

    // Local fallback calculation if endpoint is transitioning
    const calculateLocalExpenseReport = () => {
        let filtered = [...orders];

        if (reportMode === "month") {
            filtered = filtered.filter((o) => {
                const d = new Date(o.created_at);
                return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
            });
        } else if (reportMode === "year") {
            filtered = filtered.filter((o) => {
                const d = new Date(o.created_at);
                return d.getFullYear() === reportYear;
            });
        } else if (reportMode === "custom") {
            if (repStartDate) {
                filtered = filtered.filter((o) => o.created_at && o.created_at.split("T")[0] >= repStartDate);
            }
            if (repEndDate) {
                filtered = filtered.filter((o) => o.created_at && o.created_at.split("T")[0] <= repEndDate);
            }
        }

        const totalOrders = filtered.length;
        const totalExpense = filtered.reduce((s, o) => s + (o.bill_amount ? parseFloat(o.bill_amount) : 0), 0);
        const billedOrders = filtered.filter((o) => o.bill_image_url || (o.bill_amount && parseFloat(o.bill_amount) > 0)).length;
        const deliveredOrders = filtered.filter((o) => o.status === "delivered").length;
        const pendingOrders = filtered.filter((o) => o.status === "pending").length;
        const avgExpense = billedOrders > 0 ? Math.round(totalExpense / billedOrders) : 0;

        // Daily map
        const dailyMap: { [date: string]: { count: number; expense: number } } = {};
        filtered.forEach((o) => {
            const dStr = o.created_at ? o.created_at.split("T")[0] : "इतर";
            if (!dailyMap[dStr]) dailyMap[dStr] = { count: 0, expense: 0 };
            dailyMap[dStr].count += 1;
            dailyMap[dStr].expense += o.bill_amount ? parseFloat(o.bill_amount) : 0;
        });

        const dailyList = Object.keys(dailyMap)
            .sort((a, b) => b.localeCompare(a))
            .map((d) => ({
                date: d,
                orders_count: dailyMap[d].count,
                daily_expense: dailyMap[d].expense,
            }));

        setReportData({
            summary: {
                total_orders: totalOrders,
                total_expense: totalExpense,
                avg_expense: avgExpense,
                delivered_orders: deliveredOrders,
                pending_orders: pendingOrders,
                billed_orders: billedOrders,
            },
            daily: dailyList,
            topItems: [],
        });
    };

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        if (currentTab === "report") {
            loadExpenseReport();
        }
    }, [currentTab, loadExpenseReport]);

    const onRefresh = () => {
        setRefreshing(true);
        if (currentTab === "orders") {
            loadOrders();
        } else {
            loadExpenseReport();
            setRefreshing(false);
        }
    };

    // Filter Logic for Orders List Tab
    const filteredOrders = useMemo(() => {
        const nowDate = new Date();
        const todayStr = nowDate.toISOString().split("T")[0];

        const yesterday = new Date(nowDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const weekAgo = new Date(nowDate);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);

        return orders.filter((order) => {
            const orderDateObj = new Date(order.created_at);
            const orderDateStr = order.created_at ? order.created_at.split("T")[0] : "";

            if (dateFilter === "today") {
                if (orderDateStr !== todayStr) return false;
            } else if (dateFilter === "yesterday") {
                if (orderDateStr !== yesterdayStr) return false;
            } else if (dateFilter === "this_week") {
                if (orderDateObj < weekAgo) return false;
            } else if (dateFilter === "this_month") {
                if (orderDateObj < startOfMonth) return false;
            } else if (dateFilter === "custom") {
                if (customStartDate && orderDateStr < customStartDate) return false;
                if (customEndDate && orderDateStr > customEndDate) return false;
            }

            if (selectedStatus && order.status !== selectedStatus) {
                return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const idMatch = String(order.id).includes(q);
                const notesMatch = order.notes && order.notes.toLowerCase().includes(q);
                const branchMatch = order.franchise_name && order.franchise_name.toLowerCase().includes(q);
                const userMatch = order.user_name && order.user_name.toLowerCase().includes(q);

                if (!idMatch && !notesMatch && !branchMatch && !userMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [orders, dateFilter, selectedStatus, searchQuery, customStartDate, customEndDate]);

    // Summary calculations for orders tab
    const totalCount = filteredOrders.length;
    const totalItemsCount = filteredOrders.reduce((sum, o) => sum + (o.total_items || 0), 0);
    const totalBillAmount = filteredOrders.reduce(
        (sum, o) => sum + (o.bill_amount ? parseFloat(o.bill_amount) : 0),
        0
    );

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

    const handleApplyCustomDate = () => {
        if (!customStartDate && !customEndDate) {
            Alert.alert("माहिती द्या", "कृपया सुरुवातीची किंवा शेवटची तारीख निवडा.");
            return;
        }
        setDateFilter("custom");
        setCustomModalVisible(false);
    };

    const handleQuickSetDays = (daysAgo: number) => {
        const d = new Date();
        const end = d.toISOString().split("T")[0];
        d.setDate(d.getDate() - daysAgo);
        const start = d.toISOString().split("T")[0];
        setCustomStartDate(start);
        setCustomEndDate(end);
    };

    const handlePresetReportRange = (daysAgo: number) => {
        const d = new Date();
        const end = d.toISOString().split("T")[0];
        d.setDate(d.getDate() - daysAgo);
        const start = d.toISOString().split("T")[0];
        setRepStartDate(start);
        setRepEndDate(end);
    };

    const handlePresetLastYear = () => {
        const prevYear = new Date().getFullYear() - 1;
        setRepStartDate(`${prevYear}-01-01`);
        setRepEndDate(`${prevYear}-12-31`);
    };

    const handlePresetCurrentYear = () => {
        const currYear = new Date().getFullYear();
        setRepStartDate(`${currYear}-01-01`);
        setRepEndDate(`${currYear}-12-31`);
    };

    const handlePresetFinancialYear = () => {
        const d = new Date();
        const currYear = d.getFullYear();
        const isEarly = d.getMonth() < 3; // Jan-Mar
        const fyStart = isEarly ? currYear - 1 : currYear;
        const fyEnd = fyStart + 1;
        setRepStartDate(`${fyStart}-04-01`);
        setRepEndDate(`${fyEnd}-03-31`);
    };

    const handleApplyMonthRange = () => {
        const sMonthStr = String(customStartMonth).padStart(2, "0");
        const sDate = `${customStartYear}-${sMonthStr}-01`;

        const lastDay = new Date(customEndYear, customEndMonth, 0).getDate();
        const eMonthStr = String(customEndMonth).padStart(2, "0");
        const eDate = `${customEndYear}-${eMonthStr}-${String(lastDay).padStart(2, "0")}`;

        setRepStartDate(sDate);
        setRepEndDate(eDate);
    };

    // Label for current selected report period
    const reportPeriodLabel = useMemo(() => {
        if (reportMode === "month") {
            const m = MONTHS_MR.find((x) => x.num === reportMonth)?.name || "";
            return `${m} ${reportYear}`;
        }
        if (reportMode === "year") {
            return `सन ${reportYear} (संपूर्ण वर्ष)`;
        }
        if (reportMode === "custom") {
            if (repStartDate && repEndDate) return `${repStartDate} ते ${repEndDate}`;
            if (repStartDate) return `${repStartDate} पासून`;
            if (repEndDate) return `${repEndDate} पर्यंत`;
            return "सानुकूल कालावधी";
        }
        return "";
    }, [reportMode, reportMonth, reportYear, repStartDate, repEndDate]);

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>◀ मागे</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={styles.headerTitle}>📜 इतिहास आणि अहवाल</Text>
                    <Text style={styles.headerSubtitle}>अरिहंत बाजार (भिलवडी, सांगली)</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                    <Text style={{ fontSize: 16 }}>🔄</Text>
                </TouchableOpacity>
            </View>

            {/* MAIN SEGMENTED NAVIGATION TABS */}
            <View style={styles.segmentContainer}>
                <TouchableOpacity
                    style={[styles.segmentBtn, currentTab === "orders" && styles.segmentBtnActive]}
                    onPress={() => setCurrentTab("orders")}
                >
                    <Text
                        style={[
                            styles.segmentBtnText,
                            currentTab === "orders" && styles.segmentBtnTextActive,
                        ]}
                    >
                        📋 ऑर्डर्स यादी ({orders.length})
                    </Text>
                </TouchableOpacity>

                {isAdmin && (
                    <TouchableOpacity
                        style={[styles.segmentBtn, currentTab === "report" && styles.segmentBtnActiveReport]}
                        onPress={() => setCurrentTab("report")}
                    >
                        <Text
                            style={[
                                styles.segmentBtnText,
                                currentTab === "report" && styles.segmentBtnTextActiveReport,
                            ]}
                        >
                            📊 मासिक खर्च अहवाल
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* TAB 1: ORDERS LIST VIEW */}
            {currentTab === "orders" && (
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 30, 48) }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ऑर्डर #ID किंवा साहित्याचे नाव शोधा..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Text style={styles.clearSearchText}>✕</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* DATE FILTER PILLS */}
                    <Text style={styles.filterSectionTitle}>📅 तारीखनिहाय फिल्टर करा:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "all" && styles.dateChipActive]}
                            onPress={() => setDateFilter("all")}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "all" && styles.dateChipTextActive]}>
                                सर्व इतिहास (All)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "today" && styles.dateChipActive]}
                            onPress={() => setDateFilter("today")}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "today" && styles.dateChipTextActive]}>
                                आज (Today)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "yesterday" && styles.dateChipActive]}
                            onPress={() => setDateFilter("yesterday")}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "yesterday" && styles.dateChipTextActive]}>
                                काल (Yesterday)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "this_week" && styles.dateChipActive]}
                            onPress={() => setDateFilter("this_week")}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "this_week" && styles.dateChipTextActive]}>
                                चालू आठवडा (Week)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "this_month" && styles.dateChipActive]}
                            onPress={() => setDateFilter("this_month")}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "this_month" && styles.dateChipTextActive]}>
                                चालू महिना (Month)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dateChip, dateFilter === "custom" && styles.dateChipActive]}
                            onPress={() => setCustomModalVisible(true)}
                        >
                            <Text style={[styles.dateChipText, dateFilter === "custom" && styles.dateChipTextActive]}>
                                {dateFilter === "custom" && customStartDate
                                    ? `📅 ${customStartDate} ते ${customEndDate || "आज"}`
                                    : "📅 तारीख निवडा (Custom)"}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* STATUS FILTER CHIPS */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                        {[
                            { label: "सर्व स्टेटस", value: null },
                            { label: "⏳ प्रलंबित", value: "pending" },
                            { label: "📋 मंजूर", value: "approved" },
                            { label: "🚚 मार्गस्थ", value: "dispatched" },
                            { label: "✅ पूर्ण", value: "delivered" },
                            { label: "❌ नाकारले", value: "rejected" },
                        ].map((chip, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.statusChip,
                                    selectedStatus === chip.value && styles.statusChipActive,
                                ]}
                                onPress={() => setSelectedStatus(chip.value)}
                            >
                                <Text
                                    style={[
                                        styles.statusChipText,
                                        selectedStatus === chip.value && styles.statusChipTextActive,
                                    ]}
                                >
                                    {chip.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* SUMMARY OVERVIEW CARD */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryBox}>
                            <Text style={styles.summaryNum}>{totalCount}</Text>
                            <Text style={styles.summaryLbl}>एकूण ऑर्डर्स</Text>
                        </View>
                        <View style={styles.summaryBox}>
                            <Text style={[styles.summaryNum, { color: "#16A34A" }]}>{totalItemsCount}</Text>
                            <Text style={styles.summaryLbl}>एकूण वस्तू</Text>
                        </View>
                        <View style={styles.summaryBox}>
                            {isAdmin ? (
                                <>
                                    <Text style={[styles.summaryNum, { color: "#2563EB" }]}>
                                        ₹{totalBillAmount.toLocaleString("en-IN")}
                                    </Text>
                                    <Text style={styles.summaryLbl}>बिलांची रक्कम</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.summaryNum, { color: "#D97706" }]}>
                                        {filteredOrders.filter((o) => o.status === "pending").length}
                                    </Text>
                                    <Text style={styles.summaryLbl}>प्रलंबित ऑर्डर्स</Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* FILTERED ORDERS LIST */}
                    <View style={styles.listHeaderRow}>
                        <Text style={styles.listTitle}>
                            ऑर्डर्स यादी ({filteredOrders.length})
                        </Text>
                        {(dateFilter !== "all" || selectedStatus !== null || searchQuery) && (
                            <TouchableOpacity
                                onPress={() => {
                                    setDateFilter("all");
                                    setSelectedStatus(null);
                                    setSearchQuery("");
                                }}
                            >
                                <Text style={styles.resetFilterText}>फिल्टर काढा ✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {loadingOrders ? (
                        <View style={styles.loaderBox}>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text style={styles.loaderText}>ऑर्डर इतिहास लोड होत आहे...</Text>
                        </View>
                    ) : filteredOrders.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyTitle}>कोणतीही ऑर्डर आढळली नाही</Text>
                            <Text style={styles.emptySub}>
                                कृपया तारीख किंवा स्टेटस फिल्टर बदलून पुन्हा प्रयत्न करा.
                            </Text>
                        </View>
                    ) : (
                        filteredOrders.map((order) => {
                            const st = getStatusStyle(order.status);
                            const orderDate = new Date(order.created_at).toLocaleDateString(
                                "mr-IN",
                                {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }
                            );

                            return (
                                <TouchableOpacity
                                    key={order.id}
                                    style={styles.orderCard}
                                    onPress={() => onViewOrder(order.id)}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.orderCardTop}>
                                        <View>
                                            <View style={styles.orderIdBadge}>
                                                <Text style={styles.orderIdText}>#{order.id}</Text>
                                            </View>
                                            <Text style={styles.orderDateText}>{orderDate}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                            <Text style={[styles.statusText, { color: st.text }]}>
                                                {st.label}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.orderDivider} />

                                    <View style={styles.orderCardBody}>
                                        <View style={styles.orderInfoRow}>
                                            <Text style={styles.orderInfoLabel}>📍 शाखा:</Text>
                                            <Text style={styles.orderInfoVal}>
                                                {order.franchise_name || "अरिहंत बाजार भिलवडी"}
                                            </Text>
                                        </View>

                                        <View style={styles.orderInfoRow}>
                                            <Text style={styles.orderInfoLabel}>👤 नोंदवणारे:</Text>
                                            <Text style={styles.orderInfoVal}>
                                                {order.user_name || "मॅनेजर"}
                                            </Text>
                                        </View>

                                        <View style={styles.orderInfoRow}>
                                            <Text style={styles.orderInfoLabel}>📦 साहित्याची संख्या:</Text>
                                            <Text style={[styles.orderInfoVal, { fontWeight: "800", color: "#0F172A" }]}>
                                                {order.total_items || 0} वस्तू
                                            </Text>
                                        </View>

                                        {isAdmin && order.bill_amount ? (
                                            <View style={styles.orderInfoRow}>
                                                <Text style={styles.orderInfoLabel}>💵 बिलाची रक्कम:</Text>
                                                <Text style={[styles.orderInfoVal, { fontWeight: "800", color: "#16A34A" }]}>
                                                    ₹ {parseFloat(order.bill_amount).toLocaleString("en-IN")}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {order.notes ? (
                                            <View style={styles.notesBox}>
                                                <Text style={styles.notesText} numberOfLines={2}>
                                                    📝 {order.notes}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    <View style={styles.orderCardFooter}>
                                        <Text style={styles.viewDetailText}>तपशील व साहित्य यादी पहा ➔</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* TAB 2: MONTHLY & CUSTOM EXPENSE REPORT */}
            {currentTab === "report" && (
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 30, 48) }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* REPORT MODE SWITCHER PILLS */}
                    <View style={styles.reportModeRow}>
                        <TouchableOpacity
                            style={[
                                styles.reportModeBtn,
                                reportMode === "month" && styles.reportModeBtnActive,
                            ]}
                            onPress={() => setReportMode("month")}
                        >
                            <Text
                                style={[
                                    styles.reportModeText,
                                    reportMode === "month" && styles.reportModeTextActive,
                                ]}
                            >
                                📅 महिना निवडा
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.reportModeBtn,
                                reportMode === "year" && styles.reportModeBtnActive,
                            ]}
                            onPress={() => setReportMode("year")}
                        >
                            <Text
                                style={[
                                    styles.reportModeText,
                                    reportMode === "year" && styles.reportModeTextActive,
                                ]}
                            >
                                📆 संपूर्ण वर्ष
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.reportModeBtn,
                                reportMode === "custom" && styles.reportModeBtnActive,
                            ]}
                            onPress={() => setReportMode("custom")}
                        >
                            <Text
                                style={[
                                    styles.reportModeText,
                                    reportMode === "custom" && styles.reportModeTextActive,
                                ]}
                            >
                                ⏳ तारीख ते तारीख
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* SELECTOR BAR FOR REPORT MODE */}
                    <View style={styles.filterCard}>
                        {reportMode === "month" && (
                            <View>
                                <View style={styles.yearRow}>
                                    <Text style={styles.filterCardLabel}>वर्ष निवडा:</Text>
                                    {[2024, 2025, 2026, 2027].map((yr) => (
                                        <TouchableOpacity
                                            key={yr}
                                            style={[
                                                styles.yearPill,
                                                reportYear === yr && styles.yearPillActive,
                                            ]}
                                            onPress={() => setReportYear(yr)}
                                        >
                                            <Text
                                                style={[
                                                    styles.yearPillText,
                                                    reportYear === yr && styles.yearPillTextActive,
                                                ]}
                                            >
                                                {yr}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.filterCardLabel, { marginTop: 10, marginBottom: 6 }]}>
                                    महिना निवडा:
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {MONTHS_MR.map((m) => (
                                        <TouchableOpacity
                                            key={m.num}
                                            style={[
                                                styles.monthPill,
                                                reportMonth === m.num && styles.monthPillActive,
                                            ]}
                                            onPress={() => setReportMonth(m.num)}
                                        >
                                            <Text
                                                style={[
                                                    styles.monthPillText,
                                                    reportMonth === m.num && styles.monthPillTextActive,
                                                ]}
                                            >
                                                {m.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {reportMode === "year" && (
                            <View>
                                <Text style={styles.filterCardLabel}>वर्ष निवडा:</Text>
                                <View style={{ flexDirection: "row", marginTop: 8 }}>
                                    {[2024, 2025, 2026, 2027].map((yr) => (
                                        <TouchableOpacity
                                            key={yr}
                                            style={[
                                                styles.yearPill,
                                                reportYear === yr && styles.yearPillActive,
                                                { flex: 1, paddingVertical: 10 },
                                            ]}
                                            onPress={() => setReportYear(yr)}
                                        >
                                            <Text
                                                style={[
                                                    styles.yearPillText,
                                                    reportYear === yr && styles.yearPillTextActive,
                                                ]}
                                            >
                                                {yr}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {reportMode === "custom" && (
                            <View>
                                <Text style={styles.filterCardLabel}>तारीख मर्यादा निवडा (Start to End Date):</Text>

                                <View style={{ flexDirection: "row", marginTop: 8 }}>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <Text style={styles.inputMiniLabel}>सुरुवात तारीख</Text>
                                        <TextInput
                                            style={styles.dateInputCompact}
                                            placeholder="YYYY-MM-DD"
                                            value={repStartDate}
                                            onChangeText={setRepStartDate}
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 6 }}>
                                        <Text style={styles.inputMiniLabel}>शेवट तारीख</Text>
                                        <TextInput
                                            style={styles.dateInputCompact}
                                            placeholder="YYYY-MM-DD"
                                            value={repEndDate}
                                            onChangeText={setRepEndDate}
                                        />
                                    </View>
                                </View>

                                {/* Quick Range Presets Row 1 */}
                                <View style={styles.presetRow}>
                                    <TouchableOpacity
                                        style={styles.presetMiniBtn}
                                        onPress={() => handlePresetReportRange(30)}
                                    >
                                        <Text style={styles.presetMiniText}>मागील ३० दिवस</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.presetMiniBtn}
                                        onPress={() => {
                                            const d = new Date();
                                            const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
                                            const end = d.toISOString().split("T")[0];
                                            setRepStartDate(start);
                                            setRepEndDate(end);
                                        }}
                                    >
                                        <Text style={styles.presetMiniText}>चालू महिना</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.presetMiniBtn}
                                        onPress={() => handlePresetReportRange(180)}
                                    >
                                        <Text style={styles.presetMiniText}>मागील ६ महिने</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Quick Range Presets Row 2 (Year Presets) */}
                                <View style={[styles.presetRow, { marginTop: 6 }]}>
                                    <TouchableOpacity
                                        style={[styles.presetMiniBtn, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}
                                        onPress={handlePresetLastYear}
                                    >
                                        <Text style={[styles.presetMiniText, { color: "#B45309" }]}>
                                            📌 मागील वर्ष ({new Date().getFullYear() - 1})
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.presetMiniBtn, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                                        onPress={handlePresetCurrentYear}
                                    >
                                        <Text style={[styles.presetMiniText, { color: "#1D4ED8" }]}>
                                            📌 चालू वर्ष ({new Date().getFullYear()})
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.presetMiniBtn, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}
                                        onPress={handlePresetFinancialYear}
                                    >
                                        <Text style={[styles.presetMiniText, { color: "#15803D" }]}>
                                            📊 आर्थिक वर्ष (FY)
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Month-to-Month Custom Picker (उदा. जून ते फेब्रुवारी) */}
                                <View style={styles.monthRangeBox}>
                                    <Text style={styles.monthRangeHeaderTitle}>
                                        🗓️ महिना ते महिना झटपट निवडा (Month Range):
                                    </Text>

                                    <View style={styles.monthRangeColumnsRow}>
                                        {/* From Month & Year */}
                                        <View style={{ flex: 1, marginRight: 4 }}>
                                            <Text style={styles.miniHeaderLbl}>सुरुवात महिना:</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                                                {MONTHS_MR.map((m) => (
                                                    <TouchableOpacity
                                                        key={`s-${m.num}`}
                                                        style={[
                                                            styles.monthChip,
                                                            customStartMonth === m.num && styles.monthChipActive,
                                                        ]}
                                                        onPress={() => setCustomStartMonth(m.num)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.monthChipText,
                                                                customStartMonth === m.num && styles.monthChipTextActive,
                                                            ]}
                                                        >
                                                            {m.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <View style={{ flexDirection: "row", gap: 4 }}>
                                                {[2024, 2025, 2026, 2027].map((yr) => (
                                                    <TouchableOpacity
                                                        key={`sy-${yr}`}
                                                        style={[
                                                            styles.yearChip,
                                                            customStartYear === yr && styles.yearChipActive,
                                                        ]}
                                                        onPress={() => setCustomStartYear(yr)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.yearChipText,
                                                                customStartYear === yr && styles.yearChipTextActive,
                                                            ]}
                                                        >
                                                            {yr}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        {/* To Month & Year */}
                                        <View style={{ flex: 1, marginLeft: 4 }}>
                                            <Text style={styles.miniHeaderLbl}>शेवट महिना:</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                                                {MONTHS_MR.map((m) => (
                                                    <TouchableOpacity
                                                        key={`e-${m.num}`}
                                                        style={[
                                                            styles.monthChip,
                                                            customEndMonth === m.num && styles.monthChipActive,
                                                        ]}
                                                        onPress={() => setCustomEndMonth(m.num)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.monthChipText,
                                                                customEndMonth === m.num && styles.monthChipTextActive,
                                                            ]}
                                                        >
                                                            {m.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <View style={{ flexDirection: "row", gap: 4 }}>
                                                {[2024, 2025, 2026, 2027].map((yr) => (
                                                    <TouchableOpacity
                                                        key={`ey-${yr}`}
                                                        style={[
                                                            styles.yearChip,
                                                            customEndYear === yr && styles.yearChipActive,
                                                        ]}
                                                        onPress={() => setCustomEndYear(yr)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.yearChipText,
                                                                customEndYear === yr && styles.yearChipTextActive,
                                                            ]}
                                                        >
                                                            {yr}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.applyMonthRangeBtn}
                                        onPress={handleApplyMonthRange}
                                    >
                                        <Text style={styles.applyMonthRangeBtnText}>
                                            ✅ {MONTHS_MR.find((m) => m.num === customStartMonth)?.name} {customStartYear} ते {MONTHS_MR.find((m) => m.num === customEndMonth)?.name} {customEndYear} निवडा
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.refreshReportBtn}
                            onPress={loadExpenseReport}
                        >
                            <Text style={styles.refreshReportBtnText}>
                                🔍 {reportPeriodLabel} अहवाल तपासा
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* EXPENSE REPORT CONTENT */}
                    {reportLoading ? (
                        <View style={styles.loaderBox}>
                            <ActivityIndicator size="large" color="#16A34A" />
                            <Text style={styles.loaderText}>खर्च अहवाल मोजला जात आहे...</Text>
                        </View>
                    ) : (
                        <View>
                            {/* GRAND EXPENSE BANNER CARD */}
                            <View style={styles.grandExpenseCard}>
                                <View style={styles.grandCardBadge}>
                                    <Text style={styles.grandCardBadgeText}>💰 एकूण खर्च सारांश</Text>
                                </View>
                                <Text style={styles.grandCardPeriod}>
                                    📅 {reportPeriodLabel}
                                </Text>
                                <Text style={styles.grandCardSubtitle}>
                                    🏢 अरिहंत बाजार (भिलवडी, सांगली)
                                </Text>

                                <View style={styles.grandAmountContainer}>
                                    <Text style={styles.grandCurrencySymbol}>₹</Text>
                                    <Text style={styles.grandAmountText}>
                                        {reportData?.summary?.total_expense
                                            ? Number(reportData.summary.total_expense).toLocaleString("en-IN")
                                            : "०"}
                                    </Text>
                                </View>
                                <Text style={styles.grandAmountNotice}>
                                    या कालावधीत खर्च झालेली एकूण रक्कम
                                </Text>

                                {/* 4 Grid Metric Cards */}
                                <View style={styles.grandGrid}>
                                    <View style={styles.grandGridCell}>
                                        <Text style={styles.grandCellNum}>
                                            {reportData?.summary?.total_orders || 0}
                                        </Text>
                                        <Text style={styles.grandCellLbl}>एकूण ऑर्डर्स</Text>
                                    </View>
                                    <View style={styles.grandGridCell}>
                                        <Text style={[styles.grandCellNum, { color: "#16A34A" }]}>
                                            {reportData?.summary?.billed_orders || 0}
                                        </Text>
                                        <Text style={styles.grandCellLbl}>बिल जोडलेल्या</Text>
                                    </View>
                                    <View style={styles.grandGridCell}>
                                        <Text style={[styles.grandCellNum, { color: "#3B82F6" }]}>
                                            ₹{reportData?.summary?.avg_expense ? Number(reportData.summary.avg_expense).toLocaleString("en-IN") : 0}
                                        </Text>
                                        <Text style={styles.grandCellLbl}>सरासरी खर्च/ऑर्डर</Text>
                                    </View>
                                    <View style={styles.grandGridCell}>
                                        <Text style={[styles.grandCellNum, { color: "#10B981" }]}>
                                            {reportData?.summary?.delivered_orders || 0}
                                        </Text>
                                        <Text style={styles.grandCellLbl}>डिलिव्हर ऑर्डर्स</Text>
                                    </View>
                                </View>
                            </View>

                            {/* DAILY EXPENSE BREAKDOWN */}
                            <View style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>
                                    📅 तारीखनिहाय खर्चाची विभागणी (Daily Expenses)
                                </Text>
                                <Text style={styles.sectionSubtitle}>
                                    प्रत्येक तारखेला किती ऑर्डर्स झाल्या व किती रक्कम खर्च झाली:
                                </Text>

                                {!reportData?.daily || reportData.daily.length === 0 ? (
                                    <View style={styles.emptyMiniBox}>
                                        <Text style={styles.emptyMiniText}>
                                            या कालावधीत कोणताही खर्च नोंदवलेला नाही.
                                        </Text>
                                    </View>
                                ) : (
                                    reportData.daily.map((item, idx) => {
                                        const dFormatted = new Date(item.date).toLocaleDateString("mr-IN", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        });

                                        return (
                                            <View key={idx} style={styles.dailyRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.dailyDate}>{dFormatted}</Text>
                                                    <Text style={styles.dailyOrdersCount}>
                                                        📦 {item.orders_count} ऑर्डर्स नोंदवल्या
                                                    </Text>
                                                </View>
                                                <View style={styles.dailyAmountBox}>
                                                    <Text style={styles.dailyAmountText}>
                                                        ₹ {Number(item.daily_expense).toLocaleString("en-IN")}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>

                            {/* TOP MATERIALS ORDERED */}
                            {reportData?.topItems && reportData.topItems.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>
                                        🛒 सर्वाधिक मागवलेले साहित्य (Top Materials)
                                    </Text>
                                    <Text style={styles.sectionSubtitle}>
                                        या कालावधीत सर्वाधिक प्रमाणात मागवले गेलेले साहित्य:
                                    </Text>

                                    {reportData.topItems.map((item, idx) => (
                                        <View key={idx} style={styles.topItemRow}>
                                            <View style={styles.topItemRank}>
                                                <Text style={styles.topItemRankText}>{idx + 1}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.topItemName}>{item.item_name}</Text>
                                                <Text style={styles.topItemSub}>
                                                    {item.orders_count} ऑर्डर्समध्ये मागवले
                                                </Text>
                                            </View>
                                            <View style={styles.topItemQtyBox}>
                                                <Text style={styles.topItemQty}>
                                                    {item.total_quantity} {item.unit}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* CUSTOM DATE RANGE MODAL FOR ORDERS LIST */}
            <Modal
                visible={customModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setCustomModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>📅 सानुकूल तारीख निवडा</Text>

                        {/* Quick Presets */}
                        <Text style={styles.quickPresetTitle}>द्रुत निवड (Quick Presets):</Text>
                        <View style={styles.quickPresetRow}>
                            <TouchableOpacity
                                style={styles.presetBtn}
                                onPress={() => handleQuickSetDays(3)}
                            >
                                <Text style={styles.presetBtnText}>मागील ३ दिवस</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.presetBtn}
                                onPress={() => handleQuickSetDays(7)}
                            >
                                <Text style={styles.presetBtnText}>मागील ७ दिवस</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.presetBtn}
                                onPress={() => handleQuickSetDays(15)}
                            >
                                <Text style={styles.presetBtnText}>१५ दिवस</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.presetBtn}
                                onPress={() => handleQuickSetDays(30)}
                            >
                                <Text style={styles.presetBtnText}>३० दिवस</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>सुरुवातीची तारीख (Start Date: YYYY-MM-DD):</Text>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="उदा. 2026-10-01"
                            placeholderTextColor="#94A3B8"
                            value={customStartDate}
                            onChangeText={setCustomStartDate}
                        />

                        <Text style={styles.inputLabel}>शेवटची तारीख (End Date: YYYY-MM-DD):</Text>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="उदा. 2026-10-31"
                            placeholderTextColor="#94A3B8"
                            value={customEndDate}
                            onChangeText={setCustomEndDate}
                        />

                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setCustomModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>रद्द करा</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalApplyBtn}
                                onPress={handleApplyCustomDate}
                            >
                                <Text style={styles.modalApplyText}>लागू करा (Apply)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
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
        fontWeight: "700",
        color: "#334155",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: "600",
        color: "#16A34A",
    },
    refreshBtn: {
        padding: 6,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },

    // Segmented Main Tabs
    segmentContainer: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
        marginHorizontal: 4,
        backgroundColor: "#F1F5F9",
    },
    segmentBtnActive: {
        backgroundColor: "#2563EB",
    },
    segmentBtnActiveReport: {
        backgroundColor: "#16A34A",
    },
    segmentBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
    },
    segmentBtnTextActive: {
        color: "#FFFFFF",
        fontWeight: "800",
    },
    segmentBtnTextActiveReport: {
        color: "#FFFFFF",
        fontWeight: "800",
    },

    scrollContent: {
        padding: 14,
    },

    // Search Bar
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        marginBottom: 12,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#0F172A",
        padding: 0,
    },
    clearSearchText: {
        fontSize: 16,
        color: "#94A3B8",
        fontWeight: "700",
        paddingHorizontal: 4,
    },

    // Date Filter Chips
    filterSectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 8,
    },
    filterScroll: {
        marginBottom: 10,
    },
    dateChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    dateChipActive: {
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
    },
    dateChipText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
    },
    dateChipTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
    },

    // Status Filter Chips
    statusScroll: {
        marginBottom: 14,
    },
    statusChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#F1F5F9",
        borderRadius: 16,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    statusChipActive: {
        backgroundColor: "#0F172A",
        borderColor: "#0F172A",
    },
    statusChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    statusChipTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
    },

    // Summary Card
    summaryCard: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    summaryBox: {
        flex: 1,
        alignItems: "center",
    },
    summaryNum: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    summaryLbl: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
        fontWeight: "600",
    },

    // List Header
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    resetFilterText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#DC2626",
    },

    // Order Card
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    orderCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    orderIdBadge: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: "flex-start",
        marginBottom: 4,
    },
    orderIdText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#1E293B",
    },
    orderDateText: {
        fontSize: 12,
        color: "#64748B",
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "700",
    },
    orderDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginVertical: 10,
    },
    orderCardBody: {
        marginBottom: 10,
    },
    orderInfoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    orderInfoLabel: {
        fontSize: 13,
        color: "#64748B",
    },
    orderInfoVal: {
        fontSize: 13,
        color: "#1E293B",
        fontWeight: "600",
    },
    notesBox: {
        backgroundColor: "#FFFBEB",
        padding: 8,
        borderRadius: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: "#FDE68A",
    },
    notesText: {
        fontSize: 12,
        color: "#92400E",
    },
    orderCardFooter: {
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        paddingTop: 8,
        alignItems: "flex-end",
    },
    viewDetailText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#2563EB",
    },

    // Loader & Empty
    loaderBox: {
        paddingVertical: 40,
        alignItems: "center",
    },
    loaderText: {
        fontSize: 14,
        color: "#64748B",
        marginTop: 10,
        fontWeight: "600",
    },
    emptyBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
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
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 4,
    },
    emptySub: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },

    // ==================== REPORT STYLES ====================
    reportModeRow: {
        flexDirection: "row",
        marginBottom: 12,
    },
    reportModeBtn: {
        flex: 1,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    reportModeBtnActive: {
        backgroundColor: "#0F172A",
        borderColor: "#0F172A",
    },
    reportModeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    reportModeTextActive: {
        color: "#FFFFFF",
    },

    filterCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    filterCardLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
    },
    yearRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    yearPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    yearPillActive: {
        backgroundColor: "#16A34A",
        borderColor: "#16A34A",
    },
    yearPillText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
        textAlign: "center",
    },
    yearPillTextActive: {
        color: "#FFFFFF",
    },
    monthPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    monthPillActive: {
        backgroundColor: "#16A34A",
        borderColor: "#16A34A",
    },
    monthPillText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#334155",
    },
    monthPillTextActive: {
        color: "#FFFFFF",
    },
    inputMiniLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#64748B",
        marginBottom: 2,
    },
    dateInputCompact: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 13,
        color: "#1E293B",
    },
    presetRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    presetMiniBtn: {
        flex: 1,
        paddingVertical: 6,
        backgroundColor: "#F1F5F9",
        borderRadius: 6,
        alignItems: "center",
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    presetMiniText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#334155",
    },
    refreshReportBtn: {
        backgroundColor: "#0F172A",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginTop: 14,
    },
    refreshReportBtnText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 13,
    },

    // Grand Expense Card
    grandExpenseCard: {
        backgroundColor: "#0F172A",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    grandCardBadge: {
        backgroundColor: "#1E293B",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: "flex-start",
        marginBottom: 8,
    },
    grandCardBadgeText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#38BDF8",
    },
    grandCardPeriod: {
        fontSize: 18,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    grandCardSubtitle: {
        fontSize: 12,
        color: "#94A3B8",
        marginTop: 2,
        marginBottom: 14,
    },
    grandAmountContainer: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginVertical: 4,
    },
    grandCurrencySymbol: {
        fontSize: 26,
        fontWeight: "800",
        color: "#22C55E",
        marginTop: 4,
        marginRight: 6,
    },
    grandAmountText: {
        fontSize: 38,
        fontWeight: "900",
        color: "#FFFFFF",
        letterSpacing: -0.5,
    },
    grandAmountNotice: {
        fontSize: 12,
        color: "#94A3B8",
        marginBottom: 16,
    },
    grandGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderTopWidth: 1,
        borderTopColor: "#334155",
        paddingTop: 14,
    },
    grandGridCell: {
        width: "50%",
        paddingVertical: 6,
    },
    grandCellNum: {
        fontSize: 18,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    grandCellLbl: {
        fontSize: 11,
        color: "#94A3B8",
        marginTop: 2,
    },

    // Section Cards
    sectionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    sectionSubtitle: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
        marginBottom: 12,
    },
    emptyMiniBox: {
        paddingVertical: 14,
        alignItems: "center",
    },
    emptyMiniText: {
        fontSize: 13,
        color: "#94A3B8",
        fontStyle: "italic",
    },
    dailyRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    dailyDate: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
    },
    dailyOrdersCount: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    dailyAmountBox: {
        backgroundColor: "#F0FDF4",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#BBF7D0",
    },
    dailyAmountText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#16A34A",
    },

    // Top Items
    topItemRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    topItemRank: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    topItemRankText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#475569",
    },
    topItemName: {
        fontSize: 14,
        fontWeight: "700",
        color: "#1E293B",
    },
    topItemSub: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    topItemQtyBox: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    topItemQty: {
        fontSize: 13,
        fontWeight: "800",
        color: "#2563EB",
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        width: "100%",
        maxWidth: 380,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 12,
        textAlign: "center",
    },
    quickPresetTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 6,
    },
    quickPresetRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    presetBtn: {
        flex: 1,
        paddingVertical: 7,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    presetBtnText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#334155",
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 4,
    },
    dateInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
        color: "#1E293B",
        marginBottom: 12,
    },
    modalBtnRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 11,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        alignItems: "center",
        marginRight: 8,
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748B",
    },
    modalApplyBtn: {
        flex: 1.5,
        paddingVertical: 11,
        backgroundColor: "#16A34A",
        borderRadius: 8,
        alignItems: "center",
        marginLeft: 8,
    },
    modalApplyText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    monthRangeBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
    },
    monthRangeHeaderTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 8,
    },
    monthRangeColumnsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    miniHeaderLbl: {
        fontSize: 10,
        fontWeight: "700",
        color: "#475569",
        textTransform: "uppercase",
    },
    monthChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        marginRight: 4,
    },
    monthChipActive: {
        backgroundColor: "#0F172A",
        borderColor: "#0F172A",
    },
    monthChipText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#475569",
    },
    monthChipTextActive: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
    yearChip: {
        flex: 1,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        alignItems: "center",
    },
    yearChipActive: {
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
    },
    yearChipText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#475569",
    },
    yearChipTextActive: {
        color: "#FFFFFF",
    },
    applyMonthRangeBtn: {
        backgroundColor: "#16A34A",
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: "center",
        marginTop: 10,
    },
    applyMonthRangeBtnText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
});
