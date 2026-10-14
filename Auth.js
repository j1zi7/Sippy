import React, { useState } from 'react';
import { Alert, StyleSheet, View, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login Failed', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('Signup Failed', error.message);
    else Alert.alert('Success', 'Check your email for the confirmation link!');
    setLoading(false);
  }

  // --- NEW FORGOT PASSWORD LOGIC ---
  async function handleForgotPassword() {
    if (!email) {
      Alert.alert('Hold on', 'Please type your email address into the box first, then press Forgot Password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Sent!', 'Check your email for password reset instructions.');
    setLoading(false);
  }

  return (
    <LinearGradient colors={['#e0f2fe', '#bae6fd']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="water" size={60} color="#0ea5e9" />
          </View>
          <Text style={styles.title}>Sippy</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Welcome back' : 'Create your oasis'}</Text>
        </View>

        <BlurView intensity={60} tint="light" style={styles.card}>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setEmail(text)}
            value={email}
            placeholder="email@address.com"
            placeholderTextColor="rgba(12, 74, 110, 0.5)"
            autoCapitalize={'none'}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            onChangeText={(text) => setPassword(text)}
            value={password}
            secureTextEntry={true}
            placeholder="Password"
            placeholderTextColor="rgba(12, 74, 110, 0.5)"
            autoCapitalize={'none'}
          />

          <TouchableOpacity 
            style={[styles.mainButton, loading && { opacity: 0.7 }]} 
            disabled={loading} 
            onPress={isLogin ? signInWithEmail : signUpWithEmail}
          >
            <Text style={styles.mainButtonText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} disabled={loading}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>

            {/* ONLY SHOW FORGOT PASSWORD ON THE LOGIN SCREEN */}
            {isLogin && (
              <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={{ marginTop: 20 }}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  iconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  title: { fontSize: 42, fontWeight: '800', color: '#0c4a6e', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#0c4a6e', opacity: 0.7, marginTop: 5, textTransform: 'uppercase', letterSpacing: 2 },
  
  card: { width: '100%', padding: 30, borderRadius: 35, overflow: 'hidden', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.5)', padding: 18, borderRadius: 20, marginBottom: 15, fontSize: 16, color: '#0c4a6e', fontWeight: '600' },
  
  mainButton: { backgroundColor: '#0ea5e9', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 10, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  mainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  
  footerLinks: { marginTop: 25, alignItems: 'center' },
  switchText: { color: '#0c4a6e', fontWeight: '600', fontSize: 14 },
  forgotText: { color: '#0c4a6e', opacity: 0.6, fontSize: 14, fontWeight: 'bold' }
});