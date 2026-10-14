import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";

interface Props {
    onBack: () => void;
    onOrderCreated: (orderId: number) => void;
}

export interface OrderItemEntry {
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
    notes?: string;
}

const COMMON_SUGGESTIONS = [
    { name: "साखर (Sugar)", unit: "kg" },
    { name: "खाद्यतेल (Cooking Oil)", unit: "litre" },
    { name: "तूर डाळ (Toor Dal)", unit: "kg" },
    { name: "चहा पावडर (Tea)", unit: "kg" },
    { name: "तांदूळ (Rice)", unit: "kg" },
    { name: "गहू पीठ (Atta)", unit: "kg" },
    { name: "पोहे (Poha)", unit: "kg" },
    { name: "शेंगदाणे (Peanuts)", unit: "kg" },
    { name: "बिस्किट बॉक्स (Biscuits)", unit: "box" },
    { name: "साबण (Soap)", unit: "packet" },
    { name: "मीठ (Salt)", unit: "packet" },
    { name: "रवा (Rava)", unit: "kg" },
];

const UNITS = [
    { label: "किलो (kg)", value: "kg" },
    { label: "लिटर (litre)", value: "litre" },
    { label: "पाकीट (packet)", value: "packet" },
    { label: "बॉक्स (box)", value: "box" },
    { label: "नग (pcs)", value: "pcs" },
    { label: "गोणी / पोते (bag)", value: "bag" },
    { label: "ग्रॅम (gram)", value: "gram" },
];

export default function CreateOrderScreen({ onBack, onOrderCreated }: Props) {
    const insets = useSafeAreaInsets();
    const itemNameInputRef = useRef<any>(null);

    // List of added items in this order
    const [items, setItems] = useState<OrderItemEntry[]>([]);
    const [orderNotes, setOrderNotes] = useState("");
    const [loading, setLoading] = useState(false);

    // New item draft inputs (for fast, continuous typing)
    const [newItemName, setNewItemName] = useState("");
    const [newItemQuantity, setNewItemQuantity] = useState("");
    const [newItemUnit, setNewItemUnit] = useState("kg");
    const [newItemNotes, setNewItemNotes] = useState("");

    // Editing modal state
    const [editingItem, setEditingItem] = useState<OrderItemEntry | null>(null);
    const [editName, setEditName] = useState("");
    const [editQty, setEditQty] = useState("");
    const [editUnit, setEditUnit] = useState("kg");
    const [editNotes, setEditNotes] = useState("");

    // 1. Fast Add Item Handler
    const handleQuickAddItem = () => {
        const trimmedName = newItemName.trim();
        const parsedQty = parseFloat(newItemQuantity.trim());

        if (!trimmedName) {
            Alert.alert("माहिती आवश्यक", "कृपया सामानाचे नाव टाका.");
            itemNameInputRef.current?.focus();
            return;
        }

        if (isNaN(parsedQty) || parsedQty <= 0) {
            Alert.alert("प्रमाण आवश्यक", "कृपया योग्य प्रमाण (संख्या) टाका. उदा. 5 किंवा 10");
            return;
        }

        const newItem: OrderItemEntry = {
            id: Date.now().toString(),
            item_name: trimmedName,
            quantity: parsedQty,
            unit: newItemUnit,
            notes: newItemNotes.trim() || undefined,
        };

        // Append to list
        setItems((prev) => [newItem, ...prev]);

        // Reset draft fields so user can immediately type the NEXT item
        setNewItemName("");
        setNewItemQuantity("");
        setNewItemNotes("");
        // Retain current unit or default to kg
        itemNameInputRef.current?.focus();
    };

    // Quick Tap from Suggestion Chips
    const handleSelectSuggestion = (suggestion: { name: string; unit: string }) => {
        setNewItemName(suggestion.name);
        setNewItemUnit(suggestion.unit);
    };

    // Quantity Increment / Decrement
    const handleAdjustQty = (id: string, delta: number) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id === id) {
                    const newQty = Math.max(0.5, item.quantity + delta);
                    return { ...item, quantity: parseFloat(newQty.toFixed(2)) };
                }
                return item;
            })
        );
    };

    // Delete Item
    const handleDeleteItem = (id: string, itemName: string) => {
        Alert.alert("वस्तू काढा", `तुम्हाला '${itemName}' यादीतून काढून टाकायचे आहे का?`, [
            { text: "रद्द करा", style: "cancel" },
            {
                text: "काढून टाका",
                style: "destructive",
                onPress: () => {
                    setItems((prev) => prev.filter((item) => item.id !== id));
                },
            },
        ]);
    };

    // Open Edit Modal
    const handleOpenEdit = (item: OrderItemEntry) => {
        setEditingItem(item);
        setEditName(item.item_name);
        setEditQty(String(item.quantity));
        setEditUnit(item.unit);
        setEditNotes(item.notes || "");
    };

    // Save Edit
    const handleSaveEdit = () => {
        if (!editingItem) return;
        const trimmedName = editName.trim();
        const parsedQty = parseFloat(editQty.trim());

        if (!trimmedName || isNaN(parsedQty) || parsedQty <= 0) {
            Alert.alert("अवैध माहिती", "कृपया योग्य नाव आणि प्रमाण टाका.");
            return;
        }

        setItems((prev) =>
            prev.map((item) =>
                item.id === editingItem.id
                    ? {
                          ...item,
                          item_name: trimmedName,
                          quantity: parsedQty,
                          unit: editUnit,
                          notes: editNotes.trim() || undefined,
                      }
                    : item
            )
        );

        setEditingItem(null);
    };

    // Submit Order to Server / Database
    const handleSubmitOrder = async () => {
        if (items.length === 0) {
            Alert.alert(
                "यादी रिकामी आहे",
                "कृपया ऑर्डर पाठवण्यापूर्वी किमान १ वस्तू जोडा."
            );
            return;
        }

        try {
            setLoading(true);

            const payload = {
                notes: orderNotes.trim(),
                items: items.map((i) => ({
                    item_name: i.item_name,
                    quantity: i.quantity,
                    unit: i.unit,
                    notes: i.notes || null,
                })),
            };

            const response = await api.post("/orders", payload);
            const createdOrder = response.data.order;

            Alert.alert(
                "ऑर्डर पाठवली! ✅",
                `ऑर्डर #${createdOrder.id} (${items.length} वस्तू) ॲडमिनकडे यशस्वीरित्या नोंदवली गेली आहे.`,
                [
                    {
                        text: "ऑर्डर पहा",
                        onPress: () => onOrderCreated(createdOrder.id),
                    },
                ]
            );
        } catch (error: any) {
            console.error("Create order failed:", error);
            Alert.alert(
                "ऑर्डर सबमिट अयशस्वी",
                error?.response?.data?.message || "ऑर्डर पाठवताना समस्या आली"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: 0 }]} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Top Header Bar */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                        <Text style={styles.backBtnText}>◀ मागे जा</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={styles.headerTitle}>नवीन सामानाची मागणी</Text>
                        <Text style={styles.headerSub}>भिलवडी शाखा (सांगली)</Text>
                    </View>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* FAST ITEM ENTRY CARD */}
                    <View style={styles.fastEntryCard}>
                        <View style={styles.entryHeaderRow}>
                            <Text style={styles.entryHeaderTitle}>⚡ वस्तू जलद जोडा (Quick Add)</Text>
                            <Text style={styles.entryHeaderHint}>नाव, प्रमाण टाका आणि लगेच जोडा</Text>
                        </View>

                        {/* Item Name */}
                        <Text style={styles.inputLabel}>वस्तूचे नाव *</Text>
                        <TextInput
                            ref={itemNameInputRef}
                            style={styles.textInput}
                            placeholder="उदा. साखर, खाद्यतेल, चहा पावडर..."
                            placeholderTextColor="#94A3B8"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            returnKeyType="next"
                        />

                        {/* Quick Suggestion Chips */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.chipsScroll}
                        >
                            {COMMON_SUGGESTIONS.map((s, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.chip}
                                    onPress={() => handleSelectSuggestion(s)}
                                >
                                    <Text style={styles.chipText}>＋ {s.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Quantity and Unit Row */}
                        <View style={styles.qtyUnitRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.inputLabel}>प्रमाण (Quantity) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="उदा. 25"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={newItemQuantity}
                                    onChangeText={setNewItemQuantity}
                                />
                            </View>

                            <View style={{ flex: 1.4 }}>
                                <Text style={styles.inputLabel}>युनिट (Unit)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                                    {UNITS.map((u) => (
                                        <TouchableOpacity
                                            key={u.value}
                                            style={[
                                                styles.unitPill,
                                                newItemUnit === u.value && styles.unitPillActive,
                                            ]}
                                            onPress={() => setNewItemUnit(u.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.unitPillText,
                                                    newItemUnit === u.value && styles.unitPillTextActive,
                                                ]}
                                            >
                                                {u.value}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        {/* Optional Item Note */}
                        <Text style={[styles.inputLabel, { marginTop: 8 }]}>विशेष टीप (पर्यायी)</Text>
                        <TextInput
                            style={[styles.textInput, { height: 40 }]}
                            placeholder="उदा. चांगल्या ब्रँडचे द्या, त्वरित हवे..."
                            placeholderTextColor="#94A3B8"
                            value={newItemNotes}
                            onChangeText={setNewItemNotes}
                        />

                        {/* Big Add Button */}
                        <TouchableOpacity
                            style={styles.quickAddButton}
                            onPress={handleQuickAddItem}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.quickAddButtonText}>＋ यादीत जोडा (Add to List)</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ADDED ITEMS LIST SECTION */}
                    <View style={styles.listSection}>
                        <View style={styles.listSectionHeader}>
                            <Text style={styles.listSectionTitle}>
                                📋 ऑर्डर यादी ({items.length} वस्तू जोडल्या)
                            </Text>
                            {items.length > 0 && (
                                <TouchableOpacity onPress={() => setItems([])}>
                                    <Text style={styles.clearAllText}>सर्व काढा</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {items.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyIcon}>🛒</Text>
                                <Text style={styles.emptyText}>अद्याप कोणतीही वस्तू जोडली नाही</Text>
                                <Text style={styles.emptySub}>
                                    वर दिलेल्या बॉक्समध्ये नाव व प्रमाण टाकून 'यादीत जोडा' वर क्लिक करा.
                                </Text>
                            </View>
                        ) : (
                            items.map((item, index) => (
                                <View key={item.id} style={styles.itemCard}>
                                    <View style={styles.itemCardHeader}>
                                        <View style={styles.itemIndexBadge}>
                                            <Text style={styles.itemIndexText}>{items.length - index}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                                            <Text style={styles.itemNameText}>{item.item_name}</Text>
                                            {item.notes ? (
                                                <Text style={styles.itemNoteText}>📝 {item.notes}</Text>
                                            ) : null}
                                        </View>

                                        {/* Stepper buttons */}
                                        <View style={styles.stepperContainer}>
                                            <TouchableOpacity
                                                style={styles.stepBtn}
                                                onPress={() => handleAdjustQty(item.id, -1)}
                                            >
                                                <Text style={styles.stepBtnText}>−</Text>
                                            </TouchableOpacity>

                                            <View style={styles.qtyDisplay}>
                                                <Text style={styles.qtyDisplayText}>
                                                    {item.quantity} {item.unit}
                                                </Text>
                                            </View>

                                            <TouchableOpacity
                                                style={styles.stepBtn}
                                                onPress={() => handleAdjustQty(item.id, 1)}
                                            >
                                                <Text style={styles.stepBtnText}>＋</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Action row (Edit / Delete) */}
                                    <View style={styles.itemActionRow}>
                                        <TouchableOpacity
                                            style={styles.editActionBtn}
                                            onPress={() => handleOpenEdit(item)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.editActionText}>✏️ संपादन करा (Edit)</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.deleteActionBtn}
                                            onPress={() => handleDeleteItem(item.id, item.item_name)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.deleteActionText}>🗑️ काढून टाका (Delete)</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    {/* OVERALL ORDER NOTES */}
                    <View style={styles.notesCard}>
                        <Text style={styles.notesCardTitle}>📝 संपूर्ण ऑर्डरविषयी विशेष सूचना / शेरा</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="उदा. उद्या सकाळी ९ वाजेपर्यंत डिलिव्हरी हवी आहे..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={3}
                            value={orderNotes}
                            onChangeText={setOrderNotes}
                        />
                    </View>
                </ScrollView>

                {/* STICKY BOTTOM SUBMIT BAR */}
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.bottomSummary}>
                        <Text style={styles.bottomSummaryCount}>{items.length} वस्तू</Text>
                        <Text style={styles.bottomSummarySub}>भिलवडी शाखेची मागणी</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            items.length === 0 && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmitOrder}
                        disabled={loading || items.length === 0}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.submitButtonText}>✅ ऑर्डर पाठवा (Submit)</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* EDIT ITEM MODAL */}
                {editingItem && (
                    <Modal visible transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalCard}>
                                <Text style={styles.modalTitle}>वस्तू संपादन करा (Edit Item)</Text>

                                <Text style={styles.inputLabel}>वस्तूचे नाव</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={editName}
                                    onChangeText={setEditName}
                                />

                                <View style={styles.qtyUnitRow}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={styles.inputLabel}>प्रमाण (Qty)</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            keyboardType="numeric"
                                            value={editQty}
                                            onChangeText={setEditQty}
                                        />
                                    </View>
                                    <View style={{ flex: 1.2 }}>
                                        <Text style={styles.inputLabel}>युनिट (Unit)</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {UNITS.map((u) => (
                                                <TouchableOpacity
                                                    key={u.value}
                                                    style={[
                                                        styles.unitPill,
                                                        editUnit === u.value && styles.unitPillActive,
                                                    ]}
                                                    onPress={() => setEditUnit(u.value)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.unitPillText,
                                                            editUnit === u.value && styles.unitPillTextActive,
                                                        ]}
                                                    >
                                                        {u.value}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>

                                <Text style={[styles.inputLabel, { marginTop: 8 }]}>टीप (Notes)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={editNotes}
                                    onChangeText={setEditNotes}
                                />

                                <View style={styles.modalBtnRow}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setEditingItem(null)}
                                    >
                                        <Text style={styles.modalCancelText}>रद्द करा</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.modalSaveBtn}
                                        onPress={handleSaveEdit}
                                    >
                                        <Text style={styles.modalSaveText}>बदल जतन करा ✅</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F1F5F9",
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
    headerSub: {
        fontSize: 12,
        color: "#16A34A",
        fontWeight: "600",
    },
    scrollContent: {
        padding: 14,
    },
    fastEntryCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: "#BBF7D0",
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    entryHeaderRow: {
        marginBottom: 12,
    },
    entryHeaderTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#15803D",
    },
    entryHeaderHint: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 15,
        color: "#1E293B",
    },
    chipsScroll: {
        marginVertical: 10,
    },
    chip: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#86EFAC",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 6,
    },
    chipText: {
        fontSize: 12,
        color: "#15803D",
        fontWeight: "600",
    },
    qtyUnitRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 4,
    },
    unitPill: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        marginRight: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    unitPillActive: {
        backgroundColor: "#16A34A",
        borderColor: "#16A34A",
    },
    unitPillText: {
        fontSize: 12,
        color: "#475569",
        fontWeight: "700",
    },
    unitPillTextActive: {
        color: "#FFFFFF",
    },
    quickAddButton: {
        backgroundColor: "#16A34A",
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 14,
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    quickAddButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
    listSection: {
        marginBottom: 16,
    },
    listSectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    listSectionTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1E293B",
    },
    clearAllText: {
        fontSize: 13,
        color: "#EF4444",
        fontWeight: "700",
    },
    emptyBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderStyle: "dashed",
    },
    emptyIcon: {
        fontSize: 32,
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#475569",
    },
    emptySub: {
        fontSize: 12,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 4,
    },
    itemCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    itemCardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    itemIndexBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#DCFCE7",
        alignItems: "center",
        justifyContent: "center",
    },
    itemIndexText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#15803D",
    },
    itemNameText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },
    itemNoteText: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    stepperContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    stepBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    stepBtnText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#16A34A",
    },
    qtyDisplay: {
        paddingHorizontal: 6,
    },
    qtyDisplayText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#0F172A",
    },
    itemActionRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        marginTop: 10,
        paddingTop: 8,
    },
    editActionBtn: {
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#BFDBFE",
        marginRight: 8,
    },
    editActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1D4ED8",
    },
    deleteActionBtn: {
        backgroundColor: "#FEF2F2",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    deleteActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#DC2626",
    },
    notesCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 16,
    },
    notesCardTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 8,
    },
    notesInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        color: "#1E293B",
        minHeight: 65,
        textAlignVertical: "top",
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 8,
    },
    bottomSummary: {
        flex: 1,
    },
    bottomSummaryCount: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    bottomSummarySub: {
        fontSize: 12,
        color: "#16A34A",
        fontWeight: "600",
    },
    submitButton: {
        backgroundColor: "#16A34A",
        paddingHorizontal: 22,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 170,
    },
    submitButtonDisabled: {
        backgroundColor: "#94A3B8",
    },
    submitButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
    },
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
        maxWidth: 400,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 14,
        textAlign: "center",
    },
    modalBtnRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 18,
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
    modalSaveBtn: {
        flex: 1.5,
        paddingVertical: 11,
        backgroundColor: "#16A34A",
        borderRadius: 8,
        alignItems: "center",
        marginLeft: 8,
    },
    modalSaveText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#FFFFFF",
    },
});
