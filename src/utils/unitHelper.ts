export interface UnitOption {
    label: string;
    value: string;
}

export const ORDER_UNITS: UnitOption[] = [
    { label: "पोती (Bag)", value: "bag" },
    { label: "किलो (kg)", value: "kg" },
    { label: "लिटर (litre)", value: "litre" },
    { label: "पाकीट (packet)", value: "packet" },
    { label: "बॉक्स (box)", value: "box" },
    { label: "नग (pcs)", value: "pcs" },
    { label: "ग्रॅम (gram)", value: "gram" },
];

export const formatUnitMarathi = (unit?: string | null): string => {
    if (!unit) return "";
    const u = unit.trim().toLowerCase();
    if (u === "bag" || u === "poti" || u === "पोती" || u === "पोते") return "पोती (Bag)";
    if (u === "kg" || u === "किलो") return "किलो";
    if (u === "litre" || u === "liter" || u === "लिटर") return "लिटर";
    if (u === "packet" || u === "pkt" || u === "पाकीट") return "पाकीट";
    if (u === "box" || u === "बॉक्स") return "बॉक्स";
    if (u === "pcs" || u === "piece" || u === "pieces" || u === "नग") return "नग";
    if (u === "gram" || u === "gm" || u === "ग्रॅम") return "ग्रॅम";
    return unit;
};
