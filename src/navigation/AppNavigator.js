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

import Navbar from '../components/Navbar';

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
          <Stack.Screen name="Dailyreport" component={ReportScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="User" component={UserScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Us" component={UsScreen} />
          <Stack.Screen name="Forms" component={FormsScreen} />
        </Stack.Navigator>
      ) : (
        // Unauthenticated flow
        <Stack.Navigator
          initialRouteName="SignIn"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="SignIn" component={SignInScreen} />
        </Stack.Navigator>
      )}
    </>
  );
}