import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Video, 
  AlignLeft, 
  Tag, 
  Copy, 
  Check, 
  Trash2, 
  Clock, 
  RefreshCw, 
  HelpCircle, 
  History, 
  ExternalLink,
  ChevronRight,
  Plus,
  BookOpen,
  ShoppingBag,
  ListFilter,
  CheckCircle,
  AlertCircle,
  Coins,
  User,
  Wallet,
  DollarSign,
  Send,
  Lock,
  Unlock,
  Image,
  Shield
} from 'lucide-react';
import { AffiliateContent, GenerationHistoryItem, TopUpTransaction, CreditPackage } from './types';
import { SAMPLE_PRODUCTS, TONES, CATEGORIES, CTA_STYLES } from './components/SampleData';
import { VeoPlayer } from './components/VeoPlayer';

// Firebase core & firestore client integration
import { 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export default function App() {
  // Input form states
  const [productInput, setProductInput] = useState<string>('');
  const [productUrl, setProductUrl] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<string>(TONES[0].name);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [selectedCta, setSelectedCta] = useState<string>(CTA_STYLES[0].text);
  const [customKeyPoints, setCustomKeyPoints] = useState<string>('');

  // Generated results states
  const [activeContent, setActiveContent] = useState<AffiliateContent | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'titles' | 'description' | 'hashtags'>('script');
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [affiliateLinkInput, setAffiliateLinkInput] = useState<string>('');
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // History state with local storage fallback loading
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('affiliate_generator_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historySidebarOpen, setHistorySidebarOpen] = useState<boolean>(false);

  // Loading and Error states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time Indonesian e-commerce trend states
  const [trendingLoading, setTrendingLoading] = useState<boolean>(true);
  const [trendingData, setTrendingData] = useState<{
    top5Viral: Array<typeof SAMPLE_PRODUCTS[0]>;
    predicted5Viral: Array<typeof SAMPLE_PRODUCTS[0]>;
  } | null>(null);
  const [trendingTab, setTrendingTab] = useState<'now' | 'upcoming'>('now');

  // --- SELL SYSTEM (CREDITS & ADMIN PANEL FOR EKO KOERNIAWAN) ---
  const [userCredits, setUserCredits] = useState<number>(() => {
    const saved = localStorage.getItem('insta_user_credits');
    return saved !== null ? parseInt(saved) : 10;
  });
  const [userTier, setUserTier] = useState<'free' | 'premium1' | 'premium2' | 'premium3'>(() => {
    const saved = localStorage.getItem('insta_user_tier');
    return (saved as any) || 'free';
  });
  const [showTopUpPanel, setShowTopUpPanel] = useState<boolean>(false);
  const [showAdminPortal, setShowAdminPortal] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('insta_admin_authenticated') === 'true';
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);
  const [loadingFirebase, setLoadingFirebase] = useState<boolean>(true);
  const [authErrorAlert, setAuthErrorAlert] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const creditPackages: CreditPackage[] = [
    { id: 'pkg-1', name: 'Paket Pemula Affiliate', credits: 20, price: 10000, description: 'Cocok untuk mencoba naskah & konten baru' },
    { id: 'pkg-2', name: 'Paket Viral Konten (Sangat Laku)', credits: 55, price: 25000, description: 'Sangat laku! Cukup untuk render video Veo 5~10x tambahan' },
    { id: 'pkg-3', name: 'Paket Sultan Agency', credits: 150, price: 50000, description: 'Bonus Hemat 30%! Pilihan terbaik bagi agensi affiliate aktif' }
  ];

  const [topUpSenderName, setTopUpSenderName] = useState<string>(() => localStorage.getItem('insta_sender_name') || '');
  const [topUpWhatsApp, setTopUpWhatsApp] = useState<string>(() => localStorage.getItem('insta_whatsapp') || '');
  const [selectedPkgId, setSelectedPkgId] = useState<string>('pkg-2');
  const [topUpSuccessNotice, setTopUpSuccessNotice] = useState<boolean>(false);
  const [activeTxCode, setActiveTxCode] = useState<string>('');
  const [transactions, setTransactions] = useState<TopUpTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('insta_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "TX-48192",
        packageName: "Paket Viral Konten (Sangat Laku)",
        price: 25000,
        credits: 55,
        senderName: "Bagus Setiawan",
        whatsappNumber: "081299887766",
        status: "pending",
        timestamp: "10 menit yang lalu"
      },
      {
        id: "TX-12903",
        packageName: "Paket Sultan Agency",
        price: 50000,
        credits: 150,
        senderName: "Rina Wijaya",
        whatsappNumber: "089855554433",
        status: "approved",
        timestamp: "Kemarin"
      }
    ];
  });

  // Real-time synchronization of Firebase Authentication and cloud databases
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoadingFirebase(true);
        const alreadyFailed = localStorage.getItem('firebase_auth_anonymous_failed') === 'true';
        if (alreadyFailed) {
          setAuthErrorAlert("Firebase: Error (auth/admin-restricted-operation)");
          setLoadingFirebase(false);
          setCurrentUser(null);
          return;
        }

        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          if (err && (err.code === 'auth/admin-restricted-operation' || String(err).includes('admin-restricted-operation'))) {
            localStorage.setItem('firebase_auth_anonymous_failed', 'true');
          }
          console.warn("Layanan login anonim terbatas. Menggunakan penyimpanan browser lokal (localStorage) secara otomatis.");
          setAuthErrorAlert(err && err.message ? err.message : String(err));
          setLoadingFirebase(false);
        }
        setCurrentUser(null);
        return;
      }

      setCurrentUser(user);
      setAuthErrorAlert(null);
      setLoadingFirebase(false);

      const uid = user.uid;

      // Listener 1: Sync User Credits Real-time
      const userRef = doc(db, 'users', uid);
      const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
        if (!docSnap.exists()) {
          // Initialize empty budget balance inside firestore
          try {
            await setDoc(userRef, {
              uid: uid,
              credits: 10,
              tier: 'free',
              role: 'user',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setUserCredits(10);
            setUserTier('free');
            localStorage.setItem('insta_user_credits', '10');
            localStorage.setItem('insta_user_tier', 'free');
          } catch (e) {
            console.error("Gagal mengklasifikasi entitas user di Firestore:", e);
          }
        } else {
          const uData = docSnap.data();
          if (uData) {
            if (typeof uData.credits === 'number') {
              setUserCredits(uData.credits);
              localStorage.setItem('insta_user_credits', uData.credits.toString());
            }
            if (uData.tier) {
              setUserTier(uData.tier);
              localStorage.setItem('insta_user_tier', uData.tier);
            }
          }
        }
      });

      // Listener 2: Sync Script Generations History Real-time
      const qGens = query(
        collection(db, "generations"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(15)
      );
      const unsubscribeGens = onSnapshot(qGens, (querySnap) => {
        const list: GenerationHistoryItem[] = [];
        querySnap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: d.id,
            timestamp: d.createdAt ? new Date(d.createdAt.toMillis()).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : "Baru saja",
            productInput: d.productInput,
            productUrl: d.productUrl,
            tone: d.tone,
            category: d.category,
            ctaStyle: d.ctaStyle,
            content: d.content
          });
        });
        setGenerationHistory(list);
        localStorage.setItem('affiliate_generator_history', JSON.stringify(list));
        if (list.length > 0 && !activeContent) {
          setActiveContent(list[0].content);
        }
      }, (error) => {
        console.error("Gagal melakukan rincian snapshot generasi:", error);
      });

      // Listener 3: Sync Transactions Real-time
      // Admin sees everything; normal users only retrieve their own tickets
      const qTx = isAdminAuthenticated 
        ? query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(40))
        : query(collection(db, "transactions"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(15));
      
      const unsubscribeTx = onSnapshot(qTx, (querySnap) => {
        const list: TopUpTransaction[] = [];
        querySnap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: d.id,
            packageName: d.packageName,
            price: d.price,
            credits: d.credits,
            senderName: d.senderName,
            whatsappNumber: d.whatsappNumber,
            status: d.status,
            timestamp: d.createdAt ? new Date(d.createdAt.toMillis()).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : "Hari ini"
          });
        });
        setTransactions(list);
        localStorage.setItem('insta_transactions', JSON.stringify(list));
      }, (error) => {
        console.error("Gagal melakukan rincian snapshot transaksi:", error);
      });

      return () => {
        unsubscribeUser();
        unsubscribeGens();
        unsubscribeTx();
      };
    });

    return () => {
      unsubscribeAuth();
    };
  }, [isAdminAuthenticated]);

  // Load real-time trending products from `/api/trending`
  const loadTrendingData = async () => {
    try {
      setTrendingLoading(true);
      const res = await fetch("/api/trending");
      if (res.ok) {
        const data = await res.json();
        setTrendingData(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data produk viral:", err);
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    loadTrendingData();
  }, []);

  // Google Authentication actions
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setLoadingFirebase(true);
    try {
      await signInWithPopup(auth, provider);
      setAuthErrorAlert(null);
    } catch (err: any) {
      console.error("Gagal melakukan login dengan Google:", err);
      alert("Gagal masuk dengan Google: " + (err && err.message ? err.message : String(err)));
    } finally {
      setLoadingFirebase(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Clean up States
      setUserCredits(10);
      setGenerationHistory([]);
      setTransactions([]);
      localStorage.removeItem('insta_user_credits');
      localStorage.removeItem('affiliate_generator_history');
      localStorage.removeItem('insta_transactions');
    } catch (err) {
      console.error("Gagal keluar:", err);
    }
  };

  // Function to spend credits
  const spendCredits = (amount: number): boolean => {
    if (userCredits < amount) {
      return false;
    }
    const next = userCredits - amount;
    setUserCredits(next);
    localStorage.setItem('insta_user_credits', next.toString());

    // Update real-time balance in Firestore in the background
    if (auth.currentUser) {
      const uRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(uRef, {
        credits: next,
        updatedAt: serverTimestamp()
      }).catch(err => {
        console.error("Gagal menyinkronkan saldo koin ke Firestore:", err);
      });
    }
    return true;
  };

  // Function to request a top-up
  const handleRequestTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpSenderName.trim() || !topUpWhatsApp.trim()) {
      alert("Harap lengkapi nama pengirim GoPay dan nomor WhatsApp Anda!");
      return;
    }

    localStorage.setItem('insta_sender_name', topUpSenderName);
    localStorage.setItem('insta_whatsapp', topUpWhatsApp);

    const pkg = creditPackages.find(p => p.id === selectedPkgId) || creditPackages[1];
    const txId = "TX-" + Math.floor(10000 + Math.random() * 90000);

    const newTx: TopUpTransaction = {
      id: txId,
      packageName: pkg.name,
      price: pkg.price,
      credits: pkg.credits,
      senderName: topUpSenderName,
      whatsappNumber: topUpWhatsApp,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ', hari ini'
    };

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "transactions", txId), {
          id: txId,
          userId: auth.currentUser.uid,
          packageName: pkg.name,
          price: pkg.price,
          credits: pkg.credits,
          senderName: topUpSenderName,
          whatsappNumber: topUpWhatsApp,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setActiveTxCode(txId);
        setTopUpSuccessNotice(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
      }
    } else {
      const nextTx = [newTx, ...transactions];
      setTransactions(nextTx);
      localStorage.setItem('insta_transactions', JSON.stringify(nextTx));

      // Auto upgrade tier & credits in offline simulator
      let nextTier: 'free' | 'premium1' | 'premium2' | 'premium3' = 'free';
      if (pkg.id === 'pkg-1') nextTier = 'premium1';
      else if (pkg.id === 'pkg-2') nextTier = 'premium2';
      else if (pkg.id === 'pkg-3') nextTier = 'premium3';
      
      setUserTier(nextTier);
      localStorage.setItem('insta_user_tier', nextTier);

      const additionalCredits = pkg.credits;
      const currentSimulatedCredits = parseInt(localStorage.getItem('insta_user_credits') || '10');
      const nextSimulatedCredits = currentSimulatedCredits + additionalCredits;
      setUserCredits(nextSimulatedCredits);
      localStorage.setItem('insta_user_credits', nextSimulatedCredits.toString());

      setActiveTxCode(txId);
      setTopUpSuccessNotice(true);
    }
  };

  // Function to approve transaction directly from Eko's Admin Panel
  const handleApproveTransaction = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    try {
      // 1. Mark transaction approved in Firestore
      const txRef = doc(db, "transactions", txId);
      await updateDoc(txRef, {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      // 2. Fetch transaction document details to find target user
      const txSnap = await getDoc(txRef);
      if (txSnap.exists()) {
        const txData = txSnap.data();
        const targetUserId = txData.userId;
        const creditsToAllocate = txData.credits;
        const packageName = txData.packageName || '';

        let targetTier: 'free' | 'premium1' | 'premium2' | 'premium3' = 'free';
        if (packageName.includes("Pemula") || packageName.includes("pkg-1")) {
          targetTier = 'premium1';
        } else if (packageName.includes("Viral") || packageName.includes("pkg-2")) {
          targetTier = 'premium2';
        } else if (packageName.includes("Sultan") || packageName.includes("pkg-3")) {
          targetTier = 'premium3';
        }

        // Add credits & update tier of target user in Firestore
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentCreditsOnDb = userSnap.data().credits || 0;
          await updateDoc(userRef, {
            credits: currentCreditsOnDb + creditsToAllocate,
            tier: targetTier,
            updatedAt: serverTimestamp()
          });
        }
      }

      alert(`✅ Pembayaran Berhasil Dikonfirmasi!\n\nKredit sebanyak +${tx.credits} koin telah BERHASIL MASUK ke akun pengguna langsung secara real-time.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  // Function to reject/fail a transaction if mock/unpaid
  const handleRejectTransaction = async (txId: string) => {
    try {
      const txRef = doc(db, "transactions", txId);
      await updateDoc(txRef, {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  // Admin security handlers
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === '290916') {
      if (!auth.currentUser) {
        setAdminPasswordError('Menghubungkan ke layanan autentikasi, silakan coba lagi...');
        return;
      }
      try {
        setAdminPasswordError(null);
        // Securely register auth ID into the database layer
        await setDoc(doc(db, "admins", auth.currentUser.uid), {
          password: adminPasswordInput,
          createdAt: serverTimestamp()
        });
        setIsAdminAuthenticated(true);
        setAdminPasswordError(null);
        setAdminPasswordInput('');
        localStorage.setItem('insta_admin_authenticated', 'true');
      } catch (err) {
        console.error(err);
        setAdminPasswordError('Gagal mendaftarkan status admin di Firestore. Pembatasan keamanan.');
      }
    } else {
      setAdminPasswordError('Sandi salah! Silakan coba lagi.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminPasswordError(null);
    setAdminPasswordInput('');
    localStorage.removeItem('insta_admin_authenticated');
  };

  // Save history helper
  const saveGenerationToHistory = (newContent: AffiliateContent) => {
    const genId = Math.random().toString(36).substring(2, 9);
    const newItem: GenerationHistoryItem = {
      id: genId,
      timestamp: "Baru saja",
      productInput: productInput || newContent.productDetails.extractedName || "Produk Affiliate Tanpa Nama",
      productUrl: productUrl,
      tone: selectedTone,
      category: selectedCategory,
      ctaStyle: selectedCta,
      content: newContent
    };

    if (auth.currentUser) {
      setDoc(doc(db, "generations", genId), {
        id: genId,
        userId: auth.currentUser.uid,
        productInput: newItem.productInput,
        productUrl: newItem.productUrl || "",
        tone: newItem.tone,
        category: newItem.category,
        ctaStyle: newItem.ctaStyle,
        content: JSON.parse(JSON.stringify(newItem.content)),
        createdAt: serverTimestamp()
      }).catch(err => {
        console.error("Gagal menyimpan naskah ke Firestore:", err);
      });
    }
  };


  // Pre-fill form from preset
  const handleSelectPreset = (preset: typeof SAMPLE_PRODUCTS[0]) => {
    setProductInput(preset.name);
    setProductUrl(preset.url);
    setSelectedCategory(preset.category);
    setSelectedTone(preset.tone);
    
    // Find matching CTA or customize
    const matchingCta = CTA_STYLES.find(c => c.name.toLowerCase().includes("bio"))?.text || preset.ctaStyle;
    setSelectedCta(matchingCta);
    setCustomKeyPoints(preset.description);
  };

  // Clipboard copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Submit Generation Request
  const handleGenerateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productInput.trim()) {
      setErrorMessage("Silakan isi Nama atau URL Produk affiliate terlebih dahulu.");
      return;
    }

    // Check credits constraint
    if (userCredits < 1) {
      setErrorMessage("Kredit Anda habis! Setiap generasi naskah lengkap membutuhkan 1 koin kredit. Silakan lakukan isi ulang kredit via GoPay terlebih dahulu.");
      setShowTopUpPanel(true);
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Menganalisis masukan produk...");

    // Smooth step display animation
    const steps = [
      "Menganalisis masukan & segmentasi audiens...",
      "Mengekstrak nilai jual utama (USP) produk...",
      "Merancang hook naskah 5-detik pertama...",
      "Membuat visual cues instan & audio TikTok/Reels trending...",
      "Merumuskan variasi judul SEO CTR tinggi...",
      "Membuat hashtag affiliate viral...",
      "Memformulasikan prompt video optimal untuk Veo AI...",
      "Menyusun respons akhir..."
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setGenerationStep(steps[stepIdx]);
      }
    }, 2500);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productInput: `${productInput} ${customKeyPoints ? `(Detail tambahan: ${customKeyPoints})` : ''}`,
          tone: selectedTone,
          category: selectedCategory,
          ctaStyle: selectedCta
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memperoleh respons dari server.");
      }

      // Deduct credit
      spendCredits(1);

      clearInterval(interval);
      setActiveContent(data);
      setActiveSceneIndex(0);
      setActiveTab('script');
      saveGenerationToHistory(data);
      setIsGenerating(false);

    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setErrorMessage(err.message || "Trafik server sedang padat atau kredensial API belum diatur lengkap di Secrets.");
      setIsGenerating(false);
    }
  };

  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "generations", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `generations/${id}`);
    }
  };

  // Get replaced affiliate description text
  const getSubstitutedDescription = (text: string) => {
    if (!text) return "";
    const activeLink = affiliateLinkInput.trim() || "[LINK_AFFILIATE_ANDA]";
    return text.replace(/\[LINK_AFFILIATE\]/g, activeLink);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {loadingFirebase && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(109,40,217,0.4)]">
              <Sparkles className="text-white fill-white/15" size={24} />
            </div>
            <p className="text-sm text-slate-300 font-mono tracking-wide animate-pulse">Menghubungkan ke Real-time Database...</p>
          </div>
        </div>
      )}
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <Sparkles className="text-white fill-white/15 animate-pulse" size={20} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold font-display tracking-tight text-white leading-tight">
                InstaViral <span className="text-indigo-400 font-medium">Affiliate</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">Video Content Suite v2.1 • Powered by Gemini & Veo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Credits Balance Display */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900 text-xs text-indigo-300 font-mono font-bold">
              <Coins size={14} className="text-yellow-400 fill-yellow-400/20" />
              <span>{userCredits} Kredit</span>
            </div>

            {/* Google Authentication Status or Action Buttons */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <span className="text-[11px] text-slate-400 truncate max-w-[100px] hidden md:inline font-mono font-semibold" title={currentUser.email}>
                  {currentUser.email || "User Anonim"}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-rose-450 hover:text-rose-455 transition text-[10px] font-bold cursor-pointer underline underline-offset-2 ml-1"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-550 hover:to-indigo-550 text-xs text-white flex items-center gap-1.5 border border-indigo-550 transition-all cursor-pointer font-bold shadow-md shadow-indigo-650/15"
              >
                <User size={12} className="text-white" />
                <span>Masuk Google</span>
              </button>
            )}

            {/* User Purchase Trigger */}
            <button
              onClick={() => {
                setShowTopUpPanel(!showTopUpPanel);
                setShowAdminPortal(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                showTopUpPanel
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                  : 'bg-slate-900 hover:bg-slate-850 text-emerald-400 border-slate-800'
              }`}
            >
              <Wallet size={12} />
              <span>Beli Kredit</span>
            </button>

            {/* Eko Koerniawan Admin Dashboard Trigger */}
            <button
              onClick={() => {
                setShowAdminPortal(!showAdminPortal);
                setShowTopUpPanel(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                showAdminPortal 
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20 font-bold animate-pulse' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title="Panel Admin Eko Koerniawan"
            >
              <User size={12} className={showAdminPortal ? "text-white" : "text-violet-400"} />
              <span className="hidden sm:inline">👥 Portal Admin ({transactions.filter(t => t.status === 'pending').length})</span>
              <span className="sm:hidden">👥 ({transactions.filter(t => t.status === 'pending').length})</span>
            </button>

            <button
              onClick={() => setHistorySidebarOpen(!historySidebarOpen)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-xs text-slate-300 flex items-center gap-1.5 border border-slate-800 focus:outline-none transition-all cursor-pointer font-medium"
            >
              <History size={13} className="text-indigo-400" />
              <span className="hidden md:inline">Riwayat ({generationHistory.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 flex flex-col relative">

        {/* Account Tier & Live Simulator Bar */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md text-left flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
              userTier === 'free' 
                ? 'bg-slate-950 text-slate-400 border-slate-800'
                : userTier === 'premium1'
                ? 'bg-violet-950/40 text-violet-400 border-violet-805/40'
                : userTier === 'premium2'
                ? 'bg-amber-950/40 text-amber-400 border-amber-805/40 animate-pulse'
                : 'bg-emerald-950/40 text-emerald-400 border-emerald-805/40 animate-bounce'
            }`}>
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-slate-500">Status Keanggotaan Anda</span>
                <span className={`font-mono px-2 py-0.5 rounded-full uppercase font-bold text-[10px] tracking-wider border ${
                  userTier === 'free'
                    ? 'bg-slate-950 text-slate-400 border-slate-800'
                    : userTier === 'premium1'
                    ? 'bg-violet-600/20 text-violet-300 border-violet-650/30'
                    : userTier === 'premium2'
                    ? 'bg-amber-605/20 text-amber-300 border-amber-500/30 font-extrabold'
                    : 'bg-emerald-600/25 text-emerald-300 border-emerald-500/30 font-black'
                }`}>
                  {userTier === 'free' && '📁 Akun Free Tier'}
                  {userTier === 'premium1' && '💎 Akun Premium 1'}
                  {userTier === 'premium2' && '👑 Akun Premium 2'}
                  {userTier === 'premium3' && '🦄 Akun Premium 3 (Sultan)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                {userTier === 'free' && '🎁 Mode Gratis: Akses terbatas hanya ke naskah dialog naskah teks. Pratinjau visual kamera, audio sound sfx, and render video Veo AI terkunci.'}
                {userTier === 'premium1' && '🎉 Paket Pemula: Membuka Arah Kamera + Ilustrasi Gambar Statis (Visual Storyboard) + Sintesis Voice-Over dialek Indonesia. Render video Veo terkunci.'}
                {userTier === 'premium2' && '🔥 Paket Viral Konten: Bebas akses naskah teks, visual storyboard, audio sfx, voice-over player, plus akses penuh merender klip video realistis dengan Veo AI!'}
                {userTier === 'premium3' && '⭐ Paket Sultan Agency: Bebas akses naskah teks, visual storyboard, audio sfx, voice-over player, plus akses penuh merender klip video realistis dengan Veo AI!'}
              </p>
            </div>
          </div>
          
          {/* Interactive Toggle for Reviewers */}
          <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0 w-full lg:w-auto">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Uji Simulator Tier Akun:</span>
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 w-full lg:w-auto justify-between lg:justify-start">
              {(['free', 'premium1', 'premium2', 'premium3'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={async () => {
                    setUserTier(t);
                    localStorage.setItem('insta_user_tier', t);
                    // Also attempt to write to Firestore if logged in
                    if (currentUser) {
                      try {
                        const userRef = doc(db, 'users', currentUser.uid);
                        await updateDoc(userRef, {
                          tier: t,
                          updatedAt: serverTimestamp()
                        });
                      } catch (e) {
                        console.warn("Gagal sinkron tier simulasi ke Firestore.");
                      }
                    }
                  }}
                  className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition cursor-pointer flex-1 lg:flex-initial ${
                    userTier === t
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-650 text-white font-bold shadow-md shadow-indigo-650/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {t === 'free' ? 'Free' : t === 'premium1' ? 'Prem 1' : t === 'premium2' ? 'Prem 2' : 'Prem 3'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Firebase Authentication Failure Warning and Guide */}
        {authErrorAlert && !currentUser && (
          <div className="w-full bg-slate-900/60 border border-yellow-700/30 rounded-2xl p-5 shadow-lg text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-550 border border-yellow-550/20 shadow-inner">
                <AlertCircle size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-yellow-450">⚠️ Berjalan di Mode Offline (Penyimpanan Lokal)</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Layanan Autentikasi Anonim Firebase dibatasi di Console Firebase Anda (<code className="text-rose-450 font-mono text-[10px] bg-rose-950/40 px-1 py-0.5 rounded shadow-sm">auth/admin-restricted-operation</code>).
                  Aplikasi telah dialihkan secara otomatis ke <strong>Penyimpanan browser lokal (localStorage)</strong> agar 100% normal dan dapat langsung dicoba.
                </p>
                <div className="mt-3 text-[11px] text-slate-400 max-w-2xl leading-relaxed space-y-1">
                  <p>💡 <strong>Solusi cepat untuk Anda (Eko Koerniawan):</strong></p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Gunakan tombol <strong className="text-indigo-400">"Masuk Google"</strong> dengan email <span className="text-emerald-400 font-mono">ekokoerniawan83@gmail.com</span> untuk masuk secara aman dan membuka Portal Admin otomatis.</li>
                    <li>Atau aktifkan penyedia masuk <strong>"Anonymous"</strong> di Console Firebase pada menu <em>Authentication &gt; Sign-in method</em> agar pengguna umum dapat menyinkronkan data secara cloud.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-4 py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-xs text-white font-bold transition active:scale-95 cursor-pointer shadow-indigo-650/15 shadow-md flex items-center gap-2"
              >
                <User size={14} />
                <span>Masuk dengan Google</span>
              </button>
            </div>
          </div>
        )}

        {/* CONDITION 1: BUY CREDIT PANEL FOR USERS */}
        {showTopUpPanel && (
          <div className="w-full bg-slate-905 border border-emerald-800/40 rounded-2xl p-6 shadow-2xl relative text-left">
            <button 
              type="button"
              onClick={() => setShowTopUpPanel(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-sm cursor-pointer p-1"
            >
              ✕ Tutup
            </button>
            
            <div className="flex items-center gap-2.5 mb-4">
              <Coins className="text-yellow-450 animate-bounce" size={20} />
              <h2 className="text-base sm:text-lg font-extrabold font-display text-white">💰 Isi Ulang Kredit Konten Viral</h2>
            </div>
            
            <p className="text-xs text-slate-400 mb-6 max-w-3xl leading-relaxed">
              Dapatkan naskah pemasaran instan (1 Kredit/generasi) dan buat cuplikan video sinematik vertical dengan model video Veo AI (2 Kredit/scene). Akun Anda saat ini memiliki <strong className="text-indigo-400 font-mono">{userCredits} Kredit</strong>.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form & Package selection */}
              <div className="lg:col-span-8 space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                  Langkah 1: Pilih Paket Kredit Terbaik Anda
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {creditPackages.map((pkg) => (
                    <div 
                      key={pkg.id}
                      onClick={() => {
                        setSelectedPkgId(pkg.id);
                        setTopUpSuccessNotice(false);
                      }}
                      className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                        selectedPkgId === pkg.id 
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10' 
                          : 'bg-slate-950 border-slate-800/70 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        {pkg.credits === 55 && (
                          <span className="text-[8px] bg-red-650 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-2 animate-pulse">
                            Paling Laku 🔥
                          </span>
                        )}
                        {pkg.credits === 150 && (
                          <span className="text-[8px] bg-indigo-650 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-2">
                            Hemat 30% 💎
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-slate-200 mt-1">{pkg.name}</h3>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{pkg.description}</p>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-baseline justify-between">
                        <span className="text-xs text-indigo-400 font-bold font-mono">+{pkg.credits} Kredit</span>
                        <span className="text-xs text-slate-300 font-extrabold font-mono">Rp {pkg.price.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-2">
                    Langkah 2: Selesaikan Transfer GoPay
                  </span>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Wallet size={24} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Rekening Penerima GoPay</span>
                        <div className="text-sm font-extrabold text-white">088989727277</div>
                        <div className="text-xs text-indigo-400 font-semibold mt-0.5">a.n Eko Koerniawan</div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col gap-1 items-end w-full sm:w-auto">
                      <div className="text-xs text-slate-400">Total Pembayaran:</div>
                      <div className="text-lg font-black text-emerald-400 font-mono">
                        Rp {(creditPackages.find(p => p.id === selectedPkgId)?.price || 25000).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirming Details Forms */}
                <form onSubmit={handleRequestTopUp} className="space-y-4 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    Langkah 3: Masukkan Data Pengirim GoPay Anda
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1.5 block font-mono uppercase">Nama Atas Nama GoPay Pengirim</label>
                      <input 
                        type="text"
                        required
                        placeholder="Misal: Budi Santoso"
                        value={topUpSenderName}
                        onChange={(e) => {
                          setTopUpSenderName(e.target.value);
                          setTopUpSuccessNotice(false);
                        }}
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1.5 block font-mono uppercase">Nomor WhatsApp Pelanggan</label>
                      <input 
                        type="text"
                        required
                        placeholder="Misal: 0812XXXXXXXX"
                        value={topUpWhatsApp}
                        onChange={(e) => {
                          setTopUpWhatsApp(e.target.value);
                          setTopUpSuccessNotice(false);
                        }}
                        className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>Ajukan & Buat Tiket Konfirmasi Pembelian</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Checkout Info & Success redirection */}
              <div className="lg:col-span-4 bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-slate-200 text-xs font-bold font-mono uppercase tracking-widest pb-2 border-b border-slate-800 mb-3">
                    Ringkasan Transaksi Anda
                  </h3>
                  
                  {topUpSuccessNotice ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-300 space-y-1">
                        <div className="text-xs font-bold font-mono">✅ Tiket Pembelian Aktif</div>
                        <div className="text-[11px]">ID Transaksi Anda: <strong className="text-white font-mono">{activeTxCode}</strong></div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                        Mohon kirimkan konfirmasi WhatsApp ke admin Eko Koerniawan agar diverifikasi tepat waktu. Setelah diverifikasi, kredit Anda langsung ditambahkan.
                      </p>

                      <a 
                        href={`https://api.whatsapp.com/send?phone=6288989727277&text=${encodeURIComponent(
                          `Halo Kak Eko Koerniawan, saya ingin konfirmasi pembayaran top-up kredit InstaViral:\n\n` + 
                          `• ID Transaksi: *${activeTxCode}*\n` +
                          `• Paket: ${creditPackages.find(p => p.id === selectedPkgId)?.name} (+${creditPackages.find(p => p.id === selectedPkgId)?.credits} Kredit)\n` +
                          `• Total Bayar: Rp ${(creditPackages.find(p => p.id === selectedPkgId)?.price || 0).toLocaleString('id-ID')}\n` +
                          `• Pengirim GoPay: *${topUpSenderName}*\n` +
                          `• No. WA terdaftar: ${topUpWhatsApp}\n\n` +
                          `Saya telah mentransfer dana ke nomor GoPay 088989727277 atas nama Eko koerniawan. Mohon segera dikonfirmasi dan masukkan kreditnya ya Kak Eko!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                      >
                        <svg className="w-4 h-4 fill-white animate-pulse" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.261 2.264 3.504 5.277 3.504 8.479 0 6.66-5.337 11.999-11.948 11.999-1.999-.001-3.963-.5-5.718-1.5l-6.266 1.639zm6.101-3.51c1.559.925 3.313 1.414 5.25.1 0 0 .001 0 .001 0 5.48 0 9.932-4.453 9.932-9.929S16.89 2.502 12.008 2.502c-4.881 0-8.854 3.974-8.854 8.855.001 1.944.633 3.841 1.83 5.419l-.427 1.558.4-.403z"/>
                        </svg>
                        <span>📱 Kirim Bukti WhatsApp (088989727277)</span>
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11.5px] text-slate-400 leading-relaxed font-normal">
                        Pilih paket terlebih dahulu, selesaikan pembayaran ke nomor GoPay di samping, dan submit nama Anda.
                      </p>
                      
                      <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-left space-y-1 text-[11px] text-slate-400 leading-normal">
                        <strong className="text-slate-300 block mb-1">💡 Alur Pengisian Otomatis:</strong>
                        <div>1. Submit nama & WhatsApp pendaftaran</div>
                        <div>2. Kirim konfirmasi via tombol WhatsApp hijau</div>
                        <div>3. Buka <strong className="text-violet-400">Portal Admin</strong> di menu atas untuk menyetujui transaksi secara instan</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed text-left">
                  Kami mengintegrasikan GoPay: <strong className="text-slate-400">088989727277</strong> & WA: <strong className="text-slate-400">088989727277</strong> (keduanya a.n <strong className="text-slate-300">Eko Koerniawan</strong>).
                </div>
              </div>

            </div>
          </div>
        )}

        {/* CONDITION 2: ADMIN PANEL FOR EKO KOERNIAWAN */}
        {showAdminPortal && (
          <div className="w-full bg-slate-900 border border-violet-800/40 rounded-2xl p-6 shadow-2xl relative text-left">
            {!isAdminAuthenticated ? (
              /* SECURE PASSWORD VERIFICATION CARD FOR EKO KOERNIAWAN */
              <div className="max-w-md mx-auto py-8 text-center space-y-6">
                <button 
                  type="button"
                  onClick={() => setShowAdminPortal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-sm cursor-pointer p-1"
                >
                  ✕ Tutup
                </button>
                <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-605/15 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-md">
                  <User size={24} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold font-display text-white">🔑 Verifikasi Keamanan Admin</h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Portal ini bersifat terbatas khusus untuk pemilik aplikasi, <strong className="text-violet-300">Kak Eko Koerniawan</strong>. Masukkan sandi keamanan Anda.
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="relative">
                    <input 
                      type="password"
                      required
                      placeholder="Masukkan sandi admin..."
                      value={adminPasswordInput}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setAdminPasswordError(null);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-center tracking-widest text-lg font-mono rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-violet-550 transition"
                      autoFocus
                    />
                  </div>

                  {adminPasswordError && (
                    <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg p-2 font-semibold text-center">
                      ❌ {adminPasswordError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 uppercase"
                  >
                    <span>Masuk Portal Admin</span>
                  </button>
                </form>

                <p className="text-[10px] text-slate-500">
                  Gunakan sandi keamanan pembeli kredit atau admin untuk dapat melakukan konfirmasi pesanan secara manual.
                </p>
              </div>
            ) : (
              /* THE FULLY FUNCTIONAL ADMIN PORTAL */
              <>
                <button 
                  type="button"
                  onClick={() => setShowAdminPortal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-sm cursor-pointer p-1"
                >
                  ✕ Tutup Dashboard
                </button>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 shadow-inner">
                      <User size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold font-display text-white">🔑 Portal Admin & Pengelolaan Penjualan Kredit</h2>
                      <p className="text-[11px] text-slate-400 font-medium">Atas Nama Pemilik: <strong className="text-violet-300">Eko Koerniawan</strong> • Integrasi GoPay WA 088989727277</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="px-2.5 py-1.5 rounded bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-900/50 text-[10px] font-bold font-mono transition cursor-pointer"
                      title="Logout Admin"
                    >
                      🔒 LOGOUT ADMIN
                    </button>
                    <div className="flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400">
                      <span>Active Status: </span>
                      <span className="text-emerald-400 font-extrabold font-mono flex items-center gap-1 ml-1 animate-pulse">
                        ● LIVE & ONLINE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-mono">Total Pendapatan</span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono block mt-1">
                      Rp {transactions
                        .filter(t => t.status === 'approved')
                        .reduce((sum, t) => sum + t.price, 0)
                        .toLocaleString('id-ID')}
                    </span>
                  </div>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-mono">Kredit Didistribusi</span>
                    <span className="text-base font-extrabold text-indigo-400 font-mono block mt-1">
                      {transactions
                        .filter(t => t.status === 'approved')
                        .reduce((sum, t) => sum + t.credits, 0)} Koin
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-mono">Menunggu Approval</span>
                    <span className="text-base font-extrabold text-amber-500 mt-1 flex items-center gap-1.5 font-sans">
                      ● {transactions.filter(t => t.status === 'pending').length} Tiket
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block font-mono">Global User Balance</span>
                    <span className="text-base font-extrabold text-violet-400 font-mono block mt-1">
                      {userCredits} Kredit
                    </span>
                  </div>
                </div>

                {/* Core Transactions List Table */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-900 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block font-mono">
                      Daftar Transaksi Masuk Penjualan Kredit
                    </span>
                  </div>

                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-mono text-[10px] uppercase">
                          <th className="p-3">ID Transaksi</th>
                          <th className="p-3">Pemesan & No WhatsApp</th>
                          <th className="p-3">Paket Pilihan / Harga</th>
                          <th className="p-3 text-center">Status Transaksi</th>
                          <th className="p-3 text-right">Tombol Konfirmasi Penjualan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {transactions.length > 0 ? (
                          transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-900/40 transition">
                              <td className="p-3 font-mono font-bold text-slate-300">
                                <div>{tx.id}</div>
                                <span className="text-[9px] text-slate-500 block font-normal">{tx.timestamp}</span>
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-white">{tx.senderName}</div>
                                <span className="font-mono text-[10px] text-slate-400 block">{tx.whatsappNumber}</span>
                              </td>
                              <td className="p-3 font-mono">
                                <div className="font-semibold text-slate-300 text-left">{tx.packageName}</div>
                                <div className="text-emerald-400 font-bold block text-left">Rp {tx.price.toLocaleString('id-ID')} • <span className="text-indigo-400 font-bold">+{tx.credits} Kr</span></div>
                              </td>
                              <td className="p-3 text-center">
                                {tx.status === 'pending' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider animate-pulse">
                                    Menunggu Bayar
                                  </span>
                                ) : tx.status === 'approved' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                                    Lunas / Kredit Masuk
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">
                                    Ditolak
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {tx.status === 'pending' ? (
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleRejectTransaction(tx.id)}
                                      className="px-2.5 py-1.5 bg-red-950/30 hover:bg-red-900 border border-red-900/40 hover:text-white rounded text-[11px] text-red-400 font-medium transition cursor-pointer"
                                    >
                                      Tolak
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveTransaction(tx.id)}
                                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-550 active:scale-[0.98] text-white rounded-xl text-xs font-black tracking-wide shadow-md shadow-emerald-500/20 select-none transition cursor-pointer flex items-center gap-1.5 border border-emerald-500 uppercase"
                                    >
                                      <span>✅ Konfirmasi & Masukkan Kredit langsung</span>
                                    </button>
                                  </div>
                                ) : tx.status === 'approved' ? (
                                  <div className="flex gap-1.5 items-center justify-end">
                                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-0.5 mr-2">
                                      ✓ Kredit Masuk
                                    </span>
                                    <a
                                      href={`https://api.whatsapp.com/send?phone=62${tx.whatsappNumber.replace(/^0/, '')}&text=${encodeURIComponent(
                                        `Halo Kak ${tx.senderName},\n\nPemetaan pembayaran GoPay Rp ${tx.price.toLocaleString('id-ID')} Anda sudah dikonfirmasi secara manual oleh Kak Eko Koerniawan!\n\nKredit sebanyak +${tx.credits} koin sudah langsung dimasukkan ke saldo akun InstaViral Anda. Silakan menyegarkan/refresh situs untuk melihat update balance Anda. Terima kasih!`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 hover:text-indigo-200 text-indigo-300 font-bold text-[10.5px] rounded border border-indigo-800 transition cursor-pointer flex items-center gap-1"
                                    >
                                      💬 WA Sukses
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 text-xs italic">
                              Belum ada aktivitas transaksi terekam saat ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-4 leading-normal">
                  Admin panel ini memberikan kontrol penuh bagi Pak Eko Koerniawan untuk menjual kredit ke khalayak ramai. Kredit instan bertambah di sisi pengguna saat tombol Konfirmasi ditekan, mensimulasikan full-stack backend yang lincah!
                </p>
              </>
            )}
          </div>
        )}

        {/* Workspace Dual Pane Split Row */}
        <div className="flex flex-col lg:flex-row gap-8 items-start relative">
          
          {/* Left Side: Creation Form Panel */}
        <section className="w-full lg:w-[380px] shrink-0 space-y-6">
          <div className="bg-slate-900 border border-slate-900/60 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={16} className="text-violet-400" />
              <h2 className="text-sm font-bold font-display uppercase tracking-widest text-white">Sumber Penjualan</h2>
            </div>

            {/* Quick Presets and Real-time Trending Section */}
            <div className="mb-5 border border-slate-800 bg-slate-950/40 p-3 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                  💡 Produk Tren Real-Time
                </span>
                <button
                  type="button"
                  onClick={loadTrendingData}
                  disabled={trendingLoading}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all cursor-pointer"
                  title="Perbarui tren dari google search"
                >
                  <RefreshCw size={10} className={trendingLoading ? "animate-spin text-indigo-400" : ""} />
                  <span>{trendingLoading ? "Loading" : "Segarkan"}</span>
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex border-b border-slate-800 mb-2 gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setTrendingTab('now')}
                  className={`text-[10px] sm:text-[11px] font-bold transition-all relative cursor-pointer ${trendingTab === 'now' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  🔥 Viral Sekarang
                  {trendingTab === 'now' && <span className="absolute bottom-[-5px] left-0 right-0 h-[1.5px] bg-indigo-500 rounded-full" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTrendingTab('upcoming')}
                  className={`text-[10px] sm:text-[11px] font-bold transition-all relative cursor-pointer ${trendingTab === 'upcoming' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  🔮 Prediksi Viral
                  {trendingTab === 'upcoming' && <span className="absolute bottom-[-5px] left-0 right-0 h-[1.5px] bg-indigo-500 rounded-full" />}
                </button>
              </div>

              {trendingLoading ? (
                <div className="py-6 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-4.5 h-4.5 border-2 border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-[9px] text-slate-500 font-mono">Menganalisis Tren Indonesia...</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {trendingTab === 'now' ? (
                    (trendingData?.top5Viral || SAMPLE_PRODUCTS).map((prod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPreset(prod)}
                        className="w-full text-left bg-slate-950 hover:bg-slate-900 border border-slate-900/60 hover:border-indigo-550/40 p-2 rounded-lg transition duration-150 flex flex-col gap-0.5 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="text-[10.5px] text-slate-100 font-bold group-hover:text-indigo-400 transition truncate max-w-[190px]" title={prod.name}>
                            {idx + 1}. {prod.name}
                          </span>
                          <span className="text-[8.5px] px-1 py-0.2 bg-indigo-550/10 border border-indigo-550/20 text-indigo-400 rounded font-medium shrink-0">
                            {prod.category ? prod.category.split(" ")[0] : "Produk"}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-405 truncate w-full" title={prod.description}>
                          {prod.description}
                        </p>
                      </button>
                    ))
                  ) : (
                    (trendingData?.predicted5Viral || []).length > 0 ? (
                      trendingData?.predicted5Viral.map((prod, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(prod)}
                          className="w-full text-left bg-slate-950 hover:bg-slate-900 border border-slate-900/60 hover:border-indigo-550/40 p-2 rounded-lg transition duration-150 flex flex-col gap-0.5 group cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[10.5px] text-slate-100 font-bold group-hover:text-indigo-400 transition truncate max-w-[190px]" title={prod.name}>
                              📈 {prod.name}
                            </span>
                            <span className="text-[8.5px] px-1 py-0.2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded font-medium shrink-0">
                              {prod.category ? prod.category.split(" ")[0] : "Masa Depan"}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-slate-405 truncate w-full" title={prod.description}>
                            {prod.description}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="py-4 text-center text-slate-500 text-[10px] italic">
                        Belum ada data ramalan tren terbaru.
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Core Form */}
            <form onSubmit={handleGenerateCampaign} className="space-y-4">
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">
                  Nama atau Link URL Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Retinol Glowing Serum atau link Shopee..."
                  value={productInput}
                  onChange={(e) => setProductInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl px-3.5 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">
                  Masukkan Link Pembelian (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://shopee.co.id/my-affiliate-link"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl px-3.5 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">
                  Gaya Nada Bicara (Tone)
                </label>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl px-3 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                >
                  {TONES.map(t => (
                    <option key={t.id} value={t.name}>{t.name} • {t.desc.split(" ")[0]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">
                  Kategori Niche Produk
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl px-3 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                >
                  {CATEGORIES.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono">
                  Model Ajakan Belu (CTA)
                </label>
                <select
                  value={selectedCta}
                  onChange={(e) => setSelectedCta(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl px-3 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                >
                  {CTA_STYLES.map(cta => (
                    <option key={cta.id} value={cta.text}>{cta.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block font-mono flex items-center justify-between">
                  <span>Detail Tambahan Produk (Manfaat dll)</span>
                  <span className="text-[9px] text-slate-500 capitalize italic font-normal">Optional</span>
                </label>
                <textarea
                  rows={2}
                  value={customKeyPoints}
                  onChange={(e) => setCustomKeyPoints(e.target.value)}
                  placeholder="Kelebihan, diskon, keunikan dll..."
                  className="w-full bg-slate-950 border border-slate-800/70 rounded-xl p-3 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-[0_4px_25px_rgba(99,102,241,0.25)] flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-indigo-500/10 active:scale-[0.98] transition disabled:opacity-45"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="animate-spin text-white" size={13} />
                    <span>Mempersiapkan Materi Konten...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-yellow-300 fill-yellow-300 animate-pulse" />
                    <span>Hasilkan Konten Viral ✨</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Quick FAQ info panel */}
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-900/80 text-left">
            <div className="flex items-center gap-1.5 mb-2">
              <HelpCircle size={13} className="text-cyan-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300 font-mono tracking-widest">Bagaimana Veo bekerja?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed leading-medium">
              Aplikasi menghasilkan petunjuk visual/prompt Veo khusus di setiap scene naskah. Anda bisa memicu rendering instan 9:16 untuk mevisualisasikan TikTok Reels Anda secara otomatis menggunakan engine AI video!
            </p>
          </div>
        </section>

        {/* Right Side: Generated Content Output & Workspace */}
        <main className="flex-1 w-full space-y-6">
          
          {/* Active Campaign Info Header */}
          {activeContent && !isGenerating && (
            <div className="bg-slate-900 p-4 border border-slate-900 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md text-left">
              <div>
                <span className="text-[9px] font-mono tracking-widest text-indigo-400 font-bold uppercase bg-indigo-950/40 border border-indigo-900/50 px-2 py-0.5 rounded">
                  Kampanye Aktif
                </span>
                <h2 className="text-white text-base font-extrabold font-display leading-tight tracking-tight mt-1">
                  💡 {activeContent.productDetails.extractedName}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-400 text-xs mt-1">
                  <span>Benefit Utama: <strong className="text-indigo-300">{activeContent.productDetails.mainBenefit}</strong></span>
                </div>
              </div>

              {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-[11px] text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition shrink-0"
                >
                  Lihat Toko Asli
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          {/* Prompt Loading steps / Spinner Card */}
          {isGenerating && (
            <div className="bg-slate-900 border border-slate-900 text-left rounded-2xl p-8 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500 animate-spin"></div>
                <Sparkles className="text-indigo-400 animate-bounce" size={24} />
              </div>
              
              <h3 className="text-white text-base font-semibold mt-6 tracking-wide text-center">Meracik Konten Affiliate Ter-Viral</h3>
              <p className="text-[11px] text-indigo-300 font-medium font-mono border-y border-slate-800/80 px-4 py-1.5 mt-2 animate-pulse rounded text-center">
                {generationStep}
              </p>
              
              <p className="text-[11px] text-slate-500 text-center max-w-sm mt-4 leading-relaxed">
                Gemini AI sedang menyusun rekayasa pemasaran terbaik: hook awal, visual storytelling, sfx tren TikTok, kata kunci SEO CTR tinggi, serta prompt model video Veo.
              </p>
            </div>
          )}

          {/* Generasi Error Message Card */}
          {errorMessage && (
            <div className="bg-red-950/20 border border-red-900/30 text-left rounded-2xl p-5 flex items-start gap-3 shadow-lg">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-red-300 text-xs font-bold font-mono tracking-wide uppercase">Generasi Gagal</h4>
                <p className="text-red-200/90 text-xs leading-relaxed max-w-xl">
                  {errorMessage}
                </p>
                <div className="text-[10px] text-red-300/60 pt-1">
                  Harap periksa sambungan internet Anda atau periksa apakah kunci rahasia API telah diatur diSecrets.
                </div>
              </div>
            </div>
          )}

          {/* Complete Workspace Dashboard */}
          {activeContent && !isGenerating && (
            <div className="space-y-6">
              
              {/* Tabs Navigation Header */}
              <div className="flex border-b border-slate-900 overflow-x-auto scroller-none gap-2 pb-px select-none">
                <button
                  onClick={() => setActiveTab('script')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-tight flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'script' 
                      ? 'border-indigo-500 text-indigo-400 font-bold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video size={13} />
                  🎬 Naskah Shorts & Veo AI
                </button>
                <button
                  onClick={() => setActiveTab('titles')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-tight flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'titles' 
                      ? 'border-indigo-500 text-indigo-400 font-bold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles size={13} />
                  🔥 5 Judul Viral (SEO CTR)
                </button>
                <button
                  onClick={() => setActiveTab('description')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-tight flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'description' 
                      ? 'border-indigo-500 text-indigo-400 font-bold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlignLeft size={13} />
                  📝 Deskripsi Affiliate
                </button>
                <button
                  onClick={() => setActiveTab('hashtags')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 tracking-tight flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'hashtags' 
                      ? 'border-indigo-500 text-indigo-400 font-bold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tag size={13} />
                  🏷️ Hashtags & Tags
                </button>
              </div>

              {/* Dynamic Content Workspace Panels */}
              
              {/* TAB 1: SCRIPT VISUALS & VEO */}
              {activeTab === 'script' && (
                <div className="space-y-6">
                  {/* Scene Selector Sub-Nav */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 rounded-xl border border-slate-900 text-left">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2.5 block font-mono shrink-0">Navigasi Scene:</span>
                    <div className="flex flex-wrap gap-1">
                      {activeContent.script.map((scene, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSceneIndex(idx)}
                          className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition duration-150 cursor-pointer ${
                            activeSceneIndex === idx
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-slate-950 hover:bg-slate-855 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          Scene {scene.scene} ({scene.duration})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Scene Player */}
                  {activeContent.script[activeSceneIndex] && (
                    <VeoPlayer 
                      scene={activeContent.script[activeSceneIndex]} 
                      productName={activeContent.productDetails.extractedName}
                      category={selectedCategory}
                      credits={userCredits}
                      spendCredits={spendCredits}
                      userTier={userTier}
                    />
                  )}

                  {/* Full Script Text Overview */}
                  <div className="bg-slate-900 border border-slate-900 p-5 rounded-2xl text-left">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-violet-400" />
                        <h3 className="text-white text-sm font-bold font-display uppercase tracking-wider">Tabel Alur Cerita Penuh (Storyline Summary)</h3>
                      </div>
                      
                      <button
                        onClick={() => {
                          const fullScriptText = activeContent.script.map(s => {
                            if (userTier === 'free') {
                              return `--- SCENE ${s.scene} (${s.duration}) ---\n[Visual]: [TERKUNCI - PREMIUM 1]\n[SFX/Audio]: [TERKUNCI - PREMIUM 1]\n[Dialog]: ${s.speech}`;
                            } else if (userTier === 'premium1') {
                              return `--- SCENE ${s.scene} (${s.duration}) ---\n[Visual]: ${s.visual}\n[SFX/Audio]: ${s.audio}\n[Dialog]: ${s.speech}\n[Veo Prompt]: [TERKUNCI - PREMIUM 2/3]`;
                            } else {
                              return `--- SCENE ${s.scene} (${s.duration}) ---\n[Visual]: ${s.visual}\n[SFX/Audio]: ${s.audio}\n[Dialog]: ${s.speech}\n[Veo Prompt]: ${s.veoPrompt}`;
                            }
                          }).join("\n\n");
                          copyToClipboard(fullScriptText, 'full-script');
                        }}
                        className="text-slate-400 hover:text-white transition text-xs flex items-center gap-1 focus:outline-none cursor-pointer"
                      >
                        {copiedStates['full-script'] ? (
                          <>
                            <CheckCircle size={13} className="text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Salin Semua Alur</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/60 font-sans">
                      {activeContent.script.map((scene, i) => (
                        <div key={i} className="py-3.5 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-1">
                            <span className="text-xs font-bold font-mono text-indigo-400 block">Scene {scene.scene} • {scene.duration}</span>
                            <span className="text-[10px] text-slate-500 italic block mt-1 font-mono">
                              Veo: {userTier === 'free' || userTier === 'premium1' ? '🔒 Terkunci' : `${scene.veoPrompt.substring(0, 20)}...`}
                            </span>
                          </div>
                          <div className="md:col-span-3 space-y-1.5 text-xs text-slate-300">
                            <div><strong className="text-slate-400 uppercase tracking-widest text-[9px] font-mono block">Aksi / Visual:</strong> {userTier === 'free' ? '🔒 Terkunci (Premium 1)' : scene.visual}</div>
                            <div><strong className="text-slate-400 uppercase tracking-widest text-[9px] font-mono block">Suara / SFX:</strong> {userTier === 'free' ? '🔒 Terkunci (Premium 1)' : scene.audio}</div>
                            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mt-1 text-white font-medium">
                              "{scene.speech}"
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIRAL TITLES (CTR SEO) */}
              {activeTab === 'titles' && (
                <div className="bg-slate-900 border border-slate-950 p-5 rounded-2xl text-left space-y-4">
                  <div>
                    <h3 className="text-white text-base font-bold font-display tracking-tight">5 Variasi Judul Viral Dengan CTR Potensial</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Judul di bawah dirancang berdasarkan tren metrik TikTok & SEO penelusuran kata kunci Indonesia agar video Anda tidak langsung terlewatkan.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 pt-2">
                    {activeContent.titles.map((title, idx) => (
                      <div 
                        key={idx}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-violet-800/30 transition-all group"
                      >
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-950/60 border border-violet-900/60 flex items-center justify-center text-[10px] font-mono font-bold text-violet-400">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase font-mono bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                              Estimated CTR Potential: {94 + idx - (idx * 2)}%
                            </span>
                          </div>
                          
                          <p className="text-white text-sm sm:text-base font-bold font-display leading-snug pt-0.5">
                            {title}
                          </p>
                        </div>

                        <button
                          onClick={() => copyToClipboard(title, `title-${idx}`)}
                          className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-lg flex items-center gap-1 md:self-center transition focus:outline-none cursor-pointer self-stretch justify-center"
                        >
                          {copiedStates[`title-${idx}`] ? (
                            <>
                              <CheckCircle size={12} className="text-emerald-400 animate-pulse" />
                              <span className="text-emerald-400 font-semibold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="text-slate-400 hover:text-white" />
                              <span>Salin Judul</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: AFFILIATE DESCRIPTION */}
              {activeTab === 'description' && (
                <div className="bg-slate-900 border border-slate-950 p-5 rounded-2xl text-left space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-white text-base font-bold font-display tracking-tight">Optimasi Deskripsi Video Affiliate</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Deskripsi ini menyertakan detail produk ringkas, kata kunci, call-to-action terstruktur, dan penempatan link affiliate.
                    </p>
                  </div>

                  {/* Utility panel: Live Input affiliate link substitution */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block font-mono">
                      🛠️ Widget Substitusi Otomatis Link Affiliate
                    </span>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Masukkan link affiliate riil Anda, misal: https://shope.ee/xyz99"
                        value={affiliateLinkInput}
                        onChange={(e) => setAffiliateLinkInput(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                      {affiliateLinkInput && (
                        <button
                          onClick={() => setAffiliateLinkInput('')}
                          className="px-3 py-1.5 text-xs text-slate-400 bg-slate-900 hover:text-white rounded border border-slate-800 focus:outline-none transition cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Mengetik di atas akan otomatis menggantikan setiap placeholder <strong className="text-violet-400 font-mono">[LINK_AFFILIATE]</strong> pada naskah deskripsi yang tersalin di bawah!
                    </p>
                  </div>

                  {/* Copy Text Area Display */}
                  <div className="relative">
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        onClick={() => copyToClipboard(getSubstitutedDescription(activeContent.description), 'full-desc')}
                        className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition focus:outline-none cursor-pointer"
                      >
                        {copiedStates['full-desc'] ? (
                          <>
                            <CheckCircle size={12} className="text-white" />
                            <span>Sukses Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Salin Semua Deskripsi</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-slate-950 font-sans border border-slate-800 rounded-xl p-5 pt-12 min-h-[180px] text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
                      {getSubstitutedDescription(activeContent.description)}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: HASHTAGS & TAGS */}
              {activeTab === 'hashtags' && (
                <div className="bg-slate-900 border border-slate-950 p-5 rounded-2xl text-left space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-white text-base font-bold font-display tracking-tight">Hashtags & Tags Penjualan</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Campuran tag populer dan niche tertarget yang dapat menyulut sistem rekomendasi platform video pendek.
                      </p>
                    </div>

                    <button
                      onClick={() => copyToClipboard(activeContent.hashtags.join(" "), 'all-hashtags')}
                      className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-xs text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition shrink-0"
                    >
                      {copiedStates['all-hashtags'] ? (
                        <>
                          <CheckCircle size={13} className="text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Hashtag Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-slate-400" />
                          <span>Salin Semua</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-2">
                    {activeContent.hashtags.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => copyToClipboard(tag, `tag-${idx}`)}
                        className="px-3.5 py-1.5 bg-slate-950 border border-slate-800/80 hover:border-violet-900/60 hover:bg-slate-900 rounded-xl text-xs text-slate-300 font-mono tracking-wide font-medium flex items-center gap-1.5 transition duration-150 cursor-pointer focus:outline-none"
                      >
                        <span className="text-violet-400">#</span>
                        <span>{tag.replace(/^#/, '')}</span>
                        {copiedStates[`tag-${idx}`] ? (
                          <Check size={11} className="text-emerald-400 ml-1 shrink-0" />
                        ) : (
                          <Copy size={9} className="text-slate-600 opacity-60 ml-1 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-500">
                    <InfoIcon size={12} className="text-cyan-400" />
                    <span>Klik tag individu di atas untuk menyalin tag tersebut saja ke clipboard Anda.</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Empty State visual */}
          {!activeContent && !isGenerating && (
            <div className="bg-slate-900 border border-slate-900 p-12 text-center rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-18 h-18 rounded-full bg-violet-600/10 border border-violet-500/15 flex items-center justify-center animate-bounce mb-4 text-violet-400 shadow-inner">
                <Video size={32} />
              </div>
              <h3 className="text-white text-lg font-bold font-display tracking-wide">Generator Konten Belum Dimulai</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-2.5 leading-relaxed leading-medium">
                Pilihlah salah satu templat preset di sebelah kiri atau ketikkan nama produk affiliate Anda untuk menghasilkan naskah sinematik, video prompt Veo, hashtag, dan deskripsi promo instan.
              </p>
              
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono block w-full mb-1">Fitur Utama Kami:</span>
                <span className="px-2.5 py-1 bg-slate-950 text-slate-400 text-[11px] rounded-lg border border-slate-800 font-medium">🎬 Naskah Shorts 30-60s</span>
                <span className="px-2.5 py-1 bg-slate-950 text-slate-400 text-[11px] rounded-lg border border-slate-800 font-medium">✨ Judul CTR Tinggi</span>
                <span className="px-2.5 py-1 bg-slate-950 text-slate-400 text-[11px] rounded-lg border border-slate-800 font-medium">📝 Deskripsi Affiliate</span>
                <span className="px-2.5 py-1 bg-slate-950 text-slate-400 text-[11px] rounded-lg border border-slate-800 font-medium">⚡ Prompt Veo Video AI</span>
              </div>
            </div>
          )}

        </main>
        </div> {/* Closes Workspace Dual Pane Split Row */}
      </div> {/* Closes Main Container Layout */}

      {/* Slide-out Sidebar for History */}
      {historySidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-[340px] bg-slate-900 h-full shadow-2xl flex flex-col p-5 border-l border-slate-800 text-left">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <History className="text-violet-400" size={16} />
                <h3 className="text-slate-100 font-bold font-display text-sm uppercase tracking-wider">Riwayat Generasi</h3>
              </div>
              <button
                onClick={() => setHistorySidebarOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-xs p-1 cursor-pointer focus:outline-none"
              >
                Tutup ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-4 divide-y divide-slate-800/80 scroller-none space-y-3">
              {generationHistory.length > 0 ? (
                generationHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveContent(item.content);
                      setProductInput(item.productInput);
                      setProductUrl(item.productUrl || '');
                      setSelectedTone(item.tone);
                      setSelectedCategory(item.category);
                      setSelectedCta(item.ctaStyle);
                      setActiveTab('script');
                      setActiveSceneIndex(0);
                      setHistorySidebarOpen(false);
                    }}
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-850 cursor-pointer transition text-left group border border-slate-950 hover:border-slate-800"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="text-slate-200 text-xs font-semibold leading-snug line-clamp-2 truncate flex-1 font-display">
                        🛍️ {item.productInput}
                      </h4>
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition opacity-0 group-hover:opacity-100 focus:outline-none cursor-pointer shrink-0"
                        title="Hapus"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-x-2 text-[10px] text-slate-500 mt-2 font-mono">
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {item.timestamp}
                      </span>
                    </div>

                    <div className="flex gap-1.5 flex-wrap mt-2">
                      <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-850 text-slate-400 rounded text-[9px] truncate max-w-[120px]">
                        Niche: {item.category}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-850 text-slate-400 rounded text-[9px] truncate max-w-[120px]">
                        Tone: {item.tone}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Belum ada riwayat terekam. Masukkan info produk di form untuk memulai kampanye pertama!
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 mt-auto">
              <p className="text-[10.5px] text-slate-500 leading-normal">
                Riwayat terekam otomatis di peramban (Local Storage) masing-masing agar mudah diakses kembali kapan pun tanpa server database tambahan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer credits and details */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 px-4 text-center mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-violet-400" />
            <span>© 2026 InstaViral Affiliate Generator. Hak Cipta Dilindungi.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 transition cursor-help">Syarat Layanan</span>
            <span className="hover:text-slate-400 transition cursor-help">Kebijakan Privasi</span>
            <span className="hover:text-slate-400 transition cursor-help">Dokumentasi Veo AI</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

// Light helper icons not standard in lucide or to replace
function InfoIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
