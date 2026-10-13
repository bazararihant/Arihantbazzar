import React, { useState } from "react";
import {
    SafeAreaView,
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
} from "react-native";
import api from "../../services/api";

interface Props {
    onBack: () => void;
    onOrderCreated: (orderId: number) => void;
}

interface ItemRow {
    id: string;
    item_name: string;
    quantity: string;
    unit: string;
}

const COMMON_SUGGESTIONS = [
    { name: "साखर (Sugar)", unit: "kg" },
    { name: "खाद्यतेल (Cooking Oil)", unit: "litre" },
    { name: "तांदूळ (Rice)", unit: "kg" },
    { name: "गहू पीठ (Atta)", unit: "kg" },
    { name: "तूर डाळ (Toor Dal)", unit: "kg" },
    { name: "चहा पावडर (Tea)", unit: "kg" },
    { name: "बिस्किट बॉक्स (Biscuits)", unit: "box" },
    { name: "साबण (Soap)", unit: "packet" },
];

const UNITS = ["kg", "litre", "packet", "box", "pcs", "bag", "gram"];

export default function CreateOrderScreen({ onBack, onOrderCreated }: Props) {
    const [items, setItems] = useState<ItemRow[]>([
        { id: "1", item_name: "", quantity: "", unit: "kg" },
    ]);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), item_name: "", quantity: "", unit: "kg" },
        ]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length <= 1) {
            Alert.alert("सूचना", "ऑर्डरमध्ये किमान १ आयटम असणे आवश्यक आहे.");
            return;
        }
        setItems(items.filter((item) => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof ItemRow, value: string) => {
        setItems(
            items.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const handleAddSuggestion = (name: string, unit: string) => {
        // If the first row is empty, fill it
        if (items.length === 1 && !items[0].item_name.trim()) {
            setItems([{ ...items[0], item_name: name, unit }]);
        } else {
            setItems([
                ...items,
                { id: Date.now().toString(), item_name: name, quantity: "", unit },
            ]);
        }
    };

    const handleSubmitOrder = async () => {
        // Validation
        const validItems = items.filter(
            (i) => i.item_name.trim() && Number(i.quantity) > 0
        );

        if (validItems.length === 0) {
            Alert.alert(
                "अपूर्ण माहिती",
                "कृपया किमान एका वस्तूचे नाव आणि प्रमाण (Quantity) योग्य प्रकारे भरा."
            );
            return;
        }

        try {
            setLoading(true);

            const payload = {
                notes: notes.trim(),
                items: validItems.map((i) => ({
                    item_name: i.item_name.trim(),
                    quantity: Number(i.quantity),
                    unit: i.unit,
                })),
            };

            const response = await api.post("/orders", payload);
            const createdOrder = response.data.order;

            Alert.alert(
                "ऑर्डर पाठवली! ✅",
                `ऑर्डर #${createdOrder.id} ॲडमिनकडे यशस्वीरित्या नोंदवली गेली आहे.`,
                [
                    {
                        text: "ठीक आहे",
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
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>◀ मागे</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>नवीन सामानाची ऑर्डर</Text>
                <View style={{ width: 50 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Common Suggestions */}
                    <Text style={styles.sectionTitle}>
                        ⚡ वारंवार लागणारे आयटम (Quick Add):
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.suggestionsScroll}
                    >
                        {COMMON_SUGGESTIONS.map((sug, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.suggestionChip}
                                onPress={() => handleAddSuggestion(sug.name, sug.unit)}
                            >
                                <Text style={styles.suggestionText}>+ {sug.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Items List */}
                    <View style={styles.listHeaderRow}>
                        <Text style={styles.sectionTitle}>
                            मागवायचे सामान ({items.length} वस्तू)
                        </Text>
                        <TouchableOpacity
                            style={styles.addItemBtn}
                            onPress={handleAddItem}
                        >
                            <Text style={styles.addItemBtnText}>＋ आणखी जोडा</Text>
                        </TouchableOpacity>
                    </View>

                    {items.map((item, index) => (
                        <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemCardHeader}>
                                <Text style={styles.itemIndex}>#{index + 1}</Text>
                                {items.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => handleRemoveItem(item.id)}
                                    >
                                        <Text style={styles.removeText}>काढून टाका ✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Item Name */}
                            <Text style={styles.fieldLabel}>सामानाचे नाव (Item Name)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="उदा. साखर, तेल, बिस्किट्स..."
                                placeholderTextColor="#94A3B8"
                                value={item.item_name}
                                onChangeText={(text) =>
                                    handleUpdateItem(item.id, "item_name", text)
                                }
                            />

                            {/* Quantity and Unit in one row */}
                            <View style={styles.qtyUnitRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.fieldLabel}>प्रमाण (Quantity)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="उदा. 25, 50"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="numeric"
                                        value={item.quantity}
                                        onChangeText={(text) =>
                                            handleUpdateItem(item.id, "quantity", text)
                                        }
                                    />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fieldLabel}>युनिट (Unit)</Text>
                                    <View style={styles.unitSelector}>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                        >
                                            {UNITS.map((u) => {
                                                const selected = item.unit === u;
                                                return (
                                                    <TouchableOpacity
                                                        key={u}
                                                        style={[
                                                            styles.unitChip,
                                                            selected && styles.unitChipSelected,
                                                        ]}
                                                        onPress={() =>
                                                            handleUpdateItem(item.id, "unit", u)
                                                        }
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.unitText,
                                                                selected && styles.unitTextSelected,
                                                            ]}
                                                        >
                                                            {u}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    {/* Add More Button Bottom */}
                    <TouchableOpacity
                        style={styles.addMoreRowBtn}
                        onPress={handleAddItem}
                    >
                        <Text style={styles.addMoreRowBtnText}>＋ आणखी आयटम जोडा</Text>
                    </TouchableOpacity>

                    {/* Special Notes */}
                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                        विशेष सूचना / शेरा (Notes for Admin)
                    </Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="उदा. आज दुपारी १२ पर्यंत आवश्यक / पॅकिंग चांगल्या गुणवत्तेची असावी..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        value={notes}
                        onChangeText={setNotes}
                    />

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={styles.submitBtn}
                        onPress={handleSubmitOrder}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>
                                📨 ॲडमिनला ऑर्डर पाठवा (SUBMIT ORDER)
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
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
        paddingVertical: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    backBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    backBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#16A34A",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#0F172A",
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 18,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#334155",
        marginBottom: 8,
    },
    suggestionsScroll: {
        marginBottom: 16,
    },
    suggestionChip: {
        backgroundColor: "#DCFCE7",
        borderWidth: 1,
        borderColor: "#86EFAC",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginRight: 8,
    },
    suggestionText: {
        color: "#15803D",
        fontSize: 12,
        fontWeight: "700",
    },
    listHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    addItemBtn: {
        backgroundColor: "#F0FDF4",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#86EFAC",
    },
    addItemBtnText: {
        color: "#16A34A",
        fontSize: 12,
        fontWeight: "700",
    },
    itemCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    itemCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    itemIndex: {
        fontSize: 12,
        fontWeight: "800",
        color: "#64748B",
    },
    removeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#DC2626",
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: "#0F172A",
        marginBottom: 10,
    },
    qtyUnitRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    unitSelector: {
        height: 44,
        justifyContent: "center",
    },
    unitChip: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 6,
        marginRight: 6,
    },
    unitChipSelected: {
        backgroundColor: "#16A34A",
    },
    unitText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    unitTextSelected: {
        color: "#FFFFFF",
        fontWeight: "700",
    },
    addMoreRowBtn: {
        borderWidth: 1,
        borderColor: "#86EFAC",
        borderStyle: "dashed",
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        backgroundColor: "#F0FDF4",
        marginBottom: 16,
    },
    addMoreRowBtnText: {
        color: "#16A34A",
        fontWeight: "700",
        fontSize: 14,
    },
    notesInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
        color: "#0F172A",
        textAlignVertical: "top",
        minHeight: 80,
        marginBottom: 20,
    },
    submitBtn: {
        backgroundColor: "#16A34A",
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: "center",
        elevation: 3,
        shadowColor: "#16A34A",
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    submitBtnText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
});
