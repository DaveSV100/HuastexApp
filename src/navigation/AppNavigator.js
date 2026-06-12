// src/navigation/AppNavigator.tsx
import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../contexts/AuthContext';

// Screens
import SignInScreen from '../screens/SignIn/SignInScreen';
import HomeScreen from '../screens/HomeScreen';
import ReportScreen from '../screens/ReportScreen';
import SalesScreen from '../screens/Sales/SalesScreen';
import UserScreen from '../screens/UserScreen/UserScreen';
import InventoryScreen from '../screens/InventoryScreen';
import UsScreen from '../screens/UsScreen';
import FormsScreen from '../screens/FormsScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import PerfilScreen from '../screens/PerfilScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SignUpScreen from '../screens/SignUpScreen';
import Navbar from '../components/Navbar';

// E-commerce (shop) screens
import ShopHomeScreen from '../screens/shop/ShopHomeScreen';
import CategoriesScreen from '../screens/shop/CategoriesScreen';
import CategoryScreen from '../screens/shop/CategoryScreen';
import ProductDetailScreen from '../screens/shop/ProductDetailScreen';
import CartScreen from '../screens/shop/CartScreen';

const Stack = createNativeStackNavigator();

// Roles that get the staff dashboard as their landing screen.
const STAFF_ROLES = ['admin', 'superadmin', 'staff', 'iT'];

export default function AppNavigator() {
  const { user } = useContext(AuthContext);
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  // Everyone lands on the store, except staff, who land on their dashboard.
  const initialRouteName = isStaff ? 'Home' : 'Shop';

  return (
    <Stack.Navigator
      // Remount on sign-in / sign-out so initialRouteName reapplies: staff land
      // on their dashboard, everyone else on the store.
      key={user ? 'auth' : 'guest'}
      initialRouteName={initialRouteName}
      screenOptions={{ header: (props) => <Navbar {...props} /> }}
    >
      {/* Public storefront — available whether signed in or not */}
      <Stack.Screen name="Shop" component={ShopHomeScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="Product" component={ProductDetailScreen} />
      <Stack.Screen name="MyOrders" component={CartScreen} />

      {user ? (
        // Signed-in screens
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Perfil" component={PerfilScreen} />
          <Stack.Screen name="Dailyreport" component={ReportScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="User" component={UserScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Us" component={UsScreen} />
          <Stack.Screen name="Forms" component={FormsScreen} />
        </>
      ) : (
        // Auth screens render their own layout (no Navbar header)
        <>
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
