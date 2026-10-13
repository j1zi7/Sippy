import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 1. Import the storage library

export default function App() {
  const [waterCount, setWaterCount] = useState(0);

  // 2. This runs ONCE when the app first opens
  useEffect(() => {
    loadData();
  }, []);

  // 3. The function to read from the phone's memory
  const loadData = async () => {
    try {
      const savedCount = await AsyncStorage.getItem('waterCount');
      const savedDate = await AsyncStorage.getItem('lastDate');
      const today = new Date().toDateString(); // Gets today's date as a text string

      if (savedDate === today) {
        // It's still the same day, restore their progress
        if (savedCount !== null) {
          setWaterCount(parseInt(savedCount)); // Convert text back to a number
        }
      } else {
        // It's a brand new day! Reset to 0 and save today's date
        setWaterCount(0);
        await AsyncStorage.setItem('lastDate', today);
        await AsyncStorage.setItem('waterCount', '0');
      }
    } catch (error) {
      console.error('Failed to load data', error);
    }
  };

  // 4. The function to save to the phone's memory
  const saveData = async (newCount) => {
    try {
      await AsyncStorage.setItem('waterCount', newCount.toString());
    } catch (error) {
      console.error('Failed to save data', error);
    }
  };

  const handleDrinkWater = () => {
    const newCount = waterCount + 1;
    setWaterCount(newCount); // Update the screen
    saveData(newCount);      // Save it to memory immediately!
  };

  const getPlantVisual = () => {
    if (waterCount === 0) return '🌱'; 
    if (waterCount < 4) return '🪴';  
    if (waterCount < 8) return '🌻';  
    return '🌳';                      
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Water Tracker</Text>
      
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