// app/App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapScreen from './screens/MapScreen';
import RideProgressScreen from './screens/RideProgressScreen';
import PrimerLogo from './components/PrimerLogo';
import { View, Text } from 'react-native';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Primer" component={MapScreen} options={{
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PrimerLogo size={36} />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Primer</Text>
            </View>
          )
        }} />
        <Stack.Screen name="RideProgress" component={RideProgressScreen} options={{ title: 'Ride Progress' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
