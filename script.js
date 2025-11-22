import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, runTransaction, onDisconnect, serverTimestamp, get, remove, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyAYjnWMB23CQ2OnofJuoMBJyoxBahvPj9Q", 
    authDomain: "sigitdb-eb445.firebaseapp.com", 
    databaseURL: "https://sigitdb-eb445-default-rtdb.firebaseio.com/", 
    projectId: "sigitdb-eb445", 
    storageBucket: "sigitdb-eb445.firebasestorage.app", 
    messagingSenderId: "939882511814", 
    appId: "1:939882511814:web:797708c2440f35062646c7" 
};

const app = initializeApp(firebaseConfig); 
const rtdb = getDatabase(app);



// --- KONFIGURASI CLOUDINARY (TAMBAHKAN INI) ---
const CLOUD_NAME = "deiksrxyg"; 
const UPLOAD_PRESET = "sigit_db_v1"; 
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;


// --- TAMBAHKAN INI AGAR TOMBOL HTML BISA BACA DATABASE ---
window.remove = remove;
window.ref = ref;
window.rtdb = rtdb;
window.update = update;
window.set = set;



let pressTimer;
// --- GLOBAL VARIABLES ---
let user = null;
let mediaRecorder; 
let audioChunks = [];
let curChatId = 'global'; 
let lastBroadcastId = localStorage.getItem('last_broadcast_id'); 
let curCollection = null; 
let curItem = null; 
let typingTimeout = null; 
let pendingImage = null; 
let replyingToMsg = null;
let chatListenerRef = null;

let pendingFileBlob = null;

let isAutoScroll = true; // Default: ON
let chatSearchQuery = ""; // Default: Kosong

let isSelectionMode = false; // Penanda mode seleksi aktif/tidak
let selectedMsgIds = new Set(); // Menyimpan ID pesan yang dipilih

// --- TEMA & SESSION ---
const savedTheme = localStorage.getItem('site_theme') || '#6366f1'; 
document.documentElement.style.setProperty('--theme-color', savedTheme);

// Cek Session User
try {
    const saved = localStorage.getItem('user');
    if (saved) {
        user = JSON.parse(saved);
        // Perbaikan data tamu jika rusak
        if (user.isGuest && (!user.username || user.username === 'undefined')) {
            user.username = "Tamu_" + Math.floor(Math.random() * 1000); 
            user.name = user.username;
            localStorage.setItem('user', JSON.stringify(user));
        }
    }
} catch (e) { 
    localStorage.removeItem('user'); 
    user = null; 
}

window.onload = () => { 
    if(typeof switchAuthTab === 'function') switchAuthTab('login');
    if(!user) {
        document.getElementById('login-modal').classList.remove('hidden'); 
        // PERBAIKAN: Paksa fokus ke input username
        setTimeout(() => {
            const loginInput = document.getElementById('login-user');
            if(loginInput) loginInput.focus();
        }, 300);
    } else {
        initApp(); 
    }
};

function showGameToast(msg, type) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        className: `gaming-toast ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`,
        stopOnFocus: true
    }).showToast();
}



function initApp() {
    document.getElementById('login-modal').classList.add('hidden');
    
    if(!user.isGuest) {
        const finalPic = user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}&background=random`;
        
        const navImg = document.getElementById('nav-avatar');
        if(navImg) navImg.src = finalPic;
        const profileImg = document.getElementById('p-avatar');
        if(profileImg) profileImg.src = finalPic;
        
        if(user.role === 'developer') {
            const btnGod = document.getElementById('btn-god-mode');
            if(btnGod) btnGod.classList.remove('hidden');
            
            loadDevInbox();
            updateAdminStats();
            renderFirewallList();

            setTimeout(() => {
                const dbg = document.getElementById('debug-floating-btn');
                if(dbg) dbg.classList.remove('hidden');
            }, 1000);
        }
        
        if(user.chat_bg) {
            const chatBg = document.getElementById('chat-bg');
            if(chatBg) chatBg.style.backgroundImage = `url('${user.chat_bg}')`;
        }
    }
    
    setupListeners();
    navigateTo('home');
    
    try { VanillaTilt.init(document.querySelectorAll(".glass-card")); } catch(e) {}
    try { if("Notification" in window && Notification.permission !== "granted") Notification.requestPermission(); } catch(e) {}
    
    setTimeout(() => checkDeepLink(), 1500);
    setupGodModeListeners();
    checkBanStatus();
    captureIp();
    checkSchedule();

    loadChatMessages('global');
    
    try { particlesJS("particles-js", {"particles":{"number":{"value":50,"density":{"enable":true,"value_area":800}},"color":{"value":"#ffffff"},"shape":{"type":"circle","stroke":{"width":0,"color":"#000000"},"polygon":{"nb_sides":5},"image":{"src":"img/github.svg","width":100,"height":100}},"opacity":{"value":0.3,"random":false,"anim":{"enable":false,"speed":1,"opacity_min":0.1,"sync":false}},"size":{"value":3,"random":true,"anim":{"enable":false,"speed":40,"size_min":0.1,"sync":false}},"line_linked":{"enable":true,"distance":150,"color":"#ffffff","opacity":0.2,"width":1},"move":{"enable":true,"speed":2,"direction":"none","random":false,"straight":false,"out_mode":"out","bounce":false,"attract":{"enable":false,"rotateX":600,"rotateY":1200}}},"interactivity":{"detect_on":"canvas","events":{"onhover":{"enable":true,"mode":"grab"},"onclick":{"enable":true,"mode":"push"},"resize":true},"modes":{"grab":{"distance":140,"line_linked":{"opacity":0.5}},"bubble":{"distance":400,"size":40,"duration":2,"opacity":8,"speed":3},"repulse":{"distance":200,"duration":0.4},"push":{"particles_nb":4},"remove":{"particles_nb":2}}},"retina_detect":true}); } catch(e) {}
}


// =========================================
// 🔐 SISTEM AUTENTIKASI BARU (LOGIN & REGISTER)
// =========================================

window.switchAuthTab = (tab) => {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.add('hidden');
    
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');

    let targetInputId;

    if(tab === 'login') {
        document.getElementById('form-login').classList.remove('hidden');
        const tabEl = document.getElementById('tab-login');
        if(tabEl) tabEl.classList.add('active');
        targetInputId = 'login-user';
    } else {
        document.getElementById('form-register').classList.remove('hidden');
        const tabEl = document.getElementById('tab-register');
        if(tabEl) tabEl.classList.add('active');
        targetInputId = 'reg-user';
    }
    
    // PERBAIKAN KEYBOARD: Fokus cepat ke input yang baru dibuka
    setTimeout(() => {
        const targetInput = document.getElementById(targetInputId);
        if(targetInput) targetInput.focus();
    }, 100);
}
// 2. Fungsi Login (Cek Password & Status)
window.doLogin = async () => { 
    const uInput = document.getElementById('login-user').value.trim(); 
    const pInput = document.getElementById('login-pass').value.trim(); 

    // Backdoor Developer (Wajib ada buat kamu masuk pertama kali)
    if(uInput === 'developer' && pInput === 'dev123') { 
        user = {
            name:'Developer', username:'Developer', role:'developer',
            isPremium:true, pic:'https://cdn-icons-png.flaticon.com/512/2304/2304226.png'
        }; 
        localStorage.setItem('user', JSON.stringify(user)); 
        captureIp(); location.reload(); return; 
    } 

    try { 
        const snap = await get(ref(rtdb, `users/${uInput}`)); 
        
        if(snap.exists()) { 
            const userData = snap.val();
            // Cek Password (field 'code' sekarang kita anggap password)
            if(String(userData.code) === String(pInput)) { 
                user = { ...userData, username: uInput, role: userData.role || 'member' }; 
                localStorage.setItem('user', JSON.stringify(user)); 
                captureIp(); location.reload(); 
            } else { 
                Swal.fire("Gagal", "Password Salah!", "error"); 
            }
        } else { 
            // Cek apakah masih di waiting list (Pending)
            const pendingSnap = await get(ref(rtdb, `pending_registrations/${uInput}`));
            if(pendingSnap.exists()) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sedang Ditinjau',
                    text: 'Akun Anda sudah dibuat tapi belum di-ACC oleh Developer. Silakan tunggu atau hubungi Admin.',
                    background: '#1e293b', color: '#fff'
                });
            } else {
                Swal.fire("Gagal", "Username tidak ditemukan. Silakan Daftar.", "error"); 
            }
        } 
    } catch(e) { 
        Swal.fire("Error", e.message, "error"); 
    } 
}



// --- FUNGSI UPLOAD KE CLOUDINARY (TAMBAHKAN INI) ---
const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Gagal upload ke Cloudinary');
        const data = await response.json();
        return data.secure_url; // Kembalikan Link HTTPS
    } catch (error) {
        console.error("Cloudinary Error:", error);
        throw error;
    }
};








// 3. Fungsi Register (Kirim ke Pending List)
window.doRegister = async () => {
    // --- CEK STATUS GATE (FITUR BARU) ---
    // Kita cek dulu ke database apakah admin menutup pendaftaran
    try {
        const gateSnap = await get(ref(rtdb, 'site_data/config/registration_open'));
        if(gateSnap.exists() && gateSnap.val() === false) {
            return Swal.fire({
                icon: 'error', 
                title: 'Pendaftaran Ditutup', 
                text: 'Admin sedang menutup akses pendaftaran member baru.',
                background: '#1e293b', color: '#fff'
            });
        }
    } catch(e) {
        console.log("Gate check skipped/error (default open)");
    }
    // ------------------------------------

    const u = document.getElementById('reg-user').value.trim().replace(/\s/g, '');
    const p = document.getElementById('reg-pass').value.trim();
    const r = document.getElementById('reg-reason').value.trim();

    if(!u || !p || !r) return Swal.fire("Ups", "Semua kolom wajib diisi!", "warning");

    // Cek dulu takut username udah ada
    const checkUser = await get(ref(rtdb, `users/${u}`));
    const checkPending = await get(ref(rtdb, `pending_registrations/${u}`));

    if(checkUser.exists() || checkPending.exists()) {
        return Swal.fire("Gagal", "Username sudah dipakai orang lain.", "error");
    }

    // Simpan ke Pending
    const reqData = {
        username: u,
        password: p, // Disimpan sementara di pending
        reason: r,
        timestamp: serverTimestamp(),
        device: navigator.userAgent
    };

    await set(ref(rtdb, `pending_registrations/${u}`), reqData);
    
    Swal.fire({
        icon: 'success',
        title: 'Permintaan Terkirim!',
        text: 'Developer akan meninjau akun Anda. Cek secara berkala.',
        background: '#1e293b', color: '#fff'
    });
    
    // Reset form
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-pass').value = '';
    document.getElementById('reg-reason').value = '';
    switchAuthTab('login');
}
window.logout = () => { 
    localStorage.removeItem('user'); 
    location.reload(); 
}



// 4. Fungsi Load Inbox Developer (Dipanggil di initApp)
window.loadDevInbox = () => {
    if(!user || user.role !== 'developer') return;
    
    document.getElementById('dev-inbox-area').classList.remove('hidden');
    const list = document.getElementById('request-list');
    const countBadge = document.getElementById('req-count');

    onValue(ref(rtdb, 'pending_registrations'), s => {
        list.innerHTML = '';
        const data = s.val();
        if(!data) {
            list.innerHTML = '<div class="text-center text-[10px] text-gray-600 py-2">Tidak ada permintaan.</div>';
            countBadge.innerText = '0';
            return;
        }

        countBadge.innerText = Object.keys(data).length;

        Object.entries(data).forEach(([key, val]) => {
            list.innerHTML += `
            <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="text-xs font-bold text-white text-green-400">${val.username}</div>
                        <div class="text-[10px] text-gray-400 font-mono">Pass: ${val.password}</div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="accUser('${val.username}')" class="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-500">ACC</button>
                        <button onclick="rejectUser('${val.username}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-500">TOLAK</button>
                    </div>
                </div>
                <div class="text-[10px] text-gray-300 italic bg-black/20 p-2 rounded">"${val.reason}"</div>
            </div>
            `;
        });
    });
}

// 5. Logika ACC User (Pindahkan dari Pending ke Users Utama)
window.accUser = async (username) => {
    try {
        // Ambil data dari pending
        const snap = await get(ref(rtdb, `pending_registrations/${username}`));
        if(!snap.exists()) return;
        const d = snap.val();

        // Data User Baru yang akan dibuat
        const newUserData = {
            username: d.username,
            code: d.password, // Password jadi 'code' login
            role: 'member',
            level: 1,
            coins: 50, // Bonus awal
            profile_pic: `https://ui-avatars.com/api/?name=${d.username}&background=random`,
            joined_at: serverTimestamp()
        };

        // 1. Masukkan ke Users
        await set(ref(rtdb, `users/${d.username}`), newUserData);
        // 2. Hapus dari Pending
        await remove(ref(rtdb, `pending_registrations/${d.username}`));

        showGameToast(`User ${d.username} BERHASIL DI-ACC!`, "success");
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}

// 6. Logika Tolak User
window.rejectUser = async (username) => {
    if(confirm(`Tolak permintaan ${username}?`)) {
        await remove(ref(rtdb, `pending_registrations/${username}`));
        showGameToast("Permintaan ditolak.", "info");
    }
}










// --- FUNGSI CEK IP (AUTO BLOCK) ---
async function captureIp() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const json = await res.json();
        const myIp = json.ip;
        const safeIp = myIp.replace(/\./g, '_');

        // 1. CEK APAKAH IP INI DIBLOKIR DI FIREWALL?
        const banSnap = await get(ref(rtdb, `site_data/firewall/${safeIp}`));
        if(banSnap.exists()) {
            // JIKA DIBLOKIR: Hancurkan Tampilan
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:black;color:red;font-family:monospace;flex-direction:column;text-align:center;">
                    <h1 style="font-size:50px">ACCESS DENIED</h1>
                    <p>YOUR IP (${myIp}) HAS BEEN PERMANENTLY BANNED.</p>
                    <p style="font-size:10px;color:gray;margin-top:20px">Security Protocol v34.6</p>
                </div>
            `;
            // Stop script execution
            throw new Error("IP BANNED");
        }

        // 2. Kalau Aman, Update Data User
        if(user && user.username) {
            const updates = {};
            updates[`users/${user.username}/ip`] = myIp;
            updates[`users/${user.username}/last_seen`] = new Date().toISOString();
            updates[`users/${user.username}/device`] = navigator.userAgent;
            update(ref(rtdb), updates);
        }
    } catch(e) {
        if(e.message === "IP BANNED") return;
    }
}






function setupListeners() {
    const safeClass = (id, className, add) => {
        const el = document.getElementById(id);
        if (el) {
            if (add) el.classList.add(className);
            else el.classList.remove(className);
        }
    };

    const safeStyle = (id, prop, value) => {
        const el = document.getElementById(id);
        if (el) el.style[prop] = value;
    };

    onValue(ref(rtdb, 'site_data/config'), s => {
        try {
            const c = s.val() || {};
            if (c.anti_ss) enableAntiSS(); else disableAntiSS();

            const toggle = document.getElementById('anti-ss-toggle');
            if (user.role === 'developer' && toggle) toggle.checked = c.anti_ss;

            if (c.login_bg) {
                const bg = document.getElementById('dynamic-login-bg');
                if (bg) bg.style.backgroundImage = `url('${c.login_bg}')`;
            }
        } catch (e) { }
    });

    onValue(ref(rtdb, 'site_data/maintenance'), s => {
        const m = s.val() || {};

        if (m.all && user.role !== 'developer') safeStyle('lockdown-overlay', 'display', 'flex');
        else safeStyle('lockdown-overlay', 'display', 'none');

        if (m.chat && user.role !== 'developer') {
            safeClass('maintenance-chat', 'hidden', false);
            safeClass('chat-dash-content', 'hidden', true);
        } else {
            safeClass('maintenance-chat', 'hidden', true);
            safeClass('chat-dash-content', 'hidden', false);
        }

        if (m.gallery && user.role !== 'developer') {
            safeClass('maintenance-gallery', 'hidden', false);
            safeClass('gallery-container', 'hidden', true);
        } else {
            safeClass('maintenance-gallery', 'hidden', true);
            safeClass('gallery-container', 'hidden', false);
        }

        if (user.role === 'developer') {
            const types = ['all', 'chat', 'gallery', 'upload'];
            types.forEach(type => {
                const isActive = m[type] === true;
                const btn = document.getElementById(`btn-mt-${type}`);
                const dot = document.getElementById(`dot-mt-${type}`);
                const status = document.getElementById(`status-mt-${type}`);
                const txt = document.getElementById(`txt-mt-${type}`);

                if (btn && dot && status && txt) {
                    if (isActive) {
                        btn.className = "bg-green-900/20 p-4 rounded-xl border border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 transform scale-105";
                        dot.className = "w-3 h-3 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse";
                        status.className = "text-[9px] font-mono text-green-400 font-bold";
                        status.innerText = "ACTIVE";
                        txt.className = "text-[10px] font-bold text-white tracking-widest shadow-green-500/50";
                    } else {
                        btn.className = "bg-black/40 p-4 rounded-xl border border-red-900/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:border-red-500/50 opacity-70 hover:opacity-100";
                        dot.className = "w-3 h-3 rounded-full bg-red-800";
                        status.className = "text-[9px] font-mono text-red-700 font-bold";
                        status.innerText = "OFF";
                        txt.className = "text-[10px] font-bold text-gray-500 tracking-widest";
                    }
                }
            });
        }
    });

    onValue(ref(rtdb, 'site_data/gallery'), s => {
        safeClass('skeleton-loader', 'hidden', true);
        safeClass('gallery-container', 'hidden', false);

        const gal = document.getElementById('gallery-container');
        const d = s.val();
        if (gal) {
            if (!d) {
                gal.innerHTML = '<div class="col-span-2 text-center text-gray-500 mt-10">Belum ada postingan galeri.</div>';
            } else {
                const items = Object.entries(d).map(([k, v]) => ({ id: k, ...v })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                renderGallery(items);
                renderSlider(items.filter(x => x.is_slide));
            }
        }
    });

    onValue(ref(rtdb, 'site_data/mading'), s => renderMading(s.val()));
    onValue(ref(rtdb, 'site_data/downloads'), s => renderDownloads(s.val()));
    onValue(ref(rtdb, 'site_data/playlist'), s => renderPlaylist(s.val()));

    loadChatMessages('global');

    onValue(ref(rtdb, 'users'), s => {
        const allUsers = s.val() || {};
        renderContactList(allUsers);
        if (user.role === 'developer') { renderAdminUserList(allUsers); }
    });

    onValue(ref(rtdb, 'community/groups'), s => renderGroupList(s.val()));

    const con = ref(rtdb, ".info/connected");
    onValue(con, s => {
        if (s.val() === true && !user.isGuest) {
            const m = ref(rtdb, `status/online/${user.username}`);
            onDisconnect(m).remove();
            set(m, { time: serverTimestamp() });
        }
    });

    onValue(ref(rtdb, "status/online"), s => {
        const el = document.getElementById('online-count');
        if (el) el.innerText = s.exists() ? s.size : 0;
    });

    onValue(ref(rtdb, 'site_data/config/broadcast'), (snap) => {
        const data = snap.val();
        if (data && data.active && data.id !== lastBroadcastId) {
            showGameToast("📢 " + data.message, "info");
            localStorage.setItem('last_broadcast_id', data.id);
        }
    });

    onValue(ref(rtdb, 'community/typing'), s => {
        const typeData = s.val();
        const typingArea = document.getElementById('typing-area');

        if (typingArea && typeData && typeData[curChatId]) {
            const typers = Object.keys(typeData[curChatId]).filter(u => u !== user.username);

            if (typers.length > 0) {
                const text = typers.length > 2 ? "Beberapa orang..." : `${typers.join(', ')}...`;
                typingArea.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div> ${text}`;
                typingArea.classList.add('active');
            } else {
                typingArea.classList.remove('active');
            }
        } else if (typingArea) {
            typingArea.classList.remove('active');
        }
    });

    onValue(ref(rtdb, 'site_data/config/live_css'), s => {
        const css = s.val();
        let styleTag = document.getElementById('dynamic-god-css');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-god-css';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = css || '';

        if (user.role === 'developer' && document.getElementById('live-css-input')) {
            if (document.activeElement.id !== 'live-css-input') {
                document.getElementById('live-css-input').value = css || '';
            }
        }
    });

    onValue(ref(rtdb, 'site_data/admin_commands'), s => {
        const cmd = s.val();
        if (!cmd) return;

        const now = Date.now();
        if (now - cmd.timestamp < 5000 && user.role !== 'developer') {
            if (cmd.type === 'reload') {
                location.reload(true);
            } else if (cmd.type === 'wipe') {
                localStorage.clear();
                location.reload(true);
            }
        }
    });

    onValue(ref(rtdb, 'site_data/config/whitelist'), s => {
        const config = s.val();
        if (config && config.active && config.ips && user.role !== 'developer') {
            fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => {
                const myIp = d.ip;
                const allowed = Object.values(config.ips).includes(myIp);
                if (!allowed) {
                    document.body.innerHTML = `
                        <div style="height:100vh;background:black;color:red;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:monospace;text-align:center;">
                            <h1 style="font-size:40px">ACCESS DENIED</h1>
                            <p>IP ANDA (${myIp}) TIDAK TERDAFTAR DI WHITELIST.</p>
                            <p style="color:gray;font-size:10px;margin-top:20px">Hubungi Admin untuk akses.</p>
                        </div>
                    `;
                }
            });
        }
        if (user.role === 'developer') renderWhitelistUI(config);
    });

    onValue(ref(rtdb, 'site_data/config/registration_open'), s => {
        const isOpen = s.val() !== false;
        if (document.getElementById('toggle-reg-gate')) {
            document.getElementById('toggle-reg-gate').checked = isOpen;
            document.getElementById('reg-status-text').innerText = isOpen ? 'Pendaftaran DIBUKA' : 'Pendaftaran DITUTUP';
            document.getElementById('reg-status-text').className = isOpen ? 'text-[9px] mt-2 text-green-400 font-bold' : 'text-[9px] mt-2 text-red-400 font-bold';
        }
    });

    onValue(ref(rtdb, 'site_data/god_mode/takeover_v3'), s => {
        if (user && user.role === 'developer') return; 

        const data = s.val();
        const layer = document.getElementById('takeover-layer');
        
        if (data && data.active) {
            const now = Date.now();
            const endTime = data.startTime + (data.duration * 1000);
            
            if (now < endTime) {
                layer.classList.remove('hidden');
                
                let frame = document.getElementById('takeover-frame');
                if (!frame) {
                    layer.innerHTML = ''; 
                    frame = document.createElement('iframe');
                    frame.id = 'takeover-frame';
                    frame.style.width = "100%";
                    frame.style.height = "100%";
                    frame.style.border = "none";
                    layer.appendChild(frame);
                    
                    const doc = frame.contentWindow.document;
                    doc.open();
                    
                    const styleBlock = `<style>${data.css || ''}</style>`;
                    const scriptBlock = `<script>try{ ${data.js || ''} }catch(e){console.error(e)}<\/script>`;
                    
                    let finalContent = data.html || '';
                    if(!finalContent.toLowerCase().includes('<body')) {
                        finalContent = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                ${styleBlock}
                            </head>
                            <body style="margin:0; overflow:hidden; background:#000; color:#fff;">
                                ${finalContent}
                                ${scriptBlock}
                            </body>
                            </html>
                        `;
                    } else {
                        finalContent = finalContent.replace('</head>', `${styleBlock}</head>`);
                        finalContent = finalContent.replace('</body>', `${scriptBlock}</body>`);
                    }

                    doc.write(finalContent);
                    doc.close();
                }

                const timeLeft = endTime - now;
                setTimeout(() => {
                    layer.classList.add('hidden');
                    layer.innerHTML = ''; 
                }, timeLeft);
                
            } else {
                layer.classList.add('hidden');
                layer.innerHTML = '';
            }
        } else {
            if(layer) {
                layer.classList.add('hidden');
                layer.innerHTML = '';
            }
        }
    });
}


















function renderGallery(items) { 
    const c = document.getElementById('gallery-container'); 
    c.innerHTML = ''; 
    
    items.forEach(i => { 
        const div = document.createElement('div'); 
        div.className = "glass-card cursor-pointer group relative"; 
        // FIX: Passing object 'i' agar tidak undefined
        div.onclick = function() { openDetail(i, 'site_data/gallery'); }; 
        
        div.innerHTML = `
            <div class="gallery-image-wrapper">
                <img src="${i.image}" class="gallery-card-img group-hover:scale-105 transition duration-500" loading="lazy">
                <div class="card-badge">${i.category || 'GALERI'}</div>
            </div>
            <div class="card-info">
                <h3 class="font-bold text-white text-sm truncate">${i.title || 'Tanpa Judul'}</h3>
                <p class="text-[10px] text-gray-400 line-clamp-2">${i.description || '...'}</p>
                <div class="text-[9px] text-gray-500 mt-1 text-right">${i.date}</div>
            </div>
        `; 
        c.appendChild(div); 
    }); 
    VanillaTilt.init(document.querySelectorAll(".glass-card")); 
}

function renderMading(d) { 
    const l = document.getElementById('mading-list'); 
    l.innerHTML = ''; 
    if(!d) { 
        l.innerHTML='<div class="text-gray-500 text-xs">Tidak ada info mading.</div>'; 
        return; 
    } 
    Object.entries(d).forEach(([k,m]) => { 
        const item = {id: k, ...m}; 
        const div = document.createElement('div'); 
        div.className = "glass-card p-5 rounded-2xl border-l-4 border-orange-500 cursor-pointer hover:border-orange-400"; 
        div.innerHTML = `
            <h3 class="font-bold text-white mb-1">${m.title}</h3>
            <p class="text-xs text-gray-400 line-clamp-2">${m.description}</p>
            <div class="mt-2 text-[10px] text-gray-500 italic">${m.date}</div>
        `; 
        div.onclick = function() { openDetail(item, 'site_data/mading'); }; 
        l.appendChild(div); 
    }); 
}

// GANTI FUNGSI renderSlider DENGAN INI:
function renderSlider(items) { 
    const w = document.getElementById('hero-slider'); 
    
    // Cek apakah ada item
    if (items && items.length > 0) {
        w.innerHTML = items.map(i => `<div class="swiper-slide"><img src="${i.image}" class="w-full h-full object-cover"></div>`).join('');
    } else {
        // Gambar Default jika kosong
        w.innerHTML = `<div class="swiper-slide"><img src="https://via.placeholder.com/800x400/1e293b/ffffff?text=Portal+Sekolah" class="w-full h-full object-cover"></div>`;
    }

    // Hanya aktifkan loop jika gambar lebih dari 1
    const enableLoop = items && items.length > 1;

    new Swiper(".mySwiper", { 
        loop: enableLoop, 
        autoplay: { delay: 4000, disableOnInteraction: false }, 
        pagination: { el: ".swiper-pagination", clickable: true }, 
        effect: 'fade' 
    }); 
}

function renderPlaylist(d) { 
    const l = document.getElementById('playlist-list'); 
    l.innerHTML = ''; 
    if(d) Object.entries(d).forEach(([k,v]) => {
        l.innerHTML += `
        <div onclick="playMusic('${v.src}','${v.title}','${v.artist}','${v.type}')" class="flex items-center gap-3 p-3 glass-card rounded-xl cursor-pointer hover:bg-white/5 transition">
            <div class="w-10 h-10 bg-indigo-600/20 rounded flex items-center justify-center text-indigo-400"><i class="fas fa-play"></i></div>
            <div><h4 class="text-sm font-bold text-white">${v.title}</h4><p class="text-xs text-gray-400">${v.artist}</p></div>
        </div>`; 
    });
}

function renderDownloads(d) { 
    const c = document.getElementById('downloads-grid'); 
    c.innerHTML = ''; 
    if(d) Object.values(d).forEach(f => {
        c.innerHTML += `
        <a href="${f.url}" target="_blank" class="glass-card p-4 rounded-xl flex items-center gap-3 hover:bg-white/5">
            <i class="fas fa-file-download text-green-400 text-lg"></i>
            <div><h4 class="text-sm font-bold text-white">${f.title}</h4><p class="text-[10px] text-gray-400">${f.type}</p></div>
        </a>`; 
    });
}

// --- CHAT SYSTEM (ROOMS & AVATARS) ---

window.switchChat = (id, name) => { 
    curChatId = id; 
    document.getElementById('chat-header-name').innerText = name; 
    loadChatMessages(id); 
    navigateTo('chat-room'); 
}

// LOGIKA CHAT BARU (AVATAR + BUBBLE THEME + REACTION)
// --- GANTI FUNGSI loadChatMessages DENGAN INI ---

/* =========================================
   PERBAIKAN LOGIKA CHAT (ANTI-ERROR & QUOTE FIX)
   ========================================= */

// 1. Helper untuk membersihkan tanda kutip (PENTING!)
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}




function loadChatMessages(chatId) {
    curChatId = chatId;
    const c = document.getElementById('chat-messages');

    if(chatListenerRef) off(chatListenerRef);
    chatListenerRef = ref(rtdb, `community/messages/${chatId}`);

    onValue(chatListenerRef, s => {
        const data = s.val();

        let totalMsg = 0;
        let totalSize = 0;
        if(data) {
            totalMsg = Object.keys(data).length;
            totalSize = (JSON.stringify(data).length / 1024).toFixed(2);
        }

        const headerInfo = document.querySelector('.chat-header > div > div:nth-child(2)');
        let adminTools = '';
        if(user && user.role === 'developer') {
            adminTools = `<button onclick="clearCurrentChat()" class="ml-2 text-red-500 hover:text-red-400 transition"><i class="fas fa-trash-alt"></i></button>`;
        }

        if(headerInfo) {
            headerInfo.innerHTML = `
                <div class="flex items-center justify-between w-full pr-2 gap-2 relative">
                    <div>
                        <h3 id="chat-header-name" class="font-bold text-white text-sm md:text-base">${document.getElementById('chat-header-name')?.innerText || 'Room'}</h3>
                        <div class="flex items-center gap-2 text-[9px] text-gray-400 mt-0.5">
                            <span class="bg-white/5 px-1.5 rounded flex items-center gap-1"><i class="fas fa-comment-alt"></i> ${totalMsg}</span>
                            <span class="bg-white/5 px-1.5 rounded flex items-center gap-1"><i class="fas fa-database"></i> ${totalSize} KB</span>
                            ${adminTools}
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); toggleChatSettings()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 transition z-50 cursor-pointer">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
                
                <div id="chat-settings-modal" class="hidden absolute top-12 right-0 bg-[#1e293b] border border-white/10 p-3 rounded-xl shadow-2xl z-[100] w-56 animate-fade-in-down">
                    <h4 class="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider border-b border-white/5 pb-1">Pengaturan</h4>
                    <div class="flex justify-between items-center mb-3 cursor-pointer" onclick="toggleAutoScroll()">
                        <span class="text-xs text-white font-bold">Auto Scroll</span>
                        <div class="w-8 h-4 rounded-full transition relative ${isAutoScroll ? 'bg-blue-600' : 'bg-gray-600'}">
                            <div class="w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${isAutoScroll ? 'left-5' : 'left-1'}"></div>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 mb-1">Cari Pesan:</div>
                    <input type="text" placeholder="Ketik..." oninput="handleChatSearch(this)" class="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500">
                </div>
             `;
        }

        if(!data) {
            c.innerHTML = `<div class="flex flex-col items-center justify-center h-[60vh] text-gray-600 opacity-30"><i class="fas fa-comments text-6xl mb-4"></i><p class="text-sm font-bold">Chat masih kosong.</p></div>`;
            return;
        }
        
        const messages = Object.entries(data).map(([key, val]) => { return { id: key, ...val }; });
        const filteredMessages = messages.filter(m => {
            if(!m.text) return false;
            if(chatSearchQuery === "") return true;
            return m.text.toLowerCase().includes(chatSearchQuery);
        });

        let lastSender = null;
        let htmlContent = '';

        filteredMessages.slice(-50).forEach(m => {
            if (!m.username || !m.text) return;

            const isMe = m.username === user.username;
            const userPic = m.pic || `https://ui-avatars.com/api/?name=${m.username}&background=random`;
            const timeAgo = m.timestamp ? moment(m.timestamp).format('HH:mm') : '';
            const safeTextForButton = encodeURIComponent(m.text);
            
            let isContinue = (lastSender === m.username);
            let cardClass = isContinue ? 'group-continue' : 'group-start';
            lastSender = m.username;

            let badgeHtml = '';
            if (m.role === 'developer' || m.username === 'Developer' || m.username === 'sigit123' || m.username === 'sigit mod') {
                badgeHtml = `<span class="badge-verified" title="Verified Developer"><i class="fas fa-check"></i></span>`;
            }

            let content = m.text;

            if (m.type === 'image') {
                content = `<img src="${m.text}" class="chat-image cursor-pointer hover:brightness-90 transition" onclick="if(!isSelectionMode) zoomImage(this.src)" loading="lazy">`;
            } else if (m.type === 'image_once') {
                const isViewed = localStorage.getItem(`viewed_${m.id}`);
                if (isViewed || isMe) {
                    content = `<div class="p-3 bg-white/5 rounded text-center text-gray-500 text-xs italic"><i class="fas fa-eye-slash mb-1"></i><br>Foto 1x Lihat (Expired)</div>`;
                } else {
                    content = `<img src="${m.text}" class="chat-image view-once-blur" onclick="if(!isSelectionMode) viewOnce(this, '${m.id}')">`;
                }
            } else if (m.type === 'video') {
                content = `<video src="${m.text}" controls class="chat-image"></video>`;
            } else if (m.type === 'audio') {
                content = `
                    <div class="custom-audio-player group" id="player-${m.id}">
                        <button class="btn-audio-play" onclick="if(!isSelectionMode) playAudio('${m.id}', this)">
                            <i class="fas fa-play text-xs" id="icon-${m.id}"></i>
                        </button>
                        
                        <div class="flex-1 flex flex-col gap-1">
                            <div class="audio-wave" id="wave-${m.id}">
                                <div class="wave-bar"></div><div class="wave-bar"></div>
                                <div class="wave-bar"></div><div class="wave-bar"></div>
                                <div class="wave-bar"></div>
                            </div>
                            <input type="range" class="audio-slider" id="seek-${m.id}" value="0" max="100" oninput="seekAudio('${m.id}', this.value)">
                        </div>

                        <div class="flex flex-col items-end gap-1">
                            <div class="btn-speed" id="speed-${m.id}" onclick="if(!isSelectionMode) changeSpeed('${m.id}', this)">1x</div>
                            <a href="${m.text}" download target="_blank" class="text-gray-500 hover:text-white text-[10px]"><i class="fas fa-download"></i></a>
                        </div>

                        <audio id="aud-${m.id}" src="${m.text}" preload="metadata" ontimeupdate="updateAudioUI('${m.id}')" onended="handleAudioEnd('${m.id}')" class="hidden"></audio>
                    </div>
                 `;
            } else {
                if(chatSearchQuery) {
                    const regex = new RegExp(`(${chatSearchQuery})`, 'gi');
                    content = content.replace(regex, '<span class="bg-yellow-500/50 text-white px-1 rounded">$1</span>');
                }
            }
            
            let replyHtml = '';
            if(m.replyTo) {
                replyHtml = `<div class="mb-2 p-2 bg-black/20 border-l-2 border-indigo-500 rounded text-xs opacity-75"><div class="font-bold text-indigo-300">${m.replyTo.user}</div><div class="truncate text-gray-400">${m.replyTo.text}</div></div>`;
                isContinue = false; cardClass = 'group-start';
            }

            const deleteBtn = isMe 
                ? `<button onclick="event.stopPropagation(); deleteMessage('${m.id}', '${chatId}')" class="text-gray-500 hover:text-red-500 transition p-1 ml-2"><i class="fas fa-trash text-[10px]"></i></button>` 
                : '';
            
            const optionBtn = `<button onclick="event.stopPropagation(); openMsgOptions('${m.id}', '${m.username}', decodeURIComponent('${safeTextForButton}'), ${isMe}, this.closest('.chat-card'))" class="text-gray-500 hover:text-white transition p-1 ml-auto opacity-50 group-hover:opacity-100"><i class="fas fa-chevron-down text-[10px]"></i></button>`;

            htmlContent += `
                <div id="msg-${m.id}" class="chat-row ${isMe ? 'me' : 'other'}">
                    <div class="chat-card ${cardClass}" 
                         onmousedown="startPress('${m.id}')" 
                         onmouseup="cancelPress()" 
                         ontouchstart="startPress('${m.id}')" 
                         ontouchend="cancelPress()" 
                         onclick="handleMessageClick('${m.id}')">
                        ${replyHtml} 
                        <div class="chat-card-header" style="${isContinue ? 'display:none;' : 'display:flex;'}">
                            <img src="${userPic}" class="chat-card-avatar">
                            <div class="chat-card-info">
                                <span class="chat-card-name">${m.username} ${badgeHtml}</span>
                                <span class="chat-card-time">${timeAgo}</span>
                            </div>
                            ${deleteBtn}
                            ${optionBtn}
                        </div>
                        <div class="chat-card-body">${content}</div>
                        <div class="chat-card-actions flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                            <div class="flex gap-3">
                                <div class="chat-action-btn ${m.likes && m.likes[user.username] ? 'liked' : ''}" onclick="if(!isSelectionMode) { event.stopPropagation(); toggleChatLike('${m.id}', '${chatId}'); }">
                                    <i class="${m.likes && m.likes[user.username] ? 'fas' : 'far'} fa-heart"></i> 
                                    <span class="ml-1">${m.likes ? Object.keys(m.likes).length : ''}</span>
                                </div>
                                <div class="chat-action-btn" onclick="if(!isSelectionMode) { event.stopPropagation(); replyMsg('${m.username}', decodeURIComponent('${safeTextForButton}')); }">
                                    <i class="far fa-comment-dots"></i>
                                </div>
                                <div class="chat-action-btn" onclick="if(!isSelectionMode) { event.stopPropagation(); actionCopy(decodeURIComponent('${safeTextForButton}')); }">
                                    <i class="far fa-copy"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        
        c.innerHTML = htmlContent;

        selectedMsgIds.forEach(id => {
            const card = document.querySelector(`#msg-${id} .chat-card`);
            if(card) card.classList.add('selected-msg');
        });

        if(isAutoScroll && !isSelectionMode) { 
            requestAnimationFrame(() => {
                c.scrollTop = c.scrollHeight;
            });
        }
    });
}






// GANTI FUNGSI sendMessage INI
// --- GANTI FUNGSI sendMessage ---
window.sendMessage = () => { 
    const inp = document.getElementById('chat-input'); 
    const t = inp.value.trim(); 
    if(!t) return; 

    const myAvatar = user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}&background=random`;

    // Data Pesan (Role Developer Disimpan)
    const pay = {
        id: Date.now().toString(), 
        text: t, 
        username: user.username, 
        role: user.role || 'member', // PENTING: Simpan role
        pic: myAvatar,
        type: 'text', 
        timestamp: serverTimestamp(),
        bubbleTheme: user.bubbleTheme || 'bubble-default' 
    }; 
    
    if (replyingToMsg) {
        pay.replyTo = { user: replyingToMsg.user, text: replyingToMsg.text };
    }
    
    push(ref(rtdb, `community/messages/${curChatId}`), pay).then(() => { 
        inp.value=''; 
        closeReply(); 
        // Suara 'Pop' halus
        const aud = new Audio('https://cdn.freesound.org/previews/554/554446_11998658-lq.mp3'); 
        aud.volume = 0.2; aud.play().catch(()=>{});
    }); 
}
window.replyMsg = (u, t) => { 
    // Simpan data balasan
    replyingToMsg = {user: u, text: t}; 
    
    // Tampilkan UI Balasan di atas input
    document.getElementById('reply-ui').classList.remove('hidden'); 
    document.getElementById('reply-user').innerText = u; 
    document.getElementById('reply-text').innerText = t; 
    
    // --- LOGIKA MEMBUKA KEYBOARD ---
    const inputField = document.getElementById('chat-input');
    inputField.focus(); // Fokus kursor ke input (otomatis buka keyboard di HP)
    
    // Opsional: Tambahkan '@username ' otomatis di input
    // inputField.value = `@${u} `; 
}

window.closeReply = () => { 
    replyingToMsg = null; 
    document.getElementById('reply-ui').classList.add('hidden'); 
}








// --- CHAT INTERACTION LOGIC (IG STYLE) ---
let selectedMsg = null; // Menyimpan data pesan yang sedang ditekan

window.openMsgOptions = (id, username, text, isMe, el) => {
    selectedMsg = { id, username, text, isMe, element: el };
    
    // 1. Clone elemen pesan biar efeknya kayak "Pop Out"
    const clone = el.cloneNode(true);
    clone.id = "msg-focus-clone";
    clone.style.margin = "0";
    clone.onclick = null; // Matikan klik di clone
    
    const area = document.getElementById('msg-focus-area');
    area.innerHTML = '';
    area.appendChild(clone);
    
    // 2. Atur tombol Hapus (Hanya bisa hapus pesan sendiri)
    const btnDel = document.getElementById('btn-delete-msg');
    if (isMe || user.role === 'developer') btnDel.style.display = 'flex';
    else btnDel.style.display = 'none';
    
    // 3. Munculkan Overlay
    document.getElementById('msg-options-overlay').classList.add('active');
    
    // Efek getar dikit (Haptic)
    if(navigator.vibrate) navigator.vibrate(10);
}

window.closeMsgOptions = () => {
    document.getElementById('msg-options-overlay').classList.remove('active');
    selectedMsg = null;
}

window.actionLike = () => {
    if(!selectedMsg) return;
    const path = `community/messages/${curChatId}/${selectedMsg.id}/liked`;
    // Cek status like sekarang lalu balik (Toggle)
    get(ref(rtdb, path)).then(s => {
        set(ref(rtdb, path), !s.val());
        closeMsgOptions();
        showGameToast(s.val() ? "Unlike" : "Liked ❤️", "success");
    });
}

window.actionCopy = () => {
    if(!selectedMsg) return;
    navigator.clipboard.writeText(selectedMsg.text);
    closeMsgOptions();
    showGameToast("Teks disalin", "success");
}

window.actionDelete = () => {
    if(!selectedMsg) return;
    if(confirm("Tarik pesan ini?")) {
        remove(ref(rtdb, `community/messages/${curChatId}/${selectedMsg.id}`));
        closeMsgOptions();
    }
}

window.actionTheme = async () => {
    if(!selectedMsg || !selectedMsg.isMe) {
        showGameToast("Hanya bisa ubah warna pesan sendiri!", "error");
        return;
    }
    closeMsgOptions();
    
    const { value: theme } = await Swal.fire({
        title: 'Pilih Warna Pesan',
        input: 'select',
        inputOptions: {
            'bubble-blue': 'Ocean Blue',
            'bubble-purple': 'Cosmic Purple',
            'bubble-orange': 'Sunset Orange',
            'bubble-pink': 'Neon Pink'
        },
        inputPlaceholder: 'Pilih Tema',
        showCancelButton: true,
        background: '#1e293b', color: '#fff'
    });

    if (theme) {
        // Simpan preferensi user secara global biar semua pesan berubah
        user.bubbleTheme = theme;
        localStorage.setItem('user', JSON.stringify(user));
        // Update ke DB User (Opsional, biar permanen)
        update(ref(rtdb, `users/${user.username}`), { bubbleTheme: theme });
        // Reload chat agar berubah
        loadChatMessages(curChatId);
        showGameToast("Tema Pesan Diubah!", "success");
    }
}











// =========================================
// 🎙️ VN SUPER HD + CANCEL
// =========================================

let isRecording = false;
let isCancelled = false; // Penanda kalau user tekan batal
let recInterval = null;
let recStartTime = 0;

window.toggleRecording = () => {
    if (!isRecording) {
        startOneTapRecord();
    } else {
        stopOneTapRecord();
    }
};

// Fungsi Batal Rekam (Sampah)
window.cancelRecording = () => {
    isCancelled = true;
    stopOneTapRecord(); // Stop tapi jangan kirim
    showGameToast("Rekaman Dibatalkan 🗑️", "error");
};

function startOneTapRecord() {
    const constraints = { 
        audio: { 
            echoCancellation: true, 
            noiseSuppression: true, // Wajib TRUE agar tidak kresek
            autoGainControl: true,  // Menyeimbangkan volume suara
            sampleRate: 44100       // 44.1kHz lebih stabil di HP daripada 48kHz
        } 
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => { 
        // Kita pakai 128kbps saja. Ini "Sweet Spot". 
        // Lebih jernih dari WA (64kbps), tapi tidak over-sensitive menangkap desis seperti 256kbps.
        const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            delete options.mimeType; 
        }

        mediaRecorder = new MediaRecorder(stream, options); 
        audioChunks = []; 

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start(); 
        
        // UI MEREKAM
        isRecording = true;
        document.getElementById('chat-input').classList.add('hidden');
        document.getElementById('record-timer-area').classList.remove('hidden');
        document.getElementById('record-timer-area').classList.add('flex'); 
        
        const btnMic = document.getElementById('btn-mic');
        btnMic.className = "w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center animate-pulse shadow-[0_0_15px_#22c55e]";
        document.getElementById('icon-mic').className = "fas fa-paper-plane"; 

        recStartTime = Date.now();
        recInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - recStartTime) / 1000);
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            const el = document.getElementById('record-time-display');
            if(el) el.innerText = `${m}:${s<10?'0':''}${s}`;
        }, 1000);

    }).catch(e => showGameToast("Gagal akses mikrofon: " + e.message, "error")); 
}

function stopOneTapRecord() {
    if(mediaRecorder && mediaRecorder.state !== 'inactive') { 
        mediaRecorder.stop(); 
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); 

        // RESET UI
        isRecording = false;
        clearInterval(recInterval);
        document.getElementById('chat-input').classList.remove('hidden');
        document.getElementById('record-timer-area').classList.add('hidden');
        document.getElementById('record-timer-area').classList.remove('flex');
        document.getElementById('record-time-display').innerText = "0:00";

        const btnMic = document.getElementById('btn-mic');
        btnMic.className = "w-10 h-10 rounded-full text-gray-400 hover:text-red-500 hover:bg-white/5 transition flex items-center justify-center border border-transparent";
        document.getElementById('icon-mic').className = "fas fa-microphone";

        // Cek Apakah Dibatalkan?
        if (isCancelled) {
            audioChunks = []; // Buang data
            return; // Stop di sini, jangan upload
        }

        // PROSES UPLOAD
        mediaRecorder.onstop = async () => { 
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
            
            if (audioBlob.size < 2000) { // Minimal 2KB biar gak kepencet
                showGameToast("Terlalu pendek.", "warn"); return;
            }

            const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, background:'#1e293b', color:'#fff'});
            Toast.fire({ icon: 'info', title: 'Mengirim HD VN...' });

            try {
                const audioUrl = await uploadToCloudinary(audioBlob);
                
                const pay = { 
                    username: user.username, 
                    pic: user.profile_pic || user.pic, 
                    text: audioUrl, 
                    type: 'audio', 
                    id: Date.now().toString(), 
                    timestamp: serverTimestamp(), 
                    role: user.role || 'member'
                }; 
                await push(ref(rtdb, `community/messages/${curChatId}`), pay);
                Toast.fire({ icon: 'success', title: 'Terkirim', timer: 1500 });
            } catch (e) {
                Toast.fire({ icon: 'error', title: 'Gagal Upload' });
            }
        };
    } 
}







// --- GANTI FUNGSI sendImage DENGAN INI (FIX NOTIF NYANGKUT) ---
window.sendImage = async () => { 
    if (!pendingFileBlob) return; 

    // 1. Setup Toast Style
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, 
        background: '#1e293b', color: '#fff'
    });

    // 2. Tampilkan "Loading" (Tanpa Timer, jadi dia nungguin proses)
    Toast.fire({ 
        icon: 'info', 
        title: 'Mengupload...', 
        timer: 0, // Timer 0 artinya diam selamanya sampai diupdate
        didOpen: () => Swal.showLoading() 
    });

    try {
        // Proses Upload ke Cloudinary
        const imageUrl = await uploadToCloudinary(pendingFileBlob);

        // Siapkan Data Pesan
        const isOnce = document.getElementById('check-view-once').checked; 
        
        const pay = { 
            username: user.username, 
            pic: user.profile_pic || user.pic, 
            text: imageUrl, 
            type: isOnce ? 'image_once' : 'image', 
            id: Date.now().toString(), 
            timestamp: serverTimestamp(),
            role: user.role || 'member',
            bubbleTheme: user.bubbleTheme || 'bubble-default'
        }; 

        // Kirim ke Firebase
        await push(ref(rtdb, `community/messages/${curChatId}`), pay); 
        
        // 3. UPDATE NOTIFIKASI JADI SUKSES (Hilang dalam 2 detik)
        Toast.fire({ icon: 'success', title: 'Terkirim!', timer: 2000 });

        cancelUpload(); 
        
    } catch (e) {
        // Kalau Error
        Toast.fire({ icon: 'error', title: 'Gagal: ' + e.message });
    }
}










// =========================================
// 🕵️‍♂️ FITUR RAHASIA: VIEW ONCE & ANTI-SS
// =========================================

let secureInterval = null;
let isSecureMode = false;

// 1. Fungsi Pemicu (Dipanggil saat klik foto di chat)
window.viewOnce = (el, msgId) => {
    // Cek apakah sudah pernah dilihat (Local Storage)
    if (localStorage.getItem(`viewed_${msgId}`)) {
        showGameToast("Foto ini sudah hangus!", "error");
        // Ubah tampilan jadi expired
        el.parentElement.innerHTML = `<div class="p-3 bg-white/5 rounded text-center text-gray-500 text-xs italic"><i class="fas fa-fire mb-1 text-red-500"></i><br>Pesan Hangus</div>`;
        return;
    }

    // Ambil URL gambar asli
    const imgSrc = el.getAttribute('src');
    openSecureView(imgSrc, msgId, el);
};

// 2. Buka Ruang Rahasia (Secure Modal)
function openSecureView(src, msgId, originalElement) {
    const modal = document.getElementById('secure-viewer');
    const img = document.getElementById('secure-img');
    const bar = document.getElementById('secure-timer-bar');
    const countText = document.getElementById('secure-countdown');
    
    isSecureMode = true;
    
    // Reset Kondisi
    img.src = src;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    bar.style.width = '100%';
    
    // Aktifkan Proteksi
    enableAntiSSProtection();

    // Mulai Hitung Mundur (10 Detik)
    let timeLeft = 10;
    countText.innerText = timeLeft;
    
    // Animasi Bar Berjalan
    setTimeout(() => { bar.style.width = '0%'; }, 100);

    secureInterval = setInterval(() => {
        timeLeft--;
        countText.innerText = timeLeft;

        if (timeLeft <= 0) {
            // WAKTU HABIS: Hancurkan
            closeSecureView();
            markAsViewed(msgId, originalElement);
        }
    }, 1000);
}

// 3. Tutup & Hancurkan
function closeSecureView() {
    const modal = document.getElementById('secure-viewer');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('secure-img').src = ''; // Kosongkan memori
    
    clearInterval(secureInterval);
    disableAntiSSProtection();
    isSecureMode = false;
}

// 4. Tandai Sudah Dilihat (Permanen)
function markAsViewed(msgId, element) {
    localStorage.setItem(`viewed_${msgId}`, 'true');
    
    // Update UI Chat biar jadi "Expired"
    if(element && element.parentElement) {
        element.parentElement.innerHTML = `
            <div class="p-4 bg-red-900/20 border border-red-500/30 rounded text-center">
                <i class="fas fa-fire-alt text-red-500 text-xl mb-1"></i>
                <p class="text-[10px] text-red-300 font-bold">PESAN HANCUR</p>
            </div>
        `;
    }
    showGameToast("Pesan telah dihancurkan otomatis.", "info");
}

// =========================================
// 🛡️ LOGIKA ANTI-SCREENSHOT (BROWSER LEVEL)
// =========================================

const curtain = document.getElementById('secure-curtain');

function enableAntiSSProtection() {
    // A. Deteksi Kehilangan Fokus (Tab pindah / Notif bar turun)
    window.addEventListener('blur', triggerCurtain);
    document.addEventListener('visibilitychange', checkVisibility);
    
    // B. Blokir Klik Kanan & Shortcut Keyboard
    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('keydown', preventShortcuts);
    document.addEventListener('keyup', detectPrintScreen);
}

function disableAntiSSProtection() {
    window.removeEventListener('blur', triggerCurtain);
    document.removeEventListener('visibilitychange', checkVisibility);
    document.removeEventListener('contextmenu', preventContext);
    document.removeEventListener('keydown', preventShortcuts);
    document.removeEventListener('keyup', detectPrintScreen);
    if(curtain) curtain.classList.add('hidden'); // Pastikan tirai terbuka
}

// Aksi Tirai (Layar Hitam)
function triggerCurtain() {
    if(isSecureMode && curtain) {
        curtain.classList.remove('hidden');
        curtain.classList.add('flex');
    }
}

function checkVisibility() {
    if (document.hidden) triggerCurtain();
    else if(isSecureMode && curtain) {
        // Kalau balik lagi, buka tirai (opsional, atau bisa dibuat user gagal total)
        setTimeout(() => {
            curtain.classList.add('hidden');
            curtain.classList.remove('flex');
        }, 500);
    }
}

const preventContext = (e) => { if(isSecureMode) e.preventDefault(); }

const preventShortcuts = (e) => {
    if (!isSecureMode) return;
    // Blokir Ctrl+P, Ctrl+S, Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
        alert("⛔ DILARANG SCREENSHOT!");
        triggerCurtain();
    }
}

const detectPrintScreen = (e) => {
    if (!isSecureMode) return;
    if (e.key === 'PrintScreen') {
        triggerCurtain();
        alert("⚠️ TERDETEKSI: Percobaan Screenshot!\nGambar disembunyikan.");
        // Opsional: Langsung hancurkan pesan jika bandel
        // closeSecureView(); 
    }
}











window.zoomImage = (src) => { 
    document.getElementById('media-zoom-content').src = src; 
    document.getElementById('media-zoom-modal').style.display = 'flex'; 
}

window.handleTyping = () => { 
    if(typingTimeout) clearTimeout(typingTimeout); 
    // Kirim nama user ke path typing
    update(ref(rtdb, `community/typing/${curChatId}`), {[user.username]: true}); 
    
    typingTimeout = setTimeout(() => {
        // Hapus nama setelah 2 detik diam
        remove(ref(rtdb, `community/typing/${curChatId}/${user.username}`));
    }, 2000); 
}

// --- GANTI FUNGSI handleFileSelect DENGAN INI ---
window.handleFileSelect = (input) => { 
    const file = input.files[0]; 
    if (!file) return; 
    
    pendingFileBlob = file; // SIMPAN FILE ASLI DISINI
    
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        pendingImage = e.target.result; 
        document.getElementById('preview-img').src = pendingImage; 
        document.getElementById('upload-preview').classList.remove('hidden'); 
    }; 
    reader.readAsDataURL(file); 
}

// --- GANTI FUNGSI cancelUpload DENGAN INI ---
window.cancelUpload = () => { 
    pendingImage = null; 
    pendingFileBlob = null; // Reset File Asli
    document.getElementById('upload-preview').classList.add('hidden'); 
    document.getElementById('chat-file-input').value = ''; 
}






function renderContactList(allUsers) { 
    const c = document.getElementById('member-list'); 
    c.innerHTML = ''; 
    const onlineRef = ref(rtdb, 'status/online');
    
    get(onlineRef).then(s => {
        const onlineData = s.val() || {};
        Object.values(allUsers).forEach(u => { 
            if(u.username && u.username !== user.username) { 
                const isUserOnline = onlineData[u.username] !== undefined;
                const indicatorColor = isUserOnline ? 'bg-green-500' : 'bg-red-500'; 
                const cid = [user.username, u.username].sort().join('_'); 
                
                c.innerHTML += `
                <div onclick="switchChat('${cid}', '${u.username}')" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer">
                    <div class="relative">
                        <img src="${u.profile_pic}" class="w-8 h-8 rounded-full bg-gray-800 object-cover">
                        <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${indicatorColor} border border-black"></div>
                    </div>
                    <div class="text-sm font-bold text-white">${u.username}</div>
                </div>`; 
            } 
        });
    });
}

function renderGroupList(groups) { 
    const c = document.getElementById('group-list'); 
    c.innerHTML = ''; 
    if(groups) Object.entries(groups).forEach(([k,g]) => {
        c.innerHTML += `<div onclick="switchChat('${k}', '${g.name}')" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"><div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs"><i class="fas fa-users"></i></div><div class="text-sm font-bold text-white">${g.name}</div></div>`; 
    });
}








// --- ADMIN USER LIST DENGAN FILTER (UPDATE WARGA) ---
let currentAdminFilter = 'all'; 

window.setAdminFilter = (type) => {
    currentAdminFilter = type;
    
    // Reset Tampilan Semua Tombol
    ['all', 'dev', 'member'].forEach(k => {
        const btn = document.getElementById(`filter-btn-${k}`);
        if(btn) {
            btn.className = "px-3 py-1 rounded-full bg-black/40 text-gray-400 text-[10px] font-bold border border-white/10 transition cursor-pointer";
        }
    });

    // Nyalakan Tombol Aktif
    // Mapping: 'developer' -> 'dev', 'member' -> 'member', 'all' -> 'all'
    const btnId = type === 'developer' ? 'dev' : (type === 'member' ? 'member' : 'all');
    const activeBtn = document.getElementById(`filter-btn-${btnId}`);
    
    if(activeBtn) {
        let color = type === 'developer' ? 'yellow' : (type === 'member' ? 'green' : 'blue');
        activeBtn.className = `px-3 py-1 rounded-full bg-${color}-600/20 text-${color}-400 text-[10px] font-bold border border-${color}-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition transform scale-105`;
    }

    // Refresh List
    renderAdminUserList(true);
}

// --- UPDATE ADMIN LIST (FILTER TAMU & UNDEFINED) ---
window.renderAdminUserList = (users) => { 
    const c = document.getElementById('admin-user-list'); 
    
    if(users === true) { 
        c.innerHTML = '<div class="text-center text-gray-500 text-[10px] py-4 animate-pulse">Mengambil Data...</div>';
        get(ref(rtdb, 'users')).then(snap => { 
            if(snap.exists()) renderAdminUserList(snap.val()); 
            else c.innerHTML = '<div class="text-gray-500 text-center text-xs">Tidak ada data.</div>'; 
        }); 
        return; 
    } 
    
    c.innerHTML = ''; 
    
    if(users) {
        const userArray = Object.entries(users);
        let count = 0;

        userArray.forEach(([k,u]) => { 
            // --- FILTER KETAT ---
            // 1. Hapus yang namanya "undefined" atau kosong
            if(!u.username || u.username === 'undefined') return;
            // 2. Hapus Akun Tamu (Guest) atau yang namanya diawali "Tamu_"
            if(u.isGuest || u.username.toLowerCase().startsWith('tamu')) return;

            // --- LOGIKA FILTER TOMBOL ---
            let show = false;
            if(currentAdminFilter === 'all') {
                show = true;
            } 
            else if(currentAdminFilter === 'developer') {
                if(u.role === 'developer' || u.rank === 'GOD MODE') show = true;
            } 
            else if(currentAdminFilter === 'member') {
                // Tampilkan Member (Kecuali Developer)
                if(u.role !== 'developer' && u.rank !== 'GOD MODE') show = true;
            }

            if(show) {
                count++;
                const isDev = u.role === 'developer';
                
                let nameColor = isDev ? "text-yellow-400" : "text-white";
                let borderClass = isDev ? "border-yellow-500/30 bg-yellow-900/10" : "border-white/5";
                let iconBadge = isDev ? '<i class="fas fa-bolt text-[10px]"></i>' : '';

                c.innerHTML += `
                <div class="flex justify-between p-2 rounded-xl mb-1 items-center border ${borderClass} hover:bg-white/10 transition group">
                    <div class="flex items-center gap-3">
                        <img src="${u.profile_pic || u.pic}" class="w-8 h-8 rounded-full bg-gray-800 object-cover border border-white/10">
                        <div>
                            <div class="text-xs font-bold ${nameColor} flex items-center gap-1">
                                ${u.username} ${iconBadge}
                            </div>
                            <div class="text-[9px] text-gray-500 font-mono">Role: ${u.role || 'Member'}</div>
                        </div>
                    </div>
                    <div class="flex gap-1 opacity-60 group-hover:opacity-100 transition">
                        <button onclick="openUserEditor('${k}')" class="w-6 h-6 rounded bg-cyan-900/30 text-cyan-400 flex items-center justify-center hover:bg-cyan-500 hover:text-black transition"><i class="fas fa-pen text-[10px]"></i></button>
                        <button onclick="kickUser('${k}')" class="w-6 h-6 rounded bg-red-900/30 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition"><i class="fas fa-trash text-[10px]"></i></button>
                    </div>
                </div>`; 
            }
        });

        if(count === 0) {
            c.innerHTML = `<div class="text-gray-600 text-center text-[10px] py-4">Tidak ada user kategori ini.</div>`;
        }
    }
}








window.openUploadModal = async (type) => { 
    const { value: method } = await Swal.fire({ 
        title: 'Pilih Metode Upload', 
        html: `<div class="grid grid-cols-2 gap-4">
                <div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-indigo-600" onclick="Swal.clickConfirm(); window.uploadMethod='url'">
                    <i class="fas fa-link text-2xl mb-2 text-white"></i><br>
                    <span class="text-sm text-white font-bold">Link URL</span>
                </div>
                <div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-green-600" onclick="Swal.clickConfirm(); window.uploadMethod='file'">
                    <i class="fas fa-cloud-upload-alt text-2xl mb-2 text-white"></i><br>
                    <span class="text-sm text-white font-bold">Upload File</span>
                </div>
               </div>`, 
        showConfirmButton: false, 
        background: '#1e293b', color: '#fff' 
    }); 
    
    const selectedMethod = window.uploadMethod; 
    if(!selectedMethod) return; 
    
    let finalUrl = ""; 
    
    if(selectedMethod === 'url') { 
        const {value:url} = await Swal.fire({
            input:'url', 
            inputLabel:'Link URL', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => { 
                const input = el.querySelector('input');
                if(input) input.focus();
            }
        }); 
        finalUrl = url; 
    } else { 
        const {value:file} = await Swal.fire({
            input:'file', 
            inputLabel:'Pilih Foto/Video', 
            inputAttributes: { accept: 'image/*,video/*' },
            background:'#1e293b', color:'#fff'
        }); 
        
        if(file) {
            Swal.fire({
                title: 'Mengupload ke Cloudinary...',
                text: 'Mohon tunggu sebentar',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
                background: '#1e293b', color: '#fff'
            });
            
            try {
                finalUrl = await uploadToCloudinary(file);
                Swal.close();
            } catch(e) {
                Swal.fire("Gagal", "Upload Error: " + e.message, "error");
                return;
            }
        }
    } 
    
    if(finalUrl) { 
        const {value:title} = await Swal.fire({
            title: 'Judul Postingan',
            input: 'text', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => {
                const i = el.querySelector('input');
                if(i) { i.focus(); i.removeAttribute('readonly'); }
            }
        }); 

        if(!title) return;

        const {value:desc} = await Swal.fire({
            title: 'Deskripsi',
            input: 'textarea', 
            background:'#1e293b', color:'#fff',
            didOpen: (el) => {
                const i = el.querySelector('textarea');
                if(i) i.focus();
            }
        }); 
        
        if(title) { 
            const d = {
                image: finalUrl, url: finalUrl, src: finalUrl, 
                title: title, description: desc || '-', 
                date: moment().format('DD MMM'), 
                category: 'User Upload', 
                timestamp: serverTimestamp()
            }; 
            
            if(finalUrl.includes('.mp4') || finalUrl.includes('.webm')) {
                 d.type = 'video';
            }

            if(type==='gallery') d.is_slide=false; 
            if(type==='playlist') { d.type='audio'; d.artist='User Upload'; } 
            
            push(ref(rtdb, `site_data/${type}`), d)
                .then(() => Swal.fire("Sukses","Tersimpan di Cloudinary & Firebase!","success"))
                .catch((e) => Swal.fire("Gagal Simpan DB", e.message, "error")); 
        } 
    } 
}








// --- FUNGSI KOMPRESI GAMBAR (Supaya Gak Error "Write too large") ---
const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            // Kita kecilkan ukuran gambar maksimal lebar 800px
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            
            // Jika gambar kecil, jangan dibesarkan
            if (scaleSize >= 1) {
                canvas.width = img.width;
                canvas.height = img.height;
            } else {
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
            }
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Ubah jadi JPEG kualitas 70% (Ringan banget)
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        }
        img.onerror = (err) => reject(err);
    }
    reader.onerror = (error) => reject(error);
});

window.kickUser = (uid) => { if(confirm("Hapus User?")) remove(ref(rtdb, `users/${uid}`)); }
window.devSendBroadcast = () => { const msg = document.getElementById('dev-broadcast-msg').value; if(msg) set(ref(rtdb, 'site_data/config/broadcast'), {message:msg, active:true, id:Date.now().toString()}); }
window.toggleAntiSSDB = () => { const el = document.getElementById('anti-ss-toggle'); set(ref(rtdb, 'site_data/config/anti_ss'), el.checked); }
window.saveContactDev = () => { const wa = document.getElementById('edit-dev-wa').value; const tk = document.getElementById('edit-dev-tk').value; update(ref(rtdb, 'site_data/config/contact'), {wa: wa, tiktok: tk}); Swal.fire("Tersimpan","Kontak diperbarui","success"); }
window.editProfile = async (type) => { 
    // 1. Pilih Metode: Link atau File
    const { value: method } = await Swal.fire({
        title: type === 'pic' ? 'Ganti Foto Profil' : 'Ganti Wallpaper',
        input: 'radio',
        inputOptions: {
            'file': '📁 Upload dari Galeri',
            'url': '🔗 Pakai Link URL'
        },
        inputValidator: (value) => {
            if (!value) {
                return 'Pilih salah satu metode!'
            }
        },
        background: '#1e293b', 
        color: '#fff'
    });

    if (!method) return; // Kalau batal, berhenti

    let finalUrl = "";

    // 2. Proses Berdasarkan Pilihan
    if (method === 'url') {
        // --- METODE LINK ---
        const { value: url } = await Swal.fire({
            input: 'url',
            inputLabel: 'Masukkan Link Gambar',
            inputPlaceholder: 'https://...',
            background: '#1e293b', color: '#fff'
        });
        finalUrl = url;
    } else {
        // --- METODE UPLOAD FILE ---
        const { value: file } = await Swal.fire({
            title: 'Pilih Gambar',
            input: 'file',
            inputAttributes: {
                'accept': 'image/*',
                'aria-label': 'Upload gambar profil'
            },
            background: '#1e293b', color: '#fff'
        });

        if (file) {
            // Cek ukuran file (Maksimal 2MB agar database tidak berat)
            if (file.size > 2 * 1024 * 1024) {
                Swal.fire("Terlalu Besar", "Maksimal ukuran file 2MB!", "error");
                return;
            }
            
            // Tampilkan loading saat memproses gambar
            Swal.fire({title: 'Memproses Gambar...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            try {
                finalUrl = await toBase64(file); // Konversi ke Base64
                Swal.close(); // Tutup loading
            } catch (e) {
                Swal.fire("Error", "Gagal memproses gambar", "error");
                return;
            }
        }
    }

    // 3. Simpan Hasil (Sinkronisasi)
    if (finalUrl) { 
        if (type === 'pic') { 
            // Update Database
            update(ref(rtdb, `users/${user.username}`), { profile_pic: finalUrl }); 
            
            // Update Data Lokal
            user.profile_pic = finalUrl; 
            user.pic = finalUrl; 
            localStorage.setItem('user', JSON.stringify(user)); 
            
            // Update Tampilan Langsung (Sinkron)
            const pAvatar = document.getElementById('p-avatar');
            const navAvatar = document.getElementById('nav-avatar');
            
            if(pAvatar) pAvatar.src = finalUrl;
            if(navAvatar) navAvatar.src = finalUrl;
            
            Swal.fire("Berhasil", "Foto Profil Diperbarui!", "success");
            
        } else { 
            // Update Wallpaper Chat
            update(ref(rtdb, `users/${user.username}`), { chat_bg: finalUrl }); 
            
            user.chat_bg = finalUrl; 
            localStorage.setItem('user', JSON.stringify(user)); 
            
            const chatBg = document.getElementById('chat-bg');
            if(chatBg) chatBg.style.backgroundImage = `url('${finalUrl}')`;
            
            Swal.fire("Berhasil", "Wallpaper Chat Diganti!", "success");
        } 
    } 
}







window.createGroup = async () => { const {value:n} = await Swal.fire({input:'text',inputLabel:'Nama Grup',background:'#1e293b',color:'#fff'}); if(n) { const id=`grp_${Date.now()}`; await set(ref(rtdb,`community/groups/${id}`),{name:n,createdBy:user.username}); Swal.fire("OK","","success"); } }
window.toggleMaintenance = (type) => { get(ref(rtdb, `site_data/maintenance/${type}`)).then(s => { set(ref(rtdb, `site_data/maintenance/${type}`), !s.val()); }); }
window.changeRank = async (uid) => { const { value: role } = await Swal.fire({ title: 'Pilih Rank', input: 'select', inputOptions: { 'member': 'Member', 'moderator': 'Moderator', 'admin': 'Admin', 'vip': 'VIP', 'banned': 'Tahanan' }, inputPlaceholder: 'Pilih Role', showCancelButton: true, background: '#1e293b', color: '#fff' }); if (role) { update(ref(rtdb, `users/${uid}`), { role: role, rank: role.toUpperCase() }); showGameToast("Rank Updated!", "success"); } }

// --- DETAIL MODAL & COMMENTS ---

window.openDetail = (item, collection) => { 
    curItem = item; 
    curCollection = collection; 
    
    document.getElementById('modal-media').innerHTML = item.image || item.url ? `<img src="${item.image||item.url}" class="max-h-[50vh] object-contain">` : ''; 
    document.getElementById('modal-title').innerText = item.title || "Tanpa Judul"; 
    document.getElementById('modal-desc').innerText = item.description || "-"; 
    document.getElementById('modal-date').innerText = item.date; 
    document.getElementById('modal-author-pic').src = item.author_pic || "https://ui-avatars.com/api/?name=Admin"; 
    
    if(item.id) loadComments(item.id); 
    document.getElementById('detail-modal').classList.remove('hidden'); 
}

window.toggleDesc = () => { const d = document.getElementById('modal-desc'); const b = document.getElementById('btn-read-more'); if(d.classList.contains('expanded')) { d.classList.remove('expanded'); d.classList.add('line-clamp-2'); b.innerText = "... lihat selengkapnya"; } else { d.classList.add('expanded'); d.classList.remove('line-clamp-2'); b.innerText = "sembunyikan"; } }
window.toggleCommentSection = () => { const c = document.getElementById('comment-section'); c.classList.toggle('hidden'); if(!c.classList.contains('hidden')) { setTimeout(() => document.getElementById('comment-input').focus(), 300); const cont = document.querySelector('#detail-modal .custom-scroll'); cont.scrollTop = cont.scrollHeight; } }
window.deleteContent = () => { if(confirm("Hapus Permanen?")) { remove(ref(rtdb, `${curCollection}/${curItem.id}`)); document.getElementById('detail-modal').classList.add('hidden'); Swal.fire("Terhapus","","success"); } }
window.toggleLike = () => { const k=`liked_${curItem.id}`; const r=ref(rtdb,`posts/${curItem.id}/likes`); if(localStorage.getItem(k)) { runTransaction(r,v=>(v||0)-1); localStorage.removeItem(k); document.getElementById('modal-heart').className="far fa-heart text-xl"; } else { runTransaction(r,v=>(v||0)+1); localStorage.setItem(k,'1'); document.getElementById('modal-heart').className="fas fa-heart text-red-500 text-xl like-active"; } }

// --- MODERN MUSIC PLAYER LOGIC (V2 - CYBERPUNK) ---

let musicInterval; // Variabel timer untuk progress bar

window.playMusic = (src, t, a, type) => { 
    const p = document.getElementById('sticky-player');
    
    // Render HTML Baru (Sesuai CSS Cyberpunk yang baru dipasang)
    p.innerHTML = `
        <div class="player-progress" id="music-progress"></div>
        
        <img src="https://cdn-icons-png.flaticon.com/512/3844/3844724.png" class="music-cover-spin">
        
        <div class="music-info">
            <div style="overflow:hidden; white-space:nowrap;">
                <div class="${t.length > 20 ? 'marquee' : ''} music-title">${t}</div>
            </div>
            <div class="music-artist">${a}</div>
        </div>
        
        <div class="visualizer playing">
            <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
        
        <button onclick="togglePlay()" class="btn-play-modern"><i id="sp-icon" class="fas fa-pause"></i></button>
        <button onclick="closePlayer()" class="btn-close-player"><i class="fas fa-times"></i></button>
        
        <audio id="audio-element" class="hidden"></audio> 
    `;
    
    p.classList.add('active'); 
    
    const aud = document.getElementById('audio-element');
    if(aud) {
        aud.src = src; 
        aud.play().catch(e => showGameToast("Gagal play: " + e.message, "error"));
        
        // Jalankan Animasi Progress Bar
        if(musicInterval) clearInterval(musicInterval);
        musicInterval = setInterval(() => {
            const prog = document.getElementById('music-progress');
            if(aud.duration && prog) {
                const pct = (aud.currentTime / aud.duration) * 100;
                prog.style.width = `${pct}%`;
            }
        }, 500);
    }
}

window.togglePlay = () => { 
    const a = document.getElementById('audio-element'); 
    const viz = document.querySelector('.visualizer');
    const cov = document.querySelector('.music-cover-spin');
    
    if(!a) return;

    if(a.paused) { 
        a.play(); 
        document.getElementById('sp-icon').className="fas fa-pause"; 
        if(viz) { viz.classList.remove('paused'); viz.classList.add('playing'); }
        if(cov) cov.classList.remove('paused');
    } else { 
        a.pause(); 
        document.getElementById('sp-icon').className="fas fa-play ml-1"; 
        if(viz) { viz.classList.remove('playing'); viz.classList.add('paused'); }
        if(cov) cov.classList.add('paused');
    } 
}

window.closePlayer = () => { 
    const a = document.getElementById('audio-element');
    if(a) a.pause(); 
    if(musicInterval) clearInterval(musicInterval); // Matikan timer biar hemat memori
    document.getElementById('sticky-player').classList.remove('active'); 
}
window.togglePlay = () => { const a=document.getElementById('audio-element'), viz = document.querySelector('.visualizer'), cov = document.querySelector('.music-cover-spin'); if(a.paused) { a.play(); document.getElementById('sp-icon').className="fas fa-pause"; if(viz) { viz.classList.remove('paused'); viz.classList.add('playing'); } if(cov) cov.classList.remove('paused'); } else { a.pause(); document.getElementById('sp-icon').className="fas fa-play"; if(viz) { viz.classList.remove('playing'); viz.classList.add('paused'); } if(cov) cov.classList.add('paused'); } }
window.closePlayer = () => { document.getElementById('audio-element').pause(); document.getElementById('sticky-player').classList.remove('active'); }






// --- NAVIGATION & UTILS (FULL UPDATE) ---
window.navigateTo = (p) => { 
    // Cek akses admin
    if(p === 'admin' && user.role !== 'developer') return Swal.fire("Access Denied", "Developer Only", "error"); 
    
    // 1. Sembunyikan semua halaman dulu
    document.querySelectorAll('.view-section').forEach(e => {
        e.classList.remove('active-view'); // Hapus efek muncul
        e.classList.add('hidden');         // Pastikan tersembunyi
        e.style.display = 'none';          // Paksa hilang
    });

    // 2. Munculkan halaman yang dipilih
    const target = document.getElementById('view-' + p);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block'; // Pastikan block agar render
        
        // Beri jeda sedikit agar animasi "fade-in" jalan halus
        setTimeout(() => {
            target.classList.add('active-view'); 
        }, 10);
    }

    // 3. Update Logika Halaman Profil (MODERN, STATS & FITUR DEV)
    if(p === 'profile') { 
        if(user.isGuest) { 
            document.getElementById('profile-guest-view').classList.remove('hidden'); 
            document.getElementById('profile-member-view').classList.add('hidden'); 
        } else { 
            document.getElementById('profile-guest-view').classList.add('hidden'); 
            document.getElementById('profile-member-view').classList.remove('hidden'); 
            
            // --- LOGIKA TAMPILAN KHUSUS (DEV / PREMIUM) ---
            const pAvatar = document.getElementById('p-avatar');
            const pName = document.getElementById('p-name');
            const pRank = document.getElementById('p-rank');
            const fallbackPic = `https://ui-avatars.com/api/?name=${user.username}&background=random`;

            pAvatar.src = user.profile_pic || user.pic || fallbackPic;
            pName.innerHTML = user.username;
            
            // Reset Class Dulu
            pAvatar.className = "w-32 h-32 rounded-full mx-auto object-cover mb-4 transition-all duration-500";

            // Cek Role & Tambah Efek
            if (user.role === 'developer') {
                pAvatar.classList.add('profile-glow-dev');
                pName.innerHTML = `${user.username} <i class="fas fa-bolt text-yellow-400 ml-1" title="Developer"></i>`;
                pRank.className = "px-4 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = "DEVELOPER";
            } else if (user.isPremium) {
                pAvatar.classList.add('profile-glow-premium');
                pName.innerHTML = `${user.username} <i class="fas fa-crown text-pink-500 ml-1" title="Premium"></i>`;
                pRank.className = "px-4 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = "VIP MEMBER";
            } else {
                // Member Biasa
                pAvatar.classList.add('border-4', 'border-[#1e293b]');
                pRank.className = "px-4 py-1 rounded-full bg-white/10 text-gray-400 border border-white/10 text-xs font-bold uppercase tracking-widest";
                pRank.innerText = user.role || "MEMBER";
            }

            // --- HITUNG TOTAL UPLOAD (Gallery + Playlist) ---
            let uploadCount = 0;
            const countUploads = async () => {
                let total = 0;
                try {
                    // Cek Galeri
                    const snapG = await get(ref(rtdb, 'site_data/gallery'));
                    if(snapG.exists()) {
                        Object.values(snapG.val()).forEach(v => { 
                            if(v.category === 'User Upload') total++; 
                        });
                    }
                    // Cek Musik
                    const snapP = await get(ref(rtdb, 'site_data/playlist'));
                    if(snapP.exists()) {
                        Object.values(snapP.val()).forEach(v => { if(v.artist === 'User Upload') total++; });
                    }
                } catch(e) {}
                return total;
            };

            // Render Statistik
            countUploads().then(total => {
                const statsContainer = document.getElementById('profile-stats-area') || document.createElement('div');
                statsContainer.id = 'profile-stats-area';
                statsContainer.className = "grid grid-cols-3 gap-3 mt-6 mb-6";
                statsContainer.innerHTML = `
                    <div class="stat-box">
                        <div class="text-lg font-black text-white">${total}</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">Uploads</div>
                    </div>
                    <div class="stat-box">
                        <div class="text-lg font-black text-blue-400" id="p-level-stat">...</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">Level</div>
                    </div>
                    <div class="stat-box">
                        <div class="text-lg font-black text-yellow-400" id="p-xp-stat">...</div>
                        <div class="text-[9px] text-gray-400 uppercase font-bold">XP</div>
                    </div>
                `;
                
                // Masukkan ke DOM jika belum ada (sisipkan setelah Rank)
                if(!document.getElementById('profile-stats-area')) {
                    pRank.parentNode.insertBefore(statsContainer, pRank.nextSibling);
                } else {
                    document.getElementById('profile-stats-area').innerHTML = statsContainer.innerHTML;
                }

                // Update Data User dari DB (Level & XP)
                onValue(ref(rtdb, `users/${user.username}`), s => {
                    const d = s.val();
                    if(d){
                        document.getElementById('p-level-stat').innerText = d.level || 1;
                        document.getElementById('p-xp-stat').innerText = d.coins || 0; 
                    }
                });
            });
            
            // --- TAMPILKAN TOMBOL KHUSUS DEVELOPER ---
            if(user.role === 'developer') {
                const adminPanel = document.getElementById('admin-panel-btn-container');
                adminPanel.classList.remove('hidden');
                
                // Tambahkan Tombol Ganti Background Login (Jika belum ada)
                if(!document.getElementById('btn-change-login-bg')) {
                    const btn = document.createElement('button');
                    btn.id = 'btn-change-login-bg';
                    btn.className = "w-full py-3 rounded-xl bg-pink-900/20 border border-pink-500/30 text-pink-400 font-bold text-xs hover:bg-pink-500 hover:text-white transition mt-2 flex items-center justify-center gap-2";
                    btn.innerHTML = '<i class="fas fa-image"></i> GANTI BACKGROUND LOGIN';
                    btn.onclick = changeLoginBackground; 
                    adminPanel.appendChild(btn);
                }
            }
        } 
    } 

    // 4. Update Tombol Navigasi Bawah (Biar nyala warnanya)
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active'); 
        const icon = b.querySelector('i');
        if(icon) icon.classList.remove('text-indigo-400');
    }); 
    
    const btn = document.getElementById('nav-' + p); 
    if(btn) {
        btn.classList.add('active'); 
        const icon = btn.querySelector('i');
        if(icon) icon.classList.add('text-indigo-400');
    } 
    
    window.scrollTo(0, 0); 
}
















window.sharePostLink = () => { if(!curItem) return; const link = `${window.location.origin}${window.location.pathname}?v=${curCollection}&id=${curItem.id}`; navigator.clipboard.writeText(link).then(() => Swal.fire({icon:'success',title:'Link Disalin!',timer:1500,showConfirmButton:false})); const refShare = ref(rtdb, `posts/${curItem.id}/shares`); runTransaction(refShare, (v) => (v || 0) + 1); }
window.checkDeepLink = async () => { const params = new URLSearchParams(window.location.search); const pId = params.get('id'); const pCol = params.get('v'); if (pId && pCol) { window.history.replaceState({}, document.title, window.location.pathname); try { const snap = await get(ref(rtdb, `${pCol}/${pId}`)); if (snap.exists()) { const item = {id: pId, ...snap.val()}; openDetail(item, pCol); } else { showGameToast("Postingan tidak ditemukan.", "error"); } } catch (e) { console.error(e); } } }

// --- INSTAGRAM COMMENT RENDERER ---
// GANTI FUNGSI loadComments
// --- GANTI FUNGSI loadComments ---
window.loadComments = (postId) => { 
    if(!postId) return;
    const list = document.getElementById('comments-list'); 
    
    list.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">Memuat komentar...</div>';

    const refComm = ref(rtdb, `interactions/comments/${postId}`); 
    onValue(refComm, (snap) => { 
        list.innerHTML = ''; 
        const data = snap.val(); 
        
        if (!data) { 
            list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-center opacity-50"><i class="far fa-comment text-4xl mb-2"></i><p class="text-xs">Belum ada komentar.</p></div>`; 
            document.getElementById('modal-comments-count').innerText = "0"; 
            return; 
        } 
        
        document.getElementById('modal-comments-count').innerText = Object.keys(data).length; 
        
        Object.values(data).forEach(c => { 
            const isMe = c.username === user.username; 
            const userPic = c.pic || `https://ui-avatars.com/api/?name=${c.username}&background=random`;
            const timeAgo = moment(c.timestamp).fromNow(true).replace("hours", "j").replace("minutes", "m").replace("days", "h"); 

            // LOGIKA CENTANG BIRU (KOMENTAR)
            let badgeHtml = '';
            if (c.role === 'developer' || c.username === 'Developer' || c.username === 'sigit123' || c.username === 'sigit mod') {
                badgeHtml = `<span class="badge-verified" title="Verified"><i class="fas fa-check"></i></span>`;
            }

            const delBtn = isMe || user.role === 'developer' 
                ? `<span onclick="delComment('${postId}','${c.id}')" class="ml-3 cursor-pointer hover:text-red-500 text-[10px]">Hapus</span>` 
                : ''; 

            const html = `
                <div class="comment-item group">
                    <img src="${userPic}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-username">${c.username} ${badgeHtml}</span>
                            <span class="comment-text">${c.text}</span>
                        </div>
                        <div class="comment-meta">
                            <span>${timeAgo}</span>
                            <span class="comment-reply-btn" onclick="document.getElementById('comment-input').value='@${c.username} '; document.getElementById('comment-input').focus();">Balas</span>
                            ${delBtn}
                        </div>
                    </div>
                    <div class="comment-like-btn hover:scale-110 transition">
                        <i class="far fa-heart"></i>
                    </div>
                </div>
            `; 
            list.innerHTML += html; 
        }); 
    }); 
}

// GANTI FUNGSI sendComment
window.sendComment = () => { 
    if(!curItem || !curItem.id) { Swal.fire("Error", "ID Postingan tidak valid.", "error"); return; } 
    const input = document.getElementById('comment-input'); 
    const txt = input.value.trim(); 
    if(!txt) return; 
    
    const finalUsername = user.username || user.name || "User"; 
    const cId = Date.now().toString(); 
    const path = `interactions/comments/${curItem.id}/${cId}`; 
    
    const data = { 
        id: cId, 
        text: txt, 
        username: finalUsername, 
        role: user.role || 'member', // SIMPAN ROLE
        pic: user.profile_pic || user.pic || "https://ui-avatars.com/api/?name=" + finalUsername, 
        timestamp: serverTimestamp() 
    }; 
    
    set(ref(rtdb, path), data).then(() => { 
        input.value = ''; 
        showGameToast("Terkirim", "success"); 
    }).catch((e) => { 
        Swal.fire("Gagal Kirim", e.message, "error"); 
    }); 
}

window.delComment = (pId, cId) => { if(confirm("Hapus komentar?")) { remove(ref(rtdb, `interactions/comments/${pId}/${cId}`)); } }
window.closeDetailModal = () => { document.getElementById('detail-modal').classList.add('hidden'); document.getElementById('modal-media').innerHTML = ''; }

// --- GOD MODE ---
function setupGodModeListeners() {
    onValue(ref(rtdb, 'site_data/god_mode/command'), s => {
        const cmd = s.val(); if(!cmd) return;
        if(user.role === 'developer') {
            const btnMap = {'matrix':'btn-matrix', 'glitch':'btn-glitch', 'darkness':'btn-darkness', 'freeze':'btn-freeze', 'bsod':'btn-bsod'};
            Object.values(btnMap).forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('btn-god-active'); });
            if(cmd.type !== 'clear' && btnMap[cmd.type]) { const el = document.getElementById(btnMap[cmd.type]); if(el) el.classList.add('btn-god-active'); }
            return; 
        }
        const now = Date.now(); const duration = (cmd.duration || 10) * 1000;
        if(now - cmd.ts > duration) {
            stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness');
            document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none';
            document.body.style.overflow = 'auto'; return;
        }
        if(cmd.type === 'matrix') startMatrixEffect();
        if(cmd.type === 'glitch') document.body.classList.add('god-effect-glitch');
        if(cmd.type === 'darkness') document.body.classList.add('god-effect-darkness');
        if(cmd.type === 'freeze') { document.getElementById('freeze-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'bsod') { document.getElementById('bsod-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'clear') { stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness'); document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }
        if(cmd.type === 'redirect' && cmd.url) window.location.href = cmd.url;
    });

    onValue(ref(rtdb, 'site_data/god_mode/voice'), s => { const msg = s.val(); if(msg && msg.text && msg.id !== sessionStorage.getItem('last_voice_id')) { sessionStorage.setItem('last_voice_id', msg.id); if(user.role === 'developer') return; try { const u = new SpeechSynthesisUtterance(msg.text); u.lang = 'id-ID'; u.rate = 0.9; window.speechSynthesis.speak(u); } catch(e) {} } });
    onValue(ref(rtdb, 'site_data/god_mode/lockdown'), s => { if(s.val() === true) { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.add('btn-god-active'); if(user.role !== 'developer') document.getElementById('lockdown-overlay').style.display = 'flex'; } else { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.remove('btn-god-active'); document.getElementById('lockdown-overlay').style.display = 'none'; } });
}

window.triggerGodEffect = (type) => { const dur = document.getElementById('god-duration').value || 10; set(ref(rtdb, 'site_data/god_mode/command'), {type: type, duration: parseInt(dur), ts: Date.now()}); showGameToast("Effect Broadcasted!", "success"); }
window.triggerLockdown = () => { get(ref(rtdb, 'site_data/god_mode/lockdown')).then(s => { const cur = s.val(); set(ref(rtdb, 'site_data/god_mode/lockdown'), !cur); showGameToast("Lockdown: " + (!cur), "warn"); }); }
window.sendVoiceOfGod = () => { const t = document.getElementById('god-msg-input').value; if(t) set(ref(rtdb, 'site_data/god_mode/voice'), {text: t, id: Date.now()}); }
window.triggerRedirect = () => { const u = document.getElementById('god-redirect-input').value; if(u) set(ref(rtdb, 'site_data/god_mode/command'), {type: 'redirect', url: u, ts: Date.now()}); }
window.banUser = () => { const u = document.getElementById('god-ban-input').value.trim(); if(u) { set(ref(rtdb, `site_data/banned_users/${u}`), true); showGameToast(u+" BANNED", "error"); } }
function checkBanStatus() { if(user && user.username) { onValue(ref(rtdb, `site_data/banned_users/${user.username}`), s => { if(s.val() === true) { document.body.innerHTML = ""; document.getElementById('banned-overlay').style.display = 'flex'; document.body.appendChild(document.getElementById('banned-overlay')); localStorage.setItem('is_banned', 'true'); } }); } }

let matrixInterval;
function startMatrixEffect() { const c = document.getElementById('god-layer-matrix'); const ctx = c.getContext('2d'); c.style.display = 'block'; c.width = window.innerWidth; c.height = window.innerHeight; const cols = Array(Math.floor(c.width/20)).fill(0); matrixInterval = setInterval(() => { ctx.fillStyle = '#0001'; ctx.fillRect(0,0,c.width,c.height); ctx.fillStyle = '#0f0'; ctx.font = '15pt monospace'; cols.forEach((y,i) => { const text = String.fromCharCode(Math.random()*128); ctx.fillText(text, i*20, y); cols[i] = y > 100 + Math.random()*10000 ? 0 : y + 20; }); }, 50); }
function stopMatrixEffect() { clearInterval(matrixInterval); document.getElementById('god-layer-matrix').style.display = 'none'; }

window.openTerminal = () => { document.getElementById('dev-terminal').classList.remove('hidden'); }
window.closeTerminal = () => { document.getElementById('dev-terminal').classList.add('hidden'); }
/* =========================================
   📟 GOD MODE TERMINAL (COMMAND PROCESSOR)
   ========================================= */

function logToTerm(msg, type = 'info') {
    const t = document.getElementById('term-output');
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // Styling canggih
    let colorClass = 'text-blue-300'; // Default
    if (type === 'success') colorClass = 'text-green-400 font-bold';
    else if (type === 'warn') colorClass = 'text-yellow-400';
    else if (type === 'error') colorClass = 'text-red-500 font-bold bg-red-900/20';
    else if (type.startsWith('text-')) colorClass = type; // Support custom class CSS

    const row = document.createElement('div');
    row.className = 'log-entry mb-1 break-words font-mono text-xs';
    row.innerHTML = `<span class="text-gray-600 mr-2">[${time}]</span><span class="${colorClass}">${msg}</span>`;
    
    t.appendChild(row);
    t.scrollTop = t.scrollHeight;
}

document.getElementById('term-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const input = e.target;
        const rawCmd = input.value.trim();
        if (!rawCmd) return;
        
        const args = rawCmd.split(' ');
        const cmd = args[0].toLowerCase();
        
        // Tampilkan perintah di layar
        logToTerm(`root@server:~$ ${rawCmd}`, 'text-gray-500');
        input.value = '';

        // --- 1. UTILS ---
        if (cmd === 'clear' || cmd === 'cls') {
            document.getElementById('term-output').innerHTML = '';
            return;
        }
        if (cmd === 'exit') {
            closeTerminal();
            return;
        }
        if (cmd === 'help') {
            logToTerm("COMMAND LIST:", 'warn');
            logToTerm("  db get <path>   : Intip Database", 'text-white');
            logToTerm("  op <user>       : Jadikan Admin/Dev", 'text-white');
            logToTerm("  rich <user>     : Kirim Koin Unlimited", 'text-white');
            logToTerm("  ban <user>      : Banned User", 'text-white');
            logToTerm("  matrix on/off   : Efek Hacker", 'text-white');
            logToTerm("  hack target     : Fake Hacking Animation", 'text-white');
            logToTerm("  exec <code>     : Jalankan JS Manual", 'text-white');
            return;
        }

        // --- 2. VISUAL EFFECTS ---
        if (cmd === 'matrix') {
            if (args[1] === 'on') { triggerGodEffect('matrix'); logToTerm("Matrix Loaded.", 'success'); }
            else { triggerGodEffect('clear'); logToTerm("Matrix Unloaded.", 'warn'); }
            return;
        }

        // --- 3. DATABASE VIEWER (Realtime) ---
        if (cmd === 'db' && args[1] === 'get') {
            const path = args[2];
            if (!path) return logToTerm("Path required! (ex: db get users)", 'error');
            try {
                logToTerm(`Reading: ${path}...`, 'warn');
                const snap = await get(ref(rtdb, path));
                if (snap.exists()) {
                    // Pretty Print JSON
                    logToTerm(JSON.stringify(snap.val(), null, 2), 'text-green-200 font-mono text-[10px] whitespace-pre');
                } else {
                    logToTerm("Data null / tidak ditemukan.", 'error');
                }
            } catch (err) { logToTerm(err.message, 'error'); }
            return;
        }

        // --- 4. USER MANAGEMENT ---
        if (cmd === 'op') {
            const target = args[1];
            if (target) {
                update(ref(rtdb, `users/${target}`), { role: 'developer', rank: 'GOD MODE' });
                logToTerm(`User ${target} is now DEVELOPER.`, 'success');
            } else logToTerm("Username needed.", 'error');
            return;
        }
        
        if (cmd === 'rich') {
            const target = args[1];
            if (target) {
                update(ref(rtdb, `users/${target}`), { coins: 9999999 });
                logToTerm(`Sent 9,999,999 coins to ${target}.`, 'success');
            } else logToTerm("Username needed.", 'error');
            return;
        }

        if (cmd === 'ban') {
            const target = args[1];
            if (target) {
                set(ref(rtdb, `site_data/banned_users/${target}`), true);
                logToTerm(`User ${target} has been BANNED permanently.`, 'error');
            } else logToTerm("Username needed.", 'error');
            return;
        }

        // --- 5. FAKE HACKING (Gaya-gayaan) ---
        if (cmd === 'hack') {
            let i = 0;
            const tasks = ["Bypassing Firewall...", "Injecting SQL...", "Dumping User Data...", "Decrypting Passwords...", "ACCESS GRANTED."];
            const timer = setInterval(() => {
                if (i >= tasks.length) { clearInterval(timer); return; }
                const color = i === tasks.length - 1 ? 'success' : 'text-green-500';
                logToTerm(tasks[i], color);
                i++;
            }, 600);
            return;
        }

        // --- 6. EXECUTE JAVASCRIPT (Dangerous) ---
        if (cmd === 'exec') {
            try {
                const code = rawCmd.replace('exec ', '');
                const res = eval(code);
                logToTerm(`Result: ${res}`, 'success');
            } catch (e) { logToTerm(e.message, 'error'); }
            return;
        }

        // Unknown
        logToTerm(`Command not found: ${cmd}`, 'error');
    }
});

function enableAntiSS() { document.getElementById('main-body').classList.add('no-select'); document.addEventListener('contextmenu', preventDefault); document.addEventListener('keydown', preventCapture); }
function disableAntiSS() { document.getElementById('main-body').classList.remove('no-select'); document.removeEventListener('contextmenu', preventDefault); document.removeEventListener('keydown', preventCapture); }
const preventDefault = e => e.preventDefault();
const preventCapture = e => { if (e.key === 'PrintScreen' || (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'Shift' || e.key === 'I'))) { e.preventDefault(); } };




// ==========================================
// 🐞 SISTEM DEBUG MANAJER V2 (MODERN)
// ==========================================
// Tempel ini di baris paling akhir script.js

const debugContainer = document.getElementById('debug-logs-container');
const MAX_LOGS = 300;
let currentFilter = 'ALL';

// Fungsi Nambah Log
function addLog(type, message, detail = '') {
    if (!debugContainer) return;

    const div = document.createElement('div');
    div.className = `log-item log-type-${type}`;
    // Tambahkan atribut data-type untuk filtering
    div.dataset.type = type; 
    
    // Logic Filter: Sembunyikan jika tidak sesuai filter aktif
    if (currentFilter !== 'ALL' && currentFilter !== type) {
        div.style.display = 'none';
    }

    const time = new Date().toLocaleTimeString().split(' ')[0];
    if (typeof message === 'object') { try { message = JSON.stringify(message, null, 2); } catch(e) { message = '[Object]'; } }

    div.innerHTML = `
        <div class="log-header">
            <span>${type}</span>
            <span>${time}</span>
        </div>
        <div class="log-content">${message}</div>
        ${detail ? `<div class="log-detail">${detail}</div>` : ''}
    `;

    // Auto Scroll jika user ada di bawah
    const isAtBottom = debugContainer.scrollHeight - debugContainer.scrollTop === debugContainer.clientHeight;
    debugContainer.appendChild(div);
    if (isAtBottom) debugContainer.scrollTop = debugContainer.scrollHeight;

    // Limit Logs
    if (debugContainer.childElementCount > MAX_LOGS) debugContainer.removeChild(debugContainer.firstChild);

    // Efek Visual Error di Tombol
    if (type === 'ERROR') {
        const btn = document.getElementById('debug-floating-btn');
        const badge = document.getElementById('debug-badge');
        if(btn) btn.classList.add('has-error-pulse');
        if(badge) badge.classList.remove('hidden');
    }
}

// Logic Filter Tab
window.filterLogs = (type) => {
    currentFilter = type;
    // Update UI Tombol
    document.querySelectorAll('.debug-tab').forEach(b => b.classList.remove('active'));
    if(type==='ALL') document.getElementById('tab-all').classList.add('active');
    else if(type==='LOG') document.getElementById('tab-log').classList.add('active');
    else if(type==='WARN') document.getElementById('tab-warn').classList.add('active');
    else if(type==='ERROR') document.getElementById('tab-error').classList.add('active');

    // Filter Elemen
    const logs = debugContainer.children;
    for (let log of logs) {
        if (type === 'ALL' || log.dataset.type === type) log.style.display = 'flex';
        else log.style.display = 'none';
    }
    // Auto scroll to bottom on filter change
    debugContainer.scrollTop = debugContainer.scrollHeight;
}

window.copyDebugLogs = () => {
    const text = debugContainer.innerText;
    navigator.clipboard.writeText(text).then(() => showGameToast("Log disalin!", "success"));
}

// Bajak Console
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) { originalLog(...args); if (isDev()) addLog('LOG', args.join(' ')); };
console.warn = function(...args) { originalWarn(...args); if (isDev()) addLog('WARN', args.join(' ')); };
console.error = function(...args) { originalError(...args); if (isDev()) addLog('ERROR', args.join(' ')); };

function isDev() {
    return user && (user.role === 'developer' || user.rank === 'GOD MODE' || user.username === 'sigit123');
}

document.addEventListener('click', (e) => {
    if (isDev()) {
        const target = e.target;
        const elName = target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ')[0]}` : '');
        addLog('ACTION', `Click: ${elName}`);
    }
}, true);

window.onerror = function(msg, url, lineNo) {
    if (isDev()) addLog('ERROR', 'CRASH', `${msg}\n@Line: ${lineNo}`);
    return false;
};

// UI Control (Fixed Hidden Logic)
window.toggleDebugPanel = () => {
    const panel = document.getElementById('debug-panel');
    const btn = document.getElementById('debug-floating-btn');
    const badge = document.getElementById('debug-badge');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        // Reset notifikasi error saat dibuka
        btn.classList.remove('has-error-pulse');
        badge.classList.add('hidden');
    } else {
        panel.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}
window.clearDebugLogs = () => { if(debugContainer) debugContainer.innerHTML = ''; addLog('SYSTEM', 'Log Cleared.'); }
window.execDebugCmd = (input) => {
    const cmd = input.value; addLog('SYSTEM', 'Exec:', cmd);
    try { const result = eval(cmd); addLog('LOG', 'Result:', result); } catch (e) { addLog('ERROR', 'Exec Failed:', e.message); }
    input.value = '';
}

// Auto Init
setInterval(() => {
    const btn = document.getElementById('debug-floating-btn');
    if (btn && isDev()) btn.classList.remove('hidden');
}, 2000);
setTimeout(() => { if(isDev()) { addLog('SYSTEM', 'Debug V2 Ready.'); document.getElementById('debug-floating-btn').classList.remove('hidden'); } }, 1000);








// --- GOD MODE: USER EDITOR LOGIC ---
let editingUserId = null;

window.openUserEditor = async (uid) => {
    try {
        const snap = await get(ref(rtdb, `users/${uid}`));
        if(!snap.exists()) return Swal.fire("Error", "User tidak ditemukan", "error");
        
        const data = snap.val();
        editingUserId = uid;
        
        // Isi Form dengan data target
        document.getElementById('edit-u-name').innerText = data.username;
        document.getElementById('edit-u-id').innerText = uid;
        document.getElementById('edit-u-pic').src = data.profile_pic || data.pic;
        
        document.getElementById('edit-u-role').value = data.role || 'member';
        document.getElementById('edit-u-level').value = data.level || 1;
        document.getElementById('edit-u-coins').value = data.coins || 0;
        document.getElementById('edit-u-pic-url').value = data.profile_pic || data.pic || "";
        
        // Tampilkan Modal
        document.getElementById('user-editor-modal').classList.remove('hidden');
        document.getElementById('user-editor-modal').classList.add('flex');
        
    } catch(e) {
        console.error(e);
    }
}

window.closeUserEditor = () => {
    document.getElementById('user-editor-modal').classList.add('hidden');
    document.getElementById('user-editor-modal').classList.remove('flex');
    editingUserId = null;
}

window.saveUserChanges = async () => {
    if(!editingUserId) return;
    
    const updates = {
        role: document.getElementById('edit-u-role').value,
        rank: document.getElementById('edit-u-role').value.toUpperCase(), // Sinkronkan Rank & Role
        level: parseInt(document.getElementById('edit-u-level').value) || 1,
        coins: parseInt(document.getElementById('edit-u-coins').value) || 0,
        profile_pic: document.getElementById('edit-u-pic-url').value
    };
    
    try {
        await update(ref(rtdb, `users/${editingUserId}`), updates);
        
        // Efek visual
        closeUserEditor();
        showGameToast(`Data ${document.getElementById('edit-u-name').innerText} berhasil diubah!`, "success");
        
        // Refresh list admin
        renderAdminUserList(true);
        
    } catch(e) {
        Swal.fire("Gagal", e.message, "error");
    }
}



// --- HELPER FUNGSI UNTUK INTERAKSI CHAT & PENGATURAN ---

// 1. Logika Buka/Tutup Settings (Fix Z-Index & Hidden)
window.toggleChatSettings = () => {
    const modal = document.getElementById('chat-settings-modal');
    if(modal) {
        if(modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    } else {
        console.error("Modal settings tidak ditemukan di DOM");
    }
}

// 2. Logika Like Pesan
window.toggleChatLike = (msgId) => {
    if(!msgId) return;
    const path = `community/messages/${curChatId}/${msgId}/likes/${user.username}`;
    get(ref(rtdb, path)).then(s => {
        if(s.exists()) {
            remove(ref(rtdb, path)); // Jika sudah like, hapus (Unlike)
        } else {
            set(ref(rtdb, path), true); // Jika belum, like
            if(navigator.vibrate) navigator.vibrate(30); // Getar sedikit
        }
    });
}

// 3. Logika Balas Pesan (Reply)
window.replyMsg = (username, text) => {
    // text sudah di-decode di HTML onclick, jadi aman
    replyingToMsg = { user: username, text: text };
    
    // Tampilkan UI Balas
    const ui = document.getElementById('reply-ui');
    if(ui) {
        ui.classList.remove('hidden');
        document.getElementById('reply-user').innerText = username;
        document.getElementById('reply-text').innerText = text;
    }
    
    // Buka Keyboard Otomatis
    const inp = document.getElementById('chat-input');
    if(inp) inp.focus();
}

// 4. Logika Salin Pesan (Copy)
window.actionCopy = (text) => {
    if(!text) return;
    navigator.clipboard.writeText(text)
        .then(() => showGameToast("Pesan disalin!", "success"))
        .catch(() => showGameToast("Gagal menyalin.", "error"));
}

// 5. Logika Hapus Pesan (Clear All) - Khusus Developer
window.clearCurrentChat = () => {
    if(!user || user.role !== 'developer') return;
    
    Swal.fire({
        title: 'Hapus Chat Room?',
        text: "Semua pesan akan hilang permanen!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus!',
        background: '#1e293b', color: '#fff',
        didOpen: () => { const c = Swal.getContainer(); if(c) c.style.zIndex = "200000"; }
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(rtdb, `community/messages/${curChatId}`))
            .then(() => showGameToast("Chat berhasil dibersihkan.", "success"));
        }
    });
}

// 2. Fungsi Buka Tutup Menu Settings
window.toggleChatSettings = () => {
    const modal = document.getElementById('chat-settings-modal');
    if(modal) modal.classList.toggle('hidden');
}

// 3. Fungsi Toggle Auto Scroll
window.toggleAutoScroll = () => {
    isAutoScroll = !isAutoScroll; // Balik nilai true/false
    
    // Reload chat agar UI tombol berubah (hijau/abu)
    loadChatMessages(curChatId);
    
    // Notifikasi
    if(isAutoScroll) {
        showGameToast("Auto Scroll: ON ✅", "success");
        // Langsung scroll ke bawah
        const c = document.getElementById('chat-messages');
        if(c) c.scrollTop = c.scrollHeight;
    } else {
        showGameToast("Auto Scroll: OFF ⛔", "info");
    }
}

// 4. Fungsi Search Chat
window.handleChatSearch = (el) => {
    chatSearchQuery = el.value.toLowerCase();
    loadChatMessages(curChatId); // Reload pesan dengan filter pencarian
}








window.toggleAutoScroll = () => {
    isAutoScroll = !isAutoScroll;
    const btn = document.getElementById('btn-toggle-scroll');
    if(isAutoScroll) {
        btn.classList.add('active');
        showGameToast("Auto Scroll: ON", "success");
        // Langsung scroll ke bawah saat dinyalakan
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
    } else {
        btn.classList.remove('active');
        showGameToast("Auto Scroll: OFF", "info");
    }
}

window.handleChatSearch = (el) => {
    chatSearchQuery = el.value.toLowerCase();
    loadChatMessages(curChatId); // Reload chat untuk filter
}





// --- VERSI FIX: HAPUS SATU PESAN (VISUAL INSTANT) ---
window.deleteMessage = (msgId, roomId) => {
    const targetRoom = roomId || curChatId;
    if(!msgId) return;

    Swal.fire({
        title: 'Hapus Pesan?',
        text: 'Pesan ini akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#1e293b', color: '#fff',
        didOpen: () => { const c = Swal.getContainer(); if(c) c.style.zIndex = "200000"; }
    }).then((result) => {
        if (result.isConfirmed) {
            // 1. HAPUS DULU DARI LAYAR (Supaya user tidak bingung kok masih ada)
            const el = document.getElementById(`msg-${msgId}`);
            if(el) {
                el.style.opacity = '0'; // Efek fade out
                setTimeout(() => el.remove(), 300); // Hapus setelah animasi
            }

            // 2. BARU HAPUS DARI DATABASE
            const msgRef = ref(rtdb, `community/messages/${targetRoom}/${msgId}`);
            remove(msgRef)
            .then(() => {
                showGameToast("Pesan dihapus.", "success");
            })
            .catch((error) => {
                console.error("Gagal hapus:", error);
                Swal.fire("Gagal", "Error: " + error.message, "error");
            });
        }
    });
}

// 2. Like Pesan (Fix Transaksi)
window.toggleChatLike = (msgId, roomId) => {
    const targetRoom = roomId || curChatId;
    if(!msgId) return;
    
    const likeRef = ref(rtdb, `community/messages/${targetRoom}/${msgId}/likes/${user.username}`);

    // Gunakan Transaksi agar tidak error saat rebutan
    runTransaction(likeRef, (currentData) => {
        if (currentData) {
            return null; // Kalau sudah ada, hapus (Unlike)
        } else {
            return true; // Kalau belum, simpan (Like)
        }
    }).then(() => {
        // Efek getar kalau sukses
        if(navigator.vibrate) navigator.vibrate(30);
    }).catch((err) => console.error("Like Error:", err));
}














// --- ADMIN DASHBOARD LOGIC (NEW) ---

// 1. Update Jam Realtime
setInterval(() => {
    const el = document.getElementById('admin-clock');
    if(el && !document.getElementById('view-admin').classList.contains('hidden')) {
        const now = new Date();
        el.innerText = now.toLocaleTimeString('en-GB'); // Format 24 Jam
    }
}, 1000);

// 2. Update Statistik (User, Chat, Online)
function updateAdminStats() {
    if(user.role !== 'developer') return;

    // Count Users
    get(ref(rtdb, 'users')).then(s => {
        document.getElementById('stat-total-users').innerText = s.exists() ? s.size : 0;
    });

    // Count Online
    onValue(ref(rtdb, 'status/online'), s => {
        document.getElementById('stat-online-users').innerText = s.exists() ? s.size : 0;
        document.getElementById('online-count').innerText = s.exists() ? s.size : '...';
    });

    // Count Total Chat (Global)
    get(ref(rtdb, 'community/messages/global')).then(s => {
        document.getElementById('stat-total-chats').innerText = s.exists() ? s.size : 0;
    });
}

// --- FITUR DEWA (ADVANCED OPS) ---

// 1. GARBAGE COLLECTOR (Hapus Chat Lama)
window.runGarbageCollector = async () => {
    if(!user || user.role !== 'developer') return;
    const days = parseInt(document.getElementById('gc-limit').value);
    if(!confirm(`Hapus semua pesan yang lebih tua dari ${days} hari?`)) return;
    
    showGameToast("Sedang membersihkan...", "info");
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Ambil semua pesan
    const snap = await get(ref(rtdb, 'community/messages'));
    if(snap.exists()) {
        const updates = {};
        let count = 0;
        
        // Loop semua room
        Object.entries(snap.val()).forEach(([roomId, msgs]) => {
            Object.entries(msgs).forEach(([msgId, msg]) => {
                if(msg.timestamp < cutoff) {
                    updates[`community/messages/${roomId}/${msgId}`] = null; // Hapus
                    count++;
                }
            });
        });
        
        if(count > 0) {
            await update(ref(rtdb), updates);
            showGameToast(`Berhasil menghapus ${count} pesan sampah!`, "success");
        } else {
            showGameToast("Tidak ada pesan sampah.", "info");
        }
    }
}

// 2. BACKUP & RESTORE
window.backupDatabase = () => {
    if(!user || user.role !== 'developer') return;
    showGameToast("Membuat Backup...", "info");
    get(ref(rtdb)).then(snap => {
        const data = JSON.stringify(snap.val(), null, 2);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PORTAL_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        showGameToast("Backup didownload!", "success");
    });
}

window.restoreDatabase = (input) => {
    if(!user || user.role !== 'developer') return;
    const file = input.files[0];
    if(!file) return;
    
    if(confirm("PERINGATAN: Ini akan MENIMPA seluruh database saat ini. Lanjutkan?")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                set(ref(rtdb), data)
                    .then(() => showGameToast("Database Berhasil Direstore!", "success"))
                    .catch(err => Swal.fire("Error", err.message, "error"));
            } catch(e) {
                Swal.fire("Error", "File Backup Rusak/Salah Format", "error");
            }
        };
        reader.readAsText(file);
    }
}

// 3. AUTO LOCKDOWN SCHEDULER
window.setLockdownSchedule = () => {
    const time = document.getElementById('lockdown-start').value;
    if(!time) return;
    const ts = new Date(time).getTime();
    
    set(ref(rtdb, 'site_data/config/lockdown_schedule'), { start: ts, active: true });
    showGameToast("Jadwal Lockdown Disimpan!", "success");
}

window.cancelLockdownSchedule = () => {
    remove(ref(rtdb, 'site_data/config/lockdown_schedule'));
    showGameToast("Jadwal Dibatalkan.", "info");
}

// Listener Jadwal (Otomatis Jalan di Semua Client)
function checkSchedule() {
    onValue(ref(rtdb, 'site_data/config/lockdown_schedule'), s => {
        const d = s.val();
        if(d && d.active) {
            const now = Date.now();
            const status = document.getElementById('timer-status');
            if(status) status.innerText = `SET: ${moment(d.start).format('DD/MM HH:mm')}`;
            
            // Jika waktu sudah lewat, aktifkan Lockdown
            if(now >= d.start) {
                // Cek dulu apakah sudah lockdown biar gak spam
                get(ref(rtdb, 'site_data/maintenance/all')).then(m => {
                    if(!m.val()) {
                         set(ref(rtdb, 'site_data/maintenance/all'), true);
                         // Matikan jadwal setelah dieksekusi
                         update(ref(rtdb, 'site_data/config/lockdown_schedule'), { active: false });
                    }
                });
            }
        } else {
            const status = document.getElementById('timer-status');
            if(status) status.innerText = "INACTIVE";
        }
    });
}

// 4. IP FIREWALL MANAGER (BLOKIR PERMANEN)
window.blockIP = () => {
    const ip = document.getElementById('firewall-ip').value.trim();
    if(!ip) return;
    
    // Ganti titik dengan garis bawah karena Firebase key gak boleh ada titik
    const safeIp = ip.replace(/\./g, '_');
    
    const data = {
        ip: ip,
        blocked_by: user.username,
        date: new Date().toLocaleString(),
        timestamp: serverTimestamp()
    };
    
    set(ref(rtdb, `site_data/firewall/${safeIp}`), data);
    document.getElementById('firewall-ip').value = '';
    showGameToast(`${ip} DIBLOKIR PERMANEN!`, "error");
}

window.unblockIP = (safeIp) => {
    if(confirm("Buka blokir IP ini?")) {
        remove(ref(rtdb, `site_data/firewall/${safeIp}`));
        showGameToast("Blokir dibuka.", "success");
    }
}

function renderFirewallList() {
    const list = document.getElementById('firewall-list');
    onValue(ref(rtdb, 'site_data/firewall'), s => {
        list.innerHTML = '';
        const d = s.val();
        if(d) {
            Object.entries(d).forEach(([key, val]) => {
                list.innerHTML += `
                <div class="flex justify-between items-center bg-red-900/20 p-1 px-2 rounded border border-red-500/30">
                    <div>
                        <div class="text-[10px] font-mono text-red-400 font-bold">${val.ip}</div>
                        <div class="text-[8px] text-gray-500">${val.date}</div>
                    </div>
                    <button onclick="unblockIP('${key}')" class="text-xs text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>`;
            });
        } else {
            list.innerHTML = '<div class="text-[9px] text-gray-600 text-center italic">Aman. Tidak ada blokir.</div>';
        }
    });
}




window.changeLoginBackground = async () => {
    if(!user || user.role !== 'developer') return;

    const { value: confirmValue } = await Swal.fire({
        title: 'Pilih Sumber Gambar',
        html: `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition" onclick="Swal.clickConfirm(); window.loginBgSource='file'">
                    <i class="fas fa-upload text-2xl mb-2 text-white/80"></i><br>
                    <span class="text-sm text-white font-bold">Upload File</span>
                </div>
                <div class="bg-black/20 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition" onclick="Swal.clickConfirm(); window.loginBgSource='url'">
                    <i class="fas fa-link text-2xl mb-2 text-white/80"></i><br>
                    <span class="text-sm text-white font-bold">Link URL</span>
                </div>
            </div>`,
        showConfirmButton: false, 
        background: '#1e293b', color: '#fff',
        preConfirm: () => { return window.loginBgSource; }
    });

    const selectedMethod = window.loginBgSource;
    if(!selectedMethod) return;

    let finalUrl = '';
    
    if(selectedMethod === 'url') {
        const { value: url } = await Swal.fire({input:'url', inputLabel:'Masukkan URL Gambar', background:'#1e293b', color:'#fff'});
        finalUrl = url;
    } else if(selectedMethod === 'file') {
        const { value: file } = await Swal.fire({input:'file', inputAttributes: {accept:'image/*'}, background:'#1e293b', color:'#fff'});
        if(file) {
            Swal.fire({title:'Mengupload & Mengompres...', didOpen:()=>Swal.showLoading(), background:'#1e293b', color:'#fff'});
            finalUrl = await compressImage(file); 
            Swal.close();
        }
    }

    if(finalUrl) {
        // PERBAIKAN: Update DOM secara lokal sebelum ke Firebase
        const bgEl = document.getElementById('dynamic-login-bg');
        if(bgEl) bgEl.style.backgroundImage = `url('${finalUrl}')`;

        update(ref(rtdb, 'site_data/config'), { login_bg: finalUrl })
        .then(() => showGameToast("Background Login Berhasil Diganti!", "success"));
    }
}

// Helper Toggle Password
window.togglePass = (id) => {
    const el = document.getElementById(id);
    if(el.type === 'password') el.type = 'text';
    else el.type = 'password';
}







// =========================================
// 🎵 LOGIKA AUDIO PLAYER (WHATSAPP STYLE)
// =========================================

window.playAudio = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    // Matikan audio lain yang sedang nyala (Biar gak berisik)
    document.querySelectorAll('audio').forEach(a => {
        if(a.id !== `aud-${id}`) {
            a.pause();
            a.currentTime = 0; // Reset
            // Reset icon audio lain
            const otherId = a.id.replace('aud-', '');
            const otherIcon = document.getElementById(`icon-${otherId}`);
            if(otherIcon) otherIcon.className = "fas fa-play text-xs";
        }
    });

    if (audio.paused) {
        audio.play();
        icon.className = "fas fa-pause text-xs";
    } else {
        audio.pause();
        icon.className = "fas fa-play text-xs";
    }
};

window.updateAudioUI = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    const time = document.getElementById(`time-${id}`);
    
    if (audio.duration) {
        // Update Slider
        const percent = (audio.currentTime / audio.duration) * 100;
        seek.value = percent;
        
        // Update Waktu (0:00)
        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60);
        time.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
};

window.seekAudio = (id, val) => {
    const audio = document.getElementById(`aud-${id}`);
    if (audio.duration) {
        const seekTime = (val / 100) * audio.duration;
        audio.currentTime = seekTime;
    }
};

window.resetAudioUI = (id) => {
    document.getElementById(`icon-${id}`).className = "fas fa-play text-xs";
    document.getElementById(`seek-${id}`).value = 0;
    document.getElementById(`time-${id}`).innerText = "0:00";
};





// =========================================
// 🎵 SMART AUDIO CONTROLLER (OTAK PLAYER)
// =========================================

// 1. Ganti Kecepatan (1x -> 1.5x -> 2x)
window.changeSpeed = (id, btn) => {
    const audio = document.getElementById(`aud-${id}`);
    let current = parseFloat(btn.innerText.replace('x', ''));
    
    // Siklus: 1x -> 1.5x -> 2x -> 1x
    let nextSpeed = current === 1 ? 1.5 : (current === 1.5 ? 2 : 1);
    
    if(audio) {
        audio.playbackRate = nextSpeed;
        btn.innerText = nextSpeed + "x";
        // Warna indikator: Hijau kalau cepat, Abu kalau normal
        btn.style.color = nextSpeed === 1 ? "#cbd5e1" : "#34d399"; 
    }
};

// 2. Play/Pause Logika
window.playAudio = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    const wave = document.getElementById(`wave-${id}`);

    if(!audio) return;

    // Matikan audio lain yang sedang nyala (Biar gak berisik tabrakan)
    document.querySelectorAll('audio').forEach(a => {
        if(a.id !== `aud-${id}` && !a.paused) {
            a.pause();
            // Reset tampilan audio lain
            const oid = a.id.replace('aud-', '');
            const oIcon = document.getElementById(`icon-${oid}`);
            const oWave = document.getElementById(`wave-${oid}`);
            if(oIcon) oIcon.className = "fas fa-play text-xs";
            if(oWave) oWave.classList.remove('playing');
        }
    });

    if (audio.paused) {
        audio.play();
        icon.className = "fas fa-pause text-xs";
        if(wave) wave.classList.add('playing');
    } else {
        audio.pause();
        icon.className = "fas fa-play text-xs";
        if(wave) wave.classList.remove('playing');
    }
};

// 3. Update Garis Slider saat lagu jalan
window.updateAudioUI = (id) => {
    const audio = document.getElementById(`aud-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    if (audio && audio.duration) {
        seek.value = (audio.currentTime / audio.duration) * 100;
    }
};

// 4. User Geser Slider
window.seekAudio = (id, val) => {
    const audio = document.getElementById(`aud-${id}`);
    if (audio && audio.duration) {
        audio.currentTime = (val / 100) * audio.duration;
    }
};

// 5. FITUR AUTO-NEXT (Sambung Menyambung - FIXED)
window.handleAudioEnd = (id) => {
    // Reset UI Audio yang baru selesai
    const icon = document.getElementById(`icon-${id}`);
    const seek = document.getElementById(`seek-${id}`);
    const wave = document.getElementById(`wave-${id}`);
    
    if(icon) icon.className = "fas fa-play text-xs";
    if(seek) seek.value = 0;
    if(wave) wave.classList.remove('playing');

    // Cari Audio Berikutnya di dalam Chat
    const allAudios = Array.from(document.querySelectorAll('#chat-messages audio'));
    const currentIdx = allAudios.findIndex(a => a.id === `aud-${id}`);
    
    // Jika ditemukan dan masih ada audio selanjutnya
    if (currentIdx !== -1 && currentIdx + 1 < allAudios.length) {
        const nextAudio = allAudios[currentIdx + 1];
        const nextId = nextAudio.id.replace('aud-', '');
        
        // Scroll halus ke audio berikutnya
        const nextPlayer = document.getElementById(`player-${nextId}`);
        if(nextPlayer) nextPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Play otomatis (Kasih jeda dikit biar mulus)
        setTimeout(() => {
            playAudio(nextId);
            if(typeof showGameToast === 'function') showGameToast("Memutar selanjutnya... ⏩", "info");
        }, 500);
    }
};



// =========================================
// 🗑️ FITUR BATCH DELETE (HAPUS BANYAK)
// =========================================

// 1. Masuk Mode Seleksi (Pemicu)
window.enterSelectionMode = (firstId) => {
    isSelectionMode = true;
    selectedMsgIds.clear();
    
    // Sembunyikan Menu Opsi Lama
    closeMsgOptions();
    
    // Tampilkan Toolbar Hapus
    document.getElementById('bulk-action-bar').classList.add('active');
    document.getElementById('chat-input').parentElement.style.display = 'none'; // Sembunyikan input chat
    
    // Pilih pesan pertama otomatis
    toggleSelectMessage(firstId);
    showGameToast("Mode Hapus: Klik chat lain untuk memilih", "info");
};

// 2. Keluar Mode Seleksi
window.exitSelectionMode = () => {
    isSelectionMode = false;
    selectedMsgIds.clear();
    
    // Reset Tampilan
    document.getElementById('bulk-action-bar').classList.remove('active');
    document.getElementById('chat-input').parentElement.style.display = 'flex'; // Munculkan input chat
    
    // Hapus kelas .selected-msg dari semua elemen
    document.querySelectorAll('.selected-msg').forEach(el => el.classList.remove('selected-msg'));
};

// 3. Logika Centang/Hapus Centang
window.toggleSelectMessage = (id) => {
    if (!isSelectionMode) return;

    const card = document.querySelector(`#msg-${id} .chat-card`);
    if (!card) return;

    if (selectedMsgIds.has(id)) {
        // Unselect
        selectedMsgIds.delete(id);
        card.classList.remove('selected-msg');
    } else {
        // Select
        selectedMsgIds.add(id);
        card.classList.add('selected-msg');
    }
    
    // Update Angka Counter
    document.getElementById('select-count').innerText = selectedMsgIds.size;
    
    // Kalau kosong, keluar mode seleksi otomatis
    if (selectedMsgIds.size === 0) exitSelectionMode();
};

// --- VERSI FINAL FIX: HAPUS PESAN DENGAN DEBUGGING PATH ---
window.deleteBulkMessages = () => {
    if (selectedMsgIds.size === 0) return;
    
    // Ambil ID Chat Room yang aktif saat ini
    // Jika kosong, paksa jadi 'global' (karena defaultnya global)
    const currentRoom = curChatId || 'global'; 

    Swal.fire({
        title: `Hapus ${selectedMsgIds.size} Pesan?`,
        text: `Menghapus dari room: ${currentRoom}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'YA, HAPUS',
        background: '#1e293b', color: '#fff'
    }).then(async (res) => {
        if (res.isConfirmed) {
            Swal.showLoading();

            const idsArray = Array.from(selectedMsgIds);
            const deletePromises = [];

            // --- DEBUGGING: LIHAT DI CONSOLE BROWSER ---
            console.log("=== MULAI PROSES HAPUS ===");
            console.log("Room ID:", currentRoom);

            idsArray.forEach(id => {
                // PERBAIKAN ALAMAT (PATH):
                // Pastikan path-nya sama persis dengan struktur di Tab 'Data' Firebase Anda
                const exactPath = `community/messages/${currentRoom}/${id}`;
                
                console.log("Menghapus Path:", exactPath); // Cek ini di Console!

                // Hapus dari Server
                deletePromises.push(remove(ref(rtdb, exactPath)));
            });

            try {
                // Tunggu sampai server bilang "OK"
                await Promise.all(deletePromises);

                // Hapus dari Layar HP
                idsArray.forEach(id => {
                    const el = document.getElementById(`msg-${id}`);
                    if(el) el.remove();
                });

                exitSelectionMode();

                Swal.fire({
                    icon: 'success', 
                    title: 'BERHASIL!', 
                    text: 'Pesan sudah hilang dari server.',
                    timer: 1500, 
                    showConfirmButton: false,
                    background: '#1e293b', color: '#fff'
                });

            } catch (error) {
                console.error("GAGAL HAPUS:", error);
                Swal.fire("Gagal", "Server Error: " + error.message, "error");
            }
        }
    });
};


// --- LOGIKA LONG PRESS (TEKAN TAHAN) ---
window.startPress = (id) => {
    // Jika sudah dalam mode seleksi, abaikan long press (biar jadi klik biasa untuk select/unselect)
    if (isSelectionMode) return;

    // Mulai hitung waktu 800ms (0.8 detik)
    pressTimer = setTimeout(() => {
        // Jika user menahan selama 0.8 detik, masuk mode seleksi
        enterSelectionMode(id);
        // Getar dikit biar kerasa (Haptic Feedback)
        if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
}

window.cancelPress = () => {
    // Jika jari diangkat sebelum 0.8 detik, batalkan timer
    clearTimeout(pressTimer);
}

// Modifikasi fungsi klik agar pintar membedakan situasi
window.handleMessageClick = (id) => {
    // Jika sedang mode seleksi, fungsi klik bertugas memilih/batal pilih pesan
    if (isSelectionMode) {
        toggleSelectMessage(id);
    }
    // Jika TIDAK mode seleksi, klik biasa tidak melakukan apa-apa (atau bisa dipakai untuk zoom gambar)
}










// =========================================
// 🛠️ GOD MODE ULTIMATE LOGIC
// =========================================

// 1. LIVE CSS INJECTOR
window.applyLiveCSS = () => {
    const css = document.getElementById('live-css-input').value;
    set(ref(rtdb, 'site_data/config/live_css'), css);
    showGameToast("Live CSS Applied!", "success");
};
window.clearLiveCSS = () => {
    set(ref(rtdb, 'site_data/config/live_css'), "");
    showGameToast("CSS Reset.", "info");
};

// 2. GLOBAL COMMANDS (RELOAD / WIPE)
window.triggerGlobalAction = (type) => {
    if(!confirm(`Yakin eksekusi GLOBAL ${type.toUpperCase()}? Semua user akan terkena efek!`)) return;
    set(ref(rtdb, 'site_data/admin_commands'), {
        type: type,
        timestamp: serverTimestamp()
    });
    showGameToast(`Perintah ${type} dikirim!`, "success");
};

// 3. WHITELIST IP SYSTEM
window.toggleWhitelistMode = () => {
    const isActive = document.getElementById('toggle-whitelist').checked;
    update(ref(rtdb, 'site_data/config/whitelist'), { active: isActive });
    showGameToast(`Whitelist Mode: ${isActive ? 'ON' : 'OFF'}`, isActive ? "success" : "info");
};

window.addWhitelistIP = () => {
    const ip = document.getElementById('whitelist-ip-input').value.trim();
    if(!ip) return;
    push(ref(rtdb, 'site_data/config/whitelist/ips'), ip);
    document.getElementById('whitelist-ip-input').value = '';
};

window.removeWhitelistIP = (key) => {
    remove(ref(rtdb, `site_data/config/whitelist/ips/${key}`));
};

function renderWhitelistUI(config) {
    const list = document.getElementById('whitelist-list');
    const toggle = document.getElementById('toggle-whitelist');
    if(!list || !toggle) return;

    toggle.checked = config ? config.active : false;
    list.innerHTML = '';

    if(config && config.ips) {
        Object.entries(config.ips).forEach(([key, ip]) => {
            list.innerHTML += `
                <div class="whitelist-tag">
                    <span class="whitelist-ip">${ip}</span>
                    <button onclick="removeWhitelistIP('${key}')" class="text-red-400 hover:text-white"><i class="fas fa-times text-[8px]"></i></button>
                </div>
            `;
        });
    } else {
        list.innerHTML = '<div class="text-[9px] text-gray-600 text-center">List Kosong</div>';
    }
}

// 4. REGISTRATION GATE
window.toggleRegGate = () => {
    const isOpen = document.getElementById('toggle-reg-gate').checked;
    set(ref(rtdb, 'site_data/config/registration_open'), isOpen);
    showGameToast(`Registrasi: ${isOpen ? 'OPEN' : 'CLOSED'}`, "info");
};

// 5. IP DETECTIVE (CLONE CHECKER SUPER BAGUS)
window.scanForClones = async () => {
    const container = document.getElementById('clone-result-area');
    container.innerHTML = '<div class="col-span-full text-center text-indigo-400 animate-pulse text-xs font-bold">Menganalisa Database...</div>';

    try {
        const snap = await get(ref(rtdb, 'users'));
        if(!snap.exists()) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500">Tidak ada user.</div>';
            return;
        }

        const users = snap.val();
        const ipMap = {};

        // Grouping User by IP
        Object.values(users).forEach(u => {
            if(u.ip) {
                if(!ipMap[u.ip]) ipMap[u.ip] = [];
                ipMap[u.ip].push(u);
            }
        });

        // Filter hanya yang punya clone (> 1 akun per IP)
        const clones = Object.entries(ipMap).filter(([ip, list]) => list.length > 1);

        container.innerHTML = '';
        
        if(clones.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center text-green-500 py-4">
                    <i class="fas fa-check-circle text-3xl mb-2"></i>
                    <p class="text-xs font-bold">Bersih! Tidak ditemukan akun ganda.</p>
                </div>
            `;
            return;
        }

        // Render Hasil Keren
        clones.forEach(([ip, list]) => {
            let userHtml = '';
            list.forEach(u => {
                userHtml += `
                    <div class="clone-user-item">
                        <img src="${u.profile_pic || u.pic}" class="clone-user-img">
                        <span class="clone-user-name">${u.username}</span>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="clone-card">
                    <div class="clone-header">
                        <span>IP: ${ip}</span>
                        <span class="bg-red-500/20 text-red-400 px-1.5 rounded text-[9px] font-bold">${list.length} AKUN</span>
                    </div>
                    <div class="clone-users">
                        ${userHtml}
                    </div>
                    <button onclick="blockIPFromClone('${ip}')" class="mt-1 w-full py-1 bg-red-900/30 border border-red-500/30 text-red-400 text-[9px] hover:bg-red-600 hover:text-white rounded transition">BLOCK IP INI</button>
                </div>
            `;
        });

    } catch(e) {
        container.innerHTML = `<div class="text-red-500 text-xs">Error: ${e.message}</div>`;
    }
};

window.blockIPFromClone = (ip) => {
    if(confirm(`Blokir permanen IP ${ip}? Semua akun di IP ini akan kehilangan akses.`)) {
        const safeIp = ip.replace(/\./g, '_');
        set(ref(rtdb, `site_data/firewall/${safeIp}`), {
            ip: ip, blocked_by: 'IP Detective', date: new Date().toLocaleString()
        });
        showGameToast("IP Diblokir!", "error");
    }
};





// =========================================
// 🕵️‍♂️ HACKER TAKEOVER LOGIC
// =========================================

window.launchTakeover = () => {
    const htmlCode = document.getElementById('takeover-input').value;
    const duration = parseInt(document.getElementById('takeover-duration').value) || 10; // Default 10 detik

    if (!htmlCode) return Swal.fire("Kosong", "Isi dulu kode HTML-nya!", "warning");

    if (confirm(`Ambil alih layar semua user selama ${duration} detik?`)) {
        set(ref(rtdb, 'site_data/god_mode/takeover'), {
            active: true,
            html: htmlCode,
            duration: duration,
            startTime: serverTimestamp()
        });
        
        // Tampilkan Timer Mundur di Toast Admin
        let timer = duration;
        const interval = setInterval(() => {
            showGameToast(`Takeover Active: ${timer}s`, "info");
            timer--;
            if(timer < 0) clearInterval(interval);
        }, 1000);
    }
};

window.stopTakeoverForce = () => {
    set(ref(rtdb, 'site_data/god_mode/takeover'), { active: false });
    showGameToast("Takeover Dihentikan Paksa.", "error");
};








// =========================================
// 🕵️‍♂️ HACKER TAKEOVER V3 (MULTI-FILE SUPPORT)
// =========================================

let activeTakeoverTab = 'html';

window.switchTakeoverTab = (tab) => {
    activeTakeoverTab = tab;
    
    // Sembunyikan semua textarea
    ['html', 'css', 'js'].forEach(t => {
        document.getElementById(`takeover-input-${t}`).classList.add('hidden');
        document.getElementById(`tab-to-${t}`).style.borderColor = 'transparent';
        document.getElementById(`tab-to-${t}`).style.opacity = '0.5';
    });

    // Tampilkan yang aktif
    document.getElementById(`takeover-input-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-to-${tab}`);
    activeBtn.style.opacity = '1';
    
    if(tab === 'html') activeBtn.style.borderBottomColor = '#f97316'; // Orange
    if(tab === 'css') activeBtn.style.borderBottomColor = '#60a5fa'; // Blue
    if(tab === 'js') activeBtn.style.borderBottomColor = '#facc15'; // Yellow
};

window.handleTakeoverFileUpload = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        
        // Deteksi Tipe File Otomatis
        if (file.name.endsWith('.html') || file.name.endsWith('.txt')) {
            document.getElementById('takeover-input-html').value = content;
            switchTakeoverTab('html');
            showGameToast("File HTML Dimuat!", "success");
        } else if (file.name.endsWith('.css')) {
            document.getElementById('takeover-input-css').value = content;
            switchTakeoverTab('css');
            showGameToast("File CSS Dimuat!", "success");
        } else if (file.name.endsWith('.js')) {
            document.getElementById('takeover-input-js').value = content;
            switchTakeoverTab('js');
            showGameToast("File JS Dimuat!", "success");
        } else {
            Swal.fire("Format Salah", "Hanya support .html, .css, .js, .txt", "error");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input biar bisa upload file sama lagi
};

window.launchAdvancedTakeover = () => {
    const html = document.getElementById('takeover-input-html').value;
    const css = document.getElementById('takeover-input-css').value;
    const js = document.getElementById('takeover-input-js').value;
    const duration = parseInt(document.getElementById('takeover-duration').value) || 10;

    if (!html && !js) return Swal.fire("Kosong", "Isi minimal HTML atau JS!", "warning");

    if (confirm(`Broadcast tampilan ini ke semua user selama ${duration} detik?`)) {
        // Kita gunakan path baru 'takeover_v3' agar tidak bentrok dengan kode lama
        set(ref(rtdb, 'site_data/god_mode/takeover_v3'), {
            active: true,
            html: html,
            css: css,
            js: js,
            duration: duration,
            startTime: serverTimestamp()
        });
        
        showGameToast(`Takeover V3 Started (${duration}s)`, "success");
    }
};

window.stopTakeoverForce = () => {
    set(ref(rtdb, 'site_data/god_mode/takeover_v3'), { active: false });
    showGameToast("Takeover Dihentikan.", "error");
};