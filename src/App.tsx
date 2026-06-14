/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { 
  Menu, 
  User, 
  Clock, 
  Fingerprint, 
  Home, 
  LayoutGrid, 
  BookOpen, 
  Zap,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  LogIn,
  LogOut,
  Sparkles,
  Search,
  Book,
  Heart,
  ChevronRight,
  Settings,
  ShieldAlert,
  Bell,
  Trash2,
  Send,
  Users,
  Info,
  ShieldCheck,
  RefreshCw,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signIn } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, collection, query, orderBy, addDoc, deleteDoc, getDocs, where, limit } from 'firebase/firestore';

// --- Types & Constants ---
type Screen = 'home' | 'library' | 'tasbih' | 'hadith' | 'quran' | 'surah_view' | 'admin' | 'settings' | 'notifications';
const ADMIN_EMAIL = 'abdarrahmannagi@gmail.com';

interface AzkarItem {
  id: number;
  text: string;
  count: number;
  max: number;
}

interface AzkarCategory {
  id: string;
  title: string;
  items: AzkarItem[];
  icon: ReactNode;
  color: string;
  description: string;
}

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface Hadith {
  id: number;
  title: string;
  text: string;
  source: string;
  category: string;
}

interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  tasbihCount: number;
  updatedAt: any;
  lastActive?: any;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'global' | 'personal';
  createdAt: any;
  targetUserId?: string;
  senderId?: string;
}

const CATEGORIES: Record<string, AzkarCategory> = {
  morning: {
    id: 'morning',
    title: "أذكار الصباح",
    description: "حصن المسلم ليبدأ يومه بحفظ الله",
    color: "bg-[#ffe081]",
    icon: <Zap className="text-[#725c00]"/>,
    items: [
      { id: 1, text: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ", count: 0, max: 1 },
      { id: 2, text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ", count: 0, max: 3 },
      { id: 3, text: "اللَّهُمَّ عافِني في بَدَني، اللَّهُمَّ عافِني في سَمْعي، اللَّهُمَّ عافِني في بَصَري", count: 0, max: 3 },
      { id: 4, text: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ", count: 0, max: 1 },
      { id: 5, text: "أستغفر الله وأتوب إليه", count: 0, max: 100 },
    ]
  },
  evening: {
    id: 'evening',
    title: "أذكار المساء",
    description: "سكينة النفس وحفظ الرحمن حتى الصباح",
    color: "bg-tertiary-container",
    icon: <Clock className="text-tertiary"/>,
    items: [
      { id: 11, text: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ", count: 0, max: 1 },
      { id: 12, text: "بِاسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", count: 0, max: 3 },
      { id: 13, text: "أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", count: 0, max: 3 },
    ]
  },
  sleep: {
    id: 'sleep',
    title: "أذكار النوم",
    description: "آيات وأدعية لراحة البال وعظيم الأجر",
    color: "bg-blue-100",
    icon: <BookOpen className="text-blue-600"/>,
    items: [
      { id: 31, text: "بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ", count: 0, max: 1 },
      { id: 32, text: "اللهم قني عذابك يوم تبعث عبادك", count: 0, max: 3 },
    ]
  }
};

const HADITHS_LIST: Hadith[] = [
  { id: 1, title: "النيات في الأعمال", text: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ...", source: "صحيح البخاري", category: "الإيمان" },
  { id: 2, title: "النصيحة في الدين", text: "الدِّينُ النَّصِيحَةُ. قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ، وَلِكِتَابِهِ، وَلِرَسُولِهِ، وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ.", source: "صحيح مسلم", category: "المعاملات" },
  { id: 3, title: "حسن الخلق", text: "الْبِرُّ حُسْنُ الْخُلُقِ، وَالْإِثْمُ مَا حَاكَ فِي نَفْسِكَ وَكَرِهْتَ أَنْ يَطَّلِعَ عَلَيْهِ النَّاسُ.", source: "رواه مسلم", category: "الأخلاق" },
  { id: 4, title: "من كان يؤمن بالله", text: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيُكْرِمْ جَارَهُ...", source: "متفق عليه", category: "المعاملات" },
];

export default function App() {
  // State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('morning');
  const [tasbihCount, setTasbihCount] = useState(0);
  const [azkarSession, setAzkarSession] = useState<AzkarItem[]>(CATEGORIES.morning.items);
  const [currentAzkarIndex, setCurrentAzkarIndex] = useState(0);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahSearch, setSurahSearch] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [surahContent, setSurahContent] = useState<Ayah[]>([]);
  const [fetchingSurah, setFetchingSurah] = useState(false);
  
  // Admin & Settings State
  const [isAdmin, setIsAdmin] = useState(false);
  const [appUsers, setAppUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Real-time Notification Toast
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [lastNotifId, setLastNotifId] = useState<string | null>(null);

  // Fetch Quran Data
  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => setSurahs(data.data))
      .catch(err => console.error("Quran API Error:", err));
  }, []);

  // Auth & Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // User profile sync
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setTasbihCount(snapshot.data().tasbihCount || 0);
      } else {
        setDoc(userRef, { 
          userId: user.uid, 
          tasbihCount: 0, 
          updatedAt: serverTimestamp(), 
          displayName: user.displayName || 'مستخدم', 
          email: user.email 
        });
      }
    });

    // Notifications Sync & Toast Trigger
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      const latest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AppNotification;
      
      // Only show toast if it's a new notification and relevant to user
      if ((latest.type === 'global' || latest.targetUserId === user.uid) && latest.id !== lastNotifId) {
        // Don't show toast on initial load (first time lastNotifId is null)
        if (lastNotifId !== null) {
          setActiveToast(latest);
          setTimeout(() => setActiveToast(null), 8000);
        }
        setLastNotifId(latest.id);
      }
    });

    // Full history sync
    const qAll = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AppNotification))
        .filter(n => n.type === 'global' || n.targetUserId === user.uid);
      setNotifications(notifs);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeNotifs();
      unsubscribeAll();
    };
  }, [user, lastNotifId]);

  // Admin: Fetch all users
  useEffect(() => {
    if (!isAdmin || activeScreen !== 'admin') return;
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAppUsers(users);
    });
    return () => unsubscribeUsers();
  }, [isAdmin, activeScreen]);

  // Handlers
  const handleTasbih = async () => {
    if (!user) return;
    const newCount = tasbihCount + 1;
    setTasbihCount(newCount);
    updateDoc(doc(db, 'users', user.uid), { tasbihCount: newCount, updatedAt: serverTimestamp() });
  };

  const handleAzkarStep = () => {
    const newSession = [...azkarSession];
    if (newSession[currentAzkarIndex].count < newSession[currentAzkarIndex].max) {
      newSession[currentAzkarIndex].count += 1;
      setAzkarSession(newSession);
    } else if (currentAzkarIndex < newSession.length - 1) {
      setCurrentAzkarIndex(prev => prev + 1);
    }
  };

  const loadCategory = (catId: string) => {
    setSelectedCategory(catId);
    setAzkarSession(CATEGORIES[catId].items.map(item => ({ ...item, count: 0 })));
    setCurrentAzkarIndex(0);
    setActiveScreen('home');
  };

  const viewSurah = (surah: Surah) => {
    setSelectedSurah(surah);
    setFetchingSurah(true);
    fetch(`https://api.alquran.cloud/v1/surah/${surah.number}`)
      .then(res => res.json())
      .then(data => {
        setSurahContent(data.data.ayahs);
        setActiveScreen('surah_view');
      })
      .finally(() => setFetchingSurah(false));
  };

  const filteredSurahs = useMemo(() => {
    return surahs.filter(s => s.name.includes(surahSearch) || s.englishName.toLowerCase().includes(surahSearch.toLowerCase()));
  }, [surahs, surahSearch]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen pb-28 max-w-md mx-auto relative flex flex-col bg-surface-background">
      {/* Toast Notification */}
      <AnimatePresence>
        {activeToast && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-6 right-6 z-[100]"
          >
            <div className="bg-primary text-white p-5 rounded-[2rem] shadow-[0_15px_40px_rgba(114,92,0,0.4)] border border-white/20 backdrop-blur-md flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6 animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm">{activeToast.title}</p>
                <p className="text-xs opacity-80 line-clamp-2 mt-1">{activeToast.body}</p>
              </div>
              <button onClick={() => setActiveToast(null)} className="p-2 hover:bg-white/10 rounded-full">
                <ChevronRight className="w-5 h-5 -rotate-90" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-surface-background/95 backdrop-blur-xl z-40 border-b border-surface-variant/30">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveScreen('notifications')} className="relative p-2 hover:bg-surface-variant rounded-xl transition-all">
            <Bell className="w-5 h-5 text-on-surface-variant" />
            {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />}
          </button>
          {isAdmin && (
            <button onClick={() => setActiveScreen('admin')} className={`p-2 rounded-xl transition-all ${activeScreen === 'admin' ? 'bg-primary text-white shadow-lg' : 'hover:bg-primary/10 text-primary'}`}>
              <ShieldAlert className="w-5 h-5" />
            </button>
          )}
        </div>
        <h1 className="text-2xl font-black text-primary font-sans cursor-pointer" onClick={() => setActiveScreen('home')}>أذكار</h1>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveScreen('settings')}>
           <span className="text-[10px] font-bold text-on-surface-variant hidden sm:inline">{user.displayName?.split(' ')[0]}</span>
           <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-primary/20" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-4 scroll-smooth">
        <AnimatePresence mode="wait">
          {activeScreen === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 px-1">
              <GreetingSection title={CATEGORIES[selectedCategory]?.title} />
              <MainCard 
                item={azkarSession[currentAzkarIndex]} 
                onAction={handleAzkarStep} 
                isLast={currentAzkarIndex === azkarSession.length - 1 && azkarSession[currentAzkarIndex].count === azkarSession[currentAzkarIndex].max}
              />
              <RecommendedSection onSelect={() => setActiveScreen('library')} />
            </motion.div>
          )}

          {activeScreen === 'tasbih' && (
            <motion.div key="tasbih" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="px-6 py-12 flex flex-col items-center space-y-12 min-h-[60vh]">
              <div className="text-center">
                <h2 className="text-3xl font-black text-on-surface">المسبحة الذكية</h2>
                <p className="text-sm opacity-60">التسبيح حياة القلب</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }} onClick={handleTasbih}
                className="relative w-64 h-64 rounded-full bg-white shadow-2xl border-[10px] border-primary/5 flex flex-col items-center justify-center group"
              >
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
                <span className="text-7xl font-black text-primary tabular-nums">{tasbihCount}</span>
                <Fingerprint className="w-8 h-10 text-primary/30 mt-4" />
              </motion.button>
              <button 
                onClick={() => updateDoc(doc(db, 'users', user!.uid), { tasbihCount: 0 })} 
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-surface-variant text-on-surface-variant font-bold active:scale-95 transition-all shadow-sm"
              >
                <RotateCcw className="w-4 h-4" /> تصفير العداد
              </button>
            </motion.div>
          )}

          {activeScreen === 'library' && (
            <motion.div key="library" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-4">
              <h2 className="text-2xl font-black px-2 mb-4">مكتبة الأذكار</h2>
              {Object.values(CATEGORIES).map(cat => (
                <LibraryItem key={cat.id} title={cat.title} sub={cat.description} icon={cat.icon} color={cat.color} onClick={() => loadCategory(cat.id)} />
              ))}
            </motion.div>
          )}

          {activeScreen === 'hadith' && (
            <motion.div key="hadith" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 space-y-6 pb-12">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">السنة النبوية</h2>
                <div className="p-2 bg-primary/10 rounded-lg text-primary scale-90"><Book className="w-5 h-5"/></div>
              </div>
              <div className="grid gap-6">
                {HADITHS_LIST.map(h => (
                  <motion.div key={h.id} whileHover={{ y: -4 }} className="p-6 bg-white rounded-3xl border border-surface-variant/50 space-y-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rounded-bl-full flex items-center justify-center text-[7px] font-black text-primary">{h.category}</div>
                    <h3 className="text-xl font-bold text-primary">{h.title}</h3>
                    <p className="text-lg leading-relaxed text-on-surface font-medium border-r-2 border-primary/20 pr-4">{h.text}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-surface-variant/30 text-[10px] font-bold opacity-60">
                      <span>📚 {h.source}</span>
                      <Heart className="w-3 h-3 text-red-400"/>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeScreen === 'quran' && (
            <motion.div key="quran" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 space-y-6">
              <h2 className="text-2xl font-black">القرآن الكريم</h2>
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-40" />
                <input 
                  type="text" placeholder="ابحث عن سورة..." 
                  className="w-full h-12 bg-white rounded-2xl pr-12 pl-4 text-sm font-bold border border-surface-variant/50 outline-none"
                  value={surahSearch} onChange={(e) => setSurahSearch(e.target.value)}
                />
              </div>
              {fetchingSurah && <div className="text-center py-4 animate-pulse font-bold text-primary">جاري تحميل السورة...</div>}
              <div className="grid grid-cols-1 gap-3">
                {filteredSurahs.map(s => (
                  <SurahListItem key={s.number} surah={s} onClick={() => viewSurah(s)} />
                ))}
              </div>
            </motion.div>
          )}

          {activeScreen === 'surah_view' && selectedSurah && (
            <motion.div key="surah_view" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-5 pb-12">
               <button onClick={() => setActiveScreen('quran')} className="mb-6 flex items-center gap-2 text-primary font-bold active:translate-x-2 transition-transform bg-white/50 px-4 py-2 rounded-full border border-surface-variant/50">
                 <ChevronRight className="w-5 h-5"/> عودة للمصحف الكامل
               </button>
               <div className="bg-[#fcfaf2] rounded-[3rem] p-10 shadow-2xl border border-[#e6dec3] space-y-10 min-h-[85vh] relative text-right">
                 <div className="absolute inset-0 pointer-events-none border-[20px] border-double border-[#e6dec3]/20 rounded-[3rem] m-2"></div>
                 <div className="text-center space-y-4 border-b-2 border-primary/10 pb-10">
                   <div className="text-primary opacity-20 font-serif text-6xl select-none">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
                   <h2 className="text-4xl font-bold text-on-surface font-serif">{selectedSurah.name}</h2>
                   <p className="text-sm font-bold text-primary italic uppercase tracking-widest">{selectedSurah.englishName} • {selectedSurah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</p>
                 </div>
                 <div className="space-y-8 leading-[3.2] text-3xl font-bold text-on-surface text-center font-serif antialiased pb-20">
                   {surahContent.map(ayah => (
                     <span key={ayah.number} className="inline group transition-all">
                        {ayah.text} 
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary/30 text-xs text-primary mx-3 font-mono align-middle bg-white/80 shadow-sm relative">
                          {ayah.numberInSurah}
                          <div className="absolute inset-0 border border-primary/5 rounded-full rotate-45 scale-110"></div>
                        </span>
                     </span>
                   ))}
                 </div>
                 <div className="pt-12 text-center opacity-20 text-[12px] font-black tracking-widest pb-10">صدق الله العظيم</div>
               </div>
            </motion.div>
          )}

          {activeScreen === 'notifications' && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-6 space-y-8 min-h-[75vh]">
              <div className="flex items-center justify-between mt-4">
                <h2 className="text-3xl font-black">الرسائل الواردة</h2>
                <div className="relative">
                  <BellRing className="text-primary w-8 h-8" />
                  {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] flex items-center justify-center text-white font-black">{notifications.length}</span>}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="py-32 text-center space-y-6 opacity-30 flex flex-col items-center">
                  <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center">
                    <Bell className="w-10 h-10" />
                  </div>
                  <p className="font-black text-lg">صندوق الوارد فارغ حالياً</p>
                </div>
              ) : (
                <div className="grid gap-5">
                  {notifications.map(n => (
                    <motion.div 
                      key={n.id} 
                      initial={{ scale: 0.95, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-6 bg-white rounded-[2rem] border border-surface-variant/50 shadow-sm relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-2 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold text-primary">{n.title}</h3>
                        <span className="text-[9px] font-black opacity-30 py-1 px-3 bg-surface-variant/30 rounded-full">
                          {n.createdAt ? new Date(n.createdAt.toDate()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
                        </span>
                      </div>
                      <p className="text-base text-on-surface leading-relaxed opacity-80">{n.body}</p>
                      {isAdmin && (
                        <div className="mt-4 pt-4 border-t border-surface-variant/30 flex justify-end">
                           <button 
                            onClick={async () => {
                              if (confirm('حذف هذا التنبيه؟')) {
                                await deleteDoc(doc(db, 'notifications', n.id));
                              }
                            }}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeScreen === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 space-y-8 pb-10">
              <h2 className="text-3xl font-black">الإعدادات</h2>
              
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-surface-variant/50 space-y-6">
                <div className="flex items-center gap-4">
                   <img src={user.photoURL || ''} className="w-16 h-16 rounded-2xl" alt="" />
                   <div>
                     <h3 className="font-bold text-lg">{user.displayName}</h3>
                     <p className="text-xs opacity-50">{user.email}</p>
                   </div>
                </div>
                
                <div className="pt-4 border-t border-surface-variant/30 space-y-4">
                   <button className="w-full flex items-center justify-between p-2 font-bold group">
                     <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-primary"/> تنبيهات الصلاة</div>
                     <div className="w-10 h-6 bg-primary rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-fullShadow shadow-sm" /></div>
                   </button>
                   <button className="w-full flex items-center justify-between p-2 font-bold group">
                     <div className="flex items-center gap-3"><Info className="w-5 h-5 text-tertiary"/> حول التطبيق</div>
                     <ChevronLeft className="w-4 h-4 opacity-30" />
                   </button>
                   <button 
                    onClick={() => alert('لتثبيت التطبيق على هاتفك:\n1. من المتصفح (Chrome/Safari) اضغط على زر "مشاركة" أو "الخيارات"\n2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)\nسيظهر التطبيق كأنه تطبيق أصلي على جوالك!')}
                    className="w-full flex items-center justify-between p-2 font-bold group border-t border-surface-variant/10 pt-4"
                   >
                     <div className="flex items-center gap-3"><RefreshCw className="w-5 h-5 text-blue-500"/> تثبيت التطبيق كـ APK</div>
                     <ChevronLeft className="w-4 h-4 opacity-30" />
                   </button>
                </div>
              </div>

              <button onClick={() => signOut(auth)} className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-bold flex items-center justify-center gap-3 hover:bg-red-100 transition-colors">
                <LogOut className="w-5 h-5" /> تسجيل الخروج
              </button>

              <div className="text-center space-y-1 pt-4 opacity-30">
                <p className="text-[10px] font-black uppercase">Azkar App v2.4.0</p>
                <p className="text-[8px]">Made with spiritual intent</p>
              </div>
            </motion.div>
          )}

          {isAdmin && activeScreen === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-6 space-y-8 pb-10">
              <div className="p-6 bg-red-600 rounded-[2.5rem] text-white shadow-xl space-y-4 relative overflow-hidden">
                <ShieldAlert className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
                <h2 className="text-2xl font-black">لوحة الإدارة</h2>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] font-bold opacity-70">إجمالي المستخدمين</p>
                    <p className="text-2xl font-black">{appUsers.length}</p>
                  </div>
                  <div className="flex-1 bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] font-bold opacity-70">إجمالي التسبيحات</p>
                    <p className="text-2xl font-black">{appUsers.reduce((acc, u) => acc + (u.tasbihCount || 0), 0)}</p>
                  </div>
                </div>
              </div>

              <section className="space-y-4">
                <h3 className="text-lg font-black flex items-center gap-2"><Send className="w-4 h-4 text-primary"/> إرسال إشعار عام</h3>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
                    const body = (form.elements.namedItem('body') as HTMLTextAreaElement).value;
                    if (title && body && user) {
                      try {
                        await addDoc(collection(db, 'notifications'), {
                          title, body, type: 'global', createdAt: serverTimestamp(), senderId: user.uid
                        });
                        form.reset();
                        alert('تم إرسال الإشعار لجميع المستخدمين بنجاح ✔️');
                      } catch (err) {
                        console.error(err);
                        alert('فشل في إرسال الإشعار');
                      }
                    }
                  }}
                  className="bg-white p-6 rounded-3xl border border-surface-variant/50 space-y-4 shadow-sm"
                >
                  <input name="title" placeholder="عنوان الإشعار..." className="w-full h-12 bg-surface-variant/50 rounded-xl px-4 font-bold outline-none border border-transparent focus:border-primary transition-all text-sm" required />
                  <textarea name="body" placeholder="اكتب محتوى الرسالة هنا..." className="w-full h-24 bg-surface-variant/50 rounded-xl p-4 font-medium outline-none border border-transparent focus:border-primary transition-all resize-none text-sm" required />
                  <button type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-black shadow-lg active:scale-95 transition-all text-lg relative overflow-hidden group">
                    <span className="relative z-10">إرسال للجميع الآن</span>
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                  </button>
                </form>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-black flex items-center gap-2"><Users className="w-4 h-4 text-primary"/> المستخدمون النشطون</h3>
                <div className="space-y-3">
                  {appUsers.map(u => (
                    <div key={u.userId} className="p-4 bg-white rounded-2xl border border-surface-variant/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-xs uppercase">{u.displayName?.[0]}</div>
                        <div>
                          <p className="font-bold text-sm leading-none">{u.displayName}</p>
                          <p className="text-[10px] opacity-40 mt-1">{u.email}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-primary">{u.tasbihCount} 📿</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-surface-variant/30 flex items-center justify-around px-2 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] pb-2 sm:pb-0">
        <NavItem icon={<Home className="w-6 h-6" />} label="الرئيسية" active={activeScreen === 'home'} onClick={() => setActiveScreen('home')} />
        <NavItem icon={<LayoutGrid className="w-6 h-6" />} label="المكتبة" active={activeScreen === 'library'} onClick={() => setActiveScreen('library')} />
        <NavItem icon={<Fingerprint className="w-6 h-6" />} label="المسبحة" active={activeScreen === 'tasbih'} onClick={() => setActiveScreen('tasbih')} />
        <NavItem icon={<Zap className="w-6 h-6" />} label="السنة" active={activeScreen === 'hadith'} onClick={() => setActiveScreen('hadith')} />
        <NavItem icon={<BookOpen className="w-6 h-6" />} label="القرآن" active={activeScreen === 'quran' || activeScreen === 'surah_view'} onClick={() => setActiveScreen('quran')} />
        <NavItem icon={<Settings className="w-6 h-6" />} label="الإعدادات" active={activeScreen === 'settings'} onClick={() => setActiveScreen('settings')} />
      </nav>
    </div>
  );
}

// --- Sub Components ---

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface-background flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-14 h-14 border-[6px] border-primary border-t-transparent rounded-full shadow-lg" />
    </div>
  );
}

function AuthScreen() {
  return (
    <div className="min-h-screen bg-surface-background flex flex-col items-center justify-center p-6 space-y-12 text-center bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent">
      <motion.div 
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-28 h-28 bg-primary rounded-[2.5rem] flex items-center justify-center text-white shadow-[0_20px_50px_rgba(114,92,0,0.3)] relative"
      >
        <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] animate-ping" />
        <BookOpen className="w-14 h-14 relative z-10" />
      </motion.div>
      <div className="space-y-4">
        <h1 className="text-6xl font-black text-on-surface tracking-tighter">أذكار</h1>
        <p className="text-on-surface-variant opacity-70 px-8 leading-relaxed font-medium text-lg">بوابتك الرقمية للطمأنينة والارتقاء الروحي في كل زمان ومكان.</p>
      </div>
      <button onClick={signIn} className="group px-10 py-5 bg-primary text-white rounded-full font-black text-xl shadow-xl active:scale-95 transition-all flex items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform" />
        <LogIn className="w-6 h-6 relative z-10" /> 
        <span className="relative z-10">ابدأ رحلة الإيمان</span>
      </button>
    </div>
  );
}

function GreetingSection({ title = "ذكر" }: { title?: string }) {
  return (
    <section className="px-6 py-4 flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-[10px] font-black px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">{title}</span>
        <h2 className="text-5xl font-black text-on-surface">السلام عليكم</h2>
      </div>
      <motion.div whileHover={{ rotate: 15 }} className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center text-primary shadow-sm"><Sparkles /></motion.div>
    </section>
  );
}

function MainCard({ item, onAction, isLast }: { item: AzkarItem, onAction: () => void, isLast: boolean }) {
  if (!item) return null;
  return (
    <section className="px-5 py-2">
      <motion.div 
        layoutId="active-item"
        className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-t-8 border-primary relative p-8 space-y-10 min-h-[320px] flex flex-col justify-between"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center text-[10px] font-black opacity-40">
            <div className="flex items-center gap-1"><Clock className="w-3 h-3"/> ذكر الآن</div>
            <div className="bg-surface-variant px-2 py-1 rounded-lg text-primary">{item.count} / {item.max}</div>
          </div>
          <AnimatePresence mode="wait">
            <motion.h3 
              key={item.id} 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="text-3xl font-bold text-center leading-relaxed text-on-surface"
            >
              {item.text}
            </motion.h3>
          </AnimatePresence>
        </div>
        <button onClick={onAction} disabled={isLast} className={`w-full py-6 rounded-[1.8rem] font-black text-2xl flex items-center justify-center gap-4 transition-all duration-300 ${isLast ? 'bg-tertiary-container text-tertiary shadow-inner' : 'bg-primary text-white shadow-lg active:scale-95'}`}>
          {isLast ? <CheckCircle2 className="w-8 h-8"/> : <Fingerprint className="w-8 h-8"/>}
          {isLast ? "أتممت الورد" : `كرر ${item.max - item.count} مرات`}
        </button>
      </motion.div>
    </section>
  );
}

function LibraryItem({ title, sub, icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full p-5 bg-white rounded-3xl border border-surface-variant/50 flex gap-5 items-center hover:shadow-lg transition-all active:scale-98 group">
      <div className={`p-4 rounded-2xl ${color} shadow-inner group-hover:rotate-6 transition-transform`}>{icon}</div>
      <div className="text-right">
        <p className="font-bold text-lg leading-none group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs opacity-50 mt-1">{sub}</p>
      </div>
      <ChevronLeft className="mr-auto w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
    </button>
  );
}

function SurahListItem({ surah, onClick }: { surah: Surah, onClick: () => void, key?: number | string }) {
  return (
    <div onClick={onClick} className="p-5 bg-white rounded-2xl border border-surface-variant/50 flex items-center justify-between hover:bg-primary/5 transition-all cursor-pointer group active:scale-[0.98]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface-variant rounded-xl flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-white transition-colors">{surah.number}</div>
        <div className="text-right">
          <p className="font-bold text-on-surface">{surah.name}</p>
          <p className="text-[10px] opacity-40 font-medium">{surah.numberOfAyahs} آية • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</p>
        </div>
      </div>
      <span className="text-[10px] font-bold text-on-surface-variant tracking-wider opacity-60 group-hover:opacity-100 uppercase">{surah.englishName}</span>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center flex-1 h-full py-2 transition-all relative ${active ? 'text-primary' : 'text-on-surface-variant opacity-40'}`}>
      <div className={`p-2.5 rounded-2xl transition-all ${active ? 'bg-primary-container scale-110 shadow-sm' : 'hover:bg-surface-variant'}`}>{icon}</div>
      <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="nav-glow" className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_gold]" />}
    </button>
  );
}

function RecommendedSection({ onSelect }: any) {
  return (
    <section className="px-6 py-6" onClick={onSelect}>
      <h4 className="text-lg font-black mb-4">اكتشف الآن</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-primary-container p-5 rounded-[2rem] h-40 flex flex-col justify-end shadow-sm cursor-pointer hover:scale-[1.03] transition-all relative overflow-hidden group">
          <div className="absolute top-4 left-4 bg-white/40 p-2 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"><Zap className="w-4 h-4 text-primary"/></div>
          <p className="text-lg font-black text-on-primary-container leading-none">أذكار الصباح كاملة</p>
          <p className="text-[10px] mt-1 opacity-70">ابدأ يومك بنور</p>
        </div>
        <div className="grid gap-4">
          <div className="bg-tertiary-container p-4 rounded-3xl h-[4.5rem] flex items-center gap-3 cursor-pointer hover:bg-tertiary-container/80 transition-colors shadow-sm">
            <BookOpen className="w-5 h-5 text-tertiary"/> <span className="text-xs font-black">سورة الملك</span>
          </div>
          <div className="bg-surface-variant p-4 rounded-3xl h-[4.5rem] flex items-center gap-3 cursor-pointer hover:bg-surface-variant/80 transition-colors shadow-sm">
            <Fingerprint className="w-5 h-5 text-primary"/> <span className="text-xs font-black">المسبحة</span>
          </div>
        </div>
      </div>
    </section>
  );
}
