import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import LoginScreen from "./src/screens/auth/LoginScreen";
import BranchDashboardScreen from "./src/screens/franchise/BranchDashboardScreen";
import CreateOrderScreen from "./src/screens/franchise/CreateOrderScreen";
import OrderDetailScreen from "./src/screens/orders/OrderDetailScreen";
import AdminDashboardScreen from "./src/screens/admin/AdminDashboardScreen";
import { getUser, UserSession } from "./src/services/storage";

type ScreenType =
    | "login"
    | "branch_dashboard"
    | "create_order"
    | "order_detail"
    | "admin_dashboard";

export default function App() {
    const [user, setUser] = useState<UserSession | null>(null);
    const [currentScreen, setCurrentScreen] = useState<ScreenType>("login");
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const storedUser = await getUser();
                if (storedUser) {
                    setUser(storedUser);
                    if (storedUser.role === "admin") {
                        setCurrentScreen("admin_dashboard");
                    } else {
                        setCurrentScreen("branch_dashboard");
                    }
                } else {
                    setCurrentScreen("login");
                }
            } catch (e) {
                console.error("Failed to load session:", e);
                setCurrentScreen("login");
            } finally {
                setInitializing(false);
            }
        };

        checkSession();
    }, []);

    const handleLoginSuccess = (loggedInUser: UserSession) => {
        setUser(loggedInUser);
        if (loggedInUser.role === "admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    const handleLogout = () => {
        setUser(null);
        setSelectedOrderId(null);
        setCurrentScreen("login");
    };

    const handleViewOrder = (orderId: number) => {
        setSelectedOrderId(orderId);
        setCurrentScreen("order_detail");
    };

    const handleBackFromDetail = () => {
        setSelectedOrderId(null);
        if (user?.role === "admin") {
            setCurrentScreen("admin_dashboard");
        } else {
            setCurrentScreen("branch_dashboard");
        }
    };

    if (initializing) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#F8FAFC",
                }}
            >
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    // 1. Login Screen
    if (currentScreen === "login" || !user) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    // 2. Create Order Screen (Franchise)
    if (currentScreen === "create_order") {
        return (
            <CreateOrderScreen
                onBack={() => setCurrentScreen("branch_dashboard")}
                onOrderCreated={(newOrderId) => {
                    setSelectedOrderId(newOrderId);
                    setCurrentScreen("order_detail");
                }}
            />
        );
    }

    // 3. Order Detail Screen (View items, upload bill photo, admin approve)
    if (currentScreen === "order_detail" && selectedOrderId) {
        return (
            <OrderDetailScreen
                orderId={selectedOrderId}
                currentUser={user}
                onBack={handleBackFromDetail}
            />
        );
    }

    // 4. Admin Dashboard
    if (currentScreen === "admin_dashboard" && user.role === "admin") {
        return (
            <AdminDashboardScreen
                user={user}
                onLogout={handleLogout}
                onViewOrder={handleViewOrder}
            />
        );
    }

    // 5. Default: Branch Dashboard
    return (
        <BranchDashboardScreen
            user={user}
            onLogout={handleLogout}
            onCreateOrder={() => setCurrentScreen("create_order")}
            onViewOrder={handleViewOrder}
        />
    );
}
