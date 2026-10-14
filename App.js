import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, Platform, Image, ScrollView, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { supabase } from './supabase'; 
import Auth from './Auth';

const { width } = Dimensions.get('window');

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const THEMES = {
  basic: { name: 'Cloud', bg: ['#f8f9fa', '#e2e8f0'], cardTint: 'light', text: '#334155', accent: '#0f172a', border: 0 },
  pastelGreen: { name: 'Matcha', bg: ['#ecfdf5', '#d1fae5'], cardTint: 'light', text: '#064e3b', accent: '#10b981', border: 0 },
  pastelYellow: { name: 'Lemon', bg: ['#fefce8', '#fef08a'], cardTint: 'light', text: '#713f12', accent: '#eab308', border: 0 },
  retro: { name: 'Retro', bg: ['#ffffff', '#e5e5e5'], cardTint: 'light', text: '#000000', accent: '#000000', border: 2 },
  refreshing: { name: 'Ocean', bg: ['#e0f2fe', '#bae6fd'], cardTint: 'light', text: '#0c4a6e', accent: '#0ea5e9', border: 0 },
  darkGlass: { name: 'Midnight', bg: ['#1e293b', '#0f172a'], cardTint: 'dark', text: '#f8fafc', accent: '#38bdf8', border: 0 }
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Playfair': require('./assets/Playfair.ttf'), 
    'Poppins': require('./assets/Poppins.ttf'), 
  });

  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); 
  const [waterCount, setWaterCount] = useState(0);
  const [historyData, setHistoryData] = useState({});
  
  const [myCode, setMyCode] = useState('');
  const [friendInput, setFriendInput] = useState('');
  const [friendData, setFriendData] = useState(null);

  const [currentTheme, setCurrentTheme] = useState('basic');
  const [stickerShape, setStickerShape] = useState('circle'); 
  const [customImages, setCustomImages] = useState({ stage0: null, stage1: null, stage2: null, stage3: null });
  
  const [calView, setCalView] = useState('weekly');
  const [calDate, setCalDate] = useState(new Date());

  const theme = THEMES[currentTheme];
  const fontHeading = fontsLoaded ? 'Playfair' : (Platform.OS === 'ios' ? 'Georgia' : 'serif');
  const fontBody = fontsLoaded ? 'Poppins' : (Platform.OS === 'ios' ? 'Avenir' : 'sans-serif');

  const getLocalYYYYMMDD = (d = new Date()) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    loadCustomSettings();
  }, []);

  useEffect(() => { if (session) loadData(); }, [session]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('profiles').select('connected_user_id').eq('id', session.user.id).single();
      if (data) {
        if (data.connected_user_id) {
          const { data: fData } = await supabase.from('profiles').select('id, water_count, push_token, connection_code').eq('id', data.connected_user_id).single();
          if (fData) setFriendData(fData);
        } else setFriendData(null);
      }
    }, 3000); 
    return () => clearInterval(interval);
  }, [session]);

  const loadCustomSettings = async () => {
    const savedTheme = await AsyncStorage.getItem('appTheme');
    const savedImages = await AsyncStorage.getItem('customImages');
    const savedShape = await AsyncStorage.getItem('stickerShape');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedImages) setCustomImages(JSON.parse(savedImages));
    if (savedShape) setStickerShape(savedShape);
  };

  const updateSetting = async (key, value, setter) => {
    setter(value);
    await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  };

  const pickImage = async (stage) => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) updateSetting('customImages', { ...customImages, [stage]: result.assets[0].uri }, setCustomImages);
  };

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return null;
    let token;
    if (Device.isDevice) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') finalStatus = (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return null;
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) return null;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (e) { return null; }
    }
    return token;
  }

  const loadData = async () => {
    try {
      const today = new Date().toDateString();
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const pushToken = await registerForPushNotificationsAsync();
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

      if (error && error.code === 'PGRST116') {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        setMyCode(newCode); 
        await supabase.from('profiles').insert([{ id: session.user.id, water_count: 0, last_date: today, timezone: userTimezone, connection_code: newCode, push_token: pushToken || null, history: {} }]);
        setWaterCount(0);
        return;
      }

      if (data) {
        setHistoryData(data.history || {});
        if (data.last_date === today) setWaterCount(data.water_count);
        else {
          setWaterCount(0);
          await supabase.from('profiles').update({ water_count: 0, last_date: today, timezone: userTimezone }).eq('id', session.user.id);
        }
        let currentCode = data.connection_code || Math.floor(100000 + Math.random() * 900000).toString();
        setMyCode(currentCode); 
        await supabase.from('profiles').update({ connection_code: currentCode, push_token: pushToken || null }).eq('id', session.user.id);
      }
    } catch (e) { console.error(e); }
  };

  const handleConnect = async () => {
    if (!friendInput) return;
    const { data } = await supabase.from('profiles').select('id').eq('connection_code', friendInput).single();
    if (data) {
      await supabase.from('profiles').update({ connected_user_id: data.id }).eq('id', session.user.id);
      await supabase.from('profiles').update({ connected_user_id: session.user.id }).eq('id', data.id);
      setFriendInput('');
      Alert.alert('Linked!', 'You and your partner are now synced.');
    } else Alert.alert('Error', 'Could not find that code.');
  };

  const unlinkPartner = async () => {
    Alert.alert('Unlink', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: async () => {
          await supabase.from('profiles').update({ connected_user_id: null }).eq('id', session.user.id);
          if (friendData?.id) await supabase.from('profiles').update({ connected_user_id: null }).eq('id', friendData.id);
          setFriendData(null);
      }}
    ]);
  };

  const handleDrinkWater = async () => {
    const newCount = waterCount + 1;
    const todayKey = getLocalYYYYMMDD();
    const newHistory = { ...historyData, [todayKey]: newCount };
    setWaterCount(newCount);
    setHistoryData(newHistory);
    await supabase.from('profiles').update({ water_count: newCount, history: newHistory }).eq('id', session.user.id);
  };

  const sendReminder = async () => {
    if (!friendData?.push_token) return Alert.alert('Oops!', 'They do not have notifications enabled.');
    const message = { to: friendData.push_token, sound: 'default', title: '💧 Hydrate!', body: 'Your partner sent a reminder to drink water!' };
    try {
      await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
      Alert.alert('Sent!', 'Reminder sent to your partner.');
    } catch (e) { Alert.alert('Notice', 'Reminder triggered! (Browser blocked receipt).'); }
  };

  // --- DYNAMIC SHAPE MATHEMATICS ---
  const getShapeStyle = (size) => {
    if (stickerShape === 'circle') return { borderRadius: size / 2, overflow: 'hidden' };
    if (stickerShape === 'drop') return { 
      borderTopLeftRadius: size * 0.05, 
      borderTopRightRadius: size, 
      borderBottomLeftRadius: size, 
      borderBottomRightRadius: size, 
      transform: [{ rotate: '45deg' }], 
      overflow: 'hidden' 
    };
    return { borderRadius: size * 0.15, overflow: 'hidden' }; 
  };

  const getCurrentVisual = () => {
    let stage = waterCount >= 12 ? 'stage3' : waterCount >= 8 ? 'stage2' : waterCount >= 4 ? 'stage1' : 'stage0';
    let defaultEmoji = waterCount >= 12 ? '✨' : waterCount >= 8 ? '🌳' : waterCount >= 4 ? '🪴' : '🏜️';
    
    const shapeStyle = getShapeStyle(220);
    // Scale 1.4 fills the corners of the rotated bounding box. -45deg keeps the image perfectly upright.
    const innerStyle = stickerShape === 'drop' ? { transform: [{ rotate: '-45deg' }, { scale: 1.4 }] } : {};

    return (
      <View style={[styles.mainImageWrapper, shapeStyle, { backgroundColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border }]}>
        {customImages[stage] ? 
          <Image source={{ uri: customImages[stage] }} style={[styles.mainImage, innerStyle]} /> : 
          <View style={[{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }, innerStyle]}>
            <Text style={{ fontSize: 110 }}>{defaultEmoji}</Text>
          </View>
        }
      </View>
    );
  };

  const renderCalendar = () => {
    const changeDate = (days) => {
      const d = new Date(calDate);
      if (calView === 'weekly') d.setDate(d.getDate() + days);
      else d.setMonth(d.getMonth() + (days > 0 ? 1 : -1));
      setCalDate(d);
    };

    let daysToRender = [];
    if (calView === 'weekly') {
      const start = new Date(calDate);
      start.setDate(start.getDate() - start.getDay() + 1); 
      for(let i=0; i<7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        daysToRender.push(d);
      }
    } else {
      const year = calDate.getFullYear();
      const month = calDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay() || 7; 
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for(let i=1; i<firstDay; i++) daysToRender.push(null);
      for(let i=1; i<=daysInMonth; i++) daysToRender.push(new Date(year, month, i));
    }

    return (
      <BlurView intensity={30} tint={theme.cardTint} style={[styles.calContainer, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border || 1 }]}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => changeDate(calView === 'weekly' ? -7 : -1)}>
            <BlurView intensity={50} tint={theme.cardTint} style={styles.iconGlass}><Ionicons name="chevron-back" size={20} color={theme.text}/></BlurView>
          </TouchableOpacity>
          <Text style={[styles.calTitle, { color: theme.text, fontFamily: fontHeading }]}>{calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={() => changeDate(calView === 'weekly' ? 7 : 1)}>
            <BlurView intensity={50} tint={theme.cardTint} style={styles.iconGlass}><Ionicons name="chevron-forward" size={20} color={theme.text}/></BlurView>
          </TouchableOpacity>
        </View>
        
        <View style={styles.calGrid}>
          {['M','T','W','T','F','S','S'].map((d, i) => <Text key={i} style={[styles.calDayLabel, { color: theme.text, opacity: 0.5, fontFamily: fontBody }]}>{d}</Text>)}
          {daysToRender.map((d, i) => {
            if (!d) return <View key={i} style={styles.calCell} />;
            const key = getLocalYYYYMMDD(d);
            const isToday = key === getLocalYYYYMMDD();
            const count = historyData[key] || (isToday ? waterCount : 0);
            return (
              <View key={i} style={[styles.calCell]}>
                {isToday ? (
                   <BlurView intensity={80} tint="dark" style={styles.todayHighlight}>
                     <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', fontFamily: fontBody }}>{d.getDate()}</Text>
                   </BlurView>
                ) : (
                   <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.text, fontFamily: fontBody }}>{d.getDate()}</Text>
                )}
                {count > 0 && <Text style={{ fontSize: 10, color: theme.accent, fontWeight: '900', marginTop: 2, fontFamily: fontBody }}>{count} 💧</Text>}
              </View>
            );
          })}
        </View>
        <TouchableOpacity style={{ alignSelf: 'center', marginTop: 15 }} onPress={() => setCalView(calView === 'weekly' ? 'monthly' : 'weekly')}>
          <BlurView intensity={40} tint={theme.cardTint} style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 15, overflow: 'hidden' }}>
            <Text style={{ color: theme.text, fontSize: 12, fontFamily: fontBody }}>Switch to {calView === 'weekly' ? 'Monthly' : 'Weekly'}</Text>
          </BlurView>
        </TouchableOpacity>
      </BlurView>
    );
  };

  if (!session && !session?.user) return <Auth />;

  return (
    <LinearGradient colors={theme.bg} style={styles.container}>
      
      {/* MAIN HOME TAB */}
      {activeTab === 'home' ? (
        <View style={styles.content}>
          <TouchableOpacity onPress={handleDrinkWater} activeOpacity={0.8} style={styles.heroSection}>
            {getCurrentVisual()}
            <BlurView intensity={80} tint={theme.cardTint} style={[styles.tapBadge, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border || 1 }]}>
              <Ionicons name="add" size={24} color={theme.text} />
              <Text style={{color: theme.text, fontFamily: fontBody, fontSize: 16, marginLeft: 4}}>Tap to Sip</Text>
            </BlurView>
          </TouchableOpacity>

          <View style={styles.countWrapper}>
            <Text style={[styles.counter, { color: theme.text, fontFamily: fontHeading }]}>{waterCount}</Text>
            <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6, fontFamily: fontBody }]}>Daily Glasses</Text>
          </View>

          {/* Social Glass Card */}
          {friendData && (
             <BlurView intensity={50} tint={theme.cardTint} style={[styles.glassCard, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border || 1 }]}>
                <View style={styles.friendInfoRow}>
                  <BlurView intensity={80} tint={theme.cardTint} style={styles.partnerAvatar}>
                    <Ionicons name="heart" size={24} color={theme.accent} />
                  </BlurView>
                  <View>
                    <Text style={[styles.friendLabel, { color: theme.text, opacity: 0.7, fontFamily: fontBody }]}>Partner's Water</Text>
                    <Text style={[styles.friendCount, { color: theme.text, fontFamily: fontHeading }]}>{friendData.water_count} <Text style={{fontSize: 14, fontFamily: fontBody}}>glasses</Text></Text>
                  </View>
                </View>
                
                <TouchableOpacity onPress={sendReminder} style={{ marginTop: 20 }}>
                   <BlurView intensity={90} tint={theme.cardTint} style={[styles.reminderBtn, { backgroundColor: theme.accent + '20', borderColor: theme.accent, borderWidth: 1 }]}>
                     <Ionicons name="notifications" size={20} color={theme.accent} />
                     <Text style={[styles.reminderText, { color: theme.accent, fontFamily: fontBody }]}>Send Reminder</Text>
                   </BlurView>
                </TouchableOpacity>
             </BlurView>
          )}
        </View>
      ) : (

      /* SETTINGS / MENU TAB */
        <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.headerText, { color: theme.text, fontFamily: fontHeading }]}>Dashboard</Text>

          {renderCalendar()}

          {/* Sticker Customization */}
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBody }]}>Aesthetics</Text>
          <BlurView intensity={30} tint={theme.cardTint} style={[styles.settingsCard, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border || 1 }]}>
            
            <Text style={[styles.subLabel, { color: theme.text, fontFamily: fontBody }]}>Sticker Shape</Text>
            <View style={styles.row}>
              {['circle', 'square', 'drop'].map(s => (
                <TouchableOpacity key={s} onPress={() => updateSetting('stickerShape', s, setStickerShape)}>
                  <BlurView intensity={stickerShape === s ? 100 : 30} tint={stickerShape === s ? 'dark' : theme.cardTint} style={styles.shapeBtn}>
                     <Text style={{ color: stickerShape === s ? '#fff' : theme.text, textTransform: 'capitalize', fontFamily: fontBody, textAlign: 'center' }}>{s}</Text>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.subLabel, { color: theme.text, marginTop: 30, marginBottom: 15, fontFamily: fontBody }]}>Tap to update stages</Text>
            
            <View style={styles.stickerRow}>
              {[{ id: 'stage0', n: 0 }, { id: 'stage1', n: 4 }, { id: 'stage2', n: 8 }, { id: 'stage3', n: 12 }].map((stg) => (
                
                <TouchableOpacity key={stg.id} style={styles.stickerWrapper} onPress={() => pickImage(stg.id)}>
                  <BlurView intensity={40} tint={theme.cardTint} style={[styles.stickerGlass, getShapeStyle(52)]}>
                    {customImages[stg.id] ? 
                      <Image source={{ uri: customImages[stg.id] }} style={[{width: '100%', height: '100%'}, stickerShape === 'drop' && { transform: [{rotate: '-45deg'}, {scale: 1.4}] }]} /> 
                      : 
                      <View style={[ stickerShape === 'drop' && { transform: [{rotate: '-45deg'}] } ]}>
                        <Text style={{fontSize: 14, fontFamily: fontBody, color: theme.text}}>{stg.n} 💧</Text>
                      </View>
                    }
                  </BlurView>
                </TouchableOpacity>

              ))}
            </View>
          </BlurView>

          {/* Theme Selector */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20, fontFamily: fontBody }]}>Themes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {Object.keys(THEMES).map((key) => (
              <TouchableOpacity key={key} onPress={() => updateSetting('appTheme', key, setCurrentTheme)} style={{ marginRight: 15 }}>
                <BlurView intensity={currentTheme === key ? 100 : 40} tint={theme.cardTint} style={[styles.themePill, { borderColor: currentTheme === key ? THEMES[key].accent : 'rgba(255,255,255,0.4)', borderWidth: 1 }]}>
                  <Text style={{color: currentTheme === key ? THEMES[key].accent : theme.text, fontFamily: fontBody, fontSize: 14, textAlign: 'center'}}>{THEMES[key].name}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Connection Box */}
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBody }]}>Partner Link</Text>
          <BlurView intensity={30} tint={theme.cardTint} style={[styles.linkCard, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.4)', borderWidth: theme.border || 1 }]}>
            <Text style={[styles.myCodeText, { color: theme.text, fontFamily: fontBody }]}>Your Code: <Text style={{fontSize: 24, letterSpacing: 4, fontFamily: fontHeading}}>{myCode}</Text></Text>
            
            {friendData ? (
              <View style={styles.linkRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{color: theme.text, opacity: 0.6, fontSize: 12, fontFamily: fontBody}}>Linked to</Text>
                  <Text style={{color: theme.text, fontSize: 20, letterSpacing: 2, fontFamily: fontHeading}}>{friendData.connection_code}</Text>
                </View>
                <TouchableOpacity onPress={unlinkPartner} style={{ flexShrink: 0 }}>
                  <BlurView intensity={80} tint="dark" style={styles.actionBtn}>
                    <Text style={{ color: '#fff', fontFamily: fontBody, textAlign: 'center' }}>Unlink</Text>
                  </BlurView>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.linkRow}>
                <TextInput style={[styles.input, { color: theme.text, borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1, fontFamily: fontBody }]} placeholder="Partner code" placeholderTextColor={theme.text} value={friendInput} onChangeText={setFriendInput} keyboardType="numeric" maxLength={6} />
                <TouchableOpacity onPress={handleConnect} style={{ flexShrink: 0, marginLeft: 10 }}>
                   <BlurView intensity={80} tint="dark" style={styles.actionBtn}>
                     <Text style={{ color: '#fff', fontFamily: fontBody, textAlign: 'center' }}>Connect</Text>
                   </BlurView>
                </TouchableOpacity>
              </View>
            )}
          </BlurView>

          {/* Account Actions */}
          <View style={{ marginTop: 40, alignItems: 'center', gap: 20 }}>
            <TouchableOpacity onPress={() => supabase.auth.signOut()}>
              <Text style={{ color: theme.text, fontFamily: fontBody, fontSize: 16, fontWeight: 'bold' }}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {
              Alert.alert('Delete Account', 'Are you sure? This will permanently erase your data and unlink your partner. This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete Everything', style: 'destructive', onPress: async () => {
                    await supabase.rpc('delete_my_account');
                    await supabase.auth.signOut();
                }}
              ]);
            }}>
              <Text style={{ color: '#ef4444', fontFamily: fontBody, fontSize: 14 }}>Delete Account</Text>
            </TouchableOpacity>
          </View>
          <View style={{height: 140}} /> 
        </ScrollView>
      )}

      {/* FLOATING GLASS MENU BAR */}
      <View style={styles.navWrapper}>
        <BlurView intensity={60} tint={theme.cardTint} style={[styles.navBar, { borderColor: theme.border ? theme.text : 'rgba(255,255,255,0.5)', borderWidth: theme.border || 1 }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Ionicons name={activeTab === 'home' ? 'water' : 'water-outline'} size={26} color={activeTab === 'home' ? theme.accent : theme.text} style={{ opacity: activeTab === 'home' ? 1 : 0.6 }} />
            <Text style={{ color: activeTab === 'home' ? theme.accent : theme.text, fontSize: 11, fontFamily: fontBody, marginTop: 4, opacity: activeTab === 'home' ? 1 : 0.6 }}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('settings')}>
            <Ionicons name={activeTab === 'settings' ? 'grid' : 'grid-outline'} size={24} color={activeTab === 'settings' ? theme.accent : theme.text} style={{ opacity: activeTab === 'settings' ? 1 : 0.6 }} />
            <Text style={{ color: activeTab === 'settings' ? theme.accent : theme.text, fontSize: 11, fontFamily: fontBody, marginTop: 4, opacity: activeTab === 'settings' ? 1 : 0.6 }}>Dashboard</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  
  heroSection: { alignItems: 'center', marginBottom: 20 },
  mainImageWrapper: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  tapBadge: { position: 'absolute', bottom: -15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, overflow: 'hidden' },
  
  countWrapper: { alignItems: 'center', marginBottom: 30 },
  counter: { fontSize: 110, letterSpacing: -2 },
  subtitle: { fontSize: 16, textTransform: 'uppercase', letterSpacing: 2 },
  
  glassCard: { width: '85%', padding: 25, borderRadius: 35, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  friendInfoRow: { flexDirection: 'row', alignItems: 'center' },
  partnerAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 15, overflow: 'hidden' },
  friendLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  friendCount: { fontSize: 36 },
  
  reminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 20, overflow: 'hidden' },
  reminderText: { marginLeft: 8, fontSize: 16 },

  menuScroll: { flex: 1, padding: 25, paddingTop: 60 },
  menuContent: { paddingBottom: 40 },
  headerText: { fontSize: 36, marginBottom: 30 },
  sectionTitle: { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 15, marginLeft: 5 },
  
  settingsCard: { padding: 25, borderRadius: 35, overflow: 'hidden', marginBottom: 30 },
  subLabel: { fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  
  stickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stickerWrapper: { width: '23%', height: 80, alignItems: 'center', justifyContent: 'center' },
  stickerGlass: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1 },
  
  shapeBtn: { paddingVertical: 14, paddingHorizontal: 15, minWidth: 90, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  themePill: { paddingVertical: 16, paddingHorizontal: 20, minWidth: 100, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { paddingHorizontal: 25, paddingVertical: 16, minWidth: 100, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  
  linkCard: { padding: 25, borderRadius: 35, overflow: 'hidden' },
  myCodeText: { fontSize: 18, marginBottom: 20, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', padding: 15, borderRadius: 25 },
  input: { flex: 1, padding: 14, borderRadius: 15, textAlign: 'center', letterSpacing: 2 },

  calContainer: { padding: 25, borderRadius: 35, overflow: 'hidden', marginBottom: 35 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconGlass: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  calTitle: { fontSize: 20 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayLabel: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, marginBottom: 15 },
  calCell: { width: `${100/7}%`, height: 45, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  todayHighlight: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  navWrapper: { position: 'absolute', bottom: 35, left: 0, right: 0, alignItems: 'center' },
  navBar: { flexDirection: 'row', width: '65%', paddingVertical: 15, borderRadius: 35, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.15, shadowRadius: 30 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});