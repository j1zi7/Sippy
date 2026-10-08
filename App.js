import { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';

export default function App() {
  const [waterCount, setWaterCount] = useState(0);

  const handleDrinkWater = () => {
    setWaterCount(waterCount + 1);
  };

  // 1. NEW: This function decides what to show based on the count
  const getPlantVisual = () => {
    if (waterCount === 0) return '🌱'; // Sprout for 0 (just starting)
    if (waterCount < 4) return '🪴';  // Potted plant for 1-3
    if (waterCount < 8) return '🌻';  // Flower for 4-7
    return '🌳';                      // Tree for 8+
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Water Tracker</Text>
      
      {/* 2. NEW: We call our function here to display the current plant */}
      <Text style={styles.plant}>{getPlantVisual()}</Text>
      
      <Text style={styles.counter}>{waterCount}</Text>
      <Text style={styles.subtitle}>Glasses today</Text>

      <Button title="Drink Water" onPress={handleDrinkWater} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  // 3. NEW: We make the emoji massive so it looks like a real graphic
  plant: {
    fontSize: 120,
    marginBottom: 20,
  },
  counter: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#0ea5e9', 
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  }
});