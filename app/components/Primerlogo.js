// app/components/PrimerLogo.js
import React from 'react';
import { View } from 'react-native';
import colors from '../styles/colors';

export default function PrimerLogo({ size = 64 }) {
  // Minimal SVG replacement for React Native: use View-built simple circle & text
  // For true SVG use react-native-svg; this simplified component is standalone.
  return (
    <View style={{
      width: size, height: size, borderRadius: size/2, backgroundColor: colors.black,
      alignItems: 'center', justifyContent: 'center'
    }}>
      <View style={{ width: size*0.6, height: size*0.6, borderRadius: (size*0.6)/2, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size*0.22, height: size*0.4, backgroundColor: colors.primerGreen, borderRadius: 4 }} />
      </View>
    </View>
  );
}
