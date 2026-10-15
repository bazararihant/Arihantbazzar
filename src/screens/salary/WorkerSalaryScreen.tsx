import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
    Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { UserSession } from "../../services/storage";

interface Worker {
    id: number;
    name: string;
    phone: string | null;
    designation: string;
    salary_type: string;
    monthly_salary: string | number;
    daily_wage: string | number;
    is_active: boolean;
    notes?: string | null;
}

interface AttendanceRecord {
    worker_id: number;
    worker_name: string;
    worker_phone: string | null;
    worker_designation: string;
    monthly_salary: string | number;
    daily_wage: string | number;
    attendance_id: number | null;
    status: "full_day" | "half_day" | "absent" | "unmarked";
    multiplier: number;
    notes: string | null;
}

interface AdvanceItem {
    id: number;
    worker_id: number;
    worker_name: string;
    amount: string | number;
    advance_date: string;
    payment_mode: string;
    notes: string | null;
    created_at?: string;
}

interface WorkerReport {
    worker_id: number;
    worker_name: string;
    worker_phone: string | null;
    designation: string;
    monthly_salary: number;
    daily_wage: number;
    full_days: number;
    half_days: number;
    absent_days: number;
    effective_working_days: number;
    earned_salary: number;
    total_advance: number;
    net_payable: number;
    advances: any[];
    attendance_logs: any[];
}

interface Props {
    currentUser: UserSession;
    onBack: () => void;
}

type TabType = "attendance" | "salary_overview" | "reports" | "workers";

export default function WorkerSalaryScreen({ currentUser, onBack }: Props) {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>("attendance");
    const [loading, setLoading] = useState(false);

    // Tab 1: Attendance State
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });
    const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
    const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
    const [savingAttendance, setSavingAttendance] = useState(false);

    // Tab 2 & 4: Workers State
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
    const [newWorkerName, setNewWorkerName] = useState("");
    const [newWorkerPhone, setNewWorkerPhone] = useState("");
    const [newWorkerDesignation, setNewWorkerDesignation] = useState("कामगार");
    const [newWorkerSalary, setNewWorkerSalary] = useState("");
    const [newWorkerDailyWage, setNewWorkerDailyWage] = useState("");
    const [savingWorker, setSavingWorker] = useState(false);

    // Advance Modal State
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [selectedWorkerForAdvance, setSelectedWorkerForAdvance] = useState<Worker | null>(null);
    const [advanceAmount, setAdvanceAmount] = useState("");
    const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [advanceNotes, setAdvanceNotes] = useState("");
    const [advancePaymentMode, setAdvancePaymentMode] = useState<"cash" | "upi">("cash");
    const [savingAdvance, setSavingAdvance] = useState(false);

    // Advance History Modal
    const [showAdvanceHistoryModal, setShowAdvanceHistoryModal] = useState(false);
    const [selectedWorkerAdvances, setSelectedWorkerAdvances] = useState<AdvanceItem[]>([]);
    const [historyWorkerName, setHistoryWorkerName] = useState("");

    // Tab 3: Report State
    const [reportMode, setReportMode] = useState<"monthly" | "custom">("monthly");
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;
    });
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        return new Date().toISOString().split("T")[0];
    });
    const [reportData, setReportData] = useState<{
        grand_totals: any;
        workers: WorkerReport[];
    } | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    // 1. Load Workers
    const loadWorkers = useCallback(async () => {
        try {
            const res = await api.get("/workers");
            setWorkers(res.data.workers || []);
        } catch (err: any) {
            console.error("Failed to load workers:", err);
        }
    }, []);

    // 2. Load Attendance for selectedDate
    const loadAttendance = useCallback(async (date: string) => {
        try {
            setLoading(true);
            const res = await api.get(`/workers/attendance/by-date?date=${date}`);
            setAttendanceList(res.data.records || []);
            setAttendanceSummary(res.data.summary || null);
        } catch (err: any) {
            console.error("Failed to load attendance:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "हजेरी लोड करता आली नाही");
        } finally {
            setLoading(false);
        }
    }, []);

    // 3. Load Report
    const loadReport = useCallback(async () => {
        try {
            setLoadingReport(true);
            let sDate = "";
            let eDate = "";

            if (reportMode === "monthly") {
                const [year, month] = selectedMonth.split("-");
                sDate = `${year}-${month}-01`;
                // Last day of month
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                eDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
            } else {
                sDate = customStartDate.trim();
                eDate = customEndDate.trim();
            }

            const res = await api.get(`/workers/reports/summary?startDate=${sDate}&endDate=${eDate}`);
            setReportData(res.data);
        } catch (err: any) {
            console.error("Failed to load report:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "अहवाल लोड करता आला नाही");
        } finally {
            setLoadingReport(false);
        }
    }, [reportMode, selectedMonth, customStartDate, customEndDate]);

    useEffect(() => {
        loadWorkers();
    }, [loadWorkers]);

    useEffect(() => {
        if (activeTab === "attendance") {
            loadAttendance(selectedDate);
        } else if (activeTab === "reports" || activeTab === "salary_overview") {
            loadReport();
        }
    }, [activeTab, selectedDate, loadAttendance, loadReport]);

    // Handle Attendance Status Change locally
    const handleSetStatus = (workerId: number, newStatus: "full_day" | "half_day" | "absent") => {
        setAttendanceList((prev) =>
            prev.map((item) => {
                if (item.worker_id === workerId) {
                    return {
                        ...item,
                        status: newStatus,
                        multiplier: newStatus === "full_day" ? 1.0 : newStatus === "half_day" ? 0.5 : 0.0,
                    };
                }
                return item;
            })
        );
    };

    // Save Attendance to Backend
    const handleSaveAttendance = async () => {
        try {
            setSavingAttendance(true);
            const recordsToSave = attendanceList
                .filter((item) => item.status !== "unmarked")
                .map((item) => ({
                    worker_id: item.worker_id,
                    status: item.status,
                    notes: item.notes || "",
                }));

            if (recordsToSave.length === 0) {
                Alert.alert("माहिती", "कृपया किमान एका कामगाराची हजेरी नोंदवा.");
                return;
            }

            await api.post("/workers/attendance", {
                date: selectedDate,
                records: recordsToSave,
            });

            Alert.alert("यशस्वी! ✅", `${selectedDate} ची हजेरी यशस्वीरित्या सेव्ह झाली.`);
            loadAttendance(selectedDate);
        } catch (err: any) {
            console.error("Failed to save attendance:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "हजेरी सेव्ह करता आली नाही");
        } finally {
            setSavingAttendance(false);
        }
    };

    // Shift date by +1 or -1 days
    const shiftDate = (days: number) => {
        const cur = new Date(selectedDate);
        cur.setDate(cur.getDate() + days);
        const nextDateStr = cur.toISOString().split("T")[0];
        setSelectedDate(nextDateStr);
    };

    // Handle Add Worker
    const handleCreateWorker = async () => {
        const cleanName = newWorkerName.trim();
        if (!cleanName) {
            Alert.alert("माहिती भरा", "कृपया कामगाराचे नाव टाका.");
            return;
        }

        const mSalary = parseFloat(newWorkerSalary) || 0;
        let dWage = parseFloat(newWorkerDailyWage) || 0;
        if (dWage <= 0 && mSalary > 0) {
            dWage = Math.round((mSalary / 30) * 100) / 100;
        }

        try {
            setSavingWorker(true);
            await api.post("/workers", {
                name: cleanName,
                phone: newWorkerPhone.trim() || null,
                designation: newWorkerDesignation.trim() || "कामगार",
                salary_type: "monthly",
                monthly_salary: mSalary,
                daily_wage: dWage,
            });

            Alert.alert("यशस्वी! ✅", `'${cleanName}' कामगार जोडला गेला!`);
            setNewWorkerName("");
            setNewWorkerPhone("");
            setNewWorkerSalary("");
            setNewWorkerDailyWage("");
            setShowAddWorkerModal(false);
            loadWorkers();
            if (activeTab === "attendance") loadAttendance(selectedDate);
        } catch (err: any) {
            console.error("Failed to add worker:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "कामगार जोडता आला नाही");
        } finally {
            setSavingWorker(false);
        }
    };

    // Handle Delete Worker
    const handleDeleteWorker = (worker: Worker) => {
        Alert.alert(
            "कामगार हटवा ⚠️",
            `तुम्हाला '${worker.name}' या कामगाराचे रेकॉर्ड काढायचे आहे का?`,
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "हटवा",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/workers/${worker.id}`);
                            Alert.alert("यशस्वी! ✅", "कामगार हटवला गेला.");
                            loadWorkers();
                            if (activeTab === "attendance") loadAttendance(selectedDate);
                        } catch (err: any) {
                            Alert.alert("त्रुटी", err?.response?.data?.message || "हटवता आले नाही");
                        }
                    },
                },
            ]
        );
    };

    // Handle Add Advance
    const handleSaveAdvance = async () => {
        if (!selectedWorkerForAdvance) return;
        const amt = parseFloat(advanceAmount);
        if (!amt || amt <= 0) {
            Alert.alert("माहिती", "कृपया वैध रक्कम टाका.");
            return;
        }

        try {
            setSavingAdvance(true);
            await api.post("/workers/advances", {
                worker_id: selectedWorkerForAdvance.id,
                amount: amt,
                advance_date: advanceDate,
                payment_mode: advancePaymentMode,
                notes: advanceNotes.trim() || null,
            });

            Alert.alert(
                "उचल नोंदवली! ✅",
                `'${selectedWorkerForAdvance.name}' यांना ₹${amt.toLocaleString("en-IN")} उचल (ॲडव्हान्स) दिली गेली.`
            );
            setShowAdvanceModal(false);
            setAdvanceAmount("");
            setAdvanceNotes("");
            setSelectedWorkerForAdvance(null);
            loadReport();
        } catch (err: any) {
            console.error("Failed to add advance:", err);
            Alert.alert("त्रुटी", err?.response?.data?.message || "उचल नोंदवता आली नाही");
        } finally {
            setSavingAdvance(false);
        }
    };

    // View Advance History for a Worker
    const handleOpenAdvanceHistory = async (workerId: number, workerName: string) => {
        try {
            setHistoryWorkerName(workerName);
            const res = await api.get(`/workers/advances/list?workerId=${workerId}`);
            setSelectedWorkerAdvances(res.data.advances || []);
            setShowAdvanceHistoryModal(true);
        } catch (err: any) {
            Alert.alert("त्रुटी", "उचल इतिहास लोड करता आला नाही");
        }
    };

    // Delete an advance record
    const handleDeleteAdvance = async (advanceId: number) => {
        Alert.alert("उचल नोंद रद्द करा", "तुम्हाला ही उचल नोंद हटवायची आहे का?", [
            { text: "नाही", style: "cancel" },
            {
                text: "होय, हटवा",
                style: "destructive",
                onPress: async () => {
                    try {
                        await api.delete(`/workers/advances/${advanceId}`);
                        Alert.alert("यशस्वी", "उचल नोंद हटवली गेली.");
                        setSelectedWorkerAdvances((prev) => prev.filter((a) => a.id !== advanceId));
                        loadReport();
                    } catch (e: any) {
                        Alert.alert("त्रुटी", "हटवता आले नाही");
                    }
                },
            },
        ]);
    };

    // Record Salary Payment (Settlement)
    const handlePaySalary = (report: WorkerReport) => {
        if (report.net_payable <= 0) {
            Alert.alert("माहिती", "या कामगाराचा कोणताही शिल्लक पगार बाकी नाही.");
            return;
        }

        Alert.alert(
            "पगार चुकता करा 💵",
            `कामगार: ${report.worker_name}\nएकूण हजर दिवस: ${report.effective_working_days}\nकमावलेला पगार: ₹${report.earned_salary}\nवजा उचल: ₹${report.total_advance}\n\nशिल्लक देय रक्कम: ₹${report.net_payable.toLocaleString("en-IN")}\n\nपगार दिल्याची नोंद करायची का?`,
            [
                { text: "रद्द करा", style: "cancel" },
                {
                    text: "होय, पगार जमा करा",
                    onPress: async () => {
                        try {
                            const [year, month] = selectedMonth.split("-");
                            await api.post("/workers/settlements", {
                                worker_id: report.worker_id,
                                month_year: `${year}-${month}`,
                                total_days: report.effective_working_days,
                                base_salary: report.monthly_salary,
                                earned_salary: report.earned_salary,
                                advance_deducted: report.total_advance,
                                net_paid_amount: report.net_payable,
                                payment_date: new Date().toISOString().split("T")[0],
                                payment_mode: "cash",
                                notes: "मासिक पगार चुकता केला",
                            });

                            Alert.alert("यशस्वी! ✅", `'${report.worker_name}' यांचा पगार चुकता झाल्याची नोंद झाली.`);
                            loadReport();
                        } catch (err: any) {
                            Alert.alert("त्रुटी", err?.response?.data?.message || "पगार नोंद करता आली नाही");
                        }
                    },
                },
            ]
        );
    };

    // Render Tab 1: Daily Attendance
    const renderAttendanceTab = () => {
        return (
            <View style={{ flex: 1 }}>
                {/* Date Navigation Bar */}
                <View style={styles.dateBar}>
                    <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDate(-1)}>
                        <Text style={styles.dateNavBtnText}>◀ काल</Text>
                    </TouchableOpacity>

                    <View style={styles.dateDisplayBox}>
                        <Text style={styles.dateSubLabel}>तारीख (Date)</Text>
                        <Text style={styles.dateDisplayTitle}>{selectedDate}</Text>
                    </View>

                    <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDate(1)}>
                        <Text style={styles.dateNavBtnText}>उद्या ▶</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.todayBtn}
                        onPress={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                    >
                        <Text style={styles.todayBtnText}>आज</Text>
                    </TouchableOpacity>
                </View>

                {/* Day Summary Cards */}
                {attendanceSummary && (
                    <View style={styles.summaryRow}>
                        <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}>
                            <Text style={[styles.summaryNum, { color: "#16A34A" }]}>
                                {attendanceSummary.full_day}
                            </Text>
                            <Text style={styles.summaryLabel}>पूर्ण दिवस (1)</Text>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" }]}>
                            <Text style={[styles.summaryNum, { color: "#D97706" }]}>
                                {attendanceSummary.half_day}
                            </Text>
                            <Text style={styles.summaryLabel}>अर्धा दिवस (½)</Text>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                            <Text style={[styles.summaryNum, { color: "#DC2626" }]}>
                                {attendanceSummary.absent}
                            </Text>
                            <Text style={styles.summaryLabel}>गैरहजर (0)</Text>
                        </View>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} />
                ) : attendanceList.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>कोणतेही कामगार सापडले नाहीत.</Text>
                        <TouchableOpacity
                            style={styles.emptyAddBtn}
                            onPress={() => {
                                setActiveTab("workers");
                                setShowAddWorkerModal(true);
                            }}
                        >
                            <Text style={styles.emptyAddBtnText}>＋ पहिला कामगार जोडा</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={attendanceList}
                        keyExtractor={(item) => String(item.worker_id)}
                        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                        renderItem={({ item }) => {
                            const isFull = item.status === "full_day";
                            const isHalf = item.status === "half_day";
                            const isAbsent = item.status === "absent";

                            return (
                                <View style={styles.attendanceCard}>
                                    <View style={styles.workerInfoRow}>
                                        <View style={styles.workerAvatar}>
                                            <Text style={styles.workerAvatarText}>
                                                {item.worker_name.charAt(0)}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.workerNameText}>{item.worker_name}</Text>
                                            <Text style={styles.workerRoleText}>
                                                {item.worker_designation || "कामगार"} • ₹{item.monthly_salary}/महिना (₹{item.daily_wage}/दिवस)
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Action Chips: Full Day / Half Day / Absent */}
                                    <View style={styles.chipsRow}>
                                        <TouchableOpacity
                                            style={[styles.statusChip, isFull && styles.chipFullActive]}
                                            onPress={() => handleSetStatus(item.worker_id, "full_day")}
                                        >
                                            <Text style={[styles.statusChipText, isFull && styles.chipFullActiveText]}>
                                                🟢 पूर्ण दिवस (1)
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.statusChip, isHalf && styles.chipHalfActive]}
                                            onPress={() => handleSetStatus(item.worker_id, "half_day")}
                                        >
                                            <Text style={[styles.statusChipText, isHalf && styles.chipHalfActiveText]}>
                                                🟡 अर्धा दिवस (½)
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.statusChip, isAbsent && styles.chipAbsentActive]}
                                            onPress={() => handleSetStatus(item.worker_id, "absent")}
                                        >
                                            <Text style={[styles.statusChipText, isAbsent && styles.chipAbsentActiveText]}>
                                                🔴 गैरहजर (0)
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }}
                    />
                )}

                {/* Save Attendance Sticky Footer */}
                <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 10 }]}>
                    <TouchableOpacity
                        style={[styles.saveBtn, savingAttendance && { opacity: 0.7 }]}
                        onPress={handleSaveAttendance}
                        disabled={savingAttendance}
                    >
                        {savingAttendance ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>💾 {selectedDate} ची हजेरी सेव्ह करा</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render Tab 2: Salary & Advances Overview
    const renderSalaryOverviewTab = () => {
        const workersReport = reportData?.workers || [];

        return (
            <View style={{ flex: 1 }}>
                <View style={styles.filterBanner}>
                    <Text style={styles.bannerTitle}>चालू महिना हिशोब व उचल (Advances)</Text>
                    <Text style={styles.bannerSub}>
                        कामगारांनी घेतलेली उचल नोंदवा व शिल्लक देय पगार त्वरित पहा.
                    </Text>
                </View>

                {loadingReport ? (
                    <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} />
                ) : workersReport.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>कोणतेही रेकॉर्ड सापडले नाहीत.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={workersReport}
                        keyExtractor={(item) => String(item.worker_id)}
                        contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
                        renderItem={({ item }) => {
                            const isPositivePayable = item.net_payable > 0;

                            return (
                                <View style={styles.salaryCard}>
                                    <View style={styles.salaryHeaderRow}>
                                        <View>
                                            <Text style={styles.salaryWorkerName}>{item.worker_name}</Text>
                                            <Text style={styles.salaryWorkerRole}>
                                                {item.designation} • फोन: {item.worker_phone || "-"}
                                            </Text>
                                        </View>
                                        <View style={styles.salaryBadge}>
                                            <Text style={styles.salaryBadgeText}>
                                                मासिक: ₹{item.monthly_salary.toLocaleString("en-IN")}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Attendance & Calculation Breakdown */}
                                    <View style={styles.calcGrid}>
                                        <View style={styles.calcItem}>
                                            <Text style={styles.calcItemLabel}>हजर दिवस</Text>
                                            <Text style={styles.calcItemVal}>
                                                {item.effective_working_days} दिवस
                                            </Text>
                                            <Text style={styles.calcItemSub}>
                                                ({item.full_days} पूर्ण + {item.half_days} अर्धे)
                                            </Text>
                                        </View>

                                        <View style={styles.calcItem}>
                                            <Text style={styles.calcItemLabel}>कमावलेला पगार</Text>
                                            <Text style={[styles.calcItemVal, { color: "#15803D" }]}>
                                                ₹{item.earned_salary.toLocaleString("en-IN")}
                                            </Text>
                                            <Text style={styles.calcItemSub}>
                                                @ ₹{item.daily_wage}/दिवस
                                            </Text>
                                        </View>

                                        <View style={styles.calcItem}>
                                            <Text style={styles.calcItemLabel}>घेतलेली उचल (Adv.)</Text>
                                            <Text style={[styles.calcItemVal, { color: "#DC2626" }]}>
                                                -₹{item.total_advance.toLocaleString("en-IN")}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() =>
                                                    handleOpenAdvanceHistory(item.worker_id, item.worker_name)
                                                }
                                            >
                                                <Text style={styles.linkText}>इतिहास 🔍</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Remaining Salary Highlight */}
                                    <View
                                        style={[
                                            styles.balanceBox,
                                            {
                                                backgroundColor: isPositivePayable ? "#F0FDF4" : "#FEF2F2",
                                                borderColor: isPositivePayable ? "#86EFAC" : "#FECACA",
                                            },
                                        ]}
                                    >
                                        <View>
                                            <Text style={styles.balanceLabel}>
                                                {isPositivePayable ? "शिल्लक देय पगार (Payable):" : "उचल जास्त आहे:"}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.balanceVal,
                                                    { color: isPositivePayable ? "#16A34A" : "#DC2626" },
                                                ]}
                                            >
                                                ₹{Math.abs(item.net_payable).toLocaleString("en-IN")}
                                            </Text>
                                        </View>

                                        {isPositivePayable && (
                                            <TouchableOpacity
                                                style={styles.paySalaryBtn}
                                                onPress={() => handlePaySalary(item)}
                                            >
                                                <Text style={styles.paySalaryBtnText}>💵 पगार चुकता करा</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Action Buttons: Give Advance */}
                                    <View style={styles.salaryActionRow}>
                                        <TouchableOpacity
                                            style={styles.giveAdvanceBtn}
                                            onPress={() => {
                                                const w = workers.find((wk) => wk.id === item.worker_id);
                                                if (w) setSelectedWorkerForAdvance(w);
                                                setShowAdvanceModal(true);
                                            }}
                                        >
                                            <Text style={styles.giveAdvanceBtnText}>
                                                ＋ उचल / ॲडव्हान्स द्या
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.historyBtn}
                                            onPress={() =>
                                                handleOpenAdvanceHistory(item.worker_id, item.worker_name)
                                            }
                                        >
                                            <Text style={styles.historyBtnText}>📜 उचल नोंद यादी</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }}
                    />
                )}
            </View>
        );
    };

    // Render Tab 3: Reports (Monthly & Custom Date Range)
    const renderReportsTab = () => {
        const grand = reportData?.grand_totals;
        const workersReport = reportData?.workers || [];

        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Mode Selector */}
                <View style={styles.reportModeSwitch}>
                    <TouchableOpacity
                        style={[styles.modeTab, reportMode === "monthly" && styles.modeTabActive]}
                        onPress={() => setReportMode("monthly")}
                    >
                        <Text style={[styles.modeTabText, reportMode === "monthly" && styles.modeTabTextActive]}>
                            📅 मासिक अहवाल
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.modeTab, reportMode === "custom" && styles.modeTabActive]}
                        onPress={() => setReportMode("custom")}
                    >
                        <Text style={[styles.modeTabText, reportMode === "custom" && styles.modeTabTextActive]}>
                            📆 तारीख निवडून अहवाल
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Filter Controls */}
                {reportMode === "monthly" ? (
                    <View style={styles.filterCard}>
                        <Text style={styles.filterTitle}>महिना निवडा (उदा. 2026-10):</Text>
                        <View style={styles.monthNavRow}>
                            <TextInput
                                style={styles.monthInput}
                                value={selectedMonth}
                                onChangeText={setSelectedMonth}
                                placeholder="YYYY-MM"
                                keyboardType="numbers-and-punctuation"
                            />
                            <TouchableOpacity style={styles.applyFilterBtn} onPress={loadReport}>
                                <Text style={styles.applyFilterBtnText}>🔍 अहवाल पहा</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hintText}>
                            फॉर्मेट: वर्ष-महिना (उदा. 2026-10 = ऑक्टोबर 2026, 2026-09 = सप्टेंबर 2026)
                        </Text>
                    </View>
                ) : (
                    <View style={styles.filterCard}>
                        <Text style={styles.filterTitle}>तारीख निवडा (Start Date to End Date):</Text>
                        <View style={styles.dateRangeRow}>
                            <View style={{ flex: 1, marginRight: 6 }}>
                                <Text style={styles.inputSubLabel}>सुरुवात तारीख:</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={customStartDate}
                                    onChangeText={setCustomStartDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 6 }}>
                                <Text style={styles.inputSubLabel}>शेवट तारीख:</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={customEndDate}
                                    onChangeText={setCustomEndDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.applyFilterBtn, { marginTop: 10 }]} onPress={loadReport}>
                            <Text style={styles.applyFilterBtnText}>🔍 अहवाल तयार करा</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loadingReport ? (
                    <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 30 }} />
                ) : (
                    <>
                        {/* Grand Totals Summary Card */}
                        {grand && (
                            <View style={styles.grandCard}>
                                <Text style={styles.grandTitle}>
                                    📊 एकत्रित अहवाल सारांश (Grand Summary)
                                </Text>
                                <View style={styles.grandRow}>
                                    <View style={styles.grandCol}>
                                        <Text style={styles.grandLabel}>एकूण कामगार</Text>
                                        <Text style={styles.grandVal}>{grand.total_workers}</Text>
                                    </View>
                                    <View style={styles.grandCol}>
                                        <Text style={styles.grandLabel}>एकूण हजर दिवस</Text>
                                        <Text style={styles.grandVal}>{grand.total_effective_days} दिवस</Text>
                                    </View>
                                </View>

                                <View style={styles.grandDivider} />

                                <View style={styles.grandRow}>
                                    <View style={styles.grandCol}>
                                        <Text style={styles.grandLabel}>एकूण झालेला पगार</Text>
                                        <Text style={[styles.grandVal, { color: "#16A34A" }]}>
                                            ₹{grand.total_earned_salary.toLocaleString("en-IN")}
                                        </Text>
                                    </View>
                                    <View style={styles.grandCol}>
                                        <Text style={styles.grandLabel}>दिलेली उचल (Adv.)</Text>
                                        <Text style={[styles.grandVal, { color: "#DC2626" }]}>
                                            ₹{grand.total_advance_given.toLocaleString("en-IN")}
                                        </Text>
                                    </View>
                                    <View style={styles.grandCol}>
                                        <Text style={styles.grandLabel}>शिल्लक देय रक्कम</Text>
                                        <Text style={[styles.grandVal, { color: "#2563EB", fontWeight: "800" }]}>
                                            ₹{grand.total_net_payable.toLocaleString("en-IN")}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Worker-wise Report Cards */}
                        <Text style={styles.sectionHeaderTitle}>कामगारनिहाय तपशीलवार अहवाल</Text>
                        {workersReport.map((w) => (
                            <View key={w.worker_id} style={styles.reportWorkerCard}>
                                <View style={styles.reportCardHeader}>
                                    <View>
                                        <Text style={styles.reportWorkerName}>{w.worker_name}</Text>
                                        <Text style={styles.reportWorkerSub}>
                                            {w.designation} • मासिक दर: ₹{w.monthly_salary} (₹{w.daily_wage}/दिवस)
                                        </Text>
                                    </View>
                                    <View style={styles.netPayableBadge}>
                                        <Text style={styles.netPayableBadgeLabel}>देय शिल्लक</Text>
                                        <Text style={styles.netPayableBadgeVal}>
                                            ₹{w.net_payable.toLocaleString("en-IN")}
                                        </Text>
                                    </View>
                                </View>

                                {/* Day Counts */}
                                <View style={styles.reportStatsRow}>
                                    <View style={styles.reportStatItem}>
                                        <Text style={styles.statLabel}>पूर्ण दिवस</Text>
                                        <Text style={[styles.statVal, { color: "#15803D" }]}>{w.full_days}</Text>
                                    </View>
                                    <View style={styles.reportStatItem}>
                                        <Text style={styles.statLabel}>अर्धा दिवस</Text>
                                        <Text style={[styles.statVal, { color: "#D97706" }]}>{w.half_days}</Text>
                                    </View>
                                    <View style={styles.reportStatItem}>
                                        <Text style={styles.statLabel}>गैरहजर</Text>
                                        <Text style={[styles.statVal, { color: "#DC2626" }]}>{w.absent_days}</Text>
                                    </View>
                                    <View style={styles.reportStatItem}>
                                        <Text style={styles.statLabel}>एकूण हजर</Text>
                                        <Text style={[styles.statVal, { color: "#0F172A", fontWeight: "700" }]}>
                                            {w.effective_working_days}
                                        </Text>
                                    </View>
                                </View>

                                {/* Financial Equation */}
                                <View style={styles.equationBox}>
                                    <Text style={styles.equationText}>
                                        कमावलेला पगार:{" "}
                                        <Text style={{ fontWeight: "700", color: "#16A34A" }}>
                                            ₹{w.earned_salary.toLocaleString("en-IN")}
                                        </Text>
                                        {"  —  "}
                                        उचल:{" "}
                                        <Text style={{ fontWeight: "700", color: "#DC2626" }}>
                                            ₹{w.total_advance.toLocaleString("en-IN")}
                                        </Text>
                                        {"  =  "}
                                        शिल्लक:{" "}
                                        <Text style={{ fontWeight: "800", color: "#2563EB" }}>
                                            ₹{w.net_payable.toLocaleString("en-IN")}
                                        </Text>
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>
        );
    };

    // Render Tab 4: Workers Management List
    const renderWorkersTab = () => {
        return (
            <View style={{ flex: 1 }}>
                <View style={styles.workersHeaderRow}>
                    <Text style={styles.workersCountText}>एकूण कामगार ({workers.length})</Text>
                    <TouchableOpacity
                        style={styles.addWorkerTopBtn}
                        onPress={() => setShowAddWorkerModal(true)}
                    >
                        <Text style={styles.addWorkerTopBtnText}>＋ नवीन कामगार</Text>
                    </TouchableOpacity>
                </View>

                {workers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>कोणतेही कामगार जोडलेले नाहीत.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={workers}
                        keyExtractor={(item) => String(item.id)}
                        contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
                        renderItem={({ item }) => (
                            <View style={styles.workerManageCard}>
                                <View style={styles.workerManageLeft}>
                                    <Text style={styles.workerManageName}>{item.name}</Text>
                                    <Text style={styles.workerManageRole}>
                                        हुद्दा: {item.designation} • फोन: {item.phone || "-"}
                                    </Text>
                                    <Text style={styles.workerManageSalary}>
                                        मासिक पगार: ₹{parseFloat(String(item.monthly_salary)).toLocaleString("en-IN")} | रोजंदारी: ₹{item.daily_wage}/दिवस
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteWorkerBtn}
                                    onPress={() => handleDeleteWorker(item)}
                                >
                                    <Text style={styles.deleteWorkerBtnText}>🗑️</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Top Navigation Bar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>◀ मागे</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={styles.headerTitle}>👷 कामगार हजेरी व पगार</Text>
                    <Text style={styles.headerSubtitle}>अरिहंत बाजार (भिलवडी)</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        if (activeTab === "attendance") loadAttendance(selectedDate);
                        else if (activeTab === "reports" || activeTab === "salary_overview") loadReport();
                        else loadWorkers();
                    }}
                    style={styles.refreshBtn}
                >
                    <Text style={styles.refreshBtnText}>🔄</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs Selector */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === "attendance" && styles.tabButtonActive]}
                    onPress={() => setActiveTab("attendance")}
                >
                    <Text style={[styles.tabButtonText, activeTab === "attendance" && styles.tabButtonTextActive]}>
                        📅 दैनिक हजेरी
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === "salary_overview" && styles.tabButtonActive]}
                    onPress={() => setActiveTab("salary_overview")}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            activeTab === "salary_overview" && styles.tabButtonTextActive,
                        ]}
                    >
                        💰 पगार व उचल
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === "reports" && styles.tabButtonActive]}
                    onPress={() => setActiveTab("reports")}
                >
                    <Text style={[styles.tabButtonText, activeTab === "reports" && styles.tabButtonTextActive]}>
                        📊 अहवाल
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === "workers" && styles.tabButtonActive]}
                    onPress={() => setActiveTab("workers")}
                >
                    <Text style={[styles.tabButtonText, activeTab === "workers" && styles.tabButtonTextActive]}>
                        👥 कामगार यादी
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tab Contents */}
            <View style={{ flex: 1 }}>
                {activeTab === "attendance" && renderAttendanceTab()}
                {activeTab === "salary_overview" && renderSalaryOverviewTab()}
                {activeTab === "reports" && renderReportsTab()}
                {activeTab === "workers" && renderWorkersTab()}
            </View>

            {/* 1. ADD WORKER MODAL */}
            <Modal
                visible={showAddWorkerModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddWorkerModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>नवीन कामगार नोंदणी</Text>
                            <TouchableOpacity onPress={() => setShowAddWorkerModal(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>कामगाराचे पूर्ण नाव *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="उदा. सचिन पवार"
                            placeholderTextColor="#94A3B8"
                            value={newWorkerName}
                            onChangeText={setNewWorkerName}
                        />

                        <Text style={styles.inputLabel}>मोबाईल नंबर</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="उदा. 9822114455"
                            placeholderTextColor="#94A3B8"
                            value={newWorkerPhone}
                            onChangeText={setNewWorkerPhone}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />

                        <Text style={styles.inputLabel}>हुद्दा / कामाचे स्वरूप</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="उदा. पॅकर, लोडर, मदतनीस"
                            placeholderTextColor="#94A3B8"
                            value={newWorkerDesignation}
                            onChangeText={setNewWorkerDesignation}
                        />

                        <View style={{ flexDirection: "row", gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>मासिक पगार (₹) *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="उदा. 15000"
                                    placeholderTextColor="#94A3B8"
                                    value={newWorkerSalary}
                                    onChangeText={(val) => {
                                        setNewWorkerSalary(val);
                                        const num = parseFloat(val);
                                        if (num > 0) {
                                            setNewWorkerDailyWage(String(Math.round(num / 30)));
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>रोजंदारी दर (₹/दिवस)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="उदा. 500"
                                    placeholderTextColor="#94A3B8"
                                    value={newWorkerDailyWage}
                                    onChangeText={setNewWorkerDailyWage}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.modalSubmitBtn, savingWorker && { opacity: 0.6 }]}
                            onPress={handleCreateWorker}
                            disabled={savingWorker}
                        >
                            {savingWorker ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.modalSubmitBtnText}>✅ कामगार जतन करा</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 2. GIVE ADVANCE MODAL */}
            <Modal
                visible={showAdvanceModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAdvanceModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                उचल / ॲडव्हान्स द्या ({selectedWorkerForAdvance?.name})
                            </Text>
                            <TouchableOpacity onPress={() => setShowAdvanceModal(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>उचल रक्कम (₹) *</Text>
                        <TextInput
                            style={[styles.modalInput, { fontSize: 20, fontWeight: "700", color: "#DC2626" }]}
                            placeholder="₹ 2000"
                            placeholderTextColor="#94A3B8"
                            value={advanceAmount}
                            onChangeText={setAdvanceAmount}
                            keyboardType="numeric"
                        />

                        <Text style={styles.inputLabel}>तारीख (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={advanceDate}
                            onChangeText={setAdvanceDate}
                        />

                        <Text style={styles.inputLabel}>कारण / टीप</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="उदा. सणासाठी, घरखर्च, आजारपण"
                            placeholderTextColor="#94A3B8"
                            value={advanceNotes}
                            onChangeText={setAdvanceNotes}
                        />

                        <Text style={styles.inputLabel}>पेमेंट प्रकार</Text>
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity
                                style={[
                                    styles.modeChip,
                                    advancePaymentMode === "cash" && styles.modeChipActive,
                                ]}
                                onPress={() => setAdvancePaymentMode("cash")}
                            >
                                <Text
                                    style={[
                                        styles.modeChipText,
                                        advancePaymentMode === "cash" && styles.modeChipTextActive,
                                    ]}
                                >
                                    💵 रोख (Cash)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modeChip,
                                    advancePaymentMode === "upi" && styles.modeChipActive,
                                ]}
                                onPress={() => setAdvancePaymentMode("upi")}
                            >
                                <Text
                                    style={[
                                        styles.modeChipText,
                                        advancePaymentMode === "upi" && styles.modeChipTextActive,
                                    ]}
                                >
                                    📱 UPI / ऑनलाईन
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.modalSubmitBtn, savingAdvance && { opacity: 0.6 }]}
                            onPress={handleSaveAdvance}
                            disabled={savingAdvance}
                        >
                            {savingAdvance ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.modalSubmitBtnText}>✅ उचल जमा करा</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 3. ADVANCE HISTORY MODAL */}
            <Modal
                visible={showAdvanceHistoryModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAdvanceHistoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: "80%" }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                📜 उचल इतिहास ({historyWorkerName})
                            </Text>
                            <TouchableOpacity onPress={() => setShowAdvanceHistoryModal(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedWorkerAdvances.length === 0 ? (
                            <View style={{ padding: 20, alignItems: "center" }}>
                                <Text style={{ color: "#64748B" }}>कोणतीही उचल नोंद नाही.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={selectedWorkerAdvances}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={({ item }) => (
                                    <View style={styles.advHistoryItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.advAmountText}>
                                                ₹{parseFloat(String(item.amount)).toLocaleString("en-IN")}
                                            </Text>
                                            <Text style={styles.advDateText}>
                                                तारीख: {item.advance_date} ({item.payment_mode === "cash" ? "रोख" : "UPI"})
                                            </Text>
                                            {item.notes && (
                                                <Text style={styles.advNotesText}>कारण: {item.notes}</Text>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.delAdvBtn}
                                            onPress={() => handleDeleteAdvance(item.id)}
                                        >
                                            <Text style={styles.delAdvBtnText}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
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
        justifyContent: "space-between",
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
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    headerSubtitle: {
        fontSize: 12,
        color: "#64748B",
    },
    refreshBtn: {
        padding: 6,
    },
    refreshBtnText: {
        fontSize: 18,
    },
    tabsContainer: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderBottomWidth: 3,
        borderBottomColor: "transparent",
    },
    tabButtonActive: {
        borderBottomColor: "#16A34A",
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    tabButtonTextActive: {
        color: "#16A34A",
        fontWeight: "800",
    },
    dateBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    dateNavBtn: {
        backgroundColor: "#F1F5F9",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    dateNavBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    dateDisplayBox: {
        alignItems: "center",
    },
    dateSubLabel: {
        fontSize: 11,
        color: "#64748B",
        textTransform: "uppercase",
    },
    dateDisplayTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    todayBtn: {
        backgroundColor: "#DCFCE7",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    todayBtnText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#15803D",
    },
    summaryRow: {
        flexDirection: "row",
        padding: 10,
        backgroundColor: "#FFFFFF",
        gap: 8,
    },
    summaryCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 6,
        alignItems: "center",
    },
    summaryNum: {
        fontSize: 18,
        fontWeight: "800",
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: "600",
        color: "#475569",
    },
    attendanceCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    workerInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    workerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E2E8F0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    workerAvatarText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#334155",
    },
    workerNameText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    workerRoleText: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    chipsRow: {
        flexDirection: "row",
        gap: 6,
    },
    statusChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    statusChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    chipFullActive: {
        backgroundColor: "#DCFCE7",
        borderColor: "#22C55E",
    },
    chipFullActiveText: {
        color: "#15803D",
        fontWeight: "800",
    },
    chipHalfActive: {
        backgroundColor: "#FEF3C7",
        borderColor: "#F59E0B",
    },
    chipHalfActiveText: {
        color: "#B45309",
        fontWeight: "800",
    },
    chipAbsentActive: {
        backgroundColor: "#FEE2E2",
        borderColor: "#EF4444",
    },
    chipAbsentActiveText: {
        color: "#B91C1C",
        fontWeight: "800",
    },
    stickyFooter: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
    },
    saveBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    filterBanner: {
        padding: 14,
        backgroundColor: "#F0FDF4",
        borderBottomWidth: 1,
        borderBottomColor: "#DCFCE7",
    },
    bannerTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#166534",
    },
    bannerSub: {
        fontSize: 12,
        color: "#15803D",
        marginTop: 2,
    },
    salaryCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    salaryHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    salaryWorkerName: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    salaryWorkerRole: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    salaryBadge: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    salaryBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1D4ED8",
    },
    calcGrid: {
        flexDirection: "row",
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        padding: 10,
        gap: 6,
        marginBottom: 10,
    },
    calcItem: {
        flex: 1,
        alignItems: "center",
    },
    calcItemLabel: {
        fontSize: 11,
        color: "#64748B",
        marginBottom: 2,
    },
    calcItemVal: {
        fontSize: 14,
        fontWeight: "800",
        color: "#0F172A",
    },
    calcItemSub: {
        fontSize: 9,
        color: "#94A3B8",
        marginTop: 2,
    },
    linkText: {
        fontSize: 10,
        color: "#2563EB",
        fontWeight: "700",
        marginTop: 2,
    },
    balanceBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    balanceLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#334155",
    },
    balanceVal: {
        fontSize: 18,
        fontWeight: "900",
    },
    paySalaryBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    paySalaryBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    salaryActionRow: {
        flexDirection: "row",
        gap: 8,
    },
    giveAdvanceBtn: {
        flex: 1,
        backgroundColor: "#FEE2E2",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    giveAdvanceBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#DC2626",
    },
    historyBtn: {
        flex: 1,
        backgroundColor: "#F1F5F9",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    historyBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#334155",
    },
    reportModeSwitch: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        borderRadius: 8,
        padding: 3,
        marginBottom: 12,
    },
    modeTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 6,
    },
    modeTabActive: {
        backgroundColor: "#FFFFFF",
    },
    modeTabText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    modeTabTextActive: {
        color: "#0F172A",
        fontWeight: "800",
    },
    filterCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    filterTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 8,
    },
    monthNavRow: {
        flexDirection: "row",
        gap: 8,
    },
    monthInput: {
        flex: 1,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 15,
        color: "#0F172A",
    },
    applyFilterBtn: {
        backgroundColor: "#16A34A",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    applyFilterBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    hintText: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 6,
    },
    dateRangeRow: {
        flexDirection: "row",
    },
    inputSubLabel: {
        fontSize: 11,
        color: "#475569",
        marginBottom: 4,
    },
    dateInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
        color: "#0F172A",
    },
    grandCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: "#16A34A",
    },
    grandTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#166534",
        marginBottom: 10,
    },
    grandRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    grandCol: {
        alignItems: "center",
    },
    grandLabel: {
        fontSize: 11,
        color: "#64748B",
        marginBottom: 2,
    },
    grandVal: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    grandDivider: {
        height: 1,
        backgroundColor: "#E2E8F0",
        marginVertical: 10,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 8,
    },
    reportWorkerCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    reportCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    reportWorkerName: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    reportWorkerSub: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    netPayableBadge: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignItems: "flex-end",
    },
    netPayableBadgeLabel: {
        fontSize: 9,
        color: "#1D4ED8",
        fontWeight: "600",
    },
    netPayableBadgeVal: {
        fontSize: 14,
        fontWeight: "900",
        color: "#1D4ED8",
    },
    reportStatsRow: {
        flexDirection: "row",
        backgroundColor: "#F8FAFC",
        borderRadius: 6,
        padding: 8,
        marginBottom: 8,
    },
    reportStatItem: {
        flex: 1,
        alignItems: "center",
    },
    statLabel: {
        fontSize: 10,
        color: "#64748B",
    },
    statVal: {
        fontSize: 13,
        fontWeight: "800",
        marginTop: 2,
    },
    equationBox: {
        backgroundColor: "#F1F5F9",
        padding: 8,
        borderRadius: 6,
    },
    equationText: {
        fontSize: 12,
        color: "#334155",
        textAlign: "center",
    },
    workersHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 14,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    workersCountText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
    },
    addWorkerTopBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    addWorkerTopBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    workerManageCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    workerManageLeft: {
        flex: 1,
    },
    workerManageName: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    workerManageRole: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    workerManageSalary: {
        fontSize: 12,
        fontWeight: "700",
        color: "#16A34A",
        marginTop: 4,
    },
    deleteWorkerBtn: {
        padding: 8,
    },
    deleteWorkerBtnText: {
        fontSize: 18,
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 12,
    },
    emptyAddBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    emptyAddBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: 16,
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 18,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    modalCloseText: {
        fontSize: 20,
        fontWeight: "700",
        color: "#64748B",
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 4,
    },
    modalInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: "#0F172A",
        marginBottom: 12,
    },
    modalSubmitBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 6,
    },
    modalSubmitBtnText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    modeChip: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        backgroundColor: "#F8FAFC",
    },
    modeChipActive: {
        backgroundColor: "#DCFCE7",
        borderColor: "#16A34A",
    },
    modeChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    modeChipTextActive: {
        color: "#15803D",
        fontWeight: "800",
    },
    advHistoryItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    advAmountText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#DC2626",
    },
    advDateText: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    advNotesText: {
        fontSize: 12,
        color: "#334155",
        fontStyle: "italic",
        marginTop: 2,
    },
    delAdvBtn: {
        padding: 8,
    },
    delAdvBtnText: {
        fontSize: 16,
    },
});
