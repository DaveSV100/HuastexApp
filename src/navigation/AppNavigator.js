// src/navigation/AppNavigator.tsx
import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../contexts/AuthContext';

// Screens
import SignInScreen from '../screens/SignIn/SignInScreen';
import HomeScreen from '../screens/HomeScreen';
import ReportScreen from '../screens/ReportScreen';
// import SalesScreen from '../screens/SalesScreen';
import Sales from '../screens/Sales';
import SalesScreen from '../screens/Sales/SalesScreen';
import UserScreen from '../screens/UserScreen/UserScreen';
import InventoryScreen from '../screens/InventoryScreen';
import UsScreen from '../screens/UsScreen';
import FormsScreen from '../screens/FormsScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import SignUpScreen from '../screens/SignUpScreen';
import Navbar from '../components/Navbar';

// E-commerce (shop) screens
import ShopHomeScreen from '../screens/shop/ShopHomeScreen';
import CategoriesScreen from '../screens/shop/CategoriesScreen';
import CategoryScreen from '../screens/shop/CategoryScreen';
import ProductDetailScreen from '../screens/shop/ProductDetailScreen';
import CartScreen from '../screens/shop/CartScreen';
import ShopHeader from '../components/ShopHeader';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user } = useContext(AuthContext);

  return (
    <>
      {user ? (
        // Authenticated flow
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ header: (props) => <Navbar {...props} /> }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          {/* E-commerce flow */}
          <Stack.Screen name="Shop" component={ShopHomeScreen} />
          <Stack.Screen name="Categories" component={CategoriesScreen} />
          <Stack.Screen name="Category" component={CategoryScreen} />
          <Stack.Screen name="Product" component={ProductDetailScreen} />
          <Stack.Screen name="MyOrders" component={CartScreen} />
          <Stack.Screen name="Dailyreport" component={ReportScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="User" component={UserScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Us" component={UsScreen} />
          <Stack.Screen name="Forms" component={FormsScreen} />
        </Stack.Navigator>
      ) : (
        // Unauthenticated flow — auth screens have no header; the public shop
        // screens use the lightweight ShopHeader (back + brand + cart).
        <Stack.Navigator
          initialRouteName="SignIn"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen
            name="Shop"
            component={ShopHomeScreen}
            options={{ headerShown: true, header: (props) => <ShopHeader {...props} /> }}
          />
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{ headerShown: true, header: (props) => <ShopHeader {...props} /> }}
          />
          <Stack.Screen
            name="Category"
            component={CategoryScreen}
            options={{ headerShown: true, header: (props) => <ShopHeader {...props} /> }}
          />
          <Stack.Screen
            name="Product"
            component={ProductDetailScreen}
            options={{ headerShown: true, header: (props) => <ShopHeader {...props} /> }}
          />
          <Stack.Screen
            name="MyOrders"
            component={CartScreen}
            options={{ headerShown: true, header: (props) => <ShopHeader {...props} /> }}
          />
        </Stack.Navigator>
      )}
    </>
  );
}