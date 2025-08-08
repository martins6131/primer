// app/screens/MapScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import colors from '../styles/colors';

// Set this to your backend server (IP reachable from your phone)
// Example: const BACKEND = "http://192.168.1.10:5000";
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

// Replace with user identifiers (in production use auth)
const RIDER_ID = 'rider-123';

export default function MapScreen({ navigation }) {
  const [region, setRegion] = useState({
    latitude: -1.2921,
    longitude: 36.8219,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  });
  const [locationPerm, setLocationPerm] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [drivers, setDrivers] = useState({}); // { driverId: {lat,lng} }
  const socketRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    // Connect to backend
    const sock = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = sock;

    sock.on('connect', () => {
      console.log('connected to backend', sock.id);
      sock.emit('register', { userId: RIDER_ID, role: 'rider' });
    });

    sock.on('driverLocationUpdate', ({ driverId, location }) => {
      setDrivers(prev => ({ ...prev, [driverId]: location }));
    });

    sock.on('rideAssigned', (assignment) => {
      console.log('rideAssigned', assignment);
      // navigate to ride progress
      navigation.navigate('RideProgress', { assignment, backend: BACKEND, riderId: RIDER_ID });
    });

    sock.on('noDriversAvailable', ({ rideId }) => {
      Alert.alert('No drivers available', 'Try again in a few moments.');
    });

    return () => {
      sock.disconnect();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for Primer to work.');
        setLocationPerm(false);
        return;
      }
      setLocationPerm(true);

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setRegion(r => ({ ...r, latitude: coords.latitude, longitude: coords.longitude }));

      // start background updates to send location every 3 seconds (demo)
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 1 },
        (newLoc) => {
          const payload = { riderId: RIDER_ID, location: { lat: newLoc.coords.latitude, lng: newLoc.coords.longitude } };
          socketRef.current?.emit('riderLocation', payload);
          setUserLocation({ latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude });
        }
      );
    })();

    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
    };
  }, []);

  const onRequestRide = async () => {
    if (!userLocation) return Alert.alert('Location not ready', 'Wait for your location fix.');

    const rideId = `ride-${Date.now()}`;
    const payload = {
      rideId,
      riderId: RIDER_ID,
      pickup: { lat: userLocation.latitude, lng: userLocation.longitude },
      destination: { lat: userLocation.latitude + 0.01, lng: userLocation.longitude + 0.01 } // demo destination
    };
    socketRef.current?.emit('requestRide', payload);
    Alert.alert('Searching for drivers', 'We are finding a nearby driver…');
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} showsUserLocation>
        {userLocation && <Marker coordinate={userLocation} title="You" />}
        {Object.entries(drivers).map(([id, loc]) => (
          <Marker
            key={id}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            title={`Driver ${id}`}
            pinColor={colors.primerGreen}
          />
        ))}
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.cardTitle}>Ready to go?</Text>
        <Text style={styles.cardSubtitle}>Tap Request Ride to find the nearest driver.</Text>
        <TouchableOpacity style={styles.requestButton} onPress={onRequestRide}>
          <Text style={styles.requestButtonText}>Request Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  map: { flex: 1 },
  bottomCard: {
    position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: colors.white,
    padding: 14, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.12, elevation: 6
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.black },
  cardSubtitle: { color: '#666', marginTop: 6, marginBottom: 12 },
  requestButton: {
    backgroundColor: colors.primerGreen, paddingVertical: 12, borderRadius: 10, alignItems: 'center'
  },
  requestButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 }
});
